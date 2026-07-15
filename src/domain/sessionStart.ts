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

export type StartSnapshot = {
  /** Convex + Clerk configurados (sin envs la app es 100% local). */
  backendConfigured: boolean;
  /** AsyncStorage ya hidratado (isReady de useAppState). */
  localReady: boolean;
  hasLocalProfile: boolean;
  /** Clerk terminó de cargar la sesión persistida. */
  clerkLoaded: boolean;
  isSignedIn: boolean;
  /** Estado de la recuperación remota (solo aplica: sesión sin perfil local). */
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
  | "resume-onboarding";

export function resolveStart(s: StartSnapshot): StartDecision {
  if (!s.localReady) return "loading";
  if (!s.backendConfigured) return s.hasLocalProfile ? "home" : "entry";
  if (!s.clerkLoaded) return "loading";
  if (!s.isSignedIn) return s.hasLocalProfile ? "home" : "entry";
  // Sesión activa: el perfil local (hidratado antes o recién recuperado) manda.
  if (s.hasLocalProfile) return "home";
  switch (s.recovery) {
    case "error":
      return "recover-error";
    case "done":
      return s.hasRemoteBirthData ? "home" : "resume-onboarding";
    default:
      return "recover";
  }
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
