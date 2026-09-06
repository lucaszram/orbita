/**
 * Motor puro de vínculos V4.9.2.
 *
 * No lee Convex, no llama proveedores y no persiste nada. Recibe posiciones ya
 * calculadas y conserva la precisión disponible: una carta sin hora nunca
 * habilita ángulos, casas ni una Luna tomada de un único instante arbitrario.
 */

export const RELATIONSHIP_LAYERS_VERSION = "orbita-relationship-layers-v1";
export const RELATIONSHIP_COMPARISON_VERSION = "orbita-relationship-comparison-v3";

export const RELATIONSHIP_DIMENSION_IDS = [
  "communication",
  "care",
  "desire",
  "friction",
  "shared_project"
] as const;

export type RelationshipDimensionId = (typeof RELATIONSHIP_DIMENSION_IDS)[number];
export type RelationshipComparisonLevel = 1 | 2 | 3;
export type RelationshipBirthTimePrecision = "known" | "approximate" | "unknown";
export type RelationshipPointPrecision = "exact" | "estimated" | "range";
export type RelationshipType =
  | "romantic"
  | "parent_or_caregiver"
  | "child"
  | "sibling"
  | "friendship"
  | "work_or_project"
  | "other"
  | "prefer_not_to_say";

export const RELATIONSHIP_ZODIAC_SIGNS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces"
] as const;

export type RelationshipZodiacSign = (typeof RELATIONSHIP_ZODIAC_SIGNS)[number];
export type RelationshipElement = "fire" | "earth" | "air" | "water";
export type RelationshipModality = "cardinal" | "fixed" | "mutable";

export type RelationshipPlacementInput = {
  key: string;
  label?: string;
  sign?: string | null;
  /** Longitud eclíptica canónica. `fullDegree` permite pasar la forma de la carta normalizada existente. */
  longitude?: number | null;
  fullDegree?: number | null;
  /**
   * Muestras que cubren el intervalo de incertidumbre (por ejemplo inicio,
   * mitad y fin del día civil). No son percentiles ni un orbe.
   */
  longitudeSamples?: readonly number[];
  /** El proveedor verificó que el dato no cambia en el intervalo desconocido. */
  timeStable?: boolean;
  house?: number | null;
};

export type RelationshipHouseInput = {
  house: number;
  /** `degree` mantiene compatibilidad estructural con `NormalizedAstroHouse`. */
  cuspDegree?: number | null;
  degree?: number | null;
  sign?: string | null;
};

export type RelationshipChartInput = {
  name?: string;
  zodiacSign?: string | null;
  birthTimePrecision: RelationshipBirthTimePrecision;
  placements?: readonly RelationshipPlacementInput[];
  houses?: readonly RelationshipHouseInput[];
};

export type RelationshipPatternFacet = {
  point: "moon" | "venus" | "mars";
  label: string;
  title: string;
  precision: RelationshipPointPrecision;
  signs: RelationshipZodiacSign[];
  text: string;
};

export type RelationshipAxis = {
  descendantDegree: number;
  descendantSign: RelationshipZodiacSign;
  house7Planets: Array<{ key: string; label: string }>;
  text: string;
};

export type OwnRelationshipPattern = {
  methodVersion: typeof RELATIONSHIP_LAYERS_VERSION;
  status: "ready" | "partial" | "unavailable";
  precision: RelationshipPointPrecision;
  emotionalNeed: RelationshipPatternFacet | null;
  affectionStyle: RelationshipPatternFacet | null;
  desireStyle: RelationshipPatternFacet | null;
  relationshipAxis: RelationshipAxis | null;
  limitations: string[];
  disclaimer: string;
};

export type RelationshipAspectType = "conjunction" | "sextile" | "square" | "trine" | "opposition";
export type RelationshipDriverQuality = "support" | "tension" | "neutral";

export type RelationshipDriver = {
  id: string;
  kind: "cross_aspect" | "house_overlay";
  dimension: RelationshipDimensionId;
  quality: RelationshipDriverQuality;
  source: { person: "a" | "b"; point: string; label: string };
  target: { person: "a" | "b"; point: string; label: string } | null;
  aspect: RelationshipAspectType | null;
  orb: number | null;
  orbRange: [number, number] | null;
  precision: RelationshipPointPrecision;
  /** 0..1: cercanía al aspecto exacto. No es un puntaje de compatibilidad. */
  strength: number;
  /** Peso del contacto dentro de esta dimensión; se suma, no es un porcentaje. */
  weight: number;
  text: string;
};

export type RelationshipDimension = {
  id: RelationshipDimensionId;
  label: string;
  status: "available" | "no_major_contacts" | "insufficient_data";
  tone: "more_fluid" | "mixed" | "more_challenging" | "subtle" | "not_available";
  weight: number;
  supportWeight: number;
  tensionWeight: number;
  neutralWeight: number;
  summary: string;
  drivers: RelationshipDriver[];
};

/**
 * La evidencia de un contacto, lista para publicar.
 *
 * Es un SUBCONJUNTO de `RelationshipDriver`, no un cálculo nuevo: mismo id,
 * mismo texto, misma calidad, mismo peso y misma precisión que ya produjo
 * `buildDimensions`. No hay LLM, no hay heurística y no hay orden nuevo.
 */
export type RelationshipDriverDetail = {
  id: string;
  text: string;
  quality: RelationshipDriverQuality;
  /** Peso dentro de ESA dimensión. Se suma; no es un porcentaje. */
  weight: number;
  precision: RelationshipPointPrecision;
};

/**
 * Los contactos de una dimensión, uno por identidad real.
 *
 * **Deduplica sólo por `id`.** Dos contactos con el mismo texto y distinto id
 * son dos contactos —`Su Descendente □ tu Luna` y `Su Ascendente □ tu Luna`
 * describen cosas distintas aunque la oración quede casi igual—, y borrar uno
 * por parecerse al otro sería perder evidencia real. Sólo se descarta la
 * repetición EXACTA de un id dentro de la misma dimensión, que sería un contacto
 * contado dos veces.
 *
 * El MISMO id puede aparecer en varias dimensiones y eso se conserva: un
 * contacto que alimenta `Deseo` y `Fricción` es uno solo, y su id es lo que
 * permite decirlo en vez de mostrarlo como dos.
 *
 * El orden es el que ya trae la dimensión: peso descendente y, a igual peso, el
 * id — determinístico y estable entre corridas.
 */
