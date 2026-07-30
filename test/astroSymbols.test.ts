import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BODY_CODES,
  bodyCode,
  bodyCodeForName,
  isWheelBody,
  RETROGRADE_CODE,
  SIGN_GLYPH_NAMES,
  SIGN_GLYPHS_COMPLETE,
  signGlyph,
  signGlyphCodepoint,
  signGlyphForName,
  signGlyphName,
  signIndexForName
} from "../src/domain/astroSymbols";

const ROOT = join(import.meta.dirname, "..");
/** Los comentarios NOMBRAN los glifos viejos a propósito (documentan el bug). */
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/**
 * El paquete real, leído por su cuenta (no a través del dominio): así el test
 * compara el mapeo contra la fuente empaquetada en vez de contra sí mismo. Si
 * `@expo/vector-icons` cambiara de glifos o de familia, esto falla.
 */
const VECTOR_ICONS = join(ROOT, "node_modules/@expo/vector-icons");
const BUNDLED_GLYPH_MAP: Record<string, number> = JSON.parse(
  readFileSync(join(VECTOR_ICONS, "build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json"), "utf8")
);
/** La familia que el paquete registra: `createIconSet(glyphMap, 'material-community', font)`. */
const BUNDLED_FAMILY = readFileSync(join(VECTOR_ICONS, "build/MaterialCommunityIcons.js"), "utf8").match(
  /createIconSet\(\s*glyphMap\s*,\s*'([^']+)'/
)?.[1];

/**
 * Superficies de la carta natal que este bloque deja sin presentación
 * dependiente de plataforma.
 */
const SUPERFICIES = [
  "src/components/orbita/NatalWheel.tsx",
  "src/components/orbita/GlyphRow.tsx",
  "src/domain/wheelLayout.ts",
  "src/domain/astroSymbols.ts",
  "src/screens/CartaScreen.tsx",
  "src/screens/HomeScreen.tsx",
  "src/components/home/CartaCard.tsx",
  "app/(tabs)/perfil.tsx",
  // Las demás superficies que dibujan la MISMA rueda o la misma tríada natal.
  "app/recepcion.tsx",
  "app/carta-full.tsx",
  "app/reading/rueda.tsx",
  "app/reading/carta.tsx"
];

/**
 * Lo prohibido: signos del zodíaco (U+2648–U+2653), símbolos planetarios y
 * misceláneos del bloque U+2600–U+26FF, la marca de retrogradación `℞`
 * (U+211E), `⊕` (U+2295) y el selector de variación U+FE0E, que era el parche
 * que pedía —sin garantía— presentación de texto. También cualquier emoji
 * pictográfico y los modificadores de emoji.
 *
 * Los glifos que sí se usan viven en el Área de Uso Privado del plano 15
 * (U+F0A7D…U+F0A88) y NUNCA aparecen como literal en el código: salen del glyph
 * map del paquete en tiempo de ejecución.
 */
const PROHIBIDOS =
  /[☀-⛿♈-♓℞⊕︎️\u{1F000}-\u{1FAFF}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{200D}]/u;

