import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BODY_CODES,
  bodyCode,
  bodyCodeForName,
  isWheelBody,
  RETROGRADE_CODE,
  SIGN_CODES,
  signCode,
  signCodeForName
} from "../src/domain/astroSymbols";

const ROOT = join(import.meta.dirname, "..");
/** Los comentarios NOMBRAN los glifos viejos a propósito (documentan el bug). */
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

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

test("los símbolos de la rueda se dibujan con la mono EMPAQUETADA", () => {
  const wheel = readFileSync(join(ROOT, "src/components/orbita/NatalWheel.tsx"), "utf8");
  // Cada `SvgText` de la rueda declara familia: sin `fontFamily` el render cae
  // al font del sistema, que es exactamente el problema que se elimina.
  const textos = wheel.match(/<SvgText[\s\S]*?>/g) ?? [];
  assert.ok(textos.length >= 4, "la rueda dibuja signos, casas, planetas y retro");
  for (const t of textos) {
    assert.ok(/fontFamily=\{orbita\.fonts\.(mono|monoMedium)\}/.test(t), `SvgText sin la mono: ${t.slice(0, 60)}`);
  }
  // Y las familias empaquetadas son las tres del sistema Órbita.
  const hook = readFileSync(join(ROOT, "src/hooks/useOrbitaFonts.ts"), "utf8");
  assert.ok(/RobotoMono_400Regular/.test(hook) && /RobotoMono_500Medium/.test(hook));
});

test("no queda ninguna tabla de glifos Unicode en las pantallas de la carta", () => {
  for (const rel of ["src/screens/CartaScreen.tsx", "src/components/orbita/GlyphRow.tsx"]) {
    const codigo = sinComentarios(readFileSync(join(ROOT, rel), "utf8"));
    assert.ok(!/PLANET_GLYPH|const GLYPHS/.test(codigo), `${rel} debe delegar en domain/astroSymbols`);
  }
});

// --- El mapeo -----------------------------------------------------------------

test("los doce signos tienen código, en orden de longitud eclíptica", () => {
  assert.equal(SIGN_CODES.length, 12);
  assert.equal(new Set(SIGN_CODES).size, 12, "sin códigos repetidos");
  assert.equal(signCode(0), "ARI");
  assert.equal(signCode(4), "LEO");
  assert.equal(signCode(11), "PIS");
  // Índice fuera de rango: se normaliza, no se rompe.
  assert.equal(signCode(12), "ARI");
  assert.equal(signCode(-1), "PIS");
  for (const c of SIGN_CODES) assert.match(c, /^[A-Z]{3}$/, `${c} tiene que ser ASCII`);
});

test("los nombres de signo se reconocen con y sin acento, en es y en", () => {
  assert.equal(signCodeForName("Géminis"), "GEM");
  assert.equal(signCodeForName("geminis"), "GEM");
  assert.equal(signCodeForName("Gemini"), "GEM");
  assert.equal(signCodeForName("Escorpio"), "ESC");
  assert.equal(signCodeForName("Scorpio"), "ESC");
  assert.equal(signCodeForName("Capricornio"), "CAP");
  assert.equal(signCodeForName("—"), null);
  assert.equal(signCodeForName(undefined), null);
});

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

test("la limitación aceptada queda documentada en el módulo", () => {
  const src = readFileSync(join(ROOT, "src/domain/astroSymbols.ts"), "utf8");
  assert.match(src, /Limitación aceptada/);
  assert.match(src, /assets\//, "se documenta que no hay tipografía de símbolos empaquetada");
});
