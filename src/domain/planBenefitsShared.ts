/**
 * Qué incluye cada plan — la parte COMÚN a iOS y web de la única fuente de los
 * textos de beneficios. Las pantallas no importan este archivo: importan
 * `@/domain/planBenefits`, que el bundler resuelve por plataforma
 * (`planBenefits.ts` en nativo, `planBenefits.web.ts` en web).
 *
 * Regla de acceso vigente (la misma en iOS y en web):
 *
 * | Sección    | Free                                   | Plus                                   |
 * |------------|----------------------------------------|----------------------------------------|
 * | Hoy        | abierto                                | abierto                                |
 * | Tránsitos  | bloqueado                              | panorama del día y detalle             |
 * | Tu momento | bloqueado                              | estación vital, tema del año, 4 ritmos |
 * | Vínculos   | 1 persona, 3 contactos visibles        | personas y contactos sin tope          |
 * | Carta      | rueda y tríada (Sol, Luna, Ascendente) | 12 casas, aspectos y 7 capítulos       |
 * | El Umbral  | 3 preguntas por día                    | 5 preguntas por día                    |
 *
 * Lo que existe sólo en la web se suma en `planBenefits.web.ts`: este archivo
 * entra al bundle nativo y no puede nombrar secciones que iOS no tiene.
 * Ninguna plataforma tiene calendario. Hoy (con su fase lunar) es gratis: no se
 * anuncia como beneficio de Plus.
 *
 * Cada renglón nombra algo que la tabla dice que el plan abre. Sin dependencias
 * de React Native: se prueba con node.
 */

/** Lo que Plus abre en las dos plataformas, un renglón por beneficio. */
export const PLUS_BENEFITS_COMMON: readonly string[] = [
  "Tránsitos: el panorama del día sobre tu carta y el detalle de cada tránsito.",
  "Tu momento: tu estación vital, el tema del año y tus cuatro ritmos.",
  "Las doce casas de tu carta natal.",
  "Los aspectos entre los puntos de tu carta.",
  "Los 7 capítulos de «Tu carta, explicada».",
  "Vínculos sin tope de personas ni de contactos visibles en la comparación.",
  "Cinco preguntas por día en El Umbral, en vez de tres."
];

/** Frase de cabecera del paywall: sólo nombra secciones que Plus abre. */
export const PLUS_HEADLINE = "Tu carta completa, tus tránsitos y tu momento.";

export type PlusStep = { n: string; title: string; body: string };

/** Los tres pasos de «Cómo te acompaña», comunes a las dos plataformas. */
export const PLUS_STEPS: readonly PlusStep[] = [
  {
    n: "01",
    title: "Tu carta completa",
    body: "Las doce casas, los aspectos y los 7 capítulos de «Tu carta, explicada»."
  },
  {
    n: "02",
    title: "Tus tránsitos",
    body: "El panorama del día sobre tu carta y el detalle de cada tránsito."
  },
  {
    n: "03",
    title: "Tu momento",
    body: "Tu estación vital, el tema del año y tus cuatro ritmos."
  }
];

/** Lo que tiene una cuenta Free en las dos plataformas. */
export const FREE_ITEMS_COMMON: readonly string[] = [
  "Hoy",
  "la rueda y la tríada de tu carta (Sol, Luna y Ascendente)",
  "una persona en Vínculos",
  "tres preguntas por día en El Umbral"
];

/** Lo que Plus abre en las dos plataformas, para decirlo en una frase. */
export const PLUS_SUMMARY_ITEMS_COMMON: readonly string[] = [
  "Tránsitos",
  "Tu momento",
  "las doce casas",
  "los aspectos y los 7 capítulos de tu carta",
  "Vínculos sin tope de personas ni de contactos",
  "cinco preguntas por día en El Umbral"
];

/** «a, b y c». */
function enumerar(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** Qué tiene una cuenta Free, en una frase. */
export function freeSummaryOf(items: readonly string[]): string {
  return `Tenés ${enumerar(items)}.`;
}

/** Qué abre Plus, en una frase. */
export function plusSummaryOf(items: readonly string[]): string {
  return `Plus abre ${enumerar(items)}.`;
}
