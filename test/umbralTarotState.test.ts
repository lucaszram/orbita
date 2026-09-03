import assert from "node:assert/strict";
import test from "node:test";
import { umbralTarotView } from "../src/components/web/umbral-tarot-state";

test("sin la guía del día la carta no se puede tocar", () => {
  assert.deepEqual(umbralTarotView({ status: "loading", hasCarta: false, revealed: false }), {
    mode: "cargando",
    disabled: true
  });
});

test("la guía llegó y la carta está cerrada: el ritual queda disponible", () => {
  assert.deepEqual(umbralTarotView({ status: "ready", hasCarta: true, revealed: false }), {
    mode: "cerrada",
    disabled: false
  });
});

test("dada vuelta con carta válida: revelada, y ya no se vuelve a tocar", () => {
  assert.deepEqual(umbralTarotView({ status: "ready", hasCarta: true, revealed: true }), {
    mode: "revelada",
    disabled: true
  });
});

test("revelada SIN carta es carga, no una carta dada vuelta", () => {
  // La regla del incidente: `getStrip` (reactiva) puede adelantarse a `getGuide`
  // (action). Girar hacia una cara vacía dejaba sólo el marco cobre.
  const view = umbralTarotView({ status: "ready", hasCarta: false, revealed: true });
  assert.equal(view.mode, "cargando");
  assert.equal(view.disabled, true);
});

test("la guía todavía cargando no revela aunque la tira ya diga que sí", () => {
  const view = umbralTarotView({ status: "loading", hasCarta: true, revealed: true });
  assert.equal(view.mode, "cargando");
  assert.equal(view.disabled, true);
});

test("la guía falló: error con reintento, nunca una carta muda", () => {
  assert.deepEqual(umbralTarotView({ status: "error", hasCarta: false, revealed: false }), {
    mode: "error",
    disabled: true
  });
});

test("el error gana sobre cualquier otro estado de la tira", () => {
  assert.equal(umbralTarotView({ status: "error", hasCarta: true, revealed: true }).mode, "error");
});
