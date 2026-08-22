import type { AccountDestination } from "@/domain/accountDestination";
import type { SessionPhase, UserRowState } from "@/domain/screenPhase";

/**
 * Confianza de sesión: qué se SABE de la identidad en este render (QA23-007).
 *
 * ## El defecto medido en el build 23
 *
 * Un timeout de Clerk —o del handshake con Convex, o de la fila `users`— se
 * comportaba como si no hubiera cuenta. Con la sesión restaurada del llavero
 * pero sin red, `useConvexAuth` nunca confirma el token, así que
 * `liveAppGate` deja `isAuthLoading` en true para siempre y `AccountGate` se
 * queda en un spinner que no termina nunca; y si `getOrCreateCurrentUser`
 * agota sus tres intentos, el destino pasa a `retry` y la app entera queda
 * tapada por una pantalla de error. Las dos cosas son lo mismo: **no poder
 * confirmar la sesión se estaba leyendo como no tenerla**.
 *
 * ## Los cinco estados, y por qué son cinco
 *
 * Colapsarlos es exactamente el defecto. Se distinguen a propósito:
 *
 * - `loading` — todavía no se sabe y todavía hay plazo. No se afirma nada.
 * - `confirmed-signed-in` — Clerk publica sesión, Convex validó el token, la
 *   fila `users` es de ESE dueño y el estado autoritativo de la cuenta llegó.
 *   Es lo ÚNICO que autoriza una operación sensible.
 * - `confirmed-signed-out` — Clerk terminó de cargar y afirma que no hay
 *   sesión. Es una respuesta, no una espera: el gate se conserva y **nada
 *   local se toca** (la regla no destructiva de `resolveStart` no cambia).
 * - `transient-unavailable` — se agotó el plazo sin poder confirmar y no hay
 *   identidad local segura contra la cual atribuir lo que hay en disco. Se
 *   ofrece reintento; NO se abre nada.
 * - `degraded-local` — ese mismo fracaso, pero con identidad local segura: el
 *   dueño del perfil en disco es exactamente el dueño vigente. Se abre el shell
 *   con los últimos datos de ESA cuenta, con aviso y sin autoridad de escritura.
 *
 * ## La línea que no se cruza
 *
 * Degradar **no** afloja la identidad: exige un dueño vigente y que coincida
 * exactamente con el dueño persistido del perfil y con el de cada snapshot
 * local que la superficie vaya a publicar. Lo que cambió respecto de la primera
 * versión de este módulo es de dónde puede salir ese dueño, porque con una sola
 * fuente el bloque no cubría su propio caso de aceptación:
 *
 * 1. **Vivo** — Clerk publicó un `userId` en ESTE proceso. Cubre el corte de
 *    red con Clerk ya cargado (el handshake de Convex que no cierra).
 * 2. **Previamente confirmado** — el último dueño que ESTA app confirmó, leído
 *    del almacenamiento seguro nativo (`expo-secure-store`, ver
 *    `@/domain/secureIdentity`). Cubre el timeout COMPLETO de Clerk, que es el
 *    caso real de "abro la app sin red con la sesión en el llavero": ahí Clerk
 *    no publica nada y con la regla anterior el producto entero quedaba tapado.
 *
 * La segunda fuente no afloja nada porque sólo se escribe con la sesión
 * `confirmed-signed-in`, se borra ante un signed-out confirmado y ante todo
 * cambio de identidad, y un error de lectura o de escritura la deja en nada. En
 * web no existe: `localStorage` no es almacenamiento seguro y fingir que lo es
 * sería peor que no tener la función, así que la web falla cerrada.
 *
 * Y mientras esa identidad todavía se está hidratando no se decide nada con
 * ella: el vínculo local queda en `unknown`, que no abre.
 *
 * Módulo puro: no importa React ni React Native, así que las pruebas lo
 * ejecutan de verdad en vez de leerlo como texto.
 */

export type SessionConfidence =
  | "loading"
  | "confirmed-signed-in"
  | "confirmed-signed-out"
  | "transient-unavailable"
  | "degraded-local";

/** Las cinco, para que una prueba pueda recorrer la matriz completa. */
export const SESSION_CONFIDENCES = [
  "loading",
  "confirmed-signed-in",
  "confirmed-signed-out",
  "transient-unavailable",
  "degraded-local"
] as const satisfies readonly SessionConfidence[];

