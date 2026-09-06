import assert from "node:assert/strict";
import test from "node:test";

import {
  ASTROLOGY_EDITORIAL_COPY_VERSION,
  buildAnnualProfectionLayerData,
  buildCumplelunaLayerData,
  buildCurrentMoonLayerData,
  buildNatalLayerData,
  buildProgressedLunationLayerData,
  buildTemporalMandalaData,
  buildTransitArcLayerData,
  buildTransitRankingLayerData
} from "../convex/lib/layerAssembly";
import type { EphemerisPosition } from "../convex/lib/layerContract";
import {
  ASTROLOGY_API_CHART_CALCULATION_VERSION,
  type NormalizedAstroChart,
  type NormalizedAstroPlacement
} from "../convex/lib/orbita";
import type { TransitContactInput } from "../convex/lib/transitLayers";

const DAY = 86_400_000;

const placement = (
  key: string,
  sign: string,
  signEs: string,
  fullDegree: number,
  house: number | null = null
): NormalizedAstroPlacement => ({
  key,
  label:
    {
      sun: "Sol",
      moon: "Luna",
      mercury: "Mercurio",
      venus: "Venus",
      mars: "Marte",
      jupiter: "Júpiter",
      saturn: "Saturno",
      uranus: "Urano",
      neptune: "Neptuno",
      pluto: "Plutón",
      ascendant: "Ascendente"
    }[key] ?? key,
  sign,
  signEs,
  degree: fullDegree % 30,
  fullDegree,
  house,
  isRetrograde: false,
  source: "astrologyapi"
});

function chart(overrides: Partial<NormalizedAstroChart> = {}): NormalizedAstroChart {
  const placements = [
    placement("sun", "Aries", "Aries", 0, 3),
    placement("moon", "Cancer", "Cáncer", 108, 6),
    placement("mercury", "Scorpio", "Escorpio", 210, 10),
    placement("venus", "Pisces", "Piscis", 330, 2),
    placement("mars", "Cancer", "Cáncer", 100, 6),
    placement("jupiter", "Scorpio", "Escorpio", 220, 10),
    placement("saturn", "Pisces", "Piscis", 340, 2),
    placement("uranus", "Taurus", "Tauro", 40, 4),
    placement("neptune", "Virgo", "Virgo", 160, 8),
    placement("pluto", "Capricorn", "Capricornio", 280, 12),
    placement("ascendant", "Aquarius", "Acuario", 300, 1)
  ];
  const houses = Array.from({ length: 12 }, (_, index) => {
    const fullDegree = (300 + index * 30) % 360;
    return {
      house: index + 1,
      sign: ["Aquarius", "Pisces", "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn"][index],
      signEs: ["Acuario", "Piscis", "Aries", "Tauro", "Géminis", "Cáncer", "Leo", "Virgo", "Libra", "Escorpio", "Sagitario", "Capricornio"][index],
      degree: fullDegree,
      theme: `tema ${index + 1}`
    };
  });
  const base: NormalizedAstroChart = {
    provider: "astrologyapi",
    calculationVersion: ASTROLOGY_API_CHART_CALCULATION_VERSION,
    houseSystem: "whole_sign",
    timezoneOffset: -3,
    calculationTimeSource: "birth_time",
    birth: {
      birthDate: "1994-05-04",
      birthTime: "12:00",
      birthTimePrecision: "known",
      birthPlaceLabel: "Buenos Aires",
      latitude: -34.6,
      longitude: -58.4,
      timezone: "America/Argentina/Buenos_Aires",
      modelInputWarnings: []
    },
    placements,
    houses,
    aspects: [],
    summary: {
      title: "fixture",
      accuracy: "calculated",
      sun: placements[0],
      moon: placements[1],
      ascendant: placements[10],
      mainAspects: [],
      limitations: []
    }
  };
  return { ...base, ...overrides };
}

function unknownTimeChart(): NormalizedAstroChart {
  const base = chart();
  return {
    ...base,
    calculationTimeSource: "noon_fallback",
    birth: {
      ...base.birth,
      birthTime: undefined,
      birthTimePrecision: "unknown"
    },
    summary: { ...base.summary, accuracy: "approximate_without_birth_time" }
  };
}

