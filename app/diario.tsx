import { Redirect } from "expo-router";
import { DiarioScreen } from "@/screens/DiarioScreen";
import { RequireSession } from "@/components/web/require-session";

// Diario real: la tira de cartas y el ritual de cada día.
// Es la pantalla canónica compartida con el nativo, no una versión web aparte.
export default function Route() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <RequireSession>
      <DiarioScreen />
    </RequireSession>
  );
}
