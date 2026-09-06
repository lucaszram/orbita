/**
 * Endurecimiento del webhook (P1 1, 2 y 4) visto desde la mutation completa.
 *
 * - identidad ambigua: dos usuarios locales para el mismo evento no eligen "el
 *   primero" ni mutan acceso;
 * - eventos sin `environment` (`TRANSFER`, `TEMPORARY_ENTITLEMENT_GRANT`) no se
 *   descartan antes de resolver, y `undefined` nunca se lee como production;
 * - producción acepta Sandbox sólo para una cuenta de review allowlisted;
 * - todo camino dudoso deja agendada una reconciliación REST.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyRevenueCatEvent } from "../convex/payments/revenuecat";

const EVENT_AT = 1_900_000_000_000;
const FUTURE = 2_000_000_000_000;

const BASE = {
  id: "rc_hardening",
  event_timestamp_ms: EVENT_AT,
  environment: "SANDBOX",
  entitlement_ids: ["orbita_pro"]
};

type MemoryRow = Record<string, any> & { _id: string };

function harness(seed: Record<string, MemoryRow[]>) {
  const initial: Record<string, MemoryRow[]> = {
    users: [],
    subscriptions: [],
    paymentEvents: [],
    ...seed
  };
  const rows = new Map<string, MemoryRow[]>(
    Object.entries(initial).map(([t, e]) => [t, e.map((r) => ({ ...r }))])
  );
  let seq = 0;
  const scheduled: Array<{ delay: number; args: any }> = [];

  const db = {
    query(table: string) {
      const filters = new Map<string, unknown>();
      const q = {
        eq(field: string, value: unknown) {
          filters.set(field, value);
          return q;
        }
      };
      return {
        withIndex(_i: string, build: (b: typeof q) => unknown) {
          build(q);
          const found = () =>
            (rows.get(table) ?? []).filter((row) => [...filters].every(([f, v]) => row[f] === v));
          return { first: async () => found()[0] ?? null, collect: async () => found() };
        }
      };
    },
    async insert(table: string, value: Record<string, unknown>) {
      const id = `${table}_${++seq}`;
      const list = rows.get(table) ?? [];
      list.push({ _id: id, ...value } as MemoryRow);
      rows.set(table, list);
      return id;
    },
    async patch(id: string, value: Record<string, unknown>) {
      for (const list of rows.values()) {
        const row = list.find((r) => r._id === id);
        if (row) return void Object.assign(row, value);
      }
      throw new Error(`Missing row ${id}`);
    }
  };

  const ctx = {
    db,
    scheduler: {
      async runAfter(delay: number, _ref: unknown, args: any) {
        scheduled.push({ delay, args });
      }
    }
  };
  return { ctx, rows, scheduled };
}

const apply = async (ctx: unknown, event: Record<string, unknown>) =>
  await (applyRevenueCatEvent as any)._handler(ctx, { event });

const outcomes = (rows: Map<string, MemoryRow[]>) =>
  (rows.get("paymentEvents") ?? []).map((e) => e.rawPayload?.outcome);

/**
 * Cuentas con reparación pedida.
 *
 * Desde P1 A el webhook persiste la señal EN SU MISMA TRANSACCIÓN (escribe
 * `reconcileJobs`) en vez de agendar una mutation posterior, así que lo que hay
 * que mirar es el trabajo durable escrito, no los argumentos del scheduler.
 */
const reconciled = (rows: Map<string, MemoryRow[]>) =>
  [...(rows.get("reconcileJobs") ?? []).map((job) => job.clerkUserId as string)].sort();

