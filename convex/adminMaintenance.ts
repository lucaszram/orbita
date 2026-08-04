import {
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  CONTENT_EVENT_KIND,
  DEFAULT_ACTIVITY_TIMEZONE,
  localDateInTimezone,
  recordAuthoritativeContent,
  removeAuthoritativeContent,
  syncAdminAccountStats,
  voidRetentionCutoff
} from "./lib/adminAccountData";
import { recordBackendProductEvent } from "./lib/productAnalytics";

const internalApi = internal as any;
const BACKFILL_KEY = "admin_accounts_v1" as const;
const BATCH_SIZE = 25;
const PHASES = [
  "users",
  "natalCharts",
  "natalInterpretations",
  "dailyGuides",
  "transitReadings",
  "voidAnswers",
  "savedReadings",
  "journalEntries"
] as const;
type BackfillPhase = (typeof PHASES)[number];

async function backfillState(ctx: { db: any }) {
  return await ctx.db
    .query("adminBackfillState")
    .withIndex("by_key", (q: any) => q.eq("key", BACKFILL_KEY))
    .first();
}

async function timezoneForUser(ctx: { db: any }, userId: any) {
  const birthData = await ctx.db
    .query("birthData")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();
  return birthData?.timezone ?? DEFAULT_ACTIVITY_TIMEZONE;
}

async function timezoneForChart(ctx: { db: any }, natalChartId: any, userId: any) {
  const chart = await ctx.db.get(natalChartId);
  const birthData = chart?.birthDataId ? await ctx.db.get(chart.birthDataId) : null;
  return birthData?.timezone ?? await timezoneForUser(ctx, userId);
}

async function backfillRow(ctx: any, phase: BackfillPhase, row: any) {
  switch (phase) {
    case "users": {
      const birthData = await ctx.db
        .query("birthData")
        .withIndex("by_user", (q: any) => q.eq("userId", row._id))
        .order("asc")
        .first();
      await syncAdminAccountStats(ctx, row._id, {
        onboardingCompletedAt: birthData?.source === "onboarding" ? birthData.createdAt : undefined
      });
      await recordBackendProductEvent(ctx, {
        eventName: "account_created",
        userId: row._id,
        dedupeKey: String(row._id),
        occurredAt: row.createdAt,
        backfilled: true
      });
      if (birthData?.source === "onboarding") {
        await recordBackendProductEvent(ctx, {
          eventName: "onboarding_completed",
          userId: row._id,
          dedupeKey: String(birthData._id),
          occurredAt: birthData.createdAt,
          backfilled: true
        });
      }
      return;
    }
    case "natalCharts":
      await recordAuthoritativeContent(ctx, {
        eventName: "natal_chart_created",
        userId: row.userId,
        resourceId: String(row._id),
        occurredAt: row.createdAt,
        timezone: await timezoneForChart(ctx, row._id, row.userId),
        backfilled: true
      });
      return;
    case "natalInterpretations":
      if (row.status === "ready" || row.status === "fallback") {
        await recordAuthoritativeContent(ctx, {
          eventName: "natal_interpretation_created",
          userId: row.userId,
          resourceId: String(row._id),
          occurredAt: row.updatedAt ?? row.createdAt,
          timezone: await timezoneForChart(ctx, row.natalChartId, row.userId),
          backfilled: true
        });
      }
      return;
    case "dailyGuides": {
      const timezone = row.timezone ?? await timezoneForUser(ctx, row.userId);
      await recordAuthoritativeContent(ctx, {
        eventName: "daily_guide_created",
        userId: row.userId,
        resourceId: String(row._id),
        occurredAt: row.createdAt,
        localDate: row.localDate,
        timezone,
        backfilled: true
      });
      if (row.revealedAt) {
        await recordAuthoritativeContent(ctx, {
          eventName: "daily_card_revealed",
          userId: row.userId,
          resourceId: String(row._id),
          occurredAt: row.revealedAt,
          localDate: row.localDate,
          timezone,
          backfilled: true
        });
      }
      return;
    }
    case "transitReadings":
      await recordAuthoritativeContent(ctx, {
        eventName: "transit_reading_created",
        userId: row.userId,
        resourceId: String(row._id),
        occurredAt: row.createdAt,
        localDate: row.localDate,
        timezone: row.timezone,
        backfilled: true
      });
      return;
    case "voidAnswers":
      if (row.createdAt >= voidRetentionCutoff()) {
        await recordAuthoritativeContent(ctx, {
          eventName: "void_answer_created",
          userId: row.userId,
          resourceId: String(row._id),
          occurredAt: row.createdAt,
          localDate: row.localDate,
          timezone: await timezoneForUser(ctx, row.userId),
          backfilled: true
        });
      }
      return;
    case "savedReadings":
      await recordAuthoritativeContent(ctx, {
        eventName: "saved_reading_created",
        userId: row.userId,
        resourceId: String(row._id),
        occurredAt: row.createdAt,
        localDate: row.readingDate,
        timezone: await timezoneForUser(ctx, row.userId),
        backfilled: true
      });
      return;
    case "journalEntries":
      await recordAuthoritativeContent(ctx, {
        eventName: "journal_entry_created",
        userId: row.userId,
        resourceId: String(row._id),
        occurredAt: row.createdAt,
        timezone: await timezoneForUser(ctx, row.userId),
        backfilled: true
      });
  }
}

