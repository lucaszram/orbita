import { VinculoComparacionScreen } from "@/screens/VinculoComparacionScreen";
import { WebAppShell } from "@/components/web/web-app-shell";

/**
 * Vínculos · Comparación — la comparación real con la persona guardada (CORE-212).
 * En web viaja dentro del shell (CORE-236): la navegación de la sección y el
 * modo escritorio los pone `WebAppShell`, como en `/transito`; en nativo la
 * pantalla se muestra tal cual dentro del stack.
 */
export default function VinculoResultadoRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <VinculoComparacionScreen />;
  }
  return (
    <WebAppShell active="vinculo">
      <VinculoComparacionScreen />
    </WebAppShell>
  );
}
