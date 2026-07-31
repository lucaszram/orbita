import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, useRouter } from "expo-router";

import { ONBOARDING_ROUTE } from "@/domain/appRoutes";
import { AccountGate } from "@/components/orbita/AccountGate";
import { WebLayoutProvider } from "@/components/web/web-layout-provider";
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
    // El provider va acá porque esta ruta monta el shell del alta SIN pasar por
    // `OnboardingFlow`: sin él `useIsDesktop()` es siempre false y en
    // escritorio la columna nunca se acota — el botón de Google llegaba a medir
    // 1392px de ancho a 1440.
    <WebLayoutProvider>
      <AccountGate surface="auth">
        <SignInSurface />
      </AccountGate>
    </WebLayoutProvider>
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
  const [hydrateFailed, setHydrateFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Sin backend configurado no existe login: volver a la entrada.
  if (!flow || !hydrate) return <Redirect href="/onboarding" />;
  if (!fontsLoaded) return <View style={styles.fill} />;

  /**
   * La sesión quedó activa. NO se corre el bootstrap acá: el dueño único es el
   * provider por encima del gate. Antes esta pantalla tenía su propia instancia
   * del hook, o sea su propio lock, y el archivado podía correr dos veces.
   *
   * Al activarse la sesión el resolver reevalúa y `AccountGate` desmonta esta
   * pantalla para hidratar y navegar.
   */
  const enter = async () => {
    setHydrateFailed(false);
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

  // "Crear una cuenta" entra al alta completa, no a un formulario suelto: la
  // cuenta se crea DENTRO de la secuencia, en su paso original. El email
  // tipeado viaja para no pedirlo dos veces. La ruta ya no rebota a login:
  // el onboarding se monta sin sesión y junta todo en el borrador local.
  const createAccount = (email: string) =>
    void leaveWithoutSignIn(() =>
      router.replace({
        pathname: ONBOARDING_ROUTE,
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
