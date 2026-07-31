import { Redirect } from "expo-router";
import { OrbitaTerms } from "@/components/web/orbita-legal";

export default function TerminosRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return <OrbitaTerms />;
}
