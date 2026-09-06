/**
 * Carta — cómo se lee el mapa natal en el hub y en la carta completa
 * (CORE-215). Puro sobre `NatalChartPayload`: códigos, tríada, las diez
 * posiciones en orden, ejes, contactos por orbe, doce casas con tema corto,
 * datos natales y el resumen de la base. Lo que el payload no trae, se
 * declara, nunca se rellena.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aspectosPorOrbe,
  casasConTema,
  codigoDe,
  datosNatales,
  ejes,
  filasDeTriada,
  posicionesPlanetarias,
  resumenDeBase,
  signoYGrado,
  ultimoCalculo
} from "../src/domain/cartaCompleta";
import type { NatalChartPayload, SignPlacement } from "../src/services/appRefs";

const p = (key: string, planet: string, sign: string, normDegree: number, house?: number, extra: Partial<SignPlacement> = {}): SignPlacement => ({
  key,
  planet,
  sign,
  normDegree,
  fullDegree: normDegree,
  house,
  ...extra
});

const payload: NatalChartPayload = {
  triad: { sun: p("sun", "Sol", "Escorpio", 19.4, 10), moon: p("moon", "Luna", "Escorpio", 24, 11), ascendant: p("ascendant", "Ascendente", "Capricornio", 28, 1) },
  placements: [
    p("pluto", "Plutón", "Sagitario", 2, 11),
    p("sun", "Sol", "Escorpio", 19.4, 10),
    p("ascendant", "Ascendente", "Capricornio", 28, 1),
    p("moon", "Luna", "Escorpio", 24, 11),
    p("saturn", "Saturno", "Aries", 1, 3, { isRetrograde: true }),
    p("mercury", "Mercurio", "Escorpio", 25, 11)
  ],
  houses: [
    { house: 10, sign: "Libra", cusp: 196 },
    { house: 1, sign: "Capricornio", cusp: 298 },
    { house: 6, sign: "Géminis", cusp: 87 }
  ],
  aspects: [
    { from: "Sol", to: "Luna", type: "conjunction", typeEs: "conjunción", harmony: "harmony", orb: 4.9, isMajor: true },
    { from: "Saturno", to: "Urano", type: "sextile", typeEs: "sextil", harmony: "harmony", orb: 0.1, isMajor: true },
    { from: "Marte", to: "Plutón", type: "square", typeEs: "cuadratura", harmony: "tension", orb: 4.2, isMajor: true },
    { from: "Luna", to: "Marte", type: "quincunx", harmony: "neutral", isMajor: false }
  ],
  mc: 196.4,
  accuracy: "Hora exacta · ascendente afinado",
  limitations: []
};

describe("la base natal", () => {
  it("códigos de dos letras y signo con grado", () => {
    assert.equal(codigoDe({ key: "sun", planet: "Sol" }), "SO");
    assert.equal(codigoDe({ key: "pluto", planet: "Plutón" }), "PL");
    assert.equal(codigoDe({ planet: "Júpiter" }), "JU");
    assert.equal(signoYGrado({ sign: "Escorpio", normDegree: 19.4 }), "Escorpio 19°");
    assert.equal(signoYGrado({ sign: "Escorpio" }), "Escorpio");
    assert.equal(signoYGrado({ sign: "—" }), "—");
  });

  it("el grado dentro del signo va por piso: 29,6° es 29°, nunca 30° ni 0° del signo siguiente", () => {
    assert.equal(signoYGrado({ sign: "Escorpio", normDegree: 29.6 }), "Escorpio 29°");
    assert.equal(signoYGrado({ sign: "Aries", normDegree: 0.4 }), "Aries 0°");
    assert.deepEqual(ejes({ triad: payload.triad, mc: 209.7 })[1], { codigo: "MC", nombre: "Medio Cielo", valor: "Libra 29°" });
    assert.deepEqual(ejes({ triad: payload.triad, mc: 210.2 })[1], { codigo: "MC", nombre: "Medio Cielo", valor: "Escorpio 0°" });
    assert.equal(casasConTema({ houses: [{ house: 2, sign: "Tauro", cusp: 59.95 }] })[0].valor, "Tauro 29°");
  });

  it("las tres filas de la tríada, con casa; sin hora, el Ascendente lo dice", () => {
    const filas = filasDeTriada(payload);
    assert.deepEqual(filas[0], { codigo: "SO", nombre: "Sol", valor: "Escorpio 19°", meta: "CASA 10" });
    assert.deepEqual(filas[2], { codigo: "AC", nombre: "Ascendente", valor: "Capricornio 28°", meta: "INICIO CASA 1" });
    const sinHora = filasDeTriada({ triad: { ...payload.triad, ascendant: { planet: "Ascendente", sign: "—" } } });
    assert.deepEqual(sinHora[2], { codigo: "AC", nombre: "Ascendente", valor: "—", meta: "SIN HORA EXACTA" });
  });

  it("el resumen cuenta sólo lo que el payload trae", () => {
    assert.equal(resumenDeBase(payload), "5 POSICIONES · 3 CASAS · 3 ASPECTOS MAYORES");
    assert.equal(resumenDeBase({ placements: [p("sun", "Sol", "Leo", 1)], houses: [], aspects: [] }), "1 POSICIÓN");
  });
});

describe("la carta completa", () => {
  it("las posiciones van del Sol a Plutón y dejan afuera los ejes", () => {
    const filas = posicionesPlanetarias(payload);
    assert.deepEqual(
      filas.map((f) => f.key),
      ["sun", "moon", "mercury", "saturn", "pluto"]
    );
    assert.equal(filas[3].retro, true);
    assert.equal(filas[3].valor, "Aries 1°");
    assert.equal(filas[0].casa, "Casa 10");
  });

  it("los ejes salen del Ascendente y del Medio Cielo; sin hora, ninguno", () => {
    assert.deepEqual(ejes(payload), [
      { codigo: "AC", nombre: "Ascendente", valor: "Capricornio 28°" },
      { codigo: "MC", nombre: "Medio Cielo", valor: "Libra 16°" }
    ]);
    assert.deepEqual(ejes({ triad: { ...payload.triad, ascendant: { planet: "Ascendente", sign: "—" } }, mc: 196 }), []);
  });

  it("los contactos van del más ajustado al menos ajustado, con orbe a un decimal y coma", () => {
    const filas = aspectosPorOrbe(payload);
    assert.deepEqual(
      filas.map((f) => f.texto),
      ["Saturno sextil Urano", "Marte cuadratura Plutón", "Sol conjunción Luna", "Luna quincunx Marte"]
    );
    assert.equal(filas[0].orbe, "orbe 0,1°");
    assert.equal(filas[3].orbe, null);
    assert.equal(filas[1].tono, "tension");
  });

  it("las doce casas se ordenan y llevan signo, grado y tema corto", () => {
    const casas = casasConTema(payload);
    assert.deepEqual(
      casas.map((c) => c.casa),
      [1, 6, 10]
    );
    assert.equal(casas[0].valor, "Capricornio 28°");
    assert.equal(casas[1].tema, "hábitos, cuidado y trabajo cotidiano");
    assert.deepEqual(casasConTema({ houses: [] }), []);
  });

  it("los datos natales se escriben con su precisión y una nota honesta", () => {
    const exacta = datosNatales({ birthDate: "1996-11-11", birthTime: "10:32", birthTimePrecision: "known", birthPlaceLabel: "Ciudad Autónoma de Buenos Aires, Argentina" });
    assert.equal(exacta?.linea, "11 Nov 1996 · 10:32 · Ciudad Autónoma de Buenos Aires, Argentina");
    assert.equal(exacta?.precision, "Hora exacta");
    assert.match(exacta?.nota ?? "", /instante exacto/);
    const sinHora = datosNatales({ birthDate: "1996-11-11", birthTime: "12:00", birthTimePrecision: "unknown", birthPlaceLabel: "Rosario" });
    assert.equal(sinHora?.linea, "11 Nov 1996 · Rosario");
    assert.equal(sinHora?.precision, "Sin hora");
    assert.match(sinHora?.nota ?? "", /mediodía/);
    assert.equal(datosNatales(null), null);
  });

  it("el último cálculo se escribe en la zona natal", () => {
    assert.equal(ultimoCalculo(Date.UTC(2026, 7, 20, 5, 56), "America/Argentina/Buenos_Aires"), "20 de agosto de 2026, 02:56");
    assert.equal(ultimoCalculo(undefined), null);
  });
});
