import {
  actionGeneric as action,
  internalActionGeneric as internalAction,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  mutationGeneric as mutation,
  queryGeneric as query
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { editorialRitualFor } from "./content/tarotEditorial";
import { runAstrologyApiDailyTransits } from "./lib/astrologyApi";
import {
  extractNormalizedChartFromPayload,
  houseThemes,
  selectRelevantTransits,
  type NormalizedAstroTransit
} from "./lib/orbita";
import { cardById, drawCard, type TarotDraw } from "./lib/tarot";
import { findCurrentUser, findUserByTokenIdentifier, requireIdentity, requireUser } from "./lib/users";

/**
 * Guía diaria personalizada: análisis del día para CADA usuario, calculado sobre los
 * aspectos tránsito→carta natal (los trae el proveedor) e interpretado con LLM en voz
 * Órbita. Cache 1 por (userId, localDate). Ritual editorial versionado sin LLM/proveedor.
 * Ver `docs/guia-diaria-personalizada.md`.
 */

const internalApi = internal as any;
const AI_GATEWAY_CHAT_COMPLETIONS_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";
const DAILY_GUIDE_PAYLOAD_VERSION = "orbita-daily-guide-v3";
const EXTERNAL_STAGE_TIMEOUT_MS = 5_000;
const ENRICHMENT_LEASE_MS = 2 * 60_000;
const ENRICHMENT_RETRY_MS = 5 * 60_000;

/** Áreas de la Home. El orden es el de los tabs. */
const TOPIC_KEYS = ["amor", "trabajo", "familia", "vinculos"] as const;
type TopicKey = (typeof TOPIC_KEYS)[number];
const TOPIC_LABELS: Record<TopicKey, string> = {
  amor: "Amor",
  trabajo: "Trabajo",
  familia: "Familia",
  vinculos: "Vínculos"
};

type DailyTopic = {
  topic: TopicKey;
  label: string;
  title: string;
  oneLine: string;
  detail: string;
  hace: string;
  evita: string;
  question: string;
};

/** La carta del día ya sorteada, con su lectura. `id` viaja como número 0–77: el
 *  front resuelve la ilustración con un mapa estático (Metro no puede requerir
 *  imágenes por string dinámico, así que el mapeo id→imagen vive en el bundle). */
export type DailyRitualFaceta = {
  titulo: string;
  texto: string;
};

export type DailyRitual = {
  esencia: string;
  significadoGeneral: DailyRitualFaceta[];
  enTuDia: string;
  consejo: string;
  cierre: {
    pregunta: string;
    umbralSeed?: string;
  };
};

type DailyCarta = {
  id: number;
  nombre: string;
  correspondencia: string;
  orientacion: "derecho" | "invertida";
  ritual: DailyRitual;
  /** Puente temporal para clientes <= build 13. Se deriva del ritual v3 y no
   *  introduce otra generación ni un cruce astrológico inventado. */
  beats: Array<{ label: string; body: string }>;
};

type DailyGuidePayload = {
  /** Invalida documentos diarios escritos con contratos anteriores. Sin esto,
   *  `getGuide` devolvía el cache viejo aunque todavía no tuviera `carta`. */
  payloadVersion: typeof DAILY_GUIDE_PAYLOAD_VERSION;
  headline: string;
  body: string;
  clima: string;
  destacado: { aspecto: string; lectura: string };
  secundarios: Array<{ aspecto: string; lectura: string }>;
  basadoEn: string[];
  disclaimer: string;
  /** Carta del día. Siempre presente (el sorteo no depende del LLM); usa una de
   *  las 156 lecturas editoriales canónicas, nunca un cruce astro inventado. */
  carta?: DailyCarta;
  /* --- La Home completa, misma generación. Opcionales: si el LLM está apagado o
     falla, quedan `undefined` y el front cae al engine local (comportamiento previo). --- */
  /** La idea única del día. Las 4 áreas la retoman desde su ángulo — es lo que hace
   *  que la Home se lea como UN texto y no como bloques sueltos. */
  tesis?: string;
  guia?: {
    eyebrow: string;
    headline: string;
    intro: string;
    hace: string;
    evita: string;
    energia: string;
    accion: string;
  };
  topics?: DailyTopic[];
  lecturaLarga?: { eyebrow: string; title: string; body: string };
  cierre?: string;
  /** Estado aditivo del enriquecimiento. Clientes anteriores lo ignoran y siguen
   *  consumiendo el mismo payload v3; el ritual de `carta` nunca se reemplaza. */
  enrichment?: DailyEnrichment;
};

type DailyEnrichmentStatus = "pending" | "ready" | "fallback" | "error";

type DailyEnrichment = {
  status: DailyEnrichmentStatus;
  requestedAt: number;
  completedAt?: number;
  retryAfter?: number;
  attempt: number;
};

type DailyPersonalized = Omit<
  DailyGuidePayload,
  "payloadVersion" | "carta" | "enrichment"
>;

export type DailyCardState = {
  card: DailyCarta & { revealed: boolean; revealedAt?: number };
  enrichment: DailyEnrichment;
  personalized: DailyPersonalized;
};

type EnrichmentPlan = {
  payload: DailyGuidePayload;
  shouldSchedule: boolean;
  cacheHit: boolean;
  reason: "created" | "legacy_ready" | "ready" | "in_flight" | "retry";
};

/** Un documento diario puede sobrevivir a varias versiones de la app. Solo lo
 *  reutilizamos si cumple el contrato mínimo actual; si no, se regenera y se
 *  reemplaza preservando metadata como `revealedAt`. */
export function isCurrentDailyGuidePayload(value: unknown): value is DailyGuidePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  if (payload.payloadVersion !== DAILY_GUIDE_PAYLOAD_VERSION) return false;
  const carta = payload.carta;
  if (!carta || typeof carta !== "object" || Array.isArray(carta)) return false;
  const card = carta as Record<string, unknown>;
  const orientationValid = card.orientacion === "derecho" || card.orientacion === "invertida";
  return (
    typeof card.id === "number" &&
    Number.isInteger(card.id) &&
    card.id >= 0 &&
    card.id <= 77 &&
    typeof card.nombre === "string" &&
    orientationValid &&
    parseRitual(card.ritual) !== undefined
  );
}

function readEnrichment(value: unknown): DailyEnrichment | undefined {
  const raw = asRecord(value);
  if (!raw) return undefined;
  const status = raw.status;
  if (status !== "pending" && status !== "ready" && status !== "fallback" && status !== "error") return undefined;
  const requestedAt = typeof raw.requestedAt === "number" ? raw.requestedAt : 0;
  const attempt = typeof raw.attempt === "number" && Number.isInteger(raw.attempt) ? raw.attempt : 0;
  return {
    status,
    requestedAt,
    attempt,
    completedAt: typeof raw.completedAt === "number" ? raw.completedAt : undefined,
    retryAfter: typeof raw.retryAfter === "number" ? raw.retryAfter : undefined
  };
}

