/**
 * Alcance de un webhook: a QUIÉN toca, QUÉ producto demuestra y en QUÉ entorno.
 *
 * Tres defectos de la tercera auditoría que comparten el mismo error de forma:
 * el webhook actuaba con menos precisión de la que el evento realmente prueba.
 *
 * - P1 4: `overridesLifetime` marcaba "este evento manda sobre el acceso
 *   permanente" sin decir de qué producto era el reembolso. Un `CANCELLATION`
 *   con `cancel_reason: "CUSTOMER_SUPPORT"` del MENSUAL borraba un lifetime que
 *   nadie devolvió.
 * - P1 5: la rama sin `environment` agendaba la reconciliación de TODOS los
 *   candidatos crudos del evento —app_user_id, original_app_user_id, aliases— y
 *   después marcaba el evento como procesado. Con un alias apuntando a otra
 *   cuenta local, una sola compra reparaba dos cuentas hacia Pro.
 * - P1 6: el TRANSFER leía la fila de origen y destino con `first()` sobre
 *   (usuario, proveedor). Desde que production y sandbox conviven, el orden del
 *   índice decidía cuál fila se movía.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyRevenueCatEvent } from "../convex/payments/revenuecat";
import {
  deriveRevenueCatEventDecision,
  guardLifetimePrecedence,
  hasCanonicalRevenueCatEntitlement,
  transferOverwritesTarget,
  type TransferRowState
} from "../convex/lib/revenueCatEvents";

const EVENT_AT = 1_900_000_000_000;
const PAST = 1_700_000_000_000;
const FUTURE = 2_000_000_000_000;

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
  const scheduled: any[] = [];

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
      async runAfter(_d: number, _ref: unknown, args: any) {
        scheduled.push(args);
        return `sched_${scheduled.length}`;
      }
    }
  };

  /**
   * Cuentas con reparación pedida.
   *
   * Se lee de `reconcileJobs`, no del scheduler: desde P1 A el webhook persiste
   * la señal EN SU MISMA TRANSACCIÓN en vez de agendar una mutation posterior,
   * así que lo que hay que mirar es el trabajo durable escrito, que además es
   * la garantía que importa.
   */
  const reconciliados = () =>
    [...(rows.get("reconcileJobs") ?? []).map((job) => job.clerkUserId as string)].sort();

  return { ctx, db, rows, scheduled, reconciliados };
}

const apply = async (ctx: unknown, event: Record<string, unknown>) =>
  await (applyRevenueCatEvent as any)._handler(ctx, { event });

