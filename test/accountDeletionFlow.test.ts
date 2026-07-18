import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completePendingAccountDeletion,
  finalizePendingDeletionPurge,
  requestAccountDeletion,
  resolvePendingDeletionBoot,
  runAccountDeletion,
  type AccountDeletionSteps,
  type PendingDeletionMarker
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
    markIdentityDeleted: async () => {
      calls.push("identity");
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

describe("runAccountDeletion — orden estricto Convex → marcador → Clerk → identidad → limpieza → entrada", () => {
  it("éxito completo respeta el orden y retira el marcador ÚLTIMO", async () => {
    const { calls, steps } = trackedSteps();
    const result = await runAccountDeletion(steps);
    assert.deepEqual(result, { status: "success", localCleared: true });
    assert.deepEqual(calls, ["convex", "marker", "clerk", "identity", "clear", "unmark", "entry"]);
  });

  it("el flujo completo con ambas confirmaciones también corre en orden", async () => {
    const { calls, steps } = trackedSteps();
    const result = await requestAccountDeletion({ confirmWarning: accept, confirmDestructive: accept }, steps);
    assert.equal(result.status, "success");
    assert.deepEqual(calls, ["convex", "marker", "clerk", "identity", "clear", "unmark", "entry"]);
  });

  it("la promoción a identity_deleted es best-effort: si falla, la limpieza sigue igual", async () => {
    const { calls, steps } = trackedSteps({
      markIdentityDeleted: async () => {
        throw new Error("storage flaky");
      }
    });
    const result = await runAccountDeletion(steps);
    assert.deepEqual(result, { status: "success", localCleared: true });
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
    assert.deepEqual(calls, ["convex", "marker", "convex", "marker", "clerk", "identity", "clear", "unmark", "entry"]);
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
    // Sin "unmark": el marcador (ya en identity_deleted) sobrevive y autoriza
    // la purga al arranque.
    assert.deepEqual(calls, ["convex", "marker", "clerk", "identity", "entry"]);
  });
});

// ---------------------------------------------------------------------------
// Arranque: purga por fase (review Codex — el marcador distingue Convex/Clerk)
// ---------------------------------------------------------------------------

// Storage falso: un Map con llaves de la app y fallas inyectables en los clears.
function fakeStorage(initial: Record<string, string> = {}, marker?: PendingDeletionMarker) {
  const store = new Map(Object.entries(initial));
  if (marker) store.set("marker", JSON.stringify(marker));
  const failing = { clears: false };
  const throwIfFailing = () => {
    if (failing.clears) throw new Error("storage down");
  };
  const readMarkerRaw = () => {
    const raw = store.get("marker");
    return raw ? (JSON.parse(raw) as PendingDeletionMarker) : null;
  };
  return {
    store,
    failing,
    readMarkerRaw,
    deps: {
      readMarker: async () => readMarkerRaw(),
      promoteMarker: async (next: PendingDeletionMarker) => {
        throwIfFailing();
        store.set("marker", JSON.stringify(next));
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

const LOCAL_DATA = {
  profile: "p",
  "profile-owner": "user_1",
  saved: "[]",
  journal: "[]",
  "snapshot:user_1": "s"
};

describe("completePendingAccountDeletion — solo identity_deleted purga en la hidratación", () => {
  it("sin marcador no toca nada (regla de sesión perdida intacta)", async () => {
    const s = fakeStorage(LOCAL_DATA);
    const result = await completePendingAccountDeletion(s.deps);
    assert.deepEqual(result, { status: "none", marker: null });
    assert.equal(s.store.size, Object.keys(LOCAL_DATA).length);
  });

  it("backend_deleted: NO purga, NO retira el marcador — la identidad puede seguir viva", async () => {
    const s = fakeStorage(LOCAL_DATA, { userId: "user_1", phase: "backend_deleted" });
    const result = await completePendingAccountDeletion(s.deps);
    assert.equal(result.status, "awaiting-identity");
    assert.deepEqual(result.marker, { userId: "user_1", phase: "backend_deleted" });
    // Todo intacto: datos locales Y marcador.
    assert.equal(s.store.size, Object.keys(LOCAL_DATA).length + 1);
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "backend_deleted" });
  });

  it("identity_deleted: purga todo (incluido el snapshot) y retira el marcador ÚLTIMO", async () => {
    const s = fakeStorage(LOCAL_DATA, { userId: "user_1", phase: "identity_deleted" });
    const result = await completePendingAccountDeletion(s.deps);
    assert.equal(result.status, "completed");
    assert.equal(s.store.size, 0);
  });

  it("identity_deleted con purga fallida queda 'pending' y el marcador sobrevive", async () => {
    const s = fakeStorage(LOCAL_DATA, { userId: "user_1", phase: "identity_deleted" });
    s.failing.clears = true;
    const result = await completePendingAccountDeletion(s.deps);
    assert.equal(result.status, "pending");
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "identity_deleted" });
  });
});

describe("resolvePendingDeletionBoot — nunca purgar a ciegas una fase anterior a Clerk", () => {
  const backendDeleted: PendingDeletionMarker = { userId: "user_1", phase: "backend_deleted" };
  it("sin marcador: proceed", () => {
    assert.equal(resolvePendingDeletionBoot({ marker: null, clerkLoaded: false, isSignedIn: false }), "proceed");
  });
  it("identity_deleted: purge directo (no depende de Clerk)", () => {
    assert.equal(
      resolvePendingDeletionBoot({
        marker: { userId: "user_1", phase: "identity_deleted" },
        clerkLoaded: false,
        isSignedIn: false
      }),
      "purge"
    );
  });
  it("backend_deleted sin Clerk cargado: wait (no tocar nada)", () => {
    assert.equal(resolvePendingDeletionBoot({ marker: backendDeleted, clerkLoaded: false, isSignedIn: false }), "wait");
  });
  it("backend_deleted con identidad activa: finalize-identity (bloquear y reintentar user.delete)", () => {
    assert.equal(
      resolvePendingDeletionBoot({ marker: backendDeleted, clerkLoaded: true, isSignedIn: true }),
      "finalize-identity"
    );
  });
  it("backend_deleted signed-out (crash después del delete): purge", () => {
    assert.equal(
      resolvePendingDeletionBoot({ marker: backendDeleted, clerkLoaded: true, isSignedIn: false }),
      "purge"
    );
  });
});

describe("regresión 1 (review): Clerk falla → reinicio con Clerk signed-in → no se purga ni se pierde la señal", () => {
  it("el marcador backend_deleted sobrevive intacto y la eliminación se puede completar después", async () => {
    const s = fakeStorage(LOCAL_DATA);

    // Eliminación en vivo: Convex OK, marcador OK, Clerk FALLA.
    const result = await runAccountDeletion({
      deleteConvexAccount: async () => ({ deleted: true as const }),
      markPendingCleanup: async () => {
        s.store.set("marker", JSON.stringify({ userId: "user_1", phase: "backend_deleted" }));
      },
      deleteClerkUser: async () => {
        throw new Error("clerk down");
      },
      markIdentityDeleted: async () => s.deps.promoteMarker({ userId: "user_1", phase: "identity_deleted" }),
      clearLocalData: s.deps.clearLocalData,
      clearPendingCleanup: s.deps.clearMarker,
      goToEntry: () => {
        throw new Error("no debe navegar con la identidad viva");
      }
    });
    assert.deepEqual(result, { status: "error", step: "clerk" });

    // Reinicio: Clerk todavía signed-in. La hidratación NO purga ni retira nada…
    const boot = await completePendingAccountDeletion(s.deps);
    assert.equal(boot.status, "awaiting-identity");
    assert.equal(s.store.has("profile"), true);
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "backend_deleted" });
    // …y el gate bloquea en "Finalizando eliminación" para reintentar Clerk.
    assert.equal(
      resolvePendingDeletionBoot({ marker: boot.marker, clerkLoaded: true, isSignedIn: true }),
      "finalize-identity"
    );

    // El reintento borra la identidad y recién entonces purga: sin rastro.
    await finalizePendingDeletionPurge(boot.marker!, s.deps);
    assert.equal(s.store.size, 0);
  });
});

