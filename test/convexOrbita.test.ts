import assert from "node:assert/strict";
import test from "node:test";
import { requireBackofficeExistingUser } from "../convex/lib/backoffice";
import {
  buildAstrologicalLabRunPayload,
  buildChartWheelData,
  buildLabRunPayload,
  buildDailyReadingPayload,
  buildLongRangeTimelineContract,
  buildNatalChartSnapshot,
  buildWebB0PersonalityReadingPayload,
  buildWebB0TransitDetailPayload,
  buildWebB0ValuesMapPayload,
  buildValueRadar,
  normalizeAstrologyApiNatalChart,
  normalizeAstrologyApiTransitTimeline,
  normalizeAstrologyApiTransits,
  getModelGaps,
  getZodiacPlacement,
  normalizeBirthInput,
  normalizeBirthTime,
  selectRelevantTransits,
  userFieldsFromIdentity
} from "../convex/lib/orbita";
import {
  buildPlaceLookupRequests,
  getTimezoneOffsetHours,
  normalizeAstrologyApiPlaceResults
} from "../convex/lib/astrologyApi";
import {
  buildNatalInterpretationGatewayPlan,
  generateDailyHomeWithGateway,
  mergeDailyHomeWithLlm,
  parseLlmDailyHomeText
} from "../convex/lib/aiGateway";
import {
  assertPublicLabAccess,
  buildCompleteHoroscopeProfile,
  buildPublicDailyHomeResponse,
  buildPublicTransitTimelineResponse
} from "../convex/publicLab";
import { sanitizeAppFacingPayload } from "../convex/webB0Seed";
import {
  buildBirthDataHash,
  buildNatalChartCacheKey,
  dailyReadingNeedsRefresh
} from "../convex/lib/birthDataConsistency";
import { isCurrentDailyGuidePayload, localDateForTimezone } from "../convex/daily";
import { drawCard } from "../convex/lib/tarot";

test("birth data cache identity changes when known time is removed", () => {
  const base = {
    birthDate: "1996-01-15",
    birthPlaceLabel: "Buenos Aires, Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires"
  };
  const known = buildBirthDataHash({ ...base, birthTime: "08:30", birthTimePrecision: "known" });
  const unknown = buildBirthDataHash({ ...base, birthTimePrecision: "unknown" });

  assert.notEqual(known, unknown);
  assert.match(buildNatalChartCacheKey("user_123", unknown), /^natal:orbita-astrologyapi-western-v1:user_123:/);
});

test("daily reading refreshes when the natal chart changes", () => {
  const existing = {
    natalChartId: "chart_old",
    timezone: "America/Argentina/Buenos_Aires",
    contentVersion: "orbita-daily-stub-v1"
  };

  assert.equal(
    dailyReadingNeedsRefresh(existing, "chart_new", existing.timezone, existing.contentVersion),
    true
  );
  assert.equal(
    dailyReadingNeedsRefresh(existing, "chart_old", existing.timezone, existing.contentVersion),
    false
  );
  assert.equal(
    dailyReadingNeedsRefresh(existing, "chart_old", "America/New_York", existing.contentVersion),
    true
  );
  assert.equal(
    dailyReadingNeedsRefresh(existing, "chart_old", existing.timezone, "orbita-daily-v2"),
    true
  );
});

