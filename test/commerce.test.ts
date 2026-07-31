import assert from "node:assert/strict";
import test from "node:test";
import { requireStripeCheckoutDisplayName } from "../convex/lib/commerce";

test("Stripe Checkout display name is required and normalized server-side", () => {
  const previous = process.env.STRIPE_CHECKOUT_DISPLAY_NAME;
  try {
    delete process.env.STRIPE_CHECKOUT_DISPLAY_NAME;
    assert.throws(
      () => requireStripeCheckoutDisplayName(),
      /STRIPE_CHECKOUT_DISPLAY_NAME not configured/
    );

    process.env.STRIPE_CHECKOUT_DISPLAY_NAME = "  Órbita  ";
    assert.equal(requireStripeCheckoutDisplayName(), "Órbita");

    process.env.STRIPE_CHECKOUT_DISPLAY_NAME = "Otra marca";
    assert.equal(requireStripeCheckoutDisplayName(), "Otra marca");
  } finally {
    if (previous === undefined) {
      delete process.env.STRIPE_CHECKOUT_DISPLAY_NAME;
    } else {
      process.env.STRIPE_CHECKOUT_DISPLAY_NAME = previous;
    }
  }
});