test("ensambla tipo lunar, mapa elemental y patrón relacional sin sumar Ascendente al conteo", () => {
  const result = buildNatalLayerData({ chart: chart() });

  assert.equal(result.lunarType.status, "ready");
  assert.equal(result.lunarType.data?.phaseKey, "first_quarter");
  assert.equal(result.lunarType.data?.elongationDegrees, 108);
  assert.ok(Math.abs((result.lunarType.data?.illumination ?? 0) - 0.654508) < 0.000001);

  assert.deepEqual(result.elementMap.data?.counts, { fire: 1, earth: 3, air: 0, water: 6 });
  assert.equal(result.elementMap.data?.total, 10);
  assert.equal(result.elementMap.data?.placements.some((item) => item.body === "Ascendente"), false);

  assert.deepEqual(
    result.relationshipPattern.data?.facets.map((facet) => facet.key),
    ["emotional_need", "affection_style", "desire_style"]
  );
  assert.equal(result.relationshipPattern.data?.relationshipAxis?.descendantSign, "Leo");
  assert.equal(JSON.stringify(result.relationshipPattern.data).includes("score"), false);
});

test("las ocho fases natales usan un catálogo editorial versionado y hablan de tendencias posibles", () => {
  assert.equal(ASTROLOGY_EDITORIAL_COPY_VERSION, "orbita-v492-copy-clarity-v2");
  const expected = [
    "new",
    "crescent",
    "first_quarter",
    "gibbous",
    "full",
    "disseminating",
    "last_quarter",
    "balsamic"
  ];

  const results = expected.map((phaseKey, index) => {
    const elongation = index * 45 + 22.5;
    const base = chart();
    base.placements = base.placements.map((item) =>
      item.key === "moon" ? { ...item, fullDegree: elongation, degree: elongation % 30 } : item
    );
    const lunarType = buildNatalLayerData({ chart: base }).lunarType.data!;
    assert.equal(lunarType.phaseKey, phaseKey);
    assert.match(lunarType.summary, new RegExp(`${String(elongation).replace(".", "\\,")}°`));
    assert.match(lunarType.summary, /Esta fase se asocia/);
    assert.deepEqual(lunarType.traits.map((trait) => trait.label), ["Al empezar", "Ante un obstáculo", "Al cerrar"]);
    return lunarType;
  });

  const copy = stringValues(results).join(" ");
  assert.doesNotMatch(copy, /\b(?:solés|tendés|necesitás|te resulta natural)\b/i);
  assert.match(results[2].summary, /avanzar mediante la prueba y el ajuste/);
  assert.match(results[2].traits[1].body, /probás, encontrás resistencia y ajustás/);
});

test("el mapa elemental explica conteo, saturación y equilibrio sin convertirlos en un score", () => {
  const elementMap = buildNatalLayerData({ chart: chart() }).elementMap.data!;

  assert.deepEqual(elementMap.counts, { fire: 1, earth: 3, air: 0, water: 6 });
  assert.match(elementMap.resource, /El agua reúne seis de tus diez planetas/);
  assert.match(elementMap.resource, /forma sensible e intuitiva de registrar lo que pasa/);
  assert.match(elementMap.overuse, /Cuando esa vía ocupa demasiado espacio.*tomar distancia de una emoción/);
  assert.match(elementMap.cultivate, /No hay planetas en aire/);
  assert.match(elementMap.cultivate, /palabras, comparación y perspectiva/);
  assert.doesNotMatch(stringValues(elementMap).join(" "), /porcentaje|score|personalidad/i);
});

/**
 * Un signo de cada elemento, para poder pedirle a la carta un reparto exacto.
 * `agua` tiene que quedar con `el` aunque sea femenino: empieza con /a/ tónica.
 */
const SIGN_BY_ELEMENT = {
  fire: ["Aries", "Aries"],
  earth: ["Taurus", "Tauro"],
  air: ["Gemini", "Géminis"],
  water: ["Cancer", "Cáncer"]
} as const;

const NATAL_PLANETS = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto"
] as const;

/** Carta con un reparto elemental pedido (los diez planetas, sin Ascendente). */
function chartWithElementCounts(counts: Record<keyof typeof SIGN_BY_ELEMENT, number>): NormalizedAstroChart {
  const wanted: (keyof typeof SIGN_BY_ELEMENT)[] = [];
  for (const [element, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i += 1) wanted.push(element as keyof typeof SIGN_BY_ELEMENT);
  }
  assert.equal(wanted.length, NATAL_PLANETS.length, "el reparto tiene que sumar diez planetas");

  const base = chart();
  const placements = base.placements.map((item) => {
    const index = NATAL_PLANETS.indexOf(item.key as (typeof NATAL_PLANETS)[number]);
    if (index < 0) return item; // Ascendente: no entra al conteo
    const [sign, signEs] = SIGN_BY_ELEMENT[wanted[index]];
    return { ...item, sign, signEs };
  });
  return { ...base, placements };
}

