/**
 * Matemática pura compartida por las capas astrológicas V4.9.2.
 *
 * Este módulo no conoce Convex, usuarios, proveedores ni copy de UI. Todas las
 * funciones son deterministas y trabajan con posiciones tropicales ya
 * normalizadas por el adaptador del proveedor.
 */

export const FULL_CIRCLE_DEGREES = 360;
export const LUNAR_PHASE_COUNT = 8;
export const LUNAR_PHASE_SPAN_DEGREES = FULL_CIRCLE_DEGREES / LUNAR_PHASE_COUNT;
export const SYNODIC_MONTH_DAYS = 29.530588853;
export const TROPICAL_YEAR_DAYS = 365.242189;
export const MILLISECONDS_PER_DAY = 86_400_000;

export type LunarPhaseId =
  | "new"
  | "waxing_crescent"
  | "first_quarter"
  | "waxing_gibbous"
  | "full"
  | "waning_gibbous"
  | "last_quarter"
  | "waning_crescent";

export type LunarPhase = {
  id: LunarPhaseId;
  index: number;
  number: number;
  labelEs: string;
  startDegrees: number;
  endDegrees: number;
};

const LUNAR_PHASE_DEFINITIONS = [
  { id: "new", labelEs: "Luna nueva" },
  { id: "waxing_crescent", labelEs: "Creciente" },
  { id: "first_quarter", labelEs: "Cuarto creciente" },
  { id: "waxing_gibbous", labelEs: "Gibosa creciente" },
  { id: "full", labelEs: "Luna llena" },
  { id: "waning_gibbous", labelEs: "Gibosa menguante" },
  { id: "last_quarter", labelEs: "Cuarto menguante" },
  { id: "waning_crescent", labelEs: "Menguante" }
] as const satisfies ReadonlyArray<{ id: LunarPhaseId; labelEs: string }>;

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number.`);
  }
}

/** Devuelve un ángulo en el intervalo semiabierto [0, 360). */
export function normalizeDegrees(value: number): number {
  assertFiniteNumber(value, "degrees");
  const normalized = ((value % FULL_CIRCLE_DEGREES) + FULL_CIRCLE_DEGREES) % FULL_CIRCLE_DEGREES;
  return Object.is(normalized, -0) ? 0 : normalized;
}

/**
 * Distancia firmada más corta desde `fromDegrees` hasta `toDegrees`.
 * El caso exactamente opuesto se representa como +180° para que sea estable.
 */
export function shortestSignedAngularDelta(fromDegrees: number, toDegrees: number): number {
  const delta = normalizeDegrees(toDegrees - fromDegrees);
  return delta > 180 ? delta - FULL_CIRCLE_DEGREES : delta;
}

export function angularDistanceDegrees(firstDegrees: number, secondDegrees: number): number {
  return Math.abs(shortestSignedAngularDelta(firstDegrees, secondDegrees));
}

/** Extiende el siguiente ángulo normalizado junto al valor continuo anterior. */
export function unwrapDegrees(previousUnwrappedDegrees: number, nextDegrees: number): number {
  assertFiniteNumber(previousUnwrappedDegrees, "previousUnwrappedDegrees");
  return previousUnwrappedDegrees + shortestSignedAngularDelta(previousUnwrappedDegrees, nextDegrees);
}

/** Elongación geocéntrica Sol→Luna, en [0, 360). */
export function lunarElongationDegrees(sunLongitudeDegrees: number, moonLongitudeDegrees: number): number {
  return normalizeDegrees(moonLongitudeDegrees - sunLongitudeDegrees);
}

/** Fracción iluminada idealizada del disco lunar, en [0, 1]. */
export function lunarIlluminationFraction(elongationDegrees: number): number {
  const radians = (normalizeDegrees(elongationDegrees) * Math.PI) / 180;
  return (1 - Math.cos(radians)) / 2;
}

export function lunarIlluminationPercent(elongationDegrees: number): number {
  return Math.round(lunarIlluminationFraction(elongationDegrees) * 100);
}

/**
 * Órbita V1 usa ocho sectores consecutivos de 45° empezando en 0°.
 * Por ejemplo, 90°..<135° corresponde a Cuarto creciente.
 */
export function lunarPhaseAtElongation(elongationDegrees: number): LunarPhase {
  const normalized = normalizeDegrees(elongationDegrees);
  const index = Math.floor(normalized / LUNAR_PHASE_SPAN_DEGREES);
  const definition = LUNAR_PHASE_DEFINITIONS[index];

  return {
    ...definition,
    index,
    number: index + 1,
    startDegrees: index * LUNAR_PHASE_SPAN_DEGREES,
    endDegrees: (index + 1) * LUNAR_PHASE_SPAN_DEGREES
  };
}

export type IntervalPrecisionResult<T> =
  | {
      precision: "estimated";
      stable: true;
      value: T;
      candidates: T[];
    }
  | {
      precision: "range";
      stable: false;
      value: null;
      candidates: T[];
    };

/**
 * Reduce muestras de un intervalo a un valor estable o a un rango honesto.
 * El llamador decide cuántas muestras necesita para demostrar estabilidad.
 */
export function resolveIntervalPrecision<T>(
  samples: readonly T[],
  equals: (left: T, right: T) => boolean = Object.is
): IntervalPrecisionResult<T> {
  if (samples.length === 0) {
    throw new RangeError("At least one interval sample is required.");
  }

  const candidates: T[] = [];
  for (const sample of samples) {
    if (!candidates.some((candidate) => equals(candidate, sample))) {
      candidates.push(sample);
    }
  }

  if (candidates.length === 1) {
    return { precision: "estimated", stable: true, value: candidates[0], candidates };
  }

  return { precision: "range", stable: false, value: null, candidates };
}

export type LunarPhaseIntervalResult = IntervalPrecisionResult<LunarPhase>;

/**
 * Clasifica un intervalo corto de elongación siguiendo el arco más corto entre
 * sus extremos. Es apropiado para el intervalo civil de un día; no para rangos
 * de varios ciclos lunares.
 */
export function resolveLunarPhaseInterval(
  startElongationDegrees: number,
  endElongationDegrees: number
): LunarPhaseIntervalResult {
  const start = normalizeDegrees(startElongationDegrees);
  const end = unwrapDegrees(start, endElongationDegrees);
  const candidates: LunarPhase[] = [lunarPhaseAtElongation(start)];
  const epsilon = 1e-9;

  if (end > start) {
    let boundary = (Math.floor(start / LUNAR_PHASE_SPAN_DEGREES) + 1) * LUNAR_PHASE_SPAN_DEGREES;
    while (boundary <= end + epsilon) {
      candidates.push(lunarPhaseAtElongation(boundary));
      boundary += LUNAR_PHASE_SPAN_DEGREES;
    }
  } else if (end < start) {
    let boundary = Math.floor(start / LUNAR_PHASE_SPAN_DEGREES) * LUNAR_PHASE_SPAN_DEGREES;
    if (Math.abs(start - boundary) <= epsilon) {
      // Si el intervalo empieza exactamente en un límite, el instante siguiente
      // hacia atrás ya pertenece al sector anterior.
      candidates.push(lunarPhaseAtElongation(boundary - epsilon));
      boundary -= LUNAR_PHASE_SPAN_DEGREES;
    }

    while (boundary > end + epsilon) {
      candidates.push(lunarPhaseAtElongation(boundary - epsilon));
      boundary -= LUNAR_PHASE_SPAN_DEGREES;
    }
  }

  candidates.push(lunarPhaseAtElongation(end));
  return resolveIntervalPrecision(candidates, (left, right) => left.id === right.id);
}

export const NATAL_PLANETS = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto"
] as const;

export type NatalPlanet = (typeof NATAL_PLANETS)[number];
export type Element = "fire" | "earth" | "air" | "water";
export type ZodiacSign =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

export const ZODIAC_SIGNS = [
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
  "pisces"
] as const satisfies readonly ZodiacSign[];

const SIGN_ALIASES: Readonly<Record<string, ZodiacSign>> = {
  aries: "aries",
  taurus: "taurus",
  tauro: "taurus",
  gemini: "gemini",
  geminis: "gemini",
  cancer: "cancer",
  leo: "leo",
  virgo: "virgo",
  libra: "libra",
  scorpio: "scorpio",
  escorpio: "scorpio",
  sagittarius: "sagittarius",
  sagitario: "sagittarius",
  capricorn: "capricorn",
  capricornio: "capricorn",
  aquarius: "aquarius",
  acuario: "aquarius",
  pisces: "pisces",
  piscis: "pisces"
};

const SIGN_ELEMENTS: Readonly<Record<ZodiacSign, Element>> = {
  aries: "fire",
  taurus: "earth",
  gemini: "air",
  cancer: "water",
  leo: "fire",
  virgo: "earth",
  libra: "air",
  scorpio: "water",
  sagittarius: "fire",
  capricorn: "earth",
  aquarius: "air",
  pisces: "water"
};

export function normalizeZodiacSign(value: string): ZodiacSign | null {
  const normalized = value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return SIGN_ALIASES[normalized] ?? null;
}

export function elementForSign(sign: ZodiacSign): Element {
  return SIGN_ELEMENTS[sign];
}

export type ElementMapInput = Readonly<Partial<Record<NatalPlanet, string | null | undefined>>>;

export type ElementMapResult = {
  status: "complete" | "partial";
  counts: Record<Element, number>;
  total: number;
  countedPlanets: NatalPlanet[];
  missingPlanets: NatalPlanet[];
  invalidPlanets: NatalPlanet[];
  dominantElements: Element[];
  missingElements: Element[];
};

/** Cuenta cada planeta de Sol a Plutón una sola vez; ángulos y casas no entran. */
export function computeElementMap(placements: ElementMapInput): ElementMapResult {
  const counts: Record<Element, number> = { fire: 0, earth: 0, air: 0, water: 0 };
  const countedPlanets: NatalPlanet[] = [];
  const missingPlanets: NatalPlanet[] = [];
  const invalidPlanets: NatalPlanet[] = [];

  for (const planet of NATAL_PLANETS) {
    const rawSign = placements[planet];
    if (rawSign === undefined || rawSign === null || rawSign.trim() === "") {
      missingPlanets.push(planet);
      continue;
    }

    const sign = normalizeZodiacSign(rawSign);
    if (!sign) {
      invalidPlanets.push(planet);
      continue;
    }

    counts[elementForSign(sign)] += 1;
    countedPlanets.push(planet);
  }

  const elements = Object.keys(counts) as Element[];
  const maximum = Math.max(...elements.map((element) => counts[element]));

  return {
    status: countedPlanets.length === NATAL_PLANETS.length ? "complete" : "partial",
    counts,
    total: countedPlanets.length,
    countedPlanets,
    missingPlanets,
    invalidPlanets,
    dominantElements: maximum === 0 ? [] : elements.filter((element) => counts[element] === maximum),
    missingElements: elements.filter((element) => counts[element] === 0)
  };
}

export type CivilDate = { year: number; month: number; day: number };

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  assertFiniteNumber(year, "year");
  assertFiniteNumber(month, "month");
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("Invalid civil year or month.");
  }
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function parseIsoCivilDate(value: string): CivilDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new RangeError("Civil date must use YYYY-MM-DD.");
  }

  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (date.year < 1 || date.day < 1 || date.day > daysInMonth(date.year, date.month)) {
    throw new RangeError("Invalid civil date.");
  }
  return date;
}

export function formatIsoCivilDate(date: CivilDate): string {
  if (date.day < 1 || date.day > daysInMonth(date.year, date.month)) {
    throw new RangeError("Invalid civil date.");
  }
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function compareCivilDates(left: CivilDate, right: CivilDate): number {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

/** Política V1: un nacimiento el 29/2 cumple el 28/2 en años no bisiestos. */
export function birthAnniversaryInYear(birthDate: string | CivilDate, year: number): CivilDate {
  const birth = typeof birthDate === "string" ? parseIsoCivilDate(birthDate) : birthDate;
  if (!Number.isInteger(year) || year < birth.year) {
    throw new RangeError("Anniversary year cannot precede birth year.");
  }
  if (birth.month === 2 && birth.day === 29 && !isLeapYear(year)) {
    return { year, month: 2, day: 28 };
  }
  return { year, month: birth.month, day: birth.day };
}

export type TraditionalRuler = "sun" | "moon" | "mercury" | "venus" | "mars" | "jupiter" | "saturn";

const TRADITIONAL_RULERS: Readonly<Record<ZodiacSign, TraditionalRuler>> = {
  aries: "mars",
  taurus: "venus",
  gemini: "mercury",
  cancer: "moon",
  leo: "sun",
  virgo: "mercury",
  libra: "venus",
  scorpio: "mars",
  sagittarius: "jupiter",
  capricorn: "saturn",
  aquarius: "saturn",
  pisces: "jupiter"
};

export function traditionalRulerForSign(sign: ZodiacSign): TraditionalRuler {
  return TRADITIONAL_RULERS[sign];
}

export type AnnualProfection = {
  age: number;
  house: number;
  sign: ZodiacSign;
  ruler: TraditionalRuler;
  periodStart: string;
  periodEnd: string;
};

/** Profección anual Whole Sign, desde cumpleaños hasta cumpleaños. */
export function annualProfectionForDate(args: {
  birthDate: string;
  asOfDate: string;
  ascendantSign: ZodiacSign;
}): AnnualProfection {
  const birth = parseIsoCivilDate(args.birthDate);
  const asOf = parseIsoCivilDate(args.asOfDate);
  if (compareCivilDates(asOf, birth) < 0) {
    throw new RangeError("asOfDate cannot precede birthDate.");
  }

  const anniversaryThisYear = birthAnniversaryInYear(birth, asOf.year);
  let age = asOf.year - birth.year;
  if (compareCivilDates(asOf, anniversaryThisYear) < 0) {
    age -= 1;
  }

  const periodStartYear = birth.year + age;
  const periodStart = birthAnniversaryInYear(birth, periodStartYear);
  const periodEnd = birthAnniversaryInYear(birth, periodStartYear + 1);
  const house = (age % 12) + 1;
  const ascendantIndex = ZODIAC_SIGNS.indexOf(args.ascendantSign);
  const sign = ZODIAC_SIGNS[(ascendantIndex + house - 1) % ZODIAC_SIGNS.length];

  return {
    age,
    house,
    sign,
    ruler: traditionalRulerForSign(sign),
    periodStart: formatIsoCivilDate(periodStart),
    periodEnd: formatIsoCivilDate(periodEnd)
  };
}

export type SecondaryProgressedInstant = {
  elapsedRealDays: number;
  tropicalAgeYears: number;
  progressedElapsedDays: number;
  progressedInstantMs: number;
};

export type ProgressedBoundaryRange = {
  earliest: number;
  latest: number;
};

/** Día-por-año con año tropical de 365.242189 días. */
export function secondaryProgressedInstant(
  birthInstantMs: number,
  observedInstantMs: number
): SecondaryProgressedInstant {
  assertFiniteNumber(birthInstantMs, "birthInstantMs");
  assertFiniteNumber(observedInstantMs, "observedInstantMs");
  if (observedInstantMs < birthInstantMs) {
    throw new RangeError("observedInstantMs cannot precede birthInstantMs.");
  }

  const elapsedRealDays = (observedInstantMs - birthInstantMs) / MILLISECONDS_PER_DAY;
  const tropicalAgeYears = elapsedRealDays / TROPICAL_YEAR_DAYS;
  const progressedElapsedDays = tropicalAgeYears;

  return {
    elapsedRealDays,
    tropicalAgeYears,
    progressedElapsedDays,
    progressedInstantMs: birthInstantMs + progressedElapsedDays * MILLISECONDS_PER_DAY
  };
}

/**
 * Convierte una frontera de efemérides progresadas al instante real en que se
 * alcanza para una hora natal concreta. Es la inversa exacta de
 * `secondaryProgressedInstant` para el mismo año tropical.
 */
export function observedInstantForProgressedBoundary(
  birthInstantMs: number,
  progressedBoundaryInstantMs: number,
): number {
  assertFiniteNumber(birthInstantMs, "birthInstantMs");
  assertFiniteNumber(progressedBoundaryInstantMs, "progressedBoundaryInstantMs");
  return (
    birthInstantMs +
    (progressedBoundaryInstantMs - birthInstantMs) * TROPICAL_YEAR_DAYS
  );
}

/**
 * Acota una fecha de cambio progresada para todas las horas natales candidatas.
 * La transformación es lineal, de modo que los extremos civiles bastan para
 * obtener el rango completo; no se elige una hora representativa como verdad.
 */
export function progressedBoundaryRange(
  birthInstantCandidates: readonly number[],
  progressedBoundaryInstantMs: number,
): ProgressedBoundaryRange {
  if (birthInstantCandidates.length === 0) {
    throw new RangeError("birthInstantCandidates cannot be empty.");
  }
  const observedCandidates = birthInstantCandidates.map((birthInstantMs) =>
    observedInstantForProgressedBoundary(birthInstantMs, progressedBoundaryInstantMs),
  );
  return {
    earliest: Math.min(...observedCandidates),
    latest: Math.max(...observedCandidates),
  };
}

export function interpolateLinear(start: number, end: number, fraction: number): number {
  assertFiniteNumber(start, "start");
  assertFiniteNumber(end, "end");
  assertFiniteNumber(fraction, "fraction");
  if (fraction < 0 || fraction > 1) {
    throw new RangeError("Interpolation fraction must be within [0, 1].");
  }
  return start + (end - start) * fraction;
}

/** Interpola por el arco angular más corto, incluido el cruce 359°→0°. */
export function interpolateCircularDegrees(startDegrees: number, endDegrees: number, fraction: number): number {
  const angularStep = interpolateLinear(
    0,
    shortestSignedAngularDelta(startDegrees, endDegrees),
    fraction
  );
  return normalizeDegrees(normalizeDegrees(startDegrees) + angularStep);
}

export type AngularSample = { instantMs: number; angleDegrees: number };

export function interpolateAngularSample(
  start: AngularSample,
  end: AngularSample,
  instantMs: number
): number {
  if (end.instantMs <= start.instantMs) {
    throw new RangeError("Angular samples must be in strictly increasing time order.");
  }
  if (instantMs < start.instantMs || instantMs > end.instantMs) {
    throw new RangeError("Interpolation instant must be inside the sample interval.");
  }
  const fraction = (instantMs - start.instantMs) / (end.instantMs - start.instantMs);
  return interpolateCircularDegrees(start.angleDegrees, end.angleDegrees, fraction);
}

export type BracketedRoot = {
  root: number;
  residual: number;
  iterations: number;
  bracket: readonly [number, number];
};

export function findBracketedRoot(
  evaluate: (value: number) => number,
  lowerBound: number,
  upperBound: number,
  options: { xTolerance?: number; residualTolerance?: number; maxIterations?: number } = {}
): BracketedRoot {
  assertFiniteNumber(lowerBound, "lowerBound");
  assertFiniteNumber(upperBound, "upperBound");
  if (upperBound <= lowerBound) {
    throw new RangeError("Root bracket must be strictly increasing.");
  }

  const xTolerance = options.xTolerance ?? 1e-6;
  const residualTolerance = options.residualTolerance ?? 1e-9;
  const maxIterations = options.maxIterations ?? 100;
  if (
    !Number.isFinite(xTolerance) ||
    !Number.isFinite(residualTolerance) ||
    xTolerance <= 0 ||
    residualTolerance < 0 ||
    !Number.isInteger(maxIterations) ||
    maxIterations < 1
  ) {
    throw new RangeError("Invalid root-search options.");
  }

  let lower = lowerBound;
  let upper = upperBound;
  let lowerResidual = evaluate(lower);
  let upperResidual = evaluate(upper);
  assertFiniteNumber(lowerResidual, "lower residual");
  assertFiniteNumber(upperResidual, "upper residual");

  if (Math.abs(lowerResidual) <= residualTolerance) {
    return { root: lower, residual: lowerResidual, iterations: 0, bracket: [lower, lower] };
  }
  if (Math.abs(upperResidual) <= residualTolerance) {
    return { root: upper, residual: upperResidual, iterations: 0, bracket: [upper, upper] };
  }
  if (Math.sign(lowerResidual) === Math.sign(upperResidual)) {
    throw new RangeError("Root is not bracketed by opposite residual signs.");
  }

  for (let iterations = 1; iterations <= maxIterations; iterations += 1) {
    const midpoint = (lower + upper) / 2;
    const midpointResidual = evaluate(midpoint);
    assertFiniteNumber(midpointResidual, "midpoint residual");

    if (Math.abs(midpointResidual) <= residualTolerance || (upper - lower) / 2 <= xTolerance) {
      return { root: midpoint, residual: midpointResidual, iterations, bracket: [lower, upper] };
    }

    if (Math.sign(midpointResidual) === Math.sign(lowerResidual)) {
      lower = midpoint;
      lowerResidual = midpointResidual;
    } else {
      upper = midpoint;
      upperResidual = midpointResidual;
    }
  }

  const root = (lower + upper) / 2;
  return { root, residual: evaluate(root), iterations: maxIterations, bracket: [lower, upper] };
}

/** Residuo angular firmado de `targetDegrees` hacia `angleDegrees`. */
export function angularTargetResidual(angleDegrees: number, targetDegrees: number): number {
  return shortestSignedAngularDelta(targetDegrees, angleDegrees);
}

/**
 * Refina un cruce angular ya acotado. Los extremos deben rodear el objetivo
 * sobre su arco más corto; así se evita confundir el antípoda con un cruce.
 */
export function findAngularCrossing(args: {
  angleAt: (value: number) => number;
  targetDegrees: number;
  lowerBound: number;
  upperBound: number;
  xTolerance?: number;
  angularToleranceDegrees?: number;
  maxIterations?: number;
}): BracketedRoot {
  const startAngle = normalizeDegrees(args.angleAt(args.lowerBound));
  const endAngle = normalizeDegrees(args.angleAt(args.upperBound));
  const target = normalizeDegrees(args.targetDegrees);
  const travel = shortestSignedAngularDelta(startAngle, endAngle);
  const travelToTarget = shortestSignedAngularDelta(startAngle, target);
  const epsilon = 1e-9;
  const targetAtStart = angularDistanceDegrees(startAngle, target) <= (args.angularToleranceDegrees ?? 1e-8);
  const targetAtEnd = angularDistanceDegrees(endAngle, target) <= (args.angularToleranceDegrees ?? 1e-8);
  const targetIsOnShortestArc =
    targetAtStart ||
    targetAtEnd ||
    (Math.sign(travelToTarget) === Math.sign(travel) && Math.abs(travelToTarget) <= Math.abs(travel) + epsilon);

  if (!targetIsOnShortestArc) {
    throw new RangeError("Angular target is not bracketed on the shortest arc.");
  }

  return findBracketedRoot(
    (value) => angularTargetResidual(args.angleAt(value), target),
    args.lowerBound,
    args.upperBound,
    {
      xTolerance: args.xTolerance,
      residualTolerance: args.angularToleranceDegrees,
      maxIterations: args.maxIterations
    }
  );
}

export function nextLunarPhaseBoundaryDegrees(elongationDegrees: number): number {
  const normalized = normalizeDegrees(elongationDegrees);
  const next = (Math.floor(normalized / LUNAR_PHASE_SPAN_DEGREES) + 1) * LUNAR_PHASE_SPAN_DEGREES;
  return normalizeDegrees(next);
}

export function previousLunarPhaseBoundaryDegrees(elongationDegrees: number): number {
  const normalized = normalizeDegrees(elongationDegrees);
  const onBoundary = Math.abs(normalized % LUNAR_PHASE_SPAN_DEGREES) <= 1e-9;
  const previous = onBoundary
    ? normalized - LUNAR_PHASE_SPAN_DEGREES
    : Math.floor(normalized / LUNAR_PHASE_SPAN_DEGREES) * LUNAR_PHASE_SPAN_DEGREES;
  return normalizeDegrees(previous);
}

export function findLunarPhaseBoundaryCrossing(args: {
  elongationAt: (value: number) => number;
  boundaryDegrees: number;
  lowerBound: number;
  upperBound: number;
  xTolerance?: number;
  angularToleranceDegrees?: number;
}): BracketedRoot {
  const normalizedBoundary = normalizeDegrees(args.boundaryDegrees);
  if (Math.abs(normalizedBoundary % LUNAR_PHASE_SPAN_DEGREES) > 1e-9) {
    throw new RangeError("Lunar phase boundary must be a multiple of 45 degrees.");
  }
  return findAngularCrossing({
    angleAt: args.elongationAt,
    targetDegrees: normalizedBoundary,
    lowerBound: args.lowerBound,
    upperBound: args.upperBound,
    xTolerance: args.xTolerance,
    angularToleranceDegrees: args.angularToleranceDegrees
  });
}

export type PersonalLunationPosition = {
  cycleDegrees: number;
  cycleFraction: number;
  cycleDay: number;
  daysUntilNextCumpleluna: number;
};

/** Posición dentro del ciclo que empieza al repetir la elongación natal. */
export function personalLunationPosition(
  natalElongationDegrees: number,
  currentElongationDegrees: number
): PersonalLunationPosition {
  const cycleDegrees = normalizeDegrees(currentElongationDegrees - natalElongationDegrees);
  const cycleFraction = cycleDegrees / FULL_CIRCLE_DEGREES;
  const cycleDay = cycleFraction * SYNODIC_MONTH_DAYS;
  const daysUntilNextCumpleluna =
    cycleDegrees === 0 ? 0 : (1 - cycleFraction) * SYNODIC_MONTH_DAYS;
  return { cycleDegrees, cycleFraction, cycleDay, daysUntilNextCumpleluna };
}

/** Refina la repetición de la elongación natal dentro de un intervalo acotado. */
export function findCumplelunaCrossing(args: {
  currentElongationAt: (value: number) => number;
  natalElongationDegrees: number;
  lowerBound: number;
  upperBound: number;
  xTolerance?: number;
  angularToleranceDegrees?: number;
}): BracketedRoot {
  return findAngularCrossing({
    angleAt: args.currentElongationAt,
    targetDegrees: args.natalElongationDegrees,
    lowerBound: args.lowerBound,
    upperBound: args.upperBound,
    xTolerance: args.xTolerance,
    angularToleranceDegrees: args.angularToleranceDegrees
  });
}
