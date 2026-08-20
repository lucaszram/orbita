import { Redirect } from "expo-router";
import { DiarioScreen } from "@/screens/DiarioScreen";
import { WebAppShell } from "@/components/web/web-app-shell";

// Diario real: la tira de cartas y el ritual de cada día.
// Es la pantalla canónica compartida con el nativo, no una versión web aparte.
// `WebAppShell` aporta la navegación que en nativo pone el layout de pestañas.
export default function Route() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <WebAppShell active="diario">
      <DiarioScreen />
    </WebAppShell>
  );
}
