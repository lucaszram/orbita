/**
 * Detalle de UN arco de tránsito — contrato y comportamiento.
 *
 * El defecto que cierran estas pruebas: el sobre del día (`layers.getForDate`)
 * publica `ORB-TRN-001` sólo del arco PRINCIPAL, y el detalle de cualquier otro
 * tránsito de la lista se armaba con el ítem del ranking (`ORB-TRN-002`). La
 * pantalla mostraba entonces la trazabilidad y las fechas de otro análisis: un
 * método distinto, una precisión distinta y unas fuentes que no eran las de ese
 * arco.
 *
 * Lo que se exige acá no es que existan nombres nuevos, sino que el cálculo sea
 * real y que cada sobre diga la verdad sobre sí mismo:
 *
 * - dos arcos del mismo día son dos `ORB-TRN-001` con hash y cache propios;
 * - un arco no principal obtiene SU cronología verificada, y el `arcId` del dato
 *   es el que se pidió, antes y después de verificar;
 * - un arco que salió de la lista responde `ORB-TRN-001 unavailable`, nunca un
 *   `ORB-TRN-002`;
 * - si falla el proveedor o el seguimiento, el sobre queda `partial`, `stale` o
 *   `error` con su motivo, y nunca se rescata el arco de otro contacto;
 * - los contratos anteriores (`getForDate`, `refreshForDate`, el arco principal)
 *   siguen intactos.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLayerRefreshInputFingerprint,
  getForDate,
  getTransitArc,
  persistRefresh,
  refreshForDate,
  refreshTransitArc,
} from "../convex/layers";
import { buildNatalChartCacheKey, buildBirthDataHash } from "../convex/lib/birthDataConsistency";
import type {
  AnalysisResult,
  BirthDataSnapshot,
  EphemerisPosition,
  NormalizedChartSnapshot,
} from "../convex/lib/layerContract";
import { getAnalysisDefinition, getSourceRefs } from "../convex/content/astrologySources";
import { resolveZonedCivilTime } from "../convex/lib/civilTime";
import { stableInputHash } from "../convex/lib/stableHash";
import { missingReasons } from "../src/domain/layers";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
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

// ---------------------------------------------------------------------------
// Fixtures — la misma forma que usa `layersV492Runtime`
// ---------------------------------------------------------------------------

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

const BIRTH_DATA: BirthDataSnapshot = {
  birthDate: "1994-05-04",
  birthTime: "12:00",
  birthTimePrecision: "known",
  birthPlaceLabel: "Buenos Aires",
  latitude: -34.6037,
  longitude: -58.3816,
  timezone: "America/Argentina/Buenos_Aires",
  updatedAt: 1,
};

/** El Sol natal en 0°, para poder calcular a mano el grado exacto de un aspecto. */
function chartSnapshot(): NormalizedChartSnapshot {
  return {
    placements: [
      ...PLANETS.map(([key, label], index) => ({
        key,
        label,
        sign: index === 0 ? "Aries" : "Taurus",
        signEs: index === 0 ? "Aries" : "Tauro",
        degree: index === 0 ? 0 : 5,
        fullDegree: index === 0 ? 0 : 35 + index * 17,
        house: (index % 12) + 1,
        isRetrograde: false,
      })),
      {
        key: "ascendant",
        label: "Ascendente",
        sign: "Aquarius",
        signEs: "Acuario",
        degree: 5,
        fullDegree: 305,
        house: 1,
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

function natalCache(birthData: BirthDataSnapshot) {
  return {
    inputHash: stableInputHash({
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
    }),
    methodVersion: NATAL_EPHEMERIS_METHOD_VERSION,
    providerVersion: NATAL_EPHEMERIS_PROVIDER_VERSION,
    birthTimePrecision: birthData.birthTimePrecision,
    samples: [{ instantMs: instantFor(birthData, birthData.birthTime!), positions: skyPositions() }],
    calculatedAt: Date.now(),
  };
}

type RefreshStateFixture = {
  userId: string;
  birthDataId: string | null;
  natalChartId: string | null;
  birthData: BirthDataSnapshot | null;
  chart: NormalizedChartSnapshot | null;
  natalEphemeris: ReturnType<typeof natalCache> | null;
  snapshots: AnalysisResult[];
  sky: {
    providerVersion: string;
    observedAt: number;
    validUntil: number;
    positions: EphemerisPosition[];
  } | null;
};

function refreshState(overrides: Partial<RefreshStateFixture> = {}): RefreshStateFixture {
  const now = Date.now();
  return {
    userId: "user-test",
    birthDataId: "birth-test",
    natalChartId: "chart-test",
    birthData: BIRTH_DATA,
    chart: chartSnapshot(),
    natalEphemeris: natalCache(BIRTH_DATA),
    snapshots: [],
    sky: {
      providerVersion: "fixture-sky-v1",
      observedAt: now,
      validUntil: now + 10 * 60 * 1000,
      positions: skyPositions(),
    },
    ...overrides,
  };
}

function actionContext(state: RefreshStateFixture) {
  const persisted: Array<Record<string, unknown>> = [];
  return {
    persisted,
    ctx: {
      auth: { getUserIdentity: async () => ({ tokenIdentifier: "test-token" }) },
      runQuery: async () => state,
      runMutation: async (_reference: unknown, value: Record<string, unknown>) => {
        persisted.push(value);
        return { written: 1 };
      },
    },
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

/**
 * Base de datos en memoria con lo que estas funciones realmente usan: búsqueda
 * por índice —con los valores de `eq` capturados—, `first`, `collect`, `insert` y
 * `patch`. Alcanza para observar QUÉ filas se escriben y con qué `cacheKey`, que
 * es lo que decide si dos arcos del mismo día colisionan.
 */
function memoryDb(seed: {
  user?: Record<string, unknown>;
  birthData?: Record<string, unknown>;
  natalCharts?: Record<string, unknown>[];
  analysisSnapshotsV492?: Record<string, unknown>[];
  natalEphemerisCachesV492?: Record<string, unknown>[];
}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    users: seed.user ? [seed.user] : [],
    birthData: seed.birthData ? [seed.birthData] : [],
    natalCharts: seed.natalCharts ?? [],
    analysisSnapshotsV492: seed.analysisSnapshotsV492 ?? [],
    natalEphemerisCachesV492: seed.natalEphemerisCachesV492 ?? [],
    globalSkySnapshotsV492: [],
  };
  const writes: Array<{ kind: "insert" | "patch"; table: string; row: Record<string, unknown> }> = [];
  let sequence = 0;

  const db = {
    tables,
    writes,
    async get(id: unknown) {
      for (const rows of Object.values(tables)) {
        const found = rows.find((row) => row._id === id);
        if (found) return found;
      }
      return null;
    },
    query(table: string) {
      const filters: Array<[string, unknown]> = [];
      const builder = {
        eq(field: string, value: unknown) {
          filters.push([field, value]);
          return builder;
        },
      };
      const matches = () =>
        (tables[table] ?? []).filter((row) =>
          filters.every(([field, value]) => row[field] === value),
        );
      const chain = {
        withIndex(_name: string, callback?: (value: typeof builder) => unknown) {
          callback?.(builder);
          return chain;
        },
        filter() {
          return chain;
        },
        order() {
          return chain;
        },
        async first() {
          return matches()[0] ?? null;
        },
        async collect() {
          return matches();
        },
      };
      return chain;
    },
    async insert(table: string, row: Record<string, unknown>) {
      sequence += 1;
      const stored = { ...row, _id: `${table}-${sequence}` };
      (tables[table] ??= []).push(stored);
      writes.push({ kind: "insert", table, row: stored });
      return stored._id;
    },
    async patch(id: unknown, fields: Record<string, unknown>) {
      for (const rows of Object.values(tables)) {
        const found = rows.find((row) => row._id === id);
        if (found) {
          Object.assign(found, fields);
          writes.push({ kind: "patch", table: "unknown", row: found });
          return;
        }
      }
    },
  };
  return db;
}

function persistCtx(state: RefreshStateFixture) {
  const birthDocument = {
    _id: state.birthDataId,
    userId: state.userId,
    ...(state.birthData ?? {}),
    birthTime: state.birthData?.birthTime ?? undefined,
    latitude: state.birthData?.latitude ?? undefined,
    longitude: state.birthData?.longitude ?? undefined,
  };
  const chartDocument = {
    _id: state.natalChartId,
    userId: state.userId,
    cacheKey: state.birthData
      ? buildNatalChartCacheKey(String(state.userId), buildBirthDataHash(birthDocument as never))
      : "unused",
    payload: { normalized: { ...(state.chart ?? { placements: [], houses: [] }), summary: {} } },
  };
  const db = memoryDb({
    user: { _id: state.userId, tokenIdentifier: "test-token" },
    birthData: birthDocument,
    natalCharts: [chartDocument],
    analysisSnapshotsV492: [],
  });
  return { db, ctx: { db } };
}

function queryCtx(state: RefreshStateFixture, snapshotRows: Record<string, unknown>[]) {
  const birthDocument = {
    _id: state.birthDataId,
    userId: state.userId,
    ...(state.birthData ?? {}),
  };
  const chartDocument = {
    _id: state.natalChartId,
    userId: state.userId,
    cacheKey: state.birthData
      ? buildNatalChartCacheKey(String(state.userId), buildBirthDataHash(birthDocument as never))
      : "unused",
    payload: { normalized: { ...(state.chart ?? { placements: [], houses: [] }), summary: {} } },
  };
  const db = memoryDb({
    user: { _id: state.userId, tokenIdentifier: "test-token" },
    birthData: birthDocument,
    natalCharts: [chartDocument],
    analysisSnapshotsV492: snapshotRows,
    natalEphemerisCachesV492: state.natalEphemeris
      ? [
          {
            _id: "natal-cache-test",
            userId: state.userId,
            // La clave es la real del backend: la query busca por `cacheKey` y una
            // fila con otra clave dejaría la carta canónica fuera del hash, que es
            // justo lo que esta prueba compara.
            cacheKey: [
              "v492",
              "natal-ephemeris",
              String(state.userId),
              NATAL_EPHEMERIS_METHOD_VERSION,
              state.natalEphemeris.inputHash,
            ].join(":"),
            ...state.natalEphemeris,
          },
        ]
      : [],
  });
  return {
    auth: { getUserIdentity: async () => ({ tokenIdentifier: "test-token" }) },
    db,
  };
}

/** Fila de `analysisSnapshotsV492` tal como la escribe `persistRefresh`. */
function snapshotRow(args: {
  result: AnalysisResult;
  userId: string;
  localDate: string;
  timezone: string;
}) {
  return {
    _id: `snapshot-${args.result.inputHash}`,
    userId: args.userId,
    analysisId: args.result.analysisId,
    cacheKey: `test:${args.result.analysisId}:${args.result.inputHash}`,
    localDate: args.localDate,
    timezone: args.timezone,
    methodVersion: args.result.methodVersion,
    providerVersion: args.result.providerVersion,
    inputHash: args.result.inputHash,
    status: args.result.status,
    precision: args.result.precision,
    observedAt: args.result.observedAt,
    validUntil: args.result.validUntil,
    data: args.result.data,
    missingInputs: args.result.missingInputs,
    limitations: args.result.limitations,
    elaboration: args.result.elaboration,
    sourceRefs: args.result.sourceRefs,
    createdAt: args.result.observedAt,
    updatedAt: args.result.observedAt,
  };
}

type RankingItem = {
  arcId: string;
  transitPlanet: string;
  natalPoint: string;
  aspect: string;
  aspectDegrees: number;
};

/** El ranking real del fixture: de ahí salen los `arcId` que pide la pantalla. */
async function rankingOf(state: RefreshStateFixture, localDate: string, timezone: string) {
  const { ctx } = actionContext(state);
  const bundle = await (refreshForDate as never as { _handler: Function })._handler(ctx, {
    localDate,
    timezone,
  });
  const items: RankingItem[] = bundle.today.transitRanking.data?.items ?? [];
  assert.ok(items.length >= 3, "el fixture necesita varios tránsitos activos");
  return { bundle, items };
}

const callHandler = <T>(fn: unknown, ctx: unknown, args: unknown): Promise<T> =>
  (fn as { _handler: (ctx: unknown, args: unknown) => Promise<T> })._handler(ctx, args);

/**
 * El dato del sobre, ya estrechado a arco. Un sobre `ORB-TRN-001` con dato de
 * otra capa devolvería `null` acá, y la prueba fallaría: es parte de lo que se
 * quiere fijar.
 */
function arcData(result: { data: AnalysisResult["data"] } | null) {
  return result?.data?.kind === "transit_arc" ? result.data : null;
}

// ---------------------------------------------------------------------------
// 1. Dos arcos del mismo día no colisionan
// ---------------------------------------------------------------------------

test("dos arcId del mismo día producen dos ORB-TRN-001 distintos, sin colisión de hash ni de cache", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { bundle, items } = await rankingOf(state, localDate, timezone);

    const primero = items[1];
    const segundo = items[2];
    assert.notEqual(primero.arcId, segundo.arcId);

    const uno = await callHandler<AnalysisResult>(refreshTransitArc, actionContext(state).ctx, {
      localDate,
      timezone,
      arcId: primero.arcId,
    });
    const dos = await callHandler<AnalysisResult>(refreshTransitArc, actionContext(state).ctx, {
      localDate,
      timezone,
      arcId: segundo.arcId,
    });

    assert.equal(uno.analysisId, "ORB-TRN-001");
    assert.equal(dos.analysisId, "ORB-TRN-001");
    assert.notEqual(uno.inputHash, dos.inputHash);
    assert.ok(arcData(uno), "el primer sobre trae dato de arco");
    assert.ok(arcData(dos), "el segundo sobre trae dato de arco");
    assert.equal(arcData(uno)?.arcId, primero.arcId);
    assert.equal(arcData(dos)?.arcId, segundo.arcId);
    assert.notDeepEqual(
      [arcData(uno)?.transitPlanet, arcData(uno)?.natalPoint, arcData(uno)?.aspect],
      [arcData(dos)?.transitPlanet, arcData(dos)?.natalPoint, arcData(dos)?.aspect],
      "dos arcos distintos no pueden describir el mismo contacto",
    );

    // Y el arco PRINCIPAL del día conserva su propio hash: el alcance con `arcId`
    // no puede leerse ni escribirse en su lugar.
    const principal = bundle.today.transitArc as AnalysisResult;
    assert.notEqual(principal.inputHash, uno.inputHash);
    assert.notEqual(principal.inputHash, dos.inputHash);

    // La persistencia real: tres filas, tres `cacheKey`.
    const { db, ctx } = persistCtx(state);
    const fingerprint = buildLayerRefreshInputFingerprint({
      userId: state.userId,
      birthDataId: state.birthDataId,
      natalChartId: state.natalChartId,
      birthData: state.birthData,
      chart: state.chart,
    });
    await callHandler(persistRefresh, ctx, {
      userId: state.userId,
      birthDataId: state.birthDataId,
      natalChartId: state.natalChartId,
      expectedInputFingerprint: fingerprint,
      localDate,
      timezone,
      results: [principal, uno, dos],
      sky: null,
      natalEphemeris: null,
    });
    const escritas = db.writes.filter((write) => write.table === "analysisSnapshotsV492");
    assert.equal(escritas.length, 3, "cada arco necesita su propia fila");
    const claves = new Set(escritas.map((write) => String(write.row.cacheKey)));
    assert.equal(claves.size, 3, "los tres cacheKey tienen que ser distintos");
    for (const write of escritas) {
      assert.equal(write.row.analysisId, "ORB-TRN-001");
      assert.equal(write.row.localDate, localDate);
      assert.equal(write.row.timezone, timezone);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Un arco no principal obtiene su propia cronología verificada
// ---------------------------------------------------------------------------

/**
 * Efemérides sintéticas del planeta pedido alrededor del contacto: una sola raíz
 * y una ventana que cierra dentro del radio de búsqueda. Los otros nueve planetas
 * van fijos —el solucionador sólo mira el que transita—.
 */
function fakeTropicalResponse(args: {
  instantMs: number;
  reference: number;
  planetKey: string;
  targetLongitude: number;
}) {
  const day = (args.instantMs - args.reference) / DAY_MS;
  const error = 12 * Math.tanh(day / 60) - 1;
  return {
    planets: PLANETS.map(([key, label], index) => {
      const esObjetivo = key === args.planetKey;
      const fullDegree = esObjetivo
        ? (((args.targetLongitude + error) % 360) + 360) % 360
        : (index * 31) % 360;
      const speed = esObjetivo ? (12 * (1 - Math.tanh(day / 60) ** 2)) / 60 : 1;
      return { name: label, fullDegree, speed, sign: "Aries" };
    }),
  };
}

function angularDistance(left: number, right: number) {
  const delta = Math.abs((((left - right) % 360) + 360) % 360);
  return delta > 180 ? 360 - delta : delta;
}

/** El grado exacto del aspecto, con la misma regla que usa el seguimiento. */
function exactAspectLongitude(args: {
  natalLongitude: number;
  transitLongitude: number;
  aspectDegrees: number;
}) {
  const natal = ((args.natalLongitude % 360) + 360) % 360;
  const candidates =
    args.aspectDegrees === 0
      ? [natal]
      : args.aspectDegrees === 180
        ? [(natal + 180) % 360]
        : [(natal + args.aspectDegrees) % 360, (natal - args.aspectDegrees + 360) % 360];
  return candidates.sort(
    (left, right) =>
      angularDistance(args.transitLongitude, left) - angularDistance(args.transitLongitude, right) ||
      left - right,
  )[0];
}

test("un arco no principal verifica SU cronología y publica el arcId pedido", async () => {
  const timezone = "UTC";
  const localDate = localDateIn(timezone);
  const state = refreshState();
  const reference = state.sky!.observedAt;

  const { bundle, items } = await withoutAstrologyCredentials(() =>
    rankingOf(state, localDate, timezone),
  );
  const principal = bundle.today.transitArc.data;
  const objetivo = items.find(
    (item) => item.transitPlanet === "Saturno" && item.natalPoint === "Sol",
  );
  assert.ok(objetivo, "el fixture necesita un contacto lento sobre el Sol natal");
  assert.notEqual(objetivo.arcId, principal?.arcId, "el arco pedido no puede ser el principal");

  const saturno = skyPositions().find((position) => position.key === "saturn")!;
  const targetLongitude = exactAspectLongitude({
    natalLongitude: 0,
    transitLongitude: saturno.fullDegree,
    aspectDegrees: objetivo.aspectDegrees,
  });

  const realFetch = globalThis.fetch;
  const previous = {
    user: process.env.ASTROLOGY_API_USER_ID,
    key: process.env.ASTROLOGY_API_KEY,
  };
  let llamadas = 0;
  process.env.ASTROLOGY_API_USER_ID = "fixture";
  process.env.ASTROLOGY_API_KEY = "fixture";
  globalThis.fetch = (async (url: unknown, init: { body?: unknown }) => {
    const href = String(url);
    assert.match(href, /planets\/tropical/, "el seguimiento sólo usa planets/tropical");
    llamadas += 1;
    const body = JSON.parse(String(init.body)) as {
      year: number;
      month: number;
      day: number;
      hour: number;
      min: number;
      tzone: number;
    };
    const instantMs =
      Date.UTC(body.year, body.month - 1, body.day, body.hour, body.min) - body.tzone * HOUR_MS;
    return new Response(
      JSON.stringify(
        fakeTropicalResponse({ instantMs, reference, planetKey: "saturn", targetLongitude }),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as never;

  try {
    const envelope = await callHandler<AnalysisResult>(refreshTransitArc, actionContext(state).ctx, {
      localDate,
      timezone,
      arcId: objetivo.arcId,
    });

    assert.ok(llamadas > 0, "verificar una cronología exige consultar efemérides reales");
    assert.equal(envelope.analysisId, "ORB-TRN-001");
    assert.equal(envelope.methodVersion, getAnalysisDefinition("ORB-TRN-001").methodVersion);
    assert.equal(envelope.status, "ready");
    assert.equal(envelope.precision, "exact");
    assert.equal(envelope.providerVersion, NATAL_EPHEMERIS_PROVIDER_VERSION);
    assert.deepEqual(envelope.missingInputs, []);
    assert.match(
      envelope.limitations.join(" "),
      /se verificaron con posiciones tropicales reales/,
      "una ventana verificada lo declara",
    );
    assert.deepEqual(
      envelope.sourceRefs,
      getSourceRefs("ORB-TRN-001"),
      "el sobre cita las fuentes de ORB-TRN-001, no las del ranking",
    );

    const arco = arcData(envelope);
    assert.ok(arco, "el sobre tiene que traer el dato de arco");
    assert.equal(
      arco.arcId,
      objetivo.arcId,
      "verificar las pasadas no puede cambiar la identidad del arco pedido",
    );
    assert.equal(arco.transitPlanet, "Saturno");
    assert.equal(arco.natalPoint, "Sol");
    assert.ok(arco.passes.length >= 1);
    // La ventana es la del seguimiento, no la extrapolación del ranking: el borde
    // sale de donde el orbe cruza 3°, a semanas del instante observado.
    assert.ok(arco.startsAt < reference);
    assert.ok(arco.endsAt > reference + 7 * DAY_MS);
  } finally {
    globalThis.fetch = realFetch;
    if (previous.user === undefined) delete process.env.ASTROLOGY_API_USER_ID;
    else process.env.ASTROLOGY_API_USER_ID = previous.user;
    if (previous.key === undefined) delete process.env.ASTROLOGY_API_KEY;
    else process.env.ASTROLOGY_API_KEY = previous.key;
  }
});

// ---------------------------------------------------------------------------
// 3. Un arco que salió de la lista
// ---------------------------------------------------------------------------

test("un arco que ya no está activo devuelve ORB-TRN-001 unavailable, nunca un ORB-TRN-002", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { ctx, persisted } = actionContext(state);
    const envelope = await callHandler<AnalysisResult>(refreshTransitArc, ctx, {
      localDate,
      timezone,
      arcId: "arc_v1_noexiste",
    });

    assert.equal(envelope.analysisId, "ORB-TRN-001");
    assert.equal(envelope.status, "unavailable");
    assert.equal(envelope.data, null);
    assert.ok(envelope.missingInputs.includes("requested_transit_arc"));
    assert.equal(envelope.methodVersion, getAnalysisDefinition("ORB-TRN-001").methodVersion);
    assert.notEqual(
      envelope.methodVersion,
      getAnalysisDefinition("ORB-TRN-002").methodVersion,
      "el sobre del arco no puede llevar el método del ranking",
    );
    const results = persisted[0]?.results as AnalysisResult[];
    assert.equal(results.length, 1);
    assert.equal(results[0].analysisId, "ORB-TRN-001");
  });
});

test("un arcId con forma inválida se rechaza antes de leer datos", async () => {
  for (const arcId of ["", " ", "arc con espacio", "a".repeat(200), "arc/../v1"]) {
    await assert.rejects(
      () => callHandler(getTransitArc, {}, { localDate: "2026-08-17", timezone: "UTC", arcId }),
      /arcId/,
      `«${arcId}» debería rechazarse`,
    );
    await assert.rejects(
      () => callHandler(refreshTransitArc, {}, { localDate: "2026-08-17", timezone: "UTC", arcId }),
      /arcId/,
    );
  }
  await assert.rejects(
    () =>
      callHandler(getTransitArc, {}, { localDate: "2026-02-31", timezone: "UTC", arcId: "arc_v1_a" }),
    /real date/,
  );
});

// ---------------------------------------------------------------------------
// 4. Fallos honestos
// ---------------------------------------------------------------------------

test("sin seguimiento verificado el arco queda partial y estimado, con la ventana declarada así", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { items } = await rankingOf(state, localDate, timezone);
    const objetivo = items[1];

    const envelope = await callHandler<AnalysisResult>(refreshTransitArc, actionContext(state).ctx, {
      localDate,
      timezone,
      arcId: objetivo.arcId,
    });

    assert.equal(envelope.analysisId, "ORB-TRN-001");
    assert.equal(envelope.status, "partial");
    assert.equal(envelope.precision, "estimated");
    assert.ok(envelope.missingInputs.includes("verified_transit_pass_timeline"));
    assert.equal(arcData(envelope)?.arcId, objetivo.arcId);
    assert.match(envelope.limitations.join(" "), /queda marcada como estimada/);
  });
});

test("con el cielo vencido y sin proveedor, el arco se publica stale y no como cálculo de ahora", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const fresco = refreshState();
    const { items } = await rankingOf(fresco, localDate, timezone);
    const objetivo = items[1];

    const vencido = refreshState({
      sky: {
        ...fresco.sky!,
        validUntil: fresco.sky!.observedAt - HOUR_MS,
      },
    });
    const envelope = await callHandler<AnalysisResult>(
      refreshTransitArc,
      actionContext(vencido).ctx,
      { localDate, timezone, arcId: objetivo.arcId },
    );

    assert.equal(envelope.analysisId, "ORB-TRN-001");
    assert.equal(envelope.status, "stale");
    assert.equal(arcData(envelope)?.arcId, objetivo.arcId);
    assert.match(envelope.limitations.join(" "), /No pudimos actualizar el cielo/);
  });
});

test("sin ninguna efeméride el arco es un error fechado, no un arco reconstruido", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState({ sky: null });
    const envelope = await callHandler<AnalysisResult>(refreshTransitArc, actionContext(state).ctx, {
      localDate,
      timezone,
      arcId: "arc_v1_cualquiera",
    });

    assert.equal(envelope.analysisId, "ORB-TRN-001");
    assert.equal(envelope.status, "error");
    assert.equal(envelope.data, null);
    assert.ok(envelope.missingInputs.includes("current_ephemeris"));
    assert.ok(envelope.validUntil !== null, "un error necesita fecha de reintento");
  });
});

