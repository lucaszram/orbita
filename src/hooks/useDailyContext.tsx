import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAction } from "convex/react";
import {
  observedDateInTimezone,
  refetchReason,
  type DailyContext,
  type DailyContextState
} from "@/domain/dailyContext";
import { useLiveApp } from "@/hooks/useLiveApp";
import { proposedApi } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";

/**
 * Proveedor único de la fecha canónica (`daily.getTodayContext`).
 *
 * Antes cada pantalla calculaba su propio `todayLocalDate()` con el reloj del
 * navegador — había seis copias — y algunas además mandaban `timezone` del
 * dispositivo como si fuera autoridad. El backend P0 dejó de aceptar eso: el
 * día astrológico se calcula server-side desde la zona natal persistida.
 *
 * Se refresca al entrar otra cuenta, al volver la app al frente y al cruzar la
 * medianoche. El reloj local sólo dispara el refetch; el día siempre lo dice
 * el servidor.
 */

type DailyContextValue = DailyContextState & { refresh: () => void };

const IDLE: DailyContextValue = { status: "idle", refresh: () => undefined };

const Ctx = createContext<DailyContextValue | null>(null);

/** Cada cuánto se mira el reloj para detectar el cruce de medianoche. */
const TICK_MS = 60_000;

export function DailyContextProvider({ children }: { children: ReactNode }) {
  if (!backendConfig.hasConvex || !backendConfig.hasClerk) return <>{children}</>;
  return <DailyContextProviderInner>{children}</DailyContextProviderInner>;
}

function DailyContextProviderInner({ children }: { children: ReactNode }) {
  const { isLive, auth } = useLiveApp();
  const getTodayContext = useAction(proposedApi.todayContext);
  const accountKey = isLive ? auth?.userId ?? null : null;

  const [state, setState] = useState<DailyContextState>({ status: "idle" });
  const fetchedForAccount = useRef<string | null>(null);
  const inFlight = useRef(false);
  // Un tick cualquiera (foco, medianeche, montaje) sólo marca que hay que
  // reevaluar; la decisión la toma `refetchReason`, que es pura y testeada.
  const [tick, setTick] = useState(0);
  const foregroundRef = useRef(false);

  const load = useCallback(
    async (account: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setState((prev) => (prev.status === "listo" ? prev : { status: "cargando" }));
      try {
        const context = (await getTodayContext({})) as DailyContext;
        fetchedForAccount.current = account;
        setState({
          status: "listo",
          context,
          // Se guarda lo que el navegador ve AHORA en la zona del servidor.
          // No es el día astrológico: es la referencia para notar la medianoche.
          observedDate: observedDateInTimezone(Date.now(), context.timezone)
        });
      } catch {
        fetchedForAccount.current = account;
        setState({ status: "error" });
      } finally {
        inFlight.current = false;
      }
    },
    [getTodayContext]
  );

  useEffect(() => {
    if (!accountKey) {
      fetchedForAccount.current = null;
      setState({ status: "idle" });
      return;
    }
    const timezone = state.status === "listo" ? state.context.timezone : null;
    const reason = refetchReason({
      state,
      accountKey,
      fetchedForAccount: fetchedForAccount.current,
      currentObserved: timezone ? observedDateInTimezone(Date.now(), timezone) : "",
      cameToForeground: foregroundRef.current
    });
    foregroundRef.current = false;
    if (reason) void load(accountKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey, tick, state.status]);

  // Medianoche: mirar el reloj cada minuto es suficiente y sobrevive a
  // suspensiones del dispositivo, a diferencia de un timeout largo hasta las 00:00.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Volver al frente: la pestaña pudo estar horas en segundo plano.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        foregroundRef.current = true;
        setTick((t) => t + 1);
      }
    });
    return () => sub.remove();
  }, []);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return <Ctx.Provider value={{ ...state, refresh }}>{children}</Ctx.Provider>;
}

export function useDailyContext(): DailyContextValue {
  return useContext(Ctx) ?? IDLE;
}

/**
 * Atajo para pantallas que sólo necesitan la fecha ya resuelta. `null` mientras
 * carga o si falló: nunca devuelve una fecha calculada en el cliente.
 */
export function useCanonicalLocalDate(): string | null {
  const ctx = useDailyContext();
  return ctx.status === "listo" ? ctx.context.localDate : null;
}
