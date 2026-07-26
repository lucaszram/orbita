// Eventos de producto v1 — contrato en docs/handoff-claude-product-events.md.
// Lógica pura y testeable: ids opacos, cola idempotente (reintento del MISMO
// payload/eventId) y reglas de sesión. El lado React (AppState, AsyncStorage,
// mutation) vive en src/hooks/useProductTelemetry.tsx.

export type ProductEventName =
  | "app_opened"
  | "onboarding_started"
  | "onboarding_step_viewed"
  | "natal_chart_viewed"
  | "daily_guide_viewed"
  | "paywall_viewed"
  | "checkout_started";

export type ProductEventPlatform = "ios" | "android" | "web" | "unknown";

/** Args exactos de `telemetry.track` (mutation idempotente por `eventId`). */
export type ProductEventPayload = {
  eventId: string;
  eventName: ProductEventName;
  installationId: string;
  sessionId?: string;
  occurredAt?: number;
  platform?: ProductEventPlatform;
  appVersion?: string;
  buildNumber?: string;
  onboardingStep?: number;
  entryPoint?: string;
};

const EVENT_NAMES: ReadonlySet<string> = new Set([
  "app_opened",
  "onboarding_started",
  "onboarding_step_viewed",
  "natal_chart_viewed",
  "daily_guide_viewed",
  "paywall_viewed",
  "checkout_started"
]);

/** Ids opacos aceptados por el backend: 8–160 chars de `A-Za-z0-9._:-`. */
export const OPAQUE_ID_PATTERN = /^[A-Za-z0-9._:-]{8,160}$/;

export function isOpaqueId(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_ID_PATTERN.test(value);
}

/**
 * Id con forma de UUID v4 sobre Math.random. Alcanza de sobra para
 * idempotencia de analytics (no es material criptográfico) y evita sumar
 * expo-crypto: una dependencia nativa nueva obliga a rebuild de Pods.
 * RNG inyectable para tests determinísticos.
 */
export function createOpaqueId(random: () => number = Math.random): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += "-";
    } else if (i === 14) {
      out += "4";
    } else {
      const r = Math.floor(random() * 16) & 15;
      out += hex[i === 19 ? (r & 3) | 8 : r];
    }
  }
  return out;
}

/** Eventos que el cliente manda a lo sumo UNA vez por sesión/foreground. */
export const SESSION_ONCE_EVENTS: ReadonlySet<ProductEventName> = new Set<ProductEventName>([
  "app_opened",
  "natal_chart_viewed",
  "daily_guide_viewed"
]);

/**
 * Solo background → active es un regreso real. `inactive` en iOS es
 * transitorio (app switcher, centro de notificaciones) y NO abre sesión nueva.
 */
export function isForegroundReturn(prev: string | null | undefined, next: string): boolean {
  return prev === "background" && next === "active";
}

export function normalizePlatform(os: string): ProductEventPlatform {
  return os === "ios" || os === "android" || os === "web" ? os : "unknown";
}

/** Cola chica: si algo la rebalsa (semanas sin red), cae lo más viejo. */
export const PRODUCT_EVENT_QUEUE_LIMIT = 30;

/** El backend acepta hasta 7 días de demora; más viejo se descarta al hidratar. */
export const PRODUCT_EVENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Suma sin duplicar `eventId` (el reintento reutiliza el payload ya encolado). */
export function enqueueProductEvent(
  queue: ProductEventPayload[],
  event: ProductEventPayload,
  limit: number = PRODUCT_EVENT_QUEUE_LIMIT
): ProductEventPayload[] {
  if (queue.some((item) => item.eventId === event.eventId)) return queue;
  const next = [...queue, event];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

export function removeProductEvent(
  queue: ProductEventPayload[],
  eventId: string
): ProductEventPayload[] {
  return queue.filter((item) => item.eventId !== eventId);
}

/**
 * Hidrata la cola persistida entre arranques. Entradas malformadas o más
 * viejas que la ventana de 7 días se descartan (el backend las rechazaría).
 */
export function parseStoredQueue(raw: string | null, now: number): ProductEventPayload[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ProductEventPayload[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    if (!isOpaqueId(e.eventId) || !isOpaqueId(e.installationId)) continue;
    if (typeof e.eventName !== "string" || !EVENT_NAMES.has(e.eventName)) continue;
    const occurredAt = typeof e.occurredAt === "number" ? e.occurredAt : undefined;
    if (occurredAt !== undefined && now - occurredAt > PRODUCT_EVENT_MAX_AGE_MS) continue;
    out.push({
      eventId: e.eventId,
      eventName: e.eventName as ProductEventName,
      installationId: e.installationId,
      ...(isOpaqueId(e.sessionId) ? { sessionId: e.sessionId } : {}),
      ...(occurredAt !== undefined ? { occurredAt } : {}),
      ...(typeof e.platform === "string" ? { platform: normalizePlatform(e.platform) } : {}),
      ...(typeof e.appVersion === "string" ? { appVersion: e.appVersion } : {}),
      ...(typeof e.buildNumber === "string" ? { buildNumber: e.buildNumber } : {}),
      ...(typeof e.onboardingStep === "number" ? { onboardingStep: e.onboardingStep } : {}),
      ...(typeof e.entryPoint === "string" ? { entryPoint: e.entryPoint } : {})
    });
  }
  return out.slice(0, PRODUCT_EVENT_QUEUE_LIMIT);
}
