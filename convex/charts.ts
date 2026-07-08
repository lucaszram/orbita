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
    if (!chart) return null;

    // Preferir la interpretación LLM cacheada de esta carta; si no, la plantilla.
    const interpretations = await ctx.db
      .query("natalInterpretations")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .collect();
    const cached = interpretations.find(
      (r: any) => r.feature === "personality" && r.natalChartId === chart._id && r.status === "ready" && r.payload
    );
    if (cached) return cached.payload;

    return buildWebB0PersonalityReadingPayload(chart.payload);
  }
});

// --- Interpretación natal (personalidad) con LLM ---------------------------

const AI_GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const PERSONALITY_PROMPT_VERSION = "orbita-natal-personality-v1";
const PERSONALITY_SYSTEM =
  "Sos la lectura de carta natal de Órbita: interpretación de entretenimiento y autoconocimiento. " +
  "Español rioplatense, voseo, tildes y signos de apertura. Explicás cada punto de la carta claro, " +
  "sin jerga vacía ni promesas de destino.";

function readStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function buildPersonalityPrompt(sections: any[]): string {
  const lines = sections
    .map(
      (s) =>
        `- ${s.key}: ${s.placement.planet} en ${s.placement.sign ?? "?"}${s.placement.house ? ` (casa ${s.placement.house})` : ""}`
    )
    .join("\n");
  return `Interpretá esta carta natal, punto por punto:
${lines}

Para CADA punto escribí una lectura analítica y clara (2 a 3 frases): qué significa ese planeta en ese signo y casa para la persona. Nombrá el signo/casa, en criollo, sin frases genéricas.

Reglas duras: entretenimiento y autoconocimiento; NO destino/salud/dinero/legal; voseo ("vos", "tenés"); tildes y signos de apertura; sin inglés.

Devolvé SOLO JSON válido: un objeto con una entrada por cada key de arriba, con esta forma:
{ "sun": { "body": "…", "questions": ["¿…?"] }, "moon": { "body": "…", "questions": ["¿…?"] }, … }`;
}

async function personalityGateway(prompt: string): Promise<Record<string, { body: string; questions: string[] }> | null> {
  const enabled = process.env.ORBITA_LLM_ENABLED === "true";
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  const model = process.env.ORBITA_LLM_MODEL?.trim();
  if (!enabled || !apiKey || !model) return null;

  try {
    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Vercel-AI-App-Name": "Orbita Natal" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: PERSONALITY_SYSTEM },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1400,
        stream: false,
        providerOptions: { gateway: { user: "app", tags: ["feature:orbita-natal", "env:dev", "user:app"] } }
      })
    });
    const raw = await response.text();
    if (!response.ok) return null;
    const json = JSON.parse(raw) as any;
    const content = readStr(json?.choices?.[0]?.message?.content);
    const parsed = JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export const getPersonalityState = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");
    const chart = await getCurrentChart(ctx, user._id);
    const interpretations = chart
      ? await ctx.db
          .query("natalInterpretations")
          .withIndex("by_user", (q: any) => q.eq("userId", user._id))
          .order("desc")
          .collect()
      : [];
    const cached = interpretations.find(
      (r: any) => r.feature === "personality" && r.natalChartId === chart?._id && r.status === "ready"
    );
    return { userId: user._id, chart, cached };
  }
});

export const persistPersonalityReading = internalMutation({
  args: { tokenIdentifier: v.string(), natalChartId: v.id("natalCharts"), payload: v.any(), model: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");
    const now = Date.now();
    await ctx.db.insert("natalInterpretations", {
      userId: user._id,
      natalChartId: args.natalChartId,
      feature: "personality",
      locale: "es-AR",
      promptVersion: PERSONALITY_PROMPT_VERSION,
      cacheVersion: PERSONALITY_PROMPT_VERSION,
      model: args.model,
      provider: "ai-gateway",
      status: "ready",
      payload: args.payload,
      createdAt: now,
      updatedAt: now
    });
    return args.payload;
  }
});

/** Genera (una vez) la interpretación LLM de la carta y la cachea. No-op si ya existe
 *  o no hay carta. La query `personalityReading` la sirve cuando está lista. */
export const generatePersonalityReading = action({
  args: {},
  handler: async (ctx): Promise<{ status: string }> => {
    const identity = await requireIdentity(ctx as any);
    const state: any = await ctx.runQuery(internalApi.charts.getPersonalityState, {
      tokenIdentifier: identity.tokenIdentifier
    });
    if (!state.chart) return { status: "no_chart" };
    if (state.cached) return { status: "cached" };

    const template: any = buildWebB0PersonalityReadingPayload(state.chart.payload);
    const generated = await personalityGateway(buildPersonalityPrompt(template.sections));
    if (!generated) return { status: "llm_unavailable" };

    const payload = {
      ...template,
      sections: template.sections.map((s: any) => {
        const g = generated[s.key];
        return g && readStr(g.body)
          ? { ...s, body: readStr(g.body), questions: Array.isArray(g.questions) ? g.questions.map(readStr).filter(Boolean) : s.questions }
          : s;
      })
    };

    await ctx.runMutation(internalApi.charts.persistPersonalityReading, {
      tokenIdentifier: identity.tokenIdentifier,
      natalChartId: state.chart._id,
      payload,
      model: process.env.ORBITA_LLM_MODEL
    });
    return { status: "generated" };
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
