import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, useRouter } from "expo-router";

import {
  isAccountSwitch,
  onboardingInputFromBirthData,
  resolveSignInDestination
} from "@/domain/sessionStart";
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
export default function IniciarSesionRoute() {
  const router = useRouter();
  const fontsLoaded = useOrbitaFonts();
  const {
    profile,
    profileOwner,
    createProfile,
    adoptLocalProfile,
    restoreAccountData,
    archiveAccountData,
    resetApp
  } = useAppState();
  const flow = useSignInFlow();
  const hydrate = useSignInHydrate();
  const [hydrateFailed, setHydrateFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Sin backend configurado no existe login: volver a la entrada.
  if (!flow || !hydrate) return <Redirect href="/onboarding" />;
  if (!fontsLoaded) return <View style={styles.fill} />;

  const enter = async () => {
    setHydrateFailed(false);
    const result = await hydrate();
    if (result.status === "error") {
      setHydrateFailed(true);
      return;
    }
    // CAMBIO DE CUENTA en el mismo teléfono. Lo local pertenece a OTRO usuario
    // (su sesión se perdió sin logout explícito, así que nada se archivó): sin
    // esto, su diario y sus guardadas quedarían mezclados en la sesión de quien
    // entra ahora (mergeAccountLists conserva lo "actual"). Se archiva bajo su
    // dueño — no se destruye: si vuelve a entrar, lo recupera intacto — y
    // recién ahí se limpia lo local.
    const switchingAccount = isAccountSwitch({
      localProfileOwner: profileOwner,
      incomingUserId: result.clerkUserId
    });
    if (switchingAccount) {
      try {
        await archiveAccountData(profileOwner);
        await resetApp();
      } catch {
        // Falla cerrado: si no se pudo archivar, NO se entra — antes que
        // arriesgar mezclar los datos de dos cuentas, se ofrece reintentar.
        setHydrateFailed(true);
        return;
      }
    }
    // Tras el reset, el `profile` de este closure es el del usuario anterior:
    // para decidir no existe más.
    const localProfile = switchingAccount ? null : profile;

    // Si esta cuenta ya usó este teléfono, volver su diario y sus lecturas
    // guardadas (archivados al cerrar sesión; no viven en Convex). El id sale
    // del backend (hydrate), no de useAuth: React puede no haber re-renderizado
    // el estado de Clerk todavía en este punto.
    const { profileRestored } = result.clerkUserId
      ? await restoreAccountData(result.clerkUserId)
      : { profileRestored: false };

    switch (
      resolveSignInDestination({
        hasRemoteBirthData: !!result.birthData,
        hasLocalProfile: !!localProfile,
        profileRestored
      })
    ) {
      case "home-remote":
        // El perfil/carta remotos ganan; el snapshot solo aporta diario/lecturas.
        // Queda marcado con su dueño para que el arranque confíe en él.
        await createProfile(onboardingInputFromBirthData(result.birthData!), result.clerkUserId);
        router.replace("/(tabs)");
        break;
      case "home-local":
        // La cuenta no tiene datos en Convex pero este teléfono sí: entrar con
        // lo local (se persiste al backend la próxima vez que se editen datos).
        // Guest-upgrade: la cuenta ADOPTA explícitamente el perfil local acá
        // (el arranque nunca confía en un perfil sin dueño con sesión activa).
        if (localProfile && !profileRestored && result.clerkUserId) {
          await adoptLocalProfile(result.clerkUserId);
        }
        router.replace("/(tabs)");
        break;
      case "resume-onboarding":
        router.replace({ pathname: "/onboarding", params: { resume: "datos" } });
        break;
    }
  };

  // El arranque puede REDIRIGIR acá (perfil con dueño y sin sesión): en ese
  // caso no hay historia y `router.back()` no tendría a dónde volver. La
  // salida siempre existente es la entrada.
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/onboarding");
  };

  // "Crear una cuenta": el alta, sin repetir la entrada (el usuario ya la
  // pasó) y con el email que venía tipeando ya cargado.
  const createAccount = (email: string) => {
    router.replace({
      pathname: "/onboarding",
      params: email ? { nuevo: "1", email } : { nuevo: "1" }
    });
  };

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
