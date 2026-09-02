import { Redirect } from "expo-router";
import { UmbralSections } from "@/components/web/umbral-sections";
import { WebAppShell } from "@/components/web/web-app-shell";

// El Umbral: la experiencia canónica compartida con el nativo (Preguntar) más
// Tarot, que en la web tiene acá su superficie propia. El selector envuelve a
// `VoidExperience`; no la reemplaza ni la modifica.
// `WebAppShell` aporta la navegación que en nativo pone el layout de pestañas.
export default function Route() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <WebAppShell active="umbral">
      <UmbralSections />
    </WebAppShell>
  );
}