/**
 * Cuánto se espera una confirmación antes de llamarla fracaso.
 *
 * Es el MISMO plazo que ya usaban `src/routes/v492/index.tsx` y el gate de las
 * pestañas para el `isLoaded` de Clerk: con dos números distintos, la raíz y el
 * shell decidían en momentos distintos sobre el mismo hecho.
 */
export const SESSION_CONFIRMATION_TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// Identidad local
// ---------------------------------------------------------------------------

/**
 * Qué se puede probar sobre el dueño de lo que hay en este dispositivo.
 *
 * `unproven` y `foreign` son distintos a propósito: el primero es "no hay
 * identidad vigente contra la cual atribuirlo" y el segundo "está atribuido a
 * otra cuenta". Ninguno de los dos abre nada, pero decirlos igual escondería que
 * hay un caso —el de la instalación con sesión perdida— que no es un conflicto
 * de cuentas sino una falta de prueba.
 *
 * `unknown` cubre dos esperas, y también son la misma respuesta: el disco
 * todavía no se leyó, o el llavero todavía no contestó. Mientras cualquiera de
 * las dos siga abierta no se afirma nada sobre de quién es lo que hay acá.
 */
export type LocalIdentityBinding = "unknown" | "none" | "unowned" | "unproven" | "foreign" | "secure";

export type LocalIdentitySignals = {
  /** El disco ya se leyó (`isReady` de `useAppState`). */
  localReady: boolean;
  hasLocalProfile: boolean;
  /** Dueño persistido del perfil (`orbita:profile-owner`). */
  localOwner: string | null;
  /** Dueño publicado por Clerk EN ESTE RENDER. */
  clerkUserId: string | null;
  clerkSignedIn: boolean;
  /**
   * Dueños de cada snapshot local que la superficie va a leer.
   *
   * El plan cacheado, el archivo de cuenta y el marcador de compra ya viven en
   * claves por cuenta; esto es el cierre explícito de la regla: si uno solo de
   * ellos no es del mismo dueño, la identidad no es segura y no se abre nada.
   * Opcional porque la mayoría de las superficies no lee ninguno.
   */
  snapshotOwners?: readonly (string | null)[];
  /**
   * ¿Esta plataforma tiene almacenamiento seguro nativo?
   *
   * `false` en web, y por eso la web falla cerrada: `localStorage` es legible
   * por cualquier script del origen, así que guardar ahí "el último dueño
   * confirmado" no sería una prueba de identidad sino una decoración con forma
   * de prueba. Sin dueño vivo, la web conserva el gate.
   *
   * Opcional y con default `false`: quien no declare la fuente segura no puede
   * abrir por ella.
   */
  secureIdentitySupported?: boolean;
  /**
   * La lectura del almacenamiento seguro TERMINÓ (con registro o sin él).
   *
   * Default `true` para que unas señales que ni mencionan la identidad previa se
   * lean como "no hay ninguna y ya está decidido" en vez de como una espera
   * eterna. Quien la usa de verdad la declara.
   */
  secureIdentityReady?: boolean;
  /** La lectura del almacenamiento seguro falló. No abre nada. */
  secureIdentityError?: boolean;
  /** Último dueño CONFIRMADO por esta app, leído del almacenamiento seguro. */
  secureOwner?: string | null;
};

/**
 * De dónde sale el dueño vigente, si es que hay uno.
 *
 * Se devuelve la FUENTE y no sólo el id porque las dos vías no valen lo mismo en
 * ningún otro lado: `live` es la de siempre y `secure-prior` sólo puede leer, y
 * sólo después de coincidir con todo lo que hay en disco.
 */
export type LocalViewerSource = "live" | "secure-prior" | "pending" | "none";

export type LocalViewer = { source: LocalViewerSource; owner: string | null };

export function resolveLocalViewer(s: LocalIdentitySignals): LocalViewer {
  // 1. Clerk publicó un dueño en este proceso: manda siempre.
  if (s.clerkSignedIn && s.clerkUserId) return { source: "live", owner: s.clerkUserId };
  // 2. Clerk afirma que HAY sesión pero todavía no dice de quién. No se adivina:
  //    atribuirla al último dueño guardado sería inventar quién está mirando.
  if (s.clerkSignedIn) return { source: "none", owner: null };
  // 3. Recién sin sesión publicada puede hablar la identidad previamente
  //    confirmada, y sólo donde existe de verdad.
  if (!s.secureIdentitySupported) return { source: "none", owner: null };
  if (s.secureIdentityError) return { source: "none", owner: null };
  // Todavía no contestó el llavero: no se decide con la identidad a medio leer.
  if (s.secureIdentityReady === false) return { source: "pending", owner: null };
  if (!s.secureOwner) return { source: "none", owner: null };
  return { source: "secure-prior", owner: s.secureOwner };
}