describe("regresión 2 (review): crash después de borrar Clerk pero antes de limpiar → reinicio signed-out → purga completa", () => {
  it("backend_deleted + signed-out completa la purga (promueve primero, retira el marcador último)", async () => {
    // La app murió justo después de user.delete(): el marcador quedó en
    // backend_deleted y no hubo promoción ni limpieza.
    const s = fakeStorage(LOCAL_DATA, { userId: "user_1", phase: "backend_deleted" });

    const boot = await completePendingAccountDeletion(s.deps);
    assert.equal(boot.status, "awaiting-identity");
    // Clerk cargó signed-out: la identidad ya no existe → purge.
    assert.equal(
      resolvePendingDeletionBoot({ marker: boot.marker, clerkLoaded: true, isSignedIn: false }),
      "purge"
    );
    await finalizePendingDeletionPurge(boot.marker!, s.deps);
    // Sin perfil, sin dueño, sin snapshot y sin marcador: el arranque cae en
    // la entrada limpia — nunca en "iniciar sesión" de una cuenta eliminada.
    assert.equal(s.store.size, 0);
  });

  it("si la purga del gate muere a mitad, la promoción ya persistió y el próximo arranque termina solo", async () => {
    const s = fakeStorage(LOCAL_DATA, { userId: "user_1", phase: "backend_deleted" });

    // La promoción escribe identity_deleted y recién después falla la limpieza.
    let promoted = false;
    await assert.rejects(
      finalizePendingDeletionPurge(
        { userId: "user_1", phase: "backend_deleted" },
        {
          ...s.deps,
          promoteMarker: async (next) => {
            await s.deps.promoteMarker(next);
            promoted = true;
            s.failing.clears = true; // todo lo que sigue falla
          }
        }
      )
    );
    assert.equal(promoted, true);
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "identity_deleted" });

    // Próximo arranque con storage sano: la hidratación completa sola la purga.
    s.failing.clears = false;
    const boot = await completePendingAccountDeletion(s.deps);
    assert.equal(boot.status, "completed");
    assert.equal(s.store.size, 0);
  });
});

