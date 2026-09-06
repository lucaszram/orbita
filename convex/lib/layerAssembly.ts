/**
 * Ensambladores puros para las capas V4.9.2.
 *
 * Este módulo sólo transforma cálculos ya normalizados al contrato público de
 * `layerContract.ts`. No consulta Convex, no llama proveedores y no completa
 * huecos con valores de maqueta.
 */

import type {
  AnalysisData,
  AnalysisPrecision,
  AnalysisStatus,
  EphemerisPosition
} from "./layerContract";
import {
  SYNODIC_MONTH_DAYS,
  annualProfectionForDate,
  computeElementMap,
  elementForSign,
  lunarElongationDegrees,
  lunarIlluminationFraction,
  lunarPhaseAtElongation,
  normalizeDegrees,
  normalizeZodiacSign,
  personalLunationPosition,
  type Element,
  type LunarPhaseId,
  type NatalPlanet,
  type ZodiacSign
} from "./layersMath";
import {
  buildOwnRelationshipPattern,
  type OwnRelationshipPattern,
  type RelationshipChartInput,
  type RelationshipPatternFacet,
  type RelationshipPointPrecision
} from "./relationshipLayers";
import {
  buildTransitLayers,
  type RankedTransit,
  type TransitArc,
  type TransitContactInput,
  type TransitLayers,
  type TransitReasonCode
} from "./transitLayers";
import type { NormalizedAstroHouse, NormalizedAstroPlacement } from "./orbita";

type LunarTypeData = Extract<AnalysisData, { kind: "lunar_type" }>;
type ElementMapData = Extract<AnalysisData, { kind: "element_map" }>;
type ProgressedLunationData = Extract<AnalysisData, { kind: "progressed_lunation" }>;
type AnnualProfectionData = Extract<AnalysisData, { kind: "annual_profection" }>;
type TemporalMandalaData = Extract<AnalysisData, { kind: "temporal_mandala" }>;
type TransitRankingData = Extract<AnalysisData, { kind: "transit_ranking" }>;
type TransitArcData = Extract<AnalysisData, { kind: "transit_arc" }>;
type MoonOnChartData = Extract<AnalysisData, { kind: "moon_on_chart" }>;
type CumplelunaData = Extract<AnalysisData, { kind: "cumpleluna" }>;
type RelationshipPatternData = Extract<AnalysisData, { kind: "relationship_pattern" }>;

export type BuildableAnalysisStatus = Extract<
  AnalysisStatus,
  "ready" | "partial" | "needs_birth_time" | "unavailable"
>;

/** Metadatos que necesita el caller para envolver el payload en AnalysisResult. */
export type LayerDataBuild<T> = {
  data: T | null;
  status: BuildableAnalysisStatus;
  precision: AnalysisPrecision;
  missingInputs: string[];
  limitations: string[];
};

export type TemporalMandalaSourceQuality = {
  progressedLunation?: { status: AnalysisStatus; precision: AnalysisPrecision };
  annualProfection?: { status: AnalysisStatus; precision: AnalysisPrecision };
  cumpleluna?: { status: AnalysisStatus; precision: AnalysisPrecision };
  transitArc?: { status: AnalysisStatus; precision: AnalysisPrecision };
};

export type NatalLayerDataBuild = {
  lunarType: LayerDataBuild<LunarTypeData>;
  elementMap: LayerDataBuild<ElementMapData>;
  relationshipPattern: LayerDataBuild<RelationshipPatternData>;
};

/** Subconjunto serializable de la carta que necesitan estos ensambladores. */
export type LayerChartInput = {
  birth: {
    birthDate: string;
    birthTimePrecision: "known" | "approximate" | "unknown";
  };
  placements: readonly NormalizedAstroPlacement[];
  houses: readonly NormalizedAstroHouse[];
};

const PLANET_LABELS: Record<string, string> = {
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
  ascendant: "Ascendente"
};

