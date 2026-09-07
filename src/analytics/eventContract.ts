/**
 * Diccionario de eventos de Órbita — contrato v1.0.0.
 *
 * Es la ÚNICA fuente de eventos válidos. Antes de esto no había contrato de
 * medición: cualquiera podía inventar un nombre, una propiedad o un valor, y no
 * existía un lugar donde comprobar si un evento era legítimo. Un dato que nadie
 * puede verificar no se puede usar para decidir nada.
 *
 * El módulo es PURO a propósito: sin React, sin expo, sin react-native, sin el
 * SDK de analítica y sin Convex. Sólo tipos, constantes y funciones que reciben
 * datos y devuelven datos. Así el contrato se puede testear sin red, sin
 * entorno y sin montar la app — y así no se convierte en una capa de captura por
 * la puerta de atrás. La captura real (SDK, providers, configuración) queda
 * explícitamente fuera de este archivo.
 *
 * El documento legible por una persona es `docs/analytics/event-contract.md`;
 * este archivo es la versión ejecutable del mismo contrato.
 */

/** Versión del contrato. Viaja en cada evento como `contract_version`. */
export const CONTRACT_VERSION = "1.0.0";

// --- Literales cerrados ------------------------------------------------------

/**
 * Entorno de la captura.
 *
 * Lo resuelve el scope o la configuración de despliegue, NUNCA el hostname ni el
 * proyecto de destino. Inferirlo del hostname rompe con cada dominio nuevo, cada
 * preview y cada prueba local; inferirlo del proyecto invierte la relación (el
 * proyecto se elige por el entorno, no al revés).
 */
