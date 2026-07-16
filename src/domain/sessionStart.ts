import type { OnboardingProfile } from "./types";

/**
 * Resolver puro del arranque nativo (hotfix build 11). `app/index.tsx` junta
 * el estado real (storage local, Clerk, recuperación Convex) y esta función
 * decide UNA cosa: qué mostrar. Reglas (docs/handoff-build11-session-navigation.md):
 *
 *  - Clerk cargando → loading; NUNCA afirmar "invitado" mientras carga.
 *  - Sesión válida + datos (locales o en Convex) → Home.
 *  - Sesión válida sin datos de nacimiento → continuar el alta (sin 2da cuenta).
 *  - Sin sesión + perfil guest local → Home como invitado.
 *  - Sin sesión + sin perfil → entrada estable (Empezar / Ya tengo cuenta).
 *  - Error real recuperando la cuenta → reintento; nunca fingir que está listo.
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
  | "purge-local"
  | "auth-timeout";

export function resolveStart(s: StartSnapshot): StartDecision {
  if (!s.localReady) return "loading";
  if (!s.backendConfigured) return s.hasLocalProfile ? "home" : "entry";
  // Timeout de Clerk ≠ signed-out: sin isLoaded REAL no se puede decidir nada
  // destructivo (un perfil con dueño de una sesión VÁLIDA caería en purga).
  // Pantalla no destructiva con reintento; jamás purge-local ni limpieza.
  if (!s.clerkLoaded) return s.clerkTimedOut ? "auth-timeout" : "loading";
  if (!s.isSignedIn) {
    if (!s.hasLocalProfile) return "entry";
    // Clerk YA confirmó (isLoaded) que no hay sesión: un perfil CON dueño son
    // restos de un logout que no terminó de limpiar (ya archivado bajo su
    // cuenta): purgar, nunca mostrarlo.
    return s.localProfileOwner === "none" ? "home" : "purge-local";
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
