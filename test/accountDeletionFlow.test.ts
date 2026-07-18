import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completePendingAccountDeletion,
  requestAccountDeletion,
  runAccountDeletion,
  type AccountDeletionSteps
} from "../src/domain/accountDeletion";

// Registra el orden real de ejecución de cada paso.
function trackedSteps(overrides: Partial<AccountDeletionSteps> = {}) {
  const calls: string[] = [];
  const steps: AccountDeletionSteps = {
    deleteConvexAccount: async () => {
      calls.push("convex");
      return { deleted: true as const };
    },
    markPendingCleanup: async () => {
      calls.push("marker");
    },
    deleteClerkUser: async () => {
      calls.push("clerk");
    },
    clearLocalData: async () => {
      calls.push("clear");
    },
    clearPendingCleanup: async () => {
      calls.push("unmark");
    },
    goToEntry: () => {
      calls.push("entry");
    },
    ...overrides
  };
  return { calls, steps };
}

const accept = async () => true;
const reject = async () => false;

describe("requestAccountDeletion — cancelar no hace nada", () => {
  it("cancelar la advertencia: ningún paso corre y no se pregunta lo destructivo", async () => {
    const { calls, steps } = trackedSteps();
    let destructiveAsked = false;
    const result = await requestAccountDeletion(
      {
        confirmWarning: reject,
        confirmDestructive: async () => {
          destructiveAsked = true;
          return true;
        }
      },
      steps
    );
    assert.deepEqual(result, { status: "cancelled" });
    assert.deepEqual(calls, []);
    assert.equal(destructiveAsked, false);
  });

  it("cancelar la segunda confirmación destructiva: ningún paso corre", async () => {
    const { calls, steps } = trackedSteps();
    const result = await requestAccountDeletion({ confirmWarning: accept, confirmDestructive: reject }, steps);
    assert.deepEqual(result, { status: "cancelled" });
    assert.deepEqual(calls, []);
  });
});

describe("runAccountDeletion — orden estricto Convex → marcador → Clerk → limpieza → entrada", () => {
  it("éxito completo respeta el orden y retira el marcador ÚLTIMO", async () => {
    const { calls, steps } = trackedSteps();
    const result = await runAccountDeletion(steps);
    assert.deepEqual(result, { status: "success", localCleared: true });
    assert.deepEqual(calls, ["convex", "marker", "clerk", "clear", "unmark", "entry"]);
  });

  it("el flujo completo con ambas confirmaciones también corre en orden", async () => {
    const { calls, steps } = trackedSteps();
    const result = await requestAccountDeletion({ confirmWarning: accept, confirmDestructive: accept }, steps);
    assert.equal(result.status, "success");
    assert.deepEqual(calls, ["convex", "marker", "clerk", "clear", "unmark", "entry"]);
  });
});

describe("runAccountDeletion — un error conserva la sesión (nunca simular éxito)", () => {
  it("Convex falla: no se marca, no se toca Clerk ni lo local, no se navega", async () => {
    const { calls, steps } = trackedSteps({
      deleteConvexAccount: async () => {
        throw new Error("convex down");
      }
    });
    const result = await runAccountDeletion(steps);
    assert.deepEqual(result, { status: "error", step: "convex" });
    assert.deepEqual(calls, []);
  });

  it("Convex responde sin confirmar el borrado: se trata como error, jamás se avanza", async () => {
    const { calls, steps } = trackedSteps({
      deleteConvexAccount: async () => null
    });
    const result = await runAccountDeletion(steps);
    assert.deepEqual(result, { status: "error", step: "convex" });
    assert.deepEqual(calls, []);
  });

  it("el marcador no se puede escribir: NO se borra Clerk (sin red de seguridad no se avanza)", async () => {
    const { calls, steps } = trackedSteps({
      markPendingCleanup: async () => {
        throw new Error("storage down");
      }
    });
    const result = await runAccountDeletion(steps);
    assert.deepEqual(result, { status: "error", step: "marker" });
    assert.deepEqual(calls, ["convex"]);
  });

  it("Clerk falla: Convex ya corrió (idempotente para el reintento), pero NO se limpia ni se navega", async () => {
    const { calls, steps } = trackedSteps({
      deleteClerkUser: async () => {
        throw new Error("clerk down");
      }
    });
    const result = await runAccountDeletion(steps);
    assert.deepEqual(result, { status: "error", step: "clerk" });
    assert.deepEqual(calls, ["convex", "marker"]);
  });

  it("el reintento tras un fallo de Clerk vuelve a correr TODO el flujo en orden", async () => {
    let clerkAttempts = 0;
    const { calls, steps } = trackedSteps({
      deleteClerkUser: async () => {
        clerkAttempts += 1;
        if (clerkAttempts === 1) throw new Error("clerk down");
        calls.push("clerk");
      }
    });
    assert.equal((await runAccountDeletion(steps)).status, "error");
    const retry = await runAccountDeletion(steps);
    assert.deepEqual(retry, { status: "success", localCleared: true });
    assert.deepEqual(calls, ["convex", "marker", "convex", "marker", "clerk", "clear", "unmark", "entry"]);
  });
});

