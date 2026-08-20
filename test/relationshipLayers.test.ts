import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildOwnRelationshipPattern,
  buildRelationshipComparison,
  type RelationshipChartInput,
  type RelationshipPlacementInput
} from "../convex/lib/relationshipLayers";

const PLANETS: RelationshipPlacementInput[] = [
  { key: "sun", fullDegree: 0, sign: "Aries" },
  { key: "moon", fullDegree: 30, sign: "Tauro" },
  { key: "mercury", fullDegree: 60, sign: "Géminis" },
  { key: "venus", fullDegree: 90, sign: "Cáncer" },
  { key: "mars", fullDegree: 120, sign: "Leo" },
  { key: "jupiter", fullDegree: 150, sign: "Virgo" },
  { key: "saturn", fullDegree: 180, sign: "Libra" }
];

function houses(offset = 0) {
  return Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    degree: (offset + index * 30) % 360
  }));
}

function chart(
  name: string,
  overrides: Partial<RelationshipChartInput> = {}
): RelationshipChartInput {
  return {
    name,
    zodiacSign: "Aries",
    birthTimePrecision: "known",
    placements: structuredClone(PLANETS),
    houses: houses(),
    ...overrides
  };
}

test("el patrón propio usa Luna, Venus y Marte, pero nunca inventa casa 7 sin hora exacta", () => {
  const result = buildOwnRelationshipPattern({
    chart: chart("Ana", {
      birthTimePrecision: "unknown",
      placements: [
        { key: "moon", fullDegree: 29 },
        { key: "venus", fullDegree: 90 },
        { key: "mars", fullDegree: 120 }
      ],
      houses: houses()
    })
  });

  assert.equal(result.status, "partial");
  assert.equal(result.emotionalNeed, null, "una Luna de un único instante no representa el día entero");
  assert.equal(result.affectionStyle?.signs[0], "cancer");
  assert.equal(result.desireStyle?.signs[0], "leo");
  assert.equal(result.relationshipAxis, null, "las casas presentes no saltean el gate de hora");
  assert.match(result.limitations.join(" "), /punto opuesto al Ascendente.*casa 7/);
});

test("una Luna sin hora conserva el rango de signos en vez de elegir uno", () => {
  const result = buildOwnRelationshipPattern({
    chart: chart("Ana", {
      birthTimePrecision: "unknown",
      placements: [
        { key: "moon", longitudeSamples: [29, 31] },
        { key: "venus", fullDegree: 90 },
        { key: "mars", fullDegree: 120 }
      ],
      houses: []
    })
  });

  assert.deepEqual(result.emotionalNeed?.signs, ["aries", "taurus"]);
  assert.equal(result.emotionalNeed?.precision, "range");
  assert.match(result.emotionalNeed?.text ?? "", /conserva las dos posibilidades|dos posibilidades/);
  assert.equal(result.precision, "range");
});

test("con hora exacta y las doce casas agrega Descendente y planetas en casa 7", () => {
  const placements = structuredClone(PLANETS);
  placements.find((placement) => placement.key === "venus")!.house = 7;
  const result = buildOwnRelationshipPattern({ chart: chart("Ana", { placements }) });

  assert.equal(result.status, "ready");
  assert.equal(result.precision, "exact");
  assert.equal(result.relationshipAxis?.descendantSign, "libra");
  assert.deepEqual(result.relationshipAxis?.house7Planets, [{ key: "venus", label: "Venus" }]);
});

test("nivel 1 es signo contra signo general y no finge dimensiones personalizadas", () => {
  const result = buildRelationshipComparison({
    requestedLevel: 1,
    personA: { name: "Ana", zodiacSign: "Escorpio", birthTimePrecision: "unknown" },
    personB: { name: "Beto", zodiacSign: "Tauro", birthTimePrecision: "unknown" }
  });

  assert.equal(result.level, 1);
  assert.deepEqual(result.dimensions, []);
  assert.match(result.generalStyle.disclaimer, /estilos solares generales/);
  assert.match(result.generalStyle.body, /no implica incompatibilidad|lenguaje conocido|sin garantizar acuerdo/);
  assert.equal("score" in result, false);
});

