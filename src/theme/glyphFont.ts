import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

/**
 * La tipografía de símbolos que Órbita YA tiene empaquetada.
 *
 * `@expo/vector-icons` (dependencia directa, `15.1.1`) trae
 * `MaterialCommunityIcons.ttf` con los doce glifos del zodíaco
 * (`zodiac-aries`…`zodiac-pisces`) y su `LICENSE` en el paquete. No hace falta
 * descargar nada ni agregar una dependencia: el asset viaja con el bundle.
 *
 * La familia y el asset se leen de la API pública del paquete —no se escriben a
 * mano— así que si el paquete renombra la familia, esto la sigue.
 */

/** Nombre de familia que `@expo/vector-icons` registra (`"material-community"`). */
export const GLYPH_FONT_FAMILY: string = MaterialCommunityIcons.getFontFamily();

/** Mapa `{ familia: asset }` listo para `useFonts` (ver `hooks/useOrbitaFonts`). */
export const GLYPH_FONT: Record<string, number | string> = MaterialCommunityIcons.font;
