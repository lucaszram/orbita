/**
 * El contrato de entrada de `mapNatalChart`.
 *
 * Incidente: un deploy volvió a publicar la carta en la forma legada
 * `payload.chart.normalized`, mientras el mapper sólo leía la forma plana
 * canónica `payload.*`. El documento llegaba entero, el mapper devolvía una
 * carta vacía y la app dibujaba una rueda en blanco con la tríada en guiones:
 * un error mudo, indistinguible de una carta real.
 *
 * Dos reglas, entonces: las dos formas se leen igual, y lo que no es una carta
 * TIRA. Las seis superficies que llaman al mapper ya envuelven la llamada en
 * `try/catch` para mostrar un estado honesto; degradar en silencio es lo único
 * que no pueden manejar.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { mapNatalChart } from "../src/domain/natalChart";

/** Carta normalizada real: Asc en Libra (185°), casas cada 30°. */
const NORMALIZED = {
  provider: "astrologyapi",
  calculationVersion: "orbita-natal-v1",
  houseSystem: "placidus",
  calculationTimeSource: "birth_time",
  placements: [
    { key: "sun", label: "Sol", sign: "aries", signEs: "Aries", degree: 22, fullDegree: 22, house: 7, isRetrograde: false },
    { key: "moon", label: "Luna", sign: "taurus", signEs: "Tauro", degree: 3, fullDegree: 33, house: 8, isRetrograde: false },
    { key: "mercury", label: "Mercurio", sign: "aries", signEs: "Aries", degree: 26, fullDegree: 26, house: 7, isRetrograde: true },
    { key: "venus", label: "Venus", sign: "leo", signEs: "Leo", degree: 8, fullDegree: 128, house: 11, isRetrograde: false },
    { key: "saturn", label: "Saturno", sign: "pisces", signEs: "Piscis", degree: 12, fullDegree: 342, house: 6, isRetrograde: false },
    { key: "ascendant", label: "Ascendente", sign: "libra", signEs: "Libra", degree: 5, fullDegree: 185, house: 1, isRetrograde: null }
  ],
  houses: Array.from({ length: 12 }, (_, i) => ({
    house: i + 1,
    sign: "libra",
    signEs: "Libra",
    degree: (185 + i * 30) % 360,
    theme: `área ${i + 1}`
  })),
  aspects: [
    { from: "sun", to: "moon", type: "square", typeEs: "cuadratura", orb: 1.2, isMajor: true },
    { from: "venus", to: "saturn", type: "trine", typeEs: "trígono", orb: 2.4, isMajor: true },
    { from: "mercury", to: "venus", type: "sextile", typeEs: "sextil", orb: 4.1, isMajor: false }
  ],
  summary: {
    title: "Estos son tus puntos de partida.",
    accuracy: "calculated",
    mainAspects: [
      { from: "sun", to: "moon", type: "square", typeEs: "cuadratura", orb: 1.2, isMajor: true },
      { from: "venus", to: "saturn", type: "trine", typeEs: "trígono", orb: 2.4, isMajor: true }
    ],
    limitations: []
  }
};

const clon = () => structuredClone(NORMALIZED) as Record<string, any>;

/** La forma plana: la carta directamente bajo `payload`. */
const plano = (chart: Record<string, unknown> = clon()) => ({ payload: chart });

/** La forma envuelta legada, aceptada temporalmente por defensa. */
const envuelto = (chart: Record<string, unknown> = clon()) => ({
  _id: "nc_1",
  calculationVersion: "orbita-natal-v1",
  providerVersion: "astrologyapi-2024",
  createdAt: 1,
  updatedAt: 2,
  access: { isPro: true, houses: true, aspects: true },
  payload: { chart: { version: "orbita-natal-v1", source: "astrologyapi", normalized: chart } }
});

/** Una posición cualquiera fuera de la lista. */
const sinPunto = (chart: Record<string, any>, key: string) => {
  chart.placements = chart.placements.filter((x: any) => x.key !== key);
  return chart;
};

// --- Las dos formas del contrato --------------------------------------------

test("la forma plana mapea la carta entera", () => {
  const payload = mapNatalChart(plano());
  assert.equal(payload.triad.sun.sign, "Aries");
  assert.equal(payload.triad.moon.sign, "Tauro");
  assert.equal(payload.triad.ascendant.sign, "Libra");
  assert.equal(payload.placements.length, 6, "los seis puntos, incluido el Asc");
  assert.equal(payload.houses.length, 12);
  assert.equal(payload.aspects.length, 3);
  assert.deepEqual(payload.mainAspects?.map((a) => `${a.from}/${a.to}`), ["Sol/Luna", "Venus/Saturno"]);
  assert.equal(payload.ascendantDegree, 185);
  assert.equal(payload.mc, 95);
  assert.match(payload.accuracy, /Hora exacta/);
});

