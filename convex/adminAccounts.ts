import {
  mutationGeneric as mutation,
  paginationOptsValidator,
  queryGeneric as query
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireBackofficeIdentity, requireBackofficeUser } from "./lib/backoffice";
import {
  DEFAULT_ACTIVITY_TIMEZONE,
  adminProWritesEnabled,
  assertAdminAccountsEnabled,
  assertAdminProWritesEnabled,
  incrementDailyRollup,
  localDateInTimezone,
  normalizeAdminReason,
  resolveUserAccess,
  shiftLocalDate,
  syncAdminAccountStats,
  validateGrantWindow,
  voidRetentionCutoff
} from "./lib/adminAccountData";
import { isRowActive, type SubscriptionRow } from "./lib/entitlements";
import { omitUndefined } from "./lib/users";

const internalApi = internal as any;

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}

const rangeValidator = v.union(v.literal("7d"), v.literal("30d"), v.literal("90d"));
const segmentValidator = v.union(v.literal("all"), v.literal("pro"), v.literal("free"));
const sortValidator = v.union(
  v.literal("newest"),
  v.literal("last_activity"),
  v.literal("streak")
);
const statusValidator = v.union(
  v.literal("inactive"),
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("billing_issue"),
  v.literal("canceled"),
  v.literal("expired")
);
const providerValidator = v.union(
  v.literal("revenuecat"),
  v.literal("stripe"),
  v.literal("stub"),
  v.literal("admin")
);
const planValidator = v.union(
  v.literal("monthly"),
  v.literal("weekly"),
  v.literal("yearly"),
  v.literal("lifetime")
);
const productEventValidator = v.union(
  v.literal("app_opened"),
  v.literal("onboarding_started"),
  v.literal("onboarding_step_viewed"),
  v.literal("account_created"),
  v.literal("onboarding_completed"),
  v.literal("natal_chart_viewed"),
  v.literal("daily_guide_viewed"),
  v.literal("daily_card_revealed"),
  v.literal("paywall_viewed"),
  v.literal("checkout_started"),
  v.literal("checkout_completed"),
  v.literal("checkout_failed"),
  v.literal("natal_chart_created"),
  v.literal("natal_interpretation_created"),
  v.literal("daily_guide_created"),
  v.literal("transit_reading_created"),
  v.literal("void_answer_created"),
  v.literal("saved_reading_created"),
  v.literal("journal_entry_created")
);

const accountValidator = v.object({
  userId: v.id("users"),
  clerkUserId: v.string(),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  createdAt: v.number(),
  onboardingCompletedAt: v.optional(v.number()),
  isPro: v.boolean(),
  status: statusValidator,
  provider: v.optional(providerValidator),
  plan: v.optional(planValidator),
  currentPeriodEnd: v.optional(v.number()),
  isLifetime: v.boolean(),
  lastActivityAt: v.optional(v.number()),
  lastActivityDate: v.optional(v.string()),
  currentStreak: v.number(),
  longestStreak: v.number(),
  activeDayCount: v.number(),
  contentCreatedCount: v.number()
});

const pageValidator = v.object({
  page: v.array(accountValidator),
  isDone: v.boolean(),
  continueCursor: v.string()
});

const effectiveAccessValidator = v.object({
  entitlement: v.union(v.literal("free"), v.literal("orbita_pro")),
  isPro: v.boolean(),
  status: statusValidator,
  provider: v.optional(providerValidator),
  plan: v.optional(planValidator),
  isLifetime: v.boolean(),
  currentPeriodEnd: v.optional(v.number()),
  willRenew: v.optional(v.boolean()),
  canManageInStripePortal: v.boolean()
});

function rangeDays(range: "7d" | "30d" | "90d") {
  return range === "7d" ? 7 : range === "30d" ? 30 : 90;
}

function displayedCurrentStreak(stats: any, now = Date.now()) {
  if (!stats.lastActivityDate) return 0;
  const today = localDateInTimezone(now, DEFAULT_ACTIVITY_TIMEZONE);
  return stats.lastActivityDate >= shiftLocalDate(today, -1) ? stats.currentStreak : 0;
}

async function accountFromStats(ctx: { db: any }, stats: any, now = Date.now()): Promise<any> {
  const user = await ctx.db.get(stats.userId);
  if (!user) return null;
  return compact({
    userId: user._id,
    clerkUserId: user.clerkUserId,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    onboardingCompletedAt: stats.onboardingCompletedAt,
    isPro: stats.isPro,
    status: stats.subscriptionStatus,
    provider: stats.subscriptionProvider,
    plan: stats.subscriptionPlan,
    currentPeriodEnd: stats.currentPeriodEnd,
    isLifetime: stats.isLifetime,
    lastActivityAt: stats.lastActivityAt,
    lastActivityDate: stats.lastActivityDate,
    currentStreak: displayedCurrentStreak(stats, now),
    longestStreak: stats.longestStreak,
    activeDayCount: stats.activeDayCount,
    contentCreatedCount: stats.contentCreatedCount
  });
}