async function conEnv(vars: Record<string, string | undefined>, run: () => Promise<void>) {
  const previos: Record<string, string | undefined> = {};
  for (const [clave, valor] of Object.entries(vars)) {
    previos[clave] = process.env[clave];
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
  try {
    await run();
  } finally {
    for (const [clave, valor] of Object.entries(previos)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  }
}

async function enDesarrollo(run: () => Promise<void>) {
  await conEnv({ ORBITA_ENVIRONMENT: "development" }, run);
}

const outcomes = (rows: Map<string, MemoryRow[]>) =>
  (rows.get("paymentEvents") ?? []).map((e) => (e.rawPayload as any)?.outcome);

const filaLifetime = (over: Record<string, unknown> = {}): MemoryRow => ({
  _id: "sub_life",
  userId: "u_a",
  clerkUserId: "user_a",
  provider: "revenuecat",
  entitlement: "orbita_pro",
  status: "active",
  plan: "lifetime",
  productId: "orbita_lifetime",
  isLifetime: true,
  willRenew: false,
  environment: "sandbox",
  updatedAt: PAST,
  ...over
});

// ---------------------------------------------------------------------------
// P1 4 — un reembolso sólo retira el producto que demuestra
// ---------------------------------------------------------------------------

describe("P1 4 — un reembolso del mensual no borra un lifetime distinto", () => {
  it("REPRO: CUSTOMER_SUPPORT de `orbita_monthly` sobre una fila lifetime la preserva", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows, reconciliados } = harness({
        users: [{ _id: "u_a", clerkUserId: "user_a" }],
        subscriptions: [filaLifetime()]
      });
      await apply(ctx, {
        id: "rc_refund_mensual",
        type: "CANCELLATION",
        cancel_reason: "CUSTOMER_SUPPORT",
        event_timestamp_ms: EVENT_AT,
        environment: "SANDBOX",
        entitlement_ids: ["orbita_pro"],
        app_user_id: "user_a",
        product_id: "orbita_monthly",
        expiration_at_ms: EVENT_AT
      });

      const fila = rows.get("subscriptions")?.[0];
      assert.equal(fila?.isLifetime, true, "el acceso permanente sobrevive");
      assert.equal(fila?.entitlement, "orbita_pro");
      assert.notEqual(fila?.status, "expired");
      // Y la identidad del lifetime tampoco la pisa un evento del mensual: sin
      // `productId` no habría con qué demostrar el reembolso real de mañana.
      assert.equal(fila?.plan, "lifetime");
      assert.equal(fila?.productId, "orbita_lifetime");
      // P1 6: el reembolso ni siquiera llega a aplicarse recortado. No puede
      // demostrar que lo devuelto sea lo de esta fila, así que se difiere.
      assert.deepEqual(outcomes(rows), ["ignored_refund_product_mismatch"]);
      assert.deepEqual(
        reconciliados(),
        ["user_a"],
        "y la tienda decide, que sí ve el catálogo completo"
      );
    });
  });

  it("REPRO: un CUSTOMER_SUPPORT sin `product_id` tampoco apaga la fila", async () => {
    // P1 6: la fila es AGREGADA. Un reembolso que no dice qué se devolvió
    // escribía `entitlement: "free"` encima igual.
    await enDesarrollo(async () => {
      const { ctx, rows, reconciliados } = harness({
        users: [{ _id: "u_a", clerkUserId: "user_a" }],
        subscriptions: [
          filaLifetime({ plan: "monthly", productId: "orbita_monthly", isLifetime: false })
        ]
      });
      await apply(ctx, {
        id: "rc_refund_sin_producto",
        type: "CANCELLATION",
        cancel_reason: "CUSTOMER_SUPPORT",
        event_timestamp_ms: EVENT_AT,
        environment: "SANDBOX",
        entitlement_ids: ["orbita_pro"],
        app_user_id: "user_a",
        expiration_at_ms: EVENT_AT
      });

      const fila = rows.get("subscriptions")?.[0];
      assert.equal(fila?.entitlement, "orbita_pro");
      assert.notEqual(fila?.status, "expired");
      assert.deepEqual(outcomes(rows), ["ignored_refund_without_product"]);
      assert.deepEqual(
        reconciliados(),
        ["user_a"]
      );
    });
  });

  it("CUSTOMER_SUPPORT del PROPIO producto lifetime sí lo retira", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows } = harness({
        users: [{ _id: "u_a", clerkUserId: "user_a" }],
        subscriptions: [filaLifetime()]
      });
      await apply(ctx, {
        id: "rc_refund_lifetime",
        type: "CANCELLATION",
        cancel_reason: "CUSTOMER_SUPPORT",
        event_timestamp_ms: EVENT_AT,
        environment: "SANDBOX",
        entitlement_ids: ["orbita_pro"],
        app_user_id: "user_a",
        product_id: "orbita_lifetime",
        expiration_at_ms: EVENT_AT
      });

      const fila = rows.get("subscriptions")?.[0];
      assert.equal(fila?.isLifetime, false, "el dinero volvió: el acceso se retira");
      assert.equal(fila?.entitlement, "free");
      assert.equal(fila?.status, "expired");
      assert.deepEqual(outcomes(rows), ["applied"]);
    });
  });

  it("una EXPIRATION del mensual tampoco pisa la identidad del lifetime", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows } = harness({
        users: [{ _id: "u_a", clerkUserId: "user_a" }],
        subscriptions: [filaLifetime()]
      });
      await apply(ctx, {
        id: "rc_exp_mensual",
        type: "EXPIRATION",
        event_timestamp_ms: EVENT_AT,
        environment: "SANDBOX",
        entitlement_ids: ["orbita_pro"],
        app_user_id: "user_a",
        product_id: "orbita_monthly",
        expiration_at_ms: EVENT_AT
      });

      const fila = rows.get("subscriptions")?.[0];
      assert.equal(fila?.isLifetime, true);
      assert.equal(fila?.plan, "lifetime");
      assert.equal(fila?.productId, "orbita_lifetime");
    });
  });

  it("REPRO: un INITIAL_PURCHASE de `orbita_lifetime_trial` NO destruye un lifetime real", async () => {
    // P1 5: `planFromRevenueCatProductId` devolvía "lifetime" por substring, el
    // patch salía con `plan: "lifetime"` y `guardLifetimePrecedence` lo leía
    // como autoridad sobre el acceso permanente. Un producto de PRUEBA con
    // vencimiento finito arrasaba con una compra de por vida.
    await enDesarrollo(async () => {
      const { ctx, rows } = harness({
        users: [{ _id: "u_a", clerkUserId: "user_a" }],
        subscriptions: [filaLifetime()]
      });
      await apply(ctx, {
        id: "rc_trial_compra",
        type: "INITIAL_PURCHASE",
        event_timestamp_ms: EVENT_AT,
        environment: "SANDBOX",
        entitlement_ids: ["orbita_pro"],
        app_user_id: "user_a",
        product_id: "orbita_lifetime_trial",
        expiration_at_ms: EVENT_AT + 1000
      });

      const fila = rows.get("subscriptions")?.[0];
      assert.equal(fila?.isLifetime, true, "el acceso permanente sobrevive");
      assert.equal(fila?.plan, "lifetime");
      assert.equal(fila?.productId, "orbita_lifetime", "conserva su identidad");
      assert.deepEqual(outcomes(rows), ["applied_lifetime_preserved"]);
    });
  });

  it("sólo un producto DECLARADO permanente tiene autoridad sobre un lifetime", () => {
    const existente = { isLifetime: true, productId: "orbita_lifetime" };
    // Sin la marca explícita, un patch que dice `plan: "lifetime"` no alcanza.
    const porNombre = guardLifetimePrecedence(
      {
        kind: "apply",
        allowCreate: true,
        patch: {
          entitlement: "orbita_pro",
          status: "active",
          plan: "lifetime",
          productId: "orbita_lifetime_trial",
          isLifetime: true,
          willRenew: false
        }
      },
      existente
    );
    if (porNombre.kind !== "apply") return assert.fail("debería aplicar recortado");
    assert.equal(porNombre.preservedLifetime, true);
    assert.equal(porNombre.patch.productId, undefined, "no le roba la identidad al permanente");

    // Con la marca Y el mismo producto, sí.
    const autorizado = guardLifetimePrecedence(
      {
        kind: "apply",
        allowCreate: true,
        lifetimeAuthority: true,
        patch: {
          entitlement: "orbita_pro",
          status: "active",
          plan: "lifetime",
          productId: "orbita_lifetime",
          isLifetime: true,
          willRenew: false
        }
      },
      existente
    );
    if (autorizado.kind !== "apply") return assert.fail("debería aplicar");
    assert.equal(autorizado.patch.isLifetime, true);
    assert.notEqual(autorizado.preservedLifetime, true);
  });

  it("la decisión pura: sin producto demostrado, el reembolso no manda", () => {
    const existing = { isLifetime: true, productId: "orbita_lifetime" };
    const sinProducto = guardLifetimePrecedence(
      {
        kind: "apply",
        allowCreate: false,
        overridesLifetime: true,
        patch: { entitlement: "free", status: "expired", isLifetime: false, willRenew: false }
      },
      existing
    );
    assert.equal(sinProducto.kind, "apply");
    if (sinProducto.kind !== "apply") return;
    assert.equal(sinProducto.patch.entitlement, undefined);
    assert.equal(sinProducto.patch.isLifetime, undefined);
    assert.equal(sinProducto.preservedLifetime, true);
  });

  it("la decisión pura: el reembolso del propio producto sí baja el acceso", () => {
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
    if (decision.kind !== "apply") return assert.fail("debería aplicar");
    assert.equal(decision.patch.entitlement, "free");
    assert.equal(decision.patch.isLifetime, false);
    assert.notEqual(decision.preservedLifetime, true);
  });

  it("el derivador transporta QUÉ producto se reembolsó cuando coincide", () => {
    const decision = deriveRevenueCatEventDecision(
      {
        type: "CANCELLATION",
        cancel_reason: "CUSTOMER_SUPPORT",
        entitlement_ids: ["orbita_pro"],
        product_id: "orbita_lifetime",
        event_timestamp_ms: EVENT_AT
      },
      { isLifetime: true, productId: "orbita_lifetime" }
    );
    if (decision.kind !== "apply") return assert.fail("debería aplicar");
    assert.equal(decision.overridesLifetime, true);
    assert.equal(decision.refundedProductId, "orbita_lifetime");
  });

  it("REPRO: un reembolso con `entitlement_id` SINGULAR no se ignora", async () => {
    // RevenueCat documenta `entitlement_ids` como **Sometimes**: los eventos de
    // lifecycle pueden traer sólo el singular. Mirar únicamente el array dejaba
    // un `CANCELLATION` con `cancel_reason: "CUSTOMER_SUPPORT"` —un REEMBOLSO—
    // en `ignored_unrelated_entitlement`, sin aplicar y sin reconciliar.
    await enDesarrollo(async () => {
      const { ctx, rows, reconciliados } = harness({
        users: [{ _id: "u_a", clerkUserId: "user_a" }],
        subscriptions: [
          filaLifetime({ plan: "monthly", productId: "orbita_monthly", isLifetime: false })
        ]
      });
      await apply(ctx, {
        id: "rc_refund_singular",
        type: "CANCELLATION",
        cancel_reason: "CUSTOMER_SUPPORT",
        event_timestamp_ms: EVENT_AT,
        environment: "SANDBOX",
        // Sin `entitlement_ids`: sólo el singular, como llega el lifecycle.
        entitlement_id: "orbita_pro",
        app_user_id: "user_a",
        product_id: "orbita_monthly",
        expiration_at_ms: EVENT_AT
      });

      const fila = rows.get("subscriptions")?.[0];
      assert.equal(fila?.entitlement, "free", "el reembolso se aplica");
      assert.equal(fila?.status, "expired");
      assert.deepEqual(outcomes(rows), ["applied"]);
      assert.deepEqual(
        reconciliados(),
        ["user_a"],
        "y se reconcilia contra la tienda"
      );
    });
  });

  it("el helper reconoce las dos formas y sólo el id canónico", () => {
    assert.equal(hasCanonicalRevenueCatEntitlement({ entitlement_ids: ["orbita_pro"] }), true);
    assert.equal(hasCanonicalRevenueCatEntitlement({ entitlement_id: "orbita_pro" }), true);
    // Nada ajeno entra por ninguna de las dos puertas.
    assert.equal(hasCanonicalRevenueCatEntitlement({ entitlement_id: "otro" }), false);
    assert.equal(hasCanonicalRevenueCatEntitlement({ entitlement_id: "orbita_pro_extra" }), false);
    assert.equal(hasCanonicalRevenueCatEntitlement({ entitlement_ids: ["otro"] }), false);
    assert.equal(hasCanonicalRevenueCatEntitlement({ entitlement_id: 42 }), false);
    assert.equal(hasCanonicalRevenueCatEntitlement({ entitlement_id: ["orbita_pro"] }), false);
    assert.equal(hasCanonicalRevenueCatEntitlement({}), false);
  });

  it("un evento con `entitlement_id` ajeno sigue sin tocar Órbita Plus", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows } = harness({
        users: [{ _id: "u_a", clerkUserId: "user_a" }],
        subscriptions: [
          filaLifetime({ plan: "monthly", productId: "orbita_monthly", isLifetime: false })
        ]
      });
      await apply(ctx, {
        id: "rc_refund_ajeno",
        type: "CANCELLATION",
        cancel_reason: "CUSTOMER_SUPPORT",
        event_timestamp_ms: EVENT_AT,
        environment: "SANDBOX",
        entitlement_id: "otro_entitlement",
        app_user_id: "user_a",
        product_id: "orbita_monthly",
        expiration_at_ms: EVENT_AT
      });
      assert.equal(rows.get("subscriptions")?.[0]?.entitlement, "orbita_pro");
      assert.deepEqual(outcomes(rows), ["ignored_unrelated_entitlement"]);
    });
  });

  it("el derivador NO aplica un reembolso de otro producto (P1 6)", () => {
    assert.deepEqual(
      deriveRevenueCatEventDecision(
        {
          type: "CANCELLATION",
          cancel_reason: "CUSTOMER_SUPPORT",
          entitlement_ids: ["orbita_pro"],
          product_id: "orbita_monthly",
          event_timestamp_ms: EVENT_AT
        },
        { isLifetime: true, productId: "orbita_lifetime" }
      ),
      { kind: "ignore", reason: "refund_product_mismatch" }
    );
  });
});

