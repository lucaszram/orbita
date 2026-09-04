/**
 * CORE-192 — La Luna de hoy sobre la carta natal.
 *
 * Lo que se prueba es la MATEMÁTICA y el CONTRATO, no el proveedor: la llamada
 * a `planets/tropical` no se ejerce acá, se ejerce su respuesta grabada. Lo que
 * más importa es que el módulo no invente: sin hora exacta no hay casa, sin
 * carta no hay ciclo personal, sin credenciales no hay cielo, y el Cumpleluna
 * nunca sale sin su ventana.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLunaSobreLaCarta,
  chartHasExactBirthTime,
  elongationTravelDays,
  estimateCumplelunaTiming,
  hasLunaSkyCredentials,
  houseAtLongitude,
  isNumericTimezoneAlias,
  lunarElongationDegrees,
  lunarIlluminationFraction,
  lunarPhaseAtElongation,
  LUNA_SOBRE_LA_CARTA_METHOD_VERSION,
  LUNA_SOBRE_LA_CARTA_PROVIDER_VERSION,
  MEAN_ELONGATION_RATE_DEGREES_PER_DAY,
  NATAL_HALF_DAY_ELONGATION_DEGREES,
  normalizeDegrees,
  normalizeTropicalLuminaries,
  personalLunationPosition,
  planLunaSobreLaCartaContext,
  readCachedLuminaries,
  readLunaSkyConfig,
  resolveLocalNoonInstants,
  signAtLongitude,
  SYNODIC_MONTH_DAYS,
  type LocalDayInstants,
  type SkyLuminaries
} from "../convex/home";
import { resolveCanonicalDailyContext } from "../convex/daily";
import { getTimezoneOffsetHours } from "../convex/lib/astrologyApi";
import { hasLunaSobreLaCartaData, toLunaSobreLaCarta } from "../src/domain/homeAdapter";

const TZ = "America/Argentina/Buenos_Aires";
const LOCAL_DATE = "2026-09-03";
const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

/**
 * Respuesta grabada de `planets/tropical` en la forma documentada del
 * proveedor: arreglo plano, `full_degree` / `norm_degree` / `speed` / `is_retro`
 * en snake_case y el signo como etiqueta en inglés. Los valores son
 * representativos y coherentes entre sí (grado dentro del signo = full_degree
 * mod 30, velocidades dentro del rango real de cada cuerpo); lo que las pruebas
 * verifican es la matemática derivada, no una efeméride publicada.
 */
const RECORDED_PLANETS_TROPICAL = [
  { name: "Sun", full_degree: 161.2418, norm_degree: 11.2418, speed: 0.9761, is_retro: "false", sign: "Virgo" },
  { name: "Moon", full_degree: 350.4123, norm_degree: 20.4123, speed: 12.9034, is_retro: "false", sign: "Pisces" },
  { name: "Mercury", full_degree: 178.9042, norm_degree: 28.9042, speed: 1.2887, is_retro: "false", sign: "Virgo" },
  { name: "Venus", full_degree: 143.5561, norm_degree: 23.5561, speed: 1.1902, is_retro: "false", sign: "Leo" },
  { name: "Mars", full_degree: 195.0117, norm_degree: 15.0117, speed: 0.6604, is_retro: "false", sign: "Libra" },
  { name: "Jupiter", full_degree: 112.8449, norm_degree: 22.8449, speed: 0.1988, is_retro: "false", sign: "Cancer" },
  { name: "Saturn", full_degree: 1.3372, norm_degree: 1.3372, speed: -0.0421, is_retro: "true", sign: "Aries" }
];

/**
 * Carta natal como la guarda `natalCharts.payload` (ver
 * `normalizeAstrologyApiNatalChart`). Cúspides desiguales, al estilo Placidus
 * para una latitud austral: las casas de un lado del eje son más anchas que las
 * del otro, que es justo lo que un fixture de casas iguales no probaría.
 */
const NATAL_HOUSE_CUSPS = [
  { house: 1, degree: 298.37 },
  { house: 2, degree: 331.12 },
  { house: 3, degree: 4.85 },
  { house: 4, degree: 35.42 },
  { house: 5, degree: 63.79 },
  { house: 6, degree: 87.11 },
  { house: 7, degree: 118.37 },
  { house: 8, degree: 151.12 },
  { house: 9, degree: 184.85 },
  { house: 10, degree: 215.42 },
  { house: 11, degree: 243.79 },
  { house: 12, degree: 267.11 }
];

function natalChart(overrides: {
  birthTime?: string;
  birthTimePrecision?: string;
  calculationTimeSource?: string;
  houses?: Array<{ house: number; degree: number | null; theme?: string }>;
  placements?: Array<{ key: string; fullDegree: unknown }>;
} = {}) {
  return {
    // La carta guardada declara con qué hora se calculó: `noon_fallback` cuando
    // la hora natal faltaba o no parseaba, incluso si la persona la declaró
    // como exacta. Sin este campo la carta no puede sostener casas.
    calculationTimeSource: "calculationTimeSource" in overrides ? overrides.calculationTimeSource : "birth_time",
    birth: {
      birthDate: "1996-11-11",
      birthTime: "birthTime" in overrides ? overrides.birthTime : "10:32",
      birthTimePrecision: overrides.birthTimePrecision ?? "known",
      birthPlaceLabel: "Ciudad Autónoma de Buenos Aires, Argentina",
      latitude: -34.6037,
      longitude: -58.3816,
      timezone: TZ
    },
    placements:
      overrides.placements ??
      [
        { key: "sun", fullDegree: 229.44 },
        { key: "moon", fullDegree: 234.32 },
        { key: "ascendant", fullDegree: 298.37 }
      ],
    houses: overrides.houses ?? NATAL_HOUSE_CUSPS
  };
}

function instantsFor(localDate = LOCAL_DATE, timezone = TZ): LocalDayInstants {
  const resolved = resolveLocalNoonInstants(localDate, timezone);
  if (!resolved) throw new Error(`no se pudo resolver el mediodía local de ${localDate} en ${timezone}`);
  return resolved;
}

function recordedSky(): SkyLuminaries {
  const sky = normalizeTropicalLuminaries(RECORDED_PLANETS_TROPICAL);
  if (!sky) throw new Error("la respuesta grabada del proveedor tiene que producir Sol y Luna");
  return sky;
}

// ---------------------------------------------------------------------------
// Matemática pura
// ---------------------------------------------------------------------------

test("normalizeDegrees devuelve [0, 360) y rechaza lo que no es finito", () => {
  assert.equal(normalizeDegrees(0), 0);
  assert.equal(normalizeDegrees(360), 0);
  assert.equal(normalizeDegrees(-90), 270);
  assert.equal(normalizeDegrees(725), 5);
  // -0 y 0 son distintos para Object.is: un ángulo tiene que ser siempre 0.
  assert.equal(Object.is(normalizeDegrees(-360), 0), true);
  // Un negativo minúsculo no puede salir como 360: eso está fuera del intervalo.
  assert.equal(normalizeDegrees(-1e-20), 0);
  assert.throws(() => normalizeDegrees(Number.NaN), RangeError);
  assert.throws(() => normalizeDegrees(Number.POSITIVE_INFINITY), RangeError);
});

