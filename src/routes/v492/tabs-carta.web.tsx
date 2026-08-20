import { CartaScreen } from "@/screens/CartaScreen";

/**
 * Ruta histórica de la Carta (`/carta`) en web: sigue siendo exactamente lo de
 * siempre, la pantalla canónica `CartaScreen` (la navegación web enlaza acá).
 *
 * En nativo la Carta vive dentro del Perfil (`/perfil/carta`), así que esa ruta
 * redirige (ver `tabs-carta.tsx`, el archivo que Metro resuelve fuera de web).
 */
export default function CartaRoute() {
  return <CartaScreen />;
}
