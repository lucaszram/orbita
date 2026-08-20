import { Redirect } from "expo-router";

/**
 * `/diario` es una ruta exclusiva de la web: ahí vive el Diario canónico dentro
 * del `WebAppShell` (ver `diario.web.tsx`, que Metro resuelve solo en web).
 *
 * En nativo esa ruta no existe como pantalla: la sección equivalente es la
 * pestaña Hoy, así que este archivo solo redirige y no importa nada del ritual
 * diario (Diario, Home ni tarot) para no arrastrar ese árbol al bundle nativo.
 */
export default function Route() {
  return <Redirect href="/hoy" />;
}