const SIGN_LABELS: Record<ZodiacSign, string> = {
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

const ELEMENT_LABELS: Record<Element, string> = {
  fire: "fuego",
  earth: "tierra",
  air: "aire",
  water: "agua"
};

/**
 * Artículo definido de cada elemento. No se puede derivar del género: `tierra`
 * y `agua` son los dos femeninos, pero `agua` empieza con /a/ tónica y por eso
 * lleva `el` en singular. Con un artículo fijo la lectura decía "El tierra
 * reúne cuatro de tus diez planetas".
 */
const ELEMENT_ARTICLES: Record<Element, "el" | "la"> = {
  fire: "el",
  earth: "la",
  air: "el",
  water: "el"
};

/** `la tierra` / `el agua`; con `capitalized`, para abrir una oración. */
function elementWithArticle(element: Element, options?: { capitalized?: boolean }) {
  const article = ELEMENT_ARTICLES[element];
  const shown = options?.capitalized ? `${article[0].toUpperCase()}${article.slice(1)}` : article;
  return `${shown} ${ELEMENT_LABELS[element]}`;
}

const RULER_LABELS: Record<string, string> = {
  sun: "Sol",
  moon: "Luna",
  mercury: "Mercurio",
  venus: "Venus",
  mars: "Marte",
  jupiter: "Júpiter",
  saturn: "Saturno"
};

/**
 * Versión editorial de las plantillas visibles de V4.9.2.
 *
 * Los cálculos siguen versionados por `analysisId`; esta constante permite
 * probar y revisar el copy como un catálogo determinista, sin respuestas
 * generadas ni frases atadas a una carta de maqueta.
 */
export const ASTROLOGY_EDITORIAL_COPY_VERSION = "orbita-v492-copy-clarity-v2" as const;

const HOUSE_THEMES: Record<number, string> = {
  1: "identidad, iniciativa y forma de presentarte",
  2: "recursos, ingresos, cuerpo y valor personal",
  3: "conversaciones, aprendizaje y entorno cercano",
  4: "hogar, familia, raíces e intimidad",
  5: "creatividad, disfrute, deseo y expresión personal",
  6: "rutinas, tareas, cuidado y trabajo cotidiano",
  7: "pareja, sociedades, contratos y acuerdos de a dos",
  8: "recursos compartidos, confianza y procesos de cambio",
  9: "estudios, creencias, viajes y búsqueda de sentido",
  10: "vocación, dirección pública y responsabilidades",
  11: "amistades, redes, proyectos y pertenencia",
  12: "descanso, cierres y vida interior"
};

type LunarPhaseCopy = {
  key: LunarTypeData["phaseKey"];
  name: string;
  natalInterpretation: string;
  progressedInterpretation: string;
  traits: LunarTypeData["traits"];
};

const LUNAR_PHASE_COPY: Record<LunarPhaseId, LunarPhaseCopy> = {
  new: {
    key: "new",
    name: "Nueva",
    natalInterpretation:
      "Esta fase se asocia con iniciar desde una intuición y darle forma a una dirección mientras avanza.",
    progressedInterpretation:
      "La fase nueva se asocia con iniciar un ciclo de largo plazo y explorar una dirección antes de definirla por completo.",
    traits: [
      {
        key: "starting",
        label: "Al empezar",
        body: "Una intuición puede darte el impulso inicial, aunque el mapa completo todavía no esté claro."
      },
      {
        key: "learning",
        label: "Ante un obstáculo",
        body: "La experiencia directa puede mostrarte qué parte de la idea necesita forma o límites."
      },
      {
        key: "closing",
        label: "Al cerrar",
        body: "Definir un criterio de cierre puede ayudarte a reconocer cuándo una etapa ya cumplió su función."
      }
    ]
  },
  waxing_crescent: {
    key: "crescent",
    name: "Creciente",
    natalInterpretation:
      "Esta fase se asocia con sostener una intención que todavía está tomando fuerza y necesita tiempo para desarrollarse.",
    progressedInterpretation:
      "La fase creciente se asocia con sostener lo iniciado y darle consistencia antes de que sus resultados sean visibles.",
    traits: [
      {
        key: "starting",
        label: "Al empezar",
        body: "Una señal concreta puede ayudarte a sostener una idea que recién está ganando fuerza."
      },
      {
        key: "learning",
        label: "Ante un obstáculo",
        body: "La constancia puede darte más información que el entusiasmo inicial."
      },
      {
        key: "closing",
        label: "Al cerrar",
        body: "Puede costar soltar una meta mientras todavía le veas potencial."
      }
    ]
  },
  first_quarter: {
    key: "first_quarter",
    name: "Cuarto creciente",
    natalInterpretation:
      "Esta fase se asocia con avanzar mediante la prueba y el ajuste, y con dar forma a algo que ya empezó.",
    progressedInterpretation:
      "El cuarto creciente se asocia con tomar decisiones y poner a prueba una dirección que ya empezó a desarrollarse.",
    traits: [
      {
        key: "starting",
        label: "Al empezar",
        body: "Cuando hay una meta concreta, la acción puede ayudarte a ordenar lo que todavía no está del todo definido."
      },
      {
        key: "learning",
        label: "Ante un obstáculo",
        body: "La experiencia directa suele darte información clave: probás, encontrás resistencia y ajustás."
      },
      {
        key: "closing",
        label: "Al cerrar",
        body: "La misma fuerza que te ayuda a avanzar puede hacer que sostengas un esfuerzo más tiempo del necesario."
      }
    ]
  },
  waxing_gibbous: {
    key: "gibbous",
    name: "Gibosa",
    natalInterpretation:
      "Esta fase se asocia con revisar y perfeccionar algo que ya tomó forma antes de consolidarlo.",
    progressedInterpretation:
      "La fase gibosa se asocia con revisar y perfeccionar algo que ya tomó forma; dentro de este ciclo vital, el énfasis está en ajustar antes de consolidar.",
    traits: [
      {
        key: "starting",
        label: "Al empezar",
        body: "Puede aparecer una necesidad de revisar qué falta antes de mostrar una idea."
      },
      {
        key: "learning",
        label: "Ante un obstáculo",
        body: "Comparar, practicar y corregir puede ayudarte a reconocer qué ajuste vale la pena."
      },
      {
        key: "closing",
        label: "Al cerrar",
        body: "El desafío posible es reconocer cuándo algo está suficientemente listo."
      }
    ]
  },
  full: {
    key: "full",
    name: "Llena",
    natalInterpretation:
      "Esta fase se asocia con reconocer resultados y contrastar una experiencia con la mirada de otras personas.",
    progressedInterpretation:
      "La fase llena se asocia con reconocer resultados y ver un proceso a través de sus vínculos, contrastes y efectos visibles.",
    traits: [
      {
        key: "starting",
        label: "Al empezar",
        body: "Una conversación o una mirada externa puede ayudarte a aclarar qué está en juego."
      },
      {
        key: "learning",
        label: "Ante un obstáculo",
        body: "Sostener dos perspectivas a la vez puede ampliar la comprensión sin exigir acuerdo."
      },
      {
        key: "closing",
        label: "Al cerrar",
        body: "Distinguir comprensión de acuerdo puede ayudarte a cerrar sin borrar las diferencias."
      }
    ]
  },
  waning_gibbous: {
    key: "disseminating",
    name: "Diseminante",
    natalInterpretation:
      "Esta fase se asocia con dar sentido a lo vivido y compartir lo aprendido sin convertirlo en una verdad universal.",
    progressedInterpretation:
      "La fase diseminante se asocia con organizar una experiencia, extraer un aprendizaje y encontrar una forma de compartirlo.",
    traits: [
      {
        key: "starting",
        label: "Al empezar",
        body: "Saber para qué puede servir lo que hacés puede ayudarte a encontrar una dirección."
      },
      {
        key: "learning",
        label: "Ante un obstáculo",
        body: "Poner una experiencia en palabras puede ayudarte a reconocer qué aprendiste."
      },
      {
        key: "closing",
        label: "Al cerrar",
        body: "Compartir una conclusión puede completar el proceso sin volverla una verdad universal."
      }
    ]
  },
  last_quarter: {
    key: "last_quarter",
    name: "Cuarto menguante",
    natalInterpretation:
      "Esta fase se asocia con revisar estructuras conocidas y reorganizar lo que dejó de acompañar un cambio.",
    progressedInterpretation:
      "El cuarto menguante se asocia con revisar estructuras, cuestionar hábitos y reorientar lo que ya no acompaña el proceso.",
    traits: [
      {
        key: "starting",
        label: "Al empezar",
        body: "Antes de sumar algo nuevo, puede ayudarte revisar qué conviene reorganizar."
      },
      {
        key: "learning",
        label: "Ante un obstáculo",
        body: "Cuestionar una costumbre puede abrir una alternativa más adecuada al momento actual."
      },
      {
        key: "closing",
        label: "Al cerrar",
        body: "Elegir qué parte de la experiencia querés conservar puede volver más claro el cierre."
      }
    ]
  },
  waning_crescent: {
    key: "balsamic",
    name: "Balsámica",
    natalInterpretation:
      "Esta fase se asocia con cerrar, decantar una experiencia y preparar espacio antes de iniciar el ciclo siguiente.",
    progressedInterpretation:
      "La fase balsámica se asocia con completar un ciclo, decantar lo vivido y preparar espacio para una etapa nueva.",
    traits: [
      {
        key: "starting",
        label: "Al empezar",
        body: "Un tiempo de pausa puede ayudarte a registrar qué quedó pendiente antes de avanzar."
      },
      {
        key: "learning",
        label: "Ante un obstáculo",
        body: "La intuición puede ganar claridad cuando también encuentra palabras y límites."
      },
      {
        key: "closing",
        label: "Al cerrar",
        body: "Tomar distancia por un momento puede ser una forma activa de completar el proceso."
      }
    ]
  }
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
  ascendente: "ascendant"
};

function plainKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pointKey(value: string): string {
  const normalized = plainKey(value);
  return POINT_ALIASES[normalized] ?? normalized;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function rounded(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

type UnitRange = { from: number; to: number };

function orderedUnitRange(range: UnitRange | null | undefined): UnitRange | null {
  if (
    !range ||
    !Number.isFinite(range.from) ||
    !Number.isFinite(range.to) ||
    range.to < range.from
  ) {
    return null;
  }
  return {
    from: rounded(clamp01(range.from), 6),
    to: rounded(clamp01(range.to), 6),
  };
}

function progressRangeForWindows(
  observedAt: number,
  previous: { earliest: number; latest: number },
  next: { earliest: number; latest: number },
): UnitRange | null {
  const candidates = [previous.earliest, previous.latest]
    .flatMap((start) =>
      [next.earliest, next.latest]
        .filter((end) => end > start)
        .map((end) => clamp01((observedAt - start) / (end - start))),
    );
  if (candidates.length === 0) return null;
  return orderedUnitRange({
    from: Math.min(...candidates),
    to: Math.max(...candidates),
  });
}

function placement(chart: LayerChartInput, key: string): NormalizedAstroPlacement | null {
  return chart.placements.find((candidate) => pointKey(candidate.key || candidate.label) === key) ?? null;
}

function validLongitude(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function unavailable<T>(missingInputs: string[], limitations: string[] = []): LayerDataBuild<T> {
  return {
    data: null,
    status: "unavailable",
    precision: "not_applicable",
    missingInputs,
    limitations
  };
}

function phaseForContract(elongationDegrees: number) {
  const phase = lunarPhaseAtElongation(elongationDegrees);
  return { phase, contract: LUNAR_PHASE_COPY[phase.id] };
}

function formatDecimal(value: number, digits = 1) {
  return rounded(value, digits).toString().replace(".", ",");
}

function natalPhaseSummary(copy: LunarPhaseCopy, elongationDegrees: number) {
  const phaseWording: Record<LunarTypeData["phaseKey"], string> = {
    new: "nueva",
    crescent: "creciente",
    first_quarter: "en cuarto creciente",
    gibbous: "gibosa",
    full: "llena",
    disseminating: "en fase diseminante",
    last_quarter: "en cuarto menguante",
    balsamic: "balsámica"
  };
  return `Naciste con la Luna ${phaseWording[copy.key]}: el Sol y la Luna estaban separados por ${formatDecimal(elongationDegrees)}°. ${copy.natalInterpretation}`;
}

function validatedElongationSamples(args: {
  chart: LayerChartInput;
  sun: NormalizedAstroPlacement;
  moon: NormalizedAstroPlacement;
  sunLongitudeSamples?: readonly number[];
  moonLongitudeSamples?: readonly number[];
}): number[] | null {
  const moonSamples = args.moonLongitudeSamples;
  const sunSamples = args.sunLongitudeSamples;
  if (!moonSamples || moonSamples.length === 0) return null;
  if (sunSamples && sunSamples.length !== moonSamples.length) {
    throw new RangeError("sunLongitudeSamples and moonLongitudeSamples must cover the same instants.");
  }
  if (!validLongitude(args.sun.fullDegree)) return null;

  return moonSamples.map((moonLongitude, index) => {
    const sunLongitude = sunSamples?.[index] ?? args.sun.fullDegree!;
    if (!Number.isFinite(sunLongitude) || !Number.isFinite(moonLongitude)) {
      throw new RangeError("Natal longitude samples must be finite numbers.");
    }
    return lunarElongationDegrees(sunLongitude, moonLongitude);
  });
}

function buildLunarTypeData(args: {
  chart: LayerChartInput;
  sunLongitudeSamples?: readonly number[];
  moonLongitudeSamples?: readonly number[];
}): LayerDataBuild<LunarTypeData> {
  const sun = placement(args.chart, "sun");
  const moon = placement(args.chart, "moon");
  if (!sun || !validLongitude(sun.fullDegree) || !moon || !validLongitude(moon.fullDegree)) {
    return unavailable(
      ["natal_sun_and_moon"],
      ["El tipo lunar necesita las posiciones del Sol y la Luna en el momento de tu nacimiento."]
    );
  }

  const knownTime = args.chart.birth.birthTimePrecision === "known";
  const representativeElongation = lunarElongationDegrees(sun.fullDegree, moon.fullDegree);
  let selectedElongation = representativeElongation;
  let precision: AnalysisPrecision = "exact";
  let status: BuildableAnalysisStatus = "ready";
  const limitations: string[] = [];
  const missingInputs: string[] = [];

  if (!knownTime) {
    const samples = validatedElongationSamples({ ...args, sun, moon });
    if (!samples) {
      return {
        data: null,
        status: "partial",
        precision: "range",
        missingInputs: ["birth_time_or_full_day_lunar_samples"],
        limitations: [
          "Sin hora exacta necesitamos revisar todo tu día de nacimiento; una sola hora no alcanza para elegir tu fase lunar."
        ]
      };
    }
    const phaseKeys = new Set(samples.map((sample) => lunarPhaseAtElongation(sample).id));
    if (phaseKeys.size !== 1) {
      return {
        data: null,
        status: "partial",
        precision: "range",
        missingInputs: ["exact_birth_time"],
        limitations: ["La Luna cruza un límite de fase durante tu día de nacimiento, así que no elegimos una sola fase."]
      };
    }
    precision = "estimated";
    status = "partial";
    selectedElongation = samples[Math.floor(samples.length / 2)];
    missingInputs.push("exact_birth_time");
    limitations.push(
      "La fase es la misma durante todo tu día de nacimiento, pero sin la hora exacta no podemos conocer la distancia precisa entre el Sol y la Luna."
    );
  }

  const { phase, contract } = phaseForContract(selectedElongation);
  return {
    data: {
      kind: "lunar_type",
      phaseIndex: phase.index,
      phaseKey: contract.key,
      name: contract.name,
      elongationDegrees: rounded(selectedElongation, 3),
      illumination: rounded(lunarIlluminationFraction(selectedElongation), 6),
      cyclePosition: rounded(selectedElongation / 360, 6),
      summary: natalPhaseSummary(contract, selectedElongation),
      traits: contract.traits
    },
    status,
    precision,
    missingInputs,
    limitations
  };
}

const NUMBER_WORDS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"] as const;

function numberWord(value: number) {
  return NUMBER_WORDS[value] ?? String(value);
}

function planetCountPhrase(value: number) {
  return value === 1 ? "un planeta" : `${numberWord(value)} planetas`;
}

function elementList(elements: readonly Element[]) {
  const labels = elements.map((element) => ELEMENT_LABELS[element]);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} y ${labels.at(-1)}`;
}

function elementCountContext(count: number, total: number) {
  if (total === 10) return `${numberWord(count)} de tus diez planetas`;
  if (total === 1) return "el único planeta disponible";
  return `${numberWord(count)} de los ${numberWord(total)} planetas disponibles`;
}

function elementCopy(args: {
  counts: Record<Element, number>;
  total: number;
  dominant: Element[];
  least: Element[];
}) {
  const { counts, total, dominant, least } = args;
  const resourceByElement: Record<Element, string> = {
    fire: "iniciar, expresar entusiasmo y poner energía en una dirección",
    earth: "dar forma concreta, orden y continuidad a una idea",
    air: "comparar ideas, encontrar perspectiva y poner en palabras lo que pasa",
    water: "una forma sensible e intuitiva de registrar lo que pasa"
  };
  const saturationByElement: Record<Element, string> = {
    fire: "pausar y evaluar consecuencias antes de actuar",
    earth: "probar una forma nueva cuando sostener lo conocido ya no alcanza",
    air: "salir de las posibilidades y tomar una decisión concreta",
    water: "tomar distancia de una emoción antes de decidir"
  };
  const balanceByElement: Record<Element, string> = {
    fire: "impulso, acción y dirección: probar una acción pequeña puede ayudarte a medir qué querés mover",
    earth: "forma, límite y continuidad: convertir una intención en un paso o una fecha puede volverla concreta",
    air: "palabras, comparación y perspectiva: poner nombre a lo que percibís puede ayudarte a ordenarlo",
    water: "sensibilidad y registro emocional: reconocer qué sentís puede sumar información antes de decidir"
  };

  const resource =
    dominant.length === 1
      ? `${elementWithArticle(dominant[0], { capitalized: true })} reúne ${elementCountContext(counts[dominant[0]], total)}. En este modelo, eso se asocia con ${resourceByElement[dominant[0]]}.`
      : dominant.length > 1
        ? `${elementList(dominant)} comparten el lugar más presente, con ${planetCountPhrase(counts[dominant[0]])} cada uno. En este modelo no hay un único recurso elemental dominante.`
        : "El mapa necesita más posiciones para mostrar qué elemento aparece con mayor frecuencia.";
  const overuse =
    dominant.length === 1
      ? `Cuando esa vía ocupa demasiado espacio, puede costar ${saturationByElement[dominant[0]]}.`
      : dominant.length > 1
        ? "Como no hay un único elemento dominante, este mapa no atribuye una sola forma de saturación."
        : "Sin posiciones suficientes, este mapa no atribuye una forma de saturación.";
  const cultivate =
    least.length === 1
      ? counts[least[0]] === 0
        ? `No hay planetas en ${ELEMENT_LABELS[least[0]]}. Este elemento se asocia con ${balanceByElement[least[0]]}.`
        : `${elementWithArticle(least[0], { capitalized: true })} es el elemento menos representado, con ${planetCountPhrase(counts[least[0]])}. En este modelo se asocia con ${balanceByElement[least[0]]}.`
      : least.length > 1
        ? `${elementList(least)} comparten el lugar menos representado. El mapa no elige uno como vía principal para equilibrar; esa lectura depende de la situación.`
        : "Los cuatro elementos están representados sin una diferencia que permita señalar uno como vía principal para equilibrar.";

  return { resource, overuse, cultivate };
}

function buildElementMapData(chart: LayerChartInput): LayerDataBuild<ElementMapData> {
  const byPlanet: Partial<Record<NatalPlanet, string>> = {};
  const normalizedPlacements = chart.placements
    .map((item) => ({ item, key: pointKey(item.key || item.label), sign: normalizeZodiacSign(item.sign || item.signEs) }))
    .filter(
      (entry): entry is { item: NormalizedAstroPlacement; key: NatalPlanet; sign: ZodiacSign } =>
        ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"].includes(
          entry.key
        ) && entry.sign !== null
    );
  for (const entry of normalizedPlacements) byPlanet[entry.key] = entry.sign;

  const result = computeElementMap(byPlanet);
  if (result.total === 0) {
    return unavailable(["natal_planet_positions"], ["El mapa elemental necesita posiciones natales de Sol a Plutón."]);
  }
  const elements = ["fire", "earth", "air", "water"] as const;
  const minimum = Math.min(...elements.map((element) => result.counts[element]));
  const leastRepresented = elements.filter((element) => result.counts[element] === minimum);
  const copy = elementCopy({
    counts: result.counts,
    total: result.total,
    dominant: result.dominantElements,
    least: leastRepresented
  });
  const missingInputs = [...result.missingPlanets, ...result.invalidPlanets].map((planet) => `natal_${planet}`);
  const limitations =
    result.status === "complete"
      ? []
      : ["El conteo muestra sólo las posiciones disponibles; no completa planetas faltantes ni agrega el Ascendente."];

  return {
    data: {
      kind: "element_map",
      counts: result.counts,
      total: result.total,
      dominant: result.dominantElements,
      leastRepresented,
      placements: normalizedPlacements
        .map(({ item, key, sign }) => ({
          body: item.label || PLANET_LABELS[key] || key,
          sign: item.signEs || SIGN_LABELS[sign],
          element: elementForSign(sign)
        }))
        .sort((left, right) => {
          const order = Object.keys(PLANET_LABELS);
          return order.indexOf(pointKey(left.body)) - order.indexOf(pointKey(right.body));
        }),
      ...copy
    },
    status: result.status === "complete" ? "ready" : "partial",
    precision: "not_applicable",
    missingInputs,
    limitations
  };
}

function toRelationshipChart(args: {
  chart: LayerChartInput;
  moonLongitudeSamples?: readonly number[];
}): RelationshipChartInput {
  const knownTime = args.chart.birth.birthTimePrecision === "known";
  return {
    birthTimePrecision: knownTime ? "known" : args.chart.birth.birthTimePrecision,
    zodiacSign: placement(args.chart, "sun")?.sign ?? null,
    placements: args.chart.placements.map((item) => ({
      key: pointKey(item.key || item.label),
      label: item.label,
      sign: item.sign,
      fullDegree: item.fullDegree,
      longitudeSamples: pointKey(item.key || item.label) === "moon" ? args.moonLongitudeSamples : undefined,
      timeStable:
        pointKey(item.key || item.label) !== "moon" ||
        (args.moonLongitudeSamples !== undefined &&
          new Set(args.moonLongitudeSamples.map((sample) => Math.floor(normalizeDegrees(sample) / 30))).size === 1),
      house: knownTime ? item.house : null
    })),
    houses: knownTime
      ? args.chart.houses.map((house) => ({ house: house.house, degree: house.degree, sign: house.sign }))
      : []
  };
}

function precisionFromFacets(facets: readonly RelationshipPatternFacet[]): AnalysisPrecision {
  if (facets.some((facet) => facet.precision === "range")) return "range";
  if (facets.some((facet) => facet.precision === "estimated")) return "estimated";
  return facets.length > 0 ? "exact" : "not_applicable";
}

function relationshipPatternToContract(pattern: OwnRelationshipPattern): RelationshipPatternData | null {
  const facets = [pattern.emotionalNeed, pattern.affectionStyle, pattern.desireStyle].filter(
    (facet): facet is RelationshipPatternFacet => facet !== null
  );
  const facetByPoint = new Map(facets.map((facet) => [facet.point, facet]));
  if (facetByPoint.size === 0) return null;

  const includedPoints = [
    ...Array.from(facetByPoint.values()).map((facet) => facet.label),
    ...(pattern.relationshipAxis ? ["Descendente y casa 7"] : [])
  ];
  const excludedPoints = [
    ...(["moon", "venus", "mars"] as const)
      .filter((point) => !facetByPoint.has(point))
      .map((point) => PLANET_LABELS[point]),
    ...(!pattern.relationshipAxis ? ["Descendente y casa 7"] : [])
  ];

  return {
    kind: "relationship_pattern",
    facets: facets.map((facet) => ({
      key:
        facet.point === "moon"
          ? "emotional_need"
          : facet.point === "venus"
            ? "affection_style"
            : "desire_style",
      label: facet.label,
      title: facet.title,
      signs: facet.signs.map((sign) => SIGN_LABELS[sign]),
      precision: facet.precision,
      summary: facet.text
    })),
    relationshipAxis: pattern.relationshipAxis
      ? {
          descendantSign: SIGN_LABELS[pattern.relationshipAxis.descendantSign],
          house7Planets: pattern.relationshipAxis.house7Planets.map((item) => item.label),
          summary: pattern.relationshipAxis.text
        }
      : null,
    includedPoints,
    excludedPoints,
    summary:
      "Este mapa reúne Luna, Venus y Marte. Si la hora es exacta también suma el Descendente —el punto opuesto al Ascendente— y la casa 7. No es un puntaje sobre tu forma de vincularte."
  };
}

function buildRelationshipPatternData(args: {
  chart: LayerChartInput;
  moonLongitudeSamples?: readonly number[];
}): LayerDataBuild<RelationshipPatternData> {
  const pattern = buildOwnRelationshipPattern({ chart: toRelationshipChart(args) });
  const data = relationshipPatternToContract(pattern);
  const missingInputs: string[] = [];
  if (!pattern.emotionalNeed) missingInputs.push("stable_natal_moon");
  if (!pattern.affectionStyle) missingInputs.push("natal_venus");
  if (!pattern.desireStyle) missingInputs.push("natal_mars");
  if (!pattern.relationshipAxis) missingInputs.push("exact_birth_time_and_houses");
  return {
    data,
    status:
      pattern.status === "unavailable"
        ? "unavailable"
        : pattern.status === "ready" && pattern.relationshipAxis
          ? "ready"
          : "partial",
    precision: data ? precisionFromFacets([pattern.emotionalNeed, pattern.affectionStyle, pattern.desireStyle].filter(
      (facet): facet is RelationshipPatternFacet => facet !== null
    )) : "not_applicable",
    missingInputs,
    limitations: pattern.limitations
  };
}

export function buildNatalLayerData(args: {
  chart: LayerChartInput | null;
  sunLongitudeSamples?: readonly number[];
  moonLongitudeSamples?: readonly number[];
}): NatalLayerDataBuild {
  if (!args.chart) {
    const missing = ["natal_chart"];
    return {
      lunarType: unavailable(missing),
      elementMap: unavailable(missing),
      relationshipPattern: unavailable(missing)
    };
  }
  return {
    lunarType: buildLunarTypeData({
      chart: args.chart,
      sunLongitudeSamples: args.sunLongitudeSamples,
      moonLongitudeSamples: args.moonLongitudeSamples
    }),
    elementMap: buildElementMapData(args.chart),
    relationshipPattern: buildRelationshipPatternData({
      chart: args.chart,
      moonLongitudeSamples: args.moonLongitudeSamples
    })
  };
}

function normalizeEphemerisKey(position: EphemerisPosition): string {
  return pointKey(position.key || position.label);
}

function houseAtLongitude(houses: readonly NormalizedAstroHouse[], longitude: number): NormalizedAstroHouse | null {
  const ordered = houses
    .filter(
      (house): house is NormalizedAstroHouse & { degree: number } =>
        Number.isInteger(house.house) && house.house >= 1 && house.house <= 12 && validLongitude(house.degree)
    )
    .sort((left, right) => left.house - right.house);
  if (ordered.length !== 12 || new Set(ordered.map((house) => house.house)).size !== 12) return null;

  const target = normalizeDegrees(longitude);
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const next = ordered[(index + 1) % ordered.length];
    const span = normalizeDegrees(next.degree - current.degree);
    const offset = normalizeDegrees(target - current.degree);
    if (span > 0 && offset < span) return current;
  }
  return null;
}

export function buildCurrentMoonLayerData(args: {
  chart: LayerChartInput | null;
  ephemeris: readonly EphemerisPosition[];
}): LayerDataBuild<MoonOnChartData> {
  const sun = args.ephemeris.find((position) => normalizeEphemerisKey(position) === "sun");
  const moon = args.ephemeris.find((position) => normalizeEphemerisKey(position) === "moon");
  if (!sun || !moon || !Number.isFinite(sun.fullDegree) || !Number.isFinite(moon.fullDegree)) {
    return unavailable(["current_sun_and_moon"], ["La capa necesita posiciones actuales verificables de Sol y Luna."]);
  }
  const elongation = lunarElongationDegrees(sun.fullDegree, moon.fullDegree);
  const { contract } = phaseForContract(elongation);
  const knownTime = args.chart?.birth.birthTimePrecision === "known";
  const natalHouse = knownTime && args.chart ? houseAtLongitude(args.chart.houses, moon.fullDegree) : null;
  const limitations: string[] = [];
  const missingInputs: string[] = [];
  if (!args.chart) {
    missingInputs.push("natal_chart");
    limitations.push("Sin carta natal mostramos el signo y la fase actuales, pero no una casa personal.");
  } else if (!knownTime) {
    missingInputs.push("exact_birth_time");
    limitations.push("Sin hora exacta no asignamos la Luna actual a una casa natal.");
  } else if (!natalHouse) {
    missingInputs.push("complete_natal_houses");
    limitations.push("La hora figura como exacta, pero falta la carta completa con sus doce casas para ubicar la Luna de hoy.");
  }
  const sign = moon.signEs || moon.sign;
  const summary = natalHouse
    ? `Hoy la Luna pasa por tu casa ${natalHouse.house}, asociada a ${HOUSE_THEMES[natalHouse.house]}. Este foco cambia cada pocos días y no describe un hecho que tenga que ocurrir.`
    : `Hoy la Luna está en ${sign} y la fase actual es ${contract.name.toLocaleLowerCase("es")}. Sin una hora exacta de nacimiento no podemos ubicarla en una casa de tu carta.`;

  return {
    data: {
      kind: "moon_on_chart",
      sign,
      longitudeDegrees: rounded(normalizeDegrees(moon.fullDegree), 4),
      phaseKey: contract.key,
      phaseName: contract.name,
      illumination: rounded(lunarIlluminationFraction(elongation), 6),
      natalHouse: natalHouse?.house ?? null,
      houseTheme: natalHouse ? HOUSE_THEMES[natalHouse.house] : null,
      summary
    },
    status: missingInputs.length === 0 ? "ready" : "partial",
    precision: "exact",
    missingInputs,
    limitations
  };
}

function ascendantSign(chart: LayerChartInput): ZodiacSign | null {
  const ascendant = placement(chart, "ascendant");
  return normalizeZodiacSign(ascendant?.sign || ascendant?.signEs || chart.houses.find((house) => house.house === 1)?.sign || "");
}

export function buildAnnualProfectionLayerData(args: {
  chart: LayerChartInput | null;
  asOfDate: string;
  civilDateToTimestamp: (civilDate: string) => number;
}): LayerDataBuild<AnnualProfectionData> {
  if (!args.chart) return unavailable(["natal_chart"]);
  if (args.chart.birth.birthTimePrecision !== "known") {
    return {
      data: null,
      status: "needs_birth_time",
      precision: "not_applicable",
      missingInputs: ["exact_birth_time"],
      limitations: [
        "Este cálculo recorre una casa distinta en cada cumpleaños y necesita una hora de nacimiento exacta."
      ]
    };
  }
  const ascendant = ascendantSign(args.chart);
  if (!ascendant) {
    return unavailable(
      ["ascendant_sign"],
      ["No pudimos confirmar tu Ascendente, que es el punto desde el que empieza este recorrido anual por las doce casas."]
    );
  }
  const calculation = annualProfectionForDate({
    birthDate: args.chart.birth.birthDate,
    asOfDate: args.asOfDate,
    ascendantSign: ascendant
  });
  const periodStart = args.civilDateToTimestamp(calculation.periodStart);
  const periodEnd = args.civilDateToTimestamp(calculation.periodEnd);
  const observedAt = args.civilDateToTimestamp(args.asOfDate);
  if (![periodStart, periodEnd, observedAt].every(Number.isFinite) || periodEnd <= periodStart) {
    throw new RangeError("civilDateToTimestamp must return finite, increasing timestamps.");
  }
  const periodProgress = clamp01((observedAt - periodStart) / (periodEnd - periodStart));
  const monthIndex = Math.min(12, Math.floor(periodProgress * 12) + 1);
  const signLabel = SIGN_LABELS[calculation.sign];
  const rulerLabel = RULER_LABELS[calculation.ruler];
  return {
    data: {
      kind: "annual_profection",
      age: calculation.age,
      house: calculation.house,
      sign: signLabel,
      ruler: rulerLabel,
      periodStart,
      periodEnd,
      monthIndex,
      summary: `La profección anual es un método que recorre una casa de tu carta por cada año de vida. Este año llega a la casa ${calculation.house}, asociada a ${HOUSE_THEMES[calculation.house]}. Como esa casa empieza en ${signLabel}, ${rulerLabel} es el regente del año: este método usa ese planeta para leer cómo se expresan esos temas.`
    },
    status: "ready",
    precision: "exact",
    missingInputs: [],
    limitations: ["El cumpleaños del 29 de febrero se toma el 28 de febrero en años no bisiestos."]
  };
}

export function buildProgressedLunationLayerData(args: {
  birthTimePrecision: "known" | "approximate" | "unknown";
  progressedSunLongitude: number;
  progressedMoonLongitude: number;
  progressedElongationRangeDegrees?: { from: number; to: number };
  ageYears: number;
  observedAt: number;
  phaseStartedAt: number;
  nextPhaseAt: number;
  phaseStartedAtRange?: { earliest: number; latest: number };
  nextPhaseAtRange?: { earliest: number; latest: number };
}): LayerDataBuild<ProgressedLunationData> {
  const isEstimated = args.birthTimePrecision !== "known";
  if (
    isEstimated &&
    (!args.phaseStartedAtRange || !args.nextPhaseAtRange)
  ) {
    return {
      data: null,
      status: "needs_birth_time",
      precision: "not_applicable",
      missingInputs: ["exact_birth_time"],
      limitations: [
        "Para ubicar esta etapa de varios años necesitamos la hora exacta de nacimiento; con una hora aproximada mostraríamos una precisión que no tenemos."
      ]
    };
  }
  const timingRanges = [args.phaseStartedAtRange, args.nextPhaseAtRange].filter(
    (range): range is { earliest: number; latest: number } => Boolean(range),
  );
  const elongationRange = args.progressedElongationRangeDegrees;
  const numeric = [
    args.progressedSunLongitude,
    args.progressedMoonLongitude,
    args.ageYears,
    args.observedAt,
    args.phaseStartedAt,
    args.nextPhaseAt,
    ...timingRanges.flatMap((range) => [range.earliest, range.latest]),
    ...(elongationRange ? [elongationRange.from, elongationRange.to] : []),
  ];
  if (
    !numeric.every(Number.isFinite) ||
    args.nextPhaseAt <= args.phaseStartedAt ||
    args.observedAt < args.phaseStartedAt ||
    args.observedAt > args.nextPhaseAt ||
    timingRanges.some((range) => range.latest < range.earliest) ||
    (elongationRange &&
      (elongationRange.from < 0 ||
        elongationRange.to > 360 ||
        elongationRange.to < elongationRange.from)) ||
    (args.phaseStartedAtRange &&
      (args.phaseStartedAt < args.phaseStartedAtRange.earliest ||
        args.phaseStartedAt > args.phaseStartedAtRange.latest ||
        args.phaseStartedAtRange.latest > args.observedAt)) ||
    (args.nextPhaseAtRange &&
      (args.nextPhaseAt < args.nextPhaseAtRange.earliest ||
        args.nextPhaseAt > args.nextPhaseAtRange.latest ||
        args.nextPhaseAtRange.earliest < args.observedAt))
  ) {
    throw new RangeError("Progressed lunation inputs must be finite and have an ordered phase window.");
  }
  const elongation = lunarElongationDegrees(args.progressedSunLongitude, args.progressedMoonLongitude);
  if (
    elongationRange &&
    (elongation < elongationRange.from || elongation > elongationRange.to)
  ) {
    throw new RangeError("The representative progressed elongation must fall inside its range.");
  }
  const { phase, contract } = phaseForContract(elongation);
  const pointProgress = clamp01(
    (args.observedAt - args.phaseStartedAt) /
      (args.nextPhaseAt - args.phaseStartedAt),
  );
  const progressRange =
    isEstimated && args.phaseStartedAtRange && args.nextPhaseAtRange
      ? progressRangeForWindows(
          args.observedAt,
          args.phaseStartedAtRange,
          args.nextPhaseAtRange,
        )
      : null;
  if (isEstimated && !progressRange) {
    throw new RangeError("An estimated progressed lunation must expose an ordered progress range.");
  }
  const cyclePositionRange =
    isEstimated && elongationRange
      ? orderedUnitRange({
          from: elongationRange.from / 360,
          to: elongationRange.to / 360,
        })
      : null;
  return {
    data: {
      kind: "progressed_lunation",
      phaseIndex: phase.index,
      phaseKey: contract.key,
      name: contract.name,
      progressedElongationDegrees: rounded(elongation, 4),
      ...(elongationRange
        ? {
            progressedElongationRangeDegrees: {
              from: rounded(elongationRange.from, 4),
              to: rounded(elongationRange.to, 4),
            },
          }
        : {}),
      ageYears: rounded(args.ageYears, 4),
      phaseStartedAt: args.phaseStartedAt,
      nextPhaseAt: args.nextPhaseAt,
      ...(args.phaseStartedAtRange
        ? { phaseStartedAtRange: args.phaseStartedAtRange }
        : {}),
      ...(args.nextPhaseAtRange
        ? { nextPhaseAtRange: args.nextPhaseAtRange }
        : {}),
      ...(!isEstimated
        ? {
            cyclePosition: rounded(elongation / 360, 6),
            progress: rounded(pointProgress, 6),
          }
        : {}),
      ...(cyclePositionRange ? { cyclePositionRange } : {}),
      ...(progressRange ? { progressRange } : {}),
      summary: `La fase actual de tu estación vital es ${contract.name.toLocaleLowerCase("es")}. Este cálculo sigue de forma simbólica cómo cambia la relación entre el Sol y la Luna a lo largo de un ciclo de unos 30 años. ${contract.progressedInterpretation}`
    },
    status: isEstimated ? "partial" : "ready",
    precision: isEstimated ? "estimated" : "exact",
    missingInputs: isEstimated ? ["exact_birth_time"] : [],
    limitations: isEstimated
      ? [
          "La fase se mantiene durante todo el día civil de nacimiento; las fechas de cambio se muestran como rangos porque no elegimos una hora arbitraria.",
          `La incertidumbre máxima de cada fecha central es de ±${rounded(
            Math.max(
              (args.phaseStartedAtRange!.latest - args.phaseStartedAtRange!.earliest) / 2,
              (args.nextPhaseAtRange!.latest - args.nextPhaseAtRange!.earliest) / 2,
            ) / (30 * 24 * 60 * 60 * 1000),
            1,
          )} meses, derivada del intervalo natal completo.`,
          ...(args.birthTimePrecision === "approximate"
            ? ["La hora aproximada no declara un margen verificable y por eso se trató como desconocida."]
            : []),
        ]
      : []
  };
}

export function buildCumplelunaLayerData(args: {
  natalSunLongitude?: number;
  natalMoonLongitude?: number;
  natalElongationDegrees?: number;
  natalElongationRangeDegrees?: { from: number; to: number };
  currentSunLongitude: number;
  currentMoonLongitude: number;
  previousExactAt: number;
  nextExactAt: number;
  previousExactAtRange?: { earliest: number; latest: number };
  nextExactAtRange?: { earliest: number; latest: number };
  observedAt: number;
  natalPrecision: "exact" | "estimated" | "range";
  birthTimePrecision?: "known" | "approximate" | "unknown";
}): LayerDataBuild<CumplelunaData> {
  const hasNatalElongation = typeof args.natalElongationDegrees === "number";
  const hasNatalLuminaries =
    typeof args.natalSunLongitude === "number" &&
    typeof args.natalMoonLongitude === "number";
  if (!hasNatalElongation && !hasNatalLuminaries) {
    throw new RangeError("Cumpleluna requires a natal elongation or both natal luminaries.");
  }
  const natalElongation = hasNatalElongation
    ? normalizeDegrees(args.natalElongationDegrees!)
    : lunarElongationDegrees(args.natalSunLongitude!, args.natalMoonLongitude!);
  const timingRanges = [args.previousExactAtRange, args.nextExactAtRange].filter(
    (range): range is { earliest: number; latest: number } => Boolean(range),
  );
  const angularRange = args.natalElongationRangeDegrees;
  const isExact = args.natalPrecision === "exact";
  if (
    !isExact &&
    (!angularRange || !args.previousExactAtRange || !args.nextExactAtRange)
  ) {
    throw new RangeError("An inexact Cumpleluna must publish its natal and timing ranges.");
  }
  const numeric = [
    natalElongation,
    args.currentSunLongitude,
    args.currentMoonLongitude,
    args.previousExactAt,
    args.nextExactAt,
    args.observedAt,
    ...timingRanges.flatMap((range) => [range.earliest, range.latest]),
    ...(angularRange ? [angularRange.from, angularRange.to] : []),
  ];
  if (
    !numeric.every(Number.isFinite) ||
    args.nextExactAt <= args.previousExactAt ||
    timingRanges.some((range) => range.latest < range.earliest) ||
    (args.previousExactAtRange &&
      (args.previousExactAt < args.previousExactAtRange.earliest ||
        args.previousExactAt > args.previousExactAtRange.latest ||
        args.previousExactAtRange.latest > args.observedAt)) ||
    (args.nextExactAtRange &&
      (args.nextExactAt < args.nextExactAtRange.earliest ||
        args.nextExactAt > args.nextExactAtRange.latest ||
        args.nextExactAtRange.earliest < args.observedAt)) ||
    (angularRange &&
      (angularRange.to < angularRange.from ||
        natalElongation < angularRange.from ||
        natalElongation > angularRange.to))
  ) {
    throw new RangeError("Cumpleluna inputs must be finite and have two ordered roots.");
  }
  if (args.observedAt < args.previousExactAt || args.observedAt > args.nextExactAt) {
    throw new RangeError("observedAt must fall inside the Cumpleluna cycle roots.");
  }
  const currentElongation = lunarElongationDegrees(args.currentSunLongitude, args.currentMoonLongitude);
  const angularPosition = personalLunationPosition(natalElongation, currentElongation);
  const cycleLengthDays = (args.nextExactAt - args.previousExactAt) / 86_400_000;
  const cycleDay = (args.observedAt - args.previousExactAt) / 86_400_000;
  const daysRemaining = (args.nextExactAt - args.observedAt) / 86_400_000;
  const progress = clamp01((args.observedAt - args.previousExactAt) / (args.nextExactAt - args.previousExactAt));
  const previousRange = args.previousExactAtRange;
  const nextRange = args.nextExactAtRange;
  const daysRemainingRange = nextRange
    ? {
        from: (nextRange.earliest - args.observedAt) / 86_400_000,
        to: (nextRange.latest - args.observedAt) / 86_400_000,
      }
    : undefined;
  const cycleDayRange = previousRange
    ? {
        from: (args.observedAt - previousRange.latest) / 86_400_000,
        to: (args.observedAt - previousRange.earliest) / 86_400_000,
      }
    : undefined;
  const cycleLengthDaysRange = previousRange && nextRange
    ? {
        from: (nextRange.earliest - previousRange.latest) / 86_400_000,
        to: (nextRange.latest - previousRange.earliest) / 86_400_000,
      }
    : undefined;
  const progressRange = previousRange && nextRange
    ? [previousRange.earliest, previousRange.latest]
        .flatMap((previous) =>
          [nextRange.earliest, nextRange.latest].map((next) =>
            clamp01((args.observedAt - previous) / (next - previous)),
          ),
        )
        .reduce(
          (range, value) => ({
            from: Math.min(range.from, value),
            to: Math.max(range.to, value),
          }),
          { from: Number.POSITIVE_INFINITY, to: Number.NEGATIVE_INFINITY },
        )
    : undefined;
  const dayLabel = daysRemaining < 1 ? "hoy" : `en ${Math.ceil(daysRemaining)} días`;
  const rangeWidthHours = nextRange
    ? (nextRange.latest - nextRange.earliest) / (60 * 60 * 1000)
    : 0;
  return {
    data: {
      kind: "cumpleluna",
      natalElongationDegrees: rounded(natalElongation, 4),
      ...(angularRange
        ? {
            natalElongationRangeDegrees: {
              from: rounded(angularRange.from, 4),
              to: rounded(angularRange.to, 4),
            },
          }
        : {}),
      currentElongationDegrees: rounded(currentElongation, 4),
      previousExactAt: args.previousExactAt,
      nextExactAt: args.nextExactAt,
      ...(previousRange ? { previousExactAtRange: previousRange } : {}),
      ...(nextRange ? { nextExactAtRange: nextRange } : {}),
      daysRemaining: rounded(daysRemaining, 4),
      ...(daysRemainingRange
        ? {
            daysRemainingRange: {
              from: rounded(daysRemainingRange.from, 4),
              to: rounded(daysRemainingRange.to, 4),
            },
          }
        : {}),
      cycleDay: rounded(cycleDay, 4),
      ...(cycleDayRange
        ? {
            cycleDayRange: {
              from: rounded(cycleDayRange.from, 4),
              to: rounded(cycleDayRange.to, 4),
            },
          }
        : {}),
      cycleLengthDays: rounded(cycleLengthDays, 4),
      ...(cycleLengthDaysRange
        ? {
            cycleLengthDaysRange: {
              from: rounded(cycleLengthDaysRange.from, 4),
              to: rounded(cycleLengthDaysRange.to, 4),
            },
          }
        : {}),
      progress: rounded(progress, 6),
      ...(progressRange
        ? {
            progressRange: {
              from: rounded(progressRange.from, 6),
              to: rounded(progressRange.to, 6),
            },
          }
        : {}),
      summary: isExact
        ? `La distancia entre el Sol y la Luna que había cuando naciste vuelve a repetirse ${dayLabel}. Ahí comienza otro ciclo personal de aproximadamente ${Math.round(SYNODIC_MONTH_DAYS)} días.`
        : `La distancia entre el Sol y la Luna de tu día de nacimiento vuelve a repetirse ${dayLabel}. Sin una hora exacta, el intervalo completo ubica esa repetición dentro de una ventana de ${rounded(rangeWidthHours, 1)} horas.`
    },
    status: isExact ? "ready" : "partial",
    precision: args.natalPrecision,
    missingInputs: isExact ? [] : ["exact_birth_time"],
    limitations: [
      `El avance de hoy equivale al día ${rounded(angularPosition.cycleDay, 1)} de un ciclo promedio. La fecha que mostramos se calculó con las posiciones del Sol y la Luna, no con ese promedio.`,
      ...(!isExact
        ? [
            "Los valores centrales son el punto medio de las ventanas publicadas; no representan una hora natal elegida por Órbita.",
            ...(args.birthTimePrecision === "approximate"
              ? ["La hora aproximada no declara un margen verificable y por eso se trató como desconocida."]
              : []),
          ]
        : []),
    ]
  };
}

export function buildTemporalMandalaData(args: {
  observedAt: number;
  progressedLunation?: ProgressedLunationData | null;
  annualProfection?: AnnualProfectionData | null;
  cumpleluna?: CumplelunaData | null;
  transitArc?: TransitArcData | null;
  sourceQuality?: TemporalMandalaSourceQuality;
}): TemporalMandalaData {
  const progressed = args.progressedLunation;
  const annual = args.annualProfection;
  const cumpleluna = args.cumpleluna;
  const transit = args.transitArc;
  const quality = <T>(
    explicit: { status: AnalysisStatus; precision: AnalysisPrecision } | undefined,
    data: T | null | undefined,
  ) =>
    explicit ?? {
      status: data ? ("ready" as const) : ("unavailable" as const),
      precision: data ? ("exact" as const) : ("not_applicable" as const),
    };
  const progressedQuality = quality(args.sourceQuality?.progressedLunation, progressed);
  const annualQuality = quality(args.sourceQuality?.annualProfection, annual);
  const cumplelunaQuality = quality(args.sourceQuality?.cumpleluna, cumpleluna);
  const transitQuality = quality(args.sourceQuality?.transitArc, transit);

  const progressDescriptor = (
    sourcePrecision: AnalysisPrecision,
    point: number | null | undefined,
    range: UnitRange | null | undefined,
  ) => {
    if (sourcePrecision === "exact" && typeof point === "number" && Number.isFinite(point)) {
      return {
        progressMode: "point" as const,
        progress: rounded(clamp01(point), 6),
      };
    }
    const orderedRange = orderedUnitRange(range);
    if (sourcePrecision !== "exact" && orderedRange) {
      return {
        progressMode: "range" as const,
        // Compatibility sentinel for the required v1 field. Consumers must
        // branch on progressMode and use the complete range instead.
        progress: -1,
        progressRange: orderedRange,
      };
    }
    return {
      progressMode: "unavailable" as const,
      progress: -1,
    };
  };

  const progressedRange = progressed
    ? progressed.progressRange ??
      (progressed.phaseStartedAtRange && progressed.nextPhaseAtRange
        ? progressRangeForWindows(
            args.observedAt,
            progressed.phaseStartedAtRange,
            progressed.nextPhaseAtRange,
          )
        : null)
    : null;
  const progressedProgress = progressDescriptor(
    progressedQuality.precision,
    progressed?.progress ??
      (progressed
        ? (args.observedAt - progressed.phaseStartedAt) /
          (progressed.nextPhaseAt - progressed.phaseStartedAt)
        : null),
    progressedRange,
  );
  const annualProgress = progressDescriptor(
    annualQuality.precision,
    annual
      ? (args.observedAt - annual.periodStart) /
        (annual.periodEnd - annual.periodStart)
      : null,
    null,
  );
  const cumplelunaProgress = progressDescriptor(
    cumplelunaQuality.precision,
    cumpleluna?.progress,
    cumpleluna?.progressRange,
  );
  const transitProgress = progressDescriptor(
    transitQuality.precision,
    transit?.progress,
    null,
  );

  const remainingLabel = !cumpleluna
    ? null
    : cumplelunaQuality.precision !== "exact" && cumpleluna.daysRemainingRange
      ? `Faltan entre ${formatDecimal(
          Math.max(0, cumpleluna.daysRemainingRange.from),
        )} y ${formatDecimal(
          Math.max(0, cumpleluna.daysRemainingRange.to),
        )} días para tu próxima Cumpleluna personal.`
      : Math.max(0, Math.ceil(cumpleluna.daysRemaining)) < 1
        ? "Tu próxima Cumpleluna personal es hoy."
        : Math.max(0, Math.ceil(cumpleluna.daysRemaining)) === 1
          ? "Falta 1 día para tu próxima Cumpleluna personal."
          : `Faltan ${Math.max(0, Math.ceil(cumpleluna.daysRemaining))} días para tu próxima Cumpleluna personal.`;

  const cumplelunaState = !cumpleluna
    ? "Sin cálculo disponible"
    : cumplelunaQuality.precision !== "exact" &&
        cumpleluna.cycleDayRange &&
        cumpleluna.cycleLengthDaysRange
      ? `Día entre ${formatDecimal(cumpleluna.cycleDayRange.from)} y ${formatDecimal(
          cumpleluna.cycleDayRange.to,
        )} de un ciclo de entre ${formatDecimal(
          cumpleluna.cycleLengthDaysRange.from,
        )} y ${formatDecimal(cumpleluna.cycleLengthDaysRange.to)} días`
      : cumplelunaQuality.precision === "exact"
        ? `Día ${formatDecimal(cumpleluna.cycleDay)} de ${formatDecimal(
            cumpleluna.cycleLengthDays,
          )}`
        : "El avance sólo está disponible como intervalo";
  return {
    kind: "temporal_mandala",
    rings: [
      {
        key: "progressed_lunation",
        label: "Estación vital",
        cadence: "cada fase dura alrededor de 3,7 años",
        state: progressed?.name ?? "Sin cálculo disponible",
        status: progressedQuality.status,
        precision: progressedQuality.precision,
        ...progressedProgress,
        detail: progressed?.summary ?? "Necesitamos una hora de nacimiento exacta para ubicar esta etapa de varios años sin inventar una fecha.",
        available: Boolean(progressed)
      },
      {
        key: "annual_profection",
        label: "Año personal",
        cadence: "de cumpleaños a cumpleaños",
        state: annual ? `Casa ${annual.house} · mes ${annual.monthIndex} de 12` : "Sin cálculo disponible",
        status: annualQuality.status,
        precision: annualQuality.precision,
        ...annualProgress,
        detail: annual?.summary ?? "Necesitamos una hora de nacimiento exacta para saber qué casa de tu carta corresponde a este año.",
        available: Boolean(annual)
      },
      {
        key: "cumpleluna",
        label: "Tu ritmo lunar",
        cadence: "Cumpleluna personal",
        state: cumplelunaState,
        status: cumplelunaQuality.status,
        precision: cumplelunaQuality.precision,
        ...cumplelunaProgress,
        detail:
          cumpleluna && remainingLabel
            ? `${remainingLabel} Este ritmo va de una repetición de tu ángulo natal Sol–Luna a la siguiente.`
            : "Necesitamos calcular dos Cumplelunas personales consecutivas para ubicar tu ritmo lunar.",
        available: Boolean(cumpleluna),
        ...(cumpleluna
          ? {
              cycleDay: cumpleluna.cycleDay,
              ...(cumpleluna.cycleDayRange
                ? { cycleDayRange: cumpleluna.cycleDayRange }
                : {}),
              cycleLengthDays: cumpleluna.cycleLengthDays,
              ...(cumpleluna.cycleLengthDaysRange
                ? { cycleLengthDaysRange: cumpleluna.cycleLengthDaysRange }
                : {}),
              daysRemaining: cumpleluna.daysRemaining,
              ...(cumpleluna.daysRemainingRange
                ? { daysRemainingRange: cumpleluna.daysRemainingRange }
                : {}),
              previousExactAt: cumpleluna.previousExactAt,
              ...(cumpleluna.previousExactAtRange
                ? { previousExactAtRange: cumpleluna.previousExactAtRange }
                : {}),
              nextExactAt: cumpleluna.nextExactAt,
              ...(cumpleluna.nextExactAtRange
                ? { nextExactAtRange: cumpleluna.nextExactAtRange }
                : {}),
            }
          : {})
      },
      {
        key: "transit_arc",
        label: "Tránsito activo",
        cadence: "dura días o semanas",
        state: transit
          ? `${transit.transitPlanet} con tu ${transit.natalPoint} · ${transitStateLabel(transit.state)}`
          : "Sin tránsito activo",
        status: transitQuality.status,
        precision: transitQuality.precision,
        ...transitProgress,
        detail:
          transit?.summary ??
          "No hay un contacto entre el cielo de hoy y tu carta lo bastante cercano como para seguirlo como un proceso.",
        available: Boolean(transit)
      }
    ],
    summary:
      "Cada anillo representa un ritmo personal distinto. Los externos avanzan en años o meses; los internos, entre dos Cumplelunas personales o según la duración de un tránsito. Así podés ubicar lo cotidiano dentro de procesos más largos."
  };
}

const TRANSIT_REASON_KEY: Record<TransitReasonCode, TransitRankingData["items"][number]["reasons"][number]["key"]> = {
  exactness: "exactness",
  natal_point: "natal_point",
  pace: "speed",
  angular_house: "angular_house",
  natal_ruler: "rulership",
  repeated_theme: "repeated_signature"
};

function timestamp(value: string | null): number | null {
  if (value === null) return null;
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new RangeError(`Invalid transit timestamp: ${value}`);
  return result;
}

function transitStateLabel(state: RankedTransit["stage"]): string {
  if (state === "approaching") return "se acerca";
  if (state === "exact") return "máxima precisión";
  return "sigue activo después del punto más preciso";
}

function transitReasonCopy(args: {
  transit: RankedTransit;
  reason: RankedTransit["reasons"][number];
}): { label: string; explanation: string } {
  const { transit, reason } = args;
  const distance = transit.orb.toFixed(2).replace(".", ",");
  if (reason.code === "exactness") {
    return {
      label: "Cercanía",
      explanation: `Está a ${distance}° de su máxima precisión.`
    };
  }
  if (reason.code === "natal_point") {
    return {
      label: "Parte de tu carta",
      explanation: `El contacto involucra tu ${transit.natalPoint}, por eso se interpreta de forma personal.`
    };
  }
  if (reason.code === "angular_house") {
    return {
      label: "Casa destacada",
      explanation: transit.natalHouse
        ? `Cae en tu casa ${transit.natalHouse}, vinculada con ${HOUSE_THEMES[transit.natalHouse]}.`
        : "Cae en una de las zonas principales de tu carta."
    };
  }
  if (reason.code === "natal_ruler") {
    return {
      label: "Planeta relevante en tu carta",
      explanation: `${transit.transitPlanet} tiene un papel adicional en tu carta natal, por eso este contacto gana relevancia.`
    };
  }
  if (reason.code === "repeated_theme") {
    return {
      label: "Tema repetido",
      explanation: "Más de un contacto activo involucra la misma parte de tu carta."
    };
  }
  return {
    label: "Duración",
    explanation: reason.detail
  };
}

function aspectWithArticle(aspect: Pick<RankedTransit["aspect"], "key" | "label">) {
  const article = aspect.key === "sextile" || aspect.key === "trine" ? "un" : "una";
  return `${article} ${aspect.label.toLocaleLowerCase("es")}`;
}

function transitStageSummary(transit: Pick<RankedTransit, "transitPlanet" | "natalPoint" | "aspect" | "stage">): string {
  const context =
    transit.stage === "approaching"
      ? "Todavía se está acercando al punto más preciso."
      : transit.stage === "exact"
        ? "Está en su momento de mayor exactitud."
      : "El punto más preciso ya pasó, pero el contacto sigue activo dentro del margen de 3° que usa Órbita.";
  return `${transit.transitPlanet} y tu ${transit.natalPoint} forman ${aspectWithArticle(transit.aspect)}, un contacto de ${transit.aspect.angle}°. ${context}`;
}

export function adaptTransitLayersToRankingData(layers: TransitLayers, observedAt: number): TransitRankingData {
  const arcs = new Map(layers.arcs.map((arc) => [arc.arcId, arc]));
  return {
    kind: "transit_ranking",
    items: layers.ranking.map((transit) => {
      const arc = arcs.get(transit.arcId);
      return {
        arcId: transit.arcId,
        transitPlanet: transit.transitPlanet,
        natalPoint: transit.natalPoint,
        aspect: transit.aspect.key,
        aspectDegrees: transit.aspect.angle,
        orbDegrees: rounded(transit.orb, 4),
        state: transit.stage,
        exactAt: timestamp(transit.exactAt),
        previousExactAt: timestamp(transit.previousExactAt),
        nextExactAt: timestamp(transit.nextExactAt),
        rankingWindow: {
          startsAt: timestamp(transit.rankingWindow.startAt)!,
          endsAt: timestamp(transit.rankingWindow.endAt)!
        },
        rankingReason: transit.rankingReason,
        startsAt: timestamp(arc?.window.startAt ?? null),
        endsAt: timestamp(arc?.window.endAt ?? null),
        natalHouse: transit.natalHouse,
        reasons: transit.reasons.map((reason) => ({
          key: TRANSIT_REASON_KEY[reason.code],
          ...transitReasonCopy({ transit, reason })
        })),
        summary: transitStageSummary(transit)
      };
    }),
    activeCount: layers.activeCount,
    calculatedAt: observedAt,
    summary:
      layers.activeCount === 0
        ? "Hoy no hay tránsitos principales a 3° o menos de su punto exacto. Por eso no aparece un ranking personal."
        : layers.activeCount === 1
          ? "Hoy hay 1 tránsito principal activo sobre tu carta. Se priorizan los contactos exactos de hoy, los próximos y los recientes; no es un puntaje personal."
          : `Hoy hay ${layers.activeCount} tránsitos principales activos sobre tu carta. Se priorizan los contactos exactos de hoy, los próximos y los recientes; después pesan el orbe y la relevancia natal. No es un puntaje personal.`
  };
}

export function adaptTransitArcToData(arc: TransitArc, observedAt: number): TransitArcData {
  const startsAt = timestamp(arc.window.startAt)!;
  const peakAt = timestamp(arc.window.peakAt)!;
  const endsAt = timestamp(arc.window.endAt)!;
  const progress = endsAt === startsAt ? (observedAt >= endsAt ? 1 : 0) : clamp01((observedAt - startsAt) / (endsAt - startsAt));
  const contact = `${arc.transitPlanet} forma ${aspectWithArticle(arc.aspect)} de ${arc.aspect.angle}° con tu ${arc.natalPoint}.`;
  const summary =
    arc.stage === "approaching"
      ? `${contact} Todavía se acerca al punto más preciso; la línea de tiempo ubica el proceso, pero no predice un hecho concreto.`
      : arc.stage === "exact"
        ? `${contact} Ahora está en su momento más preciso. Esto señala un tema para observar, no un hecho que tenga que ocurrir.`
      : `${contact} El punto más preciso ya pasó, pero el tránsito sigue activo dentro del margen de 3° hasta la fecha de cierre.`;
  return {
    kind: "transit_arc",
    arcId: arc.arcId,
    transitPlanet: arc.transitPlanet,
    natalPoint: arc.natalPoint,
    natalHouse: arc.natalHouse,
    aspect: arc.aspect.key,
    state: arc.stage,
    startsAt,
    peakAt,
    endsAt,
    previousExactAt: timestamp(arc.previousExactAt),
    nextExactAt: timestamp(arc.nextExactAt),
    rankingWindow: {
      startsAt: timestamp(arc.rankingWindow.startAt)!,
      endsAt: timestamp(arc.rankingWindow.endAt)!
    },
    rankingReason: arc.rankingReason,
    progress: rounded(progress, 6),
    passes: arc.passes.map((pass, index) => ({
      exactAt: timestamp(pass.exactAt)!,
      direction: pass.direction,
      label: `${index + 1}.º contacto · el planeta ${pass.direction === "retrograde" ? "parece retroceder" : "parece avanzar"}`
    })),
    summary
  };
}

export function buildTransitRankingLayerData(args: {
  contacts: TransitContactInput[];
  observedAt: number;
  localDate?: string;
  timezone?: string;
}): LayerDataBuild<TransitRankingData> {
  const layers = buildTransitLayers(args.contacts, {
    referenceTime: args.observedAt,
    localDate: args.localDate,
    timezone: args.timezone
  });
  return {
    data: adaptTransitLayersToRankingData(layers, args.observedAt),
    status: "ready",
    precision: "exact",
    missingInputs: [],
    limitations: [
      "La lista incluye cinco tipos de contacto: conjunción, sextil, cuadratura, trígono y oposición. Sólo se muestran cuando faltan 3° o menos para su máxima precisión."
    ]
  };
}

export function buildTransitArcLayerData(args: {
  contacts: TransitContactInput[];
  observedAt: number;
  arcId?: string;
  localDate?: string;
  timezone?: string;
}): LayerDataBuild<TransitArcData> {
  const layers = buildTransitLayers(args.contacts, {
    referenceTime: args.observedAt,
    localDate: args.localDate,
    timezone: args.timezone
  });
  const selectedArc = args.arcId
    ? layers.arcs.find((arc) => arc.arcId === args.arcId)
    : layers.ranking.length > 0
      ? layers.arcs.find((arc) => arc.arcId === layers.ranking[0].arcId)
      : null;
  if (!selectedArc) {
    return {
      data: null,
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: [args.arcId ? "requested_transit_arc" : "active_transit_arc"],
      limitations: [
        "El seguimiento de un proceso aparece sólo cuando hay un contacto principal activo a 3° o menos de su máxima precisión."
      ]
    };
  }
  return {
    data: adaptTransitArcToData(selectedArc, args.observedAt),
    status: "ready",
    precision: "exact",
    missingInputs: [],
    limitations: []
  };
}
