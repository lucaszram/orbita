import type { ReactNode } from "react";
import { useWindowDimensions } from "react-native";

import { layoutModeFor } from "@/domain/webLayout";
import { LayoutModeProvider } from "@/hooks/useLayoutMode";

const IS_WEB = process.env.EXPO_OS === "web";

/**
 * El ÚNICO lugar del producto que lee el viewport.
 *
 * De acá sale el modo (`mobile` | `desktop`) que consumen las pantallas por
 * contexto: ni el alta ni la app vuelven a preguntar cuánto mide la ventana, y
 * los tamaños de rueda, radar y heros siguen saliendo del contenedor medido.
 *
 * Lo montan el shell de la app autenticada y el alta, que son los dos árboles
 * con composición propia de escritorio.
 *
 * En nativo el modo es SIEMPRE `mobile`: no hay escritorio, y una tablet no
 * debe heredar la composición de la web.
 */
export function WebLayoutProvider({ width, children }: { width?: number; children: ReactNode }) {
  const win = useWindowDimensions();
  // `width` sólo lo pasa la vista combinada de revisión, que monta el alta
  // dentro de marcos de un tamaño fijo: sin esto un marco de 400px adentro de
  // una ventana de 1440 rendería la composición de ESCRITORIO y la revisión
  // mentiría. Fuera de esa vista siempre manda el viewport real.
  const effective = width ?? win.width;
  return <LayoutModeProvider mode={IS_WEB ? layoutModeFor(effective) : "mobile"}>{children}</LayoutModeProvider>;
}
