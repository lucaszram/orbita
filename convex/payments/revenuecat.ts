import {
  httpActionGeneric as httpAction,
  internalMutationGeneric as internalMutation,
  makeFunctionReference
} from "convex/server";
import { v } from "convex/values";
import { omitUndefined } from "../lib/users";
import { PRO_ENTITLEMENT, type SubscriptionPlan, type SubscriptionStatus } from "../lib/entitlements";

const applyEventRef = makeFunctionReference<"mutation">("payments/revenuecat:applyRevenueCatEvent");

// RevenueCat manda el product id tal cual lo configuramos: weekly | yearly | lifetime.
function planFromProductId(productId?: string): SubscriptionPlan | undefined {
  if (!productId) return undefined;
  const id = productId.toLowerCase();
  if (id.includes("lifetime")) return "lifetime";
  if (id.includes("year") || id.includes("annual")) return "yearly";
  if (id.includes("week")) return "weekly";
  return undefined;
}

// El app_user_id es el clerkUserId (el SDK hace Purchases.logIn(clerkUserId)).
// Si es anónimo, buscamos un alias no anónimo.
function resolveClerkUserId(event: any): string | undefined {
  const appUserId: string | undefined = event?.app_user_id;
  if (appUserId && !appUserId.startsWith("$RCAnonymousID:")) return appUserId;
  const aliases: string[] = Array.isArray(event?.aliases) ? event.aliases : [];
  return aliases.find((alias) => alias && !alias.startsWith("$RCAnonymousID:"));
}

// POST /webhooks/revenuecat — verifica el Authorization header y delega en la
// mutation. Responde 200 siempre que el evento se procese (RC reintenta ante no-2xx).
export const revenuecatWebhook = httpAction(async (ctx, request) => {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  const provided = request.headers.get("Authorization");
  if (!expected || provided !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const event = body?.event;
  if (!event || typeof event.id !== "string") {
    return new Response("Bad Request", { status: 400 });
  }

  await ctx.runMutation(applyEventRef, { event });
  return new Response(null, { status: 200 });
});

export const applyRevenueCatEvent = internalMutation({
  args: { event: v.any() },
  returns: v.null(),
  handler: async (ctx, { event }) => {
    // Idempotencia: evento ya visto → salir.
    const seen = await ctx.db
      .query("paymentEvents")
      .withIndex("by_provider_eventId", (q: any) => q.eq("provider", "revenuecat").eq("eventId", event.id))
      .first();
    if (seen) return null;

    const clerkUserId = resolveClerkUserId(event);
    const environment = event.environment === "SANDBOX" ? "sandbox" : "production";
    const eventTimestamp: number | undefined =
      typeof event.event_timestamp_ms === "number" ? event.event_timestamp_ms : undefined;

    const recordEvent = async () =>
      ctx.db.insert(
        "paymentEvents",
        omitUndefined({
          provider: "revenuecat" as const,
          eventId: event.id,
          eventType: typeof event.type === "string" ? event.type : "UNKNOWN",
          clerkUserId,
          rawPayload: event,
          processedAt: Date.now()
        })
      );

    // Sin usuario resuelto todavía: guardar el evento y salir 200. Un TRANSFER o
    // el login posterior re-vinculan; no tiramos error para no entrar en retry-loop.
    if (!clerkUserId) {
      await recordEvent();
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", clerkUserId))
      .first();
    if (!user) {
      await recordEvent();
      return null;
    }

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_provider", (q: any) => q.eq("userId", user._id).eq("provider", "revenuecat"))
      .first();

    // Descartar eventos fuera de orden.
    if (existing && eventTimestamp !== undefined && existing.lastEventAt && eventTimestamp <= existing.lastEventAt) {
      await recordEvent();
      return null;
    }

    const now = Date.now();
    const expirationMs: number | undefined =
      typeof event.expiration_at_ms === "number" ? event.expiration_at_ms : undefined;
    const productId: string | undefined = event.new_product_id ?? event.product_id;
    const plan = planFromProductId(productId);

    // Estado a partir del tipo de evento.
    const patch: {
      entitlement?: "free" | "orbita_pro";
      status?: SubscriptionStatus;
      plan?: SubscriptionPlan;
      productId?: string;
      currentPeriodEnd?: number;
      isLifetime?: boolean;
      willRenew?: boolean;
    } = {};

    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
        patch.entitlement = PRO_ENTITLEMENT;
        patch.status = event.period_type === "TRIAL" ? "trialing" : "active";
        patch.currentPeriodEnd = expirationMs;
        patch.willRenew = true;
        patch.plan = plan;
        patch.productId = productId;
        break;
      case "NON_RENEWING_PURCHASE":
        // lifetime: acceso permanente, sin fecha de fin.
        patch.entitlement = PRO_ENTITLEMENT;
        patch.status = "active";
        patch.isLifetime = plan === "lifetime";
        patch.currentPeriodEnd = plan === "lifetime" ? undefined : expirationMs;
        patch.plan = plan;
        patch.productId = productId;
        break;
      case "PRODUCT_CHANGE":
        patch.plan = plan;
        patch.productId = productId;
        patch.currentPeriodEnd = expirationMs;
        break;
      case "UNCANCELLATION":
        patch.status = "active";
        patch.willRenew = true;
        break;
      case "CANCELLATION":
        if (event.cancel_reason === "CUSTOMER_SUPPORT") {
          // refund → corte inmediato.
          patch.entitlement = "free";
          patch.status = "expired";
        } else {
          // baja programada: acceso hasta currentPeriodEnd.
          patch.status = "canceled";
          patch.willRenew = false;
        }
        break;
      case "EXPIRATION":
        patch.entitlement = "free";
        patch.status = "expired";
        break;
      case "BILLING_ISSUE":
        patch.status = "billing_issue";
        break;
      case "TRANSFER":
        // La re-vinculación fina llega con los eventos de compra siguientes;
        // acá solo registramos el evento.
        await recordEvent();
        return null;
      default:
        await recordEvent();
        return null;
    }

    const base = omitUndefined({
      userId: user._id,
      clerkUserId,
      provider: "revenuecat" as const,
      environment,
      originalTransactionId: event.original_transaction_id,
      lastEventAt: eventTimestamp ?? now,
      updatedAt: now,
      ...patch
    });

    if (existing) {
      await ctx.db.patch(existing._id, base);
    } else {
      await ctx.db.insert("subscriptions", {
        entitlement: patch.entitlement ?? PRO_ENTITLEMENT,
        status: patch.status ?? "active",
        ...base
      });
    }

    await recordEvent();
    return null;
  }
});
