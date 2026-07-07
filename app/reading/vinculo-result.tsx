import { View } from "react-native";
import { DetailScreen } from "@/components/home/DetailScreen";
import { ActionBand, Eyebrow, GuideRow, H2 } from "@/components/orbita/kit";
import { useAppData } from "@/domain/appData";
import { orbita } from "@/theme/orbita";

export default function VinculoResultadoScreen() {
  const { vinculo } = useAppData();
  const r = vinculo.result;
  return (
    <DetailScreen eyebrow={r.pairing}>
      <H2>{r.headline}</H2>
      <View style={{ height: orbita.spacing.xl }} />
      <GuideRow label="FLUYE" copy={r.fluye} />
      <GuideRow label="FRICCIONA" copy={r.fricciona} />
      <GuideRow label="ENERGÍA" copy={r.energia} />
      <View style={{ height: orbita.spacing.sm }} />
      <ActionBand label="ACCIÓN" copy={r.accion} />
    </DetailScreen>
  );
}
