import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ROOT } from "./moduleGraph";
import {
  attemptPendingDeletionFinalize,
  bootGateSurface,
  esOwnerCanonico,
  finalizePendingDeletionPurge,
  identityDeleteAuthorized,
  inspectPendingAccountDeletion,
  parsePendingDeletionMarker,
  requestAccountDeletion,
  resolvePendingDeletionBoot,
  pendingDeletionRecovery,
  runAccountDeletion,
  runGuardedPendingDeletionPurge,
  type AccountDeletionSteps,
  type PendingDeletionBootDecision,
  type PendingDeletionMarker
} from "../src/domain/accountDeletion";

/**
 * `attemptPendingDeletionFinalize` con los pasos que el caso no mide cableados a
 * un fallo ruidoso: si un test los toca sin querer, se entera.
 */
function finalizar(args: {
  decision: PendingDeletionBootDecision;
  deleteBackendAccount?: () => Promise<void>;
  promoteBackendDeleted?: () => Promise<void>;
  deleteIdentity?: () => Promise<void>;
  promoteIdentityDeleted?: () => Promise<void>;
  purge?: () => Promise<void>;
}) {
  return attemptPendingDeletionFinalize({
    decision: args.decision,
    deleteBackendAccount:
      args.deleteBackendAccount ??
      (async () => {
        throw new Error("no debe tocar Convex");
      }),
    promoteBackendDeleted: args.promoteBackendDeleted ?? (async () => undefined),
    deleteIdentity:
      args.deleteIdentity ??
      (async () => {
        throw new Error("no debe tocar Clerk");
      }),
    promoteIdentityDeleted: args.promoteIdentityDeleted ?? (async () => undefined),
    purge:
      args.purge ??
      (async () => {
        throw new Error("no debe purgar");
      })
  });
}

// Registra el orden real de ejecución de cada paso.
function trackedSteps(overrides: Partial<AccountDeletionSteps> = {}) {
  const calls: string[] = [];
  const steps: AccountDeletionSteps = {
    ownerUserId: "user_1",
    markDeletionRequested: async () => {
      calls.push("marker");
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

/**
 * A1 — la pantalla NO borra nada: deja la intención escrita y se aparta.
 *
 * La mutación destructiva de Convex salía del Perfil, con la app entera
 * montada. Entre la segunda confirmación y esa llamada hay awaits largos: Clerk
 * podía entregar otra sesión, así que el camino FELIZ mismo era una carrera
 * A → B. Y si el proceso moría en ese hueco, no quedaba nada en disco diciendo
 * que esta cuenta se estaba borrando. Ahora la pantalla escribe
 * `deletion_requested` y devuelve `handoff`.
 */
describe("runAccountDeletion — sólo persiste la intención y entrega el control", () => {
  it("el camino feliz termina en `handoff` con la fase PREVIA a todo borrado", async () => {
    const { calls, steps } = trackedSteps();
    const result = await runAccountDeletion(steps);
    assert.deepEqual(result, {
      status: "handoff",
      marker: { userId: "user_1", phase: "deletion_requested" }
    });
    assert.deepEqual(calls, ["marker"]);
  });

  it("REPRO: NINGÚN paso destructivo se le puede pasar a la pantalla", () => {
    // El tipo es la garantía: `AccountDeletionSteps` sólo declara el dueño y la
    // marca. Convex, Clerk, el checkpoint, la limpieza y la navegación viven en
    // el boundary, con el producto desmontado.
    const { steps } = trackedSteps();
    assert.deepEqual(Object.keys(steps).sort(), ["markDeletionRequested", "ownerUserId"]);
    const dominio = readFileSync(join(ROOT, "src/domain/accountDeletion.ts"), "utf8");
    const inicio = dominio.indexOf("export type AccountDeletionSteps");
    const cuerpo = dominio.slice(inicio, dominio.indexOf("};", inicio));
    for (const retirado of [
      "deleteConvexAccount",
      "deleteClerkUser",
      "markIdentityDeleted",
      "clearLocalData",
      "clearPurchaseGuard",
      "clearPendingCleanup",
      "goToEntry"
    ]) {
      assert.equal(cuerpo.includes(retirado), false, `${retirado} no puede volver a la pantalla`);
    }
  });

  it("sin dueño no se escribe NADA", async () => {
    // El marcador es por cuenta. Sin dueño no hay nada que atribuir después.
    const { calls, steps } = trackedSteps({ ownerUserId: "" });
    assert.deepEqual(await runAccountDeletion(steps), { status: "error", step: "marker" });
    assert.deepEqual(calls, []);
  });

  it("un dueño de espacios en blanco tampoco alcanza", async () => {
    const { calls, steps } = trackedSteps({ ownerUserId: "   " });
    assert.deepEqual(await runAccountDeletion(steps), { status: "error", step: "marker" });
    assert.deepEqual(calls, []);
  });

  it("el flujo completo con ambas confirmaciones también entrega el control", async () => {
    const { calls, steps } = trackedSteps();
    const result = await requestAccountDeletion({ confirmWarning: accept, confirmDestructive: accept }, steps);
    assert.equal(result.status, "handoff");
    assert.deepEqual(calls, ["marker"]);
  });
});

describe("runAccountDeletion — un error deja todo como estaba", () => {
  it("el marcador no se puede escribir: no se entrega el control y NADA se borró", async () => {
    const { steps } = trackedSteps({
      markDeletionRequested: async () => {
        throw new Error("storage down");
      }
    });
    const result = await runAccountDeletion(steps);
    assert.deepEqual(result, { status: "error", step: "marker" });
  });

  it("el reintento vuelve a intentarlo", async () => {
    let intentos = 0;
    const { calls, steps } = trackedSteps({
      markDeletionRequested: async () => {
        intentos += 1;
        if (intentos === 1) throw new Error("storage down");
        calls.push("marker");
      }
    });
    assert.deepEqual(await runAccountDeletion(steps), { status: "error", step: "marker" });
    assert.equal((await runAccountDeletion(steps)).status, "handoff");
    assert.deepEqual(calls, ["marker"]);
  });
});

/**
 * A2 — el marcador entregado es exactamente lo que consume el boundary.
 */
describe("handoff → boundary: la secuencia completa, una fase por vez", () => {
  it("requested → backend → identity → purga, y nada se adelanta", async () => {
    const s = fakeStorage({ ...LOCAL_DATA, "purchase-guard:user_1": "{}" });
    const { steps } = trackedSteps({
      markDeletionRequested: async () => {
        s.store.set("marker", JSON.stringify({ userId: "user_1", phase: "deletion_requested" }));
      }
    });
    const result = await runAccountDeletion(steps);
    assert.equal(result.status, "handoff");
    const marker = result.status === "handoff" ? result.marker : null;
    assert.ok(marker);
    assert.equal(marker?.phase, "deletion_requested");

    // Mientras el marcador viva, OTRA cuenta no entra ni por casualidad.
    assert.equal(
      resolvePendingDeletionBoot({
        marker,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_b"
      }),
      "blocked"
    );

    // 1. Con la sesión de A: recién acá sale la mutación de Convex.
    assert.equal(
      resolvePendingDeletionBoot({
        marker,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_1"
      }),
      "delete-backend"
    );
    let borradosEnConvex = 0;
    assert.equal(
      await finalizar({
        decision: "delete-backend",
        deleteBackendAccount: async () => {
          borradosEnConvex += 1;
        },
        promoteBackendDeleted: () =>
          s.deps.promoteMarker({ userId: "user_1", phase: "backend_deleted" })
      }),
      "backend-deleted"
    );
    assert.equal(borradosEnConvex, 1);
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "backend_deleted" });
    assert.ok(s.store.has("profile"), "nada local se tocó todavía");

    // 2. Recién con la fase escrita se borra la identidad.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: s.readMarkerRaw(),
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_1"
      }),
      "finalize-identity"
    );
    assert.equal(
      await finalizar({
        decision: "finalize-identity",
        deleteIdentity: async () => undefined,
        promoteIdentityDeleted: () =>
          s.deps.promoteMarker({ userId: "user_1", phase: "identity_deleted" })
      }),
      "identity-deleted"
    );
    assert.ok(s.store.has("profile"), "y sigue sin tocarse nada local");

    // 3. Recién con Clerk signed-out se purga.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: s.readMarkerRaw(),
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null
      }),
      "purge"
    );
    await finalizePendingDeletionPurge(s.readMarkerRaw()!, s.deps);
    assert.equal(s.store.size, 0);
    assert.equal(s.readMarkerRaw(), null);
  });

  it("REPRO crash entre Convex y la fase: `deletion_requested` sobrevive y se reintenta", async () => {
    // Convex ya borró pero el disco no lo pudo anotar. La mutation es
    // idempotente, así que el reintento vuelve a llamarla sin daño — y NUNCA se
    // avanza a borrar Clerk sin la fase escrita.
    const s = fakeStorage(LOCAL_DATA, { userId: "user_1", phase: "deletion_requested" });
    let llamadas = 0;
    assert.equal(
      await finalizar({
        decision: "delete-backend",
        deleteBackendAccount: async () => {
          llamadas += 1;
        },
        promoteBackendDeleted: async () => {
          throw new Error("storage down");
        }
      }),
      "error"
    );
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "deletion_requested" });
    // El reintento: misma decisión, mutation otra vez, ahora sí se anota.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: s.readMarkerRaw(),
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_1"
      }),
      "delete-backend"
    );
    assert.equal(
      await finalizar({
        decision: "delete-backend",
        deleteBackendAccount: async () => {
          llamadas += 1;
        },
        promoteBackendDeleted: () =>
          s.deps.promoteMarker({ userId: "user_1", phase: "backend_deleted" })
      }),
      "backend-deleted"
    );
    assert.equal(llamadas, 2, "idempotente: llamarla dos veces es seguro");
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "backend_deleted" });
  });

  it("`deletion_requested` + signed-out exige login del dueño; B queda bloqueada", () => {
    const marker: PendingDeletionMarker = { userId: "user_a", phase: "deletion_requested" };
    assert.equal(
      resolvePendingDeletionBoot({
        marker,
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null
      }),
      "needs-owner"
    );
    assert.equal(
      pendingDeletionRecovery({
        decision: "needs-owner",
        attemptFailed: false,
        markerUnreadable: false
      }),
      "sign-in-owner"
    );
    // Y con B viva: cero destructivos.
    assert.equal(
      resolvePendingDeletionBoot({
        marker,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_b"
      }),
      "blocked"
    );
  });
});

