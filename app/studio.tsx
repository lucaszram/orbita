import { Redirect } from "expo-router";
import { OrbitaStudio } from "@/components/web/orbita-studio";
import { INTERNAL_TOOLS_ENABLED } from "@/services/internalTools";

export default function StudioRoute() {
  if (!INTERNAL_TOOLS_ENABLED) return <Redirect href="/" />;
  return <OrbitaStudio />;
}
