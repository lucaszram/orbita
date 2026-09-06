import { VoidExperience } from "@/components/void/VoidExperience";

/**
 * El Umbral (nativo). Raíz de pestaña → sin botón "volver". Es exactamente lo
 * que montaba `app/(tabs)/umbral/index.tsx` en release/1.0.0.
 */
export default function UmbralTab() {
  return <VoidExperience showBack={false} />;
}