// ---------------------------------------------------------------------------
// Arranque: purga por fase (review Codex — el marcador distingue Convex/Clerk)
// ---------------------------------------------------------------------------

// Storage falso: un Map con llaves de la app y fallas inyectables en los clears.
function fakeStorage(initial: Record<string, string> = {}, marker?: PendingDeletionMarker) {
  const store = new Map(Object.entries(initial));
  if (marker) store.set("marker", JSON.stringify(marker));
  // `guard` es su propia falla inyectable: el marcador de compra en vuelo es el
  // paso que faltaba, y lo que hay que poder probar es que su fallo CONSERVA el
  // marcador de eliminación.
  const failing = { clears: false, guard: false, read: false };
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
      // La lectura pasa por el parser REAL: lo que el arranque ve es
      // exactamente lo que produciría `readPendingAccountDeletion`.
      readMarker: async () => {
        if (failing.read) throw new Error("storage down");
        return parsePendingDeletionMarker(store.get("marker") ?? null);
      },
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
      clearPurchaseGuard: async (userId: string) => {
        throwIfFailing();
        if (failing.guard) throw new Error("purchase guard storage down");
        store.delete(`purchase-guard:${userId}`);
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

/**
 * A — la hidratación NO purga. Nunca, en ninguna fase.
 *
 * El P0: `identity_deleted` se purgaba acá, dentro de `useAppState`, ANTES de
 * saber quién está logueado. Con un marcador de A y la sesión persistida de B,
 * los datos locales que se borraban eran los de B. Ahora la hidratación sólo lee
 * y valida; todo lo destructivo vive en el gate, con Clerk cargado y el dueño
 * verificado.
 */
describe("inspectPendingAccountDeletion — la hidratación sólo lee (A)", () => {
  /** Toda operación destructiva del storage falso, con contador. */
  function espiar(s: ReturnType<typeof fakeStorage>) {
    const destructivas: string[] = [];
    const original = { ...s.deps };
    s.deps.clearLocalData = async () => {
      destructivas.push("clearLocalData");
      return original.clearLocalData();
    };
    s.deps.clearAccountSnapshot = async (userId: string) => {
      destructivas.push("clearAccountSnapshot");
      return original.clearAccountSnapshot(userId);
    };
    s.deps.clearPurchaseGuard = async (userId: string) => {
      destructivas.push("clearPurchaseGuard");
      return original.clearPurchaseGuard(userId);
    };
    s.deps.clearMarker = async () => {
      destructivas.push("clearMarker");
      return original.clearMarker();
    };
    return destructivas;
  }

  it("sin marcador no toca nada (regla de sesión perdida intacta)", async () => {
    const s = fakeStorage(LOCAL_DATA);
    const result = await inspectPendingAccountDeletion(s.deps);
    assert.deepEqual(result, { status: "none", marker: null });
    assert.equal(s.store.size, Object.keys(LOCAL_DATA).length);
  });

  it("backend_deleted: entrega el marcador y no toca nada", async () => {
    const s = fakeStorage(LOCAL_DATA, { userId: "user_1", phase: "backend_deleted" });
    const destructivas = espiar(s);
    const result = await inspectPendingAccountDeletion(s.deps);
    assert.deepEqual(result, {
      status: "pending",
      marker: { userId: "user_1", phase: "backend_deleted" }
    });
    assert.deepEqual(destructivas, []);
    assert.equal(s.store.size, Object.keys(LOCAL_DATA).length + 1);
  });

  it("REPRO: identity_deleted TAMPOCO purga en la hidratación", async () => {
    const s = fakeStorage({ ...LOCAL_DATA, "purchase-guard:user_1": "{}" }, {
      userId: "user_1",
      phase: "identity_deleted"
    });
    const destructivas = espiar(s);
    const antes = s.store.size;
    const result = await inspectPendingAccountDeletion(s.deps);
    assert.deepEqual(result, {
      status: "pending",
      marker: { userId: "user_1", phase: "identity_deleted" }
    });
    assert.deepEqual(destructivas, [], "cero clears antes de conocer a Clerk");
    assert.equal(s.store.size, antes, "nada se borró");
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "identity_deleted" });
  });

  it("un marcador ilegible bloquea el arranque sin borrarlo", async () => {
    for (const [raw, reason] of [
      ["", "empty"],
      ["   ", "empty"],
      ["{no json", "unparsable"],
      ['{"phase":"identity_deleted"}', "incomplete"],
      ['{"userId":"","phase":"backend_deleted"}', "incomplete"],
      ['{"userId":"user_1","phase":"vaporizada"}', "unknown-phase"]
    ] as const) {
      const s = fakeStorage(LOCAL_DATA);
      s.store.set("marker", raw);
      const destructivas = espiar(s);
      assert.deepEqual(
        await inspectPendingAccountDeletion(s.deps),
        { status: "blocked", marker: null, reason },
        raw
      );
      assert.deepEqual(destructivas, [], raw);
      assert.equal(s.store.get("marker"), raw, "el raw inválido se conserva");
      assert.equal(s.store.has("profile"), true, "no se publican ni se borran datos locales");
    }
  });

  it("una lectura que TIRA bloquea: nunca se confunde con ausencia", async () => {
    const s = fakeStorage(LOCAL_DATA, { userId: "user_1", phase: "backend_deleted" });
    const destructivas = espiar(s);
    s.failing.read = true;
    assert.deepEqual(await inspectPendingAccountDeletion(s.deps), {
      status: "blocked",
      marker: null,
      reason: "unreadable"
    });
    assert.deepEqual(destructivas, []);
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "backend_deleted" });
  });

  it("REPRO A→B: identity_deleted de A, Clerk sin cargar, después B, después signed-out", async () => {
    // El teléfono tiene lo compartido de A —perfil activo, guardadas, diario— y
    // ADEMÁS el snapshot archivado de B, que se logueó acá alguna vez. El
    // marcador es de A: la purga se lleva lo de A y no puede tocar lo de B.
    const CON_SNAPSHOT_AJENO = {
      profile: "p",
      "profile-owner": "user_a",
      saved: "[]",
      journal: "[]",
      "snapshot:user_a": "a",
      "purchase-guard:user_a": "{}",
      "snapshot:user_b": "b"
    };
    const s = fakeStorage(CON_SNAPSHOT_AJENO, { userId: "user_a", phase: "identity_deleted" });
    const destructivas = espiar(s);
    const boot = await inspectPendingAccountDeletion(s.deps);
    assert.equal(boot.status, "pending");
    const marker = boot.marker;

    // 1. Clerk todavía sin cargar: se espera. CERO clears.
    assert.equal(
      resolvePendingDeletionBoot({ marker, clerkLoaded: false, isSignedIn: false }),
      "wait"
    );
    // 2. Clerk carga y resulta ser B: bloqueado. CERO clears.
    assert.equal(
      resolvePendingDeletionBoot({
        marker,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_b"
      }),
      "blocked"
    );
    assert.deepEqual(destructivas, [], "nada se borró mientras el dueño no estuvo claro");
    assert.equal(s.store.size, Object.keys(CON_SNAPSHOT_AJENO).length + 1, "nada se tocó con B activa");
    assert.equal(s.store.has("profile"), true);
    assert.equal(s.store.get("snapshot:user_b"), "b");

    // 3. B se va: recién ahí se purga lo de A.
    assert.equal(
      resolvePendingDeletionBoot({ marker, clerkLoaded: true, isSignedIn: false, currentUserId: null }),
      "purge"
    );
    await finalizePendingDeletionPurge(marker!, s.deps);

    // Lo de A no queda ni rastro: ni el marcador, ni lo compartido, ni su
    // snapshot, ni su marcador de compra.
    assert.equal(s.readMarkerRaw(), null);
    for (const clave of [
      "profile",
      "profile-owner",
      "saved",
      "journal",
      "snapshot:user_a",
      "purchase-guard:user_a"
    ]) {
      assert.equal(s.store.has(clave), false, `${clave} tenía que salir con la cuenta de A`);
    }
    // Y el archivo de B sigue intacto: la eliminación de una cuenta no puede
    // llevarse por delante los datos de otra persona guardados en el teléfono.
    assert.deepEqual([...s.store.entries()], [["snapshot:user_b", "b"]]);
  });

  it("regresión (review r3): con el marcador vivo el gate SE MONTA, nunca arranque normal", async () => {
    const s = fakeStorage(LOCAL_DATA, { userId: "user_1", phase: "identity_deleted" });
    const boot = await inspectPendingAccountDeletion(s.deps);
    assert.equal(boot.status, "pending");
    assert.deepEqual(boot.marker, { userId: "user_1", phase: "identity_deleted" });

    // La purga falla: el marcador sobrevive y el gate muestra reintento.
    s.failing.clears = true;
    assert.equal(
      await finalizar({
        decision: "purge",
        purge: () => finalizePendingDeletionPurge(boot.marker!, s.deps)
      }),
      "error"
    );
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "identity_deleted" });

    // REINTENTAR (storage recuperado) completa la purga; recién ahí se sigue.
    s.failing.clears = false;
    assert.equal(
      await finalizar({
        decision: "purge",
        purge: () => finalizePendingDeletionPurge(boot.marker!, s.deps)
      }),
      "completed"
    );
    assert.equal(s.store.size, 0);
  });
});

/**
 * B — el parser distingue CINCO cosas, y ninguna se normaliza.
 */
