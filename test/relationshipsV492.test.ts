import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { Id } from "../convex/_generated/dataModel";
import {
  buildRelationshipComparisonInputHash,
  buildRelationshipComparisonResult,
  certifyRelationshipDateChart,
  fallbackForState,
  legacyChartToHouseStructure,
  legacyChartToSignOnlyWire,
  markRelationshipComparisonStale,
  mergeCanonicalRelationshipChart,
  normalizeRelationshipIdempotencyKey,
  normalizeRelationshipPersonInput,
  refreshComparison,
  relationshipAvailableLevel,
  relationshipCivilTimeLimitation,
  relationshipDateInterval,
  relationshipDateSampleInstants,
  savePerson,
} from "../convex/relationships";
import type { EphemerisPosition } from "../convex/lib/layerContract";
import {
  RELATIONSHIP_COMPARISON_VERSION,
  RELATIONSHIP_LAYERS_VERSION,
} from "../convex/lib/relationshipLayers";

const profileId = "relationship-profile-1" as Id<"relationshipProfiles">;

type MutationRow = {
  _id: string;
  [key: string]: unknown;
};

function relationshipMutationHarness() {
  const rows = new Map<string, MutationRow[]>([
    [
      "users",
      [
        {
          _id: "user-a",
          tokenIdentifier: "token-a",
          clerkUserId: "subject-a",
          locale: "es-AR",
          createdAt: 1,
          updatedAt: 1,
        },
        {
          _id: "user-b",
          tokenIdentifier: "token-b",
          clerkUserId: "subject-b",
          locale: "es-AR",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    ],
    ["relationshipProfiles", []],
  ]);
  let nextProfileId = 1;
  let transactionTail = Promise.resolve();

  const db = {
    query(table: string) {
      return {
        withIndex(
          _index: string,
          build: (q: { eq(field: string, value: unknown): unknown }) => unknown,
        ) {
          const conditions: Array<{ field: string; value: unknown }> = [];
          const q = {
            eq(field: string, value: unknown) {
              conditions.push({ field, value });
              return q;
            },
          };
          build(q);
          const matching = () =>
            (rows.get(table) ?? []).filter((row) =>
              conditions.every(({ field, value }) => row[field] === value),
            );
          return {
            async first() {
              return matching()[0] ?? null;
            },
            async collect() {
              return matching();
            },
          };
        },
      };
    },
    async get(id: string) {
      for (const tableRows of rows.values()) {
        const row = tableRows.find((candidate) => candidate._id === id);
        if (row) return row;
      }
      return null;
    },
    async insert(table: string, value: Record<string, unknown>) {
      const id =
        table === "relationshipProfiles"
          ? `relationship-profile-${nextProfileId++}`
          : `${table}-${Date.now()}-${Math.random()}`;
      const row = { _id: id, ...value };
      rows.set(table, [...(rows.get(table) ?? []), row]);
      return id;
    },
    async patch(id: string, values: Record<string, unknown>) {
      for (const [table, tableRows] of rows) {
        const index = tableRows.findIndex((candidate) => candidate._id === id);
        if (index < 0) continue;
        const nextRows = [...tableRows];
        nextRows[index] = { ...nextRows[index], ...values };
        rows.set(table, nextRows);
        return;
      }
      throw new Error(`Missing row ${id}`);
    },
  };

  const ctxFor = (tokenIdentifier: string) => ({
    auth: {
      getUserIdentity: async () => ({ tokenIdentifier, subject: `subject-${tokenIdentifier}` }),
    },
    db,
  });

  // Convex ejecuta cada mutation como una transacción serializable. Esta cola
  // permite lanzar requests concurrentes en la prueba y reproduce el reintento
  // transaccional: la segunda ejecución observa el insert ya confirmado.
  function run(tokenIdentifier: string, args: Record<string, unknown>) {
    const transaction = transactionTail.then(() =>
      (savePerson as any)._handler(ctxFor(tokenIdentifier), args),
    );
    transactionTail = transaction.then(
      () => undefined,
      () => undefined,
    );
    return transaction;
  }

  return { rows, run };
}

const signOnlyPerson = {
  name: "Martina",
  birthTimePrecision: "unknown" as const,
  zodiacSign: "tauro",
};

function profile(updatedAt = 200) {
  return {
    profileId,
    name: "Martina",
    birthDate: "1995-04-21",
    birthTime: null,
    birthTimePrecision: "unknown" as const,
    birthPlaceLabel: null,
    latitude: null,
    longitude: null,
    timezone: null,
    zodiacSign: "taurus",
    availableLevel: "date_to_date" as const,
    createdAt: 100,
    updatedAt,
  };
}

function signChart(name: string, zodiacSign: "scorpio" | "taurus") {
  return {
    name,
    zodiacSign,
    birthTimePrecision: "unknown" as const,
    placements: [],
    houses: [],
  };
}

function dateChart(name: string, zodiacSign: "scorpio" | "taurus", shift: number) {
  const keys = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];
  return {
    name,
    zodiacSign,
    birthTimePrecision: "unknown" as const,
    placements: keys.map((key, index) => ({
      key,
      label: key,
      sign: index === 0 ? zodiacSign : null,
      longitude: (index * 41 + shift) % 360,
      longitudeSamples: key === "moon" ? [80 + shift, 86 + shift, 92 + shift] : [],
      timeStable: key !== "moon",
      house: null,
    })),
    houses: [],
  };
}

const CANONICAL_KEYS = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
] as const;

