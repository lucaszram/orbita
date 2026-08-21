/**
 * Decisiones puras del comercio nativo.
 *
 * Este módulo no importa RevenueCat ni React Native: recibe una fotografía
 * mínima de cada paquete de tienda y devuelve únicamente lo que la UI puede
 * mostrar. El identificador del producto nunca forma parte del contrato
 * público; `id` es el identificador opaco del paquete del Offering vigente.
 */

export const ORBITA_PRO_ENTITLEMENT = "orbita_pro";

/**
 * Oferta introductoria tal como la informa la tienda. `price === 0` es la
 * prueba gratuita; cualquier otro importe es un precio introductorio rebajado,
 * que NO forma parte del contrato comercial vigente y no se anuncia.
 */
export type StoreIntroOffer = {
  price: number;
  priceString: string;
  cycles: number;
  period: string | null;
};

/**
 * Elegibilidad informada por StoreKit/Play a traves de RevenueCat.
 *
 * `unknown` cubre por igual un error de red, una plataforma que no sabe
 * contestar y una respuesta que no se entiende. En los tres casos la promesa
 * se calla: una prueba prometida a alguien que ya la usó es una promesa que la
 * tienda va a desmentir en la hoja de confirmación de compra.
 */
export type StoreTrialEligibility = "eligible" | "ineligible" | "unknown" | "no_offer";

export type StorePackageSnapshot = {
  id: string;
  packageType: string;
  title: string;
  priceString: string;
  subscriptionPeriod: string | null;
  pricePerMonthString: string | null;
  introOffer?: StoreIntroOffer | null;
  trialEligibility?: StoreTrialEligibility;
};

export type NativeStoreTrial = {
  /** Texto mostrable, derivado del período que informa la tienda. */
  label: string;
  /** Período ISO-8601 recibido, para trazabilidad y pruebas. */
  period: string;
};

export type NativeStorePlan = {
  id: string;
  label: string;
  price: string;
  cadence: string;
  comparison: string | null;
  trial: NativeStoreTrial | null;
};

const PACKAGE_LABELS: Readonly<Record<string, string>> = {
  LIFETIME: "De por vida",
  ANNUAL: "Anual",
  SIX_MONTH: "Seis meses",
  THREE_MONTH: "Tres meses",
  TWO_MONTH: "Dos meses",
  MONTHLY: "Mensual",
  WEEKLY: "Semanal"
};

/** Traduce un período ISO-8601 de StoreKit/Play sin inventar una frecuencia. */
export function storePeriodLabel(period: string | null): string {
  if (!period) return "pago único";
  const parsed = /^P(\d+)([DWMY])$/.exec(period);
  if (!parsed) return "según la tienda";

  const amount = Number(parsed[1]);
  const unit = parsed[2];
  if (amount === 1) {
    if (unit === "D") return "por día";
    if (unit === "W") return "por semana";
    if (unit === "M") return "por mes";
    if (unit === "Y") return "por año";
  }

  const plural = unit === "D" ? "días" : unit === "W" ? "semanas" : unit === "M" ? "meses" : "años";
  return `cada ${amount} ${plural}`;
}

/**
 * Duración de una prueba, en las unidades que la tienda usa de verdad.
 *
 * Una semana se convierte a días porque son siete exactos; meses y años
 * conservan su unidad, porque su largo depende del calendario y decir "30 días"
 * sería inventar una duración que Apple no prometió.
 */
export function storeTrialPeriodLabel(period: string, cycles = 1): string | null {
  const parsed = /^P(\d+)([DWMY])$/.exec(period);
  if (!parsed) return null;
  const repeats = Number.isFinite(cycles) && cycles >= 1 ? Math.floor(cycles) : 1;
  const amount = Number(parsed[1]) * repeats;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = parsed[2];
  if (unit === "D") return `${amount} ${amount === 1 ? "día" : "días"}`;
  if (unit === "W") return `${amount * 7} días`;
  if (unit === "M") return `${amount} ${amount === 1 ? "mes" : "meses"}`;
  return `${amount} ${amount === 1 ? "año" : "años"}`;
}

