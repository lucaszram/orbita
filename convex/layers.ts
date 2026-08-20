import {
  actionGeneric as action,
  type FunctionReference,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  queryGeneric as query,
} from "convex/server";
import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { QueryCtx } from "./_generated/server";
import { getAnalysisDefinition, getSourceRefs, type AnalysisId } from "./content/astrologySources";
import { runAstrologyApiPlanetsTropical } from "./lib/astrologyApi";
import { findCurrentBirthData, findExactNatalChart } from "./lib/birthDataConsistency";
import { resolveZonedCivilTime } from "./lib/civilTime";
import {
  ASTROLOGY_EDITORIAL_COPY_VERSION,
  buildAnnualProfectionLayerData,
  buildCumplelunaLayerData,
  buildCurrentMoonLayerData,
  buildNatalLayerData,
  buildProgressedLunationLayerData,
  buildTemporalMandalaData,
  buildTransitArcLayerData,
  buildTransitRankingLayerData,
  type LayerChartInput,
  type LayerDataBuild,
} from "./lib/layerAssembly";
import {
  analysisResultValidator,
  birthDataSnapshotValidator,
  ephemerisPositionValidator,
  layerBundleValidator,
  natalBaseBundleValidator,
  normalizedChartSnapshotValidator,
  transitArcResultValidator,
  type AnalysisData,
  type AnalysisPrecision,
  type AnalysisResult,
  type AnalysisStatus,
  type AnnualProfectionResult,
  type BirthDataSnapshot,
  type CumplelunaResult,
  type ElementMapResult,
  type EphemerisPosition,
  type LunarTypeResult,
  type MoonOnChartResult,
  type NormalizedChartSnapshot,
  type ProgressedLunationResult,
  type RelationshipPatternResult,
  type TemporalMandalaResult,
  type TransitArcResult,
  type TransitRankingResult,
} from "./lib/layerContract";
import {
  chartSnapshotFromPayload,
  intervalPointKey,
  verifiedAngleDegrees,
  verifiedChartGeometry,
} from "./lib/natalGeometry";
import {
  natalChartBaseValidator,
  type CanonicalNatalAngle,
  type CanonicalNatalAspect,
  type CanonicalNatalAspectType,
  type CanonicalNatalHouse,
  type CanonicalNatalPlanetKey,
  type CanonicalNatalPosition,
  type NatalChartBase,
} from "./lib/natalChartBaseContract";
import {
  MILLISECONDS_PER_DAY,
  SYNODIC_MONTH_DAYS,
  TROPICAL_YEAR_DAYS,
  ZODIAC_SIGNS,
  elementForSign,
  findCumplelunaCrossing,
  findLunarPhaseBoundaryCrossing,
  interpolateCircularDegrees,
  lunarElongationDegrees,
  lunarPhaseAtElongation,
  nextLunarPhaseBoundaryDegrees,
  normalizeZodiacSign,
  parseIsoCivilDate,
  personalLunationPosition,
  previousLunarPhaseBoundaryDegrees,
  progressedBoundaryRange,
  secondaryProgressedInstant,
  shortestSignedAngularDelta,
  traditionalRulerForSign,
  unwrapDegrees,
} from "./lib/layersMath";
import { stableInputHash } from "./lib/stableHash";
import { isUserPro } from "./lib/subscriptionAccess";
import {
  matchMajorAspect,
  rankTransitContacts,
  type TransitContactInput,
} from "./lib/transitLayers";
import {
  createTransitTimelineSingleFlight,
  resolveVerifiedTransitTimeline,
  type TransitTimelineResolution,
} from "./lib/transitTimeline";
import { findCurrentUser, findUserByTokenIdentifier, omitUndefined } from "./lib/users";

const HOUR_MS = 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * HOUR_MS;
const NATAL_EPHEMERIS_METHOD_VERSION = "natal-ephemeris-planets-tropical-cache-v1";
const NATAL_EPHEMERIS_PROVIDER_VERSION = "astrologyapi-planets-tropical-v1";
const PROGRESSED_PROGRESS_CONTRACT_VERSION = "progress-range-v1";
// Congela también la política de aspectos mayores: 0°/60°/90°/120°/180°
// con orbes máximos 6°/4°/5°/5°/6°. Un cambio de esos valores requiere v2.
const NATAL_CHART_BASE_METHOD_VERSION = "canonical-natal-chart-base-v1";
const NATAL_INTERVAL_PLANETS = [
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

const skySnapshotValidator = v.object({
  providerVersion: v.string(),
  observedAt: v.number(),
  validUntil: v.number(),
  positions: v.array(ephemerisPositionValidator),
});

const natalEphemerisSampleValidator = v.object({
  instantMs: v.number(),
  positions: v.array(ephemerisPositionValidator),
});

const natalEphemerisSnapshotValidator = v.object({
  inputHash: v.string(),
  methodVersion: v.string(),
  providerVersion: v.string(),
  birthTimePrecision: v.union(
    v.literal("known"),
    v.literal("approximate"),
    v.literal("unknown"),
  ),
  samples: v.array(natalEphemerisSampleValidator),
  calculatedAt: v.number(),
});

const refreshStateValidator = v.object({
  userId: v.id("users"),
  birthDataId: v.union(v.id("birthData"), v.null()),
  natalChartId: v.union(v.id("natalCharts"), v.null()),
  birthData: v.union(birthDataSnapshotValidator, v.null()),
  chart: v.union(normalizedChartSnapshotValidator, v.null()),
  natalEphemeris: v.union(natalEphemerisSnapshotValidator, v.null()),
  snapshots: v.array(analysisResultValidator),
  sky: v.union(skySnapshotValidator, v.null()),
});

type RefreshState = Infer<typeof refreshStateValidator>;
type SkySnapshot = Infer<typeof skySnapshotValidator>;
type NatalEphemerisSnapshot = Infer<typeof natalEphemerisSnapshotValidator>;
type PersistRefreshArgs = {
  userId: RefreshState["userId"];
  birthDataId: RefreshState["birthDataId"];
  natalChartId: RefreshState["natalChartId"];
  expectedInputFingerprint: string;
  localDate: string;
  timezone: string;
  results: AnalysisResult[];
  sky: SkySnapshot | null;
  natalEphemeris: NatalEphemerisSnapshot | null;
};

const internalApi: {
  layers: {
    getRefreshState: FunctionReference<
      "query",
      "internal",
      { tokenIdentifier: string; localDate: string; timezone: string },
      RefreshState
    >;
    persistRefresh: FunctionReference<"mutation", "internal", PersistRefreshArgs, { written: number }>;
  };
} = internal;

function assertLocalDate(localDate: string) {
  try {
    parseIsoCivilDate(localDate);
  } catch {
    throw new Error("localDate must be a real date in YYYY-MM-DD format");
  }
}

function assertTimezone(timezone: string) {
  if (!timezone.trim() || timezone.length > 80) throw new Error("A valid IANA timezone is required");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
  } catch {
    throw new Error("A valid IANA timezone is required");
  }
}

// El `arcId` entra al alcance de un cache y al hash de un resultado, así que su
// forma se valida antes de leer datos: identificador opaco del motor de arcos,
// sin espacios ni caracteres que puedan disfrazar dos claves como una.
const ARC_ID_PATTERN = /^[A-Za-z0-9_:-]{1,80}$/;

function assertArcId(arcId: string) {
  if (!ARC_ID_PATTERN.test(arcId)) throw new Error("arcId must be an opaque transit arc identifier");
}

function snapshotBirthData(document: {
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: "known" | "approximate" | "unknown";
  birthPlaceLabel: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  updatedAt: number;
} | null): BirthDataSnapshot | null {
  if (!document) return null;
  return {
    birthDate: document.birthDate,
    birthTime: document.birthTime ?? null,
    birthTimePrecision: document.birthTimePrecision,
    birthPlaceLabel: document.birthPlaceLabel,
    latitude: document.latitude ?? null,
    longitude: document.longitude ?? null,
    timezone: document.timezone,
    updatedAt: document.updatedAt,
  };
}

/**
 * El payload guardado en `natalCharts`, estrechado a la forma del contrato.
 * La forma la define `lib/natalGeometry`, que es donde `charts.ts` la lee para
 * decidir si la carta guardada alcanza: dos lecturas distintas del mismo
 * payload podrían discrepar sobre si falta geometría.
 */
function snapshotChart(payload: unknown): NormalizedChartSnapshot | null {
  return chartSnapshotFromPayload(payload);
}

function publicResult(row: {
  analysisId: AnalysisId;
  methodVersion: string;
  providerVersion?: string;
  inputHash: string;
  status: AnalysisStatus;
  precision: AnalysisPrecision;
  observedAt: number;
  validUntil: number | null;
  data: AnalysisData | null;
  missingInputs: string[];
  limitations: string[];
  elaboration: "direct" | "orbita_synthesis" | "experimental";
  sourceRefs: AnalysisResult["sourceRefs"];
}): AnalysisResult {
  return omitUndefined({
    analysisId: row.analysisId,
    methodVersion: row.methodVersion,
    providerVersion: row.providerVersion,
    inputHash: row.inputHash,
    status: row.status,
    precision: row.precision,
    observedAt: row.observedAt,
    validUntil: row.validUntil,
    data: row.data,
    missingInputs: row.missingInputs,
    limitations: row.limitations,
    elaboration: row.elaboration,
    sourceRefs: row.sourceRefs,
  }) as AnalysisResult;
}

