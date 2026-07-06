import { ComponentType, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
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

type TimeState = { hour: string; minute: string; period: "AM" | "PM" };
const pad2 = (s: string) => String(Number(s)).padStart(2, "0");
function to24h(t: TimeState): string {
  const h = Number(t.hour) % 12;
  const h24 = t.period === "PM" ? h + 12 : h;
  return `${pad2(String(h24))}:${pad2(t.minute)}`;
}

export type OnboardingData = {
  identity?: Identity;
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: "known" | "approximate" | "unknown";
  birthPlaceLabel: string;
  timezone: string;
};
export type OnboardingBackend = {
  isSignedIn: boolean;
  email?: string;
  SignIn: React.ComponentType;
  complete: (data: OnboardingData) => Promise<void>;
};

export function OrbitaOnboarding({ backend }: { backend?: OnboardingBackend } = {}) {
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
  const [time, setTime] = useState<TimeState>({ hour: "", minute: "", period: "AM" });
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<PlanId>("annual");
  const [calc, setCalc] = useState(0);

  const step = ONBOARDING_STEPS[index];
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
  useEffect(() => {
    if (step.kind !== "calc") return;
    setCalc(0);
    calcRef.current = setInterval(() => {
      setCalc((c) => {
        if (c >= 100) { if (calcRef.current) clearInterval(calcRef.current); setTimeout(() => setIndex((i) => i + 1), 450); return 100; }
        return c + 4;
      });
    }, 55);
    return () => { if (calcRef.current) clearInterval(calcRef.current); };
  }, [step.kind]);

  function collectData(): OnboardingData {
    return {
      identity,
      birthDate: `${year}-${pad2(month)}-${pad2(day)}`,
      // 24h "HH:MM" (el backend no parsea "8:30 AM").
      birthTime: timeUnknown ? undefined : to24h(time),
      birthTimePrecision: timeUnknown ? "unknown" : "known",
      birthPlaceLabel: place ?? placeQuery,
      timezone:
        typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/Argentina/Buenos_Aires"
    };
  }

  function next() {
    if (index >= ONBOARDING_STEPS.length - 1) {
      if (backend && backend.isSignedIn) {
        // escribe carta real y va al día en modo live
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

  const suggestions = placeQuery.trim().length > 0 && !place
    ? PLACE_SUGGESTIONS.filter((p) => p.toLowerCase().includes(placeQuery.toLowerCase())).slice(0, 5)
    : [];
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

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
      case "reveal": return "Continuar";
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
                <TextInput autoFocus onChangeText={(t) => { setPlaceQuery(t); setPlace(undefined); }} placeholder="Buenos Aires, Argentina" placeholderTextColor={colors.boneDim} style={styles.input} value={place ?? placeQuery} />
              </Field>
              {suggestions.map((s) => (
                <Pressable key={s} onPress={() => { setPlace(s); setPlaceQuery(s); }} style={styles.suggestion}>
                  <Text style={styles.suggestionText}>{s}</Text>
                </Pressable>
              ))}
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
                <Field label="HORA"><TextInput editable={!timeUnknown} keyboardType="number-pad" maxLength={2} onChangeText={(t) => setTime((s) => ({ ...s, hour: t }))} placeholder="08" placeholderTextColor={colors.boneDim} style={styles.input} value={time.hour} /></Field>
                <Field label="MIN"><TextInput editable={!timeUnknown} keyboardType="number-pad" maxLength={2} onChangeText={(t) => setTime((s) => ({ ...s, minute: t }))} placeholder="30" placeholderTextColor={colors.boneDim} style={styles.input} value={time.minute} /></Field>
                <Field label="AM/PM">
                  <View style={styles.segmented}>
                    {(["AM", "PM"] as const).map((p) => (
                      <Pressable key={p} disabled={timeUnknown} onPress={() => setTime((s) => ({ ...s, period: p }))} style={[styles.seg, time.period === p && styles.segOn]}>
                        <Text style={[styles.segText, time.period === p && styles.segTextOn]}>{p}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Field>
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
      case "reveal":
        return (
          <View style={styles.hero}>
            <Kicker>Tu carta base</Kicker>
            <H1>{"Estos son tus\npuntos de partida."}</H1>
            <View style={styles.triad}>
              <TriadCard icon={Sun} role="Sol" sign={sunSign ?? "—"} note="tu identidad" strong />
              <TriadCard icon={Moon} role="Luna" sign="con tu hora" note="tu emoción" />
              <TriadCard icon={Orbit} role="Asc" sign="con tu lugar" note="cómo te ves" />
            </View>
            <Sub>El Sol sale de tu fecha. Luna y ascendente se afinan con tu hora y lugar en la carta completa.</Sub>
          </View>
        );
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
export function OnboardingWithBackend() {
  const auth = useOrbitaAuth();
  const completeBirthData = useMutation(appApi.onboarding.completeBirthData);
  const calcChart = useAction(appApi.charts.calculateOrCreateNatalChart);
  const genToday = useMutation(appApi.readings.generateToday);
  const resolvePlace = useAction(proposedApi.resolvePlace);
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
      // Resolvemos el lugar → coordenadas + timezone reales para una carta precisa.
      // Defensivo: si el backend todavía no resuelve (o falla), caemos al timezone del browser.
      let latitude: number | undefined;
      let longitude: number | undefined;
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
        // fallback: timezone del browser, sin coordenadas
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
    }
  };

  return <OrbitaOnboarding backend={backend} />;
}

export default OrbitaOnboarding;