test("un valor que ya está en rango vuelve idéntico, bit a bit", () => {
  // Es lo que hace que un grado exactamente sobre una cúspide caiga en SU casa:
  // `((v % 360) + 360) % 360` devolvería un valor apenas distinto y la
  // comparación con el sector se iría a la casa anterior.
  for (const angle of [4.85, 331.12, 298.37, 350.4123, 0.1, 359.9999]) {
    assert.equal(normalizeDegrees(angle), angle);
    assert.equal(normalizeDegrees(angle) - angle, 0);
  }
});

test("la elongación Sol→Luna cruza el cero sin saltar de ciclo", () => {
  assert.equal(lunarElongationDegrees(350, 10), 20);
  assert.equal(lunarElongationDegrees(10, 350), 340);
  assert.equal(lunarElongationDegrees(120, 120), 0);
});

test("las ocho fases son sectores de 45° y el límite pertenece al sector siguiente", () => {
  assert.equal(lunarPhaseAtElongation(0).key, "new");
  assert.equal(lunarPhaseAtElongation(44.999).key, "new");
  assert.equal(lunarPhaseAtElongation(45).key, "waxing_crescent");
  assert.equal(lunarPhaseAtElongation(90).key, "first_quarter");
  assert.equal(lunarPhaseAtElongation(134.9).key, "first_quarter");
  assert.equal(lunarPhaseAtElongation(135).key, "waxing_gibbous");
  assert.equal(lunarPhaseAtElongation(180).key, "full");
  assert.equal(lunarPhaseAtElongation(225).key, "waning_gibbous");
  assert.equal(lunarPhaseAtElongation(270).key, "last_quarter");
  assert.equal(lunarPhaseAtElongation(315).key, "waning_crescent");
  assert.equal(lunarPhaseAtElongation(359.999).key, "waning_crescent");
  assert.equal(lunarPhaseAtElongation(360).key, "new");
});

test("la iluminación va de 0 en luna nueva a 1 en llena", () => {
  assert.equal(lunarIlluminationFraction(0), 0);
  assert.equal(lunarIlluminationFraction(180), 1);
  assert.ok(Math.abs(lunarIlluminationFraction(90) - 0.5) < 1e-12);
  assert.ok(Math.abs(lunarIlluminationFraction(270) - 0.5) < 1e-12);
});

test("el signo sale de la longitud, no de la etiqueta del proveedor", () => {
  assert.deepEqual(
    { key: signAtLongitude(0).key, degree: signAtLongitude(0).degreeInSign },
    { key: "aries", degree: 0 }
  );
  assert.equal(signAtLongitude(350.4123).label, "Piscis");
  assert.ok(Math.abs(signAtLongitude(350.4123).degreeInSign - 20.4123) < 1e-9);
  assert.equal(signAtLongitude(359.9999).label, "Piscis");
  assert.equal(signAtLongitude(229.44).label, "Escorpio");
});

// ---------------------------------------------------------------------------
// Límites de casas
// ---------------------------------------------------------------------------

test("una cúspide pertenece a su propia casa y el grado anterior a la casa previa", () => {
  assert.equal(houseAtLongitude(NATAL_HOUSE_CUSPS, 331.12)?.house, 2);
  assert.equal(houseAtLongitude(NATAL_HOUSE_CUSPS, 331.11)?.house, 1);
  assert.equal(houseAtLongitude(NATAL_HOUSE_CUSPS, 298.37)?.house, 1);
  assert.equal(houseAtLongitude(NATAL_HOUSE_CUSPS, 298.36)?.house, 12);
});

test("el sector que cruza 0° Aries no se parte en dos", () => {
  // La casa 2 va de 331.12° a 4.85°: pasa por el cero.
  assert.equal(houseAtLongitude(NATAL_HOUSE_CUSPS, 350.41)?.house, 2);
  assert.equal(houseAtLongitude(NATAL_HOUSE_CUSPS, 359.99)?.house, 2);
  assert.equal(houseAtLongitude(NATAL_HOUSE_CUSPS, 0)?.house, 2);
  assert.equal(houseAtLongitude(NATAL_HOUSE_CUSPS, 4.84)?.house, 2);
  assert.equal(houseAtLongitude(NATAL_HOUSE_CUSPS, 4.85)?.house, 3);
});

test("las doce cúspides son un requisito, no una preferencia", () => {
  assert.equal(houseAtLongitude(NATAL_HOUSE_CUSPS.slice(0, 11), 350.41), null);
  assert.equal(houseAtLongitude([], 350.41), null);
  assert.equal(houseAtLongitude(null, 350.41), null);

  const duplicated = [...NATAL_HOUSE_CUSPS.slice(0, 11), { house: 11, degree: 267.11 }];
  assert.equal(houseAtLongitude(duplicated, 350.41), null);

  const broken = NATAL_HOUSE_CUSPS.map((house) => (house.house === 4 ? { house: 4, degree: Number.NaN } : house));
  assert.equal(houseAtLongitude(broken, 350.41), null);
});

test("una cúspide sin grado invalida la carta en vez de volverse 0° de Aries", () => {
  // `NormalizedAstroHouse.degree` es `number | null`. Coaccionarlo con
  // `Number()` daría 0 —una cúspide perfectamente creíble en 0° de Aries— y la
  // Luna terminaría ubicada dentro de un sector que nadie calculó.
  // 350.41° cae en la casa 2, no en la 4: con `Number(null) === 0` la casa 4
  // habría quedado en 0° de Aries y la respuesta —«casa 2»— habría sonado sana
  // igual, con las doce cúspides «completas» y un sector movido.
  for (const degradado of [null, undefined, "4.85", "", true]) {
    const houses = NATAL_HOUSE_CUSPS.map((house) => (house.house === 4 ? { house: 4, degree: degradado } : house));
    assert.equal(houseAtLongitude(houses, 350.41), null, `una cúspide ${JSON.stringify(degradado)} no es un grado`);
  }

  // El mismo agujero del lado del número de casa: `Number(null)` es 0 y
  // `Number(true)` es 1, que sí es una casa válida.
  const casaFalsa = NATAL_HOUSE_CUSPS.map((house) => (house.house === 1 ? { house: true, degree: 298.37 } : house));
  assert.equal(houseAtLongitude(casaFalsa, 350.41), null);
});

test("una carta con una cúspide sin grado declara la falta y no publica casa", () => {
  const result = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants: instantsFor(),
    chart: natalChart({
      houses: NATAL_HOUSE_CUSPS.map((house) => (house.house === 4 ? { house: 4, degree: null } : house))
    }),
    sky: recordedSky()
  });

  assert.equal(result.status, "partial");
  assert.ok(result.missingInputs.includes("complete_natal_houses"));
  assert.equal(result.moonOnChart?.natalHouse, null);
  assert.equal(result.moonOnChart?.houseTheme, null);
  assert.deepEqual(result.moonOnChart?.housesToday, []);
});

