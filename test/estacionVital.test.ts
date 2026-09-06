/**
 * Tu momento · Estación vital (CORE-209), lado del backend.
 *
 * `buildEstacionVital` se ejecuta de verdad sobre un proveedor de efemérides
 * SINTÉTICO: Sol y Luna con movimiento lineal (velocidades medias). Con eso se
 * afirma la fase, el ángulo, la duración de la fase (45° a ~12,19°/día
 * progresado ≈ 3,7 años), las fechas y —sobre todo— lo que NO se inventa: sin
 * fecha, sin hora usable, día natal que cruza un límite, proveedor caído.
 * También el normalizador de `planets/tropical`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildEstacionVital, certifiesSingleLunarPhase, PHASE_KEY_BY_ID, PHASE_NAME } from "../convex/lib/estacionVital";
import { lunarElongationDegrees, lunarPhaseAtElongation, MILLISECONDS_PER_DAY, TROPICAL_YEAR_DAYS } from "../convex/lib/layersMath";
import { normalizeAstrologyApiTropicalPositions, type EphemerisPosition } from "../convex/lib/tropicalEphemeris";

const SUN_SPEED = 0.9856;
const MOON_SPEED = 13.1764;

/** Efemérides sintéticas: longitudes lineales desde `epochMs`. */
function proveedor(args: { epochMs: number; sunAtEpoch: number; moonAtEpoch: number; fallaEn?: (ms: number) => boolean }) {
  const llamadas: number[] = [];
  const tropicalAt = async (instantMs: number): Promise<readonly EphemerisPosition[] | null> => {
    llamadas.push(instantMs);
    if (args.fallaEn?.(instantMs)) return null;
    const days = (instantMs - args.epochMs) / MILLISECONDS_PER_DAY;
    const sun = ((args.sunAtEpoch + SUN_SPEED * days) % 360 + 360) % 360;
    const moon = ((args.moonAtEpoch + MOON_SPEED * days) % 360 + 360) % 360;
    const pos = (key: string, label: string, fullDegree: number, speed: number): EphemerisPosition => ({
      key,
      label,
      sign: "Aries",
      signEs: "Aries",
      degree: fullDegree % 30,
      fullDegree,
      speed,
      isRetrograde: false
    });
    return [pos("sun", "Sol", sun, SUN_SPEED), pos("moon", "Luna", moon, MOON_SPEED)];
  };
  return { tropicalAt, llamadas };
}

const NACIMIENTO = Date.UTC(1990, 0, 15, 13, 0); // 1990-01-15 10:00 en Buenos Aires (-03)
const birth = {
  birthDate: "1990-01-15",
  birthTime: "10:00",
  birthTimePrecision: "known" as const,
  timezone: "America/Argentina/Buenos_Aires",
  latitude: -34.6,
  longitude: -58.4
};

