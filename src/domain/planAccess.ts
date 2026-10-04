/**
 * La regla Free/Plus de la app nativa (CORE-1043): la misma de la web.
 *
 * | Sección        | Free                                   | Plus     |
 * |----------------|----------------------------------------|----------|
 * | Hoy            | abierto                                | abierto  |
 * | Tránsitos      | muro → `/paywall`                      | abierto  |
 * | Tu momento     | muro → `/paywall`                      | abierto  |
 * | Vínculos       | 1 persona, 3 contactos por comparación | sin tope |
 * | Carta          | rueda y tríada                         | abierto  |
 * | Carta completa | muro → `/paywall`                      | abierto  |
 * | El Umbral      | 3 preguntas por día                    | 5 por día |
 *
 * Acá vive esa tabla UNA sola vez, junto con los textos de cada muro y la única
 * salida que tienen. El corte REAL lo aplica el servidor —las funciones
 * `…WithAccess` no le mandan el dato a una cuenta Free—; esto existe para contar
 * la verdad en pantalla: que una sección cerrada se lea como "esto es Plus" y no
 * como "faltan datos" o "algo se rompió". Mostrar u ocultar acá no concede nada.
 *
 * Tres orígenes del plan, cada uno para lo suyo:
 *
 * - **El sobre del día** (`access` de `layers.getForDateWithAccess`) decide
 *   Tránsitos y Tu momento: llega en la MISMA respuesta que el dato, así que el
 *   muro y el contenido no pueden contradecirse.
 * - **La lista de personas** (`access` de `relationships.listWithAccess`) decide
 *   el cupo de Vínculos.
 * - **El entitlement remoto** (`useEntitlement()`) decide la carta completa,
 *   que no viaja en ninguno de los dos; si la carta ya llegó, manda su propio
 *   `access.isPro`.
 *
 * Módulo puro: no importa React, ni Convex, ni React Native.
 */

// ---------------------------------------------------------------------------
// El plan de la cuenta
// ---------------------------------------------------------------------------

/**
 * Qué plan tiene esta cuenta.
 *
 * `loading` no es "Free todavía": es "no sé", y se dibuja esperando. Afirmar
 * Free antes de tiempo le muestra un muro a quien paga —en cada arranque en
 * frío— y afirmar Plus le promete a un Free un contenido que el servidor le va
 * a negar en el mismo render.
 */
export type PlanAccess = "loading" | "free" | "plus";

export function planAccess(input: {
  /** `useEntitlement().remote`: la confirmación del backend, o `undefined`. */
  remote: { isPro: boolean } | null | undefined;
  /** `useEntitlement().resolved`: esa confirmación es del dueño vigente. */
  resolved: boolean;
}): PlanAccess {
  // Sin confirmación remota no hay nada que autorizar. `resolved` es lo único
  // que distingue "el backend contestó" de "todavía tengo el plan cacheado": el
  // snapshot local puede nombrar el plan en un chip, pero no abre ni cierra nada.
  if (!input.resolved) return "loading";
  // Defensa en profundidad: `resolved` implica un remoto presente, pero si
  // alguna vez dejara de implicarlo, la respuesta honesta sigue siendo esperar.
  if (input.remote === undefined) return "loading";
  // `null` es "el backend no reconoce plan": eso ES Free, no una espera.
  return input.remote?.isPro === true ? "plus" : "free";
}

// ---------------------------------------------------------------------------
// La tabla
// ---------------------------------------------------------------------------

export const PLAN_SECTIONS = [
  "hoy",
  "transitos",
  "momento",
  "vinculos",
  "carta",
  "cartaCompleta",
  "umbral"
] as const;

export type PlanSection = (typeof PLAN_SECTIONS)[number];

/**
 * Qué puede hacer la cuenta con una sección.
 *
 * - `open`: entra entera.
 * - `limited`: entra, con un tope (una persona y tres contactos en Vínculos;
 *   tres preguntas por día en El Umbral). El tope lo cuenta el servidor.
 * - `locked`: la pantalla entera es un muro con salida a `/paywall`.
 * - `loading`: todavía no se sabe; ni muro ni contenido.
 */
export type SectionAccess = "loading" | "open" | "limited" | "locked";

const FREE_RULE: Record<PlanSection, Exclude<SectionAccess, "loading">> = {
  hoy: "open",
  transitos: "locked",
  momento: "locked",
  vinculos: "limited",
  carta: "open",
  cartaCompleta: "locked",
  umbral: "limited"
};

/**
 * La tabla de arriba, como función.
 *
 * Las secciones que Free tiene ABIERTAS contestan `open` también mientras el
 * plan viaja: Hoy y la pestaña Carta no dependen del plan, así que no tienen
 * nada que esperar. Todas las demás esperan.
 */
export function sectionAccess(section: PlanSection, plan: PlanAccess): SectionAccess {
  if (plan === "plus") return "open";
  const free = FREE_RULE[section];
  if (free === "open") return "open";
  return plan === "loading" ? "loading" : free;
}

// ---------------------------------------------------------------------------
// Tránsitos y Tu momento: el acceso que viaja con el sobre del día
// ---------------------------------------------------------------------------