test("la forma envuelta legada mapea la MISMA carta", () => {
  // El bug: `payload.chart.normalized` devolvía una carta vacía en silencio.
  assert.deepEqual(mapNatalChart(envuelto()), mapNatalChart(plano()));
});

test("la carta suelta, sin documento alrededor, también se lee", () => {
  assert.deepEqual(mapNatalChart(clon()), mapNatalChart(plano()));
});

test("la envoltura intermedia `payload.normalized` también se lee", () => {
  assert.deepEqual(mapNatalChart({ payload: { normalized: clon() } }), mapNatalChart(plano()));
});

// --- Lo que no es una carta tira --------------------------------------------

test("un documento que no es una carta se rechaza, no se degrada", () => {
  const casos: Array<[string, unknown]> = [
    ["undefined", undefined],
    ["null", null],
    ["un número", 0],
    ["un texto", "carta"],
    ["un array", []],
    ["objeto vacío", {}],
    ["payload null (el backend no pudo normalizar)", { payload: null }],
    ["payload de texto", { payload: "carta" }],
    ["payload vacío", { payload: {} }],
    ["payload sin posiciones", { payload: { houses: [], aspects: [], summary: {} } }],
    ["placements que no es array", { payload: { placements: "no" } }],
    ["envoltura sin normalized", { payload: { chart: {} } }],
    ["normalized null", { payload: { chart: { normalized: null } } }],
    ["normalized sin posiciones", { payload: { chart: { normalized: { houses: [] } } } }],
    ["lista de posiciones vacía", { payload: { placements: [] } }]
  ];

  for (const [nombre, doc] of casos) {
    assert.throws(() => mapNatalChart(doc), /NATAL_CHART_INVALID/, nombre);
  }
});

test("un payload null no se salva mirando el resto del documento", () => {
  // `payload: null` es el "no pude normalizar" explícito de `publicChartDocument`:
  // que el doc traiga una carta colgando de otra rama no lo vuelve válido.
  assert.throws(() => mapNatalChart({ payload: null, ...clon() }), /NATAL_CHART_INVALID/);
  assert.throws(() => mapNatalChart({ payload: {}, ...clon() }), /NATAL_CHART_INVALID/);
});

// --- Posiciones esenciales ---------------------------------------------------

test("sin Sol o sin Luna no hay carta, con hora natal o sin ella", () => {
  for (const key of ["sun", "moon"]) {
    assert.throws(() => mapNatalChart(plano(sinPunto(clon(), key))), /NATAL_CHART_INVALID/, key);
    assert.throws(() => mapNatalChart(envuelto(sinPunto(clon(), key))), /NATAL_CHART_INVALID/, `${key} envuelto`);

    const mediodia = sinPunto(clon(), key);
    mediodia.calculationTimeSource = "noon_fallback";
    assert.throws(() => mapNatalChart(plano(mediodia)), /NATAL_CHART_INVALID/, `${key} sin hora natal`);
  }
});

test("una posición esencial sin signo tampoco alcanza", () => {
  for (const key of ["sun", "moon", "ascendant"]) {
    const chart = clon();
    const punto = chart.placements.find((x: any) => x.key === key);
    punto.sign = "";
    punto.signEs = "";
    assert.throws(() => mapNatalChart(plano(chart)), /NATAL_CHART_INVALID/, key);
  }
});

test("con hora natal, un Ascendente ausente es un documento roto", () => {
  assert.throws(() => mapNatalChart(plano(sinPunto(clon(), "ascendant"))), /NATAL_CHART_INVALID/);
  assert.throws(() => mapNatalChart(envuelto(sinPunto(clon(), "ascendant"))), /NATAL_CHART_INVALID/);
});

test("sin hora natal el Ascendente no es obligatorio: la carta es aproximada", () => {
  // Con `noon_fallback` el backend no publica Asc ni casas a propósito
  // (`hasKnownTime` en `convex/lib/orbita.ts`). Eso es una carta válida.
  const chart = sinPunto(clon(), "ascendant");
  chart.calculationTimeSource = "noon_fallback";
  chart.houses = [];
  chart.summary.mainAspects = [];

  const payload = mapNatalChart(envuelto(chart));
  assert.equal(payload.triad.sun.sign, "Aries");
  assert.equal(payload.triad.moon.sign, "Tauro");
  assert.equal(payload.triad.ascendant.sign, "—");
  assert.equal(payload.ascendantDegree, undefined);
  assert.equal(payload.mc, undefined);
  assert.equal(payload.houses.length, 0);
  assert.match(payload.accuracy, /Hora aproximada/);
  assert.ok(!payload.placements.some((p) => p.key === "ascendant"), "el Asc no entra en la banda");
});

