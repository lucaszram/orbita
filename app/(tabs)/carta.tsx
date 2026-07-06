import { View } from "react-native";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, H2, OrbitaScreen, Pill, Section, Triad } from "@/components/orbita/kit";
import { HeroImage } from "@/components/orbita/HeroImage";
import { useAppData } from "@/domain/appData";
import { orbita } from "@/theme/orbita";

export default function CartaScreen() {
  const { carta } = useAppData();
  return (
    <OrbitaScreen>
      <Section>
        <View style={{ alignItems: "center", marginBottom: orbita.spacing.xl }}>
          <HeroImage kind="carta" size={200} />
        </View>
        <Triad triad={carta.triad} />
        <View style={{ height: orbita.spacing.xl }} />
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
