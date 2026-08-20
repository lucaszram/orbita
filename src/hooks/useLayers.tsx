import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { AppState } from "react-native";
import { useAction, useQuery } from "convex/react";
import {
  civilDateInTimezone,
  civilHourInTimezone,
  deviceTimezoneName,
  previousCivilDate
} from "@/domain/layers";
import { layerRetryLogLine } from "@/domain/layerRetry";
import { claveDeAlcance, createRefreshCycle, type RefreshCycle } from "@/domain/refreshCycle";
import { createRefreshQueue, type RefreshRequest } from "@/domain/refreshQueue";
import { sessionPhase, type SessionPhase } from "@/domain/screenPhase";
import { useLiveApp } from "@/hooks/useLiveApp";
import { layersApi, type LayerBundle, type NatalBaseBundle } from "@/services/layersApi";
import { backendConfig } from "@/services/backendProviders";

/**
 * Las capas de tiempo del día, con la fecha civil y la zona DEL DISPOSITIVO.
 *
 * Por qué el aparato y no la fecha canónica de `daily.getTodayContext`: las
 * capas V4.9.2 describen lo que está pasando ahora donde está la persona, y
 * `layers.refreshForDate` valida que `localDate` sea el día que el servidor ve
 * en ESA zona. Mandar la zona natal de alguien que viajó haría fallar la
 * acción; mandar la fecha del aparato con otra zona, también.
 *
 * Una sola instancia para toda la app: `LayersProvider` corre el ciclo de datos
 * y las pantallas lo consumen con `useLayers()`. Antes cada pantalla montaba su
 * propio reloj, su propio `refreshForDate` y su propio `refreshFailed`, así que
 * Hoy y Tránsitos podían discrepar sobre qué hora es y sobre si el último
 * recálculo falló, y abrir un detalle disparaba una acción más.
 *
 * Ciclo de vida:
 * - al montar y cada vez que cambia el par (fecha, zona) → `refreshForDate`;
 * - al volver la app al frente → se vuelve a mirar el reloj y se recalcula;
 * - cada minuto → se mira el reloj: detecta el cruce de medianoche (sobrevive a
 *   suspensiones) y el cambio de hora civil, que acota la caché a una hora;
 * - la lectura es `getForDate`, que es REACTIVA: cuando la acción persiste,
 *   la pantalla se actualiza sola.
 *
 * Si la acción falla, la query sigue devolviendo el último sobre persistido y
 * la UI lo dice (`refreshFailed`): nunca se pinta como si fuera de ahora.
 *
 * `refreshForDate` corre en single-flight dentro de la GENERACIÓN viva: nunca
 * hay dos acciones de la misma generación a la vez. Lo que llega mientras una
 * corre —cruce de medianoche, cambio de zona, hora civil nueva, botón de
 * reintento— no se encola en fila ni se pierde: se guarda como la ÚNICA
 * solicitud pendiente (la más reciente gana) y se ejecuta al terminar la
 * anterior. Recalcular el día con datos de hace dos cambios no le sirve a nadie;
 * lo que importa es el último estado del reloj.
 *
 * Con una excepción que es justamente la que evita el cuelgue: si la solicitud
 * nueva tiene otro ALCANCE —la misma clave de acá: cuenta, día civil, zona, hora
 * civil o intento— y la corrida viva todavía no terminó, la cola la RELEVA. La
 * anterior ya no podía servirle a nadie, así que queda huérfana —sin apagar
 * `refreshing`, sin tocar `refreshFailed` y sin pisar el resultado de la nueva—
 * y la pertinente arranca sin esperarla. Sin eso, una action que no resolvía
 * nunca dejaba `CALCULANDO…` para siempre y ni volver del background lo
 * destrababa. Lo mismo pasa al desmontar: la action que ya salió no se puede
 * cancelar, queda huérfana y el ciclo nuevo trabaja igual (ver `refreshQueue`).
 *
 * Esa cola vive en `@/domain/refreshQueue`, sin React, para poder probar la
 * concurrencia de verdad. Este hook le enchufa la acción real, el reloj y los
 * dos flags visibles (`refreshing`, `refreshFailed`).
 *
 * Y la COSTURA entre la cola y la clave del último pedido admitido vive en
 * `@/domain/refreshCycle`, también sin React, porque ahí vivía un refresco
 * duplicado: el cleanup suspendía la cola —que conserva lo pendiente— y además
 * borraba la clave, así que el montaje nuevo retomaba la solicitud pendiente Y
 * volvía a encolarla. La regla es que la clave sobrevive exactamente cuando su
 * pedido sobrevive.
 *
 * El CONTADOR DEL INTENTO también vive ahí, y no en este hook. Mientras fue
 * estado de React, la vía forzada —`refreshAndWait()`, o sea la recuperación de
 * la Carta— armaba su clave con el valor que tenía en la mano y pedía el MISMO
 * alcance que la corrida en vuelo: sin cambio de alcance la cola no releva nada,
 * así que una action colgada dejaba la espera atrás para siempre, con el candado
 * natal tomado. `setAttempt(v => v + 1)` no lo arreglaba, porque el estado nuevo
 * recién existe en el render siguiente y la clave se arma antes. Ahora el ciclo
 * RESERVA el intento sincrónicamente en el mismo instante en que encola, y el
 * estado de acá es sólo un espejo que dispara el efecto del reloj.
 */

