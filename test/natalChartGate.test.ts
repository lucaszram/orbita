import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  birthDataHash,
  canRenderPersonalWheel,
  chartMatchesBirthData,
  personalChartGate
} from "../src/domain/natalChartGate";

const ROOT = join(import.meta.dirname, "..");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const CARTA = readFileSync(join(ROOT, "src/screens/CartaScreen.tsx"), "utf8");
const CARTA_CARD = readFileSync(join(ROOT, "src/components/home/CartaCard.tsx"), "utf8");

/** Datos natales remotos completos (misma forma que `birthData.getCurrent`). */
const BIRTH = {
  _id: "bd_1",
  birthDate: "1994-04-12",
  birthTime: "10:40",
  birthTimePrecision: "known",
  birthPlaceLabel: "Rosario, Santa Fe, Argentina",
  latitude: -32.9468,
  longitude: -60.6393,
  timezone: "America/Argentina/Buenos_Aires"
};

/** Carta que coincide: mismo hash y mismo eco de datos en el payload. */
function chartFor(birth: typeof BIRTH, over: Record<string, unknown> = {}) {
  return {
    birthDataId: birth._id,
    birthDataHash: birthDataHash(birth) as string,
    payload: {
      birth: {
        birthDate: birth.birthDate,
        birthTime: birth.birthTime,
        birthTimePrecision: birth.birthTimePrecision,
        birthPlaceLabel: birth.birthPlaceLabel,
        latitude: birth.latitude,
        longitude: birth.longitude,
        timezone: birth.timezone
      },
      placements: [],
      houses: [],
      aspects: []
    },
    ...over
  };
}

// --- Datos incompletos: NUNCA una rueda -------------------------------------

test("mientras alguna query no resolvió no se afirma nada", () => {
  assert.equal(personalChartGate({ birth: undefined, chart: null }), "cargando");
  assert.equal(personalChartGate({ birth: BIRTH, chart: undefined }), "cargando");
  assert.equal(canRenderPersonalWheel(personalChartGate({ birth: undefined, chart: undefined })), false);
});

test("sin datos natales remotos no hay rueda, aunque exista una carta", () => {
  const gate = personalChartGate({ birth: null, chart: chartFor(BIRTH) });
  assert.equal(gate, "datosIncompletos");
  assert.equal(canRenderPersonalWheel(gate), false);
});

test("cada dato natal faltante bloquea la rueda por separado", () => {
  const casos: Array<[string, Record<string, unknown>]> = [
    ["sin fecha", { birthDate: undefined }],
    ["sin lugar", { birthPlaceLabel: undefined }],
    ["lugar de relleno", { birthPlaceLabel: "Sin especificar" }],
    ["sin coordenadas", { latitude: undefined, longitude: undefined }],
    ["coordenadas fuera de rango", { latitude: 120 }],
    ["sin zona", { timezone: "" }]
  ];
  for (const [nombre, parche] of casos) {
    const birth = { ...BIRTH, ...parche } as typeof BIRTH;
    // La carta se le pasa COMPLETA y coincidente a propósito: lo que bloquea es
    // el dato natal, no la falta de carta.
    const gate = personalChartGate({ birth, chart: chartFor(BIRTH) });
    assert.equal(gate, "datosIncompletos", nombre);
    assert.equal(canRenderPersonalWheel(gate), false, nombre);
  }
});

test("datos completos sin carta es vacío real, no rueda", () => {
  const gate = personalChartGate({ birth: BIRTH, chart: null });
  assert.equal(gate, "sinCarta");
  assert.equal(canRenderPersonalWheel(gate), false);
});

// --- La carta tiene que corresponder a esos datos ---------------------------

test("datos completos + carta que coincide: se dibuja", () => {
  const gate = personalChartGate({ birth: BIRTH, chart: chartFor(BIRTH) });
  assert.equal(gate, "listo");
  assert.equal(canRenderPersonalWheel(gate), true);
});

