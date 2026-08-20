import { Redirect } from "expo-router";

/**
 * `/reading/luna` es la fase lunar genérica del ritual diario, que sólo existe
 * en web (ver `reading-luna.web.tsx`, que Metro resuelve únicamente ahí).
 *
 * En nativo V4.9.2 la fase lunar se lee sobre TU carta —casa y tema— en
 * `/hoy/luna`. Este archivo sólo redirige y no importa `DetailScreen` ni la
 * action del proveedor para no arrastrar ese árbol al bundle nativo.
 */
export default function Route() {
  return <Redirect href="/hoy/luna" />;
}
