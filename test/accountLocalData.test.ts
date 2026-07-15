import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accountSnapshotKey,
  buildAccountSnapshot,
  MAX_JOURNAL_ENTRIES,
  MAX_SAVED_READINGS,
  mergeAccountLists,
  parseAccountSnapshot,
  planLogoutArchive,
  snapshotHasData
} from "../src/domain/accountLocalData";
import type { DailyReading, JournalEntry, UserProfile } from "../src/domain/types";

const profile: UserProfile = {
  id: "visitante-1996-01-15",
  name: "Visitante",
  birthDate: "1996-01-15",
  zodiacSign: "capricornio",
  interests: ["claridad", "energia"],
  guidanceTone: "protectora",
  notificationTime: "09:00",
  createdAt: "2026-01-01T00:00:00.000Z"
};

function reading(id: string): DailyReading {
  return { id, date: "2026-07-15" } as unknown as DailyReading;
}

function entry(id: string): JournalEntry {
  return { id, readingId: id, date: "2026-07-15", note: "nota" } as unknown as JournalEntry;
}

describe("accountSnapshotKey", () => {
  it("clave privada distinta por cuenta", () => {
    assert.equal(accountSnapshotKey("user_abc"), "orbita:account-snapshot:user_abc");
    assert.notEqual(accountSnapshotKey("user_abc"), accountSnapshotKey("user_xyz"));
  });
});

describe("buildAccountSnapshot / parseAccountSnapshot", () => {
  it("roundtrip completo (logout → re-login en el mismo teléfono)", () => {
    const snapshot = buildAccountSnapshot(profile, [reading("r1")], [entry("j1")], "2026-07-15T12:00:00.000Z");
    const parsed = parseAccountSnapshot(JSON.stringify(snapshot));
    assert.ok(parsed);
    assert.equal(parsed.profile?.id, profile.id);
    assert.equal(parsed.savedReadings.length, 1);
    assert.equal(parsed.journalEntries.length, 1);
    assert.equal(parsed.savedAt, "2026-07-15T12:00:00.000Z");
  });

  it("snapshotHasData: vacío no se archiva", () => {
    assert.equal(snapshotHasData(buildAccountSnapshot(null, [], [], "t")), false);
    assert.equal(snapshotHasData(buildAccountSnapshot(profile, [], [], "t")), true);
    assert.equal(snapshotHasData(buildAccountSnapshot(null, [reading("r")], [], "t")), true);
    assert.equal(snapshotHasData(buildAccountSnapshot(null, [], [entry("j")], "t")), true);
  });

  it("basura o versión desconocida → null (nunca rompe el login)", () => {
    assert.equal(parseAccountSnapshot(null), null);
    assert.equal(parseAccountSnapshot(""), null);
    assert.equal(parseAccountSnapshot("no-json"), null);
    assert.equal(parseAccountSnapshot("{}"), null);
    assert.equal(parseAccountSnapshot(JSON.stringify({ version: 2 })), null);
    assert.equal(parseAccountSnapshot(JSON.stringify({ version: 1, savedReadings: "x", journalEntries: [] })), null);
  });
});

describe("planLogoutArchive — el orden del logout es archivar → signOut → limpiar", () => {
  const withData = buildAccountSnapshot(profile, [reading("r1")], [], "t");
  const empty = buildAccountSnapshot(null, [], [], "t");

  it("con datos y userId → archivar antes de cerrar sesión", () => {
    assert.equal(planLogoutArchive("user_abc", withData), "archive");
  });

  it("sin datos → nada que archivar, se puede cerrar directo (con o sin userId)", () => {
    assert.equal(planLogoutArchive("user_abc", empty), "skip");
    assert.equal(planLogoutArchive(null, empty), "skip");
    assert.equal(planLogoutArchive(undefined, empty), "skip");
  });

  it("con datos pero SIN userId → error: abortar el logout, nunca borrar sin respaldo", () => {
    assert.equal(planLogoutArchive(null, withData), "error");
    assert.equal(planLogoutArchive(undefined, withData), "error");
    assert.equal(planLogoutArchive("", withData), "error");
  });

  it("solo diario (sin perfil) también cuenta como datos a proteger", () => {
    const journalOnly = buildAccountSnapshot(null, [], [entry("j1")], "t");
    assert.equal(planLogoutArchive(null, journalOnly), "error");
    assert.equal(planLogoutArchive("user_abc", journalOnly), "archive");
  });
});

describe("mergeAccountLists — restaurar sin pisar lo nuevo", () => {
  const snapshot = buildAccountSnapshot(profile, [reading("r1"), reading("r2")], [entry("j1")], "t");

  it("sin datos actuales → vuelve todo lo archivado", () => {
    const merged = mergeAccountLists(snapshot, { savedReadings: [], journalEntries: [] });
    assert.deepEqual(merged.savedReadings.map((item) => item.id), ["r1", "r2"]);
    assert.deepEqual(merged.journalEntries.map((item) => item.id), ["j1"]);
  });

  it("lo creado después del logout va primero y no se duplica", () => {
    const merged = mergeAccountLists(snapshot, {
      savedReadings: [reading("r3"), reading("r1")],
      journalEntries: [entry("j2")]
    });
    assert.deepEqual(merged.savedReadings.map((item) => item.id), ["r3", "r1", "r2"]);
    assert.deepEqual(merged.journalEntries.map((item) => item.id), ["j2", "j1"]);
  });

  it("respeta los límites de las listas activas", () => {
    const many = buildAccountSnapshot(
      null,
      Array.from({ length: 80 }, (_, i) => reading(`s${i}`)),
      Array.from({ length: 150 }, (_, i) => entry(`e${i}`)),
      "t"
    );
    const merged = mergeAccountLists(many, { savedReadings: [reading("nuevo")], journalEntries: [] });
    assert.equal(merged.savedReadings.length, MAX_SAVED_READINGS);
    assert.equal(merged.savedReadings[0].id, "nuevo");
    assert.equal(merged.journalEntries.length, MAX_JOURNAL_ENTRIES);
  });
});
