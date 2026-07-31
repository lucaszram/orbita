/**
 * Contrato de layout responsive de Órbita — interno, uno solo, del shell web.
 *
 * El problema que resuelve: cada pantalla decidía por su cuenta si era "ancha"
 * (`useWindowDimensions()` + `width < 900`), o directamente no lo decidía y
 * quedaba con la composición de teléfono centrada en un monitor. Al consolidar
 * las pantallas canónicas eso se volvió visible: la web de escritorio pasó a ser
 * una columna de 720 en el medio de 1920, con la navegación transparente sobre
 * el fondo blanco del documento.
 *
 * Acá viven las DOS decisiones y nada más:
 *
 * 1. `mode` (`mobile` | `desktop`), a partir de un único breakpoint. Lo calcula
 *    el shell web una sola vez leyendo el viewport, y lo reparte por contexto
 *    (`hooks/useLayoutMode`). Ninguna pantalla vuelve a mirar la ventana: el
 *    tamaño de la rueda, del radar y de los heros sigue saliendo del CONTENEDOR
 *    medido (`MeasuredSquare`), no del viewport.
 * 2. `variant` del lienzo (`wide` | `reading` | `immersive`), que es una
 *    propiedad de la PANTALLA, no del dispositivo: la Carta quiere lienzo ancho
 *    para poner rueda e interpretación en dos columnas, el Perfil quiere una
 *    columna de lectura, y la rueda a pantalla completa no quiere ningún tope.
 *    El alta no usa el lienzo: compone su propio escenario cinematográfico
 *    (`src/onboarding/components/Screen.tsx`).
 *
 * En un teléfono ninguno de los topes llega a aplicar (siempre son mayores que
 * el ancho de pantalla) y `mode` es `mobile`, que es el valor por defecto del
 * contexto: **el nativo no cambia**.
 */

/** Único breakpoint del producto: debajo de esto no entra una composición de dos columnas. */
export const WEB_LAYOUT_BREAKPOINT = 900;

export type LayoutMode = "mobile" | "desktop";

/**
 * `wide` — lienzo de composición (Home, Tránsitos, Carta, Valores, Diario).
 * `reading` — columna de lectura (Perfil, detalles de texto largo).
 * `immersive` — sin tope: la superficie ES la pieza (el Umbral, la rueda a
 *   pantalla completa). Un lienzo inmersivo no deja el texto suelto: adentro se
 *   acota lo que se lee con `ReadingBlock` (720), y lo que no es texto —chrome,
 *   fondos, la propia pieza— ocupa la superficie entera.
 */
export type CanvasVariant = "wide" | "reading" | "immersive";

/** Topes fijos, en píxeles. Nada de porcentajes del viewport: el cuerpo de texto
 *  de Órbita mide lo mismo en un teléfono que en un monitor de 27".
 *
 *  Debajo de su tope cada variante es ancho completo, así que en un teléfono
 *  ninguna cambia nada: el breakpoint es implícito y el móvil queda idéntico. */
export const CANVAS_MAX_WIDTH: Record<CanvasVariant, number | null> = {
  wide: 1200,
  reading: 720,
  immersive: null
};

/** Alto de la barra inferior fija de la web angosta (+ respiro). */
export const WEB_BOTTOM_NAV_HEIGHT = 64;

/** Fondo del documento, del shell y de toda área reservada. Un solo negro. */
export const WEB_SHELL_BACKGROUND = "#07080A";

/** Modo a partir del ancho del viewport. Sin medida todavía → `mobile` (nunca se
 *  monta una composición de escritorio "por las dudas"). */
export function layoutModeFor(width: number | null | undefined): LayoutMode {
  if (typeof width !== "number" || !Number.isFinite(width)) return "mobile";
  return width >= WEB_LAYOUT_BREAKPOINT ? "desktop" : "mobile";
}

/** Tope del lienzo para una variante. `null` = ancho completo. */
export function canvasMaxWidth(variant: CanvasVariant): number | null {
  return CANVAS_MAX_WIDTH[variant];
}

/**
 * ¿Las columnas se ponen una al lado de la otra? Sólo en escritorio. En móvil
 * apilan en el MISMO orden en que están escritas, así que la estructura de la
 * pantalla de teléfono no cambia por agregar la composición de escritorio.
 */
export function splitsColumns(mode: LayoutMode): boolean {
  return mode === "desktop";
}

/**
 * ¿El header interno de la pantalla (ÓRBITA · HOY ˅) tiene que dibujarse?
 *
 * En escritorio no: la navegación web ya pone la marca y la sección, y tener las
 * dos era una barra de marca debajo de otra barra de marca. En móvil web y en
 * nativo sí — ahí el header interno es el único chrome superior.
 */
export function showsScreenHeader(input: { web: boolean; mode: LayoutMode }): boolean {
  return !(input.web && input.mode === "desktop");
}

/**
 * ¿Cambiar de destino tiene que arrancar arriba de todo?
 *
 * En la web sí, y es lo que espera cualquiera: hacés click en "Tránsitos" y la
 * página empieza por el principio. En este stack no pasaba solo — las pantallas
 * scrollean adentro de un `ScrollView` y el navegador no las conoce, así que al
 * volver a un destino ya visitado reaparecía a media altura, con el contenido
 * cortado debajo del header.
 *
 * Sólo escritorio: en móvil web y en nativo la navegación es la barra inferior
 * y el comportamiento de las pestañas —conservar dónde estabas— es el correcto
 * y el que ya tiene el nativo. No se toca.
 */
export function resetsScrollOnRoute(input: { web: boolean; mode: LayoutMode }): boolean {
  return input.web && input.mode === "desktop";
}

/**
 * ¿Hay que reservar espacio para la barra inferior fija?
 *
 * Sólo en la web angosta (la barra es `position: fixed`). El espacio se reserva
 * como PADDING del contenido, no como un `View` suelto al final: un View sin
 * fondo dejaba una banda blanca del documento encima de la barra.
 */
export function reservesBottomNav(input: { web: boolean; mode: LayoutMode }): boolean {
  return input.web && input.mode === "mobile";
}
