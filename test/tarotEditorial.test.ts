import assert from "node:assert/strict";
import test from "node:test";
import {
  TAROT_EDITORIAL_READING_COUNT,
  TAROT_EDITORIAL_READINGS,
  editorialRitualFor
} from "../convex/content/tarotEditorial";
import { TAROT_DECK } from "../convex/lib/tarot";
import { parseRitual } from "../convex/daily";

const BANNED_VISIBLE = [
  "puede que",
  "quizás",
  "tal vez",
  "es posible que",
  "date permiso",
  "permitite",
  "el universo",
  "no predice",
  "no define el día",
  "no es una orden",
  "carta natal",
  "tránsito"
];

test("el catálogo contiene las 78 cartas en ambas orientaciones", () => {
  assert.equal(TAROT_DECK.length, 78);
  assert.equal(TAROT_EDITORIAL_READING_COUNT, 156);

  for (const card of TAROT_DECK) {
    for (const orientacion of ["derecho", "invertida"] as const) {
      const ritual = editorialRitualFor(card.id, orientacion);
      assert.ok(ritual);
      assert.equal(ritual.significadoGeneral.length, 3);
    }
  }
});

test("las 156 lecturas son completas, únicas y no fingen personalización", () => {
  const serialized = new Set<string>();
  for (const reading of TAROT_EDITORIAL_READINGS) {
    assert.deepEqual(parseRitual(reading.ritual), reading.ritual);
    const visible = JSON.stringify(reading.ritual).toLowerCase();
    for (const banned of BANNED_VISIBLE) assert.equal(visible.includes(banned), false, `${reading.id}:${reading.orientacion} contiene ${banned}`);
    serialized.add(JSON.stringify(reading.ritual));
  }
  assert.equal(serialized.size, 156);
});

test("El Hierofante invertido conserva el nivel editorial aprobado", () => {
  const ritual = editorialRitualFor(5, "invertida");
  assert.equal(ritual.significadoGeneral[0]?.titulo, "Rebeldía reflejo");
  assert.match(ritual.esencia, /fricción con normas, autoridades o lenguajes heredados/);
  assert.match(ritual.enTuDia, /rechazar toda estructura antes de probarla/);
  assert.equal(ritual.cierre.pregunta, "¿Qué idea heredada seguís defendiendo o combatiendo sin revisarla de verdad?");
});

test("una lectura inexistente falla cerrado en vez de inventar copy", () => {
  assert.throws(() => editorialRitualFor(78, "derecho"), /Missing editorial tarot ritual/);
});
