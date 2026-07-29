import { Redirect } from "expo-router";
import { ValoresScreen } from "@/screens/ValoresScreen";
import { RequireSession } from "@/components/web/require-session";

// Mapa de valores: pantalla canónica compartida con el nativo.
export default function Route() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <RequireSession>
      <ValoresScreen />
    </RequireSession>
  );
}