async function accountsFromStats(ctx: { db: any }, rows: any[], now = Date.now()) {
  return (await Promise.all(rows.map((row) => accountFromStats(ctx, row, now))))
    .filter((account): account is NonNullable<typeof account> => account !== null);
}

function accessFields(access: Awaited<ReturnType<typeof resolveUserAccess>>) {
  return compact({
    entitlement: access.entitlement,
    isPro: access.isPro,
    status: access.status,
    provider: access.provider,
    plan: access.plan,
    isLifetime: access.isLifetime,
    currentPeriodEnd: access.currentPeriodEnd,
    willRenew: access.willRenew,
    canManageInStripePortal: access.canManageInStripePortal
  });
}

export const getDashboard = query({
  args: { range: rangeValidator },
  returns: v.object({
    range: rangeValidator,
    totalAccounts: v.number(),
    newAccounts: v.number(),
    proAccounts: v.number(),
    freeAccounts: v.number(),
    activeToday: v.number(),
    activeStreaks: v.number(),
    contentCreated: v.number(),
    voidAnswers: v.number(),
    backfillStatus: v.union(
      v.literal("not_started"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("error")
    ),
    canManagePro: v.boolean()
  }),
  handler: async (ctx, args) => {
    await requireBackofficeIdentity(ctx);
    assertAdminAccountsEnabled();
    const now = Date.now();
    const today = localDateInTimezone(now, DEFAULT_ACTIVITY_TIMEZONE);
    const from = shiftLocalDate(today, -(rangeDays(args.range) - 1));
    const rollups = await ctx.db
      .query("adminDailyRollups")
      .withIndex("by_date", (q: any) => q.gte("localDate", from).lte("localDate", today))
      .collect();
    const todayRollup = rollups.find((rollup: any) => rollup.localDate === today);
    const global = await ctx.db
      .query("adminGlobalStats")
      .withIndex("by_key", (q: any) => q.eq("key", "global"))
      .first();
    const streakStats = await ctx.db
      .query("adminAccountStats")
      .withIndex("by_current_streak", (q: any) => q.gt("currentStreak", 0))
      .collect();
    const statsWithoutGlobal = global ? [] : await ctx.db.query("adminAccountStats").collect();
    const backfill = await ctx.db
      .query("adminBackfillState")
      .withIndex("by_key", (q: any) => q.eq("key", "admin_accounts_v1"))
      .first();
    const backfillStatus = !backfill || backfill.status === "idle"
      ? "not_started"
      : backfill.status;
    return {
      range: args.range,
      totalAccounts: global?.totalAccounts ?? statsWithoutGlobal.length,
      newAccounts: rollups.reduce((sum: number, row: any) => sum + row.accountsCreated, 0),
      proAccounts: global?.proAccounts ?? statsWithoutGlobal.filter((row: any) => row.isPro).length,
      freeAccounts: global?.freeAccounts ?? statsWithoutGlobal.filter((row: any) => !row.isPro).length,
      activeToday: todayRollup?.activeUsers ?? 0,
      activeStreaks: streakStats.filter((row: any) => displayedCurrentStreak(row, now) > 0).length,
      contentCreated: rollups.reduce((sum: number, row: any) => sum + row.contentCreated, 0),
      voidAnswers: rollups.reduce((sum: number, row: any) => sum + row.voidAnswers, 0),
      backfillStatus,
      canManagePro: adminProWritesEnabled()
    };
  }
});

export const listAccounts = query({
  args: {
    paginationOpts: paginationOptsValidator,
    segment: segmentValidator,
    sort: sortValidator
  },
  returns: pageValidator,
  handler: async (ctx, args) => {
    await requireBackofficeIdentity(ctx);
    assertAdminAccountsEnabled();
    const isPro = args.segment === "all" ? undefined : args.segment === "pro";
    const index = args.sort === "newest"
      ? isPro === undefined ? "by_created_at" : "by_pro_created_at"
      : args.sort === "last_activity"
        ? isPro === undefined ? "by_last_activity" : "by_pro_last_activity"
        : isPro === undefined ? "by_current_streak" : "by_pro_current_streak";
    const base = ctx.db.query("adminAccountStats");
    const indexed = isPro === undefined
      ? base.withIndex(index)
      : base.withIndex(index, (q: any) => q.eq("isPro", isPro));
    const result = await indexed.order("desc").paginate(args.paginationOpts);
    return {
      page: await accountsFromStats(ctx, result.page),
      isDone: result.isDone,
      continueCursor: result.continueCursor
    };
  }
});

export const searchAccounts = query({
  args: {
    query: v.string(),
    segment: segmentValidator,
    limit: v.number()
  },
  returns: v.array(accountValidator),
  handler: async (ctx, args) => {
    await requireBackofficeIdentity(ctx);
    assertAdminAccountsEnabled();
    const search = args.query.trim().toLocaleLowerCase("es-AR");
    if (!search) return [];
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit)));
    const isPro = args.segment === "all" ? undefined : args.segment === "pro";
    const exactStats: any[] = [];
    const normalizedId = ctx.db.normalizeId("users", args.query.trim());
    const exactUser = normalizedId
      ? await ctx.db.get(normalizedId)
      : await ctx.db
          .query("users")
          .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", args.query.trim()))
          .first();
    if (exactUser) {
      const stats = await ctx.db
        .query("adminAccountStats")
        .withIndex("by_user", (q: any) => q.eq("userId", exactUser._id))
        .first();
      if (stats && (isPro === undefined || stats.isPro === isPro)) exactStats.push(stats);
    }
    const searchQuery = ctx.db
      .query("adminAccountStats")
      .withSearchIndex("search_accounts", (q: any) => {
        const searched = q.search("searchText", search);
        return isPro === undefined ? searched : searched.eq("isPro", isPro);
      });
    const searched = await searchQuery.take(limit);
    const seen = new Set(exactStats.map((row) => String(row.userId)));
    const rows = [...exactStats, ...searched.filter((row: any) => !seen.has(String(row.userId)))];
    return await accountsFromStats(ctx, rows.slice(0, limit));
  }
});