/** Decisión pura que usa la mutation transaccional. El primer writer agenda una
 *  sola mejora; los demás reutilizan el mismo documento. Un lease vencido permite
 *  recuperar jobs perdidos sin volver a bloquear el request del usuario. */
export function planFastGuide(args: {
  existing: unknown;
  candidate: DailyGuidePayload;
  now: number;
}): EnrichmentPlan {
  if (!isCurrentDailyGuidePayload(args.existing)) {
    return { payload: args.candidate, shouldSchedule: true, cacheHit: false, reason: "created" };
  }

  const existing = args.existing;
  const enrichment = readEnrichment(existing.enrichment);
  // Payloads v3 anteriores al fast path ya fueron generados de forma completa.
  if (!enrichment) {
    return { payload: existing, shouldSchedule: false, cacheHit: true, reason: "legacy_ready" };
  }
  if (enrichment.status === "ready") {
    return { payload: existing, shouldSchedule: false, cacheHit: true, reason: "ready" };
  }

  const retryAt =
    enrichment.status === "pending"
      ? enrichment.requestedAt + ENRICHMENT_LEASE_MS
      : enrichment.retryAfter ?? enrichment.requestedAt + ENRICHMENT_RETRY_MS;
  if (args.now < retryAt) {
    return { payload: existing, shouldSchedule: false, cacheHit: true, reason: "in_flight" };
  }

  const payload: DailyGuidePayload = {
    ...existing,
    enrichment: {
      status: "pending",
      requestedAt: args.now,
      attempt: Math.max(1, enrichment.attempt + 1)
    }
  };
  return { payload, shouldSchedule: true, cacheHit: true, reason: "retry" };
}

/** El enriquecimiento puede reemplazar módulos personalizados, pero jamás la carta,
 *  su orientación ni su ritual: la lectura que la persona empezó a leer es estable. */
export function mergeEnrichedGuide(args: {
  existing: DailyGuidePayload;
  enriched: DailyGuidePayload;
  status: "ready" | "fallback" | "error";
  now: number;
}): DailyGuidePayload {
  const previous = readEnrichment(args.existing.enrichment);
  return {
    ...args.enriched,
    carta: args.existing.carta,
    enrichment: {
      status: args.status,
      requestedAt: previous?.requestedAt ?? args.now,
      completedAt: args.now,
      retryAfter: args.status === "ready" ? undefined : args.now + ENRICHMENT_RETRY_MS,
      attempt: Math.max(1, previous?.attempt ?? 1)
    }
  };
}

/** Contrato aditivo para el frontend desacoplado. Mantiene la carta separada de
 *  los módulos que llegan después y normaliza payloads v3 previos como ready. */
export function splitDailyState(payload: DailyGuidePayload, revealedAt?: number | null): DailyCardState {
  if (!payload.carta) throw new Error("Daily card is missing");
  const { payloadVersion: _version, carta, enrichment: rawEnrichment, ...personalized } = payload;
  const enrichment = readEnrichment(rawEnrichment) ?? {
    status: "ready" as const,
    requestedAt: 0,
    completedAt: 0,
    attempt: 1
  };
  return {
    card: {
      ...carta,
      revealed: typeof revealedAt === "number",
      revealedAt: typeof revealedAt === "number" ? revealedAt : undefined
    },
    enrichment,
    personalized
  };
}

/** Timebox real: aborta fetch cuando lo soporta y, aunque el proveedor ignore la
 *  señal, la etapa deja de bloquear al cumplirse el presupuesto. */
