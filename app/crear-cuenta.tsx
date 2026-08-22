import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AccountGate } from "@/components/orbita/AccountGate";
import { WebLoading } from "@/components/web/require-session";
import { SIGN_IN_ROUTE } from "@/domain/appRoutes";
import { clearDraft } from "@/domain/onboardingDraft";
import { SignUpGateScreen } from "@/onboarding/screens/SignUpGateScreen";
import { backendConfig } from "@/services/backendProviders";

/**
 * `/crear-cuenta` — la ENTRADA canónica de quien no tiene sesión.
 *
 * El alta es auth-first: la cuenta se crea ACÁ, con la UI oficial de Clerk, y
 * recién DESPUÉS vienen los 13 pasos de datos natales. Antes era al revés —el
 * onboarding arrancaba sin sesión y la cuenta se pedía en el anteúltimo paso,
 * con todo lo respondido colgando de un borrador local—; ahora cuando empiezan
 * los pasos inmersivos ya hay sesión y una cuenta donde persistir. "Empezar" en
 * la landing y "Crear cuenta" en el login abren esta ruta, no el onboarding.
 *
 * Es superficie `auth`, igual que el login: sólo se monta mientras el destino
 * resuelto es `sign-in`. Si alguien con sesión abre esta ruta, `AccountGate` lo
 * manda a donde le corresponde (onboarding, editor de datos natales o Home,
 * según el estado autoritativo de la cuenta), así que el alta no puede
 * sobrescribir una cuenta terminada.
 */
export default function CrearCuentaRoute() {
  return (
    <AccountGate surface="auth" loading={<WebLoading />}>
      <SignUpGateInner />
    </AccountGate>
  );
}

function SignUpGateInner() {
  const router = useRouter();
  // `?email=`: quien llega desde el login con el email ya escrito no lo vuelve
  // a tipear. Es sólo un prellenado del campo de Clerk — el dueño del alta
  // sigue siendo Clerk, así que no se valida ni se persiste acá.
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : undefined;

  /**
   * El borrador anónimo legacy se ABANDONA al montar esta superficie.
   *
   * Con el alta auth-first ya no se produce ninguno —los pasos no se montan sin
   * sesión—, pero una instalación vieja puede tener uno colgado en
   * `sessionStorage` (web) o en memoria del proceso (nativo). Si sobrevive a
   * este punto, la cuenta que se está por crear lo adopta: `clientDraftId` viaja
   * al cierre del alta y `completeSignupFromDraft` copia los datos natales DE LA
   * FILA DEL BORRADOR —el borrador anónimo no tiene dueño, así que pasa el
   * control de pertenencia— y la cuenta recién nacida se queda con la fecha, el
   * lugar y la hora de otra persona.
   *
   * Se limpia ANTES de que exista la identidad, que es lo que hace correcta la
   * declaración: acá todavía no hay nadie a quien ese borrador pueda pertenecer.
   *
   * `clearDraft` toca SÓLO el borrador de onboarding. No archiva ni resetea
   * nada: los datos locales de una cuenta dueña de este teléfono (perfil,
   * guardadas, diario) son de esa cuenta y se resuelven en el login, cuando
   * alguien se va sin haber probado que es su dueño (ver `leaveWithoutSignIn` en
   * `app/iniciar-sesion.tsx`). Esta ruta no los mira.
   */
  useEffect(() => {
    clearDraft();
  }, []);

  // Sin backend no hay proveedor real que montar.
  if (!backendConfig.isConfigured) {
    return <WebLoading />;
  }

  // La UI oficial de Clerk activa la sesión por su cuenta. No se navega a mano:
  // al quedar activa, el resolver reevalúa y `AccountGate` manda al onboarding
  // (o al editor de datos / Home, según el estado autoritativo de la cuenta).
  return <SignUpGateScreen email={email} onSignIn={() => router.replace(SIGN_IN_ROUTE as never)} />;
}
