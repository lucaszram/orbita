import { CartaHubScreen } from "@/screens/v492/CartaHubScreen";

/**
 * La pestaña "Tu carta" abre el hub de la carta DIRECTAMENTE.
 *
 * Decisión de producto (2026-08-19): la carta natal es el corazón de la app y
 * estaba a dos taps. Lo administrativo vive detrás del engranaje del header
 * (→ /perfil/ajustes). El name de la ruta sigue siendo `perfil` a propósito:
 * la URL web y los redirects existentes no se mueven.
 */
export default function PerfilIndexRoute() {
  return <CartaHubScreen />;
}
