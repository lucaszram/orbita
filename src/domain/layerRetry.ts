/**
 * Política de reintento del recálculo de capas.
 *
 * Hay un fallo que NO es un error de la persona ni de la red: al terminar el
 * alta, el primer `layers.refreshForDate` sale mientras los datos natales
 * todavía se están escribiendo, y el backend lo aborta a propósito con
 * `LAYER_INPUT_CHANGED_DURING_REFRESH`. Esa guarda es correcta —persistir un
 * cálculo hecho sobre una entrada que ya cambió sería peor— y no se toca.
 *
 * Lo que estaba mal era el cliente: dejaba la pantalla en "no pudimos
 * actualizar" y sólo se recuperaba relanzando la app. Acá se declara la regla
 * que lo arregla: ese error concreto se reintenta solo, unas pocas veces, con
 * esperas crecientes; cualquier otro error se informa de una y espera el
 * reintento de la persona.
 *
 * ## Y el fallo que no es un error: la acción que no vuelve
 *
 * Una action de Convex que sale y nunca resuelve deja `CALCULANDO…` para
 * siempre: no hay rechazo que clasificar, así que no hay reintento, no hay
 * aviso y no hay nada que la persona pueda hacer. Por eso el recálculo tiene un
 * TOPE (`LAYER_REFRESH_TIMEOUT_MS`): pasado ese tiempo la espera se corta con
 * `LAYER_TIMEOUT_ERROR`, que se trata como transitorio —es exactamente el tipo
 * de fallo que conviene reintentar— y, si los tres reintentos se agotan, termina
 * como un fallo visible y fechado en vez de como un cuelgue mudo.
 *
 * ## Y el fallo que RESUELVE: el sobre sin el cielo de hoy
 *
 * `layers.refreshForDate` puede terminar BIEN y devolver igual un sobre `stale`
 * cuyo faltante declarado es `current_ephemeris` (o `fresh_ephemeris`): el
 * proveedor de efemérides no contestó y el backend, en vez de romper, persistió
 * el último cálculo válido. No hay rechazo que clasificar, así que la política
 * de reintentos no se enteraba: la pantalla quedaba con el dato de antes y sin
 * ningún intento más hasta que la persona tocara el botón.
 *
 * `isStaleEphemerisResult` es el detector de ESE caso —y sólo de ése—. Un sobre
 * `stale` por cualquier otro motivo no se reintenta (repetirlo devuelve lo
 * mismo), y `unavailable` tampoco: ahí no hay dato porque falta una entrada, no
 * porque el cielo no llegó. Cuando el detector dice que sí, el resultado se
 * reencauza como `LAYER_STALE_EPHEMERIS`, que es transitorio y entra por el
 * mismo camino que todo lo demás: 1500/4500/9000 ms y tope de 20 s.
 *
 * ## Qué NO se reintenta
 *
 * Autenticación, validación de argumentos y datos natales faltantes. Los tres
 * son estables: repetir la misma llamada devuelve el mismo error, así que
 * reintentar sólo agrega tres esperas antes de decir lo mismo. Se clasifican por
 * el texto que publica el backend porque es lo único que cruza el límite de
 * Convex, y la clasificación es la que decide —nunca la pantalla—.
 *
 * ## Los logs no llevan PII
 *
 * El mensaje crudo de un error puede traer el identificador de la persona, su
 * fecha de nacimiento o la zona en la que está. Lo que se registra es el CÓDIGO
 * clasificado, el número de intento y la espera: alcanza para entender un
 * incidente y no hay nada ahí que identifique a nadie.
 *
 * Es un módulo puro para poder probarlo sin simulador.
 */

/** El error que publica la guarda del backend cuando la entrada cambió. */
export const LAYER_RACE_ERROR = "LAYER_INPUT_CHANGED_DURING_REFRESH";

/** El error con el que se corta una acción que superó el tope de espera. */
export const LAYER_TIMEOUT_ERROR = "LAYER_REFRESH_TIMEOUT";

/**
 * El código con el que un resultado RESUELTO —pero sin el cielo de hoy— entra en
 * la política de reintentos. No lo publica el backend: lo fabrica el cliente al
 * reconocer el sobre, para que un fallo que llegó como éxito recorra exactamente
 * el mismo camino que un rechazo.
 */
export const LAYER_STALE_EPHEMERIS_ERROR = "LAYER_STALE_EPHEMERIS";

/**
 * Los faltantes con los que el backend declara que no pudo traer el cielo.
 *
 * Son los dos códigos que `convex/layers.ts` publica cuando el proveedor de
 * efemérides no contestó (`current_ephemeris` en el día y en los tránsitos,
 * `fresh_ephemeris` en el Cumpleluna). Cualquier otro faltante describe una
 * entrada que falta —datos natales, hora exacta, geometría verificada— y esa no
 * se arregla repitiendo la llamada.
 */
export const STALE_EPHEMERIS_INPUTS: readonly string[] = ["current_ephemeris", "fresh_ephemeris"];

