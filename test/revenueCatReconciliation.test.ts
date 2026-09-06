/**
 * Reconciliación server-side con la REST v1 de RevenueCat (P1 1).
 *
 * El webhook es best-effort: RevenueCat reintenta una cantidad acotada y después
 * abandona. Si el `INITIAL_PURCHASE` se pierde, Apple ya cobró y Convex queda en
 * Free para siempre. RevenueCat recomienda oficialmente cerrar ese hueco con
 * `GET /v1/subscribers/{app_user_id}` después de cualquier evento.
 *
 * Reglas que se prueban acá:
 *
 * - la respuesta se INTERPRETA sin conceder ni revocar ante 5xx/429/shape rota;
 * - un 200 con el entitlement ausente sí es autoritativo y retira el acceso;
 * - la acción pública deriva el Clerk id de `ctx.auth` y jamás lo acepta del
 *   cliente, ni acepta CustomerInfo, entitlement ni recibos;
 * - la proyección es idempotente y respeta el orden contra los webhooks.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PRO_ENTITLEMENT } from "../convex/lib/entitlements";
import {
  interpretRevenueCatSubscriber,
  revenueCatSubscriberUrl,
  REVENUECAT_SUBSCRIBERS_ENDPOINT
} from "../convex/lib/revenueCatRest";
import { rateLimitSubjectHash } from "../convex/lib/rateLimit";
import {
  projectRevenueCatSubscriber,
  requestStoreReconcile
} from "../convex/payments/revenuecatRest";

const NOW = 1_800_000_000_000;
const FUTURE = 2_000_000_000_000;
const PAST = 1_700_000_000_000;

const subscriberBody = (entitlements: Record<string, unknown>, subscriptions: Record<string, unknown> = {}) => ({
  request_date_ms: NOW,
  subscriber: {
    original_app_user_id: "user_current",
    entitlements,
    subscriptions,
    non_subscriptions: {}
  }
});

/** La lectura siempre se interpreta contra una cuenta concreta (P1 1). */
const interpretar = (status: number, body: unknown, expectedAppUserId = "user_current") =>
  interpretRevenueCatSubscriber(status, body, { expectedAppUserId });

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
          return {
            first: async () => found()[0] ?? null,
            collect: async () => found()
          };
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

/** Salvo que un caso diga otra cosa, el deployment del harness es development. */
const project = async (ctx: unknown, args: Record<string, unknown>) => {
  const previo = process.env.ORBITA_ENVIRONMENT;
  if (previo === undefined) process.env.ORBITA_ENVIRONMENT = "development";
  try {
    return await (projectRevenueCatSubscriber as any)._handler(ctx, args);
  } finally {
    if (previo === undefined) delete process.env.ORBITA_ENVIRONMENT;
  }
};

describe("endpoint y credencial", () => {
  it("apunta a la REST v1 oficial de subscribers", () => {
    assert.equal(REVENUECAT_SUBSCRIBERS_ENDPOINT, "https://api.revenuecat.com/v1/subscribers");
  });

  it("escapa el app user id en la URL", () => {
    assert.equal(revenueCatSubscriberUrl("user_current"), `${REVENUECAT_SUBSCRIBERS_ENDPOINT}/user_current`);
    assert.equal(
      revenueCatSubscriberUrl("user/con espacio"),
      `${REVENUECAT_SUBSCRIBERS_ENDPOINT}/user%2Fcon%20espacio`
    );
  });
});