test("un stale guardado de OTRO arco no se rescata para el arco pedido", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const fresco = refreshState();
    const { items } = await rankingOf(fresco, localDate, timezone);
    const pedido = items[1];
    const otro = items[2];

    // Se calcula el arco de OTRO contacto y se guarda con el hash del pedido: es
    // exactamente la forma de mentira que el guard tiene que atajar.
    const ajeno = await callHandler<AnalysisResult>(refreshTransitArc, actionContext(fresco).ctx, {
      localDate,
      timezone,
      arcId: otro.arcId,
    });
    const delPedido = await callHandler<AnalysisResult>(
      refreshTransitArc,
      actionContext(fresco).ctx,
      { localDate, timezone, arcId: pedido.arcId },
    );
    const contaminado: AnalysisResult = {
      ...ajeno,
      inputHash: delPedido.inputHash,
      observedAt: fresco.sky!.observedAt - 2 * HOUR_MS,
      validUntil: fresco.sky!.observedAt - HOUR_MS,
    };

    const vencido = refreshState({
      snapshots: [contaminado],
      sky: { ...fresco.sky!, validUntil: fresco.sky!.observedAt - HOUR_MS },
    });
    const envelope = await callHandler<AnalysisResult>(
      refreshTransitArc,
      actionContext(vencido).ctx,
      { localDate, timezone, arcId: pedido.arcId },
    );

    assert.equal(arcData(envelope)?.arcId, pedido.arcId, "el sobre tiene que ser del arco pedido");
    assert.notEqual(arcData(envelope)?.arcId, arcData(ajeno)?.arcId);
    assert.notEqual(envelope.observedAt, contaminado.observedAt);
  });
});

