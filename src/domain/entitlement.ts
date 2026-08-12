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
export function recepcionCta(input: { entitlement: Entitlement; live: boolean }): RecepcionCta {
  if (!input.live) return "entrar";
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
