import { Redirect } from "expo-router";

/**
 * `/reading/deep-dive` es una lectura del ritual diario, que sólo existe en web
 * (ver `reading-deep-dive.web.tsx`, que Metro resuelve únicamente ahí).
 *
 * En nativo esa expansión no existe como pantalla aparte: la sección equivalente
 * es la pestaña Hoy. Este archivo sólo redirige y no importa `DetailScreen` ni
 * `useAppState` para no arrastrar el árbol del ritual al bundle nativo.
 */
export default function Route() {
  return <Redirect href="/hoy" />;
}
