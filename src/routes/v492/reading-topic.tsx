import { Redirect } from "expo-router";

/**
 * `/reading/topic` es el detalle de un tema del ritual diario, que sólo existe
 * en web (ver `reading-topic.web.tsx`, que Metro resuelve únicamente ahí).
 *
 * En nativo los temas no tienen pantalla propia: la sección equivalente es la
 * pestaña Hoy, así que este archivo sólo redirige y no importa `DetailScreen`
 * ni `useAppState` para no arrastrar el árbol del ritual al bundle nativo.
 */
export default function Route() {
  return <Redirect href="/hoy" />;
}
