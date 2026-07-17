import type { OnboardingProfile } from "./types";

/**
 * Resolver puro del arranque nativo (hotfix build 11). `app/index.tsx` junta
 * el estado real (storage local, Clerk, recuperación Convex) y esta función
 * decide UNA cosa: qué mostrar. Reglas (docs/handoff-build11-session-navigation.md):
 *
 * DECISIÓN DE PRODUCTO (2026-07-16, Lucas): **Órbita no tiene Home invitada.**
 * Sin sesión confirmada no se renderiza Home, Tránsitos, Umbral ni Perfil.
 *
 *  - Clerk cargando → loading; NUNCA afirmar "invitado" mientras carga.
 *  - Sesión válida + datos (locales o en Convex) → Home.
 *  - Sesión válida sin datos de nacimiento → continuar el alta (sin 2da cuenta).
 *  - Sin sesión + perfil CON dueño → login, conservando TODO lo local.
 *  - Sin sesión + sin perfil (instalación nueva) → entrada del onboarding.
 *  - Sin sesión + perfil SIN dueño (guest de una versión vieja) → entrada: no
 *    hay cuenta a la cual iniciar sesión y la entrada ofrece las dos puertas.
 *    Su perfil, guardadas y diario quedan intactos en disco.
 *  - Error real recuperando la cuenta → reintento; nunca fingir que está listo.
 *
 * El arranque NO tiene ninguna decisión destructiva. Antes existía
 * `purge-local`: con Clerk confirmando signed-out y un perfil con dueño, el
 * arranque borraba todo lo local dando por hecho que eran restos de un logout.
 * Una sesión PERDIDA (upgrade de build, token invalidado, storage de Clerk
 * reseteado) da exactamente ese mismo estado, y ahí la purga borraba el perfil,
 * las guardadas y el diario de un usuario que solo tenía que volver a entrar.
 * La sesión ahora se recupera pidiendo login; lo local se conserva siempre y
 * solo se limpia desde un logout explícito del Perfil (`resetApp`).
 */

export type RecoveryState = "idle" | "loading" | "done" | "error";

/**
 * Dueño del perfil local (clave `orbita:profile-owner`, fuera de UserProfile):
 * "none" = guest o perfil legado sin marcar; "current" = la sesión activa;
 * "other" = otra cuenta o un logout que no terminó de limpiar.
 */
export type LocalProfileOwner = "none" | "current" | "other";

export type StartSnapshot = {
  /** Convex + Clerk configurados (sin envs la app es 100% local). */
  backendConfigured: boolean;
  /** AsyncStorage ya hidratado (isReady de useAppState). */
  localReady: boolean;
  hasLocalProfile: boolean;
  localProfileOwner: LocalProfileOwner;
  /** Clerk terminó de cargar la sesión persistida (isLoaded REAL, sin atajos). */
  clerkLoaded: boolean;
  /** Clerk tardó demasiado (red caída, etc.). NO equivale a signed-out. */
  clerkTimedOut: boolean;
  isSignedIn: boolean;
  /**
   * El alta acaba de crear el perfil con la sesión ya activa pero `useAuth`
   * todavía stale: el dueño se adopta apenas Clerk publique el userId
   * (`shouldAdoptPendingProfile`). En esa ventana el perfil se ve "sin dueño"
   * y signed-out sin serlo — no se decide nada, se espera.
   */
  profileAdoptionPending: boolean;
  /** Estado de la recuperación remota (sesión sin perfil local PROPIO). */
  recovery: RecoveryState;
  /** La recuperación encontró birthData en Convex. */
  hasRemoteBirthData: boolean;
};

export type StartDecision =
  | "loading"
  | "home"
  | "entry"
  | "recover"
  | "recover-error"
  | "resume-onboarding"
  | "sign-in"
  | "auth-timeout";

