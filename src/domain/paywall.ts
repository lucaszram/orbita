/**
 * Oferta web y retorno del checkout.
 *
 * Reglas que no se negocian acá:
 * - Los precios NUNCA se escriben en el cliente. Salen de `payments.getWebOffer`,
 *   que los lee de Stripe. Un precio hardcodeado se desincroniza en silencio y
 *   termina cobrando distinto de lo que la pantalla prometió.
 * - Con el comercio apagado no hay ningún camino a checkout, ni escondido.
 * - La URL de retorno no concede nada: `active` sólo lo dice el backend después
 *   de verificar sesión, propietario, customer y el entitlement del webhook.
 */

export type CommerceMode = "off" | "test" | "live";

export type OfferPlan = {
  id: "monthly";
  currency: string;
  unitAmount: number;
  interval: "month";
  trialDays: number;
};

export type WebOffer = {
  commerceMode: CommerceMode;
  checkoutEnabled: boolean;
  plans: OfferPlan[];
};

export type OfferPhase = "cargando" | "error" | "proximamente" | "disponible";

export function offerPhase(input: {
  offer: WebOffer | null | undefined;
  failed: boolean;
}): OfferPhase {
  if (input.failed) return "error";
  if (input.offer === undefined || input.offer === null) return "cargando";
  // Sin el plan mensual no hay nada que ofrecer aunque el flag venga en true:
  // preferimos "próximamente" antes que una pantalla de compra vacía.
  if (!input.offer.checkoutEnabled || monthlyPlan(input.offer.plans) === null) return "proximamente";
  return "disponible";
}

/**
 * La oferta vigente es UNA sola suscripción mensual. Cualquier otro id que
 * llegara del backend se ignora: no se ofrece un plan que producto ya retiró.
 */
export function monthlyPlan(plans: OfferPlan[]): OfferPlan | null {
  return plans.find((plan) => plan.id === "monthly" && plan.interval === "month") ?? null;
}

const INTERVAL_LABEL: Record<OfferPlan["interval"], string> = {
  month: "por mes"
};

/**
 * Precio formateado desde lo que devolvió Stripe. `unitAmount` viene en la
 * unidad mínima de la moneda (centavos para USD/ARS/EUR).
 */
export function formatPlanPrice(plan: OfferPlan, locale = "es-AR"): string {
  const amount = plan.unitAmount / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: plan.currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2
    }).format(amount);
  } catch {
    // Moneda desconocida para Intl: mostramos el código, nunca un símbolo inventado.
    return `${plan.currency} ${amount.toFixed(2)}`;
  }
}

export function planIntervalLabel(plan: OfferPlan): string {
  return INTERVAL_LABEL[plan.interval];
}

/** `null` cuando el plan no tiene prueba: no se anuncia un trial que no existe. */
export function planTrialLabel(plan: OfferPlan): string | null {
  if (!plan.trialDays || plan.trialDays <= 0) return null;
  return plan.trialDays === 1 ? "1 día gratis" : `${plan.trialDays} días gratis`;
}

/**
 * CTA del checkout. Los días salen de `trialDays` —el mismo valor que el
 * backend manda a Stripe— así el botón nunca promete una prueba distinta de la
 * que Checkout va a configurar. Sin prueba, no se anuncian días gratis.
 */
export function checkoutCtaLabel(plan: OfferPlan): string {
  if (!plan.trialDays || plan.trialDays <= 0) return "Suscribirme";
  return plan.trialDays === 1 ? "Probar 1 día gratis" : `Probar ${plan.trialDays} días gratis`;
}

// ---------------------------------------------------------------------------
// Retorno del checkout
// ---------------------------------------------------------------------------

export type CheckoutStatus = "pending" | "active" | "failed";
export type CheckoutPollDecision = "consultar" | "esperar" | "listo" | "fallo" | "timeout" | "inhabilitado";

