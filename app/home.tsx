import { Redirect } from "expo-router";
import { OrbitaHome } from "@/components/web/orbita-home";

export default function HomeRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return <OrbitaHome />;
}
