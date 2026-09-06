import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { AstroGlyph } from "@/components/orbita/AstroGlyph";
import type { AstroGlyphKey } from "@/domain/astroGlyphs";

/**
 * Línea de tríada (u otra lista corta de cuerpos): glifo REAL + rótulo por
 * unidad. Antes era un solo `Text` con códigos de dos letras; ahora cada unidad
 * es glifo vectorial + texto, y el wrap parte ENTRE unidades ("☉ Escorpio"
 * nunca se corta entre el glifo y su signo — la regla de siempre, conservada).
 *
 * El estilo del texto lo pone cada superficie (`textStyle`), igual que antes;
 * el glifo toma `glyphColor` (típicamente el mismo color del texto o el cobre
 * del tema) y escala con `glyphSize`.
 *
 * Una unidad puede traer un `marker` textual en lugar del glifo (ver el tipo):
 * es la excepción del Ascendente, no una vuelta a los códigos de dos letras.
 */

export type TriadLineUnit = {
  symbol: AstroGlyphKey;
  label: string;
  /**
   * Marcador TEXTUAL que reemplaza al glifo SÓLO en esta unidad, con la
   * tipografía del rótulo y el color del glifo. Existe por el Ascendente: su
   * notación canónica es el monograma `Ac`, que dibujado a 14 px al lado de dos
   * glifos planetarios se lee como una sigla y no como un símbolo. Donde la
   * superficie ya lo nombra con la flecha ascendente —el hub de la Carta—, la
   * tarjeta usa la misma flecha y no otra cosa.
   *
   * No reemplaza al glifo del catálogo: `symbol` sigue siendo la identidad de
   * la unidad, y las ruedas y las tablas de datos siguen dibujando `Ac`.
   */
  marker?: string;
};

export function TriadLine({
  units,
  textStyle,
  glyphColor,
  glyphSize = 14,
  glyphStrokeWidth,
  gap = 14,
  centered = false,
  style
}: {
  units: TriadLineUnit[];
  textStyle: StyleProp<TextStyle>;
  glyphColor: string;
  glyphSize?: number;
  glyphStrokeWidth?: number;
  /** Espacio horizontal entre unidades. */
  gap?: number;
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.row, { columnGap: gap }, centered && styles.centered, style]}>
      {units.map((u) => (
        <View key={`${u.symbol}-${u.label}`} style={styles.unit}>
          {u.marker ? (
            <Text style={[textStyle, { color: glyphColor, fontSize: glyphSize }]}>{u.marker}</Text>
          ) : (
            <AstroGlyph symbol={u.symbol} size={glyphSize} color={glyphColor} strokeWidth={glyphStrokeWidth} />
          )}
          <Text style={textStyle}>{u.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", rowGap: 6 },
  centered: { justifyContent: "center" },
  unit: { alignItems: "center", flexDirection: "row", gap: 6 }
});
