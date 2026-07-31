import { queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { findCurrentUser } from "./lib/users";
import { resolveEntitlement, type SubscriptionRow } from "./lib/entitlements";

const subscriptionStatusValidator = v.union(
  v.literal("inactive"),
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("billing_issue"),
  v.literal("canceled"),
  v.literal("expired")
);
const providerValidator = v.union(v.literal("revenuecat"), v.literal("stripe"), v.literal("stub"));
const planValidator = v.union(v.literal("weekly"), v.literal("yearly"), v.literal("lifetime"));

// Estado de acceso resuelto combinando todas las filas de suscripción del
// usuario (RevenueCat + Stripe + stub). Es la fuente de verdad server-side:
// el cliente combina esto con RevenueCat local, pero nunca escribe su acceso.
export const getCurrent = query({
  args: {},
  returns: v.object({
    entitlement: v.union(v.literal("free"), v.literal("orbita_pro")),
    isPro: v.boolean(),
    status: subscriptionStatusValidator,
    provider: v.optional(providerValidator),
    plan: v.optional(planValidator),
    isLifetime: v.boolean(),
    currentPeriodEnd: v.optional(v.number()),
    willRenew: v.optional(v.boolean()),
    canManageInStripePortal: v.boolean()
  }),
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return resolveEntitlement([], Date.now());
    const rows = (await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect()) as SubscriptionRow[];

    return resolveEntitlement(rows, Date.now());
  }
});
