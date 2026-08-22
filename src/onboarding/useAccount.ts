import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";

import {
  persistSignupDraft,
  SIGNUP_DRAFT_NOT_READY,
  type SignupDraftInput
} from "@/domain/anonymousSignupDraft";
import {
  mapSignInStartError,
  resolveFirstFactor,
  runSessionAttempts,
  type SignInPhase
} from "@/domain/sessionStart";
import { classifySsoOutcome, type SsoOutcome } from "@/onboarding/authGate";
import { planResend, type ResendResult } from "@/onboarding/resend";
import {
  interpretSignInAttempt,
  interpretSignUpAttempt,
  makeReentrancyGuard
} from "@/onboarding/signup";
import { validateBirthPayload } from "@/domain/birthPayload";
import { timezoneLookupFor, withResolvedTimezone } from "@/domain/placeTimezone";
import type { OnboardingCompletion } from "@/domain/onboardingReadiness";
import { TRIAD_CLIENT_TIMEOUT_CODE, withTriadTimeout } from "@/domain/triadTimeout";
import { useOrbitaAuth } from "@/hooks/useOrbitaAuth";
import { anonymousSignupDraftTransport } from "@/services/anonymousOnboardingTransport";
import { appApi, type BirthDataDoc } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import { publicOnboardingApi } from "@/services/publicOnboardingRefs";

// Necesario para que el browser de OAuth devuelva el control a la app.
WebBrowser.maybeCompleteAuthSession();

/** Proveedores sociales del acceso oficial de Clerk. */
export type OAuthProvider = "google" | "apple";

/**
 * Google quedó validado por Lucas en iOS contra Clerk Producción y el callback
 * nativo allowlisted. En web conserva el flag explícito para no ofrecer una
 * conexión que el deploy no haya configurado.
 */
export const GOOGLE_AUTH_ENABLED =
  Platform.OS === "ios" ||
  (Platform.OS === "web" && process.env.EXPO_PUBLIC_ORBITA_GOOGLE_AUTH === "true");

/**
 * Apple quedó configurado en Clerk Producción y Apple Developer. iOS lo ofrece
 * de forma nativa; web conserva un flag separado por si se habilita allí.
 */
export const APPLE_AUTH_ENABLED =
  Platform.OS === "ios" ||
  (Platform.OS === "web" && process.env.EXPO_PUBLIC_ORBITA_APPLE_AUTH === "true");


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
  /** Crea el intento passwordless y envía el código al email. */
  start: (email: string) => Promise<void>;
  verify: (code: string) => Promise<boolean>;
  /** Reenvía el código sin crear otra cuenta ni reiniciar el flujo. */
  resend: () => Promise<ResendResult>;
  /**
   * El email ya tenía cuenta: el alta cambió a iniciar sesión con código. Se
   * expone para poder DECIRLO — si no, la pantalla de alta pide un código sin
   * explicar por qué dejó de ser un alta.
   */
  existingAccount: boolean;
  oauth: (provider: OAuthProvider, hooks?: SsoHooks) => Promise<SsoOutcome>;
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

/** Avisos por resultado del SSO, ANTES de activar la sesión. */
export type SsoHooks = {
  /**
   * Clerk resolvió el SSO por el recurso de INGRESO: la cuenta ya existía.
   * Corre ANTES de `setActive`, para que el marcador `anonymous_signup` se
   * descarte antes de que la consulta de completion pueda usarlo — con el
   * marcador vivo, una cuenta OAuth preexistente incompleta se reclasificaba
   * como alta nueva y era enviada al onboarding en vez del editor de datos.
   */
  onExistingAccount?: () => void;
};

