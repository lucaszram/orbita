/**
 * Vínculos — el alta de la primera persona (CORE-212), lado del front.
 *
 * Se prueba el dominio puro: qué pide cada nivel, qué fecha y hora se aceptan,
 * cómo se cuenta la comparación y cómo se dibujan las barras sin dividir por
 * cero. Nada de acá toca la red.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type AltaForm,
  NIVELES,
  SIGNOS,
  TIPOS_DE_VINCULO,
  escalaDeDimensiones,
  etiquetaDeNivel,
  fechaIsoDesdeTexto,
  fraccionDeBarra,
  horaNormalizada,
  inicial,
  titularDeContactos,
  validarAlta
} from "../src/domain/vinculo";

const base: AltaForm = {
  nombre: "Vera",
  tipo: "friendship",
  nivel: "carta",
  signo: null,
  fecha: "28/01/1988",
  hora: "19:45",
  lugar: { label: "Córdoba, AR", latitude: -31.4, longitude: -64.2 }
};

describe("fecha y hora", () => {
  it("acepta día/mes/año con barras, puntos, guiones y espacios, y el ISO", () => {
    assert.equal(fechaIsoDesdeTexto("28/01/1988"), "1988-01-28");
    assert.equal(fechaIsoDesdeTexto("28 / 01 / 1988"), "1988-01-28");
    assert.equal(fechaIsoDesdeTexto("5.3.2001"), "2001-03-05");
    assert.equal(fechaIsoDesdeTexto("1988-01-28"), "1988-01-28");
  });

  it("rechaza fechas que no existen o están fuera de rango", () => {
    assert.equal(fechaIsoDesdeTexto("31/02/1990"), null);
    assert.equal(fechaIsoDesdeTexto("29/02/2001"), null);
    assert.equal(fechaIsoDesdeTexto("29/02/2000"), "2000-02-29");
    assert.equal(fechaIsoDesdeTexto("01/01/1850"), null);
    assert.equal(fechaIsoDesdeTexto("ayer"), null);
    assert.equal(fechaIsoDesdeTexto(""), null);
  });

  it("normaliza horas con dos puntos, punto, h o sin separador", () => {
    assert.equal(horaNormalizada("19:45"), "19:45");
    assert.equal(horaNormalizada("7:05"), "07:05");
    assert.equal(horaNormalizada("19.45"), "19:45");
    assert.equal(horaNormalizada("1945"), "19:45");
    assert.equal(horaNormalizada("19h45"), "19:45");
    assert.equal(horaNormalizada("24:00"), null);
    assert.equal(horaNormalizada("19:60"), null);
    assert.equal(horaNormalizada("noche"), null);
  });
});

describe("qué pide cada nivel", () => {
  it("los tres niveles existen en el orden del frame con su rótulo de datos", () => {
    assert.deepEqual(
      NIVELES.map((n) => [n.key, n.pide]),
      [
        ["signo", "SIN FECHA"],
        ["fecha", "PIDE FECHA"],
        ["carta", "PIDE FECHA, HORA Y LUGAR"]
      ]
    );
    assert.equal(etiquetaDeNivel("carta"), "Carta con carta");
    assert.equal(TIPOS_DE_VINCULO.length, 4);
    assert.equal(SIGNOS.length, 12);
  });

  it("signo con signo: nombre y signo, nada más", () => {
    assert.deepEqual(validarAlta({ ...base, nivel: "signo", signo: "leo", fecha: "", hora: "", lugar: null }), {});
    assert.deepEqual(validarAlta({ ...base, nivel: "signo", signo: null }), { signo: "Elegí su signo solar." });
  });

  it("fecha con fecha: la fecha es obligatoria; hora y lugar opcionales pero válidos si se escriben", () => {
    assert.deepEqual(validarAlta({ ...base, nivel: "fecha", hora: "", lugar: null }), {});
    assert.equal(validarAlta({ ...base, nivel: "fecha", fecha: "" }).fecha, "Una fecha real, día / mes / año.");
    assert.equal(validarAlta({ ...base, nivel: "fecha", hora: "veinte" }).hora, "La hora de nacimiento, HH:MM.");
    // Una hora sin lugar no se puede ubicar en una zona: se pide el lugar, no se descarta la hora.
    assert.equal(validarAlta({ ...base, nivel: "fecha", hora: "19:45", lugar: null }).lugar, "Para usar la hora hace falta el lugar de nacimiento.");
    assert.deepEqual(validarAlta({ ...base, nivel: "fecha", hora: "19:45" }), {});
  });

  it("carta con carta: fecha, hora y un lugar elegido de la lista (con coordenadas)", () => {
    assert.deepEqual(validarAlta(base), {});
    assert.equal(validarAlta({ ...base, hora: "" }).hora, "La hora de nacimiento, HH:MM.");
    assert.equal(validarAlta({ ...base, lugar: null }).lugar, "Elegí el lugar de la lista para ubicar la carta.");
    assert.equal(validarAlta({ ...base, lugar: { label: "Córdoba" } }).lugar, "Elegí el lugar de la lista para ubicar la carta.");
  });

  it("el nombre es obligatorio y acotado", () => {
    assert.equal(validarAlta({ ...base, nombre: "   " }).nombre, "Escribí cómo la llamás.");
    assert.equal(validarAlta({ ...base, nombre: "x".repeat(61) }).nombre, "Un nombre más corto.");
  });
});

describe("cómo se cuenta la comparación", () => {
  it("el titular cuenta contactos entre tu carta y la de la persona", () => {
    assert.equal(titularDeContactos(14, "Mara"), "14 contactos entre tu carta y la de Mara.");
    assert.equal(titularDeContactos(1, "Mara"), "Un contacto entre tu carta y la de Mara.");
    assert.equal(titularDeContactos(0, "Mara"), "Sin contactos dentro de orbe entre tu carta y la de Mara.");
  });

  it("la fracción de una barra queda entre 0 y 1 y no divide por cero", () => {
    assert.equal(fraccionDeBarra(9, 14), 9 / 14);
    assert.equal(fraccionDeBarra(0, 0), 0);
    assert.equal(fraccionDeBarra(5, 0), 0);
    assert.equal(fraccionDeBarra(20, 14), 1);
    assert.equal(fraccionDeBarra(Number.NaN, 3), 0);
  });

  it("las tres dimensiones comparten escala: el máximo, nunca menos de 1", () => {
    const resumen = {
      total: 0,
      armonicos: 0,
      tensos: 0,
      fusiones: 0,
      dimensions: [
        { key: "hablan" as const, label: "", total: 5, armonicos: 0, tensos: 0, fusiones: 0 },
        { key: "cuidan" as const, label: "", total: 6, armonicos: 0, tensos: 0, fusiones: 0 },
        { key: "deseo" as const, label: "", total: 3, armonicos: 0, tensos: 0, fusiones: 0 }
      ]
    };
    assert.equal(escalaDeDimensiones(resumen), 6);
    assert.equal(escalaDeDimensiones({ ...resumen, dimensions: [] }), 1);
  });

  it("la inicial del chip sale del nombre en mayúscula", () => {
    assert.equal(inicial("mara"), "M");
    assert.equal(inicial("  Ñandú"), "Ñ");
    assert.equal(inicial(""), "?");
  });
});
