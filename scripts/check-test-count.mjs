#!/usr/bin/env node
// Órbita — piso de cobertura de la suite.
//
// Lee la SALIDA de una corrida ya hecha (`pnpm test`); no ejecuta tests. Así la
// suite corre una sola vez en CI y este gate sólo la juzga:
//
//   pnpm test 2>&1 | tee test-output.log
//   pnpm check:test-count test-output.log
//
// Falla (exit 1) si:
//   · algún test falló;
//   · pasaron menos de 857 tests;
//   · la salida no tiene resumen (la corrida se cayó antes de terminar).
//
// El último punto es el que importa de verdad: sin él, una corrida que explota
// al arrancar no imprime `fail` y el gate la dejaría pasar en verde.
//
// Sin dependencias: sólo `node:fs`. La decisión es pura (`evaluateTestRun`) y
// está testeada en `test/testCountGate.test.ts`.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Piso de tests. Se sube cuando la suite crece; nunca se baja para tapar un
 * borrado.
 *
 * CORE-191 (la sección Hoy) suma 112 casos: 25 en `hoyPrincipal.test.ts`, 45 en
 * `lunaCarta.test.ts` y 42 en `hoySection.test.ts`. El piso es 745 + 112.
 *
 * Los otros cinco archivos que la tarjeta tocó —`responsiveShells`,
 * `accesoPostAlta`, `onboardingReadiness`, `umbralTarotWiring` y
 * `parityFoundations`— no mueven el número: sus casos cambiaron de superficie
 * (el ritual del Tarot vive ahora en el Umbral), no de cantidad.
 */
export const DEFAULT_MINIMUM = 857;

/**
 * Lee un contador del resumen final del runner de Node.
 *
 * Se acepta el formato legible (`ℹ pass 764`) y el TAP (`# pass 764`), porque
 * el runner cambia de uno a otro según si la salida es una terminal. Se toma la
 * ÚLTIMA aparición: el nombre de un test puede contener cualquier cosa, pero el
 * resumen siempre va al final.
 */
export function readCounter(output, name) {
  const re = new RegExp(String.raw`^\s*(?:ℹ|#)\s*${name}\s+(\d+)\s*$`, "gm");
  let last = null;
  for (const match of output.matchAll(re)) last = Number(match[1]);
  return last;
}

/**
 * Decisión pura: dado el texto de la corrida, ¿la suite alcanza el piso?
 * No toca el disco ni ejecuta nada.
 */
export function evaluateTestRun(output, { minimum = DEFAULT_MINIMUM } = {}) {
  const pass = readCounter(output, "pass");
  const fail = readCounter(output, "fail");
  const failures = [];

  if (pass === null || fail === null) {
    failures.push(
      "la salida no tiene el resumen del runner (`pass` / `fail`): la corrida no terminó o el formato cambió"
    );
    return { ok: false, pass, fail, minimum, failures };
  }

  if (fail > 0) failures.push(`${fail} test(s) fallaron`);
  if (pass < minimum) {
    failures.push(`pasaron ${pass} tests y el piso es ${minimum}: faltan ${minimum - pass}`);
  }

  return { ok: failures.length === 0, pass, fail, minimum, failures };
}

function main(argv) {
  const path = argv[2] ?? "test-output.log";

  let output;
  try {
    output = readFileSync(path, "utf8");
  } catch {
    console.error(
      `✗ no pude leer la salida de los tests en \`${path}\`. Generala con \`pnpm test 2>&1 | tee ${path}\`.`
    );
    return 1;
  }

  const result = evaluateTestRun(output);

  console.log(`Órbita · piso de la suite (\`${path}\`)`);
  console.log(`  tests que pasaron    ${result.pass ?? "?"}  / mínimo ${result.minimum}`);
  console.log(`  tests que fallaron   ${result.fail ?? "?"}  / máximo 0`);

  if (result.ok) {
    console.log("✓ la suite entra en el piso de cobertura.");
    return 0;
  }

  console.error("");
  for (const failure of result.failures) console.error(`✗ ${failure}`);
  return 1;
}

// Sólo corre como CLI; importado desde los tests no ejecuta nada.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv));
}
