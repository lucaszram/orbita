import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { GuestState } from "@/components/orbita/GuestState";
import { EmptyState, ErrorState, LoadingState, MinimalLoading } from "@/components/orbita/states";
import { mapNatalChart } from "@/components/web/orbita-chart";
import { sessionPhase } from "@/domain/screenPhase";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { appApi, type NatalChartPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

const TEXTURE = require("../assets/orbita/optimized/core/orbita_daily_texture_b.jpg");

/**
 * Carta natal a pantalla completa e inmersiva: solo la rueda, con pinch-zoom + pan
 * (ScrollView nativo iOS). Sin tab bar. Data real con sesión; invitado → estado honesto.
 */
export default function CartaFullScreen() {
  const live = useLiveApp();
  const phase = sessionPhase(live);
  // Sin mocks: invitado confirmado → estado honesto; sesión resolviendo → carga mínima.
  if (phase === "cargando") {
    return (
      <Frame>
        <MinimalLoading />
      </Frame>
    );
  }
  if (phase === "error") {
    return (
      <Frame>
        <ErrorState onRetry={live.retryUser} />
      </Frame>
    );
  }
  if (phase === "invitado") {
    // Sin mocks: estado honesto de invitado, nunca la rueda demo como si fuera tuya.
    return (
      <Frame>
        <GuestState
          eyebrow="TU CARTA NATAL"
          title={"Tu carta se calcula\ncon tu cuenta."}
          body="Órbita usa tu fecha, hora y lugar de nacimiento reales para dibujar tu carta natal completa y explicártela."
        />
      </Frame>
    );
  }
  return <CartaFullLive />;
}

function CartaFullLive() {
  const doc = useQuery(appApi.charts.current, {});
  if (doc === undefined) return <Frame><LoadingState /></Frame>;
  if (doc === null) {
    return (
      <Frame>
        <EmptyState
          title="Todavía no hay carta"
          body="Completá tu fecha, hora y lugar de nacimiento para calcular tu carta natal."
          cta="COMPLETAR MIS DATOS"
          onCta={() => router.replace("/(tabs)/perfil")}
        />
      </Frame>
    );
  }
  let payload: NatalChartPayload;
  try {
    payload = mapNatalChart(doc);
  } catch {
    return <Frame><ErrorState /></Frame>;
  }
  return <CartaFullView payload={payload} />;
}

/** Marco inmersivo compartido (fondo + botón cerrar) para estados y contenido. */
function Frame({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Image source={TEXTURE} style={styles.bg} resizeMode="cover" />
      <LinearGradient
        colors={["rgba(10,11,14,0.7)", "rgba(10,11,14,0.85)", orbita.colors.background]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.topbar, { paddingTop: insets.top + orbita.spacing.sm }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/carta"))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function CartaFullView({ payload }: { payload: NatalChartPayload }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fontsLoaded = useOrbitaFonts();
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const size = Math.min(width - orbita.spacing.gutter, 380);
  const triad = payload.triad;

  if (!fontsLoaded) return <View style={styles.screen} />;

  return (
    <Frame>
      <View style={styles.hint}>
        <Text style={styles.eyebrow}>TU CARTA NATAL</Text>
        <Text style={styles.hintText}>Pellizcá para acercar · tocá un planeta</Text>
      </View>

      <ScrollView
        style={styles.zoom}
        contentContainerStyle={styles.zoomContent}
        maximumZoomScale={3}
        minimumZoomScale={1}
        centerContent
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <NatalWheel payload={payload} size={size} selectedKey={selected} onSelect={setSelected} />
      </ScrollView>

      <View style={[styles.triadBar, { paddingBottom: insets.bottom + orbita.spacing.lg }]}>
        <Text style={styles.triad}>
          {`☉ ${triad.sun.sign}    ☽ ${triad.moon.sign}    ↑ ${triad.ascendant.sign}`}
        </Text>
        {payload.accuracy ? <Text style={styles.accuracy}>{payload.accuracy}</Text> : null}
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: orbita.colors.background, flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, height: "100%", opacity: 0.4, width: "100%" },
  topbar: { alignItems: "flex-end", paddingHorizontal: orbita.spacing.gutter, position: "absolute", right: 0, top: 0, zIndex: 10 },
  close: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 22 },

  hint: { alignItems: "center", gap: orbita.spacing.xs, paddingTop: orbita.spacing.xxl * 2 },
  eyebrow: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 2.5 },
  hintText: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.monoMedium, fontSize: 10, letterSpacing: 1.2 },

  zoom: { flex: 1 },
  zoomContent: { alignItems: "center", flexGrow: 1, justifyContent: "center" },

  triadBar: { alignItems: "center", gap: orbita.spacing.xs, paddingHorizontal: orbita.spacing.gutter },
  triad: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 13, letterSpacing: 1, textAlign: "center" },
  accuracy: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.body, fontSize: 12, textAlign: "center" }
});
