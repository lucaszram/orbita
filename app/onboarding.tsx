import { ComponentProps, ReactNode, useEffect, useMemo, useState } from "react";
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
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Topic } from "@/domain/types";
import { formatSign, getZodiacSign } from "@/domain/zodiac";
import { useAppState } from "@/hooks/useAppState";

const SCREEN_COUNT = 15;
const FIGMA_CANVAS_WIDTH = 393;
const FIGMA_CANVAS_HEIGHT = 852;

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
  dailyTextureB: require("../assets/orbita/core/orbita_daily_texture_b.png"),
  birthChartDiagram: require("../assets/orbita/core/orbita_carta_natal_diagram_a.png"),
  sunEmblem: require("../assets/orbita/higgsfield/archive-10/selected/planetary-symbols/archive10_planet_sun_copper_corona__idx25__hf_20260703_003922_ccda12d2-b2c4-49b7-8d8b-98e39f7ca57b.png"),
  ascendantHorizon: require("../assets/orbita/higgsfield/archive-10/selected/planetary-symbols/archive10_point_ascendant_horizon__idx27__hf_20260703_003935_22932911-5789-4448-86d9-01581b18136e.png"),
  orbitalChart: require("../assets/orbita/higgsfield/archive-10/selected/backgrounds/archive10_chart_orbital_ring_system__idx15__hf_20260703_003620_1a5dde8e-83bb-4467-92aa-05390062a68b.png"),
  transits: require("../assets/orbita/higgsfield/archive-10/selected/backgrounds/archive10_transits_dynamic_orbital_body__idx30__hf_20260703_004042_c574180f-254d-49ef-9530-8bfcddc126f2.png"),
  backplate: require("../assets/orbita/higgsfield/archive-10/selected/backgrounds/archive10_ringed_planet_orbital_backplate__idx34__hf_20260703_004145_9eff4a2f-00b4-4198-9f34-61c94e0a2e50.png"),
  figmaBg01: require("../assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_01_background__152-2.png"),
  figmaBg02: require("../assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_02_background__152-4.png"),
  figmaBg03: require("../assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_03_background__152-6.png"),
  figmaBg04: require("../assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_04_background__152-8.png"),
  beforeSymbol: require("../assets/orbita/higgsfield/archive-7/selected/onboarding/13-before-after/onboarding_13_before_after__idx53__hf_20260702_230421_2a16c0db-f3c2-453e-b3f5-ea07317ed327.png"),
  afterSymbol: require("../assets/orbita/higgsfield/archive-7/selected/onboarding/13-before-after/onboarding_13_before_after__idx81__hf_20260702_231014_3cf0aab5-0749-4be2-8ac3-b114028201b3.png"),
  benefitLunar: require("../assets/orbita/figma/onboarding-v44/02-benefit-slots/figma_onboarding_02_slot_lunar__151-54.png"),
  benefitGuide: require("../assets/orbita/figma/onboarding-v44/02-benefit-slots/figma_onboarding_02_slot_guia__151-55.png"),
  benefitPractice: require("../assets/orbita/figma/onboarding-v44/02-benefit-slots/figma_onboarding_02_slot_practica__151-56.png"),
  benefitDecisions: require("../assets/orbita/figma/onboarding-v44/02-benefit-slots/figma_onboarding_02_slot_decisiones__151-57.png"),
  identifyBg: require("../assets/orbita/higgsfield/archive-7/selected/onboarding/03-identify-backgrounds/onboarding_03_identify_background__idx22__hf_20260702_225600_28fa337f-fc29-450f-90bb-45d1d3fbab8e.png"),
  dailyBackplate: require("../assets/orbita/higgsfield/archive-7/selected/onboarding/04-daily-guidance-backplates/onboarding_04_daily_guidance_backplate__idx66__hf_20260702_230651_78bd4533-f37b-444b-85c1-ec79aae4180a.png"),
  dailyBackplateFigma: require("../assets/orbita/higgsfield/archive-7/selected/onboarding/04-daily-guidance-backplates/onboarding_04_daily_guidance_backplate__idx65__hf_20260702_230648_d1cfc679-53d3-4486-836e-b10fef818d79.png"),
  paymentBg: require("../assets/orbita/higgsfield/archive-7/selected/onboarding/15-payment/onboarding_15_payment__idx62__hf_20260702_230605_4349256f-bc12-482c-b48e-863d13ca7b0f.png")
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
  if (value < min) {
    return max;
  }

  if (value > max) {
    return min;
  }

  return value;
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

