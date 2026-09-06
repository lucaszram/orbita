/**
 * La action nueva de recuperación se consume por su referencia GENERADA.
 *
 * ## El defecto que cierran estas pruebas
 *
 * `charts.recoverNatalChart` es una superficie pública NUEVA. Estaba cerrada en
 * el backend —`args: {}` y un `returns` discriminado— y ya aparecía en
 * `convex/_generated/api.d.ts`. Pero el front la consumía por
 * `src/services/appRefs.ts`, que la enlazaba con `anyApi` y **repetía su firma a
 * mano**:
 *
 * ```ts
 * recoverNatalChart: anyApi.charts.recoverNatalChart as FunctionReference<
 *   "action", "public", Empty,
 *   { status: "recovered"; source: "stored" | "provider" } | …
 * >
 * ```
 *
 * Una firma escrita a mano no es un contrato: es una copia. Si el backend
 * cambiara el desenlace —otro `status`, otro `reason`— el cast seguiría
 * compilando y el error aparecería recién en runtime, sobre el botón de
 * recuperación de la Carta. El contrato V4.9.2 pide lo contrario: referencias
 * generadas, y ninguna superficie nueva basada en `anyApi`.
 *
 * Las superficies legacy de `appRefs` no se migran en esta tanda —son otro
 * objetivo—; lo que este gate cubre es específicamente la action nueva y su
 * consumidor real.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

import { getFunctionName } from "convex/server";

import { api } from "../convex/_generated/api";
import {
  chartsApi,
  type NatalRecoveryFailure,
  type NatalRecoveryOutcome,
  type NatalRecoverySource
} from "../src/services/chartsApi";
import { ROOT, reachableFrom } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SERVICIO = "src/services/chartsApi.ts";
const HOOK = "src/hooks/useNatalChartRecovery.ts";

// ---------------------------------------------------------------------------
// 1 · el servicio ES la referencia generada, sin intermediarios
// ---------------------------------------------------------------------------

test("el servicio reexporta la referencia generada, sin copiarla", () => {
  // Misma función del contrato generado, no una construcción paralela. Se
  // compara por el nombre canónico porque cada acceso al `api` generado devuelve
  // una referencia nueva.
  assert.equal(getFunctionName(chartsApi.recoverNatalChart), "charts:recoverNatalChart");
  assert.equal(
    getFunctionName(chartsApi.recoverNatalChart),
    getFunctionName(api.charts.recoverNatalChart)
  );

  const servicio = sinComentarios(leer(SERVICIO));
  assert.match(servicio, /import \{ api \} from "\.\.\/\.\.\/convex\/_generated\/api";/);
  assert.match(servicio, /recoverNatalChart: api\.charts\.recoverNatalChart/);
  // Nada de firma manual, nada de `anyApi`, nada de casts.
  assert.doesNotMatch(servicio, /anyApi/, "sin `anyApi`");
  assert.doesNotMatch(servicio, /FunctionReference</, "sin `FunctionReference` escrito a mano");
  assert.doesNotMatch(servicio, /\bas any\b/, "sin casts");
  assert.doesNotMatch(servicio, /:\s*any\b/, "sin `any`");
});

// ---------------------------------------------------------------------------
// 2 · nadie en `src/` vuelve a declararla a mano
// ---------------------------------------------------------------------------

function archivosDe(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completo = join(dir, entrada);
    if (statSync(completo).isDirectory()) {
      salida.push(...archivosDe(completo));
    } else if (/\.(ts|tsx)$/.test(entrada)) {
      salida.push(completo);
    }
  }
  return salida;
}

test("ningún archivo del front declara `recoverNatalChart` a mano", () => {
  const ofensas: string[] = [];
  for (const archivo of [...archivosDe(join(ROOT, "src")), ...archivosDe(join(ROOT, "app"))]) {
    const rel = relative(ROOT, archivo);
    const fuente = sinComentarios(readFileSync(archivo, "utf8"));
    if (!fuente.includes("recoverNatalChart")) continue;
    // La única forma legítima: la referencia generada, o el servicio que la
    // reexporta.
    for (const [patron, motivo] of [
      [/anyApi[^\n]*recoverNatalChart/, "enlazada por `anyApi`"],
      [/recoverNatalChart[^\n]*anyApi/, "enlazada por `anyApi`"],
      [/recoverNatalChart[\s\S]{0,80}?as FunctionReference/, "casteada a `FunctionReference`"],
      [/recoverNatalChart[\s\S]{0,80}?\bas any\b/, "casteada a `any`"]
    ] as const) {
      if (patron.test(fuente)) ofensas.push(`${rel}: ${motivo}`);
    }
  }
  assert.deepEqual(ofensas, [], "una superficie nueva no puede nacer con una firma escrita a mano");
});

test("`appRefs` ya no la declara, y el hook la consume por el servicio generado", () => {
  const appRefs = sinComentarios(leer("src/services/appRefs.ts"));
  assert.doesNotMatch(appRefs, /recoverNatalChart/, "salió de la sección manual");
  // Y las superficies legacy siguen ahí: este pase no las migra.
  assert.match(appRefs, /calculateOrCreateNatalChart: anyApi\.charts\.calculateOrCreateNatalChart/);

  const hook = sinComentarios(leer(HOOK));
  assert.match(hook, /import \{ chartsApi \} from "@\/services\/chartsApi";/);
  assert.match(hook, /useAction\(chartsApi\.recoverNatalChart\)/);
  assert.doesNotMatch(hook, /appApi/, "el hook ya no depende de la capa de firmas manuales");
});

test("las dos rutas de Carta llegan al servicio generado por el grafo real", () => {
  for (const entry of ["app/(tabs)/perfil/index.tsx", "app/(tabs)/perfil/carta/completa.tsx"]) {
    const grafo = reachableFrom([entry], "native");
    assert.ok(grafo.has(SERVICIO), `${entry} no llega a ${SERVICIO}`);
  }
});

// ---------------------------------------------------------------------------
// 3 · el typecheck es el que ata el contrato
//
// Estas comprobaciones son de TIPOS: si el backend cambiara el `returns` de la
// action —otro `status`, otro `source`, otro `reason`— `pnpm typecheck` falla
// acá y en el consumidor. Con la firma escrita a mano no fallaba en ningún lado.
// ---------------------------------------------------------------------------

/** Las dos procedencias del éxito, derivadas del contrato y no escritas a mano. */
const FUENTES: NatalRecoverySource[] = ["stored", "provider"];
/** Los dos motivos del fallo, ídem. */
const MOTIVOS: NatalRecoveryFailure[] = ["provider_failed", "still_incomplete"];

