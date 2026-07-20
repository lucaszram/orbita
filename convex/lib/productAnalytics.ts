export const ANALYTICS_TIMEZONE = "America/Argentina/Buenos_Aires";

export const FRONTEND_PRODUCT_EVENTS = [
  "app_opened",
  "onboarding_started",
  "onboarding_step_viewed",
  "natal_chart_viewed",
  "daily_guide_viewed",
  "paywall_viewed",
  "checkout_started"
] as const;

export const BACKEND_PRODUCT_EVENTS = [
  "account_created",
  "onboarding_completed",
  "daily_card_revealed"
] as const;

export type FrontendProductEventName = (typeof FRONTEND_PRODUCT_EVENTS)[number];
export type BackendProductEventName = (typeof BACKEND_PRODUCT_EVENTS)[number];
export type ProductEventName = FrontendProductEventName | BackendProductEventName;

export type DailyDigestMetrics = {
  reportDate: string;
  opened: number;
  openedNew: number;
  openedReturning: number;
  onboardingCompleted: number;
  cardsRevealed: number;
  cardsRevealedNew: number;
  cardsRevealedReturning: number;
  d1Returned: number;
  d1Cohort: number;
  previousActiveReturned: number;
  previousActive: number;
};

type MetricActor = {
  _id: string;
  installationId: string;
  userId?: string;
  firstOpenedDate?: string;
};

type MetricEvent = {
  eventName: ProductEventName;
  actorId?: string;
  userId?: string;
  installationId?: string;
};

type MetricUser = {
  _id: string;
  createdAt: number;
};

function dateParts(timestamp: number, timeZone = ANALYTICS_TIMEZONE): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