export const ENVIRONMENTS = ["production", "preview", "development"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** Plataforma de la superficie que emite. */
export const PLATFORMS = ["web", "ios", "android"] as const;
export type PlatformName = (typeof PLATFORMS)[number];

/**
 * Superficie de producto: QUÉ pedazo del producto emitió el evento.
 *
 * Cinco valores, uno por tramo con dueño y métrica propios: `landing` es lo
 * público sin sesión, `onboarding` el alta hasta la carta, `app` el producto
 * autenticado con su navegación canónica, `paywall` la oferta y `checkout` el
 * cobro. La conversión se lee justamente como el salto entre superficies, así
 * que partirlas más fino (una por pantalla) haría el embudo ilegible y obligaría
 * a un major cada vez que se agrega una pantalla.
 */
export const SURFACES = ["landing", "onboarding", "app", "paywall", "checkout"] as const;
export type Surface = (typeof SURFACES)[number];

/**
 * Sección canónica de la navegación (CORE-113), más la ausencia explícita.
 *
 * Las cinco secciones son las de la app autenticada; el Perfil vive dentro de
 * `carta` y no es una sección propia. `sin_seccion` es el valor obligatorio para
 * todo lo que pasa fuera de esa navegación (landing, onboarding, paywall,
 * checkout): la propiedad es obligatoria en todo evento, así que la ausencia
 * también tiene que ser un valor del enum y no un vacío, un null ni texto libre.
 */
export const SECTIONS = ["hoy", "transitos", "vinculos", "umbral", "carta", "sin_seccion"] as const;
export type Section = (typeof SECTIONS)[number];

/** Las cinco secciones reales de la navegación: `sin_seccion` no es una sección. */
export const CANONICAL_SECTIONS = ["hoy", "transitos", "vinculos", "umbral", "carta"] as const;
export type CanonicalSection = (typeof CANONICAL_SECTIONS)[number];

/**
 * Origen de adquisición, normalizado.
 *
 * Seis valores, elegidos para poder contestar "de dónde vino esta persona" sin
 * guardar NADA de la URL de origen: `direct` (sin referrer), `organic_search`,
 * `social`, `referral` (otro sitio), `paid` (campaña pagada) y `unknown` para
 * todo lo que no se puede clasificar con certeza. `unknown` es parte del enum a
 * propósito: sin él, lo no clasificable se cuela como `direct` y la métrica de
 * adquisición miente en silencio.
 */
export const ACQUISITION_SOURCES = [
  "direct",
  "organic_search",
  "social",
  "referral",
  "paid",
  "unknown"
] as const;
export type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

// --- La lista cerrada de eventos --------------------------------------------

/**
 * Los cinco eventos del contrato v1.0.0. Nada fuera de esta lista es un evento
 * válido de Órbita.
 */
export const EVENT_NAMES = [
  "$pageview",
  "onboarding_completed",
  "paywall_viewed",
  "checkout_started",
  "purchase_completed"
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/**
 * Eventos históricos que NO pertenecen al diccionario v1.
 *
 * `page_view` es data vieja: se conserva para consultar el pasado y nada más. No
 * se migra, no se borra, no se reetiqueta, no hay doble emisión y no hay
 * traducción intermedia entre él y `$pageview`. Reetiquetarlo mezclaría dos
 * definiciones distintas de "visita" en la misma serie; emitir los dos contaría
 * cada visita dos veces.
 */
export const LEGACY_EVENT_NAMES = ["page_view"] as const;
export type LegacyEventName = (typeof LEGACY_EVENT_NAMES)[number];

/** Propiedades comunes obligatorias en TODO evento del contrato. */
export const COMMON_PROPERTIES = [
  "environment",
  "platform",
  "surface",
  "section",
  "contract_version"
] as const;
export type CommonProperty = (typeof COMMON_PROPERTIES)[number];

/** Propiedades que sólo exige `$pageview`. */
export const PAGEVIEW_PROPERTIES = ["path", "acquisition_source"] as const;
export type PageviewProperty = (typeof PAGEVIEW_PROPERTIES)[number];

export type EventProperty = CommonProperty | PageviewProperty;

export type EventDefinition = {
  readonly name: EventName;
  /** Para qué existe: la pregunta de producto que contesta. */
  readonly purpose: string;
  /** El hecho exacto que lo dispara. */
  readonly trigger: string;
  /** El caso vecino que NO lo dispara. Sin esto, el evento se estira solo. */
  readonly notTrigger: string;
  /** Propiedades obligatorias. En v1.0.0 no hay propiedades opcionales. */
  readonly requiredProperties: readonly EventProperty[];
};

export const EVENT_DEFINITIONS: Readonly<Record<EventName, EventDefinition>> = {
  $pageview: {
    name: "$pageview",
    purpose: "Visitas: retención sobre identidad estable y adquisición por fuente.",
    trigger:
      "Una vista queda montada con su ruta definitiva, tanto en la carga inicial como en cada cambio de ruta de la SPA.",
    notTrigger:
      "Un re-render, un cambio de query o de fragmento sin cambio de ruta, una redirección intermedia o un estado de carga previo a la ruta definitiva.",
    requiredProperties: [...COMMON_PROPERTIES, ...PAGEVIEW_PROPERTIES]
  },
  onboarding_completed: {
    name: "onboarding_completed",
    purpose: "Activación: la persona llegó a tener producto.",
    trigger: "El alta termina y la carta queda disponible por primera vez para esa cuenta.",
    notTrigger:
      "Empezar el alta, avanzar un paso, cargar los datos natales sin confirmarlos, o volver a entrar a una cuenta que ya la había completado.",
    requiredProperties: [...COMMON_PROPERTIES]
  },
  paywall_viewed: {
    name: "paywall_viewed",
    purpose: "Conversión, paso 1: la oferta se vio de verdad.",
    trigger: "La paywall queda visible con su oferta real ya cargada.",
    notTrigger:
      "Montar la paywall en estado de carga o de error, un bloque bloqueado que sólo invita a la oferta, o un re-render de la misma impresión.",
    requiredProperties: [...COMMON_PROPERTIES]
  },
  checkout_started: {
    name: "checkout_started",
    purpose: "Conversión, paso 2: intención declarada de pagar.",
    trigger: "La persona confirma avanzar al cobro y se abre el checkout.",
    notTrigger:
      "Elegir un plan sin confirmar, abrir la paywall, o un reintento automático del mismo intento ya contado.",
    requiredProperties: [...COMMON_PROPERTIES]
  },
  purchase_completed: {
    name: "purchase_completed",
    purpose: "Conversión, paso 3: el cobro se confirmó.",
    trigger: "El cobro vuelve confirmado y el acceso queda otorgado.",
    notTrigger:
      "Un cobro pendiente, en prueba gratuita sin cargo, fallido o reembolsado; una renovación automática posterior; o volver a abrir la pantalla de compra exitosa.",
    requiredProperties: [...COMMON_PROPERTIES]
  }
};

/** Propiedades obligatorias de un evento del diccionario. */
export function requiredPropertiesFor(name: EventName): readonly EventProperty[] {
  return EVENT_DEFINITIONS[name].requiredProperties;
}

// --- Forma tipada de un evento válido ---------------------------------------

export type CommonEventProperties = {
  readonly environment: Environment;
  readonly platform: PlatformName;
  readonly surface: Surface;
  readonly section: Section;
  readonly contract_version: typeof CONTRACT_VERSION;
};

export type PageviewEventProperties = CommonEventProperties & {
  /** Una plantilla del catálogo (`/vinculos/:profileId`), nunca la URL real. */
  readonly path: RoutePath;
  readonly acquisition_source: AcquisitionSource;
};

export type OrbitaEvent =
  | { readonly name: "$pageview"; readonly properties: PageviewEventProperties }
  | {
      readonly name: Exclude<EventName, "$pageview">;
      readonly properties: CommonEventProperties;
    };

/** Lo que se le puede pasar al validador: cualquier cosa que diga ser un evento. */
export type EventInput = {
  readonly name: string;
  readonly properties: Readonly<Record<string, unknown>>;
};

// --- Utilidades de pertenencia ----------------------------------------------

function isMember<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export const isEventName = (value: unknown): value is EventName => isMember(EVENT_NAMES, value);
export const isLegacyEventName = (value: unknown): value is LegacyEventName =>
  isMember(LEGACY_EVENT_NAMES, value);
export const isEnvironment = (value: unknown): value is Environment => isMember(ENVIRONMENTS, value);
export const isPlatformName = (value: unknown): value is PlatformName => isMember(PLATFORMS, value);
export const isSurface = (value: unknown): value is Surface => isMember(SURFACES, value);
export const isSection = (value: unknown): value is Section => isMember(SECTIONS, value);
export const isAcquisitionSource = (value: unknown): value is AcquisitionSource =>
  isMember(ACQUISITION_SOURCES, value);

/**
 * El entorno sale del scope de despliegue y de ningún otro lado.
 *
 * Devuelve `null` para cualquier cosa que no sea uno de los tres literales: un
 * hostname, un nombre de proyecto o una rama entran por acá y NO salen
 * convertidos en entorno.
 */
export function normalizeEnvironment(value: unknown): Environment | null {
  return isEnvironment(value) ? value : null;
}

/**
 * ¿Este payload dice pertenecer al contrato que este módulo implementa?
 *
 * Se acepta la versión exacta y nada más. Una minor futura (`1.1.0`) puede traer
 * eventos o propiedades que este archivo no conoce: aceptarla sería afirmar algo
 * que no se puede verificar. Un emisor viejo tampoco pasa: el contrato se lee
 * junto con el código que lo implementa.
 */
export function isSupportedContractVersion(value: unknown): boolean {
  return value === CONTRACT_VERSION;
}

// --- Adquisición sin URL -----------------------------------------------------

/**
 * Clasificación del referrer, hecha ANTES de llamar acá y descartada enseguida.
 *
 * La entrada de la normalización es una clase, no una URL: el referrer crudo no
 * entra a este módulo, no se guarda y no viaja en ninguna propiedad. Quien
 * clasifica (el borde que sí ve la URL) se queda con la etiqueta y tira el
 * resto.
 */
export const REFERRER_CLASSES = [
  "none",
  "internal",
  "search_engine",
  "social_network",
  "external_site",
  "paid_campaign",
  "unclassified"
] as const;
export type ReferrerClass = (typeof REFERRER_CLASSES)[number];

const ACQUISITION_BY_REFERRER: Readonly<Record<ReferrerClass, AcquisitionSource>> = {
  none: "direct",
  // Una navegación interna no es una adquisición nueva: la fuente es la de la
  // visita que ya trajo a la persona, y este evento no puede inventar otra.
  internal: "direct",
  search_engine: "organic_search",
  social_network: "social",
  external_site: "referral",
  paid_campaign: "paid",
  unclassified: "unknown"
};

/**
 * Clase de referrer -> fuente de adquisición. Total y sin sorpresas: lo que no
 * es una clase conocida cae en `unknown`.
 *
 * Ese default es la defensa real. Si alguien le pasa la URL cruda del referrer
 * en vez de la clase, la respuesta es `unknown` y la URL no sobrevive a la
 * llamada; nunca se convierte en un valor guardado.
 */
export function normalizeAcquisitionSource(referrerClass: unknown): AcquisitionSource {
  return isMember(REFERRER_CLASSES, referrerClass)
    ? ACQUISITION_BY_REFERRER[referrerClass]
    : "unknown";
}

// --- Rutas sanitizadas -------------------------------------------------------

/**
 * Catálogo cerrado de rutas: las plantillas que el router del producto expone.
 *
 * Es una LISTA, no una forma, y esa es la corrección central de esta revisión.
 * Validar `path` por forma no alcanza: `/perfil/nombrepersona`,
 * `/ciudad/lugarnatal` y `/reading/identificadordinamico` son minúsculas con
 * guiones, así que pasaban como "sanitizadas" mientras llevaban adentro el
 * nombre o el lugar de nacimiento de alguien. Ninguna regla de texto distingue
 * un slug legítimo de un nombre propio — son la misma cadena. La única
 * diferencia verificable es si la ruta EXISTE en el producto.
 *
 * Origen confiable: el árbol de rutas del router (`app/**`). El catálogo se
 * mantiene a mano acá, y `test/analyticsEventContract.test.ts` lo deriva del
 * árbol real y falla diciendo exactamente qué plantilla sobra o falta. Sí: una
 * ruta nueva es un cambio de contrato (minor, sección 10 del documento). Ése es
 * el precio de que `path` no pueda transportar texto de nadie, y el test lo
 * cobra en un renglón.
 *
 * Los grupos del router (`(tabs)`) no existen en la URL pública y tampoco acá.
 * Un segmento dinámico viaja siempre como plantilla (`:profileId`), nunca con su
 * valor: el id de un vínculo es el de OTRA persona.
 */
export const ROUTE_TEMPLATES = [
  "/",
  "/backoffice",
  "/carta",
  "/carta-full",
  "/checkout/success",
  "/crear-cuenta",
  "/diario",
  "/editar-datos",
  "/empezar",
  "/home",
  "/hoy",
  "/hoy/arco",
  "/hoy/cumpleluna",
  "/hoy/luna",
  "/iniciar-sesion",
  "/lab",
  "/login",
  "/onboarding",
  "/paywall",
  "/perfil",
  "/perfil/ajustes",
  "/perfil/carta",
  "/perfil/carta/completa",
  "/perfil/carta/mapa-elemental",
  "/perfil/carta/tipo-lunar",
  "/personalidad",
  "/preview-alta",
  "/privacy",
  "/profile",
  "/reading/calendario",
  "/reading/carta",
  "/reading/carta-completa",
  "/reading/cuatro-ritmos",
  "/reading/deep-dive",
  "/reading/diario",
  "/reading/estacion-vital",
  "/reading/long-read",
  "/reading/luna",
  "/reading/personalidad",
  "/reading/plus",
  "/reading/rueda",
  "/reading/saved",
  "/reading/tema-del-ano",
  "/reading/topic",
  "/reading/transito",
  "/reading/transitos",
  "/reading/valores",
  "/reading/vinculo-result",
  "/reading/void",
  "/recepcion",
  "/studio",
  "/support",
  "/terminos",
  "/transito",
  "/transitos",
  "/transitos/arco/:arcId",
  "/transitos/capa/:layer",
  "/transitos/momento",
  "/umbral",
  "/vacio",
  "/valores",
  "/vinculo",
  "/vinculos",
  "/vinculos/:profileId",
  "/vinculos/:profileId/comparacion",
  "/vinculos/conectar"
] as const;

/** Una ruta del catálogo. Es el único valor admisible para `path`. */
export type RoutePath = (typeof ROUTE_TEMPLATES)[number];

/**
 * `path` sanitizada: una plantilla del catálogo, exactamente.
 *
 * Sin query, sin fragmento, sin barra final, sin URL absoluta y sin segmentos
 * dinámicos: no porque se busquen esas formas una por una, sino porque nada de
 * eso está en el catálogo. Lo desconocido se rechaza por defecto.
 */
export function isSanitizedPath(value: unknown): value is RoutePath {
  return isMember(ROUTE_TEMPLATES, value);
}

/**
 * Ruta real -> plantilla del catálogo, o `null`.
 *
 * Es la sanitización del borde, hecha una sola vez y acá, para que ninguna
 * pantalla tenga que reimplementarla: recibe un `pathname` (que por definición
 * no trae query ni fragmento) y devuelve SIEMPRE un elemento de
 * `ROUTE_TEMPLATES` o nada. El valor del segmento dinámico no sobrevive a la
 * llamada — entra `/vinculos/nombre-de-alguien` y sale `/vinculos/:profileId`.
 *
 * Una ruta que no está en el catálogo devuelve `null`, y sin `path` no hay
 * `$pageview`: es preferible perder una visita a publicar un dato de alguien.
 */
export function matchRoutePath(value: unknown): RoutePath | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.includes("//")) return null;
  if (/[?#]/.test(value) || /\s/.test(value)) return null;

  // Una barra final es la misma ruta; el catálogo la escribe sin ella.
  const path = value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
  const segments = path === "/" ? [] : path.slice(1).split("/");
  if (segments.some((segment) => segment.length === 0)) return null;

  const matches = ROUTE_TEMPLATES.filter((template) => {
    const parts = template === "/" ? [] : template.slice(1).split("/");
    if (parts.length !== segments.length) return false;
    return parts.every((part, i) => part.startsWith(":") || part === segments[i]);
  });
  if (matches.length === 0) return null;

  // Precedencia del router: ante dos plantillas del mismo largo, gana la que
  // tiene el segmento literal más a la izquierda (`/vinculos/conectar` no es un
  // `:profileId` que se llama "conectar").
  return matches.reduce((mejor, candidata) => {
    const a = mejor.slice(1).split("/");
    const b = candidata.slice(1).split("/");
    for (let i = 0; i < a.length; i++) {
      const dinamicaA = a[i].startsWith(":");
      const dinamicaB = b[i].startsWith(":");
      if (dinamicaA !== dinamicaB) return dinamicaA ? candidata : mejor;
    }
    return mejor;
  });
}

// --- PII ---------------------------------------------------------------------

/**
 * Nombres de propiedad prohibidos de forma explícita.
 *
 * La allowlist por sí sola ya rechaza cualquier propiedad no declarada; esta
 * lista existe para que el rechazo diga POR QUÉ y para que el intento quede
 * nombrado. Incluye datos personales, contenido natal y las tres cosas que la
 * web arrastra sin pensar: query, fragmento y referrer crudo.
 */
export const FORBIDDEN_PROPERTY_NAMES = [
  "email",
  "mail",
  "correo",
  "name",
  "first_name",
  "last_name",
  "full_name",
  "nombre",
  "apellido",
  "username",
  "birth_date",
  "birthdate",
  "birthday",
  "date_of_birth",
  "dob",
  "fecha_nacimiento",
  "birth_time",
  "hora_nacimiento",
  "birth_place",
  "lugar_nacimiento",
  "city",
  "ciudad",
  "country",
  "latitude",
  "longitude",
  "lat",
  "lon",
  "lng",
  "phone",
  "telefono",
  "address",
  "direccion",
  "ip",
  "ip_address",
  "sun_sign",
  "moon_sign",
  "rising_sign",
  "ascendant",
  "signo",
  "natal_chart",
  "chart",
  "carta",
  "url",
  "full_url",
  "href",
  "referrer",
  "referer",
  "query",
  "query_string",
  "search",
  "fragment",
  "hash",
  "note",
  "notes",
  "comment",
  "question",
  "free_text",
  "texto"
] as const;

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/;

/**
 * ¿El VALOR trae PII, aunque la propiedad se llame de forma inocente?
 *
 * Cubre los dos casos que se cuelan solos: un email en cualquier lado y una
 * fecha completa (la fecha de nacimiento es el dato natal más identificatorio
 * que tiene Órbita). No pretende ser un detector universal: la garantía fuerte
 * es la allowlist cerrada, esto es el cinturón.
 */
export function valueLooksLikePii(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return EMAIL.test(value) || ISO_DATE.test(value);
}

// --- Validación --------------------------------------------------------------

export type ValidationIssueCode =
  | "unknown_event"
  | "legacy_event"
  | "unsupported_contract_version"
  | "missing_property"
  | "invalid_enum"
  | "property_not_allowed"
  | "pii_property"
  | "unsanitized_path"
  | "surface_section_mismatch";

export type ValidationIssue = {
  readonly code: ValidationIssueCode;
  readonly property?: string;
  readonly message: string;
};

export type ValidationResult = {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
};

const ENUM_VALUES: Readonly<Record<string, readonly string[]>> = {
  environment: ENVIRONMENTS,
  platform: PLATFORMS,
  surface: SURFACES,
  section: SECTIONS,
  acquisition_source: ACQUISITION_SOURCES
};

/**
 * ¿Este evento pertenece al contrato v1.0.0?
 *
 * Devuelve TODOS los problemas encontrados, no el primero: quien emite mal
 * suele emitir mal varias cosas a la vez, y un rechazo que se explica entero se
 * arregla de una sola pasada.
 *
 * Un nombre desconocido corta el resto del análisis: sin definición no hay
 * propiedades obligatorias que exigir, y listar veinte faltantes taparía el
 * único problema real, que es el nombre.
 */
export function validateEvent(input: EventInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  const properties: Readonly<Record<string, unknown>> = input.properties ?? {};

  if (!isEventName(input.name)) {
    issues.push(
      isLegacyEventName(input.name)
        ? {
            code: "legacy_event",
            message:
              `${input.name} es legado histórico y queda fuera del diccionario v${CONTRACT_VERSION}: ` +
              "se consulta, no se emite. La navegación se mide con $pageview."
          }
        : {
            code: "unknown_event",
            message: `${String(input.name)} no está en el diccionario v${CONTRACT_VERSION}.`
          }
    );
    return { valid: false, issues };
  }

  const required = requiredPropertiesFor(input.name);
  const allowed = new Set<string>(required);

  // 1. Versión del contrato: si el payload no habla esta versión, lo demás no
  //    se puede juzgar con estas reglas.
  if (!("contract_version" in properties)) {
    issues.push({
      code: "missing_property",
      property: "contract_version",
      message: "falta contract_version."
    });
  } else if (!isSupportedContractVersion(properties.contract_version)) {
    issues.push({
      code: "unsupported_contract_version",
      property: "contract_version",
      message: `contract_version ${String(properties.contract_version)} no es v${CONTRACT_VERSION}.`
    });
  }

  // 2. Obligatorias presentes.
  for (const property of required) {
    if (property === "contract_version") continue;
    if (!(property in properties)) {
      issues.push({ code: "missing_property", property, message: `falta ${property}.` });
    }
  }

  // 3. Enums cerrados.
  for (const [property, values] of Object.entries(ENUM_VALUES)) {
    if (!allowed.has(property) || !(property in properties)) continue;
    if (!isMember(values, properties[property])) {
      issues.push({
        code: "invalid_enum",
        property,
        message: `${property}: ${String(properties[property])} no está en [${values.join(", ")}].`
      });
    }
  }

  // 4. Superficie y sección tienen que contarse la misma historia. Las cinco
  //    secciones canónicas existen dentro del producto autenticado; fuera de él
  //    la respuesta honesta es sin_seccion.
  const { surface, section } = properties;
  if (isSurface(surface) && isSection(section)) {
    const canonical = isMember(CANONICAL_SECTIONS, section);
    if (surface === "app" && !canonical) {
      issues.push({
        code: "surface_section_mismatch",
        property: "section",
        message: "surface app exige una de las cinco secciones canónicas."
      });
    }
    if (surface !== "app" && canonical) {
      issues.push({
        code: "surface_section_mismatch",
        property: "section",
        message: `surface ${surface} vive fuera de la navegación canónica: section debe ser sin_seccion.`
      });
    }
  }

  // 5. `path` sanitizada.
  if (allowed.has("path") && "path" in properties && !isSanitizedPath(properties.path)) {
    issues.push({
      code: "unsanitized_path",
      property: "path",
      message:
        `path ${String(properties.path)} no está en el catálogo de rutas del contrato: ` +
        "sólo se acepta una plantilla declarada, con sus segmentos dinámicos sin resolver " +
        "(por ejemplo /vinculos/:profileId)."
    });
  }

  // 6. Allowlist y PII. Toda propiedad que no esté declarada se rechaza: es lo
  //    que hace que "sin texto libre" sea estructural y no una promesa.
  for (const [property, value] of Object.entries(properties)) {
    const forbidden = isMember(FORBIDDEN_PROPERTY_NAMES, property);
    if (forbidden || valueLooksLikePii(value)) {
      issues.push({
        code: "pii_property",
        property,
        message: forbidden
          ? `${property} está prohibida por el contrato: no sale del dispositivo.`
          : `${property} trae un valor con forma de dato personal.`
      });
    }
    if (!allowed.has(property) && !forbidden) {
      issues.push({
        code: "property_not_allowed",
        property,
        message: `${property} no está declarada para ${input.name}: la allowlist es cerrada.`
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

/** Atajo booleano de `validateEvent`. */
export function isValidEvent(input: EventInput): boolean {
  return validateEvent(input).valid;
}

// --- Identidad ---------------------------------------------------------------

/**
 * Hechos que OBLIGAN a resetear el contexto antes de la captura siguiente.
 *
 * Sin reset, el distinct ID de una persona sigue pegado a los eventos de la
 * siguiente: dos cuentas quedan fusionadas en el mismo perfil y no hay forma
 * limpia de deshacerlo. El retiro de consentimiento está acá por la misma razón
 * que en el bloque de privacidad: dejar de capturar sin resetear conserva el
 * vínculo que la persona acaba de retirar.
 */
export const RESET_TRIGGERS = [
  "logout",
  "account_switch",
  "account_deletion",
  "consent_withdrawn"
] as const;
export type ResetTrigger = (typeof RESET_TRIGGERS)[number];

export function requiresIdentityReset(event: unknown): boolean {
  return isMember(RESET_TRIGGERS, event);
}

/**
 * Los dos emisores de identidad interna que este contrato reconoce.
 *
 * `identify` manda un identificador a un sistema de analítica y ahí se queda,
 * así que la pregunta no es "¿este texto parece PII?" sino "¿quién emitió esto y
 * con qué forma?". Lo primero no se puede contestar mirando una cadena:
 * `NombreApellido` y `LugarNatal` son letras y no hay heurística de texto que los
 * distinga de un slug interno — la v1.0.0 los aceptaba justamente por eso.
 *
 * - `account` — la cuenta, tal como la emite el proveedor de identidad (Clerk).
 *   Es el `clerkUserId` que el producto ya usa como clave estable de persona.
 * - `installation` — la instalación, un UUID v4 que la app sortea una sola vez y
 *   guarda local (`docs/handoff-claude-product-events.md`). No identifica a
 *   nadie fuera de nuestra base y no se deriva de ningún dato del dispositivo.
 *
 * Sumar un emisor es un cambio minor y exige declarar su formato acá.
 */
export const IDENTITY_SOURCES = ["account", "installation"] as const;
export type IdentitySource = (typeof IDENTITY_SOURCES)[number];

/**
 * Un identificador con su origen DECLARADO.
 *
 * El origen no se adivina: lo declara quien llama, que es el único que lo sabe.
 * Esa declaración es la frontera, y es lo que hace verificable al formato: sin
 * ella, `user_...` y un nombre propio son dos cadenas y nada más.
 */
export type InternalIdentifier = {
  readonly source: IdentitySource;
  readonly value: string;
};

/**
 * El formato exacto de cada emisor. Estrecho a propósito: si un día no encaja,
 * el contrato se cierra (no hay `identify`) en vez de dejar pasar cualquier cosa.
 */
const IDENTIFIER_FORMATS: Readonly<Record<IdentitySource, RegExp>> = {
  // Clerk emite `user_` + base62 (27 caracteres en la práctica).
  account: /^user_[A-Za-z0-9]{24,32}$/,
  // UUID v4 canónico en minúsculas, con su nibble de versión y su variante.
  installation: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
};

/**
 * ¿Esto sirve como identificador para `identify`?
 *
 * Dos condiciones, las dos verificables: el origen está en el catálogo cerrado y
 * el valor tiene exactamente la forma que ese emisor produce. Nada de escanear
 * el texto buscando PII — un dato personal no se reconoce, se descarta por no
 * venir de donde tiene que venir.
 *
 * Lo que el contrato NO puede verificar, y por eso está escrito: que el valor
 * declarado como `account` haya salido de verdad del proveedor de identidad. Eso
 * es una obligación de quien llama, y el documento la nombra como tal.
 */
export function isStableInternalIdentifier(value: unknown): value is InternalIdentifier {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { readonly source?: unknown; readonly value?: unknown };
  if (!isMember(IDENTITY_SOURCES, candidate.source)) return false;
  if (typeof candidate.value !== "string") return false;
  return IDENTIFIER_FORMATS[candidate.source].test(candidate.value);
}

/**
 * `alias` sólo para unir DOS emisores distintos sobre la misma persona: la
 * instalación anónima de ayer y la cuenta de hoy. Es el único vínculo que falta,
 * porque el distinct ID anónimo del SDK ya viaja desde la primera visita y
 * `identify` lo ata solo.
 *
 * Dos identificadores del MISMO emisor son dos sujetos distintos por definición
 * —Clerk emite una cuenta por persona, la app un UUID por instalación—, así que
 * aliasarlos no vincula: fusiona dos perfiles en uno y no hay forma limpia de
 * deshacerlo. Ese caso se rechaza acá y no depende de que nadie se acuerde.
 */
export function canAlias(input: {
  readonly current: unknown;
  readonly incoming: unknown;
}): boolean {
  const { current, incoming } = input;
  if (!isStableInternalIdentifier(current) || !isStableInternalIdentifier(incoming)) return false;
  return current.source !== incoming.source && current.value !== incoming.value;
}

// --- Consentimiento ----------------------------------------------------------

export const CONSENT_STATES = ["granted", "denied", "withdrawn", "unknown"] as const;
export type ConsentState = (typeof CONSENT_STATES)[number];

/**
 * No hay captura antes del consentimiento aplicable. `unknown` es un no: mientras
 * no haya respuesta, no se emite. Todo lo que no es `granted` frena la captura.
 */
export function canCapture(consent: unknown): boolean {
  return consent === "granted";
}
