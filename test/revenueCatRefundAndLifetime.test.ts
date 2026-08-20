/**
 * Reembolsos (A5) y precedencia lifetime en la proyección (A6).
 *
 * RevenueCat NO tiene un evento `REFUND`: un reembolso llega como
 * `CANCELLATION` con `cancel_reason: "CUSTOMER_SUPPORT"`. Tratarlo como una
 * baja común dejaba el acceso vivo hasta fin de período —y en un lifetime, sin
 * vencimiento, para siempre—.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isRowActive, type SubscriptionRow } from "../convex/lib/entitlements";
import {
  deriveRevenueCatEventDecision,
  guardLifetimePrecedence,
  type RevenueCatExistingState
} from "../convex/lib/revenueCatEvents";
import { applyRevenueCatEvent } from "../convex/payments/revenuecat";
import { projectRevenueCatSubscriber } from "../convex/payments/revenuecatRest";

const NOW = 1_800_000_000_000;
const EVENT_AT = 1_900_000_000_000;
const FUTURE = 2_000_000_000_000;

const evento = (over: Record<string, unknown>) => ({
  id: "rc_refund",
  app_user_id: "user_current",
  event_timestamp_ms: EVENT_AT,
  environment: "SANDBOX",
  entitlement_ids: ["orbita_pro"],
  ...over
});

const MENSUAL: RevenueCatExistingState = {
  entitlement: "orbita_pro",
  status: "active",
  plan: "monthly",
  productId: "orbita_monthly",
  currentPeriodEnd: FUTURE,
  isLifetime: false,
  willRenew: true
};

const LIFETIME: RevenueCatExistingState = {
  entitlement: "orbita_pro",
  status: "active",
  plan: "lifetime",
  productId: "orbita_lifetime",
  isLifetime: true,
  willRenew: false
};

const decidir = (event: Record<string, unknown>, existing?: RevenueCatExistingState) =>
  guardLifetimePrecedence(deriveRevenueCatEventDecision(event, existing), existing);

/**
 * El catálogo permanente es una DECLARACIÓN de configuración (P1 5).
 *
 * Sin ella, ningún evento puede escribir un acceso de por vida a partir del
 * nombre del producto. Estas pruebas ejercitan el catálogo legado, así que lo
 * declaran explícitamente.
 */
function conCatalogoLifetime<T>(run: () => T): T {
  const previo = process.env.REVENUECAT_LIFETIME_PRODUCT_IDS;
  process.env.REVENUECAT_LIFETIME_PRODUCT_IDS = "orbita_lifetime";
  try {
    return run();
  } finally {
    if (previo === undefined) delete process.env.REVENUECAT_LIFETIME_PRODUCT_IDS;
    else process.env.REVENUECAT_LIFETIME_PRODUCT_IDS = previo;
  }
}

