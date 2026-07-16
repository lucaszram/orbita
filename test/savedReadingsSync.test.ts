import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAccountSnapshot,
  MAX_SAVED_READINGS,
  parseAccountSnapshot,
  planLogoutArchive,
  snapshotHasData
} from "../src/domain/accountLocalData";
import {
  addTombstoneKeys,
  commitSavedReadingRemoval,
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

  it("tarotCard puede faltar, pero si viene malformada la fila se descarta", () => {
    const sinCarta = { ...reading("r1"), tarotCard: undefined };
    assert.equal(isDailyReadingPayload(sinCarta), true);
    assert.equal(isDailyReadingPayload({ ...reading("r1"), tarotCard: {} }), false);
    assert.equal(isDailyReadingPayload({ ...reading("r1"), tarotCard: { id: "" } }), false);
    assert.equal(isDailyReadingPayload({ ...reading("r1"), tarotCard: "el-mago" }), false);
    assert.equal(isDailyReadingPayload({ ...reading("r1"), tarotCard: ["el-mago"] }), false);
    assert.deepEqual(
      parseRemoteSavedReadings([{ savedReadingId: "s1", readingPayload: { ...reading("r1"), tarotCard: {} } }]),
      []
    );
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

  it("sin carta no hay fallback: dos lecturas parciales del mismo día no se mezclan", () => {
    const sinCartaLocal = { ...reading("a", "2026-07-15"), tarotCard: undefined } as unknown as DailyReading;
    const sinCartaRemota: RemoteSavedReading = {
      savedReadingId: "saved_b",
      reading: { ...reading("b", "2026-07-15"), tarotCard: undefined, saved: true } as unknown as DailyReading
    };
    // solo clave por id: nada de `dc:fecha::`
    assert.deepEqual(readingMatchKeys(sinCartaLocal), ["id:a"]);
    // no se dedupean entre sí…
    const { merged, changed } = mergeRemoteSavedReadings([sinCartaLocal], [sinCartaRemota], []);
    assert.equal(changed, true);
    assert.equal(merged.length, 2);
    // …ni una lápida de la parcial "a" borra la parcial "b" del mismo día
    const tombstones = addTombstoneKeys([], readingMatchKeys(sinCartaLocal));
    assert.deepEqual(remoteRowsToUnsave([sinCartaRemota], tombstones), []);
  });

  it("una lápida bloquea la resurrección de una lectura borrada", () => {
    const borrada = reading("r1");
    const tombstones = addTombstoneKeys([], readingMatchKeys(borrada));
    const { changed } = mergeRemoteSavedReadings([], [remote("r1")], tombstones);
    assert.equal(changed, false);
  });

  it("carrera de login: el remoto entra ANTES que las lápidas de la cuenta → al llegar la lápida la lectura se retira igual", () => {
    // 1. la sesión activa: listSaved resuelve antes de restoreAccountData
    const paso1 = mergeRemoteSavedReadings([], [remote("r1")], []);
    assert.equal(paso1.changed, true);
    assert.equal(paso1.merged.length, 1);
    // 2. el snapshot restaura la lápida DESPUÉS: la reconciliación la retira
    // de la lista ya mergeada (no solo bloquea adiciones nuevas)
    const tombstones = addTombstoneKeys([], readingMatchKeys(reading("r1")));
    const paso2 = mergeRemoteSavedReadings(paso1.merged, [remote("r1")], tombstones);
    assert.equal(paso2.changed, true);
    assert.deepEqual(paso2.merged, []);
    // 3. y el borrado remoto sigue pendiente hasta confirmarse
    const pendientes = remoteRowsToUnsave([remote("r1")], tombstones);
    assert.equal(pendientes.length, 1);
    assert.equal(pendientes[0].savedReadingId, "saved_r1");
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

  it("borrado coordinado con storage demorado: nunca existe 'sin lectura y sin lápida'", async () => {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const borrada = reading("r1");
    const keys = readingMatchKeys(borrada);

    // "disco" observable en todo momento durante el commit
    const disk = { readings: [borrada] as DailyReading[], tombstones: [] as string[] };
    const eventos: string[] = [];
    const estados: Array<{ tieneLectura: boolean; tieneLapida: boolean }> = [];
    const sampleDisk = () =>
      estados.push({
        tieneLectura: disk.readings.some((r) => r.id === borrada.id),
        tieneLapida: keys.some((key) => disk.tombstones.includes(key))
      });

    const commit = commitSavedReadingRemoval({
      persistTombstones: async () => {
        await delay(15);
        disk.tombstones = addTombstoneKeys([], keys);
        eventos.push("lapida");
      },
      publishState: () => eventos.push("publicar"),
      persistReadings: async () => {
        await delay(15);
        disk.readings = [];
        eventos.push("lista");
      }
    });

    // un "logout inmediato" muestrea el disco mientras las escrituras corren
    const sampler = (async () => {
      for (let i = 0; i < 8; i++) {
        sampleDisk();
        await delay(5);
      }
    })();
    await Promise.all([commit, sampler]);
    sampleDisk();

    // la intención toca disco antes que la lista, y se publica en el medio
    assert.deepEqual(eventos, ["lapida", "publicar", "lista"]);
    // invariante: en NINGÚN momento el disco quedó sin lectura y sin lápida
    for (const s of estados) {
      assert.ok(s.tieneLectura || s.tieneLapida, "estado intermedio inválido: sin lectura y sin lápida");
    }
    // estado final: sin lectura, con lápida pendiente de unsave
    assert.deepEqual(disk.readings, []);
    assert.ok(keys.every((key) => disk.tombstones.includes(key)));
  });

  it("crash entre la lápida y la lista: la reconciliación del arranque retira la lectura", async () => {
    const borrada = reading("r1");
    const keys = readingMatchKeys(borrada);
    const disk = { readings: [borrada] as DailyReading[], tombstones: [] as string[] };

    // la app muere antes de persistir la lista: solo quedó la intención
    await assert.rejects(
      commitSavedReadingRemoval({
        persistTombstones: async () => {
          disk.tombstones = addTombstoneKeys([], keys);
        },
        publishState: () => undefined,
        persistReadings: async () => {
          throw new Error("proceso muerto");
        }
      })
    );

    // disco = lista-vieja + lápida → el arranque (o el próximo merge) reconcilia
    const { merged, changed } = mergeRemoteSavedReadings(disk.readings, [], disk.tombstones);
    assert.equal(changed, true);
    assert.deepEqual(merged, []);
    // y el unsave remoto sigue pendiente si el servidor aún tiene la fila
    assert.equal(remoteRowsToUnsave([remote("r1")], disk.tombstones).length, 1);
  });

  it("borrar → logout → login con unsave pendiente: la lápida viaja con la cuenta y no hay resurrección", () => {
    // 1. Borrado local; el `unsave` remoto queda pendiente (lento/offline).
    const borrada = reading("r1");
    const tombstones = addTombstoneKeys([], readingMatchKeys(borrada));

    // 2. Logout: las lápidas pendientes cuentan como data y entran al snapshot.
    const snapshot = buildAccountSnapshot(null, [], [], "2026-07-16T12:00:00.000Z", tombstones);
    assert.equal(snapshotHasData(snapshot), true);
    assert.equal(planLogoutArchive("user_abc", snapshot), "archive");
    assert.equal(planLogoutArchive(null, snapshot), "error"); // nunca perderlas sin respaldo

    // 3. Login en el mismo teléfono: el snapshot restaura las lápidas…
    const parsed = parseAccountSnapshot(JSON.stringify(snapshot));
    assert.ok(parsed);
    assert.deepEqual(parsed.savedReadingTombstones, tombstones);
    const restauradas = addTombstoneKeys([], parsed.savedReadingTombstones);

    // 4. …el servidor todavía devuelve la fila: no re-entra al merge y el
    // borrado pendiente se retoma.
    const { changed } = mergeRemoteSavedReadings([], [remote("r1")], restauradas);
    assert.equal(changed, false);
    const pendientes = remoteRowsToUnsave([remote("r1")], restauradas);
    assert.equal(pendientes.length, 1);
    assert.equal(pendientes[0].savedReadingId, "saved_r1");
  });

  it("snapshots viejos sin el campo siguen siendo válidos (lápidas = [])", () => {
    const legado = JSON.stringify({
      version: 1,
      savedAt: "t",
      profile: null,
      savedReadings: [reading("r1")],
      journalEntries: []
    });
    const parsed = parseAccountSnapshot(legado);
    assert.ok(parsed);
    assert.deepEqual(parsed.savedReadingTombstones, []);
    // y basura adentro del campo no rompe el login
    const conBasura = parseAccountSnapshot(
      JSON.stringify({ ...JSON.parse(legado), savedReadingTombstones: ["id:r1", 42, null] })
    );
    assert.ok(conBasura);
    assert.deepEqual(conBasura.savedReadingTombstones, ["id:r1"]);
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
