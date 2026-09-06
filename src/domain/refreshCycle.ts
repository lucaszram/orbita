/**
 * La costura entre la cola del recálculo y la CLAVE del último pedido admitido.
 *
 * ## Por qué existe como módulo aparte
 *
 * La cola (`./refreshQueue`) decide qué corre y cuándo; el hook decide QUÉ
 * pedir, y para no repetir un pedido idéntico se guarda la clave del último que
 * admitió (`cuenta|día|zona|hora|intento`). Las dos mitades son correctas por
 * separado y el defecto vivía justo en el medio, donde no había nada que probar:
 *
 * - A está en vuelo y B quedó como única pendiente;
 * - el cleanup del montaje llamaba `suspend()` —que CONSERVA lo pendiente— y
 *   además borraba la clave;
 * - al volver a montar, `resume()` tomaba B… y el efecto, viendo la clave
 *   borrada, volvía a encolar exactamente la misma B;
 * - resultado A/B/B. Si la B retomada salía bien y el duplicado fallaba,
 *   `refreshFailed` terminaba en `true` sobre datos frescos: la pantalla decía
 *   que el recálculo había fallado justo después de recalcular bien.
 *
 * ## La política, en una línea
 *
 * **La clave sobrevive exactamente cuando su pedido sobrevive.** Si al cerrar el
 * ciclo queda algo pendiente, la clave se conserva y el ciclo nuevo no lo
 * duplica; si no queda nada —el pedido ya había salido y su corrida quedó
 * huérfana—, la clave se borra para que el ciclo nuevo lo vuelva a pedir. Eso es
 * `claveTrasCerrar`, y es lo único que hace falta decidir.
 *
 * Un cambio real de alcance —otro día civil, otra zona, otra cuenta— produce una
 * clave DISTINTA, así que entra por el camino normal: se encola, y lo que quedó
 * pendiente se retoma igual. Nada se duplica y nada se pierde.
 *
 * ## Lo que NO cambia
 *
 * Esto no reintroduce el single-flight físico global: la semántica sigue siendo
 * single-flight por generación viva, con la action huérfana admitida y sin
 * efectos (ver `./refreshQueue`). Acá sólo se decide qué se vuelve a PEDIR.
 *
 * ## La clave es también el ALCANCE, y sólo vale si el pedido fue admitido
 *
 * La misma clave que evita repetir un pedido idéntico es la identidad con la que
 * la cola decide si la corrida viva quedó superada: `cuenta|día|zona|hora|intento`
 * son exactamente los cinco ejes que hacen que un recálculo en vuelo deje de
 * poder servir. Por eso viaja con cada pedido (`cola.request(request, clave)`) y
 * por eso una action colgada no puede bloquear a la solicitud pertinente más
 * nueva: la cola la releva.
 *
 * Y de ahí sale la segunda regla: **la clave sólo puede representar un pedido que
 * la cola ADMITIÓ**. `pedirYEsperar` la escribía antes de llamar a
 * `requestAndWait`, que con el ciclo suspendido rechaza en el acto y sin encolar
 * nada. La clave quedaba anotada por un pedido que nunca salió, así que al
 * reabrir el efecto la veía como propia y se salteaba el refresco: la pantalla se
 * quedaba con el sobre viejo sin nada en vuelo que lo arreglara. `cola.accepts()`
 * es la misma condición con la que `requestAndWait` decide, y se consulta en el
 * mismo instante sincrónico en que se escribe la clave.
 *
 * ## El INTENTO vive acá, y la vía forzada lo RESERVA antes de encolar
 *
 * Faltaba una tercera regla, y sin ella la vía esperable quedaba detrás de una
 * action colgada **del mismo alcance**:
 *
 * 1. el refresco automático A está en vuelo y no resuelve;
 * 2. la recuperación natal termina de calcular la carta y llama
 *    `refreshAndWait()` para el MISMO usuario, día, zona y hora;
 * 3. el hook armaba la clave con el `attempt` que tenía en la mano —estado de
 *    React, que en el mismo tick todavía vale lo mismo—;
 * 4. `pedirYEsperar` encolaba esa clave IDÉNTICA;
 * 5. la cola sólo releva cuando el alcance cambia, así que A seguía siendo la
 *    dueña, B quedaba pendiente para siempre y el waiter —con el candado natal
 *    tomado— no terminaba nunca.
 *
 * `setAttempt(v => v + 1)` no lo arregla: el estado de React no cambia en el
 * mismo tick, y la clave se arma antes de cualquier render. Por eso el contador
 * **vive acá**, en una sola fuente de verdad, y `pedirYEsperar` no recibe una
 * clave ya armada sino **cómo armarla**: reserva el intento siguiente y se la
 * pide a quien llama con ESE número. Es imposible encolar un pedido esperable
 * con un intento viejo, porque quien llama no elige el intento.
 *
 * El nonce es monótono: dos `pedirYEsperar` del mismo tick reservan números
 * distintos, así que el segundo también releva al primero en vez de esperarlo.
 *
 * **La vía automática no cambia.** `pedir(clave, …)` con una clave idéntica sigue
 * sin encolar nada: la deduplicación del reloj es correcta y no se toca. La
 * semántica distinta es deliberada y vale sólo para la vía forzada
 * (`refreshAndWait()` y la recuperación de la Carta), que por definición pide
 * trabajo NUEVO sobre datos que acaban de cambiar.
 *
 * Y como el efecto del reloj arma su clave con el intento VIGENTE del ciclo
 * —`intento()`, no una copia en estado de React—, el render que viene después de
 * la reserva produce exactamente la clave ya anotada y no encola un duplicado.
 */
import type { RefreshQueue, RefreshRequest } from "./refreshQueue";