test("el artículo del elemento concuerda: la tierra, el agua, el fuego y el aire", () => {
  // El defecto que se corrige: la plantilla abría con `El ` fijo y la lectura
  // decía "El tierra reúne cuatro de tus diez planetas". El artículo no se
  // puede derivar del género —`tierra` y `agua` son femeninos y sólo `tierra`
  // lleva `la`—, así que va declarado por elemento.
  const casos = [
    { dominante: "fire", articulo: "El fuego", menos: "earth", articuloMenos: "La tierra" },
    { dominante: "earth", articulo: "La tierra", menos: "air", articuloMenos: "El aire" },
    { dominante: "air", articulo: "El aire", menos: "water", articuloMenos: "El agua" },
    { dominante: "water", articulo: "El agua", menos: "fire", articuloMenos: "El fuego" }
  ] as const;

  for (const caso of casos) {
    // 4 / 3 / 2 / 1: un dominante y un menos representado, los dos únicos, y el
    // menos con al menos un planeta para que use la rama con artículo.
    const resto = (["fire", "earth", "air", "water"] as const).filter(
      (e) => e !== caso.dominante && e !== caso.menos
    );
    const counts = {
      [caso.dominante]: 4,
      [resto[0]]: 3,
      [resto[1]]: 2,
      [caso.menos]: 1
    } as Record<keyof typeof SIGN_BY_ELEMENT, number>;

    const elementMap = buildNatalLayerData({ chart: chartWithElementCounts(counts) }).elementMap.data!;
    assert.deepEqual(elementMap.counts, counts);
    assert.ok(
      elementMap.resource.startsWith(`${caso.articulo} reúne cuatro de tus diez planetas`),
      `dominante ${caso.dominante}: ${elementMap.resource}`
    );
    assert.ok(
      elementMap.cultivate.startsWith(`${caso.articuloMenos} es el elemento menos representado`),
      `menos representado ${caso.menos}: ${elementMap.cultivate}`
    );
    assert.match(elementMap.cultivate, /con un planeta\./, elementMap.cultivate);
    assert.doesNotMatch(elementMap.cultivate, /\buno planeta\b/, elementMap.cultivate);
  }
});

test("los empates de un planeta usan la apócope correcta", () => {
  const partial = chart();
  partial.placements = partial.placements
    .filter((item) => ["sun", "moon", "ascendant"].includes(item.key))
    .map((item) =>
      item.key === "sun"
        ? { ...item, sign: "Aries", signEs: "Aries" }
        : item.key === "moon"
          ? { ...item, sign: "Taurus", signEs: "Tauro" }
          : item
    );
  const elementMap = buildNatalLayerData({ chart: partial }).elementMap.data!;

  assert.match(elementMap.resource, /con un planeta cada uno\./);
  assert.doesNotMatch(elementMap.resource, /\buno planetas\b/);
});

test("un único planeta disponible no dice «uno de los uno planetas»", () => {
  const partial = chart();
  partial.placements = partial.placements
    .filter((item) => ["sun", "ascendant"].includes(item.key))
    .map((item) =>
      item.key === "sun" ? { ...item, sign: "Aries", signEs: "Aries" } : item
    );
  const elementMap = buildNatalLayerData({ chart: partial }).elementMap.data!;

  assert.match(elementMap.resource, /El fuego reúne el único planeta disponible\./);
  assert.doesNotMatch(elementMap.resource, /uno de los uno planetas/);
});

