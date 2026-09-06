import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Eyebrow, LabeledBlock, MutedBody, SerifTitle } from "@/components/home/sections";
import { useAppState } from "@/hooks/useAppState";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { orbita } from "@/theme/orbita";

/** Detalle de un topic (Amor/Trabajo/Familia/Vínculos) de la Home. */
export default function TopicDetailScreen() {
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  const { homeReading } = useAppState();
  const fontsLoaded = useOrbitaFonts();

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: orbita.colors.background }} />;
  }

  const item = homeReading.topics.find((t) => t.topic === topic) ?? homeReading.topics[0];

  return (
    <DetailScreen eyebrow={item.label}>
      <SerifTitle>{item.title}</SerifTitle>
      <MutedBody>{item.detail}</MutedBody>

      <LabeledBlock label="HACÉ" copy={item.hace} />
      <LabeledBlock label="EVITÁ" copy={item.evita} />

      <View style={{ height: orbita.spacing.xxl }} />
      <Eyebrow>PREGUNTA</Eyebrow>
      <SerifTitle>{item.question}</SerifTitle>
    </DetailScreen>
  );
}
