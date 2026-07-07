"use node";
import { actionGeneric as action, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import Stripe from "stripe";

const getBindingRef = makeFunctionReference<"query">("payments/stripeInternal:getStripeBinding");
const upsertCustomerRef = makeFunctionReference<"mutation">("payments/stripeInternal:upsertStripeCustomer");

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key);
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
      const customer = await stripe.customers.create({
        email: identity.email ?? undefined,
        metadata: { clerkUserId }
      });
      customerId = customer.id;
      await ctx.runMutation(upsertCustomerRef, { clerkUserId, customerId });
    }

    const mode: Stripe.Checkout.SessionCreateParams.Mode = plan === "lifetime" ? "payment" : "subscription";

    const session = await stripe.checkout.sessions.create({
      mode,
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: clerkUserId,
      metadata: { clerkUserId, plan },
      ...(mode === "subscription"
        ? { subscription_data: { metadata: { clerkUserId, plan } } }
        : { payment_intent_data: { metadata: { clerkUserId, plan } } }),
      success_url: `${webUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${webUrl}/paywall`
    });

    if (!session.url) throw new Error("Stripe did not return a checkout url");
    return { url: session.url };
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

    const session = await stripe.billingPortal.sessions.create({
      customer: binding.stripeCustomerId,
      return_url: `${webAppUrl()}/profile`
    });

    return { url: session.url };
  }
});