function natalEphemerisInputHash(birthData: BirthDataSnapshot | null) {
  if (!birthData) return stableInputHash({ methodVersion: NATAL_EPHEMERIS_METHOD_VERSION, birth: null });
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

function natalEphemerisCacheKey(userId: string, birthData: BirthDataSnapshot | null) {
  return [
    "v492",
    "natal-ephemeris",
    userId,
    NATAL_EPHEMERIS_METHOD_VERSION,
    natalEphemerisInputHash(birthData),
  ].join(":");
}

function inputIdentity(args: {
  birthData: BirthDataSnapshot | null;
  natalEphemeris: NatalEphemerisSnapshot | null;
  chart: NormalizedChartSnapshot | null;
}) {
  return stableInputHash({
    identityVersion: "canonical-natal-base-v1",
    natalInputHash: natalEphemerisInputHash(args.birthData),
    canonicalEphemeris: args.natalEphemeris
      ? {
          inputHash: args.natalEphemeris.inputHash,
          methodVersion: args.natalEphemeris.methodVersion,
          providerVersion: args.natalEphemeris.providerVersion,
          sampleFingerprint: stableInputHash(args.natalEphemeris.samples),
        }
      : null,
    // Legacy chart payloads contribute only verified house cusps and angles.
    // Planetary longitudes are always taken from planets/tropical.
    exactHouseGeometry: args.chart,
  });
}

function cacheKey(args: {
  userId: string;
  result: AnalysisResult;
  localDate: string;
  timezone: string;
}) {
  const daily = ["ORB-TRN-002", "ORB-TRN-001", "ORB-LUN-003", "ORB-CYC-007"].includes(
    args.result.analysisId,
  );
  return [
    "v492",
    args.userId,
    args.result.analysisId,
    args.result.methodVersion,
    args.result.inputHash,
    daily ? args.localDate : "base",
    daily ? args.timezone : "natal",
  ].join(":");
}

function unavailableResult(
  analysisId: AnalysisId,
  inputHash: string,
  observedAt: number,
  missingInputs: string[],
  options: {
    status?: Extract<AnalysisStatus, "partial" | "needs_birth_time" | "unavailable" | "error">;
    precision?: AnalysisPrecision;
    limitations?: string[];
    validUntil?: number | null;
  } = {},
): AnalysisResult {
  const definition = getAnalysisDefinition(analysisId);
  return {
    analysisId,
    methodVersion: definition.methodVersion,
    inputHash,
    status: options.status ?? "unavailable",
    precision: options.precision ?? "not_applicable",
    observedAt,
    validUntil: options.validUntil ?? null,
    data: null,
    missingInputs,
    limitations: [...definition.limitations, ...(options.limitations ?? [])],
    elaboration: definition.elaboration,
    sourceRefs: getSourceRefs(analysisId),
  };
}

function staleIfExpired(result: AnalysisResult, now: number): AnalysisResult {
  if (
    result.data === null ||
    result.validUntil === null ||
    result.validUntil > now ||
    result.status === "stale"
  ) {
    return result;
  }
  return {
    ...result,
    status: "stale",
    limitations: [
      ...result.limitations,
      "Este cálculo ya superó su período de vigencia y se muestra como último dato disponible.",
    ],
  };
}

function resultHash(baseHash: string, analysisId: AnalysisId, scope?: Record<string, unknown>) {
  const definition = getAnalysisDefinition(analysisId);
  return stableInputHash({ baseHash, analysisId, methodVersion: definition.methodVersion, scope: scope ?? null });
}

export function buildNatalAnalysisInputHash(baseHash: string, analysisId: AnalysisId) {
  return analysisId === "ORB-NAT-001"
    ? resultHash(baseHash, analysisId, {
        editorialCopyVersion: ASTROLOGY_EDITORIAL_COPY_VERSION,
      })
    : resultHash(baseHash, analysisId);
}

function progressedLunationInputHash(baseHash: string) {
  return resultHash(baseHash, "ORB-CYC-002", {
    progressContract: PROGRESSED_PROGRESS_CONTRACT_VERSION,
  });
}

function temporalMandalaInputHash(
  baseHash: string,
  dailyScope: { localDate: string; timezone: string },
  sources: readonly AnalysisResult[],
) {
  return resultHash(baseHash, "ORB-CYC-007", {
    ...dailyScope,
    ringSources: sources.map((source) => ({
      analysisId: source.analysisId,
      methodVersion: source.methodVersion,
      inputHash: source.inputHash,
      precision: source.precision,
      missingInputs: [...source.missingInputs].sort(),
      dataFingerprint: stableInputHash(source.data),
    })),
  });
}

function temporalMandalaValidUntil(observedAt: number, sources: readonly AnalysisResult[]) {
  const deadlines = sources
    .filter((source) => source.data !== null)
    .map((source) => source.validUntil)
    .filter((deadline): deadline is number => deadline !== null && Number.isFinite(deadline));
  return Math.min(observedAt + HOUR_MS, ...deadlines);
}

function wrapBuild<T extends AnalysisData>(args: {
  analysisId: AnalysisId;
  inputHash: string;
  observedAt: number;
  validUntil: number | null;
  build: LayerDataBuild<T>;
  providerVersion?: string;
  forceStatus?: AnalysisStatus;
  extraLimitations?: string[];
}): AnalysisResult {
  const definition = getAnalysisDefinition(args.analysisId);
  return omitUndefined({
    analysisId: args.analysisId,
    methodVersion: definition.methodVersion,
    providerVersion: args.providerVersion,
    inputHash: args.inputHash,
    status: args.forceStatus ?? args.build.status,
    precision: args.build.precision,
    observedAt: args.observedAt,
    validUntil: args.validUntil,
    data: args.build.data,
    missingInputs: args.build.missingInputs,
    limitations: [
      ...definition.limitations,
      ...args.build.limitations,
      ...(args.extraLimitations ?? []),
    ],
    elaboration: definition.elaboration,
    sourceRefs: getSourceRefs(args.analysisId),
  }) as AnalysisResult;
}

function toLayerChart(
  birthData: BirthDataSnapshot | null,
  chart: NormalizedChartSnapshot | null,
): LayerChartInput | null {
  if (!birthData || !chart) return null;
  return {
    birth: {
      birthDate: birthData.birthDate,
      birthTimePrecision: birthData.birthTimePrecision,
    },
    placements: chart.placements.map((placement) => ({
      ...placement,
      source: "astrologyapi" as const,
    })),
    houses: chart.houses,
  };
}

function position(ephemeris: readonly EphemerisPosition[], key: string) {
  return ephemeris.find((candidate) => candidate.key === key) ?? null;
}

function natalPosition(chart: LayerChartInput | null, key: string) {
  return chart?.placements.find((candidate) => candidate.key === key) ?? null;
}

type NatalIntervalPlanet = (typeof NATAL_INTERVAL_PLANETS)[number];
type NatalDaySamples = {
  instants: number[];
  sun: number[];
  moon: number[];
  byPlanet: Partial<Record<NatalIntervalPlanet, number[]>>;
  speedByPlanet: Partial<Record<NatalIntervalPlanet, number[]>>;
};

// Conservative upper bounds for geocentric motion over one civil day. The
// three provider samples are not treated as a proof by themselves: each pair
// brackets at most half a day, and a result is called stable only when every
// endpoint remains farther from the relevant boundary than the conservative
// half-day motion bound. Near a boundary, the layer is withdrawn or ranged.
const MAX_NATAL_MOTION_PER_DAY: Record<NatalIntervalPlanet, number> = {
  sun: 1.25,
  moon: 17,
  mercury: 2.75,
  venus: 1.75,
  mars: 1.25,
  jupiter: 0.35,
  saturn: 0.2,
  uranus: 0.12,
  neptune: 0.08,
  pluto: 0.08,
};

function normalizedDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function distanceToPeriodicBoundary(value: number, intervalDegrees: number) {
  const within = normalizedDegrees(value) % intervalDegrees;
  return Math.min(within, intervalDegrees - within);
}

function segmentMotionMargin(
  key: NatalIntervalPlanet,
  instants: readonly number[],
  segmentIndex: number,
  speeds?: readonly number[],
) {
  const durationDays = Math.abs(instants[segmentIndex + 1] - instants[segmentIndex]) / MILLISECONDS_PER_DAY;
  const observedBound = Math.max(
    0,
    ...[speeds?.[segmentIndex], speeds?.[segmentIndex + 1]]
      .filter((speed): speed is number => typeof speed === "number" && Number.isFinite(speed))
      .map((speed) => Math.abs(speed) * 1.25),
  );
  return Math.max(MAX_NATAL_MOTION_PER_DAY[key], observedBound) * durationDays;
}

function certifiesNoSignCrossing(
  key: NatalIntervalPlanet,
  samples: readonly number[],
  instants: readonly number[],
  speeds?: readonly number[],
) {
  if (samples.length < 3 || samples.length !== instants.length) return false;
  for (let index = 0; index < samples.length - 1; index += 1) {
    const margin = segmentMotionMargin(key, instants, index, speeds);
    if (
      signIndexAtLongitude(samples[index]) !== signIndexAtLongitude(samples[index + 1]) ||
      distanceToPeriodicBoundary(samples[index], 30) <= margin ||
      distanceToPeriodicBoundary(samples[index + 1], 30) <= margin
    ) return false;
  }
  return true;
}

function conservativeSignLabels(
  key: NatalIntervalPlanet,
  samples: readonly number[],
  instants: readonly number[],
  speeds?: readonly number[],
) {
  const candidates = new Set<number>();
  for (let index = 0; index < samples.length; index += 1) {
    const adjacentMargins = [index - 1, index]
      .filter((segment) => segment >= 0 && segment < instants.length - 1)
      .map((segment) => segmentMotionMargin(key, instants, segment, speeds));
    const margin = adjacentMargins.length > 0 ? Math.max(...adjacentMargins) : MAX_NATAL_MOTION_PER_DAY[key];
    const sample = samples[index];
    candidates.add(signIndexAtLongitude(sample));
    candidates.add(signIndexAtLongitude(sample - margin));
    candidates.add(signIndexAtLongitude(sample + margin));
  }
  return Array.from(candidates)
    .sort((left, right) => left - right)
    .map((index) => SIGN_LABELS_ES[index]);
}

function certifiesSingleLunarPhase(samples: NatalDaySamples) {
  if (samples.sun.length < 3 || samples.moon.length < 3) return false;
  const elongations = samples.moon.map((moon, index) =>
    lunarElongationDegrees(samples.sun[index], moon),
  );
  const phases = new Set(elongations.map((value) => lunarPhaseAtElongation(value).index));
  if (phases.size !== 1 || samples.instants.length !== elongations.length) return false;
  for (let index = 0; index < elongations.length - 1; index += 1) {
    const margin =
      segmentMotionMargin("sun", samples.instants, index, samples.speedByPlanet.sun) +
      segmentMotionMargin("moon", samples.instants, index, samples.speedByPlanet.moon);
    if (
      distanceToPeriodicBoundary(elongations[index], 45) <= margin ||
      distanceToPeriodicBoundary(elongations[index + 1], 45) <= margin
    ) return false;
  }
  return true;
}

const SIGN_LABELS_ES = [
  "Aries",
  "Tauro",
  "Géminis",
  "Cáncer",
  "Leo",
  "Virgo",
  "Libra",
  "Escorpio",
  "Sagitario",
  "Capricornio",
  "Acuario",
  "Piscis",
] as const;

function hasCanonicalPlanetSet(positions: readonly EphemerisPosition[]) {
  if (positions.length !== NATAL_INTERVAL_PLANETS.length) return false;
  const keys = positions.map((candidate) => candidate.key);
  return NATAL_INTERVAL_PLANETS.every(
    (key) => keys.filter((candidate) => candidate === key).length === 1,
  );
}

function expectedNatalSampleInstants(birthData: BirthDataSnapshot) {
  try {
    if (birthData.birthTimePrecision === "known") {
      if (!birthData.birthTime) return null;
      return [zonedInstant(birthData.birthDate, birthData.birthTime, birthData.timezone)];
    }
    return ["00:00", "12:00", "23:59"].map((time) =>
      zonedInstant(birthData.birthDate, time, birthData.timezone),
    );
  } catch {
    return null;
  }
}

function matchingNatalEphemeris(
  birthData: BirthDataSnapshot | null,
  snapshot: NatalEphemerisSnapshot | null | undefined,
) {
  if (!birthData || !snapshot) return null;
  const expectedInstants = expectedNatalSampleInstants(birthData);
  if (
    !expectedInstants ||
    snapshot.inputHash !== natalEphemerisInputHash(birthData) ||
    snapshot.methodVersion !== NATAL_EPHEMERIS_METHOD_VERSION ||
    snapshot.providerVersion !== NATAL_EPHEMERIS_PROVIDER_VERSION ||
    snapshot.birthTimePrecision !== birthData.birthTimePrecision ||
    snapshot.samples.length !== expectedInstants.length
  ) {
    return null;
  }
  const ordered = [...snapshot.samples].sort((left, right) => left.instantMs - right.instantMs);
  if (
    ordered.some(
      (sample, index) =>
        sample.instantMs !== expectedInstants[index] || !hasCanonicalPlanetSet(sample.positions),
    )
  ) {
    return null;
  }
  return { ...snapshot, samples: ordered };
}

/**
 * La geometría verificable de la carta legada, sólo cuando la hora es exacta.
 *
 * La hora la decide esta capa —sin `known` no se publica ningún eje ni ninguna
 * casa— y qué es “verificable” lo decide `lib/natalGeometry`, que es la misma
 * regla con la que `charts.calculateOrCreateNatalChart` mide si la carta
 * guardada alcanza. Si las dos discreparan, el botón de recuperación de la
 * Carta pediría un cálculo que el cache devuelve idéntico.
 */
function verifiedLegacyGeometry(
  birthData: BirthDataSnapshot | null,
  chart: NormalizedChartSnapshot | null,
): NormalizedChartSnapshot | null {
  if (!birthData || birthData.birthTimePrecision !== "known") return null;
  return verifiedChartGeometry(chart);
}

export function buildLayerRefreshInputFingerprint(args: {
  userId: RefreshState["userId"] | string;
  birthDataId: RefreshState["birthDataId"] | string | null;
  natalChartId: RefreshState["natalChartId"] | string | null;
  birthData: BirthDataSnapshot | null;
  chart: NormalizedChartSnapshot | null;
}) {
  return stableInputHash({
    fingerprintVersion: "layer-refresh-input-v1",
    userId: String(args.userId),
    birthDataId: args.birthDataId === null ? null : String(args.birthDataId),
    natalChartId: args.natalChartId === null ? null : String(args.natalChartId),
    natalInputHash: natalEphemerisInputHash(args.birthData),
    // Los planetas legacy no son un input. Sólo las casas y los ángulos
    // verificados pueden cambiar un resultado personal de V4.9.2.
    exactHouseGeometry: verifiedLegacyGeometry(args.birthData, args.chart),
  });
}

function houseNumberForLongitude(
  houses: readonly NormalizedChartSnapshot["houses"][number][],
  longitude: number,
) {
  if (houses.length !== 12) return null;
  const normalize = (value: number) => ((value % 360) + 360) % 360;
  for (let index = 0; index < houses.length; index += 1) {
    const current = houses[index];
    const next = houses[(index + 1) % houses.length];
    if (typeof current.degree !== "number" || typeof next.degree !== "number") return null;
    const span = normalize(next.degree - current.degree);
    const offset = normalize(longitude - current.degree);
    if (span > 0 && offset < span) return current.house;
  }
  return null;
}

function natalDaySamplesFromEphemeris(
  birthData: BirthDataSnapshot | null,
  snapshot: NatalEphemerisSnapshot | null,
): NatalDaySamples | undefined {
  if (!birthData || birthData.birthTimePrecision === "known" || !snapshot) return undefined;
  const byPlanet: NatalDaySamples["byPlanet"] = {};
  const speedByPlanet: NatalDaySamples["speedByPlanet"] = {};
  for (const key of NATAL_INTERVAL_PLANETS) {
    const values = snapshot.samples.map((sample) => position(sample.positions, key)?.fullDegree);
    if (values.every((value): value is number => typeof value === "number" && Number.isFinite(value))) {
      byPlanet[key] = values;
    }
    const speeds = snapshot.samples.map((sample) => position(sample.positions, key)?.speed);
    if (speeds.every((value): value is number => typeof value === "number" && Number.isFinite(value))) {
      speedByPlanet[key] = speeds;
    }
  }
  return {
    instants: snapshot.samples.map((sample) => sample.instantMs),
    sun: byPlanet.sun ?? [],
    moon: byPlanet.moon ?? [],
    byPlanet,
    speedByPlanet,
  };
}

function canonicalNatalChart(args: {
  birthData: BirthDataSnapshot | null;
  legacyChart: NormalizedChartSnapshot | null;
  natalEphemeris: NatalEphemerisSnapshot | null;
}) {
  if (!args.birthData || !args.natalEphemeris) return null;
  const representative =
    args.natalEphemeris.samples[args.birthData.birthTimePrecision === "known" ? 0 : 1];
  if (!representative || !hasCanonicalPlanetSet(representative.positions)) return null;
  const geometry = verifiedLegacyGeometry(args.birthData, args.legacyChart);
  const houses = geometry?.houses ?? [];
  return {
    placements: [
      ...representative.positions.map((placement) => ({
        key: placement.key,
        label: placement.label,
        sign: placement.sign,
        signEs: placement.signEs,
        degree: placement.degree,
        fullDegree: placement.fullDegree,
        house:
          args.birthData?.birthTimePrecision === "known"
            ? houseNumberForLongitude(houses, placement.fullDegree)
            : null,
        isRetrograde: placement.isRetrograde,
      })),
      ...(geometry?.placements ?? []),
    ],
    houses,
  } satisfies NormalizedChartSnapshot;
}

function signIndexAtLongitude(longitude: number) {
  const normalized = ((longitude % 360) + 360) % 360;
  return Math.floor(normalized / 30);
}

function signLabelsForSamples(samples: readonly number[]) {
  return Array.from(new Set(samples.map((sample) => SIGN_LABELS_ES[signIndexAtLongitude(sample)])));
}

function elementKeysForSamples(samples: readonly number[]) {
  return Array.from(
    new Set(samples.map((sample) => elementForSign(ZODIAC_SIGNS[signIndexAtLongitude(sample)]))),
  );
}

function intervalAwareLunarType(
  build: LayerDataBuild<Extract<AnalysisData, { kind: "lunar_type" }>>,
  birthTimePrecision: BirthDataSnapshot["birthTimePrecision"] | null,
  samples: NatalDaySamples | null | undefined,
): LayerDataBuild<Extract<AnalysisData, { kind: "lunar_type" }>> {
  if (birthTimePrecision === "known" || build.data === null) return build;
  if (!samples || !certifiesSingleLunarPhase(samples)) {
    return {
      data: null,
      status: "partial",
      precision: "range",
      missingInputs: ["exact_birth_time_or_certified_lunar_phase"],
      limitations: [
        "Sin hora exacta, la Luna queda cerca de cambiar de fase durante tu día de nacimiento. Por eso mostramos un rango en vez de elegir una sola fase.",
      ],
    };
  }
  return {
    ...build,
    status: "partial",
    precision: "estimated",
    missingInputs: Array.from(new Set([...build.missingInputs, "exact_birth_time"])),
    limitations: [
      ...build.limitations,
      "Revisamos el comienzo, la mitad y el final de tu día de nacimiento, y la fase no cambia. Por eso podemos mostrarla como estimada.",
    ],
  };
}

function intervalAwareElementMap(
  build: LayerDataBuild<Extract<AnalysisData, { kind: "element_map" }>>,
  birthTimePrecision: BirthDataSnapshot["birthTimePrecision"] | null,
  samples: NatalDaySamples | null | undefined,
): LayerDataBuild<Extract<AnalysisData, { kind: "element_map" }>> {
  if (birthTimePrecision === "known" || build.data === null) return build;
  if (!samples) {
    return {
      data: null,
      status: "partial",
      precision: "range",
      missingInputs: ["full_day_natal_samples"],
      limitations: [
        "Sin hora exacta, necesitamos confirmar que ninguno de los diez planetas cambia de signo durante tu día de nacimiento antes de mostrar el conteo.",
      ],
    };
  }
  const unstable = NATAL_INTERVAL_PLANETS.filter((key) => {
    const values = samples.byPlanet[key];
    return (
      !values ||
      !certifiesNoSignCrossing(key, values, samples.instants, samples.speedByPlanet[key]) ||
      elementKeysForSamples(values).length !== 1
    );
  });
  if (unstable.length > 0) {
    return {
      data: null,
      status: "partial",
      precision: "range",
      missingInputs: unstable.map((key) => `stable_natal_${key}`),
      limitations: [
        "Al menos uno de los diez planetas puede cambiar de signo durante tu día de nacimiento, y eso cambiaría su elemento. Por eso no mostramos un único conteo.",
      ],
    };
  }
  return {
    ...build,
    status: "partial",
    precision: "estimated",
    missingInputs: Array.from(new Set([...build.missingInputs, "exact_birth_time"])),
    limitations: [
      ...build.limitations,
      "Revisamos el comienzo, la mitad y el final de tu día de nacimiento, y ninguno de los diez planetas cambia de signo. Por eso el conteo puede mostrarse como estimado.",
    ],
  };
}

function intervalAwareRelationshipPattern(
  build: LayerDataBuild<Extract<AnalysisData, { kind: "relationship_pattern" }>>,
  birthTimePrecision: BirthDataSnapshot["birthTimePrecision"] | null,
  samples: NatalDaySamples | null | undefined,
): LayerDataBuild<Extract<AnalysisData, { kind: "relationship_pattern" }>> {
  if (birthTimePrecision === "known" || build.data === null) return build;
  if (!samples) {
    return {
      data: null,
      status: "partial",
      precision: "range",
      missingInputs: ["full_day_natal_samples"],
      limitations: [
        "Sin hora exacta, comprobamos Luna, Venus y Marte al comienzo, a mitad y al final de tu día de nacimiento antes de mostrar el patrón relacional.",
      ],
    };
  }
  const facetPlanet = {
    emotional_need: "moon",
    affection_style: "venus",
    desire_style: "mars",
  } as const;
  const facets = build.data.facets.flatMap((facet) => {
    const key = facetPlanet[facet.key];
    const values = samples.byPlanet[key];
    if (!values || values.length < 3) return [];
    const signs = certifiesNoSignCrossing(
      key,
      values,
      samples.instants,
      samples.speedByPlanet[key],
    )
      ? signLabelsForSamples(values)
      : conservativeSignLabels(key, values, samples.instants, samples.speedByPlanet[key]);
    return [
      {
        ...facet,
        signs,
        precision: signs.length === 1 ? ("estimated" as const) : ("range" as const),
        summary:
          signs.length === 1
            ? `${facet.label} se mantiene en ${signs[0]} durante todo el día de nacimiento; la lectura es estimada porque falta la hora exacta.`
            : `${facet.label} puede estar en ${signs.join(" o ")} según la hora. Órbita conserva el rango en vez de elegir una versión falsa.`,
      },
    ];
  });
  if (facets.length === 0) {
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: ["stable_natal_moon_venus_mars"],
      limitations: ["No hubo muestras suficientes para sostener ningún componente del patrón relacional."],
    };
  }
  const includedPoints = facets.map((facet) => facet.label);
  const excludedPoints = [
    ...Object.entries(facetPlanet)
      .filter(([key]) => !facets.some((facet) => facet.key === key))
      .map(([, planet]) => planet === "moon" ? "Luna" : planet === "venus" ? "Venus" : "Marte"),
    "Descendente y casa 7",
  ];
  return {
    data: {
      ...build.data,
      facets,
      relationshipAxis: null,
      includedPoints,
      excludedPoints,
    },
    status: "partial",
    precision: facets.some((facet) => facet.precision === "range") ? "range" : "estimated",
    missingInputs: Array.from(new Set([...build.missingInputs, "exact_birth_time"])),
    limitations: [
      ...build.limitations,
      "El Descendente y la casa 7 quedan afuera hasta contar con una hora exacta.",
    ],
  };
}

const CANONICAL_PLANET_LABELS: Record<CanonicalNatalPlanetKey, string> = {
  sun: "Sol",
  moon: "Luna",
  mercury: "Mercurio",
  venus: "Venus",
  mars: "Marte",
  jupiter: "Júpiter",
  saturn: "Saturno",
  uranus: "Urano",
  neptune: "Neptuno",
  pluto: "Plutón",
};

const CANONICAL_NATAL_ASPECTS: ReadonlyArray<{
  type: CanonicalNatalAspectType;
  typeEs: string;
  angle: number;
  maxOrb: number;
}> = [
  { type: "conjunction", typeEs: "conjunción", angle: 0, maxOrb: 6 },
  { type: "sextile", typeEs: "sextil", angle: 60, maxOrb: 4 },
  { type: "square", typeEs: "cuadratura", angle: 90, maxOrb: 5 },
  { type: "trine", typeEs: "trígono", angle: 120, maxOrb: 5 },
  { type: "opposition", typeEs: "oposición", angle: 180, maxOrb: 6 },
];

function roundedPublicDegree(value: number) {
  return Number(value.toFixed(4));
}

function zodiacAtLongitude(longitude: number) {
  const index = signIndexAtLongitude(longitude);
  return {
    sign: ZODIAC_SIGNS[index],
    signEs: SIGN_LABELS_ES[index],
  };
}

function possibleZodiacSigns(
  key: NatalIntervalPlanet,
  values: readonly number[],
  samples: NatalDaySamples,
) {
  const spanish = conservativeSignLabels(
    key,
    values,
    samples.instants,
    samples.speedByPlanet[key],
  );
  const indexes = spanish
    .map((label) => SIGN_LABELS_ES.indexOf(label))
    .filter((index) => index >= 0);
  return {
    signs: indexes.map((index) => ZODIAC_SIGNS[index]),
    signsEs: indexes.map((index) => SIGN_LABELS_ES[index]),
  };
}

function omittedCanonicalPosition(key: CanonicalNatalPlanetKey, limitation: string): CanonicalNatalPosition {
  return {
    key,
    label: CANONICAL_PLANET_LABELS[key],
    source: "planets/tropical",
    precision: "omitted",
    sign: null,
    signEs: null,
    possibleSigns: [],
    possibleSignsEs: [],
    degree: null,
    fullDegree: null,
    house: null,
    isRetrograde: null,
    limitation,
  };
}

function publicCanonicalPositions(args: {
  birthData: BirthDataSnapshot | null;
  snapshot: NatalEphemerisSnapshot | null;
  samples: NatalDaySamples | undefined;
  geometry: NormalizedChartSnapshot | null;
  revealHouses: boolean;
}) {
  if (!args.birthData || !args.snapshot) {
    return NATAL_INTERVAL_PLANETS.map((key) =>
      omittedCanonicalPosition(
        key,
        !args.birthData
          ? "Faltan los datos de nacimiento para calcular esta posición."
          : "Todavía no hay una posición canónica calculada para estos datos de nacimiento.",
      ),
    );
  }

  if (args.birthData.birthTimePrecision === "known") {
    const sample = args.snapshot.samples[0];
    return NATAL_INTERVAL_PLANETS.map((key) => {
      const canonical = position(sample.positions, key);
      if (!canonical || !Number.isFinite(canonical.fullDegree)) {
        return omittedCanonicalPosition(key, "El proveedor no devolvió una longitud válida para esta posición.");
      }
      const fullDegree = normalizedDegrees(canonical.fullDegree);
      const zodiac = zodiacAtLongitude(fullDegree);
      return {
        key,
        label: CANONICAL_PLANET_LABELS[key],
        source: "planets/tropical" as const,
        precision: "exact" as const,
        sign: zodiac.sign,
        signEs: zodiac.signEs,
        possibleSigns: [zodiac.sign],
        possibleSignsEs: [zodiac.signEs],
        degree: fullDegree % 30,
        fullDegree,
        house:
          args.revealHouses && args.geometry?.houses.length === 12
            ? houseNumberForLongitude(args.geometry.houses, fullDegree)
            : null,
        isRetrograde: canonical.isRetrograde,
        limitation: null,
      } satisfies CanonicalNatalPosition;
    });
  }

  if (!args.samples) {
    return NATAL_INTERVAL_PLANETS.map((key) =>
      omittedCanonicalPosition(
        key,
        "Sin hora exacta hacen falta las muestras del día civil completo para certificar esta posición.",
      ),
    );
  }
  const samples = args.samples;

  return NATAL_INTERVAL_PLANETS.map((key) => {
    const values = samples.byPlanet[key];
    if (!values || values.length !== samples.instants.length || values.length < 3) {
      return omittedCanonicalPosition(
        key,
        "No hubo suficientes muestras del día civil para certificar esta posición.",
      );
    }
    const stableSign = certifiesNoSignCrossing(
      key,
      values,
      samples.instants,
      samples.speedByPlanet[key],
    );
    const possible = stableSign
      ? {
          signs: [ZODIAC_SIGNS[signIndexAtLongitude(values[0])]],
          signsEs: [SIGN_LABELS_ES[signIndexAtLongitude(values[0])]],
        }
      : possibleZodiacSigns(key, values, samples);
    if (possible.signs.length === 0) {
      return omittedCanonicalPosition(
        key,
        "No se pudo acotar el signo de esta posición durante todo el día de nacimiento.",
      );
    }
    return {
      key,
      label: CANONICAL_PLANET_LABELS[key],
      source: "planets/tropical" as const,
      precision: stableSign ? ("estimated" as const) : ("range" as const),
      sign: stableSign ? possible.signs[0] : null,
      signEs: stableSign ? possible.signsEs[0] : null,
      possibleSigns: possible.signs,
      possibleSignsEs: possible.signsEs,
      // Elegir el grado del mediodía sería inventar una hora de nacimiento.
      degree: null,
      fullDegree: null,
      house: null,
      isRetrograde: null,
      limitation: stableSign
        ? "El signo se mantiene durante todo el día; el grado exacto depende de la hora de nacimiento."
        : "El signo puede cambiar durante el día; se conserva el rango y no se elige un grado arbitrario.",
    } satisfies CanonicalNatalPosition;
  });
}

