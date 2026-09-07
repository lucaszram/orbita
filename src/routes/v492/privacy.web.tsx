import { Redirect } from "expo-router";
import { RouteHead } from "@/web/route-head";
import { OrbitaPrivacy } from "@/components/web/orbita-legal";

export default function PrivacyRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <>
      {/* Ficha propia de esta ruta: título, descripción y canónica a
          `/privacy`. Antes las compartía con la portada (CORE-272). */}
      <RouteHead path="/privacy" />
      <OrbitaPrivacy />
    </>
  );
}
