/**
 * Tu momento · Estación vital — la fase de la lunación progresada (CORE-209).
 *
 * Progresiones secundarias: un día de cielo por cada año tropical vivido. La
 * elongación entre el Sol y la Luna progresados recorre ocho fases de 45° en
 * un ciclo de unos 30 años; cada fase dura alrededor de 3,7 años. El método y
 * los umbrales son los de la línea `release/1.0.0` (`progressedLunationBuild`
 * en `convex/layers.ts`), reescritos aquí sobre una función inyectable que
 * devuelve posiciones tropicales, para que la derivación se pueda probar sin
 * red.
 *
 * Qué NO se inventa:
 * - Sin hora exacta, se muestrean tres horas del día natal (00:00, 12:00,
 *   23:59) y sólo se afirma una fase si las tres caen en la misma y lejos de
 *   un límite; si no, `partial` con las fases posibles, nunca una elegida.
 * - Las fechas de inicio y de la próxima fase se refinan buscando el cruce del
 *   límite en muestras reales del proveedor; si no se pueden acotar, el dato
 *   se retira (`unavailable`) en vez de publicar una fecha falsa.
 * - Sin hora exacta, cada fecha viaja con su rango (`*Range`).
 */
import { resolveZonedCivilTime } from "./civilTime";
import {
  findLunarPhaseBoundaryCrossing,
  interpolateCircularDegrees,
  lunarElongationDegrees,
  lunarPhaseAtElongation,
  MILLISECONDS_PER_DAY,
  nextLunarPhaseBoundaryDegrees,
  previousLunarPhaseBoundaryDegrees,
  progressedBoundaryRange,
  secondaryProgressedInstant,
  TROPICAL_YEAR_DAYS,
  type LunarPhaseId
} from "./layersMath";
import type { EphemerisPosition } from "./tropicalEphemeris";

export type EstacionVitalPhaseKey =
  | "new"
  | "crescent"
  | "first_quarter"
  | "gibbous"
  | "full"
  | "disseminating"
  | "last_quarter"
  | "balsamic";

/** Del id geométrico de `layersMath` a la clave editorial (la de `release/1.0.0`). */
export const PHASE_KEY_BY_ID: Record<LunarPhaseId, EstacionVitalPhaseKey> = {
  new: "new",
  waxing_crescent: "crescent",
  first_quarter: "first_quarter",
  waxing_gibbous: "gibbous",
  full: "full",
  waning_gibbous: "disseminating",
  last_quarter: "last_quarter",
  waning_crescent: "balsamic"
};

export const PHASE_NAME: Record<EstacionVitalPhaseKey, string> = {
  new: "Nueva",
  crescent: "Creciente",
  first_quarter: "Cuarto creciente",
  gibbous: "Gibosa",
  full: "Llena",
  disseminating: "Diseminante",
  last_quarter: "Cuarto menguante",
  balsamic: "Balsámica"
};

export type EstacionVitalBirth = {
  birthDate: string;
  birthTime: string | null;
  birthTimePrecision: "known" | "approximate" | "unknown";
  timezone: string;
  latitude?: number | null;
  longitude?: number | null;
};

/** Posiciones tropicales en un instante. Inyectable: la action pasa el proveedor, la prueba un stub. */
export type TropicalAt = (instantMs: number) => Promise<readonly EphemerisPosition[] | null>;

export type EstacionVital =
  | {
      status: "ready";
      /** `exact` con hora natal exacta; `range` cuando cada fecha viaja con su rango. */
      precision: "exact" | "range";
      phaseKey: EstacionVitalPhaseKey;
      phaseIndex: number;
      name: string;
      progressedElongationDegrees: number;
      progressedElongationRangeDegrees?: { from: number; to: number };
      ageYears: number;
      phaseStartedAt: number;
      nextPhaseAt: number;
      phaseStartedAtRange?: { earliest: number; latest: number };
      nextPhaseAtRange?: { earliest: number; latest: number };
      /** Años que dura esta fase según las dos fechas reales. */
      phaseYears: number;
      /** Años transcurridos dentro de la fase. */
      yearsIntoPhase: number;
      /** 0–1 dentro de la fase. */
      progress: number;
      observedAt: number;
      limitations: string[];
    }
  | {
      status: "needs_birth_data" | "needs_birth_time" | "partial" | "unavailable" | "not_configured";
      precision: "not_applicable" | "range";
      missingInputs: string[];
      limitations: string[];
      /** En `partial`: las fases posibles según la hora natal. */
      possiblePhases?: string[];
      observedAt: number;
    };

