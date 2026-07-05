import { ComponentProps, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Alert,
  Image,
  ImageBackground,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_400Regular, Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Topic } from "@/domain/types";
import { formatSign, getZodiacSign } from "@/domain/zodiac";
import { useAppState } from "@/hooks/useAppState";
import { Avatar, AvatarFallback, AvatarImage, Badge, Button, PlanOption, RadioGroup, SelectableRow, TextField, ToggleRow } from "@/components/ui";

const SCREEN_COUNT = 15;
const FIGMA_CANVAS_WIDTH = 393;
const FIGMA_CANVAS_HEIGHT = 852;

function canUseLocalDebugStep() {
  if (process.env.EXPO_OS !== "web" || typeof window === "undefined") {
    return false;
  }

  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

const orbitaColors = {
  warmBg: "#F7F5EF",
  ink: "#111111",
  charcoal: "#0D0E12",
  charcoal2: "#14161D",
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F1E7DA",
  line: "#D8D3C8",
  muted: "#8E8A82"
};

const onboardingAssets = {
  dailyTextureB: require("../assets/orbita/optimized/onboarding-v44/daily_texture_b.jpg"),
  birthChartDiagram: require("../assets/orbita/optimized/onboarding-v44/birth_chart_diagram.jpg"),
  logoOrbe: require("../assets/orbita/optimized/onboarding-v44/logo_orbe_idx08.jpg"),
  sunEmblem: require("../assets/orbita/optimized/onboarding-v44/sun_emblem_idx25.jpg"),
  ascendantHorizon: require("../assets/orbita/optimized/onboarding-v44/ascendant_horizon_idx27.jpg"),
  orbitalChart: require("../assets/orbita/optimized/onboarding-v44/orbital_chart_idx15.jpg"),
  transits: require("../assets/orbita/optimized/onboarding-v44/transits_idx30.jpg"),
  backplate: require("../assets/orbita/optimized/onboarding-v44/backplate_idx34.jpg"),
  figmaBg01: require("../assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_01_background__152-2.png"),
  figmaBg02: require("../assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_02_background__152-4.png"),
  figmaBg03: require("../assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_03_background__152-6.png"),
  figmaBg04: require("../assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_04_background__152-8.png"),
  figmaBg08: require("../assets/orbita/optimized/onboarding-v44/figma_bg_08.jpg"),
  figmaBg11: require("../assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_11_chart_image__152-22.png"),
  figmaBg12: require("../assets/orbita/optimized/onboarding-v44/figma_bg_12.jpg"),
  figmaBg13: require("../assets/orbita/optimized/onboarding-v44/figma_bg_13.jpg"),
  benefitLunar: require("../assets/orbita/optimized/onboarding-v44/benefit_lunar_idx68.jpg"),
  benefitGuide: require("../assets/orbita/optimized/onboarding-v44/benefit_guide_idx27.jpg"),
  benefitPractice: require("../assets/orbita/optimized/onboarding-v44/benefit_practice_idx38.jpg"),
  benefitDecisions: require("../assets/orbita/optimized/onboarding-v44/benefit_decisions_idx13.jpg"),
  identifyBg21: require("../assets/orbita/optimized/onboarding-v44/identify_bg_idx21.jpg"),
  identifyBg27: require("../assets/orbita/optimized/onboarding-v44/identify_bg_idx27.jpg"),
  dailyBase: require("../assets/orbita/optimized/onboarding-v44/daily_base_idx20.jpg"),
  dailyBaseAlt: require("../assets/orbita/optimized/onboarding-v44/daily_base_idx21.jpg"),
  dailyBackplate61: require("../assets/orbita/optimized/onboarding-v44/daily_backplate_idx61.jpg"),
  dailyBackplate: require("../assets/orbita/optimized/onboarding-v44/daily_backplate_idx66.jpg"),
  dailyBackplateFigma: require("../assets/orbita/optimized/onboarding-v44/daily_backplate_idx65.jpg"),
  birthData34: require("../assets/orbita/optimized/onboarding-v44/birth_data_idx34.jpg"),
  birthData40: require("../assets/orbita/optimized/onboarding-v44/birth_data_idx40.jpg"),
  birthData77: require("../assets/orbita/optimized/onboarding-v44/birth_data_idx77.jpg"),
  birthData83: require("../assets/orbita/optimized/onboarding-v44/birth_data_idx83.jpg"),
  baseChart46: require("../assets/orbita/optimized/onboarding-v44/base_chart_idx46.jpg"),
  baseChart47: require("../assets/orbita/optimized/onboarding-v44/base_chart_idx47.jpg"),
  personalizing51: require("../assets/orbita/optimized/onboarding-v44/personalizing_idx51.jpg"),
  personalizing55: require("../assets/orbita/optimized/onboarding-v44/personalizing_idx55.jpg"),
  beforeAfter53: require("../assets/orbita/optimized/onboarding-v44/before_after_idx53.jpg"),
  beforeAfter81: require("../assets/orbita/optimized/onboarding-v44/before_after_idx81.jpg"),
  accountSeal58: require("../assets/orbita/optimized/onboarding-v44/account_seal_idx58.jpg"),
  accountSeal59: require("../assets/orbita/optimized/onboarding-v44/account_seal_idx59.jpg"),
  paymentAlt69: require("../assets/orbita/optimized/onboarding-v44/payment_idx69.jpg"),
  paymentBg: require("../assets/orbita/optimized/onboarding-v44/payment_idx62.jpg")
};

type Identity = "ella" | "el" | "prefiero_no_decirlo";
type Period = "AM" | "PM";
type PlanId = "weekly" | "annual";

type BirthDateParts = {
  day?: number;
  month?: number;
  year?: number;
};

type BirthPlace = {
  label: string;
  city: string;
  country: string;
};

type BirthTime = {
  hour: number;
  minute: number;
  period: Period;
};

type ScreenTone = "dark" | "light";

const identityOptions: Array<{ value: Identity; label: string }> = [
  { value: "ella", label: "Ella" },
  { value: "el", label: "Él" },
  { value: "prefiero_no_decirlo", label: "Prefiero no decirlo" }
];

const birthPlaceOptions: BirthPlace[] = [
  { label: "Buenos Aires, Argentina", city: "Buenos Aires", country: "Argentina" },
  { label: "Buenos Aires Province, Argentina", city: "Buenos Aires Province", country: "Argentina" },
  { label: "Buenos Aires, Costa Rica", city: "Buenos Aires", country: "Costa Rica" }
];

const months = [
  { value: 1, short: "Ene", long: "enero" },
  { value: 2, short: "Feb", long: "febrero" },
  { value: 3, short: "Mar", long: "marzo" },
  { value: 4, short: "Abr", long: "abril" },
  { value: 5, short: "May", long: "mayo" },
  { value: 6, short: "Jun", long: "junio" },
  { value: 7, short: "Jul", long: "julio" },
  { value: 8, short: "Ago", long: "agosto" },
  { value: 9, short: "Sep", long: "septiembre" },
  { value: 10, short: "Oct", long: "octubre" },
  { value: 11, short: "Nov", long: "noviembre" },
  { value: 12, short: "Dic", long: "diciembre" }
];

const elementBySign: Record<string, string> = {
  aries: "Fuego",
  leo: "Fuego",
  sagitario: "Fuego",
  tauro: "Tierra",
  virgo: "Tierra",
  capricornio: "Tierra",
  geminis: "Aire",
  libra: "Aire",
  acuario: "Aire",
  cancer: "Agua",
  escorpio: "Agua",
  piscis: "Agua"
};

const defaultTopics: Topic[] = ["claridad", "energia"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function wrap(value: number, min: number, max: number) {
  const range = max - min + 1;
  return ((((value - min) % range) + range) % range) + min;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function monthName(month?: number, variant: "short" | "long" = "long") {
  const match = months.find((item) => item.value === month);
  return match ? match[variant] : "";
}

function getMaxDay(month?: number, year?: number) {
  if (!month || !year) {
    return 31;
  }

  return new Date(year, month, 0).getDate();
}

function isBirthDateComplete(date: BirthDateParts) {
  if (!date.day || !date.month || !date.year) {
    return false;
  }

  const maxDay = getMaxDay(date.month, date.year);
  return date.year >= 1900 && date.year <= 2026 && date.month >= 1 && date.month <= 12 && date.day >= 1 && date.day <= maxDay;
}

function toISODate(date: BirthDateParts) {
  if (!isBirthDateComplete(date)) {
    return "";
  }

  return `${date.year}-${pad2(date.month ?? 1)}-${pad2(date.day ?? 1)}`;
}

function formatLongDate(date: BirthDateParts) {
  if (!isBirthDateComplete(date)) {
    return "Elegí día, mes y año";
  }

  return `${date.day} de ${monthName(date.month)} de ${date.year}`;
}

function formatShortDate(date: BirthDateParts) {
  if (!isBirthDateComplete(date)) {
    return "Sin fecha";
  }

  return `${date.day} ${monthName(date.month, "short")} ${date.year}`;
}

function formatBirthTime(time: BirthTime) {
  return `${pad2(time.hour)}:${pad2(time.minute)} ${time.period}`;
}

function toNativeBirthDate(date: BirthDateParts) {
  return new Date(date.year ?? 1996, (date.month ?? 1) - 1, date.day ?? 15);
}

function fromNativeBirthDate(date: Date): BirthDateParts {
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear()
  };
}

function toNativeBirthTime(time: BirthTime) {
  const normalizedHour = time.period === "PM" ? (time.hour % 12) + 12 : time.hour % 12;
  return new Date(2000, 0, 1, normalizedHour, time.minute, 0, 0);
}

function fromNativeBirthTime(date: Date): BirthTime {
  const hours = date.getHours();
  const period: Period = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;

  return {
    hour,
    minute: date.getMinutes(),
    period
  };
}

export default function OnboardingScreen() {
  const { createProfile } = useAppState();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Newsreader_400Regular,
    Newsreader_500Medium
  });
  const params = useLocalSearchParams<{ debugStep?: string }>();
  const debugStep = typeof params.debugStep === "string" ? Number(params.debugStep) : undefined;
  const [step, setStep] = useState(0);
  const [identity, setIdentity] = useState<Identity | undefined>("ella");
  const [birthDate, setBirthDate] = useState<BirthDateParts>({ day: 15, month: 1, year: 1996 });
  const [birthPlaceSearch, setBirthPlaceSearch] = useState("");
  const [birthPlace, setBirthPlace] = useState<BirthPlace | undefined>();
  const [birthTime, setBirthTime] = useState<BirthTime>({ hour: 8, minute: 30, period: "AM" });
  const [birthTimeUnknown, setBirthTimeUnknown] = useState(false);
  const [email, setEmail] = useState("mica@email.com");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("annual");
  const [chartProgress, setChartProgress] = useState(0);

  const birthDateISO = toISODate(birthDate);
  const zodiacSign = useMemo(() => (birthDateISO ? getZodiacSign(birthDateISO) : "capricornio"), [birthDateISO]);
  const zodiacLabel = formatSign(zodiacSign);
  const elementLabel = elementBySign[zodiacSign] ?? "Tierra";
  const timeLabel = birthTimeUnknown ? "Hora aproximada" : formatBirthTime(birthTime);
  const canMoveForward = canAdvance(step, {
    identity,
    birthDate,
    birthPlace,
    chartProgress
  });

  useEffect(() => {
    if ((!__DEV__ && !canUseLocalDebugStep()) || debugStep === undefined || Number.isNaN(debugStep)) {
      return;
    }

    setStep(clamp(Math.trunc(debugStep), 0, SCREEN_COUNT - 1));
  }, [debugStep]);

  useEffect(() => {
    if (step !== 11) {
      return;
    }

    setChartProgress(59);
  }, [step]);

  useEffect(() => {
    if (step !== 11 || chartProgress < 59 || debugStep !== undefined) {
      return;
    }

    const timer = setTimeout(() => {
      setStep(12);
    }, 900);

    return () => clearTimeout(timer);
  }, [chartProgress, debugStep, step]);

  function updateBirthDate(part: keyof BirthDateParts, delta: number) {
    setBirthDate((current) => {
      if (part === "year") {
        const nextYear = clamp((current.year ?? 1996) + delta, 1900, 2026);
        const maxDay = getMaxDay(current.month, nextYear);
        return { ...current, year: nextYear, day: current.day ? clamp(current.day, 1, maxDay) : current.day };
      }

      if (part === "month") {
        const nextMonth = wrap((current.month ?? 1) + delta, 1, 12);
        const maxDay = getMaxDay(nextMonth, current.year);
        return { ...current, month: nextMonth, day: current.day ? clamp(current.day, 1, maxDay) : current.day };
      }

      const maxDay = getMaxDay(current.month, current.year);
      return { ...current, day: wrap((current.day ?? 15) + delta, 1, maxDay) };
    });
  }

  function updateBirthDateFromNative(date: Date) {
    setBirthDate(fromNativeBirthDate(date));
  }

  function updateBirthTime(part: keyof BirthTime, delta: number) {
    setBirthTimeUnknown(false);
    setBirthTime((current) => {
      if (part === "hour") {
        return { ...current, hour: wrap(current.hour + delta, 1, 12) };
      }

      if (part === "minute") {
        return { ...current, minute: wrap(current.minute + delta, 0, 59) };
      }

      return { ...current, period: current.period === "AM" ? "PM" : "AM" };
    });
  }

  function updateBirthTimeFromNative(date: Date) {
    setBirthTimeUnknown(false);
    setBirthTime(fromNativeBirthTime(date));
  }

  function next() {
    if (!canMoveForward) {
      showStepAlert(step);
      return;
    }

    setStep((current) => Math.min(SCREEN_COUNT - 1, current + 1));
  }

  function back() {
    setStep((current) => Math.max(0, current - 1));
  }

  async function submit() {
    if (!isBirthDateComplete(birthDate)) {
      Alert.alert("Falta la fecha", "Necesitamos tu fecha de nacimiento para abrir la app.");
      setStep(4);
      return;
    }

    await createProfile({
      name: "Visitante",
      birthDate: birthDateISO,
      birthTime: birthTimeUnknown ? undefined : formatBirthTime(birthTime),
      birthPlace: birthPlace?.label,
      interests: defaultTopics,
      guidanceTone: "protectora",
      notificationTime: "09:00"
    });

    router.replace("/(tabs)");
  }

  const footer = step > 0 ? (
    <NavFooter
      canAdvance={canMoveForward}
      ctaLabel={getCtaLabel(step)}
      onBack={back}
      onNext={step === SCREEN_COUNT - 1 ? submit : next}
      showBack={step > 1}
      tone={getToneForStep(step)}
    />
  ) : null;

  if (!fontsLoaded) {
    return (
      <View style={styles.figmaLoading}>
        <StatusBar hidden />
      </View>
    );
  }

  if (step === 0) {
    return <FigmaSplashScreen onNext={() => setStep(1)} />;
  }

  if (step === 1) {
    return <FigmaAlignScreen onNext={next} />;
  }

  if (step === 2) {
    return <FigmaIdentifyScreen identity={identity} onBack={back} onNext={next} onSelectIdentity={setIdentity} />;
  }

  if (step === 3) {
    return <FigmaDailyGuidanceScreen onBack={back} onNext={next} />;
  }

  if (step === 4) {
    return (
      <FigmaBirthdateEmptyScreen
        birthDate={birthDate}
        onBack={back}
        onChangeBirthDate={updateBirthDateFromNative}
        onNext={next}
        onUpdateBirthDate={updateBirthDate}
      />
    );
  }

  if (step === 5) {
    return (
      <FigmaBirthdateSelectedScreen
        dateLabel={formatLongDate(birthDate)}
        elementLabel={elementLabel}
        onBack={back}
        onChangeDate={() => setStep(4)}
        onNext={next}
        zodiacLabel={zodiacLabel}
      />
    );
  }

  if (step === 6) {
    return (
      <FigmaBirthplaceSearchScreen
        birthPlace={birthPlace}
        onBack={back}
        onChangeSearch={(value) => {
          setBirthPlaceSearch(value);
          setBirthPlace(undefined);
        }}
        onSelectPlace={(place) => {
          setBirthPlace(place);
          setBirthPlaceSearch(place.label);
          setStep(7);
        }}
        search={birthPlaceSearch}
      />
    );
  }

  if (step === 7) {
    return (
      <FigmaBirthplaceSelectedScreen birthPlace={birthPlace} onBack={back} onNext={next} />
    );
  }

  if (step === 8) {
    return (
      <FigmaBirthTimePickerScreen
        birthTime={birthTime}
        birthTimeUnknown={birthTimeUnknown}
        onBack={back}
        onNext={next}
        onChangeBirthTime={updateBirthTimeFromNative}
        onToggleUnknown={() => setBirthTimeUnknown((current) => !current)}
        onUpdateBirthTime={updateBirthTime}
      />
    );
  }

  if (step === 9) {
    return (
      <FigmaBirthTimeSelectedScreen birthTimeUnknown={birthTimeUnknown} onBack={back} onNext={next} timeLabel={timeLabel} />
    );
  }

  if (step === 10) {
    return (
      <FigmaBaseChartScreen
        birthDateLabel={formatShortDate(birthDate)}
        birthPlaceLabel={birthPlace?.city ?? "Buenos Aires"}
        birthTimeLabel={birthTimeUnknown ? "Aproximada" : formatBirthTime(birthTime)}
        onBack={back}
        onNext={next}
      />
    );
  }

  if (step === 11) {
    return (
      <FigmaPersonalizingScreen chartProgress={chartProgress} onBack={back} onNext={next} />
    );
  }

  if (step === 12) {
    return (
      <FigmaBeforeAfterScreen onBack={back} onNext={next} />
    );
  }

  if (step === 13) {
    return (
      <FigmaAccountScreen email={email} onBack={back} onChangeEmail={setEmail} onNext={next} />
    );
  }

  return <FigmaPaymentScreen onBack={back} onSelectPlan={setSelectedPlan} onSubmit={submit} selectedPlan={selectedPlan} />;
}

