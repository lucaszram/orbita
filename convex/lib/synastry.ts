/**
 * Sinastría — contactos REALES entre dos cartas (CORE-212).
 *
 * No hay porcentaje de compatibilidad: lo que se publica es la lista de
 * aspectos mayores entre los planetas de una carta y los de la otra, con su
 * orbe medido, y los conteos que salen de esa lista. Todo es puro: recibe dos
 * cartas normalizadas (`NormalizedAstroChart`) y devuelve números y textos que
 * se pueden verificar a mano. Lo que una carta no tiene —hora, lugar, ejes— no
 * se rellena: se declara.
 */
import type { NormalizedAstroChart, NormalizedAstroPlacement } from "./orbita";

export type SynastryLevel = "signo" | "fecha" | "carta";
export type SynastryTone = "armonico" | "tenso" | "fusion";
export type SynastryDimension = "hablan" | "cuidan" | "deseo";

export type SynastryContact = {
  /** `sun-sextile-moon`: estable para React y para abrir un detalle más adelante. */
  id: string;
  /** Punto de la primera carta (la persona con sesión). */
  from: { key: string; label: string };
  /** Punto de la segunda carta (la persona guardada). */
  to: { key: string; label: string };
  aspect: "conjunction" | "sextile" | "square" | "trine" | "opposition";
  aspectEs: string;
  symbol: string;
  /** Orbe medido en grados decimales, y su etiqueta `2° 10'`. */
  orb: number;
  orbLabel: string;
  tone: SynastryTone;
  dimensions: SynastryDimension[];
};

export type SynastryDimensionSummary = {
  key: SynastryDimension;
  label: string;
  total: number;
  armonicos: number;
  tensos: number;
  fusiones: number;
};

export type SynastrySummary = {
  total: number;
  armonicos: number;
  tensos: number;
  fusiones: number;
  dimensions: SynastryDimensionSummary[];
};

/**
 * Orbes por aspecto, en grados. Son los orbes clásicos de sinastría acotados:
 * más estrechos que en una carta natal, porque un contacto entre dos personas
 * con 9° de diferencia no se siente como contacto. Sol y Luna suman 2° por ser
 * luminarias. Están escritos acá para que la prueba pueda afirmarlos.
 */
export const SYNASTRY_ORBS: Record<SynastryContact["aspect"], number> = {
  conjunction: 8,
  opposition: 7,
  trine: 6,
  square: 6,
  sextile: 4
};
export const LUMINARY_ORB_BONUS = 2;

const ASPECT_ANGLES: Array<{ aspect: SynastryContact["aspect"]; angle: number; es: string; symbol: string }> = [
  { aspect: "conjunction", angle: 0, es: "conjunción", symbol: "☌" },
  { aspect: "sextile", angle: 60, es: "sextil", symbol: "✶" },
  { aspect: "square", angle: 90, es: "cuadratura", symbol: "□" },
  { aspect: "trine", angle: 120, es: "trígono", symbol: "△" },
  { aspect: "opposition", angle: 180, es: "oposición", symbol: "☍" }
];

