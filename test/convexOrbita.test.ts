import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailyReadingPayload,
  buildNatalChartSnapshot,
  getZodiacPlacement,
  normalizeBirthTime,
  userFieldsFromIdentity
} from "../convex/lib/orbita";

test("builds user fields from a Clerk-like identity", () => {
  const fields = userFieldsFromIdentity(
    {
      tokenIdentifier: "https://issuer|user_123",
      subject: "user_123",
      email: "mica@example.com",
      givenName: "Mica"
    },
    123
  );

  assert.equal(fields.clerkUserId, "user_123");
  assert.equal(fields.email, "mica@example.com");
  assert.equal(fields.name, "Mica");
  assert.equal(fields.updatedAt, 123);
});

test("normalizes valid birth time and rejects invalid values", () => {
  assert.equal(normalizeBirthTime("8:30"), "08:30");
  assert.equal(normalizeBirthTime("23:05"), "23:05");
  assert.equal(normalizeBirthTime("25:05"), undefined);
  assert.equal(normalizeBirthTime("not-a-time"), undefined);
});

test("derives solar placement from birth date", () => {
  assert.deepEqual(getZodiacPlacement("1996-01-15"), {
    sign: "capricornio",
    element: "tierra"
  });
  assert.deepEqual(getZodiacPlacement("1994-04-12"), {
    sign: "aries",
    element: "fuego"
  });
});

test("builds a versioned natal chart stub", () => {
  const chart = buildNatalChartSnapshot({
    birthDate: "1996-01-15",
    birthTime: "08:30",
    birthTimePrecision: "known",
    birthPlaceLabel: "Buenos Aires, Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires"
  });

  assert.equal(chart.source, "stub");
  assert.equal(chart.summary.solarSign, "capricornio");
  assert.equal(chart.summary.solarElement, "tierra");
  assert.equal(chart.summary.accuracy, "ready_for_real_calculation");
});

test("builds stable daily reading payloads for the same input", () => {
  const chart = buildNatalChartSnapshot({
    birthDate: "1996-01-15",
    birthTime: "08:30",
    birthTimePrecision: "known",
    birthPlaceLabel: "Buenos Aires, Argentina",
    timezone: "America/Argentina/Buenos_Aires"
  });
  const first = buildDailyReadingPayload({
    localDate: "2026-07-02",
    timezone: "America/Argentina/Buenos_Aires",
    chart
  });
  const second = buildDailyReadingPayload({
    localDate: "2026-07-02",
    timezone: "America/Argentina/Buenos_Aires",
    chart
  });

  assert.deepEqual(first, second);
  assert.equal(first.sign, "capricornio");
  assert.equal(first.modules.action.length > 0, true);
});
