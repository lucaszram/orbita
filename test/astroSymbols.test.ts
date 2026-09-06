import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  ASTRO_GLYPHS,
  ASTRO_GLYPH_STROKE,
  ASTRO_GLYPH_VIEWBOX,
  astroGlyphDef,
  BODY_GLYPH_KEYS,
  SIGN_GLYPH_KEYS,
  type AstroGlyphKey
} from "../src/domain/astroGlyphs";
import {
  bodySymbol,
  bodySymbolForName,
  isWheelBody,
  PLACEMENT_BODY_SYMBOL,
  RETROGRADE_CODE,
  signGlyphKey,
  signIndexForName,
  signSymbolForName
} from "../src/domain/astroSymbols";
import { ROOT, resolveEntryForPlatform } from "./moduleGraph";

/** Los comentarios NOMBRAN los glifos viejos a propósito (documentan el bug). */
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const fuente = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const implementacionWeb = (entry: string) => relative(ROOT, resolveEntryForPlatform(entry, "web"));

const RECEPCION_WEB = implementacionWeb("app/recepcion.tsx");
const CARTA_FULL_WEB = implementacionWeb("app/carta-full.tsx");
const READING_RUEDA_WEB = implementacionWeb("app/reading/rueda.tsx");
const READING_CARTA_WEB = implementacionWeb("app/reading/carta.tsx");

/**
 * Superficies que presentan símbolos astrológicos. Ninguna puede depender de
 * la plataforma (Unicode/emoji) ni degradar a códigos de dos letras.
 */
const SUPERFICIES = [
  "src/components/orbita/NatalWheel.tsx",
  "src/components/orbita/GlyphRow.tsx",
  "src/components/orbita/AstroGlyph.tsx",
  "src/components/orbita/TriadLine.tsx",
  "src/components/orbita/kit.tsx",
  "src/components/home/sections.tsx",
  // La fila del ranking de tránsitos: desde V4.9.2 su cabecera es notación
  // simbólica (cuerpo en tránsito · aspecto · punto natal), así que entra bajo
  // las mismas reglas que el resto de los símbolos de la app.
  "src/components/v492/TransitCard.tsx",
  "src/domain/wheelLayout.ts",
  "src/domain/astroSymbols.ts",
  "src/domain/astroGlyphs.ts",
  "src/domain/readingEngine.ts",
  "src/screens/CartaScreen.tsx",
  "src/screens/HomeScreen.tsx",
  "src/components/home/CartaCard.tsx",
  "src/screens/PerfilScreen.tsx",
  RECEPCION_WEB,
  CARTA_FULL_WEB,
  READING_RUEDA_WEB,
  READING_CARTA_WEB
];

/**
 * Lo prohibido: signos del zodíaco (U+2648–U+2653), símbolos planetarios y
 * misceláneos del bloque U+2600–U+26FF, la marca de retrogradación `℞`
 * (U+211E), `⊕` (U+2295) y el selector de variación U+FE0E. También cualquier
 * emoji pictográfico y los modificadores de emoji. Nada de esto puede aparecer
 * como literal presentable: en web y Android caería al font de EMOJI.
 */
const PROHIBIDOS =
  /[☀-⛿♈-♓℞⊕︎️\u{1F000}-\u{1FAFF}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{200D}]/u;

test("ninguna superficie presenta signos, planetas ni emoji dependientes de plataforma", () => {
  for (const rel of SUPERFICIES) {
    const codigo = sinComentarios(fuente(rel));
    const hit = codigo.match(PROHIBIDOS);
    assert.equal(
      hit,
      null,
      `${rel} usa un símbolo dependiente de plataforma: ${JSON.stringify(hit?.[0])} (U+${hit?.[0]
        ?.codePointAt(0)
        ?.toString(16)
        .toUpperCase()})`
    );
  }
});

// --- El catálogo: completo, dibujable y determinista -------------------------

const CATALOGO: AstroGlyphKey[] = [...BODY_GLYPH_KEYS, ...SIGN_GLYPH_KEYS];

test("el catálogo cubre los quince cuerpos/puntos pedidos y los doce signos", () => {
  assert.deepEqual(
    [...BODY_GLYPH_KEYS],
    [
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
    ]
  );
  assert.deepEqual(
    [...SIGN_GLYPH_KEYS],
    [
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
    ]
  );
  assert.equal(CATALOGO.length, 27);
  for (const key of CATALOGO) {
    assert.ok(ASTRO_GLYPHS[key], `falta el glifo de ${key}`);
    assert.equal(astroGlyphDef(key), ASTRO_GLYPHS[key]);
  }
});

