import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Platform, StyleSheet, View } from "react-native";
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
import { clearDraft, ensureClientDraftId, readDraft, writeDraft } from "@/domain/onboardingDraft";
import { resolveDebugStep } from "@/domain/onboardingDebug";
import { HOME_ROUTE } from "@/domain/appRoutes";
import { isBirthDataReady } from "@/domain/onboardingReadiness";
import { INTERNAL_TOOLS_ENABLED } from "@/services/internalTools";

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
import { orbita } from "./theme";
import {
  useAccountFlow,
  useOnboardingChart,
  useOnboardingCompletion,
  useOnboardingComputeTriad,
  useOnboardingFinalize,
  useOnboardingSignupDraft
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

// La web pública NO monta la portada nativa (SplashScreen: video de intro +
// "Órbita · Tu cielo, todos los días"): la landing de `/` YA es la portada, y
// repetirla dejaba dos portadas seguidas. El alta web arranca DIRECTO en
// AlignScreen (paso 1, CTA "Empezar el viaje") y "volver" desde ahí regresa a
// `/`. El nativo conserva su paso 0 tal cual. `debugStep=0` sigue montando la
// portada, pero sólo por el camino de inspección interna (sólo lectura).
const IS_WEB = Platform.OS === "web";
/** Primer paso del flujo normal por plataforma. */
const ENTRY_STEP = IS_WEB ? 1 : 0;
/** Un borrador web guardado en el paso 0 (versión anterior) se normaliza al 1. */
const normalizeEntryStep = (s: number) => (IS_WEB && s === 0 ? ENTRY_STEP : s);

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

/**
 * La identidad de la UI usa guiones y el contrato Convex usa guiones bajos
 * (`v.literal("prefiero_no_decirlo")`). La traducción vive acá, en el borde de
 * escritura: mandarla tal cual la rechazaba el validador y el borrador remoto
 * nunca llegaba a guardarse.
 */
const IDENTITY_TO_BACKEND: Record<Identity, "ella" | "el" | "prefiero_no_decirlo"> = {
  ella: "ella",
  el: "el",
  "prefiero-no-decirlo": "prefiero_no_decirlo",
};

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
    params.resume === "datos" ? STEP_BIRTHDATE : normalizeEntryStep(saved?.step ?? ENTRY_STEP)
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
  // Email tipeado en el login y traído por "Crear una cuenta" (`?email=`). El
  // alta ya no tiene campo de email propio —lo pide la UI oficial de Clerk—:
  // sólo viaja al paso 13 como PRELLENADO y se conserva en el borrador para no
  // perderlo en la vuelta. Nunca se escribe ni se valida acá.
  const [email] = useState(() =>
    typeof params.email === "string" && params.email ? params.email : saved?.email ?? ""
  );
  const [plan, setPlan] = useState<PlanId>("annual");
  const account = useAccountFlow();
  // Identidad del borrador REMOTO de este alta. Se genera una sola vez y
  // sobrevive a la vuelta de Clerk: es lo que permite adjuntar a la cuenta
  // recién creada el borrador guardado anónimo (`flowOrigin: anonymous_signup`).
  const clientDraftId = useMemo(() => (inspectStep != null ? null : ensureClientDraftId()), [inspectStep]);
  const prepareSignupDraft = useOnboardingSignupDraft();
  const finalizeOnboarding = useOnboardingFinalize();
  // Autoridad ÚNICA de acceso: ni `isSignedIn` ni el retorno de las escrituras.
  const completion = useOnboardingCompletion(clientDraftId ?? undefined);
  const [draftPhase, setDraftPhase] = useState<"preparing" | "error" | "ready">("preparing");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftTick, setDraftTick] = useState(0);
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
  // La salida corre UNA sola vez: la query de readiness es reactiva y su
  // confirmación puede volver a emitirse mientras la navegación está en vuelo.
  const enterLock = useRef(false);
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
    if (params.resume === "datos") setStep((s) => (s === ENTRY_STEP ? STEP_BIRTHDATE : s));
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
    setStep((s) => (s === ENTRY_STEP ? STEP_BIRTHDATE : s));
  }, [sesionActiva, inspeccion]);



  useEffect(() => {
    // En inspección no se guarda: un salto arranca con los valores por defecto
    // y sobrescribiría el borrador real de la persona.
    if (inspeccion) return;
    writeDraft({
      step,
      identity,
      birthDate,
      placeQuery,
      birthPlace,
      birthTime,
      timeUnknown,
      email,
      // El id del borrador remoto viaja con el borrador local: es lo único que
      // permite reencontrar la fila anónima después de que Clerk remonte.
      clientDraftId: clientDraftId ?? undefined
    });
  }, [step, identity, birthDate, placeQuery, birthPlace, birthTime, timeUnknown, email, clientDraftId, inspeccion]);

  const next = () => setStep((s) => Math.min(TOTAL - 1, s + 1));
  const back = () => {
    // En web el paso 1 ES la entrada del alta: "volver" no baja al paso 0 (la
    // portada nativa, que la web no monta) sino que devuelve a la landing. En
    // inspección no: `debugStep` tiene el paso fijado y no navega fuera.
    if (IS_WEB && !inspeccion && step <= ENTRY_STEP) {
      router.replace("/");
      return;
    }
    setStep((s) => Math.max(ENTRY_STEP, s - 1));
  };

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

  // ANTES de abrir Clerk: el borrador del alta tiene que estar guardado y
  // CONFIRMADO en el backend, con su `flowOrigin: "anonymous_signup"`. Crear
  // primero la identidad y escribir después es lo que dejaba cuentas sin datos
  // que ninguna pantalla sabía recuperar.
  //
  // `confirmSignupDraft` exige contexto anónimo, así que esto corre sólo
  // mientras no hay sesión; con la sesión ya activa el paso se saltea entero.
  useEffect(() => {
    if (inspeccion) return;
    if (step !== STEP_ACCOUNT) return;
    if (!prepareSignupDraft || !clientDraftId) {
      // Sin backend configurado el alta es local: no hay borrador remoto que
      // confirmar y Clerk tampoco se monta.
      setDraftPhase("ready");
      return;
    }
    if (sesionActiva) return;
    let cancelled = false;
    setDraftPhase("preparing");
    setDraftError(null);
    prepareSignupDraft({
      clientDraftId,
      currentStep: STEP_ACCOUNT,
      identity: IDENTITY_TO_BACKEND[identity],
      birthDate: birthDateISO,
      birthTime: timeUnknown ? undefined : to24hFromParts(birthTime),
      birthTimePrecision: timeUnknown ? "unknown" : "known",
      birthPlaceLabel: birthPlace?.label,
      latitude: birthPlace?.latitude,
      longitude: birthPlace?.longitude,
      timezone: birthPlace?.timezone
    })
      .then(() => {
        if (!cancelled) setDraftPhase("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setDraftPhase("error");
        setDraftError(
          "Tus datos siguen acá. No pudimos guardarlos todavía; probá de nuevo antes de crear la cuenta."
        );
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, clientDraftId, prepareSignupDraft, sesionActiva, draftTick, inspeccion]);

  // La UI oficial de Clerk activa la sesión por su cuenta: cuando eso pasa, el
  // alta avanza al cierre. No hay callback propio ni segunda cuenta.
  useEffect(() => {
    if (inspeccion) return;
    if (step !== STEP_ACCOUNT || !sesionActiva) return;
    sessionActivated.current = true;
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, sesionActiva, inspeccion]);

  /**
   * Salida del alta: perfil local + Home. Se llama UNA sola vez, y con
   * backend configurado SÓLO después de que el estado autoritativo diga
   * datos natales persistidos. La carta es un derivado reintentable y no
   * participa de esta puerta.
   */
  const enterApp = async () => {
    if (enterLock.current) return;
    enterLock.current = true;
    const birthTimeValue = timeUnknown ? undefined : timeLabel;
    // Con sesión activa el perfil queda marcado con su dueño: el próximo
    // arranque lo reconoce como propio en vez de mandarlo a reconciliar.
    // Carrera post-verify: si useAuth sigue stale (userId todavía no llegó), el
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
    // El onboarding terminó: el borrador ya no debe sobrevivir a la sesión.
    clearDraft();
    // Destino determinista: Home siempre. La carta se intenta en segundo plano
    // y, si todavía falta, se reintenta al abrir su propia superficie.
    router.replace(HOME_ROUTE as never);
  };

  const submit = async () => {
    // Inspección visual: ninguna escritura, ni siquiera desde un CTA.
    if (inspeccion) return;
    // Reentrada: el lock va PRIMERO y es sincrónico.
    if (submitLock.current) return;
    submitLock.current = true;

    // NADA sale del dispositivo sin una cuenta confirmada.
    //
    // Hasta el paso de cuenta el alta vive entera en el borrador local: es lo
    // que permite que la experiencia inmersiva enganche antes de pedir nada.
    // El precio es que este cierre es el ÚNICO punto donde eso se vuelve un
    // dato remoto, y sólo puede hacerlo si hay un usuario Clerk activo. Sin él
    // se vuelve al paso de cuenta con el borrador intacto — jamás se escribe
    // "por si acaso" ni se pierde lo cargado.
    const cuentaActiva = sessionActivated.current || !!auth?.isSignedIn || !!account?.isSignedIn;
    if (finalizeOnboarding && !cuentaActiva) {
      submitLock.current = false;
      setStep(STEP_ACCOUNT);
      return;
    }

    // Sin backend configurado (builds locales) no hay nada remoto que esperar.
    if (!finalizeOnboarding) {
      await enterApp();
      return;
    }

    // Escritura idempotente y atómica desde el borrador remoto confirmado. NO
    // navega: quien autoriza entrar es `getCompletionStatus`, y su confirmación
    // llega por la query reactiva.
    setSubmitError(null);
    setSubmitting(true);
    try {
      if (!clientDraftId) throw new Error("ONBOARDING_DRAFT_ID_MISSING");
      await finalizeOnboarding({ clientDraftId });
    } catch {
      // Nada de perfil local, nada de limpiar el borrador, nada de navegar: la
      // persona ve el error y puede reintentar sin perder lo cargado.
      setSubmitError("Tus datos siguen acá. No pudimos sincronizarlos todavía; revisá la conexión y probá de nuevo.");
      setSubmitting(false);
      submitLock.current = false;
      return;
    }
    setSubmitting(false);
  };

  // Sin paywall: al llegar al paso de pago (step 14) se entra directo a la app.
  useEffect(() => {
    if (inspeccion) return;
    if (step === FINAL_STEP && !PAYWALL_ENABLED) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, inspeccion]);

  // La puerta de salida exige cuenta y datos natales PERSISTIDOS. Una carta en
  // `chart_pending` ya no retiene a la persona en el alta.
  useEffect(() => {
    if (inspeccion || !finalizeOnboarding) return;
    if (step !== FINAL_STEP) return;
    if (!isBirthDataReady(completion)) return;
    void enterApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, completion, finalizeOnboarding, inspeccion]);

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
      // La cuenta se crea con la UI OFICIAL de Clerk. La pantalla sólo aporta
      // el escenario y la puerta: Clerk no se monta hasta que el borrador del
      // alta está guardado y confirmado en el backend.
      screen = (
        <AccountScreen
          step={step}
          phase={draftPhase}
          error={draftError}
          email={email}
          onRetry={() => setDraftTick((t) => t + 1)}
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
      ) : (
        // Un solo estado de guardado. Un fallo real de persistencia conserva el
        // borrador y ofrece recuperación inline; no existe una página terminal
        // de error de carta.
        <SavingBirthData
          error={submitError}
          retrying={submitting}
          onRetry={submit}
        />
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
 * Cierre del alta: se están guardando los datos natales.
 *
 * No cambia nada del envío ni del ruteo — sólo deja de ser una pantalla negra
 * vacía. Es el último paso antes de entrar a la app, así que tiene que decir
 * que está pasando algo y anunciarlo también a un lector de pantalla.
 */
function SavingBirthData({
  error,
  retrying,
  onRetry
}: {
  error: string | null;
  retrying: boolean;
  onRetry: () => void;
}) {
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
        accessibilityLabel={error ? "No pudimos sincronizar tus datos" : "Guardando tus datos"}
        style={styles.saving}
      >
        {/* El orbe del alta, no un spinner sobre negro: el cierre confirma los
            datos natales y merece la misma pieza que el resto. */}
        <Animated.View style={[styles.savingSeal, !reduced && { transform: [{ rotate }] }]}>
          <Image source={A.heroEclipse} style={styles.savingSealImg} resizeMode="cover" />
        </Animated.View>
        {error ? (
          <>
            <Body accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.savingText}>
              {error}
            </Body>
            <CTA label={retrying ? "Guardando…" : "Reintentar guardado"} onPress={onRetry} disabled={retrying} />
          </>
        ) : (
          <Body accessibilityLiveRegion="polite" style={styles.savingText}>
            Guardando tus datos…
          </Body>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { backgroundColor: orbita.bg, flex: 1 },
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
