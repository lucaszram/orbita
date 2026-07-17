import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { isRitualComplete } from "../src/domain/ritual";
import type { DailyRitual } from "../src/services/appRefs";

const complete: DailyRitual = {
  esencia: "La Luna te invita a explorar tu intuición.",
  significadoGeneral: [
    { titulo: "Confusión y misterio", texto: "no ves todo con claridad." },
    { titulo: "Intuición", texto: "seguí lo que sentís." },
    { titulo: "Miedos y sombras", texto: "mirá de frente los temores." }
  ],
  enTuDia: "En los vínculos, mirá lo que se dice a medias.",
  consejo: "Confiá en tu intuición.",
  cierre: { pregunta: "¿Qué venís intuyendo?" }
};

describe("isRitualComplete — la lectura live es completa o no se muestra", () => {
  it("ritual completo con exactamente 3 facetas → true", () => {
    assert.equal(isRitualComplete(complete), true);
  });

  it("undefined → false (no hay ritual todavía)", () => {
    assert.equal(isRitualComplete(undefined), false);
  });

  it("2 facetas → false", () => {
    assert.equal(isRitualComplete({ ...complete, significadoGeneral: complete.significadoGeneral.slice(0, 2) }), false);
  });

  it("4 facetas → false", () => {
    const cuatro = [...complete.significadoGeneral, { titulo: "Extra", texto: "de más." }];
    assert.equal(isRitualComplete({ ...complete, significadoGeneral: cuatro }), false);
  });

  it("faceta con título o texto vacío → false", () => {
    const sinTitulo = [{ titulo: "", texto: "algo" }, ...complete.significadoGeneral.slice(1)];
    const sinTexto = [{ titulo: "Algo", texto: "  " }, ...complete.significadoGeneral.slice(1)];
    assert.equal(isRitualComplete({ ...complete, significadoGeneral: sinTitulo }), false);
    assert.equal(isRitualComplete({ ...complete, significadoGeneral: sinTexto }), false);
  });

  it("esencia / enTuDia / consejo vacíos o en blanco → false", () => {
    assert.equal(isRitualComplete({ ...complete, esencia: "" }), false);
    assert.equal(isRitualComplete({ ...complete, esencia: "   " }), false);
    assert.equal(isRitualComplete({ ...complete, enTuDia: "" }), false);
    assert.equal(isRitualComplete({ ...complete, consejo: "" }), false);
  });

  it("cierre sin pregunta → false", () => {
    assert.equal(isRitualComplete({ ...complete, cierre: { pregunta: "" } }), false);
  });

  it("el mock parcial de la captura de La Sacerdotisa → false", () => {
    // significadoGeneral: [], enTuDia: "", cierre.pregunta: "" — nunca aprobable.
    assert.equal(
      isRitualComplete({ esencia: "algo", significadoGeneral: [], enTuDia: "", consejo: "algo", cierre: { pregunta: "" } }),
      false
    );
  });
});

describe("Diario — la carta no reintroduce el cruce astro (handoff v3)", () => {
  const diarioSrc = readFileSync(resolve("app/reading/diario.tsx"), "utf8");

  it("no conserva los labels EL CIELO DE HOY / DE ESE DÍA en el detalle de la carta", () => {
    assert.ok(!diarioSrc.includes("EL CIELO DE HOY"), "el Diario no debe renderizar EL CIELO DE HOY");
    assert.ok(!diarioSrc.includes("EL CIELO DE ESE DÍA"), "el Diario no debe renderizar EL CIELO DE ESE DÍA");
  });

  it("usa el bloque canónico compartido RitualReading", () => {
    assert.ok(diarioSrc.includes("RitualReading"), "el Diario debe reutilizar RitualReading");
  });
});