/**
 * La prueba se anuncia SÓLO si la tienda informa una oferta introductoria
 * gratuita y ADEMÁS confirma que esta cuenta es elegible. Sin las dos cosas la
 * pantalla muestra el mensual pelado: una persona por grupo de suscripción usa
 * una sola oferta introductoria, y prometerla dos veces es mentir.
 */
export function nativeStoreTrial(
  intro: StoreIntroOffer | null | undefined,
  eligibility: StoreTrialEligibility = "unknown"
): NativeStoreTrial | null {
  if (eligibility !== "eligible") return null;
  if (!intro || typeof intro.period !== "string" || intro.period.length === 0) return null;
  // Un precio introductorio rebajado no es una prueba gratis.
  if (intro.price !== 0) return null;

  const label = storeTrialPeriodLabel(intro.period, intro.cycles);
  return label ? { label: `${label} gratis`, period: intro.period } : null;
}

/**
 * La tienda manda precio, moneda, título, período y prueba. Acá sólo se ordenan
 * para presentarlos; no hay importes, descuentos, duraciones de prueba ni
 * product ids de respaldo.
 */
export function nativeStorePlan(input: StorePackageSnapshot): NativeStorePlan {
  const label = PACKAGE_LABELS[input.packageType] ?? (input.title.trim() || "Plan disponible");
  const comparison =
    input.packageType === "ANNUAL" && input.pricePerMonthString
      ? `${input.pricePerMonthString} por mes`
      : null;
  return {
    id: input.id,
    label,
    price: input.priceString,
    cadence: storePeriodLabel(input.subscriptionPeriod),
    comparison,
    trial: nativeStoreTrial(input.introOffer, input.trialEligibility ?? "unknown")
  };
}

/** El orden del Offering es una decisión remota de RevenueCat. */
export function defaultNativePlan(plans: readonly NativeStorePlan[]): string | null {
  return plans[0]?.id ?? null;
}

export type RevenueCatIdentityStep = "login";

export function isAnonymousRevenueCatUser(userId: string | null): boolean {
  return Boolean(userId?.startsWith("$RCAnonymousID:"));
}

/**
 * Cambiar de cuenta es `logIn(B)` DIRECTO. Nunca hay un logout intermedio.
 *
 * `Purchases.logOut()` no "cierra sesión": crea un usuario ANÓNIMO del SDK.
 * Pasar A → anónimo → B abre una ventana en la que una compra que llega tarde
 * queda atada a un id que no es de nadie, y después hay que transferirla a
 * mano. `logIn(B)` sobre A hace la transición en un solo paso, que es lo que
 * RevenueCat documenta.
 *
 * Y el logout de la app tampoco toca el SDK: la app limpia su propia UI y sus
 * refs, pero dejar el último id identificado en el SDK es preferible a fabricar
 * un anónimo. La próxima sesión entra con `logIn` sobre él.
 */
export function revenueCatIdentitySteps(
  currentUserId: string | null,
  targetUserId: string | null
): RevenueCatIdentityStep[] {
  if (!targetUserId) return [];
  if (currentUserId === targetUserId) return [];
  return ["login"];
}

export type NativeSubscriptionSnapshot = {
  isPro: boolean;
  provider?: string;
  isLifetime: boolean;
  canManageInStripePortal: boolean;
  /** Aditivos: un backend anterior no los manda y la vista degrada sola. */
  canManageInRevenueCat?: boolean;
  activeProviders?: readonly string[];
  /** Dueño para el que el SERVIDOR calculó este resultado. Ver `entitlementBelongsTo`. */
  clerkUserId?: string | null;
};

/**
 * ¿Este entitlement es de la cuenta que está mirando la pantalla?
 *
 * La query de Convex conserva su último valor mientras la nueva suscripción
 * resuelve. En un cambio A → B eso deja el entitlement de A publicado bajo la
 * sesión de B durante uno o varios renders — y con él el efecto que levanta el
 * marcador de compra, que borraba el bloqueo de B con una confirmación ajena.
 *
 * Falla CERRADO: sin dueño vigente, sin campo (backend anterior) o con dueños
 * distintos devuelve `false`. El costo de equivocarse en esa dirección es que el
 * marcador tarde un momento más en levantarse; el costo en la otra es habilitar
 * una recompra sobre un cargo vivo.
 */
