import { Redirect } from "expo-router";

/**
 * En web no se cargan personas: la superficie histórica de Vínculo es
 * `/vinculo` y ahí se queda. Sin importar la pantalla nativa, para no sumarla
 * al paquete web.
 */
export default function VinculosConectarRoute() {
  return <Redirect href="/vinculo" />;
}
