/**
 * Cuentas del backoffice — la parte PURA, testeable sin renderizar.
 *
 * Acá vive todo lo que la pestaña `Cuentas` decide: qué se puede consultar
 * (rangos, segmentos, orden), cuándo una query paginada tiene permiso para
 * salir, cómo se valida un grant Pro manual y —lo más delicado— qué se le dice
 * a la persona DESPUÉS de una mutación.
 *
 * La regla que ordena este módulo: el backoffice no adivina el acceso. Lo
 * único autoritativo es el `effectiveAccess` que devuelve Convex; revocar el
 * grant manual NO cancela Stripe ni RevenueCat, así que el mensaje de salida se
 * arma leyendo esa respuesta, nunca la intención del click.
 *
 * Las formas de los tipos son el contrato de `convex/adminAccounts.ts`. Se
 * declaran a mano —no se importa `convex/_generated`— porque el frontend
 * consume el backend por `anyApi` (ver `WORKFLOW.md` §4).
 */

// --- Contrato ---------------------------------------------------------------

export type AdminRange = "7d" | "30d" | "90d";
export type AdminSegment = "all" | "pro" | "free";
export type AdminSort = "newest" | "last_activity" | "streak";

export type AdminSubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "billing_issue"
  | "canceled"
  | "expired";

export type AdminProvider = "revenuecat" | "stripe" | "stub" | "admin";
export type AdminPlan = "monthly" | "weekly" | "yearly" | "lifetime";
export type AdminBackfillStatus = "not_started" | "running" | "complete" | "error";

export type AdminProductEvent =
  | "app_opened"
  | "onboarding_started"
  | "onboarding_step_viewed"
  | "account_created"
  | "onboarding_completed"
  | "natal_chart_viewed"
  | "daily_guide_viewed"
  | "daily_card_revealed"
  | "paywall_viewed"
  | "checkout_started"
  | "checkout_completed"
  | "checkout_failed"
  | "natal_chart_created"
  | "natal_interpretation_created"
  | "daily_guide_created"
  | "transit_reading_created"
  | "void_answer_created"
  | "saved_reading_created"
  | "journal_entry_created";

export type AdminAccount = {
  userId: string;
  clerkUserId: string;
  email?: string;
  name?: string;
  createdAt: number;
  onboardingCompletedAt?: number;
  isPro: boolean;
  status: AdminSubscriptionStatus;
  provider?: AdminProvider;
  plan?: AdminPlan;
  currentPeriodEnd?: number;
  isLifetime: boolean;
  lastActivityAt?: number;
  lastActivityDate?: string;
  currentStreak: number;
  longestStreak: number;
  activeDayCount: number;
  contentCreatedCount: number;
};

export type AdminDashboard = {
  range: AdminRange;
  totalAccounts: number;
  newAccounts: number;
  proAccounts: number;
  freeAccounts: number;
  activeToday: number;
  activeStreaks: number;
  contentCreated: number;
  voidAnswers: number;
  backfillStatus: AdminBackfillStatus;
  canManagePro: boolean;
};

export type AdminEffectiveAccess = {
  entitlement: "free" | "orbita_pro";
  isPro: boolean;
  status: AdminSubscriptionStatus;
  provider?: AdminProvider;
  plan?: AdminPlan;
  isLifetime: boolean;
  currentPeriodEnd?: number;
  willRenew?: boolean;
  canManageInStripePortal: boolean;
};

export type AdminManualGrant = {
  mode: "permanent" | "until";
  expiresAt?: number;
  updatedAt: number;
};

export type AdminVoidAnswer = {
  voidAnswerId: string;
  question: string;
  localDate: string;
  createdAt: number;
};

export type AdminAccountDetail = {
  account: AdminAccount;
  effectiveAccess: AdminEffectiveAccess;
  manualGrant?: AdminManualGrant;
  recentVoid: AdminVoidAnswer[];
};

