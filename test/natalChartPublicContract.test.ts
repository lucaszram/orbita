import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPublicNatalChartDocument } from "../convex/lib/publicNatalChart";
import { mapNatalChart } from "../src/domain/natalChart";

const normalized = {
  birth: {
    birthDate: "1996-11-11",
    birthTime: "10:48",
    birthPlaceLabel: "Buenos Aires",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires"
  },
  timezoneOffset: -3,
  calculationTimeSource: "birth_time",
  placements: [
    { key: "sun", label: "Sol", sign: "scorpio", signEs: "Escorpio", degree: 19, fullDegree: 229, house: 10 },
    { key: "moon", label: "Luna", sign: "scorpio", signEs: "Escorpio", degree: 23, fullDegree: 233, house: 11 },
    { key: "ascendant", label: "Ascendente", sign: "capricorn", signEs: "Capricornio", degree: 4, fullDegree: 274, house: 1 }
  ],
  houses: [
    { house: 1, sign: "capricorn", signEs: "Capricornio", degree: 274 },
    { house: 10, sign: "libra", signEs: "Libra", degree: 184 }
  ],
  aspects: [
    { from: "sun", to: "moon", type: "conjunction", typeEs: "conjunción", orb: 4, isMajor: true }
  ],
  summary: {
    sun: null,
    moon: null,
    ascendant: null,
    mainAspects: [
      { from: "sun", to: "moon", type: "conjunction", typeEs: "conjunción", orb: 4, isMajor: true }
    ],
    limitations: []
  }
};

const storedChart = {
  _id: "chart_1",
  calculationVersion: "astrologyapi-western-chart-v1",
  providerVersion: "astrologyapi-western-v1",
  createdAt: 1,
  updatedAt: 2,
  payload: normalized
};

test("charts.current Plus mantiene el payload plano que mapea la app publicada", () => {
  const publicDoc = buildPublicNatalChartDocument(storedChart, true) as any;
  const mapped = mapNatalChart(publicDoc);

  assert.equal(publicDoc.payload.chart, undefined, "no reintroducir payload.chart.normalized");
  assert.equal(publicDoc.payload.placements.length, 3);
  assert.equal(mapped.placements.length, 3);
  assert.equal(mapped.triad.sun.sign, "Escorpio");
  assert.equal(mapped.triad.moon.sign, "Escorpio");
  assert.equal(mapped.triad.ascendant.sign, "Capricornio");
  assert.equal(mapped.houses.length, 2);
  assert.equal(mapped.aspects.length, 1);
});

test("charts.current Free conserva la carta base y oculta casas y aspectos", () => {
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

test("charts.current no expone datos natales ni offset exacto", () => {
  const publicDoc = buildPublicNatalChartDocument(storedChart, true) as any;
  const serialized = JSON.stringify(publicDoc);

  assert.equal(publicDoc.payload.birth, undefined);
  assert.equal(publicDoc.payload.timezoneOffset, undefined);
  assert.doesNotMatch(serialized, /1996-11-11|10:48|Buenos Aires|-34\.6037|-58\.3816/);
});
