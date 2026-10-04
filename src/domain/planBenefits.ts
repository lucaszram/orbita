/**
 * Qué incluye cada plan, EN NATIVO — única fuente de los textos de beneficios
 * que pintan el paywall del onboarding, el paywall de Plus y el Perfil.
 *
 * La regla de acceso y los textos comunes viven en `planBenefitsShared.ts`; la
 * variante hermana `planBenefits.web.ts` expone los mismos nombres y le suma lo
 * que existe sólo en la web. Acá no se nombra nada que iOS no tenga.
 */
import {
  FREE_ITEMS_COMMON,
  freeSummaryOf,
  PLUS_BENEFITS_COMMON,
  PLUS_SUMMARY_ITEMS_COMMON,
  plusSummaryOf
} from "./planBenefitsShared";

export { PLUS_BENEFITS_COMMON, PLUS_HEADLINE, PLUS_STEPS, type PlusStep } from "./planBenefitsShared";

/** La lista de beneficios de Plus, un renglón por beneficio. */
export const PLUS_BENEFITS: readonly string[] = PLUS_BENEFITS_COMMON;

/** Qué tiene una cuenta Free, en una frase. */
export const FREE_PLAN_SUMMARY: string = freeSummaryOf(FREE_ITEMS_COMMON);

/** Qué abre Plus, en una frase (para el Perfil). */
export const PLUS_SUMMARY: string = plusSummaryOf(PLUS_SUMMARY_ITEMS_COMMON);
