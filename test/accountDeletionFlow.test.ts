import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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
    deleteClerkUser: async () => {
      calls.push("clerk");
    },
    clearLocalData: async () => {
      calls.push("clear");
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

describe("runAccountDeletion — orden estricto Convex → Clerk → limpieza → entrada", () => {
  it("éxito completo respeta el orden y vuelve a la entrada sin datos locales", async () => {
    const { calls, steps } = trackedSteps();
    const result = await runAccountDeletion(steps);
    assert.deepEqual(result, { status: "success", localCleared: true });
    assert.deepEqual(calls, ["convex", "clerk", "clear", "entry"]);
  });

  it("el flujo completo con ambas confirmaciones también corre en orden", async () => {
    const { calls, steps } = trackedSteps();
    const result = await requestAccountDeletion({ confirmWarning: accept, confirmDestructive: accept }, steps);
    assert.equal(result.status, "success");
    assert.deepEqual(calls, ["convex", "clerk", "clear", "entry"]);
  });
});

describe("runAccountDeletion — un error conserva la sesión (nunca simular éxito)", () => {
  it("Convex falla: no se toca Clerk, ni lo local, ni se navega", async () => {
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

  it("Clerk falla: Convex ya corrió (idempotente para el reintento), pero NO se limpia ni se navega", async () => {
    const { calls, steps } = trackedSteps({
      deleteClerkUser: async () => {
        throw new Error("clerk down");
      }
    });
    const result = await runAccountDeletion(steps);
    assert.deepEqual(result, { status: "error", step: "clerk" });
    assert.deepEqual(calls, ["convex"]);
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
    assert.deepEqual(calls, ["convex", "convex", "clerk", "clear", "entry"]);
  });
});

describe("runAccountDeletion — limpieza local", () => {
  it("un fallo al limpiar no bloquea la salida (la cuenta ya no existe) y queda reportado", async () => {
    const { calls, steps } = trackedSteps({
      clearLocalData: async () => {
        throw new Error("storage down");
      }
    });
    const result = await runAccountDeletion(steps);
    assert.deepEqual(result, { status: "success", localCleared: false });
    assert.deepEqual(calls, ["convex", "clerk", "entry"]);
  });
});
