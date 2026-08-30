import Svg, { Path } from "react-native-svg";

/**
 * Las marcas de Apple y de Google del acceso, dibujadas desde el vector OFICIAL.
 *
 * ## Por qué existe
 *
 * Los dos botones de proveedor traían la marca de `@expo/vector-icons`
 * (FontAwesome `apple` / `google`): una tipografía de íconos, no el logo del
 * proveedor. El de Google era peor que aproximado —FontAwesome dibuja una "G"
 * monocroma, y la marca de Google es de cuatro colores y no se puede recolorear—
 * y ninguno de los dos es un asset que Apple o Google publiquen. App Review mira
 * exactamente esto.
 *
 * ## De dónde salen estos datos
 *
 * `viewBox`, `d` y los `fill` están copiados VERBATIM de los archivos originales
 * que viven en `assets/orbita/auth/vendor/` (procedencia, URLs y hashes en el
 * README de ese directorio). No se redibujó ni se optimizó nada:
 *
 * - Apple: `Logo - SIWA - Left-aligned - Black - Large.svg` y
 *   `Logo - SIWA - Left-aligned - White - Large.svg`, del DMG oficial Apple
 *   Design Resources. Son DOS archivos, no uno recoloreado.
 * - Google: `g_dk_sq_sl.svg`, del bundle oficial de Google Identity.
 *
 * `test/authProviderBrandMarks.test.ts` compara estas constantes contra esos
 * archivos: si alguien toca un número, la regresión cae.
 *
 * ## Apple publica un archivo por tono, así que acá hay un tono obligatorio
 *
 * La guía de Apple no permite recolorear la manzana: publica el logo negro para
 * el botón blanco y el logo blanco para el botón negro, y hay que usar el que
 * corresponde. Por eso `AppleMark` EXIGE `tone` —no tiene default, y no acepta
 * ninguna prop de color— y cada tono toma el `fill` del `<path>` de SU archivo:
 * `black` → `#000000` del archivo Black, `white` → `#FFFFFF` del archivo White.
 * El `viewBox`, el path y el canvas de 39x44 son idénticos en los dos archivos y
 * quedan intactos: lo único que cambia entre tonos es ese `fill` oficial.
 *
 * ## Por qué la variante Large y no la Medium
 *
 * Apple publica el mismo dibujo en varias medidas dentro del DMG. La primera
 * pasada portó la **Medium** —canvas `0 0 31 44`, manzana visible de ~15.46 de
 * ancho— y en el simulador esa manzana se leía notoriamente más chica que la G
 * de Google, que mide 20 visibles: dos marcas de la misma fila, una más liviana
 * que la otra. La **Large** es el mismo vector oficial en la medida de al lado
 * —canvas `0 0 39 44`, manzana visible de ~19.53— y queda pareja con esos 20
 * dentro del mismo slot de 40x44. Lo que cambió es el ARCHIVO de origen, no el
 * dibujo: no se escaló, no se deformó y no se le agregó un offset óptico.
 *
 * ## Lo único que no se dibuja: el tile de cada archivo
 *
 * Los dos archivos vienen con su propio rectángulo de fondo —el `<rect>` de
 * Apple, opuesto al glifo; en Google el fondo `#131314` más el contorno
 * `#8E918F`, misma geometría y radio 3.5—. Ese rectángulo es el CHROME del botón
 * del proveedor, y el botón de Órbita ya existe: la pastilla de 54 pt con radio
 * 27 ya aporta fondo y contorno. Dibujar además el tile cuadrado de Google metía
 * un botón adentro del botón: un cuadrado oscuro con su propio contorno flotando
 * sobre la pastilla, desalineado con la manzana de al lado. Así que se omite en
 * las dos marcas: el archivo aporta la marca, el shell aporta la superficie.
 *
 * Omitir el tile NO recorta el vector. `viewBox` y tamaño siguen siendo los del
 * archivo (Apple `0 0 39 44` a 44 pt de alto; Google `0 0 40 40` a 40 pt), así
 * que la G queda dibujada donde Google la dibuja —el recuadro `10,10 → 30,30`, o
 * sea 20x20 visibles dentro del canvas de 40— y ese aire de 10 pt alrededor es
 * el espacio libre que exige la guía. Es también lo que la equilibra con la
 * manzana, que tiene su propio margen dentro del `0 0 39 44` de Apple. La
 * geometría y los colores del glifo quedan intactos en los dos casos.
 *
 * Los colores son los del proveedor y NO son tokens de Órbita: los dos tonos de
 * Apple son `#000000` y `#FFFFFF` (no `orbita.ink` ni `orbita.bone`) y la G es
 * de cuatro colores. Tintarlas sería violar las dos guías de marca.
 */

/** Los dos tonos que Apple publica. No hay un tercero, ni uno intermedio. */
export type AppleTone = "black" | "white";

