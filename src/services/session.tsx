import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { appApi } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import { OrbitaAuth, useOrbitaAuth } from "@/hooks/useOrbitaAuth";

/**
 * Sesión de Órbita — UNA sola máquina de estados para toda la app.
 *
 * El incidente del 2026-07-13 (docs/incidente-home-carga-2026-07-13.md) salió de acá:
 * cada pantalla instanciaba su propio `useLiveApp()` con un `userReady` local, y el
 * booleano `isLive` no distinguía "invitado" de "todavía autenticando". Resultado:
 * durante el handshake o una reconexión las pantallas montaban MOCKS, al llegar la
 * sesión los desmontaban y remontaban live, y cada remontaje reiniciaba acciones
 * largas (se vieron 3 `daily.getGuide` en paralelo y varios `getOrCreateCurrentUser`).
 *
 * La regla ahora:
 *   - `guest`        → invitado CONFIRMADO (Clerk cargó y no hay sesión). Único estado
 *                      en el que se pueden mostrar mocks.
 *   - `booting`      → todavía no sabemos (Clerk cargando, handshake Convex, ensureUser).
 *   - `live`         → sesión confirmada + fila `users` garantizada.
 *   - `reconnecting` → hubo sesión y se está recuperando: NUNCA degradar a mock.
 *   - `error`        → `ensureUser` falló de verdad: error visible + reintento
 *                      (antes un catch lo marcaba como listo igual).
 */
export type SessionStatus = "booting" | "guest" | "live" | "reconnecting" | "error";

export type OrbitaSession = {
  status: SessionStatus;
  /** Compat: `status === "live"`. */
  isLive: boolean;
  /** Compat: booting o reconnecting. */
  isAuthLoading: boolean;
  auth: OrbitaAuth | null;
  /** Reintenta `ensureUser` tras un `status === "error"`. */
  retrySession: () => void;
};

const GUEST_SESSION: OrbitaSession = {
  status: "guest",
  isLive: false,
  isAuthLoading: false,
  auth: null,
  retrySession: () => {}
};

const SessionContext = createContext<OrbitaSession>(GUEST_SESSION);

export function useOrbitaSession(): OrbitaSession {
  return useContext(SessionContext);
}

/** Montar UNA vez, dentro de BackendProviders (necesita Clerk + Convex arriba). */
export function OrbitaSessionProvider({ children }: { children: ReactNode }) {
  // Constantes de módulo: la rama es estable durante toda la vida de la app.
  if (!backendConfig.hasConvex || !backendConfig.hasClerk) {
    // Sin backend configurado la app ES invitada; el default del contexto alcanza.
    return <>{children}</>;
  }
  return <SessionInner>{children}</SessionInner>;
}

function SessionInner({ children }: { children: ReactNode }) {
  const auth = useOrbitaAuth();
  const ensureUser = useMutation(appApi.users.getOrCreateCurrentUser);
  const [ensure, setEnsure] = useState<"idle" | "pending" | "ok" | "error">("idle");
  const [retryTick, setRetryTick] = useState(0);
  // La fila `users` ya existe: una reconexión NO necesita (ni debe) re-crearla.
  const ensured = useRef(false);
  // Una vez live, cualquier caída transitoria es "reconnecting", nunca "guest".
  const wasLive = useRef(false);

  useEffect(() => {
    if (!auth.isAuthenticated) return; // conservar `ensured` a través de reconexiones
    if (ensured.current) {
      setEnsure("ok");
      return;
    }
    let alive = true;
    setEnsure("pending");
    ensureUser({})
      .then(() => {
        if (!alive) return;
        ensured.current = true;
        setEnsure("ok");
      })
      .catch((e) => {
        // ANTES: catch → userReady=true (mentira que dejaba la app "lista" rota).
        console.warn("[orbita] ensureUser falló:", e?.message ?? e);
        if (alive) setEnsure("error");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated, retryTick]);

  const status: SessionStatus = useMemo(() => {
    const pending = (): SessionStatus => (wasLive.current ? "reconnecting" : "booting");
    if (!auth.isLoaded) return pending();
    if (!auth.isSignedIn) return "guest";
    if (auth.isConnecting) return pending();
    if (!auth.isAuthenticated) return pending();
    if (ensure === "error") return "error";
    if (ensure !== "ok") return pending();
    return "live";
  }, [auth.isLoaded, auth.isSignedIn, auth.isConnecting, auth.isAuthenticated, ensure]);

  useEffect(() => {
    if (status === "live") wasLive.current = true;
    if (status === "guest") wasLive.current = false; // sign-out real: vuelve a ser invitado
  }, [status]);

  const retrySession = useCallback(() => setRetryTick((t) => t + 1), []);

  const value = useMemo<OrbitaSession>(
    () => ({
      status,
      isLive: status === "live",
      isAuthLoading: status === "booting" || status === "reconnecting",
      auth,
      retrySession
    }),
    [status, auth, retrySession]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
