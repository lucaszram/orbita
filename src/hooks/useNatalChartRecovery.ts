import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useAction } from "convex/react";
import {
  createNatalChartRecoveryRegistry,
  natalRecoveryScopeKey
} from "@/domain/natalChartRecovery";
import type { NatalChartRecovery } from "@/domain/natalChartState";
import { useLayers } from "@/hooks/useLayers";
import { useLiveApp } from "@/hooks/useLiveApp";
import { chartsApi } from "@/services/chartsApi";
import type { NatalChartBase } from "@/services/layersApi";

/**
 * El botón de recuperación de la Carta, cableado a la operación que de verdad
 * la genera.
 *
 * La lógica —candado, encadenamiento, estado, alcance— vive en
 * `@/domain/natalChartRecovery` y se prueba sin React. Acá sólo se enchufan las
 * dos dependencias reales: la action `charts.recoverNatalChart` y la vía
 * esperable del ciclo de capas.
 *
 * **La operación es `recoverNatalChart` y no `calculateOrCreateNatalChart`.**
 * Las dos hacen el mismo trabajo; la diferencia es qué cuentan. La segunda
 * resuelve con la carta guardada cuando el proveedor falla —correcto para el
 * alta, que no puede quedarse sin carta— y eso acá es justamente lo que no
 * sirve: el botón existe porque a esa carta le falta geometría, así que
 * recibirla de vuelta sin cambios y llamarlo éxito deja a la pantalla
 * anunciando un final que no ocurrió. `recoverNatalChart` devuelve el desenlace
 * discriminado, y sólo `recovered` cuenta como éxito.
 *
 * **Un store por carta, no uno por app.** El hub (`/perfil/carta`) y la carta
 * completa (`/perfil/carta/completa`) conviven en la pila de navegación: la
 * primera queda montada debajo de la segunda. Con un candado por pantalla las
 * dos podrían pedir el cálculo a la vez y contarían cosas distintas mientras
 * corre. Con uno por `userId + inputHash`, tocar en cualquiera de las dos es
 * exactamente la misma operación —y el fallo de una cuenta o de una carta no se
 * hereda a la siguiente—.
 *
 * **Y el trabajo sabe si sigue siendo el de esta pantalla.** El cálculo natal
 * tarda; el recálculo del día que lo sigue es GLOBAL. Si mientras el proveedor
 * responde cambia la cuenta o la carta, encadenar el refresco movería los flags
 * de un alcance que nadie pidió recalcular. Por eso el controlador exige dos
 * predicados, y son dos porque contestan cosas distintas:
 *
 * - `mismoAlcance()` — montado + mismo `userId` + mismo `inputHash`. Es lo único
 *   que decide si el ciclo puede seguir hasta el refresco.
 * - `falloVigente()` — lo anterior **y** que la salida siga siendo `reintentar`.
 *   Es lo único que decide si un error se publica.
 *
 * Eran uno solo, y ahí estaba el defecto: `recovery` sale de una query
 * REACTIVA, así que un cálculo exitoso la mueve a `ninguna` antes de que la
 * continuación corra. El predicado único decía "ya no es vigente" y el refresco
 * del día —la mitad que arma el sobre con la geometría recién calculada— se
 * salteaba justo cuando la recuperación había funcionado.
 */
const registry = createNatalChartRecoveryRegistry();

export type NatalChartRecoveryUi = {
  /** Pide el cálculo natal y, al terminar, el recálculo del día. */
  recuperar: () => void;
  /** Hay trabajo en vuelo: el botón se bloquea y lo dice. */
  ocupado: boolean;
  /** El último intento falló. Lo que ya estaba publicado sigue visible. */
  fallo: boolean;
};

export function useNatalChartRecovery(args: {
  /**
   * La salida que `natalChartState` declaró para esta carta. El controlador
   * sólo calcula cuando vale `reintentar`; con `completar-hora` no llama a
   * nada, porque la hora la aporta la persona y ningún recálculo la inventa.
   */
  recovery: NatalChartRecovery;
  /**
   * La carta que la pantalla está mirando. Su `inputHash`, junto con la cuenta,
   * es el alcance del estado de recuperación: sin él, el fallo de una carta
   * reaparecería sobre otra.
   */
  chart: NatalChartBase | null | undefined;
}): NatalChartRecoveryUi {
  const { recovery, chart } = args;
  const live = useLiveApp();
  const userId = live.auth?.userId ?? null;
  const inputHash = chart?.inputHash ?? null;
  const scopeKey = natalRecoveryScopeKey({ userId, inputHash });
  const store = useMemo(() => registry.storeFor({ userId, inputHash }), [userId, inputHash]);

  const calcular = useAction(chartsApi.recoverNatalChart);
  const { refreshAndWait, refreshing } = useLayers();
  const fase = useSyncExternalStore(store.subscribe, store.fase, store.fase);

  // Las tres referencias con las que un trabajo en vuelo decide si todavía es el
  // de esta pantalla. Son refs y no valores capturados a propósito: lo que hay
  // que preguntar es qué está pasando AHORA, no qué pasaba cuando se tocó el
  // botón.
  const montado = useRef(true);
  const alcanceVivo = useRef(scopeKey);
  alcanceVivo.current = scopeKey;
  const salidaViva = useRef(recovery);
  salidaViva.current = recovery;

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // La carta dejó de necesitar un recálculo —se completó por otra vía, o su
  // único límite pasó a ser la hora—: el error del intento anterior ya no
  // describe nada de lo que hay en pantalla.
  useEffect(() => {
    if (recovery !== "reintentar") store.olvidarFallo();
  }, [store, recovery]);

  const recuperar = useCallback(() => {
    // El alcance con el que ESTE pedido salió. Si el de la pantalla cambia
    // mientras el proveedor responde, el trabajo deja de ser vigente.
    const alcanceDelPedido = scopeKey;
    // El candado es sincrónico y vive en el store: dos toques del mismo render
    // entran los dos acá y sólo uno llega a la action.
    const mismoAlcance = () =>
      montado.current && alcanceVivo.current === alcanceDelPedido;
    void store.pedir({
      recovery,
      mismoAlcance,
      // El fallo se publica sólo donde el reintento sigue siendo la salida real.
      falloVigente: () => mismoAlcance() && salidaViva.current === "reintentar",
      calcular: async () => (await calcular({})).status === "recovered",
      recalcularCapas: refreshAndWait
    });
  }, [store, scopeKey, recovery, calcular, refreshAndWait]);

  return {
    recuperar,
    // El recálculo del día es la segunda mitad del mismo trabajo y corre bajo el
    // mismo candado: mientras cualquiera de las dos mitades vive, el botón sigue
    // bloqueado en vez de invitar a apilar pedidos.
    ocupado: fase === "calculando" || refreshing,
    // Un fallo sólo se muestra donde el reintento es la salida real: si el
    // estado ya no ofrece reintentar, el aviso no tendría botón que acompañar.
    fallo: recovery === "reintentar" && fase === "fallo"
  };
}
