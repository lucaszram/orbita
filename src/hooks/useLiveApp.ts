import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { appApi, NatalChartDoc } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import { OrbitaAuth } from "@/hooks/useOrbitaAuth";
import { useOrbitaSession, type SessionStatus } from "@/services/session";

/**
 * Capa live nativa. Desde el incidente del 2026-07-13, esto es un CONSUMIDOR del
 * `OrbitaSessionProvider` (src/services/session.tsx): una sola máquina de estados
 * de sesión para toda la app, en vez de un `userReady` local por pantalla.
 *
 * Regla para las pantallas: mock SOLO con `status === "guest"`. `booting` /
 * `reconnecting` = carga estable; `error` = error visible con reintento.
 */
const HAS_CONVEX = backendConfig.hasConvex;

export type LiveApp = {
  /** Compat: `status === "live"` (sesión confirmada + fila `users` garantizada). */
  isLive: boolean;
  isAuthLoading: boolean;
  auth: OrbitaAuth | null;
  /** Estado explícito de sesión — usar esto para decidir mock vs carga vs error. */
  status: SessionStatus;
  /** Reintenta la inicialización tras `status === "error"`. */
  retrySession: () => void;
};

export function useLiveApp(): LiveApp {
  const session = useOrbitaSession();
  return {
    isLive: session.isLive,
    isAuthLoading: session.isAuthLoading,
    auth: session.auth,
    status: session.status,
    retrySession: session.retrySession
  };
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Argentina/Buenos_Aires";
  } catch {
    return "America/Argentina/Buenos_Aires";
  }
}

export type LiveHome = {
  /** Payload de `readings.getToday` o null (sin live / cargando / sin doc). */
  payload: unknown | null;
  /** Persiste la lectura del día en Convex (null si no hay live). */
  saveLive: ((readingPayload: unknown) => Promise<void>) | null;
};

const NO_LIVE_HOME: LiveHome = { payload: null, saveLive: null };

export function useLiveHome(isLive: boolean, localDate: string): LiveHome {
  if (!HAS_CONVEX) return NO_LIVE_HOME;
  return useLiveHomeInner(isLive, localDate);
}

function useLiveHomeInner(isLive: boolean, localDate: string): LiveHome {
  const doc = useQuery(appApi.readings.getToday, isLive ? { localDate } : "skip");
  const generateToday = useMutation(appApi.readings.generateToday);
  const save = useMutation(appApi.readings.save);
  const triedGenerate = useRef(false);

  useEffect(() => {
    if (isLive && doc === null && !triedGenerate.current) {
      triedGenerate.current = true;
      generateToday({ localDate, timezone: deviceTimezone() }).catch(() => {
        // sin red / deployment desincronizado: la Home sigue con el engine local
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, doc, localDate]);

  const saveLive = useCallback(
    async (readingPayload: unknown) => {
      try {
        await save({ readingDate: localDate, readingPayload });
      } catch {
        // la copia local ya quedó guardada; el backend puede fallar en silencio
      }
    },
    [save, localDate]
  );

  const record = doc && typeof doc === "object" ? (doc as { payload?: unknown }) : null;
  return {
    payload: record?.payload ?? null,
    saveLive: isLive ? saveLive : null
  };
}

export type LiveAppDocs = {
  chart: NatalChartDoc | null;
  birthData: { birthDate?: string; birthTime?: string; birthPlaceLabel?: string } | null;
  subscription: { entitlement?: string; status?: string } | null;
};

const NO_LIVE_DOCS: LiveAppDocs = { chart: null, birthData: null, subscription: null };

export function useLiveAppDocs(isLive: boolean): LiveAppDocs {
  if (!HAS_CONVEX) return NO_LIVE_DOCS;
  return useLiveAppDocsInner(isLive);
}

function useLiveAppDocsInner(isLive: boolean): LiveAppDocs {
  const chart = useQuery(appApi.charts.current, isLive ? {} : "skip");
  const birthData = useQuery(appApi.birthData.getCurrent, isLive ? {} : "skip");
  const subscription = useQuery(appApi.subscriptions.getCurrent, isLive ? {} : "skip");
  return {
    chart: (chart as NatalChartDoc | null | undefined) ?? null,
    birthData: (birthData as LiveAppDocs["birthData"] | undefined) ?? null,
    subscription: (subscription as LiveAppDocs["subscription"] | undefined) ?? null
  };
}
