import { Redirect } from "expo-router";
import { OrbitaLab } from "@/components/web/orbita-lab";

export default function LabRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return <OrbitaLab />;
}
