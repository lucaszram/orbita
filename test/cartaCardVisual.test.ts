/**
 * Hotfix visual de la tarjeta de Carta natal (Perfil / Home).
 *
 * Dos regresiones reales, vistas en producción sobre la misma tarjeta:
 *
 *  1. El HUECO. `MeasuredSquare` mide su contenedor con `onLayout` y hasta no
 *     tener una medida real no dibuja nada, sólo reserva el alto del tope. Si el
 *     contenedor no declara ancho propio, adentro de un `Pressable` con
 *     `alignItems: "center"` se encoge a su contenido —que arranca vacío—, el
 *     ancho medido queda en 0 y la rueda no aparece NUNCA: queda un rectángulo
 *     vacío de 232 px de alto donde debía estar la mini rueda.
 *
 *  2. Los CÓDIGOS. La tríada se leía como `SO / LU / AC` en vez de los glifos
 *     vectoriales de Sol, Luna y Ascendente.
 *
 * Las dos se cubren acá sobre el archivo real, en el mismo estilo estático que
 * el resto de la suite: el bug era de estilos y de cableado, no de lógica.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ASTRO_GLYPHS, astroGlyphDef } from "../src/domain/astroGlyphs";
import { PLACEMENT_BODY_SYMBOL } from "../src/domain/astroSymbols";

const ROOT = join(import.meta.dirname, "..");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const fuente = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const CARTA_CARD = sinComentarios(fuente("src/components/home/CartaCard.tsx"));
const TRIAD_LINE = sinComentarios(fuente("src/components/orbita/TriadLine.tsx"));

/** Cuerpo de una entrada de `StyleSheet.create` por nombre. */
const estilo = (codigo: string, nombre: string): string => {
  const match = codigo.match(new RegExp(String.raw`\n\s*${nombre}:\s*\{([^}]*)\}`));
  if (!match) assert.fail(`no encontré el estilo \`${nombre}\``);
  return match[1];
};

// --- 1. El contenedor de la rueda: ancho medible ----------------------------

test("el contenedor de la mini rueda declara ancho propio: no se encoge a cero", () => {
  const wrap = estilo(CARTA_CARD, "wheelWrap");
  assert.match(wrap, /width: "100%"/, "sin ancho, `MeasuredSquare` mide 0 y la rueda no se dibuja nunca");
  assert.match(wrap, /alignSelf: "stretch"/, "y se estira contra la tarjeta, que es quien tiene ancho definido");
});

test("el wrap NO centra: `alignItems: center` + `width: 100%` es la combinación que colapsa", () => {
  // Misma regla que ya está documentada en `ContentCanvas`: el centrado lo pone
  // la caja medida, no su contenedor.
  assert.doesNotMatch(estilo(CARTA_CARD, "wheelWrap"), /alignItems/);
  const square = sinComentarios(fuente("src/components/orbita/ContentCanvas.tsx"));
  assert.match(estilo(square, "square"), /alignItems: "center"/, "`MeasuredSquare` centra su propio contenido");
});

test("la tarjeta que envuelve la rueda sigue centrando el resto de su contenido", () => {
  // El `alignItems: "center"` de la tarjeta se conserva (eyebrow, tríada, CTA);
  // lo que cambió es que el wrap ya no depende de él para tener ancho.
  assert.match(estilo(CARTA_CARD, "card"), /alignItems: "center"/);
  assert.match(estilo(CARTA_CARD, "hero"), /alignItems: "center"/);
});

test("la mini rueda conserva el tope de 232 y sale de la medición del contenedor", () => {
  assert.match(CARTA_CARD, /<MeasuredSquare max=\{232\}>/, "el tope no cambia con el hotfix");
  assert.match(CARTA_CARD, /<NatalWheel payload=\{payload!\} size=\{size\} \/>/, "el lado viene del callback");
  assert.doesNotMatch(CARTA_CARD, /useWindowDimensions|Dimensions\.get|window\.inner/, "nunca por viewport");
});

test("los estados reservan el mismo alto que la rueda y centran solos", () => {
  const zona = estilo(CARTA_CARD, "stateZone");
  assert.match(zona, /height: 232/, "mismo alto que la rueda: el contenido no salta al resolver");
  assert.match(zona, /justifyContent: "center"/);
  // Al sacarle el centrado al wrap, el spinner tiene que centrarlo esta zona.
  assert.match(zona, /alignItems: "center"/, "sin esto el spinner de carga queda pegado a la izquierda");
  const usos = CARTA_CARD.match(/\[styles\.wheelWrap, styles\.stateZone\]/g) ?? [];
  assert.equal(usos.length, 3, "carga de sesión, carga del gate y carga de la carta");
});

// --- 2. La tríada: glifos vectoriales, no códigos ---------------------------

test("la tríada de la tarjeta se dibuja con el catálogo vectorial", () => {
  assert.match(CARTA_CARD, /import \{ TriadLine \} from "@\/components\/orbita\/TriadLine";/);
  for (const symbol of ["sun", "moon", "ascendant"]) {
    assert.match(
      CARTA_CARD,
      new RegExp(String.raw`\{ symbol: "${symbol}", label: t\.\w+\.sign \}`),
      `falta la unidad de ${symbol} con su signo real`
    );
  }
  assert.match(TRIAD_LINE, /<AstroGlyph symbol=\{u\.symbol\}/, "cada unidad dibuja el glifo del catálogo");
});

test("Sol, Luna y Ascendente tienen dibujo propio en el catálogo", () => {
  for (const key of ["sun", "moon", "ascendant"] as const) {
    const def = astroGlyphDef(key);
    assert.equal(def, ASTRO_GLYPHS[key]);
    const primitivas = (def.strokes?.length ?? 0) + (def.rings?.length ?? 0) + (def.dots?.length ?? 0);
    assert.ok(primitivas >= 1, `${key} no dibuja nada`);
  }
  // La tríada del dominio y las unidades de la tarjeta nombran los mismos glifos.
  assert.deepEqual(Object.values(PLACEMENT_BODY_SYMBOL).sort(), ["ascendant", "moon", "sun"]);
});

test("la tarjeta no vuelve a los códigos de dos letras SO / LU / AC", () => {
  // Cualquier aparición como token suelto: `"SO"`, `>AC<`, `SO · LU · AC`.
  const hit = CARTA_CARD.match(/(?:^|[^A-Za-z])(SO|LU|AC)(?:[^A-Za-z]|$)/);
  assert.equal(hit, null, `la tarjeta contiene el código ${JSON.stringify(hit?.[1])}`);
  assert.doesNotMatch(CARTA_CARD, /\bbodyCode\b|\bBODY_CODES\b/, "ni la API vieja de códigos");
});
