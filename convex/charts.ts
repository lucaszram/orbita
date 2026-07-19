import {
  actionGeneric as action,
  internalActionGeneric as internalAction,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  queryGeneric as query
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  generateNatalReadingWithGateway,
  getAiGatewayNatalCacheVersion,
  getAiGatewayNatalPromptVersion
} from "./lib/aiGateway";
import { runAstrologyApiNatalChart } from "./lib/astrologyApi";
import { buildBirthDataHash, buildNatalChartCacheKey } from "./lib/birthDataConsistency";
import {
  ASTROLOGY_API_CHART_CALCULATION_VERSION,
  buildWebB0ValuesMapPayload,
  CHART_CALCULATION_VERSION
} from "./lib/orbita";
import { findCurrentUser, findUserByTokenIdentifier, requireIdentity } from "./lib/users";

const internalApi = internal as any;

async function getCurrentBirthData(ctx: any, userId: string) {
  return await ctx.db
    .query("birthData")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();
}

async function getCurrentChart(ctx: any, userId: string) {
  const birthData = await getCurrentBirthData(ctx, userId);
  if (birthData) {
    const cacheKey = buildNatalChartCacheKey(userId, buildBirthDataHash(birthData));
    const exactChart = await ctx.db
      .query("natalCharts")
      .withIndex("by_cacheKey", (q: any) => q.eq("cacheKey", cacheKey))
      .first();
    if (exactChart) return exactChart;
  }

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
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    return await getCurrentChart(ctx, user._id);
  }
});

export const valuesMap = query({
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    const chart = await getCurrentChart(ctx, user._id);

    return chart ? buildWebB0ValuesMapPayload(chart.payload) : null;
  }
});

const NATAL_READING_FEATURE = "personality";
const NATAL_READING_LEASE_MS = 90 * 1000;

async function getCachedPersonalityReading(ctx: any, natalChartId: string) {
  const promptVersion = getAiGatewayNatalPromptVersion();
  return await ctx.db
    .query("natalInterpretations")
    .withIndex("by_chart_feature_version", (q: any) =>
      q.eq("natalChartId", natalChartId).eq("feature", NATAL_READING_FEATURE).eq("promptVersion", promptVersion)
    )
    .first();
}

type PersonalityReadingCache = {
  status?: string;
  payload?: unknown;
  updatedAt?: number;
} | null | undefined;

export type NatalGenerationClaim = "ready" | "pending" | "claim";
export type NatalReadingPublicStatus = "pending" | "ready" | "error";

/**
 * Una mutation serializada usa esta decisión para que el cliente y el prewarm
 * no disparen dos lecturas largas a la vez. Un pending viejo se puede retomar.
 */
export function resolveNatalGenerationClaim(
  cached: PersonalityReadingCache,
  now: number,
  leaseMs = NATAL_READING_LEASE_MS
): NatalGenerationClaim {
  if (cached?.status === "ready" && cached.payload) return "ready";
  if (
    cached?.status === "pending" &&
    typeof cached.updatedAt === "number" &&
    now - cached.updatedAt < leaseMs
  ) {
    return "pending";
  }
  return "claim";
}

/** Estado mínimo para que el bloque de lectura nunca quede cargando a ciegas. */
export function resolveNatalReadingPublicStatus(
  cached: PersonalityReadingCache,
  now: number,
  leaseMs = NATAL_READING_LEASE_MS
): NatalReadingPublicStatus {
  if (cached?.status === "ready" && cached.payload) return "ready";
  if (cached?.status === "error" || cached?.status === "fallback") return "error";
  if (
    cached?.status === "pending" &&
    typeof cached.updatedAt === "number" &&
    now - cached.updatedAt >= leaseMs
  ) {
    return "error";
  }
  return "pending";
}

/** Solo una lectura LLM completa y persistida se considera lista para mostrar. */
export function resolveReadyPersonalityReading(cached: PersonalityReadingCache) {
  return cached?.status === "ready" && cached.payload ? cached.payload : null;
}

type NatalGenerationResult = {
  status: string;
  payload?: unknown;
  [key: string]: unknown;
};

