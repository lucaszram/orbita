/**
 * Tríada del onboarding anónimo (Sol · Luna · Ascendente).
 *
 * Superficie mínima y pública: el onboarding necesita la tríada REAL antes de
 * que exista sesión Clerk, y el laboratorio (`convex/publicLab.ts`) está —y
 * queda— bloqueado en producción. Acá no se expone nada del lab: se valida la
 * entrada con dureza, la zona horaria se DERIVA de las coordenadas en el
 * servidor (nunca del reloj del dispositivo), se llama al proveedor natal
 * canónico y se devuelven únicamente tres signos. No se persisten datos de
 * nacimiento.
 */
import type { BirthChartInput, NormalizedAstroChart } from "./orbita";
import { getTimezoneOffsetHours } from "./astrologyApi";
import { resolvePositiveInt, type RateLimitConfig } from "./rateLimit";

export type OnboardingTriadPrecision = "known" | "approximate" | "unknown";

export type OnboardingTriadArgs = {
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: OnboardingTriadPrecision;
  birthPlaceLabel?: string;
  latitude: number;
  longitude: number;
  /** Borrador del alta. Obligatorio: es el cupo de reintentos del flujo. */
  clientDraftId: string;
};

/** Lo ÚNICO que devuelve la acción pública. */
export type OnboardingTriad = {
  sun: string | null;
  moon: string | null;
  ascendant: string | null;
};

export type OnboardingTriadErrorCode =
  | "INVALID_BIRTH_DATE"
  | "INVALID_BIRTH_TIME"
  | "INVALID_BIRTH_TIME_PRECISION"
  | "INVALID_COORDINATES"
  | "INVALID_PLACE_LABEL"
  | "INVALID_DRAFT_ID"
  | "TIMEZONE_UNRESOLVED"
  | "RATE_LIMITED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE";

export class OnboardingTriadError extends Error {
  readonly code: OnboardingTriadErrorCode;

  constructor(code: OnboardingTriadErrorCode, detail: string) {
    // El código viaja en el mensaje: el cliente Convex solo recibe el string.
    super(`ONBOARDING_TRIAD_${code}: ${detail}`);
    this.name = "OnboardingTriadError";
    this.code = code;
  }
}

const MIN_BIRTH_YEAR = 1900;
const MAX_PLACE_LABEL_LENGTH = 160;
const MAX_TIMEZONE_LENGTH = 64;
const DEFAULT_PLACE_LABEL = "Sin especificar";

const CANONICAL_SIGNS = new Set([
  "aries",
  "tauro",
  "geminis",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "escorpio",
  "sagitario",
  "capricornio",
  "acuario",
  "piscis"
]);

/**
 * Dos niveles, con alcances distintos y honestos:
 *
 * - `perDraft`: cupo de reintentos DEL FLUJO. La unidad es el `clientDraftId`,
 *   un id que emite el propio cliente: sirve para que un alta real (o un bug de
 *   reintento) no golpee el proveedor en loop. **No es una defensa contra un
 *   caller malicioso**: rotar el id es trivial y estrena cupo cada vez.
 * - `globalFuse`: ESA es la protección real de costo. Fusible del deployment,
 *   deliberadamente alto, para que un script o un bug no dispare la factura de
 *   AstrologyAPI. Si corta, todas las altas ven "reintentá en un momento": es
 *   el trade-off explícito de un corte de costo.
 */
export function getOnboardingTriadRateLimits(env: Record<string, string | undefined> = process.env): {
  perDraft: RateLimitConfig;
  globalFuse: RateLimitConfig;
} {
  return {
    perDraft: {
      scope: "onboarding_triad:draft",
      windowMs: 60_000,
      max: resolvePositiveInt(env.ORBITA_ONBOARDING_TRIAD_MAX_PER_DRAFT_PER_MINUTE, 12, 1_000)
    },
    globalFuse: {
      scope: "onboarding_triad:global",
      windowMs: 60_000,
      max: resolvePositiveInt(env.ORBITA_ONBOARDING_TRIAD_GLOBAL_FUSE_PER_MINUTE, 3_000, 1_000_000)
    }
  };
}

const DRAFT_ID_PREFIX = "orbita-signup-";
const DRAFT_ID_MIN_LENGTH = DRAFT_ID_PREFIX.length + 6;
const DRAFT_ID_MAX_LENGTH = 64;

/**
 * Forma aceptada del borrador del alta: el mismo id opaco que emite
 * `createClientDraftId` en el cliente. Acotarlo no lo vuelve confiable —quien
 * quiera puede rotarlo—, pero evita que la clave del contador sea texto
 * arbitrario de largo libre.
 */
export function validateClientDraftId(value: unknown): string {
  const draft = typeof value === "string" ? value.trim() : "";

  if (
    !draft.startsWith(DRAFT_ID_PREFIX) ||
    draft.length < DRAFT_ID_MIN_LENGTH ||
    draft.length > DRAFT_ID_MAX_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(draft)
  ) {
    throw new OnboardingTriadError(
      "INVALID_DRAFT_ID",
      `clientDraftId debe tener el formato "${DRAFT_ID_PREFIX}…" (${DRAFT_ID_MIN_LENGTH}–${DRAFT_ID_MAX_LENGTH} caracteres alfanuméricos).`
    );
  }

  return draft;
}