// ---------------------------------------------------------------------------
// P1 5 — identidad resuelta ANTES de agendar
// ---------------------------------------------------------------------------

describe("P1 5 — un evento sin entorno resuelve identidad antes de reparar", () => {
  const grantSinEntorno = (over: Record<string, unknown> = {}) => ({
    id: "rc_grant_sin_entorno",
    type: "TEMPORARY_ENTITLEMENT_GRANT",
    event_timestamp_ms: EVENT_AT,
    entitlement_ids: ["orbita_pro"],
    app_user_id: "user_a",
    product_id: "orbita_monthly",
    expiration_at_ms: FUTURE,
    ...over
  });

  it("REPRO: A con alias B que también existe queda en CUARENTENA y no repara a ninguno", async () => {
    // El defecto: se agendaba la reconciliación de A y de B. Los aliases
    // devuelven el MISMO `CustomerInfo`, así que una sola compra le daba Pro a
    // las dos cuentas.
    await enDesarrollo(async () => {
      const { ctx, rows, reconciliados } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ]
      });
      await apply(ctx, grantSinEntorno({ aliases: ["user_b"] }));

      assert.deepEqual(reconciliados(), [], "identidad ambigua no reconcilia a nadie");
      assert.deepEqual(outcomes(rows), ["ignored_ambiguous_identity"]);
      assert.equal(rows.get("subscriptions")?.length, 0);
    });
  });

  it("una sola identidad resuelta reconcilia SÓLO a ese usuario", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows, reconciliados } = harness({
        users: [{ _id: "u_a", clerkUserId: "user_a" }]
      });
      // El alias no tiene cuenta local: no agrega identidad.
      await apply(ctx, grantSinEntorno({ aliases: ["user_sin_cuenta"] }));

      assert.deepEqual(
        reconciliados(),
        ["user_a"]
      );
      assert.deepEqual(outcomes(rows), ["deferred_unknown_environment"]);
    });
  });

  it("cero matches sigue siendo RECUPERABLE: no se marca como procesado", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows, reconciliados } = harness({ users: [] });
      await assert.rejects(() => apply(ctx, grantSinEntorno()));
      assert.deepEqual(reconciliados(), []);
      assert.equal(rows.get("paymentEvents")?.length, 0, "el retry de RevenueCat lo vuelve a traer");
    });
  });

  it("REPRO: sin scheduler NO se marca terminal una reparación que nunca quedó agendada", async () => {
    await enDesarrollo(async () => {
      const { db, rows } = harness({ users: [{ _id: "u_a", clerkUserId: "user_a" }] });
      await assert.rejects(() => apply({ db }, grantSinEntorno()));
      assert.equal(rows.get("paymentEvents")?.length, 0);
    });
  });

  it("un TRANSFER sin entorno resuelve las DOS puntas y agenda las dos", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows, reconciliados } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ]
      });
      await apply(ctx, {
        id: "rc_transfer_sin_entorno",
        type: "TRANSFER",
        event_timestamp_ms: EVENT_AT,
        transferred_from: ["user_a"],
        transferred_to: ["user_b"]
      });

      assert.deepEqual(
        reconciliados(),
        ["user_a", "user_b"],
        "son dos cuentas legítimamente distintas, no una identidad ambigua"
      );
      assert.deepEqual(outcomes(rows), ["deferred_unknown_environment"]);
    });
  });

  it("un TRANSFER sin entorno con una punta ambigua queda en cuarentena", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows, reconciliados } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" },
          { _id: "u_c", clerkUserId: "user_c" }
        ]
      });
      await apply(ctx, {
        id: "rc_transfer_ambiguo",
        type: "TRANSFER",
        event_timestamp_ms: EVENT_AT,
        transferred_from: ["user_a"],
        transferred_to: ["user_b", "user_c"]
      });
      assert.deepEqual(reconciliados(), []);
      assert.deepEqual(outcomes(rows), ["ignored_ambiguous_identity"]);
    });
  });

  it("un evento sin ningún candidato queda auditado y no repara nada", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows, reconciliados } = harness({ users: [] });
      await apply(ctx, {
        id: "rc_sin_candidatos",
        type: "TEMPORARY_ENTITLEMENT_GRANT",
        event_timestamp_ms: EVENT_AT,
        entitlement_ids: ["orbita_pro"],
        app_user_id: "$RCAnonymousID:abc"
      });
      assert.deepEqual(reconciliados(), []);
      assert.deepEqual(outcomes(rows), ["ignored_without_resolvable_user"]);
    });
  });
});

