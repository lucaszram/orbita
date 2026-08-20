/**
 * RevenueCat — ramas del lifecycle que todavía no tenían regresión.
 *
 * `test/revenueCatEvents.test.ts` cubre compra, renovación, cancelación,
 * billing issue, expiración, extensión, reembolso revertido, grant temporal y
 * transferencia. Falta lo que puede conceder acceso SIN una compra demostrable
 * (`PRODUCT_CHANGE`, `UNCANCELLATION`, `SUBSCRIPTION_PAUSED`, tipos
 * desconocidos) y el corte de entorno visto desde la mutation completa.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyRevenueCatEvent } from "../convex/payments/revenuecat";
import {
  deriveRevenueCatEventDecision,
  type RevenueCatExistingState
} from "../convex/lib/revenueCatEvents";

const FUTURE = 2_000_000_000_000;
const LATER = 2_100_000_000_000;
const EVENT_AT = 1_900_000_000_000;

const SANDBOX_EVENT = {
  id: "rc_lifecycle_1",
  app_user_id: "user_current",
  event_timestamp_ms: EVENT_AT,
  environment: "SANDBOX",
  entitlement_ids: ["orbita_pro"]
};

const VIGENTE: RevenueCatExistingState = {
  entitlement: "orbita_pro",
  status: "active",
  plan: "monthly",
  productId: "orbita_monthly",
  currentPeriodEnd: FUTURE,
  isLifetime: false,
  willRenew: true
};

type MemoryRow = Record<string, any> & { _id: string };

function memoryDb(seed: Record<string, MemoryRow[]>) {
  const initial: Record<string, MemoryRow[]> = {
    users: [],
    subscriptions: [],
    paymentEvents: [],
    ...seed
  };
  const rows = new Map<string, MemoryRow[]>(
    Object.entries(initial).map(([table, entries]) => [
      table,
      entries.map((entry) => ({ ...entry }))
    ])
  );
  let sequence = 0;

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
        withIndex(_index: string, build: (builder: typeof q) => unknown) {
          build(q);
          const found = () =>
            (rows.get(table) ?? []).filter((row) =>
              [...filters].every(([field, value]) => row[field] === value)
            );
          return { first: async () => found()[0] ?? null, collect: async () => found() };
        }
      };
    },
    async insert(table: string, value: Record<string, unknown>) {
      const id = `${table}_${++sequence}`;
      const tableRows = rows.get(table) ?? [];
      tableRows.push({ _id: id, ...value } as MemoryRow);
      rows.set(table, tableRows);
      return id;
    },
    async patch(id: string, value: Record<string, unknown>) {
      for (const tableRows of rows.values()) {
        const row = tableRows.find((entry) => entry._id === id);
        if (row) return void Object.assign(row, value);
      }
      throw new Error(`Missing row ${id}`);
    }
  };

  return { db, rows };
}

async function applyEvent(ctx: unknown, event: Record<string, unknown>) {
  return await (applyRevenueCatEvent as any)._handler(ctx, { event });
}

/**
 * Corre un caso con el entorno declarado y lo restituye pase lo que pase.
 *
 * `undefined` ya no significa "development por defecto": desde el
 * endurecimiento del gate, un deployment sin declarar no consume ningún
 * recibo. Los casos que ejercitan development lo declaran explícitamente.
 */
async function withEnv(value: string | undefined, run: () => Promise<void>) {
  const previous = process.env.ORBITA_ENVIRONMENT;
  if (value === undefined) delete process.env.ORBITA_ENVIRONMENT;
  else process.env.ORBITA_ENVIRONMENT = value;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.ORBITA_ENVIRONMENT;
    else process.env.ORBITA_ENVIRONMENT = previous;
  }
}