export type LayersPhase = SessionPhase | "vacio" | "listo";

export type LayersState = {
  /** `cargando` · `error` (sesión) · `invitado` · `vacio` (sin cuenta con datos) · `listo`. */
  phase: LayersPhase;
  bundle: LayerBundle | null;
  /**
   * El sobre del día civil ANTERIOR, tal como quedó guardado. Sirve para una
   * sola cosa: decir cuánto cambió un dato desde ayer (`↓ AYER 1°10′`). Es una
   * lectura pura —nunca dispara un recálculo del pasado— y es `null` cuando ese
   * día no tiene cálculo guardado, que es la mayoría de las cuentas nuevas.
   */
  yesterday: LayerBundle | null;
  /** Día civil `YYYY-MM-DD` del aparato con el que se pidió el sobre. */
  localDate: string;
  /** Zona IANA del aparato. */
  timezone: string;
  /** Instante compartido para fechas relativas y barras (se refresca cada minuto). */
  nowMs: number;
  /** Hay un `refreshForDate` en vuelo. */
  refreshing: boolean;
  /** El último `refreshForDate` falló: lo visible puede no ser de este momento. */
  refreshFailed: boolean;
  /** Reintento explícito (botón de la UI). */
  refresh: () => void;
  /**
   * El mismo reintento, ESPERABLE.
   *
   * Termina cuando la solicitud termina, no cuando se encola, y entra en la
   * MISMA cola que `refresh`: si ya hay una corrida en vuelo, espera a que la
   * pendiente más reciente cierre en vez de abrir una acción paralela. Rechaza
   * con el error real cuando el recálculo falla de verdad —la carrera del alta
   * se sigue reintentando sola por dentro—.
   *
   * Lo usa la recuperación de la Carta, cuyo ciclo es calcular la carta y
   * después rearmar el día: hasta que las dos mitades terminan, el botón tiene
   * que seguir bloqueado.
   */
  refreshAndWait: () => Promise<void>;
  /** Reintento de la fila `users` cuando la sesión quedó rota. */
  retrySession: () => void;
};

const TICK_MS = 60_000;

const OFFLINE: LayersState = {
  phase: "invitado",
  bundle: null,
  yesterday: null,
  localDate: "",
  timezone: "",
  nowMs: 0,
  refreshing: false,
  refreshFailed: false,
  refresh: () => undefined,
  // Sin backend no hay sobre que recalcular: la espera termina enseguida porque
  // ya no queda nada que esperar, no porque algo se haya recalculado.
  refreshAndWait: () => Promise.resolve(),
  retrySession: () => undefined
};

const LayersContext = createContext<LayersState | null>(null);

