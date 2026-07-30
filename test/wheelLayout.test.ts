import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { mapNatalChart } from "../src/domain/natalChart";
import {
  aspectIsActive,
  buildWheelLayout,
  selectedLabel,
  wheelPoint,
  WHEEL_CENTER,
  WHEEL_R_PLANET
} from "../src/domain/wheelLayout";
import { wheelAngle } from "../src/components/orbita/wheelGeometry";

const ROOT = join(import.meta.dirname, "..");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const WHEEL = readFileSync(join(ROOT, "src/components/orbita/NatalWheel.tsx"), "utf8");

/**
 * Payload COMPLETO con la forma real de `charts.current` (AstrologyAPI):
 * placements con `fullDegree`, casas con `degree`, aspectos por `key`, y el
 * resumen con `mainAspects`. Asc en Libra (185°).
 */
const DOC = {
  payload: {
    calculationTimeSource: "birth_time",
    placements: [
      { key: "sun", label: "Sol", sign: "aries", signEs: "Aries", degree: 22, fullDegree: 22, house: 7, isRetrograde: false },
      { key: "moon", label: "Luna", sign: "taurus", signEs: "Tauro", degree: 3, fullDegree: 33, house: 8, isRetrograde: false },
      { key: "mercury", label: "Mercurio", sign: "aries", signEs: "Aries", degree: 26, fullDegree: 26, house: 7, isRetrograde: true },
      { key: "venus", label: "Venus", sign: "leo", signEs: "Leo", degree: 8, fullDegree: 128, house: 11, isRetrograde: false },
      { key: "saturn", label: "Saturno", sign: "pisces", signEs: "Piscis", degree: 12, fullDegree: 342, house: 6, isRetrograde: false },
      { key: "ascendant", label: "Ascendente", sign: "libra", signEs: "Libra", degree: 5, fullDegree: 185, house: 1, isRetrograde: null }
    ],
    houses: Array.from({ length: 12 }, (_, i) => ({
      house: i + 1,
      sign: "libra",
      signEs: "Libra",
      degree: (185 + i * 30) % 360,
      theme: `área ${i + 1}`
    })),
    aspects: [
      { from: "sun", to: "moon", type: "square", typeEs: "cuadratura", orb: 1.2, isMajor: true },
      { from: "venus", to: "saturn", type: "trine", typeEs: "trígono", orb: 2.4, isMajor: true },
      { from: "mercury", to: "venus", type: "sextile", typeEs: "sextil", orb: 4.1, isMajor: false }
    ],
    summary: {
      mainAspects: [
        { from: "sun", to: "moon", type: "square", typeEs: "cuadratura", orb: 1.2, isMajor: true },
        { from: "venus", to: "saturn", type: "trine", typeEs: "trígono", orb: 2.4, isMajor: true }
      ],
      limitations: []
    }
  }
};

// --- Un payload completo conserva casas, planetas y aspectos ----------------

test("mapNatalChart conserva casas, posiciones y aspectos del payload completo", () => {
  const payload = mapNatalChart(DOC);
  assert.equal(payload.houses.length, 12);
  assert.deepEqual(
    payload.houses.map((h) => h.house),
    Array.from({ length: 12 }, (_, i) => i + 1)
  );
  assert.equal(payload.houses[0].cusp, 185);
  assert.equal(payload.placements.length, 6, "los seis puntos, incluido el Asc");
  assert.equal(payload.aspects.length, 3, "los aspectos se traducen a nombres visibles");
  assert.deepEqual(payload.mainAspects?.map((a) => `${a.from}/${a.to}`), ["Sol/Luna", "Venus/Saturno"]);
  assert.equal(payload.ascendantDegree, 185);
  assert.equal(payload.mc, (185 + 9 * 30) % 360);
  assert.equal(payload.triad.sun.sign, "Aries");
  assert.equal(payload.triad.ascendant.sign, "Libra");
  assert.match(payload.accuracy, /Hora exacta/);
});

test("la rueda dibuja TODO lo que trae el payload completo", () => {
  const layout = buildWheelLayout(mapNatalChart(DOC));
  assert.equal(layout.signs.length, 12, "los doce sectores del zodíaco");
  assert.equal(layout.houses.length, 12, "las doce cúspides reales");
  // Cinco planetas: el Ascendente es un EJE, no un punto de la banda.
  assert.deepEqual(layout.planets.map((p) => p.key).sort(), ["mercury", "moon", "saturn", "sun", "venus"]);
  assert.ok(!layout.planets.some((p) => p.key === "ascendant"), "el Asc no se dibuja como planeta");
  assert.equal(layout.aspects.length, 2, "las cuerdas de los aspectos principales");
  assert.deepEqual(
    layout.houses.filter((h) => h.angular).map((h) => h.house),
    [1, 4, 7, 10]
  );
  assert.deepEqual(layout.houses.slice(0, 4).map((h) => h.numeral), ["I", "II", "III", "IV"]);
  assert.equal(layout.planets.find((p) => p.key === "mercury")?.retrograde, true);
});

test("una casa sin cúspide no se inventa", () => {
  const doc = structuredClone(DOC);
  doc.payload.houses[4].degree = null as unknown as number;
  const layout = buildWheelLayout(mapNatalChart(doc));
  assert.equal(layout.houses.length, 11);
  assert.ok(!layout.houses.some((h) => h.house === 5));
});