function publicCanonicalGeometry(
  birthData: BirthDataSnapshot | null,
  geometry: NormalizedChartSnapshot | null,
  isPro: boolean,
) {
  if (!birthData || birthData.birthTimePrecision !== "known" || !geometry) {
    return { angles: [] as CanonicalNatalAngle[], houses: [] as CanonicalNatalHouse[] };
  }
  // El grado de cada eje sale de la MISMA regla que mide si la carta guardada
  // alcanza (`lib/natalGeometry`): un eje que acá se publica es un eje que allá
  // cuenta como calculado, y al revés.
  const degrees = verifiedAngleDegrees(geometry);
  const exactAngle = (key: "ascendant" | "mc", houseNumber: 1 | 10) => {
    const rawDegree = degrees[key];
    if (rawDegree === null) return null;
    const zodiac = zodiacAtLongitude(rawDegree);
    return {
      key,
      label: key === "ascendant" ? "Ascendente" : "Medio Cielo",
      source: "verified_legacy_geometry" as const,
      precision: "exact" as const,
      sign: zodiac.sign,
      signEs: zodiac.signEs,
      degree: rawDegree % 30,
      fullDegree: rawDegree,
      house: houseNumber,
    } satisfies CanonicalNatalAngle;
  };
  const angles: CanonicalNatalAngle[] = [];
  const ascendant = exactAngle("ascendant", 1);
  const mc = exactAngle("mc", 10);
  if (ascendant) angles.push(ascendant);
  if (mc) angles.push(mc);
  const houses = isPro && geometry.houses.length === 12
    ? geometry.houses.map((house) => {
        const fullDegree = house.degree as number;
        const zodiac = zodiacAtLongitude(fullDegree);
        return {
          house: house.house,
          source: "verified_legacy_geometry" as const,
          precision: "exact" as const,
          sign: zodiac.sign,
          signEs: zodiac.signEs,
          degree: fullDegree,
          theme: house.theme,
        } satisfies CanonicalNatalHouse;
      })
    : [];
  return { angles, houses };
}

function angularDistance(first: number, second: number) {
  const direct = Math.abs(normalizedDegrees(first) - normalizedDegrees(second));
  return Math.min(direct, 360 - direct);
}

function canonicalNatalAspectAt(first: number, second: number) {
  const distance = angularDistance(first, second);
  return CANONICAL_NATAL_ASPECTS.map((definition) => ({
    definition,
    orb: Math.abs(distance - definition.angle),
  }))
    .filter(({ definition, orb }) => orb <= definition.maxOrb)
    .sort((left, right) => left.orb - right.orb || left.definition.angle - right.definition.angle)[0] ?? null;
}

function adjacentMotionMargin(samples: NatalDaySamples, key: NatalIntervalPlanet, sampleIndex: number) {
  const margins = [sampleIndex - 1, sampleIndex]
    .filter((segmentIndex) => segmentIndex >= 0 && segmentIndex < samples.instants.length - 1)
    .map((segmentIndex) =>
      segmentMotionMargin(key, samples.instants, segmentIndex, samples.speedByPlanet[key]),
    );
  return margins.length > 0 ? Math.max(...margins) : MAX_NATAL_MOTION_PER_DAY[key];
}

function boundedLongitudeCandidates(samples: NatalDaySamples, key: NatalIntervalPlanet, sampleIndex: number) {
  const value = samples.byPlanet[key]?.[sampleIndex];
  if (typeof value !== "number" || !Number.isFinite(value)) return [];
  const margin = adjacentMotionMargin(samples, key, sampleIndex);
  return [value, value - margin, value + margin].map(normalizedDegrees);
}

function intervalCanonicalAspect(
  samples: NatalDaySamples,
  from: NatalIntervalPlanet,
  to: NatalIntervalPlanet,
) {
  const readings = samples.instants.flatMap((_, sampleIndex) => {
    const first = boundedLongitudeCandidates(samples, from, sampleIndex);
    const second = boundedLongitudeCandidates(samples, to, sampleIndex);
    return first.flatMap((left) => second.map((right) => canonicalNatalAspectAt(left, right)));
  });
  const possible = readings.filter(
    (reading): reading is NonNullable<ReturnType<typeof canonicalNatalAspectAt>> => reading !== null,
  );
  if (possible.length === 0) return { aspect: null, uncertain: false } as const;
  if (
    readings.some((reading) => reading === null) ||
    possible.some((reading) => reading.definition.type !== possible[0].definition.type)
  ) {
    return { aspect: null, uncertain: true } as const;
  }
  const orbs = possible.map((reading) => reading.orb).sort((left, right) => left - right);
  return {
    aspect: {
      definition: possible[0].definition,
      minOrb: orbs[0],
      maxOrb: orbs[orbs.length - 1],
    },
    uncertain: false,
  } as const;
}

function publicCanonicalAspects(args: {
  birthData: BirthDataSnapshot | null;
  snapshot: NatalEphemerisSnapshot | null;
  samples: NatalDaySamples | undefined;
  isPro: boolean;
}) {
  if (!args.isPro || !args.birthData || !args.snapshot) {
    return { aspects: [] as CanonicalNatalAspect[], uncertainPairs: 0 };
  }
  const aspects: CanonicalNatalAspect[] = [];
  let uncertainPairs = 0;
  for (let fromIndex = 0; fromIndex < NATAL_INTERVAL_PLANETS.length; fromIndex += 1) {
    for (let toIndex = fromIndex + 1; toIndex < NATAL_INTERVAL_PLANETS.length; toIndex += 1) {
      const from = NATAL_INTERVAL_PLANETS[fromIndex];
      const to = NATAL_INTERVAL_PLANETS[toIndex];
      if (args.birthData.birthTimePrecision === "known") {
        const first = position(args.snapshot.samples[0].positions, from)?.fullDegree;
        const second = position(args.snapshot.samples[0].positions, to)?.fullDegree;
        if (
          typeof first !== "number" ||
          !Number.isFinite(first) ||
          typeof second !== "number" ||
          !Number.isFinite(second)
        ) continue;
        const reading = canonicalNatalAspectAt(first, second);
        if (!reading) continue;
        aspects.push({
          from,
          to,
          source: "canonical_longitudes",
          type: reading.definition.type,
          typeEs: reading.definition.typeEs,
          precision: "exact",
          orb: roundedPublicDegree(reading.orb),
          orbRange: null,
          isMajor: true,
        });
        continue;
      }
      if (!args.samples) continue;
      const reading = intervalCanonicalAspect(args.samples, from, to);
      if (!reading.aspect) {
        if (reading.uncertain) uncertainPairs += 1;
        continue;
      }
      aspects.push({
        from,
        to,
        source: "canonical_longitudes",
        type: reading.aspect.definition.type,
        typeEs: reading.aspect.definition.typeEs,
        precision: "range",
        orb: null,
        orbRange: {
          from: roundedPublicDegree(reading.aspect.minOrb),
          to: roundedPublicDegree(reading.aspect.maxOrb),
        },
        isMajor: true,
      });
    }
  }
  aspects.sort((left, right) => {
    const leftOrb = left.orb ?? left.orbRange?.from ?? Number.POSITIVE_INFINITY;
    const rightOrb = right.orb ?? right.orbRange?.from ?? Number.POSITIVE_INFINITY;
    return leftOrb - rightOrb || `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`);
  });
  return { aspects, uncertainPairs };
}

function canonicalNatalChartBase(args: {
  birthData: BirthDataSnapshot | null;
  legacyChartSnapshot: NormalizedChartSnapshot | null;
  natalEphemeris: NatalEphemerisSnapshot | null;
  isPro: boolean;
  observedAt: number;
}): NatalChartBase {
  const snapshot = matchingNatalEphemeris(args.birthData, args.natalEphemeris);
  const geometry = verifiedLegacyGeometry(args.birthData, args.legacyChartSnapshot);
  const samples = natalDaySamplesFromEphemeris(args.birthData, snapshot);
  const publicGeometry = publicCanonicalGeometry(args.birthData, geometry, args.isPro);
  const revealHouses = args.isPro && publicGeometry.houses.length === 12;
  const positions = publicCanonicalPositions({
    birthData: args.birthData,
    snapshot,
    samples,
    geometry,
    revealHouses,
  });
  const aspectBuild = publicCanonicalAspects({
    birthData: args.birthData,
    snapshot,
    samples,
    isPro: args.isPro,
  });
  const missingInputs: string[] = [];
  const limitations: string[] = [];
  if (!args.birthData) {
    missingInputs.push("birth_data");
    limitations.push("Cargá tus datos de nacimiento para calcular la carta.");
  } else if (!snapshot) {
    missingInputs.push("canonical_natal_ephemeris");
    limitations.push(
      "Todavía no hay posiciones canónicas calculadas para estos datos. Órbita no las sustituye con una carta anterior.",
    );
  }
  if (args.birthData && args.birthData.birthTimePrecision !== "known") {
    missingInputs.push("exact_birth_time");
    limitations.push(
      args.birthData.birthTimePrecision === "approximate"
        ? "Una hora aproximada sin margen declarado se trata como desconocida: se revisa todo el día civil."
        : "Sin hora exacta, cada posición se comprueba sobre todo el día civil.",
      "Sin hora exacta no se publica ningún grado, Ascendente, Medio Cielo ni casa.",
    );
    if (snapshot) {
      limitations.push(
        "Los aspectos visibles son sólo los que conservan el mismo tipo dentro de la cota de movimiento del día completo; su orbe se muestra como rango.",
      );
      if (aspectBuild.uncertainPairs > 0) {
        limitations.push(
          `${aspectBuild.uncertainPairs} contacto${aspectBuild.uncertainPairs === 1 ? "" : "s"} posible${aspectBuild.uncertainPairs === 1 ? "" : "s"} ${aspectBuild.uncertainPairs === 1 ? "se omitió porque cambia" : "se omitieron porque cambian"} según la hora.`,
        );
      }
    }
  }
  if (
    args.birthData?.birthTimePrecision === "known" &&
    publicGeometry.angles.length < 2
  ) {
    missingInputs.push("verified_ascendant_mc_geometry");
    limitations.push(
      "Las posiciones planetarias son canónicas, pero la carta vigente no trae Ascendente y Medio Cielo verificables.",
    );
  }
  if (
    args.birthData?.birthTimePrecision === "known" &&
    args.isPro &&
    publicGeometry.houses.length !== 12
  ) {
    missingInputs.push("verified_twelve_house_geometry");
    limitations.push("No se publican casas incompletas: hacen falta las doce cúspides verificadas.");
  }
  if (!args.isPro) {
    limitations.push("Las casas y los aspectos completos forman parte de Órbita Plus.");
  }
  const hasCanonicalPositions = snapshot !== null;
  const status: NatalChartBase["status"] = !args.birthData || !snapshot
    ? "unavailable"
    : args.birthData.birthTimePrecision !== "known" ||
        publicGeometry.angles.length < 2 ||
        (args.isPro && publicGeometry.houses.length !== 12)
      ? "partial"
      : "ready";
  return {
    methodVersion: NATAL_CHART_BASE_METHOD_VERSION,
    providerVersion: snapshot?.providerVersion ?? null,
    inputHash: stableInputHash({
      methodVersion: NATAL_CHART_BASE_METHOD_VERSION,
      natalInput: natalEphemerisInputHash(args.birthData),
      canonicalSamples: snapshot ? stableInputHash(snapshot.samples) : null,
      verifiedGeometry: geometry,
      isPro: args.isPro,
    }),
    status,
    observedAt: snapshot?.calculatedAt ?? args.observedAt,
    birthTimePrecision: args.birthData?.birthTimePrecision ?? null,
    calculationTimeSource: !args.birthData || !snapshot
      ? "unavailable"
      : args.birthData.birthTimePrecision === "known"
        ? "exact_birth_time"
        : "full_civil_day",
    access: {
      isPro: args.isPro,
      positions: hasCanonicalPositions,
      angles: publicGeometry.angles.length > 0,
      houses: revealHouses,
      aspects: args.isPro && hasCanonicalPositions,
    },
    positions,
    angles: publicGeometry.angles,
    houses: publicGeometry.houses,
    aspects: aspectBuild.aspects,
    missingInputs: Array.from(new Set(missingInputs)),
    limitations: Array.from(new Set(limitations)),
  };
}

