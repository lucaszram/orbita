import { Redirect } from "expo-router";
import { OnboardingFlow } from "@/onboarding/OnboardingFlow";
import { WebNotice } from "@/components/web/require-session";
import { backendConfig } from "@/services/backendProviders";

/**
 * Alta en la web: el MISMO onboarding que el nativo.
 *
 * Antes acá vivía un flujo web propio de 12 pasos (`orbita-onboarding.tsx`) con
 * otra copy, otros assets y otro orden. Ahora se monta `OnboardingFlow`, que es
 * la máquina de estados canónica de 15 pasos.
 *
 * No hace falta adaptador de autenticación: el paso de cuenta usa
 * `useAccountFlow`, que va contra los hooks clásicos de Clerk (email +
 * contraseña + código) y funcionan igual en web. El login social está apagado
 * (`SOCIAL_LOGIN_ENABLED = false`), que era lo único atado a `expo-auth-session`.
 *
 * El paywall sigue la conducta canónica de la app: `PAYWALL_ENABLED = false`,
 * así que al terminar se entra directo a la recepción. No se reintroduce la
 * pantalla de pago web.
 */
export default function EmpezarRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/onboarding" />;
  }

  // Sin Convex+Clerk no hay dónde guardar la cuenta ni la carta: se dice, en
  // vez de dejar completar quince pasos y descartarlos en silencio.
  if (!backendConfig.isConfigured) {
    return (
      <WebNotice
        title="Órbita no está disponible"
        body="No pudimos conectar con el servidor, así que todavía no podemos crear tu carta. Volvé a intentar en un momento."
      />
    );
  }

  return <OnboardingFlow />;
}
