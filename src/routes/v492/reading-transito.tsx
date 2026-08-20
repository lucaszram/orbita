import { Redirect } from "expo-router";

/**
 * `/reading/transito` es el detalle del tránsito legado, que sólo existe en web
 * (ver `reading-transito.web.tsx`, que Metro resuelve únicamente ahí).
 *
 * En nativo V4.9.2 ese detalle es el arco de Hoy, con sus fechas reales y su
 * trazabilidad. Este archivo sólo redirige y no importa `DetailScreen`, la
 * action legada ni las texturas de la escena para no arrastrar ese árbol al
 * bundle nativo.
 */
export default function Route() {
  return <Redirect href="/hoy/arco" />;
}
