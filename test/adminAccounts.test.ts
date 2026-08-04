import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";
import {
  DAY_MS,
  adminAccountsEnabled,
  adminProWritesEnabled,
  computeStreakStats,
  isVoidExpired,
  localDateInTimezone,
  normalizeAdminReason,
  removeAuthoritativeContent,
  validateGrantWindow,
  voidRetentionCutoff
} from "../convex/lib/adminAccountData";
import { resolveEntitlement } from "../convex/lib/entitlements";
import { recordBackendProductEvent } from "../convex/lib/productAnalytics";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function activityDay(localDate: string, count = 1) {
  return {
    localDate,
    lastActivityAt: Date.parse(`${localDate}T15:00:00.000Z`),
    activities: [{ kind: "daily_guide" as const, count }]
  };
}

function activityDb() {
  const tables = new Map<string, any[]>([
    ["users", [{ _id: "user_12345678", clerkUserId: "clerk_12345678", createdAt: 1 }]],
    ["subscriptions", []]
  ]);
  let sequence = 0;
  const db = {
    tables,
    query(table: string) {
      let conditions: Array<[string, unknown]> = [];
      const result = {
        withIndex(_index: string, build?: (q: any) => any) {
          if (build) {
            const q = {
              eq(field: string, value: unknown) {
                conditions.push([field, value]);
                return q;
              }
            };
            build(q);
          }
          return result;
        },
        order() {
          return result;
        },
        async first() {
          return (tables.get(table) ?? []).find((row) =>
            conditions.every(([field, value]) => row[field] === value)
          ) ?? null;
        },
        async collect() {
          return (tables.get(table) ?? []).filter((row) =>
            conditions.every(([field, value]) => row[field] === value)
          );
        }
      };
      return result;
    },
    async get(id: string) {
      for (const rows of tables.values()) {
        const row = rows.find((candidate) => candidate._id === id);
        if (row) return row;
      }
      return null;
    },
    async insert(table: string, value: any) {
      const id = `${table}_${sequence++}`;
      tables.set(table, [...(tables.get(table) ?? []), { _id: id, ...value }]);
      return id;
    },
    async patch(id: string, value: any) {
      for (const [table, rows] of tables) {
        const position = rows.findIndex((row) => row._id === id);
        if (position < 0) continue;
        const next = [...rows];
        next[position] = { ...next[position], ...value };
        tables.set(table, next);
        return;
      }
    },
    async delete(id: string) {
      for (const [table, rows] of tables) {
        tables.set(table, rows.filter((row) => row._id !== id));
      }
    }
  };
  return db;
}

describe("admin account gates", () => {
  it("default to enabled in dev but fail closed in production", () => {
    delete process.env.ORBITA_ENVIRONMENT;
    delete process.env.COMMERCE_MODE;
    delete process.env.CONVEX_DEPLOYMENT;
    delete process.env.ORBITA_ADMIN_ACCOUNTS_ENABLED;
    delete process.env.ORBITA_ADMIN_PRO_WRITES_ENABLED;
    assert.equal(adminAccountsEnabled(), true);
    assert.equal(adminProWritesEnabled(), true);

    process.env.ORBITA_ENVIRONMENT = "production";
    assert.equal(adminAccountsEnabled(), false);
    assert.equal(adminProWritesEnabled(), false);
    process.env.ORBITA_ADMIN_ACCOUNTS_ENABLED = "true";
    assert.equal(adminAccountsEnabled(), true);
    assert.equal(adminProWritesEnabled(), false);
    process.env.ORBITA_ADMIN_PRO_WRITES_ENABLED = "true";
    assert.equal(adminProWritesEnabled(), true);
  });

  it("allows either gate to be switched off independently", () => {
    process.env.ORBITA_ADMIN_ACCOUNTS_ENABLED = "true";
    process.env.ORBITA_ADMIN_PRO_WRITES_ENABLED = "false";
    assert.equal(adminAccountsEnabled(), true);
    assert.equal(adminProWritesEnabled(), false);
  });
});