test("ninguna lectura elemental dice «el tierra»", () => {
  // Gate directo sobre la concordancia, en las dos ramas y en el caso de cero
  // planetas: si vuelve el artículo fijo, esto falla aunque cambie la redacción.
  const repartos: Record<keyof typeof SIGN_BY_ELEMENT, number>[] = [
    { fire: 4, earth: 3, air: 2, water: 1 },
    { fire: 1, earth: 4, air: 3, water: 2 },
    { fire: 2, earth: 1, air: 4, water: 3 },
    { fire: 3, earth: 2, air: 1, water: 4 },
    { fire: 0, earth: 6, air: 1, water: 3 },
    { fire: 6, earth: 3, air: 0, water: 1 }
  ];
  for (const counts of repartos) {
    const elementMap = buildNatalLayerData({ chart: chartWithElementCounts(counts) }).elementMap.data!;
    const copy = [elementMap.resource, elementMap.overuse, elementMap.cultivate].join(" ");
    assert.doesNotMatch(copy, /\b[Ee]l tierra\b/, copy);
    assert.doesNotMatch(copy, /\b[Ll]a fuego\b|\b[Ll]a aire\b|\b[Ll]a agua\b/, copy);
  }
});

test("sin hora sólo fija el tipo lunar si todo el intervalo conserva la fase", () => {
  const stable = buildNatalLayerData({
    chart: unknownTimeChart(),
    sunLongitudeSamples: [0, 0.5],
    moonLongitudeSamples: [107, 109]
  });
  assert.equal(stable.lunarType.status, "partial");
  assert.equal(stable.lunarType.precision, "estimated");
  assert.equal(stable.lunarType.data?.phaseKey, "first_quarter");
  assert.equal(stable.relationshipPattern.data?.relationshipAxis, null);

  const crossing = buildNatalLayerData({
    chart: unknownTimeChart(),
    sunLongitudeSamples: [0, 0],
    moonLongitudeSamples: [44, 46]
  });
  assert.equal(crossing.lunarType.data, null);
  assert.equal(crossing.lunarType.precision, "range");
  assert.match(crossing.lunarType.limitations[0], /cruza un límite/);

  const unsupported = buildNatalLayerData({ chart: unknownTimeChart() });
  assert.equal(unsupported.lunarType.data, null);
  assert.match(unsupported.lunarType.limitations[0], /una sola hora no alcanza/);
});

function ephemeris(key: "sun" | "moon", fullDegree: number, sign: string, signEs: string): EphemerisPosition {
  return {
    key,
    label: key === "sun" ? "Sol" : "Luna",
    sign,
    signEs,
    degree: fullDegree % 30,
    fullDegree,
    speed: key === "sun" ? 1 : 13,
    isRetrograde: false
  };
}

test("la Luna actual usa iluminación continua y sólo asigna casa con hora exacta", () => {
  const current = [ephemeris("sun", 200, "Libra", "Libra"), ephemeris("moon", 308, "Aquarius", "Acuario")];
  const exact = buildCurrentMoonLayerData({ chart: chart(), ephemeris: current });
  assert.equal(exact.data?.phaseKey, "first_quarter");
  assert.ok(Math.abs((exact.data?.illumination ?? 0) - 0.654508) < 0.000001);
  assert.equal(exact.data?.natalHouse, 1);
  assert.match(exact.data?.summary ?? "", /casa 1/);

  const withoutTime = buildCurrentMoonLayerData({ chart: unknownTimeChart(), ephemeris: current });
  assert.equal(withoutTime.status, "partial");
  assert.equal(withoutTime.data?.natalHouse, null);
  assert.match(withoutTime.data?.summary ?? "", /Sin una hora exacta.*casa de tu carta/);
});

const utcCivilDate = (value: string) => Date.parse(`${value}T00:00:00.000Z`);