export function resolveStart(s: StartSnapshot): StartDecision {
  if (!s.localReady) return "loading";
  // Sin envs no existe Clerk: no hay sesión que confirmar y la app corre 100%
  // local (builds de desarrollo). Es la ÚNICA rama que entra sin sesión.
  if (!s.backendConfigured) return s.hasLocalProfile ? "home" : "entry";
  // Timeout de Clerk ≠ signed-out: sin isLoaded REAL no se afirma "invitado".
  // Pantalla no destructiva con reintento.
  if (!s.clerkLoaded) return s.clerkTimedOut ? "auth-timeout" : "loading";
  // Alta recién terminada: la sesión ESTÁ activa aunque useAuth no la publicó.
  // Decidir acá mandaría a la entrada a alguien que acaba de crear su cuenta.
  if (!s.isSignedIn && s.profileAdoptionPending) return "loading";
  if (!s.isSignedIn) {
    // Clerk confirmó que no hay sesión. Con un perfil CON dueño esta
    // instalación pertenece a una cuenta: puede ser un logout que no terminó
    // de limpiar O una sesión perdida en un upgrade — indistinguibles desde
    // acá, así que se trata como el caso recuperable: pedir login y NO tocar
    // nada local. Sin perfil (o con un guest legado, que no tiene cuenta a la
    // cual volver) → la entrada. Nunca Home: no hay modo invitado.
    return s.hasLocalProfile && s.localProfileOwner !== "none" ? "sign-in" : "entry";
  }
  // Sesión activa: solo se confía en un perfil local PROPIO. Un perfil guest,
  // legado o de otra cuenta se reconcilia SIEMPRE contra Convex (el remoto
  // manda); antes se entraba a Home con cualquier perfil local.
  if (s.hasLocalProfile && s.localProfileOwner === "current") return "home";
  switch (s.recovery) {
    case "error":
      return "recover-error";
    case "done":
      return s.hasRemoteBirthData ? "home" : "resume-onboarding";
    default:
      return "recover";
  }
}

/**
 * Guard de `(tabs)` — la MISMA regla, aplicada donde el arranque no pasa.
 *
 * `app/index.tsx` solo decide cuando la app entra por "/". Expo Router
 * RESTAURA el estado de navegación: después de actualizar, iOS puede montar
 * una pestaña DIRECTO, sin pasar nunca por el arranque. Ese es el agujero por
 * el que un usuario con cuenta veía la Home invitada ("Modo invitado") con
 * Clerk ya cargado y sin sesión. Por eso el gate vive ARRIBA de `(tabs)`:
 * ninguna pestaña (Home, Tránsitos, Umbral, Perfil) se renderiza sin sesión.
 *
 * Con sesión activa devuelve "allow" siempre: reconciliar acá contra el
 * arranque podría rebotar `(tabs)` → "/" → `(tabs)` en bucle si el userId de
 * Clerk llega stale.
 */
export type TabsGuard = "allow" | "loading" | "sign-in" | "entry" | "start";

export function resolveTabsGuard(s: StartSnapshot): TabsGuard {
  if (!s.localReady) return "loading";
  // Sin envs no hay Clerk: nada que confirmar (builds locales).
  if (!s.backendConfigured) return s.hasLocalProfile ? "allow" : "entry";
  // Clerk sin resolver: carga mínima, nunca un redirect prematuro. Si venció
  // el timeout, la pantalla de reintento vive en "/" (no se duplica acá).
  if (!s.clerkLoaded) return s.clerkTimedOut ? "start" : "loading";
  if (s.isSignedIn) {
    // Sesión sin perfil local (reinstalación con la sesión en el llavero, o
    // justo el caso de iOS restaurando una pestaña): NO se entra. La Home
    // monta `useRequireProfile`, que ante "sin perfil" manda al onboarding y
    // el alta terminaría PISANDO en Convex la carta real de esta cuenta. El
    // arranque ("/") sabe recuperarla contra Convex; acá se delega y punto.
    // No hay bucle: index solo manda a `(tabs)` cuando el perfil ya existe.
    return s.hasLocalProfile ? "allow" : "start";
  }
  // Alta recién terminada (perfil creado, Clerk todavía no publicó la sesión):
  // esperar. Sin esto, quien acaba de crear su cuenta vuelve al paso 0.
  if (s.profileAdoptionPending) return "loading";
  // Sin sesión no se entra a ninguna pestaña.
  return s.hasLocalProfile && s.localProfileOwner !== "none" ? "sign-in" : "entry";
}

