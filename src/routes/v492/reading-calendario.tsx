import { Redirect } from "expo-router";

/**
 * `/reading/calendario` es el aviso de «Próximamente» del ritual diario, que
 * sólo existe en web (ver `reading-calendario.web.tsx`, que Metro resuelve ahí).
 *
 * En nativo la sección equivalente es la pestaña Hoy, que ya trae la Luna y el
 * arco del día con fechas reales: este archivo sólo redirige y no importa
 * `DetailScreen` para no arrastrar el árbol del ritual al bundle nativo.
 */
export default function Route() {
  return <Redirect href="/hoy" />;
}
