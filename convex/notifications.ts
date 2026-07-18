import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { findCurrentUser, requireUser } from "./lib/users";

export const getPreferences = query({
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    return await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
  }
});

export const upsertPreferences = mutation({
  args: {
    enabled: v.boolean(),
    dailyTime: v.string(),
    timezone: v.string(),
    topics: v.array(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();

    const payload = {
      userId: user._id,
      enabled: args.enabled,
      dailyTime: args.dailyTime,
      timezone: args.timezone,
      topics: args.topics,
      updatedAt: now
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("notificationPreferences", payload);
  }
});
