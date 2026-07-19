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
 * es. Para que un prewarm que FALLA no deje "Preparando…" eterno, el bloque
 * también escucha `charts.personalityReadingState()` (backend #32 `24ba2ac`):
 * `{ status: "pending" | "ready" | "error" }`, reactiva y nunca null.
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

/** Señal pública del backend sobre la generación (`personalityReadingState`). */
export type NatalReadingRemoteStatus = "pending" | "ready" | "error";

/**
 * Fase del bloque "Tu carta, explicada".
 *
 * - `reading` — query `charts.personalityReading` (`undefined` en vuelo,
 *   `null` hasta cache `ready`). El dato manda: si la lectura llegó, se
 *   muestra; ni un fallo local viejo ni un `state` stale la tapan.
 * - `failed` — la action `generatePersonalityReading` REJECTÓ (una resolución
 *   `{ status: "pending" }` no falla).
 * - `generating` — la action del cliente sigue en vuelo (incluye el reintento
 *    recién disparado): se muestra carga aunque el `state` remoto todavía diga
 *    `error` de la ronda anterior.
 * - `state` — `personalityReadingState().status` (`undefined` = query en
 *   vuelo). `error` remoto (p. ej. el prewarm tomó el claim y falló) → error
 *   inline: nunca "Preparando…" eterno. `ready` con `reading` aún null es la
 *   ventana entre las dos queries → sigue cargando.
 */
export function readingBlockPhase(input: {
  reading: unknown;
  failed: boolean;
  generating?: boolean;
  state?: NatalReadingRemoteStatus;
}): ReadingBlockPhase {
  if (input.reading != null) return "listo";
  if (input.failed) return "error";
  if (input.generating) return "cargando";
  if (input.state === "error") return "error";
  return "cargando";
}
