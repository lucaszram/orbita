import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import {
  buildDailyReadingPayload,
  buildNatalChartSnapshot,
  CHART_CALCULATION_VERSION,
  DAILY_READING_CONTENT_VERSION
} from "./lib/orbita";
import { findUserByTokenIdentifier, omitUndefined, requireUser } from "./lib/users";

type DailyReadingDoc = {
  _id: string;
  localDate: string;
  timezone: string;
  natalChartId?: string;
  contentVersion: string;
  payload: any;
  createdAt: number;
};

const FALLBACK_MODEL_GAPS = ["astrologyapi_credentials_not_configured", "daily_transits_require_real_provider"];

function ensureThreeItems(items: unknown, fallback: string): string[] {
  const values = Array.isArray(items)
    ? items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return [values[0] ?? fallback, values[1] ?? fallback, values[2] ?? fallback];
}

async function getCurrentBirthData(ctx: any, userId: string) {
  return await ctx.db
    .query("birthData")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
}

async function getCurrentChart(ctx: any, userId: string) {
  return await ctx.db
    .query("natalCharts")
    .withIndex("by_user_version", (q: any) => q.eq("userId", userId).eq("calculationVersion", CHART_CALCULATION_VERSION))
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

function toDailyHomeReading(reading: DailyReadingDoc) {
  const payload = reading.payload ?? {};
  const home = payload.home ?? payload.modules ?? {};
  const chartProfile = payload.chartProfile ?? {};
  const highlightedTransit = payload.transits?.highlighted ?? payload.highlightedTransit ?? null;
  const personalization = payload.personalization ?? {
    status: "maqueta_no_personalizada_completa",
    mode: payload.mode ?? "demo_without_provider",
    source: "stub_fallback",
    explanation: "Esta salida es maqueta editorial hasta que haya proveedor y revision.",
    basedOn: [],
    missing: FALLBACK_MODEL_GAPS,
    confidence: "baja_maqueta"
  };
  const modelGaps = Array.from(
    new Set([
      ...(Array.isArray(payload.modelGaps) ? payload.modelGaps : []),
      ...(Array.isArray(personalization.missing) ? personalization.missing : [])
    ])
  );
  const safeModelGaps = modelGaps.length > 0 ? modelGaps : FALLBACK_MODEL_GAPS;

  return {
    readingId: reading._id,
    localDate: payload.localDate ?? reading.localDate,
    timezone: payload.timezone ?? reading.timezone,
    header: {
      localDate: payload.localDate ?? reading.localDate,
      timezone: payload.timezone ?? reading.timezone,
      greeting: "Tu guia diaria",
      headline: home.headline ?? "Tu cielo de hoy pide una lectura simple.",
      subheadline: home.energy ?? "Contexto diario para mirarte con mas claridad."
    },
    natalBase: {
      sun: payload.natalSummary?.sun ?? chartProfile.triad?.[0] ?? null,
      moon: payload.natalSummary?.moon ?? chartProfile.triad?.[1] ?? null,
      ascendant: payload.natalSummary?.ascendant ?? chartProfile.triad?.[2] ?? null,
      accuracy: payload.natalSummary?.accuracy ?? chartProfile.accuracy ?? "pending",
      limitations: chartProfile.limitations ?? []
    },
    highlightedTransit,
    modules: {
      do: ensureThreeItems(home.doList, home.do ?? "Elegir una accion chica y concreta."),
      avoid: ensureThreeItems(home.avoidList, home.avoid ?? "Leer el dia como prediccion cerrada."),
      energy: home.energy ?? "Contexto diario en modo maqueta.",
      action: home.action ?? "Anota una pregunta simple antes de responder en automatico.",
      question: home.question ?? "Que dato simple estas pasando por alto?"
    },
    topics: Array.isArray(payload.topics) ? payload.topics : [],
    longRead: payload.longRead
      ? {
          title: payload.longRead.dailyTitle ?? payload.longRead.title,
          body: payload.longRead.body,
          sections: payload.longRead.sections,
          lockedForPlus: payload.longRead.access === "plus"
        }
      : null,
    void: payload.voidPreview ?? null,
    personalization,
    modelGaps: safeModelGaps,
    reviewStatus: payload.reviewStatus ?? "needs_review",
    contentVersion: payload.contentVersion ?? reading.contentVersion,
    calculationVersion: payload.calculationVersion ?? CHART_CALCULATION_VERSION,
    mode: payload.mode ?? "demo_without_provider",
    createdAt: reading.createdAt
  };
}

export const getDaily = query({
  args: {
    localDate: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const user = identity ? await findUserByTokenIdentifier(ctx, identity.tokenIdentifier) : null;
    if (!user) {
      return null;
    }

    const reading = await ctx.db
      .query("dailyReadings")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();

    return reading ? toDailyHomeReading(reading) : null;
  }
});

export const generateDaily = mutation({
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
      return toDailyHomeReading(existing);
    }

    const chart = await ensureChart(ctx, user._id);
    const payload = {
      ...buildDailyReadingPayload({
        localDate: args.localDate,
        timezone: args.timezone,
        chart: chart?.payload ?? null
      }),
      modelGaps: chart ? FALLBACK_MODEL_GAPS : ["birth_data_or_chart_missing", ...FALLBACK_MODEL_GAPS],
      reviewStatus: "needs_review"
    };

    const readingId = await ctx.db.insert(
      "dailyReadings",
      omitUndefined({
        userId: user._id,
        localDate: args.localDate,
        timezone: args.timezone,
        natalChartId: chart?._id,
        contentVersion: DAILY_READING_CONTENT_VERSION,
        payload,
        createdAt: Date.now()
      })
    );

    const reading = await ctx.db.get(readingId);
    return toDailyHomeReading(reading);
  }
});
