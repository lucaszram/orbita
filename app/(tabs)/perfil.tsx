import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, H2, MonoLine, Note, OrbitaScreen, Pill, Section } from "@/components/orbita/kit";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { CartaCard } from "@/components/home/CartaCard";
import { useAppData } from "@/domain/appData";
import { useAppState } from "@/hooks/useAppState";
import { useLiveApp } from "@/hooks/useLiveApp";
import { backendConfig } from "@/services/backendProviders";
import { orbita } from "@/theme/orbita";

export default function PerfilScreen() {
  const { perfil } = useAppData();
  const { archiveAccountData, resetApp } = useAppState();
  const { auth, isAuthLoading, userError, retryUser } = useLiveApp();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(false);
    try {
      // 1. Archivar PRIMERO, con la sesión todavía viva: el diario y las
      //    lecturas guardadas NO están en Convex; si el snapshot no se puede
      //    escribir (o hay datos sin userId), se aborta el logout — nunca
      //    pérdida silenciosa.
      await archiveAccountData(auth?.userId ?? null);
      // 2. Cerrar Clerk. Un fallo acá también mantiene la sesión y muestra
      //    reintento: no fingimos que salió bien.
      await auth?.signOut();
    } catch {
      setLogoutError(true);
      setLoggingOut(false);
      return;
    }
    // 3. Recién ahora limpiar el estado activo (nada visible para el próximo
    //    usuario; reingresar con esta cuenta en este teléfono lo restaura) y
    //    volver a la entrada estable, sin repetir el video. El invitado puro
    //    nunca ve este botón.
    try {
      await resetApp();
    } catch {
      // El snapshot ya se escribió y el perfil quedó marcado con su dueño en
      // disco (archiveAccountData): aunque esta limpieza falle, el arranque ve
      // "perfil con dueño y sin sesión" y pide login en vez de mostrarlo (ya
      // no existe la purga automática). Si entra OTRA cuenta, el login archiva
      // lo del dueño anterior y limpia antes de restaurar: nadie ve datos ajenos.
    }
    router.replace("/onboarding");
  }

  return (
    <OrbitaScreen>
      <FullBleedHero kind="perfil">
        <MonoLine>{perfil.birthLine}</MonoLine>
      </FullBleedHero>
      <CartaCard />
      <Section style={{ paddingTop: orbita.spacing.lg }}>
        <Eyebrow>PERFIL</Eyebrow>
        <H2>Tu carta,{"\n"}tus datos.</H2>
        <Body>Tus datos de nacimiento afinan toda la lectura. Editá tu cuenta, notificaciones y suscripción.</Body>
        <Note>{perfil.privacy}</Note>
        <Divider />
        <Eyebrow>CUENTA</Eyebrow>
        {auth?.isSignedIn ? (
          <View>
            <Body bone>{auth.name ?? auth.email ?? "Tu cuenta"}</Body>
            {auth.email ? (
              <Note>
                {auth.email.includes("privaterelay.appleid.com") ? "Conectada con Apple" : auth.email}
              </Note>
            ) : null}
            {userError ? (
              <Pressable onPress={retryUser} accessibilityRole="button" hitSlop={8}>
                <Note>No pudimos sincronizar tu cuenta. Tocá para reintentar.</Note>
              </Pressable>
            ) : isAuthLoading ? (
              <Note>Sincronizando con tu cielo…</Note>
            ) : null}
            {logoutError ? (
              <Note>
                No pudimos cerrar sesión de forma segura. Tus datos siguen acá; probá de nuevo.
              </Note>
            ) : null}
            <Pressable onPress={handleLogout} accessibilityRole="button" style={styles.logoutBtn} hitSlop={8}>
              <Text style={styles.logoutText}>
                {loggingOut ? "Un momento…" : logoutError ? "Reintentar cerrar sesión" : "Cerrar sesión"}
              </Text>
            </Pressable>
          </View>
        ) : isAuthLoading ? (
          // Clerk/Convex todavía cargando: estado neutro, NUNCA afirmar invitado.
          <Body bone>Conectando tu cuenta…</Body>
        ) : (
          <View>
            <Body bone>Modo invitado · datos solo en este teléfono.</Body>
            {backendConfig.isConfigured ? (
              <Pressable
                onPress={() => router.push("/iniciar-sesion")}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Note>¿Ya tenés cuenta? Iniciá sesión para recuperar tu carta y tus lecturas.</Note>
              </Pressable>
            ) : null}
          </View>
        )}
        <Divider />
        <Pressable onPress={() => router.push("/reading/plus")} accessibilityRole="button">
          <Eyebrow>SUSCRIPCIÓN</Eyebrow>
          <Body bone>{perfil.plan}</Body>
        </Pressable>
        <View style={{ height: orbita.spacing.xl }} />
        <Pill label="EDITAR DATOS" onPress={() => router.push("/editar-datos")} />
      </Section>
    </OrbitaScreen>
  );
}

const styles = StyleSheet.create({
  logoutBtn: {
    alignSelf: "flex-start",
    borderColor: orbita.colors.line,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: orbita.spacing.md,
    paddingHorizontal: orbita.spacing.lg,
    paddingVertical: orbita.spacing.sm
  },
  logoutText: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 1
  }
});
