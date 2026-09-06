import { Slot, Stack } from "expo-router";
import { useLayerStackScreenOptions } from "@/components/v492/stackOptions";

const IS_WEB = process.env.EXPO_OS === "web";

/**
 * Entrar por deep link a un detalle deja la pestaña con ese detalle solo en el
 * stack y sin "volver". Con el ancla, la raíz de la sección queda siempre debajo.
 */
export const unstable_settings = { anchor: "index" };

/**
 * Stack de la pestaña Perfil: los datos de la cuenta y, dentro, la carta natal.
 *
 * En web `/perfil` se sigue sirviendo tal cual dentro del shell (sin stack
 * nativo en el medio) y `/carta` sigue siendo su propia ruta.
 */
export default function PerfilLayout() {
  const screenOptions = useLayerStackScreenOptions();
  if (IS_WEB) return <Slot />;
  return <Stack screenOptions={screenOptions} />;
}
