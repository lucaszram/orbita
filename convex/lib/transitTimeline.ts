import type { EphemerisPosition } from "./layerContract";
import {
  ACTIVE_TRANSIT_ORB_DEGREES,
  angularDistance,
  declaredArcWindowKey,
  matchMajorAspect,
  type TransitContactInput,
} from "./transitLayers";

const DAY_MS = 86_400_000;
const DEFAULT_MAX_PROVIDER_CALLS = 96;
const DEFAULT_MAX_PASS_GAP_DAYS = 220;
const ROOT_TIME_TOLERANCE_MS = 5 * 60 * 1000;
const ROOT_ANGLE_TOLERANCE_DEGREES = 0.001;
const DUPLICATE_ROOT_TOLERANCE_MS = 6 * 60 * 60 * 1000;
const MAX_SEARCH_RADIUS_DAYS = 2_000;
const MAX_COARSE_INTERVALS = 48;

type TimelineSample = {
  instantMs: number;
  longitude: number;
  speed: number;
  isRetrograde: boolean;
  error: number;
};

export type TransitTimelineEphemerisResult =
  | { status: "success"; positions: readonly EphemerisPosition[] }
  | { status: "error"; reason: string };

export type VerifiedTransitTimeline = {
  status: "verified";
  contacts: TransitContactInput[];
  providerCalls: number;
  targetLongitude: number;
  windowStart: number;
  windowEnd: number;
};

export type TransitTimelineFailure = {
  status:
    | "not_active"
    | "unsupported_planet"
    | "provider_error"
    | "provider_budget_exhausted"
    | "no_exact_contact"
    | "unbounded_window";
  contacts: [];
  providerCalls: number;
  reason: string;
};

export type TransitTimelineResolution = VerifiedTransitTimeline | TransitTimelineFailure;

export type ResolveTransitTimelineArgs = {
  contact: TransitContactInput;
  ephemerisAt: (instantMs: number) => Promise<TransitTimelineEphemerisResult>;
  maxProviderCalls?: number;
  maxPassGapDays?: number;
};

export type TransitTimelineSingleFlight = {
  run: (
    key: string,
    calculate: () => Promise<TransitTimelineResolution>,
  ) => Promise<TransitTimelineResolution>;
};

/**
 * Deduplica barridos idénticos que llegan al mismo runtime. Una operación en
 * curso nunca expira: la retención empieza cuando termina, para que un proveedor
 * lento no habilite un segundo barrido en paralelo. La persistencia horaria de
 * la capa sigue siendo la fuente de idempotencia entre runtimes de Convex.
 */
export function createTransitTimelineSingleFlight(options: {
  retentionMs?: number;
  now?: () => number;
} = {}): TransitTimelineSingleFlight {
  const retentionMs = options.retentionMs ?? 60_000;
  const now = options.now ?? Date.now;
  if (!Number.isFinite(retentionMs) || retentionMs < 0) {
    throw new RangeError("retentionMs must be zero or greater");
  }
  const entries = new Map<
    string,
    { promise: Promise<TransitTimelineResolution>; expiresAt: number | null }
  >();

  return {
    run(key, calculate) {
      const currentTime = now();
      for (const [entryKey, entry] of entries) {
        if (entry.expiresAt !== null && entry.expiresAt <= currentTime) {
          entries.delete(entryKey);
        }
      }
      const existing = entries.get(key);
      if (existing) return existing.promise;

      const promise = Promise.resolve().then(calculate);
      const entry = { promise, expiresAt: null as number | null };
      entries.set(key, entry);
      void promise.then(
        () => {
          if (entries.get(key) === entry) entry.expiresAt = now() + retentionMs;
        },
        () => {
          if (entries.get(key) === entry) entry.expiresAt = now() + retentionMs;
        },
      );
      return promise;
    },
  };
}

