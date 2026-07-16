import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dataPhase, sessionPhase } from "../src/domain/screenPhase";

/**
 * Regla anti-flash de mocks: "invitado" es la ÚNICA fase que puede renderizar
 * la experiencia demo/mock. Estas regresiones fijan que ninguna otra
 * combinación de sesión/dato cae ahí.
 */

describe("sessionPhase — la sesión decide antes que nada", () => {
  it("1 · auth sin resolver → cargando, jamás la fase que muestra mocks", () => {
    assert.equal(sessionPhase({ isAuthLoading: true, userError: false, isLive: false }), "cargando");
    // reconexión: isLive puede seguir true mientras auth revalida — sigue siendo carga
    assert.equal(sessionPhase({ isAuthLoading: true, userError: false, isLive: true }), "cargando");
  });

  it("3 · sesión rota → error con reintento, no mock", () => {
    assert.equal(sessionPhase({ isAuthLoading: false, userError: true, isLive: false }), "error");
  });

  it("invitado CONFIRMADO (Clerk resuelto, sin sesión) → recién ahí la demo", () => {
    assert.equal(sessionPhase({ isAuthLoading: false, userError: false, isLive: false }), "invitado");
  });

  it("sesión viva → live (el dato decide el resto)", () => {
    assert.equal(sessionPhase({ isAuthLoading: false, userError: false, isLive: true }), "live");
  });
});

describe("dataPhase — con sesión viva, el dato decide", () => {
  it("2 · query/action pendiente → cargando, no mock", () => {
    assert.equal(dataPhase({ pending: true }), "cargando");
  });

  it("3 · action falló → error (aunque también esté pendiente un reintento)", () => {
    assert.equal(dataPhase({ pending: false, failed: true }), "error");
    assert.equal(dataPhase({ pending: true, failed: true }), "error");
  });

  it("4 · el backend confirmó que no hay datos → vacío real, no demo", () => {
    assert.equal(dataPhase({ pending: false, empty: true }), "vacio");
  });

  it("dato presente → listo", () => {
    assert.equal(dataPhase({ pending: false }), "listo");
    assert.equal(dataPhase({ pending: false, failed: false, empty: false }), "listo");
  });
});
