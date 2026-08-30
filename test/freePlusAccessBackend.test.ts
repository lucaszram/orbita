import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { relationshipCanCreate } from "../convex/relationships";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

test("el cupo Free es simultáneo y Plus no tiene límite", () => {
  assert.equal(relationshipCanCreate(false, 0), true);
  assert.equal(relationshipCanCreate(false, 1), false);
  assert.equal(relationshipCanCreate(false, 4), false);
  assert.equal(relationshipCanCreate(true, 0), true);
  assert.equal(relationshipCanCreate(true, 4), true);
});

test("la API protegida de Vínculos es aditiva y resuelve idempotencia antes del cupo", () => {
  const source = read("convex/relationships.ts");
  for (const endpoint of ["listWithAccess", "savePersonWithAccess"]) {
    assert.match(source, new RegExp(`export const ${endpoint} =`));
  }
  const save = source.slice(
    source.indexOf("async function savePersonForPlan"),
    source.indexOf("export const savePerson ="),
  );
  assert.ok(
    save.indexOf("existingRequest") < save.indexOf("RELATIONSHIP_PLUS_REQUIRED"),
    "un reintento confirmado debe devolverse antes de evaluar el cupo",
  );
  assert.match(save, /if \(profileId\)[\s\S]*ctx\.db\.patch\(profileId, values\)/);
  assert.match(save, /withIndex\("by_user"[\s\S]*RELATIONSHIP_PLUS_REQUIRED/);
});

test("las capas protegidas cortan Free antes de calcular el cielo temporal", () => {
  const source = read("convex/layers.ts");
  for (const endpoint of [
    "getForDateWithAccess",
    "refreshForDateWithAccess",
    "getTransitArcWithAccess",
    "refreshTransitArcWithAccess",
  ]) {
    assert.match(source, new RegExp(`export const ${endpoint} =`));
  }
  const refresh = source.slice(
    source.indexOf("async function refreshForDateForPlan"),
    source.indexOf("export const refreshForDate ="),
  );
  assert.ok(
    refresh.indexOf("enforcePlan && !state.isPro") < refresh.indexOf("resolveDailySky"),
    "Free debe salir antes de pedir el cielo del día",
  );
  const freeBranch = refresh.slice(
    refresh.indexOf("if (enforcePlan && !state.isPro)"),
    refresh.indexOf("const samples = natal.samples"),
  );
  assert.match(freeBranch, /natal\.bundle\.lunarType, natal\.bundle\.elementMap/);
  assert.doesNotMatch(freeBranch, /relationshipPattern|transitRanking|temporalMandala/);
  assert.match(source, /missingInputs:[\s\S]*orbita_plus|\["orbita_plus"\]/);
});

test("el contrato no agrega tablas ni campos persistidos para el cupo", () => {
  const schema = read("convex/schema.ts");
  assert.doesNotMatch(schema, /relationshipFree|freeSlot|slotUsed|cupoFree/i);
});
