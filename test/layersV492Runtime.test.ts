import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNatalAnalysisInputHash,
  buildLayerRefreshInputFingerprint,
  getForDate,
  persistRefresh,
  refreshForDate,
} from "../convex/layers";
import { getAnalysisDefinition, getSourceRefs, type AnalysisId } from "../convex/content/astrologySources";
import { ASTROLOGY_EDITORIAL_COPY_VERSION } from "../convex/lib/layerAssembly";
import type {
  AnalysisData,
  AnalysisResult,
  BirthDataSnapshot,
  EphemerisPosition,
  NormalizedChartSnapshot,
} from "../convex/lib/layerContract";
import { stableInputHash } from "../convex/lib/stableHash";
import { resolveZonedCivilTime } from "../convex/lib/civilTime";

const NATAL_EPHEMERIS_METHOD_VERSION = "natal-ephemeris-planets-tropical-cache-v1";
const NATAL_EPHEMERIS_PROVIDER_VERSION = "astrologyapi-planets-tropical-v1";

const PLANETS = [
  ["sun", "Sol"],
  ["moon", "Luna"],
  ["mercury", "Mercurio"],
  ["venus", "Venus"],
  ["mars", "Marte"],
  ["jupiter", "Júpiter"],
  ["saturn", "Saturno"],
  ["uranus", "Urano"],
  ["neptune", "Neptuno"],
  ["pluto", "Plutón"],
] as const;