describe("la estación vital con hora exacta", () => {
  // A los 30,5 años tropicales el Sol progresado avanzó 30,5 días de efemérides.
  const observedAt = NACIMIENTO + 30.5 * TROPICAL_YEAR_DAYS * MILLISECONDS_PER_DAY;
  // Elongación natal 0° (luna nueva natal); a 30,5 días progresados: 12,19 × 30,5 ≈ 371,8° → 11,8° → fase nueva.
  const p = proveedor({ epochMs: NACIMIENTO, sunAtEpoch: 100, moonAtEpoch: 100 });

  it("certifica la fase, el ángulo progresado y una fase de unos 3,7 años con fechas reales", async () => {
    const r = await buildEstacionVital({ birth, observedAt, tropicalAt: p.tropicalAt });
    assert.equal(r.status, "ready");
    if (r.status !== "ready") return;
    assert.equal(r.precision, "exact");
    assert.equal(r.phaseKey, "new");
    assert.equal(r.name, "Nueva");
    assert.ok(r.progressedElongationDegrees > 10 && r.progressedElongationDegrees < 14, String(r.progressedElongationDegrees));
    assert.ok(Math.abs(r.phaseYears - 3.69) < 0.1, `fase de ${r.phaseYears} años`);
    assert.ok(r.phaseStartedAt < observedAt && observedAt < r.nextPhaseAt, "la fecha de hoy cae dentro de la fase");
    assert.ok(Math.abs(r.ageYears - 30.5) < 0.01);
    assert.ok(r.yearsIntoPhase > 0.8 && r.yearsIntoPhase < 1.2, String(r.yearsIntoPhase));
    assert.ok(r.progress > 0.2 && r.progress < 0.35, String(r.progress));
    assert.equal(r.phaseStartedAtRange, undefined, "con hora exacta no hay rango");
    assert.equal(r.limitations.length, 1);
  });

  it("sólo llama al proveedor cinco veces: la muestra de hoy y dos por cada límite de fase", async () => {
    const q = proveedor({ epochMs: NACIMIENTO, sunAtEpoch: 100, moonAtEpoch: 100 });
    await buildEstacionVital({ birth, observedAt, tropicalAt: q.tropicalAt });
    assert.equal(q.llamadas.length, 5);
  });

  it("si el proveedor no responde para hoy, el dato se retira en vez de estimarse", async () => {
    const q = proveedor({ epochMs: NACIMIENTO, sunAtEpoch: 100, moonAtEpoch: 100, fallaEn: () => true });
    const r = await buildEstacionVital({ birth, observedAt, tropicalAt: q.tropicalAt });
    assert.equal(r.status, "unavailable");
    if (!("missingInputs" in r)) return;
    assert.deepEqual(r.missingInputs, ["progressed_ephemeris"]);
  });

  it("si falla la muestra de un límite, no se publica una fecha falsa", async () => {
    let n = 0;
    const q = proveedor({ epochMs: NACIMIENTO, sunAtEpoch: 100, moonAtEpoch: 100, fallaEn: () => ++n > 1 });
    const r = await buildEstacionVital({ birth, observedAt, tropicalAt: q.tropicalAt });
    assert.equal(r.status, "unavailable");
    if (!("missingInputs" in r)) return;
    assert.deepEqual(r.missingInputs, ["progressed_phase_roots"]);
  });

  it("cada una de las ocho fases tiene clave editorial y nombre", () => {
    const ids = Object.keys(PHASE_KEY_BY_ID);
    assert.equal(ids.length, 8);
    for (const id of ids) assert.ok(PHASE_NAME[PHASE_KEY_BY_ID[id as keyof typeof PHASE_KEY_BY_ID]]);
    assert.equal(PHASE_NAME[PHASE_KEY_BY_ID[lunarPhaseAtElongation(230).id]], "Diseminante");
    assert.equal(PHASE_NAME[PHASE_KEY_BY_ID[lunarPhaseAtElongation(200).id]], "Llena");
  });
});

