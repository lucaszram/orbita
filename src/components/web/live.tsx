import React, { ReactNode, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { appApi } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import { useOrbitaAuth } from "@/hooks/useOrbitaAuth";

/** Spinner estable sobre fondo oscuro — evita mostrar el mock mientras resuelve auth/query. */
export function LiveLoading() {
  return (
    <View style={loadingStyles.wrap}>
      <ActivityIndicator color="#D69A6A" />
    </View>
  );
}
const loadingStyles = StyleSheet.create({
  wrap: { alignItems: "center", backgroundColor: "#07080A", flex: 1, justifyContent: "center" }
});

function urlForcedLive() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("live") === "1";
}

/** Error boundary: si una query real falla, cae al fallback (mock) para no romper la página. */
class LiveBoundary extends React.Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <>{this.props.fallback}</> : <>{this.props.children}</>;
  }
}

/**
 * Elige entre datos mock y datos reales, **auth-aware**:
 * - Sin Convex → mock.
 * - Con Convex, sin Clerk → live solo con ?live=1.
 * - Con Convex + Clerk → **logueado ves live por defecto** (sin ?live); sin sesión, mock (demo).
 * Mientras carga, spinner estable (nunca el mock) para no saltar mock→real.
 */
export function LiveGate({ mock, live }: { mock: ReactNode; live: () => ReactNode }) {
  if (!backendConfig.hasConvex) return <>{mock}</>;
  if (!backendConfig.hasClerk) return urlForcedLive() ? <LiveBoundary fallback={mock}>{live()}</LiveBoundary> : <>{mock}</>;
  return <AuthGate mock={mock} live={live} />;
}

function AuthGate({ mock, live }: { mock: ReactNode; live: () => ReactNode }) {
  const { isLoaded, isSignedIn, isAuthenticated } = useOrbitaAuth();
  const ensureUser = useMutation(appApi.users.getOrCreateCurrentUser);
  const [userReady, setUserReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { setUserReady(false); return; }
    // creamos la fila `users` ANTES de correr las queries (si no, charts.current tira Server Error)
    ensureUser({}).then(() => setUserReady(true)).catch(() => setUserReady(true));
  }, [isAuthenticated]);

  if (!isLoaded) return <LiveLoading />;
  // Decidimos mock vs live por la sesión de CLERK (isSignedIn), que resuelve rápido.
  if (!isSignedIn) {
    // Sin sesión → demo mock (estable). ?live=1 fuerza el intento live (para testing).
    return urlForcedLive() ? <LiveBoundary fallback={mock}>{live()}</LiveBoundary> : <>{mock}</>;
  }
  // Logueado en Clerk: esperamos el handshake de Convex + la fila users con SPINNER,
  // nunca el mock (así no hay salto mock→real durante ese instante).
  if (!isAuthenticated || !userReady) return <LiveLoading />;
  return <LiveBoundary fallback={mock}>{live()}</LiveBoundary>;
}