export function relationshipDriverDetails(
  drivers: readonly RelationshipDriver[]
): RelationshipDriverDetail[] {
  const vistos = new Set<string>();
  const details: RelationshipDriverDetail[] = [];
  for (const driver of drivers) {
    if (vistos.has(driver.id)) continue;
    vistos.add(driver.id);
    details.push({
      id: driver.id,
      text: driver.text,
      quality: driver.quality,
      weight: driver.weight,
      precision: driver.precision
    });
  }
  return details;
}

export type RelationshipGeneralStyle = {
  title: string;
  body: string;
  signs: [RelationshipZodiacSign, RelationshipZodiacSign];
  elements: [RelationshipElement, RelationshipElement];
  modalities: [RelationshipModality, RelationshipModality];
  drivers: string[];
  disclaimer: string;
};

export type RelationshipComparison = {
  methodVersion: typeof RELATIONSHIP_COMPARISON_VERSION;
  requestedLevel: RelationshipComparisonLevel;
  level: RelationshipComparisonLevel;
  levelLabel: "signo contra signo" | "fecha contra fecha" | "carta contra carta";
  generalStyle: RelationshipGeneralStyle;
  dimensions: RelationshipDimension[];
  limitations: string[];
  disclaimer: string;
};

type NormalizedPoint = {
  key: string;
  label: string;
  sign: RelationshipZodiacSign | null;
  longitude: number | null;
  samples: number[];
  timeStable: boolean;
  house: number | null;
};

type PointForComparison = NormalizedPoint & {
  precision: RelationshipPointPrecision;
  candidates: number[];
};

type StableAspect = {
  type: RelationshipAspectType;
  orb: number;
  orbRange: [number, number] | null;
  precision: RelationshipPointPrecision;
  strength: number;
};

const POINT_LABELS: Record<string, string> = {
  sun: "Sol",
  moon: "Luna",
  mercury: "Mercurio",
  venus: "Venus",
  mars: "Marte",
  jupiter: "Júpiter",
  saturn: "Saturno",
  uranus: "Urano",
  neptune: "Neptuno",
  pluto: "Plutón",
  ascendant: "Ascendente",
  descendant: "Descendente"
};

const POINT_ALIASES: Record<string, string> = {
  sol: "sun",
  luna: "moon",
  mercurio: "mercury",
  venus: "venus",
  marte: "mars",
  jupiter: "jupiter",
  saturno: "saturn",
  urano: "uranus",
  neptuno: "neptune",
  pluton: "pluto",
  asc: "ascendant",
  ascendente: "ascendant",
  desc: "descendant",
  descendente: "descendant"
};

const SIGN_ALIASES: Record<string, RelationshipZodiacSign> = {
  aries: "aries",
  tauro: "taurus",
  taurus: "taurus",
  geminis: "gemini",
  gemini: "gemini",
  cancer: "cancer",
  leo: "leo",
  virgo: "virgo",
  libra: "libra",
  escorpio: "scorpio",
  scorpio: "scorpio",
  sagitario: "sagittarius",
  sagittarius: "sagittarius",
  capricornio: "capricorn",
  capricorn: "capricorn",
  acuario: "aquarius",
  aquarius: "aquarius",
  piscis: "pisces",
  pisces: "pisces"
};

const SIGN_LABELS: Record<RelationshipZodiacSign, string> = {
  aries: "Aries",
  taurus: "Tauro",
  gemini: "Géminis",
  cancer: "Cáncer",
  leo: "Leo",
  virgo: "Virgo",
  libra: "Libra",
  scorpio: "Escorpio",
  sagittarius: "Sagitario",
  capricorn: "Capricornio",
  aquarius: "Acuario",
  pisces: "Piscis"
};

const SIGN_ELEMENT: Record<RelationshipZodiacSign, RelationshipElement> = {
  aries: "fire",
  taurus: "earth",
  gemini: "air",
  cancer: "water",
  leo: "fire",
  virgo: "earth",
  libra: "air",
  scorpio: "water",
  sagittarius: "fire",
  capricorn: "earth",
  aquarius: "air",
  pisces: "water"
};

const SIGN_MODALITY: Record<RelationshipZodiacSign, RelationshipModality> = {
  aries: "cardinal",
  taurus: "fixed",
  gemini: "mutable",
  cancer: "cardinal",
  leo: "fixed",
  virgo: "mutable",
  libra: "cardinal",
  scorpio: "fixed",
  sagittarius: "mutable",
  capricorn: "cardinal",
  aquarius: "fixed",
  pisces: "mutable"
};

const ELEMENT_LABELS: Record<RelationshipElement, string> = {
  fire: "fuego",
  earth: "tierra",
  air: "aire",
  water: "agua"
};

const MODALITY_RHYTHMS: Record<RelationshipModality, string> = {
  cardinal: "que tiende a iniciar",
  fixed: "que tiende a sostener",
  mutable: "que tiende a adaptarse"
};

const ASPECTS: ReadonlyArray<{
  type: RelationshipAspectType;
  angle: number;
  maxOrb: number;
  label: string;
  /**
   * Artículo indeterminado del nombre del aspecto. Va declarado porque tres de
   * los cinco son femeninos: con `un` fijo la oración decía "un conjunción" y
   * "un cuadratura".
   */
  article: "un" | "una";
  quality: RelationshipDriverQuality;
}> = [
  { type: "conjunction", angle: 0, maxOrb: 6, label: "conjunción", article: "una", quality: "neutral" },
  { type: "sextile", angle: 60, maxOrb: 4, label: "sextil", article: "un", quality: "support" },
  { type: "square", angle: 90, maxOrb: 5, label: "cuadratura", article: "una", quality: "tension" },
  { type: "trine", angle: 120, maxOrb: 5, label: "trígono", article: "un", quality: "support" },
  { type: "opposition", angle: 180, maxOrb: 6, label: "oposición", article: "una", quality: "tension" }
];

