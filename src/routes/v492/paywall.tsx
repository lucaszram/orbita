import { AccountGate } from "@/components/orbita/AccountGate";
import { PlusPaywallScreen } from "@/screens/v492/PlusPaywallScreen";

/**
 * Compra nativa con RevenueCat. La implementación `.web.tsx` hermana conserva
 * el checkout alojado de Stripe y nunca importa este árbol.
 */
export default function Route() {
  return (
    <AccountGate surface="app">
      <PlusPaywallScreen />
    </AccountGate>
  );
}
