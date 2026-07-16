import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveGuideReadKey } from "../src/services/dailyGuideStore";

/**
 * Aislamiento de sesión del caché de la guía diaria (review Codex PR #8):
 * `userKey=null` es ambiguo (reconexión O signed-out); la retención de la
 * última clave solo vale durante carga/reconexión (`holdLastKey`).
 */

const A = "user_A:2026-07-16";
const B = "user_B:2026-07-16";

/** Simula la secuencia de renders del hook: cada paso alimenta el lastKey siguiente. */
function play(steps: Array<{ currentKey: string | null; holdLastKey: boolean }>) {
  let lastKey: string | null = null;
  const reads: Array<string | null> = [];
  for (const step of steps) {
    const r = resolveGuideReadKey({ ...step, lastKey });
    lastKey = r.nextLastKey;
    reads.push(r.readKey);
  }
  return { reads, lastKey };
}

describe("resolveGuideReadKey — retención del caché por estado de sesión", () => {
  it("sesión live: lee y retiene la clave de la cuenta", () => {
    const { reads } = play([{ currentKey: A, holdLastKey: false }]);
    assert.deepEqual(reads, [A]);
  });

  it("reconexión transitoria: sigue leyendo la última clave (no degrada a 'cargando')", () => {
    const { reads } = play([
      { currentKey: A, holdLastKey: false },
      { currentKey: null, holdLastKey: true },
      { currentKey: null, holdLastKey: true },
      { currentKey: A, holdLastKey: false }
    ]);
    assert.deepEqual(reads, [A, A, A, A]);
  });

  it("ready(A) → signed-out CONFIRMADO: suelta la clave; el payload de A no se renderiza en guest", () => {
    const { reads, lastKey } = play([
      { currentKey: A, holdLastKey: false },
      // Logout: Clerk resuelto sin sesión → holdLastKey=false y sin clave actual.
      { currentKey: null, holdLastKey: false }
    ]);
    assert.deepEqual(reads, [A, null]);
    assert.equal(lastKey, null);
  });

  it("después del signed-out, una reconexión posterior NO resucita la cuenta anterior", () => {
    const { reads } = play([
      { currentKey: A, holdLastKey: false },
      { currentKey: null, holdLastKey: false },
      // Parpadeo de auth más tarde (p. ej. entrada abierta): no hay nada retenido.
      { currentKey: null, holdLastKey: true }
    ]);
    assert.deepEqual(reads, [A, null, null]);
  });

  it("cambio de cuenta A → B: lee B de entrada, nunca la clave de A", () => {
    const { reads } = play([
      { currentKey: A, holdLastKey: false },
      { currentKey: null, holdLastKey: false },
      // Login de B: mientras el handshake carga no hay clave retenida de A…
      { currentKey: null, holdLastKey: true },
      // …y al confirmarse B, se lee y retiene B.
      { currentKey: B, holdLastKey: false }
    ]);
    assert.deepEqual(reads, [A, null, null, B]);
  });

  it("con clave actual la retención es irrelevante (siempre gana la sesión viva)", () => {
    const { reads } = play([
      { currentKey: A, holdLastKey: false },
      { currentKey: B, holdLastKey: true }
    ]);
    assert.deepEqual(reads, [A, B]);
  });
});
