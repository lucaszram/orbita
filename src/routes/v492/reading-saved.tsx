import { Redirect } from "expo-router";

/**
 * `/reading/saved` es el archivo de lecturas guardadas del ritual diario, que
 * sólo existe en web (ver `reading-saved.web.tsx`, que Metro resuelve ahí).
 *
 * En nativo no hay guardadas del ritual: la sección equivalente es la pestaña
 * Hoy, así que este archivo sólo redirige y no importa `DetailScreen` ni
 * `useAppState` para no arrastrar el árbol del ritual al bundle nativo.
 */
export default function Route() {
  return <Redirect href="/hoy" />;
}
