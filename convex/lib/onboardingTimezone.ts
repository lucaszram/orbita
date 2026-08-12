export type TimezonePlaceCandidate = {
  timezone?: string;
  latitude?: number;
  longitude?: number;
};

/** Identidad estable del lugar exacto que un worker está enriqueciendo. */
export function timezoneResolutionKey(
  birthPlaceLabel: string,
  latitude: number,
  longitude: number
): string {
  return JSON.stringify([birthPlaceLabel.trim(), latitude, longitude]);
}

const RETRY_DELAYS_MS = [
  1_000,
  5_000,
  30_000,
  2 * 60_000,
  10 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
  12 * 60 * 60_000
] as const;

/**
 * Backoff durable para enriquecer un borrador natal.
 *
 * El alta nunca depende de que el proveedor responda en el primer intento. El
 * último valor se mantiene acotado: una apertura/edición posterior vuelve a
 * programar el trabajo y no crea un loop caliente de jobs.
 */
export function timezoneRetryDelayMs(attempt: number): number {
  const index = Math.max(0, Math.min(Math.trunc(attempt), RETRY_DELAYS_MS.length - 1));
  return RETRY_DELAYS_MS[index];
}

/**
 * El lookup puede devolver varias ciudades con el mismo nombre. Si ya tenemos
 * las coordenadas elegidas por la persona, gana el resultado más cercano; sin
 * coordenadas comparables, se conserva el primer timezone válido del proveedor.
 */
export function pickTimezoneCandidate(
  candidates: TimezonePlaceCandidate[],
  latitude?: number,
  longitude?: number
): string | null {
  const valid = candidates.filter(
    (candidate): candidate is TimezonePlaceCandidate & { timezone: string } =>
      typeof candidate.timezone === "string" && candidate.timezone.trim().length > 0
  );
  if (valid.length === 0) return null;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return valid[0].timezone.trim();
  }

  const comparable = valid.filter(
    (candidate): candidate is TimezonePlaceCandidate & {
      timezone: string;
      latitude: number;
      longitude: number;
    } => Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude)
  );
  if (comparable.length === 0) return valid[0].timezone.trim();

  comparable.sort((a, b) => {
    const aDistance = (a.latitude - latitude!) ** 2 + (a.longitude - longitude!) ** 2;
    const bDistance = (b.latitude - latitude!) ** 2 + (b.longitude - longitude!) ** 2;
    return aDistance - bDistance;
  });
  return comparable[0].timezone.trim();
}