describe("parsePendingDeletionMarker — ausencia, basura y marcador son cosas distintas", () => {
  it("sólo `null` es ausencia", () => {
    assert.deepEqual(parsePendingDeletionMarker(null), { status: "absent" });
    assert.deepEqual(parsePendingDeletionMarker(undefined), { status: "absent" });
  });

  it("acepta EXACTAMENTE las dos fases con dueño no vacío", () => {
    for (const phase of ["backend_deleted", "identity_deleted"] as const) {
      assert.deepEqual(parsePendingDeletionMarker(JSON.stringify({ userId: "user_1", phase })), {
        status: "valid",
        marker: { userId: "user_1", phase }
      });
    }
  });

  it("REPRO: la basura NO se normaliza a backend_deleted ni a ausencia", () => {
    const casos: ReadonlyArray<readonly [string, string]> = [
      ["", "empty"],
      ["\n\t ", "empty"],
      ["{", "unparsable"],
      ["no-json", "unparsable"],
      ["null", "incomplete"],
      ["[]", "incomplete"],
      ['"user_1"', "incomplete"],
      ["{}", "incomplete"],
      ['{"phase":"backend_deleted"}', "incomplete"],
      ['{"userId":"","phase":"backend_deleted"}', "incomplete"],
      ['{"userId":123,"phase":"backend_deleted"}', "incomplete"],
      ['{"userId":"user_1"}', "unknown-phase"],
      ['{"userId":"user_1","phase":"BACKEND_DELETED"}', "unknown-phase"],
      ['{"userId":"user_1","phase":null}', "unknown-phase"]
    ];
    for (const [raw, reason] of casos) {
      assert.deepEqual(parsePendingDeletionMarker(raw), { status: "invalid", reason }, raw);
    }
  });

  it("nada de lo inválido llega a autorizar una decisión", () => {
    // Cierra el círculo: lo que el parser rechaza no puede volverse un marcador
    // que el gate acepte.
    for (const raw of ["{", "{}", '{"userId":"user_1","phase":"vaporizada"}']) {
      const read = parsePendingDeletionMarker(raw);
      assert.equal(read.status, "invalid");
      assert.equal(
        resolvePendingDeletionBoot({
          marker: null,
          markerUnreadable: true,
          clerkLoaded: true,
          isSignedIn: true,
          currentUserId: "user_1"
        }),
        "blocked",
        raw
      );
    }
  });

  it("el storage delega en el parser y no puede escribir un marcador inválido", () => {
    const storage = readFileSync(join(ROOT, "src/services/storage.ts"), "utf8");
    assert.match(storage, /parsePendingDeletionMarker\(await AsyncStorage\.getItem\(/);
    // Y ya no queda la normalización vieja.
    assert.doesNotMatch(storage, /phase: parsed\?\.phase === "identity_deleted"/);
    assert.match(storage, /PENDING_DELETION_OWNER_REQUIRED/);
    assert.match(storage, /PENDING_DELETION_PHASE_INVALID/);
  });
});

/**
 * El borrado de identidad y la purga son DOS vueltas del gate, no una.
 *
 * Eran una sola: `deleteUser()` y a continuación la purga. Pero `user.delete()`
 * responde ok mucho antes de que el SDK deje de publicar `isSignedIn`, así que
 * esa purga corría con la sesión de A todavía viva. Ahora el primer intento sólo
 * persiste `identity_deleted` y para; la purga la decide la vuelta siguiente,
 * con Clerk ya signed-out.
 */
describe("attemptPendingDeletionFinalize — borrar la identidad no purga", () => {
  it("finalize-identity persiste la fase y PARA, aunque Clerk siga publicando la sesión", async () => {
    const s = fakeStorage(LOCAL_DATA, { userId: "user_1", phase: "backend_deleted" });
    let signedIn = true;
    let deleteIdentityCalls = 0;
    let purgas = 0;

    const decision1 = resolvePendingDeletionBoot({
      marker: s.readMarkerRaw(),
      clerkLoaded: true,
      isSignedIn: signedIn,
      currentUserId: "user_1"
    });
    assert.equal(decision1, "finalize-identity");
    assert.equal(
      await finalizar({
        decision: decision1,
        deleteIdentity: async () => {
          deleteIdentityCalls += 1;
        },
        promoteIdentityDeleted: () =>
          s.deps.promoteMarker({ userId: "user_1", phase: "identity_deleted" }),
        purge: async () => {
          purgas += 1;
        }
      }),
      "identity-deleted"
    );
    assert.equal(deleteIdentityCalls, 1);
    assert.equal(purgas, 0, "REPRO: no se purga con la sesión todavía publicada");
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "identity_deleted" });

    // Con la sesión todavía viva la decisión es ESPERAR, no purgar.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: s.readMarkerRaw(),
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_1"
      }),
      "wait"
    );

    // Clerk publica signed-out: recién ahí se purga, y sin repetir user.delete().
    signedIn = false;
    const decision2 = resolvePendingDeletionBoot({
      marker: s.readMarkerRaw(),
      clerkLoaded: true,
      isSignedIn: signedIn,
      currentUserId: null
    });
    assert.equal(decision2, "purge");
    assert.equal(
      await finalizar({
        decision: decision2,
        purge: () => finalizePendingDeletionPurge(s.readMarkerRaw()!, s.deps)
      }),
      "completed"
    );
    assert.equal(deleteIdentityCalls, 1, "el retry no debe repetir user.delete()");
    assert.equal(s.store.size, 0);
  });

  it("si la promoción falla DESPUÉS de borrar la identidad: `checkpoint-pending`, no `error`", async () => {
    // La diferencia importa: `error` haría reintentar el flujo entero —o pedir
    // login a una identidad que ya no existe—. `checkpoint-pending` dice
    // exactamente qué pasó: el borrado ocurrió, falta escribirlo.
    const s = fakeStorage(LOCAL_DATA, { userId: "user_1", phase: "backend_deleted" });
    assert.equal(
      await finalizar({
        decision: "finalize-identity",
        deleteIdentity: async () => undefined,
        promoteIdentityDeleted: async () => {
          throw new Error("storage down");
        }
      }),
      "checkpoint-pending"
    );
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "backend_deleted" });
  });

  it("si falla el BORRADO de la identidad sí es `error`: no hay nada que retener", async () => {
    const s = fakeStorage(LOCAL_DATA, { userId: "user_1", phase: "backend_deleted" });
    let promociones = 0;
    assert.equal(
      await finalizar({
        decision: "finalize-identity",
        deleteIdentity: async () => {
          throw new Error("clerk down");
        },
        promoteIdentityDeleted: async () => {
          promociones += 1;
        }
      }),
      "error"
    );
    assert.equal(promociones, 0);
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "backend_deleted" });
  });

  it("decisiones que no operan devuelven 'noop' sin tocar nada", async () => {
    for (const decision of ["proceed", "wait", "blocked", "needs-owner"] as const) {
      assert.equal(await finalizar({ decision }), "noop");
    }
  });
});

describe("resolvePendingDeletionBoot — nunca purgar a ciegas una fase anterior a Clerk", () => {
  const backendDeleted: PendingDeletionMarker = { userId: "user_1", phase: "backend_deleted" };
  it("sin marcador: proceed", () => {
    assert.equal(resolvePendingDeletionBoot({ marker: null, clerkLoaded: false, isSignedIn: false }), "proceed");
  });
  it("REPRO: identity_deleted SIN Clerk cargado espera, no purga", () => {
    // Purgar acá borraba los datos locales de quien estuviera logueado —que
    // todavía no se sabe quién es—. Ahora nada se decide sin Clerk.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: { userId: "user_1", phase: "identity_deleted" },
        clerkLoaded: false,
        isSignedIn: false
      }),
      "wait"
    );
  });

  it("identity_deleted con Clerk cargado y sin sesión: purge", () => {
    assert.equal(
      resolvePendingDeletionBoot({
        marker: { userId: "user_1", phase: "identity_deleted" },
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null
      }),
      "purge"
    );
  });

  it("auth contradictorio (signed-out con userId publicado): blocked", () => {
    assert.equal(
      resolvePendingDeletionBoot({
        marker: backendDeleted,
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: "user_1"
      }),
      "blocked"
    );
  });

  it("un raw ilegible bloquea aunque no haya marcador parseado", () => {
    assert.equal(
      resolvePendingDeletionBoot({
        marker: null,
        markerUnreadable: true,
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null
      }),
      "blocked"
    );
  });
  it("backend_deleted sin Clerk cargado: wait (no tocar nada)", () => {
    assert.equal(resolvePendingDeletionBoot({ marker: backendDeleted, clerkLoaded: false, isSignedIn: false }), "wait");
  });
  it("backend_deleted con la identidad activa DEL MISMO dueño: finalize-identity", () => {
    assert.equal(
      resolvePendingDeletionBoot({
        marker: backendDeleted,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_1"
      }),
      "finalize-identity"
    );
  });
  it("REPRO: backend_deleted signed-out NO purga — signed-out no prueba nada", () => {
    // Estar sin sesión puede ser un token expirado, un logout o una app sin red.
    // Purgar acá borraba los datos locales de una cuenta que quizás sigue
    // existiendo, y encima retiraba el marcador: se perdía la señal para
    // terminar la eliminación de verdad.
    assert.equal(
      resolvePendingDeletionBoot({ marker: backendDeleted, clerkLoaded: true, isSignedIn: false }),
      "needs-owner"
    );
    assert.equal(
      resolvePendingDeletionBoot({
        marker: backendDeleted,
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null
      }),
      "needs-owner"
    );
  });

  it("identity_deleted con la sesión del MISMO dueño todavía viva: wait", () => {
    // `user.delete()` responde ok antes de que el SDK deje de publicar la
    // sesión. Purgar en esa ventana borraba datos con una sesión viva encima.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: { userId: "user_1", phase: "identity_deleted" },
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_1"
      }),
      "wait"
    );
  });

  it("`needs-owner` no ejecuta nada, y la salida ofrecida es volver a entrar", () => {
    assert.equal(
      pendingDeletionRecovery({
        decision: "needs-owner",
        attemptFailed: false,
        markerUnreadable: false
      }),
      "sign-in-owner"
    );
    // Otra cuenta viva: lo único que destraba es cerrar ESA sesión.
    assert.equal(
      pendingDeletionRecovery({ decision: "blocked", attemptFailed: false, markerUnreadable: false }),
      "sign-out-other"
    );
    // Un marcador que no se puede atribuir no tiene reintento útil.
    assert.equal(
      pendingDeletionRecovery({ decision: "blocked", attemptFailed: true, markerUnreadable: true }),
      "support"
    );
    // Un fallo de storage/red sí: reintentar relee el disco.
    assert.equal(
      pendingDeletionRecovery({ decision: "purge", attemptFailed: true, markerUnreadable: false }),
      "retry"
    );
    // Y mientras el gate trabaja no se ofrece nada.
    assert.equal(
      pendingDeletionRecovery({ decision: "wait", attemptFailed: false, markerUnreadable: false }),
      "none"
    );
  });

  it("un dueño de espacios en blanco no es un dueño", () => {
    for (const userId of ["   ", "\t", "\n"]) {
      assert.equal(
        resolvePendingDeletionBoot({
          marker: { userId, phase: "backend_deleted" },
          clerkLoaded: true,
          isSignedIn: true,
          currentUserId: userId
        }),
        "blocked",
        JSON.stringify(userId)
      );
    }
  });

  it("REPRO dueño con padding: se BLOQUEA, no se canonicaliza en silencio", () => {
    // Recortar " user_a " para que "funcione" sería adivinar de quién es un
    // marcador roto y usar esa adivinanza para autorizar una purga.
    for (const userId of [" user_a", "user_a ", "\tuser_a\n"]) {
      assert.equal(esOwnerCanonico(userId), false, JSON.stringify(userId));
      // El parser lo rechaza…
      assert.deepEqual(
        parsePendingDeletionMarker(JSON.stringify({ userId, phase: "identity_deleted" })),
        { status: "invalid", reason: "incomplete" },
        JSON.stringify(userId)
      );
      // …y aunque llegara ya construido, el resolver tampoco lo acepta —ni
      // siquiera contra la sesión que "coincidiría" recortada.
      for (const phase of ["deletion_requested", "backend_deleted", "identity_deleted"] as const) {
        assert.equal(
          resolvePendingDeletionBoot({
            marker: { userId, phase },
            clerkLoaded: true,
            isSignedIn: true,
            currentUserId: "user_a"
          }),
          "blocked",
          `${phase}/${JSON.stringify(userId)}`
        );
        // Y sin sesión tampoco purga: cero clears.
        assert.equal(
          resolvePendingDeletionBoot({
            marker: { userId, phase },
            clerkLoaded: true,
            isSignedIn: false,
            currentUserId: null
          }),
          "blocked",
          `${phase}/${JSON.stringify(userId)} sin sesión`
        );
      }
    }
    // El canónico sí pasa.
    assert.equal(esOwnerCanonico("user_a"), true);
  });

  it("el writer aplica la MISMA regla que el parser", () => {
    const storage = readFileSync(join(ROOT, "src/services/storage.ts"), "utf8");
    assert.match(storage, /if \(!esOwnerCanonico\(userId\)\) \{/);
    assert.match(storage, /PENDING_DELETION_OWNER_REQUIRED/);
    // Lo que no se puede leer tampoco se puede escribir: si el writer aceptara
    // padding, dejaría el arranque bloqueado por un raw generado por nosotros.
    assert.equal(
      /userId\.trim\(\)\.length === 0/.test(storage),
      false,
      "la regla vieja aceptaba padding"
    );
  });
});

