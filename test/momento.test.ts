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
  copyDeSinTema,
  decimalEs,
  diaMes,
  estadoDeEstacion,
  estadoDeTema,
  etiquetaDeEtapa,
  mesAno,
  resumenDelAno,
  seasonHeadline,
  seasonMeaning,
  seasonReading,
  subtituloDelAno,
  tituloDelAno,
  yearMeaning,
  yearReading,
  arcoDeAnillo,
  estadoDeRitmos,
  MANDALA_RINGS,
  mandalaReading,
  resumenDeAnillos
} from "../src/domain/momento";
import type { Anillo, EstacionVital, MomentoEstacionVital } from "../src/services/appRefs";

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
    // La zona natal decide el mes cuando el borde cae a pocas horas del cambio.
    assert.equal(mesAno(Date.UTC(2025, 11, 1, 1, 0), "America/Argentina/Buenos_Aires"), "NOV 2025");
    assert.equal(bordeDeFase(lista.phaseStartedAt, undefined), "DIC 2025");
    assert.equal(bordeDeFase(lista.nextPhaseAt, undefined), "ABR 2029");
    assert.equal(bordeDeFase(lista.phaseStartedAt, { earliest: Date.UTC(2025, 10, 28), latest: Date.UTC(2025, 11, 12) }), "NOV 2025 – DIC 2025");
    assert.equal(bordeDeFase(lista.phaseStartedAt, { earliest: Date.UTC(2025, 11, 2), latest: Date.UTC(2025, 11, 20) }), "DIC 2025");
  });
});