/** Ventana máxima de espera del webhook antes de dejar de consultar. */
export const CHECKOUT_POLL_TIMEOUT_MS = 90_000;
export const CHECKOUT_POLL_INTERVAL_MS = 2_500;

/**
 * Qué hacer en el retorno del checkout. Se consulta SÓLO mientras el backend
 * responde `pending`; `active`/`failed` son terminales y el timeout corta.
 *
 * Con el comercio apagado no se consulta nada: no puede haber una sesión de
 * checkout legítima, y preguntar por una sólo invita a tantear la URL.
 */
export function checkoutPollDecision(input: {
  commerceEnabled: boolean;
  sessionId: string | null;
  lastStatus: CheckoutStatus | null;
  elapsedMs: number;
  timeoutMs?: number;
}): CheckoutPollDecision {
  if (!input.commerceEnabled || !input.sessionId) return "inhabilitado";
  if (input.lastStatus === "active") return "listo";
  if (input.lastStatus === "failed") return "fallo";
  if (input.elapsedMs >= (input.timeoutMs ?? CHECKOUT_POLL_TIMEOUT_MS)) return "timeout";
  return input.lastStatus === null ? "consultar" : "esperar";
}

// ---------------------------------------------------------------------------
// Gestión de la suscripción (Customer Portal)
// ---------------------------------------------------------------------------

export type ManageSubscription = "oculto" | "cargando" | "portal" | "soporte";

/**
 * Si mostrar "Gestionar suscripción", y de qué forma.
 *
 * La autoridad es `canManageInStripePortal`, que el backend calcula como
 * `provider === "stripe" && !isLifetime` — o sea que ya excluye Free,
 * RevenueCat y lifetime. Acá sólo se suma el estado del comercio.
 *
 * `soporte` cubre el caso feo: alguien con una suscripción de Stripe viva
 * mientras el comercio está apagado (un rollback). `createPortalSession` no
 * puede construir el cliente de Stripe con `off` y tiraría, así que ofrecer el
 * botón sería mandarlo a un error garantizado. Se ofrece soporte en su lugar.
 */
export function manageSubscription(input: {
  /** `subscriptions.getCurrent`; `undefined` mientras la query resuelve. */
  entitlement: { canManageInStripePortal: boolean } | null | undefined;
  /** `getWebOffer().checkoutEnabled`; `undefined` mientras resuelve. */
  commerceEnabled: boolean | null | undefined;
}): ManageSubscription {
  if (input.entitlement === undefined) return "cargando";
  if (input.entitlement === null || !input.entitlement.canManageInStripePortal) return "oculto";
  if (input.commerceEnabled === undefined) return "cargando";
  return input.commerceEnabled ? "portal" : "soporte";
}

// ---------------------------------------------------------------------------
// Inicio del checkout
// ---------------------------------------------------------------------------

/** Texto exacto que tira `createCheckoutSession` cuando la cuenta ya es Plus. */
const ALREADY_PLUS_MARKER = "This account already has Plus access";

export type CheckoutStartErrorKind = "ya_plus" | "generico";

/**
 * Clasifica el error de `createCheckoutSession` para elegir el mensaje.
 *
 * Convex puede envolver el `Error` del backend dentro de un mensaje más largo
 * (ubicación del servidor, request id, etc.), así que se busca el texto en
 * vez de comparar igualdad exacta. Cualquier otra cosa —error de red, error
 * desconocido, o un valor que ni siquiera es un `Error`— cae al genérico.
 */
export function checkoutStartErrorKind(error: unknown): CheckoutStartErrorKind {
  if (!(error instanceof Error)) return "generico";
  return error.message.includes(ALREADY_PLUS_MARKER) ? "ya_plus" : "generico";
}

/**
 * Forma mínima de una session id de Stripe. El backend valida en serio; esto
 * evita mandarle basura de la barra de direcciones.
 */
export function readCheckoutSessionId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 255) return null;
  return /^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(value) ? value : null;
}
