import { Redirect } from "expo-router";

/**
 * `/reading/rueda` es la rueda natal legada, que sólo existe en web (ver
 * `reading-rueda.web.tsx`, que Metro resuelve únicamente ahí).
 *
 * En nativo V4.9.2 la rueda vive en la Carta completa dentro del Perfil, sobre
 * el sobre real. Este archivo sólo redirige y no importa `NatalWheel`,
 * `charts.current` ni `mapNatalChart` para no arrastrar el contrato legado al
 * bundle nativo.
 */
export default function Route() {
  return <Redirect href="/perfil/carta/completa" />;
}
