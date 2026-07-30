import { AccountGate } from "@/components/orbita/AccountGate";
import { OnboardingFlow } from "@/onboarding/OnboardingFlow";

/**
 * Puerta del onboarding, compartida por `/empezar` (web) y `/onboarding` (nativo).
 *
 * Decide con el resolver único: sin sesión → login; con sesión y `birthData` →
 * Home de la app; con sesión sin datos → montar el flujo. Una cuenta completa
 * nunca monta el onboarding, que es lo que permitía sobrescribir datos natales.
 */
export function OnboardingGate({ fallback }: { fallback?: React.ReactNode } = {}) {
  return (
    <AccountGate surface="onboarding" loading={fallback}>
      <OnboardingFlow />
    </AccountGate>
  );
}
