import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";

import { resolveProfileOwnerAtCreation } from "@/domain/sessionStart";
import { getZodiacSign, signLabels } from "@/domain/zodiac";
import type { Topic, ZodiacSign } from "@/domain/types";
import { useAppState } from "@/hooks/useAppState";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { WebLayoutProvider } from "@/components/web/web-layout-provider";
import { backendConfig } from "@/services/backendProviders";
import { clearDraft, readDraft, writeDraft } from "@/domain/onboardingDraft";
import { resolveDebugStep } from "@/domain/onboardingDebug";
import { INTERNAL_TOOLS_ENABLED } from "@/services/internalTools";

import { BirthPayloadError, birthPayloadMessage } from "@/domain/birthPayload";
import { A } from "./assets";
import { CTA } from "./components/CTA";
import { Screen } from "./components/Screen";
import { Body, Title } from "./components/Type";
import { AccountScreen } from "./screens/AccountScreen";
import { AlignScreen } from "./screens/AlignScreen";
import { BaseChartScreen } from "./screens/BaseChartScreen";
import { BeforeAfterScreen } from "./screens/BeforeAfterScreen";
import { MONTHS } from "./months";
import { type BirthDateParts, BirthdateScreen } from "./screens/BirthdateScreen";
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
import { validateSignupPassword } from "./signup";
import { orbita } from "./theme";
import {
  useAccountFlow,
  useOnboardingBirthDataPersist,
  useOnboardingChart,
  useOnboardingComputeTriad
} from "./useAccount";
import type { OnboardingChart } from "./useAccount";

// El alta de cuenta vuelve a su lugar en la secuencia V4.4 (`14 / Create
// Account`): la experiencia inmersiva engancha primero y la cuenta se pide
// cuando ya hay algo que guardar. Los índices se nombran a propósito: el camino
// de escritura depende de ellos y un renumerado silencioso ya costó datos.
const TOTAL = 15;
/** Primer paso que ya puede calcular la tríada real (necesita lugar). */
const STEP_COMPUTE_TRIAD = 11;
/** Paso de cuenta: penúltimo. Antes de él NADA sale del dispositivo. */
const STEP_ACCOUNT = 13;
/** Último paso: cierra el onboarding (paywall si estuviera activo). */
const FINAL_STEP = TOTAL - 1;

// Con backend hay puerta "Ya tengo cuenta" en la entrada (paso 0).
const HAS_BACKEND = backendConfig.hasConvex && backendConfig.hasClerk;