export function entitlementBelongsTo(
  entitlement: NativeSubscriptionSnapshot | null | undefined,
  owner: string | null
): boolean {
  if (!entitlement || !owner) return false;
  const dueño = entitlement.clerkUserId;
  if (typeof dueño !== "string" || dueño.length === 0) return false;
  return dueño === owner;
}

/**
 * El ÚNICO entitlement que una pantalla puede usar.
 *
 * Todo lo que decide plata —comprar, restaurar, abrir el portal, mostrar la
 * oferta, contar una impresión, levantar el marcador de compra— tiene que
 * derivar de acá y nunca del valor crudo de la query.
 *
 * Devuelve `undefined` = "todavía no sé", que es lo que las decisiones puras ya
 * tratan como espera (`nativePrimaryAction` con `backendIsPro === undefined`
 * responde `wait`, `nativeSubscriptionView` responde `loading`). Ese estado
 * neutral cubre tres casos distintos a propósito:
 *
 * - la query todavía no resolvió;
 * - no hay dueño vigente contra el cual correlacionar;
 * - el resultado es de OTRA cuenta —el valor cacheado de A durante A → B—.
 *
 * `null` sí pasa: es la respuesta explícita "no hay backend" y las vistas ya
 * saben qué hacer con ella.
 */
export function safeEntitlement(
  raw: NativeSubscriptionSnapshot | null | undefined,
  owner: string | null
): NativeSubscriptionSnapshot | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  return entitlementBelongsTo(raw, owner) ? raw : undefined;
}

export type NativeSubscriptionView =
  | "loading"
  | "unavailable"
  | "free"
  | "revenuecat"
  | "stripe"
  | "lifetime"
  | "active";

/** Perfil decide qué gestión ofrecer desde la autoridad combinada de Convex. */
export function nativeSubscriptionView(
  entitlement: NativeSubscriptionSnapshot | null | undefined
): NativeSubscriptionView {
  if (entitlement === undefined) return "loading";
  if (entitlement === null) return "unavailable";
  if (!entitlement.isPro) return "free";
  if (entitlement.isLifetime) return "lifetime";
  if (entitlement.provider === "revenuecat") return "revenuecat";
  if (entitlement.provider === "stripe" && entitlement.canManageInStripePortal) return "stripe";
  return "active";
}

/**
 * Decisiones del paywall nativo, puras y sin React.
 *
 * Existen acá porque son las que pueden cobrar de más: cuál es el botón
 * primario después de una compra ambigua, y si el acceso que se afirma viene de
 * la tienda o del backend. Probarlas renderizando la pantalla no es posible en
 * node; probarlas como funciones sí.
 */

/** Resultado del último intento de compra que la pantalla todavía arrastra. */
export type NativePurchaseOutcome = "none" | "cancelled" | "ambiguous";

export type NativePrimaryAction = "leave" | "purchase" | "restore" | "wait";

export type NativePrimaryActionInput = {
  /** El Offering vigente resolvió y hay un paquete elegido. */
  offeringReady: boolean;
  /** Autoridad server-side. `undefined` = la query todavía no resolvió. */
  backendIsPro: boolean | undefined;
  /** La tienda ya dice que hay acceso, aunque Convex no lo haya confirmado. */
  storeConfirmed: boolean;
  /** Hay una compra/restauración/activación en curso. */
  busy: boolean;
  lastOutcome: NativePurchaseOutcome;
  /**
   * El marcador persistido de compra en vuelo ya se leyó.
   *
   * Sin esto había una VENTANA: la pantalla montaba con el marcador todavía sin
   * leer, ofrecía "comprar" y alguien podía tocar antes de que el disco
   * contestara. Mientras no se leyó no se ofrece comprar.
   */
  guardLoaded: boolean;
};

