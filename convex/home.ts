import {
  actionGeneric as action,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  mutationGeneric as mutation,
  queryGeneric as query
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { resolveCanonicalDailyContext } from "./daily";
import { getTimezoneOffsetHours } from "./lib/astrologyApi";
import {
  buildDailyReadingPayload,
  CHART_CALCULATION_VERSION,
  DAILY_READING_CONTENT_VERSION,
  extractNormalizedChartFromPayload,
  houseThemes,
  normalizeBirthTime
} from "./lib/orbita";
import {
  belongsToNatalChart,
  dailyReadingNeedsRefresh,
  findCurrentBirthData,
  findExactNatalChart
} from "./lib/birthDataConsistency";
import { findUserByTokenIdentifier, omitUndefined, requireUser } from "./lib/users";

const internalApi = internal as any;

type DailyReadingDoc = {
  _id: string;
  localDate: string;
  timezone: string;
  natalChartId?: string;
  contentVersion: string;
  payload: any;
  createdAt: number;
};

const FALLBACK_MODEL_GAPS = ["astrologyapi_credentials_not_configured", "daily_transits_require_real_provider"];

function ensureThreeItems(items: unknown, fallback: string): string[] {
  const values = Array.isArray(items)
    ? items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return [values[0] ?? fallback, values[1] ?? fallback, values[2] ?? fallback];
}

function toDailyHomeReading(reading: DailyReadingDoc) {
  const payload = reading.payload ?? {};
  const home = payload.home ?? payload.modules ?? {};
  const chartProfile = payload.chartProfile ?? {};
  const highlightedTransit = payload.transits?.highlighted ?? payload.highlightedTransit ?? null;
  const personalization = payload.personalization ?? {
    status: "maqueta_no_personalizada_completa",
    mode: payload.mode ?? "demo_without_provider",
    source: "stub_fallback",
    explanation: "Esta salida es maqueta editorial hasta que haya proveedor y revisión.",
    basedOn: [],
    missing: FALLBACK_MODEL_GAPS,
    confidence: "baja_maqueta"
  };
  const modelGaps = Array.from(
    new Set([
      ...(Array.isArray(payload.modelGaps) ? payload.modelGaps : []),
      ...(Array.isArray(personalization.missing) ? personalization.missing : [])
    ])
  );
  const safeModelGaps = modelGaps.length > 0 ? modelGaps : FALLBACK_MODEL_GAPS;

  return {
    readingId: reading._id,
    localDate: payload.localDate ?? reading.localDate,
    timezone: payload.timezone ?? reading.timezone,
    header: {
      localDate: payload.localDate ?? reading.localDate,
      timezone: payload.timezone ?? reading.timezone,
      greeting: "Tu guía diaria",
      headline: home.headline ?? "Tu cielo de hoy pide una lectura simple.",
      subheadline: home.subheadline ?? "Contexto diario para mirarte con más claridad."
    },
    natalBase: {
      sun: payload.natalSummary?.sun ?? chartProfile.triad?.[0] ?? null,
      moon: payload.natalSummary?.moon ?? chartProfile.triad?.[1] ?? null,
      ascendant: payload.natalSummary?.ascendant ?? chartProfile.triad?.[2] ?? null,
      accuracy: payload.natalSummary?.accuracy ?? chartProfile.accuracy ?? "pending",
      limitations: chartProfile.limitations ?? []
    },
    highlightedTransit,
    modules: {
      do: ensureThreeItems(home.doList, home.do ?? "Elegí una acción chica y concreta."),
      avoid: ensureThreeItems(home.avoidList, home.avoid ?? "Leer el día como predicción cerrada."),
      energy: home.energy ?? "Contexto diario en modo maqueta.",
      action: home.action ?? "Anotá una pregunta simple antes de responder en automático.",
      question: home.question ?? "¿Qué dato simple estás pasando por alto?"
    },
    topics: Array.isArray(payload.topics) ? payload.topics : [],
    longRead: payload.longRead
      ? {
          title: payload.longRead.dailyTitle ?? payload.longRead.title,
          body: payload.longRead.body,
          sections: payload.longRead.sections,
          lockedForPlus: payload.longRead.access === "plus"
        }
      : null,
    void: payload.voidPreview ?? null,
    personalization,
    modelGaps: safeModelGaps,
    reviewStatus: payload.reviewStatus ?? "needs_review",
    contentVersion: payload.contentVersion ?? reading.contentVersion,
    calculationVersion: payload.calculationVersion ?? CHART_CALCULATION_VERSION,
    mode: payload.mode ?? "demo_without_provider",
    createdAt: reading.createdAt
  };
}

export const getDaily = query({
  args: {
    localDate: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const user = identity ? await findUserByTokenIdentifier(ctx, identity.tokenIdentifier) : null;
    if (!user) {
      return null;
    }

    const reading = await ctx.db
      .query("dailyReadings")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();
    const birthData = await findCurrentBirthData(ctx, user._id);
    const natalChart = await findExactNatalChart(ctx, user._id, birthData);

    return belongsToNatalChart(reading, natalChart) ? toDailyHomeReading(reading) : null;
  }
});

export const generateDaily = mutation({
  args: {
    localDate: v.string(),
    timezone: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("dailyReadings")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();

    const birthData = await findCurrentBirthData(ctx, user._id);
    const chart = await findExactNatalChart(ctx, user._id, birthData);
    if (
      existing &&
      !dailyReadingNeedsRefresh(existing, chart?._id, args.timezone, DAILY_READING_CONTENT_VERSION)
    ) {
      return toDailyHomeReading(existing);
    }

    const payload = {
      ...buildDailyReadingPayload({
        localDate: args.localDate,
        timezone: args.timezone,
        chart: chart?.payload ?? null
      }),
      modelGaps: chart ? FALLBACK_MODEL_GAPS : ["birth_data_or_chart_missing", ...FALLBACK_MODEL_GAPS],
      reviewStatus: "needs_review"
    };

    const fields = omitUndefined({
      userId: user._id,
      localDate: args.localDate,
      timezone: args.timezone,
      natalChartId: chart?._id,
      contentVersion: DAILY_READING_CONTENT_VERSION,
      payload,
      updatedAt: Date.now()
    });
    const readingId = existing?._id ?? (await ctx.db.insert("dailyReadings", { ...fields, createdAt: Date.now() }));
    if (existing) await ctx.db.patch(existing._id, fields);

    const reading = await ctx.db.get(readingId);
    return toDailyHomeReading(reading);
  }
});

// ===========================================================================
// CORE-192 — La Luna de hoy sobre la carta natal
// ===========================================================================
//
// Mide la Luna de hoy contra la carta natal ya calculada y publica los dos
// datos que CORE-191 necesita para armar los módulos reales de la Home:
//
//   · LA LUNA EN TU CARTA — por qué casa natal pasa hoy la Luna y con qué tema.
//   · CUMPLELUNA — cuándo vuelve a repetirse la distancia Sol→Luna que había
//     en el nacimiento (el "ciclo lunar personal").
//
// Alcance deliberadamente chico: acá vive SÓLO la matemática y el contrato.
// Nada de UI, nada de LLM, nada del stack completo de capas del build 30.
//
// Honestidad del dato (guardrail de `AGENTS.md`): ningún instante se publica
// como exacto. El Cumpleluna se estima propagando la elongación por movimiento
// medio y SIEMPRE viaja con su ventana; la casa y el signo se publican con las
// casas/signos que la Luna recorre durante el día civil, para no afirmar "hoy
// la Luna pasa por tu casa 5" cuando a media tarde ya entró en la 6.

export const LUNA_SOBRE_LA_CARTA_METHOD_VERSION = "luna-sobre-la-carta-v1";
/** Clave del caché global del cielo. Cambiarla invalida las filas anteriores. */
export const LUNA_SOBRE_LA_CARTA_PROVIDER_VERSION = "astrologyapi-planets-tropical-luna-carta-v1";

const FULL_CIRCLE_DEGREES = 360;
const LUNAR_PHASE_SPAN_DEGREES = 45;
const MILLISECONDS_PER_DAY = 86_400_000;
const MILLISECONDS_PER_HOUR = 3_600_000;

/** Mes sinódico medio (días). Es el promedio, no la duración de un ciclo real. */
export const SYNODIC_MONTH_DAYS = 29.530588853;
/** Velocidad media de la elongación Sol→Luna: 360° / mes sinódico ≈ 12.19 °/día. */
export const MEAN_ELONGATION_RATE_DEGREES_PER_DAY = FULL_CIRCLE_DEGREES / SYNODIC_MONTH_DAYS;
/**
 * Extremos reales de esa velocidad. La Luna recorre entre ~11.8 y ~15.4 °/día y
 * el Sol entre ~0.95 y ~1.02 °/día, así que la elongación nunca avanza menos de
 * ~10.7 ni más de ~14.6 °/día. Son cotas duras: sirven para acotar un arco corto
 * sin suponer nada sobre la forma de la órbita.
 */
const MIN_ELONGATION_RATE_DEGREES_PER_DAY = 10.7;
const MAX_ELONGATION_RATE_DEGREES_PER_DAY = 14.6;
/**
 * Amplitud combinada de la ecuación del centro (Luna ±6.29°, Sol ±1.92°): es
 * cuánto se puede adelantar o atrasar la elongación real respecto del
 * movimiento medio en un extremo del intervalo. Sobre un arco largo acota el
 * error de la propagación mejor que las velocidades extremas, que ahí darían
 * una ventana absurda (23 a 33 días para un ciclo completo).
 */
const ELONGATION_EQUATION_OF_CENTRE_DEGREES = 6.29 + 1.92;
/**
 * Sin hora exacta la carta se calcula al mediodía, así que la elongación natal
 * sólo se conoce dentro del día de nacimiento: media jornada a velocidad máxima.
 */
export const NATAL_HALF_DAY_ELONGATION_DEGREES = MAX_ELONGATION_RATE_DEGREES_PER_DAY / 2;

// ---------------------------------------------------------------------------
// Matemática pura (sin Convex, sin proveedor, sin copy)
// ---------------------------------------------------------------------------

export type LunarPhaseKey =
  | "new"
  | "waxing_crescent"
  | "first_quarter"
  | "waxing_gibbous"
  | "full"
  | "waning_gibbous"
  | "last_quarter"
  | "waning_crescent";

const LUNAR_PHASES: ReadonlyArray<{ key: LunarPhaseKey; name: string }> = [
  { key: "new", name: "Luna nueva" },
  { key: "waxing_crescent", name: "Creciente" },
  { key: "first_quarter", name: "Cuarto creciente" },
  { key: "waxing_gibbous", name: "Gibosa creciente" },
  { key: "full", name: "Luna llena" },
  { key: "waning_gibbous", name: "Gibosa menguante" },
  { key: "last_quarter", name: "Cuarto menguante" },
  { key: "waning_crescent", name: "Menguante" }
];

const ZODIAC_SIGNS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "aries", label: "Aries" },
  { key: "taurus", label: "Tauro" },
  { key: "gemini", label: "Géminis" },
  { key: "cancer", label: "Cáncer" },
  { key: "leo", label: "Leo" },
  { key: "virgo", label: "Virgo" },
  { key: "libra", label: "Libra" },
  { key: "scorpio", label: "Escorpio" },
  { key: "sagittarius", label: "Sagitario" },
  { key: "capricorn", label: "Capricornio" },
  { key: "aquarius", label: "Acuario" },
  { key: "pisces", label: "Piscis" }
];