// Cotas conservadoras de movimiento geocéntrico por día civil, como en release.
const MAX_MOTION_PER_DAY = { sun: 1.25, moon: 17 };
const PHASE_SPAN = 45;

function position(positions: readonly EphemerisPosition[], key: string) {
  return positions.find((p) => p.key === key) ?? null;
}

function normalizedDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function distanceToPeriodicBoundary(value: number, interval: number) {
  const within = normalizedDegrees(value) % interval;
  return Math.min(within, interval - within);
}

function segmentMotionMargin(key: "sun" | "moon", instants: readonly number[], index: number, speeds: readonly number[]) {
  const durationDays = Math.abs(instants[index + 1] - instants[index]) / MILLISECONDS_PER_DAY;
  const observedBound = Math.max(0, ...[speeds[index], speeds[index + 1]].filter((s) => Number.isFinite(s)).map((s) => Math.abs(s) * 1.25));
  return Math.max(MAX_MOTION_PER_DAY[key], observedBound) * durationDays;
}

/** ¿Las tres muestras del día natal certifican una sola fase, lejos de sus límites? */
export function certifiesSingleLunarPhase(samples: {
  instants: readonly number[];
  sun: readonly number[];
  moon: readonly number[];
  sunSpeed: readonly number[];
  moonSpeed: readonly number[];
}) {
  if (samples.sun.length < 3 || samples.moon.length < 3 || samples.instants.length !== samples.sun.length) return false;
  const elongations = samples.moon.map((moon, i) => lunarElongationDegrees(samples.sun[i], moon));
  const phases = new Set(elongations.map((e) => lunarPhaseAtElongation(e).index));
  if (phases.size !== 1) return false;
  for (let i = 0; i < elongations.length - 1; i += 1) {
    const margin =
      segmentMotionMargin("sun", samples.instants, i, samples.sunSpeed) + segmentMotionMargin("moon", samples.instants, i, samples.moonSpeed);
    if (distanceToPeriodicBoundary(elongations[i], PHASE_SPAN) <= margin || distanceToPeriodicBoundary(elongations[i + 1], PHASE_SPAN) <= margin) {
      return false;
    }
  }
  return true;
}

function elongationInterpolator(
  lower: { instantMs: number; positions: readonly EphemerisPosition[] },
  upper: { instantMs: number; positions: readonly EphemerisPosition[] }
) {
  const ls = position(lower.positions, "sun");
  const lm = position(lower.positions, "moon");
  const us = position(upper.positions, "sun");
  const um = position(upper.positions, "moon");
  if (!ls || !lm || !us || !um || upper.instantMs <= lower.instantMs) return null;
  return (instantMs: number) => {
    const fraction = (instantMs - lower.instantMs) / (upper.instantMs - lower.instantMs);
    return lunarElongationDegrees(
      interpolateCircularDegrees(ls.fullDegree, us.fullDegree, fraction),
      interpolateCircularDegrees(lm.fullDegree, um.fullDegree, fraction)
    );
  };
}

/** Refina el cruce de un límite de fase alrededor de `centerMs` con dos muestras reales. */
async function boundaryRoot(tropicalAt: TropicalAt, centerMs: number, radiusDays: number, boundaryDegrees: number) {
  const lowerMs = centerMs - radiusDays * MILLISECONDS_PER_DAY;
  const upperMs = centerMs + radiusDays * MILLISECONDS_PER_DAY;
  const [lower, upper] = await Promise.all([tropicalAt(lowerMs), tropicalAt(upperMs)]);
  if (!lower || !upper) return null;
  const elongationAt = elongationInterpolator({ instantMs: lowerMs, positions: lower }, { instantMs: upperMs, positions: upper });
  if (!elongationAt) return null;
  try {
    return findLunarPhaseBoundaryCrossing({
      elongationAt,
      boundaryDegrees,
      lowerBound: lowerMs,
      upperBound: upperMs,
      xTolerance: 1_000,
      angularToleranceDegrees: 1e-4
    }).root;
  } catch {
    return null;
  }
}

function fail(
  status: Exclude<EstacionVital, { status: "ready" }>["status"],
  precision: "not_applicable" | "range",
  missingInputs: string[],
  limitations: string[],
  observedAt: number,
  possiblePhases?: string[]
): EstacionVital {
  return { status, precision, missingInputs, limitations, observedAt, ...(possiblePhases ? { possiblePhases } : {}) };
}

