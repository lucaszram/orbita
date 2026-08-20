import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MILLISECONDS_PER_DAY,
  SYNODIC_MONTH_DAYS,
  TROPICAL_YEAR_DAYS,
  annualProfectionForDate,
  angularDistanceDegrees,
  birthAnniversaryInYear,
  computeElementMap,
  elementForSign,
  findAngularCrossing,
  findBracketedRoot,
  findCumplelunaCrossing,
  findLunarPhaseBoundaryCrossing,
  interpolateAngularSample,
  interpolateCircularDegrees,
  interpolateLinear,
  lunarElongationDegrees,
  lunarIlluminationFraction,
  lunarIlluminationPercent,
  lunarPhaseAtElongation,
  nextLunarPhaseBoundaryDegrees,
  normalizeDegrees,
  normalizeZodiacSign,
  personalLunationPosition,
  previousLunarPhaseBoundaryDegrees,
  progressedBoundaryRange,
  resolveIntervalPrecision,
  resolveLunarPhaseInterval,
  secondaryProgressedInstant,
  observedInstantForProgressedBoundary,
  shortestSignedAngularDelta,
  traditionalRulerForSign,
  unwrapDegrees,
  type ElementMapInput
} from "../convex/lib/layersMath";

const closeTo = (actual: number, expected: number, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`
  );
};

describe("geometría angular", () => {
  it("normaliza cualquier vuelta a [0, 360) sin romper el cruce 359°/0°", () => {
    assert.equal(normalizeDegrees(0), 0);
    assert.equal(normalizeDegrees(360), 0);
    assert.equal(normalizeDegrees(721), 1);
    assert.equal(normalizeDegrees(-1), 359);
    assert.equal(normalizeDegrees(-720), 0);
    assert.throws(() => normalizeDegrees(Number.NaN), /finite number/);
  });

  it("calcula el delta corto y permite desenvolver una serie continua", () => {
    assert.equal(shortestSignedAngularDelta(359, 1), 2);
    assert.equal(shortestSignedAngularDelta(1, 359), -2);
    assert.equal(shortestSignedAngularDelta(0, 180), 180);
    assert.equal(angularDistanceDegrees(350, 10), 20);
    assert.equal(unwrapDegrees(359, 1), 361);
    assert.equal(unwrapDegrees(721, 359), 719);
  });
});

describe("elongación, iluminación y ocho fases lunares", () => {
  it("deriva la elongación Sol→Luna atravesando 0°", () => {
    assert.equal(lunarElongationDegrees(350, 10), 20);
    assert.equal(lunarElongationDegrees(10, 350), 340);
  });

  it("convierte 108° en ~65% de iluminación y Cuarto creciente", () => {
    closeTo(lunarIlluminationFraction(108), 0.6545084971874737);
    assert.equal(lunarIlluminationPercent(108), 65);
    assert.deepEqual(
      { id: lunarPhaseAtElongation(108).id, number: lunarPhaseAtElongation(108).number },
      { id: "first_quarter", number: 3 }
    );
  });

  it("respeta los ocho sectores semiabiertos de 45°", () => {
    assert.equal(lunarPhaseAtElongation(0).id, "new");
    assert.equal(lunarPhaseAtElongation(44.999).id, "new");
    assert.equal(lunarPhaseAtElongation(45).id, "waxing_crescent");
    assert.equal(lunarPhaseAtElongation(90).id, "first_quarter");
    assert.equal(lunarPhaseAtElongation(180).id, "full");
    assert.equal(lunarPhaseAtElongation(359.999).id, "waning_crescent");
    assert.equal(lunarIlluminationPercent(0), 0);
    assert.equal(lunarIlluminationPercent(180), 100);
  });
});

describe("precisión por intervalo", () => {
  it("entrega un estimado cuando todo el intervalo conserva la clasificación", () => {
    const result = resolveIntervalPrecision(["pisces", "pisces", "pisces"]);
    assert.deepEqual(result, {
      precision: "estimated",
      stable: true,
      value: "pisces",
      candidates: ["pisces"]
    });

    const phase = resolveLunarPhaseInterval(50, 80);
    assert.equal(phase.precision, "estimated");
    assert.equal(phase.value.id, "waxing_crescent");
  });

  it("entrega rango al cruzar un límite de fase, incluso 359°→0°", () => {
    const ordinary = resolveLunarPhaseInterval(44, 46);
    assert.equal(ordinary.precision, "range");
    assert.deepEqual(ordinary.candidates.map((phase) => phase.id), ["new", "waxing_crescent"]);

    const wrapped = resolveLunarPhaseInterval(359, 1);
    assert.equal(wrapped.precision, "range");
    assert.deepEqual(wrapped.candidates.map((phase) => phase.id), ["waning_crescent", "new"]);
  });

  it("no agrega el sector anterior si el intervalo descendente termina justo en el límite", () => {
    const result = resolveLunarPhaseInterval(50, 45);
    assert.equal(result.precision, "estimated");
    assert.equal(result.value.id, "waxing_crescent");

    const crossed = resolveLunarPhaseInterval(50, 44.9);
    assert.equal(crossed.precision, "range");
    assert.deepEqual(crossed.candidates.map((phase) => phase.id), ["waxing_crescent", "new"]);
  });

  it("no declara precisión cuando no recibió muestras", () => {
    assert.throws(() => resolveIntervalPrecision([]), /At least one/);
  });
});

describe("mapa elemental igualitario", () => {
  const canonical: ElementMapInput & { ascendant: string } = {
    sun: "Cáncer",
    moon: "Piscis",
    mercury: "Escorpio",
    venus: "Scorpio",
    mars: "Cancer",
    jupiter: "Pisces",
    saturn: "Tauro",
    uranus: "Virgo",
    neptune: "Capricornio",
    pluto: "Aries",
    ascendant: "Géminis"
  };

  it("cuenta exactamente una vez cada planeta de Sol a Plutón", () => {
    const result = computeElementMap(canonical);
    assert.equal(result.status, "complete");
    assert.equal(result.total, 10);
    assert.deepEqual(result.counts, { fire: 1, earth: 3, air: 0, water: 6 });
    assert.deepEqual(result.dominantElements, ["water"]);
    assert.deepEqual(result.missingElements, ["air"]);
    assert.equal(result.countedPlanets.includes("pluto"), true);
    assert.equal(result.countedPlanets.length, 10);
  });

  it("ignora Ascendente y degrada faltantes o signos inválidos como parcial", () => {
    const result = computeElementMap({ ...canonical, moon: undefined, pluto: "Ofiuco" });
    assert.equal(result.status, "partial");
    assert.equal(result.total, 8);
    assert.deepEqual(result.missingPlanets, ["moon"]);
    assert.deepEqual(result.invalidPlanets, ["pluto"]);
    assert.deepEqual(result.counts, { fire: 0, earth: 3, air: 0, water: 5 });
  });

  it("normaliza nombres ingleses y españoles sin cambiar sus elementos", () => {
    assert.equal(normalizeZodiacSign("  Géminis "), "gemini");
    assert.equal(normalizeZodiacSign("Acuario"), "aquarius");
    assert.equal(normalizeZodiacSign("Ofiuco"), null);
    assert.equal(elementForSign("gemini"), "air");
    assert.equal(elementForSign("scorpio"), "water");
  });
});

describe("profección anual Whole Sign", () => {
  it("activa Casa 7, Leo y el Sol a los seis años con Ascendente Acuario", () => {
    const result = annualProfectionForDate({
      birthDate: "1994-05-04",
      asOfDate: "2000-05-04",
      ascendantSign: "aquarius"
    });
    assert.deepEqual(result, {
      age: 6,
      house: 7,
      sign: "leo",
      ruler: "sun",
      periodStart: "2000-05-04",
      periodEnd: "2001-05-04"
    });
  });

  it("mantiene el año anterior hasta que llega el aniversario civil", () => {
    const result = annualProfectionForDate({
      birthDate: "1994-05-04",
      asOfDate: "2000-05-03",
      ascendantSign: "aquarius"
    });
    assert.equal(result.age, 5);
    assert.equal(result.house, 6);
    assert.equal(result.sign, "cancer");
    assert.equal(result.ruler, "moon");
    assert.equal(result.periodStart, "1999-05-04");
  });

  it("aplica Feb29→Feb28 en años no bisiestos y vuelve a Feb29 en 2024", () => {
    assert.deepEqual(birthAnniversaryInYear("2000-02-29", 2023), { year: 2023, month: 2, day: 28 });
    assert.deepEqual(birthAnniversaryInYear("2000-02-29", 2024), { year: 2024, month: 2, day: 29 });

    const before = annualProfectionForDate({
      birthDate: "2000-02-29",
      asOfDate: "2023-02-27",
      ascendantSign: "aries"
    });
    assert.equal(before.age, 22);
    assert.equal(before.periodEnd, "2023-02-28");

    const anniversary = annualProfectionForDate({
      birthDate: "2000-02-29",
      asOfDate: "2023-02-28",
      ascendantSign: "aries"
    });
    assert.equal(anniversary.age, 23);
    assert.equal(anniversary.periodStart, "2023-02-28");
    assert.equal(anniversary.periodEnd, "2024-02-29");
  });

  it("usa regencias tradicionales y rechaza fechas anteriores al nacimiento", () => {
    assert.equal(traditionalRulerForSign("scorpio"), "mars");
    assert.equal(traditionalRulerForSign("aquarius"), "saturn");
    assert.throws(
      () =>
        annualProfectionForDate({
          birthDate: "2000-01-01",
          asOfDate: "1999-12-31",
          ascendantSign: "aries"
        }),
      /cannot precede/
    );
  });
});

describe("progresión secundaria e interpolación", () => {
  it("avanza un día de efemérides por un año tropical real", () => {
    const birth = Date.UTC(2000, 0, 1, 12);
    const observed = birth + TROPICAL_YEAR_DAYS * MILLISECONDS_PER_DAY;
    const result = secondaryProgressedInstant(birth, observed);
    closeTo(result.elapsedRealDays, TROPICAL_YEAR_DAYS);
    closeTo(result.tropicalAgeYears, 1);
    closeTo(result.progressedElapsedDays, 1);
    closeTo(result.progressedInstantMs, birth + MILLISECONDS_PER_DAY, 0.001);
  });

  it("conserva la fracción de edad y rechaza observar antes del nacimiento", () => {
    const birth = Date.UTC(2000, 0, 1);
    const result = secondaryProgressedInstant(
      birth,
      birth + (TROPICAL_YEAR_DAYS / 2) * MILLISECONDS_PER_DAY
    );
    closeTo(result.progressedElapsedDays, 0.5);
    assert.throws(() => secondaryProgressedInstant(birth, birth - 1), /cannot precede/);
  });

  it("invierte la progresión y deriva el rango temporal completo sin elegir una hora", () => {
    const birthStart = Date.UTC(2000, 0, 1, 0, 0);
    const birthEnd = Date.UTC(2000, 0, 1, 23, 59);
    const observed = Date.UTC(2030, 0, 1, 12, 0);
    const progressed = secondaryProgressedInstant(birthStart, observed);

    closeTo(
      observedInstantForProgressedBoundary(
        birthStart,
        progressed.progressedInstantMs,
      ),
      observed,
      0.1,
    );

    const boundary = progressed.progressedInstantMs + MILLISECONDS_PER_DAY;
    const range = progressedBoundaryRange([birthStart, birthEnd], boundary);
    assert.ok(range.earliest < range.latest);
    closeTo(
      range.latest - range.earliest,
      (TROPICAL_YEAR_DAYS - 1) * (birthEnd - birthStart),
      0.1,
    );
    assert.throws(() => progressedBoundaryRange([], boundary), /cannot be empty/);
  });

  it("interpola valores y ángulos por el camino corto", () => {
    assert.equal(interpolateLinear(10, 20, 0.25), 12.5);
    assert.equal(interpolateCircularDegrees(359, 1, 0.5), 0);
    assert.equal(interpolateCircularDegrees(1, 359, 0.5), 0);
    assert.equal(
      interpolateAngularSample(
        { instantMs: 1_000, angleDegrees: 359 },
        { instantMs: 2_000, angleDegrees: 1 },
        1_750
      ),
      0.5
    );
    assert.throws(() => interpolateLinear(0, 1, 1.1), /within/);
    assert.throws(() => interpolateCircularDegrees(359, 1, -0.1), /within/);
  });
});

describe("búsqueda determinista de fronteras y raíces", () => {
  it("resuelve una raíz escalar acotada y rechaza un intervalo sin raíz", () => {
    const result = findBracketedRoot((value) => value * value - 2, 1, 2, {
      xTolerance: 1e-12,
      residualTolerance: 1e-12
    });
    closeTo(result.root, Math.SQRT2, 1e-10);
    assert.throws(() => findBracketedRoot((value) => value * value + 1, -1, 1), /not bracketed/);
  });

  it("encuentra el límite lunar de 45° dentro de una interpolación", () => {
    const result = findLunarPhaseBoundaryCrossing({
      elongationAt: (value) => 44 + 2 * value,
      boundaryDegrees: 45,
      lowerBound: 0,
      upperBound: 1,
      xTolerance: 1e-12
    });
    closeTo(result.root, 0.5, 1e-9);
    assert.equal(nextLunarPhaseBoundaryDegrees(44), 45);
    assert.equal(nextLunarPhaseBoundaryDegrees(45), 90);
    assert.equal(previousLunarPhaseBoundaryDegrees(45), 0);
    assert.equal(previousLunarPhaseBoundaryDegrees(46), 45);
  });

  it("encuentra un cruce 359°→0° sin confundir el antípoda", () => {
    const crossing = findAngularCrossing({
      angleAt: (value) => normalizeDegrees(359 + 2 * value),
      targetDegrees: 0,
      lowerBound: 0,
      upperBound: 1,
      xTolerance: 1e-12
    });
    closeTo(crossing.root, 0.5, 1e-9);

    assert.throws(
      () =>
        findAngularCrossing({
          angleAt: (value) => 170 + 20 * value,
          targetDegrees: 0,
          lowerBound: 0,
          upperBound: 1
        }),
      /not bracketed on the shortest arc/
    );
  });
});

describe("Cumpleluna personal", () => {
  it("mide el día del ciclo desde la elongación natal, no desde Luna nueva", () => {
    const natalElongation = 108;
    const expectedDay = 18.5;
    const currentElongation =
      natalElongation + (expectedDay / SYNODIC_MONTH_DAYS) * 360;
    const position = personalLunationPosition(natalElongation, currentElongation);
    closeTo(position.cycleDay, expectedDay, 1e-10);
    closeTo(position.cycleFraction, expectedDay / SYNODIC_MONTH_DAYS, 1e-12);
    closeTo(position.daysUntilNextCumpleluna, SYNODIC_MONTH_DAYS - expectedDay, 1e-10);
  });

  it("marca cero en la repetición exacta y refina el instante del próximo cruce", () => {
    assert.deepEqual(personalLunationPosition(108, 108), {
      cycleDegrees: 0,
      cycleFraction: 0,
      cycleDay: 0,
      daysUntilNextCumpleluna: 0
    });

    const result = findCumplelunaCrossing({
      currentElongationAt: (value) => 107 + 2 * value,
      natalElongationDegrees: 108,
      lowerBound: 0,
      upperBound: 1,
      xTolerance: 1e-12
    });
    closeTo(result.root, 0.5, 1e-9);
  });
});
