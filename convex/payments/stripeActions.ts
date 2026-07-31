import { actionGeneric as action, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import {
  automaticTaxEnabled,
  checkoutEnabled,
  commerceMode,
  requireStripeCheckoutDisplayName,
  requireStripeSecret,
  requireWebAppUrl,
  type CommerceMode
} from "../lib/commerce";
import {
  buildStripeCheckoutForm,
  buildStripeCustomerForm,
  buildStripePortalForm,
  createStripeApi,
  requireStripeString,
  STRIPE_CHECKOUT_API_VERSION,
  trialDaysForPlan,
  type StripePlan
} from "../lib/stripeApi";

const getBindingRef = makeFunctionReference<"query">(
  "payments/stripeInternal:getStripeBinding"
);
const upsertCustomerRef = makeFunctionReference<"mutation">(
  "payments/stripeInternal:upsertStripeCustomer"
);

type StripeBinding = {
  userId?: string;
  stripeCustomerId?: string;
  isPro: boolean;
  stripeIsPro: boolean;
};

type StripePrice = {
  id?: unknown;
  active?: unknown;
  currency?: unknown;
  livemode?: unknown;
  type?: unknown;
  unit_amount?: unknown;
  recurring?: {
    interval?: unknown;
  };
};

const commerceModeValidator = v.union(
  v.literal("off"),
  v.literal("test"),
  v.literal("live")
);
const planValidator = v.union(v.literal("weekly"), v.literal("yearly"));
const offerPlanValidator = v.object({
  id: planValidator,
  currency: v.string(),
  unitAmount: v.number(),
  interval: v.union(v.literal("week"), v.literal("year")),
  trialDays: v.number()
});

function stripeClient(mode: CommerceMode): ReturnType<typeof createStripeApi> {
  return createStripeApi(requireStripeSecret(mode));
}

function priceForPlan(plan: StripePlan): string {
  const price =
    plan === "weekly"
      ? process.env.STRIPE_PRICE_WEEKLY
      : process.env.STRIPE_PRICE_YEARLY;
  if (!price) {
    throw new Error(`Stripe price id not configured for plan "${plan}"`);
  }
  return price;
}

async function bindingFor(
  ctx: any,
  clerkUserId: string
): Promise<StripeBinding> {
  return await ctx.runQuery(getBindingRef, { clerkUserId });
}

function validatePrice(
  payload: StripePrice,
  args: {
    id: StripePlan;
    priceId: string;
    mode: CommerceMode;
    interval: "week" | "year";
  }
): {
  id: StripePlan;
  currency: string;
  unitAmount: number;
  interval: "week" | "year";
  trialDays: number;
} {
  const expectedLive = args.mode === "live";
  if (
    payload.id !== args.priceId ||
    payload.active !== true ||
    payload.type !== "recurring" ||
    payload.livemode !== expectedLive ||
    payload.recurring?.interval !== args.interval ||
    typeof payload.currency !== "string" ||
    !payload.currency ||
    typeof payload.unit_amount !== "number" ||
    !Number.isSafeInteger(payload.unit_amount) ||
    payload.unit_amount < 0
  ) {
    throw new Error(`Stripe price is invalid for plan "${args.id}"`);
  }

  return {
    id: args.id,
    currency: payload.currency.toUpperCase(),
    unitAmount: payload.unit_amount,
    interval: args.interval,
    trialDays: trialDaysForPlan(args.id)
  };
}

export const getWebOffer = action({
  args: {},
  returns: v.object({
    commerceMode: commerceModeValidator,
    checkoutEnabled: v.boolean(),
    plans: v.array(offerPlanValidator)
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");

    const mode = commerceMode();
    if (!checkoutEnabled(mode)) {
      return { commerceMode: mode, checkoutEnabled: false, plans: [] };
    }

    const stripe = stripeClient(mode);
    const weeklyPriceId = priceForPlan("weekly");
    const yearlyPriceId = priceForPlan("yearly");
    const [weekly, yearly] = await Promise.all([
      stripe.get<StripePrice>(`/prices/${encodeURIComponent(weeklyPriceId)}`),
      stripe.get<StripePrice>(`/prices/${encodeURIComponent(yearlyPriceId)}`)
    ]);

    return {
      commerceMode: mode,
      checkoutEnabled: true,
      plans: [
        validatePrice(weekly, {
          id: "weekly",
          priceId: weeklyPriceId,
          mode,
          interval: "week"
        }),
        validatePrice(yearly, {
          id: "yearly",
          priceId: yearlyPriceId,
          mode,
          interval: "year"
        })
      ]
    };
  }
});

export const createCheckoutSession = action({
  args: { plan: planValidator },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, { plan }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");
    const clerkUserId = identity.subject;

    const mode = commerceMode();
    const stripe = stripeClient(mode);
    const webUrl = requireWebAppUrl(mode);
    const displayName = requireStripeCheckoutDisplayName();
    const priceId = priceForPlan(plan);
    validatePrice(
      await stripe.get<StripePrice>(
        `/prices/${encodeURIComponent(priceId)}`
      ),
      {
        id: plan,
        priceId,
        mode,
        interval: plan === "weekly" ? "week" : "year"
      }
    );
    const binding = await bindingFor(ctx, clerkUserId);
    if (!binding.userId) {
      throw new Error("Complete account setup before starting checkout");
    }
    if (binding.isPro) {
      throw new Error("This account already has Plus access");
    }

    let customerId = binding.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.post<unknown>(
        "/customers",
        buildStripeCustomerForm({
          email: identity.email,
          clerkUserId
        })
      );
      customerId = requireStripeString(customer, "id");
      await ctx.runMutation(upsertCustomerRef, { clerkUserId, customerId });
    }

    const session = await stripe.post<unknown>(
      "/checkout/sessions",
      buildStripeCheckoutForm({
        plan,
        customerId,
        priceId,
        clerkUserId,
        webUrl,
        displayName,
        automaticTax: automaticTaxEnabled()
      }),
      { stripeVersion: STRIPE_CHECKOUT_API_VERSION }
    );

    return { url: requireStripeString(session, "url") };
  }
});

