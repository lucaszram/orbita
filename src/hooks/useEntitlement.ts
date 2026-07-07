import { useConvexAuth, useQuery } from "convex/react";
import { useRevenueCat } from "../services/revenuecat/RevenueCatProvider";
import { EntitlementResult, EntitlementStatus, OrbitaPlanId, paymentsApi } from "../services/paymentsRefs";

// Estado de acceso Pro combinando las dos fuentes:
// - RevenueCat (nativo): respuesta instantánea en el device tras comprar.
// - Convex (subscriptions.getCurrent): verdad server-side + caso cross-surface
//   (compró en la web con Stripe, abre la app).
// Regla: isPro = RevenueCat || Convex. En web RevenueCat siempre es false, así
// que ahí manda Convex.
//
// Debe usarse dentro de un ConvexProvider (la query se saltea si no hay sesión).
export type EntitlementState = {
  isPro: boolean;
  isLoading: boolean;
  source: "revenuecat" | "convex" | "none";
  status?: EntitlementStatus;
  plan?: OrbitaPlanId;
  isLifetime: boolean;
  currentPeriodEnd?: number;
  willRenew?: boolean;
  canManageInStripePortal: boolean;
  convex?: EntitlementResult;
  refresh: () => Promise<void>;
};

export function useEntitlement(): EntitlementState {
  const rc = useRevenueCat();
  const { isAuthenticated } = useConvexAuth();
  // Sin sesión: skip para no disparar requireExistingUser (que tira error).
  const convexSub = useQuery(paymentsApi.getCurrent, isAuthenticated ? {} : "skip");

  const rcIsPro = rc.isPro;
  const convexIsPro = convexSub?.isPro ?? false;
  const isPro = rcIsPro || convexIsPro;

  const convexLoading = isAuthenticated && convexSub === undefined;
  // Resolvemos apenas una fuente da Pro; si ninguna, esperamos a ambas.
  const isLoading = !isPro && (rc.isLoading || convexLoading);

  const source: EntitlementState["source"] = rcIsPro ? "revenuecat" : convexIsPro ? "convex" : "none";

  return {
    isPro,
    isLoading,
    source,
    status: convexSub?.status,
    plan: convexSub?.plan,
    isLifetime: convexSub?.isLifetime ?? rc.isPro,
    currentPeriodEnd: convexSub?.currentPeriodEnd,
    willRenew: convexSub?.willRenew,
    canManageInStripePortal: convexSub?.canManageInStripePortal ?? false,
    convex: convexSub ?? undefined,
    refresh: async () => {
      await rc.refreshCustomerInfo();
    }
  };
}
