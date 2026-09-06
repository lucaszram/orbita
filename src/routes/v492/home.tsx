import { Redirect } from "expo-router";

/**
 * `/home` es una ruta exclusiva de la web: ahí vive la Home canónica dentro del
 * `WebAppShell` (ver `home.web.tsx`, que Metro resuelve solo en web).
 *
 * En nativo esa ruta no existe como pantalla: la sección equivalente es la
 * pestaña Hoy, así que este archivo solo redirige y no importa nada del ritual
 * diario (Home, Carta del día, Diario ni tarot) para no arrastrar ese árbol al
 * bundle nativo.
 */
export default function Route() {
  return <Redirect href="/hoy" />;
}
