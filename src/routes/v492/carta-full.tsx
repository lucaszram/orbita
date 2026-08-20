import { Redirect } from "expo-router";

/**
 * `/carta-full` es la rueda inmersiva legada, que sólo existe en web (ver
 * `carta-full.web.tsx`, que Metro resuelve únicamente ahí).
 *
 * En nativo V4.9.2 la rueda a pantalla completa vive en la Carta completa del
 * Perfil, sobre el sobre real. Este archivo sólo redirige y no importa
 * `NatalWheel`, `charts.current` ni la textura de fondo para no arrastrar ese
 * árbol al bundle nativo.
 */
export default function Route() {
  return <Redirect href="/perfil/carta/completa" />;
}
