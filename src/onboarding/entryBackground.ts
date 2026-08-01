import type { ImageSourcePropType } from "react-native";

import { A } from "./assets";

/**
 * Fondo de la pantalla de ENTRADA (paso 01 del alta).
 *
 * En nativo es el asset Figma de siempre (V4.4): esta variante existe para que
 * el bundle nativo no cargue los fondos web. La web resuelve
 * `entryBackground.web.ts` (extensión de plataforma de Metro), que trae los
 * derivados responsive de escritorio y móvil del candidato 3 aprobado.
 */
export function entryBackground(_desktop: boolean): ImageSourcePropType {
  return A.splashBg;
}
