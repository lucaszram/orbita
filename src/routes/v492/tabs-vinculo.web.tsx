import { VinculoScreen } from "@/screens/VinculoScreen";

/**
 * Ruta histórica de Vínculo (singular) en web: sigue siendo exactamente lo de
 * siempre, la pantalla canónica `VinculoScreen`.
 *
 * En nativo la sección es la pestaña `Vínculos`, así que esa ruta redirige (ver
 * `tabs-vinculo.tsx`, el archivo que Metro resuelve fuera de web).
 */
export default function VinculoRoute() {
  return <VinculoScreen />;
}