// ---------------------------------------------------------------------------
// 5. La lectura: `getTransitArc`
// ---------------------------------------------------------------------------

test("getTransitArc devuelve el sobre del arco pedido y declara el cálculo pendiente cuando no existe", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { bundle, items } = await rankingOf(state, localDate, timezone);
    const pedido = items[1];
    const otro = items[2];

    const calculado = await callHandler<AnalysisResult>(
      refreshTransitArc,
      actionContext(state).ctx,
      { localDate, timezone, arcId: pedido.arcId },
    );
    const principal = bundle.today.transitArc as AnalysisResult;

    // Sin filas: el sobre existe, es ORB-TRN-001 y dice que falta el cálculo.
    const vacio = await callHandler<AnalysisResult>(
      getTransitArc,
      queryCtx(state, []),
      { localDate, timezone, arcId: pedido.arcId },
    );
    assert.equal(vacio.analysisId, "ORB-TRN-001");
    assert.equal(vacio.data, null);
    assert.ok(vacio.missingInputs.includes("requested_transit_arc_calculation"));
    assert.equal(vacio.inputHash, calculado.inputHash, "la lectura y el cálculo comparten alcance");

    // Con la fila del arco pedido más la del principal y la de otro arco: se lee
    // exactamente una, la del pedido.
    const otroCalculado = await callHandler<AnalysisResult>(
      refreshTransitArc,
      actionContext(state).ctx,
      { localDate, timezone, arcId: otro.arcId },
    );
    const filas = [principal, calculado, otroCalculado].map((result) =>
      snapshotRow({ result, userId: state.userId, localDate, timezone }),
    );
    const leido = await callHandler<AnalysisResult>(
      getTransitArc,
      queryCtx(state, filas),
      { localDate, timezone, arcId: pedido.arcId },
    );
    assert.equal(leido.analysisId, "ORB-TRN-001");
    assert.equal(arcData(leido)?.arcId, pedido.arcId);
    assert.equal(leido.inputHash, calculado.inputHash);
    assert.notEqual(leido.inputHash, principal.inputHash);
    assert.notEqual(leido.inputHash, otroCalculado.inputHash);

    // Y el sobre del DÍA sigue publicando el arco principal, no el de la lista.
    const bundleLeido = await callHandler<{ today: { transitArc: AnalysisResult } }>(
      getForDate,
      queryCtx(state, filas),
      { localDate, timezone },
    );
    assert.equal(bundleLeido.today.transitArc.inputHash, principal.inputHash);
    assert.equal(arcData(bundleLeido.today.transitArc)?.arcId, arcData(principal)?.arcId);
  });
});

