import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";

import { resolveProfileOwnerAtCreation } from "@/domain/sessionStart";
import { getZodiacSign, signLabels } from "@/domain/zodiac";
import type { Topic, ZodiacSign } from "@/domain/types";
import { useAppState } from "@/hooks/useAppState";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { useProductTelemetry } from "@/hooks/useProductTelemetry";
import { backendConfig } from "@/services/backendProviders";

import { AccountScreen } from "./screens/AccountScreen";
import { AlignScreen } from "./screens/AlignScreen";
import { BaseChartScreen } from "./screens/BaseChartScreen";
import { BeforeAfterScreen } from "./screens/BeforeAfterScreen";
import { type BirthDateParts, BirthdateScreen, MONTHS } from "./screens/BirthdateScreen";
import { BirthdateSelectedScreen } from "./screens/BirthdateSelectedScreen";
import { BirthplaceSearchScreen, type PlaceOption } from "./screens/BirthplaceSearchScreen";
import { BirthplaceSelectedScreen } from "./screens/BirthplaceSelectedScreen";
import { type BirthTime, BirthTimeScreen } from "./screens/BirthTimeScreen";
import { BirthTimeSelectedScreen } from "./screens/BirthTimeSelectedScreen";
import { DailyGuidanceScreen } from "./screens/DailyGuidanceScreen";
import { type Identity, IdentifyScreen } from "./screens/IdentifyScreen";
import { PaywallScreen, type PlanId } from "./screens/PaywallScreen";
import { PersonalizingScreen } from "./screens/PersonalizingScreen";
import { SplashScreen } from "./screens/SplashScreen";
import { orbita } from "./theme";
import { validateSignupPassword } from "./signup";
import { useAccountFlow, useBackendPersist, useOnboardingChart, useOnboardingComputeTriad } from "./useAccount";
import type { OnboardingChart } from "./useAccount";

const TOTAL = 15;

// Con backend hay puerta "Ya tengo cuenta" en la entrada (paso 0).
const HAS_BACKEND = backendConfig.hasConvex && backendConfig.hasClerk;

// Paso donde arranca la carga de datos de nacimiento (continuación del alta
// post-login para una cuenta sin birthData: `/onboarding?resume=datos`).
const STEP_BIRTHDATE = 4;
// Primer paso del alta propiamente dicha (el 0 es la entrada con las puertas).
// Destino de "Crear una cuenta" desde el login: `/onboarding?nuevo=1`.
const STEP_ALTA = 1;
const STEP_ACCOUNT = 13;

// Paywall temporalmente DESACTIVADO (2-3 semanas, mientras refinamos el onboarding
// y el flujo). Con `false`, al terminar el onboarding se entra DIRECTO a la app sin
// pasar por el paso de pago (step 14). Para reactivar: PAYWALL_ENABLED = true.
const PAYWALL_ENABLED = false;

const ELEMENTS: Record<ZodiacSign, string> = {
  aries: "Fuego",
  tauro: "Tierra",
  geminis: "Aire",
  cancer: "Agua",
  leo: "Fuego",
  virgo: "Tierra",
  libra: "Aire",
  escorpio: "Agua",
  sagitario: "Fuego",
  capricornio: "Tierra",
  acuario: "Aire",
  piscis: "Agua",
};

const DEFAULT_TOPICS: Topic[] = ["claridad", "energia"];

