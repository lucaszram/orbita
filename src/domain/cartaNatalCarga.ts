/**
 * Carga de la Carta Natal — regla anti-bloqueo (2026-07-18, PR pareja del
 * backend #32 "prewarm de lectura natal").
 *
 * La carta astronómica (`charts.current` + `charts.valuesMap`) responde en
 * menos de un segundo; la lectura larga (`charts.personalityReading`) puede
 * tardar 40–61 s mientras el LLM genera. Por eso la pantalla se decide en DOS
 * fases independientes:
 *
 * - `cartaGate` gobierna el loading GENERAL de la pantalla y solo mira carta y
 *   mapa de valores. La lectura larga NO participa: jamás puede devolver la
 *   pantalla a `MinimalLoading`.
 * - `readingBlockPhase` gobierna únicamente el bloque "Tu carta, explicada":
 *   pendiente → carga inline; fallo del generador → error inline con
 *   REINTENTAR; lista → los siete capítulos intactos.
 *
 * `generatePersonalityReading({})` se sigue disparando al montar. Una
 * resolución `{ status: "pending" }` significa que otro proceso (prewarm del
 * backend) ya está generando: NO es un error — solo un reject de la action lo
 * es.
 */

export type CartaGate = "cargando" | "vacio" | "listo";

/**
 * Gate general de la pantalla. `undefined` = query en vuelo; `null` en la
 * carta = el backend confirmó que no hay carta. La lectura larga no es input:
 * el tipo lo garantiza.
 */
export function cartaGate(input: { doc: unknown; values: unknown }): CartaGate {
  if (input.doc === undefined || input.values === undefined) return "cargando";
  if (input.doc === null) return "vacio";
  return "listo";
}

export type ReadingBlockPhase = "cargando" | "error" | "listo";

/**
 * Fase del bloque "Tu carta, explicada". `reading` es la query
 * `charts.personalityReading` (`undefined` en vuelo, `null` hasta cache
 * `ready`); `failed` = la action `generatePersonalityReading` REJECTÓ (una
 * resolución con `{ status: "pending" }` no falla).
 *
 * El dato manda: si la lectura llegó (p. ej. el prewarm del backend terminó
 * aunque la action del cliente haya fallado), se muestra — un fallo viejo no
 * la tapa.
 */
export function readingBlockPhase(input: { reading: unknown; failed: boolean }): ReadingBlockPhase {
  if (input.reading != null) return "listo";
  return input.failed ? "error" : "cargando";
}
