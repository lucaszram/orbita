import { Redirect } from "expo-router";

/**
 * `/reading/valores` monta la `ValoresScreen` canónica, que sólo existe en web
 * (ver `reading-valores.web.tsx`, que Metro resuelve únicamente ahí).
 *
 * En nativo V4.9.2 el mapa de valores es el mapa elemental de la Carta, dentro
 * del Perfil. Este archivo sólo redirige y no importa `ValoresScreen` para no
 * arrastrar esa pantalla al bundle nativo.
 */
export default function Route() {
  return <Redirect href="/perfil/carta/mapa-elemental" />;
}
