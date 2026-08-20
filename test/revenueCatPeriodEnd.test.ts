/**
 * Fechas de fin de período: finitas **y positivas** (P1 de la sexta pasada).
 *
 * ## El agujero
 *
 * `finiteNumber` sólo exigía finitud, así que `expiration_at_ms: 0` —o
 * negativo— pasaba como una fecha válida. Con una fila Pro vigente y un
 * `event_timestamp_ms` correcto, un `RENEWAL` con ese valor devolvía
 * `kind: "apply"` y escribía `currentPeriodEnd: 0`. Eso no es "sin fecha": es
 * la época Unix, y `isRowActive` la compara contra `now`, así que **corta un
 * acceso pagado vigente en el acto**. Lo mismo con
 * `grace_period_expiration_at_ms` en `BILLING_ISSUE`.
 *
 * ## La regla
 *
 * Un instante en el pasado remoto no es una fecha de fin de suscripción: es un
 * payload que no se entiende. Los eventos que CONCEDEN o extienden sin poder
 * demostrar un fin positivo se ignoran —y el camino de `ignore` ya dispara la
 * lectura autoritativa—. Los que revocan por su propio tipo (`EXPIRATION`, el
 * reembolso `CUSTOMER_SUPPORT`) siguen cortando, pero no escriben la fecha
 * corrupta.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isRowActive, type SubscriptionRow } from "../convex/lib/entitlements";
import {
  deriveRevenueCatEventDecision,
  type RevenueCatEventDecision,
  type RevenueCatExistingState
} from "../convex/lib/revenueCatEvents";

const NOW = 1_800_000_000_000;
const EVENT_AT = 1_900_000_000_000;
const FUTURE = 2_000_000_000_000;

/** Los dos valores que pasaban el filtro viejo y no son fechas. */
const CORRUPTOS = [0, -1] as const;

/** Fila Pro VIGENTE: lo que estos eventos podían cortar. */
const VIGENTE: RevenueCatExistingState = {
  entitlement: "orbita_pro",
  status: "active",
  plan: "monthly",
  productId: "orbita_monthly",
  currentPeriodEnd: FUTURE,
  isLifetime: false,
  willRenew: true
};

const evento = (over: Record<string, unknown>) => ({
  id: "rc_periodo",
  app_user_id: "user_current",
  event_timestamp_ms: EVENT_AT,
  environment: "SANDBOX",
  entitlement_ids: ["orbita_pro"],
  product_id: "orbita_monthly",
  ...over
});

/** El fin de período que un patch escribiría, si escribe alguno. */
const finDelPatch = (decision: RevenueCatEventDecision): number | undefined =>
  decision.kind === "apply" ? decision.patch.currentPeriodEnd : undefined;

/**
 * Aplica el patch como lo aplica el webhook: con `omitUndefined`.
 *
 * Es la diferencia entre "no toco este campo" y "lo pongo en `undefined`". Un
 * spread crudo haría lo segundo, que no es lo que ocurre en producción.
 */
const aplicar = (base: RevenueCatExistingState, decision: RevenueCatEventDecision): SubscriptionRow =>
  ({
    ...base,
    ...(decision.kind === "apply"
      ? Object.fromEntries(Object.entries(decision.patch).filter(([, valor]) => valor !== undefined))
      : {}),
    provider: "revenuecat",
    environment: "production"
  }) as SubscriptionRow;

const CTX_ABIERTO = { sandboxAllowed: true, productionAllowed: true };

/**
 * Tipos que sólo pueden aplicar con un fin de período demostrable.
 *
 * `expiration_at_ms` es su única fuente (o su fuente principal); sin ella no
 * hay nada que conceder ni que extender.
 */
