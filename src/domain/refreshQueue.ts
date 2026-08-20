/**
 * La cola del recálculo del día: un solo `refreshForDate` en vuelo, la
 * solicitud más reciente gana, y quien lo necesite puede ESPERAR el final.
 *
 * ## Por qué existe como módulo puro
 *
 * Vivía dentro de `useLayers`, entre `useRef` y `useCallback`, así que lo único
 * que se podía probar de ella era su forma: que existiera un ref usado como
 * mutex, que apareciera el nombre de la política de reintento. La concurrencia
 * —dos solicitudes en el mismo tick, un rechazo mientras otra espera turno, un
 * reintento transitorio que no puede pisar una solicitud más nueva, un desmonte
 * con alguien esperando— no se probaba. Acá se prueba de verdad, sin React y sin
 * simulador.
 *
 * ## Las reglas, que no cambian
 *
 * - **Single-flight por generación viva.** Dentro del ciclo de datos vivo nunca
 *   hay dos acciones. El mutex es el candado, no la clave del pedido: dos
 *   pedidos distintos y seguidos —medianoche justo cuando alguien toca
 *   reintentar— largaban dos acciones a la vez. Lo que **no** se puede
 *   garantizar —y por eso no se afirma— es que no haya dos acciones FÍSICAS
 *   vivas después de cerrar una generación: ver el ciclo de vida, más abajo.
 * - **La más reciente gana.** No es una fila: mientras una acción corre, se
 *   guarda como mucho UNA solicitud pendiente, y es la última que llegó.
 *   Recalcular el día con datos de hace dos cambios no le sirve a nadie.
 * - **La carrera del alta se reintenta sola.** `LAYER_INPUT_CHANGED_DURING_REFRESH`
 *   no es un error de la persona: el recálculo salió mientras los datos natales
 *   todavía se escribían. Unas pocas veces, con esperas crecientes. Cualquier
 *   otro error se informa de una.
 *
 * ## Lo que agrega
 *
 * `requestAndWait` devuelve una promesa que termina **con la solicitud**, no al
 * encolarla. La necesita la recuperación de la Carta: su ciclo real es calcular
 * la carta y DESPUÉS rearmar el día, y hasta que las dos mitades terminan el
 * botón tiene que seguir bloqueado. Con un `refresh()` que no se puede esperar,
 * el candado se soltaba en el medio y un segundo toque volvía a llamar la
 * action.
 *
 * Si ya hay una solicitud en vuelo, quien espera **no resuelve enseguida**: su
 * solicitud entra en la cola compartida —pisando la pendiente, como cualquier
 * otra— y la promesa termina cuando esa corrida termina. Nunca se abre una vía
 * paralela que duplique llamadas.
 *
 * ## Liveness: el ALCANCE releva a la corrida que ya no puede servir
 *
 * "La más reciente gana" describía la cola, no el progreso. El agujero:
 *
 * 1. A sale y **no resuelve nunca** (la red se cortó a mitad de la action);
 * 2. llegan B y después C, con otro alcance —otra cuenta, otro día civil, otra
 *    zona, otra hora civil, otro intento—;
 * 3. `drain()` estaba parado en `await deps.run(A)`, así que C quedaba
 *    `pending` **para siempre**: `busy` en `true`, `CALCULANDO…` permanente, y
 *    volver de background sólo movía el reloj y el intento sin destrabar nada.
 *
 * La regla que faltaba: **una corrida cuyo alcance ya no es el vigente no puede
 * seguir siendo dueña del ciclo**. Cuando llega una solicitud con un alcance
 * distinto del de la corrida viva, la cola hace un **relevo**: cierra la
 * generación —la corrida vieja queda huérfana, exactamente como con `suspend()`,
 * sin publicar flags ni resolver waiters— y arranca la solicitud pertinente más
 * nueva. No hay temporizador de por medio: el disparador es el cambio de
 * alcance, no el paso del tiempo, y por eso se prueba por comportamiento.
 *
 * El relevo se decide **al final del tick**, en una microtarea, no en el acto.
 * Es lo que hace que la secuencia física sea A/C y no A/B/C: B y C llegan en la
 * misma ráfaga, la pendiente ya es C cuando el relevo corre, y B se descarta
 * como intermedia sin haber largado nada. Y si la corrida vieja termina sola
 * dentro de ese mismo tick, el bucle toma la pendiente por el camino normal y el
 * relevo se encuentra sin nada que relevar.
 *
 * **El alcance lo declara quien pide.** La cola no lo inventa: sin alcance
 * declarado —o si la corrida viva no tenía ninguno— no releva nada y vale la
 * política de siempre. Quien lo declara es `./refreshCycle`, que ya lleva la
 * clave del último pedido admitido (`cuenta|día|zona|hora|intento`), o sea
 * exactamente los cinco ejes que hacen que un recálculo deje de servir.
 *
 * ## Ciclo de vida explícito: `suspend()` / `resume()`
 *
 * Una promesa de espera que nunca termina es peor que un error. El caso real:
 * la action queda colgada, el árbol se desmonta, y quien esperaba —la
 * recuperación de la Carta— se queda con el candado natal tomado y `CALCULANDO…`
 * para siempre, incluso después de volver a montar.
 *
 * `suspend()` es lo que el cleanup llama, y hace cuatro cosas:
 *
 * 1. **corta TODAS las esperas** —las atadas a la corrida en vuelo y las que
 *    esperaban turno— con `LAYERS_REFRESH_UNAVAILABLE`, que es un error estable
 *    y reconocible. Nadie queda pendiente para siempre;
 * 2. **desacopla la corrida vieja del ciclo nuevo.** No se cancela: una action
 *    Convex que ya salió no se puede cancelar, y fingir que sí sería mentir. Lo
 *    que se corta es su efecto: cuando termine, no publica flags, no resuelve
 *    waiters y no toca nada del ciclo que venga después;
 * 3. **suelta el candado del ciclo cerrado.** El mutex es un TOKEN de corrida,
 *    no un booleano global: al cerrar la generación, la corrida vieja deja de
 *    ser la dueña del ciclo vivo. Con el booleano, una action que no resolvía
 *    nunca dejaba el mutex tomado para siempre y `resume()` no podía arrancar
 *    nada: `CALCULANDO…` quedaba visible sin ningún trabajo que lo justificara;
 * 4. **conserva lo pendiente.** El trabajo que todavía no salió sobrevive, y
 *    `resume()` —el doble montaje de StrictMode, un remount real— lo retoma sin
 *    reutilizar ningún waiter huérfano.
 *
 * El relevo es esa misma maquinaria sin cerrar el ciclo de vida: avanza la
 * generación y suelta el candado, pero no suspende, no corta esperas —las
 * transfiere al trabajo vigente, como el backoff— y deja el `busy` prendido,
 * porque el ciclo vivo efectivamente sigue trabajando.
 *
 * ## El precio, dicho: una action física huérfana
 *
 * Después de `suspend()` —o de un relevo— puede haber DOS acciones físicas vivas
 * a la vez: la de la generación cerrada, que nadie puede cancelar, y la del
 * ciclo nuevo. No hay forma de tener las dos cosas —single-flight físico global
 * y progreso— si la primera no resuelve nunca; entre bloquear el ciclo nuevo
 * para siempre y admitir el solapamiento, se admite el solapamiento. La huérfana
 * no publica flags, no resuelve waiters, no toca `failed` y no reanima nada:
 * cuando termine, se descarta. Dentro de una MISMA generación viva sigue
 * habiendo una sola action, siempre.
 *
 * Cada relevo paga exactamente una huérfana más, y sólo cuando el alcance cambió
 * **y** la corrida anterior seguía viva. Es el mismo total de acciones que sin
 * relevo —A y C se ejecutan igual—, corriéndose en paralelo en vez de en fila:
 * lo que se compra con eso es que C no dependa de que A termine alguna vez.
 *
 * ## Y el pedido del ciclo cerrado no se pierde — ni se duplica
 *
 * Lo que estaba EN VUELO al suspender no se reencola acá: su efecto se descartó,
 * así que el ciclo nuevo necesita pedirlo de nuevo. Eso lo hace el consumidor,
 * y la regla exacta vive en `./refreshCycle`: la clave del último pedido
 * admitido se borra **sólo si no quedó nada pendiente**. Borrarla siempre —como
 * se hacía— duplicaba el trabajo: la cola conservaba B, `resume()` la retomaba,
 * y el efecto, viendo la clave en blanco, volvía a encolar la misma B.
 *
 * ## `busy` describe al ciclo VIVO, nunca a uno suspendido
 *
 * `request()` durante la suspensión ACEPTA la solicitud —la más reciente gana—
 * pero no publica nada: encender `CALCULANDO…` desde un ciclo cerrado es un
 * busy fantasma, trabajo que nadie está haciendo. `resume()` sincroniza el flag
 * con lo que la generación viva realmente va a hacer: `true` si hay trabajo que
 * toma, `false` si no hay ninguno.
 *
 * ## El presupuesto de reintentos es DEL TRABAJO, no de la cola
 *
 * El contador era global: si A gastaba los tres reintentos y B llegaba mientras
 * A dormía su backoff, B esperaba el resto de esa espera y su primer fallo se
 * contaba como intento 4 —sin ningún reintento propio—. Acá el intento pertenece
 * a la solicitud que se está ejecutando: una solicitud más nueva **despierta** el
 * backoff de la anterior (la espera es interrumpible, no una espera ciega),
 * corre enseguida después de la action vigente y arranca con su presupuesto
 * entero. Los waiters de la vieja se transfieren al trabajo vigente, porque lo
 * único que necesitan es que el refresco termine.
 *
 * ## Y una corrida que RESUELVE también puede haber fallado
 *
 * `refreshForDate` puede terminar bien y devolver igual un sobre `stale` porque
 * el proveedor de efemérides no contestó. Sin rechazo no hay clasificación, así
 * que el reintento automático no se enteraba y la pantalla se quedaba con el
 * cálculo de antes hasta que la persona tocara el botón. Ahora el resultado se
 * mira: si trae un sobre `stale` con un faltante de efeméride
 * (`isStaleEphemerisResult`), la corrida se reencauza como
 * `LAYER_STALE_EPHEMERIS` —transitorio— y recorre exactamente los mismos tres
 * reintentos. Cualquier otro sobre `stale`, y cualquier `unavailable`, siguen
 * contando como corrida terminada: repetirlos devolvería lo mismo.
 *
 * ## Y ninguna corrida espera para siempre
 *
 * La cola relevaba a una corrida colgada cuando llegaba algo con OTRO alcance,
 * pero si no llegaba nada la acción podía quedar en vuelo indefinidamente:
 * `CALCULANDO…` sin fallo, sin dato y sin nada que la persona pudiera hacer.
 * Ahora cada corrida tiene TOPE (`LAYER_REFRESH_TIMEOUT_MS`, 20 s): pasado ese
 * tiempo la ESPERA se corta con `LAYER_TIMEOUT_ERROR`, que es transitorio y por
 * lo tanto entra en los mismos tres reintentos. Si los tres se agotan, termina
 * como un fallo visible y fechado en vez de como un cuelgue mudo. La action
 * física no se cancela —no se puede, y fingirlo sería mentir—: lo que se corta
 * es la espera, que es lo que la pantalla necesita.
 */
