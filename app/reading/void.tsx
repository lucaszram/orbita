import { View } from "react-native";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, Eyebrow, H2, InsightRow, MonoLine } from "@/components/orbita/kit";
import { orbita } from "@/theme/orbita";

const SUGGESTED = [
  { q: "¿Qué pide menos defensa hoy?", cat: "Vínculos" },
  { q: "¿Dónde estás yendo demasiado rápido?", cat: "Decisión" },
  { q: "¿Qué podés soltar sin dramatizarlo?", cat: "Cierre" }
];

export default function VoidScreen() {
  return (
    <DetailScreen eyebrow="El Vacío">
      <MonoLine>UNA PREGUNTA POR DÍA</MonoLine>
      <View style={{ height: orbita.spacing.lg }} />
      <H2>¿Qué estás{"\n"}apurando?</H2>
      <Body>Una pregunta para no cerrar rápido. No busca respuesta ni predicción: abre una mejor pregunta.</Body>
      <View style={{ height: orbita.spacing.xxl }} />
      <Eyebrow>TAMBIÉN PODÉS MIRAR</Eyebrow>
      {SUGGESTED.map((s) => (
        <InsightRow key={s.q} title={s.q} body={s.cat} />
      ))}
    </DetailScreen>
  );
}
