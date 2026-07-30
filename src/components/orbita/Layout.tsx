import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { CANVAS_MAX_WIDTH } from "@/domain/webLayout";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { orbita } from "@/theme/orbita";

/**
 * Composición de dos (o más) columnas, compartida por todas las pantallas.
 *
 * En escritorio pone sus hijos en fila; en móvil no hace absolutamente nada y
 * los hijos quedan apilados EN EL ORDEN EN QUE ESTÁN ESCRITOS. Por eso agregar
 * la composición de escritorio a una pantalla no cambia la de teléfono: el
 * orden de lectura del móvil es el orden del JSX.
 *
 * No lee el viewport: el modo viene del contexto que publica el shell web.
 */
export function Columns({
  children,
  gap = orbita.spacing.xxl,
  align = "flex-start",
  style
}: {
  children: ReactNode;
  gap?: number;
  align?: "flex-start" | "center" | "stretch";
  style?: object;
}) {
  const desktop = useIsDesktop();
  return <View style={[desktop && { alignItems: align, flexDirection: "row", gap }, style]}>{children}</View>;
}

/**
 * Una columna dentro de `Columns`. `weight` reparte el ancho en escritorio
 * (`flex`); en móvil es un `View` transparente.
 *
 * `minWidth: 0` no es decorativo: sin él una columna con texto largo se niega a
 * encogerse por debajo de su contenido y la fila desborda horizontalmente.
 */
export function Column({ children, weight = 1, style }: { children: ReactNode; weight?: number; style?: object }) {
  const desktop = useIsDesktop();
  return <View style={[desktop && { flex: weight, minWidth: 0 }, style]}>{children}</View>;
}

/**
 * Caja de texto acotada DENTRO de un lienzo que no lo está.
 *
 * En una pantalla `wide` (1200) —o `immersive` (sin tope)— los párrafos largos
 * no pueden medir todo el ancho: se vuelven ilegibles. Esto los deja en el
 * ancho de lectura sin tener que anidar otro lienzo.
 *
 * `fill`: para las fases que son `flex: 1` con algo anclado abajo (el Umbral).
 * Sin heredar el alto, el bloque colapsa al contenido y la barra de preguntar
 * sube al medio de la pantalla.
 */
export function ReadingBlock({
  children,
  fill,
  style
}: {
  children: ReactNode;
  fill?: boolean;
  style?: object;
}) {
  return <View style={[styles.reading, fill && styles.fill, style]}>{children}</View>;
}

/** Sólo en escritorio. Para piezas que existen únicamente en la composición ancha. */
export function DesktopOnly({ children }: { children: ReactNode }) {
  return useIsDesktop() ? <>{children}</> : null;
}

/** Sólo en móvil/nativo. */
export function MobileOnly({ children }: { children: ReactNode }) {
  return useIsDesktop() ? null : <>{children}</>;
}

const styles = StyleSheet.create({
  reading: { maxWidth: CANVAS_MAX_WIDTH.reading, width: "100%" },
  fill: { flex: 1 }
});
