/**
 * El borde que convierte "dónde está la persona" en propiedades del contrato.
 *
 * Es la implementación de CORE-183 sobre el contrato de CORE-187, y es PURA a
 * propósito: sin React, sin expo, sin react-native y sin el SDK de analítica.
 * Entra un `pathname` y un referrer crudos; sale un evento del contrato o una
 * razón para no emitirlo. Nada más cruza: ni la URL, ni la query, ni el
 * fragmento, ni el referrer, que se clasifican acá y se descartan en la misma
 * llamada.
 *
 * Que sea puro es lo que permite probar la decisión entera —qué se emite, con
 * qué propiedades y qué se descarta— sin navegador, sin red y sin montar la
 * app. El módulo que sí ve el navegador (`webTelemetry.tsx`) no toma ninguna
 * decisión: pregunta acá y captura, o registra por qué no.
 *
 * El contrato (`eventContract.ts`) NO se toca desde acá: se lee.
 */
import {
  COMMON_PROPERTIES,
  CONTRACT_VERSION,
  PAGEVIEW_PROPERTIES,
  isEventName,
  matchRoutePath,
  normalizeAcquisitionSource,
  requiredPropertiesFor,
  validateEvent,
  type AcquisitionSource,
  type Environment,
  type PageviewEventProperties,
  type ReferrerClass,
  type RoutePath,
  type Section,
  type Surface,
  type ValidationIssueCode
} from "@/analytics/eventContract";

/** El único evento que esta tarjeta emite. Los de producto son CORE-188. */
export const PAGEVIEW_EVENT = "$pageview";

/** Dónde vive una ruta dentro del producto: superficie y sección del contrato. */
export type RoutePlacement = {
  readonly surface: Surface;
  readonly section: Section;
};

/**
 * Cada plantilla del catálogo, con su lugar en el producto — o `null` cuando la
 * ruta no tiene un lugar que el contrato pueda expresar.
 *
 * Es un `Record<RoutePath, …>` y no una cadena de prefijos por una razón
 * concreta: el tipo lo vuelve TOTAL. Agregar una ruta al catálogo (que es un
 * cambio minor del contrato, sección 10 del documento) rompe el typecheck acá
 * hasta que alguien decida qué mide esa ruta. Con prefijos, una ruta nueva caería
 * en el default y se mediría mal en silencio, que es exactamente el modo de
 * falla que este contrato existe para evitar.
 *
 * El criterio no es la URL sino el contenido: para las rutas web que son alias o
 * atajo de otra pantalla, la sección es la de su destino canónico, tal como lo
 * declara el propio producto (`src/routes/v492/*.tsx` redirige cada `/reading/*`
 * a la sección que lo contiene en nativo).
 *
 * `null` es una decisión, no un olvido:
 *   · las herramientas internas (`/backoffice`, `/lab`, `/studio`) están dentro
 *     del producto autenticado pero fuera de las cinco secciones canónicas, y el
 *     validador rechaza `surface: app` sin sección canónica. No hay combinación
 *     honesta, así que no se emiten. Son nuestras, no de nadie que estemos
 *     midiendo.
 */
