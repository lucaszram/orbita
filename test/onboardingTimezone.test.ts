import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  pickTimezoneCandidate,
  timezoneResolutionKey,
  timezoneRetryDelayMs
} from "../convex/lib/onboardingTimezone";

const ROOT = join(import.meta.dirname, "..");

test("elige el timezone del resultado más cercano a las coordenadas guardadas", () => {
  assert.equal(
    pickTimezoneCandidate(
      [
        { timezone: "America/Argentina/Buenos_Aires", latitude: -34.6, longitude: -58.4 },
        { timezone: "America/Chicago", latitude: 41.5868, longitude: -93.6249 }
      ],
      41.5869,
      -93.625
    ),
    "America/Chicago"
  );
});

test("ignora resultados sin timezone y no inventa un fallback", () => {
  assert.equal(pickTimezoneCandidate([{ latitude: -34.6, longitude: -58.4 }], -34.6, -58.4), null);
  assert.equal(pickTimezoneCandidate([], -34.6, -58.4), null);
});

test("el backoff crece y queda acotado", () => {
  const delays = Array.from({ length: 12 }, (_, attempt) => timezoneRetryDelayMs(attempt));
  for (let i = 1; i < delays.length; i += 1) assert.ok(delays[i] >= delays[i - 1]);
  assert.equal(delays.at(-1), 12 * 60 * 60_000);
});

test("el mismo lugar produce el mismo claim y otro lugar uno distinto", () => {
  const a = timezoneResolutionKey("Rosario, Argentina", -32.95, -60.65);
  assert.equal(a, timezoneResolutionKey("Rosario, Argentina", -32.95, -60.65));
  assert.notEqual(a, timezoneResolutionKey("Córdoba, Argentina", -31.42, -64.19));
});

test("saveDraft guarda primero y recién después agenda el enriquecimiento", () => {
  const source = readFileSync(join(ROOT, "convex/onboarding.ts"), "utf8");
  const block = source.slice(source.indexOf("export const saveDraft"), source.indexOf("export const getDraftForTimezoneResolution"));
  const write = Math.max(block.indexOf("ctx.db.patch"), block.indexOf('ctx.db.insert("onboardingDrafts"'));
  const schedule = block.indexOf("ctx.scheduler.runAfter");
  assert.ok(write >= 0 && schedule > write, "persistir antes de depender del proveedor");
  assert.ok(!/deviceTimezone|America\/Argentina\/Buenos_Aires/.test(block), "no usar la zona del dispositivo");
});

test("una respuesta vieja no puede pisar un lugar nuevo", () => {
  const source = readFileSync(join(ROOT, "convex/onboarding.ts"), "utf8");
  const block = source.slice(source.indexOf("export const applyResolvedDraftTimezone"), source.indexOf("export const resolveDraftTimezone"));
  for (const field of ["birthPlaceLabel", "latitude", "longitude"]) {
    assert.match(block, new RegExp(`draft\\.${field} !== args\\.${field}`));
  }
});

test("cambiar de lugar invalida la zona anterior antes de programar la nueva", () => {
  const source = readFileSync(join(ROOT, "convex/onboarding.ts"), "utf8");
  const block = source.slice(source.indexOf("export const saveDraft"), source.indexOf("export const getDraftForTimezoneResolution"));
  assert.match(block, /const placeChanged = Boolean/);
  assert.match(block, /placeChanged && args\.timezone === undefined/);
  assert.match(block, /\.\.\.resolutionClaimPatch, timezone: undefined/);
  assert.match(block, /args\.timezone \?\? \(placeChanged \? undefined : existing\?\.timezone\)/);
  assert.match(block, /args\.latitude \?\? \(labelChanged \? undefined : existing\?\.latitude\)/);
  assert.match(block, /latitude: args\.latitude/);
});

test("los autoguardados deduplican el worker y una cadena agotada libera el claim", () => {
  const source = readFileSync(join(ROOT, "convex/onboarding.ts"), "utf8");
  const save = source.slice(source.indexOf("export const saveDraft"), source.indexOf("export const getDraftForTimezoneResolution"));
  assert.match(save, /existing\?\.timezoneResolutionKey !== resolutionKey/);
  assert.match(save, /if \(shouldSchedule && resolutionKey\)/);

  const worker = source.slice(source.indexOf("export const resolveDraftTimezone"));
  assert.match(worker, /draft\.timezoneResolutionKey !== args\.resolutionKey/);
  assert.match(worker, /releaseDraftTimezoneResolution/);
  assert.match(worker, /try \{/);
  assert.match(worker, /catch \{/);
  assert.match(worker, /timezoneRetryDelayMs/);
});