const DIMENSION_META: Record<RelationshipDimensionId, { label: string; relevant: string[] }> = {
  communication: { label: "Cómo se hablan", relevant: ["mercury", "moon", "sun"] },
  care: { label: "Cómo se cuidan", relevant: ["moon", "venus", "saturn"] },
  desire: { label: "Deseo", relevant: ["venus", "mars", "sun"] },
  friction: { label: "Fricción", relevant: ["mars", "saturn", "sun", "mercury", "moon"] },
  shared_project: { label: "Proyecto en común", relevant: ["sun", "jupiter", "saturn"] }
};

const NEUTRAL_DESIRE_LABEL = "Energía compartida";

const PAIR_WEIGHTS: Record<RelationshipDimensionId, Record<string, number>> = {
  communication: {
    "mercury|mercury": 1.4,
    "mercury|moon": 1.1,
    "mercury|sun": 0.9
  },
  care: {
    "moon|moon": 1.5,
    "moon|venus": 1.35,
    "venus|venus": 0.8,
    "moon|saturn": 0.9
  },
  desire: {
    "mars|venus": 1.5,
    "mars|mars": 1,
    "venus|venus": 0.7,
    "sun|venus": 0.8
  },
  friction: {
    "mars|saturn": 1.5,
    "mars|mars": 1.2,
    "saturn|sun": 1.1,
    "mars|mercury": 0.9,
    "moon|saturn": 1
  },
  shared_project: {
    "sun|sun": 1,
    "saturn|sun": 1.2,
    "jupiter|saturn": 1.3,
    "jupiter|sun": 1,
    "saturn|saturn": 0.8,
    "jupiter|jupiter": 0.7
  }
};

const PLANET_KEYS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"] as const;
const POINT_ORDER = [...PLANET_KEYS, "uranus", "neptune", "pluto", "ascendant", "descendant"];

function plainKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pointKey(value: string) {
  const key = plainKey(value);
  return POINT_ALIASES[key] ?? key;
}

function normalizeSign(value: unknown): RelationshipZodiacSign | null {
  if (typeof value !== "string") return null;
  return SIGN_ALIASES[plainKey(value)] ?? null;
}

function normalizeDegree(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return ((value % 360) + 360) % 360;
}

function rounded(value: number, places = 3) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function uniqueNumbers(values: readonly number[]) {
  return Array.from(new Set(values.map(normalizeDegree).filter((value): value is number => value !== null))).sort(
    (a, b) => a - b
  );
}

function signFromDegree(degree: number): RelationshipZodiacSign {
  return RELATIONSHIP_ZODIAC_SIGNS[Math.floor(normalizeDegree(degree)! / 30) % 12];
}

function normalizePlacement(input: RelationshipPlacementInput): NormalizedPoint | null {
  const key = pointKey(input.key);
  if (!key) return null;
  const longitude = normalizeDegree(input.longitude ?? input.fullDegree);
  const samples = uniqueNumbers(input.longitudeSamples ?? []);
  const sign = normalizeSign(input.sign) ?? (longitude === null ? null : signFromDegree(longitude));
  const house =
    typeof input.house === "number" && Number.isInteger(input.house) && input.house >= 1 && input.house <= 12
      ? input.house
      : null;
  return {
    key,
    label: input.label?.trim() || POINT_LABELS[key] || input.key.trim(),
    sign,
    longitude,
    samples,
    timeStable: input.timeStable === true,
    house
  };
}

function normalizedPlacements(chart: RelationshipChartInput) {
  const candidates = (chart.placements ?? [])
    .map(normalizePlacement)
    .filter((placement): placement is NormalizedPoint => placement !== null)
    .sort((a, b) => {
      const aOrder = POINT_ORDER.indexOf(a.key);
      const bOrder = POINT_ORDER.indexOf(b.key);
      const byOrder = (aOrder < 0 ? 999 : aOrder) - (bOrder < 0 ? 999 : bOrder);
      if (byOrder !== 0) return byOrder;
      const byKey = a.key.localeCompare(b.key);
      if (byKey !== 0) return byKey;
      return JSON.stringify(a).localeCompare(JSON.stringify(b));
    });
  const byKey = new Map<string, NormalizedPoint>();
  for (const placement of candidates) {
    if (!byKey.has(placement.key)) byKey.set(placement.key, placement);
  }
  return byKey;
}

function normalizedCusps(chart: RelationshipChartInput) {
  const byHouse = new Map<number, number>();
  for (const raw of chart.houses ?? []) {
    if (!Number.isInteger(raw.house) || raw.house < 1 || raw.house > 12) continue;
    const degree = normalizeDegree(raw.cuspDegree ?? raw.degree);
    if (degree !== null && !byHouse.has(raw.house)) byHouse.set(raw.house, degree);
  }
  return Array.from(byHouse, ([house, degree]) => ({ house, degree })).sort((a, b) => a.house - b.house);
}

function hasExactHouses(chart: RelationshipChartInput) {
  return chart.birthTimePrecision === "known" && normalizedCusps(chart).length === 12;
}

function anglePoint(chart: RelationshipChartInput, key: "ascendant" | "descendant"): NormalizedPoint | null {
  if (!hasExactHouses(chart)) return null;
  const house = key === "ascendant" ? 1 : 7;
  const degree = normalizedCusps(chart).find((cusp) => cusp.house === house)?.degree;
  if (degree === undefined) return null;
  return {
    key,
    label: POINT_LABELS[key],
    sign: signFromDegree(degree),
    longitude: degree,
    samples: [],
    timeStable: true,
    house
  };
}

