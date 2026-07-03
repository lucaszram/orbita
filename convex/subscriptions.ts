import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { omitUndefined, requireExistingUser, requireUser } from "./lib/users";

const entitlementValidator = v.union(v.literal("free"), v.literal("plus"));
const subscriptionStatusValidator = v.union(
  v.literal("inactive"),
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("canceled"),
  v.literal("expired")
);

export const getCurrent = query({
  handler: async (ctx) => {
    const user = await requireExistingUser(ctx);
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();

    return (
      subscription ?? {
        userId: user._id,
        entitlement: "free",
        status: "inactive",
        provider: "stub",
        updatedAt: 0
      }
    );
  }
});

export const setStubPlusForDev = mutation({
  args: {
    entitlement: v.optional(entitlementValidator),
    status: v.optional(subscriptionStatusValidator),
    productId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();

    const payload = omitUndefined({
      userId: user._id,
      entitlement: args.entitlement ?? "plus",
      status: args.status ?? "active",
      provider: "stub",
      productId: args.productId ?? "orbita_plus_dev",
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
