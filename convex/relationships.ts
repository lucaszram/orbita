import {
  actionGeneric as action,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  mutationGeneric as mutation,
  queryGeneric as query,
} from "convex/server";
import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getAnalysisDefinition, getSourceRefs } from "./content/astrologySources";
import {
  comparisonLevelValidator,
  relationshipComparisonResultValidator,
  relationshipProfileValidator,
  relationshipTypeValidator,
  type EphemerisPosition,
} from "./lib/layerContract";
import {
  runAstrologyApiNatalChart,
  runAstrologyApiPlanetsTropical,
} from "./lib/astrologyApi";
import {
  resolveZonedCivilTime,
  type CivilTimeResolution,
} from "./lib/civilTime";
import { findCurrentBirthData, findCurrentNatalChart } from "./lib/birthDataConsistency";
import {
  buildRelationshipComparison,
  relationshipDriverDetails,
  RELATIONSHIP_COMPARISON_VERSION,
  type RelationshipBirthTimePrecision,
  type RelationshipChartInput,
  type RelationshipComparison,
  type RelationshipComparisonLevel,
  type RelationshipDimension,
  type RelationshipPointPrecision,
  type RelationshipType,
  type RelationshipZodiacSign,
} from "./lib/relationshipLayers";
import { extractNormalizedChartFromPayload, type NormalizedAstroChart } from "./lib/orbita";
import { stableInputHash } from "./lib/stableHash";
import {
  findCurrentUser,
  findUserByTokenIdentifier,
  omitUndefined,
  requireUser,
} from "./lib/users";

const birthTimePrecisionValidator = v.union(
  v.literal("known"),
  v.literal("approximate"),
  v.literal("unknown"),
);

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());

const savePersonArgs = {
  profileId: v.optional(v.id("relationshipProfiles")),
  idempotencyKey: v.string(),
  name: v.string(),
  relationshipType: v.optional(relationshipTypeValidator),
  birthDate: v.optional(nullableString),
  birthTime: v.optional(nullableString),
  birthTimePrecision: birthTimePrecisionValidator,
  birthPlaceLabel: v.optional(nullableString),
  placeId: v.optional(nullableString),
  placeProvider: v.optional(nullableString),
  latitude: v.optional(nullableNumber),
  longitude: v.optional(nullableNumber),
  timezone: v.optional(nullableString),
  zodiacSign: v.optional(nullableString),
};

const relationshipPlacementWireValidator = v.object({
  key: v.string(),
  label: v.string(),
  sign: nullableString,
  longitude: nullableNumber,
  longitudeSamples: v.array(v.number()),
  timeStable: v.boolean(),
  house: nullableNumber,
});

const relationshipHouseWireValidator = v.object({
  house: v.number(),
  degree: nullableNumber,
  sign: nullableString,
});

const relationshipChartWireValidator = v.object({
  name: v.string(),
  zodiacSign: nullableString,
  birthTimePrecision: birthTimePrecisionValidator,
  placements: v.array(relationshipPlacementWireValidator),
  houses: v.array(relationshipHouseWireValidator),
});

const relationshipCalculationProfileValidator = v.object({
  name: v.string(),
  birthDate: nullableString,
  birthTime: nullableString,
  birthTimePrecision: birthTimePrecisionValidator,
  birthPlaceLabel: nullableString,
  latitude: nullableNumber,
  longitude: nullableNumber,
  timezone: nullableString,
  zodiacSign: nullableString,
});

const comparisonRefreshStateValidator = v.object({
  userId: v.id("users"),
  profile: relationshipProfileValidator,
  personA: v.union(relationshipChartWireValidator, v.null()),
  ownLegacyStructure: v.union(relationshipChartWireValidator, v.null()),
  ownBirthProfile: v.union(relationshipCalculationProfileValidator, v.null()),
  requestedLevel: comparisonLevelValidator,
  inputHash: v.string(),
  cacheKey: v.string(),
  cached: v.union(relationshipComparisonResultValidator, v.null()),
});

type ComparisonLevelName = Infer<typeof comparisonLevelValidator>;
type ComparisonResult = Infer<typeof relationshipComparisonResultValidator>;
type PublicRelationshipProfile = Infer<typeof relationshipProfileValidator>;
type RelationshipChartWire = Infer<typeof relationshipChartWireValidator>;
type RelationshipCalculationProfile = Infer<typeof relationshipCalculationProfileValidator>;

const SIGN_ALIASES: Record<string, RelationshipZodiacSign> = {
  aries: "aries",
  tauro: "taurus",
  taurus: "taurus",
  geminis: "gemini",
  gemini: "gemini",
  cancer: "cancer",
  leo: "leo",
  virgo: "virgo",
  libra: "libra",
  escorpio: "scorpio",
  scorpio: "scorpio",
  sagitario: "sagittarius",
  sagittarius: "sagittarius",
  capricornio: "capricorn",
  capricorn: "capricorn",
  acuario: "aquarius",
  aquarius: "aquarius",
  piscis: "pisces",
  pisces: "pisces",
};

const SIGN_ORDER: RelationshipZodiacSign[] = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
];

const LEVEL_TO_NUMBER: Record<ComparisonLevelName, RelationshipComparisonLevel> = {
  sign_to_sign: 1,
  date_to_date: 2,
  chart_to_chart: 3,
};

const NUMBER_TO_LEVEL: Record<RelationshipComparisonLevel, ComparisonLevelName> = {
  1: "sign_to_sign",
  2: "date_to_date",
  3: "chart_to_chart",
};

const COMPARISON_PROVIDER_TIMEOUT_MS = 20_000;
const RELATIONSHIP_CANONICAL_POSITIONS_VERSION = "relationship-planets-tropical-v2";
const RELATIONSHIP_DATE_RANGE_VERSION = "relationship-full-date-range-v2";
const RELATIONSHIP_HOUSE_GEOMETRY_VERSION = "relationship-house-geometry-v1";
const RELATIONSHIP_TROPICAL_PROVIDER_VERSION = "astrologyapi-planets-tropical-v1";
const RELATIONSHIP_DATE_SAMPLE_STEP_MS = 4 * 60 * 60 * 1000;
const RELATIONSHIP_IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const RELATIONSHIP_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/**
 * Topes deliberadamente conservadores para acotar lo que puede ocurrir entre
 * dos muestras. Son mayores que el movimiento diario esperable de cada cuerpo;
 * si aun con ese margen un dato cruza un límite, se muestra como rango o se
 * retira. Nunca se certifica estabilidad mirando solamente tres instantes.
 */
const MAX_DAILY_MOVEMENT_DEGREES: Record<string, number> = {
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

function plainKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function trimmedOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function finiteOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Normaliza la clave opaca que el cliente conserva durante un único intento
 * de alta. Dos altas intencionales deben usar claves distintas, aunque sus
 * datos sean iguales.
 */
export function normalizeRelationshipIdempotencyKey(value: string) {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > RELATIONSHIP_IDEMPOTENCY_KEY_MAX_LENGTH ||
    !RELATIONSHIP_IDEMPOTENCY_KEY_PATTERN.test(normalized)
  ) {
    throw new Error("RELATIONSHIP_REQUEST_KEY_INVALID");
  }
  return normalized;
}

function canonicalSign(value: string | null | undefined): RelationshipZodiacSign | null {
  const normalized = trimmedOrNull(value);
  return normalized ? (SIGN_ALIASES[plainKey(normalized)] ?? null) : null;
}

function validIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validClockTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
}