test("cada glifo es un dibujo vectorial válido dentro de la grilla de 24", () => {
  assert.equal(ASTRO_GLYPH_VIEWBOX, 24);
  assert.ok(ASTRO_GLYPH_STROKE > 0);
  for (const key of CATALOGO) {
    const def = ASTRO_GLYPHS[key];
    const primitivas = (def.strokes?.length ?? 0) + (def.rings?.length ?? 0) + (def.dots?.length ?? 0);
    assert.ok(primitivas >= 1, `${key} no dibuja nada`);

    for (const d of def.strokes ?? []) {
      // Sólo comandos de path SVG: nada de texto, referencias ni caracteres raros.
      assert.match(d, /^M[MLHVCSQTAZmlhvcsqtaz0-9,.\s-]+$/, `${key}: path inválido "${d.slice(0, 40)}"`);
      const numeros = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      assert.ok(numeros.length > 0, `${key}: path sin coordenadas`);
      for (const n of numeros) {
        assert.ok(Number.isFinite(n), `${key}: coordenada no finita`);
        // Las banderas de arco (0/1) y coordenadas caben en la grilla con margen.
        assert.ok(n >= -2 && n <= 26, `${key}: coordenada ${n} fuera de la grilla`);
      }
    }
    for (const c of [...(def.rings ?? []), ...(def.dots ?? [])]) {
      assert.ok(c.r > 0, `${key}: círculo sin radio`);
      assert.ok(c.cx - c.r >= -0.5 && c.cx + c.r <= 24.5, `${key}: círculo fuera de la grilla`);
      assert.ok(c.cy - c.r >= -0.5 && c.cy + c.r <= 24.5, `${key}: círculo fuera de la grilla`);
    }
  }
});

test("veintisiete glifos, veintisiete dibujos distintos", () => {
  const vistos = new Map<string, string>();
  for (const key of CATALOGO) {
    const firma = JSON.stringify(ASTRO_GLYPHS[key]);
    assert.equal(vistos.has(firma), false, `${key} repite el dibujo de ${vistos.get(firma)}`);
    vistos.set(firma, key);
  }
});

// --- Resolución de signos -----------------------------------------------------

test("el índice de signo se normaliza y mapea a la clave del catálogo", () => {
  assert.equal(signGlyphKey(0), "aries");
  assert.equal(signGlyphKey(11), "pisces");
  // Índice fuera de rango: se normaliza, no se rompe.
  assert.equal(signGlyphKey(12), "aries");
  assert.equal(signGlyphKey(-1), "pisces");
});

test("los nombres de signo se reconocen con y sin acento, en es y en", () => {
  assert.equal(signIndexForName("Géminis"), 2);
  assert.equal(signIndexForName("geminis"), 2);
  assert.equal(signIndexForName("Gemini"), 2);
  assert.equal(signIndexForName("Escorpio"), 7);
  assert.equal(signIndexForName("Scorpio"), 7);
  assert.equal(signIndexForName("Capricornio"), 9);
  assert.equal(signIndexForName("—"), null);
  assert.equal(signIndexForName(undefined), null);
  assert.equal(signSymbolForName("Capricornio"), "capricorn");
  assert.equal(signSymbolForName("Piscis"), "pisces");
  assert.equal(signSymbolForName("no es un signo"), null);
});

// --- Resolución de cuerpos ----------------------------------------------------

test("cada key del payload resuelve a su propio glifo y los ejes no se dibujan en la rueda", () => {
  for (const key of BODY_GLYPH_KEYS) {
    assert.equal(bodySymbol({ key }), key, `${key} tiene que resolver a su glifo`);
  }
  assert.equal(isWheelBody("sun"), true);
  assert.equal(isWheelBody("ascendant"), false, "el Asc es un eje");
  assert.equal(isWheelBody("midheaven"), false, "el MC es un eje");
  assert.equal(isWheelBody("desconocido"), false);
  assert.equal(isWheelBody(undefined), false);
});

test("con una key desconocida se cae al nombre visible, nunca a una abreviatura", () => {
  assert.equal(bodySymbol({ key: "quaoar", label: "Venus" }), "venus");
  assert.equal(bodySymbol({ key: undefined, label: "Plutón" }), "pluto");
  assert.equal(bodySymbol({ label: "algo sin cuerpo" }), "sun");
});

