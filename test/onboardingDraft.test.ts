import assert from "node:assert/strict";
import test from "node:test";
import {
  isWorthSaving,
  parseDraft,
  serializeDraft,
  type OnboardingDraft
} from "../src/domain/onboardingDraft";

/** El flujo canónico tiene 15 pasos (`TOTAL` en OnboardingFlow.tsx). */
const STEPS = 15;

const FULL: OnboardingDraft = {
  step: 13,
  identity: "ella",
  birthDate: { day: 12, month: 4, year: 1994 },
  placeQuery: "Rosario",
  birthPlace: {
    label: "Rosario, Santa Fe, Argentina",
    latitude: -32.95,
    longitude: -60.65,
    timezone: "America/Argentina/Cordoba"
  },
  birthTime: { hour: 10, minute: 40 },
  timeUnknown: false,
  email: "alguien@example.com"
};

// La regresión que motiva esto: crear la cuenta hace que Clerk vuelva a
// /empezar; sin borrador, el remonte perdía identidad, fecha, lugar, hora y
// paso, y la persona volvía a empezar de cero justo después de registrarse.

test("un borrador completo sobrevive el ida y vuelta", () => {
  assert.deepEqual(parseDraft(serializeDraft(FULL), STEPS), FULL);
});

test("se conservan identidad, fecha, hora, lugar y paso", () => {
  const back = parseDraft(serializeDraft(FULL), STEPS)!;
  assert.equal(back.step, 13);
  assert.equal(back.identity, "ella");
  assert.deepEqual(back.birthDate, { day: 12, month: 4, year: 1994 });
  assert.deepEqual(back.birthTime, { hour: 10, minute: 40 });
  assert.equal(back.birthPlace?.label, "Rosario, Santa Fe, Argentina");
  assert.equal(back.birthPlace?.latitude, -32.95);
  assert.equal(back.email, "alguien@example.com");
});

test("la medianoche exacta se conserva: 0 es una hora válida", () => {
  const medianoche: OnboardingDraft = { ...FULL, birthTime: { hour: 0, minute: 0 } };
  assert.deepEqual(parseDraft(serializeDraft(medianoche), STEPS)?.birthTime, { hour: 0, minute: 0 });
});

test("la hora desconocida se conserva como tal", () => {
  const sinHora: OnboardingDraft = { ...FULL, timeUnknown: true };
  assert.equal(parseDraft(serializeDraft(sinHora), STEPS)?.timeUnknown, true);
});

// --- Lectura defensiva -----------------------------------------------------

test("un borrador corrupto no rompe el arranque", () => {
  for (const raw of [null, "", "{", "null", "[]", '"texto"', "123"]) {
    assert.equal(parseDraft(raw, STEPS), null, JSON.stringify(raw));
  }
});

test("un paso fuera de rango descarta el borrador entero", () => {
  // Un borrador de una versión con más pasos apuntaría a un paso inexistente.
  assert.equal(parseDraft(JSON.stringify({ ...FULL, step: 99 }), STEPS), null);
  assert.equal(parseDraft(JSON.stringify({ ...FULL, step: -1 }), STEPS), null);
  assert.equal(parseDraft(JSON.stringify({ ...FULL, step: 1.5 }), STEPS), null);
});

test("una fecha parcial o imposible se descarta entera, no se completa", () => {
  for (const birthDate of [{ day: 12 }, { day: 32, month: 4, year: 1994 }, { day: 12, month: 13, year: 1994 }, "x"]) {
    const back = parseDraft(JSON.stringify({ ...FULL, birthDate }), STEPS)!;
    assert.equal(back.birthDate, undefined, JSON.stringify(birthDate));
  }
});

test("una hora imposible se descarta entera", () => {
  for (const birthTime of [{ hour: 24, minute: 0 }, { hour: 10 }, { hour: 10, minute: 60 }]) {
    assert.equal(parseDraft(JSON.stringify({ ...FULL, birthTime }), STEPS)?.birthTime, undefined);
  }
});

test("un lugar sin etiqueta no se restaura", () => {
  assert.equal(parseDraft(JSON.stringify({ ...FULL, birthPlace: { latitude: 1 } }), STEPS)?.birthPlace, undefined);
  assert.equal(parseDraft(JSON.stringify({ ...FULL, birthPlace: "Rosario" }), STEPS)?.birthPlace, undefined);
});

test("campos de tipo inesperado no se propagan", () => {
  const sucio = parseDraft(JSON.stringify({ step: 3, placeQuery: 99, timeUnknown: "sí", email: 5 }), STEPS)!;
  assert.equal(sucio.placeQuery, "");
  assert.equal(sucio.timeUnknown, false);
  assert.equal(sucio.email, "");
  assert.equal(sucio.step, 3);
});

// --- Cuándo guardar --------------------------------------------------------

const VACIO: OnboardingDraft = { step: 0, placeQuery: "", timeUnknown: false, email: "" };

test("no se guarda un borrador vacío en el primer paso", () => {
  assert.equal(isWorthSaving(VACIO), false);
});

test("se guarda apenas hay avance o algún dato", () => {
  assert.equal(isWorthSaving({ ...VACIO, step: 1 }), true);
  assert.equal(isWorthSaving({ ...VACIO, placeQuery: "Rosario" }), true);
  assert.equal(isWorthSaving({ ...VACIO, email: "a@b.com" }), true);
  assert.equal(isWorthSaving({ ...VACIO, birthPlace: { label: "Rosario" } }), true);
});
