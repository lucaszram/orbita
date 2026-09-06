import { Redirect } from "expo-router";

/**
 * La web no tiene comparación por persona: su superficie de Vínculo sigue
 * siendo `/vinculo`. Sin importar la pantalla nativa, para no sumarla al
 * paquete web.
 */
export default function VinculosPerfilRoute() {
  return <Redirect href="/vinculo" />;
}