/**
 * Cuánto se espera, como máximo, a que el recálculo vuelva.
 *
 * Veinte segundos: por encima del peor caso razonable de una action que pega al
 * proveedor de efemérides y muy por debajo de lo que una persona tolera mirando
 * un spinner sin saber si algo sigue pasando.
 */
export const LAYER_REFRESH_TIMEOUT_MS = 20_000;

/**
 * Esperas del reintento automático, en orden. Tres intentos y ~15 s en total:
 * alcanza para que el alta termine de escribir sus datos y no convierte un
 * backend caído en un bucle.
 */
export const LAYER_RETRY_DELAYS_MS: readonly number[] = [1500, 4500, 9000];

/** Cuántos reintentos automáticos hay, dicho una sola vez. */
export const LAYER_MAX_RETRIES = LAYER_RETRY_DELAYS_MS.length;

/**
 * Qué clase de fallo es. `transient` es lo único que se reintenta solo.
 *
 * - `transient` — la carrera del alta y el corte por tope de espera;
 * - `auth` — no hay sesión, o la fila `users` no existe todavía;
 * - `validation` — los argumentos no son los que el backend acepta;
 * - `natal` — faltan (o cambiaron) los datos de nacimiento;
 * - `unknown` — cualquier otra cosa: se informa de una, sin reintentar.
 */
export type LayerErrorKind = "transient" | "auth" | "validation" | "natal" | "unknown";

/**
 * Los textos con los que el backend publica cada clase.
 *
 * Se compara por INCLUSIÓN, no por igualdad, porque Convex antepone su propio
 * encabezado (`[Request ID: …] Server Error …`). El orden importa: `transient`
 * se mira primero para que un código explícito gane sobre cualquier coincidencia
 * de frase.
 */
const ERROR_SIGNATURES: readonly { kind: LayerErrorKind; needles: readonly string[] }[] = [
  {
    kind: "transient",
    needles: [LAYER_RACE_ERROR, LAYER_TIMEOUT_ERROR, LAYER_STALE_EPHEMERIS_ERROR]
  },
  { kind: "auth", needles: ["Authentication required", "User record not found"] },
  {
    kind: "natal",
    needles: [
      "Birth data not found",
      "Natal chart not found",
      "Natal ephemeris requires birth data",
      "Natal ephemeris does not match"
    ]
  },
  {
    kind: "validation",
    needles: [
      "localDate must",
      "A valid IANA timezone is required",
      "arcId must",
      "must match the server-captured instant"
    ]
  }
];

/** El texto de un error, venga como `Error`, como string o como cualquier cosa. */
function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error ?? "");
}

/**
 * Qué clase de fallo es este rechazo.
 *
 * Mirar el texto es lo único posible del lado del cliente: la action lanza un
 * `Error` y lo que llega es su mensaje. Lo que NO se hace es adivinar: un
 * mensaje que no coincide con ninguna firma es `unknown`, y `unknown` no se
 * reintenta.
 */
export function classifyLayerError(error: unknown): LayerErrorKind {
  const message = errorText(error);
  for (const { kind, needles } of ERROR_SIGNATURES) {
    if (needles.some((needle) => message.includes(needle))) return kind;
  }
  return "unknown";
}

/**
 * ¿Este error se reintenta solo?
 *
 * Sólo la clase `transient`: la carrera del alta y el corte por tope de espera.
 * Todo lo demás —sesión, argumentos, datos natales, desconocido— se informa de
 * una: repetir la misma llamada devolvería el mismo error.
 */
export function isTransientLayerError(error: unknown): boolean {
  return classifyLayerError(error) === "transient";
}

// ---------------------------------------------------------------------------
// El detector del resultado que RESUELVE mal
// ---------------------------------------------------------------------------

/**
 * Hasta dónde se busca el sobre dentro del resultado.
 *
 * El bundle del día anida en dos niveles (`bundle.today.transitArc`) y el sobre
 * de un arco viene suelto; seis alcanza de sobra para las dos formas y para
 * cualquier grupo que el contrato agregue, sin recorrer un `data` grande entero
 * cuando la respuesta ya está más arriba.
 */
const MAX_DEPTH = 6;

/**
 * ¿Este resultado RESUELTO es en realidad un fallo transitorio?
 *
 * Devuelve `true` sólo cuando el resultado trae al menos un sobre que declara
 * las DOS cosas a la vez: `status === "stale"` **y** un faltante de efeméride
 * (`current_ephemeris` / `fresh_ephemeris`). Ese par significa una cosa
 * concreta: el cálculo existe pero es el de antes, porque el cielo de hoy no se
 * pudo traer — y eso sí se arregla volviendo a pedirlo.
 *
 * Lo que NO cuenta, a propósito:
 *
 * - un sobre `stale` por cualquier otro faltante: no llegó el cielo no es lo
 *   mismo que falta la hora de nacimiento, y lo segundo devuelve idéntico en el
 *   segundo intento;
 * - un sobre `unavailable` o `error`: ahí no hay dato porque falta una entrada,
 *   y la pantalla ya lo dice con su propio bloque;
 * - un resultado que no es un objeto: `undefined`, un número, un texto.
 *
 * Se lee ESTRUCTURALMENTE —no por el tipo— porque el mismo detector tiene que
 * servir para el bundle entero (`refreshForDate`, con sus sobres anidados) y
 * para un sobre suelto (`refreshTransitArc`), y porque un cache viejo puede no
 * traer todas las claves. Es puro y sin reloj: entra el resultado, sale un sí o
 * un no.
 */
