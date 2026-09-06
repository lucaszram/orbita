import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { civilHourInTimezone } from "@/domain/layers";
import {
  classifyLayerError,
  isStaleEphemerisResult,
  isTransientLayerError,
  layerRetryDelay,
  layerRetryLogLine,
  withLayerTimeout,
  LAYER_STALE_EPHEMERIS_ERROR
} from "@/domain/layerRetry";
import { createLatestRequestGate, transitArcRequestKey } from "@/domain/transitArcRequest";
import { useLayers } from "@/hooks/useLayers";
import { layersApi, type TransitArcEnvelope } from "@/services/layersApi";
import { backendConfig } from "@/services/backendProviders";

/**
 * El `ORB-TRN-001` de UN arco pedido por `arcId`.
 *
 * Por qué existe: el sobre del día (`layers.getForDate`) trae el arco PRINCIPAL y
 * nada más. Abrir cualquier otro tránsito de la lista necesita su propio cálculo
 * —su ventana, sus pasadas verificadas, su precisión y sus fuentes—, y ese cálculo
 * tiene su propio alcance de cache: `{ localDate, timezone, arcId }`.
 *
 * Cómo trabaja:
 * - la lectura es `layers.getTransitArc`, que es REACTIVA y no pega al proveedor;
 * - el cálculo es `layers.refreshTransitArc`, que se pide UNA vez por arco, día,
 *   zona y hora civil (`transitArcRequestKey`), así que dos renders o dos toques
 *   no largan dos acciones;
 * - una respuesta que vuelve tarde sólo escribe estado si sigue siendo el pedido
 *   vigente: navegar a otro arco invalida las anteriores.
 *
 * `LAYER_INPUT_CHANGED_DURING_REFRESH` se reintenta solo, con la misma política
 * que el ciclo del día: no es un error de la persona, es el alta escribiendo sus
 * datos mientras el cálculo salía. Y con el mismo TOPE: una action que no vuelve
 * dejaba `CALCULANDO LA LÍNEA DE TIEMPO…` para siempre, sin fallo que informar y
 * sin nada que la persona pudiera hacer. Pasados los 20 s la espera se corta, el
 * corte cuenta como transitorio y entra en los mismos tres reintentos.
 *
 * Y con el mismo detector del fallo que llega como éxito: `refreshTransitArc`
 * puede resolver y devolver igual un sobre `stale` porque el proveedor de
 * efemérides no contestó. Ese resultado se reencauza como transitorio
 * (`isStaleEphemerisResult`) y recorre los mismos tres reintentos; un sobre
 * `stale` por otro motivo, o `unavailable`, no se reintenta.
 *
 * Lo que se registra de un fallo es el CÓDIGO clasificado, no el mensaje crudo:
 * ahí puede viajar el identificador de la persona.
 */
export type TransitArcState = {
  /**
   * El sobre del arco pedido. `null` mientras la lectura viaja o cuando no hay
   * cuenta con datos; la pantalla distingue los dos casos con `loading`.
   */
  envelope: TransitArcEnvelope | null;
  /** La lectura del sobre todavía viaja. */
  loading: boolean;
  /** Hay un cálculo de ESTE arco en vuelo. */
  refreshing: boolean;
  /** El último cálculo de este arco falló: lo visible puede no ser de ahora. */
  refreshFailed: boolean;
  /** Reintento explícito (botón de la UI). */
  refresh: () => void;
};

const IDLE: TransitArcState = {
  envelope: null,
  loading: false,
  refreshing: false,
  refreshFailed: false,
  refresh: () => undefined
};

/**
 * Sin envs de backend no hay query ni acción que montar. La rama es constante en
 * runtime —los envs no cambian—, así que el orden de hooks queda estable.
 */
export function useTransitArc(arcId: string | null): TransitArcState {
  if (!backendConfig.hasConvex || !backendConfig.hasClerk) return IDLE;
  return useTransitArcInner(arcId);
}