export async function withAbortTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`stage_timeout_${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type DailyGenerated = {
  headline: string;
  body: string;
  clima: string;
  destacadoLectura: string;
  /** Lectura intrínseca de la carta. No usa carta natal ni tránsitos. */
  cartaRitual?: DailyRitual;
  tesis?: string;
  guia?: DailyGuidePayload["guia"];
  topics?: DailyTopic[];
  lecturaLarga?: DailyGuidePayload["lecturaLarga"];
  cierre?: string;
};

const DISCLAIMER = "Entretenimiento y autoconocimiento. No es predicción ni consejo profesional.";

export function localDateForTimezone(timezone?: string, now: Date = new Date()): string {
  const tz = timezone && timezone.trim() ? timezone.trim() : DEFAULT_TIMEZONE;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      now
    );
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Aritmética de fecha civil, siempre en UTC para no saltar días por DST. */
export function shiftLocalDate(localDate: string, deltaDays: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match || !Number.isInteger(deltaDays)) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

/** Extrae solo ids válidos del contrato nuevo; tolera guías históricas o dañadas. */
export function recentCardIdsFromPayloads(payloads: unknown[]): number[] {
  const ids = payloads
    .map((payload) => {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
      const carta = (payload as Record<string, unknown>).carta;
      if (!carta || typeof carta !== "object" || Array.isArray(carta)) return null;
      return (carta as Record<string, unknown>).id;
    })
    .filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id >= 0 && id <= 77);
  return [...new Set(ids)];
}

// --- Aspecto tránsito→natal en texto legible -------------------------------

/** Los nombres de signo llegan en minúscula y sin tilde del normalizador ("cancer",
 *  "geminis"). Esto es texto que la persona LEE (y que el LLM copia tal cual al
 *  escribir), así que acá se visten: "Cáncer", "Géminis". */
const SIGN_DISPLAY: Record<string, string> = {
  aries: "Aries",
  tauro: "Tauro",
  geminis: "Géminis",
  cancer: "Cáncer",
  leo: "Leo",
  virgo: "Virgo",
  libra: "Libra",
  escorpio: "Escorpio",
  sagitario: "Sagitario",
  capricornio: "Capricornio",
  acuario: "Acuario",
  piscis: "Piscis"
};

function signDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  const clean = raw.trim();
  return SIGN_DISPLAY[clean.toLowerCase()] ?? clean.charAt(0).toUpperCase() + clean.slice(1);
}

function aspectLine(t: NormalizedAstroTransit): string {
  const sign = t.transitSignEs ? ` en ${signDisplay(t.transitSignEs)}` : "";
  const house = t.natalHouse ? ` (casa ${t.natalHouse})` : "";
  return `${t.transitPlanetEs}${sign} ${t.aspectTypeEs} tu ${t.natalPointEs}${house}`;
}

/** Línea de tránsito para el PROMPT: además del aspecto, el tema de la casa tocada,
 *  la retrogradación y si el aspecto se hace exacto hoy. Esa es la materia prima que
 *  le faltaba al modelo para decir algo específico en vez de algo plausible. */
function transitBrief(t: NormalizedAstroTransit, exactToday: boolean): string {
  const parts = [aspectLine(t)];
  if (t.natalHouse && houseThemes[t.natalHouse]) {
    parts.push(`toca tu casa ${t.natalHouse} → ${houseThemes[t.natalHouse]}`);
  }
  if (t.isRetrograde) parts.push(`${t.transitPlanetEs} está retrógrado`);
  if (exactToday) parts.push("el aspecto se hace EXACTO hoy (pico de intensidad)");
  return parts.join(" · ");
}

function isExactToday(t: NormalizedAstroTransit, localDate: string): boolean {
  return typeof t.exactTime === "string" && t.exactTime.slice(0, 10) === localDate;
}

/** Retrato de la carta para el prompt: no solo la tríada — también planetas personales
 *  con casa, y los aspectos natales duros (la tensión ESTRUCTURAL de la persona, contra
 *  la que el tránsito de hoy va a rozar). Sin esto el modelo no tiene con qué contrastar. */
function natalBrief(chartPayload: unknown): { lines: string[]; tension: string[] } {
  const chart = extractNormalizedChartFromPayload(chartPayload);
  if (!chart) return { lines: [], tension: [] };

  const lines: string[] = [];
  const placementLine = (p: { label: string; signEs: string; house: number | null } | null | undefined) => {
    if (!p || typeof p.signEs !== "string" || !p.signEs.trim()) return;
    const house = p.house ? ` · casa ${p.house} (${houseThemes[p.house] ?? "área de vida"})` : "";
    lines.push(`${p.label} en ${signDisplay(p.signEs)}${house}`);
  };

  placementLine(chart.summary?.sun);
  placementLine(chart.summary?.moon);
  placementLine(chart.summary?.ascendant);

  // Personales: son los que mandan en el día a día (el social/generacional no aporta acá).
  const personales = new Set(["mercury", "venus", "mars"]);
  for (const p of chart.placements ?? []) {
    if (personales.has(p.key)) placementLine(p);
  }

  // Aspectos natales de tensión: cuadraturas y oposiciones cerradas. Son el "nudo" de
  // la persona; cuando un tránsito los activa, ahí está la nota que vale la pena tocar.
  const tension = (chart.summary?.mainAspects ?? [])
    .filter((a) => a.isMajor && (a.typeEs === "cuadratura" || a.typeEs === "oposición"))
    .slice(0, 3)
    .map((a) => `${a.from} ${a.typeEs} ${a.to}`);

  return { lines, tension };
}

// --- Capa LLM (gateway clonado, prompt/parser propios) ----------------------

const DAILY_SYSTEM =
  "Sos la voz de Órbita. Escribís como alguien que conoce a esta persona hace diez años, la quiere, " +
  "y ya se cansó de verla hacer lo mismo. Ese es el tono exacto: intimidad ganada, cero paciencia para " +
  "la excusa que la persona se viene repitiendo. No la maltratás — le hablás de igual a igual y le decís " +
  "la cosa que sus amigos no le dicen para no incomodarla.\n" +
  "Español rioplatense, voseo, tildes y signos de apertura (¿? ¡!).\n" +
  "Nunca consolás. Nunca cerrás con alivio. No sos coach, no sos terapeuta, no sos el universo. " +
  "Leés el cielo sobre su carta, ves un patrón, y se lo ponés adelante. Qué hace con eso es problema de ella.";

export function buildDailyPrompt(args: {
  natal: string[];
  tension: string[];
  transits: NormalizedAstroTransit[];
  localDate: string;
  name?: string;
  carta: TarotDraw;
}): string {
  const natalLines = args.natal.length ? args.natal.map((l) => `- ${l}`).join("\n") : "- (carta en calibración)";
  const tensionLines = args.tension.length
    ? args.tension.map((l) => `- ${l}`).join("\n")
    : "- (sin aspectos natales duros destacados)";
  const transitLines = args.transits.length
    ? args.transits.map((t, i) => `${i + 1}. ${transitBrief(t, isExactToday(t, args.localDate))}`).join("\n")
    : "- (sin tránsitos destacados hoy)";
  const persona = args.name?.trim() ? `Se llama ${args.name.trim().split(" ")[0]}.` : "";

  return `PERSONA. ${persona}

Su carta natal (estructura de base — cómo es siempre):
${natalLines}

Su tensión estructural (los nudos con los que ya carga; el tránsito de hoy va a rozar alguno):
${tensionLines}

EL CIELO DE HOY sobre su carta (el 1 es el destacado; los demás matizan):
${transitLines}

LA CARTA QUE SACÓ HOY: ${args.carta.nombre} — salió ${args.carta.orientacion === "invertida" ? "INVERTIDA" : "AL DERECHO"}.
Correspondencia editorial: ${args.carta.correspondencia}.

---

TU TAREA. Escribí la Home de hoy: un solo texto, en varios bloques.

Primero decidí la TESIS DEL DÍA: UNA sola idea, específica de ESTA carta natal y de ESTOS tránsitos.
Sale del cruce entre lo que la persona ES (carta natal + tensión) y lo que HOY la está empujando (tránsito 1).
Esa tesis es la columna vertebral: la guía, las 4 áreas y la lectura larga la retoman desde su ángulo.
"cartaRitual" queda afuera de esa tesis: es una lectura independiente de carta + orientación.
Si los cuatro bloques de área se pueden leer sueltos y dan igual, fracasaste.

CÓMO ESCRIBIR (esto es lo que separa un texto que pega de uno que se olvida):

1. LA ESTRUCTURA DE DOS TIEMPOS. Todo bloque importante ("body", cada "detail", "lecturaLarga")
   se construye igual:
     Tiempo 1 — nombrás el mecanismo: qué tránsito toca qué punto, en qué casa, qué empuja.
     Tiempo 2 — decís LA COSA: el patrón de evitación que ese tránsito va a poner en evidencia hoy.
   El tiempo 2 es el que vale. Si un bloque solo describe el cielo y no llega a incomodar, está a medias.

2. Anclá SIEMPRE en el mecanismo. Si una frase no se puede rastrear a un dato de la carta o de los
   tránsitos de arriba, sobra: borrala. Nada de astrología decorativa.

3. Prohibido el hedge. Lista negra, no uses NINGUNA de estas:
   "puede que", "quizás", "tal vez", "es posible que", "capaz", "quién sabe", "a lo mejor",
   "un poco de", "algo de", "cierta", "podrías llegar a", "tratá de", "intentá", "sería bueno",
   "no está de más", "date permiso", "permitite".
   Afirmá en presente o futuro directo. Hacete cargo de lo que decís.