test("ninguna superficie de la carta presenta signos, planetas ni emoji dependientes de plataforma", () => {
  for (const rel of SUPERFICIES) {
    const codigo = sinComentarios(readFileSync(join(ROOT, rel), "utf8"));
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

// --- Los doce signos, contra el font EMPAQUETADO ------------------------------

test("los doce signos mapean a glifos del font empaquetado, no a abreviaturas", () => {
  assert.equal(SIGN_GLYPH_NAMES.length, 12);
  assert.equal(SIGN_GLYPHS_COMPLETE, true, "MaterialCommunityIcons trae los doce glifos");

  const vistos = new Map<number, string>();
  for (let index = 0; index < 12; index++) {
    const nombre = signGlyphName(index);
    // El nombre existe en el glyph map REAL del paquete.
    const esperado = BUNDLED_GLYPH_MAP[nombre];
    assert.equal(typeof esperado, "number", `${nombre} no está en el glyph map empaquetado`);

    // El codepoint que resuelve el dominio es exactamente ése.
    const cp = signGlyphCodepoint(index);
    assert.equal(cp, esperado, `${nombre} tiene que resolver al codepoint del paquete`);

    // Y es un glifo (un solo carácter), no un código de letras.
    const glifo = signGlyph(index);
    assert.equal(glifo, String.fromCodePoint(esperado as number));
    assert.equal([...(glifo as string)].length, 1, `${nombre} tiene que ser UN glifo`);
    assert.doesNotMatch(glifo as string, /[A-Za-z]/, `${nombre} no puede ser una abreviatura`);

    // Distinto de todos los demás: doce signos, doce glifos.
    assert.equal(vistos.has(cp as number), false, `${nombre} repite el codepoint de ${vistos.get(cp as number)}`);
    vistos.set(cp as number, nombre);
  }
  assert.equal(vistos.size, 12, "doce codepoints distintos");
});

test("los nombres de glifo son los doce del zodíaco, en orden de longitud eclíptica", () => {
  assert.deepEqual([...SIGN_GLYPH_NAMES], [
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
  ]);
  // Índice fuera de rango: se normaliza, no se rompe.
  assert.equal(signGlyphName(12), "zodiac-aries");
  assert.equal(signGlyphName(-1), "zodiac-pisces");
  assert.equal(signGlyph(12), signGlyph(0));
  assert.equal(signGlyph(-1), signGlyph(11));
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
  // Y el glifo que sale del nombre es el del font empaquetado.
  assert.equal(signGlyphForName("Capricornio"), String.fromCodePoint(BUNDLED_GLYPH_MAP["zodiac-capricorn"]));
  assert.equal(signGlyphForName("Piscis"), String.fromCodePoint(BUNDLED_GLYPH_MAP["zodiac-pisces"]));
  assert.equal(signGlyphForName("no es un signo"), null);
});

// --- El font: familia empaquetada, cargada y usada ---------------------------

test("la familia de símbolos es la que registra el paquete, y se toma de su API", () => {
  assert.equal(BUNDLED_FAMILY, "material-community", "el paquete registra esta familia");
  const glyphFont = readFileSync(join(ROOT, "src/theme/glyphFont.ts"), "utf8");
  // La familia y el asset NO se escriben a mano: salen de la API del paquete.
  assert.match(glyphFont, /MaterialCommunityIcons\.getFontFamily\(\)/);
  assert.match(glyphFont, /MaterialCommunityIcons\.font/);
  assert.doesNotMatch(sinComentarios(glyphFont), /"material-community"/, "la familia no se hardcodea");
});

test("el font de símbolos se carga por el camino de fuentes que ya existía", () => {
  const hook = readFileSync(join(ROOT, "src/hooks/useOrbitaFonts.ts"), "utf8");
  assert.match(hook, /GLYPH_FONT/, "useOrbitaFonts carga el font de símbolos");
  assert.match(hook, /useFonts\(/);
  // Y sigue cargando la mono, que es la que dibuja planetas y numerales.
  assert.ok(/RobotoMono_400Regular/.test(hook) && /RobotoMono_500Medium/.test(hook));
});

test("cada texto de la rueda declara una familia empaquetada", () => {
  const wheel = readFileSync(join(ROOT, "src/components/orbita/NatalWheel.tsx"), "utf8");
  const textos = wheel.match(/<SvgText[\s\S]*?>/g) ?? [];
  assert.ok(textos.length >= 4, "la rueda dibuja signos, casas, planetas y retro");
  for (const t of textos) {
    // Sin `fontFamily` el render cae al font del sistema: el bug original.
    assert.ok(
      /fontFamily=\{(orbita\.fonts\.(mono|monoMedium)|GLYPH_FONT_FAMILY)\}/.test(t),
      `SvgText sin familia empaquetada: ${t.slice(0, 80)}`
    );
  }
  // Los signos, específicamente, con el font de símbolos.
  assert.match(wheel, /fontFamily=\{GLYPH_FONT_FAMILY\}/);
  assert.match(wheel, /from "@\/theme\/glyphFont"/);
});

test("no queda ninguna tabla de glifos Unicode en las pantallas de la carta", () => {
  for (const rel of ["src/screens/CartaScreen.tsx", "src/components/orbita/GlyphRow.tsx"]) {
    const codigo = sinComentarios(readFileSync(join(ROOT, rel), "utf8"));
    assert.ok(!/PLANET_GLYPH|const GLYPHS/.test(codigo), `${rel} debe delegar en domain/astroSymbols`);
  }
});

// --- Planetas: códigos, con la limitación documentada ------------------------

test("cada cuerpo del payload tiene código ASCII y los ejes no se dibujan", () => {
  for (const [key, code] of Object.entries(BODY_CODES)) {
    assert.match(code, /^[A-Z]{2}$/, `${key} → ${code}`);
  }
  assert.equal(bodyCode({ key: "sun" }), "SO");
  assert.equal(bodyCode({ key: "pluto" }), "PL");
  assert.equal(isWheelBody("sun"), true);
  assert.equal(isWheelBody("ascendant"), false, "el Asc es un eje");
  assert.equal(isWheelBody("midheaven"), false, "el MC es un eje");
  assert.equal(isWheelBody("desconocido"), false);
  assert.equal(isWheelBody(undefined), false);
});

test("con una key desconocida se cae al nombre visible, no a un glifo", () => {
  assert.equal(bodyCode({ key: "quaoar", label: "Venus" }), "VE");
  assert.equal(bodyCode({ key: undefined, label: "Plutón" }), "PL");
  assert.equal(bodyCode({ label: "algo sin cuerpo" }), "SO");
});

test("gana el cuerpo que aparece primero en el texto", () => {
  assert.equal(bodyCodeForName("Venus armoniza tu Sol"), "VE");
  assert.equal(bodyCodeForName("Tu Sol recibe a Venus"), "SO");
  assert.equal(bodyCodeForName("Júpiter en tu casa 10"), "JU");
  assert.equal(bodyCodeForName("Jupiter sin acento"), "JU");
  assert.equal(bodyCodeForName("Medio cielo"), "MC");
  assert.equal(bodyCodeForName("sin cuerpos"), null);
});

test("la marca de retrogradación es ASCII", () => {
  assert.equal(RETROGRADE_CODE, "Rx");
  assert.ok(!PROHIBIDOS.test(RETROGRADE_CODE));
});

/**
 * Los planetas siguen siendo abreviaturas porque NINGÚN glyph map empaquetado
 * los cubre. El test lo comprueba contra el paquete real, así que la limitación
 * documentada es verificable y no una afirmación de buena fe.
 */
test("ningún font empaquetado cubre los planetas: la limitación es real y precisa", () => {
  const dir = join(VECTOR_ICONS, "build/vendor/react-native-vector-icons/glyphmaps");
  const maps = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.includes("_meta"));
  assert.equal(maps.length, 17, "se revisan los diecisiete glyph maps del paquete");

  // Sin glifo en NINGÚN set: por eso estos puntos no pueden dejar de ser código.
  const SIN_GLIFO = ["jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "part_of_fortune"];
  for (const f of maps) {
    const nombres = Object.keys(JSON.parse(readFileSync(join(dir, f), "utf8")));
    for (const planeta of SIN_GLIFO) {
      assert.equal(nombres.includes(planeta), false, `${f} sí trae "${planeta}": revisar la limitación documentada`);
    }
  }

  // Y MaterialCommunityIcons —el set que sí trae los signos— no trae ninguno.
  const mci = Object.keys(BUNDLED_GLYPH_MAP);
  assert.equal(mci.filter((k) => k.startsWith("zodiac-")).length, 12, "12/12 signos");
  for (const planeta of ["mercury", "venus", "mars", ...SIN_GLIFO]) {
    assert.equal(mci.includes(planeta), false, `MaterialCommunityIcons no tiene "${planeta}"`);
  }
});

test("la limitación de los planetas queda documentada en el módulo", () => {
  const src = readFileSync(join(ROOT, "src/domain/astroSymbols.ts"), "utf8");
  assert.match(src, /Limitación aceptada/);
  // Y se nombra el font que SÍ está empaquetado, en vez de negar que exista.
  assert.match(src, /MaterialCommunityIcons/);
  assert.match(src, /@expo\/vector-icons/);
});
