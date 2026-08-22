import {
  destinationAllows,
  resolveAccountDestination,
  type AccountDestination
} from "@/domain/accountDestination";
import { applySessionResilience, type SessionConfidence } from "@/domain/sessionResilience";
import { useAppState } from "@/hooks/useAppState";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useSessionResilience } from "@/hooks/useSessionResilience";
import { backendConfig } from "@/services/backendProviders";

/**
 * Alimenta el resolver único con el estado real. Cada superficie de entrada usa
 * ESTE hook: si cada una armara su propio estado, volverían a divergir.
 *
 * El estado autoritativo de la cuenta (`onboarding.getCompletionStatus`) y el
 * plazo de confirmación ya no viven acá: los publica `SessionResilienceProvider`
 * (`@/hooks/useSessionResilience`), montado una sola vez en el layout raíz. Este
 * hook se monta en CADA `AccountGate`, así que tener la consulta adentro
 * significaba una suscripción y un `setTimeout` por gate — y con ellos, dos
 * ideas distintas de "la cuenta ya resolvió" conviviendo en el mismo árbol.
 */
export function useAccountDestination(): {
  destination: AccountDestination;
  /** Reintento tras un fallo de recuperación de la cuenta. */
  retry: () => void;
  /** Qué se sabe de la sesión ahora mismo (QA23-007). */
  confidence: SessionConfidence;
} {
  const { isLive, isAuthLoading, userError, auth } = useLiveApp();
  const { isReady, profile, profileOwner } = useAppState();
  const { completion, confidence, retry } = useSessionResilience();

  const base = resolveAccountDestination({
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

  /**
   * La resiliencia se aplica DESPUÉS y sólo sobre un "todavía no sé".
   *
   * Un destino resuelto manda siempre: `sign-in` sigue mandando al login (Clerk
   * confirmó que no hay sesión, y eso no es un fallo de red), `onboarding` al
   * alta y `bootstrap` al aislamiento. Lo único que degrada son `loading` y
   * `retry`, que es donde vivía el spinner infinito y la pantalla de error que
   * tapaba la app entera con la sesión guardada en el llavero y sin red.
   */
  return { destination: applySessionResilience(base, confidence), retry, confidence };
}

export { destinationAllows };
