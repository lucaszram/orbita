import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyPrompt, composePayload, fallbackRitual, parseRitual } from "../convex/daily";
import type { TarotDraw } from "../convex/lib/tarot";

const COMPLETE_RITUAL = {
  esencia: "La Luna invertida pide distinguir intuición de suposición.",
  significadoGeneral: [
    { titulo: "Niebla", texto: "No todo lo que inquieta trae información útil." },
    { titulo: "Intuición", texto: "La percepción necesita tiempo antes de volverse certeza." }
  ],
  enTuDia: "En vínculos y decisiones, frená la conclusión rápida. Observá primero qué dato falta.",
  consejo: "Anotá lo que sabés y separalo de lo que imaginás.",
  cierre: {
    pregunta: "¿Qué estás completando con miedo porque todavía no tenés respuesta?",
    umbralSeed: "¿Qué parte de esta situación es dato y qué parte es suposición?"
  }
};

test("parseRitual acepta el contrato completo y conserva el seed opcional", () => {
  assert.deepEqual(parseRitual(COMPLETE_RITUAL), COMPLETE_RITUAL);
});

test("parseRitual rechaza lecturas parciales o con menos de dos facetas", () => {
  assert.equal(parseRitual({ ...COMPLETE_RITUAL, significadoGeneral: COMPLETE_RITUAL.significadoGeneral.slice(0, 1) }), undefined);
  assert.equal(parseRitual({ ...COMPLETE_RITUAL, consejo: "" }), undefined);
  assert.equal(parseRitual({ ...COMPLETE_RITUAL, cierre: {} }), undefined);
});

test("fallbackRitual cubre mayores y menores en ambas orientaciones sin inventar cruce astro", () => {
  const draws: TarotDraw[] = [
    {
      id: 18,
      key: "major_18_la_luna",
      nombre: "La Luna",
      arcana: "major",
      correspondencia: "Piscis ♓",
      orientacion: "derecho"
    },
    {
      id: 71,
      key: "pentacles_08",
      nombre: "Ocho de Oros",
      arcana: "minor",
      suit: "pentacles",
      rank: "08",
      correspondencia: "Oros · Tierra",
      orientacion: "derecho"
    }
  ];

  for (const source of draws) {
    for (const orientacion of ["derecho", "invertida"] as const) {
      const ritual = fallbackRitual({ ...source, orientacion });
      assert.equal(ritual.significadoGeneral.length >= 2, true);
      assert.equal(ritual.cierre.pregunta.startsWith("¿"), true);
      const visible = JSON.stringify(ritual).toLowerCase();
      assert.equal(visible.includes("tránsito"), false);
      assert.equal(visible.includes("casa natal"), false);
      assert.equal(visible.includes("no es casualidad"), false);
    }
  }
});

test("el prompt pide ritual intrínseco y elimina el contrato viejo de beats/cruce", () => {
  const carta: TarotDraw = {
    id: 18,
    key: "major_18_la_luna",
    nombre: "La Luna",
    arcana: "major",
    correspondencia: "Piscis ♓",
    orientacion: "invertida"
  };
  const prompt = buildDailyPrompt({ natal: [], tension: [], transits: [], localDate: "2026-07-17", carta });

  assert.equal(prompt.includes('"cartaRitual"'), true);
  assert.equal(prompt.includes("salió INVERTIDA"), true);
  assert.equal(prompt.includes('"cartaBeats"'), false);
  assert.equal(prompt.includes("CÓMO SE CONECTA CON TU CIELO"), false);
  assert.equal(prompt.includes("no personaliza con astrología"), true);
});

test("composePayload publica orientación + ritual y nunca beats", () => {
  const carta: TarotDraw = {
    id: 71,
    key: "pentacles_08",
    nombre: "Ocho de Oros",
    arcana: "minor",
    suit: "pentacles",
    rank: "08",
    correspondencia: "Oros · Tierra",
    orientacion: "derecho"
  };
  const payload = composePayload({
    carta,
    transits: [],
    generated: {
      headline: "Un día para sostener",
      body: "Elegí una tarea y terminá el tramo que ya empezaste.",
      clima: "Constante.",
      destacadoLectura: "Sin tránsito destacado.",
      cartaRitual: COMPLETE_RITUAL
    }
  });

  assert.equal(payload.payloadVersion, "orbita-daily-guide-v3");
  assert.equal(payload.carta?.orientacion, "derecho");
  assert.deepEqual(payload.carta?.ritual, COMPLETE_RITUAL);
  assert.equal(Object.hasOwn(payload.carta ?? {}, "beats"), false);
});
