/**
 * Sinastría (CORE-212): contactos REALES entre dos cartas.
 *
 * Todo es puro y se ejecuta de verdad: cartas fabricadas con grados conocidos
 * y afirmaciones sobre qué contacto sale, con qué orbe, en qué tono y en qué
 * dimensión; y sobre lo que NO se inventa (ejes sin hora, planetas sin grado).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { NormalizedAstroChart, NormalizedAstroPlacement } from "../convex/lib/orbita";
import {
  DIMENSION_BODIES,
  FREE_CONTACT_LIMIT,
  LUMINARY_ORB_BONUS,
  SYNASTRY_ORBS,
  chartHasRealTime,
  comparablePoints,
  computeSynastryContacts,
  elementOfSign,
  formatOrb,
  signTone,
  summarizeSynastry,
  synastryPrecision
} from "../convex/lib/synastry";

function punto(key: string, fullDegree: number | null, label = key): NormalizedAstroPlacement {
  return {
    key,
    label,
    sign: "aries",
    signEs: "Aries",
    degree: fullDegree === null ? null : fullDegree % 30,
    fullDegree,
    house: null,
    isRetrograde: null,
    source: "astrologyapi"
  };
}

function carta(
  puntos: NormalizedAstroPlacement[],
  opts: { horaReal?: boolean; mc?: number | null; sol?: string } = {}
): NormalizedAstroChart {
  const horaReal = opts.horaReal ?? false;
  return {
    provider: "astrologyapi",
    calculationVersion: "x",
    houseSystem: "placidus",
    timezoneOffset: -3,
    calculationTimeSource: horaReal ? "birth_time" : "noon_fallback",
    birth: { birthTimePrecision: horaReal ? "known" : "unknown", modelInputWarnings: [] },
    placements: puntos,
    houses: opts.mc == null ? [] : [{ house: 10, sign: "leo", signEs: "Leo", degree: opts.mc, theme: "vocación" }],
    aspects: [],
    summary: {
      title: "",
      accuracy: horaReal ? "calculated" : "approximate_without_birth_time",
      sun: { ...punto("sun", 10), sign: opts.sol ?? "aries", signEs: opts.sol ?? "aries" },
      moon: null,
      ascendant: null,
      mainAspects: [],
      limitations: []
    }
  } as unknown as NormalizedAstroChart;
}

describe("contactos entre dos cartas", () => {
  it("un trígono dentro de orbe sale como contacto armónico con su orbe medido", () => {
    const a = carta([punto("venus", 10, "Venus")]);
    const b = carta([punto("venus", 131.5, "Venus")]);
    const contactos = computeSynastryContacts(a, b);
    assert.equal(contactos.length, 1);
    const [c] = contactos;
    assert.equal(c.id, "venus-trine-venus");
    assert.equal(c.aspect, "trine");
    assert.equal(c.aspectEs, "trígono");
    assert.equal(c.symbol, "△");
    assert.equal(c.tone, "armonico");
    assert.equal(c.orb, 1.5);
    assert.equal(c.orbLabel, "1° 30'");
    assert.deepEqual(c.dimensions, ["deseo"]);
  });

  it("cuadratura y oposición son tensas; la conjunción es fusión", () => {
    const a = carta([punto("mars", 0, "Marte"), punto("saturn", 200, "Saturno"), punto("mercury", 300, "Mercurio")]);
    const b = carta([punto("saturn", 91, "Saturno"), punto("sun", 21, "Sol"), punto("mercury", 302, "Mercurio")]);
    const tonos = Object.fromEntries(computeSynastryContacts(a, b).map((c) => [c.id, c.tone]));
    assert.equal(tonos["mars-square-saturn"], "tenso");
    assert.equal(tonos["saturn-opposition-sun"], "tenso");
    assert.equal(tonos["mercury-conjunction-mercury"], "fusion");
  });

  it("fuera de orbe no hay contacto: 6° 01' en un trígono de planetas no luminares se descarta", () => {
    const a = carta([punto("venus", 0)]);
    const b = carta([punto("mars", 120 + SYNASTRY_ORBS.trine + 0.02)]);
    assert.deepEqual(computeSynastryContacts(a, b), []);
  });

  it("Sol y Luna suman el bono de luminaria al orbe permitido", () => {
    const a = carta([punto("sun", 0, "Sol")]);
    const b = carta([punto("mars", 120 + SYNASTRY_ORBS.trine + LUMINARY_ORB_BONUS - 0.1, "Marte")]);
    assert.equal(computeSynastryContacts(a, b).length, 1);
    const c = carta([punto("venus", 0, "Venus")]);
    assert.equal(computeSynastryContacts(c, b).length, 0);
  });

  it("la distancia angular cruza el 0°: 358° y 3° están en conjunción", () => {
    const a = carta([punto("moon", 358, "Luna")]);
    const b = carta([punto("venus", 3, "Venus")]);
    const [c] = computeSynastryContacts(a, b);
    assert.equal(c.aspect, "conjunction");
    assert.equal(c.orb, 5);
  });

  it("la lista sale ordenada del más ajustado al más abierto", () => {
    const a = carta([punto("sun", 0), punto("venus", 100), punto("mars", 200)]);
    const b = carta([punto("moon", 4), punto("venus", 100.5), punto("jupiter", 202)]);
    const orbes = computeSynastryContacts(a, b).map((c) => c.orb);
    assert.deepEqual(orbes, [...orbes].sort((l, r) => l - r));
    assert.equal(orbes[0], 0.5);
  });

  it("un planeta sin grado no entra en la comparación", () => {
    const a = carta([punto("venus", null), punto("mars", 10)]);
    assert.deepEqual(
      comparablePoints(a, false).map((p) => p.key),
      ["mars"]
    );
  });
});

describe("ejes sólo con hora real en las dos cartas", () => {
  const conHora = carta([punto("ascendant", 50, "Ascendente"), punto("sun", 10)], { horaReal: true, mc: 320 });
  const sinHora = carta([punto("ascendant", 50, "Ascendente"), punto("sun", 170)], { horaReal: false, mc: 320 });
  const otraConHora = carta([punto("venus", 170, "Venus")], { horaReal: true, mc: 140 });

  it("chartHasRealTime distingue la hora conocida del mediodía de respaldo", () => {
    assert.equal(chartHasRealTime(conHora), true);
    assert.equal(chartHasRealTime(sinHora), false);
    assert.equal(chartHasRealTime(null), false);
  });

  it("con hora en ambas: Ascendente y Medio Cielo entran (el MC sale de la casa 10)", () => {
    const claves = comparablePoints(conHora, true).map((p) => p.key);
    assert.deepEqual(claves, ["sun", "ascendant", "mc"]);
    const mc = comparablePoints(conHora, true).find((p) => p.key === "mc");
    assert.equal(mc?.fullDegree, 320);
    assert.equal(mc?.label, "Medio Cielo");
    const contactos = computeSynastryContacts(conHora, otraConHora);
    assert.ok(contactos.some((c) => c.id === "ascendant-trine-venus"));
    assert.ok(contactos.some((c) => c.id === "mc-opposition-mc" || c.id === "mc-trine-venus" || c.from.key === "mc"));
  });

  it("si una carta no tiene hora, ningún eje entra aunque el proveedor lo haya calculado", () => {
    const contactos = computeSynastryContacts(sinHora, otraConHora);
    assert.equal(contactos.some((c) => c.from.key === "ascendant" || c.from.key === "mc"), false);
    assert.ok(contactos.some((c) => c.id === "sun-conjunction-venus"));
  });
});

describe("dimensiones y resumen", () => {
  it("cada planeta pertenece a una dimensión fija y los lentos a ninguna", () => {
    assert.deepEqual(DIMENSION_BODIES.hablan, ["mercury", "jupiter", "ascendant"]);
    assert.deepEqual(DIMENSION_BODIES.cuidan, ["moon", "saturn", "mc"]);
    assert.deepEqual(DIMENSION_BODIES.deseo, ["venus", "mars", "sun"]);
    const todos = Object.values(DIMENSION_BODIES).flat();
    for (const lento of ["uranus", "neptune", "pluto"]) assert.equal(todos.includes(lento), false);
  });

  it("un contacto cuenta en las dimensiones de sus dos puntos", () => {
    const a = carta([punto("moon", 0, "Luna")]);
    const b = carta([punto("venus", 60, "Venus")]);
    const [c] = computeSynastryContacts(a, b);
    assert.deepEqual(c.dimensions, ["cuidan", "deseo"]);
    const resumen = summarizeSynastry([c]);
    assert.equal(resumen.total, 1);
    assert.equal(resumen.armonicos, 1);
    assert.deepEqual(
      resumen.dimensions.map((d) => [d.key, d.total]),
      [
        ["hablan", 0],
        ["cuidan", 1],
        ["deseo", 1]
      ]
    );
  });

  it("Plutón trígono Neptuno es un contacto real pero no suma a ninguna dimensión", () => {
    const a = carta([punto("pluto", 0, "Plutón")]);
    const b = carta([punto("neptune", 121, "Neptuno")]);
    const contactos = computeSynastryContacts(a, b);
    assert.equal(contactos.length, 1);
    assert.deepEqual(contactos[0].dimensions, []);
    const resumen = summarizeSynastry(contactos);
    assert.equal(resumen.total, 1);
    assert.equal(resumen.dimensions.every((d) => d.total === 0), true);
  });

  it("el resumen de una lista vacía es todo cero, con las tres dimensiones presentes", () => {
    const r = summarizeSynastry([]);
    assert.deepEqual([r.total, r.armonicos, r.tensos, r.fusiones], [0, 0, 0, 0]);
    assert.deepEqual(
      r.dimensions.map((d) => d.label),
      ["Cómo se hablan", "Cómo se cuidan", "Deseo"]
    );
  });

  it("formatOrb escribe grados y minutos con dos cifras", () => {
    assert.equal(formatOrb(2.1667), "2° 10'");
    assert.equal(formatOrb(0), "0° 00'");
    assert.equal(formatOrb(7.999), "8° 00'");
  });

  it("Free muestra tres contactos antes de invitar a Plus", () => {
    assert.equal(FREE_CONTACT_LIMIT, 3);
  });
});

describe("tono por signos y precisión declarada", () => {
  it("elementOfSign acepta los nombres en inglés que escribe el proveedor en `sign`", () => {
    for (const [en, es] of [["Gemini", "geminis"], ["Scorpio", "escorpio"], ["Taurus", "tauro"], ["Pisces", "piscis"], ["Capricorn", "capricornio"]]) {
      assert.equal(elementOfSign(en), elementOfSign(es), en);
      assert.notEqual(elementOfSign(en), null, en);
    }
    assert.equal(signTone("Gemini", "leo")?.relation, "elementos_afines");
    assert.equal(signTone("Scorpio", "cancer")?.relation, "mismo_elemento");
  });

  it("elementOfSign acepta acentos y mayúsculas", () => {
    assert.equal(elementOfSign("Géminis"), "aire");
    assert.equal(elementOfSign("CÁNCER"), "agua");
    assert.equal(elementOfSign("ofiuco"), null);
  });

  it("mismo elemento, elementos afines y elementos distintos", () => {
    assert.equal(signTone("aries", "leo")?.relation, "mismo_elemento");
    assert.equal(signTone("aries", "acuario")?.relation, "elementos_afines");
    assert.equal(signTone("tauro", "escorpio")?.relation, "elementos_afines");
    assert.equal(signTone("aries", "tauro")?.relation, "elementos_distintos");
    assert.equal(signTone("aries", "nada"), null);
    assert.match(signTone("aries", "leo")?.headline ?? "", /Dos soles de fuego/);
  });

  it("nivel signo: sólo tono, sin ejes, con la limitación escrita", () => {
    const p = synastryPrecision({ level: "signo", chartA: null, chartB: null });
    assert.equal(p.level, "signo");
    assert.equal(p.includesAngles, false);
    assert.equal(p.label, "SÓLO SIGNO · LECTURA DE TONO");
    assert.equal(p.limitations.length, 1);
  });

  it("nivel carta pero sin hora en la persona: baja a fecha y lo dice", () => {
    const conHora = carta([punto("sun", 0)], { horaReal: true });
    const sinHora = carta([punto("sun", 0)], { horaReal: false });
    const p = synastryPrecision({ level: "carta", chartA: conHora, chartB: sinHora });
    assert.equal(p.level, "fecha");
    assert.equal(p.includesAngles, false);
    assert.equal(p.label, "CON FECHA · SIN HORA · SIN CASAS");
    assert.match(p.limitations[0], /Sin hora de la persona/);
  });

  it("las dos con hora real: nivel carta, incluye casas, sin limitaciones", () => {
    const conHora = carta([punto("sun", 0)], { horaReal: true });
    const p = synastryPrecision({ level: "carta", chartA: conHora, chartB: conHora });
    assert.equal(p.level, "carta");
    assert.equal(p.includesAngles, true);
    assert.equal(p.label, "AMBAS CON FECHA, HORA Y LUGAR · INCLUYE CASAS");
    assert.deepEqual(p.limitations, []);
  });

  it("nivel fecha sin carta de la persona cae a signo: no se finge un cálculo", () => {
    const p = synastryPrecision({ level: "fecha", chartA: carta([punto("sun", 0)]), chartB: null });
    assert.equal(p.level, "signo");
  });
});
