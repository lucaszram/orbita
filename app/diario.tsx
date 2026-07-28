import { Redirect } from "expo-router";
import { OrbitaSoon } from "@/components/web/orbita-soon";
import { RequireSession } from "@/components/web/require-session";

export default function DiarioRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  // Es una ruta de app: sin sesión no se muestra el shell ni la navegación.
  return (
    <RequireSession>
      <DiarioContent />
    </RequireSession>
  );
}

function DiarioContent() {
  return (
    <OrbitaSoon
      active="diario"
      eyebrow="Diario"
      title="Lo que te movió, guardado."
      body="Tus notas junto a la lectura de cada día, para volver a leerte con el tiempo."
    />
  );
}
