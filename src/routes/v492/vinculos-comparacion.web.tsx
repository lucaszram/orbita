import { Redirect } from "expo-router";

/**
 * La web no tiene comparación por persona: su superficie de Vínculo sigue siendo
 * `/vinculo`, exactamente la de siempre. Sin importar la pantalla nativa, para no
 * sumarla al paquete web.
 */
export default function VinculosComparacionRoute() {
  return <Redirect href="/vinculo" />;
}
