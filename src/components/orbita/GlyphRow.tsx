import { Pressable, StyleSheet, Text, View } from "react-native";

import { AstroGlyph } from "@/components/orbita/AstroGlyph";
import { bodySymbolForName } from "@/domain/astroSymbols";
import type { BodyGlyphKey } from "@/domain/astroGlyphs";
import { orbita } from "@/theme/orbita";

/**
 * Fila editorial con marcador circular + símbolo astrológico (Figma V4.7:
 * Carta/Posiciones 266:11 y Tránsitos/Por área 267:2). El símbolo se deriva
 * del primer cuerpo que aparezca en el título.
 */

/**
 * Glifo del cuerpo del título: la clave del catálogo vectorial propio
 * (`domain/astroGlyphs`). Antes devolvía glifos Unicode (que caían al font de
 * emoji en web y Android) y después códigos de dos letras; hoy todos los
 * cuerpos tienen su símbolo real empaquetado.
 */
export function glyphFor(title: string): BodyGlyphKey {
  return bodySymbolForName(title) ?? "sun";
}

export function GlyphRow({ title, body, onPress }: { title: string; body: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.head}>
        <View style={styles.marker}>
          <AstroGlyph symbol={glyphFor(title)} size={14} color={orbita.colors.bone} strokeWidth={2} />
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