test("sin cuenta, getTransitArc devuelve null igual que getForDate", async () => {
  const sinUsuario = {
    auth: { getUserIdentity: async () => null },
    db: memoryDb({}),
  };
  const resultado = await callHandler<AnalysisResult | null>(getTransitArc, sinUsuario, {
    localDate: localDateIn("UTC"),
    timezone: "UTC",
    arcId: "arc_v1_abc",
  });
  assert.equal(resultado, null);
});

test("refreshTransitArc exige sesión antes de tocar datos", async () => {
  await assert.rejects(
    () =>
      callHandler(refreshTransitArc, { auth: { getUserIdentity: async () => null } }, {
        localDate: localDateIn("UTC"),
        timezone: "UTC",
        arcId: "arc_v1_abc",
      }),
    /Authentication required/,
  );
});

// ---------------------------------------------------------------------------
// 6. Los contratos anteriores siguen compatibles
// ---------------------------------------------------------------------------

test("el arco principal y el ranking del día conservan su contrato con el alcance nuevo en juego", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { bundle, items } = await rankingOf(state, localDate, timezone);

    // El bundle sigue trayendo las mismas capas, con los mismos identificadores.
    assert.equal(bundle.today.transitRanking.analysisId, "ORB-TRN-002");
    assert.equal(bundle.today.transitArc.analysisId, "ORB-TRN-001");
    assert.equal(bundle.today.moonOnChart.analysisId, "ORB-LUN-003");
    assert.equal(bundle.today.cumpleluna.analysisId, "ORB-LUN-002");

    // Calcular un arco de la lista no reescribe el arco principal del día: son
    // dos filas con alcances distintos.
    const especifico = await callHandler<AnalysisResult>(
      refreshTransitArc,
      actionContext(state).ctx,
      { localDate, timezone, arcId: items[1].arcId },
    );
    const conFila = refreshState({
      snapshots: [especifico],
      sky: state.sky,
    });
    const otraVez = await rankingOf(conFila, localDate, timezone);
    assert.equal(
      arcData(otraVez.bundle.today.transitArc)?.arcId,
      arcData(bundle.today.transitArc)?.arcId,
      "una fila por arcId no puede convertirse en el arco principal",
    );
    assert.equal(
      otraVez.bundle.today.transitArc.inputHash,
      bundle.today.transitArc.inputHash,
    );
  });
});