/**
 * Los cinco ejes del ALCANCE de un recálculo. Cambiar cualquiera de ellos hace
 * que lo que está en vuelo deje de servir.
 */
export type RefreshScopeParts = {
  /** La cuenta viva. */
  cuenta: string;
  /** Día civil `YYYY-MM-DD` del aparato. */
  localDate: string;
  /** Zona IANA del aparato. */
  timezone: string;
  /** Balde de una hora `YYYY-MM-DDTHH`: acota la caché a una hora. */
  civilHour: string;
  /** El nonce del intento, reservado por el ciclo. */
  intento: number;
};

/**
 * La clave/alcance, armada en UN solo lugar.
 *
 * Las dos vías —el efecto del reloj y el reintento esperable— tienen que
 * producir exactamente la misma cadena para los mismos datos: de eso depende que
 * el efecto posterior a una reserva reconozca el pedido como propio y no lo
 * duplique. Con la plantilla repetida a mano en dos archivos, esa igualdad era
 * una coincidencia; acá es el mismo código.
 */
export function claveDeAlcance({
  cuenta,
  localDate,
  timezone,
  civilHour,
  intento
}: RefreshScopeParts): string {
  return `${cuenta}|${localDate}|${timezone}|${civilHour}|${intento}`;
}

/**
 * Qué queda de la clave del último pedido admitido cuando el ciclo se cierra.
 *
 * `pendiente` es lo que la cola conserva DESPUÉS de `suspend()`. Con algo
 * pendiente la clave se conserva —el ciclo nuevo lo va a retomar solo, y volver
 * a pedirlo sería la corrida duplicada—; sin nada pendiente se borra, porque lo
 * que había quedó huérfano y nadie lo va a retomar.
 */
export function claveTrasCerrar(clave: string | null, pendiente: RefreshRequest | null): string | null {
  return pendiente ? clave : null;
}

export type RefreshCycle = {
  /** La cola compartida, para lo que el hook necesita directamente. */
  cola: RefreshQueue;
  /** El setup del montaje: retoma lo que haya quedado pendiente. */
  abrir: () => void;
  /** El cleanup del montaje: cierra el ciclo y resuelve la clave. */
  cerrar: () => void;
  /** El efecto del reloj: encola sólo si la clave cambió. */
  pedir: (clave: string, request: RefreshRequest) => void;
  /**
   * El reintento esperable/FORZADO.
   *
   * No recibe una clave ya armada sino cómo armarla: reserva sincrónicamente el
   * intento siguiente y llama a `clave` con ese número, en el mismo instante en
   * que encola. Así la vía forzada nunca puede pedir el alcance que ya está en
   * vuelo, ni siquiera cuando nada más cambió. `clave(intento) === null` = no hay
   * alcance que anotar (sin cuenta), y entonces sólo se encola.
   */
  pedirYEsperar: (clave: (intento: number) => string | null, request: RefreshRequest) => Promise<void>;
  /**
   * Reserva el intento siguiente y lo devuelve. Es lo que usan el botón de
   * reintento y el regreso del background: cambian el alcance para que la cola
   * releve a una corrida que ya no puede servir.
   */
  reservarIntento: () => number;
  /** El intento vigente: el último reservado. Fuente de verdad única del nonce. */
  intento: () => number;
  /** La clave del último pedido admitido. `null` = no hay ninguno vigente. */
  clave: () => string | null;
};

/** La costura, sin React, para poder probar el interleaving de verdad. */
export function createRefreshCycle(cola: RefreshQueue): RefreshCycle {
  let clave: string | null = null;
  /**
   * El contador de intentos. Vive acá y en ningún otro lado: el estado de React
   * es sólo un espejo con el que el efecto vuelve a correr, nunca la fuente. Es
   * monótono, así que dos reservas nunca producen el mismo nonce.
   */
  let intento = 0;

  const reservar = () => {
    intento += 1;
    return intento;
  };

  return {
    cola,
    clave: () => clave,
    intento: () => intento,
    reservarIntento: reservar,
    abrir: () => cola.resume(),
    cerrar: () => {
      cola.suspend();
      // El orden importa: `suspend()` conserva lo pendiente, así que recién
      // después se puede preguntar si quedó algo que el ciclo nuevo va a
      // retomar por su cuenta.
      clave = claveTrasCerrar(clave, cola.pending());
    },
    pedir: (siguiente, request) => {
      if (clave === siguiente) return;
      clave = siguiente;
      // La clave viaja con el pedido: es el ALCANCE con el que la cola decide si
      // la corrida viva todavía puede servir a alguien o hay que relevarla.
      cola.request(request, siguiente);
    },
    pedirYEsperar: (construirClave, request) => {
      // La reserva es lo PRIMERO y es sincrónica: el alcance que se va a encolar
      // ya no puede ser el de la corrida en vuelo, aunque no haya cambiado
      // ninguno de los otros cuatro ejes. Sin esto, la recuperación natal pedía
      // exactamente el alcance de la action colgada y quedaba detrás de ella.
      //
      // El intento se consume aunque el pedido no se admita: el contador nunca
      // vuelve atrás, y así ningún pedido posterior puede reusar este nonce.
      const siguiente = construirClave(reservar());
      // La clave sólo puede representar un pedido ADMITIDO. Con el ciclo
      // suspendido, `requestAndWait` rechaza EN EL ACTO y sin encolar nada:
      // anotar la clave igual la envenenaba, porque al reabrir el efecto veía su
      // propio pedido como ya hecho y lo salteaba, aunque nunca hubiera corrido.
      // Las tres operaciones son sincrónicas y contiguas: nada se intercala
      // entre reservar, preguntar y encolar.
      const admitido = cola.accepts();
      if (siguiente !== null && admitido) clave = siguiente;
      return cola.requestAndWait(request, siguiente);
    }
  };
}
