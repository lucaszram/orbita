import { Redirect } from "expo-router";
import { TransitosScreen } from "@/screens/TransitosScreen";
import { RequireSession } from "@/components/web/require-session";

// Tránsitos del día, con el cruce natal según el plan.
// Es la pantalla canónica compartida con el nativo, no una versión web aparte.
export default function Route() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <RequireSession>
      <TransitosScreen />
    </RequireSession>
  );
}
