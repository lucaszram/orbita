import { Redirect } from "expo-router";

/**
 * `/valores` es el mapa de valores dentro del shell web (ver `valores.web.tsx`,
 * que Metro resuelve únicamente ahí).
 *
 * En nativo V4.9.2 el equivalente es el mapa elemental de la Carta, dentro del
 * Perfil. Este archivo sólo redirige y no importa `ValoresScreen` ni el shell
 * web para no arrastrar ese árbol al bundle nativo.
 */
export default function Route() {
  return <Redirect href="/perfil/carta/mapa-elemental" />;
}
