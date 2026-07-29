import { Redirect } from "expo-router";
import { HomeScreen } from "@/screens/HomeScreen";
import { RequireSession } from "@/components/web/require-session";

// Inicio: el ritual diario completo (carta de tarot, velo, guía, tira del Diario y nota).
// Es la pantalla canónica compartida con el nativo, no una versión web aparte.
export default function Route() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <RequireSession>
      <HomeScreen />
    </RequireSession>
  );
}
