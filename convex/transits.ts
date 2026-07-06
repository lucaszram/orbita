import {
  actionGeneric as action,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { runAstrologyApiDailyTransits } from "./lib/astrologyApi";
import {
  buildDailyReadingPayloadFromAstrology,
  buildWebB0TransitDetailPayload,
  DAILY_READING_EDITORIAL_VERSION,
  extractNormalizedChartFromPayload
} from "./lib/orbita";
import { findUserByTokenIdentifier, omitUndefined, requireIdentity } from "./lib/users";

const internalApi = internal as any;
const DAILY_TRANSITS_TIMELINE_VERSION = "orbita-daily-transits-v1";

async function getCurrentBirthData(ctx: any, userId: string) {
  return await ctx.db
    .query("birthData")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();
}

async function getCurrentChart(ctx: any, userId: string) {
  return await ctx.db
    .query("natalCharts")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();
}

export const getTodayState = internalQuery({
  args: {
    tokenIdentifier: v.string(),
    localDate: v.string(),
    providerVersion: v.string()
  },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);

    if (!user) {
      throw new Error("User record not found");
    }

    const providerTransitReading = await ctx.db
      .query("transitReadings")
      .withIndex("by_user_date_provider", (q: any) =>
        q.eq("userId", user._id).eq("localDate", args.localDate).eq("providerVersion", args.providerVersion)
      )
      .first();
    const fallbackTransitReading = await ctx.db
      .query("transitReadings")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .order("desc")
      .first();
    const dailyReading = await ctx.db
      .query("dailyReadings")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .order("desc")
      .first();

    return {
      userId: user._id,
      birthData: await getCurrentBirthData(ctx, user._id),
      natalChart: await getCurrentChart(ctx, user._id),
      providerTransitReading,
      fallbackTransitReading,
      dailyReading
    };
  }
});

export const persistTodayFromProvider = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    localDate: v.string(),
    timezone: v.string(),
    natalChartId: v.optional(v.id("natalCharts")),
    providerVersion: v.string(),
    timelineVersion: v.string(),
    payload: v.any()
  },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);

    if (!user) {
      throw new Error("User record not found");
    }

    if (args.natalChartId) {
      const chart = await ctx.db.get(args.natalChartId);
      if (!chart || chart.userId !== user._id) {
        throw new Error("Natal chart not found for user");
      }
    }

    const now = Date.now();
    const providerTransitReading = await ctx.db
      .query("transitReadings")
      .withIndex("by_user_date_provider", (q: any) =>
        q.eq("userId", user._id).eq("localDate", args.localDate).eq("providerVersion", args.providerVersion)
      )
      .first();
    const fallbackTransitReading =
      providerTransitReading ??
      (await ctx.db
        .query("transitReadings")
        .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
        .order("desc")
        .first());
    const transitFields = omitUndefined({
      timezone: args.timezone,
      natalChartId: args.natalChartId,
      providerVersion: args.providerVersion,
      timelineVersion: args.timelineVersion,
      payload: args.payload,
      updatedAt: now
    });
    let transitReadingId = fallbackTransitReading?._id;

    if (fallbackTransitReading) {
      await ctx.db.patch(fallbackTransitReading._id, transitFields);
    } else {
      transitReadingId = await ctx.db.insert(
        "transitReadings",
        omitUndefined({
          userId: user._id,
          localDate: args.localDate,
          timezone: args.timezone,
          natalChartId: args.natalChartId,
          providerVersion: args.providerVersion,
          timelineVersion: args.timelineVersion,
          payload: args.payload,
          createdAt: now,
          updatedAt: now
        })
      );
    }

    const existingDailyReading = await ctx.db
      .query("dailyReadings")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .order("desc")
      .first();
    const dailyFields = omitUndefined({
      timezone: args.timezone,
      natalChartId: args.natalChartId,
      contentVersion: DAILY_READING_EDITORIAL_VERSION,
      provider: "astrologyapi",
      status: "ready",
      payload: args.payload,
      updatedAt: now
    });

    if (existingDailyReading) {
      await ctx.db.patch(existingDailyReading._id, dailyFields);
    } else {
      await ctx.db.insert(
        "dailyReadings",
        omitUndefined({
          userId: user._id,
          localDate: args.localDate,
          timezone: args.timezone,
          natalChartId: args.natalChartId,
          contentVersion: DAILY_READING_EDITORIAL_VERSION,
          provider: "astrologyapi",
          status: "ready",
          payload: args.payload,
          createdAt: now,
          updatedAt: now
        })
      );
    }

    return await ctx.db.get(transitReadingId);
  }
});

export const getToday = action({
  args: {
    localDate: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx as any);
    const providerVersion = "astrologyapi-western-daily-transits-v3";
    const state: any = await ctx.runQuery(internalApi.transits.getTodayState, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate: args.localDate,
      providerVersion
    });

    if (state.providerTransitReading) {
      return buildWebB0TransitDetailPayload(state.providerTransitReading.payload, args.localDate);
    }

    if (!state.birthData) {
      const fallback = state.fallbackTransitReading ?? state.dailyReading;
      if (fallback) {
        return buildWebB0TransitDetailPayload(fallback.payload, args.localDate);
      }
      throw new Error("Birth data is required before calculating daily transits");
    }

    const birthData = state.birthData;
    const providerResult = await runAstrologyApiDailyTransits({
      input: {
        birthDate: birthData.birthDate,
        birthTime: birthData.birthTime,
        birthTimePrecision: birthData.birthTimePrecision,
        birthPlaceLabel: birthData.birthPlaceLabel,
        latitude: birthData.latitude,
        longitude: birthData.longitude,
        timezone: birthData.timezone
      },
      localDate: args.localDate
    });

    if (providerResult.status !== "success" || !providerResult.normalized) {
      const fallback = state.fallbackTransitReading ?? state.dailyReading;
      if (fallback) {
        return buildWebB0TransitDetailPayload(fallback.payload, args.localDate);
      }

      const detail = providerResult.error ?? (providerResult.warnings.join(", ") || providerResult.status);
      throw new Error(`Daily transit provider failed: ${detail}`);
    }

    const chart = extractNormalizedChartFromPayload(state.natalChart?.payload);
    const transits = providerResult.normalized.transits;
    const payload = {
      ...buildDailyReadingPayloadFromAstrology({
        localDate: args.localDate,
        timezone: birthData.timezone,
        chart,
        transits
      }),
      provider: {
        status: providerResult.status,
        providerVersion: providerResult.providerVersion,
        houseSystem: providerResult.houseSystem,
        endpoint: "natal_transits/daily",
        warnings: providerResult.warnings
      },
      modelGaps: [
        ...providerResult.warnings,
        ...(transits.length === 0 ? ["daily_transits_empty_or_unavailable"] : []),
        "editorial_review_required_before_app_release"
      ],
      reviewStatus: "needs_review",
      rawPolicy: {
        returnsProviderRaw: false,
        reason: "transitReadings y dailyReadings guardan solo payload normalizado; raw/request queda fuera de tablas app-facing."
      }
    };
    const transitReading: any = await ctx.runMutation(
      internalApi.transits.persistTodayFromProvider,
      omitUndefined({
        tokenIdentifier: identity.tokenIdentifier,
        localDate: args.localDate,
        timezone: birthData.timezone,
        natalChartId: state.natalChart?._id,
        providerVersion: providerResult.providerVersion,
        timelineVersion: DAILY_TRANSITS_TIMELINE_VERSION,
        payload
      })
    );

    return buildWebB0TransitDetailPayload(transitReading.payload, args.localDate);
  }
});
