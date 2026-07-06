import { Redirect } from "expo-router";
import { OrbitaLogin } from "@/components/web/orbita-login";

export default function LoginRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return <OrbitaLogin />;
}
