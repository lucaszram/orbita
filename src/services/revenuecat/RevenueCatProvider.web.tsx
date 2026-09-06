import type { ReactNode } from "react";

import type { RevenueCatContextValue } from "@/services/revenuecat/types";

const WEB_DISABLED: RevenueCatContextValue = {
  phase: "unavailable",
  plans: [],
  storeIsPro: false,
  identifiedUserId: null,
  offeringId: null,
  purchase: async () => "inactive",
  restore: async () => "inactive",
  presentCustomerCenter: async () => undefined,
  retry: async () => undefined,
  refreshCustomerInfo: async () => false,
  trackPaywallImpression: async () => false
};

/** Stripe conserva el comercio web; esta variante no carga ningún módulo RC. */
export function RevenueCatProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useRevenueCat(): RevenueCatContextValue {
  return WEB_DISABLED;
}