test("gana el cuerpo que aparece primero en el texto", () => {
  assert.equal(bodySymbolForName("Venus armoniza tu Sol"), "venus");
  assert.equal(bodySymbolForName("Tu Sol recibe a Venus"), "sun");
  assert.equal(bodySymbolForName("Júpiter en tu casa 10"), "jupiter");
  assert.equal(bodySymbolForName("Jupiter sin acento"), "jupiter");
  assert.equal(bodySymbolForName("Medio cielo"), "midheaven");
  assert.equal(bodySymbolForName("Parte de la Fortuna"), "part_of_fortune");
  assert.equal(bodySymbolForName("sin cuerpos"), null);
});

test("la tríada del dominio mapea a los glifos del catálogo", () => {
  assert.deepEqual(PLACEMENT_BODY_SYMBOL, { sol: "sun", luna: "moon", ascendente: "ascendant" });
});

test("la marca de retrogradación es ASCII", () => {
  assert.equal(RETROGRADE_CODE, "Rx");
  assert.ok(!PROHIBIDOS.test(RETROGRADE_CODE));
});

// --- Sin fallback de dos letras -----------------------------------------------

const CODIGOS_VIEJOS = /"(SO|LU|ME|VE|MA|JU|SA|UR|NE|PL|NO|QU|FO|AC|MC)"/;

test("ningún consumidor vuelve a los códigos de dos letras", () => {
  for (const rel of SUPERFICIES) {
    const codigo = sinComentarios(fuente(rel));
    assert.doesNotMatch(codigo, /\bbodyCode\b|\bBODY_CODES\b/, `${rel} sigue usando la API de códigos`);
    const hit = codigo.match(CODIGOS_VIEJOS);
    assert.equal(hit, null, `${rel} contiene el código de dos letras ${hit?.[0]}`);
  }
});

test("las superficies de símbolos dibujan con el catálogo vectorial propio", () => {
  const CON_GLIFOS = [
    "src/components/orbita/NatalWheel.tsx",
    "src/components/orbita/GlyphRow.tsx",
    "src/components/orbita/kit.tsx",
    "src/components/home/sections.tsx",
    "src/components/v492/TransitCard.tsx",
    "src/screens/CartaScreen.tsx",
    "src/components/home/CartaCard.tsx",
    RECEPCION_WEB,
    CARTA_FULL_WEB
  ];
  for (const rel of CON_GLIFOS) {
    assert.match(fuente(rel), /AstroGlyph|TriadLine/, `${rel} no usa el catálogo vectorial`);
  }
});

// --- La notación compacta de la fila de tránsito ------------------------------

const TRANSIT_CARD = "src/components/v492/TransitCard.tsx";

/**
 * Los nombres que el backend publica en `transitPlanet` / `natalPoint` son las
 * etiquetas en español de `convex/lib/orbita.ts` más los dos ejes. Si alguno
 * dejara de resolver, la cabecera caería al respaldo textual sin que nadie se
 * entere: este gate lo convierte en un test rojo.
 */
const NOMBRES_DEL_CONTRATO: Array<[string, string]> = [
  ["Sol", "sun"],
  ["Luna", "moon"],
  ["Mercurio", "mercury"],
  ["Venus", "venus"],
  ["Marte", "mars"],
  ["Júpiter", "jupiter"],
  ["Saturno", "saturn"],
  ["Urano", "uranus"],
  ["Neptuno", "neptune"],
  ["Plutón", "pluto"],
  ["Nodo", "node"],
  ["Quirón", "chiron"],
  ["Parte de Fortuna", "part_of_fortune"],
  ["Ascendente", "ascendant"],
  ["Medio Cielo", "midheaven"]
];

test("cada punto que la fila de tránsito puede recibir resuelve a un glifo del catálogo", () => {
  for (const [nombre, key] of NOMBRES_DEL_CONTRATO) {
    assert.equal(bodySymbolForName(nombre), key, `«${nombre}» tiene que resolver a ${key}`);
  }
});

