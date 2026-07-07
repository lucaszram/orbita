import { httpRouter } from "convex/server";
import { revenuecatWebhook } from "./payments/revenuecat";
import { stripeWebhook } from "./payments/stripeHttp";

// Webhooks de pago. Dominio: https://<deployment>.convex.site
const http = httpRouter();

http.route({
  path: "/webhooks/revenuecat",
  method: "POST",
  handler: revenuecatWebhook
});

http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: stripeWebhook
});

export default http;
