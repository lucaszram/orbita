/**
 * Símbolos astrológicos SIN emoji y sin depender del font del sistema.
 *
 * El bug: la rueda y la tabla usaban los caracteres Unicode de signos y planetas
 * (`♈`–`♓` U+2648–U+2653, `☉ ☽ ☿ ♀ ♂ ♃ ♄ ♅ ♆ ♇ ☊ ⚷ ⊕`, `℞`). Ninguna de las
 * familias de TEXTO que Órbita empaqueta —Newsreader, Inter, Roboto Mono— tiene
 * esos glifos, así que el render caía al font del sistema: en la web y en
 * Android eso es la fuente de EMOJI, que los dibuja a color, con caja cuadrada y
 * ancho doble, ignorando el `fill` cobre. El selector U+FE0E que había pide
 * presentación de texto, pero es exactamente eso: un pedido.
 *
 * ## Signos: glifos reales, de una tipografía ya empaquetada
 *
 * `@expo/vector-icons` es dependencia directa del proyecto (`15.1.1`, ya se usa
 * para `Ionicons`) y su `MaterialCommunityIcons.ttf` trae los DOCE glifos del
 * zodíaco: `zodiac-aries` … `zodiac-pisces`. Es un asset que ya viaja en el
 * bundle, con su `LICENSE` en el paquete: no hay que descargar nada ni agregar
 * una dependencia. Los doce signos se dibujan con esos glifos, iguales en web,
 * iOS y Android, monocromos y respetando el `fill`.
 *
 * El codepoint sale del glyph map REAL del paquete (el mismo objeto que devuelve
 * `MaterialCommunityIcons.getRawGlyphMap()`), no de una tabla copiada a mano; la
 * familia sale de `MaterialCommunityIcons.getFontFamily()` en
 * `theme/glyphFont`. El font se carga en `hooks/useOrbitaFonts`, que es lo que
 * ya gatea el render de todas las pantallas.
 *
 * ## Planetas: limitación precisa
 *
 * Ninguna tipografía empaquetada cubre los planetas. Concretamente, en los 17
 * glyph maps que trae `@expo/vector-icons`:
 *
 * - MaterialCommunityIcons: 12/12 signos, **cero** glifos planetarios.
 * - FontAwesome 4/5/6 y Fontisto: sólo `mercury`, `venus` y `mars` (esos sí son
 *   los glifos astrológicos ☿ ♀ ♂), más un `sun`/`moon` PICTÓRICO (sol con
 *   rayos, luna creciente), que no es ☉ ni ☽.
 * - No existe en ningún set `jupiter`, `saturn`, `uranus`, `neptune`, `pluto`,
 *   `chiron`, `node` ni `part_of_fortune`.
 *
 * O sea: 3 de los 10 planetas clásicos, en OTRA familia y con otro peso de
 * trazo. Cambiar sólo esos tres pondría dos vocabularios de símbolos y dos
 * tipografías de iconos en la misma rueda de trece puntos. Por eso **todos** los
 * puntos planetarios siguen siendo códigos de dos letras en la mono empaquetada
 * —el patrón que ya usaban los numerales romanos de las casas—: deterministas,
 * monocromos e idénticos en las tres plataformas.
 *
 * **Limitación aceptada:** los planetas son abreviaturas, no glifos. Recuperar
 * ☉ ☽ ☿ ♀ ♂ ♃ ♄ ♅ ♆ ♇ exige empaquetar una tipografía astrológica con licencia
 * o dibujarlos como paths SVG, y eso es traer un asset nuevo: queda como
 * decisión de diseño aparte. Los signos ya NO tienen esta limitación.
 */
import GLYPH_MAP from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json";

/** Codepoints del glyph map empaquetado, por nombre de icono. */
const BUNDLED_GLYPHS = GLYPH_MAP as unknown as Record<string, number>;

/**
 * Nombre del glifo de MaterialCommunityIcons por índice de longitud eclíptica
 * (0 = Aries). Son los nombres que el paquete expone en su glyph map.
 */
export const SIGN_GLYPH_NAMES = [
  "zodiac-aries",
  "zodiac-taurus",
  "zodiac-gemini",
  "zodiac-cancer",
  "zodiac-leo",
  "zodiac-virgo",
  "zodiac-libra",
  "zodiac-scorpio",
  "zodiac-sagittarius",
  "zodiac-capricorn",
  "zodiac-aquarius",
  "zodiac-pisces"
] as const;

/** Índice normalizado (nunca rompe con un índice fuera de rango). */
const wrap12 = (index: number) => ((Math.trunc(index) % 12) + 12) % 12;

/** Nombre del glifo del signo por índice. */
export function signGlyphName(index: number): string {
  return SIGN_GLYPH_NAMES[wrap12(index)];
}

/**
 * Codepoint del signo en el font empaquetado, o `null` si el paquete dejara de
 * traerlo (deriva de versión). Nunca se inventa un reemplazo.
 */
