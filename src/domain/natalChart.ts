/**
 * Traduce el payload real de `charts.current` (AstrologyAPI) al
 * `NatalChartPayload` que consumen la rueda, la tabla y las lecturas.
 *
 * Vivía dentro de `src/components/web/orbita-chart.tsx`, así que SEIS pantallas
 * nativas importaban desde una pantalla web. Con esa dependencia invertida no
 * se podía retirar la implementación web duplicada sin romper el nativo.
 * Es una función pura: su lugar es el dominio.
 *
 * DOS FORMAS VÁLIDAS. La plana canónica (`payload.placements`, …) y la forma
 * envuelta legada (`payload.chart.normalized`). Leer sólo la plana fue lo que
 * dejó la carta en blanco cuando un deploy reintrodujo la forma anterior: el
 * documento llegaba entero pero por la rama equivocada.
 *
 * RECHAZA EN VEZ DE DEGRADAR. Antes, un documento sin Sol ni Luna producía una
 * tríada de guiones y una rueda vacía, indistinguible de una carta real. Las
 * seis superficies que llaman acá ya envuelven la llamada en `try/catch` para
 * mostrar un estado honesto: lo que no es una carta tiene que tirar.
 */
import type { NatalChartAspect, NatalChartPayload, SignPlacement } from "@/services/appRefs";

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const HARMONY_BY_TYPE: Record<string, "harmony" | "tension"> = {
  trine: "harmony", sextile: "harmony", conjunction: "harmony",
  square: "tension", opposition: "tension", quincunx: "tension", inconjunct: "tension"
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Lo que hace carta a un objeto es traer la lista de posiciones. */
const isChart = (v: unknown): v is Record<string, unknown> => isRecord(v) && Array.isArray(v.placements);

/** Falla con un motivo legible; el llamador ya la trata como "carta no disponible". */
const rechazar = (motivo: string): never => {
  throw new Error(`NATAL_CHART_INVALID: ${motivo}`);
};

/**
 * Busca la carta normalizada en las formas conocidas. Si el documento declara
 * `payload`, esa rama es autoritativa: una respuesta pública malformada no se
 * puede "salvar" mirando campos laterales del mismo documento.
 */
function findChart(doc: unknown): Record<string, unknown> | null {
  if (!isRecord(doc)) return null;
  const roots = "payload" in doc ? [doc.payload] : [doc];
  for (const root of roots) {
    if (!isRecord(root)) return null;
    const envuelta = isRecord(root.chart) ? root.chart.normalized : undefined;
    for (const candidata of [envuelta, root.normalized, root]) {
      if (isChart(candidata)) return candidata;
    }
  }
  return null;
}

/** Traduce el payload real de `charts.current` (AstrologyAPI) a `NatalChartPayload`. */
export function mapNatalChart(doc: unknown): NatalChartPayload {
  const p = findChart(doc) ?? rechazar("el documento no contiene una carta normalizada");
  const raw = (p.placements as unknown[]).filter(isRecord);
  const noon = p.calculationTimeSource === "noon_fallback";
  const find = (k: string) => raw.find((x) => x.key === k);
  const signOf = (x?: Record<string, unknown>) => cap((x?.signEs as string) ?? (x?.sign as string));
  const houseOf = (x?: Record<string, unknown>) => (typeof x?.house === "number" ? (x.house as number) : undefined);
  const numOr = (v: unknown) => (typeof v === "number" ? v : undefined);

  const sun = find("sun"), moon = find("moon"), asc = find("ascendant");
  // Sol y Luna son la carta: sin ellos no hay nada honesto que dibujar.
  if (!signOf(sun)) rechazar("falta el Sol");
  if (!signOf(moon)) rechazar("falta la Luna");
  // Sin hora natal el backend no publica Asc ni casas a propósito: eso NO es un
  // documento roto, es una carta aproximada. Con hora, su ausencia sí lo es.
  if (!noon && !signOf(asc)) rechazar("falta el Ascendente");

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

  const triad = {
    sun: { ...toPlacement(sun, "Sol"), planet: "Sol", sign: signOf(sun) },
    moon: { ...toPlacement(moon, "Luna"), planet: "Luna", sign: signOf(moon) },
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
  const aspects = (Array.isArray(p.aspects) ? (p.aspects as unknown[]) : [])
    .filter(isRecord)
    .filter(withNames)
    .map(mapAspect);

  const houses = (Array.isArray(p.houses) ? (p.houses as unknown[]) : [])
    .filter(isRecord)
    .map((h) => ({
      house: (h.house as number) ?? (h.number as number),
      sign: signOf(h),
      cusp: numOr(h.degree),
      theme: (h.theme as string) ?? undefined
    }));

  const summary = (isRecord(p.summary) ? p.summary : {}) as Record<string, unknown>;
  const summaryAsc = summary.ascendant as Record<string, unknown> | undefined;
  const ascendantDegree = houses.find((h) => h.house === 1)?.cusp ?? numOr(summaryAsc?.fullDegree);
  const mc = houses.find((h) => h.house === 10)?.cusp;
  const mainAspects = (Array.isArray(summary.mainAspects) ? (summary.mainAspects as unknown[]) : [])
    .filter(isRecord)
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
