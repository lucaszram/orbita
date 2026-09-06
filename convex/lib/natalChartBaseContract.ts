import { v, type Infer } from "convex/values";

/**
 * Carta natal pública V4.9.2.
 *
 * Este contrato no replica `charts.current`: las posiciones planetarias salen
 * exclusivamente del cache canónico de `planets/tropical`. La geometría de
 * casas y ángulos es la única parte que puede provenir de la carta occidental
 * anterior, y sólo cuando la hora de nacimiento está marcada como conocida.
 */

export const canonicalNatalPlanetKeyValidator = v.union(
  v.literal("sun"),
  v.literal("moon"),
  v.literal("mercury"),
  v.literal("venus"),
  v.literal("mars"),
  v.literal("jupiter"),
  v.literal("saturn"),
  v.literal("uranus"),
  v.literal("neptune"),
  v.literal("pluto"),
);

export const canonicalNatalPositionPrecisionValidator = v.union(
  v.literal("exact"),
  v.literal("estimated"),
  v.literal("range"),
  v.literal("omitted"),
);

export const canonicalNatalAspectTypeValidator = v.union(
  v.literal("conjunction"),
  v.literal("sextile"),
  v.literal("square"),
  v.literal("trine"),
  v.literal("opposition"),
);

export const canonicalNatalPositionValidator = v.object({
  key: canonicalNatalPlanetKeyValidator,
  label: v.string(),
  source: v.literal("planets/tropical"),
  precision: canonicalNatalPositionPrecisionValidator,
  sign: v.union(v.string(), v.null()),
  signEs: v.union(v.string(), v.null()),
  possibleSigns: v.array(v.string()),
  possibleSignsEs: v.array(v.string()),
  degree: v.union(v.number(), v.null()),
  fullDegree: v.union(v.number(), v.null()),
  house: v.union(v.number(), v.null()),
  isRetrograde: v.union(v.boolean(), v.null()),
  limitation: v.union(v.string(), v.null()),
});

export const canonicalNatalAngleValidator = v.object({
  key: v.union(v.literal("ascendant"), v.literal("mc")),
  label: v.string(),
  source: v.literal("verified_legacy_geometry"),
  precision: v.literal("exact"),
  sign: v.string(),
  signEs: v.string(),
  degree: v.number(),
  fullDegree: v.number(),
  house: v.number(),
});

export const canonicalNatalHouseValidator = v.object({
  house: v.number(),
  source: v.literal("verified_legacy_geometry"),
  precision: v.literal("exact"),
  sign: v.string(),
  signEs: v.string(),
  degree: v.number(),
  theme: v.string(),
});

export const canonicalNatalAspectValidator = v.object({
  from: canonicalNatalPlanetKeyValidator,
  to: canonicalNatalPlanetKeyValidator,
  source: v.literal("canonical_longitudes"),
  type: canonicalNatalAspectTypeValidator,
  typeEs: v.string(),
  precision: v.union(v.literal("exact"), v.literal("estimated"), v.literal("range")),
  orb: v.union(v.number(), v.null()),
  orbRange: v.union(
    v.object({
      from: v.number(),
      to: v.number(),
    }),
    v.null(),
  ),
  isMajor: v.literal(true),
});

export const natalChartBaseValidator = v.object({
  methodVersion: v.string(),
  providerVersion: v.union(v.string(), v.null()),
  inputHash: v.string(),
  status: v.union(v.literal("ready"), v.literal("partial"), v.literal("unavailable")),
  observedAt: v.number(),
  birthTimePrecision: v.union(
    v.literal("known"),
    v.literal("approximate"),
    v.literal("unknown"),
    v.null(),
  ),
  calculationTimeSource: v.union(
    v.literal("exact_birth_time"),
    v.literal("full_civil_day"),
    v.literal("unavailable"),
  ),
  access: v.object({
    isPro: v.boolean(),
    positions: v.boolean(),
    angles: v.boolean(),
    houses: v.boolean(),
    aspects: v.boolean(),
  }),
  positions: v.array(canonicalNatalPositionValidator),
  angles: v.array(canonicalNatalAngleValidator),
  houses: v.array(canonicalNatalHouseValidator),
  aspects: v.array(canonicalNatalAspectValidator),
  missingInputs: v.array(v.string()),
  limitations: v.array(v.string()),
});

export type CanonicalNatalPlanetKey = Infer<typeof canonicalNatalPlanetKeyValidator>;
export type CanonicalNatalPositionPrecision = Infer<
  typeof canonicalNatalPositionPrecisionValidator
>;
export type CanonicalNatalAspectType = Infer<typeof canonicalNatalAspectTypeValidator>;
export type CanonicalNatalPosition = Infer<typeof canonicalNatalPositionValidator>;
export type CanonicalNatalAngle = Infer<typeof canonicalNatalAngleValidator>;
export type CanonicalNatalHouse = Infer<typeof canonicalNatalHouseValidator>;
export type CanonicalNatalAspect = Infer<typeof canonicalNatalAspectValidator>;
export type NatalChartBase = Infer<typeof natalChartBaseValidator>;
