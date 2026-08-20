/**
 * La recuperación de la Carta natal, resuelta sin React y en un solo lugar.
 *
 * ## El defecto que cierra
 *
 * `natalChartState` declara `recovery: "reintentar"` cuando la carta está
 * publicada pero le falta geometría calculable —los ejes verificados, las doce
 * cúspides—. Las dos pantallas de Carta cableaban ese botón a
 * `useLayers().refresh`, que ejecuta `layers.refreshForDate` y **nada más**.
 *
 * Ese recálculo rearma las capas del día y la efeméride natal canónica, pero la
 * geometría —Ascendente, Medio Cielo y casas— sale de la carta persistida en
 * `natalCharts`, y la única operación que la escribe es la del cálculo natal.
 * Tocar "COMPROBAR DE NUEVO" repetía el cálculo de capas para siempre sin
 * generar nunca la carta que falta.
 *
 * ## Qué hace la recuperación
 *
 * Las dos cosas, en este orden y siempre el mismo:
 *
 * 1. `charts.recoverNatalChart({})` — calcula y escribe la carta natal, y dice
 *    si de verdad quedó publicable. El read-model `layers.getNatalChartBase` es
 *    una query reactiva, así que las pantallas ven el resultado sin pedir nada.
 * 2. `layers.refreshForDate` (vía `useLayers().refreshAndWait`) — las capas del
 *    día se arman con esa geometría, y el sobre guardado quedó calculado sin
 *    ella.
 *
 * El orden importa: `layers.persistRefresh` rechaza con
 * `LAYER_INPUT_CHANGED_DURING_REFRESH` un refresco que salió antes de que la
 * carta cambiara. Calcular primero y recalcular después es lo que evita esa
 * carrera; al revés, el refresco se perdería contra su propia causa.
 *
 * ## El ciclo completo vive bajo el MISMO candado
 *
 * Las dos mitades son un solo trabajo, y hasta que las dos terminan el botón
 * tiene que seguir bloqueado. Antes el recálculo del día se disparaba sin
 * esperarlo: el candado se soltaba en el medio, la fase pasaba a `quieto`
 * mientras el refresco todavía ni había salido, y un segundo toque volvía a
 * llamar la operación de cálculo. Ahora `recalcularCapas` es esperable —la misma
 * cola de `useLayers`, no una acción paralela— y el candado se libera recién
 * cuando termina.
 *
 * ## Éxito no es "la llamada volvió"
 *
 * `calcular()` devuelve `false` cuando el proveedor respondió pero la carta
 * SIGUE sin la geometría que este estado pedía. Eso no es un éxito: no hay nada
 * nuevo con lo que rearmar el día, así que el día no se recalcula y la fase
 * queda en `fallo`, con la carta parcial intacta y el reintento disponible.
 *
 * ## Dos preguntas distintas, dos predicados distintos
 *
 * `mismoAlcance()` dice si el trabajo sigue siendo de esta pantalla —montado,
 * misma cuenta, misma carta—. `falloVigente()` dice si un error todavía
 * describe algo —lo anterior, y además que la salida siga siendo `reintentar`—.
 *
 * Eran uno solo, y por eso un éxito podía saltear el refresco del día: la salida
 * viene de una query REACTIVA, así que un cálculo que funciona la mueve a
 * `ninguna` antes de que su propia continuación corra. El predicado único
 * respondía "no" y el ciclo terminaba sin rearmar el sobre, que es precisamente
 * la mitad que faltaba hacer. Ahora el refresco depende del alcance —que no
 * cambió— y el aviso de fallo, de que el reintento siga siendo la salida.
 *
 * ## Por qué es un store y no un `useState`
 *
 * - **Single-flight sincrónico.** El candado es `createExclusiveGate`, el mismo
 *   que el editor y Vínculos: dos toques del mismo render ven el mismo objeto y
 *   sólo uno entra. Un `useState` de "calculando" se aplica en el render
 *   siguiente y los dos toques pasarían.
 * - **Compartido entre pantallas.** El hub y la carta completa conviven en la
 *   pila de navegación. Con un candado por pantalla, dos pedidos podrían salir a
 *   la vez; con uno solo, las dos comparten estado y salida.
 * - **Probable.** La concurrencia y el encadenamiento se prueban de verdad, sin
 *   simulador y sin buscar palabras en un archivo.
 *
 * ## Y por qué el store tiene ALCANCE
 *
 * Un solo store de módulo para toda la app compartía el fallo entre cuentas y
 * entre cartas: alguien que fallaba un reintento, cerraba sesión y entraba con
 * otra cuenta veía el error de la anterior sobre una carta que nunca había
 * fallado. El registro reparte un store por `userId + inputHash` de la carta.
 * Dos pantallas de la MISMA carta comparten candado y estado; otra cuenta u otra
 * carta empiezan quietas, y una promesa vieja publica en el store al que
 * pertenece —el suyo— sin poder tocar el nuevo.
 */
