import { Redirect } from "expo-router";

/**
 * `/reading/diario` es una ruta exclusiva de la web: ahí se monta la pantalla
 * canónica `DiarioScreen` (ver `reading-diario.web.tsx`, que Metro resuelve solo
 * en web).
 *
 * En nativo esa lectura no existe: la sección equivalente es la pestaña Hoy, así
 * que este archivo solo redirige y no importa el Diario ni el tarot para no
 * arrastrar ese árbol al bundle nativo.
 */
export default function Route() {
  return <Redirect href="/hoy" />;
}