describe("A5 — CUSTOMER_SUPPORT es reembolso y retira el acceso ya", () => {
  it("un reembolso del mensual corta el acceso al instante", () => {
    const decision = decidir(
      evento({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", product_id: "orbita_monthly", expiration_at_ms: FUTURE }),
      MENSUAL
    );
    assert.equal(decision.kind, "apply");
    if (decision.kind !== "apply") return;
    const after = { ...MENSUAL, ...decision.patch } as SubscriptionRow;
    assert.equal(
      isRowActive({ ...after, provider: "revenuecat", environment: "sandbox" }, NOW, { sandboxAllowed: true }),
      false,
      "un reembolso no puede conservar acceso hasta fin de período"
    );
  });

  it("un reembolso de un LIFETIME también corta, aunque no tenga vencimiento", () => {
    const decision = decidir(
      evento({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", product_id: "orbita_lifetime" }),
      LIFETIME
    );
    assert.equal(decision.kind, "apply");
    if (decision.kind !== "apply") return;
    const after = { ...LIFETIME, ...decision.patch } as SubscriptionRow;
    assert.equal(after.isLifetime, false);
    assert.equal(
      isRowActive({ ...after, provider: "revenuecat", environment: "sandbox" }, NOW, { sandboxAllowed: true }),
      false
    );
  });

  it("las demás cancelaciones conservan el acceso hasta el fin de período", () => {
    for (const reason of ["UNSUBSCRIBE", "BILLING_ERROR", "DEVELOPER_INITIATED", "PRICE_INCREASE", undefined]) {
      const decision = decidir(
        evento({ type: "CANCELLATION", cancel_reason: reason, product_id: "orbita_monthly", expiration_at_ms: FUTURE }),
        MENSUAL
      );
      assert.equal(decision.kind, "apply", String(reason));
      if (decision.kind !== "apply") continue;
      const after = { ...MENSUAL, ...decision.patch, provider: "revenuecat", environment: "sandbox" } as SubscriptionRow;
      assert.equal(isRowActive(after, NOW, { sandboxAllowed: true }), true, String(reason));
      assert.equal(after.status, "canceled", String(reason));
    }
  });

  it("REFUND_REVERSED sigue restaurando el acceso", () => {
    const decision = decidir(
      evento({ id: "rc_rev", type: "REFUND_REVERSED", product_id: "orbita_monthly", expiration_at_ms: FUTURE }),
      { ...MENSUAL, entitlement: "free", status: "expired" }
    );
    assert.equal(decision.kind, "apply");
    if (decision.kind !== "apply") return;
    assert.equal(decision.patch.entitlement, "orbita_pro");
  });

  it("un REFUND_REVERSED de lifetime restaura el acceso permanente", () => {
    const decision = conCatalogoLifetime(() =>
      decidir(evento({ id: "rc_rev_life", type: "REFUND_REVERSED", product_id: "orbita_lifetime" }), {
        ...LIFETIME,
        entitlement: "free",
        status: "expired",
        isLifetime: false
      })
    );
    assert.equal(decision.kind === "apply" && decision.patch.isLifetime, true);
  });

  it("REPRO: un reembolso sin `product_id` NO apaga la fila mensual", () => {
    // P1 6: la fila es AGREGADA. Un `CANCELLATION` que no dice qué se devolvió
    // escribía `entitlement: "free"` encima igual, y con eso podía apagar un
    // acceso que ese reembolso nunca demostró.
    const decision = decidir(
      evento({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: FUTURE }),
      MENSUAL
    );
    assert.deepEqual(decision, { kind: "ignore", reason: "refund_without_product" });
  });

  it("REPRO: un reembolso de OTRO producto no-lifetime tampoco pisa la fila", () => {
    const decision = decidir(
      evento({
        type: "CANCELLATION",
        cancel_reason: "CUSTOMER_SUPPORT",
        product_id: "orbita_weekly_promo",
        expiration_at_ms: FUTURE
      }),
      MENSUAL
    );
    assert.deepEqual(decision, { kind: "ignore", reason: "refund_product_mismatch" });
  });

  it("una fila sin `productId` no puede ser reembolsada por ningún evento", () => {
    const decision = decidir(
      evento({
        type: "CANCELLATION",
        cancel_reason: "CUSTOMER_SUPPORT",
        product_id: "orbita_monthly",
        expiration_at_ms: FUTURE
      }),
      { ...MENSUAL, productId: undefined }
    );
    assert.deepEqual(decision, { kind: "ignore", reason: "refund_product_mismatch" });
  });

  it("REPRO: sin catálogo declarado, NON_RENEWING_PURCHASE no concede permanente", () => {
    // P1 5: `orbita_lifetime_trial` cumple la convención de nombres y no es un
    // acceso de por vida. El catálogo V1 es mensual: sin declaración, cerrado.
    const decision = decidir(
      evento({ type: "NON_RENEWING_PURCHASE", product_id: "orbita_lifetime_trial" })
    );
    assert.deepEqual(decision, { kind: "ignore", reason: "unsupported_non_renewing_product" });
  });

  it("con el producto DECLARADO, la compra permanente sí se aplica", () => {
    const decision = conCatalogoLifetime(() =>
      decidir(evento({ type: "NON_RENEWING_PURCHASE", product_id: "orbita_lifetime" }))
    );
    assert.equal(decision.kind === "apply" && decision.patch.isLifetime, true);
  });
});

describe("A5 — todo evento canónico con un único usuario reconcilia", () => {
  type MemoryRow = Record<string, any> & { _id: string };
  function harness(seed: Record<string, MemoryRow[]>) {
    const initial: Record<string, MemoryRow[]> = { users: [], subscriptions: [], paymentEvents: [], ...seed };
    const rows = new Map<string, MemoryRow[]>(
      Object.entries(initial).map(([t, e]) => [t, e.map((r) => ({ ...r }))])
    );
    let seq = 0;
    const scheduled: any[] = [];
    const db = {
      query(table: string) {
        const filters = new Map<string, unknown>();
        const q = { eq(f: string, v: unknown) { filters.set(f, v); return q; } };
        return {
          withIndex(_i: string, build: (b: typeof q) => unknown) {
            build(q);
            const found = () => (rows.get(table) ?? []).filter((r) => [...filters].every(([f, v]) => r[f] === v));
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
      }
    };
    return {
      ctx: { db, scheduler: { async runAfter(_d: number, _r: unknown, a: any) { scheduled.push(a); } } },
      rows,
      scheduled
    };
  }
  const apply = async (ctx: unknown, event: Record<string, unknown>) =>
    await (applyRevenueCatEvent as any)._handler(ctx, { event });

  it("una decisión ignorada por datos faltantes igual dispara la lectura autoritativa", async () => {
    const previo = process.env.ORBITA_ENVIRONMENT;
    process.env.ORBITA_ENVIRONMENT = "development";
    try {
      const { ctx, rows } = harness({ users: [{ _id: "u1", clerkUserId: "user_current" }] });
      // CANCELLATION sin fila previa: la decisión local es `ignore`, pero la
      // tienda sí sabe qué pasó y hay que ir a preguntarle.
      await apply(ctx, evento({ id: "rc_cancel_sin_fila", type: "CANCELLATION", expiration_at_ms: FUTURE }));
      assert.match(String(rows.get("paymentEvents")?.[0]?.rawPayload?.outcome), /^ignored_/);
      // P1 A: la señal queda escrita en la misma transacción del webhook.
      assert.deepEqual(
        (rows.get("reconcileJobs") ?? []).map((job) => job.clerkUserId),
        ["user_current"]
      );
    } finally {
      if (previo === undefined) delete process.env.ORBITA_ENVIRONMENT;
      else process.env.ORBITA_ENVIRONMENT = previo;
    }
  });
});

describe("A6 — la reconciliación no degrada ni pierde un lifetime vigente", () => {
  type MemoryRow = Record<string, any> & { _id: string };
  function memoryDb(seed: Record<string, MemoryRow[]>) {
    const initial: Record<string, MemoryRow[]> = { users: [], subscriptions: [], paymentEvents: [], ...seed };
    const rows = new Map<string, MemoryRow[]>(
      Object.entries(initial).map(([t, e]) => [t, e.map((r) => ({ ...r }))])
    );
    let seq = 0;
    const db = {
      query(table: string) {
        const filters = new Map<string, unknown>();
        const q = { eq(f: string, v: unknown) { filters.set(f, v); return q; } };
        return {
          withIndex(_i: string, build: (b: typeof q) => unknown) {
            build(q);
            const found = () => (rows.get(table) ?? []).filter((r) => [...filters].every(([f, v]) => r[f] === v));
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
      }
    };
    return { db, rows };
  }
  const project = async (ctx: unknown, args: Record<string, unknown>) => {
    const previo = process.env.ORBITA_ENVIRONMENT;
    if (previo === undefined) process.env.ORBITA_ENVIRONMENT = "development";
    try {
      return await (projectRevenueCatSubscriber as any)._handler(ctx, args);
    } finally {
      if (previo === undefined) delete process.env.ORBITA_ENVIRONMENT;
    }
  };

  const filaLifetime = {
    _id: "sub_life",
    userId: "u1",
    clerkUserId: "user_current",
    provider: "revenuecat",
    environment: "sandbox",
    entitlement: "orbita_pro",
    status: "active",
    plan: "lifetime",
    isLifetime: true,
    lastEventAt: NOW - 100,
    updatedAt: NOW - 100
  };

  it("una lectura que sólo ve el mensual no apaga el lifetime de la fila", async () => {
    const memory = memoryDb({
      users: [{ _id: "u1", clerkUserId: "user_current" }],
      subscriptions: [{ ...filaLifetime }]
    });
    await project(
      { db: memory.db },
      {
        clerkUserId: "user_current",
        outcome: {
          kind: "resolved",
          observedAt: NOW,
          environment: "sandbox",
          patch: {
            entitlement: "orbita_pro",
            status: "active",
            plan: "monthly",
            productId: "orbita_monthly",
            currentPeriodEnd: FUTURE,
            isLifetime: false,
            willRenew: true
          }
        }
      }
    );
    assert.equal(memory.rows.get("subscriptions")?.[0]?.isLifetime, true);
  });

  it("una lectura vacía tampoco borra el lifetime de la fila", async () => {
    const memory = memoryDb({
      users: [{ _id: "u1", clerkUserId: "user_current" }],
      subscriptions: [{ ...filaLifetime }]
    });
    await project(
      { db: memory.db },
      {
        clerkUserId: "user_current",
        outcome: {
          kind: "resolved",
          observedAt: NOW,
          environment: "sandbox",
          // Alcance declarado y APUNTANDO a esta fila: el apagado llega, y aun
          // así el lifetime sobrevive porque no viene evidencia de reembolso.
          revocation: { kind: "environment", environment: "sandbox" },
          patch: { entitlement: "free", status: "expired", isLifetime: false, willRenew: false }
        }
      }
    );
    const row = memory.rows.get("subscriptions")?.[0];
    assert.equal(row?.isLifetime, true);
    assert.equal(row?.entitlement, "orbita_pro");
  });

  it("el reembolso de un permanente SÓLO llega por webhook del mismo producto", async () => {
    // Decisión de V1 (P1 4): la REST no puede demostrar un reembolso de
    // `non_subscriptions` —la v1 no documenta ese campo ahí— así que la lectura
    // NUNCA retira un permanente. El webhook sí es una afirmación explícita de
    // la tienda, y tiene que nombrar el producto.
    const memory = memoryDb({
      users: [{ _id: "u1", clerkUserId: "user_current" }],
      subscriptions: [{ ...filaLifetime, productId: "orbita_lifetime" }]
    });
    await project(
      { db: memory.db },
      {
        clerkUserId: "user_current",
        outcome: {
          kind: "resolved",
          observedAt: NOW,
          environment: "sandbox",
          revocation: { kind: "environment", environment: "sandbox" },
          patch: { entitlement: "free", status: "expired", isLifetime: false, willRenew: false }
        }
      }
    );
    assert.equal(
      memory.rows.get("subscriptions")?.[0]?.isLifetime,
      true,
      "ninguna lectura REST retira un permanente"
    );

    // El camino que sí lo retira, y que exige el producto.
    const decision = guardLifetimePrecedence(
      {
        kind: "apply",
        allowCreate: false,
        overridesLifetime: true,
        refundedProductId: "orbita_lifetime",
        patch: { entitlement: "free", status: "expired", isLifetime: false, willRenew: false }
      },
      { isLifetime: true, productId: "orbita_lifetime" }
    );
    assert.equal(decision.kind === "apply" && decision.patch.isLifetime, false);
  });

  it("una lectura que SÍ ve el lifetime lo confirma", async () => {
    const memory = memoryDb({ users: [{ _id: "u1", clerkUserId: "user_current" }] });
    await project(
      { db: memory.db },
      {
        clerkUserId: "user_current",
        outcome: {
          kind: "resolved",
          observedAt: NOW,
          environment: "sandbox",
          patch: {
            entitlement: "orbita_pro",
            status: "active",
            plan: "lifetime",
            productId: "orbita_lifetime",
            isLifetime: true,
            willRenew: false
          }
        }
      }
    );
    assert.equal(memory.rows.get("subscriptions")?.[0]?.isLifetime, true);
  });
});
