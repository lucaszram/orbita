import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, H2, MonoLine, Note, OrbitaScreen, Pill, Section } from "@/components/orbita/kit";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { CartaCard } from "@/components/home/CartaCard";
import { useAppData } from "@/domain/appData";
import { useLiveApp } from "@/hooks/useLiveApp";
import { backendConfig } from "@/services/backendProviders";
import { clearFirstRunFlags } from "@/services/firstRun";
import { testingReplay } from "@/services/testingReplay";
import { orbita } from "@/theme/orbita";

export default function PerfilScreen() {
  const { perfil } = useAppData();
  const { auth } = useLiveApp();

  async function handleLogout() {
    try {
      await auth?.signOut();
    } catch {
      // Aún si Clerk falla, salimos a un estado limpio.
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
        {perfil.accountEmail ? (
          <View>
            <Body bone>{auth?.name ?? perfil.accountEmail}</Body>
            {auth?.name ? (
              <Note>
                {perfil.accountEmail.includes("privaterelay.appleid.com")
                  ? "Cuenta conectada con Apple"
                  : perfil.accountEmail}
              </Note>
            ) : null}
            <Pressable onPress={handleLogout} accessibilityRole="button" style={styles.logoutBtn} hitSlop={8}>
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Body bone>Modo invitado · datos solo en este teléfono.</Body>
            {backendConfig.isConfigured ? (
              <Note>Creá tu cuenta al final del onboarding (Editar datos) para guardar tu carta y tus lecturas.</Note>
            ) : null}
            {/* Aun sin email visible (handshake lento / sesión zombie) tiene que existir
                una salida: cierra la sesión de Clerk si la hay y vuelve a la entrada. */}
            <Pressable onPress={handleLogout} accessibilityRole="button" style={styles.logoutBtn} hitSlop={8}>
              <Text style={styles.logoutText}>Cerrar sesión / reiniciar</Text>
            </Pressable>
          </View>
        )}
        <Divider />
        <Pressable onPress={() => router.push("/reading/plus")} accessibilityRole="button">
          <Eyebrow>SUSCRIPCIÓN</Eyebrow>
          <Body bone>{perfil.plan}</Body>
        </Pressable>
        <View style={{ height: orbita.spacing.xl }} />
        <Pill label="EDITAR DATOS" onPress={() => router.push("/onboarding")} />

        {/* ─── TESTING · SACAR ANTES DEL LAUNCH ───────────────────────────────
            Repite el "primer día" COMPLETO sin re-hacer el onboarding: borra los
            flags de primera vez, arma el replay de sesión (la Home trata la carta
            de hoy como no sacada y el flip es local, ver testingReplay.ts) y entra
            a la ceremonia. Ceremonia → QUÉ ES → intro del tarot → flip → EL RITUAL,
            todo con los datos reales. */}
        <Divider />
        <Eyebrow>TESTING (sacar antes del launch)</Eyebrow>
        <Pressable
          onPress={async () => {
            await clearFirstRunFlags();
            testingReplay.arm();
            router.push("/recepcion");
          }}
          accessibilityRole="button"
          style={styles.testingBtn}
          hitSlop={8}
        >
          <Text style={styles.testingText}>REPETIR PRIMER DÍA</Text>
        </Pressable>
        {/* ─── FIN TESTING ──────────────────────────────────────────────────── */}
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
  },
  // TESTING · sacar junto con el botón antes del launch.
  testingBtn: {
    alignSelf: "flex-start",
    borderColor: "rgba(196,106,58,0.6)",
    borderRadius: 999,
    borderStyle: "dashed",
    borderWidth: 1,
    marginTop: orbita.spacing.md,
    paddingHorizontal: orbita.spacing.lg,
    paddingVertical: orbita.spacing.sm
  },
  testingText: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 1
  }
});