/** Los puntos que entran en la comparación, en el orden en que se listan. */
const BODIES: readonly string[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const ANGLES: readonly string[] = ["ascendant", "mc"];
const LUMINARIES = new Set(["sun", "moon"]);

/**
 * Qué plano del vínculo toca cada contacto. Es un mapeo editorial fijo por
 * planeta —no un dato del proveedor— y por eso queda escrito y probado: un
 * contacto puede contar en más de una dimensión, y los planetas lentos que no
 * describen el trato cotidiano (Urano, Neptuno, Plutón) no suman a ninguna.
 */
export const DIMENSION_BODIES: Record<SynastryDimension, readonly string[]> = {
  hablan: ["mercury", "jupiter", "ascendant"],
  cuidan: ["moon", "saturn", "mc"],
  deseo: ["venus", "mars", "sun"]
};

export const DIMENSION_LABELS: Record<SynastryDimension, string> = {
  hablan: "Cómo se hablan",
  cuidan: "Cómo se cuidan",
  deseo: "Deseo"
};

function angularDistance(a: number, b: number) {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

export function formatOrb(orb: number): string {
  const total = Math.round(orb * 60);
  const deg = Math.floor(total / 60);
  const min = total % 60;
  return `${deg}° ${String(min).padStart(2, "0")}'`;
}

/** Los puntos comparables de una carta: planetas siempre; ejes sólo con hora real. */
export function comparablePoints(chart: NormalizedAstroChart, includeAngles: boolean): NormalizedAstroPlacement[] {
  const byKey = new Map(chart.placements.map((p) => [p.key, p] as const));
  const points: NormalizedAstroPlacement[] = [];
  for (const key of BODIES) {
    const p = byKey.get(key);
    if (p && p.fullDegree !== null && Number.isFinite(p.fullDegree)) points.push(p);
  }
  if (includeAngles) {
    const asc = byKey.get("ascendant");
    if (asc && asc.fullDegree !== null && Number.isFinite(asc.fullDegree)) points.push(asc);
    const mcHouse = chart.houses.find((h) => h.house === 10);
    if (mcHouse && mcHouse.degree !== null && Number.isFinite(mcHouse.degree)) {
      points.push({
        key: "mc",
        label: "Medio Cielo",
        sign: mcHouse.sign,
        signEs: mcHouse.signEs,
        degree: mcHouse.degree % 30,
        fullDegree: mcHouse.degree,
        house: 10,
        isRetrograde: null,
        source: "astrologyapi"
      });
    }
  }
  return points;
}

/** ¿La carta se calculó con hora real? Sólo entonces sus ejes son un dato. */
export function chartHasRealTime(chart: NormalizedAstroChart | null | undefined): boolean {
  return Boolean(
    chart &&
      chart.calculationTimeSource === "birth_time" &&
      chart.birth.birthTimePrecision === "known" &&
      chart.summary.accuracy === "calculated"
  );
}

/**
 * Todos los aspectos mayores entre los puntos de A y los de B, dentro de orbe,
 * ordenados del más ajustado al más abierto. Los ejes (Ascendente, Medio
 * Cielo) entran sólo si las DOS cartas tienen hora real: un eje calculado al
 * mediodía no es un eje.
 */
export function computeSynastryContacts(chartA: NormalizedAstroChart, chartB: NormalizedAstroChart): SynastryContact[] {
  const includeAngles = chartHasRealTime(chartA) && chartHasRealTime(chartB);
  const pointsA = comparablePoints(chartA, includeAngles);
  const pointsB = comparablePoints(chartB, includeAngles);
  const contacts: SynastryContact[] = [];
  for (const a of pointsA) {
    for (const b of pointsB) {
      const separation = angularDistance(a.fullDegree as number, b.fullDegree as number);
      for (const candidate of ASPECT_ANGLES) {
        const orb = Math.abs(separation - candidate.angle);
        const allowed =
          SYNASTRY_ORBS[candidate.aspect] + (LUMINARIES.has(a.key) || LUMINARIES.has(b.key) ? LUMINARY_ORB_BONUS : 0);
        if (orb <= allowed) {
          const tone: SynastryTone =
            candidate.aspect === "trine" || candidate.aspect === "sextile"
              ? "armonico"
              : candidate.aspect === "conjunction"
                ? "fusion"
                : "tenso";
          const dimensions = (Object.keys(DIMENSION_BODIES) as SynastryDimension[]).filter(
            (dim) => DIMENSION_BODIES[dim].includes(a.key) || DIMENSION_BODIES[dim].includes(b.key)
          );
          contacts.push({
            id: `${a.key}-${candidate.aspect}-${b.key}`,
            from: { key: a.key, label: a.label },
            to: { key: b.key, label: b.label },
            aspect: candidate.aspect,
            aspectEs: candidate.es,
            symbol: candidate.symbol,
            orb: Math.round(orb * 100) / 100,
            orbLabel: formatOrb(orb),
            tone,
            dimensions
          });
          break;
        }
      }
    }
  }
  return contacts.sort((l, r) => l.orb - r.orb);
}

export function summarizeSynastry(contacts: readonly SynastryContact[]): SynastrySummary {
  const count = (list: readonly SynastryContact[]) => ({
    total: list.length,
    armonicos: list.filter((c) => c.tone === "armonico").length,
    tensos: list.filter((c) => c.tone === "tenso").length,
    fusiones: list.filter((c) => c.tone === "fusion").length
  });
  return {
    ...count(contacts),
    dimensions: (Object.keys(DIMENSION_LABELS) as SynastryDimension[]).map((key) => ({
      key,
      label: DIMENSION_LABELS[key],
      ...count(contacts.filter((c) => c.dimensions.includes(key)))
    }))
  };
}

// ---------------------------------------------------------------------------
// Nivel «signo con signo»: lectura de tono por elementos
// ---------------------------------------------------------------------------

const ELEMENT_BY_SIGN: Record<string, "fuego" | "tierra" | "aire" | "agua"> = {
  aries: "fuego",
  leo: "fuego",
  sagitario: "fuego",
  tauro: "tierra",
  virgo: "tierra",
  capricornio: "tierra",
  geminis: "aire",
  libra: "aire",
  acuario: "aire",
  cancer: "agua",
  escorpio: "agua",
  piscis: "agua"
};

/** El proveedor escribe `sign` en inglés; `signEs` es la clave en español. Se aceptan las dos. */
const ENGLISH_SIGN_KEYS: Record<string, string> = {
  aries: "aries",
  taurus: "tauro",
  gemini: "geminis",
  cancer: "cancer",
  leo: "leo",
  virgo: "virgo",
  libra: "libra",
  scorpio: "escorpio",
  sagittarius: "sagitario",
  capricorn: "capricornio",
  aquarius: "acuario",
  pisces: "piscis"
};

export function elementOfSign(sign: string): "fuego" | "tierra" | "aire" | "agua" | null {
  const key = sign
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  return ELEMENT_BY_SIGN[key] ?? ELEMENT_BY_SIGN[ENGLISH_SIGN_KEYS[key] ?? ""] ?? null;
}

export type SignTone = {
  relation: "mismo_elemento" | "elementos_afines" | "elementos_distintos";
  headline: string;
  body: string;
};

/**
 * Qué se puede decir con sólo los dos signos solares: el tono por elementos.
 * Es una lectura de temperamento, no un contacto; por eso el nivel «signo» no
 * publica lista de contactos ni conteos.
 */
export function signTone(signA: string, signB: string): SignTone | null {
  const a = elementOfSign(signA);
  const b = elementOfSign(signB);
  if (!a || !b) return null;
  const affine = new Set(["fuego|aire", "aire|fuego", "tierra|agua", "agua|tierra"]);
  if (a === b) {
    return {
      relation: "mismo_elemento",
      headline: `Dos soles de ${a}.`,
      body: "Comparten temperamento: se entienden rápido en lo que los mueve y pueden exagerarse mutuamente en lo mismo."
    };
  }
  if (affine.has(`${a}|${b}`)) {
    return {
      relation: "elementos_afines",
      headline: `${capitalize(a)} con ${b}: elementos que se alimentan.`,
      body: "Temperamentos que suelen complementarse sin esfuerzo. Es un tono, no una garantía: con fecha aparecen los contactos reales."
    };
  }
  return {
    relation: "elementos_distintos",
    headline: `${capitalize(a)} con ${b}: ritmos distintos.`,
    body: "Temperamentos que piden traducción. Un tono general, no un veredicto: con fecha y hora se ve dónde fluye y dónde traba."
  };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ---------------------------------------------------------------------------
// Qué pudo calcularse
// ---------------------------------------------------------------------------

export type SynastryPrecision = {
  level: SynastryLevel;
  /** `AMBAS CON FECHA, HORA Y LUGAR · INCLUYE CASAS` */
  label: string;
  includesAngles: boolean;
  limitations: string[];
};

export function synastryPrecision(args: {
  level: SynastryLevel;
  chartA: NormalizedAstroChart | null;
  chartB: NormalizedAstroChart | null;
}): SynastryPrecision {
  if (args.level === "signo" || !args.chartB) {
    return {
      level: "signo",
      label: "SÓLO SIGNO · LECTURA DE TONO",
      includesAngles: false,
      limitations: ["Con el signo solar se lee el tono. Los contactos entre planetas necesitan la fecha de nacimiento."]
    };
  }
  const aTime = chartHasRealTime(args.chartA);
  const bTime = chartHasRealTime(args.chartB);
  if (aTime && bTime) {
    return {
      level: "carta",
      label: "AMBAS CON FECHA, HORA Y LUGAR · INCLUYE CASAS",
      includesAngles: true,
      limitations: []
    };
  }
  const limitations = [
    !bTime ? "Sin hora de la persona: su Luna puede variar hasta 7° y sus ejes no entran en la comparación." : null,
    !aTime ? "Tu carta no tiene hora exacta: tu Luna puede variar y tus ejes no entran en la comparación." : null
  ].filter((l): l is string => l !== null);
  return {
    level: "fecha",
    label: bTime ? "CON TU FECHA SIN HORA · SIN CASAS" : "CON FECHA · SIN HORA · SIN CASAS",
    includesAngles: false,
    limitations
  };
}

/** Cuántos contactos se muestran en Free antes de invitar a Plus. */
export const FREE_CONTACT_LIMIT = 3;

/** Cuántas personas guarda Free (CORE-214). Plus no tiene tope. */
export const FREE_PERSON_LIMIT = 1;

export type PersonAccess = {
  isPro: boolean;
  /** `null` sin tope. */
  limit: number | null;
  /** Cuántas personas más se pueden guardar; `null` sin tope. */
  remaining: number | null;
  atLimit: boolean;
};

/**
 * El cupo se deriva del entitlement real y de cuántas personas hay guardadas:
 * no se guarda un contador. Alcanzar el cupo no borra ni oculta a nadie; sólo
 * impide crear una persona nueva (reemplazar o editar sigue permitido).
 */
export function personAccess(args: { isPro: boolean; count: number }): PersonAccess {
  if (args.isPro) return { isPro: true, limit: null, remaining: null, atLimit: false };
  const remaining = Math.max(0, FREE_PERSON_LIMIT - Math.max(0, args.count));
  return { isPro: false, limit: FREE_PERSON_LIMIT, remaining, atLimit: remaining === 0 };
}
