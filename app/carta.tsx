import { Redirect } from "expo-router";
import { CartaScreen } from "@/screens/CartaScreen";
import { WebAppShell } from "@/components/web/web-app-shell";

// Carta natal: rueda/tabla, tríada, posiciones, aspectos, casas, valores y lectura.
// Es la pantalla canónica compartida con el nativo, no una versión web aparte.
// `WebAppShell` aporta la navegación que en nativo pone el layout de pestañas.
export default function Route() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <WebAppShell active="carta">
      <CartaScreen />
    </WebAppShell>
  );
}