function pointForComparison(
  chart: RelationshipChartInput,
  point: NormalizedPoint,
  level: 2 | 3
): PointForComparison | null {
  if (level === 3) {
    if (chart.birthTimePrecision !== "known" || point.longitude === null) return null;
    return { ...point, candidates: [point.longitude], precision: "exact" };
  }

  if (point.key === "moon" && chart.birthTimePrecision !== "known") {
    if (point.samples.length >= 2) {
      const candidates = uniqueNumbers([
        ...point.samples,
        ...(point.longitude === null ? [] : [point.longitude])
      ]);
      return { ...point, candidates, precision: "range" };
    }
    if (point.timeStable && point.longitude !== null) {
      return { ...point, candidates: [point.longitude], precision: "estimated" };
    }
    return null;
  }

  const candidates = uniqueNumbers([
    ...point.samples,
    ...(point.longitude === null ? [] : [point.longitude])
  ]);
  if (candidates.length === 0) return null;
  const precision: RelationshipPointPrecision =
    chart.birthTimePrecision === "known" && candidates.length === 1
      ? "exact"
      : candidates.length > 1
        ? "range"
        : "estimated";
  return { ...point, candidates, precision };
}

function comparisonPoints(chart: RelationshipChartInput, level: 2 | 3) {
  const placements = normalizedPlacements(chart);
  const result = new Map<string, PointForComparison>();
  for (const key of PLANET_KEYS) {
    const point = placements.get(key);
    if (!point) continue;
    const usable = pointForComparison(chart, point, level);
    if (usable) result.set(key, usable);
  }
  if (level === 3) {
    for (const key of ["ascendant", "descendant"] as const) {
      const point = anglePoint(chart, key);
      if (!point) continue;
      const usable = pointForComparison(chart, point, 3);
      if (usable) result.set(key, usable);
    }
  }
  return result;
}

function chartSunSign(chart: RelationshipChartInput): RelationshipZodiacSign | null {
  const declared = normalizeSign(chart.zodiacSign);
  if (declared) return declared;
  const sun = normalizedPlacements(chart).get("sun");
  return sun?.sign ?? (sun?.longitude === null || sun?.longitude === undefined ? null : signFromDegree(sun.longitude));
}

function elementRelationship(a: RelationshipElement, b: RelationshipElement) {
  if (a === b) {
    return `Comparten un modo ${ELEMENT_LABELS[a]} de registrar lo que pasa. Eso puede dar un lenguaje conocido, aunque no vuelve idénticas sus respuestas.`;
  }
  const pair = [a, b].sort().join("|");
  if (pair === "air|fire") {
    return "Fuego pone movimiento y aire abre ideas. El intercambio puede sentirse ágil cuando cada parte deja espacio para el ritmo de la otra.";
  }
  if (pair === "earth|water") {
    return "Tierra busca forma y agua registra el clima emocional. Son recursos distintos que pueden complementarse sin garantizar acuerdo.";
  }
  return `Sus elementos parten de prioridades distintas: ${ELEMENT_LABELS[a]} procesa de una manera y ${ELEMENT_LABELS[b]} de otra. La diferencia pide traducción, no implica incompatibilidad.`;
}

function modalityRelationship(a: RelationshipModality, b: RelationshipModality) {
  if (a !== b) {
    return `También combinan un ritmo ${MODALITY_RHYTHMS[a]} con otro ${MODALITY_RHYTHMS[b]}. Cada persona puede impulsar el intercambio desde un lugar distinto.`;
  }
  if (a === "cardinal") return "Los dos pueden tender a iniciar; el punto a conversar es quién marca la dirección y cuándo.";
  if (a === "fixed") return "Los dos pueden tender a sostener; la continuidad puede ser un recurso y la rigidez, un tema a mirar.";
  return "Los dos pueden tender a ajustar sobre la marcha; la flexibilidad ayuda, aunque a veces falte un cierre claro.";
}

function buildGeneralStyle(a: RelationshipChartInput, b: RelationshipChartInput): RelationshipGeneralStyle {
  const signA = chartSunSign(a);
  const signB = chartSunSign(b);
  if (!signA || !signB) {
    throw new Error("RELATIONSHIP_SIGN_REQUIRED: cada persona necesita al menos su signo solar.");
  }
  const elementA = SIGN_ELEMENT[signA];
  const elementB = SIGN_ELEMENT[signB];
  const modalityA = SIGN_MODALITY[signA];
  const modalityB = SIGN_MODALITY[signB];
  return {
    title: `${SIGN_LABELS[signA]} + ${SIGN_LABELS[signB]}`,
    body: `${elementRelationship(elementA, elementB)} ${modalityRelationship(modalityA, modalityB)}`,
    signs: [signA, signB],
    elements: [elementA, elementB],
    modalities: [modalityA, modalityB],
    drivers: [
      `${a.name?.trim() || "Primera persona"}: Sol en ${SIGN_LABELS[signA]}, elemento ${ELEMENT_LABELS[elementA]} y un ritmo ${MODALITY_RHYTHMS[modalityA]}.`,
      `${b.name?.trim() || "Segunda persona"}: Sol en ${SIGN_LABELS[signB]}, elemento ${ELEMENT_LABELS[elementB]} y un ritmo ${MODALITY_RHYTHMS[modalityB]}.`
    ],
    disclaimer: "Esta lectura compara estilos solares generales. Sin las fechas completas no describe un vínculo concreto."
  };
}

function patternSigns(
  chart: RelationshipChartInput,
  point: NormalizedPoint,
  allowDateEstimate: boolean
): { signs: RelationshipZodiacSign[]; precision: RelationshipPointPrecision } | null {
  if (chart.birthTimePrecision === "known") {
    const sign = point.sign ?? (point.longitude === null ? null : signFromDegree(point.longitude));
    return sign ? { signs: [sign], precision: "exact" } : null;
  }

  if (point.samples.length >= 2) {
    const signs = Array.from(new Set(point.samples.map(signFromDegree))).sort(
      (a, b) => RELATIONSHIP_ZODIAC_SIGNS.indexOf(a) - RELATIONSHIP_ZODIAC_SIGNS.indexOf(b)
    );
    return { signs, precision: signs.length > 1 ? "range" : "estimated" };
  }

  if (point.timeStable || allowDateEstimate) {
    const sign = point.sign ?? (point.longitude === null ? null : signFromDegree(point.longitude));
    return sign ? { signs: [sign], precision: "estimated" } : null;
  }
  return null;
}

