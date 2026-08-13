/**
 * Rate limit por ventana fija, sin estado en memoria (los isolates de Convex no
 * lo conservan). La decisión es pura y testeable; la persistencia del contador
 * vive en `publicRateLimits` (ver `convex/publicOnboarding.ts`).
 */
export type RateLimitConfig = {
  /** Espacio de nombres del límite: "onboarding_triad:draft", etc. */
  scope: string;
  /** Tamaño de la ventana en ms. */
  windowMs: number;
  /** Llamadas permitidas dentro de la ventana. */
  max: number;
};

export type RateLimitBucket = {
  count: number;
  windowStartedAt: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  /** Contador que debe quedar persistido si se permite la llamada. */
  nextCount: number;
  windowStartedAt: number;
  expiresAt: number;
  /** Cuánto falta para que la ventana se renueve (0 si se permitió). */
  retryAfterMs: number;
};

export function buildRateLimitBucketKey(scope: string, subject: string, now: number, windowMs: number): string {
  const window = Math.floor(now / windowMs);
  return `${scope}:${windowMs}:${window}:${subject}`;
}

/** Positivo, finito y acotado; cualquier configuración inválida cae al default. */
export function resolvePositiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

export function evaluateRateLimit(args: {
  existing: RateLimitBucket | null;
  now: number;
  config: RateLimitConfig;
}): RateLimitDecision {
  const { existing, now, config } = args;
  const windowStartedAt = Math.floor(now / config.windowMs) * config.windowMs;
  const expiresAt = windowStartedAt + config.windowMs;
  // Un documento de una ventana anterior (mismo bucketKey no puede pasar, pero
  // sí un doc reciclado) se trata como ventana nueva.
  const current = existing && existing.windowStartedAt === windowStartedAt ? existing : null;
  const count = current?.count ?? 0;

  if (count >= config.max) {
    return {
      allowed: false,
      nextCount: count,
      windowStartedAt,
      expiresAt,
      retryAfterMs: Math.max(1, expiresAt - now)
    };
  }

  return {
    allowed: true,
    nextCount: count + 1,
    windowStartedAt,
    expiresAt,
    retryAfterMs: 0
  };
}
