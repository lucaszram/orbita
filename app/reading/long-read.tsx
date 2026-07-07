import { View } from "react-native";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Eyebrow, MutedBody, SerifTitle } from "@/components/home/sections";
import { Note } from "@/components/orbita/kit";
import { EditorialThumb } from "@/components/orbita/HeroImage";
import { useAppState } from "@/hooks/useAppState";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { orbita } from "@/theme/orbita";

/** Leer análisis — lectura larga del día + módulo educativo. */
export default function LongReadScreen() {
  const { homeReading } = useAppState();
  const fontsLoaded = useOrbitaFonts();

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: orbita.colors.background }} />;
  }

  return (
    <DetailScreen eyebrow={homeReading.longReadEyebrow}>
      <SerifTitle>{homeReading.longReadTitle}</SerifTitle>
      <View style={{ marginVertical: orbita.spacing.xl }}>
        <EditorialThumb height={180} />
      </View>
      <MutedBody>{homeReading.longReadBody}</MutedBody>
      <MutedBody>{homeReading.guideIntro}</MutedBody>
      <Note>Basado en el tránsito destacado de hoy.</Note>

      <View style={{ height: orbita.spacing.xxl }} />
      <Eyebrow>{homeReading.educationalEyebrow}</Eyebrow>
      <SerifTitle>{homeReading.educationalTitle}</SerifTitle>
    </DetailScreen>
  );
}
