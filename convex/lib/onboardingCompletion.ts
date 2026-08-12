import {
  buildBirthDataHash,
  buildNatalChartCacheKey,
  type BirthDataForHash
} from "./birthDataConsistency";
import { ASTROLOGY_API_CHART_CALCULATION_VERSION } from "./orbita";

export type OnboardingCompletionStatus =
  | "signed_out"
  | "onboarding_incomplete"
  | "profile_incomplete"
  | "chart_pending"
  | "chart_ready";

export type OnboardingRecoveryDestination = "onboarding" | "edit_birth_data" | null;

type BirthDataDocument = BirthDataForHash & {
  _id: unknown;
};

type NatalChartDocument = {
  userId?: unknown;
  birthDataId?: unknown;
  birthDataHash?: unknown;
  cacheKey?: unknown;
  calculationVersion?: unknown;
  payload?: unknown;
};

/**
 * Readiness sólo exige que exista la cuenta interna. Clerk puede aportar un
 * nombre (por ejemplo con Google), pero el alta por email no tiene por qué
 * hacerlo y la ausencia de nombre nunca bloquea Órbita.
 */
export function hasCompletionUser(value: unknown): value is { _id: unknown } {
  if (!value || typeof value !== "object") return false;
  return Boolean((value as Record<string, unknown>)._id);
}

function isCanonicalDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isCanonicalTime(value: unknown) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function hasValidCompletionBirthInput(value: unknown): value is BirthDataForHash {
  if (!value || typeof value !== "object") return false;
  const birth = value as Record<string, unknown>;
  const precision = birth.birthTimePrecision;
  const place = typeof birth.birthPlaceLabel === "string" ? birth.birthPlaceLabel.trim() : "";
  const latitude = birth.latitude;
  const longitude = birth.longitude;

  return Boolean(
    isCanonicalDate(birth.birthDate) &&
      (precision === "known" || precision === "approximate" || precision === "unknown") &&
      (precision === "unknown" || isCanonicalTime(birth.birthTime)) &&
      place &&
      place.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "") !== "sin especificar" &&
      typeof latitude === "number" &&
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      typeof longitude === "number" &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180 &&
      typeof birth.timezone === "string" &&
      birth.timezone.trim().length > 0
  );
}

export function hasValidCompletionBirthData(value: unknown): value is BirthDataDocument {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Record<string, unknown>)._id &&
      hasValidCompletionBirthInput(value)
  );
}

/**
 * Verifica exclusivamente identidad persistida. No confía en un chart público
 * no nulo: exige el mismo birthData, hash, cacheKey y versión que el backend
 * calcula para la fila natal vigente.
 */
export function chartMatchesCompletionBirthData(args: {
  userId: unknown;
  birthData: BirthDataDocument;
  chart: NatalChartDocument | null | undefined;
}) {
  const { userId, birthData, chart } = args;
  if (!chart || typeof chart.payload !== "object" || chart.payload === null) return false;
  const expectedHash = buildBirthDataHash(birthData);
  const expectedCacheKey = buildNatalChartCacheKey(String(userId), expectedHash);

  return Boolean(
    chart.userId === userId &&
      chart.birthDataId === birthData._id &&
      chart.birthDataHash === expectedHash &&
      chart.cacheKey === expectedCacheKey &&
      chart.calculationVersion === ASTROLOGY_API_CHART_CALCULATION_VERSION
  );
}

export function deriveOnboardingCompletion(args: {
  authenticated: boolean;
  user: unknown;
  signupInProgress: boolean;
  birthData: unknown;
  chart: NatalChartDocument | null | undefined;
}): {
  status: OnboardingCompletionStatus;
  recovery: OnboardingRecoveryDestination;
  profileReady: boolean;
  birthDataReady: boolean;
  chartReady: boolean;
} {
  if (!args.authenticated) {
    return {
      status: "signed_out",
      recovery: null,
      profileReady: false,
      birthDataReady: false,
      chartReady: false
    };
  }

  if (!hasCompletionUser(args.user)) {
    return {
      status: args.signupInProgress ? "onboarding_incomplete" : "profile_incomplete",
      recovery: args.signupInProgress ? "onboarding" : "edit_birth_data",
      profileReady: false,
      birthDataReady: false,
      chartReady: false
    };
  }
  const user = args.user;

  const birthDataReady = hasValidCompletionBirthData(args.birthData);
  if (!birthDataReady) {
    return {
      status: args.signupInProgress ? "onboarding_incomplete" : "profile_incomplete",
      recovery: args.signupInProgress ? "onboarding" : "edit_birth_data",
      profileReady: true,
      birthDataReady: false,
      chartReady: false
    };
  }

  const chartReady = chartMatchesCompletionBirthData({
    userId: user._id,
    birthData: args.birthData as BirthDataDocument,
    chart: args.chart
  });
  if (!chartReady) {
    return {
      status: "chart_pending",
      // La cuenta y sus datos ya están completos. La carta es un derivado
      // reintentable y no devuelve a la persona al alta ni al editor.
      recovery: null,
      profileReady: true,
      birthDataReady: true,
      chartReady: false
    };
  }

  return {
    status: "chart_ready",
    recovery: null,
    profileReady: true,
    birthDataReady: true,
    chartReady: true
  };
}