describe("PRODUCT_CHANGE — cambia el producto, nunca concede el acceso", () => {
  it("sin una fila previa no inventa una suscripción", () => {
    const decision = deriveRevenueCatEventDecision({
      ...SANDBOX_EVENT,
      type: "PRODUCT_CHANGE",
      new_product_id: "orbita_monthly_v2",
      expiration_at_ms: LATER
    });
    assert.deepEqual(decision, { kind: "ignore", reason: "missing_subscription" });
  });

  it("sobre una fila vigente actualiza plan y período sin tocar el entitlement", () => {
    const decision = deriveRevenueCatEventDecision(
      {
        ...SANDBOX_EVENT,
        type: "PRODUCT_CHANGE",
        new_product_id: "orbita_monthly_v2",
        expiration_at_ms: LATER
      },
      VIGENTE
    );
    assert.equal(decision.kind, "apply");
    if (decision.kind !== "apply") return;
    assert.equal(decision.allowCreate, false);
    assert.deepEqual(decision.patch, {
      plan: "monthly",
      productId: "orbita_monthly_v2",
      currentPeriodEnd: LATER
    });
    // El acceso no se concede ni se revoca desde un cambio de producto.
    assert.equal("entitlement" in decision.patch, false);
    assert.equal("status" in decision.patch, false);
  });

  it("prefiere el producto nuevo sobre el viejo del mismo evento", () => {
    const decision = deriveRevenueCatEventDecision(
      {
        ...SANDBOX_EVENT,
        type: "PRODUCT_CHANGE",
        product_id: "orbita_monthly",
        new_product_id: "orbita_monthly_v2",
        expiration_at_ms: LATER
      },
      VIGENTE
    );
    assert.equal(decision.kind === "apply" && decision.patch.productId, "orbita_monthly_v2");
  });
});

describe("UNCANCELLATION — sólo repone una baja que existía", () => {
  it("sin fila previa no reactiva nada", () => {
    assert.deepEqual(
      deriveRevenueCatEventDecision({
        ...SANDBOX_EVENT,
        type: "UNCANCELLATION",
        expiration_at_ms: FUTURE
      }),
      { kind: "ignore", reason: "missing_subscription" }
    );
  });

  it("sin fecha demostrable, ni en el evento ni en la fila, no reactiva", () => {
    assert.deepEqual(
      deriveRevenueCatEventDecision(
        { ...SANDBOX_EVENT, type: "UNCANCELLATION" },
        { ...VIGENTE, status: "canceled", currentPeriodEnd: undefined }
      ),
      { kind: "ignore", reason: "missing_period_end" }
    );
  });

  it("repone la renovación conservando el fin de período conocido", () => {
    const decision = deriveRevenueCatEventDecision(
      { ...SANDBOX_EVENT, type: "UNCANCELLATION" },
      { ...VIGENTE, status: "canceled", willRenew: false }
    );
    assert.equal(decision.kind, "apply");
    if (decision.kind !== "apply") return;
    assert.equal(decision.allowCreate, false);
    assert.equal(decision.patch.status, "active");
    assert.equal(decision.patch.willRenew, true);
    assert.equal(decision.patch.currentPeriodEnd, FUTURE);
    assert.equal(decision.patch.isLifetime, false);
  });
});

describe("SUBSCRIPTION_PAUSED — se trata como una baja, no como una expiración", () => {
  it("conserva el acceso hasta el fin del período informado", () => {
    const decision = deriveRevenueCatEventDecision(
      { ...SANDBOX_EVENT, type: "SUBSCRIPTION_PAUSED", expiration_at_ms: FUTURE },
      VIGENTE
    );
    assert.equal(decision.kind, "apply");
    if (decision.kind !== "apply") return;
    assert.deepEqual(decision.patch, {
      status: "canceled",
      currentPeriodEnd: FUTURE,
      willRenew: false
    });
  });

  it("sin fecha demostrable no toca la fila, para no revocar antes de tiempo", () => {
    assert.deepEqual(
      deriveRevenueCatEventDecision(
        { ...SANDBOX_EVENT, type: "SUBSCRIPTION_PAUSED" },
        { ...VIGENTE, currentPeriodEnd: undefined }
      ),
      { kind: "ignore", reason: "missing_period_end" }
    );
  });
});

