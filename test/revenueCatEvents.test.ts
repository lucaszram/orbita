import assert from "node:assert/strict";
import test from "node:test";
import { resolveEntitlement } from "../convex/lib/entitlements";
import { applyRevenueCatEvent } from "../convex/payments/revenuecat";
import {
  constantTimeStringEqual,
  deriveRevenueCatEventDecision,
  hasCanonicalRevenueCatEntitlement,
  isRevenueCatEnvironmentAllowed,
  planFromRevenueCatProductId,
  revenueCatEnvironment,
  revenueCatEventTimestamp,
  revenueCatTransferCandidates,
  revenueCatUserCandidates,
  sanitizeRevenueCatEvent
} from "../convex/lib/revenueCatEvents";

const FUTURE = 2_000_000_000_000;
const BASE_EVENT = {
  id: "rc_event_1",
  app_user_id: "user_current",
  event_timestamp_ms: 1_900_000_000_000,
  environment: "SANDBOX",
  entitlement_ids: ["orbita_pro"]
};

type MemoryRow = Record<string, any> & { _id: string };

function revenueCatMemoryDb(seed: Record<string, MemoryRow[]>) {
  const initialRows: Record<string, MemoryRow[]> = {
    users: [],
    subscriptions: [],
    paymentEvents: [],
    ...seed
  };
  const rows = new Map<string, MemoryRow[]>(
    Object.entries(initialRows).map(([table, entries]) => [
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
      const row = { _id: id, ...value } as MemoryRow;
      const tableRows = rows.get(table) ?? [];
      tableRows.push(row);
      rows.set(table, tableRows);
      return id;
    },
    async patch(id: string, value: Record<string, unknown>) {
      for (const tableRows of rows.values()) {
        const row = tableRows.find((entry) => entry._id === id);
        if (row) {
          Object.assign(row, value);
          return;
        }
      }
      throw new Error(`Missing row ${id}`);
    }
  };

  return { db, rows };
}

/**
 * El deployment del harness es `development` de forma EXPLÍCITA.
 *
 * `isRevenueCatEnvironmentAllowed` dejó de asumir development cuando falta
 * configuración: un deployment sin declarar su entorno no consume ningún
 * recibo. Estas pruebas ejercitan el camino de development, así que lo dicen.
 */
async function applyEvent(ctx: unknown, event: Record<string, unknown>) {
  const previous = process.env.ORBITA_ENVIRONMENT;
  process.env.ORBITA_ENVIRONMENT = "development";
  try {
    return await (applyRevenueCatEvent as any)._handler(ctx, { event });
  } finally {
    if (previous === undefined) delete process.env.ORBITA_ENVIRONMENT;
    else process.env.ORBITA_ENVIRONMENT = previous;
  }
}

test("RevenueCat resuelve identidad Clerk sin aceptar ids anónimos", () => {
  assert.deepEqual(
    revenueCatUserCandidates({
      app_user_id: "$RCAnonymousID:current",
      original_app_user_id: "user_original",
      aliases: ["$RCAnonymousID:alias", "user_alias", "user_original"]
    }),
    ["user_original", "user_alias"]
  );

  assert.deepEqual(
    revenueCatTransferCandidates({
      transferred_from: ["$RCAnonymousID:old", "user_source", "user_source"],
      transferred_to: ["user_target"]
    }),
    { from: ["user_source"], to: ["user_target"] }
  );
});

test("RevenueCat reconoce planes sin convertir productos desconocidos", () => {
  assert.equal(planFromRevenueCatProductId("orbita_plus_monthly"), "monthly");
  assert.equal(planFromRevenueCatProductId("orbita-plus-weekly"), "weekly");
  assert.equal(planFromRevenueCatProductId("orbita_annual"), "yearly");
  // P1 5: `lifetime` NO sale de esta tabla. Mientras estuvo, un patch con
  // `plan: "lifetime"` derivado de un substring le daba a un evento autoridad
  // sobre el acceso permanente, y `orbita_lifetime_trial` la cumplía.
  assert.equal(planFromRevenueCatProductId("orbita_lifetime"), undefined);
  assert.equal(planFromRevenueCatProductId("orbita_lifetime_trial"), undefined);
  assert.equal(planFromRevenueCatProductId("credits_pack"), undefined);
});

test("solo el entitlement canónico puede mutar Orbita Plus", () => {
  assert.equal(hasCanonicalRevenueCatEntitlement({ entitlement_ids: ["orbita_pro"] }), true);
  assert.equal(hasCanonicalRevenueCatEntitlement({ entitlement_ids: ["plus"] }), false);
  assert.equal(hasCanonicalRevenueCatEntitlement({ entitlement_ids: ["otro"] }), false);

  assert.deepEqual(
    deriveRevenueCatEventDecision({
      ...BASE_EVENT,
      type: "INITIAL_PURCHASE",
      product_id: "orbita_monthly",
      expiration_at_ms: FUTURE,
      entitlement_ids: ["otro"]
    }),
    { kind: "ignore", reason: "unrelated_entitlement" }
  );

  assert.deepEqual(
    deriveRevenueCatEventDecision(
      {
        ...BASE_EVENT,
        type: "EXPIRATION",
        entitlement_ids: ["otro"],
        expiration_at_ms: FUTURE
      },
      { entitlement: "orbita_pro", status: "active", currentPeriodEnd: FUTURE }
    ),
    { kind: "ignore", reason: "unrelated_entitlement" }
  );
});

test("compra y renovación mensual requieren un fin de período demostrable", () => {
  const purchase = deriveRevenueCatEventDecision({
    ...BASE_EVENT,
    type: "INITIAL_PURCHASE",
    period_type: "TRIAL",
    product_id: "orbita_monthly",
    expiration_at_ms: FUTURE
  });
  assert.equal(purchase.kind, "apply");
  if (purchase.kind === "apply") {
    assert.equal(purchase.allowCreate, true);
    assert.equal(purchase.patch.entitlement, "orbita_pro");
    assert.equal(purchase.patch.status, "trialing");
    assert.equal(purchase.patch.plan, "monthly");
    assert.equal(purchase.patch.currentPeriodEnd, FUTURE);
    assert.equal(purchase.patch.willRenew, true);
  }

  assert.deepEqual(
    deriveRevenueCatEventDecision({ ...BASE_EVENT, type: "RENEWAL", product_id: "orbita_monthly" }),
    { kind: "ignore", reason: "missing_period_end" }
  );
});

test("CANCELLATION conserva el acceso hasta fin de período, salvo reembolso", () => {
  // Corrección A5. Esta prueba afirmaba que `CUSTOMER_SUPPORT` conservaba el
  // acceso hasta el fin de período; era exactamente el defecto. RevenueCat no
  // tiene un evento `REFUND`: el reembolso VIENE como esta cancelación, y ahí
  // el dinero ya volvió.
  const baja = deriveRevenueCatEventDecision(
    { ...BASE_EVENT, type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE", expiration_at_ms: FUTURE },
    { entitlement: "orbita_pro", status: "active", currentPeriodEnd: FUTURE, willRenew: true }
  );
  assert.equal(baja.kind, "apply");
  if (baja.kind === "apply") {
    assert.equal(baja.allowCreate, false);
    assert.equal(baja.patch.entitlement, undefined);
    assert.equal(baja.patch.status, "canceled");
    assert.equal(baja.patch.currentPeriodEnd, FUTURE);
    assert.equal(baja.patch.willRenew, false);

    const despues = {
      entitlement: "orbita_pro" as const,
      provider: "revenuecat" as const,
      environment: "sandbox" as const,
      status: "active" as const,
      currentPeriodEnd: FUTURE,
      willRenew: true,
      ...baja.patch
    };
    assert.equal(resolveEntitlement([despues], FUTURE - 1, { sandboxAllowed: true }).isPro, true);
    assert.equal(resolveEntitlement([despues], FUTURE + 1, { sandboxAllowed: true }).isPro, false);
  }

  // P1 6: un reembolso tiene que demostrar QUÉ producto se devolvió, y ese
  // producto tiene que ser el de la fila. Sin eso no puede escribir Free encima
  // de una fila agregada.
  const reembolso = deriveRevenueCatEventDecision(
    {
      ...BASE_EVENT,
      type: "CANCELLATION",
      cancel_reason: "CUSTOMER_SUPPORT",
      product_id: "orbita_monthly",
      expiration_at_ms: FUTURE
    },
    {
      entitlement: "orbita_pro",
      status: "active",
      productId: "orbita_monthly",
      currentPeriodEnd: FUTURE,
      willRenew: true
    }
  );
  assert.equal(reembolso.kind, "apply");
  if (reembolso.kind === "apply") {
    assert.equal(reembolso.patch.entitlement, "free");
    assert.equal(reembolso.patch.status, "expired");
    assert.equal(reembolso.overridesLifetime, true);
    const despues = {
      entitlement: "orbita_pro" as const,
      provider: "revenuecat" as const,
      environment: "sandbox" as const,
      status: "active" as const,
      currentPeriodEnd: FUTURE,
      ...reembolso.patch
    };
    assert.equal(
      resolveEntitlement([despues], FUTURE - 1, { sandboxAllowed: true }).isPro,
      false,
      "un reembolso corta el acceso en el acto"
    );
  }

  assert.deepEqual(
    deriveRevenueCatEventDecision(
      { ...BASE_EVENT, type: "CANCELLATION" },
      { entitlement: "orbita_pro", status: "active" }
    ),
    { kind: "ignore", reason: "missing_period_end" }
  );
});

test("BILLING_ISSUE usa el grace period y EXPIRATION es el corte terminal", () => {
  const graceEnd = FUTURE + 86_400_000;
  const billing = deriveRevenueCatEventDecision(
    {
      ...BASE_EVENT,
      type: "BILLING_ISSUE",
      expiration_at_ms: FUTURE,
      grace_period_expiration_at_ms: graceEnd
    },
    { entitlement: "orbita_pro", status: "active", currentPeriodEnd: FUTURE }
  );
  assert.equal(billing.kind, "apply");
  if (billing.kind === "apply") {
    assert.equal(billing.patch.status, "billing_issue");
    assert.equal(billing.patch.currentPeriodEnd, graceEnd);
    assert.equal(billing.patch.entitlement, "orbita_pro");
  }

  const expiration = deriveRevenueCatEventDecision(
    { ...BASE_EVENT, type: "EXPIRATION", expiration_at_ms: FUTURE },
    { entitlement: "orbita_pro", status: "billing_issue", currentPeriodEnd: FUTURE }
  );
  assert.equal(expiration.kind, "apply");
  if (expiration.kind === "apply") {
    assert.equal(expiration.patch.entitlement, "free");
    assert.equal(expiration.patch.status, "expired");
    assert.equal(expiration.patch.willRenew, false);
  }
});

test("EXTENDED, REFUND_REVERSED y TEMPORARY_ENTITLEMENT_GRANT cubren lifecycle actual", () => {
  const extended = deriveRevenueCatEventDecision(
    { ...BASE_EVENT, type: "SUBSCRIPTION_EXTENDED", expiration_at_ms: FUTURE },
    { entitlement: "orbita_pro", status: "canceled", currentPeriodEnd: FUTURE - 1, willRenew: false }
  );
  assert.equal(extended.kind, "apply");
  if (extended.kind === "apply") {
    assert.equal(extended.patch.status, "canceled");
    assert.equal(extended.patch.currentPeriodEnd, FUTURE);
    assert.equal(extended.patch.willRenew, false);
  }

  const refundReversed = deriveRevenueCatEventDecision({
    ...BASE_EVENT,
    type: "REFUND_REVERSED",
    product_id: "orbita_monthly",
    expiration_at_ms: FUTURE
  });
  assert.equal(refundReversed.kind, "apply");
  if (refundReversed.kind === "apply") {
    assert.equal(refundReversed.patch.entitlement, "orbita_pro");
    assert.equal(refundReversed.patch.status, "active");
    assert.equal(refundReversed.patch.plan, "monthly");
  }

  const temporary = deriveRevenueCatEventDecision({
    ...BASE_EVENT,
    type: "TEMPORARY_ENTITLEMENT_GRANT",
    expiration_at_ms: FUTURE
  });
  assert.equal(temporary.kind, "apply");
  if (temporary.kind === "apply") {
    assert.equal(temporary.patch.entitlement, "orbita_pro");
    assert.equal(temporary.patch.currentPeriodEnd, FUTURE);
    assert.equal(temporary.patch.willRenew, false);
  }
});

test("NON_RENEWING_PURCHASE sólo concede permanente si el catálogo lo declara", () => {
  // P1 5: antes alcanzaba con que el product id contuviera `lifetime`. Eso es
  // conceder acceso de por vida desde una convención de nombres que este código
  // no controla, y `orbita_lifetime_trial` la cumple sin ser un lifetime.
  for (const productId of ["credits_pack", "orbita_lifetime", "orbita_lifetime_trial"]) {
    assert.deepEqual(
      deriveRevenueCatEventDecision({
        ...BASE_EVENT,
        type: "NON_RENEWING_PURCHASE",
        product_id: productId
      }),
      { kind: "ignore", reason: "unsupported_non_renewing_product" },
      productId
    );
  }

  const previo = process.env.REVENUECAT_LIFETIME_PRODUCT_IDS;
  process.env.REVENUECAT_LIFETIME_PRODUCT_IDS = "orbita_lifetime";
  try {
    const lifetime = deriveRevenueCatEventDecision({
      ...BASE_EVENT,
      type: "NON_RENEWING_PURCHASE",
      product_id: "orbita_lifetime"
    });
    assert.equal(lifetime.kind, "apply");
    if (lifetime.kind === "apply") {
      assert.equal(lifetime.patch.entitlement, "orbita_pro");
      assert.equal(lifetime.patch.isLifetime, true);
      assert.equal(lifetime.patch.plan, "lifetime");
    }
    // Un producto que se le parece pero no está declarado sigue cerrado.
    assert.deepEqual(
      deriveRevenueCatEventDecision({
        ...BASE_EVENT,
        type: "NON_RENEWING_PURCHASE",
        product_id: "orbita_lifetime_trial"
      }),
      { kind: "ignore", reason: "unsupported_non_renewing_product" }
    );
  } finally {
    if (previo === undefined) delete process.env.REVENUECAT_LIFETIME_PRODUCT_IDS;
    else process.env.REVENUECAT_LIFETIME_PRODUCT_IDS = previo;
  }
});

test("la auditoría elimina identidad, aliases y subscriber_attributes", () => {
  const sanitized = sanitizeRevenueCatEvent(
    {
      ...BASE_EVENT,
      type: "TRANSFER",
      aliases: ["user_alias"],
      original_app_user_id: "user_original",
      subscriber_attributes: { email: { value: "persona@example.com" } },
      transferred_from: ["user_source"],
      transferred_to: ["user_target"]
    },
    "applied_transfer"
  );

  assert.equal("app_user_id" in sanitized, false);
  assert.equal("original_app_user_id" in sanitized, false);
  assert.equal("aliases" in sanitized, false);
  assert.equal("subscriber_attributes" in sanitized, false);
  assert.equal(sanitized.transferredFromCount, 1);
  assert.equal(sanitized.transferredToCount, 1);
  assert.equal(sanitized.outcome, "applied_transfer");
});

test("la mutation aplica, deduplica y transfiere solo una fila server-side demostrable", async () => {
  const memory = revenueCatMemoryDb({
    users: [
      { _id: "user_source_id", clerkUserId: "user_source" },
      { _id: "user_target_id", clerkUserId: "user_target" }
    ]
  });
  const ctx = { db: memory.db };
  const purchase = {
    ...BASE_EVENT,
    id: "purchase_1",
    type: "INITIAL_PURCHASE",
    app_user_id: "$RCAnonymousID:purchase",
    original_app_user_id: "user_source",
    product_id: "orbita_monthly",
    expiration_at_ms: FUTURE
  };

  await applyEvent(ctx, purchase);
  await applyEvent(ctx, purchase);

  const sourceAfterPurchase = memory.rows
    .get("subscriptions")
    ?.find((row) => row.userId === "user_source_id");
  assert.equal(sourceAfterPurchase?.entitlement, "orbita_pro");
  assert.equal(sourceAfterPurchase?.plan, "monthly");
  assert.equal(memory.rows.get("paymentEvents")?.length, 1);

  // Baja ordinaria (A5): conserva el acceso hasta el fin de período. Antes acá
  // se usaba `CUSTOMER_SUPPORT`, que ahora es un reembolso y corta en el acto
  // —su regresión propia está en `revenueCatRefundAndLifetime.test.ts`—.
  await applyEvent(ctx, {
    ...BASE_EVENT,
    id: "cancel_1",
    type: "CANCELLATION",
    app_user_id: "user_source",
    event_timestamp_ms: BASE_EVENT.event_timestamp_ms + 1,
    cancel_reason: "UNSUBSCRIBE",
    expiration_at_ms: FUTURE
  });
  assert.equal(sourceAfterPurchase?.entitlement, "orbita_pro");
  assert.equal(sourceAfterPurchase?.status, "canceled");
  assert.equal(sourceAfterPurchase?.currentPeriodEnd, FUTURE);

  await applyEvent(ctx, {
    id: "transfer_1",
    type: "TRANSFER",
    event_timestamp_ms: BASE_EVENT.event_timestamp_ms + 2,
    environment: "SANDBOX",
    transferred_from: ["user_source"],
    transferred_to: ["user_target"]
  });

  const target = memory.rows
    .get("subscriptions")
    ?.find((row) => row.userId === "user_target_id");
  assert.equal(sourceAfterPurchase?.entitlement, "free");
  assert.equal(sourceAfterPurchase?.status, "expired");
  assert.equal(target?.entitlement, "orbita_pro");
  assert.equal(target?.status, "canceled");
  assert.equal(target?.providerCustomerId, "user_target");
  assert.equal(memory.rows.get("paymentEvents")?.length, 3);
});

test("usuario todavía ausente queda sin marcar para el retry acotado", async () => {
  const memory = revenueCatMemoryDb({});
  await assert.rejects(
    () =>
      applyEvent(
        { db: memory.db },
        {
          ...BASE_EVENT,
          id: "pending_user_1",
          type: "INITIAL_PURCHASE",
          app_user_id: "user_pending",
          product_id: "orbita_monthly",
          expiration_at_ms: FUTURE
        }
      ),
    /user is not available yet/
  );
  assert.equal(memory.rows.get("subscriptions")?.length, 0);
  assert.equal(memory.rows.get("paymentEvents")?.length, 0);
});

test("evento de otro entitlement queda auditado sin mutar una suscripción vigente", async () => {
  const memory = revenueCatMemoryDb({
    users: [{ _id: "user_current_id", clerkUserId: "user_current" }],
    subscriptions: [
      {
        _id: "subscription_current",
        userId: "user_current_id",
        clerkUserId: "user_current",
        provider: "revenuecat",
        entitlement: "orbita_pro",
        status: "active",
        currentPeriodEnd: FUTURE,
        environment: "sandbox",
        lastEventAt: BASE_EVENT.event_timestamp_ms - 1
      }
    ]
  });

  await applyEvent(
    { db: memory.db },
    {
      ...BASE_EVENT,
      id: "unrelated_expiration_1",
      type: "EXPIRATION",
      entitlement_ids: ["otro"],
      expiration_at_ms: BASE_EVENT.event_timestamp_ms
    }
  );

  const subscription = memory.rows.get("subscriptions")?.[0];
  assert.equal(subscription?.entitlement, "orbita_pro");
  assert.equal(subscription?.status, "active");
  const audit = memory.rows.get("paymentEvents")?.[0];
  assert.equal(audit?.rawPayload?.outcome, "ignored_unrelated_entitlement");
  assert.equal("subscriber_attributes" in (audit?.rawPayload ?? {}), false);
});

test("environment, timestamp y Authorization fallan cerrados", () => {
  assert.equal(revenueCatEnvironment({ environment: "SANDBOX" }), "sandbox");
  assert.equal(revenueCatEnvironment({ environment: "PRODUCTION" }), "production");
  assert.equal(revenueCatEnvironment({ environment: "UNKNOWN" }), undefined);
  // El gate pasó a recibir opciones porque producción necesita saber QUIÉN
  // compró: TestFlight y App Review generan Sandbox con el binario productivo.
  const prod = { ORBITA_ENVIRONMENT: "production" };
  const dev = { CONVEX_DEPLOYMENT: "dev:test" };
  assert.equal(isRevenueCatEnvironmentAllowed("production", { env: prod }), true);
  assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env: prod }), false);
  assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env: dev }), true);
  assert.equal(isRevenueCatEnvironmentAllowed("production", { env: dev }), false);
  // Y un deployment sin entorno declarado no consume nada.
  assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env: {} }), false);
  assert.equal(isRevenueCatEnvironmentAllowed("production", { env: {} }), false);
  assert.equal(revenueCatEventTimestamp({ event_timestamp_ms: 123 }), 123);
  assert.equal(revenueCatEventTimestamp({ event_timestamp_ms: Number.NaN }), undefined);
  assert.equal(constantTimeStringEqual("Bearer correcto", "Bearer correcto"), true);
  assert.equal(constantTimeStringEqual("Bearer correcto", "Bearer distinto"), false);
  assert.equal(constantTimeStringEqual("corto", "mucho-mas-largo"), false);
});
