import { CuatroRitmosScreen } from "@/screens/CuatroRitmosScreen";
import { WebAppShell } from "@/components/web/web-app-shell";

/**
 * Tu momento · Cuatro ritmos — el mandala temporal (CORE-211).
 * En web viaja dentro del shell (CORE-240): la nav de Tránsitos y el modo
 * escritorio los pone `WebAppShell` (frames `2023:2900` / `1740:2308`); en
 * nativo la pantalla se muestra tal cual dentro del stack.
 */
export default function Route() {
  if (process.env.EXPO_OS !== "web") {
    return <CuatroRitmosScreen />;
  }
  return (
    <WebAppShell active="transitos">
      <CuatroRitmosScreen />
    </WebAppShell>
  );
}
