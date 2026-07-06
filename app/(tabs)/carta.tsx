import { View } from "react-native";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, H2, OrbitaScreen, Pill, Section, Triad } from "@/components/orbita/kit";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { useAppData } from "@/domain/appData";
import { orbita } from "@/theme/orbita";

export default function CartaScreen() {
  const { carta } = useAppData();
  return (
    <OrbitaScreen>
      <FullBleedHero kind="carta">
        <Triad triad={carta.triad} />
      </FullBleedHero>
      <Section style={{ paddingTop: orbita.spacing.lg }}>
        <Eyebrow>TU CARTA BASE</Eyebrow>
        <H2>Tus puntos{"\n"}de partida.</H2>
        <Body>{carta.intro}</Body>
        <Divider />
        <Eyebrow>{carta.casaDestacada.label}</Eyebrow>
        <Body bone>{carta.casaDestacada.copy}</Body>
        <View style={{ height: orbita.spacing.xl }} />
        <Pill label="VER POSICIONES" onPress={() => router.push("/reading/carta")} />
      </Section>
    </OrbitaScreen>
  );
}
