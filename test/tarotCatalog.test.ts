import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { guestCardIdForDate, guestCardOfTheDay, TAROT_CATALOG } from "../src/content/tarotCatalog";

const ASSETS_DIR = path.resolve(process.cwd(), "assets/orbita/optimized/tarot");

describe("catálogo de 78 cartas — espejo del contrato PR #15", () => {
  it("78 cartas, posicionales: TAROT_CATALOG[id].id === id", () => {
    assert.equal(TAROT_CATALOG.length, 78);
    TAROT_CATALOG.forEach((card, index) => assert.equal(card.id, index));
  });

  it("los ids 0–21 conservan los mayores históricos, en orden", () => {
    const majors = TAROT_CATALOG.slice(0, 22);
    assert.equal(majors.length, 22);
    assert.ok(majors.every((c) => c.arcana === "major"));
    assert.equal(majors[0].nombre, "El Loco");
    assert.equal(majors[0].key, "major_00_el_loco");
    assert.equal(majors[10].nombre, "La Rueda de la Fortuna");
    assert.equal(majors[19].nombre, "El Sol");
    assert.equal(majors[21].nombre, "El Mundo");
    assert.equal(majors[21].key, "major_21_el_mundo");
  });

  it("los menores ocupan 22–77 en orden Bastos, Copas, Espadas, Oros (As → Rey)", () => {
    const minors = TAROT_CATALOG.slice(22);
    assert.equal(minors.length, 56);
    assert.ok(minors.every((c) => c.arcana === "minor"));
    // fronteras exactas del contrato
    assert.deepEqual(
      [22, 35, 36, 49, 50, 63, 64, 77].map((id) => ({ id, nombre: TAROT_CATALOG[id].nombre, key: TAROT_CATALOG[id].key })),
      [
        { id: 22, nombre: "As de Bastos", key: "wands_ace" },
        { id: 35, nombre: "Rey de Bastos", key: "wands_king" },
        { id: 36, nombre: "As de Copas", key: "cups_ace" },
        { id: 49, nombre: "Rey de Copas", key: "cups_king" },
        { id: 50, nombre: "As de Espadas", key: "swords_ace" },
        { id: 63, nombre: "Rey de Espadas", key: "swords_king" },
        { id: 64, nombre: "As de Oros", key: "pentacles_ace" },
        { id: 77, nombre: "Rey de Oros", key: "pentacles_king" }
      ]
    );
  });

  it("keys y nombres únicos; correspondencia siempre presente", () => {
    assert.equal(new Set(TAROT_CATALOG.map((c) => c.key)).size, 78);
    assert.equal(new Set(TAROT_CATALOG.map((c) => c.nombre)).size, 78);
    assert.ok(TAROT_CATALOG.every((c) => c.correspondencia.length > 0));
    // los menores llevan el dato editorial "Palo · Elemento" que consume el backend
    assert.equal(TAROT_CATALOG[22].correspondencia, "Bastos · Fuego");
    assert.equal(TAROT_CATALOG[36].correspondencia, "Copas · Agua");
    assert.equal(TAROT_CATALOG[50].correspondencia, "Espadas · Aire");
    assert.equal(TAROT_CATALOG[64].correspondencia, "Oros · Tierra");
  });

  it("un id fuera del mazo NO resuelve: los consumidores caen al dorso (CARD_BACK)", () => {
    // `cardById` de tarotDeck es acceso posicional sobre este catálogo; acá se
    // fija el contrato: fuera de 0–77 → undefined, jamás una carta equivocada.
    assert.equal(TAROT_CATALOG[78], undefined);
    assert.equal(TAROT_CATALOG[-1], undefined);
    assert.equal(TAROT_CATALOG[Number.NaN as unknown as number], undefined);
  });

  it("cada carta tiene su asset real en assets/orbita/optimized/tarot (y el dorso existe)", () => {
    for (const card of TAROT_CATALOG) {
      const file = path.join(ASSETS_DIR, `${card.key}.jpg`);
      assert.ok(existsSync(file), `falta el asset ${card.key}.jpg (id ${card.id}, ${card.nombre})`);
    }
    assert.ok(existsSync(path.join(ASSETS_DIR, "orbita_card_back_orbits.jpg")));
  });
});

describe("sorteo del invitado — determinístico sobre el mazo completo", () => {
  const year2026 = Array.from({ length: 366 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 0, 1 + i));
    return date.toISOString().slice(0, 10);
  });

  it("la misma fecha da siempre el mismo id", () => {
    for (const date of ["2026-07-16", "2026-01-01", "2026-12-31"]) {
      assert.equal(guestCardIdForDate(date), guestCardIdForDate(date));
    }
  });

  it("todo un año cae dentro de 0–77, con enteros, y usa el mazo completo (no solo mayores)", () => {
    const ids = year2026.map((date) => guestCardIdForDate(date));
    for (const id of ids) {
      assert.ok(Number.isInteger(id) && id >= 0 && id <= 77, `id fuera de rango: ${id}`);
    }
    assert.ok(ids.some((id) => id > 21), "el sorteo nunca salió de los mayores: no está usando las 78");
  });

  it("guestCardOfTheDay usa exactamente ese id (y los datos del catálogo)", () => {
    for (const date of ["2026-07-16", "2026-02-14", "2026-11-30"]) {
      const id = guestCardIdForDate(date);
      const card = guestCardOfTheDay(date);
      assert.equal(card.id, id);
      assert.equal(card.nombre, TAROT_CATALOG[id].nombre);
      assert.equal(card.correspondencia, TAROT_CATALOG[id].correspondencia);
      assert.equal(card.beats.length, 3);
      // el beat QUÉ ES describe el arcano correcto según su tipo
      const esperado = TAROT_CATALOG[id].arcana === "major" ? "22 Arcanos Mayores" : "56 Arcanos Menores";
      assert.ok(card.beats[0].body.includes(esperado));
    }
  });
});
