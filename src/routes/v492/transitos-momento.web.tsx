import { Redirect } from "expo-router";

/**
 * La web no tiene la vista `Tu momento`: sus tránsitos viven en `/transito`.
 *
 * Es una redirección y nada más —no importa `TransitosLayersScreen`— para que el
 * bundle web no arrastre una pantalla nativa que nunca va a montar.
 */
export default function TransitosMomentoRoute() {
  return <Redirect href="/transito" />;
}