describe("manual Pro", () => {
  it("requires a meaningful reason and a future custom expiry", () => {
    assert.equal(normalizeAdminReason("  soporte al usuario  "), "soporte al usuario");
    assert.throws(() => normalizeAdminReason("  "), /ADMIN_PRO_REASON_REQUIRED/);
    assert.equal(
      validateGrantWindow({ mode: "permanent", now: 1000 }),
      undefined
    );
    assert.equal(
      validateGrantWindow({ mode: "until", expiresAt: 2000, now: 1000 }),
      2000
    );
    assert.throws(
      () => validateGrantWindow({ mode: "until", expiresAt: 1000, now: 1000 }),
      /ADMIN_PRO_EXPIRY_INVALID/
    );
  });

  it("resolves temporary, permanent, expired and paid coexistence correctly", () => {
    const now = 10_000;
    const temporary = {
      provider: "admin" as const,
      entitlement: "orbita_pro",
      status: "active" as const,
      currentPeriodEnd: now + DAY_MS
    };
    assert.equal(resolveEntitlement([temporary], now).provider, "admin");
    assert.equal(
      resolveEntitlement([{ ...temporary, currentPeriodEnd: now }], now).isPro,
      false
    );
    assert.equal(
      resolveEntitlement([{ ...temporary, currentPeriodEnd: undefined, isLifetime: true }], now)
        .isLifetime,
      true
    );

    const revokedAdmin = {
      provider: "admin" as const,
      entitlement: "free",
      status: "expired" as const
    };
    const stripe = {
      provider: "stripe" as const,
      entitlement: "orbita_pro",
      status: "active" as const,
      currentPeriodEnd: now + 2 * DAY_MS,
      willRenew: true
    };
    const result = resolveEntitlement([revokedAdmin, stripe], now);
    assert.equal(result.isPro, true);
    assert.equal(result.provider, "stripe");
    assert.equal(result.canManageInStripePortal, true);
  });
});

