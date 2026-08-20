/**
 * De QUIÉN es este snapshot, y sobre qué entorno manda (P1 1, 3, 4, 5).
 *
 * ## El agujero grande
 *
 * `GET /v1/subscribers/{B}` no devuelve "lo de B": devuelve el `CustomerInfo`
 * del **alias chain**. Si A y B quedaron aliased en RevenueCat, la respuesta de
 * B trae `subscriber.original_app_user_id: A` y describe la compra de A. Al
 * ignorar ese campo, el mismo pago se proyectaba a las DOS cuentas: una compra,
 * dos accesos pagos.
 *
 * ## Los otros tres, todos de precisión
 *
 * - La evidencia de reembolso viajaba sólo con el `productId`, así que el
 *   reembolso de la copia sandbox de un producto apagaba también la fila
 *   productiva del mismo producto.
 * - Un `orbita_pro` vencido cuyo `subscriptions[productId]` no existe producía
 *   un Free de alcance GLOBAL y apagaba todas las filas del usuario.
 * - El camino permanente se elegía por substring del product id, así que
 *   `orbita_lifetime_trial` con un vencimiento explícito y vencido salía
 *   permanente.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { guardLifetimePrecedence } from "../convex/lib/revenueCatEvents";
import {
  checkRevenueCatSubscriberIdentity,
  interpretRevenueCatSubscriber
} from "../convex/lib/revenueCatRest";
import {
  projectRevenueCatSubscriber,
  reconcileStoreEntitlement
} from "../convex/payments/revenuecatRest";

const OBSERVED = 1_800_000_000_000;
const FUTURE = 2_000_000_000_000;
const PAST = 1_700_000_000_000;

type MemoryRow = Record<string, any> & { _id: string };

function memoryDb(seed: Record<string, MemoryRow[]>) {
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
  const db = {
    query(table: string) {
      const filtros = new Map<string, unknown>();
      const q = {
        eq(field: string, value: unknown) {
          filtros.set(field, value);
          return q;
        }
      };
      return {
        withIndex(_i: string, build: (b: typeof q) => unknown) {
          build(q);
          const found = () =>
            (rows.get(table) ?? []).filter((row) => [...filtros].every(([f, v]) => row[f] === v));
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
  return { db, rows };
}

const project = async (ctx: unknown, args: Record<string, unknown>) =>
  await (projectRevenueCatSubscriber as any)._handler(ctx, args);
const actionHandler = (reconcileStoreEntitlement as any)._handler;

async function conEntorno(valor: string, run: () => Promise<void>) {
  const previo = process.env.ORBITA_ENVIRONMENT;
  process.env.ORBITA_ENVIRONMENT = valor;
  try {
    await run();
  } finally {
    if (previo === undefined) delete process.env.ORBITA_ENVIRONMENT;
    else process.env.ORBITA_ENVIRONMENT = previo;
  }
}

/** Sobre completo y bien formado, parametrizando de quién dice ser. */
const sobre = (original: unknown, over: Record<string, unknown> = {}) => ({
  request_date_ms: OBSERVED,
  subscriber: {
    original_app_user_id: original,
    entitlements: {},
    subscriptions: {},
    non_subscriptions: {},
    ...over
  }
});

