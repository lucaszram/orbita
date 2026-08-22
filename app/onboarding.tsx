import { OnboardingGate } from "@/onboarding/OnboardingGate";

/**
 * Onboarding oficial: flujo inmersivo V4.4 (`src/onboarding/`).
 *
 * Esta ruta monta `OnboardingGate` en las dos plataformas y es la única que lo
 * hace: una cuenta que ya tiene datos natales no puede volver al alta. `/empezar`
 * ya no lo comparte —quedó como entrada auth-first y redirige primero a
 * `SIGN_UP_ROUTE`—, así que los pasos inmersivos se montan sólo acá, después de
 * crear la cuenta.
 */
export default function OnboardingRoute() {
  return <OnboardingGate />;
}
