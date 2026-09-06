import { Redirect } from "expo-router";
import { ValoresScreen } from "@/screens/ValoresScreen";
import { WebAppShell } from "@/components/web/web-app-shell";

// Mapa de valores: destino contextual de la Carta.
// Es la pantalla canónica compartida con el nativo, no una versión web aparte.
// `WebAppShell` aporta la navegación que en nativo pone el layout de pestañas.
export default function Route() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <WebAppShell active="carta">
      <ValoresScreen />
    </WebAppShell>
  );
}
