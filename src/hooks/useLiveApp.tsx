import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useMutation, useQuery } from "convex/react";
import { appApi, NatalChartDoc, SavedReadingListItem } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import { OrbitaAuth, useOrbitaAuth } from "@/hooks/useOrbitaAuth";

/**
 * Capa live nativa (no hay `?live=1` como en web): live ⟺ Convex configurado
 * + sesión Clerk autenticada en Convex. Mock/local-first: sin sesión, la app
 * se comporta exactamente igual que siempre.
 *
 * Hotfix build 11: la sesión es CENTRAL (`OrbitaSessionProvider` en el root
 * layout). Antes cada consumidor corría su propio `ensureUser` con estado
 * propio, y un fallo se marcaba `userReady=true` igual: la app podía fingir
 * live sin usuario o degradar a guest según qué componente preguntara.
 * Ahora hay UN estado compartido, con reintentos y error explícito.
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
  /** Clerk cargando, Convex confirmando o `users` creándose: NO afirmar "invitado". */
  isAuthLoading: boolean;
  /** `ensureUser` agotó los reintentos: mostrar reintento, nunca fingir listo. */
  userError: boolean;
  retryUser: () => void;
  auth: OrbitaAuth | null;
};

const OFFLINE: LiveApp = {
  isLive: false,
  isAuthLoading: false,
  userError: false,
  retryUser: () => undefined,
  auth: null
};

type UserRowState = "idle" | "pending" | "ready" | "error";

type SessionValue = {
  auth: OrbitaAuth;
  userRow: UserRowState;
  retryUser: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

/** Sesión central: montar UNA vez en el root layout, dentro de BackendProviders. */
export function OrbitaSessionProvider({ children }: { children: ReactNode }) {
  if (!HAS_CONVEX || !HAS_CLERK) return <>{children}</>;
  return <SessionProviderInner>{children}</SessionProviderInner>;
}

const ENSURE_USER_ATTEMPTS = 3;

function SessionProviderInner({ children }: { children: ReactNode }) {
  const auth = useOrbitaAuth();
  const ensureUser = useMutation(appApi.users.getOrCreateCurrentUser);
  const [userRow, setUserRow] = useState<UserRowState>("idle");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!auth.isAuthenticated) {
      setUserRow("idle");
      return;
    }
    let cancelled = false;
    setUserRow("pending");
    // Crear la fila `users` ANTES de cualquier query (si no, charts.current
    // tira Server Error). Si falla de verdad, queda en error con reintento:
    // nunca `ready` sin usuario.
    (async () => {
      for (let i = 0; i < ENSURE_USER_ATTEMPTS; i++) {
        try {
          await ensureUser({});
          if (!cancelled) setUserRow("ready");
          return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 700 * (i + 1)));
        }
      }
      if (!cancelled) setUserRow("error");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated, attempt]);

  const retryUser = useCallback(() => setAttempt((a) => a + 1), []);
  const value = useMemo(() => ({ auth, userRow, retryUser }), [auth, userRow, retryUser]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useLiveApp(): LiveApp {
  const session = useContext(SessionContext);
  if (!session) return OFFLINE;
  const { auth, userRow, retryUser } = session;
  return {
    isLive: auth.isAuthenticated && userRow === "ready",
    isAuthLoading:
      !auth.isLoaded || auth.isConnecting || (auth.isAuthenticated && userRow === "pending"),
    userError: userRow === "error",
    retryUser,
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

export function useLiveHome(isLive: boolean, localDate: string, holdLive = false): LiveHome {
  if (!HAS_CONVEX) return NO_LIVE_HOME;
  return useLiveHomeInner(isLive, localDate, holdLive);
}

function useLiveHomeInner(isLive: boolean, localDate: string, holdLive: boolean): LiveHome {
  const doc = useQuery(appApi.readings.getToday, isLive ? { localDate } : "skip");
  const generateToday = useMutation(appApi.readings.generateToday);
  const save = useMutation(appApi.readings.save);
  const triedGenerate = useRef(false);
  // Última lectura live vista (por fecha): una reconexión o red lenta NO debe
  // reemplazar datos live por mocks mientras la query vuelve a resolver.
  const lastLive = useRef<{ date: string; payload: unknown } | null>(null);

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
  if (record?.payload) {
    lastLive.current = { date: localDate, payload: record.payload };
  }
  const held =
    doc === undefined && (isLive || holdLive) && lastLive.current?.date === localDate
      ? lastLive.current.payload
      : null;
  return {
    payload: record?.payload ?? held,
    saveLive: isLive ? saveLive : null
  };
}

export type LiveSavedReadings = {
  /** Filas de `readings.listSaved`, o null sin live / mientras la query resuelve. */
  rows: SavedReadingListItem[] | null;
  /** true solo mientras hay live y el archivo remoto todavía no llegó. */
  loading: boolean;
  /** Borra una fila remota; true si el backend la eliminó (null sin live). */
  unsaveRemote: ((savedReadingId: string) => Promise<boolean>) | null;
};

const NO_LIVE_SAVED: LiveSavedReadings = { rows: null, loading: false, unsaveRemote: null };

export function useLiveSavedReadings(isLive: boolean): LiveSavedReadings {
  if (!HAS_CONVEX) return NO_LIVE_SAVED;
  return useLiveSavedReadingsInner(isLive);
}

function useLiveSavedReadingsInner(isLive: boolean): LiveSavedReadings {
  const rows = useQuery(appApi.readings.listSaved, isLive ? {} : "skip");
  const unsave = useMutation(appApi.readings.unsave);

  const unsaveRemote = useCallback(
    async (savedReadingId: string) => {
      try {
        return (await unsave({ savedReadingId })) === true;
      } catch {
        // sin red: la lápida local queda pendiente y se reintenta después
        return false;
      }
    },
    [unsave]
  );

  return {
    rows: Array.isArray(rows) ? rows : null,
    loading: isLive && rows === undefined,
    unsaveRemote: isLive ? unsaveRemote : null
  };
}

export type LiveAppDocs = {
  chart: NatalChartDoc | null;
  birthData: {
    birthDate?: string;
    birthTime?: string;
    birthPlaceLabel?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  } | null;
  subscription: { entitlement?: string; status?: string } | null;
  /** La query de birthData ya resolvió (aunque el doc sea null). */
  birthDataResolved: boolean;
};

const NO_LIVE_DOCS: LiveAppDocs = {
  chart: null,
  birthData: null,
  subscription: null,
  birthDataResolved: false
};

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
    subscription: (subscription as LiveAppDocs["subscription"] | undefined) ?? null,
    birthDataResolved: birthData !== undefined
  };
}
