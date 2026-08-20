/**
 * Política de reintento de la reconciliación.
 *
 * ## Por qué hace falta
 *
 * Las scheduled actions de Convex son **at-most-once**: si la corrida falla, no
 * se reprograma sola. Un solo `runAfter` detrás del webhook alcanzaba para el
 * camino feliz, pero un 429 o una ventana de red perdía la reparación para
 * siempre — justo el escenario para el que existe la reconciliación.
 *
 * ## La distinción que importa
 *
 * Reintentar sólo sirve para lo que puede mejorar solo. Se separan tres cosas:
 *
 * - **Transitorio de red o de la tienda** (429, 5xx, timeout, caída): se
 *   reintenta.
 * - **Cuerpo ilegible** (`invalid_shape`, `invalid_request_date`,
 *   `invalid_entitlement`, `invalid_expiration`, un permanente sin transacción
 *   que lo respalde): también se reintenta. Un proxy que devuelve HTML, un
 *   despliegue a mitad de camino o una respuesta truncada son ventanas que
 *   pasan, y la alternativa —abandonar— deja el cargo sin reparar para siempre.
 *   El techo de intentos es el que impide que esto se vuelva una tormenta.
 * - **Credencial o configuración** (401, 403, 404, 400, sin credencial): no se
 *   reintenta jamás. El próximo intento falla igual y sólo gasta cupo contra la
 *   API mientras esconde el problema real detrás de ruido.
 *
 * Un motivo desconocido **no** se reintenta: falla cerrado hacia el lado que no
 * genera tormentas.
 */

/** Techo de intentos por trabajo. Acotado a propósito: no hay cola infinita. */
export const RECONCILE_MAX_ATTEMPTS = 4;

const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 15 * 60_000;

/** Motivos de red/tienda que pueden resolverse solos con el tiempo. */
const TRANSIENT = new Set(["http_429", "network_error", "timeout"]);

/**
 * Cuerpos que no se entendieron.
 *
 * Se reintentan porque la ilegibilidad puede ser transitoria, y porque ninguno
 * de ellos muta acceso: mientras se reintenta, la fila queda como estaba.
 */
const UNREADABLE_BODY = new Set([
  "invalid_shape",
  "invalid_request_date",
  "invalid_entitlement",
  "invalid_entitlement_product",
  "invalid_expiration",
  "lifetime_without_purchase_evidence",
  // El snapshot declara un entitlement cuyo recibo no describe. Puede ser una
  // respuesta a medias —el recibo aparece en la próxima lectura— y mientras
  // tanto no se muta nada. Las dos caras, vigente y vencida, se reintentan.
  "active_without_environment",
  "expired_without_environment",
  // Un campo de lifecycle declarado pero ilegible (`unsubscribe_detected_at`,
  // `billing_issues_detected_at`). No se afirma ni baja ni renovación.
  "invalid_subscription_lifecycle",
  // `original_app_user_id` ausente o ilegible: cuerpo a medias, no identidad
  // ajena. La identidad ajena tiene su propio motivo, abajo, y no se reintenta.
  "invalid_subscriber_identity"
]);

/**
 * Motivos que NO se reintentan aunque no sean HTTP.
 *
 * `subscriber_identity_mismatch` es una CUARENTENA: la respuesta describe otra
 * cuenta de Clerk porque las dos quedaron aliased en RevenueCat. El próximo
 * intento devuelve exactamente lo mismo; hay que desenredarlo a mano.
 *
 * `anonymous_subscriber_identity` es el mismo caso desde el otro lado: el
 * cliente es custom-ID-only y nunca produce un original anónimo, así que ese
 * cuerpo no describe ningún camino que esta app pueda generar. Reintentarlo
 * devuelve lo mismo.
 *
 * `unverified_subscriber_identity` es un error de programación —se pidió
 * interpretar sin decir contra qué cuenta— y reintentarlo lo esconde.
 *
 * `lifetime_product_not_allowlisted` es una decisión de CATÁLOGO, no una
 * ventana: el catálogo de lanzamiento (V1) es mensual y
 * `REVENUECAT_LIFETIME_PRODUCT_IDS` está vacía a propósito. La respuesta va a
 * decir exactamente lo mismo en el próximo intento; reintentarla cuatro veces
 * es una tormenta contra la API que no arregla nada. Cuando ese producto se
 * declare, el trabajo se reabre con una señal nueva, no con un reintento.
 */
const PERMANENT_NON_HTTP = new Set([
  "subscriber_identity_mismatch",
  "anonymous_subscriber_identity",
  "unverified_subscriber_identity",
  "lifetime_product_not_allowlisted",
  "not_configured"
]);

export type ReconcileRetryPlan = { retry: boolean; delayMs: number };

/**
 * ¿Este motivo puede mejorar en el próximo intento?
 *
 * Sin mirar el número de intento: eso lo acota `reconcileRetryPlan`.
 */
export function isRetryableReconcileReason(reason: string): boolean {
  if (PERMANENT_NON_HTTP.has(reason)) return false;
  if (TRANSIENT.has(reason)) return true;
  if (UNREADABLE_BODY.has(reason)) return true;

  const status = /^http_(\d{3})$/.exec(reason)?.[1];
  if (status !== undefined) {
    // 5xx: el problema está del otro lado y puede pasar. 4xx (401/403/404/400):
    // credencial, proyecto o ruta mal configurados; reintentar es una tormenta.
    return Number(status) >= 500;
  }
  return false;
}

/** Backoff exponencial con techo, para no castigar a la API mientras se cae. */
export function reconcileRetryDelayMs(attempt: number): number {
  const intento = Number.isFinite(attempt) && attempt >= 1 ? Math.floor(attempt) : 1;
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, intento - 1));
}

/**
 * ¿Se reintenta, y en cuánto?
 *
 * `attempt` es el número del intento que acaba de fallar (1 = el primero).
 */
export function reconcileRetryPlan(reason: string, attempt: number): ReconcileRetryPlan {
  if (!isRetryableReconcileReason(reason)) return { retry: false, delayMs: 0 };
  if (!Number.isFinite(attempt) || attempt >= RECONCILE_MAX_ATTEMPTS) {
    return { retry: false, delayMs: 0 };
  }
  return { retry: true, delayMs: reconcileRetryDelayMs(attempt) };
}

/**
 * ¿Queda otro intento después de éste?
 *
 * Lo usa el watchdog: decide si vuelve a lanzar la action o si liquida el
 * trabajo por agotamiento, sin depender de que la action haya llegado a correr.
 */
export function hasReconcileAttemptsLeft(attempt: number): boolean {
  return Number.isFinite(attempt) && attempt < RECONCILE_MAX_ATTEMPTS;
}

/**
 * Cuánto espera el watchdog antes de dar por muerto un intento.
 *
 * Tiene que superar con margen lo que puede tardar la action —el `fetch` ya
 * está acotado por `RECONCILE_FETCH_TIMEOUT_MS`— para no relanzarla mientras
 * todavía está trabajando. Relanzarla de más no rompe nada (la proyección es
 * idempotente), pero gasta cupo contra la API.
 */
export function reconcileWatchdogDelayMs(attempt: number): number {
  return Math.max(60_000, reconcileRetryDelayMs(attempt));
}

/** Cupo de la comprobación que puede pedir la app, por cuenta. */
export const RECONCILE_COOLDOWN = {
  scope: "revenuecat_reconcile",
  windowMs: 60_000,
  max: 3
} as const;

/** Timeout de la lectura REST. Una lectura colgada no puede bloquear el job. */
export const RECONCILE_FETCH_TIMEOUT_MS = 10_000;
