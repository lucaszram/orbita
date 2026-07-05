import assert from "node:assert/strict";
import test from "node:test";
import { requireBackofficeExistingUser } from "../convex/lib/backoffice";
import {
  buildAstrologicalLabRunPayload,
  buildLabRunPayload,
  buildDailyReadingPayload,
  buildNatalChartSnapshot,
  normalizeAstrologyApiNatalChart,
  normalizeAstrologyApiTransits,
  getModelGaps,
  getZodiacPlacement,
  normalizeBirthInput,
  normalizeBirthTime,
  selectRelevantTransits,
  userFieldsFromIdentity
} from "../convex/lib/orbita";
import { getTimezoneOffsetHours } from "../convex/lib/astrologyApi";

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

test("backoffice read auth does not write when the user row does not exist yet", async () => {
  const previousAllowedEmails = process.env.ORBITA_BACKOFFICE_ALLOWED_EMAILS;
  process.env.ORBITA_BACKOFFICE_ALLOWED_EMAILS = "lucaszramos11@gmail.com";

  try {
    const user = await requireBackofficeExistingUser({
      auth: {
        getUserIdentity: async () => ({
          tokenIdentifier: "https://issuer.example|user_123",
          subject: "user_123",
          email: "lucaszramos11@gmail.com"
        })
      },
      db: {
        query: (table: string) => {
          assert.equal(table, "users");
          return {
            withIndex: () => ({
              first: async () => null
            })
          };
        }
      }
    } as any);

    assert.equal(user, null);
  } finally {
    if (previousAllowedEmails === undefined) {
      delete process.env.ORBITA_BACKOFFICE_ALLOWED_EMAILS;
    } else {
      process.env.ORBITA_BACKOFFICE_ALLOWED_EMAILS = previousAllowedEmails;
    }
  }
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
  assert.equal(first.mode, "demo_without_provider");
  assert.equal(first.home.question.length > 0, true);
  assert.equal(first.home.doList.length, 3);
  assert.equal(first.home.avoidList.length, 3);
  assert.equal(first.personalization.status, "maqueta_no_personalizada_completa");
  assert.equal(first.chartProfile.triad.length, 3);
  assert.equal(first.deepDive.title.length > 0, true);
  assert.equal(first.transits.highlighted, null);
  assert.equal(first.voidPreview.suggestedQuestions.length > 0, true);
  assert.equal(first.futureSelf.prompt.length > 0, true);
});

test("normalizes lab birth input for known and unknown birth times", () => {
  const known = normalizeBirthInput({
    birthDate: "1996-01-15",
    birthTime: "8:30",
    birthTimePrecision: "known",
    birthPlaceLabel: " Buenos Aires, Argentina ",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires"
  });

  assert.equal(known.birthTime, "08:30");
  assert.equal(known.birthPlaceLabel, "Buenos Aires, Argentina");
  assert.deepEqual(known.modelInputWarnings, []);

  const unknown = normalizeBirthInput({
    birthDate: "1996-01-15",
    birthTime: "8:30",
    birthTimePrecision: "unknown",
    birthPlaceLabel: "Buenos Aires, Argentina",
    timezone: "America/Argentina/Buenos_Aires"
  });

  assert.equal(unknown.birthTime, undefined);
  assert.equal(unknown.modelInputWarnings.includes("birth_time_ignored_because_precision_unknown"), true);
  assert.equal(unknown.modelInputWarnings.includes("coordinates_missing"), true);
});

test("lists explicit model gaps for backoffice lab runs", () => {
  const gaps = getModelGaps({
    birthDate: "1996-01-15",
    birthTimePrecision: "unknown",
    birthPlaceLabel: "Buenos Aires, Argentina",
    timezone: "America/Argentina/Buenos_Aires"
  });

  assert.equal(gaps.includes("moon_position_requires_real_ephemeris"), true);
  assert.equal(gaps.includes("ascendant_requires_real_calculation"), true);
  assert.equal(gaps.includes("houses_require_real_calculation"), true);
  assert.equal(gaps.includes("daily_transits_require_real_ephemeris"), true);
  assert.equal(gaps.includes("unknown_birth_time_limits_ascendant_and_houses"), true);
});

