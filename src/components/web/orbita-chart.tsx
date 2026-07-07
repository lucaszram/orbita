import { useAction, useMutation, useQuery } from "convex/react";
import React, { useState } from "react";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { Link } from "expo-router";
import { AlertCircle, ArrowRight, Clock } from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { ImmersiveScreen } from "@/components/web/immersive-bg";
import { LiveGate } from "@/components/web/live";
import { WebNav } from "@/components/web/web-nav";
import { chartMock } from "@/content/chartMock";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { appApi, type NatalChartAspect, type NatalChartPayload, type SignPlacement } from "@/services/appRefs";

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

// La rueda natal se consolidó en un solo componente compartido (rotado al
// Ascendente, con cúspides reales y tappable). Se re-exporta para no romper imports.
export { NatalWheel };

// ---------------------------------------------------------------------------

export function OrbitaChart() {
  return <LiveGate mock={<ChartScreen payload={chartMock} />} live={() => <ChartWithBackend />} />;
}

function ChartWithBackend() {
  const data = useQuery(appApi.charts.current, {});
  if (data === undefined) return <Status kind="loading" />;
  if (data === null) return <Status kind="empty" />;
  const payload = mapNatalChart(data);
  const birth = (data as { payload?: { birth?: BirthInfo } })?.payload?.birth;
  const needsTime = payload.triad.ascendant.sign === "—" && !!birth;
  return <ChartScreen payload={payload} topSlot={needsTime ? <BirthTimeFixer birth={birth as BirthInfo} /> : undefined} />;
}

type BirthInfo = {
  birthDate: string;
  birthPlaceLabel: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
};

/** Campo para corregir/agregar la hora de nacimiento y recalcular sin re-hacer el onboarding. */
function BirthTimeFixer({ birth }: { birth: BirthInfo }) {
  const complete = useMutation(appApi.onboarding.completeBirthData);
  const calc = useAction(appApi.charts.calculateOrCreateNatalChart);
  const [time, setTime] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const valid = /^([01]?\d|2[0-3]):[0-5]\d$/.test(time.trim());

  async function save() {
    if (!valid || state === "saving") return;
    setState("saving");
    try {
      await complete({
        birthDate: birth.birthDate,
        birthPlaceLabel: birth.birthPlaceLabel,
        latitude: birth.latitude,
        longitude: birth.longitude,
        timezone: birth.timezone,
        birthTime: time.trim(),
        birthTimePrecision: "known"
      });
      await calc({});
      // charts.current se actualiza solo (reactividad) → aparece el Ascendente.
    } catch {
      setState("error");
    }
  }

  return (
    <View style={styles.fixer}>
      <View style={styles.fixerHead}>
        <Clock color={colors.copperSoft} size={18} strokeWidth={1.8} />
        <Text style={styles.fixerTitle}>Agregá tu hora de nacimiento</Text>
      </View>
      <Text style={styles.fixerBody}>Sin la hora exacta no podemos calcular tu Ascendente ni tus casas. Ingresala en 24h y recalculamos.</Text>
      <View style={styles.fixerRow}>
        <TextInput
          value={time}
          onChangeText={setTime}
          placeholder="10:40"
          placeholderTextColor={colors.boneDim}
          style={styles.fixerInput}
          keyboardType="numbers-and-punctuation"
        />
        <Pressable onPress={save} style={[styles.fixerBtn, (!valid || state === "saving") && styles.fixerBtnOff]} disabled={!valid || state === "saving"}>
          <Text style={styles.fixerBtnText}>{state === "saving" ? "Recalculando…" : "Guardar y recalcular"}</Text>
        </Pressable>
      </View>
      {state === "error" && <Text style={styles.fixerError}>No se pudo recalcular. Probá de nuevo.</Text>}
    </View>
  );
}

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const HARMONY_BY_TYPE: Record<string, "harmony" | "tension"> = {
  trine: "harmony", sextile: "harmony", conjunction: "harmony",
  square: "tension", opposition: "tension", quincunx: "tension", inconjunct: "tension"
};