export async function buildEstacionVital(args: {
  birth: EstacionVitalBirth | null;
  observedAt: number;
  tropicalAt: TropicalAt;
  /** Si el proveedor no está configurado, el llamador lo sabe antes de muestrear. */
  providerConfigured?: boolean;
}): Promise<EstacionVital> {
  const { observedAt } = args;
  if (!args.birth) {
    return fail("needs_birth_data", "not_applicable", ["birth_data"], ["Para ubicar tu estación vital hace falta tu fecha de nacimiento."], observedAt);
  }
  if (args.providerConfigured === false) {
    return fail("not_configured", "not_applicable", ["ephemeris_provider"], ["El proveedor de efemérides no está configurado en este entorno."], observedAt);
  }
  const birth = args.birth;
  const known = birth.birthTimePrecision === "known";
  const times = known ? (birth.birthTime ? [birth.birthTime] : []) : ["00:00", "12:00", "23:59"];
  if (times.length === 0) {
    return fail("needs_birth_time", "not_applicable", ["exact_birth_time"], ["La hora figura como exacta, pero no tiene un valor utilizable."], observedAt);
  }
  const resolutions = times.map((localTime) => resolveZonedCivilTime({ localDate: birth.birthDate, localTime, timezone: birth.timezone }));
  if (resolutions.some((r) => r.status !== "exact")) {
    return fail(
      known ? "unavailable" : "partial",
      known ? "not_applicable" : "range",
      [known ? "resolvable_birth_time" : "resolvable_birth_day_interval"],
      [
        known
          ? "La hora cargada coincide con un cambio de horario en el que ese momento no existió o ocurrió dos veces. No elegimos una de las dos posibilidades sin respaldo."
          : "Durante tu día de nacimiento hubo un cambio de horario que deja una franja ambigua. Sin hora exacta no elegimos un momento arbitrario."
      ],
      observedAt
    );
  }
  const birthInstants = resolutions.map((r) => (r.status === "exact" ? r.instantMs : Number.NaN));
  let progressed: ReturnType<typeof secondaryProgressedInstant>[];
  try {
    progressed = birthInstants.map((b) => secondaryProgressedInstant(b, observedAt));
  } catch {
    return fail("unavailable", "not_applicable", ["valid_birth_instant"], ["La fecha de observación no puede ser anterior al nacimiento."], observedAt);
  }
  const responses = await Promise.all(progressed.map((p) => args.tropicalAt(p.progressedInstantMs)));
  if (responses.some((r) => !r)) {
    return fail("unavailable", "not_applicable", ["progressed_ephemeris"], ["No pudimos obtener las posiciones del Sol y la Luna necesarias para calcular tu estación vital."], observedAt);
  }
  const samples = responses.map((positions, i) => ({
    progressed: progressed[i],
    sun: position(positions as readonly EphemerisPosition[], "sun"),
    moon: position(positions as readonly EphemerisPosition[], "moon")
  }));
  if (samples.some((s) => !s.sun || !s.moon)) {
    return fail("unavailable", "not_applicable", ["progressed_sun_and_moon"], ["Faltan las posiciones del Sol o la Luna necesarias para este cálculo."], observedAt);
  }
  const elongations = samples.map((s) => lunarElongationDegrees(s.sun!.fullDegree, s.moon!.fullDegree));
  if (
    !known &&
    !certifiesSingleLunarPhase({
      instants: samples.map((s) => s.progressed.progressedInstantMs),
      sun: samples.map((s) => s.sun!.fullDegree),
      moon: samples.map((s) => s.moon!.fullDegree),
      sunSpeed: samples.map((s) => s.sun!.speed),
      moonSpeed: samples.map((s) => s.moon!.speed)
    })
  ) {
    const possible = Array.from(new Set(elongations.map((e) => PHASE_NAME[PHASE_KEY_BY_ID[lunarPhaseAtElongation(e).id]])));
    return fail(
      "partial",
      "range",
      ["exact_birth_time_or_certified_progressed_phase"],
      [
        possible.length > 1
          ? `La fase de tu estación vital puede ser ${possible.join(" o ")} según la hora de nacimiento. Conservamos ambas posibilidades en vez de elegir una.`
          : "Tu estación vital queda demasiado cerca de un cambio de fase durante el día de nacimiento. No mostramos una sola fase hasta contar con una hora exacta.",
        ...(birth.birthTimePrecision === "approximate" ? ["La hora aproximada no declara un margen verificable y por eso se trató como desconocida."] : [])
      ],
      observedAt,
      possible
    );
  }
  const idx = Math.floor(samples.length / 2);
  const rep = samples[idx];
  const elongation = elongations[idx];
  const phase = lunarPhaseAtElongation(elongation);
  const relativeSpeeds = samples.map((s) => s.moon!.speed - s.sun!.speed);
  const direction = Math.sign(relativeSpeeds[idx]);
  if (relativeSpeeds.some((v) => !Number.isFinite(v) || Math.abs(v) < 0.1 || Math.sign(v) !== direction)) {
    return fail("unavailable", "not_applicable", ["progressed_relative_speed"], ["El movimiento disponible no alcanza para confirmar con seguridad cuándo empezó y cuándo termina esta fase."], observedAt);
  }
  const relativeSpeed = relativeSpeeds[idx];
  const startBoundary = previousLunarPhaseBoundaryDegrees(elongation);
  const nextBoundary = nextLunarPhaseBoundaryDegrees(elongation);
  const backDegrees = direction >= 0 ? normalizedDegrees(elongation - startBoundary) : normalizedDegrees(startBoundary - elongation);
  const nextDegrees = direction >= 0 ? normalizedDegrees(nextBoundary - elongation) : normalizedDegrees(elongation - nextBoundary);
  const pastCenter = rep.progressed.progressedInstantMs - (backDegrees / Math.abs(relativeSpeed)) * MILLISECONDS_PER_DAY;
  const futureCenter = rep.progressed.progressedInstantMs + (nextDegrees / Math.abs(relativeSpeed)) * MILLISECONDS_PER_DAY;
  const [previousRoot, nextRoot] = await Promise.all([
    boundaryRoot(args.tropicalAt, pastCenter, 0.75, phase.startDegrees),
    boundaryRoot(args.tropicalAt, futureCenter, 0.75, phase.endDegrees % 360)
  ]);
  if (previousRoot === null || nextRoot === null) {
    return fail("unavailable", "not_applicable", ["progressed_phase_roots"], ["No pudimos confirmar con precisión las fechas de inicio y cierre de esta fase de la estación vital."], observedAt);
  }
  const startRange = progressedBoundaryRange(birthInstants, previousRoot);
  const nextRange = progressedBoundaryRange(birthInstants, nextRoot);
  const phaseStartedAt = (startRange.earliest + startRange.latest) / 2;
  const nextPhaseAt = (nextRange.earliest + nextRange.latest) / 2;
  if (startRange.latest > observedAt || nextRange.earliest < observedAt || nextPhaseAt <= phaseStartedAt) {
    return fail("partial", "range", ["certified_progressed_phase_window"], ["Las fechas posibles no encierran de forma consistente el momento actual. La etapa se retira en vez de mostrar una fecha falsa."], observedAt);
  }
  const yearMs = TROPICAL_YEAR_DAYS * MILLISECONDS_PER_DAY;
  const phaseKey = PHASE_KEY_BY_ID[phase.id];
  const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    status: "ready",
    precision: known ? "exact" : "range",
    phaseKey,
    phaseIndex: phase.index,
    name: PHASE_NAME[phaseKey],
    progressedElongationDegrees: round(elongation, 4),
    ...(known ? {} : { progressedElongationRangeDegrees: { from: round(Math.min(...elongations), 4), to: round(Math.max(...elongations), 4) } }),
    ageYears: round(rep.progressed.tropicalAgeYears, 4),
    phaseStartedAt,
    nextPhaseAt,
    ...(known ? {} : { phaseStartedAtRange: startRange, nextPhaseAtRange: nextRange }),
    phaseYears: round((nextPhaseAt - phaseStartedAt) / yearMs, 2),
    yearsIntoPhase: round((observedAt - phaseStartedAt) / yearMs, 2),
    progress: round(Math.max(0, Math.min(1, (observedAt - phaseStartedAt) / (nextPhaseAt - phaseStartedAt))), 6),
    observedAt,
    limitations: known
      ? ["Es un período de desarrollo de varios años, no una predicción de acontecimientos."]
      : [
          "Sin hora exacta de nacimiento, las fechas de inicio y de la próxima fase se muestran como rango.",
          "Es un período de desarrollo de varios años, no una predicción de acontecimientos."
        ]
  };
}
