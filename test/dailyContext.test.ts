import assert from "node:assert/strict";
import test from "node:test";
import {
  observedDateInTimezone,
  refetchReason,
  type DailyContextState
} from "../src/domain/dailyContext";

const CONTEXT = { localDate: "2026-07-28", timezone: "America/Argentina/Buenos_Aires" };

function listo(observedDate: string): DailyContextState {
  return { status: "listo", context: CONTEXT, observedDate };
}

const BASE = {
  accountKey: "user_1",
  fetchedForAccount: "user_1",
  cameToForeground: false
};

test("sin sesión no se pide contexto", () => {
  assert.equal(
    refetchReason({ ...BASE, state: { status: "idle" }, accountKey: null, currentObserved: "2026-07-28" }),
    null
  );
});

test("la primera vez se pide", () => {
  assert.equal(
    refetchReason({ ...BASE, state: { status: "idle" }, fetchedForAccount: null, currentObserved: "" }),
    "primeraVez"
  );
});

test("un error anterior se reintenta en el próximo tick", () => {
  assert.equal(refetchReason({ ...BASE, state: { status: "error" }, currentObserved: "" }), "primeraVez");
});

test("mientras hay una petición en vuelo no se dispara otra", () => {
  assert.equal(refetchReason({ ...BASE, state: { status: "cargando" }, currentObserved: "2026-07-29" }), null);
});

test("entrar con otra cuenta refresca el contexto", () => {
  assert.equal(
    refetchReason({
      ...BASE,
      state: listo("2026-07-28"),
      accountKey: "user_2",
      fetchedForAccount: "user_1",
      currentObserved: "2026-07-28"
    }),
    "cambioDeCuenta"
  );
});

test("cruzar la medianoche refresca", () => {
  assert.equal(
    refetchReason({ ...BASE, state: listo("2026-07-28"), currentObserved: "2026-07-29" }),
    "medianoche"
  );
});

test("volver al frente refresca", () => {
  assert.equal(
    refetchReason({ ...BASE, state: listo("2026-07-28"), currentObserved: "2026-07-28", cameToForeground: true }),
    "foreground"
  );
});

test("un render cualquiera no refresca", () => {
  assert.equal(refetchReason({ ...BASE, state: listo("2026-07-28"), currentObserved: "2026-07-28" }), null);
});

// Regresión del riesgo de loop: la fecha del servidor puede diferir a propósito
// de la que ve el navegador (ciclo ya abierto congelado al editar el lugar
// natal). Comparar contra `localDate` en vez de `observedDate` refetchearía
// para siempre.
test("un servidor en otra fecha que el navegador no provoca refetch en loop", () => {
  const state = listo("2026-07-28"); // el navegador veía el 28 al pedirlo
  assert.equal(state.status === "listo" && state.context.localDate, "2026-07-28");
  const conServidorAtrasado: DailyContextState = {
    status: "listo",
    context: { localDate: "2026-07-27", timezone: CONTEXT.timezone },
    observedDate: "2026-07-28"
  };
  assert.equal(
    refetchReason({ ...BASE, state: conServidorAtrasado, currentObserved: "2026-07-28" }),
    null
  );
});

test("una zona inválida no dispara refetch en loop", () => {
  assert.equal(observedDateInTimezone(Date.UTC(2026, 6, 28, 12), "No/Existe"), "");
  assert.equal(refetchReason({ ...BASE, state: listo("2026-07-28"), currentObserved: "" }), null);
});

test("la fecha observada respeta la zona, no el reloj del proceso", () => {
  // 2026-07-28 02:00 UTC → todavía 27 en Buenos Aires (UTC-3), ya 28 en Madrid.
  const instante = Date.UTC(2026, 6, 28, 2, 0, 0);
  assert.equal(observedDateInTimezone(instante, "America/Argentina/Buenos_Aires"), "2026-07-27");
  assert.equal(observedDateInTimezone(instante, "Europe/Madrid"), "2026-07-28");
});
