import { Redirect } from "expo-router";

/**
 * `/transito` es la ruta histórica de Tránsitos dentro del shell web (ver
 * `transito.web.tsx`, que Metro resuelve únicamente ahí).
 *
 * En nativo V4.9.2 Tránsitos es una pestaña propia con su stack, así que este
 * archivo sólo redirige y no importa `TransitosScreen` ni el shell web para no
 * arrastrar ese árbol al bundle nativo.
 */
export default function Route() {
  return <Redirect href="/transitos" />;
}
