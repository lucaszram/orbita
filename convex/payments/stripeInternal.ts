import {
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery
} from "convex/server";
import { v } from "convex/values";
import { omitUndefined } from "../lib/users";
import { PRO_ENTITLEMENT, type SubscriptionPlan, type SubscriptionStatus } from "../lib/entitlements";

// Stripe status → nuestro enum.
function mapStripeStatus(status?: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "expired";
    default:
      return "inactive";
  }
}

function planFromPriceId(priceId?: string): SubscriptionPlan | undefined {
  if (!priceId) return undefined;
  if (priceId === process.env.STRIPE_PRICE_LIFETIME) return "lifetime";
  if (priceId === process.env.STRIPE_PRICE_YEARLY) return "yearly";
  if (priceId === process.env.STRIPE_PRICE_WEEKLY) return "weekly";
  return undefined;
}

// Datos que la action de checkout necesita para reusar el customer de Stripe
// y no crear duplicados.
export const getStripeBinding = internalQuery({
  args: { clerkUserId: v.string() },
  returns: v.object({
    userId: v.optional(v.id("users")),
    stripeCustomerId: v.optional(v.string())
  }),
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", clerkUserId))
      .first();
    if (!user) return {};

    const row = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_provider", (q: any) => q.eq("userId", user._id).eq("provider", "stripe"))
      .first();

    return { userId: user._id, stripeCustomerId: row?.providerCustomerId };
  }
});

// Guarda el customer de Stripe apenas se crea en la action, para reusarlo.
export const upsertStripeCustomer = internalMutation({
  args: { clerkUserId: v.string(), customerId: v.string() },
  returns: v.null(),
  handler: async (ctx, { clerkUserId, customerId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", clerkUserId))
      .first();
    if (!user) return null;

    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_provider", (q: any) => q.eq("userId", user._id).eq("provider", "stripe"))
      .first();

    if (existing) {
      if (!existing.providerCustomerId) {
        await ctx.db.patch(existing._id, { providerCustomerId: customerId, clerkUserId, updatedAt: now });
      }
      return null;
    }

    await ctx.db.insert("subscriptions", {
      userId: user._id,
      clerkUserId,
      provider: "stripe",
      providerCustomerId: customerId,
      entitlement: "free",
      status: "inactive",
      updatedAt: now
    });
    return null;
  }
});

async function upsertStripeRow(
  ctx: any,
  clerkUserId: string | undefined,
  patch: Record<string, unknown>
): Promise<void> {
  if (!clerkUserId) return;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", clerkUserId))
    .first();
  if (!user) return;

  const now = Date.now();
  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_user_provider", (q: any) => q.eq("userId", user._id).eq("provider", "stripe"))
    .first();

  const base = omitUndefined({ clerkUserId, provider: "stripe", updatedAt: now, ...patch });

  if (existing) {
    await ctx.db.patch(existing._id, base);
  } else {
    await ctx.db.insert("subscriptions", {
      userId: user._id,
      entitlement: (patch.entitlement as string) ?? "free",
      status: (patch.status as string) ?? "inactive",
      ...base
    });
  }
}

// checkout.session.completed — alta inmediata al volver del checkout.
async function handleCheckoutCompleted(ctx: any, session: any): Promise<void> {
  const clerkUserId: string | undefined = session.client_reference_id ?? session.metadata?.clerkUserId;
  const now = Date.now();

  if (session.mode === "payment") {
    // lifetime (one-time).
    await upsertStripeRow(ctx, clerkUserId, {
      entitlement: PRO_ENTITLEMENT,
      status: "active",
      plan: "lifetime",
      isLifetime: true,
      providerCustomerId: session.customer,
      originalTransactionId: session.payment_intent,
      lastEventAt: now
    });
  } else {
    // subscription: activar; el detalle fino llega por customer.subscription.updated.
    await upsertStripeRow(ctx, clerkUserId, {
      entitlement: PRO_ENTITLEMENT,
      status: "active",
      providerCustomerId: session.customer,
      providerSubscriptionId: session.subscription,
      lastEventAt: now
    });
  }
}

// customer.subscription.updated / .deleted
async function handleSubscriptionChange(ctx: any, subscription: any, eventType: string): Promise<void> {
  const clerkUserId: string | undefined = subscription.metadata?.clerkUserId;
  const now = Date.now();

  if (eventType === "customer.subscription.deleted") {
    await upsertStripeRow(ctx, clerkUserId, {
      entitlement: "free",
      status: "expired",
      willRenew: false,
      providerSubscriptionId: subscription.id,
      lastEventAt: now
    });
    return;
  }

  const priceId: string | undefined = subscription.items?.data?.[0]?.price?.id;
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  const mappedStatus = mapStripeStatus(subscription.status);
  const currentPeriodEnd =
    typeof subscription.current_period_end === "number" ? subscription.current_period_end * 1000 : undefined;
  const isActive = mappedStatus === "active" || mappedStatus === "trialing" || mappedStatus === "past_due";

  await upsertStripeRow(ctx, clerkUserId, {
    entitlement: isActive ? PRO_ENTITLEMENT : "free",
    status: cancelAtPeriodEnd && isActive ? "canceled" : mappedStatus,
    plan: planFromPriceId(priceId),
    willRenew: !cancelAtPeriodEnd,
    providerCustomerId: subscription.customer,
    providerSubscriptionId: subscription.id,
    currentPeriodEnd,
    lastEventAt: now
  });
}

// charge.refunded — corte para el lifetime (matchea payment_intent).
async function handleRefund(ctx: any, charge: any): Promise<void> {
  const paymentIntent: string | undefined =
    typeof charge.payment_intent === "string" ? charge.payment_intent : undefined;
  if (!paymentIntent) return;

  const row = await ctx.db
    .query("subscriptions")
    .filter((q: any) => q.eq(q.field("originalTransactionId"), paymentIntent))
    .first();
  if (!row) return;

  await ctx.db.patch(row._id, {
    entitlement: "free",
    status: "expired",
    willRenew: false,
    updatedAt: Date.now()
  });
}

// Punto único de entrada del webhook Stripe (ya verificado en el httpAction):
// idempotencia + routing por tipo de evento, atómico.
export const dispatchStripeEvent = internalMutation({
  args: { event: v.any() },
  returns: v.null(),
  handler: async (ctx, { event }) => {
    const seen = await ctx.db
      .query("paymentEvents")
      .withIndex("by_provider_eventId", (q: any) => q.eq("provider", "stripe").eq("eventId", event.id))
      .first();
    if (seen) return null;

    const object = event.data?.object ?? {};
    const clerkUserId: string | undefined =
      object.client_reference_id ?? object.metadata?.clerkUserId ?? undefined;

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(ctx, object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(ctx, object, event.type);
        break;
      case "charge.refunded":
        await handleRefund(ctx, object);
        break;
      default:
        break;
    }

    await ctx.db.insert(
      "paymentEvents",
      omitUndefined({
        provider: "stripe" as const,
        eventId: event.id,
        eventType: typeof event.type === "string" ? event.type : "unknown",
        clerkUserId,
        rawPayload: event,
        processedAt: Date.now()
      })
    );
    return null;
  }
});
