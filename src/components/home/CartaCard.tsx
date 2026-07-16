import { type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { mapNatalChart } from "@/components/web/orbita-chart";
import { dataPhase, sessionPhase } from "@/domain/screenPhase";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appApi, type NatalChartPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/**
 * Carta natal en la Home/Perfil: mini-rueda real + tríada + CTA al hub de la Carta
 * (`/(tabs)/carta`). `variant="card"` (default) = recuadro con borde (Perfil).
 * `variant="hero"` = full-bleed sin borde, primera impresión post-onboarding.
 * Sin mocks: invitado → mensaje honesto; con sesión, carga / vacío / error se
 * distinguen de verdad (nunca spinner infinito ni rueda demo como tuya).
 */
export function CartaCard({ variant = "card" }: { variant?: "card" | "hero" }) {
  const live = useLiveApp();
  const phase = sessionPhase(live);
  const doc = useQuery(appApi.charts.current, phase === "live" ? {} : "skip");
  const hero = variant === "hero";

  if (phase === "cargando") {
    return (
      <CardFrame hero={hero}>
        <View style={[styles.wheelWrap, styles.stateZone]}>
          <ActivityIndicator color={orbita.colors.copper} />
        </View>
      </CardFrame>
    );
  }
  if (phase === "error") {
    return (
      <CardFrame hero={hero} onPress={live.retryUser} ctaLabel="REINTENTAR">
        <Text style={styles.stateText}>No pudimos abrir tu sesión.</Text>
      </CardFrame>
    );
  }
  if (phase === "invitado") {
    return (
      <CardFrame hero={hero} onPress={() => router.push("/iniciar-sesion")} ctaLabel="INICIAR SESIÓN">
        <Text style={styles.stateText}>
          Tu carta se calcula con tu cuenta, con tu fecha, hora y lugar de nacimiento reales.
        </Text>
      </CardFrame>
    );
  }

  let payload: NatalChartPayload | null = null;
  let mapFailed = false;
  if (doc) {
    try {
      payload = mapNatalChart(doc);
    } catch {
      mapFailed = true;
    }
  }
  const chartPhase = dataPhase({ pending: doc === undefined, failed: mapFailed, empty: doc === null });

  if (chartPhase === "cargando") {
    return (
      <CardFrame hero={hero}>
        <View style={[styles.wheelWrap, styles.stateZone]}>
          <ActivityIndicator color={orbita.colors.copper} />
        </View>
      </CardFrame>
    );
  }
  if (chartPhase === "vacio") {
    return (
      <CardFrame hero={hero} onPress={() => router.push("/editar-datos")} ctaLabel="COMPLETAR MIS DATOS">
        <Text style={styles.stateText}>
          Todavía no hay carta. Completá tu fecha, hora y lugar de nacimiento para calcularla.
        </Text>
      </CardFrame>
    );
  }
  if (chartPhase === "error" || !payload) {
    return (
      <CardFrame hero={hero} onPress={() => router.push("/(tabs)/carta")} ctaLabel="VER MI CARTA →">
        <Text style={styles.stateText}>No pudimos leer tu carta. Abrila para ver qué pasa.</Text>
      </CardFrame>
    );
  }
  const t = payload.triad;

  return (
    <View style={hero ? styles.heroSection : styles.section}>
      <Pressable
        onPress={() => router.push("/(tabs)/carta")}
        style={({ pressed }) => [hero ? styles.hero : styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Ver mi carta natal"
      >
        <Text style={styles.eyebrow}>TU CARTA NATAL</Text>
        <View style={styles.wheelWrap} pointerEvents="none">
          <NatalWheel payload={payload} size={232} />
        </View>
        <Text style={styles.triad}>{`☉ ${t.sun.sign}    ☽ ${t.moon.sign}    ↑ ${t.ascendant.sign}`}</Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>VER MI CARTA →</Text>
        </View>
      </Pressable>
    </View>
  );
}

/** Marco compartido de la tarjeta para los estados (carga / vacío / error /
 *  invitado): mismo recuadro y eyebrow que la tarjeta real, con CTA opcional. */
function CardFrame({
  hero,
  onPress,
  ctaLabel,
  children
}: {
  hero: boolean;
  onPress?: () => void;
  ctaLabel?: string;
  children: ReactNode;
}) {
  return (
    <View style={hero ? styles.heroSection : styles.section}>
      <Pressable
        onPress={onPress ?? (() => router.push("/(tabs)/carta"))}
        style={({ pressed }) => [hero ? styles.hero : styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Tu carta natal"
      >
        <Text style={styles.eyebrow}>TU CARTA NATAL</Text>
        {children}
        {ctaLabel ? (
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: orbita.spacing.gutter, paddingTop: orbita.spacing.xl },
  card: {
    alignItems: "center",
    backgroundColor: "rgba(14,16,20,0.55)",
    borderColor: orbita.colors.line,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: orbita.spacing.lg,
    paddingVertical: orbita.spacing.xl
  },
  // Variante héroe (post-onboarding): full-bleed, sin borde ni recuadro.
  heroSection: { paddingHorizontal: orbita.spacing.gutter, paddingTop: orbita.spacing.lg },
  hero: { alignItems: "center", paddingVertical: orbita.spacing.lg },
  pressed: { opacity: 0.7 },
  eyebrow: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 2.5 },
  wheelWrap: { alignItems: "center", marginVertical: orbita.spacing.lg },
  // Mismo alto que la rueda (232) para que el placeholder no salte al resolver.
  stateZone: { height: 232, justifyContent: "center" },
  stateText: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginVertical: orbita.spacing.xl,
    textAlign: "center"
  },
  triad: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: orbita.spacing.lg,
    textAlign: "center"
  },
  cta: {
    alignItems: "center",
    borderColor: "rgba(244,238,228,0.35)",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: orbita.spacing.xl,
    paddingVertical: orbita.spacing.md
  },
  ctaText: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 1.5 }
});
