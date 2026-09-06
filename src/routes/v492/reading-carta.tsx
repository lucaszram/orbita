import { Redirect } from "expo-router";

/**
 * `/reading/carta` es la tabla de posiciones legada, que sólo existe en web
 * (ver `reading-carta.web.tsx`, que Metro resuelve únicamente ahí).
 *
 * En nativo V4.9.2 esa tabla la reemplaza la Carta completa dentro del Perfil,
 * con posiciones, casas y aspectos del sobre real. Este archivo sólo redirige y
 * no importa `charts.current` ni `mapNatalChart` para no arrastrar el contrato
 * legado al bundle nativo.
 */
export default function Route() {
  return <Redirect href="/perfil/carta/completa" />;
}
