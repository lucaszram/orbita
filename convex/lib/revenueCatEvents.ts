import {
  PRO_ENTITLEMENT,
  type EntitlementKey,
  type SubscriptionPlan,
  type SubscriptionStatus
} from "./entitlements";
import { resolveDeploymentEnvironment } from "./environment";

type RevenueCatEvent = Record<string, unknown>;

export type RevenueCatExistingState = {
  entitlement?: string;
  status?: SubscriptionStatus;
  plan?: SubscriptionPlan;
  productId?: string;
  currentPeriodEnd?: number;
  isLifetime?: boolean;
  willRenew?: boolean;
};

export type RevenueCatSubscriptionPatch = {
  entitlement?: EntitlementKey;
  status?: SubscriptionStatus;
  plan?: SubscriptionPlan;
  productId?: string;
  currentPeriodEnd?: number;
  isLifetime?: boolean;
  willRenew?: boolean;
};

export type RevenueCatEventDecision =
  | { kind: "transfer" }
  | { kind: "ignore"; reason: string }
  | {
      kind: "apply";
      allowCreate: boolean;
      patch: RevenueCatSubscriptionPatch;
      /**
       * El evento tiene autoridad sobre un acceso permanente.
       *
       * Sólo lo marca un reembolso: el dinero volvió y el lifetime se retira.
       * Sin esta marca, `guardLifetimePrecedence` no puede distinguir el patch
       * de un reembolso del de una expiración del mensual —tienen exactamente
       * la misma forma— y una expiración terminaría borrando el lifetime.
       */
      overridesLifetime?: boolean;
      /**
       * QUÉ producto demuestra el reembolso.
       *
       * `overridesLifetime` por sí solo no alcanzaba: un `CANCELLATION` con
       * `cancel_reason: "CUSTOMER_SUPPORT"` del MENSUAL traía la marca y
       * borraba un lifetime de otro producto que nadie devolvió. Un reembolso
       * sólo puede retirar el producto que demuestra.
       */
      refundedProductId?: string;
      /**
       * Este evento tiene autoridad para ESCRIBIR un acceso permanente.
       *
       * Sólo lo marcan los eventos de un producto que la configuración declara
       * permanente (`REVENUECAT_LIFETIME_PRODUCT_IDS`). Sin esta marca, ningún
       * patch puede pretender autoridad sobre un lifetime existente — antes
       * alcanzaba con que `patch.plan` dijera `"lifetime"`, y ese valor salía de
       * un substring del product id.
       */
      lifetimeAuthority?: boolean;
      /**
       * El guard preservó un acceso permanente que este evento habría bajado.
       *
       * Lo escribe `guardLifetimePrecedence`, no el derivador. Sirve para
       * auditar el caso y para que el webhook lo reconcilie contra la tienda en
       * vez de dejarlo silenciosamente resuelto.
       */
      preservedLifetime?: boolean;
    };

const RC_ANONYMOUS_PREFIX = "$RCAnonymousID:";

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function isRevenueCatAnonymousId(value: string): boolean {
  return value.startsWith(RC_ANONYMOUS_PREFIX);
}

function nonAnonymousIds(value: unknown): string[] {
  return stringArray(value).filter((entry) => !isRevenueCatAnonymousId(entry));
}

// RevenueCat puede mover el identificador visible entre app_user_id,
// original_app_user_id y aliases. Se prueban todos, en ese orden, contra Clerk.
export function revenueCatUserCandidates(event: RevenueCatEvent): string[] {
  return unique(
    [
      nonEmptyString(event.app_user_id),
      nonEmptyString(event.original_app_user_id),
      ...stringArray(event.aliases)
    ].filter(
      (entry): entry is string => typeof entry === "string" && !isRevenueCatAnonymousId(entry)
    )
  );
}

export function revenueCatTransferCandidates(event: RevenueCatEvent): {
  from: string[];
  to: string[];
} {
  return {
    from: unique(nonAnonymousIds(event.transferred_from)),
    to: unique(nonAnonymousIds(event.transferred_to))
  };
}