describe("sin hora exacta", () => {
  const sinHora = { ...birth, birthTime: null, birthTimePrecision: "unknown" as const };

  it("tres muestras del día natal en la misma fase y lejos del límite: fase firme con fechas en rango", async () => {
    const observedAt = NACIMIENTO + 31 * TROPICAL_YEAR_DAYS * MILLISECONDS_PER_DAY;
    const p = proveedor({ epochMs: NACIMIENTO, sunAtEpoch: 100, moonAtEpoch: 100 });
    const r = await buildEstacionVital({ birth: sinHora, observedAt, tropicalAt: p.tropicalAt });
    assert.equal(r.status, "ready");
    if (r.status !== "ready") return;
    assert.equal(r.precision, "range");
    assert.ok(r.phaseStartedAtRange && r.nextPhaseAtRange, "cada fecha viaja con su rango");
    assert.ok(r.phaseStartedAtRange!.earliest <= r.phaseStartedAt && r.phaseStartedAt <= r.phaseStartedAtRange!.latest);
    assert.ok(r.progressedElongationRangeDegrees, "la elongación viaja con su rango");
    assert.equal(r.limitations.length, 2);
  });

  it("si el día natal cruza un límite de fase, se dicen las fases posibles y no se elige una", async () => {
    // Elongación natal ≈ 44,7° a las 12:00: 00:00 y 23:59 quedan a ambos lados de 45°.
    const observedAt = NACIMIENTO + 30 * TROPICAL_YEAR_DAYS * MILLISECONDS_PER_DAY;
    const p = proveedor({ epochMs: NACIMIENTO, sunAtEpoch: 100, moonAtEpoch: 100 + 44.7 - 12.19 * 30 + 360 * 2 });
    const r = await buildEstacionVital({ birth: sinHora, observedAt, tropicalAt: p.tropicalAt });
    assert.equal(r.status, "partial");
    if (!("missingInputs" in r)) return;
    assert.equal(r.precision, "range");
    assert.ok(r.possiblePhases && r.possiblePhases.length >= 1);
    assert.match(r.limitations[0], /según la hora de nacimiento|demasiado cerca de un cambio de fase/);
  });

  it("certifiesSingleLunarPhase rechaza muestras en fases distintas o pegadas al límite", () => {
    const instants = [0, 12 * 3_600_000, 24 * 3_600_000];
    const ok = { instants, sun: [0, 0.5, 1], moon: [20, 26.5, 33], sunSpeed: [1, 1, 1], moonSpeed: [13, 13, 13] };
    assert.equal(certifiesSingleLunarPhase(ok), true);
    const cruza = { ...ok, moon: [40, 46.5, 53] };
    assert.equal(certifiesSingleLunarPhase(cruza), false);
    const pegada = { ...ok, moon: [36, 42.5, 44.9] };
    assert.equal(certifiesSingleLunarPhase(pegada), false);
    assert.equal(lunarPhaseAtElongation(lunarElongationDegrees(0, 44.9)).id, "new");
  });
});

describe("lo que no se calcula", () => {
  it("sin datos natales: needs_birth_data", async () => {
    const r = await buildEstacionVital({ birth: null, observedAt: Date.now(), tropicalAt: async () => null });
    assert.equal(r.status, "needs_birth_data");
  });

  it("hora declarada exacta pero vacía: needs_birth_time", async () => {
    const r = await buildEstacionVital({ birth: { ...birth, birthTime: null }, observedAt: Date.now(), tropicalAt: async () => null });
    assert.equal(r.status, "needs_birth_time");
  });

  it("proveedor no configurado: not_configured antes de muestrear", async () => {
    let llamadas = 0;
    const r = await buildEstacionVital({
      birth,
      observedAt: Date.now(),
      providerConfigured: false,
      tropicalAt: async () => {
        llamadas += 1;
        return null;
      }
    });
    assert.equal(r.status, "not_configured");
    assert.equal(llamadas, 0);
  });

  it("una observación anterior al nacimiento se rechaza", async () => {
    const r = await buildEstacionVital({ birth, observedAt: NACIMIENTO - MILLISECONDS_PER_DAY, tropicalAt: async () => null });
    assert.equal(r.status, "unavailable");
    if (!("missingInputs" in r)) return;
    assert.deepEqual(r.missingInputs, ["valid_birth_instant"]);
  });
});

describe("el normalizador de planets/tropical", () => {
  it("lee nombre, longitud y velocidad con los alias del proveedor y ordena los diez cuerpos", () => {
    const raw = [
      { name: "Moon", fullDegree: 380.5, speed: 13.2, isRetro: "false" },
      { planet: "Sol", full_degree: 10.25, planet_speed: "0.98" },
      { name: "Marte", longitude: 200, speed: -0.2, is_retro: "true" }
    ];
    const positions = normalizeAstrologyApiTropicalPositions(raw);
    assert.deepEqual(
      positions.map((p) => p.key),
      ["sun", "moon", "mars"]
    );
    assert.equal(positions[1].fullDegree, 20.5);
    assert.equal(positions[1].isRetrograde, false);
    assert.equal(positions[2].isRetrograde, true);
    assert.equal(positions[0].signEs, "Aries");
  });

  it("descarta entradas sin nombre, longitud o velocidad", () => {
    const raw = { planets: [{ name: "Venus", fullDegree: 10 }, { fullDegree: 10, speed: 1 }, { name: "Jupiter", speed: 0.1 }] };
    assert.deepEqual(normalizeAstrologyApiTropicalPositions(raw), []);
  });
});