// ---------------------------------------------------------------------------
// P1 6 — el TRANSFER mueve la fila del entorno del evento
// ---------------------------------------------------------------------------

describe("P1 6 — TRANSFER elige origen y destino por entorno", () => {
  const filaDe = (over: Record<string, unknown>): MemoryRow => ({
    _id: "sub",
    provider: "revenuecat",
    entitlement: "orbita_pro",
    status: "active",
    plan: "monthly",
    productId: "orbita_monthly",
    currentPeriodEnd: FUTURE,
    isLifetime: false,
    willRenew: true,
    updatedAt: PAST,
    ...over
  });

  it("REPRO: con la production primero, un TRANSFER sandbox usa la SANDBOX", async () => {
    // El defecto: `first()` traía la fila production, el corte de entorno la
    // descartaba y el TRANSFER se perdía entero — la compra sandbox se quedaba
    // en la cuenta vieja.
    await enDesarrollo(async () => {
      const { ctx, rows } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ],
        subscriptions: [
          filaDe({ _id: "sub_a_prod", userId: "u_a", clerkUserId: "user_a", environment: "production" }),
          filaDe({ _id: "sub_a_sand", userId: "u_a", clerkUserId: "user_a", environment: "sandbox" })
        ]
      });

      await apply(ctx, {
        id: "rc_transfer_sandbox",
        type: "TRANSFER",
        event_timestamp_ms: EVENT_AT,
        environment: "SANDBOX",
        transferred_from: ["user_a"],
        transferred_to: ["user_b"]
      });

      const filas = rows.get("subscriptions") ?? [];
      const origenSandbox = filas.find((f) => f._id === "sub_a_sand");
      const origenProduction = filas.find((f) => f._id === "sub_a_prod");
      const destino = filas.find((f) => f.userId === "u_b");

      assert.equal(origenSandbox?.entitlement, "free", "la fila sandbox se vacía");
      assert.equal(origenSandbox?.status, "expired");
      assert.equal(
        origenProduction?.entitlement,
        "orbita_pro",
        "la production NO la toca un evento de sandbox"
      );
      assert.ok(destino, "el destino recibe la fila");
      assert.equal(destino?.entitlement, "orbita_pro");
      assert.equal(destino?.environment, "sandbox");
      assert.deepEqual(outcomes(rows), ["applied_transfer"]);
    });
  });

  it("el destino con fila de OTRO entorno recibe una fila propia y no la pisa", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ],
        subscriptions: [
          filaDe({ _id: "sub_a_sand", userId: "u_a", clerkUserId: "user_a", environment: "sandbox" }),
          filaDe({
            _id: "sub_b_prod",
            userId: "u_b",
            clerkUserId: "user_b",
            environment: "production",
            productId: "orbita_monthly_prod"
          })
        ]
      });

      await apply(ctx, {
        id: "rc_transfer_sandbox_2",
        type: "TRANSFER",
        event_timestamp_ms: EVENT_AT,
        environment: "SANDBOX",
        transferred_from: ["user_a"],
        transferred_to: ["user_b"]
      });

      const filas = rows.get("subscriptions") ?? [];
      const destinoProd = filas.find((f) => f._id === "sub_b_prod");
      const destinoSand = filas.find((f) => f.userId === "u_b" && f.environment === "sandbox");
      assert.equal(destinoProd?.productId, "orbita_monthly_prod", "la production del destino intacta");
      assert.ok(destinoSand, "y la sandbox transferida existe aparte");
    });
  });

  it("REPRO: en producción con allowlist vacía, un TRANSFER SANDBOX no mueve nada", async () => {
    // P1 2: el camino ordinario aplicaba el corte de entorno por identidad,
    // pero el TRANSFER no. Un recibo Sandbox que producción no acepta de nadie
    // movía Órbita Plus de A a B —y de paso apagaba la fila de A—.
    await conEnv(
      { ORBITA_ENVIRONMENT: "production", REVENUECAT_SANDBOX_REVIEW_USER_IDS: undefined },
      async () => {
        const { ctx, rows } = harness({
          users: [
            { _id: "u_a", clerkUserId: "user_a" },
            { _id: "u_b", clerkUserId: "user_b" }
          ],
          subscriptions: [
            filaDe({ _id: "sub_a_sand", userId: "u_a", clerkUserId: "user_a", environment: "sandbox" })
          ]
        });

        await apply(ctx, {
          id: "rc_transfer_prod_sandbox",
          type: "TRANSFER",
          event_timestamp_ms: EVENT_AT,
          environment: "SANDBOX",
          transferred_from: ["user_a"],
          transferred_to: ["user_b"]
        });

        const filas = rows.get("subscriptions") ?? [];
        assert.equal(filas.length, 1, "no se crea la fila del destino");
        assert.equal(filas[0].entitlement, "orbita_pro", "y la del origen no se apaga");
        assert.deepEqual(outcomes(rows), ["ignored_environment_mismatch"]);
      }
    );
  });

  it("un deployment SIN entorno declarado tampoco deja mover nada", async () => {
    await conEnv(
      {
        ORBITA_ENVIRONMENT: undefined,
        ORBITA_ENV: undefined,
        COMMERCE_MODE: undefined,
        CONVEX_DEPLOYMENT: undefined
      },
      async () => {
        const { ctx, rows } = harness({
          users: [
            { _id: "u_a", clerkUserId: "user_a" },
            { _id: "u_b", clerkUserId: "user_b" }
          ],
          subscriptions: [
            filaDe({ _id: "sub_a_sand", userId: "u_a", clerkUserId: "user_a", environment: "sandbox" })
          ]
        });

        await apply(ctx, {
          id: "rc_transfer_unknown",
          type: "TRANSFER",
          event_timestamp_ms: EVENT_AT,
          environment: "SANDBOX",
          transferred_from: ["user_a"],
          transferred_to: ["user_b"]
        });

        assert.equal(rows.get("subscriptions")?.length, 1);
        assert.equal(rows.get("subscriptions")?.[0].entitlement, "orbita_pro");
        assert.deepEqual(outcomes(rows), ["ignored_environment_mismatch"]);
      }
    );
  });

  it("en producción con la cuenta de review allowlisted, el TRANSFER sandbox sí corre", async () => {
    await conEnv(
      {
        ORBITA_ENVIRONMENT: "production",
        REVENUECAT_SANDBOX_REVIEW_USER_IDS: "user_a,user_b"
      },
      async () => {
        const { ctx, rows } = harness({
          users: [
            { _id: "u_a", clerkUserId: "user_a" },
            { _id: "u_b", clerkUserId: "user_b" }
          ],
          subscriptions: [
            filaDe({ _id: "sub_a_sand", userId: "u_a", clerkUserId: "user_a", environment: "sandbox" })
          ]
        });

        await apply(ctx, {
          id: "rc_transfer_review",
          type: "TRANSFER",
          event_timestamp_ms: EVENT_AT,
          environment: "SANDBOX",
          transferred_from: ["user_a"],
          transferred_to: ["user_b"]
        });

        assert.deepEqual(outcomes(rows), ["applied_transfer"]);
        assert.equal(
          (rows.get("subscriptions") ?? []).find((f) => f.userId === "u_b")?.entitlement,
          "orbita_pro"
        );
      }
    );
  });

  it("una sola punta fuera de la allowlist alcanza para no mover nada", async () => {
    await conEnv(
      { ORBITA_ENVIRONMENT: "production", REVENUECAT_SANDBOX_REVIEW_USER_IDS: "user_b" },
      async () => {
        const { ctx, rows } = harness({
          users: [
            { _id: "u_a", clerkUserId: "user_a" },
            { _id: "u_b", clerkUserId: "user_b" }
          ],
          subscriptions: [
            filaDe({ _id: "sub_a_sand", userId: "u_a", clerkUserId: "user_a", environment: "sandbox" })
          ]
        });

        await apply(ctx, {
          id: "rc_transfer_media_allowlist",
          type: "TRANSFER",
          event_timestamp_ms: EVENT_AT,
          environment: "SANDBOX",
          transferred_from: ["user_a"],
          transferred_to: ["user_b"]
        });

        // Apagar la fila de A desde un recibo que producción no le acepta a A
        // es tan grave como concederlo: el corte se exige en las dos puntas.
        assert.equal(rows.get("subscriptions")?.[0].entitlement, "orbita_pro");
        assert.deepEqual(outcomes(rows), ["ignored_environment_mismatch"]);
      }
    );
  });

  it("sin fila del entorno del evento el TRANSFER es RECUPERABLE, no terminal", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ],
        subscriptions: [
          filaDe({ _id: "sub_a_prod", userId: "u_a", clerkUserId: "user_a", environment: "production" })
        ]
      });

      await assert.rejects(() =>
        apply(ctx, {
          id: "rc_transfer_sin_origen",
          type: "TRANSFER",
          event_timestamp_ms: EVENT_AT,
          environment: "SANDBOX",
          transferred_from: ["user_a"],
          transferred_to: ["user_b"]
        })
      );
      assert.equal(rows.get("paymentEvents")?.length, 0);
    });
  });
});

