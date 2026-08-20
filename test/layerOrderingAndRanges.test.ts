import assert from "node:assert/strict";
import test from "node:test";

import { getAnalysisDefinition, getSourceRefs } from "../convex/content/astrologySources";
import {
  buildCumplelunaLayerData,
  buildProgressedLunationLayerData,
  buildTemporalMandalaData,
} from "../convex/lib/layerAssembly";
import type { AnalysisResult, EphemerisPosition } from "../convex/lib/layerContract";
import { buildLayerRefreshInputFingerprint, persistRefresh } from "../convex/layers";

const DAY = 86_400_000;

test("la estación vital estimada publica intervalos y no un porcentaje puntual", () => {
  const observedAt = Date.UTC(2026, 7, 15, 12);
  const phaseStartedAtRange = {
    earliest: Date.UTC(2023, 10, 1),
    latest: Date.UTC(2024, 10, 1),
  };
  const nextPhaseAtRange = {
    earliest: Date.UTC(2027, 4, 1),
    latest: Date.UTC(2028, 4, 1),
  };
  const result = buildProgressedLunationLayerData({
    birthTimePrecision: "unknown",
    progressedSunLongitude: 10,
    progressedMoonLongitude: 118,
    progressedElongationRangeDegrees: { from: 107.25, to: 108.75 },
    ageYears: 32.28,
    observedAt,
    phaseStartedAt: (phaseStartedAtRange.earliest + phaseStartedAtRange.latest) / 2,
    nextPhaseAt: (nextPhaseAtRange.earliest + nextPhaseAtRange.latest) / 2,
    phaseStartedAtRange,
    nextPhaseAtRange,
  });

  assert.equal(result.status, "partial");
  assert.equal(result.precision, "estimated");
  assert.equal(result.data?.progress, undefined);
  assert.equal(result.data?.cyclePosition, undefined);
  assert.deepEqual(result.data?.progressedElongationRangeDegrees, {
    from: 107.25,
    to: 108.75,
  });
  assert.deepEqual(result.data?.cyclePositionRange, {
    from: 0.297917,
    to: 0.302083,
  });
  assert.ok(result.data?.progressRange);
  assert.ok(result.data!.progressRange!.from < result.data!.progressRange!.to);
  assert.ok(result.data!.progressRange!.from >= 0);
  assert.ok(result.data!.progressRange!.to <= 1);

  const mandala = buildTemporalMandalaData({
    observedAt,
    progressedLunation: result.data,
    sourceQuality: {
      progressedLunation: { status: result.status, precision: result.precision },
    },
  });
  const ring = mandala.rings[0];
  assert.equal(ring.status, "partial");
  assert.equal(ring.precision, "estimated");
  assert.equal(ring.progressMode, "range");
  assert.equal(ring.progress, -1, "el campo v1 debe ser un sentinel no consumible");
  assert.deepEqual(ring.progressRange, result.data?.progressRange);
});

test("el Mandala propaga la calidad de cada fuente y retira puntos sin rango", () => {
  const observedAt = Date.UTC(2026, 7, 15, 12);
  const previousExactAt = observedAt - 12 * DAY;
  const nextExactAt = observedAt + 18 * DAY;
  const cumpleluna = buildCumplelunaLayerData({
    natalElongationDegrees: 68,
    natalElongationRangeDegrees: { from: 62, to: 74 },
    currentSunLongitude: 100,
    currentMoonLongitude: 333,
    previousExactAt,
    nextExactAt,
    previousExactAtRange: {
      earliest: previousExactAt - DAY,
      latest: previousExactAt + DAY,
    },
    nextExactAtRange: {
      earliest: nextExactAt - DAY,
      latest: nextExactAt + DAY,
    },
    observedAt,
    natalPrecision: "range",
    birthTimePrecision: "unknown",
  });
  assert.ok(cumpleluna.data?.progressRange);

  const mandala = buildTemporalMandalaData({
    observedAt,
    cumpleluna: cumpleluna.data,
    transitArc: {
      kind: "transit_arc",
      arcId: "fixture-arc",
      transitPlanet: "Saturno",
      natalPoint: "Sol",
      natalHouse: 10,
      aspect: "square",
      state: "approaching",
      startsAt: observedAt - DAY,
      peakAt: observedAt + DAY,
      endsAt: observedAt + 3 * DAY,
      previousExactAt: null,
      nextExactAt: observedAt + DAY,
      rankingWindow: {
        startsAt: observedAt - DAY,
        endsAt: observedAt + 3 * DAY,
      },
      rankingReason: "Pico mañana",
      progress: 0.25,
      passes: [],
      summary: "Ventana estimada.",
    },
    sourceQuality: {
      progressedLunation: {
        status: "needs_birth_time",
        precision: "not_applicable",
      },
      cumpleluna: { status: cumpleluna.status, precision: cumpleluna.precision },
      transitArc: { status: "partial", precision: "estimated" },
    },
  });

  const [progressedRing, , cumplelunaRing, transitRing] = mandala.rings;
  assert.equal(progressedRing.status, "needs_birth_time");
  assert.equal(progressedRing.precision, "not_applicable");
  assert.equal(progressedRing.progressMode, "unavailable");
  assert.equal(cumplelunaRing.status, "partial");
  assert.equal(cumplelunaRing.precision, "range");
  assert.equal(cumplelunaRing.progressMode, "range");
  assert.deepEqual(cumplelunaRing.progressRange, cumpleluna.data?.progressRange);
  assert.match(cumplelunaRing.state, /Día entre/);
  assert.deepEqual(cumplelunaRing.cycleDayRange, cumpleluna.data?.cycleDayRange);
  assert.equal(transitRing.status, "partial");
  assert.equal(transitRing.precision, "estimated");
  assert.equal(transitRing.progressMode, "unavailable");
  assert.equal(transitRing.progress, -1);
  assert.equal(transitRing.progressRange, undefined);
});

