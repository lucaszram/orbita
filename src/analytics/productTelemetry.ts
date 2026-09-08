/**
 * El puente entre las pantallas del producto y la captura web (CORE-188).
 *
 * Son nueve funciones y ninguna decide nada: avisan un HECHO —"la persona
 * confirmó crear su cuenta", "el paso está pintado", "el backend contestó
 * esto"— y lo demás pasa en `productEvents.ts`, que es puro y está probado sin
 * navegador. Una pantalla no arma propiedades, no elige superficie, no sabe qué
 * versión del contrato viaja, no decide si una suscripción en prueba es una
 * compra y no puede contar dos veces el mismo hecho.
 *
 * ## Por qué existe este archivo, y no un import directo
 *
 * `OnboardingFlow.tsx`, `useAccount.ts`, `useAccountBootstrap.tsx`,
 * `PerfilScreen.tsx` y `accountDeletion.ts` son COMPARTIDOS: no tienen variante
 * `.web`, y el mismo archivo se empaqueta para iOS y para Android. En CORE-183
 * la revisión independiente rechazó exactamente este defecto —un componente
 * compartido (`AccountGate`) terminó ejecutando código de telemetría web en el
 * bundle nativo—, y la corrección fue esta misma: un módulo con `.ts` real y
 * `.native.ts` inerte de la misma firma, para que quien lo usa no tenga que
 * enumerar plataformas y Metro elija por él. Es el patrón de
 * `bootSurface.tsx`/`bootSurface.native.tsx` y de `webTelemetry.native.tsx`.
 *
 * La app nativa mide por otro canal (`docs/handoff-claude-product-events.md`) y
 * medirla con este contrato es una tarjeta que todavía no existe.
 *
 * ## El cliente es UNO
 *
 * La captura entra por `ensureClient()` de `webTelemetry.tsx`: el mismo
 * singleton que emite `$pageview`, con la misma configuración, el mismo
 * `before_send` y el mismo distinct ID. Sin consentimiento, sin clave o sin
 * `window` ese cliente es `null` y acá no se emite ni se identifica nada — la
 * puerta del consentimiento sigue estando en un solo lugar.
 */
import {
  emitProductEvent,
  identifyPerson,
  nextCheckoutAttempt,
  resetIdentityFor,
  type IdentityPort,
  type ProductEventPort,
  type PurchaseSignal
} from "@/analytics/productEvents";
import type { ResetTrigger } from "@/analytics/eventContract";
import { ensureClient, resolveEnvironment } from "@/analytics/webTelemetry";

/**
 * Prefijo de la única anotación que esta tarjeta deja en el dispositivo.
 *
 * Se usa para un hecho y uno solo (`purchase_completed`): el contrato declara
 * que volver a abrir la pantalla de compra exitosa NO es una compra nueva, y esa
 * segunda apertura puede ser una recarga, que estrena el estado de módulo. Lo
 * que se guarda es la clave del hecho y nada más —sin id de la sesión de pago,
 * sin URL y sin nada de la query, que el contrato prohíbe guardar (sección 8)—,
 * en `sessionStorage`, que muere con la pestaña. Y ni siquiera dura eso: un
 * reset de identidad la borra, porque la marca es de una persona y no de un
 * documento.
 */
const FACT_KEY_PREFIX = "orbita_hecho_";

/** El almacenamiento de la pestaña, o nada: en el render estático no hay. */
function tabStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    // Un navegador que lo bloquea no es un error que valga la pena contar: sin
    // memoria, el hecho se cuenta una vez por carga en vez de una sola vez.
    return null;
  }
}

/** Todo lo que la decisión necesita del navegador, en un solo lugar. */
const browserPort: ProductEventPort = {
  capture: (event, properties) => ensureClient()?.capture(event, properties),
  environment: resolveEnvironment,
  warn: (message) => console.warn(message),
  recall: (fact) => {
    try {
      return tabStorage()?.getItem(FACT_KEY_PREFIX + fact) !== null;
    } catch {
      return false;
    }
  },
  remember: (fact) => {
    try {
      tabStorage()?.setItem(FACT_KEY_PREFIX + fact, "1");
    } catch {
      // Sin cuota no hay memoria, y no hay nada que reintentar.
    }
  }
};

/**
 * Todo lo que la identidad necesita del navegador, en un solo lugar.
 *
 * `identify` va con el identificador SOLO: el segundo y el tercer argumento del
 * SDK —`$set` y `$set_once`— son justamente donde viajarían las propiedades de
 * persona, y acá no se pasan. `before_send` las anula igual, así que ni por esta
 * puerta ni por la otra puede salir una propiedad de persona.
 *
 * Los tres borrados fallan en silencio a propósito: pasan en caminos
 * destructivos —logout, cambio de cuenta, eliminación— donde una excepción
 * abortaría algo mucho más importante que la telemetría. Lo que no se puede
 * perder es el orden: el reset ocurre antes de que la persona siguiente capture.
 */