/**
 * ¿Este evento habla del entitlement canónico?
 *
 * RevenueCat documenta `entitlement_ids` como **Sometimes**: los eventos de
 * lifecycle pueden traer únicamente el `entitlement_id` singular. Mirar sólo el
 * array dejaba pasar de largo un `CANCELLATION` con
 * `cancel_reason: "CUSTOMER_SUPPORT"` —un REEMBOLSO— que traía
 * `entitlement_id: "orbita_pro"` y nada más: quedaba `ignored_unrelated_entitlement`
 * y ni siquiera disparaba la reconciliación.
 *
 * Se aceptan las dos formas y **sólo** el id canónico exacto. Un entitlement o
 * un producto ajeno sigue sin poder tocar Órbita Plus.
 */
export function hasCanonicalRevenueCatEntitlement(event: RevenueCatEvent): boolean {
  if (stringArray(event.entitlement_ids).includes(PRO_ENTITLEMENT)) return true;
  return nonEmptyString(event.entitlement_id) === PRO_ENTITLEMENT;
}

export function revenueCatEnvironment(event: RevenueCatEvent): "sandbox" | "production" | undefined {
  if (event.environment === "SANDBOX") return "sandbox";
  if (event.environment === "PRODUCTION") return "production";
  return undefined;
}

type RevenueCatEnvSource = Record<string, string | undefined>;

/**
 * Cuentas de QA/App Review autorizadas a comprar en Sandbox contra producción.
 *
 * TestFlight y App Review usan el binario PRODUCTIVO pero sus compras salen de
 * Sandbox. Sin esta puerta, quien revisa la app compra, RevenueCat manda un
 * evento `SANDBOX`, producción lo descarta y la app se ve rota justo en la
 * revisión. La puerta es por identidad explícita: se abre para los Clerk id que
 * el secreto enumera y para nadie más.
 *
 * Se compara con distinción de mayúsculas, igual que el resto de la resolución
 * de identidad contra Clerk.
 */
