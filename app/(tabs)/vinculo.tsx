import { View } from "react-native";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, H2, MonoLine, OrbitaScreen, Pill, Section } from "@/components/orbita/kit";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { useAppData } from "@/domain/appData";
import { orbita } from "@/theme/orbita";

export default function VinculoScreen() {
  const { vinculo } = useAppData();
  return (
    <OrbitaScreen>
      <FullBleedHero kind="vinculo">
        <MonoLine>☉ Escorpio        ⟷        ☉ Libra</MonoLine>
      </FullBleedHero>
      <Section style={{ paddingTop: orbita.spacing.lg }}>
        <Eyebrow>VÍNCULO</Eyebrow>
        <H2>{vinculo.headline}</H2>
        <Body>{vinculo.body}</Body>
        <Divider />
        <Eyebrow>ENERGÍA COMPARTIDA</Eyebrow>
        <Body bone>{vinculo.energiaCompartida}</Body>
        <View style={{ height: orbita.spacing.xl }} />
        <Pill label="VER EL VÍNCULO DE HOY" onPress={() => router.push("/reading/vinculo-result")} />
      </Section>
    </OrbitaScreen>
  );
}
