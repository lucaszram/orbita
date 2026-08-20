import { Redirect } from "expo-router";

/**
 * Herramienta interna: sólo existe en la web y sólo con el interruptor puesto
 * (ver `backoffice.web.tsx`, que Metro resuelve únicamente ahí).
 *
 * En nativo la ruta no lleva a ningún lado: devuelve a Hoy y no importa la
 * herramienta, así que su árbol —mutations y acciones de operación incluidas—
 * nunca entra al bundle que se publica en la tienda.
 */
export default function Route() {
  return <Redirect href="/hoy" />;
}
