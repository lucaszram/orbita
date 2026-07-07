import { Redirect } from "expo-router";
import { OrbitaTransit } from "@/components/web/orbita-transit";

export default function TransitoRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return <OrbitaTransit />;
}
