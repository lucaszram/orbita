import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStripeCheckoutForm,
  buildStripeCustomerForm,
  buildStripePortalForm,
  createStripeApi,
  encodeStripeForm,
  requireStripeString
} from "../convex/lib/stripeApi";

test("Stripe form encoding preserves nested Stripe keys and omits absent values", () => {
  const encoded = encodeStripeForm({
    mode: "subscription",
    "line_items[0][price]": "price_yearly",
    "line_items[0][quantity]": 1,
    "metadata[clerkUserId]": "user_123",
    omitted: undefined,
    empty: null
  });
  const form = new URLSearchParams(encoded);

  assert.equal(form.get("mode"), "subscription");
  assert.equal(form.get("line_items[0][price]"), "price_yearly");
  assert.equal(form.get("line_items[0][quantity]"), "1");
  assert.equal(form.get("metadata[clerkUserId]"), "user_123");
  assert.equal(form.has("omitted"), false);
  assert.equal(form.has("empty"), false);
});

test("Stripe REST client posts form data with bearer auth", async () => {
  const calls: Array<{ input: string; init: RequestInit }> = [];
  const client = createStripeApi("sk_test_secret", async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ id: "cus_123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });

  const result = await client.post<{ id: string }>("customers", {
    email: "persona@example.com",
    "metadata[clerkUserId]": "user_123"
  });

  assert.equal(result.id, "cus_123");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, "https://api.stripe.com/v1/customers");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(calls[0].init.headers, {
    Authorization: "Bearer sk_test_secret",
    "Content-Type": "application/x-www-form-urlencoded"
  });
  const body = new URLSearchParams(String(calls[0].init.body));
  assert.equal(body.get("email"), "persona@example.com");
  assert.equal(body.get("metadata[clerkUserId]"), "user_123");
});

test("Stripe customer, checkout and portal forms preserve the existing contract", () => {
  assert.deepEqual(buildStripeCustomerForm({ clerkUserId: "user_123" }), {
    email: undefined,
    "metadata[clerkUserId]": "user_123"
  });

  const subscription = buildStripeCheckoutForm({
    plan: "yearly",
    customerId: "cus_123",
    priceId: "price_yearly",
    clerkUserId: "user_123",
    webUrl: "https://orbita.example"
  });
  assert.equal(subscription.mode, "subscription");
  assert.equal(subscription["subscription_data[metadata][plan]"], "yearly");
  assert.equal(subscription["payment_intent_data[metadata][plan]"], undefined);
  assert.equal(subscription.success_url, "https://orbita.example/checkout/success?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(subscription.cancel_url, "https://orbita.example/paywall");

  const lifetime = buildStripeCheckoutForm({
    plan: "lifetime",
    customerId: "cus_123",
    priceId: "price_lifetime",
    clerkUserId: "user_123",
    webUrl: "https://orbita.example"
  });
  assert.equal(lifetime.mode, "payment");
  assert.equal(lifetime["payment_intent_data[metadata][plan]"], "lifetime");
  assert.equal(lifetime["subscription_data[metadata][plan]"], undefined);

  assert.deepEqual(buildStripePortalForm({ customerId: "cus_123", webUrl: "https://orbita.example" }), {
    customer: "cus_123",
    return_url: "https://orbita.example/profile"
  });
});

test("Stripe REST client surfaces API errors without exposing the secret", async () => {
  const client = createStripeApi("sk_test_do_not_leak", async () =>
    new Response(JSON.stringify({ error: { message: "No such price" } }), {
      status: 400,
      statusText: "Bad Request",
      headers: { "Content-Type": "application/json" }
    })
  );

  await assert.rejects(
    () => client.post("/checkout/sessions", { mode: "subscription" }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Stripe API error \(400\): No such price/);
      assert.doesNotMatch(error.message, /sk_test_do_not_leak/);
      return true;
    }
  );
});

test("Stripe REST client normalizes network and invalid response failures", async () => {
  const networkClient = createStripeApi("sk_test_secret", async () => {
    throw new Error("socket includes sk_test_secret");
  });
  await assert.rejects(() => networkClient.post("/customers", {}), /Stripe API request failed/);

  const invalidClient = createStripeApi("sk_test_secret", async () =>
    new Response("not-json", { status: 200, headers: { "Content-Type": "text/plain" } })
  );
  await assert.rejects(() => invalidClient.post("/customers", {}), /invalid response/);
});

test("Stripe response fields are required explicitly", () => {
  assert.equal(requireStripeString({ id: "cus_123" }, "id"), "cus_123");
  assert.throws(() => requireStripeString({ url: null }, "url"), /missing url/);
  assert.throws(() => requireStripeString(null, "id"), /invalid response/);
});
