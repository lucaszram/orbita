/**
 * Geometría pura de la rueda natal (sin deps de React Native, testeable en node).
 *
 * La rueda se **rota al Ascendente**: la longitud eclíptica del Asc cae siempre a
 * la izquierda (180° en orientación matemática, donde 0°=derecha y +y=arriba).
 */

export const norm360 = (d: number) => ((d % 360) + 360) % 360;

/** Longitud eclíptica (0–360) → ángulo de pantalla (orientación matemática). */
export function wheelAngle(ascLon: number, lon: number): number {
  return norm360(180 + (lon - ascLon));
}

/** Distancia angular mínima entre dos ángulos (0–180). */
export function arcBetween(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}
