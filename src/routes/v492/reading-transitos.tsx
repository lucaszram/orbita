import { Redirect } from "expo-router";

/**
 * `/reading/transitos` es la lectura por área legada, que sólo existe en web
 * (ver `reading-transitos.web.tsx`, que Metro resuelve únicamente ahí).
 *
 * En nativo V4.9.2 la reemplaza la lista real de tránsitos, que sale del sobre
 * de capas en la pestaña Tránsitos. Este archivo sólo redirige y no importa
 * `DetailScreen` ni la action legada para no arrastrar ese árbol al bundle
 * nativo.
 */
export default function Route() {
  return <Redirect href="/transitos" />;
}