function canonicalPositions(overrides: Partial<Record<(typeof CANONICAL_KEYS)[number], number>> = {}) {
  return CANONICAL_KEYS.map((key, index) => {
    const fullDegree = overrides[key] ?? 10 + index * 31;
    return {
      key,
      label: key,
      sign: [
        "Aries",
        "Taurus",
        "Gemini",
        "Cancer",
        "Leo",
        "Virgo",
        "Libra",
        "Scorpio",
        "Sagittarius",
        "Capricorn",
        "Aquarius",
        "Pisces",
      ][Math.floor(((fullDegree % 360) + 360) % 360 / 30)]!,
      signEs: "",
      degree: ((fullDegree % 30) + 30) % 30,
      fullDegree,
      speed: key === "moon" ? 13 : 1,
      isRetrograde: false,
    } satisfies EphemerisPosition;
  });
}

function legacyNatalChart() {
  return {
    placements: CANONICAL_KEYS.map((key, index) => ({
      key,
      label: key,
      sign: "Scorpio",
      fullDegree: 220 + index,
      house: (index % 12) + 1,
    })),
    houses: Array.from({ length: 12 }, (_, index) => ({
      house: index + 1,
      degree: index * 30 + 2,
      sign: "Aries",
    })),
  } as any;
}

function calculationProfile(args?: { timezone?: string | null; zodiacSign?: string | null }) {
  return {
    name: "Martina",
    birthDate: "1995-04-21",
    birthTime: null,
    birthTimePrecision: "unknown" as const,
    birthPlaceLabel: null,
    latitude: null,
    longitude: null,
    timezone: args?.timezone ?? "UTC",
    zodiacSign: args?.zodiacSign ?? "taurus",
  };
}

function tropicalPayload(shift = 0) {
  return canonicalPositions().map((position) => ({
    name: position.key,
    full_degree: (position.fullDegree + shift) % 360,
    speed: position.speed,
    is_retro: false,
  }));
}

function legacyNatalPayload() {
  return {
    planets: canonicalPositions().map((position) => ({
      name: position.key,
      full_degree: (position.fullDegree + 180) % 360,
      speed: position.speed,
      house: 7,
      is_retro: false,
    })),
    houses: Array.from({ length: 12 }, (_, index) => ({
      house: index + 1,
      degree: index * 30 + 2,
      sign: "Aries",
    })),
  };
}

async function withAstrologyFixture<T>(
  fixtureFetch: typeof fetch,
  run: () => Promise<T>,
) {
  const previousFetch = globalThis.fetch;
  const previousUser = process.env.ASTROLOGY_API_USER_ID;
  const previousKey = process.env.ASTROLOGY_API_KEY;
  process.env.ASTROLOGY_API_USER_ID = "fixture-user";
  process.env.ASTROLOGY_API_KEY = "fixture-key";
  globalThis.fetch = fixtureFetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUser === undefined) delete process.env.ASTROLOGY_API_USER_ID;
    else process.env.ASTROLOGY_API_USER_ID = previousUser;
    if (previousKey === undefined) delete process.env.ASTROLOGY_API_KEY;
    else process.env.ASTROLOGY_API_KEY = previousKey;
  }
}

function exactRefreshState() {
  const houses = Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    degree: index * 30 + 2,
    sign: "aries",
  }));
  return {
    userId: "user-1",
    profile: {
      profileId,
      name: "Martina",
      birthDate: "1995-04-21",
      birthTime: "09:30",
      birthTimePrecision: "known" as const,
      birthPlaceLabel: "Montevideo",
      latitude: -34.9,
      longitude: -56.2,
      timezone: "UTC",
      zodiacSign: "taurus",
      availableLevel: "chart_to_chart" as const,
      createdAt: 100,
      updatedAt: 200,
    },
    personA: {
      name: "Vos",
      zodiacSign: "scorpio",
      birthTimePrecision: "known" as const,
      placements: [],
      houses: [],
    },
    ownLegacyStructure: {
      name: "Vos",
      zodiacSign: "scorpio",
      birthTimePrecision: "known" as const,
      placements: [],
      houses,
    },
    ownBirthProfile: {
      name: "Vos",
      birthDate: "1994-05-04",
      birthTime: "08:15",
      birthTimePrecision: "known" as const,
      birthPlaceLabel: "Buenos Aires",
      latitude: -34.6,
      longitude: -58.4,
      timezone: "UTC",
      zodiacSign: "scorpio",
    },
    requestedLevel: "chart_to_chart" as const,
    inputHash: "canonical-runtime-hash",
    cacheKey: "canonical-runtime-key",
    cached: null,
  };
}

