type StripeSubscriptionItemLike = {
  current_period_end?: unknown;
};

export type StripeSubscriptionLike = {
  cancel_at_period_end?: unknown;
  cancel_at?: unknown;
  current_period_end?: unknown;
  trial_end?: unknown;
  items?: {
    data?: StripeSubscriptionItemLike[];
  };
};

function unixSecondsToMilliseconds(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value * 1000
    : undefined;
}

export function stripeSubscriptionLifecycle(
  subscription: StripeSubscriptionLike
): {
  cancellationScheduled: boolean;
  currentPeriodEnd?: number;
} {
  const cancelAt = unixSecondsToMilliseconds(subscription.cancel_at);
  const subscriptionPeriodEnd = unixSecondsToMilliseconds(
    subscription.current_period_end
  );
  const itemPeriodEnd = unixSecondsToMilliseconds(
    subscription.items?.data?.[0]?.current_period_end
  );
  const trialEnd = unixSecondsToMilliseconds(subscription.trial_end);

  return {
    cancellationScheduled:
      Boolean(subscription.cancel_at_period_end) || cancelAt !== undefined,
    // Stripe API 2025-03-31.basil moved billing periods from Subscription to
    // Subscription Item. A scheduled `cancel_at` is the real access end and
    // therefore takes precedence when present.
    currentPeriodEnd:
      cancelAt ?? subscriptionPeriodEnd ?? itemPeriodEnd ?? trialEnd
  };
}
