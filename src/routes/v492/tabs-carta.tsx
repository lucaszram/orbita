import { Redirect } from "expo-router";

/**
 * Alias legado /carta (nativo): el hub es la raíz de la pestaña. Directo, sin
 * encadenar con /perfil/carta.
 */
export default function CartaRoute() {
  return <Redirect href="/perfil" />;
}