export const getAccount = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      account: accountValidator,
      effectiveAccess: effectiveAccessValidator,
      manualGrant: v.optional(
        v.object({
          mode: v.union(v.literal("permanent"), v.literal("until")),
          expiresAt: v.optional(v.number()),
          updatedAt: v.number()
        })
      ),
      recentVoid: v.array(
        v.object({
          voidAnswerId: v.id("voidAnswers"),
          question: v.string(),
          localDate: v.string(),
          createdAt: v.number()
        })
      )
    })
  ),
  handler: async (ctx, args) => {
    await requireBackofficeIdentity(ctx);
    assertAdminAccountsEnabled();
    const stats = await ctx.db
      .query("adminAccountStats")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .first();
    if (!stats) return null;
    const now = Date.now();
    const access = await resolveUserAccess(ctx, args.userId, now);
    const account = await accountFromStats(ctx, {
      ...stats,
      isPro: access.isPro,
      subscriptionStatus: access.status,
      subscriptionProvider: access.provider,
      subscriptionPlan: access.plan,
      currentPeriodEnd: access.currentPeriodEnd,
      isLifetime: access.isLifetime
    }, now);
    if (!account) return null;
    const adminRow = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_provider", (q: any) =>
        q.eq("userId", args.userId).eq("provider", "admin")
      )
      .first();
    const recentVoidRows = await ctx.db
      .query("voidAnswers")
      .withIndex("by_user_date", (q: any) => q.eq("userId", args.userId))
      .order("desc")
      .take(200);
    const cutoff = voidRetentionCutoff(now);
    return compact({
      account,
      effectiveAccess: accessFields(access),
      manualGrant: adminRow && isRowActive(adminRow as SubscriptionRow, now)
        ? compact({
            mode: adminRow.isLifetime ? "permanent" as const : "until" as const,
            expiresAt: adminRow.currentPeriodEnd,
            updatedAt: adminRow.updatedAt
          })
        : undefined,
      recentVoid: recentVoidRows
        .filter((row: any) => row.createdAt >= cutoff)
        .map((row: any) => ({
          voidAnswerId: row._id,
          question: row.question,
          localDate: row.localDate,
          createdAt: row.createdAt
        }))
    });
  }
});

export const listActivity = query({
  args: { userId: v.id("users"), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        eventId: v.string(),
        eventName: productEventValidator,
        occurredAt: v.number(),
        localDate: v.string(),
        entryPoint: v.optional(v.string()),
        question: v.optional(v.string()),
        backfilled: v.boolean()
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string()
  }),
  handler: async (ctx, args) => {
    await requireBackofficeIdentity(ctx);
    assertAdminAccountsEnabled();
    const result = await ctx.db
      .query("productEvents")
      .withIndex("by_user_source_date", (q: any) =>
        q.eq("userId", args.userId).eq("source", "backend")
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const cutoff = voidRetentionCutoff();
    const page = await Promise.all(result.page.map(async (event: any) => {
      let question: string | undefined;
      if (
        event.eventName === "void_answer_created" &&
        event.occurredAt >= cutoff &&
        event.resourceId
      ) {
        const id = ctx.db.normalizeId("voidAnswers", event.resourceId);
        const answer = id ? await ctx.db.get(id) : null;
        question = answer?.question;
      }
      return compact({
        eventId: event.eventId,
        eventName: event.eventName,
        occurredAt: event.occurredAt,
        localDate: event.localDate,
        entryPoint: event.entryPoint,
        question,
        backfilled: event.backfilled ?? false
      });
    }));
    return {
      page,
      isDone: result.isDone,
      continueCursor: result.continueCursor
    };
  }
});

