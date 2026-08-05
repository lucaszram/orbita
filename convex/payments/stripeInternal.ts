import {
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery
} from "convex/server";
import { v } from "convex/values";
import {
  PRO_ENTITLEMENT,
  resolveEntitlement,
  type SubscriptionPlan,
  type SubscriptionRow,
  type SubscriptionStatus
} from "../lib/entitlements";
import { recordBackendProductEvent } from "../lib/productAnalytics";
import { stripeSubscriptionLifecycle } from "../lib/stripeSubscription";
import { omitUndefined } from "../lib/users";
import { syncAdminAccountStats } from "../lib/adminAccountData";

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
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return "monthly";
  // Legacy prices remain recognizable for existing subscriptions, but no new
  // weekly/yearly checkout can be created by the public API.
  if (priceId === process.env.STRIPE_PRICE_YEARLY) return "yearly";
  if (priceId === process.env.STRIPE_PRICE_WEEKLY) return "weekly";
  return undefined;
}

export const getStripeBinding = internalQuery({
  args: { clerkUserId: v.string() },
  returns: v.object({
    userId: v.optional(v.id("users")),
    stripeCustomerId: v.optional(v.string()),
    isPro: v.boolean(),
    stripeIsPro: v.boolean()
  }),
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", clerkUserId))
      .first();
    if (!user) return { isPro: false, stripeIsPro: false };

    const rows = (await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect()) as SubscriptionRow[];
    const stripeRows = rows.filter((row) => row.provider === "stripe");
    const stripeCustomerId = (await ctx.db
      .query("subscriptions")
      .withIndex("by_user_provider", (q: any) =>
        q.eq("userId", user._id).eq("provider", "stripe")
      )
      .first())?.providerCustomerId;

    return {
      userId: user._id,
      stripeCustomerId,
      isPro: resolveEntitlement(rows, Date.now()).isPro,
      stripeIsPro: resolveEntitlement(stripeRows, Date.now()).isPro
    };
  }
});

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
      .withIndex("by_user_provider", (q: any) =>
        q.eq("userId", user._id).eq("provider", "stripe")
      )
      .first();

    if (existing) {
      if (
        existing.providerCustomerId &&
        existing.providerCustomerId !== customerId
      ) {
        throw new Error("Stripe customer mismatch");
      }
      if (!existing.providerCustomerId) {
        await ctx.db.patch(existing._id, {
          providerCustomerId: customerId,
          clerkUserId,
          updatedAt: now
        });
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
    await syncAdminAccountStats(ctx, user._id, { now });
    return null;
  }
});

async function upsertStripeRow(
  ctx: any,
  clerkUserId: string | undefined,
  patch: Record<string, unknown>,
  eventAt: number
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
    .withIndex("by_user_provider", (q: any) =>
      q.eq("userId", user._id).eq("provider", "stripe")
    )
    .first();

  if (
    existing &&
    typeof existing.lastEventAt === "number" &&
    existing.lastEventAt > eventAt
  ) {
    return;
  }
  if (
    existing?.providerCustomerId &&
    typeof patch.providerCustomerId === "string" &&
    existing.providerCustomerId !== patch.providerCustomerId
  ) {
    throw new Error("Stripe customer mismatch");
  }

  const base = omitUndefined({
    clerkUserId,
    provider: "stripe",
    updatedAt: now,
    ...patch,
    lastEventAt: eventAt
  });

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
  await syncAdminAccountStats(ctx, user._id, { now });
}

async function recordCheckoutEvent(
  ctx: any,
  clerkUserId: string | undefined,
  eventName: "checkout_completed" | "checkout_failed",
  eventId: string,
  occurredAt: number
): Promise<void> {
  if (!clerkUserId) return;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", clerkUserId))
    .first();
  if (!user) return;

  await recordBackendProductEvent(ctx, {
    eventName,
    userId: user._id,
    dedupeKey: eventId,
    occurredAt
  });
}

async function handleCheckoutCompleted(
  ctx: any,
  session: any,
  eventAt: number,
  eventId: string
): Promise<void> {
  const clerkUserId: string | undefined =
    session.client_reference_id ?? session.metadata?.clerkUserId;
  const plan = session.metadata?.plan;

  // El checkout web nuevo sólo reconoce la suscripción mensual. Sesiones
  // one-time/lifetime y ofertas semanales/anuales antiguas no conceden un
  // acceso nuevo desde checkout.session.completed.
  if (
    session.mode !== "subscription" ||
    plan !== "monthly"
  ) {
    return;
  }

  await upsertStripeRow(
    ctx,
    clerkUserId,
    {
      entitlement: PRO_ENTITLEMENT,
      status: "active",
      plan,
      isLifetime: false,
      providerCustomerId: session.customer,
      providerSubscriptionId: session.subscription
    },
    eventAt
  );
  await recordCheckoutEvent(
    ctx,
    clerkUserId,
    "checkout_completed",
    eventId,
    eventAt
  );
}

async function handleSubscriptionChange(
  ctx: any,
  subscription: any,
  eventType: string,
  eventAt: number
): Promise<void> {
  const clerkUserId: string | undefined = subscription.metadata?.clerkUserId;

  if (eventType === "customer.subscription.deleted") {
    await upsertStripeRow(
      ctx,
      clerkUserId,
      {
        entitlement: "free",
        status: "expired",
        willRenew: false,
        providerSubscriptionId: subscription.id
      },
      eventAt
    );
    return;
  }

  const priceId: string | undefined =
    subscription.items?.data?.[0]?.price?.id;
  const { cancellationScheduled, currentPeriodEnd } =
    stripeSubscriptionLifecycle(subscription);
  const mappedStatus = mapStripeStatus(subscription.status);
  const isActive =
    mappedStatus === "active" ||
    mappedStatus === "trialing" ||
    mappedStatus === "past_due";

  await upsertStripeRow(
    ctx,
    clerkUserId,
    {
      entitlement: isActive ? PRO_ENTITLEMENT : "free",
      status: cancellationScheduled && isActive ? "canceled" : mappedStatus,
      plan: planFromPriceId(priceId),
      willRenew: !cancellationScheduled,
      providerCustomerId: subscription.customer,
      providerSubscriptionId: subscription.id,
      currentPeriodEnd
    },
    eventAt
  );
}

export const dispatchStripeEvent = internalMutation({
  args: { event: v.any() },
  returns: v.null(),
  handler: async (ctx, { event }) => {
    const seen = await ctx.db
      .query("paymentEvents")
      .withIndex("by_provider_eventId", (q: any) =>
        q.eq("provider", "stripe").eq("eventId", event.id)
      )
      .first();
    if (seen) return null;

    const object = event.data?.object ?? {};
    const eventAt =
      typeof event.created === "number" && Number.isFinite(event.created)
        ? event.created * 1000
        : Date.now();
    const clerkUserId: string | undefined =
      object.client_reference_id ??
      object.metadata?.clerkUserId ??
      undefined;

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(ctx, object, eventAt, event.id);
        break;
      case "checkout.session.expired":
        await recordCheckoutEvent(
          ctx,
          clerkUserId,
          "checkout_failed",
          event.id,
          eventAt
        );
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(ctx, object, event.type, eventAt);
        break;
      default:
        break;
    }

    await ctx.db.insert(
      "paymentEvents",
      omitUndefined({
        provider: "stripe" as const,
        eventId: event.id,
        eventType:
          typeof event.type === "string" ? event.type : "unknown",
        clerkUserId,
        rawPayload: event,
        processedAt: Date.now()
      })
    );
    return null;
  }
});