test("la fila de tránsito dibuja sus DOS extremos con el catálogo vectorial y conserva el aspecto en el medio", () => {
  const card = sinComentarios(fuente(TRANSIT_CARD));

  // Los extremos salen del catálogo propio, resueltos por NOMBRE: la fila no
  // recibe `key`, recibe "Mercurio" y "Saturno".
  assert.match(card, /import \{ AstroGlyph \} from "@\/components\/orbita\/AstroGlyph";/);
  assert.match(card, /import \{ bodySymbolForName \} from "@\/domain\/astroSymbols";/);
  assert.match(card, /bodySymbolForName\(name\)/, "el extremo resuelve su glifo por el nombre visible");
  assert.match(card, /<AstroGlyph symbol=\{symbol\}/, "el extremo se dibuja con el glifo resuelto");

  // La cabecera compacta: tránsito en COBRE, aspecto, natal en MARFIL, en ese
  // orden. El color es lo que distingue "lo que se mueve" de "tu carta".
  const cabecera = card.slice(card.indexOf("styles.shorthand"), card.indexOf("styles.orb"));
  assert.ok(cabecera.length > 0, "no se encontró la cabecera compacta");
  assert.match(cabecera, /<BodyMark name=\{item\.transitPlanet\} color=\{v492\.colors\.copper\}/);
  assert.match(cabecera, /<BodyMark name=\{item\.natalPoint\} color=\{v492\.colors\.text\}/);
  assert.match(cabecera, /<AspectGlyph aspect=\{item\.aspect\}/, "el aspecto sigue siendo el glifo vectorial");

  const orden = [...cabecera.matchAll(/<(BodyMark|AspectGlyph)\b/g)].map((m) => m[1]);
  assert.deepEqual(
    orden,
    ["BodyMark", "AspectGlyph", "BodyMark"],
    "la notación es tránsito · aspecto · natal, y el aspecto va en el medio"
  );

  // Y `AspectGlyph` sigue siendo vector, no un carácter.
  const layout = sinComentarios(fuente("src/components/v492/Layout.tsx"));
  const glyph = /export function AspectGlyph\([\s\S]*?\n\}/.exec(layout)?.[0] ?? "";
  assert.ok(glyph, "no se encontró AspectGlyph");
  assert.match(glyph, /<Svg\b/, "el glifo del aspecto se dibuja en SVG");
  assert.doesNotMatch(glyph, /fontFamily|<Text\b/, "el glifo del aspecto no puede volver a ser texto");
});

test("si un nombre no resuelve a un glifo, la fila lo escribe: el símbolo no puede ser la única versión del dato", () => {
  const card = sinComentarios(fuente(TRANSIT_CARD));
  const mark = /function BodyMark\([\s\S]*?\n\}/.exec(card)?.[0] ?? "";
  assert.ok(mark, "no se encontró el componente del extremo");
  assert.match(
    mark,
    /if \(symbol === null\) return <Body[^>]*>\{name\}<\/Body>;/,
    "sin glifo, el extremo tiene que imprimir el nombre en vez de dejar un hueco mudo"
  );
  // El caso que activa el respaldo: un punto que el catálogo no dibuja.
  assert.equal(bodySymbolForName("Punto que el catálogo todavía no dibuja"), null);
});

// --- Sin dependencia de fuentes -----------------------------------------------

test("los glifos no dependen de ninguna fuente: ni del sistema ni empaquetada", () => {
  for (const rel of ["src/domain/astroGlyphs.ts", "src/components/orbita/AstroGlyph.tsx"]) {
    const codigo = sinComentarios(fuente(rel));
    assert.doesNotMatch(codigo, /fontFamily|@expo\/vector-icons|MaterialCommunityIcons/, `${rel} depende de una fuente`);
  }
  // El font de glifos del zodíaco (MaterialCommunityIcons) quedó eliminado.
  assert.equal(existsSync(join(ROOT, "src/theme/glyphFont.ts")), false, "glyphFont.ts tiene que estar eliminado");
  const hook = sinComentarios(fuente("src/hooks/useOrbitaFonts.ts"));
  assert.doesNotMatch(hook, /GLYPH_FONT|MaterialCommunityIcons/);
  // Y sigue cargando la mono, que dibuja numerales de casa y la marca Rx.
  assert.ok(/RobotoMono_400Regular/.test(hook) && /RobotoMono_500Medium/.test(hook));
});

test("en la rueda, signos y planetas son glifos vectoriales; el único texto declara la mono", () => {
  const wheel = fuente("src/components/orbita/NatalWheel.tsx");
  assert.match(wheel, /WheelAstroGlyph/, "la rueda dibuja los glifos del catálogo");
  const textos = wheel.match(/<SvgText[\s\S]*?>/g) ?? [];
  assert.ok(textos.length >= 2, "quedan los numerales de casa y la marca Rx");
  for (const t of textos) {
    // Sin `fontFamily` el render cae al font del sistema: el bug original.
    assert.ok(
      /fontFamily=\{orbita\.fonts\.(mono|monoMedium)\}/.test(t),
      `SvgText sin familia empaquetada: ${t.slice(0, 80)}`
    );
  }
});
