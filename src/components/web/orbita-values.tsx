import { useQuery } from "convex/react";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import { ImmersiveScreen } from "@/components/web/immersive-bg";
import { Radar } from "@/components/orbita/Radar";
import { PlusLocked, RequireSession, WebLoading, WebNotice } from "@/components/web/require-session";
import { valuesMapPhase } from "@/domain/entitlement";
import { WebNav } from "@/components/web/web-nav";
import { appApi, proposedApi, type ValuesMapPayload } from "@/services/appRefs";

const colors = {
  black: "#07080A",
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  boneDim: "rgba(244, 238, 228, 0.5)",
  line: "rgba(214, 154, 106, 0.2)",
  blue: "#8CA6C4",
  panel: "rgba(11, 12, 15, 0.62)"
};

export function OrbitaValues() {
  return (
    <RequireSession>
      <ValuesWithBackend />
    </RequireSession>
  );
}

function ValuesWithBackend() {
  const data = useQuery(proposedApi.valuesMap, {});
  const entitlement = useQuery(appApi.subscriptions.getCurrent, {});
  const chart = useQuery(appApi.charts.current, {});
  // `valuesMap` devuelve `null` tanto para Free como para "todavía no hay
  // carta". Sin desambiguar, a un Free con su carta ya calculada le decíamos
  // "completá tus datos de nacimiento" — falso, y lo mandaba a rehacer el
  // onboarding.
  const phase = valuesMapPhase({
    values: data,
    entitlement,
    hasChart: chart === undefined ? undefined : chart !== null
  });

  switch (phase) {
    case "cargando":
      return <WebLoading />;
    case "bloqueado":
      return (
        <PlusLocked
          title="El mapa de valores es parte de Órbita Plus"
          body="Cruza tu carta natal para mostrar dónde tenés energía a favor y dónde aparece fricción."
        />
      );
    case "sinCarta":
      return (
        <WebNotice
          title="Todavía no hay mapa de valores"
          body="Se calcula a partir de tu carta natal. Completá tus datos de nacimiento y volvé."
        />
      );
    case "listo":
      return <ValuesScreen payload={data as ValuesMapPayload} />;
  }
}

export function ValuesScreen({ payload }: { payload: ValuesMapPayload }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 900;
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold, Newsreader_500Medium });
  if (!fontsLoaded) return <View style={styles.center}><ActivityIndicator color={colors.copperSoft} /></View>;
  const pad = isNarrow ? 24 : 120;
  const size = isNarrow ? Math.min(width - 48, 520) : 560;

  return (
    <ImmersiveScreen asset="ringSystem" opacity={0.2}>
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <WebNav active="carta" />
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <Text style={styles.eyebrow}>Mapa de valores</Text>
        <Text style={[styles.title, isNarrow && styles.titleNarrow]}>Qué te impulsa y qué te pesa.</Text>
        <Text style={styles.sub}>Una lectura de tus prioridades: dónde tenés energía a favor y dónde aparece fricción. Es una guía, no una etiqueta.</Text>
      </View>

      <View style={[styles.content, { paddingHorizontal: pad }, isNarrow && styles.stack]}>
        <View style={styles.radarWrap}><Radar payload={payload} size={size} /></View>
        <View style={[styles.side, !isNarrow && styles.sideWide]}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>REFERENCIAS</Text>
            <View style={styles.legendRow}><View style={[styles.dot, { backgroundColor: colors.copperSoft }]} /><Text style={styles.legendLabel}>Armonía</Text><Text style={styles.legendDetail}>Dónde tenés energía a favor.</Text></View>
            <View style={styles.legendRow}><View style={[styles.dot, { backgroundColor: colors.blue }]} /><Text style={styles.legendLabel}>Tensión</Text><Text style={styles.legendDetail}>Dónde aparece fricción.</Text></View>
          </View>

          <BarCard title="TE IMPULSA" items={payload.topDrivers} color={colors.copperSoft} />
          <BarCard title="TE PESA" items={payload.topStressors} color={colors.blue} />

          <View style={styles.card}>
            <Text style={styles.cardLabel}>CÓMO LEERLO</Text>
            <Text style={styles.noteBody}>{payload.note}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
    </ImmersiveScreen>
  );
}

function BarCard({ title, items, color }: { title: string; items: Array<{ label: string; value: number }>; color: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{title}</Text>
      {items.map((it) => (
        <View key={it.label} style={styles.barRow}>
          <View style={styles.barHead}>
            <Text style={styles.barLabel}>{it.label}</Text>
            <Text style={styles.barValue}>{Math.round(it.value * 100)}</Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(it.value * 100)}%`, backgroundColor: color }]} /></View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: "transparent", flex: 1 },
  pageContent: { backgroundColor: "transparent", paddingBottom: 96 },
  center: { alignItems: "center", backgroundColor: colors.black, flex: 1, justifyContent: "center" },
  header: { gap: 14, paddingBottom: 8, paddingTop: 56 },
  eyebrow: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 44, lineHeight: 50 },
  titleNarrow: { fontSize: 32, lineHeight: 38 },
  sub: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 18, lineHeight: 27, maxWidth: 660 },
  content: { flexDirection: "row", gap: 56, paddingBottom: 40, paddingTop: 40 },
  stack: { alignItems: "center", flexDirection: "column" },
  radarWrap: { alignItems: "center", justifyContent: "center" },
  side: { flex: 1, gap: 16, minWidth: 0 },
  sideWide: { minWidth: 300 },
  card: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 14, padding: 22 },
  cardLabel: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1 },
  legendRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  dot: { borderRadius: 5, height: 10, width: 10 },
  legendLabel: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 14 },
  legendDetail: { color: colors.boneMuted, flex: 1, fontFamily: "Inter_400Regular", fontSize: 13 },
  barRow: { gap: 8 },
  barHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  barLabel: { color: colors.bone, fontFamily: "Inter_500Medium", fontSize: 15 },
  barValue: { color: colors.boneDim, fontFamily: "Inter_700Bold", fontSize: 13 },
  track: { backgroundColor: "rgba(244,238,228,0.1)", borderRadius: 3, height: 6, overflow: "hidden", width: "100%" },
  fill: { borderRadius: 3, height: 6 },
  noteBody: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 }
});

export default OrbitaValues;
