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
import { PlusLocked, RequireSession } from "@/components/web/require-session";
import { WebNav } from "@/components/web/web-nav";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { mapNatalChart } from "@/domain/natalChart";
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
  return (
    <RequireSession>
      <ChartWithBackend />
    </RequireSession>
  );
}

function ChartWithBackend() {
  const data = useQuery(appApi.charts.current, {});
  if (data === undefined) return <Status kind="loading" />;
  if (data === null) return <Status kind="empty" />;
  const payload = mapNatalChart(data);
  const birth = (data as { payload?: { birth?: BirthInfo } })?.payload?.birth;
  const needsTime = payload.triad.ascendant.sign === "—" && !!birth;
  // El backend P0 no manda casas ni aspectos a Free. Sin esta señal, las
  // secciones quedaban vacías y se leían como un error de cálculo.
  const access = (data as { access?: { houses?: boolean; aspects?: boolean } })?.access;
  return (
    <ChartScreen
      payload={payload}
      showAspects={access?.aspects !== false}
      topSlot={needsTime ? <BirthTimeFixer birth={birth as BirthInfo} /> : undefined}
    />
  );
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

export function ChartScreen({
  payload,
  topSlot,
  showAspects = true
}: {
  payload: NatalChartPayload;
  topSlot?: React.ReactNode;
  /** Free no recibe aspectos: se nombra el bloqueo en vez de dejar la tarjeta vacía. */
  showAspects?: boolean;
}) {
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

        <View style={[styles.side, !isNarrow && styles.sideWide]}>
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

          {showAspects ? (
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
          ) : (
            <PlusLocked
              title="Aspectos y casas en Órbita Plus"
              body="Tu rueda, tu tríada y tus posiciones son tuyas siempre. El cruce entre planetas y el reparto por casas son parte de Plus."
            />
          )}

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
  side: { flex: 1, gap: 16, minWidth: 0 },
  sideWide: { minWidth: 300 },

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