4. Prohibido el consuelo. NO cierres ningún bloque suavizando lo que acabás de decir.
   Prohibidas: "pero está bien", "y eso no está mal", "sé amable con vos", "no te exijas tanto",
   "todo a su tiempo", "confiá en vos", "el universo conspira", "soltá lo que no te sirve",
   "abrí tu corazón", "todo llega".
   Si escribiste algo filoso, DEJALO AHÍ. La incomodidad es el producto.

5. Nombrá el autoengaño, no el sentimiento. El movimiento clave: agarrar la excusa que la persona
   se dice y traducirla.
   Tibio:  "Puede que hoy sientas algo de inseguridad con un proyecto."
   Medio:  "Marte en tu casa 10 te empuja a mostrar tu trabajo, pero vas a dudar."
   ÓRBITA: "Marte activa tu casa 10 y te pide que muestres. Vas a decir que el proyecto 'todavía no está listo'. No está listo desde marzo. No es el proyecto."
   Escribí siempre al nivel ÓRBITA.

6. Específico > universal. Test: si la frase le sirve igual a cualquier otro ser humano, no sirve.
   Nombrá conductas observables (mandar el mensaje, cortar la llamada, revisar el documento por
   sexta vez), no estados abstractos (sentirte pleno, encontrar tu centro).

7. Las preguntas de área no son de reflexión: son incisiones. Que la persona no pueda contestarlas
   rápido y quedarse tranquila.
   Tibia:  "¿Qué te gustaría mejorar en tus vínculos?"
   ÓRBITA: "¿A quién estás llamando 'complicado' para no admitir que te da miedo?"

8. Frases cortas. Punto y aparte. Sin jerga astrológica sin traducir. Sin misterio decorativo.

LA CARTA DEL RITUAL (un bloque independiente del cielo de hoy).

La carta SALIÓ AL AZAR. No la eligió el cielo ni la carta natal. Su lectura es INTRÍNSECA:
solo usa el nombre, el simbolismo editorial y la orientación que te di arriba.

PROHIBIDO dentro de "cartaRitual":
- nombrar planetas, signos, casas, aspectos o tránsitos de la persona;
- decir que salió "por algo", que anuncia o predice;
- convertir una invertida en el simple contrario de la carta al derecho.

La orientación cambia el sentido de verdad:
- AL DERECHO: potencia disponible, movimiento visible, aprendizaje que puede encarnarse.
- INVERTIDA: bloqueo, exceso, repliegue o sombra del mismo arquetipo. No es castigo ni mal augurio.

Escribí la carta como un ritual de autoconocimiento con el ritmo editorial del frame aprobado:
- una esencia explicativa de 1 o 2 frases completas, nunca telegráfica ni defensiva;
- EXACTAMENTE 3 facetas separadas: titulo breve + explicación concreta;
- un párrafo EN TU DÍA que teja vínculos, trabajo y creatividad/decisiones;
- un consejo de 1 o 2 frases completas en voseo;
- una pregunta abierta de cierre para llevar al Umbral.
Este bloque no personaliza con astrología; su honestidad está en no fingirla.

MODELO DE RITMO (no copies el contenido; copiá la estructura y la cadencia):
"Que te salga La Luna —Arcano Mayor XVIII— es una invitación a explorar tu intuición: simboliza
el mundo de los sueños, lo inconsciente y las verdades ocultas."
SIGNIFICADO GENERAL: tres párrafos "Faceta — explicación".
EN TU DÍA: "En los vínculos, ...; en el trabajo, ...; en lo creativo, ...".
EL CONSEJO: dos frases completas, concretas y sin autoayuda genérica.

PROHIBIDO dentro del texto visible de la carta: "no predice", "no define el día", "no es una orden"
o cualquier aclaración defensiva que corte la experiencia editorial.

DÓNDE ESTÁ EL LÍMITE (leelo bien: el filo mal calibrado es crueldad, y eso no lo publicamos).

El filo apunta SIEMPRE a una conducta evitativa concreta y modificable, en el marco del día de hoy.
Nunca apunta a quién es la persona, a su valor, a su cuerpo, ni a un defecto permanente.

  SÍ: "Vas a decir que no tenés tiempo. Tenés tiempo. No tenés ganas de que te digan que no."
      → señala una excusa puntual, y deja la salida abierta.

  NO: "Sos un cobarde." / "Siempre vas a estar solo." / "Por eso nadie te aguanta."
      → juicio sobre la persona, o sentencia sobre su futuro. Prohibido.

La prueba: después de leerlo, la persona tiene que sentir que la vieron, no que la agredieron.
Apuntá al patrón, dejale la puerta. Ante la duda, elegí lo específico antes que lo hiriente.

REGLAS DURAS (no negociables, por encima de TODO lo anterior — incluido el filo):
- Entretenimiento y autoconocimiento. NO es predicción, ni consejo de salud, dinero, legal ni psicología clínica.
- Nada de destino garantizado, ni promesas de resultados, ni diagnósticos, ni etiquetas clínicas
  ("sos ansioso", "tenés un trauma", "sos codependiente"). No diagnosticás: describís una conducta de hoy.
- Nada sobre cuerpo, peso, salud física o mental, plata concreta, ni decisiones legales.
- Voseo ("vos", "te", "tenés", "estás"). Tildes y signos de apertura. Sin inglés visible.

