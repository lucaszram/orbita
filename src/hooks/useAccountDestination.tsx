import { useQuery } from "convex/react";
import {
  destinationAllows,
  resolveAccountDestination,
  type AccountDestination
} from "@/domain/accountDestination";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appApi } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";

/**
 * Alimenta el resolver único con el estado real. Cada superficie de entrada usa
 * ESTE hook: si cada una armara su propio estado, volverían a divergir.
 */
export function useAccountDestination(): {
  destination: AccountDestination;
  /** Reintento tras un fallo de recuperación de la cuenta. */
  retry: () => void;
} {
  const { isLive, isAuthLoading, userError, retryUser, auth } = useLiveApp();
  // Sólo se consulta con sesión confirmada: sin ella la query no aplica.
  const birthData = useQuery(appApi.birthData.getCurrent, isLive ? {} : "skip");

  const destination = resolveAccountDestination({
    backendConfigured: backendConfig.isConfigured,
    // `isAuthLoading` cubre Clerk cargando, el handshake con Convex y la
    // creación de la fila `users`: todo eso es "todavía no se sabe".
    clerkLoaded: !isAuthLoading,
    signedIn: isLive && !!auth?.isSignedIn,
    birthDataResolved: birthData !== undefined,
    hasBirthData: !!birthData,
    // Una fila `users` que no se pudo crear es un fallo de recuperación: la
    // cuenta existe en Clerk pero no se puede leer su estado.
    recoveryFailed: userError
  });

  return { destination, retry: retryUser };
}

export { destinationAllows };