test("la profección arma Casa 7 con regencia tradicional y respeta la regla de 29/2", () => {
  const result = buildAnnualProfectionLayerData({
    chart: chart(),
    asOfDate: "2000-05-04",
    civilDateToTimestamp: utcCivilDate
  });
  assert.equal(result.status, "ready");
  assert.deepEqual(
    {
      age: result.data?.age,
      house: result.data?.house,
      sign: result.data?.sign,
      ruler: result.data?.ruler,
      monthIndex: result.data?.monthIndex
    },
    { age: 6, house: 7, sign: "Leo", ruler: "Sol", monthIndex: 1 }
  );

  const leap = chart();
  leap.birth = { ...leap.birth, birthDate: "2000-02-29" };
  leap.placements = leap.placements.map((item) =>
    item.key === "ascendant" ? { ...item, sign: "Aries", signEs: "Aries", fullDegree: 0 } : item
  );
  const in2023 = buildAnnualProfectionLayerData({
    chart: leap,
    asOfDate: "2023-02-28",
    civilDateToTimestamp: utcCivilDate
  });
  assert.equal(in2023.data?.periodStart, utcCivilDate("2023-02-28"));
  assert.equal(in2023.data?.periodEnd, utcCivilDate("2024-02-29"));

  const gated = buildAnnualProfectionLayerData({
    chart: unknownTimeChart(),
    asOfDate: "2026-08-15",
    civilDateToTimestamp: utcCivilDate
  });
  assert.equal(gated.status, "needs_birth_time");
  assert.equal(gated.data, null);

  const withoutAscendant = chart();
  withoutAscendant.placements = withoutAscendant.placements.filter((item) => item.key !== "ascendant");
  withoutAscendant.houses = withoutAscendant.houses.map((house) =>
    house.house === 1 ? { ...house, sign: "", signEs: "" } : house
  );
  const missingStart = buildAnnualProfectionLayerData({
    chart: withoutAscendant,
    asOfDate: "2026-08-15",
    civilDateToTimestamp: utcCivilDate
  });
  assert.match(missingStart.limitations.join(" "), /recorrido anual por las doce casas/);
  assert.doesNotMatch(missingStart.limitations.join(" "), /whole sign/i);
});

test("adapta la estación vital y las fechas de Cumpleluna sin estimarlas", () => {
  const started = Date.UTC(2024, 4, 1);
  const next = Date.UTC(2027, 10, 1);
  const observed = Date.UTC(2026, 7, 15);
  const progressed = buildProgressedLunationLayerData({
    birthTimePrecision: "known",
    progressedSunLongitude: 10,
    progressedMoonLongitude: 118,
    ageYears: 32.28,
    observedAt: observed,
    phaseStartedAt: started,
    nextPhaseAt: next
  });
  assert.equal(progressed.data?.phaseKey, "first_quarter");
  assert.equal(progressed.data?.progressedElongationDegrees, 108);
  assert.equal(progressed.data?.progressRange, undefined);
  assert.ok((progressed.data?.progress ?? 0) > 0.65);
  assert.ok((progressed.data?.progress ?? 1) < 0.66);
  assert.equal(progressed.data?.cyclePosition, 0.3);

  const estimatedStarted = {
    earliest: Date.UTC(2023, 10, 1),
    latest: Date.UTC(2024, 10, 1),
  };
  const estimatedNext = {
    earliest: Date.UTC(2027, 4, 1),
    latest: Date.UTC(2028, 4, 1),
  };
  const estimatedProgressed = buildProgressedLunationLayerData({
    birthTimePrecision: "approximate",
    progressedSunLongitude: 10,
    progressedMoonLongitude: 118,
    ageYears: 32.28,
    observedAt: observed,
    phaseStartedAt: (estimatedStarted.earliest + estimatedStarted.latest) / 2,
    nextPhaseAt: (estimatedNext.earliest + estimatedNext.latest) / 2,
    phaseStartedAtRange: estimatedStarted,
    nextPhaseAtRange: estimatedNext,
  });
  assert.equal(estimatedProgressed.status, "partial");
  assert.equal(estimatedProgressed.precision, "estimated");
  assert.deepEqual(estimatedProgressed.data?.phaseStartedAtRange, estimatedStarted);
  assert.deepEqual(estimatedProgressed.data?.nextPhaseAtRange, estimatedNext);
  assert.ok(estimatedProgressed.missingInputs.includes("exact_birth_time"));
  assert.match(estimatedProgressed.limitations.join(" "), /aproximada.*desconocida/i);
  assert.match(estimatedProgressed.limitations.join(" "), /±.*meses/i);

  const previousRoot = Date.UTC(2026, 6, 27);
  const nextRoot = previousRoot + 29.5 * DAY;
  const cumpleluna = buildCumplelunaLayerData({
    natalSunLongitude: 10,
    natalMoonLongitude: 78,
    currentSunLongitude: 100,
    currentMoonLongitude: 333,
    previousExactAt: previousRoot,
    nextExactAt: nextRoot,
    observedAt: previousRoot + 18.5 * DAY,
    natalPrecision: "exact"
  });
  assert.equal(cumpleluna.data?.daysRemaining, 11);
  assert.equal(cumpleluna.data?.cycleDay, 18.5);
  assert.equal(cumpleluna.data?.cycleLengthDays, 29.5);
  assert.equal(cumpleluna.data?.previousExactAt, previousRoot);
  assert.equal(cumpleluna.data?.nextExactAt, nextRoot);
  assert.match(cumpleluna.data?.summary ?? "", /distancia entre el Sol y la Luna/);

  const rangedPrevious = {
    earliest: observed - 10.5 * DAY,
    latest: observed - 9.5 * DAY,
  };
  const rangedNext = {
    earliest: observed + 18.5 * DAY,
    latest: observed + 19.5 * DAY,
  };
  const rangedCumpleluna = buildCumplelunaLayerData({
    natalElongationDegrees: 68,
    natalElongationRangeDegrees: { from: 62, to: 74 },
    currentSunLongitude: 100,
    currentMoonLongitude: 333,
    previousExactAt: observed - 10 * DAY,
    nextExactAt: observed + 19 * DAY,
    previousExactAtRange: rangedPrevious,
    nextExactAtRange: rangedNext,
    observedAt: observed,
    natalPrecision: "range",
    birthTimePrecision: "approximate",
  });
  assert.equal(rangedCumpleluna.status, "partial");
  assert.equal(rangedCumpleluna.precision, "range");
  assert.deepEqual(rangedCumpleluna.data?.previousExactAtRange, rangedPrevious);
  assert.deepEqual(rangedCumpleluna.data?.nextExactAtRange, rangedNext);
  assert.deepEqual(rangedCumpleluna.data?.daysRemainingRange, { from: 18.5, to: 19.5 });
  assert.ok(rangedCumpleluna.data?.cycleDayRange);
  assert.ok(rangedCumpleluna.data?.cycleLengthDaysRange);
  assert.ok(rangedCumpleluna.data?.progressRange);
  assert.match(rangedCumpleluna.data?.summary ?? "", /intervalo completo.*ventana/i);
  assert.match(rangedCumpleluna.limitations.join(" "), /punto medio.*hora natal/i);
  assert.match(rangedCumpleluna.limitations.join(" "), /aproximada.*desconocida/i);
});

