import { View } from "react-native";
import { router } from "expo-router";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, Divider, Eyebrow, H2, MonoLine, Pill } from "@/components/orbita/kit";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { useAppData } from "@/domain/appData";
import { orbita } from "@/theme/orbita";

/** Fase lunar (Figma V4.7 · 06 Luna/Calendario) — luna full-bleed + acción lunar. */
export default function LunaScreen() {
  const { lunar } = useAppData();
  return (
    <DetailScreen eyebrow="Fase lunar">
      <View style={{ marginHorizontal: -orbita.spacing.gutter }}>
        <FullBleedHero kind="luna" height={280}>
          <MonoLine>{lunar.weekStrip}</MonoLine>
        </FullBleedHero>
      </View>
      <View style={{ height: orbita.spacing.lg }} />
      <Eyebrow>FASE LUNAR</Eyebrow>
      <H2>{lunar.phase}</H2>
      <Body>{lunar.copy}</Body>
      <Divider />
      <Eyebrow>ACCIÓN LUNAR</Eyebrow>
      <Body bone>{lunar.accion}</Body>
      <View style={{ height: orbita.spacing.xl }} />
      <Pill label="VER CALENDARIO" onPress={() => router.push("/reading/calendario")} />
    </DetailScreen>
  );
}
