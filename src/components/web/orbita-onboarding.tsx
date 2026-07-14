import { ComponentType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_400Regular, Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Check, Diamond, Heart, Moon, Orbit, Sparkles, Sun } from "lucide-react-native";
import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import {
  IDENTITY_OPTIONS,
  MONTHS_ES,
  ONBOARDING_STEPS,
  PLACE_SUGGESTIONS,
  PLAN_BENEFITS,
  PLANS,
  type Identity,
  type PlanId
} from "@/content/onboardingSteps";
import { formatSign, getZodiacSign } from "@/domain/zodiac";
import { appApi, proposedApi } from "@/services/appRefs";
import { publicLabApi } from "@/services/publicLabRefs";
import { type PlaceHit, searchPlaces } from "@/services/geocoding";
import { useOrbitaAuth } from "@/hooks/useOrbitaAuth";

const colors = {
  black: "#07080A",
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  boneDim: "rgba(244, 238, 228, 0.5)",
  line: "rgba(214, 154, 106, 0.26)",
  card: "rgba(12, 13, 17, 0.62)",
  cardSolid: "rgba(12, 13, 17, 0.82)",
  inputBg: "rgba(7,8,10,0.5)"
};

const BG: Record<string, ReturnType<typeof require>> = {
  intro: require("../../../assets/orbita/optimized/onboarding-v44/logo_orbe_idx08.jpg"),
  "promise-1": require("../../../assets/orbita/optimized/onboarding-v44/identify_bg_idx27.jpg"),
  identity: require("../../../assets/orbita/optimized/onboarding-v44/identify_bg_idx21.jpg"),
  "promise-2": require("../../../assets/orbita/optimized/onboarding-v44/daily_base_idx20.jpg"),
  date: require("../../../assets/orbita/optimized/onboarding-v44/birth_data_idx34.jpg"),
  place: require("../../../assets/orbita/optimized/onboarding-v44/ascendant_horizon_idx27.jpg"),
  time: require("../../../assets/orbita/optimized/onboarding-v44/birth_data_idx40.jpg"),
  calc: require("../../../assets/orbita/optimized/onboarding-v44/personalizing_idx51.jpg"),
  reveal: require("../../../assets/orbita/optimized/onboarding-v44/orbital_chart_idx15.jpg"),
  beforeafter: require("../../../assets/orbita/optimized/onboarding-v44/before_after_idx53.jpg"),
  account: require("../../../assets/orbita/optimized/onboarding-v44/account_seal_idx58.jpg"),
  payment: require("../../../assets/orbita/optimized/onboarding-v44/payment_idx62.jpg")
};
const BENEFIT_TILES = [
  { img: require("../../../assets/orbita/optimized/onboarding-v44/benefit_lunar_idx68.jpg"), icon: Moon, label: "Influencia lunar" },
  { img: require("../../../assets/orbita/optimized/onboarding-v44/benefit_guide_idx27.jpg"), icon: Sparkles, label: "Guía personal" },
  { img: require("../../../assets/orbita/optimized/onboarding-v44/benefit_practice_idx38.jpg"), icon: Diamond, label: "Práctica diaria" },
  { img: require("../../../assets/orbita/optimized/onboarding-v44/benefit_decisions_idx13.jpg"), icon: Heart, label: "Decisiones" }
];

type TimeState = { hour: string; minute: string };
const pad2 = (s: string) => String(Number(s)).padStart(2, "0");
/** La hora ya se ingresa en 24hs (0–23), así que solo formateamos. */
function to24h(t: TimeState): string {
  return `${pad2(t.hour)}:${pad2(t.minute)}`;
}

// Pasos de pregunta: contenido anclado abajo (visual arriba) — mata el espacio muerto.
const ANCHORED_KINDS = new Set(["identity", "date", "place", "time", "account"]);

export type OnboardingData = {
  identity?: Identity;
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: "known" | "approximate" | "unknown";
  birthPlaceLabel: string;
  /** Coordenadas reales del lugar elegido (del geocoding) — necesarias para el ascendente/casas. */
  latitude?: number;
  longitude?: number;
  timezone: string;
};
export type OnboardingBackend = {
  isSignedIn: boolean;
  email?: string;
  SignIn: React.ComponentType;
  complete: (data: OnboardingData) => Promise<void>;
  /** Calcula la tríada real (Sol/Luna/Asc) sin login, desde los datos cargados. */
  computeTriad: (data: OnboardingData) => Promise<OnbTriad>;
};

/** Tríada real leída de la carta calculada (para el reveal). */
export type OnbTriad = { resolved: boolean; sun: string | null; moon: string | null; ascendant: string | null };