function localDateForInstant(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const read = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function zonedInstant(civilDate: string, time: string, timezone: string) {
  const resolution = resolveZonedCivilTime({
    localDate: civilDate,
    localTime: time,
    timezone,
  });
  if (resolution.status === "exact") return resolution.instantMs;
  if (resolution.status === "fold") {
    throw new Error("The local birth time is repeated by a daylight-saving transition");
  }
  if (resolution.status === "gap") {
    throw new Error("The local birth time does not exist because of a daylight-saving transition");
  }
  throw new Error(`Invalid civil ${resolution.reason}`);
}

function houseForLongitude(chart: LayerChartInput | null, longitude: number) {
  if (!chart || chart.birth.birthTimePrecision !== "known") return null;
  const houses = chart.houses
    .filter((house) => typeof house.degree === "number" && Number.isFinite(house.degree))
    .sort((left, right) => left.house - right.house);
  return houseNumberForLongitude(houses, longitude);
}

function natalRuler(chart: LayerChartInput | null) {
  if (!chart || chart.birth.birthTimePrecision !== "known") return null;
  const ascendant = chart.placements.find((placement) => placement.key === "ascendant");
  const houseOne = chart.houses.find((house) => house.house === 1);
  const sign = normalizeZodiacSign(ascendant?.sign ?? houseOne?.sign ?? "");
  return sign ? traditionalRulerForSign(sign) : null;
}

function buildTransitContacts(args: {
  baseHash: string;
  chart: LayerChartInput | null;
  ephemeris: readonly EphemerisPosition[];
  observedAt: number;
  natalSamples?: NatalDaySamples | null;
}): TransitContactInput[] {
  if (!args.chart) return [];
  const ruler = natalRuler(args.chart);
  const knownBirthTime = args.chart.birth.birthTimePrecision === "known";
  const contacts: TransitContactInput[] = [];
  for (const transit of args.ephemeris) {
    for (const natal of args.chart.placements) {
      const pointKey = intervalPointKey(natal.key || natal.label);
      let natalLongitude = natal.fullDegree;
      let match =
        typeof natalLongitude === "number" && Number.isFinite(natalLongitude)
          ? matchMajorAspect(transit.fullDegree, natalLongitude)
          : null;
      if (!knownBirthTime) {
        if (!NATAL_INTERVAL_PLANETS.includes(pointKey as NatalIntervalPlanet)) continue;
        const longitudeSamples = args.natalSamples?.byPlanet[pointKey as NatalIntervalPlanet];
        if (!longitudeSamples || longitudeSamples.length < 2) continue;
        const intervalMatches = longitudeSamples.map((longitude) =>
          matchMajorAspect(transit.fullDegree, longitude),
        );
        const first = intervalMatches[0];
        const stableAcrossSegments = intervalMatches.slice(0, -1).every((candidate, index) => {
          const next = intervalMatches[index + 1];
          const motionMargin = args.natalSamples
            ? segmentMotionMargin(
                pointKey as NatalIntervalPlanet,
                args.natalSamples.instants,
                index,
                args.natalSamples.speedByPlanet[pointKey as NatalIntervalPlanet],
              )
            : Number.POSITIVE_INFINITY;
          return Boolean(
            candidate &&
            next &&
            candidate.key === first?.key &&
            next.key === first?.key &&
            candidate.orb + motionMargin <= 3 &&
            next.orb + motionMargin <= 3,
          );
        });
        if (
          !first ||
          !stableAcrossSegments
        ) continue;
        natalLongitude = longitudeSamples[Math.floor(longitudeSamples.length / 2)];
        match = matchMajorAspect(transit.fullDegree, natalLongitude);
      }
      if (!match || typeof natalLongitude !== "number" || !Number.isFinite(natalLongitude)) continue;
      const speed = transit.speed;
      const exactOffsetDays = Math.abs(speed) < 1e-5 ? 0 : -match.signedError / speed;
      const exactAt = args.observedAt + exactOffsetDays * MILLISECONDS_PER_DAY;
      const halfWindowDays = Math.min(240, Math.max(0.25, 3 / Math.max(Math.abs(speed), 0.0125)));
      const previous = matchMajorAspect(transit.fullDegree - speed, natalLongitude);
      contacts.push({
        chartKey: args.baseHash,
        transitPlanet: transit.label,
        transitLongitude: transit.fullDegree,
        transitSpeed: speed,
        natalPoint: natal.label,
        natalLongitude,
        natalHouse: houseForLongitude(args.chart, transit.fullDegree),
        isNatalRuler: ruler === transit.key,
        isRetrograde: transit.isRetrograde,
        themeKey: natal.key,
        observedAt: args.observedAt,
        previousOrb: previous?.key === match.key ? previous.orb : null,
        windowStart: exactAt - halfWindowDays * MILLISECONDS_PER_DAY,
        exactAt,
        windowEnd: exactAt + halfWindowDays * MILLISECONDS_PER_DAY,
      });
    }
  }
  return contacts;
}

/**
 * El contacto que encabeza el ranking del día, CON la identidad que ese ranking
 * publicó.
 *
 * El `arcId` viaja con el contacto porque el arco principal (`ORB-TRN-001`) y el
 * primer ítem del ranking (`ORB-TRN-002`) tienen que nombrar el mismo proceso con
 * el mismo identificador. El motor ya deriva una identidad estable —no depende de
 * si la cronología se estimó o se verificó—, y declararla acá deja el invariante
 * escrito en el único lugar donde las dos capas se arman juntas.
 */
function primaryTransitContact(
  contacts: readonly TransitContactInput[],
  observedAt: number,
  localDate?: string,
  timezone?: string,
) {
  const primary = rankTransitContacts([...contacts], { referenceTime: observedAt, localDate, timezone })[0];
  if (!primary) return null;
  const contact =
    contacts.find((candidate) => {
      const match = matchMajorAspect(candidate.transitLongitude, candidate.natalLongitude);
      return (
        candidate.transitPlanet === primary.transitPlanet &&
        candidate.natalPoint === primary.natalPoint &&
        match?.key === primary.aspect.key
      );
    }) ?? null;
  return contact
    ? {
        /** El contacto que se le pasa al motor, ya con la identidad declarada. */
        contact: { ...contact, arcId: primary.arcId },
        /** La fila original dentro de `contacts`, para poder reemplazarla. */
        source: contact,
        arcId: primary.arcId,
      }
    : null;
}

/**
 * El contacto activo cuyo arco es exactamente el pedido.
 *
 * El `arcId` lo publica el ranking (`ORB-TRN-002`), así que la búsqueda usa el
 * MISMO motor y el mismo instante de referencia con los que se armó esa lista:
 * pedir el arco de ayer, o de otra hora, tiene que fallar en vez de devolver el
 * contacto parecido. Del ranking sólo se toma la identidad del contacto —planeta,
 * punto natal y aspecto—; el contacto que se devuelve es el real, con su
 * longitud, su velocidad y su ventana.
 */
function contactForArcId(
  contacts: readonly TransitContactInput[],
  observedAt: number,
  arcId: string,
  localDate?: string,
  timezone?: string,
): TransitContactInput | null {
  const ranked = rankTransitContacts([...contacts], { referenceTime: observedAt, localDate, timezone }).find(
    (candidate) => candidate.arcId === arcId,
  );
  if (!ranked) return null;
  return (
    contacts.find((contact) => {
      const match = matchMajorAspect(contact.transitLongitude, contact.natalLongitude);
      return (
        contact.transitPlanet === ranked.transitPlanet &&
        contact.natalPoint === ranked.natalPoint &&
        match?.key === ranked.aspect.key
      );
    }) ?? null
  );
}

/**
 * Un sobre reutilizable para el arco pedido: o no trae dato —y entonces ES la
 * respuesta honesta de ese alcance— o trae exactamente ese arco. Un sobre con el
 * arco de otro contacto no se reutiliza ni como cache ni como `stale`.
 */
function arcResultMatchesArcId(result: AnalysisResult, arcId: string) {
  const data = result.data?.kind === "transit_arc" ? result.data : null;
  return data === null ? result.data === null : data.arcId === arcId;
}

/**
 * ¿Este sobre guardado es el arco principal de HOY?
 *
 * Se exige el contacto —planeta, punto natal y aspecto— y además el `arcId` que
 * el ranking de esta corrida publicó. Lo segundo es lo que impide que una fila
 * escrita con otra identidad —por ejemplo, la de una versión anterior del motor,
 * o la de una ventana lógica que ya se corrió de día— se reutilice y deje la
 * pantalla mostrando un identificador que el ranking de al lado no reconoce. Si
 * no coincide, se recalcula: la invalidación es explícita, no un rezo.
 */
function arcResultMatchesPrimary(
  result: TransitArcResult,
  primary: { contact: TransitContactInput; arcId: string } | null,
) {
  const data = result.data?.kind === "transit_arc" ? result.data : null;
  if (!primary) return data === null;
  if (!data) return false;
  const match = matchMajorAspect(primary.contact.transitLongitude, primary.contact.natalLongitude);
  return Boolean(
    match &&
      data.arcId === primary.arcId &&
      data.transitPlanet === primary.contact.transitPlanet &&
      data.natalPoint === primary.contact.natalPoint &&
      data.aspect === match.key,
  );
}

/**
 * La lista publicada, cuando el sobre del ranking trae uno.
 *
 * Su primer ítem es el único contacto del que `ORB-TRN-001` puede hablar: el
 * arco principal del día es, por definición, el arco de ese ítem.
 */
function rankedTransitList(ranking: TransitRankingResult) {
  return ranking.data?.kind === "transit_ranking" ? ranking.data : null;
}

/**
 * ¿Por qué el arco que se iba a publicar no le corresponde al ranking?
 *
 * El arreglo de identidad garantiza que un CÁLCULO nuevo publique el mismo
 * `arcId` en las dos capas. No alcanza: `getForDate` y la degradación sin
 * efeméride rescatan los dos sobres por separado desde el cache, y una fila
 * escrita antes de aquel arreglo —o por otra ventana lógica del día— puede
 * combinar un ranking cuyo `items[0]` es A con un arco que describe B. En modo
 * caché u offline ese par incoherente puede durar indefinidamente.
 *
 * Se comparan el identificador Y la tupla semántica —planeta en tránsito, punto
 * natal y aspecto—, porque cada uno atrapa una mentira distinta: sólo el `arcId`
 * dejaría pasar dos identidades iguales sobre contactos distintos, y sólo la
 * tupla dejaría pasar el mismo contacto con un identificador que la lista de al
 * lado no reconoce —que es justo lo que rompe abrir el detalle—.
 *
 * Devuelve el MOTIVO y no un booleano porque los tres motivos posibles no se
 * dicen igual, y decirlos igual era una mentira:
 *
 * - **sin dato** —`unavailable`, `error`, o la lista que todavía no se calculó—
 *   no afirma nada sobre hoy, así que no puede contradecir a ningún arco.
 *   Descartar ahí el último dato personal disponible no ganaría ninguna verdad.
 * - **con la lista VACÍA** el ranking afirma que hoy NO encabeza ningún
 *   contacto. El arco guardado sobra, y el hecho es que hoy no hay tránsito
 *   principal activo —no que falte calcular el arco de uno que sí existe—.
 * - **con un primer ítem que no es el del arco** sí falta un cálculo: hay
 *   tránsito encabezando la lista y su arco todavía no está.
 *
 * **La lista se mira SIEMPRE, también cuando el arco no trae dato.** Ése era el
 * borde abierto: un sobre negativo cacheado —`data: null` con
 * `matching_transit_arc`— pasaba como coherente sin mirar el ranking, así que
 * una lista vacía nueva convivía con la promesa vieja de calcular el arco del
 * tránsito que hoy encabeza la lista… cuando hoy no encabeza ninguno. Ese copy
 * falso duraba hasta `validUntil`, o para siempre si era `null`. Un sobre sin
 * dato no tiene nada que preservar: se normaliza al hecho de hoy.
 */
type TransitArcCoherence = "coherente" | "sin_transito_activo" | "otro_contacto";

function transitArcCoherence(
  arc: TransitArcResult,
  ranking: TransitRankingResult,
): TransitArcCoherence {
  const list = rankedTransitList(ranking);
  // Un ranking sin dato no contradice a nadie: el arco se conserva tal cual,
  // traiga dato o no.
  if (!list) return "coherente";
  const top = list.items[0] ?? null;
  if (!top) return "sin_transito_activo";
  const data = arc.data?.kind === "transit_arc" ? arc.data : null;
  // Hay tránsito encabezando la lista. Si el arco no está —o es de otro
  // contacto—, lo que falta es su cálculo.
  if (!data) return "otro_contacto";
  return data.arcId === top.arcId &&
    data.transitPlanet === top.transitPlanet &&
    data.natalPoint === top.natalPoint &&
    data.aspect === top.aspect
    ? "coherente"
    : "otro_contacto";
}

/**
 * El código con el que el sobre declara que el arco guardado no era el del
 * tránsito que hoy encabeza la lista. No es "no hay tránsito activo"
 * (`active_transit_arc`) ni "no pudimos traer el cielo" (`current_ephemeris`):
 * es un cálculo que hay que rehacer.
 */
const UNMATCHED_ARC_INPUT = "matching_transit_arc";

/**
 * El código canónico de "hoy no hay ningún tránsito mayor activo para formar un
 * arco" — el mismo que usa `layerAssembly` cuando el cálculo del día no
 * encuentra contacto principal. Cuando el ranking publica la lista vacía, este
 * es el hecho: no falta un cálculo, falta el tránsito.
 */
const NO_ACTIVE_ARC_INPUT = "active_transit_arc";

/**
 * El par `(ranking, arco)` que se publica, ya coherente.
 *
 * Si el arco no corresponde al ranking se DESCARTA —nunca se lo relabela, ni se
 * mezcla el arco de otro contacto— y en su lugar va un `ORB-TRN-001` honesto sin
 * dato, con el hecho real: `stale` no es una opción, porque no existe ninguna
 * fila correspondiente que mostrar.
 *
 * **El motivo que se declara es el que la lista permite afirmar.** Cuando el
 * ranking trae la lista vacía ya sabemos que hoy no encabeza ningún contacto: el
 * faltante es `active_transit_arc` —"hoy no hay ningún tránsito mayor activo
 * para formar un arco"— y no `matching_transit_arc`, que promete el arco de un
 * tránsito que la propia lista dice que no existe. Sólo cuando hay un primer
 * ítem falta, de verdad, un cálculo.
 *
 * **También se normaliza un sobre que ya venía sin dato.** El código de
 * coherencia contrario se descarta en vez de acumularse: si se conservara, un
 * `matching_transit_arc` cacheado sobreviviría a la lista vacía que acaba de
 * desmentirlo, y ese copy falso duraría hasta `validUntil` —o para siempre si
 * fuera `null`—. Los demás motivos del sobre sin dato SÍ se conservan: son los
 * suyos, y el hecho de coherencia se suma, no los reemplaza.
 *
 * Un sobre sin dato que **ya declara exactamente este hecho** —y no el
 * contrario— no se reescribe: está diciendo lo correcto con sus propias
 * palabras, que suelen explicar mejor por qué hoy no hay arco.
 *
 * La limitación distingue si había algo que retirar. Con un arco cacheado con
 * dato se dice que ese arco ya no corresponde a la lista de ahora —puede ser de
 * otra hora del MISMO día, no necesariamente de otro día—; sin dato guardado no
 * se inventa un arco retirado que nunca existió.
 */
function coherentTransitArc(args: {
  ranking: TransitRankingResult;
  arc: TransitArcResult;
  observedAt: number;
  /** El hecho que impide calcularlo ahora, si lo hay. */
  status: "unavailable" | "error";
  validUntil: number | null;
  missingInputs?: readonly string[];
}): TransitArcResult {
  const coherencia = transitArcCoherence(args.arc, args.ranking);
  if (coherencia === "coherente") return args.arc;
  const sinTransitoActivo = coherencia === "sin_transito_activo";
  const habiaArco = args.arc.data?.kind === "transit_arc";
  const hecho = sinTransitoActivo ? NO_ACTIVE_ARC_INPUT : UNMATCHED_ARC_INPUT;
  const contrario = sinTransitoActivo ? UNMATCHED_ARC_INPUT : NO_ACTIVE_ARC_INPUT;
  const propios = habiaArco
    ? []
    : args.arc.missingInputs.filter((code) => code !== hecho && code !== contrario);
  if (
    !habiaArco &&
    args.arc.missingInputs.includes(hecho) &&
    !args.arc.missingInputs.includes(contrario)
  ) {
    return args.arc;
  }
  return unavailableResult(
    "ORB-TRN-001",
    args.arc.inputHash,
    args.observedAt,
    Array.from(new Set([...(args.missingInputs ?? []), ...propios, hecho])),
    {
      status: args.status,
      validUntil: args.validUntil,
      limitations: [
        sinTransitoActivo
          ? habiaArco
            ? "Hoy no hay ningún tránsito encabezando tu lista, así que no hay arco que mostrar: el que estaba guardado ya no corresponde a la lista actual."
            : "Hoy no hay ningún tránsito encabezando tu lista, así que no hay arco que mostrar."
          : habiaArco
            ? "El arco guardado describe otro tránsito que el que hoy encabeza tu lista, así que no se muestra: se vuelve a calcular con el próximo cielo."
            : "Todavía no está calculado el arco del tránsito que hoy encabeza tu lista: se calcula con el próximo cielo.",
      ],
    },
  ) as TransitArcResult;
}

function honestTransitRankingBuild(
  build: LayerDataBuild<Extract<AnalysisData, { kind: "transit_ranking" }>>,
  chart: LayerChartInput | null,
  samples: NatalDaySamples | null | undefined,
): LayerDataBuild<Extract<AnalysisData, { kind: "transit_ranking" }>> {
  if (!chart) return build;
  const knownBirthTime = chart.birth.birthTimePrecision === "known";
  if (!knownBirthTime && !samples) {
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: ["full_day_natal_samples"],
      limitations: [
        "Sin hora exacta, necesitamos comprobar que cada tránsito conserva el mismo tipo de contacto durante todo tu día de nacimiento.",
      ],
    };
  }
  if (!build.data || build.data.items.length === 0) return build;
  return {
    ...build,
    status: "partial",
    precision: "estimated",
    missingInputs: Array.from(
      new Set([
        ...build.missingInputs,
        "verified_transit_exact_timeline",
        ...(knownBirthTime ? [] : ["exact_birth_time"]),
      ]),
    ),
    limitations: [
      ...build.limitations,
      ...(!knownBirthTime
        ? ["Sólo mostramos contactos que conservan el mismo tipo —conjunción, sextil, cuadratura, trígono u oposición— durante todo tu día de nacimiento."]
        : []),
      "El orden usa las posiciones actuales verificadas. Las horas de inicio, máxima precisión y cierre se estiman a partir de la velocidad actual; todavía no están confirmadas por un seguimiento completo.",
    ],
  };
}

function honestTransitArcBuild(
  build: LayerDataBuild<Extract<AnalysisData, { kind: "transit_arc" }>>,
  chart: LayerChartInput | null,
  samples: NatalDaySamples | null | undefined,
  timeline: TransitTimelineResolution | null,
): LayerDataBuild<Extract<AnalysisData, { kind: "transit_arc" }>> {
  if (!chart) return build;
  if (chart.birth.birthTimePrecision !== "known" && !samples) {
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: ["full_day_natal_samples", "verified_transit_pass_timeline"],
      limitations: [
        "Sin una hora exacta de nacimiento y un seguimiento completo del tránsito, no podemos mostrar una línea de tiempo personal sin inventar precisión.",
      ],
    };
  }
  if (!build.data) return build;
  if (timeline?.status === "verified") {
    if (chart.birth.birthTimePrecision === "known") {
      return {
        ...build,
        limitations: [
          ...build.limitations,
          "Las pasadas y los límites de esta ventana se verificaron con posiciones tropicales reales alrededor del contacto activo.",
        ],
      };
    }
    return {
      ...build,
      status: build.data ? "partial" : build.status,
      precision: build.data ? "estimated" : build.precision,
      missingInputs: Array.from(new Set([...build.missingInputs, "exact_birth_time"])),
      limitations: [
        ...build.limitations,
        "Las pasadas del planeta se verificaron con posiciones tropicales reales. Como no conocemos tu hora exacta, sus fechas se calculan sobre el grado natal estable estimado para todo tu día de nacimiento.",
      ],
    };
  }
  const timelineFailureLimitation =
    timeline?.status === "provider_error" || timeline?.status === "provider_budget_exhausted"
      ? "No pudimos verificar ahora todas las pasadas con el proveedor astronómico. La ventana visible queda marcada como estimada."
      : "No se pudo cerrar con seguridad toda la ventana de pasadas dentro del intervalo verificado. La duración visible queda marcada como estimada.";
  return {
    ...build,
    status: build.data ? "partial" : build.status,
    precision: build.data ? "estimated" : build.precision,
    missingInputs: Array.from(
      new Set([
        ...build.missingInputs,
        "verified_transit_pass_timeline",
        ...(chart.birth.birthTimePrecision === "known" ? [] : ["exact_birth_time"]),
      ]),
    ),
    limitations: [
      ...build.limitations,
      timelineFailureLimitation,
      "La duración visible se estima desde la posición y la velocidad actuales. Si el planeta parece retroceder y vuelve a tocar el mismo punto, esos contactos sólo se reúnen cuando el seguimiento completo los confirma.",
    ],
  };
}

function latestMatching(
  snapshots: readonly AnalysisResult[],
  analysisId: AnalysisId,
  inputHash: string,
  now: number,
) {
  const result = snapshots.find((candidate) => candidate.analysisId === analysisId && candidate.inputHash === inputHash);
  // A negative cache is useful only until its retry deadline. Returning an
  // expired error/unavailable envelope here would make refreshForDate reuse it
  // forever because there is no data that can be marked as stale.
  if (result?.data === null && result.validUntil !== null && result.validUntil <= now) {
    return null;
  }
  return result ? staleIfExpired(result, now) : null;
}

function staleProviderFallback(
  snapshots: readonly AnalysisResult[],
  analysisId: AnalysisId,
  inputHash: string,
  now: number,
) {
  const cached = latestMatching(snapshots, analysisId, inputHash, now);
  if (!cached?.data) return null;
  const limitation = "No pudimos actualizar este cálculo; se muestra el último dato personal disponible.";
  return {
    ...cached,
    status: "stale" as const,
    limitations: cached.limitations.includes(limitation)
      ? cached.limitations
      : [...cached.limitations, limitation],
  };
}

function envelopeData<TKind extends AnalysisData["kind"]>(
  result: AnalysisResult,
  kind: TKind,
): Extract<AnalysisData, { kind: TKind }> | null {
  return result.data?.kind === kind ? (result.data as Extract<AnalysisData, { kind: TKind }>) : null;
}

async function tropicalAt(args: {
  instantMs: number;
  localDate: string;
  timezone: string;
  birthData: BirthDataSnapshot | null;
  signal?: AbortSignal;
}) {
  return await runAstrologyApiPlanetsTropical({
    instant: new Date(args.instantMs),
    localDate: args.localDate,
    timezone: args.timezone,
    latitude: args.birthData?.latitude ?? undefined,
    longitude: args.birthData?.longitude ?? undefined,
    signal: args.signal,
  });
}

/**
 * El cielo del día: el snapshot global vigente, o uno nuevo del proveedor, o el
 * anterior declarado explícitamente `stale`.
 *
 * Es el mismo camino para el sobre completo del día y para el detalle de un arco
 * suelto: dos copias de esta decisión podrían divergir y una de las dos empezaría
 * a mentir sobre la frescura del cielo con el que calculó.
 */