const identityPort: IdentityPort = {
  identify: (distinctId) => {
    try {
      ensureClient()?.identify(distinctId);
    } catch {
      // Sin identidad, la captura sigue siendo anónima. Nunca al revés.
    }
  },
  identified: () => {
    try {
      const client = ensureClient();
      if (!client) return null;
      // Las dos preguntas del cliente instalado, y hacen falta las dos:
      // `_isIdentified()` dice si el estado GUARDADO es "identificada" —sin eso,
      // `get_distinct_id()` devolvería el anónimo que el SDK sortea en la
      // primera visita y una visita sin cuenta se leería como una persona—, y
      // `get_distinct_id()` dice quién es. Las dos salen del mismo lugar que el
      // SDK persiste (`persistence: "localStorage"`, `webClientOptions.ts`), así
      // que contestan lo mismo después de una recarga. Una variable de módulo,
      // no: arranca vacía en cada carga, y ésa era la mezcla de personas.
      return client._isIdentified() ? client.get_distinct_id() : null;
    } catch {
      // Sin respuesta del SDK, la decisión cae a su caché en memoria: es peor
      // fuente, pero es la única que queda y no inventa una identidad.
      return null;
    }
  },
  reset: () => {
    try {
      ensureClient()?.reset();
    } catch {
      // Ver arriba: no hay reintento y no se propaga.
    }
  },
  forget: () => {
    try {
      const storage = tabStorage();
      if (!storage) return;
      const claves: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const clave = storage.key(i);
        if (clave?.startsWith(FACT_KEY_PREFIX)) claves.push(clave);
      }
      for (const clave of claves) storage.removeItem(clave);
    } catch {
      // Ver arriba.
    }
  },
  warn: (message) => console.warn(message)
};

/**
 * El paso del alta que se está mostrando (`onboarding_step_viewed`).
 *
 * Recibe lo que la pantalla SABE —el índice del flujo, si el paso está pintado,
 * si es la inspección visual, si hay sesión— y no una conclusión. El nombre del
 * paso y las tres guardas las resuelve el módulo puro: así ninguna pantalla
 * puede inventar una etiqueta, mandar el número, o contar un paso que todavía no
 * se ve.
 */
export function trackOnboardingStepViewed(input: {
  readonly step: number;
  readonly visible: boolean;
  readonly inspecting: boolean;
  readonly sessionActive: boolean;
}): void {
  emitProductEvent({ name: "onboarding_step_viewed", ...input }, browserPort);
}

/** La persona confirmó crear su cuenta (`signup_submitted`). */
export function trackSignupSubmitted(): void {
  emitProductEvent({ name: "signup_submitted" }, browserPort);
}

/** La cuenta quedó creada y la sesión iniciada (`signup_completed`). */
export function trackSignupCompleted(): void {
  emitProductEvent({ name: "signup_completed" }, browserPort);
}

/** El alta terminó y la carta quedó disponible (`onboarding_completed`). */
export function trackOnboardingCompleted(): void {
  emitProductEvent({ name: "onboarding_completed" }, browserPort);
}

/** La oferta real quedó visible (`paywall_viewed`). */
export function trackPaywallViewed(): void {
  emitProductEvent({ name: "paywall_viewed" }, browserPort);
}

/**
 * La persona confirmó avanzar al cobro (`checkout_started`).
 *
 * El número del intento NO lo trae la pantalla: lo asigna `nextCheckoutAttempt`,
 * que lo guarda a nivel de módulo, junto a la deduplicación de hechos. Una
 * pantalla que lo llevara en su instancia lo perdería al remontarse —salir y
 * volver por navegación interna— y el cobro siguiente repetiría un número ya
 * contado: una sesión de pago REAL que no se emite.
 *
 * Se llama pegado a la creación de la sesión de pago, y ahí está la promesa: un
 * intento nuevo es una sesión nueva, no un render. Un remontaje sin confirmación
 * y el doble efecto de StrictMode no llegan hasta acá, porque los frena el mismo
 * guard sincrónico que impide crear dos sesiones de pago.
 */
export function trackCheckoutStarted(): void {
  emitProductEvent({ name: "checkout_started", attempt: nextCheckoutAttempt() }, browserPort);
}

/**
 * Lo que el retorno del checkout sabe del cobro (`purchase_completed`).
 *
 * La pantalla NO decide si hubo cargo: pasa las dos autoridades —lo que confirmó
 * el retorno y el estado real de la suscripción— y el módulo puro separa el
 * cobro de la prueba gratuita, que es lo que el contrato exige.
 */
export function trackPurchaseCompleted(signal: PurchaseSignal): void {
  emitProductEvent({ name: "purchase_completed", ...signal }, browserPort);
}

/**
 * Ata la captura a la cuenta, con el identificador que el contrato declara.
 *
 * El origen se DECLARA acá y en un solo lugar: `account` es la cuenta tal como
 * la emite el proveedor de identidad, y el contrato la reconoce como uno de sus
 * dos emisores de identidad interna con su formato exacto
 * (`isStableInternalIdentifier`). Un valor con otra forma no identifica a nadie:
 * el contrato se cierra en vez de dejar pasar cualquier cosa.
 *
 * Sin propiedades de persona, sin `alias` y sin PII: lo único que viaja es el
 * identificador.
 */
export function identifyAccount(clerkUserId: string): void {
  identifyPerson({ source: "account", value: clerkUserId }, identityPort);
}

/**
 * Corta el vínculo con la persona, antes de cualquier captura siguiente.
 *
 * El motivo es uno de los cuatro del contrato (`RESET_TRIGGERS`) y el tipo lo
 * exige: no hay una segunda lista de motivos en el producto.
 */
export function resetAnalyticsIdentity(trigger: ResetTrigger): void {
  resetIdentityFor(trigger, identityPort);
}
