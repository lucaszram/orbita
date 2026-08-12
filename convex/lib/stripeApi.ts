const STRIPE_API_BASE_URL = "https://api.stripe.com/v1";

export type StripeFormValue = string | number | boolean | null | undefined;
export type StripeForm = Record<string, StripeFormValue>;
export type StripeFetch = (input: string, init: RequestInit) => Promise<Response>;
export type StripePlan = "monthly";

export const MONTHLY_TRIAL_DAYS = 7;

/**
 * Resumen que Stripe muestra junto al botón de confirmación del Checkout.
 * Reemplaza la pantalla comercial intermedia: la persona llega directo al
 * pago pero sigue viendo qué desbloquea, sin duplicar ni inventar el precio.
 */
export const STRIPE_CHECKOUT_BENEFITS =
  "Incluye tu carta natal completa (rueda, casas, aspectos y siete capítulos), Tarot diario sin tope, lectura diaria personalizada, tránsitos por área, cinco preguntas por día en El Umbral y Diario completo.";

export function trialDaysForPlan(plan: StripePlan | "lifetime"): number {
  return plan === "monthly" ? MONTHLY_TRIAL_DAYS : 0;
}

type StripeErrorPayload = {
  error?: {
    message?: unknown;
  };
};

export function encodeStripeForm(fields: StripeForm): string {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    form.append(key, String(value));
  }
  return form.toString();
}

export function buildStripeCustomerForm(args: { email?: string; clerkUserId: string }): StripeForm {
  return {
    email: args.email,
    "metadata[clerkUserId]": args.clerkUserId
  };
}

export function buildStripeCheckoutForm(args: {
  plan: StripePlan | "lifetime";
  customerId: string;
  priceId: string;
  clerkUserId: string;
  webUrl: string;
  automaticTax?: boolean;
}): StripeForm {
  // `lifetime` remains accepted only so old isolated unit tests and snapshots
  // can be read. No public action or price selector can submit it.
  const legacyLifetime = args.plan === "lifetime";
  const mode = legacyLifetime ? "payment" : "subscription";
  return {
    mode,
    customer: args.customerId,
    payment_method_collection: mode === "subscription" ? "always" : undefined,
    "line_items[0][price]": args.priceId,
    "line_items[0][quantity]": 1,
    "custom_text[submit][message]": legacyLifetime
      ? undefined
      : STRIPE_CHECKOUT_BENEFITS,
    client_reference_id: args.clerkUserId,
    "metadata[clerkUserId]": args.clerkUserId,
    "metadata[plan]": args.plan,
    "automatic_tax[enabled]": args.automaticTax,
    ...(mode === "subscription"
      ? {
          "subscription_data[metadata][clerkUserId]": args.clerkUserId,
          "subscription_data[metadata][plan]": args.plan,
          "subscription_data[trial_period_days]":
            trialDaysForPlan(args.plan) || undefined
        }
      : {
          "payment_intent_data[metadata][clerkUserId]": args.clerkUserId,
          "payment_intent_data[metadata][plan]": args.plan
        }),
    success_url: `${args.webUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    // `/paywall` es ahora sólo un lanzador automático de Checkout: volver ahí
    // crearía otra sesión y encerraría a la persona en un bucle. Cancelar sale
    // a la Home autenticada.
    cancel_url: `${args.webUrl}/home`
  };
}

export function buildStripePortalForm(args: { customerId: string; webUrl: string }): StripeForm {
  return {
    customer: args.customerId,
    return_url: `${args.webUrl}/perfil`
  };
}

function stripeErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const message = (payload as StripeErrorPayload).error?.message;
  return typeof message === "string" && message.trim() ? message.trim() : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createStripeApi(secretKey: string, fetchImpl: StripeFetch = fetch): {
  post: <T>(path: string, fields: StripeForm) => Promise<T>;
  get: <T>(path: string) => Promise<T>;
} {
  if (!secretKey.trim()) throw new Error("STRIPE_SECRET_KEY not configured");

  const request = async <T>(
    method: "GET" | "POST",
    path: string,
    fields?: StripeForm
  ): Promise<T> => {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      let response: Response;
      try {
        response = await fetchImpl(`${STRIPE_API_BASE_URL}${normalizedPath}`, {
          method,
          headers: {
            Authorization: `Bearer ${secretKey}`,
            ...(method === "POST"
              ? { "Content-Type": "application/x-www-form-urlencoded" }
              : {})
          },
          body: method === "POST" ? encodeStripeForm(fields ?? {}) : undefined
        });
      } catch {
        throw new Error("Stripe API request failed");
      }

      const payload = await readJson(response);
      if (!response.ok) {
        const detail = (stripeErrorMessage(payload) ?? response.statusText) || "Unknown Stripe error";
        throw new Error(`Stripe API error (${response.status}): ${detail}`);
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("Stripe API returned an invalid response");
      }
      return payload as T;
  };

  return {
    post: async <T>(path: string, fields: StripeForm): Promise<T> =>
      await request<T>("POST", path, fields),
    get: async <T>(path: string): Promise<T> => await request<T>("GET", path)
  };
}

export function requireStripeString(payload: unknown, field: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Stripe API returned an invalid response");
  }
  const value = (payload as Record<string, unknown>)[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Stripe API response is missing ${field}`);
  }
  return value;
}
