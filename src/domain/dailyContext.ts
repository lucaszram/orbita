/**
 * Fecha canónica del día astrológico.
 *
 * La autoridad es el servidor: `daily.getTodayContext()` devuelve `localDate` y
 * `timezone` calculados desde la zona natal persistida. El cliente no calcula
 * el día ni lo deriva del navegador; antes cada pantalla armaba su propio
 * `todayLocalDate()` con `new Date()` local, así que dos superficies podían
 * pedir días distintos y viajar cambiaba la carta del ritual.
 *
 * El reloj del navegador sirve para UNA cosa: darse cuenta de que pasó la
 * medianoche y volver a preguntarle al servidor.
 */

export type DailyContext = { localDate: string; timezone: string };

export type DailyContextState =
  | { status: "idle" }
  | { status: "cargando" }
  | { status: "listo"; context: DailyContext; observedDate: string }
  | { status: "error" };

/**
 * Fecha civil que el navegador ve en una zona dada. NO es el día astrológico:
 * sólo se usa para detectar el cruce de medianoche. El servidor puede estar
 * legítimamente en otra fecha (por ejemplo con un ciclo ya abierto congelado
 * tras editar el lugar natal), y eso no es un desacuerdo a corregir.
 */
export function observedDateInTimezone(nowMs: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(nowMs));
  } catch {
    // Zona inválida: sin señal de medianoche fiable. Devolvemos un centinela
    // estable para no disparar refetches en loop.
    return "";
  }
}

export type RefetchReason = "primeraVez" | "cambioDeCuenta" | "medianoche" | "foreground" | null;

/**
 * Por qué habría que volver a pedir el contexto. Devuelve `null` cuando no
 * hace falta: el provider no debe refetchear por refrescos de render.
 */
export function refetchReason(input: {
  state: DailyContextState;
  /** Identidad de la sesión actual; cambia al entrar otra cuenta. */
  accountKey: string | null;
  /** Identidad con la que se pidió el contexto vigente. */
  fetchedForAccount: string | null;
  /** Fecha que el navegador ve AHORA en la zona del contexto vigente. */
  currentObserved: string;
  /** La app acaba de volver al frente. */
  cameToForeground: boolean;
}): RefetchReason {
  if (!input.accountKey) return null;
  if (input.state.status === "cargando") return null;
  if (input.state.status === "idle" || input.state.status === "error") return "primeraVez";
  if (input.fetchedForAccount !== input.accountKey) return "cambioDeCuenta";

  // Cruce de medianoche: comparamos contra lo que el navegador veía cuando se
  // pidió el contexto, nunca contra el `localDate` del servidor.
  if (input.currentObserved && input.currentObserved !== input.state.observedDate) {
    return "medianoche";
  }
  if (input.cameToForeground) return "foreground";
  return null;
}
