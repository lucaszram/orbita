import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_SAVED_READINGS } from "../src/domain/accountLocalData";
import {
  addTombstoneKeys,
  isDailyReadingPayload,
  MAX_TOMBSTONE_KEYS,
  mergeRemoteSavedReadings,
  parseRemoteSavedReadings,
  readingMatchKeys,
  remoteRowsToUnsave,
  removeTombstoneKeys,
  type RemoteSavedReading
} from "../src/domain/savedReadingsSync";
import type { DailyReading } from "../src/domain/types";

function reading(id: string, date = "2026-07-15", cardId = "el-mago"): DailyReading {
  return {
    id,
    date,
    headline: `Lectura ${id}`,
    dateLabel: "MAR 15 JUL",
    tarotCard: { id: cardId }
  } as unknown as DailyReading;
}

function row(id: string, date = "2026-07-15", cardId = "el-mago") {
  return {
    savedReadingId: `saved_${id}`,
    readingId: null,
    readingDate: date,
    readingPayload: reading(id, date, cardId),
    note: null,
    createdAt: 1
  };
}

function remote(id: string, date = "2026-07-15", cardId = "el-mago"): RemoteSavedReading {
  return { savedReadingId: `saved_${id}`, reading: { ...reading(id, date, cardId), saved: true } };
}

describe("parseRemoteSavedReadings — validar antes de mezclar", () => {
  it("acepta filas válidas y marca saved", () => {
    const parsed = parseRemoteSavedReadings([row("r1")]);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].savedReadingId, "saved_r1");
    assert.equal(parsed[0].reading.id, "r1");
    assert.equal(parsed[0].reading.saved, true);
  });

  it("descarta basura sin romper: no-array, filas raras, payloads incompletos", () => {
    assert.deepEqual(parseRemoteSavedReadings(null), []);
    assert.deepEqual(parseRemoteSavedReadings("x"), []);
    assert.deepEqual(parseRemoteSavedReadings([null, 42, {}]), []);
    assert.deepEqual(
      parseRemoteSavedReadings([{ savedReadingId: "s1", readingPayload: { id: "r1" } }]),
      []
    );
    assert.deepEqual(parseRemoteSavedReadings([{ readingPayload: reading("r1") }]), []);
    // una fila mala no arrastra a las buenas
    const parsed = parseRemoteSavedReadings([{ savedReadingId: "s0", readingPayload: {} }, row("r2")]);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].reading.id, "r2");
  });

  it("isDailyReadingPayload exige lo que la lista usa (id, fecha, headline, dateLabel)", () => {
    assert.equal(isDailyReadingPayload(reading("r1")), true);
    assert.equal(isDailyReadingPayload({ ...reading("r1"), headline: "" }), false);
    assert.equal(isDailyReadingPayload([]), false);
  });
});

describe("mergeRemoteSavedReadings — lo local primero, el remoto solo aporta", () => {
  it("remoto vacío no borra lo local (y no marca cambios)", () => {
    const local = [reading("r1")];
    const { merged, changed } = mergeRemoteSavedReadings(local, [], []);
    assert.equal(changed, false);
    assert.equal(merged, local);
  });

  it("recupera lo remoto que falta, más nueva primero", () => {
    const local = [reading("r2", "2026-07-14")];
    const { merged, changed } = mergeRemoteSavedReadings(
      local,
      [remote("r3", "2026-07-15"), remote("r1", "2026-07-10")],
      []
    );
    assert.equal(changed, true);
    assert.deepEqual(
      merged.map((r) => r.id),
      ["r3", "r2", "r1"]
    );
  });

  it("dedupe por id: lo local gana y no se duplica", () => {
    const local = [reading("r1")];
    const { changed } = mergeRemoteSavedReadings(local, [remote("r1")], []);
    assert.equal(changed, false);
  });

  it("dedupe por fecha+carta cuando los ids difieren entre dispositivos", () => {
    const local = [reading("lucas-2026-07-15", "2026-07-15", "la-luna")];
    const { changed } = mergeRemoteSavedReadings(
      local,
      [remote("visitante-2026-07-15", "2026-07-15", "la-luna")],
      []
    );
    assert.equal(changed, false);
  });

  it("misma fecha con carta distinta NO es la misma lectura", () => {
    const local = [reading("a", "2026-07-15", "la-luna")];
    const { merged, changed } = mergeRemoteSavedReadings(local, [remote("b", "2026-07-15", "el-sol")], []);
    assert.equal(changed, true);
    assert.equal(merged.length, 2);
  });

  it("una lápida bloquea la resurrección de una lectura borrada", () => {
    const borrada = reading("r1");
    const tombstones = addTombstoneKeys([], readingMatchKeys(borrada));
    const { changed } = mergeRemoteSavedReadings([], [remote("r1")], tombstones);
    assert.equal(changed, false);
  });

  it("respeta el límite activo de guardadas", () => {
    const remotes = Array.from({ length: MAX_SAVED_READINGS + 10 }, (_, i) =>
      remote(`r${i}`, `2026-06-${String((i % 28) + 1).padStart(2, "0")}`, `carta-${i}`)
    );
    const { merged } = mergeRemoteSavedReadings([], remotes, []);
    assert.equal(merged.length, MAX_SAVED_READINGS);
  });
});

describe("lápidas — el unsave remoto se confirma antes de levantarlas", () => {
  it("remoteRowsToUnsave encuentra las filas remotas de una lectura borrada", () => {
    const tombstones = addTombstoneKeys([], readingMatchKeys(reading("r1")));
    const rows = [remote("r1"), remote("r2", "2026-07-14", "el-sol")];
    const pending = remoteRowsToUnsave(rows, tombstones);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].savedReadingId, "saved_r1");
    assert.deepEqual(remoteRowsToUnsave(rows, []), []);
  });

  it("matchea por fecha+carta aunque el id remoto sea de otro dispositivo", () => {
    const tombstones = addTombstoneKeys([], readingMatchKeys(reading("local-id", "2026-07-15", "la-luna")));
    const pending = remoteRowsToUnsave([remote("remoto-id", "2026-07-15", "la-luna")], tombstones);
    assert.equal(pending.length, 1);
  });

  it("add/remove: sin duplicados, con techo, y levantar deja re-guardar", () => {
    const keys = readingMatchKeys(reading("r1"));
    let tombstones = addTombstoneKeys([], keys);
    tombstones = addTombstoneKeys(tombstones, keys);
    assert.equal(tombstones.length, keys.length);

    const muchas = Array.from({ length: MAX_TOMBSTONE_KEYS + 20 }, (_, i) => `id:extra-${i}`);
    assert.equal(addTombstoneKeys(muchas, keys).length, MAX_TOMBSTONE_KEYS);

    const limpio = removeTombstoneKeys(tombstones, keys);
    assert.deepEqual(limpio, []);
    const { changed } = mergeRemoteSavedReadings([], [remote("r1")], limpio);
    assert.equal(changed, true);
  });
});
