import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNatalReadingGatewayPrompt,
  generateNatalReadingWithGateway,
  NATAL_SECTION_KEYS,
  parseNatalReadingText
} from "../convex/lib/aiGateway";

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