const PLANET_ALIASES: Record<string, string> = {
  sol: "sun",
  sun: "sun",
  luna: "moon",
  moon: "moon",
  mercurio: "mercury",
  mercury: "mercury",
  venus: "venus",
  marte: "mars",
  mars: "mars",
  jupiter: "jupiter",
  saturno: "saturn",
  saturn: "saturn",
  urano: "uranus",
  uranus: "uranus",
  neptuno: "neptune",
  neptune: "neptune",
  pluton: "pluto",
  pluto: "pluto",
};

const SEARCH_PROFILE: Record<string, { radiusDays: number; stepDays: number }> = {
  moon: { radiusDays: 2, stepDays: 0.25 },
  sun: { radiusDays: 7, stepDays: 1 },
  mercury: { radiusDays: 90, stepDays: 6 },
  venus: { radiusDays: 180, stepDays: 10 },
  mars: { radiusDays: 300, stepDays: 14 },
  jupiter: { radiusDays: 330, stepDays: 14 },
  saturn: { radiusDays: 330, stepDays: 21 },
  uranus: { radiusDays: 360, stepDays: 28 },
  neptune: { radiusDays: 360, stepDays: 28 },
  pluto: { radiusDays: 360, stepDays: 28 },
};

const ADAPTIVE_RADIUS_PLANETS = new Set(["jupiter", "saturn", "uranus", "neptune", "pluto"]);

class TimelineProviderError extends Error {}
class TimelineBudgetError extends Error {}

function normalizeKey(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function signedDegrees(value: number) {
  const normalized = normalizeDegrees(value);
  return normalized >= 180 ? normalized - 360 : normalized;
}

function transitPlanetKey(value: string) {
  const normalized = normalizeKey(value);
  return PLANET_ALIASES[normalized] ?? normalized;
}

function targetLongitudeFor(contact: TransitContactInput) {
  const match = matchMajorAspect(contact.transitLongitude, contact.natalLongitude);
  if (!match) return null;
  const natal = normalizeDegrees(contact.natalLongitude);
  const candidates =
    match.angle === 0
      ? [natal]
      : match.angle === 180
        ? [normalizeDegrees(natal + 180)]
        : [normalizeDegrees(natal + match.angle), normalizeDegrees(natal - match.angle)];
  return candidates.toSorted(
    (left, right) =>
      angularDistance(contact.transitLongitude, left) -
        angularDistance(contact.transitLongitude, right) ||
      left - right,
  )[0];
}

function uniqueTimes(values: readonly number[]) {
  return [...new Set(values.map((value) => Math.round(value)))].toSorted((left, right) => left - right);
}

function crossing(left: number, right: number) {
  if (Math.abs(left) <= ROOT_ANGLE_TOLERANCE_DEGREES) return true;
  if (Math.abs(right) <= ROOT_ANGLE_TOLERANCE_DEGREES) return true;
  return left * right < 0 && Math.abs(left - right) < 180;
}

function nearestRootCluster(
  roots: readonly TimelineSample[],
  observedAt: number,
  maxPassGapDays: number,
) {
  if (roots.length === 0) return [];
  const ordered = [...roots].toSorted((left, right) => left.instantMs - right.instantMs);
  let nearestIndex = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const candidateDistance = Math.abs(ordered[index].instantMs - observedAt);
    const nearestDistance = Math.abs(ordered[nearestIndex].instantMs - observedAt);
    if (candidateDistance < nearestDistance) nearestIndex = index;
  }
  const maxGapMs = maxPassGapDays * DAY_MS;
  let start = nearestIndex;
  let end = nearestIndex;
  while (start > 0 && ordered[start].instantMs - ordered[start - 1].instantMs <= maxGapMs) start -= 1;
  while (end < ordered.length - 1 && ordered[end + 1].instantMs - ordered[end].instantMs <= maxGapMs) end += 1;
  return ordered.slice(start, end + 1);
}