import {
  classifyLayerError,
  isStaleEphemerisResult,
  isTransientLayerError,
  layerRetryDelay,
  withLayerTimeout,
  LAYER_STALE_EPHEMERIS_ERROR,
  type LayerRetryEvent,
  type TimeoutTimer
} from "./layerRetry";

/** El día civil y la zona con los que se pide el sobre. */
export type RefreshRequest = {
  localDate: string;
  timezone: string;
};

/**
 * El ALCANCE de una solicitud: la identidad completa de lo que se está pidiendo
 * (`cuenta|día|zona|hora civil|intento`). Dos solicitudes con el mismo alcance
 * son el mismo trabajo; con alcances distintos, la más nueva deja a la anterior
 * sin nada útil que devolver. `null` = quien pide no lo declara, y entonces la
 * cola no releva nada.
 */
export type RefreshScope = string | null;

/** El error con el que termina cualquier espera que ya no se puede atender. */
export const LAYERS_REFRESH_UNAVAILABLE = "LAYERS_REFRESH_UNAVAILABLE";

type Waiter = {
  resolve: () => void;
  reject: (error: unknown) => void;
  /** Una promesa se cumple una sola vez; la bandera lo hace explícito. */
  settled: boolean;
};

export type RefreshQueueDeps = {
  /** La acción real: `layers.refreshForDate`. */
  run: (request: RefreshRequest) => Promise<unknown>;
  /**
   * ¿Sigue vivo el ciclo de datos? Al desmontar, la cola deja de trabajar y de
   * publicar estado; lo pendiente se retoma con `resume()`.
   */
  alive: () => boolean;
  /** Hay trabajo en vuelo (o dejó de haberlo). */
  onBusyChange: (busy: boolean) => void;
  /** El último intento falló de verdad (o dejó de haber fallo). */
  onFailedChange: (failed: boolean) => void;
  /** Cuánto esperar antes del reintento automático número `intento`. */
  retryDelay?: (intento: number) => number | null;
  /** ¿Este rechazo se reintenta solo? */
  transient?: (error: unknown) => boolean;
  /** La espera entre reintentos automáticos. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Tope de la corrida. `0` lo apaga, y eso sólo tiene sentido en una prueba que
   * mide otra cosa: en la app una corrida sin tope puede no volver nunca.
   */
  timeoutMs?: number;
  /** Cómo se arma ese tope. Inyectable para probar el corte sin esperar 20 s. */
  timer?: TimeoutTimer;
  /**
   * ¿Este resultado RESUELTO es en realidad un fallo transitorio? Por defecto,
   * el sobre `stale` sin el cielo de hoy (`isStaleEphemerisResult`).
   */
  staleResult?: (result: unknown) => boolean;
  /**
   * Un intento falló. Llega ya clasificado y SIN el mensaje crudo: el texto de
   * un error de Convex puede traer el identificador de la persona o el request
   * id de su sesión, y para entender un incidente alcanza con el código.
   */
  onRetryEvent?: (event: LayerRetryEvent) => void;
};