export function revenueCatSandboxReviewers(env: RevenueCatEnvSource = process.env): Set<string> {
  return new Set(
    (env.REVENUECAT_SANDBOX_REVIEW_USER_IDS ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  );
}

/**
 * ¿Este deployment puede consumir este recibo?
 *
 * Falla CERRADO en tres direcciones:
 *
 * - un deployment sin entorno declarado (`unknown`) no acepta nada; antes se
 *   asumía development y consumía Sandbox;
 * - development sólo acepta Sandbox;
 * - producción acepta Production siempre y Sandbox **sólo** para una cuenta de
 *   review allowlisted, nunca de forma global y nunca sin identidad resuelta.
 */
export function isRevenueCatEnvironmentAllowed(
  eventEnvironment: "sandbox" | "production",
  options: { env?: RevenueCatEnvSource; clerkUserId?: string } = {}
): boolean {
  const env = options.env ?? process.env;
  switch (resolveDeploymentEnvironment(env)) {
    case "production":
      if (eventEnvironment === "production") return true;
      return Boolean(
        options.clerkUserId && revenueCatSandboxReviewers(env).has(options.clerkUserId)
      );
    case "development":
      return eventEnvironment === "sandbox";
    default:
      return false;
  }
}

export function revenueCatEventTimestamp(event: RevenueCatEvent): number | undefined {
  const timestamp = finiteNumber(event.event_timestamp_ms);
  return timestamp !== undefined && timestamp > 0 ? timestamp : undefined;
}

/**
 * Productos permanentes DECLARADOS por configuración.
 *
 * ## Por qué una allowlist y no el nombre
 *
 * `NON_RENEWING_PURCHASE` es el evento de cualquier compra de una sola vez:
 * un pack de consumibles, una promo, un producto de prueba. Decidir "esto es
 * acceso de por vida" porque el product id contiene la palabra `lifetime` es
 * conceder acceso permanente desde una convención de nombres que no controla
 * este código — `orbita_lifetime_trial` la cumple y no es un lifetime.
 *
 * ## El default: cerrado
 *
 * El catálogo comercial vigente (V1) es **exclusivamente mensual**. Sin
 * `REVENUECAT_LIFETIME_PRODUCT_IDS` configurado, ningún evento concede acceso
 * permanente: el trabajo cae en la lectura autoritativa, que sí puede
 * demostrarlo con el entitlement y su transacción.
 *
 * Esto NO toca las filas legadas ya demostradas: un `isLifetime: true` que ya
 * existe sigue concediendo acceso y sigue protegido por
 * `guardLifetimePrecedence`. Lo que se cierra es la puerta para escribir uno
 * nuevo sin prueba.
 */
export function revenueCatLifetimeProducts(env: RevenueCatEnvSource = process.env): Set<string> {
  return new Set(
    (env.REVENUECAT_LIFETIME_PRODUCT_IDS ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  );
}

export function isRevenueCatLifetimeProduct(
  productId: string | undefined,
  env: RevenueCatEnvSource = process.env
): boolean {
  return Boolean(productId && revenueCatLifetimeProducts(env).has(productId));
}

/**
 * El producto NOMBRA la cadencia. Nunca nombra un acceso permanente.
 *
 * `lifetime` salió de esta tabla a propósito. Mientras estuvo, un
 * `INITIAL_PURCHASE` de `orbita_lifetime_trial` con vencimiento finito producía
 * un patch con `plan: "lifetime"`, y `guardLifetimePrecedence` leía eso como
 * "este evento es autoridad sobre el acceso permanente" y dejaba que un
 * producto de prueba destruyera un lifetime real. La única fuente de autoridad
 * permanente es la allowlist explícita (`revenueCatLifetimeProducts`).
 */
export function planFromRevenueCatProductId(productId?: string): SubscriptionPlan | undefined {
  if (!productId) return undefined;
  const normalized = productId.toLowerCase();
  if (normalized.includes("year") || normalized.includes("annual")) return "yearly";
  if (normalized.includes("month")) return "monthly";
  if (normalized.includes("week")) return "weekly";
  return undefined;
}

/** El plan de un evento: permanente sólo si la configuración lo declara. */
function planForEvent(
  productId: string | undefined,
  env: RevenueCatEnvSource = process.env
): SubscriptionPlan | undefined {
  if (isRevenueCatLifetimeProduct(productId, env)) return "lifetime";
  return planFromRevenueCatProductId(productId);
}

function subscriptionProduct(event: RevenueCatEvent): string | undefined {
  return nonEmptyString(event.new_product_id) ?? nonEmptyString(event.product_id);
}

/**
 * Fecha de fin de período: finita **y positiva**.
 *
 * `finiteNumber` sólo exigía finitud, así que un `expiration_at_ms: 0` —o
 * negativo— se aceptaba como una fecha válida. Con una fila Pro vigente, un
 * `RENEWAL` con ese valor producía `kind: "apply"` y escribía
 * `currentPeriodEnd: 0`: la época Unix, es decir, **acceso pagado cortado en el
 * acto**. Lo mismo con `grace_period_expiration_at_ms`.
 *
 * Un instante en el pasado remoto no es una fecha de fin de suscripción: es un
 * payload que no se entiende. Sin fecha demostrable, el evento no aplica y la
 * lectura autoritativa —que ya se dispara por el camino de `ignore`— decide.
 */
function subscriptionTimestamp(value: unknown): number | undefined {
  const timestamp = finiteNumber(value);
  return timestamp !== undefined && timestamp > 0 ? timestamp : undefined;
}

function subscriptionPeriodEnd(
  event: RevenueCatEvent,
  existing?: RevenueCatExistingState
): number | undefined {
  // El fallback a la fila existente pasa por el mismo filtro: una fila con un
  // `currentPeriodEnd` corrupto no puede prestárselo a un evento nuevo.
  return (
    subscriptionTimestamp(event.expiration_at_ms) ?? subscriptionTimestamp(existing?.currentPeriodEnd)
  );
}

// Convierte únicamente eventos que demuestran el entitlement canónico. Los
// eventos de otro producto/entitlement quedan auditados pero jamás otorgan ni
// revocan Orbita Plus.
export function deriveRevenueCatEventDecision(
  event: RevenueCatEvent,
  existing?: RevenueCatExistingState
): RevenueCatEventDecision {
  const type = nonEmptyString(event.type);
  if (type === "TRANSFER") return { kind: "transfer" };
  if (!type) return { kind: "ignore", reason: "missing_type" };
  if (!hasCanonicalRevenueCatEntitlement(event)) {
    return { kind: "ignore", reason: "unrelated_entitlement" };
  }

  const productId = subscriptionProduct(event);
  const plan = planForEvent(productId);
  const eventTimestamp = revenueCatEventTimestamp(event);
  const expirationAt = subscriptionTimestamp(event.expiration_at_ms);
  const periodEnd = subscriptionPeriodEnd(event, existing);
  const status: SubscriptionStatus = event.period_type === "TRIAL" ? "trialing" : "active";

  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
      if (expirationAt === undefined) return { kind: "ignore", reason: "missing_period_end" };
      return {
        kind: "apply",
        allowCreate: true,
        patch: {
          entitlement: PRO_ENTITLEMENT,
          status,
          plan,
          productId,
          currentPeriodEnd: expirationAt,
          isLifetime: false,
          willRenew: true
        }
      };

    case "NON_RENEWING_PURCHASE":
      // Un NON_RENEWING_PURCHASE puede ser un consumible, una promo o un
      // producto de prueba. El NOMBRE del producto no lo convierte en acceso
      // permanente: hace falta que la configuración lo declare. Sin esa
      // declaración se falla cerrado y la lectura autoritativa decide, que sí
      // tiene el entitlement y la transacción para demostrarlo.
      if (!isRevenueCatLifetimeProduct(productId)) {
        return { kind: "ignore", reason: "unsupported_non_renewing_product" };
      }
      return {
        kind: "apply",
        allowCreate: true,
        lifetimeAuthority: true,
        patch: {
          entitlement: PRO_ENTITLEMENT,
          status: "active",
          plan: "lifetime",
          productId,
          isLifetime: true,
          willRenew: false
        }
      };

    case "PRODUCT_CHANGE":
      if (!existing) return { kind: "ignore", reason: "missing_subscription" };
      // Sin una fecha positiva —ni del evento ni de la fila— no se toca nada.
      // `currentPeriodEnd: expirationAt` queda `undefined` cuando la del evento
      // no se entiende, y `omitUndefined` conserva la que ya tenía la fila.
      if (periodEnd === undefined) return { kind: "ignore", reason: "missing_period_end" };
      return {
        kind: "apply",
        allowCreate: false,
        patch: { plan, productId, currentPeriodEnd: expirationAt }
      };

    case "UNCANCELLATION":
      if (!existing) return { kind: "ignore", reason: "missing_subscription" };
      if (periodEnd === undefined) return { kind: "ignore", reason: "missing_period_end" };
      return {
        kind: "apply",
        allowCreate: false,
        patch: {
          entitlement: PRO_ENTITLEMENT,
          status: "active",
          plan,
          productId,
          currentPeriodEnd: periodEnd,
          isLifetime: false,
          willRenew: true
        }
      };

    case "CANCELLATION":
    case "SUBSCRIPTION_PAUSED": {
      if (!existing) return { kind: "ignore", reason: "missing_subscription" };

      // RevenueCat no tiene un evento `REFUND`: un reembolso llega como
      // `CANCELLATION` con `cancel_reason: "CUSTOMER_SUPPORT"`. Ahí el dinero
      // ya volvió, así que el acceso se retira EN EL ACTO —incluido un
      // lifetime, que si no se quedaría sin vencimiento para siempre—.
      if (event.cancel_reason === "CUSTOMER_SUPPORT") {
        // Un reembolso sólo puede apagar EL producto que demuestra.
        //
        // La fila de RevenueCat es agregada —un mensual y un lifetime legado
        // conviven en ella—, así que un `CANCELLATION` que no nombra su
        // producto, o que nombra otro, no puede escribir `entitlement: "free"`
        // encima. Sin `product_id` no se sabe qué se devolvió; con un producto
        // distinto del de la fila, lo que se devolvió no es esto. En los dos
        // casos se difiere a la lectura autoritativa, que sí ve el catálogo
        // completo del suscriptor.
        if (!productId) return { kind: "ignore", reason: "refund_without_product" };
        if (existing?.productId === undefined || existing.productId !== productId) {
          return { kind: "ignore", reason: "refund_product_mismatch" };
        }
        return {
          kind: "apply",
          allowCreate: false,
          overridesLifetime: true,
          refundedProductId: productId,
          patch: {
            entitlement: "free",
            status: "expired",
            currentPeriodEnd: expirationAt ?? eventTimestamp,
            isLifetime: false,
            willRenew: false
          }
        };
      }

      // El resto son bajas: se hacen efectivas al fin del período. Sin una
      // fecha demostrable no se toca la fila, para no revocar antes de tiempo.
      if (periodEnd === undefined) return { kind: "ignore", reason: "missing_period_end" };
      return {
        kind: "apply",
        allowCreate: false,
        patch: { status: "canceled", currentPeriodEnd: periodEnd, willRenew: false }
      };
    }

    case "EXPIRATION":
      if (!existing) return { kind: "ignore", reason: "missing_subscription" };
      return {
        kind: "apply",
        allowCreate: false,
        patch: {
          entitlement: "free",
          status: "expired",
          currentPeriodEnd: expirationAt,
          isLifetime: false,
          willRenew: false
        }
      };

    case "BILLING_ISSUE": {
      if (!existing) return { kind: "ignore", reason: "missing_subscription" };
      const gracePeriodEnd =
        subscriptionTimestamp(event.grace_period_expiration_at_ms) ?? periodEnd;
      if (gracePeriodEnd === undefined) return { kind: "ignore", reason: "missing_grace_period_end" };
      return {
        kind: "apply",
        allowCreate: false,
        patch: {
          entitlement: PRO_ENTITLEMENT,
          status: "billing_issue",
          currentPeriodEnd: gracePeriodEnd,
          willRenew: true
        }
      };
    }

    case "SUBSCRIPTION_EXTENDED":
      if (!existing) return { kind: "ignore", reason: "missing_subscription" };
      if (expirationAt === undefined) return { kind: "ignore", reason: "missing_period_end" };
      return {
        kind: "apply",
        allowCreate: false,
        patch: {
          entitlement: PRO_ENTITLEMENT,
          status: existing.status === "canceled" ? "canceled" : "active",
          currentPeriodEnd: expirationAt,
          willRenew: existing.willRenew
        }
      };

    case "REFUND_REVERSED":
      // Mismo rigor que la compra: restituir un acceso PERMANENTE exige que la
      // configuración declare el producto. Un `..._lifetime_...` cualquiera no
      // alcanza. Si no está declarado, cae al camino de suscripción y, sin
      // fecha demostrable, se difiere a la lectura autoritativa.
      if (isRevenueCatLifetimeProduct(productId)) {
        return {
          kind: "apply",
          allowCreate: true,
          lifetimeAuthority: true,
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
      if (periodEnd === undefined) return { kind: "ignore", reason: "missing_period_end" };
      return {
        kind: "apply",
        allowCreate: true,
        patch: {
          entitlement: PRO_ENTITLEMENT,
          status,
          plan,
          productId,
          currentPeriodEnd: periodEnd,
          isLifetime: false,
          willRenew: existing?.willRenew ?? true
        }
      };

    case "TEMPORARY_ENTITLEMENT_GRANT":
      if (expirationAt === undefined) return { kind: "ignore", reason: "missing_period_end" };
      return {
        kind: "apply",
        allowCreate: true,
        patch: {
          entitlement: PRO_ENTITLEMENT,
          status: "active",
          plan,
          productId,
          currentPeriodEnd: expirationAt,
          isLifetime: false,
          willRenew: false
        }
      };

    default:
      return { kind: "ignore", reason: "unsupported_event" };
  }
}

/**
 * Un lifetime demostrado no se pierde por un evento de OTRO producto.
 *
 * RevenueCat guarda UNA fila por (usuario, proveedor, entorno) y esa fila es
 * agregada: el catálogo vigente es sólo mensual, pero quedan lifetimes legados
 * conviviendo ahí. Sin este guard, la `EXPIRATION` del mensual escribía
 * `entitlement: "free"`, `status: "expired"` e `isLifetime: false` encima del
 * lifetime y lo borraba.
 *
 * ## La única degradación legítima, y por qué no alcanzaba con marcarla
 *
 * Un reembolso retira el acceso permanente porque el dinero volvió. Pero
 * `overridesLifetime` a secas no distinguía QUÉ se devolvió: un `CANCELLATION`
 * con `cancel_reason: "CUSTOMER_SUPPORT"` de `orbita_monthly` traía la marca y
 * borraba un lifetime que nadie reembolsó. Ahora el reembolso tiene que
 * demostrar el producto (`refundedProductId`) y ese producto tiene que ser el
 * de la fila. Un reembolso de otro producto —o uno que no puede nombrar el
 * suyo— preserva el lifetime y queda para reconciliar contra la tienda.
 *
 * ## Qué se preserva
 *
 * Mientras la representación siga siendo agregada, un evento del mensual
 * tampoco puede pisar los campos que IDENTIFICAN al lifetime (`plan`,
 * `productId`): sin ellos, el reembolso real de mañana no tendría contra qué
 * compararse y el acceso permanente quedaría imposible de retirar. El resto del
 * patch —fecha de fin, renovación— se aplica igual.
 */
export function guardLifetimePrecedence(
  decision: RevenueCatEventDecision,
  existing?: RevenueCatExistingState
): RevenueCatEventDecision {
  if (decision.kind !== "apply" || !existing?.isLifetime) return decision;

  const mismoProducto =
    existing.productId !== undefined && decision.patch.productId === existing.productId;

  // Autoridad INEQUÍVOCA y del MISMO producto: la configuración declara ese
  // producto como permanente y el evento vuelve a afirmarlo.
  //
  // Antes alcanzaba con `patch.isLifetime === true || patch.plan === "lifetime"`,
  // y `plan` salía de un substring del product id: un `INITIAL_PURCHASE` de
  // `orbita_lifetime_trial` con vencimiento finito entraba por acá y arrasaba
  // con un lifetime real.
  if (decision.lifetimeAuthority && mismoProducto) return decision;

  // Un reembolso que demuestra ESTE producto sí lo retira.
  if (
    decision.overridesLifetime &&
    decision.refundedProductId !== undefined &&
    existing.productId !== undefined &&
    decision.refundedProductId === existing.productId
  ) {
    return decision;
  }

  // Sin autoridad demostrada, este evento no puede tocar NINGUNO de los cuatro
  // campos que definen el acceso permanente ni su identidad. Se aplica lo
  // demás —fecha de fin, renovación— que es la verdad del otro producto.
  const patch: RevenueCatSubscriptionPatch = { ...decision.patch };
  delete patch.isLifetime;
  delete patch.plan;
  delete patch.productId;
  if (patch.entitlement === "free") delete patch.entitlement;
  if (patch.status === "expired") delete patch.status;
  return { ...decision, patch, preservedLifetime: true };
}

/** Lo mínimo de una fila para decidir si una transferencia la degradaría. */
export type TransferRowState = {
  entitlement?: string;
  status?: SubscriptionStatus;
  plan?: SubscriptionPlan;
  productId?: string;
  currentPeriodEnd?: number;
  isLifetime?: boolean;
  willRenew?: boolean;
};

const otorga = (row: TransferRowState) =>
  row.entitlement === PRO_ENTITLEMENT || row.entitlement === "plus";
const finDePeriodo = (row: TransferRowState) => row.currentPeriodEnd ?? 0;

/** Estados en los que la suscripción ya no continúa por sí sola. */
const ESTADOS_TERMINALES: SubscriptionStatus[] = ["canceled", "expired", "inactive"];

/**
 * Fuerza de una fila a IGUAL tipo y IGUAL vencimiento.
 *
 * Es el último desempate del ranking y el que faltaba: dos filas mensuales con
 * el mismo `currentPeriodEnd` no son equivalentes si una renueva y la otra ya
 * está dada de baja. Sin esto, una fuente `canceled` / `willRenew: false` con
 * la misma fecha pisaba un destino `active` / `willRenew: true` y encima le
 * copiaba el estado cancelado.
 *
 * - 2 — renueva sola: la más fuerte.
 * - 1 — vigente pero sin renovación demostrada.
 * - 0 — dada de baja, vencida o inactiva.
 */
function fuerzaDeEstado(row: TransferRowState): number {
  if (row.status !== undefined && ESTADOS_TERMINALES.includes(row.status)) return 0;
  if (row.willRenew === false) return 0;
  return row.willRenew === true ? 2 : 1;
}

/**
 * ¿La fila transferida puede escribirse encima del destino?
 *
 * ## Por qué hace falta preguntarlo
 *
 * Un `TRANSFER` mueve UNA compra. La fila de RevenueCat, en cambio, es
 * AGREGADA: una sola por (usuario, proveedor, entorno). Copiar la fuente entera
 * sobre el destino hacía que mover una compra destruyera otra distinta:
 *
 * - una fuente ya vencida apagaba un destino con acceso vigente;
 * - un mensual con menos días acortaba el mensual más largo del destino;
 * - un mensual borraba un lifetime; un lifetime A reemplazaba al lifetime B y
 *   se llevaba puesto su `productId`, que es lo único con lo que después se
 *   puede demostrar un reembolso.
 *
 * ## El ranking, explícito y en este orden
 *
 * 0. **Acceso** — otorgar gana a no otorgar, antes que nada.
 * 1. **Tipo** — permanente gana a mensual.
 * 2. **Vigencia** — a igual tipo, el vencimiento más lejano.
 * 3. **Estado y renovación** — a igual tipo y vencimiento, la que renueva gana
 *    a la que está dada de baja.
 *
 * El paso 0 faltaba, y la comparación caía directamente en la fecha: una fuente
 * `orbita_pro` vigente con vencimiento cercano NO podía escribirse sobre un
 * destino `free` cuya fila conservaba un `currentPeriodEnd` más lejano. Y esa
 * fila existe de verdad: un reembolso (`CUSTOMER_SUPPORT`) deja `free` sin
 * borrar la fecha. Como la fuente se apaga igual, las dos cuentas quedaban en
 * Free hasta que la lectura REST lo reparara.
 *
 * Nunca degradar: la fuente se escribe encima **sólo** si su rango es mayor o
 * igual al del destino. Ante cualquier ambigüedad que la fila agregada no puede
 * representar, se preserva el destino y se reconcilia contra la tienda. La
 * fuente se apaga igual: esa compra dejó de ser suya.
 */
export function transferOverwritesTarget(
  source: TransferRowState,
  target: TransferRowState | null | undefined
): boolean {
  if (!target) return true;

  // 0. Acceso. Un `currentPeriodEnd` que sobrevivió en una fila sin acceso no
  //    puede ganarle a una fila que sí lo otorga.
  const fuenteOtorga = otorga(source);
  const destinoOtorga = otorga(target);
  if (fuenteOtorga !== destinoOtorga) return fuenteOtorga;
  // Ninguna de las dos otorga: escribir es idempotente y no concede nada.
  if (!fuenteOtorga) return true;

  // 1. Tipo.
  if (target.isLifetime === true) {
    // Sólo el MISMO producto permanente puede reescribirse a sí mismo. Otro
    // lifetime es otra compra, y la fila no puede representar las dos.
    return (
      source.isLifetime === true &&
      source.productId !== undefined &&
      source.productId === target.productId
    );
  }
  // Un permanente sube de rango sobre un mensual: no degrada.
  if (source.isLifetime === true) return true;

  // 2. Vigencia: jamás acortar el período del destino.
  const finFuente = finDePeriodo(source);
  const finDestino = finDePeriodo(target);
  if (finFuente !== finDestino) return finFuente > finDestino;

  // 3. Estado y renovación, con el mismo vencimiento.
  return fuerzaDeEstado(source) >= fuerzaDeEstado(target);
}

// paymentEvents conserva el nombre histórico rawPayload, pero no debe guardar
// atributos del suscriptor, aliases ni el cuerpo íntegro recibido.
/**
 * Saca las claves que Convex reserva, en profundidad, conservando todo lo demás.
 *
 * ## El defecto que cierra
 *
 * `revenuecatWebhook` pasaba el evento **crudo** como argumento de la mutation.
 * Convex valida los argumentos ANTES de entrar al handler y rechaza cualquier
 * nombre de campo que empiece con `$`. RevenueCat manda `subscriber_attributes`
 * con `$displayName`, `$email` e `$idfa`, y los completa solo:
 *
 * ```
 * 500 — Field name $displayName starts with a '$', which is reserved.
 * ```
 *
 * Cada webhook moría con 500. RevenueCat reintenta una cantidad acotada y
 * después abandona, así que un `INITIAL_PURCHASE` perdido dejaba a alguien que
 * pagó en Free, sin ningún evento posterior que lo reparara.
 *
 * ## Por qué acá y no en `sanitizeRevenueCatEvent`
 *
 * Aquélla es una **lista blanca para auditoría**: se queda con un puñado de
 * campos y descarta el resto. La mutation necesita el evento COMPLETO para
 * resolver identidad, transfers y entitlements. Esta función sólo quita lo que
 * Convex no admite y no toca nada más.
 *
 * Se quitan `$` y `_`: Convex reserva los dos prefijos para nombres de campo.
 */
export function stripConvexReservedKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripConvexReservedKeys(item)) as unknown as T;
  }
  if (value === null || typeof value !== "object") return value;

  const limpio: Record<string, unknown> = {};
  for (const [clave, contenido] of Object.entries(value as Record<string, unknown>)) {
    if (clave.startsWith("$") || clave.startsWith("_")) continue;
    limpio[clave] = stripConvexReservedKeys(contenido);
  }
  return limpio as unknown as T;
}

