import { Redirect } from "expo-router";
import { OrbitaValues } from "@/components/web/orbita-values";

export default function ValoresRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return <OrbitaValues />;
}
