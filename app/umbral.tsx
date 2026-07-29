import { Redirect } from "expo-router";
import { VoidExperience } from "@/components/void/VoidExperience";
import { WebAppShell } from "@/components/web/web-app-shell";

// El Umbral: la misma experiencia que la pestaña nativa.
// Es la pantalla canónica compartida con el nativo, no una versión web aparte.
// `WebAppShell` aporta la navegación que en nativo pone el layout de pestañas.
export default function Route() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <WebAppShell active="umbral">
      <VoidExperience showBack={false} />
    </WebAppShell>
  );
}
