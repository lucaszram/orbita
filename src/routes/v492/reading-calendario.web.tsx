import { View } from "react-native";
import { router } from "expo-router";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, Eyebrow, H2, Note, Pill } from "@/components/orbita/kit";
import { orbita } from "@/theme/orbita";

/** Calendario mensual — Próximamente: el grid del mes necesita agregación por día (aún no). */
export default function CalendarioScreen() {
  return (
    <DetailScreen eyebrow="Calendario · Próximamente">
      <Eyebrow>PRÓXIMAMENTE</Eyebrow>
      <H2>Tu mes{"\n"}en energía.</H2>
      <Body>
        El calendario del mes está en camino: qué días vienen más intensos y cuándo caen las fases clave de la luna.
      </Body>
      <Body>Todavía no lo mostramos para no clavarte una fecha que no es la de hoy.</Body>
      <View style={{ height: orbita.spacing.xl }} />
      <Pill label="VER LA LUNA DE HOY" onPress={() => router.push("/reading/luna")} />
      <View style={{ height: orbita.spacing.lg }} />
      <Note>La fase lunar del día ya la tenés en la pantalla de la Luna.</Note>
    </DetailScreen>
  );
}
