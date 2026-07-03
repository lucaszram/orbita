import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { normalizeBirthTime } from "./lib/orbita";
import { omitUndefined, requireExistingUser, requireUser } from "./lib/users";

const birthTimePrecisionValidator = v.union(v.literal("known"), v.literal("approximate"), v.literal("unknown"));

export const getCurrent = query({
  handler: async (ctx) => {
    const user = await requireExistingUser(ctx);
    return await ctx.db
      .query("birthData")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
  }
});

export const upsertForCurrentUser = mutation({
  args: {
    birthDate: v.string(),
    birthTime: v.optional(v.string()),
    birthTimePrecision: birthTimePrecisionValidator,
    birthPlaceLabel: v.string(),
    placeId: v.optional(v.string()),
    placeProvider: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.string(),
    source: v.optional(v.union(v.literal("onboarding"), v.literal("profile"), v.literal("import")))
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("birthData")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();

    const payload = omitUndefined({
      userId: user._id,
      birthDate: args.birthDate,
      birthTime: normalizeBirthTime(args.birthTime),
      birthTimePrecision: args.birthTimePrecision,
      birthPlaceLabel: args.birthPlaceLabel,
      placeId: args.placeId,
      placeProvider: args.placeProvider,
      latitude: args.latitude,
      longitude: args.longitude,
      timezone: args.timezone,
      source: args.source ?? "profile",
      updatedAt: now
    });

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("birthData", { ...payload, createdAt: now });
  }
});
