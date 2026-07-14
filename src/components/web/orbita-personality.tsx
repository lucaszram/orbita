import { useEffect, useRef } from "react";
import { useAction, useQuery } from "convex/react";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { Link } from "expo-router";
import { ArrowRight, Heart, MessageCircle, Moon, Mountain, Sparkles, Sun, Zap } from "lucide-react-native";
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { ImmersiveScreen } from "@/components/web/immersive-bg";
import { LiveGate, LiveLoading } from "@/components/web/live";
import { NatalWheel, mapNatalChart } from "@/components/web/orbita-chart";
import { Radar } from "@/components/web/orbita-values";
import { WebNav } from "@/components/web/web-nav";
import { chartMock } from "@/content/chartMock";
import { personalityMock } from "@/content/personalityMock";
import { valuesMock } from "@/content/valuesMock";
import {
  appApi,
  type NatalChartPayload,
  type PersonalityReadingPayload,
  type PersonalitySection,
  type ValuesMapPayload
} from "@/services/appRefs";

const colors = {
  black: "#07080A",
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  boneDim: "rgba(244, 238, 228, 0.5)",
  line: "rgba(214, 154, 106, 0.22)",
  blue: "#8CA6C4",
  card: "rgba(11, 12, 15, 0.6)"
};

type IconC = React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
const ICONS: Record<string, IconC> = {
  identidad: Sun,
  emocional: Moon,
  mente: MessageCircle,
  amor: Heart,
  impulso: Zap,
  expansion: Sparkles,
  estructura: Mountain
};

type ScreenData = { payload: PersonalityReadingPayload; chart: NatalChartPayload; values: ValuesMapPayload };

export function OrbitaPersonality() {
  return (
    <LiveGate
      mock={<PersonalityScreen payload={personalityMock} chart={chartMock} values={valuesMock} />}
      live={() => <PersonalityWithBackend />}
    />
  );
}

function PersonalityWithBackend() {
  const reading = useQuery(appApi.charts.personalityReading, {});
  const chartDoc = useQuery(appApi.charts.current, {});
  const values = useQuery(appApi.charts.valuesMap, {});
  // Dispara la generación LLM una vez; el backend no-opea si ya está cacheada o
  // si no hay carta. Cuando termina y cachea, la query `reading` se actualiza sola.
  const generate = useAction(appApi.charts.generatePersonalityReading);
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    generate({}).catch(() => {});
  }, [generate]);
  if (reading === undefined || chartDoc === undefined || values === undefined) return <LiveLoading />;
  return (
    <PersonalityScreen
      payload={reading ?? personalityMock}
      chart={chartDoc ? mapNatalChart(chartDoc) : chartMock}
      values={values ?? valuesMock}
    />
  );
}

export function PersonalityScreen({ payload, chart, values }: ScreenData) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 820;
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold, Newsreader_500Medium });

  const scrollRef = useRef<ScrollView>(null);
  const colTop = useRef(0);
  const sectionY = useRef<Record<string, number>>({});
  const jumpTo = (key: string) => {
    const y = sectionY.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, colTop.current + y - 20), animated: true });
  };

  if (!fontsLoaded) return <View style={styles.center}><ActivityIndicator color={colors.copperSoft} /></View>;
  const wheelSize = isNarrow ? Math.min(width - 64, 460) : 520;

  return (
    <ImmersiveScreen asset="ringSystem" opacity={0.22}>
      <ScrollView
        ref={scrollRef}
        style={styles.page}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
        <WebNav active="carta" />
        <View
          style={[styles.col, { paddingHorizontal: isNarrow ? 24 : 40 }]}
          onLayout={(e: LayoutChangeEvent) => { colTop.current = e.nativeEvent.layout.y; }}
        >
          {/* Header */}
          <View style={styles.headerBlock}>
            <Text style={styles.eyebrow}>Horóscopo de personalidad</Text>
            <Text style={[styles.title, isNarrow && styles.titleNarrow]}>{payload.headline}</Text>
            <Text style={styles.sub}>
              Una lectura completa de tu carta natal, sector por sector: identidad, emoción, mente, vínculos,
              impulso, crecimiento y estructura. Es una guía para conocerte, no una etiqueta ni una predicción.
            </Text>
          </View>

          {/* Rueda natal real */}
          <View style={styles.wheelBlock}>
            <NatalWheel payload={chart} size={wheelSize} />
            <Text style={styles.wheelCaption}>Tu carta natal — {chart.accuracy}</Text>
          </View>

          {/* Índice de sectores */}
          <View style={styles.indexWrap}>
            <Text style={styles.indexLabel}>En esta lectura</Text>
            <View style={styles.indexChips}>
              {payload.sections.map((s, i) => (
                <Pressable key={s.key} onPress={() => jumpTo(s.key)} style={styles.chip}>
                  <Text style={styles.chipNum}>{String(i + 1).padStart(2, "0")}</Text>
                  <Text style={styles.chipText}>{s.title}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Secciones por sector */}
          {payload.sections.map((s, i) => (
            <View
              key={s.key}
              style={styles.section}
              onLayout={(e: LayoutChangeEvent) => { sectionY.current[s.key] = e.nativeEvent.layout.y; }}
            >
              {i > 0 && <Divider />}
              <SectionView section={s} index={i} />
            </View>
          ))}

          <Divider />

          {/* Mapa de valores */}
          <View style={styles.valuesBlock}>
            <Text style={styles.sectorKicker}>Sector · Mapa de valores</Text>
            <Text style={styles.sectionTitle}>Qué te impulsa y qué te pesa</Text>
            <Radar payload={values} size={isNarrow ? Math.min(width - 64, 440) : 460} />
            <View style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: colors.copperSoft }]} />
              <Text style={styles.legendLabel}>Armonía</Text>
              <View style={{ width: 22 }} />
              <View style={[styles.dot, { backgroundColor: colors.blue }]} />
              <Text style={styles.legendLabel}>Tensión</Text>
            </View>
            <Text style={styles.valuesNote}>{values.note}</Text>
          </View>

          <Divider />
          <View style={styles.closing}>
            <Text style={styles.disclaimer}>{payload.disclaimer}</Text>
            <Link href="/home" asChild>
              <Pressable style={styles.cta}>
                <Text style={styles.ctaText}>Ver mi día</Text>
                <ArrowRight color={colors.black} size={17} strokeWidth={2.1} />
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </ImmersiveScreen>
  );
}

