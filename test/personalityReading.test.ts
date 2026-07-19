import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNatalReadingGatewayPrompt,
  generateNatalReadingWithGateway,
  NATAL_SECTION_KEYS,
  parseNatalReadingText
} from "../convex/lib/aiGateway";
import {
  requireSuccessfulNatalReading,
  resolveNatalGenerationClaim,
  resolveNatalReadingPublicStatus,
  resolveReadyPersonalityReading
} from "../convex/charts";

const section = (key: string) => ({
  key,
  title: key,
  intro: `Introducción ${key}`,
  placement: { label: `Ubicación ${key}`, planet: key },
  body: `Párrafo uno de ${key}.\n\nPárrafo dos.\n\nPárrafo tres.\n\nPárrafo cuatro.`,
  questions: [`¿Qué observás en ${key}?`]
});

const validPayload = {
  headline: "Tu carta, leída de principio a fin.",
  sections: NATAL_SECTION_KEYS.map(section),
  disclaimer: "Entretenimiento y autoconocimiento."
};

describe("lectura natal completa", () => {
  it("una lectura lista nunca se regenera", () => {
    assert.equal(
      resolveNatalGenerationClaim({ status: "ready", payload: validPayload, updatedAt: 1 }, 1000),
      "ready"
    );
  });

  it("un pending reciente bloquea una segunda generación concurrente", () => {
    assert.equal(
      resolveNatalGenerationClaim({ status: "pending", payload: null, updatedAt: 1000 }, 2000),
      "pending"
    );
  });

  it("un pending vencido y los fallos se pueden retomar", () => {
    assert.equal(
      resolveNatalGenerationClaim({ status: "pending", payload: null, updatedAt: 1000 }, 302_001, 300_000),
      "claim"
    );
    assert.equal(
      resolveNatalGenerationClaim({ status: "error", payload: null, updatedAt: 1000 }, 2000),
      "claim"
    );
    assert.equal(resolveNatalGenerationClaim(null, 2000), "claim");
  });

  it("expone pending/ready/error para que el bloque inline nunca cargue a ciegas", () => {
    assert.equal(resolveNatalReadingPublicStatus(null, 2000), "pending");
    assert.equal(
      resolveNatalReadingPublicStatus({ status: "pending", payload: null, updatedAt: 1000 }, 2000),
      "pending"
    );
    assert.equal(
      resolveNatalReadingPublicStatus({ status: "pending", payload: null, updatedAt: 1000 }, 92_000, 90_000),
      "error"
    );
    assert.equal(resolveNatalReadingPublicStatus({ status: "error", payload: null }, 2000), "error");
    assert.equal(resolveNatalReadingPublicStatus({ status: "fallback", payload: null }, 2000), "error");
    assert.equal(
      resolveNatalReadingPublicStatus({ status: "ready", payload: validPayload, updatedAt: 1000 }, 2000),
      "ready"
    );
  });

  it("no presenta la plantilla corta ni estados incompletos como lectura terminada", () => {
    assert.equal(resolveReadyPersonalityReading(null), null);
    assert.equal(resolveReadyPersonalityReading({ status: "pending", payload: validPayload }), null);
    assert.equal(resolveReadyPersonalityReading({ status: "fallback", payload: validPayload }), null);
    assert.equal(resolveReadyPersonalityReading({ status: "error", payload: validPayload }), null);
    assert.equal(resolveReadyPersonalityReading({ status: "ready" }), null);
    assert.deepEqual(resolveReadyPersonalityReading({ status: "ready", payload: validPayload }), validPayload);
  });

  it("propaga el fallo del generador para que el cliente pueda ofrecer reintento", () => {
    assert.throws(
      () => requireSuccessfulNatalReading({ status: "disabled", gaps: ["llm_gateway_disabled"], warnings: [] }),
      /NATAL_READING_GENERATION_FAILED/
    );
    assert.throws(
      () => requireSuccessfulNatalReading({ status: "error", gaps: ["gateway_error"], warnings: [] }),
      /NATAL_READING_GENERATION_FAILED/
    );
    assert.deepEqual(
      requireSuccessfulNatalReading({ status: "success", payload: validPayload, gaps: [], warnings: [] }),
      validPayload
    );
  });

  it("usa la taxonomía canónica e incluye Júpiter, casas y aspectos en el prompt", () => {
    const prompt = buildNatalReadingGatewayPrompt({
      placements: [
        { key: "sun", sign: "Escorpio", house: 10 },
        { key: "jupiter", sign: "Capricornio", house: 12 }
      ],
      houses: [{ number: 10, sign: "Escorpio" }],
      aspects: [{ from: "Sol", to: "Luna", type: "conjunction" }],
      accuracy: "birth_time_known"
    });

    for (const key of NATAL_SECTION_KEYS) assert.match(prompt, new RegExp(`key "${key}"`));
    assert.match(prompt, /Júpiter/);
    assert.match(prompt, /"jupiter"/);
    assert.match(prompt, /"houses"/);
    assert.match(prompt, /"aspects"/);
    assert.match(prompt, /Sol \+ Ascendente/);
    assert.match(prompt, /Venus \+ Marte/);
  });

  it("acepta únicamente los siete capítulos completos y en orden", () => {
    assert.deepEqual(parseNatalReadingText(JSON.stringify(validPayload)), validPayload);
    assert.equal(
      parseNatalReadingText(JSON.stringify({ ...validPayload, sections: validPayload.sections.slice(0, 6) })),
      null
    );
    assert.equal(
      parseNatalReadingText(
        JSON.stringify({ ...validPayload, sections: [validPayload.sections[1], validPayload.sections[0], ...validPayload.sections.slice(2)] })
      ),
      null
    );
    assert.equal(
      parseNatalReadingText(
        JSON.stringify({
          ...validPayload,
          sections: [{ ...validPayload.sections[0], body: "Texto demasiado corto." }, ...validPayload.sections.slice(1)]
        })
      ),
      null
    );
  });

  it("genera desde la carta completa con presupuesto largo y devuelve los siete capítulos", async () => {
    let seenPrompt = "";
    let seenMaxTokens: number | undefined;
    const result = await generateNatalReadingWithGateway({
      chartPayload: {
        placements: [{ key: "jupiter", sign: "Capricornio", house: 12 }],
        aspects: [{ from: "Júpiter", to: "Saturno", type: "trine" }]
      },
      enabled: true,
      apiKey: "test-key",
      model: "openai/gpt-test",
      generateText: async (args) => {
        seenPrompt = args.prompt;
        seenMaxTokens = args.maxTokens;
        return { text: JSON.stringify(validPayload), usage: { totalTokens: 123 } };
      }
    });

    assert.equal(result.status, "success");
    assert.equal(result.payload?.sections.length, 7);
    assert.equal(seenMaxTokens, 7000);
    assert.match(seenPrompt, /"jupiter"/);
    assert.match(seenPrompt, /"aspects"/);
  });
});
