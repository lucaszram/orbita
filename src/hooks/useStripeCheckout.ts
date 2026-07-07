import { useAction } from "convex/react";
import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { OrbitaPlanId, paymentsApi } from "../services/paymentsRefs";

// Checkout web con Stripe: pide la Checkout Session a Convex (que hereda la
// identidad Clerk) y redirige. Solo web; en nativo se usa RevenueCat.
export function useStripeCheckout() {
  const createSession = useAction(paymentsApi.createCheckoutSession);
  const createPortal = useAction(paymentsApi.createPortalSession);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirect = (url: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.assign(url);
    }
  };

  const startCheckout = useCallback(
    async (plan: OrbitaPlanId) => {
      setError(null);
      setIsRedirecting(true);
      try {
        const { url } = await createSession({ plan });
        redirect(url);
        return url;
      } catch (e) {
        setError((e as Error).message);
        setIsRedirecting(false);
        throw e;
      }
    },
    [createSession]
  );

  const openPortal = useCallback(async () => {
    setError(null);
    try {
      const { url } = await createPortal({});
      redirect(url);
      return url;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, [createPortal]);

  return { startCheckout, openPortal, isRedirecting, error };
}
