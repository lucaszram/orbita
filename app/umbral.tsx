import { Redirect } from "expo-router";
import { VoidExperience } from "@/components/void/VoidExperience";
import { RequireSession } from "@/components/web/require-session";

// El Umbral: la misma experiencia que la pestaña nativa.
// Es la pantalla canónica compartida con el nativo, no una versión web aparte.
export default function Route() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <RequireSession>
      <VoidExperience showBack={false} />
    </RequireSession>
  );
}
