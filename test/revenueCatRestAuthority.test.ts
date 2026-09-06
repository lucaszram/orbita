/**
 * Autoridad de la lectura REST: qué concede, qué apaga y qué no toca.
 *
 * Cuatro defectos de la tercera auditoría, todos con la misma raíz: la lectura
 * autoritativa devolvía una decisión SIN alcance, y el proyector la aplicaba
 * buscando la fila cuyo `environment` coincidiera con el de la respuesta.
 *
 * 1. Un Free autoritativo llegaba sin entorno (es lo normal cuando la cuenta no
 *    tiene el entitlement), así que sólo coincidía con filas legadas sin
 *    entorno: la fila `production` con acceso pago que la tienda ya no
 *    respaldaba quedaba viva. Nada revocaba nunca.
 * 2. Un reembolso de lifetime perdido no se podía reparar: el proyector
 *    preservaba el lifetime ante CUALQUIER Free, incluso el que traía la
 *    prueba del reembolso.
 * 3. El lifetime se concedía por el NOMBRE del producto, antes de mirar
 *    `entitlements.orbita_pro`, y aceptaba transacciones parciales o con
 *    `refunded_at_ms` malformado.
 * 4. `patch.entitlement !== "free"` leía un patch SIN entitlement como una
 *    concesión.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { interpretRevenueCatSubscriber } from "../convex/lib/revenueCatRest";
import { projectRevenueCatSubscriber } from "../convex/payments/revenuecatRest";

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
  return { db, rows };
}

const USER = { _id: "u1", clerkUserId: "user_a" };

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

const project = async (ctx: unknown, args: Record<string, unknown>) =>
  await (projectRevenueCatSubscriber as any)._handler(ctx, args);

/** Fila de la tienda con acceso vigente. */
const filaActiva = (over: Record<string, unknown> = {}): MemoryRow => ({
  _id: "sub_prod",
  userId: "u1",
  clerkUserId: "user_a",
  provider: "revenuecat",
  entitlement: "orbita_pro",
  status: "active",
  plan: "monthly",
  productId: "orbita_monthly",
  currentPeriodEnd: FUTURE,
  isLifetime: false,
  willRenew: true,
  environment: "production",
  updatedAt: PAST,
  ...over
});

/** Cuerpo REST completo y bien formado. `entitlements` vacío = sin acceso. */
const cuerpo = (over: Record<string, unknown> = {}) => ({
  request_date_ms: OBSERVED,
  subscriber: {
    original_app_user_id: "user_a",
    entitlements: {},
    subscriptions: {},
    non_subscriptions: {},
    ...over
  }
});

/** Transacción permanente con la forma estricta que exige el módulo. */
const transaccion = (over: Record<string, unknown> = {}) => ({
  id: "tx_1",
  store: "app_store",
  purchase_date_ms: PAST,
  is_sandbox: false,
  ...over
});

/** La lectura siempre se interpreta contra una cuenta concreta (P1 1). */
const interpretar = (status: number, body: unknown, expectedAppUserId = "user_a") =>
  interpretRevenueCatSubscriber(status, body, { expectedAppUserId });

describe("REST — un Free autoritativo declara SOBRE QUÉ manda", () => {
  it("el cuerpo completo sin el entitlement canónico revoca de forma global", () => {
    const out = interpretar(200, cuerpo());
    assert.equal(out.kind, "resolved");
    if (out.kind !== "resolved") return;
    assert.equal(out.patch.entitlement, "free");
    assert.deepEqual(out.revocation, { kind: "global" });
  });

  it("un entitlement vencido con entorno demostrado revoca SÓLO ese entorno", () => {
    const out = interpretar(
      200,
      cuerpo({
        entitlements: { orbita_pro: { expires_date_ms: PAST, product_identifier: "orbita_monthly" } },
        subscriptions: { orbita_monthly: { expires_date_ms: PAST, is_sandbox: true } }
      })
    );
    assert.equal(out.kind, "resolved");
    if (out.kind !== "resolved") return;
    assert.equal(out.patch.entitlement, "free");
    assert.deepEqual(out.revocation, { kind: "environment", environment: "sandbox" });
  });

  it("un cuerpo incompleto no revoca nada: es `unavailable`", () => {
    // Falta `non_subscriptions`: el sobre no se entiende entero.
    const parcial = {
      request_date_ms: OBSERVED,
      subscriber: { entitlements: {}, subscriptions: {} }
    };
    assert.equal(interpretar(200, parcial).kind, "unavailable");
    // Y un 404 sigue siendo "no se pudo saber", nunca "esta persona no compró".
    assert.deepEqual(interpretar(404, cuerpo()), {
      kind: "unavailable",
      reason: "http_404"
    });
  });

  it("un Free resuelto nunca concede: el patch es Free y punto", () => {
    const out = interpretar(200, cuerpo());
    if (out.kind !== "resolved") return assert.fail("debería resolver");
    assert.deepEqual(out.patch, {
      entitlement: "free",
      status: "expired",
      isLifetime: false,
      willRenew: false
    });
  });
});