export const PLACEMENT_BY_ROUTE: Readonly<Record<RoutePath, RoutePlacement | null>> = {
  // --- Landing: lo público, sin sesión ---------------------------------------
  "/": { surface: "landing", section: "sin_seccion" },
  "/privacy": { surface: "landing", section: "sin_seccion" },
  "/support": { surface: "landing", section: "sin_seccion" },
  "/terminos": { surface: "landing", section: "sin_seccion" },
  // `/reading/plus` es una ruta legada que ya no muestra planes: redirige a la
  // portada (`app/reading/plus.tsx`). Lo que se ve es la landing.
  "/reading/plus": { surface: "landing", section: "sin_seccion" },

  // --- Onboarding: el alta, hasta que la carta queda disponible ---------------
  "/empezar": { surface: "onboarding", section: "sin_seccion" },
  "/onboarding": { surface: "onboarding", section: "sin_seccion" },
  // El contrato no tiene una superficie `auth`: crear la cuenta y entrar son el
  // primer tramo del alta, y así los cuenta el embudo (documento, sección 2).
  "/iniciar-sesion": { surface: "onboarding", section: "sin_seccion" },
  "/login": { surface: "onboarding", section: "sin_seccion" },
  "/crear-cuenta": { surface: "onboarding", section: "sin_seccion" },
  // Cuenta que existe y quedó incompleta: se completa el alta, no se navega el
  // producto (`EDIT_BIRTH_DATA_ROUTE`, `src/domain/appRoutes.ts`).
  "/editar-datos": { surface: "onboarding", section: "sin_seccion" },
  "/preview-alta": { surface: "onboarding", section: "sin_seccion" },
  // La ceremonia del día 1 es la última superficie del alta: entrega la carta.
  "/recepcion": { surface: "onboarding", section: "sin_seccion" },

  // --- Paywall y checkout: la oferta y el cobro ------------------------------
  "/paywall": { surface: "paywall", section: "sin_seccion" },
  "/checkout/success": { surface: "checkout", section: "sin_seccion" },

  // --- App · Hoy -------------------------------------------------------------
  "/home": { surface: "app", section: "hoy" },
  "/hoy": { surface: "app", section: "hoy" },
  "/hoy/arco": { surface: "app", section: "hoy" },
  "/hoy/cumpleluna": { surface: "app", section: "hoy" },
  "/hoy/luna": { surface: "app", section: "hoy" },
  "/diario": { surface: "app", section: "hoy" },
  "/reading/calendario": { surface: "app", section: "hoy" },
  "/reading/deep-dive": { surface: "app", section: "hoy" },
  "/reading/diario": { surface: "app", section: "hoy" },
  "/reading/long-read": { surface: "app", section: "hoy" },
  "/reading/luna": { surface: "app", section: "hoy" },
  "/reading/saved": { surface: "app", section: "hoy" },
  "/reading/topic": { surface: "app", section: "hoy" },
  "/reading/transito": { surface: "app", section: "hoy" },

  // --- App · Tránsitos -------------------------------------------------------
  "/transito": { surface: "app", section: "transitos" },
  "/transitos": { surface: "app", section: "transitos" },
  "/transitos/arco/:arcId": { surface: "app", section: "transitos" },
  "/transitos/capa/:layer": { surface: "app", section: "transitos" },
  "/transitos/momento": { surface: "app", section: "transitos" },
  "/reading/cuatro-ritmos": { surface: "app", section: "transitos" },
  "/reading/estacion-vital": { surface: "app", section: "transitos" },
  "/reading/tema-del-ano": { surface: "app", section: "transitos" },
  "/reading/transitos": { surface: "app", section: "transitos" },

  // --- App · Vínculos --------------------------------------------------------
  "/vinculo": { surface: "app", section: "vinculos" },
  "/vinculos": { surface: "app", section: "vinculos" },
  "/vinculos/conectar": { surface: "app", section: "vinculos" },
  "/vinculos/:profileId": { surface: "app", section: "vinculos" },
  "/vinculos/:profileId/comparacion": { surface: "app", section: "vinculos" },
  "/reading/vinculo-result": { surface: "app", section: "vinculos" },

  // --- App · Umbral ----------------------------------------------------------
  "/umbral": { surface: "app", section: "umbral" },
  "/vacio": { surface: "app", section: "umbral" },
  "/reading/void": { surface: "app", section: "umbral" },

  // --- App · Carta (el Perfil vive adentro: no es sección propia) -------------
  "/carta": { surface: "app", section: "carta" },
  "/carta-full": { surface: "app", section: "carta" },
  "/perfil": { surface: "app", section: "carta" },
  "/perfil/ajustes": { surface: "app", section: "carta" },
  "/perfil/carta": { surface: "app", section: "carta" },
  "/perfil/carta/completa": { surface: "app", section: "carta" },
  "/perfil/carta/mapa-elemental": { surface: "app", section: "carta" },
  "/perfil/carta/tipo-lunar": { surface: "app", section: "carta" },
  "/profile": { surface: "app", section: "carta" },
  "/personalidad": { surface: "app", section: "carta" },
  "/valores": { surface: "app", section: "carta" },
  "/reading/carta": { surface: "app", section: "carta" },
  "/reading/carta-completa": { surface: "app", section: "carta" },
  "/reading/personalidad": { surface: "app", section: "carta" },
  "/reading/rueda": { surface: "app", section: "carta" },
  "/reading/valores": { surface: "app", section: "carta" },

  // --- Sin lugar en el contrato: no se mide ----------------------------------
  "/backoffice": null,
  "/lab": null,
  "/studio": null
};

