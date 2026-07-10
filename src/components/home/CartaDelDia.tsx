import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Eyebrow, Section } from "@/components/orbita/kit";
import { orbita } from "@/theme/orbita";

// Cara de la carta (mock: La Luna). El tarot real lo baraja el backend.
const CARD_IMG = require("../../../assets/orbita/optimized/core/orbita_home_hero_orbital_a.jpg");

// TODO: pendiente backend — la carta del día (endpoint `tarot` sembrado por
// usuario+fecha) + el diccionario verificado de arquetipos + el prompt del puente
// (carta × tránsito, honesto/no-chanta). Hoy: mock tipado.
const MOCK = {
  nombre: "La Luna",
  descripcion: "Intuición y lo que se mueve por debajo — eso que sabés sin explicar del todo."
};

/** Módulo "Tu carta de hoy" en la Home: la carta (mock) + un teaser + leer.
 *  Al tocar, abriría el revelado con los 3 beats (qué es / cómo influye / con tu cielo). */
export function CartaDelDia({ onLeer }: { onLeer?: () => void }) {
  return (
    <Section style={styles.section}>
      <Eyebrow>TU CARTA DE HOY</Eyebrow>
      <Pressable onPress={onLeer} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button">
        <View style={styles.card}>
          <Image source={CARD_IMG} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={styles.cardLabelWrap}>
            <Text style={styles.cardLabel}>{MOCK.nombre}</Text>
          </View>
        </View>
        <View style={styles.mid}>
          <Text style={styles.name}>{MOCK.nombre}</Text>
          <Text style={styles.desc}>{MOCK.descripcion}</Text>
          <Text style={styles.cta}>Leer tu carta  →</Text>
        </View>
      </Pressable>
    </Section>
  );
}

const styles = StyleSheet.create({
  section: { borderTopColor: orbita.colors.line, borderTopWidth: 1 },
  row: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.lg, marginTop: orbita.spacing.md },
  pressed: { opacity: 0.7 },
  card: {
    borderColor: "rgba(196,106,58,0.6)",
    borderRadius: 12,
    borderWidth: 1,
    height: 164,
    justifyContent: "flex-end",
    overflow: "hidden",
    width: 110
  },
  cardLabelWrap: { backgroundColor: "rgba(7,8,10,0.55)", paddingBottom: orbita.spacing.sm, paddingTop: orbita.spacing.sm },
  cardLabel: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 15, textAlign: "center" },
  mid: { flex: 1, gap: orbita.spacing.sm },
  name: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 26, lineHeight: 30 },
  desc: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 14, lineHeight: 20 },
  cta: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 0.5, marginTop: orbita.spacing.xs }
});