/**
 * Destino después de un login exitoso. Con datos de nacimiento en Convex se
 * entra derecho a la Home hidratada; si la cuenta no tiene datos pero este
 * teléfono sí, se entra con lo local; sin nada, se continúa el alta desde los
 * datos (con la sesión activa: no se crea una segunda cuenta).
 */
export type SignInDestination = "home-remote" | "home-local" | "resume-onboarding";

export function resolveSignInDestination(s: {
  hasRemoteBirthData: boolean;
  hasLocalProfile: boolean;
  profileRestored: boolean;
}): SignInDestination {
  if (s.hasRemoteBirthData) return "home-remote";
  return s.hasLocalProfile || s.profileRestored ? "home-local" : "resume-onboarding";
}

/**
 * ¿Se ofrece "Crear una cuenta" en el login? Sí siempre que el usuario esté
 * escribiendo su email y todavía no tenga sesión — incluido el caso en que el
 * email NO existe: ese error dejaba al usuario encerrado (sin cuenta que
 * recuperar y sin salida hacia el alta desde esta pantalla).
 */
/**
 * ¿El que entra es OTRO usuario que el dueño de lo que hay en este teléfono?
 *
 * Importa porque el arranque ya no purga: con la sesión perdida sin logout, el
 * diario y las guardadas del usuario anterior siguen vivos en disco. Si entra
 * otro, hay que archivarlos bajo SU dueño y limpiar antes de traer los de esta
 * cuenta — el merge de login conserva lo "actual" y se los daría al que entra.
 * Sin dueño (guest legado) no hay nada que separar: es un upgrade a cuenta.
 */
export function isAccountSwitch(s: {
  localProfileOwner: string | null;
  incomingUserId: string | null | undefined;
}): boolean {
  return !!(s.localProfileOwner && s.incomingUserId && s.localProfileOwner !== s.incomingUserId);
}

export type SignInPhase = "email" | "password" | "code";

export function shouldOfferSignup(s: { phase: SignInPhase; isSignedIn: boolean }): boolean {
  return !s.isSignedIn && s.phase !== "code";
}

/**
 * Primer factor a usar después de identificar el email. Clerk devuelve los
 * factores soportados por ESA cuenta: si tiene contraseña se pide contraseña
 * (la cuenta de revisión de Apple entra por acá, sin MFA), y si no, código por
 * email. La pantalla siempre deja cambiar al otro camino a mano.
 */
export type SignInFirstFactor = "password" | "email_code";

export function resolveFirstFactor(
  supported: Array<{ strategy?: string }> | undefined
): SignInFirstFactor {
  return supported?.some((f) => f.strategy === "password") ? "password" : "email_code";
}

/** Forma (parcial) de un error de Clerk. */
type ClerkErrorLike = {
  errors?: Array<{ code?: string; longMessage?: string; message?: string }>;
  message?: string;
};

/**
 * Error de `signIn.create` → mensaje + si el email no tiene cuenta. El flujo
 * se queda en la fase email en ambos casos: el usuario puede corregir el email
 * o salir a crear la cuenta (`shouldOfferSignup`).
 */
export function mapSignInStartError(e: unknown): { message: string; identifierNotFound: boolean } {
  const err = e as ClerkErrorLike;
  const first = err?.errors?.[0];
  if (first?.code === "form_identifier_not_found") {
    return {
      message: "No encontramos una cuenta con ese email. Si sos nuevo, creá tu cuenta.",
      identifierNotFound: true
    };
  }
  return {
    message:
      first?.longMessage ?? first?.message ?? err?.message ?? "No pudimos conectar. Probá de nuevo.",
    identifierNotFound: false
  };
}

/**
 * Dueño del perfil AL CREARLO. Carrera post-verify: después de
 * `verify → setActive`, el render inmediato puede ver `useAuth` stale
 * (isSignedIn/userId todavía viejos). Si la sesión está activa pero el
 * userId no llegó, el perfil se crea sin dueño y queda una ADOPCIÓN
 * PENDIENTE que se ejecuta apenas aparece el userId. Cubre email/código,
 * OAuth y resume=datos.
 */
export type OwnerResolution = {
  ownerUserId: string | null;
  adoptWhenReady: boolean;
};