// Paso donde arranca la carga de datos de nacimiento (continuación del alta
// post-login para una cuenta sin birthData: `/onboarding?resume=datos`).
const STEP_BIRTHDATE = 4;

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
export function OnboardingFlow({
  inspectStep,
  inspectWidth
}: { inspectStep?: number; inspectWidth?: number } = {}) {
  const fontsLoaded = useOrbitaFonts();
  const router = useRouter();
  const { createProfile } = useAppState();
  const { auth } = useLiveApp();
  const params = useLocalSearchParams<{
    debugStep?: string;
    resume?: string;
    email?: string;
  }>();

  // `resume=datos`: sesión activa sin datos de nacimiento → continuar el alta
  // desde la fecha, sin repetir splash/pitch ni crear una segunda cuenta.
  // `nuevo=1`: viene de "Crear una cuenta" en el login → arranca el alta en su
  // primer paso; la entrada (paso 0) ya la pasó.
  // Borrador de sesión: en web, crear la cuenta hace que Clerk vuelva a
  // `/empezar` y el remonte borraba todo lo cargado. Los params explícitos
  // (`resume`, `nuevo`) mandan sobre el borrador: son una intención del usuario.
  // En nativo `readDraft` devuelve null (no hay sessionStorage) y nada cambia.
  const saved = useMemo(() => readDraft(TOTAL), []);

  const [step, setStep] = useState(() =>
    params.resume === "datos" ? STEP_BIRTHDATE : saved?.step ?? 0
  );
  const [identity, setIdentity] = useState<Identity>((saved?.identity as Identity) ?? "ella");
  const [birthDate, setBirthDate] = useState<BirthDateParts>(
    saved?.birthDate ?? { day: 15, month: 1, year: 1996 }
  );
  const [placeQuery, setPlaceQuery] = useState(saved?.placeQuery ?? "");
  const [birthPlace, setBirthPlace] = useState<PlaceOption | undefined>(
    saved?.birthPlace as PlaceOption | undefined
  );
  const [birthTime, setBirthTime] = useState<BirthTime>(saved?.birthTime ?? { hour: 12, minute: 0 });
  const [timeUnknown, setTimeUnknown] = useState(saved?.timeUnknown ?? false);
  // Email tipeado en el login y traído por "Crear una cuenta" (`?email=`): el
  // usuario no lo vuelve a escribir; llega ya cargado al paso de cuenta.
  const [email, setEmail] = useState(() =>
    typeof params.email === "string" && params.email ? params.email : saved?.email ?? ""
  );
  // Clerk Producción exige contraseña en el alta: se pide + confirmación.
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountFormError, setAccountFormError] = useState<string | null>(null);
  const [accountCode, setAccountCode] = useState("");
  const [plan, setPlan] = useState<PlanId>("annual");
  const account = useAccountFlow();
  // Persistencia ESTRICTA: propaga el error. Con el wrapper anterior el catch
  // de `submit` era inalcanzable y el alta navegaba sin haber escrito.
  const persistBackend = useOnboardingBirthDataPersist();
  const chartPreview = useOnboardingChart();
  const computeTriad = useOnboardingComputeTriad();
  const [computed, setComputed] = useState<OnboardingChart | undefined>();
  const [retryTick, setRetryTick] = useState(0);
  // Persistencia del cierre: sin esto un fallo navegaba a la recepción
  // como si el alta hubiera funcionado.
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Lock SINCRÓNICO. `submitting` es estado de React: recién se refleja en el
  // próximo render, así que dos taps en el mismo render pasaban los dos. El ref
  // se toma en la primera línea; sólo se libera al fallar (en el éxito ya
  // navegamos fuera del flujo).
  const submitLock = useRef(false);
  const computedSig = useRef<string | null>(null);
  // La sesión se activó EN este flujo (verify/oauth ok): fuente de verdad
  // inmediata, porque `useAuth` puede seguir stale en el render siguiente.
  const sessionActivated = useRef(false);

  // Salto de paso SÓLO con herramientas internas encendidas. En producción el
  // param se ignora y el onboarding arranca normal: era un control de
  // desarrollo servido en público, igual que el viejo `?live=1`.
  const debugStep = resolveDebugStep({
    // `inspectStep` es la vista combinada de revisión (`/preview-alta`). Entra
    // por el MISMO camino que `debugStep`: pasa por `resolveDebugStep` —que ya
    // exige herramientas internas— y activa `inspeccion`, así que hereda tal
    // cual la regla de sólo lectura. No hay una segunda puerta que auditar.
    raw: inspectStep != null ? String(inspectStep) : params.debugStep,
    total: TOTAL,
    internalToolsEnabled: INTERNAL_TOOLS_ENABLED
  });
  /**
   * Inspección visual: SOLO LECTURA. Montar un paso por `debugStep` no puede
   * escribir nada — ni datos natales, ni perfil, ni carta, ni cuenta, ni
   * checkout, ni el submit final con su navegación.
   *
   * Motivo real: el paso 14 auto-ejecutaba `submit()` al montarse, así que
   * abrir `?debugStep=14` con sesión activa PERSISTÍA los valores por defecto
   * del flujo encima de los datos natales de la cuenta y recalculaba la carta.
   */
  const inspeccion = debugStep !== null;
  useEffect(() => {
    if (debugStep !== null) setStep(debugStep);
  }, [debugStep]);

  // Respaldo del resume: si los params llegan un render después del mount,
  // el useState inicial no los vio. Solo salta si todavía está en la entrada.
  useEffect(() => {
    if (params.resume === "datos") setStep((s) => (s === 0 ? STEP_BIRTHDATE : s));
  }, [params.resume]);

  // Cuenta con sesión y SIN datos natales que abre el alta: se continúa desde la
  // fecha, no desde la entrada. El arranque nativo ya lo hacía con
  // `resume=datos`, pero en web el gate redirige a `/empezar` SIN ese param, así
  // que una cuenta incompleta volvía al splash a mirar el tramo inmersivo otra
  // vez. El destino ya está resuelto cuando el flujo se monta: si hubiera datos
  // natales, el gate habría mandado a Home y esto no correría.
  //
  // Sólo desde la entrada: nunca pisa un paso ya avanzado ni un borrador, y por
  // eso tampoco afecta a quien acaba de crear su cuenta en el paso 13.
  const sesionActiva = !!auth?.isSignedIn || !!account?.isSignedIn;
  useEffect(() => {
    if (inspeccion || !sesionActiva) return;
    setStep((s) => (s === 0 ? STEP_BIRTHDATE : s));
  }, [sesionActiva, inspeccion]);



  useEffect(() => {
    // En inspección no se guarda: un salto arranca con los valores por defecto
    // y sobrescribiría el borrador real de la persona.
    if (inspeccion) return;
    writeDraft({ step, identity, birthDate, placeQuery, birthPlace, birthTime, timeUnknown, email });
  }, [step, identity, birthDate, placeQuery, birthPlace, birthTime, timeUnknown, email, inspeccion]);

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

  // Tríada real SIN login: al llegar a "Personalizing"(11) calculamos la carta con
  // el endpoint público, para que el preview muestre Luna/Ascendente reales aunque
  // el usuario no se haya logueado todavía. Requiere lugar (coords del geocoding).
  useEffect(() => {
    // Inspección: no se le pega a la API de cálculo.
    if (inspeccion) return;
    if (step < STEP_COMPUTE_TRIAD || !computeTriad || !birthPlace) return;
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
  }, [step, computeTriad, birthPlace, birthDateISO, timeUnknown, birthTime.hour, birthTime.minute, retryTick, inspeccion]);

  // `codeOverride`: la auto-verificación del CodeInput pasa el código recién
  // completado directo (el estado `accountCode` todavía no re-renderizó).
  const accountNext = async (codeOverride?: string) => {
    // Inspección: nunca se crea una cuenta ni se avanza.
    if (inspeccion) return;
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

  const accountOAuth = async (provider: "google") => {
    // Inspección: no se abre un flujo de OAuth ni se activa sesión.
    if (inspeccion) return;
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

  // Llegar al paso de cuenta con la sesión YA activa (volvió del alta web, o
  // entró por login y sigue el alta): no se pide una segunda cuenta.
  useEffect(() => {
    if (inspeccion) return;
    if (step === STEP_ACCOUNT && account?.isSignedIn) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, account?.isSignedIn, inspeccion]);

  const submit = async () => {
    // Inspección visual: ninguna escritura, ni siquiera desde un CTA.
    if (inspeccion) return;
    // Reentrada: el lock va PRIMERO y es sincrónico.
    if (submitLock.current) return;
    submitLock.current = true;
    const birthTimeValue = timeUnknown ? undefined : timeLabel;

    // NADA sale del dispositivo sin una cuenta confirmada.
    //
    // Hasta el paso de cuenta el alta vive entera en el borrador local: es lo
    // que permite que la experiencia inmersiva enganche antes de pedir nada.
    // El precio es que este cierre es el ÚNICO punto donde eso se vuelve un
    // dato remoto, y sólo puede hacerlo si hay un usuario Clerk activo. Sin él
    // se vuelve al paso de cuenta con el borrador intacto — jamás se escribe
    // "por si acaso" ni se pierde lo cargado.
    const cuentaActiva = sessionActivated.current || !!auth?.isSignedIn || !!account?.isSignedIn;
    if (persistBackend && !cuentaActiva) {
      submitLock.current = false;
      setStep(STEP_ACCOUNT);
      return;
    }

    // ÚNICA ruta de persistencia del onboarding, y se ESPERA. Antes había dos:
    // un efecto al montar el paso 14 (con `void`, sin manejo de error) y otra
    // acá, también con `void`. Ese efecto sin guarda persistía los valores por
    // defecto cuando se saltaba directo al paso 14, y el `void` hacía que un
    // fallo pasara desapercibido mientras el flujo navegaba a la recepción como
    // si todo hubiera salido bien.
    if (persistBackend) {
      setSubmitError(null);
      setSubmitting(true);
      try {
        await persistBackend({
          birthDate: birthDateISO,
          birthTime: birthTimeValue,
          birthPlaceLabel: birthPlace?.label,
          latitude: birthPlace?.latitude,
          longitude: birthPlace?.longitude,
          timezone: birthPlace?.timezone,
        });
      } catch (e) {
        // Nada de perfil local, nada de limpiar el borrador, nada de navegar: la
        // persona ve el error y puede reintentar sin perder lo cargado.
        setSubmitError(
          e instanceof BirthPayloadError
            ? birthPayloadMessage(e.problem)
            : "Tus datos siguen acá. Puede ser la conexión; probá de nuevo y la guardamos."
        );
        setSubmitting(false);
        submitLock.current = false;
        return;
      }
      setSubmitting(false);
    }

    // Con sesión activa (alta con cuenta, OAuth o resume=datos post-login) el
    // perfil queda marcado con su dueño: el próximo arranque lo reconoce como
    // propio en vez de mandarlo a reconciliar. Guest → sin dueño. Carrera
    // post-verify: si useAuth sigue stale (userId todavía no llegó), el
    // perfil se crea sin dueño con ADOPCIÓN PENDIENTE y se marca solo apenas
    // aparece el userId (resolveProfileOwnerAtCreation + AppState).
    const owner = resolveProfileOwnerAtCreation({
      // La sesión se activa DENTRO del flujo (paso de cuenta), así que
      // `useAuth` puede seguir stale en este render: el ref que setea
      // verify/oauth es la señal inmediata. Sin esto el perfil quedaba sin
      // dueño y el próximo arranque lo mandaba a reconciliar.
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
    // El onboarding terminó: el borrador ya no debe sobrevivir a la sesión.
    clearDraft();
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
    if (inspeccion) return;
    if (step === FINAL_STEP && !PAYWALL_ENABLED) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, inspeccion]);

  // Sesión ya activa (login previo o continuación del alta): el paso de crear
  // cuenta se saltea solo — nunca pedir crear/iniciar sesión de nuevo.
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
    case STEP_ACCOUNT:
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
    case FINAL_STEP:
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
      ) : submitError !== null ? (
        // La persistencia falló: se dice, con reintento, y NO se navega a la
        // recepción. Antes el fallo era invisible (`void persistBackend`) y la
        // persona entraba a una app sin carta guardada.
        <Screen bg={undefined}>
          <View style={styles.closeError}>
            <Title>No pudimos guardar tu carta.</Title>
            <Body>{submitError}</Body>
            <CTA label={submitting ? "Guardando…" : "Reintentar"} onPress={submit} />
          </View>
        </Screen>
      ) : (
        // Cierre en curso (o paywall apagado): estado de guardado estable, sin
        // flashear el pago. Era un `View` negro y vacío — con
        // `PAYWALL_ENABLED=false` el último paso del alta era una página en
        // blanco (negro) mientras se persistía la carta, sin ninguna señal de
        // que algo estuviera pasando.
        <SavingChart />
      );
      break;
  }

  return (
    // El provider va en la RAÍZ del alta: los quince pasos comparten un solo
    // modo responsive, igual que el shell de la app autenticada.
    <WebLayoutProvider width={inspectWidth}>
      <View className="dark" style={styles.fill}>
        <StatusBar style="light" />
        {screen}
      </View>
    </WebLayoutProvider>
  );
}

