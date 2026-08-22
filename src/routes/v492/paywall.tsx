import { AccountGate } from "@/components/orbita/AccountGate";
import { PlusPaywallScreen } from "@/screens/v492/PlusPaywallScreen";

/**
 * Compra nativa con RevenueCat. La implementación `.web.tsx` hermana conserva
 * el checkout alojado de Stripe y nunca importa este árbol.
 */
export default function Route() {
  return (
    // `requires="confirmed-session"`: esta ruta existe para cobrar (QA23-007).
    // Con la sesión sin confirmar no abre ni siquiera en modo degradado, y no es
    // una precaución de más: adentro viven el Offering, el botón de compra, el
    // restore y el Customer Center, y los cuatro atan un cargo a una identidad.
    // Sin poder confirmar QUIÉN está comprando, ninguno de los cuatro puede
    // ofrecerse. El bloqueo muestra reintento; no manda al login.
    <AccountGate surface="app" requires="confirmed-session">
      <PlusPaywallScreen />
    </AccountGate>
  );
}
