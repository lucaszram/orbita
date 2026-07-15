import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, useRouter } from "expo-router";

import { onboardingInputFromBirthData } from "@/domain/sessionStart";
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
  const { profile, createProfile, restoreAccountData } = useAppState();
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
    // Si esta cuenta ya usó este teléfono, volver su diario y sus lecturas
    // guardadas (archivados al cerrar sesión; no viven en Convex). El id sale
    // del backend (hydrate), no de useAuth: React puede no haber re-renderizado
    // el estado de Clerk todavía en este punto.
    const { profileRestored } = result.clerkUserId
      ? await restoreAccountData(result.clerkUserId)
      : { profileRestored: false };
    if (result.birthData) {
      // El perfil/carta remotos ganan; el snapshot solo aporta diario/lecturas.
      await createProfile(onboardingInputFromBirthData(result.birthData));
      router.replace("/(tabs)");
    } else if (profile || profileRestored) {
      // La cuenta no tiene datos en Convex pero este teléfono sí: entrar con
      // lo local (se persiste al backend la próxima vez que se editen datos).
      router.replace("/(tabs)");
    } else {
      router.replace({ pathname: "/onboarding", params: { resume: "datos" } });
    }
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

  return <SignInScreen flow={flow} onSignedIn={enter} onBack={() => router.back()} />;
}

const styles = StyleSheet.create({
  errorBody: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  errorNote: { marginTop: 12 },
  fill: { backgroundColor: orbita.bg, flex: 1 },
  retry: { marginTop: 30 }
});