/**
 * Sujeto del cupo por flujo: el id del borrador, tal cual. No se hashea: un
 * hash corto no sería anonimización real y disfrazaría de privacidad lo que es
 * solamente una clave de contador.
 */
export function onboardingTriadRateSubject(clientDraftId: string): string {
  return `draft:${validateClientDraftId(clientDraftId)}`;
}

function isRealIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
  );
}

function isIanaLikeTimezone(value: string) {
  if (value === "UTC" || value === "GMT") {
    return true;
  }
  return /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+$/.test(value);
}

/**
 * Validación estricta de fecha, precisión de hora, coordenadas y lugar. La zona
 * horaria NO viene del cliente: llega ya derivada de las coordenadas y acá solo
 * se comprueba que el runtime pueda resolverla.
 */
export function validateOnboardingTriadInput(
  args: OnboardingTriadArgs,
  options: { now: number; timezone: string }
): BirthChartInput {
  const birthDate = args.birthDate?.trim() ?? "";

  if (!isRealIsoDate(birthDate)) {
    throw new OnboardingTriadError("INVALID_BIRTH_DATE", "birthDate debe ser una fecha real en formato YYYY-MM-DD.");
  }

  const year = Number(birthDate.slice(0, 4));
  if (year < MIN_BIRTH_YEAR) {
    throw new OnboardingTriadError("INVALID_BIRTH_DATE", `birthDate no puede ser anterior a ${MIN_BIRTH_YEAR}.`);
  }

  const todayIso = new Date(options.now).toISOString().slice(0, 10);
  if (birthDate > todayIso) {
    throw new OnboardingTriadError("INVALID_BIRTH_DATE", "birthDate no puede estar en el futuro.");
  }

  const rawTime = args.birthTime?.trim();
  let birthTime: string | undefined;

  if (args.birthTimePrecision === "unknown") {
    if (rawTime) {
      throw new OnboardingTriadError(
        "INVALID_BIRTH_TIME_PRECISION",
        "birthTime no puede venir con birthTimePrecision=unknown."
      );
    }
  } else {
    if (!rawTime) {
      throw new OnboardingTriadError(
        "INVALID_BIRTH_TIME",
        "birthTime es obligatorio cuando la precisión no es unknown."
      );
    }

    const match = rawTime.match(/^(\d{1,2}):(\d{2})$/);
    const hour = match ? Number(match[1]) : NaN;
    const minute = match ? Number(match[2]) : NaN;

    if (!match || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new OnboardingTriadError("INVALID_BIRTH_TIME", "birthTime debe tener formato HH:MM (00:00–23:59).");
    }

    birthTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  assertUsableCoordinates(args.latitude, args.longitude);

  const timezone = options.timezone?.trim() ?? "";
  if (!timezone || timezone.length > MAX_TIMEZONE_LENGTH || !isIanaLikeTimezone(timezone)) {
    throw new OnboardingTriadError(
      "TIMEZONE_UNRESOLVED",
      "la zona derivada de las coordenadas no es un identificador IANA."
    );
  }

  const offset = getTimezoneOffsetHours(timezone, new Date(`${birthDate}T12:00:00Z`));
  if (offset === undefined || !Number.isFinite(offset)) {
    throw new OnboardingTriadError("TIMEZONE_UNRESOLVED", `zona desconocida para el runtime: ${timezone}.`);
  }

  const rawLabel = args.birthPlaceLabel?.trim() ?? "";
  if (rawLabel.length > MAX_PLACE_LABEL_LENGTH) {
    throw new OnboardingTriadError(
      "INVALID_PLACE_LABEL",
      `birthPlaceLabel no puede superar ${MAX_PLACE_LABEL_LENGTH} caracteres.`
    );
  }

  return {
    birthDate,
    birthTime,
    birthTimePrecision: args.birthTimePrecision,
    birthPlaceLabel: rawLabel || DEFAULT_PLACE_LABEL,
    latitude: args.latitude,
    longitude: args.longitude,
    timezone
  };
}

/** Se comprueba ANTES de resolver la zona: es la entrada del resolver. */
export function assertUsableCoordinates(latitude: unknown, longitude: unknown): asserts latitude is number {
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new OnboardingTriadError(
      "INVALID_COORDINATES",
      "latitude (-90..90) y longitude (-180..180) son obligatorias y deben ser finitas."
    );
  }
}

function canonicalSign(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const key = value.trim().toLowerCase();
  return CANONICAL_SIGNS.has(key) ? key : null;
}

/**
 * Sin hora natal el proveedor calcula con mediodía: el ascendente que sale de
 * ahí es ruido, así que se devuelve `null` en vez de un signo inventado.
 */
export function extractTriadFromChart(
  chart: NormalizedAstroChart | null | undefined,
  precision: OnboardingTriadPrecision
): OnboardingTriad {
  const summary = chart?.summary;
  const ascendantIsReliable = precision !== "unknown" && summary?.accuracy === "calculated";

  return {
    sun: canonicalSign(summary?.sun?.signEs),
    moon: canonicalSign(summary?.moon?.signEs),
    ascendant: ascendantIsReliable ? canonicalSign(summary?.ascendant?.signEs) : null
  };
}