/**
 * Ángulo en el intervalo semiabierto [0, 360). Tira si no es finito.
 *
 * El idiom habitual —`((v % 360) + 360) % 360`— NO se usa a propósito: para un
 * valor que ya está en rango, sumar 360 y volver a restarlo pierde bits bajos y
 * devuelve un número *parecido*, no el mismo. Con eso, un grado que cae justo
 * sobre una cúspide se resuelve a la casa anterior. Acá el camino corto es la
 * identidad y sólo se corrige el signo.
 */
export function normalizeDegrees(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("degrees must be a finite number.");
  }
  const remainder = value % FULL_CIRCLE_DEGREES;
  // `remainder === 0` también atrapa `-0`, que no puede escaparse como ángulo.
  if (remainder >= 0) return remainder === 0 ? 0 : remainder;
  const shifted = remainder + FULL_CIRCLE_DEGREES;
  // Un negativo minúsculo redondea a 360 exacto al sumarle la vuelta completa.
  return shifted >= FULL_CIRCLE_DEGREES ? 0 : shifted;
}

/** Elongación geocéntrica Sol→Luna, en [0, 360). 0° es Luna nueva, 180° llena. */
export function lunarElongationDegrees(sunLongitudeDegrees: number, moonLongitudeDegrees: number): number {
  return normalizeDegrees(moonLongitudeDegrees - sunLongitudeDegrees);
}

/** Fracción iluminada idealizada del disco, en [0, 1]. */
export function lunarIlluminationFraction(elongationDegrees: number): number {
  const radians = (normalizeDegrees(elongationDegrees) * Math.PI) / 180;
  return (1 - Math.cos(radians)) / 2;
}

/** Ocho sectores consecutivos de 45° arrancando en 0°: 90°..<135° es cuarto creciente. */
export function lunarPhaseAtElongation(elongationDegrees: number): {
  key: LunarPhaseKey;
  name: string;
  index: number;
} {
  const normalized = normalizeDegrees(elongationDegrees);
  const index = Math.floor(normalized / LUNAR_PHASE_SPAN_DEGREES);
  return { ...LUNAR_PHASES[index], index };
}

/** Signo tropical por longitud eclíptica. La longitud manda: el nombre que
 *  mande el proveedor es sólo una etiqueta y puede venir en cualquier idioma. */
export function signAtLongitude(longitudeDegrees: number): {
  key: string;
  label: string;
  index: number;
  degreeInSign: number;
} {
  const normalized = normalizeDegrees(longitudeDegrees);
  const index = Math.floor(normalized / 30);
  return { ...ZODIAC_SIGNS[index], index, degreeInSign: normalized - index * 30 };
}

export type NatalHouseHit = { house: number; cuspDegree: number; theme: string };

/**
 * Un número finito de verdad, o nada.
 *
 * `Number()` NO sirve para leer la carta guardada: `Number(null)` es 0 y
 * `Number("")` también, así que un campo ausente se convertiría en una cúspide
 * —o en una luminaria natal— clavada en 0° de Aries, sin que nada falle.
 * `NormalizedAstroHouse.degree` y `NormalizedAstroPlacement.fullDegree` son
 * `number | null` por contrato, así que el caso no es hipotético.
 */
