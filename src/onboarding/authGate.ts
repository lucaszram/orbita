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
 * Código con el que Apple informa que la persona CERRÓ la hoja del sistema.
 *
 * Lo publica `expo-apple-authentication` (`ASAuthorizationError.canceled`) y es
 * el mismo literal que reconoce el hook nativo de Clerk. Vive acá, junto a la
 * clasificación, porque es la otra mitad de la misma decisión: cancelar no es
 * un fallo.
 */
export const APPLE_SIGN_IN_CANCELLED = "ERR_REQUEST_CANCELED";

/**
 * ¿Este error es una CANCELACIÓN y no un fallo?
 *
 * Cerrar la hoja de Apple tiene que salir en silencio: la pantalla vuelve como
 * estaba, sin cartel rojo y sin perder nada — exactamente igual que cerrar el
 * navegador del proveedor, que ya salía por `createdSessionId: null`.
 *
 * El hook nativo de Clerk normalmente ya traduce esta cancelación a un
 * resultado sin sesión, así que esta guarda es la red de abajo: si el error
 * llegara crudo (otra versión del hook, o un `signInAsync` que se rechace por
 * fuera de ese camino), el acceso igual no muestra un error que no existió.
 * Función pura para poder demostrarlo sin montar la pantalla.
 */
export function isSsoCancellation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return (error as { code?: unknown }).code === APPLE_SIGN_IN_CANCELLED;
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

// ---------------------------------------------------------------------------
// Teléfono compartido: liberar el teléfono ANTES de empezar un alta real
// ---------------------------------------------------------------------------

/**
 * Prepara un teléfono COMPARTIDO antes de crear una cuenta nueva.
 *
 * Si este teléfono tiene un perfil con dueño, quien va a crear una cuenta NO
 * probó ser ese dueño: lo suyo se archiva BAJO SU CUENTA —recuperable al
 * volver a entrar, no se destruye— y recién entonces se limpia la vista local.
 * Sin esto la cuenta nueva hereda las guardadas y el diario del anterior:
 * `createProfile` sólo reemplaza perfil + dueño, no el resto del estado local.
 *
 * Esta garantía existía en la puerta legada de `/iniciar-sesion`
 * (`leaveWithoutSignIn`, el camino "Crear una cuenta"). Al unificar el acceso
 * en `AuthScreen` quedó sin dueño; acá vuelve al flujo canónico, enganchada al
 * ÚNICO punto donde efectivamente empieza un alta (`onBeforeSignup`, la
 * `seedMarker` de `startSignupGate`). Cambiar de modo, volver, cancelar o
 * entrar por el camino de ingreso no la disparan.
 *
 * **Falla cerrado.** Si el archivado o la limpieza fallan, esto RECHAZA: el
 * marcador no se siembra, Clerk no se invoca y la pantalla muestra su error de
 * alta con reintento. Antes que dejar datos ajenos a la vista, no se empieza.
 *
 * `released` es el candado de la instancia (un `useRef` en el flujo): se cierra
 * SÓLO después de una liberación completa, así que un fallo se puede reintentar
 * y un alta reintentada después del éxito no vuelve a archivar.
 */
export async function releaseSharedDevice(args: {
  released: { current: boolean };
  /** Dueño del perfil local (clerkUserId), o null si no hay nada que liberar. */
  profileOwner: string | null;
  archiveAccountData: (userId: string) => Promise<void>;
  resetApp: () => Promise<void>;
}): Promise<void> {
  if (args.released.current) return;
  if (!args.profileOwner) return;
  await args.archiveAccountData(args.profileOwner);
  await args.resetApp();
  args.released.current = true;
}