test("nivel 2 elimina casas, Ascendente y Descendente aunque la entrada los traiga", () => {
  const result = buildRelationshipComparison({
    requestedLevel: 2,
    personA: chart("Ana"),
    personB: chart("Beto")
  });

  assert.equal(result.level, 2);
  const drivers = result.dimensions.flatMap((dimension) => dimension.drivers);
  assert.ok(drivers.length > 0);
  assert.equal(drivers.some((driver) => driver.kind === "house_overlay"), false);
  assert.equal(
    drivers.some((driver) => [driver.source.point, driver.target?.point].some((key) => key === "ascendant" || key === "descendant")),
    false
  );
  assert.match(result.limitations.join(" "), /no usamos Ascendentes ni casas.*planetas de una persona/);
});

test("nivel 2 sólo usa un contacto lunar si el aspecto se mantiene en todo el rango", () => {
  const unstableA = chart("Ana", {
    birthTimePrecision: "unknown",
    placements: [
      ...PLANETS.filter((placement) => placement.key !== "moon"),
      { key: "moon", fullDegree: 10, longitudeSamples: [0, 20] }
    ],
    houses: []
  });
  const b = chart("Beto", {
    birthTimePrecision: "unknown",
    placements: PLANETS.map((placement) =>
      placement.key === "venus" ? { ...placement, fullDegree: 0 } : placement
    ),
    houses: []
  });
  const unstable = buildRelationshipComparison({ requestedLevel: 2, personA: unstableA, personB: b });
  assert.equal(
    unstable.dimensions.flatMap((dimension) => dimension.drivers).some((driver) => driver.source.point === "moon"),
    false
  );
  assert.match(unstable.limitations.join(" "), /contactos de la Luna.*cambiar según la hora/);

  const stableA = chart("Ana", {
    birthTimePrecision: "unknown",
    placements: [
      ...PLANETS.filter((placement) => placement.key !== "moon"),
      { key: "moon", fullDegree: 0.5, longitudeSamples: [0, 1] }
    ],
    houses: []
  });
  const stableB = chart("Beto", {
    birthTimePrecision: "unknown",
    placements: PLANETS.map((placement) =>
      placement.key === "mercury" ? { ...placement, fullDegree: 120 } : placement
    ),
    houses: []
  });
  const stable = buildRelationshipComparison({ requestedLevel: 2, personA: stableA, personB: stableB });
  const lunarDriver = stable.dimensions
    .find((dimension) => dimension.id === "communication")
    ?.drivers.find((driver) => driver.source.point === "moon" && driver.target?.point === "mercury");
  assert.equal(lunarDriver?.aspect, "trine");
  assert.equal(lunarDriver?.precision, "range");
  assert.deepEqual(lunarDriver?.orbRange, [0, 1]);
});

test("nivel 2 omite también un aspecto planetario que cambia dentro del día civil", () => {
  const rangedA = chart("Ana", {
    birthTimePrecision: "unknown",
    placements: PLANETS.map((placement) =>
      placement.key === "mercury"
        ? { ...placement, fullDegree: 5, longitudeSamples: [0, 10] }
        : placement
    ),
    houses: []
  });
  const rangedB = chart("Beto", {
    birthTimePrecision: "unknown",
    placements: PLANETS.map((placement) =>
      placement.key === "mercury" ? { ...placement, fullDegree: 60, longitudeSamples: [60, 60.5] } : placement
    ),
    houses: []
  });

  const result = buildRelationshipComparison({ requestedLevel: 2, personA: rangedA, personB: rangedB });
  const communication = result.dimensions.find((dimension) => dimension.id === "communication")!;
  assert.equal(
    communication.drivers.some(
      (driver) => driver.source.point === "mercury" && driver.target?.point === "mercury"
    ),
    false
  );
  assert.match(result.limitations.join(" "), /contactos entre planetas.*cambiar según la hora/);
});

test("las cinco dimensiones explican cada contacto y su distancia al punto más preciso", () => {
  const result = buildRelationshipComparison({ requestedLevel: 2, personA: chart("Ana"), personB: chart("Beto") });

  assert.deepEqual(result.dimensions.map((dimension) => dimension.id), [
    "communication",
    "care",
    "desire",
    "friction",
    "shared_project"
  ]);
  for (const dimension of result.dimensions) {
    assert.equal(dimension.status, "available", dimension.id);
    assert.ok(dimension.weight > 0, dimension.id);
    assert.ok(dimension.drivers.length > 0, dimension.id);
    for (const driver of dimension.drivers) {
      assert.ok(driver.strength >= 0 && driver.strength <= 1);
      assert.match(driver.text, /máxima precisión|ubica ese planeta/);
    }
  }
  assert.equal("score" in result, false);
  assert.equal("totalScore" in result, false);
});