/** La forma de `access` en `layers.getForDateWithAccess`, sin importar Convex. */
export type LayerAccessLike = {
  isPro: boolean;
  hoy: "open";
  transitos: "open" | "locked";
  momento: "open" | "locked";
};

/** Las tres secciones que el sobre del día sabe abrir o cerrar. */
export type LayerSection = "hoy" | "transitos" | "momento";

/**
 * El acceso de una sección de capas, leído del `access` del sobre.
 *
 * Sin sobre —la lectura viaja, no hay sesión, no hay cuenta con datos— contesta
 * `loading`: NO es un muro. Esos casos ya tienen su propio estado en la pantalla
 * (cargando, error, invitado, vacío) y ninguno es un límite de plan. Hoy es la
 * excepción: está abierto para cualquier plan, así que no espera a nadie.
 *
 * Se decide por `access` y NUNCA por `data === null`: un sobre cerrado por plan
 * y uno al que le falta la hora de nacimiento llegan los dos sin dato.
 */
export function layerSectionAccess(
  access: LayerAccessLike | null | undefined,
  section: LayerSection
): Exclude<SectionAccess, "limited"> {
  if (section === "hoy") return "open";
  if (!access) return "loading";
  return access[section] === "locked" ? "locked" : "open";
}

// ---------------------------------------------------------------------------
// Carta completa
// ---------------------------------------------------------------------------

/**
 * El acceso de `/perfil/carta/completa`.
 *
 * Con la carta ya leída manda SU `access.isPro`: es el plan con el que el
 * servidor armó ese mismo payload —el que decidió no mandar casas ni aspectos—,
 * así que el muro y el dato no pueden discrepar. Sin carta todavía —no hay
 * snapshot canónico— decide el entitlement remoto, y mientras ése viaja se
 * espera: una cuenta Plus no ve el muro ni un instante.
 */
export function cartaCompletaAccess(input: {
  plan: PlanAccess;
  /** `chart.access.isPro` de `layers.getNatalChartBase`; `undefined` sin carta. */
  chartIsPro?: boolean;
}): Exclude<SectionAccess, "limited"> {
  if (input.chartIsPro === true) return "open";
  if (input.chartIsPro === false) return "locked";
  if (input.plan === "loading") return "loading";
  return input.plan === "plus" ? "open" : "locked";
}

// ---------------------------------------------------------------------------
// Vínculos: el cupo de personas y los contactos de la comparación
// ---------------------------------------------------------------------------

/** La forma de `access` en `relationships.listWithAccess`, sin importar Convex. */
export type PersonAccessLike = {
  isPro: boolean;
  limit: number | null;
  remaining: number | null;
  atLimit: boolean;
};

/** Qué hace "agregar una persona". */
export type RelationshipAddIntent = "esperar" | "formulario" | "limite";

/**
 * Adónde va "agregar una persona".
 *
 * El cupo lo decide el SERVIDOR (`atLimit`), no una cuenta hecha en el cliente:
 * una cuenta histórica puede tener varias personas guardadas con plan Free y las
 * conserva todas, así que "cuántas hay" y "puede crear otra" son dos hechos
 * distintos y sólo el segundo abre el formulario.
 *
 * Mientras la lista viaja el botón espera: ofrecer el formulario y rebotar al
 * guardar —o mostrarle el límite a alguien que todavía tenía cupo— es peor que
 * un instante sin botón.
 */
export function relationshipAddIntent(
  access: PersonAccessLike | null | undefined
): RelationshipAddIntent {
  if (!access) return "esperar";
  return access.atLimit ? "limite" : "formulario";
}

/**
 * El rechazo estable del backend cuando el cupo Free ya está tomado.
 *
 * El formulario puede quedar abierto con cupo y perderlo antes de guardar —otra
 * alta desde otro dispositivo, un plan que venció—, así que el servidor es la
 * última puerta y su respuesta se lee como lo que es: el mismo límite, no un
 * error de conexión.
 */
export const RELATIONSHIP_LIMIT_REACHED = "RELATIONSHIP_LIMIT_REACHED";

/**
 * ¿Este error es el cupo Free? El código viaja ADENTRO del mensaje —Convex
 * envuelve el error de la mutation—, así que se busca por inclusión.
 */
export function relationshipLimitReached(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const mensaje =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : "";
  return mensaje.includes(RELATIONSHIP_LIMIT_REACHED);
}

/** El límite de personas, con el número que publica el servidor. */
export function relationshipLimitLine(limit: number | null | undefined): string {
  const cupo = limit === 1 || limit === null || limit === undefined ? "una persona" : `${limit} personas`;
  return `Free guarda ${cupo} por cuenta. Para agregar a alguien más, activá Plus o editá los datos de la persona guardada.`;
}

/** Cuántos contactos de la comparación abre Plus, o `null` si no falta ninguno. */
export function hiddenContactsTitle(hiddenContacts: number): string | null {
  if (!Number.isFinite(hiddenContacts) || hiddenContacts <= 0) return null;
  const n = Math.floor(hiddenContacts);
  return n === 1 ? "Un contacto más, en Plus" : `${n} contactos más, en Plus`;
}

