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
import { appApi, type NatalChartPayload } from "@/services/appRefs";

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

const SIGN_ABBR: Record<string, string> = {
  Aries: "ARI", Tauro: "TAU", "Géminis": "GÉM", "Cáncer": "CÁN", Leo: "LEO", Virgo: "VIR",
  Libra: "LIB", Escorpio: "ESC", Sagitario: "SAG", Capricornio: "CAP", Acuario: "ACU", Piscis: "PIS"
};
const PLANET_ABBR: Record<string, string> = {
  Sol: "Sol", Luna: "Luna", Mercurio: "Mer", Venus: "Ven", Marte: "Mar", "Júpiter": "Júp", Saturno: "Sat",
  Urano: "Ura", Neptuno: "Nep", "Plutón": "Plu"
};
// Ángulos fijos (mismo layout que el diseño Figma), por orden de placements.
const PLANET_ANGLES = [35, 200, 60, 12, 315, 145, 240];

function pt(r: number, deg: number, c = 320): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [c + r * Math.cos(a), c - r * Math.sin(a)];
}

function NatalWheel({ payload, size }: { payload: NatalChartPayload; size: number }) {
  const R1 = 300, R2 = 252, R3 = 108;
  const boundaries = Array.from({ length: 12 }, (_, i) => 180 - i * 30);
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);
  const signMids = Array.from({ length: 12 }, (_, i) => 180 - i * 30 - 15);
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  const signOrder = ["ARI", "TAU", "GÉM", "CÁN", "LEO", "VIR", "LIB", "ESC", "SAG", "CAP", "ACU", "PIS"];

  // Posición real por longitud eclíptica (fullDegree): ángulo de rueda = 180 - grado.
  // Fallback a ángulos fijos para el mock (sin `degree`).
  const planets = payload.placements
    .filter((p) => PLANET_ABBR[p.planet])
    .map((p, i) => ({
      ...p,
      deg: typeof p.degree === "number" ? (180 - p.degree + 360) % 360 : PLANET_ANGLES[i % PLANET_ANGLES.length]
    }));
  const angleOf: Record<string, number> = {};
  planets.forEach((p) => { angleOf[p.planet] = p.deg; });

  return (
    <Svg width={size} height={size} viewBox="0 0 640 640">
      {/* rings */}
      <Circle cx={320} cy={320} r={R1} fill="none" stroke={colors.copper} strokeOpacity={0.55} strokeWidth={1.4} />
      <Circle cx={320} cy={320} r={R2} fill="none" stroke={colors.copper} strokeOpacity={0.35} strokeWidth={1} />
      <Circle cx={320} cy={320} r={R3} fill="none" stroke={colors.copperSoft} strokeOpacity={0.45} strokeWidth={1} />
      <Circle cx={320} cy={320} r={4} fill={colors.copperSoft} fillOpacity={0.8} />
      {/* boundaries */}
      {boundaries.map((deg, i) => {
        const [x1, y1] = pt(R3, deg); const [x2, y2] = pt(R1, deg);
        return <Line key={`b${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.copper} strokeOpacity={0.28} strokeWidth={1} />;
      })}
      {/* ticks */}
      {ticks.map((deg, i) => {
        const [x1, y1] = pt(R1, deg); const [x2, y2] = pt(R1 - (deg % 30 === 0 ? 12 : 6), deg);
        return <Line key={`t${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.copper} strokeOpacity={0.3} strokeWidth={1} />;
      })}
      {/* aspects */}
      {payload.aspects.map((a, i) => {
        if (angleOf[a.from] === undefined || angleOf[a.to] === undefined) return null;
        const [x1, y1] = pt(205, angleOf[a.from]); const [x2, y2] = pt(205, angleOf[a.to]);
        return (
          <Line key={`a${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={a.harmony === "tension" ? colors.copper : colors.blue} strokeOpacity={0.42} strokeWidth={1} />
        );
      })}
      {/* planet dots */}
      {planets.map((p, i) => {
        const [x, y] = pt(225, p.deg);
        return (
          <React.Fragment key={`p${i}`}>
            <Circle cx={x} cy={y} r={9} fill={colors.black} stroke={colors.copperSoft} strokeOpacity={0.7} strokeWidth={1.2} />
            <Circle cx={x} cy={y} r={3} fill={colors.copperSoft} />
          </React.Fragment>
        );
      })}
      {/* sign labels */}
      {signMids.map((deg, i) => {
        const [x, y] = pt(276, deg);
        return (
          <SvgText key={`s${i}`} x={x} y={y + 4} fill={colors.bone} fillOpacity={0.8}
            fontFamily="Inter_700Bold" fontSize={11} textAnchor="middle">{signOrder[i]}</SvgText>
        );
      })}
      {/* house numerals */}
      {signMids.map((deg, i) => {
        const [x, y] = pt(84, deg);
        return (
          <SvgText key={`h${i}`} x={x} y={y + 3.5} fill={colors.bone} fillOpacity={0.4}
            fontFamily="Inter_400Regular" fontSize={10} textAnchor="middle">{romans[i]}</SvgText>
        );
      })}
      {/* planet labels */}
      {planets.map((p, i) => {
        const [x, y] = pt(186, p.deg);
        return (
          <SvgText key={`pl${i}`} x={x} y={y + 4} fill={colors.copperSoft}
            fontFamily="Inter_500Medium" fontSize={11} textAnchor="middle">{PLANET_ABBR[p.planet] ?? p.planet}</SvgText>
        );
      })}
    </Svg>
  );
}

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
function mapNatalChart(doc: unknown): NatalChartPayload {
  const p = ((doc as { payload?: unknown })?.payload ?? doc ?? {}) as Record<string, unknown>;
  const raw: Array<Record<string, unknown>> = Array.isArray(p.placements) ? (p.placements as Array<Record<string, unknown>>) : [];
  const noon = p.calculationTimeSource === "noon_fallback";
  const find = (k: string) => raw.find((x) => x.key === k);
  const signOf = (x?: Record<string, unknown>) => cap((x?.signEs as string) ?? (x?.sign as string));
  const houseOf = (x?: Record<string, unknown>) => (typeof x?.house === "number" ? (x.house as number) : undefined);

  // Sin hora válida no hay Asc/casas fiables → los sacamos de la lista.
  const skip = new Set(noon ? ["ascendant", "midheaven"] : []);
  const placements = raw
    .filter((x) => !skip.has(x.key as string))
    .map((x) => ({
      planet: (x.label as string) ?? (x.key as string),
      sign: signOf(x),
      house: houseOf(x),
      degree: typeof x.fullDegree === "number" ? (x.fullDegree as number) : undefined
    }));

  const sun = find("sun"), moon = find("moon"), asc = find("ascendant");
  const triad = {
    sun: { planet: "Sol", sign: signOf(sun) || "—", house: houseOf(sun) },
    moon: { planet: "Luna", sign: signOf(moon) || "—", house: houseOf(moon) },
    ascendant: { planet: "Ascendente", sign: noon || !asc ? "—" : signOf(asc) }
  };

  const byKey: Record<string, string> = {};
  raw.forEach((x) => { byKey[x.key as string] = (x.label as string) ?? (x.key as string); });
  const aspects = (Array.isArray(p.aspects) ? (p.aspects as Array<Record<string, unknown>>) : [])
    .filter((a) => byKey[a.from as string] && byKey[a.to as string])
    .map((a) => ({
      from: byKey[a.from as string],
      to: byKey[a.to as string],
      type: ((a.typeEs as string) ?? (a.type as string)) || "",
      harmony: HARMONY_BY_TYPE[a.type as string] ?? "harmony"
    }));

  const houses = (Array.isArray(p.houses) ? (p.houses as Array<Record<string, unknown>>) : [])
    .map((h) => ({ house: (h.house as number) ?? (h.number as number), sign: signOf(h) }));

  return {
    triad,
    placements,
    houses,
    aspects,
    accuracy: noon ? "Hora aproximada · ascendente y casas pendientes" : "Hora exacta · ascendente afinado",
    limitations: []
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
