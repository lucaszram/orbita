/**
 * Qué incluye cada plan, EN WEB — misma interfaz que `planBenefits.ts`.
 *
 * La regla de acceso y los textos comunes viven en `planBenefitsShared.ts`. La
 * web suma el Tarot, que en iOS no existe: gratis son siete cartas en total y
 * Plus abre una carta cada día (mismas palabras que `umbral-tarot-state.ts`).
 */
import {
  FREE_ITEMS_COMMON,
  freeSummaryOf,
  PLUS_BENEFITS_COMMON,
  PLUS_SUMMARY_ITEMS_COMMON,
  plusSummaryOf
} from "./planBenefitsShared";

export { PLUS_BENEFITS_COMMON, PLUS_HEADLINE, PLUS_STEPS, type PlusStep } from "./planBenefitsShared";

/** Lo que Plus abre sólo en la web. */
export const PLUS_BENEFITS_WEB_ONLY: readonly string[] = [
  "Tarot: una carta cada día, después de las siete cartas gratis."
];

/** La lista de beneficios de Plus, un renglón por beneficio. */
export const PLUS_BENEFITS: readonly string[] = [...PLUS_BENEFITS_COMMON, ...PLUS_BENEFITS_WEB_ONLY];

/** Qué tiene una cuenta Free, en una frase. */
export const FREE_PLAN_SUMMARY: string = freeSummaryOf([
  ...FREE_ITEMS_COMMON,
  "siete cartas de Tarot en total"
]);

/** Qué abre Plus, en una frase (para el Perfil). */
export const PLUS_SUMMARY: string = plusSummaryOf([...PLUS_SUMMARY_ITEMS_COMMON, "una carta de Tarot cada día"]);
