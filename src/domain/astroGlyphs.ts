/**
 * Glifos astrológicos de Órbita: vectores propios, deterministas y monocromos.
 *
 * ## Por qué paths y no una fuente
 *
 * Las familias de texto empaquetadas (Newsreader, Inter, Roboto Mono) no traen
 * los símbolos astrológicos, y los caracteres Unicode (`☉ ☽ … ♈–♓`) caen al
 * font del sistema —en web y Android, el de EMOJI: color, caja cuadrada, ancho
 * doble—. La primera respuesta fue degradar los planetas a códigos de dos
 * letras (`SO`, `LU`, …); Lucas rechazó esa limitación. Este módulo la elimina:
 * cada símbolo es un dibujo vectorial que viaja en el bundle, se pinta con el
 * color que se le pasa y es idéntico en web, iOS y Android. Ninguna superficie
 * vuelve a depender de qué glifos tenga una tipografía.
 *
 * ## Fuente y licencia
 *
 * Los 27 dibujos (15 cuerpos/puntos + 12 signos) son **originales, dibujados a
 * mano para Órbita** sobre una grilla de 24×24, siguiendo las formas canónicas
 * de la notación astrológica (símbolos de dominio público). No se extrajo
 * ningún outline de fuentes de terceros. Licencia: la del repo, como el resto
 * del código. El vocabulario es UNO solo: mismo trazo (redondeado, peso
 * `ASTRO_GLYPH_STROKE`) para signos y planetas — antes los signos salían de
 * MaterialCommunityIcons y los planetas eran texto mono, dos vocabularios.
 *
 * ## Contrato de dibujo
 *
 * - `strokes`: paths que se TRAZAN (`fill="none"`, `stroke = color`).
 * - `rings`: círculos trazados (los aros de Sol, Venus, etc.).
 * - `dots`: círculos RELLENOS (el punto del Sol, el de Urano).
 *
 * Todo cabe en `0..24`; el que dibuja escala con `size / ASTRO_GLYPH_VIEWBOX` y
 * el trazo se define en unidades de la grilla, así el peso relativo es el mismo
 * a cualquier tamaño. Ascendente y Medio Cielo se dibujan como los monogramas
 * `Ac` / `Mc` — la notación astrológica canónica de los ejes es tipográfica —
 * pero como paths propios: tampoco ellos dependen de una fuente.
 */

export const ASTRO_GLYPH_VIEWBOX = 24;
/** Peso del trazo, en unidades de la grilla de 24. */
export const ASTRO_GLYPH_STROKE = 1.6;

export type AstroGlyphCircle = { cx: number; cy: number; r: number };

export type AstroGlyphDef = {
  /** Paths trazados (sin relleno). */
  strokes?: string[];
  /** Círculos trazados. */
  rings?: AstroGlyphCircle[];
  /** Círculos rellenos. */
  dots?: AstroGlyphCircle[];
};

/** Cuerpos y puntos del payload de `charts.current`, más los dos ejes. */
export const BODY_GLYPH_KEYS = [
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
] as const;

export type BodyGlyphKey = (typeof BODY_GLYPH_KEYS)[number];

/** Los doce signos, en orden de longitud eclíptica (0 = Aries). */
export const SIGN_GLYPH_KEYS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces"
] as const;

export type SignGlyphKey = (typeof SIGN_GLYPH_KEYS)[number];

export type AstroGlyphKey = BodyGlyphKey | SignGlyphKey;

