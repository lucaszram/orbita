/**
 * Preferencia de menos movimiento — la parte pura, testeable sin renderizar.
 *
 * La consulta del sistema (`AccessibilityInfo.isReduceMotionEnabled`) es una
 * promesa, así que el primer render tiene que decidir algo. La regla:
 *
 *   - Arrancar animando y frenar cuando el sistema contesta que sí. Al revés
 *     (arrancar quieto y saltar a animado) se ve como un tirón en cada montaje.
 *   - EXCEPTO en web, donde la media query se puede leer sincrónicamente: ahí
 *     el primer render ya respeta la preferencia y no hay ni un fotograma de
 *     movimiento no pedido.
 */

/** Lector inyectable de la media query (el navegador en producción). */
export type MediaQueryReader = (query: string) => { matches: boolean } | null;

/**
 * Estado inicial de la preferencia. `reader` ausente (nativo, tests) → `false`:
 * se anima y se corrige cuando el sistema responde.
 */
export function reducedMotionInitialState(
  reader: MediaQueryReader | undefined = typeof globalThis !== "undefined" &&
  typeof (globalThis as { matchMedia?: unknown }).matchMedia === "function"
    ? (q: string) => (globalThis as unknown as { matchMedia: MediaQueryReader }).matchMedia(q)
    : undefined
): boolean {
  if (!reader) return false;
  try {
    return reader("(prefers-reduced-motion: reduce)")?.matches === true;
  } catch {
    return false;
  }
}

/**
 * ¿Cuántas veces se repite una animación decorativa en bucle?
 *
 * `null` = no arrancarla. No se reemplaza por una versión "más lenta": una
 * animación infinita con la preferencia activa no se atenúa, se apaga.
 */
export function loopIterations(reduced: boolean): number | null {
  return reduced ? null : -1;
}
