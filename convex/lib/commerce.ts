export type CommerceMode = "off" | "test" | "live";

export function commerceMode(): CommerceMode {
  const configured = process.env.COMMERCE_MODE?.trim().toLowerCase() || "off";
  if (configured !== "off" && configured !== "test" && configured !== "live") {
    throw new Error("COMMERCE_MODE must be off, test, or live");
  }
  return configured;
}

export function checkoutEnabled(mode = commerceMode()): boolean {
  return mode !== "off";
}

export function requireStripeSecret(mode = commerceMode()): string {
  if (!checkoutEnabled(mode)) {
    throw new Error("Checkout is not available");
  }

  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) throw new Error("STRIPE_SECRET_KEY not configured");

  const expectedPrefix = mode === "live" ? "sk_live_" : "sk_test_";
  if (!secret.startsWith(expectedPrefix)) {
    throw new Error(`Stripe credentials do not match COMMERCE_MODE=${mode}`);
  }
  return secret;
}

export function requireWebAppUrl(mode = commerceMode()): string {
  const configured = process.env.WEB_APP_URL?.trim();
  if (!configured) throw new Error("WEB_APP_URL not configured");

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("WEB_APP_URL is invalid");
  }

  if (mode === "live" && url.protocol !== "https:") {
    throw new Error("WEB_APP_URL must use HTTPS in live commerce mode");
  }
  if (mode === "live" && url.hostname !== "orbitaastrologia.xyz") {
    throw new Error("Live checkout is restricted to orbitaastrologia.xyz");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("WEB_APP_URL must be an origin without credentials, query, or fragment");
  }

  return url.toString().replace(/\/$/, "");
}

export function automaticTaxEnabled(): boolean {
  return process.env.STRIPE_AUTOMATIC_TAX === "true";
}

export function requireStripeCheckoutDisplayName(): string {
  const displayName = process.env.STRIPE_CHECKOUT_DISPLAY_NAME?.trim();
  if (!displayName) {
    throw new Error("STRIPE_CHECKOUT_DISPLAY_NAME not configured");
  }
  return displayName;
}