test("builds stable lab run payloads for the same person and date", () => {
  const input = {
    birthDate: "1996-01-15",
    birthTime: "08:30",
    birthTimePrecision: "known" as const,
    birthPlaceLabel: "Buenos Aires, Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires"
  };

  const first = buildLabRunPayload({
    localDate: "2026-07-04",
    input
  });
  const second = buildLabRunPayload({
    localDate: "2026-07-04",
    input
  });

  assert.deepEqual(first, second);
  assert.equal(first.chart.summary.solarSign, "capricornio");
  assert.equal(first.dailyReading.localDate, "2026-07-04");
  assert.equal(first.modelGaps.includes("moon_position_requires_real_ephemeris"), true);
});

test("computes numeric timezone offsets for AstrologyAPI requests", () => {
  const offset = getTimezoneOffsetHours(
    "America/Argentina/Buenos_Aires",
    new Date(Date.UTC(1996, 0, 15, 8, 30))
  );

  assert.equal(offset, -3);
});

test("normalizes AstrologyAPI natal chart responses into Órbita chart data", () => {
  const input = normalizeBirthInput({
    birthDate: "1996-01-15",
    birthTime: "08:30",
    birthTimePrecision: "known",
    birthPlaceLabel: "Buenos Aires, Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires"
  });

  const chart = normalizeAstrologyApiNatalChart({
    input,
    houseSystem: "placidus",
    timezoneOffset: -3,
    calculationTimeSource: "birth_time",
    natalChartInterpretation: {
      planets: [
        { name: "Sun", full_degree: 294.4, norm_degree: 24.4, is_retro: "false", sign: "Capricorn", house: 11 },
        { name: "Moon", full_degree: 208.1, norm_degree: 28.1, is_retro: "false", sign: "Libra", house: 8 },
        { name: "Mercury", full_degree: 302.2, norm_degree: 2.2, is_retro: "true", sign: "Aquarius", house: 12 }
      ],
      houses: [
        { house: 1, sign: "Pisces", degree: 340.2 },
        { house: 4, sign: "Gemini", degree: 78.1 },
        { house: 7, sign: "Virgo", degree: 160.2 },
        { house: 10, sign: "Sagittarius", degree: 258.1 }
      ]
    },
    westernChartData: {
      aspects: [
        { aspecting_planet: "Sun", aspected_planet: "Moon", type: "Square", orb: 1.2, diff: 91.2 },
        { aspecting_planet: "Mercury", aspected_planet: "Moon", type: "Semi Sextile", orb: 4.3, diff: 25.7 }
      ]
    }
  });

  assert.equal(chart.summary.sun?.signEs, "capricornio");
  assert.equal(chart.summary.moon?.signEs, "libra");
  assert.equal(chart.summary.ascendant?.signEs, "piscis");
  assert.equal(chart.summary.mainAspects.length, 1);
  assert.equal(chart.placements.some((placement) => placement.key === "ascendant"), true);
});

test("selects high-priority major transits for daily readings", () => {
  const transits = normalizeAstrologyApiTransits({
    transit_relation: [
      {
        transit_planet: "Moon",
        natal_planet: "Moon",
        aspect_type: "Conjunction",
        exact_time: "2026-07-04 12:00:00",
        transit_sign: "Scorpio",
        natal_house: 2,
        is_retrograde: false
      },
      {
        transit_planet: "Saturn",
        natal_planet: "Sun",
        aspect_type: "Square",
        exact_time: "2026-07-04 08:00:00",
        transit_sign: "Aries",
        natal_house: 1,
        is_retrograde: true
      },
      {
        transit_planet: "Venus",
        natal_planet: "Mercury",
        aspect_type: "Semi Sextile",
        exact_time: "2026-07-04 09:00:00",
        transit_sign: "Gemini",
        natal_house: 4,
        is_retrograde: false
      }
    ]
  });

  const selected = selectRelevantTransits(transits);
  assert.equal(selected.length, 2);
  assert.equal(selected[0].transitPlanet, "saturn");
  assert.equal(selected[0].natalPoint, "sun");
});