function canAdvance(
  step: number,
  state: {
    identity?: Identity;
    birthDate: BirthDateParts;
    birthPlace?: BirthPlace;
    chartProgress: number;
  }
) {
  if (step === 2) {
    return Boolean(state.identity);
  }

  if (step === 4 || step === 5) {
    return isBirthDateComplete(state.birthDate);
  }

  if (step === 6 || step === 7) {
    return Boolean(state.birthPlace);
  }

  if (step === 11) {
    return state.chartProgress >= 59;
  }

  return true;
}

function showStepAlert(step: number) {
  if (step === 2) {
    Alert.alert("Elegí una opción", "Esto solo ajusta el tono de tus lecturas.");
    return;
  }

  if (step === 4 || step === 5) {
    Alert.alert("Falta la fecha", "Elegí día, mes y año para calcular tu Sol.");
    return;
  }

  if (step === 6 || step === 7) {
    Alert.alert("Falta el lugar", "Seleccioná una ciudad para ajustar el horizonte de tu carta.");
    return;
  }
}

function getCtaLabel(step: number) {
  if (step === 1) {
    return "Empezar el viaje";
  }

  if (step === 3) {
    return "Estoy en órbita";
  }

  if (step === 10) {
    return "Calcular mi carta";
  }

  return "Continuar";
}

function FigmaSplashScreen({ onNext }: { onNext: () => void }) {
  return (
    <FigmaCanvas>
      <StatusBar hidden />
      <Pressable accessibilityRole="button" onPress={onNext} style={StyleSheet.absoluteFill}>
        <AssetBackplate opacity={0.92} source={onboardingAssets.backplate} washColor="#08090B" washOpacity={0.44} />
        <AmbientImageCrop h={270} opacity={0.18} radius={135} source={onboardingAssets.logoOrbe} w={270} x={61} y={223} />
        <FigmaImageFull opacity={0.18} source={onboardingAssets.figmaBg01} />
        <ImageWash color="#08090B" opacity={0.42} />
        <FigmaStatusBar timeLineHeight={14} timeSize={11} timeX={28} timeY={20} tone="light" y={24} />
        <FigmaEllipse borderColor="#C46A3A" borderOpacity={0.95} borderWidth={2} h={56.1} w={102.3} x={144.85} y={297.95} />
        <FigmaEllipse borderColor="#C46A3A" borderOpacity={0.95} borderWidth={1} color="#050506" h={16.5} w={16.5} x={187.75} y={317.75} />
        <FigmaEllipse borderColor="#C46A3A" borderOpacity={0.95} borderWidth={1} h={13.2} w={13.2} x={229} y={297.95} />
        <FigmaText align="center" color="#F7F5EF" family="Newsreader_500Medium" fontSize={58} lineHeight={64} text="Órbita" w={281} x={56} y={452} />
        <FigmaText align="center" color="#F7F5EF" family="Inter_500Medium" fontSize={13} lineHeight={18} text="tu astróloga personal" w={393} x={0} y={548} />
        <FigmaHomeIndicator color="#111111" opacity={0.95} />
      </Pressable>
    </FigmaCanvas>
  );
}

function FigmaAlignScreen({ onNext }: { onNext: () => void }) {
  return (
    <FigmaCanvas>
      <StatusBar hidden />
      <AssetBackplate opacity={0.88} source={onboardingAssets.backplate} washColor="#0B0C10" washOpacity={0.48} />
      <FigmaImageFull opacity={0.34} source={onboardingAssets.figmaBg02} />
      <AmbientImageCrop h={360} opacity={0.18} radius={180} source={onboardingAssets.dailyBackplateFigma} w={360} x={16} y={284} />
      <ImageWash color="#0B0C10" opacity={0.34} />
      <FigmaStatusBar tone="light" />
      <FigmaText
        align="center"
        color="#F7F5EF"
        family="Inter_700Bold"
        fontSize={29}
        lineHeight={34}
        text={"Alineate con el\nritmo del universo"}
        w={309}
        x={42}
        y={88}
      />
      <FigmaText
        align="center"
        color="#F7F5EF"
        family="Inter_500Medium"
        fontSize={14}
        lineHeight={19}
        text="Descifrá amor, trabajo y camino personal desde tu carta."
        w={293}
        x={50}
        y={166}
      />
      <FigmaImageSlot h={146} source={onboardingAssets.benefitLunar} w={130} x={48} y={242} />
      <FigmaImageSlot h={170} source={onboardingAssets.benefitGuide} w={126} x={212} y={232} />
      <FigmaImageSlot h={158} source={onboardingAssets.benefitPractice} w={140} x={58} y={440} />
      <FigmaImageSlot h={147} source={onboardingAssets.benefitDecisions} w={133} x={218} y={464} />
      <FigmaBenefitPill label="☾ Influencia lunar" w={186} x={38} y={222} />
      <FigmaBenefitPill label="✦ Guía personal" w={162} x={202} y={212} />
      <FigmaBenefitPill label="◇ Práctica diaria" w={182} x={48} y={420} />
      <FigmaBenefitPill label="Decisiones" w={138} x={208} y={444} />
      <FigmaText
        align="center"
        color="#F7F5EF"
        family="Inter_500Medium"
        fontSize={13}
        lineHeight={18}
        text="Órbita ordena señales, no dicta destino."
        w={277}
        x={58}
        y={650}
      />
      <FigmaCTA h={56} label="Empezar el viaje" onPress={onNext} y={760} />
      <FigmaHomeIndicator color="#F4F5F8" />
    </FigmaCanvas>
  );
}

function FigmaIdentifyScreen({
  identity,
  onBack,
  onNext,
  onSelectIdentity
}: {
  identity?: Identity;
  onBack: () => void;
  onNext: () => void;
  onSelectIdentity: (value: Identity) => void;
}) {
  return (
    <FigmaCanvas>
      <StatusBar hidden />
      <AssetBackplate opacity={0.84} source={onboardingAssets.identifyBg21} washColor="#0B0C10" washOpacity={0.58} />
      <AmbientImageCrop h={360} opacity={0.2} radius={180} source={onboardingAssets.identifyBg27} w={360} x={86} y={242} />
      <FigmaImageFull opacity={0.24} source={onboardingAssets.figmaBg03} />
      <ImageWash color="#0B0C10" opacity={0.28} />
      <FigmaStatusBar batteryX={348} cellX={306} timeY={22} tone="light" wifiX={331} y={27} />
      <FigmaBackChevron onPress={onBack} x={32} y={78} />
      <FigmaSegmentProgress active={2} x={58} y={94} />
      <FigmaText color="#F7F5EF" family="Inter_700Bold" fontSize={31} lineHeight={37} text="¿Cómo te identificás?" w={320} x={32} y={132} />
      <FigmaText
        color="#F7F5EF"
        family="Inter_400Regular"
        fontSize={15}
        lineHeight={18}
        text="Vamos a personalizar tu experiencia y tus prácticas."
        w={306}
        x={32}
        y={210}
      />
      <RadioGroup onValueChange={(value) => onSelectIdentity(value as Identity)} style={styles.figmaIdentityGroup} value={identity}>
        <FigmaIdentityOption label="Ella" onPress={() => onSelectIdentity("ella")} selected={identity === "ella"} value="ella" y={282} />
        <FigmaIdentityOption label="Él" onPress={() => onSelectIdentity("el")} selected={identity === "el"} value="el" y={360} />
        <FigmaIdentityOption
          label="Prefiero no decirlo"
          onPress={() => onSelectIdentity("prefiero_no_decirlo")}
          selected={identity === "prefiero_no_decirlo"}
          value="prefiero_no_decirlo"
          y={438}
        />
      </RadioGroup>
      <FigmaText
        align="center"
        color="#F7F5EF"
        family="Inter_400Regular"
        fontSize={14}
        lineHeight={17}
        text="Solo cambia el tono de tus lecturas."
        w={329}
        x={32}
        y={530}
      />
      <FigmaCTA h={48} label="Continuar" onPress={onNext} y={760} />
      <FigmaHomeIndicator color="#F5F3EE" y={833} />
    </FigmaCanvas>
  );
}

function FigmaDailyGuidanceScreen({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <FigmaCanvas>
      <StatusBar hidden />
      <AssetBackplate opacity={0.92} source={onboardingAssets.dailyBackplate} washColor="#0B0C10" washOpacity={0.4} />
      <AmbientImageCrop h={410} opacity={0.18} radius={205} source={onboardingAssets.dailyBackplate61} w={410} x={-116} y={250} />
      <AmbientImageCrop h={320} opacity={0.18} radius={160} source={onboardingAssets.dailyBaseAlt} w={320} x={212} y={230} />
      <FigmaImageFull opacity={0.22} source={onboardingAssets.figmaBg04} />
      <ImageWash color="#0B0C10" opacity={0.32} />
      <FigmaStatusBar tone="light" />
      <FigmaBackChevron fontSize={30} onPress={onBack} x={30} y={66} />
      <FigmaText
        align="center"
        color="#F7F5EF"
        family="Inter_700Bold"
        fontSize={29}
        lineHeight={34}
        text={"Guía diaria,\najustada a vos"}
        w={305}
        x={44}
        y={92}
      />
      <FigmaText
        align="center"
        color="#F7F5EF"
        family="Inter_500Medium"
        fontSize={14}
        lineHeight={19}
        text="Micro-rituales, insights y señales para este momento."
        w={301}
        x={46}
        y={176}
      />
      <FigmaEllipse color="#263851" h={118} opacity={0.45} w={118} x={8} y={330} />
      <FigmaEllipse color="#5C3A43" h={136} opacity={0.42} w={136} x={270} y={298} />
      <FigmaRect borderColor="#363A45" borderOpacity={0.9} color="#0E1118" h={330} radius={32} w={196} x={99} y={256} />
      <FigmaRect borderColor="#444956" borderOpacity={0.6} color="#171B24" h={254} radius={20} w={158} x={118} y={292} />
      <AmbientImageCrop h={246} opacity={0.36} radius={18} source={onboardingAssets.dailyBase} w={150} x={122} y={296} />
      <FigmaRect color="#05070A" h={246} opacity={0.48} radius={18} w={150} x={122} y={296} />
      <FigmaRect color="#05070A" h={8} radius={4} w={58} x={167} y={274} />
      <FigmaEllipse borderColor="#C46A3A" borderOpacity={0.54} h={54} rotate="-18deg" w={122} x={134} y={338} />
      <FigmaEllipse borderColor="#C46A3A" borderOpacity={0.45} h={62} rotate="20deg" w={128} x={132} y={350} />
      <FigmaEllipse borderColor="#C46A3A" borderOpacity={0.38} h={42} rotate="55deg" w={92} x={150} y={344} />
      <FigmaEllipse color="#C46A3A" h={8} w={8} x={193} y={364} />
      <FigmaGuidanceBadge label="Amor" rotate="-8deg" symbol="♡" w={86} x={37} y={354} />
      <FigmaGuidanceBadge label="Cuidado" rotate="-8deg" symbol="☾" w={106} x={22} y={420} />
      <FigmaGuidanceBadge label="Decisiones" rotate="7deg" symbol="◇" w={118} x={262} y={338} />
      <FigmaGuidanceBadge label="Energía" rotate="8deg" symbol="✦" w={100} x={268} y={496} />
      <FigmaText
        align="center"
        color="#F7F5EF"
        family="Newsreader_500Medium"
        fontSize={18}
        lineHeight={21}
        text={"Tu energía\nse mueve suave"}
        w={128}
        x={132}
        y={456}
      />
      <FigmaText
        align="center"
        color="#F7F5EF"
        family="Inter_500Medium"
        fontSize={11}
        lineHeight={14}
        text={"Una acción pequeña\nordena el día."}
        w={128}
        x={132}
        y={510}
      />
      <FigmaCTA h={56} label="Estoy en órbita" onPress={onNext} y={760} />
      <FigmaHomeIndicator color="#F4F5F8" opacity={0.95} />
    </FigmaCanvas>
  );
}

function FigmaBirthdateEmptyScreen({
  birthDate,
  onBack,
  onChangeBirthDate,
  onNext,
  onUpdateBirthDate
}: {
  birthDate: BirthDateParts;
  onBack: () => void;
  onChangeBirthDate: (date: Date) => void;
  onNext: () => void;
  onUpdateBirthDate: (part: keyof BirthDateParts, delta: number) => void;
}) {
  return (
    <FigmaCanvas>
      <StatusBar hidden />
      <FigmaLightBackdrop accentSource={onboardingAssets.birthData77} accentOpacity={0.12} washOpacity={0.9} />
      <FigmaScreenChrome onBack={onBack} screen={5} tone="light" />
      <FigmaText color="#111111" family="Newsreader_500Medium" fontSize={34} lineHeight={41} text="¿Cuándo naciste?" w={318} x={32} y={124} />
      <FigmaText color="rgba(17, 17, 17, 0.58)" family="Inter_400Regular" fontSize={14} lineHeight={20} text="Tu fecha ubica el Sol en tu carta." w={300} x={32} y={186} />
      <FigmaRect color="rgba(255, 252, 246, 0.7)" h={242} radius={10} w={329} x={32} y={318} />
      <FigmaNativeDateTimePicker
        maximumDate={new Date(2026, 11, 31)}
        minimumDate={new Date(1900, 0, 1)}
        mode="date"
        onChange={onChangeBirthDate}
        value={toNativeBirthDate(birthDate)}
        h={222}
        w={329}
        x={32}
        y={328}
      />
      <Pressable accessibilityLabel="Día anterior" accessibilityRole="button" onPress={() => onUpdateBirthDate("day", -1)} style={[styles.figmaDateNudge, { left: 32, top: 560 }]} />
      <Pressable accessibilityLabel="Día siguiente" accessibilityRole="button" onPress={() => onUpdateBirthDate("day", 1)} style={[styles.figmaDateNudge, { left: 198, top: 560 }]} />
      <FigmaText
        color="rgba(17, 17, 17, 0.48)"
        family="Inter_400Regular"
        fontSize={12}
        lineHeight={16}
        text="La usamos para calcular tu carta natal. Nunca vendemos ni compartimos tus datos."
        w={297}
        x={48}
        y={692}
      />
      <FigmaCTA fill="#111111" h={52} label="Continuar" onPress={onNext} radius={0} textColor="#F7F5EF" y={760} />
      <FigmaHomeIndicator color="#111111" />
    </FigmaCanvas>
  );
}

