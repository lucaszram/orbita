import assert from "node:assert/strict";
import { test } from "node:test";

import { arcBetween, wheelAngle } from "../src/components/orbita/wheelGeometry";

test("wheelAngle: el Ascendente cae a la izquierda (180°)", () => {
  assert.equal(wheelAngle(0, 0), 180);
  assert.equal(wheelAngle(185, 185), 180);
});

test("wheelAngle: MC arriba (90), IC abajo (270), DSC derecha (0)", () => {
  // MC = asc + 270 → 90 (arriba); IC = asc + 90 → 270 (abajo); DSC = asc + 180 → 0 (derecha)
  assert.equal(wheelAngle(0, 270), 90);
  assert.equal(wheelAngle(0, 90), 270);
  assert.equal(wheelAngle(0, 180), 0);
  // con Asc real (185): MC en 95, IC en 275, DSC en 5
  assert.equal(wheelAngle(185, 95), 90);
  assert.equal(wheelAngle(185, 275), 270);
  assert.equal(wheelAngle(185, 5), 0);
});

test("wheelAngle: un planeta cae dentro del arco de su signo real", () => {
  // Asc en Libra (185°). Un planeta en Leo (120–150°) debe caer en el arco de Leo.
  const ascLon = 185;
  const leoStart = wheelAngle(ascLon, 120);
  const leoEnd = wheelAngle(ascLon, 150);
  const planet = wheelAngle(ascLon, 128); // 8° Leo
  const lo = Math.min(leoStart, leoEnd);
  const hi = Math.max(leoStart, leoEnd);
  assert.ok(planet >= lo && planet <= hi, `planeta ${planet} fuera del arco Leo [${lo}, ${hi}]`);
});

test("arcBetween: distancia angular mínima", () => {
  assert.equal(arcBetween(10, 350), 20);
  assert.equal(arcBetween(0, 180), 180);
  assert.equal(arcBetween(90, 90), 0);
});
