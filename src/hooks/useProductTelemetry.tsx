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
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useMutation } from "convex/react";
import {
  createOpaqueId,
  enqueueProductEvent,
  isForegroundReturn,
  isOpaqueId,
  normalizePlatform,
  parseStoredQueue,
  PRODUCT_EVENT_QUEUE_LIMIT,
  removeProductEvent,
  SESSION_ONCE_EVENTS,
  type ProductEventName,
  type ProductEventPayload
} from "@/domain/productEvents";
import { proposedApi } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import { useLiveApp } from "@/hooks/useLiveApp";

/**
 * Eventos de producto v1 (docs/handoff-claude-product-events.md): el bridge
 * entre la app y `telemetry.track`. Best-effort SIEMPRE: ningún camino de acá
 * puede bloquear navegación, onboarding ni reveal, y ningún fallo se muestra.
 *
 * - `installationId`: UUID propio, creado una vez y persistido. Sin IDFA,
 *   email, Clerk id ni datos del dispositivo.
 * - `sessionId`: nuevo en frío y en cada background → active real.
 * - Idempotencia: cada hecho lleva un `eventId` fijo; el reintento manda el
 *   MISMO payload. `{ recorded: false }` = el backend ya lo tenía; también
 *   sale de la cola.
 * - Vive DEBAJO de `OrbitaSessionProvider` para esperar el estado autenticado
 *   de Clerk sin crear otro listener (la apertura autenticada vincula la
 *   instalación con la cuenta; una anónima se vincula después).
 */

const INSTALLATION_ID_KEY = "orbita:installation-id";
const QUEUE_KEY = "orbita:product-events";
/** `app_opened` espera a Clerk hasta acá; después sale anónimo igual. */
const APP_OPEN_AUTH_WAIT_MS = 8000;

const HAS_CONVEX = backendConfig.hasConvex;

const APP_VERSION: string | undefined =
  Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? undefined;
const BUILD_NUMBER: string | undefined = Constants.nativeBuildVersion ?? undefined;

type TrackExtras = { onboardingStep?: number; entryPoint?: string };
export type TrackProductEvent = (eventName: ProductEventName, extras?: TrackExtras) => void;

type TelemetryValue = { track: TrackProductEvent };

const NOOP: TelemetryValue = { track: () => undefined };
const TelemetryContext = createContext<TelemetryValue>(NOOP);

/** Sin provider (o sin Convex) devuelve un no-op: los call sites no se enteran. */
export function useProductTelemetry(): TelemetryValue {
  return useContext(TelemetryContext);
}

export function ProductTelemetryProvider({ children }: { children: ReactNode }) {
  if (!HAS_CONVEX) return <>{children}</>;
  return <ProductTelemetryInner>{children}</ProductTelemetryInner>;
}

