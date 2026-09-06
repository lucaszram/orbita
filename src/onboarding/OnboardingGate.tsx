import { AccountGate } from "@/components/orbita/AccountGate";
import { OnboardingFlow } from "@/onboarding/OnboardingFlow";

/**
 * Puerta del onboarding, compartida por `/empezar` (web) y `/onboarding` (nativo).
 *
 * Decide con el resolver único: sin sesión → montar el acceso auth-first; con
 * un alta en curso todavía sin datos natales → montar el flujo. Cuando el
 * resumen persiste esos datos, el resolver ya habilita la app, pero este gate
 * conserva el onboarding montado hasta mostrar Antes/Después y la paywall; el
 * CTA final hace la salida explícita a Carta.
 *
 * Una cuenta COMPLETA nunca monta el onboarding: es la protección que evita
 * sobrescribir datos natales, y sigue igual. Una cuenta que YA existía y quedó
 * incompleta tampoco entra acá: va a `/editar-datos`, porque el alta es
 * create-only y volvería con conflicto.
 *
 * `sticky` sostiene tanto los estados transitorios como esa transición final.
 * No habilita un deep link de una cuenta completa: la continuidad sólo existe
 * después de que esta instancia del onboarding llegó a montarse legítimamente.
 */
export function OnboardingGate({ fallback }: { fallback?: React.ReactNode } = {}) {
  return (
    <AccountGate surface="onboarding" sticky loading={fallback}>
      <OnboardingFlow />
    </AccountGate>
  );
}
