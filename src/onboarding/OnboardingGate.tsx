import { AccountGate } from "@/components/orbita/AccountGate";
import { OnboardingFlow } from "@/onboarding/OnboardingFlow";

/**
 * Puerta del onboarding, compartida por `/empezar` (web) y `/onboarding` (nativo).
 *
 * Decide con el resolver único: sin sesión → montar el flujo (los pasos
 * inmersivos y los datos se juntan en el borrador local, y la cuenta se crea en
 * su paso original); con sesión sin `birthData` → montar el flujo; con sesión y
 * `birthData` → Home de la app.
 *
 * Una cuenta COMPLETA nunca monta el onboarding: es la protección que evita
 * sobrescribir datos natales, y sigue igual.
 *
 * `sticky` porque la cuenta se crea DENTRO del flujo: al activarse la sesión en
 * el paso 13 el resolver pasa por `loading` un instante, y sin esto el gate
 * desmontaba el alta entera con todo lo cargado adentro.
 */
export function OnboardingGate({ fallback }: { fallback?: React.ReactNode } = {}) {
  return (
    <AccountGate surface="onboarding" sticky loading={fallback}>
      <OnboardingFlow />
    </AccountGate>
  );
}