Devolvé SOLO JSON válido con esta forma exacta:
{
  "tesis": "string — la idea del día en 1 frase, con la excusa que la persona se va a decir hoy ya identificada. Es tu brújula: tiene que estar presente en TODOS los bloques",
  "headline": "string — 4 a 7 palabras. El tránsito destacado con una torsión (ej. \\"Marte te apura donde tu Luna frena\\")",
  "body": "string — 3 a 4 frases, ESTRUCTURA DE DOS TIEMPOS: primero el mecanismo, después la cosa que incomoda. La última frase es la que tiene que doler",
  "clima": "string — una línea corta de clima del día",
  "destacadoLectura": "string — 1 frase sobre el tránsito destacado (el aspecto 1)",
  "cartaRitual": {
    "esencia": "string — 1 o 2 frases: qué invita a mirar ${args.carta.nombre} ${args.carta.orientacion === "invertida" ? "invertida" : "al derecho"}",
    "significadoGeneral": [
      { "titulo": "string — faceta breve", "texto": "string — 1 frase, sin repetir el título" },
      { "titulo": "string — faceta breve", "texto": "string — 1 frase, sin repetir el título" },
      { "titulo": "string — faceta breve", "texto": "string — 1 frase, sin repetir el título" }
    ],
    "enTuDia": "string — un párrafo que teja vínculos, trabajo y creatividad/decisiones en prosa. Sin astrología personalizada",
    "consejo": "string — 1 o 2 frases, accionable y humano, en voseo",
    "cierre": {
      "pregunta": "string — pregunta abierta con ¿ y ?",
      "umbralSeed": "string opcional — pregunta lista para llevar al Umbral"
    }
  },
  "guia": {
    "eyebrow": "string — 2 a 3 palabras en mayúsculas (ej. \\"GUÍA DE HOY\\")",
    "headline": "string — 4 a 8 palabras, serif, retoma la tesis",
    "intro": "string — 1 o 2 frases que enmarcan el día",
    "hace": "string — 1 frase. Una conducta observable, hoy, anclada en el tránsito. Un verbo concreto, no un estado de ánimo",
    "evita": "string — 1 frase. NO el error genérico: el movimiento evasivo específico al que ESTA carta recurre bajo ESTE tránsito. Nombralo como lo haría la persona para justificarse",
    "energia": "string — 1 frase sobre el tono del día y de qué tránsito sale",
    "accion": "string — 1 frase. Algo hacible hoy en menos de 10 minutos. Que cueste un poco"
  },
  "topics": [
    {
      "topic": "amor",
      "title": "string — 3 a 6 palabras, serif",
      "oneLine": "string — 1 frase: la tesis del día vista desde el amor",
      "detail": "string — 2 o 3 frases, dos tiempos: mecanismo astrológico nombrado + la observación incómoda",
      "hace": "string — 1 frase concreta y observable",
      "evita": "string — 1 frase: la excusa específica, dicha con las palabras de la persona",
      "question": "string — 1 incisión, con ¿ y ?. Que NO se pueda contestar rápido y quedarse tranquila. Ej: \\"¿A quién estás llamando complicado para no admitir que te da miedo?\\""
    },
    { "topic": "trabajo", "...": "misma forma" },
    { "topic": "familia", "...": "misma forma" },
    { "topic": "vinculos", "...": "misma forma" }
  ],
  "lecturaLarga": {
    "eyebrow": "string — en mayúsculas (ej. \\"LECTURA LARGA\\")",
    "title": "string — 4 a 8 palabras, serif",
    "body": "string — 4 a 6 frases: el desarrollo de la tesis con tiempo. Acá es donde podés ir más hondo en el patrón: de dónde viene, cómo se repite, qué le cuesta a la persona. NO lo cierres con consuelo"
  },
  "cierre": "string — 1 frase, serif, que quede. Ni consejo ni moraleja ni alivio: la observación que la persona se va a acordar a las 3 de la tarde"
}

Los 4 objetos de "topics" son obligatorios y en ese orden: amor, trabajo, familia, vinculos.`;
}

function stripJsonFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Guía. Si falta algún campo, devuelve null → el front cae al engine local para ESE
 *  bloque. Preferimos degradar por bloque antes que mostrar una Home a medio llenar. */
function parseGuia(value: unknown): DailyGuidePayload["guia"] | undefined {
  const r = asRecord(value);
  if (!r) return undefined;
  const guia = {
    eyebrow: readString(r.eyebrow) || "GUÍA DE HOY",
    headline: readString(r.headline),
    intro: readString(r.intro),
    hace: readString(r.hace),
    evita: readString(r.evita),
    energia: readString(r.energia),
    accion: readString(r.accion)
  };
  const complete = guia.headline && guia.intro && guia.hace && guia.evita && guia.energia && guia.accion;
  return complete ? guia : undefined;
}

/** Áreas. Exige las 4 (amor/trabajo/familia/vínculos) completas y las devuelve en el
 *  orden de los tabs — el modelo no siempre respeta el orden pedido. */
function parseTopics(value: unknown): DailyTopic[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const byKey = new Map<TopicKey, DailyTopic>();

  for (const raw of value) {
    const r = asRecord(raw);
    if (!r) continue;
    const key = readString(r.topic).toLowerCase() as TopicKey;
    if (!TOPIC_KEYS.includes(key) || byKey.has(key)) continue;

    const topic: DailyTopic = {
      topic: key,
      label: TOPIC_LABELS[key],
      title: readString(r.title),
      oneLine: readString(r.oneLine),
      detail: readString(r.detail),
      hace: readString(r.hace),
      evita: readString(r.evita),
      question: readString(r.question)
    };
    if (topic.title && topic.oneLine && topic.detail && topic.hace && topic.evita) byKey.set(key, topic);
  }

  if (byKey.size !== TOPIC_KEYS.length) return undefined;
  return TOPIC_KEYS.map((k) => byKey.get(k)!);
}

/** Ritual de la carta. Se valida completo: si el modelo corta el JSON, cae entero
 *  al fallback honesto en vez de mezclar una lectura parcial con copy genérico. */
export function parseRitual(value: unknown): DailyRitual | undefined {
  const r = asRecord(value);
  if (!r || !Array.isArray(r.significadoGeneral)) return undefined;

  const significadoGeneral = r.significadoGeneral
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({ titulo: readString(item.titulo), texto: readString(item.texto) }))
    .filter((item) => item.titulo && item.texto);
  if (significadoGeneral.length !== 3) return undefined;

  const cierreRaw = asRecord(r.cierre);
  if (!cierreRaw) return undefined;
  const cierre = {
    pregunta: readString(cierreRaw.pregunta),
    umbralSeed: readString(cierreRaw.umbralSeed) || undefined
  };
  const ritual: DailyRitual = {
    esencia: readString(r.esencia),
    significadoGeneral,
    enTuDia: readString(r.enTuDia),
    consejo: readString(r.consejo),
    cierre
  };

  return ritual.esencia && ritual.enTuDia && ritual.consejo && ritual.cierre.pregunta ? ritual : undefined;
}

function parseLecturaLarga(value: unknown): DailyGuidePayload["lecturaLarga"] | undefined {
  const r = asRecord(value);
  if (!r) return undefined;
  const title = readString(r.title);
  const body = readString(r.body);
  if (!title || !body) return undefined;
  return { eyebrow: readString(r.eyebrow) || "LECTURA LARGA", title, body };
}

function parseDaily(text: string): DailyGenerated | null {
  try {
    const parsed = JSON.parse(stripJsonFence(text)) as Record<string, unknown>;
    const headline = readString(parsed.headline);
    const body = readString(parsed.body);
    const clima = readString(parsed.clima);
    const destacadoLectura = readString(parsed.destacadoLectura);
    if (!headline || !body || !clima) return null;
    return {
      headline,
      body,
      clima,
      destacadoLectura: destacadoLectura || body,
      cartaRitual: parseRitual(parsed.cartaRitual),
      tesis: readString(parsed.tesis) || undefined,
      guia: parseGuia(parsed.guia),
      topics: parseTopics(parsed.topics),
      lecturaLarga: parseLecturaLarga(parsed.lecturaLarga),
      cierre: readString(parsed.cierre) || undefined
    };
  } catch {
    return null;
  }
}

async function gatewayGenerateText(args: {
  apiKey: string;
  model: string;
  prompt: string;
  signal?: AbortSignal;
}): Promise<string> {
  const response = await fetch(AI_GATEWAY_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      "X-Vercel-AI-App-Name": "Orbita Daily"
    },
    signal: args.signal,
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: DAILY_SYSTEM },
        { role: "user", content: args.prompt }
      ],
      // La generación cubre TODA la Home (hero + guía + 4 áreas + lectura larga), no
      // solo el hero: con 500 tokens el JSON se cortaba a la mitad.
      temperature: 0.85,
      max_tokens: 2600,
      stream: false,
      providerOptions: { gateway: { user: "app", tags: ["feature:orbita-daily", "env:dev", "user:app"] } }
    })
  });

  const rawText = await response.text();
  let json: Record<string, unknown> = {};
  if (rawText) {
    try {
      json = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      json = { rawText };
    }
  }
  if (!response.ok) {
    throw new Error(`AI Gateway failed with ${response.status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
  const choices = Array.isArray(json.choices) ? json.choices : [];
  const first = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>) : {};
  const message = first.message && typeof first.message === "object" ? (first.message as Record<string, unknown>) : {};
  return readString(message.content);
}