/** OAuth SSO (Apple/Google), compartido entre el alta de cuenta y el sign-in. */
function useSSOOauth(
  setError: (v: string | null) => void,
  setOauthBusy: (v: OAuthProvider | null) => void,
): (provider: OAuthProvider, hooks?: SsoHooks) => Promise<SsoOutcome> {
  const { useSSO } = require("@clerk/expo") as typeof import("@clerk/expo");
  const { startSSOFlow } = useSSO();
  const redirectUrl =
    Platform.OS === "web"
      ? AuthSession.makeRedirectUri()
      : AuthSession.makeRedirectUri({ scheme: "com.lucasssram.orbita", path: "callback" });
  return useCallback(
    async (provider: OAuthProvider, hooks?: SsoHooks): Promise<SsoOutcome> => {
      setError(null);
      setOauthBusy(provider);
      try {
        // Estrategias oficiales de Clerk; el botón de cada proveedor sólo se
        // dibuja cuando su conexión está habilitada externamente.
        const strategy = provider === "apple" ? ("oauth_apple" as const) : ("oauth_google" as const);
        const { createdSessionId, setActive, signIn, signUp } = await startSSOFlow({
          strategy,
          redirectUrl
        });
        // Cuenta nueva vs. existente: EXCLUSIVAMENTE por coincidencia del id
        // de la sesión creada con su recurso (`classifySsoOutcome`, pura y con
        // tests conductuales) — los `status` pueden arrastrar un intento
        // previo. Ambos proveedores pasan por exactamente esta transición.
        const outcome = classifySsoOutcome({
          createdSessionId,
          signUpCreatedSessionId: signUp?.createdSessionId ?? null,
          signInCreatedSessionId: signIn?.createdSessionId ?? null
        });
        if (outcome === "cancelled" || !createdSessionId || !setActive) {
          // El usuario cerró el navegador o falta un paso (MFA): no es un error duro.
          return "cancelled";
        }
        // El descarte del marcador va ANTES de activar la sesión: la consulta
        // de completion no puede llegar a correr con el id de un alta nueva
        // para una cuenta que ya existía.
        if (outcome === "existing_account") hooks?.onExistingAccount?.();
        await setActive({ session: createdSessionId });
        return outcome;
      } catch (e) {
        setError(clerkErrorMessage(e));
        return "cancelled";
      } finally {
        setOauthBusy(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [redirectUrl, startSSOFlow]
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
  const [existingAccount, setExistingAccount] = useState(false);
  const flowRef = useRef<"signUp" | "signIn">("signUp");
  // emailAddressId del intento de sign-in (rama email ya existente): lo guarda
  // `start` para que el reenvío pueda repetir prepareFirstFactor sin perderlo.
  const emailAddressIdRef = useRef<string | null>(null);
  // Un código completo dispara auto-submit (CodeInput.onFilled) Y el tap del
  // botón: el guard evita que `verify` corra dos veces en paralelo.
  const verifyGuardRef = useRef<ReturnType<typeof makeReentrancyGuard>>(undefined);
  if (!verifyGuardRef.current) verifyGuardRef.current = makeReentrancyGuard();

  const start = useCallback(
    async (emailAddress: string) => {
      if (!signUp || !signIn) return;
      setBusy(true);
      setError(null);
      setExistingAccount(false);
      try {
        // Clerk Producción está configurado para alta por email + código, sin
        // contraseña obligatoria. Las cuentas legacy conservan la contraseña
        // como factor de ingreso dentro de `useSignInFlow`.
        await signUp.create({ emailAddress });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        flowRef.current = "signUp";
        emailAddressIdRef.current = null;
        setPhase("code");
      } catch (e) {
        const code = (e as { errors?: Array<{ code?: string }> })?.errors?.[0]?.code;
        if (code === "form_identifier_exists") {
          setExistingAccount(true);
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
            // `complete`, el email quedó verificado y faltan requisitos: se
            // dice QUÉ falta, nunca "el código no coincide".
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
    existingAccount,
    resetToEmail: () => {
      setError(null);
      setPhase("email");
      setExistingAccount(false);
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
  /** Contraseña (cuentas con password, p. ej. la de revisión de la tienda). */
  verifyPassword: (password: string) => Promise<boolean>;
  /** Cambiar a código por email desde la pantalla de contraseña. */
  sendEmailCode: () => Promise<void>;
  verify: (code: string) => Promise<boolean>;
  /** Reenvía el código conservando el emailAddressId (mismo intento). */
  resend: () => Promise<ResendResult>;
  oauth: (provider: OAuthProvider, hooks?: SsoHooks) => Promise<SsoOutcome>;
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
// Tríada real SIN login: la calcula `publicOnboarding.computeTriad`, una acción
// pública mínima (solo Sol/Luna/Ascendente). Antes se usaba el laboratorio
// (`publicLab.previewDailyHome`), bloqueado en producción por diseño: el
// cálculo fallaba siempre y el alta seguía de largo sin tríada. La zona horaria
// la deriva el backend de las coordenadas; acá no se usa la del dispositivo.
// ---------------------------------------------------------------------------

const HAS_CONVEX = backendConfig.hasConvex;

const SIGN_ES: Record<string, string> = {
  aries: "Aries", tauro: "Tauro", geminis: "Géminis", cancer: "Cáncer",
  leo: "Leo", virgo: "Virgo", libra: "Libra", escorpio: "Escorpio",
  sagitario: "Sagitario", capricornio: "Capricornio", acuario: "Acuario", piscis: "Piscis"
};

/** "geminis" → "Géminis". `null` si el backend no pudo resolver el signo. */
export function signLabelFromKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || /pendiente/i.test(s)) return null;
  const key = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return SIGN_ES[key] ?? capitalizeSign(s);
}

/**
 * Estado de la ÚNICA superficie de cálculo de la tríada.
 *
 * - `idle`: todavía no se pidió (o los datos cambiaron y la tríada anterior
 *   quedó invalidada).
 * - `loading`: "Preparando tu carta…".
 * - `ready`: "Tu carta ya está lista".
 * - `timed_out`: la espera VISIBLE superó los 8 segundos; el cálculo sigue en
 *   segundo plano y el avance queda siempre a mano.
 * - `error`: el proveedor falló; se dice el motivo y el avance continúa igual.
 *
 * Ningún estado retiene el onboarding: timeout y error continúan, y una
 * respuesta tardía se aprovecha después en Carta (el cálculo persistido corre
 * del lado del servidor desde el guardado de los datos natales).
 */
export type TriadStatus = "idle" | "loading" | "ready" | "timed_out" | "error";

/** Motivo del fallo, ya en el idioma del usuario (el alta lo muestra). */
export function describeTriadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (new RegExp(`${TRIAD_CLIENT_TIMEOUT_CODE}|ONBOARDING_TRIAD_PROVIDER_TIMEOUT`).test(message)) {
    return "La conexión tardó demasiado y no pudimos calcular tu carta.";
  }

  if (/ONBOARDING_TRIAD_RATE_LIMITED/.test(message)) {
    return "Estamos recibiendo muchas cartas al mismo tiempo. Probá de nuevo en un minuto.";
  }

  if (/ONBOARDING_TRIAD_INVALID_DRAFT_ID/.test(message)) {
    return "Se perdió el hilo de tu alta. Reintentá para volver a calcular tu carta.";
  }

  if (/ONBOARDING_TRIAD_INVALID_(BIRTH_DATE|BIRTH_TIME|BIRTH_TIME_PRECISION)/.test(message)) {
    return "Revisá tu fecha y tu hora de nacimiento: no pudimos usarlas para calcular la carta.";
  }

  if (/ONBOARDING_TRIAD_(INVALID_COORDINATES|INVALID_PLACE_LABEL|TIMEZONE_UNRESOLVED)/.test(message)) {
    return "Revisá tu lugar de nacimiento: necesitamos elegirlo del buscador para ubicar tu cielo.";
  }

  return "No pudimos calcular tu carta ahora mismo.";
}

export type ComputeTriadInput = {
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: "known" | "approximate" | "unknown";
  birthPlaceLabel: string;
  latitude?: number;
  longitude?: number;
  /** Borrador del alta: cupo de reintentos del endpoint público. Obligatorio. */
  clientDraftId?: string;
};

/** Devuelve una función que calcula la tríada real sin login. `null` sin Convex. */
export function useOnboardingComputeTriad(): ((input: ComputeTriadInput) => Promise<OnboardingChart>) | null {
  if (!HAS_CONVEX) return null;
  return useOnboardingComputeTriadInner();
}

function useOnboardingComputeTriadInner() {
  const computeTriad = useAction(publicOnboardingApi.computeTriad);
  return useCallback(
    async (input: ComputeTriadInput): Promise<OnboardingChart> => {
      // Sin coordenadas no hay cielo que ubicar ni zona que derivar: se corta
      // acá con el mismo código que usa el backend. Nunca se cae a la zona del
      // dispositivo — para alguien nacido en otra zona es la equivocada.
      if (typeof input.latitude !== "number" || typeof input.longitude !== "number") {
        throw new Error("ONBOARDING_TRIAD_INVALID_COORDINATES: falta el lugar de nacimiento.");
      }

      if (!input.clientDraftId) {
        throw new Error("ONBOARDING_TRIAD_INVALID_DRAFT_ID: falta el borrador del alta.");
      }

      // Sin conexión, `useAction` encola y la promesa nunca se asienta: el
      // techo del cliente convierte esa espera en un error con recuperación.
      const res = await withTriadTimeout(
        computeTriad({
          birthDate: input.birthDate,
          birthTime: input.birthTime,
          birthTimePrecision: input.birthTimePrecision,
          birthPlaceLabel: input.birthPlaceLabel,
          latitude: input.latitude,
          longitude: input.longitude,
          clientDraftId: input.clientDraftId
        })
      );

      return {
        resolved: true,
        sun: signLabelFromKey(res?.sun),
        moon: signLabelFromKey(res?.moon),
        ascendant: signLabelFromKey(res?.ascendant)
      };
    },
    [computeTriad]
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
/**
 * @deprecated El cierre del alta usa `useOnboardingFinalize`, que además
 * adjunta el borrador anónimo a la cuenta (`markAccountCreated` con el
 * `clientDraftId`) y reintenta la cadena completa. Esta variante escribe los
 * datos natales sin ese vínculo, así que un alta cerrada por acá queda como una
 * recuperación de cuenta preexistente. Se conserva sólo para consumidores
 * previos; no agregar usos nuevos.
 */
export function useOnboardingBirthDataPersist(): PersistBirthData | null {
  if (!HAS_BACKEND) return null;
  return useBackendPersistInner();
}

/**
 * Persistencia del EDITOR DE PERFIL: `birthData.upsertForCurrentUser` con
 * `source: "profile"`. Es el único camino para CAMBIAR datos natales ya
 * existentes; propaga el error para que "Guardar" pueda mostrar reintento.
 */
export function useProfileBirthDataPersist(): PersistBirthData | null {
  if (!HAS_BACKEND) return null;
  return useProfilePersistInner();
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

/**
 * Guardado natal del onboarding AUTH-FIRST: con la sesión activa desde el
 * paso 0, "Preparar mi carta" escribe los datos natales por el camino
 * autenticado (`onboarding.completeBirthData`, con el `clientDraftId` del
 * marcador de alta) y dispara el cálculo de la carta SIN esperarlo: el guardado
 * es la operación obligatoria y el derivado nunca bloquea la navegación —
 * Carta lo resuelve o lo reintenta si sigue pendiente.
 *
 * La zona horaria se deriva de las coordenadas del lugar en el backend
 * (Photon no la trae); nunca del reloj del dispositivo. Si la resolución falla,
 * el error se propaga y no se escribe nada: la pantalla ofrece reintentar.
 */
export type OnboardingBirthDataSave = (input: {
  birthDate: string;
  birthTime?: string;
  birthPlaceLabel?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  clientDraftId?: string;
}) => Promise<void>;

export function useOnboardingBirthDataSave(): OnboardingBirthDataSave | null {
  if (!HAS_BACKEND) return null;
  return useOnboardingBirthDataSaveInner();
}

function useOnboardingBirthDataSaveInner(): OnboardingBirthDataSave {
  const auth = useOrbitaAuth();
  const ensureUser = useMutation(appApi.users.getOrCreateCurrentUser);
  const completeBirthData = useMutation(appApi.onboarding.completeBirthData);
  const calculateChart = useAction(appApi.charts.calculateOrCreateNatalChart);
  const resolveTimezone = useAction(appApi.placeTimezone.atCoordinates);
  const isSignedIn = auth.isSignedIn;

  return useCallback(
    async (input) => {
      // Sin sesión no se escribe: el acceso es la PRIMERA superficie del flujo,
      // así que llegar acá sin cuenta es una carrera y la salida es reintentar.
      if (!isSignedIn) throw new Error("ONBOARDING_SESSION_NOT_READY");
      const lookup = timezoneLookupFor(input);
      const resolved = lookup
        ? withResolvedTimezone(input, (await resolveTimezone(lookup)).timezone)
        : input;
      // Nada de rellenar: sin lugar elegido, coordenadas o zona, no se escribe.
      const payload = validateBirthPayload(resolved);
      await ensureUser({});
      await completeBirthData({
        clientDraftId: input.clientDraftId,
        birthDate: payload.birthDate,
        birthTime: payload.birthTime,
        birthTimePrecision: payload.birthTime ? "known" : "unknown",
        birthPlaceLabel: payload.birthPlaceLabel,
        latitude: payload.latitude,
        longitude: payload.longitude,
        timezone: payload.timezone
      });
      // El derivado NUNCA participa del resultado del guardado.
      void calculateChart({}).catch(() => undefined);
    },
    [calculateChart, completeBirthData, ensureUser, isSignedIn, resolveTimezone]
  );
}

function useBackendPersistInner(): PersistBirthData {
  const auth = useOrbitaAuth();
  const ensureUser = useMutation(appApi.users.getOrCreateCurrentUser);
  const completeBirthData = useMutation(appApi.onboarding.completeBirthData);
  // Backend la define como Action (igual que en la web); antes acá estaba mal
  // como useMutation → "Trying to execute ... as Mutation, but defined as Action".
  const calculateChart = useAction(appApi.charts.calculateOrCreateNatalChart);
  const isSignedIn = auth.isSignedIn;

  return useCallback(
    async (input) => {
      // Con backend configurado, "sesión todavía no lista" es la carrera
      // post-verify: NO se puede resolver como éxito, porque el cierre seguiría
      // adelante sin haber escrito nada. Se rechaza y la pantalla ofrece
      // reintentar, que es lo que la carrera necesita.
      if (!isSignedIn) throw new Error("ONBOARDING_SESSION_NOT_READY");
      // Nada de rellenar: sin lugar elegido, coordenadas o zona, no se escribe.
      const payload = validateBirthPayload(input);
      await ensureUser({});
      await completeBirthData({
        birthDate: payload.birthDate,
        birthTime: payload.birthTime,
        birthTimePrecision: payload.birthTime ? "known" : "unknown",
        birthPlaceLabel: payload.birthPlaceLabel,
        latitude: payload.latitude,
        longitude: payload.longitude,
        timezone: payload.timezone
      });
      await calculateChart({});
      // NO se llama `readings.generateToday` acá: usaba la fecha y la timezone
      // del dispositivo, y el día astrológico lo decide el servidor desde la
      // zona natal (`daily.getTodayContext`). La generación diaria sigue por el
      // camino canónico, que ya corre en la Home con la fecha del servidor.
    },
    [calculateChart, completeBirthData, ensureUser, isSignedIn]
  );
}

// ---------------------------------------------------------------------------
// Alta durable: borrador remoto anónimo → Clerk → adjuntar → carta → readiness.
//
// El orden NO es decorativo. Antes de que exista una cuenta, el alta entera vive
// en el borrador local; si Clerk se monta primero y algo falla después, queda
// una identidad sin datos que ninguna pantalla sabe recuperar. Por eso el
// borrador se persiste y se CONFIRMA remoto antes de abrir Clerk, y el
// `clientDraftId` se conserva para adjuntarlo a la cuenta recién creada.
// ---------------------------------------------------------------------------

/** Presupuestos de la cadena idempotente del cierre (ver `runSessionAttempts`). */
const FINALIZE_BUDGET_MS = 60000;
const FINALIZE_CALL_TIMEOUT_MS = 25000;
const FINALIZE_RETRY_PAUSE_MS = 900;

export type { SignupDraftInput };

/**
 * Persiste el borrador remoto del alta y espera su confirmación.
 *
 * `saveDraft` anónimo con `clientDraftId` deja el borrador con
 * `flowOrigin: "anonymous_signup"`; `confirmSignupDraft` sólo devuelve
 * `{ ready: true }` cuando ese borrador está COMPLETO — incluida la zona
 * horaria, que el backend resuelve solo en segundo plano. Por eso se reintenta:
 * un enriquecimiento en vuelo no es un error, y la persona no tiene que volver
 * atrás ni elegir una zona.
 *
 * Rechaza si al agotar el presupuesto sigue incompleto: en ese caso NO se abre
 * Clerk. Crear la identidad primero es exactamente lo que produce cuentas
 * huérfanas.
 *
 * **Las dos llamadas viajan por un canal sin autenticar** — nunca por
 * `useConvex()`. El cliente compartido lo autentica Clerk cuando Clerk resuelve,
 * y eso puede caer con esta cadena en vuelo: un `saveDraft` con identidad marca
 * el borrador `accountState: "created"` y `confirmSignupDraft` deja de devolver
 * `ready` para siempre. Ver `src/services/anonymousOnboardingTransport.ts`.
 */
/**
 * Marcador de "alta en curso" del flujo auth-first.
 *
 * Antes de crear la cuenta, se guarda un borrador remoto MÍNIMO (sólo
 * `clientDraftId` + paso) por el canal anónimo. Es lo que hace que
 * `getCompletionStatus` clasifique la cuenta recién creada como un alta en
 * curso (`recovery: "onboarding"`) y no como una cuenta preexistente incompleta
 * (`edit_birth_data`): sin él, el remonte de la web tras el redirect de Clerk
 * sacaba a la persona del onboarding y la dejaba en el editor suelto.
 *
 * Es IMPRESCINDIBLE, así que el fallo se PROPAGA: si el marcador no se pudo
 * guardar, Clerk no se abre — crear la identidad sin él es exactamente lo que
 * produce la reclasificación. La pantalla dice el fallo y ofrece reintentar
 * (la escritura es idempotente por `clientDraftId`).
 */
export function useAnonymousSignupMarker(): ((clientDraftId: string) => Promise<void>) | null {
  if (!HAS_BACKEND) return null;
  return useAnonymousSignupMarkerInner();
}

function useAnonymousSignupMarkerInner(): (clientDraftId: string) => Promise<void> {
  const transport = useMemo(() => anonymousSignupDraftTransport(), []);
  return useCallback(
    async (clientDraftId: string) => {
      // `HAS_BACKEND` ya exige Convex; sin canal, el marcador no puede quedar
      // guardado y no se abre Clerk (nunca se resuelve como éxito).
      if (!transport) throw new Error("ONBOARDING_SIGNUP_MARKER_UNAVAILABLE");
      await transport.saveDraft({ clientDraftId, currentStep: 0 });
    },
    [transport]
  );
}

/**
 * @deprecated El flujo auth-first ya no confirma un borrador completo antes de
 * abrir Clerk: siembra el marcador mínimo (`useAnonymousSignupMarker`) y
 * persiste los datos por el camino autenticado (`useOnboardingBirthDataSave`).
 * Se conserva junto a `useOnboardingFinalize` porque el contrato del backend
 * (saveDraft/confirm/completeSignupFromDraft) sigue vigente para builds
 * publicados; no agregar usos nuevos.
 */
export function useOnboardingSignupDraft(): ((input: SignupDraftInput) => Promise<void>) | null {
  if (!HAS_BACKEND) return null;
  return useOnboardingSignupDraftInner();
}

function useOnboardingSignupDraftInner(): (input: SignupDraftInput) => Promise<void> {
  // Transporte DEDICADO y explícitamente anónimo. `useConvex()` no se usa acá a
  // propósito: es el cliente atado a Clerk y su token aparece cuando Clerk
  // quiere, no cuando el alta puede.
  const transport = useMemo(() => anonymousSignupDraftTransport(), []);
  return useCallback(
    async (input: SignupDraftInput) => {
      // `HAS_BACKEND` ya exige Convex; si aun así no hay canal, el borrador no
      // quedó listo y no se abre Clerk (nunca se resuelve como éxito).
      if (!transport) throw new Error(SIGNUP_DRAFT_NOT_READY);
      // La cadena vive en `src/domain/anonymousSignupDraft.ts`: guarda, después
      // confirma, reintenta mientras dure el presupuesto y rechaza si no llegó.
      await persistSignupDraft(transport, input);
    },
    [transport]
  );
}

/**
 * Cierre del alta con la sesión YA activa: copiar atómicamente el borrador
 * remoto confirmado a la cuenta. El cálculo de carta se intenta después, pero
 * es un derivado y nunca participa del resultado del guardado.
 *
 * `completeSignupFromDraft` adjunta el borrador y crea `birthData` dentro de
 * una sola mutation idempotente. Así la timezone resuelta por el servidor no
 * puede perderse por una copia vieja en React o sessionStorage.
 *
 * NO decide el destino: quien autoriza entrar es `getCompletionStatus`.
 */
export type FinalizeOnboarding = (input: {
  clientDraftId: string;
}) => Promise<void>;

/**
 * @deprecated Ver `useOnboardingSignupDraft`: el flujo auth-first cierra con
 * `useOnboardingBirthDataSave`. Se conserva por el contrato publicado.
 */
export function useOnboardingFinalize(): FinalizeOnboarding | null {
  if (!HAS_BACKEND) return null;
  return useOnboardingFinalizeInner();
}

function useOnboardingFinalizeInner(): FinalizeOnboarding {
  const convex = useConvex();
  const auth = useOrbitaAuth();
  const isSignedIn = auth.isSignedIn;

  return useCallback(
    async (input) => {
      // Sin sesión no se escribe: sería el cierre navegando sobre nada.
      if (!isSignedIn) throw new Error("ONBOARDING_SESSION_NOT_READY");
      const result = await runSessionAttempts({
        budgetMs: FINALIZE_BUDGET_MS,
        callTimeoutMs: FINALIZE_CALL_TIMEOUT_MS,
        retryPauseMs: FINALIZE_RETRY_PAUSE_MS,
        attempt: async (timebox) => {
          await timebox(convex.mutation(appApi.users.getOrCreateCurrentUser, {}));
          // Una sola escritura autoritativa: adjunta el borrador confirmado y
          // copia SUS datos, no una réplica enviada por el navegador.
          await timebox(
            convex.mutation(appApi.onboarding.completeSignupFromDraft, {
              clientDraftId: input.clientDraftId
            })
          );
          return true as const;
        }
      });
      if (result.status === "error") throw new Error("ONBOARDING_FINALIZE_FAILED");
      // Mejor esfuerzo: la action puede seguir viva después de navegar. Si el
      // proveedor falla, Carta vuelve a dispararla al abrirse y ofrece reintento.
      void convex.action(appApi.charts.calculateOrCreateNatalChart, {}).catch(() => undefined);
    },
    [convex, isSignedIn]
  );
}

/**
 * Estado autoritativo de readiness. `undefined` = todavía no resolvió (nunca se
 * interpreta como "listo" ni como "incompleto").
 */
export function useOnboardingCompletion(clientDraftId?: string): OnboardingCompletion | undefined {
  if (!HAS_BACKEND) return undefined;
  return useOnboardingCompletionInner(clientDraftId);
}

function useOnboardingCompletionInner(clientDraftId?: string): OnboardingCompletion | undefined {
  const auth = useOrbitaAuth();
  return useQuery(
    appApi.onboarding.getCompletionStatus,
    auth.isAuthenticated ? { clientDraftId } : "skip"
  ) as OnboardingCompletion | undefined;
}

/** Igual que la anterior pero contra el endpoint de PERFIL (edición). */
function useProfilePersistInner(): PersistBirthData {
  const auth = useOrbitaAuth();
  const ensureUser = useMutation(appApi.users.getOrCreateCurrentUser);
  const upsertBirthData = useMutation(appApi.birthData.upsertForCurrentUser);
  const calculateChart = useAction(appApi.charts.calculateOrCreateNatalChart);
  const resolveTimezone = useAction(appApi.placeTimezone.atCoordinates);
  const isSignedIn = auth.isSignedIn;

  return useCallback(
    async (input) => {
      // Sesión no lista: rechazar, no resolver. Si resolviera, el editor
      // aplicaría el cambio local como si el backend lo hubiera guardado.
      if (!isSignedIn) throw new Error("PROFILE_SESSION_NOT_READY");
      // Zona horaria del LUGAR, derivada de sus coordenadas en el backend. Va
      // antes de validar y antes de escribir: Photon no trae timezone, así que
      // sin esto una ciudad recién elegida (o un documento legado con coords y
      // sin zona) moría en `zonaFaltante`. Si la resolución falla, el error se
      // propaga y no se escribe nada — ni remoto ni local. Nunca se cae a la
      // zona del dispositivo: para alguien nacido en otra zona es la equivocada.
      const lookup = timezoneLookupFor(input);
      const resolved = lookup ? withResolvedTimezone(input, (await resolveTimezone(lookup)).timezone) : input;
      // Validación en el BORDE de escritura. `birthSaveGate` espera el doc
      // remoto, pero no lo valida: con un documento legado incompleto (sin
      // coordenadas y con el lugar en "Sin especificar"), cambiar sólo la fecha
      // o la hora arrastraba ese lugar vacío y volvía a escribirlo, recalculando
      // la carta sobre datos que no son de nadie.
      const payload = validateBirthPayload(resolved);
      await ensureUser({});
      await upsertBirthData({
        birthDate: payload.birthDate,
        birthTime: payload.birthTime,
        birthTimePrecision: payload.birthTime ? "known" : "unknown",
        birthPlaceLabel: payload.birthPlaceLabel,
        latitude: payload.latitude,
        longitude: payload.longitude,
        timezone: payload.timezone,
        // Marca la intención: es una edición del perfil, no el alta.
        source: "profile"
      });
      // Guardar los datos es la operación obligatoria. La carta derivada no
      // puede convertir un guardado confirmado en un falso error del editor.
      void calculateChart({}).catch(() => undefined);
    },
    [calculateChart, ensureUser, isSignedIn, resolveTimezone, upsertBirthData]
  );
}