function facetText(
  point: "moon" | "venus" | "mars",
  signs: RelationshipZodiacSign[],
  precision: RelationshipPointPrecision
) {
  if (precision === "range") {
    const options = signs.map((sign) => SIGN_LABELS[sign]).join(" o ");
    const pointLabel = POINT_LABELS[point];
    return `Según la hora de nacimiento, ${pointLabel} puede estar en ${options}. Órbita conserva las dos posibilidades en vez de elegir una sola sin respaldo.`;
  }
  const sign = signs[0];
  const element = SIGN_ELEMENT[sign];
  const modality = SIGN_MODALITY[sign];
  const ending = `El tono es de ${ELEMENT_LABELS[element]} y el ritmo tiende a ${modality === "cardinal" ? "iniciar" : modality === "fixed" ? "sostener" : "adaptarse"}. Es una tendencia, no una conducta fija.`;
  if (point === "moon") {
    return `Tu Luna en ${SIGN_LABELS[sign]} procesa lo emocional desde ese registro. ${ending}`;
  }
  if (point === "venus") {
    return `Venus en ${SIGN_LABELS[sign]} describe un modo posible de mostrar interés, valorar y acercarte. ${ending}`;
  }
  return `Marte en ${SIGN_LABELS[sign]} describe una forma posible de poner energía cuando algo te moviliza o atrae. ${ending}`;
}

function buildFacet(
  chart: RelationshipChartInput,
  placements: Map<string, NormalizedPoint>,
  point: "moon" | "venus" | "mars"
): RelationshipPatternFacet | null {
  const placement = placements.get(point);
  if (!placement) return null;
  const signData = patternSigns(chart, placement, point !== "moon");
  if (!signData) return null;
  const titles = {
    moon: "Cómo procesás lo emocional",
    venus: "Cómo das y recibís afecto",
    mars: "Cómo vas hacia el deseo"
  } as const;
  return {
    point,
    label: POINT_LABELS[point],
    title: titles[point],
    precision: signData.precision,
    signs: signData.signs,
    text: facetText(point, signData.signs, signData.precision)
  };
}