describe("V4.9.2 relationship person input", () => {
  it("normaliza copy, signo y precisión sin fabricar datos", () => {
    assert.deepEqual(
      normalizeRelationshipPersonInput({
        name: "  Martina  ",
        birthDate: null,
        birthTimePrecision: "unknown",
        zodiacSign: " Piscis ",
      }),
      {
        name: "Martina",
        birthDate: null,
        birthTime: null,
        birthTimePrecision: "unknown",
        birthPlaceLabel: null,
        placeId: null,
        placeProvider: null,
        latitude: null,
        longitude: null,
        timezone: null,
        zodiacSign: "pisces",
      },
    );
  });

  it("rechaza hora exacta ausente, coordenadas incompletas y perfiles sin fecha ni signo", () => {
    assert.throws(
      () =>
        normalizeRelationshipPersonInput({
          name: "Martina",
          birthDate: "1995-04-21",
          birthTimePrecision: "known",
        }),
      /RELATIONSHIP_EXACT_TIME_REQUIRED/,
    );
    assert.throws(
      () =>
        normalizeRelationshipPersonInput({
          name: "Martina",
          birthDate: "1995-04-21",
          birthTimePrecision: "unknown",
          latitude: -34.6,
        }),
      /RELATIONSHIP_COORDINATES_INCOMPLETE/,
    );
    assert.throws(
      () => normalizeRelationshipPersonInput({ name: "Martina", birthTimePrecision: "unknown" }),
      /RELATIONSHIP_SIGN_OR_DATE_REQUIRED/,
    );
  });

  it("rechaza una hora aproximada ausente y zonas horarias que no sean IANA", () => {
    assert.throws(
      () =>
        normalizeRelationshipPersonInput({
          name: "Martina",
          birthDate: "1995-04-21",
          birthTimePrecision: "approximate",
        }),
      /RELATIONSHIP_APPROXIMATE_TIME_REQUIRED/,
    );
    assert.throws(
      () =>
        normalizeRelationshipPersonInput({
          name: "Martina",
          birthDate: "1995-04-21",
          birthTimePrecision: "unknown",
          timezone: "Buenos Aires",
        }),
      /RELATIONSHIP_TIMEZONE_INVALID/,
    );
    assert.equal(
      normalizeRelationshipPersonInput({
        name: "Martina",
        birthDate: "1995-04-21",
        birthTimePrecision: "unknown",
        timezone: "America/Argentina/Buenos_Aires",
      }).timezone,
      "America/Argentina/Buenos_Aires",
    );
  });

  it("expone el máximo nivel que permiten los datos de la persona", () => {
    assert.equal(
      relationshipAvailableLevel({
        birthDate: null,
        birthTime: null,
        birthTimePrecision: "unknown",
        latitude: null,
        longitude: null,
        timezone: null,
      }),
      "sign_to_sign",
    );
    assert.equal(
      relationshipAvailableLevel({
        birthDate: "1995-04-21",
        birthTime: null,
        birthTimePrecision: "unknown",
        latitude: null,
        longitude: null,
        timezone: null,
      }),
      "date_to_date",
    );
    assert.equal(
      relationshipAvailableLevel({
        birthDate: "1995-04-21",
        birthTime: "09:30",
        birthTimePrecision: "known",
        latitude: -34.6,
        longitude: -58.4,
        timezone: "America/Argentina/Buenos_Aires",
      }),
      "chart_to_chart",
    );
  });
});

