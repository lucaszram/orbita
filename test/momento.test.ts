/**
 * Tu momento — cómo se lee la estación vital en pantalla (CORE-209). Puro:
 * la copy por fase, los números con coma, las fechas de borde (exactas o en
 * rango) y el estado de pantalla a partir del sobre.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  anoDeFase,
  anguloProgresado,
  bordeDeFase,
  copyDeSinDatos,
  decimalEs,
  estadoDeEstacion,
  etiquetaDeEtapa,
  mesAno,
  seasonHeadline,
  seasonMeaning,
  seasonReading
} from "../src/domain/momento";
import type { EstacionVital, MomentoEstacionVital } from "../src/services/appRefs";

const lista: Extract<EstacionVital, { status: "ready" }> = {
  status: "ready",
  precision: "exact",
  phaseKey: "new",
  phaseIndex: 0,
  name: "Nueva",
  progressedElongationDegrees: 8.5,
  ageYears: 30.6,
  phaseStartedAt: Date.UTC(2025, 11, 10),
  nextPhaseAt: Date.UTC(2029, 3, 20),
  phaseYears: 3.7,
  yearsIntoPhase: 0.6,
  progress: 0.16,
  observedAt: Date.UTC(2026, 8, 6),
  limitations: ["Es un período de desarrollo de varios años, no una predicción de acontecimientos."]
};

describe("la copy de la fase", () => {
  it("cada fase tiene verbo, tema, sentido y acción; el titular los junta", () => {
    for (const key of ["new", "crescent", "first_quarter", "gibbous", "full", "disseminating", "last_quarter", "balsamic"] as const) {
      const m = seasonMeaning(key);
      assert.ok(m.verb && m.theme && m.meaning && m.action, key);
    }
    assert.equal(seasonHeadline("new"), "Etapa de iniciar: un comienzo que todavía no tiene forma.");
  });

  it("la lectura desarrollada dice la fase en minúscula y la escala del ciclo, y avisa sin hora exacta", () => {
    const exacta = seasonReading({ phaseKey: "new", phaseName: "Nueva", exact: true });
    assert.equal(exacta.now, "Estás en la fase nueva de tu ciclo progresado: la etapa de iniciar dentro de un recorrido de unos 30 años.");
    assert.match(exacta.use, /3,7 años y no se resuelve en una semana/);
    assert.match(exacta.opens, /^Se abre/);
    assert.match(exacta.closes, /^Se (cierra|termina)/);
    assert.equal(exacta.caveat, null);
    const rango = seasonReading({ phaseKey: "full", phaseName: "Llena", exact: false });
    assert.match(rango.caveat ?? "", /Sin tu hora exacta/);
  });
});

describe("números y fechas", () => {
  it("coma decimal, año de la fase, etiqueta de etapa y ángulo", () => {
    assert.equal(decimalEs(3.69), "3,7");
    assert.equal(decimalEs(Number.NaN), "—");
    assert.equal(anoDeFase(lista), "año 0,6 de 3,7");
    assert.equal(etiquetaDeEtapa(lista), "ETAPA VITAL · ~3,7 AÑOS");
    assert.equal(anguloProgresado(lista), "8,5°");
  });

  it("los bordes de fase se escriben como mes y año; en rango, con los dos extremos", () => {
    assert.equal(mesAno(Date.UTC(2025, 11, 10)), "DIC 2025");
    assert.equal(bordeDeFase(lista.phaseStartedAt, undefined), "DIC 2025");
    assert.equal(bordeDeFase(lista.nextPhaseAt, undefined), "ABR 2029");
    assert.equal(bordeDeFase(lista.phaseStartedAt, { earliest: Date.UTC(2025, 10, 28), latest: Date.UTC(2025, 11, 12) }), "NOV 2025 – DIC 2025");
    assert.equal(bordeDeFase(lista.phaseStartedAt, { earliest: Date.UTC(2025, 11, 2), latest: Date.UTC(2025, 11, 20) }), "DIC 2025");
  });
});

describe("estado de pantalla", () => {
  it("locked → bloqueado; ready con fase → listo; ready sin fase → sin_datos; sobre raro → error", () => {
    assert.equal(estadoDeEstacion({ status: "locked", localDate: "2026-09-06", access: { isPro: false } }).kind, "bloqueado");
    assert.equal(estadoDeEstacion({ status: "ready", localDate: "2026-09-06", access: { isPro: true }, estacion: lista, cached: false }).kind, "listo");
    const parcial: EstacionVital = {
      status: "partial",
      precision: "range",
      missingInputs: ["exact_birth_time_or_certified_progressed_phase"],
      limitations: ["La fase puede ser Nueva o Creciente según la hora de nacimiento."],
      possiblePhases: ["Nueva", "Creciente"],
      observedAt: 0
    };
    const estado = estadoDeEstacion({ status: "ready", localDate: "2026-09-06", access: { isPro: true }, estacion: parcial, cached: false });
    assert.equal(estado.kind, "sin_datos");
    assert.equal(estadoDeEstacion(null).kind, "error");
    assert.equal(estadoDeEstacion({ status: "otro" } as unknown as MomentoEstacionVital).kind, "error");
  });

  it("la copy sin fase nombra lo que falta sin elegir una fase", () => {
    const parcial = copyDeSinDatos({
      status: "partial",
      precision: "range",
      missingInputs: [],
      limitations: ["Conservamos ambas posibilidades en vez de elegir una."],
      possiblePhases: ["Nueva", "Creciente"],
      observedAt: 0
    });
    assert.equal(parcial.titulo, "Puede ser Nueva o Creciente.");
    assert.match(copyDeSinDatos({ status: "needs_birth_time", precision: "not_applicable", missingInputs: [], limitations: [], observedAt: 0 }).titulo, /hora exacta/);
    assert.match(copyDeSinDatos({ status: "needs_birth_data", precision: "not_applicable", missingInputs: [], limitations: [], observedAt: 0 }).titulo, /fecha de nacimiento/);
  });
});