function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Casa natal que contiene una longitud. Exige las doce cúspides completas y sin
 * repetir: con una carta parcial devuelve `null` en lugar de adivinar.
 *
 * Una cúspide pertenece a su propia casa; el sector llega hasta la cúspide
 * siguiente sin incluirla. El cruce 359°→0° sale gratis porque las distancias
 * se miden normalizadas.
 */
export function houseAtLongitude(
  houses: ReadonlyArray<{ house?: unknown; degree?: unknown; theme?: unknown }> | null | undefined,
  longitudeDegrees: number
): NatalHouseHit | null {
  const entries: ReadonlyArray<{ house?: unknown; degree?: unknown; theme?: unknown }> = houses ?? [];
  const ordered = entries
    .map((entry): NatalHouseHit | null => {
      const record = asPlainRecord(entry) ?? {};
      const house = finiteNumberOrNull(record.house);
      const cuspDegree = finiteNumberOrNull(record.degree);
      // Una cúspide incompleta se descarta acá y abajo se exigen las doce: así
      // una carta a la que le falta un grado devuelve `null`, en vez de ubicar
      // la Luna dentro de un sector que arranca en un 0° inventado.
      if (house === null || !Number.isInteger(house) || house < 1 || house > 12 || cuspDegree === null) {
        return null;
      }
      const theme = record.theme;
      return {
        house,
        cuspDegree,
        theme: typeof theme === "string" && theme.trim() ? theme.trim() : ""
      };
    })
    .filter((house): house is NatalHouseHit => house !== null)
    .sort((left, right) => left.house - right.house);

  if (ordered.length !== 12 || new Set(ordered.map((house) => house.house)).size !== 12) {
    return null;
  }

  const target = normalizeDegrees(longitudeDegrees);
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const next = ordered[(index + 1) % ordered.length];
    const span = normalizeDegrees(next.cuspDegree - current.cuspDegree);
    const offset = normalizeDegrees(target - current.cuspDegree);
    if (span > 0 && offset < span) {
      return {
        house: current.house,
        cuspDegree: normalizeDegrees(current.cuspDegree),
        theme: current.theme || houseThemes[current.house] || "área de vida"
      };
    }
  }
  return null;
}

/** Posición dentro del ciclo personal que empieza cuando se repite la elongación natal. */
export function personalLunationPosition(
  natalElongationDegrees: number,
  currentElongationDegrees: number
): { cycleDegrees: number; remainingDegrees: number; cycleFraction: number } {
  const cycleDegrees = normalizeDegrees(currentElongationDegrees - natalElongationDegrees);
  return {
    cycleDegrees,
    remainingDegrees: cycleDegrees === 0 ? 0 : FULL_CIRCLE_DEGREES - cycleDegrees,
    cycleFraction: cycleDegrees / FULL_CIRCLE_DEGREES
  };
}

/**
 * Cuánto tarda la elongación en recorrer `arcDegrees`, con su ventana.
 *
 * El punto es el movimiento medio; la ventana es la intersección de dos cotas
 * honestas: las velocidades extremas (mandan en arcos cortos, donde son casi
 * ajustadas) y la ecuación del centro (manda en arcos largos, donde las
 * velocidades extremas darían un rango inservible). El punto siempre queda
 * adentro de la ventana.
 */
export function elongationTravelDays(arcDegrees: number): {
  days: number;
  window: { from: number; to: number };
} {
  const arc = Math.min(FULL_CIRCLE_DEGREES, Math.max(0, arcDegrees));
  if (!Number.isFinite(arc)) {
    throw new RangeError("arcDegrees must be a finite number.");
  }
  const days = arc / MEAN_ELONGATION_RATE_DEGREES_PER_DAY;
  const drift = (2 * ELONGATION_EQUATION_OF_CENTRE_DEGREES) / MEAN_ELONGATION_RATE_DEGREES_PER_DAY;
  return {
    days,
    window: {
      from: Math.max(0, arc / MAX_ELONGATION_RATE_DEGREES_PER_DAY, days - drift),
      to: Math.min(arc / MIN_ELONGATION_RATE_DEGREES_PER_DAY, days + drift)
    }
  };
}

export type CumplelunaTiming = {
  cycleDegrees: number;
  cycleFraction: number;
  cycleDay: number;
  cycleDayWindowDays: { from: number; to: number };
  cycleLengthDays: number;
  daysRemaining: number;
  daysRemainingWindowDays: { from: number; to: number };
  previousExactAt: number;
  previousExactAtWindow: { earliest: number; latest: number };
  nextExactAt: number;
  nextExactAtWindow: { earliest: number; latest: number };
};

/**
 * Cumpleluna estimado. `natalElongationToleranceDegrees` es cuánto puede valer
 * de más o de menos la elongación natal (0 con hora exacta): ensancha la
 * ventana en vez de esconder la duda.
 */
export function estimateCumplelunaTiming(args: {
  observedAt: number;
  natalElongationDegrees: number;
  currentElongationDegrees: number;
  natalElongationToleranceDegrees?: number;
}): CumplelunaTiming {
  if (!Number.isFinite(args.observedAt)) {
    throw new RangeError("observedAt must be a finite timestamp.");
  }
  const tolerance = Math.max(0, args.natalElongationToleranceDegrees ?? 0);
  const position = personalLunationPosition(args.natalElongationDegrees, args.currentElongationDegrees);

  // Se recorta en [0, 360] en vez de envolver: si la tolerancia cruza el cero,
  // lo honesto es decir "puede estar pasando ahora", no saltar al ciclo vecino.
  const elapsed = elongationTravelDays(position.cycleDegrees);
  const elapsedLow = elongationTravelDays(position.cycleDegrees - tolerance);
  const elapsedHigh = elongationTravelDays(position.cycleDegrees + tolerance);
  const remaining = elongationTravelDays(position.remainingDegrees);
  const remainingLow = elongationTravelDays(position.remainingDegrees - tolerance);
  const remainingHigh = elongationTravelDays(position.remainingDegrees + tolerance);

  const cycleDayWindowDays = { from: elapsedLow.window.from, to: elapsedHigh.window.to };
  const daysRemainingWindowDays = { from: remainingLow.window.from, to: remainingHigh.window.to };

  return {
    cycleDegrees: position.cycleDegrees,
    cycleFraction: position.cycleFraction,
    cycleDay: elapsed.days,
    cycleDayWindowDays,
    // Recorrido + pendiente cubren siempre los 360° del ciclo, así que el largo
    // es el mes sinódico medio. Se publica para que la UI pueda dibujar el
    // avance sin volver a inventarse una duración.
    cycleLengthDays: SYNODIC_MONTH_DAYS,
    daysRemaining: remaining.days,
    daysRemainingWindowDays,
    previousExactAt: args.observedAt - elapsed.days * MILLISECONDS_PER_DAY,
    previousExactAtWindow: {
      earliest: args.observedAt - cycleDayWindowDays.to * MILLISECONDS_PER_DAY,
      latest: args.observedAt - cycleDayWindowDays.from * MILLISECONDS_PER_DAY
    },
    nextExactAt: args.observedAt + remaining.days * MILLISECONDS_PER_DAY,
    nextExactAtWindow: {
      earliest: args.observedAt + daysRemainingWindowDays.from * MILLISECONDS_PER_DAY,
      latest: args.observedAt + daysRemainingWindowDays.to * MILLISECONDS_PER_DAY
    }
  };
}

