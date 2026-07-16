import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dataPhase, liveAppGate, sessionPhase } from "../src/domain/screenPhase";

const AUTH_OK = { isLoaded: true, isConnecting: false, isSignedIn: true, isAuthenticated: true };

describe("liveAppGate — la carrera del primer render (userRow='idle')", () => {
  it("Clerk isSignedIn=true con Convex isAuthenticated=false → cargando, JAMÁS invitado", () => {
    // Sesión restaurada por Clerk, token todavía sin validar en Convex:
    // isConnecting puede ser false y userRow 'idle' — sigue siendo carga.
    const handshake = liveAppGate(
      { isLoaded: true, isConnecting: false, isSignedIn: true, isAuthenticated: false },
      "idle"
    );
    assert.equal(handshake.isLive, false);
    assert.equal(handshake.isAuthLoading, true);
    assert.equal(sessionPhase(handshake), "cargando");
    assert.notEqual(sessionPhase(handshake), "invitado");
  });
  it("sesión ya autenticada con la fila users SIN resolver (idle) → SIEMPRE cargando", () => {
    // Clerk restauró la sesión pero el efecto de ensureUser todavía no corrió:
    // el gate viejo daba isLive=false + isAuthLoading=false → 'invitado' → mocks.
    const idle = liveAppGate(AUTH_OK, "idle");
    assert.equal(idle.isLive, false);
    assert.equal(idle.isAuthLoading, true);
    assert.equal(sessionPhase(idle), "cargando");
  });

  it("pending → cargando; ready → live; error → error", () => {
    assert.equal(sessionPhase(liveAppGate(AUTH_OK, "pending")), "cargando");
    assert.equal(sessionPhase(liveAppGate(AUTH_OK, "ready")), "live");
    assert.equal(sessionPhase(liveAppGate(AUTH_OK, "error")), "error");
  });

  it("Clerk sin cargar o reconectando → cargando, incluso sin autenticación", () => {
    assert.equal(
      sessionPhase(
        liveAppGate({ isLoaded: false, isConnecting: false, isSignedIn: false, isAuthenticated: false }, "idle")
      ),
      "cargando"
    );
    assert.equal(
      sessionPhase(
        liveAppGate({ isLoaded: true, isConnecting: true, isSignedIn: false, isAuthenticated: false }, "idle")
      ),
      "cargando"
    );
  });

  it("invitado CONFIRMADO: Clerk resuelto, sin sesión (isSignedIn=false), sin conexión en curso", () => {
    assert.equal(
      sessionPhase(
        liveAppGate({ isLoaded: true, isConnecting: false, isSignedIn: false, isAuthenticated: false }, "idle")
      ),
      "invitado"
    );
  });
});

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