test("sin tema propio la casa toma el del mapa canónico", () => {
  assert.equal(houseAtLongitude(NATAL_HOUSE_CUSPS, 350.41)?.theme, "recursos, cuerpo y valor propio");

  const withOwnTheme = NATAL_HOUSE_CUSPS.map((house) =>
    house.house === 2 ? { ...house, theme: "tema propio de la carta" } : house
  );
  assert.equal(houseAtLongitude(withOwnTheme, 350.41)?.theme, "tema propio de la carta");
});

// ---------------------------------------------------------------------------
// Ciclo de elongación y estimación del Cumpleluna
// ---------------------------------------------------------------------------

test("la posición en el ciclo personal se mide desde la elongación natal", () => {
  const position = personalLunationPosition(4.88, 189.1705);
  assert.ok(Math.abs(position.cycleDegrees - 184.2905) < 1e-9);
  assert.ok(Math.abs(position.remainingDegrees - 175.7095) < 1e-9);
  assert.ok(Math.abs(position.cycleFraction - 184.2905 / 360) < 1e-12);

  // Justo en el Cumpleluna no falta un ciclo entero: falta nada.
  const exact = personalLunationPosition(120, 120);
  assert.equal(exact.cycleDegrees, 0);
  assert.equal(exact.remainingDegrees, 0);
});

test("el ciclo personal cruza el cero igual que la elongación", () => {
  const position = personalLunationPosition(350, 10);
  assert.ok(Math.abs(position.cycleDegrees - 20) < 1e-9);
  assert.ok(Math.abs(position.remainingDegrees - 340) < 1e-9);
});

test("un ciclo completo tarda un mes sinódico medio y la ventana lo rodea", () => {
  const full = elongationTravelDays(360);
  assert.ok(Math.abs(full.days - SYNODIC_MONTH_DAYS) < 1e-9);
  assert.ok(full.window.from < full.days && full.days < full.window.to);
  // En un arco largo manda la ecuación del centro: la ventana queda MUCHO más
  // angosta que la que darían las velocidades extremas (24.7 a 33.6 días).
  assert.ok(full.window.from > 27 && full.window.to < 32);
});

test("en un arco corto mandan las velocidades extremas y la ventana se cierra", () => {
  const short = elongationTravelDays(1);
  assert.ok(Math.abs(short.window.from - 1 / 14.6) < 1e-9);
  assert.ok(Math.abs(short.window.to - 1 / 10.7) < 1e-9);
  assert.ok(short.window.to - short.window.from < 0.03);

  // Y la ventana crece de forma monótona con el arco: nunca al revés.
  const longer = elongationTravelDays(60);
  assert.ok(longer.window.to - longer.window.from > short.window.to - short.window.from);
});

test("el arco cero es hoy y el arco se recorta a [0, 360]", () => {
  assert.deepEqual(elongationTravelDays(0), { days: 0, window: { from: 0, to: 0 } });
  assert.deepEqual(elongationTravelDays(-10), { days: 0, window: { from: 0, to: 0 } });
  assert.ok(Math.abs(elongationTravelDays(1000).days - SYNODIC_MONTH_DAYS) < 1e-9);
});

test("el Cumpleluna estimado siempre queda adentro de su ventana", () => {
  const observedAt = Date.UTC(2026, 8, 3, 15, 0);
  const timing = estimateCumplelunaTiming({
    observedAt,
    natalElongationDegrees: 4.88,
    currentElongationDegrees: 189.1705
  });

  assert.ok(timing.previousExactAt < observedAt);
  assert.ok(timing.nextExactAt > observedAt);
  assert.ok(timing.nextExactAtWindow.earliest <= timing.nextExactAt);
  assert.ok(timing.nextExactAt <= timing.nextExactAtWindow.latest);
  assert.ok(timing.previousExactAtWindow.earliest <= timing.previousExactAt);
  assert.ok(timing.previousExactAt <= timing.previousExactAtWindow.latest);
  assert.ok(timing.nextExactAtWindow.latest > timing.nextExactAtWindow.earliest, "la ventana nunca es un instante");

  // El punto es exactamente el movimiento medio sobre el arco que falta.
  assert.ok(Math.abs(timing.daysRemaining - 175.7095 / MEAN_ELONGATION_RATE_DEGREES_PER_DAY) < 1e-9);
  assert.ok(Math.abs(timing.cycleLengthDays - SYNODIC_MONTH_DAYS) < 1e-9);
});

test("la duda sobre la elongación natal ensancha la ventana, nunca la achica", () => {
  const observedAt = Date.UTC(2026, 8, 3, 15, 0);
  const base = { observedAt, natalElongationDegrees: 4.88, currentElongationDegrees: 189.1705 };
  const exact = estimateCumplelunaTiming(base);
  const vague = estimateCumplelunaTiming({
    ...base,
    natalElongationToleranceDegrees: NATAL_HALF_DAY_ELONGATION_DEGREES
  });

  const exactWidth = exact.nextExactAtWindow.latest - exact.nextExactAtWindow.earliest;
  const vagueWidth = vague.nextExactAtWindow.latest - vague.nextExactAtWindow.earliest;
  assert.ok(vagueWidth > exactWidth);
  assert.ok(vague.nextExactAtWindow.earliest <= exact.nextExactAtWindow.earliest);
  assert.ok(vague.nextExactAtWindow.latest >= exact.nextExactAtWindow.latest);
  // El punto estimado no se mueve: lo que cambia es cuánto decimos saber.
  assert.equal(vague.nextExactAt, exact.nextExactAt);
});

test("si la duda cruza el Cumpleluna que viene, la ventana dice «puede ser ahora» y no salta un ciclo", () => {
  const observedAt = Date.UTC(2026, 8, 3, 15, 0);
  const timing = estimateCumplelunaTiming({
    observedAt,
    natalElongationDegrees: 100,
    // Faltan 2° para repetir la elongación natal, y la duda natal es de ±7.3°.
    currentElongationDegrees: 98,
    natalElongationToleranceDegrees: NATAL_HALF_DAY_ELONGATION_DEGREES
  });

  assert.equal(timing.nextExactAtWindow.earliest, observedAt, "el borde temprano se clava en el instante observado");
  assert.ok(timing.nextExactAtWindow.latest - observedAt < 1.5 * MS_PER_DAY);
  assert.ok(timing.nextExactAt >= timing.nextExactAtWindow.earliest);
});

test("si la duda cruza el Cumpleluna recién pasado, el borde tardío se clava en hoy", () => {
  const observedAt = Date.UTC(2026, 8, 3, 15, 0);
  const timing = estimateCumplelunaTiming({
    observedAt,
    natalElongationDegrees: 100,
    // Pasaron 2° desde la repetición, con la misma duda de ±7.3°.
    currentElongationDegrees: 102,
    natalElongationToleranceDegrees: NATAL_HALF_DAY_ELONGATION_DEGREES
  });

  assert.equal(timing.previousExactAtWindow.latest, observedAt);
  assert.ok(observedAt - timing.previousExactAtWindow.earliest < 1.5 * MS_PER_DAY);
  assert.ok(timing.previousExactAt <= observedAt);
});

// ---------------------------------------------------------------------------
// Respuesta grabada del proveedor
// ---------------------------------------------------------------------------