/**
 * Qué ofrece el botón primario.
 *
 * El orden importa y es el que evita el doble cobro:
 *
 * 1. con acceso confirmado por el backend no hay nada que comprar;
 * 2. mientras el entitlement no resolvió no se ofrece comprar a ciegas;
 * 3. si la tienda ya cobró —aunque Convex todavía no lo refleje— la salida
 *    NUNCA vuelve a ser comprar;
 * 4. después de un resultado ambiguo (error de red, `inactive` inesperado) la
 *    única acción es restaurar: repetir la compra es exactamente el camino al
 *    cargo duplicado;
 * 5. recién entonces, con oferta lista y sin nada en curso, se puede comprar.
 *
 * Una compra CANCELADA por la persona no bloquea nada: no hubo cargo y volver
 * a intentarlo es legítimo.
 */
export function nativePrimaryAction(input: NativePrimaryActionInput): NativePrimaryAction {
  if (input.backendIsPro === true) return "leave";
  if (input.backendIsPro === undefined) return "wait";
  if (input.storeConfirmed) return "wait";
  if (input.busy) return "wait";
  // Antes de saber si esta cuenta dejó una compra sin resolver no se ofrece
  // ninguna acción de cobro.
  if (!input.guardLoaded) return "wait";
  if (input.lastOutcome === "ambiguous") return "restore";
  return input.offeringReady ? "purchase" : "wait";
}

/** Lo que la tienda acaba de contestar sobre una compra. */
export type NativeStoreAnswer =
  /** Se va a abrir la hoja de la tienda AHORA. Bloquea antes del cargo. */
  | "purchase_started"
  | "purchase_cancelled"
  | "purchase_ambiguous"
  | "store_confirmed"
  | "restore_empty"
  | "recheck_empty";

/**
 * ¿Esta respuesta autoriza a BORRAR el marcador persistido?
 *
 * Decisión pura y por respuesta, a propósito. La pantalla la calculaba dentro
 * del updater de `setSession` y la leía enseguida, así que dependía de CUÁNDO
 * React corre el updater:
 *
 * - si corría al toque, `store_confirmed` sobre una sesión que arrancó `clear`
 *   daba "limpió" y borraba el marcador ANTES de que Convex confirmara nada —
 *   con el cargo ya hecho y el botón de comprar de vuelta;
 * - si se difería, `purchase_cancelled` y `restore_empty` NO borraban, y quien
 *   nunca fue cobrado se quedaba sin poder comprar.
 *
 * Sólo dos respuestas limpian, y las dos son afirmaciones DEMOSTRADAS de la
 * tienda: la cancelación (no hubo cargo) y el restore vacío autoritativo (no
 * hay compra). `store_confirmed` jamás: el cargo existe y falta que Convex lo
 * refleje. `recheck_empty` tampoco: `getCustomerInfo` puede venir del caché.
 */
export function storeAnswerClearsPurchaseGuard(answer: NativeStoreAnswer): boolean {
  return answer === "purchase_cancelled" || answer === "restore_empty";
}

/**
 * Cómo cambia el arrastre de una compra ambigua con cada respuesta.
 *
 * La distinción que importa está entre las dos respuestas vacías:
 *
 * - `restore_empty` viene de `restorePurchases`, que fuerza un refresh del
 *   recibo contra la tienda. "No hay compra" ahí es una respuesta DEFINITIVA,
 *   así que se levanta el bloqueo: seguir empujando a Restaurar dejaría sin
 *   comprar a alguien que nunca fue cobrado.
 * - `recheck_empty` viene de `getCustomerInfo`, que puede contestar desde el
 *   caché del SDK justo después de una compra. Ahí "no hay compra" NO prueba
 *   nada, y la pantalla se queda en Restaurar.
 */
export function nextPurchaseOutcome(
  previous: NativePurchaseOutcome,
  answer: NativeStoreAnswer
): NativePurchaseOutcome {
  switch (answer) {
    case "purchase_cancelled":
      return "cancelled";
    // Mientras la hoja de la tienda está arriba no se sabe si hubo cargo. El
    // arrastre es el mismo que el de cualquier respuesta ambigua.
    case "purchase_started":
    case "purchase_ambiguous":
      return "ambiguous";
    case "store_confirmed":
    case "restore_empty":
      return "none";
    case "recheck_empty":
      return "ambiguous";
    default:
      return previous;
  }
}

// ---------------------------------------------------------------------------
// Cola del SDK de la tienda
// ---------------------------------------------------------------------------

export type SdkEnqueue = <T>(run: () => Promise<T>) => Promise<T>;

