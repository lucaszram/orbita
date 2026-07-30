import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, useRouter } from "expo-router";

import { ONBOARDING_ROUTE, SIGN_UP_ROUTE } from "@/domain/appRoutes";
import { AccountGate } from "@/components/orbita/AccountGate";
import { useAccountBootstrap } from "@/hooks/useAccountBootstrap";
import { useAppState } from "@/hooks/useAppState";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { CTA } from "@/onboarding/components/CTA";
import { Screen } from "@/onboarding/components/Screen";
import { Body, Title } from "@/onboarding/components/Type";
import { SignInScreen } from "@/onboarding/screens/SignInScreen";
import { orbita } from "@/onboarding/theme";
import { useSignInFlow, useSignInHydrate } from "@/onboarding/useAccount";

/**
 * Puerta "Ya tengo cuenta" (hotfix build 11). Monta la SignInScreen que ya
 * existía sin conectar: email + código restaura la MISMA cuenta (un email
 * inexistente muestra error, no crea cuenta silenciosa — useSignInFlow).
 * Con datos en Convex se entra derecho a la Home con esos datos; una cuenta
 * sin datos continúa el alta desde los datos con la sesión activa.
 */
/**
 * Un usuario ya autenticado NUNCA debe montar la pantalla de login: veía
 * "Tu sesión ya está activa" con un botón `Entrar`. El gate resuelve el destino
 * autoritativo (Home si la cuenta está completa, onboarding si no) antes de
 * renderizar cualquier UI de ingreso.
 */
export default function IniciarSesionRoute() {
  return (
    <AccountGate surface="auth">
      <SignInSurface />
    </AccountGate>
  );
}

function SignInSurface() {
  const router = useRouter();
  const fontsLoaded = useOrbitaFonts();
  // El archivado/restauración/hidratación vive en `useAccountBootstrap`, no acá:
  // es el mismo camino que usa la entrada con sesión ya activa.
  const { profileOwner, archiveAccountData, resetApp } = useAppState();
  const flow = useSignInFlow();
  const hydrate = useSignInHydrate();
  const bootstrap = useAccountBootstrap();
  const [hydrateFailed, setHydrateFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Sin backend configurado no existe login: volver a la entrada.
  if (!flow || !hydrate) return <Redirect href="/onboarding" />;
  if (!fontsLoaded) return <View style={styles.fill} />;

  const enter = async () => {
    setHydrateFailed(false);
    // Mismo bootstrap que la entrada con sesión ya activa: traer lo remoto,
    // separar los datos si entra otra cuenta, restaurar lo archivado e hidratar
    // el perfil local. Antes esta lógica vivía SÓLO acá, y por eso un navegador
    // nuevo con sesión activa entraba a Home sin perfil local y rebotaba.
    const ok = await bootstrap.run();
    if (!ok) {
      setHydrateFailed(true);
      return;
    }
    // El destino lo decide el resolver en el próximo render: con `birthData`
    // remoto va a Home, sin él al onboarding. No se navega a mano.
  };

  /**
   * Salir del login SIN iniciar sesión (crear cuenta u volver a la entrada).
   *
   * Si este teléfono tiene un perfil con dueño, quien se va NO probó ser ese
   * dueño: se archiva lo suyo bajo su cuenta (recuperable al volver a entrar,
   * no se destruye) y se limpia antes de soltar el teléfono. Sin esto, el alta
   * de una cuenta nueva heredaba las guardadas y el diario del anterior:
   * `createProfile` solo reemplaza perfil + dueño. Es el camino MÁS probable
   * — justamente el que no puede loguearse toca "Crear una cuenta".
   */
  const leaveWithoutSignIn = async (go: () => void) => {
    if (profileOwner) {
      try {
        await archiveAccountData(profileOwner);
        await resetApp();
      } catch {
        // Falla cerrado: antes que dejar datos ajenos a la vista, no se sale.
        setHydrateFailed(true);
        return;
      }
    }
    go();
  };

  // El arranque puede REDIRIGIR acá (perfil con dueño y sin sesión): en ese
  // caso no hay historia y `router.back()` no tendría a dónde volver. La
  // salida siempre existente es la entrada.
  const back = () =>
    void leaveWithoutSignIn(() => {
      if (router.canGoBack()) router.back();
      else router.replace(ONBOARDING_ROUTE);
    });

  // "Crear una cuenta" va a la PUERTA de alta, no al onboarding: quien no tiene
  // sesión no puede pasar por una ruta protegida, que lo rebotaría al login.
  const createAccount = (email: string) =>
    void leaveWithoutSignIn(() =>
      router.replace({
        pathname: SIGN_UP_ROUTE,
        params: email ? { email } : undefined
      } as never)
    );

  if (hydrateFailed) {
    return (
      <Screen wash={0.6}>
        <View style={styles.errorBody}>
          <Title>No pudimos{"\n"}traer tu cuenta.</Title>
          <Body style={styles.errorNote}>
            Tu sesión quedó iniciada, pero no llegamos a leer tus datos. Revisá tu conexión y probá de
            nuevo.
          </Body>
          <View style={styles.retry}>
            <CTA
              label={retrying ? "Un momento…" : "Reintentar"}
              onPress={
                retrying
                  ? undefined
                  : () => {
                      setRetrying(true);
                      void enter().finally(() => setRetrying(false));
                    }
              }
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <SignInScreen
      flow={flow}
      onSignedIn={enter}
      onCreateAccount={createAccount}
      onBack={back}
    />
  );
}

const styles = StyleSheet.create({
  errorBody: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  errorNote: { marginTop: 12 },
  fill: { backgroundColor: orbita.bg, flex: 1 },
  retry: { marginTop: 30 }
});