async function resolveDailySky(args: {
  sky: SkySnapshot | null;
  observedAt: number;
  localDate: string;
  timezone: string;
}): Promise<{
  ephemeris: EphemerisPosition[] | null;
  observedAt: number;
  providerVersion: string | undefined;
  isStale: boolean;
  toPersist: SkySnapshot | null;
}> {
  if (args.sky && args.sky.validUntil > args.observedAt) {
    return {
      ephemeris: args.sky.positions,
      observedAt: args.sky.observedAt,
      providerVersion: args.sky.providerVersion,
      isStale: false,
      toPersist: null,
    };
  }
  const provider = await runAstrologyApiPlanetsTropical({
    instant: new Date(args.observedAt),
    localDate: args.localDate,
    timezone: args.timezone,
  });
  if (provider.status === "success" && provider.normalized) {
    return {
      ephemeris: provider.normalized.positions,
      observedAt: provider.observedAt,
      providerVersion: provider.providerVersion,
      isStale: false,
      toPersist: {
        providerVersion: provider.providerVersion,
        observedAt: provider.observedAt,
        validUntil: provider.observedAt + HOUR_MS,
        positions: provider.normalized.positions,
      },
    };
  }
  if (args.sky) {
    return {
      ephemeris: args.sky.positions,
      observedAt: args.sky.observedAt,
      providerVersion: args.sky.providerVersion,
      isStale: true,
      toPersist: null,
    };
  }
  return {
    ephemeris: null,
    observedAt: args.observedAt,
    providerVersion: undefined,
    isStale: false,
    toPersist: null,
  };
}

const transitTimelineSingleFlight = createTransitTimelineSingleFlight();

async function verifiedTimelineForContact(args: {
  contact: TransitContactInput;
  timezone: string;
}) {
  const contactObservedAt =
    args.contact.observedAt instanceof Date
      ? args.contact.observedAt.getTime()
      : typeof args.contact.observedAt === "number"
        ? args.contact.observedAt
        : Date.parse(args.contact.observedAt);
  const aspect = matchMajorAspect(args.contact.transitLongitude, args.contact.natalLongitude);
  const requestKey = stableInputHash({
    chartKey: args.contact.chartKey,
    transitPlanet: args.contact.transitPlanet,
    natalPoint: args.contact.natalPoint,
    natalLongitude: args.contact.natalLongitude,
    aspect: aspect?.key ?? null,
    observedHour: Number.isFinite(contactObservedAt)
      ? Math.floor(contactObservedAt / HOUR_MS)
      : null,
    timezone: args.timezone,
  });
  return await transitTimelineSingleFlight.run(requestKey, () =>
    resolveVerifiedTransitTimeline({
      contact: args.contact,
      ephemerisAt: async (instantMs) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8_000);
        try {
          const response = await tropicalAt({
            instantMs,
            localDate: localDateForInstant(new Date(instantMs), args.timezone),
            timezone: args.timezone,
            birthData: null,
            signal: controller.signal,
          });
          return response.status === "success" && response.normalized
            ? { status: "success" as const, positions: response.normalized.positions }
            : { status: "error" as const, reason: `planets_tropical_timeline_${response.status}` };
        } finally {
          clearTimeout(timeout);
        }
      },
    }),
  );
}

async function calculateNatalEphemeris(
  birthData: BirthDataSnapshot,
  refreshObservedAt: number,
): Promise<NatalEphemerisSnapshot | null> {
  const instants = expectedNatalSampleInstants(birthData);
  if (!instants) return null;
  const responses = await Promise.all(
    instants.map((instantMs) =>
      tropicalAt({
        instantMs,
        localDate: birthData.birthDate,
        timezone: birthData.timezone,
        birthData,
      }),
    ),
  );
  if (responses.some((response) => response.status !== "success" || !response.normalized)) return null;
  const samples = responses.map((response, index) => ({
    instantMs: instants[index],
    positions: response.normalized!.positions,
  }));
  if (samples.some((sample) => !hasCanonicalPlanetSet(sample.positions))) return null;
  return {
    inputHash: natalEphemerisInputHash(birthData),
    methodVersion: NATAL_EPHEMERIS_METHOD_VERSION,
    providerVersion: NATAL_EPHEMERIS_PROVIDER_VERSION,
    birthTimePrecision: birthData.birthTimePrecision,
    samples,
    // Order by the refresh's server-captured start instant, not by provider
    // completion time: a slower earlier request can finish after a newer one.
    calculatedAt: refreshObservedAt,
  };
}

function interpolateEphemerisElongation(
  lower: { instantMs: number; positions: readonly EphemerisPosition[] },
  upper: { instantMs: number; positions: readonly EphemerisPosition[] },
) {
  const lowerSun = position(lower.positions, "sun");
  const lowerMoon = position(lower.positions, "moon");
  const upperSun = position(upper.positions, "sun");
  const upperMoon = position(upper.positions, "moon");
  if (!lowerSun || !lowerMoon || !upperSun || !upperMoon || upper.instantMs <= lower.instantMs) return null;
  return (instantMs: number) => {
    const fraction = (instantMs - lower.instantMs) / (upper.instantMs - lower.instantMs);
    return lunarElongationDegrees(
      interpolateCircularDegrees(lowerSun.fullDegree, upperSun.fullDegree, fraction),
      interpolateCircularDegrees(lowerMoon.fullDegree, upperMoon.fullDegree, fraction),
    );
  };
}

async function bracketedElongationRoot(args: {
  centerMs: number;
  radiusDays: number;
  targetDegrees: number;
  localDate: string;
  timezone: string;
  birthData: BirthDataSnapshot | null;
  kind: "cumpleluna" | "phase";
}) {
  const lowerMs = args.centerMs - args.radiusDays * MILLISECONDS_PER_DAY;
  const upperMs = args.centerMs + args.radiusDays * MILLISECONDS_PER_DAY;
  const [lowerResponse, upperResponse] = await Promise.all([
    tropicalAt({ ...args, instantMs: lowerMs }),
    tropicalAt({ ...args, instantMs: upperMs }),
  ]);
  if (
    lowerResponse.status !== "success" ||
    upperResponse.status !== "success" ||
    !lowerResponse.normalized ||
    !upperResponse.normalized
  ) {
    return null;
  }
  const elongationAt = interpolateEphemerisElongation(
    { instantMs: lowerMs, positions: lowerResponse.normalized.positions },
    { instantMs: upperMs, positions: upperResponse.normalized.positions },
  );
  if (!elongationAt) return null;
  try {
    const root =
      args.kind === "cumpleluna"
        ? findCumplelunaCrossing({
            currentElongationAt: elongationAt,
            natalElongationDegrees: args.targetDegrees,
            lowerBound: lowerMs,
            upperBound: upperMs,
            xTolerance: 1_000,
            angularToleranceDegrees: 1e-4,
          })
        : findLunarPhaseBoundaryCrossing({
            elongationAt,
            boundaryDegrees: args.targetDegrees,
            lowerBound: lowerMs,
            upperBound: upperMs,
            xTolerance: 1_000,
            angularToleranceDegrees: 1e-4,
          });
    return root.root;
  } catch {
    return null;
  }
}

async function cumplelunaRootPair(args: {
  targetDegrees: number;
  currentElongationDegrees: number;
  observedAt: number;
  localDate: string;
  timezone: string;
  birthData: BirthDataSnapshot;
}) {
  const cycle = personalLunationPosition(
    args.targetDegrees,
    args.currentElongationDegrees,
  );
  // En la raíz exacta, el ciclo personal informa día cero tanto para el
  // cierre como para el inicio. El centro inferior debe apuntar al ciclo
  // anterior para conservar dos contactos consecutivos y ordenados.
  const isExactRoot = cycle.cycleDegrees === 0;
  const previousCenter =
    args.observedAt -
    (isExactRoot ? SYNODIC_MONTH_DAYS : cycle.cycleDay) * MILLISECONDS_PER_DAY;
  const nextCenter =
    args.observedAt + cycle.daysUntilNextCumpleluna * MILLISECONDS_PER_DAY;
  const [previousExactAt, nextExactAt] = await Promise.all([
    bracketedElongationRoot({
      centerMs: previousCenter,
      radiusDays: 2,
      targetDegrees: args.targetDegrees,
      localDate: args.localDate,
      timezone: args.timezone,
      birthData: args.birthData,
      kind: "cumpleluna",
    }),
    bracketedElongationRoot({
      centerMs: nextCenter,
      radiusDays: 2,
      targetDegrees: args.targetDegrees,
      localDate: args.localDate,
      timezone: args.timezone,
      birthData: args.birthData,
      kind: "cumpleluna",
    }),
  ]);
  if (
    previousExactAt === null ||
    nextExactAt === null ||
    previousExactAt > args.observedAt ||
    nextExactAt < args.observedAt ||
    nextExactAt <= previousExactAt
  ) {
    return null;
  }
  return { previousExactAt, nextExactAt };
}

async function progressedLunationBuild(args: {
  birthData: BirthDataSnapshot | null;
  observedAt: number;
}) {
  if (!args.birthData) {
    return buildProgressedLunationLayerData({
      birthTimePrecision: "unknown",
      progressedSunLongitude: 0,
      progressedMoonLongitude: 0,
      ageYears: 0,
      observedAt: args.observedAt,
      phaseStartedAt: args.observedAt,
      nextPhaseAt: args.observedAt + 1,
    });
  }
  const times =
    args.birthData.birthTimePrecision === "known"
      ? args.birthData.birthTime
        ? [args.birthData.birthTime]
        : []
      : ["00:00", "12:00", "23:59"];
  if (times.length === 0) {
    return {
      data: null,
      status: "needs_birth_time",
      precision: "not_applicable",
      missingInputs: ["exact_birth_time"],
      limitations: ["La hora figura como exacta, pero no tiene un valor utilizable."],
    } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "progressed_lunation" }>>;
  }
  const birthResolutions = times.map((localTime) =>
    resolveZonedCivilTime({
      localDate: args.birthData!.birthDate,
      localTime,
      timezone: args.birthData!.timezone,
    }),
  );
  if (birthResolutions.some((resolution) => resolution.status !== "exact")) {
    const known = args.birthData.birthTimePrecision === "known";
    return {
      data: null,
      status: known ? "unavailable" : "partial",
      precision: known ? "not_applicable" : "range",
      missingInputs: [known ? "resolvable_birth_time" : "resolvable_birth_day_interval"],
      limitations: [
        known
          ? "La hora cargada coincide con un cambio de horario en el que ese momento no existió o ocurrió dos veces. No elegimos una de las dos posibilidades sin respaldo."
          : "Durante tu día de nacimiento hubo un cambio de horario que deja una franja ambigua. Sin hora exacta no elegimos un momento arbitrario.",
      ],
    } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "progressed_lunation" }>>;
  }
  const birthInstants = birthResolutions.map((resolution) => {
    if (resolution.status !== "exact") throw new Error("Unreachable civil-time resolution");
    return resolution.instantMs;
  });
  let progressedInstants: ReturnType<typeof secondaryProgressedInstant>[];
  try {
    progressedInstants = birthInstants.map((birthInstant) =>
      secondaryProgressedInstant(birthInstant, args.observedAt),
    );
  } catch {
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: ["valid_birth_instant"],
      limitations: ["La fecha de observación no puede ser anterior al nacimiento."],
    } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "progressed_lunation" }>>;
  }
  const responses = await Promise.all(
    progressedInstants.map((progressed) =>
      tropicalAt({
        instantMs: progressed.progressedInstantMs,
        localDate: localDateForInstant(
          new Date(progressed.progressedInstantMs),
          args.birthData!.timezone,
        ),
        timezone: args.birthData!.timezone,
        birthData: args.birthData,
      }),
    ),
  );
  if (
    responses.some(
      (response) => response.status !== "success" || !response.normalized,
    )
  ) {
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: ["progressed_ephemeris"],
      limitations: ["No pudimos obtener las posiciones del Sol y la Luna necesarias para calcular tu estación vital."],
    } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "progressed_lunation" }>>;
  }
  const samples = responses.map((response, index) => {
    const positions = response.normalized!.positions;
    return {
      progressed: progressedInstants[index],
      sun: position(positions, "sun"),
      moon: position(positions, "moon"),
    };
  });
  if (samples.some((sample) => !sample.sun || !sample.moon)) {
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: ["progressed_sun_and_moon"],
      limitations: ["Faltan las posiciones del Sol o la Luna necesarias para este cálculo."],
    } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "progressed_lunation" }>>;
  }
  const daySamples: NatalDaySamples = {
    instants: samples.map((sample) => sample.progressed.progressedInstantMs),
    sun: samples.map((sample) => sample.sun!.fullDegree),
    moon: samples.map((sample) => sample.moon!.fullDegree),
    byPlanet: {
      sun: samples.map((sample) => sample.sun!.fullDegree),
      moon: samples.map((sample) => sample.moon!.fullDegree),
    },
    speedByPlanet: {
      sun: samples.map((sample) => sample.sun!.speed),
      moon: samples.map((sample) => sample.moon!.speed),
    },
  };
  const exactBirthTime = args.birthData.birthTimePrecision === "known";
  const progressedElongations = samples.map((sample) =>
    lunarElongationDegrees(sample.sun!.fullDegree, sample.moon!.fullDegree),
  );
  if (!exactBirthTime && !certifiesSingleLunarPhase(daySamples)) {
    const possiblePhases = Array.from(
      new Set(
        progressedElongations.map((elongation) =>
          lunarPhaseAtElongation(elongation).labelEs,
        ),
      ),
    );
    return {
      data: null,
      status: "partial",
      precision: "range",
      missingInputs: ["exact_birth_time_or_certified_progressed_phase"],
      limitations: [
        possiblePhases.length > 1
          ? `La fase de tu estación vital puede ser ${possiblePhases.join(" o ")} según la hora de nacimiento. Conservamos ambas posibilidades en vez de elegir una.`
          : "Tu estación vital queda demasiado cerca de un cambio de fase durante el día de nacimiento. No mostramos una sola fase hasta contar con una hora exacta.",
        ...(args.birthData.birthTimePrecision === "approximate"
          ? ["La hora aproximada no declara un margen verificable y por eso se trató como desconocida."]
          : []),
      ],
    } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "progressed_lunation" }>>;
  }
  const representativeIndex = Math.floor(samples.length / 2);
  const representative = samples[representativeIndex];
  const sun = representative.sun!;
  const moon = representative.moon!;
  const progressed = representative.progressed;
  const elongation = lunarElongationDegrees(sun.fullDegree, moon.fullDegree);
  const phase = lunarPhaseAtElongation(elongation);
  const relativeSpeeds = samples.map((sample) => sample.moon!.speed - sample.sun!.speed);
  const direction = Math.sign(relativeSpeeds[representativeIndex]);
  if (
    relativeSpeeds.some(
      (speed) =>
        !Number.isFinite(speed) ||
        Math.abs(speed) < 0.1 ||
        Math.sign(speed) !== direction,
    )
  ) {
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: ["progressed_relative_speed"],
      limitations: ["El movimiento disponible no alcanza para confirmar con seguridad cuándo empezó y cuándo termina esta fase."],
    } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "progressed_lunation" }>>;
  }
  const relativeSpeed = relativeSpeeds[representativeIndex];
  const startBoundary = previousLunarPhaseBoundaryDegrees(elongation);
  const nextBoundary = nextLunarPhaseBoundaryDegrees(elongation);
  const normalizedForward = (value: number) => ((value % 360) + 360) % 360;
  const backDegrees =
    direction >= 0
      ? normalizedForward(elongation - startBoundary)
      : normalizedForward(startBoundary - elongation);
  const nextDegrees =
    direction >= 0
      ? normalizedForward(nextBoundary - elongation)
      : normalizedForward(elongation - nextBoundary);
  const progressedPastCenter =
    progressed.progressedInstantMs - (backDegrees / Math.abs(relativeSpeed)) * MILLISECONDS_PER_DAY;
  const progressedFutureCenter =
    progressed.progressedInstantMs + (nextDegrees / Math.abs(relativeSpeed)) * MILLISECONDS_PER_DAY;
  const localDate = localDateForInstant(
    new Date(progressed.progressedInstantMs),
    args.birthData.timezone,
  );
  const [previousRoot, nextRoot] = await Promise.all([
    bracketedElongationRoot({
      centerMs: progressedPastCenter,
      radiusDays: 0.75,
      targetDegrees: phase.startDegrees,
      localDate,
      timezone: args.birthData.timezone,
      birthData: args.birthData,
      kind: "phase",
    }),
    bracketedElongationRoot({
      centerMs: progressedFutureCenter,
      radiusDays: 0.75,
      targetDegrees: phase.endDegrees % 360,
      localDate,
      timezone: args.birthData.timezone,
      birthData: args.birthData,
      kind: "phase",
    }),
  ]);
  if (previousRoot === null || nextRoot === null) {
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: ["progressed_phase_roots"],
      limitations: ["No pudimos confirmar con precisión las fechas de inicio y cierre de esta fase de la estación vital."],
    } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "progressed_lunation" }>>;
  }
  const phaseStartedAtRange = progressedBoundaryRange(birthInstants, previousRoot);
  const nextPhaseAtRange = progressedBoundaryRange(birthInstants, nextRoot);
  const phaseStartedAt =
    (phaseStartedAtRange.earliest + phaseStartedAtRange.latest) / 2;
  const nextPhaseAt = (nextPhaseAtRange.earliest + nextPhaseAtRange.latest) / 2;
  if (
    phaseStartedAtRange.latest > args.observedAt ||
    nextPhaseAtRange.earliest < args.observedAt
  ) {
    return {
      data: null,
      status: "partial",
      precision: "range",
      missingInputs: ["certified_progressed_phase_window"],
      limitations: [
        "Las fechas posibles no encierran de forma consistente el momento actual. La etapa se retira en vez de mostrar una fecha falsa.",
      ],
    } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "progressed_lunation" }>>;
  }
  return buildProgressedLunationLayerData({
    birthTimePrecision: args.birthData.birthTimePrecision,
    progressedSunLongitude: sun.fullDegree,
    progressedMoonLongitude: moon.fullDegree,
    ...(!exactBirthTime
      ? {
          progressedElongationRangeDegrees: {
            from: Math.min(...progressedElongations),
            to: Math.max(...progressedElongations),
          },
        }
      : {}),
    ageYears: progressed.tropicalAgeYears,
    observedAt: args.observedAt,
    phaseStartedAt,
    nextPhaseAt,
    phaseStartedAtRange,
    nextPhaseAtRange,
  });
}