function localDateIn(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function chartSnapshot(precision: BirthDataSnapshot["birthTimePrecision"]): NormalizedChartSnapshot {
  return {
    placements: [
      ...PLANETS.map(([key, label], index) => ({
        key,
        label,
        sign: index === 0 ? "Aries" : "Taurus",
        signEs: index === 0 ? "Aries" : "Tauro",
        degree: index === 0 ? 0 : 5,
        fullDegree: index === 0 ? 0 : 35 + index * 17,
        house: precision === "known" ? ((index % 12) + 1) : null,
        isRetrograde: false,
      })),
      {
        key: "ascendant",
        label: "Ascendente",
        sign: "Aquarius",
        signEs: "Acuario",
        degree: 5,
        fullDegree: 305,
        house: precision === "known" ? 1 : null,
        isRetrograde: false,
      },
    ],
    houses: [],
  };
}

function skyPositions(): EphemerisPosition[] {
  return PLANETS.map(([key, label], index) => ({
    key,
    label,
    sign: index === 0 ? "Aries" : "Gemini",
    signEs: index === 0 ? "Aries" : "Géminis",
    degree: index === 0 ? 0 : 5,
    fullDegree: index === 0 ? 0 : 65 + index * 19,
    speed: index === 0 ? 1 : Math.max(0.01, 13 - index),
    isRetrograde: false,
  }));
}

function instantFor(birthData: BirthDataSnapshot, time: string) {
  const resolved = resolveZonedCivilTime({
    localDate: birthData.birthDate,
    localTime: time,
    timezone: birthData.timezone,
  });
  assert.equal(resolved.status, "exact");
  return resolved.instantMs;
}

function natalInputHash(birthData: BirthDataSnapshot | null) {
  if (!birthData) {
    return stableInputHash({ methodVersion: NATAL_EPHEMERIS_METHOD_VERSION, birth: null });
  }
  return stableInputHash({
    methodVersion: NATAL_EPHEMERIS_METHOD_VERSION,
    providerVersion: NATAL_EPHEMERIS_PROVIDER_VERSION,
    birth: {
      birthDate: birthData.birthDate,
      birthTime: birthData.birthTime,
      birthTimePrecision: birthData.birthTimePrecision,
      latitude: birthData.latitude,
      longitude: birthData.longitude,
      timezone: birthData.timezone,
      updatedAt: birthData.updatedAt,
    },
  });
}

function natalCache(
  birthData: BirthDataSnapshot,
  positions: EphemerisPosition[] = skyPositions(),
) {
  const times =
    birthData.birthTimePrecision === "known"
      ? [birthData.birthTime!]
      : ["00:00", "12:00", "23:59"];
  return {
    inputHash: natalInputHash(birthData),
    methodVersion: NATAL_EPHEMERIS_METHOD_VERSION,
    providerVersion: NATAL_EPHEMERIS_PROVIDER_VERSION,
    birthTimePrecision: birthData.birthTimePrecision,
    samples: times.map((time) => ({ instantMs: instantFor(birthData, time), positions })),
    calculatedAt: Date.now(),
  };
}

function verifiedGeometry(
  birthData: BirthDataSnapshot | null,
  chart: NormalizedChartSnapshot | null,
) {
  if (!birthData || birthData.birthTimePrecision !== "known" || !chart) return null;
  const angles = chart.placements.filter((placement) => placement.key === "ascendant");
  return angles.length > 0 ? { placements: angles, houses: [] } : null;
}

function baseHash(
  birthData: BirthDataSnapshot | null,
  chart: NormalizedChartSnapshot | null,
  cache: ReturnType<typeof natalCache> | null = null,
) {
  return stableInputHash({
    identityVersion: "canonical-natal-base-v1",
    natalInputHash: natalInputHash(birthData),
    canonicalEphemeris: cache
      ? {
          inputHash: cache.inputHash,
          methodVersion: cache.methodVersion,
          providerVersion: cache.providerVersion,
          sampleFingerprint: stableInputHash(cache.samples),
        }
      : null,
    exactHouseGeometry: verifiedGeometry(birthData, chart),
  });
}

function resultHash(base: string, analysisId: AnalysisId, scope: Record<string, unknown> | null = null) {
  return stableInputHash({
    baseHash: base,
    analysisId,
    methodVersion: getAnalysisDefinition(analysisId).methodVersion,
    scope,
  });
}

test("ORB-NAT-001 invalida el caché previo al cambiar la versión editorial", () => {
  const base = "canonical-natal-base";
  const legacyElementMapHash = resultHash(base, "ORB-NAT-001");
  const previousEditorialHash = resultHash(base, "ORB-NAT-001", {
    editorialCopyVersion: "orbita-v492-copy-clarity-v1",
  });
  const currentElementMapHash = buildNatalAnalysisInputHash(base, "ORB-NAT-001");

  assert.notEqual(currentElementMapHash, legacyElementMapHash);
  assert.notEqual(currentElementMapHash, previousEditorialHash);
  assert.equal(
    currentElementMapHash,
    resultHash(base, "ORB-NAT-001", {
      editorialCopyVersion: ASTROLOGY_EDITORIAL_COPY_VERSION,
    }),
  );
  assert.equal(
    buildNatalAnalysisInputHash(base, "ORB-LUN-001"),
    resultHash(base, "ORB-LUN-001"),
    "el tipo lunar conserva su identidad de caché",
  );
  assert.equal(
    buildNatalAnalysisInputHash(base, "ORB-REL-001"),
    resultHash(base, "ORB-REL-001"),
    "el patrón vincular natal conserva su identidad de caché",
  );
});

function result(args: {
  analysisId: AnalysisId;
  inputHash: string;
  status: AnalysisResult["status"];
  precision: AnalysisResult["precision"];
  observedAt: number;
  validUntil: number | null;
  data: AnalysisData | null;
}): AnalysisResult {
  const definition = getAnalysisDefinition(args.analysisId);
  return {
    ...args,
    methodVersion: definition.methodVersion,
    missingInputs: [],
    limitations: [],
    elaboration: definition.elaboration,
    sourceRefs: getSourceRefs(args.analysisId),
  };
}

function cumplelunaData(args: {
  previousExactAt: number;
  nextExactAt: number;
  cycleDay: number;
  daysRemaining: number;
}) {
  const cycleLengthDays = (args.nextExactAt - args.previousExactAt) / 86_400_000;
  return {
    kind: "cumpleluna" as const,
    natalElongationDegrees: 68,
    currentElongationDegrees: 210,
    previousExactAt: args.previousExactAt,
    nextExactAt: args.nextExactAt,
    daysRemaining: args.daysRemaining,
    cycleDay: args.cycleDay,
    cycleLengthDays,
    progress: args.cycleDay / cycleLengthDays,
    summary: "La distancia natal Sol–Luna vuelve a repetirse al final de este ritmo personal.",
  };
}

async function withoutAstrologyCredentials<T>(run: () => Promise<T>) {
  const keys = ["ASTROLOGY_API_USER_ID", "ASTROLOGY_API_KEY"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  try {
    return await run();
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function actionContext(state: Record<string, unknown>) {
  const persisted: unknown[] = [];
  return {
    persisted,
    ctx: {
      auth: { getUserIdentity: async () => ({ tokenIdentifier: "test-token" }) },
      runQuery: async () => state,
      runMutation: async (_reference: unknown, value: unknown) => {
        persisted.push(value);
        return { written: 10 };
      },
    },
  };
}

test("las APIs públicas rechazan fechas civiles imposibles antes de leer datos", async () => {
  await assert.rejects(
    () => (getForDate as any)._handler({}, { localDate: "2026-02-31", timezone: "UTC" }),
    /real date/,
  );
  await assert.rejects(
    () => (refreshForDate as any)._handler({}, { localDate: "2025-13-01", timezone: "UTC" }),
    /real date/,
  );
});

test("persistRefresh rechaza una edición natal ocurrida mientras el cálculo estaba en vuelo", async () => {
  const originalBirthData: BirthDataSnapshot = {
    birthDate: "1994-05-04",
    birthTime: "08:37",
    birthTimePrecision: "known",
    birthPlaceLabel: "Buenos Aires",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires",
    updatedAt: 10,
  };
  const currentBirthDocument = {
    _id: "birth-fixture",
    userId: "user-fixture",
    ...originalBirthData,
    birthTime: "09:12",
    updatedAt: 11,
  };
  const writes: unknown[] = [];
  const ctx = {
    db: {
      async get(id: string) {
        if (id === "user-fixture") return { _id: id };
        if (id === "birth-fixture") return currentBirthDocument;
        return null;
      },
      query(table: string) {
        const chain = {
          withIndex(_name: string, callback: (value: { eq: () => unknown }) => unknown) {
            callback({ eq: () => chain });
            return chain;
          },
          order() {
            return chain;
          },
          async first() {
            if (table === "birthData") return currentBirthDocument;
            return null;
          },
        };
        return chain;
      },
      async patch(...args: unknown[]) {
        writes.push(["patch", ...args]);
      },
      async insert(...args: unknown[]) {
        writes.push(["insert", ...args]);
      },
    },
  };
  const staleFingerprint = buildLayerRefreshInputFingerprint({
    userId: "user-fixture",
    birthDataId: "birth-fixture",
    natalChartId: null,
    birthData: originalBirthData,
    chart: null,
  });
  const mutationArgs = {
    userId: "user-fixture",
    birthDataId: "birth-fixture",
    natalChartId: null,
    expectedInputFingerprint: staleFingerprint,
    localDate: "2026-08-15",
    timezone: "UTC",
    results: [],
    sky: null,
    natalEphemeris: null,
  };

  await assert.rejects(
    () => (persistRefresh as any)._handler(ctx, mutationArgs),
    /LAYER_INPUT_CHANGED_DURING_REFRESH/,
  );
  assert.equal(writes.length, 0, "la mutación no debe escribir nada con inputs obsoletos");

  const currentFingerprint = buildLayerRefreshInputFingerprint({
    userId: "user-fixture",
    birthDataId: "birth-fixture",
    natalChartId: null,
    birthData: currentBirthDocument,
    chart: null,
  });
  assert.deepEqual(
    await (persistRefresh as any)._handler(ctx, {
      ...mutationArgs,
      expectedInputFingerprint: currentFingerprint,
    }),
    { written: 0 },
  );
});

test("un error vencido vuelve a calcularse y el último ranking se degrada a stale si falla el proveedor", async () => {
  await withoutAstrologyCredentials(async () => {
    const localDate = localDateIn("UTC");
    const now = Date.now();
    const identity = baseHash(null, null);
    const dailyScope = { localDate, timezone: "UTC" };
    const cachedRanking = result({
      analysisId: "ORB-TRN-002",
      inputHash: resultHash(identity, "ORB-TRN-002", dailyScope),
      status: "ready",
      precision: "exact",
      observedAt: now - 2 * 60 * 60 * 1000,
      validUntil: now - 60 * 60 * 1000,
      data: {
        kind: "transit_ranking",
        items: [],
        activeCount: 0,
        calculatedAt: now - 2 * 60 * 60 * 1000,
        summary: "Último ranking real.",
      },
    });
    const expiredProgressionError = result({
      analysisId: "ORB-CYC-002",
      inputHash: resultHash(identity, "ORB-CYC-002"),
      status: "error",
      precision: "not_applicable",
      observedAt: now - 2 * 60 * 60 * 1000,
      validUntil: now - 60 * 60 * 1000,
      data: null,
    });
    const { ctx } = actionContext({
      userId: "user-test",
      birthDataId: null,
      natalChartId: null,
      birthData: null,
      chart: null,
      natalEphemeris: null,
      snapshots: [cachedRanking, expiredProgressionError],
      sky: null,
    });
    const bundle = await (refreshForDate as any)._handler(ctx, { localDate, timezone: "UTC" });

    assert.equal(bundle.today.transitRanking.status, "stale");
    assert.equal(bundle.today.transitRanking.data?.summary, "Último ranking real.");
    assert.equal(bundle.moment.progressedLunation.status, "needs_birth_time");
    assert.equal(bundle.moment.progressedLunation.validUntil, null);
  });
});

test("sin hora ni muestras del día completo no filtra el mediodía al mapa, patrón ni ranking", async () => {
  await withoutAstrologyCredentials(async () => {
    const localDate = localDateIn("UTC");
    const now = Date.now();
    const birthData: BirthDataSnapshot = {
      birthDate: "1994-05-04",
      birthTime: null,
      birthTimePrecision: "unknown",
      birthPlaceLabel: "Buenos Aires",
      latitude: -34.6037,
      longitude: -58.3816,
      timezone: "America/Argentina/Buenos_Aires",
      updatedAt: 1,
    };
    const { ctx } = actionContext({
      userId: "user-test",
      birthDataId: "birth-test",
      natalChartId: "chart-test",
      birthData,
      chart: chartSnapshot("unknown"),
      natalEphemeris: null,
      snapshots: [],
      sky: {
        providerVersion: "fixture-sky-v1",
        observedAt: now,
        validUntil: now + 10 * 60 * 1000,
        positions: skyPositions(),
      },
    });
    const bundle = await (refreshForDate as any)._handler(ctx, { localDate, timezone: "UTC" });

    assert.equal(bundle.natal.elementMap.data, null);
    assert.equal(bundle.natal.elementMap.precision, "not_applicable");
    assert.equal(bundle.natal.elementMap.status, "error");
    assert.ok(bundle.natal.elementMap.missingInputs.includes("canonical_natal_ephemeris"));
    assert.equal(bundle.natal.relationshipPattern.data, null);
    assert.equal(bundle.today.transitRanking.status, "unavailable");
    assert.ok(bundle.natal.lunarType.missingInputs.includes("canonical_natal_ephemeris"));
    assert.equal(bundle.today.cumpleluna.status, "partial");
    assert.equal(bundle.today.cumpleluna.precision, "range");
    assert.equal(bundle.today.cumpleluna.data, null);
    assert.ok(bundle.today.cumpleluna.missingInputs.includes("full_day_natal_samples"));
  });
});

test("Cumpleluna no rescata una fecha cacheada si el intervalo natal cruza el ciclo", async () => {
  await withoutAstrologyCredentials(async () => {
    const localDate = localDateIn("UTC");
    const now = Date.now();
    const birthData: BirthDataSnapshot = {
      birthDate: "1994-05-04",
      birthTime: null,
      birthTimePrecision: "unknown",
      birthPlaceLabel: "Buenos Aires",
      latitude: -34.6037,
      longitude: -58.3816,
      timezone: "America/Argentina/Buenos_Aires",
      updatedAt: 41,
    };
    const chart = chartSnapshot("unknown");
    const natalEphemeris = natalCache(birthData);
    natalEphemeris.samples = natalEphemeris.samples.map((sample, index) => ({
      ...sample,
      positions: sample.positions.map((placement) =>
        placement.key === "sun"
          ? { ...placement, fullDegree: 0, degree: 0, speed: 1 }
          : placement.key === "moon"
            ? {
                ...placement,
                fullDegree: [354, 0, 6][index],
                degree: [24, 0, 6][index],
                speed: 13,
              }
            : placement,
      ),
    }));
    const identity = baseHash(birthData, chart, natalEphemeris);
    const cachedCumpleluna = result({
      analysisId: "ORB-LUN-002",
      inputHash: resultHash(identity, "ORB-LUN-002"),
      status: "partial",
      precision: "range",
      observedAt: now - 20 * 60 * 60 * 1000,
      validUntil: now - 1,
      data: cumplelunaData({
        previousExactAt: now - 10 * 86_400_000,
        nextExactAt: now - 1,
        cycleDay: 10,
        daysRemaining: 0,
      }),
    });
    const currentPositions = skyPositions().map((placement) =>
      placement.key === "sun"
        ? { ...placement, fullDegree: 0, degree: 0, speed: 1 }
        : placement.key === "moon"
          ? { ...placement, fullDegree: 180, degree: 0, speed: 13 }
          : placement,
    );
    const { ctx } = actionContext({
      userId: "user-test",
      birthDataId: "birth-test",
      natalChartId: "chart-test",
      birthData,
      chart,
      natalEphemeris,
      snapshots: [cachedCumpleluna],
      sky: {
        providerVersion: "fixture-sky-v1",
        observedAt: now,
        validUntil: now + 10 * 60 * 1000,
        positions: currentPositions,
      },
    });

    const cumpleluna = (await (refreshForDate as any)._handler(ctx, {
      localDate,
      timezone: "UTC",
    })).today.cumpleluna;
    assert.equal(cumpleluna.status, "partial");
    assert.equal(cumpleluna.precision, "range");
    assert.equal(cumpleluna.data, null);
    assert.ok(
      cumpleluna.missingInputs.includes("exact_birth_time_or_stable_cumpleluna_cycle"),
    );
    assert.doesNotMatch(cumpleluna.limitations.join(" "), /último dato personal/i);
  });
});

test("el ranking conserva el orden real pero no presenta como exacta una cronología extrapolada", async () => {
  await withoutAstrologyCredentials(async () => {
    const localDate = localDateIn("UTC");
    const now = Date.now();
    const birthData: BirthDataSnapshot = {
      birthDate: "1994-05-04",
      birthTime: "12:00",
      birthTimePrecision: "known",
      birthPlaceLabel: "Buenos Aires",
      latitude: -34.6037,
      longitude: -58.3816,
      timezone: "America/Argentina/Buenos_Aires",
      updatedAt: 1,
    };
    const cache = natalCache(birthData);
    const { ctx } = actionContext({
      userId: "user-test",
      birthDataId: "birth-test",
      natalChartId: "chart-test",
      birthData,
      chart: chartSnapshot("known"),
      natalEphemeris: cache,
      snapshots: [],
      sky: {
        providerVersion: "fixture-sky-v1",
        observedAt: now,
        validUntil: now + 10 * 60 * 1000,
        positions: skyPositions(),
      },
    });

    const bundle = await (refreshForDate as any)._handler(ctx, { localDate, timezone: "UTC" });

    assert.ok((bundle.today.transitRanking.data?.items.length ?? 0) > 0);
    assert.equal(bundle.today.transitRanking.status, "partial");
    assert.equal(bundle.today.transitRanking.precision, "estimated");
    assert.ok(bundle.today.transitRanking.missingInputs.includes("verified_transit_exact_timeline"));
    assert.match(bundle.today.transitRanking.limitations.join(" "), /se estiman.*seguimiento completo/);
    assert.equal(bundle.moment.temporalMandala.status, "partial");
    assert.equal(bundle.moment.temporalMandala.precision, "estimated");
    assert.equal(
      new Set(bundle.moment.temporalMandala.missingInputs).size,
      bundle.moment.temporalMandala.missingInputs.length,
    );
    assert.equal(
      new Set(bundle.moment.temporalMandala.limitations).size,
      bundle.moment.temporalMandala.limitations.length,
    );
  });
});

test("una Luna colectiva stale no contamina el Mandala porque ya no es uno de sus anillos", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const now = Date.now();
    const { ctx } = actionContext({
      userId: "user-test",
      birthDataId: null,
      natalChartId: null,
      birthData: null,
      chart: null,
      natalEphemeris: null,
      snapshots: [],
      sky: {
        providerVersion: "fixture-stale-sky-v1",
        observedAt: now - 2 * 60 * 60 * 1000,
        validUntil: now - 60 * 60 * 1000,
        positions: skyPositions(),
      },
    });
    const bundle = await (refreshForDate as any)._handler(ctx, { localDate, timezone });

    assert.equal(bundle.today.moonOnChart.status, "stale");
    assert.notEqual(bundle.today.moonOnChart.data, null);
    assert.equal(bundle.today.cumpleluna.data, null);
    assert.equal(bundle.moment.temporalMandala.status, "partial");
    assert.notEqual(bundle.moment.temporalMandala.status, "stale");
    assert.equal(bundle.moment.temporalMandala.data?.rings[2].key, "cumpleluna");
    assert.equal(bundle.moment.temporalMandala.data?.rings[2].available, false);
  });
});

test("el Mandala hereda stale desde la Cumpleluna personal y no duplica calidad propagada", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const now = Date.now();
    const identity = baseHash(null, null);
    const previousExactAt = now - 30 * 86_400_000;
    const nextExactAt = now - 60 * 60 * 1000;
    const cachedCumpleluna = result({
      analysisId: "ORB-LUN-002",
      inputHash: resultHash(identity, "ORB-LUN-002"),
      status: "ready",
      precision: "exact",
      observedAt: now - 12 * 60 * 60 * 1000,
      validUntil: nextExactAt,
      data: cumplelunaData({
        previousExactAt,
        nextExactAt,
        cycleDay: 29.4,
        daysRemaining: 0,
      }),
    });
    const { ctx } = actionContext({
      userId: "user-test",
      birthDataId: null,
      natalChartId: null,
      birthData: null,
      chart: null,
      natalEphemeris: null,
      snapshots: [cachedCumpleluna],
      sky: {
        providerVersion: "fixture-stale-sky-v1",
        observedAt: now - 2 * 60 * 60 * 1000,
        validUntil: now - 60 * 60 * 1000,
        positions: skyPositions(),
      },
    });
    const bundle = await (refreshForDate as any)._handler(ctx, { localDate, timezone });

    assert.equal(bundle.today.cumpleluna.status, "stale");
    assert.notEqual(bundle.today.cumpleluna.data, null);
    assert.equal(bundle.moment.temporalMandala.status, "stale");
    assert.equal(bundle.moment.temporalMandala.data?.rings[2].key, "cumpleluna");
    assert.equal(bundle.moment.temporalMandala.data?.rings[2].label, "Tu ritmo lunar");
    assert.equal(bundle.moment.temporalMandala.data?.rings[2].cadence, "Cumpleluna personal");
    assert.equal(bundle.moment.temporalMandala.precision, "exact");
    assert.equal(bundle.moment.temporalMandala.data?.rings[2].status, "stale");
    assert.equal(bundle.moment.temporalMandala.data?.rings[2].precision, "exact");
    assert.equal(bundle.moment.temporalMandala.data?.rings[2].progressMode, "point");
    assert.equal(
      new Set(bundle.moment.temporalMandala.missingInputs).size,
      bundle.moment.temporalMandala.missingInputs.length,
    );
    assert.equal(
      new Set(bundle.moment.temporalMandala.limitations).size,
      bundle.moment.temporalMandala.limitations.length,
    );
  });
});

