import React, { ReactNode, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { appApi } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import { useOrbitaAuth } from "@/hooks/useOrbitaAuth";

/** Error boundary: si una query real falla, muestra el fallback en vez de blanquear la página. */
class LiveBoundary extends React.Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <>{this.props.fallback}</> : <>{this.props.children}</>;
  }
}

function urlForcedLive() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("live") === "1";
}

/**
 * Elige entre datos mock y datos reales:
 * - Sin Convex → mock.
 * - Con Convex, sin Clerk → live solo con ?live=1.
 * - Con Convex + Clerk → live automático cuando el usuario está autenticado (o ?live=1).
 * Envuelve el live en un error boundary que cae al mock si la query falla.
 */
export function LiveGate({ mock, live }: { mock: ReactNode; live: () => ReactNode }) {
  if (!backendConfig.hasConvex) return <>{mock}</>;
  if (!backendConfig.hasClerk) return urlForcedLive() ? <LiveBoundary fallback={mock}>{live()}</LiveBoundary> : <>{mock}</>;
  return <AuthGate mock={mock} live={live} />;
}

function AuthGate({ mock, live }: { mock: ReactNode; live: () => ReactNode }) {
  const { isLoaded, isAuthenticated } = useOrbitaAuth();
  const ensureUser = useMutation(appApi.users.getOrCreateCurrentUser);
  const [userReady, setUserReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { setUserReady(false); return; }
    // creamos la fila `users` ANTES de correr las queries (si no, charts.current tira Server Error)
    ensureUser({}).then(() => setUserReady(true)).catch(() => setUserReady(true));
  }, [isAuthenticated]);

  if (!isLoaded) return <>{mock}</>;
  if (isAuthenticated) {
    if (!userReady) return <>{mock}</>; // breve, mientras se asegura el usuario
    return <LiveBoundary fallback={mock}>{live()}</LiveBoundary>;
  }
  if (urlForcedLive()) return <LiveBoundary fallback={mock}>{live()}</LiveBoundary>;
  return <>{mock}</>;
}
