import assert from "node:assert/strict";
import test from "node:test";
import { personalityPhase, surfaceAccess, valuesMapPhase } from "../src/domain/entitlement";
import { readingBlockPhase } from "../src/domain/cartaNatalCarga";

const FREE = { isPro: false };
const PLUS = { isPro: true };

test("una superficie no se decide hasta saber el plan", () => {
  assert.equal(surfaceAccess({ entitlement: undefined }), "cargando");
});

test("el access del payload manda sobre el entitlement", () => {
  assert.equal(surfaceAccess({ entitlement: FREE, granted: true }), "libre");
  assert.equal(surfaceAccess({ entitlement: PLUS, granted: false }), "bloqueado");
});

test("sin entitlement resuelto a null se falla cerrado", () => {
  assert.equal(surfaceAccess({ entitlement: null }), "bloqueado");
});

// --- Mapa de valores -------------------------------------------------------
// `charts.valuesMap` devuelve null tanto para Free como para "sin carta".

test("un Free CON carta ve el bloqueo por plan, no 'completá tus datos'", () => {
  assert.equal(valuesMapPhase({ values: null, entitlement: FREE, hasChart: true }), "bloqueado");
});

test("sin carta se pide completar los datos aunque sea Free", () => {
  assert.equal(valuesMapPhase({ values: null, entitlement: FREE, hasChart: false }), "sinCarta");
});

test("un Plus con carta y null todavía está cargando", () => {
  assert.equal(valuesMapPhase({ values: null, entitlement: PLUS, hasChart: true }), "cargando");
});

test("mientras no se sepa el plan no se afirma nada", () => {
  assert.equal(valuesMapPhase({ values: null, entitlement: undefined, hasChart: true }), "cargando");
  assert.equal(valuesMapPhase({ values: null, entitlement: FREE, hasChart: undefined }), "cargando");
});

test("con datos se muestra el mapa", () => {
  assert.equal(valuesMapPhase({ values: { axes: [] }, entitlement: FREE, hasChart: true }), "listo");
});

// --- Lectura de personalidad ----------------------------------------------

test("locked es bloqueo por plan, no error ni carga eterna", () => {
  assert.equal(
    personalityPhase({ reading: null, state: { status: "locked" }, hasChart: true }),
    "bloqueado"
  );
});

test("una lectura ya recibida gana sobre cualquier estado", () => {
  assert.equal(
    personalityPhase({ reading: { sections: [] }, state: { status: "error" }, hasChart: true }),
    "listo"
  );
});

test("pending con carta es generación en curso", () => {
  assert.equal(personalityPhase({ reading: null, state: { status: "pending" }, hasChart: true }), "generando");
});

test("error con carta ofrece reintento", () => {
  assert.equal(personalityPhase({ reading: null, state: { status: "error" }, hasChart: true }), "error");
});

// --- Bloque inline de la Carta nativa --------------------------------------
// Regresión: para un Free la action de generación rechaza por diseño. Antes
// eso caía en "error" con REINTENTAR, o en "Preparando…" para siempre si la
// query llegaba primero.

test("un Free no ve REINTENTAR sobre una generación que el backend rechaza", () => {
  assert.equal(readingBlockPhase({ reading: null, failed: true, state: "locked" }), "bloqueado");
});

test("un Free no queda en 'Preparando…' eterno", () => {
  assert.equal(readingBlockPhase({ reading: null, failed: false, state: "locked" }), "bloqueado");
  assert.equal(
    readingBlockPhase({ reading: null, failed: false, generating: true, state: "locked" }),
    "bloqueado"
  );
});

test("el bloqueo no tapa una lectura que sí llegó", () => {
  assert.equal(readingBlockPhase({ reading: { ok: true }, failed: false, state: "locked" }), "listo");
});

test("los estados previos siguen igual", () => {
  assert.equal(readingBlockPhase({ reading: null, failed: false, state: "pending" }), "cargando");
  assert.equal(readingBlockPhase({ reading: null, failed: false, state: "error" }), "error");
  assert.equal(readingBlockPhase({ reading: null, failed: true, state: "pending" }), "error");
});