function failure(
  status: TransitTimelineFailure["status"],
  providerCalls: number,
  reason: string,
): TransitTimelineFailure {
  return { status, contacts: [], providerCalls, reason };
}

/**
 * Verifica la línea temporal del contacto principal contra muestras reales de
 * `planets/tropical`. La grilla es planetaria y acotada; las raíces y los
 * límites del orbe se refinan solicitando efemérides adicionales. Si falta una
 * sola muestra, no publica una cronología como verificada.
 */
export async function resolveVerifiedTransitTimeline(
  args: ResolveTransitTimelineArgs,
): Promise<TransitTimelineResolution> {
  const observedAt =
    args.contact.observedAt instanceof Date
      ? args.contact.observedAt.getTime()
      : typeof args.contact.observedAt === "number"
        ? args.contact.observedAt
        : Date.parse(args.contact.observedAt);
  if (!Number.isFinite(observedAt)) {
    return failure("not_active", 0, "invalid_observed_at");
  }
  const targetLongitude = targetLongitudeFor(args.contact);
  if (targetLongitude === null) {
    return failure("not_active", 0, "contact_is_outside_the_active_orb");
  }
  const planetKey = transitPlanetKey(args.contact.transitPlanet);
  const profile = SEARCH_PROFILE[planetKey];
  if (!profile) {
    return failure("unsupported_planet", 0, `unsupported_transit_planet:${planetKey}`);
  }
  const maxProviderCalls = args.maxProviderCalls ?? DEFAULT_MAX_PROVIDER_CALLS;
  const maxPassGapDays = args.maxPassGapDays ?? DEFAULT_MAX_PASS_GAP_DAYS;
  if (!Number.isFinite(maxProviderCalls) || maxProviderCalls < 1) {
    throw new RangeError("maxProviderCalls must be greater than zero");
  }
  if (!Number.isFinite(maxPassGapDays) || maxPassGapDays < 1) {
    throw new RangeError("maxPassGapDays must be greater than zero");
  }

  let providerCalls = 0;
  const cache = new Map<number, Promise<TimelineSample>>();
  const sampleAt = async (instantMs: number) => {
    const cacheKey = Math.round(instantMs / 60_000) * 60_000;
    const cached = cache.get(cacheKey);
    if (cached) return await cached;
    if (providerCalls >= maxProviderCalls) {
      throw new TimelineBudgetError("transit_timeline_provider_budget_exhausted");
    }
    providerCalls += 1;
    const pending = (async () => {
      const result = await args.ephemerisAt(cacheKey);
      if (result.status !== "success") throw new TimelineProviderError(result.reason);
      const position = result.positions.find((candidate) => candidate.key === planetKey);
      if (!position) throw new TimelineProviderError(`planets_tropical_missing:${planetKey}`);
      return {
        instantMs: cacheKey,
        longitude: normalizeDegrees(position.fullDegree),
        speed: position.speed,
        isRetrograde: position.isRetrograde,
        error: signedDegrees(position.fullDegree - targetLongitude),
      } satisfies TimelineSample;
    })();
    cache.set(cacheKey, pending);
    return await pending;
  };

  const refineCrossing = async (
    initialLeft: TimelineSample,
    initialRight: TimelineSample,
    value: (sample: TimelineSample) => number,
    valueTolerance = ROOT_ANGLE_TOLERANCE_DEGREES,
  ) => {
    let left = initialLeft;
    let right = initialRight;
    let leftValue = value(left);
    let rightValue = value(right);
    let best = Math.abs(leftValue) <= Math.abs(rightValue) ? left : right;
    for (let iteration = 0; iteration < 12; iteration += 1) {
      if (
        Math.abs(value(best)) <= valueTolerance ||
        right.instantMs - left.instantMs <= ROOT_TIME_TOLERANCE_MS
      ) {
        return best;
      }
      const denominator = Math.abs(leftValue) + Math.abs(rightValue);
      const ratio = denominator <= 1e-12 ? 0.5 : Math.abs(leftValue) / denominator;
      const unclamped = left.instantMs + (right.instantMs - left.instantMs) * ratio;
      const margin = Math.min(60_000, (right.instantMs - left.instantMs) / 4);
      const guess = Math.max(left.instantMs + margin, Math.min(right.instantMs - margin, unclamped));
      const middle = await sampleAt(guess);
      const middleValue = value(middle);
      if (Math.abs(middleValue) < Math.abs(value(best))) best = middle;
      if (leftValue === 0) return left;
      if (rightValue === 0) return right;
      if (leftValue * middleValue <= 0) {
        right = middle;
        rightValue = middleValue;
      } else {
        left = middle;
        leftValue = middleValue;
      }
    }
    return best;
  };

  try {
    const currentSpeed = Math.abs(args.contact.transitSpeed ?? 0);
    const adaptiveRadiusDays = ADAPTIVE_RADIUS_PLANETS.has(planetKey)
      ? Math.min(
          MAX_SEARCH_RADIUS_DAYS,
          ((2 * ACTIVE_TRANSIT_ORB_DEGREES) / Math.max(currentSpeed, 0.0025)) * 1.1 +
            maxPassGapDays,
        )
      : profile.radiusDays;
    const radiusDays = Math.max(profile.radiusDays, adaptiveRadiusDays);
    const radiusMs = radiusDays * DAY_MS;
    const stepDays = Math.max(profile.stepDays, (2 * radiusDays) / MAX_COARSE_INTERVALS);
    const stepMs = stepDays * DAY_MS;
    const start = observedAt - radiusMs;
    const end = observedAt + radiusMs;
    const coarseTimes: number[] = [start, observedAt, end];
    for (let instant = start + stepMs; instant < end; instant += stepMs) coarseTimes.push(instant);

    const coarse: TimelineSample[] = [];
    const times = uniqueTimes(coarseTimes);
    for (let index = 0; index < times.length; index += 6) {
      coarse.push(...(await Promise.all(times.slice(index, index + 6).map(sampleAt))));
    }
    coarse.sort((left, right) => left.instantMs - right.instantMs);

    const stationSamples: TimelineSample[] = [];
    for (let index = 0; index < coarse.length - 1; index += 1) {
      const left = coarse[index];
      const right = coarse[index + 1];
      if (
        left.speed === 0 ||
        right.speed === 0 ||
        left.speed * right.speed < 0 ||
        left.isRetrograde !== right.isRetrograde
      ) {
        stationSamples.push(await refineCrossing(left, right, (sample) => sample.speed, 1e-6));
      }
    }

    const scan = [...coarse, ...stationSamples].toSorted(
      (left, right) => left.instantMs - right.instantMs,
    );
    const roots: TimelineSample[] = [];
    for (let index = 0; index < scan.length; index += 1) {
      const current = scan[index];
      if (Math.abs(current.error) <= ROOT_ANGLE_TOLERANCE_DEGREES) roots.push(current);
      const next = scan[index + 1];
      if (!next || !crossing(current.error, next.error)) continue;
      roots.push(await refineCrossing(current, next, (sample) => sample.error));
    }
    const deduplicatedRoots = roots
      .toSorted((left, right) => left.instantMs - right.instantMs)
      .filter(
        (root, index, ordered) =>
          index === 0 || root.instantMs - ordered[index - 1].instantMs > DUPLICATE_ROOT_TOLERANCE_MS,
      );
    const cluster = nearestRootCluster(deduplicatedRoots, observedAt, maxPassGapDays);
    if (cluster.length === 0) {
      return failure("no_exact_contact", providerCalls, "no_verified_aspect_root_in_bounded_window");
    }

    const samples = [...scan, ...deduplicatedRoots].toSorted(
      (left, right) => left.instantMs - right.instantMs,
    );
    const firstRoot = cluster[0];
    const lastRoot = cluster[cluster.length - 1];
    let startBracket: [TimelineSample, TimelineSample] | null = null;
    let cursor = firstRoot;
    for (let index = samples.length - 1; index >= 0; index -= 1) {
      const candidate = samples[index];
      if (candidate.instantMs >= cursor.instantMs) continue;
      const candidateValue = Math.abs(candidate.error) - ACTIVE_TRANSIT_ORB_DEGREES;
      const cursorValue = Math.abs(cursor.error) - ACTIVE_TRANSIT_ORB_DEGREES;
      if (candidateValue > 0 && cursorValue <= 0) {
        startBracket = [candidate, cursor];
        break;
      }
      cursor = candidate;
    }
    let endBracket: [TimelineSample, TimelineSample] | null = null;
    cursor = lastRoot;
    for (const candidate of samples) {
      if (candidate.instantMs <= cursor.instantMs) continue;
      const cursorValue = Math.abs(cursor.error) - ACTIVE_TRANSIT_ORB_DEGREES;
      const candidateValue = Math.abs(candidate.error) - ACTIVE_TRANSIT_ORB_DEGREES;
      if (cursorValue <= 0 && candidateValue > 0) {
        endBracket = [cursor, candidate];
        break;
      }
      cursor = candidate;
    }
    if (!startBracket || !endBracket) {
      return failure("unbounded_window", providerCalls, "active_orb_window_not_closed_inside_search_bounds");
    }

    const windowStartSample = await refineCrossing(
      startBracket[0],
      startBracket[1],
      (sample) => Math.abs(sample.error) - ACTIVE_TRANSIT_ORB_DEGREES,
    );
    const windowEndSample = await refineCrossing(
      endBracket[0],
      endBracket[1],
      (sample) => Math.abs(sample.error) - ACTIVE_TRANSIT_ORB_DEGREES,
    );
    // La ventana lógica del contacto que se pidió verificar, propagada tal cual.
    //
    // Verificar corre los bordes: el borde real cae semanas antes o después del
    // que el ranking extrapoló con la velocidad del día. Sembrar la identidad con
    // ESE borde nuevo —y encima con una marca de procedencia (`verified:…`)—
    // hacía que el mismo proceso tuviera un `arcId` en el ranking y otro en su
    // propio detalle. Lo que cambia al verificar son las FECHAS que se muestran,
    // no la identidad: las tres pasadas de un retrógrado siguen siendo el mismo
    // arco, con el identificador que ya se había publicado.
    //
    // Sólo cuando el contacto no trae ninguna ventana —un instante suelto, sin
    // identidad previa que conservar— la siembra la ventana verificada, que es
    // la medida más estable disponible: no se mueve porque se observe otro día.
    const roundedWindowStart = Math.round(windowStartSample.instantMs / 3_600_000) * 3_600_000;
    const arcWindowKey =
      declaredArcWindowKey(args.contact) ??
      new Date(roundedWindowStart).toISOString().slice(0, 10);
    const contacts = cluster.map(
      (root): TransitContactInput => ({
        ...args.contact,
        contactId: undefined,
        arcWindowKey,
        observedAt,
        exactAt: root.instantMs,
        windowStart: windowStartSample.instantMs,
        windowEnd: windowEndSample.instantMs,
        isRetrograde: root.speed < 0 || root.isRetrograde,
      }),
    );
    return {
      status: "verified",
      contacts,
      providerCalls,
      targetLongitude,
      windowStart: windowStartSample.instantMs,
      windowEnd: windowEndSample.instantMs,
    };
  } catch (error) {
    if (error instanceof TimelineBudgetError) {
      return failure("provider_budget_exhausted", providerCalls, error.message);
    }
    return failure(
      "provider_error",
      providerCalls,
      error instanceof Error ? error.message : "unknown_planets_tropical_timeline_error",
    );
  }
}
