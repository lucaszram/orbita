import { TransitosLayersScreen } from "@/screens/v492/TransitosLayersScreen";

/**
 * Tránsitos · Ahora: la lista completa V4.9.2, que lee el sobre real de
 * `layers.getForDate`.
 *
 * Es la raíz de la sección y la vista por defecto del selector; la otra vista
 * (`Tu momento`) vive en `/transitos/momento`. Importa sólo la pantalla nativa:
 * el bundle de iOS no tiene por qué arrastrar la de web.
 */
export default function TransitosRoute() {
  return <TransitosLayersScreen mode="ahora" />;
}
