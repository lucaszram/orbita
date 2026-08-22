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
import { BirthPayloadError, birthPayloadMessage } from "@/domain/birthPayload";
import { clearDraft, ensureClientDraftId, readDraft, writeDraft } from "@/domain/onboardingDraft";
import { resolveDebugStep } from "@/domain/onboardingDebug";
import { RECEPTION_ROUTE } from "@/domain/appRoutes";
import { isBirthDataReady } from "@/domain/onboardingReadiness";
import { INTERNAL_TOOLS_ENABLED } from "@/services/internalTools";

import { A } from "./assets";
import { CTA } from "./components/CTA";
import { Screen } from "./components/Screen";
import { Body } from "./components/Type";
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
import { orbita } from "./theme";
import {
  describeTriadError,
  useOnboardingBirthDataPersist,
  useOnboardingChart,
  useOnboardingCompletion,
  useOnboardingComputeTriad
} from "./useAccount";
import type { OnboardingChart, TriadStatus } from "./useAccount";

// El flujo ya no contiene portada ni alta de cuenta: la cuenta se crea ANTES de
// entrar acá y este archivo es sólo la carga de datos natales. Empieza en
// AlignScreen (paso 0) y termina en el cierre (paso 12). Los índices se nombran
// a propósito: el camino de escritura depende de ellos y un renumerado
// silencioso ya costó datos.
const TOTAL = 13;
/** Primer paso que ya puede calcular la tríada real (necesita lugar). */
const STEP_COMPUTE_TRIAD = 10;
/** Último paso: cierra el onboarding (paywall si estuviera activo). */
const FINAL_STEP = 12;
/** Primer paso del flujo normal. */
const ENTRY_STEP = 0;

// La web pública no monta una portada propia: la landing de `/` YA es la
// entrada, así que "volver" desde el primer paso regresa ahí en vez de bajar a
// un paso que no existe. El nativo se queda en su primer paso.
const IS_WEB = process.env.EXPO_OS === "web";

// Paso donde arranca la carga de datos de nacimiento (continuación del alta
// post-login para una cuenta sin birthData: `/onboarding?resume=datos`).
const STEP_BIRTHDATE = 3;

