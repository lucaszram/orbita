import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { timezoneAtCoordinates } from "../convex/lib/placeTimezone";

test("resuelve ciudades reales a zonas IANA sin red", () => {
  assert.equal(timezoneAtCoordinates(-34.6037, -58.3816), "America/Argentina/Buenos_Aires");
  assert.equal(timezoneAtCoordinates(40.4168, -3.7038), "Europe/Madrid");
  assert.equal(timezoneAtCoordinates(35.6762, 139.6503), "Asia/Tokyo");
});

test("rechaza coordenadas inválidas en vez de inventar una zona", () => {
  for (const [latitude, longitude] of [
    [91, 0],
    [0, 181],
    [Number.NaN, 0]
  ]) {
    assert.throws(
      () => timezoneAtCoordinates(latitude, longitude),
      /TIMEZONE_COORDINATES_INVALID/
    );
  }
});

test("geo-tz queda externo al bundle de Convex", () => {
  const config = JSON.parse(
    readFileSync(join(import.meta.dirname, "..", "convex.json"), "utf8")
  ) as { node?: { externalPackages?: string[] } };
  const helper = readFileSync(
    join(import.meta.dirname, "..", "convex", "lib", "placeTimezone.ts"),
    "utf8"
  );

  assert.deepEqual(config.node?.externalPackages, ["geo-tz"]);
  assert.match(helper, /^"use node";/);
});
