import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  analyticsLocalDate,
  assertOpaqueAnalyticsId,
  assertSafeEntryPoint,
  computeDailyDigestMetrics,
  formatDailyDigest,
  recordBackendProductEvent,
  shiftIsoDate
} from "../convex/lib/productAnalytics";

describe("product analytics", () => {
  it("uses the Buenos Aires calendar day and shifts ISO dates safely", () => {
    assert.equal(analyticsLocalDate(Date.parse("2026-07-20T02:30:00.000Z")), "2026-07-19");
    assert.equal(analyticsLocalDate(Date.parse("2026-07-20T03:30:00.000Z")), "2026-07-20");
    assert.equal(shiftIsoDate("2026-03-01", -1), "2026-02-28");
    assert.equal(shiftIsoDate("2024-03-01", -1), "2024-02-29");
  });

  it("rejects identifiers and entry points that could carry free text", () => {
    assert.doesNotThrow(() => assertOpaqueAnalyticsId("eventId", "evt_12345678-abcd"));
    assert.doesNotThrow(() => assertSafeEntryPoint("home:daily_card"));
    assert.throws(() => assertOpaqueAnalyticsId("eventId", "short"), /Invalid eventId/);
    assert.throws(() => assertOpaqueAnalyticsId("eventId", "email@example.com"), /Invalid eventId/);
    assert.throws(() => assertSafeEntryPoint("mi nota privada"), /Invalid entryPoint/);
  });

  it("deduplicates people across sessions/devices and calculates retention", () => {
    const metrics = computeDailyDigestMetrics({
      reportDate: "2026-07-19",
      previousDate: "2026-07-18",
      actors: [
        { _id: "a1", installationId: "i1", userId: "u1", firstOpenedDate: "2026-07-19" },
        { _id: "a2", installationId: "i2", userId: "u2", firstOpenedDate: "2026-07-10" },
        { _id: "a2b", installationId: "i2b", userId: "u2", firstOpenedDate: "2026-07-12" },
        { _id: "a3", installationId: "i3", userId: "u3", firstOpenedDate: "2026-07-18" },
        { _id: "a4", installationId: "i4", userId: "u4", firstOpenedDate: "2026-07-18" },
        { _id: "a5", installationId: "i5", userId: "u5", firstOpenedDate: "2026-07-01" }
      ],
      users: [
        { _id: "u1", createdAt: Date.parse("2026-07-19T15:00:00Z") },
        { _id: "u2", createdAt: Date.parse("2026-07-10T15:00:00Z") },
        { _id: "u3", createdAt: Date.parse("2026-07-18T15:00:00Z") },
        { _id: "u4", createdAt: Date.parse("2026-07-18T15:00:00Z") },
        { _id: "u5", createdAt: Date.parse("2026-07-01T15:00:00Z") }
      ],
      previousEvents: [
        { eventName: "app_opened", actorId: "a3", userId: "u3" },
        { eventName: "app_opened", actorId: "a4", userId: "u4" },
        { eventName: "app_opened", actorId: "a5", userId: "u5" }
      ],
      currentEvents: [
        { eventName: "app_opened", actorId: "a1", userId: "u1" },
        { eventName: "app_opened", actorId: "a2", userId: "u2" },
        { eventName: "app_opened", actorId: "a2b", userId: "u2" },
        { eventName: "app_opened", actorId: "a3", userId: "u3" },
        { eventName: "app_opened", actorId: "a5", userId: "u5" },
        { eventName: "onboarding_completed", userId: "u1" },
        { eventName: "onboarding_completed", userId: "u1" },
        { eventName: "daily_card_revealed", userId: "u1" },
        { eventName: "daily_card_revealed", userId: "u2" },
        { eventName: "daily_card_revealed", userId: "u2" }
      ]
    });

    assert.deepEqual(metrics, {
      reportDate: "2026-07-19",
      opened: 4,
      openedNew: 1,
      openedReturning: 3,
      onboardingCompleted: 1,
      cardsRevealed: 2,
      cardsRevealedNew: 1,
      cardsRevealedReturning: 1,
      d1Returned: 1,
      d1Cohort: 2,
      previousActiveReturned: 2,
      previousActive: 3
    });
  });

  it("formats the exact Telegram digest agreed with product", () => {
    assert.equal(
      formatDailyDigest({
        reportDate: "2026-07-19",
        opened: 43,
        openedNew: 17,
        openedReturning: 26,
        onboardingCompleted: 9,
        cardsRevealed: 21,
        cardsRevealedNew: 12,
        cardsRevealedReturning: 9,
        d1Returned: 7,
        d1Cohort: 17,
        previousActiveReturned: 18,
        previousActive: 31
      }),
      [
        "📊 Órbita — resumen del 19/07",
        "",
        "👥 Abrieron la app: 43",
        "├ Nuevos: 17",
        "└ Recurrentes: 26",
        "🆕 Onboarding completado: 9",
        "",
        "🪐 Desbloquearon su carta: 21",
        "├ Nuevos: 12",
        "└ Recurrentes: 9",
        "",
        "↩️ Retención D1: 41% (7 de 17)",
        "🔥 Activos de ayer que volvieron: 58% (18 de 31)"
      ].join("\n")
    );
  });

  it("records backend outcomes once even when the product mutation retries", async () => {
    const rows: any[] = [];
    const ctx = {
      db: {
        query() {
          return {
            withIndex(_index: string, build: (q: any) => any) {
              let eventId = "";
              build({
                eq(_field: string, value: string) {
                  eventId = value;
                  return this;
                }
              });
              return { first: async () => rows.find((row) => row.eventId === eventId) ?? null };
            }
          };
        },
        async insert(_table: string, value: any) {
          rows.push({ _id: `row_${rows.length}`, ...value });
        }
      }
    };

    const first = await recordBackendProductEvent(ctx, {
      eventName: "daily_card_revealed",
      userId: "user_12345678",
      dedupeKey: "guide_12345678",
      occurredAt: Date.parse("2026-07-19T15:00:00Z")
    });
    const second = await recordBackendProductEvent(ctx, {
      eventName: "daily_card_revealed",
      userId: "user_12345678",
      dedupeKey: "guide_12345678",
      occurredAt: Date.parse("2026-07-19T15:00:00Z")
    });

    assert.equal(first, true);
    assert.equal(second, false);
    assert.equal(rows.length, 1);
  });

  it("keeps client events closed and the daily cron at 09:00 Argentina", () => {
    const telemetry = readFileSync(`${process.cwd()}/convex/telemetry.ts`, "utf8");
    const schema = readFileSync(`${process.cwd()}/convex/schema.ts`, "utf8");
    const crons = readFileSync(`${process.cwd()}/convex/crons.ts`, "utf8");

    assert.doesNotMatch(telemetry, /properties:\s*v\.any/);
    assert.match(telemetry, /withIndex\("by_event_id"/);
    assert.match(schema, /productEvents:[\s\S]*?\.index\("by_event_id", \["eventId"\]\)/);
    assert.match(crons, /hourUTC:\s*12,\s*minuteUTC:\s*0/);
  });
});
