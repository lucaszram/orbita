import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  TAROT_LIMITE_FREE,
  revealErrorNote,
  umbralTarotHero
} from "../src/components/web/umbral-tarot-state";

/**
 * Red sobre el CABLEADO, no sobre la lógica.
 *
 * Existe por un bug real: `VoidLive` destructuraba `sectionLabel` y `belowHeader`
 * y no se los pasaba a `VoidView`, que es quien los dibuja. Como las dos props
 * son opcionales, `tsc` no dijo nada; el CI —typecheck, tests y export— pasó en
 * verde con la feature muerta: el selector no se renderizaba y Tarot quedaba
 * inalcanzable. Ningún test de lógica pura puede ver eso.
 *
 * Es una comprobación estática del texto fuente, con la misma idea que
 * `test/moduleGraph.ts`: hay garantías que son de ALCANCE y no de valor.
 */

const ROOT = resolve(import.meta.dirname, "..");
const src = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** El bloque JSX de `<Nombre ... />`, para mirar qué props recibe de verdad. */
function jsxProps(source: string, component: string): string {
  const open = source.indexOf(`<${component}`);
  assert.notEqual(open, -1, `no se encontró <${component} en el fuente`);
  const close = source.indexOf("/>", open);
  assert.notEqual(close, -1, `<${component} no cierra con />`);
  return source.slice(open, close);
}

test("VoidLive le pasa a VoidView las dos props del slot del Umbral", () => {
  const s = src("src/components/void/VoidExperience.tsx");
  const props = jsxProps(s, "VoidView");
  assert.match(props, /sectionLabel=\{sectionLabel\}/);
  assert.match(props, /belowHeader=\{belowHeader\}/);
});

test("VoidExperience le pasa a VoidLive las dos props del slot", () => {
  const s = src("src/components/void/VoidExperience.tsx");
  const props = jsxProps(s, "VoidLive");
  assert.match(props, /sectionLabel=\{sectionLabel\}/);
  assert.match(props, /belowHeader=\{belowHeader\}/);
});

test("VoidView dibuja el nodo del slot y usa la etiqueta en su eyebrow", () => {
  const s = src("src/components/void/VoidExperience.tsx");
  assert.match(s, /\{belowHeader\}/, "el slot no se renderiza en ninguna parte");
  assert.match(s, /sectionLabel \? `EL UMBRAL · \$\{sectionLabel\}`/);
});

test("el Umbral web le pasa el selector a sus dos secciones", () => {
  const s = src("src/components/web/umbral-sections.tsx");
  const void_ = jsxProps(s, "VoidExperience");
  assert.match(void_, /sectionLabel="PREGUNTAR"/);
  assert.match(void_, /belowHeader=\{selector\}/);
  assert.match(jsxProps(s, "UmbralTarot"), /selector=\{selector\}/);
});

test("el panel de Tarot dibuja el selector que recibe", () => {
  assert.match(src("src/components/web/umbral-tarot.tsx"), /\{selector\}/);
});

test("el ritual conserva el copy del frame", () => {
  // El rótulo va encima de la carta, con el texto del frame T2.
  const props = jsxProps(src("src/components/web/umbral-tarot.tsx"), "CartaDelDia");
  assert.match(props, /TOCÁ PARA DARLA VUELTA/);
});

test("el encabezado anuncia el ritual mientras la carta está cerrada", () => {
  assert.deepEqual(umbralTarotHero({ mode: "cerrada" }), {
    tagline: "Tu carta de hoy.",
    micro: "UNA CARTA POR DÍA"
  });
  assert.deepEqual(umbralTarotHero({ mode: "cargando", nombre: "La Estrella", roman: "XVII" }), {
    tagline: "Tu carta de hoy.",
    micro: "UNA CARTA POR DÍA"
  });
});

test("revelada, el encabezado nombra la carta con su arcano", () => {
  assert.deepEqual(umbralTarotHero({ mode: "revelada", nombre: "La Estrella", roman: "XVII" }), {
    tagline: "La Estrella",
    micro: "ARCANO XVII · CARTA DEL DÍA"
  });
});

test("un arcano menor no tiene numeral y no inventa uno", () => {
  assert.deepEqual(umbralTarotHero({ mode: "revelada", nombre: "Tres de Copas" }), {
    tagline: "Tres de Copas",
    micro: "CARTA DEL DÍA"
  });
});

test("revelada sin nombre todavía no puede anunciar la carta", () => {
  assert.equal(umbralTarotHero({ mode: "revelada" }).tagline, "Tu carta de hoy.");
});

test("un fallo desconocido se nombra en vez de fallar mudo", () => {
  // El bug que costó una sesión de depuración: el rechazo se tragaba en
  // silencio, la carta volvía al dorso y era indistinguible de un bug.
  assert.equal(revealErrorNote("desconocido"), "No pudimos dar vuelta tu carta. Probá de nuevo.");
  assert.equal(revealErrorNote(null), null);
  // El límite ya no usa la línea suelta: tiene el bloque del frame T5.
  assert.equal(revealErrorNote("limite_free"), null);
});

test("con el límite alcanzado el encabezado explica por qué no gira", () => {
  const h = umbralTarotHero({ mode: "cerrada", limite: true });
  assert.deepEqual(h, { tagline: "Usaste tus siete cartas.", micro: "FREE · SIETE DE SIETE" });
  // Gana sobre el estado revelado: es lo único que explica el bloqueo.
  assert.equal(umbralTarotHero({ mode: "revelada", nombre: "El Sol", roman: "XIX", limite: true }).tagline,
               "Usaste tus siete cartas.");
});

test("el bloque del límite explica el plan sin agregar un segundo botón", () => {
  assert.match(TAROT_LIMITE_FREE.titulo, /siete cartas/);
  assert.match(TAROT_LIMITE_FREE.detalle, /una carta cada día/);
  assert.equal(TAROT_LIMITE_FREE.cta, "DESBLOQUEAR TAROT DIARIO");
  const s = src("src/components/web/umbral-tarot.tsx");
  // La salida es el dorso: `ctaMode="unlock"`, y ningún Pressable propio.
  assert.match(jsxProps(s, "CartaDelDia"), /ctaMode=\{limite \? "unlock" : "reveal"\}/);
  assert.doesNotMatch(s, /<Pressable/);
});

test("el panel loguea TODO rechazo, incluido el esperable", () => {
  const s = src("src/components/web/umbral-tarot.tsx");
  const pull = s.slice(s.indexOf("async function pull"), s.indexOf("return (", s.indexOf("async function pull")));
  assert.match(pull, /console\.warn/);
  // La regresión concreta: el `console.warn` no puede quedar detrás de un
  // condicional que excluya el límite.
  assert.doesNotMatch(pull, /!==\s*"limite_free"/);
  assert.match(pull, /setRevealError\(kind\)/);
});
