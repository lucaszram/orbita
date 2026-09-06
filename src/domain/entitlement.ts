/**
 * Free/Plus en el cliente.
 *
 * El gating REAL lo aplica el servidor: `charts.current` no manda casas ni
 * aspectos a Free, `charts.valuesMap` devuelve `null`, `personalityReadingState`
 * devuelve `locked` y `transits.getToday` recorta el cruce natal. Esto es sólo
 * para contar la verdad en pantalla — que un bloque vacío se lea como "esto es
 * Plus" y no como "algo se rompió". Ocultar o mostrar acá no concede acceso.
 */

export type Entitlement = { isPro: boolean } | null | undefined;

/** Estado de una superficie que el backend puede recortar. */
export type SurfaceAccess = "cargando" | "libre" | "bloqueado";

export function surfaceAccess(input: {
  /** `subscriptions.getCurrent`; `undefined` mientras la query resuelve. */
  entitlement: Entitlement;
  /** `access` del propio payload, cuando lo trae (manda sobre el entitlement). */
  granted?: boolean;
}): SurfaceAccess {
  if (input.granted === true) return "libre";
  if (input.entitlement === undefined) return "cargando";
  if (input.entitlement === null) return "bloqueado";
  if (input.granted === false) return "bloqueado";
  return input.entitlement.isPro ? "libre" : "bloqueado";
}

export type RecepcionCta = "cargando" | "desbloquear" | "entrar";

/**
 * Qué ofrece la recepción del día 1 (la ceremonia post-alta).
 *
 * Free va DIRECTO a `/paywall`: la carta parcial en el medio se leía como un
 * error ("¿por qué está vacía?") en vez de como una oferta. Plus entra a su
 * carta. Mientras el entitlement no resolvió NO se afirma que la cuenta es
 * Free: el botón espera. Sin sesión viva (build local o backend apagado) no hay
 * plan que consultar y se conserva la salida histórica a la carta.
 */
export function recepcionCta(input: {
  entitlement: Entitlement;
  live: boolean;
  /**
   * Hay sesión de Clerk, aunque la app todavía no esté `live` (la fila `users`
   * puede seguir creándose, o el entitlement puede no estar correlacionado).
   *
   * Sin esto, esa ventana caía en la salida histórica y dejaba entrar sin saber
   * el plan. Con sesión firmada la respuesta honesta es esperar; el "entrar"
   * directo queda para lo que de verdad es: build sin backend o sin sesión.
   */
  signedIn?: boolean;
  /**
   * Clerk/Convex todavía están resolviendo la sesión.
   *
   * Hace falta como señal PROPIA: mientras Clerk carga, `useOrbitaAuth`
   * normaliza `isSignedIn` a `false`, así que el primer render de alguien con
   * sesión es indistinguible de no tener ninguna. Sin esto, ese render caía en
   * la salida histórica y dejaba entrar sin saber el plan — un parpadeo, pero
   * uno que abre la carta de alguien que quizás es Free.
   */
  authLoading?: boolean;
}): RecepcionCta {
  if (input.authLoading) return "cargando";
  if (!input.live) return input.signedIn ? "cargando" : "entrar";
  const access = surfaceAccess({ entitlement: input.entitlement });
  if (access === "cargando") return "cargando";
  return access === "libre" ? "entrar" : "desbloquear";
}

export type ValuesMapPhase = "cargando" | "bloqueado" | "sinCarta" | "listo";

/**
 * `charts.valuesMap` devuelve `null` en DOS casos distintos: el usuario es Free,
 * o todavía no hay carta. Sin desambiguar, a alguien Free con su carta ya
 * calculada le decíamos "completá tus datos de nacimiento", que es falso y lo
 * manda a rehacer un onboarding que ya hizo.
 */
export function valuesMapPhase(input: {
  values: unknown | null | undefined;
  entitlement: Entitlement;
  hasChart: boolean | undefined;
}): ValuesMapPhase {
  if (input.values !== null && input.values !== undefined) return "listo";
  if (input.values === undefined || input.entitlement === undefined || input.hasChart === undefined) {
    return "cargando";
  }
  // El bloqueo por plan se decide primero: un Free sin carta igual tiene que
  // completar sus datos, pero un Free CON carta nunca debe leer "falta tu carta".
  if (!input.hasChart) return "sinCarta";
  return input.entitlement && input.entitlement.isPro ? "cargando" : "bloqueado";
}

// ---------------------------------------------------------------------------
// Plan visible: presentación, decisión y snapshot local
// ---------------------------------------------------------------------------

/** Un plan ya afirmado: lo único que hace falta para nombrarlo. */
export type ConfirmedPlan = NonNullable<Entitlement>;

/**
 * Vista EFECTIVA del plan, la que se puede nombrar en pantalla.
 *
 * Es la misma forma que `Entitlement` —a propósito: no hay dos vocabularios de
 * plan— con una diferencia de origen: acá el valor puede venir del snapshot
 * local y no sólo de la query.
 *
 * `undefined` = todavía no sé (query sin resolver, resultado de otra cuenta, o
 * snapshot local sin leer). `null` = el backend contestó y no hay plan. Los dos
 * se dibujan igual —la etiqueta cae en Free— pero significan cosas distintas y
 * sólo el segundo autoriza a cobrar: eso lo dice `resolved`, no esta vista.
 */
export type PlanView = Entitlement;

export const PLAN_PLUS_LABEL = "Órbita Plus";
export const PLAN_FREE_LABEL = "Órbita Free";
export type PlanLabel = typeof PLAN_PLUS_LABEL | typeof PLAN_FREE_LABEL;

