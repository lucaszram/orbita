import { useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useQuery } from "convex/react";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, H2, Note } from "@/components/orbita/kit";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { mapNatalChart } from "@/components/web/orbita-chart";
import { chartMock } from "@/content/chartMock";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appApi, type NatalChartPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/**
 * Carta · Rueda completa: vista "zoom" de la rueda natal a pantalla ancha.
 * Reusa la `NatalWheel` compartida (misma geometría correcta que el hub), con
 * data real si hay sesión y mock para invitados. No re-dibuja nada propio.
 */
export default function RuedaScreen() {
  const { isLive } = useLiveApp();
  if (!isLive) return <RuedaView payload={chartMock} />;
  return <RuedaLive />;
}

function RuedaLive() {
  const chartDoc = useQuery(appApi.charts.current, {});
  return <RuedaView payload={chartDoc ? mapNatalChart(chartDoc) : chartMock} />;
}

function RuedaView({ payload }: { payload: NatalChartPayload }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - orbita.spacing.gutter * 2, 360);
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);

  return (
    <DetailScreen eyebrow="Carta · Rueda completa">
      <H2>Tu carta natal.</H2>
      <View style={styles.wheelWrap}>
        <NatalWheel payload={payload} size={size} selectedKey={selectedKey} onSelect={setSelectedKey} />
      </View>
      <Body>Tocá un planeta para resaltarlo y ver sus aspectos. La rueda muestra tus posiciones de nacimiento con el Ascendente a la izquierda.</Body>
      <Note>{payload.accuracy}</Note>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  wheelWrap: { alignItems: "center", alignSelf: "center", marginTop: orbita.spacing.xl }
});