function ProductTelemetryInner({ children }: { children: ReactNode }) {
  const sendEvent = useMutation(proposedApi.trackEvent);
  const live = useLiveApp();

  // Sesión en curso (sincrónica: el arranque en frío ES una sesión nueva).
  const sessionRef = useRef<string | null>(null);
  if (sessionRef.current === null) sessionRef.current = createOpaqueId();
  // Dedupe por sesión de los eventos "una vez por sesión".
  const sessionSentRef = useRef<Set<ProductEventName>>(new Set());
  // Cola durable + buffer de eventos creados antes de cargar installationId.
  const queueRef = useRef<ProductEventPayload[]>([]);
  const pendingRef = useRef<Array<Omit<ProductEventPayload, "installationId">>>([]);
  const installIdRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const flushingRef = useRef(false);
  const appStateRef = useRef<string>(AppState.currentState);

  const [ready, setReady] = useState(false);
  // Cambia con cada regreso real background → active (re-dispara app_opened).
  const [sessionEpoch, setSessionEpoch] = useState(0);
  // Venció la espera de Clerk para la apertura de esta sesión.
  const [authWaitExpired, setAuthWaitExpired] = useState(false);

  const persistQueue = useCallback(async () => {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queueRef.current));
    } catch {
      // sin storage: la cola sigue en memoria y se pierde al cerrar; aceptable
    }
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current || !readyRef.current) return;
    flushingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const head = queueRef.current[0];
        // `recorded: true | false` — ambos retiran el evento (false = el
        // backend ya lo había recibido). Solo un error lo deja para reintentar.
        await sendEvent(head);
        queueRef.current = removeProductEvent(queueRef.current, head.eventId);
        await persistQueue();
      }
    } catch {
      // sin red / backend caído: la cola queda tal cual (mismo eventId) y se
      // reintenta en el próximo evento, foreground o sesión autenticada
    } finally {
      flushingRef.current = false;
    }
  }, [sendEvent, persistQueue]);

  const track = useCallback<TrackProductEvent>(
    (eventName, extras) => {
      try {
        if (SESSION_ONCE_EVENTS.has(eventName)) {
          if (sessionSentRef.current.has(eventName)) return;
          sessionSentRef.current.add(eventName);
        }
        const base: Omit<ProductEventPayload, "installationId"> = {
          eventId: createOpaqueId(),
          eventName,
          sessionId: sessionRef.current ?? undefined,
          occurredAt: Date.now(),
          platform: normalizePlatform(Platform.OS),
          ...(APP_VERSION ? { appVersion: APP_VERSION } : {}),
          ...(BUILD_NUMBER ? { buildNumber: BUILD_NUMBER } : {}),
          ...(extras?.onboardingStep !== undefined ? { onboardingStep: extras.onboardingStep } : {}),
          ...(extras?.entryPoint ? { entryPoint: extras.entryPoint } : {})
        };
        const installationId = installIdRef.current;
        if (!installationId) {
          if (pendingRef.current.length < PRODUCT_EVENT_QUEUE_LIMIT) pendingRef.current.push(base);
          return;
        }
        queueRef.current = enqueueProductEvent(queueRef.current, { ...base, installationId });
        void persistQueue();
        void flush();
      } catch {
        // analytics jamás rompe la app
      }
    },
    [persistQueue, flush]
  );

  // Init: installationId (una sola vez por instalación) + cola sobreviviente.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let id = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
        if (!isOpaqueId(id)) {
          id = createOpaqueId();
          // Si esto falla, NO usamos un id volátil (cada arranque parecería
          // una instalación nueva): la sesión queda sin telemetría.
          await AsyncStorage.setItem(INSTALLATION_ID_KEY, id);
        }
        const stored = parseStoredQueue(await AsyncStorage.getItem(QUEUE_KEY), Date.now());
        if (!alive) return;
        installIdRef.current = id;
        queueRef.current = stored;
        for (const p of pendingRef.current) {
          queueRef.current = enqueueProductEvent(queueRef.current, { ...p, installationId: id });
        }
        pendingRef.current = [];
        readyRef.current = true;
        setReady(true);
        void persistQueue();
        void flush();
      } catch {
        // sin storage: la app funciona igual, sin eventos esta sesión
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Regreso real background → active = sesión nueva (y reintento de la cola).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (isForegroundReturn(appStateRef.current, next)) {
        sessionRef.current = createOpaqueId();
        sessionSentRef.current = new Set();
        setAuthWaitExpired(false);
        setSessionEpoch((e) => e + 1);
        void flush();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [flush]);

  // Tope de espera de Clerk para la apertura de cada sesión.
  useEffect(() => {
    const timer = setTimeout(() => setAuthWaitExpired(true), APP_OPEN_AUTH_WAIT_MS);
    return () => clearTimeout(timer);
  }, [sessionEpoch]);

  // app_opened: uno por sesión. Espera a que Clerk resuelva (así Convex vincula
  // instalación ↔ cuenta) salvo que la espera venza: anónimo también vale.
  useEffect(() => {
    if (!ready) return;
    if (sessionSentRef.current.has("app_opened")) return;
    if (live.isAuthLoading && !authWaitExpired) return;
    track("app_opened");
  }, [ready, sessionEpoch, live.isAuthLoading, authWaitExpired, track]);

  // Sesión recién autenticada: drenar lo anónimo pendiente (se vincula ahora).
  useEffect(() => {
    if (live.isLive) void flush();
  }, [live.isLive, flush]);

  const value = useMemo(() => ({ track }), [track]);
  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}