export function sanitizeRevenueCatEvent(event: RevenueCatEvent, outcome?: string): Record<string, unknown> {
  const transfer = revenueCatTransferCandidates(event);
  const entitlementIds = stringArray(event.entitlement_ids);
  const sanitized: Record<string, unknown> = {
    id: nonEmptyString(event.id),
    type: nonEmptyString(event.type) ?? "UNKNOWN",
    environment: nonEmptyString(event.environment),
    eventTimestampMs: finiteNumber(event.event_timestamp_ms),
    productId: subscriptionProduct(event),
    entitlementIds: entitlementIds.length > 0 ? entitlementIds : undefined,
    // El lifecycle puede traer sólo el singular; queda auditado igual.
    entitlementId: nonEmptyString(event.entitlement_id),
    periodType: nonEmptyString(event.period_type),
    expirationAtMs: finiteNumber(event.expiration_at_ms),
    gracePeriodExpirationAtMs: finiteNumber(event.grace_period_expiration_at_ms),
    cancelReason: nonEmptyString(event.cancel_reason),
    transferredFromCount: transfer.from.length > 0 ? transfer.from.length : undefined,
    transferredToCount: transfer.to.length > 0 ? transfer.to.length : undefined,
    outcome
  };

  return Object.fromEntries(Object.entries(sanitized).filter(([, value]) => value !== undefined));
}

// Evita comparar el Authorization del webhook con un early-return por prefijo.
// La longitud máxima sigue siendo observable, pero todos los caracteres del
// valor más largo se recorren y nunca se registra ninguna de las dos cadenas.
export function constantTimeStringEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}
