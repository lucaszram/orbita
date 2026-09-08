/**
 * Los siete eventos de producto del contrato, decididos acá (CORE-188).
 *
 * CORE-183 dejó la web emitiendo `$pageview`: se sabe qué rutas se abren y nada
 * más. Entre la primera pantalla del alta y el cobro no había un solo dato, así
 * que "dónde se cae la gente" era una pregunta sin respuesta posible. Este
 * módulo es el borde que convierte los hechos del producto —un paso del alta
 * que se ve, una cuenta que se crea, una oferta que se muestra, un cobro que
 * vuelve confirmado— en los siete eventos que el contrato v1.1.0 declara.
 *
 * Es PURO, igual que `routeClassification.ts` y por la misma razón: sin React,
 * sin expo, sin react-native y sin el SDK. Entra un hecho, sale un evento del
 * contrato o una razón para no emitirlo. Así la decisión entera —qué se emite,
 * con qué propiedades, cuántas veces— se prueba sin navegador, sin red y sin
 * montar la app, y así el módulo no se convierte en una segunda capa de captura.
 * Lo que ata esto al navegador entra por `ProductEventPort`, que
 * `productTelemetry.ts` completa.
 *
 * El contrato (`eventContract.ts`) NO se toca desde acá: se lee. `validateEvent`
 * es la última palabra, también sobre este archivo: lo que no valida no sale.
 */
import {
  CONTRACT_VERSION,
  EVENT_NAMES,
  validateEvent,
  type CommonEventProperties,
  type Environment,
  type EventName,
  type OnboardingStep,
  type OnboardingStepViewedEventProperties,
  type Section,
  type Surface,
  type ValidationIssueCode
} from "@/analytics/eventContract";
import {
  STEP_AUTH,
  STEP_BEFORE_AFTER,
  STEP_BIRTHDATE,
  STEP_BIRTHPLACE,
  STEP_BIRTHTIME,
  STEP_GUIDANCE,
  STEP_IDENTITY,
  STEP_PAYWALL,
  STEP_PROMISE,
  STEP_SUMMARY,
  STEP_TRIAD
} from "@/onboarding/steps";

/** Los siete del diccionario que no son la visita: `$pageview` es de CORE-183. */
export type ProductEventName = Exclude<EventName, "$pageview">;

/**
 * La lista, derivada del contrato y no escrita a mano: si el diccionario suma un
 * evento, aparece acá solo y el `Record` de abajo deja de compilar hasta que
 * alguien decida desde qué superficie sale.
 */
export const PRODUCT_EVENT_NAMES = EVENT_NAMES.filter(
  (name): name is ProductEventName => name !== "$pageview"
);

/** Dónde pasa cada hecho: superficie y sección del contrato. */
export type ProductEventPlacement = {
  readonly surface: Surface;
  readonly section: Section;
};

/**
 * La superficie de cada evento, decidida una sola vez y acá.
 *
 * Es un `Record<ProductEventName, …>` a propósito: el tipo lo vuelve TOTAL, así
 * que un evento nuevo del contrato rompe el typecheck en vez de heredar en
 * silencio la superficie del vecino.
 *
 *   · Los cuatro del alta van a `onboarding`. Los tres de v1.1.0 lo tienen
 *     DECLARADO en el contrato y el validador lo exige (`unexpected_surface`);
 *     `onboarding_completed` no lo declara —fijárselo ahora sería un major— pero
 *     el hecho que mide es el final del alta y sale de la misma pantalla, así
 *     que medirlo en otra superficie partiría el embudo en dos.
 *   · `paywall_viewed` va a `paywall`: mide la IMPRESIÓN de la oferta. La
 *     paywall del alta es además el paso 11, y por eso esa pantalla emite dos
 *     eventos distintos y es correcto: `onboarding_step_viewed` con
 *     `onboarding_step: paywall` mide el avance del alta, y éste mide la oferta.
 *   · `checkout_started` y `purchase_completed` van a `checkout`, que es el
 *     tramo del cobro. La conversión se lee como el salto entre superficies
 *     (documento, sección 2): `paywall` es lo que se vio y `checkout` es lo que
 *     se intentó y se cobró. Con `checkout_started` en `paywall` no habría
 *     salto, y el embudo perdería justo el paso que separa mirar de pagar.
 *
 * `section` es `sin_seccion` en los siete, y no es un default: la regla de
 * coherencia del contrato reserva las cinco secciones canónicas para
 * `surface: app`, y ninguno de estos hechos pasa dentro de la navegación
 * autenticada. El validador lo comprueba (`surface_section_mismatch`).
 */
export const PLACEMENT_BY_PRODUCT_EVENT: Readonly<
  Record<ProductEventName, ProductEventPlacement>
