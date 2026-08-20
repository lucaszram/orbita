/**
 * Reafirmar la identidad natal NO puede tocar `updatedAt` si nada cambió.
 *
 * ## El defecto, visto en iPhone físico (2026-08-19, 22:23)
 *
 * `persistCalculatedNatalChart`, en la rama `reuse_existing`, patcheaba la fila
 * con `{ ...identidadVigente, updatedAt: now }` en CADA corrida — aunque la
 * identidad ya fuera exactamente la vigente. El ciclo de capas reusa la carta
 * en cada refresh (volver al frente, cambio de pestaña, reintento), así que la
 * carta "cambiaba" varias veces por minuto sin cambiar.
 *
 * La comparación de Vínculos incluye `natalChartUpdatedAt` en su `inputHash` y
 * tarda segundos (posiciones de la otra persona, con proveedor). Si un refresh
 * de capas terminaba en el medio, `persistComparisonRefresh` releía el estado,
 * veía otro timestamp y tiraba `RELATIONSHIP_INPUT_CHANGED_DURING_REFRESH`. En
 * un teléfono con la app viva, esa ventana está casi siempre abierta: la
 * comparación de una persona recién creada no lograba persistir NUNCA.
 *
 * ## La regla
 *
 * La reafirmación existe para corregir una identidad DESACTUALIZADA (fila natal
 * regrabada, migración). Si la identidad ya es la vigente, la corrida es un
 * no-op de verdad: cero escrituras, cero `updatedAt`. Un refresh que no cambió
 * nada no puede contar como "la carta cambió".
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { ROOT } from "./moduleGraph";

const charts = readFileSync(join(ROOT, "convex/charts.ts"), "utf8");
// El bloque de reafirmación vive en `applyCalculatedNatalChart`, el cuerpo
// compartido que la mutation envuelve.
const persist = charts.slice(
  charts.indexOf("export async function applyCalculatedNatalChart"),
  charts.indexOf("export async function runNatalChartCalculation")
);

describe("reafirmación natal — no-op cuando la identidad ya es la vigente", () => {
  it("la rama de reutilización compara la identidad antes de escribir", () => {
    assert.match(
      persist,
      /identidadYaVigente/,
      "existe la comparación explícita contra la fila guardada"
    );
    assert.match(
      persist,
      /if \(!identidadYaVigente\) \{\s*await ctx\.db\.patch\(existingChart\._id, \{ \.\.\.identidadVigente, updatedAt: now \}\);/s,
      "el patch de reafirmación sólo corre si la identidad difiere"
    );
  });

  it("hay exactamente UN patch de reafirmación, y es el del guard", () => {
    // La prueba anterior fija que ese único patch vive detrás de
    // `if (!identidadYaVigente)`. Ésta impide que aparezca una segunda copia
    // sin guard: el patch a secas es el bug — cada refresh tocaba updatedAt.
    const patches = persist.split("{ ...identidadVigente, updatedAt: now }").length - 1;
    assert.equal(patches, 1, "una sola reafirmación, la guardada");
  });
});
