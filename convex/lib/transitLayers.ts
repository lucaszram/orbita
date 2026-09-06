export const TRANSIT_RANKING_VERSION = "transit-ranking-v2" as const;
export const ACTIVE_TRANSIT_ORB_DEGREES = 3;
export const EXACT_TRANSIT_ORB_DEGREES = 0.1;

export const MAJOR_TRANSIT_ASPECTS = [
  { key: "conjunction", label: "Conjunción", angle: 0 },
  { key: "sextile", label: "Sextil", angle: 60 },
  { key: "square", label: "Cuadratura", angle: 90 },
  { key: "trine", label: "Trígono", angle: 120 },
  { key: "opposition", label: "Oposición", angle: 180 }
] as const;

export type TransitAspectKey = (typeof MAJOR_TRANSIT_ASPECTS)[number]["key"];
export type TransitStage = "approaching" | "exact" | "integrating";
export type TransitTrend = "applying" | "separating";
export type TransitTimestamp = string | number | Date;

export type TransitContactInput = {
  chartKey: string;
  contactId?: string;
  transitPlanet: string;
  transitLongitude: number;
  transitSpeed?: number | null;
  natalPoint: string;
  natalLongitude: number;
  natalHouse?: number | null;
  isNatalRuler?: boolean;
  isRetrograde?: boolean;
  /**
   * Una firma editorial compartida permite explicar que dos tránsitos activos
   * insisten sobre un mismo tema. Si falta, se usa el punto natal.
   */
  themeKey?: string;
  /**
   * La ventana LÓGICA del arco, provista por el caller cuando ya la conoce. Si
   * falta, el motor separa ventanas por distancia temporal y usa la fecha de la
   * primera de ellas.
   *
   * **La procedencia no es identidad.** Un mismo proceso se mide dos veces —el
   * ranking lo extrapola con la velocidad del día, el seguimiento lo verifica
   * contra efemérides reales— y las dos medidas dan bordes distintos para la
   * MISMA ventana. Etiquetar esa diferencia acá (`verified:…`, `estimated:…`)
   * partía la identidad en dos: el ranking publicaba un `arcId` y el detalle
   * del mismo contacto publicaba otro. Por eso la clave se canonicaliza —la
   * marca de procedencia se descarta— y quien verifica pasadas propaga la
   * ventana lógica que ya tenía (`logicalArcWindowKey`) en vez de inventar una
   * nueva con sus propios bordes.
   */
  arcWindowKey?: string;
  /**
   * Identidad de arco declarada por el caller.
   *
   * El `arcId` calculado depende de la ventana observada, así que verificar las
   * pasadas de un contacto —que corre sus bordes hacia atrás y hacia adelante—
   * produciría otro identificador para el MISMO tránsito. Cuando alguien pide el
   * detalle de un arco concreto, ese cambio rompería la correspondencia con el
   * identificador que publicó el ranking. Declararlo acá conserva una sola
   * identidad antes y después de verificar.
   *
   * Todos los contactos que declaran el mismo `arcId` se tratan como pasadas del
   * mismo arco, sin importar la distancia temporal entre ellas.
   */
  arcId?: string;
  observedAt: TransitTimestamp;
  previousOrb?: number | null;
  trend?: TransitTrend;
  windowStart?: TransitTimestamp | null;
  exactAt?: TransitTimestamp | null;
  windowEnd?: TransitTimestamp | null;
};

export type MajorTransitAspectMatch = {
  key: TransitAspectKey;
  label: string;
  angle: number;
  separation: number;
  orb: number;
  signedError: number;
};

export type TransitReasonCode =
  | "exactness"
  | "natal_point"
  | "pace"
  | "angular_house"
  | "natal_ruler"
  | "repeated_theme";

export type TransitReason = {
  code: TransitReasonCode;
  title: string;
  detail: string;
};

export type RankedTransit = {
  rank: number;
  contactId: string;
  arcId: string;
  transitPlanet: string;
  natalPoint: string;
  natalHouse: number | null;
  aspect: {
    key: TransitAspectKey;
    label: string;
    angle: number;
  };
  separation: number;
  orb: number;
  trend: TransitTrend;
  stage: TransitStage;
  stageLabel: string;
  observedAt: string;
  exactAt: string | null;
  previousExactAt: string | null;
  nextExactAt: string | null;
  rankingWindow: {
    startAt: string;
    endAt: string;
  };
  rankingReason: string;
  isRetrograde: boolean;
  passCount: number;
  hasRetrogradePass: boolean;
  reasons: TransitReason[];
};