export type RefreshQueue = {
  /**
   * Encola y sigue. Es lo que usan el reloj, el foreground y el botón de
   * reintento. `scope` es la identidad del pedido: si difiere de la de la
   * corrida viva, ésta queda relevada al final del tick.
   */
  request: (request: RefreshRequest, scope?: RefreshScope) => void;
  /** Encola y devuelve una promesa que termina CON la solicitud. */
  requestAndWait: (request: RefreshRequest, scope?: RefreshScope) => Promise<void>;
  /**
   * Cierra el ciclo de vida actual: corta todas las esperas con
   * `LAYERS_REFRESH_UNAVAILABLE` y desacopla la corrida en vuelo del estado.
   * Lo llama el cleanup del hook.
   */
  suspend: () => void;
  /** Retoma lo pendiente después de un desmonte (el doble montaje de StrictMode). */
  resume: () => void;
  /** Hay una acción viva ahora mismo **en el ciclo vivo**. Una acción huérfana
   *  de una generación cerrada no cuenta: ya no describe trabajo de nadie. */
  busy: () => boolean;
  /** Lo que espera turno, si algo espera. */
  pending: () => RefreshRequest | null;
  /** ¿El ciclo de vida está cerrado? */
  suspended: () => boolean;
  /**
   * ¿La cola ADMITE pedidos ahora mismo? Es la misma condición con la que
   * `requestAndWait` rechaza en el acto, expuesta para que quien lleva la clave
   * del último pedido admitido no anote un pedido que nunca se encoló.
   */
  accepts: () => boolean;
  /** El alcance de la corrida viva, si quien la pidió declaró alguno. */
  scope: () => RefreshScope;
  /** Cuántas promesas de espera siguen abiertas. */
  waiting: () => number;
  /**
   * Devuelve el crédito de reintentos automáticos. Un reintento explícito le
   * vuelve a dar tiempo a la carrera del alta en vez de rendirse en el primer
   * rechazo.
   */
  resetRetries: () => void;
};