function certifiedNatalElongationWindow(samples: NatalDaySamples) {
  if (
    samples.instants.length < 3 ||
    samples.sun.length !== samples.instants.length ||
    samples.moon.length !== samples.instants.length ||
    samples.speedByPlanet.sun?.length !== samples.instants.length ||
    samples.speedByPlanet.moon?.length !== samples.instants.length
  ) {
    return null;
  }
  const elongations = samples.moon.map((moon, index) =>
    lunarElongationDegrees(samples.sun[index], moon),
  );
  const unwrapped = [elongations[0]];
  for (let index = 1; index < elongations.length; index += 1) {
    unwrapped.push(unwrapDegrees(unwrapped[index - 1], elongations[index]));
  }
  for (let index = 0; index < unwrapped.length - 1; index += 1) {
    const duration = samples.instants[index + 1] - samples.instants[index];
    const relativeSpeedAtStart =
      samples.speedByPlanet.moon![index] - samples.speedByPlanet.sun![index];
    const relativeSpeedAtEnd =
      samples.speedByPlanet.moon![index + 1] - samples.speedByPlanet.sun![index + 1];
    const observedMotion = unwrapped[index + 1] - unwrapped[index];
    const conservativeMotionBound =
      segmentMotionMargin(
        "sun",
        samples.instants,
        index,
        samples.speedByPlanet.sun,
      ) +
      segmentMotionMargin(
        "moon",
        samples.instants,
        index,
        samples.speedByPlanet.moon,
      );
    if (
      !Number.isFinite(duration) ||
      !Number.isFinite(relativeSpeedAtStart) ||
      !Number.isFinite(relativeSpeedAtEnd) ||
      !Number.isFinite(observedMotion) ||
      !Number.isFinite(conservativeMotionBound) ||
      duration <= 0 ||
      relativeSpeedAtStart <= 0 ||
      relativeSpeedAtEnd <= 0 ||
      observedMotion <= 0 ||
      observedMotion > conservativeMotionBound
    ) {
      return null;
    }
  }
  // La última muestra es 23:59. Se agrega el máximo movimiento posible del
  // minuto restante para cubrir el día civil completo sin fingir que 23:59 es
  // el final matemático del intervalo.
  const finalMinuteMargin =
    (MAX_NATAL_MOTION_PER_DAY.sun + MAX_NATAL_MOTION_PER_DAY.moon) / (24 * 60);
  return {
    fromUnwrapped: unwrapped[0],
    toUnwrapped: unwrapped[unwrapped.length - 1] + finalMinuteMargin,
  };
}

async function cumplelunaBuild(args: {
  birthData: BirthDataSnapshot | null;
  chart: LayerChartInput | null;
  natalSamples?: NatalDaySamples;
  ephemeris: readonly EphemerisPosition[];
  observedAt: number;
  localDate: string;
  timezone: string;
}) {
  if (!args.birthData) {
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: ["birth_data"],
      limitations: [],
    } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "cumpleluna" }>>;
  }
  const currentSun = position(args.ephemeris, "sun");
  const currentMoon = position(args.ephemeris, "moon");
  if (!currentSun || !currentMoon) {
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: ["current_sun_moon"],
      limitations: [],
    } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "cumpleluna" }>>;
  }
  const currentElongation = lunarElongationDegrees(
    currentSun.fullDegree,
    currentMoon.fullDegree,
  );

  if (args.birthData.birthTimePrecision !== "known") {
    if (!args.natalSamples) {
      return {
        data: null,
        status: "partial",
        precision: "range",
        missingInputs: ["full_day_natal_samples"],
        limitations: [
          "Sin hora exacta necesitamos cubrir todo el día civil de nacimiento. No elegimos el mediodía como sustituto.",
        ],
      } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "cumpleluna" }>>;
    }
    const natalWindow = certifiedNatalElongationWindow(args.natalSamples);
    if (!natalWindow) {
      return {
        data: null,
        status: "partial",
        precision: "range",
        missingInputs: ["certified_natal_elongation_interval"],
        limitations: [
          "Las muestras del día de nacimiento no permiten certificar un único recorrido continuo Sol–Luna. Se retira la fecha en vez de elegir una hora arbitraria.",
        ],
      } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "cumpleluna" }>>;
    }
    const fromBranch = Math.floor(natalWindow.fromUnwrapped / 360);
    const toBranch = Math.floor(natalWindow.toUnwrapped / 360);
    if (fromBranch !== toBranch) {
      return {
        data: null,
        status: "partial",
        precision: "range",
        missingInputs: ["exact_birth_time_or_stable_cumpleluna_cycle"],
        limitations: [
          "Durante el día de nacimiento la distancia Sol–Luna cruza el comienzo de un ciclo. Este método no puede convertir ese arco circular en una única ventana certificada sin la hora exacta; por eso no mostramos una fecha central.",
        ],
      } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "cumpleluna" }>>;
    }
    const targetFrom = normalizedDegrees(natalWindow.fromUnwrapped);
    const targetTo = targetFrom + (natalWindow.toUnwrapped - natalWindow.fromUnwrapped);
    const targetMidpoint = (targetFrom + targetTo) / 2;
    const currentAligned =
      targetMidpoint +
      shortestSignedAngularDelta(targetMidpoint, currentElongation);
    if (currentAligned >= targetFrom && currentAligned <= targetTo) {
      return {
        data: null,
        status: "partial",
        precision: "range",
        missingInputs: ["exact_birth_time_or_stable_cumpleluna_cycle"],
        limitations: [
          "Hoy la repetición cae dentro del intervalo natal: para algunas horas de nacimiento ya ocurrió y para otras todavía falta. Se muestra el rango sin inventar un ciclo único.",
        ],
      } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "cumpleluna" }>>;
    }
    const [fromRoots, toRoots] = await Promise.all([
      cumplelunaRootPair({
        targetDegrees: targetFrom,
        currentElongationDegrees: currentElongation,
        observedAt: args.observedAt,
        localDate: args.localDate,
        timezone: args.timezone,
        birthData: args.birthData,
      }),
      cumplelunaRootPair({
        targetDegrees: targetTo,
        currentElongationDegrees: currentElongation,
        observedAt: args.observedAt,
        localDate: args.localDate,
        timezone: args.timezone,
        birthData: args.birthData,
      }),
    ]);
    if (!fromRoots || !toRoots) {
      return {
        data: null,
        status: "partial",
        precision: "range",
        missingInputs: ["cumpleluna_root_ranges"],
        limitations: [
          "No se pudieron confirmar las dos ventanas completas de repetición para todo el día natal.",
        ],
      } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "cumpleluna" }>>;
    }
    const previousExactAtRange = {
      earliest: Math.min(fromRoots.previousExactAt, toRoots.previousExactAt),
      latest: Math.max(fromRoots.previousExactAt, toRoots.previousExactAt),
    };
    const nextExactAtRange = {
      earliest: Math.min(fromRoots.nextExactAt, toRoots.nextExactAt),
      latest: Math.max(fromRoots.nextExactAt, toRoots.nextExactAt),
    };
    if (
      previousExactAtRange.latest > args.observedAt ||
      nextExactAtRange.earliest < args.observedAt
    ) {
      return {
        data: null,
        status: "partial",
        precision: "range",
        missingInputs: ["exact_birth_time_or_stable_cumpleluna_cycle"],
        limitations: [
          "El intervalo natal deja al momento actual entre dos ciclos posibles. No se publica un punto medio que podría pertenecer al ciclo equivocado.",
        ],
      } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "cumpleluna" }>>;
    }
    const previousExactAt =
      (previousExactAtRange.earliest + previousExactAtRange.latest) / 2;
    const nextExactAt =
      (nextExactAtRange.earliest + nextExactAtRange.latest) / 2;
    const rootWindowWidth = Math.max(
      previousExactAtRange.latest - previousExactAtRange.earliest,
      nextExactAtRange.latest - nextExactAtRange.earliest,
    );
    return buildCumplelunaLayerData({
      natalElongationDegrees: targetMidpoint,
      natalElongationRangeDegrees: { from: targetFrom, to: targetTo },
      currentSunLongitude: currentSun.fullDegree,
      currentMoonLongitude: currentMoon.fullDegree,
      previousExactAt,
      nextExactAt,
      previousExactAtRange,
      nextExactAtRange,
      observedAt: args.observedAt,
      natalPrecision: rootWindowWidth <= HOUR_MS ? "estimated" : "range",
      birthTimePrecision: args.birthData.birthTimePrecision,
    });
  }

  if (!args.chart) {
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: ["natal_chart"],
      limitations: [],
    } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "cumpleluna" }>>;
  }
  const natalSun = natalPosition(args.chart, "sun");
  const natalMoon = natalPosition(args.chart, "moon");
  if (
    typeof natalSun?.fullDegree !== "number" ||
    typeof natalMoon?.fullDegree !== "number"
  ) {
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: ["natal_and_current_sun_moon"],
      limitations: [],
    } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "cumpleluna" }>>;
  }
  const natalElongation = lunarElongationDegrees(natalSun.fullDegree, natalMoon.fullDegree);
  const roots = await cumplelunaRootPair({
    targetDegrees: natalElongation,
    currentElongationDegrees: currentElongation,
    observedAt: args.observedAt,
    localDate: args.localDate,
    timezone: args.timezone,
    birthData: args.birthData,
  });
  if (!roots) {
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: ["cumpleluna_roots"],
      limitations: ["No se pudieron confirmar dos repeticiones consecutivas del ángulo natal con los datos disponibles."],
    } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "cumpleluna" }>>;
  }
  return buildCumplelunaLayerData({
    natalSunLongitude: natalSun.fullDegree,
    natalMoonLongitude: natalMoon.fullDegree,
    currentSunLongitude: currentSun.fullDegree,
    currentMoonLongitude: currentMoon.fullDegree,
    previousExactAt: roots.previousExactAt,
    nextExactAt: roots.nextExactAt,
    observedAt: args.observedAt,
    natalPrecision: "exact",
    birthTimePrecision: args.birthData.birthTimePrecision,
  });
}

function natalResults(args: {
  birthData: BirthDataSnapshot | null;
  legacyChartSnapshot: NormalizedChartSnapshot | null;
  natalEphemeris: NatalEphemerisSnapshot | null;
  cached: readonly AnalysisResult[];
  observedAt: number;
  providerAttemptFailed?: boolean;
}) {
  const natalEphemeris = matchingNatalEphemeris(args.birthData, args.natalEphemeris);
  const geometry = verifiedLegacyGeometry(args.birthData, args.legacyChartSnapshot);
  const chartSnapshot = canonicalNatalChart({
    birthData: args.birthData,
    legacyChart: args.legacyChartSnapshot,
    natalEphemeris,
  });
  const samples = natalDaySamplesFromEphemeris(args.birthData, natalEphemeris);
  const baseHash = inputIdentity({ birthData: args.birthData, natalEphemeris, chart: geometry });
  const chart = toLayerChart(args.birthData, chartSnapshot);
  const builds = buildNatalLayerData({
    chart,
    sunLongitudeSamples: samples?.sun,
    moonLongitudeSamples: samples?.moon,
  });
  const canonicalRequired = <T extends AnalysisData>(build: LayerDataBuild<T>): LayerDataBuild<T> => {
    if (natalEphemeris || !args.birthData) return build;
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: Array.from(new Set([...build.missingInputs, "canonical_natal_ephemeris"])),
      limitations: [
        ...build.limitations,
        "No se obtuvieron posiciones natales canónicas. Órbita no sustituye ese cálculo con planetas de una carta anterior.",
      ],
    };
  };
  const lunarTypeBuild = canonicalRequired(
    intervalAwareLunarType(
      builds.lunarType,
      args.birthData?.birthTimePrecision ?? null,
      samples,
    ),
  );
  const elementMapBuild = canonicalRequired(
    intervalAwareElementMap(
      builds.elementMap,
      args.birthData?.birthTimePrecision ?? null,
      samples,
    ),
  );
  const relationshipPatternBuild = canonicalRequired(
    intervalAwareRelationshipPattern(
      builds.relationshipPattern,
      args.birthData?.birthTimePrecision ?? null,
      samples,
    ),
  );
  const choose = <T extends AnalysisData>(
    analysisId: AnalysisId,
    build: LayerDataBuild<T>,
    allowCached: boolean,
  ) => {
    const hash = buildNatalAnalysisInputHash(baseHash, analysisId);
    const cached = allowCached ? latestMatching(args.cached, analysisId, hash, args.observedAt) : null;
    return (
      cached ??
      wrapBuild({
        analysisId,
        inputHash: hash,
        observedAt: args.observedAt,
        validUntil: args.providerAttemptFailed && build.data === null ? args.observedAt + HOUR_MS : null,
        build,
        providerVersion: natalEphemeris?.providerVersion,
        forceStatus: args.providerAttemptFailed && build.data === null ? "error" : undefined,
      })
    );
  };
  const allowCached = !args.providerAttemptFailed;
  return {
    baseHash,
    chart,
    samples,
    bundle: {
      lunarType: choose("ORB-LUN-001", lunarTypeBuild, allowCached) as LunarTypeResult,
      elementMap: choose("ORB-NAT-001", elementMapBuild, allowCached) as ElementMapResult,
      relationshipPattern: choose(
        "ORB-REL-001",
        relationshipPatternBuild,
        allowCached,
      ) as RelationshipPatternResult,
    },
  };
}

async function currentStateForQuery(
  ctx: QueryCtx,
  args: { localDate: string; timezone: string },
) {
  const user = await findCurrentUser(ctx);
  if (!user) return null;
  const birthDocument = await findCurrentBirthData(ctx, user._id);
  const birthData = snapshotBirthData(birthDocument);
  const chartDocument = await findExactNatalChart(ctx, user._id, birthDocument);
  const natalEphemerisRow = await ctx.db
    .query("natalEphemerisCachesV492")
    .withIndex("by_cache_key", (queryBuilder) =>
      queryBuilder.eq("cacheKey", natalEphemerisCacheKey(String(user._id), birthData)),
    )
    .first();
  const rows = await ctx.db
    .query("analysisSnapshotsV492")
    .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", user._id))
    .collect();
  return {
    userId: user._id,
    birthData,
    chart: snapshotChart(chartDocument?.payload),
    natalEphemeris: natalEphemerisRow
      ? {
          inputHash: natalEphemerisRow.inputHash,
          methodVersion: natalEphemerisRow.methodVersion,
          providerVersion: natalEphemerisRow.providerVersion,
          birthTimePrecision: natalEphemerisRow.birthTimePrecision,
          samples: natalEphemerisRow.samples,
          calculatedAt: natalEphemerisRow.calculatedAt,
        }
      : null,
    snapshots: rows
      .filter(
        (row) =>
          row.localDate === undefined ||
          (row.localDate === args.localDate && (row.timezone === undefined || row.timezone === args.timezone)),
      )
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map(publicResult),
  };
}

export const getNatalBase = query({
  args: {},
  returns: v.union(natalBaseBundleValidator, v.null()),
  handler: async (ctx) => {
    const now = Date.now();
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    const birthDocument = await findCurrentBirthData(ctx, user._id);
    const birthData = snapshotBirthData(birthDocument);
    const chartDocument = await findExactNatalChart(ctx, user._id, birthDocument);
    const natalEphemerisRow = await ctx.db
      .query("natalEphemerisCachesV492")
      .withIndex("by_cache_key", (queryBuilder) =>
        queryBuilder.eq("cacheKey", natalEphemerisCacheKey(String(user._id), birthData)),
      )
      .first();
    const rows = await ctx.db
      .query("analysisSnapshotsV492")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", user._id))
      .collect();
    return natalResults({
      birthData,
      legacyChartSnapshot: snapshotChart(chartDocument?.payload),
      natalEphemeris: natalEphemerisRow
        ? {
            inputHash: natalEphemerisRow.inputHash,
            methodVersion: natalEphemerisRow.methodVersion,
            providerVersion: natalEphemerisRow.providerVersion,
            birthTimePrecision: natalEphemerisRow.birthTimePrecision,
            samples: natalEphemerisRow.samples,
            calculatedAt: natalEphemerisRow.calculatedAt,
          }
        : null,
      cached: rows.sort((left, right) => right.updatedAt - left.updatedAt).map(publicResult),
      observedAt: now,
    }).bundle;
  },
});

/**
 * Read-model público y tipado de la carta natal V4.9.2.
 *
 * A diferencia de `charts.current`, Sol–Plutón salen siempre del cache
 * `planets/tropical`. El payload occidental anterior sólo aporta geometría
 * verificada de casas/Ascendente/Medio Cielo cuando la hora es conocida.
 */
export const getNatalChartBase = query({
  args: {},
  returns: v.union(natalChartBaseValidator, v.null()),
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    const birthDocument = await findCurrentBirthData(ctx, user._id);
    const birthData = snapshotBirthData(birthDocument);
    const chartDocument = await findExactNatalChart(ctx, user._id, birthDocument);
    const natalEphemerisRow = await ctx.db
      .query("natalEphemerisCachesV492")
      .withIndex("by_cache_key", (queryBuilder) =>
        queryBuilder.eq("cacheKey", natalEphemerisCacheKey(String(user._id), birthData)),
      )
      .first();
    const natalEphemeris: NatalEphemerisSnapshot | null = natalEphemerisRow
      ? {
          inputHash: natalEphemerisRow.inputHash,
          methodVersion: natalEphemerisRow.methodVersion,
          providerVersion: natalEphemerisRow.providerVersion,
          birthTimePrecision: natalEphemerisRow.birthTimePrecision,
          samples: natalEphemerisRow.samples,
          calculatedAt: natalEphemerisRow.calculatedAt,
        }
      : null;
    return canonicalNatalChartBase({
      birthData,
      legacyChartSnapshot: snapshotChart(chartDocument?.payload),
      natalEphemeris,
      isPro: await isUserPro(ctx, user._id),
      observedAt: Date.now(),
    });
  },
});

