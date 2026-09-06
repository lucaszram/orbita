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

test("el piso es el del brief más lo que sumaron CORE-191, el detalle del ranking, Vínculos, el panorama de Tránsitos, la biblioteca de Vínculos, la estación vital, el límite Free el tema del año y la Carta responsive: 997 tests", () => {
  // 745 + 116 casos nuevos de la sección Hoy (hoyPrincipal 27, lunaCarta 45,
  // hoySection 44). El piso se sube con lo que se agregó DE VERDAD: los otros
  // archivos que la tarjeta tocó repuntaron sus afirmaciones a la superficie
  // nueva sin agregar ni borrar un solo caso. La profundización del ranking
  // (`transitDetail.test.ts`) suma 22 casos más: 861 + 22.
  assert.equal(DEFAULT_MINIMUM, 997);
});

test("una corrida completa por encima del piso pasa", () => {
  const verdict = evaluateTestRun(resumen(1000));
  assert.equal(verdict.ok, true);
  assert.equal(verdict.pass, 1000);
  assert.deepEqual(verdict.failures, []);
});

test("el piso incluye su propio número: exactamente 997 pasa, 996 falla", () => {
  assert.equal(evaluateTestRun(resumen(997)).ok, true);

  const abajo = evaluateTestRun(resumen(996));
  assert.equal(abajo.ok, false);
  assert.match(abajo.failures[0], /996/);
  assert.match(abajo.failures[0], /falta/);
});

test("un test fallado hace fallar el gate aunque sobre cobertura", () => {
  const verdict = evaluateTestRun(resumen(1000, 3));
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
  const tap = ["# tests 1000", "# pass 1000", "# fail 0", ""].join("\n");
  const verdict = evaluateTestRun(tap);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.pass, 1000);
});

test("un nombre de test que imita el resumen no le gana al resumen real", () => {
  // El resumen va al final; se toma la última aparición, no la primera.
  const salida = ["✔ pass 1 no debería contar (0.1ms)", resumen(1000)].join("\n");
  assert.equal(readCounter(salida, "pass"), 1000);
});

test("el mínimo es configurable para poder subir el piso sin tocar la lógica", () => {
  assert.equal(evaluateTestRun(resumen(1000), { minimum: 1100 }).ok, false);
  assert.equal(evaluateTestRun(resumen(1000), { minimum: 800 }).ok, true);
});
