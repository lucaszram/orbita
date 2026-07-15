const STRIPE_API_BASE_URL = "https://api.stripe.com/v1";

export type StripeFormValue = string | number | boolean | null | undefined;
export type StripeForm = Record<string, StripeFormValue>;
export type StripeFetch = (input: string, init: RequestInit) => Promise<Response>;
export type StripePlan = "weekly" | "yearly" | "lifetime";

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
  plan: StripePlan;
  customerId: string;
  priceId: string;
  clerkUserId: string;
  webUrl: string;
}): StripeForm {
  const mode = args.plan === "lifetime" ? "payment" : "subscription";
  return {
    mode,
    customer: args.customerId,
    "line_items[0][price]": args.priceId,
    "line_items[0][quantity]": 1,
    client_reference_id: args.clerkUserId,
    "metadata[clerkUserId]": args.clerkUserId,
    "metadata[plan]": args.plan,
    ...(mode === "subscription"
      ? {
          "subscription_data[metadata][clerkUserId]": args.clerkUserId,
          "subscription_data[metadata][plan]": args.plan
        }
      : {
          "payment_intent_data[metadata][clerkUserId]": args.clerkUserId,
          "payment_intent_data[metadata][plan]": args.plan
        }),
    success_url: `${args.webUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${args.webUrl}/paywall`
  };
}

export function buildStripePortalForm(args: { customerId: string; webUrl: string }): StripeForm {
  return {
    customer: args.customerId,
    return_url: `${args.webUrl}/profile`
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
} {
  if (!secretKey.trim()) throw new Error("STRIPE_SECRET_KEY not configured");

  return {
    post: async <T>(path: string, fields: StripeForm): Promise<T> => {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      let response: Response;
      try {
        response = await fetchImpl(`${STRIPE_API_BASE_URL}${normalizedPath}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: encodeStripeForm(fields)
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
    }
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
