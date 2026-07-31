import { useLocalSearchParams, useRouter } from "expo-router";
import { AccountGate } from "@/components/orbita/AccountGate";
import { WebLoading } from "@/components/web/require-session";
import { SIGN_IN_ROUTE } from "@/domain/appRoutes";
import { SignUpGateScreen } from "@/onboarding/screens/SignUpGateScreen";
import { useAccountFlow } from "@/onboarding/useAccount";

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
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const account = useAccountFlow();
  // El login manda el email tipeado: llega cargado al alta.
  const raw = Array.isArray(params.email) ? params.email[0] : params.email;
  const initialEmail = typeof raw === "string" ? raw : "";

  // Sin backend no hay cuenta que crear: se va al onboarding local.
  if (!account) {
    return <WebLoading />;
  }

  return (
    <SignUpGateScreen
      account={account}
      initialEmail={initialEmail}
      onSignIn={() => router.replace(SIGN_IN_ROUTE as never)}
      // No se navega a mano: al quedar la sesión activa, el resolver reevalúa y
      // `AccountGate` manda al onboarding (o a Home si ya hubiera datos).
      onVerified={() => undefined}
    />
  );
}
