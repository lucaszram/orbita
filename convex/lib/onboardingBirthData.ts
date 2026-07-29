import { buildBirthDataHash, type BirthDataForHash } from "./birthDataConsistency";

export type OnboardingBirthDataDecision = "create" | "idempotent";

/**
 * El onboarding puede crear los datos natales una vez y repetir exactamente la
 * misma escritura (reintento/remount). Un payload distinto pertenece al editor
 * de Perfil: nunca se acepta como "completar onboarding".
 */
export function decideOnboardingBirthDataWrite(
  existing: BirthDataForHash | null,
  candidate: BirthDataForHash
): OnboardingBirthDataDecision {
  if (!existing) return "create";
  if (buildBirthDataHash(existing) === buildBirthDataHash(candidate)) return "idempotent";
  throw new Error("ONBOARDING_BIRTH_DATA_CONFLICT");
}