test("la fuerza baja cuando el aspecto se aleja del punto exacto", () => {
  const exact = buildRelationshipComparison({ requestedLevel: 2, personA: chart("Ana"), personB: chart("Beto") });
  const nearLimit = buildRelationshipComparison({
    requestedLevel: 2,
    personA: chart("Ana"),
    personB: chart("Beto", {
      placements: PLANETS.map((placement) =>
        placement.key === "mercury" ? { ...placement, fullDegree: 63.5 } : placement
      )
    })
  });
  const mercury = (result: ReturnType<typeof buildRelationshipComparison>) =>
    result.dimensions
      .find((dimension) => dimension.id === "communication")!
      .drivers.find((driver) => driver.source.point === "mercury" && driver.target?.point === "mercury")!;

  assert.equal(mercury(exact).strength, 1);
  assert.ok(mercury(nearLimit).strength < mercury(exact).strength);
});

test("nivel 3 habilita superposiciones; si falta precisión degrada a nivel 2", () => {
  const full = buildRelationshipComparison({
    requestedLevel: 3,
    personA: chart("Ana"),
    personB: chart("Beto")
  });
  assert.equal(full.level, 3);
  assert.ok(full.dimensions.flatMap((dimension) => dimension.drivers).some((driver) => driver.kind === "house_overlay"));

  const degraded = buildRelationshipComparison({
    requestedLevel: 3,
    personA: chart("Ana", { birthTimePrecision: "approximate", houses: houses() }),
    personB: chart("Beto")
  });
  assert.equal(degraded.level, 2);
  assert.equal(degraded.dimensions.flatMap((dimension) => dimension.drivers).some((driver) => driver.kind === "house_overlay"), false);
  assert.match(degraded.limitations.join(" "), /quedó en fecha contra fecha/);
});

test("el resultado es determinista aunque cambie el orden de placements y houses", () => {
  const normal = buildRelationshipComparison({ requestedLevel: 3, personA: chart("Ana"), personB: chart("Beto") });
  const shuffled = buildRelationshipComparison({
    requestedLevel: 3,
    personA: chart("Ana", { placements: [...PLANETS].reverse(), houses: [...houses()].reverse() }),
    personB: chart("Beto", { placements: [...PLANETS].reverse(), houses: [...houses()].reverse() })
  });
  assert.deepEqual(shuffled, normal);
});

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringValues);
  return [];
}

test("el copy público de Vínculos evita términos técnicos sin explicación", () => {
  const own = buildOwnRelationshipPattern({ chart: chart("Ana") });
  const comparison = buildRelationshipComparison({
    requestedLevel: 3,
    personA: chart("Ana"),
    personB: chart("Beto")
  });
  const copy = stringValues([own, comparison]).join(" ");

  assert.doesNotMatch(copy, /\b(?:efem[eé]ride|proveedor|whole sign|orbe|c[uú]spides?|pasadas?)\b/i);

  // El nombre técnico del aspecto nunca aparece SOLO: va con el ángulo que lo
  // define. El anclaje anterior (`contacto de N° llamado …`) quedó obsoleto
  // porque el canon V4.9.2 invierte el orden —`forma una cuadratura con tu
  // Venus, un contacto de 90°`—, así que en vez de reescribir la frase se
  // reforzó la garantía: ahora se exige el ángulo en CADA aparición de CADA
  // nombre, no en una sola.
  const NOMBRES_DE_ASPECTO = ["conjunción", "sextil", "cuadratura", "trígono", "oposición"];
  let apariciones = 0;
  for (const nombre of NOMBRES_DE_ASPECTO) {
    for (const match of copy.matchAll(new RegExp(`\\b${nombre}\\b`, "gi"))) {
      apariciones += 1;
      const cola = copy.slice(match.index ?? 0, (match.index ?? 0) + 140);
      assert.match(cola, /un contacto de \d+°/, `"${nombre}" aparece sin su ángulo: ${cola}`);
    }
  }
  assert.ok(apariciones >= 5, `el copy debería nombrar aspectos: ${apariciones}`);

  // Voz del canon: segunda persona y sin nombres propios dentro del contacto.
  assert.match(copy, /Su \S+ forma (?:un|una) \S+ con tu \S+, un contacto de \d+°/);
  assert.doesNotMatch(copy, /\bde (?:Ana|Beto) y \S+ de (?:Ana|Beto) forman\b/);

  assert.match(copy, /punto opuesto al Ascendente/);
});
