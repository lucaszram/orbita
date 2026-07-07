import { httpActionGeneric as httpAction, makeFunctionReference } from "convex/server";

const dispatchRef = makeFunctionReference<"mutation">("payments/stripeInternal:dispatchStripeEvent");

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Comparación en tiempo constante.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Verifica la firma de Stripe sobre el raw body con WebCrypto (el runtime V8 de
// Convex no tiene el crypto sync que usa el SDK). Header: `t=<ts>,v1=<sig>[,v1=...]`.
async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  toleranceSeconds = 300
): Promise<boolean> {
  const parts = header.split(",").map((part) => part.split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const expected = toHex(mac);

  return signatures.some((signature) => timingSafeEqual(signature, expected));
}

// POST /webhooks/stripe — verifica la firma sobre el raw body (jamás re-serializar
// JSON) y delega el evento parseado en la mutation de dispatch.
export const stripeWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return new Response("Bad Request", { status: 400 });
  }

  const payload = await request.text();

  const valid = await verifyStripeSignature(payload, signature, secret);
  if (!valid) {
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  if (!event || typeof event.id !== "string") {
    return new Response("Bad Request", { status: 400 });
  }

  await ctx.runMutation(dispatchRef, { event });
  return new Response(null, { status: 200 });
});
