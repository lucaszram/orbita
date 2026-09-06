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
import {
  resolvePlanView,
  type ConfirmedPlan,
  type PlanSource,
  type PlanView
} from "@/domain/entitlement";
import {
  ownedValue,
  publishOwnedValue,
  readOwnedValue,
  safeEntitlement,
  type NativeSubscriptionSnapshot,
  type OwnedValue
} from "@/domain/nativeCommerce";
import { liveAppGate, userRowForOwner, type UserRowState } from "@/domain/screenPhase";
import { appApi, NatalChartDoc, SavedReadingListItem } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import {
  clearEntitlementSnapshot,
  readEntitlementSnapshot,
  writeEntitlementSnapshot
} from "@/services/entitlementSnapshot";
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

/**
 * Plan de la cuenta: UNA sola fuente para toda la UI nativa.
 *
 * ## El agujero que cierra
 *
 * `subscriptions.getCurrent` se pedía en cada pantalla que necesitaba saber el
 * plan —el paywall, el bloque de suscripción del perfil, los docs vivos— y cada
 * una repetía por su cuenta la correlación con el dueño de Clerk. Tres copias de
 * la misma verdad, cada una con su propia ventana de "todavía no sé", y ninguna
 * con memoria: al arrancar en frío, quien paga la app veía "Free" hasta que su
 * query resolviera.
 *
 * Acá hay UNA query y UN estado. El plan viaja con su dueño y con su estado de
 * hidratación, porque las dos cosas son parte de la misma verdad: sin saber de
 * quién es el dato, o sin haber leído todavía el snapshot de esta cuenta, la
 * respuesta honesta es "no sé" y no "Free".
 *
 * ## Lo que este estado NO es
 *
 * No es un permiso. `resolved` —el remoto confirmó para esta cuenta— es lo único
 * que habilita cobrar; el snapshot cacheado sólo puede poner una etiqueta. Y el
 * plan jamás se deriva de `RevenueCat.storeIsPro` ni del marcador de compra en
 * vuelo: la tienda dice qué cobró, no qué acceso concede Órbita.
 */
export type EntitlementState = {
  /** Cuenta de Clerk para la que vale todo lo demás. */
  owner: string | null;
  /**
   * Lo que el backend confirmó para ESTE dueño, entero.
   *
   * `undefined` = todavía no sé (query sin resolver, o resultado de otra
   * cuenta). Todo lo que decide plata —comprar, restaurar, abrir el portal— sale
   * de acá y nunca de `effective`.
   */
  remote: NativeSubscriptionSnapshot | null | undefined;
  /** Vista efectiva para PRESENTAR: el remoto si llegó, el snapshot si no. */
  effective: PlanView;
  /** El remoto confirmó para el dueño vigente. Único habilitante de cobro. */
  resolved: boolean;
  /** El snapshot de ESTE dueño ya se leyó del disco (o no hay dueño que leer). */
  hydrated: boolean;
  source: PlanSource;
  /**
   * ¿Se puede nombrar el plan sin especular?
   *
   * Es exactamente "la vista efectiva afirma un plan": `effective !== undefined`.
   * Ni el arranque de Clerk ni la lectura del disco alcanzan por sí solos — con
   * el disco leído y la sesión resuelta, un remoto que todavía no contestó sigue
   * siendo "no sé", y nombrar eso "Free" es el defecto que esto evita (QA23-001:
   * `FREE` visible en el encabezado mientras el entitlement no resolvía). Quien
   * dibuja el plan no muestra nada hasta que esto sea verdad.
   */
  labelReady: boolean;
};

const OFFLINE_ENTITLEMENT: EntitlementState = {
  owner: null,
  // Sin backend no hay plan que consultar: es una respuesta, no una espera —por
  // eso `effective` es `null` y no `undefined`, y por eso el plan SE PUEDE
  // nombrar acá—. Pero `resolved` sigue en falso porque tampoco hay nada que
  // autorice un cobro.
  remote: null,
  effective: null,
  resolved: false,
  hydrated: true,
  source: "unknown",
  labelReady: true
};

const EntitlementContext = createContext<EntitlementState | null>(null);

/** Plan central: montar UNA vez en el root layout, dentro de la sesión. */
export function EntitlementProvider({ children }: { children: ReactNode }) {
  if (!HAS_CONVEX || !HAS_CLERK) return <>{children}</>;
  return <EntitlementProviderInner>{children}</EntitlementProviderInner>;
}

/** Lectura del snapshot local, con su estado de hidratación. */
type SnapshotRead = { hydrated: boolean; plan: ConfirmedPlan | null };

const SNAPSHOT_LOADING: SnapshotRead = { hydrated: false, plan: null };
/** Sin dueño no hay snapshot que leer: la hidratación está completa y vacía. */
const SNAPSHOT_NONE: SnapshotRead = { hydrated: true, plan: null };