test("la estación vital interpreta las ocho fases sin prometer hechos ni repetir una frase genérica", () => {
  const summaries = Array.from({ length: 8 }, (_, index) => {
    const result = buildProgressedLunationLayerData({
      birthTimePrecision: "known",
      progressedSunLongitude: 0,
      progressedMoonLongitude: index * 45 + 22.5,
      ageYears: 32,
      observedAt: Date.UTC(2026, 7, 15),
      phaseStartedAt: Date.UTC(2024, 0, 1),
      nextPhaseAt: Date.UTC(2028, 0, 1)
    });
    assert.equal(result.status, "ready");
    assert.match(result.data?.summary ?? "", /fase actual de tu estación vital/);
    assert.match(result.data?.summary ?? "", /ciclo de unos 30 años/);
    return result.data?.summary ?? "";
  });

  assert.equal(new Set(summaries).size, 8);
  assert.match(summaries[3], /revisar y perfeccionar algo que ya tomó forma/);
  assert.doesNotMatch(summaries.join(" "), /tiene que pasar|te va a|vas a vivir/i);
});

test("la profección explica las doce casas y el regente en lenguaje cotidiano", () => {
  const summaries = Array.from({ length: 12 }, (_, age) => {
    const year = 1994 + age;
    const result = buildAnnualProfectionLayerData({
      chart: chart(),
      asOfDate: `${year}-05-04`,
      civilDateToTimestamp: utcCivilDate
    });
    assert.equal(result.data?.house, age + 1);
    assert.match(result.data?.summary ?? "", new RegExp(`casa ${age + 1}`));
    assert.match(result.data?.summary ?? "", /por cada año de vida/);
    assert.match(result.data?.summary ?? "", /regente del año/);
    return result.data?.summary ?? "";
  });

  assert.match(summaries[2], /conversaciones, aprendizaje y entorno cercano/);
  assert.match(summaries[5], /rutinas, tareas, cuidado y trabajo cotidiano/);
  assert.match(summaries[6], /pareja, sociedades, contratos y acuerdos de a dos/);
  assert.doesNotMatch(summaries.join(" "), /marca el tono|Whole Sign|regencia/i);
});

