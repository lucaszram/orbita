import { Redirect } from "expo-router";
import { OrbitaSupport } from "@/components/web/orbita-legal";

export default function SupportRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return <OrbitaSupport />;
}
