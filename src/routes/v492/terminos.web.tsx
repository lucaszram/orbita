import { Redirect } from "expo-router";
import { RouteHead } from "@/web/route-head";
import { OrbitaTerms } from "@/components/web/orbita-legal";

export default function TerminosRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <>
      {/* Ficha propia de esta ruta: título, descripción y canónica a
          `/terminos`. Antes las compartía con la portada (CORE-272). */}
      <RouteHead path="/terminos" />
      <OrbitaTerms />
    </>
  );
}
