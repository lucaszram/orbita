import { Redirect } from "expo-router";

/**
 * En web la carta vive en `/carta`, que no tiene detalles propios: este destino
 * redirige ahí en vez de montar una pantalla nativa.
 *
 * Es sólo la redirección —no importa `TipoLunarDetailScreen`— para que el
 * bundle web no arrastre una pantalla que nunca va a montar.
 */
export default function PerfilCartaTipoLunarRoute() {
  return <Redirect href="/carta" />;
}
