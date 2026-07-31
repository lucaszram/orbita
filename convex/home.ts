import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import {
  buildDailyReadingPayload,
  CHART_CALCULATION_VERSION,
  DAILY_READING_CONTENT_VERSION
} from "./lib/orbita";
import {
  belongsToNatalChart,
  dailyReadingNeedsRefresh,
  findCurrentBirthData,
  findExactNatalChart
} from "./lib/birthDataConsistency";
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

function toDailyHomeReading(reading: DailyReadingDoc) {
  const payload = reading.payload ?? {};
  const home = payload.home ?? payload.modules ?? {};
  const chartProfile = payload.chartProfile ?? {};
  const highlightedTransit = payload.transits?.highlighted ?? payload.highlightedTransit ?? null;
  const personalization = payload.personalization ?? {
    status: "maqueta_no_personalizada_completa",
    mode: payload.mode ?? "demo_without_provider",
    source: "stub_fallback",
    explanation: "Esta salida es maqueta editorial hasta que haya proveedor y revisión.",
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
      greeting: "Tu guía diaria",
      headline: home.headline ?? "Tu cielo de hoy pide una lectura simple.",
      subheadline: home.subheadline ?? "Contexto diario para mirarte con más claridad."
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
      do: ensureThreeItems(home.doList, home.do ?? "Elegí una acción chica y concreta."),
      avoid: ensureThreeItems(home.avoidList, home.avoid ?? "Leer el día como predicción cerrada."),
      energy: home.energy ?? "Contexto diario en modo maqueta.",
      action: home.action ?? "Anotá una pregunta simple antes de responder en automático.",
      question: home.question ?? "¿Qué dato simple estás pasando por alto?"
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
    const birthData = await findCurrentBirthData(ctx, user._id);
    const natalChart = await findExactNatalChart(ctx, user._id, birthData);

    return belongsToNatalChart(reading, natalChart) ? toDailyHomeReading(reading) : null;
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

    const birthData = await findCurrentBirthData(ctx, user._id);
    const chart = await findExactNatalChart(ctx, user._id, birthData);
    if (
      existing &&
      !dailyReadingNeedsRefresh(existing, chart?._id, args.timezone, DAILY_READING_CONTENT_VERSION)
    ) {
      return toDailyHomeReading(existing);
    }

    const payload = {
      ...buildDailyReadingPayload({
        localDate: args.localDate,
        timezone: args.timezone,
        chart: chart?.payload ?? null
      }),
      modelGaps: chart ? FALLBACK_MODEL_GAPS : ["birth_data_or_chart_missing", ...FALLBACK_MODEL_GAPS],
      reviewStatus: "needs_review"
    };

    const fields = omitUndefined({
      userId: user._id,
      localDate: args.localDate,
      timezone: args.timezone,
      natalChartId: chart?._id,
      contentVersion: DAILY_READING_CONTENT_VERSION,
      payload,
      updatedAt: Date.now()
    });
    const readingId = existing?._id ?? (await ctx.db.insert("dailyReadings", { ...fields, createdAt: Date.now() }));
    if (existing) await ctx.db.patch(existing._id, fields);

    const reading = await ctx.db.get(readingId);
    return toDailyHomeReading(reading);
  }
});