export function resolveLocalIdentity(s: LocalIdentitySignals): LocalIdentityBinding {
  if (!s.localReady) return "unknown";
  if (!s.hasLocalProfile) return "none";
  // Perfil de invitado o legado: no hay cuenta a la cual atribuirlo, así que
  // tampoco hay nada que "recuperar" en modo degradado.
  if (!s.localOwner) return "unowned";
  const viewer = resolveLocalViewer(s);
  // La identidad segura todavía se está hidratando: no se afirma nada sobre el
  // disco hasta que termine. No mostrar es la respuesta correcta mientras tanto.
  if (viewer.source === "pending") return "unknown";
  // Sin dueño vigente —ni vivo ni previamente confirmado— no se puede demostrar
  // que lo de disco sea de quien está mirando. Fail closed.
  if (!viewer.owner) return "unproven";
  if (s.localOwner !== viewer.owner) return "foreign";
  // Cada snapshot tiene que coincidir con el MISMO dueño. `null` incluido: un
  // snapshot sin dueño no se puede atribuir.
  if (s.snapshotOwners?.some((owner) => owner !== s.localOwner)) return "foreign";
  return "secure";
}

/** Único predicado que puede autorizar una degradación. */
export function localIdentityIsSecure(binding: LocalIdentityBinding): boolean {
  return binding === "secure";
}

/**
 * El dueño con el que se puede publicar un dato en pantalla.
 *
 * Un dueño VIVO se publica tal cual —quien decide después si un dato concreto es
 * suyo es `ownedDataReadable`—. Un dueño previamente confirmado, en cambio, sólo
 * vale si la identidad local entera cerró contra él: perfil y todos los
 * snapshots declarados. Es la diferencia entre "sé quién está mirando" y "creo
 * recordar de quién es esto".
 */
export function publishableViewer(s: LocalIdentitySignals): string | null {
  const viewer = resolveLocalViewer(s);
  if (viewer.source === "live") return viewer.owner;
  if (viewer.source !== "secure-prior") return null;
  return resolveLocalIdentity(s) === "secure" ? viewer.owner : null;
}

// ---------------------------------------------------------------------------
// Confianza
// ---------------------------------------------------------------------------

export type SessionSignals = LocalIdentitySignals & {
  /** Convex + Clerk configurados. Sin envs no hay sesión que confirmar. */
  backendConfigured: boolean;
  /** `isLoaded` REAL de Clerk. El timeout NO se disfraza de "cargado". */
  clerkLoaded: boolean;
  /** Convex validó el token de esa sesión (`useConvexAuth`). */
  convexAuthenticated: boolean;
  /** Estado de la fila `users` leído para el dueño vigente. */
  userRow: UserRowState;
  /**
   * El estado autoritativo de la cuenta (`onboarding.getCompletionStatus`) ya
   * resolvió. Sin él la sesión puede estar viva y la app igual no saber qué
   * mostrar, y ésa también es una confirmación que puede no llegar.
   */
  authoritativeResolved: boolean;
  /** Venció `SESSION_CONFIRMATION_TIMEOUT_MS` sin cerrar la confirmación. */
  confirmationTimedOut: boolean;
};

export function resolveSessionConfidence(s: SessionSignals): SessionConfidence {
  // Sin envs no existe Clerk: no hay sesión que confirmar y eso es una
  // respuesta, no una espera. La app corre local-first y el destino lo decide
  // `resolveAccountDestination`, que corta antes de llegar acá.
  if (!s.backendConfigured) return "confirmed-signed-out";
  // Sin el disco leído no se puede evaluar la identidad local, así que tampoco
  // se puede decidir si una degradación sería segura.
  if (!s.localReady) return "loading";
  if (!s.clerkLoaded) return sinConfirmar(s);
  // Clerk resolvió y dice que no hay sesión. Se le cree: es la misma regla no
  // destructiva de siempre —el gate vuelve, y el perfil, las guardadas y el
  // diario siguen intactos en disco esperando a su dueño—.
  if (!s.clerkSignedIn) return "confirmed-signed-out";
  if (s.convexAuthenticated && s.userRow === "ready" && s.authoritativeResolved) {
    return "confirmed-signed-in";
  }
  return sinConfirmar(s);
}

