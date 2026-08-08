import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPublicNatalChartDocument } from "../convex/lib/publicNatalChart";
import { mapNatalChart } from "../src/domain/natalChart";

const normalized = {
  birth: {
    birthDate: "1996-11-11",
    birthTime: "10:32",
    birthPlaceLabel: "Ciudad Autónoma de Buenos Aires, Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires"
  },
  timezoneOffset: -3,
  calculationTimeSource: "birth_time",
  placements: [
    { key: "sun", label: "Sol", sign: "scorpio", signEs: "Escorpio", degree: 19.44, fullDegree: 229.44, house: 10 },
    { key: "moon", label: "Luna", sign: "scorpio", signEs: "Escorpio", degree: 24.32, fullDegree: 234.32, house: 11 },
    { key: "ascendant", label: "Ascendente", sign: "capricorn", signEs: "Capricornio", degree: 28.37, fullDegree: 298.37, house: 1 }
  ],
  houses: [
    { house: 1, sign: "capricorn", signEs: "Capricornio", degree: 298.37 },
    { house: 10, sign: "scorpio", signEs: "Escorpio", degree: 228.37 }
  ],
  aspects: [
    { from: "sun", to: "moon", type: "conjunction", typeEs: "conjunción", orb: 4.88, isMajor: true }
  ],
  summary: {
    sun: null,
    moon: null,
    ascendant: null,
    mainAspects: [
      { from: "sun", to: "moon", type: "conjunction", typeEs: "conjunción", orb: 4.88, isMajor: true }
    ],
    limitations: []
  }
};

const storedChart = {
  _id: "chart_existing",
  calculationVersion: "astrologyapi-western-chart-v1",
  providerVersion: "astrologyapi-western-v1",
  createdAt: 1_723_000_000_000,
  updatedAt: 1_723_000_100_000,
  payload: normalized
};

test("charts.current Plus entrega el contrato plano y el mapper recupera la carta realista", () => {
  const publicDoc = buildPublicNatalChartDocument(storedChart, true) as any;
  const mapped = mapNatalChart(publicDoc);

  assert.equal(publicDoc._id, storedChart._id);
  assert.equal(publicDoc.createdAt, storedChart.createdAt);
  assert.equal(publicDoc.updatedAt, storedChart.updatedAt);
  assert.equal(publicDoc.payload.chart, undefined, "no reintroducir payload.chart.normalized");
  assert.equal(publicDoc.payload.placements.length, 3);
  assert.equal(mapped.placements.length, 3);
  assert.equal(mapped.triad.sun.sign, "Escorpio");
  assert.equal(mapped.triad.moon.sign, "Escorpio");
  assert.equal(mapped.triad.ascendant.sign, "Capricornio");
  assert.equal(mapped.houses.length, 2);
  assert.equal(mapped.aspects.length, 1);
});

test("charts.current Free conserva posiciones y oculta casas y aspectos", () => {
  const publicDoc = buildPublicNatalChartDocument(storedChart, false) as any;
  const mapped = mapNatalChart(publicDoc);

  assert.deepEqual(publicDoc.access, { isPro: false, houses: false, aspects: false });
  assert.equal(mapped.placements.length, 3);
  assert.equal(mapped.triad.sun.sign, "Escorpio");
  assert.equal(mapped.triad.ascendant.sign, "Capricornio");
  assert.equal(mapped.placements.every((placement) => placement.house === undefined), true);
  assert.equal(mapped.houses.length, 0);
  assert.equal(mapped.aspects.length, 0);
});

test("charts.current no expone nacimiento, coordenadas ni offset exacto", () => {
  const publicDoc = buildPublicNatalChartDocument(storedChart, true) as any;
  const serialized = JSON.stringify(publicDoc);

  assert.equal(publicDoc.payload.birth, undefined);
  assert.equal(publicDoc.payload.timezoneOffset, undefined);
  assert.doesNotMatch(serialized, /1996-11-11|10:32|Buenos Aires|-34\.6037|-58\.3816/);
});

test("una carta que no puede normalizarse conserva metadata y devuelve payload nulo", () => {
  const publicDoc = buildPublicNatalChartDocument({ ...storedChart, payload: {} }, true) as any;
  assert.equal(publicDoc._id, storedChart._id);
  assert.equal(publicDoc.createdAt, storedChart.createdAt);
  assert.equal(publicDoc.updatedAt, storedChart.updatedAt);
  assert.equal(publicDoc.payload, null);
  assert.throws(() => mapNatalChart(publicDoc), /NATAL_CHART_INVALID/);
});