// ---------------------------------------------------------------------------
// 7. La identidad del arco principal es la que publica el ranking
// ---------------------------------------------------------------------------

/**
 * El defecto que cierra esta prueba: `today.transitArc` y
 * `today.transitRanking.items[0]` describían el MISMO contacto con dos `arcId`
 * distintos en cuanto la cronología se verificaba —la lista sembraba la
 * identidad con la ventana extrapolada y el arco con la verificada—, así que
 * abrir el detalle del tránsito principal desde la lista no encontraba su arco.
 */
test("el arco principal y el primer ítem del ranking publican el mismo arcId con la cronología verificada", async () => {
  const timezone = "UTC";
  const localDate = localDateIn(timezone);
  // Fixture natal propio: la deduplicación de barridos es por contacto y hora, y
  // así esta prueba no comparte resultado con las que corren sin proveedor.
  const birthData: BirthDataSnapshot = { ...BIRTH_DATA, updatedAt: 20_260_817 };
  const state = refreshState({ birthData, natalEphemeris: natalCache(birthData) });
  const reference = state.sky!.observedAt;

  // En el fixture la efeméride natal ES el cielo de hoy, así que cada planeta
  // está en conjunción exacta consigo mismo y el ranking encabeza con el más
  // lento. El seguimiento sintético no elige contacto: mueve a TODOS los planetas
  // con la misma curva alrededor de su propia longitud, así que verifica el que
  // el motor haya elegido.
  const realFetch = globalThis.fetch;
  const previous = {
    user: process.env.ASTROLOGY_API_USER_ID,
    key: process.env.ASTROLOGY_API_KEY,
  };
  let llamadas = 0;
  process.env.ASTROLOGY_API_USER_ID = "fixture";
  process.env.ASTROLOGY_API_KEY = "fixture";
  globalThis.fetch = (async (_url: unknown, init: { body?: unknown }) => {
    llamadas += 1;
    const body = JSON.parse(String(init.body)) as {
      year: number;
      month: number;
      day: number;
      hour: number;
      min: number;
      tzone: number;
    };
    const instantMs =
      Date.UTC(body.year, body.month - 1, body.day, body.hour, body.min) - body.tzone * HOUR_MS;
    // Una ventana verificada que NO coincide con la extrapolada: el contacto
    // exacto cae dos días después del instante observado y los bordes de 3°
    // quedan a -1,9 y +5,9 días de ahí.
    const day = (instantMs - reference) / DAY_MS;
    const error = 8 * Math.tanh((day - 2) / 10);
    return new Response(
      JSON.stringify({
        planets: skyPositions().map((position) => ({
          name: position.label,
          fullDegree: (((position.fullDegree + error) % 360) + 360) % 360,
          speed: 0.8 * (1 - Math.tanh((day - 2) / 10) ** 2),
          sign: "Aries",
        })),
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as never;

  try {
    const bundle = await (refreshForDate as never as { _handler: Function })._handler(
      actionContext(state).ctx,
      { localDate, timezone },
    );
    const items: RankingItem[] = bundle.today.transitRanking.data?.items ?? [];
    const arco = bundle.today.transitArc as AnalysisResult;
    const dato = arcData(arco);

    assert.ok(llamadas > 0, "verificar la cronología exige consultar efemérides reales");
    assert.ok(items.length > 0);
    assert.ok(dato, "el arco principal tiene que traer dato");
    assert.equal(arco.status, "ready");
    assert.equal(arco.precision, "exact");
    assert.equal(arco.providerVersion, NATAL_EPHEMERIS_PROVIDER_VERSION);

    // El mismo contacto…
    assert.equal(dato.transitPlanet, items[0].transitPlanet);
    assert.equal(dato.natalPoint, items[0].natalPoint);
    assert.equal(dato.aspect, items[0].aspect);
    // …y el MISMO identificador.
    assert.equal(dato.arcId, items[0].arcId, "la lista y el arco tienen que nombrar igual el proceso");

    // Lo que sí cambió al verificar son las fechas: la ventana es la real, no la
    // extrapolación de la lista.
    assert.ok(dato.startsAt < reference, "el borde verificado abre antes del instante observado");
    assert.ok(dato.endsAt > reference + 3 * DAY_MS);

    // Y pedir ese arco por su `arcId` —lo que hace la pantalla de detalle— cae en
    // el mismo proceso en vez de responder que ya no está activo.
    const pedido = await callHandler<AnalysisResult>(refreshTransitArc, actionContext(state).ctx, {
      localDate,
      timezone,
      arcId: items[0].arcId,
    });
    assert.equal(pedido.analysisId, "ORB-TRN-001");
    assert.equal(arcData(pedido)?.arcId, items[0].arcId);
    assert.equal(arcData(pedido)?.transitPlanet, dato.transitPlanet);
    assert.equal(arcData(pedido)?.natalPoint, dato.natalPoint);
  } finally {
    globalThis.fetch = realFetch;
    if (previous.user === undefined) delete process.env.ASTROLOGY_API_USER_ID;
    else process.env.ASTROLOGY_API_USER_ID = previous.user;
    if (previous.key === undefined) delete process.env.ASTROLOGY_API_KEY;
    else process.env.ASTROLOGY_API_KEY = previous.key;
  }
});

test("un arco guardado con otra identidad no se sirve como arco principal: se recalcula", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { bundle } = await rankingOf(state, localDate, timezone);
    const principal = bundle.today.transitArc as AnalysisResult;
    const vigente = arcData(principal);
    assert.ok(vigente);

    // Una fila del mismo día, con el mismo hash y el mismo contacto, pero con la
    // identidad que le habría puesto otra versión del motor. Reutilizarla dejaba
    // la pantalla mostrando un `arcId` que el ranking de al lado no reconoce.
    const ajena: AnalysisResult = {
      ...principal,
      data: { ...vigente, arcId: "arc_v1_identidadvieja" },
    };
    const conCacheAjeno = refreshState({ snapshots: [ajena], sky: state.sky });
    const recalculado = await rankingOf(conCacheAjeno, localDate, timezone);
    const dato = arcData(recalculado.bundle.today.transitArc);
    assert.ok(dato);
    assert.notEqual(dato.arcId, "arc_v1_identidadvieja", "la fila vieja no puede servirse");
    assert.equal(
      dato.arcId,
      recalculado.bundle.today.transitRanking.data?.items[0].arcId,
      "lo recalculado vuelve a coincidir con el ranking",
    );

    // Y la fila que SÍ corresponde se sigue reutilizando: el guard invalida por
    // identidad, no por desconfianza.
    const conCachePropio = refreshState({ snapshots: [principal], sky: state.sky });
    const reutilizado = await rankingOf(conCachePropio, localDate, timezone);
    assert.deepEqual(reutilizado.bundle.today.transitArc, principal);
  });
});

// ---------------------------------------------------------------------------
// 8. Coherencia entre el ranking y el arco CACHEADOS
// ---------------------------------------------------------------------------

/**
 * El arreglo de identidad garantiza que un CÁLCULO nuevo publique el mismo
 * `arcId` en `ORB-TRN-002.items[0]` y en `ORB-TRN-001`. No alcanzaba: los dos
 * caminos de lectura/fallback —`getForDate` puro y el refresh sin efeméride—
 * rescatan los dos sobres por separado, así que una fila escrita ANTES de aquel
 * arreglo podía combinar un ranking cuyo primer ítem es A con un arco que
 * describe B. En modo caché u offline ese par podía durar indefinidamente.
 *
 * Lo que se exige acá es el par: `arcId` Y la tupla —planeta en tránsito, punto
 * natal y aspecto—. Y cuando no corresponden, que el arco se DESCARTE con un
 * `ORB-TRN-001` honesto sin dato, nunca que se relabele el ranking ni que se
 * mezcle el arco de otro contacto.
 */

/** El primer ítem del ranking de un sobre, ya estrechado. */
function primerItem(envelope: AnalysisResult) {
  const data = envelope.data?.kind === "transit_ranking" ? envelope.data : null;
  return data?.items[0] ?? null;
}

/** La tupla semántica que las dos capas tienen que decir igual. */
function tupla(value: { transitPlanet: string; natalPoint: string; aspect: string } | null) {
  return value ? [value.transitPlanet, value.natalPoint, value.aspect] : null;
}

/**
 * El par coherente del día, ya calculado: el ranking y el arco principal que un
 * refresh real publica y persiste juntos.
 */
async function parDelDia(state: RefreshStateFixture, localDate: string, timezone: string) {
  const { bundle, items } = await rankingOf(state, localDate, timezone);
  const ranking = bundle.today.transitRanking as AnalysisResult;
  const arco = bundle.today.transitArc as AnalysisResult;
  assert.ok(arcData(arco), "el fixture necesita un arco principal con dato");
  assert.equal(arcData(arco)?.arcId, items[0].arcId, "el par calculado nace coherente");
  return { ranking, arco, items };
}

test("getForDate no combina un ranking cacheado con el arco cacheado de OTRO contacto", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { ranking, arco, items } = await parDelDia(state, localDate, timezone);

    // El arco de otro contacto de la lista, guardado bajo el hash del principal:
    // es exactamente la fila que dejaba una versión anterior del motor.
    const otro = await callHandler<AnalysisResult>(refreshTransitArc, actionContext(state).ctx, {
      localDate,
      timezone,
      arcId: items[1].arcId,
    });
    const ajeno: AnalysisResult = { ...otro, inputHash: arco.inputHash };
    assert.notDeepEqual(tupla(arcData(ajeno)), tupla(primerItem(ranking)));

    const filas = [ranking, ajeno].map((result) =>
      snapshotRow({ result, userId: state.userId, localDate, timezone }),
    );
    const bundle = await callHandler<{
      today: { transitRanking: AnalysisResult; transitArc: AnalysisResult };
    }>(getForDate, queryCtx(state, filas), { localDate, timezone });

    // El ranking cacheado se sigue publicando tal cual…
    assert.equal(bundle.today.transitRanking.analysisId, "ORB-TRN-002");
    assert.equal(primerItem(bundle.today.transitRanking)?.arcId, items[0].arcId);
    // …y el arco incoherente NO: ni con su identidad, ni relabelado.
    assert.equal(bundle.today.transitArc.analysisId, "ORB-TRN-001");
    assert.equal(bundle.today.transitArc.data, null, "un arco que no corresponde no se publica");
    assert.notEqual(bundle.today.transitArc.status, "stale", "no hay fila correspondiente que mostrar");
    assert.ok(bundle.today.transitArc.missingInputs.includes("matching_transit_arc"));
    assert.equal(
      bundle.today.transitArc.methodVersion,
      getAnalysisDefinition("ORB-TRN-001").methodVersion,
      "el hueco sigue siendo ORB-TRN-001, con su método",
    );
    assert.equal(bundle.today.transitArc.inputHash, arco.inputHash, "ocupa el mismo alcance");
  });
});