// --- Rotación al Ascendente -------------------------------------------------

test("la rueda rota al Ascendente: Asc izquierda, MC arriba, DSC derecha, IC abajo", () => {
  const layout = buildWheelLayout(mapNatalChart(DOC));
  assert.equal(layout.hasAscendant, true);
  assert.equal(layout.anchor, 185);
  const byHouse = (n: number) => layout.houses.find((h) => h.house === n)!.deg;
  assert.equal(byHouse(1), 180);
  assert.equal(byHouse(10), 90);
  assert.equal(byHouse(7), 0);
  assert.equal(byHouse(4), 270);
});

test("cada planeta cae en el arco de su signo real", () => {
  const layout = buildWheelLayout(mapNatalChart(DOC));
  const venus = layout.planets.find((p) => p.key === "venus")!;
  // Venus a 128° (8° de Leo, 120–150) con Asc en 185.
  assert.equal(venus.deg, wheelAngle(185, 128));
  const leo = layout.signs[4];
  assert.equal(leo.code, "LEO");
  const lo = Math.min(leo.boundaryDeg, wheelAngle(185, 150));
  const hi = Math.max(leo.boundaryDeg, wheelAngle(185, 150));
  assert.ok(venus.deg >= lo && venus.deg <= hi, `Venus ${venus.deg} fuera del arco de Leo`);
});

test("sin hora natal no hay Ascendente ni casas, y la banda se atenúa", () => {
  const doc = structuredClone(DOC) as Record<string, any>;
  doc.payload.calculationTimeSource = "noon_fallback";
  const payload = mapNatalChart(doc);
  assert.equal(payload.ascendantDegree, undefined);
  assert.match(payload.accuracy, /Hora aproximada/);
  const layout = buildWheelLayout(payload);
  assert.equal(layout.hasAscendant, false);
  assert.equal(layout.houses.length, 0, "sin Asc las cúspides no son fiables");
  assert.equal(layout.anchor, 0, "el zodíaco cae a Aries 0 como ancla neutra");
  assert.ok(layout.planets.length > 0, "los planetas siguen teniendo longitud real");
  assert.ok(!layout.planets.some((p) => p.key === "ascendant"));
});

// --- De-colisión y selección ------------------------------------------------

test("dos planetas pegados no se pisan: el segundo entra un anillo", () => {
  const layout = buildWheelLayout(mapNatalChart(DOC));
  const sol = layout.planets.find((p) => p.key === "sun")!;
  const mercurio = layout.planets.find((p) => p.key === "mercury")!;
  // 22° y 26° = 4° de separación (<8).
  assert.notEqual(sol.radius, mercurio.radius);
  assert.equal(Math.max(sol.radius, mercurio.radius), WHEEL_R_PLANET);
});

test("el planeta seleccionado resalta sólo sus aspectos", () => {
  const layout = buildWheelLayout(mapNatalChart(DOC));
  assert.equal(selectedLabel(layout, undefined), undefined);
  assert.equal(selectedLabel(layout, "sun"), "Sol");
  const [solLuna, venusSaturno] = layout.aspects;
  // Sin selección se resaltan todas.
  assert.equal(aspectIsActive(solLuna, undefined), true);
  assert.equal(aspectIsActive(venusSaturno, undefined), true);
  const sel = selectedLabel(layout, "sun");
  assert.equal(aspectIsActive(solLuna, sel), true);
  assert.equal(aspectIsActive(venusSaturno, sel), false);
});

test("un aspecto contra un punto que la rueda no dibuja no se cuelga", () => {
  const doc = structuredClone(DOC);
  doc.payload.summary.mainAspects.push({
    from: "sun",
    to: "ascendant",
    type: "opposition",
    typeEs: "oposición",
    orb: 0.5,
    isMajor: true
  });
  const layout = buildWheelLayout(mapNatalChart(doc));
  assert.equal(layout.aspects.length, 2, "el aspecto al eje no produce cuerda");
});

test("un payload vacío no rompe la geometría", () => {
  const layout = buildWheelLayout(mapNatalChart({}));
  assert.equal(layout.planets.length, 0);
  assert.equal(layout.houses.length, 0);
  assert.equal(layout.aspects.length, 0);
  assert.equal(layout.signs.length, 12);
});

test("wheelPoint respeta la orientación matemática sobre el viewBox", () => {
  const [x, y] = wheelPoint(100, 90);
  assert.ok(Math.abs(x - WHEEL_CENTER) < 1e-9);
  assert.equal(y, WHEEL_CENTER - 100, "90° es ARRIBA");
});

// --- El componente sólo dibuja ---------------------------------------------

test("NatalWheel no recalcula geometría: la toma del dominio", () => {
  const codigo = sinComentarios(WHEEL);
  assert.ok(/buildWheelLayout\(payload\)/.test(codigo));
  assert.ok(!/wheelAngle\(/.test(codigo), "la rotación vive en el dominio");
  assert.ok(!/arcBetween\(/.test(codigo), "la de-colisión vive en el dominio");
  assert.ok(!/Math\.PI/.test(codigo), "los puntos se piden a wheelPoint");
});
