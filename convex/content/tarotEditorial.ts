import rawReadings from "./tarotEditorial.generated.json";
import type { DailyRitual } from "../daily";
import type { TarotOrientation } from "../lib/tarot";

export type TarotEditorialReading = {
  id: number;
  orientacion: TarotOrientation;
  ritual: DailyRitual;
};

export const TAROT_EDITORIAL_READINGS = rawReadings as TarotEditorialReading[];
export const TAROT_EDITORIAL_READING_COUNT = TAROT_EDITORIAL_READINGS.length;

const READINGS_BY_CARD = new Map(
  TAROT_EDITORIAL_READINGS.map((reading) => [`${reading.id}:${reading.orientacion}`, reading.ritual] as const)
);

/**
 * Lectura editorial canónica de carta + orientación.
 *
 * Es contenido versionado, no un fallback generado en runtime: dos personas con
 * la misma carta y orientación leen exactamente la misma pieza aprobable. La
 * personalización natal y de tránsitos vive en módulos separados y puede llegar
 * después sin cambiar este ritual.
 */
export function editorialRitualFor(id: number, orientacion: TarotOrientation): DailyRitual {
  const ritual = READINGS_BY_CARD.get(`${id}:${orientacion}`);
  if (!ritual) throw new Error(`Missing editorial tarot ritual for ${id}:${orientacion}`);
  return ritual;
}