describe("V4.9.2 relationship comparison envelope", () => {
  it("marca signo contra signo como general y nunca devuelve un score global", () => {
    const result = buildRelationshipComparisonResult({
      inputHash: "hash-signos",
      requestedLevel: "sign_to_sign",
      personA: signChart("Vos", "scorpio"),
      personB: signChart("Martina", "taurus"),
      observedAt: 1_700_000_000_000,
    });
    assert.equal(result.analysisId, "ORB-REL-002");
    assert.equal(result.status, "ready");
    assert.equal(result.data?.generalOnly, true);
    assert.equal(result.data?.resolvedLevel, "sign_to_sign");
    assert.deepEqual(result.data?.dimensions, []);
    assert.match(result.data?.disclaimer ?? "", /No mide amor/i);
    assert.match(result.data?.disclaimer ?? "", /no decide si son compatibles/i);
    assert.ok(result.sourceRefs.some((source) => source.author === "Stephen Arroyo"));
    assert.doesNotMatch(JSON.stringify(result), /globalScore|compatibilityScore|puntajeGlobal/i);
  });

  it("mantiene las cinco dimensiones separadas en fecha contra fecha", () => {
    const result = buildRelationshipComparisonResult({
      inputHash: "hash-fechas",
      requestedLevel: "date_to_date",
      personA: dateChart("Vos", "scorpio", 0),
      personB: dateChart("Martina", "taurus", 120),
      observedAt: 1_700_000_000_000,
      providerVersion: "fixture-planets-tropical-v1",
    });
    assert.ok(result.data);
    assert.equal(result.analysisId, "ORB-REL-003");
    assert.equal(result.precision, "range");
    assert.equal(result.data.resolvedLevel, "date_to_date");
    assert.deepEqual(
      result.data.dimensions.map((dimension) => dimension.key),
      ["communication", "care", "desire", "friction", "shared_project"],
    );
    assert.equal(result.data.generalOnly, false);
    assert.ok(result.data.dimensions.every((dimension) => dimension.value >= 0 && dimension.value <= 1));
    assert.doesNotMatch(JSON.stringify(result.data), /totalScore|netScore|chemistryScore/i);
  });

  it("degrada carta contra carta a fecha contra fecha y explica el faltante", () => {
    const result = buildRelationshipComparisonResult({
      inputHash: "hash-degradado",
      requestedLevel: "chart_to_chart",
      personA: dateChart("Vos", "scorpio", 0),
      personB: dateChart("Martina", "taurus", 120),
      observedAt: 1_700_000_000_000,
    });
    assert.equal(result.status, "partial");
    assert.equal(result.data?.resolvedLevel, "date_to_date");
    assert.ok(result.missingInputs.includes("exact_birth_time_and_place"));
    assert.ok(result.limitations.some((limitation) => /hora exacta/i.test(limitation)));
  });

  it("no presenta una caída del proveedor como si faltara una hora que sí fue cargada", () => {
    const result = buildRelationshipComparisonResult({
      inputHash: "hash-proveedor",
      requestedLevel: "chart_to_chart",
      personA: dateChart("Vos", "scorpio", 0),
      personB: dateChart("Martina", "taurus", 120),
      observedAt: 1_700_000_000_000,
      providerUnavailable: true,
    });
    assert.equal(result.status, "partial");
    assert.deepEqual(result.missingInputs, ["comparison_ephemeris"]);
    assert.equal(result.missingInputs.includes("exact_birth_time_and_place"), false);
  });

  it("conserva la última observación como stale si el proveedor no puede actualizar", () => {
    const ready = buildRelationshipComparisonResult({
      inputHash: "hash-stale",
      requestedLevel: "date_to_date",
      personA: dateChart("Vos", "scorpio", 0),
      personB: dateChart("Martina", "taurus", 120),
      observedAt: 1_700_000_000_000,
    });
    const stale = markRelationshipComparisonStale(ready);
    assert.equal(stale.status, "stale");
    assert.equal(stale.observedAt, ready.observedAt);
    assert.deepEqual(stale.data, ready.data);
    assert.ok(stale.limitations.some((limitation) => /última comparación/i.test(limitation)));
  });

  it("identifica el caché de forma estable y lo invalida al cambiar cualquier carta", () => {
    assert.equal(RELATIONSHIP_LAYERS_VERSION, "orbita-relationship-layers-v1");
    assert.equal(RELATIONSHIP_COMPARISON_VERSION, "orbita-relationship-comparison-v2");
    const base = buildRelationshipComparisonInputHash({
      userId: "user-1",
      profile: profile(),
      natalChartId: "chart-1",
      natalChartUpdatedAt: 300,
    });
    assert.equal(
      base,
      buildRelationshipComparisonInputHash({
        userId: "user-1",
        profile: profile(),
        natalChartId: "chart-1",
        natalChartUpdatedAt: 300,
      }),
    );
    assert.notEqual(
      base,
      buildRelationshipComparisonInputHash({
        userId: "user-1",
        profile: profile(201),
        natalChartId: "chart-1",
        natalChartUpdatedAt: 300,
      }),
    );
    assert.notEqual(
      base,
      buildRelationshipComparisonInputHash({
        userId: "user-1",
        profile: profile(),
        ownBirthDataId: "birth-1",
        ownBirthDataUpdatedAt: 301,
        natalChartId: "chart-1",
        natalChartUpdatedAt: 300,
      }),
    );
    assert.notEqual(
      base,
      buildRelationshipComparisonInputHash({
        userId: "user-1",
        profile: profile(),
        natalChartId: "chart-2",
        natalChartUpdatedAt: 300,
      }),
    );
  });
});