export const getCheckoutStatus = action({
  args: { sessionId: v.string() },
  returns: v.object({
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("failed")
    )
  }),
  handler: async (ctx, { sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");
    if (
      sessionId.length > 255 ||
      !/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(sessionId)
    ) {
      throw new Error("Invalid checkout session");
    }

    const mode = commerceMode();
    const stripe = stripeClient(mode);
    const session = await stripe.get<Record<string, any>>(
      `/checkout/sessions/${encodeURIComponent(sessionId)}`
    );
    const clerkUserId = identity.subject;
    const owner =
      session.client_reference_id ?? session.metadata?.clerkUserId;
    if (owner !== clerkUserId) {
      throw new Error("Checkout session does not belong to this account");
    }
    if (
      session.mode !== "subscription" ||
      (session.metadata?.plan !== "weekly" &&
        session.metadata?.plan !== "yearly")
    ) {
      throw new Error("Unsupported checkout session");
    }

    const binding = await bindingFor(ctx, clerkUserId);
    if (
      binding.stripeCustomerId &&
      session.customer !== binding.stripeCustomerId
    ) {
      throw new Error("Checkout customer does not match this account");
    }
    if (session.status === "expired") return { status: "failed" as const };
    if (session.status === "complete" && binding.stripeIsPro) {
      return { status: "active" as const };
    }
    return { status: "pending" as const };
  }
});

export const createPortalSession = action({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");
    const clerkUserId = identity.subject;

    const mode = commerceMode();
    const stripe = stripeClient(mode);
    const binding = await bindingFor(ctx, clerkUserId);
    if (!binding.stripeCustomerId || !binding.stripeIsPro) {
      throw new Error("No manageable Stripe subscription for this user");
    }

    const session = await stripe.post<unknown>(
      "/billing_portal/sessions",
      buildStripePortalForm({
        customerId: binding.stripeCustomerId,
        webUrl: requireWebAppUrl(mode)
      })
    );

    return { url: requireStripeString(session, "url") };
  }
});