export function signGlyphCodepoint(index: number): number | null {
  const cp = BUNDLED_GLYPHS[signGlyphName(index)];
  return typeof cp === "number" && Number.isFinite(cp) ? cp : null;
}

/**
 * Carácter del signo, listo para dibujar con `GLYPH_FONT_FAMILY`. `null` si el
 * glifo no está en el font: en ese caso la banda de signos NO se rotula, en vez
 * de caer a una abreviatura o a un cuadrado del font de emoji.
 */
export function signGlyph(index: number): string | null {
  const cp = signGlyphCodepoint(index);
  return cp === null ? null : String.fromCodePoint(cp);
}

/** ¿El font empaquetado cubre los doce signos? (con `15.1.1`: sí). */
export const SIGN_GLYPHS_COMPLETE: boolean = SIGN_GLYPH_NAMES.every(
  (_, index) => signGlyphCodepoint(index) !== null
);

/** Nombre del signo (es/en, con o sin acento) → índice eclíptico. `null` si no se reconoce. */
export function signIndexForName(name: string | undefined | null): number | null {
  if (!name) return null;
  const k = deacento(name);
  const hit = SIGN_NAMES.findIndex(([re]) => re.test(k));
  return hit === -1 ? null : SIGN_NAMES[hit][1];
}

/** Carácter del signo a partir de su nombre. `null` si no se reconoce el nombre. */
export function signGlyphForName(name: string | undefined | null): string | null {
  const index = signIndexForName(name);
  return index === null ? null : signGlyph(index);
}

const SIGN_NAMES: Array<[RegExp, number]> = [
  [/^aries/, 0],
  [/^tauro|^taurus/, 1],
  [/^geminis|^gemini/, 2],
  [/^cancer/, 3],
  [/^leo/, 4],
  [/^virgo/, 5],
  [/^libra/, 6],
  [/^escorpio|^scorpio/, 7],
  [/^sagitario|^sagittarius/, 8],
  [/^capricornio|^capricorn/, 9],
  [/^acuario|^aquarius/, 10],
  [/^piscis|^pisces/, 11]
];

/**
 * Códigos de cuerpo/punto por `key` del payload de `charts.current`. Dos letras
 * en la mono empaquetada: ver la limitación documentada arriba.
 * `AC`/`MC` son EJES (no puntos): la rueda no los dibuja como planeta, pero la
 * tabla y la tríada sí los nombran.
 */
export const BODY_CODES: Record<string, string> = {
  sun: "SO",
  moon: "LU",
  mercury: "ME",
  venus: "VE",
  mars: "MA",
  jupiter: "JU",
  saturn: "SA",
  uranus: "UR",
  neptune: "NE",
  pluto: "PL",
  node: "NO",
  chiron: "QU",
  part_of_fortune: "FO",
  ascendant: "AC",
  midheaven: "MC"
};

/** ¿Es un punto que la rueda dibuja por longitud eclíptica? (los ejes no). */
export function isWheelBody(key: string | undefined): boolean {
  if (!key) return false;
  return key in BODY_CODES && key !== "ascendant" && key !== "midheaven";
}

/** Marca de retrogradación. Reemplaza `℞` (U+211E), que tampoco está en las familias. */
export const RETROGRADE_CODE = "Rx";

const BODY_NAMES: Array<[RegExp, string]> = [
  [/\bsol\b/, "SO"],
  [/\bluna\b/, "LU"],
  [/\bascendente\b/, "AC"],
  [/\bmedio ?cielo\b/, "MC"],
  [/\bmercurio\b/, "ME"],
  [/\bvenus\b/, "VE"],
  [/\bmarte\b/, "MA"],
  [/\bjupiter\b/, "JU"],
  [/\bsaturno\b/, "SA"],
  [/\burano\b/, "UR"],
  [/\bneptuno\b/, "NE"],
  [/\bpluton\b/, "PL"],
  [/\bnodo\b/, "NO"],
  [/\bquiron\b/, "QU"]
];

/** Código por `key` del payload, con el nombre visible como respaldo. */
export function bodyCode(input: { key?: string; label?: string }): string {
  if (input.key && BODY_CODES[input.key]) return BODY_CODES[input.key];
  return bodyCodeForName(input.label ?? "") ?? "SO";
}

/**
 * Código del cuerpo que aparece PRIMERO en un texto ("Venus armoniza al Sol" →
 * VE, no SO): el sujeto de la frase manda, no el orden de la tabla.
 */
export function bodyCodeForName(text: string | undefined | null): string | null {
  if (!text) return null;
  const k = deacento(text);
  let best: string | null = null;
  let bestIndex = Infinity;
  for (const [re, code] of BODY_NAMES) {
    const m = k.match(re);
    if (m && m.index !== undefined && m.index < bestIndex) {
      bestIndex = m.index;
      best = code;
    }
  }
  return best;
}

/** Minúsculas sin diacríticos: "Géminis" → "geminis", "Plutón" → "pluton". */
function deacento(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
