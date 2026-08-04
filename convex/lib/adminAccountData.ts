import {
  resolveEntitlement,
  type ResolvedEntitlement,
  type SubscriptionRow
} from "./entitlements";

function omitUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;
}

export const VOID_RETENTION_DAYS = 90;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_ACTIVITY_TIMEZONE = "America/Argentina/Buenos_Aires";

export const CONTENT_EVENT_KIND = {
  natal_chart_created: "natal_chart",
  natal_interpretation_created: "natal_interpretation",
  daily_guide_created: "daily_guide",
  daily_card_revealed: "daily_card_reveal",
  transit_reading_created: "transit_reading",
  void_answer_created: "void_answer",
  saved_reading_created: "saved_reading",
  journal_entry_created: "journal_entry"
} as const;

export type ContentEventName = keyof typeof CONTENT_EVENT_KIND;
export type ContentActivityKind = (typeof CONTENT_EVENT_KIND)[ContentEventName];

type ActivityDay = {
  localDate: string;
  lastActivityAt: number;
  activities: Array<{ kind: ContentActivityKind; count: number }>;
};

export function localDateInTimezone(timestamp: number, timezone: string): string {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      })
        .formatToParts(new Date(timestamp))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}

export function shiftLocalDate(localDate: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new Error("Invalid local date");
  const date = new Date(`${localDate}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid local date");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function computeStreakStats(days: ActivityDay[]) {
  const ordered = [...days]
    .filter((day) => day.activities.some((activity) => activity.count > 0))
    .sort((left, right) => left.localDate.localeCompare(right.localDate));
  let longestStreak = 0;
  let running = 0;
  let previous: string | undefined;
  let contentCreatedCount = 0;

  for (const day of ordered) {
    running = previous && shiftLocalDate(previous, 1) === day.localDate ? running + 1 : 1;
    longestStreak = Math.max(longestStreak, running);
    previous = day.localDate;
    contentCreatedCount += day.activities.reduce((sum, activity) => sum + activity.count, 0);
  }

  const last = ordered.at(-1);
  return {
    lastActivityAt: last?.lastActivityAt,
    lastActivityDate: last?.localDate,
    currentStreak: last ? running : 0,
    longestStreak,
    activeDayCount: ordered.length,
    contentCreatedCount
  };
}

function isProductionRuntime() {
  return (
    process.env.ORBITA_ENVIRONMENT === "production" ||
    process.env.COMMERCE_MODE === "live" ||
    process.env.CONVEX_DEPLOYMENT?.startsWith("prod:") === true
  );
}

export function adminAccountsEnabled() {
  if (process.env.ORBITA_ADMIN_ACCOUNTS_ENABLED === "false") return false;
  return !isProductionRuntime() || process.env.ORBITA_ADMIN_ACCOUNTS_ENABLED === "true";
}

export function adminProWritesEnabled() {
  if (process.env.ORBITA_ADMIN_PRO_WRITES_ENABLED === "false") return false;
  return !isProductionRuntime() || process.env.ORBITA_ADMIN_PRO_WRITES_ENABLED === "true";
}

export function assertAdminAccountsEnabled() {
  if (!adminAccountsEnabled()) throw new Error("ADMIN_ACCOUNTS_DISABLED");
}

export function assertAdminProWritesEnabled() {
  if (!adminProWritesEnabled()) throw new Error("ADMIN_PRO_WRITES_DISABLED");
}

export function normalizeAdminReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length < 3 || normalized.length > 240) {
    throw new Error("ADMIN_PRO_REASON_REQUIRED");
  }
  return normalized;
}

export function validateGrantWindow(args: {
  mode: "permanent" | "until";
  expiresAt?: number;
  now: number;
}) {
  if (args.mode === "permanent") return undefined;
  if (!Number.isFinite(args.expiresAt) || (args.expiresAt ?? 0) <= args.now) {
    throw new Error("ADMIN_PRO_EXPIRY_INVALID");
  }
  return args.expiresAt;
}

export function voidRetentionCutoff(now = Date.now()) {
  return now - VOID_RETENTION_DAYS * DAY_MS;
}

export function isVoidExpired(createdAt: number, now = Date.now()) {
  return createdAt < voidRetentionCutoff(now);
}

export function buildAdminSearchText(user: {
  _id: unknown;
  clerkUserId: string;
  email?: string;
  name?: string;
}) {
  return [user.name, user.email, user.clerkUserId, String(user._id)]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("es-AR")
    .replace(/\s+/g, " ")
    .trim();
}

async function currentBirthTimezone(ctx: { db: any }, userId: any) {
  const birthData = await ctx.db
    .query("birthData")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();
  return birthData?.timezone ?? DEFAULT_ACTIVITY_TIMEZONE;
}

async function updateGlobalAccountCounts(
  ctx: { db: any },
  change: { added?: boolean; wasPro?: boolean; isPro: boolean },
  now: number
) {
  const global = await ctx.db
    .query("adminGlobalStats")
    .withIndex("by_key", (q: any) => q.eq("key", "global"))
    .first();
  const totalDelta = change.added ? 1 : 0;
  const proDelta = change.added
    ? change.isPro ? 1 : 0
    : change.wasPro === change.isPro ? 0 : change.isPro ? 1 : -1;
  const freeDelta = totalDelta - proDelta;
  if (global) {
    await ctx.db.patch(global._id, {
      totalAccounts: Math.max(0, global.totalAccounts + totalDelta),
      proAccounts: Math.max(0, global.proAccounts + proDelta),
      freeAccounts: Math.max(0, global.freeAccounts + freeDelta),
      updatedAt: now
    });
  } else {
    await ctx.db.insert("adminGlobalStats", {
      key: "global",
      totalAccounts: totalDelta,
      proAccounts: change.isPro && change.added ? 1 : 0,
      freeAccounts: !change.isPro && change.added ? 1 : 0,
      updatedAt: now
    });
  }
}

export async function resolveUserAccess(
  ctx: { db: any },
  userId: any,
  now = Date.now()
): Promise<ResolvedEntitlement> {
  const subscriptions = (await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect()) as SubscriptionRow[];
  return resolveEntitlement(subscriptions, now);
}

export async function syncAdminAccountStats(
  ctx: { db: any },
  userId: any,
  options: { onboardingCompletedAt?: number; now?: number } = {}
) {
  const now = options.now ?? Date.now();
  const user = await ctx.db.get(userId);
  if (!user) return null;
  const access = await resolveUserAccess(ctx, userId, now);
  const existing = await ctx.db
    .query("adminAccountStats")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  const fields = {
    searchText: buildAdminSearchText(user),
    accountCreatedAt: user.createdAt,
    onboardingCompletedAt: options.onboardingCompletedAt ?? existing?.onboardingCompletedAt,
    isPro: access.isPro,
    subscriptionStatus: access.status,
    subscriptionProvider: access.provider,
    subscriptionPlan: access.plan,
    currentPeriodEnd: access.currentPeriodEnd,
    isLifetime: access.isLifetime,
    updatedAt: now
  };

  if (existing) {
    await ctx.db.patch(existing._id, fields);
    await updateGlobalAccountCounts(
      ctx,
      { wasPro: existing.isPro, isPro: access.isPro },
      now
    );
    return { ...existing, ...fields };
  }

  const id = await ctx.db.insert("adminAccountStats", {
    userId,
    ...omitUndefined(fields),
    currentStreak: 0,
    longestStreak: 0,
    activeDayCount: 0,
    contentCreatedCount: 0
  });
  await updateGlobalAccountCounts(ctx, { added: true, isPro: access.isPro }, now);
  return await ctx.db.get(id);
}

export async function rebuildUserActivityStats(
  ctx: { db: any },
  userId: any,
  now = Date.now()
) {
  const projection = await syncAdminAccountStats(ctx, userId, { now });
  if (!projection) return null;
  const days = (await ctx.db
    .query("userActivityDays")
    .withIndex("by_user_date", (q: any) => q.eq("userId", userId))
    .collect()) as ActivityDay[];
  const streak = computeStreakStats(days);
  await ctx.db.patch(projection._id, omitUndefined({ ...streak, updatedAt: now }));
  return { ...projection, ...streak };
}

export async function incrementDailyRollup(
  ctx: { db: any },
  localDate: string,
  patch: Partial<{
    accountsCreated: number;
    activeUsers: number;
    contentCreated: number;
    voidAnswers: number;
    proGrants: number;
    proRevokes: number;
  }>,
  now = Date.now()
) {
  const existing = await ctx.db
    .query("adminDailyRollups")
    .withIndex("by_date", (q: any) => q.eq("localDate", localDate))
    .first();
  const keys = [
    "accountsCreated",
    "activeUsers",
    "contentCreated",
    "voidAnswers",
    "proGrants",
    "proRevokes"
  ] as const;
  if (existing) {
    const next: Record<string, number> = {};
    for (const key of keys) next[key] = Math.max(0, existing[key] + (patch[key] ?? 0));
    await ctx.db.patch(existing._id, { ...next, updatedAt: now });
    return;
  }
  await ctx.db.insert("adminDailyRollups", {
    localDate,
    accountsCreated: Math.max(0, patch.accountsCreated ?? 0),
    activeUsers: Math.max(0, patch.activeUsers ?? 0),
    contentCreated: Math.max(0, patch.contentCreated ?? 0),
    voidAnswers: Math.max(0, patch.voidAnswers ?? 0),
    proGrants: Math.max(0, patch.proGrants ?? 0),
    proRevokes: Math.max(0, patch.proRevokes ?? 0),
    updatedAt: now
  });
}

export async function recordAuthoritativeContent(
  ctx: { db: any },
  args: {
    eventName: ContentEventName;
    userId: any;
    resourceId: string;
    occurredAt?: number;
    localDate?: string;
    timezone?: string;
    backfilled?: boolean;
  }
): Promise<boolean> {
  const eventId = `backend:${args.eventName}:${args.resourceId}`;
  const existingEvent = await ctx.db
    .query("productEvents")
    .withIndex("by_event_id", (q: any) => q.eq("eventId", eventId))
    .first();
  const reconcileLegacyEvent = Boolean(
    existingEvent && args.backfilled && existingEvent.backfilled === undefined
  );
  if (existingEvent && !reconcileLegacyEvent) return false;

  const occurredAt = args.occurredAt ?? Date.now();
  const timezone = args.timezone ?? (await currentBirthTimezone(ctx, args.userId));
  const localDate = args.localDate ?? localDateInTimezone(occurredAt, timezone);
  const eventFields = omitUndefined({
      eventId,
      eventName: args.eventName,
      source: "backend" as const,
      userId: args.userId,
      resourceId: args.resourceId,
      localDate,
      occurredAt,
      backfilled: args.backfilled ?? false
    });
  if (existingEvent) {
    await ctx.db.patch(existingEvent._id, {
      resourceId: args.resourceId,
      localDate,
      backfilled: true
    });
  } else {
    await ctx.db.insert("productEvents", eventFields);
  }

  const day = await ctx.db
    .query("userActivityDays")
    .withIndex("by_user_date", (q: any) =>
      q.eq("userId", args.userId).eq("localDate", localDate)
    )
    .first();
  const kind = CONTENT_EVENT_KIND[args.eventName];
  if (day) {
    const activities = [...day.activities];
    const position = activities.findIndex((activity) => activity.kind === kind);
    if (position >= 0) {
      activities[position] = { ...activities[position], count: activities[position].count + 1 };
    } else {
      activities.push({ kind, count: 1 });
    }
    await ctx.db.patch(day._id, {
      timezone,
      activities,
      firstActivityAt: Math.min(day.firstActivityAt, occurredAt),
      lastActivityAt: Math.max(day.lastActivityAt, occurredAt),
      updatedAt: Date.now()
    });
  } else {
    await ctx.db.insert("userActivityDays", {
      userId: args.userId,
      localDate,
      timezone,
      activities: [{ kind, count: 1 }],
      firstActivityAt: occurredAt,
      lastActivityAt: occurredAt,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  await incrementDailyRollup(ctx, localDate, {
    activeUsers: day ? 0 : 1,
    contentCreated: 1,
    voidAnswers: args.eventName === "void_answer_created" ? 1 : 0
  });
  await rebuildUserActivityStats(ctx, args.userId);
  return true;
}

export async function removeAuthoritativeContent(
  ctx: { db: any },
  args: {
    eventName: ContentEventName;
    userId: any;
    resourceId: string;
    localDate: string;
  }
) {
  const eventId = `backend:${args.eventName}:${args.resourceId}`;
  const event = await ctx.db
    .query("productEvents")
    .withIndex("by_event_id", (q: any) => q.eq("eventId", eventId))
    .first();
  if (!event) return false;
  await ctx.db.delete(event._id);
  const day = await ctx.db
    .query("userActivityDays")
    .withIndex("by_user_date", (q: any) =>
      q.eq("userId", args.userId).eq("localDate", args.localDate)
    )
    .first();
  let removedDay = false;
  if (day) {
    const kind = CONTENT_EVENT_KIND[args.eventName];
    const activities = day.activities
      .map((activity: { kind: ContentActivityKind; count: number }) =>
        activity.kind === kind ? { ...activity, count: activity.count - 1 } : activity
      )
      .filter((activity: { count: number }) => activity.count > 0);
    if (activities.length === 0) {
      await ctx.db.delete(day._id);
      removedDay = true;
    } else {
      await ctx.db.patch(day._id, { activities, updatedAt: Date.now() });
    }
  }
  await incrementDailyRollup(ctx, args.localDate, {
    activeUsers: removedDay ? -1 : 0,
    contentCreated: -1,
    voidAnswers: args.eventName === "void_answer_created" ? -1 : 0
  });
  await rebuildUserActivityStats(ctx, args.userId);
  return true;
}