// --- Referrer: se clasifica acá y se descarta acá -----------------------------

/**
 * Marcas de buscador. Se compara contra el dominio registrable del referrer, no
 * contra el host entero, para que `www.google.com`, `google.com.ar` y
 * `news.google.com` cuenten lo mismo sin enumerar cada dominio de país.
 */
const SEARCH_ENGINE_BRANDS = [
  "google",
  "bing",
  "duckduckgo",
  "yahoo",
  "ecosia",
  "baidu",
  "yandex",
  "qwant",
  "startpage",
  "brave",
  "searx",
  "perplexity"
] as const;

/** Marcas de red social y mensajería. Mismo criterio que los buscadores. */
const SOCIAL_NETWORK_BRANDS = [
  "facebook",
  "instagram",
  "twitter",
  "tiktok",
  "linkedin",
  "reddit",
  "pinterest",
  "youtube",
  "threads",
  "snapchat",
  "discord",
  "whatsapp",
  "telegram",
  "tumblr",
  "twitch"
] as const;

/**
 * Hosts que no tienen una marca propia legible: acortadores cuya etiqueta no
 * dice nada (`t.co` y `t.me` comparten la etiqueta `t`) y `x.com`, cuya marca es
 * una sola letra. Se comparan enteros.
 */
const SOCIAL_NETWORK_HOSTS = [
  "x.com",
  "t.co",
  "t.me",
  "lnkd.in",
  "wa.me",
  "fb.me",
  "redd.it",
  "youtu.be"
] as const;

/** Sufijos de segundo nivel: `com.ar`, `co.uk`, `com.br`… */
const SECOND_LEVEL_SUFFIXES = ["com", "co", "org", "net", "gov", "edu", "ac", "or", "ne"];

/** Host de una URL, en minúsculas y sin `www.`, o `null` si no es una URL. */
function hostOf(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
  if (host.length === 0) return null;
  // El puerto no distingue un sitio de otro para esta clasificación.
  const sinPuerto = host.replace(/:\d+$/, "");
  return sinPuerto.startsWith("www.") ? sinPuerto.slice(4) : sinPuerto;
}

/**
 * Dominio registrable aproximado: la etiqueta de marca del host.
 *
 * Sin lista de sufijos públicos, con la regla que cubre los casos reales: si el
 * host termina en `<sufijo2>.<país de dos letras>`, la marca es la etiqueta
 * anterior; si no, es la anteúltima.
 */
function brandOf(host: string): string {
  const labels = host.split(".");
  if (labels.length < 2) return host;
  const ultimo = labels[labels.length - 1];
  const anteultimo = labels[labels.length - 2];
  if (labels.length >= 3 && ultimo.length === 2 && SECOND_LEVEL_SUFFIXES.includes(anteultimo)) {
    return labels[labels.length - 3];
  }
  return anteultimo;
}

/**
 * Referrer crudo -> clase del contrato. La URL entra y NO sale: lo único que
 * sobrevive a esta llamada es una de las siete etiquetas.
 *
 * `paid_campaign` no se devuelve nunca, y es una decisión: distinguir una visita
 * pagada de una orgánica exige leer los parámetros de campaña de la URL, y el
 * contrato prohíbe la query (documento, sección 8). Una campaña paga que llega
 * desde un buscador o una red social se cuenta como tal; el día que haya
 * inversión y haga falta separarla, la fuente será la plataforma de campaña, no
 * la barra de direcciones.
 */
