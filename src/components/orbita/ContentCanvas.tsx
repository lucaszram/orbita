import { useCallback, useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { CONTENT_CANVAS_MAX_WIDTH, fitSquare } from "@/domain/contentCanvas";

/**
 * Columna de contenido de la app autenticada, compartida por web y nativo.
 *
 * Móvil: ancho completo (las gutters las ponen las `Section`, igual que en
 * nativo). Escritorio: centrada con ancho máximo. No lee el viewport y no
 * escala tipografías ni tarjetas con el ancho de la ventana — el ancho máximo es
 * un número fijo y el resto es layout normal.
 *
 * En un teléfono el `maxWidth` no cambia nada (siempre es mayor que el ancho de
 * pantalla), así que montar esto en las pantallas canónicas no altera el nativo.
 */
export function ContentCanvas({ children, fill }: { children: ReactNode; fill?: boolean }) {
  return (
    <View style={[styles.outer, fill && styles.fill]}>
      <View style={[styles.canvas, fill && styles.fill]}>{children}</View>
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

const styles = StyleSheet.create({
  outer: { alignItems: "center", width: "100%" },
  canvas: { maxWidth: CONTENT_CANVAS_MAX_WIDTH, width: "100%" },
  // `fill`: para pantallas cuyo contenido es `flex: 1` con algo anclado abajo
  // (los pasos del alta, el Umbral). Sin heredar el alto, la columna colapsa al
  // contenido y el CTA sube al medio de la pantalla.
  fill: { flex: 1 },
  square: { alignItems: "center", justifyContent: "center", width: "100%" }
});