/**
 * Hay una sesión declarada que no se pudo confirmar (todavía, o ya no).
 *
 * `userRow === "error"` no espera al plazo: `getOrCreateCurrentUser` ya agotó
 * sus tres intentos con espera creciente, así que ESE es su timeout.
 */
function sinConfirmar(s: SessionSignals): SessionConfidence {
  const agotado = s.confirmationTimedOut || s.userRow === "error";
  if (!agotado) return "loading";
  return localIdentityIsSecure(resolveLocalIdentity(s)) ? "degraded-local" : "transient-unavailable";
}

/** ¿Esta confianza permite leer datos de la cuenta en pantalla? */
export function confidenceOpensShell(confidence: SessionConfidence): boolean {
  return confidence === "confirmed-signed-in" || confidence === "degraded-local";
}

// ---------------------------------------------------------------------------
// Operaciones sensibles
// ---------------------------------------------------------------------------

/**
 * Todo lo que puede cobrar, borrar o reescribir la cuenta.
 *
 * Se enumeran para que la regla sea TOTAL: agregar una operación obliga a
 * declarar qué confianza exige, en vez de heredar por descuido la de al lado.
 */
export type SensitiveOperation =
  | "purchase"
  | "restore-purchase"
  | "manage-subscription"
  | "account-delete"
  | "natal-edit"
  | "account-write";

export const SENSITIVE_OPERATIONS = [
  "purchase",
  "restore-purchase",
  "manage-subscription",
  "account-delete",
  "natal-edit",
  "account-write"
] as const satisfies readonly SensitiveOperation[];

/**
 * La confianza EXACTA que exige cada operación.
 *
 * Hoy son todas la misma, y está escrito una por una a propósito: la tabla es
 * el lugar donde se vería si alguna vez alguien aflojara una sola.
 */
const OPERATION_REQUIREMENT: Readonly<Record<SensitiveOperation, SessionConfidence>> = {
  purchase: "confirmed-signed-in",
  "restore-purchase": "confirmed-signed-in",
  "manage-subscription": "confirmed-signed-in",
  "account-delete": "confirmed-signed-in",
  "natal-edit": "confirmed-signed-in",
  "account-write": "confirmed-signed-in"
};

export function sensitiveOperationAllowed(
  operation: SensitiveOperation,
  confidence: SessionConfidence
): boolean {
  return confidence === OPERATION_REQUIREMENT[operation];
}

/**
 * Por qué no se puede hacer, dicho donde se intenta.
 *
 * Nunca promete que va a andar en un momento ni culpa a la persona: dice qué
 * falta (confirmar la sesión) y qué NO pasó (no se cobró, no se borró, no se
 * cambió nada).
 */
export function sensitiveOperationBlockMessage(operation: SensitiveOperation): string {
  switch (operation) {
    case "purchase":
      return "Necesitamos confirmar tu sesión antes de cobrar nada. No se hizo ningún cargo: revisá tu conexión y probá de nuevo.";
    case "restore-purchase":
      return "Para restaurar tu compra necesitamos confirmar tu sesión. Revisá tu conexión y probá de nuevo.";
    case "manage-subscription":
      return "Para gestionar tu suscripción necesitamos confirmar tu sesión. Revisá tu conexión y probá de nuevo.";
    case "account-delete":
      return "Para eliminar tu cuenta necesitamos confirmar tu sesión. No borramos nada; revisá tu conexión y probá de nuevo.";
    case "natal-edit":
      return "Para editar tus datos de nacimiento necesitamos confirmar tu sesión. No cambiamos nada; revisá tu conexión y probá de nuevo.";
    case "account-write":
      return "No pudimos confirmar tu sesión, así que no guardamos esto en tu cuenta. Revisá tu conexión y probá de nuevo.";
  }
}

// ---------------------------------------------------------------------------
// Superficies
// ---------------------------------------------------------------------------

/**
 * Qué le exige una superficie a la sesión.
 *
 * `read` abre con `degraded-local` —es leer los últimos datos de la propia
 * cuenta—; `confirmed-session` no abre nunca sin confirmación, y es lo que
 * declara toda ruta cuya razón de ser es una operación sensible (el pago).
 */
export type SurfaceRequirement = "read" | "confirmed-session";

export function surfaceOpensUnderConfidence(
  requirement: SurfaceRequirement,
  confidence: SessionConfidence
): boolean {
  if (confidence === "confirmed-signed-in") return true;
  return requirement === "read" && confidence === "degraded-local";
}

