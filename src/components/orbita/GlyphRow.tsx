import { Pressable, StyleSheet, Text, View } from "react-native";
import { orbita } from "@/theme/orbita";

/**
 * Fila editorial con marcador circular + glifo astrológico (Figma V4.7:
 * Carta/Posiciones 266:11 y Tránsitos/Por área 267:2). El glifo se deriva
 * del primer cuerpo que aparezca en el título.
 */
const GLYPHS: [RegExp, string][] = [
  [/\bSol\b/i, "☉"],
  [/\bLuna\b/i, "☽"],
  [/\bAscendente\b/i, "↑"],
  [/\bMercurio\b/i, "☿"],
  [/\bVenus\b/i, "♀"],
  [/\bMarte\b/i, "♂"],
  [/\bJ[úu]piter\b/i, "♃"],
  [/\bSaturno\b/i, "♄"]
];

export function glyphFor(title: string): string {
  // Gana el cuerpo que aparece primero en el título (el sujeto del tránsito),
  // no el orden de la lista: "Venus armoniza al Sol" → ♀, no ☉.
  let best: string | null = null;
  let bestIndex = Infinity;
  for (const [re, glyph] of GLYPHS) {
    const m = title.match(re);
    if (m && m.index !== undefined && m.index < bestIndex) {
      bestIndex = m.index;
      best = glyph;
    }
  }
  return best ?? "☉";
}

export function GlyphRow({ title, body, onPress }: { title: string; body: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.head}>
        <View style={styles.marker}>
          <Text style={styles.glyph}>{glyphFor(title)}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.arrow}>→</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomColor: orbita.colors.line, borderBottomWidth: 1, paddingVertical: orbita.spacing.xl },
  pressed: { opacity: 0.6 },
  head: { alignItems: "center", flexDirection: "row" },
  marker: {
    alignItems: "center",
    borderColor: orbita.colors.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    marginRight: orbita.spacing.md,
    width: 24
  },
  glyph: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 12 },
  title: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.serif, fontSize: 24, lineHeight: 30 },
  arrow: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 20, marginLeft: orbita.spacing.md },
  body: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 24 + orbita.spacing.md,
    marginTop: orbita.spacing.sm
  }
});