/**
 * P0 — el gate borraba la cuenta EQUIVOCADA.
 *
 * `resolvePendingDeletionBoot` sólo miraba `isSignedIn`: con un marcador de A y
 * Clerk logueado como B devolvía `finalize-identity`, y la ruta llamaba
 * `auth.deleteUser()` sobre la sesión viva. Y un marcador corrupto —que se
 * normaliza a `userId: ""` con fase `backend_deleted`— caía en la misma rama.
 */
describe("P0 — el marcador sólo autoriza a tocar SU propia cuenta", () => {
  const deA: PendingDeletionMarker = { userId: "user_a", phase: "backend_deleted" };

  it("REPRO A→B: marcador de A con sesión de B NO borra la identidad", () => {
    assert.equal(
      resolvePendingDeletionBoot({
        marker: deA,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_b"
      }),
      "blocked"
    );
  });

  it("con sesión viva pero sin id verificable tampoco: falla cerrado", () => {
    for (const currentUserId of [null, undefined, ""]) {
      assert.equal(
        resolvePendingDeletionBoot({
          marker: deA,
          clerkLoaded: true,
          isSignedIn: true,
          currentUserId
        }),
        "blocked",
        String(currentUserId)
      );
    }
  });

  it("REPRO marcador corrupto: userId vacío nunca purga ni borra identidad", () => {
    for (const phase of ["backend_deleted", "identity_deleted"] as const) {
      for (const userId of ["", undefined as unknown as string]) {
        assert.equal(
          resolvePendingDeletionBoot({
            marker: { userId, phase },
            clerkLoaded: true,
            isSignedIn: true,
            currentUserId: "user_b"
          }),
          "blocked",
          `${phase}/${JSON.stringify(userId)}`
        );
        // Tampoco sin sesión: un marcador sin dueño no dice de quién purgar.
        assert.equal(
          resolvePendingDeletionBoot({
            marker: { userId, phase },
            clerkLoaded: true,
            isSignedIn: false
          }),
          "blocked",
          `${phase}/${JSON.stringify(userId)} sin sesión`
        );
      }
    }
  });

  it("A→A válido sigue pudiendo terminar su propia eliminación", () => {
    assert.equal(
      resolvePendingDeletionBoot({
        marker: deA,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_a"
      }),
      "finalize-identity"
    );
  });

  it("A signed-out con `backend_deleted`: no se purga, hace falta volver a entrar", () => {
    assert.equal(
      resolvePendingDeletionBoot({
        marker: deA,
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null
      }),
      "needs-owner"
    );
  });

  it("identity_deleted purga SÓLO sin sesión; cualquier sesión viva espera o bloquea", () => {
    const marcador: PendingDeletionMarker = { userId: "user_a", phase: "identity_deleted" };
    assert.equal(
      resolvePendingDeletionBoot({
        marker: marcador,
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null
      }),
      "purge"
    );
    // Incluso la del propio dueño: el token puede tardar en caer.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: marcador,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_a"
      }),
      "wait"
    );
    // B logueado: purgar borraría los datos locales de B.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: marcador,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_b"
      }),
      "blocked"
    );
  });

  it("`blocked` no ejecuta NADA y deja el marcador intacto", async () => {
    const s = fakeStorage(LOCAL_DATA, { userId: "user_a", phase: "backend_deleted" });
    let deleteIdentityCalls = 0;
    let purgeCalls = 0;
    const resultado = await finalizar({
      decision: "blocked",
      deleteIdentity: async () => {
        deleteIdentityCalls += 1;
      },
      purge: async () => {
        purgeCalls += 1;
      }
    });
    assert.equal(resultado, "noop");
    assert.equal(deleteIdentityCalls, 0, "cero deleteIdentity");
    assert.equal(purgeCalls, 0, "cero purga");
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_a", phase: "backend_deleted" });
    assert.equal(s.store.has("profile"), true, "los datos locales de la otra cuenta siguen ahí");
  });

  it("el boundary global pasa el `currentUserId` y no tiene otra fuente de verdad", () => {
    const boundary = readFileSync(join(ROOT, "src/components/PendingDeletionBoundary.tsx"), "utf8");
    assert.match(boundary, /currentUserId: auth\?\.userId \?\? null/);
    assert.match(boundary, /markerUnreadable: slot\.kind === "invalid"/);
    // Y las rutas ya no deciden nada destructivo por su cuenta.
    for (const archivo of ["src/routes/v492/index.tsx", "src/routes/v492/index.web.tsx"]) {
      const fuente = readFileSync(join(ROOT, archivo), "utf8");
      assert.doesNotMatch(fuente, /attemptPendingDeletionFinalize/, archivo);
      assert.doesNotMatch(fuente, /deleteUser\(/, archivo);
      assert.doesNotMatch(fuente, /completePendingDeletionPurge/, archivo);
    }
  });

  it("la recuperación corre en las dos plataformas, desde un único boundary", () => {
    // El efecto salía temprano en web y el render seguía dibujando
    // "Finalizando eliminación": spinner eterno y purga que nunca corría. Hoy no
    // hay efecto por plataforma: hay UN boundary, compartido.
    const web = readFileSync(join(ROOT, "src/routes/v492/index.web.tsx"), "utf8");
    assert.doesNotMatch(web, /if \(IS_WEB \|\| finalizeError\) return;/);
    assert.doesNotMatch(web, /finalizeError/);
    const boundary = readFileSync(join(ROOT, "src/components/PendingDeletionBoundary.tsx"), "utf8");
    assert.equal(
      /\.web\.tsx/.test(boundary),
      false,
      "el boundary no se resuelve por plataforma: es el mismo archivo"
    );
    assert.match(boundary, /runGuardedPendingDeletionPurge\(/);
  });
});

/**
 * D — última línea de defensa, EN el objetivo destructivo.
 *
 * Todo lo de arriba decide con lo que sabía cuando decidió. Entre la decisión y
 * el `user.delete()` hay awaits, y Clerk puede cambiar de cuenta: sin exigir el
 * dueño esperado, una decisión tomada para A —o una closure vieja— terminaba
 * borrando la identidad de B.
 */
