import { Redirect } from "expo-router";
import { OrbitaSoon } from "@/components/web/orbita-soon";

export default function DiarioRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <OrbitaSoon
      active="diario"
      eyebrow="Diario"
      title="Lo que te movió, guardado."
      body="Tus notas junto a la lectura de cada día, para volver a leerte con el tiempo."
    />
  );
}