function buildFixtureAstrologyChart() {
  const input = normalizeBirthInput({
    birthDate: "1996-01-15",
    birthTime: "08:30",
    birthTimePrecision: "known",
    birthPlaceLabel: "Buenos Aires, Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires"
  });

  return normalizeAstrologyApiNatalChart({
    input,
    houseSystem: "placidus",
    timezoneOffset: -3,
    calculationTimeSource: "birth_time",
    natalChartInterpretation: {
      planets: [
        { name: "Sun", full_degree: 294.4, norm_degree: 24.4, is_retro: "false", sign: "Capricorn", house: 11 },
        { name: "Moon", full_degree: 208.1, norm_degree: 28.1, is_retro: "false", sign: "Libra", house: 8 },
        { name: "Mercury", full_degree: 302.2, norm_degree: 2.2, is_retro: "true", sign: "Aquarius", house: 12 },
        { name: "Venus", full_degree: 195.1, norm_degree: 15.1, is_retro: "false", sign: "Libra", house: 7 },
        { name: "Saturn", full_degree: 14.2, norm_degree: 14.2, is_retro: "true", sign: "Aries", house: 1 }
      ],
      houses: [
        { house: 1, sign: "Pisces", degree: 340.2 },
        { house: 2, sign: "Aries", degree: 16.1 },
        { house: 3, sign: "Taurus", degree: 45.3 },
        { house: 4, sign: "Gemini", degree: 78.1 },
        { house: 5, sign: "Cancer", degree: 105.4 },
        { house: 6, sign: "Leo", degree: 132.7 },
        { house: 7, sign: "Virgo", degree: 160.2 },
        { house: 8, sign: "Libra", degree: 196.1 },
        { house: 9, sign: "Scorpio", degree: 225.8 },
        { house: 10, sign: "Sagittarius", degree: 258.1 },
        { house: 11, sign: "Capricorn", degree: 285.2 },
        { house: 12, sign: "Aquarius", degree: 312.3 }
      ]
    },
    westernChartData: {
      aspects: [
        { aspecting_planet: "Sun", aspected_planet: "Moon", type: "Square", orb: 1.2, diff: 91.2 },
        { aspecting_planet: "Venus", aspected_planet: "Moon", type: "Trine", orb: 2.1, diff: 118.1 },
        { aspecting_planet: "Saturn", aspected_planet: "Sun", type: "Opposition", orb: 0.8, diff: 179.2 },
        { aspecting_planet: "Mercury", aspected_planet: "Moon", type: "Semi Sextile", orb: 4.3, diff: 25.7 }
      ]
    }
  });
}

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

test("rejects stale daily guide caches that predate the card contract", () => {
  assert.equal(
    isCurrentDailyGuidePayload({
      headline: "Guía anterior",
      body: "Sin carta"
    }),
    false
  );
  assert.equal(
    isCurrentDailyGuidePayload({
      payloadVersion: "orbita-daily-guide-v2",
      carta: { id: 16, nombre: "La Torre", beats: [] }
    }),
    false
  );
  assert.equal(
    isCurrentDailyGuidePayload({
      payloadVersion: "orbita-daily-guide-v3",
      carta: {
        id: 16,
        nombre: "La Torre",
        orientacion: "invertida",
        ritual: {
          esencia: "Una estructura pide revisión.",
          significadoGeneral: [
            { titulo: "Ruptura", texto: "Algo deja de sostenerse como antes." },
            { titulo: "Verdad", texto: "La escena obliga a mirar lo que ya estaba." },
            { titulo: "Reordenamiento", texto: "Lo que queda necesita otra forma de sostén." }
          ],
          enTuDia: "Mirá dónde insistís por costumbre.",
          consejo: "Soltá una defensa concreta.",
          cierre: { pregunta: "¿Qué estructura ya no te sostiene?" }
        }
      }
    }),
    true
  );
  assert.equal(
    isCurrentDailyGuidePayload({
      payloadVersion: "orbita-daily-guide-v3",
      carta: { id: "16", nombre: "La Torre", orientacion: "derecho", ritual: {} }
    }),
    false
  );
});

test("daily tarot draw is stable per user and date", () => {
  const first = drawCard({ userId: "user_123", localDate: "2026-07-15" });
  const repeated = drawCard({ userId: "user_123", localDate: "2026-07-15" });

  assert.deepEqual(repeated, first);
  assert.ok(first.id >= 0 && first.id <= 77);
  assert.ok(first.nombre.length > 0);
  assert.ok(first.correspondencia.length > 0);
  assert.ok(first.orientacion === "derecho" || first.orientacion === "invertida");
});