/** `true` sólo si el desenlace sigue siendo exactamente esas dos ramas. */
type SoloDosRamas = NatalRecoveryOutcome extends { status: "recovered" } | { status: "failed" }
  ? true
  : false;
const dosRamas: SoloDosRamas = true;

/** `true` sólo si la action sigue sin argumentos. */
type SinArgumentos = keyof (typeof chartsApi)["recoverNatalChart"]["_args"] extends never ? true : false;
const sinArgumentos: SinArgumentos = true;

test("el desenlace que el front consume ES el del contrato generado", () => {
  assert.deepEqual(FUENTES, ["stored", "provider"]);
  assert.deepEqual(MOTIVOS, ["provider_failed", "still_incomplete"]);
  assert.equal(dosRamas, true, "el desenlace sigue teniendo exactamente dos ramas");
  assert.equal(sinArgumentos, true, "y la action sigue sin argumentos");

  // Y el discriminante se estrecha de verdad: esto sólo compila si el contrato
  // lo declara cerrado.
  const recuperado: NatalRecoveryOutcome = { status: "recovered", source: "stored" };
  const fallido: NatalRecoveryOutcome = { status: "failed", reason: "still_incomplete" };
  assert.equal(recuperado.status === "recovered" ? recuperado.source : null, "stored");
  assert.equal(fallido.status === "failed" ? fallido.reason : null, "still_incomplete");
});