test("la coherencia mira el arcId Y la tupla: cada mentira por separado se descarta", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { ranking, arco, items } = await parDelDia(state, localDate, timezone);
    const vigente = arcData(arco);
    assert.ok(vigente);

    const otroItem = items.find((item) => item.transitPlanet !== items[0].transitPlanet);
    assert.ok(otroItem, "el fixture necesita dos planetas distintos en la lista");

    const casos = [
      {
        nombre: "mismo contacto, identidad ajena",
        data: { ...vigente, arcId: "arc_v1_identidadvieja" },
      },
      {
        nombre: "misma identidad, otro contacto",
        data: { ...vigente, transitPlanet: otroItem.transitPlanet },
      },
    ] as const;

    for (const caso of casos) {
      const contaminado: AnalysisResult = { ...arco, data: caso.data };
      const filas = [ranking, contaminado].map((result) =>
        snapshotRow({ result, userId: state.userId, localDate, timezone }),
      );
      const bundle = await callHandler<{ today: { transitArc: AnalysisResult } }>(
        getForDate,
        queryCtx(state, filas),
        { localDate, timezone },
      );
      assert.equal(bundle.today.transitArc.data, null, caso.nombre);
      assert.ok(bundle.today.transitArc.missingInputs.includes("matching_transit_arc"), caso.nombre);
    }
  });
});