/**
 * Proveedor único del ciclo de datos: se monta UNA vez, alrededor del chrome de
 * las pestañas nativas.
 *
 * Sin envs de backend no hay sobre que pedir ni acción que llamar: el proveedor
 * no monta nada y `useLayers()` cae en el estado invitado, que las pantallas ya
 * saben dibujar. Los envs no cambian en runtime, así que la rama es constante y
 * el orden de hooks queda estable.
 */
export function LayersProvider({ children }: { children: ReactNode }) {
  if (!backendConfig.hasConvex || !backendConfig.hasClerk) return <>{children}</>;
  return <LayersProviderInner>{children}</LayersProviderInner>;
}

/**
 * El estado compartido. Fuera del proveedor —o sin backend— devuelve el estado
 * invitado en vez de romper: ninguna pantalla queda a oscuras por dónde se
 * montó.
 */
export function useLayers(): LayersState {
  return useContext(LayersContext) ?? OFFLINE;
}

type Clock = {
  timezone: string;
  localDate: string;
  /** Balde de una hora (`YYYY-MM-DDTHH`): al cambiar, se recalcula el día. */
  civilHour: string;
  nowMs: number;
};

function readClock(): Clock {
  const timezone = deviceTimezoneName();
  const nowMs = Date.now();
  return {
    timezone,
    localDate: civilDateInTimezone(nowMs, timezone),
    civilHour: civilHourInTimezone(nowMs, timezone),
    nowMs
  };
}