function unavailableRanking(observedAt: number): AnalysisResult {
  const definition = getAnalysisDefinition("ORB-TRN-002");
  return {
    analysisId: "ORB-TRN-002",
    methodVersion: definition.methodVersion,
    inputHash: "same-input-hash",
    status: "unavailable",
    precision: "not_applicable",
    observedAt,
    validUntil: observedAt + 60_000,
    data: null,
    missingInputs: ["fixture"],
    limitations: [],
    elaboration: definition.elaboration,
    sourceRefs: getSourceRefs("ORB-TRN-002"),
  };
}

function skyPositions(observedAt: number): EphemerisPosition[] {
  return [
    {
      key: "sun",
      label: "Sol",
      sign: "Aries",
      signEs: "Aries",
      degree: observedAt % 30,
      fullDegree: observedAt % 360,
      speed: 1,
      isRetrograde: false,
    },
  ];
}

test("persistRefresh no deja que una finalización anterior pise resultados más nuevos", async () => {
  const rows = new Map<string, Array<Record<string, any>>>();
  const operations: Array<[string, string, unknown]> = [];
  let nextId = 1;
  const tableRows = (table: string) => {
    const current = rows.get(table) ?? [];
    rows.set(table, current);
    return current;
  };
  const ctx = {
    db: {
      async get(id: string) {
        return id === "user-fixture" ? { _id: id } : null;
      },
      query(table: string) {
        const indexQuery = {
          eq() {
            return indexQuery;
          },
        };
        const chain = {
          withIndex(_name: string, callback: (query: typeof indexQuery) => unknown) {
            callback(indexQuery);
            return chain;
          },
          filter(
            callback: (query: {
              eq: (left: unknown, right: unknown) => unknown;
              field: (name: string) => unknown;
            }) => unknown,
          ) {
            callback({ eq: () => true, field: (name) => name });
            return chain;
          },
          order() {
            return chain;
          },
          async first() {
            if (table === "birthData") return null;
            return tableRows(table)[0] ?? null;
          },
          async collect() {
            return [...tableRows(table)];
          },
        };
        return chain;
      },
      async patch(id: string, fields: Record<string, unknown>) {
        for (const [table, documents] of rows) {
          const index = documents.findIndex((document) => document._id === id);
          if (index >= 0) {
            documents[index] = { ...documents[index], ...fields };
            operations.push(["patch", table, fields]);
            return;
          }
        }
        throw new Error(`Unknown fixture row ${id}`);
      },
      async insert(table: string, fields: Record<string, unknown>) {
        tableRows(table).push({ _id: `${table}-${nextId++}`, ...fields });
        operations.push(["insert", table, fields]);
      },
    },
  };
  const expectedInputFingerprint = buildLayerRefreshInputFingerprint({
    userId: "user-fixture",
    birthDataId: null,
    natalChartId: null,
    birthData: null,
    chart: null,
  });
  const argsAt = (observedAt: number, providerVersion = "fixture-provider-v1") => ({
    userId: "user-fixture",
    birthDataId: null,
    natalChartId: null,
    expectedInputFingerprint,
    localDate: "2026-08-15",
    timezone: "UTC",
    results: [unavailableRanking(observedAt)],
    sky: {
      providerVersion,
      observedAt,
      validUntil: observedAt + 60_000,
      positions: skyPositions(observedAt),
    },
    natalEphemeris: null,
  });

  assert.deepEqual(
    await (persistRefresh as any)._handler(ctx, argsAt(2_000)),
    { written: 1 },
  );
  const operationsAfterNewer = operations.length;

  assert.deepEqual(
    await (persistRefresh as any)._handler(
      ctx,
      argsAt(1_000, "fixture-provider-v2"),
    ),
    { written: 0 },
  );
  assert.equal(
    operations.length,
    operationsAfterNewer,
    "la respuesta que terminó última no debe escribir si fue observada antes",
  );
  assert.equal(tableRows("analysisSnapshotsV492")[0].observedAt, 2_000);
  assert.equal(tableRows("globalSkySnapshotsV492")[0].observedAt, 2_000);
  assert.equal(
    tableRows("globalSkySnapshotsV492").length,
    1,
    "el guard cubre todo el scope aunque cambie providerVersion",
  );

  assert.deepEqual(
    await (persistRefresh as any)._handler(
      ctx,
      argsAt(3_000, "fixture-provider-v2"),
    ),
    { written: 1 },
  );
  assert.equal(tableRows("analysisSnapshotsV492")[0].observedAt, 3_000);
  assert.equal(
    Math.max(...tableRows("globalSkySnapshotsV492").map((row) => row.observedAt)),
    3_000,
  );
});
