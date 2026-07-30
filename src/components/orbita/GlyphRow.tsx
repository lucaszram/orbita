import { Pressable, StyleSheet, Text, View } from "react-native";
import { bodyCodeForName } from "@/domain/astroSymbols";
import { orbita } from "@/theme/orbita";

/**
 * Fila editorial con marcador circular + símbolo astrológico (Figma V4.7:
 * Carta/Posiciones 266:11 y Tránsitos/Por área 267:2). El símbolo se deriva
 * del primer cuerpo que aparezca en el título.
 */

/**
 * Código monocromo del cuerpo del título. Antes devolvía glifos Unicode
 * (`☉ ☽ ☿ ♀ ♂ ♃ ♄`) que ninguna familia empaquetada tiene: en web y Android
 * caían al font de emoji. Ver `domain/astroSymbols`.
 */
export function glyphFor(title: string): string {
  return bodyCodeForName(title) ?? "SO";
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
    borderColor: "rgba(244,238,228,0.28)",
    borderRadius: 13,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    marginRight: orbita.spacing.md,
    width: 26
  },
  // Mono: el código son dos letras y tienen que caber centradas en el marcador.
  glyph: { color: orbita.colors.bone, fontFamily: orbita.fonts.mono, fontSize: 11, letterSpacing: 0.5 },
  title: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.serif, fontSize: 24, lineHeight: 30 },
  arrow: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 20, marginLeft: orbita.spacing.md },
  body: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 26 + orbita.spacing.md,
    marginTop: orbita.spacing.sm
  }
});
