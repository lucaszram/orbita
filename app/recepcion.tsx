import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { HomeBackdrop } from "@/components/home/HomeBackdrop";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { mapNatalChart } from "@/components/web/orbita-chart";
import { markFirstRun } from "@/services/firstRun";
import { useAppState } from "@/hooks/useAppState";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { useRequireProfile } from "@/hooks/useRequireProfile";
import { appApi, type NatalChartPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

/** La ceremonia de recepción (día 1, una sola vez): la primera entrega del día 1
 *  post-onboarding es la carta natal — el activo por el que se paga — como momento
 *  full-screen propio, no como banner dentro de la Home (Figma App Core, sección
 *  "13 · Primer día · doble entrega", frame 679:2).
 *
 *  El headline es EL DATO (fecha, hora, lugar): la autoridad sale de la
 *  especificidad. "ENTRAR A MI CARTA" abre el tab Carta (que explica QUÉ ES la
 *  primera vez); "VER DESPUÉS" deja al usuario en la Home, donde la segunda
 *  entrega (el tarot diario) se explica en su lugar de trabajo.
 */
export default function RecepcionScreen() {
  const { isReady, profile } = useRequireProfile();
  const fontsLoaded = useOrbitaFonts();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // La tríada real llega del onboarding (calculada sin login vía previewDailyHome):
  // no dependemos de que la carta ya esté persistida en Convex.
  const { sol, luna, asc } = useLocalSearchParams<{ sol?: string; luna?: string; asc?: string }>();

  const { isLive } = useLiveApp();
  const chartDoc = useQuery(appApi.charts.current, isLive ? {} : "skip");

  useEffect(() => {
    void markFirstRun({ recepcionVista: true });
  }, []);

  if (!isReady || !profile || !fontsLoaded) {
    return <View style={styles.screen} />;
  }

  // La rueda: SOLO la real (con sesión, apenas el backend la tenga). Acá no va la
  // demo ni para invitados: el headline y la tríada son datos reales del usuario,
  // y una rueda ajena al lado los desmiente (feedback Lucas 2026-07-15). Mientras
  // no hay carta, el espacio queda en el fondo estelar.
  let payload: NatalChartPayload | null = null;
  if (isLive && chartDoc) {
    try {
      payload = mapNatalChart(chartDoc);
    } catch {
      payload = null;
    }
  }

  // La tríada por unidades enteras ("☉ Escorpio") para que el wrap con nombres
  // largos parta entre unidades y no entre el glifo y su signo.
  const triadItems = (
    sol || luna || asc
      ? [sol ? `☉ ${sol}` : null, luna ? `☽ ${luna}` : null, asc ? `↑ ${asc}` : null]
      : payload
        ? [`☉ ${payload.triad.sun.sign}`, `☽ ${payload.triad.moon.sign}`, `↑ ${payload.triad.ascendant.sign}`]
        : []
  ).filter((t): t is string => Boolean(t));

  // Solo la ciudad: el label completo del geocoding ("Buenos Aires, Ciudad Autónoma
  // de Buenos Aires, Argentina") vuelve el headline un párrafo.
  const lugar = profile.birthPlace?.split(",")[0]?.trim();
  const partes = [fechaLarga(profile.birthDate), profile.birthTime, lugar]
    .filter(Boolean)
    .join(", ");
  const wheelSize = Math.min(width - orbita.spacing.gutter * 6, 260);

  return (
    <View style={styles.screen}>
      <HomeBackdrop />
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + orbita.spacing.xxl, paddingBottom: insets.bottom + orbita.spacing.xxl }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.wheelWrap, { height: wheelSize }]}>
          {payload ? <NatalWheel payload={payload} size={wheelSize} /> : null}
        </View>

        {triadItems.length ? (
          <View style={styles.triadRow}>
            {triadItems.map((item, i) => (
              <Text key={item} style={styles.triad}>
                {i > 0 ? "·  " : ""}
                {item}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.eyebrow}>TU CARTA NATAL</Text>
        <Text style={styles.headline}>{`El cielo del ${partes}.`}</Text>
        <Text style={styles.body}>
          De ese momento salen tu Sol, tu Luna y tu ascendente. No cambia nunca: todo lo que Órbita te lea se lee
          sobre esta carta.
        </Text>
        {!profile.birthTime ? (
          <Text style={styles.note}>Calculada sin hora exacta: el ascendente y las casas son aproximados.</Text>
        ) : null}

        <Pressable onPress={() => router.replace("/(tabs)/carta")} accessibilityRole="button" style={styles.cta}>
          <Text style={styles.ctaLabel}>ENTRAR A MI CARTA</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace("/(tabs)")}
          accessibilityRole="button"
          hitSlop={12}
          style={styles.later}
        >
          <Text style={styles.laterLabel}>VER DESPUÉS</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#07080A", flex: 1 },
  // Flujo natural (sin centrado vertical): con textos largos el centrado aplastaba
  // el bloque del CTA contra el borde inferior y los elementos se encimaban.
  content: { paddingHorizontal: orbita.spacing.gutter },
  wheelWrap: { alignItems: "center", justifyContent: "center", marginBottom: orbita.spacing.lg, marginTop: orbita.spacing.md },
  triadRow: {
    columnGap: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: orbita.spacing.xxl,
    rowGap: 6
  },
  triad: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 0.5
  },
  eyebrow: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 1.5
  },
  headline: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serif,
    fontSize: 30,
    lineHeight: 37,
    marginTop: orbita.spacing.md
  },
  body: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: orbita.spacing.lg
  },
  note: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: orbita.spacing.md
  },
  cta: {
    alignItems: "center",
    backgroundColor: orbita.colors.bone,
    borderRadius: orbita.radius.lg,
    marginTop: orbita.spacing.xxl,
    paddingVertical: orbita.spacing.lg
  },
  ctaLabel: { color: "#1A1A1A", fontFamily: orbita.fonts.monoMedium, fontSize: 13, letterSpacing: 1 },
  later: { alignItems: "center", marginTop: orbita.spacing.xl },
  laterLabel: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 1.5
  },
  pressed: { opacity: 0.7 }
});
