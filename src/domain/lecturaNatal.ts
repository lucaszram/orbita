/**
 * "Tu carta, explicada" — la lectura natal larga, vista como capítulos.
 *
 * La FASE del bloque (carga / bloqueado / error / listo) vive en
 * `@/domain/cartaNatalCarga` (`readingBlockPhase`) y no se duplica acá: este
 * módulo sólo convierte la lectura YA recibida en lo que se dibuja, para que la
 * pantalla legada (`src/screens/CartaScreen.tsx`) y la V4.9.2
 * (`src/screens/v492/CartaCompletaV492Screen.tsx`) no escriban dos veces la
 * misma línea de placement ni corten los párrafos de maneras distintas.
 *
 * No hay texto generado acá. Cada capítulo es el que devolvió el backend: su
 * número de orden, su placement, su título, su cuerpo y sus preguntas. Si el
 * backend no mandó preguntas, no se inventan.
 */
import { bodySymbol, type BodyGlyphKey } from "./astroSymbols";
import type { PersonalityReadingPayload, PersonalitySection } from "@/services/appRefs";

/** Placement de un capítulo, tal como lo publica el backend. */
type ChapterPlacement = PersonalitySection["placement"];

/** Un capítulo listo para dibujar. Nada de esto se calcula en la pantalla. */
export type NatalChapterView = {
  key: string;
  /** Orden humano, 1-based: el capítulo 1 es el primero de la lista. */
  n: number;
  /** "CAPÍTULO 01" — el rótulo visible del orden. */
  numero: string;
  /** "SOL EN CÁNCER · CASA 4" — el placement COMPLETO, sin recortar. */
  placement: string;
  /** Glifo vectorial del cuerpo (nunca un carácter que caiga al font de emoji). */
  glyph: BodyGlyphKey;
  title: string;
  /** El cuerpo, cortado por sus párrafos originales. Nunca vacío si hay texto. */
  paragraphs: string[];
  /** Las 1-2 preguntas del capítulo; vacío si el backend no mandó ninguna. */
  questions: string[];
  /** Etiqueta de VoiceOver del encabezado: orden, placement y título. */
  voice: string;
};

/**
 * Línea de placement en mayúsculas: planeta, signo y casa cuando existen.
 *
 * Es la MISMA en las dos pantallas. Cuando cada una la armaba por su cuenta,
 * "Sol en Cáncer · Casa 4" podía perder la casa en una y no en la otra sin que
 * nada lo notara.
 */
export function natalPlacementLine(placement: ChapterPlacement): string {
  return `${placement.planet} en ${placement.sign ?? ""}${placement.house ? ` · Casa ${placement.house}` : ""}`.toUpperCase();
}

/**
 * El cuerpo, respetando los párrafos que escribió el generador.
 *
 * Un capítulo largo llega con saltos de línea dobles; dibujarlo como un solo
 * `Text` los colapsa y el capítulo se lee como un bloque macizo. Se cortan los
 * párrafos y se descartan los vacíos; un cuerpo sin saltos es un párrafo.
 */
export function natalChapterParagraphs(body: string | undefined | null): string[] {
  if (!body) return [];
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/**
 * Los capítulos de la lectura, en el ORDEN en que los publicó el backend.
 *
 * `null`/`undefined` (query en vuelo o lectura todavía sin cachear) devuelve
 * lista vacía: la fase la decide `readingBlockPhase`, no esta función.
 */
export function natalChapters(
  reading: PersonalityReadingPayload | null | undefined
): NatalChapterView[] {
  return (reading?.sections ?? []).map((section, index) => natalChapterView(section, index + 1));
}

/** Un capítulo suelto, numerado desde 1. */
export function natalChapterView(section: PersonalitySection, n: number): NatalChapterView {
  const placement = natalPlacementLine(section.placement);
  return {
    key: section.key,
    n,
    numero: `Capítulo ${String(n).padStart(2, "0")}`,
    placement,
    glyph: bodySymbol({ label: section.placement.label }),
    title: section.title,
    paragraphs: natalChapterParagraphs(section.body),
    questions: section.questions ?? [],
    // VoiceOver lee el placement en minúsculas: la línea visible va en
    // mayúsculas por estilo, y en mayúsculas un lector de pantalla puede
    // deletrear "SOL" letra por letra.
    voice: `Capítulo ${n}. ${capitalizar(placement.toLowerCase())}. ${section.title}`
  };
}

function capitalizar(texto: string): string {
  return texto.length === 0 ? texto : `${texto[0].toUpperCase()}${texto.slice(1)}`;
}
