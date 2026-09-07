import { Redirect } from "expo-router";
import { RouteHead } from "@/web/route-head";
import { OrbitaSupport } from "@/components/web/orbita-legal";

export default function SupportRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <>
      {/* Ficha propia de esta ruta: título, descripción y canónica a
          `/support`. Antes las compartía con la portada (CORE-272). */}
      <RouteHead path="/support" />
      <OrbitaSupport />
    </>
  );
}