> = {
  onboarding_step_viewed: { surface: "onboarding", section: "sin_seccion" },
  signup_submitted: { surface: "onboarding", section: "sin_seccion" },
  signup_completed: { surface: "onboarding", section: "sin_seccion" },
  onboarding_completed: { surface: "onboarding", section: "sin_seccion" },
  paywall_viewed: { surface: "paywall", section: "sin_seccion" },
  checkout_started: { surface: "checkout", section: "sin_seccion" },
  purchase_completed: { surface: "checkout", section: "sin_seccion" }
};

/**
 * Índice del flujo -> nombre del paso en el contrato.
 *
 * Las claves son las constantes de `src/onboarding/steps.ts` y los valores el
 * enum del contrato: ni un nombre inventado acá, ni el índice como valor. El
 * índice es la posición y la posición cambia; si mañana se reordena el alta,
 * este mapa sigue diciendo la verdad porque cada nombre viaja pegado a SU
 * constante, no a un número. `test/analyticsEventContract.test.ts` ata además el
 * enum al archivo del flujo, y el de esta tarjeta ata este mapa al enum.
 */
export const ONBOARDING_STEP_BY_INDEX: Readonly<Record<number, OnboardingStep>> = {
  [STEP_AUTH]: "auth",
  [STEP_PROMISE]: "promise",
  [STEP_IDENTITY]: "identity",
  [STEP_GUIDANCE]: "guidance",
  [STEP_BIRTHDATE]: "birthdate",
  [STEP_BIRTHPLACE]: "birthplace",
  [STEP_BIRTHTIME]: "birthtime",
  [STEP_SUMMARY]: "summary",
  [STEP_TRIAD]: "triad",
  [STEP_BEFORE_AFTER]: "before_after",
  [STEP_PAYWALL]: "paywall"
};

/** El nombre del paso que muestra ese índice, o `null` si el flujo no lo nombra. */
export function onboardingStepName(index: unknown): OnboardingStep | null {
  if (typeof index !== "number" || !Number.isInteger(index)) return null;
  return ONBOARDING_STEP_BY_INDEX[index] ?? null;
}

// --- El hecho que entra -------------------------------------------------------

/**
 * Un hecho del producto, tal como lo declara la pantalla que lo vio.
 *
 * Es una unión discriminada y no un objeto con campos opcionales: así el paso
 * del alta es OBLIGATORIO justo en el único evento que lo admite, y no se puede
 * pegar a ningún otro ni siquiera por error de tipeo. La allowlist del contrato
 * lo rechazaría igual (`property_not_allowed`), pero acá ni se puede escribir.
 */
export type ProductEventInput =
  | { readonly name: "onboarding_step_viewed"; readonly step: number }
  | { readonly name: Exclude<ProductEventName, "onboarding_step_viewed"> };

/** Las propiedades que puede llevar un evento de producto. Nada más existe. */
export type ProductEventProperties = CommonEventProperties | OnboardingStepViewedEventProperties;

/** Por qué un hecho no produjo evento. Ninguna razón lleva datos adentro. */
export type ProductEventSkipReason =
  /** El flujo mostró un paso que el contrato no nombra: sin nombre no hay evento. */
  | "unknown_step"
  /** El evento armado no pasó `validateEvent`. Nunca debería ocurrir. */
  | "invalid_event";

export type ProductEventDecision =
  | {
      readonly emit: true;
      readonly name: ProductEventName;
      /**
       * El HECHO que este evento cuenta, en una clave estable. Es lo que hace
       * que "un evento por hecho" sea comprobable: dos avisos del mismo hecho
       * comparten clave y el segundo no sale.
       */
      readonly fact: string;
      readonly properties: ProductEventProperties;
    }
  | {
      readonly emit: false;
      readonly name: ProductEventName;
      readonly reason: ProductEventSkipReason;
      /** Códigos del validador, sin propiedades ni valores. */
      readonly issues: readonly ValidationIssueCode[];
    };

/**
 * ¿Este hecho produce un evento, y con qué propiedades?
 *
 * Toda la regla vive acá: la superficie sale del mapa de arriba, el paso del
 * alta se traduce a su nombre, las cinco propiedades comunes se estampan con la
 * versión vigente del contrato y el evento se valida antes de devolverlo.
 */
export function decideProductEvent(
  input: ProductEventInput & { readonly environment: Environment }
): ProductEventDecision {
  const { name } = input;
  const placement = PLACEMENT_BY_PRODUCT_EVENT[name];
  const common: CommonEventProperties = {
    environment: input.environment,
    platform: "web",
    surface: placement.surface,
    section: placement.section,
    contract_version: CONTRACT_VERSION
  };

  let properties: ProductEventProperties = common;
  let fact: string = name;

  if (input.name === "onboarding_step_viewed") {
    const step = onboardingStepName(input.step);
    // El índice no viaja NUNCA: si el contrato no lo nombra, no hay evento. Un
    // paso nuevo del flujo entra al enum por la puerta del contrato (minor), no
    // por un número que nadie sabría leer en seis meses.
    if (!step) return { emit: false, name, reason: "unknown_step", issues: [] };
    properties = { ...common, onboarding_step: step };
    // El hecho es "se vio ESTE paso", no "se vio un paso": volver atrás a uno ya
    // contado no emite, y avanzar al siguiente sí.
    fact = `${name}:${step}`;
  }

  const veredicto = validateEvent({ name, properties });
  if (!veredicto.valid) {
    return {
      emit: false,
      name,
      reason: "invalid_event",
      issues: veredicto.issues.map((issue) => issue.code)
    };
  }

  return { emit: true, name, fact, properties };
}

