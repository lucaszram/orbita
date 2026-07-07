import { anyApi } from "convex/server";
import type { FunctionReference } from "convex/server";

// Refs tipadas al contrato de pagos v2 (ver ../../convex/CHANGELOG.md, entrada
// "Contrato de pagos v2"). El front consume vía anyApi + firmas a mano, igual
// que appRefs.ts, para no acoplarse al `_generated` directo.

type Empty = Record<string, never>;

export type OrbitaPlanId = "weekly" | "yearly" | "lifetime";

export type EntitlementStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "billing_issue"
  | "canceled"
  | "expired";

export type EntitlementResult = {
  entitlement: "free" | "orbita_pro";
  isPro: boolean;
  status: EntitlementStatus;
  provider?: "revenuecat" | "stripe" | "stub";
  plan?: OrbitaPlanId;
  isLifetime: boolean;
  currentPeriodEnd?: number;
  willRenew?: boolean;
  canManageInStripePortal: boolean;
};

export const paymentsApi = {
  // subscriptions.getCurrent — fuente de verdad server-side del acceso.
  getCurrent: anyApi.subscriptions.getCurrent as FunctionReference<"query", "public", Empty, EntitlementResult>,
  // payments.stripeActions.* — checkout y portal para la web.
  createCheckoutSession: anyApi.payments.stripeActions.createCheckoutSession as FunctionReference<
    "action",
    "public",
    { plan: OrbitaPlanId },
    { url: string }
  >,
  createPortalSession: anyApi.payments.stripeActions.createPortalSession as FunctionReference<
    "action",
    "public",
    Empty,
    { url: string }
  >
};
