import { Redirect } from "expo-router";
import { TransitosScreen } from "@/screens/TransitosScreen";
import { WebAppShell } from "@/components/web/web-app-shell";

// Tránsitos del día, con el cruce natal según el plan.
// Es la pantalla canónica compartida con el nativo, no una versión web aparte.
// `WebAppShell` aporta la navegación que en nativo pone el layout de pestañas.
export default function Route() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <WebAppShell active="transitos">
      <TransitosScreen />
    </WebAppShell>
  );
}
