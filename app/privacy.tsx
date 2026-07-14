import { Redirect } from "expo-router";
import { OrbitaPrivacy } from "@/components/web/orbita-legal";

export default function PrivacyRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return <OrbitaPrivacy />;
}
