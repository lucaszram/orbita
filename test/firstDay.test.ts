import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FIRST_DAY_REPLAY_CLEARS,
  isProductionBackend,
  shouldShowCartaQueEs,
  USER_DATA_STORAGE_KEYS
} from "../src/domain/firstDay";
import { accountSnapshotKeyPrefix, storageKeys } from "../src/domain/storageKeys";

describe("QUÉ ES del tab Carta — una sola vez por instalación", () => {
  it("primera visita de la vida: se muestra", () => {
    assert.equal(shouldShowCartaQueEs({}), true);
    assert.equal(shouldShowCartaQueEs({ recepcionVista: true, ritualExplicado: true }), true);
  });

  it("después de presentarse (cartaQueEsVisto) no vuelve a aparecer", () => {
    assert.equal(shouldShowCartaQueEs({ cartaQueEsVisto: true }), false);
  });
});

describe("REPETIR PRIMER DÍA — reset selectivo", () => {
  it("borra únicamente los hitos de primera vez", () => {
    assert.deepEqual([...FIRST_DAY_REPLAY_CLEARS], [storageKeys.firstRun]);
  });

  it("no toca ninguna clave de data del usuario (perfil, dueño, guardadas, lápidas, diario)", () => {
    // La lista de data del usuario cubre TODO lo que storage.ts persiste
    // fuera de los hitos de primera vez…
    const dataKeys = Object.entries(storageKeys)
      .filter(([name]) => name !== "firstRun")
      .map(([, key]) => key);
    assert.deepEqual([...USER_DATA_STORAGE_KEYS].sort(), dataKeys.sort());
    // …y el replay no interseca nada de eso, ni los snapshots por cuenta.
    for (const cleared of FIRST_DAY_REPLAY_CLEARS) {
      assert.equal(USER_DATA_STORAGE_KEYS.includes(cleared as never), false);
      assert.equal(cleared.startsWith(accountSnapshotKeyPrefix), false);
    }
  });
});

describe("REPETIR PRIMER DÍA — jamás en producción", () => {
  it("Clerk live (pk_live…) es producción: el control no existe", () => {
    assert.equal(isProductionBackend("pk_live_abc123"), true);
  });

  it("dev/testing (pk_test, sin key) sí lo muestra", () => {
    assert.equal(isProductionBackend("pk_test_abc123"), false);
    assert.equal(isProductionBackend(undefined), false);
    assert.equal(isProductionBackend(""), false);
  });
});
