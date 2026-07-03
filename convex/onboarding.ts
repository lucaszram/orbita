import { mutationGeneric as mutation } from "convex/server";
import { v } from "convex/values";
import { normalizeBirthTime } from "./lib/orbita";
import { getOrCreateUser, omitUndefined, requireUser } from "./lib/users";

const identityValidator = v.union(v.literal("ella"), v.literal("el"), v.literal("prefiero_no_decirlo"));
const birthTimePrecisionValidator = v.union(v.literal("known"), v.literal("approximate"), v.literal("unknown"));
const paymentStateValidator = v.union(v.literal("not_started"), v.literal("started"), v.literal("paid"), v.literal("skipped"));

export const saveDraft = mutation({
  args: {
    clientDraftId: v.optional(v.string()),
    currentStep: v.number(),
    identity: v.optional(identityValidator),
    birthDate: v.optional(v.string()),
    birthTime: v.optional(v.string()),
    birthTimePrecision: v.optional(birthTimePrecisionValidator),
    birthPlaceLabel: v.optional(v.string()),
    placeId: v.optional(v.string()),
    placeProvider: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await getOrCreateUser(ctx).catch(() => null);

    if (!user && !args.clientDraftId) {
      throw new Error("clientDraftId is required for anonymous onboarding drafts");
    }

    const existing = user
      ? await ctx.db
          .query("onboardingDrafts")
          .withIndex("by_user", (q: any) => q.eq("userId", user._id))
          .first()
      : await ctx.db
          .query("onboardingDrafts")
          .withIndex("by_clientDraftId", (q: any) => q.eq("clientDraftId", args.clientDraftId))
          .first();

    const patch = omitUndefined({
      userId: user?._id,
      clientDraftId: args.clientDraftId,
      currentStep: args.currentStep,
      identity: args.identity,
      birthDate: args.birthDate,
      birthTime: normalizeBirthTime(args.birthTime),
      birthTimePrecision: args.birthTimePrecision,
      birthPlaceLabel: args.birthPlaceLabel,
      placeId: args.placeId,
      placeProvider: args.placeProvider,
      latitude: args.latitude,
      longitude: args.longitude,
      timezone: args.timezone,
      accountState: user ? "created" : "anonymous",
      updatedAt: now
    });

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("onboardingDrafts", {
      ...patch,
      currentStep: args.currentStep,
      accountState: user ? "created" : "anonymous",
      paymentState: "not_started",
      createdAt: now,
      updatedAt: now
    });
  }
});

export const completeBirthData = mutation({
  args: {
    clientDraftId: v.optional(v.string()),
    birthDate: v.string(),
    birthTime: v.optional(v.string()),
    birthTimePrecision: birthTimePrecisionValidator,
    birthPlaceLabel: v.string(),
    placeId: v.optional(v.string()),
    placeProvider: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const normalizedBirthTime = normalizeBirthTime(args.birthTime);
    const existingBirthData = await ctx.db
      .query("birthData")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();

    const payload = omitUndefined({
      userId: user._id,
      birthDate: args.birthDate,
      birthTime: normalizedBirthTime,
      birthTimePrecision: args.birthTimePrecision,
      birthPlaceLabel: args.birthPlaceLabel,
      placeId: args.placeId,
      placeProvider: args.placeProvider,
      latitude: args.latitude,
      longitude: args.longitude,
      timezone: args.timezone,
      source: "onboarding",
      updatedAt: now
    });

    const birthDataId = existingBirthData
      ? (await ctx.db.patch(existingBirthData._id, payload), existingBirthData._id)
      : await ctx.db.insert("birthData", { ...payload, createdAt: now });

    const draft = args.clientDraftId
      ? await ctx.db
          .query("onboardingDrafts")
          .withIndex("by_clientDraftId", (q: any) => q.eq("clientDraftId", args.clientDraftId))
          .first()
      : await ctx.db
          .query("onboardingDrafts")
          .withIndex("by_user", (q: any) => q.eq("userId", user._id))
          .first();

    if (draft) {
      await ctx.db.patch(
        draft._id,
        omitUndefined({
          userId: user._id,
          currentStep: Math.max(draft.currentStep ?? 0, 11),
          birthDate: args.birthDate,
          birthTime: normalizedBirthTime,
          birthTimePrecision: args.birthTimePrecision,
          birthPlaceLabel: args.birthPlaceLabel,
          placeId: args.placeId,
          placeProvider: args.placeProvider,
          latitude: args.latitude,
          longitude: args.longitude,
          timezone: args.timezone,
          accountState: "created",
          updatedAt: now
        })
      );
    }

    return birthDataId;
  }
});

export const markAccountCreated = mutation({
  args: {
    clientDraftId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const draft = args.clientDraftId
      ? await ctx.db
          .query("onboardingDrafts")
          .withIndex("by_clientDraftId", (q: any) => q.eq("clientDraftId", args.clientDraftId))
          .first()
      : await ctx.db
          .query("onboardingDrafts")
          .withIndex("by_user", (q: any) => q.eq("userId", user._id))
          .first();

    if (!draft) {
      return await ctx.db.insert("onboardingDrafts", omitUndefined({
        userId: user._id,
        clientDraftId: args.clientDraftId,
        currentStep: 14,
        accountState: "created",
        paymentState: "not_started",
        createdAt: now,
        updatedAt: now
      }));
    }

    await ctx.db.patch(draft._id, {
      userId: user._id,
      currentStep: Math.max(draft.currentStep ?? 0, 14),
      accountState: "created",
      updatedAt: now
    });

    return draft._id;
  }
});

export const markPaymentState = mutation({
  args: {
    state: paymentStateValidator
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const draft = await ctx.db
      .query("onboardingDrafts")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();

    if (!draft) {
      return await ctx.db.insert("onboardingDrafts", {
        userId: user._id,
        currentStep: 15,
        accountState: "created",
        paymentState: args.state,
        createdAt: now,
        updatedAt: now
      });
    }

    await ctx.db.patch(draft._id, {
      currentStep: Math.max(draft.currentStep ?? 0, 15),
      paymentState: args.state,
      updatedAt: now
    });

    return draft._id;
  }
});
