import { Redirect } from "expo-router";
import { OrbitaLab } from "@/components/web/orbita-lab";
import { INTERNAL_TOOLS_ENABLED } from "@/services/internalTools";

export default function LabRoute() {
  // Antes sólo se cerraba en nativo: en la web publicada el Lab era ruteable.
  if (!INTERNAL_TOOLS_ENABLED || process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return <OrbitaLab />;
}
