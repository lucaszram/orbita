/**
 * En nativo no hay telemetría web: los siete eventos de producto (CORE-188) son
 * exclusivamente del navegador.
 *
 * `OnboardingFlow.tsx` y `useAccount.ts` son COMPARTIDOS y llaman a estas
 * funciones sin condicionales —enumerar plataformas dentro de la lógica del alta
 * sería exactamente lo que este patrón evita—. Esta variante existe para que ese
 * llamado no arrastre al bundle nativo el SDK, el módulo de decisión ni el
 * contrato: acá no hay nada que emitir y, sobre todo, no hay ningún import que
 * sobreviva al empaquetado. Es el mismo motivo por el que
 * `webTelemetry.native.tsx` no renderiza nada y `bootSurface.native.tsx` no toca
 * el arranque.
 *
 * La firma exportada es la MISMA que la de `productTelemetry.ts`: quien la usa
 * no sabe en qué plataforma está. Los argumentos se siguen exigiendo y no se
 * usan, porque acá no hay hecho que contar.
 *
 * La app nativa mide por otro canal (`docs/handoff-claude-product-events.md`) y
 * medirla con este contrato es una tarjeta que todavía no existe.
 */

/** El paso del alta que se está mostrando. En nativo, nada. */
export function trackOnboardingStepViewed(step: number): void {
  void step;
}

/** La persona confirmó crear su cuenta. En nativo, nada. */
export function trackSignupSubmitted(): void {}

/** La cuenta quedó creada y la sesión iniciada. En nativo, nada. */
export function trackSignupCompleted(): void {}

/** El alta terminó y la carta quedó disponible. En nativo, nada. */
export function trackOnboardingCompleted(): void {}

/** La oferta real quedó visible. En nativo, nada. */
export function trackPaywallViewed(): void {}

/** La persona confirmó avanzar al cobro. En nativo, nada. */
export function trackCheckoutStarted(): void {}

/** El cobro volvió confirmado y el acceso quedó otorgado. En nativo, nada. */
export function trackPurchaseCompleted(): void {}
