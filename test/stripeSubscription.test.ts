import assert from "node:assert/strict";
import test from "node:test";
import { stripeSubscriptionLifecycle } from "../convex/lib/stripeSubscription";

test("reconoce la cancelación programada del formato legacy de Stripe", () => {
  assert.deepEqual(
    stripeSubscriptionLifecycle({
      cancel_at_period_end: true,
      current_period_end: 1_800_000_000
    }),
    {
      cancellationScheduled: true,
      currentPeriodEnd: 1_800_000_000_000
    }
  );
});

test("reconoce cancel_at y el período por ítem de la API actual de Stripe", () => {
  assert.deepEqual(
    stripeSubscriptionLifecycle({
      cancel_at_period_end: false,
      cancel_at: 1_800_000_000,
      current_period_end: null,
      items: { data: [{ current_period_end: 1_800_000_100 }] }
    }),
    {
      cancellationScheduled: true,
      currentPeriodEnd: 1_800_000_000_000
    }
  );
});

test("toma el fin de período del ítem cuando la suscripción sigue renovando", () => {
  assert.deepEqual(
    stripeSubscriptionLifecycle({
      cancel_at_period_end: false,
      cancel_at: null,
      current_period_end: null,
      items: { data: [{ current_period_end: 1_800_000_100 }] }
    }),
    {
      cancellationScheduled: false,
      currentPeriodEnd: 1_800_000_100_000
    }
  );
});

test("usa trial_end como último fallback y descarta timestamps inválidos", () => {
  assert.deepEqual(
    stripeSubscriptionLifecycle({
      cancel_at: 0,
      current_period_end: Number.NaN,
      items: { data: [{ current_period_end: "invalid" }] },
      trial_end: 1_800_000_200
    }),
    {
      cancellationScheduled: false,
      currentPeriodEnd: 1_800_000_200_000
    }
  );
});