export function OrbitaOnboarding({ backend, triad }: { backend?: OnboardingBackend; triad?: OnbTriad } = {}) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 480;
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_700Bold, Newsreader_400Regular, Newsreader_500Medium
  });

  const [index, setIndex] = useState(0);
  const [identity, setIdentity] = useState<Identity | undefined>();
  const [day, setDay] = useState(""); const [month, setMonth] = useState(""); const [year, setYear] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [place, setPlace] = useState<string | undefined>();
  const [placeHit, setPlaceHit] = useState<PlaceHit | undefined>();
  const [placeResults, setPlaceResults] = useState<PlaceHit[]>([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  const placeReq = useRef(0);
  const [time, setTime] = useState<TimeState>({ hour: "", minute: "" });
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<PlanId>("annual");
  const [calc, setCalc] = useState(0);
  const [computedTriad, setComputedTriad] = useState<OnbTriad | undefined>();
  const [computeError, setComputeError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const step = ONBOARDING_STEPS[index];
  const anchored = ANCHORED_KINDS.has(step.kind);
  const countedTotal = ONBOARDING_STEPS.filter((s) => s.counts).length;
  const countedDone = ONBOARDING_STEPS.slice(0, index + 1).filter((s) => s.counts).length;
  const progress = step.counts
    ? countedDone / countedTotal
    : ONBOARDING_STEPS.slice(0, index).filter((s) => s.counts).length / countedTotal;

  const sunSign = useMemo(() => {
    if (year.length !== 4 || month === "" || day === "") return null;
    return formatSign(getZodiacSign(`${year}-${pad2(month)}-${pad2(day)}`));
  }, [day, month, year]);

  // Transición suave al cambiar de paso (fade + slide sutil).
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 340, useNativeDriver: true }).start();
  }, [index]);

  const calcRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calcula la tríada REAL (Sol/Luna/Asc) sin login, desde fecha+hora+lugar.
  // Endpoint público (previewDailyHome). Una sola fuente para "calc" y reveal.
  const runCompute = useCallback(async (force = false) => {
    if (!backend || (!force && computedTriad) || !(day && month && year.length === 4)) return;
    setComputing(true);
    setComputeError(null);
    try {
      let data = collectData();
      // Sin coords (tipeó la ciudad pero no la eligió del dropdown) el backend no
      // puede calcular Luna/Ascendente → geocodificamos el texto acá antes de pedir
      // la tríada, y guardamos el hit para que la carta persistida también las tenga.
      if ((data.latitude == null || data.longitude == null) && (place ?? placeQuery)) {
        try {
          const hits = await searchPlaces((place ?? placeQuery) as string);
          const hit = hits[0];
          if (hit?.latitude != null && hit?.longitude != null) {
            data = { ...data, latitude: hit.latitude, longitude: hit.longitude, timezone: hit.timezone ?? data.timezone };
            setPlaceHit(hit);
          }
        } catch {
          // sin geocoding → el reveal degrada al cartel de error
        }
      }
      const t = await backend.computeTriad(data);
      setComputedTriad(t);
      // Éxito parcial: teníamos hora + lugar pero la API no devolvió Luna/Asc
      // (rate-limit o "modo maqueta") → error explícito con reintento, no placeholders.
      if (!t.moon && !t.ascendant && !timeUnknown && data.latitude != null) {
        setComputeError("El servicio de cartas no devolvió tu Luna y Ascendente (puede ser un límite temporal de la API). Reintentá en unos segundos.");
      }
    } catch {
      setComputeError("No pudimos contactar el servicio de cartas. Revisá tu conexión y reintentá.");
    } finally {
      setComputing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, computedTriad, day, month, year, place, placeQuery, time.hour, time.minute, timeUnknown]);

  const retryCompute = useCallback(() => {
    setComputedTriad(undefined);
    setComputeError(null);
    void runCompute(true);
  }, [runCompute]);

  // Si cambian los datos de nacimiento, invalidamos la tríada ya calculada para
  // que se recalcule (si no, quedaba pegada la de una persona anterior → mostraba
  // Luna/Asc equivocados con `yaCalc=true`).
  useEffect(() => {
    setComputedTriad(undefined);
  }, [day, month, year, time.hour, time.minute, timeUnknown, place, placeQuery]);

  // Paso "Calculando": corre el cálculo real y ESPERA a que termine antes de
  // pasar al reveal (así no se ve el mock/placeholder primero). Mín 1.2s, máx 8s.
  useEffect(() => {
    if (step.kind !== "calc") return;
    setCalc(0);
    // Sin caché: cada vez que se llega a "calc" se recalcula de cero (force).
    setComputedTriad(undefined);
    setComputeError(null);
    let cancelled = false;
    calcRef.current = setInterval(() => setCalc((c) => (c >= 92 ? 92 : c + 3)), 55);
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await Promise.race([Promise.all([runCompute(true), delay(1200)]), delay(8000)]);
      if (cancelled) return;
      if (calcRef.current) clearInterval(calcRef.current);
      setCalc(100);
      setTimeout(() => { if (!cancelled) setIndex((i) => i + 1); }, 300);
    })();
    return () => { cancelled = true; if (calcRef.current) clearInterval(calcRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);

  // Salto directo al reveal (?step=reveal): calcula igual si no corrió en "calc".
  useEffect(() => {
    if (step.kind === "reveal") void runCompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);

  // Geocoding real (Open-Meteo): autocomplete global de ciudad de nacimiento.
  // Debounce 320ms; con red caída cae al set chico de PLACE_SUGGESTIONS.
  useEffect(() => {
    if (step.kind !== "place") return;
    const q = placeQuery.trim();
    if (place || q.length < 2) { setPlaceResults([]); setPlaceSearching(false); return; }
    const id = ++placeReq.current;
    const controller = new AbortController();
    setPlaceSearching(true);
    const t = setTimeout(async () => {
      try {
        const hits = await searchPlaces(q, controller.signal);
        if (placeReq.current === id) setPlaceResults(hits);
      } catch {
        if (placeReq.current === id) {
          const ql = q.toLowerCase();
          setPlaceResults(
            PLACE_SUGGESTIONS.filter((p) => p.toLowerCase().includes(ql)).slice(0, 6).map((label) => ({ label }))
          );
        }
      } finally {
        if (placeReq.current === id) setPlaceSearching(false);
      }
    }, 450);
    return () => { clearTimeout(t); controller.abort(); };
  }, [placeQuery, place, step.kind]);

  function collectData(): OnboardingData {
    return {
      identity,
      birthDate: `${year}-${pad2(month)}-${pad2(day)}`,
      // 24h "HH:MM" (el backend no parsea "8:30 AM").
      birthTime: timeUnknown ? undefined : to24h(time),
      birthTimePrecision: timeUnknown ? "unknown" : "known",
      birthPlaceLabel: place ?? placeQuery,
      // Coordenadas reales del geocoding → el backend calcula ascendente y casas.
      latitude: placeHit?.latitude,
      longitude: placeHit?.longitude,
      // Timezone real del lugar elegido (geocoding); fallback al del browser.
      timezone:
        placeHit?.timezone ??
        (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/Argentina/Buenos_Aires")
    };
  }

  function next() {
    if (index >= ONBOARDING_STEPS.length - 1) {
      // Al entrar, si hay sesión persistimos la carta para la app (live).
      if (backend && backend.isSignedIn) {
        backend.complete(collectData()).then(() => router.replace("/home?live=1")).catch(() => router.replace("/home"));
      } else {
        router.replace("/home");
      }
      return;
    }
    setIndex((i) => i + 1);
  }
  function back() { setIndex((i) => Math.max(0, i - 1)); }

  const canContinue = useMemo(() => {
    switch (step.kind) {
      case "identity": return !!identity;
      case "date": return day !== "" && month !== "" && year.length === 4;
      case "place": return !!place || placeQuery.trim().length > 2;
      case "time": return timeUnknown || (time.hour !== "" && time.minute !== "");
      case "account": return backend ? backend.isSignedIn : /.+@.+\..+/.test(email);
      default: return true;
    }
  }, [step.kind, identity, day, month, year, place, placeQuery, timeUnknown, time, email, backend]);

  if (!fontsLoaded) {
    return <View style={styles.appLoading}><ActivityIndicator color={colors.copperSoft} /></View>;
  }

  const frameHeight = isDesktop ? Math.min(height - 48, 940) : height;
  const scrimStops = ["rgba(7,8,10,0.28)", "rgba(7,8,10,0.5)", "rgba(7,8,10,0.8)"] as const;

  return (
    <View style={styles.stage}>
      <ImageBackground source={BG[step.id]} resizeMode="cover" style={styles.bgFill}>
        <LinearGradient colors={scrimStops} style={styles.bgFill} />
      </ImageBackground>
      <View style={[styles.frame, isDesktop ? [styles.frameDesktop, { height: frameHeight }] : styles.frameMobile]}>
        <View style={styles.frameInner}>
          {/* top: progress + back */}
          <View style={styles.top}>
            {index > 0 ? (
              <Pressable onPress={back} style={styles.backBtn}><ArrowLeft color={colors.bone} size={20} strokeWidth={1.9} /></Pressable>
            ) : (
              <View style={styles.brand}><Orbit color={colors.copperSoft} size={16} strokeWidth={1.8} /><Text style={styles.brandText}>Órbita</Text></View>
            )}
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} /></View>
            <Text style={styles.stepCount}>{step.counts ? `${countedDone}/${countedTotal}` : ""}</Text>
          </View>

          <ScrollView contentContainerStyle={[styles.content, anchored && styles.contentAnchored]} showsVerticalScrollIndicator={false}>
            <Animated.View
              style={{
                width: "100%",
                opacity: fade,
                transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }]
              }}
            >
              {renderStep()}
            </Animated.View>
          </ScrollView>

          {step.kind !== "calc" && (
            <View style={styles.footer}>
              <Pressable disabled={!canContinue} onPress={next} style={[styles.cta, !canContinue && styles.ctaDisabled]}>
                <Text style={styles.ctaText}>{ctaLabel()}</Text>
                <ArrowRight color={colors.black} size={18} strokeWidth={2.2} />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  function ctaLabel() {
    switch (step.kind) {
      case "intro": return "Empezar";
      case "reveal": return "Ver mi carta completa";
      case "account": return "Guardar carta";
      case "payment": return "Empezar con Órbita";
      default: return "Continuar";
    }
  }

  function renderStep() {
    switch (step.kind) {
      case "intro":
        return (
          <View style={styles.hero}>
            <View style={styles.logoRing}><Orbit color={colors.copperSoft} size={38} strokeWidth={1.4} /></View>
            <Text style={styles.brandBig}>Órbita</Text>
            <Text style={styles.tagline}>tu astróloga personal</Text>
          </View>
        );
      case "promise":
        return step.id === "promise-1" ? (
          <View style={styles.hero}>
            <Kicker>Alineate</Kicker>
            <H1>{"Alineate con el\nritmo del universo"}</H1>
            <Sub>Descifrá amor, trabajo y camino personal desde tu carta.</Sub>
            <View style={styles.chipsRow}>
              <Chip icon={Moon} label="Influencia lunar" />
              <Chip icon={Sparkles} label="Guía personal" />
              <Chip icon={Diamond} label="Práctica diaria" />
            </View>
          </View>
        ) : (
          <View style={styles.heroTop}>
            <Kicker>Guía diaria</Kicker>
            <H1>{"Guía diaria,\najustada a vos"}</H1>
            <Sub>Tu energía se mueve suave. Te acompañamos día a día, sin ruido.</Sub>
            <View style={styles.tilesGrid}>
              {BENEFIT_TILES.map((t) => {
                const Icon = t.icon;
                return (
                  <ImageBackground key={t.label} source={t.img} resizeMode="cover" imageStyle={styles.tileImg} style={styles.tile}>
                    <LinearGradient colors={["rgba(7,8,10,0.15)", "rgba(7,8,10,0.85)"]} style={styles.tileOverlay}>
                      <Icon color={colors.copperSoft} size={18} strokeWidth={1.7} />
                      <Text style={styles.tileLabel}>{t.label}</Text>
                    </LinearGradient>
                  </ImageBackground>
                );
              })}
            </View>
          </View>
        );
      case "identity":
        return (
          <QBlock title="¿Cómo te identificás?" sub="Vamos a personalizar tu experiencia y tus prácticas.">
            {IDENTITY_OPTIONS.map((o) => (
              <Pressable key={o.value} onPress={() => setIdentity(o.value)} style={[styles.option, identity === o.value && styles.optionOn]}>
                <Text style={[styles.optionText, identity === o.value && styles.optionTextOn]}>{o.label}</Text>
                {identity === o.value && <Check color={colors.copperSoft} size={18} strokeWidth={2.4} />}
              </Pressable>
            ))}
          </QBlock>
        );
      case "date":
        return (
          <QBlock title="¿Cuándo naciste?" sub="Tu fecha ubica el Sol en tu carta.">
            <View style={styles.card}>
              <View style={styles.row3}>
                <Field label="DÍA"><TextInput keyboardType="number-pad" maxLength={2} onChangeText={setDay} placeholder="15" placeholderTextColor={colors.boneDim} style={styles.input} value={day} /></Field>
                <Field label="MES"><TextInput keyboardType="number-pad" maxLength={2} onChangeText={setMonth} placeholder="11" placeholderTextColor={colors.boneDim} style={styles.input} value={month} /></Field>
                <Field label="AÑO"><TextInput keyboardType="number-pad" maxLength={4} onChangeText={setYear} placeholder="1996" placeholderTextColor={colors.boneDim} style={styles.input} value={year} /></Field>
              </View>
              {sunSign && (
                <View style={styles.sunHint}>
                  <Sun color={colors.copperSoft} size={16} strokeWidth={1.8} />
                  <Text style={styles.sunHintText}>Tu Sol es <Text style={styles.sunHintStrong}>{sunSign}</Text></Text>
                </View>
              )}
            </View>
            <Privacy>La usamos para calcular tu carta natal. Nunca vendemos ni compartimos tus datos.</Privacy>
          </QBlock>
        );
      case "place":
        return (
          <QBlock title="¿Dónde naciste?" sub="La ciudad ajusta el horizonte de tu carta.">
            <View style={styles.card}>
              <Field label="CIUDAD">
                <TextInput autoFocus onChangeText={(t) => { setPlaceQuery(t); setPlace(undefined); setPlaceHit(undefined); }} placeholder="Buenos Aires, Argentina" placeholderTextColor={colors.boneDim} style={styles.input} value={place ?? placeQuery} />
              </Field>
              {placeResults.map((hit) => (
                <Pressable key={hit.label} onPress={() => { setPlace(hit.label); setPlaceQuery(hit.label); setPlaceHit(hit); setPlaceResults([]); }} style={styles.suggestion}>
                  <Text style={styles.suggestionText}>{hit.label}</Text>
                </Pressable>
              ))}
              {placeSearching && placeResults.length === 0 && <Text style={styles.hint}>Buscando ciudades…</Text>}
              {place && <Text style={styles.hint}>El lugar ayuda a calcular tu ascendente y las casas.</Text>}
            </View>
            <Privacy>La usamos para precisar tu carta natal. Nunca vendemos ni compartimos tus datos.</Privacy>
          </QBlock>
        );
      case "time":
        return (
          <QBlock title="¿A qué hora naciste?" sub="La hora afina tu ascendente y tus casas.">
            <View style={styles.card}>
              <View style={[styles.row3, timeUnknown && styles.dim]}>
                <Field label="HORA (0–23)"><TextInput editable={!timeUnknown} keyboardType="number-pad" maxLength={2} onChangeText={(t) => setTime((s) => ({ ...s, hour: t }))} placeholder="13" placeholderTextColor={colors.boneDim} style={styles.input} value={time.hour} /></Field>
                <Field label="MIN"><TextInput editable={!timeUnknown} keyboardType="number-pad" maxLength={2} onChangeText={(t) => setTime((s) => ({ ...s, minute: t }))} placeholder="42" placeholderTextColor={colors.boneDim} style={styles.input} value={time.minute} /></Field>
              </View>
              <Pressable onPress={() => setTimeUnknown((u) => !u)} style={styles.toggle}>
                <View style={[styles.checkbox, timeUnknown && styles.checkboxOn]}>{timeUnknown && <Check color={colors.black} size={13} strokeWidth={3} />}</View>
                <Text style={styles.toggleText}>No sé la hora</Text>
              </Pressable>
              <Text style={styles.hint}>{timeUnknown ? "Usamos una carta aproximada." : "Podés continuar sin hora exacta. La lectura será menos precisa."}</Text>
            </View>
          </QBlock>
        );
      case "calc":
        return (
          <View style={styles.hero}>
            <Sparkles color={colors.copperSoft} size={32} strokeWidth={1.5} />
            <H1>Carta natal en proceso.</H1>
            <View style={styles.calcTrack}><View style={[styles.calcFill, { width: `${calc}%` }]} /></View>
            <Text style={styles.calcPct}>{`${calc}%`}</Text>
          </View>
        );
      case "reveal": {
        const t = computedTriad ?? triad;
        const sunLabel = t?.sun ?? sunSign ?? "—";
        const moonLabel = t?.moon;
        const ascLabel = t?.ascendant;
        const hasReal = !!(moonLabel || ascLabel);
        return (
          <View style={styles.revealWrap}>
            <Kicker>Tu carta base</Kicker>
            <View style={styles.sunEmblem}><Sun color={colors.copperSoft} size={46} strokeWidth={1.3} /></View>
            <Text style={styles.revealSign}>{sunLabel}</Text>
            <Text style={styles.revealRole}>Tu Sol</Text>
            {computeError ? (
              <View style={styles.revealError}>
                <Text style={styles.revealErrorTitle}>No pudimos calcular tu carta</Text>
                <Text style={styles.revealErrorText}>{computeError}</Text>
                <Pressable
                  onPress={retryCompute}
                  disabled={computing}
                  style={({ pressed }) => [styles.revealRetry, (computing || pressed) && { opacity: 0.6 }]}
                >
                  <Text style={styles.revealRetryText}>{computing ? "Calculando…" : "Reintentar"}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.revealSecondary}>
                  <View style={styles.revealMini}>
                    <Moon color={colors.copperSoft} size={15} strokeWidth={1.7} />
                    <Text style={styles.revealMiniRole}>Luna</Text>
                    <Text style={[styles.revealMiniNote, moonLabel ? styles.revealMiniValue : null]}>{moonLabel ?? (computing ? "…" : "con tu hora")}</Text>
                  </View>
                  <View style={styles.revealMini}>
                    <Orbit color={colors.copperSoft} size={15} strokeWidth={1.7} />
                    <Text style={styles.revealMiniRole}>Asc</Text>
                    <Text style={[styles.revealMiniNote, ascLabel ? styles.revealMiniValue : null]}>{ascLabel ?? (computing ? "…" : "con tu lugar")}</Text>
                  </View>
                </View>
                <Sub>
                  {hasReal
                    ? "Tu Sol, tu Luna y tu ascendente. Tu carta completa —casas, aspectos y más— te espera del otro lado."
                    : "El Sol sale de tu fecha. Luna y ascendente se afinan con tu hora y lugar en la carta completa."}
                </Sub>
              </>
            )}
          </View>
        );
      }
      case "beforeafter":
        return (
          <View style={styles.heroTop}>
            <Kicker>Antes y después</Kicker>
            <H1>{"Antes y después\nde Órbita"}</H1>
            <Sub>Una guía diaria puede cambiar cómo mirás tu día.</Sub>
            <View style={styles.baRow}>
              <View style={styles.baCard}><Text style={styles.baLabel}>ANTES</Text><Text style={styles.baText}>Días en piloto automático, decisiones sin contexto.</Text></View>
              <View style={[styles.baCard, styles.baCardOn]}><Text style={styles.baLabelOn}>DESPUÉS</Text><Text style={styles.baText}>Una lectura diaria que te ordena y te acompaña.</Text></View>
            </View>
          </View>
        );
      case "account":
        return (
          <QBlock title="Guardá tu carta." sub="Tu historial, tus lecturas y tus tránsitos quedan en tu cuenta.">
            {backend ? (
              backend.isSignedIn ? (
                <View style={styles.card}>
                  <View style={styles.okRow}><Check color={colors.copperSoft} size={18} strokeWidth={2.2} /><Text style={styles.okText}>Sesión iniciada{backend.email ? ` como ${backend.email}` : ""}.</Text></View>
                  <Text style={styles.hint}>Al continuar guardamos tu carta en tu cuenta.</Text>
                </View>
              ) : (
                <View style={styles.clerkCard}><backend.SignIn /></View>
              )
            ) : (
              <View style={styles.card}>
                <Field label="EMAIL"><TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="vos@email.com" placeholderTextColor={colors.boneDim} style={styles.input} value={email} /></Field>
              </View>
            )}
            <Privacy>Sello de cuenta Órbita. Nunca vendemos ni compartimos tus datos.</Privacy>
          </QBlock>
        );
      case "payment":
        return (
          <View style={styles.heroTop}>
            <View style={styles.plusRow}><Text style={styles.kicker}>ÓRBITA</Text><View style={styles.plusBadge}><Text style={styles.plusBadgeText}>PLUS</Text></View></View>
            <H1>Tu cielo, todos los días.</H1>
            <View style={styles.plans}>
              {PLANS.map((p) => (
                <Pressable key={p.id} onPress={() => setPlan(p.id)} style={[styles.plan, plan === p.id && styles.planOn]}>
                  {p.badge && <View style={styles.badge}><Text style={styles.badgeText}>{p.badge}</Text></View>}
                  <Text style={styles.planName}>{p.name}</Text>
                  <Text style={styles.planPrice}>{p.price}</Text>
                  <Text style={styles.planPer}>{p.per}</Text>
                  {p.note && <Text style={styles.planNote}>{p.note}</Text>}
                </Pressable>
              ))}
            </View>
            <View style={styles.benefits}>
              {PLAN_BENEFITS.map((b) => (
                <View key={b} style={styles.benefitRow}><Check color={colors.copperSoft} size={16} strokeWidth={2.2} /><Text style={styles.benefitText}>{b}</Text></View>
              ))}
            </View>
            <Text style={styles.legal}>Cancelás cuando quieras. Entretenimiento y autoconocimiento.</Text>
          </View>
        );
      default:
        return null;
    }
  }
}

// ---- primitives ----
function Kicker({ children }: { children: string }) { return <Text style={styles.kicker}>{String(children).toUpperCase()}</Text>; }
function H1({ children }: { children: string }) { return <Text style={styles.h1}>{children}</Text>; }
function Sub({ children }: { children: string }) { return <Text style={styles.subText}>{children}</Text>; }
function QBlock({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <View style={styles.qBlock}>
      <Text style={styles.qTitle}>{title}</Text>
      <Text style={styles.qSub}>{sub}</Text>
      <View style={styles.qBody}>{children}</View>
    </View>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}
function Privacy({ children }: { children: string }) { return <Text style={styles.privacy}>{children}</Text>; }
type IconC = React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
function Chip({ icon: Icon, label }: { icon: IconC; label: string }) {
  return <View style={styles.chip}><Icon color={colors.copperSoft} size={15} strokeWidth={1.8} /><Text style={styles.chipText}>{label}</Text></View>;
}
function TriadCard({ icon: Icon, role, sign, note, strong }: { icon: IconC; role: string; sign: string; note: string; strong?: boolean }) {
  return (
    <View style={[styles.triadCard, strong && styles.triadCardOn]}>
      <Icon color={colors.copperSoft} size={18} strokeWidth={1.7} />
      <Text style={styles.triadRole}>{role.toUpperCase()}</Text>
      <Text style={[styles.triadSign, strong && styles.triadSignOn]}>{sign}</Text>
      <Text style={styles.triadNote}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  appLoading: { alignItems: "center", backgroundColor: colors.black, flex: 1, justifyContent: "center" },
  stage: { alignItems: "center", backgroundColor: colors.black, flex: 1, justifyContent: "center", overflow: "hidden" },
  bgFill: { ...StyleSheet.absoluteFillObject },
  frame: { overflow: "hidden", width: "100%" },
  frameMobile: { backgroundColor: "transparent", flex: 1, maxWidth: 520 },
  frameDesktop: { backgroundColor: "rgba(7,8,10,0.42)", borderColor: colors.line, borderRadius: 30, borderWidth: 1, maxWidth: 430, shadowColor: "#C46A3A", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.22, shadowRadius: 42 },
  frameInner: { flex: 1, paddingHorizontal: 22 },

  top: { alignItems: "center", flexDirection: "row", gap: 14, paddingTop: 22 },
  backBtn: { alignItems: "center", height: 32, justifyContent: "center", width: 32 },
  brand: { alignItems: "center", flexDirection: "row", gap: 7 },
  brandText: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 14 },
  progressTrack: { backgroundColor: "rgba(244,238,228,0.14)", borderRadius: 3, flex: 1, height: 5, overflow: "hidden" },
  progressFill: { backgroundColor: colors.copperSoft, borderRadius: 3, height: 5 },
  stepCount: { color: colors.boneDim, fontFamily: "Inter_700Bold", fontSize: 12, minWidth: 30, textAlign: "right" },

  content: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
  contentAnchored: { justifyContent: "flex-end", paddingBottom: 6, paddingTop: 24 },

  revealWrap: { alignItems: "center", gap: 12 },
  sunEmblem: { alignItems: "center", backgroundColor: "rgba(196,106,58,0.1)", borderColor: colors.copperSoft, borderRadius: 52, borderWidth: 1, height: 104, justifyContent: "center", marginTop: 6, shadowColor: "#C46A3A", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 46, width: 104 },
  revealSign: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 54, lineHeight: 60, marginTop: 8 },
  revealRole: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase" },
  revealSecondary: { flexDirection: "row", gap: 12, marginTop: 12 },
  revealMini: { alignItems: "center", backgroundColor: colors.cardSolid, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 4, paddingHorizontal: 20, paddingVertical: 12 },
  revealMiniRole: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" },
  revealMiniNote: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 11 },
  revealMiniValue: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 16 },
  revealError: { alignItems: "center", backgroundColor: "rgba(214,154,106,0.08)", borderColor: "rgba(214,154,106,0.35)", borderRadius: 14, borderWidth: 1, gap: 8, marginTop: 14, maxWidth: 340, paddingHorizontal: 20, paddingVertical: 16 },
  revealErrorTitle: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 18 },
  revealErrorText: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, textAlign: "center" },
  revealRetry: { backgroundColor: colors.copperSoft, borderRadius: 10, marginTop: 4, paddingHorizontal: 24, paddingVertical: 10 },
  revealRetryText: { color: colors.black, fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: 0.4 },
  hero: { alignItems: "center", gap: 16 },
  heroTop: { alignItems: "center", gap: 16, paddingTop: 8 },
  logoRing: { alignItems: "center", borderColor: colors.line, borderRadius: 60, borderWidth: 1, height: 96, justifyContent: "center", width: 96 },
  brandBig: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 58 },
  tagline: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 16 },
  kicker: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.4 },
  h1: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 38, lineHeight: 43, textAlign: "center" },
  subText: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 16, lineHeight: 24, maxWidth: 380, textAlign: "center" },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4 },
  chip: { alignItems: "center", backgroundColor: colors.card, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 13, paddingVertical: 8 },
  chipText: { color: colors.bone, fontFamily: "Inter_500Medium", fontSize: 13 },

  tilesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 6 },
  tile: { borderRadius: 14, height: 108, overflow: "hidden", width: 150 },
  tileImg: { borderRadius: 14 },
  tileOverlay: { flex: 1, gap: 6, justifyContent: "flex-end", padding: 12 },
  tileLabel: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 13 },

  qBlock: { gap: 10 },
  qTitle: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 34, lineHeight: 39 },
  qSub: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 16, lineHeight: 23 },
  qBody: { gap: 12, marginTop: 14 },

  card: { backgroundColor: colors.cardSolid, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 18 },
  clerkCard: { backgroundColor: "rgba(244,238,228,0.03)", borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden", padding: 6 },
  okRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  okText: { color: colors.bone, fontFamily: "Inter_500Medium", fontSize: 15 },
  row3: { flexDirection: "row", gap: 10 },
  dim: { opacity: 0.45 },
  field: { flex: 1, gap: 7 },
  fieldLabel: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.6 },
  input: { backgroundColor: colors.inputBg, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.bone, fontFamily: "Inter_500Medium", fontSize: 17, minHeight: 52, paddingHorizontal: 14 },
  hint: { color: colors.boneMuted, fontFamily: "Inter_500Medium", fontSize: 13 },
  sunHint: { alignItems: "center", backgroundColor: "rgba(196,106,58,0.1)", borderRadius: 10, flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 11 },
  sunHintText: { color: colors.bone, fontFamily: "Inter_500Medium", fontSize: 15 },
  sunHintStrong: { fontFamily: "Newsreader_500Medium", fontSize: 17 },
  privacy: { color: colors.boneDim, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "center" },

  option: { alignItems: "center", backgroundColor: colors.cardSolid, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 60, paddingHorizontal: 20 },
  optionOn: { backgroundColor: "rgba(196,106,58,0.16)", borderColor: colors.copperSoft, shadowColor: "#C46A3A", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 18 },
  optionText: { color: colors.bone, fontFamily: "Inter_500Medium", fontSize: 17 },
  optionTextOn: { color: colors.bone, fontFamily: "Inter_700Bold" },

  suggestion: { borderColor: "rgba(244,238,228,0.1)", borderTopWidth: 1, paddingVertical: 12 },
  suggestionText: { color: colors.bone, fontFamily: "Inter_400Regular", fontSize: 15 },

  segmented: { backgroundColor: colors.inputBg, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", minHeight: 52, padding: 4 },
  seg: { alignItems: "center", borderRadius: 7, flex: 1, justifyContent: "center" },
  segOn: { backgroundColor: colors.bone },
  segText: { color: colors.boneMuted, fontFamily: "Inter_700Bold", fontSize: 13 },
  segTextOn: { color: colors.black },
  toggle: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 10, paddingVertical: 2 },
  checkbox: { alignItems: "center", borderColor: colors.line, borderRadius: 6, borderWidth: 1, height: 22, justifyContent: "center", width: 22 },
  checkboxOn: { backgroundColor: colors.copperSoft, borderColor: colors.copperSoft },
  toggleText: { color: colors.boneMuted, fontFamily: "Inter_500Medium", fontSize: 15 },

  calcTrack: { backgroundColor: "rgba(244,238,228,0.14)", borderRadius: 4, height: 8, marginTop: 8, overflow: "hidden", width: 260 },
  calcFill: { backgroundColor: colors.copperSoft, borderRadius: 4, height: 8 },
  calcPct: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 14 },

  triad: { flexDirection: "row", gap: 10, marginVertical: 4 },
  triadCard: { alignItems: "center", backgroundColor: colors.card, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 5, paddingHorizontal: 12, paddingVertical: 14, width: 104 },
  triadCardOn: { backgroundColor: "rgba(196,106,58,0.12)", borderColor: "rgba(214,154,106,0.4)" },
  triadRole: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.6 },
  triadSign: { color: colors.boneMuted, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
  triadSignOn: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 20 },
  triadNote: { color: colors.boneDim, fontFamily: "Inter_400Regular", fontSize: 11 },

  baRow: { flexDirection: "row", gap: 10, marginTop: 6, width: "100%" },
  baCard: { backgroundColor: colors.cardSolid, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flex: 1, gap: 8, padding: 15 },
  baCardOn: { backgroundColor: "rgba(196,106,58,0.1)", borderColor: "rgba(214,154,106,0.34)" },
  baLabel: { color: colors.boneDim, fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.6 },
  baLabelOn: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.6 },
  baText: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },

  plusRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  plusBadge: { borderColor: colors.copperSoft, borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  plusBadgeText: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1 },
  plans: { flexDirection: "row", gap: 10, marginTop: 4, width: "100%" },
  plan: { backgroundColor: colors.cardSolid, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flex: 1, gap: 3, paddingHorizontal: 16, paddingVertical: 16 },
  planOn: { backgroundColor: "rgba(196,106,58,0.1)", borderColor: colors.copperSoft },
  badge: { alignSelf: "flex-start", backgroundColor: colors.copperSoft, borderRadius: 6, marginBottom: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: colors.black, fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.4 },
  planName: { color: colors.boneMuted, fontFamily: "Inter_700Bold", fontSize: 13 },
  planPrice: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 32 },
  planPer: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 12 },
  planNote: { color: colors.copperSoft, fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 2 },
  benefits: { alignSelf: "stretch", gap: 10, marginTop: 4 },
  benefitRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  benefitText: { color: colors.bone, fontFamily: "Inter_500Medium", fontSize: 15 },
  legal: { color: colors.boneDim, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, textAlign: "center" },

  footer: { paddingBottom: 24, paddingTop: 12 },
  cta: { alignItems: "center", backgroundColor: colors.bone, borderRadius: 13, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 54 },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: colors.black, fontFamily: "Inter_700Bold", fontSize: 16 }
});