test("sin efeméride, el rescate de los dos stale tampoco publica un par incoherente", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const base = refreshState();
    const { ranking, arco, items } = await parDelDia(base, localDate, timezone);
    const otro = await callHandler<AnalysisResult>(refreshTransitArc, actionContext(base).ctx, {
      localDate,
      timezone,
      arcId: items[1].arcId,
    });
    const ajeno: AnalysisResult = { ...otro, inputHash: arco.inputHash };

    // Proveedor caído y sin cielo guardado: los dos sobres se rescatan por
    // separado del cache, que es donde el par podía divergir para siempre.
    const caido = refreshState({ sky: null, snapshots: [ranking, ajeno] });
    const { ctx, persisted } = actionContext(caido);
    const bundle = await callHandler<{
      today: { transitRanking: AnalysisResult; transitArc: AnalysisResult };
    }>(refreshForDate, ctx, { localDate, timezone });

    // El ranking stale sigue siendo el último dato personal disponible…
    assert.equal(bundle.today.transitRanking.status, "stale");
    assert.equal(primerItem(bundle.today.transitRanking)?.arcId, items[0].arcId);
    // …y el arco ajeno no se rescata detrás de él.
    assert.equal(bundle.today.transitArc.analysisId, "ORB-TRN-001");
    assert.equal(bundle.today.transitArc.data, null);
    assert.equal(bundle.today.transitArc.status, "error", "sin cielo, el hecho es que no se pudo calcular");
    assert.ok(bundle.today.transitArc.validUntil !== null, "un error necesita fecha de reintento");
    assert.ok(bundle.today.transitArc.missingInputs.includes("current_ephemeris"));
    assert.ok(bundle.today.transitArc.missingInputs.includes("matching_transit_arc"));

    // Y la fila incoherente queda REEMPLAZADA: el defecto no sobrevive al refresh.
    const escritos = (persisted[0]?.results as AnalysisResult[]).filter(
      (result) => result.analysisId === "ORB-TRN-001",
    );
    assert.equal(escritos.length, 1);
    assert.equal(escritos[0].inputHash, arco.inputHash);
    assert.equal(escritos[0].data, null);
    assert.ok(escritos[0].observedAt > ajeno.observedAt, "la fila nueva tiene que ganarle a la vieja");
  });
});

test("un par cacheado COHERENTE se reutiliza entero, en la lectura y en el rescate", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { ranking, arco, items } = await parDelDia(state, localDate, timezone);

    // Lectura pura: el sobre guardado vuelve idéntico.
    const filas = [ranking, arco].map((result) =>
      snapshotRow({ result, userId: state.userId, localDate, timezone }),
    );
    const leido = await callHandler<{
      today: { transitRanking: AnalysisResult; transitArc: AnalysisResult };
    }>(getForDate, queryCtx(state, filas), { localDate, timezone });
    assert.deepEqual(leido.today.transitArc, arco, "la coherencia invalida por identidad, no por desconfianza");
    assert.equal(arcData(leido.today.transitArc)?.arcId, primerItem(leido.today.transitRanking)?.arcId);
    assert.deepEqual(
      tupla(arcData(leido.today.transitArc)),
      tupla(primerItem(leido.today.transitRanking)),
    );

    // Rescate sin efeméride: los dos llegan stale, con dato y correspondiéndose.
    const caido = refreshState({ sky: null, snapshots: [ranking, arco] });
    const bundle = await callHandler<{
      today: { transitRanking: AnalysisResult; transitArc: AnalysisResult };
    }>(refreshForDate, actionContext(caido).ctx, { localDate, timezone });
    assert.equal(bundle.today.transitArc.status, "stale");
    assert.equal(arcData(bundle.today.transitArc)?.arcId, items[0].arcId);
    assert.deepEqual(
      tupla(arcData(bundle.today.transitArc)),
      tupla(primerItem(bundle.today.transitRanking)),
    );
  });
});

test("un ranking SIN dato no contradice a nadie: el arco guardado se conserva", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { ranking, arco, items } = await parDelDia(state, localDate, timezone);

    // Un ranking `unavailable` no afirma nada sobre hoy. Retirar ahí el arco
    // tiraría el último dato personal disponible sin ganar ninguna verdad.
    const sinDato: AnalysisResult = {
      ...ranking,
      data: null,
      status: "unavailable",
      missingInputs: ["current_ephemeris"],
    };
    const filas = [sinDato, arco].map((result) =>
      snapshotRow({ result, userId: state.userId, localDate, timezone }),
    );
    const bundle = await callHandler<{
      today: { transitRanking: AnalysisResult; transitArc: AnalysisResult };
    }>(getForDate, queryCtx(state, filas), { localDate, timezone });

    assert.equal(bundle.today.transitRanking.data, null);
    assert.deepEqual(bundle.today.transitArc, arco, "el arco se conserva tal cual");
    assert.equal(arcData(bundle.today.transitArc)?.arcId, items[0].arcId);
  });
});

test("el arco de OTRO contacto sí declara un cálculo pendiente, con su propio mensaje", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { ranking, arco } = await parDelDia(state, localDate, timezone);
    const vigente = arcData(arco);
    assert.ok(vigente);

    const ajeno: AnalysisResult = { ...arco, data: { ...vigente, arcId: "arc_v1_identidadvieja" } };
    const filas = [ranking, ajeno].map((result) =>
      snapshotRow({ result, userId: state.userId, localDate, timezone }),
    );
    const bundle = await callHandler<{ today: { transitArc: AnalysisResult } }>(
      getForDate,
      queryCtx(state, filas),
      { localDate, timezone },
    );

    // Hay lista y hay un tránsito encabezándola: acá SÍ falta un cálculo, y el
    // mensaje visible es el de un cálculo pendiente, no el de una lista vacía.
    assert.ok(bundle.today.transitArc.missingInputs.includes("matching_transit_arc"));
    assert.ok(!bundle.today.transitArc.missingInputs.includes("active_transit_arc"));
    assert.deepEqual(missingReasons(bundle.today.transitArc as never), [
      "Todavía no está calculado el arco del tránsito que hoy encabeza tu lista.",
    ]);
  });
});