function validIanaTimezone(value: string) {
  if (!value || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function assertCoordinatePair(latitude: number | null, longitude: number | null) {
  if ((latitude === null) !== (longitude === null)) {
    throw new Error("RELATIONSHIP_COORDINATES_INCOMPLETE");
  }
  if (latitude !== null && (latitude < -90 || latitude > 90)) {
    throw new Error("RELATIONSHIP_LATITUDE_INVALID");
  }
  if (longitude !== null && (longitude < -180 || longitude > 180)) {
    throw new Error("RELATIONSHIP_LONGITUDE_INVALID");
  }
}

export type NormalizedRelationshipPersonInput = {
  name: string;
  relationshipType: RelationshipType | null;
  birthDate: string | null;
  birthTime: string | null;
  birthTimePrecision: RelationshipBirthTimePrecision;
  birthPlaceLabel: string | null;
  placeId: string | null;
  placeProvider: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  zodiacSign: RelationshipZodiacSign | null;
};

/** Validación semántica compartida por la mutation y las pruebas de contrato. */
export function normalizeRelationshipPersonInput(args: {
  name: string;
  relationshipType?: RelationshipType | null;
  birthDate?: string | null;
  birthTime?: string | null;
  birthTimePrecision: RelationshipBirthTimePrecision;
  birthPlaceLabel?: string | null;
  placeId?: string | null;
  placeProvider?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  zodiacSign?: string | null;
}): NormalizedRelationshipPersonInput {
  const name = args.name.trim();
  const birthDate = trimmedOrNull(args.birthDate);
  const birthTime = trimmedOrNull(args.birthTime);
  const birthPlaceLabel = trimmedOrNull(args.birthPlaceLabel);
  const placeId = trimmedOrNull(args.placeId);
  const placeProvider = trimmedOrNull(args.placeProvider);
  const timezone = trimmedOrNull(args.timezone);
  const latitude = finiteOrNull(args.latitude);
  const longitude = finiteOrNull(args.longitude);
  const zodiacSign = canonicalSign(args.zodiacSign);

  if (!name) throw new Error("RELATIONSHIP_NAME_REQUIRED");
  if (birthDate && !validIsoDate(birthDate)) throw new Error("RELATIONSHIP_BIRTH_DATE_INVALID");
  if (birthTime && !validClockTime(birthTime)) throw new Error("RELATIONSHIP_BIRTH_TIME_INVALID");
  if (args.birthTimePrecision === "known" && !birthTime) {
    throw new Error("RELATIONSHIP_EXACT_TIME_REQUIRED");
  }
  if (args.birthTimePrecision === "approximate" && !birthTime) {
    throw new Error("RELATIONSHIP_APPROXIMATE_TIME_REQUIRED");
  }
  if (!birthDate && (birthTime || args.birthTimePrecision !== "unknown")) {
    throw new Error("RELATIONSHIP_BIRTH_DATE_REQUIRED_FOR_TIME");
  }
  assertCoordinatePair(latitude, longitude);
  if (timezone && !validIanaTimezone(timezone)) throw new Error("RELATIONSHIP_TIMEZONE_INVALID");
  if (!birthDate && !zodiacSign) throw new Error("RELATIONSHIP_SIGN_OR_DATE_REQUIRED");
  if (trimmedOrNull(args.zodiacSign) && !zodiacSign) throw new Error("RELATIONSHIP_ZODIAC_SIGN_INVALID");

  return {
    name,
    relationshipType: args.relationshipType ?? null,
    birthDate,
    birthTime,
    birthTimePrecision: args.birthTimePrecision,
    birthPlaceLabel,
    placeId,
    placeProvider,
    latitude,
    longitude,
    timezone,
    zodiacSign,
  };
}

export function relationshipAvailableLevel(input: {
  birthDate: string | null;
  birthTime: string | null;
  birthTimePrecision: RelationshipBirthTimePrecision;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
}): ComparisonLevelName {
  if (
    input.birthDate &&
    input.birthTime &&
    input.birthTimePrecision === "known" &&
    input.latitude !== null &&
    input.longitude !== null &&
    input.timezone
  ) {
    return "chart_to_chart";
  }
  return input.birthDate ? "date_to_date" : "sign_to_sign";
}

function precisionFromProfile(profile: Doc<"relationshipProfiles">): RelationshipBirthTimePrecision {
  return profile.birthTimePrecision ?? (profile.birthTime ? "known" : "unknown");
}

function toPublicProfile(profile: Doc<"relationshipProfiles">): PublicRelationshipProfile {
  const rawBirthDate = trimmedOrNull(profile.birthDate);
  const rawBirthTime = trimmedOrNull(profile.birthTime);
  const birthDate = rawBirthDate && validIsoDate(rawBirthDate) ? rawBirthDate : null;
  const birthTime = rawBirthTime && validClockTime(rawBirthTime) ? rawBirthTime : null;
  const rawPrecision = precisionFromProfile(profile);
  const birthTimePrecision =
    birthDate && birthTime && rawPrecision !== "unknown" ? rawPrecision : "unknown";
  const rawLatitude = finiteOrNull(profile.latitude);
  const rawLongitude = finiteOrNull(profile.longitude);
  const coordinatePairValid =
    rawLatitude !== null &&
    rawLongitude !== null &&
    rawLatitude >= -90 &&
    rawLatitude <= 90 &&
    rawLongitude >= -180 &&
    rawLongitude <= 180;
  const latitude = coordinatePairValid ? rawLatitude : null;
  const longitude = coordinatePairValid ? rawLongitude : null;
  const rawTimezone = trimmedOrNull(profile.timezone);
  const timezone = rawTimezone && validIanaTimezone(rawTimezone) ? rawTimezone : null;
  return {
    profileId: profile._id,
    name: profile.name,
    relationshipType: profile.relationshipType ?? null,
    birthDate,
    birthTime,
    birthTimePrecision,
    birthPlaceLabel: trimmedOrNull(profile.birthPlaceLabel),
    latitude,
    longitude,
    timezone,
    zodiacSign: canonicalSign(profile.zodiacSign),
    availableLevel: relationshipAvailableLevel({
      birthDate,
      birthTime,
      birthTimePrecision,
      latitude,
      longitude,
      timezone,
    }),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function relationshipProfileMatchesNormalizedInput(
  profile: Doc<"relationshipProfiles">,
  normalized: NormalizedRelationshipPersonInput,
) {
  return (
    profile.name === normalized.name &&
    (profile.relationshipType ?? null) === normalized.relationshipType &&
    trimmedOrNull(profile.birthDate) === normalized.birthDate &&
    trimmedOrNull(profile.birthTime) === normalized.birthTime &&
    precisionFromProfile(profile) === normalized.birthTimePrecision &&
    trimmedOrNull(profile.birthPlaceLabel) === normalized.birthPlaceLabel &&
    trimmedOrNull(profile.placeId) === normalized.placeId &&
    trimmedOrNull(profile.placeProvider) === normalized.placeProvider &&
    finiteOrNull(profile.latitude) === normalized.latitude &&
    finiteOrNull(profile.longitude) === normalized.longitude &&
    trimmedOrNull(profile.timezone) === normalized.timezone &&
    canonicalSign(profile.zodiacSign) === normalized.zodiacSign
  );
}

function ownBirthProfile(args: {
  birthData: Doc<"birthData"> | null;
  zodiacSign: RelationshipZodiacSign | null;
}): RelationshipCalculationProfile | null {
  if (!args.birthData || !validIsoDate(args.birthData.birthDate)) return null;
  const birthTime = trimmedOrNull(args.birthData.birthTime);
  const rawLatitude = finiteOrNull(args.birthData.latitude);
  const rawLongitude = finiteOrNull(args.birthData.longitude);
  const coordinatePairValid =
    rawLatitude !== null &&
    rawLongitude !== null &&
    rawLatitude >= -90 &&
    rawLatitude <= 90 &&
    rawLongitude >= -180 &&
    rawLongitude <= 180;
  const timezone = validIanaTimezone(args.birthData.timezone) ? args.birthData.timezone : null;
  return {
    name: "Vos",
    birthDate: args.birthData.birthDate,
    birthTime: birthTime && validClockTime(birthTime) ? birthTime : null,
    birthTimePrecision:
      birthTime && args.birthData.birthTimePrecision !== "unknown"
        ? args.birthData.birthTimePrecision
        : "unknown",
    birthPlaceLabel: trimmedOrNull(args.birthData.birthPlaceLabel),
    latitude: coordinatePairValid ? rawLatitude : null,
    longitude: coordinatePairValid ? rawLongitude : null,
    timezone,
    zodiacSign: args.zodiacSign,
  };
}

function normalizedDegree(value: number) {
  return ((value % 360) + 360) % 360;
}

function signForDegree(value: number) {
  return SIGN_ORDER[Math.floor(normalizedDegree(value) / 30) % SIGN_ORDER.length]!;
}

/**
 * El payload natal anterior solo puede aportar el signo solar general antes de
 * actualizar. No se copian sus posiciones planetarias a una comparación
 * personalizada.
 */
export function legacyChartToSignOnlyWire(args: {
  chart: NormalizedAstroChart | null;
  name: string;
  birthTimePrecision: RelationshipBirthTimePrecision;
}): RelationshipChartWire | null {
  const sun = args.chart?.placements.find((placement) => plainKey(placement.key) === "sun");
  const zodiacSign = canonicalSign(sun?.sign);
  if (!args.chart && !zodiacSign) return null;
  return {
    name: args.name,
    zodiacSign,
    birthTimePrecision: args.birthTimePrecision,
    placements: [],
    houses: [],
  };
}

/** Casas exactas separadas de las posiciones. Así la geometría útil puede
 * conservarse sin permitir que un planeta del cálculo anterior se filtre. */
export function legacyChartToHouseStructure(args: {
  chart: NormalizedAstroChart | null;
  name: string;
  zodiacSign: RelationshipZodiacSign | null;
  birthTimePrecision: RelationshipBirthTimePrecision;
}): RelationshipChartWire | null {
  if (!args.chart || args.birthTimePrecision !== "known") return null;
  const houses = args.chart.houses
    .map((house) => ({
      house: house.house,
      degree: finiteOrNull(house.degree),
      sign: canonicalSign(house.sign),
    }))
    .filter(
      (house) =>
        Number.isInteger(house.house) &&
        house.house >= 1 &&
        house.house <= 12 &&
        house.degree !== null,
    )
    .sort((left, right) => left.house - right.house);
  const uniqueHouses = houses.filter(
    (house, index, all) => all.findIndex((candidate) => candidate.house === house.house) === index,
  );
  if (uniqueHouses.length !== 12) return null;
  return {
    name: args.name,
    zodiacSign: args.zodiacSign,
    birthTimePrecision: "known",
    placements: [],
    houses: uniqueHouses,
  };
}

/**
 * Fusiona exclusivamente Sol–Plutón del cálculo tropical canónico con casas
 * verificadas por separado. Si faltan posiciones canónicas devuelve `null`:
 * nunca rescata planetas del payload natal anterior.
 */
export function mergeCanonicalRelationshipChart(args: {
  canonicalPositions: EphemerisPosition[] | null;
  legacyStructure: RelationshipChartWire | null;
  name: string;
  birthTimePrecision: RelationshipBirthTimePrecision;
}): RelationshipChartWire | null {
  if (!args.canonicalPositions || args.canonicalPositions.length !== 10) return null;
  const byKey = new Map(args.canonicalPositions.map((position) => [plainKey(position.key), position]));
  if (Object.keys(MAX_DAILY_MOVEMENT_DEGREES).some((key) => !byKey.has(key))) return null;
  const positions = Object.keys(MAX_DAILY_MOVEMENT_DEGREES).map((key) => byKey.get(key)!);
  const sun = byKey.get("sun")!;
  const hasExactHouses =
    args.birthTimePrecision === "known" && args.legacyStructure?.houses.length === 12;
  return {
    name: args.name,
    zodiacSign: canonicalSign(sun.sign) ?? signForDegree(sun.fullDegree),
    birthTimePrecision: args.birthTimePrecision,
    placements: positions.map((position) => ({
      key: position.key,
      label: position.label,
      sign: canonicalSign(position.sign) ?? signForDegree(position.fullDegree),
      longitude: normalizedDegree(position.fullDegree),
      longitudeSamples: [],
      timeStable: true,
      house: null,
    })),
    houses: hasExactHouses ? args.legacyStructure!.houses : [],
  };
}

function publicProfileToSignChart(profile: PublicRelationshipProfile): RelationshipChartWire {
  return {
    name: profile.name,
    zodiacSign: canonicalSign(profile.zodiacSign),
    birthTimePrecision: profile.birthTimePrecision,
    placements: [],
    houses: [],
  };
}

function asEngineChart(chart: RelationshipChartWire): RelationshipChartInput {
  return {
    name: chart.name,
    zodiacSign: chart.zodiacSign,
    birthTimePrecision: chart.birthTimePrecision,
    placements: chart.placements,
    houses: chart.houses,
  };
}

function requestedLevelFor(profile: PublicRelationshipProfile) {
  return profile.availableLevel;
}

function hasExactBirthInputs(profile: RelationshipCalculationProfile | null) {
  return Boolean(
    profile?.birthDate &&
      profile.birthTime &&
      profile.birthTimePrecision === "known" &&
      profile.latitude !== null &&
      profile.longitude !== null &&
      profile.timezone,
  );
}

export function buildRelationshipComparisonInputHash(args: {
  userId: string;
  profile: PublicRelationshipProfile;
  ownBirthDataId?: string | null;
  ownBirthDataUpdatedAt?: number | null;
  natalChartId: string | null;
  natalChartUpdatedAt: number | null;
}) {
  return stableInputHash({
    methodVersion: RELATIONSHIP_COMPARISON_VERSION,
    canonicalPositionsVersion: RELATIONSHIP_CANONICAL_POSITIONS_VERSION,
    canonicalProviderVersion: RELATIONSHIP_TROPICAL_PROVIDER_VERSION,
    dateRangeMethod: {
      version: RELATIONSHIP_DATE_RANGE_VERSION,
      sampleStepMs: RELATIONSHIP_DATE_SAMPLE_STEP_MS,
      maxDailyMovementDegrees: MAX_DAILY_MOVEMENT_DEGREES,
      unknownTimezonePaddingHours: 18,
    },
    houseGeometryVersion: RELATIONSHIP_HOUSE_GEOMETRY_VERSION,
    sourceMethodVersions: [
      getAnalysisDefinition("ORB-REL-002").methodVersion,
      getAnalysisDefinition("ORB-REL-003").methodVersion,
    ],
    userId: args.userId,
    profileId: String(args.profile.profileId),
    profile: {
      name: args.profile.name,
      relationshipType: args.profile.relationshipType ?? null,
      birthDate: args.profile.birthDate,
      birthTime: args.profile.birthTime,
      birthTimePrecision: args.profile.birthTimePrecision,
      birthPlaceLabel: args.profile.birthPlaceLabel,
      latitude: args.profile.latitude,
      longitude: args.profile.longitude,
      timezone: args.profile.timezone,
      zodiacSign: args.profile.zodiacSign,
      updatedAt: args.profile.updatedAt,
    },
    requestedLevel: requestedLevelFor(args.profile),
    ownBirthDataId: args.ownBirthDataId ?? null,
    ownBirthDataUpdatedAt: args.ownBirthDataUpdatedAt ?? null,
    natalChartId: args.natalChartId,
    natalChartUpdatedAt: args.natalChartUpdatedAt,
  });
}

function comparisonCacheKey(userId: string, profileId: Id<"relationshipProfiles">, inputHash: string) {
  return `relationship:v492:${userId}:${profileId}:${inputHash}`;
}

function dimensionPrecision(dimension: RelationshipDimension): RelationshipPointPrecision | "not_applicable" {
  if (dimension.status === "insufficient_data") return "not_applicable";
  if (dimension.drivers.some((driver) => driver.precision === "range")) return "range";
  if (dimension.drivers.some((driver) => driver.precision === "estimated")) return "estimated";
  return dimension.drivers.length > 0 ? "exact" : "not_applicable";
}

function dimensionValue(dimension: RelationshipDimension) {
  const total = dimension.supportWeight + dimension.tensionWeight + dimension.neutralWeight;
  if (total <= 0) return 0.5;
  return (
    Math.round(
      Math.max(
        0,
        Math.min(1, 0.5 + (dimension.supportWeight - dimension.tensionWeight) / (2 * total)),
      ) * 1000,
    ) / 1000
  );
}

function comparisonData(
  comparison: RelationshipComparison,
  relationshipType: RelationshipType | null | undefined,
) {
  const resolvedLevel = NUMBER_TO_LEVEL[comparison.level];
  return {
    kind: "relationship_comparison" as const,
    relationshipType: relationshipType ?? null,
    requestedLevel: NUMBER_TO_LEVEL[comparison.requestedLevel],
    resolvedLevel,
    dimensions: comparison.dimensions.map((dimension) => ({
      key: dimension.id,
      label: dimension.label,
      value: dimensionValue(dimension),
      summary: dimension.summary,
      // `drivers` NO cambia: misma fuente, mismo orden, mismas oraciones. Es lo
      // que leen los clientes ya instalados y se publica exactamente igual.
      drivers: dimension.drivers.map((driver) => driver.text),
      // La misma evidencia, estructurada. Sale de la MISMA derivación
      // determinística —no hay un cálculo aparte— y sólo agrega campos.
      driverDetails: relationshipDriverDetails(dimension.drivers),
      precision: dimensionPrecision(dimension),
    })),
    includedTechniques:
      comparison.level === 1
        ? ["signos solares, elementos y modalidades"]
        : comparison.level === 2
          ? ["signos solares", "aspectos planetarios estables por fecha"]
          : ["aspectos planetarios", "Ascendentes", "casas y superposiciones"],
    omittedTechniques:
      comparison.level === 1
        ? ["posiciones planetarias personales", "casas", "Ascendentes"]
        : comparison.level === 2
          ? ["casas", "Ascendentes", "superposiciones"]
          : [],
    summary: `${comparison.generalStyle.title}. ${comparison.generalStyle.body}`,
    disclaimer: comparison.disclaimer,
    generalOnly: comparison.level === 1,
  };
}

function missingInputsFor(args: {
  requestedLevel: RelationshipComparisonLevel;
  resolvedLevel: RelationshipComparisonLevel;
  providerUnavailable: boolean;
  exactCivilTimeUnresolved: boolean;
}) {
  const missing: string[] = [];
  if (args.providerUnavailable && args.resolvedLevel < args.requestedLevel) {
    missing.push("comparison_ephemeris");
  }
  if (args.requestedLevel >= 2 && args.resolvedLevel === 1) {
    if (!args.providerUnavailable) missing.push("birth_date");
  }
  if (args.requestedLevel === 3 && args.resolvedLevel < 3 && !args.providerUnavailable) {
    missing.push(
      args.exactCivilTimeUnresolved
        ? "unambiguous_birth_instant"
        : "exact_birth_time_and_place",
    );
  }
  return Array.from(new Set(missing));
}

function resultPrecision(comparison: RelationshipComparison) {
  if (comparison.level === 1) return "not_applicable" as const;
  const precisions = comparison.dimensions.flatMap((dimension) =>
    dimension.drivers.map((driver) => driver.precision),
  );
  if (precisions.includes("range")) return "range" as const;
  if (precisions.includes("estimated")) return "estimated" as const;
  return "exact" as const;
}

function chartCarriesRange(chart: RelationshipChartWire) {
  return chart.placements.some((placement) => placement.longitudeSamples.length > 1);
}

/** Adapta el motor puro al sobre público sin crear un puntaje global. */
export function buildRelationshipComparisonResult(args: {
  inputHash: string;
  requestedLevel: ComparisonLevelName;
  personA: RelationshipChartWire;
  personB: RelationshipChartWire;
  relationshipType?: RelationshipType | null;
  observedAt: number;
  providerVersion?: string;
  providerUnavailable?: boolean;
  exactCivilTimeUnresolved?: boolean;
  extraLimitations?: string[];
  extraMissingInputs?: string[];
}): ComparisonResult {
  const comparison = buildRelationshipComparison({
    requestedLevel: LEVEL_TO_NUMBER[args.requestedLevel],
    personA: asEngineChart(args.personA),
    personB: asEngineChart(args.personB),
    relationshipType: args.relationshipType,
  });
  const analysisId = comparison.level === 1 ? "ORB-REL-002" : "ORB-REL-003";
  const definition = getAnalysisDefinition(analysisId);
  const limitations = Array.from(
    new Set([
      ...definition.limitations,
      ...comparison.limitations,
      ...(args.extraLimitations ?? []),
    ]),
  );
  const missingInputs = Array.from(
    new Set([
      ...missingInputsFor({
        requestedLevel: comparison.requestedLevel,
        resolvedLevel: comparison.level,
        providerUnavailable: args.providerUnavailable === true,
        exactCivilTimeUnresolved: args.exactCivilTimeUnresolved === true,
      }),
      ...(args.extraMissingInputs ?? []),
    ]),
  );
  const partial =
    comparison.level < comparison.requestedLevel ||
    args.providerUnavailable === true ||
    Boolean(args.extraLimitations?.length);
  return omitUndefined({
    analysisId,
    methodVersion: definition.methodVersion,
    providerVersion: args.providerVersion,
    inputHash: args.inputHash,
    status: partial ? ("partial" as const) : ("ready" as const),
    precision:
      comparison.level >= 2 &&
      (chartCarriesRange(args.personA) || chartCarriesRange(args.personB))
        ? ("range" as const)
        : resultPrecision(comparison),
    observedAt: args.observedAt,
    validUntil: null,
    data: comparisonData(comparison, args.relationshipType),
    missingInputs,
    limitations,
    elaboration: definition.elaboration,
    sourceRefs: getSourceRefs(analysisId),
  }) as ComparisonResult;
}

function unavailableComparisonResult(args: {
  inputHash: string;
  requestedLevel: ComparisonLevelName;
  observedAt: number;
  missingInputs: string[];
  limitation: string;
}): ComparisonResult {
  const analysisId = args.requestedLevel === "sign_to_sign" ? "ORB-REL-002" : "ORB-REL-003";
  const definition = getAnalysisDefinition(analysisId);
  return {
    analysisId,
    methodVersion: definition.methodVersion,
    inputHash: args.inputHash,
    status: "unavailable",
    precision: "not_applicable",
    observedAt: args.observedAt,
    validUntil: null,
    data: null,
    missingInputs: args.missingInputs,
    limitations: Array.from(new Set([...definition.limitations, args.limitation])),
    elaboration: definition.elaboration,
    sourceRefs: getSourceRefs(analysisId),
  };
}

async function getOwnedProfile(ctx: { db: any }, userId: Id<"users">, profileId: Id<"relationshipProfiles">) {
  const profile = await ctx.db.get(profileId);
  return profile && profile.userId === userId ? (profile as Doc<"relationshipProfiles">) : null;
}

async function buildComparisonState(
  ctx: { db: any },
  user: Doc<"users">,
  profile: Doc<"relationshipProfiles">,
) {
  const publicProfile = toPublicProfile(profile);
  const [birthData, natalChart] = await Promise.all([
    findCurrentBirthData(ctx, user._id),
    findCurrentNatalChart(ctx, user._id),
  ]);
  const normalizedChart = natalChart ? extractNormalizedChartFromPayload(natalChart.payload) : null;
  const ownPrecision: RelationshipBirthTimePrecision =
    birthData?.birthTimePrecision ?? (birthData?.birthTime ? "known" : "unknown");
  const personA = legacyChartToSignOnlyWire({
    chart: normalizedChart,
    name: "Vos",
    birthTimePrecision: ownPrecision,
  });
  const ownProfile = ownBirthProfile({
    birthData,
    zodiacSign: canonicalSign(personA?.zodiacSign),
  });
  const ownLegacyStructure = legacyChartToHouseStructure({
    chart: normalizedChart,
    name: "Vos",
    zodiacSign: canonicalSign(personA?.zodiacSign),
    birthTimePrecision: ownPrecision,
  });
  const inputHash = buildRelationshipComparisonInputHash({
    userId: String(user._id),
    profile: publicProfile,
    ownBirthDataId: birthData ? String(birthData._id) : null,
    ownBirthDataUpdatedAt: birthData?.updatedAt ?? birthData?.createdAt ?? null,
    natalChartId: natalChart ? String(natalChart._id) : null,
    natalChartUpdatedAt: natalChart?.updatedAt ?? natalChart?.createdAt ?? null,
  });
  const cacheKey = comparisonCacheKey(String(user._id), profile._id, inputHash);
  const cachedDocument = await ctx.db
    .query("relationshipComparisonCachesV492")
    .withIndex("by_cache_key", (q: any) => q.eq("cacheKey", cacheKey))
    .first();
  const cached =
    cachedDocument && cachedDocument.userId === user._id && cachedDocument.profileId === profile._id
      ? cacheDocumentToResult(cachedDocument)
      : null;
  return {
    userId: user._id,
    profile: publicProfile,
    personA,
    ownLegacyStructure,
    ownBirthProfile: ownProfile,
    requestedLevel: requestedLevelFor(publicProfile),
    inputHash,
    cacheKey,
    cached,
  };
}

function cacheDocumentToResult(cache: Doc<"relationshipComparisonCachesV492">): ComparisonResult {
  return omitUndefined({
    analysisId: cache.analysisId,
    methodVersion: cache.methodVersion,
    providerVersion: cache.providerVersion,
    inputHash: cache.inputHash,
    status: cache.status,
    precision: cache.precision,
    observedAt: cache.observedAt,
    validUntil: cache.validUntil,
    data: cache.data,
    missingInputs: cache.missingInputs,
    limitations: cache.limitations,
    elaboration: cache.elaboration,
    sourceRefs: cache.sourceRefs,
  }) as ComparisonResult;
}

export function fallbackForState(state: Infer<typeof comparisonRefreshStateValidator>, observedAt: number) {
  if (!state.personA) {
    return unavailableComparisonResult({
      inputHash: state.inputHash,
      requestedLevel: state.requestedLevel,
      observedAt,
      missingInputs: ["own_natal_chart"],
      limitation: "Falta tu carta natal vigente para comparar sin inventar posiciones.",
    });
  }
  const personB = publicProfileToSignChart(state.profile);
  if (!state.personA.zodiacSign || !personB.zodiacSign) {
    const missingInputs = Array.from(
      new Set([
        ...(!state.personA.zodiacSign
          ? [state.ownBirthProfile?.birthDate ? "comparison_ephemeris" : "own_sun_sign"]
          : []),
        ...(!personB.zodiacSign
          ? [state.profile.birthDate ? "comparison_ephemeris" : "other_sun_sign"]
          : []),
      ]),
    );
    const needsEphemeris = missingInputs.includes("comparison_ephemeris");
    return unavailableComparisonResult({
      inputHash: state.inputHash,
      requestedLevel: state.requestedLevel,
      observedAt,
      missingInputs,
      limitation: needsEphemeris
        ? "No se pudo completar el cálculo de las posiciones necesarias. Podés reintentar la comparación."
        : "Todavía no hay dos signos solares verificables para mostrar una comparación general.",
    });
  }
  return buildRelationshipComparisonResult({
    inputHash: state.inputHash,
    requestedLevel: state.requestedLevel,
    personA: state.personA,
    personB,
    relationshipType: state.profile.relationshipType,
    observedAt,
    providerUnavailable: state.requestedLevel !== "sign_to_sign",
    extraMissingInputs:
      state.requestedLevel === "chart_to_chart" && !hasExactBirthInputs(state.ownBirthProfile)
        ? ["exact_birth_time_and_place"]
        : [],
    extraLimitations:
      state.requestedLevel === "sign_to_sign"
        ? []
        : ["Por ahora se muestra solo el estilo solar general; no se pudieron actualizar las posiciones de ambas fechas."],
  });
}

export function markRelationshipComparisonStale(cached: ComparisonResult): ComparisonResult {
  return {
    ...cached,
    status: "stale" as const,
    limitations: Array.from(
      new Set([
        ...cached.limitations,
        "No se pudo actualizar el cálculo. Se conserva la última comparación y su fecha de cálculo.",
      ]),
    ),
  };
}

function staleOrFallbackForState(
  state: Infer<typeof comparisonRefreshStateValidator>,
  observedAt: number,
) {
  return state.cached?.data
    ? markRelationshipComparisonStale(state.cached)
    : fallbackForState(state, observedAt);
}

type RelationshipCivilTimeContext = "own_birth" | "other_birth" | "day_interval";

export function relationshipCivilTimeLimitation(
  resolution: Exclude<CivilTimeResolution, { status: "exact" }>,
  context: RelationshipCivilTimeContext,
) {
  const subject = context === "own_birth" ? "Tu hora local" : "La hora local cargada";
  if (resolution.status === "gap") {
    return context === "day_interval"
      ? "En esa fecha, el reloj local salta sobre una de las horas necesarias para evaluar el día completo. Esa parte no se usa en la comparación."
      : `${subject} no existió en esa fecha por un cambio de hora. No se usa como exacta; la comparación baja al nivel por fecha.`;
  }
  if (resolution.status === "fold") {
    return context === "day_interval"
      ? "En esa fecha, una de las horas necesarias para evaluar el día completo ocurre dos veces. Esa parte no se usa porque no hay un instante único."
      : `${subject} ocurrió dos veces en esa fecha. Sin el desplazamiento original no hay un instante único; la comparación baja al nivel por fecha.`;
  }
  if (resolution.reason === "timezone") {
    return "La zona horaria cargada no se pudo interpretar. La comparación se muestra sin las partes que dependen de una hora exacta.";
  }
  return resolution.reason === "date"
    ? "La fecha cargada no se pudo interpretar. La comparación se muestra solo con los datos verificables."
    : "La hora cargada no se pudo interpretar. La comparación se muestra sin las partes que dependen de una hora exacta.";
}

class RelationshipCivilTimeError extends Error {
  constructor(
    readonly resolution: Exclude<CivilTimeResolution, { status: "exact" }>,
    readonly context: RelationshipCivilTimeContext,
  ) {
    super("RELATIONSHIP_CIVIL_TIME_UNRESOLVED");
  }

  get limitation() {
    return relationshipCivilTimeLimitation(this.resolution, this.context);
  }
}

function resolveCivilInstant(args: {
  localDate: string;
  localTime: string;
  timezone: string;
  context: RelationshipCivilTimeContext;
}) {
  const resolution = resolveZonedCivilTime(args);
  if (resolution.status !== "exact") {
    throw new RelationshipCivilTimeError(resolution, args.context);
  }
  return resolution;
}

type RelationshipChartCalculation = {
  personB: RelationshipChartWire;
  providerVersion: string;
  limitation: string | null;
  hasExactHouses: boolean;
};

type RelationshipChartAttempt = {
  calculation: RelationshipChartCalculation | null;
  civilTimeLimitation: string | null;
  civilTimeUnresolved: boolean;
};

const EMPTY_CHART_ATTEMPT: RelationshipChartAttempt = {
  calculation: null,
  civilTimeLimitation: null,
  civilTimeUnresolved: false,
};

async function attemptRelationshipChart(
  calculate: () => Promise<RelationshipChartCalculation | null>,
): Promise<RelationshipChartAttempt> {
  try {
    return {
      calculation: await calculate(),
      civilTimeLimitation: null,
      civilTimeUnresolved: false,
    };
  } catch (error) {
    if (error instanceof RelationshipCivilTimeError) {
      return {
        calculation: null,
        civilTimeLimitation: error.limitation,
        civilTimeUnresolved: true,
      };
    }
    throw error;
  }
}

export type RelationshipDateInterval = {
  startMs: number;
  endMsExclusive: number;
  requestTimezone: string;
  limitation: string;
  kind: "known_timezone" | "global_possible_window";
};

function nextIsoDate(localDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return null;
  const instant = new Date(0);
  instant.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1);
  instant.setUTCHours(0, 0, 0, 0);
  return `${String(instant.getUTCFullYear()).padStart(4, "0")}-${String(
    instant.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(instant.getUTCDate()).padStart(2, "0")}`;
}

/** Franja real de una fecha. Sin zona conocida agrega dieciocho horas a cada
 * lado, una cobertura deliberadamente mayor que los desplazamientos civiles
 * actuales e históricos habituales; no toma UTC como si fuera el lugar natal. */
export function relationshipDateInterval(args: {
  birthDate: string;
  timezone: string | null;
}): RelationshipDateInterval | null {
  if (!validIsoDate(args.birthDate)) return null;
  if (args.timezone) {
    const nextDate = nextIsoDate(args.birthDate);
    if (!nextDate) return null;
    const start = resolveCivilInstant({
      localDate: args.birthDate,
      localTime: "00:00",
      timezone: args.timezone,
      context: "day_interval",
    });
    const end = resolveCivilInstant({
      localDate: nextDate,
      localTime: "00:00",
      timezone: args.timezone,
      context: "day_interval",
    });
    if (end.instantMs <= start.instantMs) return null;
    return {
      startMs: start.instantMs,
      endMsExclusive: end.instantMs,
      requestTimezone: args.timezone,
      limitation:
        "Como no hay una hora exacta, se cubrió toda la fecha. Lo que puede cambiar dentro de esa franja se muestra como rango o se retira.",
      kind: "known_timezone",
    };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(args.birthDate)!;
  const midnightUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return {
    startMs: midnightUtc - 18 * 60 * 60 * 1000,
    endMsExclusive: midnightUtc + 42 * 60 * 60 * 1000,
    requestTimezone: "UTC",
    limitation:
      "Sin lugar o zona horaria, se cubrió toda la franja posible de esa fecha. Lo que puede cambiar dentro de esa franja se muestra como rango o se retira.",
    kind: "global_possible_window",
  };
}

export function relationshipDateSampleInstants(interval: RelationshipDateInterval) {
  const lastIncludedMs = interval.endMsExclusive - 60 * 1000;
  const instants: number[] = [];
  for (
    let instantMs = interval.startMs;
    instantMs <= lastIncludedMs;
    instantMs += RELATIONSHIP_DATE_SAMPLE_STEP_MS
  ) {
    instants.push(instantMs);
  }
  if (instants[instants.length - 1] !== lastIncludedMs) instants.push(lastIncludedMs);
  return instants;
}

type RelationshipCanonicalSample = {
  instantMs: number;
  positions: EphemerisPosition[];
};

function uniqueDegrees(values: number[]) {
  return Array.from(
    new Set(values.map((value) => normalizedDegree(value).toFixed(6))),
    (value) => Number(value),
  ).sort((left, right) => left - right);
}

/**
 * Convierte una malla densa en rangos conservadores. La cota de movimiento se
 * agrega alrededor de cada muestra; por eso un cruce entre muestras no puede
 * presentarse como una posición estable.
 */
export function certifyRelationshipDateChart(args: {
  profile: RelationshipCalculationProfile;
  interval: RelationshipDateInterval;
  samples: RelationshipCanonicalSample[];
}): RelationshipChartWire | null {
  const samples = [...args.samples].sort((left, right) => left.instantMs - right.instantMs);
  if (samples.length < 2) return null;
  const lastIncludedMs = args.interval.endMsExclusive - 60 * 1000;
  if (samples[0]!.instantMs > args.interval.startMs || samples.at(-1)!.instantMs < lastIncludedMs) {
    return null;
  }
  let maxGapMs = 0;
  for (let index = 1; index < samples.length; index += 1) {
    maxGapMs = Math.max(maxGapMs, samples[index]!.instantMs - samples[index - 1]!.instantMs);
  }
  if (maxGapMs > RELATIONSHIP_DATE_SAMPLE_STEP_MS + 60 * 1000) return null;

  const expectedKeys = Object.keys(MAX_DAILY_MOVEMENT_DEGREES);
  const byKey = new Map<string, Array<{ instantMs: number; position: EphemerisPosition }>>();
  for (const sample of samples) {
    const unique = new Map(sample.positions.map((position) => [plainKey(position.key), position]));
    if (unique.size !== expectedKeys.length || expectedKeys.some((key) => !unique.has(key))) return null;
    for (const key of expectedKeys) {
      const values = byKey.get(key) ?? [];
      values.push({ instantMs: sample.instantMs, position: unique.get(key)! });
      byKey.set(key, values);
    }
  }

  const midpoint = args.interval.startMs + (args.interval.endMsExclusive - args.interval.startMs) / 2;
  const placements = expectedKeys.map((key) => {
    const readings = byKey.get(key)!;
    const representative = [...readings].sort(
      (left, right) =>
        Math.abs(left.instantMs - midpoint) - Math.abs(right.instantMs - midpoint) ||
        left.instantMs - right.instantMs,
    )[0]!.position;
    const movementMargin =
      MAX_DAILY_MOVEMENT_DEGREES[key]! * (maxGapMs / (24 * 60 * 60 * 1000));
    const candidates = uniqueDegrees(
      readings.flatMap(({ position }) => [
        position.fullDegree - movementMargin,
        position.fullDegree,
        position.fullDegree + movementMargin,
      ]),
    );
    const possibleSigns = new Set(candidates.map(signForDegree));
    const timeStable = possibleSigns.size === 1;
    return {
      key: representative.key,
      label: representative.label,
      sign: timeStable ? Array.from(possibleSigns)[0]! : null,
      longitude: normalizedDegree(representative.fullDegree),
      longitudeSamples: candidates,
      timeStable,
      house: null,
    };
  });
  const sun = placements.find((placement) => plainKey(placement.key) === "sun")!;
  const declaredSign = canonicalSign(args.profile.zodiacSign);
  if (!sun.timeStable && !declaredSign) return null;
  return {
    name: args.profile.name,
    zodiacSign: declaredSign ?? sun.sign,
    birthTimePrecision: "unknown",
    placements,
    houses: [],
  };
}

async function dateChartForProfile(profile: RelationshipCalculationProfile, signal: AbortSignal) {
  if (!profile.birthDate) return null;
  const interval = relationshipDateInterval({
    birthDate: profile.birthDate,
    timezone: profile.timezone,
  });
  if (!interval) return null;
  const instants = relationshipDateSampleInstants(interval);
  const results = await Promise.all(
    instants.map((instantMs) =>
      runAstrologyApiPlanetsTropical({
        instant: new Date(instantMs),
        localDate: profile.birthDate!,
        timezone: interval.requestTimezone,
        latitude: profile.latitude ?? undefined,
        longitude: profile.longitude ?? undefined,
        signal,
      }),
    ),
  );
  if (results.some((result) => result.status !== "success" || !result.normalized)) return null;
  const samples = results.map((result, index) => ({
    instantMs: instants[index]!,
    positions: result.normalized!.positions,
  }));
  const personB = certifyRelationshipDateChart({ profile, interval, samples });
  if (!personB) return null;
  return {
    personB,
    providerVersion: results[0]!.providerVersion,
    limitation: interval.limitation,
    hasExactHouses: false,
  };
}

async function exactChartForProfile(
  profile: RelationshipCalculationProfile,
  signal: AbortSignal,
  options?: {
    legacyStructure?: RelationshipChartWire | null;
    fetchLegacyStructure?: boolean;
    context?: "own_birth" | "other_birth";
  },
) {
  if (
    !profile.birthDate ||
    !profile.birthTime ||
    profile.birthTimePrecision !== "known" ||
    profile.latitude === null ||
    profile.longitude === null ||
    !profile.timezone
  ) {
    return null;
  }
  const civilTime = resolveCivilInstant({
    localDate: profile.birthDate,
    localTime: profile.birthTime,
    timezone: profile.timezone,
    context: options?.context ?? "other_birth",
  });
  const canonicalPromise = runAstrologyApiPlanetsTropical({
    instant: new Date(civilTime.instantMs),
    localDate: profile.birthDate,
    timezone: profile.timezone,
    latitude: profile.latitude,
    longitude: profile.longitude,
    signal,
  });
  const geometryPromise = options?.fetchLegacyStructure
    ? runAstrologyApiNatalChart({
        input: {
          birthDate: profile.birthDate,
          birthTime: profile.birthTime,
          birthTimePrecision: "known",
          birthPlaceLabel: profile.birthPlaceLabel ?? "Ubicación natal",
          latitude: profile.latitude,
          longitude: profile.longitude,
          timezone: String(civilTime.offsetMinutes / 60),
        },
        localDate: profile.birthDate,
        signal,
      })
    : Promise.resolve(null);
  const [canonical, geometry] = await Promise.all([canonicalPromise, geometryPromise]);
  if (canonical.status !== "success" || !canonical.normalized) return null;
  const geometryChart =
    geometry?.status === "success" && geometry.normalized?.chart
      ? geometry.normalized.chart
      : null;
  const legacyStructure =
    options?.legacyStructure ??
    legacyChartToHouseStructure({
      chart: geometryChart,
      name: profile.name,
      zodiacSign:
        canonicalSign(canonical.normalized.positions.find((position) => position.key === "sun")?.sign) ??
        canonicalSign(profile.zodiacSign),
      birthTimePrecision: "known",
    });
  const personB = mergeCanonicalRelationshipChart({
    canonicalPositions: canonical.normalized.positions,
    legacyStructure,
    name: profile.name,
    birthTimePrecision: "known",
  });
  if (!personB) return null;
  const hasExactHouses = personB.houses.length === 12;
  return {
    personB,
    providerVersion: canonical.providerVersion,
    limitation: hasExactHouses
      ? null
      : "Las posiciones están calculadas con la hora cargada, pero no hay doce casas verificadas. La comparación se muestra sin casas ni Ascendentes.",
    hasExactHouses,
  };
}

// ---------------------------------------------------------------------------
// Contratos legacy: se conservan exactamente para clientes instalados.

export const getActive = query({
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    return await ctx.db
      .query("relationshipProfiles")
      .withIndex("by_user_active", (q: any) => q.eq("userId", user._id).eq("isActive", true))
      .first();
  },
});

export const upsert = mutation({
  args: {
    name: v.string(),
    relationshipType: v.optional(relationshipTypeValidator),
    birthDate: v.optional(v.string()),
    birthTime: v.optional(v.string()),
    birthPlaceLabel: v.optional(v.string()),
    zodiacSign: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const active = await ctx.db
      .query("relationshipProfiles")
      .withIndex("by_user_active", (q: any) => q.eq("userId", user._id).eq("isActive", true))
      .first();

    const legacyPlaceChanged = Boolean(
      active &&
        args.birthPlaceLabel !== undefined &&
        trimmedOrNull(args.birthPlaceLabel) !== trimmedOrNull(active.birthPlaceLabel),
    );
    const payload = {
      ...omitUndefined({
        userId: user._id,
        name: args.name.trim(),
        relationshipType: args.relationshipType,
        birthDate: args.birthDate,
        birthTime: args.birthTime,
        birthPlaceLabel: args.birthPlaceLabel,
        zodiacSign: args.zodiacSign,
        isActive: true,
        updatedAt: now,
      }),
      ...(legacyPlaceChanged
        ? {
            placeId: undefined,
            placeProvider: undefined,
            latitude: undefined,
            longitude: undefined,
            timezone: undefined,
          }
        : {}),
    };

    if (active) {
      await ctx.db.patch(active._id, payload);
      return active._id;
    }

    return await ctx.db.insert("relationshipProfiles", {
      ...payload,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ---------------------------------------------------------------------------
// API V4.9.2.

export const list = query({
  args: {},
  returns: v.array(relationshipProfileValidator),
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];
    const profiles = await ctx.db
      .query("relationshipProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
    return profiles
      .sort((left: Doc<"relationshipProfiles">, right: Doc<"relationshipProfiles">) =>
        left.createdAt - right.createdAt || String(left._id).localeCompare(String(right._id)),
      )
      .map(toPublicProfile);
  },
});

export const savePerson = mutation({
  args: savePersonArgs,
  returns: relationshipProfileValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const normalized = normalizeRelationshipPersonInput(args);
    const normalizedIdempotencyKey = normalizeRelationshipIdempotencyKey(args.idempotencyKey);
    const creationRequestKey = args.profileId ? null : normalizedIdempotencyKey;
    const now = Date.now();
    const values = {
      name: normalized.name,
      // Un cliente 22/23 no conoce este campo: al editar no debe borrar una
      // elección hecha luego desde un cliente nuevo. Sólo se toca cuando el
      // argumento vino declarado explícitamente.
      ...(args.relationshipType !== undefined
        ? { relationshipType: normalized.relationshipType ?? undefined }
        : {}),
      birthDate: normalized.birthDate ?? undefined,
      birthTime: normalized.birthTime ?? undefined,
      birthTimePrecision: normalized.birthTimePrecision,
      birthPlaceLabel: normalized.birthPlaceLabel ?? undefined,
      placeId: normalized.placeId ?? undefined,
      placeProvider: normalized.placeProvider ?? undefined,
      latitude: normalized.latitude ?? undefined,
      longitude: normalized.longitude ?? undefined,
      timezone: normalized.timezone ?? undefined,
      zodiacSign: normalized.zodiacSign ?? undefined,
      updatedAt: now,
    };

    let profileId = args.profileId;
    if (profileId) {
      const profile = await getOwnedProfile(ctx, user._id, profileId);
      if (!profile) throw new Error("RELATIONSHIP_PROFILE_NOT_FOUND");
      await ctx.db.patch(profileId, values);
    } else {
      if (creationRequestKey) {
        // Esta lectura indexada forma parte de la misma transacción que el
        // insert. Convex reintenta una de dos mutations concurrentes que hayan
        // leído el mismo rango; al reintentar encuentra la fila ya creada.
        const existingRequest = await ctx.db
          .query("relationshipProfiles")
          .withIndex("by_user_creation_request_key", (q: any) =>
            q.eq("userId", user._id).eq("creationRequestKey", creationRequestKey),
          )
          .first();
        if (existingRequest) {
          if (!relationshipProfileMatchesNormalizedInput(existingRequest, normalized)) {
            throw new Error("RELATIONSHIP_REQUEST_KEY_CONFLICT");
          }
          return toPublicProfile(existingRequest);
        }
      }
      const active = await ctx.db
        .query("relationshipProfiles")
        .withIndex("by_user_active", (q: any) => q.eq("userId", user._id).eq("isActive", true))
        .first();
      profileId = await ctx.db.insert("relationshipProfiles", {
        userId: user._id,
        ...values,
        ...(creationRequestKey ? { creationRequestKey } : {}),
        isActive: !active,
        createdAt: now,
      });
    }

    const saved = await ctx.db.get(profileId);
    if (!saved || saved.userId !== user._id) throw new Error("RELATIONSHIP_PROFILE_SAVE_FAILED");
    return toPublicProfile(saved);
  },
});

export const removePerson = mutation({
  args: { profileId: v.id("relationshipProfiles") },
  returns: v.object({ removed: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const profile = await getOwnedProfile(ctx, user._id, args.profileId);
    if (!profile) throw new Error("RELATIONSHIP_PROFILE_NOT_FOUND");
    const caches = await ctx.db
      .query("relationshipComparisonCachesV492")
      .withIndex("by_user_profile", (q: any) =>
        q.eq("userId", user._id).eq("profileId", args.profileId),
      )
      .collect();
    for (const cache of caches) await ctx.db.delete(cache._id);
    await ctx.db.delete(profile._id);
    if (profile.isActive) {
      const remaining = await ctx.db
        .query("relationshipProfiles")
        .withIndex("by_user", (q: any) => q.eq("userId", user._id))
        .collect();
      const nextActive = remaining.sort(
        (left: Doc<"relationshipProfiles">, right: Doc<"relationshipProfiles">) =>
          left.createdAt - right.createdAt || String(left._id).localeCompare(String(right._id)),
      )[0];
      if (nextActive && !nextActive.isActive) {
        await ctx.db.patch(nextActive._id, { isActive: true, updatedAt: Date.now() });
      }
    }
    return { removed: true };
  },
});

export const getComparison = query({
  args: { profileId: v.id("relationshipProfiles") },
  returns: relationshipComparisonResultValidator,
  handler: async (ctx, args) => {
    const user = await findCurrentUser(ctx);
    if (!user) {
      throw new Error("Authentication required");
    }
    const profile = await getOwnedProfile(ctx, user._id, args.profileId);
    if (!profile) throw new Error("RELATIONSHIP_PROFILE_NOT_FOUND");
    const state = await buildComparisonState(ctx, user, profile);
    if (state.cached && (state.cached.validUntil === null || state.cached.validUntil > Date.now())) {
      return state.cached;
    }
    return fallbackForState(state, Date.now());
  },
});

export const getComparisonRefreshState = internalQuery({
  args: {
    tokenIdentifier: v.string(),
    profileId: v.id("relationshipProfiles"),
  },
  returns: comparisonRefreshStateValidator,
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");
    const profile = await getOwnedProfile(ctx, user._id, args.profileId);
    if (!profile) throw new Error("RELATIONSHIP_PROFILE_NOT_FOUND");
    return await buildComparisonState(ctx, user, profile);
  },
});

export const persistComparisonRefresh = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    profileId: v.id("relationshipProfiles"),
    expectedInputHash: v.string(),
    requestedLevel: comparisonLevelValidator,
    result: relationshipComparisonResultValidator,
  },
  returns: relationshipComparisonResultValidator,
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");
    const profile = await getOwnedProfile(ctx, user._id, args.profileId);
    if (!profile) throw new Error("RELATIONSHIP_PROFILE_NOT_FOUND");
    const state = await buildComparisonState(ctx, user, profile);
    if (state.inputHash !== args.expectedInputHash || state.requestedLevel !== args.requestedLevel) {
      throw new Error("RELATIONSHIP_INPUT_CHANGED_DURING_REFRESH");
    }
    if (args.result.inputHash !== state.inputHash) {
      throw new Error("RELATIONSHIP_RESULT_INPUT_MISMATCH");
    }
    if (args.result.analysisId !== "ORB-REL-002" && args.result.analysisId !== "ORB-REL-003") {
      throw new Error("RELATIONSHIP_RESULT_ANALYSIS_INVALID");
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("relationshipComparisonCachesV492")
      .withIndex("by_cache_key", (q: any) => q.eq("cacheKey", state.cacheKey))
      .first();
    if (existing && (existing.userId !== user._id || existing.profileId !== profile._id)) {
      throw new Error("RELATIONSHIP_CACHE_IDENTITY_COLLISION");
    }
    const fields = omitUndefined({
      userId: user._id,
      profileId: profile._id,
      requestedLevel: args.requestedLevel,
      cacheKey: state.cacheKey,
      analysisId: args.result.analysisId,
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
      updatedAt: now,
    });
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("relationshipComparisonCachesV492", { ...fields, createdAt: now });
    }
    return args.result;
  },
});

export const refreshComparison = action({
  args: { profileId: v.id("relationshipProfiles") },
  returns: relationshipComparisonResultValidator,
  handler: async (ctx, args): Promise<ComparisonResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");
    const state = await ctx.runQuery(internal.relationships.getComparisonRefreshState, {
      tokenIdentifier: identity.tokenIdentifier,
      profileId: args.profileId,
    });
    const observedAt = Date.now();
    let result: ComparisonResult;

    if (state.requestedLevel === "sign_to_sign") {
      result = fallbackForState(state, observedAt);
    } else if (!state.ownBirthProfile?.birthDate) {
      result = fallbackForState(state, observedAt);
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), COMPARISON_PROVIDER_TIMEOUT_MS);
      try {
        const ownExactCivilResolution = hasExactBirthInputs(state.ownBirthProfile)
          ? resolveZonedCivilTime({
              localDate: state.ownBirthProfile!.birthDate!,
              localTime: state.ownBirthProfile!.birthTime!,
              timezone: state.ownBirthProfile!.timezone!,
            })
          : null;
        const ownExactCivilLimitation =
          ownExactCivilResolution && ownExactCivilResolution.status !== "exact"
            ? relationshipCivilTimeLimitation(ownExactCivilResolution, "own_birth")
            : null;
        const ownCanUseExact =
          hasExactBirthInputs(state.ownBirthProfile) && !ownExactCivilLimitation;
        const ownPrimaryAttempt = await attemptRelationshipChart(() =>
          ownCanUseExact
            ? exactChartForProfile(state.ownBirthProfile!, controller.signal, {
                legacyStructure: state.ownLegacyStructure,
                fetchLegacyStructure: false,
                context: "own_birth",
              })
            : dateChartForProfile(state.ownBirthProfile!, controller.signal),
        );
        let ownCalculated = ownPrimaryAttempt.calculation;
        const ownExactCalculationUnavailable = ownCanUseExact && !ownCalculated;
        if (!ownCalculated && ownCanUseExact) {
          const ownDateAttempt = await attemptRelationshipChart(() =>
            dateChartForProfile(state.ownBirthProfile!, controller.signal),
          );
          ownCalculated = ownDateAttempt.calculation;
        }
        const exactRequested = state.requestedLevel === "chart_to_chart";
        const primaryAttempt = await attemptRelationshipChart(() =>
          exactRequested
            ? exactChartForProfile(state.profile, controller.signal, {
                fetchLegacyStructure: true,
                context: "other_birth",
              })
            : dateChartForProfile(state.profile, controller.signal),
        );
        let calculated = primaryAttempt.calculation;
        const calculationLimitations = primaryAttempt.civilTimeLimitation
          ? [primaryAttempt.civilTimeLimitation]
          : [];
        const exactCalculationUnavailable =
          exactRequested && !calculated && !primaryAttempt.civilTimeUnresolved;
        if (!calculated && exactRequested) {
          const dateAttempt = await attemptRelationshipChart(() =>
            dateChartForProfile(state.profile, controller.signal),
          );
          calculated = dateAttempt.calculation;
          if (dateAttempt.civilTimeLimitation) {
            calculationLimitations.push(dateAttempt.civilTimeLimitation);
          }
        }
        const civilTimeLimitations = Array.from(
          new Set(
            [
              ...calculationLimitations,
              ownExactCivilLimitation,
              ownPrimaryAttempt.civilTimeLimitation,
            ].filter((limitation): limitation is string => Boolean(limitation)),
          ),
        );
        const exactCivilTimeUnresolved =
          primaryAttempt.civilTimeUnresolved ||
          Boolean(ownExactCivilLimitation) ||
          ownPrimaryAttempt.civilTimeUnresolved;
        if (!calculated || !ownCalculated) {
          result = staleOrFallbackForState(state, observedAt);
          if (civilTimeLimitations.length > 0) {
            result = {
              ...result,
              limitations: Array.from(
                new Set([...result.limitations, ...civilTimeLimitations]),
              ),
            };
          }
        } else {
          const versions = Array.from(
            new Set(
              [ownCalculated?.providerVersion, calculated.providerVersion].filter(
                (version): version is string => Boolean(version),
              ),
            ),
          );
          const extraLimitations = [
            ...(calculated.limitation ? [calculated.limitation] : []),
            ...(ownCalculated.limitation ? [ownCalculated.limitation] : []),
            ...civilTimeLimitations,
            ...(exactCalculationUnavailable && calculated
              ? ["No se pudo completar el cálculo con la hora cargada de la otra persona. Se muestra la comparación por fecha, sin casas ni Ascendentes."]
              : []),
            ...(ownExactCalculationUnavailable && ownCalculated
              ? ["No se pudo completar tu cálculo con la hora cargada. Se usa toda tu fecha y se retiran casas y Ascendentes."]
              : []),
          ];
          const exactHousesMissing =
            exactRequested && (!calculated.hasExactHouses || !ownCalculated.hasExactHouses);
          result = buildRelationshipComparisonResult({
            inputHash: state.inputHash,
            requestedLevel: state.requestedLevel,
            personA: ownCalculated.personB,
            personB: calculated.personB,
            relationshipType: state.profile.relationshipType,
            observedAt,
            providerVersion: versions.length > 0 ? versions.join("+") : undefined,
            providerUnavailable: false,
            exactCivilTimeUnresolved,
            extraMissingInputs: [
              ...(exactRequested && !hasExactBirthInputs(state.ownBirthProfile)
                ? ["exact_birth_time_and_place"]
                : []),
              ...(exactHousesMissing ? ["verified_house_geometry"] : []),
            ],
            extraLimitations,
          });
        }
      } catch {
        result = staleOrFallbackForState(state, observedAt);
      } finally {
        clearTimeout(timeout);
      }
    }

    return await ctx.runMutation(internal.relationships.persistComparisonRefresh, {
      tokenIdentifier: identity.tokenIdentifier,
      profileId: args.profileId,
      expectedInputHash: state.inputHash,
      requestedLevel: state.requestedLevel,
      result,
    });
  },
});