import { createExclusiveGate, runExclusive } from "./exclusive";
import type { NatalChartRecovery } from "./natalChartState";

/** En qué anda la recuperación. */
export type NatalRecoveryPhase =
  /** Nada en vuelo: el último intento salió bien, o todavía no hubo ninguno. */
  | "quieto"
  /** Hay trabajo en vuelo: el cálculo natal, o el recálculo del día que lo sigue. */
  | "calculando"
  /** El último intento falló, o no mejoró nada. Lo publicado sigue estando. */
  | "fallo";

export type NatalRecoveryDeps = {
  /**
   * La salida que el dominio declaró para el estado actual de la carta
   * (`natalChartState().recovery`). El controlador la exige y no la deduce: es
   * lo que impide que una carta a la que sólo le falta la HORA dispare un
   * cálculo que no puede inventarla.
   */
  recovery: NatalChartRecovery;
  /**
   * ¿Este trabajo sigue perteneciendo a la MISMA pantalla?
   *
   * Montado, misma cuenta y misma carta (`userId` + `inputHash`). Y **nada
   * más**: es lo único que decide si el ciclo puede seguir. Si cambió la cuenta
   * o la carta —o el consumidor se fue— el refresco del día, que es GLOBAL,
   * movería los flags de un alcance que nadie pidió recalcular.
   */
  mismoAlcance: () => boolean;
  /**
   * ¿Un fallo todavía describe algo que la pantalla pueda mostrar?
   *
   * Es `mismoAlcance()` **y además** que la salida siga siendo `reintentar`: un
   * error sólo se publica donde el reintento es la salida real, porque si no, el
   * aviso no tendría botón que acompañar y reaparecería la próxima vez que ese
   * hash volviera a ser recuperable.
   *
   * **Por qué son dos predicados y no uno.** Eran uno solo —montado + alcance +
   * salida— y decidía las dos cosas: si encadenar el refresco y si publicar el
   * fallo. Pero la salida sale de una query REACTIVA: un cálculo exitoso la
   * mueve a `ninguna` antes de que su propia continuación corra, así que el
   * refresco del día —la segunda mitad del trabajo, la que arma el sobre con la
   * geometría nueva— se salteaba justo cuando la recuperación había funcionado.
   * Que la carta ya no necesite reintento no es motivo para no rearmar el día:
   * es exactamente el motivo para rearmarlo.
   */
  falloVigente: () => boolean;
  /**
   * La operación real: `charts.recoverNatalChart({})`.
   *
   * `true` = el read-model puede publicar la geometría que estos datos
   * permiten. `false` = respondió y sigue faltando lo mismo. Un rechazo es el
   * proveedor caído, la red, o los datos natales cambiados mientras calculaba.
   */
  calcular: () => Promise<boolean>;
  /**
   * Volver a pedir el día una vez que la carta existe, ESPERANDO a que termine.
   * Es `useLayers().refreshAndWait`: la misma cola del ciclo de datos, nunca una
   * acción paralela.
   */
  recalcularCapas: () => Promise<unknown>;
};