const EXIGEN_FIN = [
  { type: "RENEWAL", campo: "expiration_at_ms" },
  { type: "INITIAL_PURCHASE", campo: "expiration_at_ms" },
  { type: "UNCANCELLATION", campo: "expiration_at_ms" },
  { type: "SUBSCRIPTION_EXTENDED", campo: "expiration_at_ms" },
  { type: "TEMPORARY_ENTITLEMENT_GRANT", campo: "expiration_at_ms" },
  { type: "PRODUCT_CHANGE", campo: "expiration_at_ms" },
  { type: "CANCELLATION", campo: "expiration_at_ms" },
  { type: "REFUND_REVERSED", campo: "expiration_at_ms" },
  { type: "BILLING_ISSUE", campo: "grace_period_expiration_at_ms" }
] as const;

describe("P1 — un fin de período 0 o negativo nunca se persiste", () => {
  it("REPRO: ningún tipo escribe un `currentPeriodEnd` no positivo", () => {
    // Sin fila previa el fallback no existe, así que se ve el efecto del campo
    // del evento aislado. Con fila previa se ve en el test siguiente.
    for (const { type, campo } of EXIGEN_FIN) {
      for (const corrupto of CORRUPTOS) {
        const decision = deriveRevenueCatEventDecision(
          evento({ type, [campo]: corrupto }),
          // `PRODUCT_CHANGE`, `UNCANCELLATION`, `CANCELLATION`, `BILLING_ISSUE`
          // y `SUBSCRIPTION_EXTENDED` exigen fila previa para llegar al punto
          // donde se leía la fecha. Se les da una SIN período demostrable.
          { ...VIGENTE, currentPeriodEnd: undefined }
        );
        const etiqueta = `${type} ${campo}=${corrupto}`;
        assert.equal(decision.kind, "ignore", etiqueta);
        assert.equal(finDelPatch(decision), undefined, etiqueta);
      }
    }
  });

  it("y con una fila vigente tampoco: o conserva la fecha buena, o no aplica", () => {
    for (const { type, campo } of EXIGEN_FIN) {
      for (const corrupto of CORRUPTOS) {
        const decision = deriveRevenueCatEventDecision(
          evento({ type, [campo]: corrupto }),
          VIGENTE
        );
        const fin = finDelPatch(decision);
        const etiqueta = `${type} ${campo}=${corrupto}`;
        // Lo único inaceptable es escribir la fecha corrupta.
        assert.ok(fin === undefined || fin > 0, `${etiqueta} escribió ${fin}`);
        // Y si aplica, el acceso vigente no se corta.
        if (decision.kind === "apply") {
          assert.equal(
            isRowActive(aplicar(VIGENTE, decision), NOW, CTX_ABIERTO),
            true,
            `${etiqueta} cortó un acceso pagado vigente`
          );
        }
      }
    }
  });

  it("REPRO puntual: RENEWAL con `expiration_at_ms: 0` no corta la suscripción", () => {
    const decision = deriveRevenueCatEventDecision(
      evento({ type: "RENEWAL", expiration_at_ms: 0 }),
      VIGENTE
    );
    assert.deepEqual(decision, { kind: "ignore", reason: "missing_period_end" });
  });

  it("REPRO puntual: BILLING_ISSUE con gracia 0 cae en la fecha buena de la fila", () => {
    const decision = deriveRevenueCatEventDecision(
      evento({ type: "BILLING_ISSUE", grace_period_expiration_at_ms: 0 }),
      VIGENTE
    );
    if (decision.kind !== "apply") return assert.fail("con una fila vigente sí puede aplicar");
    assert.equal(decision.patch.currentPeriodEnd, FUTURE, "usa el período positivo que ya tenía");
    assert.equal(decision.patch.status, "billing_issue");
  });

  it("un `currentPeriodEnd` corrupto en la FILA tampoco se presta como fallback", () => {
    // El fallback pasa por el mismo filtro: una fila con la fecha rota no puede
    // sostener un evento nuevo.
    for (const corrupto of CORRUPTOS) {
      const existente: RevenueCatExistingState = { ...VIGENTE, currentPeriodEnd: corrupto };
      for (const type of ["UNCANCELLATION", "BILLING_ISSUE", "CANCELLATION", "PRODUCT_CHANGE"]) {
        const decision = deriveRevenueCatEventDecision(evento({ type }), existente);
        const etiqueta = `${type} existing=${corrupto}`;
        assert.equal(decision.kind, "ignore", etiqueta);
        assert.equal(finDelPatch(decision), undefined, etiqueta);
      }
    }
  });

  it("con fechas POSITIVAS todo sigue aplicando igual", () => {
    const renovacion = deriveRevenueCatEventDecision(
      evento({ type: "RENEWAL", expiration_at_ms: FUTURE }),
      VIGENTE
    );
    assert.equal(renovacion.kind === "apply" && renovacion.patch.currentPeriodEnd, FUTURE);

    const gracia = deriveRevenueCatEventDecision(
      evento({ type: "BILLING_ISSUE", grace_period_expiration_at_ms: FUTURE }),
      VIGENTE
    );
    assert.equal(gracia.kind === "apply" && gracia.patch.currentPeriodEnd, FUTURE);

    const cambio = deriveRevenueCatEventDecision(
      evento({ type: "PRODUCT_CHANGE", new_product_id: "orbita_monthly", expiration_at_ms: FUTURE }),
      VIGENTE
    );
    assert.equal(cambio.kind === "apply" && cambio.patch.currentPeriodEnd, FUTURE);
  });
});