export type TransitArcPass = {
  passId: string;
  exactAt: string;
  direction: "direct" | "retrograde";
  stage: TransitStage;
  stageLabel: string;
  orb: number;
};

export type TransitArc = {
  arcId: string;
  signature: string;
  transitPlanet: string;
  natalPoint: string;
  natalHouse: number | null;
  aspect: {
    key: TransitAspectKey;
    label: string;
    angle: number;
  };
  stage: TransitStage;
  stageLabel: string;
  window: {
    startAt: string;
    peakAt: string;
    endAt: string;
  };
  previousExactAt: string | null;
  nextExactAt: string | null;
  rankingWindow: {
    startAt: string;
    endAt: string;
  };
  rankingReason: string;
  passes: TransitArcPass[];
  hasRetrogradePass: boolean;
  reasons: TransitReason[];
};

export type TransitLayers = {
  version: typeof TRANSIT_RANKING_VERSION;
  activeCount: number;
  ranking: RankedTransit[];
  topThree: RankedTransit[];
  arcs: TransitArc[];
};

export type TransitLayerOptions = {
  referenceTime?: TransitTimestamp;
  maxPassGapDays?: number;
  localDate?: string;
  timezone?: string;
};

type AspectDefinition = (typeof MAJOR_TRANSIT_ASPECTS)[number];

type ParsedContact = {
  input: TransitContactInput;
  signature: string;
  themeKey: string;
  match: MajorTransitAspectMatch;
  observedAtMs: number;
  exactAtMs: number | null;
  windowStartMs: number | null;
  windowEndMs: number | null;
  trend: TransitTrend;
  stage: TransitStage;
  contactId: string;
  arcId: string;
};

type ScoredContact = ParsedContact & {
  internalScore: number;
  reasons: TransitReason[];
};

const MILLISECONDS_PER_DAY = 86_400_000;
const DEFAULT_MAX_PASS_GAP_DAYS = 220;
const ARC_EXACT_WINDOW_MS = 6 * 60 * 60 * 1000;
const TREND_EPSILON = 1e-6;
const TEMPORAL_PRIORITY_MS = 72 * 60 * 60 * 1000;

const STAGE_LABEL: Record<TransitStage, string> = {
  approaching: "Acercándose",
  exact: "Exacto",
  integrating: "Integrándose"
};

const NATAL_POINT_WEIGHT: Record<string, number> = {
  sun: 20,
  moon: 20,
  ascendant: 20,
  descendant: 20,
  mc: 20,
  ic: 20,
  mercury: 14,
  venus: 14,
  mars: 14,
  jupiter: 10,
  saturn: 10,
  uranus: 6,
  neptune: 6,
  pluto: 6
};

const TRANSIT_PACE_WEIGHT: Record<string, number> = {
  pluto: 12,
  neptune: 11,
  uranus: 10,
  saturn: 9,
  jupiter: 7,
  mars: 5,
  venus: 4,
  mercury: 4,
  sun: 3,
  moon: 1
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
  descendente: "descendant",
  desc: "descendant",
  medio_cielo: "mc",
  midheaven: "mc",
  fondo_del_cielo: "ic",
  imum_coeli: "ic"
};

