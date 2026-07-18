import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailyPrompt,
  composeFastPayload,
  composePayload,
  fallbackRitual,
  mergeEnrichedGuide,
  parseRitual,
  planFastGuide,
  splitDailyState,
  withAbortTimeout
} from "../convex/daily";
import type { TarotDraw } from "../convex/lib/tarot";

const COMPLETE_RITUAL = {
  esencia: "La Luna invertida pide distinguir intuición de suposición.",
  significadoGeneral: [
    { titulo: "Niebla", texto: "No todo lo que inquieta trae información útil." },
    { titulo: "Intuición", texto: "La percepción necesita tiempo antes de volverse certeza." },
    { titulo: "Sombra", texto: "El miedo completa con historias aquello que todavía no sabe." }
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

test("parseRitual exige las tres facetas del formato aprobado en Figma", () => {
  assert.equal(parseRitual({ ...COMPLETE_RITUAL, significadoGeneral: COMPLETE_RITUAL.significadoGeneral.slice(0, 2) }), undefined);
  assert.equal(
    parseRitual({
      ...COMPLETE_RITUAL,
      significadoGeneral: [...COMPLETE_RITUAL.significadoGeneral, { titulo: "Cuarta", texto: "No entra en este formato." }]
    }),
    undefined
  );
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
      assert.equal(ritual.significadoGeneral.length, 3);
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
  assert.equal(prompt.includes("EXACTAMENTE 3 facetas"), true);
  assert.equal(prompt.includes('"no define el día"'), true);
});

test("composePayload publica ritual v3 y el puente legacy derivado para build 13", () => {
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
  assert.deepEqual(payload.carta?.beats, [
    { label: "QUÉ ES", body: COMPLETE_RITUAL.esencia },
    { label: "EN TU DÍA", body: COMPLETE_RITUAL.enTuDia },
    { label: "EL CONSEJO", body: COMPLETE_RITUAL.consejo }
  ]);
  assert.equal(JSON.stringify(payload.carta?.beats).includes("cielo"), false);
});

test("fast path entrega una carta completa sin IA y agenda una sola mejora", () => {
  const carta: TarotDraw = {
    id: 5,
    key: "major_05_el_hierofante",
    nombre: "El Hierofante",
    arcana: "major",
    correspondencia: "Tauro ♉",
    orientacion: "invertida"
  };
  const candidate = composeFastPayload({ carta, now: 1_000 });
  assert.equal(candidate.carta?.id, 5);
  assert.equal(candidate.carta?.orientacion, "invertida");
  assert.equal(candidate.carta?.ritual.significadoGeneral.length, 3);
  assert.equal(candidate.enrichment?.status, "pending");

  const first = planFastGuide({ existing: null, candidate, now: 1_000 });
  const concurrent = planFastGuide({ existing: first.payload, candidate, now: 1_001 });
  assert.equal(first.shouldSchedule, true);
  assert.equal(first.cacheHit, false);
  assert.equal(concurrent.shouldSchedule, false);
  assert.equal(concurrent.reason, "in_flight");
});

test("un payload v3 previo se conserva como listo y no se regenera", () => {
  const carta: TarotDraw = {
    id: 18,
    key: "major_18_la_luna",
    nombre: "La Luna",
    arcana: "major",
    correspondencia: "Piscis ♓",
    orientacion: "derecho"
  };
  const legacyReady = composePayload({
    carta,
    transits: [],
    generated: {
      headline: "Ya generada",
      body: "Este texto ya fue visto.",
      clima: "Estable.",
      destacadoLectura: "Sin tránsito.",
      cartaRitual: COMPLETE_RITUAL
    }
  });
  const candidate = composeFastPayload({ carta: { ...carta, orientacion: "invertida" }, now: 2_000 });
  const plan = planFastGuide({ existing: legacyReady, candidate, now: 2_000 });
  assert.equal(plan.shouldSchedule, false);
  assert.equal(plan.reason, "legacy_ready");
  assert.deepEqual(plan.payload.carta, legacyReady.carta);
});

test("el enriquecimiento nunca reemplaza carta, orientación ni ritual", () => {
  const carta: TarotDraw = {
    id: 5,
    key: "major_05_el_hierofante",
    nombre: "El Hierofante",
    arcana: "major",
    correspondencia: "Tauro ♉",
    orientacion: "invertida"
  };
  const existing = composeFastPayload({ carta, now: 1_000 });
  const otherCard: TarotDraw = {
    id: 19,
    key: "major_19_el_sol",
    nombre: "El Sol",
    arcana: "major",
    correspondencia: "Sol ☉",
    orientacion: "derecho"
  };
  const enriched = composePayload({
    carta: otherCard,
    transits: [],
    generated: {
      headline: "Contenido personalizado",
      body: "Llegó después.",
      clima: "Activo.",
      destacadoLectura: "Lectura.",
      cartaRitual: COMPLETE_RITUAL
    }
  });
  const merged = mergeEnrichedGuide({ existing, enriched, status: "ready", now: 8_000 });
  assert.deepEqual(merged.carta, existing.carta);
  assert.equal(merged.headline, "Contenido personalizado");
  assert.equal(merged.enrichment?.status, "ready");
});

test("el contrato build 17 separa carta estable, estado y módulos personalizados", () => {
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
  const payload = composeFastPayload({ carta, now: 1_000 });
  const state = splitDailyState(payload, 7_777);

  assert.equal(state.card.id, 71);
  assert.equal(state.card.revealed, true);
  assert.equal(state.card.revealedAt, 7_777);
  assert.equal(state.card.ritual.significadoGeneral.length, 3);
  assert.equal(state.enrichment.status, "pending");
  assert.equal(state.personalized.headline, payload.headline);
  assert.equal("carta" in state.personalized, false);
  assert.equal("enrichment" in state.personalized, false);
});

test("un job pendiente solo se reprograma cuando vence el lease", () => {
  const carta: TarotDraw = {
    id: 0,
    key: "major_00_el_loco",
    nombre: "El Loco",
    arcana: "major",
    correspondencia: "Urano ♅ (aire)",
    orientacion: "derecho"
  };
  const candidate = composeFastPayload({ carta, now: 1_000 });
  assert.equal(planFastGuide({ existing: candidate, candidate, now: 120_999 }).shouldSchedule, false);
  const retry = planFastGuide({ existing: candidate, candidate, now: 121_000 });
  assert.equal(retry.shouldSchedule, true);
  assert.equal(retry.reason, "retry");
  assert.equal(retry.payload.enrichment?.attempt, 2);
});

test("el timebox corta una etapa colgada dentro del presupuesto", async () => {
  const startedAt = Date.now();
  await assert.rejects(withAbortTimeout(40, async () => await new Promise<never>(() => undefined)), /stage_timeout_40ms/);
  assert.ok(Date.now() - startedAt < 150);
});
