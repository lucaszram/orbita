/**
 * Símbolos astrológicos SIN emoji ni dependencia de plataforma.
 *
 * La rueda y la tabla usaban los caracteres Unicode de signos y planetas
 * (`♈`–`♓` U+2648–U+2653, `☉ ☽ ☿ ♀ ♂ ♃ ♄ ♅ ♆ ♇ ☊ ⚷ ⊕`, `℞`). Ninguna de las
 * familias que Órbita empaqueta —Newsreader, Inter, Roboto Mono— tiene esos
 * glifos, así que el render caía al font del sistema: en la web y en Android eso
 * es la fuente de EMOJI, que los dibuja a color, con caja cuadrada y ancho
 * doble, ignorando el `fill` cobre (los "cuadrados violetas"). El truco del
 * selector de variación U+FE0E que había en la rueda pide presentación de texto,
 * pero es exactamente eso: un pedido. Chrome/Windows y varias versiones de
 * Android lo ignoran, y en SVG el resultado es todavía menos predecible. O sea
 * que la carta natal se veía distinta —y a veces rota— según el aparato.
 *
 * Se buscó un asset propio antes de decidir: no hay ninguna tipografía de
 * símbolos empaquetada en el repo (`assets/` no tiene `.ttf`/`.otf`; las
 * familias vienen de `@expo-google-fonts`) y los emblemas de
 * `assets/orbita/optimized/emblems/` son JPG de cobre por signo —raster,
 * ~cientos de KB, fondo oscuro, once de doce signos (falta Capricornio)—: no
 * sirven como glifo monocromo dentro de la rueda.
 *
 * Sin descargar un asset nuevo, el patrón más seguro que YA existe en el
 * proyecto es texto en la mono empaquetada: es exactamente lo que hacen los
 * numerales romanos de las casas en la rueda (`orbita.fonts.mono`). Roboto Mono
 * cubre el alfabeto latino, se ve idéntica en web, iOS y Android, y respeta el
 * color. Así que los símbolos pasan a ser códigos de tres/dos letras.
 *
 * **Limitación aceptada:** son abreviaturas, no los glifos astrológicos
 * clásicos. Es menos icónico que `♈`. Se elige porque un glifo que se dibuja
 * distinto —o a color, o no se dibuja— en cada plataforma es peor que una
 * abreviatura que se dibuja igual en todas. Recuperar los glifos reales exige
 * empaquetar una tipografía de símbolos con licencia (o dibujarlos como paths
 * SVG), y eso es traer un asset nuevo: queda como decisión de diseño aparte.
 */

/** Códigos de signo por índice de longitud eclíptica (0 = Aries). */
export const SIGN_CODES = [
  "ARI",
  "TAU",
  "GEM",
  "CAN",
  "LEO",
  "VIR",
  "LIB",
  "ESC",
  "SAG",
  "CAP",
  "ACU",
  "PIS"
] as const;

/** Código del signo por índice (se normaliza el índice para no romper nunca). */
export function signCode(index: number): string {
  return SIGN_CODES[((index % 12) + 12) % 12];
}

/** Nombre del signo (es/en, con o sin acento) → código. `null` si no se reconoce. */
export function signCodeForName(name: string | undefined | null): string | null {
  if (!name) return null;
  const k = deacento(name);
  const hit = SIGN_NAMES.find(([re]) => re.test(k));
  return hit ? hit[1] : null;
}

const SIGN_NAMES: Array<[RegExp, string]> = [
  [/^aries/, "ARI"],
  [/^tauro|^taurus/, "TAU"],
  [/^geminis|^gemini/, "GEM"],
  [/^cancer/, "CAN"],
  [/^leo/, "LEO"],
  [/^virgo/, "VIR"],
  [/^libra/, "LIB"],
  [/^escorpio|^scorpio/, "ESC"],
  [/^sagitario|^sagittarius/, "SAG"],
  [/^capricornio|^capricorn/, "CAP"],
  [/^acuario|^aquarius/, "ACU"],
  [/^piscis|^pisces/, "PIS"]
];

/**
 * Códigos de cuerpo/punto por `key` del payload de `charts.current`.
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