export function resolveProfileOwnerAtCreation(input: {
  /** La sesión SE SABE activa (verify/oauth ok, o useAuth ya lo confirma). */
  sessionActive: boolean;
  /** userId si useAuth ya lo tiene; null si sigue stale. */
  knownUserId: string | null;
}): OwnerResolution {
  if (!input.sessionActive) return { ownerUserId: null, adoptWhenReady: false };
  if (input.knownUserId) return { ownerUserId: input.knownUserId, adoptWhenReady: false };
  return { ownerUserId: null, adoptWhenReady: true };
}

/**
 * Orden crítico de la creación del perfil (carrera de ESCRITURA): el perfil
 * y el dueño inicial se persisten en disco ANTES de publicar el estado que
 * habilita la adopción diferida. Si se publicara antes, la adopción podía
 * escribir el userId en disco y la escritura inicial (owner null), todavía
 * en vuelo, pisarlo después: memoria correcta, disco sin dueño.
 */
export async function commitProfileCreation(steps: {
  persistProfile: () => Promise<void>;
  persistInitialOwner: () => Promise<void>;
  /** Publica profile/owner/pending en memoria; recién acá puede adoptar. */
  publishState: () => void;
}): Promise<void> {
  await steps.persistProfile();
  await steps.persistInitialOwner();
  steps.publishState();
}

/** ¿Ya se puede ejecutar la adopción pendiente? (userId apareció.) */
export function shouldAdoptPendingProfile(s: {
  adoptionPending: boolean;
  hasProfile: boolean;
  profileOwner: string | null;
  isSignedIn: boolean;
  userId: string | null;
}): boolean {
  return s.adoptionPending && s.hasProfile && !s.profileOwner && s.isSignedIn && !!s.userId;
}

/**
 * Promise con tope duro. Las llamadas de Convex NO rechazan cuando el
 * websocket/la auth no terminan de conectar: se ENCOLAN indefinidamente, así
 * que un retry-loop que solo captura excepciones puede colgarse para siempre
 * (spinner infinito en la recuperación). Todo camino de sesión que espere al
 * backend debe pasar por acá.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("orbita-session-timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Ciclo de reintentos con presupuesto ESTRICTO. `withTimeout` solo acota una
 * llamada; sin esto, un intento que arranca cerca del final del presupuesto
 * podía correr sus llamadas completas y la pantalla tardar ~21s en ofrecer
 * reintento con un presupuesto "de 15s". Acá cada llamada (vía `timebox`) y
 * cada pausa quedan acotadas al tiempo RESTANTE: el total nunca supera el
 * presupuesto (+ el margen del scheduler).
 */
export async function runSessionAttempts<T>(opts: {
  budgetMs: number;
  callTimeoutMs: number;
  retryPauseMs: number;
  attempt: (timebox: <V>(promise: Promise<V>) => Promise<V>) => Promise<T>;
  /** Inyectables para tests. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ status: "ok"; value: T } | { status: "error" }> {
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + opts.budgetMs;
  const remaining = () => deadline - now();
  while (remaining() > 0) {
    const timebox = <V,>(promise: Promise<V>) =>
      withTimeout(promise, Math.max(1, Math.min(opts.callTimeoutMs, remaining())));
    try {
      return { status: "ok", value: await opts.attempt(timebox) };
    } catch {
      const pause = Math.min(opts.retryPauseMs, remaining());
      if (pause <= 0) break;
      await sleep(pause);
    }
  }
  return { status: "error" };
}

/** Forma mínima del doc `birthData` de Convex que necesita la hidratación. */
export type RemoteBirthData = {
  birthDate: string;
  birthTime?: string;
  birthPlaceLabel?: string;
};

/**
 * birthData de Convex → input de `createProfile` (perfil local). El backend
 * guarda "Sin especificar" cuando no hubo lugar; localmente eso es "sin lugar".
 */
export function onboardingInputFromBirthData(birthData: RemoteBirthData): OnboardingProfile {
  const place =
    birthData.birthPlaceLabel && birthData.birthPlaceLabel !== "Sin especificar"
      ? birthData.birthPlaceLabel
      : undefined;
  return {
    name: "Visitante",
    birthDate: birthData.birthDate,
    birthTime: birthData.birthTime,
    birthPlace: place,
    interests: [],
    guidanceTone: "protectora",
    notificationTime: "09:00"
  };
}