/** Apple — un archivo por tono; `viewBox`, path y canvas son el mismo. */
export const APPLE_MARK = {
  viewBox: "0 0 39 44",
  /** Alto natural del archivo, en pt. El ancho sale de la proporción. */
  height: 44,
  width: 39,
  d: "M19.8196726,13.1384615 C20.902953,13.1384615 22.2608678,12.406103 23.0695137,11.4296249 C23.8018722,10.5446917 24.3358837,9.30883662 24.3358837,8.07298156 C24.3358837,7.9051494 24.3206262,7.73731723 24.2901113,7.6 C23.0847711,7.64577241 21.6353115,8.4086459 20.7656357,9.43089638 C20.0790496,10.2090273 19.4534933,11.4296249 19.4534933,12.6807374 C19.4534933,12.8638271 19.4840083,13.0469167 19.4992657,13.1079466 C19.5755531,13.1232041 19.6976128,13.1384615 19.8196726,13.1384615 Z M16.0053051,31.6 C17.4852797,31.6 18.1413509,30.6082645 19.9875048,30.6082645 C21.8641736,30.6082645 22.2761252,31.5694851 23.923932,31.5694851 C25.5412238,31.5694851 26.6245041,30.074253 27.6467546,28.6095359 C28.7910648,26.9312142 29.2640464,25.2834075 29.2945613,25.2071202 C29.1877591,25.1766052 26.0904927,23.9102352 26.0904927,20.3552448 C26.0904927,17.2732359 28.5316879,15.8848061 28.6690051,15.7780038 C27.0517133,13.4588684 24.5952606,13.3978385 23.923932,13.3978385 C22.1082931,13.3978385 20.6283185,14.4963764 19.6976128,14.4963764 C18.6906198,14.4963764 17.36322,13.4588684 15.7917006,13.4588684 C12.8012365,13.4588684 9.765,15.9305785 9.765,20.5993643 C9.765,23.4982835 10.8940528,26.565035 12.2824825,28.548506 C13.4725652,30.2268277 14.5100731,31.6 16.0053051,31.6 Z",
  /** Un `fill` por tono: el del `<path>` de SU archivo oficial, sin retoque. */
  fill: {
    black: "#000000",
    white: "#FFFFFF"
  }
} as const;

/**
 * Google — los cuatro trazos de la G con los hexadecimales de Google. El tile
 * cuadrado del archivo (fondo `#131314` + contorno `#8E918F`) no se porta: lo
 * aporta el shell del botón.
 */
export const GOOGLE_MARK = {
  viewBox: "0 0 40 40",
  /** Alto y ancho naturales del archivo, en pt: es cuadrado. */
  size: 40,
  paths: [
    {
      d: "M29.6 20.2273C29.6 19.5182 29.5364 18.8364 29.4182 18.1818H20V22.05H25.3818C25.15 23.3 24.4455 24.3591 23.3864 25.0682V27.5773H26.6182C28.5091 25.8364 29.6 23.2727 29.6 20.2273Z",
      fill: "#4285F4"
    },
    {
      d: "M20 30C22.7 30 24.9636 29.1045 26.6181 27.5773L23.3863 25.0682C22.4909 25.6682 21.3454 26.0227 20 26.0227C17.3954 26.0227 15.1909 24.2636 14.4045 21.9H11.0636V24.4909C12.7091 27.7591 16.0909 30 20 30Z",
      fill: "#34A853"
    },
    {
      d: "M14.4045 21.9C14.2045 21.3 14.0909 20.6591 14.0909 20C14.0909 19.3409 14.2045 18.7 14.4045 18.1V15.5091H11.0636C10.3864 16.8591 10 18.3864 10 20C10 21.6136 10.3864 23.1409 11.0636 24.4909L14.4045 21.9Z",
      fill: "#FBBC04"
    },
    {
      d: "M20 13.9773C21.4681 13.9773 22.7863 14.4818 23.8227 15.4727L26.6909 12.6045C24.9591 10.9909 22.6954 10 20 10C16.0909 10 12.7091 12.2409 11.0636 15.5091L14.4045 18.1C15.1909 15.7364 17.3954 13.9773 20 13.9773Z",
      fill: "#E94235"
    }
  ]
} as const;

/**
 * Marca de Apple. `tone` es OBLIGATORIO y elige el archivo oficial: `black` para
 * una superficie clara, `white` para una oscura. No hay default —un default
 * sería recolorear por descuido— ni ninguna prop de color: el `fill` sale
 * siempre del archivo.
 *
 * `height` es el alto del CUADRO del vector en pt (default: el natural del
 * archivo); el ancho sale de la proporción del `viewBox`, así que el glifo nunca
 * se deforma.
 */
export function AppleMark({ tone, height = APPLE_MARK.height }: { tone: AppleTone; height?: number }) {
  return (
    <Svg
      width={(height * APPLE_MARK.width) / APPLE_MARK.height}
      height={height}
      viewBox={APPLE_MARK.viewBox}
    >
      <Path d={APPLE_MARK.d} fill={APPLE_MARK.fill[tone]} fillRule="nonzero" />
    </Svg>
  );
}

/**
 * Marca de Google: SOLO los cuatro trazos de la G, en el orden del archivo. El
 * tile cuadrado —fondo `#131314` y contorno `#8E918F`— se omite a propósito
 * porque el shell del botón ya aporta fondo y contorno; ver el bloque de arriba.
 *
 * `size` es el lado del CUADRO del vector en pt (default: el natural del
 * archivo). No se recorta el `viewBox`, así que con el default la G ocupa 20x20
 * centrados en un canvas de 40 y queda a la par de la manzana. Los cuatro
 * colores son los de Google y no se tintan.
 */
export function GoogleMark({ size = GOOGLE_MARK.size }: { size?: number } = {}) {
  return (
    <Svg width={size} height={size} viewBox={GOOGLE_MARK.viewBox}>
      {GOOGLE_MARK.paths.map((trazo) => (
        <Path key={trazo.fill} d={trazo.d} fill={trazo.fill} />
      ))}
    </Svg>
  );
}