test("carta de datos ANTERIORES a una edición: no se dibuja", () => {
  // `upsertForCurrentUser` PATCHEA la misma fila, así que el `birthDataId` no
  // cambia: la carta vieja se ve idéntica salvo por el hash y el eco.
  const vieja = chartFor(BIRTH);
  const editada = { ...BIRTH, birthTime: "11:15" };
  const gate = personalChartGate({ birth: editada, chart: vieja });
  assert.equal(gate, "desactualizada");
  assert.equal(canRenderPersonalWheel(gate), false);
});

test("cambiar lugar, coordenadas o zona también invalida la carta", () => {
  for (const parche of [
    { birthPlaceLabel: "Córdoba, Argentina" },
    { latitude: -31.4201 },
    { longitude: -64.1888 },
    { timezone: "Europe/Madrid" },
    { birthDate: "1994-04-13" }
  ]) {
    const editada = { ...BIRTH, ...parche } as typeof BIRTH;
    assert.equal(
      personalChartGate({ birth: editada, chart: chartFor(BIRTH) }),
      "desactualizada",
      JSON.stringify(parche)
    );
  }
});

test("carta de OTRA fila natal: no se dibuja", () => {
  const ajena = chartFor(BIRTH, { birthDataId: "bd_otro" });
  assert.equal(personalChartGate({ birth: BIRTH, chart: ajena }), "desactualizada");
});

test("una carta sin ninguna prueba de correspondencia se trata como no coincidente", () => {
  // Sin `birthDataHash` y sin `payload.birth` no hay forma de verificar: la
  // dirección segura es NO dibujar.
  const sinPruebas = { birthDataId: BIRTH._id, payload: { placements: [], houses: [] } };
  assert.equal(chartMatchesBirthData(sinPruebas, BIRTH), false);
  assert.equal(personalChartGate({ birth: BIRTH, chart: sinPruebas }), "desactualizada");
});

test("un documento legado sin hash pero con eco coincidente sí se acepta", () => {
  const legado = chartFor(BIRTH) as Record<string, unknown>;
  delete legado.birthDataHash;
  assert.equal(chartMatchesBirthData(legado, BIRTH), true);
});

test("el eco del payload manda aunque el hash coincida", () => {
  // Hash correcto pero payload de otros datos: la carta que se DIBUJA es el
  // payload, así que gana el eco.
  const inconsistente = chartFor(BIRTH);
  inconsistente.payload.birth.birthDate = "1980-01-01";
  assert.equal(chartMatchesBirthData(inconsistente, BIRTH), false);
});

test("hora normalizada: 9:05 y 09:05 son el mismo dato", () => {
  const chart = chartFor({ ...BIRTH, birthTime: "09:05" });
  assert.equal(chartMatchesBirthData({ ...chart, birthDataHash: undefined }, { ...BIRTH, birthTime: "9:05" }), true);
});

test("con precisión desconocida el proveedor ignora la hora y la comparación también", () => {
  const birth = { ...BIRTH, birthTimePrecision: "unknown", birthTime: "10:40" };
  const chart = {
    birthDataId: birth._id,
    payload: {
      birth: {
        birthDate: birth.birthDate,
        birthTimePrecision: "unknown",
        birthPlaceLabel: birth.birthPlaceLabel,
        latitude: birth.latitude,
        longitude: birth.longitude,
        timezone: birth.timezone
      }
    }
  };
  assert.equal(chartMatchesBirthData(chart, birth), true);
});

test("el hash del cliente replica exactamente el del backend", () => {
  // Mismo orden de claves y mismo redondeo de coordenadas que
  // `convex/lib/birthDataConsistency.buildBirthDataHash`. Si divergieran, el
  // cliente rechazaría cartas válidas.
  const backend = readFileSync(join(ROOT, "convex/lib/birthDataConsistency.ts"), "utf8");
  const claves = [...backend.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]);
  const propias = Object.keys(JSON.parse(birthDataHash(BIRTH) as string));
  assert.deepEqual(propias, claves.slice(0, propias.length));
  assert.equal(
    birthDataHash(BIRTH),
    JSON.stringify({
      birthDate: "1994-04-12",
      birthTime: "10:40",
      birthTimePrecision: "known",
      birthPlaceLabel: "Rosario, Santa Fe, Argentina",
      latitude: -32.9468,
      longitude: -60.6393,
      timezone: "America/Argentina/Buenos_Aires"
    })
  );
});