describe("identityDeleteAuthorized — nadie borra una identidad que no nombró (D)", () => {
  const ok = {
    expectedOwner: "user_a",
    isSignedIn: true,
    sessionUserId: "user_a",
    userObjectId: "user_a"
  };

  it("autoriza sólo cuando los TRES ids son el mismo", () => {
    assert.equal(identityDeleteAuthorized(ok), true);
  });

  it("REPRO A→B: la sesión ya es B → no autoriza", () => {
    assert.equal(
      identityDeleteAuthorized({ ...ok, sessionUserId: "user_b", userObjectId: "user_b" }),
      false
    );
  });

  it("el objeto `user` desalineado tampoco pasa (auth fresco, user viejo)", () => {
    assert.equal(identityDeleteAuthorized({ ...ok, userObjectId: "user_b" }), false);
    assert.equal(identityDeleteAuthorized({ ...ok, sessionUserId: "user_b" }), false);
  });

  it("sin dueño esperado, sin sesión o sin ids: no autoriza", () => {
    assert.equal(identityDeleteAuthorized({ ...ok, expectedOwner: "" }), false);
    assert.equal(identityDeleteAuthorized({ ...ok, expectedOwner: null }), false);
    assert.equal(identityDeleteAuthorized({ ...ok, expectedOwner: undefined }), false);
    assert.equal(identityDeleteAuthorized({ ...ok, isSignedIn: false }), false);
    assert.equal(identityDeleteAuthorized({ ...ok, sessionUserId: null }), false);
    assert.equal(identityDeleteAuthorized({ ...ok, userObjectId: null }), false);
  });

  it("CONDUCTUAL: con marcador de A y sesión viva de B no hay ni un `user.delete()`", async () => {
    // Simula el objetivo real: refs VIVAS que ya apuntan a B, y una closure
    // vieja que sigue creyendo que el dueño es A.
    const live = { isSignedIn: true, userId: "user_a" };
    let deletes = 0;
    const user = {
      get id() {
        return live.userId;
      },
      delete: async () => {
        deletes += 1;
      }
    };
    const deleteUser = async (expectedOwner: string) => {
      if (
        !identityDeleteAuthorized({
          expectedOwner,
          isSignedIn: live.isSignedIn,
          sessionUserId: live.userId,
          userObjectId: user.id
        })
      ) {
        throw new Error("ACCOUNT_DELETE_OWNER_MISMATCH");
      }
      await user.delete();
    };

    // Clerk cambia de cuenta mientras la decisión vieja sigue en vuelo.
    live.userId = "user_b";
    let promociones = 0;
    const resultado = await finalizar({
      // Una decisión ya tomada para A: el gate real ya no la produciría, pero
      // aunque llegara, el objetivo la rechaza.
      decision: "finalize-identity",
      deleteIdentity: () => deleteUser("user_a"),
      promoteIdentityDeleted: async () => {
        promociones += 1;
      }
    });
    assert.equal(resultado, "error");
    assert.equal(deletes, 0, "cero user.delete() sobre la cuenta equivocada");
    assert.equal(promociones, 0, "y nada se marca como borrado");

    // Y con la sesión correcta sí borra, una sola vez, y persiste la fase.
    live.userId = "user_a";
    assert.equal(
      await finalizar({
        decision: "finalize-identity",
        deleteIdentity: () => deleteUser("user_a"),
        promoteIdentityDeleted: async () => {
          promociones += 1;
        }
      }),
      "identity-deleted"
    );
    assert.equal(deletes, 1);
    assert.equal(promociones, 1);
  });

  it("el hook revalida contra refs VIVAS, no contra el closure del render", () => {
    const hook = readFileSync(join(ROOT, "src/hooks/useOrbitaAuth.ts"), "utf8");
    assert.match(hook, /deleteUser: \(expectedOwner: string\) => Promise<void>/);
    assert.match(hook, /authRef\.current/);
    assert.match(hook, /userRef\.current/);
    assert.match(hook, /identityDeleteAuthorized\(\{/);
    // El objetivo NO puede leer `auth`/`user` del closure para decidir.
    const start = hook.indexOf("deleteUser: async (expectedOwner");
    const cuerpo = hook.slice(start);
    assert.doesNotMatch(cuerpo, /isSignedIn: !!auth\./);
    assert.doesNotMatch(cuerpo, /userObjectId: user\?\./);
  });

  it("la ÚNICA llamada a `deleteUser` vive en el boundary, y nombra al dueño del marcador", () => {
    // El Perfil ya no borra identidades: llega al marcador y hace `handoff`.
    const perfil = readFileSync(join(ROOT, "src/screens/PerfilScreen.tsx"), "utf8");
    assert.equal(
      /deleteUser\(/.test(perfil),
      false,
      "el Perfil no puede borrar la identidad: ese paso es del boundary"
    );

    const boundary = readFileSync(join(ROOT, "src/components/PendingDeletionBoundary.tsx"), "utf8");
    const llamadas = [...boundary.matchAll(/deleteUser\(([^)]*)\)/g)].map((m) => m[1].trim());
    assert.equal(llamadas.length, 1, `una sola llamada; vi ${llamadas.length}`);
    // El dueño sale del MARCADOR, no de la sesión viva: si Clerk cambió de
    // cuenta entre la decisión y el await, `deleteUser` lo rechaza.
    assert.equal(llamadas[0], "marker.userId");
  });

  it("el backend REVALIDA el dueño esperado antes de borrar nada (V2)", () => {
    // Última autoridad: entre las dos confirmaciones del cliente hay awaits
    // largos, y la mutation legada borra "a quien esté autenticado al ejecutar".
    const users = readFileSync(join(ROOT, "convex/users.ts"), "utf8");
    const inicio = users.indexOf("export const deleteAccountV2");
    assert.ok(inicio > 0, "falta la mutation versionada");
    const cuerpo = users.slice(inicio);
    assert.match(cuerpo, /args: \{ expectedClerkUserId: v\.string\(\) \}/);
    assert.match(cuerpo, /ACCOUNT_DELETE_OWNER_REQUIRED/);
    assert.match(cuerpo, /ACCOUNT_DELETE_OWNER_MISMATCH/);
    // La comprobación ocurre ANTES de tocar nada.
    const chequeo = cuerpo.indexOf("identity.subject !== expected");
    const borrado = cuerpo.indexOf("deleteAuthenticatedAccount(");
    assert.ok(chequeo > 0 && borrado > chequeo, "la revalidación va antes del borrado");
    // `trim`: un id de espacios en blanco no autoriza nada.
    assert.match(cuerpo, /args\.expectedClerkUserId\.trim\(\)/);
  });

  it("el contrato legado sigue vivo para builds instalados, y NADIE en el repo lo usa", () => {
    const users = readFileSync(join(ROOT, "convex/users.ts"), "utf8");
    const doc = users.indexOf("**DEPRECATED");
    const legadoExport = users.indexOf("export const deleteAccount = mutation");
    const v2Export = users.indexOf("export const deleteAccountV2");
    assert.ok(doc > 0, "falta la marca de deprecación");
    assert.ok(legadoExport > doc, "la deprecación documenta al export legado");
    assert.ok(v2Export > legadoExport, "V2 va después");
    // El bloque de deprecación pertenece a ESTE export: no hay otro en el medio.
    const deprecacion = users.slice(doc, legadoExport);
    assert.equal(
      deprecacion.includes("export const"),
      false,
      "el comentario tiene que ser el del handler legado"
    );
    // Y documenta el rollout: hasta cuándo se sostiene y cuándo se borra.
    assert.match(deprecacion, /Rollout/);
    assert.match(deprecacion, /deleteAccountV2/);
    // El handler legado sigue aceptando `{}` —un build instalado no se rompe—
    // pero FALLA CERRADO: no borra nada y pide actualizar.
    const cuerpoLegado = users.slice(legadoExport, v2Export);
    assert.match(cuerpoLegado, /args: \{\},/);
    assert.match(cuerpoLegado, /throw new Error\("ACCOUNT_DELETE_UPDATE_REQUIRED"\)/);
    assert.equal(
      cuerpoLegado.includes("deleteAuthenticatedAccount("),
      false,
      "el handler legado no puede borrar nada"
    );

    // Y ningún cliente de este repo lo llama: sólo V2, y desde el BOUNDARY.
    const refs = readFileSync(join(ROOT, "src/services/appRefs.ts"), "utf8");
    assert.match(refs, /deleteAccountV2: anyApi\.users\.deleteAccountV2/);
    assert.equal(
      /anyApi\.users\.deleteAccount\b/.test(refs),
      false,
      "la ruta insegura no puede estar declarada en el cliente"
    );
    const boundary = readFileSync(join(ROOT, "src/components/PendingDeletionBoundary.tsx"), "utf8");
    assert.match(boundary, /appApi\.users\.deleteAccountV2, \{ expectedClerkUserId \}/);
    const perfil = readFileSync(join(ROOT, "src/screens/PerfilScreen.tsx"), "utf8");
    assert.equal(
      /appApi\.users\.deleteAccount/.test(perfil),
      false,
      "el Perfil ya no llama a Convex: la mutación destructiva es del boundary"
    );
  });
});

/**
 * E — el bloqueo se dibuja ANTES de la landing.
 *
 * En `index.web.tsx` el `return` del `AccountGate` estaba antes del bloqueo por
 * eliminación pendiente: con una eliminación a medias en disco, la web dibujaba
 * la landing —cuyo gate redirige a la app si hay sesión— y el bloqueo era código
 * inalcanzable.
 */
describe("bootGateSurface — el bloqueo gana el orden (E)", () => {
  it("con eliminación pendiente gana el bloqueo, en las dos plataformas", () => {
    for (const isWeb of [true, false]) {
      assert.equal(bootGateSurface({ pendingDeletion: true, isWeb }), "pending-deletion");
    }
  });

  it("sin eliminación pendiente, cada plataforma sigue su camino", () => {
    assert.equal(bootGateSurface({ pendingDeletion: false, isWeb: true }), "landing");
    assert.equal(bootGateSurface({ pendingDeletion: false, isWeb: false }), "app");
  });

  it("las dos rutas resuelven el orden con el helper, y el bloqueo va primero", () => {
    for (const archivo of ["src/routes/v492/index.tsx", "src/routes/v492/index.web.tsx"]) {
      const fuente = readFileSync(join(ROOT, archivo), "utf8");
      assert.match(fuente, /bootGateSurface\(\{/, archivo);
      const bloqueo = fuente.indexOf('if (surface === "pending-deletion")');
      const decision = fuente.indexOf("switch (decision)");
      assert.ok(bloqueo > 0, `${archivo}: falta el bloqueo por superficie`);
      assert.ok(bloqueo < decision, `${archivo}: el bloqueo debe cortar antes de resolveStart`);
      // El estado sale del boundary, que es el único dueño de esa decisión.
      assert.match(fuente, /usePendingDeletionGate\(\)/, archivo);
    }
    const web = readFileSync(join(ROOT, "src/routes/v492/index.web.tsx"), "utf8");
    const bloqueo = web.indexOf('if (surface === "pending-deletion")');
    const landing = web.indexOf('if (surface === "landing")');
    assert.ok(landing > 0, "la landing sigue existiendo");
    assert.ok(bloqueo < landing, "REPRO: la landing no puede adelantarse al bloqueo");
    // Y ya no queda el `return` incondicional por plataforma.
    assert.doesNotMatch(web, /^\s*if \(IS_WEB\) \{$/m);
  });
});

describe("regresión 1 (review): Clerk falla → reinicio con Clerk signed-in → no se purga ni se pierde la señal", () => {
  it("el marcador backend_deleted sobrevive intacto y la eliminación se puede completar después", async () => {
    // Con un marcador de compra en vuelo puesto: el boundary corta en Clerk
    // ANTES de la limpieza local, así que tiene que seguir ahí para el reintento.
    const s = fakeStorage({ ...LOCAL_DATA, "purchase-guard:user_1": "{}" });

    // La pantalla deja la intención escrita y el boundary borra en Convex.
    const result = await runAccountDeletion({
      ownerUserId: "user_1",
      markDeletionRequested: async () => {
        s.store.set("marker", JSON.stringify({ userId: "user_1", phase: "deletion_requested" }));
      }
    });
    assert.deepEqual(result, {
      status: "handoff",
      marker: { userId: "user_1", phase: "deletion_requested" }
    });
    assert.equal(
      await finalizar({
        decision: "delete-backend",
        deleteBackendAccount: async () => undefined,
        promoteBackendDeleted: () =>
          s.deps.promoteMarker({ userId: "user_1", phase: "backend_deleted" })
      }),
      "backend-deleted"
    );

    // El boundary intenta borrar Clerk y FALLA: nada local se toca.
    assert.equal(
      await finalizar({
        decision: "finalize-identity",
        deleteIdentity: async () => {
          throw new Error("clerk down");
        },
        promoteIdentityDeleted: () =>
          s.deps.promoteMarker({ userId: "user_1", phase: "identity_deleted" })
      }),
      "error"
    );
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "backend_deleted" });
    // Lo que el caso mide: se cortó ANTES de tocar nada local, así que el
    // marcador de compra sigue en disco esperando el reintento.
    assert.equal(s.store.has("purchase-guard:user_1"), true);

    // Reinicio: Clerk todavía signed-in. La hidratación sólo LEE: no purga, no
    // promueve y no retira nada.
    const boot = await inspectPendingAccountDeletion(s.deps);
    assert.equal(boot.status, "pending");
    assert.equal(s.store.has("profile"), true);
    assert.equal(s.store.has("purchase-guard:user_1"), true);
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "backend_deleted" });
    // …y el gate bloquea en "Finalizando eliminación" para reintentar Clerk.
    // La sesión viva es la MISMA que puso el marcador (el corte fue en Clerk, no
    // hubo cambio de cuenta): se declara explícitamente, porque sin dueño
    // verificable el gate falla cerrado en vez de borrar una identidad ajena.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: boot.marker,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_1"
      }),
      "finalize-identity"
    );

    // El reintento borra la identidad, la persiste, y la purga llega recién
    // cuando Clerk deja de publicar la sesión.
    assert.equal(
      await finalizar({
        decision: "finalize-identity",
        deleteIdentity: async () => undefined,
        promoteIdentityDeleted: () =>
          s.deps.promoteMarker({ userId: "user_1", phase: "identity_deleted" })
      }),
      "identity-deleted"
    );
    await finalizePendingDeletionPurge(s.readMarkerRaw()!, s.deps);
    assert.equal(s.store.size, 0);
  });
});