test("el hash y la vigencia del Mandala siguen sus cuatro fuentes, no Luna en tu carta", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const now = Date.now();
    const identity = baseHash(null, null);
    const previousExactAt = now - 29 * 86_400_000;
    const nextExactAt = now + 30 * 60 * 1000;

    const run = async (moonLongitude: number, cycleDay: number) => {
      const positions = skyPositions().map((item) =>
        item.key === "moon" ? { ...item, fullDegree: moonLongitude } : item,
      );
      const cachedCumpleluna = result({
        analysisId: "ORB-LUN-002",
        inputHash: resultHash(identity, "ORB-LUN-002"),
        status: "ready",
        precision: "exact",
        observedAt: now,
        validUntil: nextExactAt,
        data: cumplelunaData({
          previousExactAt,
          nextExactAt,
          cycleDay,
          daysRemaining: 0.5,
        }),
      });
      const { ctx } = actionContext({
        userId: "user-test",
        birthDataId: null,
        natalChartId: null,
        birthData: null,
        chart: null,
        natalEphemeris: null,
        snapshots: [cachedCumpleluna],
        sky: {
          providerVersion: "fixture-sky-v1",
          observedAt: now,
          validUntil: now + 60 * 60 * 1000,
          positions,
        },
      });
      return await (refreshForDate as any)._handler(ctx, { localDate, timezone });
    };

    const first = await run(101, 29);
    const changedCollectiveMoon = await run(257, 29);
    const changedPersonalRhythm = await run(257, 29.25);

    assert.notEqual(
      first.today.moonOnChart.data?.longitudeDegrees,
      changedCollectiveMoon.today.moonOnChart.data?.longitudeDegrees,
    );
    assert.equal(
      first.moment.temporalMandala.inputHash,
      changedCollectiveMoon.moment.temporalMandala.inputHash,
      "la lunación colectiva no forma parte del hash del Mandala",
    );
    assert.notEqual(
      changedCollectiveMoon.moment.temporalMandala.inputHash,
      changedPersonalRhythm.moment.temporalMandala.inputHash,
      "un cambio del Cumpleluna personal sí invalida el Mandala",
    );
    assert.equal(first.moment.temporalMandala.validUntil, nextExactAt);
    assert.equal(first.moment.temporalMandala.data?.rings[2].cycleDay, 29);
    assert.equal(first.moment.temporalMandala.data?.rings[2].previousExactAt, previousExactAt);
    assert.equal(first.moment.temporalMandala.data?.rings[2].nextExactAt, nextExactAt);
  });
});

