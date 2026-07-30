import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { findCurrentBirthData } from "./lib/birthDataConsistency";
import { normalizeBirthTime } from "./lib/orbita";
import { findCurrentUser, omitUndefined, requireUser } from "./lib/users";

const birthTimePrecisionValidator = v.union(v.literal("known"), v.literal("approximate"), v.literal("unknown"));

export const getCurrent = query({
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    return await findCurrentBirthData(ctx, user._id);
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
    const existing = await findCurrentBirthData(ctx, user._id);

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