test("builds provider-backed lab payloads with editorial daily modules", () => {
  const input = {
    birthDate: "1996-01-15",
    birthTime: "08:30",
    birthTimePrecision: "known" as const,
    birthPlaceLabel: "Buenos Aires, Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires"
  };
  const normalized = normalizeBirthInput(input);
  const chart = normalizeAstrologyApiNatalChart({
    input: normalized,
    houseSystem: "placidus",
    timezoneOffset: -3,
    calculationTimeSource: "birth_time",
    natalChartInterpretation: {
      planets: [
        { name: "Sun", full_degree: 294.4, norm_degree: 24.4, is_retro: "false", sign: "Capricorn", house: 11 },
        { name: "Moon", full_degree: 208.1, norm_degree: 28.1, is_retro: "false", sign: "Libra", house: 8 }
      ],
      houses: [{ house: 1, sign: "Pisces", degree: 340.2 }]
    },
    westernChartData: {
      aspects: [{ aspecting_planet: "Sun", aspected_planet: "Moon", type: "Square", orb: 1.2, diff: 91.2 }]
    }
  });
  const transits = normalizeAstrologyApiTransits({
    transit_relation: [
      {
        transit_planet: "Saturn",
        natal_planet: "Sun",
        aspect_type: "Square",
        exact_time: "2026-07-04 08:00:00",
        transit_sign: "Aries",
        natal_house: 1,
        is_retrograde: true
      }
    ]
  });

  const payload = buildAstrologicalLabRunPayload({
    localDate: "2026-07-04",
    input,
    providerResult: {
      status: "success",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-v1",
      houseSystem: "placidus",
      localDate: "2026-07-04",
      warnings: [],
      normalized: { chart, transits },
      raw: { fixture: true }
    }
  }) as any;

  assert.equal(payload.chart.source, "astrologyapi");
  assert.equal(payload.dailyReading.source, "provider_transits");
  assert.equal(payload.dailyReading.mode, "provider_real");
  assert.equal(payload.dailyReading.modules.headline.includes("Saturno"), true);
  assert.equal(payload.dailyReading.home.doList.length, 3);
  assert.equal(payload.dailyReading.home.avoidList.length, 3);
  assert.equal(payload.dailyReading.personalization.status, "personalizado_con_carta_y_transitos");
  assert.equal(payload.dailyReading.chartProfile.triad.length >= 2, true);
  assert.equal(payload.dailyReading.deepDive.title, "Deep Dive del dia");
  assert.equal(payload.dailyReading.transits.highlighted.displayText.includes("Saturno"), true);
  assert.equal(payload.dailyReading.futureSelf.prompt.length > 0, true);
  assert.equal(payload.modelGaps.includes("editorial_review_required_before_app_release"), true);
});

test("falls back to stub payloads when AstrologyAPI is not configured", () => {
  const payload = buildAstrologicalLabRunPayload({
    localDate: "2026-07-04",
    input: {
      birthDate: "1996-01-15",
      birthTime: "08:30",
      birthTimePrecision: "known",
      birthPlaceLabel: "Buenos Aires, Argentina",
      latitude: -34.6037,
      longitude: -58.3816,
      timezone: "America/Argentina/Buenos_Aires"
    },
    providerResult: {
      status: "not_configured",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-v1",
      localDate: "2026-07-04",
      warnings: ["astrologyapi_credentials_not_configured"]
    }
  }) as any;

  assert.equal(payload.chart.source, "stub");
  assert.equal(payload.dailyReading.source, "stub_fallback");
  assert.equal(payload.dailyReading.mode, "demo_without_provider");
  assert.equal(payload.dailyReading.home.doList.length, 3);
  assert.equal(payload.dailyReading.home.avoidList.length, 3);
  assert.equal(payload.dailyReading.personalization.confidence, "baja_maqueta");
  assert.equal(payload.dailyReading.chartProfile.limitations.length > 0, true);
  assert.equal(payload.dailyReading.voidPreview.suggestedQuestions.length > 0, true);
  assert.equal(payload.modelGaps.includes("astrologyapi_credentials_not_configured"), true);
});