// ---------------------------------------------------------------------------
// Cielo del día — proveedor `planets/tropical` (mismo patrón seguro que sky.ts)
// ---------------------------------------------------------------------------

export type SkyLuminary = {
  key: "sun" | "moon";
  label: string;
  longitudeDegrees: number;
  speedDegreesPerDay: number;
  signKey: string;
  sign: string;
  degreeInSign: number;
  isRetrograde: boolean;
};

export type SkyLuminaries = { sun: SkyLuminary; moon: SkyLuminary };

export type LunaSkyConfig = {
  baseUrl: string;
  userId?: string;
  apiKey?: string;
  language: string;
  houseSystem: string;
};

const DEFAULT_LUNA_API_BASE_URL = "https://json.astrologyapi.com/v1";

/** `env` inyectable para poder probar el estado `not_configured` sin tocar el proceso. */
export function readLunaSkyConfig(env: Record<string, string | undefined> = process.env): LunaSkyConfig {
  return {
    baseUrl: (env.ASTROLOGY_API_BASE_URL ?? DEFAULT_LUNA_API_BASE_URL).replace(/\/$/, ""),
    userId: env.ASTROLOGY_API_USER_ID,
    apiKey: env.ASTROLOGY_API_KEY,
    language: env.ASTROLOGY_API_LANGUAGE ?? "en",
    houseSystem: env.ASTROLOGY_API_HOUSE_SYSTEM ?? "placidus"
  };
}

export function hasLunaSkyCredentials(config: LunaSkyConfig): boolean {
  return Boolean(config.userId && config.apiKey);
}

function encodeLunaBasicAuth(userId: string, apiKey: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(`${userId}:${apiKey}`).toString("base64");
  }
  return btoa(`${userId}:${apiKey}`);
}

// Transporte mínimo contra AstrologyAPI. `postAstrologyApi` de
// `convex/lib/astrologyApi.ts` no se exporta, así que se repite el mismo patrón
// que ya usa `convex/sky.ts`: Basic auth, sin loguear el cuerpo y con el
// detalle del error recortado.
async function postLunaSkyApi(config: LunaSkyConfig, endpoint: string, body: unknown) {
  if (!config.userId || !config.apiKey) {
    throw new Error("AstrologyAPI credentials are missing.");
  }

  const response = await fetch(`${config.baseUrl}/${endpoint.replace(/^\//, "")}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Language": config.language,
      Authorization: `Basic ${encodeLunaBasicAuth(config.userId, config.apiKey)}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { rawText: text };
    }
  }

  if (!response.ok) {
    throw new Error(`AstrologyAPI ${endpoint} failed with ${response.status}: ${text.slice(0, 300)}`);
  }

  return json;
}

function asPlainRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickFiniteNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function pickTrimmedString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/** Un ítem del proveedor (o del caché) convertido al contrato cerrado del módulo. */
export function parseSkyLuminary(value: unknown, expected: "sun" | "moon"): SkyLuminary | null {
  const record = asPlainRecord(value);
  if (!record) return null;

  const rawName = pickTrimmedString(record, ["key", "name", "planet", "planet_name"])?.toLowerCase();
  if (rawName !== expected && rawName !== (expected === "sun" ? "sol" : "luna")) return null;

  const longitude = pickFiniteNumber(record, [
    "longitudeDegrees",
    "fullDegree",
    "full_degree",
    "longitude",
    "lon"
  ]);
  // La velocidad no es opcional: sin ella no se puede proyectar el día ni
  // publicar el ritmo de la elongación, y adivinarla sería inventar el dato.
  const speed = pickFiniteNumber(record, [
    "speedDegreesPerDay",
    "speed",
    "planet_speed",
    "planetSpeed",
    "dailyMotion"
  ]);
  if (longitude === undefined || speed === undefined) return null;

  const sign = signAtLongitude(longitude);
  const retrograde = record.isRetrograde ?? record.is_retro ?? record.isRetro ?? record.retrograde;
  return {
    key: expected,
    label: expected === "sun" ? "Sol" : "Luna",
    longitudeDegrees: normalizeDegrees(longitude),
    speedDegreesPerDay: speed,
    signKey: sign.key,
    sign: sign.label,
    degreeInSign: sign.degreeInSign,
    isRetrograde:
      typeof retrograde === "boolean"
        ? retrograde
        : typeof retrograde === "string"
          ? ["true", "yes", "1", "r"].includes(retrograde.trim().toLowerCase())
          : speed < 0
  };
}

function tropicalItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const root = asPlainRecord(raw);
  if (!root) return [];
  if (Array.isArray(root.planets)) return root.planets;
  if (Array.isArray(root.data)) return root.data;
  const data = asPlainRecord(root.data);
  if (data && Array.isArray(data.planets)) return data.planets;
  const output = asPlainRecord(root.output);
  if (output && Array.isArray(output.planets)) return output.planets;
  return [];
}

/**
 * Sol y Luna de una respuesta de `planets/tropical`. Devuelve `null` —y el
 * módulo falla cerrado— si falta alguno, si viene duplicado o si a alguno le
 * falta longitud o velocidad.
 */
export function normalizeTropicalLuminaries(raw: unknown): SkyLuminaries | null {
  const items = tropicalItems(raw);
  const parsed: Partial<Record<"sun" | "moon", SkyLuminary>> = {};

  for (const key of ["sun", "moon"] as const) {
    const matches = items.map((item) => parseSkyLuminary(item, key)).filter((item): item is SkyLuminary => item !== null);
    if (matches.length !== 1) return null;
    parsed[key] = matches[0];
  }

  return { sun: parsed.sun!, moon: parsed.moon! };
}

/** Relee el caché global con la misma validación que la respuesta cruda. */
export function readCachedLuminaries(payload: unknown, observedAt: number): SkyLuminaries | null {
  const record = asPlainRecord(payload);
  if (!record) return null;
  if (record.methodVersion !== LUNA_SOBRE_LA_CARTA_METHOD_VERSION) return null;
  if (record.observedAt !== observedAt) return null;

  const luminaries = asPlainRecord(record.luminaries);
  if (!luminaries) return null;
  const sun = parseSkyLuminary(luminaries.sun, "sun");
  const moon = parseSkyLuminary(luminaries.moon, "moon");
  return sun && moon ? { sun, moon } : null;
}

// ---------------------------------------------------------------------------
// Instante canónico del día local
// ---------------------------------------------------------------------------

export type LocalDayInstants = {
  year: number;
  month: number;
  day: number;
  observedAt: number;
  dayStartAt: number;
  dayEndAt: number;
  offsetHours: number;
};

/**
 * Mediodía local de `localDate` y los bordes del día civil.
 *
 * El mediodía es el instante canónico del módulo: es el mismo que ya usa
 * `sky.getMoonPhase`, no depende de a qué hora se abra la app y hace que el
 * caché global por `(localDate, timezone)` sea correcto y no sólo conveniente.
 *
 * Los bordes se toman a ±12 h. En un día con cambio de horario el día civil
 * dura 23 o 25 h, así que el borde puede correrse una hora: son ~0.55° de Luna,
 * suficiente para detectar cambios de casa o signo y no para fijar el minuto.
 */
