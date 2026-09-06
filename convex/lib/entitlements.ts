// Resolución de entitlement compartida por queries y webhooks.
//
// Identificador canónico del acceso pago en los tres sistemas (RevenueCat,
// Stripe metadata, Convex): `orbita_pro`. `plus` es un alias legacy que solo
// existe mientras corre la migración `renamePlusToOrbitaPro`.

export type EntitlementKey = "free" | "orbita_pro";
export type SubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "billing_issue"
  | "canceled"
  | "expired";
export type SubscriptionProvider = "revenuecat" | "stripe" | "stub";
export type SubscriptionPlan = "monthly" | "weekly" | "yearly" | "lifetime";

export const PRO_ENTITLEMENT: EntitlementKey = "orbita_pro";

// Estados en los que el acceso sigue vigente mientras no se pase de
// `currentPeriodEnd`. `canceled` sigue con acceso hasta fin de período;
// `billing_issue`/`past_due` usan el grace period de la store.
const ACTIVE_STATUSES: SubscriptionStatus[] = [
  "active",
  "trialing",
  "canceled",
  "billing_issue",
  "past_due"
];

export type ProviderEnvironment = "sandbox" | "production";

export type SubscriptionRow = {
  entitlement?: string;
  status?: SubscriptionStatus;
  provider?: SubscriptionProvider;
  plan?: SubscriptionPlan;
  /**
   * Producto que sostiene esta fila.
   *
   * Está en la tabla y lo usan las decisiones de precedencia (un reembolso sólo
   * puede retirar el producto que demuestra), pero faltaba en este tipo, así
   * que las comparaciones se hacían contra un campo invisible para el
   * compilador.
   */
  productId?: string;
  isLifetime?: boolean;
  willRenew?: boolean;
  currentPeriodEnd?: number;
  /** Tienda de la que vino el recibo. Sólo las filas de RevenueCat lo traen. */
  environment?: ProviderEnvironment;
  /** Denormalizado en la tabla; permite resolver el contexto sin otra lectura. */
  clerkUserId?: string;
};

/**
 * Contexto de resolución. Lo que no se puede demostrar, no concede.
 *
 * Los dos flags los calcula `convex/lib/subscriptionAccess.ts` a partir del
 * entorno declarado del deployment y de la allowlist de review. Los DOS tienen
 * default `false` para que cualquier consumidor que los olvide falle CERRADO.
 *
 * `productionAllowed` no existía, y ésa era la puerta: un consumidor que
 * llamaba a `resolveEntitlement(rows, now)` sin contexto —el default directo—
 * dejaba pasar una fila `production` en un deployment de development, o en uno
 * sin entorno declarado. El corte de sandbox estaba, el de production no.
 */
export type EntitlementContext = {
  sandboxAllowed?: boolean;
  productionAllowed?: boolean;
};

// ¿Esta fila da acceso Pro ahora mismo?
export function isRowActive(
  row: SubscriptionRow,
  now: number,
  context: EntitlementContext = {}
): boolean {
  // `plus` sigue aceptado solo para filas legacy pendientes de migración. Una
  // fila incompleta o con cualquier otro entitlement nunca concede acceso.
  if (row.entitlement !== PRO_ENTITLEMENT && row.entitlement !== "plus") return false;

  // Corte de entorno para las filas de la tienda. Stripe no tiene entornos y no
  // se ve afectado por nada de esto.
  //
  // Las TRES formas fallan cerrado y hay que autorizarlas explícitamente:
  //
  // - sin `environment` (fila legada): no se puede demostrar de qué tienda vino;
  // - `sandbox`: sólo con `sandboxAllowed` (development, o una cuenta de review
  //   allowlisted contra producción);
  // - `production`: sólo con `productionAllowed`. Sin esto, un deployment de
  //   development —o uno que no declara su entorno— concedía Órbita Plus desde
  //   una fila productiva, y cualquier consumidor que llamara sin contexto
  //   entraba por esa puerta.
  if (row.provider === "revenuecat") {
    if (row.environment === undefined) return false;
    if (row.environment === "sandbox" && !context.sandboxAllowed) return false;
    if (row.environment === "production" && !context.productionAllowed) return false;
  }

  if (row.isLifetime) return true;
  if (!row.status || !ACTIVE_STATUSES.includes(row.status)) return false;
  // Sólo `isLifetime` puede prescindir de una fecha de fin. Antes, cualquier
  // fila `active`/`trialing` sin fecha concedía acceso indefinido: un
  // `checkout.session.completed` de Stripe escribe exactamente esa forma y la
  // fecha llega recién con `customer.subscription.updated`. Si ese segundo
  // webhook nunca llegaba, el acceso no vencía nunca.
  if (row.currentPeriodEnd === undefined) return false;
  return row.currentPeriodEnd > now;
}

// Rango para elegir la fila "ganadora" entre varias activas: lifetime primero,
// luego la de mayor `currentPeriodEnd`.
export function rowRank(row: SubscriptionRow): number {
  if (row.isLifetime) return Number.MAX_SAFE_INTEGER;
  return row.currentPeriodEnd ?? 0;
}

export type ResolvedEntitlement = {
  entitlement: EntitlementKey;
  isPro: boolean;
  status: SubscriptionStatus;
  provider?: SubscriptionProvider;
  plan?: SubscriptionPlan;
  isLifetime: boolean;
  currentPeriodEnd?: number;
  willRenew?: boolean;
  canManageInStripePortal: boolean;
  /**
   * Campos ADITIVOS. Un cliente anterior que sólo lee `provider` y
   * `canManageInStripePortal` sigue funcionando igual.
   *
   * Existen porque `provider` nombra a UN ganador —el de mayor rango— y una
   * persona puede tener cobros vivos en los dos lados a la vez (compró en la
   * web y después en la app). Si la pantalla sólo ofrece la salida del ganador,
   * el otro cobro sigue corriendo sin forma visible de cancelarlo.
   */
  canManageInRevenueCat: boolean;
  activeProviders: SubscriptionProvider[];
};

const FREE_RESULT: ResolvedEntitlement = {
  entitlement: "free",
  isPro: false,
  status: "inactive",
  isLifetime: false,
  canManageInStripePortal: false,
  canManageInRevenueCat: false,
  activeProviders: []
};

// Combina todas las filas del usuario en un único estado de acceso.
export function resolveEntitlement(
  rows: SubscriptionRow[],
  now: number,
  context: EntitlementContext = {}
): ResolvedEntitlement {
  const active = rows.filter((row) => isRowActive(row, now, context));
  if (active.length === 0) return { ...FREE_RESULT, activeProviders: [] };

  const winner = active.reduce((best, row) => (rowRank(row) > rowRank(best) ? row : best));

  return {
    entitlement: "orbita_pro",
    isPro: true,
    status: winner.status ?? "active",
    provider: winner.provider,
    plan: winner.plan,
    isLifetime: Boolean(winner.isLifetime),
    currentPeriodEnd: winner.currentPeriodEnd,
    willRenew: winner.willRenew,
    // Si RevenueCat gana por duración/lifetime pero Stripe también está activo,
    // el usuario debe conservar la salida para administrar y evitar doble cobro.
    canManageInStripePortal: active.some((row) => row.provider === "stripe" && !row.isLifetime),
    canManageInRevenueCat: active.some((row) => row.provider === "revenuecat"),
    activeProviders: [
      ...new Set(
        active
          .map((row) => row.provider)
          .filter((provider): provider is SubscriptionProvider => provider !== undefined)
      )
    ].sort()
  };
}
