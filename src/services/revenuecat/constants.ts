// Identificadores de RevenueCat. `orbita_pro` es el mismo identificador canónico
// que usa Convex y Stripe (ver convex/lib/entitlements.ts).
export const ORBITA_PRO_ENTITLEMENT_ID = "orbita_pro";
export const ORBITA_REVENUECAT_OFFERING_ID = "default";

export type OrbitaPlanId = "lifetime" | "yearly" | "weekly";

export const ORBITA_PLAN_PRODUCT_IDS: Record<OrbitaPlanId, string> = {
  lifetime: "lifetime",
  yearly: "yearly",
  weekly: "weekly"
};
