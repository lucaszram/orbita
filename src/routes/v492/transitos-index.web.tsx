import { TransitosScreen } from "@/screens/TransitosScreen";

/**
 * Tránsitos en web: la pantalla de siempre (`@/screens/TransitosScreen`), sin
 * cambios — es la que la navegación web ya sirve en esta ruta.
 *
 * No importa `TransitosLayersScreen`: la lista nativa V4.9.2 no se monta acá y
 * el bundle web no debe empaquetarla.
 */
export default function TransitosRoute() {
  return <TransitosScreen />;
}
