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
  id: "weekly" | "yearly";
  currency: string;
  unitAmount: number;
  interval: "week" | "year";
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
  // Sin planes no hay nada que ofrecer aunque el flag venga en true: preferimos
  // "próximamente" antes que una pantalla de compra vacía.
  if (!input.offer.checkoutEnabled || input.offer.plans.length === 0) return "proximamente";
  return "disponible";
}

const INTERVAL_LABEL: Record<OfferPlan["interval"], string> = {
  week: "por semana",
  year: "por año"
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

/** El anual va primero y preseleccionado; es la decisión de producto vigente. */
export function sortedPlans(plans: OfferPlan[]): OfferPlan[] {
  return [...plans].sort((a, b) => (a.id === "yearly" ? -1 : b.id === "yearly" ? 1 : 0));
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
