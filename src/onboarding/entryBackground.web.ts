import type { ImageSourcePropType } from "react-native";

/**
 * Fondo web de la pantalla de ENTRADA (paso 01 del alta) — candidato 3.
 *
 * Un derivado WebP por breakpoint, nunca el PNG de teléfono estirado en
 * escritorio: el horizontal (2560×1440) para la composición `scene` de
 * escritorio y el vertical (1170×2532) para móvil. Los dos dejan quieto el
 * centro del cuadro —donde vive el wordmark— y aguantan recortes anchos y
 * altos (el planeta con borde cobre queda abajo a la derecha en ambos).
 *
 * Masters intactos en `assets/orbita/web-entry/selected/`; los rechazados del
 * mismo lote, en `rejected/`. Ningún master viaja al navegador.
 */
const ENTRY_BG_DESKTOP = require("../../assets/orbita/optimized/web-entry/entry_bg_desktop.webp");
const ENTRY_BG_MOBILE = require("../../assets/orbita/optimized/web-entry/entry_bg_mobile.webp");

export function entryBackground(desktop: boolean): ImageSourcePropType {
  return desktop ? ENTRY_BG_DESKTOP : ENTRY_BG_MOBILE;
}
