/**
 * Traduce el payload real de `charts.current` (AstrologyAPI) al
 * `NatalChartPayload` que consumen la rueda, la tabla y las lecturas.
 *
 * Vivía dentro de `src/components/web/orbita-chart.tsx`, así que SEIS pantallas
 * nativas importaban desde una pantalla web. Con esa dependencia invertida no
 * se podía retirar la implementación web duplicada sin romper el nativo.
 * Es una función pura: su lugar es el dominio.
 */
import type { NatalChartAspect, NatalChartPayload, SignPlacement } from "@/services/appRefs";

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const HARMONY_BY_TYPE: Record<string, "harmony" | "tension"> = {
  trine: "harmony", sextile: "harmony", conjunction: "harmony",
  square: "tension", opposition: "tension", quincunx: "tension", inconjunct: "tension"
};

/** Traduce el payload real de `charts.current` (AstrologyAPI) a `NatalChartPayload`. */
export function mapNatalChart(doc: unknown): NatalChartPayload {
  const p = ((doc as { payload?: unknown })?.payload ?? doc ?? {}) as Record<string, unknown>;
  const raw: Array<Record<string, unknown>> = Array.isArray(p.placements) ? (p.placements as Array<Record<string, unknown>>) : [];
  const noon = p.calculationTimeSource === "noon_fallback";
  const find = (k: string) => raw.find((x) => x.key === k);
  const signOf = (x?: Record<string, unknown>) => cap((x?.signEs as string) ?? (x?.sign as string));
  const houseOf = (x?: Record<string, unknown>) => (typeof x?.house === "number" ? (x.house as number) : undefined);
  const numOr = (v: unknown) => (typeof v === "number" ? v : undefined);

  const toPlacement = (x?: Record<string, unknown>, fallbackPlanet?: string): SignPlacement => ({
    planet: (x?.label as string) ?? fallbackPlanet ?? (x?.key as string) ?? "",
    key: (x?.key as string) ?? undefined,
    sign: signOf(x),
    house: houseOf(x),
    degree: numOr(x?.fullDegree), // compat: la rueda vieja lee `degree` como longitud
    fullDegree: numOr(x?.fullDegree),
    normDegree: numOr(x?.degree),
    isRetrograde: typeof x?.isRetrograde === "boolean" ? (x.isRetrograde as boolean) : undefined
  });

  // Sin hora válida no hay Asc/casas fiables → los sacamos de la lista.
  const skip = new Set(noon ? ["ascendant", "midheaven"] : []);
  const placements = raw.filter((x) => !skip.has(x.key as string)).map((x) => toPlacement(x));

  const sun = find("sun"), moon = find("moon"), asc = find("ascendant");
  const triad = {
    sun: { ...toPlacement(sun, "Sol"), planet: "Sol", sign: signOf(sun) || "—" },
    moon: { ...toPlacement(moon, "Luna"), planet: "Luna", sign: signOf(moon) || "—" },
    ascendant: { ...toPlacement(asc, "Ascendente"), planet: "Ascendente", sign: noon || !asc ? "—" : signOf(asc) }
  };

  const byKey: Record<string, string> = {};
  raw.forEach((x) => { byKey[x.key as string] = (x.label as string) ?? (x.key as string); });
  const mapAspect = (a: Record<string, unknown>): NatalChartAspect => ({
    from: byKey[a.from as string] ?? (a.from as string),
    to: byKey[a.to as string] ?? (a.to as string),
    type: (a.type as string) ?? "",
    typeEs: (a.typeEs as string) ?? undefined,
    harmony: HARMONY_BY_TYPE[a.type as string] ?? "harmony",
    orb: numOr(a.orb),
    isMajor: typeof a.isMajor === "boolean" ? (a.isMajor as boolean) : undefined
  });
  const withNames = (a: Record<string, unknown>) => byKey[a.from as string] && byKey[a.to as string];
  const aspects = (Array.isArray(p.aspects) ? (p.aspects as Array<Record<string, unknown>>) : [])
    .filter(withNames)
    .map(mapAspect);

  const houses = (Array.isArray(p.houses) ? (p.houses as Array<Record<string, unknown>>) : [])
    .map((h) => ({
      house: (h.house as number) ?? (h.number as number),
      sign: signOf(h),
      cusp: numOr(h.degree),
      theme: (h.theme as string) ?? undefined
    }));

  const summary = (p.summary ?? {}) as Record<string, unknown>;
  const summaryAsc = summary.ascendant as Record<string, unknown> | undefined;
  const ascendantDegree = houses.find((h) => h.house === 1)?.cusp ?? numOr(summaryAsc?.fullDegree);
  const mc = houses.find((h) => h.house === 10)?.cusp;
  const mainAspects = (Array.isArray(summary.mainAspects) ? (summary.mainAspects as Array<Record<string, unknown>>) : [])
    .filter(withNames)
    .map(mapAspect);

  return {
    triad,
    placements,
    houses,
    aspects,
    ascendantDegree: noon ? undefined : ascendantDegree,
    mc: noon ? undefined : mc,
    mainAspects: mainAspects.length ? mainAspects : undefined,
    accuracy: noon ? "Hora aproximada · ascendente y casas pendientes" : "Hora exacta · ascendente afinado",
    limitations: Array.isArray(summary.limitations) ? (summary.limitations as string[]) : []
  };
}