describe("interpretación de la respuesta — ni concede ni revoca a ciegas", () => {
  it("un 5xx no toca el acceso", () => {
    for (const status of [500, 502, 503]) {
      const out = interpretar(status, {});
      assert.equal(out.kind, "unavailable", `status ${status}`);
    }
  });

  it("un 429 no toca el acceso", () => {
    assert.equal(interpretar(429, {}).kind, "unavailable");
  });

  it("un 401/403 no toca el acceso (credencial mal configurada)", () => {
    assert.equal(interpretar(401, {}).kind, "unavailable");
    assert.equal(interpretar(403, {}).kind, "unavailable");
  });

  it("una shape inválida no toca el acceso", () => {
    for (const body of [null, undefined, "texto", 42, {}, { subscriber: 7 }, { subscriber: {} }]) {
      assert.equal(
        interpretar(200, body).kind,
        "unavailable",
        `body ${JSON.stringify(body)}`
      );
    }
  });

  it("un 200 con el entitlement vigente lo proyecta con su fecha", () => {
    const out = interpretar(
      200,
      subscriberBody(
        { orbita_pro: { expires_date: "2033-05-18T03:33:20Z", product_identifier: "orbita_monthly" } },
        { orbita_monthly: { expires_date: "2033-05-18T03:33:20Z", period_type: "normal", store: "app_store", is_sandbox: false } }
      )
    );
    assert.equal(out.kind, "resolved");
    if (out.kind !== "resolved") return;
    assert.equal(out.patch.entitlement, PRO_ENTITLEMENT);
    assert.equal(out.patch.status, "active");
    assert.equal(out.patch.plan, "monthly");
    assert.equal(out.patch.productId, "orbita_monthly");
    assert.equal(out.patch.isLifetime, false);
    assert.equal(out.patch.currentPeriodEnd, Date.parse("2033-05-18T03:33:20Z"));
    assert.equal(out.observedAt, NOW);
  });

  it("acepta también el formato en milisegundos", () => {
    const out = interpretar(
      200,
      subscriberBody(
        { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
        { orbita_monthly: { expires_date_ms: FUTURE, is_sandbox: false } }
      )
    );
    assert.equal(out.kind === "resolved" && out.patch.currentPeriodEnd, FUTURE);
  });

  it("REPRO: un entitlement VIGENTE sin recibo que lo describa es `unavailable`", () => {
    // P1 3: `subscriptions[productId]` ausente —o sin `is_sandbox`— dejaba un
    // `resolved` sin `environment`. El proyector no concedía, pero el trabajo
    // se liquidaba igual: la reparación quedaba cerrada sin haber reparado
    // nada. Ahora es un motivo reintentable y cero mutaciones.
    const sinRecibo = interpretar(
      200,
      subscriberBody({ orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } })
    );
    assert.equal(sinRecibo.kind, "unavailable");
    if (sinRecibo.kind === "unavailable") {
      assert.equal(sinRecibo.reason, "active_without_environment");
    }

    const sinEntorno = interpretar(
      200,
      subscriberBody(
        { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
        { orbita_monthly: { expires_date_ms: FUTURE, period_type: "normal" } }
      )
    );
    assert.equal(sinEntorno.kind, "unavailable");
    if (sinEntorno.kind === "unavailable") {
      assert.equal(sinEntorno.reason, "active_without_environment");
    }
  });

  it("un entitlement en trial se proyecta como trialing", () => {
    const out = interpretar(
      200,
      subscriberBody(
        { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
        { orbita_monthly: { expires_date_ms: FUTURE, period_type: "trial", store: "app_store", is_sandbox: false } }
      )
    );
    assert.equal(out.kind === "resolved" && out.patch.status, "trialing");
  });

  it("lee is_sandbox también de non_subscriptions (compras permanentes declaradas)", () => {
    // Un permanente no vive en `subscriptions`: si el entorno sólo se buscara
    // ahí, una compra legítima quedaría sin verificar. Requiere el producto
    // declarado en `REVENUECAT_LIFETIME_PRODUCT_IDS` (el catálogo V1 es
    // mensual, así que por default esto no concede nada).
    const out = interpretRevenueCatSubscriber(
      200,
      {
        request_date_ms: NOW,
        subscriber: {
          original_app_user_id: "user_current",
          entitlements: { orbita_pro: { expires_date: null, product_identifier: "orbita_lifetime" } },
          subscriptions: {},
          non_subscriptions: {
            orbita_lifetime: [
              { id: "tx_1", purchase_date_ms: PAST, is_sandbox: true, store: "app_store" }
            ]
          }
        }
      },
      {
        expectedAppUserId: "user_current",
        env: { REVENUECAT_LIFETIME_PRODUCT_IDS: "orbita_lifetime" }
      }
    );
    assert.equal(out.kind === "resolved" && out.environment, "sandbox");
    assert.equal(out.kind === "resolved" && out.patch.isLifetime, true);
  });

  it("un entitlement sin vencimiento NO alcanza por sí solo para declarar lifetime", () => {
    // Cambio de contrato (A4/A6): `expires_date: null` sin una compra
    // permanente vigente que lo respalde no concede acceso permanente. La
    // evidencia coherente vive en `non_subscriptions` y se prueba en
    // `revenueCatRestContract.test.ts`.
    const out = interpretar(
      200,
      subscriberBody({ orbita_pro: { expires_date: null, product_identifier: "orbita_lifetime" } })
    );
    assert.equal(out.kind, "unavailable");
  });

  it("una cancelación detectada apaga la renovación sin quitar el acceso", () => {
    const out = interpretar(
      200,
      subscriberBody(
        { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
        {
          orbita_monthly: {
            expires_date_ms: FUTURE,
            period_type: "normal",
            store: "app_store",
            is_sandbox: false,
            unsubscribe_detected_at_ms: NOW
          }
        }
      )
    );
    assert.equal(out.kind, "resolved");
    if (out.kind !== "resolved") return;
    assert.equal(out.patch.status, "canceled");
    assert.equal(out.patch.willRenew, false);
    assert.equal(out.patch.currentPeriodEnd, FUTURE);
  });

  it("un 200 SIN el entitlement es autoritativo y retira el acceso", () => {
    const out = interpretar(200, subscriberBody({}));
    assert.equal(out.kind, "resolved");
    if (out.kind !== "resolved") return;
    assert.equal(out.patch.entitlement, "free");
    assert.equal(out.patch.isLifetime, false);
  });

  it("un entitlement vencido retira el acceso DEL ENTORNO que demuestra", () => {
    const out = interpretar(
      200,
      subscriberBody(
        { orbita_pro: { expires_date_ms: PAST, product_identifier: "orbita_monthly" } },
        { orbita_monthly: { expires_date_ms: PAST, is_sandbox: true } }
      )
    );
    assert.equal(out.kind === "resolved" && out.patch.entitlement, "free");
    // P1 4: nunca global. Un vencimiento no prueba nada sobre el otro entorno.
    assert.deepEqual(
      out.kind === "resolved" ? out.revocation : null,
      { kind: "environment", environment: "sandbox" }
    );
  });

  it("un entitlement vencido SIN recibo que lo describa es un snapshot inconsistente", () => {
    // P1 4: `subscriptions[productId]` ausente (o sin `is_sandbox`) no permite
    // saber de qué tienda vino. Antes esto producía un Free de alcance GLOBAL y
    // apagaba todas las filas del usuario, production incluida.
    const sinRecibo = interpretar(
      200,
      subscriberBody({ orbita_pro: { expires_date_ms: PAST, product_identifier: "orbita_monthly" } })
    );
    assert.equal(sinRecibo.kind, "unavailable");
    if (sinRecibo.kind === "unavailable") {
      assert.equal(sinRecibo.reason, "expired_without_environment");
    }

    const sinEntorno = interpretar(
      200,
      subscriberBody(
        { orbita_pro: { expires_date_ms: PAST, product_identifier: "orbita_monthly" } },
        { orbita_monthly: { expires_date_ms: PAST, period_type: "normal" } }
      )
    );
    assert.equal(sinEntorno.kind, "unavailable");
  });

  it("un 404 NO es una cuenta sin compras: el endpoint es GET-or-create", () => {
    // Cambio de contrato (A4): `/v1/subscribers/{id}` crea el subscriber si no
    // existía, así que nunca contesta 404 para una cuenta legítima. Leerlo como
    // "no compró nada" revocaba el acceso de alguien que sí pagó.
    assert.equal(interpretar(404, {}).kind, "unavailable");
  });

  it("declara el entorno del recibo sin inventarlo", () => {
    const sandbox = interpretar(
      200,
      subscriberBody(
        { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
        { orbita_monthly: { expires_date_ms: FUTURE, period_type: "normal", is_sandbox: true } }
      )
    );
    assert.equal(sandbox.kind === "resolved" && sandbox.environment, "sandbox");
    const prod = interpretar(
      200,
      subscriberBody(
        { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
        { orbita_monthly: { expires_date_ms: FUTURE, period_type: "normal", is_sandbox: false } }
      )
    );
    assert.equal(prod.kind === "resolved" && prod.environment, "production");
    const sinDato = interpretar(200, subscriberBody({}));
    assert.equal(sinDato.kind === "resolved" && sinDato.environment, undefined);
  });
});

describe("proyección — idempotente y sin pisar webhooks nuevos", () => {
  const user = { _id: "user_current_id", clerkUserId: "user_current" };
  const activo = {
    kind: "resolved" as const,
    observedAt: NOW,
    environment: "sandbox" as const,
    patch: {
      entitlement: PRO_ENTITLEMENT,
      status: "active" as const,
      plan: "monthly" as const,
      productId: "orbita_monthly",
      currentPeriodEnd: FUTURE,
      isLifetime: false,
      willRenew: true
    }
  };

  it("un webhook omitido se recupera: crea la fila que faltaba", async () => {
    const memory = memoryDb({ users: [user] });
    await project({ db: memory.db }, { clerkUserId: "user_current", outcome: activo });

    const row = memory.rows.get("subscriptions")?.[0];
    assert.equal(row?.entitlement, PRO_ENTITLEMENT);
    assert.equal(row?.provider, "revenuecat");
    assert.equal(row?.currentPeriodEnd, FUTURE);
    assert.equal(row?.clerkUserId, "user_current");
  });

  it("correrla dos veces no duplica filas ni cambia el resultado", async () => {
    const memory = memoryDb({ users: [user] });
    await project({ db: memory.db }, { clerkUserId: "user_current", outcome: activo });
    await project({ db: memory.db }, { clerkUserId: "user_current", outcome: activo });
    assert.equal(memory.rows.get("subscriptions")?.length, 1);
  });

  it("un `unavailable` no concede ni revoca", async () => {
    const memory = memoryDb({
      users: [user],
      subscriptions: [
        {
          _id: "sub_1",
          userId: "user_current_id",
          provider: "revenuecat",
          environment: "sandbox",
          entitlement: PRO_ENTITLEMENT,
          status: "active",
          currentPeriodEnd: FUTURE,
          lastEventAt: NOW - 10,
          updatedAt: NOW - 10
        }
      ]
    });
    await project(
      { db: memory.db },
      { clerkUserId: "user_current", outcome: { kind: "unavailable", reason: "http_503" } }
    );
    const row = memory.rows.get("subscriptions")?.[0];
    assert.equal(row?.entitlement, PRO_ENTITLEMENT);
    assert.equal(row?.currentPeriodEnd, FUTURE);
  });

  it("un `unavailable` tampoco crea una fila de la nada", async () => {
    const memory = memoryDb({ users: [user] });
    await project(
      { db: memory.db },
      { clerkUserId: "user_current", outcome: { kind: "unavailable", reason: "invalid_shape" } }
    );
    assert.equal(memory.rows.get("subscriptions")?.length, 0);
  });

  it("un resultado vacío no crea una fila Free innecesaria", async () => {
    const memory = memoryDb({ users: [user] });
    await project(
      { db: memory.db },
      {
        clerkUserId: "user_current",
        outcome: {
          kind: "resolved",
          observedAt: NOW,
          environment: "sandbox",
          patch: { entitlement: "free", status: "expired", isLifetime: false, willRenew: false }
        }
      }
    );
    assert.equal(memory.rows.get("subscriptions")?.length, 0);
  });

  it("un resultado vacío SÍ retira el acceso de una fila existente", async () => {
    const memory = memoryDb({
      users: [user],
      subscriptions: [
        {
          _id: "sub_1",
          userId: "user_current_id",
          provider: "revenuecat",
          environment: "sandbox",
          entitlement: PRO_ENTITLEMENT,
          status: "active",
          currentPeriodEnd: FUTURE,
          lastEventAt: NOW - 10,
          updatedAt: NOW - 10
        }
      ]
    });
    await project(
      { db: memory.db },
      {
        clerkUserId: "user_current",
        outcome: {
          kind: "resolved",
          observedAt: NOW,
          environment: "sandbox",
          // P1 1: el apagado declara su alcance. Sin `revocation` no se revoca
          // nada, que es la dirección segura para un campo que apaga acceso.
          revocation: { kind: "environment", environment: "sandbox" },
          patch: { entitlement: "free", status: "expired", isLifetime: false, willRenew: false }
        }
      }
    );
    assert.equal(memory.rows.get("subscriptions")?.[0]?.entitlement, "free");
  });

  it("una lectura vieja no pisa un webhook más nuevo", async () => {
    const memory = memoryDb({
      users: [user],
      subscriptions: [
        {
          _id: "sub_1",
          userId: "user_current_id",
          provider: "revenuecat",
          environment: "sandbox",
          entitlement: PRO_ENTITLEMENT,
          status: "active",
          currentPeriodEnd: FUTURE,
          lastEventAt: NOW + 1000,
          updatedAt: NOW + 1000
        }
      ]
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
    assert.equal(memory.rows.get("subscriptions")?.[0]?.entitlement, PRO_ENTITLEMENT);
  });

  it("producción NO concede desde un recibo sandbox de una cuenta cualquiera", async () => {
    // El gate de entorno del webhook no servía de nada si la reconciliación
    // podía proyectar el mismo recibo sandbox por la puerta de atrás.
    const previo = process.env.ORBITA_ENVIRONMENT;
    process.env.ORBITA_ENVIRONMENT = "production";
    try {
      const memory = memoryDb({ users: [user] });
      await project({ db: memory.db }, { clerkUserId: "user_current", outcome: activo });
      assert.equal(memory.rows.get("subscriptions")?.length, 0);
    } finally {
      if (previo === undefined) delete process.env.ORBITA_ENVIRONMENT;
      else process.env.ORBITA_ENVIRONMENT = previo;
    }
  });

  it("producción SÍ concede el sandbox de una cuenta de review allowlisted", async () => {
    const previoEnv = process.env.ORBITA_ENVIRONMENT;
    const previoLista = process.env.REVENUECAT_SANDBOX_REVIEW_USER_IDS;
    process.env.ORBITA_ENVIRONMENT = "production";
    process.env.REVENUECAT_SANDBOX_REVIEW_USER_IDS = "user_current";
    try {
      const memory = memoryDb({ users: [user] });
      await project({ db: memory.db }, { clerkUserId: "user_current", outcome: activo });
      assert.equal(memory.rows.get("subscriptions")?.[0]?.entitlement, PRO_ENTITLEMENT);
    } finally {
      if (previoEnv === undefined) delete process.env.ORBITA_ENVIRONMENT;
      else process.env.ORBITA_ENVIRONMENT = previoEnv;
      if (previoLista === undefined) delete process.env.REVENUECAT_SANDBOX_REVIEW_USER_IDS;
      else process.env.REVENUECAT_SANDBOX_REVIEW_USER_IDS = previoLista;
    }
  });

  it("no concede si la lectura no permite verificar el entorno del recibo", async () => {
    const memory = memoryDb({ users: [user] });
    await project(
      { db: memory.db },
      {
        clerkUserId: "user_current",
        outcome: { ...activo, environment: undefined }
      }
    );
    assert.equal(memory.rows.get("subscriptions")?.length, 0);
  });

  it("retirar el acceso no depende de la allowlist: un vacío autoritativo siempre vale", async () => {
    // Conceder exige entorno permitido; RETIRAR no. Acá el deployment es
    // producción y la cuenta no está allowlisted, así que jamás podría
    // conceder desde sandbox — pero sí tiene que poder apagar la fila sandbox
    // que quedó viva.
    const previo = process.env.ORBITA_ENVIRONMENT;
    process.env.ORBITA_ENVIRONMENT = "production";
    try {
      const memory = memoryDb({
        users: [user],
        subscriptions: [
          {
            _id: "sub_1",
            userId: "user_current_id",
            provider: "revenuecat",
            environment: "sandbox",
            entitlement: PRO_ENTITLEMENT,
            status: "active",
            currentPeriodEnd: FUTURE,
            lastEventAt: NOW - 10,
            updatedAt: NOW - 10
          }
        ]
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
      assert.equal(memory.rows.get("subscriptions")?.[0]?.entitlement, "free");
    } finally {
      if (previo === undefined) delete process.env.ORBITA_ENVIRONMENT;
      else process.env.ORBITA_ENVIRONMENT = previo;
    }
  });

  it("una fila legada sin environment se repara con un Free de alcance global", async () => {
    // Mientras tanto no concede: `isRowActive` la falla cerrada. Este es el
    // camino que la limpia de verdad, para que la auditoría no arrastre una
    // fila que dice `orbita_pro` sin poder demostrar de qué tienda vino.
    //
    // P1 1: el alcance `global` es lo que produce un cuerpo COMPLETO sin el
    // entitlement canónico, y es el único que llega a una fila legada — antes
    // se buscaba `row.environment === undefined` y una fila production con
    // acceso vivo nunca se apagaba.
    const memory = memoryDb({
      users: [user],
      subscriptions: [
        {
          _id: "sub_legacy",
          userId: "user_current_id",
          provider: "revenuecat",
          entitlement: PRO_ENTITLEMENT,
          status: "active",
          currentPeriodEnd: FUTURE,
          lastEventAt: NOW - 10,
          updatedAt: NOW - 10
        }
      ]
    });
    await project(
      { db: memory.db },
      {
        clerkUserId: "user_current",
        outcome: {
          kind: "resolved",
          observedAt: NOW,
          revocation: { kind: "global" },
          patch: { entitlement: "free", status: "expired", isLifetime: false, willRenew: false }
        }
      }
    );
    assert.equal(memory.rows.get("subscriptions")?.[0]?.entitlement, "free");
  });

  it("un usuario todavía inexistente no rompe ni inventa nada", async () => {
    const memory = memoryDb({});
    await project({ db: memory.db }, { clerkUserId: "user_fantasma", outcome: activo });
    assert.equal(memory.rows.get("subscriptions")?.length, 0);
  });

  it("no conserva PII ni el payload crudo en la auditoría", async () => {
    const memory = memoryDb({ users: [user] });
    await project({ db: memory.db }, { clerkUserId: "user_current", outcome: activo });
    for (const evento of memory.rows.get("paymentEvents") ?? []) {
      const raw = JSON.stringify(evento.rawPayload ?? {});
      assert.equal(/subscriber_attributes|email|@/.test(raw), false);
      assert.equal("subscriber" in (evento.rawPayload ?? {}), false);
    }
  });
});

describe("la superficie pública es una MUTATION y sólo mira la sesión de quien llama", () => {
  const handler = (requestStoreReconcile as any)._handler;

  /** Base mínima con `users`, `reconcileJobs` y `publicRateLimits`. */
  function baseCon(users: MemoryRow[]) {
    const memory = memoryDb({ users });
    const agendados: any[] = [];
    return {
      memory,
      agendados,
      ctx: {
        db: memory.db,
        scheduler: {
          async runAfter(_d: number, _ref: unknown, args: any) {
            agendados.push(args);
            return `sched_${agendados.length}`;
          }
        },
        auth: {
          getUserIdentity: async () => ({
            subject: "user_current",
            tokenIdentifier: "issuer|user_current"
          })
        }
      }
    };
  }

  it("no declara ningún argumento de entrada", () => {
    const args = JSON.parse((requestStoreReconcile as any).exportArgs());
    assert.deepEqual(Object.keys(args.value ?? {}), []);
  });

  it("REPRO: el trabajo queda ESCRITO antes de que ninguna action exista", async () => {
    // P1 8: como action pública, esto podía morir antes de crear nada y el
    // pedido de la persona se perdía. Ahora el cupo y el trabajo viven en la
    // misma transacción, y la action se agenda desde ahí.
    const { ctx, memory } = baseCon([{ _id: "u1", clerkUserId: "user_current" }]);
    const out = await handler(ctx, {});
    assert.equal(out.status, "queued");

    const jobs = memory.rows.get("reconcileJobs") ?? [];
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].clerkUserId, "user_current");
    assert.equal(jobs[0].status, "pending");
    assert.equal(jobs[0].requestedSeq, 1);
  });

  it("IGNORA lo que mande el cliente: la cuenta sale de `ctx.auth`", async () => {
    const { ctx, memory } = baseCon([{ _id: "u1", clerkUserId: "user_current" }]);
    await handler(ctx, {
      clerkUserId: "user_B",
      customerInfo: { entitlements: { active: { orbita_pro: {} } } },
      entitlement: "orbita_pro",
      receipt: "recibo-falsificado"
    });
    const jobs = memory.rows.get("reconcileJobs") ?? [];
    assert.deepEqual(
      jobs.map((job) => job.clerkUserId),
      ["user_current"]
    );
  });

  it("sin sesión no encola ni gasta cupo", async () => {
    const { ctx, memory } = baseCon([]);
    (ctx as any).auth = { getUserIdentity: async () => null };
    const out = await handler(ctx, {});
    assert.equal(out.status, "unauthenticated");
    assert.equal(memory.rows.get("reconcileJobs")?.length ?? 0, 0);
    assert.equal(memory.rows.get("publicRateLimits")?.length ?? 0, 0);
  });

  it("sin fila local tampoco encola: no hay dónde proyectar", async () => {
    const { ctx, memory } = baseCon([]);
    const out = await handler(ctx, {});
    assert.equal(out.status, "unauthenticated");
    assert.equal(memory.rows.get("reconcileJobs")?.length ?? 0, 0);
  });

  it("el cupo sigue vivo y por cuenta", async () => {
    const { ctx } = baseCon([{ _id: "u1", clerkUserId: "user_current" }]);
    const estados: string[] = [];
    for (let i = 0; i < 6; i += 1) estados.push((await handler(ctx, {})).status);
    assert.ok(estados.includes("cooldown"), `una ráfaga de 6 no puede pasar entera: ${estados}`);
    assert.equal(estados[0], "queued");
  });

  it("el contador del cupo no guarda el Clerk id en claro", async () => {
    const { ctx, memory } = baseCon([{ _id: "u1", clerkUserId: "user_current" }]);
    await handler(ctx, {});
    const contadores = memory.rows.get("publicRateLimits") ?? [];
    assert.equal(contadores.length, 1);
    assert.equal(String(contadores[0].bucketKey).includes("user_current"), false);
    assert.equal(contadores[0].subjectHash, rateLimitSubjectHash("user_current"));
  });
});