test("la respuesta grabada de planets/tropical produce Sol y Luna con velocidad", () => {
  const sky = recordedSky();

  assert.equal(sky.sun.key, "sun");
  assert.equal(sky.sun.sign, "Virgo");
  assert.ok(Math.abs(sky.sun.longitudeDegrees - 161.2418) < 1e-9);
  assert.ok(Math.abs(sky.sun.speedDegreesPerDay - 0.9761) < 1e-9);
  assert.equal(sky.sun.isRetrograde, false);

  assert.equal(sky.moon.key, "moon");
  assert.equal(sky.moon.sign, "Piscis");
  assert.ok(Math.abs(sky.moon.longitudeDegrees - 350.4123) < 1e-9);
  assert.ok(Math.abs(sky.moon.speedDegreesPerDay - 12.9034) < 1e-9);
  assert.ok(Math.abs(sky.moon.degreeInSign - 20.4123) < 1e-9);
});

test("también se acepta el sobre `{ planets: [...] }` del proveedor", () => {
  const sky = normalizeTropicalLuminaries({ planets: RECORDED_PLANETS_TROPICAL });
  assert.notEqual(sky, null);
  assert.ok(Math.abs(sky!.moon.longitudeDegrees - 350.4123) < 1e-9);
});

test("una respuesta incompleta o ambigua no se completa: falla cerrado", () => {
  const withoutMoon = RECORDED_PLANETS_TROPICAL.filter((planet) => planet.name !== "Moon");
  assert.equal(normalizeTropicalLuminaries(withoutMoon), null);

  const moonWithoutSpeed = RECORDED_PLANETS_TROPICAL.map(({ speed, ...rest }) =>
    rest.name === "Moon" ? rest : { ...rest, speed }
  );
  assert.equal(normalizeTropicalLuminaries(moonWithoutSpeed), null, "sin velocidad no se puede proyectar el día");

  const duplicatedSun = [...RECORDED_PLANETS_TROPICAL, RECORDED_PLANETS_TROPICAL[0]];
  assert.equal(normalizeTropicalLuminaries(duplicatedSun), null);

  assert.equal(normalizeTropicalLuminaries(null), null);
  assert.equal(normalizeTropicalLuminaries({ error: "quota exceeded" }), null);

  // Sol válido y Luna con una longitud que no es número: se cae igual.
  const brokenMoon = [RECORDED_PLANETS_TROPICAL[0], { name: "Moon", full_degree: "no-numérico", speed: 12 }];
  assert.equal(normalizeTropicalLuminaries(brokenMoon), null);
});

// ---------------------------------------------------------------------------
// Instante canónico y caché del cielo
// ---------------------------------------------------------------------------

test("el instante observado es el mediodía local, no el mediodía UTC", () => {
  const instants = instantsFor();
  assert.equal(instants.offsetHours, -3);
  assert.equal(instants.observedAt, Date.UTC(2026, 8, 3, 15, 0));
  assert.equal(instants.dayEndAt - instants.dayStartAt, MS_PER_DAY);
  assert.deepEqual({ year: instants.year, month: instants.month, day: instants.day }, { year: 2026, month: 9, day: 3 });
});

test("una fecha o una zona que no se pueden resolver devuelven null", () => {
  assert.equal(resolveLocalNoonInstants("3/9/2026", TZ), null);
  assert.equal(resolveLocalNoonInstants("2026-02-30", TZ), null, "Date.UTC normalizaría al 2 de marzo");
  assert.equal(resolveLocalNoonInstants("2026-13-01", TZ), null);
  assert.equal(resolveLocalNoonInstants(LOCAL_DATE, "No/EsUnaZona"), null);
  assert.equal(resolveLocalNoonInstants(LOCAL_DATE, ""), null, "una zona vacía no es el meridiano de Greenwich");
});

test("el caché global se relee con la misma exigencia que la respuesta cruda", () => {
  const instants = instantsFor();
  const payload = {
    methodVersion: LUNA_SOBRE_LA_CARTA_METHOD_VERSION,
    observedAt: instants.observedAt,
    luminaries: recordedSky()
  };

  const reread = readCachedLuminaries(payload, instants.observedAt);
  assert.notEqual(reread, null);
  assert.ok(Math.abs(reread!.moon.longitudeDegrees - 350.4123) < 1e-9);

  assert.equal(readCachedLuminaries(payload, instants.observedAt + 1), null, "otro instante es otro cielo");
  assert.equal(readCachedLuminaries({ ...payload, methodVersion: "otra-version" }, instants.observedAt), null);
  assert.equal(
    readCachedLuminaries({ ...payload, luminaries: { sun: payload.luminaries.sun } }, instants.observedAt),
    null
  );
  assert.equal(readCachedLuminaries(null, instants.observedAt), null);
});

test("sin credenciales el proveedor se considera no configurado", () => {
  assert.equal(hasLunaSkyCredentials(readLunaSkyConfig({})), false);
  assert.equal(hasLunaSkyCredentials(readLunaSkyConfig({ ASTROLOGY_API_USER_ID: "123" })), false);
  assert.equal(
    hasLunaSkyCredentials(readLunaSkyConfig({ ASTROLOGY_API_USER_ID: "123", ASTROLOGY_API_KEY: "secreta" })),
    true
  );
  assert.equal(readLunaSkyConfig({ ASTROLOGY_API_BASE_URL: "https://ejemplo.test/v1/" }).baseUrl, "https://ejemplo.test/v1");
});

// ---------------------------------------------------------------------------
// Contexto canónico: el día y la zona los elige el servidor
// ---------------------------------------------------------------------------
//
// Esto es lo que protege la llamada FACTURABLE a `planets/tropical` y la fila
// compartida de `globalSkyCaches`. Si el cliente pudiera elegir el día o la
// zona, cada variante abriría su propia fila —y su propia llamada paga— y
// encima mediría un cielo que no es el de hoy de esa persona. Los argumentos
// siguen existiendo por compatibilidad, pero sólo pueden CONFIRMAR lo que el
// servidor ya resolvió.

const CANONICAL = { localDate: LOCAL_DATE, timezone: TZ };
const CANONICAL_CACHE_KEY = {
  localDate: LOCAL_DATE,
  timezone: TZ,
  providerVersion: LUNA_SOBRE_LA_CARTA_PROVIDER_VERSION
};

function planFor(requested: { requestedLocalDate?: string; requestedTimezone?: string } = {}) {
  return planLunaSobreLaCartaContext({
    canonical: CANONICAL,
    providerVersion: LUNA_SOBRE_LA_CARTA_PROVIDER_VERSION,
    ...requested
  });
}

test("sin argumentos el contexto y la clave del caché son los del servidor", () => {
  const plan = planFor();

  assert.equal(plan.ok, true);
  assert.equal(plan.rejected, null);
  assert.equal(plan.localDate, LOCAL_DATE);
  assert.equal(plan.timezone, TZ);
  assert.deepEqual(plan.cacheKey, CANONICAL_CACHE_KEY);
});

