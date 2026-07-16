import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cerrarVisitaCartaQueEs,
  decidirCartaQueEs,
  FIRST_DAY_REPLAY_CLEARS,
  firstDayReplayEnabled,
  isProductionBackend,
  QUE_ES_VISITA_INICIAL,
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

describe("QUÉ ES por visita — el replay re-muestra aunque el tab siga montado", () => {
  it("sin flags hidratados no decide nada", () => {
    const r = decidirCartaQueEs(QUE_ES_VISITA_INICIAL, false, {});
    assert.equal(r.visita, QUE_ES_VISITA_INICIAL);
    assert.equal(r.marcarVisto, false);
  });

  it("marcar visto durante la visita no esconde el bloque en curso", () => {
    // primera visita: muestra y pide marcar
    const primera = decidirCartaQueEs(QUE_ES_VISITA_INICIAL, true, {});
    assert.equal(primera.visita.mostrar, true);
    assert.equal(primera.marcarVisto, true);
    // re-render con el flag ya marcado (markFirstRun notificó): la visita
    // sigue decidida, sigue mostrando, y no re-marca
    const reRender = decidirCartaQueEs(primera.visita, true, { cartaQueEsVisto: true });
    assert.equal(reRender.visita, primera.visita);
    assert.equal(reRender.visita.mostrar, true);
    assert.equal(reRender.marcarVisto, false);
  });

  it("visita → REPETIR PRIMER DÍA (clear) → nueva visita: vuelve a mostrar (el guard se rearma al perder foco)", () => {
    // visita 1 (Carta queda montada): muestra y marca
    const visita1 = decidirCartaQueEs(QUE_ES_VISITA_INICIAL, true, {});
    assert.equal(visita1.visita.mostrar, true);
    // el usuario va a Perfil: al perder foco la visita se cierra
    const cerrada = cerrarVisitaCartaQueEs();
    // visita 2 normal, con el flag marcado: NO se muestra
    const visita2 = decidirCartaQueEs(cerrada, true, { cartaQueEsVisto: true });
    assert.equal(visita2.visita.mostrar, false);
    assert.equal(visita2.marcarVisto, false);
    // REPETIR PRIMER DÍA borra los flags; al volver a Carta (nuevo foco,
    // mismo montaje) la visita nueva decide de nuevo y el bloque reaparece
    const visita3 = decidirCartaQueEs(cerrarVisitaCartaQueEs(), true, {});
    assert.equal(visita3.visita.mostrar, true);
    assert.equal(visita3.marcarVisto, true);
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

describe("REPETIR PRIMER DÍA — falla cerrado, jamás en producción", () => {
  it("sin la bandera explícita queda oculto en TODA build (ausente, false, mayúsculas)", () => {
    assert.equal(firstDayReplayEnabled({ enableFlag: undefined, clerkPublishableKey: "pk_test_abc" }), false);
    assert.equal(firstDayReplayEnabled({ enableFlag: "false", clerkPublishableKey: "pk_test_abc" }), false);
    assert.equal(firstDayReplayEnabled({ enableFlag: "TRUE", clerkPublishableKey: "pk_test_abc" }), false);
    assert.equal(firstDayReplayEnabled({ enableFlag: "1", clerkPublishableKey: "pk_test_abc" }), false);
  });

  it("bandera en true + pk_test → visible; bandera en true + pk_live → oculto igual", () => {
    assert.equal(firstDayReplayEnabled({ enableFlag: "true", clerkPublishableKey: "pk_test_abc" }), true);
    assert.equal(firstDayReplayEnabled({ enableFlag: "true", clerkPublishableKey: undefined }), true);
    assert.equal(firstDayReplayEnabled({ enableFlag: "true", clerkPublishableKey: "pk_live_abc" }), false);
  });

  it("isProductionBackend distingue live de test/demo", () => {
    assert.equal(isProductionBackend("pk_live_abc123"), true);
    assert.equal(isProductionBackend("pk_test_abc123"), false);
    assert.equal(isProductionBackend(undefined), false);
    assert.equal(isProductionBackend(""), false);
  });
});