export const startBackfill = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const existing = await backfillState(ctx);
    const fields = {
      status: "running" as const,
      phase: PHASES[0],
      cursor: undefined,
      processed: 0,
      errorCode: undefined,
      startedAt: now,
      completedAt: undefined,
      updatedAt: now
    };
    if (existing) await ctx.db.patch(existing._id, fields);
    else await ctx.db.insert("adminBackfillState", { key: BACKFILL_KEY, ...fields });
    await ctx.scheduler.runAfter(0, internalApi.adminMaintenance.processBackfillBatch, {});
    return null;
  }
});

export const processBackfillBatch = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const state = await backfillState(ctx);
    if (!state || state.status !== "running") return null;
    const phase = state.phase as BackfillPhase;
    if (!PHASES.includes(phase)) throw new Error("ADMIN_BACKFILL_PHASE_INVALID");
    try {
      const result = await ctx.db
        .query(phase)
        .order("asc")
        .paginate({ cursor: state.cursor ?? null, numItems: BATCH_SIZE });
      for (const row of result.page) await backfillRow(ctx, phase, row);
      const processed = state.processed + result.page.length;
      if (!result.isDone) {
        await ctx.db.patch(state._id, {
          cursor: result.continueCursor,
          processed,
          updatedAt: Date.now()
        });
        await ctx.scheduler.runAfter(0, internalApi.adminMaintenance.processBackfillBatch, {});
        return null;
      }
      const next = PHASES[PHASES.indexOf(phase) + 1];
      if (next) {
        await ctx.db.patch(state._id, {
          phase: next,
          cursor: undefined,
          processed,
          updatedAt: Date.now()
        });
        await ctx.scheduler.runAfter(0, internalApi.adminMaintenance.processBackfillBatch, {});
      } else {
        await ctx.db.patch(state._id, {
          phase: "aggregates",
          cursor: undefined,
          processed,
          updatedAt: Date.now()
        });
        await ctx.scheduler.runAfter(0, internalApi.adminMaintenance.rebuildAdminAggregates, {});
      }
    } catch (error) {
      await ctx.db.patch(state._id, {
        status: "error",
        errorCode: error instanceof Error ? error.message.slice(0, 160) : "UNKNOWN",
        updatedAt: Date.now()
      });
      throw error;
    }
    return null;
  }
});

export const rebuildAdminAggregates = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const stats = await ctx.db.query("adminAccountStats").collect();
    const global = await ctx.db
      .query("adminGlobalStats")
      .withIndex("by_key", (q: any) => q.eq("key", "global"))
      .first();
    const globalFields = {
      totalAccounts: stats.length,
      proAccounts: stats.filter((row: any) => row.isPro).length,
      freeAccounts: stats.filter((row: any) => !row.isPro).length,
      updatedAt: now
    };
    if (global) await ctx.db.patch(global._id, globalFields);
    else await ctx.db.insert("adminGlobalStats", { key: "global", ...globalFields });

    for (const rollup of await ctx.db.query("adminDailyRollups").collect()) {
      await ctx.db.delete(rollup._id);
    }
    const rollups = new Map<string, {
      accountsCreated: number;
      activeUsers: number;
      contentCreated: number;
      voidAnswers: number;
      proGrants: number;
      proRevokes: number;
    }>();
    const getRollup = (date: string) => {
      const value = rollups.get(date) ?? {
        accountsCreated: 0,
        activeUsers: 0,
        contentCreated: 0,
        voidAnswers: 0,
        proGrants: 0,
        proRevokes: 0
      };
      rollups.set(date, value);
      return value;
    };
    for (const user of await ctx.db.query("users").collect()) {
      getRollup(localDateInTimezone(user.createdAt, DEFAULT_ACTIVITY_TIMEZONE)).accountsCreated += 1;
    }
    for (const day of await ctx.db.query("userActivityDays").collect()) {
      getRollup(day.localDate).activeUsers += 1;
    }
    for (const event of await ctx.db.query("productEvents").collect()) {
      if (!(event.eventName in CONTENT_EVENT_KIND)) continue;
      const rollup = getRollup(event.localDate);
      rollup.contentCreated += 1;
      if (event.eventName === "void_answer_created") rollup.voidAnswers += 1;
    }
    for (const audit of await ctx.db.query("adminAuditEvents").collect()) {
      const rollup = getRollup(localDateInTimezone(audit.createdAt, DEFAULT_ACTIVITY_TIMEZONE));
      if (audit.action === "pro_granted") rollup.proGrants += 1;
      else rollup.proRevokes += 1;
    }
    for (const [localDate, values] of rollups) {
      await ctx.db.insert("adminDailyRollups", { localDate, ...values, updatedAt: now });
    }
    const state = await backfillState(ctx);
    if (state) {
      await ctx.db.patch(state._id, {
        status: "complete",
        phase: "complete",
        cursor: undefined,
        completedAt: now,
        updatedAt: now
      });
    }
    return null;
  }
});

