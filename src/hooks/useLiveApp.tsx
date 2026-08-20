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
import { safeEntitlement } from "@/domain/nativeCommerce";
import { liveAppGate, userRowForOwner, type UserRowState } from "@/domain/screenPhase";
import { appApi, NatalChartDoc, SavedReadingListItem } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import { OrbitaAuth, useOrbitaAuth } from "@/hooks/useOrbitaAuth";

/**
 * Capa de sesión compartida: live ⟺ Convex configurado + sesión Clerk
 * autenticada en Convex. En web la consume `RequireSession`, que sin sesión
 * manda a login; en nativo, sin sesión la app sigue local-first.
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
  /**
   * El estado de la fila viaja CON SU DUEÑO.
   *
   * Era un `UserRowState` suelto. En un cambio A → B, el `ready` de A seguía
   * publicado hasta que el efecto corriera: durante ese render `isLive` era
   * true con la sesión de B, así que las queries salían y las pantallas se
   * daban por vivas con la fila de A. El efecto llega DESPUÉS del render; la
   * caída tiene que ser sincrónica.
   */
  const [rowSlot, setRowSlot] = useState<{ owner: string | null; state: UserRowState }>({
    owner: null,
    state: "idle"
  });
  const [attempt, setAttempt] = useState(0);
  const owner = auth.userId ?? null;
  // Derivado SÍNCRONO: si el dueño publicado no es el de esta sesión, la fila
  // vuelve a "idle" en ESTE render, sin esperar a ningún efecto.
  const userRow: UserRowState = userRowForOwner(rowSlot, owner);

  useEffect(() => {
    if (!auth.isAuthenticated || !owner) {
      setRowSlot({ owner: null, state: "idle" });
      return;
    }
    let cancelled = false;
    setRowSlot({ owner, state: "pending" });
    // Crear la fila `users` ANTES de cualquier query (si no, charts.current
    // tira Server Error). Si falla de verdad, queda en error con reintento:
    // nunca `ready` sin usuario.
    (async () => {
      for (let i = 0; i < ENSURE_USER_ATTEMPTS; i++) {
        /**
         * Cortar ANTES de cada intento, no sólo antes de publicar.
         *
         * Un reintento en vuelo cuando la sesión cambia —o cuando el boundary
         * desmonta todo por una eliminación pendiente— volvía a llamar
         * `getOrCreateUser` con el token viejo, que es justo lo que podía
         * recrear una cuenta recién borrada. Es defensa SECUNDARIA: la que de
         * verdad cierra el caso es el fence del backend, porque otro dispositivo
         * o pestaña no ve este `cancelled`.
         */
        if (cancelled) return;
        try {
          const fila = await ensureUser({});
          if (cancelled) return;
          /**
           * Se INSPECCIONA la respuesta, no sólo que no haya tirado.
           *
           * `getOrCreateCurrentUser` deriva la cuenta de `ctx.auth`. Si el
           * handshake de Convex todavía estaba autenticado como A cuando salió
           * la llamada, la fila que vuelve es la de A —y marcarla `ready` daba
           * por viva la sesión de B con la cuenta anterior detrás. Sólo publica
           * quien coincide con el dueño capturado.
           */
          if (fila?.clerkUserId === owner) {
            setRowSlot({ owner, state: "ready" });
            return;
          }
          // Identidad todavía no propagada: se reintenta como cualquier fallo.
          await new Promise((resolve) => setTimeout(resolve, 700 * (i + 1)));
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 700 * (i + 1)));
        }
      }
      if (!cancelled) setRowSlot({ owner, state: "error" });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated, owner, attempt]);

  const retryUser = useCallback(() => setAttempt((a) => a + 1), []);
  const value = useMemo(() => ({ auth, userRow, retryUser }), [auth, userRow, retryUser]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useLiveApp(): LiveApp {
  const session = useContext(SessionContext);
  if (!session) return OFFLINE;
  const { auth, userRow, retryUser } = session;
  // Gate puro (domain/screenPhase): una sesión autenticada con la fila users
  // todavía en "idle" (primer render, antes de que corra el efecto) o
  // "pending" es CARGA — el render inicial jamás puede caer en "invitado".
  return { ...liveAppGate(auth, userRow), retryUser, auth };
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

/**
 * `localDate` y `timezone` son los CANÓNICOS del servidor (`getTodayContext`).
 * Antes salían de `toISODate()` + `deviceTimezone()`: la lectura se escribía
 * bajo la fecha del dispositivo y se leía bajo otra, así que la Home podía
 * quedar vacía o duplicar filas al viajar.
 */
export function useLiveHome(isLive: boolean, localDate: string, timezone: string, holdLive = false): LiveHome {
  if (!HAS_CONVEX) return NO_LIVE_HOME;
  return useLiveHomeInner(isLive, localDate, timezone, holdLive);
}

function useLiveHomeInner(isLive: boolean, localDate: string, timezone: string, holdLive: boolean): LiveHome {
  const doc = useQuery(appApi.readings.getToday, isLive ? { localDate } : "skip");
  const generateToday = useMutation(appApi.readings.generateToday);
  const save = useMutation(appApi.readings.save);
  const triedGenerate = useRef<string | null>(null);
  // Última lectura live vista (por fecha): una reconexión o red lenta NO debe
  // reemplazar datos live por mocks mientras la query vuelve a resolver.
  const lastLive = useRef<{ date: string; payload: unknown } | null>(null);

  useEffect(() => {
    // El intento se recuerda POR FECHA: al cruzar la medianoche hay que generar
    // el día nuevo, y un flag booleano lo bloqueaba para siempre.
    if (isLive && doc === null && triedGenerate.current !== localDate) {
      triedGenerate.current = localDate;
      generateToday({ localDate, timezone }).catch(() => {
        // sin red / deployment desincronizado: la Home sigue con el engine local
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, doc, localDate, timezone]);

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
  /**
   * La suscripción resolvió **y** corresponde a la cuenta vigente.
   *
   * `subscription: null` significa dos cosas distintas —"no hay plan" y
   * "todavía no sé (o es de otra cuenta)"— y colapsarlas hacía que una ventana
   * A → B se leyera como "esta cuenta es Free". Este flag las separa sin
   * cambiarle el tipo a `subscription`.
   */
  subscriptionResolved: boolean;
};

const NO_LIVE_DOCS: LiveAppDocs = {
  chart: null,
  birthData: null,
  subscription: null,
  birthDataResolved: false,
  subscriptionResolved: false
};

export function useLiveAppDocs(isLive: boolean): LiveAppDocs {
  if (!HAS_CONVEX) return NO_LIVE_DOCS;
  return useLiveAppDocsInner(isLive);
}

function useLiveAppDocsInner(isLive: boolean): LiveAppDocs {
  const { auth } = useLiveApp();
  const chart = useQuery(appApi.charts.current, isLive ? {} : "skip");
  const birthData = useQuery(appApi.birthData.getCurrent, isLive ? {} : "skip");
  const rawSubscription = useQuery(appApi.subscriptions.getCurrent, isLive ? {} : "skip");
  // La suscripción se CORRELACIONA con el dueño de Clerk: la query conserva su
  // último valor mientras la nueva resuelve, y el plan de A no puede publicarse
  // bajo la sesión de B ni siquiera como dato de lectura.
  const owner = auth?.isSignedIn ? auth.userId ?? null : null;
  const subscription = safeEntitlement(rawSubscription, owner);
  return {
    chart: (chart as NatalChartDoc | null | undefined) ?? null,
    birthData: (birthData as LiveAppDocs["birthData"] | undefined) ?? null,
    subscription: (subscription as LiveAppDocs["subscription"] | undefined) ?? null,
    birthDataResolved: birthData !== undefined,
    // `undefined` cubre dos casos —la query no resolvió, o el resultado es de
    // otra cuenta— y los dos son "todavía no sé", nunca "no tiene plan".
    subscriptionResolved: subscription !== undefined
  };
}