type DailyInput = {
  natal: string[];
  tension: string[];
  transits: NormalizedAstroTransit[];
  localDate: string;
  name?: string;
  carta: TarotDraw;
};

/** Nombre conservado para no romper imports de tests/herramientas. Desde esta
 *  versión no construye copy genérico: lee una de las 156 piezas editoriales. */
export function fallbackRitual(carta: TarotDraw): DailyRitual {
  return editorialRitualFor(carta.id, carta.orientacion);
}

/** Compatibilidad aditiva durante el rollout de TestFlight. El cliente nuevo
 *  ignora este campo; el build 13 todavía lo necesita para no dejar la carta
 *  vacía mientras las personas actualizan. */
export function legacyBeatsFromRitual(ritual: DailyRitual): Array<{ label: string; body: string }> {
  return [
    { label: "QUÉ ES", body: ritual.esencia },
    { label: "EN TU DÍA", body: ritual.enTuDia },
    { label: "EL CONSEJO", body: ritual.consejo }
  ];
}

/** Sin LLM (o si falla) devolvemos SOLO el hero, con los bloques ricos en `undefined`:
 *  el front cae al engine local para guía/áreas/lectura larga, igual que antes de este
 *  cambio. Preferimos degradar a lo conocido antes que inventar una Home a medias. */
function fallbackDaily(args: DailyInput): DailyGenerated {
  const top = args.transits[0];
  if (top) {
    const line = aspectLine(top);
    return {
      headline: `${top.transitPlanetEs} toca tu ${top.natalPointEs}`,
      body: `Hoy ${line}. Es el movimiento del día sobre tu carta: prestale atención a esa área, sin forzar conclusiones.`,
      clima: "Un día para observar antes de decidir.",
      destacadoLectura: `Hoy ${line}.`
    };
  }
  return {
    headline: "Un día tranquilo en tu cielo",
    body: "Hoy no hay tránsitos fuertes sobre tu carta. Buen momento para sostener lo que ya venís haciendo, sin apurar nada nuevo.",
    clima: "Estable.",
    destacadoLectura: "Sin tránsitos destacados hoy."
  };
}

type DailyGenerationResult = {
  generated: DailyGenerated;
  source: "llm" | "fallback";
  reason?: "disabled" | "timeout" | "invalid" | "error";
};

async function generateDaily(args: DailyInput): Promise<DailyGenerationResult> {
  const enabled = process.env.ORBITA_LLM_ENABLED === "true";
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  const model = process.env.ORBITA_LLM_MODEL?.trim();
  if (!enabled || !apiKey || !model) {
    return { generated: fallbackDaily(args), source: "fallback", reason: "disabled" };
  }
  try {
    const text = await withAbortTimeout(EXTERNAL_STAGE_TIMEOUT_MS, (signal) =>
      gatewayGenerateText({ apiKey, model, prompt: buildDailyPrompt(args), signal })
    );
    const parsed = parseDaily(text);
    return parsed
      ? { generated: parsed, source: "llm" }
      : { generated: fallbackDaily(args), source: "fallback", reason: "invalid" };
  } catch (error) {
    const reason = error instanceof Error && error.message.startsWith("stage_timeout_") ? "timeout" : "error";
    return { generated: fallbackDaily(args), source: "fallback", reason };
  }
}

export function composePayload(args: {
  generated: DailyGenerated;
  transits: NormalizedAstroTransit[];
  carta: TarotDraw;
  ritual?: DailyRitual;
  enrichment?: DailyEnrichment;
}): DailyGuidePayload {
  const [top, ...rest] = args.transits;
  const g = args.generated;
  const ritual = args.ritual ?? g.cartaRitual ?? fallbackRitual(args.carta);
  return {
    payloadVersion: DAILY_GUIDE_PAYLOAD_VERSION,
    carta: {
      id: args.carta.id,
      nombre: args.carta.nombre,
      correspondencia: args.carta.correspondencia,
      orientacion: args.carta.orientacion,
      ritual,
      beats: legacyBeatsFromRitual(ritual)
    },
    headline: g.headline,
    body: g.body,
    clima: g.clima,
    destacado: { aspecto: top ? aspectLine(top) : "Sin tránsito destacado", lectura: g.destacadoLectura },
    secundarios: rest.slice(0, 3).map((t) => ({ aspecto: aspectLine(t), lectura: "" })),
    basadoEn: args.transits.slice(0, 3).map((t) => aspectLine(t).toUpperCase()),
    disclaimer: DISCLAIMER,
    tesis: g.tesis,
    guia: g.guia,
    topics: g.topics,
    lecturaLarga: g.lecturaLarga,
    cierre: g.cierre,
    enrichment: args.enrichment
  };
}

/** Payload completo y barato para el primer render. No llama proveedores ni IA. */
export function composeFastPayload(args: { carta: TarotDraw; now: number }): DailyGuidePayload {
  const generated = fallbackDaily({
    natal: [],
    tension: [],
    transits: [],
    localDate: "",
    carta: args.carta
  });
  return composePayload({
    generated,
    transits: [],
    carta: args.carta,
    ritual: fallbackRitual(args.carta),
    enrichment: { status: "pending", requestedAt: args.now, attempt: 1 }
  });
}