const compraMensual = {
  entitlements: { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
  subscriptions: {
    orbita_monthly: { expires_date_ms: FUTURE, period_type: "normal", is_sandbox: true }
  }
};

const transaccion = (over: Record<string, unknown> = {}) => ({
  id: "tx_1",
  store: "app_store",
  purchase_date_ms: PAST,
  is_sandbox: false,
  ...over
});

// ---------------------------------------------------------------------------
// P1 1 — identidad del snapshot
// ---------------------------------------------------------------------------

describe("P1 1 — el snapshot tiene que ser de la cuenta que se preguntó", () => {
  it("REPRO: la respuesta de B con `original_app_user_id` custom A no activa a B", () => {
    const out = interpretRevenueCatSubscriber(200, sobre("user_a", compraMensual), {
      expectedAppUserId: "user_b"
    });
    assert.equal(out.kind, "unavailable");
    if (out.kind === "unavailable") assert.equal(out.reason, "subscriber_identity_mismatch");
  });

  it("y tampoco la REVOCA: un snapshot ajeno no decide nada sobre B", () => {
    const out = interpretRevenueCatSubscriber(200, sobre("user_a"), {
      expectedAppUserId: "user_b"
    });
    assert.equal(out.kind, "unavailable");
  });

  it("el mismo cuerpo SÍ vale cuando se preguntó por A", () => {
    const out = interpretRevenueCatSubscriber(200, sobre("user_a", compraMensual), {
      expectedAppUserId: "user_a"
    });
    assert.equal(out.kind, "resolved");
    if (out.kind !== "resolved") return;
    assert.equal(out.patch.entitlement, "orbita_pro");
    assert.equal(out.subscriberId, "user_a");
  });

  it("REPRO: un original ANÓNIMO tampoco es autoridad para ninguna cuenta", () => {
    // La versión anterior lo aceptaba razonando que "un id del SDK no puede ser
    // otra cuenta de Clerk". Cierto, y aun así insuficiente: el MISMO id
    // anónimo puede estar aliased a dos cuentas de Clerk, y entonces la misma
    // compra anónima se proyecta a las dos. Además el cliente de esta app es
    // custom-ID-only —se configura con el Clerk id ya conocido y nunca usa
    // `logOut` ni el modo anónimo—, así que un original anónimo no describe
    // ningún camino que esta app pueda producir.
    const out = interpretRevenueCatSubscriber(
      200,
      sobre("$RCAnonymousID:abc123", compraMensual),
      { expectedAppUserId: "user_a" }
    );
    assert.equal(out.kind, "unavailable");
    if (out.kind === "unavailable") assert.equal(out.reason, "anonymous_subscriber_identity");
  });

  it("el MISMO anónimo consultado desde dos cuentas no concede a ninguna", () => {
    const cuerpo = sobre("$RCAnonymousID:compartido", compraMensual);
    for (const cuenta of ["user_a", "user_b"]) {
      const out = interpretRevenueCatSubscriber(200, cuerpo, { expectedAppUserId: cuenta });
      assert.equal(out.kind, "unavailable", cuenta);
    }
  });

  it("un `original_app_user_id` ausente o malformado no es autoritativo", () => {
    for (const original of [undefined, null, "", 42, {}, []]) {
      const out = interpretRevenueCatSubscriber(200, sobre(original, compraMensual), {
        expectedAppUserId: "user_a"
      });
      assert.equal(out.kind, "unavailable", JSON.stringify(original));
      if (out.kind === "unavailable") {
        assert.equal(out.reason, "invalid_subscriber_identity", JSON.stringify(original));
      }
    }
  });

  it("interpretar SIN decir contra qué cuenta es un error, no un permiso", () => {
    const out = interpretRevenueCatSubscriber(200, sobre("user_a", compraMensual));
    assert.equal(out.kind, "unavailable");
    if (out.kind === "unavailable") assert.equal(out.reason, "unverified_subscriber_identity");
  });

  it("la decisión pura: SÓLO el id exacto es autoridad", () => {
    assert.deepEqual(checkRevenueCatSubscriberIdentity("user_a", "user_a"), {
      ok: true,
      subscriberId: "user_a"
    });
    assert.deepEqual(checkRevenueCatSubscriberIdentity("$RCAnonymousID:x", "user_a"), {
      ok: false,
      reason: "anonymous_subscriber_identity"
    });
    assert.deepEqual(checkRevenueCatSubscriberIdentity("user_b", "user_a"), {
      ok: false,
      reason: "subscriber_identity_mismatch"
    });
    assert.deepEqual(checkRevenueCatSubscriberIdentity(null, "user_a"), {
      ok: false,
      reason: "invalid_subscriber_identity"
    });
    assert.deepEqual(checkRevenueCatSubscriberIdentity("user_a", undefined), {
      ok: false,
      reason: "unverified_subscriber_identity"
    });
  });
});

describe("P1 1 — el circuito completo con A y B locales", () => {
  const usuarios = [
    { _id: "u_a", clerkUserId: "user_a" },
    { _id: "u_b", clerkUserId: "user_b" }
  ];

  it("REPRO: leer la cuenta de B y recibir el CustomerInfo de A no le da Plus a B", async () => {
    await conEntorno("development", async () => {
      const memory = memoryDb({ users: usuarios });
      const previoSecret = process.env.REVENUECAT_SECRET_API_KEY;
      const fetchOriginal = globalThis.fetch;
      process.env.REVENUECAT_SECRET_API_KEY = "sk-de-prueba";
      globalThis.fetch = (async () => ({
        status: 200,
        json: async () => sobre("user_a", compraMensual)
      })) as any;
      const reportes: any[] = [];
      try {
        const ctx: any = {
          // El lease está vigente: lo que corta acá es la IDENTIDAD del cuerpo.
          runQuery: async () => true,
          runMutation: async (_ref: unknown, args: any) => {
            if (args && "result" in args) {
              reportes.push(args);
              return null;
            }
            if (args && "outcome" in args) {
              // El trabajo durable está fuera de alcance de esta prueba: lo que
              // se verifica es que la IDENTIDAD del cuerpo corta la proyección.
              await project({ db: memory.db }, args);
              return { status: "applied" };
            }
            return null;
          }
        };
        const salida = await actionHandler(ctx, {
          clerkUserId: "user_b",
          trigger: "test",
          jobId: "reconcileJobs_1",
          lease: "1:1:1"
        });
        assert.equal(salida.status, "unavailable");
      } finally {
        globalThis.fetch = fetchOriginal;
        if (previoSecret === undefined) delete process.env.REVENUECAT_SECRET_API_KEY;
        else process.env.REVENUECAT_SECRET_API_KEY = previoSecret;
      }

      assert.equal(memory.rows.get("subscriptions")?.length, 0, "B no puede quedar Pro");
      // Y queda auditado, sin reintento: es una cuarentena, no una ventana.
      assert.equal(reportes[0]?.result, "settled");
      assert.equal(reportes[0]?.outcome, "subscriber_identity_mismatch");
      const auditoria = memory.rows.get("paymentEvents") ?? [];
      assert.equal(auditoria.length, 1);
      assert.equal((auditoria[0].rawPayload as any).reason, "subscriber_identity_mismatch");
    });
  });

  it("dos Clerk ids distintos con el MISMO anónimo no conceden a ninguno", async () => {
    await conEntorno("development", async () => {
      const memory = memoryDb({ users: usuarios });
      for (const cuenta of ["user_a", "user_b"]) {
        const outcome = interpretRevenueCatSubscriber(
          200,
          sobre("$RCAnonymousID:compartido", compraMensual),
          { expectedAppUserId: cuenta }
        );
        await project({ db: memory.db }, { clerkUserId: cuenta, outcome, trigger: "test" });
      }
      assert.equal(memory.rows.get("subscriptions")?.length, 0);
    });
  });

  it("el proyector también rechaza un snapshot ajeno que llegue por otra vía", async () => {
    await conEntorno("development", async () => {
      const memory = memoryDb({ users: usuarios });
      await project(
        { db: memory.db },
        {
          clerkUserId: "user_b",
          trigger: "test",
          outcome: {
            kind: "resolved",
            observedAt: OBSERVED,
            environment: "sandbox",
            subscriberId: "user_a",
            revocation: { kind: "none" },
            patch: {
              entitlement: "orbita_pro",
              status: "active",
              currentPeriodEnd: FUTURE,
              isLifetime: false,
              willRenew: true
            }
          }
        }
      );
      assert.equal(memory.rows.get("subscriptions")?.length, 0);
      assert.equal(memory.rows.get("paymentEvents")?.length, 0, "ni siquiera se audita como propio");
    });
  });

  it("con el `subscriberId` correcto sí proyecta", async () => {
    await conEntorno("development", async () => {
      const memory = memoryDb({ users: usuarios });
      await project(
        { db: memory.db },
        {
          clerkUserId: "user_b",
          trigger: "test",
          outcome: {
            kind: "resolved",
            observedAt: OBSERVED,
            environment: "sandbox",
            subscriberId: "user_b",
            revocation: { kind: "none" },
            patch: {
              entitlement: "orbita_pro",
              status: "active",
              currentPeriodEnd: FUTURE,
              isLifetime: false,
              willRenew: true
            }
          }
        }
      );
      assert.equal(memory.rows.get("subscriptions")?.[0]?.userId, "u_b");
    });
  });
});

// ---------------------------------------------------------------------------
// P1 4 — la REST no infiere reembolsos de campos que la v1 no documenta
// ---------------------------------------------------------------------------

describe("P1 4 — ningún permanente cae desde la lectura REST", () => {
  const filaLifetime = (environment: string, id: string): MemoryRow => ({
    _id: id,
    userId: "u_a",
    clerkUserId: "user_a",
    provider: "revenuecat",
    entitlement: "orbita_pro",
    status: "active",
    plan: "lifetime",
    productId: "orbita_lifetime",
    isLifetime: true,
    willRenew: false,
    environment,
    updatedAt: PAST
  });

  it("REPRO: un `refunded_at` fabricado en non_subscriptions no apaga NINGUNA fila permanente", async () => {
    // La v1 documenta `id`, `is_sandbox`, `purchase_date` y `store` en
    // `non_subscriptions`; `refunded_at` vive en `subscriptions`. La versión
    // anterior construía "evidencia de reembolso" con ese campo inventado y
    // apagaba filas permanentes de una cuenta de review que tiene el mismo
    // producto en sandbox y en production.
    await conEntorno("production", async () => {
      const memory = memoryDb({
        users: [{ _id: "u_a", clerkUserId: "user_a" }],
        subscriptions: [filaLifetime("sandbox", "sub_sand"), filaLifetime("production", "sub_prod")]
      });
      const outcome = interpretRevenueCatSubscriber(
        200,
        sobre("user_a", {
          non_subscriptions: {
            orbita_lifetime: [
              transaccion({ id: "tx_sandbox", is_sandbox: true, refunded_at_ms: PAST + 1000 })
            ]
          }
        }),
        { expectedAppUserId: "user_a" }
      );
      if (outcome.kind !== "resolved") return assert.fail("debería resolver");

      await project({ db: memory.db }, { clerkUserId: "user_a", outcome, trigger: "test" });
      const filas = memory.rows.get("subscriptions") ?? [];
      assert.equal(filas.find((f) => f._id === "sub_sand")?.isLifetime, true);
      assert.equal(filas.find((f) => f._id === "sub_prod")?.isLifetime, true);
    });
  });

  it("el resultado ya no transporta ninguna evidencia de reembolso", () => {
    const out = interpretRevenueCatSubscriber(
      200,
      sobre("user_a", {
        non_subscriptions: {
          orbita_lifetime: [transaccion({ refunded_at_ms: PAST + 1000 })]
        }
      }),
      { expectedAppUserId: "user_a" }
    );
    if (out.kind !== "resolved") return assert.fail("debería resolver");
    assert.equal("refundedPurchases" in out, false, "el campo inventado desapareció del contrato");
  });

  it("el reembolso de un permanente sólo puede llegar por webhook del mismo producto", () => {
    // Documentado acá porque es una decisión de producto, no un descuido: para
    // V1 el catálogo es mensual y hay que auditar CERO lifetime de RevenueCat
    // antes de lanzar. Ver `docs/native-commerce-release-checklist.md`.
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
    assert.equal(decision.patch.isLifetime, false);
  });
});

// ---------------------------------------------------------------------------
// P1 4 — una expiración sólo apaga el entorno que demuestra
// ---------------------------------------------------------------------------

describe("P1 4 — un `orbita_pro` vencido sin recibo es un snapshot inconsistente", () => {
  const filaActiva = (environment: string, id: string): MemoryRow => ({
    _id: id,
    userId: "u_a",
    clerkUserId: "user_a",
    provider: "revenuecat",
    entitlement: "orbita_pro",
    status: "active",
    plan: "monthly",
    productId: "orbita_monthly",
    currentPeriodEnd: FUTURE,
    isLifetime: false,
    willRenew: true,
    environment,
    updatedAt: PAST
  });

  it("REPRO: sin `subscriptions[productId]` no revoca NADA", async () => {
    await conEntorno("production", async () => {
      const memory = memoryDb({
        users: [{ _id: "u_a", clerkUserId: "user_a" }],
        subscriptions: [filaActiva("production", "sub_prod"), filaActiva("sandbox", "sub_sand")]
      });
      const outcome = interpretRevenueCatSubscriber(
        200,
        sobre("user_a", {
          entitlements: { orbita_pro: { expires_date_ms: PAST, product_identifier: "orbita_monthly" } }
        }),
        { expectedAppUserId: "user_a" }
      );
      assert.equal(outcome.kind, "unavailable");
      if (outcome.kind === "unavailable") {
        assert.equal(outcome.reason, "expired_without_environment");
      }

      await project({ db: memory.db }, { clerkUserId: "user_a", outcome, trigger: "test" });
      const filas = memory.rows.get("subscriptions") ?? [];
      assert.ok(filas.every((f) => f.entitlement === "orbita_pro"), "cero mutaciones");
    });
  });

  it("REPRO: con el recibo pero SIN `is_sandbox` tampoco revoca nada", async () => {
    const outcome = interpretRevenueCatSubscriber(
      200,
      sobre("user_a", {
        entitlements: { orbita_pro: { expires_date_ms: PAST, product_identifier: "orbita_monthly" } },
        subscriptions: { orbita_monthly: { expires_date_ms: PAST, period_type: "normal" } }
      }),
      { expectedAppUserId: "user_a" }
    );
    assert.equal(outcome.kind, "unavailable");
  });

  it("con el entorno demostrado apaga SÓLO ese entorno, nunca global", async () => {
    await conEntorno("production", async () => {
      const memory = memoryDb({
        users: [{ _id: "u_a", clerkUserId: "user_a" }],
        subscriptions: [filaActiva("production", "sub_prod"), filaActiva("sandbox", "sub_sand")]
      });
      const outcome = interpretRevenueCatSubscriber(
        200,
        sobre("user_a", {
          entitlements: { orbita_pro: { expires_date_ms: PAST, product_identifier: "orbita_monthly" } },
          subscriptions: { orbita_monthly: { expires_date_ms: PAST, is_sandbox: true } }
        }),
        { expectedAppUserId: "user_a" }
      );
      if (outcome.kind !== "resolved") return assert.fail("debería resolver");
      assert.deepEqual(outcome.revocation, { kind: "environment", environment: "sandbox" });

      await project({ db: memory.db }, { clerkUserId: "user_a", outcome, trigger: "test" });
      const filas = memory.rows.get("subscriptions") ?? [];
      assert.equal(filas.find((f) => f._id === "sub_sand")?.entitlement, "free");
      assert.equal(filas.find((f) => f._id === "sub_prod")?.entitlement, "orbita_pro");
    });
  });

  it("el alcance GLOBAL se reserva para la ausencia total del entitlement", () => {
    const out = interpretRevenueCatSubscriber(200, sobre("user_a"), {
      expectedAppUserId: "user_a"
    });
    if (out.kind !== "resolved") return assert.fail("debería resolver");
    assert.deepEqual(out.revocation, { kind: "global" });
  });
});

// ---------------------------------------------------------------------------
// P1 5 — permanente por evidencia, nunca por substring
// ---------------------------------------------------------------------------

describe("P1 5 — el nombre del producto no decide si el acceso es permanente", () => {
  it("REPRO: `orbita_lifetime_trial` con vencimiento explícito NO sale permanente", () => {
    const out = interpretRevenueCatSubscriber(
      200,
      sobre("user_a", {
        entitlements: {
          orbita_pro: { expires_date_ms: PAST, product_identifier: "orbita_lifetime_trial" }
        },
        non_subscriptions: { orbita_lifetime_trial: [transaccion({ is_sandbox: true })] }
      }),
      { expectedAppUserId: "user_a" }
    );
    // El entitlement declara una fecha finita y vencida: es el camino de
    // suscripción, y su entorno se demuestra con el recibo, no con la compra.
    assert.notEqual(out.kind === "resolved" && out.patch.isLifetime, true);
    assert.equal(out.kind, "unavailable");
  });

  it("un `orbita_lifetime_trial` VIGENTE tampoco es permanente: es una suscripción", () => {
    const out = interpretRevenueCatSubscriber(
      200,
      sobre("user_a", {
        entitlements: {
          orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_lifetime_trial" }
        },
        subscriptions: { orbita_lifetime_trial: { expires_date_ms: FUTURE, is_sandbox: true } },
        non_subscriptions: { orbita_lifetime_trial: [transaccion({ is_sandbox: true })] }
      }),
      { expectedAppUserId: "user_a" }
    );
    if (out.kind !== "resolved") return assert.fail("debería resolver");
    assert.equal(out.patch.isLifetime, false);
    assert.equal(out.patch.currentPeriodEnd, FUTURE);
  });

  it("la señal inequívoca es producto DECLARADO + `expires_date: null` + transacción estricta", () => {
    const out = interpretRevenueCatSubscriber(
      200,
      sobre("user_a", {
        entitlements: { orbita_pro: { expires_date: null, product_identifier: "orbita_lifetime" } },
        non_subscriptions: { orbita_lifetime: [transaccion({ is_sandbox: true })] }
      }),
      {
        expectedAppUserId: "user_a",
        env: { REVENUECAT_LIFETIME_PRODUCT_IDS: "orbita_lifetime" }
      }
    );
    if (out.kind !== "resolved") return assert.fail("debería resolver");
    assert.equal(out.patch.isLifetime, true);
    assert.equal(out.environment, "sandbox");
  });

  it("sin el producto declarado, el mismo cuerpo no concede (catálogo V1 = mensual)", () => {
    const out = interpretRevenueCatSubscriber(
      200,
      sobre("user_a", {
        entitlements: { orbita_pro: { expires_date: null, product_identifier: "orbita_lifetime" } },
        non_subscriptions: { orbita_lifetime: [transaccion({ is_sandbox: true })] }
      }),
      { expectedAppUserId: "user_a" }
    );
    assert.equal(out.kind, "unavailable");
    if (out.kind === "unavailable") assert.equal(out.reason, "lifetime_product_not_allowlisted");
  });

  it("`expires_date: null` sin transacción de ESE producto no concede", () => {
    const out = interpretRevenueCatSubscriber(
      200,
      sobre("user_a", {
        entitlements: { orbita_pro: { expires_date: null, product_identifier: "orbita_lifetime" } },
        non_subscriptions: { otro_producto: [transaccion()] }
      }),
      {
        expectedAppUserId: "user_a",
        env: { REVENUECAT_LIFETIME_PRODUCT_IDS: "orbita_lifetime" }
      }
    );
    assert.equal(out.kind, "unavailable");
    if (out.kind === "unavailable") {
      assert.equal(out.reason, "lifetime_without_purchase_evidence");
    }
  });

  it("REPRO: `expires_date: null` + `expires_date_ms` corrupto es CONTRADICTORIO", () => {
    // P1 6: antes se prefería `_ms` y se caía al ISO si no se entendía, así que
    // un `null` acompañado de basura concedía acceso permanente.
    const out = interpretRevenueCatSubscriber(
      200,
      sobre("user_a", {
        entitlements: {
          orbita_pro: {
            expires_date: null,
            expires_date_ms: "corrupt",
            product_identifier: "orbita_lifetime"
          }
        },
        non_subscriptions: { orbita_lifetime: [transaccion({ is_sandbox: true })] }
      }),
      {
        expectedAppUserId: "user_a",
        env: { REVENUECAT_LIFETIME_PRODUCT_IDS: "orbita_lifetime" }
      }
    );
    assert.equal(out.kind, "unavailable");
    if (out.kind === "unavailable") assert.equal(out.reason, "invalid_expiration");
  });
});