type NatalChartRun = {
  status: string;
  warnings?: string[];
  error?: string | null;
  normalized?: { chart?: NormalizedAstroChart } | null;
};

export const ONBOARDING_TRIAD_TIMEOUT_DEFAULT_MS = 12_000;

/**
 * Máximo configurable del deadline server-side.
 *
 * Es un invariante, no una preferencia: tiene que quedar por debajo del techo
 * del cliente (`TRIAD_CLIENT_TIMEOUT_MS`, 20s) para CUALQUIER configuración
 * válida. Si el servidor pudiera pasarse, el cliente cortaría primero y el
 * usuario vería "sin respuesta" en vez del error real del proveedor.
 */
export const ONBOARDING_TRIAD_TIMEOUT_MAX_MS = 15_000;

/** Techo de la llamada natal. Sin esto el alta se queda esperando para siempre. */
export function getOnboardingTriadTimeoutMs(env: Record<string, string | undefined> = process.env): number {
  return resolvePositiveInt(
    env.ORBITA_ONBOARDING_TRIAD_TIMEOUT_MS,
    ONBOARDING_TRIAD_TIMEOUT_DEFAULT_MS,
    ONBOARDING_TRIAD_TIMEOUT_MAX_MS
  );
}

/**
 * Corre la llamada natal con deadline: al vencer, aborta el fetch (el proveedor
 * recibe el `AbortSignal`) y rechaza con `PROVIDER_TIMEOUT`. La promesa devuelta
 * SIEMPRE se asienta antes de `timeoutMs`, aunque la de adentro nunca lo haga.
 */
export async function runWithProviderDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timers: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout } = globalThis
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_resolve, reject) => {
    timer = timers.setTimeout(() => {
      controller.abort();
      reject(
        new OnboardingTriadError(
          "PROVIDER_TIMEOUT",
          `el proveedor natal no respondió en ${Math.round(timeoutMs / 1000)}s.`
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([run(controller.signal), deadline]);
  } finally {
    if (timer !== undefined) timers.clearTimeout(timer);
  }
}

export type OnboardingTriadRateLimitCheck = (subject: string) => Promise<{
  allowed: boolean;
  retryAfterMs: number;
}>;

/**
 * Orquesta la acción pública: coordenadas → zona del LUGAR (resolver
 * server-side) → validación estricta → rate limit → proveedor natal canónico →
 * tríada. Nunca resuelve "a medias": si algo falla, el cliente recibe un código
 * estable y ofrece reintento en vez de seguir sin carta.
 */
export async function computeOnboardingTriad(args: {
  args: OnboardingTriadArgs;
  now: number;
  resolveTimezone: (latitude: number, longitude: number) => Promise<string> | string;
  runNatalChart: (input: {
    input: BirthChartInput;
    localDate: string;
    signal: AbortSignal;
  }) => Promise<NatalChartRun>;
  consumeRateLimit?: OnboardingTriadRateLimitCheck;
  /** Techo de la llamada natal; por defecto el del deployment. */
  timeoutMs?: number;
  timers?: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout };
}): Promise<OnboardingTriad> {
  // El borrador se valida primero: es el cupo que va a consumir la llamada.
  const subject = onboardingTriadRateSubject(args.args.clientDraftId);
  assertUsableCoordinates(args.args.latitude, args.args.longitude);

  let timezone: string;
  try {
    timezone = await args.resolveTimezone(args.args.latitude, args.args.longitude);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "resolver de zona no disponible";
    throw new OnboardingTriadError("TIMEZONE_UNRESOLVED", `no se pudo derivar la zona del lugar (${detail}).`);
  }

  const input = validateOnboardingTriadInput(args.args, { now: args.now, timezone });

  if (args.consumeRateLimit) {
    const decision = await args.consumeRateLimit(subject);
    if (!decision.allowed) {
      throw new OnboardingTriadError(
        "RATE_LIMITED",
        `demasiadas solicitudes; reintentá en ${Math.ceil(decision.retryAfterMs / 1000)}s.`
      );
    }
  }

  const localDate = new Date(args.now).toISOString().slice(0, 10);
  const result = await runWithProviderDeadline(
    (signal) => args.runNatalChart({ input, localDate, signal }),
    args.timeoutMs ?? getOnboardingTriadTimeoutMs(),
    args.timers
  );

  if (result.status !== "success" || !result.normalized?.chart) {
    const detail = result.error ?? (result.warnings?.join(", ") || result.status);
    throw new OnboardingTriadError("PROVIDER_UNAVAILABLE", `proveedor natal sin carta (${detail}).`);
  }

  const triad = extractTriadFromChart(result.normalized.chart, input.birthTimePrecision);

  if (!triad.sun || !triad.moon) {
    throw new OnboardingTriadError("PROVIDER_UNAVAILABLE", "la carta del proveedor llegó sin Sol o sin Luna.");
  }

  return triad;
}