function SectionView({ section, index }: { section: PersonalitySection; index: number }) {
  const Icon = ICONS[section.key] ?? Sparkles;
  return (
    <View style={styles.sectionInner}>
      <View style={styles.marker}>
        <Text style={styles.sectorKicker}>Sector {String(index + 1).padStart(2, "0")}</Text>
        <View style={styles.ring}><Icon color={colors.copperSoft} size={26} strokeWidth={1.6} /></View>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionIntro}>{section.intro}</Text>
      </View>
      <View style={styles.interp}>
        <View style={styles.interpHead}>
          <View style={styles.ringSmall}><Icon color={colors.copperSoft} size={17} strokeWidth={1.7} /></View>
          <Text style={styles.placement}>{section.placement.label}</Text>
        </View>
        <Text style={styles.body}>{section.body}</Text>
        {section.questions && section.questions.length > 0 ? (
          <View style={styles.questions}>
            {section.questions.map((q) => (
              <View key={q} style={styles.questionRow}>
                <Text style={styles.questionMark}>—</Text>
                <Text style={styles.questionText}>{q}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider}><View style={styles.dividerLine} /><View style={styles.dividerDot} /><View style={styles.dividerLine} /></View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: "transparent", flex: 1 },
  pageContent: { backgroundColor: "transparent", paddingBottom: 110 },
  center: { alignItems: "center", backgroundColor: colors.black, flex: 1, justifyContent: "center" },
  col: { alignItems: "center", alignSelf: "center", gap: 44, maxWidth: 760, paddingTop: 64, width: "100%" },

  headerBlock: { alignItems: "center", gap: 16 },
  eyebrow: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1.4, textAlign: "center", textTransform: "uppercase" },
  title: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 46, lineHeight: 52, textAlign: "center" },
  titleNarrow: { fontSize: 34, lineHeight: 40 },
  sub: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 18, lineHeight: 28, maxWidth: 640, textAlign: "center" },

  wheelBlock: { alignItems: "center", gap: 14 },
  wheelCaption: { color: colors.boneDim, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },

  indexWrap: { alignItems: "center", alignSelf: "stretch", gap: 14 },
  indexLabel: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  indexChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  chip: { alignItems: "center", backgroundColor: colors.card, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 9 },
  chipNum: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 11 },
  chipText: { color: colors.bone, fontFamily: "Inter_500Medium", fontSize: 14 },

  section: { alignSelf: "stretch", gap: 24 },
  sectionInner: { alignItems: "center", gap: 24 },
  marker: { alignItems: "center", gap: 12 },
  sectorKicker: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" },
  ring: { alignItems: "center", backgroundColor: "rgba(196,106,58,0.1)", borderColor: colors.line, borderRadius: 30, borderWidth: 1, height: 60, justifyContent: "center", width: 60 },
  ringSmall: { alignItems: "center", backgroundColor: "rgba(196,106,58,0.1)", borderColor: colors.line, borderRadius: 19, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  sectionTitle: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 32, lineHeight: 38, textAlign: "center" },
  sectionIntro: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 16, lineHeight: 24, maxWidth: 520, textAlign: "center" },
  interp: { alignSelf: "stretch", backgroundColor: colors.card, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 14, padding: 28 },
  interpHead: { alignItems: "center", flexDirection: "row", gap: 12 },
  placement: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 18 },
  body: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 17, lineHeight: 27 },

  questions: { borderTopColor: "rgba(244,238,228,0.1)", borderTopWidth: 1, gap: 10, marginTop: 6, paddingTop: 18 },
  questionRow: { flexDirection: "row", gap: 10 },
  questionMark: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 16 },
  questionText: { color: colors.bone, flex: 1, fontFamily: "Newsreader_500Medium", fontSize: 17, lineHeight: 25 },

  valuesBlock: { alignItems: "center", alignSelf: "stretch", gap: 16 },
  legendRow: { alignItems: "center", flexDirection: "row" },
  dot: { borderRadius: 5, height: 10, marginRight: 8, width: 10 },
  legendLabel: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: 0.5 },
  valuesNote: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 23, maxWidth: 560, textAlign: "center" },

  divider: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "center", paddingVertical: 4 },
  dividerLine: { backgroundColor: "rgba(214,154,106,0.35)", height: 1, width: 46 },
  dividerDot: { backgroundColor: colors.copperSoft, height: 6, transform: [{ rotate: "45deg" }], width: 6 },
  closing: { alignItems: "center", gap: 18 },
  disclaimer: { color: colors.boneDim, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 23, maxWidth: 560, textAlign: "center" },
  cta: { alignItems: "center", backgroundColor: colors.bone, borderRadius: 8, flexDirection: "row", gap: 9, paddingHorizontal: 20, paddingVertical: 14 },
  ctaText: { color: colors.black, fontFamily: "Inter_700Bold", fontSize: 14 }
});

export default OrbitaPersonality;