export function isStaleEphemerisResult(result: unknown): boolean {
  return buscarSobreSinCielo(result, 0, new Set<object>());
}

function buscarSobreSinCielo(value: unknown, depth: number, vistos: Set<object>): boolean {
  if (!value || typeof value !== "object") return false;
  if (depth > MAX_DEPTH) return false;
  // Un grafo con ciclos no debería llegar acá —esto viene de JSON— pero un
  // recorrido que se cuelga sería peor que el defecto que estamos cerrando.
  if (vistos.has(value)) return false;
  vistos.add(value);
  if (Array.isArray(value)) {
    return value.some((item) => buscarSobreSinCielo(item, depth + 1, vistos));
  }
  const bruto = value as Record<string, unknown>;
  if (esSobreSinCielo(bruto)) return true;
  return Object.values(bruto).some((item) => buscarSobreSinCielo(item, depth + 1, vistos));
}

/** El par que define el caso: `stale` **y** un faltante de efeméride. */
function esSobreSinCielo(bruto: Record<string, unknown>): boolean {
  if (bruto.status !== "stale") return false;
  const faltantes = bruto.missingInputs;
  if (!Array.isArray(faltantes)) return false;
  return faltantes.some(
    (code) => typeof code === "string" && STALE_EPHEMERIS_INPUTS.includes(code)
  );
}

/**
 * Cuánto esperar antes del intento número `attempt` (1 = primer reintento), o
 * `null` cuando ya no quedan reintentos automáticos y hay que decirlo.
 */
export function layerRetryDelay(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 1) return null;
  return LAYER_RETRY_DELAYS_MS[attempt - 1] ?? null;
}

/**
 * Cómo se arma la espera del tope. Inyectable para poder probar el corte sin
 * esperar veinte segundos de verdad; devuelve la función que la cancela.
 */
export type TimeoutTimer = (ms: number, onTimeout: () => void) => () => void;

const temporizadorReal: TimeoutTimer = (ms, onTimeout) => {
  const id = setTimeout(onTimeout, ms);
  // En Node el timer mantiene vivo el proceso; en React Native `id` es un número
  // y esto no existe. Sin el `unref`, un tope de 20 s que nadie llega a cancelar
  // deja la suite esperando al final de la corrida.
  (id as unknown as { unref?: () => void })?.unref?.();
  return () => clearTimeout(id);
};

/**
 * La misma promesa, pero con TOPE: si el trabajo no termina en `ms`, la espera
 * se corta con `LAYER_TIMEOUT_ERROR`.
 *
 * Lo que NO hace —porque no se puede— es cancelar la action: una llamada de
 * Convex que ya salió sigue viva del otro lado. Lo que se corta es la ESPERA, y
 * con eso alcanza: el error entra en la política de reintentos como cualquier
 * otro y la pantalla deja de depender de que la acción vuelva alguna vez.
 *
 * El timer se cancela apenas el trabajo termina, gane quien gane la carrera.
 */
export function withLayerTimeout<T>(
  work: Promise<T>,
  options: { ms?: number; timer?: TimeoutTimer } = {}
): Promise<T> {
  const ms = options.ms ?? LAYER_REFRESH_TIMEOUT_MS;
  if (!Number.isFinite(ms) || ms <= 0) return work;
  const timer = options.timer ?? temporizadorReal;
  return new Promise<T>((resolve, reject) => {
    const cancelar = timer(ms, () => reject(new Error(LAYER_TIMEOUT_ERROR)));
    work.then(
      (value) => {
        cancelar();
        resolve(value);
      },
      (error) => {
        cancelar();
        reject(error);
      }
    );
  });
}

/** Un intento fallido, ya sin nada que identifique a nadie. */
export type LayerRetryEvent = {
  /** Qué operación falló (`layers.refreshForDate`, `layers.refreshTransitArc`). */
  operation: string;
  kind: LayerErrorKind;
  /** Número de intento fallido, empezando en 1. */
  attempt: number;
  /** La espera hasta el próximo intento, o `null` si no hay otro. */
  delayMs: number | null;
};

/**
 * La línea de log de un intento fallido, SIN PII.
 *
 * Lo que entra es la clasificación, no el mensaje: el texto crudo de un error de
 * Convex puede traer el identificador de la persona o el request id de su
 * sesión, y nada de eso hace falta para entender qué pasó. Devuelve la línea en
 * vez de escribirla para que la decisión de dónde se escribe sea de quien llama
 * —y para poder probar el texto sin capturar la consola—.
 */
export function layerRetryLogLine(event: LayerRetryEvent): string {
  const partes = [
    "[orbita] layers",
    `op=${event.operation}`,
    `motivo=${event.kind}`,
    `intento=${event.attempt}`,
    event.delayMs === null ? "reintento=no" : `reintento_en_ms=${event.delayMs}`
  ];
  return partes.join(" ");
}