/**
 * Cierre del alta: se está guardando la carta.
 *
 * No cambia nada del envío ni del ruteo — sólo deja de ser una pantalla negra
 * vacía. Es el último paso antes de entrar a la app, así que tiene que decir
 * que está pasando algo y anunciarlo también a un lector de pantalla.
 */
function SavingChart() {
  const reduced = useReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;

  // El sello gira despacio mientras se guarda. Con "reducir movimiento" queda
  // quieto: la pieza sigue estando, sólo deja de moverse.
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Screen bg={A.accountBg} bgOpacity={0.4} wash={0.72}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Guardando tu carta"
        style={styles.saving}
      >
        {/* El orbe del alta, no un spinner sobre negro: el cierre es el momento
            en que la carta se guarda, y merece la misma pieza que el resto. */}
        <Animated.View style={[styles.savingSeal, !reduced && { transform: [{ rotate }] }]}>
          <Image source={A.heroEclipse} style={styles.savingSealImg} resizeMode="cover" />
        </Animated.View>
        <Body accessibilityLiveRegion="polite" style={styles.savingText}>
          Guardando tu carta…
        </Body>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { backgroundColor: orbita.bg, flex: 1 },
  closeError: { flex: 1, gap: 16, justifyContent: "center", paddingHorizontal: 24 },
  saving: { alignItems: "center", flex: 1, gap: 22, justifyContent: "center", paddingHorizontal: 24 },
  savingSeal: {
    borderColor: "rgba(214,154,106,0.45)",
    borderRadius: 74,
    borderWidth: 1,
    height: 148,
    overflow: "hidden",
    width: 148,
  },
  savingSealImg: { height: "100%", width: "100%" },
  savingText: { textAlign: "center" },
});