export function analyticsLocalDate(timestamp = Date.now()): string {
  const parts = dateParts(timestamp);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shiftIsoDate(localDate: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw new Error("Invalid local date");
  }
  const date = new Date(`${localDate}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid local date");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function assertOpaqueAnalyticsId(label: string, value: string): void {
  if (value.length < 8 || value.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

export function assertSafeEntryPoint(value: string | undefined): void {
  if (value === undefined) return;
  if (value.length < 1 || value.length > 64 || !/^[a-z0-9_:/.-]+$/.test(value)) {
    throw new Error("Invalid entryPoint");
  }
}

export async function recordBackendProductEvent(
  ctx: { db: any },
  args: {
    eventName: BackendProductEventName;
    userId: any;
    dedupeKey: string;
    occurredAt?: number;
  }
): Promise<boolean> {
  assertOpaqueAnalyticsId("dedupeKey", args.dedupeKey);
  const eventId = `backend:${args.eventName}:${args.dedupeKey}`;
  const existing = await ctx.db
    .query("productEvents")
    .withIndex("by_event_id", (q: any) => q.eq("eventId", eventId))
    .first();
  if (existing) return false;

  const occurredAt = args.occurredAt ?? Date.now();
  await ctx.db.insert("productEvents", {
    eventId,
    eventName: args.eventName,
    source: "backend",
    userId: args.userId,
    localDate: analyticsLocalDate(occurredAt),
    occurredAt
  });
  return true;
}

function percent(numerator: number, denominator: number): string {
  return denominator === 0 ? "—" : `${Math.round((numerator / denominator) * 100)}%`;
}

function displayDate(localDate: string): string {
  const [, month, day] = localDate.split("-");
  return `${day}/${month}`;
}

export function formatDailyDigest(metrics: DailyDigestMetrics): string {
  return [
    `📊 Órbita — resumen del ${displayDate(metrics.reportDate)}`,
    "",
    `👥 Abrieron la app: ${metrics.opened}`,
    `├ Nuevos: ${metrics.openedNew}`,
    `└ Recurrentes: ${metrics.openedReturning}`,
    `🆕 Onboarding completado: ${metrics.onboardingCompleted}`,
    "",
    `🪐 Desbloquearon su carta: ${metrics.cardsRevealed}`,
    `├ Nuevos: ${metrics.cardsRevealedNew}`,
    `└ Recurrentes: ${metrics.cardsRevealedReturning}`,
    "",
    `↩️ Retención D1: ${percent(metrics.d1Returned, metrics.d1Cohort)} (${metrics.d1Returned} de ${metrics.d1Cohort})`,
    `🔥 Activos de ayer que volvieron: ${percent(metrics.previousActiveReturned, metrics.previousActive)} (${metrics.previousActiveReturned} de ${metrics.previousActive})`
  ].join("\n");
}

export function computeDailyDigestMetrics(args: {
  reportDate: string;
  previousDate: string;
  currentEvents: MetricEvent[];
  previousEvents: MetricEvent[];
  actors: MetricActor[];
  users: MetricUser[];
}): DailyDigestMetrics {
  const actorById = new Map(args.actors.map((actor) => [String(actor._id), actor]));
  const actorByInstallation = new Map(args.actors.map((actor) => [actor.installationId, actor]));
  const userCreatedDate = new Map(
    args.users.map((user) => [String(user._id), analyticsLocalDate(user.createdAt)])
  );
  const firstOpenedByUser = new Map<string, string>();

  for (const actor of args.actors) {
    if (!actor.userId || !actor.firstOpenedDate) continue;
    const key = String(actor.userId);
    const previous = firstOpenedByUser.get(key);
    if (!previous || actor.firstOpenedDate < previous) {
      firstOpenedByUser.set(key, actor.firstOpenedDate);
    }
  }

  const actorForEvent = (event: MetricEvent): MetricActor | undefined => {
    if (event.actorId) return actorById.get(String(event.actorId));
    if (event.installationId) return actorByInstallation.get(event.installationId);
    return undefined;
  };

  const keyForEvent = (event: MetricEvent): string | null => {
    if (event.userId) return `user:${event.userId}`;
    const actor = actorForEvent(event);
    if (actor?.userId) return `user:${actor.userId}`;
    const installationId = actor?.installationId ?? event.installationId;
    return installationId ? `install:${installationId}` : null;
  };

  const firstOpenedForEvent = (event: MetricEvent): string | undefined => {
    const userId = event.userId ?? actorForEvent(event)?.userId;
    if (userId) {
      return firstOpenedByUser.get(String(userId)) ?? userCreatedDate.get(String(userId));
    }
    return actorForEvent(event)?.firstOpenedDate;
  };

  const uniqueKeys = (events: MetricEvent[], eventName: ProductEventName): Set<string> => {
    const keys = new Set<string>();
    for (const event of events) {
      if (event.eventName !== eventName) continue;
      const key = keyForEvent(event);
      if (key) keys.add(key);
    }
    return keys;
  };

  const currentOpenedEvents = args.currentEvents.filter((event) => event.eventName === "app_opened");
  const previousOpenedEvents = args.previousEvents.filter((event) => event.eventName === "app_opened");
  const currentOpened = uniqueKeys(args.currentEvents, "app_opened");
  const previousOpened = uniqueKeys(args.previousEvents, "app_opened");
  const onboardingCompleted = uniqueKeys(args.currentEvents, "onboarding_completed");
  const cardsRevealed = uniqueKeys(args.currentEvents, "daily_card_revealed");

  const currentNew = new Set<string>();
  for (const event of currentOpenedEvents) {
    const key = keyForEvent(event);
    if (key && firstOpenedForEvent(event) === args.reportDate) currentNew.add(key);
  }

  const previousNew = new Set<string>();
  for (const event of previousOpenedEvents) {
    const key = keyForEvent(event);
    if (key && firstOpenedForEvent(event) === args.previousDate) previousNew.add(key);
  }

  const revealedNew = new Set<string>();
  for (const event of args.currentEvents) {
    if (event.eventName !== "daily_card_revealed") continue;
    const key = keyForEvent(event);
    if (key && firstOpenedForEvent(event) === args.reportDate) revealedNew.add(key);
  }

  const d1Returned = [...previousNew].filter((key) => currentOpened.has(key)).length;
  const previousActiveReturned = [...previousOpened].filter((key) => currentOpened.has(key)).length;

  return {
    reportDate: args.reportDate,
    opened: currentOpened.size,
    openedNew: currentNew.size,
    openedReturning: currentOpened.size - currentNew.size,
    onboardingCompleted: onboardingCompleted.size,
    cardsRevealed: cardsRevealed.size,
    cardsRevealedNew: revealedNew.size,
    cardsRevealedReturning: cardsRevealed.size - revealedNew.size,
    d1Returned,
    d1Cohort: previousNew.size,
    previousActiveReturned,
    previousActive: previousOpened.size
  };
}
