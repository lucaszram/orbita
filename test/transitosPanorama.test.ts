/**
 * Tránsitos · AHORA — cómo se lee el panorama en pantalla (CORE-207), lado del
 * front. Puro: filas visibles y plegadas, chip y meta por fila, encabezado y
 * estado de pantalla a partir del sobre.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FILAS_VISIBLES,
  encabezadoDeAhora,
  estadoDelPanorama,
  etiquetaDeDespliegue,
  filaVista,
  filasParaMostrar,
  introDeAhora
} from "../src/domain/transitosPanorama";
import type { TransitPanorama, TransitPanoramaRow } from "../src/services/appRefs";

function fila(partial: Partial<TransitPanoramaRow> = {}): TransitPanoramaRow {
  return {
    transitId: "moon-trine-mars",
    rank: 1,
    title: "Luna trígono tu Marte",
    transitPlanet: "LUNA",
    natalPoint: "MARTE",
    aspectType: "trine",
    aspectEs: "trígono",
    aspectAngle: 120,
    natalHouse: 4,
    phase: "integrandose",
    peakLabel: "PICO AYER",
    closeness: 0.7,
    cadence: "Dura 3 días",
    body: "Luna y tu Marte forman un trígono.",
    startTime: "2026-09-04T00:00",
    exactTime: "2026-09-04T09:00",
    endTime: "2026-09-07T00:00",
    ...partial
  };
}

function listo(n: number, activeTotal: number | null = n): Extract<TransitPanorama, { status: "ready" }> {
  return {
    status: "ready",
    localDate: "2026-09-05",
    count: n,
    rows: Array.from({ length: n }, (_, i) => fila({ transitId: `t-${i + 1}`, rank: i + 1 })),
    activeTotal,
    cadence: "Cambia a diario",
    access: { isPro: true, personalized: true }
  };
}

describe("una fila en pantalla", () => {
  it("chip por fase y meta con pico y casa", () => {
    const v = filaVista(fila());
    assert.equal(v.chip, "INTEGRÁNDOSE");
    assert.equal(v.meta, "PICO AYER · CASA 4");
    assert.equal(v.linea, "LUNA · MARTE");
    assert.equal(v.barra, 0.7);
    assert.equal(v.cadencia, "Dura 3 días");
  });

  it("exacto hoy: el chip lo dice y la meta no lo repite", () => {
    const v = filaVista(fila({ phase: "exacto", peakLabel: "EXACTO HOY" }));
    assert.equal(v.chip, "EXACTO HOY");
    assert.equal(v.meta, "CASA 4");
  });

  it("sin hora exacta: sin chip, sin pico, sin barra; la casa sigue si existe", () => {
    const v = filaVista(fila({ phase: null, peakLabel: null, closeness: null, cadence: undefined }));
    assert.equal(v.chip, null);
    assert.equal(v.meta, "CASA 4");
    assert.equal(v.barra, null);
    assert.equal(v.cadencia, null);
    assert.equal(filaVista(fila({ phase: null, peakLabel: null, natalHouse: null })).meta, "");
  });

  it("la barra se acota a 0–1 y un valor no numérico no dibuja barra", () => {
    assert.equal(filaVista(fila({ closeness: 1.7 })).barra, 1);
    assert.equal(filaVista(fila({ closeness: -0.2 })).barra, 0);
    assert.equal(filaVista(fila({ closeness: Number.NaN })).barra, null);
  });
});

describe("plegado y encabezado", () => {
  it("se muestran cinco filas y el enlace cuenta el total; desplegado, todas y sin enlace", () => {
    assert.equal(FILAS_VISIBLES, 5);
    const p = listo(8, 16);
    assert.equal(filasParaMostrar(p.rows, false).length, 5);
    assert.equal(filasParaMostrar(p.rows, true).length, 8);
    assert.equal(etiquetaDeDespliegue(8, false), "VER LOS 8 CONTACTOS");
    assert.equal(etiquetaDeDespliegue(8, true), null);
    assert.equal(etiquetaDeDespliegue(3, false), null);
  });

  it("el encabezado dice «8 de 16» con total real, «activos» si están todos y «principales» si no se sabe", () => {
    assert.equal(encabezadoDeAhora(listo(8, 16)), "8 DE 16 CONTACTOS ACTIVOS · CAMBIA A DIARIO");
    assert.equal(encabezadoDeAhora(listo(1)), "1 CONTACTO ACTIVO · CAMBIA A DIARIO");
    assert.equal(encabezadoDeAhora(listo(5, 5)), "5 CONTACTOS ACTIVOS · CAMBIA A DIARIO");
    assert.equal(encabezadoDeAhora(listo(8, null)), "8 CONTACTOS PRINCIPALES · CAMBIA A DIARIO");
    assert.equal(encabezadoDeAhora(listo(1, null)), "1 CONTACTO PRINCIPAL · CAMBIA A DIARIO");
  });

  it("la intro dice «todos» sólo cuando se sabe que están todos, y describe el orden real", () => {
    assert.match(introDeAhora(listo(5, 5)), /^Todos los contactos activos de hoy, ordenados por el peso del contacto/);
    assert.match(introDeAhora(listo(8, 16)), /^Los contactos principales de hoy/);
    assert.match(introDeAhora(listo(8, null)), /^Los contactos principales de hoy/);
    assert.doesNotMatch(introDeAhora(listo(8, 16)), /cercanía al punto exacto/);
  });
});

describe("estado de pantalla a partir del sobre", () => {
  it("locked → bloqueado, empty → vacío, ready con filas → listo, ready sin filas → vacío", () => {
    assert.equal(estadoDelPanorama({ status: "locked", localDate: "2026-09-05", access: { isPro: false, personalized: false } }).kind, "bloqueado");
    assert.equal(estadoDelPanorama({ status: "empty", localDate: "2026-09-05", access: { isPro: true, personalized: true } }).kind, "vacio");
    assert.equal(estadoDelPanorama(listo(3)).kind, "listo");
    assert.equal(estadoDelPanorama({ ...listo(0), rows: [] }).kind, "vacio");
  });

  it("un sobre ausente o desconocido es error, nunca una lista inventada", () => {
    assert.equal(estadoDelPanorama(null).kind, "error");
    assert.equal(estadoDelPanorama(undefined).kind, "error");
    assert.equal(estadoDelPanorama({ status: "otra" } as unknown as TransitPanorama).kind, "error");
  });
});