test("el día canónico sale de la zona natal, no de la que mande el dispositivo", () => {
  // El mismo resolver que usa `daily.getTodayContext`: a las 23:30 de Buenos
  // Aires ya es el día siguiente en Madrid, y el módulo tiene que seguir
  // midiendo el día de la carta.
  const canonical = resolveCanonicalDailyContext({
    birthTimezone: TZ,
    latestGuide: null,
    now: new Date(Date.UTC(2026, 8, 4, 2, 30))
  });
  assert.deepEqual(canonical, { localDate: "2026-09-03", timezone: TZ });

  const plan = planLunaSobreLaCartaContext({
    canonical,
    requestedLocalDate: "2026-09-04",
    requestedTimezone: "Europe/Madrid",
    providerVersion: LUNA_SOBRE_LA_CARTA_PROVIDER_VERSION
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.cacheKey, null);
  assert.equal(plan.localDate, "2026-09-03");
  assert.equal(plan.timezone, TZ);
});

test("mandar exactamente el contexto canónico se acepta y no cambia nada", () => {
  const confirmado = planFor({ requestedLocalDate: LOCAL_DATE, requestedTimezone: TZ });
  assert.equal(confirmado.ok, true);
  assert.equal(confirmado.rejected, null);
  assert.deepEqual(confirmado.cacheKey, CANONICAL_CACHE_KEY);

  // Vacío o en blanco es «no lo mandaron», igual que omitirlo.
  for (const vacio of ["", "   "]) {
    const omitido = planFor({ requestedLocalDate: vacio, requestedTimezone: vacio });
    assert.equal(omitido.ok, true, `«${vacio}» tiene que leerse como ausente`);
    assert.deepEqual(omitido.cacheKey, CANONICAL_CACHE_KEY, `«${vacio}»`);
  }
});

test("otra fecha se rechaza: la de mañana, la de hace un año y la misma escrita distinto", () => {
  const otras = [
    "2026-09-04",
    "2026-09-02",
    "2027-01-01",
    "1996-11-11",
    // El MISMO día con otro formato también se rechaza: sería otra clave de
    // caché apuntando al mismo cielo, que es justo lo que hay que evitar.
    "2026-9-3",
    " 2026-09-03",
    "2026-09-03 ",
    "no-es-una-fecha"
  ];

  for (const requestedLocalDate of otras) {
    const plan = planFor({ requestedLocalDate });

    assert.equal(plan.ok, false, requestedLocalDate);
    assert.equal(plan.rejected, "local_date", requestedLocalDate);
    assert.equal(plan.cacheKey, null, `${requestedLocalDate}: un rechazo no deja clave con la que llamar`);
    assert.equal(plan.localDate, LOCAL_DATE, `${requestedLocalDate}: la salida sigue siendo la canónica`);
    assert.equal(plan.timezone, TZ, requestedLocalDate);
  }
});

test("otra zona se rechaza, incluso si nombra el mismo lugar", () => {
  const otras = [
    "America/New_York",
    "UTC",
    "Europe/Madrid",
    "america/argentina/buenos_aires",
    // Alias IANA del mismo lugar: mismo cielo, otra fila.
    "America/Buenos_Aires",
    `${TZ} `
  ];

  for (const requestedTimezone of otras) {
    const plan = planFor({ requestedTimezone });

    assert.equal(plan.ok, false, requestedTimezone);
    assert.equal(plan.rejected, "timezone", requestedTimezone);
    assert.equal(plan.cacheKey, null, requestedTimezone);
    assert.equal(plan.timezone, TZ, `${requestedTimezone}: la zona publicada sigue siendo la canónica`);
    assert.equal(plan.localDate, LOCAL_DATE, requestedTimezone);
  }
});

test("un alias numérico de zona no es una zona: mismo cielo, otra fila de caché", () => {
  const referencia = new Date(Date.UTC(2026, 8, 3, 15, 0));
  // Por qué el alias es peligroso y no un error visible: resuelve el MISMO
  // offset que la zona real, así que el pedido al proveedor saldría idéntico y
  // sólo cambiaría la clave con la que se guarda y se cobra.
  assert.equal(getTimezoneOffsetHours("-3", referencia), getTimezoneOffsetHours(TZ, referencia));
  assert.equal(
    resolveLocalNoonInstants(LOCAL_DATE, "-3")?.observedAt,
    resolveLocalNoonInstants(LOCAL_DATE, TZ)?.observedAt,
    "el alias produce un instante válido: por eso hay que frenarlo antes, no después"
  );

  for (const requestedTimezone of ["-3", "-3.0", "-03", " -3 ", "+0", "0"]) {
    const plan = planFor({ requestedTimezone });

    assert.equal(plan.ok, false, requestedTimezone);
    assert.equal(plan.rejected, "timezone", requestedTimezone);
    assert.equal(plan.cacheKey, null, requestedTimezone);
    assert.equal(plan.timezone, TZ, requestedTimezone);
  }

  // Decisión explícita: aunque el canónico fuera un offset —una zona natal ya
  // degradada—, el alias se rechaza igual. La zona la nombra el servidor y
  // omitir el argumento siempre sigue siendo válido.
  const canonicalNumerico = planLunaSobreLaCartaContext({
    canonical: { localDate: LOCAL_DATE, timezone: "-3" },
    requestedTimezone: "-3",
    providerVersion: LUNA_SOBRE_LA_CARTA_PROVIDER_VERSION
  });
  assert.equal(canonicalNumerico.ok, false);
  assert.equal(canonicalNumerico.cacheKey, null);
});

test("isNumericTimezoneAlias distingue un offset disfrazado de una zona real", () => {
  for (const alias of ["-3", "-3.0", "-03", " -3 ", "+2", "0", "5.5"]) {
    assert.equal(isNumericTimezoneAlias(alias), true, alias);
  }
  for (const zona of [TZ, "UTC", "Europe/Madrid", "", "   ", "no-es-una-zona", "Infinity"]) {
    assert.equal(isNumericTimezoneAlias(zona), false, zona);
  }
});

test("el rechazo pasa antes del caché y del proveedor: no queda ninguna clave", () => {
  // `planLunaSobreLaCartaContext` es el único lugar donde se arma la clave de
  // `globalSkyCaches`, y `lunaSobreLaCartaState` corta apenas viene en `null`:
  // sin clave no hay fila que leer ni escribir, y sin fila no se llega a la
  // llamada paga. Por eso alcanza con probar que ningún pedido produce una.
  const hostiles = [
    { requestedLocalDate: "2027-01-01" },
    { requestedLocalDate: "2026-09-04", requestedTimezone: TZ },
    { requestedTimezone: "-3" },
    { requestedTimezone: "UTC" },
    { requestedLocalDate: "2026-09-04", requestedTimezone: "Pacific/Auckland" }
  ];

  for (const hostil of hostiles) {
    const plan = planFor(hostil);
    assert.equal(plan.ok, false, JSON.stringify(hostil));
    assert.equal(plan.cacheKey, null, JSON.stringify(hostil));
  }
});

test("acepte o rechace, lo que sale es siempre el contexto del servidor", () => {
  const pedidos = [
    {},
    { requestedLocalDate: LOCAL_DATE },
    { requestedTimezone: TZ },
    { requestedLocalDate: "", requestedTimezone: "" },
    { requestedLocalDate: "2030-01-01" },
    { requestedTimezone: "-3" },
    { requestedLocalDate: "2030-01-01", requestedTimezone: "UTC" }
  ];

  for (const pedido of pedidos) {
    const plan = planFor(pedido);
    assert.equal(plan.localDate, LOCAL_DATE, JSON.stringify(pedido));
    assert.equal(plan.timezone, TZ, JSON.stringify(pedido));
    if (plan.cacheKey) assert.deepEqual(plan.cacheKey, CANONICAL_CACHE_KEY, JSON.stringify(pedido));
  }
});

// ---------------------------------------------------------------------------
// Ensamblado del contrato
// ---------------------------------------------------------------------------

const PROHIBIDO = ["suerte", "destino", "dinero", "salud", "curar", "garantiza", "vas a ganar"];

function assertSinClaims(text: string) {
  for (const palabra of PROHIBIDO) {
    assert.equal(text.toLowerCase().includes(palabra), false, `el copy no puede prometer «${palabra}»: ${text}`);
  }
}

test("con carta completa y hora exacta el módulo queda listo y ubica la Luna en una casa", () => {
  const result = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants: instantsFor(),
    chart: natalChart(),
    sky: recordedSky()
  });

  assert.equal(result.status, "ready");
  assert.equal(result.precision, "estimated", "el Cumpleluna nunca es exacto y arrastra la precisión del sobre");
  assert.equal(result.methodVersion, LUNA_SOBRE_LA_CARTA_METHOD_VERSION);
  assert.deepEqual(result.missingInputs, []);

  const moon = result.moonOnChart!;
  assert.equal(moon.natalHouse, 2);
  assert.equal(moon.houseTheme, "recursos, cuerpo y valor propio");
  assert.deepEqual(moon.housesToday, [2], "la Luna no cambia de casa durante ese día");
  assert.deepEqual(moon.signsToday, ["Piscis"]);
  assert.equal(moon.precision, "exact");
  // Elongación 189.1705°: 9.17° pasada la oposición, ~0.77 días después de la
  // llena exacta y con el disco al 99.4%. Cae en el sector [180, 225), así que
  // la fase es `full`; el menguante giboso arranca en 225°, con el disco al 85%.
  assert.equal(moon.phaseKey, "full");
  assert.ok(Math.abs(moon.elongationDegrees - 189.1705) < 1e-3);
  assert.ok(moon.illumination > 0.99 && moon.illumination <= 1);
  // 11.93°/día de elongación: el día entero cabe en el mismo sector de fase.
  assert.deepEqual(moon.phasesToday, ["full"]);
  assert.match(moon.summary, /casa 2/);
  assertSinClaims(moon.summary);

  const cumpleluna = result.cumpleluna!;
  assert.equal(cumpleluna.precision, "estimated");
  assert.equal(cumpleluna.natalElongationToleranceDegrees, 0);
  assert.ok(Math.abs(cumpleluna.natalElongationDegrees - 4.88) < 1e-3);
  assert.ok(cumpleluna.nextExactAt > result.observedAt!);
  assert.ok(cumpleluna.nextExactAtWindow.earliest <= cumpleluna.nextExactAt);
  assert.ok(cumpleluna.nextExactAt <= cumpleluna.nextExactAtWindow.latest);
  assert.ok(Math.abs(cumpleluna.elongationRateDegreesPerDay - (12.9034 - 0.9761)) < 1e-3);
  assert.match(cumpleluna.summary, /no un instante exacto/);
  assertSinClaims(cumpleluna.summary);

  // La ventana se publica siempre y es de horas, no de minutos ni de semanas.
  const windowHours = (cumpleluna.nextExactAtWindow.latest - cumpleluna.nextExactAtWindow.earliest) / MS_PER_HOUR;
  assert.ok(windowHours > 1 && windowHours < 72, `ventana inesperada: ${windowHours} h`);
});

