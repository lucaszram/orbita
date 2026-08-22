/**
 * Puerta PURA del alta: el marcador remoto de "alta en curso" es imprescindible
 * y va ANTES de crear la identidad.
 *
 * Sin ese marcador, `getCompletionStatus` clasifica la cuenta recién creada
 * como una cuenta preexistente incompleta (`edit_birth_data`) y el remonte web
 * la saca del onboarding. Por eso, si el marcador no se pudo guardar, Clerk NO
 * se invoca: la pantalla dice el fallo en español y el reintento vuelve a
 * empezar por el marcador.
 *
 * Módulo sin React para poder demostrar la secuencia con tests: falla el
 * marcador → la identidad no se crea; reintento exitoso → recién entonces sí.
 */

export type SignupGateOutcome = "marker_failed" | "started";

// ---------------------------------------------------------------------------
// Resultado del SSO (Apple/Google): cuenta nueva, cuenta existente o nada.
// ---------------------------------------------------------------------------

/**
 * Qué resolvió Clerk al cerrar el navegador del proveedor.
 *
 * `startSSOFlow` devuelve los recursos `signIn` y `signUp`: la sesión creada
 * sale de UNO de los dos, y eso es lo que distingue un alta genuinamente nueva
 * (recurso de alta) de una cuenta que YA existía (recurso de ingreso). El
 * booleano anterior no lo decía, y una cuenta OAuth preexistente incompleta
 * conservaba el marcador `anonymous_signup` y era reclasificada como alta
 * nueva en vez de ir a su recuperación (`/editar-datos`).
 */
export type SsoOutcome = "new_account" | "existing_account" | "cancelled";

/**
 * Clasificación PURA del resultado de `startSSOFlow`, EXCLUSIVAMENTE por
 * coincidencia del id de la sesión creada con su recurso.
 *
 * - Sin sesión creada → `cancelled` (cierre del navegador, MFA pendiente o
 *   error): no hay nada que activar ni que descartar.
 * - `signUpCreatedSessionId === createdSessionId` → `new_account`.
 * - `signInCreatedSessionId === createdSessionId` → `existing_account`.
 * - Sin coincidencia clara → `existing_account`, deliberadamente: el lado
 *   seguro es DESCARTAR el marcador. Con el marcador descartado, la consulta
 *   autoritativa clasifica la cuenta por lo que está PERSISTIDO (completa →
 *   app; incompleta → editor); conservar un marcador de alta nueva para una
 *   cuenta que quizás ya existía es lo que reclasificaba datos ajenos.
 *
 * Los `status` de los recursos NO participan a propósito: `signUp` puede
 * conservar el estado de un intento PREVIO (`status: "complete"` con otra
 * sesión) mientras la sesión actual pertenece al `signIn` — clasificar por
 * status reetiquetaba esa cuenta existente como alta nueva.
 */
export function classifySsoOutcome(args: {
  createdSessionId: string | null | undefined;
  signUpCreatedSessionId: string | null | undefined;
  signInCreatedSessionId: string | null | undefined;
}): SsoOutcome {
  if (!args.createdSessionId) return "cancelled";
  if (args.signUpCreatedSessionId === args.createdSessionId) return "new_account";
  return "existing_account";
}

/**
 * Qué `clientDraftId` recibe `getCompletionStatus`.
 *
 * Con el marcador DESCARTADO (ingreso, alta que cayó a sign-in, SSO que
 * resolvió una cuenta existente) la consulta corre SIN id: la clasificación
 * vuelve a ser la persistida y una cuenta preexistente incompleta va a su
 * recuperación. Con el marcador vigente, el id viaja y el alta en curso se
 * reconoce como tal. Función pura: es la única fuente del argumento y los
 * tests conductuales la ejercitan tal cual la usa el flujo.
 */
export function completionDraftIdFor(args: {
  markerDiscarded: boolean;
  clientDraftId: string | null;
}): string | undefined {
  if (args.markerDiscarded) return undefined;
  return args.clientDraftId ?? undefined;
}

export async function startSignupGate(args: {
  /** Siembra el marcador remoto. `undefined` = sin backend (alta local). */
  seedMarker?: () => Promise<void>;
  /** Crea la identidad (Clerk). SÓLO corre con el marcador guardado. */
  createAccount: () => Promise<void>;
}): Promise<SignupGateOutcome> {
  if (args.seedMarker) {
    try {
      await args.seedMarker();
    } catch {
      return "marker_failed";
    }
  }
  await args.createAccount();
  return "started";
}