test("si falla el cálculo natal sin cache no reutiliza un ranking basado en planetas legacy", async () => {
  await withoutAstrologyCredentials(async () => {
    const localDate = localDateIn("UTC");
    const now = Date.now();
    const birthData: BirthDataSnapshot = {
      birthDate: "1994-05-04",
      birthTime: null,
      birthTimePrecision: "unknown",
      birthPlaceLabel: "Buenos Aires",
      latitude: -34.6037,
      longitude: -58.3816,
      timezone: "America/Argentina/Buenos_Aires",
      updatedAt: 1,
    };
    const chart = chartSnapshot("unknown");
    const identity = baseHash(birthData, chart);
    const cachedRanking = result({
      analysisId: "ORB-TRN-002",
      inputHash: resultHash(identity, "ORB-TRN-002", { localDate, timezone: "UTC" }),
      status: "ready",
      precision: "estimated",
      observedAt: now - 2 * 60 * 60 * 1000,
      validUntil: now - 60 * 60 * 1000,
      data: {
        kind: "transit_ranking",
        items: [],
        activeCount: 0,
        calculatedAt: now - 2 * 60 * 60 * 1000,
        summary: "Ranking previamente verificado contra el día completo.",
      },
    });
    const { ctx } = actionContext({
      userId: "user-test",
      birthDataId: "birth-test",
      natalChartId: "chart-test",
      birthData,
      chart,
      natalEphemeris: null,
      snapshots: [cachedRanking],
      sky: {
        providerVersion: "fixture-sky-v1",
        observedAt: now,
        validUntil: now + 10 * 60 * 1000,
        positions: skyPositions(),
      },
    });

    const bundle = await (refreshForDate as any)._handler(ctx, { localDate, timezone: "UTC" });

    assert.equal(bundle.today.transitRanking.status, "unavailable");
    assert.equal(bundle.today.transitRanking.data, null);
  });
});

