/**
 * Autorización por identidad canónica y aislamiento de entornos (A1, A2, A3).
 *
 * Tres agujeros que comparten la misma raíz: el backend autorizaba y proyectaba
 * usando *strings candidatos* en vez de la única cuenta local que el evento
 * realmente resuelve.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isRowActive, resolveEntitlement, type SubscriptionRow } from "../convex/lib/entitlements";
import { resolveRowsForUser } from "../convex/lib/subscriptionAccess";
import { applyRevenueCatEvent } from "../convex/payments/revenuecat";
import { projectRevenueCatSubscriber } from "../convex/payments/revenuecatRest";

const EVENT_AT = 1_900_000_000_000;
const NOW = 1_800_000_000_000;
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

  const matches = (row: MemoryRow, filters: Map<string, unknown>) =>
    [...filters].every(([f, v]) => row[f] === v);

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
          const found = () => (rows.get(table) ?? []).filter((row) => matches(row, filters));
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

  const ctx = {
    db,
    scheduler: {
      async runAfter(_d: number, _ref: unknown, args: any) {
        scheduled.push(args);
      }
    }
  };
  return { ctx, rows, scheduled };
}

const apply = async (ctx: unknown, event: Record<string, unknown>) =>
  await (applyRevenueCatEvent as any)._handler(ctx, { event });
const project = async (ctx: unknown, args: Record<string, unknown>) =>
  await (projectRevenueCatSubscriber as any)._handler(ctx, args);

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

const PROD_CON_REVIEW = {
  ORBITA_ENVIRONMENT: "production",
  REVENUECAT_SANDBOX_REVIEW_USER_IDS: "user_review"
};

describe("A1 — la allowlist autoriza a la identidad resuelta, no a un string cualquiera", () => {
  it("un alias allowlisted NO habilita el sandbox de otra cuenta", async () => {
    // El evento nombra a `user_review` (allowlisted, sin fila local) y a
    // `user_common` (fila local real, NO allowlisted). Autorizar por "algún
    // candidato coincide" le regalaba Plus a user_common en producción.
    await withEnv(PROD_CON_REVIEW, async () => {
      const { ctx, rows } = harness({ users: [{ _id: "u_common", clerkUserId: "user_common" }] });
      await apply(ctx, {
        id: "rc_bypass",
        type: "INITIAL_PURCHASE",
        event_timestamp_ms: EVENT_AT,
        environment: "SANDBOX",
        entitlement_ids: ["orbita_pro"],
        app_user_id: "user_common",
        aliases: ["user_review"],
        product_id: "orbita_monthly",
        expiration_at_ms: FUTURE
      });
      assert.equal(rows.get("subscriptions")?.length, 0, "user_common no puede quedar Pro");
      assert.equal(
        rows.get("paymentEvents")?.[0]?.rawPayload?.outcome,
        "ignored_environment_mismatch"
      );
    });
  });

  it("la cuenta de review sí sigue pudiendo comprar en Sandbox", async () => {
    await withEnv(PROD_CON_REVIEW, async () => {
      const { ctx, rows } = harness({ users: [{ _id: "u_review", clerkUserId: "user_review" }] });
      await apply(ctx, {
        id: "rc_review_ok",
        type: "INITIAL_PURCHASE",
        event_timestamp_ms: EVENT_AT,
        environment: "SANDBOX",
        entitlement_ids: ["orbita_pro"],
        app_user_id: "user_review",
        product_id: "orbita_monthly",
        expiration_at_ms: FUTURE
      });
      assert.equal(rows.get("subscriptions")?.[0]?.entitlement, "orbita_pro");
      assert.equal(rows.get("subscriptions")?.[0]?.environment, "sandbox");
    });
  });

  it("la proyección REST tampoco autoriza por un id que no es el dueño de la fila", async () => {
    await withEnv(PROD_CON_REVIEW, async () => {
      const { ctx, rows } = harness({ users: [{ _id: "u_common", clerkUserId: "user_common" }] });
      await project(ctx, {
        clerkUserId: "user_common",
        outcome: {
          kind: "resolved",
          observedAt: NOW,
          environment: "sandbox",
          patch: {
            entitlement: "orbita_pro",
            status: "active",
            currentPeriodEnd: FUTURE,
            isLifetime: false,
            willRenew: true
          }
        }
      });
      assert.equal(rows.get("subscriptions")?.length, 0);
    });
  });
});

describe("A2 — sandbox y production no se pisan", () => {
  const sandboxOutcome = {
    kind: "resolved" as const,
    observedAt: NOW + 100,
    environment: "sandbox" as const,
    patch: {
      entitlement: "orbita_pro" as const,
      status: "active" as const,
      currentPeriodEnd: FUTURE,
      isLifetime: false,
      willRenew: true
    }
  };

  it("un snapshot sandbox no parchea la fila production", async () => {
    await withEnv(
      { ORBITA_ENVIRONMENT: "production", REVENUECAT_SANDBOX_REVIEW_USER_IDS: "user_review" },
      async () => {
        const { ctx, rows } = harness({
          users: [{ _id: "u1", clerkUserId: "user_review" }],
          subscriptions: [
            {
              _id: "sub_prod",
              userId: "u1",
              clerkUserId: "user_review",
              provider: "revenuecat",
              environment: "production",
              entitlement: "orbita_pro",
              status: "active",
              currentPeriodEnd: FUTURE,
              lastEventAt: NOW
            }
          ]
        });
        await project(ctx, { clerkUserId: "user_review", outcome: sandboxOutcome });

        const prod = rows.get("subscriptions")?.find((r) => r.environment === "production");
        const sandbox = rows.get("subscriptions")?.find((r) => r.environment === "sandbox");
        assert.equal(prod?._id, "sub_prod", "la fila productiva no se movió");
        assert.equal(prod?.currentPeriodEnd, FUTURE);
        assert.ok(sandbox, "la fila sandbox convive en vez de pisar");
        assert.notEqual(sandbox?._id, "sub_prod");
      }
    );
  });

  it("al vaciar la allowlist, una fila sandbox persistida deja de conceder Plus", () => {
    const sandboxRow: SubscriptionRow = {
      entitlement: "orbita_pro",
      provider: "revenuecat",
      status: "active",
      currentPeriodEnd: FUTURE,
      environment: "sandbox"
    };
    assert.equal(isRowActive(sandboxRow, NOW, { sandboxAllowed: true }), true);
    assert.equal(isRowActive(sandboxRow, NOW, { sandboxAllowed: false }), false);
    assert.equal(resolveEntitlement([sandboxRow], NOW, { sandboxAllowed: false }).isPro, false);
    // Sin contexto explícito se falla cerrado.
    assert.equal(isRowActive(sandboxRow, NOW), false);
  });

  it("una fila production no depende de la allowlist DE SANDBOX", () => {
    const prodRow: SubscriptionRow = {
      entitlement: "orbita_pro",
      provider: "revenuecat",
      status: "active",
      currentPeriodEnd: FUTURE,
      environment: "production"
    };
    assert.equal(
      isRowActive(prodRow, NOW, { sandboxAllowed: false, productionAllowed: true }),
      true
    );
  });

  it("REPRO: una fila production NO concede en un deployment que no acepta production", () => {
    // P1 2: el corte de entorno tenía una sola puerta. `sandboxAllowed` cerraba
    // el recibo de prueba, pero `production` no se autorizaba nunca: un
    // deployment de development —o uno sin entorno declarado— concedía Órbita
    // Plus desde una fila productiva, y cualquier consumidor que llamara sin
    // contexto entraba por ahí.
    const prodRow: SubscriptionRow = {
      entitlement: "orbita_pro",
      provider: "revenuecat",
      status: "active",
      currentPeriodEnd: FUTURE,
      environment: "production"
    };
    // Default directo: falla cerrado.
    assert.equal(isRowActive(prodRow, NOW), false);
    assert.equal(resolveEntitlement([prodRow], NOW).isPro, false);
    // development: acepta Sandbox, no Production.
    assert.equal(isRowActive(prodRow, NOW, { sandboxAllowed: true, productionAllowed: false }), false);
    // unknown: no acepta ninguna de las dos.
    assert.equal(
      isRowActive(prodRow, NOW, { sandboxAllowed: false, productionAllowed: false }),
      false
    );
  });

  it("el contexto se calcula UNA vez y sigue el entorno del deployment", async () => {
    const prodRow: SubscriptionRow = {
      entitlement: "orbita_pro",
      provider: "revenuecat",
      clerkUserId: "user_common",
      status: "active",
      currentPeriodEnd: FUTURE,
      environment: "production"
    };
    await withEnv({ ORBITA_ENVIRONMENT: "development" }, async () => {
      assert.equal(resolveRowsForUser([prodRow], NOW).isPro, false, "development no acepta production");
    });
    await withEnv(
      { ORBITA_ENVIRONMENT: undefined, ORBITA_ENV: undefined, COMMERCE_MODE: undefined, CONVEX_DEPLOYMENT: undefined },
      async () => {
        assert.equal(resolveRowsForUser([prodRow], NOW).isPro, false, "unknown no acepta nada");
      }
    );
    await withEnv({ ORBITA_ENVIRONMENT: "production" }, async () => {
      assert.equal(resolveRowsForUser([prodRow], NOW).isPro, true);
    });
  });

  it("una fila legacy de RevenueCat SIN environment falla cerrado", () => {
    // Documentado para auditoría/migración: no se puede demostrar de qué tienda
    // vino, así que no concede. La reconciliación REST la repara escribiendo el
    // entorno real.
    const legacy: SubscriptionRow = {
      entitlement: "orbita_pro",
      provider: "revenuecat",
      status: "active",
      currentPeriodEnd: FUTURE
    };
    assert.equal(isRowActive(legacy, NOW, { sandboxAllowed: true }), false);
    assert.equal(resolveEntitlement([legacy], NOW, { sandboxAllowed: true }).isPro, false);
  });

  it("Stripe no se ve afectado por el corte de entorno", () => {
    const stripeRow: SubscriptionRow = {
      entitlement: "orbita_pro",
      provider: "stripe",
      status: "active",
      currentPeriodEnd: FUTURE
    };
    assert.equal(isRowActive(stripeRow, NOW, { sandboxAllowed: false }), true);
    assert.equal(resolveEntitlement([stripeRow], NOW).isPro, true);
  });

  it("con sandbox inhabilitado, Stripe sigue sosteniendo el acceso", () => {
    const rows: SubscriptionRow[] = [
      { entitlement: "orbita_pro", provider: "revenuecat", status: "active", currentPeriodEnd: FUTURE, environment: "sandbox" },
      { entitlement: "orbita_pro", provider: "stripe", status: "active", currentPeriodEnd: FUTURE }
    ];
    const resolved = resolveEntitlement(rows, NOW, { sandboxAllowed: false });
    assert.equal(resolved.isPro, true);
    assert.deepEqual(resolved.activeProviders, ["stripe"]);
    assert.equal(resolved.canManageInRevenueCat, false);
  });
});

describe("A3 — identidad ambigua queda en cuarentena, sin reconciliar", () => {
  it("no muta acceso y NO agenda reconciliación de ninguno de los dos", async () => {
    // Los aliases devuelven el MISMO CustomerInfo: reconciliar A y B dejaría a
    // los dos Pro desde una sola compra.
    await withEnv({ ORBITA_ENVIRONMENT: "development" }, async () => {
      const { ctx, rows, scheduled } = harness({
        users: [
          { _id: "u1", clerkUserId: "user_uno" },
          { _id: "u2", clerkUserId: "user_dos" }
        ]
      });
      await apply(ctx, {
        id: "rc_ambiguo",
        type: "INITIAL_PURCHASE",
        event_timestamp_ms: EVENT_AT,
        environment: "SANDBOX",
        entitlement_ids: ["orbita_pro"],
        app_user_id: "user_uno",
        original_app_user_id: "user_dos",
        product_id: "orbita_monthly",
        expiration_at_ms: FUTURE
      });

      assert.equal(rows.get("subscriptions")?.length, 0, "proRows debe quedar vacío");
      assert.equal(
        rows.get("paymentEvents")?.[0]?.rawPayload?.outcome,
        "ignored_ambiguous_identity"
      );
      assert.deepEqual(scheduled, [], "una identidad ambigua no se reconcilia sola");
      assert.deepEqual(
        rows.get("reconcileJobs") ?? [],
        [],
        "ni deja trabajo durable escrito para ninguno de los dos"
      );
    });
  });
});