/** Construye el patrón relacional propio desde Luna, Venus, Marte y, sólo con hora exacta, casa 7. */
export function buildOwnRelationshipPattern(args: { chart: RelationshipChartInput }): OwnRelationshipPattern {
  const { chart } = args;
  const placements = normalizedPlacements(chart);
  const emotionalNeed = buildFacet(chart, placements, "moon");
  const affectionStyle = buildFacet(chart, placements, "venus");
  const desireStyle = buildFacet(chart, placements, "mars");
  const limitations: string[] = [];

  if (!emotionalNeed) {
    limitations.push(
      "Sin hora exacta, la Luna puede cambiar de signo durante el día. Como no pudimos descartar ese cambio, no elegimos una sola necesidad emocional."
    );
  }
  if (!affectionStyle) limitations.push("Sin la posición de Venus no podemos describir el modo de dar y recibir afecto.");
  if (!desireStyle) limitations.push("Sin la posición de Marte no podemos describir el modo de ir hacia el deseo.");

  let relationshipAxis: RelationshipAxis | null = null;
  const house7 = normalizedCusps(chart).find((cusp) => cusp.house === 7);
  if (chart.birthTimePrecision !== "known") {
    limitations.push(
      "El Descendente —el punto opuesto al Ascendente— y la casa 7 se omiten porque requieren una hora de nacimiento exacta."
    );
  } else if (!hasExactHouses(chart) || !house7) {
    limitations.push(
      "La hora figura como exacta, pero falta la carta completa con sus doce casas para leer el Descendente y la casa 7."
    );
  } else {
    const house7Planets = Array.from(placements.values())
      .filter((placement) => placement.house === 7 && !["ascendant", "descendant"].includes(placement.key))
      .map((placement) => ({ key: placement.key, label: placement.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const descendantSign = signFromDegree(house7.degree);
    relationshipAxis = {
      descendantDegree: rounded(house7.degree),
      descendantSign,
      house7Planets,
      text: `Tu Descendente, el punto opuesto al Ascendente, cae en ${SIGN_LABELS[descendantSign]}. Esta parte de la carta muestra cualidades que pueden hacerse visibles al vincularte; no define a quién elegís ni cómo va a funcionar una relación.`
    };
  }

  const facets = [emotionalNeed, affectionStyle, desireStyle].filter(
    (facet): facet is RelationshipPatternFacet => facet !== null
  );
  const status = facets.length === 0 ? "unavailable" : facets.length === 3 ? "ready" : "partial";
  const precision: RelationshipPointPrecision = facets.some((facet) => facet.precision === "range")
    ? "range"
    : chart.birthTimePrecision === "known" && facets.every((facet) => facet.precision === "exact")
      ? "exact"
      : "estimated";

  return {
    methodVersion: RELATIONSHIP_LAYERS_VERSION,
    status,
    precision,
    emotionalNeed,
    affectionStyle,
    desireStyle,
    relationshipAxis,
    limitations,
    disclaimer: "Este patrón organiza tendencias de tu carta. No diagnostica tu forma de vincularte ni predice relaciones."
  };
}

function angularDistance(a: number, b: number) {
  const difference = Math.abs(normalizeDegree(a)! - normalizeDegree(b)!);
  return Math.min(difference, 360 - difference);
}

function aspectAt(a: number, b: number) {
  const distance = angularDistance(a, b);
  return ASPECTS.map((aspect) => ({ aspect, orb: Math.abs(distance - aspect.angle) }))
    .filter(({ aspect, orb }) => orb <= aspect.maxOrb)
    .sort((left, right) => left.orb - right.orb || left.aspect.angle - right.aspect.angle)[0] ?? null;
}

function stableAspect(a: PointForComparison, b: PointForComparison): StableAspect | null {
  const readings = a.candidates.flatMap((left) => b.candidates.map((right) => aspectAt(left, right)));
  if (readings.length === 0 || readings.some((reading) => reading === null)) return null;
  const first = readings[0]!;
  if (readings.some((reading) => reading!.aspect.type !== first.aspect.type)) return null;
  const orbs = readings.map((reading) => reading!.orb).sort((left, right) => left - right);
  const minOrb = orbs[0];
  const maxOrb = orbs[orbs.length - 1];
  const precision: RelationshipPointPrecision =
    a.precision === "range" || b.precision === "range"
      ? "range"
      : a.precision === "exact" && b.precision === "exact"
        ? "exact"
        : "estimated";
  return {
    type: first.aspect.type,
    orb: rounded((minOrb + maxOrb) / 2),
    orbRange: precision === "range" ? [rounded(minOrb), rounded(maxOrb)] : null,
    precision,
    strength: rounded(Math.max(0, 1 - maxOrb / first.aspect.maxOrb))
  };
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

function pairWeight(dimension: RelationshipDimensionId, a: string, b: string) {
  const direct = PAIR_WEIGHTS[dimension][pairKey(a, b)];
  if (direct !== undefined) return direct;
  const angle = [a, b].find((point) => point === "ascendant" || point === "descendant");
  const planet = angle ? (a === angle ? b : a) : null;
  if (!angle || !planet) return null;
  if (dimension === "care" && ["moon", "venus"].includes(planet)) return angle === "descendant" ? 0.9 : 0.65;
  if (dimension === "desire" && ["venus", "mars"].includes(planet)) return 1;
  if (dimension === "shared_project" && ["sun", "jupiter", "saturn"].includes(planet)) {
    return angle === "descendant" ? 1 : 0.7;
  }
  return null;
}

function aspectDefinition(type: RelationshipAspectType) {
  return ASPECTS.find((aspect) => aspect.type === type)!;
}

function formatDistanceFromExact(orb: number, range: [number, number] | null) {
  if (range) {
    return `puede quedar entre ${range[0].toFixed(1).replace(".", ",")}° y ${range[1].toFixed(1).replace(".", ",")}° de su máxima precisión`;
  }
  return `está a ${orb.toFixed(1).replace(".", ",")}° de su máxima precisión`;
}

const DRIVER_ENDINGS: Record<RelationshipDimensionId, Record<RelationshipDriverQuality, string>> = {
  communication: {
    support: "Suma una vía de entendimiento; no reemplaza hablar claro.",
    tension: "Marca una diferencia de ritmo al hablar que puede pedir más traducción.",
    neutral: "Concentra la conversación en ese cruce y puede volverlo más visible."
  },
  care: {
    support: "Ofrece un recurso para registrar y acompañar lo que le pasa al otro.",
    tension: "Muestra necesidades de cuidado distintas que conviene nombrar.",
    neutral: "Vuelve más presente la forma en que cada uno pide o da cuidado."
  },
  desire: {
    support: "Se toma como una vía de atracción y ritmo compartido, no como una garantía.",
    tension: "Señala ritmos de deseo distintos que pueden necesitar acuerdos explícitos.",
    neutral: "Concentra energía en el intercambio y aumenta su visibilidad."
  },
  friction: {
    support: "Aporta un recurso para tramitar diferencias sin borrar el conflicto.",
    tension: "Marca un punto donde la diferencia puede sentirse más rápido o con más fuerza.",
    neutral: "Hace visible una zona de intensidad que cada vínculo maneja de manera distinta."
  },
  shared_project: {
    support: "Aporta una forma de coordinar dirección, tiempos o responsabilidades.",
    tension: "Muestra criterios distintos sobre cómo avanzar o sostener algo juntos.",
    neutral: "Pone el foco en cómo se organiza una dirección compartida."
  }
};

/**
 * La voz del canon V4.9.2: SEGUNDA PERSONA, sin nombres.
 *
 * El frame escribe `Su Venus forma un trígono con tu Marte` y
 * `Su Saturno toca tu Sol` (handoff `docs/handoff-claude-figma-v492-copy-claridad.md`,
 * sección 6). La plantilla anterior escribía la misma oración en tercera con
 * los dos nombres —`Venus de Vos y Marte de Martina QA forman…`—, que además
 * repetía el nombre en cada contacto de cada dimensión.
 *
 * `a` es siempre quien lee (`tu`) y `b` la otra persona (`su`): así lo arma
 * `buildDimensions`, que toma `a` de la cuenta y `b` del perfil guardado. El
 * dato no cambia: mismo aspecto, mismo orbe, mismo cierre editorial.
 */
function aspectDriver(args: {
  dimension: RelationshipDimensionId;
  multiplier: number;
  a: PointForComparison;
  b: PointForComparison;
  aspect: StableAspect;
  romantic: boolean;
}): RelationshipDriver {
  const definition = aspectDefinition(args.aspect.type);
  const strength = args.aspect.strength;
  return {
    id: `aspect:a:${args.a.key}:b:${args.b.key}:${args.aspect.type}`,
    kind: "cross_aspect",
    dimension: args.dimension,
    quality: definition.quality,
    source: { person: "a", point: args.a.key, label: args.a.label },
    target: { person: "b", point: args.b.key, label: args.b.label },
    aspect: args.aspect.type,
    orb: args.aspect.orb,
    orbRange: args.aspect.orbRange,
    precision: args.aspect.precision,
    strength,
    weight: rounded(strength * args.multiplier),
    text: `Su ${args.b.label} forma ${definition.article} ${definition.label} con tu ${args.a.label}, un contacto de ${definition.angle}°; ${formatDistanceFromExact(args.aspect.orb, args.aspect.orbRange)}. ${
      args.dimension === "desire" && !args.romantic
        ? {
            support: "Aporta una vía para coordinar iniciativa y expresión, no una garantía.",
            tension: "Señala impulsos distintos que pueden necesitar acuerdos explícitos.",
            neutral: "Concentra energía en el intercambio y aumenta su visibilidad."
          }[definition.quality]
        : DRIVER_ENDINGS[args.dimension][definition.quality]
    }`
  };
}

function houseForDegree(degree: number, cusps: Array<{ house: number; degree: number }>) {
  const ascendant = cusps.find((cusp) => cusp.house === 1)?.degree;
  if (ascendant === undefined || cusps.length !== 12) return null;
  const relative = normalizeDegree(degree - ascendant)!;
  const ordered = cusps
    .map((cusp) => ({ ...cusp, relative: normalizeDegree(cusp.degree - ascendant)! }))
    .sort((a, b) => a.relative - b.relative || a.house - b.house);
  let found = ordered[0].house;
  for (const cusp of ordered) {
    if (cusp.relative <= relative) found = cusp.house;
    else break;
  }
  return found;
}

const HOUSE_OVERLAYS: Array<{
  dimension: RelationshipDimensionId;
  points: string[];
  houses: number[];
  weight: number;
}> = [
  { dimension: "communication", points: ["mercury"], houses: [3], weight: 0.55 },
  { dimension: "care", points: ["moon", "venus"], houses: [4, 6], weight: 0.55 },
  { dimension: "desire", points: ["venus", "mars"], houses: [5, 8], weight: 0.6 },
  { dimension: "friction", points: ["mars", "saturn"], houses: [6, 8, 12], weight: 0.55 },
  { dimension: "shared_project", points: ["sun", "jupiter", "saturn"], houses: [7, 10, 11], weight: 0.6 }
];

const HOUSE_MEANINGS: Record<number, string> = {
  3: "palabra y entorno cercano",
  4: "intimidad y raíz",
  5: "deseo y expresión",
  6: "hábitos y cuidado cotidiano",
  7: "acuerdos y vínculo",
  8: "confianza y profundidad",
  10: "dirección y responsabilidades",
  11: "proyectos y pertenencia",
  12: "cierres y mundo interno"
};

function houseDrivers(args: {
  dimension: RelationshipDimensionId;
  sourcePerson: "a" | "b";
  sourceName: string;
  sourcePoints: Map<string, PointForComparison>;
  targetPerson: "a" | "b";
  targetName: string;
  targetChart: RelationshipChartInput;
  romantic: boolean;
}) {
  const rule = HOUSE_OVERLAYS.find((item) => item.dimension === args.dimension);
  if (!rule) return [];
  const cusps = normalizedCusps(args.targetChart);
  if (cusps.length !== 12) return [];
  const drivers: RelationshipDriver[] = [];
  for (const key of rule.points) {
    const point = args.sourcePoints.get(key);
    if (!point || point.longitude === null) continue;
    const house = houseForDegree(point.longitude, cusps);
    if (house === null || !rule.houses.includes(house)) continue;
    const houseMeaning =
      !args.romantic && house === 4
        ? "raíces y vida compartida"
        : !args.romantic && house === 5
          ? "expresión y creatividad"
          : HOUSE_MEANINGS[house];
    drivers.push({
      id: `house:${args.sourcePerson}:${key}:${args.targetPerson}:${house}`,
      kind: "house_overlay",
      dimension: args.dimension,
      quality: "neutral",
      source: { person: args.sourcePerson, point: key, label: point.label },
      target: null,
      aspect: null,
      orb: null,
      orbRange: null,
      precision: "exact",
      strength: 1,
      weight: rule.weight,
      // Misma voz que `aspectDriver`: `a` es quien lee. El canon escribe
      // `Su Sol cae en tu casa 7, vinculada con pareja y asociaciones.`
      text:
        args.sourcePerson === "b"
          ? `Su ${point.label} cae en tu casa ${house}, vinculada con ${houseMeaning}. Esto sólo ubica ese planeta en un área de la carta; no garantiza cómo va a funcionar el vínculo.`
          : `Tu ${point.label} cae en su casa ${house}, vinculada con ${houseMeaning}. Esto sólo ubica ese planeta en un área de la carta; no garantiza cómo va a funcionar el vínculo.`
    });
  }
  return drivers;
}

function dimensionSummary(
  dimension: RelationshipDimensionId,
  status: RelationshipDimension["status"],
  support: number,
  tension: number,
  neutral: number,
  romantic: boolean,
): { tone: RelationshipDimension["tone"]; text: string } {
  if (status === "insufficient_data") {
    return { tone: "not_available", text: "Faltan posiciones para leer esta dimensión sin completar huecos con supuestos." };
  }
  if (status === "no_major_contacts") {
    return {
      tone: "subtle",
      text: "Con estos datos no aparece un contacto principal en esta dimensión. Eso no equivale a ausencia de vínculo."
    };
  }
  const label =
    dimension === "desire" && !romantic
      ? NEUTRAL_DESIRE_LABEL.toLowerCase()
      : DIMENSION_META[dimension].label.toLowerCase();
  if (support > tension * 1.25) {
    return {
      tone: "more_fluid",
      text: `En ${label} aparecen más recursos de fluidez que puntos de tensión. Igual importa cómo los usan en la práctica.`
    };
  }
  if (tension > support * 1.25) {
    return {
      tone: "more_challenging",
      text: `En ${label} aparecen diferencias que pueden pedir más conversación y acuerdos. No describen un resultado inevitable.`
    };
  }
  if (neutral > 0 && support === 0 && tension === 0) {
    return {
      tone: "subtle",
      text: `En ${label} hay contactos que llaman la atención sobre un tema, pero no indican por sí solos facilidad o conflicto.`
    };
  }
  return {
    tone: "mixed",
    text: `En ${label} conviven recursos y diferencias. El cálculo muestra dónde coinciden o difieren; no decide cómo funciona la relación.`
  };
}

function dimensionHasEnoughData(
  dimension: RelationshipDimensionId,
  pointsA: Map<string, PointForComparison>,
  pointsB: Map<string, PointForComparison>
) {
  const relevant = DIMENSION_META[dimension].relevant;
  return relevant.some((key) => pointsA.has(key)) && relevant.some((key) => pointsB.has(key));
}

function buildDimensions(args: {
  level: 2 | 3;
  a: RelationshipChartInput;
  b: RelationshipChartInput;
  limitations: string[];
  relationshipType?: RelationshipType | null;
}) {
  const pointsA = comparisonPoints(args.a, args.level);
  const pointsB = comparisonPoints(args.b, args.level);
  const nameA = args.a.name?.trim() || "la primera persona";
  const nameB = args.b.name?.trim() || "la segunda persona";
  let unstableMoonContact = false;
  let unstableOtherContact = false;
  const romantic = args.relationshipType === "romantic";

  const dimensions = RELATIONSHIP_DIMENSION_IDS.map((dimension): RelationshipDimension => {
    const drivers: RelationshipDriver[] = [];
    for (const a of pointsA.values()) {
      for (const b of pointsB.values()) {
        const multiplier = pairWeight(dimension, a.key, b.key);
        if (multiplier === null) continue;
        const aspect = stableAspect(a, b);
        if (!aspect) {
          if (a.precision === "range" || b.precision === "range") {
            if (a.key === "moon" || b.key === "moon") unstableMoonContact = true;
            else unstableOtherContact = true;
          }
          continue;
        }
        drivers.push(aspectDriver({ dimension, multiplier, a, b, aspect, romantic }));
      }
    }

    if (args.level === 3) {
      drivers.push(
        ...houseDrivers({
          dimension,
          sourcePerson: "a",
          sourceName: nameA,
          sourcePoints: pointsA,
          targetPerson: "b",
          targetName: nameB,
          targetChart: args.b,
          romantic,
        }),
        ...houseDrivers({
          dimension,
          sourcePerson: "b",
          sourceName: nameB,
          sourcePoints: pointsB,
          targetPerson: "a",
          targetName: nameA,
          targetChart: args.a,
          romantic,
        })
      );
    }

    drivers.sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id));
    const supportWeight = rounded(
      drivers.filter((driver) => driver.quality === "support").reduce((sum, driver) => sum + driver.weight, 0)
    );
    const tensionWeight = rounded(
      drivers.filter((driver) => driver.quality === "tension").reduce((sum, driver) => sum + driver.weight, 0)
    );
    const neutralWeight = rounded(
      drivers.filter((driver) => driver.quality === "neutral").reduce((sum, driver) => sum + driver.weight, 0)
    );
    const status: RelationshipDimension["status"] =
      drivers.length > 0
        ? "available"
        : dimensionHasEnoughData(dimension, pointsA, pointsB)
          ? "no_major_contacts"
          : "insufficient_data";
    const summary = dimensionSummary(
      dimension,
      status,
      supportWeight,
      tensionWeight,
      neutralWeight,
      romantic,
    );
    return {
      id: dimension,
      label:
        dimension === "desire" && !romantic
          ? NEUTRAL_DESIRE_LABEL
          : DIMENSION_META[dimension].label,
      status,
      tone: summary.tone,
      weight: rounded(supportWeight + tensionWeight + neutralWeight),
      supportWeight,
      tensionWeight,
      neutralWeight,
      summary: summary.text,
      drivers
    };
  });

  if (unstableMoonContact) {
    args.limitations.push(
      "No mostramos algunos contactos de la Luna porque podrían cambiar según la hora de nacimiento."
    );
  }
  if (unstableOtherContact) {
    args.limitations.push(
      "No mostramos algunos contactos entre planetas porque podrían cambiar según la hora de nacimiento."
    );
  }
  return dimensions;
}

function hasDatePositions(chart: RelationshipChartInput) {
  const sun = normalizedPlacements(chart).get("sun");
  return Boolean(sun && (sun.longitude !== null || sun.samples.length > 0));
}

function resolvedLevel(requested: RelationshipComparisonLevel, a: RelationshipChartInput, b: RelationshipChartInput) {
  if (requested >= 3 && hasExactHouses(a) && hasExactHouses(b)) return 3 as const;
  if (requested >= 2 && hasDatePositions(a) && hasDatePositions(b)) return 2 as const;
  return 1 as const;
}

/**
 * Compara dos perfiles con el máximo nivel que los datos pedidos permiten.
 * Nunca devuelve un score global: cada barra nace de sus contactos verificables.
 */
export function buildRelationshipComparison(args: {
  requestedLevel: RelationshipComparisonLevel;
  personA: RelationshipChartInput;
  personB: RelationshipChartInput;
  /** Declarado por quien guarda el perfil; ausente/null conserva lectura legacy neutral. */
  relationshipType?: RelationshipType | null;
}): RelationshipComparison {
  if (![1, 2, 3].includes(args.requestedLevel)) {
    throw new Error("RELATIONSHIP_LEVEL_INVALID: requestedLevel debe ser 1, 2 o 3.");
  }
  const generalStyle = buildGeneralStyle(args.personA, args.personB);
  const level = resolvedLevel(args.requestedLevel, args.personA, args.personB);
  const limitations: string[] = [];
  if (args.requestedLevel === 3 && level < 3) {
    limitations.push(
      "La comparación quedó en fecha contra fecha porque necesitamos la hora exacta y la carta completa de ambas personas para sumar Ascendentes, Descendentes y casas."
    );
  }
  if (args.requestedLevel >= 2 && level === 1) {
    limitations.push("La comparación quedó en signo contra signo porque faltan posiciones planetarias de ambas fechas.");
  }

  if (level === 2) {
    limitations.push(
      "En fecha contra fecha no usamos Ascendentes ni casas, y tampoco ubicamos los planetas de una persona en las casas de la otra."
    );
    for (const chart of [args.personA, args.personB]) {
      if (chart.birthTimePrecision !== "known") {
        const moon = normalizedPlacements(chart).get("moon");
        if (moon && moon.samples.length < 2 && !moon.timeStable) {
          limitations.push(
            `${chart.name?.trim() || "Una de las personas"}: la Luna se omite porque una única posición sin hora no representa todo el día.`
          );
        }
      }
    }
  }

  const dimensions =
    level === 1
      ? []
      : buildDimensions({
          level,
          a: args.personA,
          b: args.personB,
          limitations,
          relationshipType: args.relationshipType,
        });
  const levelLabel = level === 1 ? "signo contra signo" : level === 2 ? "fecha contra fecha" : "carta contra carta";
  return {
    methodVersion: RELATIONSHIP_COMPARISON_VERSION,
    requestedLevel: args.requestedLevel,
    level,
    levelLabel,
    generalStyle,
    dimensions,
    limitations: Array.from(new Set(limitations)),
    disclaimer:
      args.relationshipType === "romantic"
        ? "Esto muestra patrones simbólicos entre las dos cartas. No mide amor, no decide si son compatibles y no predice cuánto va a durar el vínculo."
        : "Esto muestra patrones simbólicos entre las dos cartas. No mide el valor del vínculo, no decide si son compatibles y no predice cuánto va a durar."
  };
}
