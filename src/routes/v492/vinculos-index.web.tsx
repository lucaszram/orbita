import { Redirect } from "expo-router";

/**
 * La web no tiene la sección nueva: su superficie de Vínculo sigue siendo
 * `/vinculo`, exactamente la de siempre.
 *
 * Es una redirección y nada más —no importa la pantalla nativa— para que el
 * paquete web no arrastre un árbol que nunca va a montar.
 */
export default function VinculosRoute() {
  return <Redirect href="/vinculo" />;
}