function LayersProviderInner({ children }: { children: ReactNode }) {
  const live = useLiveApp();
  const session = sessionPhase(live);
  const accountKey = live.isLive ? live.auth?.userId ?? "live" : null;
  const retrySession = live.retryUser;

  const [clock, setClock] = useState<Clock>(readClock);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  /** Montado: al desmontar no se toca más estado ni se sigue recalculando. */
  const mounted = useRef(true);

  const syncClock = useCallback(() => setClock(readClock()), []);

  // Medianoche, viajes con cambio de zona y vencimiento de la caché: mirar el
  // reloj cada minuto cubre las tres cosas y sobrevive a suspensiones del
  // dispositivo.
  useEffect(() => {
    const id = setInterval(syncClock, TICK_MS);
    return () => clearInterval(id);
  }, [syncClock]);

  const refreshForDate = useAction(layersApi.refreshForDate);
  // La acción viaja por un ref para que la cola sobreviva a los cambios de
  // identidad del binding: la cola se crea UNA vez y nunca pierde lo que tenía
  // en vuelo.
  const accion = useRef(refreshForDate);
  accion.current = refreshForDate;

  /**
   * La cola compartida: single-flight, la solicitud más reciente gana, y la
   * carrera del alta se reintenta sola. Vive en `@/domain/refreshQueue`, sin
   * React, y acá sólo se le enchufan la acción y los dos flags visibles.
   *
   * El ciclo (`@/domain/refreshCycle`) la envuelve con la CLAVE del último
   * pedido admitido: las dos mitades juntas son la costura donde vivía el
   * refresco duplicado, y ahí es donde se prueba.
   */
  const cicloRef = useRef<RefreshCycle | null>(null);
  if (!cicloRef.current) {
    cicloRef.current = createRefreshCycle(
      createRefreshQueue({
        run: (request: RefreshRequest) => accion.current(request),
        alive: () => mounted.current,
        onBusyChange: (busy) => setRefreshing(busy),
        // `refreshFailed` NO se limpia al encolar: mientras el reintento está en
        // vuelo, lo que hay en pantalla sigue siendo el cálculo viejo, y borrar el
        // aviso antes de saber si esta vez salió bien es exactamente el disimulo
        // que el aviso existe para evitar.
        onFailedChange: (failed) => setRefreshFailed(failed),
        // Un intento fallido se registra con su CÓDIGO clasificado, su número de
        // intento y la espera. Nunca el mensaje crudo: el texto de un error de
        // Convex puede traer el identificador de la persona o el request id de
        // su sesión, y nada de eso hace falta para entender el incidente.
        onRetryEvent: (evento) => console.warn(layerRetryLogLine(evento))
      })
    );
  }
  const ciclo = cicloRef.current;
  const cola = ciclo.cola;

  /**
   * El intento reservado, ESPEJADO en React.
   *
   * La fuente de verdad del nonce es el ciclo (`ciclo.intento()`); esto existe
   * sólo para que el efecto del reloj vuelva a correr cuando alguien reserva un
   * intento nuevo. La clave NO se arma con este número —se arma con
   * `ciclo.intento()`—, así que ningún orden de renders puede fabricar un pedido
   * con un alcance viejo ni convertir la reserva en un duplicado.
   */
  const [intentoEspejo, setIntentoEspejo] = useState(() => ciclo.intento());

  // Volver al frente: la app pudo estar horas en segundo plano. El intento sube
  // siempre, aunque el reloj no haya cambiado, así que la clave del efecto es
  // otra y el refresco vigente RELEVA a la corrida anterior si quedó colgada:
  // volver de background destraba `CALCULANDO…` en vez de heredarlo.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      syncClock();
      setIntentoEspejo(ciclo.reservarIntento());
    });
    return () => sub.remove();
  }, [ciclo, syncClock]);

  useEffect(() => {
    mounted.current = true;
    // Si un desmonte cortó el bucle con algo pendiente (el doble montaje de
    // StrictMode, por ejemplo), acá se retoma sin perder la solicitud.
    ciclo.abrir();
    return () => {
      mounted.current = false;
      // El ciclo de vida se cierra EXPLÍCITAMENTE. Marcar `mounted = false` no
      // alcanzaba: si la acción quedaba colgada, quien esperaba con
      // `refreshAndWait` —la recuperación de la Carta, con el candado natal
      // tomado— se quedaba pendiente para siempre y `CALCULANDO…` no se
      // desbloqueaba ni volviendo a montar. `cerrar()` suspende la cola —corta
      // todas las esperas con `LAYERS_REFRESH_UNAVAILABLE`, suelta el candado
      // del ciclo cerrado y desacopla la corrida vieja del que venga después— y
      // recién entonces decide qué pasa con la clave del último pedido:
      // sobrevive si su solicitud quedó pendiente (el ciclo nuevo la retoma
      // solo, y volver a pedirla era la corrida duplicada) y se borra si no
      // quedó nada, para que el primer refresh no se pierda con el doble
      // montaje de StrictMode. La política está en `@/domain/refreshCycle`.
      ciclo.cerrar();
    };
  }, [ciclo]);

  useEffect(() => {
    if (!accountKey || !clock.localDate || !clock.timezone) return;
    // La hora civil entra en la clave: mientras la app queda abierta, el sobre
    // se vuelve a pedir al cambiar de hora, así que lo que se ve nunca lleva más
    // de una hora calculado.
    //
    // El intento sale del CICLO, no de `intentoEspejo`: el espejo sólo dispara
    // este efecto, y leerlo para armar la clave volvería a abrir la ventana en
    // la que una reserva sincrónica y el render que la publica no coinciden. Con
    // `ciclo.intento()`, el pedido que la vía forzada acaba de anotar se
    // reconoce como propio y no se duplica.
    const key = claveDeAlcance({
      cuenta: accountKey,
      localDate: clock.localDate,
      timezone: clock.timezone,
      civilHour: clock.civilHour,
      intento: ciclo.intento()
    });
    ciclo.pedir(key, { localDate: clock.localDate, timezone: clock.timezone });
    // Sin cleanup a propósito: el efecto viejo no cancela nada. Apagar
    // `refreshing` o `refreshFailed` desde acá borraría el estado de la acción
    // NUEVA, que es la que manda; el dueño de esos flags es la cola.
  }, [accountKey, clock.localDate, clock.timezone, clock.civilHour, intentoEspejo, ciclo]);

  const bundle = useQuery(
    layersApi.getForDate,
    accountKey && clock.localDate && clock.timezone
      ? { localDate: clock.localDate, timezone: clock.timezone }
      : "skip"
  );

  // El día anterior, sólo para comparar. `getForDate` es una query: leer un día
  // pasado no recalcula nada ni pega al proveedor, devuelve lo que quedó
  // guardado. Sin snapshot de ayer, el sobre viene con las capas en
  // `unavailable` y la UI simplemente no dice el cambio.
  const ayer = previousCivilDate(clock.localDate);
  const yesterday = useQuery(
    layersApi.getForDate,
    accountKey && ayer && clock.timezone ? { localDate: ayer, timezone: clock.timezone } : "skip"
  );

  // Tocar reintentar diez veces seguidas no larga diez acciones: sólo mueve la
  // clave, y la cola ejecuta una sola vez lo último que quedó pendiente.
  const refresh = useCallback(() => {
    // Un reintento explícito devuelve el crédito de reintentos automáticos: si
    // la persona insiste, el cliente vuelve a darle tiempo a la carrera del alta
    // en vez de rendirse en el primer rechazo.
    cola.resetRetries();
    syncClock();
    setIntentoEspejo(ciclo.reservarIntento());
  }, [ciclo, cola, syncClock]);

  /**
   * El mismo reintento, esperable, y por la MISMA cola.
   *
   * Encola con el reloj recién leído en vez de esperar un render: la solicitud
   * tiene que existir antes de devolver la promesa, porque quien espera cuenta
   * con que su turno ya está tomado. Se sincroniza el reloj visible por el mismo
   * motivo por el que lo hace `refresh`.
   *
   * El INTENTO no se lee: lo RESERVA el ciclo, sincrónicamente, en el mismo
   * instante en que encola. Acá vivía el cuelgue de mismo alcance: la
   * recuperación natal terminaba de calcular la carta y pedía el refresco con el
   * `attempt` que tenía en la mano —el estado de React no cambia en el mismo
   * tick—, así que la clave era IDÉNTICA a la de la corrida en vuelo, la cola no
   * relevaba nada y la espera quedaba detrás de una action que podía no resolver
   * nunca. Con la reserva, el alcance siempre es nuevo: la corrida colgada queda
   * huérfana y ésta arranca sin esperarla. El espejo se actualiza DESPUÉS, sólo
   * para que el efecto vuelva a correr y confirme que no hay nada que pedir.
   */
  const refreshAndWait = useCallback(() => {
    cola.resetRetries();
    const proximo = readClock();
    setClock(proximo);
    const espera = ciclo.pedirYEsperar(
      (intento) =>
        accountKey
          ? claveDeAlcance({
              cuenta: accountKey,
              localDate: proximo.localDate,
              timezone: proximo.timezone,
              civilHour: proximo.civilHour,
              intento
            })
          : null,
      { localDate: proximo.localDate, timezone: proximo.timezone }
    );
    setIntentoEspejo(ciclo.intento());
    return espera;
  }, [accountKey, ciclo, cola]);

  const phase: LayersPhase = useMemo(() => {
    if (session !== "live") return session;
    if (bundle === undefined) return "cargando";
    if (bundle === null) return "vacio";
    return "listo";
  }, [session, bundle]);

  const value = useMemo<LayersState>(
    () => ({
      phase,
      bundle: bundle ?? null,
      yesterday: yesterday ?? null,
      localDate: clock.localDate,
      timezone: clock.timezone,
      nowMs: clock.nowMs,
      refreshing,
      refreshFailed,
      refresh,
      refreshAndWait,
      retrySession
    }),
    [phase, bundle, yesterday, clock, refreshing, refreshFailed, refresh, refreshAndWait, retrySession]
  );

  return <LayersContext.Provider value={value}>{children}</LayersContext.Provider>;
}

/**
 * Capas natales (`layers.getNatalBase`): no dependen del día, así que no
 * disparan recálculo. Se usan donde el dato natal ES el contexto — por ejemplo
 * el ángulo Sol–Luna con el que se define tu Cumpleluna.
 */
export function useNatalBase(): { bundle: NatalBaseBundle | null; loading: boolean } {
  if (!backendConfig.hasConvex || !backendConfig.hasClerk) return { bundle: null, loading: false };
  return useNatalBaseInner();
}

function useNatalBaseInner(): { bundle: NatalBaseBundle | null; loading: boolean } {
  const live = useLiveApp();
  const result = useQuery(layersApi.getNatalBase, live.isLive ? {} : "skip");
  return { bundle: result ?? null, loading: live.isLive && result === undefined };
}