test("el mandala conserva cuatro ritmos y marca como vacío lo que no fue calculado", () => {
  const observed = Date.UTC(2026, 7, 15);
  const annual = buildAnnualProfectionLayerData({
    chart: chart(),
    asOfDate: "2000-08-15",
    civilDateToTimestamp: utcCivilDate
  }).data;
  const previousExactAt = observed - 18.5 * DAY;
  const nextExactAt = observed + 11 * DAY;
  const cumpleluna = buildCumplelunaLayerData({
    natalSunLongitude: 10,
    natalMoonLongitude: 78,
    currentSunLongitude: 100,
    currentMoonLongitude: 333,
    previousExactAt,
    nextExactAt,
    observedAt: observed,
    natalPrecision: "exact"
  }).data;
  const mandala = buildTemporalMandalaData({
    observedAt: observed,
    annualProfection: annual,
    cumpleluna
  });
  assert.equal(mandala.rings.length, 4);
  assert.deepEqual(
    mandala.rings.map((ring) => ring.key),
    ["progressed_lunation", "annual_profection", "cumpleluna", "transit_arc"]
  );
  assert.deepEqual(
    mandala.rings.map((ring) => ring.available),
    [false, true, true, false]
  );
  assert.equal(mandala.rings[0].progressMode, "unavailable");
  assert.equal(mandala.rings[0].progress, -1);
  assert.equal(mandala.rings[2].label, "Tu ritmo lunar");
  assert.equal(mandala.rings[2].cadence, "Cumpleluna personal");
  assert.equal(mandala.rings[2].state, "Día 18,5 de 29,5");
  assert.equal(mandala.rings[2].cycleDay, 18.5);
  assert.equal(mandala.rings[2].daysRemaining, 11);
  assert.equal(mandala.rings[2].previousExactAt, previousExactAt);
  assert.equal(mandala.rings[2].nextExactAt, nextExactAt);
  assert.match(mandala.rings[2].detail, /próxima Cumpleluna personal/);
  assert.doesNotMatch(stringValues(mandala.rings[2]).join(" "), /fase de la Luna de hoy|ciclo lunar actual/i);
  assert.match(mandala.summary, /Cada anillo representa un ritmo personal distinto/);
  assert.match(mandala.summary, /años o meses.*Cumplelunas personales.*duración de un tránsito/);
});

const TRANSIT_NOW = Date.UTC(2026, 7, 15, 15);

function transit(overrides: Partial<TransitContactInput> = {}): TransitContactInput {
  return {
    chartKey: "chart-fixture",
    transitPlanet: "Saturno",
    transitLongitude: 91,
    transitSpeed: 0.03,
    natalPoint: "Ascendente",
    natalLongitude: 0,
    natalHouse: 1,
    observedAt: TRANSIT_NOW,
    windowStart: TRANSIT_NOW - 10 * DAY,
    exactAt: TRANSIT_NOW - DAY,
    windowEnd: TRANSIT_NOW + 20 * DAY,
    ...overrides
  };
}

test("adapta ranking y arco al contrato sin filtrar el puntaje interno", () => {
  const contacts = [
    transit({ contactId: "one", transitPlanet: "Plutón", transitLongitude: 0.2, natalPoint: "Sol" }),
    transit({ contactId: "two", transitPlanet: "Saturno", transitLongitude: 90.5 }),
    transit({ contactId: "three", transitPlanet: "Júpiter", transitLongitude: 60.4, natalPoint: "Mercurio" }),
    transit({ contactId: "four", transitPlanet: "Marte", transitLongitude: 179.2, natalPoint: "Venus" })
  ];
  const ranking = buildTransitRankingLayerData({ contacts, observedAt: TRANSIT_NOW });
  assert.equal(ranking.data?.items.length, 4);
  assert.equal(ranking.data?.activeCount, 4);
  assert.equal(JSON.stringify(ranking).includes("internalScore"), false);
  assert.equal(JSON.stringify(ranking).includes('"score"'), false);
  assert.match(ranking.data?.items[0].summary ?? "", /forman una/);

  const arc = buildTransitArcLayerData({ contacts, observedAt: TRANSIT_NOW });
  assert.equal(arc.status, "ready");
  assert.ok((arc.data?.progress ?? -1) >= 0 && (arc.data?.progress ?? 2) <= 1);
  assert.match(arc.data?.summary ?? "", /punto más preciso/);
});

