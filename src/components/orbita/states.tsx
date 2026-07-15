import { ReactNode, useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { EditorialThumb } from "@/components/orbita/HeroImage";
import { orbita } from "@/theme/orbita";
import { Pill } from "./kit";

/**
 * Content-only state blocks (drop inside an OrbitaScreen / DetailScreen).
 * Figma V4.7 sección 07 · Estados: Cargando / Vacío / Error / Bloqueado —
 * emblema circular con glow cobre y composición centrada.
 */

const EMBLEMS = {
  moon: require("../../../assets/orbita/optimized/core/orbita_home_hero_orbital_b.jpg"),
  phase: require("../../../assets/orbita/optimized/core/orbita_moon_phase_waxing.jpg"),
  texture: require("../../../assets/orbita/optimized/core/orbita_daily_texture_a.jpg")
} as const;

function Emblem({ kind, size = 170 }: { kind: keyof typeof EMBLEMS; size?: number }) {
  return (
    <View style={[styles.emblemGlow, { borderRadius: size / 2 }]}>
      <Image
        source={EMBLEMS[kind]}
        style={{ borderRadius: size / 2, height: size, opacity: 0.92, width: size }}
        resizeMode="cover"
      />
    </View>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

export function LoadingState({
  eyebrow = "UN MOMENTO",
  title = "Leyendo tu cielo.",
  body = "La lectura de hoy llega en segundos."
}: {
  eyebrow?: string;
  title?: string;
  body?: string;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const orbitLoop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })
    );
    const barLoop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    orbitLoop.start();
    barLoop.start();
    return () => {
      orbitLoop.stop();
      barLoop.stop();
    };
  }, [spin, sweep]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  // La barra no marca progreso real (no lo conocemos): barre en loop, señal honesta de "trabajando".
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-96, 240] });

  return (
    <Centered>
      <View style={styles.orbit}>
        <Emblem kind="moon" />
        <Animated.View style={[styles.orbitSpinner, { transform: [{ rotate }] }]}>
          <View style={styles.orbitRing} />
          <View style={styles.orbitDot} />
        </Animated.View>
      </View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { transform: [{ translateX }] }]} />
      </View>
    </Centered>
  );
}

export function EmptyState({ title, body, cta, onCta, eyebrow = "GUARDADAS" }: { title: string; body: string; cta?: string; onCta?: () => void; eyebrow?: string }) {
  return (
    <Centered>
      <View style={styles.emblemZone}>
        <Emblem kind="phase" />
      </View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {cta ? (
        <View style={{ marginTop: orbita.spacing.xxl }}>
          <Pill label={cta} onPress={onCta} />
        </View>
      ) : null}
    </Centered>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <Centered>
      <View style={styles.emblemZone}>
        <Emblem kind="texture" />
      </View>
      <Text style={styles.eyebrow}>SEÑAL PERDIDA</Text>
      <Text style={styles.title}>No pudimos{"\n"}traer tu cielo.</Text>
      <Text style={styles.body}>Parece la conexión. Tu lectura sigue ahí: probá de nuevo en un momento.</Text>
      <View style={{ marginTop: orbita.spacing.xxl }}>
        <Pill label="REINTENTAR" onPress={onRetry} />
      </View>
    </Centered>
  );
}

export function LockedState({ onUnlock }: { onUnlock?: () => void }) {
  return (
    <View style={styles.lockedWrap}>
      <View style={styles.thumb}>
        <EditorialThumb height={170} />
        <View style={styles.plusChip}>
          <Text style={styles.plusChipText}>PLUS</Text>
        </View>
      </View>
      <Text style={styles.lockedTitle}>El análisis{"\n"}completo de hoy.</Text>
      <Text style={styles.lockedBody}>
        Ves el resumen. La lectura completa, tus cuatro áreas y el calendario son parte de Órbita Plus.
      </Text>
      <View style={{ marginTop: orbita.spacing.xl }}>
        <Pill label="DESBLOQUEAR CON PLUS" onPress={onUnlock} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: orbita.spacing.xxl },
  emblemZone: { marginBottom: orbita.spacing.xxl },

  emblemGlow: {
    shadowColor: orbita.colors.copper,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 46
  },
  orbit: { alignItems: "center", justifyContent: "center", marginBottom: orbita.spacing.xxl, padding: 22 },
  orbitSpinner: {
    alignItems: "center",
    height: 214,
    justifyContent: "center",
    position: "absolute",
    width: 214
  },
  orbitRing: {
    borderColor: "rgba(244,238,228,0.22)",
    borderRadius: 107,
    borderWidth: 1,
    height: 214,
    position: "absolute",
    width: 214
  },
  orbitDot: {
    backgroundColor: orbita.colors.copper,
    borderRadius: 3.5,
    height: 7,
    position: "absolute",
    right: 24,
    top: 34,
    width: 7
  },

  eyebrow: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: orbita.spacing.md,
    textAlign: "center"
  },
  title: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serif,
    fontSize: 32,
    lineHeight: 38,
    textAlign: "center"
  },
  body: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: orbita.spacing.lg,
    maxWidth: 300,
    textAlign: "center"
  },
  track: {
    backgroundColor: orbita.colors.line,
    borderRadius: 2,
    height: 4,
    marginTop: orbita.spacing.xxl,
    overflow: "hidden",
    width: 240
  },
  fill: { backgroundColor: orbita.colors.copper, borderRadius: 2, height: 4, width: 96 },

  lockedWrap: { paddingTop: orbita.spacing.xl },
  thumb: { marginBottom: orbita.spacing.xl },
  plusChip: {
    backgroundColor: orbita.colors.copper,
    borderRadius: 12,
    left: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    position: "absolute",
    top: 12
  },
  plusChipText: { color: orbita.colors.onLight, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 1 },
  lockedTitle: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 32, lineHeight: 38 },
  lockedBody: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15, lineHeight: 22, marginTop: orbita.spacing.lg }
});
