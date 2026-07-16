import {
  actionGeneric as action,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  mutationGeneric as mutation,
  queryGeneric as query
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { runAstrologyApiDailyTransits } from "./lib/astrologyApi";
import {
  extractNormalizedChartFromPayload,
  houseThemes,
  selectRelevantTransits,
  type NormalizedAstroTransit
} from "./lib/orbita";
import { drawCard, type TarotDraw } from "./lib/tarot";
import { findUserByTokenIdentifier, requireExistingUser, requireIdentity, requireUser } from "./lib/users";

/**
 * Guía diaria personalizada: análisis del día para CADA usuario, calculado sobre los
 * aspectos tránsito→carta natal (los trae el proveedor) e interpretado con LLM en voz
 * Órbita. Cache 1 por (userId, localDate). Fallback determinístico sin LLM/proveedor.
 * Ver `docs/guia-diaria-personalizada.md`.
 */

const internalApi = internal as any;
const AI_GATEWAY_CHAT_COMPLETIONS_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";
const DAILY_GUIDE_PAYLOAD_VERSION = "orbita-daily-guide-v2";

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

/** La carta del día ya sorteada, con su lectura. `id` viaja como número: el front
 *  resuelve la ilustración con `majorById(id)` (Metro no puede requerir imágenes por
 *  string dinámico, así que el mapeo id→imagen vive en el bundle). */
type DailyCarta = {
  id: number;
  nombre: string;
  correspondencia: string;
  /** QUÉ ES · CÓMO INFLUYE HOY · CÓMO SE CONECTA CON TU CIELO */
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
  /** Carta del día. Siempre presente (el sorteo no depende del LLM); si el LLM falla,
   *  viene con beats de fallback. */
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
  return typeof card.id === "number" && typeof card.nombre === "string" && Array.isArray(card.beats);
}

type DailyGenerated = {
  headline: string;
  body: string;
  clima: string;
  destacadoLectura: string;
  /** Los 3 beats de la carta. La carta en sí la sorteamos nosotros, no el LLM. */
  cartaBeats?: Array<{ label: string; body: string }>;
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

function buildDailyPrompt(args: {
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

LA CARTA QUE SACÓ HOY: ${args.carta.nombre} — correspondencia astrológica: ${args.carta.correspondencia}
(Ese dato de correspondencia es verificado. Usalo. No inventes otro.)

---

TU TAREA. Escribí la Home de hoy: un solo texto, en varios bloques.

Primero decidí la TESIS DEL DÍA: UNA sola idea, específica de ESTA carta y de ESTOS tránsitos.
Sale del cruce entre lo que la persona ES (carta + tensión) y lo que HOY la está empujando (tránsito 1).
Esa tesis es la columna vertebral: la guía, las 4 áreas y la lectura larga la retoman desde su ángulo.
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

LA CARTA (leé esto con atención: acá es donde es fácil mentir).

La carta SALIÓ AL AZAR. No la eligió el cielo, no la eligió su carta natal, no "le tocó por algo".
Es un ritual, no un diagnóstico. Si escribís como si el cosmos la hubiera seleccionado, estás
mintiendo y se nota.

Lo que SÍ hacés: ponés la carta AL LADO del tránsito real y leés la tensión o el eco entre las dos.
La correspondencia de la carta (que te di arriba, es un dato verificado) es lo que hace que ese cruce
sea astrológicamente legítimo y no chamuyo poético.

  PROHIBIDO: "No es casualidad que te haya salido La Torre."
             "El universo te manda esta carta porque…"
             "La Torre anuncia que…"  (la carta no predice NADA)

  ASÍ SÍ:    Carta La Torre (Marte) + tránsito Saturno sobre tu Venus →
             "La Torre es Marte: quiere romper. Tu cielo hoy es Saturno sobre tu Venus: quiere
             contener. Te salió la carta que empuja justo donde el día te frena. Elegí a cuál
             de las dos le hacés caso."

  Si la carta y el tránsito EMPUJAN PARA EL MISMO LADO, decilo: se refuerzan.
  Si van en contra, decilo: ahí está la tensión del día.
  Las dos lecturas son honestas. La deshonesta es fingir que había un plan.

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
  "cartaBeats": [
    { "label": "QUÉ ES", "body": "string — 1 o 2 frases: qué representa ${args.carta.nombre}, en criollo. Sin esoterismo de manual" },
    { "label": "CÓMO INFLUYE HOY", "body": "string — 1 o 2 frases: qué te está diciendo hoy, a vos, con lo que está pasando en tu cielo" },
    { "label": "CÓMO SE CONECTA CON TU CIELO", "body": "string — 2 o 3 frases: el CRUCE. Nombrá la correspondencia (${args.carta.correspondencia}) y el tránsito destacado, y leé si se refuerzan o se contradicen. NO digas que la carta fue elegida ni que predice algo" }
  ],
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

/** Los 3 beats de la carta. Exige los 3 con cuerpo; si no, `undefined` → beats de fallback. */
function parseCartaBeats(value: unknown): Array<{ label: string; body: string }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const beats = value
    .map(asRecord)
    .filter((r): r is Record<string, unknown> => r !== null)
    .map((r) => ({ label: readString(r.label), body: readString(r.body) }))
    .filter((b) => b.label && b.body);
  return beats.length === 3 ? beats : undefined;
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
      cartaBeats: parseCartaBeats(parsed.cartaBeats),
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

async function gatewayGenerateText(args: { apiKey: string; model: string; prompt: string }): Promise<string> {
  const response = await fetch(AI_GATEWAY_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      "X-Vercel-AI-App-Name": "Orbita Daily"
    },
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

/** Beats sin LLM. Honestos y sobrios: describen la correspondencia real de la carta y
 *  el tránsito, sin fingir un puente que solo el LLM puede escribir bien. */
function fallbackBeats(carta: TarotDraw, top?: NormalizedAstroTransit): Array<{ label: string; body: string }> {
  const cielo = top ? `Hoy ${aspectLine(top)}.` : "Hoy no hay tránsitos fuertes sobre tu carta.";
  return [
    { label: "QUÉ ES", body: `${carta.nombre}. Su correspondencia astrológica es ${carta.correspondencia}.` },
    { label: "CÓMO INFLUYE HOY", body: "Tomala como un espejo del día, no como un pronóstico." },
    { label: "CÓMO SE CONECTA CON TU CIELO", body: `${cielo} Leé la carta al lado de eso.` }
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

async function generateDaily(args: DailyInput): Promise<DailyGenerated> {
  const enabled = process.env.ORBITA_LLM_ENABLED === "true";
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  const model = process.env.ORBITA_LLM_MODEL?.trim();
  if (!enabled || !apiKey || !model) return fallbackDaily(args);
  try {
    const text = await gatewayGenerateText({ apiKey, model, prompt: buildDailyPrompt(args) });
    return parseDaily(text) ?? fallbackDaily(args);
  } catch {
    return fallbackDaily(args);
  }
}

function composePayload(args: {
  generated: DailyGenerated;
  transits: NormalizedAstroTransit[];
  carta: TarotDraw;
}): DailyGuidePayload {
  const [top, ...rest] = args.transits;
  const g = args.generated;
  return {
    payloadVersion: DAILY_GUIDE_PAYLOAD_VERSION,
    carta: {
      id: args.carta.id,
      nombre: args.carta.nombre,
      correspondencia: args.carta.correspondencia,
      beats: g.cartaBeats ?? fallbackBeats(args.carta, top)
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
    cierre: g.cierre
  };
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

    return { userId: user._id, birthData, natalChart, existing };
  }
});

export const persistGuide = internalMutation({
  args: { tokenIdentifier: v.string(), localDate: v.string(), payload: v.any() },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");

    const existing = await ctx.db
      .query("dailyGuides")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();
    if (existing) {
      if (isCurrentDailyGuidePayload(existing.payload)) return existing.payload;
      await ctx.db.patch(existing._id, { payload: args.payload });
      return args.payload;
    }

    await ctx.db.insert("dailyGuides", {
      userId: user._id,
      localDate: args.localDate,
      payload: args.payload,
      createdAt: Date.now()
    });
    return args.payload;
  }
});

// --- Action pública --------------------------------------------------------

export const getGuide = action({
  args: { localDate: v.optional(v.string()), timezone: v.optional(v.string()) },
  handler: async (ctx, args): Promise<DailyGuidePayload> => {
    const identity = await requireIdentity(ctx as any);
    const stateForDate: any = await ctx.runQuery(internalApi.daily.getGuideState, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate: args.localDate ?? "" // se recomputa abajo con la tz real si hace falta
    });
    const timezone = args.timezone ?? stateForDate.birthData?.timezone ?? DEFAULT_TIMEZONE;
    const localDate = args.localDate ?? localDateForTimezone(timezone);

    const state: any = args.localDate
      ? stateForDate
      : await ctx.runQuery(internalApi.daily.getGuideState, { tokenIdentifier: identity.tokenIdentifier, localDate });

    if (state.existing && isCurrentDailyGuidePayload(state.existing.payload)) {
      return state.existing.payload;
    }

    const { lines: natal, tension } = natalBrief(state.natalChart?.payload);

    // Traer los tránsitos del día (mismo proveedor que transits.getToday).
    let transits: NormalizedAstroTransit[] = [];
    if (state.birthData) {
      const bd = state.birthData;
      const providerResult = await runAstrologyApiDailyTransits({
        input: {
          birthDate: bd.birthDate,
          birthTime: bd.birthTime,
          birthTimePrecision: bd.birthTimePrecision,
          birthPlaceLabel: bd.birthPlaceLabel,
          latitude: bd.latitude,
          longitude: bd.longitude,
          timezone: bd.timezone
        },
        localDate
      });
      if (providerResult.status === "success" && providerResult.normalized) {
        transits = selectRelevantTransits(providerResult.normalized.transits, 4);
      }
    }

    // La carta se sortea ANTES del LLM (es determinística, no depende de él) y se le pasa
    // en el prompt, para que los beats y la tesis del día hablen de la misma carta.
    const carta = drawCard({ userId: String(state.userId), localDate });

    const generated = await generateDaily({
      natal,
      tension,
      transits,
      localDate,
      name: identity.name ?? undefined,
      carta
    });
    const payload = composePayload({ generated, transits, carta });

    const stored: any = await ctx.runMutation(internalApi.daily.persistGuide, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate,
      payload
    });
    return (stored ?? payload) as DailyGuidePayload;
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
    const user = await requireExistingUser(ctx);

    const docs = await ctx.db
      .query("dailyGuides")
      .withIndex("by_user_date", (q: any) =>
        q.eq("userId", user._id).gte("localDate", args.from).lte("localDate", args.to)
      )
      .collect();

    return docs.map((doc: any) => ({
      localDate: doc.localDate as string,
      cartaId: (doc.payload?.carta?.id ?? null) as number | null,
      revealed: Boolean(doc.revealedAt)
    }));
  }
});