/** Convierte cualquier fallo del generador en un rechazo recuperable para el cliente. */
export function requireSuccessfulNatalReading(result: NatalGenerationResult) {
  if (result.status !== "success" || !result.payload) {
    throw new Error("NATAL_READING_GENERATION_FAILED");
  }
  return result.payload;
}

export const personalityReading = query({
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    const chart = await getCurrentChart(ctx, user._id);
    if (!chart) return null;

    const cached = await getCachedPersonalityReading(ctx, chart._id);
    return resolveReadyPersonalityReading(cached);
  }
});

export const personalityReadingState = query({
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return { status: "pending" as const };
    const chart = await getCurrentChart(ctx, user._id);
    if (!chart) return { status: "pending" as const };
    const cached = await getCachedPersonalityReading(ctx, chart._id);
    return { status: resolveNatalReadingPublicStatus(cached, Date.now()) };
  }
});

export const getNatalReadingState = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) {
      throw new Error("User record not found");
    }
    const chart = await getCurrentChart(ctx, user._id);
    if (!chart) {
      return { userId: user._id, chartId: null, chartPayload: null, cachedStatus: null };
    }
    const cached = await getCachedPersonalityReading(ctx, chart._id);
    return {
      userId: user._id,
      chartId: chart._id,
      chartPayload: chart.payload,
      cachedStatus: cached?.status ?? null
    };
  }
});

export const getNatalReadingStateByChart = internalQuery({
  args: { natalChartId: v.id("natalCharts") },
  handler: async (ctx, args) => {
    const chart = await ctx.db.get(args.natalChartId);
    if (!chart) return null;
    const cached = await getCachedPersonalityReading(ctx, chart._id);
    return {
      userId: chart.userId,
      chartId: chart._id,
      chartPayload: chart.payload,
      cachedStatus: cached?.status ?? null
    };
  }
});

export const claimNatalReadingGeneration = internalMutation({
  args: {
    userId: v.id("users"),
    natalChartId: v.id("natalCharts"),
    locale: v.string(),
    promptVersion: v.string(),
    cacheVersion: v.string()
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("natalInterpretations")
      .withIndex("by_chart_feature_version", (q: any) =>
        q
          .eq("natalChartId", args.natalChartId)
          .eq("feature", NATAL_READING_FEATURE)
          .eq("promptVersion", args.promptVersion)
      )
      .first();
    const decision = resolveNatalGenerationClaim(existing, now);
    if (decision !== "claim") return decision;

    const fields = {
      userId: args.userId,
      natalChartId: args.natalChartId,
      feature: NATAL_READING_FEATURE,
      locale: args.locale,
      promptVersion: args.promptVersion,
      cacheVersion: args.cacheVersion,
      provider: "vercel-ai-gateway",
      status: "pending" as const,
      payload: null,
      updatedAt: now
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("natalInterpretations", { ...fields, createdAt: now });
    }
    return "claimed";
  }
});

