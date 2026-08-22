import { useLocalSearchParams, useRouter } from "expo-router";
import { AccountGate } from "@/components/orbita/AccountGate";
import { WebLoading } from "@/components/web/require-session";
import { SIGN_IN_ROUTE } from "@/domain/appRoutes";
import { SignUpGateScreen } from "@/onboarding/screens/SignUpGateScreen";
import { backendConfig } from "@/services/backendProviders";

/**
 * Formulario de alta suelto. NO es la entrada del alta.
 *
 * El camino canónico crea la cuenta DENTRO del onboarding, en su paso original
 * (índice 13): la experiencia inmersiva engancha primero y la cuenta se pide
 * cuando ya hay una carta que guardar. "Empezar" en la landing y "Crear una
 * cuenta" en el login abren el onboarding completo, no esta ruta.
 *
 * Sigue existiendo para quien llegue con el link directo: tras verificar el
 * email queda sesión activa y el resolver decide el destino (una cuenta nueva
 * va al onboarding). Si alguien con sesión abre esta ruta, `AccountGate` lo
 * manda a donde le corresponde.
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

  // Sin backend no hay proveedor real que montar.
  if (!backendConfig.isConfigured) {
    return <WebLoading />;
  }

  // La UI oficial de Clerk activa la sesión por su cuenta. No se navega a mano:
  // al quedar activa, el resolver reevalúa y `AccountGate` manda al onboarding
  // (o al editor de datos / Home, según el estado autoritativo de la cuenta).
  return <SignUpGateScreen email={email} onSignIn={() => router.replace(SIGN_IN_ROUTE as never)} />;
}