export const getForDate = query({
  args: {
    localDate: v.string(),
    timezone: v.string(),
  },
  returns: v.union(layerBundleValidator, v.null()),
  handler: async (ctx, args) => {
    assertLocalDate(args.localDate);
    assertTimezone(args.timezone);
    const now = Date.now();
    const state = await currentStateForQuery(ctx, args);
    if (!state) return null;
    const natal = natalResults({
      birthData: state.birthData,
      legacyChartSnapshot: state.chart,
      natalEphemeris: state.natalEphemeris,
      cached: state.snapshots,
      observedAt: now,
    });
    const dailyScope = { localDate: args.localDate, timezone: args.timezone };
    const cachedOrUnavailable = (
      analysisId: AnalysisId,
      missingInputs: string[],
      options?: Parameters<typeof unavailableResult>[4],
    ) =>
      latestMatching(
        state.snapshots,
        analysisId,
        resultHash(natal.baseHash, analysisId, dailyScope),
        now,
      ) ?? unavailableResult(analysisId, resultHash(natal.baseHash, analysisId, dailyScope), now, missingInputs, options);

    const transitRanking = cachedOrUnavailable("ORB-TRN-002", ["current_ephemeris"]) as TransitRankingResult;
    // Los dos sobres se rescatan del cache por separado, así que una fila vieja
    // del arco puede describir otro contacto que el que encabeza este ranking.
    // La lectura pura no calcula nada: si no corresponden, el arco se descarta.
    const transitArc = coherentTransitArc({
      ranking: transitRanking,
      arc: cachedOrUnavailable("ORB-TRN-001", ["active_transit_arc"]) as TransitArcResult,
      observedAt: now,
      status: "unavailable",
      validUntil: null,
    });
    const moonOnChart = cachedOrUnavailable("ORB-LUN-003", ["current_ephemeris"]) as MoonOnChartResult;
    const cumpleluna = (
      latestMatching(
        state.snapshots,
        "ORB-LUN-002",
        resultHash(natal.baseHash, "ORB-LUN-002"),
        now,
      ) ??
      unavailableResult(
        "ORB-LUN-002",
        resultHash(natal.baseHash, "ORB-LUN-002"),
        now,
        ["current_ephemeris"],
      )
    ) as CumplelunaResult;
    const progressedLunation = (
      latestMatching(
        state.snapshots,
        "ORB-CYC-002",
        progressedLunationInputHash(natal.baseHash),
        now,
      ) ??
      unavailableResult(
        "ORB-CYC-002",
        progressedLunationInputHash(natal.baseHash),
        now,
        ["progressed_ephemeris"],
        state.birthData
          ? undefined
          : { status: "needs_birth_time", precision: "not_applicable" },
      )
    ) as ProgressedLunationResult;

    const profectionBuild = buildAnnualProfectionLayerData({
      chart: natal.chart,
      asOfDate: args.localDate,
      civilDateToTimestamp: (civilDate) =>
        zonedInstant(civilDate, "00:00", args.timezone),
    });
    const profectionHash = resultHash(natal.baseHash, "ORB-CYC-001", {
      periodStart: profectionBuild.data?.periodStart ?? null,
    });
    const annualProfection = wrapBuild({
      analysisId: "ORB-CYC-001",
      inputHash: profectionHash,
      observedAt: now,
      validUntil: profectionBuild.data?.periodEnd ?? null,
      build: profectionBuild,
    }) as AnnualProfectionResult;
    const mandalaSources: AnalysisResult[] = [
      progressedLunation,
      annualProfection,
      cumpleluna,
      transitArc,
    ];
    const mandalaHash = temporalMandalaInputHash(natal.baseHash, dailyScope, mandalaSources);
    const mandalaMissingInputs = Array.from(
      new Set(mandalaSources.flatMap((source) => source.missingInputs)),
    );
    const temporalMandala = (
      latestMatching(state.snapshots, "ORB-CYC-007", mandalaHash, now) ??
      unavailableResult(
        "ORB-CYC-007",
        mandalaHash,
        now,
        mandalaMissingInputs.length > 0
          ? mandalaMissingInputs
          : ["temporal_mandala_refresh"],
      )
    ) as TemporalMandalaResult;
    return {
      natal: natal.bundle,
      today: { transitRanking, transitArc, moonOnChart, cumpleluna },
      moment: { progressedLunation, annualProfection, temporalMandala },
    };
  },
});

/**
 * El alcance del arco pedido.
 *
 * `getForDate` publica `ORB-TRN-001` del arco PRINCIPAL con el alcance
 * `{ localDate, timezone }`. Un arco cualquiera de la lista suma su `arcId`, así
 * que dos arcos del mismo día son dos hashes y dos filas distintas, y ninguno de
 * los dos puede pisar al principal ni ser leído en su lugar.
 */
function transitArcScope(args: { localDate: string; timezone: string; arcId: string }) {
  return { localDate: args.localDate, timezone: args.timezone, arcId: args.arcId };
}

/**
 * `ORB-TRN-001` del arco pedido, tal como quedó calculado. Lectura reactiva y
 * pura: no pega al proveedor ni escribe nada.
 *
 * Devuelve `null` sólo cuando no hay cuenta con datos —la misma semántica que
 * `getForDate`—. Con cuenta, siempre devuelve un sobre `ORB-TRN-001`: nunca el
 * ranking ni un arco distinto del pedido. Mientras ese cálculo específico no
 * existe, el sobre lo declara con `requested_transit_arc_calculation`, que es un
 * hecho distinto de "ese tránsito ya no está activo"
 * (`requested_transit_arc`).
 */
export const getTransitArc = query({
  args: {
    localDate: v.string(),
    timezone: v.string(),
    arcId: v.string(),
  },
  returns: v.union(transitArcResultValidator, v.null()),
  handler: async (ctx, args) => {
    assertLocalDate(args.localDate);
    assertTimezone(args.timezone);
    assertArcId(args.arcId);
    const now = Date.now();
    const state = await currentStateForQuery(ctx, args);
    if (!state) return null;
    const natal = natalResults({
      birthData: state.birthData,
      legacyChartSnapshot: state.chart,
      natalEphemeris: state.natalEphemeris,
      cached: state.snapshots,
      observedAt: now,
    });
    const arcHash = resultHash(natal.baseHash, "ORB-TRN-001", transitArcScope(args));
    const cached = latestMatching(state.snapshots, "ORB-TRN-001", arcHash, now);
    if (cached && arcResultMatchesArcId(cached, args.arcId)) {
      return cached as TransitArcResult;
    }
    return unavailableResult(
      "ORB-TRN-001",
      arcHash,
      now,
      ["requested_transit_arc_calculation"],
      {
        limitations: [
          "Todavía no calculamos la línea de tiempo de este tránsito para hoy.",
        ],
      },
    ) as TransitArcResult;
  },
});

/**
 * Calcula y persiste `ORB-TRN-001` del arco pedido.
 *
 * Es el mismo motor del arco principal, con una sola diferencia: el contacto no
 * se elige por ranking sino por el `arcId` que pidió la persona. Ese contacto
 * —y no otro— es el que se verifica contra `planets/tropical`, así que las
 * pasadas, la ventana, la precisión, las limitaciones y las fuentes que se
 * publican son las de ESE tránsito.
 *
 * Lo que nunca hace: reconstruir el arco con metadatos del ranking. Si el arco
 * salió de la lista, el sobre lo dice; si falla el proveedor o el seguimiento,
 * queda `stale`, `partial` o `error` con su motivo.
 */
export const refreshTransitArc = action({
  args: {
    localDate: v.string(),
    timezone: v.string(),
    arcId: v.string(),
  },
  returns: transitArcResultValidator,
  handler: async (ctx, args): Promise<TransitArcResult> => {
    assertLocalDate(args.localDate);
    assertTimezone(args.timezone);
    assertArcId(args.arcId);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");
    const observedAt = Date.now();
    if (localDateForInstant(new Date(observedAt), args.timezone) !== args.localDate) {
      throw new Error("localDate must match the server-captured instant in the requested timezone");
    }
    const state = await ctx.runQuery(internalApi.layers.getRefreshState, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate: args.localDate,
      timezone: args.timezone,
    });
    const expectedInputFingerprint = buildLayerRefreshInputFingerprint({
      userId: state.userId,
      birthDataId: state.birthDataId,
      natalChartId: state.natalChartId,
      birthData: state.birthData,
      chart: state.chart,
    });
    // La efeméride natal es del ciclo del día completo (`refreshForDate`): acá se
    // reutiliza tal como está. Si falta, el sobre declara ese faltante en vez de
    // calcular la carta canónica por un camino paralelo.
    const natal = natalResults({
      birthData: state.birthData,
      legacyChartSnapshot: state.chart,
      natalEphemeris: state.natalEphemeris,
      cached: state.snapshots,
      observedAt,
    });
    const arcHash = resultHash(natal.baseHash, "ORB-TRN-001", transitArcScope(args));
    const cached = latestMatching(state.snapshots, "ORB-TRN-001", arcHash, observedAt);
    if (cached && cached.status !== "stale" && cached.data !== null && arcResultMatchesArcId(cached, args.arcId)) {
      // Dentro de la vigencia horaria del cielo, repetir la búsqueda de pasadas
      // serían decenas de consultas históricas para el mismo resultado.
      return cached as TransitArcResult;
    }

    const sky = await resolveDailySky({
      sky: state.sky,
      observedAt,
      localDate: args.localDate,
      timezone: args.timezone,
    });
    const staleLimitation = sky.isStale
      ? ["No pudimos actualizar el cielo; se muestra el último cálculo disponible."]
      : [];

    if (!sky.ephemeris) {
      const fallback = staleProviderFallback(state.snapshots, "ORB-TRN-001", arcHash, observedAt);
      const envelope = (
        fallback && arcResultMatchesArcId(fallback, args.arcId)
          ? fallback
          : unavailableResult("ORB-TRN-001", arcHash, observedAt, ["current_ephemeris"], {
              status: "error",
              validUntil: observedAt + HOUR_MS,
            })
      ) as TransitArcResult;
      await ctx.runMutation(internalApi.layers.persistRefresh, {
        userId: state.userId,
        birthDataId: state.birthDataId,
        natalChartId: state.natalChartId,
        expectedInputFingerprint,
        localDate: args.localDate,
        timezone: args.timezone,
        results: [envelope],
        sky: null,
        natalEphemeris: null,
      });
      return envelope;
    }

    const contacts = buildTransitContacts({
      baseHash: natal.baseHash,
      chart: natal.chart,
      ephemeris: sky.ephemeris,
      observedAt: sky.observedAt,
      natalSamples: natal.samples,
    });
    const selected = contactForArcId(contacts, sky.observedAt, args.arcId, args.localDate, args.timezone);
    // La identidad del arco viaja con el contacto: verificar las pasadas mueve la
    // ventana y con ella el identificador derivado, y el sobre tiene que seguir
    // siendo el del arco que se pidió.
    const timeline =
      !sky.isStale && selected
        ? await verifiedTimelineForContact({
            contact: { ...selected, arcId: args.arcId },
            timezone: args.timezone,
          })
        : null;
    const arcContacts =
      timeline?.status === "verified"
        ? timeline.contacts
        : selected
          ? contacts.map((contact) => (contact === selected ? { ...contact, arcId: args.arcId } : contact))
          : contacts;
    const rawArcBuild = natal.chart
      ? buildTransitArcLayerData({
          contacts: arcContacts,
          observedAt: sky.observedAt,
          arcId: args.arcId,
          localDate: args.localDate,
          timezone: args.timezone,
        })
      : ({
          data: null,
          status: "unavailable",
          precision: "not_applicable",
          missingInputs: ["natal_chart"],
          limitations: [],
        } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "transit_arc" }>>);
    const arcBuild = honestTransitArcBuild(rawArcBuild, natal.chart, natal.samples, timeline);
    const calculated = wrapBuild({
      analysisId: "ORB-TRN-001",
      inputHash: arcHash,
      observedAt: sky.observedAt,
      validUntil: sky.observedAt + HOUR_MS,
      build: arcBuild,
      providerVersion:
        timeline?.status === "verified" ? NATAL_EPHEMERIS_PROVIDER_VERSION : sky.providerVersion,
      forceStatus: sky.isStale && arcBuild.data ? "stale" : undefined,
      extraLimitations: staleLimitation,
    }) as TransitArcResult;
    const timelineFailed =
      timeline !== null && timeline.status !== "verified" && timeline.status !== "not_active";
    const staleCandidate =
      sky.isStale || timelineFailed || arcBuild.missingInputs.includes("full_day_natal_samples")
        ? staleProviderFallback(state.snapshots, "ORB-TRN-001", arcHash, observedAt)
        : null;
    // Un `stale` sólo sirve si es de ESTE arco. El hash ya está acotado al
    // `arcId`, y esta comprobación además exige que el dato guardado lo declare.
    const envelope = (
      staleCandidate && staleCandidate.data !== null && arcResultMatchesArcId(staleCandidate, args.arcId)
        ? staleCandidate
        : calculated
    ) as TransitArcResult;

    await ctx.runMutation(internalApi.layers.persistRefresh, {
      userId: state.userId,
      birthDataId: state.birthDataId,
      natalChartId: state.natalChartId,
      expectedInputFingerprint,
      localDate: args.localDate,
      timezone: args.timezone,
      results: [envelope],
      sky: sky.toPersist,
      natalEphemeris: null,
    });
    return envelope;
  },
});

export const getRefreshState = internalQuery({
  args: {
    tokenIdentifier: v.string(),
    localDate: v.string(),
    timezone: v.string(),
  },
  returns: refreshStateValidator,
  handler: async (ctx, args) => {
    assertLocalDate(args.localDate);
    assertTimezone(args.timezone);
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");
    const birthData = await findCurrentBirthData(ctx, user._id);
    const birthDataSnapshot = snapshotBirthData(birthData);
    const natalChart = await findExactNatalChart(ctx, user._id, birthData);
    const natalEphemerisRow = await ctx.db
      .query("natalEphemerisCachesV492")
      .withIndex("by_cache_key", (queryBuilder) =>
        queryBuilder.eq(
          "cacheKey",
          natalEphemerisCacheKey(String(user._id), birthDataSnapshot),
        ),
      )
      .first();
    const snapshotRows = await ctx.db
      .query("analysisSnapshotsV492")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", user._id))
      .collect();
    const snapshots = snapshotRows
      .filter(
        (row) =>
          row.localDate === undefined ||
          (row.localDate === args.localDate && (row.timezone === undefined || row.timezone === args.timezone)),
      )
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map(publicResult);
    const skyRows = await ctx.db
      .query("globalSkySnapshotsV492")
      .withIndex("by_date_timezone", (queryBuilder) => queryBuilder.eq("localDate", args.localDate))
      .filter((queryBuilder) => queryBuilder.eq(queryBuilder.field("timezone"), args.timezone))
      .collect();
    const skyRow = skyRows.sort(
      (left, right) =>
        right.observedAt - left.observedAt || right.updatedAt - left.updatedAt,
    )[0] ?? null;
    return {
      userId: user._id,
      birthDataId: birthData?._id ?? null,
      natalChartId: natalChart?._id ?? null,
      birthData: birthDataSnapshot,
      chart: snapshotChart(natalChart?.payload),
      natalEphemeris: natalEphemerisRow
        ? {
            inputHash: natalEphemerisRow.inputHash,
            methodVersion: natalEphemerisRow.methodVersion,
            providerVersion: natalEphemerisRow.providerVersion,
            birthTimePrecision: natalEphemerisRow.birthTimePrecision,
            samples: natalEphemerisRow.samples,
            calculatedAt: natalEphemerisRow.calculatedAt,
          }
        : null,
      snapshots,
      sky: skyRow
        ? {
            providerVersion: skyRow.providerVersion,
            observedAt: skyRow.observedAt,
            validUntil: skyRow.validUntil,
            positions: skyRow.positions,
          }
        : null,
    };
  },
});

export const persistRefresh = internalMutation({
  args: {
    userId: v.id("users"),
    birthDataId: v.union(v.id("birthData"), v.null()),
    natalChartId: v.union(v.id("natalCharts"), v.null()),
    expectedInputFingerprint: v.string(),
    localDate: v.string(),
    timezone: v.string(),
    results: v.array(analysisResultValidator),
    sky: v.union(skySnapshotValidator, v.null()),
    natalEphemeris: v.union(natalEphemerisSnapshotValidator, v.null()),
  },
  returns: v.object({ written: v.number() }),
  handler: async (ctx, args) => {
    assertLocalDate(args.localDate);
    assertTimezone(args.timezone);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User record not found");
    const currentBirthDocument = await findCurrentBirthData(ctx, args.userId);
    const currentBirthData = snapshotBirthData(currentBirthDocument);
    const currentNatalChart = await findExactNatalChart(
      ctx,
      args.userId,
      currentBirthDocument,
    );
    const currentInputFingerprint = buildLayerRefreshInputFingerprint({
      userId: args.userId,
      birthDataId: currentBirthDocument?._id ?? null,
      natalChartId: currentNatalChart?._id ?? null,
      birthData: currentBirthData,
      chart: snapshotChart(currentNatalChart?.payload),
    });
    if (currentInputFingerprint !== args.expectedInputFingerprint) {
      throw new Error("LAYER_INPUT_CHANGED_DURING_REFRESH");
    }
    if (args.birthDataId) {
      const birthData = await ctx.db.get(args.birthDataId);
      if (!birthData || birthData.userId !== args.userId) throw new Error("Birth data not found for user");
    }
    if (args.natalChartId) {
      const natalChart = await ctx.db.get(args.natalChartId);
      if (!natalChart || natalChart.userId !== args.userId) throw new Error("Natal chart not found for user");
    }

    const now = Date.now();
    let written = 0;

    if (args.natalEphemeris) {
      if (!args.birthDataId) throw new Error("Natal ephemeris requires birth data");
      const birthDocument = await ctx.db.get(args.birthDataId);
      const birthData = snapshotBirthData(birthDocument);
      const verified = matchingNatalEphemeris(birthData, args.natalEphemeris);
      if (!verified) throw new Error("Natal ephemeris does not match the current birth data");
      const natalKey = natalEphemerisCacheKey(String(args.userId), birthData);
      const existing = await ctx.db
        .query("natalEphemerisCachesV492")
        .withIndex("by_cache_key", (queryBuilder) => queryBuilder.eq("cacheKey", natalKey))
        .first();
      // Convex actions can finish out of order. The input fingerprint protects
      // against a changed chart; this timestamp guard independently prevents
      // an older response for the same chart from replacing a newer cache.
      if (!existing || existing.calculatedAt < verified.calculatedAt) {
        const fields = omitUndefined({
          userId: args.userId,
          birthDataId: args.birthDataId,
          natalChartId: args.natalChartId ?? undefined,
          cacheKey: natalKey,
          inputHash: verified.inputHash,
          methodVersion: verified.methodVersion,
          providerVersion: verified.providerVersion,
          birthTimePrecision: verified.birthTimePrecision,
          samples: verified.samples,
          calculatedAt: verified.calculatedAt,
          updatedAt: now,
        });
        if (existing) await ctx.db.patch(existing._id, fields);
        else await ctx.db.insert("natalEphemerisCachesV492", { ...fields, createdAt: now });
      }
    }

    for (const result of args.results) {
      const rowCacheKey = cacheKey({
        userId: String(args.userId),
        result,
        localDate: args.localDate,
        timezone: args.timezone,
      });
      const existing = await ctx.db
        .query("analysisSnapshotsV492")
        .withIndex("by_cache_key", (queryBuilder) => queryBuilder.eq("cacheKey", rowCacheKey))
        .first();
      if (existing && existing.observedAt >= result.observedAt) {
        continue;
      }
      const isDaily = ["ORB-TRN-002", "ORB-TRN-001", "ORB-LUN-003", "ORB-CYC-007"].includes(
        result.analysisId,
      );
      const fields = omitUndefined({
        userId: args.userId,
        birthDataId: args.birthDataId ?? undefined,
        natalChartId: args.natalChartId ?? undefined,
        analysisId: result.analysisId,
        cacheKey: rowCacheKey,
        localDate: isDaily ? args.localDate : undefined,
        timezone: isDaily ? args.timezone : undefined,
        methodVersion: result.methodVersion,
        providerVersion: result.providerVersion,
        inputHash: result.inputHash,
        status: result.status,
        precision: result.precision,
        observedAt: result.observedAt,
        validUntil: result.validUntil,
        data: result.data,
        missingInputs: result.missingInputs,
        limitations: result.limitations,
        elaboration: result.elaboration,
        sourceRefs: result.sourceRefs,
        updatedAt: now,
      });
      if (existing) await ctx.db.patch(existing._id, fields);
      else await ctx.db.insert("analysisSnapshotsV492", { ...fields, createdAt: now });
      written += 1;
    }

    if (args.sky) {
      const skyKey = `v492:sky:${args.sky.providerVersion}:${args.localDate}:${args.timezone}`;
      const scopeRows = await ctx.db
        .query("globalSkySnapshotsV492")
        .withIndex("by_date_timezone", (queryBuilder) =>
          queryBuilder.eq("localDate", args.localDate),
        )
        .filter((queryBuilder) =>
          queryBuilder.eq(queryBuilder.field("timezone"), args.timezone),
        )
        .collect();
      // The provider version is part of the cache key, but not of the sky
      // scope the user reads. Guard the complete date/timezone scope so an old
      // response from another provider version cannot become the newest row
      // merely because its network request finished later.
      const hasSameOrNewerSky = scopeRows.some(
        (row) => row.observedAt >= args.sky!.observedAt,
      );
      if (!hasSameOrNewerSky) {
        const existing = scopeRows.find((row) => row.cacheKey === skyKey) ?? null;
        const fields = {
          cacheKey: skyKey,
          localDate: args.localDate,
          timezone: args.timezone,
          providerVersion: args.sky.providerVersion,
          observedAt: args.sky.observedAt,
          validUntil: args.sky.validUntil,
          positions: args.sky.positions,
          updatedAt: now,
        };
        if (existing) await ctx.db.patch(existing._id, fields);
        else await ctx.db.insert("globalSkySnapshotsV492", { ...fields, createdAt: now });
      }
    }
    return { written };
  },
});