test("daily date follows the user's timezone around midnight", () => {
  const instant = new Date("2026-07-16T02:30:00.000Z");

  assert.equal(localDateForTimezone("America/Argentina/Buenos_Aires", instant), "2026-07-15");
  assert.equal(localDateForTimezone("Asia/Tokyo", instant), "2026-07-16");
});

test("sanitizes provider raw and request details before Web B0 QA persistence", () => {
  const payload = sanitizeAppFacingPayload({
    source: "astrologyapi",
    provider: {
      status: "success",
      request: { natal: { day: 11 } }
    },
    normalized: {
      placements: [{ key: "sun", raw: { provider: true }, request: { nested: true } }]
    },
    raw: { natalChartInterpretation: true }
  }) as any;

  assert.equal(payload.raw, undefined);
  assert.equal(payload.provider.request, undefined);
  assert.equal(payload.normalized.placements[0].raw, undefined);
  assert.equal(payload.normalized.placements[0].request, undefined);
  assert.equal(payload.provider.status, "success");
  assert.equal(payload.normalized.placements[0].key, "sun");
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
  assert.ok(first.personalization.missing.includes("astrologyapi_credentials_not_configured"));
  assert.ok(first.personalization.missing.includes("daily_transits_require_real_provider"));
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

test("normalizes AstrologyAPI geonames place lookup results", () => {
  const places = normalizeAstrologyApiPlaceResults({
    geonames: [
      {
        place_name: "Buenos Aires",
        latitude: "-34.61315",
        longitude: "-58.37723",
        country_code: "AR",
        timezone_id: "America/Argentina/Buenos_Aires"
      }
    ]
  });

  assert.equal(places.length, 1);
  assert.equal(places[0].label, "Buenos Aires");
  assert.equal(places[0].latitude, -34.61315);
  assert.equal(places[0].longitude, -58.37723);
  assert.equal(places[0].timezone, "America/Argentina/Buenos_Aires");
});

test("builds AstrologyAPI geo_details requests with numeric maxRows", () => {
  const requests = buildPlaceLookupRequests("Buenos Aires, Argentina");

  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], { place: "Buenos Aires, Argentina", maxRows: 10 });
  assert.deepEqual(requests[1], { place: "Buenos Aires", maxRows: 10 });
  assert.equal(typeof requests[0].maxRows, "number");
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

test("omits ascendant and houses for provider charts without birth time", () => {
  const input = normalizeBirthInput({
    birthDate: "1996-01-15",
    birthTimePrecision: "unknown",
    birthPlaceLabel: "Buenos Aires, Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires"
  });

  const chart = normalizeAstrologyApiNatalChart({
    input,
    houseSystem: "placidus",
    timezoneOffset: -3,
    calculationTimeSource: "noon_fallback",
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

  assert.equal(chart.summary.accuracy, "approximate_without_birth_time");
  assert.equal(chart.summary.ascendant, null);
  assert.equal(chart.houses.length, 0);
  assert.equal(chart.placements.find((placement) => placement.key === "ascendant"), undefined);
  assert.equal(chart.placements.find((placement) => placement.key === "sun")?.house, null);
});

test("builds chart wheel data for the frontend renderer", () => {
  const chart = buildFixtureAstrologyChart();
  const wheel = buildChartWheelData(chart);

  assert.equal(wheel.version, "orbita-chart-wheel-v1");
  assert.equal(wheel.status, "ready");
  assert.equal(wheel.coordinateSystem.degreeOrigin, "aries_0");
  assert.equal(wheel.planets.some((planet) => planet.key === "sun" && planet.fullDegree === 294.4), true);
  assert.equal(wheel.houses.length, 12);
  assert.equal(wheel.angles.ascendant, 340.2);
  assert.equal(wheel.aspects.some((aspect) => aspect.type === "square" && aspect.color === "#C45B63"), true);
  assert.equal(wheel.rendererHints.drawHousesFromCusps, true);
});

test("scores value radar from harmony, stress and Saturn restrictions", () => {
  const chart = buildFixtureAstrologyChart();
  const radar = buildValueRadar(chart);
  const identity = radar.dimensions.find((dimension) => dimension.id === "identity");
  const love = radar.dimensions.find((dimension) => dimension.id === "love_creativity");
  const innerWorld = radar.dimensions.find((dimension) => dimension.id === "inner_world");

  assert.equal(radar.version, "orbita-value-radar-v1");
  assert.equal(radar.status, "ready");
  assert.ok(identity);
  assert.ok(love);
  assert.ok(innerWorld);
  assert.equal((identity?.restrictions ?? 0) > 0, true);
  assert.equal((innerWorld?.stress ?? 0) > 0, true);
  assert.equal((love?.harmony ?? 0) > 2, true);
  assert.equal(radar.formula.restrictions.includes("Saturno"), true);
});

test("adapts value radar to the Web B0 map contract", () => {
  const chart = buildFixtureAstrologyChart();
  const payload = buildWebB0ValuesMapPayload({ normalized: chart });

  assert.equal(payload.axes.length, 8);
  assert.equal(payload.topDrivers.length, 3);
  assert.equal(payload.topStressors.length, 3);
  assert.equal(payload.axes.every((axis) => axis.harmony >= 0 && axis.harmony <= 1), true);
  assert.equal(payload.axes.every((axis) => axis.tension >= 0 && axis.tension <= 1), true);
  assert.equal(payload.note.includes("diagnóstico"), true);
});

test("builds Web B0 personality reading sections from a normalized chart", () => {
  const chart = buildFixtureAstrologyChart();
  const payload = buildWebB0PersonalityReadingPayload({ normalized: chart });

  assert.equal(payload.headline.includes("Sol en capricornio"), true);
  assert.equal(payload.sections.some((section) => section.key === "sun"), true);
  assert.equal(payload.sections.some((section) => section.key === "moon"), true);
  assert.equal(payload.sections.some((section) => section.key === "ascendant"), true);
  assert.equal(JSON.stringify(payload).includes("undefined"), false);
  assert.equal(payload.disclaimer.includes("No reemplaza"), true);
});

test("builds Web B0 transit detail from daily highlighted transit payload", () => {
  const transit = normalizeAstrologyApiTransits({
    transit_relation: [
      {
        transit_planet: "Saturn",
        natal_planet: "Sun",
        aspect_type: "Square",
        start_time: "2026-07-01 00:00:00",
        exact_time: "2026-07-05 00:00:00",
        end_time: "2026-07-09 00:00:00",
        transit_sign: "Aries",
        natal_house: 1,
        is_retrograde: true
      }
    ]
  })[0];
  const payload = buildWebB0TransitDetailPayload({ transits: { highlighted: transit } }, "2026-07-05");

  assert.equal(payload.title.includes("Saturno"), true);
  assert.equal(payload.aspect.angleLabel, "90 grados");
  assert.equal(payload.scene.transitingBody.name, "saturn");
  assert.equal(payload.frequency.timeline.length, 3);
  assert.equal(payload.earth.suggestions.length, 3);
  assert.equal(JSON.stringify(payload).includes("undefined"), false);
});

test("long range timeline contract requires provider-confirmed windows", () => {
  const contract = buildLongRangeTimelineContract();

  assert.equal(contract.version, "orbita-long-range-timeline-provider-v1");
  assert.equal(contract.status, "needs_provider_endpoint");
  assert.equal(contract.gaps.includes("confirm_astrologyapi_long_range_or_forecast_endpoint"), true);
  assert.equal(contract.requiredEventFields.includes("nextOccurrence"), true);
});

test("natal interpretation Gateway plan is versioned and cacheable", () => {
  const plan = buildNatalInterpretationGatewayPlan({ model: "openai/gpt-5.4" });

  assert.equal(plan.provider, "vercel-ai-gateway");
  assert.equal(plan.promptVersion, "orbita-natal-profile-llm-v1");
  assert.equal(plan.cacheVersion, "orbita-natal-profile-cache-v1");
  assert.equal(plan.cacheTable, "natalInterpretations");
  assert.equal(plan.sections.some((section) => section.id === "values_radar"), true);
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

test("normalizes AstrologyAPI weekly transits into timeline windows", () => {
  const timeline = normalizeAstrologyApiTransitTimeline(
    {
      transit_relation: [
        {
          transit_planet: "Uranus",
          natal_planet: "Sun",
          aspect_type: "Trine",
          start_time: "2023-01-28 10:11:41",
          exact_time: "2023-01-28 13:53:38",
          end_time: "2023-01-28 17:36:39"
        },
        {
          transit_planet: "Mercury",
          natal_planet: "Ascendant",
          type: "Sextile",
          orb: 0.57,
          date: "16-6-2017"
        }
      ]
    },
    {
      source: "natal_transits_weekly",
      scope: "personal_weekly"
    }
  );

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].startTime, "2023-01-28 10:11:41");
  assert.equal(timeline[0].exactTime, "2023-01-28 13:53:38");
  assert.equal(timeline[0].endTime, "2023-01-28 17:36:39");
  assert.equal(timeline[0].windowStatus, "windowed");
  assert.equal(timeline[1].aspectType, "sextile");
  assert.equal(timeline[1].date, "2017-06-16");
  assert.equal(timeline[1].windowStatus, "dated");
});

test("AI Gateway disabled fallback does not require a generation call", async () => {
  const llm = await generateDailyHomeWithGateway({
    enabled: false,
    dailyHome: {
      header: { headline: "Base" },
      modules: { do: ["a", "b", "c"], avoid: ["d", "e", "f"] }
    },
    generateText: async () => {
      throw new Error("should not be called");
    }
  });

  assert.equal(llm.status, "disabled");
  assert.ok(llm.gaps.includes("llm_gateway_disabled"));
});

test("AI Gateway error fallback adds explicit gap and keeps three-item modules", async () => {
  const baseHome = {
    header: { headline: "Base headline" },
    modules: {
      do: ["Uno", "Dos", "Tres"],
      avoid: ["Cuatro", "Cinco", "Seis"],
      action: "Base action",
      question: "Base question"
    },
    longRead: { title: "Base", body: "Base body" },
    personalization: {},
    modelGaps: [],
    mode: "provider_real"
  };
  const error = new Error("rate limited") as Error & { statusCode?: number };
  error.statusCode = 429;
  const llm = await generateDailyHomeWithGateway({
    enabled: true,
    apiKey: "test-key",
    model: "anthropic/claude-sonnet-4.6",
    dailyHome: baseHome,
    generateText: async () => {
      throw error;
    }
  });
  const merged = mergeDailyHomeWithLlm({ dailyHome: baseHome, llm }) as any;

  assert.equal(llm.status, "error");
  assert.ok(llm.gaps.includes("ai_gateway_rate_limited"));
  assert.equal(merged.modules.do.length, 3);
  assert.equal(merged.modules.avoid.length, 3);
  assert.ok(merged.modelGaps.includes("ai_gateway_rate_limited"));
});

test("AI Gateway success parses JSON and merges Orbita copy", async () => {
  const parsed = parseLlmDailyHomeText(`{
    "headline": "Saturno pide foco sin dramatizar.",
    "subheadline": "Hoy tu carta marca una zona para mirar con calma.",
    "do": ["Bajar el tema a una accion.", "Pedir precision.", "Elegir ritmo."],
    "avoid": ["Cerrar por orgullo.", "Prometer de mas.", "Leerlo como sentencia."],
    "action": "Escribi una linea concreta.",
    "question": "Que necesita menos velocidad?",
    "longRead": { "title": "El punto activo", "body": "Un texto breve." },
    "personalizationNote": "Basado en transito destacado."
  }`);

  assert.equal(parsed?.do.length, 3);
  assert.equal(parsed?.avoid.length, 3);
  assert.equal(parsed?.headline.includes("Saturno"), true);
  assert.equal(parsed?.subheadline.includes("carta"), true);

  const merged = mergeDailyHomeWithLlm({
    dailyHome: {
      header: { headline: "Base", subheadline: "Sub base" },
      modules: { energy: "Módulo energía base" },
      longRead: {},
      personalization: {},
      modelGaps: []
    },
    llm: {
      status: "success",
      provider: "vercel-ai-gateway",
      promptVersion: "test",
      cacheVersion: "test",
      tags: [],
      user: "lab",
      warnings: [],
      gaps: [],
      generated: parsed!
    }
  }) as any;

  assert.equal(merged.header.subheadline, parsed?.subheadline);
  assert.notEqual(merged.header.subheadline, merged.modules.energy);
});

test("public lab timeline response hides provider raw payload", () => {
  const publicTimeline = buildPublicTransitTimelineResponse({
    input: {
      birthDate: "1996-11-11",
      birthTime: "10:48",
      birthTimePrecision: "known",
      birthPlaceLabel: "Buenos Aires, Argentina",
      latitude: -34.6037,
      longitude: -58.3816,
      timezone: "America/Argentina/Buenos_Aires",
      localDate: "2026-07-05"
    },
    providerResult: {
      status: "success",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-transits-v1",
      houseSystem: "placidus",
      localDate: "2026-07-05",
      warnings: [],
      normalized: {
        timeline: {
          version: "orbita-transit-timeline-v1",
          provider: "astrologyapi",
          localDate: "2026-07-05",
          events: [
            {
              id: "event-1",
              source: "natal_transits_weekly",
              scope: "personal_weekly",
              transitPlanet: "saturn",
              transitPlanetEs: "Saturno",
              natalPoint: "sun",
              natalPointEs: "Sol",
              aspectType: "square",
              aspectTypeEs: "cuadratura",
              startTime: "2026-07-01 00:00:00",
              exactTime: "2026-07-05 00:00:00",
              endTime: "2026-07-09 00:00:00",
              isRetrograde: false,
              transitSign: "Aries",
              transitSignEs: "aries",
              natalHouse: 1,
              priority: 15,
              date: "2026-07-05",
              displayText: "Saturno en cuadratura con tu Sol en casa 1.",
              windowStatus: "windowed"
            }
          ],
          providerStatus: {
            status: "success",
            endpoints: {
              "natal_transits/weekly": "success",
              "tropical_transits/weekly": "skipped",
              "tropical_transits/monthly": "skipped"
            },
            warnings: []
          },
          rawPolicy: {
            returnsProviderRaw: false,
            reason: "raw hidden"
          }
        }
      },
      raw: { shouldNotLeak: true }
    }
  }) as any;

  assert.equal(publicTimeline.timeline.events.length, 1);
  assert.equal(publicTimeline.provider.status, "success");
  assert.equal(JSON.stringify(publicTimeline).includes("shouldNotLeak"), false);
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
  assert.equal(payload.dailyReading.home.subheadline.includes("vos elegís"), true);
  assert.notEqual(payload.dailyReading.home.subheadline, payload.dailyReading.home.energy);
  assert.equal(payload.dailyReading.home.doList.length, 3);
  assert.equal(payload.dailyReading.home.avoidList.length, 3);
  assert.equal(payload.dailyReading.personalization.status, "personalizado_con_carta_y_transitos");
  assert.equal(payload.dailyReading.chartProfile.triad.length >= 2, true);
  assert.equal(payload.dailyReading.deepDive.title, "Deep Dive del día");
  assert.equal(payload.dailyReading.topics[0].oneLine, "Hoy tu deseo busca claridad antes que intensidad.");
  assert.equal(payload.dailyReading.topics[0].question, "¿Qué estás queriendo cuidar sin sobreactuar?");
  assert.equal(payload.dailyReading.topics[1].oneLine, "Si elegís bien una prioridad, se te ordena el día.");
  assert.equal(payload.dailyReading.topics[1].question, "¿Qué tarea te aliviana el resto del día?");
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

test("public lab is disabled unless explicitly enabled", () => {
  const previousEnabled = process.env.ORBITA_PUBLIC_LAB_ENABLED;
  const previousKey = process.env.ORBITA_PUBLIC_LAB_KEY;
  delete process.env.ORBITA_PUBLIC_LAB_ENABLED;
  delete process.env.ORBITA_PUBLIC_LAB_KEY;

  try {
    assert.throws(() => assertPublicLabAccess(), /Public lab is disabled/);

    process.env.ORBITA_PUBLIC_LAB_ENABLED = "true";
    assert.doesNotThrow(() => assertPublicLabAccess());

    process.env.ORBITA_PUBLIC_LAB_KEY = "lab-secret";
    assert.throws(() => assertPublicLabAccess("wrong"), /access key is invalid/);
    assert.doesNotThrow(() => assertPublicLabAccess("lab-secret"));
  } finally {
    if (previousEnabled === undefined) {
      delete process.env.ORBITA_PUBLIC_LAB_ENABLED;
    } else {
      process.env.ORBITA_PUBLIC_LAB_ENABLED = previousEnabled;
    }

    if (previousKey === undefined) {
      delete process.env.ORBITA_PUBLIC_LAB_KEY;
    } else {
      process.env.ORBITA_PUBLIC_LAB_KEY = previousKey;
    }
  }
});

test("public lab maps fallback payloads into stable Home output", () => {
  const labPayload = buildAstrologicalLabRunPayload({
    localDate: "2026-07-05",
    input: {
      birthDate: "1996-11-11",
      birthTime: "10:48",
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
      localDate: "2026-07-05",
      warnings: ["astrologyapi_credentials_not_configured"],
      raw: { shouldNotLeak: true }
    }
  }) as any;

  const publicOutput = buildPublicDailyHomeResponse({
    input: {
      displayName: "Lucas",
      birthDate: "1996-11-11",
      birthTime: "10:48",
      birthTimePrecision: "known",
      birthPlaceLabel: "Buenos Aires, Argentina",
      latitude: -34.6037,
      longitude: -58.3816,
      timezone: "America/Argentina/Buenos_Aires",
      localDate: "2026-07-05"
    },
    labPayload
  }) as any;

  assert.equal(publicOutput.header.greeting, "Hola, Lucas");
  assert.notEqual(publicOutput.header.subheadline, publicOutput.modules.energy);
  assert.equal(publicOutput.modules.do.length, 3);
  assert.equal(publicOutput.modules.avoid.length, 3);
  assert.equal(publicOutput.provider.status, "not_configured");
  assert.equal(publicOutput.mode, "demo_without_provider");
  assert.ok(publicOutput.modelGaps.includes("astrologyapi_credentials_not_configured"));
  assert.equal(JSON.stringify(publicOutput).includes("shouldNotLeak"), false);
});

test("public lab keeps unknown birth time explicit in model gaps", () => {
  const labPayload = buildAstrologicalLabRunPayload({
    localDate: "2026-07-05",
    input: {
      birthDate: "1996-11-11",
      birthTime: "10:48",
      birthTimePrecision: "unknown",
      birthPlaceLabel: "Buenos Aires, Argentina",
      timezone: "America/Argentina/Buenos_Aires"
    },
    providerResult: {
      status: "not_configured",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-v1",
      localDate: "2026-07-05",
      warnings: ["astrologyapi_credentials_not_configured"]
    }
  }) as any;

  const publicOutput = buildPublicDailyHomeResponse({
    input: {
      birthDate: "1996-11-11",
      birthTime: "10:48",
      birthTimePrecision: "unknown",
      birthPlaceLabel: "Buenos Aires, Argentina",
      timezone: "America/Argentina/Buenos_Aires",
      localDate: "2026-07-05"
    },
    labPayload
  }) as any;

  assert.equal(publicOutput.modules.do.length, 3);
  assert.equal(publicOutput.modules.avoid.length, 3);
  assert.ok(publicOutput.modelGaps.includes("unknown_birth_time_limits_ascendant_houses_and_moon_precision"));
});

test("public lab builds a complete horoscope feature map for one profile", () => {
  const input = {
    displayName: "Lucas",
    birthDate: "1996-11-11",
    birthTime: "10:48",
    birthTimePrecision: "known" as const,
    birthPlaceLabel: "Buenos Aires, Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires",
    localDate: "2026-07-05",
    runTimezone: "America/Argentina/Buenos_Aires"
  };
  const labPayload = buildAstrologicalLabRunPayload({
    localDate: input.localDate,
    input,
    providerResult: {
      status: "not_configured",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-v1",
      localDate: input.localDate,
      warnings: ["astrologyapi_credentials_not_configured"]
    }
  }) as any;
  const dailyHome = buildPublicDailyHomeResponse({ input, labPayload }) as any;
  const complete = buildCompleteHoroscopeProfile({ input, labPayload, dailyHome }) as any;

  assert.equal(complete.version, "orbita-complete-profile-preview-v1");
  assert.equal(complete.blocks.identity.length, 6);
  assert.equal(complete.blocks.natalChart.length, 7);
  assert.equal(complete.blocks.daily[0].data.do.length, 3);
  assert.equal(complete.blocks.currentSky.length, 6);
  assert.equal(complete.blocks.future.length, 4);
  assert.equal(complete.blocks.extras.length, 5);
  assert.equal(complete.blocks.extras[2].data.lifePathNumber, 11);
  assert.equal(complete.chartWheelData.status, "missing_chart");
  assert.equal(complete.valueRadar.status, "missing_chart");
  assert.equal(complete.editorialGeneration.cacheTable, "natalInterpretations");
  assert.equal(complete.longRangeTimeline.status, "needs_provider_endpoint");
  assert.equal(complete.rawPolicy.returnsProviderRaw, false);
  assert.ok(complete.nextBackendNeeds.includes("Definir proveedor LLM y versionado/cache de prompts editoriales."));
});

test("public complete horoscope uses normalized ascendant for chart ruler when provider succeeds", () => {
  const input = {
    displayName: "Mica",
    birthDate: "1996-01-15",
    birthTime: "08:30",
    birthTimePrecision: "known" as const,
    birthPlaceLabel: "Buenos Aires, Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires",
    localDate: "2026-07-05"
  };
  const chart = buildFixtureAstrologyChart();
  const labPayload = buildAstrologicalLabRunPayload({
    localDate: input.localDate,
    input,
    providerResult: {
      status: "success",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-v1",
      houseSystem: "placidus",
      localDate: input.localDate,
      warnings: [],
      normalized: { chart, transits: [] },
      raw: { fixture: true }
    }
  }) as any;
  const dailyHome = buildPublicDailyHomeResponse({ input, labPayload }) as any;
  const complete = buildCompleteHoroscopeProfile({ input, labPayload, dailyHome }) as any;
  const chartRuler = complete.blocks.identity.find((item: any) => item.id === "1.6");

  assert.equal(chartRuler.status, "ready");
  assert.equal(chartRuler.data.sign, "piscis");
  assert.equal(chartRuler.data.ruler, "Neptuno");
  assert.deepEqual(chartRuler.missing, []);
});
