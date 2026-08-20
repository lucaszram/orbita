/**
 * Lectura autoritativa del estado de la tienda — REST v1 de RevenueCat.
 *
 * ## Por qué existe
 *
 * El webhook es best-effort. RevenueCat reintenta una cantidad acotada y
 * después abandona. Si el `INITIAL_PURCHASE` se pierde —una caída del backend,
 * una ventana de red, la carrera entre Clerk y Convex agotando los reintentos—
 * Apple ya cobró y Convex se queda en Free **para siempre**: no hay ningún
 * evento posterior que repare ese estado. La recomendación oficial de
 * RevenueCat es cerrar el hueco leyendo
 * `GET /v1/subscribers/{app_user_id}` después de cualquier evento.
 *
 * ## Qué NO hace este módulo
 *
 * No hace red ni toca la base: sólo arma la URL e INTERPRETA una respuesta ya
 * recibida. Así las reglas que deciden acceso —cuándo conceder, cuándo retirar
 * y cuándo no tocar nada— se prueban sin fixtures de red ni credenciales.
 *
 * ## Las cuatro reglas que gobiernan todo
 *
 * 1. Una respuesta que no se entiende **no concede ni revoca**. Un 5xx, un 429,
 *    una credencial mal configurada o un cuerpo con otra forma dejan el acceso
 *    exactamente como estaba.
 * 2. Un snapshot vale para **una** cuenta: la que se preguntó, por id exacto.
 * 3. Conceder exige el entitlement canónico **y** el entorno demostrado. El
 *    nombre del producto no autoriza nada.
 * 4. Revocar tiene un alcance explícito (`revocation`) y **nunca** toca un
 *    acceso permanente: la ausencia en una lectura no es un reembolso.
 *
 * ## Lo que este módulo NO infiere (y por qué)
 *
 * La documentación oficial de la v1 describe cada entrada de
 * `non_subscriptions` con `id`, `is_sandbox`, `purchase_date` y `store`. No
 * documenta un `refunded_at` ahí — ese campo vive en `subscriptions`. La
 * versión anterior de este archivo construía "evidencia de reembolso" leyendo
 * `refunded_at`/`refunded_at_ms` de `non_subscriptions`: campos inventados. Una
 * respuesta real nunca los trae, así que la evidencia siempre daba vacío; y si
 * alguna vez llegaran, se estaría apagando un acceso pago desde un campo que el
 * proveedor no promete. Se eliminó entera. El reembolso de un permanente sólo
 * puede llegar por webhook, del mismo producto y con autorización explícita.
 */
import {
  PRO_ENTITLEMENT,
  type ProviderEnvironment,
  type SubscriptionPlan,
  type SubscriptionStatus
} from "./entitlements";
import { isRevenueCatLifetimeProduct, type RevenueCatSubscriptionPatch } from "./revenueCatEvents";

export const REVENUECAT_SUBSCRIBERS_ENDPOINT = "https://api.revenuecat.com/v1/subscribers";

export function revenueCatSubscriberUrl(appUserId: string): string {
  return `${REVENUECAT_SUBSCRIBERS_ENDPOINT}/${encodeURIComponent(appUserId)}`;
}

/**
 * Qué filas de RevenueCat puede apagar esta lectura.
 *
 * - `none`        → no se puede demostrar qué apagar: no se apaga nada.
 * - `environment` → la respuesta demuestra el entorno: sólo esa fila.
 * - `global`      → el cuerpo COMPLETO demuestra que la cuenta no tiene el
 *                   entitlement canónico en ningún entorno: todas las filas de
 *                   RevenueCat. Nunca toca Stripe, que no está en esta lectura,
 *                   ni una fila permanente, que sólo cae por reembolso.
 */
export type RevenueCatRevocationScope =
  | { kind: "none" }
  | { kind: "environment"; environment: ProviderEnvironment }
  | { kind: "global" };

export type RevenueCatReconcileOutcome =
  /** No se pudo saber. El acceso queda intacto. */
  | { kind: "unavailable"; reason: string }
  /** La tienda contestó y su respuesta es la verdad vigente. */
  | {
      kind: "resolved";
      patch: RevenueCatSubscriptionPatch;
      observedAt: number;
      environment?: ProviderEnvironment;
      productId?: string;
      /**
       * `original_app_user_id` del snapshot, ya validado por id EXACTO contra
       * la cuenta consultada. Viaja para que el proyector lo vuelva a comprobar.
       */
      subscriberId?: string;
      /** Alcance de apagado. Sólo tiene sentido para un patch Free. */
      revocation: RevenueCatRevocationScope;
    };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** ISO válido → ms. Cualquier otra cosa → `undefined`. */
