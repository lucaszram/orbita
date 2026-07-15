import { ASTROLOGY_API_CHART_CALCULATION_VERSION } from "./orbita";

export type BirthDataForHash = {
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: string;
  birthPlaceLabel: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
};

function roundedCoordinate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}

/** Identifica la carta que corresponde exactamente a los datos natales vigentes. */
export function buildBirthDataHash(birthData: BirthDataForHash): string {
  return JSON.stringify({
    birthDate: birthData.birthDate,
    birthTime: birthData.birthTime ?? null,
    birthTimePrecision: birthData.birthTimePrecision,
    birthPlaceLabel: birthData.birthPlaceLabel,
    latitude: roundedCoordinate(birthData.latitude),
    longitude: roundedCoordinate(birthData.longitude),
    timezone: birthData.timezone
  });
}

export function buildNatalChartCacheKey(userId: string, birthDataHash: string): string {
  return `natal:${ASTROLOGY_API_CHART_CALCULATION_VERSION}:${userId}:${birthDataHash}`;
}

type DailyReadingIdentity = {
  natalChartId?: unknown;
  timezone: string;
  contentVersion: string;
};

/** Una lectura diaria solo se reutiliza si todavía pertenece a la carta vigente. */
export function dailyReadingNeedsRefresh(
  existing: DailyReadingIdentity | null,
  currentChartId: unknown,
  timezone: string,
  contentVersion: string
): boolean {
  if (!existing) return false;
  return (
    existing.natalChartId !== currentChartId ||
    existing.timezone !== timezone ||
    existing.contentVersion !== contentVersion
  );
}