describe("regresión 2 (review): crash después de borrar Clerk pero antes de limpiar → reinicio signed-out", () => {
  it("REPRO: `backend_deleted` + signed-out NO purga — se pide volver a entrar", async () => {
    // La app murió justo después de user.delete(): el marcador quedó en
    // backend_deleted y no hubo promoción ni limpieza. Que ahora no haya sesión
    // NO prueba que Clerk se haya borrado: pudo ser un token vencido.
    const s = fakeStorage(LOCAL_DATA, { userId: "user_1", phase: "backend_deleted" });

    const boot = await inspectPendingAccountDeletion(s.deps);
    assert.equal(boot.status, "pending");
    assert.equal(
      resolvePendingDeletionBoot({ marker: boot.marker, clerkLoaded: true, isSignedIn: false }),
      "needs-owner"
    );
    assert.equal(await finalizar({ decision: "needs-owner" }), "noop");
    // Todo intacto: datos locales Y marcador.
    assert.equal(s.store.size, Object.keys(LOCAL_DATA).length + 1);
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "backend_deleted" });

    // Vuelve a entrar con la MISMA cuenta: ahí sí se termina la eliminación.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: boot.marker,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_1"
      }),
      "finalize-identity"
    );
    assert.equal(
      await finalizar({
        decision: "finalize-identity",
        deleteIdentity: async () => undefined,
        promoteIdentityDeleted: () =>
          s.deps.promoteMarker({ userId: "user_1", phase: "identity_deleted" })
      }),
      "identity-deleted"
    );
    await finalizePendingDeletionPurge(s.readMarkerRaw()!, s.deps);
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

    // Próximo arranque con storage sano: la hidratación entrega el marcador ya
    // promovido y el gate (signed-out) completa la purga.
    s.failing.clears = false;
    const boot = await inspectPendingAccountDeletion(s.deps);
    assert.equal(boot.status, "pending");
    assert.deepEqual(boot.marker, { userId: "user_1", phase: "identity_deleted" });
    assert.equal(
      resolvePendingDeletionBoot({
        marker: boot.marker,
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null
      }),
      "purge"
    );
    await finalizePendingDeletionPurge(boot.marker!, s.deps);
    assert.equal(s.store.size, 0);
  });
});

describe("regresión original: Convex OK → Clerk OK → AsyncStorage falla → reinicio → limpieza completa", () => {
  it("el marcador (ya identity_deleted) sobrevive al fallo y el reinicio purga sin rastro", async () => {
    const s = fakeStorage(LOCAL_DATA);

    // Los borrados remotos pasan y el checkpoint se escribe; la limpieza local
    // falla y el marcador (ya `identity_deleted`) queda protegiendo.
    const result = await runAccountDeletion({
      ownerUserId: "user_1",
      markDeletionRequested: async () => {
        s.store.set("marker", JSON.stringify({ userId: "user_1", phase: "backend_deleted" }));
      }
    });
    assert.equal(result.status, "handoff");

    assert.equal(
      await finalizar({
        decision: "finalize-identity",
        deleteIdentity: async () => undefined,
        promoteIdentityDeleted: () =>
          s.deps.promoteMarker({ userId: "user_1", phase: "identity_deleted" })
      }),
      "identity-deleted"
    );
    s.failing.clears = true;
    assert.equal(
      await finalizar({
        decision: "purge",
        purge: () => finalizePendingDeletionPurge(s.readMarkerRaw()!, s.deps)
      }),
      "error"
    );
    s.failing.clears = false;
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "identity_deleted" });
    assert.ok(s.store.has("profile"), "el perfil quedó huérfano en disco, esperando la purga");

    // Reinicio con el storage sano: la hidratación entrega el marcador y el gate
    // —con Clerk cargado y sin sesión— completa la purga.
    const boot = await inspectPendingAccountDeletion(s.deps);
    assert.equal(boot.status, "pending");
    assert.equal(
      resolvePendingDeletionBoot({
        marker: boot.marker,
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null
      }),
      "purge"
    );
    await finalizePendingDeletionPurge(boot.marker!, s.deps);
    assert.equal(s.store.size, 0);
  });
});

// ---------------------------------------------------------------------------
// P1 4 — el marcador de compra en vuelo también sale en el borrado
// ---------------------------------------------------------------------------

/**
 * El agujero: el paso era opcional, el hook nativo directamente no lo pasaba, y
 * `finalizePendingDeletionPurge` ni siquiera lo aceptaba. Resultado: la purga
 * retiraba su propio marcador de eliminación dejando vivo un marcador de compra
 * de una cuenta que ya no existe, y el próximo login con ese Clerk id entraba
 * con el paywall clavado en "Restaurar".
 *
 * La regla, en el único camino que queda (la purga del boundary): promover
 * marcador → limpiar local → snapshot → **guard** → retirar el marcador de
 * eliminación ÚLTIMO. Si el guard falla, el marcador sobrevive para reintentar.
 */
