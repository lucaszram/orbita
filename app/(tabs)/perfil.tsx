import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, H2, MonoLine, Note, OrbitaScreen, Pill, Section } from "@/components/orbita/kit";
import { HeroImage } from "@/components/orbita/HeroImage";
import { useAppData } from "@/domain/appData";
import { orbita } from "@/theme/orbita";

export default function PerfilScreen() {
  const { perfil } = useAppData();
  return (
    <OrbitaScreen>
      <Section>
        <View style={{ alignItems: "center", marginBottom: orbita.spacing.xl }}>
          <HeroImage kind="perfil" size={200} />
        </View>
        <MonoLine>{perfil.birthLine}</MonoLine>
        <Note>{perfil.privacy}</Note>
        <View style={{ height: orbita.spacing.lg }} />
        <Eyebrow>PERFIL</Eyebrow>
        <H2>Tu carta,{"\n"}tus datos.</H2>
        <Body>Tus datos de nacimiento afinan toda la lectura. Editá tu cuenta, notificaciones y suscripción.</Body>
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
