/**
 * Resolución de símbolos astrológicos: del payload (o de un texto visible) a la
 * clave del glifo dibujable.
 *
 * ## Historia
 *
 * La rueda y la tabla usaban los caracteres Unicode (`♈`–`♓`, `☉ ☽ ☿ …`).
 * Ninguna familia de TEXTO empaquetada los trae, así que el render caía al font
 * del sistema: en web y Android, el de EMOJI (color, caja cuadrada, ancho
 * doble). La primera corrección degradó los planetas a códigos de dos letras
 * (`SO`, `LU`, …) y los signos a MaterialCommunityIcons. Lucas rechazó esa
 * limitación: hoy TODOS los símbolos —signos, planetas, puntos y ejes— son
 * vectores propios empaquetados (`domain/astroGlyphs`, dibujados por
 * `components/orbita/AstroGlyph`), deterministas, monocromos e idénticos en
 * web, iOS y Android. Este módulo sólo resuelve QUÉ glifo corresponde; nunca
 * devuelve una abreviatura ni un carácter Unicode.
 */
import { signGlyphKey, type BodyGlyphKey, type SignGlyphKey } from "./astroGlyphs";
import type { PlacementBody } from "./types";

export type { AstroGlyphKey, BodyGlyphKey, SignGlyphKey } from "./astroGlyphs";
export { signGlyphKey } from "./astroGlyphs";

/** Glifo de cada cuerpo de la tríada del dominio (`Placement.body`). */
export const PLACEMENT_BODY_SYMBOL: Record<PlacementBody, BodyGlyphKey> = {
  sol: "sun",
  luna: "moon",
  ascendente: "ascendant"
};

/** Nombre del signo (es/en, con o sin acento) → índice eclíptico. `null` si no se reconoce. */
export function signIndexForName(name: string | undefined | null): number | null {
  if (!name) return null;
  const k = deacento(name);
  const hit = SIGN_NAMES.findIndex(([re]) => re.test(k));
  return hit === -1 ? null : SIGN_NAMES[hit][1];
}

/** Clave del glifo del signo a partir de su nombre. `null` si no se reconoce. */
export function signSymbolForName(name: string | undefined | null): SignGlyphKey | null {
  const index = signIndexForName(name);
  return index === null ? null : signGlyphKey(index);
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
 * Las `key` del payload de `charts.current` son exactamente las claves del
 * catálogo de glifos, así que la "tabla" es la identidad; este set dice cuáles
 * son cuerpos/puntos válidos. `ascendant`/`midheaven` son EJES (no puntos): la
 * rueda no los dibuja como planeta, pero la tabla y la tríada sí los nombran.
 */
const BODY_KEY_SET: ReadonlySet<string> = new Set([
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "node",
  "chiron",
  "part_of_fortune",
  "ascendant",
  "midheaven"
]);

/** ¿Es un punto que la rueda dibuja por longitud eclíptica? (los ejes no). */
export function isWheelBody(key: string | undefined): boolean {
  if (!key) return false;
  return BODY_KEY_SET.has(key) && key !== "ascendant" && key !== "midheaven";
}

/**
 * Marca de retrogradación. El símbolo tradicional `℞` (U+211E) tampoco está en
 * las familias de texto empaquetadas; `Rx` es la notación ASCII estándar y no
 * forma parte del catálogo de glifos pedido.
 */
export const RETROGRADE_CODE = "Rx";

const BODY_NAMES: Array<[RegExp, BodyGlyphKey]> = [
  [/\bsol\b/, "sun"],
  [/\bluna\b/, "moon"],
  [/\bascendente\b/, "ascendant"],
  [/\bmedio ?cielo\b/, "midheaven"],
  [/\bmercurio\b/, "mercury"],
  [/\bvenus\b/, "venus"],
  [/\bmarte\b/, "mars"],
  [/\bjupiter\b/, "jupiter"],
  [/\bsaturno\b/, "saturn"],
  [/\burano\b/, "uranus"],
  [/\bneptuno\b/, "neptune"],
  [/\bpluton\b/, "pluto"],
  [/\bnodo\b/, "node"],
  [/\bquiron\b/, "chiron"],
  [/\bfortuna\b/, "part_of_fortune"]
];

/** Glifo por `key` del payload, con el nombre visible como respaldo. */
export function bodySymbol(input: { key?: string; label?: string }): BodyGlyphKey {
  if (input.key && BODY_KEY_SET.has(input.key)) return input.key as BodyGlyphKey;
  return bodySymbolForName(input.label ?? "") ?? "sun";
}

/**
 * Glifo del cuerpo que aparece PRIMERO en un texto ("Venus armoniza al Sol" →
 * `venus`, no `sun`): el sujeto de la frase manda, no el orden de la tabla.
 */
export function bodySymbolForName(text: string | undefined | null): BodyGlyphKey | null {
  if (!text) return null;
  const k = deacento(text);
  let best: BodyGlyphKey | null = null;
  let bestIndex = Infinity;
  for (const [re, key] of BODY_NAMES) {
    const m = k.match(re);
    if (m && m.index !== undefined && m.index < bestIndex) {
      bestIndex = m.index;
      best = key;
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
