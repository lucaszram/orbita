import { Redirect } from "expo-router";
import { OrbitaChart } from "@/components/web/orbita-chart";

export default function CartaRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return <OrbitaChart />;
}
