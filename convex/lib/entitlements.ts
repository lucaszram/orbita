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
export type SubscriptionPlan = "weekly" | "yearly" | "lifetime";

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

export type SubscriptionRow = {
  entitlement?: string;
  status?: SubscriptionStatus;
  provider?: SubscriptionProvider;
  plan?: SubscriptionPlan;
  isLifetime?: boolean;
  willRenew?: boolean;
  currentPeriodEnd?: number;
};

// ¿Esta fila da acceso Pro ahora mismo?
export function isRowActive(row: SubscriptionRow, now: number): boolean {
  if (row.entitlement === "free") return false;
  if (row.isLifetime) return true;
  if (!row.status || !ACTIVE_STATUSES.includes(row.status)) return false;
  // Sin fecha de fin y con estado activo (ej. lifetime sin flag) → vigente.
  if (row.currentPeriodEnd === undefined) return row.status === "active" || row.status === "trialing";
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
};

const FREE_RESULT: ResolvedEntitlement = {
  entitlement: "free",
  isPro: false,
  status: "inactive",
  isLifetime: false,
  canManageInStripePortal: false
};

// Combina todas las filas del usuario en un único estado de acceso.
export function resolveEntitlement(rows: SubscriptionRow[], now: number): ResolvedEntitlement {
  const active = rows.filter((row) => isRowActive(row, now));
  if (active.length === 0) return { ...FREE_RESULT };

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
    canManageInStripePortal: winner.provider === "stripe" && !winner.isLifetime
  };
}
