import { useQuery } from "convex/react";
import React from "react";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { Check } from "lucide-react-native";
import { ActivityIndicator, ImageBackground, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { LiveGate } from "@/components/web/live";
import { WebNav } from "@/components/web/web-nav";
import { transitMock } from "@/content/transitMock";
import { webAssets } from "@/content/webAssets";
import { proposedApi, type TransitDetailPayload } from "@/services/appRefs";

const colors = {
  black: "#07080A",
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  boneDim: "rgba(244, 238, 228, 0.5)",
  line: "rgba(214, 154, 106, 0.2)",
  panel: "rgba(11, 12, 15, 0.62)"
};

const SW = 1160, SH = 440;
const P = {
  earth: [300, 350] as const,
  mercurio: [560, 225] as const,
  venus: [830, 100] as const
};

function SceneLabel({ text, x, y, anchor, accent }: { text: string; x: number; y: number; anchor: "center" | "left"; accent?: boolean }) {
  const w = text.length * 6.6 + 22;
  const h = 24;
  const rx = anchor === "center" ? x - w / 2 : x;
  const ry = y - h / 2;
  return (
    <React.Fragment>
      <Rect x={rx} y={ry} width={w} height={h} rx={7} fill="rgba(7,8,10,0.62)" stroke={colors.copper} strokeOpacity={0.28} strokeWidth={1} />
      <SvgText x={rx + w / 2} y={y + 4} fill={accent ? colors.copperSoft : colors.bone} fontFamily="Inter_700Bold" fontSize={11} textAnchor="middle">
        {text}
      </SvgText>
    </React.Fragment>
  );
}

function Scene({ payload }: { payload: TransitDetailPayload }) {
  const [ex, ey] = P.earth, [mx, my] = P.mercurio, [vx, vy] = P.venus;
  return (
    <Svg width="100%" height={SH} viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="xMidYMid meet">
      <Path d={`M ${ex} ${ey} L ${mx} ${my} L ${vx} ${vy}`} stroke={colors.copperSoft} strokeOpacity={0.55} strokeWidth={1.4} strokeDasharray="2 6" strokeLinecap="round" />
      {/* earth */}
      <Circle cx={ex} cy={ey} r={34} fill="#150F0A" stroke={colors.copperSoft} strokeOpacity={0.5} strokeWidth={1.2} />
      <Circle cx={ex} cy={ey} r={46} fill="none" stroke={colors.copperSoft} strokeOpacity={0.16} strokeWidth={1} />
      {/* mercurio */}
      <Circle cx={mx} cy={my} r={9} fill="#EBC7A6" />
      <Circle cx={mx} cy={my} r={20} fill="none" stroke={colors.copperSoft} strokeOpacity={0.35} strokeWidth={1} />
      {/* venus */}
      <Circle cx={vx} cy={vy} r={13} fill="#EBC7A6" />
      <Circle cx={vx} cy={vy} r={26} fill="none" stroke={colors.copperSoft} strokeOpacity={0.3} strokeWidth={1} />
      {/* labels */}
      <SceneLabel text="VOS" x={ex} y={ey + 62} anchor="center" />
      <SceneLabel text={payload.scene.transitingBody.label} x={mx + 30} y={my} anchor="left" />
      <SceneLabel text={payload.scene.natalPoint.label} x={vx + 30} y={vy} anchor="left" />
      <SceneLabel text={`${payload.aspect.type.toUpperCase()} · ${payload.aspect.angleLabel}`} x={(ex + mx) / 2 - 40} y={(ey + my) / 2 + 40} anchor="left" accent />
    </Svg>
  );
}

// ---------------------------------------------------------------------------

export function OrbitaTransit() {
  return <LiveGate mock={<TransitScreen payload={transitMock} />} live={() => <TransitWithBackend />} />;
}

function todayLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function TransitWithBackend() {
  const data = useQuery(proposedApi.transitToday, { localDate: todayLocalDate() });
  if (data === undefined || data === null) {
    return <TransitScreen payload={transitMock} />;
  }
  return <TransitScreen payload={data} />;
}

export function TransitScreen({ payload }: { payload: TransitDetailPayload }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 900;
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold, Newsreader_500Medium });
  if (!fontsLoaded) {
    return <View style={styles.center}><ActivityIndicator color={colors.copperSoft} /></View>;
  }
  const pad = isNarrow ? 24 : 120;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <WebNav active="transitos" />
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <Text style={styles.eyebrow}>Tránsito de hoy</Text>
        <Text style={[styles.title, isNarrow && styles.titleNarrow]}>{payload.title}</Text>
        <Text style={styles.sub}>Un tránsito es un planeta de hoy que toca un punto de tu carta. Así se ve en el cielo, y así se juega en tu día.</Text>
      </View>

      {/* Scene */}
      <View style={[styles.sceneWrap, { paddingHorizontal: pad }]}>
        <ImageBackground source={webAssets.heroOrbital.require} resizeMode="cover" imageStyle={styles.sceneImage} style={styles.scene}>
          <LinearGradient colors={["rgba(5,6,8,0.72)", "rgba(5,6,8,0.5)"]} style={styles.sceneOverlay}>
            <Text style={styles.sceneEyebrow}>CÓMO SE VE EN EL CIELO</Text>
            <Scene payload={payload} />
          </LinearGradient>
        </ImageBackground>
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingHorizontal: pad }, isNarrow && styles.stack]}>
        <View style={styles.col}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>LA LECTURA</Text>
            {payload.reading.fragments.map((f) => (
              <View key={f.source} style={styles.frag}>
                <Text style={styles.fragSource}>{f.source}</Text>
                <Text style={styles.fragText}>{f.text}</Text>
              </View>
            ))}
            <Text style={styles.plain}>{payload.reading.plain}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>CADA CUÁNTO PASA</Text>
            <Text style={styles.freqLabel}>{payload.frequency.label}</Text>
            <View style={styles.timeline}>
              {payload.frequency.timeline.map((t) => (
                <View key={t.label} style={styles.tlItem}>
                  <View style={[styles.tlDot, t.current ? styles.tlDotNow : styles.tlDotOff]} />
                  <Text style={t.current ? styles.tlLabelNow : styles.tlLabel}>{t.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.col}>
          <View style={[styles.card, styles.cardHi]}>
            <Text style={styles.cardLabel}>CÓMO SE JUEGA EN LA TIERRA</Text>
            <Text style={styles.earthTitle}>{payload.earth.headline}</Text>
            <View style={styles.checkList}>
              {payload.earth.suggestions.map((s) => (
                <View key={s} style={styles.checkRow}>
                  <Check color={colors.copperSoft} size={18} strokeWidth={2.2} />
                  <Text style={styles.checkText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.winRow}>
              <Text style={styles.cardLabel}>LA VENTANA</Text>
              <Text style={styles.winValue}>{payload.window.label}</Text>
            </View>
            <Text style={styles.winNote}>{payload.window.note}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.black, flex: 1 },
  pageContent: { backgroundColor: colors.black, paddingBottom: 96 },
  center: { alignItems: "center", backgroundColor: colors.black, flex: 1, justifyContent: "center" },

  header: { gap: 14, paddingBottom: 24, paddingTop: 56 },
  eyebrow: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 44, lineHeight: 50 },
  titleNarrow: { fontSize: 32, lineHeight: 38 },
  sub: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 18, lineHeight: 27, maxWidth: 680 },

  sceneWrap: { width: "100%" },
  scene: { backgroundColor: "#0b0b0d", borderRadius: 16, overflow: "hidden", width: "100%" },
  sceneImage: { borderRadius: 16, opacity: 0.92 },
  sceneOverlay: { paddingBottom: 8, paddingTop: 24 },
  sceneEyebrow: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.5, paddingHorizontal: 28 },

  content: { flexDirection: "row", gap: 40, paddingTop: 40 },
  stack: { flexDirection: "column" },
  col: { flex: 1, gap: 16 },

  card: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 14, padding: 22 },
  cardHi: { backgroundColor: "rgba(196,106,58,0.09)", borderColor: "rgba(214,154,106,0.3)" },
  cardLabel: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1 },

  frag: { gap: 4 },
  fragSource: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.8 },
  fragText: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 21, lineHeight: 27 },
  plain: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },

  freqLabel: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 20 },
  timeline: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4 },
  tlItem: { alignItems: "center", gap: 8 },
  tlDot: { borderRadius: 6 },
  tlDotNow: { backgroundColor: colors.copper, height: 12, width: 12 },
  tlDotOff: { backgroundColor: "rgba(244,238,228,0.3)", height: 7, width: 7 },
  tlLabel: { color: colors.boneDim, fontFamily: "Inter_500Medium", fontSize: 11 },
  tlLabelNow: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 11 },

  earthTitle: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 27, lineHeight: 33 },
  checkList: { gap: 12, paddingTop: 2 },
  checkRow: { flexDirection: "row", gap: 11 },
  checkText: { color: colors.bone, flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },

  winRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  winValue: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 20 },
  winNote: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 }
});

export default OrbitaTransit;