const BODY_GLYPHS: Record<BodyGlyphKey, AstroGlyphDef> = {
  // ☉ — aro con punto central.
  sun: {
    rings: [{ cx: 12, cy: 12, r: 7 }],
    dots: [{ cx: 12, cy: 12, r: 1.5 }]
  },
  // ☽ — creciente abierta a la derecha (arco externo + arco interno).
  moon: {
    strokes: ["M13.5 4 A 8 8 0 0 0 13.5 20 A 10.7 10.7 0 0 1 13.5 4 Z"]
  },
  // ☿ — cuernos, aro y cruz.
  mercury: {
    rings: [{ cx: 12, cy: 10.5, r: 3.8 }],
    strokes: ["M8.2 3 A 3.8 3.8 0 0 0 15.8 3", "M12 14.3 V21", "M8.8 17.8 H15.2"]
  },
  // ♀ — aro y cruz.
  venus: {
    rings: [{ cx: 12, cy: 8.5, r: 4.8 }],
    strokes: ["M12 13.3 V21", "M8.6 17.2 H15.4"]
  },
  // ♂ — aro y flecha al noreste.
  mars: {
    rings: [{ cx: 10.2, cy: 13.8, r: 5 }],
    strokes: ["M13.9 10.1 L19.6 4.4", "M14.3 4.4 H19.6 V9.7"]
  },
  // ♃ — voluta «2» y cruz a la derecha.
  jupiter: {
    strokes: [
      "M4.8 8 A 3.6 3.6 0 1 1 11.9 7.4 C 11.9 10.8 8.6 13.6 5 15.6",
      "M4.6 15.6 H19.4",
      "M15.6 3.6 V20.4"
    ]
  },
  // ♄ — cruz y cola en ese.
  saturn: {
    strokes: [
      "M5.2 6.6 H11.2",
      "M8.2 3.2 V13.2",
      "M8.2 12.6 C 9.6 10 11.6 8.8 13.4 8.8 C 16.2 8.8 16.9 10.8 16.9 12.4 C 16.9 15 15 17.2 13.5 18.8 C 12.5 19.9 12.5 20.5 13.3 21"
    ]
  },
  // ♅ — «H» de Herschel sobre un globo con punto.
  uranus: {
    rings: [{ cx: 12, cy: 17.6, r: 3 }],
    dots: [{ cx: 12, cy: 17.6, r: 1.1 }],
    strokes: ["M8 3.5 V13", "M16 3.5 V13", "M8 8.2 H16", "M12 8.2 V14.6"]
  },
  // ♆ — tridente con cruz.
  neptune: {
    strokes: ["M12 3.5 V21", "M8.4 17.6 H15.6", "M5 4.5 V8 A 7 7 0 0 0 19 8 V4.5"]
  },
  // ♇ — aro sobre copa sobre cruz.
  pluto: {
    rings: [{ cx: 12, cy: 5.6, r: 2.5 }],
    strokes: ["M6.4 5.2 A 5.6 5.6 0 0 0 17.6 5.2", "M12 10.8 V20", "M8.6 16.4 H15.4"]
  },
  // ☊ — nodo norte: arco con dos bucles.
  node: {
    rings: [
      { cx: 6.9, cy: 17, r: 2.1 },
      { cx: 17.1, cy: 17, r: 2.1 }
    ],
    strokes: ["M7.7 15.1 A 5.4 5.4 0 1 1 16.3 15.1"]
  },
  // ⚷ — llave de Quirón: «K» sobre aro.
  chiron: {
    rings: [{ cx: 12, cy: 17.3, r: 3.6 }],
    strokes: ["M12 13.7 V3.8", "M12 9 L16.4 4.6", "M12 9 L16.4 13.4"]
  },
  // ⊗ — Parte de la Fortuna: aro con aspa.
  part_of_fortune: {
    rings: [{ cx: 12, cy: 12, r: 7.5 }],
    strokes: ["M6.7 6.7 L17.3 17.3", "M17.3 6.7 L6.7 17.3"]
  },
  // Monograma «Ac»: el eje se escribe, pero con paths propios.
  ascendant: {
    strokes: ["M3.5 19 L8.3 5 L13.1 19", "M5.4 14.2 H11.2", "M20.6 13.6 A 3.4 3.4 0 1 0 20.6 17.9"]
  },
  // Monograma «Mc».
  midheaven: {
    strokes: ["M3.2 19 V5 L8.2 13.5 L13.2 5 V19", "M20.8 13.6 A 3.4 3.4 0 1 0 20.8 17.9"]
  }
};

