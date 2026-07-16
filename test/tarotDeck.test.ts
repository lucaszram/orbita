import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { recentCardIdsFromPayloads, shiftLocalDate } from "../convex/daily";
import { cardById, drawCard, TAROT_DECK } from "../convex/lib/tarot";

const HISTORIC_MAJOR_NAMES = [
  "El Loco",
  "El Mago",
  "La Sacerdotisa",
  "La Emperatriz",
  "El Emperador",
  "El Hierofante",
  "Los Enamorados",
  "El Carro",
  "La Fuerza",
  "El Ermitaño",
  "La Rueda de la Fortuna",
  "La Justicia",
  "El Colgado",
  "La Muerte",
  "La Templanza",
  "El Diablo",
  "La Torre",
  "La Estrella",
  "La Luna",
  "El Sol",
  "El Juicio",
  "El Mundo"
];

test("el catálogo canónico tiene 78 ids y keys únicos", () => {
  assert.equal(TAROT_DECK.length, 78);
  assert.deepEqual(
    TAROT_DECK.map((card) => card.id),
    Array.from({ length: 78 }, (_, id) => id)
  );
  assert.equal(new Set(TAROT_DECK.map((card) => card.key)).size, 78);
  assert.equal(TAROT_DECK.filter((card) => card.arcana === "major").length, 22);
  assert.equal(TAROT_DECK.filter((card) => card.arcana === "minor").length, 56);
});

test("los ids históricos 0–21 conservan exactamente sus arcanos mayores", () => {
  assert.deepEqual(
    TAROT_DECK.slice(0, 22).map((card) => card.nombre),
    HISTORIC_MAJOR_NAMES
  );
});

test("los menores ocupan 22–77 en el orden estable acordado", () => {
  assert.deepEqual(cardById(22), {
    id: 22,
    key: "wands_ace",
    nombre: "As de Bastos",
    arcana: "minor",
    suit: "wands",
    rank: "ace",
    correspondencia: "Bastos · Fuego"
  });
  assert.equal(cardById(35)?.nombre, "Rey de Bastos");
  assert.equal(cardById(36)?.nombre, "As de Copas");
  assert.equal(cardById(49)?.nombre, "Rey de Copas");
  assert.equal(cardById(50)?.nombre, "As de Espadas");
  assert.equal(cardById(63)?.nombre, "Rey de Espadas");
  assert.equal(cardById(64)?.nombre, "As de Oros");
  assert.equal(cardById(77)?.nombre, "Rey de Oros");
  assert.equal(cardById(78), null);
});

test("cada carta del contrato tiene un asset optimizado con el mismo key", () => {
  for (const card of TAROT_DECK) {
    const path = resolve(process.cwd(), "assets", "orbita", "optimized", "tarot", `${card.key}.jpg`);
    assert.equal(existsSync(path), true, `Falta asset para ${card.id} ${card.nombre}: ${path}`);
  }
});

test("el sorteo es estable y nunca devuelve una carta excluida", () => {
  const excludedIds = [0, 18, 22, 36, 50, 64];
  for (let day = 1; day <= 31; day += 1) {
    const localDate = `2026-07-${String(day).padStart(2, "0")}`;
    const first = drawCard({ userId: "user_123", localDate, excludedIds });
    const repeated = drawCard({ userId: "user_123", localDate, excludedIds });
    assert.deepEqual(repeated, first);
    assert.equal(excludedIds.includes(first.id), false);
  }
});

test("una secuencia diaria nunca repite dentro de una ventana móvil de siete días", () => {
  const recentIds: number[] = [];
  let localDate = "2026-01-01";

  for (let index = 0; index < 366; index += 1) {
    const card = drawCard({ userId: "user_window", localDate, excludedIds: recentIds.slice(-6) });
    assert.equal(recentIds.slice(-6).includes(card.id), false, `Se repitió ${card.nombre} el ${localDate}`);
    recentIds.push(card.id);
    localDate = shiftLocalDate(localDate, 1) as string;
  }
});

test("la ventana usa fechas civiles y cruza meses/años bisiestos sin saltos", () => {
  assert.equal(shiftLocalDate("2026-03-01", -6), "2026-02-23");
  assert.equal(shiftLocalDate("2024-03-01", -1), "2024-02-29");
  assert.equal(shiftLocalDate("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftLocalDate("2026-02-30", -6), null);
  assert.equal(shiftLocalDate("mal", -6), null);
});

test("el historial tolera payloads viejos o dañados y deduplica ids", () => {
  assert.deepEqual(
    recentCardIdsFromPayloads([
      { carta: { id: 18 } },
      { carta: { id: 22 } },
      { carta: { id: 22 } },
      { carta: { id: -1 } },
      { carta: { id: 78 } },
      { carta: { id: "18" } },
      { carta: null },
      null
    ]),
    [18, 22]
  );
});
