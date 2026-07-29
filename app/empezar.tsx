import { Redirect } from "expo-router";
import { useQuery } from "convex/react";
import { OnboardingFlow } from "@/onboarding/OnboardingFlow";
import { WebLoading, WebNotice } from "@/components/web/require-session";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appApi } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";

/**
 * Alta en la web: el MISMO onboarding que el nativo (`OnboardingFlow`, quince
 * pasos). No hay una máquina de estados web aparte.
 *
 * El paso de cuenta usa `useAccountFlow` (hooks clásicos de Clerk: email +
 * contraseña + código), que funcionan igual en web; el login social está
 * apagado, que era lo único atado a `expo-auth-session`. El paywall sigue la
 * conducta canónica (`PAYWALL_ENABLED = false`): al terminar va a recepción.
 */
export default function EmpezarRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/onboarding" />;
  }

  if (!backendConfig.isConfigured) {
    // Sin Convex+Clerk no hay dónde guardar la cuenta ni la carta: se dice, en
    // vez de dejar completar quince pasos y descartarlos en silencio.
    return (
      <WebNotice
        title="Órbita no está disponible"
        body="No pudimos conectar con el servidor, así que todavía no podemos crear tu carta. Volvé a intentar en un momento."
      />
    );
  }

  return <EmpezarGate />;
}

/**
 * Una cuenta que YA tiene datos natales no vuelve al alta: el onboarding es
 * create-only (`ONBOARDING_BIRTH_DATA_CONFLICT` del lado del backend) y
 * recorrerlo de nuevo sólo puede terminar en un conflicto o en una
 * sobrescritura. Los cambios intencionales viven en `/editar-datos`.
 */
function EmpezarGate() {
  const { isLive, isAuthLoading } = useLiveApp();
  const birthData = useQuery(appApi.birthData.getCurrent, isLive ? {} : "skip");

  // Mientras la sesión o el dato resuelven no se afirma nada: mostrar el alta y
  // después redirigir sería un salto delante del usuario.
  if (isAuthLoading) return <WebLoading />;
  if (isLive && birthData === undefined) return <WebLoading />;
  if (isLive && birthData) return <Redirect href="/home" />;

  return <OnboardingFlow />;
}