function FigmaBirthdateSelectedScreen({
  dateLabel,
  elementLabel,
  onBack,
  onChangeDate,
  onNext,
  zodiacLabel
}: {
  dateLabel: string;
  elementLabel: string;
  onBack: () => void;
  onChangeDate: () => void;
  onNext: () => void;
  zodiacLabel: string;
}) {
  return (
    <FigmaCanvas>
      <StatusBar hidden />
      <FigmaLightBackdrop accentSource={onboardingAssets.birthData40} accentOpacity={0.18} washOpacity={0.82} />
      <AmbientImageCrop h={430} opacity={0.18} radius={215} source={onboardingAssets.sunEmblem} w={430} x={-18} y={208} />
      <FigmaRect color="#F7F5EF" h={852} opacity={0.58} w={393} x={0} y={0} />
      <FigmaScreenChrome onBack={onBack} screen={6} tone="light" />
      <FigmaText color="#111111" family="Newsreader_500Medium" fontSize={31} lineHeight={37} text={`Sol en ${zodiacLabel}.`} w={305} x={44} y={132} />
      <FigmaText color="rgba(17, 17, 17, 0.54)" family="Inter_400Regular" fontSize={14} lineHeight={20} text={dateLabel} w={305} x={44} y={188} />
      <FigmaImageCrop h={190} radius={95} source={onboardingAssets.sunEmblem} w={190} x={101} y={276} />
      <FigmaMetricText label="SOL" value={zodiacLabel} y={532} />
      <FigmaLine color="rgba(17, 17, 17, 0.18)" w={275} x={54} y={564} />
      <FigmaMetricText label="ELEMENTO" value={elementLabel} y={596} />
      <FigmaLine color="rgba(17, 17, 17, 0.18)" w={275} x={54} y={628} />
      <Button
        fill="transparent"
        onPress={onChangeDate}
        radius={0}
        style={[styles.figmaAbsolute, { height: 34, left: 44, top: 658, width: 305 }]}
        textColor="#C46A3A"
        variant="figma"
      >
        <FigmaText align="center" color="#C46A3A" family="Inter_700Bold" fontSize={14} lineHeight={18} text="Cambiar fecha" w={305} x={0} y={6} />
      </Button>
      <FigmaText
        align="center"
        color="rgba(17, 17, 17, 0.48)"
        family="Inter_400Regular"
        fontSize={12}
        lineHeight={16}
        text="La usamos para calcular tu carta natal. Nunca vendemos ni compartimos tus datos."
        w={277}
        x={58}
        y={704}
      />
      <FigmaCTA fill="#111111" h={48} label="Continuar" onPress={onNext} radius={0} textColor="#F7F5EF" y={760} />
      <FigmaHomeIndicator color="#111111" />
    </FigmaCanvas>
  );
}

function FigmaBirthplaceSearchScreen({
  birthPlace,
  onBack,
  onChangeSearch,
  onSelectPlace,
  search
}: {
  birthPlace?: BirthPlace;
  onBack: () => void;
  onChangeSearch: (value: string) => void;
  onSelectPlace: (place: BirthPlace) => void;
  search: string;
}) {
  const inputRef = useRef<TextInput>(null);
  const results = getFilteredPlaces(search);

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 180);

    return () => clearTimeout(focusTimer);
  }, []);

  return (
    <View style={styles.keyboardRoot}>
      <FigmaCanvas>
        <StatusBar hidden />
        <FigmaLightBackdrop accentSource={onboardingAssets.birthData34} accentOpacity={0.12} washOpacity={0.9} />
        <FigmaScreenChrome onBack={onBack} screen={7} tone="light" />
        <FigmaText color="#111111" family="Newsreader_500Medium" fontSize={34} lineHeight={41} text="¿Dónde naciste?" w={318} x={32} y={124} />
        <FigmaText color="rgba(17, 17, 17, 0.58)" family="Inter_400Regular" fontSize={14} lineHeight={20} text="La ciudad ajusta el horizonte de tu carta." w={310} x={32} y={186} />
        <FigmaText color="#C46A3A" family="Inter_700Bold" fontSize={10} lineHeight={12} text="CIUDAD" w={270} x={32} y={276} />
        <TextField
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          containerStyle={[styles.figmaAbsolute, { height: 34, left: 32, top: 291, width: 270 }]}
          inputStyle={styles.figmaBirthplaceInputText}
          onChangeText={onChangeSearch}
          placeholder="Buenos"
          ref={inputRef}
          value={search}
          variant="light"
        />
        <FigmaLine color="rgba(17, 17, 17, 0.72)" w={329} x={32} y={329} />
        {results.slice(0, 3).map((place, index) => (
          <FigmaPlaceResult
            key={place.label}
            label={place.label}
            onPress={() => onSelectPlace(place)}
            selected={birthPlace?.label === place.label}
            y={356 + index * 45}
          />
        ))}
        <FigmaText
          align="center"
          color="rgba(17, 17, 17, 0.42)"
          family="Inter_400Regular"
          fontSize={11}
          lineHeight={15}
          text="La usamos para precisar tu carta natal. Nunca vendemos ni compartimos tus datos."
          w={297}
          x={48}
          y={520}
        />
        <FigmaHomeIndicator color="#111111" />
      </FigmaCanvas>
    </View>
  );
}

function FigmaBirthplaceSelectedScreen({ birthPlace, onBack, onNext }: { birthPlace?: BirthPlace; onBack: () => void; onNext: () => void }) {
  return (
      <FigmaCanvas>
        <StatusBar hidden />
        <FigmaRect color="#F7F3EA" h={852} w={393} x={0} y={0} />
      <FigmaImageFull opacity={0.18} source={onboardingAssets.ascendantHorizon} />
      <FigmaImageFull opacity={0.2} source={onboardingAssets.figmaBg08} />
      <FigmaRect color="#F7F3EA" h={852} opacity={0.62} w={393} x={0} y={0} />
      <FigmaScreenChrome onBack={onBack} screen={8} tone="light" />
      <FigmaText color="#111111" family="Newsreader_500Medium" fontSize={32} lineHeight={38} text="Horizonte definido." w={305} x={43} y={131} />
      <FigmaText color="#77736A" family="Inter_500Medium" fontSize={15} lineHeight={20} text={birthPlace?.label ?? "Buenos Aires, Argentina"} w={305} x={43} y={187} />
      <FigmaLine color="rgba(17, 17, 17, 0.72)" w={305} x={43} y={243} />
      <FigmaText color="#111111" family="Newsreader_400Regular" fontSize={24} lineHeight={30} text="El lugar ayuda a calcular tu ascendente y las casas." w={305} x={43} y={277} />
      <FigmaText
        align="center"
        color="#77736A"
        family="Inter_500Medium"
        fontSize={11}
        lineHeight={15}
        text="La usamos para precisar tu carta natal. Nunca vendemos ni compartimos tus datos."
        w={277}
        x={58}
        y={703}
      />
      <FigmaCTA fill="#111111" h={48} label="Continuar" onPress={onNext} radius={0} textColor="#F7F5EF" y={759} />
      <FigmaHomeIndicator color="#111111" />
    </FigmaCanvas>
  );
}

function FigmaBirthTimePickerScreen({
  birthTime,
  birthTimeUnknown,
  onChangeBirthTime,
  onBack,
  onNext,
  onToggleUnknown,
  onUpdateBirthTime
}: {
  birthTime: BirthTime;
  birthTimeUnknown: boolean;
  onChangeBirthTime: (date: Date) => void;
  onBack: () => void;
  onNext: () => void;
  onToggleUnknown: () => void;
  onUpdateBirthTime: (part: keyof BirthTime, delta: number) => void;
}) {
  return (
    <FigmaCanvas>
      <StatusBar hidden />
      <FigmaRect color="#F7F5EF" h={852} w={393} x={0} y={0} />
      <FigmaImageFull opacity={0.08} source={onboardingAssets.birthData83} />
      <FigmaImageFull opacity={0.16} source={onboardingAssets.dailyTextureB} />
      <FigmaRect color="#F7F3EA" h={852} opacity={0.7} w={393} x={0} y={0} />
      <AmbientImageCrop h={320} opacity={0.11} radius={160} source={onboardingAssets.orbitalChart} w={320} x={35} y={245} />
      <FigmaScreenChrome onBack={onBack} screen={9} tone="light" />
      <FigmaText color="#111111" family="Newsreader_500Medium" fontSize={32} lineHeight={38} text="¿A qué hora naciste?" w={305} x={43} y={131} />
      <FigmaText color="#77736A" family="Inter_500Medium" fontSize={15} lineHeight={20} text="La hora afina tu ascendente y tus casas." w={305} x={43} y={187} />
      <FigmaRect color="rgba(255, 252, 246, 0.72)" h={242} radius={10} w={329} x={32} y={292} />
      <FigmaRect color="rgba(239, 238, 232, 0.75)" h={36} radius={4} w={257} x={67} y={395} />
      <FigmaNativeDateTimePicker
        mode="time"
        onChange={onChangeBirthTime}
        value={toNativeBirthTime(birthTime)}
        h={222}
        w={329}
        x={32}
        y={302}
      />
      <Pressable accessibilityLabel="Hora anterior" accessibilityRole="button" onPress={() => onUpdateBirthTime("hour", -1)} style={[styles.figmaDateNudge, { left: 32, top: 536 }]} />
      <Pressable accessibilityLabel="Hora siguiente" accessibilityRole="button" onPress={() => onUpdateBirthTime("hour", 1)} style={[styles.figmaDateNudge, { left: 198, top: 536 }]} />
      <FigmaUnknownSplitButton selected={birthTimeUnknown} onPress={onToggleUnknown} />
      <FigmaText
        color="rgba(17, 17, 17, 0.48)"
        family="Inter_400Regular"
        fontSize={11}
        lineHeight={15}
        text="Podés continuar sin hora exacta. La lectura será menos precisa."
        w={277}
        x={58}
        y={686}
      />
      <FigmaCTA fill="#111111" h={48} label="Continuar" onPress={onNext} radius={0} textColor="#F7F5EF" y={759} />
      <FigmaHomeIndicator color="#111111" />
    </FigmaCanvas>
  );
}

function FigmaBirthTimeSelectedScreen({
  birthTimeUnknown,
  onBack,
  onNext,
  timeLabel
}: {
  birthTimeUnknown: boolean;
  onBack: () => void;
  onNext: () => void;
  timeLabel: string;
}) {
  return (
    <FigmaCanvas>
      <StatusBar hidden />
      <FigmaAscendantBackdrop />
      <FigmaScreenChrome onBack={onBack} screen={10} tone="light" />
      <FigmaText
        color="#111111"
        family="Newsreader_500Medium"
        fontSize={31}
        lineHeight={37}
        text={birthTimeUnknown ? "Carta aproximada." : "Ascendente afinado."}
        w={305}
        x={44}
        y={132}
      />
      <FigmaText color="rgba(17, 17, 17, 0.58)" family="Inter_400Regular" fontSize={13} lineHeight={18} text={birthTimeUnknown ? "Sin hora exacta" : timeLabel} w={305} x={44} y={188} />
      <FigmaLine color="rgba(17, 17, 17, 0.35)" w={305} x={44} y={244} />
      <FigmaText
        color="#111111"
        family="Newsreader_500Medium"
        fontSize={20}
        lineHeight={27}
        text={birthTimeUnknown ? "Podés volver atrás si encontrás el dato." : "La hora ordena las casas de tu carta."}
        w={305}
        x={44}
        y={278}
      />
      <FigmaMetricText label="HORA" value={timeLabel} y={622} />
      <FigmaLine color="rgba(17, 17, 17, 0.18)" w={275} x={54} y={654} />
      <FigmaText
        align="center"
        color="rgba(17, 17, 17, 0.48)"
        family="Inter_400Regular"
        fontSize={11}
        lineHeight={15}
        text="Podés volver atrás si necesitás cambiar la hora."
        w={277}
        x={58}
        y={704}
      />
      <FigmaCTA fill="#111111" h={48} label="Continuar" onPress={onNext} radius={0} textColor="#F7F5EF" y={760} />
      <FigmaHomeIndicator color="#111111" />
    </FigmaCanvas>
  );
}

function FigmaBaseChartScreen({
  birthDateLabel,
  birthPlaceLabel,
  birthTimeLabel,
  onBack,
  onNext
}: {
  birthDateLabel: string;
  birthPlaceLabel: string;
  birthTimeLabel: string;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <FigmaCanvas>
      <StatusBar hidden />
      <FigmaNatalChartBackdrop />
      <FigmaStatusBar tone="dark" timeLineHeight={14} timeSize={11} timeX={28} timeY={20} y={24} />
      <FigmaBackChevron color="#111111" onPress={onBack} x={28} y={65} />
      <FigmaStepProgress screen={11} tone="light" />
      <FigmaText color="#111111" family="Newsreader_500Medium" fontSize={36} lineHeight={40} text={"Estos son tus\npuntos de partida."} w={330} x={32} y={116} />
      <FigmaText align="center" color="#111111" family="Newsreader_400Regular" fontSize={15} lineHeight={20} text="☉" w={20} x={130} y={313} />
      <FigmaText align="center" color="#C46A3A" family="Newsreader_400Regular" fontSize={15} lineHeight={20} text="☽" w={20} x={240} y={291} />
      <FigmaEllipse color="#111111" h={6} opacity={0.9} w={6} x={194} y={359} />
      <FigmaText align="center" color="#111111" family="Inter_400Regular" fontSize={13} lineHeight={20} text="↑" w={20} x={192} y={418} />
      <FigmaBaseMetricText label="FECHA" value={birthDateLabel} y={548} />
      <FigmaLine color="rgba(17, 17, 17, 0.18)" w={329} x={32} y={579} />
      <FigmaBaseMetricText label="LUGAR" value={birthPlaceLabel} y={608} />
      <FigmaLine color="rgba(17, 17, 17, 0.18)" w={329} x={32} y={639} />
      <FigmaBaseMetricText label="HORA" value={birthTimeLabel} y={668} />
      <FigmaLine color="rgba(17, 17, 17, 0.18)" w={329} x={32} y={699} />
      <FigmaText color="#5C5852" family="Newsreader_400Regular" fontSize={13} lineHeight={18} text="Con esto calculamos tu Sol, ascendente y casas." w={320} x={32} y={712} />
      <FigmaCTA fill="#111111" h={48} label="Calcular mi carta" onPress={onNext} radius={0} textColor="#F7F5EF" y={760} />
      <FigmaHomeIndicator color="#111111" />
    </FigmaCanvas>
  );
}