describe("REST — el proyector apaga la fila REAL, no la que coincide por entorno", () => {
  it("REPRO: fila production activa + 200 completo con entitlements vacío queda Free y auditado", async () => {
    // El defecto: `revocation` no existía, la respuesta no traía entorno y el
    // proyector buscaba `row.environment === undefined`. La fila production
    // seguía dando Órbita Plus contra una tienda que ya no lo respalda.
    await conEntorno("production", async () => {
      const memory = memoryDb({ users: [USER], subscriptions: [filaActiva()] });
      const outcome = interpretar(200, cuerpo());
      await project({ db: memory.db }, { clerkUserId: "user_a", outcome, trigger: "test" });

      const fila = memory.rows.get("subscriptions")?.[0];
      assert.equal(fila?.entitlement, "free");
      assert.equal(fila?.status, "expired");
      assert.equal(fila?.environment, "production", "la fila conserva su identidad de entorno");

      const auditoria = memory.rows.get("paymentEvents") ?? [];
      assert.equal(auditoria.length, 1);
      assert.equal(auditoria[0].eventType, "RECONCILE");
      assert.equal((auditoria[0].rawPayload as any).revocation, "global");
    });
  });

  it("un alcance por entorno no toca la fila del otro entorno", async () => {
    await conEntorno("production", async () => {
      const memory = memoryDb({
        users: [USER],
        subscriptions: [
          filaActiva(),
          filaActiva({ _id: "sub_sand", environment: "sandbox" })
        ]
      });
      const outcome = interpretar(
        200,
        cuerpo({
          entitlements: { orbita_pro: { expires_date_ms: PAST, product_identifier: "orbita_monthly" } },
          subscriptions: { orbita_monthly: { expires_date_ms: PAST, is_sandbox: true } }
        })
      );
      await project({ db: memory.db }, { clerkUserId: "user_a", outcome, trigger: "test" });

      const filas = memory.rows.get("subscriptions") ?? [];
      const produccion = filas.find((f) => f.environment === "production");
      const sandbox = filas.find((f) => f.environment === "sandbox");
      assert.equal(sandbox?.entitlement, "free", "el entorno demostrado sí se apaga");
      assert.equal(produccion?.entitlement, "orbita_pro", "el otro entorno queda intacto");
    });
  });

  it("una respuesta que no se entiende deja el acceso exactamente como estaba", async () => {
    await conEntorno("production", async () => {
      const memory = memoryDb({ users: [USER], subscriptions: [filaActiva()] });
      await project(
        { db: memory.db },
        { clerkUserId: "user_a", outcome: { kind: "unavailable", reason: "http_503" } }
      );
      assert.equal(memory.rows.get("subscriptions")?.[0].entitlement, "orbita_pro");
    });
  });

  it("revocar NUNCA crea una fila: sin fila previa no hay acceso que apagar", async () => {
    await conEntorno("production", async () => {
      const memory = memoryDb({ users: [USER] });
      const outcome = interpretar(200, cuerpo());
      await project({ db: memory.db }, { clerkUserId: "user_a", outcome, trigger: "test" });
      assert.equal(memory.rows.get("subscriptions")?.length, 0);
    });
  });

  it("no toca las filas de Stripe: la lectura sólo habla de la tienda", async () => {
    await conEntorno("production", async () => {
      const stripe: MemoryRow = {
        _id: "sub_stripe",
        userId: "u1",
        clerkUserId: "user_a",
        provider: "stripe",
        entitlement: "orbita_pro",
        status: "active",
        currentPeriodEnd: FUTURE,
        updatedAt: PAST
      };
      const memory = memoryDb({ users: [USER], subscriptions: [filaActiva(), stripe] });
      const outcome = interpretar(200, cuerpo());
      await project({ db: memory.db }, { clerkUserId: "user_a", outcome, trigger: "test" });

      const filas = memory.rows.get("subscriptions") ?? [];
      assert.equal(filas.find((f) => f.provider === "revenuecat")?.entitlement, "free");
      assert.equal(filas.find((f) => f.provider === "stripe")?.entitlement, "orbita_pro");
    });
  });
});

