import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";

import { withTimeout } from "@/domain/sessionStart";
import { deviceTimezone } from "@/hooks/useLiveApp";
import { useOrbitaAuth } from "@/hooks/useOrbitaAuth";
import { appApi, type BirthDataDoc } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import { publicLabApi } from "@/services/publicLabRefs";

// Necesario para que el browser de OAuth devuelva el control a la app.
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = "google" | "apple";

// Lanzamiento v1 sin login social: Clerk prod exige credenciales OAuth propias
// de Google y la guideline 4.8 de Apple obliga a Sign in with Apple si hay
// Google. Reactivar cuando ambas estén configuradas (decisión Lucas 2026-07-14).
export const SOCIAL_LOGIN_ENABLED = false;

/**
 * Cuenta Clerk (email + código) y persistencia Convex para el onboarding
 * inmersivo. `HAS_BACKEND` es constante de módulo: sin envs, los hooks
 * devuelven null y el flujo queda igual que siempre (invitado local).
 */
const HAS_BACKEND = backendConfig.hasConvex && backendConfig.hasClerk;

export type AccountFlow = {
  phase: "email" | "code";
  busy: boolean;
  error: string | null;
  isSignedIn: boolean;
  oauthBusy: OAuthProvider | null;
  start: (email: string) => Promise<void>;
  verify: (code: string) => Promise<boolean>;
  oauth: (provider: OAuthProvider) => Promise<boolean>;
  resetToEmail: () => void;
};

function clerkErrorMessage(e: unknown): string {
  const err = e as { errors?: Array<{ longMessage?: string; message?: string }>; message?: string };
  return (
    err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? err?.message ?? "No pudimos conectar. Probá de nuevo."
  );
}

export function useAccountFlow(): AccountFlow | null {
  if (!HAS_BACKEND) return null;
  return useAccountFlowInner();
}

/** OAuth SSO (Apple/Google) compartido entre alta de cuenta y sign-in. */
function useSSOOauth(
  setError: (v: string | null) => void,
  setOauthBusy: (v: OAuthProvider | null) => void,
): (provider: OAuthProvider) => Promise<boolean> {
  const { useSSO } = require("@clerk/expo") as typeof import("@clerk/expo");
  const { startSSOFlow } = useSSO();
  return useCallback(
    async (provider: OAuthProvider): Promise<boolean> => {
      setError(null);
      setOauthBusy(provider);
      try {
        const strategy = provider === "google" ? "oauth_google" : "oauth_apple";
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy,
          redirectUrl: AuthSession.makeRedirectUri()
        });
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          return true;
        }
        // El usuario canceló el navegador o falta un paso (MFA): no es un error duro.
        return false;
      } catch (e) {
        setError(clerkErrorMessage(e));
        return false;
      } finally {
        setOauthBusy(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startSSOFlow]
  );
}