/**
 * UNA cola serial para todo lo que toca el SDK de la tienda.
 *
 * El SDK tiene un solo usuario identificado a la vez. Si una transición
 * `logIn(B)` puede correr EN MEDIO de una operación de A, el resultado queda
 * del lado equivocado: una compra atribuida a otra cuenta, un Customer Center
 * abierto sobre la cuenta que no es. Con una cola, la transición espera.
 *
 * Es pura y sin React a propósito: la conducta —que una operación espere a la
 * anterior— se prueba de verdad, no buscando el nombre de un `ref`.
 */
export function createSdkSerialQueue(): SdkEnqueue {
  let tail: Promise<unknown> = Promise.resolve();
  return <T,>(run: () => Promise<T>): Promise<T> => {
    const next = tail.then(run, run);
    tail = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };
}

/**
 * Corre una operación del SDK en la cola, con el DUEÑO capturado al pedirla.
 *
 * `currentOwner()` se consulta dos veces: al encolar, para saber quién pidió la
 * operación, y adentro de la cola justo antes de tocar el SDK. Si entre las dos
 * cambió la cuenta, la operación no corre.
 *
 * Revalidar sólo "hay alguien identificado" no alcanzaba: una acción pedida por
 * A terminaba ejecutándose sobre B.
 */
export function createOwnerGuardedSdkRunner(
  enqueue: SdkEnqueue,
  currentOwner: () => string | null
) {
  return async function run<T>(task: (owner: string) => Promise<T>): Promise<T> {
    const requestedBy = currentOwner();
    return await enqueue(async () => {
      const now = currentOwner();
      if (!requestedBy || !now || now !== requestedBy) {
        throw new Error("REVENUECAT_IDENTIFIED_USER_REQUIRED");
      }
      return await task(requestedBy);
    });
  };
}

/**
 * ¿La identidad que el SDK publicó sirve para ESTE render?
 *
 * Cuando Clerk pasa A → B, el efecto que limpia el estado del provider corre
 * DESPUÉS del render. En ese render intermedio, la identidad publicada, los
 * planes, `phase: "ready"` y `storeIsPro` seguían siendo los de A y quedaban
 * expuestos bajo la sesión de B: el paywall de B veía la oferta de A y su
 * "ya sos Pro".
 *
 * La pregunta se contesta de forma SÍNCRONA con lo que este render sabe, sin
 * esperar a ningún efecto. Si la respuesta es `false`, el provider expone un
 * estado seguro: sin dueño, sin planes, sin store y en espera.
 */
export function storeIdentityIsCurrent(input: {
  isLive: boolean;
  liveUserId: string | null;
  publishedOwner: string | null;
}): boolean {
  if (!input.isLive) return false;
  if (!input.liveUserId) return false;
  return input.publishedOwner === input.liveUserId;
}

// ---------------------------------------------------------------------------
// Estado de pantalla CON DUEÑO
// ---------------------------------------------------------------------------

/**
 * Un valor de UI atado a la cuenta que lo produjo.
 *
 * Existe porque las continuaciones asíncronas sobreviven al cambio de cuenta:
 * el `finally` de un restore de A, el mensaje de su error o el timer de su
 * activación llegaban después de que Clerk ya había pasado a B, y pintaban la
 * pantalla de B con lo que le pasó a A.
 *
 * La regla es de LECTURA: se publica con el dueño capturado y se lee sólo si
 * ese dueño sigue siendo el vigente. Nada que A escriba puede verse en B.
 */
export type OwnedValue<T> = { owner: string | null; value: T };

export function ownedValue<T>(owner: string | null, value: T): OwnedValue<T> {
  return { owner, value };
}

/** Lo que la pantalla puede mostrar: sólo lo publicado por el dueño vigente. */
export function readOwnedValue<T>(
  slot: OwnedValue<T>,
  owner: string | null,
  fallback: T
): T {
  return slot.owner !== null && slot.owner === owner ? slot.value : fallback;
}

