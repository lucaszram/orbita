/**
 * Los siete eventos de producto del contrato, decididos acá (CORE-188).
 *
 * CORE-183 dejó la web emitiendo `$pageview`: se sabe qué rutas se abren y nada
 * más. Entre la primera pantalla del alta y el cobro no había un solo dato, así
 * que "dónde se cae la gente" era una pregunta sin respuesta posible. Este
 * módulo es el borde que convierte los hechos del producto —un paso del alta
 * que se ve, una cuenta que se crea, una oferta que se muestra, un cobro que
 * vuelve confirmado— en los siete eventos que el contrato v1.1.0 declara, y
 * además sostiene la IDENTIDAD de persona: `identify` con un identificador
 * interno y `reset` en los hechos que el contrato nombra.
 *
 * Es PURO, igual que `routeClassification.ts` y por la misma razón: sin React,
 * sin expo, sin react-native y sin el SDK. Entra un hecho, sale un evento del
 * contrato o una razón para no emitirlo. Así la decisión entera —qué se emite,
 * con qué propiedades, cuántas veces, bajo qué identidad— se prueba sin
 * navegador, sin red y sin montar la app, y así el módulo no se convierte en una
 * segunda capa de captura. Lo que ata esto al navegador entra por
 * `ProductEventPort` e `IdentityPort`, que `productTelemetry.ts` completa.
 *
 * Quien avisa un hecho NO decide: la pantalla dice lo que sabe —el paso, si está
 * pintado, qué contestó el backend— y toda la regla vive acá. Es lo que hace que
 * "el paso se cuenta cuando es visible" o "una prueba gratuita no es una compra"
 * se puedan probar EJECUTANDO, y no leyendo un `if` adentro de un componente.
 *
 * El contrato (`eventContract.ts`) NO se toca desde acá: se lee. `validateEvent`
 * es la última palabra, también sobre este archivo: lo que no valida no sale.
 */