function FigmaPersonalizingScreen({ chartProgress, onBack, onNext }: { chartProgress: number; onBack: () => void; onNext: () => void }) {
  const canContinue = chartProgress >= 59;

  return (
    <FigmaCanvas>
      <StatusBar hidden />
      <AssetBackplate opacity={0.68} source={onboardingAssets.personalizing51} washColor="#06070A" washOpacity={0.42} />
      <AmbientImageCrop h={430} opacity={0.18} radius={215} source={onboardingAssets.personalizing55} w={430} x={-44} y={230} />
      <FigmaImageFull opacity={0.24} source={onboardingAssets.transits} />
      <FigmaImageFull opacity={0.22} source={onboardingAssets.figmaBg12} />
      <ImageWash color="#06070A" opacity={0.46} />
      <FigmaStatusBar tone="light" timeLineHeight={14} timeSize={11} timeX={28} timeY={20} y={24} />
      <FigmaBackChevron onPress={onBack} x={28} y={65} />
      <FigmaStepProgress screen={12} tone="dark" />
      <FigmaText align="center" color="#F7F5EF" family="Inter_700Bold" fontSize={31} lineHeight={36} text="Calculando tu cielo..." w={285} x={54} y={132} />
      <FigmaText align="center" color="#F7F5EF" family="Inter_400Regular" fontSize={14} lineHeight={20} text="Carta natal en proceso." w={290} x={52} y={224} />
      <FigmaProgressMeter label="Carta natal" value={chartProgress} y={320} />
      <FigmaProgressMeter label="Tránsitos del día" value={0} y={394} />
      <FigmaRect borderColor="rgba(247, 245, 239, 0.16)" color="#18191E" h={54} radius={18} w={309} x={42} y={750} />
      <FigmaText
        align="center"
        color="rgba(216, 211, 200, 0.92)"
        family="Inter_500Medium"
        fontSize={12}
        lineHeight={15}
        text="Usamos tus datos para ordenar tus posiciones."
        w={269}
        x={62}
        y={766}
      />
      {canContinue ? (
        <Pressable accessibilityLabel="Continuar" accessibilityRole="button" onPress={onNext} style={[styles.figmaAbsolute, { height: 852, left: 0, top: 0, width: 393 }]} />
      ) : null}
      <FigmaHomeIndicator color="#F5F3EE" />
    </FigmaCanvas>
  );
}

function FigmaBeforeAfterScreen({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <FigmaCanvas>
      <StatusBar hidden />
      <AssetBackplate opacity={0.58} source={onboardingAssets.beforeAfter81} washColor="#090A0D" washOpacity={0.48} />
      <AmbientImageCrop h={260} opacity={0.28} radius={130} source={onboardingAssets.beforeAfter53} w={260} x={-50} y={318} />
      <AmbientImageCrop h={260} opacity={0.26} radius={130} source={onboardingAssets.beforeAfter81} w={260} x={202} y={250} />
      <FigmaImageFull opacity={0.26} source={onboardingAssets.figmaBg13} />
      <ImageWash color="#090A0D" opacity={0.42} />
      <FigmaStatusBar tone="light" />
      <Pressable accessibilityLabel="Volver" accessibilityRole="button" onPress={onBack} style={[styles.figmaAbsolute, { height: 56, left: 16, opacity: 0, top: 56, width: 56 }]} />
      <FigmaText align="center" color="#F7F5EF" family="Inter_700Bold" fontSize={27} lineHeight={32} text={"Antes y después\nde Órbita"} w={305} x={44} y={154} />
      <FigmaText
        align="center"
        color="#F7F5EF"
        family="Inter_500Medium"
        fontSize={14}
        lineHeight={19}
        text="Una guía diaria puede cambiar cómo mirás tu día."
        w={285}
        x={54}
        y={226}
      />
      <AmbientImageCrop h={54} radius={27} source={onboardingAssets.beforeAfter53} w={54} x={115} y={269} />
      <AmbientImageCrop h={62} radius={31} source={onboardingAssets.beforeAfter81} w={62} x={241} y={249} />
      <FigmaBeforeAfterPanel
        items={["Vivía en automático", "No sabía qué priorizar", "Dudaba de lo que quería", "Me sentía agotada", "Vínculos poco claros"]}
        rotate="3deg"
        title="Antes"
        x={30}
        y={327}
      />
      <FigmaBeforeAfterPanel
        highlight
        items={["Con calma y confianza", "Conozco mis fortalezas y límites", "Centrada y enfocada en lo importante", "Confío más en mi intuición", "Me vinculo con más claridad"]}
        rotate="-2deg"
        title="Después"
        x={181}
        y={288}
      />
      <FigmaText align="center" color="rgba(216, 211, 200, 0.92)" family="Inter_500Medium" fontSize={13} lineHeight={18} text="No resuelve por vos. Te devuelve contexto." w={301} x={46} y={696} />
      <FigmaCTA fill="#EEF2FF" h={56} label="Continuar" onPress={onNext} radius={28} textColor="#111111" y={760} />
      <FigmaHomeIndicator color="#F5F3EE" />
    </FigmaCanvas>
  );
}

function FigmaAccountScreen({
  email,
  onBack,
  onChangeEmail,
  onNext
}: {
  email: string;
  onBack: () => void;
  onChangeEmail: (value: string) => void;
  onNext: () => void;
}) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardRoot}>
      <FigmaCanvas>
        <StatusBar hidden />
        <FigmaLightBackdrop accentSource={onboardingAssets.accountSeal59} accentOpacity={0.15} washOpacity={0.86} />
        <AmbientImageCrop h={190} opacity={0.12} radius={95} source={onboardingAssets.accountSeal58} w={190} x={201} y={70} />
        <FigmaRect color="#F7F5EF" h={852} opacity={0.58} w={393} x={0} y={0} />
        <FigmaStatusBar tone="dark" timeLineHeight={14} timeSize={11} timeX={28} timeY={20} y={24} />
        <FigmaBackChevron color="#111111" onPress={onBack} x={28} y={65} />
        <FigmaStepProgress screen={14} tone="light" />
        <FigmaText color="#111111" family="Newsreader_500Medium" fontSize={40} lineHeight={49} text="Guardá tu carta." w={318} x={32} y={116} />
        <FigmaText color="rgba(17, 17, 17, 0.6)" family="Inter_500Medium" fontSize={16} lineHeight={23} text="Tu historial, tus lecturas y tus tránsitos quedan en tu cuenta." w={310} x={32} y={224} />
        <FigmaText color="#C46A3A" family="Inter_700Bold" fontSize={10} lineHeight={12} text="EMAIL" w={270} x={32} y={326} />
        <Avatar alt="Sello de cuenta Órbita" className="border border-border bg-muted" style={styles.figmaAccountAvatar}>
          <AvatarImage source={onboardingAssets.accountSeal58} />
          <AvatarFallback>
            <Text style={styles.figmaAccountAvatarFallback}>Ó</Text>
          </AvatarFallback>
        </Avatar>
        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={[styles.figmaAbsolute, { height: 34, left: 32, top: 341, width: 270 }]}
          inputMode="email"
          inputStyle={styles.figmaAccountInputText}
          onChangeText={onChangeEmail}
          placeholder="vos@email.com"
          value={email}
          variant="light"
        />
        <FigmaLine color="rgba(17, 17, 17, 0.72)" w={329} x={32} y={379} />
        <FigmaCTA fill="#111111" h={48} label="Continuar" onPress={onNext} radius={0} textColor="#F7F5EF" y={408} />
        <FigmaText align="center" color="rgba(17, 17, 17, 0.48)" family="Inter_700Bold" fontSize={13} lineHeight={16} text="O seguir con" w={393} x={0} y={478} />
        <FigmaSocialButton label="Continuar con Apple" y={516} />
        <FigmaSocialButton label="Continuar con Google" y={576} />
        <FigmaHomeIndicator color="#111111" />
      </FigmaCanvas>
    </KeyboardAvoidingView>
  );
}

function FigmaPaymentScreen({
  onBack,
  onSelectPlan,
  onSubmit,
  selectedPlan
}: {
  onBack: () => void;
  onSelectPlan: (plan: PlanId) => void;
  onSubmit: () => void;
  selectedPlan: PlanId;
}) {
  return (
    <FigmaCanvas>
      <StatusBar hidden />
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={StyleSheet.absoluteFill} contentContainerStyle={styles.figmaPaymentScrollContent}>
        <View style={styles.figmaPaymentContent}>
          <Image resizeMode="cover" source={onboardingAssets.paymentBg} style={styles.figmaPaymentBg} />
          <AmbientImageCrop h={360} opacity={0.18} radius={180} source={onboardingAssets.paymentAlt69} w={360} x={178} y={684} />
          <FigmaRect color="#08090B" h={1180} opacity={0.7} w={393} x={0} y={0} />
          <FigmaRect color="#08090B" h={820} opacity={0.2} w={393} x={0} y={360} />
          <FigmaStatusBar tone="light" />
          <Pressable accessibilityLabel="Volver" accessibilityRole="button" onPress={onBack} style={[styles.figmaAbsolute, { height: 44, left: 16, top: 55, width: 44 }]} />
          <FigmaText align="right" color="rgba(247, 245, 239, 0.88)" family="Inter_500Medium" fontSize={13} lineHeight={16} text="Restaurar" w={68} x={294} y={70} />
          <FigmaText color="#F7F5EF" family="Newsreader_500Medium" fontSize={20} lineHeight={24} text="Órbita" w={80} x={32} y={120} />
          <Badge className="border-accent bg-accent/10" variant="outline" style={styles.figmaPaymentPlusBadge}>
            <Text style={styles.figmaPaymentPlusText}>PLUS</Text>
          </Badge>
          <FigmaText color="#FAF5EE" family="Inter_700Bold" fontSize={34} lineHeight={38} text={"Tu cielo, todos\nlos días."} w={318} x={32} y={202} />
          <FigmaText color="rgba(232, 221, 209, 0.95)" family="Inter_500Medium" fontSize={14} lineHeight={20} text="Carta natal, tránsitos y lecturas más profundas." w={304} x={32} y={296} />
          <FigmaPaymentPlanRows onSelectPlan={onSelectPlan} selectedPlan={selectedPlan} />
          <FigmaUnlockPanel />
          <FigmaHowItWorksPanel />
          <FigmaEllipse borderColor="#C46A3A" borderOpacity={0.9} borderWidth={1} h={17} w={17} x={32} y={1048} />
          <FigmaText align="center" color="#C46A3A" family="Inter_700Bold" fontSize={9} lineHeight={10} text="✓" w={17} x={32} y={1052} />
          <FigmaText color="rgba(247, 245, 239, 0.74)" family="Inter_500Medium" fontSize={11.5} lineHeight={16} text="Cancelás cuando quieras. Entretenimiento y autoconocimiento." w={292} x={62} y={1044} />
          <FigmaCTA fill="#F5E8D8" h={52} label="Continuar" onPress={onSubmit} radius={12} textColor="#111111" w={345} x={24} y={1112} />
          <FigmaHomeIndicator color="#F5F3EE" y={1162} />
        </View>
      </ScrollView>
    </FigmaCanvas>
  );
}

function FigmaCanvas({ children }: { children: ReactNode }) {
  const { height, width } = useWindowDimensions();
  const fitScale = Math.min(width / FIGMA_CANVAS_WIDTH, height / FIGMA_CANVAS_HEIGHT);
  const scale = process.env.EXPO_OS === "web" ? Math.min(fitScale, 1) : fitScale;
  const scaledWidth = FIGMA_CANVAS_WIDTH * scale;
  const scaledHeight = FIGMA_CANVAS_HEIGHT * scale;
  const offsetX = -(FIGMA_CANVAS_WIDTH * (1 - scale)) / 2;
  const offsetY = -(FIGMA_CANVAS_HEIGHT * (1 - scale)) / 2;

  return (
    <View style={styles.figmaCanvasOuter}>
      <View style={[styles.figmaCanvasScaler, { height: scaledHeight, width: scaledWidth }]}>
        <View style={[styles.figmaCanvas, { left: offsetX, top: offsetY, transform: [{ scale }] }]}>{children}</View>
      </View>
    </View>
  );
}

function FigmaScreenChrome({ onBack, screen, tone }: { onBack: () => void; screen: number; tone: ScreenTone }) {
  const chromeTone = tone === "light" ? "dark" : "light";
  const backColor = tone === "light" ? "#111111" : "#F7F5EF";

  return (
    <>
      <FigmaStatusBar tone={chromeTone} />
      <FigmaStepProgress screen={screen} tone={tone} />
      <FigmaBackChevron color={backColor} fontSize={30} onPress={onBack} x={30} y={103} />
    </>
  );
}

function FigmaImageFull({ opacity, source }: { opacity: number; source: ImageSourcePropType }) {
  return <Image resizeMode="cover" source={source} style={[styles.figmaFullImage, { opacity }]} />;
}

function ImageWash({ color, opacity }: { color: string; opacity: number }) {
  return <FigmaRect color={color} h={852} opacity={opacity} w={393} x={0} y={0} />;
}

function AssetBackplate({
  opacity = 1,
  source,
  washColor,
  washOpacity = 0
}: {
  opacity?: number;
  source: ImageSourcePropType;
  washColor?: string;
  washOpacity?: number;
}) {
  return (
    <>
      <FigmaImageFull opacity={opacity} source={source} />
      {washColor && washOpacity > 0 ? <ImageWash color={washColor} opacity={washOpacity} /> : null}
    </>
  );
}

function AmbientImageCrop({
  h,
  opacity = 1,
  radius = 0,
  rotate,
  source,
  w,
  x,
  y
}: {
  h: number;
  opacity?: number;
  radius?: number;
  rotate?: string;
  source: ImageSourcePropType;
  w: number;
  x: number;
  y: number;
}) {
  return (
    <View
      style={[
        styles.figmaAbsolute,
        {
          borderRadius: radius,
          height: h,
          left: x,
          opacity,
          overflow: "hidden",
          top: y,
          transform: rotate ? [{ rotate }] : undefined,
          width: w
        }
      ]}
    >
      <Image resizeMode="cover" source={source} style={styles.figmaImageSlotImage} />
    </View>
  );
}

function FigmaLightBackdrop({
  accentOpacity = 0.22,
  accentSource = onboardingAssets.dailyTextureB,
  washOpacity = 0.94
}: {
  accentOpacity?: number;
  accentSource?: ImageSourcePropType;
  washOpacity?: number;
}) {
  return (
    <>
      <FigmaImageFull opacity={accentOpacity} source={accentSource} />
      <FigmaImageFull opacity={0.12} source={onboardingAssets.dailyTextureB} />
      <FigmaRect color="#F7F5EF" h={852} opacity={washOpacity} w={393} x={0} y={0} />
    </>
  );
}

function FigmaAscendantBackdrop() {
  return (
    <>
      <FigmaRect color="#F7F5EF" h={852} w={393} x={0} y={0} />
      <FigmaImageFull opacity={0.1} source={onboardingAssets.birthData83} />
      <AmbientImageCrop h={440} opacity={0.09} radius={220} source={onboardingAssets.ascendantHorizon} w={440} x={-24} y={188} />
      <AmbientImageCrop h={360} opacity={0.08} radius={180} source={onboardingAssets.orbitalChart} w={360} x={17} y={250} />
      <FigmaRect color="#F7F5EF" h={852} opacity={0.74} w={393} x={0} y={0} />
      <FigmaEllipse borderColor="#FFFFFF" borderOpacity={0.3} borderWidth={6} h={560} w={560} x={-84} y={150} />
      <FigmaEllipse borderColor="#FFFFFF" borderOpacity={0.64} borderWidth={1} h={524} w={524} x={-65} y={161} />
      <FigmaEllipse borderColor="#FFFFFF" borderOpacity={0.46} borderWidth={1} h={418} w={418} x={-12} y={214} />
      <FigmaEllipse borderColor="#FFFFFF" borderOpacity={0.34} borderWidth={1} h={278} w={278} x={58} y={284} />
      <FigmaEllipse borderColor="#FFFFFF" borderOpacity={0.46} borderWidth={1} h={220} w={220} x={86} y={313} />
      <FigmaEllipse borderColor="#C46A3A" borderOpacity={0.12} borderWidth={1} h={300} w={300} x={46} y={273} />
      <FigmaEllipse color="#FFFFFF" h={30} opacity={0.22} w={30} x={348} y={200} />
      <FigmaLine color="rgba(255, 255, 255, 0.5)" w={393} x={0} y={423} />
      <FigmaLine color="rgba(196, 106, 58, 0.06)" w={393} x={0} y={424} />
    </>
  );
}

