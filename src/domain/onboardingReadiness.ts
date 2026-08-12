/**
 * Readiness del alta — la ÚNICA autoridad de acceso.
 *
 * Contrato `onboarding.getCompletionStatus` (convex/CHANGELOG.md, 2026-08-11).
 * Lo que habilita Órbita no es `isSignedIn`, ni un paso local, ni el retorno de
 * `completeBirthData`: es el estado PERSISTIDO que confirma cuenta interna,
 * datos natales válidos y una carta natal calculada exactamente para esos datos.
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
 * - `app`: sólo con la carta persistida y verificada (`chart_ready`).
 * - `onboarding`: un alta iniciada en este flujo que todavía no cerró.
 * - `edit-birth-data`: una cuenta que ya existía y quedó incompleta. NUNCA se
 *   la manda al alta: el alta es create-only y volvería con conflicto.
 * - `sign-in`: la consulta dice que no hay identidad.
 */
export type ReadinessDestination = "app" | "onboarding" | "edit-birth-data" | "sign-in";

export function resolveReadinessDestination(completion: OnboardingCompletion): ReadinessDestination {
  if (completion.status === "signed_out") return "sign-in";
  if (completion.status === "chart_ready") {
    // Doble condición a propósito: el estado y el booleano que lo sostiene.
    // Ninguna otra señal (sesión activa, birthData suelto, paso local) abre Home.
    if (completion.chartReady) return "app";
    // Estado incoherente: dice `chart_ready` pero no hay carta. No se abre la
    // app, y tampoco se manda al alta —que es create-only y volvería con
    // conflicto para una cuenta que ya existe—. El destino conservador es el
    // editor, donde se puede completar y recalcular sin borrar nada. Su
    // `recovery` viene en `null`, así que no puede decidirlo por sí solo.
    return "edit-birth-data";
  }
  return completion.recovery === "edit_birth_data" ? "edit-birth-data" : "onboarding";
}

/** ¿Ya se puede entrar? Es el único predicado que autoriza Home/Recepción. */
export function isChartReady(completion: OnboardingCompletion | undefined | null): boolean {
  return !!completion && completion.status === "chart_ready" && completion.chartReady;
}

/**
 * ¿La finalización sigue en curso? Con el alta anónima ya adjuntada, el cierre
 * escribe datos natales y calcula la carta: hasta que la carta esté persistida
 * el estado autoritativo es `chart_pending` (o `onboarding_incomplete` si la
 * escritura todavía no llegó). No es un error: es trabajo en vuelo.
 */
export function isCompletionPending(completion: OnboardingCompletion | undefined | null): boolean {
  if (!completion) return true;
  return completion.status === "onboarding_incomplete" || completion.status === "chart_pending";
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
