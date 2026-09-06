import { Redirect } from "expo-router";

/**
 * En web la carta tiene su ruta propia de siempre (`/carta`), así que
 * `/perfil/carta` redirige y la navegación web no cambia.
 *
 * Es sólo la redirección —no importa `CartaHubScreen`— para que el bundle web
 * no arrastre una pantalla que nunca va a montar.
 */
export default function PerfilCartaRoute() {
  return <Redirect href="/carta" />;
}