export function resolveLocalNoonInstants(localDate: string, timezone: string): LocalDayInstants | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate ?? "");
  if (!match || !timezone || !timezone.trim()) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const reference = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  // `Date.UTC` normaliza en silencio: 2026-02-31 se volvería 3 de marzo.
  if (
    reference.getUTCFullYear() !== year ||
    reference.getUTCMonth() !== month - 1 ||
    reference.getUTCDate() !== day
  ) {
    return null;
  }

  const offsetHours = getTimezoneOffsetHours(timezone, reference);
  if (offsetHours === undefined || !Number.isFinite(offsetHours)) return null;

  const observedAt = reference.getTime() - offsetHours * MILLISECONDS_PER_HOUR;
  return {
    year,
    month,
    day,
    observedAt,
    dayStartAt: observedAt - 12 * MILLISECONDS_PER_HOUR,
    dayEndAt: observedAt + 12 * MILLISECONDS_PER_HOUR,
    offsetHours
  };
}

// ---------------------------------------------------------------------------
// Contexto canónico del día — el cliente confirma, nunca elige
// ---------------------------------------------------------------------------

/** Clave de la fila compartida de `globalSkyCaches`. Sale siempre del servidor. */
export type LunaSkyCacheKey = { localDate: string; timezone: string; providerVersion: string };

export type LunaDailyContextPlan =
  | {
      ok: true;
      localDate: string;
      timezone: string;
      rejected: null;
      cacheKey: LunaSkyCacheKey;
    }
  | {
      ok: false;
      localDate: string;
      timezone: string;
      rejected: "local_date" | "timezone";
      /** Sin contexto válido no hay clave: no se lee el caché ni se llama al proveedor. */
      cacheKey: null;
    };