export const HIDDEN_CONTACTS_BODY =
  "Con Free ves los contactos principales. La lista completa se abre con Órbita Plus.";

// ---------------------------------------------------------------------------
// La salida única de cualquier muro
// ---------------------------------------------------------------------------

/**
 * La paywall nativa: la ÚNICA salida de cualquier superficie cerrada por plan.
 *
 * Es una constante y no un literal repetido porque el muro aparece en muchas
 * pantallas y todas tienen que llegar al mismo lugar: una ruta distinta en una
 * de ellas sería una oferta que no cobra.
 */
export const PLUS_PAYWALL_ROUTE = "/paywall";

/** El rótulo del botón, el mismo de la web. */
export const PLUS_CTA_LABEL = "VER ÓRBITA PLUS";

/** Qué pasa al tocarlo, para VoiceOver: el rótulo en mayúsculas no lo dice. */
export const PLUS_CTA_HINT = "Abre los planes de Órbita Plus";

/** El rótulo del muro: lo primero que se lee y lo que lo anuncia. */
export const PLUS_ONLY_LABEL = "SOLO CON ÓRBITA PLUS";

/** El contador del encabezado de una sección cerrada, como en la web. */
export const PLUS_REQUIRED_BADGE = "REQUIERE PLUS";

// ---------------------------------------------------------------------------
// El texto de cada muro (el de la web, una sola vez)
// ---------------------------------------------------------------------------

/** Lo que dice un muro. La pantalla sólo lo dibuja. */
export type PlanWallCopy = {
  /** Titular en serif. Puede traer un salto de línea. */
  title: string;
  body: string;
  /** Qué abre Plus acá, en viñetas. */
  bullets?: readonly string[];
  /** Nota gris al pie: lo que Free sí tiene. */
  note?: string;
  /** Etiqueta de VoiceOver del botón: dice QUÉ desbloquea. */
  ctaVoice: string;
};

/** Las frases que comparten varios muros. */
const CAPAS_LENTAS =
  "Las capas lentas —tu estación vital, el tema de tu año y tus cuatro ritmos— se calculan sobre tu carta y son parte de Órbita Plus.";
const CRUCE_DEL_DIA =
  "Con Plus, Órbita cruza el cielo de hoy con tu carta natal: qué contactos están activos, cuánto les falta para ser exactos y qué casa de tu carta tocan.";

/** La bajada de Tránsitos cerrado: qué es un tránsito, sin prometer nada. */
export const TRANSITOS_LOCKED_INTRO =
  "Un tránsito es un planeta de hoy tocando un punto de tu carta natal.";

/** La bajada de Tu momento cerrado. */
export const MOMENTO_LOCKED_INTRO = "Tu momento y sus tres capas se abren con Plus.";

export type PlanWallKey =
  | "transitos"
  | "arco"
  | "momento"
  | "estacion"
  | "ano"
  | "mandala"
  | "cartaCompleta";

export const PLAN_WALLS: Record<PlanWallKey, PlanWallCopy> = {
  transitos: {
    title: "El ranking de hoy se calcula con tu carta.",
    body: CRUCE_DEL_DIA,
    bullets: [
      "Los contactos principales de hoy, ordenados por su peso",
      "La barra de cercanía al punto exacto",
      "El detalle de arco de cada tránsito"
    ],
    note: "También en Free: Hoy, tu carta base y tres preguntas por día en El Umbral.",
    ctaVoice: "Ver Órbita Plus para abrir Tránsitos"
  },
  arco: {
    title: "El detalle de este tránsito\nse abre con Plus.",
    body: CRUCE_DEL_DIA,
    bullets: ["El detalle de arco de cada tránsito: inicio, punto exacto y cierre."],
    ctaVoice: "Ver Órbita Plus para abrir el detalle de este tránsito"
  },
  momento: {
    title: "Tu momento\nse abre con Plus.",
    body: CAPAS_LENTAS,
    ctaVoice: "Ver Órbita Plus para abrir Tu momento"
  },
  estacion: {
    title: "Tu estación vital\nse abre con Plus.",
    body: CAPAS_LENTAS,
    ctaVoice: "Ver Órbita Plus para abrir tu estación vital"
  },
  ano: {
    title: "El tema de tu año\nse abre con Plus.",
    body: CAPAS_LENTAS,
    ctaVoice: "Ver Órbita Plus para abrir el tema de tu año"
  },
  mandala: {
    title: "Tus cuatro ritmos\nse abren con Plus.",
    body: CAPAS_LENTAS,
    ctaVoice: "Ver Órbita Plus para abrir tus cuatro ritmos"
  },
  cartaCompleta: {
    title: "La carta completa\nse abre con Plus.",
    body: "Diez posiciones con lo que cada una permite afirmar, siete capítulos, aspectos con orbe y doce casas. Tu rueda y tu tríada siguen en Carta.",
    ctaVoice: "Ver Órbita Plus para abrir tu carta completa"
  }
};
