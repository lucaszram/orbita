/**
 * Tránsitos · AHORA — el panorama del día (CORE-207), lado del backend.
 *
 * Se ejecuta de verdad sobre `buildTransitPanorama` y sus piezas: cómo se lee
 * la hora del proveedor sin zona, cómo se decide la fase y el pico, cómo se
 * mide la cercanía en tiempo, qué filas salen de una lectura nueva y de una
 * anterior sin identidad, y qué NO se inventa.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDailyReadingPayloadFromAstrology, findTransitInPayload, transitIdFor, type NormalizedAstroTransit } from "../convex/lib/orbita";
import {
  buildTransitPanorama,
  closenessFor,
  daysUntilExact,
  listRankedTransits,
  naiveNowIn,
  parseNaiveTime,
  peakLabelFor,
  phaseFor
} from "../convex/lib/transitPanorama";

function transito(partial: Partial<NormalizedAstroTransit> = {}): NormalizedAstroTransit {
  return {
    transitPlanet: "mars",
    transitPlanetEs: "Marte",
    natalPoint: "venus",
    natalPointEs: "Venus",
    aspectType: "square",
    aspectTypeEs: "cuadratura",
    startTime: "2026-09-04T10:00",
    exactTime: "2026-09-05T14:30",
    endTime: "2026-09-06T18:00",
    isRetrograde: false,
    transitSign: "cancer",
    transitSignEs: "Cáncer",
    natalHouse: 6,
    priority: 90,
    ...partial
  };
}

const HOY = "2026-09-05";

describe("la hora del proveedor, sin zona", () => {
  it("parseNaiveTime lee `YYYY-MM-DDTHH:mm` como instante ingenuo, sin desplazar por la zona", () => {
    assert.equal(parseNaiveTime("2026-09-05T14:30"), Date.UTC(2026, 8, 5, 14, 30));
    assert.equal(parseNaiveTime("2026-09-05 14:30:15"), Date.UTC(2026, 8, 5, 14, 30, 15));
    assert.equal(parseNaiveTime("2026-09-05"), Date.UTC(2026, 8, 5));
  });

  it("rechaza lo que no es una fecha: vacío, texto, 31 de febrero, null", () => {
    assert.equal(parseNaiveTime(""), null);
    assert.equal(parseNaiveTime("mañana"), null);
    assert.equal(parseNaiveTime("2026-02-31T10:00"), null);
    assert.equal(parseNaiveTime(null), null);
  });

  it("daysUntilExact cuenta días civiles: hoy 0, mañana 1, hace tres días −3", () => {
    assert.equal(daysUntilExact("2026-09-05T23:59", HOY), 0);
    assert.equal(daysUntilExact("2026-09-06T00:01", HOY), 1);
    assert.equal(daysUntilExact("2026-09-02T12:00", HOY), -3);
    assert.equal(daysUntilExact(null, HOY), null);
  });
});

describe("fase, pico y cercanía", () => {
  it("la fase sale del signo de los días: acercándose, exacto, integrándose", () => {
    assert.equal(phaseFor(2), "acercandose");
    assert.equal(phaseFor(0), "exacto");
    assert.equal(phaseFor(-1), "integrandose");
    assert.equal(phaseFor(null), null);
  });

  it("el pico se escribe como en el frame", () => {
    assert.equal(peakLabelFor(0), "EXACTO HOY");
    assert.equal(peakLabelFor(1), "PICO MAÑANA");
    assert.equal(peakLabelFor(2), "PICO EN 2 DÍAS");
    assert.equal(peakLabelFor(-1), "PICO AYER");
    assert.equal(peakLabelFor(-3), "PICO HACE 3 DÍAS");
    assert.equal(peakLabelFor(null), null);
  });

  it("la cercanía es 1 en el exacto (mediodía de hoy) y baja hacia el borde de la ventana", () => {
    const exactoAlMediodia = transito({ startTime: "2026-09-03T12:00", exactTime: "2026-09-05T12:00", endTime: "2026-09-07T12:00" });
    assert.equal(closenessFor(exactoAlMediodia, HOY), 1);
    const aUnDia = transito({ startTime: "2026-09-03T12:00", exactTime: "2026-09-06T12:00", endTime: "2026-09-07T12:00" });
    assert.equal(closenessFor(aUnDia, HOY), 0.5);
    const enElBorde = transito({ startTime: "2026-09-03T12:00", exactTime: "2026-09-07T12:00", endTime: "2026-09-07T12:00" });
    assert.equal(closenessFor(enElBorde, HOY), 0);
  });

  it("sin ventana o sin exacto no hay cercanía: null, nunca un valor por defecto", () => {
    assert.equal(closenessFor(transito({ startTime: null }), HOY), null);
    assert.equal(closenessFor(transito({ exactTime: null }), HOY), null);
    assert.equal(closenessFor(transito({ startTime: "2026-09-06T00:00", endTime: "2026-09-04T00:00" }), HOY), null);
  });

  it("con «ahora» la cercanía se mide desde ese instante, no desde el mediodía", () => {
    const exactoALas23 = transito({ startTime: "2026-09-05T11:00", exactTime: "2026-09-05T23:00", endTime: "2026-09-06T11:00" });
    assert.equal(closenessFor(exactoALas23, HOY, "2026-09-05T23:00"), 1);
    assert.equal(closenessFor(exactoALas23, HOY, "2026-09-05T17:00"), 0.5);
    // Sin «ahora» legible se cae al mediodía, como antes.
    assert.equal(closenessFor(exactoALas23, HOY, "ahora mismo"), closenessFor(exactoALas23, HOY));
  });

  it("naiveNowIn escribe «ahora» en la zona de la lectura con el formato del proveedor", () => {
    const instante = new Date(Date.UTC(2026, 8, 6, 1, 30)); // 01:30 UTC del 6
    assert.equal(naiveNowIn("America/Argentina/Buenos_Aires", instante), "2026-09-05T22:30");
    assert.equal(naiveNowIn("UTC", instante), "2026-09-06T01:30");
    assert.equal(naiveNowIn(undefined, instante), null);
    assert.equal(naiveNowIn("Marte/Olympus", instante), null);
  });

  it("una ventana muy corta usa media jornada de escala mínima para no saturar", () => {
    const corta = transito({ startTime: "2026-09-05T11:00", exactTime: "2026-09-05T13:00", endTime: "2026-09-05T15:00" });
    const c = closenessFor(corta, HOY);
    assert.ok(c !== null && c > 0.9 && c < 1, String(c));
  });
});

describe("las filas del panorama", () => {
  const lista = [
    transito(),
    transito({ transitPlanet: "moon", transitPlanetEs: "Luna", natalPoint: "mars", natalPointEs: "Marte", aspectType: "trine", aspectTypeEs: "trígono", exactTime: "2026-09-04T09:00", natalHouse: 4, priority: 95 }),
    transito({ transitPlanet: "venus", transitPlanetEs: "Venus", natalPoint: "neptune", natalPointEs: "Neptuno", exactTime: "2026-09-07T10:00", startTime: "2026-09-01T00:00", endTime: "2026-09-12T00:00", natalHouse: 10, priority: 70 }),
    transito({ transitPlanet: "sun", transitPlanetEs: "Sol", natalPoint: "mars", natalPointEs: "Marte", aspectType: "conjunction", aspectTypeEs: "conjunción", exactTime: null, startTime: null, endTime: null, natalHouse: null, priority: 60 }),
    transito({ transitPlanet: "pluto", transitPlanetEs: "Plutón", natalPoint: "sun", natalPointEs: "Sol", aspectType: "quincunx", aspectTypeEs: "quincuncio", priority: 99 })
  ];
  const payload = buildDailyReadingPayloadFromAstrology({ localDate: HOY, timezone: "America/Argentina/Buenos_Aires", chart: null, transits: lista });

  it("una lectura nueva publica las filas con la MISMA identidad que abre el detalle", () => {
    const panorama = buildTransitPanorama({ payload, localDate: HOY, isPro: true });
    assert.equal(panorama.status, "ready");
    if (panorama.status !== "ready") return;
    assert.equal(panorama.count, 4, "el quincuncio no es aspecto mayor y queda fuera");
    assert.deepEqual(
      panorama.rows.map((r) => r.transitId),
      ["moon-trine-mars", "mars-square-venus", "venus-square-neptune", "sun-conjunction-mars"]
    );
    assert.deepEqual(panorama.rows.map((r) => r.rank), [1, 2, 3, 4]);
    assert.equal(panorama.rows[0].transitId, transitIdFor(lista[1]));
    assert.equal(panorama.cadence, "Cambia a diario");
    assert.deepEqual(panorama.access, { isPro: true, personalized: true });
    assert.equal(panorama.activeTotal, 4, "los aspectos mayores que publicó el proveedor");
  });

  it("con más contactos de los que entran, el total real viaja para decir «8 de 16»", () => {
    const muchos = Array.from({ length: 16 }, (_, i) =>
      transito({ transitPlanet: `p${i}`, transitPlanetEs: `Planeta ${i}`, priority: 100 - i })
    );
    const doc = buildDailyReadingPayloadFromAstrology({ localDate: HOY, timezone: "UTC", chart: null, transits: muchos });
    assert.deepEqual((doc as { transitTotals: unknown }).transitTotals, { provider: 16, major: 16, ranked: 8 });
    const panorama = buildTransitPanorama({ payload: doc, localDate: HOY, isPro: true });
    if (panorama.status !== "ready") return assert.fail("ready");
    assert.equal(panorama.count, 8);
    assert.equal(panorama.activeTotal, 16);
  });

  it("un documento anterior sin totales no inventa uno: activeTotal null", () => {
    const legacy = { selectedTransits: [lista[0], lista[1]] };
    const panorama = buildTransitPanorama({ payload: legacy, localDate: HOY, isPro: true });
    if (panorama.status !== "ready") return assert.fail("ready");
    assert.equal(panorama.activeTotal, null);
    assert.equal(panorama.count, 2);
  });

  it("cada fila lleva título, línea mono, fase, pico, casa y cadencia derivados del contacto", () => {
    const panorama = buildTransitPanorama({ payload, localDate: HOY, isPro: true });
    if (panorama.status !== "ready") return assert.fail("ready");
    const [luna, marte, venus, sol] = panorama.rows;
    assert.equal(luna.title, "Luna trígono tu Marte");
    assert.equal(luna.transitPlanet, "LUNA");
    assert.equal(luna.natalPoint, "MARTE");
    assert.equal(luna.phase, "integrandose");
    assert.equal(luna.peakLabel, "PICO AYER");
    assert.equal(luna.natalHouse, 4);
    assert.equal(luna.aspectAngle, 120);
    assert.match(luna.body, /Luna y tu Marte forman un trígono, un contacto de 120°/);
    assert.match(luna.body, /ya pasó/);

    assert.equal(marte.phase, "exacto");
    assert.equal(marte.peakLabel, "EXACTO HOY");
    assert.match(marte.body, /Hoy pasa por su punto más preciso/);
    assert.equal(marte.cadence, "Dura 2 días");

    assert.equal(venus.phase, "acercandose");
    assert.equal(venus.peakLabel, "PICO EN 2 DÍAS");
    assert.match(venus.body, /Todavía se está acercando/);
    assert.equal(venus.cadence, "Dura 11 días");

    assert.equal(sol.phase, null);
    assert.equal(sol.peakLabel, null);
    assert.equal(sol.closeness, null);
    assert.equal(sol.cadence, undefined);
    assert.equal(sol.natalHouse, null);
    assert.match(sol.body, /no publicó la hora exacta/);
  });

  it("Free recibe `locked` sin filas: el ranking se calcula con la carta y es Plus", () => {
    const panorama = buildTransitPanorama({ payload, localDate: HOY, isPro: false });
    assert.deepEqual(panorama, { status: "locked", localDate: HOY, access: { isPro: false, personalized: false } });
    assert.equal("rows" in panorama, false);
  });

  it("sin contactos responde `empty`, no una lista de relleno", () => {
    const vacio = buildDailyReadingPayloadFromAstrology({ localDate: HOY, timezone: "UTC", chart: null, transits: [] });
    const panorama = buildTransitPanorama({ payload: vacio, localDate: HOY, isPro: true });
    assert.equal(panorama.status, "empty");
  });

  it("un documento anterior sin `rankedTransits` reconstruye las filas y la identidad legacy", () => {
    const legacy = {
      selectedTransits: [lista[0], lista[1]],
      transits: { highlighted: lista[1], secondary: [lista[2]] },
      highlightedTransit: lista[1]
    };
    const filas = listRankedTransits(legacy);
    assert.deepEqual(
      filas.map((f) => f.transitId),
      ["mars-square-venus", "moon-trine-mars", "venus-square-neptune"],
      "deduplicado por identidad, en el orden de los candidatos (sin reordenar)"
    );
    // Cada id del panorama abre en `getDetail` (vía legacy) exactamente el mismo contacto.
    for (const fila of filas) {
      const abierto = findTransitInPayload(legacy, fila.transitId);
      assert.ok(abierto, fila.transitId);
      assert.equal(abierto?.transitPlanet, fila.transitPlanet);
      assert.equal(abierto?.natalPoint, fila.natalPoint);
      assert.equal(abierto?.exactTime, fila.exactTime);
    }
  });

  it("legacy con el mismo par en dos ventanas: el panorama y el detalle abren la misma", () => {
    const temprano = transito({ transitPlanet: "moon", transitPlanetEs: "Luna", natalPoint: "mars", natalPointEs: "Marte", aspectType: "trine", aspectTypeEs: "trígono", exactTime: "2026-09-05T03:00", priority: 20 });
    const tarde = { ...temprano, exactTime: "2026-09-05T20:00", priority: 90 };
    const legacy = { selectedTransits: [temprano, tarde] };
    const filas = listRankedTransits(legacy);
    for (const fila of filas) {
      assert.equal(findTransitInPayload(legacy, fila.transitId)?.exactTime, fila.exactTime, fila.transitId);
    }
  });

  it("un payload sin tránsitos legibles no rompe: empty", () => {
    assert.equal(buildTransitPanorama({ payload: null, localDate: HOY, isPro: true }).status, "empty");
    assert.equal(buildTransitPanorama({ payload: { rankedTransits: [{ transitId: "x" }] }, localDate: HOY, isPro: true }).status, "empty");
  });
});
