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
import { findCurrentUser, omitUndefined, requireUser } from "./lib/users";

export const DEFAULT_SAVED_READINGS_LIMIT = 60;
export const MAX_SAVED_READINGS_LIMIT = 120;

/** El front restaura hasta 60 lecturas activas. Permitimos pedir menos y dejamos
 *  margen para una futura paginación, pero nunca una lectura sin límite. */
export function resolveSavedReadingsLimit(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SAVED_READINGS_LIMIT;
  return Math.max(1, Math.min(MAX_SAVED_READINGS_LIMIT, Math.trunc(value)));
}

export function savedReadingListItem(doc: any) {
  return {
    savedReadingId: doc._id,
    readingId: doc.readingId ?? null,
    readingDate: doc.readingDate,
    readingPayload: doc.readingPayload,
    note: doc.note ?? null,
    createdAt: doc.createdAt
  };
}

export async function listSavedReadingsForUser(ctx: any, userId: string, limit?: number) {
  const rows = await ctx.db
    .query("savedReadings")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .take(resolveSavedReadingsLimit(limit));

  return rows.map(savedReadingListItem);
}

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
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    return await ctx.db
      .query("dailyReadings")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();
  }
});

/** Archivo remoto de lecturas que la persona guardó explícitamente.
 *
 * No reemplaza el snapshot local: una escritura offline puede existir solo en el
 * teléfono. El front debe mergear ambas fuentes por `readingPayload.id` (o por fecha
 * como fallback), con lo local primero, y nunca borrar lo local porque el remoto esté
 * vacío. Esto permite recuperar en un teléfono/simulador nuevo todo lo que sí llegó a
 * Convex en versiones anteriores. */
export const listSaved = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];
    return await listSavedReadingsForUser(ctx, user._id, args.limit);
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