/** Traduce el payload real de `charts.current` (AstrologyAPI) a `NatalChartPayload`. */
export function mapNatalChart(doc: unknown): NatalChartPayload {
  const p = ((doc as { payload?: unknown })?.payload ?? doc ?? {}) as Record<string, unknown>;
  const raw: Array<Record<string, unknown>> = Array.isArray(p.placements) ? (p.placements as Array<Record<string, unknown>>) : [];
  const noon = p.calculationTimeSource === "noon_fallback";
  const find = (k: string) => raw.find((x) => x.key === k);
  const signOf = (x?: Record<string, unknown>) => cap((x?.signEs as string) ?? (x?.sign as string));
  const houseOf = (x?: Record<string, unknown>) => (typeof x?.house === "number" ? (x.house as number) : undefined);
  const numOr = (v: unknown) => (typeof v === "number" ? v : undefined);

  const toPlacement = (x?: Record<string, unknown>, fallbackPlanet?: string): SignPlacement => ({
    planet: (x?.label as string) ?? fallbackPlanet ?? (x?.key as string) ?? "",
    key: (x?.key as string) ?? undefined,
    sign: signOf(x),
    house: houseOf(x),
    degree: numOr(x?.fullDegree), // compat: la rueda vieja lee `degree` como longitud
    fullDegree: numOr(x?.fullDegree),
    normDegree: numOr(x?.degree),
    isRetrograde: typeof x?.isRetrograde === "boolean" ? (x.isRetrograde as boolean) : undefined
  });

  // Sin hora válida no hay Asc/casas fiables → los sacamos de la lista.
  const skip = new Set(noon ? ["ascendant", "midheaven"] : []);
  const placements = raw.filter((x) => !skip.has(x.key as string)).map((x) => toPlacement(x));

  const sun = find("sun"), moon = find("moon"), asc = find("ascendant");
  const triad = {
    sun: { ...toPlacement(sun, "Sol"), planet: "Sol", sign: signOf(sun) || "—" },
    moon: { ...toPlacement(moon, "Luna"), planet: "Luna", sign: signOf(moon) || "—" },
    ascendant: { ...toPlacement(asc, "Ascendente"), planet: "Ascendente", sign: noon || !asc ? "—" : signOf(asc) }
  };

  const byKey: Record<string, string> = {};
  raw.forEach((x) => { byKey[x.key as string] = (x.label as string) ?? (x.key as string); });
  const mapAspect = (a: Record<string, unknown>): NatalChartAspect => ({
    from: byKey[a.from as string] ?? (a.from as string),
    to: byKey[a.to as string] ?? (a.to as string),
    type: (a.type as string) ?? "",
    typeEs: (a.typeEs as string) ?? undefined,
    harmony: HARMONY_BY_TYPE[a.type as string] ?? "harmony",
    orb: numOr(a.orb),
    isMajor: typeof a.isMajor === "boolean" ? (a.isMajor as boolean) : undefined
  });
  const withNames = (a: Record<string, unknown>) => byKey[a.from as string] && byKey[a.to as string];
  const aspects = (Array.isArray(p.aspects) ? (p.aspects as Array<Record<string, unknown>>) : [])
    .filter(withNames)
    .map(mapAspect);

  const houses = (Array.isArray(p.houses) ? (p.houses as Array<Record<string, unknown>>) : [])
    .map((h) => ({
      house: (h.house as number) ?? (h.number as number),
      sign: signOf(h),
      cusp: numOr(h.degree),
      theme: (h.theme as string) ?? undefined
    }));

  const summary = (p.summary ?? {}) as Record<string, unknown>;
  const summaryAsc = summary.ascendant as Record<string, unknown> | undefined;
  const ascendantDegree = houses.find((h) => h.house === 1)?.cusp ?? numOr(summaryAsc?.fullDegree);
  const mc = houses.find((h) => h.house === 10)?.cusp;
  const mainAspects = (Array.isArray(summary.mainAspects) ? (summary.mainAspects as Array<Record<string, unknown>>) : [])
    .filter(withNames)
    .map(mapAspect);

  return {
    triad,
    placements,
    houses,
    aspects,
    ascendantDegree: noon ? undefined : ascendantDegree,
    mc: noon ? undefined : mc,
    mainAspects: mainAspects.length ? mainAspects : undefined,
    accuracy: noon ? "Hora aproximada · ascendente y casas pendientes" : "Hora exacta · ascendente afinado",
    limitations: Array.isArray(summary.limitations) ? (summary.limitations as string[]) : []
  };
}