export type NatalChartRecoveryStore = {
  /**
   * Pide el cálculo de la carta y, al terminar, el recálculo del día.
   *
   * Devuelve `true` sólo a quien realmente disparó el trabajo: un segundo toque
   * mientras el primero corre recibe `false` y no llama a nada. La promesa
   * termina cuando terminan LAS DOS mitades.
   */
  pedir: (deps: NatalRecoveryDeps) => Promise<boolean>;
  /** El estado actual, sin pasar por React. */
  fase: () => NatalRecoveryPhase;
  /** Hay un pedido en vuelo. */
  ocupado: () => boolean;
  /**
   * Da por visto el fallo.
   *
   * Lo llama la pantalla cuando la salida del estado deja de ser `reintentar`:
   * si la carta se completó por otra vía —otro dispositivo, el prewarm, el
   * recálculo del alta—, el error del intento anterior ya no describe nada. No
   * toca un trabajo en vuelo.
   */
  olvidarFallo: () => void;
  /**
   * Avisa cada vez que la fase cambia. Devuelve cómo desuscribirse.
   *
   * Suscribirse es además la RETENCIÓN explícita del store: mientras haya una
   * pantalla montada mirándolo, el registro no puede soltarlo. Desuscribirse lo
   * libera.
   */
  subscribe: (listener: () => void) => () => void;
  /**
   * Cuántas pantallas lo están mirando ahora mismo.
   *
   * Es un contador real de suscriptores, no una suposición sobre cuándo React
   * termina con un componente: el registro lo consulta para no desalojar un
   * store que sigue montado.
   */
  observadores: () => number;
};