describe("estado de pantalla", () => {
  it("locked → bloqueado; ready con fase → listo; ready sin fase → sin_datos; sobre raro → error", () => {
    assert.equal(estadoDeEstacion({ status: "locked", localDate: "2026-09-06", access: { isPro: false } }).kind, "bloqueado");
    assert.equal(estadoDeEstacion({ status: "ready", localDate: "2026-09-06", timezone: "America/Argentina/Buenos_Aires", access: { isPro: true }, estacion: lista, cached: false }).kind, "listo");
    const parcial: EstacionVital = {
      status: "partial",
      precision: "range",
      missingInputs: ["exact_birth_time_or_certified_progressed_phase"],
      limitations: ["La fase puede ser Nueva o Creciente según la hora de nacimiento."],
      possiblePhases: ["Nueva", "Creciente"],
      observedAt: 0
    };
    const estado = estadoDeEstacion({ status: "ready", localDate: "2026-09-06", timezone: null, access: { isPro: true }, estacion: parcial, cached: false });
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

describe("el tema del año en pantalla (CORE-210)", () => {
  const tema = {
    status: "ready" as const,
    precision: "exact" as const,
    age: 31,
    house: 6,
    houseTheme: "rutinas, tareas, cuidado y trabajo cotidiano",
    sign: "Géminis",
    signKey: "gemini",
    ruler: "Mercurio",
    rulerKey: "mercury",
    periodStart: Date.UTC(2025, 10, 11, 3),
    periodEnd: Date.UTC(2026, 10, 11, 3),
    periodStartDate: "2025-11-11",
    periodEndDate: "2026-11-11",
    monthIndex: 10,
    progress: 0.82,
    summary: "…",
    limitations: ["a", "b"],
    observedAt: 0
  };

  it("titular, subtítulo y resumen salen de la casa, el mes y el regente reales", () => {
    // El titular es el de Build 30 (tabla `houseTheme` de release), no el tema largo del sobre.
    assert.equal(tituloDelAno(tema), "Casa 6 · rutinas, tareas y organización cotidiana");
    assert.equal(tituloDelAno({ house: 13, houseTheme: "tema del sobre" }), "Casa 13 · tema del sobre");
    assert.equal(subtituloDelAno(tema), "MES 10 DE 12 · REGENTE DEL AÑO: MERCURIO");
    assert.equal(resumenDelAno(tema), "Casa 6 · mes 10 de 12");
    assert.equal(diaMes(tema.periodStart, "America/Argentina/Buenos_Aires"), "11 NOV");
    assert.equal(diaMes(Date.UTC(2026, 10, 11, 1), "America/Argentina/Buenos_Aires"), "10 NOV");
  });

  it("la lectura nombra la casa, el mes y el regente, y tiene copy para las doce casas", () => {
    const l = yearReading({ house: 6, ruler: "Mercurio", rulerKey: "mercury", monthIndex: 10 });
    assert.ok(l);
    assert.match(l!.now, /^Tu año personal corre por tu casa 6, y vas por el mes 10 de 12\./);
    assert.match(l!.now, /últimos meses del año personal/);
    assert.match(l!.ruler, /^El regente de este año es Mercurio\./);
    assert.match(l!.use, /foco de todo el año/);
    for (let casa = 1; casa <= 12; casa += 1) assert.ok(yearMeaning(casa)?.area, String(casa));
    assert.equal(yearMeaning(13), null);
    assert.equal(yearReading({ house: 0, ruler: "Sol", rulerKey: "sun", monthIndex: 1 }), null);
    assert.match(yearReading({ house: 3, ruler: "Ceres", rulerKey: "ceres", monthIndex: 20 })!.ruler, /Es el planeta con el que este método lee/);
  });

  it("estado de pantalla del tema: bloqueado, listo, sin datos, error", () => {
    assert.equal(estadoDeTema({ status: "locked", localDate: "2026-09-06", access: { isPro: false } }).kind, "bloqueado");
    assert.equal(estadoDeTema({ status: "ready", localDate: "2026-09-06", timezone: null, access: { isPro: true }, tema }).kind, "listo");
    const sinHora = { status: "needs_birth_time" as const, precision: "not_applicable" as const, missingInputs: ["exact_birth_time"], limitations: ["x"], observedAt: 0 };
    const e = estadoDeTema({ status: "ready", localDate: "2026-09-06", timezone: null, access: { isPro: true }, tema: sinHora });
    assert.equal(e.kind, "sin_datos");
    assert.match(copyDeSinTema(sinHora).titulo, /hora exacta/);
    assert.equal(estadoDeTema(null).kind, "error");
  });
});

describe("los cuatro ritmos en pantalla (CORE-211)", () => {
  const anillo = (key: Anillo["key"], extra: Partial<Anillo> = {}): Anillo => ({
    key,
    label: MANDALA_RINGS.find((r) => r.key === key)?.label ?? key,
    cadence: "",
    state: "Nueva",
    status: "ready",
    precision: "exact",
    progressMode: "point",
    progress: 0.4,
    detail: "",
    available: true,
    limitations: [],
    ...extra
  });
  const completo = [anillo("progressed_lunation"), anillo("annual_profection"), anillo("cumpleluna"), anillo("transit_arc")];

  it("la lectura del mandala es fija salvo la combinación de hoy, que nombra los anillos vacíos", () => {
    const todo = mandalaReading({ rings: completo, exact: true });
    assert.match(todo.combination, /^Hoy los cuatro anillos tienen cálculo/);
    assert.match(todo.combination, /la coincidencia se mira, no se convierte en una causa\.$/);
    assert.equal(todo.caveat, null);
    assert.match(todo.concept, /no para sumarlos/);
    assert.match(todo.question, /ciclo de días o a uno de años/);
    const dos = mandalaReading({ rings: [completo[0], { ...completo[1], available: false }, completo[2], { ...completo[3], available: false }], exact: false });
    assert.match(dos.combination, /^Hoy se pueden calcular 2 de los cuatro ritmos: estación vital y tu ritmo lunar\. Los anillos de año personal y tránsito activo quedan vacíos/);
    assert.match(dos.caveat ?? "", /imagen de hoy está incompleta/);
    assert.match(dos.caveat ?? "", /Sin tu hora exacta de nacimiento/);
    const nada = mandalaReading({ rings: completo.map((r) => ({ ...r, available: false })), exact: true });
    assert.match(nada.combination, /^Hoy ninguno de los cuatro ritmos se puede calcular/);
    assert.equal(MANDALA_RINGS.map((r) => r.label).join(" · "), "Estación vital · Año personal · Tu ritmo lunar · Tránsito activo");
  });

  it("cada anillo se dibuja como punto, franja o vacío según lo que su fuente certificó", () => {
    assert.deepEqual(arcoDeAnillo(anillo("cumpleluna", { progress: 0.67 })), { modo: "punto", from: 0, to: 0.67 });
    assert.deepEqual(arcoDeAnillo(anillo("cumpleluna", { progressMode: "range", progress: null, progressRange: { from: 0.6, to: 0.72 } })), { modo: "franja", from: 0.6, to: 0.72 });
    assert.deepEqual(arcoDeAnillo(anillo("transit_arc", { progressMode: "unavailable", progress: null })), { modo: "vacio" });
    assert.deepEqual(arcoDeAnillo(anillo("transit_arc", { progress: 1.7 })), { modo: "punto", from: 0, to: 1 });
  });

  it("estado de pantalla de los ritmos: bloqueado, listo con cuatro anillos, error", () => {
    const ritmos = { status: "ready" as const, exact: true, rings: completo, availableCount: 4, summary: "", observedAt: 0 };
    assert.equal(estadoDeRitmos({ status: "locked", localDate: "2026-09-06", access: { isPro: false } }).kind, "bloqueado");
    const listo = estadoDeRitmos({ status: "ready", localDate: "2026-09-06", timezone: "UTC", access: { isPro: true }, ritmos });
    assert.equal(listo.kind, "listo");
    assert.equal(resumenDeAnillos(ritmos), "4 DE 4 ANILLOS CON CÁLCULO");
    assert.equal(estadoDeRitmos({ status: "ready", localDate: "2026-09-06", timezone: null, access: { isPro: true }, ritmos: { ...ritmos, rings: completo.slice(0, 3) } }).kind, "error");
    assert.equal(estadoDeRitmos(null).kind, "error");
  });
});
