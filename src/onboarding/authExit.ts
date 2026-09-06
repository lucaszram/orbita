import {
  resolveReadinessDestination,
  type OnboardingCompletion
} from "@/domain/onboardingReadiness";

import { ONBOARDING_TOTAL, STEP_AUTH, STEP_BIRTHDATE, STEP_PROMISE } from "./steps";

/**
 * Salida PURA del paso de acceso, decidida por el estado AUTORITATIVO.
 *
 * - Cuenta completa → destino autoritativo (Home), sin repetir el onboarding.
 * - Cuenta preexistente incompleta (sin alta en curso) → editor natal.
 * - Alta en curso (nueva, o retomada con un borrador USABLE por esta cuenta) →
 *   continúa dentro del flujo: por el borrador, por la fecha (`resume=datos`)
 *   o por la promesa.
 * - Sin sesión o sin la consulta resuelta → esperar. Nunca decide `isSignedIn`
 *   solo.
 *
 * Módulo sin React para poder probar los tres tipos de cuenta desde los dos
 * modos del acceso sin renderizar nada.
 */
export type AuthStepExit =
  | { kind: "wait" }
  | { kind: "home" }
  | { kind: "edit-birth-data" }
  | { kind: "continue"; step: number };

export function resolveAuthStepExit(args: {
  sessionActive: boolean;
  completion: OnboardingCompletion | undefined;
  /**
   * Paso del borrador local SOLO si `draftUsableBy` lo aprobó para esta
   * cuenta; `null` en cualquier otro caso. Un borrador ajeno jamás llega acá:
   * ninguna cuenta hereda datos de otra.
   */
  usableDraftStep: number | null;
  resumeDatos: boolean;
}): AuthStepExit {
  if (!args.sessionActive || !args.completion) return { kind: "wait" };
  const destino = resolveReadinessDestination(args.completion);
  if (destino === "app") return { kind: "home" };
  if (destino === "edit-birth-data") return { kind: "edit-birth-data" };
  // "sign-in": la consulta todavía no vio la sesión nueva — se espera.
  if (destino !== "onboarding") return { kind: "wait" };
  if (args.usableDraftStep !== null && args.usableDraftStep > STEP_AUTH) {
    return { kind: "continue", step: Math.min(ONBOARDING_TOTAL - 1, args.usableDraftStep) };
  }
  return { kind: "continue", step: args.resumeDatos ? STEP_BIRTHDATE : STEP_PROMISE };
}
