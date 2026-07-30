import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDebugStep } from "../src/domain/onboardingDebug";

const TOTAL = 15;

// `?debugStep=N` era un control de desarrollo servido en producción: cualquiera
// podía forzar el onboarding a un paso arbitrario desde la barra de
// direcciones. Misma clase de agujero que `?live=1`.

test("con las herramientas internas APAGADAS el param se ignora", () => {
  for (const raw of ["0", "7", "14"]) {
    assert.equal(
      resolveDebugStep({ raw, total: TOTAL, internalToolsEnabled: false }),
      null,
      `debugStep=${raw} no puede saltar pasos en producción`
    );
  }
});

test("con las herramientas internas ENCENDIDAS sí salta", () => {
  assert.equal(resolveDebugStep({ raw: "0", total: TOTAL, internalToolsEnabled: true }), 0);
  assert.equal(resolveDebugStep({ raw: "7", total: TOTAL, internalToolsEnabled: true }), 7);
  assert.equal(resolveDebugStep({ raw: "14", total: TOTAL, internalToolsEnabled: true }), 14);
});

test("un paso fuera de rango o mal formado no se honra ni con las herramientas encendidas", () => {
  for (const raw of ["15", "-1", "1.5", "", "  ", "abc", null, undefined, 7]) {
    assert.equal(
      resolveDebugStep({ raw, total: TOTAL, internalToolsEnabled: true }),
      null,
      `valor inesperado: ${JSON.stringify(raw)}`
    );
  }
});

test("un array de params toma el primer valor", () => {
  assert.equal(resolveDebugStep({ raw: ["3", "9"], total: TOTAL, internalToolsEnabled: true }), 3);
  assert.equal(resolveDebugStep({ raw: ["3"], total: TOTAL, internalToolsEnabled: false }), null);
});

// --- Cableado ---------------------------------------------------------------

const ROOT = join(import.meta.dirname, "..");

test("el flujo canónico no lee debugStep sin pasar por la guarda", () => {
  const flow = readFileSync(join(ROOT, "src/onboarding/OnboardingFlow.tsx"), "utf8");
  assert.ok(/resolveDebugStep/.test(flow), "debe resolverse por la función con guarda");
  assert.ok(/INTERNAL_TOOLS_ENABLED/.test(flow), "la guarda necesita el flag");
  assert.ok(
    !/Number\(params\.debugStep\)/.test(flow),
    "volvió la lectura directa del param, sin guarda"
  );
});

test("`resume` sigue siendo una intención real, sin guarda", () => {
  // `nuevo=1` quedó obsoleto: el alta salió del onboarding y tiene ruta propia.
  const flow = readFileSync(join(ROOT, "src/onboarding/OnboardingFlow.tsx"), "utf8");
  assert.ok(/params\.resume === "datos"/.test(flow));
  assert.ok(!/params\.nuevo/.test(flow), "el param obsoleto no puede seguir cableado");
});

test("las herramientas internas siguen apagadas por defecto", () => {
  const s = readFileSync(join(ROOT, "src/services/internalTools.ts"), "utf8");
  assert.match(
    s,
    /EXPO_PUBLIC_ORBITA_INTERNAL_TOOLS === "true"/,
    "un deploy que olvida la variable tiene que quedar cerrado"
  );
});