export const refreshExpiredGrant = internalMutation({
  args: {
    userId: v.id("users"),
    expectedExpiresAt: v.number()
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (Date.now() < args.expectedExpiresAt) {
      await ctx.scheduler.runAt(
        args.expectedExpiresAt,
        internalApi.adminMaintenance.refreshExpiredGrant,
        args
      );
      return null;
    }
    const row = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_provider", (q: any) =>
        q.eq("userId", args.userId).eq("provider", "admin")
      )
      .first();
    if (row?.currentPeriodEnd === args.expectedExpiresAt && !row.isLifetime) {
      await ctx.db.patch(row._id, {
        entitlement: "free",
        status: "expired",
        willRenew: false,
        updatedAt: Date.now()
      });
      await syncAdminAccountStats(ctx, args.userId);
    }
    return null;
  }
});

export const refreshStaleStreaks = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const today = localDateInTimezone(Date.now(), DEFAULT_ACTIVITY_TIMEZONE);
    const yesterday = new Date(`${today}T12:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const result = await ctx.db
      .query("adminAccountStats")
      .withIndex("by_current_streak", (q: any) => q.gt("currentStreak", 0))
      .paginate({ cursor: args.cursor ?? null, numItems: 100 });
    for (const stats of result.page) {
      if (!stats.lastActivityDate || stats.lastActivityDate < yesterday.toISOString().slice(0, 10)) {
        await ctx.db.patch(stats._id, { currentStreak: 0, updatedAt: Date.now() });
      }
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internalApi.adminMaintenance.refreshStaleStreaks, {
        cursor: result.continueCursor
      });
    }
    return null;
  }
});

export const cleanupExpiredVoid = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number(), hasMore: v.boolean() }),
  handler: async (ctx) => {
    const cutoff = voidRetentionCutoff();
    const expired = await ctx.db
      .query("voidAnswers")
      .withIndex("by_created_at", (q: any) => q.lt("createdAt", cutoff))
      .order("asc")
      .take(50);
    for (const answer of expired) {
      await removeAuthoritativeContent(ctx, {
        eventName: "void_answer_created",
        userId: answer.userId,
        resourceId: String(answer._id),
        localDate: answer.localDate
      });
      await ctx.db.delete(answer._id);
    }
    const hasMore = expired.length === 50;
    if (hasMore) {
      await ctx.scheduler.runAfter(0, internalApi.adminMaintenance.cleanupExpiredVoid, {});
    }
    return { deleted: expired.length, hasMore };
  }
});

export const getBackfillReport = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [
      users,
      stats,
      charts,
      interpretations,
      guides,
      transits,
      voidAnswers,
      savedReadings,
      journalEntries,
      events,
      activityDays,
      global,
      state
    ] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("adminAccountStats").collect(),
      ctx.db.query("natalCharts").collect(),
      ctx.db.query("natalInterpretations").collect(),
      ctx.db.query("dailyGuides").collect(),
      ctx.db.query("transitReadings").collect(),
      ctx.db.query("voidAnswers").collect(),
      ctx.db.query("savedReadings").collect(),
      ctx.db.query("journalEntries").collect(),
      ctx.db.query("productEvents").collect(),
      ctx.db.query("userActivityDays").collect(),
      ctx.db
        .query("adminGlobalStats")
        .withIndex("by_key", (q: any) => q.eq("key", "global"))
        .first(),
      backfillState(ctx)
    ]);
    const cutoff = voidRetentionCutoff();
    const expectedContent =
      charts.length +
      interpretations.filter((row: any) => row.status === "ready" || row.status === "fallback").length +
      guides.length +
      guides.filter((row: any) => Boolean(row.revealedAt)).length +
      transits.length +
      voidAnswers.filter((row: any) => row.createdAt >= cutoff).length +
      savedReadings.length +
      journalEntries.length;
    const authoritativeContent = events.filter((event: any) => event.eventName in CONTENT_EVENT_KIND);
    const activityContributions = activityDays.reduce(
      (total: number, day: any) =>
        total + day.activities.reduce(
          (sum: number, activity: any) => sum + activity.count,
          0
        ),
      0
    );
    return {
      backfillStatus: state?.status ?? "missing",
      backfillPhase: state?.phase ?? "missing",
      users: users.length,
      accountStats: stats.length,
      globalAccounts: global?.totalAccounts ?? 0,
      expectedContent,
      authoritativeContent: authoritativeContent.length,
      activityContributions,
      recentVoidSource: voidAnswers.filter((row: any) => row.createdAt >= cutoff).length,
      recentVoidEvents: authoritativeContent.filter(
        (event: any) => event.eventName === "void_answer_created"
      ).length,
      expiredVoidRemaining: voidAnswers.filter((row: any) => row.createdAt < cutoff).length
    };
  }
});