export type AdminActivityEvent = {
  eventId: string;
  eventName: AdminProductEvent;
  occurredAt: number;
  localDate: string;
  entryPoint?: string;
  question?: string;
  backfilled: boolean;
};

export type AdminGrantResult = {
  manualGrantApplied: true;
  effectiveAccess: AdminEffectiveAccess;
  auditEventId: string;
};

export type AdminRevokeResult = {
  manualGrantRemoved: boolean;
  effectiveAccess: AdminEffectiveAccess;
  auditEventId: string;
};

// --- Opciones de consulta ---------------------------------------------------

export const ADMIN_RANGES: Array<{ value: AdminRange; label: string }> = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" }
];

export const ADMIN_SEGMENTS: Array<{ value: AdminSegment; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "pro", label: "Pro" },
  { value: "free", label: "Free" }
];

export const ADMIN_SORTS: Array<{ value: AdminSort; label: string }> = [
  { value: "newest", label: "Más nuevas" },
  { value: "last_activity", label: "Última actividad" },
  { value: "streak", label: "Racha" }
];

/** Cuántas filas pide cada página. El backend topea la búsqueda en 50. */
export const ADMIN_PAGE_SIZE = 25;
export const ADMIN_SEARCH_LIMIT = 25;
export const ADMIN_ACTIVITY_PAGE_SIZE = 20;

// --- Gate de queries --------------------------------------------------------

/**
 * Estado de una query reactiva de Convex, tal como lo entrega
 * `useQuery_experimental({ throwOnError: false })`.
 */
export type AdminQueryStatus = "pending" | "success" | "error";

export type AdminQueryState<T> =
  | { status: "pending" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

/**
 * `getDashboard` es la ÚNICA query que se dispara sin condiciones: es la que
 * prueba el acceso (allowlist + gate `ORBITA_ADMIN_ACCOUNTS_ENABLED`) y la única
 * que puede devolver un error legible. Las paginadas (`usePaginatedQuery`) no
 * tienen `throwOnError: false`: si salieran sin permiso, el error explotaría en
 * el render y la pantalla se caería entera en vez de mostrar el panel de
 * acceso denegado.
 *
 * Por eso todo lo demás queda en `"skip"` hasta que el dashboard responde OK.
 */
export function adminQueriesUnlocked(dashboardStatus: AdminQueryStatus): boolean {
  return dashboardStatus === "success";
}

/** `args` si el gate está abierto, `"skip"` si no. El literal que espera Convex. */
export function gatedArgs<Args>(unlocked: boolean, args: Args | null): Args | "skip" {
  return unlocked && args !== null ? args : "skip";
}

/** Un texto de búsqueda vale si, ya recortado, no quedó vacío. */
export function normalizeAdminSearch(raw: string): string {
  return raw.trim();
}

export function adminSearchIsActive(raw: string): boolean {
  return normalizeAdminSearch(raw).length > 0;
}

// --- Razón del grant --------------------------------------------------------

export const ADMIN_REASON_MIN = 3;
export const ADMIN_REASON_MAX = 240;

export type AdminReasonCheck =
  | { ok: true; reason: string }
  | { ok: false; error: string };

/**
 * La razón queda en `adminAuditEvents` para siempre: es la única explicación de
 * por qué una cuenta tuvo Pro sin haber pagado. Se recorta antes de medir —"   "
 * no es una razón— y se topea para que la auditoría siga siendo legible.
 */
export function checkAdminReason(raw: string): AdminReasonCheck {
  const reason = raw.trim();
  if (reason.length < ADMIN_REASON_MIN) {
    return { ok: false, error: `La razón necesita al menos ${ADMIN_REASON_MIN} caracteres.` };
  }
  if (reason.length > ADMIN_REASON_MAX) {
    return { ok: false, error: `La razón no puede pasar de ${ADMIN_REASON_MAX} caracteres.` };
  }
  return { ok: true, reason };
}

// --- Ventana del grant ------------------------------------------------------

export const ADMIN_DAY_MS = 24 * 60 * 60 * 1000;

export type AdminGrantPreset = "7d" | "30d" | "custom" | "permanent";

export const ADMIN_GRANT_PRESETS: Array<{ value: AdminGrantPreset; label: string }> = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "custom", label: "Fecha exacta" },
  { value: "permanent", label: "Permanente" }
];

