import { Redirect } from "expo-router";
import { OrbitaPersonality } from "@/components/web/orbita-personality";

export default function PersonalidadRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return <OrbitaPersonality />;
}