/** {hour, minute} (hora ya en 24h, 0–23) → "HH:MM" (lo que espera el backend). */
function to24hFromParts(t: BirthTime): string {
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

/** Onboarding container — owns flow state and navigation, dispatches screens. */
export function OnboardingFlow() {
  const fontsLoaded = useOrbitaFonts();
  const router = useRouter();
  const { createProfile } = useAppState();
  const { auth } = useLiveApp();
  const params = useLocalSearchParams<{
    debugStep?: string;
    resume?: string;
    nuevo?: string;
    email?: string;
  }>();

  // `resume=datos`: sesión activa sin datos de nacimiento → continuar el alta
  // desde la fecha, sin repetir splash/pitch ni crear una segunda cuenta.
  // `nuevo=1`: viene de "Crear una cuenta" en el login → arranca el alta en su
  // primer paso; la entrada (paso 0) ya la pasó.
  const [step, setStep] = useState(() =>
    params.resume === "datos" ? STEP_BIRTHDATE : params.nuevo === "1" ? STEP_ALTA : 0
  );
  const [identity, setIdentity] = useState<Identity>("ella");
  const [birthDate, setBirthDate] = useState<BirthDateParts>({ day: 15, month: 1, year: 1996 });
  const [placeQuery, setPlaceQuery] = useState("");
  const [birthPlace, setBirthPlace] = useState<PlaceOption | undefined>();
  const [birthTime, setBirthTime] = useState<BirthTime>({ hour: 12, minute: 0 });
  const [timeUnknown, setTimeUnknown] = useState(false);
  // Email tipeado en el login y traído por "Crear una cuenta" (`?email=`): el
  // usuario no lo vuelve a escribir; llega ya cargado al paso de cuenta.
  const [email, setEmail] = useState(() => (typeof params.email === "string" ? params.email : ""));
  // Clerk Producción exige contraseña en el alta: se pide + confirmación.
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountFormError, setAccountFormError] = useState<string | null>(null);
  const [accountCode, setAccountCode] = useState("");
  const [plan, setPlan] = useState<PlanId>("annual");
  const account = useAccountFlow();
  const persistBackend = useBackendPersist();
  const chartPreview = useOnboardingChart();
  const computeTriad = useOnboardingComputeTriad();
  const [computed, setComputed] = useState<OnboardingChart | undefined>();
  const [retryTick, setRetryTick] = useState(0);
  const calcFired = useRef(false);
  const computedSig = useRef<string | null>(null);
  // La sesión se activó EN este flujo (verify/oauth ok): fuente de verdad
  // inmediata, porque useAuth puede seguir stale en el render siguiente.
  const sessionActivated = useRef(false);

  // Dev preview: jump to any step via ?debugStep=N.
  useEffect(() => {
    const n = Number(params.debugStep);
    if (Number.isFinite(n) && n >= 0 && n < TOTAL) setStep(n);
  }, [params.debugStep]);

  // Respaldo del resume: si los params llegan un render después del mount,
  // el useState inicial no los vio. Solo salta si todavía está en la entrada.
  useEffect(() => {
    if (params.resume === "datos") setStep((s) => (s === 0 ? STEP_BIRTHDATE : s));
  }, [params.resume]);

  // Mismo respaldo para `nuevo=1` (y su email) llegando un render tarde.
  useEffect(() => {
    if (params.nuevo === "1") setStep((s) => (s === 0 ? STEP_ALTA : s));
  }, [params.nuevo]);

  // Eventos de producto (best-effort, jamás afecta el flujo): el paso 0 es la
  // entrada con las puertas, no un paso funcional — el flujo "empieza" recién
  // en STEP_ALTA (o directo en fecha/cuenta si se retoma por deep-link).
  // `onboarding_started` una vez por ejecución; `onboarding_step_viewed` una
  // vez por paso por ejecución, con el índice real del paso.
  const telemetry = useProductTelemetry();
  const onbStarted = useRef(false);
  const onbStepsSent = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (step < STEP_ALTA) return;
    if (!onbStarted.current) {
      onbStarted.current = true;
      telemetry.track("onboarding_started");
    }
    if (!onbStepsSent.current.has(step)) {
      onbStepsSent.current.add(step);
      telemetry.track("onboarding_step_viewed", { onboardingStep: step });
    }
  }, [step, telemetry]);

  useEffect(() => {
    if (typeof params.email === "string" && params.email) setEmail((e) => e || params.email!);
  }, [params.email]);

  const next = () => setStep((s) => Math.min(TOTAL - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const birthDateISO = useMemo(
    () =>
      `${birthDate.year}-${String(birthDate.month).padStart(2, "0")}-${String(birthDate.day).padStart(2, "0")}`,
    [birthDate],
  );
  const sign = useMemo(() => getZodiacSign(birthDateISO), [birthDateISO]);
  const signLabel = signLabels[sign];
  const element = ELEMENTS[sign];
  const dateLabel = `${birthDate.day} de ${MONTHS[birthDate.month - 1].toLowerCase()} de ${birthDate.year}`;
  const dateShort = `${birthDate.day} ${MONTHS[birthDate.month - 1].slice(0, 3)} ${birthDate.year}`;
  const timeLabel = timeUnknown
    ? "Sin hora"
    : `${String(birthTime.hour).padStart(2, "0")}:${String(birthTime.minute).padStart(2, "0")}`;
  const placeShort = birthPlace?.label.split(",")[0] ?? "";

  // Al llegar al preview (paso 14) disparamos el cálculo REAL de la carta una vez.
  // Con sesión Clerk persiste birthData + carta + primera lectura; sin sesión no
  // hace nada (persistBackend chequea isSignedIn) y el preview degrada a solo-Sol.
  useEffect(() => {
    if (step !== 14 || calcFired.current || !persistBackend) return;
    calcFired.current = true;
    void persistBackend({
      birthDate: birthDateISO,
      birthTime: timeUnknown ? undefined : timeLabel,
      birthPlaceLabel: birthPlace?.label,
      latitude: birthPlace?.latitude,
      longitude: birthPlace?.longitude,
      timezone: birthPlace?.timezone,
    });
  }, [step, persistBackend, birthDateISO, timeUnknown, timeLabel, birthPlace]);

  // Tríada real SIN login: al llegar a "Personalizing"(11) calculamos la carta con
  // el endpoint público, para que el preview muestre Luna/Ascendente reales aunque
  // el usuario no se haya logueado todavía. Requiere lugar (coords del geocoding).
  useEffect(() => {
    if (step < 11 || !computeTriad || !birthPlace) return;
    const birthTimeStr = timeUnknown ? undefined : to24hFromParts(birthTime);
    // Firma de los datos: si cambia (el usuario editó fecha/hora/lugar) recalcula;
    // si es la misma, no vuelve a pegarle a la API. Antes un ref "fired" dejaba
    // pegada la tríada de una persona anterior.
    const sig = `${birthDateISO}|${birthTimeStr ?? "?"}|${birthPlace.label}`;
    if (computedSig.current === sig) return;
    computedSig.current = sig;
    let cancelled = false;
    computeTriad({
      birthDate: birthDateISO,
      birthTime: birthTimeStr,
      birthTimePrecision: timeUnknown ? "unknown" : "known",
      birthPlaceLabel: birthPlace.label,
      latitude: birthPlace.latitude,
      longitude: birthPlace.longitude,
      timezone: birthPlace.timezone,
    })
      .then((r) => { if (!cancelled) setComputed(r); })
      .catch(() => { computedSig.current = null; });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, computeTriad, birthPlace, birthDateISO, timeUnknown, birthTime.hour, birthTime.minute, retryTick]);

  // `codeOverride`: la auto-verificación del CodeInput pasa el código recién
  // completado directo (el estado `accountCode` todavía no re-renderizó).
  const accountNext = async (codeOverride?: string) => {
    if (!account || account.isSignedIn) {
      next();
      return;
    }
    const trimmed = email.trim().toLowerCase();
    if (account.phase === "email") {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
        setAccountFormError("Revisá el email.");
        return;
      }
      const pwError = validateSignupPassword(password, confirmPassword);
      if (pwError) {
        setAccountFormError(pwError);
        return;
      }
      setAccountFormError(null);
      await account.start(trimmed, password);
      return;
    }
    const ok = await account.verify((codeOverride ?? accountCode).trim());
    if (ok) {
      sessionActivated.current = true;
      next();
    }
  };

  const accountOAuth = async (provider: "google" | "apple") => {
    if (!account) {
      next();
      return;
    }
    const ok = await account.oauth(provider);
    if (ok) {
      sessionActivated.current = true;
      next();
    }
  };

  const submit = async () => {
    const birthTimeValue = timeUnknown ? undefined : timeLabel;
    // Con sesión activa (alta con cuenta, OAuth o resume=datos post-login) el
    // perfil queda marcado con su dueño: el próximo arranque lo reconoce como
    // propio en vez de mandarlo a reconciliar. Guest → sin dueño. Carrera
    // post-verify: si useAuth sigue stale (userId todavía no llegó), el
    // perfil se crea sin dueño con ADOPCIÓN PENDIENTE y se marca solo apenas
    // aparece el userId (resolveProfileOwnerAtCreation + AppState).
    const owner = resolveProfileOwnerAtCreation({
      sessionActive: sessionActivated.current || !!auth?.isSignedIn || !!account?.isSignedIn,
      knownUserId: auth?.userId ?? null,
    });
    await createProfile(
      {
        name: "Visitante",
        birthDate: birthDateISO,
        birthTime: birthTimeValue,
        birthPlace: birthPlace?.label,
        interests: DEFAULT_TOPICS,
        guidanceTone: "protectora",
        notificationTime: "09:00",
      },
      owner.ownerUserId,
      owner.adoptWhenReady,
    );
    // Con sesión Clerk: persistir en Convex en background (no bloquea la entrada).
    if (persistBackend) {
      void persistBackend({
        birthDate: birthDateISO,
        birthTime: birthTimeValue,
        birthPlaceLabel: birthPlace?.label,
        latitude: birthPlace?.latitude,
        longitude: birthPlace?.longitude,
        timezone: birthPlace?.timezone,
      });
    }
    // Al salir del onboarding, la primera entrega: la ceremonia de recepción de la
    // carta natal (/recepcion, full-screen, una sola vez). La tríada calculada viaja
    // por params para no depender de que Convex ya haya persistido la carta.
    router.replace({
      pathname: "/recepcion",
      params: {
        ...(computed?.sun ? { sol: computed.sun } : {}),
        ...(computed?.moon ? { luna: computed.moon } : {}),
        ...(computed?.ascendant ? { asc: computed.ascendant } : {}),
      },
    });
  };

  // Sin paywall: al llegar al paso de pago (step 14) se entra directo a la app.
  useEffect(() => {
    if (step === 14 && !PAYWALL_ENABLED) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Sesión ya activa (login previo o continuación del alta): el paso de crear
  // cuenta se saltea solo — nunca pedir crear/iniciar sesión de nuevo.
  useEffect(() => {
    if (step === STEP_ACCOUNT && account?.isSignedIn) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, account?.isSignedIn]);

  if (!fontsLoaded) return <View style={styles.fill} />;

  let screen: ReactNode;
  switch (step) {
    case 0:
      screen = (
        <SplashScreen
          onNext={next}
          onSignIn={HAS_BACKEND ? () => router.push("/iniciar-sesion") : undefined}
        />
      );
      break;
    case 1:
      screen = <AlignScreen onNext={next} onBack={back} />;
      break;
    case 2:
      screen = (
        <IdentifyScreen step={step} identity={identity} onSelect={setIdentity} onNext={next} onBack={back} />
      );
      break;
    case 3:
      screen = <DailyGuidanceScreen step={step} onNext={next} onBack={back} />;
      break;
    case 4:
      screen = (
        <BirthdateScreen step={step} value={birthDate} onChange={setBirthDate} onNext={next} onBack={back} />
      );
      break;
    case 5:
      screen = (
        <BirthdateSelectedScreen
          step={step}
          sign={signLabel}
          element={element}
          dateLabel={dateLabel}
          onNext={next}
          onBack={back}
        />
      );
      break;
    case 6:
      screen = (
        <BirthplaceSearchScreen
          step={step}
          query={placeQuery}
          onQuery={setPlaceQuery}
          onSelect={(p) => {
            setBirthPlace(p);
            setStep(7);
          }}
          onBack={back}
        />
      );
      break;
    case 7:
      screen = (
        <BirthplaceSelectedScreen
          step={step}
          place={birthPlace?.label ?? "Buenos Aires, Argentina"}
          onNext={next}
          onBack={back}
        />
      );
      break;
    case 8:
      screen = (
        <BirthTimeScreen
          step={step}
          value={birthTime}
          onChange={setBirthTime}
          unknown={timeUnknown}
          onToggleUnknown={() => setTimeUnknown((v) => !v)}
          onNext={() => setStep(timeUnknown ? 10 : 9)}
          onBack={back}
        />
      );
      break;
    case 9:
      screen = <BirthTimeSelectedScreen step={step} timeLabel={timeLabel} onNext={next} onBack={back} />;
      break;
    case 10:
      screen = (
        <BaseChartScreen
          step={step}
          dateLabel={dateShort}
          place={placeShort || "Buenos Aires"}
          timeLabel={timeLabel}
          onNext={next}
          onBack={back}
        />
      );
      break;
    case 11:
      screen = <PersonalizingScreen step={step} onDone={next} onBack={back} />;
      break;
    case 12:
      screen = <BeforeAfterScreen step={step} onNext={next} onBack={back} />;
      break;
    case 13:
      screen = (
        <AccountScreen
          step={step}
          email={email}
          onEmail={setEmail}
          password={password}
          onPassword={setPassword}
          confirmPassword={confirmPassword}
          onConfirmPassword={setConfirmPassword}
          formError={accountFormError}
          code={accountCode}
          onCode={setAccountCode}
          account={account}
          onNext={accountNext}
          onOAuth={accountOAuth}
          onBack={back}
        />
      );
      break;
    case 14:
    default:
      // Paso 14 = paywall único. La tríada real va arriba como gancho (antes era
      // una pantalla de preview aparte, que hacía parecer que pagabas dos veces).
      // Desactivado temporalmente (PAYWALL_ENABLED=false): el useEffect de arriba
      // entra directo a la app; acá solo mostramos loading para no flashear el pago.
      screen = PAYWALL_ENABLED ? (
        <PaywallScreen
          plan={plan}
          onPlan={setPlan}
          onUnlock={submit}
          onBack={back}
          chart={computed ?? chartPreview}
          sunFallback={signLabel}
          timeKnown={!timeUnknown}
          onRetry={() => {
            computedSig.current = null;
            setComputed(undefined);
            setRetryTick((t) => t + 1);
          }}
        />
      ) : (
        <View style={styles.fill} />
      );
      break;
  }

  return (
    <View className="dark" style={styles.fill}>
      <StatusBar style="light" />
      {screen}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { backgroundColor: orbita.bg, flex: 1 },
});
