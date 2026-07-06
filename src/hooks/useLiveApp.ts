import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { appApi, NatalChartDoc } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import { OrbitaAuth, useOrbitaAuth } from "@/hooks/useOrbitaAuth";

/**
 * Capa live nativa (no hay `?live=1` como en web): live ⟺ Convex configurado
 * + sesión Clerk autenticada en Convex. Mock/local-first: sin sesión, la app
 * se comporta exactamente igual que siempre.
 *
 * Los guards `HAS_CONVEX`/`HAS_CLERK` son constantes de módulo (los envs no
 * cambian en runtime), así que el orden de hooks es estable aunque haya
 * returns tempranos. Queries condicionales via `"skip"` (convex >= 1.x).
 */
const HAS_CONVEX = backendConfig.hasConvex;
const HAS_CLERK = backendConfig.hasClerk;

export type LiveApp = {
  /** Hay sesión y la fila `users` ya existe: se pueden correr queries. */
  isLive: boolean;
  isAuthLoading: boolean;
  auth: OrbitaAuth | null;
};

const OFFLINE: LiveApp = { isLive: false, isAuthLoading: false, auth: null };

export function useLiveApp(): LiveApp {
  if (!HAS_CONVEX || !HAS_CLERK) return OFFLINE;
  return useLiveAppInner();
}

function useLiveAppInner(): LiveApp {
  const auth = useOrbitaAuth();
  const ensureUser = useMutation(appApi.users.getOrCreateCurrentUser);
  const [userReady, setUserReady] = useState(false);

  useEffect(() => {
    if (!auth.isAuthenticated) {
      setUserReady(false);
      return;
    }
    // Crear la fila `users` ANTES de cualquier query (si no, charts.current tira Server Error).
    ensureUser({})
      .then(() => setUserReady(true))
      .catch(() => setUserReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated]);

  return {
    isLive: auth.isAuthenticated && userReady,
    isAuthLoading: !auth.isLoaded || auth.isConnecting,
    auth
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
