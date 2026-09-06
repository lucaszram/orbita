/**
 * Tu momento · Tus cuatro ritmos (CORE-211), lado del backend. Puro: el
 * mandala describe los cuatro análisis que ya corrieron; un ritmo sin cálculo
 * queda vacío con su motivo, nunca estimado.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { avanceDelTransito, buildCuatroRitmos, etiquetaDeFase, ORDEN_DE_ANILLOS } from "../convex/lib/cuatroRitmos";
import type { EstacionVital } from "../convex/lib/estacionVital";
import type { TemaDelAno } from "../convex/lib/temaDelAno";
import type { TransitPanorama, TransitPanoramaRow } from "../convex/lib/transitPanorama";

const HOY = Date.UTC(2026, 8, 6, 12);

const estacion: EstacionVital = {
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
  observedAt: HOY,
  limitations: ["Las funciones de fase pueden repetirse; los hechos concretos no tienen por qué repetirse."]
};

const tema: TemaDelAno = {
  status: "ready",
  precision: "exact",
  age: 31,
  house: 6,
  houseTheme: "rutinas, tareas, cuidado y trabajo cotidiano",
  sign: "Géminis",
  signKey: "gemini",
  ruler: "Mercurio",
  rulerKey: "mercury",
  periodStart: Date.UTC(2025, 10, 11),
  periodEnd: Date.UTC(2026, 10, 11),
  periodStartDate: "2025-11-11",
  periodEndDate: "2026-11-11",
  monthIndex: 10,
  progress: 0.82,
  summary: "La profección anual…",
  limitations: ["Requiere hora natal exacta para conocer el Ascendente y las casas."],
  observedAt: HOY
};

const lunar = {
  cumpleluna: {
    cycleFraction: 0.67,
    cycleDay: 19.7,
    // Con hora exacta la ventana igual tiene ancho: la velocidad de la Luna varía dentro del ciclo.
    cycleDayWindowDays: { from: 18.3, to: 21.0 },
    cycleLengthDays: 29.4,
    daysRemaining: 9.7,
    daysRemainingWindowDays: { from: 8.4, to: 11.1 },
    precision: "estimated" as const
  },
  limitations: ["No es un retorno lunar: no busca que la Luna vuelva a su longitud natal."]
};

const fila = (extra: Partial<TransitPanoramaRow> = {}): TransitPanoramaRow => ({
  transitId: "t1",
  rank: 1,
  title: "Luna conjunción tu Marte",
  transitPlanet: "Luna",
  natalPoint: "Marte",
  aspectType: "conjunction",
  aspectEs: "conjunción",
  aspectAngle: 0,
  natalHouse: 3,
  phase: "exacto",
  peakLabel: "EXACTO HOY",
  closeness: 0.96,
  cadence: "Cambia dentro del día",
  body: "La Luna pasa hoy por tu Marte.",
  startTime: "2026-09-06 06:00",
  exactTime: "2026-09-06 12:00",
  endTime: "2026-09-06 18:00",
  ...extra
});

const AHORA = "2026-09-06 09:00";
const panorama: TransitPanorama = { status: "ready", localDate: "2026-09-06", count: 1, rows: [fila()], activeTotal: 16, cadence: "Cambia a diario", access: { isPro: true, personalized: true } };

describe("los cuatro anillos con cálculo", () => {
  it("van del más lento al más rápido, con estado, avance en punto y detalle propios", () => {
    const r = buildCuatroRitmos({ observedAt: HOY, exact: true, estacion, tema, lunar, transito: panorama, transitNow: AHORA });
    assert.deepEqual(
      r.rings.map((a) => a.key),
      [...ORDEN_DE_ANILLOS]
    );
    assert.equal(r.availableCount, 4);
    assert.equal(r.exact, true);
    assert.deepEqual(
      r.rings.map((a) => a.state),
      ["Nueva", "Casa 6 · mes 10 de 12", "Día entre 18,3 y 21,0 de 29,4", "Luna con tu Marte · máxima precisión"]
    );
    assert.deepEqual(
      r.rings.map((a) => a.progressMode),
      ["point", "point", "range", "point"],
      "el ritmo lunar es siempre franja: su ventana tiene ancho aun con hora exacta"
    );
    assert.equal(r.rings[0].progress, 0.16);
    assert.equal(r.rings[1].progress, 0.82);
    assert.equal(r.rings[2].progress, null);
    assert.deepEqual(r.rings[2].progressRange, { from: Math.round((18.3 / 29.4) * 1e6) / 1e6, to: Math.round((21 / 29.4) * 1e6) / 1e6 });
    assert.equal(r.rings[3].progress, 0.25, "a las 09:00 de una ventana 06:00–18:00 va por un cuarto");
    assert.equal(r.rings[3].precision, "exact");
    assert.ok(r.rings.every((a) => a.failed === false));
    assert.match(r.rings[2].detail, /Faltan entre 8,4 y 11,1 días para tu próxima Cumpleluna personal\./);
    const degenerada = buildCuatroRitmos({ observedAt: HOY, exact: true, estacion, tema, lunar: { ...lunar, cumpleluna: { ...lunar.cumpleluna, cycleDayWindowDays: { from: 19.7, to: 19.7 }, daysRemainingWindowDays: { from: 9.7, to: 9.7 } } }, transito: panorama, transitNow: AHORA });
    assert.equal(degenerada.rings[2].state, "Día 19,7 de 29,4", "sólo una ventana de arco cero se escribe como un único día");
    assert.equal(degenerada.rings[2].progress, 0.67);
    assert.equal(r.rings[0].detail, "La fase actual de tu estación vital es Nueva.");
    assert.equal(r.rings[1].detail, tema.summary);
    assert.equal(r.rings[3].detail, "La Luna pasa hoy por tu Marte.");
    assert.equal(r.rings[0].limitations[0], estacion.limitations[0]);
    assert.equal(r.rings[2].limitations[0], lunar.limitations[0]);
  });

  it("sin hora exacta los avances son franjas: la estación por sus ventanas y la Luna por su día posible", () => {
    const enRango: EstacionVital = {
      ...estacion,
      precision: "range",
      phaseStartedAtRange: { earliest: Date.UTC(2025, 10, 1), latest: Date.UTC(2026, 0, 15) },
      nextPhaseAtRange: { earliest: Date.UTC(2029, 2, 1), latest: Date.UTC(2029, 5, 1) }
    };
    const lunarRango = { ...lunar, cumpleluna: { ...lunar.cumpleluna, precision: "range" as const, cycleDayWindowDays: { from: 18.2, to: 21.1 }, daysRemainingWindowDays: { from: 8.3, to: 11.2 } } };
    const r = buildCuatroRitmos({ observedAt: HOY, exact: false, estacion: enRango, tema, lunar: lunarRango, transito: panorama, transitNow: AHORA });
    assert.equal(r.exact, false);
    const [e, , l] = r.rings;
    assert.equal(e.progressMode, "range");
    assert.equal(e.progress, null);
    assert.ok(e.progressRange && e.progressRange.from < e.progressRange.to && e.progressRange.from > 0 && e.progressRange.to < 1, JSON.stringify(e.progressRange));
    assert.equal(l.progressMode, "range");
    assert.equal(l.state, "Día entre 18,2 y 21,1 de 29,4");
    assert.match(l.detail, /entre 8,3 y 11,2 días/);
    assert.deepEqual(l.progressRange, { from: Math.round((18.2 / 29.4) * 1e6) / 1e6, to: Math.round((21.1 / 29.4) * 1e6) / 1e6 });
  });

  it("el tránsito sin hora del exacto no ubica su fase y lo declara", () => {
    const sinHora: TransitPanorama = { ...panorama, rows: [fila({ phase: null, closeness: null, cadence: undefined, startTime: null, exactTime: null, endTime: null })] };
    const r = buildCuatroRitmos({ observedAt: HOY, exact: true, estacion, tema, lunar, transito: sinHora, transitNow: AHORA });
    const t = r.rings[3];
    assert.equal(t.state, "Luna con tu Marte · sin hora exacta");
    assert.equal(t.progressMode, "unavailable");
    assert.equal(t.available, true);
    assert.equal(t.cadence, "dura días o semanas");
    assert.equal(t.limitations.length, 2);
    assert.equal(etiquetaDeFase({ phase: "acercandose" }), "se acerca");
    assert.equal(etiquetaDeFase({ phase: "integrandose" }), "sigue activo después del punto más preciso");
    // El avance es la posición en la ventana, no la cercanía al exacto: integrándose, el arco sigue creciendo.
    assert.equal(avanceDelTransito(fila(), "2026-09-06 15:00"), 0.75);
    assert.equal(avanceDelTransito(fila(), "2026-09-07 15:00"), 1);
    assert.equal(avanceDelTransito(fila(), null), null);
    assert.equal(avanceDelTransito(fila({ endTime: "2026-09-06 05:00" }), AHORA), null, "una ventana invertida no se dibuja");
  });
});

describe("lo que no se dibuja", () => {
  it("un ritmo sin cálculo queda vacío con el motivo de su propio sobre", () => {
    const sinHora: TemaDelAno = { status: "needs_birth_time", precision: "not_applicable", missingInputs: ["exact_birth_time"], limitations: ["Este cálculo necesita una hora de nacimiento exacta."], observedAt: HOY };
    const vacio: TransitPanorama = { status: "empty", localDate: "2026-09-06", access: { isPro: true, personalized: true } };
    const r = buildCuatroRitmos({ observedAt: HOY, exact: false, estacion, tema: sinHora, lunar: { cumpleluna: null, limitations: ["Falta el Sol o la Luna natal en la carta guardada: sin eso no hay ciclo personal."] }, transito: vacio });
    assert.equal(r.availableCount, 1);
    const [, a, l, t] = r.rings;
    for (const anillo of [a, l, t]) {
      assert.equal(anillo.available, false);
      assert.equal(anillo.status, "unavailable");
      assert.equal(anillo.precision, "not_applicable");
      assert.equal(anillo.progressMode, "unavailable");
    }
    assert.equal(a.state, "Sin cálculo disponible");
    assert.equal(l.state, "Sin cálculo disponible");
    assert.equal(a.detail, "Este cálculo necesita una hora de nacimiento exacta.");
    assert.match(l.detail, /dos Cumplelunas personales consecutivas/);
    assert.equal(l.limitations[0], "Falta el Sol o la Luna natal en la carta guardada: sin eso no hay ciclo personal.");
    assert.match(t.detail, /lo bastante cercano/);
    assert.equal(t.state, "Sin tránsito activo");
    assert.equal(t.failed, false);
  });

  it("una fuente que falló hoy deja el anillo vacío sin inventar un motivo natal", () => {
    const r = buildCuatroRitmos({ observedAt: HOY, exact: true, estacion: null, tema, lunar: null, transito: null, transitNow: AHORA });
    assert.equal(r.availableCount, 1);
    assert.match(r.rings[0].detail, /No pudimos obtener este cálculo ahora/);
    assert.equal(r.rings[0].failed, true);
    assert.equal(r.rings[1].failed, false);
    assert.deepEqual(r.rings[0].limitations, []);
    assert.match(r.rings[3].detail, /No pudimos obtener este cálculo ahora/);
  });

  it("el avance nunca sale de 0–1 y el resumen es fijo", () => {
    const r = buildCuatroRitmos({ observedAt: HOY, exact: true, estacion: { ...estacion, progress: 1.4 }, tema: { ...tema, progress: -0.2 }, lunar, transito: panorama, transitNow: AHORA });
    assert.equal(r.rings[0].progress, 1);
    assert.equal(r.rings[1].progress, 0);
    assert.match(r.summary, /Cada anillo representa un ritmo personal distinto/);
  });
});