// --- Data layer ------------------------------------------------------------

export const getGuideState = internalQuery({
  args: { tokenIdentifier: v.string(), localDate: v.string() },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");

    const birthData = await ctx.db
      .query("birthData")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .first();
    const natalChart = await ctx.db
      .query("natalCharts")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .first();
    const existing = await ctx.db
      .query("dailyGuides")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();

    // Ventana móvil de siete días: hoy excluye lo que salió en los seis días
    // calendario anteriores. Los días que la persona no abrió no inventan carta.
    const recentWindowStart = shiftLocalDate(args.localDate, -6);
    const recentGuides = recentWindowStart
      ? await ctx.db
          .query("dailyGuides")
          .withIndex("by_user_date", (q: any) =>
            q.eq("userId", user._id).gte("localDate", recentWindowStart).lt("localDate", args.localDate)
          )
          .collect()
      : [];
    const recentCardIds = recentCardIdsFromPayloads(recentGuides.map((doc: any) => doc.payload));

    return { userId: user._id, name: user.name, birthData, natalChart, existing, recentCardIds };
  }
});

/** Contexto mínimo del fast path. En cache hit no carga carta natal ni datos de
 *  nacimiento completos: el build solo necesita devolver la carta ya persistida. */
export const getFastGuideState = internalQuery({
  args: { tokenIdentifier: v.string(), localDate: v.string() },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");

    const existing = await ctx.db
      .query("dailyGuides")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();
    if (isCurrentDailyGuidePayload(existing?.payload)) {
      return { userId: user._id, existing, recentCardIds: [] as number[] };
    }

    const recentWindowStart = shiftLocalDate(args.localDate, -6);
    const recentGuides = recentWindowStart
      ? await ctx.db
          .query("dailyGuides")
          .withIndex("by_user_date", (q: any) =>
            q.eq("userId", user._id).gte("localDate", recentWindowStart).lt("localDate", args.localDate)
          )
          .collect()
      : [];
    return {
      userId: user._id,
      existing,
      recentCardIds: recentCardIdsFromPayloads(recentGuides.map((doc: any) => doc.payload))
    };
  }
});

/** Solo se usa cuando el cliente no manda fecha ni timezone. Mantiene esa
 *  compatibilidad sin cargar el resto del estado de enriquecimiento. */
export const getGuideTimezone = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");
    const birthData = await ctx.db
      .query("birthData")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .first();
    return birthData?.timezone ?? DEFAULT_TIMEZONE;
  }
});

export const ensureFastGuide = internalMutation({
  args: { tokenIdentifier: v.string(), localDate: v.string(), payload: v.any() },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");

    const existing = await ctx.db
      .query("dailyGuides")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();
    const now = Date.now();
    const plan = planFastGuide({ existing: existing?.payload, candidate: args.payload as DailyGuidePayload, now });

    if (existing) {
      if (plan.payload !== existing.payload) await ctx.db.patch(existing._id, { payload: plan.payload });
    } else {
      await ctx.db.insert("dailyGuides", {
        userId: user._id,
        localDate: args.localDate,
        payload: plan.payload,
        createdAt: now
      });
    }

    if (plan.shouldSchedule) {
      await ctx.scheduler.runAfter(0, internalApi.daily.enrichGuide, {
        tokenIdentifier: args.tokenIdentifier,
        localDate: args.localDate
      });
    }

    return {
      payload: plan.payload,
      cacheHit: plan.cacheHit,
      scheduled: plan.shouldSchedule,
      reason: plan.reason,
      revealedAt: existing?.revealedAt ?? null
    };
  }
});

export const persistEnrichedGuide = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    localDate: v.string(),
    payload: v.any(),
    status: v.union(v.literal("ready"), v.literal("fallback"), v.literal("error"))
  },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) return { updated: false, reason: "user_missing" };
    const existing = await ctx.db
      .query("dailyGuides")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();
    if (!existing || !isCurrentDailyGuidePayload(existing.payload) || !isCurrentDailyGuidePayload(args.payload)) {
      return { updated: false, reason: "guide_missing" };
    }

    const currentCard = existing.payload.carta;
    const nextCard = args.payload.carta;
    if (!currentCard || !nextCard || currentCard.id !== nextCard.id || currentCard.orientacion !== nextCard.orientacion) {
      return { updated: false, reason: "card_changed" };
    }

    const payload = mergeEnrichedGuide({
      existing: existing.payload,
      enriched: args.payload,
      status: args.status,
      now: Date.now()
    });
    await ctx.db.patch(existing._id, { payload });
    return { updated: true, reason: args.status };
  }
});

export const enrichGuide = internalAction({
  args: { tokenIdentifier: v.string(), localDate: v.string() },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const state: any = await ctx.runQuery(internalApi.daily.getGuideState, args);
    if (!state.existing || !isCurrentDailyGuidePayload(state.existing.payload)) return null;

    const existing = state.existing.payload as DailyGuidePayload;
    const enrichment = readEnrichment(existing.enrichment);
    if (!enrichment || enrichment.status !== "pending" || !existing.carta) return null;

    const card = cardById(existing.carta.id);
    if (!card) return null;
    const carta: TarotDraw = { ...card, orientacion: existing.carta.orientacion };
    const { lines: natal, tension } = natalBrief(state.natalChart?.payload);

    let transits: NormalizedAstroTransit[] = [];
    let providerOutcome = state.birthData ? "fallback" : "missing_birth_data";
    const providerStartedAt = Date.now();
    if (state.birthData) {
      const bd = state.birthData;
      try {
        const providerResult = await withAbortTimeout(EXTERNAL_STAGE_TIMEOUT_MS, (signal) =>
          runAstrologyApiDailyTransits({
            input: {
              birthDate: bd.birthDate,
              birthTime: bd.birthTime,
              birthTimePrecision: bd.birthTimePrecision,
              birthPlaceLabel: bd.birthPlaceLabel,
              latitude: bd.latitude,
              longitude: bd.longitude,
              timezone: bd.timezone
            },
            localDate: args.localDate,
            signal
          })
        );
        providerOutcome = providerResult.status;
        if (providerResult.status === "success" && providerResult.normalized) {
          transits = selectRelevantTransits(providerResult.normalized.transits, 4);
        }
      } catch (error) {
        providerOutcome = error instanceof Error && error.message.startsWith("stage_timeout_") ? "timeout" : "error";
      }
    }
    const providerMs = Date.now() - providerStartedAt;

    const llmStartedAt = Date.now();
    const generation = await generateDaily({
      natal,
      tension,
      transits,
      localDate: args.localDate,
      name: state.name ?? undefined,
      carta
    });
    const llmMs = Date.now() - llmStartedAt;
    const enriched = composePayload({ generated: generation.generated, transits, carta });
    const status = providerOutcome === "success" && generation.source === "llm" ? "ready" : "fallback";

    const persistStartedAt = Date.now();
    const persisted: any = await ctx.runMutation(internalApi.daily.persistEnrichedGuide, {
      tokenIdentifier: args.tokenIdentifier,
      localDate: args.localDate,
      payload: enriched,
      status
    });
    const persistMs = Date.now() - persistStartedAt;

    console.info(
      "[daily.enrichment]",
      JSON.stringify({
        localDate: args.localDate,
        providerMs,
        providerOutcome,
        llmMs,
        llmOutcome: generation.source,
        llmReason: generation.reason ?? null,
        persistMs,
        updated: Boolean(persisted?.updated),
        outcome: status,
        totalMs: Date.now() - startedAt
      })
    );
    return persisted;
  }
});