export function createNatalChartRecoveryStore(): NatalChartRecoveryStore {
  const gate = createExclusiveGate();
  const listeners = new Set<() => void>();
  let fase: NatalRecoveryPhase = "quieto";

  const publicar = (siguiente: NatalRecoveryPhase) => {
    if (fase === siguiente) return;
    fase = siguiente;
    // Copia: un oyente que se desuscribe durante el aviso no puede saltear al
    // que venía después.
    for (const listener of [...listeners]) listener();
  };

  return {
    fase: () => fase,
    ocupado: () => gate.held(),
    observadores: () => listeners.size,
    olvidarFallo() {
      if (fase === "fallo") publicar("quieto");
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async pedir(deps) {
      // La única salida que un cálculo resuelve es `reintentar`. `completar-hora`
      // y `cargar-datos` los aporta la persona: disparar la operación ahí
      // gastaría una llamada para devolver exactamente la misma carta, y dejaría
      // el botón "calculando" prometiendo un final que no puede llegar.
      if (deps.recovery !== "reintentar") return false;
      // El candado se toma dentro de `runExclusive`, ANTES del primer `await`
      // real: `calcular()` se llama recién después de haberlo tomado, y no se
      // suelta hasta que el recálculo del día también terminó.
      const salida = await runExclusive(gate, async () => {
        publicar("calculando");
        let publicable = false;
        try {
          publicable = await deps.calcular();
        } catch {
          // Un fallo que ya no describe nada no se guarda. Si mientras tanto la
          // carta dejó de ser recuperable, dejar `fallo` pegado lo haría
          // reaparecer la próxima vez que este mismo hash volviera a serlo.
          publicar(deps.falloVigente() ? "fallo" : "quieto");
          return;
        }
        if (!deps.mismoAlcance()) {
          // Cambió la cuenta o la carta mientras el proveedor respondía. El
          // candado se libera en estado NEUTRO y el ciclo de capas global no se
          // toca: un refresco visible sobre el alcance nuevo sería trabajo que
          // nadie pidió, con flags que nadie espera.
          publicar("quieto");
          return;
        }
        if (!publicable) {
          // Respondió, y falta lo mismo que antes. Rearmar el día con la misma
          // carta no cambiaría nada, y decir "listo" sería declarar éxito porque
          // la llamada volvió. El aviso se publica sólo donde el reintento sigue
          // siendo la salida: una respuesta `false` ya obsoleta no deja fallo.
          publicar(deps.falloVigente() ? "fallo" : "quieto");
          return;
        }
        try {
          // La carta ya está persistida. El read-model es reactivo y se
          // actualiza solo; el sobre del día, no: se calculó sin esta geometría.
          //
          // Y esto corre SIEMPRE que el alcance siga siendo el mismo, aunque la
          // salida ya haya pasado a `ninguna`: la query es reactiva y un cálculo
          // exitoso la mueve antes de que esta continuación llegue. Condicionar
          // el refresco a que la carta siguiera necesitando reintento salteaba
          // la segunda mitad del trabajo justo cuando la primera había salido
          // bien, y el día quedaba armado sin la geometría recién calculada.
          await deps.recalcularCapas();
        } catch {
          // La carta nueva quedó guardada y visible; lo que no se pudo fue
          // rearmar el día con ella. Se dice —si todavía describe algo— y el
          // reintento sigue disponible.
          publicar(deps.falloVigente() ? "fallo" : "quieto");
          return;
        }
        publicar("quieto");
      });
      return salida.ran;
    }
  };
}

/**
 * A qué carta pertenece una recuperación.
 *
 * `userId` es la identidad real de la sesión y `inputHash` la de la carta que la
 * pantalla está mirando. Los dos pueden faltar —sesión que todavía no resolvió,
 * cuenta sin carta publicada— y en los dos casos hay un valor estable para ese
 * hueco: dos pantallas mirando la misma ausencia son el mismo alcance.
 */
export type NatalRecoveryScope = {
  userId: string | null | undefined;
  inputHash: string | null | undefined;
};

export function natalRecoveryScopeKey(scope: NatalRecoveryScope): string {
  return `${scope.userId ?? "sin-cuenta"}|${scope.inputHash ?? "sin-carta"}`;
}

export type NatalChartRecoveryRegistry = {
  /** El store de este alcance, creándolo la primera vez. */
  storeFor: (scope: NatalRecoveryScope) => NatalChartRecoveryStore;
  /** Cuántos stores vivos hay ahora mismo. */
  size: () => number;
  /** ¿Este alcance se puede soltar sin romper nada? Sólo para probar la regla. */
  desalojable: (scope: NatalRecoveryScope) => boolean;
};

/** Cuántos alcances se recuerdan antes de soltar los más viejos que estén libres. */
const MAX_SCOPES = 8;

/**
 * Un store por alcance, con limpieza segura.
 *
 * El registro es de módulo —el hub y la carta completa conviven en la pila y
 * tienen que compartir candado— pero **no** es único: repartir por alcance es lo
 * que impide que el fallo de una cuenta o de una carta se pegue a la siguiente.
 *
 * ## Qué NO se puede desalojar
 *
 * Dos condiciones, no una:
 *
 * - **ocupado** — soltar un store con trabajo en vuelo dejaría que un segundo
 *   toque creara otro, con el candado libre, mientras la operación anterior
 *   sigue viva;
 * - **observado** — un store puede estar quieto y seguir montado. Ése era el
 *   defecto: el límite sólo miraba `ocupado()`, así que una pantalla viva podía
 *   perder su store por visitar otras cartas, y el siguiente `storeFor` del
 *   MISMO alcance devolvía un objeto distinto —otro candado— mientras la
 *   primera pantalla seguía ahí. Dos candados para el mismo alcance es
 *   exactamente lo que el registro existe para evitar.
 *
 * La retención es explícita y verificable: `subscribe()` retiene, la función que
 * devuelve libera, y `observadores()` los cuenta. No se supone nada sobre cuándo
 * React termina con un componente; se pregunta.
 *
 * Al desuscribirse —y con el candado libre— el alcance vuelve a ser desalojable,
 * así que la memoria no crece sin límite. Un alcance que se vuelve a pedir
 * después de haber sido soltado empieza quieto, que es exactamente lo que
 * corresponde a algo que ya nadie estaba mirando.
 */
export function createNatalChartRecoveryRegistry(
  options: { max?: number } = {}
): NatalChartRecoveryRegistry {
  const max = options.max ?? MAX_SCOPES;
  /** `Map` conserva el orden de inserción: reinsertar es "usado recién". */
  const stores = new Map<string, NatalChartRecoveryStore>();

  const libre = (store: NatalChartRecoveryStore) =>
    !store.ocupado() && store.observadores() === 0;

  return {
    size: () => stores.size,
    desalojable(scope) {
      const store = stores.get(natalRecoveryScopeKey(scope));
      return Boolean(store) && libre(store as NatalChartRecoveryStore);
    },
    storeFor(scope) {
      const key = natalRecoveryScopeKey(scope);
      const existente = stores.get(key);
      const store = existente ?? createNatalChartRecoveryStore();
      stores.delete(key);
      stores.set(key, store);
      if (stores.size > max) {
        for (const [candidato, otro] of [...stores]) {
          if (stores.size <= max) break;
          // El alcance que se acaba de pedir es el que la pantalla está por
          // usar: todavía no tuvo ocasión de suscribirse.
          if (candidato === key) continue;
          if (!libre(otro)) continue;
          stores.delete(candidato);
        }
      }
      return store;
    }
  };
}