export default function OnboardingScreen() {
  const { createProfile } = useAppState();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Newsreader_500Medium
  });
  const params = useLocalSearchParams<{ debugStep?: string }>();
  const debugStep = typeof params.debugStep === "string" ? Number(params.debugStep) : undefined;
  const [step, setStep] = useState(0);
  const [identity, setIdentity] = useState<Identity | undefined>("ella");
  const [birthDate, setBirthDate] = useState<BirthDateParts>({});
  const [birthPlaceSearch, setBirthPlaceSearch] = useState("");
  const [birthPlace, setBirthPlace] = useState<BirthPlace | undefined>();
  const [birthTime, setBirthTime] = useState<BirthTime>({ hour: 8, minute: 30, period: "AM" });
  const [birthTimeUnknown, setBirthTimeUnknown] = useState(false);
  const [email, setEmail] = useState("");
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
    if (!__DEV__ || debugStep === undefined || Number.isNaN(debugStep)) {
      return;
    }

    setStep(clamp(Math.trunc(debugStep), 0, SCREEN_COUNT - 1));
  }, [debugStep]);

  useEffect(() => {
    if (step !== 11) {
      return;
    }

    setChartProgress(12);
    const timer = setInterval(() => {
      setChartProgress((current) => {
        if (current >= 59) {
          clearInterval(timer);
          return 59;
        }

        return Math.min(59, current + 7);
      });
    }, 220);

    return () => clearInterval(timer);
  }, [step]);

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

  function updateBirthTime(part: keyof BirthTime, delta: number) {
    setBirthTimeUnknown(false);
    setBirthTime((current) => {
      if (part === "hour") {
        return { ...current, hour: wrap(current.hour + delta, 1, 12) };
      }

      if (part === "minute") {
        return { ...current, minute: wrap(current.minute + delta * 5, 0, 55) };
      }

      return { ...current, period: current.period === "AM" ? "PM" : "AM" };
    });
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
      <OnboardingShell background={onboardingAssets.dailyTextureB} footer={footer} tone="light">
        <OnboardingProgress step={step} tone="light" />
        <HeaderBlock body="Tu fecha ubica el Sol en tu carta." title="¿Cuándo naciste?" tone="light" />
        <View style={styles.pickerDeck}>
          <WheelPicker
            label="Día"
            onDown={() => updateBirthDate("day", -1)}
            onUp={() => updateBirthDate("day", 1)}
            value={birthDate.day ? String(birthDate.day) : "Día"}
          />
          <WheelPicker
            label="Mes"
            onDown={() => updateBirthDate("month", -1)}
            onUp={() => updateBirthDate("month", 1)}
            value={birthDate.month ? monthName(birthDate.month, "short") : "Mes"}
          />
          <WheelPicker
            label="Año"
            onDown={() => updateBirthDate("year", -1)}
            onUp={() => updateBirthDate("year", 1)}
            value={birthDate.year ? String(birthDate.year) : "Año"}
            wide
          />
        </View>
        <PrivacyLine text="La usamos para calcular tu carta natal. Nunca vendemos ni compartimos tus datos." tone="light" />
      </OnboardingShell>
    );
  }

  if (step === 5) {
    return (
      <OnboardingShell background={onboardingAssets.sunEmblem} footer={footer} tone="dark">
        <OnboardingProgress step={step} tone="dark" />
        <View style={styles.centeredVisualStack}>
          <Image resizeMode="cover" source={onboardingAssets.sunEmblem} style={styles.integratedOrb} />
          <Text style={styles.darkTitle}>Sol en {zodiacLabel}.</Text>
          <Text style={styles.darkBody}>{formatLongDate(birthDate)}</Text>
        </View>
        <View style={styles.metricPanelDark}>
          <MetricRow label="SOL" value={zodiacLabel} />
          <MetricRow label="ELEMENTO" value={elementLabel} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => setStep(4)} style={styles.inlineButtonDark}>
          <Text style={styles.inlineButtonDarkText}>Cambiar fecha</Text>
        </Pressable>
        <PrivacyLine text="La usamos para calcular tu carta natal. Nunca vendemos ni compartimos tus datos." tone="dark" />
      </OnboardingShell>
    );
  }

  if (step === 6) {
    return (
      <OnboardingShell background={onboardingAssets.dailyTextureB} footer={footer} keyboard tone="light">
        <OnboardingProgress step={step} tone="light" />
        <HeaderBlock body="La ciudad ajusta el horizonte de tu carta." title="¿Dónde naciste?" tone="light" />
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>CIUDAD</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={(value) => {
              setBirthPlaceSearch(value);
              setBirthPlace(undefined);
            }}
            placeholder="Buenos"
            placeholderTextColor="rgba(17, 17, 17, 0.4)"
            style={styles.textInput}
            value={birthPlaceSearch}
          />
        </View>
        <View style={styles.searchResults}>
          {getFilteredPlaces(birthPlaceSearch).map((place) => (
            <Pressable
              accessibilityRole="button"
              key={place.label}
              onPress={() => {
                setBirthPlace(place);
                setBirthPlaceSearch(place.label);
              }}
              style={[styles.searchResultRow, birthPlace?.label === place.label && styles.searchResultRowSelected]}
            >
              <Ionicons color={orbitaColors.copper} name="location-outline" size={18} />
              <Text style={styles.searchResultText}>{place.label}</Text>
            </Pressable>
          ))}
        </View>
        <PrivacyLine text="La usamos para precisar tu carta natal. Nunca vendemos ni compartimos tus datos." tone="light" />
      </OnboardingShell>
    );
  }

  if (step === 7) {
    return (
      <OnboardingShell background={onboardingAssets.ascendantHorizon} footer={footer} tone="dark">
        <OnboardingProgress step={step} tone="dark" />
        <View style={styles.horizonCopy}>
          <Text style={styles.darkTitle}>Horizonte definido.</Text>
          <Text style={styles.darkBody}>{birthPlace?.label ?? "Buenos Aires, Argentina"}</Text>
          <Text style={styles.darkNote}>El lugar ayuda a calcular tu ascendente y las casas.</Text>
        </View>
        <PrivacyLine text="La usamos para precisar tu carta natal. Nunca vendemos ni compartimos tus datos." tone="dark" />
      </OnboardingShell>
    );
  }

  if (step === 8) {
    return (
      <OnboardingShell background={onboardingAssets.dailyTextureB} footer={footer} tone="light">
        <OnboardingProgress step={step} tone="light" />
        <HeaderBlock body="La hora afina tu ascendente y tus casas." title="¿A qué hora naciste?" tone="light" />
        <View style={styles.timePickerPanel}>
          <WheelPicker
            label="Hora"
            onDown={() => updateBirthTime("hour", -1)}
            onUp={() => updateBirthTime("hour", 1)}
            value={pad2(birthTime.hour)}
          />
          <WheelPicker
            label="Min"
            onDown={() => updateBirthTime("minute", -1)}
            onUp={() => updateBirthTime("minute", 1)}
            value={pad2(birthTime.minute)}
          />
          <WheelPicker
            label="Modo"
            onDown={() => updateBirthTime("period", -1)}
            onUp={() => updateBirthTime("period", 1)}
            value={birthTime.period}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setBirthTimeUnknown(true)}
          style={[styles.unknownTimeButton, birthTimeUnknown && styles.unknownTimeButtonSelected]}
        >
          <View>
            <Text style={styles.unknownTimeTitle}>No sé la hora</Text>
            <Text style={styles.unknownTimeBody}>Usamos una carta aproximada.</Text>
          </View>
          {birthTimeUnknown ? <Ionicons color={orbitaColors.copper} name="checkmark-circle" size={22} /> : null}
        </Pressable>
        <Text style={styles.lightNote}>Podés continuar sin hora exacta. La lectura será menos precisa.</Text>
      </OnboardingShell>
    );
  }

  if (step === 9) {
    return (
      <OnboardingShell background={onboardingAssets.orbitalChart} footer={footer} tone="dark">
        <OnboardingProgress step={step} tone="dark" />
        <View style={styles.timeSelectedBlock}>
          <Text style={styles.darkTitle}>{birthTimeUnknown ? "Carta aproximada." : "Ascendente afinado."}</Text>
          <Text style={styles.darkBody}>{birthTimeUnknown ? "Seguimos sin hora exacta." : formatBirthTime(birthTime)}</Text>
          <Text style={styles.darkNote}>
            {birthTimeUnknown ? "Podés volver atrás si encontrás el dato." : "La hora ordena las casas de tu carta."}
          </Text>
        </View>
        <View style={styles.metricPanelDark}>
          <MetricRow label="HORA" value={timeLabel} />
        </View>
      </OnboardingShell>
    );
  }

  if (step === 10) {
    return (
      <OnboardingShell background={onboardingAssets.birthChartDiagram} footer={footer} tone="light">
        <OnboardingProgress step={step} tone="light" />
        <HeaderBlock title="Estos son tus puntos de partida." tone="light" />
        <Image resizeMode="cover" source={onboardingAssets.birthChartDiagram} style={styles.chartDiagram} />
        <View style={styles.summaryTable}>
          <MetricRow label="FECHA" tone="light" value={formatShortDate(birthDate)} />
          <MetricRow label="LUGAR" tone="light" value={birthPlace?.city ?? "Buenos Aires"} />
          <MetricRow label="HORA" tone="light" value={birthTimeUnknown ? "Aproximada" : formatBirthTime(birthTime)} />
        </View>
        <Text style={styles.lightNote}>Con esto calculamos tu Sol, ascendente y casas.</Text>
      </OnboardingShell>
    );
  }

  if (step === 11) {
    return (
      <OnboardingShell background={onboardingAssets.transits} footer={footer} tone="dark">
        <OnboardingProgress step={step} tone="dark" />
        <HeaderBlock body="Carta natal en proceso." title="Calculando tu cielo..." tone="dark" />
        <View style={styles.progressPanel}>
          <ProgressRow label="Carta natal" value={chartProgress} />
          <ProgressRow label="Tránsitos del día" value={0} />
        </View>
        <Text style={styles.darkNote}>Usamos tus datos para ordenar tus posiciones.</Text>
      </OnboardingShell>
    );
  }

  if (step === 12) {
    return (
      <OnboardingShell background={onboardingAssets.afterSymbol} footer={footer} scroll tone="dark">
        <OnboardingProgress step={step} tone="dark" />
        <HeaderBlock
          body="Una guía diaria puede cambiar cómo mirás tu día."
          title="Antes y después de Órbita"
          tone="dark"
        />
        <View style={styles.beforeAfterGrid}>
          <BeforeAfterColumn
            image={onboardingAssets.beforeSymbol}
            items={["Vivía en automático", "No sabía qué priorizar", "Dudaba de lo que quería", "Me sentía agotada", "Vínculos poco claros"]}
            title="Antes"
          />
          <BeforeAfterColumn
            image={onboardingAssets.afterSymbol}
            items={[
              "Con calma y confianza",
              "Conozco mis fortalezas y límites",
              "Centrada y enfocada en lo importante",
              "Confío más en mi intuición",
              "Me vinculo con más claridad"
            ]}
            title="Después"
          />
        </View>
        <Text style={styles.darkNote}>No resuelve por vos. Te devuelve contexto.</Text>
      </OnboardingShell>
    );
  }

  if (step === 13) {
    return (
      <OnboardingShell background={onboardingAssets.dailyTextureB} footer={footer} keyboard tone="light">
        <OnboardingProgress step={step} tone="light" />
        <HeaderBlock
          body="Tu historial, tus lecturas y tus tránsitos quedan en tu cuenta."
          title="Guardá tu carta."
          tone="light"
        />
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <TextInput
            autoCapitalize="none"
            inputMode="email"
            onChangeText={setEmail}
            placeholder="mica@email.com"
            placeholderTextColor="rgba(17, 17, 17, 0.4)"
            style={styles.textInput}
            value={email}
          />
        </View>
        <Text style={styles.separatorText}>O seguir con</Text>
        <View style={styles.socialStack}>
          <SocialButton icon="logo-apple" label="Continuar con Apple" />
          <SocialButton icon="logo-google" label="Continuar con Google" />
        </View>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell background={onboardingAssets.paymentBg} footer={footer} scroll tone="dark">
      <View style={styles.paymentTopBar}>
        <View style={styles.plusBrand}>
          <Text style={styles.plusBrandText}>Órbita</Text>
          <Text style={styles.plusBadge}>PLUS</Text>
        </View>
        <Text style={styles.restoreText}>Restaurar</Text>
      </View>
      <View style={styles.paymentHero}>
        <Text style={styles.paymentTitle}>Tu cielo, todos los días.</Text>
        <Text style={styles.paymentBody}>Carta natal, guía diaria y lecturas más profundas.</Text>
      </View>
      <PlanSelector selectedPlan={selectedPlan} onSelect={setSelectedPlan} />
      <Text style={styles.paymentLegal}>Cancelás cuando quieras. Entretenimiento y autoconocimiento.</Text>
      <View style={styles.unlockPanel}>
        <Text style={styles.panelTitle}>Todo lo que desbloqueás</Text>
        {["Carta natal completa", "Guía diaria personalizada", "Tránsitos en tu carta", "Preguntale a Órbita", "Sueños, vínculos y calendario"].map((benefit) => (
          <BenefitRow key={benefit} label={benefit} />
        ))}
      </View>
      <View style={styles.stepsPanel}>
        <Text style={styles.panelTitle}>Cómo te acompaña</Text>
        <StepRow index="01" title="Tu carta completa" body="Sol, Luna, ascendente, casas y aspectos en lenguaje claro." />
        <StepRow index="02" title="Tu día con contexto" body="Lecturas y tránsitos personalizados según tu mapa." />
        <StepRow index="03" title="Preguntas más profundas" body="Consultas, sueños y vínculos conectados con tu cielo." />
      </View>
    </OnboardingShell>
  );
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
        <FigmaImageFull opacity={1} source={onboardingAssets.figmaBg01} />
        <FigmaRect color="#08090B" h={852} opacity={0.56} w={393} x={0} y={0} />
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
      <FigmaImageFull opacity={1} source={onboardingAssets.figmaBg02} />
      <FigmaRect color="#0B0C10" h={852} opacity={0.56} w={393} x={0} y={0} />
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
      <FigmaImageFull opacity={1} source={onboardingAssets.figmaBg03} />
      <FigmaRect color="#0B0C10" h={852} opacity={0.66} w={393} x={0} y={0} />
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
      <FigmaIdentityOption label="Ella" onPress={() => onSelectIdentity("ella")} selected={identity === "ella"} y={282} />
      <FigmaIdentityOption label="Él" onPress={() => onSelectIdentity("el")} selected={identity === "el"} y={360} />
      <FigmaIdentityOption
        label="Prefiero no decirlo"
        onPress={() => onSelectIdentity("prefiero_no_decirlo")}
        selected={identity === "prefiero_no_decirlo"}
        y={438}
      />
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
      <FigmaImageFull opacity={1} source={onboardingAssets.figmaBg04} />
      <FigmaRect color="#0B0C10" h={852} opacity={0.45} w={393} x={0} y={0} />
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

function FigmaCanvas({ children }: { children: ReactNode }) {
  const { height, width } = useWindowDimensions();
  const scale = Math.min(width / FIGMA_CANVAS_WIDTH, height / FIGMA_CANVAS_HEIGHT);
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

function FigmaImageFull({ opacity, source }: { opacity: number; source: ImageSourcePropType }) {
  return <Image resizeMode="cover" source={source} style={[styles.figmaFullImage, { opacity }]} />;
}

function FigmaImageSlot({ h, source, w, x, y }: { h: number; source: ImageSourcePropType; w: number; x: number; y: number }) {
  return (
    <View style={[styles.figmaImageSlot, { borderRadius: 28, height: h, left: x, top: y, width: w }]}>
      <Image resizeMode="cover" source={source} style={styles.figmaImageSlotImage} />
    </View>
  );
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
  align?: "left" | "center";
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
  tone: "light";
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

function FigmaCTA({ h, label, onPress, y }: { h: number; label: string; onPress: () => void; y: number }) {
  const fill = h === 48 ? "#F5F3EE" : "#DCE8FF";

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.figmaCta, { backgroundColor: fill, borderRadius: h / 2, height: h, top: y }]}>
      <FigmaText align="center" color="#111111" family="Inter_700Bold" fontSize={h === 48 ? 15 : 16} lineHeight={18} text={label} w={329} x={0} y={h === 48 ? 15 : 19} />
    </Pressable>
  );
}

function FigmaBackChevron({ fontSize = 28, onPress, x, y }: { fontSize?: number; onPress: () => void; x: number; y: number }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.figmaBackHit, { left: x - 12, top: y - 10 }]}>
      <FigmaText align="center" color="#F7F5EF" family={fontSize > 28 ? "Inter_700Bold" : "Inter_400Regular"} fontSize={fontSize} lineHeight={fontSize === 30 ? 28 : 33} text="‹" w={24} x={12} y={10} />
    </Pressable>
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

function FigmaIdentityOption({ label, onPress, selected, y }: { label: string; onPress: () => void; selected: boolean; y: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.figmaIdentityOption,
        {
          backgroundColor: selected ? "#262730" : "#1E1F26",
          borderColor: selected ? "#C46A3A" : "#2A2B34",
          borderWidth: selected ? 1.5 : 1,
          top: y
        }
      ]}
    >
      <Text style={styles.figmaIdentityLabel}>{label}</Text>
      <View style={[styles.figmaRadio, { borderColor: selected ? "#C46A3A" : "#504E56" }]}>{selected ? <View style={styles.figmaRadioFill} /> : null}</View>
    </Pressable>
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
