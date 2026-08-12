import { AccountGate } from "@/components/orbita/AccountGate";
import { OnboardingFlow } from "@/onboarding/OnboardingFlow";

/**
 * Puerta del onboarding, compartida por `/empezar` (web) y `/onboarding` (nativo).
 *
 * Decide con el resolver único: sin sesión → montar el flujo (los pasos
 * inmersivos y los datos se juntan en el borrador, y la cuenta se crea en su
 * paso original con la UI oficial de Clerk); con un alta en curso todavía sin
 * carta → montar el flujo; con la carta persistida (`chart_ready`) → Home.
 *
 * Una cuenta COMPLETA nunca monta el onboarding: es la protección que evita
 * sobrescribir datos natales, y sigue igual. Una cuenta que YA existía y quedó
 * incompleta tampoco entra acá: va a `/editar-datos`, porque el alta es
 * create-only y volvería con conflicto.
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
