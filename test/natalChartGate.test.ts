import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { canRenderPersonalWheel, personalChartGate } from "../src/domain/natalChartGate";
import { ROOT, resolveEntryForPlatform } from "./moduleGraph";

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

/**
 * Documento público de `charts.current`, tal como lo sanitiza el backend:
 * SIN `birthDataId`, SIN `birthDataHash` y SIN `payload.birth`.
 */
const PUBLIC_CHART = {
  payload: {
    placements: [],
    houses: [],
    aspects: []
  }
};

// --- Datos incompletos: NUNCA una rueda -------------------------------------

test("mientras alguna query no resolvió no se afirma nada", () => {
  assert.equal(personalChartGate({ birth: undefined, chart: null }), "cargando");
  assert.equal(personalChartGate({ birth: BIRTH, chart: undefined }), "cargando");
  assert.equal(canRenderPersonalWheel(personalChartGate({ birth: undefined, chart: undefined })), false);
});

test("sin datos natales remotos no hay rueda, aunque exista una carta", () => {
  const gate = personalChartGate({ birth: null, chart: PUBLIC_CHART });
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
    // La carta se le pasa no nula a propósito: lo que bloquea es el dato
    // natal, no la falta de carta.
    const gate = personalChartGate({ birth, chart: PUBLIC_CHART });
    assert.equal(gate, "datosIncompletos", nombre);
    assert.equal(canRenderPersonalWheel(gate), false, nombre);
  }
});

test("datos completos sin carta es vacío real, no rueda", () => {
  const gate = personalChartGate({ birth: BIRTH, chart: null });
  assert.equal(gate, "sinCarta");
  assert.equal(canRenderPersonalWheel(gate), false);
});

// --- charts.current es autoritativo: carta no nula = la carta vigente -------

test("datos completos + carta no nula del backend: se dibuja", () => {
  const gate = personalChartGate({ birth: BIRTH, chart: PUBLIC_CHART });
  assert.equal(gate, "listo");
  assert.equal(canRenderPersonalWheel(gate), true);
});

test("la carta pública sanitizada (sin id, hash ni eco de datos) es listo", () => {
  // Regresión del recálculo infinito: el contrato público omite adrede
  // `birthDataId`, `birthDataHash` y `payload.birth`. Que falten esas "pruebas"
  // NO puede degradar la carta a desactualizada.
  for (const chart of [
    PUBLIC_CHART,
    { payload: { placements: [], houses: [] } },
    {} as { payload?: unknown }
  ]) {
    assert.equal(personalChartGate({ birth: BIRTH, chart }), "listo");
  }
});

test("editar los datos natales no hace que el cliente dude de charts.current", () => {
  // `charts.current` sólo devuelve la carta del cacheKey exacto de los datos
  // vigentes: si tras una edición sigue devolviendo una carta no nula, ESA es
  // la carta actual. El cliente no re-verifica correspondencia por su cuenta.
  const editada = { ...BIRTH, birthTime: "11:15", birthPlaceLabel: "Córdoba, Argentina" };
  const gate = personalChartGate({ birth: editada, chart: PUBLIC_CHART });
  assert.equal(gate, "listo");
  assert.equal(canRenderPersonalWheel(gate), true);
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

test("el cliente no reconstruye el hash de datos natales del backend", () => {
  // El hash del backend es una serialización de los datos natales: replicarlo
  // en el cliente era la fuente del falso "desactualizada" y un riesgo de
  // filtrar datos. El gate no debe volver a calcularlo ni compararlo.
  const gateSrc = sinComentarios(readFileSync(join(ROOT, "src/domain/natalChartGate.ts"), "utf8"));
  assert.ok(!/birthDataHash/.test(gateSrc), "el gate no usa birthDataHash");
  assert.ok(!/chartMatchesBirthData/.test(gateSrc), "el gate no re-verifica correspondencia");
});

test("el estado sin carta se recalcula por la action idempotente, no se dibuja", () => {
  const codigo = sinComentarios(CARTA);
  assert.ok(/calculateOrCreateNatalChart/.test(codigo), "hay camino de recálculo");
  const recalculo = codigo.indexOf("function RecalculateChart");
  const wheel = codigo.indexOf("<NatalWheel");
  assert.ok(recalculo !== -1 && recalculo < wheel, "el estado de recálculo no dibuja la rueda");
});

test("TODA superficie que dibuja la rueda pasa por el gate antes de mapear", () => {
  // Si una sola ruta se saltea el gate, la carta de otros datos vuelve por ahí.
  for (const entry of ["app/recepcion.tsx", "app/carta-full.tsx", "app/reading/rueda.tsx"]) {
    const implementacion = resolveEntryForPlatform(entry, "web");
    const rel = relative(ROOT, implementacion);
    const codigo = sinComentarios(readFileSync(implementacion, "utf8"));
    assert.ok(/personalChartGate\(\{/.test(codigo), `${entry} → ${rel} debe usar el gate compartido`);
    assert.ok(/birthData\.getCurrent/.test(codigo), `${entry} → ${rel} necesita el dato natal remoto`);
    const gate = codigo.indexOf("personalChartGate({");
    const mapea = codigo.indexOf("mapNatalChart(");
    assert.ok(gate !== -1 && mapea !== -1 && gate < mapea, `${entry} → ${rel}: el gate va antes de mapear`);
    assert.ok(
      /chartGate === "listo"|chartGate !== "listo"/.test(codigo),
      `${entry} → ${rel} corta si la carta no coincide`
    );
  }
});
