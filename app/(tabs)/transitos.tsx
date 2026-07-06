import { View } from "react-native";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, H2, MonoLine, Note, OrbitaScreen, Pill, Section } from "@/components/orbita/kit";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { useAppData } from "@/domain/appData";
import { orbita } from "@/theme/orbita";

export default function TransitosScreen() {
  const { transitos } = useAppData();
  return (
    <OrbitaScreen>
      <FullBleedHero kind="transitos">
        <MonoLine>{transitos.planetsRow}</MonoLine>
      </FullBleedHero>
      <Section style={{ paddingTop: orbita.spacing.lg }}>
        <Eyebrow>TRÁNSITOS DE HOY</Eyebrow>
        <H2>{transitos.headline}</H2>
        <Body>{transitos.intro}</Body>
        <Note>Basado en tus datos de nacimiento y el cielo de hoy.</Note>
        <Divider />
        <Eyebrow>DESTACADO</Eyebrow>
        <Body bone>{transitos.destacado}</Body>
        <View style={{ height: orbita.spacing.xl }} />
        <Pill label="VER POR ÁREA" onPress={() => router.push("/reading/transitos")} />
      </Section>
    </OrbitaScreen>
  );
}
