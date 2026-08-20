import { Redirect } from "expo-router";

/**
 * `/reading/long-read` es la lectura larga del ritual diario, que sólo existe en
 * web (ver `reading-long-read.web.tsx`, que Metro resuelve únicamente ahí).
 *
 * En nativo esa lectura no existe: la sección equivalente es la pestaña Hoy, así
 * que este archivo sólo redirige y no importa `DetailScreen` ni `useAppState`
 * para no arrastrar el árbol del ritual al bundle nativo.
 */
export default function Route() {
  return <Redirect href="/hoy" />;
}