test("sin precisión horaria el hash no existe y no puede servir de prueba", () => {
  assert.equal(birthDataHash({ ...BIRTH, birthTimePrecision: undefined }), null);
  const chart = chartFor(BIRTH);
  // El eco sigue alcanzando como prueba, pero un hash presente que no se puede
  // recalcular no se acepta a ciegas.
  assert.equal(chartMatchesBirthData(chart, { ...BIRTH, birthTimePrecision: undefined }), false);
});

// --- Cableado: las dos superficies pasan por el gate ------------------------

test("Carta y Perfil deciden la rueda con el MISMO gate, antes de mapear", () => {
  for (const [nombre, src] of [
    ["CartaScreen", CARTA],
    ["CartaCard", CARTA_CARD]
  ] as const) {
    const codigo = sinComentarios(src);
    assert.ok(/personalChartGate\(\{/.test(codigo), `${nombre} debe usar el gate compartido`);
    assert.ok(/birthData\.getCurrent/.test(codigo), `${nombre} necesita el dato natal remoto`);
    const gate = codigo.indexOf("personalChartGate({");
    const mapea = codigo.indexOf("mapNatalChart(doc)");
    assert.ok(gate !== -1 && mapea !== -1 && gate < mapea, `${nombre}: el gate va antes de mapear`);
    assert.ok(/chartGate === "desactualizada"/.test(codigo), `${nombre} tiene que cortar la carta stale`);
    assert.ok(/chartGate === "datosIncompletos"/.test(codigo), `${nombre} tiene que cortar los datos incompletos`);
  }
});

test("la única fuente de la carta sigue siendo charts.current", () => {
  for (const src of [CARTA, CARTA_CARD]) {
    const codigo = sinComentarios(src);
    assert.ok(/appApi\.charts\.current/.test(codigo));
    assert.ok(!/chartMock|natalMock|payloadMock/.test(codigo), "sin mocks de carta");
    assert.ok(!/createFallbackProfile/.test(codigo), "sin perfil inventado");
  }
});

test("la carta stale se recalcula por la action idempotente, no se dibuja", () => {
  const codigo = sinComentarios(CARTA);
  assert.ok(/calculateOrCreateNatalChart/.test(codigo), "hay camino de recálculo");
  const recalculo = codigo.indexOf("function RecalculateChart");
  const wheel = codigo.indexOf("<NatalWheel");
  assert.ok(recalculo !== -1 && recalculo < wheel, "el estado de recálculo no dibuja la rueda");
});

test("TODA superficie que dibuja la rueda pasa por el gate antes de mapear", () => {
  // Si una sola ruta se saltea el gate, la carta stale vuelve por ahí.
  for (const rel of ["app/recepcion.tsx", "app/carta-full.tsx", "app/reading/rueda.tsx"]) {
    const codigo = sinComentarios(readFileSync(join(ROOT, rel), "utf8"));
    assert.ok(/personalChartGate\(\{/.test(codigo), `${rel} debe usar el gate compartido`);
    assert.ok(/birthData\.getCurrent/.test(codigo), `${rel} necesita el dato natal remoto`);
    const gate = codigo.indexOf("personalChartGate({");
    const mapea = codigo.indexOf("mapNatalChart(");
    assert.ok(gate !== -1 && mapea !== -1 && gate < mapea, `${rel}: el gate va antes de mapear`);
    assert.ok(/chartGate === "listo"|chartGate !== "listo"/.test(codigo), `${rel} corta si la carta no coincide`);
  }
});