describe("REST — un acceso permanente NUNCA se retira desde la lectura", () => {
  const filaLifetime = (over: Record<string, unknown> = {}): MemoryRow => ({
    _id: "sub_life",
    userId: "u1",
    clerkUserId: "user_a",
    provider: "revenuecat",
    entitlement: "orbita_pro",
    status: "active",
    plan: "lifetime",
    productId: "orbita_lifetime",
    isLifetime: true,
    willRenew: false,
    environment: "production",
    updatedAt: PAST,
    ...over
  });

  it("REPRO: un `refunded_at` fabricado en non_subscriptions NO retira nada", async () => {
    // P1 4: la v1 documenta `id`, `is_sandbox`, `purchase_date` y `store` en
    // `non_subscriptions`. `refunded_at` vive en `subscriptions`. La versión
    // anterior construía "evidencia de reembolso" con ese campo y apagaba un
    // acceso pago desde algo que el proveedor no promete.
    await conEntorno("production", async () => {
      const memory = memoryDb({ users: [USER], subscriptions: [filaLifetime()] });
      const outcome = interpretar(
        200,
        cuerpo({
          non_subscriptions: {
            orbita_lifetime: [transaccion({ refunded_at_ms: PAST + 1000, refunded_at: "2026-01-01T00:00:00Z" })]
          }
        })
      );
      await project({ db: memory.db }, { clerkUserId: "user_a", outcome, trigger: "test" });

      const fila = memory.rows.get("subscriptions")?.[0];
      assert.equal(fila?.isLifetime, true, "el acceso permanente sobrevive");
      assert.equal(fila?.entitlement, "orbita_pro");
      assert.equal(fila?.productId, "orbita_lifetime");
    });
  });

  it("una ausencia total del entitlement tampoco borra el lifetime", async () => {
    await conEntorno("production", async () => {
      const memory = memoryDb({ users: [USER], subscriptions: [filaLifetime()] });
      // Alcance global: apaga todo lo que puede, y un permanente no está entre
      // esas cosas. Una ausencia no es un reembolso.
      const outcome = interpretar(200, cuerpo());
      await project({ db: memory.db }, { clerkUserId: "user_a", outcome, trigger: "test" });

      const fila = memory.rows.get("subscriptions")?.[0];
      assert.equal(fila?.isLifetime, true);
      assert.equal(fila?.entitlement, "orbita_pro");
      assert.equal(fila?.productId, "orbita_lifetime", "conserva su identidad");
    });
  });

  it("pero SÍ apaga las filas no permanentes del mismo alcance", async () => {
    await conEntorno("production", async () => {
      const memory = memoryDb({
        users: [USER],
        subscriptions: [filaLifetime(), filaActiva({ _id: "sub_mensual", environment: "sandbox" })]
      });
      const outcome = interpretar(200, cuerpo());
      await project({ db: memory.db }, { clerkUserId: "user_a", outcome, trigger: "test" });

      const filas = memory.rows.get("subscriptions") ?? [];
      assert.equal(filas.find((f) => f._id === "sub_life")?.isLifetime, true);
      assert.equal(filas.find((f) => f._id === "sub_mensual")?.entitlement, "free");
    });
  });

  it("una concesión mensual tampoco degrada la fila permanente", async () => {
    await conEntorno("production", async () => {
      const memory = memoryDb({ users: [USER], subscriptions: [filaLifetime()] });
      const outcome = interpretar(
        200,
        cuerpo({
          entitlements: {
            orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" }
          },
          subscriptions: { orbita_monthly: { expires_date_ms: FUTURE, is_sandbox: false } }
        })
      );
      await project({ db: memory.db }, { clerkUserId: "user_a", outcome, trigger: "test" });

      const fila = memory.rows.get("subscriptions")?.[0];
      assert.equal(fila?.isLifetime, true);
      assert.equal(fila?.plan, "lifetime");
      assert.equal(fila?.productId, "orbita_lifetime");
      // La verdad del mensual sí se aplica en lo que no identifica al permanente.
      assert.equal(fila?.currentPeriodEnd, FUTURE);
    });
  });
});