function FigmaNatalChartBackdrop() {
  return (
    <>
      <FigmaRect color="#F7F5EF" h={852} w={393} x={0} y={0} />
      <FigmaImageFull opacity={0.14} source={onboardingAssets.baseChart47} />
      <AmbientImageCrop h={410} opacity={0.11} radius={205} source={onboardingAssets.baseChart46} w={410} x={-8} y={206} />
      <FigmaImageFull opacity={0.1} source={onboardingAssets.birthChartDiagram} />
      <FigmaImageFull opacity={0.08} source={onboardingAssets.figmaBg11} />
      <FigmaRect color="#F7F5EF" h={852} opacity={0.74} w={393} x={0} y={0} />
      <FigmaAstroGrid />
    </>
  );
}

function FigmaAstroGrid() {
  const centerX = 197;
  const centerY = 421;
  const lineColor = "rgba(255, 255, 255, 0.48)";
  const softLineColor = "rgba(255, 255, 255, 0.34)";

  return (
    <>
      <FigmaEllipse borderColor="#FFFFFF" borderOpacity={0.5} borderWidth={1} h={540} w={540} x={centerX - 270} y={centerY - 270} />
      <FigmaEllipse borderColor="#FFFFFF" borderOpacity={0.4} borderWidth={1} h={458} w={458} x={centerX - 229} y={centerY - 229} />
      <FigmaEllipse borderColor="#FFFFFF" borderOpacity={0.36} borderWidth={1} h={372} w={372} x={centerX - 186} y={centerY - 186} />
      <FigmaEllipse borderColor="#FFFFFF" borderOpacity={0.28} borderWidth={1} h={280} w={280} x={centerX - 140} y={centerY - 140} />
      <FigmaEllipse borderColor="#FFFFFF" borderOpacity={0.2} borderWidth={1} h={188} w={188} x={centerX - 94} y={centerY - 94} />
      {[0, 30, 60, 90, 120, 150].map((angle) => (
        <FigmaRotatedLine
          key={angle}
          color={angle % 90 === 0 ? lineColor : softLineColor}
          opacity={angle % 90 === 0 ? 1 : 0.88}
          rotate={`${angle}deg`}
          w={660}
          x={centerX - 330}
          y={centerY}
        />
      ))}
      <FigmaEllipse color="#FFFFFF" h={12} opacity={0.36} w={12} x={191} y={271} />
      <FigmaEllipse color="#FFFFFF" h={8} opacity={0.26} w={8} x={108} y={347} />
      <FigmaEllipse color="#FFFFFF" h={14} opacity={0.32} w={14} x={376} y={253} />
    </>
  );
}

function FigmaImageCrop({
  h,
  opacity = 1,
  radius = 0,
  source,
  w,
  x,
  y
}: {
  h: number;
  opacity?: number;
  radius?: number;
  source: ImageSourcePropType;
  w: number;
  x: number;
  y: number;
}) {
  return (
    <View style={[styles.figmaAbsolute, { borderRadius: radius, height: h, left: x, opacity, overflow: "hidden", top: y, width: w }]}>
      <Image resizeMode="cover" source={source} style={styles.figmaImageSlotImage} />
    </View>
  );
}

function FigmaImageSlot({ h, source, w, x, y }: { h: number; source: ImageSourcePropType; w: number; x: number; y: number }) {
  return (
    <View style={[styles.figmaImageSlot, { borderRadius: 28, height: h, left: x, top: y, width: w }]}>
      <Image resizeMode="cover" source={source} style={styles.figmaImageSlotImage} />
    </View>
  );
}

function FigmaLine({ color, w, x, y }: { color: string; w: number; x: number; y: number }) {
  return <FigmaRect color={color} h={1} w={w} x={x} y={y} />;
}

function FigmaNativeDateTimePicker({
  h,
  maximumDate,
  minimumDate,
  mode,
  onChange,
  value,
  w,
  x,
  y
}: {
  h: number;
  maximumDate?: Date;
  minimumDate?: Date;
  mode: "date" | "time";
  onChange: (date: Date) => void;
  value: Date;
  w: number;
  x: number;
  y: number;
}) {
  return (
    <View style={[styles.figmaNativePickerWrap, { height: h, left: x, top: y, width: w }]}>
      <DateTimePicker
        accentColor="#C46A3A"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        locale="es-AR"
        maximumDate={maximumDate}
        minimumDate={minimumDate}
        mode={mode}
        onChange={(_, selectedDate) => {
          if (selectedDate) {
            onChange(selectedDate);
          }
        }}
        style={styles.figmaNativePicker}
        textColor="#111111"
        themeVariant="light"
        value={value}
      />
    </View>
  );
}

function FigmaRotatedLine({ color, opacity = 1, rotate, w, x, y }: { color: string; opacity?: number; rotate: string; w: number; x: number; y: number }) {
  return <View style={[styles.figmaAbsolute, { backgroundColor: color, height: 1, left: x, opacity, top: y, transform: [{ rotate }], width: w }]} />;
}

function FigmaRect({
  borderColor,
  borderOpacity = 1,
  borderWidth = 1,
  color,
  h,
  opacity = 1,
  radius = 0,
  w,
  x,
  y
}: {
  borderColor?: string;
  borderOpacity?: number;
  borderWidth?: number;
  color: string;
  h: number;
  opacity?: number;
  radius?: number;
  w: number;
  x: number;
  y: number;
}) {
  return (
    <View
      style={[
        styles.figmaAbsolute,
        {
          backgroundColor: color,
          borderColor: borderColor ? withAlpha(borderColor, borderOpacity) : undefined,
          borderRadius: radius,
          borderWidth: borderColor ? borderWidth : 0,
          height: h,
          left: x,
          opacity,
          top: y,
          width: w
        }
      ]}
    />
  );
}

function FigmaEllipse({
  borderColor,
  borderOpacity = 1,
  borderWidth = 1,
  color = "transparent",
  h,
  opacity = 1,
  rotate,
  w,
  x,
  y
}: {
  borderColor?: string;
  borderOpacity?: number;
  borderWidth?: number;
  color?: string;
  h: number;
  opacity?: number;
  rotate?: string;
  w: number;
  x: number;
  y: number;
}) {
  return (
    <View
      style={[
        styles.figmaAbsolute,
        {
          backgroundColor: color,
          borderColor: borderColor ? withAlpha(borderColor, borderOpacity) : undefined,
          borderRadius: Math.max(w, h) / 2,
          borderWidth: borderColor ? borderWidth : 0,
          height: h,
          left: x,
          opacity,
          top: y,
          transform: rotate ? [{ rotate }] : undefined,
          width: w
        }
      ]}
    />
  );
}

function FigmaText({
  align = "left",
  color,
  family,
  fontSize,
  lineHeight,
  opacity = 1,
  text,
  w,
  x,
  y
}: {
  align?: "left" | "center" | "right";
  color: string;
  family: string;
  fontSize: number;
  lineHeight: number;
  opacity?: number;
  text: string;
  w: number;
  x: number;
  y: number;
}) {
  return (
    <Text
      style={[
        styles.figmaText,
        {
          color,
          fontFamily: family,
          fontSize,
          left: x,
          lineHeight,
          opacity,
          textAlign: align,
          top: y,
          width: w
        }
      ]}
    >
      {text}
    </Text>
  );
}

function FigmaStatusBar({
  batteryX = 369,
  cellX = 331,
  timeLineHeight = 16,
  timeSize = 14,
  timeX = 32,
  timeY = 24,
  tone,
  wifiX = 355,
  y = 28
}: {
  batteryX?: number;
  cellX?: number;
  timeLineHeight?: number;
  timeSize?: number;
  timeX?: number;
  timeY?: number;
  tone: "light" | "dark";
  wifiX?: number;
  y?: number;
}) {
  const color = tone === "light" ? "#F7F5EF" : "#111111";
  return (
    <>
      <FigmaText color={color} family="Inter_700Bold" fontSize={timeSize} lineHeight={timeLineHeight} text="9:41" w={60} x={timeX} y={timeY} />
      <FigmaRect color={color} h={7} radius={2} w={18} x={cellX} y={y} />
      <FigmaRect color={color} h={7} radius={2} w={9} x={wifiX} y={y} />
      <FigmaRect color={color} h={7} radius={2} w={14} x={batteryX} y={y} />
    </>
  );
}

function FigmaHomeIndicator({ color, opacity = 1, y = 834 }: { color: string; opacity?: number; y?: number }) {
  return <FigmaRect color={color} h={5} opacity={opacity} radius={3} w={127} x={133} y={y} />;
}

function FigmaCTA({
  fill,
  h,
  label,
  onPress,
  radius,
  textColor,
  w = 329,
  x = 32,
  y
}: {
  fill?: string;
  h: number;
  label: string;
  onPress: () => void;
  radius?: number;
  textColor?: string;
  w?: number;
  x?: number;
  y: number;
}) {
  const backgroundColor = fill ?? (h === 48 ? "#F5F3EE" : "#DCE8FF");
  const foregroundColor = textColor ?? "#111111";

  return (
    <Button
      fill={backgroundColor}
      onPress={onPress}
      radius={radius ?? 12}
      style={[styles.figmaCta, { height: h, left: x, top: y, width: w }]}
      textColor={foregroundColor}
      variant="figma"
    >
      <FigmaText align="center" color={foregroundColor} family="Inter_700Bold" fontSize={h === 48 ? 15 : 16} lineHeight={18} text={label} w={w} x={0} y={h === 48 ? 15 : 19} />
    </Button>
  );
}

function FigmaBackChevron({
  color = "#F7F5EF",
  fontSize = 28,
  onPress,
  x,
  y
}: {
  color?: string;
  fontSize?: number;
  onPress: () => void;
  x: number;
  y: number;
}) {
  return (
    <Button
      accessibilityLabel="Volver"
      fill="transparent"
      onPress={onPress}
      radius={28}
      style={[styles.figmaBackHit, { left: x - 12, top: y - 10 }]}
      variant="figma"
    >
      <FigmaText align="center" color={color} family={fontSize > 28 ? "Inter_700Bold" : "Inter_400Regular"} fontSize={fontSize} lineHeight={fontSize === 30 ? 28 : 33} text="‹" w={24} x={12} y={10} />
    </Button>
  );
}

function FigmaSegmentProgress({ active, x, y }: { active: number; x: number; y: number }) {
  return (
    <>
      {Array.from({ length: 13 }).map((_, index) => (
        <FigmaRect
          key={index}
          color={index < active ? "#F5F3EE" : "#46424C"}
          h={2}
          radius={2}
          w={19}
          x={x + index * 23}
          y={y}
        />
      ))}
    </>
  );
}

function FigmaBenefitPill({ label, w, x, y }: { label: string; w: number; x: number; y: number }) {
  return (
    <View style={[styles.figmaBenefitPill, { left: x, top: y, width: w }]}>
      <FigmaText align="center" color="#F7F5EF" family="Inter_700Bold" fontSize={11} lineHeight={14} text={label} w={w} x={0} y={8} />
    </View>
  );
}

function FigmaIdentityOption({
  label,
  onPress,
  selected,
  value,
  y
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
  value: Identity;
  y: number;
}) {
  return (
    <SelectableRow
      accessibilityLabel={label}
      backgroundColor="#1E1F26"
      borderColor="#2A2B34"
      label={label}
      labelStyle={styles.figmaIdentityLabel}
      onPress={onPress}
      radioPosition="right"
      radioStyle={styles.figmaRadio}
      radioValue={value}
      selected={selected}
      selectedBackgroundColor="#262730"
      selectedBorderColor="#C46A3A"
      style={[styles.figmaIdentityOption, { top: y }]}
      variant="dark"
    />
  );
}

function FigmaGuidanceBadge({
  label,
  rotate,
  symbol,
  w,
  x,
  y
}: {
  label: string;
  rotate: string;
  symbol: string;
  w: number;
  x: number;
  y: number;
}) {
  return (
    <View style={[styles.figmaGuidanceBadge, { left: x, top: y, transform: [{ rotate }], width: w }]}>
      <Text style={styles.figmaGuidanceSymbol}>{symbol}</Text>
      <Text style={styles.figmaGuidanceLabel}>{label}</Text>
    </View>
  );
}

function FigmaStepProgress({ screen, tone }: { screen: number; tone: ScreenTone }) {
  const active = clamp(screen - 1, 1, 13);
  const activeColor = tone === "light" ? "#111111" : "#F5F3EE";
  const inactiveColor = tone === "light" ? "rgba(17, 17, 17, 0.18)" : "rgba(247, 245, 239, 0.2)";

  return (
    <>
      {Array.from({ length: 13 }).map((_, index) => (
        <FigmaRect key={index} color={index < active ? activeColor : inactiveColor} h={2} radius={2} w={21} x={32 + index * 25} y={84} />
      ))}
    </>
  );
}

function FigmaUnknownSplitButton({ onPress, selected }: { onPress: () => void; selected: boolean }) {
  return (
    <ToggleRow
      body="Usamos una carta aproximada."
      bodyStyle={styles.figmaUnknownSplitBody}
      dotStyle={styles.figmaUnknownSplitDot}
      onPress={onPress}
      selected={selected}
      selectedTitleStyle={styles.figmaUnknownSplitTitleSelected}
      style={styles.figmaUnknownSplitButton}
      title="No sé la hora"
      titleStyle={styles.figmaUnknownSplitTitle}
      variant="light"
    />
  );
}

function FigmaMetricText({ label, value, y }: { label: string; value: string; y: number }) {
  return (
    <>
      <FigmaText color="#C46A3A" family="Inter_700Bold" fontSize={10} lineHeight={12} text={label} w={72} x={54} y={y} />
      <FigmaText color="#111111" family="Newsreader_500Medium" fontSize={18} lineHeight={22} text={value} w={220} x={132} y={y - 4} />
    </>
  );
}

function FigmaBaseMetricText({ label, value, y }: { label: string; value: string; y: number }) {
  return (
    <>
      <FigmaText color="#5C5852" family="Inter_700Bold" fontSize={8} lineHeight={12} text={label} w={95} x={32} y={y} />
      <FigmaText color="#111111" family="Newsreader_500Medium" fontSize={17} lineHeight={24} text={value} w={220} x={132} y={y - 3} />
    </>
  );
}

function FigmaDarkMetric({ label, value, y }: { label: string; value: string; y: number }) {
  return (
    <>
      <FigmaRect borderColor="rgba(247, 245, 239, 0.2)" color="rgba(10, 11, 15, 0.82)" h={78} radius={8} w={329} x={32} y={y} />
      <FigmaText color="#D69A6A" family="Inter_700Bold" fontSize={11} lineHeight={13} text={label} w={82} x={54} y={y + 30} />
      <FigmaText align="right" color="#F7F5EF" family="Inter_700Bold" fontSize={20} lineHeight={24} text={value} w={190} x={148} y={y + 27} />
    </>
  );
}

function FigmaPlaceResult({
  label,
  onPress,
  selected,
  y
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
  y: number;
}) {
  return (
    <>
      <SelectableRow
        backgroundColor="transparent"
        borderColor="transparent"
        borderWidth={0}
        label={label}
        labelStyle={styles.figmaPlaceText}
        onPress={onPress}
        radioPosition="none"
        selected={selected}
        selectedBackgroundColor="transparent"
        selectedBorderColor="transparent"
        selectedBorderWidth={0}
        selectedLabelStyle={styles.figmaPlaceTextSelected}
        style={[styles.figmaAbsolute, { height: 30, left: 32, top: y - 6, width: 329 }]}
        variant="figma"
      />
      <FigmaLine color="rgba(17, 17, 17, 0.14)" w={329} x={32} y={y + 30} />
    </>
  );
}

function FigmaTimeColumn({
  label,
  onDown,
  onUp,
  value,
  x
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  value: string;
  x: number;
}) {
  return (
    <View style={[styles.figmaTimeColumn, { left: x }]}>
      <Text style={styles.figmaTimeLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={onUp} style={styles.figmaTimeHitTop}>
        <Text style={styles.figmaTimeChevron}>⌃</Text>
      </Pressable>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.figmaTimeValue}>
        {value}
      </Text>
      <Pressable accessibilityRole="button" onPress={onDown} style={styles.figmaTimeHitBottom}>
        <Text style={styles.figmaTimeChevron}>⌄</Text>
      </Pressable>
    </View>
  );
}