// ---------------------------------------------------------------------------
// P1 7 — un TRANSFER no degrada el acceso permanente del destino
// ---------------------------------------------------------------------------

describe("P1 7 — precedencia en el destino de un TRANSFER", () => {
  const mensual = (over: Record<string, unknown>): MemoryRow => ({
    _id: "sub",
    provider: "revenuecat",
    entitlement: "orbita_pro",
    status: "active",
    plan: "monthly",
    productId: "orbita_monthly",
    currentPeriodEnd: FUTURE,
    isLifetime: false,
    willRenew: true,
    environment: "sandbox",
    updatedAt: PAST,
    ...over
  });

  const permanente = (over: Record<string, unknown>): MemoryRow => ({
    _id: "sub",
    provider: "revenuecat",
    entitlement: "orbita_pro",
    status: "active",
    plan: "lifetime",
    productId: "orbita_lifetime",
    isLifetime: true,
    willRenew: false,
    environment: "sandbox",
    updatedAt: PAST,
    ...over
  });

  const transferir = async (ctx: unknown) =>
    await apply(ctx, {
      id: "rc_transfer_precedencia",
      type: "TRANSFER",
      event_timestamp_ms: EVENT_AT,
      environment: "SANDBOX",
      transferred_from: ["user_a"],
      transferred_to: ["user_b"]
    });

  it("REPRO: un mensual transferido NO pisa el lifetime del destino", async () => {
    // El defecto: la fila de origen se copiaba ENTERA sobre el destino, así que
    // `isLifetime: false` y `productId: orbita_monthly` borraban un acceso
    // permanente que nadie había reembolsado.
    await enDesarrollo(async () => {
      const { ctx, rows, reconciliados } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ],
        subscriptions: [
          mensual({ _id: "sub_a", userId: "u_a", clerkUserId: "user_a" }),
          permanente({ _id: "sub_b", userId: "u_b", clerkUserId: "user_b" })
        ]
      });

      await transferir(ctx);

      const filas = rows.get("subscriptions") ?? [];
      const destino = filas.find((f) => f._id === "sub_b");
      const origen = filas.find((f) => f._id === "sub_a");

      assert.equal(destino?.isLifetime, true, "el acceso permanente sobrevive");
      assert.equal(destino?.plan, "lifetime");
      assert.equal(destino?.productId, "orbita_lifetime", "conserva su identidad");
      assert.equal(destino?.entitlement, "orbita_pro");

      // La fuente se apaga igual, en la misma transacción: la compra se movió.
      assert.equal(origen?.entitlement, "free");
      assert.equal(origen?.status, "expired");

      assert.deepEqual(outcomes(rows), ["applied_transfer_target_preserved"]);
      assert.deepEqual(
        reconciliados(),
        ["user_a", "user_b"],
        "las dos cuentas se reconcilian contra la tienda"
      );
    });
  });

  it("REPRO: una fuente Free/vencida no apaga un destino con acceso vigente", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ],
        subscriptions: [
          mensual({
            _id: "sub_a",
            userId: "u_a",
            clerkUserId: "user_a",
            entitlement: "free",
            status: "expired",
            currentPeriodEnd: PAST
          }),
          mensual({ _id: "sub_b", userId: "u_b", clerkUserId: "user_b" })
        ]
      });

      await transferir(ctx);

      const destino = (rows.get("subscriptions") ?? []).find((f) => f._id === "sub_b");
      assert.equal(destino?.entitlement, "orbita_pro", "el destino conserva su acceso");
      assert.equal(destino?.currentPeriodEnd, FUTURE);
      assert.deepEqual(outcomes(rows), ["applied_transfer_target_preserved"]);
    });
  });

  it("REPRO: un mensual más corto no acorta el mensual más largo del destino", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ],
        subscriptions: [
          mensual({
            _id: "sub_a",
            userId: "u_a",
            clerkUserId: "user_a",
            currentPeriodEnd: FUTURE - 10_000_000
          }),
          mensual({ _id: "sub_b", userId: "u_b", clerkUserId: "user_b", currentPeriodEnd: FUTURE })
        ]
      });

      await transferir(ctx);

      const destino = (rows.get("subscriptions") ?? []).find((f) => f._id === "sub_b");
      assert.equal(destino?.currentPeriodEnd, FUTURE, "el período del destino no se acorta");
      assert.deepEqual(outcomes(rows), ["applied_transfer_target_preserved"]);
    });
  });

  it("un mensual MÁS LARGO sí se aplica: no degrada", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ],
        subscriptions: [
          mensual({ _id: "sub_a", userId: "u_a", clerkUserId: "user_a", currentPeriodEnd: FUTURE }),
          mensual({
            _id: "sub_b",
            userId: "u_b",
            clerkUserId: "user_b",
            currentPeriodEnd: FUTURE - 10_000_000
          })
        ]
      });

      await transferir(ctx);

      const destino = (rows.get("subscriptions") ?? []).find((f) => f._id === "sub_b");
      assert.equal(destino?.currentPeriodEnd, FUTURE);
      assert.deepEqual(outcomes(rows), ["applied_transfer"]);
    });
  });

  it("un lifetime transferido SÍ se aplica sobre el mensual del destino", async () => {
    // El caso honesto opuesto: la transferencia sube de rango. La fila del
    // destino es agregada, así que la verdad del mensual que tenía se pierde;
    // por eso el evento reconcilia las dos cuentas contra la tienda.
    await enDesarrollo(async () => {
      const { ctx, rows, reconciliados } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ],
        subscriptions: [
          permanente({ _id: "sub_a", userId: "u_a", clerkUserId: "user_a" }),
          mensual({ _id: "sub_b", userId: "u_b", clerkUserId: "user_b" })
        ]
      });

      await transferir(ctx);

      const filas = rows.get("subscriptions") ?? [];
      const destino = filas.find((f) => f._id === "sub_b");
      assert.equal(destino?.isLifetime, true);
      assert.equal(destino?.productId, "orbita_lifetime");
      assert.equal(filas.find((f) => f._id === "sub_a")?.entitlement, "free");
      assert.deepEqual(outcomes(rows), ["applied_transfer"]);
      assert.deepEqual(reconciliados(), ["user_a", "user_b"]);
    });
  });

  it("REPRO: el lifetime A no reemplaza al lifetime B ni le roba su productId", async () => {
    // La fila es AGREGADA y no puede representar dos compras permanentes
    // distintas. Copiar la de A encima destruía la de B —y con ella el
    // `productId`, que es lo único con lo que después se demuestra un reembolso.
    await enDesarrollo(async () => {
      const { ctx, rows, reconciliados } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ],
        subscriptions: [
          permanente({ _id: "sub_a", userId: "u_a", clerkUserId: "user_a", productId: "orbita_lifetime_a" }),
          permanente({ _id: "sub_b", userId: "u_b", clerkUserId: "user_b" })
        ]
      });

      await transferir(ctx);

      const filas = rows.get("subscriptions") ?? [];
      assert.equal(filas.find((f) => f._id === "sub_b")?.productId, "orbita_lifetime");
      assert.equal(filas.find((f) => f._id === "sub_b")?.isLifetime, true);
      assert.deepEqual(outcomes(rows), ["applied_transfer_target_preserved"]);
      assert.deepEqual(reconciliados(), ["user_a", "user_b"]);
    });
  });

  it("el MISMO producto permanente sí puede reescribirse a sí mismo", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ],
        subscriptions: [
          permanente({ _id: "sub_a", userId: "u_a", clerkUserId: "user_a" }),
          permanente({ _id: "sub_b", userId: "u_b", clerkUserId: "user_b" })
        ]
      });

      await transferir(ctx);

      const filas = rows.get("subscriptions") ?? [];
      assert.equal(filas.find((f) => f._id === "sub_b")?.isLifetime, true);
      assert.deepEqual(outcomes(rows), ["applied_transfer"]);
    });
  });

  it("REPRO: una fuente dada de baja no pisa un destino que renueva con el MISMO vencimiento", async () => {
    // El ranking sólo comparaba `currentPeriodEnd >=`, así que dos mensuales
    // con la misma fecha eran "equivalentes" — y la fuente `canceled` /
    // `willRenew: false` se escribía encima de un destino `active` /
    // `willRenew: true` y encima le copiaba el estado cancelado.
    await enDesarrollo(async () => {
      const { ctx, rows, reconciliados } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ],
        subscriptions: [
          mensual({
            _id: "sub_a",
            userId: "u_a",
            clerkUserId: "user_a",
            status: "canceled",
            willRenew: false,
            currentPeriodEnd: FUTURE
          }),
          mensual({
            _id: "sub_b",
            userId: "u_b",
            clerkUserId: "user_b",
            status: "active",
            willRenew: true,
            currentPeriodEnd: FUTURE
          })
        ]
      });

      await transferir(ctx);

      const destino = (rows.get("subscriptions") ?? []).find((f) => f._id === "sub_b");
      assert.equal(destino?.status, "active", "el destino conserva su estado");
      assert.equal(destino?.willRenew, true, "y su renovación");
      assert.equal(destino?.currentPeriodEnd, FUTURE);
      // La fuente se apaga igual y las dos cuentas se reconcilian.
      assert.equal((rows.get("subscriptions") ?? []).find((f) => f._id === "sub_a")?.entitlement, "free");
      assert.deepEqual(outcomes(rows), ["applied_transfer_target_preserved"]);
      assert.deepEqual(reconciliados(), ["user_a", "user_b"]);
    });
  });

  it("al revés SÍ se aplica: una fuente que renueva sobre un destino dado de baja", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ],
        subscriptions: [
          mensual({
            _id: "sub_a",
            userId: "u_a",
            clerkUserId: "user_a",
            status: "active",
            willRenew: true,
            currentPeriodEnd: FUTURE
          }),
          mensual({
            _id: "sub_b",
            userId: "u_b",
            clerkUserId: "user_b",
            status: "canceled",
            willRenew: false,
            currentPeriodEnd: FUTURE
          })
        ]
      });

      await transferir(ctx);

      const destino = (rows.get("subscriptions") ?? []).find((f) => f._id === "sub_b");
      assert.equal(destino?.status, "active");
      assert.equal(destino?.willRenew, true);
      assert.deepEqual(outcomes(rows), ["applied_transfer"]);
    });
  });

  it("REPRO: una fuente con acceso SÍ pisa un destino Free que conservó su fecha", async () => {
    // El ranking caía directo en la fecha, así que una fuente `orbita_pro`
    // vigente no podía escribirse sobre un destino `free` cuya fila conservaba
    // un `currentPeriodEnd` más lejano — y esa fila existe: un reembolso
    // (`CUSTOMER_SUPPORT`) deja `free` sin borrar la fecha. Como la fuente se
    // apaga igual, las dos cuentas quedaban en Free.
    await enDesarrollo(async () => {
      const { ctx, rows, reconciliados } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ],
        subscriptions: [
          mensual({
            _id: "sub_a",
            userId: "u_a",
            clerkUserId: "user_a",
            status: "active",
            willRenew: true,
            currentPeriodEnd: FUTURE - 100_000_000
          }),
          mensual({
            _id: "sub_b",
            userId: "u_b",
            clerkUserId: "user_b",
            entitlement: "free",
            status: "expired",
            willRenew: false,
            currentPeriodEnd: FUTURE
          })
        ]
      });

      await transferir(ctx);

      const filas = rows.get("subscriptions") ?? [];
      const destino = filas.find((f) => f._id === "sub_b");
      const origen = filas.find((f) => f._id === "sub_a");

      assert.equal(destino?.entitlement, "orbita_pro", "el acceso se movió de verdad");
      assert.equal(destino?.status, "active");
      assert.equal(destino?.willRenew, true);
      assert.equal(destino?.currentPeriodEnd, FUTURE - 100_000_000);
      assert.equal(origen?.entitlement, "free", "y la fuente se apaga");
      assert.deepEqual(outcomes(rows), ["applied_transfer"]);
      assert.deepEqual(reconciliados(), ["user_a", "user_b"]);
    });
  });

  it("el ranking es explícito: tipo, después vigencia, después estado/renovación", () => {
    const renueva = (currentPeriodEnd = FUTURE): TransferRowState => ({
      entitlement: "orbita_pro",
      status: "active",
      willRenew: true,
      currentPeriodEnd
    });
    const dadoDeBaja = (currentPeriodEnd = FUTURE): TransferRowState => ({
      entitlement: "orbita_pro",
      status: "canceled",
      willRenew: false,
      currentPeriodEnd
    });
    const vencido: TransferRowState = {
      entitlement: "free",
      status: "expired",
      currentPeriodEnd: PAST
    };
    const permanenteA: TransferRowState = {
      entitlement: "orbita_pro",
      isLifetime: true,
      productId: "life_a"
    };
    const permanenteB: TransferRowState = {
      entitlement: "orbita_pro",
      isLifetime: true,
      productId: "life_b"
    };
    const CORTO = FUTURE - 10_000_000;
    /** Fila sin acceso que conservó su fecha: la que deja un reembolso. */
    const libreConFecha: TransferRowState = {
      entitlement: "free",
      status: "expired",
      willRenew: false,
      currentPeriodEnd: FUTURE
    };

    // Sin destino no hay nada que degradar.
    assert.equal(transferOverwritesTarget(renueva(), null), true);
    // 0. Acceso, ANTES que tipo y fecha.
    assert.equal(
      transferOverwritesTarget(renueva(CORTO), libreConFecha),
      true,
      "una fecha que sobrevivió en una fila sin acceso no le gana a una que sí lo otorga"
    );
    assert.equal(transferOverwritesTarget(libreConFecha, renueva(CORTO)), false);
    assert.equal(
      transferOverwritesTarget(libreConFecha, libreConFecha),
      true,
      "ninguna otorga: escribir es idempotente y no concede nada"
    );
    assert.equal(
      transferOverwritesTarget(renueva(CORTO), permanenteA),
      false,
      "pero otorgar no le gana a un permanente: el tipo sigue mandando"
    );
    // 1. Tipo.
    assert.equal(transferOverwritesTarget(renueva(), permanenteA), false);
    assert.equal(transferOverwritesTarget(permanenteA, permanenteB), false);
    assert.equal(transferOverwritesTarget(permanenteA, permanenteA), true);
    assert.equal(transferOverwritesTarget(permanenteA, renueva()), true);
    // 2. Vigencia.
    assert.equal(transferOverwritesTarget(renueva(CORTO), renueva()), false);
    assert.equal(transferOverwritesTarget(renueva(), renueva(CORTO)), true);
    // 3. Estado y renovación, con el MISMO vencimiento.
    assert.equal(transferOverwritesTarget(dadoDeBaja(), renueva()), false);
    assert.equal(transferOverwritesTarget(renueva(), dadoDeBaja()), true);
    assert.equal(transferOverwritesTarget(renueva(), renueva()), true, "igual fuerza: idempotente");
    // La vigencia manda sobre el estado: una baja con MÁS días sí se aplica.
    assert.equal(transferOverwritesTarget(dadoDeBaja(), renueva(CORTO)), true);
    // Una fuente sin acceso nunca apaga un destino que sí lo tiene.
    assert.equal(transferOverwritesTarget(vencido, renueva()), false);
    assert.equal(transferOverwritesTarget(vencido, { entitlement: "free" }), true);
  });

  it("sin fila en el destino, el mensual transferido crea la suya", async () => {
    await enDesarrollo(async () => {
      const { ctx, rows } = harness({
        users: [
          { _id: "u_a", clerkUserId: "user_a" },
          { _id: "u_b", clerkUserId: "user_b" }
        ],
        subscriptions: [mensual({ _id: "sub_a", userId: "u_a", clerkUserId: "user_a" })]
      });

      await transferir(ctx);

      const destino = (rows.get("subscriptions") ?? []).find((f) => f.userId === "u_b");
      assert.equal(destino?.entitlement, "orbita_pro");
      assert.equal(destino?.plan, "monthly");
      assert.deepEqual(outcomes(rows), ["applied_transfer"]);
    });
  });
});
