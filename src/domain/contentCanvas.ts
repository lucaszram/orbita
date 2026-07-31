/**
 * Lienzo de contenido de la app autenticada — medida, no viewport.
 *
 * Las pantallas dimensionaban la rueda y el radar con `useWindowDimensions()`:
 * `Math.min(width - gutter * 2, 360)`. En el teléfono coincide con el ancho útil
 * por casualidad. En la web no: el ancho de la VENTANA no es el ancho del
 * contenedor donde vive la rueda —hay barra de navegación, una columna centrada
 * con ancho máximo y, en escritorio, cientos de píxeles de margen—, así que a
 * 1400px la rueda pedía 360 (tope) y a 700px pedía 652 aunque su columna midiera
 * 672 menos padding. El tamaño tiene que salir del contenedor REAL (`onLayout`),
 * que es la única medida que incluye el shell, el canvas y el padding de la
 * sección.
 *
 * El lienzo en sí es deliberadamente tonto: en móvil ocupa todo el ancho (las
 * gutters las siguen poniendo las `Section`, como en nativo) y en escritorio se
 * centra con un ancho máximo fijo. Nada de tipografías ni tarjetas que escalen
 * con el ancho de la ventana: el cuerpo de texto de Órbita mide lo mismo en un
 * teléfono y en un monitor de 27".
 */

import { CANVAS_MAX_WIDTH } from "@/domain/webLayout";

/**
 * Ancho máximo de la COLUMNA DE LECTURA (escritorio).
 *
 * Ya no es el único tope del producto: las variantes del lienzo viven en
 * `domain/webLayout` (`wide` 1200 · `reading` 720 · `immersive` sin tope). Este
 * alias existe porque `reading` sigue siendo el default de todas las pantallas
 * de texto y de todo el nativo.
 */
export const CONTENT_CANVAS_MAX_WIDTH = CANVAS_MAX_WIDTH.reading as 720;

/**
 * Lado de un cuadrado (rueda, radar) a partir del ancho MEDIDO de su contenedor.
 *
 * `container === null` = todavía no midió: devuelve `null` y quien llama reserva
 * el espacio sin dibujar. Nunca se adivina con el viewport.
 */
export function fitSquare(input: { container: number | null; max: number; inset?: number }): number | null {
  const { container, max } = input;
  if (container === null || !Number.isFinite(container) || container <= 0) return null;
  const inset = input.inset ?? 0;
  const available = container - inset * 2;
  if (available <= 0) return null;
  return Math.min(Math.floor(available), max);
}