test("sin hora exacta no se inventa una casa y el Cumpleluna pasa a rango", () => {
  const instants = instantsFor();
  const exact = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants,
    chart: natalChart(),
    sky: recordedSky()
  });
  const vague = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants,
    chart: natalChart({ birthTimePrecision: "unknown" }),
    sky: recordedSky()
  });

  assert.equal(vague.status, "partial");
  assert.equal(vague.precision, "range");
  assert.ok(vague.missingInputs.includes("exact_birth_time"));
  assert.equal(vague.moonOnChart?.natalHouse, null);
  assert.equal(vague.moonOnChart?.houseTheme, null);
  assert.deepEqual(vague.moonOnChart?.housesToday, []);
  assert.equal(vague.cumpleluna?.precision, "range");
  assert.ok(
    Math.abs(vague.cumpleluna!.natalElongationToleranceDegrees - NATAL_HALF_DAY_ELONGATION_DEGREES) < 1e-6,
    "la duda natal es media jornada a velocidad máxima de elongación"
  );

  const exactWidth = exact.cumpleluna!.nextExactAtWindow.latest - exact.cumpleluna!.nextExactAtWindow.earliest;
  const vagueWidth = vague.cumpleluna!.nextExactAtWindow.latest - vague.cumpleluna!.nextExactAtWindow.earliest;
  assert.ok(vagueWidth > exactWidth, "sin hora exacta la ventana tiene que abrirse, no cerrarse");
  assert.match(vague.moonOnChart!.summary, /Sin hora exacta/);
});

test("una hora declarada exacta no alcanza: manda con qué hora se calculó la carta", () => {
  // `birthTimePrecision` es lo que la persona DECLARÓ. Si la hora faltaba o no
  // parseaba, el backend calculó la carta al mediodía y lo dejó anotado en
  // `calculationTimeSource`. Cada una de estas cartas dice "known" y ninguna
  // puede sostener una casa ni un instante afilado.
  const sospechosas: Array<{ nombre: string; chart: ReturnType<typeof natalChart> }> = [
    { nombre: "calculada al mediodía", chart: natalChart({ calculationTimeSource: "noon_fallback" }) },
    { nombre: "sin el campo (carta vieja)", chart: natalChart({ calculationTimeSource: undefined }) },
    { nombre: "con un valor que no es del contrato", chart: natalChart({ calculationTimeSource: "unknown" }) },
    { nombre: "sin hora natal guardada", chart: natalChart({ birthTime: undefined }) },
    { nombre: "con una hora natal que no parsea", chart: natalChart({ birthTime: "10 y media" }) },
    { nombre: "con una hora natal fuera de rango", chart: natalChart({ birthTime: "25:99" }) }
  ];

  const exacta = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants: instantsFor(),
    chart: natalChart(),
    sky: recordedSky()
  });
  const anchoExacto = exacta.cumpleluna!.nextExactAtWindow.latest - exacta.cumpleluna!.nextExactAtWindow.earliest;

  for (const { nombre, chart } of sospechosas) {
    assert.equal(chart.birth.birthTimePrecision, "known", `${nombre}: la precisión declarada sigue siendo "known"`);
    assert.equal(chartHasExactBirthTime(chart), false, nombre);

    const result = buildLunaSobreLaCarta({
      localDate: LOCAL_DATE,
      timezone: TZ,
      instants: instantsFor(),
      chart,
      sky: recordedSky()
    });

    assert.equal(result.status, "partial", nombre);
    assert.equal(result.moonOnChart?.natalHouse, null, `${nombre}: sin hora real no hay casa`);
    assert.equal(result.moonOnChart?.houseTheme, null, nombre);
    assert.deepEqual(result.moonOnChart?.housesToday, [], nombre);
    assert.ok(result.missingInputs.includes("exact_birth_time"), nombre);

    const cumpleluna = result.cumpleluna!;
    assert.equal(cumpleluna.precision, "range", `${nombre}: nunca "estimated" con una hora que no se usó`);
    assert.ok(
      Math.abs(cumpleluna.natalElongationToleranceDegrees - NATAL_HALF_DAY_ELONGATION_DEGREES) < 1e-6,
      `${nombre}: la duda es media jornada a velocidad máxima (±7.3°)`
    );
    assert.ok(cumpleluna.natalElongationToleranceDegrees >= 7.3, nombre);
    assert.equal(result.precision, "range", nombre);

    const ancho = cumpleluna.nextExactAtWindow.latest - cumpleluna.nextExactAtWindow.earliest;
    assert.ok(ancho > anchoExacto, `${nombre}: la ventana tiene que abrirse, no quedarse en la de la hora exacta`);
    assertSinClaims(cumpleluna.summary);
    assertSinClaims(result.moonOnChart!.summary);
  }
});

