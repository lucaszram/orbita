import { Slot, Stack } from "expo-router";
import { useLayerStackScreenOptions } from "@/components/v492/stackOptions";

const IS_WEB = process.env.EXPO_OS === "web";

/**
 * Entrar por deep link a un detalle deja la pestaña con ese detalle solo en el
 * stack y sin "volver". Con el ancla, la raíz de la sección queda siempre debajo.
 */
export const unstable_settings = { anchor: "index" };

/**
 * Stack de la pestaña Tránsitos: sus dos vistas (`Ahora` y `Tu momento`) y el
 * detalle de cada tránsito.
 *
 * `Ahora` y `Tu momento` son la MISMA pantalla en dos rutas, no un detalle
 * colgando de la otra: el selector cambia de ruta con `replace`, así que no se
 * apilan y "volver" no recorre el historial del selector. Por eso van sin
 * animación: un deslizamiento lateral leería como si se abriera otra pantalla.
 * El detalle (`arco/[arcId]`) sí conserva la animación del stack.
 *
 * En web NO se monta un stack: `/transitos` se sigue sirviendo exactamente como
 * hasta ahora, dentro del shell web, sin chrome de navegación nativo en el
 * medio. `Slot` renderiza la ruta hija tal cual.
 */
export default function TransitosLayout() {
  const screenOptions = useLayerStackScreenOptions();
  if (IS_WEB) return <Slot />;
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ animation: "none" }} />
      <Stack.Screen name="momento" options={{ animation: "none" }} />
    </Stack>
  );
}
