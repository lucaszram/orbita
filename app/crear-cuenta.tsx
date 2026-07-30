import { useLocalSearchParams, useRouter } from "expo-router";
import { AccountGate } from "@/components/orbita/AccountGate";
import { WebLoading } from "@/components/web/require-session";
import { SIGN_IN_ROUTE } from "@/domain/appRoutes";
import { SignUpGateScreen } from "@/onboarding/screens/SignUpGateScreen";
import { useAccountFlow } from "@/onboarding/useAccount";

/**
 * Alta de cuenta: la PUERTA anterior al onboarding, no un paso interno.
 *
 * Tras verificar el email queda sesión activa y el resolver decide el destino
 * (una cuenta nueva normalmente va al onboarding). Si alguien con sesión abre
 * esta ruta, `AccountGate` lo manda a donde le corresponde.
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
