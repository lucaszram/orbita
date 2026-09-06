/**
 * Tu momento · Tema del año (CORE-210), lado del backend. Puro: la profección
 * anual sobre una carta fabricada con Ascendente conocido; lo que NO se calcula
 * sin hora exacta o sin carta; y la política del 29 de febrero.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTemaDelAno, civilDateToTimestamp, HOUSE_THEMES } from "../convex/lib/temaDelAno";
import type { NormalizedAstroChart } from "../convex/lib/orbita";

function carta(ascSign: string): NormalizedAstroChart {
  return {
    provider: "astrologyapi",
    calculationVersion: "x",
    houseSystem: "whole_sign",
    timezoneOffset: -3,
    calculationTimeSource: "birth_time",
    birth: { birthTimePrecision: "known", modelInputWarnings: [] },
    placements: [{ key: "ascendant", label: "Ascendente", sign: ascSign, signEs: ascSign, degree: 12, fullDegree: 12, house: 1, isRetrograde: null, source: "astrologyapi" }],
    houses: [],
    aspects: [],
    summary: { title: "", accuracy: "calculated", sun: null, moon: null, ascendant: null, mainAspects: [], limitations: [] }
  } as unknown as NormalizedAstroChart;
}

const birth = { birthDate: "1994-11-11", birthTimePrecision: "known" as const, timezone: "America/Argentina/Buenos_Aires" };

describe("la profección anual con hora exacta", () => {
  it("a los 31 años el recorrido va por la casa 8 desde el Ascendente, con su signo y su regente", () => {
    // Edad 31 el 2026-09-06 (cumple el 11/11): 31 % 12 = 7 → casa 8. Asc Escorpio → casa 8 = Géminis → Mercurio.
    const r = buildTemaDelAno({ chart: carta("Scorpio"), birth, asOfDate: "2026-09-06", observedAt: 0 });
    assert.equal(r.status, "ready");
    if (r.status !== "ready") return;
    assert.equal(r.age, 31);
    assert.equal(r.house, 8);
    assert.equal(r.sign, "Géminis");
    assert.equal(r.ruler, "Mercurio");
    assert.equal(r.houseTheme, HOUSE_THEMES[8]);
    assert.equal(r.periodStartDate, "2025-11-11");
    assert.equal(r.periodEndDate, "2026-11-11");
    assert.equal(r.monthIndex, 10, "de nov 2025 a sep 2026 van casi diez meses");
    assert.ok(r.progress > 0.8 && r.progress < 0.85, String(r.progress));
    assert.match(r.summary, /casa 8/);
    assert.match(r.summary, /Géminis, Mercurio es el regente/);
    assert.equal(r.limitations.length, 2);
  });

  it("el día del cumpleaños arranca el año nuevo: mes 1 y una casa más", () => {
    const antes = buildTemaDelAno({ chart: carta("aries"), birth, asOfDate: "2026-11-10", observedAt: 0 });
    const cumple = buildTemaDelAno({ chart: carta("aries"), birth, asOfDate: "2026-11-11", observedAt: 0 });
    if (antes.status !== "ready" || cumple.status !== "ready") return assert.fail("ready");
    assert.equal(antes.age, 31);
    assert.equal(cumple.age, 32);
    assert.equal(cumple.house, (antes.house % 12) + 1);
    assert.equal(cumple.monthIndex, 1);
    assert.equal(antes.monthIndex, 12);
  });

  it("acepta el signo del Ascendente en inglés o en español, y lo busca en la casa 1 si falta el punto", () => {
    const es = buildTemaDelAno({ chart: carta("Escorpio"), birth, asOfDate: "2026-09-06", observedAt: 0 });
    const en = buildTemaDelAno({ chart: carta("Scorpio"), birth, asOfDate: "2026-09-06", observedAt: 0 });
    assert.equal(es.status, "ready");
    assert.equal(en.status, "ready");
    if (es.status === "ready" && en.status === "ready") assert.equal(es.house, en.house);
    const sinPunto = { ...carta("Scorpio"), placements: [], houses: [{ house: 1, sign: "Leo", signEs: "Leo", degree: 0, theme: "" }] } as NormalizedAstroChart;
    const r = buildTemaDelAno({ chart: sinPunto, birth, asOfDate: "2026-09-06", observedAt: 0 });
    assert.equal(r.status, "ready");
    if (r.status === "ready") assert.equal(r.sign, "Piscis", "Leo + 7 casas = Piscis");
  });

  it("un cumpleaños del 29 de febrero se toma el 28 en años no bisiestos", () => {
    const r = buildTemaDelAno({ chart: carta("aries"), birth: { ...birth, birthDate: "1996-02-29" }, asOfDate: "2026-02-28", observedAt: 0 });
    assert.equal(r.status, "ready");
    if (r.status !== "ready") return;
    assert.equal(r.periodStartDate, "2026-02-28");
    assert.equal(r.monthIndex, 1);
    assert.match(r.limitations[1], /29 de febrero/);
  });

  it("los bordes del año se escriben a la medianoche de la zona natal", () => {
    assert.equal(civilDateToTimestamp("2026-11-11", "America/Argentina/Buenos_Aires"), Date.UTC(2026, 10, 11, 3, 0));
    assert.equal(civilDateToTimestamp("2026-11-11", "UTC"), Date.UTC(2026, 10, 11));
  });

  it("si la medianoche no existe por un cambio de horario, el borde es el primer minuto real del día", () => {
    // Chile adelanta el reloj el 2026-09-06 a las 00:00 (−04 → −03): la medianoche no existe y el día empieza 01:00 −03.
    assert.equal(civilDateToTimestamp("2026-09-06", "America/Santiago"), Date.UTC(2026, 8, 6, 4, 0));
  });
});

describe("lo que no se calcula", () => {
  it("sin hora exacta no hay Ascendente confiable: needs_birth_time, aunque exista carta", () => {
    const r = buildTemaDelAno({ chart: carta("aries"), birth: { ...birth, birthTimePrecision: "unknown" }, asOfDate: "2026-09-06", observedAt: 0 });
    assert.equal(r.status, "needs_birth_time");
    const aprox = buildTemaDelAno({ chart: carta("aries"), birth: { ...birth, birthTimePrecision: "approximate" }, asOfDate: "2026-09-06", observedAt: 0 });
    assert.equal(aprox.status, "needs_birth_time");
  });

  it("sin datos natales o sin carta, lo dice", () => {
    assert.equal(buildTemaDelAno({ chart: null, birth: null, asOfDate: "2026-09-06", observedAt: 0 }).status, "needs_birth_data");
    assert.equal(buildTemaDelAno({ chart: null, birth, asOfDate: "2026-09-06", observedAt: 0 }).status, "needs_natal_chart");
  });

  it("una carta sin Ascendente legible se retira en vez de inventar el recorrido", () => {
    const r = buildTemaDelAno({ chart: carta("ofiuco"), birth, asOfDate: "2026-09-06", observedAt: 0 });
    assert.equal(r.status, "unavailable");
    if ("missingInputs" in r) assert.deepEqual(r.missingInputs, ["ascendant_sign"]);
  });

  it("una fecha anterior al nacimiento no se calcula", () => {
    const r = buildTemaDelAno({ chart: carta("aries"), birth, asOfDate: "1990-01-01", observedAt: 0 });
    assert.equal(r.status, "unavailable");
  });
});
