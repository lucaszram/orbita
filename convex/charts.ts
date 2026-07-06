import {
  actionGeneric as action,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  queryGeneric as query
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { runAstrologyApiNatalChart } from "./lib/astrologyApi";
import {
  ASTROLOGY_API_CHART_CALCULATION_VERSION,
  buildWebB0PersonalityReadingPayload,
  buildWebB0ValuesMapPayload,
  CHART_CALCULATION_VERSION
} from "./lib/orbita";
import { findUserByTokenIdentifier, requireExistingUser, requireIdentity } from "./lib/users";

const internalApi = internal as any;

async function getCurrentBirthData(ctx: any, userId: string) {
  return await ctx.db
    .query("birthData")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();
}

function roundedCoordinate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}

function buildBirthDataHash(birthData: any) {
  return JSON.stringify({
    birthDate: birthData.birthDate,
    birthTime: birthData.birthTime ?? null,
    birthTimePrecision: birthData.birthTimePrecision,
    birthPlaceLabel: birthData.birthPlaceLabel,
    latitude: roundedCoordinate(birthData.latitude),
    longitude: roundedCoordinate(birthData.longitude),
    timezone: birthData.timezone
  });
}

function buildNatalChartCacheKey(userId: string, birthDataHash: string) {
  return `natal:${ASTROLOGY_API_CHART_CALCULATION_VERSION}:${userId}:${birthDataHash}`;
}

async function getCurrentChart(ctx: any, userId: string) {
  return (
    (await ctx.db
      .query("natalCharts")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .order("desc")
      .first()) ??
    (await ctx.db
      .query("natalCharts")
      .withIndex("by_user_version", (q: any) => q.eq("userId", userId).eq("calculationVersion", CHART_CALCULATION_VERSION))
      .first())
  );
}

export const current = query({
  handler: async (ctx) => {
    const user = await requireExistingUser(ctx);
    return await getCurrentChart(ctx, user._id);
  }
});

export const valuesMap = query({
  handler: async (ctx) => {
    const user = await requireExistingUser(ctx);
    const chart = await getCurrentChart(ctx, user._id);

    return chart ? buildWebB0ValuesMapPayload(chart.payload) : null;
  }
});

export const personalityReading = query({
  handler: async (ctx) => {
    const user = await requireExistingUser(ctx);
    const chart = await getCurrentChart(ctx, user._id);

    return chart ? buildWebB0PersonalityReadingPayload(chart.payload) : null;
  }
});

export const getBirthDataForNatalCalculation = internalQuery({
  args: {
    tokenIdentifier: v.string()
  },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);

    if (!user) {
      throw new Error("User record not found");
    }

    const birthData = await getCurrentBirthData(ctx, user._id);

    if (!birthData) {
      throw new Error("Birth data is required before calculating a natal chart");
    }

    const birthDataHash = buildBirthDataHash(birthData);
    const cacheKey = buildNatalChartCacheKey(user._id, birthDataHash);
    const existing = await ctx.db
      .query("natalCharts")
      .withIndex("by_cacheKey", (q: any) => q.eq("cacheKey", cacheKey))
      .first();

    return {
      userId: user._id,
      birthData,
      birthDataHash,
      cacheKey,
      existingChart: existing ?? null
    };
  }
});

export const persistCalculatedNatalChart = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    birthDataId: v.id("birthData"),
    birthDataHash: v.string(),
    cacheKey: v.string(),
    providerVersion: v.string(),
    calculationVersion: v.string(),
    payload: v.any()
  },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);

    if (!user) {
      throw new Error("User record not found");
    }

    const birthData = await ctx.db.get(args.birthDataId);

    if (!birthData || birthData.userId !== user._id) {
      throw new Error("Birth data not found for user");
    }

    const now = Date.now();
    const existingChart = await ctx.db
      .query("natalCharts")
      .withIndex("by_cacheKey", (q: any) => q.eq("cacheKey", args.cacheKey))
      .first();

    let chartId = existingChart?._id;

    if (existingChart) {
      await ctx.db.patch(existingChart._id, {
        providerVersion: args.providerVersion,
        calculationVersion: args.calculationVersion,
        payload: args.payload,
        updatedAt: now
      });
    } else {
      chartId = await ctx.db.insert("natalCharts", {
        userId: user._id,
        birthDataId: args.birthDataId,
        birthDataHash: args.birthDataHash,
        cacheKey: args.cacheKey,
        providerVersion: args.providerVersion,
        calculationVersion: args.calculationVersion,
        payload: args.payload,
        createdAt: now,
        updatedAt: now
      });
    }

    const existingCache = await ctx.db
      .query("profileAstrologyCaches")
      .withIndex("by_cacheKey", (q: any) => q.eq("cacheKey", args.cacheKey))
      .first();

    const cachePayload = {
      feature: "natal_chart",
      provider: "astrologyapi",
      providerVersion: args.providerVersion,
      calculationVersion: args.calculationVersion,
      birthDataHash: args.birthDataHash,
      chart: args.payload
    };

    if (existingCache) {
      await ctx.db.patch(existingCache._id, {
        natalChartId: chartId,
        cacheVersion: args.calculationVersion,
        payload: cachePayload,
        updatedAt: now
      });
    } else {
      await ctx.db.insert("profileAstrologyCaches", {
        userId: user._id,
        birthDataId: args.birthDataId,
        natalChartId: chartId,
        cacheKey: args.cacheKey,
        cacheVersion: args.calculationVersion,
        payload: cachePayload,
        createdAt: now,
        updatedAt: now
      });
    }

    return await ctx.db.get(chartId);
  }
});

export const calculateOrCreateNatalChart = action({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx as any);
    const state: any = await ctx.runQuery(internalApi.charts.getBirthDataForNatalCalculation, {
      tokenIdentifier: identity.tokenIdentifier
    });

    if (state.existingChart) {
      return state.existingChart;
    }

    const birthData = state.birthData;
    const providerResult = await runAstrologyApiNatalChart({
      input: {
        birthDate: birthData.birthDate,
        birthTime: birthData.birthTime,
        birthTimePrecision: birthData.birthTimePrecision,
        birthPlaceLabel: birthData.birthPlaceLabel,
        latitude: birthData.latitude,
        longitude: birthData.longitude,
        timezone: birthData.timezone
      },
      localDate: new Date().toISOString().slice(0, 10)
    });

    if (providerResult.status !== "success" || !providerResult.normalized?.chart) {
      const detail = providerResult.error ?? (providerResult.warnings.join(", ") || providerResult.status);
      throw new Error(`Natal chart provider failed: ${detail}`);
    }

    return await ctx.runMutation(internalApi.charts.persistCalculatedNatalChart, {
      tokenIdentifier: identity.tokenIdentifier,
      birthDataId: birthData._id,
      birthDataHash: state.birthDataHash,
      cacheKey: state.cacheKey,
      providerVersion: providerResult.providerVersion,
      calculationVersion: ASTROLOGY_API_CHART_CALCULATION_VERSION,
      payload: providerResult.normalized.chart
    });
  }
});