/** `""` y los espacios se leen como «no lo mandaron», no como un valor pedido. */
function requestedContextValue(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Una zona escrita como offset —`"-3"`, `"-3.0"`, `" -03 "`— no es una zona: es
 * un alias. `getTimezoneOffsetHours` la acepta y devuelve exactamente el mismo
 * cielo que la zona real, pero con OTRA clave de `globalSkyCaches`. Sirve para
 * multiplicar filas y llamadas facturables sin que nada se vea distinto, así que
 * se rechaza aunque el offset coincida.
 */
export function isNumericTimezoneAlias(timezone: string): boolean {
  // `Number("")` es 0, que es finito: sin el largo, una cadena vacía pasaría por
  // offset. `Number` ya recorta los espacios, así que `" -3 "` también cae acá.
  return timezone.trim().length > 0 && Number.isFinite(Number(timezone));
}

/**
 * Qué día y qué zona se van a medir, y con qué clave.
 *
 * La autoridad es SIEMPRE el contexto canónico que resolvió el servidor
 * (`resolveCanonicalDailyContext`, derivado de la zona natal). `localDate` y
 * `timezone` siguen aceptándose por compatibilidad, pero sólo pueden CONFIRMAR
 * ese contexto: cualquier diferencia se rechaza acá, antes del caché y antes del
 * proveedor, y ni siquiera en el caso aceptado se usan los valores del cliente
 * para construir la clave o el sobre.
 *
 * Por qué es estricto: la llamada a `planets/tropical` se factura y la fila de
 * `globalSkyCaches` la comparten todas las cuentas de esa zona. Si el cliente
 * pudiera elegir el día o la zona podría pedir cualquier fecha —una futura, una
 * de hace un año, la misma zona escrita de otra forma— y cada variante abriría
 * una fila nueva con su propia llamada paga, midiendo además un cielo que no es
 * el de hoy de esa persona.
 *
 * La comparación es por igualdad exacta, no por equivalencia: dos cadenas que
 * resuelven el mismo instante pero se escriben distinto (`"America/Buenos_Aires"`
 * por `"America/Argentina/Buenos_Aires"`, `"-3"`, un espacio de más) son claves
 * de caché distintas, que es justo lo que hay que evitar.
 *
 * Un alias numérico se rechaza SIEMPRE, incluso si coincidiera con el canónico:
 * la zona la nombra el servidor, y omitir el argumento sigue siendo válido.
 */
export function planLunaSobreLaCartaContext(args: {
  canonical: { localDate: string; timezone: string };
  requestedLocalDate?: string | null;
  requestedTimezone?: string | null;
  providerVersion: string;
}): LunaDailyContextPlan {
  const localDate = args.canonical.localDate;
  const timezone = args.canonical.timezone;
  const requestedLocalDate = requestedContextValue(args.requestedLocalDate);
  const requestedTimezone = requestedContextValue(args.requestedTimezone);

  if (requestedLocalDate !== null && requestedLocalDate !== localDate) {
    return { ok: false, localDate, timezone, rejected: "local_date", cacheKey: null };
  }

  if (
    requestedTimezone !== null &&
    (isNumericTimezoneAlias(requestedTimezone) || requestedTimezone !== timezone)
  ) {
    return { ok: false, localDate, timezone, rejected: "timezone", cacheKey: null };
  }

  return {
    ok: true,
    localDate,
    timezone,
    rejected: null,
    cacheKey: { localDate, timezone, providerVersion: args.providerVersion }
  };
}

// ---------------------------------------------------------------------------
// Contrato publicado
// ---------------------------------------------------------------------------

export type LunaSobreLaCartaStatus =
  | "ready"
  | "partial"
  | "needs_session"
  | "needs_daily_context"
  | "needs_natal_chart"
  | "not_configured"
  | "provider_error";

export type LunaSobreLaCartaPrecision = "exact" | "estimated" | "range" | "not_applicable";

export type MoonOnChartData = {
  kind: "moon_on_chart";
  observedAt: number;
  longitudeDegrees: number;
  speedDegreesPerDay: number;
  signKey: string;
  sign: string;
  degreeInSign: number;
  phaseKey: LunarPhaseKey;
  phaseName: string;
  /** Fracción iluminada del disco, 0..1. */
  illumination: number;
  elongationDegrees: number;
  /** Casa natal en el instante observado. `null` sin hora exacta o sin carta completa. */
  natalHouse: number | null;
  houseTheme: string | null;
  /** Casas que la Luna recorre durante el día civil local, en orden de tránsito. */
  housesToday: number[];
  signsToday: string[];
  phasesToday: LunarPhaseKey[];
  precision: LunaSobreLaCartaPrecision;
  summary: string;
};

export type CumplelunaData = {
  kind: "cumpleluna";
  observedAt: number;
  natalElongationDegrees: number;
  /** Cuánto puede valer de más o de menos la elongación natal. 0 con hora exacta. */
  natalElongationToleranceDegrees: number;
  currentElongationDegrees: number;
  /** Ritmo instantáneo de la elongación hoy (°/día). Dato, no predicción. */
  elongationRateDegreesPerDay: number;
  cycleDegrees: number;
  cycleFraction: number;
  cycleDay: number;
  cycleDayWindowDays: { from: number; to: number };
  cycleLengthDays: number;
  daysRemaining: number;
  daysRemainingWindowDays: { from: number; to: number };
  previousExactAt: number;
  previousExactAtWindow: { earliest: number; latest: number };
  nextExactAt: number;
  nextExactAtWindow: { earliest: number; latest: number };
  /** Nunca `exact`: el instante es una estimación por movimiento medio. */
  precision: "estimated" | "range";
  summary: string;
};

export type LunaSobreLaCartaResult = {
  methodVersion: string;
  providerVersion: string;
  status: LunaSobreLaCartaStatus;
  precision: LunaSobreLaCartaPrecision;
  localDate: string;
  timezone: string;
  observedAt: number | null;
  moonOnChart: MoonOnChartData | null;
  cumpleluna: CumplelunaData | null;
  missingInputs: string[];
  limitations: string[];
};

type NatalChartLike = {
  /** `"birth_time"` sólo si la carta se calculó con la hora real; si no, mediodía. */
  calculationTimeSource?: unknown;
  birth?: { birthTime?: unknown; birthTimePrecision?: unknown } | null;
  placements?: ReadonlyArray<{ key?: unknown; fullDegree?: unknown }> | null;
  houses?: ReadonlyArray<{ house?: unknown; degree?: unknown; theme?: unknown }> | null;
} | null;

function rounded(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundedRange(range: { from: number; to: number }, digits: number) {
  return { from: rounded(range.from, digits), to: rounded(range.to, digits) };
}

function roundedWindow(window: { earliest: number; latest: number }) {
  return { earliest: Math.round(window.earliest), latest: Math.round(window.latest) };
}

function uniqueInOrder<T>(values: readonly T[]): T[] {
  const seen: T[] = [];
  for (const value of values) {
    if (!seen.includes(value)) seen.push(value);
  }
  return seen;
}

/** Longitud proyectada con la velocidad instantánea. Sólo se usa a ±12 h. */
function projectLongitude(longitudeDegrees: number, speedDegreesPerDay: number, deltaMs: number): number {
  return normalizeDegrees(longitudeDegrees + speedDegreesPerDay * (deltaMs / MILLISECONDS_PER_DAY));
}

function natalLongitude(chart: NatalChartLike, key: "sun" | "moon"): number | null {
  const placements: ReadonlyArray<{ key?: unknown; fullDegree?: unknown }> = chart?.placements ?? [];
  const placement = placements.find((item) => {
    const rawKey = item?.key;
    return typeof rawKey === "string" && rawKey.trim().toLowerCase() === key;
  });
  // `fullDegree` es `number | null`: sin este filtro, una luminaria guardada sin
  // grado se leería como 0° de Aries y el Cumpleluna saldría de una elongación
  // natal que nadie midió. Falta el dato, así que falta el módulo.
  const value = finiteNumberOrNull(placement?.fullDegree);
  return value === null ? null : normalizeDegrees(value);
}

/**
 * ¿La carta guardada se calculó de verdad con la hora de nacimiento?
 *
 * `birthTimePrecision === "known"` es lo que la persona DECLARÓ, no lo que el
 * cálculo usó. Si la hora faltaba o no parseaba, `prepareAstrologyApiRequest`
 * cae al mediodía y deja `calculationTimeSource: "noon_fallback"`: con esa
 * carta el Ascendente y las casas pueden estar corridos medio día de Luna
 * (~7.3° de elongación), así que acá se exigen las tres señales. Si falta
 * cualquiera —incluida una carta vieja sin el campo—, el módulo degrada en vez
 * de publicar una casa o un instante que no puede sostener.
 */
export function chartHasExactBirthTime(chart: NatalChartLike): boolean {
  if (chart?.birth?.birthTimePrecision !== "known") return false;
  if (chart?.calculationTimeSource !== "birth_time") return false;
  const birthTime = chart?.birth?.birthTime;
  return typeof birthTime === "string" && normalizeBirthTime(birthTime) !== undefined;
}

/** Estado fallido con contexto: nunca se devuelve `null` pelado. */
export function unavailableLunaSobreLaCarta(args: {
  status: LunaSobreLaCartaStatus;
  localDate: string;
  timezone: string;
  missingInputs: string[];
  limitations: string[];
}): LunaSobreLaCartaResult {
  return {
    methodVersion: LUNA_SOBRE_LA_CARTA_METHOD_VERSION,
    providerVersion: LUNA_SOBRE_LA_CARTA_PROVIDER_VERSION,
    status: args.status,
    precision: "not_applicable",
    localDate: args.localDate,
    timezone: args.timezone,
    observedAt: null,
    moonOnChart: null,
    cumpleluna: null,
    missingInputs: args.missingInputs,
    limitations: args.limitations
  };
}

/**
 * Arma el contrato con el cielo ya resuelto y la carta natal ya guardada.
 * Pura: no llama al proveedor ni toca la base, así se puede probar entera con
 * una respuesta grabada.
 */
export function buildLunaSobreLaCarta(args: {
  localDate: string;
  timezone: string;
  instants: LocalDayInstants;
  chart: NatalChartLike;
  sky: SkyLuminaries;
}): LunaSobreLaCartaResult {
  const { observedAt, dayStartAt, dayEndAt } = args.instants;
  const { sun, moon } = args.sky;
  const missingInputs: string[] = [];
  const limitations: string[] = [];

  const declaredKnownBirthTime = args.chart?.birth?.birthTimePrecision === "known";
  const hasKnownBirthTime = chartHasExactBirthTime(args.chart);

  // --- LA LUNA EN TU CARTA -------------------------------------------------
  const instants = [dayStartAt, observedAt, dayEndAt];
  const moonLongitudes = instants.map((instant) =>
    projectLongitude(moon.longitudeDegrees, moon.speedDegreesPerDay, instant - observedAt)
  );
  const elongations = instants.map((instant, index) =>
    lunarElongationDegrees(
      projectLongitude(sun.longitudeDegrees, sun.speedDegreesPerDay, instant - observedAt),
      moonLongitudes[index]
    )
  );

  const signsToday = uniqueInOrder(moonLongitudes.map((longitude) => signAtLongitude(longitude).label));
  const phasesToday = uniqueInOrder(elongations.map((elongation) => lunarPhaseAtElongation(elongation).key));
  const elongation = elongations[1];
  const phase = lunarPhaseAtElongation(elongation);
  const moonSign = signAtLongitude(moon.longitudeDegrees);

  const houseHits: Array<NatalHouseHit | null> = hasKnownBirthTime
    ? moonLongitudes.map((longitude) => houseAtLongitude(args.chart?.houses, longitude))
    : [];
  const natalHouseHit = houseHits[1] ?? null;
  const housesToday = uniqueInOrder(
    houseHits.filter((hit): hit is NatalHouseHit => hit !== null).map((hit) => hit.house)
  );

  if (!args.chart) {
    missingInputs.push("natal_chart");
    limitations.push("Sin carta natal mostramos el signo y la fase de hoy, pero no una casa tuya.");
  } else if (!hasKnownBirthTime) {
    missingInputs.push("exact_birth_time");
    limitations.push(
      declaredKnownBirthTime
        ? "Tu carta guardada se calculó al mediodía y no con tu hora exacta: no ubicamos la Luna de hoy en una casa tuya."
        : "Sin hora exacta de nacimiento no ubicamos la Luna de hoy en una casa de tu carta."
    );
  } else if (!natalHouseHit) {
    missingInputs.push("complete_natal_houses");
    limitations.push(
      "La hora figura como exacta, pero faltan las doce cúspides completas para ubicar la Luna de hoy."
    );
  }

  const houseChanges = housesToday.length > 1;
  const signChanges = signsToday.length > 1;
  const moonPrecision: LunaSobreLaCartaPrecision = houseChanges || signChanges ? "range" : "exact";
  if (houseChanges) {
    limitations.push(
      `Hoy la Luna cambia de casa: pasa por la ${housesToday.join(" y la ")} dentro del mismo día.`
    );
  }
  limitations.push(
    "Las posiciones son del mediodía local; el recorrido del día se proyecta con la velocidad de ese instante."
  );

  const moonOnChart: MoonOnChartData = {
    kind: "moon_on_chart",
    observedAt,
    longitudeDegrees: rounded(moon.longitudeDegrees, 4),
    speedDegreesPerDay: rounded(moon.speedDegreesPerDay, 4),
    signKey: moonSign.key,
    sign: moonSign.label,
    degreeInSign: rounded(moonSign.degreeInSign, 4),
    phaseKey: phase.key,
    phaseName: phase.name,
    illumination: rounded(lunarIlluminationFraction(elongation), 4),
    elongationDegrees: rounded(elongation, 4),
    natalHouse: natalHouseHit?.house ?? null,
    houseTheme: natalHouseHit?.theme ?? null,
    housesToday,
    signsToday,
    phasesToday,
    precision: moonPrecision,
    summary: moonOnChartSummary({
      sign: moonSign.label,
      phaseName: phase.name,
      house: natalHouseHit,
      housesToday,
      hasChart: Boolean(args.chart)
    })
  };

  // --- CUMPLELUNA ----------------------------------------------------------
  const natalSun = natalLongitude(args.chart, "sun");
  const natalMoon = natalLongitude(args.chart, "moon");
  let cumpleluna: CumplelunaData | null = null;

  if (natalSun === null || natalMoon === null) {
    if (args.chart) {
      missingInputs.push("natal_sun_and_moon");
      limitations.push("Falta el Sol o la Luna natal en la carta guardada: sin eso no hay ciclo personal.");
    }
  } else {
    const natalElongation = lunarElongationDegrees(natalSun, natalMoon);
    const tolerance = hasKnownBirthTime ? 0 : NATAL_HALF_DAY_ELONGATION_DEGREES;
    const timing = estimateCumplelunaTiming({
      observedAt,
      natalElongationDegrees: natalElongation,
      currentElongationDegrees: elongation,
      natalElongationToleranceDegrees: tolerance
    });
    const windowHours = (timing.nextExactAtWindow.latest - timing.nextExactAtWindow.earliest) / MILLISECONDS_PER_HOUR;

    cumpleluna = {
      kind: "cumpleluna",
      observedAt,
      natalElongationDegrees: rounded(natalElongation, 4),
      natalElongationToleranceDegrees: rounded(tolerance, 4),
      currentElongationDegrees: rounded(elongation, 4),
      elongationRateDegreesPerDay: rounded(moon.speedDegreesPerDay - sun.speedDegreesPerDay, 4),
      cycleDegrees: rounded(timing.cycleDegrees, 4),
      cycleFraction: rounded(timing.cycleFraction, 6),
      cycleDay: rounded(timing.cycleDay, 3),
      cycleDayWindowDays: roundedRange(timing.cycleDayWindowDays, 3),
      cycleLengthDays: rounded(timing.cycleLengthDays, 3),
      daysRemaining: rounded(timing.daysRemaining, 3),
      daysRemainingWindowDays: roundedRange(timing.daysRemainingWindowDays, 3),
      previousExactAt: Math.round(timing.previousExactAt),
      previousExactAtWindow: roundedWindow(timing.previousExactAtWindow),
      nextExactAt: Math.round(timing.nextExactAt),
      nextExactAtWindow: roundedWindow(timing.nextExactAtWindow),
      precision: tolerance > 0 ? "range" : "estimated",
      summary: cumplelunaSummary({
        daysRemaining: timing.daysRemaining,
        windowHours,
        exactBirthTime: hasKnownBirthTime
      })
    };
    limitations.push(
      "El Cumpleluna se estima propagando la elongación por movimiento medio: publicamos la ventana, no un instante exacto."
    );
  }

  // --- Estado y precisión del sobre ----------------------------------------
  //
  // `status` habla de los INSUMOS (¿está todo lo que el módulo necesita?) y
  // `precision` de cuán afilado es el valor. Que la Luna cambie de casa dentro
  // del día no es un insumo faltante: baja la precisión a `range`, no el estado.
  const status: LunaSobreLaCartaStatus = !args.chart
    ? "needs_natal_chart"
    : cumpleluna && natalHouseHit
      ? "ready"
      : "partial";

  const precisionRank: Record<LunaSobreLaCartaPrecision, number> = {
    exact: 0,
    estimated: 1,
    range: 2,
    not_applicable: 3
  };
  const precision = [moonOnChart.precision, ...(cumpleluna ? [cumpleluna.precision] : [])].reduce<
    LunaSobreLaCartaPrecision
  >((weakest, current) => (precisionRank[current] > precisionRank[weakest] ? current : weakest), "exact");

  return {
    methodVersion: LUNA_SOBRE_LA_CARTA_METHOD_VERSION,
    providerVersion: LUNA_SOBRE_LA_CARTA_PROVIDER_VERSION,
    status,
    precision,
    localDate: args.localDate,
    timezone: args.timezone,
    observedAt,
    moonOnChart,
    cumpleluna,
    missingInputs: uniqueInOrder(missingInputs),
    limitations: uniqueInOrder(limitations)
  };
}

function moonOnChartSummary(args: {
  sign: string;
  phaseName: string;
  house: NatalHouseHit | null;
  housesToday: number[];
  hasChart: boolean;
}): string {
  if (args.housesToday.length > 1) {
    return `Hoy la Luna cambia de casa: pasa por la ${args.housesToday.join(" y la ")}. Cada casa dura dos o tres días y marca un foco, no un pronóstico.`;
  }
  if (args.house) {
    return `Hoy la Luna pasa por tu casa ${args.house.house}: ${args.house.theme}. Es un foco que cambia cada dos o tres días, no algo que tenga que pasarte.`;
  }
  const base = `Hoy la Luna está en ${args.sign} y la fase es ${args.phaseName.toLocaleLowerCase("es")}.`;
  return args.hasChart
    ? `${base} Sin hora exacta de nacimiento no la ubicamos en una casa de tu carta.`
    : `${base} Cuando tengas tu carta natal calculada también podemos ubicarla en una casa tuya.`;
}

function cumplelunaSummary(args: { daysRemaining: number; windowHours: number; exactBirthTime: boolean }): string {
  const when = args.daysRemaining < 1 ? "hoy" : `en unos ${Math.round(args.daysRemaining)} días`;
  const window = `una ventana de ${rounded(args.windowHours, 1)} horas`;
  return args.exactBirthTime
    ? `La distancia entre el Sol y la Luna que había cuando naciste vuelve a repetirse ${when}. Es una estimación con ${window}, no un instante exacto.`
    : `La distancia entre el Sol y la Luna de tu día de nacimiento vuelve a repetirse ${when}. Sin hora exacta la estimación abre ${window}.`;
}

// ---------------------------------------------------------------------------
// Convex: estado, caché global y action pública
// ---------------------------------------------------------------------------

/**
 * Todo lo que la action necesita de la base, en una sola lectura: contexto
 * canónico del día (derivado de la zona natal, nunca de la del dispositivo),
 * carta vigente y la fila del cielo ya cacheada para ese día.
 *
 * `localDate` y `timezone` llegan crudos desde el cliente y NO eligen nada:
 * `planLunaSobreLaCartaContext` los valida contra el canónico y, si difieren, la
 * query corta antes de tocar `globalSkyCaches` —y por lo tanto antes de que la
 * action pueda llegar al proveedor pago—.
 */
export const lunaSobreLaCartaState = internalQuery({
  args: {
    tokenIdentifier: v.string(),
    localDate: v.optional(v.string()),
    timezone: v.optional(v.string()),
    // El reloj entra como argumento: la query queda determinista respecto de sus
    // insumos y el día canónico sale del mismo resolver que `daily.getTodayContext`.
    nowMs: v.number(),
    providerVersion: v.string()
  },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) return null;

    const birthData = await findCurrentBirthData(ctx, user._id);
    const latestGuide = await ctx.db
      .query("dailyGuides")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .first();
    const canonical = resolveCanonicalDailyContext({
      birthTimezone: birthData?.timezone,
      latestGuide: latestGuide ? { localDate: latestGuide.localDate, timezone: latestGuide.timezone } : null,
      now: new Date(args.nowMs)
    });
    const plan = planLunaSobreLaCartaContext({
      canonical,
      requestedLocalDate: args.localDate,
      requestedTimezone: args.timezone,
      providerVersion: args.providerVersion
    });

    // Se corta acá a propósito: sin clave canónica no hay lectura del caché
    // global ni, más arriba, llamada al proveedor.
    const cacheKey = plan.cacheKey;
    if (!cacheKey) {
      return {
        localDate: plan.localDate,
        timezone: plan.timezone,
        rejected: plan.rejected,
        chartPayload: null,
        sky: null
      };
    }

    const natalChart = await findExactNatalChart(ctx, user._id, birthData);
    const cachedSky = await ctx.db
      .query("globalSkyCaches")
      .withIndex("by_date_timezone_version", (q: any) =>
        q
          .eq("localDate", cacheKey.localDate)
          .eq("timezone", cacheKey.timezone)
          .eq("providerVersion", cacheKey.providerVersion)
      )
      .first();

    return {
      localDate: plan.localDate,
      timezone: plan.timezone,
      rejected: null,
      chartPayload: natalChart?.payload ?? null,
      sky: cachedSky?.payload ?? null
    };
  }
});

