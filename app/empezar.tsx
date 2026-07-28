import { Redirect } from "expo-router";
import { OnboardingWithBackend } from "@/components/web/orbita-onboarding";
import { WebNotice } from "@/components/web/require-session";
import { backendConfig } from "@/services/backendProviders";

export default function EmpezarRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/onboarding" />;
  }

  // Sin Convex+Clerk no hay dónde guardar la cuenta ni la carta. Antes se caía
  // a `OrbitaOnboarding` suelto: la persona completaba los quince pasos y todo
  // se descartaba en silencio. Preferimos decir que no está disponible.
  if (!backendConfig.isConfigured) {
    return (
      <WebNotice
        title="Órbita no está disponible"
        body="No pudimos conectar con el servidor, así que todavía no podemos crear tu carta. Volvé a intentar en un momento."
      />
    );
  }

  return <OnboardingWithBackend />;
}