export type AdminGrantWindow =
  | { ok: true; mode: "permanent"; expiresAt?: undefined }
  | { ok: true; mode: "until"; expiresAt: number }
  | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Una fecha elegida a mano vence al final de ese día, en UTC.
 *
 * Se fija UTC a propósito: el vencimiento se compara contra `Date.now()` en el
 * servidor, y anclarlo al huso del navegador haría que el mismo día elegido
 * significara instantes distintos según desde dónde se abra el backoffice.
 */
export function parseAdminExpiryDate(date: string): number | null {
  const trimmed = date.trim();
  if (!ISO_DATE.test(trimmed)) return null;
  const endOfDay = Date.parse(`${trimmed}T23:59:59.999Z`);
  if (Number.isNaN(endOfDay)) return null;
  // `2026-02-31` parsea en algunos motores: se exige el round-trip.
  if (new Date(endOfDay).toISOString().slice(0, 10) !== trimmed) return null;
  return endOfDay;
}

export function resolveAdminGrantWindow(input: {
  preset: AdminGrantPreset;
  customDate?: string;
  now: number;
}): AdminGrantWindow {
  if (input.preset === "permanent") return { ok: true, mode: "permanent" };
  if (input.preset === "7d") return { ok: true, mode: "until", expiresAt: input.now + 7 * ADMIN_DAY_MS };
  if (input.preset === "30d") return { ok: true, mode: "until", expiresAt: input.now + 30 * ADMIN_DAY_MS };

  const expiresAt = parseAdminExpiryDate(input.customDate ?? "");
  if (expiresAt === null) return { ok: false, error: "Escribí la fecha como AAAA-MM-DD." };
  if (expiresAt <= input.now) return { ok: false, error: "La fecha tiene que ser futura." };
  return { ok: true, mode: "until", expiresAt };
}

export type AdminGrantRequest = {
  userId: string;
  mode: "permanent" | "until";
  expiresAt?: number;
  reason: string;
};

export type AdminGrantDraft =
  | { ok: true; args: AdminGrantRequest }
  | { ok: false; errors: string[] };

/**
 * Arma los `args` de `adminAccounts.grantPro` o explica TODO lo que falta.
 *
 * Devuelve los errores juntos —no el primero— para no hacer ping-pong con quien
 * está completando el formulario.
 */
export function buildAdminGrantDraft(input: {
  userId: string;
  preset: AdminGrantPreset;
  customDate?: string;
  reason: string;
  now: number;
}): AdminGrantDraft {
  const errors: string[] = [];
  const window = resolveAdminGrantWindow(input);
  if (!window.ok) errors.push(window.error);
  const reason = checkAdminReason(input.reason);
  if (!reason.ok) errors.push(reason.error);
  if (!window.ok || !reason.ok) return { ok: false, errors };

  return {
    ok: true,
    args: {
      userId: input.userId,
      mode: window.mode,
      ...(window.mode === "until" ? { expiresAt: window.expiresAt } : {}),
      reason: reason.reason
    }
  };
}

// --- Permisos de escritura --------------------------------------------------

export const ADMIN_PRO_WRITES_DISABLED_HINT =
  "Las escrituras de Pro manual están apagadas en este deployment. Se habilitan con `ORBITA_ADMIN_PRO_WRITES_ENABLED=true` en Convex.";

export type AdminProControls = { disabled: boolean; explanation?: string };

/** Los controles de Pro se deshabilitan —no se esconden— con su motivo al lado. */
export function adminProControls(canManagePro: boolean): AdminProControls {
  return canManagePro ? { disabled: false } : { disabled: true, explanation: ADMIN_PRO_WRITES_DISABLED_HINT };
}

// --- Etiquetas --------------------------------------------------------------

