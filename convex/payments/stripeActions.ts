import { actionGeneric as action, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import {
  buildStripeCheckoutForm,
  buildStripeCustomerForm,
  buildStripePortalForm,
  createStripeApi,
  requireStripeString
} from "../lib/stripeApi";

const getBindingRef = makeFunctionReference<"query">("payments/stripeInternal:getStripeBinding");
const upsertCustomerRef = makeFunctionReference<"mutation">("payments/stripeInternal:upsertStripeCustomer");

function stripeClient(): ReturnType<typeof createStripeApi> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return createStripeApi(key);
}

function priceForPlan(plan: "weekly" | "yearly" | "lifetime"): string {
  const price = {
    weekly: process.env.STRIPE_PRICE_WEEKLY,
    yearly: process.env.STRIPE_PRICE_YEARLY,
    lifetime: process.env.STRIPE_PRICE_LIFETIME
  }[plan];
  if (!price) throw new Error(`Stripe price id not configured for plan "${plan}"`);
  return price;
}

function webAppUrl(): string {
  return process.env.WEB_APP_URL ?? "http://localhost:8081";
}

// Crea la Checkout Session de Stripe para el usuario Clerk autenticado (web).
// weekly/yearly → subscription; lifetime → payment one-time.
export const createCheckoutSession = action({
  args: { plan: v.union(v.literal("weekly"), v.literal("yearly"), v.literal("lifetime")) },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, { plan }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");
    const clerkUserId = identity.subject;

    const stripe = stripeClient();
    const priceId = priceForPlan(plan);
    const webUrl = webAppUrl();

    // Reusar el customer existente para no duplicar.
    const binding: { stripeCustomerId?: string } = await ctx.runQuery(getBindingRef, { clerkUserId });
    let customerId = binding.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.post<unknown>(
        "/customers",
        buildStripeCustomerForm({ email: identity.email, clerkUserId })
      );
      customerId = requireStripeString(customer, "id");
      await ctx.runMutation(upsertCustomerRef, { clerkUserId, customerId });
    }

    const session = await stripe.post<unknown>(
      "/checkout/sessions",
      buildStripeCheckoutForm({ plan, customerId, priceId, clerkUserId, webUrl })
    );

    return { url: requireStripeString(session, "url") };
  }
});

// Abre el Customer Portal de Stripe para gestionar/cancelar (web).
export const createPortalSession = action({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");
    const clerkUserId = identity.subject;

    const stripe = stripeClient();
    const binding: { stripeCustomerId?: string } = await ctx.runQuery(getBindingRef, { clerkUserId });
    if (!binding.stripeCustomerId) throw new Error("No Stripe customer for this user");

    const session = await stripe.post<unknown>(
      "/billing_portal/sessions",
      buildStripePortalForm({ customerId: binding.stripeCustomerId, webUrl: webAppUrl() })
    );

    return { url: requireStripeString(session, "url") };
  }
});
