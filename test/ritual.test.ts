import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { cartaRevealView, isRitualComplete } from "../src/domain/ritual";
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

describe("cartaRevealView — la cara nunca convive con el CTA de carta cerrada", () => {
  it("cerrada (nada en vuelo) → CTA visible, sin ritual", () => {
    assert.deepEqual(cartaRevealView({ revealed: false, confirmed: false, pulling: false }), {
      isRevealed: false,
      showCta: true,
      showRitual: false
    });
  });

  it("tirón en vuelo → CTA oculto y sin ritual (la cara flipea sola)", () => {
    assert.deepEqual(cartaRevealView({ revealed: false, confirmed: false, pulling: true }), {
      isRevealed: false,
      showCta: false,
      showRitual: false
    });
  });

  it("INTERVALO: mutation confirmada pero getStrip todavía no actualizó → revelado atómico, sin CTA", () => {
    // Este es el bug de la captura (cara de El Hierofante + "Tocá para abrir el día").
    assert.deepEqual(cartaRevealView({ revealed: false, confirmed: true, pulling: false }), {
      isRevealed: true,
      showCta: false,
      showRitual: true
    });
  });

  it("getStrip ya actualizó (con o sin confirm local) → revelado, sin CTA", () => {
    for (const confirmed of [true, false]) {
      assert.deepEqual(cartaRevealView({ revealed: true, confirmed, pulling: false }), {
        isRevealed: true,
        showCta: false,
        showRitual: true
      });
    }
  });

  it("tirón fallido (vuelve al dorso) → igual que cerrada, CTA de nuevo", () => {
    assert.deepEqual(cartaRevealView({ revealed: false, confirmed: false, pulling: false }), {
      isRevealed: false,
      showCta: true,
      showRitual: false
    });
  });

  it("INVARIANTE en las 8 combinaciones: si la cara puede verse (revelado o en vuelo), el CTA está oculto", () => {
    for (const revealed of [false, true]) {
      for (const confirmed of [false, true]) {
        for (const pulling of [false, true]) {
          const v = cartaRevealView({ revealed, confirmed, pulling });
          const caraPosible = v.isRevealed || pulling; // el flip va hacia la cara
          if (caraPosible) {
            assert.equal(v.showCta, false, `cara+CTA en {revealed:${revealed}, confirmed:${confirmed}, pulling:${pulling}}`);
          }
          // El ritual solo aparece en estado revelado, nunca durante el tirón sin confirmar.
          assert.equal(v.showRitual, v.isRevealed);
        }
      }
    }
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
