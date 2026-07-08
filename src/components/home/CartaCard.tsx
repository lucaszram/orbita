import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { mapNatalChart } from "@/components/web/orbita-chart";
import { chartMock } from "@/content/chartMock";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appApi, type NatalChartPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/**
 * Card de la carta natal (vive en el Perfil): mini-rueda real + tríada + CTA al
 * hub de la Carta (`/(tabs)/carta`), que a su vez lleva a la rueda inmersiva.
 * Data real con sesión, mock para invitados.
 */
export function CartaCard() {
  const { isLive } = useLiveApp();
  const doc = useQuery(appApi.charts.current, isLive ? {} : "skip");

  let payload: NatalChartPayload = chartMock;
  if (isLive && doc) {
    try {
      payload = mapNatalChart(doc);
    } catch {
      payload = chartMock;
    }
  }
  const t = payload.triad;

  return (
    <View style={styles.section}>
      <Pressable
        onPress={() => router.push("/(tabs)/carta")}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
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
  pressed: { opacity: 0.7 },
  eyebrow: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 2.5 },
  wheelWrap: { alignItems: "center", marginVertical: orbita.spacing.lg },
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
