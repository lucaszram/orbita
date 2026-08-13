import { anyApi } from "convex/server";
import type { FunctionReference } from "convex/server";

/**
 * Onboarding anónimo: única acción pública que el alta consume SIN sesión.
 *
 * Reemplaza a `publicLab.previewDailyHome` para la tríada. El lab está
 * bloqueado en producción a propósito (es superficie de laboratorio), así que
 * usarlo acá dejaba el alta real —nativa y web, que comparten `OnboardingFlow`—
 * sin Sol, Luna ni ascendente.
 *
 * No lleva `timezone`: la zona se deriva de las coordenadas en el servidor.
 */
export type OnboardingTriadPrecision = "known" | "approximate" | "unknown";

export type OnboardingTriadInput = {
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: OnboardingTriadPrecision;
  birthPlaceLabel?: string;
  latitude: number;
  longitude: number;
  /** Borrador del alta: cupo de reintentos del flujo. Obligatorio. */
  clientDraftId: string;
};

/** Signos canónicos en minúscula sin tildes ("geminis"); `null` si no se pudo. */
export type OnboardingTriadResult = {
  sun: string | null;
  moon: string | null;
  ascendant: string | null;
};

export const publicOnboardingApi = {
  computeTriad: anyApi.publicOnboarding.computeTriad as FunctionReference<
    "action",
    "public",
    OnboardingTriadInput,
    OnboardingTriadResult
  >
};
