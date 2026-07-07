import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CustomerInfo } from "react-native-purchases";
import {
  configureRevenueCat,
  getRevenueCatCustomerInfo,
  identifyRevenueCatUser,
  isOrbitaPro,
  isRevenueCatSupported,
  logOutRevenueCatUser,
  openRevenueCatCustomerCenter,
  presentOrbitaProPaywall,
  purchaseOrbitaPlan,
  restoreOrbitaPurchases,
  subscribeToCustomerInfo
} from "./client";
import { OrbitaPlanId } from "./constants";

type RevenueCatState = {
  customerInfo: CustomerInfo | null;
  error: string | null;
  isLoading: boolean;
  isPro: boolean;
  isSupported: boolean;
  identify: (appUserID: string | null | undefined) => Promise<void>;
  openCustomerCenter: () => Promise<void>;
  presentPaywall: () => Promise<boolean>;
  purchasePlan: (planId: OrbitaPlanId) => Promise<boolean>;
  refreshCustomerInfo: () => Promise<CustomerInfo | null>;
  restorePurchases: () => Promise<boolean>;
};

const SAFE_DEFAULT: RevenueCatState = {
  customerInfo: null,
  error: null,
  isLoading: false,
  isPro: false,
  isSupported: false,
  identify: async () => {},
  openCustomerCenter: async () => {},
  presentPaywall: async () => false,
  purchasePlan: async () => false,
  refreshCustomerInfo: async () => null,
  restorePurchases: async () => false
};

const RevenueCatContext = createContext<RevenueCatState | null>(null);

// Consumible sin provider montado (ej. web): devuelve el default seguro.
export function useRevenueCat(): RevenueCatState {
  return useContext(RevenueCatContext) ?? SAFE_DEFAULT;
}

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const supported = isRevenueCatSupported();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(supported);
  const lastAppUserId = useRef<string | null>(null);

  const refreshCustomerInfo = useCallback(async () => {
    if (!supported) return null;
    const next = await getRevenueCatCustomerInfo();
    setCustomerInfo(next);
    return next;
  }, [supported]);

  useEffect(() => {
    if (!supported) {
      setIsLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        await configureRevenueCat();
        unsubscribe = subscribeToCustomerInfo((next) => {
          if (mounted) setCustomerInfo(next);
        });
        const initial = await getRevenueCatCustomerInfo();
        if (mounted) setCustomerInfo(initial);
      } catch (err) {
        if (mounted) setError((err as Error).message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [supported]);

  // Bridge de identidad: alinea el app_user_id de RevenueCat con el clerkUserId.
  const identify = useCallback(
    async (appUserID: string | null | undefined) => {
      if (!supported) return;
      try {
        if (appUserID) {
          if (lastAppUserId.current === appUserID) return;
          lastAppUserId.current = appUserID;
          const info = await identifyRevenueCatUser(appUserID);
          setCustomerInfo(info);
        } else if (lastAppUserId.current) {
          lastAppUserId.current = null;
          await logOutRevenueCatUser();
          await refreshCustomerInfo();
        }
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [supported, refreshCustomerInfo]
  );

  const purchasePlan = useCallback(async (planId: OrbitaPlanId) => {
    const result = await purchaseOrbitaPlan(planId);
    if (result.customerInfo) setCustomerInfo(result.customerInfo);
    return result.isPro;
  }, []);

  const restorePurchases = useCallback(async () => {
    const result = await restoreOrbitaPurchases();
    if (result.customerInfo) setCustomerInfo(result.customerInfo);
    return result.isPro;
  }, []);

  const presentPaywall = useCallback(async () => {
    const result = await presentOrbitaProPaywall();
    if (result.customerInfo) setCustomerInfo(result.customerInfo);
    return result.isPro;
  }, []);

  const value = useMemo<RevenueCatState>(
    () => ({
      customerInfo,
      error,
      isLoading,
      isPro: isOrbitaPro(customerInfo),
      isSupported: supported,
      identify,
      openCustomerCenter: openRevenueCatCustomerCenter,
      presentPaywall,
      purchasePlan,
      refreshCustomerInfo,
      restorePurchases
    }),
    [customerInfo, error, isLoading, supported, identify, presentPaywall, purchasePlan, refreshCustomerInfo, restorePurchases]
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}