const esperaReal = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * El final del tick actual, sin temporizadores: una microtarea. El relevo se
 * decide acá para que una ráfaga de solicitudes colapse en la última —A/C, no
 * A/B/C— y para que una corrida que termina sola en el mismo tick gane por el
 * camino normal.
 */
const finDelTick = (accion: () => void) => {
  void Promise.resolve().then(accion);
};

export function createRefreshQueue(deps: RefreshQueueDeps): RefreshQueue {
  const retryDelay = deps.retryDelay ?? layerRetryDelay;
  const transient = deps.transient ?? isTransientLayerError;
  const staleResult = deps.staleResult ?? isStaleEphemerisResult;
  const sleep = deps.sleep ?? esperaReal;
  const timeoutMs = deps.timeoutMs;
  const timer = deps.timer;

  /**
   * El mutex, como TOKEN y no como booleano.
   *
   * Vale el objeto de la corrida que es dueña del ciclo vivo, y `null` cuando no
   * hay ninguna. `suspend()` lo suelta aunque la action siga físicamente viva:
   * con un booleano global, una action que no resolvía nunca dejaba el mutex
   * tomado para siempre y el ciclo nuevo no podía arrancar. Y una corrida sólo
   * limpia al terminar si TODAVÍA es la dueña: la huérfana no puede apagar el
   * trabajo de la generación que la reemplazó.
   */
  let corridaActiva: object | null = null;
  /** La solicitud que espera turno; escribirla pisa la anterior a propósito. */
  let pending: RefreshRequest | null = null;
  /** El alcance de lo que espera turno, tal como lo declaró quien lo pidió. */
  let alcancePendiente: RefreshScope = null;
  /** El alcance de la corrida que es dueña del ciclo vivo. */
  let alcanceVivo: RefreshScope = null;
  /** Ya hay un relevo esperando el final del tick; no se programan dos. */
  let relevoProgramado = false;
  /** Quienes esperan a la PRÓXIMA solicitud que se tome de `pending`. */
  let waiters: Waiter[] = [];
  /** Quienes están atados a la corrida que está en vuelo AHORA. */
  let activos: Waiter[] = [];
  /** Reintentos automáticos ya gastados contra la carrera del alta. */
  let reintentos = 0;
  /**
   * La solicitud a la que pertenece ese crédito. Identidad, no contenido: una
   * solicitud NUEVA con la misma fecha sigue siendo otro trabajo y arranca con
   * el presupuesto entero.
   */
  let reintentoDe: RefreshRequest | null = null;
  /** El ciclo de vida está cerrado: no se trabaja ni se publica nada. */
  let suspendido = false;
  /**
   * Generación del ciclo de vida. `suspend()` y el relevo la avanzan, así que
   * una corrida que ya había salido puede terminar sin tocar el ciclo nuevo.
   */
  let generacion = 0;
  /** Despierta el backoff cuando llega algo más nuevo. */
  let despertador: (() => void) | null = null;

  const vivo = () => !suspendido && deps.alive();

  const cumplir = (waiter: Waiter) => {
    if (waiter.settled) return;
    waiter.settled = true;
    waiter.resolve();
  };
  const romper = (waiter: Waiter, error: unknown) => {
    if (waiter.settled) return;
    waiter.settled = true;
    waiter.reject(error);
  };

  /**
   * Corta las esperas que ya no se pueden atender: las de la corrida en vuelo y
   * las que esperaban turno.
   *
   * Quien espera tiene un candado tomado —la recuperación de la Carta lo
   * tiene— y dejarlo colgado para siempre mataría el botón, también después de
   * remontar.
   */
  const abortarEsperas = () => {
    const huerfanos = [...activos, ...waiters];
    activos = [];
    waiters = [];
    for (const waiter of huerfanos) romper(waiter, new Error(LAYERS_REFRESH_UNAVAILABLE));
  };

  /**
   * ¿La corrida viva quedó sin poder servir a nadie?
   *
   * Hace falta que las DOS partes declaren alcance: sin eso no hay forma de
   * saber si el trabajo nuevo reemplaza al viejo o simplemente lo sigue, y la
   * cola no inventa pertinencia.
   */
  const corridaSuperada = () =>
    corridaActiva !== null &&
    pending !== null &&
    alcanceVivo !== null &&
    alcancePendiente !== null &&
    alcanceVivo !== alcancePendiente;

  /**
   * El relevo: cierra la generación viva SIN suspender el ciclo.
   *
   * La corrida vieja queda huérfana —sigue físicamente viva, no se puede
   * cancelar, pero ya no publica flags, no resuelve waiters ni pisa el resultado
   * de la que viene—. Los waiters no se cortan: se transfieren al trabajo
   * vigente, igual que en el backoff, porque lo único que necesitan es que el
   * refresco de ahora termine.
   */
  const relevar = () => {
    generacion += 1;
    corridaActiva = null;
    alcanceVivo = null;
    waiters = [...activos, ...waiters];
    activos = [];
    // Si la corrida relevada estaba durmiendo un backoff, esto la despierta para
    // que salga del bucle en vez de reanimarse dentro de una generación cerrada.
    despertador?.();
  };

  /**
   * La espera del reintento automático, INTERRUMPIBLE.
   *
   * Una espera ciega de nueve segundos convierte a la solicitud más nueva en
   * rehén de la anterior. Acá cualquier `encolar` la despierta y el bucle vuelve
   * a mirar qué es lo que hay que correr.
   */
  const dormir = async (ms: number) => {
    let despertar: () => void = () => undefined;
    const interrumpible = new Promise<void>((resolve) => {
      despertar = resolve;
    });
    despertador = despertar;
    try {
      await Promise.race([sleep(ms), interrumpible]);
    } finally {
      if (despertador === despertar) despertador = null;
    }
  };

  const drain = async () => {
    if (corridaActiva) return;
    if (!pending) return;
    const token = {};
    corridaActiva = token;
    const gen = generacion;
    try {
      while (vivo() && generacion === gen && pending) {
        const next: RefreshRequest = pending;
        const alcance: RefreshScope = alcancePendiente;
        // Se toma ANTES de esperar: lo que llegue durante la acción se guarda
        // como pendiente nuevo en vez de perderse contra el que ya salió. Los
        // que esperan se toman en el MISMO instante, así que cada promesa queda
        // atada a la corrida que de verdad la va a atender.
        pending = null;
        alcancePendiente = null;
        alcanceVivo = alcance;
        // El crédito de reintentos pertenece a ESTE trabajo. Si lo que se toma
        // no es la misma solicitud que se estaba reintentando, el presupuesto
        // arranca entero: heredar los intentos gastados de otra dejaba a la
        // solicitud nueva sin ningún reintento propio.
        if (next !== reintentoDe) reintentos = 0;
        reintentoDe = null;
        const esperando = waiters;
        waiters = [];
        activos = esperando;
        try {
          // Con TOPE: si la action no vuelve, la espera se corta y el error
          // entra por el mismo camino que cualquier otro rechazo.
          const resultado = await withLayerTimeout(deps.run(next), { ms: timeoutMs, timer });
          // Una corrida de un ciclo ya cerrado —o relevada por un alcance más
          // nuevo— no publica nada ni resuelve a nadie: sus waiters ya
          // terminaron, o se transfirieron al trabajo vigente.
          if (generacion !== gen) break;
          // Terminar bien no es lo mismo que haber salido bien: un sobre `stale`
          // sin el cielo de hoy es un fallo que llegó como éxito. Se reencauza
          // acá, dentro del `try`, para que entre por el MISMO `catch` —y por la
          // misma política— que cualquier rechazo.
          if (staleResult(resultado)) throw new Error(LAYER_STALE_EPHEMERIS_ERROR);
          activos = [];
          if (deps.alive()) deps.onFailedChange(false);
          reintentos = 0;
          for (const waiter of esperando) cumplir(waiter);
        } catch (error) {
          if (generacion !== gen) break;
          activos = [];
          // La carrera del alta no es un error de la persona: el recálculo
          // salió mientras los datos natales todavía se escribían. Se reintenta
          // solo, unas pocas veces y con esperas crecientes, sin tocar la guarda
          // del backend. Mientras dura, la pantalla sigue diciendo que está
          // recalculando —no "falló"— y quien espera sigue esperando.
          const espera = transient(error) ? retryDelay(reintentos + 1) : null;
          // El log sale ANTES de decidir: lo que interesa registrar es que este
          // intento falló y qué se va a hacer, no sólo los que se reintentan.
          deps.onRetryEvent?.({
            operation: "layers.refreshForDate",
            kind: classifyLayerError(error),
            attempt: reintentos + 1,
            delayMs: espera
          });
          if (espera !== null && vivo()) {
            // Los waiters vuelven a la cola: lo único que necesitan es que el
            // refresco VIGENTE termine, sea el reintento o algo más nuevo.
            waiters = [...esperando, ...waiters];
            if (pending) {
              // Llegó algo más nuevo mientras corría: ese manda. No se espera el
              // backoff de la anterior ni se hereda su presupuesto gastado.
              reintentos = 0;
              reintentoDe = null;
              continue;
            }
            reintentos += 1;
            pending = next;
            // El reintento es el MISMO trabajo, así que conserva su alcance: si
            // se perdiera, una solicitud nueva no podría relevarlo.
            alcancePendiente = alcance;
            reintentoDe = next;
            await dormir(espera);
            continue;
          }
          // El sobre persistido sigue siendo válido para leer; lo que no se pudo
          // es actualizarlo. La pantalla lo dice en vez de disimularlo.
          reintentos = 0;
          reintentoDe = null;
          if (deps.alive()) deps.onFailedChange(true);
          for (const waiter of esperando) romper(waiter, error);
        }
      }
      // Recién con la cola vacía se apaga el hilandero: si quedaba algo
      // pendiente, seguimos recalculando y decirlo es lo honesto.
      if (generacion === gen) {
        if (vivo()) deps.onBusyChange(false);
        else abortarEsperas();
      }
    } finally {
      // Sólo limpia quien todavía es dueña. Una corrida huérfana —de una
      // generación que `suspend()` o un relevo cerraron— no puede soltar el
      // candado del ciclo nuevo ni apagar su trabajo al terminar.
      if (corridaActiva === token) {
        corridaActiva = null;
        alcanceVivo = null;
      }
    }
  };

  const programarRelevo = () => {
    if (relevoProgramado) return;
    relevoProgramado = true;
    finDelTick(() => {
      relevoProgramado = false;
      // Puede haberse resuelto solo: la corrida vieja terminó dentro del mismo
      // tick y el bucle ya tomó lo pendiente por el camino normal.
      if (!vivo() || !corridaSuperada()) return;
      relevar();
      void drain();
    });
  };

  /** ¿El ciclo VIVO tiene trabajo? Una corrida en vuelo o algo esperando turno. */
  const hayTrabajo = () => corridaActiva !== null || pending !== null;

  const encolar = (request: RefreshRequest, scope: RefreshScope) => {
    pending = request;
    alcancePendiente = scope;
    // Suspendida, la cola ACEPTA la solicitud —la más reciente gana, igual que
    // siempre— pero no publica NADA. Publicar `busy` acá encendía `CALCULANDO…`
    // por trabajo que ningún ciclo vivo estaba haciendo: la generación cerrada
    // no trabaja más, y la nueva todavía no existe. `resume()` publica el estado
    // real cuando el ciclo vivo toma esto.
    if (suspendido) return;
    deps.onBusyChange(true);
    // Si algo estaba durmiendo un backoff, esto lo despierta: la solicitud más
    // nueva no espera el resto de la espera de la anterior.
    despertador?.();
    // Y si la corrida viva ya no puede servir a nadie —su alcance dejó de ser el
    // vigente—, se la releva al final del tick en vez de esperarla para siempre.
    if (corridaSuperada()) programarRelevo();
    void drain();
  };

  return {
    busy: () => corridaActiva !== null,
    pending: () => pending,
    suspended: () => suspendido,
    accepts: () => vivo(),
    scope: () => alcanceVivo,
    waiting: () => activos.length + waiters.length,
    resetRetries: () => {
      reintentos = 0;
      reintentoDe = null;
    },
    suspend: () => {
      suspendido = true;
      // La generación avanza ANTES de cortar: lo que termine después ya no
      // pertenece a ningún ciclo vivo.
      generacion += 1;
      // Y el candado se suelta acá. La action sigue físicamente viva —no se
      // puede cancelar— pero deja de ser la dueña del ciclo: el ciclo nuevo
      // puede trabajar aunque ésta no resuelva nunca.
      corridaActiva = null;
      alcanceVivo = null;
      despertador?.();
      abortarEsperas();
      // El ciclo que se cierra no tiene trabajo vivo, por definición. Decir lo
      // contrario dejaría `CALCULANDO…` colgado de una corrida que ya no
      // pertenece a nadie.
      deps.onBusyChange(false);
    },
    resume: () => {
      suspendido = false;
      // El flag visible se SINCRONIZA con lo que el ciclo vivo va a hacer de
      // verdad: `true` sólo si hay trabajo que esta generación toma —lo que
      // quedó pendiente, o una corrida viva—, y `false` si no hay nada. Sin la
      // sincronización, una solicitud aceptada durante la suspensión dejaba
      // `CALCULANDO…` prendido o apagado según qué evento hubiera salido último.
      deps.onBusyChange(vivo() && hayTrabajo());
      void drain();
    },
    request: (request, scope) => encolar(request, scope ?? null),
    requestAndWait(request, scope) {
      // Sin ciclo de datos vivo no hay nada que recalcular, y devolver una
      // promesa que nunca termina dejaría el candado de quien espera tomado
      // para siempre. Se rechaza SIN encolar: quien lleve la clave del último
      // pedido admitido puede confiar en `accepts()` para no anotarlo.
      if (!vivo()) {
        return Promise.reject(new Error(LAYERS_REFRESH_UNAVAILABLE));
      }
      return new Promise<void>((resolve, reject) => {
        waiters.push({ resolve, reject, settled: false });
        encolar(request, scope ?? null);
      });
    }
  };
}
