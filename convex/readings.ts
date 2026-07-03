import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import {
  buildDailyReadingPayload,
  buildNatalChartSnapshot,
  CHART_CALCULATION_VERSION,
  DAILY_READING_CONTENT_VERSION
} from "./lib/orbita";
import { omitUndefined, requireExistingUser, requireUser } from "./lib/users";

async function getCurrentChart(ctx: any, userId: string) {
  return await ctx.db
    .query("natalCharts")
    .withIndex("by_user_version", (q: any) => q.eq("userId", userId).eq("calculationVersion", CHART_CALCULATION_VERSION))
    .first();
}

async function getCurrentBirthData(ctx: any, userId: string) {
  return await ctx.db
    .query("birthData")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
}

async function ensureChart(ctx: any, userId: string) {
  const existingChart = await getCurrentChart(ctx, userId);
  if (existingChart) {
    return existingChart;
  }

  const birthData = await getCurrentBirthData(ctx, userId);
  if (!birthData) {
    return null;
  }

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

    if (existing) {
      return existing;
    }

    const chart = await ensureChart(ctx, user._id);
    const payload = buildDailyReadingPayload({
      localDate: args.localDate,
      timezone: args.timezone,
      chart: chart?.payload ?? null
    });

    const readingId = await ctx.db.insert("dailyReadings", omitUndefined({
      userId: user._id,
      localDate: args.localDate,
      timezone: args.timezone,
      natalChartId: chart?._id,
      contentVersion: DAILY_READING_CONTENT_VERSION,
      payload,
      createdAt: Date.now()
    }));

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
