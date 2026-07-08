import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { orbita } from "@/theme/orbita";

/**
 * Alerta dismissable post-onboarding: avisa que la carta natal ya está lista e invita
 * a verla. Al tocar el cuerpo → hub de la Carta; la × la descarta (no vuelve). Sin
 * rueda — la carta full-bleed quedaba pésima arriba de la Home.
 */
export function CartaBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.banner}>
        <Pressable
          style={({ pressed }) => [styles.body, pressed && styles.pressed]}
          onPress={() => router.push("/(tabs)/carta")}
          accessibilityRole="button"
          accessibilityLabel="Ver mi carta natal"
        >
          <Text style={styles.eyebrow}>YA TENÉS TU CARTA NATAL</Text>
          <Text style={styles.title}>Miralá entera — cada planeta, explicado →</Text>
        </Pressable>
        <Pressable
          onPress={() => setVisible(false)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar aviso"
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: orbita.spacing.gutter, paddingTop: orbita.spacing.lg },
  banner: {
    alignItems: "center",
    backgroundColor: "rgba(196,106,58,0.14)",
    borderColor: "rgba(214,154,106,0.45)",
    borderRadius: orbita.radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    paddingLeft: orbita.spacing.lg,
    paddingRight: orbita.spacing.sm,
    paddingVertical: orbita.spacing.md
  },
  body: { flex: 1, paddingVertical: 2 },
  pressed: { opacity: 0.6 },
  eyebrow: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 1.5 },
  title: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 17, marginTop: 3 },
  close: { alignItems: "center", height: 32, justifyContent: "center", width: 32 },
  closeText: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 22, lineHeight: 24 }
});