/**
 * Aplica la resiliencia sobre el destino ya resuelto.
 *
 * Sólo degrada un "todavía no sé": `loading` (Clerk/Convex sin cerrar) y
 * `retry` (la fila `users` agotó sus intentos). Un destino RESUELTO manda
 * siempre —`sign-in` sigue mandando al login y `onboarding` al alta—, y
 * `bootstrap` tampoco se toca: significa que hay datos locales todavía sin
 * aislar, que es justo lo contrario de una identidad segura.
 */
export function applySessionResilience(
  base: AccountDestination,
  confidence: SessionConfidence
): AccountDestination {
  if (confidence !== "degraded-local") return base;
  return base === "loading" || base === "retry" ? "degraded" : base;
}

/**
 * ¿Se puede publicar en pantalla un dato de disco atado a `dataOwner`?
 *
 * La regla de oro del bloque: **nunca datos de otra cuenta**. Sin dueño vigente
 * o sin dueño en el dato no se publica —no se puede demostrar de quién es—, y
 * con dueños distintos tampoco. Vale igual para la sesión confirmada y para la
 * degradada: degradar no cambia de quién son los datos.
 */
export function ownedDataReadable(input: {
  confidence: SessionConfidence;
  /** Dueño vigente según Clerk. */
  viewer: string | null;
  /** Dueño con el que el dato quedó guardado. */
  dataOwner: string | null;
}): boolean {
  if (!confidenceOpensShell(input.confidence)) return false;
  if (!input.viewer || !input.dataOwner) return false;
  return input.viewer === input.dataOwner;
}

/**
 * La fase de sesión que ven las secciones, corregida por la confianza.
 *
 * Sin esto, el shell degradado abría y cada sección se quedaba en
 * `cargando` para siempre: `liveAppGate` deja `isAuthLoading` en true mientras
 * el handshake no cierra, y un spinner eterno no es un estado —es una promesa
 * que no se cumple—. Con la sesión sin confirmar, cada sección muestra su
 * error y su reintento, que es lo que de verdad se puede ofrecer.
 */
export function sessionPhaseUnderConfidence(
  phase: SessionPhase,
  confidence: SessionConfidence
): SessionPhase {
  if (confidence === "degraded-local" || confidence === "transient-unavailable") return "error";
  return phase;
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/** Aviso del shell degradado. Cuenta qué se ve y qué no se puede hacer. */
export const DEGRADED_SESSION_TITLE = "Sin conexión con tu cuenta.";
export const DEGRADED_SESSION_BODY =
  "Estás viendo lo último que guardamos en este teléfono. Hasta que volvamos a confirmar tu sesión no vas a poder comprar, editar tus datos de nacimiento ni eliminar tu cuenta.";

/**
 * QUÉ se ve exactamente, dicho sin redondear.
 *
 * «Lo último que guardamos» es cierto pero incompleto, y la parte que falta es
 * justo la que genera la decepción: en este teléfono viven el perfil, las
 * lecturas guardadas y el diario, y NADA más. Las capas del día, los vínculos y
 * el plan se calculan en la cuenta y Convex no los persiste en el aparato, así
 * que esas secciones no tienen un último valor que mostrar — muestran su
 * bloqueo con reintento, y prometer otra cosa acá sería mentir en el aviso que
 * existe para no mentir.
 */
export const DEGRADED_SESSION_COVERAGE =
  "En este teléfono quedaron tu perfil, tus lecturas guardadas y tu diario. Las capas del día, tus vínculos y tu plan se calculan en tu cuenta: hasta que volvamos a conectar, esas secciones no muestran nada y te ofrecen volver a intentarlo.";
export const SESSION_RETRY_LABEL = "REINTENTAR";
export const DEGRADED_SESSION_A11Y_HINT = "Volvé a intentar confirmar tu sesión sin cerrar la app.";

/** Bloqueo de una superficie que exige sesión confirmada (el pago). */
export const UNCONFIRMED_SESSION_TITLE = "No pudimos confirmar tu sesión.";
export const UNCONFIRMED_SESSION_BODY =
  "Parece que no hay conexión. No tocamos nada de este teléfono ni de tu cuenta; probá de nuevo.";

/** Aviso del gate cuando ni siquiera se puede atribuir lo que hay en disco. */
export const TRANSIENT_SESSION_TITLE = "No pudimos confirmar tu sesión.";
export const TRANSIENT_SESSION_BODY =
  "No vamos a mostrar datos de una cuenta que no podemos verificar. Revisá tu conexión y probá de nuevo.";
