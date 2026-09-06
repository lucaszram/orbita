import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";

import { resolveProfileOwnerAtCreation } from "@/domain/sessionStart";
import { getZodiacSign, signLabels } from "@/domain/zodiac";
import type { Topic } from "@/domain/types";
import { useAppState } from "@/hooks/useAppState";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { WebLayoutProvider } from "@/components/web/web-layout-provider";
import { backendConfig } from "@/services/backendProviders";
import { markFirstRun } from "@/services/firstRun";
import {
  clearDraft,
  draftUsableBy,
  ensureClientDraftId,
  persistClientDraftId,
  readDraft,
  writeDraft
} from "@/domain/onboardingDraft";
import { resolveDebugStep } from "@/domain/onboardingDebug";
import { BirthPayloadError, birthPayloadMessage } from "@/domain/birthPayload";
import { CARTA_TAB_ROUTE, EDIT_BIRTH_DATA_ROUTE, HOME_ROUTE } from "@/domain/appRoutes";
import { INTERNAL_TOOLS_ENABLED } from "@/services/internalTools";

import { resolveAuthStepExit } from "./authExit";
import { completionDraftIdFor } from "./authGate";
import { MONTHS } from "./months";
import { observeTriadComputation, triadAutoAdvances } from "./triadSurface";
import { AlignScreen } from "./screens/AlignScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { BeforeAfterScreen } from "./screens/BeforeAfterScreen";
import { type BirthDateParts, BirthdateScreen } from "./screens/BirthdateScreen";
import { BirthplaceSearchScreen, type PlaceOption } from "./screens/BirthplaceSearchScreen";
import { BirthSummaryScreen } from "./screens/BirthSummaryScreen";
import { type BirthTime, BirthTimeScreen } from "./screens/BirthTimeScreen";
import { DailyGuidanceScreen } from "./screens/DailyGuidanceScreen";
import { type Identity, IdentifyScreen } from "./screens/IdentifyScreen";
import { OnboardingPaywallScreen } from "./screens/OnboardingPaywallScreen";
import { TriadScreen } from "./screens/TriadScreen";
import {
  ONBOARDING_TOTAL,
  STEP_AUTH,
  STEP_BEFORE_AFTER,
  STEP_BIRTHDATE,
  STEP_BIRTHPLACE,
  STEP_BIRTHTIME,
  STEP_GUIDANCE,
  STEP_IDENTITY,
  STEP_PAYWALL,
  STEP_PROMISE,
  STEP_SUMMARY,
  STEP_TRIAD
} from "./steps";
import { orbita } from "./theme";
import {
  useAccountFlow,
  useAnonymousSignupMarker,
  useOnboardingBirthDataSave,
  useOnboardingCompletion,
  useOnboardingComputeTriad,
  useSignInFlow
} from "./useAccount";
import type { OnboardingChart, TriadStatus } from "./useAccount";

// Flujo canónico aprobado (auth primero → Carta). Los índices viven en
// `./steps` y se nombran a propósito: el camino de escritura depende de ellos
// y un renumerado silencioso ya costó datos.
const TOTAL = ONBOARDING_TOTAL;

// Con backend, la PRIMERA superficie es crear cuenta o ingresar. Sin backend
// (builds locales) no hay Clerk que montar: el flujo local arranca en la
// promesa y termina igual en la Carta.
const HAS_BACKEND = backendConfig.hasConvex && backendConfig.hasClerk;
const ENTRY_STEP = HAS_BACKEND ? STEP_AUTH : STEP_PROMISE;

const IS_WEB = Platform.OS === "web";

const DEFAULT_TOPICS: Topic[] = ["claridad", "energia"];