test("la carta calculada al mediodía lo dice con esas palabras, sin contradecir lo que la persona cargó", () => {
  const result = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants: instantsFor(),
    chart: natalChart({ calculationTimeSource: "noon_fallback" }),
    sky: recordedSky()
  });

  assert.ok(result.limitations.some((limit) => limit.includes("se calculó al mediodía")));
  assert.equal(
    result.limitations.some((limit) => limit.startsWith("Sin hora exacta de nacimiento")),
    false,
    "quien cargó su hora no puede leer que no la cargó"
  );
});

test("chartHasExactBirthTime exige las tres señales a la vez", () => {
  assert.equal(chartHasExactBirthTime(natalChart()), true);
  assert.equal(chartHasExactBirthTime(natalChart({ birthTimePrecision: "approximate" })), false);
  assert.equal(chartHasExactBirthTime(natalChart({ birthTimePrecision: "unknown" })), false);
  assert.equal(chartHasExactBirthTime(natalChart({ calculationTimeSource: "noon_fallback" })), false);
  assert.equal(chartHasExactBirthTime(natalChart({ birthTime: "" })), false);
  assert.equal(chartHasExactBirthTime(null), false);
  assert.equal(chartHasExactBirthTime({}), false);
  // Una hora con una sola cifra de hora es válida: `normalizeBirthTime` la acepta.
  assert.equal(chartHasExactBirthTime(natalChart({ birthTime: "9:05" })), true);
});

test("una hora sólo aproximada se trata como no exacta: la carta se calculó con una hora que puede fallar", () => {
  const result = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants: instantsFor(),
    chart: natalChart({ birthTimePrecision: "approximate" }),
    sky: recordedSky()
  });

  assert.equal(result.status, "partial");
  assert.equal(result.moonOnChart?.natalHouse, null);
  assert.equal(result.cumpleluna?.precision, "range");
});

test("sin carta natal hay cielo pero no ciclo personal", () => {
  const result = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants: instantsFor(),
    chart: null,
    sky: recordedSky()
  });

  assert.equal(result.status, "needs_natal_chart");
  assert.equal(result.cumpleluna, null);
  assert.ok(result.missingInputs.includes("natal_chart"));
  assert.equal(result.moonOnChart?.sign, "Piscis");
  assert.equal(result.moonOnChart?.natalHouse, null);
  assert.match(result.moonOnChart!.summary, /carta natal/);
  assertSinClaims(result.moonOnChart!.summary);
});

test("una carta sin Sol o sin Luna natal no produce un Cumpleluna a medias", () => {
  const result = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants: instantsFor(),
    chart: natalChart({ placements: [{ key: "sun", fullDegree: 229.44 }] }),
    sky: recordedSky()
  });

  assert.equal(result.status, "partial");
  assert.equal(result.cumpleluna, null);
  assert.ok(result.missingInputs.includes("natal_sun_and_moon"));
  // La casa sí se puede: no depende de las luminarias natales.
  assert.equal(result.moonOnChart?.natalHouse, 2);
});

test("una luminaria natal sin grado falla cerrado y no se lee como 0° de Aries", () => {
  // `NormalizedAstroPlacement.fullDegree` es `number | null`: es exactamente lo
  // que guarda una carta a la que el proveedor no le devolvió el grado.
  // `Number(null)` es 0, así que sin el filtro el Cumpleluna saldría de una
  // elongación natal inventada —y encima creíble— en vez de no salir.
  for (const degradado of [null, undefined, "234.32", "", Number.NaN]) {
    const result = buildLunaSobreLaCarta({
      localDate: LOCAL_DATE,
      timezone: TZ,
      instants: instantsFor(),
      chart: natalChart({
        placements: [
          { key: "sun", fullDegree: 229.44 },
          { key: "moon", fullDegree: degradado },
          { key: "ascendant", fullDegree: 298.37 }
        ]
      }),
      sky: recordedSky()
    });

    assert.equal(result.cumpleluna, null, `una Luna natal ${JSON.stringify(degradado)} no es un grado`);
    assert.equal(result.status, "partial");
    assert.ok(result.missingInputs.includes("natal_sun_and_moon"));
    assert.notEqual(result.precision, "not_applicable", "el sobre sigue trayendo la Luna del día");
    // La casa no depende de las luminarias natales: eso se sigue publicando.
    assert.equal(result.moonOnChart?.natalHouse, 2);
  }
});

test("el Sol natal sin grado tampoco arma un ciclo personal", () => {
  const result = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants: instantsFor(),
    chart: natalChart({
      placements: [
        { key: "sun", fullDegree: null },
        { key: "moon", fullDegree: 234.32 }
      ]
    }),
    sky: recordedSky()
  });

  assert.equal(result.cumpleluna, null);
  assert.ok(result.missingInputs.includes("natal_sun_and_moon"));
  assert.ok(
    result.limitations.some((limit) => limit.includes("Sol o la Luna natal")),
    "la falta se explica en vez de resolverse sola"
  );
});

test("con hora exacta pero casas incompletas se declara la falta en vez de estimar la casa", () => {
  const result = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants: instantsFor(),
    chart: natalChart({ houses: NATAL_HOUSE_CUSPS.slice(0, 11) }),
    sky: recordedSky()
  });

  assert.equal(result.status, "partial");
  assert.ok(result.missingInputs.includes("complete_natal_houses"));
  assert.equal(result.moonOnChart?.natalHouse, null);
});