describe("REST — conceder exige el entitlement canónico, no un nombre de producto", () => {
  it("REPRO: entitlements vacío + `unrelated_lifetime_pack` JAMÁS concede", () => {
    // El defecto: `anyActiveLifetime` recorría `non_subscriptions` buscando
    // cualquier product id con "lifetime" adentro ANTES de mirar el
    // entitlement, y le daba acceso permanente a una cuenta sin entitlement.
    const out = interpretar(
      200,
      cuerpo({ non_subscriptions: { unrelated_lifetime_pack: [transaccion()] } })
    );
    assert.equal(out.kind, "resolved");
    if (out.kind !== "resolved") return;
    assert.equal(out.patch.entitlement, "free");
    assert.notEqual(out.patch.isLifetime, true);
  });

  it("REPRO: sin el producto DECLARADO, `expires_date: null` no concede", () => {
    // P1 5: el catálogo V1 es mensual. Un permanente sólo puede salir de
    // `REVENUECAT_LIFETIME_PRODUCT_IDS`, jamás de una convención de nombres.
    const out = interpretar(
      200,
      cuerpo({
        entitlements: { orbita_pro: { expires_date: null, product_identifier: "orbita_lifetime" } },
        non_subscriptions: { orbita_lifetime: [transaccion({ is_sandbox: true })] }
      })
    );
    assert.equal(out.kind, "unavailable");
    if (out.kind === "unavailable") assert.equal(out.reason, "lifetime_product_not_allowlisted");
  });

  it("con el producto declarado y su transacción estricta sí concede, con su entorno", () => {
    const out = interpretRevenueCatSubscriber(
      200,
      cuerpo({
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
    assert.equal(out.patch.plan, "lifetime");
    assert.equal(out.environment, "sandbox");
    assert.deepEqual(out.revocation, { kind: "none" });
  });

  it("una transacción parcial no sostiene un acceso permanente", () => {
    for (const parcial of [
      transaccion({ is_sandbox: undefined }), // sin entorno demostrable
      transaccion({ purchase_date_ms: undefined }), // sin fecha de compra
      transaccion({ store: undefined }), // sin tienda
      transaccion({ id: undefined }), // sin id
      { id: "tx" }, // sin nada
      "no-es-un-objeto"
    ]) {
      const out = interpretRevenueCatSubscriber(
        200,
        cuerpo({
          entitlements: { orbita_pro: { expires_date: null, product_identifier: "orbita_lifetime" } },
          non_subscriptions: { orbita_lifetime: [parcial] }
        }),
        {
          expectedAppUserId: "user_a",
          env: { REVENUECAT_LIFETIME_PRODUCT_IDS: "orbita_lifetime" }
        }
      );
      assert.equal(out.kind, "unavailable", JSON.stringify(parcial));
      if (out.kind === "unavailable") {
        assert.equal(out.reason, "lifetime_without_purchase_evidence", JSON.stringify(parcial));
      }
    }
  });

  it("DOS transacciones del mismo producto son ambiguas y no conceden", () => {
    const out = interpretRevenueCatSubscriber(
      200,
      cuerpo({
        entitlements: { orbita_pro: { expires_date: null, product_identifier: "orbita_lifetime" } },
        non_subscriptions: {
          orbita_lifetime: [
            transaccion({ id: "tx_1", is_sandbox: true }),
            transaccion({ id: "tx_2", is_sandbox: false })
          ]
        }
      }),
      {
        expectedAppUserId: "user_a",
        env: { REVENUECAT_LIFETIME_PRODUCT_IDS: "orbita_lifetime" }
      }
    );
    assert.equal(out.kind, "unavailable");
  });

  it("el catálogo V1 vigente es mensual y sigue concediendo normal", () => {
    const out = interpretar(
      200,
      cuerpo({
        entitlements: { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
        subscriptions: { orbita_monthly: { expires_date_ms: FUTURE, is_sandbox: true } }
      })
    );
    if (out.kind !== "resolved") return assert.fail("debería resolver");
    assert.equal(out.patch.entitlement, "orbita_pro");
    assert.equal(out.patch.plan, "monthly");
    assert.equal(out.patch.isLifetime, false);
    assert.equal(out.environment, "sandbox");
  });

  it("un entitlement sin producto declarado no se entiende: no concede ni revoca", () => {
    const out = interpretar(
      200,
      cuerpo({ entitlements: { orbita_pro: { expires_date_ms: FUTURE } } })
    );
    assert.equal(out.kind, "unavailable");
  });
});

describe("REST — un patch sin entitlement no es una concesión", () => {
  it("REPRO: `patch.entitlement` ausente no crea ni activa ninguna fila", async () => {
    // El defecto: `patch.entitlement !== "free"` es verdadero también cuando el
    // campo no vino, así que un patch mudo entraba por el camino de concesión.
    await conEntorno("development", async () => {
      const memory = memoryDb({ users: [USER] });
      await project(
        { db: memory.db },
        {
          clerkUserId: "user_a",
          outcome: {
            kind: "resolved",
            observedAt: OBSERVED,
            environment: "sandbox",
            patch: { status: "active", currentPeriodEnd: FUTURE }
          },
          trigger: "test"
        }
      );
      assert.equal(memory.rows.get("subscriptions")?.length, 0);
    });
  });

  it("un patch mudo tampoco reactiva una fila ya apagada", async () => {
    await conEntorno("development", async () => {
      const apagada = filaActiva({
        environment: "sandbox",
        entitlement: "free",
        status: "expired",
        currentPeriodEnd: PAST
      });
      const memory = memoryDb({ users: [USER], subscriptions: [apagada] });
      await project(
        { db: memory.db },
        {
          clerkUserId: "user_a",
          outcome: {
            kind: "resolved",
            observedAt: OBSERVED,
            environment: "sandbox",
            patch: { status: "active", currentPeriodEnd: FUTURE }
          },
          trigger: "test"
        }
      );
      const fila = memory.rows.get("subscriptions")?.[0];
      assert.equal(fila?.entitlement, "free");
      assert.equal(fila?.status, "expired");
    });
  });

  it("sin entorno demostrado no se concede aunque el entitlement sea el canónico", async () => {
    await conEntorno("development", async () => {
      const memory = memoryDb({ users: [USER] });
      await project(
        { db: memory.db },
        {
          clerkUserId: "user_a",
          outcome: {
            kind: "resolved",
            observedAt: OBSERVED,
            patch: { entitlement: "orbita_pro", status: "active", currentPeriodEnd: FUTURE }
          },
          trigger: "test"
        }
      );
      assert.equal(memory.rows.get("subscriptions")?.length, 0);
    });
  });

  it("un outcome sin `revocation` declarada no revoca nada", async () => {
    await conEntorno("production", async () => {
      const memory = memoryDb({ users: [USER], subscriptions: [filaActiva()] });
      await project(
        { db: memory.db },
        {
          clerkUserId: "user_a",
          outcome: {
            kind: "resolved",
            observedAt: OBSERVED,
            patch: { entitlement: "free", status: "expired", isLifetime: false, willRenew: false }
          },
          trigger: "test"
        }
      );
      assert.equal(memory.rows.get("subscriptions")?.[0].entitlement, "orbita_pro");
    });
  });
});