test("un ranking cacheado VACÍO no rescata ningún arco con dato", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { ranking, arco } = await parDelDia(state, localDate, timezone);
    const lista = ranking.data?.kind === "transit_ranking" ? ranking.data : null;
    assert.ok(lista);

    // La lista dice que hoy no encabeza ningún contacto: contra eso, cualquier
    // arco con dato es el de otro contacto.
    const vacio: AnalysisResult = { ...ranking, data: { ...lista, items: [], activeCount: 0 } };
    const filas = [vacio, arco].map((result) =>
      snapshotRow({ result, userId: state.userId, localDate, timezone }),
    );
    const bundle = await callHandler<{
      today: { transitRanking: AnalysisResult; transitArc: AnalysisResult };
    }>(getForDate, queryCtx(state, filas), { localDate, timezone });

    assert.equal(primerItem(bundle.today.transitRanking), null);
    assert.equal(bundle.today.transitArc.analysisId, "ORB-TRN-001");
    assert.equal(bundle.today.transitArc.data, null);
    // El MOTIVO importa tanto como el retiro. La lista vacía ya afirmó que hoy
    // no encabeza ningún contacto: el hecho es que no hay tránsito activo, no
    // que falte calcular el arco de uno que la propia lista dice que no existe.
    assert.ok(bundle.today.transitArc.missingInputs.includes("active_transit_arc"));
    assert.ok(
      !bundle.today.transitArc.missingInputs.includes("matching_transit_arc"),
      "no se puede prometer el arco de un tránsito que hoy no encabeza nada"
    );
    assert.deepEqual(missingReasons(bundle.today.transitArc as never), [
      "Hoy no hay ningún tránsito mayor activo para formar un arco."
    ]);
  });
});

test("un sobre NEGATIVO cacheado no sobrevive a la lista vacía que lo desmiente", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { ranking, arco } = await parDelDia(state, localDate, timezone);
    const lista = ranking.data?.kind === "transit_ranking" ? ranking.data : null;
    assert.ok(lista);

    // El sobre que dejaba una corrida anterior: sin dato y prometiendo el
    // cálculo del arco del tránsito que encabezaba la lista de ENTONCES. La
    // coherencia lo daba por bueno apenas veía `data === null`, sin mirar el
    // ranking, así que ese copy falso duraba hasta `validUntil` —o para siempre
    // si era `null`—.
    const negativo: AnalysisResult = {
      ...arco,
      data: null,
      status: "unavailable",
      validUntil: null,
      missingInputs: ["matching_transit_arc"],
      limitations: [
        "El arco guardado describe otro tránsito que el que hoy encabeza tu lista, así que no se muestra: se vuelve a calcular con el próximo cielo.",
      ],
    };
    const vacio: AnalysisResult = { ...ranking, data: { ...lista, items: [], activeCount: 0 } };
    const filas = [vacio, negativo].map((result) =>
      snapshotRow({ result, userId: state.userId, localDate, timezone }),
    );
    const bundle = await callHandler<{
      today: { transitRanking: AnalysisResult; transitArc: AnalysisResult };
    }>(getForDate, queryCtx(state, filas), { localDate, timezone });

    assert.equal(primerItem(bundle.today.transitRanking), null, "la lista de hoy está vacía");
    assert.equal(bundle.today.transitArc.analysisId, "ORB-TRN-001");
    assert.equal(bundle.today.transitArc.data, null);
    // El hecho de hoy reemplaza a la promesa vieja, no se le suma.
    assert.ok(bundle.today.transitArc.missingInputs.includes("active_transit_arc"));
    assert.ok(
      !bundle.today.transitArc.missingInputs.includes("matching_transit_arc"),
      "no se puede prometer el arco de un tránsito que hoy no encabeza nada",
    );
    assert.deepEqual(missingReasons(bundle.today.transitArc as never), [
      "Hoy no hay ningún tránsito mayor activo para formar un arco.",
    ]);
    // Y la limitación no dice más de lo que sabe: no hubo arco que retirar.
    assert.ok(
      bundle.today.transitArc.limitations.some((linea) =>
        linea.includes("Hoy no hay ningún tránsito encabezando tu lista"),
      ),
    );
    assert.ok(
      !bundle.today.transitArc.limitations.some((linea) => linea.includes("describe otro tránsito")),
      "la limitación vieja no sobrevive",
    );
    // Método, alcance y estado quedan compatibles.
    assert.equal(
      bundle.today.transitArc.methodVersion,
      getAnalysisDefinition("ORB-TRN-001").methodVersion,
    );
    assert.equal(bundle.today.transitArc.inputHash, arco.inputHash, "ocupa el mismo alcance");
    assert.notEqual(bundle.today.transitArc.status, "stale");
  });
});

test("con un tránsito encabezando la lista, un sobre sin arco declara el cálculo pendiente", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { ranking, arco } = await parDelDia(state, localDate, timezone);

    // El caso simétrico: el sobre guardado dice "hoy no hay tránsito activo" y
    // la lista de ahora dice que sí hay uno. Lo que falta es su cálculo.
    const negativo: AnalysisResult = {
      ...arco,
      data: null,
      status: "unavailable",
      validUntil: null,
      missingInputs: ["active_transit_arc"],
      limitations: ["Hoy no hay ningún tránsito encabezando tu lista, así que no hay arco que mostrar."],
    };
    const filas = [ranking, negativo].map((result) =>
      snapshotRow({ result, userId: state.userId, localDate, timezone }),
    );
    const bundle = await callHandler<{ today: { transitArc: AnalysisResult } }>(
      getForDate,
      queryCtx(state, filas),
      { localDate, timezone },
    );

    assert.equal(bundle.today.transitArc.data, null);
    assert.ok(bundle.today.transitArc.missingInputs.includes("matching_transit_arc"));
    assert.ok(!bundle.today.transitArc.missingInputs.includes("active_transit_arc"));
    assert.deepEqual(missingReasons(bundle.today.transitArc as never), [
      "Todavía no está calculado el arco del tránsito que hoy encabeza tu lista.",
    ]);
  });
});

test("un sobre sin dato que YA dice el hecho de hoy se conserva con sus propias palabras", async () => {
  await withoutAstrologyCredentials(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = refreshState();
    const { ranking, arco } = await parDelDia(state, localDate, timezone);
    const lista = ranking.data?.kind === "transit_ranking" ? ranking.data : null;
    assert.ok(lista);

    // Éste es el sobre que publica el propio cálculo cuando no hay contacto
    // principal: su limitación explica MEJOR por qué hoy no hay arco. Reescribirlo
    // sería perder esa explicación sin ganar ninguna verdad.
    const propio: AnalysisResult = {
      ...arco,
      data: null,
      status: "unavailable",
      missingInputs: ["active_transit_arc"],
      limitations: [
        "El seguimiento de un proceso aparece sólo cuando hay un contacto principal activo a 3° o menos de su máxima precisión.",
      ],
    };
    const vacio: AnalysisResult = { ...ranking, data: { ...lista, items: [], activeCount: 0 } };
    const filas = [vacio, propio].map((result) =>
      snapshotRow({ result, userId: state.userId, localDate, timezone }),
    );
    const bundle = await callHandler<{ today: { transitArc: AnalysisResult } }>(
      getForDate,
      queryCtx(state, filas),
      { localDate, timezone },
    );

    assert.deepEqual(bundle.today.transitArc, propio, "ya estaba diciendo lo correcto");
  });
});