export function classifyReferrer(input: {
  readonly referrer: string | null | undefined;
  readonly currentHost: string | null | undefined;
}): ReferrerClass {
  const referrer = typeof input.referrer === "string" ? input.referrer.trim() : "";
  if (referrer.length === 0) return "none";

  const host = hostOf(referrer);
  // Vino algo que no es una URL absoluta: no se adivina, se declara no
  // clasificable. `unclassified` existe justamente para no ensuciar `direct`.
  if (!host) return "unclassified";

  const actual = typeof input.currentHost === "string" ? input.currentHost.toLowerCase() : "";
  const actualLimpio = actual.replace(/:\d+$/, "").replace(/^www\./, "");
  if (actualLimpio.length > 0 && host === actualLimpio) return "internal";

  if ((SOCIAL_NETWORK_HOSTS as readonly string[]).includes(host)) return "social_network";

  const brand = brandOf(host);
  if ((SEARCH_ENGINE_BRANDS as readonly string[]).includes(brand)) return "search_engine";
  if ((SOCIAL_NETWORK_BRANDS as readonly string[]).includes(brand)) return "social_network";

  return "external_site";
}

/**
 * Fuente de adquisición de ESTE `$pageview`.
 *
 * `document.referrer` no cambia cuando la SPA cambia de ruta: es del documento,
 * no de la vista. Sin esta regla, una persona que llega desde un buscador y
 * recorre cinco pantallas se cuenta como cinco adquisiciones orgánicas. Sólo el
 * primer evento de la carga lee el referrer; los siguientes son navegación
 * interna, que el contrato mapea a `direct` (una navegación interna no es una
 * adquisición nueva).
 */
export function acquisitionSourceFor(input: {
  readonly referrer: string | null | undefined;
  readonly currentHost: string | null | undefined;
  readonly firstOfSession: boolean;
}): AcquisitionSource {
  const clase: ReferrerClass = input.firstOfSession ? classifyReferrer(input) : "internal";
  return normalizeAcquisitionSource(clase);
}

// --- La decisión del `$pageview` ---------------------------------------------

/** Por qué una navegación no produjo evento. Ninguna razón lleva datos adentro. */
export type PageviewSkipReason =
  /** La ruta no está en el catálogo del contrato: sin `path` no hay evento. */
  | "unknown_route"
  /** La ruta existe pero no tiene superficie y sección que el contrato admita. */
  | "unmeasured_route"
  /** El evento armado no pasó `validateEvent`. Nunca debería ocurrir. */
  | "invalid_event";

export type PageviewDecision =
  | { readonly emit: true; readonly properties: PageviewEventProperties }
  | {
      readonly emit: false;
      readonly reason: PageviewSkipReason;
      /** Códigos del validador, sin propiedades ni valores. */
      readonly issues: readonly ValidationIssueCode[];
    };

/**
 * ¿Esta navegación produce un `$pageview`, y con qué propiedades?
 *
 * Toda la regla del evento vive acá: se sanitiza la ruta contra el catálogo, se
 * clasifica el referrer, se arma el evento con las siete propiedades del
 * contrato —ninguna más— y se lo valida antes de devolverlo. Si no valida, no se
 * emite: el validador es la última palabra, incluso sobre este archivo.
 */
export function decidePageview(input: {
  readonly pathname: string | null | undefined;
  readonly referrer: string | null | undefined;
  readonly currentHost: string | null | undefined;
  readonly firstOfSession: boolean;
  readonly environment: Environment;
}): PageviewDecision {
  const path = matchRoutePath(input.pathname);
  if (!path) return { emit: false, reason: "unknown_route", issues: ["unsanitized_path"] };

  const placement = PLACEMENT_BY_ROUTE[path];
  if (!placement) return { emit: false, reason: "unmeasured_route", issues: [] };

  const properties: PageviewEventProperties = {
    environment: input.environment,
    platform: "web",
    surface: placement.surface,
    section: placement.section,
    contract_version: CONTRACT_VERSION,
    path,
    acquisition_source: acquisitionSourceFor(input)
  };

  const veredicto = validateEvent({ name: PAGEVIEW_EVENT, properties });
  if (!veredicto.valid) {
    return {
      emit: false,
      reason: "invalid_event",
      issues: veredicto.issues.map((issue) => issue.code)
    };
  }

  return { emit: true, properties };
}