const PROVIDER_LABELS: Record<AdminProvider, string> = {
  admin: "grant manual",
  revenuecat: "RevenueCat",
  stripe: "Stripe",
  stub: "stub de desarrollo"
};

export function adminProviderLabel(provider?: AdminProvider): string {
  return provider ? PROVIDER_LABELS[provider] : "sin proveedor";
}

const STATUS_LABELS: Record<AdminSubscriptionStatus, string> = {
  active: "activa",
  billing_issue: "problema de cobro",
  canceled: "cancelada",
  expired: "vencida",
  inactive: "inactiva",
  past_due: "impaga",
  trialing: "en prueba"
};

export function adminStatusLabel(status: AdminSubscriptionStatus): string {
  return STATUS_LABELS[status];
}

const PLAN_LABELS: Record<AdminPlan, string> = {
  lifetime: "lifetime",
  monthly: "mensual",
  weekly: "semanal",
  yearly: "anual"
};

export function adminPlanLabel(plan?: AdminPlan): string | undefined {
  return plan ? PLAN_LABELS[plan] : undefined;
}

const EVENT_LABELS: Record<AdminProductEvent, string> = {
  account_created: "Cuenta creada",
  app_opened: "Abrió la app",
  checkout_completed: "Checkout completado",
  checkout_failed: "Checkout fallido",
  checkout_started: "Checkout iniciado",
  daily_card_revealed: "Sacó la carta del día",
  daily_guide_created: "Guía diaria generada",
  daily_guide_viewed: "Vio la guía diaria",
  journal_entry_created: "Entrada de diario",
  natal_chart_created: "Carta natal calculada",
  natal_chart_viewed: "Vio la carta natal",
  natal_interpretation_created: "Lectura natal generada",
  onboarding_completed: "Alta completada",
  onboarding_started: "Alta iniciada",
  onboarding_step_viewed: "Paso del alta",
  paywall_viewed: "Vio el paywall",
  saved_reading_created: "Guardó una lectura",
  transit_reading_created: "Lectura de tránsito",
  void_answer_created: "Pregunta al Umbral"
};

export function adminEventLabel(eventName: AdminProductEvent): string {
  return EVENT_LABELS[eventName] ?? eventName;
}

export function adminAccountName(account: AdminAccount): string {
  return account.name?.trim() || account.email?.trim() || account.clerkUserId;
}

// --- Formato ----------------------------------------------------------------