describe("P1 4 — la purga se lleva el purchase guard", () => {
  const CON_GUARD = { ...LOCAL_DATA, "purchase-guard:user_1": "{}" };

  it("el orden es: limpiar → snapshot → guard → retirar el marcador ÚLTIMO", async () => {
    const s = fakeStorage(CON_GUARD, { userId: "user_1", phase: "identity_deleted" });
    const orden: string[] = [];
    await finalizePendingDeletionPurge(
      { userId: "user_1", phase: "identity_deleted" },
      {
        promoteMarker: async (next) => {
          orden.push("promote");
          await s.deps.promoteMarker(next);
        },
        clearLocalData: async () => {
          orden.push("clear");
          await s.deps.clearLocalData();
        },
        clearAccountSnapshot: async (userId) => {
          orden.push("snapshot");
          await s.deps.clearAccountSnapshot(userId);
        },
        clearPurchaseGuard: async (userId) => {
          orden.push("guard");
          await s.deps.clearPurchaseGuard(userId);
        },
        clearMarker: async () => {
          orden.push("unmark");
          await s.deps.clearMarker();
        }
      }
    );
    assert.deepEqual(orden, ["promote", "clear", "snapshot", "guard", "unmark"]);
    assert.equal(s.store.size, 0);
  });

  describe("gate con `identity_deleted` (ya no la hidratación)", () => {
    it("la purga del gate se lleva el guard de esa cuenta", async () => {
      const s = fakeStorage(CON_GUARD, { userId: "user_1", phase: "identity_deleted" });
      const boot = await inspectPendingAccountDeletion(s.deps);
      assert.equal(boot.status, "pending");
      // El guard sigue vivo hasta que el gate decide con Clerk cargado.
      assert.equal(s.store.has("purchase-guard:user_1"), true);
      assert.equal(
        resolvePendingDeletionBoot({
          marker: boot.marker,
          clerkLoaded: true,
          isSignedIn: false,
          currentUserId: null
        }),
        "purge"
      );
      await finalizePendingDeletionPurge(boot.marker!, s.deps);
      assert.equal(s.store.has("purchase-guard:user_1"), false);
      assert.equal(s.store.size, 0);
    });

    it("REPRO: si el guard falla, la purga LANZA y el marcador sobrevive", async () => {
      const s = fakeStorage(CON_GUARD, { userId: "user_1", phase: "identity_deleted" });
      s.failing.guard = true;
      const boot = await inspectPendingAccountDeletion(s.deps);
      assert.equal(boot.status, "pending");
      assert.equal(
        await finalizar({
          decision: "purge",
          purge: () => finalizePendingDeletionPurge(boot.marker!, s.deps)
        }),
        "error"
      );
      assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "identity_deleted" });
      assert.equal(s.store.has("purchase-guard:user_1"), true, "el guard sigue vivo");
    });
  });

  describe("arranque `backend_deleted` → signed-out → finalize", () => {
    it("la purga final promueve, limpia, borra el guard y recién ahí retira el marcador", async () => {
      const s = fakeStorage(CON_GUARD, { userId: "user_1", phase: "backend_deleted" });
      await finalizePendingDeletionPurge({ userId: "user_1", phase: "backend_deleted" }, s.deps);
      assert.equal(s.store.has("purchase-guard:user_1"), false);
      assert.equal(s.readMarkerRaw(), null);
      assert.equal(s.store.size, 0);
    });

    it("REPRO: si el guard falla, `finalize` LANZA y el marcador sigue en disco", async () => {
      const s = fakeStorage(CON_GUARD, { userId: "user_1", phase: "backend_deleted" });
      s.failing.guard = true;
      await assert.rejects(
        () => finalizePendingDeletionPurge({ userId: "user_1", phase: "backend_deleted" }, s.deps),
        /purchase guard/
      );
      // Promovido a `identity_deleted` —el hecho ya ocurrió— pero NO retirado.
      assert.deepEqual(s.readMarkerRaw(), { userId: "user_1", phase: "identity_deleted" });
      assert.equal(s.store.has("purchase-guard:user_1"), true);
    });

    it("y el reintento del próximo arranque completa la purga", async () => {
      const s = fakeStorage(CON_GUARD, { userId: "user_1", phase: "backend_deleted" });
      s.failing.guard = true;
      await assert.rejects(() =>
        finalizePendingDeletionPurge({ userId: "user_1", phase: "backend_deleted" }, s.deps)
      );
      s.failing.guard = false;
      // El próximo arranque lee el marcador ya promovido y el gate lo termina.
      const boot = await inspectPendingAccountDeletion(s.deps);
      assert.equal(boot.status, "pending");
      assert.deepEqual(boot.marker, { userId: "user_1", phase: "identity_deleted" });
      assert.equal(
        resolvePendingDeletionBoot({
          marker: boot.marker,
          clerkLoaded: true,
          isSignedIn: false,
          currentUserId: null
        }),
        "purge"
      );
      await finalizePendingDeletionPurge(boot.marker!, s.deps);
      assert.equal(s.store.size, 0);
    });
  });

  it("el guard sale por la purga del BOUNDARY, y el AppState ya no sabe de esto", () => {
    // El defecto original era una divergencia entre archivos platform-resolved:
    // el `.native` no pasaba `clearPurchaseGuard` en ninguno de los dos puntos.
    // Hoy hay UN solo punto —la purga del boundary— y el AppState no participa.
    const boundary = readFileSync(join(ROOT, "src/components/PendingDeletionBoundary.tsx"), "utf8");
    assert.match(boundary, /from "@\/services\/purchaseGuard"/);
    assert.match(boundary, /clearPurchaseGuard,/);

    for (const archivo of ["src/hooks/useAppState.native.tsx", "src/hooks/useAppState.tsx"]) {
      const fuente = readFileSync(join(ROOT, archivo), "utf8");
      // La hidratación NO mira el marcador: ése era el segundo camino peligroso.
      for (const retirado of [
        "inspectPendingAccountDeletion",
        "finalizePendingDeletionPurge",
        "readPendingAccountDeletion",
        "clearPendingAccountDeletion",
        "clearPurchaseGuard",
        "pendingAccountDeletion"
      ]) {
        assert.equal(
          fuente.includes(retirado),
          false,
          `${archivo}: la eliminación pendiente ya no vive en el AppState (${retirado})`
        );
      }
    }
  });

  it("el Perfil publica al boundary y NO navega ni libera la pantalla", () => {
    const perfil = readFileSync(join(ROOT, "src/screens/PerfilScreen.tsx"), "utf8");
    assert.match(perfil, /usePendingDeletionGate\(\)/);
    assert.match(perfil, /if \(result\.status === "handoff"\)/);
    assert.match(perfil, /publishPendingDeletion\(result\.marker\)/);
    // Y ya no cablea nada destructivo: eso vive en el boundary.
    for (const retirado of ["deleteClerkUser", "clearLocalData:", "clearPendingCleanup", "goToEntry"]) {
      assert.equal(perfil.includes(retirado), false, `el Perfil no puede cablear ${retirado}`);
    }
    // El handoff se publica ANTES de cualquier otra cosa: el `return` corta.
    const publish = perfil.indexOf("publishPendingDeletion(result.marker)");
    const suelta = perfil.indexOf("deletionInFlight.current = false", publish);
    assert.ok(publish > 0 && suelta > publish, "no se libera el lock en el camino de handoff");
  });
});

// ---------------------------------------------------------------------------
// A3 — el checkpoint `identity_deleted` es estricto, y su fallo se retiene
// ---------------------------------------------------------------------------

describe("checkpoint: `deleteUser` ok + disco caído no pide login", () => {
  it("REPRO: sin retener el hecho, el caso caía en pedir login a una cuenta borrada", async () => {
    const s = fakeStorage(LOCAL_DATA, { userId: "user_a", phase: "backend_deleted" });
    let borrados = 0;

    // Clerk borra ok; escribir el checkpoint falla.
    assert.equal(
      await finalizar({
        decision: "finalize-identity",
        deleteIdentity: async () => {
          borrados += 1;
        },
        promoteIdentityDeleted: async () => {
          throw new Error("storage down");
        }
      }),
      "checkpoint-pending"
    );
    assert.equal(borrados, 1);
    // En disco sigue `backend_deleted` y Clerk ya publica signed-out.
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_a", phase: "backend_deleted" });

    // SIN el hecho retenido: se pide volver a entrar (fail closed).
    assert.equal(
      resolvePendingDeletionBoot({
        marker: s.readMarkerRaw(),
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null
      }),
      "needs-owner"
    );

    // CON el hecho retenido para ESE dueño: sólo se reintenta la promoción.
    const decision = resolvePendingDeletionBoot({
      marker: s.readMarkerRaw(),
      clerkLoaded: true,
      isSignedIn: false,
      currentUserId: null,
      identityConfirmedFor: "user_a"
    });
    assert.equal(decision, "promote-checkpoint");
    assert.equal(
      pendingDeletionRecovery({ decision, attemptFailed: false, markerUnreadable: false }),
      "none",
      "no se ofrece login: la identidad ya no existe"
    );

    // Y el reintento no vuelve a tocar Clerk.
    assert.equal(
      await finalizar({
        decision,
        promoteIdentityDeleted: () =>
          s.deps.promoteMarker({ userId: "user_a", phase: "identity_deleted" })
      }),
      "identity-deleted"
    );
    assert.equal(borrados, 1, "cero user.delete() extra");
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_a", phase: "identity_deleted" });
  });

  it("el hecho retenido es POR DUEÑO: el de A no destraba el marcador de B", () => {
    assert.equal(
      resolvePendingDeletionBoot({
        marker: { userId: "user_b", phase: "backend_deleted" },
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null,
        identityConfirmedFor: "user_a"
      }),
      "needs-owner"
    );
  });

  it("`identity_deleted` ya persistido ignora la memoria: manda el disco", () => {
    assert.equal(
      resolvePendingDeletionBoot({
        marker: { userId: "user_a", phase: "identity_deleted" },
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null,
        identityConfirmedFor: "user_a"
      }),
      "purge"
    );
  });

  it("el boundary retiene el hecho y sólo reintenta la promoción", () => {
    const boundary = readFileSync(join(ROOT, "src/components/PendingDeletionBoundary.tsx"), "utf8");
    assert.match(boundary, /resultado === "checkpoint-pending"/);
    assert.match(boundary, /setIdentityConfirmedFor\(marker\.userId\)/);
    // El hecho retenido entra en la decisión…
    const resolve = boundary.indexOf("resolvePendingDeletionBoot({");
    const args = boundary.slice(resolve, boundary.indexOf("});", resolve));
    assert.match(args, /identityConfirmedFor/);
    // …y es SÓLO memoria: nunca se persiste como si fuera el checkpoint.
    assert.equal(
      /storePendingAccountDeletion\([^)]*identityConfirmedFor/.test(boundary),
      false,
      "la memoria no puede disfrazarse de prueba durable"
    );
  });
});

// ---------------------------------------------------------------------------
// A5 + A6 — revalidación viva y dueño de los datos locales, EN CADA PASO
// ---------------------------------------------------------------------------

