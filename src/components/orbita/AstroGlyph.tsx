import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

import {
  ASTRO_GLYPH_STROKE,
  ASTRO_GLYPH_VIEWBOX,
  astroGlyphDef,
  type AstroGlyphKey
} from "@/domain/astroGlyphs";

/**
 * Dibuja un glifo astrológico del catálogo propio (`domain/astroGlyphs`).
 *
 * Es la ÚNICA presentación de símbolos astrológicos de la app: vectores
 * empaquetados, monocromos (el `color` que se pasa, típicamente un token del
 * tema) e idénticos en web, iOS y Android. Nada de fuentes del sistema, de
 * Unicode ni de emoji — ver la historia del bug en `domain/astroGlyphs`.
 *
 * `strokeWidth` va en unidades de la grilla de 24 (default
 * `ASTRO_GLYPH_STROKE`): el peso relativo del trazo es el mismo a cualquier
 * `size`.
 */

type ShapeProps = {
  symbol: AstroGlyphKey;
  color: string;
  strokeWidth?: number;
};

/** Las formas peladas del glifo, para componer DENTRO de un `<Svg>` existente. */
export function AstroGlyphShape({ symbol, color, strokeWidth = ASTRO_GLYPH_STROKE }: ShapeProps) {
  const def = astroGlyphDef(symbol);
  return (
    <>
      {(def.strokes ?? []).map((d, i) => (
        <Path
          key={`s${i}`}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
      {(def.rings ?? []).map((c, i) => (
        <Circle key={`r${i}`} cx={c.cx} cy={c.cy} r={c.r} stroke={color} strokeWidth={strokeWidth} fill="none" />
      ))}
      {(def.dots ?? []).map((c, i) => (
        <Circle key={`d${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={color} />
      ))}
    </>
  );
}

/**
 * Glifo centrado en `(cx, cy)` con lado `size`, para la rueda natal (u otro
 * `<Svg>` con su propio sistema de coordenadas).
 */
export function WheelAstroGlyph({
  symbol,
  cx,
  cy,
  size,
  color,
  strokeWidth
}: ShapeProps & { cx: number; cy: number; size: number }) {
  const scale = size / ASTRO_GLYPH_VIEWBOX;
  return (
    <G transform={`translate(${cx - size / 2}, ${cy - size / 2}) scale(${scale})`}>
      <AstroGlyphShape symbol={symbol} color={color} strokeWidth={strokeWidth} />
    </G>
  );
}

/** Glifo autónomo (su propio `<Svg>` cuadrado), para filas, marcadores y tríadas. */
export function AstroGlyph({
  symbol,
  size,
  color,
  strokeWidth,
  style
}: ShapeProps & { size: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${ASTRO_GLYPH_VIEWBOX} ${ASTRO_GLYPH_VIEWBOX}`} style={style}>
      <AstroGlyphShape symbol={symbol} color={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}