/**
 * El aviso que se escribe cuando una navegación no se emite.
 *
 * Lleva la razón y los códigos del validador, y nada más: ni la ruta cruda, ni
 * el referrer, ni el valor de ninguna propiedad. Un log es un lugar donde los
 * datos se quedan, así que la regla de la allowlist también rige acá.
 */
export function pageviewWarning(decision: PageviewDecision): string | null {
  if (decision.emit) return null;
  const codigos = decision.issues.length > 0 ? ` (${decision.issues.join(", ")})` : "";
  return `[orbita] $pageview no emitido: ${decision.reason}${codigos}`;
}

// --- Lo que sale del dispositivo ----------------------------------------------

/**
 * Las siete propiedades del contrato para `$pageview`.
 *
 * El filtro de abajo ya no las lee de acá: desde CORE-188 la allowlist se
 * resuelve POR EVENTO contra el diccionario, porque `onboarding_step` es de
 * `onboarding_step_viewed` y de ningún otro. Esta constante queda como la
 * referencia legible de la visita, que es lo que las pruebas comparan.
 */
export const CONTRACT_PROPERTY_NAMES: readonly string[] = [
  ...COMMON_PROPERTIES,
  ...PAGEVIEW_PROPERTIES
];

/**
 * Las claves de transporte del SDK que el evento necesita para llegar y para
 * contarse: quién lo manda (`token`), a qué visitante anónimo pertenece
 * (`distinct_id`), de qué sesión del SDK viene y con qué versión de librería.
 *
 * Están enumeradas una por una porque son la ÚNICA excepción a "sólo las
 * propiedades del contrato". Ninguna lleva URL, referrer, campaña ni huella del
 * dispositivo: eso se cae en `retainedProperties`.
 */
export const TRANSPORT_PROPERTY_NAMES: readonly string[] = [
  "token",
  "distinct_id",
  "$session_id",
  "$window_id",
  "$lib",
  "$lib_version",
  "$insert_id",
  "$time",
  "$is_identified",
  "$process_person_profile"
];

/**
 * Filtro de salida: allowlist cerrada sobre lo que el SDK ya armó, POR EVENTO.
 *
 * El SDK agrega solo, en cada captura, `$current_url`, `$host`, `$pathname`,
 * `$referrer`, `$referring_domain`, los parámetros de campaña de la URL, el
 * `$raw_user_agent` y la huella de pantalla y viewport. Nada de eso se puede
 * apagar desde la configuración —se calcula antes de cualquier opción—, así que
 * se descarta acá, en el último punto antes de la red.
 *
 * Es allowlist y no denylist por el principio 3 del contrato: si una versión del
 * SDK agrega mañana una propiedad automática nueva, no sale. Una denylist habría
 * que actualizarla, y nadie se entera de que hace falta hasta que el dato ya
 * está publicado.
 *
 * Lo que permite cada evento sale del DICCIONARIO (`requiredPropertiesFor`) y no
 * de una lista escrita acá, y eso es lo que hace que `onboarding_step` viaje
 * sólo en `onboarding_step_viewed` y que `path` y `acquisition_source` viajen
 * sólo en `$pageview`. Una propiedad declarada para otro evento se cae igual que
 * una inventada: el contrato dice que las dos son exclusivas de su evento, y una
 * allowlist compartida las habría dejado pasar en los ocho.
 *
 * Un nombre que el diccionario no conoce no tiene propiedades declaradas, así
 * que no conserva ninguna. `before_send` ya lo descartó entero antes de llegar
 * acá; esto es el cinturón sobre el tirante.
 */
export function retainedProperties(
  properties: Readonly<Record<string, unknown>>,
  event: string
): Record<string, unknown> {
  const declaradas = isEventName(event) ? requiredPropertiesFor(event) : [];
  const permitidas = new Set<string>([...declaradas, ...TRANSPORT_PROPERTY_NAMES]);
  const salida: Record<string, unknown> = {};
  for (const [nombre, valor] of Object.entries(properties)) {
    if (permitidas.has(nombre)) salida[nombre] = valor;
  }
  return salida;
}