const DEFAULT_IDENTITY: Identity = "ella";
const DEFAULT_BIRTH_DATE: BirthDateParts = { day: 15, month: 1, year: 1996 };
const DEFAULT_BIRTH_TIME: BirthTime = { hour: 12, minute: 0 };

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

  // Borrador de sesión (web): sobrevive la vuelta de Clerk y las recargas de la
  // pestaña. En nativo `readDraft` devuelve null y nada cambia.
  const saved = useMemo(() => readDraft(TOTAL), []);

  // `resume=datos`: sesión activa sin datos de nacimiento → continuar el alta
  // desde la fecha, sin repetir el acceso ni el tramo inmersivo.
  const [step, setStep] = useState(() =>
    params.resume === "datos" ? STEP_BIRTHDATE : ENTRY_STEP
  );
  const [identity, setIdentity] = useState<Identity>((saved?.identity as Identity) ?? DEFAULT_IDENTITY);
  const [birthDate, setBirthDate] = useState<BirthDateParts>(saved?.birthDate ?? DEFAULT_BIRTH_DATE);
  const [placeQuery, setPlaceQuery] = useState(saved?.placeQuery ?? "");
  const [birthPlace, setBirthPlace] = useState<PlaceOption | undefined>(
    saved?.birthPlace as PlaceOption | undefined
  );
  const [birthTime, setBirthTime] = useState<BirthTime>(saved?.birthTime ?? DEFAULT_BIRTH_TIME);
  const [timeUnknown, setTimeUnknown] = useState(saved?.timeUnknown ?? false);
  // Email tipeado en el login y traído por "Crear una cuenta" (`?email=`): sólo
  // PRELLENA el campo del acceso. Nunca se escribe ni se valida acá.
  const [email] = useState(() =>
    typeof params.email === "string" && params.email ? params.email : saved?.email ?? ""
  );

  const signUpFlow = useAccountFlow();
  const signInFlow = useSignInFlow();
  // Identidad del borrador REMOTO de este alta: el marcador de "alta en curso"
  // y el cupo del cálculo público de la tríada viajan con este id opaco.
  const clientDraftId = useMemo(() => (inspectStep != null ? null : ensureClientDraftId()), [inspectStep]);
  const markSignup = useAnonymousSignupMarker();
  const saveBirthData = useOnboardingBirthDataSave();
  /**
   * El marcador de alta nueva se DESCARTA cuando la persona entra por el
   * camino de ingreso — el modo "Ingresar", o el alta que cayó a sign-in
   * porque el email ya tenía cuenta—: con el marcador vigente, una cuenta
   * preexistente incompleta se reclasificaba como alta nueva en vez de ir a su
   * recuperación (`/editar-datos`). Sembrar de nuevo (modo alta) lo repone.
   */
  const [markerDiscarded, setMarkerDiscarded] = useState(false);
  // Autoridad ÚNICA post-acceso: ni `isSignedIn` ni el retorno de las escrituras.
  const completion = useOnboardingCompletion(completionDraftIdFor({ markerDiscarded, clientDraftId }));
  const computeTriad = useOnboardingComputeTriad();

  const [computed, setComputed] = useState<OnboardingChart | undefined>();
  const [triadStatus, setTriadStatus] = useState<TriadStatus>("idle");
  const computedSig = useRef<string | null>(null);

  // Persistencia del resumen ("Preparar mi carta").
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveLock = useRef(false);

  /**
   * La salida a Carta falló con los datos remotos ya guardados (QA23-008):
   * lo que falló es la copia local del perfil o la navegación. Reintentar
   * vuelve a ENTRAR, nunca a reescribir lo que ya está en la cuenta.
   */
  const [entryFailed, setEntryFailed] = useState(false);
  const enterLock = useRef(false);

  // Salto de paso SÓLO con herramientas internas encendidas (sólo lectura).
  const debugStep = resolveDebugStep({
    // `inspectStep` (la vista combinada `/preview-alta`) entra por el MISMO
    // camino que `debugStep` y hereda tal cual la regla de sólo lectura.
    raw: inspectStep != null ? String(inspectStep) : params.debugStep,
    total: TOTAL,
    internalToolsEnabled: INTERNAL_TOOLS_ENABLED
  });
  /**
   * Inspección visual: SOLO LECTURA. Montar un paso por `debugStep` no puede
   * escribir nada — ni datos natales, ni perfil, ni carta, ni cuenta, ni
   * compra, ni la salida con su navegación.
   */
  const inspeccion = debugStep !== null;
  useEffect(() => {
    if (debugStep !== null) setStep(debugStep);
  }, [debugStep]);

  // Respaldo del resume: si los params llegan un render después del mount,
  // el useState inicial no los vio. Solo salta si todavía está en la entrada.
  useEffect(() => {
    if (params.resume === "datos") setStep((s) => (s === STEP_AUTH ? STEP_BIRTHDATE : s));
  }, [params.resume]);

  const sesionActiva = !!auth?.isSignedIn || !!signUpFlow?.isSignedIn || !!signInFlow?.isSignedIn;
  const userId = auth?.userId ?? null;

  /** Aislamiento: ninguna cuenta hereda el borrador (ni los datos) de otra. */
  const resetNatalState = () => {
    setIdentity(DEFAULT_IDENTITY);
    setBirthDate(DEFAULT_BIRTH_DATE);
    setPlaceQuery("");
    setBirthPlace(undefined);
    setBirthTime(DEFAULT_BIRTH_TIME);
    setTimeUnknown(false);
    setComputed(undefined);
    setTriadStatus("idle");
    computedSig.current = null;
    clearDraft();
  };

  /** Entra por el camino de ingreso: el marcador de alta nueva se descarta. */
  const discardSignupMarker = () => {
    setMarkerDiscarded(true);
    clearDraft();
  };

  // El alta cayó a sign-in (el email ya tenía cuenta): mismo descarte, aunque
  // el cambio de rama lo haya decidido Clerk y no la persona.
  const signupFellToSignIn = !!signUpFlow?.existingAccount;
  useEffect(() => {
    if (inspeccion) return;
    if (signupFellToSignIn) discardSignupMarker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signupFellToSignIn, inspeccion]);

  /**
   * Aislamiento del borrador en CUALQUIER paso: apenas se conoce la identidad
   * de la sesión, un borrador que no sea de esa cuenta se descarta entero. El
   * caso real es `resume=datos` en una pestaña donde otra cuenta dejó su
   * borrador: sin esto, la cuenta nueva heredaba fecha, lugar y hora ajenos.
   */
  const ownershipChecked = useRef(false);
  useEffect(() => {
    if (inspeccion || !saved) return;
    if (ownershipChecked.current) return;
    if (!userId) return; // sin identidad todavía: el paso de acceso decide
    ownershipChecked.current = true;
    if (!draftUsableBy(saved, userId)) resetNatalState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, inspeccion]);

  /**
   * Salida del paso de acceso: la decide el estado AUTORITATIVO, con la regla
   * pura `resolveAuthStepExit` (cuenta completa → Home; preexistente
   * incompleta → editor natal; alta en curso → continúa el flujo). El borrador
   * local sólo se adopta si es de ESTA cuenta; uno ajeno se descarta entero
   * antes de avanzar.
   */
  useEffect(() => {
    if (inspeccion || !HAS_BACKEND) return;
    if (step !== STEP_AUTH) return;
    const exit = resolveAuthStepExit({
      sessionActive: sesionActiva,
      completion,
      usableDraftStep: saved && draftUsableBy(saved, userId) ? saved.step : null,
      resumeDatos: params.resume === "datos"
    });
    if (exit.kind === "wait") return;
    if (exit.kind === "home") {
      clearDraft();
      router.replace(HOME_ROUTE as never);
      return;
    }
    if (exit.kind === "edit-birth-data") {
      clearDraft();
      router.replace(EDIT_BIRTH_DATA_ROUTE as never);
      return;
    }
    if (saved && !draftUsableBy(saved, userId)) resetNatalState();
    setStep(exit.step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, sesionActiva, completion, inspeccion, userId]);

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
      clientDraftId: clientDraftId ?? undefined,
      // El dueño viaja con el borrador: es lo que impide que otra cuenta en la
      // misma pestaña herede fecha, lugar u hora.
      ownerUserId: userId ?? undefined
    });
  }, [step, identity, birthDate, placeQuery, birthPlace, birthTime, timeUnknown, email, clientDraftId, userId, inspeccion]);

  const canComputeTriad = Boolean(computeTriad && birthPlace && clientDraftId);

  const next = () => setStep((s) => Math.min(TOTAL - 1, s + 1));
  const back = () => {
    // En web el acceso ES la entrada del alta: "volver" devuelve a la landing.
    if (IS_WEB && !inspeccion && step <= ENTRY_STEP) {
      router.replace("/");
      return;
    }
    setStep((s) => {
      // Antes/Después vuelve al resumen cuando la tríada no tiene nada que
      // mostrar: sin superficie disponible, o con un estado que avanza solo
      // (timed_out/error) — volver ahí sería rebotar hacia adelante.
      if (s === STEP_BEFORE_AFTER && (!canComputeTriad || triadAutoAdvances(triadStatus))) {
        return STEP_SUMMARY;
      }
      // Con sesión activa no se vuelve al acceso: la promesa es el piso.
      const floor = HAS_BACKEND && !sesionActiva ? STEP_AUTH : STEP_PROMISE;
      return Math.max(floor, s - 1);
    });
  };

  const birthDateISO = useMemo(
    () =>
      `${birthDate.year}-${String(birthDate.month).padStart(2, "0")}-${String(birthDate.day).padStart(2, "0")}`,
    [birthDate]
  );
  const sign = useMemo(() => getZodiacSign(birthDateISO), [birthDateISO]);
  const signLabel = signLabels[sign];
  const dateLabel = `${birthDate.day} de ${MONTHS[birthDate.month - 1].toLowerCase()} de ${birthDate.year}`;
  const timeLabel = timeUnknown
    ? "Sin hora"
    : `${String(birthTime.hour).padStart(2, "0")}:${String(birthTime.minute).padStart(2, "0")}`;
  const placeShort = birthPlace?.label.split(",")[0] ?? "";

  /** Cambiar fecha, lugar u hora invalida la tríada anterior. */
  const invalidateTriad = () => {
    computedSig.current = null;
    setComputed(undefined);
    setTriadStatus("idle");
  };

  const editDate = (v: BirthDateParts) => {
    setBirthDate((prev) => {
      if (prev.day !== v.day || prev.month !== v.month || prev.year !== v.year) invalidateTriad();
      return v;
    });
  };
  const editPlace = (p: PlaceOption) => {
    setBirthPlace((prev) => {
      if (prev?.label !== p.label) invalidateTriad();
      return p;
    });
  };
  const editTime = (v: BirthTime, unknown: boolean) => {
    setBirthTime((prev) => {
      if (prev.hour !== v.hour || prev.minute !== v.minute) invalidateTriad();
      return v;
    });
    setTimeUnknown((prev) => {
      if (prev !== unknown) invalidateTriad();
      return unknown;
    });
  };

  /**
   * "Preparar mi carta": PERSISTE los datos natales antes de iniciar la
   * generación completa. El cálculo derivado de la carta corre en segundo plano
   * y no bloquea ni el guardado ni la navegación; la superficie de tríada es la
   * única espera visible, y nunca retiene el onboarding.
   */
  const prepararCarta = async () => {
    if (inspeccion) return;
    if (saveLock.current) return;
    saveLock.current = true;
    setSaveError(null);

    // Sin backend configurado (builds locales) no hay nada remoto que guardar.
    if (!saveBirthData) {
      saveLock.current = false;
      setStep(canComputeTriad ? STEP_TRIAD : STEP_BEFORE_AFTER);
      return;
    }

    setSaving(true);
    try {
      await saveBirthData({
        birthDate: birthDateISO,
        birthTime: timeUnknown ? undefined : to24hFromParts(birthTime),
        birthPlaceLabel: birthPlace?.label,
        latitude: birthPlace?.latitude,
        longitude: birthPlace?.longitude,
        timezone: birthPlace?.timezone,
        clientDraftId: clientDraftId ?? undefined
      });
    } catch (e) {
      setSaveError(
        e instanceof BirthPayloadError
          ? birthPayloadMessage(e.problem)
          : e instanceof Error && /ONBOARDING_SESSION_NOT_READY/.test(e.message)
            ? "Tu sesión todavía se está confirmando. Esperá un momento y probá de nuevo."
            : "Tus datos siguen acá. No pudimos guardarlos todavía; revisá la conexión y probá de nuevo."
      );
      setSaving(false);
      saveLock.current = false;
      return;
    }
    setSaving(false);
    saveLock.current = false;
    setStep(canComputeTriad ? STEP_TRIAD : STEP_BEFORE_AFTER);
  };

  /**
   * Única superficie de cálculo (`publicOnboarding.computeTriad`, sin contrato
   * nuevo). La orquestación vive en `observeTriadComputation` (pura, testeada):
   * si la respuesta llega antes del techo visible, la superficie se transforma
   * en "Tu carta ya está lista"; al cumplirse el techo —o ante un error— el
   * estado pasa a `timed_out`/`error` y el efecto de abajo AVANZA solo. El
   * resultado tardío del cálculo público se descarta; lo que aprovecha Carta
   * es la carta PERSISTIDA que `Preparar mi carta` ya disparó en el servidor.
   */
  useEffect(() => {
    if (inspeccion) return;
    if (step !== STEP_TRIAD) return;
    if (!computeTriad || !birthPlace || !clientDraftId) return;
    const birthTimeStr = timeUnknown ? undefined : to24hFromParts(birthTime);
    // Firma de los datos: si cambia (la persona editó fecha/hora/lugar en el
    // resumen) recalcula; si es la misma, no vuelve a pegarle a la API.
    const sig = `${birthDateISO}|${birthTimeStr ?? "?"}|${birthPlace.label}`;
    if (computedSig.current === sig) return;
    computedSig.current = sig;
    setComputed(undefined);
    setTriadStatus("loading");
    let settled = false;
    const cancel = observeTriadComputation({
      computation: computeTriad({
        birthDate: birthDateISO,
        birthTime: birthTimeStr,
        birthTimePrecision: timeUnknown ? "unknown" : "known",
        birthPlaceLabel: birthPlace.label,
        latitude: birthPlace.latitude,
        longitude: birthPlace.longitude,
        clientDraftId
      }),
      onReady: (r) => {
        settled = true;
        setComputed(r);
        setTriadStatus("ready");
      },
      onTimedOut: () => {
        settled = true;
        setTriadStatus("timed_out");
      },
      onError: () => {
        settled = true;
        computedSig.current = null;
        setTriadStatus("error");
      }
    });
    // Si la persona vuelve atrás con el cálculo en vuelo, se olvida la firma:
    // al volver al paso se dispara de nuevo en vez de quedar esperando.
    return () => {
      cancel();
      if (!settled) computedSig.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, computeTriad, birthPlace, birthDateISO, timeUnknown, birthTime.hour, birthTime.minute, inspeccion, clientDraftId]);

  /**
   * Techo visible cumplido o error del proveedor: se AVANZA solo a
   * Antes/Después, sin exigir interacción y sin una pantalla técnica. La regla
   * es pura (`triadAutoAdvances`) y está probada conductualmente.
   */
  useEffect(() => {
    if (inspeccion) return;
    if (step !== STEP_TRIAD) return;
    if (!triadAutoAdvances(triadStatus)) return;
    setStep(STEP_BEFORE_AFTER);
  }, [step, triadStatus, inspeccion]);

  /**
   * Salida ÚNICA del onboarding: la Carta de la última pestaña.
   *
   * Guarda la copia local del perfil con su dueño, marca la primera vez (la
   * ceremonia de recepción ya no corre: `/recepcion` queda sólo por
   * compatibilidad) y entra a `CARTA_TAB_ROUTE`. Ningún camino nuevo termina
   * en `/recepcion` ni agrega una pantalla post-paywall.
   */
  const enterCarta = async () => {
    if (inspeccion) return;
    if (enterLock.current) return;
    enterLock.current = true;
    setEntryFailed(false);
    try {
      const owner = resolveProfileOwnerAtCreation({
        sessionActive: sesionActiva,
        knownUserId: userId
      });
      await createProfile(
        {
          name: "Visitante",
          birthDate: birthDateISO,
          birthTime: timeUnknown ? undefined : timeLabel,
          birthPlace: birthPlace?.label,
          interests: DEFAULT_TOPICS,
          guidanceTone: "protectora",
          notificationTime: "09:00"
        },
        owner.ownerUserId,
        owner.adoptWhenReady
      );
      clearDraft();
      await markFirstRun({ recepcionVista: true }).catch(() => undefined);
      router.replace(CARTA_TAB_ROUTE as never);
    } catch {
      enterLock.current = false;
      setEntryFailed(true);
    }
  };

  if (!fontsLoaded) return <View style={styles.fill} />;

  let screen: ReactNode;
  switch (step) {
    case STEP_AUTH:
      // La cuenta es la PRIMERA superficie: crear cuenta e ingresar son modos
      // de esta misma pantalla, con Apple/Google/email vía Clerk oficial.
      screen = (
        <AuthScreen
          signUp={signUpFlow}
          signIn={signInFlow}
          initialEmail={email || undefined}
          entering={!inspeccion && sesionActiva}
          onBeforeSignup={
            inspeccion || !clientDraftId || !markSignup
              ? undefined
              : async () => {
                  // El id sobrevive al redirect de Clerk (sessionStorage) y el
                  // marcador remoto clasifica la cuenta nueva como alta en
                  // curso. Si el marcador no se guarda, esto RECHAZA y la
                  // pantalla no abre Clerk. Volver al modo alta repone un
                  // marcador antes descartado.
                  setMarkerDiscarded(false);
                  persistClientDraftId(clientDraftId);
                  await markSignup(clientDraftId);
                }
          }
          onSignInPath={inspeccion ? undefined : discardSignupMarker}
          onBack={IS_WEB && !inspeccion ? () => router.replace("/") : undefined}
        />
      );
      break;
    case STEP_PROMISE:
      screen = (
        <AlignScreen
          step={step}
          onNext={next}
          onBack={HAS_BACKEND && sesionActiva ? undefined : back}
        />
      );
      break;
    case STEP_IDENTITY:
      screen = (
        <IdentifyScreen step={step} identity={identity} onSelect={setIdentity} onNext={next} onBack={back} />
      );
      break;
    case STEP_GUIDANCE:
      screen = <DailyGuidanceScreen step={step} onNext={next} onBack={back} />;
      break;
    case STEP_BIRTHDATE:
      screen = (
        <BirthdateScreen step={step} value={birthDate} onChange={editDate} onNext={next} onBack={back} />
      );
      break;
    case STEP_BIRTHPLACE:
      screen = (
        <BirthplaceSearchScreen
          step={step}
          query={placeQuery}
          onQuery={setPlaceQuery}
          onSelect={(p) => {
            editPlace(p);
            setStep(STEP_BIRTHTIME);
          }}
          onBack={back}
        />
      );
      break;
    case STEP_BIRTHTIME:
      screen = (
        <BirthTimeScreen
          step={step}
          value={birthTime}
          onChange={(v) => editTime(v, timeUnknown)}
          unknown={timeUnknown}
          onToggleUnknown={() => editTime(birthTime, !timeUnknown)}
          onNext={next}
          onBack={back}
        />
      );
      break;
    case STEP_SUMMARY:
      // El ÚNICO resumen: sin pantallas independientes de confirmación para
      // fecha, lugar u hora — cada fila abre su selector sobre esta pantalla.
      screen = (
        <BirthSummaryScreen
          step={step}
          dateValue={birthDate}
          onDate={editDate}
          timeValue={birthTime}
          timeUnknown={timeUnknown}
          onTime={editTime}
          place={birthPlace}
          onPlace={editPlace}
          sunSign={signLabel}
          dateLabel={dateLabel}
          timeLabel={timeLabel}
          placeLabel={placeShort || "Elegí tu ciudad"}
          saving={saving}
          saveError={saveError}
          onPrepare={() => void prepararCarta()}
          onBack={back}
        />
      );
      break;
    case STEP_TRIAD:
      screen = (
        <TriadScreen
          step={step}
          status={inspeccion ? "loading" : triadStatus}
          chart={computed}
          timeKnown={!timeUnknown}
          onContinue={next}
          onBack={back}
        />
      );
      break;
    case STEP_BEFORE_AFTER:
      screen = <BeforeAfterScreen step={step} onNext={next} onBack={back} />;
      break;
    case STEP_PAYWALL:
    default:
      // Paywall aprobada con el comercio REAL de cada plataforma (RevenueCat
      // en nativo; Stripe en web — Metro resuelve la variante `.web`). No hay
      // pantalla post-paywall: compra, restauración y "Seguir gratis" mantienen
      // la paywall visible hasta `router.replace(CARTA_TAB_ROUTE)`, y cancelar
      // una compra permanece acá sin error. Una superficie que no puede cobrar
      // conserva igual el camino aprobado de "Seguir gratis".
      screen = (
        <OnboardingPaywallScreen
          onEnterCarta={() => void enterCarta()}
          onBack={back}
          entryFailed={entryFailed}
          inspect={inspeccion}
        />
      );
      break;
  }

  return (
    // El provider va en la RAÍZ del alta: todos los pasos comparten un solo
    // modo responsive, igual que el shell de la app autenticada.
    <WebLayoutProvider width={inspectWidth}>
      <View className="dark" style={styles.fill}>
        <StatusBar style="light" />
        {screen}
      </View>
    </WebLayoutProvider>
  );
}

const styles = StyleSheet.create({
  fill: { backgroundColor: orbita.bg, flex: 1 }
});