/**
 * El aviso que se escribe cuando un hecho no se emite.
 *
 * Lleva el nombre del evento, la razón y los códigos del validador, y nada más:
 * ni el índice del paso, ni el valor de ninguna propiedad. Un log es un lugar
 * donde los datos se quedan, así que la regla de la allowlist rige también acá.
 */
export function productEventWarning(decision: ProductEventDecision): string | null {
  if (decision.emit) return null;
  const codigos = decision.issues.length > 0 ? ` (${decision.issues.join(", ")})` : "";
  return `[orbita] ${decision.name} no emitido: ${decision.reason}${codigos}`;
}

// --- Un evento por hecho ------------------------------------------------------

/**
 * Todo lo que este módulo necesita del navegador y del SDK, y nada más.
 *
 * Es un puerto y no un import por las dos razones de CORE-183: la decisión se
 * prueba sin navegador, y el SDK no entra en el grafo de un módulo que sólo
 * decide.
 */
export type ProductEventPort = {
  /** El envío. Es el único lugar del módulo que habla con el SDK. */
  readonly capture: (event: ProductEventName, properties: ProductEventProperties) => void;
  /** El entorno del build, nunca el hostname. */
  readonly environment: () => Environment;
  /** Dónde se avisa que un hecho no produjo evento. */
  readonly warn: (message: string) => void;
  /** ¿Este hecho ya se contó en una carga anterior de esta pestaña? */
  readonly recall: (fact: string) => boolean;
  /** Deja anotado el hecho para la carga siguiente. */
  readonly remember: (fact: string) => void;
};

/**
 * Los hechos irrepetibles cuyo no-disparador CRUZA una carga de página.
 *
 * Es uno solo, y el contrato lo nombra: "volver a abrir la pantalla de compra
 * exitosa" no es una compra nueva. Recargar `/checkout/success` vuelve a
 * consultar el estado, vuelve a recibir `active` y —sin esto— contaría una
 * segunda conversión sobre el mismo cobro, que es el número más caro de
 * ensuciar. Los otros seis se cuentan dentro de la carga: el alta y la paywall
 * viven adentro de una sola sesión de navegación, y ahí alcanza con el estado de
 * módulo.
 *
 * Lo que se anota es esta clave y nada más: sin id de sesión de pago, sin URL y
 * sin nada de la query, que el contrato prohíbe guardar (sección 8).
 */
const CROSS_LOAD_FACTS: ReadonlySet<string> = new Set<ProductEventName>(["purchase_completed"]);

/**
 * Los hechos ya contados en esta carga.
 *
 * Vive en el MÓDULO y no en un componente, que es la corrección que CORE-183
 * pagó cara: con el estado en la instancia, un remount —un cambio de layout, el
 * doble efecto de StrictMode en desarrollo, un árbol que React descarta y vuelve
 * a montar— contaba el mismo hecho de nuevo. El estado de módulo vive lo que
 * vive el documento, que es exactamente lo que dura una sesión de navegación.
 */
const contados = new Set<string>();

/**
 * Emite el evento de este hecho, una sola vez.
 *
 * El orden importa: se anota ANTES de capturar, así una captura que falle no
 * deja el hecho listo para contarse de nuevo en el render siguiente.
 */
export function emitProductEvent(input: ProductEventInput, port: ProductEventPort): void {
  const decision = decideProductEvent({ ...input, environment: port.environment() });
  if (!decision.emit) {
    const aviso = productEventWarning(decision);
    if (aviso) port.warn(aviso);
    return;
  }

  const { fact } = decision;
  if (contados.has(fact)) return;
  const cruzaCargas = CROSS_LOAD_FACTS.has(decision.name);
  if (cruzaCargas && port.recall(fact)) {
    contados.add(fact);
    return;
  }

  contados.add(fact);
  if (cruzaCargas) port.remember(fact);
  port.capture(decision.name, decision.properties);
}

/** ¿Este hecho ya se contó en esta carga? Se lee para verificar, no para decidir. */
export function factCounted(fact: string): boolean {
  return contados.has(fact);
}

/**
 * Vuelve al estado de una carga nueva. Existe para las pruebas: en el navegador
 * esto se reinicia recargando la página.
 */
export function resetProductEvents(): void {
  contados.clear();
}
