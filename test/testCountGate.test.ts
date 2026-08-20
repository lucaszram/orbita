/**
 * Piso de cobertura de la suite (`scripts/check-test-count.mjs`).
 *
 * Lo que se prueba es la DECISIÓN sobre la salida de una corrida, no la corrida:
 * el gate existe para que un borrado accidental de tests —o una corrida que se
 * cae antes de terminar— no pase en verde por CI. El modo silencioso es el
 * peligroso: sin resumen no hay `fail 0` que leer, y un gate ingenuo lo tomaría
 * como "nada falló".
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_MINIMUM, evaluateTestRun, readCounter } from "../scripts/check-test-count.mjs";

/** Cola real de una corrida del runner de Node, en su formato legible. */
const resumen = (pass: number, fail = 0) =>
  [
    "✔ la rueda rota al Ascendente (0.095958ms)",
    `ℹ tests ${pass + fail}`,
    "ℹ suites 64",
    `ℹ pass ${pass}`,
    `ℹ fail ${fail}`,
    "ℹ cancelled 0",
    "ℹ skipped 0",
    "ℹ todo 0",
    "ℹ duration_ms 1837.980625",
    ""
  ].join("\n");

test("el piso acompaña a la suite: 2347 tests", () => {
  // El brief original pedía 745; la suite creció con V4.9.2, identidad, comercio,
  // la reestructura de la pestaña 5, el bloque de frescura, Hoy sin arco, los
  // detalles editoriales y ahora el cierre de frescura —el resultado que resuelve
  // sin cielo, la ruta vieja del arco y el destino de la pestaña Tránsitos—. El
  // piso sube con ella —y queda en el conteo REAL de la corrida, no en un número
  // redondo—: bajar de acá significa que se borró o se debilitó una prueba.
  assert.equal(DEFAULT_MINIMUM, 2347);
});

test("una corrida completa por encima del piso pasa", () => {
  const verdict = evaluateTestRun(resumen(2384));
  assert.equal(verdict.ok, true);
  assert.equal(verdict.pass, 2384);
  assert.deepEqual(verdict.failures, []);
});

test("el piso incluye su propio número: exactamente 2347 pasa, 2346 falla", () => {
  assert.equal(evaluateTestRun(resumen(2347)).ok, true);

  const abajo = evaluateTestRun(resumen(2346));
  assert.equal(abajo.ok, false);
  assert.match(abajo.failures[0], /2346/);
  assert.match(abajo.failures[0], /falta/);
});

test("un test fallado hace fallar el gate aunque sobre cobertura", () => {
  const verdict = evaluateTestRun(resumen(800, 3));
  assert.equal(verdict.ok, false);
  assert.equal(verdict.fail, 3);
  assert.match(verdict.failures[0], /3 test\(s\) fallaron/);
});

test("una corrida sin resumen NO pasa: la ausencia de `fail` no es `fail 0`", () => {
  const verdict = evaluateTestRun("Error: Cannot find module 'tsx'\n");
  assert.equal(verdict.ok, false);
  assert.equal(verdict.pass, null);
  assert.match(verdict.failures[0], /resumen/);
});

test("el formato TAP del runner también se lee", () => {
  const tap = ["# tests 2367", "# pass 2367", "# fail 0", ""].join("\n");
  const verdict = evaluateTestRun(tap);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.pass, 2367);
});

test("un nombre de test que imita el resumen no le gana al resumen real", () => {
  // El resumen va al final; se toma la última aparición, no la primera.
  const salida = ["✔ pass 1 no debería contar (0.1ms)", resumen(2367)].join("\n");
  assert.equal(readCounter(salida, "pass"), 2367);
});

test("el mínimo es configurable para poder subir el piso sin tocar la lógica", () => {
  assert.equal(evaluateTestRun(resumen(2367), { minimum: 2427 }).ok, false);
  assert.equal(evaluateTestRun(resumen(2367), { minimum: 700 }).ok, true);
});