describe("runAccountDeletion — fallo de limpieza local", () => {
  it("no bloquea la salida (la cuenta ya no existe) pero el marcador QUEDA para el arranque", async () => {
    const { calls, steps } = trackedSteps({
      clearLocalData: async () => {
        throw new Error("storage down");
      }
    });
    const result = await runAccountDeletion(steps);
    assert.deepEqual(result, { status: "success", localCleared: false });
    // Sin "unmark": el marcador sobrevive y autoriza la purga al arranque.
    assert.deepEqual(calls, ["convex", "marker", "clerk", "entry"]);
  });
});

// ---------------------------------------------------------------------------
// Purga al arranque + regresión completa (review Codex P1)
// ---------------------------------------------------------------------------

// Storage falso: un Map con llaves de la app y fallas inyectables en los clears.
function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const failing = { clears: false };
  const throwIfFailing = () => {
    if (failing.clears) throw new Error("storage down");
  };
  return {
    store,
    failing,
    deps: {
      readMarker: async () => {
        const raw = store.get("marker");
        return raw ? { userId: raw || null } : null;
      },
      clearLocalData: async () => {
        throwIfFailing();
        store.delete("profile");
        store.delete("profile-owner");
        store.delete("saved");
        store.delete("journal");
      },
      clearAccountSnapshot: async (userId: string) => {
        throwIfFailing();
        store.delete(`snapshot:${userId}`);
      },
      clearMarker: async () => {
        throwIfFailing();
        store.delete("marker");
      }
    }
  };
}

describe("completePendingAccountDeletion — solo el marcador autoriza purgar", () => {
  it("sin marcador no toca nada (regla de sesión perdida intacta)", async () => {
    const s = fakeStorage({ profile: "p", "profile-owner": "user_1", "snapshot:user_1": "s" });
    assert.equal(await completePendingAccountDeletion(s.deps), "none");
    assert.deepEqual([...s.store.keys()].sort(), ["profile", "profile-owner", "snapshot:user_1"]);
  });

  it("con marcador purga todo (incluido el snapshot del dueño) y retira el marcador ÚLTIMO", async () => {
    const s = fakeStorage({
      marker: "user_1",
      profile: "p",
      "profile-owner": "user_1",
      saved: "[]",
      journal: "[]",
      "snapshot:user_1": "s"
    });
    assert.equal(await completePendingAccountDeletion(s.deps), "completed");
    assert.equal(s.store.size, 0);
  });

  it("si la purga vuelve a fallar queda 'pending' y el marcador sobrevive para el próximo arranque", async () => {
    const s = fakeStorage({ marker: "user_1", profile: "p" });
    s.failing.clears = true;
    assert.equal(await completePendingAccountDeletion(s.deps), "pending");
    assert.equal(s.store.get("marker"), "user_1");
  });
});

describe("regresión: Convex OK → Clerk OK → AsyncStorage falla → reinicio → limpieza completa", () => {
  it("el marcador sobrevive al fallo, el reinicio purga todo y la cuenta eliminada no deja rastro", async () => {
    const s = fakeStorage({ profile: "p", "profile-owner": "user_1", "snapshot:user_1": "s" });

    // Eliminación en vivo: los borrados remotos pasan, la limpieza local falla.
    s.failing.clears = true;
    const result = await runAccountDeletion({
      deleteConvexAccount: async () => ({ deleted: true as const }),
      markPendingCleanup: async () => {
        s.store.set("marker", "user_1");
      },
      deleteClerkUser: async () => {},
      clearLocalData: s.deps.clearLocalData,
      clearPendingCleanup: s.deps.clearMarker,
      goToEntry: () => {}
    });
    assert.deepEqual(result, { status: "success", localCleared: false });
    assert.equal(s.store.get("marker"), "user_1");
    assert.ok(s.store.has("profile"), "el perfil quedó huérfano en disco, esperando la purga");

    // Reinicio con el storage sano: SOLO el marcador autoriza completar la purga.
    s.failing.clears = false;
    assert.equal(await completePendingAccountDeletion(s.deps), "completed");
    // Sin perfil, sin dueño, sin snapshot y sin marcador: el arranque cae en la
    // entrada limpia — nunca en "iniciar sesión" de una cuenta que no existe.
    assert.equal(s.store.size, 0);
  });
});
