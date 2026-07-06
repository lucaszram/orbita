import { View } from "react-native";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, H2, MonoLine, OrbitaScreen, Pill, Section } from "@/components/orbita/kit";
import { HeroImage } from "@/components/orbita/HeroImage";
import { useAppData } from "@/domain/appData";
import { orbita } from "@/theme/orbita";

export default function TransitosScreen() {
  const { transitos } = useAppData();
  return (
    <OrbitaScreen>
      <Section>
        <View style={{ alignItems: "center", marginBottom: orbita.spacing.xl }}>
          <HeroImage kind="transitos" size={200} />
        </View>
        <MonoLine>{transitos.planetsRow}</MonoLine>
        <View style={{ height: orbita.spacing.xl }} />
        <Eyebrow>TRÁNSITOS DE HOY</Eyebrow>
        <H2>{transitos.headline}</H2>
        <Body>{transitos.intro}</Body>
        <Divider />
        <Eyebrow>DESTACADO</Eyebrow>
        <Body bone>{transitos.destacado}</Body>
        <View style={{ height: orbita.spacing.xl }} />
        <Pill label="VER POR ÁREA" onPress={() => router.push("/reading/transitos")} />
      </Section>
    </OrbitaScreen>
  );
}
