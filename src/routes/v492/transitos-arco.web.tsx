import { Redirect } from "expo-router";

/**
 * La web no tiene el detalle por arco: su detalle de tránsito es `/transito`.
 *
 * Es una redirección y nada más —no importa `ArcoDetailScreen`— para que el
 * bundle web no arrastre una pantalla que nunca va a montar.
 */
export default function TransitoDetalleRoute() {
  return <Redirect href="/transito" />;
}