function FigmaProgressMeter({ label, value, y }: { label: string; value: number; y: number }) {
  return (
    <>
      <FigmaText color="#F7F5EF" family="Inter_700Bold" fontSize={17} lineHeight={22} text={label} w={238} x={32} y={y} />
      <FigmaText align="right" color="#F7F5EF" family="Inter_700Bold" fontSize={17} lineHeight={22} text={`${value}%`} w={60} x={292} y={y} />
      <FigmaRect color="rgba(247, 245, 239, 0.14)" h={4} radius={2} w={329} x={32} y={y + 34} />
      {value > 0 ? <FigmaRect color="#C46A3A" h={4} radius={2} w={(329 * value) / 100} x={32} y={y + 34} /> : null}
    </>
  );
}

function FigmaBeforeAfterPanel({
  highlight = false,
  items,
  rotate = "0deg",
  title,
  x,
  y
}: {
  highlight?: boolean;
  items: string[];
  rotate?: string;
  title: string;
  x: number;
  y: number;
}) {
  const width = highlight ? 184 : 158;
  const height = highlight ? 364 : 324;
  const rowYs = highlight ? [72, 128, 184, 240, 296] : [78, 123, 168, 213, 258];
  const textWidth = highlight ? 124 : 88;
  const textX = highlight ? 45 : 47;
  const markX = highlight ? 20 : 22;
  const titleWidth = highlight ? 132 : 112;
  const itemFontSize = highlight ? 12.2 : 12.5;

  return (
    <View
      style={[
        styles.figmaBeforeAfterPanel,
        {
          backgroundColor: highlight ? "#24252C" : "#1B1C23",
          borderColor: highlight ? "rgba(196, 106, 58, 0.45)" : "rgba(75, 79, 92, 0.72)",
          height,
          left: x,
          top: y,
          transform: [{ rotate }],
          width
        }
      ]}
    >
      <Text style={[styles.figmaBeforeAfterTitle, { width: titleWidth }, highlight && styles.figmaBeforeAfterTitleHighlight]}>{title}</Text>
      {items.map((item, index) => (
        <View key={item} style={[styles.figmaBeforeAfterRow, { top: rowYs[index] }]}>
          <Text style={[styles.figmaBeforeAfterMark, { left: markX }, highlight && styles.figmaBeforeAfterMarkHighlight]}>{highlight ? "✓" : "×"}</Text>
          <Text style={[styles.figmaBeforeAfterCopy, { fontSize: itemFontSize, left: textX, width: textWidth }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function FigmaSocialButton({ label, y }: { label: string; y: number }) {
  return (
    <Button
      fill="transparent"
      label={label}
      radius={0}
      style={[styles.figmaSocialButton, { top: y }]}
      textColor="#111111"
      textStyle={styles.figmaSocialButtonText}
      variant="figma"
    />
  );
}

function FigmaPaymentPlanRows({
  onSelectPlan,
  selectedPlan
}: {
  onSelectPlan: (plan: PlanId) => void;
  selectedPlan: PlanId;
}) {
  return (
    <RadioGroup onValueChange={(value) => onSelectPlan(value as PlanId)} style={styles.figmaPaymentPlans} value={selectedPlan}>
      <FigmaPaymentPlanRow
        caption="Flexible para probar"
        label="Semanal"
        onPress={() => onSelectPlan("weekly")}
        price="$5"
        selected={selectedPlan === "weekly"}
        subprice="por semana"
        value="weekly"
        y={0}
      />
      <FigmaLine color="rgba(247, 245, 239, 0.16)" w={297} x={24} y={74} />
      <FigmaPaymentPlanRow
        badge="MEJOR VALOR"
        caption="$0.58 por semana"
        label="Anual"
        onPress={() => onSelectPlan("annual")}
        price="$30"
        selected={selectedPlan === "annual"}
        subprice="por año"
        value="annual"
        y={82}
      />
    </RadioGroup>
  );
}

function FigmaPaymentPlanRow({
  badge,
  caption,
  label,
  onPress,
  price,
  selected,
  subprice,
  value,
  y
}: {
  badge?: string;
  caption: string;
  label: string;
  onPress: () => void;
  price: string;
  selected: boolean;
  subprice: string;
  value: PlanId;
  y: number;
}) {
  return (
    <PlanOption
      badge={badge}
      caption={caption}
      label={label}
      onPress={onPress}
      price={price}
      selected={selected}
      style={{ top: y }}
      subprice={subprice}
      value={value}
    />
  );
}

function FigmaUnlockPanel() {
  return (
    <View style={styles.figmaUnlockPanel}>
      <Text style={styles.figmaPanelTitle}>Todo lo que desbloqueás</Text>
      <FigmaBenefitChip label="Carta natal completa" w={142} x={23} y={59} />
      <FigmaBenefitChip fontSize={8.5} label="Guía diaria personalizada" lineHeight={12} w={148} x={173} y={59} />
      <FigmaBenefitChip label="Tránsitos en tu carta" w={146} x={23} y={95} />
      <FigmaBenefitChip label="Preguntale a Órbita" w={128} x={177} y={95} />
      <FigmaBenefitChip fontSize={9.5} label="Sueños, vínculos y calendario" w={174} x={23} y={131} />
    </View>
  );
}

function FigmaBenefitChip({
  fontSize = 10.5,
  label,
  lineHeight = 13,
  w,
  x,
  y
}: {
  fontSize?: number;
  label: string;
  lineHeight?: number;
  w: number;
  x: number;
  y: number;
}) {
  return (
    <View style={[styles.figmaPaymentBenefitChip, { left: x, top: y, width: w }]}>
      <Text adjustsFontSizeToFit ellipsizeMode="clip" minimumFontScale={0.72} numberOfLines={1} style={[styles.figmaPaymentBenefitText, { fontSize, lineHeight, width: w - 4 }]}>
        {label}
      </Text>
    </View>
  );
}

function FigmaHowItWorksPanel() {
  return (
    <View style={styles.figmaHowPanel}>
      <Text style={styles.figmaHowPanelTitle}>Cómo funciona</Text>
      <FigmaRect color="rgba(196, 106, 58, 0.42)" h={118} w={1} x={9} y={60} />
      <FigmaPaymentStep index="01" title="Tu carta completa" body="Sol, Luna, ascendente, casas y aspectos en lenguaje claro." y={42} />
      <FigmaPaymentStep index="02" title="Tu día con contexto" body="Lecturas y tránsitos personalizados según tu mapa." y={106} />
      <FigmaPaymentStep index="03" title="Preguntas más profundas" body="Consultas, sueños y vínculos conectados con tu cielo." y={170} />
    </View>
  );
}

function FigmaPaymentStep({ body, index, title, y }: { body: string; index: string; title: string; y: number }) {
  return (
    <View style={[styles.figmaPaymentStep, { top: y }]}>
      <Text style={styles.figmaPaymentStepIndex}>{index}</Text>
      <Text style={styles.figmaPaymentStepTitle}>{title}</Text>
      <Text style={styles.figmaPaymentStepBody}>{body}</Text>
    </View>
  );
}

function withAlpha(hex: string, alpha: number) {
  if (alpha >= 1) {
    return hex;
  }

  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getToneForStep(step: number): ScreenTone {
  return [2, 4, 6, 8, 10, 13].includes(step) ? "light" : "dark";
}

function getFilteredPlaces(search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return birthPlaceOptions;
  }

  return birthPlaceOptions.filter((place) => place.label.toLowerCase().includes(normalizedSearch));
}

type OnboardingShellProps = {
  background?: ImageSourcePropType;
  children: ReactNode;
  footer?: ReactNode;
  keyboard?: boolean;
  scroll?: boolean;
  tone: ScreenTone;
};

function OnboardingShell({ background, children, footer, keyboard = false, scroll = false, tone }: OnboardingShellProps) {
  const overlayColors =
    tone === "dark"
      ? (["rgba(5, 6, 10, 0.72)", "rgba(13, 14, 18, 0.8)", "rgba(13, 14, 18, 0.96)"] as const)
      : (["rgba(247, 245, 239, 0.88)", "rgba(247, 245, 239, 0.94)", "rgba(247, 245, 239, 1)"] as const);

  const content = (
    <View style={[styles.shellBase, tone === "dark" ? styles.shellDark : styles.shellLight]}>
      {background ? (
        <ImageBackground imageStyle={styles.backgroundImage} resizeMode="cover" source={background} style={styles.backgroundFill}>
          <LinearGradient colors={overlayColors} style={StyleSheet.absoluteFill} />
          <ShellContent footer={footer} scroll={scroll}>
            {children}
          </ShellContent>
        </ImageBackground>
      ) : (
        <ShellContent footer={footer} scroll={scroll}>
          {children}
        </ShellContent>
      )}
    </View>
  );

  if (!keyboard) {
    return content;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardRoot}>
      {content}
    </KeyboardAvoidingView>
  );
}

function ShellContent({ children, footer, scroll }: { children: ReactNode; footer?: ReactNode; scroll: boolean }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

function OnboardingProgress({ step, tone }: { step: number; tone: ScreenTone }) {
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressMeta}>
        <Text style={[styles.progressLabel, tone === "dark" ? styles.progressLabelDark : styles.progressLabelLight]}>Órbita</Text>
        <Text style={[styles.progressCount, tone === "dark" ? styles.progressCountDark : styles.progressCountLight]}>
          {pad2(step + 1)} / {SCREEN_COUNT}
        </Text>
      </View>
      <View style={[styles.progressTrack, tone === "dark" ? styles.progressTrackDark : styles.progressTrackLight]}>
        <View style={[styles.progressFill, { width: `${((step + 1) / SCREEN_COUNT) * 100}%` }]} />
      </View>
    </View>
  );
}

function NavFooter({
  canAdvance,
  ctaLabel,
  onBack,
  onNext,
  showBack,
  tone
}: {
  canAdvance: boolean;
  ctaLabel: string;
  onBack: () => void;
  onNext: () => void;
  showBack: boolean;
  tone: ScreenTone;
}) {
  return (
    <View style={styles.navFooter}>
      {showBack ? (
        <Pressable accessibilityRole="button" onPress={onBack} style={[styles.backButton, tone === "dark" ? styles.backButtonDark : styles.backButtonLight]}>
          <Ionicons color={tone === "dark" ? orbitaColors.bone : orbitaColors.ink} name="chevron-back" size={20} />
        </Pressable>
      ) : null}
      <PrimaryCTA disabled={!canAdvance} label={ctaLabel} onPress={onNext} tone={tone} />
    </View>
  );
}

function PrimaryCTA({ disabled, label, onPress, tone }: { disabled?: boolean; label: string; onPress: () => void; tone: ScreenTone }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryCta,
        tone === "dark" ? styles.primaryCtaDark : styles.primaryCtaLight,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed
      ]}
    >
      <Text style={[styles.primaryCtaText, tone === "dark" ? styles.primaryCtaTextDark : styles.primaryCtaTextLight]}>{label}</Text>
      <Ionicons color={tone === "dark" ? orbitaColors.ink : orbitaColors.bone} name="arrow-forward" size={18} />
    </Pressable>
  );
}

function HeaderBlock({ body, title, tone }: { body?: string; title: string; tone: ScreenTone }) {
  return (
    <View style={styles.headerBlock}>
      <Text style={tone === "dark" ? styles.darkTitle : styles.lightTitle}>{title}</Text>
      {body ? <Text style={tone === "dark" ? styles.darkBody : styles.lightBody}>{body}</Text> : null}
    </View>
  );
}

function OptionButton({ label, onPress, selected, tone }: { label: string; onPress: () => void; selected: boolean; tone: ScreenTone }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.optionButton,
        tone === "dark" ? styles.optionButtonDark : styles.optionButtonLight,
        selected && (tone === "dark" ? styles.optionButtonSelectedDark : styles.optionButtonSelectedLight)
      ]}
    >
      <Text style={tone === "dark" ? styles.optionTextDark : styles.optionTextLight}>{label}</Text>
      {selected ? <Ionicons color={orbitaColors.copper} name="checkmark-circle" size={22} /> : null}
    </Pressable>
  );
}

function WheelPicker({
  label,
  onDown,
  onUp,
  value,
  wide = false
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  value: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.wheelPicker, wide && styles.wheelPickerWide]}>
      <Text style={styles.wheelLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={onUp} style={styles.wheelControl}>
        <Ionicons color={orbitaColors.copper} name="chevron-up" size={20} />
      </Pressable>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.wheelValue}>
        {value}
      </Text>
      <Pressable accessibilityRole="button" onPress={onDown} style={styles.wheelControl}>
        <Ionicons color={orbitaColors.copper} name="chevron-down" size={20} />
      </Pressable>
    </View>
  );
}

function PrivacyLine({ text, tone }: { text: string; tone: ScreenTone }) {
  return (
    <View style={styles.privacyLine}>
      <Ionicons color={tone === "dark" ? orbitaColors.copperSoft : orbitaColors.copper} name="lock-closed-outline" size={16} />
      <Text style={tone === "dark" ? styles.privacyTextDark : styles.privacyTextLight}>{text}</Text>
    </View>
  );
}

function MetricRow({ label, tone = "dark", value }: { label: string; tone?: ScreenTone; value: string }) {
  return (
    <View style={[styles.metricRow, tone === "light" && styles.metricRowLight]}>
      <Text style={tone === "dark" ? styles.metricLabelDark : styles.metricLabelLight}>{label}</Text>
      <Text style={tone === "dark" ? styles.metricValueDark : styles.metricValueLight}>{value}</Text>
    </View>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.loadingRow}>
      <View style={styles.loadingTop}>
        <Text style={styles.loadingLabel}>{label}</Text>
        <Text style={styles.loadingValue}>{value}%</Text>
      </View>
      <View style={styles.loadingTrack}>
        <View style={[styles.loadingFill, { width: `${value}%` }]} />
      </View>
    </View>
  );
}

