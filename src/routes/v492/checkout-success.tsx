import { Redirect } from "expo-router";

/**
 * La vuelta de Stripe es una superficie EXCLUSIVA de la web: el `success_url`
 * lo fija el backend contra `WEB_APP_URL` (ver `checkout-success.web.tsx`, que
 * Metro resuelve únicamente ahí).
 *
 * En nativo esa URL no se abre nunca, así que la ruta sólo redirige al Perfil y
 * no importa el árbol del checkout.
 */
export default function Route() {
  return <Redirect href="/perfil/ajustes" />;
}
