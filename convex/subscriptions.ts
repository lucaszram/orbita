import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { findCurrentUser, omitUndefined, requireUser } from "./lib/users";
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

// Solo para desarrollo. Marca al usuario como Pro sin pasar por RevenueCat/Stripe.
// Gateado por `ALLOW_DEV_STUB=true` en Convex; en prod tira error.
export const setStubPlusForDev = mutation({
  args: {
    entitlement: v.optional(v.union(v.literal("free"), v.literal("orbita_pro"))),
    status: v.optional(subscriptionStatusValidator),
    productId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    if (process.env.ALLOW_DEV_STUB !== "true") {
      throw new Error("setStubPlusForDev is disabled (set ALLOW_DEV_STUB=true in Convex to enable)");
    }

    const user = await requireUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_provider", (q: any) => q.eq("userId", user._id).eq("provider", "stub"))
      .first();

    const payload = omitUndefined({
      userId: user._id,
      clerkUserId: user.clerkUserId,
      entitlement: args.entitlement ?? "orbita_pro",
      status: args.status ?? "active",
      provider: "stub" as const,
      productId: args.productId ?? "orbita_pro_dev",
      currentPeriodEnd: args.currentPeriodEnd,
      updatedAt: now
    });

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", payload);
  }
});
