import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import {
  buildBirthDataHash,
  buildNatalChartCacheKey,
  dailyReadingNeedsRefresh
} from "./lib/birthDataConsistency";
import {
  buildDailyReadingPayload,
  buildNatalChartSnapshot,
  CHART_CALCULATION_VERSION,
  DAILY_READING_CONTENT_VERSION
} from "./lib/orbita";
import { omitUndefined, requireExistingUser, requireUser } from "./lib/users";

async function getCurrentBirthData(ctx: any, userId: string) {
  return await ctx.db
    .query("birthData")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();
}

async function ensureChart(ctx: any, userId: string) {
  const birthData = await getCurrentBirthData(ctx, userId);
  if (!birthData) {
    return null;
  }

  const cacheKey = buildNatalChartCacheKey(userId, buildBirthDataHash(birthData));
  const exactChart = await ctx.db
    .query("natalCharts")
    .withIndex("by_cacheKey", (q: any) => q.eq("cacheKey", cacheKey))
    .first();
  if (exactChart) return exactChart;

  const payload = buildNatalChartSnapshot({
    birthDate: birthData.birthDate,
    birthTime: birthData.birthTime,
    birthTimePrecision: birthData.birthTimePrecision,
    birthPlaceLabel: birthData.birthPlaceLabel,
    latitude: birthData.latitude,
    longitude: birthData.longitude,
    timezone: birthData.timezone
  });
  const chartId = await ctx.db.insert("natalCharts", {
    userId,
    birthDataId: birthData._id,
    birthDataHash: buildBirthDataHash(birthData),
    calculationVersion: CHART_CALCULATION_VERSION,
    payload,
    createdAt: Date.now()
  });

  return await ctx.db.get(chartId);
}

export const getToday = query({
  args: {
    localDate: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireExistingUser(ctx);
    return await ctx.db
      .query("dailyReadings")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();
  }
});

export const generateToday = mutation({
  args: {
    localDate: v.string(),
    timezone: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("dailyReadings")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();

    const chart = await ensureChart(ctx, user._id);
    if (
      existing &&
      !dailyReadingNeedsRefresh(existing, chart?._id, args.timezone, DAILY_READING_CONTENT_VERSION)
    ) {
      return existing;
    }

    const payload = buildDailyReadingPayload({
      localDate: args.localDate,
      timezone: args.timezone,
      chart: chart?.payload ?? null
    });

    const readingFields = omitUndefined({
      userId: user._id,
      localDate: args.localDate,
      timezone: args.timezone,
      natalChartId: chart?._id,
      contentVersion: DAILY_READING_CONTENT_VERSION,
      payload,
      updatedAt: Date.now()
    });

    if (existing) {
      await ctx.db.patch(existing._id, readingFields);
      return await ctx.db.get(existing._id);
    }

    const readingId = await ctx.db.insert("dailyReadings", {
      ...readingFields,
      createdAt: Date.now()
    });

    return await ctx.db.get(readingId);
  }
});

export const save = mutation({
  args: {
    readingId: v.optional(v.id("dailyReadings")),
    readingDate: v.string(),
    readingPayload: v.any(),
    note: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (args.readingId) {
      const existing = await ctx.db
        .query("savedReadings")
        .withIndex("by_user_reading", (q: any) => q.eq("userId", user._id).eq("readingId", args.readingId))
        .first();

      if (existing) {
        return existing._id;
      }
    }

    return await ctx.db.insert("savedReadings", omitUndefined({
      userId: user._id,
      readingId: args.readingId,
      readingDate: args.readingDate,
      readingPayload: args.readingPayload,
      note: args.note,
      createdAt: Date.now()
    }));
  }
});

export const unsave = mutation({
  args: {
    savedReadingId: v.optional(v.id("savedReadings")),
    readingId: v.optional(v.id("dailyReadings"))
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const saved = args.savedReadingId
      ? await ctx.db.get(args.savedReadingId)
      : args.readingId
        ? await ctx.db
            .query("savedReadings")
            .withIndex("by_user_reading", (q: any) => q.eq("userId", user._id).eq("readingId", args.readingId))
            .first()
        : null;

    if (!saved || saved.userId !== user._id) {
      return false;
    }

    await ctx.db.delete(saved._id);
    return true;
  }
});
