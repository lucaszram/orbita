import { Redirect, Stack } from "expo-router";
import { useLayerStackScreenOptions } from "@/components/v492/stackOptions";

const IS_WEB = process.env.EXPO_OS === "web";

/**
 * Entrar por deep link a un detalle deja la pestaña con ese detalle solo en el
 * stack y sin "volver". Con el ancla, la raíz de la sección queda siempre debajo.
 */
export const unstable_settings = { anchor: "index" };

/**
 * Stack de la pestaña Hoy: la pantalla y sus tres detalles (arco, Luna,
 * Cumpleluna). Al abrir un detalle la barra de pestañas queda visible y
 * "volver" regresa a Hoy, no a otra sección.
 *
 * La web no tiene esta sección: su Home canónica vive en `/home`, así que la
 * ruta existe pero manda ahí. La experiencia web no cambia.
 */
export default function HoyLayout() {
  const screenOptions = useLayerStackScreenOptions();
  if (IS_WEB) return <Redirect href="/home" />;
  return <Stack screenOptions={screenOptions} />;
}