function useAccountFlowInner(): AccountFlow {
  const { useAuth } = require("@clerk/expo") as typeof import("@clerk/expo");
  // La API clásica (create/prepare/attempt) vive en el subpath legacy en @clerk/expo v3.
  const { useSignIn, useSignUp } = require("@clerk/expo/legacy") as typeof import("@clerk/expo/legacy");
  const { signUp, setActive: setActiveSignUp } = useSignUp();
  const { signIn, setActive: setActiveSignIn } = useSignIn();
  const { isSignedIn } = useAuth();
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);
  const flowRef = useRef<"signUp" | "signIn">("signUp");

  const start = useCallback(
    async (emailAddress: string) => {
      if (!signUp || !signIn) return;
      setBusy(true);
      setError(null);
      try {
        await signUp.create({ emailAddress });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        flowRef.current = "signUp";
        setPhase("code");
      } catch (e) {
        const code = (e as { errors?: Array<{ code?: string }> })?.errors?.[0]?.code;
        if (code === "form_identifier_exists") {
          // El email ya tiene cuenta: entrar por sign-in con código.
          try {
            const attempt = await signIn.create({ identifier: emailAddress });
            const factor = attempt.supportedFirstFactors?.find((f) => f.strategy === "email_code") as
              | { emailAddressId?: string }
              | undefined;
            await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor?.emailAddressId ?? "" });
            flowRef.current = "signIn";
            setPhase("code");
          } catch (e2) {
            setError(clerkErrorMessage(e2));
          }
        } else {
          setError(clerkErrorMessage(e));
        }
      } finally {
        setBusy(false);
      }
    },
    [signIn, signUp]
  );

  const verify = useCallback(
    async (code: string): Promise<boolean> => {
      if (!signUp || !signIn) return false;
      setBusy(true);
      setError(null);
      try {
        if (flowRef.current === "signUp") {
          const result = await signUp.attemptEmailAddressVerification({ code });
          if (result.status === "complete" && setActiveSignUp) {
            await setActiveSignUp({ session: result.createdSessionId });
            return true;
          }
        } else {
          const result = await signIn.attemptFirstFactor({ strategy: "email_code", code });
          if (result.status === "complete" && setActiveSignIn) {
            await setActiveSignIn({ session: result.createdSessionId });
            return true;
          }
        }
        setError("El código no coincide. Fijate en tu mail.");
        return false;
      } catch (e) {
        setError(clerkErrorMessage(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [setActiveSignIn, setActiveSignUp, signIn, signUp]
  );

  const oauth = useSSOOauth(setError, setOauthBusy);

  return {
    phase,
    busy,
    error,
    isSignedIn: !!isSignedIn,
    oauthBusy,
    start,
    verify,
    oauth,
    resetToEmail: () => {
      setError(null);
      setPhase("email");
    }
  };
}

// ---------------------------------------------------------------------------
// Sign-in de usuarios existentes (pantalla 01C "Bienvenido de nuevo").
// A diferencia de useAccountFlow (alta primero), acá se intenta SOLO sign-in:
// si el email no tiene cuenta, se avisa en vez de crear una cuenta silenciosa.
// ---------------------------------------------------------------------------

export function useSignInFlow(): AccountFlow | null {
  if (!HAS_BACKEND) return null;
  return useSignInFlowInner();
}

function useSignInFlowInner(): AccountFlow {
  const { useAuth } = require("@clerk/expo") as typeof import("@clerk/expo");
  const { useSignIn } = require("@clerk/expo/legacy") as typeof import("@clerk/expo/legacy");
  const { signIn, setActive: setActiveSignIn } = useSignIn();
  const { isSignedIn } = useAuth();
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);

  const start = useCallback(
    async (emailAddress: string) => {
      if (!signIn) return;
      setBusy(true);
      setError(null);
      try {
        const attempt = await signIn.create({ identifier: emailAddress });
        const factor = attempt.supportedFirstFactors?.find((f) => f.strategy === "email_code") as
          | { emailAddressId?: string }
          | undefined;
        await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor?.emailAddressId ?? "" });
        setPhase("code");
      } catch (e) {
        const code = (e as { errors?: Array<{ code?: string }> })?.errors?.[0]?.code;
        if (code === "form_identifier_not_found") {
          setError("No encontramos una cuenta con ese email. Si sos nuevo, empezá creando tu carta.");
        } else {
          setError(clerkErrorMessage(e));
        }
      } finally {
        setBusy(false);
      }
    },
    [signIn]
  );

  const verify = useCallback(
    async (code: string): Promise<boolean> => {
      if (!signIn) return false;
      setBusy(true);
      setError(null);
      try {
        const result = await signIn.attemptFirstFactor({ strategy: "email_code", code });
        if (result.status === "complete" && setActiveSignIn) {
          await setActiveSignIn({ session: result.createdSessionId });
          return true;
        }
        setError("El código no coincide. Fijate en tu mail.");
        return false;
      } catch (e) {
        setError(clerkErrorMessage(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [setActiveSignIn, signIn]
  );

  const oauth = useSSOOauth(setError, setOauthBusy);

  return {
    phase,
    busy,
    error,
    isSignedIn: !!isSignedIn,
    oauthBusy,
    start,
    verify,
    oauth,
    resetToEmail: () => {
      setError(null);
      setPhase("email");
    }
  };
}

/**
 * Post-login (o arranque con sesión y sin perfil local): trae los datos de
 * nacimiento guardados en Convex para decidir el destino. Con datos → derecho
 * a la Home (saltea el onboarding); sin datos → sigue el alta con la sesión ya
 * activa. La sesión Clerk puede ser reciente y el token de Convex tardar:
 * reintenta unos segundos y distingue "no hay datos" de "no pudimos traerlos"
 * (el error real muestra reintento, nunca finge que el usuario está listo).
 */
export type SignInHydrateResult =
  | {
      status: "ok";
      birthData: BirthDataDoc | null;
      /**
       * Id Clerk confirmado por el backend (`getOrCreateCurrentUser`). Usar
       * ESTE para restaurar el snapshot local: justo después de `setActive`
       * el estado de React (`useAuth`) puede no haber re-renderizado todavía.
       */
      clerkUserId: string | null;
    }
  | { status: "error" };

export function useSignInHydrate(): (() => Promise<SignInHydrateResult>) | null {
  if (!HAS_BACKEND) return null;
  return useSignInHydrateInner();
}

// Una llamada Convex sin conexión/auth se ENCOLA sin rechazar: cada intento
// lleva tope duro y el loop completo tiene presupuesto — la recuperación
// termina SIEMPRE (ok o error con reintento), nunca spinner infinito.
const HYDRATE_BUDGET_MS = 15000;
const HYDRATE_CALL_TIMEOUT_MS = 5000;

function useSignInHydrateInner(): () => Promise<SignInHydrateResult> {
  const convex = useConvex();
  return useCallback(async () => {
    const deadline = Date.now() + HYDRATE_BUDGET_MS;
    while (Date.now() < deadline) {
      try {
        const user = await withTimeout(
          convex.mutation(appApi.users.getOrCreateCurrentUser, {}),
          HYDRATE_CALL_TIMEOUT_MS
        );
        const birthData = await withTimeout(
          convex.query(appApi.birthData.getCurrent, {}),
          HYDRATE_CALL_TIMEOUT_MS
        );
        return {
          status: "ok",
          birthData,
          clerkUserId: typeof user?.clerkUserId === "string" ? user.clerkUserId : null
        };
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
    return { status: "error" };
  }, [convex]);
}

// ---------------------------------------------------------------------------
// Lectura de la carta real para el preview del onboarding (paso 14).
// Con la carta ya calculada (post-cuenta), devuelve la tríada real Sol/Luna/Asc.
// ---------------------------------------------------------------------------

function capitalizeSign(sign: string): string {
  return sign.charAt(0).toUpperCase() + sign.slice(1);
}

function readTriadSign(triad: unknown, key: string): string | null {
  if (!triad || typeof triad !== "object") return null;
  const placement = (triad as Record<string, unknown>)[key];
  if (!placement || typeof placement !== "object") return null;
  const sign = (placement as Record<string, unknown>).sign;
  return typeof sign === "string" && sign !== "pendiente" && sign.trim().length > 0 ? capitalizeSign(sign) : null;
}

export type OnboardingChart = {
  /** true una vez que la query de Convex resolvió (haya carta o no). */
  resolved: boolean;
  sun: string | null;
  moon: string | null;
  ascendant: string | null;
};

/** Lee la carta natal persistida del usuario. `null` si no hay backend configurado. */
export function useOnboardingChart(): OnboardingChart | null {
  if (!HAS_BACKEND) return null;
  return useOnboardingChartInner();
}

function useOnboardingChartInner(): OnboardingChart {
  const auth = useOrbitaAuth();
  const ensureUser = useMutation(appApi.users.getOrCreateCurrentUser);
  const [userReady, setUserReady] = useState(false);
  // charts.current tira "User record not found" si hay sesión pero todavía no
  // existe la fila `users`. Creamos la fila y recién ahí habilitamos la query.
  useEffect(() => {
    if (!auth.isAuthenticated) {
      setUserReady(false);
      return;
    }
    ensureUser({})
      .then(() => setUserReady(true))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated]);
  const chart = useQuery(appApi.charts.current, auth.isAuthenticated && userReady ? {} : "skip");
  const payload = chart && typeof chart === "object" ? (chart as { payload?: unknown }).payload : null;
  const triad = payload && typeof payload === "object" ? (payload as { triad?: unknown }).triad : null;
  return {
    resolved: chart !== undefined,
    sun: readTriadSign(triad, "sun"),
    moon: readTriadSign(triad, "moon"),
    ascendant: readTriadSign(triad, "ascendant")
  };
}

// ---------------------------------------------------------------------------
// Tríada real SIN login: calcula la carta desde los datos cargados vía el
// endpoint público del lab (previewDailyHome). Igual que en la web.
// ---------------------------------------------------------------------------

const HAS_CONVEX = backendConfig.hasConvex;

const SIGN_ES: Record<string, string> = {
  aries: "Aries", tauro: "Tauro", geminis: "Géminis", cancer: "Cáncer",
  leo: "Leo", virgo: "Virgo", libra: "Libra", escorpio: "Escorpio",
  sagitario: "Sagitario", capricornio: "Capricornio", acuario: "Acuario", piscis: "Piscis"
};

/** "Sol en geminis" / "Ascendente en libra" → "Géminis"/"Libra". */
function parseSignFromText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let s = v.trim();
  const m = s.match(/\ben\s+(.+)$/i);
  if (m) s = m[1].trim();
  if (!s || /pendiente/i.test(s)) return null;
  const key = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return SIGN_ES[key] ?? capitalizeSign(s);
}

export type ComputeTriadInput = {
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: "known" | "approximate" | "unknown";
  birthPlaceLabel: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
};

/** Devuelve una función que calcula la tríada real sin login. `null` sin Convex. */
export function useOnboardingComputeTriad(): ((input: ComputeTriadInput) => Promise<OnboardingChart>) | null {
  if (!HAS_CONVEX) return null;
  return useOnboardingComputeTriadInner();
}

function useOnboardingComputeTriadInner() {
  const previewDaily = useAction(publicLabApi.previewDailyHome);
  return useCallback(
    async (input: ComputeTriadInput): Promise<OnboardingChart> => {
      const localDate = new Date().toISOString().slice(0, 10);
      const res = (await previewDaily({
        birthDate: input.birthDate,
        birthTime: input.birthTime,
        birthTimePrecision: input.birthTimePrecision,
        birthPlaceLabel: input.birthPlaceLabel,
        latitude: input.latitude,
        longitude: input.longitude,
        timezone: input.timezone ?? deviceTimezone(),
        localDate
      })) as { natalBase?: { sun?: unknown; moon?: unknown; ascendant?: unknown } };
      const nb = res?.natalBase ?? {};
      return {
        resolved: true,
        sun: parseSignFromText(nb.sun),
        moon: parseSignFromText(nb.moon),
        ascendant: parseSignFromText(nb.ascendant)
      };
    },
    [previewDaily]
  );
}

export type PersistBirthData = (input: {
  birthDate: string;
  birthTime?: string;
  birthPlaceLabel?: string;
  latitude?: number;
  longitude?: number;
  /** Timezone del lugar de nacimiento (del geocoding); fallback: la del dispositivo. */
  timezone?: string;
}) => Promise<void>;

/**
 * Persistencia con errores TRAGADOS (onboarding: la copia local ya existe y
 * el flujo no debe cortarse). Para "Editar datos" usar la variante estricta.
 */
export function useBackendPersist(): PersistBirthData | null {
  if (!HAS_BACKEND) return null;
  return useBackendPersistSwallowInner();
}

/**
 * Persistencia ESTRICTA: propaga el error. Con sesión iniciada, "Guardar" en
 * Editar datos espera la confirmación del backend y muestra error/reintento
 * si falla (sin sesión resuelve sin hacer nada, igual que la otra variante).
 */
export function useBackendPersistStrict(): PersistBirthData | null {
  if (!HAS_BACKEND) return null;
  return useBackendPersistInner();
}

function useBackendPersistSwallowInner(): PersistBirthData {
  const persist = useBackendPersistInner();
  return useCallback(
    async (input) => {
      try {
        await persist(input);
      } catch (e) {
        // La copia local ya existe: el backend puede fallar sin romper el flujo.
        console.warn("Órbita: persistencia backend falló (la app sigue local)", e);
      }
    },
    [persist]
  );
}

function useBackendPersistInner(): PersistBirthData {
  const auth = useOrbitaAuth();
  const ensureUser = useMutation(appApi.users.getOrCreateCurrentUser);
  const completeBirthData = useMutation(appApi.onboarding.completeBirthData);
  // Backend la define como Action (igual que en la web); antes acá estaba mal
  // como useMutation → "Trying to execute ... as Mutation, but defined as Action".
  const calculateChart = useAction(appApi.charts.calculateOrCreateNatalChart);
  const generateToday = useMutation(appApi.readings.generateToday);
  const isSignedIn = auth.isSignedIn;

  return useCallback(
    async (input) => {
      if (!isSignedIn) return;
      const birthTimezone = input.timezone ?? deviceTimezone();
      await ensureUser({});
      await completeBirthData({
        birthDate: input.birthDate,
        birthTime: input.birthTime,
        birthTimePrecision: input.birthTime ? "known" : "unknown",
        birthPlaceLabel: input.birthPlaceLabel ?? "Sin especificar",
        latitude: input.latitude,
        longitude: input.longitude,
        timezone: birthTimezone
      });
      await calculateChart({});
      await generateToday({ localDate: new Date().toISOString().slice(0, 10), timezone: deviceTimezone() });
    },
    [calculateChart, completeBirthData, ensureUser, generateToday, isSignedIn]
  );
}
