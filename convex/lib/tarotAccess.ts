export const FREE_TAROT_REVEAL_LIMIT = 7;
export const FREE_TAROT_REVEAL_LIMIT_REACHED = "FREE_TAROT_REVEAL_LIMIT_REACHED";

/**
 * Decide si una revelación NUEVA puede consumir otro día del archivo Free.
 * La idempotencia de una carta ya revelada se resuelve antes de llamar acá.
 */
export function canRevealNewTarotCard({
  isPro,
  revealedCount
}: {
  isPro: boolean;
  revealedCount: number;
}): boolean {
  return isPro || revealedCount < FREE_TAROT_REVEAL_LIMIT;
}
