import { useCallback, useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { fitSquare } from "@/domain/contentCanvas";
import { canvasMaxWidth, type CanvasVariant } from "@/domain/webLayout";

/**
 * Columna de contenido de la app autenticada, compartida por web y nativo.
 *
 * Móvil: ancho completo (las gutters las ponen las `Section`, igual que en
 * nativo). Escritorio: centrada con el ancho máximo de su VARIANTE — `wide`
 * (1200) para las pantallas que componen en dos columnas, `reading` (720) para
 * las que son texto largo, `immersive` (sin tope) para las que son una sola
 * pieza a pantalla completa.
 *
 * No lee el viewport y no escala tipografías ni tarjetas con el ancho de la
 * ventana: los topes son números fijos y el resto es layout normal.
 *
 * En un teléfono ningún tope cambia nada (siempre es mayor que el ancho de
 * pantalla), así que montar esto en las pantallas canónicas no altera el nativo.
 */
export function ContentCanvas({
  children,
  fill,
  variant = "reading"
}: {
  children: ReactNode;
  fill?: boolean;
  variant?: CanvasVariant;
}) {
  const max = canvasMaxWidth(variant);
  return (
    <View style={[styles.outer, fill && styles.fill]}>
      <View style={[styles.canvas, max !== null && { maxWidth: max }, fill && styles.fill]}>{children}</View>
    </View>
  );
}

/**
 * Zona cuadrada dimensionada por su CONTENEDOR, nunca por el viewport.
 *
 * Mide su propio ancho con `onLayout` y llama a `children(size)` recién cuando
 * tiene una medida real. Hasta entonces reserva el alto de `max` para que el
 * contenido no salte cuando aparece la rueda.
 */
export function MeasuredSquare({
  max,
  inset,
  children,
  style
}: {
  max: number;
  /** Aire lateral propio de la pantalla, descontado del ancho medido. */
  inset?: number;
  children: (size: number) => ReactNode;
  style?: object;
}) {
  const [container, setContainer] = useState<number | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    // Se ignoran medidas nulas (primer layout en algunos casos) y se evita
    // re-renderizar por diferencias sub-pixel del navegador.
    setContainer((prev) => (w > 0 && (prev === null || Math.abs(prev - w) >= 1) ? w : prev));
  }, []);
  const size = fitSquare({ container, max, inset });

  return (
    <View onLayout={onLayout} style={[styles.square, { minHeight: size ?? max }, style]}>
      {size === null ? null : children(size)}
    </View>
  );
}

/**
 * Caja medida NO cuadrada: le da a `children` el ancho REAL de su contenedor.
 *
 * Existe por el mismo motivo que `MeasuredSquare`, aplicado a los heros: en
 * react-native-web una `<Image>` dimensionada en porcentaje dentro de una caja
 * posicionada puede terminar sin pintar y dejar un hueco negro del alto del
 * hero — que es exactamente lo que se veía en Tránsitos. Con ancho y alto en
 * píxeles el `<Image>` siempre resuelve, en web y en nativo.
 */
export function MeasuredBox({
  height,
  children,
  style
}: {
  height: number;
  children: (width: number) => ReactNode;
  style?: object;
}) {
  const [width, setWidth] = useState<number | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidth((prev) => (w > 0 && (prev === null || Math.abs(prev - w) >= 1) ? w : prev));
  }, []);

  return (
    <View onLayout={onLayout} style={[{ height, width: "100%" }, style]}>
      {width === null ? null : children(Math.floor(width))}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignItems: "center", width: "100%" },
  canvas: { width: "100%" },
  // `fill`: para pantallas cuyo contenido es `flex: 1` con algo anclado abajo
  // (los pasos del alta, el Umbral). Sin heredar el alto, la columna colapsa al
  // contenido y el CTA sube al medio de la pantalla.
  fill: { flex: 1 },
  square: { alignItems: "center", justifyContent: "center", width: "100%" }
});