/**
 * Cómo se llama el plan que esta vista afirma.
 *
 * Es la ÚNICA función que puede escribir "Órbita Plus", y sólo lo hace con un
 * `isPro === true` confirmado —remoto o cacheado de un remoto—. Cualquier otra
 * cosa (no sé, sin plan, Free) se dice Free: equivocarse hacia Free muestra de
 * menos por un momento; equivocarse hacia Plus le promete a alguien un acceso
 * que la app le va a negar en la próxima pantalla.
 */
export function planLabel(view: PlanView): PlanLabel {
  return view?.isPro === true ? PLAN_PLUS_LABEL : PLAN_FREE_LABEL;
}

/**
 * Marca corta del MISMO plan, para el chip del encabezado.
 *
 * Se deriva de `planLabel` a propósito: si hubiera un segundo `isPro === true`
 * suelto, el chip y el lector de pantalla podrían llegar a decir cosas
 * distintas sobre la misma cuenta.
 */
export function planMark(view: PlanView): "PLUS" | "FREE" {
  return planLabel(view) === PLAN_PLUS_LABEL ? "PLUS" : "FREE";
}

export type PlanSource = "remote" | "cache" | "unknown";

/** Qué hacer con el snapshot persistido después de esta decisión. */
export type PlanSnapshotAction = "keep" | "write" | "clear";

export type PlanDecision = {
  view: PlanView;
  /**
   * El backend confirmó el plan de la cuenta VIGENTE.
   *
   * Es lo único que habilita cobrar. Un snapshot cacheado nunca lo levanta: dice
   * cómo se llamaba el plan la última vez, no qué autoriza la tienda hoy.
   */
  resolved: boolean;
  source: PlanSource;
  snapshot: PlanSnapshotAction;
};

/**
 * Qué plan mostrar mientras el remoto no contesta.
 *
 * El agujero que cierra: al arrancar en frío, `subscriptions.getCurrent` tarda
 * y todo lo que leía el entitlement crudo publicaba "Free" en el intervalo. A
 * alguien que paga la app le decía, cada arranque, que no paga.
 *
 * La regla tiene un solo filo: **el snapshot sólo llena el hueco**.
 *
 * - Con respuesta remota —Free, Plus o `null`— manda el remoto y el snapshot se
 *   actualiza. Nunca al revés: un `lastConfirmed` de Plus no puede sobrevivir a
 *   un remoto que ya dijo Free, que es exactamente cómo una suscripción vencida
 *   se quedaría "activa" para siempre en esta pantalla.
 * - Sin respuesta remota se usa el último confirmado, y sólo si ya se leyó el
 *   disco (`hydrated`). Antes de eso la respuesta honesta es "no sé": publicar
 *   Free ahí es el parpadeo que se quería evitar.
 *
 * `remote` entra YA correlacionado con el dueño (`safeEntitlement`), y
 * `lastConfirmed` tiene que ser el snapshot de ESE mismo dueño.
 */
export function resolvePlanView(input: {
  remote: PlanView;
  lastConfirmed: ConfirmedPlan | null;
  hydrated: boolean;
}): PlanDecision {
  if (input.remote !== undefined) {
    return {
      view: input.remote,
      resolved: true,
      source: "remote",
      // `null` es "el backend no reconoce plan": borrar el snapshot evita que un
      // Plus viejo reviva en el próximo arranque en frío.
      snapshot: input.remote === null ? "clear" : "write"
    };
  }
  if (input.hydrated && input.lastConfirmed) {
    return { view: input.lastConfirmed, resolved: false, source: "cache", snapshot: "keep" };
  }
  return { view: undefined, resolved: false, source: "unknown", snapshot: "keep" };
}

/**
 * Snapshot del plan en disco: SIEMPRE con su dueño adentro.
 *
 * La clave ya va por cuenta, pero el dueño viaja también en el valor: una clave
 * mal formada o un valor movido de lugar no puede terminar mostrándole el plan
 * de A a B. Se guarda sólo `isPro`, no el entitlement entero: el proveedor, el
 * portal y la vida del cargo son decisiones de plata y ésas exigen el remoto.
 */
export type PlanSnapshot = { owner: string; isPro: boolean };

export function serializePlanSnapshot(snapshot: PlanSnapshot): string {
  return JSON.stringify({ owner: snapshot.owner, isPro: snapshot.isPro });
}

/**
 * Lee el snapshot para un dueño concreto.
 *
 * Devuelve `null` —"no hay snapshot"— ante cualquier duda: ilegible, sin dueño
 * vigente o de OTRA cuenta. Un snapshot que no se entiende no puede afirmar un
 * plan, y el costo de perderlo es un arranque que dice Free de más.
 */
export function parsePlanSnapshot(
  raw: string | null | undefined,
  owner: string | null | undefined
): ConfirmedPlan | null {
  if (!raw || !owner) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const { owner: dueño, isPro } = parsed as { owner?: unknown; isPro?: unknown };
    if (typeof dueño !== "string" || dueño !== owner) return null;
    if (typeof isPro !== "boolean") return null;
    return { isPro };
  } catch {
    return null;
  }
}

export type PersonalityPhase = "cargando" | "bloqueado" | "sinCarta" | "generando" | "error" | "listo";

/** `charts.personalityReadingState` suma `locked` al `pending | ready | error` previo. */
export function personalityPhase(input: {
  reading: unknown | null | undefined;
  state: { status: "pending" | "ready" | "error" | "locked" } | undefined;
  hasChart: boolean | undefined;
}): PersonalityPhase {
  // Una lectura ya recibida gana siempre: si el dato llegó, se muestra.
  if (input.reading !== null && input.reading !== undefined) return "listo";
  if (input.state === undefined || input.hasChart === undefined) return "cargando";
  if (input.state.status === "locked") return "bloqueado";
  if (!input.hasChart) return "sinCarta";
  if (input.state.status === "error") return "error";
  return "generando";
}