export const refreshForDate = action({
  args: {
    localDate: v.string(),
    timezone: v.string(),
  },
  returns: layerBundleValidator,
  handler: async (ctx, args) => {
    assertLocalDate(args.localDate);
    assertTimezone(args.timezone);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");
    const observedAt = Date.now();
    if (localDateForInstant(new Date(observedAt), args.timezone) !== args.localDate) {
      throw new Error("localDate must match the server-captured instant in the requested timezone");
    }
    const state = await ctx.runQuery(internalApi.layers.getRefreshState, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate: args.localDate,
      timezone: args.timezone,
    });
    const expectedInputFingerprint = buildLayerRefreshInputFingerprint({
      userId: state.userId,
      birthDataId: state.birthDataId,
      natalChartId: state.natalChartId,
      birthData: state.birthData,
      chart: state.chart,
    });

    let natalEphemeris = matchingNatalEphemeris(state.birthData, state.natalEphemeris);
    let natalEphemerisToPersist: NatalEphemerisSnapshot | null = null;
    let natalProviderFailed = false;
    if (state.birthData && !natalEphemeris) {
      natalEphemeris = await calculateNatalEphemeris(state.birthData, observedAt);
      natalEphemerisToPersist = natalEphemeris;
      natalProviderFailed = natalEphemeris === null;
    }
    const natal = natalResults({
      birthData: state.birthData,
      legacyChartSnapshot: state.chart,
      natalEphemeris,
      cached: state.snapshots,
      observedAt,
      providerAttemptFailed: natalProviderFailed,
    });
    const samples = natal.samples;

    const profectionBuild = buildAnnualProfectionLayerData({
      chart: natal.chart,
      asOfDate: args.localDate,
      civilDateToTimestamp: (civilDate) =>
        zonedInstant(civilDate, "00:00", args.timezone),
    });
    const annualProfection = wrapBuild({
      analysisId: "ORB-CYC-001",
      inputHash: resultHash(natal.baseHash, "ORB-CYC-001", {
        periodStart: profectionBuild.data?.periodStart ?? null,
      }),
      observedAt,
      validUntil: profectionBuild.data?.periodEnd ?? null,
      build: profectionBuild,
    }) as AnnualProfectionResult;

    const progressedHash = progressedLunationInputHash(natal.baseHash);
    const cachedProgressed = latestMatching(state.snapshots, "ORB-CYC-002", progressedHash, observedAt);
    let progressedLunation: ProgressedLunationResult;
    if (cachedProgressed && cachedProgressed.status !== "stale") {
      progressedLunation = cachedProgressed as ProgressedLunationResult;
    } else {
      const build = await progressedLunationBuild({
        birthData: state.birthData,
        observedAt,
      });
      const calculated = wrapBuild({
        analysisId: "ORB-CYC-002",
        inputHash: progressedHash,
        observedAt,
        validUntil: build.data
          ? Math.min(
              build.data.nextPhaseAtRange?.earliest ?? build.data.nextPhaseAt,
              observedAt + MONTH_MS,
            )
          : build.status === "needs_birth_time"
            ? null
            : observedAt + HOUR_MS,
        build,
        providerVersion: build.data ? "astrologyapi-planets-tropical-v1" : undefined,
      }) as ProgressedLunationResult;
      progressedLunation =
        calculated.data === null && cachedProgressed?.data
          ? (cachedProgressed as ProgressedLunationResult)
          : calculated;
    }

    const sky = await resolveDailySky({
      sky: state.sky,
      observedAt,
      localDate: args.localDate,
      timezone: args.timezone,
    });
    const ephemeris = sky.ephemeris;
    const ephemerisObservedAt = sky.observedAt;
    const providerVersion = sky.providerVersion;
    const skyIsStale = sky.isStale;
    const skyToPersist = sky.toPersist;

    const dailyScope = { localDate: args.localDate, timezone: args.timezone };
    const todayValidUntil = ephemerisObservedAt + HOUR_MS;
    let transitRanking: TransitRankingResult;
    let transitArc: TransitArcResult;
    let moonOnChart: MoonOnChartResult;
    let cumpleluna: CumplelunaResult;
    if (ephemeris) {
      const contacts = buildTransitContacts({
        baseHash: natal.baseHash,
        chart: natal.chart,
        ephemeris,
        observedAt: ephemerisObservedAt,
        natalSamples: samples,
      });
      const rawRankingBuild = natal.chart
        ? buildTransitRankingLayerData({
            contacts,
            observedAt: ephemerisObservedAt,
            localDate: args.localDate,
            timezone: args.timezone,
          })
        : ({
            data: null,
            status: "unavailable",
            precision: "not_applicable",
            missingInputs: ["natal_chart"],
            limitations: ["El ranking necesita una carta natal para calcular contactos personales."],
          } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "transit_ranking" }>>);
      const rankingBuild = honestTransitRankingBuild(rawRankingBuild, natal.chart, samples);
      const staleLimitation = skyIsStale
        ? ["No pudimos actualizar el cielo; se muestra el último cálculo disponible."]
        : [];
      const rankingHash = resultHash(natal.baseHash, "ORB-TRN-002", dailyScope);
      const calculatedRanking = wrapBuild({
        analysisId: "ORB-TRN-002",
        inputHash: rankingHash,
        observedAt: ephemerisObservedAt,
        validUntil: todayValidUntil,
        build: rankingBuild,
        providerVersion,
        forceStatus: skyIsStale && rankingBuild.data ? "stale" : undefined,
        extraLimitations: staleLimitation,
      }) as TransitRankingResult;
      transitRanking =
        rankingBuild.data === null && rankingBuild.missingInputs.includes("full_day_natal_samples")
          ? ((staleProviderFallback(
              state.snapshots,
              "ORB-TRN-002",
              rankingHash,
              observedAt,
            ) as TransitRankingResult | null) ?? calculatedRanking)
          : calculatedRanking;

      const arcHash = resultHash(natal.baseHash, "ORB-TRN-001", dailyScope);
      const cachedArc = latestMatching(state.snapshots, "ORB-TRN-001", arcHash, observedAt);
      const primary = primaryTransitContact(contacts, ephemerisObservedAt, args.localDate, args.timezone);
      if (
        cachedArc &&
        cachedArc.status !== "stale" &&
        arcResultMatchesPrimary(cachedArc as TransitArcResult, primary)
      ) {
        // La cronología comparte la vigencia horaria del cielo. Reutilizar el
        // sobre evita repetir decenas de consultas históricas en refreshes
        // concurrentes o al retomar la app dentro de la misma hora.
        transitArc = cachedArc as TransitArcResult;
      } else {
        const timeline =
          !skyIsStale && primary
            ? await verifiedTimelineForContact({
                contact: primary.contact,
                timezone: args.timezone,
              })
            : null;
        // Verificar mueve las FECHAS del arco, no su identidad: los contactos
        // verificados conservan el `arcId` que declaró el contacto principal, que
        // es exactamente el que publicó el ranking de esta misma corrida.
        const arcContacts =
          timeline?.status === "verified"
            ? timeline.contacts
            : primary
              ? contacts.map((contact) => (contact === primary.source ? primary.contact : contact))
              : contacts;
        const rawArcBuild = natal.chart
          ? buildTransitArcLayerData({
              contacts: arcContacts,
              observedAt: ephemerisObservedAt,
              arcId: primary?.arcId,
              localDate: args.localDate,
              timezone: args.timezone,
            })
          : ({
              data: null,
              status: "unavailable",
              precision: "not_applicable",
              missingInputs: ["natal_chart"],
              limitations: [],
            } satisfies LayerDataBuild<Extract<AnalysisData, { kind: "transit_arc" }>>);
        const arcBuild = honestTransitArcBuild(rawArcBuild, natal.chart, samples, timeline);
        const calculatedArc = wrapBuild({
          analysisId: "ORB-TRN-001",
          inputHash: arcHash,
          observedAt: ephemerisObservedAt,
          validUntil: todayValidUntil,
          build: arcBuild,
          providerVersion:
            timeline?.status === "verified"
              ? NATAL_EPHEMERIS_PROVIDER_VERSION
              : providerVersion,
          forceStatus: skyIsStale && arcBuild.data ? "stale" : undefined,
          extraLimitations: staleLimitation,
        }) as TransitArcResult;
        const timelineFailed = timeline !== null && timeline.status !== "verified" && timeline.status !== "not_active";
        const staleCandidate =
          skyIsStale || timelineFailed || arcBuild.missingInputs.includes("full_day_natal_samples")
            ? (staleProviderFallback(
                state.snapshots,
                "ORB-TRN-001",
                arcHash,
                observedAt,
              ) as TransitArcResult | null)
            : null;
        const cachedFallback =
          staleCandidate && arcResultMatchesPrimary(staleCandidate, primary)
            ? staleCandidate
            : null;
        transitArc = cachedFallback ?? calculatedArc;
      }
      const moonBuild = buildCurrentMoonLayerData({ chart: natal.chart, ephemeris });
      moonOnChart = wrapBuild({
        analysisId: "ORB-LUN-003",
        inputHash: resultHash(natal.baseHash, "ORB-LUN-003", dailyScope),
        observedAt: ephemerisObservedAt,
        validUntil: todayValidUntil,
        build: moonBuild,
        providerVersion,
        forceStatus: skyIsStale && moonBuild.data ? "stale" : undefined,
        extraLimitations: staleLimitation,
      }) as MoonOnChartResult;

      const cumpleHash = resultHash(natal.baseHash, "ORB-LUN-002");
      const cachedCumple = latestMatching(state.snapshots, "ORB-LUN-002", cumpleHash, observedAt);
      if (cachedCumple && cachedCumple.status !== "stale") {
        cumpleluna = cachedCumple as CumplelunaResult;
      } else if (skyIsStale) {
        cumpleluna =
          cachedCumple?.data
            ? (cachedCumple as CumplelunaResult)
            : (unavailableResult("ORB-LUN-002", cumpleHash, observedAt, ["fresh_ephemeris"]) as CumplelunaResult);
      } else {
        const cumpleBuild = await cumplelunaBuild({
          birthData: state.birthData,
          chart: natal.chart,
          natalSamples: samples,
          ephemeris,
          observedAt,
          localDate: args.localDate,
          timezone: args.timezone,
        });
        const calculated = wrapBuild({
          analysisId: "ORB-LUN-002",
          inputHash: cumpleHash,
          observedAt,
          validUntil:
            cumpleBuild.data?.nextExactAtRange?.earliest ??
            cumpleBuild.data?.nextExactAt ??
            (cumpleBuild.status === "needs_birth_time" ? null : observedAt + HOUR_MS),
          build: cumpleBuild,
          providerVersion,
        }) as CumplelunaResult;
        const rootRefreshFailed = calculated.missingInputs.some((missingInput) =>
          ["cumpleluna_roots", "cumpleluna_root_ranges"].includes(missingInput),
        );
        const cachedFallback = rootRefreshFailed
          ? (staleProviderFallback(
              state.snapshots,
              "ORB-LUN-002",
              cumpleHash,
              observedAt,
            ) as CumplelunaResult | null)
          : null;
        // Un rango que cruza el ciclo es una omisión deliberada, no un fallo
        // del proveedor. En ese caso nunca se rescata una fecha cacheada que
        // ya pertenece al ciclo anterior.
        cumpleluna = cachedFallback ?? calculated;
      }
    } else {
      const rankingHash = resultHash(natal.baseHash, "ORB-TRN-002", dailyScope);
      const arcHash = resultHash(natal.baseHash, "ORB-TRN-001", dailyScope);
      const moonHash = resultHash(natal.baseHash, "ORB-LUN-003", dailyScope);
      const cumpleHash = resultHash(natal.baseHash, "ORB-LUN-002");
      transitRanking = (
        staleProviderFallback(state.snapshots, "ORB-TRN-002", rankingHash, observedAt) ??
        unavailableResult("ORB-TRN-002", rankingHash, observedAt, ["current_ephemeris"], {
          status: "error",
          validUntil: observedAt + HOUR_MS,
        })
      ) as TransitRankingResult;
      transitArc = (
        staleProviderFallback(state.snapshots, "ORB-TRN-001", arcHash, observedAt) ??
        unavailableResult("ORB-TRN-001", arcHash, observedAt, ["current_ephemeris"], {
          status: "error",
          validUntil: observedAt + HOUR_MS,
        })
      ) as TransitArcResult;
      moonOnChart = (
        staleProviderFallback(state.snapshots, "ORB-LUN-003", moonHash, observedAt) ??
        unavailableResult("ORB-LUN-003", moonHash, observedAt, ["current_ephemeris"], {
          status: "error",
          validUntil: observedAt + HOUR_MS,
        })
      ) as MoonOnChartResult;
      cumpleluna = (
        latestMatching(state.snapshots, "ORB-LUN-002", cumpleHash, observedAt) ??
        unavailableResult("ORB-LUN-002", cumpleHash, observedAt, ["current_ephemeris"], {
          status: "error",
          validUntil: observedAt + HOUR_MS,
        })
      ) as CumplelunaResult;
    }

    // Un solo punto de coherencia para las dos ramas, antes de que el arco entre
    // en el mandala y en lo que se persiste. Con efeméride el arco se recalcula
    // con el ranking de esta corrida, pero cualquiera de los dos sobres puede
    // venir de un `stale` anterior; sin efeméride los dos se rescatan por
    // separado. Si el par no corresponde, el arco incoherente se descarta —y la
    // fila guardada queda reemplazada por el sobre honesto, así que el defecto
    // no sobrevive a este refresh—.
    transitArc = coherentTransitArc({
      ranking: transitRanking,
      arc: transitArc,
      observedAt,
      // Sin cielo no se pudo calcular nada: ese es el hecho, y lleva su fecha de
      // reintento. Con cielo, el hecho es que no hay arco correspondiente.
      status: ephemeris ? "unavailable" : "error",
      validUntil: observedAt + HOUR_MS,
      missingInputs: ephemeris ? [] : ["current_ephemeris"],
    });

    const mandalaData = buildTemporalMandalaData({
      observedAt,
      progressedLunation: progressedLunation.data,
      annualProfection: annualProfection.data,
      cumpleluna: cumpleluna.data,
      transitArc: transitArc.data,
      sourceQuality: {
        progressedLunation: {
          status: progressedLunation.status,
          precision: progressedLunation.precision,
        },
        annualProfection: {
          status: annualProfection.status,
          precision: annualProfection.precision,
        },
        cumpleluna: {
          status: cumpleluna.status,
          precision: cumpleluna.precision,
        },
        transitArc: {
          status: transitArc.status,
          precision: transitArc.precision,
        },
      },
    });
    const mandalaMissing = mandalaData.rings.filter((ring) => !ring.available).map((ring) => ring.key);
    const mandalaSources: AnalysisResult[] = [
      progressedLunation,
      annualProfection,
      cumpleluna,
      transitArc,
    ];
    const usedSources = mandalaSources.filter((source) => source.data !== null);
    const anyUsedSourceStale = usedSources.some((source) => source.status === "stale");
    const anySourceEstimated = usedSources.some((source) => source.precision === "estimated");
    const anySourceRange = usedSources.some((source) => source.precision === "range");
    const anySourcePartial = mandalaSources.some(
      (source) =>
        source.status === "partial" ||
        source.precision === "estimated" ||
        source.precision === "range",
    );
    const mandalaMissingInputs = Array.from(
      new Set([
        ...mandalaMissing,
        ...mandalaSources.flatMap((source) => source.missingInputs),
      ]),
    );
    const mandalaLimitations = Array.from(
      new Set([
        ...mandalaSources.flatMap((source) => source.limitations),
        ...(mandalaMissing.length > 0
          ? ["Los anillos sin datos permanecen visibles como no disponibles."]
          : []),
      ]),
    );
    const temporalMandalaWrapped = wrapBuild({
      analysisId: "ORB-CYC-007",
      inputHash: temporalMandalaInputHash(natal.baseHash, dailyScope, mandalaSources),
      observedAt,
      validUntil: temporalMandalaValidUntil(observedAt, mandalaSources),
      build: {
        data: mandalaData,
        status:
          anyUsedSourceStale || anySourcePartial || mandalaMissing.length > 0
            ? "partial"
            : "ready",
        precision: anySourceRange
          ? "range"
          : anySourceEstimated
            ? "estimated"
            : usedSources.length > 0
              ? "exact"
              : "not_applicable",
        missingInputs: mandalaMissingInputs,
        limitations: mandalaLimitations,
      },
      providerVersion,
      forceStatus: anyUsedSourceStale ? "stale" : undefined,
    }) as TemporalMandalaResult;
    const temporalMandala = {
      ...temporalMandalaWrapped,
      missingInputs: Array.from(new Set(temporalMandalaWrapped.missingInputs)),
      limitations: Array.from(new Set(temporalMandalaWrapped.limitations)),
    } as TemporalMandalaResult;

    const results: AnalysisResult[] = [
      natal.bundle.lunarType,
      natal.bundle.elementMap,
      natal.bundle.relationshipPattern,
      progressedLunation,
      annualProfection,
      transitRanking,
      transitArc,
      moonOnChart,
      cumpleluna,
      temporalMandala,
    ];
    await ctx.runMutation(internalApi.layers.persistRefresh, {
      userId: state.userId,
      birthDataId: state.birthDataId,
      natalChartId: state.natalChartId,
      expectedInputFingerprint,
      localDate: args.localDate,
      timezone: args.timezone,
      results,
      sky: skyToPersist,
      natalEphemeris: natalEphemerisToPersist,
    });
    return {
      natal: natal.bundle,
      today: { transitRanking, transitArc, moonOnChart, cumpleluna },
      moment: { progressedLunation, annualProfection, temporalMandala },
    };
  },
});