describe("regresión original: Convex OK → Clerk OK → AsyncStorage falla → reinicio → limpieza completa", () => {
  it("el marcador (ya identity_deleted) sobrevive al fallo y el reinicio purga sin rastro", async () => {
    const s = fakeStorage(LOCAL_DATA);

    // Eliminación en vivo: los borrados remotos pasan, la limpieza local falla
    // (la promoción a identity_deleted sí llegó a escribirse).
    const result = await runAccountDeletion({
      deleteConvexAccount: async () => ({ deleted: true as const }),
      markPendingCleanup: async () => {
        s.store.set("marker", JSON.stringify({ userId: "user_1", phase: "backend_deleted" }));
      },
      deleteClerkUser: async () => {},
      markIdentityDeleted: async () => s.deps.promoteMarker({ userId: "user_1", phase: "identity_deleted" }),
      clearLocalData: async () => {
        throw new Error("storage down");
      },
      clearPendingCleanup: s.deps.clearMarker,
      goToEntry: () => {}
    });
    assert.deepEqual(result, { status: "success", localCleared: false });
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "identity_deleted" });
    assert.ok(s.store.has("profile"), "el perfil quedó huérfano en disco, esperando la purga");

    // Reinicio con el storage sano: identity_deleted purga directo en la hidratación.
    const boot = await completePendingAccountDeletion(s.deps);
    assert.equal(boot.status, "completed");
    assert.equal(s.store.size, 0);
  });
});