const SIGN_GLYPHS: Record<SignGlyphKey, AstroGlyphDef> = {
  // ♈ — cuernos del carnero.
  aries: {
    strokes: [
      "M12 20 V10 C 12 5.6 10.6 4.2 8.5 4.2 C 6.2 4.2 5 5.8 5 8.2 C 5 9.8 5.6 11 6.6 12",
      "M12 10 C 12 5.6 13.4 4.2 15.5 4.2 C 17.8 4.2 19 5.8 19 8.2 C 19 9.8 18.4 11 17.4 12"
    ]
  },
  // ♉ — cabeza y cuernos del toro.
  taurus: {
    rings: [{ cx: 12, cy: 14.6, r: 5.6 }],
    strokes: ["M5 4.2 A 7.5 7.5 0 0 0 19 4.2"]
  },
  // ♊ — los gemelos.
  gemini: {
    strokes: ["M8.8 5.2 V18.8", "M15.2 5.2 V18.8", "M4.4 5.4 Q 12 3 19.6 5.4", "M4.4 18.6 Q 12 21 19.6 18.6"]
  },
  // ♋ — el cangrejo.
  cancer: {
    rings: [
      { cx: 7.2, cy: 8.4, r: 2.7 },
      { cx: 16.8, cy: 15.6, r: 2.7 }
    ],
    strokes: ["M9.9 8.1 C 13.5 4.6 17.5 4.9 19.9 8.3", "M14.1 15.9 C 10.5 19.4 6.5 19.1 4.1 15.7"]
  },
  // ♌ — la melena del león.
  leo: {
    rings: [{ cx: 6.9, cy: 15.9, r: 2.6 }],
    strokes: [
      "M6.9 13.3 C 6.9 7 9 5 12.1 5 C 15.2 5 16.7 7.2 16.7 9.6 C 16.7 12.6 15.6 14.8 14.9 16.6 C 14.3 18.2 15.1 19.3 16.3 19.3 C 17.1 19.3 17.7 18.9 18 18.3"
    ]
  },
  // ♍ — la virgen.
  virgo: {
    strokes: [
      "M3.6 18 V7.4 C 3.6 5.9 4.5 5.1 5.6 5.1 C 6.7 5.1 7.6 5.9 7.6 7.4 V18",
      "M7.6 7.4 C 7.6 5.9 8.5 5.1 9.6 5.1 C 10.7 5.1 11.6 5.9 11.6 7.4 V18",
      "M11.6 7.4 C 11.6 5.9 12.5 5.1 13.6 5.1 C 14.7 5.1 15.6 5.9 15.6 7.4 V13.6",
      "M15.6 9.4 C 18.4 10.2 19.9 12 19.9 14.3 C 19.9 17 17.7 18.9 13.6 20.4"
    ]
  },
  // ♎ — la balanza.
  libra: {
    strokes: ["M4 19.2 H20", "M4 14.8 H8.8 A 3.9 3.9 0 1 1 15.2 14.8 H20"]
  },
  // ♏ — el escorpión.
  scorpio: {
    strokes: [
      "M3.6 18 V7.4 C 3.6 5.9 4.5 5.1 5.6 5.1 C 6.7 5.1 7.6 5.9 7.6 7.4 V18",
      "M7.6 7.4 C 7.6 5.9 8.5 5.1 9.6 5.1 C 10.7 5.1 11.6 5.9 11.6 7.4 V18",
      "M11.6 7.4 C 11.6 5.9 12.5 5.1 13.6 5.1 C 14.7 5.1 15.6 5.9 15.6 7.4 V15.6 C 15.6 17.9 16.7 19 18.4 19 H20.4",
      "M18.6 16.9 L20.7 19 L18.6 21.1"
    ]
  },
  // ♐ — la flecha del arquero.
  sagittarius: {
    strokes: ["M4.6 19.4 L19 5", "M12.4 5 H19 V11.6", "M7.4 11.6 L12.4 16.6"]
  },
  // ♑ — la cabra de mar.
  capricorn: {
    strokes: [
      "M3.4 5.6 C 4.4 4.6 5.8 4.8 6.4 6.2 L9 13",
      "M9 13 C 10 8 11 5.2 12.2 5.2 C 13.2 5.2 13.6 6.4 13.6 8.4 V14.4",
      "M13.6 14.4 C 13.6 17.4 15 19.2 17 19.2 C 18.9 19.2 20.2 17.8 20.2 16 C 20.2 14.2 18.9 13 17.3 13 C 15.6 13 14.3 14.3 13.6 16.2"
    ]
  },
  // ♒ — las dos ondas.
  aquarius: {
    strokes: ["M4 9.6 L8 6.4 L12 9.6 L16 6.4 L20 9.6", "M4 17.6 L8 14.4 L12 17.6 L16 14.4 L20 17.6"]
  },
  // ♓ — los dos peces.
  pisces: {
    strokes: ["M7.6 4 Q 3.8 12 7.6 20", "M16.4 4 Q 20.2 12 16.4 20", "M6 12 H18"]
  }
};

/** El catálogo completo: 15 cuerpos/puntos + 12 signos, un solo vocabulario. */
export const ASTRO_GLYPHS: Record<AstroGlyphKey, AstroGlyphDef> = {
  ...BODY_GLYPHS,
  ...SIGN_GLYPHS
};

/** Índice normalizado de signo (nunca rompe con un índice fuera de rango). */
const wrap12 = (index: number) => ((Math.trunc(index) % 12) + 12) % 12;

/** Clave del glifo del signo por índice de longitud eclíptica (0 = Aries). */
export function signGlyphKey(index: number): SignGlyphKey {
  return SIGN_GLYPH_KEYS[wrap12(index)];
}

/** Definición dibujable de cualquier glifo del catálogo. */
export function astroGlyphDef(key: AstroGlyphKey): AstroGlyphDef {
  return ASTRO_GLYPHS[key];
}
