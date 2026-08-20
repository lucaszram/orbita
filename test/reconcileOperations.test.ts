/**
 * Operación de la reconciliación: política de reintento, validador cerrado,
 * auditoría idempotente y contrato de la action.
 *
 * La CADENA durable completa —watchdog, señales, leases, agotamiento— vive en
 * `revenueCatReconcileDurability.test.ts`, que corre el ciclo entero. La
 * superficie pública vive en `revenueCatReconciliation.test.ts`. Acá quedan las
 * piezas sueltas que se prueban mejor de a una.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RECONCILE_MAX_ATTEMPTS, reconcileRetryPlan } from "../convex/lib/revenueCatRetry";
import {
  projectRevenueCatSubscriber,
  reconcileStoreEntitlement,
  requestStoreReconcile
} from "../convex/payments/revenuecatRest";

const NOW = 1_800_000_000_000;
const FUTURE = 2_000_000_000_000;

type MemoryRow = Record<string, any> & { _id: string };

function memoryDb(seed: Record<string, MemoryRow[]>) {
  const initial: Record<string, MemoryRow[]> = {
    users: [],
    subscriptions: [],
    paymentEvents: [],
    publicRateLimits: [],
    reconcileJobs: [],
    ...seed
  };
  const rows = new Map<string, MemoryRow[]>(
    Object.entries(initial).map(([t, e]) => [t, e.map((r) => ({ ...r }))])
  );
  let seq = 0;
  const db = {
    async get(id: string) {
      for (const list of rows.values()) {
        const row = list.find((r) => r._id === id);
        if (row) return { ...row };
      }
      return null;
    },
    query(table: string) {
      const filters = new Map<string, unknown>();
      const q = { eq(f: string, v: unknown) { filters.set(f, v); return q; } };
      return {
        withIndex(_i: string, build: (b: typeof q) => unknown) {
          build(q);
          const found = () =>
            (rows.get(table) ?? []).filter((r) => [...filters].every(([f, v]) => r[f] === v));
          return {
            first: async () => found()[0] ?? null,
            collect: async () => found(),
            order: () => ({ first: async () => found()[0] ?? null, collect: async () => found() }),
            take: async (n: number) => found().slice(0, n)
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
    },
    async delete(id: string) {
      for (const [table, list] of rows.entries()) {
        const index = list.findIndex((r) => r._id === id);
        if (index >= 0) {
          list.splice(index, 1);
          rows.set(table, list);
          return;
        }
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

describe("A7 — retry acotado, sólo para lo que puede mejorar solo", () => {
  it("reintenta lo transitorio de red y de la tienda", () => {
    for (const reason of ["http_429", "http_500", "http_502", "http_503", "network_error", "timeout"]) {
      const plan = reconcileRetryPlan(reason, 1);
      assert.equal(plan.retry, true, reason);
      assert.ok(plan.delayMs > 0, reason);
    }
  });

  it("NO reintenta un problema de credencial o de configuración", () => {
    for (const reason of ["http_401", "http_403", "not_configured", "http_400", "http_404"]) {
      assert.equal(reconcileRetryPlan(reason, 1).retry, false, reason);
    }
  });

  it("NO reintenta una identidad ajena: es cuarentena, no una ventana", () => {
    for (const reason of [
      "subscriber_identity_mismatch",
      "anonymous_subscriber_identity",
      "unverified_subscriber_identity"
    ]) {
      assert.equal(reconcileRetryPlan(reason, 1).retry, false, reason);
    }
  });

  it("NO reintenta un producto permanente sin declarar: es catálogo, no una ventana", () => {
    // El catálogo de lanzamiento es mensual y `REVENUECAT_LIFETIME_PRODUCT_IDS`
    // está vacía a propósito. La próxima lectura dice exactamente lo mismo;
    // reintentarla es una tormenta que no arregla nada.
    assert.equal(reconcileRetryPlan("lifetime_product_not_allowlisted", 1).retry, false);
  });

  it("SÍ reintenta un cuerpo ilegible o inconsistente", () => {
    // La ilegibilidad puede ser una ventana transitoria y ninguno de estos
    // motivos muta acceso mientras tanto. El techo evita la tormenta.
    for (const reason of [
      "invalid_shape",
      "invalid_request_date",
      "invalid_entitlement",
      "invalid_entitlement_product",
      "invalid_expiration",
      "lifetime_without_purchase_evidence",
      // Las dos caras del snapshot que declara un entitlement cuyo recibo no
      // describe: el recibo puede aparecer en la próxima lectura.
      "active_without_environment",
      "expired_without_environment",
      // Un campo de lifecycle declarado pero ilegible.
      "invalid_subscription_lifecycle",
      "invalid_subscriber_identity"
    ]) {
      assert.equal(reconcileRetryPlan(reason, 1).retry, true, reason);
    }
  });

  it("un motivo desconocido NO se reintenta: falla hacia el lado sin tormenta", () => {
    assert.equal(reconcileRetryPlan("algo_que_nadie_declaro", 1).retry, false);
  });

  it("el reintento está ACOTADO", () => {
    assert.equal(reconcileRetryPlan("http_503", RECONCILE_MAX_ATTEMPTS).retry, false);
    assert.equal(reconcileRetryPlan("http_503", RECONCILE_MAX_ATTEMPTS + 5).retry, false);
    assert.ok(RECONCILE_MAX_ATTEMPTS >= 2 && RECONCILE_MAX_ATTEMPTS <= 8);
  });

  it("el backoff crece entre intentos", () => {
    const uno = reconcileRetryPlan("http_503", 1).delayMs;
    const dos = reconcileRetryPlan("http_503", 2).delayMs;
    assert.ok(dos > uno, `${dos} debe superar a ${uno}`);
  });
});

describe("A7 — auditoría idempotente", () => {
  const user = { _id: "u1", clerkUserId: "user_current" };
  const activo = {
    kind: "resolved" as const,
    observedAt: NOW,
    environment: "sandbox" as const,
    subscriberId: "user_current",
    revocation: { kind: "none" as const },
    patch: {
      entitlement: "orbita_pro" as const,
      status: "active" as const,
      currentPeriodEnd: FUTURE,
      isLifetime: false,
      willRenew: true
    }
  };

  it("la MISMA observación no duplica paymentEvents", async () => {
    const memory = memoryDb({ users: [user] });
    for (let i = 0; i < 3; i += 1) {
      await project({ db: memory.db }, { clerkUserId: "user_current", outcome: activo });
    }
    assert.equal(memory.rows.get("paymentEvents")?.length, 1);
    assert.equal(memory.rows.get("subscriptions")?.length, 1);
  });

  it("una observación NUEVA sí deja su propia entrada", async () => {
    const memory = memoryDb({ users: [user] });
    await project({ db: memory.db }, { clerkUserId: "user_current", outcome: activo });
    await project(
      { db: memory.db },
      { clerkUserId: "user_current", outcome: { ...activo, observedAt: NOW + 60_000 } }
    );
    assert.equal(memory.rows.get("paymentEvents")?.length, 2);
  });

  it("un `unavailable` también se audita, sin mutar acceso", async () => {
    // P1 13: un `subscriber_identity_mismatch` es justo lo que hay que poder
    // ver después, y antes no dejaba ninguna fila.
    const memory = memoryDb({ users: [user] });
    await project(
      { db: memory.db },
      {
        clerkUserId: "user_current",
        trigger: "webhook:TEST",
        outcome: { kind: "unavailable", reason: "subscriber_identity_mismatch" }
      }
    );
    const auditoria = memory.rows.get("paymentEvents") ?? [];
    assert.equal(auditoria.length, 1);
    assert.equal(auditoria[0].eventType, "RECONCILE");
    assert.equal((auditoria[0].rawPayload as any).kind, "unavailable");
    assert.equal((auditoria[0].rawPayload as any).reason, "subscriber_identity_mismatch");
    assert.equal(memory.rows.get("subscriptions")?.length, 0);

    const raw = JSON.stringify(auditoria[0].rawPayload ?? {});
    assert.equal(/subscriber_attributes|aliases|original_app_user_id|@/.test(raw), false);
    assert.equal("subscriber" in (auditoria[0].rawPayload ?? {}), false);
  });
});

describe("A7 — el outcome viaja por un validador cerrado", () => {
  it("`projectRevenueCatSubscriber` no acepta `v.any()` para el outcome", () => {
    // `exportArgs()` es la serialización REAL del validador que Convex aplica
    // en runtime; `fn.args` no existe en el objeto de función.
    const args = JSON.parse((projectRevenueCatSubscriber as any).exportArgs());
    const outcome = args.value?.outcome?.fieldType;
    assert.ok(outcome, "falta el argumento outcome");
    assert.notEqual(outcome.type, "any", "un v.any() deja entrar datos sin validar a la fila");
    assert.equal(outcome.type, "union");
    const resuelto = outcome.value.find((v: any) => v.value?.kind?.fieldType?.value === "resolved");
    assert.deepEqual(Object.keys(resuelto.value.patch.fieldType.value).sort(), [
      "currentPeriodEnd",
      "entitlement",
      "isLifetime",
      "plan",
      "productId",
      "status",
      "willRenew"
    ]);
  });

  it("la superficie pública no declara NINGÚN argumento", () => {
    const args = JSON.parse((requestStoreReconcile as any).exportArgs());
    assert.deepEqual(Object.keys(args.value ?? {}), []);
  });

  it("la action interna EXIGE trabajo durable: `jobId` y `lease` obligatorios", () => {
    // P1 8: no puede quedar ningún camino at-most-once sin estado persistido.
    const args = JSON.parse((reconcileStoreEntitlement as any).exportArgs());
    assert.equal(args.value?.jobId?.optional, false);
    assert.equal(args.value?.lease?.optional, false);
  });

  it("un outcome con forma desconocida no muta acceso", async () => {
    const memory = memoryDb({ users: [{ _id: "u1", clerkUserId: "user_current" }] });
    for (const outcome of [null, undefined, {}, { kind: "otro" }, "texto", 42]) {
      await project({ db: memory.db }, { clerkUserId: "user_current", outcome });
    }
    assert.equal(memory.rows.get("subscriptions")?.length, 0);
  });
});

describe("A7 — la action revalida el lease antes de tocar la red", () => {
  const handler = (reconcileStoreEntitlement as any)._handler;

  /** Corre la action con el lease guionado y un `fetch` que se puede espiar. */
  async function correr(options: { leaseVigente: boolean; respuesta?: { status: number; body?: unknown } }) {
    const previoSecret = process.env.REVENUECAT_SECRET_API_KEY;
    const previoEnv = process.env.ORBITA_ENVIRONMENT;
    const fetchOriginal = globalThis.fetch;
    process.env.REVENUECAT_SECRET_API_KEY = "sk-de-prueba";
    process.env.ORBITA_ENVIRONMENT = "development";

    const pedidos: string[] = [];
    const proyectados: any[] = [];
    const reportes: any[] = [];
    globalThis.fetch = (async () => {
      pedidos.push("fetch");
      const guion = options.respuesta ?? { status: 200, body: {} };
      return { status: guion.status, json: async () => guion.body ?? {} } as any;
    }) as any;

    const ctx: any = {
      runQuery: async () => options.leaseVigente,
      runMutation: async (_ref: unknown, args: any) => {
        if (args && "result" in args) {
          reportes.push(args);
          return null;
        }
        // `projectReconcileResult` devuelve un resultado explícito. Acá el
        // trabajo durable está fuera de alcance —se prueba entero en
        // `revenueCatReconcileDurability.test.ts`— así que se acepta siempre.
        proyectados.push(args.outcome);
        return { status: "applied" };
      }
    };

    try {
      const salida = await handler(ctx, {
        clerkUserId: "user_a",
        trigger: "webhook:TEST",
        jobId: "reconcileJobs_1",
        lease: "1:1:1"
      });
      return { pedidos, proyectados, reportes, salida };
    } finally {
      globalThis.fetch = fetchOriginal;
      if (previoSecret === undefined) delete process.env.REVENUECAT_SECRET_API_KEY;
      else process.env.REVENUECAT_SECRET_API_KEY = previoSecret;
      if (previoEnv === undefined) delete process.env.ORBITA_ENVIRONMENT;
      else process.env.ORBITA_ENVIRONMENT = previoEnv;
    }
  }

  it("REPRO: con el lease vencido NO consulta RevenueCat", async () => {
    // P1 10: tras un borrado de cuenta —o cuando otra corrida tomó el trabajo—
    // una action ya agendada tiene que salir sin tocar la tienda.
    const { pedidos, proyectados, reportes, salida } = await correr({ leaseVigente: false });
    assert.deepEqual(pedidos, [], "cero fetch");
    assert.deepEqual(proyectados, []);
    assert.deepEqual(reportes, []);
    assert.equal(salida.status, "stale");
  });

  it("con el lease vigente sí lee, proyecta y reporta", async () => {
    const cuerpo = {
      request_date_ms: NOW,
      subscriber: {
        original_app_user_id: "user_a",
        entitlements: {
          orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" }
        },
        subscriptions: { orbita_monthly: { expires_date_ms: FUTURE, is_sandbox: true } },
        non_subscriptions: {}
      }
    };
    const { pedidos, proyectados, reportes, salida } = await correr({
      leaseVigente: true,
      respuesta: { status: 200, body: cuerpo }
    });
    assert.equal(pedidos.length, 1);
    assert.equal(proyectados[0].kind, "resolved");
    assert.equal(reportes[0].result, "settled");
    assert.equal(reportes[0].outcome, "resolved");
    assert.equal(reportes[0].lease, "1:1:1");
    assert.equal(reportes[0].clerkUserId, "user_a");
    assert.equal(salida.status, "resolved");
  });

  it("sin credencial no toca la red y liquida sin reintentar", async () => {
    const previo = process.env.REVENUECAT_SECRET_API_KEY;
    delete process.env.REVENUECAT_SECRET_API_KEY;
    const fetchOriginal = globalThis.fetch;
    let toco = false;
    globalThis.fetch = (async () => {
      toco = true;
      return { status: 200, json: async () => ({}) } as any;
    }) as any;
    const reportes: any[] = [];
    try {
      const out = await handler(
        {
          runQuery: async () => true,
          runMutation: async (_ref: unknown, args: any) => {
            if (args && "result" in args) reportes.push(args);
            return null;
          }
        },
        { clerkUserId: "user_a", jobId: "reconcileJobs_1", lease: "1:1:1" }
      );
      assert.equal(out.status, "not_configured");
      assert.equal(toco, false);
      assert.deepEqual(reportes, [
        { jobId: "reconcileJobs_1", clerkUserId: "user_a", lease: "1:1:1", result: "settled", outcome: "not_configured" }
      ]);
    } finally {
      globalThis.fetch = fetchOriginal;
      if (previo !== undefined) process.env.REVENUECAT_SECRET_API_KEY = previo;
    }
  });
});
