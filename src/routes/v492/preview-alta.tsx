import { Redirect } from "expo-router";

/**
 * Herramienta interna de revisión visual: sólo existe en la web y sólo con el
 * interruptor puesto (ver `preview-alta.web.tsx`, que Metro resuelve únicamente
 * ahí). Su razón de ser es comparar el mismo paso del alta a ocho anchos de
 * ventana distintos, algo que en un teléfono no tiene sentido.
 *
 * En nativo la ruta devuelve a Hoy y no importa la matriz de tamaños ni monta
 * el alta en modo inspección.
 */
export default function Route() {
  return <Redirect href="/hoy" />;
}