function BeforeAfterColumn({ image, items, title }: { image: ImageSourcePropType; items: string[]; title: string }) {
  return (
    <View style={styles.beforeAfterColumn}>
      <Image resizeMode="cover" source={image} style={styles.beforeAfterImage} />
      <Text style={styles.beforeAfterTitle}>{title}</Text>
      {items.map((item) => (
        <View key={item} style={styles.beforeAfterItem}>
          <View style={styles.bulletDot} />
          <Text style={styles.beforeAfterText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function SocialButton({ icon, label }: { icon: ComponentProps<typeof Ionicons>["name"]; label: string }) {
  return (
    <Pressable accessibilityRole="button" style={styles.socialButton}>
      <Ionicons color={orbitaColors.ink} name={icon} size={20} />
      <Text style={styles.socialButtonText}>{label}</Text>
    </Pressable>
  );
}

function PlanSelector({ onSelect, selectedPlan }: { onSelect: (plan: PlanId) => void; selectedPlan: PlanId }) {
  return (
    <View style={styles.planSelector}>
      <PlanRow
        caption="Flexible para probar"
        label="Semanal"
        onPress={() => onSelect("weekly")}
        price="$5"
        selected={selectedPlan === "weekly"}
        subprice="por semana"
      />
      <PlanRow
        badge="MEJOR VALOR"
        caption="$0.58 por semana"
        label="Anual"
        onPress={() => onSelect("annual")}
        price="$30"
        selected={selectedPlan === "annual"}
        subprice="por año"
      />
    </View>
  );
}

function PlanRow({
  badge,
  caption,
  label,
  onPress,
  price,
  selected,
  subprice
}: {
  badge?: string;
  caption: string;
  label: string;
  onPress: () => void;
  price: string;
  selected: boolean;
  subprice: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.planRow, selected && styles.planRowSelected]}>
      <View style={styles.planLeft}>
        <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
        <View>
          <View style={styles.planLabelRow}>
            <Text style={styles.planLabel}>{label}</Text>
            {badge ? <Text style={styles.planBadge}>{badge}</Text> : null}
          </View>
          <Text style={styles.planCaption}>{caption}</Text>
        </View>
      </View>
      <View style={styles.planPriceWrap}>
        <Text style={styles.planPrice}>{price}</Text>
        <Text style={styles.planSubprice}>{subprice}</Text>
      </View>
    </Pressable>
  );
}

function BenefitRow({ label }: { label: string }) {
  return (
    <View style={styles.benefitRow}>
      <Ionicons color={orbitaColors.copperSoft} name="checkmark" size={18} />
      <Text style={styles.benefitText}>{label}</Text>
    </View>
  );
}

function StepRow({ body, index, title }: { body: string; index: string; title: string }) {
  return (
    <View style={styles.stepRow}>
      <Text style={styles.stepIndex}>{index}</Text>
      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

function OrbitaMark({ size }: { size: number }) {
  return (
    <View style={[styles.orbitaMark, { height: size, width: size }]}>
      <View style={[styles.orbitaCore, { borderRadius: size * 0.32, height: size * 0.64, width: size * 0.64 }]} />
      <View style={[styles.orbitaOrbit, { borderRadius: size * 0.48, height: size * 0.48, width: size * 0.94 }]} />
      <View style={[styles.orbitaDot, { borderRadius: size * 0.045, height: size * 0.09, right: size * 0.08, top: size * 0.35, width: size * 0.09 }]} />
    </View>
  );
}

const tileIcons: Array<ComponentProps<typeof Ionicons>["name"]> = ["moon-outline", "sparkles-outline", "calendar-outline", "compass-outline"];

const styles = StyleSheet.create({
  figmaLoading: {
    backgroundColor: "#08090B",
    flex: 1
  },
  figmaCanvasOuter: {
    alignItems: "center",
    backgroundColor: "#000000",
    flex: 1,
    justifyContent: "center",
    overflow: "hidden"
  },
  figmaCanvasScaler: {
    overflow: "hidden",
    position: "relative"
  },
  figmaCanvas: {
    backgroundColor: "#08090B",
    height: FIGMA_CANVAS_HEIGHT,
    overflow: "hidden",
    position: "absolute",
    width: FIGMA_CANVAS_WIDTH
  },
  figmaFullImage: {
    height: FIGMA_CANVAS_HEIGHT,
    left: 0,
    position: "absolute",
    top: 0,
    width: FIGMA_CANVAS_WIDTH
  },
  figmaImageSlot: {
    borderWidth: 0,
    opacity: 1,
    overflow: "hidden",
    position: "absolute"
  },
  figmaImageSlotImage: {
    height: "100%",
    width: "100%"
  },
  figmaAbsolute: {
    position: "absolute"
  },
  figmaText: {
    includeFontPadding: false,
    letterSpacing: 0,
    padding: 0,
    position: "absolute"
  },
  figmaCta: {
    left: 32,
    overflow: "hidden",
    position: "absolute",
    width: 329
  },
  figmaBackHit: {
    height: 56,
    position: "absolute",
    width: 56
  },
  figmaBenefitPill: {
    backgroundColor: "rgba(32, 33, 40, 0.9)",
    borderColor: "rgba(196, 106, 58, 0.58)",
    borderRadius: 15,
    borderWidth: 1,
    height: 30,
    overflow: "hidden",
    position: "absolute"
  },
  figmaIdentityOption: {
    borderRadius: 14,
    height: 66,
    left: 32,
    position: "absolute",
    width: 329
  },
  figmaIdentityGroup: {
    height: FIGMA_CANVAS_HEIGHT,
    left: 0,
    position: "absolute",
    top: 0,
    width: FIGMA_CANVAS_WIDTH
  },
  figmaIdentityLabel: {
    color: "#F7F5EF",
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    includeFontPadding: false,
    left: 20,
    letterSpacing: 0,
    lineHeight: 20,
    position: "absolute",
    top: 22
  },
  figmaRadio: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: "center",
    position: "absolute",
    right: 20,
    top: 22,
    width: 20
  },
  figmaRadioFill: {
    backgroundColor: "#C46A3A",
    borderRadius: 4,
    height: 8,
    width: 8
  },
  figmaGuidanceBadge: {
    backgroundColor: "rgba(36, 38, 46, 0.82)",
    borderColor: "rgba(196, 106, 58, 0.38)",
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    overflow: "hidden",
    position: "absolute"
  },
  figmaGuidanceSymbol: {
    color: "#F7F5EF",
    fontFamily: "Newsreader_500Medium",
    fontSize: 15,
    includeFontPadding: false,
    left: 12,
    letterSpacing: 0,
    lineHeight: 16,
    position: "absolute",
    textAlign: "center",
    top: 8,
    width: 18
  },
  figmaGuidanceLabel: {
    color: "#F7F5EF",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    includeFontPadding: false,
    left: 34,
    letterSpacing: 0,
    lineHeight: 14,
    position: "absolute",
    top: 11
  },
  figmaBirthplaceInput: {
    color: "#111111",
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    height: 34,
    includeFontPadding: false,
    left: 32,
    letterSpacing: 0,
    lineHeight: 24,
    padding: 0,
    position: "absolute",
    top: 291,
    width: 270
  },
  figmaBirthplaceInputText: {
    color: "#111111",
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    height: 34,
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 24,
    padding: 0,
    width: 270
  },
  figmaPlaceText: {
    color: "#111111",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 18,
    padding: 0
  },
  figmaPlaceTextSelected: {
    color: "#C46A3A"
  },
  figmaDateNudge: {
    height: 44,
    opacity: 0,
    position: "absolute",
    width: 128
  },
  figmaNativePickerWrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "absolute"
  },
  figmaNativePicker: {
    backgroundColor: "transparent",
    height: "100%",
    width: "100%"
  },
  figmaTimeWheelHit: {
    height: 92,
    position: "absolute"
  },
  figmaUnknownSplitButton: {
    backgroundColor: "rgba(255, 252, 246, 0.88)",
    borderRadius: 8,
    boxShadow: "0 8px 18px rgba(20, 15, 10, 0.06)",
    height: 64,
    left: 31,
    overflow: "hidden",
    position: "absolute",
    top: 597,
    width: 329
  },
  figmaUnknownSplitTitle: {
    color: "#111111",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    includeFontPadding: false,
    left: 17,
    letterSpacing: 0,
    lineHeight: 18,
    position: "absolute",
    top: 12
  },
  figmaUnknownSplitTitleSelected: {
    color: "#C46A3A"
  },
  figmaUnknownSplitBody: {
    color: "#6E675E",
    fontFamily: "Inter_500Medium",
    fontSize: 10.5,
    includeFontPadding: false,
    left: 17,
    letterSpacing: 0,
    lineHeight: 14,
    position: "absolute",
    top: 35
  },
  figmaUnknownSplitDot: {
    backgroundColor: "#D08355",
    borderRadius: 4.5,
    height: 9,
    left: 291,
    position: "absolute",
    top: 26,
    width: 9
  },
  figmaUnknownSplitDotSelected: {
    backgroundColor: "#C46A3A"
  },
  figmaTimeColumn: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderColor: "rgba(17, 17, 17, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    height: 244,
    position: "absolute",
    top: 280,
    width: 101
  },
  figmaTimeLabel: {
    color: "rgba(17, 17, 17, 0.48)",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    includeFontPadding: false,
    left: 0,
    letterSpacing: 0,
    lineHeight: 14,
    position: "absolute",
    textAlign: "center",
    top: 20,
    width: 101
  },
  figmaTimeHitTop: {
    alignItems: "center",
    height: 56,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    top: 48,
    width: 101
  },
  figmaTimeHitBottom: {
    alignItems: "center",
    height: 56,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    top: 158,
    width: 101
  },
  figmaTimeChevron: {
    color: "#C46A3A",
    fontFamily: "Inter_700Bold",
    fontSize: 29,
    includeFontPadding: false,
    lineHeight: 30,
    textAlign: "center"
  },
  figmaTimeValue: {
    color: "#111111",
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    includeFontPadding: false,
    left: 8,
    letterSpacing: 0,
    lineHeight: 34,
    position: "absolute",
    textAlign: "center",
    top: 112,
    width: 85
  },
  figmaUnknownTimeButton: {
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderRadius: 8,
    height: 96,
    left: 32,
    position: "absolute",
    top: 558,
    width: 329
  },
  figmaUnknownTimeTitle: {
    color: "#111111",
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    includeFontPadding: false,
    left: 20,
    letterSpacing: 0,
    lineHeight: 22,
    position: "absolute",
    top: 27
  },
  figmaUnknownTimeBody: {
    color: "rgba(17, 17, 17, 0.52)",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    includeFontPadding: false,
    left: 20,
    letterSpacing: 0,
    lineHeight: 17,
    position: "absolute",
    top: 53
  },
  figmaUnknownTimeCheck: {
    position: "absolute",
    right: 18,
    top: 37
  },
  figmaBeforeAfterPanel: {
    backgroundColor: "rgba(18, 20, 26, 0.78)",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    position: "absolute"
  },
  figmaBeforeAfterTitle: {
    color: "#F7F5EF",
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    includeFontPadding: false,
    letterSpacing: 0,
    left: 20,
    lineHeight: 24,
    position: "absolute",
    top: 24
  },
  figmaBeforeAfterTitleHighlight: {
    color: "#F7F5EF"
  },
  figmaBeforeAfterRow: {
    height: 32,
    left: 0,
    position: "absolute",
    width: "100%"
  },
  figmaBeforeAfterMark: {
    color: "#F7F5EF",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    includeFontPadding: false,
    lineHeight: 16,
    position: "absolute",
    textAlign: "center",
    width: 14
  },
  figmaBeforeAfterMarkHighlight: {
    color: "#F7F5EF",
    fontSize: 14
  },
  figmaBeforeAfterCopy: {
    color: "#F7F5EF",
    fontFamily: "Inter_500Medium",
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 15,
    position: "absolute"
  },
  figmaAccountInput: {
    color: "#111111",
    fontFamily: "Newsreader_500Medium",
    fontSize: 20,
    height: 34,
    includeFontPadding: false,
    left: 32,
    letterSpacing: 0,
    lineHeight: 24,
    padding: 0,
    position: "absolute",
    top: 341,
    width: 270
  },
  figmaAccountInputText: {
    color: "#111111",
    fontFamily: "Newsreader_500Medium",
    fontSize: 20,
    height: 34,
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 24,
    padding: 0,
    width: 270
  },
  figmaAccountAvatar: {
    backgroundColor: "rgba(255, 252, 246, 0.82)",
    borderColor: "rgba(196, 106, 58, 0.32)",
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    left: 304,
    overflow: "hidden",
    position: "absolute",
    top: 318,
    width: 56
  },
  figmaAccountAvatarFallback: {
    color: "#C46A3A",
    fontFamily: "Newsreader_500Medium",
    fontSize: 25,
    includeFontPadding: false,
    lineHeight: 29,
    textAlign: "center"
  },
  figmaSocialButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: "#111111",
    borderRadius: 0,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    left: 32,
    position: "absolute",
    width: 329
  },
  figmaSocialButtonText: {
    color: "#111111",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 16
  },
  figmaPaymentScrollContent: {
    height: 1180,
    width: FIGMA_CANVAS_WIDTH
  },
  figmaPaymentContent: {
    height: 1180,
    overflow: "hidden",
    position: "relative",
    width: FIGMA_CANVAS_WIDTH
  },
  figmaPaymentBg: {
    height: 1180,
    left: 0,
    position: "absolute",
    top: 0,
    width: FIGMA_CANVAS_WIDTH
  },
  figmaPaymentPlans: {
    backgroundColor: "rgba(13, 14, 18, 0.7)",
    borderColor: "rgba(247, 245, 239, 0.14)",
    borderRadius: 10,
    borderWidth: 1,
    height: 174,
    left: 24,
    overflow: "hidden",
    position: "absolute",
    top: 384,
    width: 345
  },
  figmaPaymentPlusBadge: {
    borderColor: "#C46A3A",
    borderRadius: 4,
    borderWidth: 1,
    height: 20,
    left: 116,
    position: "absolute",
    top: 139,
    width: 38
  },
  figmaPaymentPlusText: {
    color: "#F2D7C7",
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    includeFontPadding: false,
    lineHeight: 11,
    textAlign: "center"
  },
  figmaPaymentPlanRow: {
    borderRadius: 8,
    left: 0,
    position: "absolute",
    width: 345
  },
  figmaPaymentRadio: {
    alignItems: "center",
    borderColor: "rgba(247, 245, 239, 0.5)",
    borderWidth: 1,
    justifyContent: "center",
    position: "absolute",
  },
  figmaPaymentRadioSelected: {
    borderColor: "#C46A3A"
  },
  figmaPaymentRadioDot: {
    backgroundColor: "#C46A3A",
    borderRadius: 4,
    height: 8,
    width: 8
  },
  figmaPaymentPlanLabel: {
    color: "#F7F5EF",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    includeFontPadding: false,
    left: 54,
    lineHeight: 20,
    position: "absolute",
    top: 16
  },
  figmaPaymentPlanCaption: {
    color: "rgba(247, 245, 239, 0.58)",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    includeFontPadding: false,
    left: 54,
    lineHeight: 15,
    position: "absolute",
    top: 40
  },
  figmaPaymentBadge: {
    backgroundColor: "transparent",
    borderColor: "#C46A3A",
    borderRadius: 4,
    borderWidth: 1,
    color: "#F5E8D8",
    fontFamily: "Inter_700Bold",
    fontSize: 8.5,
    height: 18,
    includeFontPadding: false,
    left: 150,
    lineHeight: 11,
    overflow: "hidden",
    paddingTop: 4,
    position: "absolute",
    textAlign: "center",
    top: 20,
    width: 86
  },
  figmaPaymentPlanPrice: {
    color: "#F7F5EF",
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    includeFontPadding: false,
    lineHeight: 22,
    position: "absolute",
    right: 22,
    textAlign: "right",
    top: 15,
    width: 62
  },
  figmaPaymentPlanSubprice: {
    color: "rgba(247, 245, 239, 0.58)",
    fontFamily: "Inter_500Medium",
    fontSize: 10.5,
    includeFontPadding: false,
    lineHeight: 15,
    position: "absolute",
    right: 22,
    textAlign: "right",
    top: 40,
    width: 98
  },
  figmaUnlockPanel: {
    backgroundColor: "rgba(14, 16, 20, 0.58)",
    borderColor: "rgba(240, 208, 180, 0.16)",
    borderRadius: 10,
    borderWidth: 1,
    boxShadow: "0 18px 32px rgba(0, 0, 0, 0.18)",
    height: 178,
    left: 23,
    overflow: "hidden",
    position: "absolute",
    top: 585,
    width: 345
  },
  figmaPanelTitle: {
    color: "#F7F5EF",
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    includeFontPadding: false,
    lineHeight: 22,
    left: 23,
    position: "absolute",
    top: 21,
    width: 300
  },
  figmaPaymentBenefitChip: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(243, 230, 214, 0.14)",
    borderRadius: 6,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    position: "absolute"
  },
  figmaPaymentBenefitText: {
    color: "#E8DDD1",
    fontFamily: "Inter_500Medium",
    includeFontPadding: false,
    letterSpacing: 0,
    textAlign: "center"
  },
  figmaHowPanel: {
    left: 31,
    minHeight: 240,
    position: "absolute",
    top: 797,
    width: 329
  },
  figmaHowPanelTitle: {
    color: "#F7F5EF",
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    includeFontPadding: false,
    lineHeight: 26,
    width: 329
  },
  figmaPaymentStep: {
    minHeight: 52,
    left: 0,
    position: "absolute",
    width: 329
  },
  figmaPaymentStepIndex: {
    backgroundColor: "transparent",
    borderColor: "#C46A3A",
    borderRadius: 9.5,
    borderWidth: 1,
    color: "#C46A3A",
    fontFamily: "Inter_700Bold",
    fontSize: 8.5,
    height: 19,
    includeFontPadding: false,
    left: 0,
    lineHeight: 10,
    overflow: "hidden",
    paddingTop: 4,
    position: "absolute",
    textAlign: "center",
    top: 4,
    width: 19
  },
  figmaPaymentStepTitle: {
    color: "#F7F5EF",
    fontFamily: "Inter_700Bold",
    fontSize: 14.5,
    includeFontPadding: false,
    left: 36,
    lineHeight: 18,
    position: "absolute",
    top: 0,
    width: 260
  },
  figmaPaymentStepBody: {
    color: "rgba(247, 245, 239, 0.6)",
    fontFamily: "Inter_500Medium",
    fontSize: 11.5,
    includeFontPadding: false,
    left: 36,
    lineHeight: 15,
    position: "absolute",
    top: 24,
    width: 264
  },
  backgroundFill: {
    flex: 1
  },
  backgroundImage: {
    opacity: 1
  },
  shellBase: {
    flex: 1
  },
  shellDark: {
    backgroundColor: orbitaColors.charcoal
  },
  shellLight: {
    backgroundColor: orbitaColors.warmBg
  },
  keyboardRoot: {
    flex: 1
  },
  safeArea: {
    flex: 1
  },
  content: {
    flex: 1,
    gap: 24,
    paddingHorizontal: 22,
    paddingTop: 16
  },
  scrollContent: {
    gap: 22,
    paddingBottom: 26,
    paddingHorizontal: 22,
    paddingTop: 18
  },
  footer: {
    paddingBottom: 14,
    paddingHorizontal: 22,
    paddingTop: 10
  },
  splashPressable: {
    flex: 1
  },
  splashContent: {
    alignItems: "center",
    flex: 1,
    gap: 26,
    justifyContent: "center"
  },
  splashCopy: {
    alignItems: "center",
    gap: 8
  },
  brandTitle: {
    color: orbitaColors.bone,
    fontSize: 46,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 52
  },
  brandSubtitle: {
    color: "rgba(241, 231, 218, 0.78)",
    fontSize: 17,
    letterSpacing: 0
  },
  orbitaMark: {
    alignItems: "center",
    justifyContent: "center"
  },
  orbitaCore: {
    backgroundColor: "rgba(6, 7, 10, 0.9)",
    borderColor: "rgba(214, 154, 106, 0.7)",
    borderWidth: 1,
    position: "absolute"
  },
  orbitaOrbit: {
    borderColor: orbitaColors.copperSoft,
    borderWidth: 2,
    position: "absolute",
    transform: [{ rotate: "-18deg" }]
  },
  orbitaDot: {
    backgroundColor: orbitaColors.copperSoft,
    position: "absolute"
  },
  progressWrap: {
    gap: 8
  },
  progressMeta: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0
  },
  progressLabelDark: {
    color: orbitaColors.copperSoft
  },
  progressLabelLight: {
    color: orbitaColors.copper
  },
  progressCount: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0
  },
  progressCountDark: {
    color: "rgba(241, 231, 218, 0.7)"
  },
  progressCountLight: {
    color: orbitaColors.muted
  },
  progressTrack: {
    borderRadius: 999,
    height: 4,
    overflow: "hidden"
  },
  progressTrackDark: {
    backgroundColor: "rgba(241, 231, 218, 0.16)"
  },
  progressTrackLight: {
    backgroundColor: "rgba(17, 17, 17, 0.12)"
  },
  progressFill: {
    backgroundColor: orbitaColors.copper,
    height: 4
  },
  navFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  backButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  backButtonDark: {
    backgroundColor: "rgba(241, 231, 218, 0.1)",
    borderColor: "rgba(241, 231, 218, 0.15)",
    borderWidth: 1
  },
  backButtonLight: {
    backgroundColor: "rgba(255, 255, 255, 0.68)",
    borderColor: orbitaColors.line,
    borderWidth: 1
  },
  primaryCta: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 16
  },
  primaryCtaDark: {
    backgroundColor: orbitaColors.bone
  },
  primaryCtaLight: {
    backgroundColor: orbitaColors.charcoal
  },
  primaryCtaText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0
  },
  primaryCtaTextDark: {
    color: orbitaColors.ink
  },
  primaryCtaTextLight: {
    color: orbitaColors.bone
  },
  disabled: {
    opacity: 0.42
  },
  pressed: {
    transform: [{ scale: 0.99 }]
  },
  heroStack: {
    flex: 1,
    gap: 16,
    justifyContent: "center",
    paddingTop: 20
  },
  headerBlock: {
    gap: 12
  },
  darkTitle: {
    color: orbitaColors.bone,
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 43
  },
  lightTitle: {
    color: orbitaColors.ink,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 41
  },
  darkBody: {
    color: "rgba(241, 231, 218, 0.82)",
    fontSize: 17,
    lineHeight: 25
  },
  lightBody: {
    color: "rgba(17, 17, 17, 0.68)",
    fontSize: 17,
    lineHeight: 25
  },
  darkNote: {
    color: "rgba(241, 231, 218, 0.72)",
    fontSize: 14,
    lineHeight: 21
  },
  lightNote: {
    color: orbitaColors.muted,
    fontSize: 14,
    lineHeight: 21
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  darkTile: {
    backgroundColor: "rgba(241, 231, 218, 0.1)",
    borderColor: "rgba(214, 154, 106, 0.24)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    minHeight: 98,
    padding: 14,
    width: "48%"
  },
  darkTileText: {
    color: orbitaColors.bone,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 20
  },
  optionStack: {
    gap: 10
  },
  optionButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 58,
    paddingHorizontal: 16
  },
  optionButtonDark: {
    backgroundColor: "rgba(241, 231, 218, 0.08)",
    borderColor: "rgba(241, 231, 218, 0.12)"
  },
  optionButtonLight: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderColor: orbitaColors.line
  },
  optionButtonSelectedDark: {
    borderColor: orbitaColors.copper,
    borderWidth: 1.5
  },
  optionButtonSelectedLight: {
    borderColor: orbitaColors.copper,
    borderWidth: 1.5
  },
  optionTextDark: {
    color: orbitaColors.bone,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0
  },
  optionTextLight: {
    color: orbitaColors.ink,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0
  },
  phoneWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center"
  },
  phoneFrame: {
    backgroundColor: "rgba(13, 14, 18, 0.82)",
    borderColor: "rgba(214, 154, 106, 0.35)",
    borderRadius: 30,
    borderWidth: 1,
    gap: 12,
    minHeight: 330,
    overflow: "hidden",
    padding: 24,
    width: 224
  },
  phoneOrb: {
    alignSelf: "center",
    backgroundColor: "rgba(196, 106, 58, 0.18)",
    borderColor: "rgba(214, 154, 106, 0.55)",
    borderRadius: 52,
    borderWidth: 1,
    height: 104,
    marginBottom: 12,
    width: 104
  },
  phoneOrbit: {
    borderColor: "rgba(214, 154, 106, 0.45)",
    borderRadius: 52,
    borderWidth: 1,
    height: 54,
    left: 42,
    position: "absolute",
    top: 66,
    transform: [{ rotate: "-18deg" }],
    width: 142
  },
  phoneKicker: {
    color: orbitaColors.copperSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  phoneTitle: {
    color: orbitaColors.bone,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 27
  },
  phoneBody: {
    color: "rgba(241, 231, 218, 0.72)",
    fontSize: 14,
    lineHeight: 20
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  darkBadge: {
    backgroundColor: "rgba(241, 231, 218, 0.1)",
    borderColor: "rgba(241, 231, 218, 0.14)",
    borderRadius: 8,
    borderWidth: 1,
    color: orbitaColors.bone,
    fontSize: 13,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  pickerDeck: {
    flexDirection: "row",
    gap: 10
  },
  wheelPicker: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderColor: orbitaColors.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 178,
    paddingHorizontal: 8,
    paddingVertical: 12
  },
  wheelPickerWide: {
    flex: 1.25
  },
  wheelLabel: {
    color: orbitaColors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 8
  },
  wheelControl: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: "100%"
  },
  wheelValue: {
    color: orbitaColors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 30,
    maxWidth: "100%",
    paddingVertical: 10,
    textAlign: "center"
  },
  privacyLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8
  },
  privacyTextDark: {
    color: "rgba(241, 231, 218, 0.68)",
    flex: 1,
    fontSize: 12,
    lineHeight: 18
  },
  privacyTextLight: {
    color: orbitaColors.muted,
    flex: 1,
    fontSize: 12,
    lineHeight: 18
  },
  centeredVisualStack: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center"
  },
  integratedOrb: {
    borderRadius: 88,
    height: 176,
    opacity: 0.82,
    width: 176
  },
  metricPanelDark: {
    backgroundColor: "rgba(13, 14, 18, 0.68)",
    borderColor: "rgba(214, 154, 106, 0.24)",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden"
  },
  metricRow: {
    alignItems: "center",
    borderBottomColor: "rgba(241, 231, 218, 0.12)",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: 16
  },
  metricRowLight: {
    borderBottomColor: "rgba(17, 17, 17, 0.08)"
  },
  metricLabelDark: {
    color: orbitaColors.copperSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  metricLabelLight: {
    color: orbitaColors.copper,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  metricValueDark: {
    color: orbitaColors.bone,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "right"
  },
  metricValueLight: {
    color: orbitaColors.ink,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "right"
  },
  inlineButtonDark: {
    alignSelf: "flex-start",
    borderBottomColor: orbitaColors.copperSoft,
    borderBottomWidth: 1,
    paddingBottom: 3
  },
  inlineButtonDarkText: {
    color: orbitaColors.copperSoft,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0
  },
  fieldBlock: {
    gap: 9
  },
  fieldLabel: {
    color: orbitaColors.copper,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  textInput: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderColor: orbitaColors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: orbitaColors.ink,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: 14
  },
  searchResults: {
    gap: 8
  },
  searchResultRow: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.66)",
    borderColor: orbitaColors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 13
  },
  searchResultRowSelected: {
    borderColor: orbitaColors.copper,
    borderWidth: 1.5
  },
  searchResultText: {
    color: orbitaColors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0
  },
  horizonCopy: {
    flex: 1,
    gap: 16,
    justifyContent: "flex-end",
    paddingBottom: 36
  },
  timePickerPanel: {
    flexDirection: "row",
    gap: 10
  },
  unknownTimeButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.68)",
    borderColor: orbitaColors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 72,
    paddingHorizontal: 15
  },
  unknownTimeButtonSelected: {
    borderColor: orbitaColors.copper,
    borderWidth: 1.5
  },
  unknownTimeTitle: {
    color: orbitaColors.ink,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0
  },
  unknownTimeBody: {
    color: orbitaColors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2
  },
  timeSelectedBlock: {
    flex: 1,
    gap: 16,
    justifyContent: "center"
  },
  chartDiagram: {
    alignSelf: "center",
    borderRadius: 120,
    height: 236,
    opacity: 0.78,
    width: 236
  },
  summaryTable: {
    backgroundColor: "rgba(255, 255, 255, 0.66)",
    borderColor: orbitaColors.line,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden"
  },
  progressPanel: {
    backgroundColor: "rgba(13, 14, 18, 0.72)",
    borderColor: "rgba(214, 154, 106, 0.22)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 18,
    padding: 18
  },
  loadingRow: {
    gap: 9
  },
  loadingTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  loadingLabel: {
    color: orbitaColors.bone,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0
  },
  loadingValue: {
    color: orbitaColors.copperSoft,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0
  },
  loadingTrack: {
    backgroundColor: "rgba(241, 231, 218, 0.12)",
    borderRadius: 999,
    height: 6,
    overflow: "hidden"
  },
  loadingFill: {
    backgroundColor: orbitaColors.copper,
    height: 6
  },
  beforeAfterGrid: {
    flexDirection: "row",
    gap: 12
  },
  beforeAfterColumn: {
    backgroundColor: "rgba(241, 231, 218, 0.08)",
    borderColor: "rgba(241, 231, 218, 0.14)",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 11,
    overflow: "hidden",
    padding: 12
  },
  beforeAfterImage: {
    alignSelf: "center",
    borderRadius: 42,
    height: 84,
    opacity: 0.72,
    width: 84
  },
  beforeAfterTitle: {
    color: orbitaColors.copperSoft,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0
  },
  beforeAfterItem: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 7
  },
  bulletDot: {
    backgroundColor: orbitaColors.copper,
    borderRadius: 3,
    height: 6,
    marginTop: 7,
    width: 6
  },
  beforeAfterText: {
    color: "rgba(241, 231, 218, 0.78)",
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  },
  separatorText: {
    color: orbitaColors.muted,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center"
  },
  socialStack: {
    gap: 10
  },
  socialButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderColor: orbitaColors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 52
  },
  socialButtonText: {
    color: orbitaColors.ink,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0
  },
  paymentTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  plusBrand: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  plusBrandText: {
    color: orbitaColors.bone,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0
  },
  plusBadge: {
    backgroundColor: "rgba(196, 106, 58, 0.22)",
    borderColor: "rgba(214, 154, 106, 0.35)",
    borderRadius: 6,
    borderWidth: 1,
    color: orbitaColors.copperSoft,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  restoreText: {
    color: "rgba(241, 231, 218, 0.68)",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0
  },
  paymentHero: {
    gap: 12,
    paddingTop: 92
  },
  paymentTitle: {
    color: orbitaColors.bone,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 45
  },
  paymentBody: {
    color: "rgba(241, 231, 218, 0.82)",
    fontSize: 17,
    lineHeight: 25
  },
  planSelector: {
    gap: 10
  },
  planRow: {
    alignItems: "center",
    backgroundColor: "rgba(13, 14, 18, 0.72)",
    borderColor: "rgba(241, 231, 218, 0.14)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 82,
    padding: 14
  },
  planRowSelected: {
    borderColor: orbitaColors.copper,
    borderWidth: 1.5
  },
  planLeft: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 11
  },
  radio: {
    alignItems: "center",
    borderColor: "rgba(241, 231, 218, 0.42)",
    borderRadius: 9,
    borderWidth: 1,
    height: 18,
    justifyContent: "center",
    width: 18
  },
  radioSelected: {
    borderColor: orbitaColors.copperSoft
  },
  radioDot: {
    backgroundColor: orbitaColors.copperSoft,
    borderRadius: 5,
    height: 10,
    width: 10
  },
  planLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  planLabel: {
    color: orbitaColors.bone,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0
  },
  planBadge: {
    color: orbitaColors.copperSoft,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0
  },
  planCaption: {
    color: "rgba(241, 231, 218, 0.58)",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3
  },
  planPriceWrap: {
    alignItems: "flex-end"
  },
  planPrice: {
    color: orbitaColors.bone,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: 0
  },
  planSubprice: {
    color: "rgba(241, 231, 218, 0.58)",
    fontSize: 12
  },
  paymentLegal: {
    color: "rgba(241, 231, 218, 0.64)",
    fontSize: 12,
    lineHeight: 18
  },
  unlockPanel: {
    backgroundColor: "rgba(13, 14, 18, 0.72)",
    borderColor: "rgba(214, 154, 106, 0.18)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 13,
    padding: 16
  },
  panelTitle: {
    color: orbitaColors.bone,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 24
  },
  benefitRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  benefitText: {
    color: "rgba(241, 231, 218, 0.8)",
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  stepsPanel: {
    backgroundColor: "rgba(13, 14, 18, 0.72)",
    borderColor: "rgba(214, 154, 106, 0.18)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16
  },
  stepRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12
  },
  stepIndex: {
    color: orbitaColors.copperSoft,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    paddingTop: 3,
    width: 28
  },
  stepCopy: {
    flex: 1,
    gap: 3
  },
  stepTitle: {
    color: orbitaColors.bone,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0
  },
  stepBody: {
    color: "rgba(241, 231, 218, 0.68)",
    fontSize: 13,
    lineHeight: 19
  }
});