describe("formas que no se aceptan", () => {
  it("un evento sin tipo no se interpreta", () => {
    assert.deepEqual(deriveRevenueCatEventDecision({ ...SANDBOX_EVENT }), {
      kind: "ignore",
      reason: "missing_type"
    });
  });

  it("un tipo nuevo de RevenueCat no concede acceso por defecto", () => {
    assert.deepEqual(
      deriveRevenueCatEventDecision({ ...SANDBOX_EVENT, type: "INVOICE_ISSUANCE" }, VIGENTE),
      { kind: "ignore", reason: "unsupported_event" }
    );
  });

  it("un evento de otro entitlement se descarta antes que cualquier otra rama", () => {
    assert.deepEqual(
      deriveRevenueCatEventDecision(
        { ...SANDBOX_EVENT, type: "INITIAL_PURCHASE", entitlement_ids: ["otro_pro"], expiration_at_ms: FUTURE },
        VIGENTE
      ),
      { kind: "ignore", reason: "unrelated_entitlement" }
    );
  });

  it("TRANSFER se resuelve fuera de la conversión ordinaria", () => {
    assert.deepEqual(deriveRevenueCatEventDecision({ ...SANDBOX_EVENT, type: "TRANSFER" }), {
      kind: "transfer"
    });
  });
});

describe("entorno — cada deployment consume sólo sus recibos", () => {
  const user = { _id: "user_current_id", clerkUserId: "user_current" };
  const compra = {
    ...SANDBOX_EVENT,
    id: "purchase_env",
    type: "INITIAL_PURCHASE",
    product_id: "orbita_monthly",
    expiration_at_ms: FUTURE
  };

  it("producción rechaza un recibo SANDBOX y lo deja auditado", async () => {
    await withEnv("production", async () => {
      const memory = memoryDb({ users: [user] });
      await applyEvent({ db: memory.db }, compra);

      assert.equal(memory.rows.get("subscriptions")?.length, 0);
      const audit = memory.rows.get("paymentEvents")?.[0];
      assert.equal(audit?.rawPayload?.outcome, "ignored_environment_mismatch");
      // La auditoría conserva a quién correspondía, sin datos personales.
      assert.equal(audit?.clerkUserId, "user_current");
      assert.equal("app_user_id" in (audit?.rawPayload ?? {}), false);
    });
  });

  it("development rechaza un recibo PRODUCTION", async () => {
    await withEnv("development", async () => {
      const memory = memoryDb({ users: [user] });
      await applyEvent({ db: memory.db }, { ...compra, environment: "PRODUCTION" });

      assert.equal(memory.rows.get("subscriptions")?.length, 0);
      assert.equal(
        memory.rows.get("paymentEvents")?.[0]?.rawPayload?.outcome,
        "ignored_environment_mismatch"
      );
    });
  });

  it("un entorno que no se reconoce no aplica nada y difiere a la lectura autoritativa", async () => {
    // Antes se descartaba en seco. Ahora se difiere, que es más seguro en las
    // dos direcciones: sigue sin aplicar el evento —un entorno ilegible nunca
    // concede— pero deja agendada la lectura REST, que sí conoce el entorno
    // real del recibo y aplica el mismo corte antes de conceder. Es el mismo
    // camino que necesitan `TRANSFER` y `TEMPORARY_ENTITLEMENT_GRANT`, que
    // llegan legítimamente sin `environment`.
    await withEnv("development", async () => {
      const memory = memoryDb({ users: [user] });
      const ctx = {
        db: memory.db,
        scheduler: {
          async runAfter(_d: number, _ref: unknown, _args: any) {
            return "sched_1";
          }
        }
      };
      await applyEvent(ctx, { ...compra, environment: "STAGING" });

      assert.equal(memory.rows.get("subscriptions")?.length, 0);
      assert.equal(
        memory.rows.get("paymentEvents")?.[0]?.rawPayload?.outcome,
        "deferred_unknown_environment"
      );
      // Desde P1 A la señal se persiste en la MISMA transacción del webhook:
      // lo que hay que mirar es el trabajo durable, no el scheduler.
      assert.deepEqual(
        (memory.rows.get("reconcileJobs") ?? []).map((job) => job.clerkUserId),
        ["user_current"]
      );
    });
  });

  it("development sí aplica su propio recibo SANDBOX", async () => {
    await withEnv("development", async () => {
      const memory = memoryDb({ users: [user] });
      await applyEvent({ db: memory.db }, compra);

      const row = memory.rows.get("subscriptions")?.[0];
      assert.equal(row?.entitlement, "orbita_pro");
      assert.equal(row?.environment, "sandbox");
      assert.equal(row?.clerkUserId, "user_current");
    });
  });
});