function Status({ kind }: { kind: "loading" | "empty" }) {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold, Newsreader_500Medium });
  if (!fontsLoaded) {
    return <View style={styles.center}><ActivityIndicator color={colors.copperSoft} /></View>;
  }
  if (kind === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.copperSoft} />
        <Text style={styles.statusText}>Calculando tu carta…</Text>
      </View>
    );
  }
  return (
    <View style={styles.center}>
      <View style={styles.statusCard}>
        <AlertCircle color={colors.copperSoft} size={22} strokeWidth={1.7} />
        <Text style={styles.statusTitle}>Todavía no hay carta</Text>
        <Text style={styles.statusBody}>Completá tus datos de nacimiento y calculamos tu carta base.</Text>
      </View>
    </View>
  );
}

export function ChartScreen({ payload, topSlot }: { payload: NatalChartPayload; topSlot?: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 900;
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold, Newsreader_500Medium });
  if (!fontsLoaded) {
    return <View style={styles.center}><ActivityIndicator color={colors.copperSoft} /></View>;
  }
  const pad = isNarrow ? 24 : 120;
  const wheelSize = isNarrow ? Math.min(width - 48, 520) : 560;
  const triadDetails: Record<string, string> = {
    Sol: "Tu identidad y voluntad.",
    Luna: "Tu mundo emocional.",
    Ascendente: "Cómo te presentás. Se afina con la hora."
  };
  const triad = [payload.triad.sun, payload.triad.moon, payload.triad.ascendant];

  return (
    <ImmersiveScreen asset="natalChart" opacity={0.2}>
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <WebNav active="carta" />
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <Text style={styles.eyebrow}>Carta natal</Text>
        <Text style={[styles.title, isNarrow && styles.titleNarrow]}>Estos son tus puntos de partida.</Text>
        <Text style={styles.sub}>Tu cielo exacto en el instante en que naciste. Sobre esto se calcula todo lo demás.</Text>
      </View>

      {topSlot ? <View style={{ paddingHorizontal: pad }}>{topSlot}</View> : null}

      <View style={[styles.content, { paddingHorizontal: pad }, isNarrow && styles.stack]}>
        <View style={styles.wheelWrap}>
          <NatalWheel payload={payload} size={wheelSize} />
        </View>

        <View style={styles.side}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>TU TRÍADA</Text>
            {triad.map((p) => (
              <View key={p.planet} style={styles.triadRow}>
                <Text style={styles.triadRole}>{p.planet.toUpperCase()}</Text>
                <View style={styles.triadLine}>
                  <Text style={styles.triadSign}>{p.sign}</Text>
                  <Text style={styles.triadDetail}>{triadDetails[p.planet] ?? ""}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>POSICIONES CLAVE</Text>
            {payload.placements.map((p, i) => (
              <View key={p.planet} style={[styles.placeRow, i > 0 && styles.placeRowBorder]}>
                <Text style={styles.placeLeft}>
                  <Text style={styles.placeName}>{p.planet}</Text>
                  <Text style={styles.placeSign}> · {p.sign}</Text>
                </Text>
                {p.house ? <Text style={styles.placeHouse}>{`Casa ${p.house}`}</Text> : <Text style={styles.placeHouse}>—</Text>}
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>ASPECTOS</Text>
            <View style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: colors.blue }]} />
              <Text style={styles.legendLabel}>Armonía</Text>
              <Text style={styles.legendDetail}>Energías que fluyen entre sí.</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: colors.copper }]} />
              <Text style={styles.legendLabel}>Tensión</Text>
              <Text style={styles.legendDetail}>Energías que se friccionan.</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>CÓMO LEERLA</Text>
            <Text style={styles.noteBody}>
              Esta rueda es tu base: no cambia. Cada lectura diaria se calcula mirando cómo los tránsitos de hoy tocan estos puntos.
            </Text>
            <Link href="/home" asChild>
              <Pressable style={styles.cta}>
                <Text style={styles.ctaText}>Ver mi día</Text>
                <ArrowRight color={colors.black} size={17} strokeWidth={2.1} />
              </Pressable>
            </Link>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>MÁS DE TU CARTA</Text>
            <Link href="/valores" asChild>
              <Pressable style={styles.linkRow}>
                <Text style={styles.linkText}>Mapa de valores</Text>
                <ArrowRight color={colors.copperSoft} size={16} strokeWidth={2} />
              </Pressable>
            </Link>
            <Link href="/personalidad" asChild>
              <Pressable style={styles.linkRow}>
                <Text style={styles.linkText}>Horóscopo de personalidad</Text>
                <ArrowRight color={colors.copperSoft} size={16} strokeWidth={2} />
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </ScrollView>
    </ImmersiveScreen>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: "transparent", flex: 1 },
  pageContent: { backgroundColor: "transparent", paddingBottom: 96 },
  center: { alignItems: "center", backgroundColor: colors.black, flex: 1, gap: 14, justifyContent: "center", padding: 24 },
  statusText: { color: colors.boneMuted, fontFamily: "Inter_500Medium", fontSize: 14 },
  statusCard: { alignItems: "flex-start", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 8, maxWidth: 420, padding: 24 },
  statusTitle: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 24 },
  statusBody: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },

  header: { gap: 14, paddingBottom: 8, paddingTop: 56 },
  eyebrow: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 44, lineHeight: 50 },
  titleNarrow: { fontSize: 32, lineHeight: 38 },
  sub: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 18, lineHeight: 27, maxWidth: 640 },

  content: { alignItems: "flex-start", flexDirection: "row", gap: 56, paddingBottom: 40, paddingTop: 40 },
  stack: { alignItems: "center", flexDirection: "column" },
  wheelWrap: { alignItems: "center" },
  side: { flex: 1, gap: 16, minWidth: 300 },

  card: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 14, padding: 22 },
  cardLabel: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1 },
  fixer: { backgroundColor: "rgba(196,106,58,0.08)", borderColor: "rgba(214,154,106,0.35)", borderRadius: 12, borderWidth: 1, gap: 12, marginBottom: 24, padding: 20 },
  fixerHead: { alignItems: "center", flexDirection: "row", gap: 9 },
  fixerTitle: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 15 },
  fixerBody: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  fixerRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fixerInput: { backgroundColor: "rgba(7,8,10,0.5)", borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.bone, fontFamily: "Inter_500Medium", fontSize: 16, paddingHorizontal: 14, paddingVertical: 11, width: 110 },
  fixerBtn: { backgroundColor: colors.bone, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  fixerBtnOff: { opacity: 0.4 },
  fixerBtnText: { color: colors.black, fontFamily: "Inter_700Bold", fontSize: 14 },
  fixerError: { color: colors.copperSoft, fontFamily: "Inter_500Medium", fontSize: 13 },

  triadRow: { gap: 3 },
  triadRole: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.6 },
  triadLine: { alignItems: "baseline", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  triadSign: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 22 },
  triadDetail: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 13 },

  placeRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 11 },
  placeRowBorder: { borderTopColor: "rgba(244,238,228,0.08)", borderTopWidth: 1 },
  placeLeft: { flex: 1 },
  placeName: { color: colors.bone, fontFamily: "Inter_500Medium", fontSize: 15 },
  placeSign: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 15 },
  placeHouse: { color: colors.copperSoft, fontFamily: "Inter_500Medium", fontSize: 13 },

  legendRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  dot: { borderRadius: 5, height: 10, width: 10 },
  legendLabel: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 14 },
  legendDetail: { color: colors.boneMuted, flex: 1, fontFamily: "Inter_400Regular", fontSize: 13 },

  noteBody: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  cta: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.bone, borderRadius: 8, flexDirection: "row", gap: 9, paddingHorizontal: 18, paddingVertical: 13 },
  ctaText: { color: colors.black, fontFamily: "Inter_700Bold", fontSize: 14 },
  linkRow: { alignItems: "center", borderTopColor: "rgba(244,238,228,0.08)", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 },
  linkText: { color: colors.bone, fontFamily: "Inter_500Medium", fontSize: 15 }
});

export default OrbitaChart;
