import { View } from "react-native";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, H2, MonoLine, OrbitaScreen, Pill, Section } from "@/components/orbita/kit";
import { HeroImage } from "@/components/orbita/HeroImage";
import { useAppData } from "@/domain/appData";
import { orbita } from "@/theme/orbita";

export default function VinculoScreen() {
  const { vinculo } = useAppData();
  return (
    <OrbitaScreen>
      <Section>
        <View style={{ alignItems: "center", marginBottom: orbita.spacing.xl }}>
          <HeroImage kind="vinculo" size={200} />
        </View>
        <MonoLine>☉ Escorpio        ⟷        ☉ Libra</MonoLine>
        <View style={{ height: orbita.spacing.xl }} />
        <Eyebrow>VÍNCULO</Eyebrow>
        <H2>{vinculo.headline}</H2>
        <Body>{vinculo.body}</Body>
        <Divider />
        <Eyebrow>ENERGÍA COMPARTIDA</Eyebrow>
        <Body bone>{vinculo.energiaCompartida}</Body>
        <View style={{ height: orbita.spacing.xl }} />
        <Pill label="AGREGAR PERSONA" onPress={() => router.push("/reading/vinculo-add")} />
      </Section>
    </OrbitaScreen>
  );
}
