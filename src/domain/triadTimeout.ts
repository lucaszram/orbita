/**
 * Techo del lado cliente para el cálculo de la tríada.
 *
 * `useAction` no falla cuando no hay conexión: Convex encola la llamada y la
 * promesa queda pendiente hasta que el socket vuelve. Sin este corte, la
 * pantalla de personalización se quedaba al 100% para siempre, sin error y sin
 * recuperación. Es deliberadamente MÁS ancho que el deadline del servidor —que
 * está acotado a `ONBOARDING_TRIAD_TIMEOUT_MAX_MS` (15s) justamente para
 * garantizarlo—: si el backend llega a tiempo, gana su error real, que es más
 * informativo que "sin respuesta".
 *
 * Módulo puro (sin React ni Convex) para poder testear el corte.
 */
export const TRIAD_CLIENT_TIMEOUT_MS = 20_000;

export const TRIAD_CLIENT_TIMEOUT_CODE = "ONBOARDING_TRIAD_CLIENT_TIMEOUT";

export type TimeoutTimers = {
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
};

/**
 * La promesa devuelta SIEMPRE se asienta dentro de `timeoutMs`, aunque la de
 * adentro nunca lo haga. El timer se limpia al asentarse, gane quien gane: en
 * React Native un timeout vivo dispara el warning de trabajo huérfano.
 */
export function withTriadTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = TRIAD_CLIENT_TIMEOUT_MS,
  timers: TimeoutTimers = globalThis
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_resolve, reject) => {
    timer = timers.setTimeout(() => {
      reject(new Error(`${TRIAD_CLIENT_TIMEOUT_CODE}: sin respuesta en ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
  });

  return Promise.race([promise, deadline]).finally(() => {
    if (timer !== undefined) timers.clearTimeout(timer);
  }) as Promise<T>;
}