function assertFiniteNumber(value: number, field: string) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number.`);
  }
}

function canonicalKey(value: string) {
  const key = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return POINT_ALIASES[key] ?? key;
}

function parseTimestamp(value: TransitTimestamp | null | undefined, field: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  let timestamp: number;
  if (value instanceof Date) {
    timestamp = value.getTime();
  } else if (typeof value === "number") {
    timestamp = value;
  } else {
    const deterministicValue = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)
      ? `${value.replace(" ", "T")}Z`
      : value;
    timestamp = Date.parse(deterministicValue);
  }

  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`${field} must be a valid timestamp.`);
  }
  return timestamp;
}

function toIso(timestamp: number) {
  return new Date(timestamp).toISOString();
}

function normalizeDegrees(value: number) {
  assertFiniteNumber(value, "longitude");
  return ((value % 360) + 360) % 360;
}

function signedDegrees(value: number) {
  const normalized = normalizeDegrees(value);
  return normalized >= 180 ? normalized - 360 : normalized;
}

export function angularDistance(left: number, right: number) {
  const distance = Math.abs(normalizeDegrees(left) - normalizeDegrees(right));
  return Math.min(distance, 360 - distance);
}

function aspectError(signedSeparation: number, aspect: AspectDefinition) {
  const targets = aspect.angle === 0 ? [0] : aspect.angle === 180 ? [180, -180] : [aspect.angle, -aspect.angle];
  return targets
    .map((target) => signedDegrees(signedSeparation - target))
    .sort((left, right) => Math.abs(left) - Math.abs(right) || left - right)[0];
}

export function matchMajorAspect(
  transitLongitude: number,
  natalLongitude: number
): MajorTransitAspectMatch | null {
  const transit = normalizeDegrees(transitLongitude);
  const natal = normalizeDegrees(natalLongitude);
  const separation = angularDistance(transit, natal);
  const signedSeparation = signedDegrees(transit - natal);

  const matches = MAJOR_TRANSIT_ASPECTS.map((aspect) => {
    const signedError = aspectError(signedSeparation, aspect);
    return {
      key: aspect.key,
      label: aspect.label,
      angle: aspect.angle,
      separation,
      orb: Math.abs(signedError),
      signedError
    } satisfies MajorTransitAspectMatch;
  }).sort((left, right) => left.orb - right.orb || left.angle - right.angle);

  return matches[0].orb <= ACTIVE_TRANSIT_ORB_DEGREES ? matches[0] : null;
}

export function transitSignature(contact: TransitContactInput) {
  const match = matchMajorAspect(contact.transitLongitude, contact.natalLongitude);
  if (!match) {
    return null;
  }
  return [
    canonicalKey(contact.chartKey),
    canonicalKey(contact.transitPlanet),
    match.key,
    canonicalKey(contact.natalPoint)
  ].join("|");
}

/**
 * Marcas de procedencia que un caller puede anteponer a la ventana lógica.
 *
 * Se descartan para calcular la identidad: cómo se midió la ventana —estimada
 * por velocidad, verificada contra efemérides— describe el MÉTODO, no el
 * proceso. `verified:2026-05-12` y `2026-05-12` son la misma ventana.
 */
const ARC_WINDOW_PROVENANCE = ["verified:", "estimated:", "provisional:"] as const;

/** La ventana lógica declarada, sin su marca de procedencia. `null` si no hay. */
function canonicalArcWindowKey(value: string | null | undefined): string | null {
  let key = value?.trim() ?? "";
  let stripped = true;
  while (stripped && key.length > 0) {
    stripped = false;
    for (const marker of ARC_WINDOW_PROVENANCE) {
      if (key.toLowerCase().startsWith(marker)) {
        key = key.slice(marker.length).trim();
        stripped = true;
        break;
      }
    }
  }
  return key.length > 0 ? key : null;
}

/**
 * La ventana lógica que el contacto YA trae, o `null` si no trae ninguna.
 *
 * Es la pieza de la identidad que verificar las pasadas no puede mover. Quien
 * corre el seguimiento real de un contacto propaga esta clave a las pasadas que
 * encuentra —sus bordes verificados cambian las FECHAS que se muestran, no el
 * identificador—, y así el ranking y el detalle del mismo tránsito lo nombran
 * igual. Sin esto, el mismo Saturno–Marte salía con un `arcId` en la lista y con
 * otro en su propio arco.
 *
 * Devuelve `null` cuando el contacto es sólo un instante observado, sin ventana
 * ni contacto exacto: ahí no hay identidad previa que conservar, y quien calcule
 * la ventana después puede sembrar la suya.
 */
export function declaredArcWindowKey(contact: TransitContactInput): string | null {
  const declared = canonicalArcWindowKey(contact.arcWindowKey);
  if (declared) return declared;
  const first =
    parseTimestamp(contact.windowStart, "windowStart") ??
    parseTimestamp(contact.exactAt, "exactAt");
  return first === null ? null : toIso(first).slice(0, 10);
}

function hashStable(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function stageFromTrend(trend: TransitTrend, orb: number): TransitStage {
  if (orb <= EXACT_TRANSIT_ORB_DEGREES + TREND_EPSILON) {
    return "exact";
  }
  return trend === "applying" ? "approaching" : "integrating";
}

function inferTrend(args: {
  input: TransitContactInput;
  match: MajorTransitAspectMatch;
  observedAtMs: number;
  exactAtMs: number | null;
}): TransitTrend {
  const { input, match } = args;
  if (input.trend) {
    return input.trend;
  }

  if (input.previousOrb !== null && input.previousOrb !== undefined) {
    assertFiniteNumber(input.previousOrb, "previousOrb");
    if (match.orb < input.previousOrb - TREND_EPSILON) {
      return "applying";
    }
    if (match.orb > input.previousOrb + TREND_EPSILON) {
      return "separating";
    }
  }

  if (args.exactAtMs !== null && args.exactAtMs !== args.observedAtMs) {
    return args.observedAtMs < args.exactAtMs ? "applying" : "separating";
  }

  if (input.transitSpeed !== null && input.transitSpeed !== undefined) {
    assertFiniteNumber(input.transitSpeed, "transitSpeed");
    const movement = input.transitSpeed / 24;
    const nextError = signedDegrees(match.signedError + movement);
    if (Math.abs(nextError) < match.orb - TREND_EPSILON) {
      return "applying";
    }
    if (Math.abs(nextError) > match.orb + TREND_EPSILON) {
      return "separating";
    }
  }

  return "applying";
}

function parseContact(input: TransitContactInput): Omit<ParsedContact, "arcId"> | null {
  if (!input.chartKey.trim()) {
    throw new TypeError("chartKey is required.");
  }
  if (!input.transitPlanet.trim() || !input.natalPoint.trim()) {
    throw new TypeError("transitPlanet and natalPoint are required.");
  }

  const match = matchMajorAspect(input.transitLongitude, input.natalLongitude);
  if (!match) {
    return null;
  }

  const observedAtMs = parseTimestamp(input.observedAt, "observedAt");
  if (observedAtMs === null) {
    throw new TypeError("observedAt is required.");
  }
  const exactAtMs = parseTimestamp(input.exactAt, "exactAt");
  const windowStartMs = parseTimestamp(input.windowStart, "windowStart");
  const windowEndMs = parseTimestamp(input.windowEnd, "windowEnd");
  if (windowStartMs !== null && windowEndMs !== null && windowStartMs > windowEndMs) {
    throw new RangeError("windowStart must not be after windowEnd.");
  }

  const signature = transitSignature(input);
  if (!signature) {
    return null;
  }
  const trend = inferTrend({ input, match, observedAtMs, exactAtMs });
  const moment = exactAtMs ?? observedAtMs;
  const contactId = input.contactId?.trim() || `contact_${hashStable(`${signature}|${moment}|${input.isRetrograde === true}`)}`;

  return {
    input,
    signature,
    themeKey: canonicalKey(input.themeKey || input.natalPoint),
    match,
    observedAtMs,
    exactAtMs,
    windowStartMs,
    windowEndMs,
    trend,
    stage: stageFromTrend(trend, match.orb),
    contactId
  };
}

function eventMoment(contact: Omit<ParsedContact, "arcId">) {
  return contact.exactAtMs ?? contact.observedAtMs;
}

function firstWindowMoment(contact: Omit<ParsedContact, "arcId">) {
  return contact.windowStartMs ?? contact.exactAtMs ?? contact.observedAtMs;
}

function assignArcIds(
  parsed: Array<Omit<ParsedContact, "arcId">>,
  maxPassGapDays: number
): ParsedContact[] {
  const bySignature = new Map<string, Array<Omit<ParsedContact, "arcId">>>();
  for (const contact of parsed) {
    const declaredArc = contact.input.arcId?.trim();
    const windowDiscriminator = canonicalArcWindowKey(contact.input.arcWindowKey);
    const key = declaredArc
      ? `arc:${declaredArc}`
      : `${contact.signature}|${windowDiscriminator ?? "auto"}`;
    const current = bySignature.get(key) ?? [];
    current.push(contact);
    bySignature.set(key, current);
  }

  const result: ParsedContact[] = [];
  const maxGapMs = maxPassGapDays * MILLISECONDS_PER_DAY;
  for (const contacts of bySignature.values()) {
    contacts.sort((left, right) => eventMoment(left) - eventMoment(right) || left.contactId.localeCompare(right.contactId));

    let cluster: Array<Omit<ParsedContact, "arcId">> = [];
    const flush = () => {
      if (cluster.length === 0) {
        return;
      }
      const firstMoment = Math.min(...cluster.map(firstWindowMoment));
      const firstDate = toIso(firstMoment).slice(0, 10);
      const declaredArc = cluster[0].input.arcId?.trim();
      // La identidad V1 es carta + planeta + aspecto + punto natal —eso es la
      // firma— más la ventana lógica. La ventana declarada entra TAL CUAL, sin
      // prefijo propio: una ventana declarada `2026-05-12` y una derivada de la
      // misma fecha tienen que dar el mismo identificador, o el ranking y el
      // detalle del mismo tránsito dejan de nombrarlo igual.
      const explicitWindow = canonicalArcWindowKey(cluster[0].input.arcWindowKey);
      const seed = `${cluster[0].signature}|${explicitWindow ?? firstDate}`;
      // Un `arcId` vacío o en blanco NO es una identidad declarada: se calcula.
      const arcId = declaredArc ? declaredArc : `arc_v1_${hashStable(seed)}`;
      result.push(...cluster.map((contact) => ({ ...contact, arcId })));
      cluster = [];
    };

    for (const contact of contacts) {
      const previous = cluster[cluster.length - 1];
      const forcedWindow =
        canonicalArcWindowKey(contact.input.arcWindowKey) !== null ||
        Boolean(contact.input.arcId?.trim());
      if (!previous || forcedWindow || eventMoment(contact) - eventMoment(previous) <= maxGapMs) {
        cluster.push(contact);
      } else {
        flush();
        cluster.push(contact);
      }
    }
    flush();
  }

  return result;
}

function pointWeight(point: string) {
  return NATAL_POINT_WEIGHT[canonicalKey(point)] ?? 4;
}

function paceWeight(planet: string) {
  return TRANSIT_PACE_WEIGHT[canonicalKey(planet)] ?? 2;
}

function formatOrb(orb: number) {
  let degrees = Math.floor(orb);
  let minutes = Math.round((orb - degrees) * 60);
  if (minutes === 60) {
    degrees += 1;
    minutes = 0;
  }
  return `${degrees}°${String(minutes).padStart(2, "0")}′`;
}

function pointReason(input: TransitContactInput): TransitReason {
  const point = canonicalKey(input.natalPoint);
  const central = ["sun", "moon"].includes(point);
  const angle = ["ascendant", "descendant", "mc", "ic"].includes(point);
  return {
    code: "natal_point",
    title: "Qué toca",
    detail: central
      ? `Toca tu ${input.natalPoint}, uno de los dos puntos centrales de tu carta junto con el Sol o la Luna.`
      : angle
        ? `Toca ${input.natalPoint}, un punto asociado a cómo te ubicás y respondés frente al entorno.`
        : `Toca tu ${input.natalPoint}; ese punto define el tema personal del tránsito.`
  };
}

function paceReason(input: TransitContactInput, weight: number): TransitReason {
  return {
    code: "pace",
    title: "Cuánto dura",
    detail:
      weight >= 9
        ? `${input.transitPlanet} se mueve lento, así que este proceso se sostiene en el tiempo.`
        : weight >= 5
          ? `El ritmo de ${input.transitPlanet} mantiene este contacto activo más de un instante.`
          : `${input.transitPlanet} se mueve rápido; la cercanía exacta pesa más que la duración.`
  };
}

function buildReasons(contact: ParsedContact, repeatedTheme: boolean): TransitReason[] {
  const input = contact.input;
  const pace = paceWeight(input.transitPlanet);
  const reasons: TransitReason[] = [
    {
      code: "exactness",
      title: "Exactitud",
      detail: `Está a ${formatOrb(contact.match.orb)} del aspecto exacto.`
    },
    pointReason(input),
    paceReason(input, pace)
  ];

  if (input.natalHouse !== null && input.natalHouse !== undefined && [1, 4, 7, 10].includes(input.natalHouse)) {
    reasons.push({
      code: "angular_house",
      title: "Casa angular",
      detail: `Activa tu casa ${input.natalHouse}, una zona de la carta que suele sentirse de forma directa.`
    });
  }
  if (input.isNatalRuler === true) {
    reasons.push({
      code: "natal_ruler",
      title: "Regencia natal",
      detail: `${input.transitPlanet} también rige una parte relevante de tu carta.`
    });
  }
  if (repeatedTheme) {
    reasons.push({
      code: "repeated_theme",
      title: "Tema repetido",
      detail: "Más de un tránsito activo está insistiendo sobre la misma zona de tu carta."
    });
  }
  return reasons;
}

function scoreContacts(parsed: ParsedContact[]): ScoredContact[] {
  const themeSignatures = new Map<string, Set<string>>();
  for (const contact of parsed) {
    const signatures = themeSignatures.get(contact.themeKey) ?? new Set<string>();
    signatures.add(contact.signature);
    themeSignatures.set(contact.themeKey, signatures);
  }

  return parsed.map((contact) => {
    const input = contact.input;
    const exactness = 55 * Math.max(0, 1 - contact.match.orb / ACTIVE_TRANSIT_ORB_DEGREES);
    const natalPoint = pointWeight(input.natalPoint);
    const pace = paceWeight(input.transitPlanet);
    const angularHouse =
      input.natalHouse !== null && input.natalHouse !== undefined && [1, 4, 7, 10].includes(input.natalHouse)
        ? 5
        : 0;
    const natalRuler = input.isNatalRuler === true ? 4 : 0;
    const repeatedTheme = (themeSignatures.get(contact.themeKey)?.size ?? 0) > 1;
    const repetition = repeatedTheme ? 4 : 0;

    return {
      ...contact,
      internalScore: exactness + natalPoint + pace + angularHouse + natalRuler + repetition,
      reasons: buildReasons(contact, repeatedTheme)
    };
  });
}

function validatedOptions(contacts: TransitContactInput[], options?: TransitLayerOptions) {
  const maxPassGapDays = options?.maxPassGapDays ?? DEFAULT_MAX_PASS_GAP_DAYS;
  if (!Number.isFinite(maxPassGapDays) || maxPassGapDays <= 0) {
    throw new RangeError("maxPassGapDays must be greater than zero.");
  }
  const fallbackReference = contacts.length > 0
    ? Math.max(...contacts.map((contact) => parseTimestamp(contact.observedAt, "observedAt") ?? 0))
    : 0;
  const referenceTimeMs = parseTimestamp(options?.referenceTime, "referenceTime") ?? fallbackReference;
  const timezone = options?.timezone?.trim() || "UTC";
  const localDate = options?.localDate?.trim() || civilDate(referenceTimeMs, timezone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw new TypeError("localDate must use YYYY-MM-DD.");
  }
  return { maxPassGapDays, referenceTimeMs, localDate, timezone };
}

function prepareContacts(contacts: TransitContactInput[], options?: TransitLayerOptions) {
  const validated = validatedOptions(contacts, options);
  const parsed = contacts.map(parseContact).filter((contact): contact is Omit<ParsedContact, "arcId"> => contact !== null);
  const withArcIds = assignArcIds(parsed, validated.maxPassGapDays);
  return { ...validated, contacts: scoreContacts(withArcIds) };
}

function compareRepresentative(left: ScoredContact, right: ScoredContact, referenceTimeMs: number) {
  const leftDistance = Math.abs(eventMoment(left) - referenceTimeMs);
  const rightDistance = Math.abs(eventMoment(right) - referenceTimeMs);
  return (
    leftDistance - rightDistance ||
    right.internalScore - left.internalScore ||
    left.match.orb - right.match.orb ||
    left.contactId.localeCompare(right.contactId)
  );
}

type RankingMetadata = {
  previousExactAt: number | null;
  nextExactAt: number | null;
  startAt: number;
  endAt: number;
  reason: string;
  tier: number;
  temporalDistance: number;
};

function civilDate(timestamp: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function civilDayDistance(fromDate: string, toDate: string) {
  const parse = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(toDate) - parse(fromDate)) / MILLISECONDS_PER_DAY);
}

function shortDate(timestamp: number, timezone: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    day: "numeric",
    month: "long"
  }).format(new Date(timestamp));
}

function metadataForArc(
  contacts: ScoredContact[],
  referenceTimeMs: number,
  localDate: string,
  timezone: string
): RankingMetadata {
  const exactMoments = contacts
    .map((contact) => contact.exactAtMs ?? eventMoment(contact))
    .sort((left, right) => left - right);
  const previousExactAt = [...exactMoments].reverse().find((moment) => moment < referenceTimeMs) ?? null;
  const nextExactAt = exactMoments.find((moment) => moment > referenceTimeMs) ?? null;
  const nearest = [...exactMoments].sort(
    (left, right) => Math.abs(left - referenceTimeMs) - Math.abs(right - referenceTimeMs) || left - right
  )[0] ?? referenceTimeMs;
  const exactDate = civilDate(nearest, timezone);
  const dayDistance = civilDayDistance(localDate, exactDate);
  const delta = nearest - referenceTimeMs;
  const absoluteDelta = Math.abs(delta);
  const startAt = Math.min(
    ...contacts.map((contact) => contact.windowStartMs ?? contact.exactAtMs ?? contact.observedAtMs)
  );
  const endAt = Math.max(
    ...contacts.map((contact) => contact.windowEndMs ?? contact.exactAtMs ?? contact.observedAtMs)
  );

  if (exactDate === localDate) {
    return { previousExactAt, nextExactAt, startAt, endAt, reason: "Exacto hoy", tier: 0, temporalDistance: absoluteDelta };
  }
  if (delta > 0 && delta <= TEMPORAL_PRIORITY_MS) {
    const reason = dayDistance === 1 ? "Pico mañana" : `Pico en ${Math.max(1, dayDistance)} días`;
    return { previousExactAt, nextExactAt, startAt, endAt, reason, tier: 1, temporalDistance: absoluteDelta };
  }
  if (delta < 0 && absoluteDelta <= TEMPORAL_PRIORITY_MS) {
    const daysAgo = Math.max(1, Math.abs(dayDistance));
    const reason = daysAgo === 1 ? "Pico ayer" : `Pico hace ${daysAgo} días`;
    return { previousExactAt, nextExactAt, startAt, endAt, reason, tier: 2, temporalDistance: absoluteDelta };
  }
  return {
    previousExactAt,
    nextExactAt,
    startAt,
    endAt,
    reason: `Activo hasta el ${shortDate(endAt, timezone)}`,
    tier: 3,
    temporalDistance: absoluteDelta
  };
}

function publicRankedTransit(
  contact: ScoredContact,
  rank: number,
  passCount: number,
  hasRetrogradePass: boolean,
  metadata: RankingMetadata
): RankedTransit {
  return {
    rank,
    contactId: contact.contactId,
    arcId: contact.arcId,
    transitPlanet: contact.input.transitPlanet,
    natalPoint: contact.input.natalPoint,
    natalHouse: contact.input.natalHouse ?? null,
    aspect: {
      key: contact.match.key,
      label: contact.match.label,
      angle: contact.match.angle
    },
    separation: contact.match.separation,
    orb: contact.match.orb,
    trend: contact.trend,
    stage: contact.stage,
    stageLabel: STAGE_LABEL[contact.stage],
    observedAt: toIso(contact.observedAtMs),
    exactAt: contact.exactAtMs === null ? null : toIso(contact.exactAtMs),
    previousExactAt: metadata.previousExactAt === null ? null : toIso(metadata.previousExactAt),
    nextExactAt: metadata.nextExactAt === null ? null : toIso(metadata.nextExactAt),
    rankingWindow: {
      startAt: toIso(metadata.startAt),
      endAt: toIso(metadata.endAt)
    },
    rankingReason: metadata.reason,
    isRetrograde: contact.input.isRetrograde === true,
    passCount,
    hasRetrogradePass,
    reasons: contact.reasons
  };
}

function rankPrepared(
  contacts: ScoredContact[],
  referenceTimeMs: number,
  localDate: string,
  timezone: string
): RankedTransit[] {
  const byArc = new Map<string, ScoredContact[]>();
  for (const contact of contacts) {
    const current = byArc.get(contact.arcId) ?? [];
    current.push(contact);
    byArc.set(contact.arcId, current);
  }

  const representatives = [...byArc.values()].map((arcContacts) => {
    const representative = [...arcContacts].sort((left, right) => compareRepresentative(left, right, referenceTimeMs))[0];
    return {
      representative,
      passCount: arcContacts.length,
      hasRetrogradePass: arcContacts.some((contact) => contact.input.isRetrograde === true),
      metadata: metadataForArc(arcContacts, referenceTimeMs, localDate, timezone)
    };
  });

  representatives.sort((left, right) => {
    const tierDifference = left.metadata.tier - right.metadata.tier;
    if (tierDifference !== 0) return tierDifference;
    if (left.metadata.tier < 3) {
      const temporalDifference = left.metadata.temporalDistance - right.metadata.temporalDistance;
      if (Math.abs(temporalDifference) > TREND_EPSILON) return temporalDifference;
    } else {
      const orbDifference = left.representative.match.orb - right.representative.match.orb;
      if (Math.abs(orbDifference) > TREND_EPSILON) return orbDifference;
    }
    const scoreDifference = right.representative.internalScore - left.representative.internalScore;
    if (Math.abs(scoreDifference) > TREND_EPSILON) {
      return scoreDifference;
    }
    return (
      left.representative.match.orb - right.representative.match.orb ||
      left.representative.arcId.localeCompare(right.representative.arcId)
    );
  });

  return representatives.map((entry, index) =>
    publicRankedTransit(entry.representative, index + 1, entry.passCount, entry.hasRetrogradePass, entry.metadata)
  );
}

function arcStage(contacts: ScoredContact[], referenceTimeMs: number): TransitStage {
  const exactMoments = contacts.map((contact) => contact.exactAtMs).filter((value): value is number => value !== null);
  if (exactMoments.some((moment) => Math.abs(moment - referenceTimeMs) <= ARC_EXACT_WINDOW_MS)) {
    return "exact";
  }

  const start = Math.min(
    ...contacts.map((contact) => contact.windowStartMs ?? contact.exactAtMs ?? contact.observedAtMs)
  );
  const end = Math.max(...contacts.map((contact) => contact.windowEndMs ?? contact.exactAtMs ?? contact.observedAtMs));
  if (referenceTimeMs < start) {
    return "approaching";
  }
  if (referenceTimeMs > end) {
    return "integrating";
  }

  const live = [...contacts].sort((left, right) => compareRepresentative(left, right, referenceTimeMs))[0];
  if (Math.abs(live.observedAtMs - referenceTimeMs) <= MILLISECONDS_PER_DAY) {
    return live.stage;
  }
  return exactMoments.some((moment) => moment > referenceTimeMs) ? "approaching" : "integrating";
}

function buildArcsPrepared(
  contacts: ScoredContact[],
  referenceTimeMs: number,
  localDate: string,
  timezone: string
): TransitArc[] {
  const byArc = new Map<string, ScoredContact[]>();
  for (const contact of contacts) {
    const current = byArc.get(contact.arcId) ?? [];
    current.push(contact);
    byArc.set(contact.arcId, current);
  }

  return [...byArc.entries()]
    .map(([arcId, arcContacts]) => {
      const ordered = [...arcContacts].sort(
        (left, right) => eventMoment(left) - eventMoment(right) || left.contactId.localeCompare(right.contactId)
      );
      const representative = [...ordered].sort((left, right) => compareRepresentative(left, right, referenceTimeMs))[0];
      const peak = [...ordered].sort(
        (left, right) =>
          left.match.orb - right.match.orb ||
          Math.abs(eventMoment(left) - referenceTimeMs) - Math.abs(eventMoment(right) - referenceTimeMs) ||
          eventMoment(left) - eventMoment(right)
      )[0];
      const startAt = Math.min(
        ...ordered.map((contact) => contact.windowStartMs ?? contact.exactAtMs ?? contact.observedAtMs)
      );
      const endAt = Math.max(
        ...ordered.map((contact) => contact.windowEndMs ?? contact.exactAtMs ?? contact.observedAtMs)
      );
      const stage = arcStage(ordered, referenceTimeMs);
      const metadata = metadataForArc(ordered, referenceTimeMs, localDate, timezone);
      const passes = ordered.map((contact) => {
        const passMoment = contact.exactAtMs ?? contact.observedAtMs;
        const passStage: TransitStage =
          Math.abs(passMoment - referenceTimeMs) <= ARC_EXACT_WINDOW_MS
            ? "exact"
            : referenceTimeMs < passMoment
              ? "approaching"
              : "integrating";
        return {
          passId: contact.contactId,
          exactAt: toIso(passMoment),
          direction: contact.input.isRetrograde === true ? "retrograde" : "direct",
          stage: passStage,
          stageLabel: STAGE_LABEL[passStage],
          orb: contact.match.orb
        } satisfies TransitArcPass;
      });

      return {
        arcId,
        signature: representative.signature,
        transitPlanet: representative.input.transitPlanet,
        natalPoint: representative.input.natalPoint,
        natalHouse: representative.input.natalHouse ?? null,
        aspect: {
          key: representative.match.key,
          label: representative.match.label,
          angle: representative.match.angle
        },
        stage,
        stageLabel: STAGE_LABEL[stage],
        window: {
          startAt: toIso(startAt),
          peakAt: toIso(peak.exactAtMs ?? peak.observedAtMs),
          endAt: toIso(endAt)
        },
        previousExactAt: metadata.previousExactAt === null ? null : toIso(metadata.previousExactAt),
        nextExactAt: metadata.nextExactAt === null ? null : toIso(metadata.nextExactAt),
        rankingWindow: {
          startAt: toIso(metadata.startAt),
          endAt: toIso(metadata.endAt)
        },
        rankingReason: metadata.reason,
        passes,
        hasRetrogradePass: passes.some((pass) => pass.direction === "retrograde"),
        reasons: representative.reasons
      } satisfies TransitArc;
    })
    .sort((left, right) => left.window.startAt.localeCompare(right.window.startAt) || left.arcId.localeCompare(right.arcId));
}

export function rankTransitContacts(
  contacts: TransitContactInput[],
  options?: TransitLayerOptions
): RankedTransit[] {
  const prepared = prepareContacts(contacts, options);
  return rankPrepared(prepared.contacts, prepared.referenceTimeMs, prepared.localDate, prepared.timezone);
}

export function buildTransitArcs(contacts: TransitContactInput[], options?: TransitLayerOptions): TransitArc[] {
  const prepared = prepareContacts(contacts, options);
  return buildArcsPrepared(prepared.contacts, prepared.referenceTimeMs, prepared.localDate, prepared.timezone);
}

export function buildTransitLayers(contacts: TransitContactInput[], options?: TransitLayerOptions): TransitLayers {
  const prepared = prepareContacts(contacts, options);
  const ranking = rankPrepared(prepared.contacts, prepared.referenceTimeMs, prepared.localDate, prepared.timezone);
  return {
    version: TRANSIT_RANKING_VERSION,
    activeCount: ranking.length,
    ranking,
    topThree: ranking.slice(0, 3),
    arcs: buildArcsPrepared(prepared.contacts, prepared.referenceTimeMs, prepared.localDate, prepared.timezone)
  };
}