describe("orden y aliases dentro de la mutation", () => {
  const user = { _id: "user_current_id", clerkUserId: "user_current" };

  it("un evento viejo no pisa el estado ya aplicado", async () => {
    await withEnv("development", async () => {
      const memory = memoryDb({ users: [user] });
      const ctx = { db: memory.db };

      await applyEvent(ctx, {
        ...SANDBOX_EVENT,
        id: "renewal_new",
        type: "RENEWAL",
        product_id: "orbita_monthly",
        event_timestamp_ms: EVENT_AT + 10,
        expiration_at_ms: LATER
      });
      await applyEvent(ctx, {
        ...SANDBOX_EVENT,
        id: "expiration_old",
        type: "EXPIRATION",
        event_timestamp_ms: EVENT_AT,
        expiration_at_ms: FUTURE
      });

      const row = memory.rows.get("subscriptions")?.[0];
      assert.equal(row?.entitlement, "orbita_pro");
      assert.equal(row?.currentPeriodEnd, LATER);
      assert.equal(
        memory.rows.get("paymentEvents")?.[1]?.rawPayload?.outcome,
        "ignored_stale_event"
      );
    });
  });

  it("resuelve por alias cuando el app_user_id visible no existe en Convex", async () => {
    await withEnv("development", async () => {
      const memory = memoryDb({ users: [user] });
      await applyEvent(
        { db: memory.db },
        {
          ...SANDBOX_EVENT,
          id: "alias_purchase",
          type: "INITIAL_PURCHASE",
          app_user_id: "$RCAnonymousID:pending",
          original_app_user_id: "user_desconocido",
          aliases: ["$RCAnonymousID:pending", "user_current"],
          product_id: "orbita_monthly",
          expiration_at_ms: FUTURE
        }
      );

      const row = memory.rows.get("subscriptions")?.[0];
      assert.equal(row?.userId, "user_current_id");
      assert.equal(row?.providerCustomerId, "user_current");
      // Los aliases se usan para resolver, pero no se guardan.
      assert.equal("aliases" in (memory.rows.get("paymentEvents")?.[0]?.rawPayload ?? {}), false);
    });
  });

  it("una transferencia hacia una cuenta ausente es reintentable, no un descarte", async () => {
    await withEnv("development", async () => {
      const memory = memoryDb({ users: [user] });
      await assert.rejects(
        () =>
          applyEvent(
            { db: memory.db },
            {
              id: "transfer_pending",
              type: "TRANSFER",
              event_timestamp_ms: EVENT_AT,
              environment: "SANDBOX",
              transferred_from: ["user_current"],
              transferred_to: ["user_todavia_no_creado"]
            }
          ),
        /is not available yet/
      );
      // Sin marcar el evento, el retry acotado de RevenueCat todavía sirve.
      assert.equal(memory.rows.get("paymentEvents")?.length, 0);
      assert.equal(memory.rows.get("subscriptions")?.length, 0);
    });
  });
});