describe("P1 — los eventos con autoridad terminal siguen cortando, sin fecha corrupta", () => {
  it("EXPIRATION revoca por su tipo aunque su fecha sea 0 o negativa", () => {
    for (const corrupto of CORRUPTOS) {
      const decision = deriveRevenueCatEventDecision(
        evento({ type: "EXPIRATION", expiration_at_ms: corrupto }),
        VIGENTE
      );
      const etiqueta = `EXPIRATION ${corrupto}`;
      if (decision.kind !== "apply") return assert.fail(`${etiqueta} debería aplicar`);
      assert.equal(decision.patch.entitlement, "free", etiqueta);
      assert.equal(decision.patch.status, "expired", etiqueta);
      assert.equal(decision.patch.currentPeriodEnd, undefined, `${etiqueta} no escribe la fecha`);
      assert.equal(
        isRowActive(aplicar(VIGENTE, decision), NOW, CTX_ABIERTO),
        false,
        `${etiqueta} tiene que retirar el acceso igual`
      );
    }
  });

  it("el reembolso CUSTOMER_SUPPORT corta con el timestamp del evento, no con la fecha rota", () => {
    for (const corrupto of CORRUPTOS) {
      const decision = deriveRevenueCatEventDecision(
        evento({
          type: "CANCELLATION",
          cancel_reason: "CUSTOMER_SUPPORT",
          expiration_at_ms: corrupto
        }),
        VIGENTE
      );
      const etiqueta = `refund ${corrupto}`;
      if (decision.kind !== "apply") return assert.fail(`${etiqueta} debería aplicar`);
      assert.equal(decision.patch.entitlement, "free", etiqueta);
      assert.equal(
        decision.patch.currentPeriodEnd,
        EVENT_AT,
        `${etiqueta} usa el timestamp del evento, que sí es válido`
      );
      assert.equal(isRowActive(aplicar(VIGENTE, decision), NOW, CTX_ABIERTO), false, etiqueta);
    }
  });

  it("`event_timestamp_ms` conserva su semántica: no positivo sigue siendo inválido", () => {
    for (const corrupto of [0, -1, "ayer", undefined]) {
      const decision = deriveRevenueCatEventDecision(
        evento({
          type: "CANCELLATION",
          cancel_reason: "CUSTOMER_SUPPORT",
          event_timestamp_ms: corrupto,
          expiration_at_ms: 0
        }),
        VIGENTE
      );
      if (decision.kind !== "apply") return assert.fail("el reembolso aplica por su tipo");
      assert.equal(
        decision.patch.currentPeriodEnd,
        undefined,
        `event_timestamp_ms=${String(corrupto)} no puede escribir un período`
      );
    }
  });
});
