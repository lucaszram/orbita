/**
 * El puente entre las pantallas del producto y la captura web (CORE-188).
 *
 * Son siete funciones sin argumentos (una lleva el paso del alta) y ninguna
 * decide nada: avisan un HECHO —"la persona confirmó crear su cuenta", "la
 * oferta quedó visible"— y lo demás pasa en `productEvents.ts`, que es puro y
 * está probado sin navegador. Una pantalla no arma propiedades, no elige
 * superficie, no sabe qué versión del contrato viaja y no puede contar dos veces
 * el mismo hecho.
 *
 * ## Por qué existe este archivo, y no un import directo
 *
 * `OnboardingFlow.tsx` y `useAccount.ts` son COMPARTIDOS: no tienen variante
 * `.web`, y el mismo archivo se empaqueta para iOS y para Android. En CORE-183
 * la revisión independiente rechazó exactamente este defecto —un componente
 * compartido (`AccountGate`) terminó ejecutando código de telemetría web en el
 * bundle nativo—, y la corrección fue esta misma: un módulo con `.ts` real y
 * `.native.ts` inerte de la misma firma, para que quien lo usa no tenga que
 * enumerar plataformas y Metro elija por él. Es el patrón de
 * `bootSurface.tsx`/`bootSurface.native.tsx` y de `webTelemetry.native.tsx`.
 *
 * La app nativa mide por otro canal (`docs/handoff-claude-product-events.md`) y
 * medirla con este contrato es una tarjeta que todavía no existe.
 *
 * ## El cliente es UNO
 *
 * La captura entra por `ensureClient()` de `webTelemetry.tsx`: el mismo
 * singleton que emite `$pageview`, con la misma configuración, el mismo
 * `before_send` y el mismo distinct ID anónimo. Sin consentimiento, sin clave o
 * sin `window` ese cliente es `null` y acá no se emite nada — la puerta del
 * consentimiento sigue estando en un solo lugar.
 */
import {
  emitProductEvent,
  type ProductEventPort
} from "@/analytics/productEvents";
import { ensureClient, resolveEnvironment } from "@/analytics/webTelemetry";

/**
 * Prefijo de la única anotación que esta tarjeta deja en el dispositivo.
 *
 * Se usa para un hecho y uno solo (`purchase_completed`): el contrato declara
 * que volver a abrir la pantalla de compra exitosa NO es una compra nueva, y esa
 * segunda apertura puede ser una recarga, que estrena el estado de módulo. Lo
 * que se guarda es la clave del hecho y nada más —sin id de la sesión de pago,
 * sin URL y sin nada de la query, que el contrato prohíbe guardar (sección 8)—,
 * en `sessionStorage`, que muere con la pestaña.
 */
const FACT_KEY_PREFIX = "orbita_hecho_";

/** El almacenamiento de la pestaña, o nada: en el render estático no hay. */
function tabStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    // Un navegador que lo bloquea no es un error que valga la pena contar: sin
    // memoria, el hecho se cuenta una vez por carga en vez de una sola vez.
    return null;
  }
}

/** Todo lo que la decisión necesita del navegador, en un solo lugar. */
const browserPort: ProductEventPort = {
  capture: (event, properties) => ensureClient()?.capture(event, properties),
  environment: resolveEnvironment,
  warn: (message) => console.warn(message),
  recall: (fact) => {
    try {
      return tabStorage()?.getItem(FACT_KEY_PREFIX + fact) !== null;
    } catch {
      return false;
    }
  },
  remember: (fact) => {
    try {
      tabStorage()?.setItem(FACT_KEY_PREFIX + fact, "1");
    } catch {
      // Sin cuota no hay memoria, y no hay nada que reintentar.
    }
  }
};

/**
 * El paso del alta que se está mostrando (`onboarding_step_viewed`).
 *
 * Recibe el ÍNDICE del flujo, que es lo único que la pantalla sabe, y el nombre
 * del contrato lo resuelve el módulo puro: así ninguna pantalla puede inventar
 * una etiqueta ni mandar el número, que es lo que el contrato prohíbe.
 */
export function trackOnboardingStepViewed(step: number): void {
  emitProductEvent({ name: "onboarding_step_viewed", step }, browserPort);
}

/** La persona confirmó crear su cuenta (`signup_submitted`). */
export function trackSignupSubmitted(): void {
  emitProductEvent({ name: "signup_submitted" }, browserPort);
}

/** La cuenta quedó creada y la sesión iniciada (`signup_completed`). */
export function trackSignupCompleted(): void {
  emitProductEvent({ name: "signup_completed" }, browserPort);
}

/** El alta terminó y la carta quedó disponible (`onboarding_completed`). */
export function trackOnboardingCompleted(): void {
  emitProductEvent({ name: "onboarding_completed" }, browserPort);
}

/** La oferta real quedó visible (`paywall_viewed`). */
export function trackPaywallViewed(): void {
  emitProductEvent({ name: "paywall_viewed" }, browserPort);
}

/** La persona confirmó avanzar al cobro (`checkout_started`). */
export function trackCheckoutStarted(): void {
  emitProductEvent({ name: "checkout_started" }, browserPort);
}

/** El cobro volvió confirmado y el acceso quedó otorgado (`purchase_completed`). */
export function trackPurchaseCompleted(): void {
  emitProductEvent({ name: "purchase_completed" }, browserPort);
}