function useTransitArcInner(arcId: string | null): TransitArcState {
  const { phase, localDate, timezone, nowMs } = useLayers();
  const refreshTransitArc = useAction(layersApi.refreshTransitArc);

  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const gate = useRef(createLatestRequestGate()).current;
  const reintentos = useRef(0);
  const mounted = useRef(true);
  /**
   * Un reintento explícito siempre tiene que hacer algo.
   *
   * Sin esto, tocar el botón cuando el sobre guardado todavía parece vigente no
   * dispararía nada y el botón sería decorativo. La bandera sobrevive a los
   * renders en los que el efecto sale temprano —la lectura todavía viaja— y se
   * apaga recién cuando el pedido salió.
   */
  const forzar = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Cambiar de arco empieza de cero: el fallo o el "calculando" del arco anterior
  // no describen al nuevo, y arrastrarlos haría que la pantalla del segundo arco
  // hablara del primero. Va ANTES del efecto que dispara, así que en el mismo
  // commit se limpia y se vuelve a encender si corresponde.
  useEffect(() => {
    setRefreshing(false);
    setRefreshFailed(false);
    reintentos.current = 0;
    forzar.current = false;
  }, [arcId]);

  const listo = phase === "listo" && localDate !== "" && timezone !== "";
  const activo = listo && arcId !== null && arcId.length > 0;
  const civilHour = timezone && nowMs > 0 ? civilHourInTimezone(nowMs, timezone) : "";

  const envelope = useQuery(
    layersApi.getTransitArc,
    activo ? { localDate, timezone, arcId } : "skip"
  );

  const necesitaCalculo = useMemo(() => {
    // La lectura todavía viaja, o no hay cuenta con datos: no hay nada que pedir.
    if (envelope === undefined || envelope === null) return false;
    if (envelope.data === null) return true;
    if (envelope.status === "stale") return true;
    return envelope.validUntil !== null && envelope.validUntil <= nowMs;
  }, [envelope, nowMs]);

  useEffect(() => {
    if (!activo || arcId === null || envelope === undefined) return;
    if (!necesitaCalculo && !forzar.current) return;
    const key = transitArcRequestKey({ arcId, localDate, timezone, civilHour, attempt });
    const token = gate.start(key);
    if (token === null) return;
    forzar.current = false;
    setRefreshing(true);
    // `refreshFailed` NO se limpia acá: hasta saber si este intento salió bien, lo
    // que hay en pantalla sigue siendo el cálculo anterior.
    void (async () => {
      for (;;) {
        try {
          // Con tope: la espera se corta si la action no vuelve, y el corte entra
          // por el mismo `catch` que cualquier otro rechazo.
          const resultado = await withLayerTimeout(refreshTransitArc({ localDate, timezone, arcId }));
          // Terminar bien no es lo mismo que haber salido bien: un sobre `stale`
          // sin el cielo de hoy es un fallo que llegó como éxito. Se reencauza
          // dentro del `try` para que entre por el MISMO `catch` y por la misma
          // política de reintentos.
          if (isStaleEphemerisResult(resultado)) throw new Error(LAYER_STALE_EPHEMERIS_ERROR);
          if (mounted.current && gate.isCurrent(token)) {
            reintentos.current = 0;
            setRefreshFailed(false);
            setRefreshing(false);
          }
          return;
        } catch (error) {
          if (!mounted.current || !gate.isCurrent(token)) return;
          const espera = isTransientLayerError(error) ? layerRetryDelay(reintentos.current + 1) : null;
          console.warn(
            layerRetryLogLine({
              operation: "layers.refreshTransitArc",
              kind: classifyLayerError(error),
              attempt: reintentos.current + 1,
              delayMs: espera
            })
          );
          if (espera === null) {
            reintentos.current = 0;
            setRefreshFailed(true);
            setRefreshing(false);
            return;
          }
          reintentos.current += 1;
          await new Promise((resolve) => setTimeout(resolve, espera));
          if (!mounted.current || !gate.isCurrent(token)) return;
        }
      }
    })();
  }, [
    activo,
    arcId,
    attempt,
    civilHour,
    envelope,
    gate,
    localDate,
    necesitaCalculo,
    refreshTransitArc,
    timezone
  ]);

  const refresh = useCallback(() => {
    reintentos.current = 0;
    forzar.current = true;
    setAttempt((value) => value + 1);
  }, []);

  return useMemo<TransitArcState>(
    () => ({
      envelope: envelope ?? null,
      loading: activo && envelope === undefined,
      refreshing,
      refreshFailed,
      refresh
    }),
    [activo, envelope, refreshing, refreshFailed, refresh]
  );
}
