import { Redirect } from "expo-router";
import { OnboardingGate } from "@/onboarding/OnboardingGate";
import { WebLoading, WebNotice } from "@/components/web/require-session";
import { backendConfig } from "@/services/backendProviders";

/**
 * Alta en la web: el MISMO onboarding que el nativo (`OnboardingFlow`, quince
 * pasos). No hay una máquina de estados web aparte.
 *
 * El paso de cuenta (índice 13, `14 / Create Account` en V4.4) usa
 * `useAccountFlow` (hooks clásicos de Clerk: email + contraseña + código), que
 * funcionan igual en web. "Continuar con Google" se suma SÓLO en web y sólo con
 * `EXPO_PUBLIC_ORBITA_GOOGLE_AUTH=true`; sin esa variable el alta por email
 * queda entera igual. El paywall sigue la conducta canónica
 * (`PAYWALL_ENABLED = false`): al terminar va a recepción.
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

  // El gate es COMPARTIDO con el onboarding nativo: si cada plataforma
  // tuviera el suyo, volverían a divergir.
  return <OnboardingGate fallback={<WebLoading />} />;
}
