/**
 * En nativo no hay telemetría web: los siete eventos de producto (CORE-188) y la
 * identidad que los acompaña son exclusivamente del navegador.
 *
 * `OnboardingFlow.tsx`, `useAccount.ts`, `useAccountBootstrap.tsx` y
 * `PerfilScreen.tsx` son COMPARTIDOS y llaman a estas funciones sin
 * condicionales —enumerar plataformas dentro de la lógica del alta o del logout
 * sería exactamente lo que este patrón evita—. Esta variante existe para que ese
 * llamado no arrastre al bundle nativo el SDK, el módulo de decisión ni el
 * contrato: acá no hay nada que emitir y, sobre todo, no hay ningún import que
 * sobreviva al empaquetado. Los dos de abajo son `import type`: Babel los borra
 * y no dejan una sola arista en el grafo de Metro; están para que las dos
 * variantes declaren la MISMA firma sin copiar dos veces la forma de un dato.
 * Es el mismo motivo por el que `webTelemetry.native.tsx` no renderiza nada y
 * `bootSurface.native.tsx` no toca el arranque.
 *
 * La firma exportada es la MISMA que la de `productTelemetry.ts`: quien la usa
 * no sabe en qué plataforma está. Los argumentos se siguen exigiendo y no se
 * usan, porque acá no hay hecho que contar ni identidad que atar.
 *
 * La app nativa mide por otro canal (`docs/handoff-claude-product-events.md`) y
 * medirla con este contrato es una tarjeta que todavía no existe.
 */
import type { PurchaseSignal } from "@/analytics/productEvents";
import type { ResetTrigger } from "@/analytics/eventContract";

/** El paso del alta que se está mostrando. En nativo, nada. */
export function trackOnboardingStepViewed(input: {
  readonly step: number;
  readonly visible: boolean;
  readonly inspecting: boolean;
  readonly sessionActive: boolean;
}): void {
  void input;
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

/** Lo que el retorno del checkout sabe del cobro. En nativo, nada. */
export function trackPurchaseCompleted(signal: PurchaseSignal): void {
  void signal;
}

/** Ata la captura a la cuenta. En nativo, nada. */
export function identifyAccount(clerkUserId: string): void {
  void clerkUserId;
}

/** Corta el vínculo con la persona. En nativo, nada. */
export function resetAnalyticsIdentity(trigger: ResetTrigger): void {
  void trigger;
}