// --- Actions públicas ------------------------------------------------------

async function runFastGuide(
  ctx: any,
  args: { localDate?: string; timezone?: string }
): Promise<{ payload: DailyGuidePayload; revealedAt: number | null }> {
    const startedAt = Date.now();
    const identity = await requireIdentity(ctx as any);
    const timezone =
      args.timezone ??
      (args.localDate
        ? DEFAULT_TIMEZONE
        : await ctx.runQuery(internalApi.daily.getGuideTimezone, { tokenIdentifier: identity.tokenIdentifier }));
    const localDate = args.localDate ?? localDateForTimezone(timezone);
    const state: any = await ctx.runQuery(internalApi.daily.getFastGuideState, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate
    });
    const stateMs = Date.now() - startedAt;

    const cardStartedAt = Date.now();
    const carta = drawCard({
      userId: String(state.userId),
      localDate,
      excludedIds: state.recentCardIds ?? []
    });
    const payload = composeFastPayload({ carta, now: Date.now() });
    const cardMs = Date.now() - cardStartedAt;

    // Cache hit puro: evita una mutation/roundtrip. Los casos que necesitan crear
    // o recuperar un job pasan por la mutation transaccional, que vuelve a decidir.
    const preflight = planFastGuide({ existing: state.existing?.payload, candidate: payload, now: Date.now() });
    let persisted: any = {
      payload: preflight.payload,
      cacheHit: preflight.cacheHit,
      scheduled: false,
      reason: preflight.reason,
      revealedAt: state.existing?.revealedAt ?? null
    };
    const persistStartedAt = Date.now();
    if (preflight.shouldSchedule) {
      persisted = await ctx.runMutation(internalApi.daily.ensureFastGuide, {
        tokenIdentifier: identity.tokenIdentifier,
        localDate,
        payload
      });
    }
    const persistMs = Date.now() - persistStartedAt;
    console.info(
      "[daily.fast]",
      JSON.stringify({
        localDate,
        cacheHit: Boolean(persisted?.cacheHit),
        scheduled: Boolean(persisted?.scheduled),
        reason: persisted?.reason ?? "unknown",
        stateMs,
        cardMs,
        persistMs,
        totalMs: Date.now() - startedAt
      })
    );
    return {
      payload: (persisted?.payload ?? payload) as DailyGuidePayload,
      revealedAt: typeof persisted?.revealedAt === "number" ? persisted.revealedAt : null
    };
}

/** Compatibilidad binaria: build 16 sigue consumiendo el payload v3 plano. */
export const getGuide = action({
  args: { localDate: v.optional(v.string()), timezone: v.optional(v.string()) },
  handler: async (ctx, args): Promise<DailyGuidePayload> => {
    return (await runFastGuide(ctx, args)).payload;
  }
});

/** Contrato definitivo para build 17+: la carta no depende del enriquecimiento. */
export const getCard = action({
  args: { localDate: v.optional(v.string()), timezone: v.optional(v.string()) },
  handler: async (ctx, args): Promise<DailyCardState> => {
    const result = await runFastGuide(ctx, args);
    return splitDailyState(result.payload, result.revealedAt);
  }
});

// --- El ritual: dar vuelta la carta ----------------------------------------

/** Da vuelta la carta de hoy. Idempotente: si ya estaba dada vuelta, no la re-escribe
 *  (queremos conservar la hora del PRIMER tirón, que es el dato del ritual).
 *
 *  Se saca una vez y queda. No hay "volver a guardarla": eso convertiría el ritual en
 *  un juguete y es justo lo que hacía el mock. */
export const revealCard = mutation({
  args: { localDate: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const doc = await ctx.db
      .query("dailyGuides")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();

    // Sin doc no hay carta: la guía todavía no se generó para ese día. El front llama a
    // getGuide al abrir, así que esto solo pasa si tocan la carta antes de que responda.
    if (!doc) throw new Error("Todavía no hay carta para ese día");
    if (!isCurrentDailyGuidePayload(doc.payload)) {
      throw new Error("La carta de hoy todavía se está actualizando");
    }
    if (doc.revealedAt) return doc.revealedAt;

    // No se puede sacar la carta de un día que todavía no empezó para esa persona.
    // El día se calcula con la timezone natal persistida, no con la timezone fija del
    // backend: cerca de medianoche pueden ser fechas distintas.
    const birthData = await ctx.db
      .query("birthData")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .first();
    const today = localDateForTimezone(birthData?.timezone);
    if (args.localDate > today) throw new Error("Ese día todavía no llegó");

    const revealedAt = Date.now();
    await ctx.db.patch(doc._id, { revealedAt });
    return revealedAt;
  }
});

/** La tira del Diario: qué carta salió cada día y si ya la diste vuelta.
 *
 *  Sale de `dailyGuides` (una fila por usuario/día) — o sea que el archivo del Diario no
 *  necesita tabla propia: ya lo veníamos escribiendo sin saberlo. Los días sin fila son
 *  días que la persona no abrió: no devuelven nada y el front los pinta boca abajo. */
export const getStrip = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];

    const docs = await ctx.db
      .query("dailyGuides")
      .withIndex("by_user_date", (q: any) =>
        q.eq("userId", user._id).gte("localDate", args.from).lte("localDate", args.to)
      )
      .collect();

    return docs.map((doc: any) => ({
      localDate: doc.localDate as string,
      cartaId: (doc.payload?.carta?.id ?? null) as number | null,
      orientacion: (doc.payload?.carta?.orientacion ?? null) as "derecho" | "invertida" | null,
      revealed: Boolean(doc.revealedAt)
    }));
  }
});
