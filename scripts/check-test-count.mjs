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
//   · pasaron menos de 883 tests;
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
 * CORE-191 (la sección Hoy) suma 116 casos: 27 en `hoyPrincipal.test.ts`, 45 en
 * `lunaCarta.test.ts` y 44 en `hoySection.test.ts`. El piso es 745 + 116.
 *
 * La profundización del ranking (cada tránsito abre su detalle) suma 22 casos
 * en `transitDetail.test.ts`: 861 + 22.
 *
 * Los otros cinco archivos que la tarjeta tocó —`responsiveShells`,
 * `accesoPostAlta`, `onboardingReadiness`, `umbralTarotWiring` y
 * `parityFoundations`— no mueven el número: sus casos cambiaron de superficie
 * (el ritual del Tarot vive ahora en el Umbral), no de cantidad.
 *
 * La primera comparación de Vínculos (CORE-212) suma 35 casos: 23 en
 * `synastry.test.ts` (contactos, orbes, ejes, dimensiones, tono, precisión) y
 * 12 en `vinculo.test.ts` (alta por nivel, fecha y hora, conteos): 883 + 35.
 *
 * El panorama de Tránsitos (CORE-207) suma 28 casos: 19 en
 * `transitPanorama.test.ts` (hora sin zona, fase, pico, cercanía, «ahora»,
 * filas, totales, Free bloqueado, legacy) y 9 en `transitosPanorama.test.ts`
 * (fila en pantalla, plegado, encabezado, intro, estado): 918 + 28.
 *
 * La biblioteca de personas guardadas (CORE-213) suma 4 casos en
 * `vinculo.test.ts` (línea de persona, resumen del vínculo, nivel, id de
 * perfil): 946 + 4.
 *
 * Tu momento · Estación vital (CORE-209) suma 20 casos: 13 en
 * `estacionVital.test.ts` (fase, ángulo, fechas, sin hora, límites, fallos,
 * normalizador tropical) y 7 en `momento.test.ts` (copy, números, fechas,
 * estado): 950 + 20.
 *
 * El límite Free de Vínculos (CORE-214) suma 4 casos: 1 en `synastry.test.ts`
 * (`personAccess`) y 3 en `vinculo.test.ts` (rótulo del cupo, nota del plan,
 * acción de agregar): 970 + 4.
 *
 * El tema del año (CORE-210) suma 13 casos: 10 en `temaDelAno.test.ts`
 * (profección, bordes del año, gap de medianoche, lo que no se calcula) y 3
 * en `momento.test.ts` (titular Build 30, lectura, estado de pantalla): 974 + 13.
 *
 * La Carta responsive (CORE-215) suma 10 casos en `cartaCompleta.test.ts`
 * (códigos, tríada, resumen, posiciones, ejes, contactos, casas, datos
 * natales, último cálculo, piso de grado): 987 + 10.
 *
 * Los cuatro ritmos (CORE-211) suman 9 casos: 6 en `cuatroRitmos.test.ts`
 * (anillos, franjas, tránsito, vacíos, fuente caída, límites) y 3 en
 * `momento.test.ts` (lectura del mandala, arco, estado): 997 + 9.
 *
 * Lo principal de Hoy (CORE-237) suma 1 caso en `hoyPrincipal.test.ts` (el contexto del año): 1006 + 1.
 *
 * El ranking de Hoy como el de Tránsitos (CORE-238) suma 2 casos en `hoyPrincipal.test.ts`: 1007 + 2.
 *
 * La biblioteca de Vínculos como el frame (CORE-235) suma 3 casos en `vinculo.test.ts`: 1009 + 3.
 *
 * La comparación de Vínculos como el frame (CORE-236) suma 5 casos en `vinculo.test.ts`: 1012 + 5.
 *
 * Tránsitos honra `?segmento=momento` (CORE-240) suma 2 casos en `hoyPrincipal.test.ts`: 1017 + 2.
 *
 * Tránsitos con Plus como el frame (CORE-240, segunda parte) suma 2 casos en `hoyPrincipal.test.ts`: 1019 + 2.
 */
export const DEFAULT_MINIMUM = 1021;

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
