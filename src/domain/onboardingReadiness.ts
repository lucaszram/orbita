/**
 * Readiness del alta — la ÚNICA autoridad de acceso.
 *
 * Contrato `onboarding.getCompletionStatus` (convex/CHANGELOG.md, 2026-08-11).
 * Lo que habilita Órbita no es `isSignedIn`, ni un paso local, ni el retorno de
 * `completeBirthData`: es el estado PERSISTIDO que confirma cuenta interna,
 * datos natales válidos. La carta natal es un recurso derivado: su ausencia se
 * representa con `chart_pending`, pero nunca bloquea el acceso a Órbita.
 *
 * El nombre es OPCIONAL: Clerk puede aportarlo (Google) o no (email + clave), y
 * su ausencia nunca bloquea el alta. No existe ningún estado `needs_name`.
 */

export type OnboardingCompletionStatus =
  | "signed_out"
  | "onboarding_incomplete"
  | "profile_incomplete"
  | "chart_pending"
  | "chart_ready";

/** Adónde vuelve una recuperación. `null` = no hay nada que recuperar. */
export type OnboardingRecoveryDestination = "onboarding" | "edit_birth_data" | null;

export type OnboardingCompletion = {
  status: OnboardingCompletionStatus;
  recovery: OnboardingRecoveryDestination;
  profileReady: boolean;
  birthDataReady: boolean;
  chartReady: boolean;
};

/**
 * Destino derivado del estado autoritativo.
 *
 * - `app`: cuenta interna + datos natales persistidos. La carta puede estar
 *   `chart_pending` y se reintenta desde su propia superficie.
 * - `onboarding`: un alta iniciada en este flujo que todavía no cerró.
 * - `edit-birth-data`: una cuenta que ya existía y quedó incompleta. NUNCA se
 *   la manda al alta: el alta es create-only y volvería con conflicto.
 * - `sign-in`: la consulta dice que no hay identidad.
 */
export type ReadinessDestination = "app" | "onboarding" | "edit-birth-data" | "sign-in";

export function resolveReadinessDestination(completion: OnboardingCompletion): ReadinessDestination {
  if (completion.status === "signed_out") return "sign-in";
  // La autoridad sigue siendo el estado REMOTO completo, no una señal local.
  // La diferencia es qué prueba ese estado: datos natales persistidos, no la
  // disponibilidad instantánea del proveedor de cartas.
  if (completion.profileReady && completion.birthDataReady) return "app";
  return completion.recovery === "edit_birth_data" ? "edit-birth-data" : "onboarding";
}

/** ¿La carta derivada ya está lista para dibujarse? No gobierna el acceso. */
export function isChartReady(completion: OnboardingCompletion | undefined | null): boolean {
  return !!completion && completion.status === "chart_ready" && completion.chartReady;
}

/** ¿La cuenta ya puede salir del alta y entrar a Home? */
export function isBirthDataReady(completion: OnboardingCompletion | undefined | null): boolean {
  return !!completion && completion.profileReady && completion.birthDataReady;
}

/**
 * ¿El guardado obligatorio del alta sigue en curso? `chart_pending` ya no
 * participa: significa que los datos están guardados y sólo falta un derivado.
 */
export function isCompletionPending(completion: OnboardingCompletion | undefined | null): boolean {
  if (!completion) return true;
  return completion.status === "onboarding_incomplete";
}

// --- Identidad del borrador remoto -------------------------------------------

const DRAFT_ID_PREFIX = "orbita-signup-";

/**
 * Id del borrador remoto del alta. Se genera UNA vez por alta y sobrevive a la
 * vuelta de Clerk: es lo que permite adjuntar a la cuenta recién creada el
 * borrador que se guardó anónimo, con su `flowOrigin: "anonymous_signup"`.
 *
 * No lleva ningún dato de la persona: es un identificador opaco.
 */
export function createClientDraftId(random: () => number = Math.random): string {
  const rand = () => Math.floor(random() * 0xffffffff).toString(36).padStart(7, "0");
  return `${DRAFT_ID_PREFIX}${rand()}${rand()}`;
}

/** Un id de borrador aceptable: opaco, con el prefijo del alta y sin espacios. */
export function isClientDraftId(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(DRAFT_ID_PREFIX) && !/\s/.test(value) && value.length > DRAFT_ID_PREFIX.length;
}
