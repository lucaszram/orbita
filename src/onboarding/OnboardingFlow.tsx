import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";

import { getZodiacSign, signLabels } from "@/domain/zodiac";
import type { Topic, ZodiacSign } from "@/domain/types";
import { useAppState } from "@/hooks/useAppState";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";

import { AccountScreen } from "./screens/AccountScreen";
import { AlignScreen } from "./screens/AlignScreen";
import { BaseChartScreen } from "./screens/BaseChartScreen";
import { BeforeAfterScreen } from "./screens/BeforeAfterScreen";
import { ChartPreviewScreen } from "./screens/ChartPreviewScreen";
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
import { useAccountFlow, useBackendPersist, useOnboardingChart, useOnboardingComputeTriad } from "./useAccount";
import type { OnboardingChart } from "./useAccount";

const TOTAL = 15;

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
  const params = useLocalSearchParams<{ debugStep?: string }>();

  const [step, setStep] = useState(0);
  const [identity, setIdentity] = useState<Identity>("ella");
  const [birthDate, setBirthDate] = useState<BirthDateParts>({ day: 15, month: 1, year: 1996 });
  const [placeQuery, setPlaceQuery] = useState("");
  const [birthPlace, setBirthPlace] = useState<PlaceOption | undefined>();
  const [birthTime, setBirthTime] = useState<BirthTime>({ hour: 12, minute: 0 });
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [email, setEmail] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [plan, setPlan] = useState<PlanId>("annual");
  const [previewSeen, setPreviewSeen] = useState(false);
  const account = useAccountFlow();
  const persistBackend = useBackendPersist();
  const chartPreview = useOnboardingChart();
  const computeTriad = useOnboardingComputeTriad();
  const [computed, setComputed] = useState<OnboardingChart | undefined>();
  const [retryTick, setRetryTick] = useState(0);
  const calcFired = useRef(false);
  const computedSig = useRef<string | null>(null);

  // Dev preview: jump to any step via ?debugStep=N.
  useEffect(() => {
    const n = Number(params.debugStep);
    if (Number.isFinite(n) && n >= 0 && n < TOTAL) setStep(n);
  }, [params.debugStep]);

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

  const accountNext = async () => {
    if (!account || account.isSignedIn) {
      next();
      return;
    }
    const trimmed = email.trim().toLowerCase();
    if (account.phase === "email") {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return;
      await account.start(trimmed);
      return;
    }
    const ok = await account.verify(accountCode.trim());
    if (ok) next();
  };

  const submit = async () => {
    const birthTimeValue = timeUnknown ? undefined : timeLabel;
    await createProfile({
      name: "Visitante",
      birthDate: birthDateISO,
      birthTime: birthTimeValue,
      birthPlace: birthPlace?.label,
      interests: DEFAULT_TOPICS,
      guidanceTone: "protectora",
      notificationTime: "09:00",
    });
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
    // Al salir del onboarding, la carta natal es lo primero (no la Home).
    router.replace("/(tabs)/carta");
  };

  if (!fontsLoaded) return <View style={styles.fill} />;

  let screen: ReactNode;
  switch (step) {
    case 0:
      screen = <SplashScreen onNext={next} />;
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
          code={accountCode}
          onCode={setAccountCode}
          account={account}
          onNext={accountNext}
          onSkip={next}
          onBack={back}
        />
      );
      break;
    case 14:
    default:
      // Paso 14 = preview de la carta (real, cortada) → paywall. Mismo índice de
      // progreso; el CTA del preview revela el paywall (no suma un paso numerado).
      screen = previewSeen ? (
        <PaywallScreen plan={plan} onPlan={setPlan} onUnlock={submit} onBack={() => setPreviewSeen(false)} />
      ) : (
        <ChartPreviewScreen
          step={14}
          total={TOTAL}
          sunFallback={signLabel}
          chart={computed ?? chartPreview}
          timeKnown={!timeUnknown}
          onRetry={() => {
            computedSig.current = null;
            setComputed(undefined);
            setRetryTick((t) => t + 1);
          }}
          onNext={() => setPreviewSeen(true)}
          onBack={back}
        />
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