describe("purga guardada: nada se borra si aparece B o si los datos son ajenos", () => {
  /**
   * Datos locales de A, COHERENTES: el perfil está marcado con `user_a` y su
   * snapshot y su guard van bajo esa misma clave. Con `snapshot:user_1` de por
   * medio la purga de `user_a` lo dejaba en pie —correctamente— y el caso feliz
   * no podía afirmar "no queda nada".
   */
  const DATOS_DE_A = {
    profile: "p",
    "profile-owner": "user_a",
    saved: "[]",
    journal: "[]",
    "snapshot:user_a": "s",
    "purchase-guard:user_a": "{}"
  };

  const deps = (s: ReturnType<typeof fakeStorage>, extra: Partial<{
    stillSafeToDelete: () => boolean;
    readProfileOwner: () => Promise<string | null>;
  }> = {}) => ({
    stillSafeToDelete: () => true,
    readProfileOwner: async () => "user_a",
    promoteMarker: s.deps.promoteMarker,
    clearLocalData: s.deps.clearLocalData,
    clearAccountSnapshot: s.deps.clearAccountSnapshot,
    clearPurchaseGuard: s.deps.clearPurchaseGuard,
    clearMarker: s.deps.clearMarker,
    ...extra
  });

  it("camino feliz: purga completa, sin dejar rastro de A", async () => {
    const s = fakeStorage(DATOS_DE_A, { userId: "user_a", phase: "identity_deleted" });
    assert.equal(
      await runGuardedPendingDeletionPurge({ userId: "user_a", phase: "identity_deleted" }, deps(s)),
      "completed"
    );
    for (const clave of Object.keys(DATOS_DE_A)) {
      assert.equal(s.store.has(clave), false, `${clave} tenía que salir con la cuenta`);
    }
    assert.equal(s.readMarkerRaw(), null);
    assert.equal(s.store.size, 0);
  });

  it("REPRO diferido A→B: B aparece ENTRE pasos → cero clears y el marcador vive", async () => {
    const s = fakeStorage(DATOS_DE_A, {
      userId: "user_a",
      phase: "identity_deleted"
    });
    // La decisión se tomó con signed-out; B aparece durante el primer await.
    let vivo = false;
    const resultado = await runGuardedPendingDeletionPurge(
      { userId: "user_a", phase: "identity_deleted" },
      deps(s, {
        stillSafeToDelete: () => !vivo,
        readProfileOwner: async () => {
          vivo = true; // Clerk publica la sesión de B justo acá
          return "user_a";
        }
      })
    );
    assert.equal(resultado, "owner-changed");
    assert.ok(s.store.has("profile"), "cero clears");
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_a", phase: "identity_deleted" });
  });

  it("REPRO: los datos locales son de OTRA cuenta → se preservan enteros", async () => {
    const s = fakeStorage({ ...DATOS_DE_A, "profile-owner": "user_b" }, {
      userId: "user_a",
      phase: "identity_deleted"
    });
    assert.equal(
      await runGuardedPendingDeletionPurge(
        { userId: "user_a", phase: "identity_deleted" },
        deps(s, { readProfileOwner: async () => "user_b" })
      ),
      "foreign-local-data"
    );
    assert.ok(s.store.has("profile"));
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_a", phase: "identity_deleted" });
  });

  it("el dueño local se RELEE en cada paso, no una sola vez al principio", async () => {
    const s = fakeStorage(DATOS_DE_A, { userId: "user_a", phase: "identity_deleted" });
    // Empieza siendo de A y cambia a B después de la primera lectura: si sólo se
    // mirara al principio, los pasos siguientes borrarían datos de B.
    let lecturas = 0;
    const resultado = await runGuardedPendingDeletionPurge(
      { userId: "user_a", phase: "identity_deleted" },
      deps(s, {
        readProfileOwner: async () => {
          lecturas += 1;
          return lecturas <= 2 ? "user_a" : "user_b";
        }
      })
    );
    assert.equal(resultado, "foreign-local-data");
    assert.ok(lecturas > 2, "hubo más de una relectura");
    assert.deepEqual(s.readMarkerRaw(), { userId: "user_a", phase: "identity_deleted" });
  });

  it("`stillSafeToDelete` del boundary exige loaded + signed-out + userId null", () => {
    const boundary = readFileSync(join(ROOT, "src/components/PendingDeletionBoundary.tsx"), "utf8");
    const inicio = boundary.indexOf("const stillSafeToDelete");
    const cuerpo = boundary.slice(inicio, boundary.indexOf(");", boundary.indexOf("useCallback", inicio)));
    assert.match(cuerpo, /liveRef\.current\.loaded/);
    assert.match(cuerpo, /!liveRef\.current\.isSignedIn/);
    assert.match(cuerpo, /liveRef\.current\.userId === null/);
  });

  it("web: el boundary escucha cambios cross-tab y NO purga", () => {
    const boundary = readFileSync(join(ROOT, "src/components/PendingDeletionBoundary.tsx"), "utf8");
    // Otra pestaña que borra su cuenta tiene que bloquear a ésta.
    assert.match(boundary, /window\.addEventListener\("storage", onStorage\)/);
    assert.match(boundary, /PENDING_DELETION_STORAGE_KEY/);
    // Pero la purga automática NO corre en web: `localStorage` es global del
    // origen y el borrado es por clave sin dueño. El "claim" que había era
    // escribir-y-releer, no una exclusión mutua: se retiró.
    assert.match(boundary, /if \(IS_WEB\) \{/);
    assert.match(boundary, /setPurgeBlocked\("web-unsupported"\)/);
    assert.equal(/claimPendingDeletionPurge/.test(boundary), false);
    const storage = readFileSync(join(ROOT, "src/services/storage.ts"), "utf8");
    assert.equal(
      /claimPendingDeletionPurge/.test(storage),
      false,
      "el claim best-effort no puede quedar como si fuera un mutex"
    );
  });

  it("web: la purga corta ANTES de cualquier borrador, y el bloqueo no se libera", () => {
    // Simulación del cuerpo real del `purge` del boundary, con el mismo corte:
    // con `IS_WEB` no se llama a ningún borrador y el marcador sobrevive.
    const s = fakeStorage(DATOS_DE_A, { userId: "user_a", phase: "identity_deleted" });
    const purgaDelBoundary = async (esWeb: boolean) => {
      if (esWeb) return "web-unsupported" as const;
      return await runGuardedPendingDeletionPurge(
        { userId: "user_a", phase: "identity_deleted" },
        {
          stillSafeToDelete: () => true,
          readProfileOwner: async () => "user_a",
          promoteMarker: s.deps.promoteMarker,
          clearLocalData: s.deps.clearLocalData,
          clearAccountSnapshot: s.deps.clearAccountSnapshot,
          clearPurchaseGuard: s.deps.clearPurchaseGuard,
          clearMarker: s.deps.clearMarker
        }
      );
    };
    assert.equal(purgaDelBoundary(true) instanceof Promise, true);
    return purgaDelBoundary(true).then(async (enWeb) => {
      assert.equal(enWeb, "web-unsupported");
      assert.ok(s.store.has("profile"), "cero clears en web");
      assert.deepEqual(s.readMarkerRaw(), { userId: "user_a", phase: "identity_deleted" });
      // Y el mismo caso en nativo SÍ purga: la diferencia es la plataforma, no
      // una condición del marcador.
      assert.equal(await purgaDelBoundary(false), "completed");
      assert.equal(s.store.size, 0);
    });
  });

  it("REINTENTAR vuelve a `loading` ANTES de bajar el bloqueo", () => {
    // El orden es la corrección: bajar `attemptFailed` con el slot todavía en el
    // marcador anterior deja al efecto destructivo elegible con la decisión
    // vieja. Si el disco ya es de B, ese intento salía con la autoridad de A.
    const boundary = readFileSync(join(ROOT, "src/components/PendingDeletionBoundary.tsx"), "utf8");
    const inicio = boundary.indexOf("const reintentar = useCallback(");
    assert.ok(inicio > 0, "falta el handler de reintento");
    const cuerpo = boundary.slice(inicio, boundary.indexOf("}, []);", inicio));
    const loading = cuerpo.indexOf('setSlot({ kind: "loading" })');
    const baja = cuerpo.indexOf("setAttemptFailed(false)");
    const relee = cuerpo.indexOf("setTick((t) => t + 1)");
    assert.ok(loading >= 0 && baja > loading, "primero `loading`, después el desbloqueo");
    assert.ok(relee > baja, "y la relectura al final");
    // El hecho retenido NO se limpia: la identidad ya borrada no debe pedir login.
    assert.equal(
      /setIdentityConfirmedFor\(null\)/.test(cuerpo),
      false,
      "perder el checkpoint mandaría a autenticarse contra una cuenta borrada"
    );
    // Y el botón usa ese handler, no un inline con el orden invertido.
    assert.match(boundary, /onRetry=\{reintentar\}/);
  });

  it("con el slot en `loading` no hay marcador ni decisión ejecutable", () => {
    // Es lo que hace segura la ventana: mientras la relectura está pendiente el
    // gate ve `marker: null`, así que el efecto destructivo no aplica.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: null,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_a"
      }),
      "proceed"
    );
    for (const decision of ["proceed", "wait"] as const) {
      assert.equal(
        ["purge", "delete-backend", "finalize-identity", "promote-checkpoint"].includes(decision),
        false,
        `${decision} no es ejecutable`
      );
    }
    // Y el efecto exige marcador además de decisión.
    const boundary = readFileSync(join(ROOT, "src/components/PendingDeletionBoundary.tsx"), "utf8");
    assert.match(boundary, /if \(!marker\) return;/);
  });

  it("web: el orden del corte está en el código, antes del borrado", () => {
    const boundary = readFileSync(join(ROOT, "src/components/PendingDeletionBoundary.tsx"), "utf8");
    const purga = boundary.indexOf("purge: async () => {");
    const cuerpo = boundary.slice(purga, boundary.indexOf("}).then((resultado)", purga));
    assert.ok(
      cuerpo.indexOf("if (IS_WEB) {") < cuerpo.indexOf("runGuardedPendingDeletionPurge("),
      "en web se corta antes de cualquier borrado"
    );
    // Y el bloqueo no se libera: `web-unsupported` dibuja soporte, no producto.
    assert.match(boundary, /purgeBlocked === "web-unsupported"/);
  });
});