function parseIso(value: unknown): number | undefined {
  const iso = text(value);
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Fecha de un campo `X` / `X_ms` de la v1, exigiendo COHERENCIA.
 *
 * Si las dos variantes vienen, las dos tienen que ser legibles y describir el
 * mismo instante. Antes se prefería `_ms` y, si no se entendía, se caía al ISO:
 * un `expires_date: null` con `expires_date_ms: "corrupt"` terminaba leyéndose
 * como "sin vencimiento" y concedía acceso permanente desde un campo roto.
 */
type FieldDate =
  /** Ninguna variante está declarada. */
  | { kind: "absent" }
  /** Declarado y explícitamente sin valor (`null`) en todas sus variantes. */
  | { kind: "null" }
  | { kind: "at"; value: number }
  /** Presente pero ilegible, o las dos variantes se contradicen. */
  | { kind: "invalid" };

/** Tolerancia entre el ISO (precisión de segundo) y su gemelo en ms. */
const DATE_COHERENCE_MS = 1000;

function coherentFieldDate(source: Record<string, unknown>, base: string): FieldDate {
  const isoKey = base;
  const msKey = `${base}_ms`;
  const hasIso = isoKey in source;
  const hasMs = msKey in source;
  if (!hasIso && !hasMs) return { kind: "absent" };

  const votes: Array<{ kind: "null" } | { kind: "at"; value: number }> = [];

  if (hasMs) {
    const raw = source[msKey];
    if (raw === null) votes.push({ kind: "null" });
    else {
      const ms = finite(raw);
      if (ms === undefined) return { kind: "invalid" };
      votes.push({ kind: "at", value: ms });
    }
  }
  if (hasIso) {
    const raw = source[isoKey];
    if (raw === null) votes.push({ kind: "null" });
    else {
      const iso = parseIso(raw);
      if (iso === undefined) return { kind: "invalid" };
      votes.push({ kind: "at", value: iso });
    }
  }

  if (votes.length === 0) return { kind: "invalid" };
  if (votes.length === 1) return votes[0];

  const [primero, segundo] = votes;
  if (primero.kind !== segundo.kind) return { kind: "invalid" };
  if (primero.kind === "null") return { kind: "null" };
  const distancia = Math.abs(
    primero.value - (segundo as { kind: "at"; value: number }).value
  );
  return distancia <= DATE_COHERENCE_MS ? primero : { kind: "invalid" };
}

/**
 * Campo de lifecycle OPCIONAL: puede faltar, pero si está tiene que valer.
 *
 * `undefined` = ausente o explícitamente `null` (las dos formas normales).
 * `"invalid"` = está declarado y no se entiende.
 *
 * La versión anterior colapsaba las dos cosas en `undefined`, así que un
 * `unsubscribe_detected_at_ms: "ayer"` se leía como "no hay baja" y la lectura
 * concedía `status: "active"` con `willRenew: true`. Un payload corrupto no
 * puede convertirse en la afirmación más optimista posible.
 */
function optionalLifecycleDate(
  source: Record<string, unknown>,
  base: string
): number | undefined | "invalid" {
  const fecha = coherentFieldDate(source, base);
  if (fecha.kind === "invalid") return "invalid";
  if (fecha.kind !== "at") return undefined;
  // Un `0` es finito y "legible", pero no es una fecha: la época Unix no marca
  // una baja ni un problema de cobro. Colapsarlo en "ausente" hacía que un
  // campo presente y sin sentido produjera la afirmación más optimista posible
  // (`status: "active"`, `willRenew: true`). Lo mismo un negativo.
  return fecha.value > 0 ? fecha.value : "invalid";
}

/**
 * El producto NOMBRA el plan. No autoriza nada, y NUNCA nombra un permanente.
 *
 * `lifetime` no está en esta tabla a propósito: un acceso permanente sólo puede
 * salir de la allowlist explícita de productos, jamás de una convención de
 * nombres (`orbita_lifetime_trial` la cumple y no es un lifetime).
 */
function planFromProductId(productId?: string): SubscriptionPlan | undefined {
  if (!productId) return undefined;
  const normalized = productId.toLowerCase();
  if (normalized.includes("year") || normalized.includes("annual")) return "yearly";
  if (normalized.includes("month")) return "monthly";
  if (normalized.includes("week")) return "weekly";
  return undefined;
}

const FREE_PATCH: RevenueCatSubscriptionPatch = {
  entitlement: "free",
  status: "expired",
  isLifetime: false,
  willRenew: false
};

function sandboxFlag(source: Record<string, unknown> | null): ProviderEnvironment | undefined {
  if (source && typeof source.is_sandbox === "boolean") {
    return source.is_sandbox ? "sandbox" : "production";
  }
  return undefined;
}

/**
 * Forma ESTRICTA de una transacción de `non_subscriptions`, tal como la
 * documenta la v1: `id`, `is_sandbox`, `purchase_date`, `store`.
 *
 * `null` = no se entiende. Una transacción parcial no puede sostener una
 * concesión permanente, y una lista con aunque sea una entrada ilegible vuelve
 * ambiguo al producto entero.
 */
function strictStoreTransaction(entry: unknown): { environment: ProviderEnvironment } | null {
  const transaction = record(entry);
  if (!transaction) return null;
  if (!text(transaction.id)) return null;
  if (!text(transaction.store)) return null;
  const environment = sandboxFlag(transaction);
  if (!environment) return null;
  const purchasedAt = coherentFieldDate(transaction, "purchase_date");
  if (purchasedAt.kind !== "at" || purchasedAt.value <= 0) return null;
  return { environment };
}

/** `non_subscriptions[producto]` puede venir como lista o como objeto suelto. */
function transactionsFor(nonSubscriptions: Record<string, unknown>, productId: string): unknown[] {
  const entries = nonSubscriptions[productId];
  if (entries === undefined || entries === null) return [];
  return Array.isArray(entries) ? entries : [entries];
}

/** Free con el alcance que la respuesta puede demostrar. */
function freeOutcome(input: {
  observedAt: number;
  environment: ProviderEnvironment | undefined;
  productId: string | undefined;
  subscriberId: string;
  /** `true` sólo cuando el cuerpo demuestra ausencia en TODOS los entornos. */
  global: boolean;
}): RevenueCatReconcileOutcome {
  return {
    kind: "resolved",
    patch: { ...FREE_PATCH },
    observedAt: input.observedAt,
    environment: input.environment,
    productId: input.productId,
    subscriberId: input.subscriberId,
    revocation: input.global
      ? { kind: "global" }
      : input.environment
        ? { kind: "environment", environment: input.environment }
        : { kind: "none" }
  };
}

const RC_ANONYMOUS_PREFIX = "$RCAnonymousID:";

/**
 * ¿Este snapshot habla de la cuenta que preguntamos?
 *
 * ## El agujero
 *
 * `GET /v1/subscribers/{B}` devuelve el `CustomerInfo` del **alias chain**, no
 * el de B a secas. Si A y B quedaron aliased, la respuesta de B trae
 * `subscriber.original_app_user_id: A` y describe la compra de A. Al ignorar
 * ese campo, el mismo pago se proyectaba a las dos cuentas.
 *
 * ## La regla, sin excepciones
 *
 * **Sólo el Clerk id exacto que se consultó es autoritativo.**
 *
 * La versión anterior aceptaba un `original_app_user_id` anónimo
 * (`$RCAnonymousID:…`) razonando que "un id del SDK no puede ser otra cuenta de
 * Clerk". Eso es cierto y aun así no alcanza: el mismo id anónimo puede estar
 * aliased a DOS cuentas de Clerk, y entonces la misma compra anónima se
 * proyecta a las dos. Además el cliente de esta app es **custom-ID-only**: se
 * configura con el Clerk id ya conocido y nunca usa `logOut` ni el modo
 * anónimo, así que un original anónimo no describe ningún camino que esta app
 * pueda producir. No es autoridad para nadie.
 */
export type RevenueCatIdentityCheck =
  | { ok: true; subscriberId: string }
  | { ok: false; reason: string };

export function checkRevenueCatSubscriberIdentity(
  original: unknown,
  expectedAppUserId: string | undefined
): RevenueCatIdentityCheck {
  const subscriberId = text(original);
  if (!subscriberId) return { ok: false, reason: "invalid_subscriber_identity" };
  if (!expectedAppUserId) return { ok: false, reason: "unverified_subscriber_identity" };
  if (subscriberId === expectedAppUserId) return { ok: true, subscriberId };
  if (subscriberId.startsWith(RC_ANONYMOUS_PREFIX)) {
    return { ok: false, reason: "anonymous_subscriber_identity" };
  }
  return { ok: false, reason: "subscriber_identity_mismatch" };
}

/**
 * Traduce una respuesta HTTP de `/v1/subscribers/{id}` a una decisión de acceso.
 *
 * `status` es el código HTTP y `body` el JSON ya parseado (o lo que haya).
 *
 * El endpoint es **GET-or-create**: crea el subscriber si no existía, así que
 * contesta 200 o 201 y NUNCA 404 para una cuenta legítima. Un 404 significa que
 * algo está mal —ruta, proyecto, credencial— y por eso no se lee como "esta
 * persona no compró nada": eso revocaría el acceso de alguien que sí pagó.
 */
export function interpretRevenueCatSubscriber(
  status: number,
  body: unknown,
  options: { expectedAppUserId?: string; env?: Record<string, string | undefined> } = {}
): RevenueCatReconcileOutcome {
  if (status !== 200 && status !== 201) return { kind: "unavailable", reason: `http_${status}` };

  const envelope = record(body);
  const subscriber = envelope && record(envelope.subscriber);
  const entitlements = subscriber && record(subscriber.entitlements);
  const subscriptions = subscriber && record(subscriber.subscriptions);
  const nonSubscriptions = subscriber && record(subscriber.non_subscriptions);
  const observedAt = envelope ? finite(envelope.request_date_ms) : undefined;

  // Shape PROFUNDA. Un sobre a medias no puede sostener ni un "sí" ni un "no":
  // afirmar Free desde un cuerpo que no se entiende retira acceso pagado.
  if (!envelope || !subscriber || !entitlements || !subscriptions || !nonSubscriptions) {
    return { kind: "unavailable", reason: "invalid_shape" };
  }
  if (observedAt === undefined || observedAt <= 0) {
    return { kind: "unavailable", reason: "invalid_request_date" };
  }

  // IDENTIDAD PRIMERO. Antes de interpretar una sola regla de acceso hay que
  // saber DE QUIÉN es este snapshot.
  const identity = checkRevenueCatSubscriberIdentity(
    subscriber.original_app_user_id,
    options.expectedAppUserId
  );
  if (!identity.ok) return { kind: "unavailable", reason: identity.reason };
  const subscriberId = identity.subscriberId;

  const proRaw = entitlements[PRO_ENTITLEMENT];
  if (proRaw === undefined) {
    // El entitlement canónico está AUSENTE en un cuerpo completo: la tienda
    // afirma que esta cuenta no tiene Órbita Plus en ningún entorno. Éste es el
    // ÚNICO alcance global — y aun así no toca un acceso permanente, que sólo
    // puede caer por un reembolso demostrado (ver `projectRevenueCatSubscriber`).
    return freeOutcome({
      observedAt,
      environment: undefined,
      productId: undefined,
      subscriberId,
      global: true
    });
  }
  // Presente pero ilegible (por ejemplo `null`) = no se entiende, no se decide.
  const pro = record(proRaw);
  if (!pro) return { kind: "unavailable", reason: "invalid_entitlement" };

  const productId = text(pro.product_identifier);
  // Un entitlement que no dice qué producto lo sostiene no se entiende.
  if (!productId) return { kind: "unavailable", reason: "invalid_entitlement_product" };

  const expiry = coherentFieldDate(pro, "expires_date");
  // Ausente o contradictorio: el cuerpo no se entiende. No se concede ni se
  // revoca. Acá cae el `expires_date: null` + `expires_date_ms: "corrupt"`, que
  // antes se leía como "sin vencimiento" y concedía acceso permanente.
  if (expiry.kind === "absent" || expiry.kind === "invalid") {
    return { kind: "unavailable", reason: "invalid_expiration" };
  }

  // ---------------------------------------------------------------------
  // Camino permanente — sólo con producto ALLOWLISTED y evidencia inequívoca
  // ---------------------------------------------------------------------
  if (expiry.kind === "null") {
    // El catálogo de lanzamiento (V1) es exclusivamente MENSUAL. Sin una
    // declaración explícita de producto permanente no hay nada que conceder, y
    // el `expires_date: null` de un producto que no está declarado es un cuerpo
    // que este backend no sabe interpretar.
    if (!isRevenueCatLifetimeProduct(productId, options.env)) {
      return { kind: "unavailable", reason: "lifetime_product_not_allowlisted" };
    }

    const entradas = transactionsFor(nonSubscriptions, productId);
    const analizadas = entradas.map(strictStoreTransaction);
    // Exactamente UNA transacción, estricta, y en un único entorno. Dos
    // entornos, una entrada ilegible o ninguna transacción son ambigüedad:
    // no se concede ni se retira nada.
    if (analizadas.length !== 1 || analizadas[0] === null) {
      return { kind: "unavailable", reason: "lifetime_without_purchase_evidence" };
    }

    return {
      kind: "resolved",
      observedAt,
      environment: analizadas[0]!.environment,
      productId,
      subscriberId,
      revocation: { kind: "none" },
      patch: {
        entitlement: PRO_ENTITLEMENT,
        status: "active",
        plan: "lifetime",
        productId,
        isLifetime: true,
        willRenew: false
      }
    };
  }

  // ---------------------------------------------------------------------
  // Camino suscripción — el catálogo V1 vigente
  // ---------------------------------------------------------------------
  const subscription = record(subscriptions[productId]);
  const environment = sandboxFlag(subscription);
  const expiresAt = expiry.value;

  // Sin el recibo que describe al entitlement no se sabe de qué tienda vino.
  // Conceder sin eso es imposible (`isRowActive` falla cerrado) y revocar sin
  // eso apagaría filas de un entorno que esta respuesta no describe. En los dos
  // sentidos es un snapshot inconsistente, y se reintenta.
  if (!environment) {
    return {
      kind: "unavailable",
      reason: expiresAt <= observedAt ? "expired_without_environment" : "active_without_environment"
    };
  }

  if (expiresAt <= observedAt) {
    return freeOutcome({ observedAt, environment, productId, subscriberId, global: false });
  }

  // Los dos campos que deciden `status` y `willRenew`. Pueden faltar, pero si
  // están declarados y no se entienden, el cuerpo no alcanza para afirmar nada:
  // ni que renueva ni que se dio de baja.
  const unsubscribedAt = subscription
    ? optionalLifecycleDate(subscription, "unsubscribe_detected_at")
    : undefined;
  const billingIssueAt = subscription
    ? optionalLifecycleDate(subscription, "billing_issues_detected_at")
    : undefined;
  if (unsubscribedAt === "invalid" || billingIssueAt === "invalid") {
    return { kind: "unavailable", reason: "invalid_subscription_lifecycle" };
  }
  const isTrial = subscription?.period_type === "trial";

  const resolvedStatus: SubscriptionStatus = unsubscribedAt
    ? "canceled"
    : billingIssueAt
      ? "billing_issue"
      : isTrial
        ? "trialing"
        : "active";

  return {
    kind: "resolved",
    observedAt,
    environment,
    productId,
    subscriberId,
    revocation: { kind: "none" },
    patch: {
      entitlement: PRO_ENTITLEMENT,
      status: resolvedStatus,
      plan: planFromProductId(productId),
      productId,
      currentPeriodEnd: expiresAt,
      isLifetime: false,
      willRenew: !unsubscribedAt
    }
  };
}

/**
 * Resumen auditable de una reconciliación. Deliberadamente NO incluye el
 * cuerpo recibido, aliases, atributos del suscriptor ni la credencial.
 *
 * Un `unavailable` también se audita: un `subscriber_identity_mismatch` es
 * justo lo que hay que poder ver después, y sin esta fila no dejaba rastro.
 */
export function summarizeReconciliation(
  outcome: RevenueCatReconcileOutcome,
  trigger: string
): Record<string, unknown> {
  // Defensivo a propósito: esta función también corre sobre lo que llega por un
  // `runMutation` interno, y un outcome con una forma que el validador no vio
  // no puede convertirse en un TypeError que tumbe la proyección entera. Lo que
  // no se entiende se resume como `invalid` y no dice nada sobre el acceso.
  const kind = (outcome as { kind?: unknown } | null | undefined)?.kind;
  const base: Record<string, unknown> = { source: "rest_reconcile", trigger };

  if (kind === "unavailable") {
    return { ...base, kind, reason: text((outcome as { reason?: unknown }).reason) ?? "unknown" };
  }
  if (kind !== "resolved") return { ...base, kind: "invalid" };

  const resuelto = outcome as Extract<RevenueCatReconcileOutcome, { kind: "resolved" }>;
  const patch = record(resuelto.patch) ?? {};
  return {
    ...base,
    kind,
    entitlement: patch.entitlement,
    status: patch.status,
    isLifetime: patch.isLifetime,
    currentPeriodEnd: patch.currentPeriodEnd,
    environment: resuelto.environment,
    // El alcance del apagado es parte de la auditoría: sin él no se puede
    // reconstruir por qué una fila productiva quedó en Free.
    revocation: resuelto.revocation?.kind,
    revocationEnvironment:
      resuelto.revocation?.kind === "environment" ? resuelto.revocation.environment : undefined,
    observedAt: resuelto.observedAt
  };
}