// Contenedor con backend: se monta SOLO cuando Convex+Clerk están configurados
// (usa useMutation + useOrbitaAuth, que requieren providers montados).
function capSign(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const SIGN_ES: Record<string, string> = {
  aries: "Aries", tauro: "Tauro", geminis: "Géminis", cancer: "Cáncer",
  leo: "Leo", virgo: "Virgo", libra: "Libra", escorpio: "Escorpio",
  sagitario: "Sagitario", capricornio: "Capricornio", acuario: "Acuario", piscis: "Piscis"
};

/** "Sol en geminis" / "Ascendente en libra" / "Luna en piscis" → "Géminis"/"Libra"/"Piscis". */
function parseSign(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let s = v.trim();
  const m = s.match(/\ben\s+(.+)$/i);
  if (m) s = m[1].trim();
  if (!s || /pendiente/i.test(s)) return null;
  const key = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return SIGN_ES[key] ?? capSign(s);
}

/** Lee la tríada (Sol/Luna/Asc) de la carta persistida para el reveal. */
function readTriadFromChart(chart: unknown): OnbTriad {
  const payload = chart && typeof chart === "object" ? (chart as { payload?: unknown }).payload : null;
  const t = payload && typeof payload === "object" ? (payload as { triad?: unknown }).triad : null;
  const read = (k: string): string | null => {
    const p = t && typeof t === "object" ? (t as Record<string, unknown>)[k] : null;
    const sign = p && typeof p === "object" ? (p as Record<string, unknown>).sign : null;
    return typeof sign === "string" && sign !== "pendiente" && sign.trim().length > 0 ? capSign(sign) : null;
  };
  return { resolved: chart !== undefined, sun: read("sun"), moon: read("moon"), ascendant: read("ascendant") };
}

export function OnboardingWithBackend() {
  const auth = useOrbitaAuth();
  const completeBirthData = useMutation(appApi.onboarding.completeBirthData);
  const calcChart = useAction(appApi.charts.calculateOrCreateNatalChart);
  const genToday = useMutation(appApi.readings.generateToday);
  const resolvePlace = useAction(proposedApi.resolvePlace);
  const previewDaily = useAction(publicLabApi.previewDailyHome);
  const ensureUser = useMutation(appApi.users.getOrCreateCurrentUser);
  // charts.current tira "User record not found" si estás logueado pero todavía
  // no existe la fila `users` (ventana post-login). Creamos la fila primero y
  // recién ahí habilitamos la query (mismo patrón que useLiveApp). Para el
  // reveal, la tríada real igual sale de computeTriad (público, sin login).
  const [userReady, setUserReady] = useState(false);
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
  const triad = readTriadFromChart(chart);
  const { SignIn } = require("@clerk/expo/web") as { SignIn: ComponentType<Record<string, unknown>> };

  const backend: OnboardingBackend = {
    isSignedIn: auth.isSignedIn,
    email: auth.email,
    SignIn: () => (
      <SignIn
        routing="hash"
        fallbackRedirectUrl="/empezar"
        forceRedirectUrl="/empezar"
        signUpFallbackRedirectUrl="/empezar"
        signUpForceRedirectUrl="/empezar"
      />
    ),
    complete: async (data) => {
      // Base: coordenadas + timezone que ya trajo el geocoding (Photon da coords).
      // resolvePlace (AstrologyAPI) las refina/agrega timezone del lugar si puede.
      let latitude = data.latitude;
      let longitude = data.longitude;
      let placeId: string | undefined;
      let timezone = data.timezone;
      try {
        const res = await resolvePlace({ query: data.birthPlaceLabel });
        const place = res?.status === "success" ? res.places?.[0] : undefined;
        if (place) {
          if (typeof place.latitude === "number") latitude = place.latitude;
          if (typeof place.longitude === "number") longitude = place.longitude;
          if (place.timezone) timezone = place.timezone;
          if (place.placeId) placeId = place.placeId;
        }
      } catch {
        // resolvePlace falló: seguimos con las coords del geocoding + timezone del browser.
      }
      await completeBirthData({
        birthDate: data.birthDate,
        birthTime: data.birthTime,
        birthTimePrecision: data.birthTimePrecision,
        birthPlaceLabel: data.birthPlaceLabel,
        placeId,
        latitude,
        longitude,
        timezone
      });
      await calcChart({});
      const now = new Date();
      const localDate = `${now.getFullYear()}-${pad2(String(now.getMonth() + 1))}-${pad2(String(now.getDate()))}`;
      await genToday({ localDate, timezone });
    },
    // Tríada real SIN login: calcula la carta desde los datos cargados vía el
    // endpoint público del lab (AstrologyAPI). Sirve para el reveal al instante.
    computeTriad: async (data) => {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${pad2(String(now.getMonth() + 1))}-${pad2(String(now.getDate()))}`;
      const res = await previewDaily({
        birthDate: data.birthDate,
        birthTime: data.birthTime,
        birthTimePrecision: data.birthTimePrecision,
        birthPlaceLabel: data.birthPlaceLabel,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
        localDate
      });
      const nb = res?.natalBase;
      return { resolved: true, sun: parseSign(nb?.sun), moon: parseSign(nb?.moon), ascendant: parseSign(nb?.ascendant) };
    }
  };

  return <OrbitaOnboarding backend={backend} triad={triad} />;
}

export default OrbitaOnboarding;
