import { OnboardingGate } from "@/onboarding/OnboardingGate";

/**
 * Onboarding oficial: flujo inmersivo V4.4 (`src/onboarding/`).
 *
 * Pasa por `OnboardingGate`, el mismo que usa `/empezar` en web: una cuenta que
 * ya tiene datos natales no puede volver al alta. Antes esta ruta montaba el
 * flujo directo, así que la protección existía sólo en web.
 */
export default function OnboardingRoute() {
  return <OnboardingGate />;
}
