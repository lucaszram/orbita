import { EstacionVitalScreen } from "@/screens/EstacionVitalScreen";
import { WebAppShell } from "@/components/web/web-app-shell";

/**
 * Tu momento · Estación vital (CORE-209), variante WEB: dentro del shell, con la nav de Tránsitos y el modo
 * escritorio (frames 2023:2900 / 1740:2308, CORE-240).
 */
export default function Route() {
  return (
    <WebAppShell active="transitos">
      <EstacionVitalScreen />
    </WebAppShell>
  );
}
