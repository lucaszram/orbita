import { runSessionAttempts } from "./sessionStart";

/**
 * Alta anónima: el borrador remoto se guarda y se confirma SIN identidad.
 *
 * ## Por qué existe este módulo
 *
 * `convex/onboarding.ts` no acepta este par de llamadas de cualquier manera:
 *
 * - `saveDraft` mira `getOrCreateUser(ctx)`. Con identidad escribe `userId` y
 *   `accountState: "created"`; sin identidad deja `accountState: "anonymous"` y
 *   `flowOrigin: "anonymous_signup"`.
 * - `confirmSignupDraft` **exige contexto anónimo**: si `getUserIdentity()`
 *   devuelve algo, tira `ONBOARDING_SIGNUP_DRAFT_REQUIRES_ANONYMOUS_CONTEXT`; y
 *   sólo devuelve `ready` si el borrador sigue siendo anónimo y de origen
 *   `anonymous_signup`.
 *
 * El cliente compartido de Convex está atado a Clerk (`ConvexProviderWithAuth`):
 * su token aparece **cuando Clerk lo resuelve**, no cuando el alta lo decide.
 * Una sesión que se hidrata desde el token cache, o un token que llega tarde,
 * puede aparecer con esta cadena EN VUELO — la cadena se reintenta hasta veinte
 * segundos. Y el daño no es una llamada fallida: el `saveDraft` autenticado deja
 * el borrador con `userId` y `accountState: "created"`, así que a partir de ahí
 * `confirmSignupDraft` tira `ONBOARDING_SIGNUP_DRAFT_INCOMPLETE` **para
 * siempre**, aunque la sesión vuelva a irse. El alta queda trabada y la persona
 * no tiene forma de destrabarla.
 *
 * Por eso el transporte se pasa desde afuera y es, explícitamente, uno que
 * nunca lleva credenciales (`src/services/anonymousOnboardingTransport.ts`). El
 * contexto anónimo deja de depender del estado de Clerk en ese milisegundo: es
 * una propiedad del canal, no una carrera que a veces se gana.
 *
 * El backend NO cambia: la guardia anónima sigue siendo suya y es la que manda.
 */

export type SignupDraftInput = {
  clientDraftId: string;
  currentStep: number;
  identity?: "ella" | "el" | "prefiero_no_decirlo";
  /**
   * Opcionales, igual que en el validador del backend: el flujo auth-first
   * guarda un borrador MÍNIMO (sólo `clientDraftId` + paso) antes de crear la
   * cuenta, como marcador de "alta en curso". Los datos natales llegan después,
   * por el camino autenticado (`completeBirthData`).
   */
  birthDate?: string;
  birthTime?: string;
  birthTimePrecision?: "known" | "approximate" | "unknown";
  birthPlaceLabel?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
};

/**
 * Las dos mutaciones del alta anónima, ya atadas a un canal.
 *
 * El nombre no es decorativo: quien implemente esto tiene que garantizar que
 * **nunca** manda un token. Un transporte que "casi siempre" es anónimo es
 * exactamente el defecto que este módulo cierra.
 */
export type AnonymousSignupDraftTransport = {
  saveDraft: (args: SignupDraftInput) => Promise<unknown>;
  confirmSignupDraft: (args: { clientDraftId: string }) => Promise<unknown>;
};

/** Presupuestos de la cadena idempotente (ver `runSessionAttempts`). */
export const SIGNUP_DRAFT_BUDGET_MS = 20000;
export const SIGNUP_DRAFT_CALL_TIMEOUT_MS = 6000;
export const SIGNUP_DRAFT_RETRY_PAUSE_MS = 800;

/** Lo único que el alta interpreta: el borrador no quedó listo, no se abre Clerk. */
export const SIGNUP_DRAFT_NOT_READY = "ONBOARDING_SIGNUP_DRAFT_NOT_READY";

/**
 * Persiste el borrador remoto del alta y espera su confirmación.
 *
 * Acá NO se valida contra `validateBirthPayload`: la zona horaria es un
 * enriquecimiento que el backend resuelve solo DESPUÉS de guardar el borrador.
 * Exigirla antes de escribir impediría justamente el guardado que dispara esa
 * resolución. El juez es `confirmSignupDraft`.
 *
 * Se reintenta porque un enriquecimiento en vuelo no es un error, y la persona
 * no tiene que volver atrás ni elegir una zona. Rechaza si al agotar el
 * presupuesto sigue incompleto: en ese caso NO se abre Clerk. Crear la identidad
 * primero es exactamente lo que produce cuentas huérfanas.
 */
export async function persistSignupDraft(
  transport: AnonymousSignupDraftTransport,
  input: SignupDraftInput,
  /** Inyectables para tests; en producción no se pasan. */
  clock?: { now?: () => number; sleep?: (ms: number) => Promise<void> }
): Promise<void> {
  const result = await runSessionAttempts({
    budgetMs: SIGNUP_DRAFT_BUDGET_MS,
    callTimeoutMs: SIGNUP_DRAFT_CALL_TIMEOUT_MS,
    retryPauseMs: SIGNUP_DRAFT_RETRY_PAUSE_MS,
    now: clock?.now,
    sleep: clock?.sleep,
    attempt: async (timebox) => {
      // Idempotente por `clientDraftId`: reintentar actualiza la MISMA fila.
      await timebox(transport.saveDraft(input));
      await timebox(transport.confirmSignupDraft({ clientDraftId: input.clientDraftId }));
      return true as const;
    }
  });
  if (result.status === "error") throw new Error(SIGNUP_DRAFT_NOT_READY);
}