async function withEnv(vars: Record<string, string | undefined>, run: () => Promise<void>) {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    await run();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const DEV = { ORBITA_ENVIRONMENT: "development", REVENUECAT_SANDBOX_REVIEW_USER_IDS: undefined };

describe("P1-4 — identidad ordinaria ambigua", () => {
  it("dos usuarios locales para el mismo evento no mutan acceso ni eligen el primero", async () => {
    await withEnv(DEV, async () => {
      const { ctx, rows } = harness({
        users: [
          { _id: "user_uno_id", clerkUserId: "user_uno" },
          { _id: "user_dos_id", clerkUserId: "user_dos" }
        ]
      });
      await apply(ctx, {
        ...BASE,
        type: "INITIAL_PURCHASE",
        app_user_id: "user_uno",
        original_app_user_id: "user_dos",
        product_id: "orbita_monthly",
        expiration_at_ms: FUTURE
      });

      assert.equal(rows.get("subscriptions")?.length, 0, "no se concede a ciegas");
      assert.deepEqual(outcomes(rows), ["ignored_ambiguous_identity"]);
      // Corrección A3: NO se reconcilia ninguno. Los aliases devuelven el mismo
      // `CustomerInfo`, así que reconciliar A y B dejaría Pro a los dos desde
      // una sola compra. Queda en cuarentena para resolverlo a mano.
      assert.deepEqual(reconciled(rows), []);
    });
  });

  it("con un solo usuario resoluble el camino ordinario no cambia", async () => {
    await withEnv(DEV, async () => {
      const { ctx, rows } = harness({ users: [{ _id: "user_uno_id", clerkUserId: "user_uno" }] });
      await apply(ctx, {
        ...BASE,
        type: "INITIAL_PURCHASE",
        app_user_id: "user_uno",
        original_app_user_id: "user_inexistente",
        product_id: "orbita_monthly",
        expiration_at_ms: FUTURE
      });
      assert.equal(rows.get("subscriptions")?.[0]?.entitlement, "orbita_pro");
      assert.deepEqual(outcomes(rows), ["applied"]);
    });
  });
});

describe("P1-1 — todo evento aplicado deja agendada la lectura autoritativa", () => {
  it("una compra aplicada agenda la reconciliación de esa cuenta", async () => {
    await withEnv(DEV, async () => {
      const { ctx, rows } = harness({ users: [{ _id: "u1", clerkUserId: "user_uno" }] });
      await apply(ctx, {
        ...BASE,
        type: "INITIAL_PURCHASE",
        app_user_id: "user_uno",
        product_id: "orbita_monthly",
        expiration_at_ms: FUTURE
      });
      assert.deepEqual(reconciled(rows), ["user_uno"]);
    });
  });

  it("un contexto sin scheduler no rompe la aplicación del evento", async () => {
    await withEnv(DEV, async () => {
      const { ctx, rows } = harness({ users: [{ _id: "u1", clerkUserId: "user_uno" }] });
      const sinScheduler = { db: (ctx as any).db };
      await apply(sinScheduler, {
        ...BASE,
        type: "INITIAL_PURCHASE",
        app_user_id: "user_uno",
        product_id: "orbita_monthly",
        expiration_at_ms: FUTURE
      });
      assert.equal(rows.get("subscriptions")?.[0]?.entitlement, "orbita_pro");
    });
  });
});

describe("P1-2 — eventos sin environment declarado", () => {
  it("un TEMPORARY_ENTITLEMENT_GRANT sin environment no se descarta: se reconcilia", async () => {
    await withEnv(DEV, async () => {
      const { ctx, rows } = harness({ users: [{ _id: "u1", clerkUserId: "user_uno" }] });
      await apply(ctx, {
        id: "rc_grant",
        type: "TEMPORARY_ENTITLEMENT_GRANT",
        event_timestamp_ms: EVENT_AT,
        entitlement_ids: ["orbita_pro"],
        app_user_id: "user_uno",
        expiration_at_ms: FUTURE
      });
      assert.deepEqual(outcomes(rows), ["deferred_unknown_environment"]);
      assert.deepEqual(reconciled(rows), ["user_uno"]);
      // Un entorno ausente NO se lee como production ni concede por sí solo.
      assert.equal(rows.get("subscriptions")?.length, 0);
    });
  });

  it("un TRANSFER sin environment tampoco se descarta: reconcilia ambos lados", async () => {
    await withEnv(DEV, async () => {
      const { ctx, rows } = harness({
        users: [
          { _id: "u1", clerkUserId: "user_origen" },
          { _id: "u2", clerkUserId: "user_destino" }
        ]
      });
      await apply(ctx, {
        id: "rc_transfer_sin_env",
        type: "TRANSFER",
        event_timestamp_ms: EVENT_AT,
        transferred_from: ["user_origen"],
        transferred_to: ["user_destino"]
      });
      assert.deepEqual(outcomes(rows), ["deferred_unknown_environment"]);
      assert.deepEqual(reconciled(rows), ["user_destino", "user_origen"]);
    });
  });
});

describe("P1-2 — TestFlight y App Review contra producción", () => {
  const compra = {
    ...BASE,
    id: "rc_review",
    type: "INITIAL_PURCHASE",
    app_user_id: "user_review",
    product_id: "orbita_monthly",
    expiration_at_ms: FUTURE
  };

  it("producción acepta el Sandbox de la cuenta de review allowlisted", async () => {
    await withEnv(
      { ORBITA_ENVIRONMENT: "production", REVENUECAT_SANDBOX_REVIEW_USER_IDS: "user_review" },
      async () => {
        const { ctx, rows } = harness({ users: [{ _id: "u1", clerkUserId: "user_review" }] });
        await apply(ctx, compra);
        const row = rows.get("subscriptions")?.[0];
        assert.equal(row?.entitlement, "orbita_pro");
        // La fila queda marcada como sandbox: no se mezcla con las productivas.
        assert.equal(row?.environment, "sandbox");
      }
    );
  });

  it("producción sigue rechazando el Sandbox de cualquier otra cuenta", async () => {
    await withEnv(
      { ORBITA_ENVIRONMENT: "production", REVENUECAT_SANDBOX_REVIEW_USER_IDS: "user_review" },
      async () => {
        const { ctx, rows } = harness({ users: [{ _id: "u1", clerkUserId: "user_comun" }] });
        await apply(ctx, { ...compra, app_user_id: "user_comun" });
        assert.equal(rows.get("subscriptions")?.length, 0);
        assert.deepEqual(outcomes(rows), ["ignored_environment_mismatch"]);
      }
    );
  });

  it("un recibo sandbox no pisa una fila productiva de la misma cuenta", async () => {
    await withEnv(
      { ORBITA_ENVIRONMENT: "production", REVENUECAT_SANDBOX_REVIEW_USER_IDS: "user_review" },
      async () => {
        const { ctx, rows } = harness({
          users: [{ _id: "u1", clerkUserId: "user_review" }],
          subscriptions: [
            {
              _id: "sub_prod",
              userId: "u1",
              provider: "revenuecat",
              entitlement: "orbita_pro",
              status: "active",
              currentPeriodEnd: FUTURE,
              environment: "production",
              lastEventAt: EVENT_AT - 10
            }
          ]
        });
        await apply(ctx, compra);
        // Corrección A2: ya no se descarta el evento — las dos filas conviven,
        // cada una con su entorno, y la productiva no se toca.
        const productiva = rows.get("subscriptions")?.find((r) => r.environment === "production");
        const sandbox = rows.get("subscriptions")?.find((r) => r.environment === "sandbox");
        assert.equal(productiva?._id, "sub_prod");
        assert.equal(productiva?.currentPeriodEnd, FUTURE);
        assert.ok(sandbox, "la fila sandbox de review convive con la productiva");
        assert.deepEqual(outcomes(rows), ["applied"]);
      }
    );
  });

  it("un deployment sin entorno declarado no consume NADA", async () => {
    await withEnv(
      {
        ORBITA_ENVIRONMENT: undefined,
        ORBITA_ENV: undefined,
        COMMERCE_MODE: undefined,
        CONVEX_DEPLOYMENT: undefined,
        REVENUECAT_SANDBOX_REVIEW_USER_IDS: undefined
      },
      async () => {
        const { ctx, rows } = harness({ users: [{ _id: "u1", clerkUserId: "user_uno" }] });
        await apply(ctx, { ...compra, app_user_id: "user_uno" });
        assert.equal(rows.get("subscriptions")?.length, 0);
        assert.deepEqual(outcomes(rows), ["ignored_environment_mismatch"]);
      }
    );
  });
});