test("profección usa la timezone actual y conserva el mismo inputHash en refresh y query", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "America/New_York";
    const localDate = localDateIn(timezone);
    const localYear = Number(localDate.slice(0, 4));
    const now = Date.now();
    const birthData: BirthDataSnapshot = {
      birthDate: "2000-01-01",
      birthTime: "12:00",
      birthTimePrecision: "known",
      birthPlaceLabel: "Tokio",
      latitude: 35.6762,
      longitude: 139.6503,
      timezone: "Asia/Tokyo",
      updatedAt: 1,
    };
    const chart = chartSnapshot("known");
    const cache = natalCache(birthData);
    const { ctx } = actionContext({
      userId: "user-test",
      birthDataId: "birth-test",
      natalChartId: "chart-test",
      birthData,
      chart,
      natalEphemeris: cache,
      snapshots: [],
      sky: {
        providerVersion: "fixture-sky-v1",
        observedAt: now,
        validUntil: now + 10 * 60 * 1000,
        positions: skyPositions(),
      },
    });
    const refreshed = await (refreshForDate as any)._handler(ctx, { localDate, timezone });

    const birthDocument = { _id: "birth-test", userId: "user-test", ...birthData };
    const chartDocument = {
      _id: "chart-test",
      userId: "user-test",
      payload: { normalized: { ...chart, summary: {} } },
    };
    const queryCtx = {
      auth: { getUserIdentity: async () => ({ tokenIdentifier: "test-token" }) },
      db: {
        query(table: string) {
          const chain = {
            withIndex(_name: string, callback: (value: { eq: () => unknown }) => unknown) {
              callback({ eq: () => chain });
              return chain;
            },
            order() {
              return chain;
            },
            async first() {
              if (table === "users") return { _id: "user-test", tokenIdentifier: "test-token" };
              if (table === "birthData") return birthDocument;
              if (table === "natalCharts") return chartDocument;
              if (table === "natalEphemerisCachesV492") {
                return {
                  _id: "natal-cache-test",
                  userId: "user-test",
                  cacheKey: "test",
                  ...cache,
                };
              }
              return null;
            },
            async collect() {
              return [];
            },
          };
          return chain;
        },
      },
    };
    const queried = await (getForDate as any)._handler(queryCtx, { localDate, timezone });

    assert.equal(refreshed.moment.annualProfection.inputHash, queried.moment.annualProfection.inputHash);
    assert.equal(
      refreshed.moment.annualProfection.data?.periodStart,
      Date.UTC(localYear, 0, 1, 5, 0, 0),
    );
  });
});
