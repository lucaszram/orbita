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

/** Selecciona una única autoridad natal para todos los consumidores.
 *
 * Aunque el flujo normal mantiene una fila por usuario, datos históricos o una
 * carrera de versiones anteriores pueden dejar más de una. Todos los módulos
 * deben mirar la misma fila más reciente; mezclar `.first()` con
 * `.order("desc").first()` puede hacer que Perfil y Carta hablen de personas
 * natales distintas.
 */
export async function findCurrentBirthData(ctx: any, userId: string) {
  return await ctx.db
    .query("birthData")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();
}

/** Devuelve únicamente la carta que corresponde al payload natal vigente. */
export async function findExactNatalChart(ctx: any, userId: string, birthData: BirthDataForHash | null | undefined) {
  if (!birthData) return null;
  const cacheKey = buildNatalChartCacheKey(userId, buildBirthDataHash(birthData));
  return await ctx.db
    .query("natalCharts")
    .withIndex("by_cacheKey", (q: any) => q.eq("cacheKey", cacheKey))
    .first();
}

/** Carta vigente completa: sin fila natal no se rescata una carta histórica. */
export async function findCurrentNatalChart(ctx: any, userId: string) {
  const birthData = await findCurrentBirthData(ctx, userId);
  return await findExactNatalChart(ctx, userId, birthData);
}

type NatalBoundDocument = {
  natalChartId?: unknown;
};

type NatalChartIdentity = {
  _id: unknown;
};

/** Un cache personalizado solo es reutilizable si nombra explícitamente la
 *  carta que corresponde a los datos natales vigentes. `undefined ===
 *  undefined` no alcanza: durante una edición eso volvería a servir un cache
 *  anterior mientras la carta nueva todavía se está calculando. */
export function belongsToNatalChart(
  document: NatalBoundDocument | null | undefined,
  natalChart: NatalChartIdentity | null | undefined
): boolean {
  return Boolean(document && natalChart && document.natalChartId === natalChart._id);
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
