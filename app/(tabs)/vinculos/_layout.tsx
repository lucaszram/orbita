import { Redirect, Stack } from "expo-router";
import { useLayerStackScreenOptions } from "@/components/v492/stackOptions";

const IS_WEB = process.env.EXPO_OS === "web";

/**
 * Entrar por deep link a un detalle deja la pestaña con ese detalle solo en el
 * stack y sin "volver". Con el ancla, la raíz de la sección queda siempre debajo.
 */
export const unstable_settings = { anchor: "index" };

/**
 * Stack de la pestaña Vínculos.
 *
 * Cuatro pantallas: la raíz con tu patrón relacional y tus personas guardadas,
 * el alta o edición de una persona (`conectar`), el perfil canónico de cada una
 * (`[profileId]`) y su comparación, que cuelga del perfil
 * (`[profileId]/comparacion`, QA23-005). El segmento estático gana contra el
 * dinámico, así que "conectar" nunca se lee como el id de una persona.
 *
 * En web la ruta histórica sigue siendo `/vinculo`, y ahí se queda.
 */
export default function VinculosLayout() {
  const screenOptions = useLayerStackScreenOptions();
  if (IS_WEB) return <Redirect href="/vinculo" />;
  return <Stack screenOptions={screenOptions} />;
}
