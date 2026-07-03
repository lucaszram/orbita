import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { buildNatalChartSnapshot, CHART_CALCULATION_VERSION } from "./lib/orbita";
import { requireExistingUser, requireUser } from "./lib/users";

async function getCurrentBirthData(ctx: any, userId: string) {
  return await ctx.db
    .query("birthData")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
}

export const current = query({
  handler: async (ctx) => {
    const user = await requireExistingUser(ctx);
    return await ctx.db
      .query("natalCharts")
      .withIndex("by_user_version", (q: any) => q.eq("userId", user._id).eq("calculationVersion", CHART_CALCULATION_VERSION))
      .first();
  }
});

export const calculateOrCreateNatalChart = mutation({
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const birthData = await getCurrentBirthData(ctx, user._id);

    if (!birthData) {
      throw new Error("Birth data is required before calculating a natal chart");
    }

    const existing = await ctx.db
      .query("natalCharts")
      .withIndex("by_user_version", (q: any) => q.eq("userId", user._id).eq("calculationVersion", CHART_CALCULATION_VERSION))
      .first();

    if (existing && existing.birthDataId === birthData._id) {
      return existing;
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
      userId: user._id,
      birthDataId: birthData._id,
      calculationVersion: CHART_CALCULATION_VERSION,
      payload,
      createdAt: Date.now()
    });

    return await ctx.db.get(chartId);
  }
});