test("si la Luna cambia de casa durante el día se publican las dos y la precisión baja a rango", () => {
  // La Luna arranca el día antes de la cúspide de la casa 3 (4.85°) y la cruza:
  // al mediodía todavía está en la 2 y al final del día ya está en la 3.
  const sky = recordedSky();
  const crossing: SkyLuminaries = {
    sun: sky.sun,
    moon: { ...sky.moon, longitudeDegrees: 2.0, sign: "Aries", signKey: "aries", degreeInSign: 2.0 }
  };

  const result = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants: instantsFor(),
    chart: natalChart(),
    sky: crossing
  });

  assert.deepEqual(result.moonOnChart?.housesToday, [2, 3]);
  assert.equal(result.moonOnChart?.natalHouse, 2, "la casa publicada es la del instante observado");
  assert.equal(result.moonOnChart?.precision, "range");
  assert.equal(result.status, "ready", "cambiar de casa no es un insumo faltante: es menos precisión");
  assert.match(result.moonOnChart!.summary, /cambia de casa/);
  assert.ok(result.limitations.some((limit) => limit.includes("cambia de casa")));
  assertSinClaims(result.moonOnChart!.summary);
});

test("si la Luna cambia de signo durante el día, el sobre lo dice", () => {
  const sky = recordedSky();
  const crossing: SkyLuminaries = {
    sun: sky.sun,
    // 358° con 12.9°/día: arranca en Piscis y termina en Aries.
    moon: { ...sky.moon, longitudeDegrees: 358, sign: "Piscis", signKey: "pisces", degreeInSign: 28 }
  };

  const result = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants: instantsFor(),
    chart: natalChart(),
    sky: crossing
  });

  assert.deepEqual(result.moonOnChart?.signsToday, ["Piscis", "Aries"]);
  assert.equal(result.moonOnChart?.precision, "range");
});

test("cuando la fase cambia dentro del día, las dos quedan publicadas", () => {
  const sky = recordedSky();
  // Elongación al mediodía ≈ 44.5°: el sector de 45° se cruza durante el día.
  const nearBoundary: SkyLuminaries = {
    sun: sky.sun,
    moon: { ...sky.moon, longitudeDegrees: normalizeDegrees(sky.sun.longitudeDegrees + 44.5) }
  };

  const result = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants: instantsFor(),
    chart: natalChart(),
    sky: nearBoundary
  });

  assert.deepEqual(result.moonOnChart?.phasesToday, ["new", "waxing_crescent"]);
  assert.equal(result.moonOnChart?.phaseKey, "new", "la fase publicada es la del instante observado");
});

// ---------------------------------------------------------------------------
// Adaptador del front
// ---------------------------------------------------------------------------

test("el adaptador acepta el sobre real del backend sin perder datos", () => {
  const result = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants: instantsFor(),
    chart: natalChart(),
    sky: recordedSky()
  });
  // Round-trip por JSON: es exactamente lo que viaja de Convex al cliente.
  const adapted = toLunaSobreLaCarta(JSON.parse(JSON.stringify(result)));

  assert.notEqual(adapted, null);
  assert.equal(hasLunaSobreLaCartaData(adapted), true);
  assert.equal(adapted!.status, "ready");
  assert.equal(adapted!.moonOnChart?.natalHouse, 2);
  assert.equal(adapted!.cumpleluna?.nextExactAt, result.cumpleluna!.nextExactAt);
  assert.deepEqual(adapted!.cumpleluna?.nextExactAtWindow, result.cumpleluna!.nextExactAtWindow);
});

test("el adaptador tira el Cumpleluna que llega sin ventana y conserva el resto del sobre", () => {
  const result = JSON.parse(
    JSON.stringify(
      buildLunaSobreLaCarta({
        localDate: LOCAL_DATE,
        timezone: TZ,
        instants: instantsFor(),
        chart: natalChart(),
        sky: recordedSky()
      })
    )
  );
  delete result.cumpleluna.nextExactAtWindow;

  const adapted = toLunaSobreLaCarta(result);
  assert.notEqual(adapted, null);
  assert.equal(adapted!.cumpleluna, null, "un instante sin ventana es justo la promesa que el módulo evita");
  assert.notEqual(adapted!.moonOnChart, null);
  assert.equal(adapted!.status, "ready");
});

test("el adaptador sanea una casa imposible en vez de mostrarla", () => {
  const result: any = JSON.parse(
    JSON.stringify(
      buildLunaSobreLaCarta({
        localDate: LOCAL_DATE,
        timezone: TZ,
        instants: instantsFor(),
        chart: natalChart(),
        sky: recordedSky()
      })
    )
  );
  result.moonOnChart.natalHouse = 0;

  const adapted = toLunaSobreLaCarta(result);
  assert.equal(adapted?.moonOnChart?.natalHouse, null);
  assert.equal(adapted?.moonOnChart?.houseTheme, null);
});

test("un sobre que no es el contrato no se adapta a la fuerza", () => {
  assert.equal(toLunaSobreLaCarta(null), null);
  assert.equal(toLunaSobreLaCarta("ready"), null);
  assert.equal(toLunaSobreLaCarta({ status: "inventado", precision: "exact" }), null);
  assert.equal(toLunaSobreLaCarta({ status: "ready" }), null, "falta la precisión");
  assert.equal(hasLunaSobreLaCartaData(null), false);
  assert.equal(
    hasLunaSobreLaCartaData(toLunaSobreLaCarta({ status: "not_configured", precision: "not_applicable" })),
    false
  );
});

test("un estado fallido del backend llega íntegro al front", () => {
  const adapted = toLunaSobreLaCarta({
    methodVersion: LUNA_SOBRE_LA_CARTA_METHOD_VERSION,
    providerVersion: "astrologyapi-planets-tropical-luna-carta-v1",
    status: "not_configured",
    precision: "not_applicable",
    localDate: LOCAL_DATE,
    timezone: TZ,
    observedAt: null,
    moonOnChart: null,
    cumpleluna: null,
    missingInputs: ["astrologyapi_credentials_not_configured"],
    limitations: ["El proveedor astrológico no está configurado: no inventamos las posiciones del día."]
  });

  assert.equal(adapted?.status, "not_configured");
  assert.equal(adapted?.observedAt, null);
  assert.deepEqual(adapted?.missingInputs, ["astrologyapi_credentials_not_configured"]);
  assert.equal(hasLunaSobreLaCartaData(adapted), false);
});

test("un día con la Luna cerca de la cúspide 1 no se cuela en la casa 12 por redondeo", () => {
  // Control de borde: exactamente sobre el Ascendente la Luna está en la casa 1.
  const sky = recordedSky();
  const onAscendant: SkyLuminaries = {
    sun: sky.sun,
    moon: { ...sky.moon, longitudeDegrees: 298.37, speedDegreesPerDay: 0.0001 }
  };

  const result = buildLunaSobreLaCarta({
    localDate: LOCAL_DATE,
    timezone: TZ,
    instants: instantsFor(),
    chart: natalChart(),
    sky: onAscendant
  });

  assert.equal(result.moonOnChart?.natalHouse, 1);
  // El día empieza un pelo antes del Ascendente: eso es casa 12, y se publica.
  assert.deepEqual(result.moonOnChart?.housesToday, [12, 1]);
});