/**
 * Publica en el slot SÓLO si quien produce el valor sigue siendo el dueño.
 *
 * Filtrar en la lectura no alcanzaba: el slot es UNO solo, así que un `finally`
 * tardío de A **reemplazaba físicamente** lo que B tenía puesto. B estaba
 * `restoring` con su mensaje, llegaba el cierre de A, el slot pasaba a
 * `{ owner: A, value: "idle" }` y B —que ya no encontraba su propio valor— caía
 * al fallback: se le apagaba el spinner y se le borraba el mensaje.
 *
 * Con esta guarda, una publicación fuera de turno devuelve el slot ANTERIOR sin
 * tocarlo. `producedBy` es el dueño capturado cuando arrancó la operación;
 * `currentOwner` se lee de una ref viva, no del closure del render viejo.
 */
export function publishOwnedValue<T>(
  slot: OwnedValue<T>,
  producedBy: string | null,
  currentOwner: string | null,
  value: T
): OwnedValue<T> {
  if (producedBy === null || producedBy !== currentOwner) return slot;
  return { owner: producedBy, value };
}

/**
 * Cuánto puede durar la espera del webhook antes de ofrecer reparación.
 *
 * Vive acá, y no en la pantalla, porque es el mismo número para las dos cosas
 * que tienen que coincidir: el umbral con el que se decide la fase y el plazo
 * que la pantalla arma en su timer. Con una copia en cada lado, cambiar uno
 * dejaba una franja en la que la fase decía una cosa y el reloj otra.
 */
export const NATIVE_ACTIVATION_RECOVERY_MS = 20_000;

/**
 * ¿De dónde viene el acceso que la pantalla afirma?
 *
 * `activating` es el estado honesto entre una compra que la tienda ya aceptó y
 * el webhook que todavía no llegó a Convex. `recoverable` es ESA MISMA espera
 * cuando ya duró más de `NATIVE_ACTIVATION_RECOVERY_MS`: no afirma nada nuevo
 * —la compra sigue confirmada por la tienda y sin confirmar por Convex— pero
 * deja de prometer que falta poco y habilita las salidas que reparan sin
 * volver a cobrar.
 *
 * Ninguna de las dos abre nada: los gates siguen leyendo
 * `subscriptions.getCurrent`.
 */
export type NativeActivationPhase = "idle" | "activating" | "recoverable" | "confirmed";

/**
 * El tiempo entra como DATO, no como reloj interno.
 *
 * La función no mide nada: recibe cuánto lleva la espera y contesta. Así la
 * frontera de los veinte segundos se prueba en node, sin timers falsos, y la
 * pantalla queda como único lugar donde existe un `setTimeout`.
 *
 * `elapsedMs` es opcional a propósito: sin dato, la espera recién empieza. Un
 * `NaN` o un valor negativo caen del mismo lado conservador —`activating`—,
 * porque adelantar la reparación no es más seguro que atrasarla: sólo cambia
 * qué se le ofrece a alguien cuyo cargo ya existe.
 */
export function nativeActivationPhase(input: {
  backendIsPro: boolean | undefined;
  storeConfirmed: boolean;
  elapsedMs?: number;
}): NativeActivationPhase {
  if (input.backendIsPro === true) return "confirmed";
  if (!input.storeConfirmed) return "idle";
  const elapsed = input.elapsedMs;
  return typeof elapsed === "number" && elapsed >= NATIVE_ACTIVATION_RECOVERY_MS
    ? "recoverable"
    : "activating";
}


/**
 * Qué salidas de gestión ofrecerle a la persona.
 *
 * `nativeSubscriptionView` contesta "de qué proveedor es este acceso" y elige
 * UNO. Alcanzaba mientras nadie pudiera pagar dos veces, pero se puede: quien
 * compró en la web y después en la app tiene dos cobros vivos, y la pantalla
 * sólo ofrecía cancelar el del ganador por rango. El otro seguía corriendo sin
 * ninguna salida visible —y el caso peor es el más caro: un lifetime de la
 * tienda gana el rango para siempre y esconde un mensual de Stripe que cobra
 * todos los meses—.
 *
 * Por eso esto no elige: declara CADA salida disponible por separado. `view` se
 * conserva igual para lo que ya lo usa.
 */
