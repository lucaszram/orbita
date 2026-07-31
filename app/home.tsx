import { Redirect } from "expo-router";
import { HomeScreen } from "@/screens/HomeScreen";
import { WebAppShell } from "@/components/web/web-app-shell";

// Inicio: el ritual diario completo (carta de tarot, velo, guía, tira del Diario y nota).
// Es la pantalla canónica compartida con el nativo, no una versión web aparte.
// `WebAppShell` aporta la navegación que en nativo pone el layout de pestañas.
export default function Route() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <WebAppShell active="inicio">
      <HomeScreen />
    </WebAppShell>
  );
}