/** El cielo del día es el mismo para todo el mundo: se cachea una sola vez por
 *  `(localDate, timezone, providerVersion)` y no consume una llamada por usuario. */
export const persistGlobalSky = internalMutation({
  args: {
    localDate: v.string(),
    timezone: v.string(),
    providerVersion: v.string(),
    payload: v.any()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("globalSkyCaches")
      .withIndex("by_date_timezone_version", (q: any) =>
        q.eq("localDate", args.localDate).eq("timezone", args.timezone).eq("providerVersion", args.providerVersion)
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { payload: args.payload, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("globalSkyCaches", {
      localDate: args.localDate,
      timezone: args.timezone,
      providerVersion: args.providerVersion,
      payload: args.payload,
      createdAt: now,
      updatedAt: now
    });
  }
});

/**
 * `home.getLunaSobreLaCarta` — la Luna de hoy medida sobre la carta natal.
 *
 * Action porque pega al proveedor. El día y la zona los decide SIEMPRE el
 * servidor con `resolveCanonicalDailyContext`; `localDate`/`timezone` quedan
 * como confirmación opcional y, si no coinciden exactamente con el canónico, la
 * llamada se rechaza antes del caché y del proveedor (ver
 * `planLunaSobreLaCartaContext`). Falla cerrado con un estado explícito y nunca
 * devuelve un dato inventado.
 */
export const getLunaSobreLaCarta = action({
  args: {
    localDate: v.optional(v.string()),
    timezone: v.optional(v.string())
  },
  handler: async (ctx, args): Promise<LunaSobreLaCartaResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Sin sesión no hay contexto canónico que resolver, y lo que mandó el
      // cliente no se devuelve como si fuera el día del módulo: el sobre viaja
      // sin fecha antes que con una fecha que el servidor nunca eligió.
      return unavailableLunaSobreLaCarta({
        status: "needs_session",
        localDate: "",
        timezone: "",
        missingInputs: ["authenticated_session"],
        limitations: ["Este módulo mide tu carta natal: necesita una sesión iniciada."]
      });
    }

    const state: any = await ctx.runQuery(internalApi.home.lunaSobreLaCartaState, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate: args.localDate,
      timezone: args.timezone,
      nowMs: Date.now(),
      providerVersion: LUNA_SOBRE_LA_CARTA_PROVIDER_VERSION
    });
    if (!state) {
      return unavailableLunaSobreLaCarta({
        status: "needs_session",
        localDate: "",
        timezone: "",
        missingInputs: ["authenticated_user"],
        limitations: ["La sesión todavía no tiene una cuenta creada en Órbita."]
      });
    }

    // Ya son los canónicos del servidor: la query no devuelve otra cosa.
    const { localDate, timezone } = state;

    if (state.rejected) {
      const isTimezone = state.rejected === "timezone";
      return unavailableLunaSobreLaCarta({
        status: "needs_daily_context",
        localDate,
        timezone,
        missingInputs: [isTimezone ? "canonical_timezone_mismatch" : "canonical_local_date_mismatch"],
        limitations: [
          isTimezone
            ? "La zona horaria de tu día sale de tu carta natal, no del dispositivo: no medimos el cielo con otra zona."
            : "El día lo resuelve el servidor desde tu carta natal: no medimos el cielo de una fecha distinta a la de hoy."
        ]
      });
    }

    const instants = resolveLocalNoonInstants(localDate, timezone);
    if (!instants) {
      return unavailableLunaSobreLaCarta({
        status: "needs_daily_context",
        localDate,
        timezone,
        missingInputs: ["valid_local_date_and_timezone"],
        limitations: ["No pudimos resolver la fecha local y su zona horaria para medir el cielo de hoy."]
      });
    }

    let sky = readCachedLuminaries(state.sky, instants.observedAt);

    if (!sky) {
      const config = readLunaSkyConfig();
      if (!hasLunaSkyCredentials(config)) {
        return unavailableLunaSobreLaCarta({
          status: "not_configured",
          localDate,
          timezone,
          missingInputs: ["astrologyapi_credentials_not_configured"],
          limitations: ["El proveedor astrológico no está configurado: no inventamos las posiciones del día."]
        });
      }

      try {
        // Longitudes geocéntricas: no dependen del lugar, así que el pedido va
        // con coordenadas neutras y el caché sirve para todas las personas de
        // esa zona horaria.
        const raw = await postLunaSkyApi(config, "planets/tropical", {
          day: instants.day,
          month: instants.month,
          year: instants.year,
          hour: 12,
          min: 0,
          lat: 0,
          lon: 0,
          tzone: instants.offsetHours,
          house_type: config.houseSystem
        });
        sky = normalizeTropicalLuminaries(raw);
      } catch {
        sky = null;
      }

      if (!sky) {
        return unavailableLunaSobreLaCarta({
          status: "provider_error",
          localDate,
          timezone,
          missingInputs: ["current_sun_and_moon"],
          limitations: ["El proveedor no devolvió posiciones verificables del Sol y la Luna para hoy."]
        });
      }

      await ctx.runMutation(internalApi.home.persistGlobalSky, {
        localDate,
        timezone,
        providerVersion: LUNA_SOBRE_LA_CARTA_PROVIDER_VERSION,
        payload: {
          methodVersion: LUNA_SOBRE_LA_CARTA_METHOD_VERSION,
          observedAt: instants.observedAt,
          luminaries: sky
        }
      });
    }

    return buildLunaSobreLaCarta({
      localDate,
      timezone,
      instants,
      chart: extractNormalizedChartFromPayload(state.chartPayload),
      sky
    });
  }
});
