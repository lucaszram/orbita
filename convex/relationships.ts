import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { findCurrentUser, omitUndefined, requireUser } from "./lib/users";

export const getActive = query({
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    return await ctx.db
      .query("relationshipProfiles")
      .withIndex("by_user_active", (q: any) => q.eq("userId", user._id).eq("isActive", true))
      .first();
  }
});

export const upsert = mutation({
  args: {
    name: v.string(),
    birthDate: v.optional(v.string()),
    birthTime: v.optional(v.string()),
    birthPlaceLabel: v.optional(v.string()),
    zodiacSign: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const active = await ctx.db
      .query("relationshipProfiles")
      .withIndex("by_user_active", (q: any) => q.eq("userId", user._id).eq("isActive", true))
      .first();

    const payload = omitUndefined({
      userId: user._id,
      name: args.name.trim(),
      birthDate: args.birthDate,
      birthTime: args.birthTime,
      birthPlaceLabel: args.birthPlaceLabel,
      zodiacSign: args.zodiacSign,
      isActive: true,
      updatedAt: now
    });

    if (active) {
      await ctx.db.patch(active._id, payload);
      return active._id;
    }

    return await ctx.db.insert("relationshipProfiles", {
      ...payload,
      createdAt: now,
      updatedAt: now
    });
  }
});