export const persistNatalReading = internalMutation({
  args: {
    userId: v.id("users"),
    natalChartId: v.id("natalCharts"),
    locale: v.string(),
    promptVersion: v.string(),
    cacheVersion: v.string(),
    model: v.optional(v.string()),
    status: v.union(v.literal("ready"), v.literal("fallback"), v.literal("error")),
    payload: v.any(),
    usage: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("natalInterpretations")
      .withIndex("by_chart_feature_version", (q: any) =>
        q.eq("natalChartId", args.natalChartId).eq("feature", NATAL_READING_FEATURE).eq("promptVersion", args.promptVersion)
      )
      .first();

    const fields = {
      userId: args.userId,
      natalChartId: args.natalChartId,
      feature: NATAL_READING_FEATURE,
      locale: args.locale,
      promptVersion: args.promptVersion,
      cacheVersion: args.cacheVersion,
      model: args.model,
      provider: "vercel-ai-gateway",
      status: args.status,
      payload: args.payload,
      usage: args.usage,
      updatedAt: now
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("natalInterpretations", { ...fields, createdAt: now });
  }
});

type NatalReadingGenerationState = {
  userId: string;
  chartId: string;
  chartPayload: unknown;
};

async function generateAndPersistNatalReading(
  ctx: any,
  state: NatalReadingGenerationState,
  source: "client" | "prewarm"
) {
  const startedAt = Date.now();
  const promptVersion = getAiGatewayNatalPromptVersion();
  const cacheVersion = getAiGatewayNatalCacheVersion();
  const claim = await ctx.runMutation(internalApi.charts.claimNatalReadingGeneration, {
    userId: state.userId,
    natalChartId: state.chartId,
    locale: "es-AR",
    promptVersion,
    cacheVersion
  });
  if (claim !== "claimed") {
    console.info(
      "[natal.prewarm]",
      JSON.stringify({ source, cacheHit: claim === "ready", result: claim, totalMs: Date.now() - startedAt })
    );
    return { status: claim };
  }

  const generationStartedAt = Date.now();
  const result = await generateNatalReadingWithGateway({ chartPayload: state.chartPayload });
  const generationMs = Date.now() - generationStartedAt;
  if (result.status !== "success" || !result.payload) {
    const persistStartedAt = Date.now();
    await ctx.runMutation(internalApi.charts.persistNatalReading, {
      userId: state.userId,
      natalChartId: state.chartId,
      locale: "es-AR",
      promptVersion,
      cacheVersion,
      model: result.model,
      status: "error",
      payload: null,
      usage: result.usage
    });
    console.error(
      "[natal.prewarm]",
      JSON.stringify({
        source,
        cacheHit: false,
        result: "error",
        generationMs,
        persistMs: Date.now() - persistStartedAt,
        totalMs: Date.now() - startedAt
      })
    );
    return requireSuccessfulNatalReading(result);
  }

  const persistStartedAt = Date.now();
  await ctx.runMutation(internalApi.charts.persistNatalReading, {
    userId: state.userId,
    natalChartId: state.chartId,
    locale: "es-AR",
    promptVersion,
    cacheVersion,
    model: result.model,
    status: "ready",
    payload: result.payload,
    usage: result.usage
  });
  console.info(
    "[natal.prewarm]",
    JSON.stringify({
      source,
      cacheHit: false,
      result: "generated",
      generationMs,
      persistMs: Date.now() - persistStartedAt,
      totalMs: Date.now() - startedAt
    })
  );
  return { status: "generated" };
}

export const generatePersonalityReadingForChart = internalAction({
  args: { natalChartId: v.id("natalCharts") },
  handler: async (ctx, args): Promise<any> => {
    const state: any = await ctx.runQuery(internalApi.charts.getNatalReadingStateByChart, args);
    if (!state?.chartId || !state.chartPayload) return { status: "missing_chart" };
    return await generateAndPersistNatalReading(ctx, state, "prewarm");
  }
});

/** Genera una vez la lectura rica desde la carta completa y la cachea. */
export const generatePersonalityReading = action({
  args: {},
  handler: async (ctx): Promise<any> => {
    const identity = await requireIdentity(ctx as any);
    const state: any = await ctx.runQuery(internalApi.charts.getNatalReadingState, {
      tokenIdentifier: identity.tokenIdentifier
    });
    if (!state.chartId || !state.chartPayload) return null;
    return await generateAndPersistNatalReading(ctx, state, "client");
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
      await ctx.scheduler.runAfter(0, internalApi.charts.generatePersonalityReadingForChart, {
        natalChartId: state.existingChart._id
      });
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

    const chart = await ctx.runMutation(internalApi.charts.persistCalculatedNatalChart, {
      tokenIdentifier: identity.tokenIdentifier,
      birthDataId: birthData._id,
      birthDataHash: state.birthDataHash,
      cacheKey: state.cacheKey,
      providerVersion: providerResult.providerVersion,
      calculationVersion: ASTROLOGY_API_CHART_CALCULATION_VERSION,
      payload: providerResult.normalized.chart
    });
    if (chart?._id) {
      await ctx.scheduler.runAfter(0, internalApi.charts.generatePersonalityReadingForChart, {
        natalChartId: chart._id
      });
    }
    return chart;
  }
});
