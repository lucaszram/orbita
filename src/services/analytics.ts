/**
 * Analytics de producto — variante NATIVA: no hace nada.
 *
 * `page_view` es una métrica de la web pública. La app nativa ya reporta lo suyo
 * por el pipeline de `productEvents` en Convex (`app_opened`, onboarding, reveal
 * de carta), y no queremos un SDK de navegador viajando en el bundle de iOS ni
 * pidiendo permisos de tracking por una métrica que no usamos ahí.
 *
 * Metro resuelve `analytics.web.ts` para web y este archivo para todo lo demás,
 * igual que el par `entryBackground.ts` / `entryBackground.web.ts`. Las dos
 * variantes exponen exactamente la misma superficie: `tsc` chequea contra ésta,
 * así que si alguna firma se desalinea, el typecheck lo dice.
 */

/** En nativo nunca hay analytics de página. */
export const ANALYTICS_ENABLED = false;

export function startAnalytics(): void {}

export function capturePageView(_path: string): void {}
