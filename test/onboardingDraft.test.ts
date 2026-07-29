import assert from "node:assert/strict";
import test from "node:test";
import {
  isWorthSaving,
  parseDraft,
  serializeDraft,
  type OnboardingDraft
} from "../src/domain/onboardingDraft";

const STEPS = 15;

const FULL: OnboardingDraft = {
  index: 11,
  identity: "mujer",
  day: "12",
  month: "4",
  year: "1994",
  placeQuery: "Rosario",
  place: "Rosario, Santa Fe, Argentina",
  placeHit: { label: "Rosario", latitude: -32.95, longitude: -60.65, timezone: "America/Argentina/Cordoba" },
  hour: "10",
  minute: "40",
  timeUnknown: false,
  plan: "annual",
  triad: { resolved: true, sun: "Aries", moon: "Tauro", ascendant: "Virgo" }
};

// La regresión que motiva esto: crear la cuenta hace que Clerk vuelva a
// /empezar; sin borrador, el remonte perdía fecha, lugar, hora, tríada y paso,
// y la persona volvía a empezar de cero justo después de registrarse.

test("un borrador completo sobrevive el ida y vuelta", () => {
  const back = parseDraft(serializeDraft(FULL), STEPS);
  assert.deepEqual(back, FULL);
});

test("se conservan fecha, hora, lugar, tríada y paso", () => {
  const back = parseDraft(serializeDraft(FULL), STEPS)!;
  assert.equal(back.index, 11);
  assert.equal(`${back.year}-${back.month}-${back.day}`, "1994-4-12");
  assert.equal(`${back.hour}:${back.minute}`, "10:40");
  assert.equal(back.place, "Rosario, Santa Fe, Argentina");
  assert.equal(back.placeHit?.latitude, -32.95);
  assert.equal(back.triad?.sun, "Aries");
});

test("la hora desconocida se conserva como tal", () => {
  const sinHora: OnboardingDraft = { ...FULL, hour: "", minute: "", timeUnknown: true };
  const back = parseDraft(serializeDraft(sinHora), STEPS)!;
  assert.equal(back.timeUnknown, true);
  assert.equal(back.hour, "");
});

// --- Lectura defensiva -----------------------------------------------------

test("un borrador corrupto no rompe el arranque", () => {
  for (const raw of [null, "", "{", "null", "[]", '"texto"', "123"]) {
    assert.equal(parseDraft(raw, STEPS), null, JSON.stringify(raw));
  }
});

test("un índice fuera de rango se descarta entero", () => {
  // Un borrador de una versión con más pasos apuntaría a un paso inexistente.
  assert.equal(parseDraft(JSON.stringify({ ...FULL, index: 99 }), STEPS), null);
  assert.equal(parseDraft(JSON.stringify({ ...FULL, index: -1 }), STEPS), null);
  assert.equal(parseDraft(JSON.stringify({ ...FULL, index: 1.5 }), STEPS)?.index, 0);
});

test("campos de tipo inesperado no se propagan", () => {
  const sucio = parseDraft(
    JSON.stringify({ index: 3, day: 12, place: 99, timeUnknown: "sí", placeHit: "no-es-objeto", triad: "x" }),
    STEPS
  )!;
  assert.equal(sucio.day, "");
  assert.equal(sucio.place, undefined);
  assert.equal(sucio.timeUnknown, false);
  assert.equal(sucio.placeHit, undefined);
  assert.equal(sucio.triad, undefined);
  assert.equal(sucio.index, 3);
});

test("una tríada sin resolver se conserva sin inventar signos", () => {
  const pendiente = { ...FULL, triad: { resolved: false, sun: null, moon: null, ascendant: null } };
  const back = parseDraft(serializeDraft(pendiente), STEPS)!;
  assert.deepEqual(back.triad, { resolved: false, sun: null, moon: null, ascendant: null });
});

// --- Cuándo guardar --------------------------------------------------------

test("no se guarda un borrador vacío en el primer paso", () => {
  const vacio: OnboardingDraft = {
    index: 0, day: "", month: "", year: "", placeQuery: "", hour: "", minute: "", timeUnknown: false
  };
  assert.equal(isWorthSaving(vacio), false);
});

test("se guarda apenas hay avance o algún dato", () => {
  const base: OnboardingDraft = {
    index: 0, day: "", month: "", year: "", placeQuery: "", hour: "", minute: "", timeUnknown: false
  };
  assert.equal(isWorthSaving({ ...base, index: 1 }), true);
  assert.equal(isWorthSaving({ ...base, day: "12" }), true);
  assert.equal(isWorthSaving({ ...base, identity: "mujer" }), true);
});

// Regresión: el efecto que invalida la tríada cuando cambian los datos de
// nacimiento también corría en el primer render, así que al volver de crear la
// cuenta borraba la tríada restaurada aunque nada hubiera cambiado. La firma
// de los datos es la que decide si hubo un cambio real.

function birthSignature(d: OnboardingDraft): string {
  return [d.day, d.month, d.year, d.hour, d.minute, d.timeUnknown, d.place, d.placeQuery].join("|");
}

test("restaurar el borrador no cuenta como cambio de datos de nacimiento", () => {
  const restaurado = parseDraft(serializeDraft(FULL), STEPS)!;
  assert.equal(birthSignature(restaurado), birthSignature(FULL));
});

test("editar cualquier dato de nacimiento sí cambia la firma", () => {
  const base = birthSignature(FULL);
  assert.notEqual(birthSignature({ ...FULL, day: "13" }), base);
  assert.notEqual(birthSignature({ ...FULL, hour: "11" }), base);
  assert.notEqual(birthSignature({ ...FULL, place: "Córdoba" }), base);
  assert.notEqual(birthSignature({ ...FULL, timeUnknown: true }), base);
});