test("sin hora natal, un Asc que igual viniera no se dibuja ni ancla la rueda", () => {
  const chart = clon();
  chart.calculationTimeSource = "noon_fallback";
  const payload = mapNatalChart(envuelto(chart));
  assert.equal(payload.triad.ascendant.sign, "—");
  assert.equal(payload.ascendantDegree, undefined);
  assert.equal(payload.mc, undefined);
  assert.equal(payload.placements.length, 5, "el Asc sale de la lista");
});

// --- Casas y aspectos: el nivel Free sigue siendo una carta -----------------

test("el nivel Free (sin casas ni aspectos) es una carta válida, no un error", () => {
  // `publicChartDocument` vacía casas y aspectos para el usuario Free y deja
  // `house: null` en cada posición. La tríada tiene que seguir en pie.
  const chart = clon();
  chart.houses = [];
  chart.aspects = [];
  chart.summary.mainAspects = [];
  chart.placements = chart.placements.map((p: any) => ({ ...p, house: null }));
  chart.summary.ascendant = chart.placements.find((p: any) => p.key === "ascendant");

  const doc = envuelto(chart);
  doc.access = { isPro: false, houses: false, aspects: false };
  const payload = mapNatalChart(doc);

  assert.equal(payload.triad.sun.sign, "Aries");
  assert.equal(payload.triad.ascendant.sign, "Libra");
  assert.equal(payload.houses.length, 0);
  assert.equal(payload.aspects.length, 0);
  assert.equal(payload.mainAspects, undefined);
  assert.equal(payload.placements.length, 6);
  assert.equal(payload.placements[0].house, undefined, "`house: null` no es una casa");
  // Sin casas, el ancla de la rueda sale del resumen.
  assert.equal(payload.ascendantDegree, 185);
  assert.equal(payload.mc, undefined);
  assert.match(payload.accuracy, /Hora exacta/);
});

test("las casas y los aspectos conservan su forma y su traducción", () => {
  const payload = mapNatalChart(envuelto());
  assert.deepEqual(payload.houses[0], { house: 1, sign: "Libra", cusp: 185, theme: "área 1" });
  assert.deepEqual(payload.aspects[0], {
    from: "Sol",
    to: "Luna",
    type: "square",
    typeEs: "cuadratura",
    harmony: "tension",
    orb: 1.2,
    isMajor: true
  });
  assert.equal(payload.aspects[1].harmony, "harmony", "el trígono es armónico");
  assert.equal(payload.limitations.length, 0);
});

test("un aspecto contra un punto que la carta no trae se descarta", () => {
  const chart = clon();
  chart.aspects.push({ from: "sun", to: "pluto", type: "trine", typeEs: "trígono", orb: 1, isMajor: true });
  const payload = mapNatalChart(envuelto(chart));
  assert.equal(payload.aspects.length, 3, "el aspecto huérfano no entra");
});

test("entradas basura dentro de las listas se descartan sin tirar la carta", () => {
  const chart = clon();
  chart.placements.push(null, "planeta", 7);
  chart.houses.push(null);
  chart.aspects.push(null);
  chart.summary.mainAspects.push(null);

  const payload = mapNatalChart(envuelto(chart));
  assert.equal(payload.placements.length, 6);
  assert.equal(payload.houses.length, 12);
  assert.equal(payload.aspects.length, 3);
  assert.equal(payload.mainAspects?.length, 2);
});

test("un resumen ausente o malformado no invalida la carta", () => {
  for (const summary of [undefined, null, "resumen", []]) {
    const chart = clon();
    chart.summary = summary;
    const payload = mapNatalChart(envuelto(chart));
    assert.equal(payload.ascendantDegree, 185, "el ancla sale de la casa 1");
    assert.equal(payload.mainAspects, undefined);
    assert.deepEqual(payload.limitations, []);
  }
});

test("las limitaciones del backend se pasan tal cual", () => {
  const chart = clon();
  chart.calculationTimeSource = "noon_fallback";
  chart.summary.limitations = ["Sin hora natal exacta: ascendente, casas y Luna pueden quedar aproximados."];
  const payload = mapNatalChart(envuelto(chart));
  assert.deepEqual(payload.limitations, chart.summary.limitations);
});