test("tres contactos directos y retrógrados siguen siendo un único arco visible", () => {
  const contacts: TransitContactInput[] = [
    transit({
      contactId: "first",
      arcWindowKey: "saturn-asc-2026",
      observedAt: Date.UTC(2026, 4, 12),
      exactAt: Date.UTC(2026, 4, 12),
      windowStart: Date.UTC(2026, 4, 1),
      windowEnd: null,
      transitLongitude: 89.95
    }),
    transit({
      contactId: "second",
      arcWindowKey: "saturn-asc-2026",
      observedAt: Date.UTC(2026, 7, 2),
      exactAt: Date.UTC(2026, 7, 2),
      windowStart: null,
      windowEnd: null,
      transitLongitude: 90.02,
      isRetrograde: true
    }),
    transit({
      contactId: "third",
      arcWindowKey: "saturn-asc-2026",
      observedAt: Date.UTC(2026, 9, 31),
      exactAt: Date.UTC(2026, 9, 31),
      windowStart: null,
      windowEnd: Date.UTC(2026, 10, 8),
      transitLongitude: 90.08
    })
  ];
  const result = buildTransitArcLayerData({ contacts, observedAt: Date.UTC(2026, 7, 15) });
  assert.equal(result.data?.passes.length, 3);
  assert.deepEqual(result.data?.passes.map((pass) => pass.direction), ["direct", "retrograde", "direct"]);
  assert.equal(new Set(result.data?.passes.map((pass) => pass.label)).size, 3);
});

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringValues);
  return [];
}

test("el copy público de las capas explica los cálculos sin vocabulario interno", () => {
  const natal = buildNatalLayerData({ chart: chart() });
  const annual = buildAnnualProfectionLayerData({
    chart: chart(),
    asOfDate: "2000-08-15",
    civilDateToTimestamp: utcCivilDate
  });
  const progressed = buildProgressedLunationLayerData({
    birthTimePrecision: "known",
    progressedSunLongitude: 10,
    progressedMoonLongitude: 118,
    ageYears: 32.28,
    observedAt: Date.UTC(2026, 7, 15),
    phaseStartedAt: Date.UTC(2024, 4, 1),
    nextPhaseAt: Date.UTC(2027, 10, 1)
  });
  const ranking = buildTransitRankingLayerData({ contacts: [transit()], observedAt: TRANSIT_NOW });
  const arc = buildTransitArcLayerData({ contacts: [transit()], observedAt: TRANSIT_NOW });
  const currentMoon = buildCurrentMoonLayerData({
    chart: chart(),
    ephemeris: [ephemeris("sun", 200, "Libra", "Libra"), ephemeris("moon", 308, "Aquarius", "Acuario")]
  });
  const cumpleluna = buildCumplelunaLayerData({
    natalSunLongitude: 10,
    natalMoonLongitude: 78,
    currentSunLongitude: 100,
    currentMoonLongitude: 333,
    previousExactAt: TRANSIT_NOW - 18.5 * DAY,
    nextExactAt: TRANSIT_NOW + 11 * DAY,
    observedAt: TRANSIT_NOW,
    natalPrecision: "exact"
  });
  const mandala = buildTemporalMandalaData({
    observedAt: TRANSIT_NOW,
    progressedLunation: progressed.data,
    annualProfection: annual.data,
    cumpleluna: cumpleluna.data,
    transitArc: arc.data
  });
  const copy = stringValues([natal, annual, progressed, ranking, arc, currentMoon, mandala]).join(" ");

  assert.doesNotMatch(copy, /\b(?:efem[eé]ride|proveedor|whole sign|orbe|c[uú]spides?|ra[ií]ces calculadas?|pasadas?)\b/i);
  assert.doesNotMatch(
    copy,
    /Tres, no una enciclopedia|En Hoy ves los tres primeros|Toca una luminaria|toca el eje que te representa|Entra por regencia|todavía no manda|acomodar lo que se movió|VENTANA DEL PROVEEDOR|CÓMO SE TE NOTA|se entienden sin traducir|Se compensan y se irritan|Puede estructurarte o apagarte/i
  );
  assert.match(copy, /recorre una casa de tu carta por cada año de vida/);
  assert.match(copy, /contacto de \d+°/);
  assert.match(copy, /Cada anillo representa un ritmo personal distinto/);
  assert.match(copy, /Tu ritmo lunar/);
  assert.match(copy, /Cumpleluna personal/);
  assert.doesNotMatch(copy, /Ciclo lunar actual|fase de la Luna de hoy/i);
});