export const grantPro = mutation({
  args: {
    userId: v.id("users"),
    mode: v.union(v.literal("permanent"), v.literal("until")),
    expiresAt: v.optional(v.number()),
    reason: v.string()
  },
  returns: v.object({
    manualGrantApplied: v.literal(true),
    effectiveAccess: effectiveAccessValidator,
    auditEventId: v.id("adminAuditEvents")
  }),
  handler: async (ctx, args) => {
    const actor = await requireBackofficeUser(ctx);
    assertAdminAccountsEnabled();
    assertAdminProWritesEnabled();
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("ADMIN_ACCOUNT_NOT_FOUND");
    const now = Date.now();
    const reason = normalizeAdminReason(args.reason);
    const expiresAt = validateGrantWindow({ ...args, now });
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_provider", (q: any) =>
        q.eq("userId", args.userId).eq("provider", "admin")
      )
      .first();
    const fields = {
      clerkUserId: target.clerkUserId,
      entitlement: "orbita_pro" as const,
      status: "active" as const,
      provider: "admin" as const,
      plan: args.mode === "permanent" ? "lifetime" as const : undefined,
      currentPeriodEnd: expiresAt,
      isLifetime: args.mode === "permanent",
      willRenew: false,
      updatedAt: now
    };
    if (existing) await ctx.db.patch(existing._id, fields);
    else await ctx.db.insert("subscriptions", { userId: args.userId, ...fields });
    const access = await resolveUserAccess(ctx, args.userId, now);
    const auditEventId = await ctx.db.insert("adminAuditEvents", omitUndefined({
      actorUserId: actor._id,
      targetUserId: args.userId,
      action: "pro_granted" as const,
      reason,
      mode: args.mode,
      expiresAt,
      effectiveIsPro: access.isPro,
      createdAt: now
    }));
    await syncAdminAccountStats(ctx, args.userId, { now });
    await incrementDailyRollup(
      ctx,
      localDateInTimezone(now, DEFAULT_ACTIVITY_TIMEZONE),
      { proGrants: 1 },
      now
    );
    if (expiresAt) {
      await ctx.scheduler.runAt(expiresAt, internalApi.adminMaintenance.refreshExpiredGrant, {
        userId: args.userId,
        expectedExpiresAt: expiresAt
      });
    }
    return {
      manualGrantApplied: true as const,
      effectiveAccess: accessFields(access),
      auditEventId
    };
  }
});

export const revokePro = mutation({
  args: { userId: v.id("users"), reason: v.string() },
  returns: v.object({
    manualGrantRemoved: v.boolean(),
    effectiveAccess: effectiveAccessValidator,
    auditEventId: v.id("adminAuditEvents")
  }),
  handler: async (ctx, args) => {
    const actor = await requireBackofficeUser(ctx);
    assertAdminAccountsEnabled();
    assertAdminProWritesEnabled();
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("ADMIN_ACCOUNT_NOT_FOUND");
    const now = Date.now();
    const reason = normalizeAdminReason(args.reason);
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_provider", (q: any) =>
        q.eq("userId", args.userId).eq("provider", "admin")
      )
      .first();
    const manualGrantRemoved = Boolean(existing && isRowActive(existing as SubscriptionRow, now));
    if (existing) {
      await ctx.db.patch(existing._id, {
        entitlement: "free",
        status: "expired",
        currentPeriodEnd: now,
        isLifetime: false,
        willRenew: false,
        updatedAt: now
      });
    }
    const access = await resolveUserAccess(ctx, args.userId, now);
    const auditEventId = await ctx.db.insert("adminAuditEvents", {
      actorUserId: actor._id,
      targetUserId: args.userId,
      action: "pro_revoked",
      reason,
      effectiveIsPro: access.isPro,
      createdAt: now
    });
    await syncAdminAccountStats(ctx, args.userId, { now });
    await incrementDailyRollup(
      ctx,
      localDateInTimezone(now, DEFAULT_ACTIVITY_TIMEZONE),
      { proRevokes: 1 },
      now
    );
    return {
      manualGrantRemoved,
      effectiveAccess: accessFields(access),
      auditEventId
    };
  }
});