function EntitlementProviderInner({ children }: { children: ReactNode }) {
  const { isLive, auth } = useLiveApp();
  const owner = auth?.isSignedIn ? auth.userId ?? null : null;
  /**
   * La ÚNICA `subscriptions.getCurrent` de la UI nativa.
   *
   * Con `skip` sin sesión viva —para no montarla con la cuenta de A— y
   * correlacionada con el dueño de Clerk, porque el `skip` no alcanza: Convex
   * conserva el último valor mientras la nueva suscripción resuelve, así que el
   * plan de A sigue publicado durante uno o varios renders de B.
   */
  const raw = useQuery(appApi.subscriptions.getCurrent, isLive ? {} : "skip");
  const remote = safeEntitlement(raw as NativeSubscriptionSnapshot | null | undefined, owner);

  /**
   * El snapshot leído viaja CON SU DUEÑO.
   *
   * Es la misma regla que la fila `users`: si el dueño publicado no es el de
   * esta sesión, el valor no se lee. La caída es SINCRÓNICA —en el mismo render
   * del cambio de cuenta— porque los efectos corren después, y un render con el
   * plan de A bajo la sesión de B es exactamente lo que no puede pasar.
   */
  const [snapshotSlot, setSnapshotSlot] = useState<OwnedValue<SnapshotRead>>(() =>
    ownedValue(null, SNAPSHOT_LOADING)
  );
  const ownerRef = useRef<string | null>(owner);
  ownerRef.current = owner;
  const cached = owner === null ? SNAPSHOT_NONE : readOwnedValue(snapshotSlot, owner, SNAPSHOT_LOADING);

  useEffect(() => {
    if (!owner) return;
    let alive = true;
    void readEntitlementSnapshot(owner).then((plan) => {
      if (!alive) return;
      setSnapshotSlot((previous) => {
        // Si el remoto ya confirmó para este dueño, lo que hay en memoria es más
        // nuevo que lo que acaba de contestar el disco: no se pisa.
        if (previous.owner === owner && previous.value.hydrated) return previous;
        return publishOwnedValue(previous, owner, ownerRef.current, { hydrated: true, plan });
      });
    });
    return () => {
      alive = false;
    };
  }, [owner]);

  const decision = resolvePlanView({
    remote,
    lastConfirmed: cached.plan,
    hydrated: cached.hydrated
  });

  /**
   * El snapshot se persiste SÓLO desde una respuesta remota confirmada.
   *
   * Las dependencias son escalares a propósito: el objeto de la query cambia de
   * identidad en cada actualización, y con él como dependencia esto escribiría
   * en disco en cada latido.
   */
  const remoteIsPro = remote === undefined ? undefined : remote === null ? null : remote.isPro;
  const snapshotAction = decision.snapshot;
  useEffect(() => {
    if (!owner) return;
    if (snapshotAction === "write" && typeof remoteIsPro === "boolean") {
      const plan: ConfirmedPlan = { isPro: remoteIsPro };
      // Memoria y disco juntos: si la query vuelve a "todavía no sé" —una
      // reconexión, un remonte— el hueco se llena con lo ÚLTIMO confirmado y no
      // con lo que decía el disco cuando montó la pantalla.
      setSnapshotSlot((previous) =>
        publishOwnedValue(previous, owner, ownerRef.current, { hydrated: true, plan })
      );
      void writeEntitlementSnapshot(owner, plan).catch(() => undefined);
      return;
    }
    if (snapshotAction === "clear") {
      setSnapshotSlot((previous) =>
        publishOwnedValue(previous, owner, ownerRef.current, SNAPSHOT_NONE)
      );
      void clearEntitlementSnapshot(owner).catch(() => undefined);
    }
  }, [owner, snapshotAction, remoteIsPro]);

  const view = decision.view;
  const hydrated = cached.hydrated;
  // El plan se puede nombrar cuando ya se sabe cuál es, y sólo entonces.
  //
  // La condición anterior tenía un segundo camino —sesión resuelta y disco leído
  // sin nada guardado— y ése era el que publicaba "Free" mientras la única
  // `getCurrent` seguía en vuelo: una instalación nueva, o cualquier arranque sin
  // snapshot, mostraba el chip del plan gratuito antes de que el backend dijera
  // nada (QA23-001). `undefined` es "no sé", no "Free": mientras la vista efectiva
  // no afirme un plan —remoto confirmado o último confirmado en disco— no hay
  // nombre que dar, y un hueco de un instante es más honesto que un plan
  // inventado. `null` sí es una respuesta —el backend contestó que no hay plan— y
  // ésa se dice Free.
  const labelReady = view !== undefined;

  const value = useMemo<EntitlementState>(
    () => ({
      owner,
      remote,
      effective: view,
      resolved: decision.resolved,
      hydrated,
      source: decision.source,
      labelReady
    }),
    [owner, remote, view, decision.resolved, decision.source, hydrated, labelReady]
  );

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

/**
 * El plan de la cuenta vigente.
 *
 * Sin provider —build sin backend— devuelve el estado offline: sin plan, sin
 * espera y sin nada que autorice un cobro. Ninguna pantalla debe montar su
 * propia `subscriptions.getCurrent`: la correlación con el dueño, la memoria
 * local y el estado de hidratación viven acá y en un solo lugar.
 */
export function useEntitlement(): EntitlementState {
  return useContext(EntitlementContext) ?? OFFLINE_ENTITLEMENT;
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
  const chart = useQuery(appApi.charts.current, isLive ? {} : "skip");
  const birthData = useQuery(appApi.birthData.getCurrent, isLive ? {} : "skip");
  /**
   * El plan NO se vuelve a pedir acá.
   *
   * Tenía su propia `subscriptions.getCurrent` y su propia correlación con el
   * dueño —una copia de lo mismo que hacían el paywall y el perfil—. Ahora sale
   * del provider central: una query, un estado, una sola ventana de "todavía no
   * sé". Se usa el REMOTO y no la vista efectiva: `subscription` alimenta gates
   * de lectura, y un snapshot cacheado no puede abrir nada.
   */
  const { remote, resolved } = useEntitlement();
  return {
    chart: (chart as NatalChartDoc | null | undefined) ?? null,
    birthData: (birthData as LiveAppDocs["birthData"] | undefined) ?? null,
    subscription: (remote as LiveAppDocs["subscription"] | undefined) ?? null,
    birthDataResolved: birthData !== undefined,
    // `undefined` cubre dos casos —la query no resolvió, o el resultado es de
    // otra cuenta— y los dos son "todavía no sé", nunca "no tiene plan".
    subscriptionResolved: resolved
  };
}