// Paywall temporalmente DESACTIVADO (2-3 semanas, mientras refinamos el onboarding
// y el flujo). Con `false`, al terminar el onboarding se entra DIRECTO a la app sin
// pasar por el paso de pago (step 12). Para reactivar: PAYWALL_ENABLED = true.
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
  }>();

  // `resume=datos`: sesión activa sin datos de nacimiento → continuar el alta
  // desde la fecha, sin repetir el tramo inmersivo.
  // Borrador de sesión: en web cualquier remonte de `/empezar` (una vuelta de
  // Clerk, un refresh) borraba todo lo cargado. El param explícito (`resume`)
  // manda sobre el borrador: es una intención del usuario. En nativo `readDraft`
  // devuelve null (no hay sessionStorage) y nada cambia.
  const saved = useMemo(() => readDraft(TOTAL), []);

  const [step, setStep] = useState(() =>
    params.resume === "datos" ? STEP_BIRTHDATE : saved?.step ?? ENTRY_STEP
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
  const [plan, setPlan] = useState<PlanId>("annual");
  // Identidad LOCAL de este alta. Ya no adjunta ninguna fila anónima a una
  // cuenta recién creada —la cuenta existe antes de entrar acá—: se conserva
  // porque el cálculo público de la tríada le cobra a ese id su cupo de
  // reintentos, y porque viaja con el borrador local para sobrevivir un remonte.
  const clientDraftId = useMemo(() => (inspectStep != null ? null : ensureClientDraftId()), [inspectStep]);
  const persistBirthData = useOnboardingBirthDataPersist();
  // Autoridad ÚNICA de acceso: ni `isSignedIn` ni el retorno de la escritura.
  const completion = useOnboardingCompletion();
  const chartPreview = useOnboardingChart();
  const computeTriad = useOnboardingComputeTriad();
  const [computed, setComputed] = useState<OnboardingChart | undefined>();
  // Estado del cálculo de la tríada. "unavailable" = sin backend o sin lugar:
  // el alta sigue como siempre. "error" NO pasa en silencio: la pantalla de
  // personalización muestra recuperación (reintentar / continuar sin ella).
  const [triadStatus, setTriadStatus] = useState<TriadStatus>("idle");
  const [triadError, setTriadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  // Persistencia del cierre: sin esto un fallo navegaba a la recepción
  // como si el alta hubiera funcionado.
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /**
   * El cierre LOCAL falló con los datos remotos ya guardados (QA23-008).
   *
   * Se separa de `submitError` porque no es lo mismo y la salida tampoco: el
   * guardado remoto ya está hecho e idempotente, y lo que falló es la copia
   * local del perfil o la navegación. Reintentar tiene que volver a INTENTAR
   * ENTRAR, no a reescribir lo que ya está en la cuenta.
   */
  const [entryFailed, setEntryFailed] = useState(false);
  // Lock SINCRÓNICO. `submitting` es estado de React: recién se refleja en el
  // próximo render, así que dos taps en el mismo render pasaban los dos. El ref
  // se toma en la primera línea; sólo se libera al fallar (en el éxito ya
  // navegamos fuera del flujo).
  const submitLock = useRef(false);
  // La salida corre UNA sola vez: la query de readiness es reactiva y su
  // confirmación puede volver a emitirse mientras la navegación está en vuelo.
  const enterLock = useRef(false);
  const computedSig = useRef<string | null>(null);

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
   * Motivo real: el paso 12 auto-ejecutaba `submit()` al montarse, así que
   * abrir `?debugStep=12` con sesión activa PERSISTÍA los valores por defecto
   * del flujo encima de los datos natales de la cuenta y recalculaba la carta.
   */
  const inspeccion = debugStep !== null;
  useEffect(() => {
    if (debugStep !== null) setStep(debugStep);
  }, [debugStep]);

  // Respaldo del resume: si los params llegan un render después del mount,
  // el useState inicial no los vio. Solo salta si todavía está en la entrada.
  //
  // Este es el ÚNICO salto a la carga de datos, y es explícito: lo pide
  // `resume=datos`. Antes había además un salto automático "si hay sesión", pero
  // en auth-first la sesión SIEMPRE existe cuando el flujo se monta, así que ese
  // efecto se disparaba en todas las altas y dejaba Align, Identify y
  // DailyGuidance inalcanzables. Sin sesión no se entra acá; con sesión, el
  // tramo inmersivo se ve igual salvo que se pida continuar.
  useEffect(() => {
    if (params.resume === "datos") setStep((s) => (s === ENTRY_STEP ? STEP_BIRTHDATE : s));
  }, [params.resume]);

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
      // El id del alta viaja con el borrador local: un remonte no puede
      // cambiarlo sin gastar de nuevo el cupo de reintentos de la tríada.
      clientDraftId: clientDraftId ?? undefined
    });
  }, [step, identity, birthDate, placeQuery, birthPlace, birthTime, timeUnknown, clientDraftId, inspeccion]);

  const next = () => setStep((s) => Math.min(TOTAL - 1, s + 1));
  const back = () => {
    // En web, "volver" desde el primer paso devuelve a la landing (`/`), que es
    // la portada real: no hay un paso anterior al que bajar. En inspección no:
    // `debugStep` tiene el paso fijado y no navega fuera.
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

  // Tríada real SIN login: al llegar a "Personalizing"(10) calculamos la carta con
  // la acción pública `publicOnboarding.computeTriad`, para que el preview muestre
  // Luna/Ascendente reales aunque el usuario no se haya logueado todavía. Requiere
  // lugar (coords del geocoding; la zona la deriva el backend de esas coordenadas).
  useEffect(() => {
    // Inspección: no se le pega a la API de cálculo.
    if (inspeccion) return;
    if (step < STEP_COMPUTE_TRIAD) return;
    // El usuario ya decidió seguir sin la tríada: no se vuelve a intentar solo.
    if (triadStatus === "skipped") return;
    // Sin borrador no hay a qué cobrarle el cupo de reintentos: el endpoint lo
    // exige. Sólo pasa en inspección, que ya salió arriba.
    if (!computeTriad || !birthPlace || !clientDraftId) {
      setTriadStatus("unavailable");
      return;
    }
    const birthTimeStr = timeUnknown ? undefined : to24hFromParts(birthTime);
    // Firma de los datos: si cambia (el usuario editó fecha/hora/lugar) recalcula;
    // si es la misma, no vuelve a pegarle a la API. Antes un ref "fired" dejaba
    // pegada la tríada de una persona anterior.
    const sig = `${birthDateISO}|${birthTimeStr ?? "?"}|${birthPlace.label}`;
    if (computedSig.current === sig) return;
    computedSig.current = sig;
    let cancelled = false;
    let settled = false;
    setTriadStatus("loading");
    setTriadError(null);
    computeTriad({
      birthDate: birthDateISO,
      birthTime: birthTimeStr,
      birthTimePrecision: timeUnknown ? "unknown" : "known",
      birthPlaceLabel: birthPlace.label,
      latitude: birthPlace.latitude,
      longitude: birthPlace.longitude,
      clientDraftId,
    })
      .then((r) => {
        settled = true;
        if (cancelled) return;
        setComputed(r);
        setTriadStatus("ready");
      })
      .catch((e) => {
        settled = true;
        if (cancelled) return;
        // Se limpia la firma para que el reintento vuelva a disparar el cálculo.
        computedSig.current = null;
        setTriadError(describeTriadError(e));
        setTriadStatus("error");
      });
    // Si el cálculo quedó a mitad de camino (el usuario volvió atrás), se olvida
    // la firma: al volver al paso se dispara de nuevo en vez de quedar esperando
    // para siempre una respuesta que ya se descartó.
    return () => {
      cancelled = true;
      if (!settled) computedSig.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, computeTriad, birthPlace, birthDateISO, timeUnknown, birthTime.hour, birthTime.minute, retryTick, inspeccion, clientDraftId]);

  const retryTriad = () => {
    computedSig.current = null;
    setComputed(undefined);
    setTriadError(null);
    setTriadStatus("loading");
    setRetryTick((t) => t + 1);
  };

  /**
   * Salida del alta: perfil local + recepción. La llama `enterApp`, que es
   * quien pone el candado —una sola vez— y quien atiende su fallo. Con backend
   * configurado sólo corre después de que el estado autoritativo diga datos
   * natales persistidos. La carta es un derivado reintentable y no participa de
   * esta puerta.
   */
  const abrirOrbita = async () => {
    const birthTimeValue = timeUnknown ? undefined : timeLabel;
    // El perfil local queda marcado con su dueño: el próximo arranque lo
    // reconoce como propio en vez de mandarlo a reconciliar. La sesión es la
    // única fuente de verdad —el alta ya entra autenticada—, y si `useAuth`
    // todavía no publicó el userId el perfil se crea con ADOPCIÓN PENDIENTE y
    // se marca solo apenas aparece (resolveProfileOwnerAtCreation + AppState).
    const owner = resolveProfileOwnerAtCreation({
      sessionActive: !!auth?.isSignedIn,
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
    // Destino determinista: la ceremonia de recepción (`/recepcion`,
    // full-screen, una sola vez), que es la primera entrega del día 1. Desde
    // ahí se decide con el entitlement autoritativo si la salida es la carta o
    // la paywall; "VER DESPUÉS" deja a la persona en Home. La tríada calculada
    // viaja por params para no depender de que Convex ya haya persistido la
    // carta: sigue siendo un derivado reintentable y no participa de la puerta.
    router.replace({
      pathname: RECEPTION_ROUTE,
      params: {
        ...(computed?.sun ? { sol: computed.sun } : {}),
        ...(computed?.moon ? { luna: computed.moon } : {}),
        ...(computed?.ascendant ? { asc: computed.ascendant } : {}),
      },
    } as never);
  };

  /**
   * La salida, con su candado y con una salida cuando ELLA falla (QA23-008).
   *
   * `abrirOrbita` escribe en AsyncStorage y navega, o sea que puede rechazar
   * DESPUÉS de que el alta remota ya cerró. Con el candado tomado para siempre
   * y sin `submitError`, la pantalla quedaba en «Guardando tus datos…» sin un
   * solo control: la única salida era matar la app (y recién ahí el arranque
   * reconciliaba contra Convex). Ahora el candado se suelta, se dice qué pasó
   * —los datos están guardados; lo que falló es este teléfono— y se ofrece
   * volver a entrar. El guardado NO se repite: ya está hecho.
   */
  const enterApp = async () => {
    if (enterLock.current) return;
    enterLock.current = true;
    setEntryFailed(false);
    try {
      await abrirOrbita();
    } catch {
      enterLock.current = false;
      setEntryFailed(true);
    }
  };

  const submit = async () => {
    // Inspección visual: ninguna escritura, ni siquiera desde un CTA.
    if (inspeccion) return;
    // Reentrada: el lock va PRIMERO y es sincrónico.
    if (submitLock.current) return;
    submitLock.current = true;

    // NADA sale del dispositivo sin una sesión confirmada.
    //
    // El alta es auth-first: la cuenta ya existe cuando este flujo se monta y
    // acá no se crea ninguna. Si aun así la sesión no está lista (token en
    // vuelo, restauración a medias), no se escribe ni se navega: se dice qué
    // falta y el borrador local queda intacto para reintentar. Jamás se escribe
    // "por si acaso" ni se pierde lo cargado.
    if (persistBirthData && !auth?.isSignedIn) {
      submitLock.current = false;
      setSubmitError(
        "Necesitamos confirmar tu sesión antes de guardar tus datos. Tus datos siguen acá; probá de nuevo en un momento."
      );
      return;
    }

    // Sin backend configurado (builds locales) no hay nada remoto que esperar.
    if (!persistBirthData) {
      await enterApp();
      return;
    }

    // Escritura idempotente contra la cuenta ya activa. NO navega: quien
    // autoriza entrar es `getCompletionStatus`, y su confirmación llega por la
    // query reactiva.
    setSubmitError(null);
    setSubmitting(true);
    try {
      await persistBirthData({
        birthDate: birthDateISO,
        birthTime: timeUnknown ? undefined : to24hFromParts(birthTime),
        birthPlaceLabel: birthPlace?.label,
        latitude: birthPlace?.latitude,
        longitude: birthPlace?.longitude,
        timezone: birthPlace?.timezone
      });
    } catch (e) {
      // Nada de perfil local, nada de limpiar el borrador, nada de navegar: la
      // persona ve el error y puede reintentar sin perder lo cargado. Un dato
      // natal que falta se nombra por su motivo —la salida es volver un paso y
      // completarlo— en vez de culpar a la conexión.
      setSubmitError(
        e instanceof BirthPayloadError
          ? birthPayloadMessage(e.problem)
          : "Tus datos siguen acá. No pudimos sincronizarlos todavía; revisá la conexión y probá de nuevo."
      );
      setSubmitting(false);
      submitLock.current = false;
      return;
    }
    setSubmitting(false);
  };

  // Sin paywall: al llegar al paso de pago (step 12) se entra directo a la app.
  useEffect(() => {
    if (inspeccion) return;
    if (step === FINAL_STEP && !PAYWALL_ENABLED) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, inspeccion]);

  // La puerta de salida exige sesión y datos natales PERSISTIDOS. Una carta en
  // `chart_pending` ya no retiene a la persona en el alta. Sin backend
  // configurado no hay estado autoritativo que esperar: ahí la entrada la hace
  // `submit` con el cierre local.
  useEffect(() => {
    if (inspeccion || !persistBirthData) return;
    if (step !== FINAL_STEP) return;
    if (!isBirthDataReady(completion)) return;
    void enterApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, completion, persistBirthData, inspeccion]);

  if (!fontsLoaded) return <View style={styles.fill} />;

  let screen: ReactNode;
  switch (step) {
    case 0:
      screen = <AlignScreen onNext={next} onBack={back} />;
      break;
    case 1:
      screen = (
        <IdentifyScreen step={step} identity={identity} onSelect={setIdentity} onNext={next} onBack={back} />
      );
      break;
    case 2:
      screen = <DailyGuidanceScreen step={step} onNext={next} onBack={back} />;
      break;
    case 3:
      screen = (
        <BirthdateScreen step={step} value={birthDate} onChange={setBirthDate} onNext={next} onBack={back} />
      );
      break;
    case 4:
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
    case 5:
      screen = (
        <BirthplaceSearchScreen
          step={step}
          query={placeQuery}
          onQuery={setPlaceQuery}
          onSelect={(p) => {
            setBirthPlace(p);
            setStep(6);
          }}
          onBack={back}
        />
      );
      break;
    case 6:
      screen = (
        <BirthplaceSelectedScreen
          step={step}
          place={birthPlace?.label ?? "Buenos Aires, Argentina"}
          onNext={next}
          onBack={back}
        />
      );
      break;
    case 7:
      screen = (
        <BirthTimeScreen
          step={step}
          value={birthTime}
          onChange={setBirthTime}
          unknown={timeUnknown}
          onToggleUnknown={() => setTimeUnknown((v) => !v)}
          onNext={() => setStep(timeUnknown ? 9 : 8)}
          onBack={back}
        />
      );
      break;
    case 8:
      screen = <BirthTimeSelectedScreen step={step} timeLabel={timeLabel} onNext={next} onBack={back} />;
      break;
    case 9:
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
    case 10:
      screen = (
        <PersonalizingScreen
          step={step}
          onDone={next}
          onBack={back}
          triadStatus={inspeccion ? "unavailable" : triadStatus}
          triadError={triadError}
          onRetryTriad={retryTriad}
          onContinueWithoutTriad={() => setTriadStatus("skipped")}
        />
      );
      break;
    case 11:
      screen = <BeforeAfterScreen step={step} onNext={next} onBack={back} />;
      break;
    case FINAL_STEP:
    default:
      // Paso 12 = paywall único. La tríada real va arriba como gancho (antes era
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
          onRetry={retryTriad}
        />
      ) : (
        // Un solo estado de guardado. Un fallo real de persistencia conserva el
        // borrador y ofrece recuperación inline; no existe una página terminal
        // de error de carta.
        //
        // Los dos fallos posibles se dicen distinto porque la salida es distinta
        // (QA23-008): si no se pudo GUARDAR, el reintento vuelve a guardar; si
        // se guardó y no se pudo ABRIR la app, el reintento vuelve a entrar —
        // repetir el guardado ahí sería pedir de nuevo algo que ya está hecho.
        <SavingBirthData
          error={
            entryFailed
              ? "Tus datos quedaron guardados en tu cuenta, pero no pudimos abrir Órbita en este teléfono. Probá de nuevo."
              : submitError
          }
          errorLabel={entryFailed ? "No pudimos abrir Órbita" : undefined}
          retryLabel={entryFailed ? "Entrar a Órbita" : undefined}
          retrying={submitting}
          onRetry={entryFailed ? () => void enterApp() : submit}
        />
      );
      break;
  }

  return (
    // El provider va en la RAÍZ del alta: los trece pasos comparten un solo
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
  onRetry,
  /**
   * Qué anuncia el lector de pantalla y qué dice el botón cuando hay error.
   *
   * Opcionales con el valor de siempre por defecto: el cierre tiene dos fallos
   * distintos —no se pudo guardar, o se guardó y no se pudo abrir la app— y
   * anunciar el segundo como «no pudimos sincronizar tus datos» sería decir que
   * se perdió algo que está guardado (QA23-008).
   */
  errorLabel = "No pudimos sincronizar tus datos",
  retryLabel = "Reintentar guardado"
}: {
  error: string | null;
  retrying: boolean;
  onRetry: () => void;
  errorLabel?: string;
  retryLabel?: string;
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
        accessibilityLabel={error ? errorLabel : "Guardando tus datos"}
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
            <CTA label={retrying ? "Guardando…" : retryLabel} onPress={onRetry} disabled={retrying} />
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
