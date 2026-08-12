import { useQuery } from "convex/react";
import {
  destinationAllows,
  resolveAccountDestination,
  type AccountDestination
} from "@/domain/accountDestination";
import { readClientDraftId } from "@/domain/onboardingDraft";
import type { OnboardingCompletion } from "@/domain/onboardingReadiness";
import { useAppState } from "@/hooks/useAppState";
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
  const { isReady, profile, profileOwner } = useAppState();
  // Estado autoritativo persistido. Sólo se consulta con sesión confirmada.
  // El `clientDraftId` distingue un alta iniciada en este flujo (vuelve al
  // onboarding) de una cuenta preexistente incompleta (va al editor de datos).
  const completion = useQuery(
    appApi.onboarding.getCompletionStatus,
    isLive ? { clientDraftId: readClientDraftId() ?? undefined } : "skip"
  ) as OnboardingCompletion | undefined;

  const destination = resolveAccountDestination({
    backendConfigured: backendConfig.isConfigured,
    // `isAuthLoading` cubre Clerk cargando, el handshake con Convex y la
    // creación de la fila `users`: todo eso es "todavía no se sabe".
    clerkLoaded: !isAuthLoading,
    signedIn: isLive && !!auth?.isSignedIn,
    completionResolved: completion !== undefined,
    completion,
    // "El perfil local es de ESTA cuenta". `undefined` mientras el storage no
    // se leyó. Un perfil de otra cuenta (o sin dueño) NO cuenta como listo: hay
    // que archivar el ajeno y hidratar el propio antes de entrar.
    localProfileReady: !isReady
      ? undefined
      : !!profile && !!profileOwner && profileOwner === auth?.userId,
    // Datos locales de otra cuenta (o de un guest sin dueño) con sesión activa:
    // hay que aislarlos antes de elegir destino. Incluye el caso de una cuenta
    // creada desde `/crear-cuenta` en un dispositivo que ya tenía datos.
    localProfileForeign: !isReady
      ? undefined
      : !!profile && profileOwner !== (auth?.userId ?? null),
    // Una fila `users` que no se pudo crear es un fallo de recuperación: la
    // cuenta existe en Clerk pero no se puede leer su estado.
    recoveryFailed: userError
  });

  return { destination, retry: retryUser };
}

export { destinationAllows };
