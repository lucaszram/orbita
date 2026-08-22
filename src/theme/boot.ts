import { orbita } from "@/theme/orbita";

/**
 * Arranque visual: el color y el movimiento de todo lo que se dibuja ANTES de
 * que haya producto (QA23-006).
 *
 * ## El defecto medido en el build 23
 *
 * Abrir la app mostraba, en orden, tres cosas que no son Órbita: el splash
 * blanco del template nativo, uno o más **frames claros** —los gates de arranque
 * pintaban `theme.colors.background`, que es el crema `#fff8f0` del MVP legado,
 * no el `#0A0B0E` del producto— y un **deslizamiento lateral** al resolverse el
 * primer destino, porque un `<Redirect>` es un `replace` y el stack nativo lo
 * anima como un `pop` (entra desde la izquierda). Nada de eso es una transición
 * entre pantallas: es la app decidiendo a dónde va, y decidir no se anima.
 *
 * ## La regla
 *
 * **El arranque tiene UN color y CERO movimiento.** Un color, porque cualquier
 * costura entre el splash, el fondo del root view, el fondo de un `Stack` y el
 * de un gate se ve como un parpadeo; y es exactamente el mismo `#0A0B0E` que
 * usa el shell (`v492.colors.background`), así que entrar al producto no cambia
 * un solo punto de la pantalla. Cero movimiento, porque los redirects de gate no
 * son navegación: reemplazan la superficie en el lugar y quien mira no eligió
 * ir a ningún lado.
 *
 * Lo que estos tokens **no** tocan: la navegación normal posterior. Los stacks
 * de pestaña siguen deslizando (`@/components/v492/stackOptions`, con su propio
 * respeto por «Reducir movimiento»), y las rutas que se abren desde el producto
 * —el pago, las lecturas, la carta completa— conservan su animación.
 *
 * Los colores salen del tema de Órbita, no de valores nuevos: el arranque no es
 * una superficie aparte con paleta propia, es la misma app antes de tener datos.
 */

/** Fondo único del arranque: splash, root view, `Stack` y todo gate. */
export const BOOT_BACKGROUND = orbita.colors.background;

/** Titulares de un gate (reintento, timeout, bloqueo). 17:1 sobre el fondo. */
export const BOOT_TEXT = orbita.colors.bone;

/** Cuerpo de un gate. 8,9:1 sobre el fondo. */
export const BOOT_TEXT_MUTED = orbita.colors.muted;

/**
 * Indicadores y acciones de un gate. 8,1:1 sobre el fondo.
 *
 * Es cobre SUAVE y no el cobre de marca por la misma razón que el enlace de
 * "Ya tengo cuenta" (`@/onboarding/theme`): sobre el negro de Órbita el cobre
 * pleno pasa el mínimo justo, y acá lo que se pinta es un spinner de dos puntos
 * de grosor y el borde de un botón de reintento.
 */
export const BOOT_ACCENT = orbita.colors.copperSoft;

/**
 * Barra de estado del arranque.
 *
 * El layout raíz declaraba `dark` —glifos oscuros—, que era coherente mientras
 * los gates eran crema. Sobre `#0A0B0E` la hora y la señal quedaban en negro
 * sobre negro hasta que el shell montaba y corregía el estilo por su cuenta.
 */
export const BOOT_STATUS_BAR_STYLE = "light" as const;

/** Un redirect de gate reemplaza en el lugar: no desliza. */
export const BOOT_SCREEN_ANIMATION = "none" as const;

/**
 * Opciones de las pantallas del arranque en el `Stack` raíz.
 *
 * `contentStyle` va además en `screenOptions` del `Stack` entero: sin él, el
 * fondo de cada tarjeta lo pone el tema por defecto de React Navigation, que es
 * CLARO, y ese es el frame que aparecía en los huecos entre gates.
 */
export const BOOT_SCREEN_OPTIONS = {
  animation: BOOT_SCREEN_ANIMATION,
  contentStyle: { backgroundColor: BOOT_BACKGROUND }
};

/**
 * Las rutas raíz que participan del arranque, y las únicas que no se animan.
 *
 * Son los cuatro extremos de las decisiones de `resolveStart` / `resolveTabsGuard`
 * / `accountDestination`: la propia raíz que decide (`index`), el alta
 * (`onboarding`), el login (`iniciar-sesion`) y el producto (`(tabs)`). Todo lo
 * demás del `Stack` raíz se abre DESDE el producto y conserva su animación.
 */
export const BOOT_GATE_ROUTES = ["index", "onboarding", "iniciar-sesion", "(tabs)"] as const;
