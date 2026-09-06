import { Redirect } from "expo-router";

/**
 * Las páginas legales públicas se publican en la WEB (ver `support.web.tsx`,
 * que Metro resuelve únicamente ahí): son las URLs que pide App Store Connect.
 *
 * En nativo el Perfil ya las abre en el navegador, así que esta ruta sólo
 * redirige ahí y no importa `orbita-legal` — un documento web entero, con su
 * tipografía y su navegación, que no tiene por qué viajar en el bundle nativo.
 */
export default function Route() {
  return <Redirect href="/perfil/ajustes" />;
}
