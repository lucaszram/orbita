import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, H2, MonoLine, Note, OrbitaScreen, Pill, Section } from "@/components/orbita/kit";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { CartaCard } from "@/components/home/CartaCard";
import { useAppData } from "@/domain/appData";
import { useLiveApp } from "@/hooks/useLiveApp";
import { backendConfig } from "@/services/backendProviders";
import { orbita } from "@/theme/orbita";

export default function PerfilScreen() {
  const { perfil } = useAppData();
  const { auth } = useLiveApp();
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
            <Body bone>{perfil.accountEmail}</Body>
            <Pressable onPress={() => auth?.signOut()} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>CERRAR SESIÓN</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Body bone>Modo invitado · datos solo en este teléfono.</Body>
            {backendConfig.isConfigured ? (
              <Note>Creá tu cuenta al final del onboarding (Editar datos) para guardar tu carta y tus lecturas.</Note>
            ) : null}
          </View>
        )}
        <Divider />
        <Pressable onPress={() => router.push("/reading/plus")} accessibilityRole="button">
          <Eyebrow>SUSCRIPCIÓN</Eyebrow>
          <Body bone>{perfil.plan}</Body>
        </Pressable>
        <View style={{ height: orbita.spacing.xl }} />
        <Pill label="EDITAR DATOS" onPress={() => router.push("/onboarding")} />
      </Section>
    </OrbitaScreen>
  );
}

const styles = StyleSheet.create({
  link: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: orbita.spacing.md
  }
});
