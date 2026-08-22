import { AccountGate } from "@/components/orbita/AccountGate";
import { OnboardingFlow } from "@/onboarding/OnboardingFlow";

/**
 * Puerta del onboarding, montada por `/onboarding` en las dos plataformas.
 *
 * Ya no la comparte `/empezar`: esa ruta quedó como entrada auth-first y
 * redirige primero a `SIGN_UP_ROUTE`, así que los pasos inmersivos se montan
 * sólo acá, después del alta.
 *
 * Decide con el resolver único. El alta es auth-first: la cuenta se crea ANTES,
 * en la superficie `auth`, así que los pasos inmersivos sólo se montan con
 * sesión activa y con una cuenta donde persistir. Por eso `destinationAllows`
 * rechaza acá el destino `sign-in` —que significa "todavía no hay sesión"— y lo
 * manda a `auth`: primero la cuenta, después el alta. Sólo entra el destino
 * `onboarding`: el alta en curso todavía sin carta, y el build sin backend
 * configurado, que no tiene estado remoto que consultar.
 *
 * Sigue intacta la protección que motivó todo esto: una cuenta COMPLETA resuelve
 * `app-home` y nunca monta el onboarding, así que el alta no puede sobrescribir
 * sus datos natales. Una cuenta que YA existía y quedó incompleta resuelve
 * `edit-birth-data` y va al editor, porque `completeBirthData` es create-only y
 * volver al alta terminaría en conflicto.
 */
export function OnboardingGate({ fallback }: { fallback?: React.ReactNode } = {}) {
  return (
    <AccountGate surface="onboarding" loading={fallback}>
      <OnboardingFlow />
    </AccountGate>
  );
}
