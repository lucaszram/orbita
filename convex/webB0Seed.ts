import { mutationGeneric as mutation } from "convex/server";
import { v } from "convex/values";
import { requireBackofficeUser } from "./lib/backoffice";
import {
  ASTROLOGY_API_CHART_CALCULATION_VERSION,
  CHART_CALCULATION_VERSION,
  DAILY_READING_CONTENT_VERSION,
  normalizeBirthTime
} from "./lib/orbita";
import { omitUndefined } from "./lib/users";

const birthTimePrecisionValidator = v.union(v.literal("known"), v.literal("approximate"), v.literal("unknown"));

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function sanitizeAppFacingPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeAppFacingPayload);
  }

  const record = asRecord(value);
  if (!record) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => key !== "raw" && key !== "request")
      .map(([key, entry]) => [key, sanitizeAppFacingPayload(entry)])
  );
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function inferChartCalculationVersion(chartPayload: unknown) {
  const chart = asRecord(chartPayload);
  const normalized = asRecord(chart?.normalized);
  return (
    readString(normalized?.calculationVersion) ??
    readString(chart?.calculationVersion) ??
    readString(chart?.version) ??
    ASTROLOGY_API_CHART_CALCULATION_VERSION
  );
}

function inferDailyContentVersion(dailyReadingPayload: unknown) {
  const daily = asRecord(dailyReadingPayload);
  return readString(daily?.contentVersion) ?? readString(daily?.version) ?? DAILY_READING_CONTENT_VERSION;
}

function inferGenerationStatus(dailyReadingPayload: unknown) {
  const daily = asRecord(dailyReadingPayload);
  const mode = readString(daily?.mode);
  if (mode === "provider_real" || mode === "provider_without_daily_transit") {
    return "ready" as const;
  }
  if (mode === "demo_without_provider") {
    return "fallback" as const;
  }
  return undefined;
}

function inferProvider(chartPayload: unknown) {
  const chart = asRecord(chartPayload);
  const provider = asRecord(chart?.provider);
  const status = readString(provider?.status);
  if (chart?.source === "astrologyapi" || status === "success") {
    return "astrologyapi";
  }
  if (chart?.source === "stub") {
    return "stub";
  }
  return undefined;
}

function inferProviderVersion(chartPayload: unknown) {
  const chart = asRecord(chartPayload);
  const provider = asRecord(chart?.provider);
  return readString(provider?.providerVersion) ?? inferProvider(chartPayload);
}

async function upsertSubscription(ctx: any, userId: string) {
  const now = Date.now();
  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  const payload = {
    userId,
    entitlement: "plus" as const,
    status: "active" as const,
    provider: "stub",
    productId: "orbita_plus_web_b0_qa",
    updatedAt: now
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return existing._id;
  }

  return await ctx.db.insert("subscriptions", payload);
}

export const persistCurrentUserSnapshot = mutation({
  args: {
    localDate: v.string(),
    timezone: v.string(),
    birthData: v.object({
      birthDate: v.string(),
      birthTime: v.optional(v.string()),
      birthTimePrecision: birthTimePrecisionValidator,
      birthPlaceLabel: v.string(),
      placeId: v.optional(v.string()),
      placeProvider: v.optional(v.string()),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      timezone: v.string()
    }),
    chartPayload: v.any(),
    dailyReadingPayload: v.any(),
    markPlus: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const user = await requireBackofficeUser(ctx);
    const now = Date.now();
    const normalizedBirthTime = normalizeBirthTime(args.birthData.birthTime);
    const existingBirthData = await ctx.db
      .query("birthData")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
    const birthDataPayload = omitUndefined({
      userId: user._id,
      birthDate: args.birthData.birthDate.trim(),
      birthTime: normalizedBirthTime,
      birthTimePrecision: args.birthData.birthTimePrecision,
      birthPlaceLabel: args.birthData.birthPlaceLabel.trim(),
      placeId: args.birthData.placeId?.trim() || undefined,
      placeProvider: args.birthData.placeProvider?.trim() || undefined,
      latitude: args.birthData.latitude,
      longitude: args.birthData.longitude,
      timezone: args.birthData.timezone.trim() || args.timezone.trim(),
      source: "import" as const,
      updatedAt: now
    });
    const birthDataId = existingBirthData
      ? (await ctx.db.patch(existingBirthData._id, birthDataPayload), existingBirthData._id)
      : await ctx.db.insert("birthData", { ...birthDataPayload, createdAt: now });

    const sanitizedChartPayload = sanitizeAppFacingPayload(args.chartPayload);
    const calculationVersion = inferChartCalculationVersion(sanitizedChartPayload);
    const existingChart = await ctx.db
      .query("natalCharts")
      .withIndex("by_user_version", (q: any) => q.eq("userId", user._id).eq("calculationVersion", calculationVersion))
      .first();
    const chartPayload = omitUndefined({
      userId: user._id,
      birthDataId,
      calculationVersion,
      providerVersion: inferProviderVersion(sanitizedChartPayload),
      payload: sanitizedChartPayload,
      updatedAt: now
    });
    const natalChartId = existingChart
      ? (await ctx.db.patch(existingChart._id, chartPayload), existingChart._id)
      : await ctx.db.insert("natalCharts", { ...chartPayload, createdAt: now });

    const sanitizedDailyPayload = sanitizeAppFacingPayload(args.dailyReadingPayload);
    const contentVersion = inferDailyContentVersion(sanitizedDailyPayload);
    const localDate = args.localDate.trim();
    const timezone = args.timezone.trim() || args.birthData.timezone.trim();
    const existingDaily = await ctx.db
      .query("dailyReadings")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", localDate))
      .first();
    const dailyPayload = omitUndefined({
      userId: user._id,
      localDate,
      timezone,
      natalChartId,
      contentVersion,
      provider: inferProvider(sanitizedChartPayload),
      status: inferGenerationStatus(sanitizedDailyPayload),
      payload: sanitizedDailyPayload,
      updatedAt: now
    });
    const dailyReadingId = existingDaily
      ? (await ctx.db.patch(existingDaily._id, dailyPayload), existingDaily._id)
      : await ctx.db.insert("dailyReadings", { ...dailyPayload, createdAt: now });

    const existingTransit = await ctx.db
      .query("transitReadings")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", localDate))
      .first();
    const transitPayload = omitUndefined({
      userId: user._id,
      localDate,
      timezone,
      natalChartId,
      providerVersion: inferProviderVersion(sanitizedChartPayload),
      payload: sanitizedDailyPayload,
      updatedAt: now
    });
    const transitReadingId = existingTransit
      ? (await ctx.db.patch(existingTransit._id, transitPayload), existingTransit._id)
      : await ctx.db.insert("transitReadings", { ...transitPayload, createdAt: now });

    const subscriptionId = args.markPlus ? await upsertSubscription(ctx, user._id) : null;

    return {
      userId: user._id,
      birthDataId,
      natalChartId,
      dailyReadingId,
      transitReadingId,
      subscriptionId,
      localDate,
      chartCalculationVersion: calculationVersion,
      dailyContentVersion: contentVersion,
      sanitized: true,
      fallbackChart: calculationVersion === CHART_CALCULATION_VERSION
    };
  }
});