export type NativeSubscriptionManagement = {
  view: NativeSubscriptionView;
  showStoreCenter: boolean;
  showStripePortal: boolean;
  /** Hay más de un cobro vivo: la pantalla tiene que decirlo, no elegir uno. */
  dual: boolean;
};

export function nativeSubscriptionManagement(
  entitlement: NativeSubscriptionSnapshot | null | undefined
): NativeSubscriptionManagement {
  const view = nativeSubscriptionView(entitlement);
  if (!entitlement || !entitlement.isPro) {
    return { view, showStoreCenter: false, showStripePortal: false, dual: false };
  }

  // Un backend anterior no manda los campos aditivos: se cae al comportamiento
  // de siempre, deducido de `provider`.
  const showStoreCenter =
    entitlement.canManageInRevenueCat ?? entitlement.provider === "revenuecat";
  const showStripePortal = entitlement.canManageInStripePortal;

  return {
    view,
    showStoreCenter,
    showStripePortal,
    dual: showStoreCenter && showStripePortal
  };
}


/**
 * Estado de compra de UNA cuenta.
 *
 * Antes vivía suelto en tres `useState` del paywall, y ninguno sabía de quién
 * era. Con un cambio de cuenta A → B, el `guardLoaded: true` de A habilitaba
 * "comprar" en el primer render de B —antes de leer el marcador de B— y una
 * continuación async de A podía publicar o LIMPIAR el estado de B.
 *
 * Acá el dueño es parte del estado, así que las dos cosas se vuelven imposibles
 * de expresar.
 */
export type NativePurchaseSession = {
  userId: string | null;
  /** `loading` = el marcador todavía no se leyó para ESTE dueño. */
  guard: "loading" | "clear" | "blocked";
  lastOutcome: NativePurchaseOutcome;
  purchaseReceived: boolean;
};

export function emptyPurchaseSession(userId: string | null): NativePurchaseSession {
  return { userId, guard: "loading", lastOutcome: "none", purchaseReceived: false };
}

/** Devuelve la sesión de este dueño; si cambió, arranca de cero. */
export function purchaseSessionForOwner(
  session: NativePurchaseSession,
  userId: string | null
): NativePurchaseSession {
  return session.userId === userId ? session : emptyPurchaseSession(userId);
}

/**
 * Aplica una respuesta de la tienda, SÓLO si sigue siendo del dueño vigente.
 *
 * Una continuación de A que vuelve tarde no publica nada en la sesión de B — ni
 * para bloquear ni para limpiar.
 */
export function applyStoreAnswer(
  session: NativePurchaseSession,
  userId: string | null,
  answer: NativeStoreAnswer
): NativePurchaseSession {
  if (session.userId !== userId || userId === null) return session;

  const lastOutcome = nextPurchaseOutcome(session.lastOutcome, answer);
  // Sólo una cancelación demostrada o un Restaurar vacío autoritativo levantan
  // el marcador. Que la TIENDA confirme la compra no alcanza: el cargo existe y
  // todavía falta que Convex lo refleje.
  const clears = storeAnswerClearsPurchaseGuard(answer);
  const blocks =
    answer === "purchase_started" ||
    answer === "purchase_ambiguous" ||
    answer === "recheck_empty";

  return {
    userId,
    guard: clears ? "clear" : blocks ? "blocked" : session.guard,
    lastOutcome,
    purchaseReceived:
      answer === "store_confirmed"
        ? true
        : clears
          ? false
          : session.purchaseReceived
  };
}

/**
 * ¿La confirmación del backend puede levantar el marcador de la TIENDA?
 *
 * Sólo si el acceso confirmado incluye a RevenueCat. Alguien con Stripe activo
 * que además compró en la App Store tiene `isPro: true` desde el primer día:
 * usarlo para limpiar el marcador dejaría la compra de Apple sin confirmar y
 * devolvería el botón "comprar" con un cargo en el aire.
 */
export function backendConfirmsStorePurchase(
  entitlement: NativeSubscriptionSnapshot | null | undefined
): boolean {
  if (!entitlement?.isPro) return false;
  if (entitlement.activeProviders) return entitlement.activeProviders.includes("revenuecat");
  // Backend anterior sin los campos aditivos.
  return entitlement.canManageInRevenueCat ?? entitlement.provider === "revenuecat";
}
