import { View } from "react-native";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Eyebrow, LabeledBlock, MutedBody, SerifTitle } from "@/components/home/sections";
import { useAppState } from "@/hooks/useAppState";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { orbita } from "@/theme/orbita";

/** Profundizar — expande la señal del día: por qué, hacé/evitá, energía, pregunta. */
export default function DeepDiveScreen() {
  const { homeReading } = useAppState();
  const fontsLoaded = useOrbitaFonts();

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: orbita.colors.background }} />;
  }

  return (
    <DetailScreen eyebrow="Profundizar">
      <SerifTitle>{homeReading.headline}</SerifTitle>
      <MutedBody>{homeReading.guideIntro}</MutedBody>

      <LabeledBlock label="HACÉ" copy={homeReading.hace} />
      <LabeledBlock label="EVITÁ" copy={homeReading.evita} />
      <LabeledBlock label="ENERGÍA" copy={homeReading.energia} />
      <LabeledBlock label="ACCIÓN" copy={homeReading.accion} />

      <View style={{ height: orbita.spacing.xxl }} />
      <Eyebrow>PREGUNTA DEL DÍA</Eyebrow>
      <SerifTitle>{homeReading.question}</SerifTitle>
    </DetailScreen>
  );
}
