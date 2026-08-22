import { TRIAD_VISIBLE_WAIT_MS } from "@/domain/triadTimeout";

/**
 * Timers inyectables, con la firma MÍNIMA que la superficie usa: los tests
 * conductuales pasan timers manuales sin arrastrar la sobrecarga completa de
 * `typeof setTimeout` de Node (`__promisify__` incluido).
 */
export type TriadSurfaceTimers = {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void;
};

/**
 * Orquestación PURA de la única superficie de cálculo de la tríada.
 *
 * La superficie es editorial y sin escapes manuales: mientras carga muestra
 * "Preparando tu carta…" (sin CTA); si el cálculo llega antes del techo
 * visible, la misma superficie se transforma en "Tu carta ya está lista" con
 * `Continuar`; al cumplirse el techo —o ante un error— el flujo AVANZA solo a
 * Antes/Después, sin pedir interacción y sin una pantalla técnica.
 *
 * Módulo sin React para poder demostrar el comportamiento con tests (timers
 * inyectables), no con regex de copy.
 */

export type TriadSurfaceStatus = "idle" | "loading" | "ready" | "timed_out" | "error";

/**
 * ¿Este estado avanza solo? `timed_out` y `error` nunca retienen el
 * onboarding: el flujo sigue a Antes/Después sin interacción. `ready` espera
 * el `Continuar` de la persona; `idle`/`loading` esperan al cálculo.
 */
export function triadAutoAdvances(status: TriadSurfaceStatus): boolean {
  return status === "timed_out" || status === "error";
}

/**
 * Observa UN cálculo de tríada contra el techo visible.
 *
 * Emite exactamente un resultado:
 * - `onReady(result)` si el cálculo llega antes del techo,
 * - `onTimedOut()` al cumplirse el techo con el cálculo todavía en vuelo,
 * - `onError(error)` si falla antes del techo.
 *
 * Una respuesta que llega DESPUÉS del techo (o después de `cancel()`) se
 * descarta: la superficie ya avanzó. Ese resultado no se "recupera" en
 * ninguna otra pantalla — lo que la Carta aprovecha después es la carta
 * PERSISTIDA que `Preparar mi carta` disparó en el servidor
 * (`charts.calculateOrCreateNatalChart`), que es un cálculo propio y
 * reintentable, no este.
 *
 * Devuelve `cancel`: silencia todo y limpia el timer (desmontaje o edición de
 * datos).
 */
export function observeTriadComputation<T>(args: {
  computation: Promise<T>;
  onReady: (result: T) => void;
  onTimedOut: () => void;
  onError: (error: unknown) => void;
  visibleWaitMs?: number;
  timers?: TriadSurfaceTimers;
}): () => void {
  const timers = args.timers ?? globalThis;
  const waitMs = args.visibleWaitMs ?? TRIAD_VISIBLE_WAIT_MS;
  let settled = false;
  let cancelled = false;

  const timer = timers.setTimeout(() => {
    if (settled || cancelled) return;
    settled = true;
    args.onTimedOut();
  }, waitMs);

  args.computation
    .then((result) => {
      if (settled || cancelled) return;
      settled = true;
      timers.clearTimeout(timer);
      args.onReady(result);
    })
    .catch((error) => {
      if (settled || cancelled) return;
      settled = true;
      timers.clearTimeout(timer);
      args.onError(error);
    });

  return () => {
    cancelled = true;
    timers.clearTimeout(timer);
  };
}