import {
  CONTRACT_VERSION,
  EVENT_NAMES,
  isStableInternalIdentifier,
  requiresIdentityReset,
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

// --- La compra: qué separa un cobro de una prueba gratuita -------------------

/**
 * El único estado de suscripción que significa CARGO.
 *
 * `convex/schema.ts` declara siete (`inactive`, `trialing`, `active`,
 * `past_due`, `billing_issue`, `canceled`, `expired`) y el entitlement trata
 * `trialing` como acceso concedido, que es correcto para ABRIR el producto y
 * falso para contar una conversión: durante la prueba de siete días no hubo
 * ningún cobro. `past_due` y `billing_issue` tampoco entran: dicen que un cobro
 * está fallando, no que acaba de confirmarse.
 */
const CHARGED_SUBSCRIPTION_STATUS = "active";

/** El estado de la suscripción mientras corre la prueba gratuita. */
const TRIAL_SUBSCRIPTION_STATUS = "trialing";

/**
 * Lo que la pantalla de retorno del checkout sabe, tal como lo sabe.
 *
 * Son dos autoridades distintas y hacen falta las dos:
 *
 *   · `checkoutStatus` viene de `payments.getCheckoutStatus`, que verifica la
 *     sesión de pago, el propietario y el customer, y sólo dice `active` después
 *     del entitlement autoritativo del webhook. Es lo que prueba que ESTA compra
 *     volvió confirmada — pero colapsa `trialing` en `active`, porque su unión
 *     de retorno sólo tiene tres literales.
 *   · `subscriptionStatus` viene de `subscriptions.getCurrent`, que CONSERVA
 *     `trialing` como estado propio. Es la única señal del front que distingue
 *     un cargo de una prueba sin cargo.
 *
 * `subscriptionOwner` y `sessionOwner` están porque la query reactiva conserva
 * su último valor mientras la nueva resuelve: en un cambio A → B, el estado de A
 * queda publicado bajo la sesión de B durante uno o varios renders. Sin
 * comparar dueños, la compra de A se contaría bajo B.
 */
export type PurchaseSignal = {
  /** Lo que confirmó el retorno del checkout (`pending | active | failed`). */
  readonly checkoutStatus: string | null | undefined;
  /** El estado real de la suscripción, con `trialing` sin colapsar. */
  readonly subscriptionStatus: string | null | undefined;
  /** Cuenta para la que el backend calculó la suscripción. */
  readonly subscriptionOwner: string | null | undefined;
  /** Cuenta de la sesión viva. */
  readonly sessionOwner: string | null | undefined;
  /**
   * Fin del período vigente, en ms. Discrimina UNA compra de la siguiente sin
   * guardar nada de lo que el contrato prohíbe (sección 8): no es el id de la
   * sesión de pago, no es la URL y no es la query. Es el momento hasta el que el
   * backend concedió el acceso de ESTE cobro.
   */
  readonly periodEnd: number | null | undefined;
};

/**
 * La clave del hecho "esta compra", no "una compra".
 *
 * Sin el período, la marca de pestaña guardaba `purchase_completed` a secas y
 * una compra posterior legítima —la persona canceló, volvió a comprar en la
 * misma pestaña— quedaba tapada por la anterior. Con él, dos cobros distintos
 * son dos claves distintas y el segundo se cuenta.
 *
 * Sin período disponible se cae a la clave genérica: es peor discriminante, pero
 * no inventa uno. El caso ya no puede pasar en silencio porque
 * `decidePurchaseFact` sólo llega acá con la suscripción resuelta.
 */
export function purchaseFact(periodEnd: unknown): string {
  return typeof periodEnd === "number" && Number.isFinite(periodEnd)
    ? `purchase_completed:${periodEnd}`
    : "purchase_completed";
}

/** Por qué un retorno de checkout no es una compra que contar. */
export type PurchaseSkipReason =
  /** El backend todavía no confirmó (o dijo que no): `pending` o `failed`. */
  | "checkout_unconfirmed"
  /** La suscripción no resolvió todavía: sin ella no se sabe si hubo cargo. */
  | "subscription_unknown"
  /** El estado publicado es de otra cuenta (query cacheada durante A → B). */
  | "owner_mismatch"
  /** Prueba gratuita de siete días: acceso concedido y CERO cobrado. */
  | "free_trial"
  /** Ni cargo ni prueba: cancelada, vencida, con el cobro fallando. */
  | "not_charged";

export type PurchaseVerdict =
  | { readonly charged: true; readonly fact: string }
  | { readonly charged: false; readonly reason: PurchaseSkipReason };

/**
 * ¿Este retorno de checkout es un cobro confirmado?
 *
 * El contrato descarta expresamente "un cobro pendiente, EN PRUEBA GRATUITA SIN
 * CARGO, fallido o reembolsado". La oferta web de hoy es una sola —mensual con
 * siete días gratis (`MONTHLY_TRIAL_DAYS`)—, así que en el retorno el estado
 * real es `trialing` y esto devuelve `free_trial`: no se emite. Emitir ahí
 * contaría cada prueba como conversión y volvería inservible justo la métrica
 * para la que existe el evento.
 *
 * La función no depende de que la oferta tenga prueba: si mañana existe un plan
 * sin días gratis, el mismo código emite sin tocar una línea.
 */
export function decidePurchaseFact(signal: PurchaseSignal): PurchaseVerdict {
  if (signal.checkoutStatus !== CHARGED_SUBSCRIPTION_STATUS) {
    return { charged: false, reason: "checkout_unconfirmed" };
  }
  if (typeof signal.subscriptionStatus !== "string" || signal.subscriptionStatus === "") {
    return { charged: false, reason: "subscription_unknown" };
  }
  // Falla CERRADO: sin dueño vigente, sin dueño del dato o con dueños distintos,
  // no se cuenta. El costo de equivocarse acá es perder una conversión; en la
  // otra dirección es atribuirle a alguien la compra de otra persona.
  if (
    typeof signal.subscriptionOwner !== "string" ||
    typeof signal.sessionOwner !== "string" ||
    signal.subscriptionOwner !== signal.sessionOwner
  ) {
    return { charged: false, reason: "owner_mismatch" };
  }
  if (signal.subscriptionStatus === TRIAL_SUBSCRIPTION_STATUS) {
    return { charged: false, reason: "free_trial" };
  }
  if (signal.subscriptionStatus !== CHARGED_SUBSCRIPTION_STATUS) {
    return { charged: false, reason: "not_charged" };
  }
  return { charged: true, fact: purchaseFact(signal.periodEnd) };
}

// --- El hecho que entra -------------------------------------------------------

/**
 * Un hecho del producto, tal como lo declara la pantalla que lo vio.
 *
 * Es una unión discriminada y no un objeto con campos opcionales: así el paso
 * del alta es OBLIGATORIO justo en el único evento que lo admite, y no se puede
 * pegar a ningún otro ni siquiera por error de tipeo. La allowlist del contrato
 * lo rechazaría igual (`property_not_allowed`), pero acá ni se puede escribir.
 *
 * Tres hechos llevan más de lo que viaja en el evento, y ninguno de esos campos
 * extra sale del dispositivo: son lo que la pantalla SABE, para que la decisión
 * no viva adentro de un componente.
 */
export type ProductEventInput =
  | {
      readonly name: "onboarding_step_viewed";
      readonly step: number;
      /**
       * El paso está PINTADO, no sólo montado.
       *
       * El disparador del contrato es "el paso queda montado y VISIBLE". El alta
       * devuelve una vista vacía mientras las fuentes no cargaron: ahí el
       * componente ya está montado, el estado `step` ya vale, y no hay nada en
       * pantalla. Contar ahí mide el montaje, no la vista.
       */
      readonly visible: boolean;
      /**
       * Inspección visual (`debugStep`, `/preview-alta`): monta los once pasos a
       * la vez y en ocho tamaños. No es nadie recorriendo el alta.
       */
      readonly inspecting: boolean;
      /**
       * Con sesión activa, el paso de acceso no es la primera pantalla del alta
       * sino la espera de "Entrando a tu cuenta…" mientras el flujo decide la
       * salida: un paso que el flujo saltea solo, que el contrato descarta.
       */
      readonly sessionActive: boolean;
    }
  | {
      readonly name: "checkout_started";
      /**
       * Qué intento de pago es éste.
       *
       * El contrato descarta "un reintento AUTOMÁTICO del mismo intento ya
       * contado" —un remontaje, el doble efecto de StrictMode— y no un segundo
       * intento que la persona confirma después de un error. Cada uno crea una
       * sesión de pago REAL en Stripe, así que son dos intenciones y no una.
       */
      readonly attempt: number;
    }
  | ({ readonly name: "purchase_completed" } & PurchaseSignal)
  | {
      readonly name: Exclude<
        ProductEventName,
        "onboarding_step_viewed" | "checkout_started" | "purchase_completed"
      >;
    };

/** Las propiedades que puede llevar un evento de producto. Nada más existe. */
export type ProductEventProperties = CommonEventProperties | OnboardingStepViewedEventProperties;

/** Por qué un hecho no produjo evento. Ninguna razón lleva datos adentro. */
export type ProductEventSkipReason =
  /** El flujo mostró un paso que el contrato no nombra: sin nombre no hay evento. */
  | "unknown_step"
  /** El evento armado no pasó `validateEvent`. Nunca debería ocurrir. */
  | "invalid_event"
  /** El paso está montado y todavía no pintado. */
  | "not_visible"
  /** Inspección visual del alta, no un recorrido. */
  | "inspection"
  /** Un paso que el flujo saltea solo. */
  | "skipped_step"
  | PurchaseSkipReason;

/**
 * Razones que son parte del funcionamiento NORMAL y no se avisan.
 *
 * Un aviso existe para que alguien mire: "las fuentes todavía no cargaron" o
 * "esto fue una prueba gratuita" son la conducta correcta, y escribirlos en cada
 * render convertiría la consola en ruido —y el ruido esconde el aviso que sí
 * importa—. Sólo quedan fuera de esta lista los dos que sí son defectos: un paso
 * que el contrato no nombra y un evento que no valida.
 */
const SILENT_SKIP_REASONS: ReadonlySet<ProductEventSkipReason> = new Set<ProductEventSkipReason>([
  "not_visible",
  "inspection",
  "skipped_step",
  "checkout_unconfirmed",
  "subscription_unknown",
  "owner_mismatch",
  "free_trial",
  "not_charged"
]);

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
 * alta se traduce a su nombre, la compra se separa de la prueba gratuita, las
 * cinco propiedades comunes se estampan con la versión vigente del contrato y el
 * evento se valida antes de devolverlo.
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
    // El orden es el del contrato: primero si el paso se VIO, después cuál fue.
    if (!input.visible) return { emit: false, name, reason: "not_visible", issues: [] };
    if (input.inspecting) return { emit: false, name, reason: "inspection", issues: [] };
    if (input.step === STEP_AUTH && input.sessionActive) {
      return { emit: false, name, reason: "skipped_step", issues: [] };
    }
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

  if (input.name === "checkout_started") {
    // El hecho es ESTE intento: un remontaje repite el número y no cuenta, y un
    // reintento confirmado por la persona lo incrementa y sí cuenta.
    fact = `${name}:${input.attempt}`;
  }

  if (input.name === "purchase_completed") {
    const veredicto = decidePurchaseFact(input);
    if (!veredicto.charged) return { emit: false, name, reason: veredicto.reason, issues: [] };
    fact = veredicto.fact;
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
 * El aviso que se escribe cuando un hecho no se emite POR UN DEFECTO.
 *
 * Lleva el nombre del evento, la razón y los códigos del validador, y nada más:
 * ni el índice del paso, ni el estado de la suscripción, ni el valor de ninguna
 * propiedad. Un log es un lugar donde los datos se quedan, así que la regla de la
 * allowlist rige también acá.
 */
export function productEventWarning(decision: ProductEventDecision): string | null {
  if (decision.emit) return null;
  if (SILENT_SKIP_REASONS.has(decision.reason)) return null;
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
 * consultar el estado, vuelve a recibir la confirmación y —sin esto— contaría
 * una segunda conversión sobre el mismo cobro, que es el número más caro de
 * ensuciar. Los otros seis se cuentan dentro de la carga: el alta y la paywall
 * viven adentro de una sola sesión de navegación, y ahí alcanza con el estado de
 * módulo.
 *
 * Lo que se anota es la clave del hecho y nada más —`purchase_completed` con el
 * fin del período—: sin id de sesión de pago, sin URL y sin nada de la query,
 * que el contrato prohíbe guardar (sección 8).
 */
const CROSS_LOAD_FACTS: ReadonlySet<string> = new Set<ProductEventName>(["purchase_completed"]);

/**
 * Los hechos ya contados por ESTA persona en esta pestaña.
 *
 * Vive en el MÓDULO y no en un componente, que es la corrección que CORE-183
 * pagó cara: con el estado en la instancia, un remount —un cambio de layout, el
 * doble efecto de StrictMode, un árbol que React descarta y vuelve a montar—
 * contaba el mismo hecho de nuevo.
 *
 * Pero el estado de módulo dura lo que dura el DOCUMENTO, y una persona no. En
 * la misma pestaña se puede crear una cuenta, cerrar sesión y crear otra: con la
 * deduplicación atada al documento, el segundo alta no emitía nada. Por eso lo
 * que la reinicia no es una recarga sino `resetIdentityFor`, con los mismos
 * cuatro motivos que el contrato declara para el reset de identidad.
 */
const contados = new Set<string>();

/**
 * Cuántas sesiones de pago arrancó esta persona en este documento.
 *
 * Vive en el MÓDULO por el mismo motivo que `contados`, y el defecto que cierra
 * es concreto: con el número en la instancia del componente, un remontaje —salir
 * de la paywall y volver por navegación interna, un árbol que React descarta— lo
 * devolvía a cero. La clave `checkout_started:1` ya estaba contada, así que el
 * cobro siguiente, que es una sesión de pago REAL en Stripe, no se emitía. Acá
 * el número no puede retroceder.
 *
 * Se reinicia con la IDENTIDAD y no con la recarga: los intentos son de una
 * persona, igual que los hechos contados.
 */
let intentosDeCobro = 0;

/**
 * El número del intento de cobro que ARRANCA ahora.
 *
 * No lo elige la pantalla, y es deliberado: una pantalla recién montada no puede
 * saber cuántos intentos hubo antes de que React la montara, y ése era
 * exactamente el agujero. Se llama pegado a la creación de la sesión de pago, de
 * modo que hay un número nuevo por sesión nueva y ninguno por render: un
 * remontaje SIN confirmación no llega hasta acá, y el doble efecto de StrictMode
 * tampoco, porque los dos los frena el mismo guard sincrónico que ya impide
 * crear dos sesiones de pago.
 *
 * Que sea un contador y no un identificador de la sesión de pago es lo que lo
 * mantiene dentro del contrato: no es el id de Stripe, no es la URL y no es nada
 * de la query (sección 8).
 */
export function nextCheckoutAttempt(): number {
  intentosDeCobro += 1;
  return intentosDeCobro;
}

/** Cuántos intentos de cobro lleva esta persona. Se lee para verificar. */
export function checkoutAttempts(): number {
  return intentosDeCobro;
}

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
 * esto se reinicia recargando la página o reseteando la identidad.
 */
export function resetProductEvents(): void {
  contados.clear();
  intentosDeCobro = 0;
  identificada = null;
}

// --- La identidad de persona --------------------------------------------------

/**
 * Todo lo que la identidad necesita del navegador y del SDK.
 *
 * Está separado de `ProductEventPort` porque son dos capacidades distintas: hay
 * lugares del producto —el logout, la eliminación de cuenta— que tienen que
 * poder cortar el vínculo sin poder emitir ni un evento.
 */
export type IdentityPort = {
  /** `identify` del SDK, con el identificador y NADA más. */
  readonly identify: (distinctId: string) => void;
  /**
   * Quién está identificada según lo que el SDK dejó GUARDADO, o `null`.
   *
   * Es la fuente de verdad de la comparación de identidad, y por eso es un
   * puerto y no una variable de este módulo. El SDK persiste la identidad en el
   * navegador y esa identidad sobrevive a la recarga; cualquier estado de acá
   * muere con el documento. Con la comparación hecha sobre memoria, el camino
   * "la cuenta A se identifica, la persona recarga, entra la cuenta B" no veía a
   * nadie identificado, no reseteaba, y el SDK —todavía identificado como A—
   * ignoraba el `identify` de B: los eventos de B terminaban en el perfil de A.
   */
  readonly identified: () => string | null;
  /** `reset` del SDK: sortea un distinct ID anónimo nuevo. */
  readonly reset: () => void;
  /** Borra las marcas de hechos que sobreviven a la carga (la de la compra). */
  readonly forget: () => void;
  /** Dónde se avisa que una identidad no se pudo usar. */
  readonly warn: (message: string) => void;
};

export type IdentityDecision =
  | { readonly identify: true; readonly distinctId: string }
  | { readonly identify: false; readonly reason: "not_internal_identifier" };

/**
 * ¿Esto se puede mandar a `identify`?
 *
 * La respuesta la da el CONTRATO (`isStableInternalIdentifier`) y no una
 * heurística de acá: el origen tiene que estar en el catálogo cerrado y el valor
 * tiene que tener exactamente la forma que ese emisor produce. Un email, un
 * nombre, un id de un proveedor que el contrato no declara o un valor con la
 * forma equivocada no pasan, y sin identificador válido NO hay `identify` —el
 * contrato se cierra en vez de dejar pasar cualquier cosa.
 */
export function decideIdentify(identifier: unknown): IdentityDecision {
  if (!isStableInternalIdentifier(identifier)) {
    return { identify: false, reason: "not_internal_identifier" };
  }
  return { identify: true, distinctId: identifier.value };
}

/**
 * CACHÉ en memoria de la última persona que este módulo identificó.
 *
 * No es la fuente de verdad: esa es `port.identified()`, que lee la identidad
 * que el SDK dejó escrita en el navegador y que es la única que sobrevive a una
 * recarga. Esta variable contesta en el único caso en que el SDK no puede: sin
 * cliente —sin consentimiento, sin clave, fuera del navegador— no hay nada
 * persistido que leer, y sin ella un cambio de cuenta en ese estado tampoco
 * reiniciaría la deduplicación de hechos.
 */
let identificada: string | null = null;

/**
 * A quién identificó este módulo en esta carga. Se lee para verificar, no para
 * decidir: quién está identificada DE VERDAD lo contesta `port.identified()`,
 * y después de una recarga estas dos respuestas son distintas a propósito.
 */
export function identifiedPerson(): string | null {
  return identificada;
}

/**
 * Ata la captura a una persona, con su identificador interno y nada más.
 *
 * Sin propiedades de persona: `identify` va con el identificador SOLO, sin
 * `$set` ni `$set_once`. Ahí es donde el SDK mandaría las propiedades iniciales
 * (`$initial_referrer`, `$initial_current_url`), que el contrato prohíbe; el
 * filtro de salida las descarta igual, y acá directamente no se pueden escribir
 * porque el puerto no las recibe.
 *
 * Idempotente: volver a identificar a la MISMA persona no hace nada. Identificar
 * a OTRA resetea antes —es un cambio de cuenta, uno de los cuatro motivos que el
 * contrato declara— para que sus eventos no hereden el perfil de la anterior.
 *
 * "La misma" y "otra" se deciden contra la identidad PERSISTIDA por el SDK, no
 * contra lo que este módulo recuerde. Alcanza la diferencia de identidad: no
 * hace falta que exista un perfil local anterior, ni que el cambio pase por el
 * camino que lo detecta, ni que las dos identificaciones ocurran en la misma
 * carga de la página. Una recarga en el medio es justamente el caso que rompía.
 *
 * `alias` no se usa. El contrato lo reserva para unir dos emisores distintos
 * sobre la misma persona (la instalación anónima de ayer, la cuenta de hoy), y
 * en el flujo normal ese vínculo no hace falta: el distinct ID anónimo del SDK
 * viaja desde la primera visita y `identify` lo ata solo.
 */
export function identifyPerson(identifier: unknown, port: IdentityPort): boolean {
  const decision = decideIdentify(identifier);
  if (!decision.identify) {
    port.warn(`[orbita] identify no emitido: ${decision.reason}`);
    return false;
  }
  // Lo persistido manda; la caché sólo contesta cuando no hay SDK a quien
  // preguntar. Nunca al revés: la memoria arranca vacía en cada carga y creerle
  // a ella es lo que dejaba pasar un cambio de cuenta después de recargar.
  const actual = port.identified() ?? identificada;
  if (actual === decision.distinctId) {
    identificada = actual;
    return false;
  }
  if (actual !== null) resetIdentityFor("account_switch", port);
  identificada = decision.distinctId;
  port.identify(decision.distinctId);
  return true;
}

/**
 * Corta el vínculo con la persona, ANTES de cualquier captura siguiente.
 *
 * Los motivos son los del contrato (`requiresIdentityReset`): `logout`,
 * `account_switch`, `account_deletion` y `consent_withdrawn`. No hay una segunda
 * lista acá; un motivo inventado no resetea y se avisa, porque un reset que
 * corre por cualquier cosa es un reset que nadie puede razonar.
 *
 * Reinicia CUATRO cosas, y las cuatro por el mismo motivo: lo que quedaría
 * pegado a la persona siguiente.
 *
 *   1. el distinct ID del SDK —sin esto dos cuentas quedan fusionadas en un
 *      perfil y no hay forma limpia de deshacerlo—;
 *   2. la caché de la persona identificada acá, para que el próximo `identify`
 *      sí corra;
 *   3. la deduplicación de hechos, la del módulo y la de la pestaña — el segundo
 *      alta de la misma pestaña es un hecho nuevo de otra persona, no una
 *      repetición del primero;
 *   4. el contador de intentos de cobro, por lo mismo: el primer intento de la
 *      persona que entra es su primer intento, no el que siga al de la anterior.
 *
 * El reset del SDK va PRIMERO: es el que protege a la persona. Si fallara, lo
 * que se pierde es contar de nuevo, no la privacidad de nadie.
 */
export function resetIdentityFor(trigger: unknown, port: IdentityPort): boolean {
  if (!requiresIdentityReset(trigger)) {
    port.warn("[orbita] reset no aplicado: motivo fuera del contrato");
    return false;
  }
  port.reset();
  identificada = null;
  contados.clear();
  intentosDeCobro = 0;
  port.forget();
  return true;
}
