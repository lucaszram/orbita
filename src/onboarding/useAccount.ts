import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";

import {
  mapSignInStartError,
  resolveFirstFactor,
  runSessionAttempts,
  type SignInPhase
} from "@/domain/sessionStart";
import { planResend, type ResendResult } from "@/onboarding/resend";
import {
  interpretSignInAttempt,
  interpretSignUpAttempt,
  makeReentrancyGuard
} from "@/onboarding/signup";
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
  /** Crea el intento de alta con contraseña (Clerk Producción la exige). */
  start: (email: string, password: string) => Promise<void>;
  verify: (code: string) => Promise<boolean>;
  /** Reenvía el código sin crear otra cuenta ni reiniciar el flujo. */
  resend: () => Promise<ResendResult>;
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
  // emailAddressId del intento de sign-in (rama email ya existente): lo guarda
  // `start` para que el reenvío pueda repetir prepareFirstFactor sin perderlo.
  const emailAddressIdRef = useRef<string | null>(null);
  // Un código completo dispara auto-submit (CodeInput.onFilled) Y el tap del
  // botón: el guard evita que `verify` corra dos veces en paralelo.
  const verifyGuardRef = useRef<ReturnType<typeof makeReentrancyGuard>>(undefined);
  if (!verifyGuardRef.current) verifyGuardRef.current = makeReentrancyGuard();

  const start = useCallback(
    async (emailAddress: string, password: string) => {
      if (!signUp || !signIn) return;
      setBusy(true);
      setError(null);
      try {
        // Con contraseña desde la creación: Clerk Producción tiene
        // `password: required`, así que sin esto el alta queda en
        // `missing_requirements` después de verificar el email.
        await signUp.create({ emailAddress, password });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        flowRef.current = "signUp";
        emailAddressIdRef.current = null;
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
            const emailAddressId = factor?.emailAddressId ?? "";
            await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId });
            flowRef.current = "signIn";
            emailAddressIdRef.current = emailAddressId;
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

  const resend = useCallback(async (): Promise<ResendResult> => {
    if (!signUp || !signIn) return { ok: false, error: "No pudimos reenviar el código. Probá de nuevo." };
    setBusy(true);
    setError(null); // limpiar un error de verify previo antes de reenviar
    try {
      const plan = planResend({ flow: flowRef.current, emailAddressId: emailAddressIdRef.current });
      if (plan.method === "prepareEmailAddressVerification") {
        await signUp.prepareEmailAddressVerification({ strategy: plan.strategy });
      } else {
        await signIn.prepareFirstFactor({ strategy: plan.strategy, emailAddressId: plan.emailAddressId });
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: clerkErrorMessage(e) };
    } finally {
      setBusy(false);
    }
  }, [signIn, signUp]);

  const verify = useCallback(
    (code: string): Promise<boolean> =>
      verifyGuardRef.current!.run(async () => {
        if (!signUp || !signIn) return false;
        setBusy(true);
        setError(null);
        try {
          if (flowRef.current === "signUp") {
            // Un código MALO lanza (→ catch). Si no lanza pero el alta no está
            // `complete`, el email quedó verificado y faltan requisitos (p. ej.
            // contraseña): se dice QUÉ falta, nunca "el código no coincide".
            const outcome = interpretSignUpAttempt(await signUp.attemptEmailAddressVerification({ code }));
            if (outcome.kind === "complete" && setActiveSignUp) {
              await setActiveSignUp({ session: outcome.sessionId });
              return true;
            }
            setError(outcome.kind === "missing" ? outcome.message : "No pudimos crear tu cuenta. Probá de nuevo.");
            return false;
          }
          const outcome = interpretSignInAttempt(await signIn.attemptFirstFactor({ strategy: "email_code", code }));
          if (outcome.kind === "complete" && setActiveSignIn) {
            await setActiveSignIn({ session: outcome.sessionId });
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
      }, false),
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
    resend,
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

/**
 * Login: email → (contraseña | código). Tipo propio, distinto de `AccountFlow`
 * (el alta sigue siendo solo por código): acá la cuenta puede tener contraseña.
 */
export type SignInFlow = {
  phase: SignInPhase;
  busy: boolean;
  error: string | null;
  isSignedIn: boolean;
  oauthBusy: OAuthProvider | null;
  /** Identifica el email y enruta al factor que ESA cuenta soporta. */
  start: (email: string) => Promise<void>;
  /** Contraseña (cuentas con password, p. ej. la de revisión de Apple). */
  verifyPassword: (password: string) => Promise<boolean>;
  /** Cambiar a código por email desde la pantalla de contraseña. */
  sendEmailCode: () => Promise<void>;
  verify: (code: string) => Promise<boolean>;
  /** Reenvía el código conservando el emailAddressId (mismo intento). */
  resend: () => Promise<ResendResult>;
  oauth: (provider: OAuthProvider) => Promise<boolean>;
  resetToEmail: () => void;
};

export function useSignInFlow(): SignInFlow | null {
  if (!HAS_BACKEND) return null;
  return useSignInFlowInner();
}

function useSignInFlowInner(): SignInFlow {
  const { useAuth } = require("@clerk/expo") as typeof import("@clerk/expo");
  const { useSignIn } = require("@clerk/expo/legacy") as typeof import("@clerk/expo/legacy");
  const { signIn, setActive: setActiveSignIn } = useSignIn();
  const { isSignedIn } = useAuth();
  const [phase, setPhase] = useState<SignInPhase>("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);
  // emailAddressId del intento vigente: lo guarda `prepareEmailCode` para que el
  // reenvío repita prepareFirstFactor con el MISMO id (no reinicia el flujo).
  const emailAddressIdRef = useRef<string | null>(null);
  // Evita doble verificación (auto-submit del CodeInput + tap del botón).
  const verifyGuardRef = useRef<ReturnType<typeof makeReentrancyGuard>>(undefined);
  if (!verifyGuardRef.current) verifyGuardRef.current = makeReentrancyGuard();

  /** Pide el código por email y pasa a la fase código. */
  const prepareEmailCode = useCallback(
    async (factors: Array<{ strategy?: string }> | undefined) => {
      const factor = factors?.find((f) => f.strategy === "email_code") as
        | { emailAddressId?: string }
        | undefined;
      const emailAddressId = factor?.emailAddressId ?? "";
      emailAddressIdRef.current = emailAddressId;
      await signIn!.prepareFirstFactor({ strategy: "email_code", emailAddressId });
      setPhase("code");
    },
    [signIn]
  );

  const start = useCallback(
    async (emailAddress: string) => {
      if (!signIn) return;
      setBusy(true);
      setError(null);
      try {
        const attempt = await signIn.create({ identifier: emailAddress });
        const factors = attempt.supportedFirstFactors ?? undefined;
        // Con contraseña, se pide contraseña (sin mandar un código que nadie
        // pidió); si no, código por email. `resolveFirstFactor` tiene tests.
        if (resolveFirstFactor(factors) === "password") setPhase("password");
        else await prepareEmailCode(factors);
      } catch (e) {
        // El email inexistente NO avanza de fase: el usuario se queda en el
        // campo de email, con el error visible y con "Crear una cuenta" a mano
        // (antes el mensaje lo mandaba a "empezar creando tu carta" sin darle
        // ninguna forma de hacerlo desde esta pantalla).
        setError(mapSignInStartError(e).message);
      } finally {
        setBusy(false);
      }
    },
    [prepareEmailCode, signIn]
  );

  const verifyPassword = useCallback(
    (password: string): Promise<boolean> =>
      verifyGuardRef.current!.run(async () => {
        if (!signIn) return false;
        setBusy(true);
        setError(null);
        try {
          // Password y código terminan igual: interpret → complete → setActive.
          const outcome = interpretSignInAttempt(
            await signIn.attemptFirstFactor({ strategy: "password", password })
          );
          if (outcome.kind === "complete" && setActiveSignIn) {
            await setActiveSignIn({ session: outcome.sessionId });
            return true;
          }
          // status "needs_second_factor" u otro: no se inventa una sesión.
          setError(outcome.kind === "incomplete" ? outcome.message : "No pudimos completar el ingreso.");
          return false;
        } catch (e) {
          setError(clerkErrorMessage(e));
          return false;
        } finally {
          setBusy(false);
        }
      }, false),
    [setActiveSignIn, signIn]
  );

  const sendEmailCode = useCallback(async () => {
    if (!signIn) return;
    setBusy(true);
    setError(null);
    try {
      await prepareEmailCode(signIn.supportedFirstFactors ?? undefined);
    } catch (e) {
      setError(clerkErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [prepareEmailCode, signIn]);

  const resend = useCallback(async (): Promise<ResendResult> => {
    if (!signIn) return { ok: false, error: "No pudimos reenviar el código. Probá de nuevo." };
    setBusy(true);
    setError(null); // limpiar un error de verify previo antes de reenviar
    try {
      // Login siempre es signIn: repetir prepareFirstFactor con el mismo id.
      const plan = planResend({ flow: "signIn", emailAddressId: emailAddressIdRef.current });
      if (plan.method === "prepareFirstFactor") {
        await signIn.prepareFirstFactor({ strategy: plan.strategy, emailAddressId: plan.emailAddressId });
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: clerkErrorMessage(e) };
    } finally {
      setBusy(false);
    }
  }, [signIn]);

  const verify = useCallback(
    (code: string): Promise<boolean> =>
      verifyGuardRef.current!.run(async () => {
        if (!signIn) return false;
        setBusy(true);
        setError(null);
        try {
          const outcome = interpretSignInAttempt(
            await signIn.attemptFirstFactor({ strategy: "email_code", code })
          );
          if (outcome.kind === "complete" && setActiveSignIn) {
            await setActiveSignIn({ session: outcome.sessionId });
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
      }, false),
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
    verifyPassword,
    sendEmailCode,
    verify,
    resend,
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

// Una llamada Convex sin conexión/auth se ENCOLA sin rechazar: la
// recuperación corre en runSessionAttempts con presupuesto ESTRICTO (cada
// llamada y cada pausa acotadas al restante) — termina SIEMPRE dentro del
// presupuesto, en ok o en error con reintento; nunca spinner infinito.
const HYDRATE_BUDGET_MS = 15000;
const HYDRATE_CALL_TIMEOUT_MS = 5000;
const HYDRATE_RETRY_PAUSE_MS = 700;

function useSignInHydrateInner(): () => Promise<SignInHydrateResult> {
  const convex = useConvex();
  return useCallback(async () => {
    const result = await runSessionAttempts({
      budgetMs: HYDRATE_BUDGET_MS,
      callTimeoutMs: HYDRATE_CALL_TIMEOUT_MS,
      retryPauseMs: HYDRATE_RETRY_PAUSE_MS,
      attempt: async (timebox) => {
        const user = await timebox(convex.mutation(appApi.users.getOrCreateCurrentUser, {}));
        const birthData = await timebox(convex.query(appApi.birthData.getCurrent, {}));
        return {
          birthData,
          clerkUserId: typeof user?.clerkUserId === "string" ? user.clerkUserId : null
        };
      }
    });
    if (result.status === "error") return { status: "error" };
    return { status: "ok", ...result.value };
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
