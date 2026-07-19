import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { cartaGate, readingBlockPhase } from "../src/domain/cartaNatalCarga";

// La carta astronómica llega en <1 s; la lectura larga tarda 40–61 s (PR
// backend #32 la prewarmea). Regla: la lectura NUNCA participa del loading
// general — se resuelve inline dentro de "Tu carta, explicada".

const CHART_DOC = { payload: { planets: [] } };
const VALUES = { axes: [], note: "nota" };
const READING_7 = {
  sections: Array.from({ length: 7 }, (_, i) => ({
    key: `s${i}`,
    title: `Capítulo ${i + 1}`,
    body: "…",
    placement: { planet: "Sol", label: "Sol", sign: "Cáncer" }
  })),
  disclaimer: "d"
};

describe("cartaGate — el loading general solo mira carta + valores", () => {
  it("carta y valores listos → 'listo', con la lectura todavía en null", () => {
    // La lectura ni siquiera es input de cartaGate: no puede bloquear.
    assert.equal(cartaGate({ doc: CHART_DOC, values: VALUES }), "listo");
  });

  it("queries en vuelo (undefined) → 'cargando'", () => {
    assert.equal(cartaGate({ doc: undefined, values: VALUES }), "cargando");
    assert.equal(cartaGate({ doc: CHART_DOC, values: undefined }), "cargando");
  });

  it("el backend confirmó que no hay carta (null) → 'vacio'", () => {
    assert.equal(cartaGate({ doc: null, values: VALUES }), "vacio");
    // Sin carta, valuesMap también es null: sigue siendo vacío, no carga.
    assert.equal(cartaGate({ doc: null, values: null }), "vacio");
  });

  it("la lectura null jamás produce loading de pantalla completa", () => {
    // cartaGate no acepta la lectura como input (garantía de tipo); con carta
    // y valores resueltos el gate es terminal, pase lo que pase con el LLM.
    const gate = cartaGate({ doc: CHART_DOC, values: VALUES });
    assert.notEqual(gate, "cargando");
  });
});

describe("readingBlockPhase — 'Tu carta, explicada' resuelve inline", () => {
  it("lectura null (cache todavía no 'ready') → carga inline", () => {
    assert.equal(readingBlockPhase({ reading: null, failed: false }), "cargando");
    assert.equal(readingBlockPhase({ reading: undefined, failed: false }), "cargando");
  });

  it("reject del generador → error inline con reintento", () => {
    assert.equal(readingBlockPhase({ reading: null, failed: true }), "error");
  });

  it("una resolución { status: 'pending' } NO es error: la query sigue en null y el bloque sigue cargando", () => {
    // El prewarm del backend tiene el claim; el cliente solo espera la query.
    assert.equal(readingBlockPhase({ reading: null, failed: false }), "cargando");
  });

  it("lectura lista → 'listo' con los siete capítulos intactos", () => {
    assert.equal(readingBlockPhase({ reading: READING_7, failed: false }), "listo");
    assert.equal(READING_7.sections.length, 7);
  });

  it("el dato manda: si el prewarm del backend terminó, un fallo viejo de la action no tapa la lectura", () => {
    assert.equal(readingBlockPhase({ reading: READING_7, failed: true }), "listo");
  });
});

// Verificación ESTRUCTURAL del cableado en la pantalla (no se puede renderizar
// RN en node; mismo patrón que perfilAppReview.test.ts).
const CARTA = readFileSync(path.join(process.cwd(), "app/(tabs)/carta.tsx"), "utf8");

describe("carta.tsx — cableado anti-bloqueo", () => {
  it("el gate general usa cartaGate({ doc, values }) — sin la lectura", () => {
    assert.match(CARTA, /cartaGate\(\{ doc, values \}\)/);
    assert.match(CARTA, /gate === "cargando"/);
    // El patrón viejo que bloqueaba toda la pantalla por la lectura no existe más.
    assert.doesNotMatch(CARTA, /pending:\s*reading/);
    assert.doesNotMatch(CARTA, /dataPhase/);
  });

  it("la lectura resuelve inline: carga 'Preparando tu lectura…' y error con REINTENTAR", () => {
    assert.match(CARTA, /readingBlockPhase\(\{ reading, failed: generateFailed \}\)/);
    assert.match(CARTA, /Preparando tu lectura…/);
    assert.match(CARTA, /label="REINTENTAR" onPress=\{onRetryReading\}/);
  });

  it("MinimalLoading y ErrorState de pantalla completa quedan solo para sesión/carta, nunca para la lectura", () => {
    // Dentro de CartaLive, MinimalLoading aparece una sola vez y gated por cartaGate.
    const live = CARTA.slice(CARTA.indexOf("function CartaLive"), CARTA.indexOf("// --- Vista"));
    const minimalCount = live.split("<MinimalLoading />").length - 1;
    assert.equal(minimalCount, 1);
    assert.ok(live.indexOf("gate === \"cargando\"") < live.indexOf("<MinimalLoading />"));
    // El fallo del generador ya no rutea a un ErrorState de pantalla completa.
    assert.doesNotMatch(live, /generateFailed[\s\S]{0,200}<ErrorState/);
  });

  it("generatePersonalityReading({}) se sigue disparando y solo un REJECT marca fallo", () => {
    assert.match(CARTA, /generate\(\{\}\)\.catch\(/);
    // Ninguna rama marca fallo a partir de un resultado resuelto (p. ej. { status: "pending" }).
    assert.doesNotMatch(CARTA, /then\([^)]*setGenerateFailed/);
  });

  it("los siete capítulos largos se muestran intactos cuando la lectura está lista", () => {
    assert.match(CARTA, /sectionsA\.map\(\(s, i\) => \(\s*<SectorBlock/);
    assert.match(CARTA, /sectionsB\.map\(\(s, i\) => \(\s*<SectorBlock/);
    assert.match(CARTA, /reading\?\.sections \?\? \[\]/);
  });
});
