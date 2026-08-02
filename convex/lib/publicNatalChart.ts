import { extractNormalizedChartFromPayload } from "./orbita";

/**
 * Construye el documento público de `charts.current` en la forma que consumen
 * la app instalada y la web publicada.
 *
 * La carta queda plana dentro de `payload`: los clientes comparten un mapper
 * que lee `payload.placements`, `payload.houses`, `payload.aspects` y
 * `payload.summary`. Los datos natales y el offset exacto siguen privados.
 */
export function buildPublicNatalChartDocument(chart: any, isPro: boolean) {
  const normalized = extractNormalizedChartFromPayload(chart?.payload);
  if (!normalized) {
    return {
      _id: chart._id,
      calculationVersion: chart.calculationVersion,
      providerVersion: chart.providerVersion,
      createdAt: chart.createdAt,
      updatedAt: chart.updatedAt,
      payload: null
    };
  }

  const {
    birth: _birth,
    timezoneOffset: _timezoneOffset,
    ...publicNormalized
  } = normalized;
  const placements = normalized.placements.map((placement) => ({
    ...placement,
    house: isPro ? placement.house : null
  }));
  const byKey = new Map(placements.map((placement) => [placement.key, placement]));
  const safeNormalized = {
    ...publicNormalized,
    placements,
    houses: isPro ? normalized.houses : [],
    aspects: isPro ? normalized.aspects : [],
    summary: {
      ...normalized.summary,
      sun: byKey.get("sun") ?? null,
      moon: byKey.get("moon") ?? null,
      ascendant: byKey.get("ascendant") ?? null,
      mainAspects: isPro ? normalized.summary.mainAspects : []
    }
  };

  return {
    _id: chart._id,
    calculationVersion: chart.calculationVersion,
    providerVersion: chart.providerVersion,
    createdAt: chart.createdAt,
    updatedAt: chart.updatedAt,
    access: { isPro, houses: isPro, aspects: isPro },
    payload: safeNormalized
  };
}