describe("authoritative activity and streaks", () => {
  it("deduplicates a retried durable event and applies its daily contribution once", async () => {
    const db = activityDb();
    const args = {
      eventName: "daily_guide_created" as const,
      userId: "user_12345678",
      dedupeKey: "guide_12345678",
      resourceId: "guide_12345678",
      occurredAt: Date.parse("2026-08-04T12:00:00.000Z"),
      localDate: "2026-08-04",
      timezone: "America/Argentina/Buenos_Aires"
    };
    assert.equal(await recordBackendProductEvent({ db }, args), true);
    assert.equal(await recordBackendProductEvent({ db }, args), false);
    assert.equal(db.tables.get("productEvents")?.length, 1);
    assert.equal(db.tables.get("userActivityDays")?.length, 1);
    assert.equal(db.tables.get("userActivityDays")?.[0].activities[0].count, 1);
    assert.equal(db.tables.get("adminDailyRollups")?.[0].activeUsers, 1);
    assert.equal(db.tables.get("adminDailyRollups")?.[0].contentCreated, 1);
    assert.equal(db.tables.get("adminAccountStats")?.[0].contentCreatedCount, 1);
  });

  it("reconciles a legacy reveal event once when the backfill is repeated", async () => {
    const db = activityDb();
    db.tables.set("productEvents", [{
      _id: "legacy_event",
      eventId: "backend:daily_card_revealed:guide_legacy_12345678",
      eventName: "daily_card_revealed",
      source: "backend",
      userId: "user_12345678",
      localDate: "2026-08-04",
      occurredAt: Date.parse("2026-08-04T12:00:00.000Z")
    }]);
    const args = {
      eventName: "daily_card_revealed" as const,
      userId: "user_12345678",
      dedupeKey: "guide_legacy_12345678",
      resourceId: "guide_legacy_12345678",
      occurredAt: Date.parse("2026-08-04T12:00:00.000Z"),
      localDate: "2026-08-04",
      timezone: "America/Argentina/Buenos_Aires",
      backfilled: true
    };
    assert.equal(await recordBackendProductEvent({ db }, args), true);
    assert.equal(await recordBackendProductEvent({ db }, args), false);
    assert.equal(db.tables.get("userActivityDays")?.[0].activities[0].count, 1);
    assert.equal(db.tables.get("productEvents")?.[0].backfilled, true);
  });

  it("counts one active day with multiple durable creations only once", () => {
    const result = computeStreakStats([activityDay("2026-08-01", 4)]);
    assert.equal(result.activeDayCount, 1);
    assert.equal(result.contentCreatedCount, 4);
    assert.equal(result.currentStreak, 1);
    assert.equal(result.longestStreak, 1);
  });

  it("handles consecutive days, gaps and retries deterministically", () => {
    const result = computeStreakStats([
      activityDay("2026-08-01"),
      activityDay("2026-08-02", 2),
      activityDay("2026-08-04")
    ]);
    assert.equal(result.activeDayCount, 3);
    assert.equal(result.contentCreatedCount, 4);
    assert.equal(result.longestStreak, 2);
    assert.equal(result.currentStreak, 1);
  });

  it("uses the supplied natal timezone at the UTC day boundary", () => {
    const timestamp = Date.parse("2026-08-04T01:30:00.000Z");
    assert.equal(localDateInTimezone(timestamp, "America/Argentina/Buenos_Aires"), "2026-08-03");
    assert.equal(localDateInTimezone(timestamp, "Europe/Madrid"), "2026-08-04");
  });

  it("removes Void's exclusive day and streak contribution during retention cleanup", async () => {
    const db = activityDb();
    const occurredAt = Date.parse("2026-04-01T12:00:00.000Z");
    await recordBackendProductEvent({ db }, {
      eventName: "void_answer_created",
      userId: "user_12345678",
      dedupeKey: "void_12345678",
      resourceId: "void_12345678",
      occurredAt,
      localDate: "2026-04-01",
      timezone: "America/Argentina/Buenos_Aires"
    });
    assert.equal(await removeAuthoritativeContent({ db }, {
      eventName: "void_answer_created",
      userId: "user_12345678",
      resourceId: "void_12345678",
      localDate: "2026-04-01"
    }), true);
    assert.equal(db.tables.get("productEvents")?.length, 0);
    assert.equal(db.tables.get("userActivityDays")?.length, 0);
    assert.equal(db.tables.get("adminAccountStats")?.[0].activeDayCount, 0);
    assert.equal(db.tables.get("adminAccountStats")?.[0].contentCreatedCount, 0);
    assert.equal(db.tables.get("adminDailyRollups")?.[0].activeUsers, 0);
    assert.equal(db.tables.get("adminDailyRollups")?.[0].voidAnswers, 0);
  });
});

describe("Void retention", () => {
  it("keeps the exact 90-day boundary and expires only older rows", () => {
    const now = Date.parse("2026-08-04T12:00:00.000Z");
    const cutoff = voidRetentionCutoff(now);
    assert.equal(now - cutoff, 90 * DAY_MS);
    assert.equal(isVoidExpired(cutoff, now), false);
    assert.equal(isVoidExpired(cutoff - 1, now), true);
  });
});

describe("backend wiring", () => {
  it("protects every public admin function and both Pro writes", () => {
    const source = readFileSync(`${process.cwd()}/convex/adminAccounts.ts`, "utf8");
    assert.equal((source.match(/requireBackofficeIdentity\(ctx\)/g) ?? []).length, 5);
    assert.equal((source.match(/requireBackofficeUser\(ctx\)/g) ?? []).length, 2);
    assert.equal((source.match(/assertAdminAccountsEnabled\(\)/g) ?? []).length, 7);
    assert.equal((source.match(/assertAdminProWritesEnabled\(\)/g) ?? []).length, 2);
  });

  it("uses cursor backfill, indexed Void cleanup and a daily cron", () => {
    const maintenance = readFileSync(`${process.cwd()}/convex/adminMaintenance.ts`, "utf8");
    const crons = readFileSync(`${process.cwd()}/convex/crons.ts`, "utf8");
    assert.match(maintenance, /\.paginate\(\{ cursor: state\.cursor \?\? null, numItems: BATCH_SIZE \}\)/);
    assert.match(maintenance, /withIndex\("by_created_at"[\s\S]*?q\.lt\("createdAt", cutoff\)/);
    assert.match(crons, /cleanup expired Void answers/);
  });
});