export function formatAdminDateTime(value?: number): string {
  if (value === undefined) return "—";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function formatAdminDate(value?: number): string {
  if (value === undefined) return "—";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(new Date(value));
}

/**
 * Días enteros transcurridos entre dos instantes. Sirve para decir "hace 3
 * días" sin arrastrar una librería de fechas.
 */
export function adminDaysSince(value: number, now: number): number {
  return Math.max(0, Math.floor((now - value) / ADMIN_DAY_MS));
}

export function formatAdminLastActivity(account: AdminAccount, now: number): string {
  if (account.lastActivityAt === undefined) return "Sin actividad";
  const days = adminDaysSince(account.lastActivityAt, now);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

// --- Tarjetas del dashboard -------------------------------------------------

export type AdminMetric = { key: string; label: string; value: string; detail?: string };

/**
 * Las métricas del rango elegido. `totalAccounts`/`proAccounts`/`freeAccounts`
 * son globales (no dependen del rango) y se etiquetan como tales para que nadie
 * lea "7 días" donde dice "total".
 */
export function adminDashboardMetrics(dashboard: AdminDashboard): AdminMetric[] {
  const rangeLabel = ADMIN_RANGES.find((option) => option.value === dashboard.range)?.label ?? dashboard.range;
  return [
    { key: "totalAccounts", label: "Cuentas", value: String(dashboard.totalAccounts), detail: "Total histórico" },
    { key: "newAccounts", label: "Altas", value: String(dashboard.newAccounts), detail: `Últimos ${rangeLabel}` },
    { key: "proAccounts", label: "Pro", value: String(dashboard.proAccounts), detail: "Total histórico" },
    { key: "freeAccounts", label: "Free", value: String(dashboard.freeAccounts), detail: "Total histórico" },
    { key: "activeToday", label: "Activas hoy", value: String(dashboard.activeToday), detail: "Día local" },
    { key: "activeStreaks", label: "Rachas vivas", value: String(dashboard.activeStreaks), detail: "Hoy o ayer" },
    {
      key: "contentCreated",
      label: "Contenido creado",
      value: String(dashboard.contentCreated),
      detail: `Últimos ${rangeLabel}`
    },
    { key: "voidAnswers", label: "Umbral", value: String(dashboard.voidAnswers), detail: `Últimos ${rangeLabel}` }
  ];
}

const BACKFILL_NOTICES: Record<AdminBackfillStatus, string | null> = {
  complete: null,
  error: "El backfill de cuentas terminó con error: los totales pueden estar incompletos.",
  not_started: "El backfill de cuentas todavía no corrió: los totales sólo cuentan la actividad nueva.",
  running: "El backfill de cuentas está corriendo: los totales van a seguir cambiando."
};

export function adminBackfillNotice(status: AdminBackfillStatus): string | null {
  return BACKFILL_NOTICES[status];
}

// --- Acceso efectivo --------------------------------------------------------

export type AdminAccessSummary = {
  label: "Pro" | "Free";
  isPro: boolean;
  provider?: AdminProvider;
  detail: string;
};

/**
 * Cómo se lee el acceso REAL de una cuenta. Nunca se deriva del grant manual:
 * si Stripe está activo, el proveedor que manda es Stripe aunque haya un grant.
 */
export function describeAdminAccess(access: AdminEffectiveAccess): AdminAccessSummary {
  const parts: string[] = [];
  parts.push(`Estado ${adminStatusLabel(access.status)}`);
  if (access.provider) parts.push(`por ${adminProviderLabel(access.provider)}`);
  const plan = adminPlanLabel(access.plan);
  if (plan) parts.push(`plan ${plan}`);
  if (access.isLifetime) parts.push("sin vencimiento");
  else if (access.currentPeriodEnd !== undefined) parts.push(`hasta ${formatAdminDateTime(access.currentPeriodEnd)}`);
  if (access.willRenew === true) parts.push("renueva");
  if (access.willRenew === false) parts.push("no renueva");

  return {
    label: access.isPro ? "Pro" : "Free",
    isPro: access.isPro,
    provider: access.provider,
    detail: parts.join(" · ")
  };
}

export function describeAdminManualGrant(grant?: AdminManualGrant): string {
  if (!grant) return "Sin grant manual activo.";
  if (grant.mode === "permanent") return `Grant manual permanente, actualizado el ${formatAdminDateTime(grant.updatedAt)}.`;
  return `Grant manual hasta el ${formatAdminDateTime(grant.expiresAt)}, actualizado el ${formatAdminDateTime(grant.updatedAt)}.`;
}

// --- Resultado honesto de las mutaciones ------------------------------------

export const ADMIN_REVOKE_WARNING =
  "Revocar sólo apaga el grant manual de Órbita. NO cancela una suscripción de Stripe ni de RevenueCat: si la cuenta paga por ahí, va a seguir siendo Pro y hay que cancelarla en ese proveedor.";

export type AdminMutationOutcome = { tone: "ok" | "warning"; title: string; detail: string };

/**
 * Qué pasó de verdad al revocar, leído de la respuesta del backend.
 *
 * El caso que este mensaje existe para no tapar: el grant manual se borra, la
 * mutación devuelve `manualGrantRemoved: true`… y la cuenta sigue Pro porque
 * paga por Stripe. Decir "listo, quedó Free" ahí sería mentir.
 */
export function describeAdminRevokeOutcome(result: AdminRevokeResult): AdminMutationOutcome {
  const access = result.effectiveAccess;
  if (access.isPro) {
    return {
      tone: "warning",
      title: "Revocado, pero la cuenta sigue Pro",
      detail: `El grant manual ${result.manualGrantRemoved ? "se revocó" : "ya no estaba activo"}, pero el acceso efectivo sigue siendo Pro por ${adminProviderLabel(access.provider)}. Órbita no cancela esa suscripción: hay que darla de baja en ${adminProviderLabel(access.provider)}.`
    };
  }
  return {
    tone: "ok",
    title: result.manualGrantRemoved ? "Grant manual revocado" : "No había grant manual activo",
    detail: `El acceso efectivo quedó Free (${adminStatusLabel(access.status)}).`
  };
}

export function describeAdminGrantOutcome(result: AdminGrantResult): AdminMutationOutcome {
  const access = result.effectiveAccess;
  if (!access.isPro) {
    return {
      tone: "warning",
      title: "Se guardó el grant, pero el acceso sigue Free",
      detail: `El backend devolvió estado ${adminStatusLabel(access.status)}. Revisá la ventana elegida antes de avisarle a la persona.`
    };
  }
  if (access.provider && access.provider !== "admin") {
    return {
      tone: "warning",
      title: "Pro aplicado, pero manda otro proveedor",
      detail: `El acceso efectivo es Pro por ${adminProviderLabel(access.provider)}, no por el grant manual. La cuenta ya tenía una suscripción vigente.`
    };
  }
  return {
    tone: "ok",
    title: "Pro manual aplicado",
    detail: `Acceso efectivo Pro por ${adminProviderLabel(access.provider)} · ${describeAdminAccess(access).detail}.`
  };
}

// --- Errores del backend ----------------------------------------------------

export type AdminErrorCopy = { title: string; detail: string; denied: boolean };

/**
 * Traduce los errores del backoffice a algo accionable.
 *
 * `denied: true` marca los que NO son un fallo transitorio: la pantalla los
 * muestra como panel de acceso, sin botón de reintentar.
 */
export function describeAdminError(message: string): AdminErrorCopy {
  if (message.includes("ADMIN_ACCOUNTS_DISABLED")) {
    return {
      denied: true,
      title: "Cuentas está apagado",
      detail: "Este deployment tiene el backoffice de cuentas cerrado. Se abre con `ORBITA_ADMIN_ACCOUNTS_ENABLED=true` en Convex."
    };
  }
  if (message.includes("ADMIN_PRO_WRITES_DISABLED")) {
    return { denied: false, title: "Pro manual apagado", detail: ADMIN_PRO_WRITES_DISABLED_HINT };
  }
  if (message.includes("ADMIN_PRO_REASON_REQUIRED")) {
    return { denied: false, title: "Falta la razón", detail: "El backend rechazó el grant: la razón no puede quedar vacía." };
  }
  if (message.includes("ADMIN_PRO_EXPIRY_INVALID")) {
    return { denied: false, title: "Fecha inválida", detail: "El backend rechazó el vencimiento: tiene que ser posterior a ahora." };
  }
  if (message.includes("ADMIN_ACCOUNT_NOT_FOUND")) {
    return { denied: false, title: "Cuenta inexistente", detail: "La cuenta ya no está en la base. Volvé a buscarla." };
  }
  if (message.includes("allowlist is not configured")) {
    return {
      denied: true,
      title: "Allowlist no configurada",
      detail: "Falta `ORBITA_BACKOFFICE_ALLOWED_EMAILS` en el deployment de Convex."
    };
  }
  if (message.includes("not allowed")) {
    return {
      denied: true,
      title: "Email no habilitado",
      detail: "La sesión está autenticada, pero el email no está en `ORBITA_BACKOFFICE_ALLOWED_EMAILS`."
    };
  }
  if (message.includes("Authentication required")) {
    return {
      denied: true,
      title: "Convex no recibió tu sesión",
      detail: "Clerk tiene sesión pero Convex no recibió un JWT válido. Revisá el template `convex` en Clerk."
    };
  }
  return { denied: false, title: "No se pudo completar", detail: message };
}
