import { Slot, Stack } from "expo-router";
import { useLayerStackScreenOptions } from "@/components/v492/stackOptions";

const IS_WEB = process.env.EXPO_OS === "web";

/**
 * Entrar por deep link a un detalle deja la pestaña con ese detalle solo en el
 * stack y sin "volver". Con el ancla, la raíz de la sección queda siempre debajo.
 */
export const unstable_settings = { anchor: "index" };

/**
 * Stack de la pestaña Umbral.
 *
 * `/umbral` es la ruta canónica del Umbral y su ÚNICO dueño: antes la disputaban
 * `app/umbral.tsx` (raíz) y la pestaña `vacio` —los segmentos de grupo son
 * opcionales en la URL—, y cuál ganaba lo decidía el desempate interno del
 * router, no el producto; cada uno montaba además un chrome distinto. Ahora la
 * sección vive dentro del grupo de pestañas, con su propio stack: un detalle del
 * Umbral se abre acá adentro, la barra inferior queda visible y "volver" regresa
 * al Umbral. `/vacio` quedó como redirección.
 *
 * En web NO se monta un stack: `/umbral` se sigue sirviendo exactamente como
 * hasta ahora, dentro del shell web (que ya pone el layout del grupo), sin
 * chrome de navegación nativo en el medio. `Slot` renderiza la ruta hija tal
 * cual.
 */
export default function UmbralLayout() {
  const screenOptions = useLayerStackScreenOptions();
  if (IS_WEB) return <Slot />;
  return <Stack screenOptions={screenOptions} />;
}