describe("V4.9.2 canonical relationship inputs", () => {
  it("usa Sol–Plutón canónicos y conserva del cálculo natal anterior solo las casas", () => {
    const legacy = legacyNatalChart();
    const signOnly = legacyChartToSignOnlyWire({
      chart: legacy,
      name: "Vos",
      birthTimePrecision: "known",
    });
    assert.ok(signOnly);
    assert.deepEqual(signOnly.placements, []);
    assert.deepEqual(signOnly.houses, []);

    const structure = legacyChartToHouseStructure({
      chart: legacy,
      name: "Vos",
      zodiacSign: "scorpio",
      birthTimePrecision: "known",
    });
    const canonical = canonicalPositions({ sun: 12, moon: 42, mercury: 72 });
    const merged = mergeCanonicalRelationshipChart({
      canonicalPositions: canonical,
      legacyStructure: structure,
      name: "Vos",
      birthTimePrecision: "known",
    });
    assert.ok(merged);
    assert.equal(merged.houses.length, 12);
    assert.deepEqual(
      merged.placements.map((placement) => placement.longitude),
      canonical.map((position) => position.fullDegree),
    );
    assert.equal(merged.placements.some((placement) => placement.longitude === 220), false);
    assert.ok(merged.placements.every((placement) => placement.house === null));
  });

  it("si faltan posiciones canónicas no rescata ningún planeta del payload anterior", () => {
    const structure = legacyChartToHouseStructure({
      chart: legacyNatalChart(),
      name: "Vos",
      zodiacSign: "scorpio",
      birthTimePrecision: "known",
    });
    assert.equal(
      mergeCanonicalRelationshipChart({
        canonicalPositions: null,
        legacyStructure: structure,
        name: "Vos",
        birthTimePrecision: "known",
      }),
      null,
    );
    assert.equal(
      mergeCanonicalRelationshipChart({
        canonicalPositions: canonicalPositions().slice(0, 9),
        legacyStructure: structure,
        name: "Vos",
        birthTimePrecision: "known",
      }),
      null,
    );
  });

  it("una cota conservadora impide certificar un cruce posible entre muestras", () => {
    const interval = relationshipDateInterval({ birthDate: "1995-04-21", timezone: "UTC" });
    assert.ok(interval);
    const instants = relationshipDateSampleInstants(interval);
    assert.ok(instants.length > 6);
    const chart = certifyRelationshipDateChart({
      profile: calculationProfile(),
      interval,
      samples: instants.map((instantMs) => ({
        instantMs,
        positions: canonicalPositions({ moon: 29.8 }),
      })),
    });
    assert.ok(chart);
    const moon = chart.placements.find((placement) => placement.key === "moon");
    assert.ok(moon);
    assert.equal(moon.timeStable, false);
    assert.ok(moon.longitudeSamples.some((degree) => degree < 30));
    assert.ok(moon.longitudeSamples.some((degree) => degree > 30));
  });

  it("no certifica una malla con un hueco capaz de ocultar un cruce", () => {
    const interval = relationshipDateInterval({ birthDate: "1995-04-21", timezone: "UTC" });
    assert.ok(interval);
    const instants = relationshipDateSampleInstants(interval);
    const sparse = instants.filter((_, index) => index !== 2);
    assert.equal(
      certifyRelationshipDateChart({
        profile: calculationProfile(),
        interval,
        samples: sparse.map((instantMs) => ({
          instantMs,
          positions: canonicalPositions(),
        })),
      }),
      null,
    );
  });

  it("sin zona horaria cubre la ventana civil global y lo explica sin tomar UTC como lugar natal", () => {
    const interval = relationshipDateInterval({ birthDate: "1995-04-21", timezone: null });
    assert.ok(interval);
    assert.equal(interval.kind, "global_possible_window");
    assert.equal(new Date(interval.startMs).toISOString(), "1995-04-20T06:00:00.000Z");
    assert.equal(new Date(interval.endMsExclusive).toISOString(), "1995-04-22T18:00:00.000Z");
    assert.equal(interval.endMsExclusive - interval.startMs, 60 * 60 * 60 * 1000);
    assert.match(interval.limitation, /toda la franja posible/i);
    assert.doesNotMatch(interval.limitation, /UTC|proveedor|efeméride|DST/i);
  });

  it("el refresh de nivel 3 usa planets/tropical para ambas personas aunque la carta de casas discrepe", async () => {
    const urls: string[] = [];
    await withAstrologyFixture(
      (async (input) => {
        const url = String(input);
        urls.push(url);
        const body = url.endsWith("/planets/tropical")
          ? tropicalPayload(0)
          : legacyNatalPayload();
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch,
      async () => {
        const state = exactRefreshState();
        const result = await (refreshComparison as any)._handler(
          {
            auth: {
              getUserIdentity: async () => ({ tokenIdentifier: "fixture-token" }),
            },
            runQuery: async () => state,
            runMutation: async (_reference: unknown, args: { result: unknown }) => args.result,
          },
          { profileId },
        );
        assert.equal(result.data?.resolvedLevel, "chart_to_chart");
        assert.equal(result.providerVersion, "astrologyapi-planets-tropical-v1");
        assert.match(result.data?.summary ?? "", /Aries/i);
        // El anclaje se movió con el copy canónico V4.9.2 —la oración pasó a
        // segunda persona: `Su X forma una conjunción con tu Y, un contacto de
        // 0°`— y de paso se reforzó: antes bastaba con nombrar el aspecto y el
        // ángulo en cualquier orden; ahora también fija la voz del canon.
        assert.ok(
          result.data?.dimensions.some((dimension: any) =>
            dimension.drivers.some((driver: string) =>
              /Su \S+ forma una conjunción con tu \S+, un contacto de 0°/i.test(driver),
            ),
          ),
        );
      },
    );
    assert.equal(urls.filter((url) => url.endsWith("/planets/tropical")).length, 2);
    assert.equal(urls.filter((url) => url.endsWith("/western_horoscope")).length, 1);
  });

  it("si falla el cálculo canónico el refresh conserva como máximo el estilo solar general", async () => {
    const previousUser = process.env.ASTROLOGY_API_USER_ID;
    const previousKey = process.env.ASTROLOGY_API_KEY;
    delete process.env.ASTROLOGY_API_USER_ID;
    delete process.env.ASTROLOGY_API_KEY;
    try {
      const state = {
        ...exactRefreshState(),
        profile: {
          ...exactRefreshState().profile,
          birthTime: null,
          birthTimePrecision: "unknown" as const,
          latitude: null,
          longitude: null,
          timezone: null,
          availableLevel: "date_to_date" as const,
        },
        requestedLevel: "date_to_date" as const,
      };
      const result = await (refreshComparison as any)._handler(
        {
          auth: {
            getUserIdentity: async () => ({ tokenIdentifier: "fixture-token" }),
          },
          runQuery: async () => state,
          runMutation: async (_reference: unknown, args: { result: unknown }) => args.result,
        },
        { profileId },
      );
      assert.equal(result.status, "partial");
      assert.equal(result.data?.resolvedLevel, "sign_to_sign");
      assert.equal(result.data?.generalOnly, true);
      assert.deepEqual(result.data?.dimensions, []);
    } finally {
      if (previousUser === undefined) delete process.env.ASTROLOGY_API_USER_ID;
      else process.env.ASTROLOGY_API_USER_ID = previousUser;
      if (previousKey === undefined) delete process.env.ASTROLOGY_API_KEY;
      else process.env.ASTROLOGY_API_KEY = previousKey;
    }
  });

  it("una caída del proveedor no culpa a una persona que ya cargó fecha, hora y lugar", async () => {
    const previousUser = process.env.ASTROLOGY_API_USER_ID;
    const previousKey = process.env.ASTROLOGY_API_KEY;
    delete process.env.ASTROLOGY_API_USER_ID;
    delete process.env.ASTROLOGY_API_KEY;
    try {
      const baseline = exactRefreshState();
      const state = {
        ...baseline,
        profile: { ...baseline.profile, zodiacSign: null },
      };
      const result = await (refreshComparison as any)._handler(
        {
          auth: {
            getUserIdentity: async () => ({ tokenIdentifier: "fixture-token" }),
          },
          runQuery: async () => state,
          runMutation: async (_reference: unknown, args: { result: unknown }) => args.result,
        },
        { profileId },
      );

      assert.equal(result.data, null);
      assert.deepEqual(result.missingInputs, ["comparison_ephemeris"]);
      assert.equal(result.missingInputs.includes("other_sun_sign"), false);
      assert.match(result.limitations.join(" "), /no se pudo completar|no pudimos traer/i);
    } finally {
      if (previousUser === undefined) delete process.env.ASTROLOGY_API_USER_ID;
      else process.env.ASTROLOGY_API_USER_ID = previousUser;
      if (previousKey === undefined) delete process.env.ASTROLOGY_API_KEY;
      else process.env.ASTROLOGY_API_KEY = previousKey;
    }
  });

  it("un perfil realmente sin fecha ni signo conserva el faltante de esa persona", () => {
    const baseline = exactRefreshState();
    const result = fallbackForState(
      {
        ...baseline,
        profile: {
          ...baseline.profile,
          birthDate: null,
          birthTime: null,
          birthTimePrecision: "unknown",
          birthPlaceLabel: null,
          latitude: null,
          longitude: null,
          timezone: null,
          zodiacSign: null,
          availableLevel: "sign_to_sign",
        },
        requestedLevel: "sign_to_sign",
      } as any,
      1_700_000_000_000,
    );

    assert.deepEqual(result.missingInputs, ["other_sun_sign"]);
    assert.equal(result.missingInputs.includes("comparison_ephemeris"), false);
  });
});

describe("V4.9.2 relationship civil-time degradation", () => {
  it("explica una hora inexistente sin presentarla como exacta", () => {
    const limitation = relationshipCivilTimeLimitation(
      { status: "gap", candidates: [] },
      "other_birth",
    );
    assert.match(limitation, /no existió/i);
    assert.match(limitation, /nivel por fecha/i);
    assert.doesNotMatch(limitation, /DST|proveedor|efeméride/i);
  });

  it("explica una hora repetida y pide un instante único", () => {
    const limitation = relationshipCivilTimeLimitation(
      {
        status: "fold",
        candidates: [
          { instantMs: 1, offsetMinutes: -240 },
          { instantMs: 2, offsetMinutes: -300 },
        ],
      },
      "own_birth",
    );
    assert.match(limitation, /ocurrió dos veces/i);
    assert.match(limitation, /no hay un instante único/i);
    assert.doesNotMatch(limitation, /DST|proveedor|efeméride/i);
  });
});

describe("V4.9.2 idempotent relationship person creation", () => {
  it("normaliza claves opacas acotadas y rechaza valores ambiguos", () => {
    assert.equal(
      normalizeRelationshipIdempotencyKey("  ios.create:550e8400-e29b-41d4-a716-446655440000  "),
      "ios.create:550e8400-e29b-41d4-a716-446655440000",
    );
    assert.throws(
      () => normalizeRelationshipIdempotencyKey(""),
      /RELATIONSHIP_REQUEST_KEY_INVALID/,
    );
    assert.throws(
      () => normalizeRelationshipIdempotencyKey("incluye espacios"),
      /RELATIONSHIP_REQUEST_KEY_INVALID/,
    );
    assert.throws(
      () => normalizeRelationshipIdempotencyKey(`x${"a".repeat(128)}`),
      /RELATIONSHIP_REQUEST_KEY_INVALID/,
    );
  });

  it("dos requests concurrentes con la misma clave devuelven el mismo profileId", async () => {
    const harness = relationshipMutationHarness();
    const args = {
      ...signOnlyPerson,
      idempotencyKey: "ios.create:550e8400-e29b-41d4-a716-446655440000",
    };

    const [first, retry] = await Promise.all([
      harness.run("token-a", args),
      harness.run("token-a", args),
    ]);

    assert.equal(first.profileId, retry.profileId);
    assert.equal(harness.rows.get("relationshipProfiles")?.length, 1);
    assert.equal("creationRequestKey" in first, false, "la clave privada no debe salir por API");
  });

  it("un retry tardío es estable y reutilizar la clave con otros datos falla cerrado", async () => {
    const harness = relationshipMutationHarness();
    const idempotencyKey = "ios.create:9b0c0316-ccdb-4f0e-b7fa-17750737dd89";
    const first = await harness.run("token-a", { ...signOnlyPerson, idempotencyKey });
    const retry = await harness.run("token-a", { ...signOnlyPerson, idempotencyKey });

    assert.equal(retry.profileId, first.profileId);
    await assert.rejects(
      harness.run("token-a", { ...signOnlyPerson, name: "Otra persona", idempotencyKey }),
      /RELATIONSHIP_REQUEST_KEY_CONFLICT/,
    );
    assert.equal(harness.rows.get("relationshipProfiles")?.length, 1);
  });

  it("claves distintas permiten guardar dos personas intencionalmente iguales", async () => {
    const harness = relationshipMutationHarness();
    const [first, second] = await Promise.all([
      harness.run("token-a", { ...signOnlyPerson, idempotencyKey: "ios.create:intent-0001" }),
      harness.run("token-a", { ...signOnlyPerson, idempotencyKey: "ios.create:intent-0002" }),
    ]);

    assert.notEqual(first.profileId, second.profileId);
    const profiles = harness.rows.get("relationshipProfiles") ?? [];
    assert.equal(profiles.length, 2);
    assert.equal(profiles.filter((row) => row.isActive === true).length, 1);
  });

  it("acota la clave por usuario y mantiene la autorización de profileId", async () => {
    const harness = relationshipMutationHarness();
    const idempotencyKey = "ios.create:shared-key-0001";
    const ownerProfile = await harness.run("token-a", {
      ...signOnlyPerson,
      name: "Persona de A",
      idempotencyKey,
    });
    const otherProfile = await harness.run("token-b", {
      ...signOnlyPerson,
      name: "Persona de B",
      idempotencyKey,
    });

    assert.notEqual(ownerProfile.profileId, otherProfile.profileId);
    assert.equal(ownerProfile.name, "Persona de A");
    assert.equal(otherProfile.name, "Persona de B");
    await assert.rejects(
      harness.run("token-b", {
        ...signOnlyPerson,
        profileId: ownerProfile.profileId,
        idempotencyKey: "ios.update:owner-check-0001",
        name: "Intento ajeno",
      }),
      /RELATIONSHIP_PROFILE_NOT_FOUND/,
    );
  });
});

describe("V4.9.2 Convex relationship API contract", () => {
  const source = readFileSync(join(process.cwd(), "convex/relationships.ts"), "utf8");

  it("conserva la API legacy y agrega las cinco funciones públicas cerradas", () => {
    for (const name of [
      "getActive",
      "upsert",
      "list",
      "savePerson",
      "removePerson",
      "getComparison",
      "refreshComparison",
    ]) {
      assert.match(source, new RegExp(`export const ${name} =`));
    }
    for (const name of ["list", "savePerson", "removePerson", "getComparison", "refreshComparison"]) {
      const start = source.indexOf(`export const ${name} =`);
      const next = source.indexOf("\nexport const ", start + 1);
      const block = source.slice(start, next < 0 ? undefined : next);
      assert.match(block, /args:/, `${name} debe validar args`);
      assert.match(block, /returns:/, `${name} debe validar returns`);
      assert.doesNotMatch(block, /v\.any\(/, `${name} no puede abrir el contrato con v.any`);
    }
  });

  it("no usa anyApi, autoriza profileId y persiste un caché idempotente", () => {
    assert.doesNotMatch(source, /anyApi/);
    assert.match(source, /profile\.userId === userId/);
    assert.match(source, /relationshipComparisonCachesV492/);
    assert.match(source, /withIndex\("by_cache_key"/);
    assert.match(source, /RELATIONSHIP_INPUT_CHANGED_DURING_REFRESH/);
  });

  it("persiste la idempotencia de creación con una clave privada acotada al usuario", () => {
    const schema = readFileSync(join(process.cwd(), "convex/schema.ts"), "utf8");
    assert.match(source, /idempotencyKey: v\.string\(\)/);
    assert.match(source, /withIndex\("by_user_creation_request_key"/);
    assert.match(source, /q\.eq\("userId", user\._id\)\.eq\("creationRequestKey", creationRequestKey\)/);
    assert.match(source, /RELATIONSHIP_REQUEST_KEY_CONFLICT/);
    assert.match(schema, /creationRequestKey: v\.optional\(v\.string\(\)\)/);
    assert.match(
      schema,
      /\.index\("by_user_creation_request_key", \["userId", "creationRequestKey"\]\)/,
    );
    assert.doesNotMatch(
      source.slice(source.indexOf("function toPublicProfile"), source.indexOf("function ownBirthProfile")),
      /creationRequestKey/,
      "la clave no puede filtrarse en relationshipProfileValidator",
    );
  });

  it("evalúa el día completo de forma conservadora y conserva un perfil activo para clientes legacy", () => {
    assert.match(source, /RELATIONSHIP_DATE_SAMPLE_STEP_MS = 4 \* 60 \* 60 \* 1000/);
    assert.match(source, /MAX_DAILY_MOVEMENT_DEGREES/);
    assert.match(source, /relationshipDateSampleInstants\(interval\)/);
    assert.match(source, /longitudeSamples: candidates/);
    assert.doesNotMatch(source, /\["00:00", "12:00", "23:59"\]\.map/);
    assert.match(source, /if \(profile\.isActive\)[\s\S]*?isActive: true/);
    assert.match(source, /ownPrimaryAttempt[\s\S]*?dateChartForProfile\(state\.ownBirthProfile/);
  });

  it("versiona e invoca las posiciones tropicales canónicas para ambas personas", () => {
    assert.match(source, /canonicalPositionsVersion: RELATIONSHIP_CANONICAL_POSITIONS_VERSION/);
    assert.match(source, /canonicalProviderVersion: RELATIONSHIP_TROPICAL_PROVIDER_VERSION/);
    assert.match(source, /dateRangeMethod: \{[\s\S]*?version: RELATIONSHIP_DATE_RANGE_VERSION/);
    assert.match(source, /maxDailyMovementDegrees: MAX_DAILY_MOVEMENT_DEGREES/);
    assert.match(source, /runAstrologyApiPlanetsTropical\(\{/);
    assert.match(source, /mergeCanonicalRelationshipChart\(\{/);
    assert.match(source, /personA: ownCalculated\.personB/);
    assert.doesNotMatch(source, /personA: ownCalculated\?\.personB \?\? state\.personA/);
  });

  it("rechaza horas inexistentes o repetidas y usa el desplazamiento verificado", () => {
    assert.match(source, /primaryAttempt\.civilTimeUnresolved/);
    assert.match(source, /exactCivilTimeUnresolved/);
    assert.match(source, /timezone: String\(civilTime\.offsetMinutes \/ 60\)/);
    assert.doesNotMatch(source, /function zonedCivilInstant/);
  });
});
