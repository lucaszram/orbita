import { StyleSheet, View } from "react-native";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { DataRow } from "../components/DataRow";
import { Emblem } from "../components/Emblem";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Caption, Title } from "../components/Type";
import { GUTTER } from "../theme";

type Props = {
  step: number;
  dateLabel: string;
  place: string;
  timeLabel: string;
  onNext: () => void;
  onBack: () => void;
};

/** 11 — Base chart summary (review before calculating). */
export function BaseChartScreen({ step, dateLabel, place, timeLabel, onNext, onBack }: Props) {
  return (
    <Screen bg={A.dailyTexture} wash={0.48}>
      <Header step={step} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title style={styles.title}>Estos son tus{"\n"}puntos de partida.</Title>

        <View style={styles.emblemZone}>
          <Emblem source={A.chartDiagram} size={230} />
        </View>

        <DataRow label="Fecha" value={dateLabel} />
        <View style={styles.gap} />
        <DataRow label="Lugar" value={place} />
        <View style={styles.gap} />
        <DataRow label="Hora" value={timeLabel} />

        <View style={styles.spacer} />
        <Caption style={styles.note}>Con esto armamos tu carta: Sol, ascendente y casas.</Caption>
        <View style={styles.footer}>
          <CTA label="Calcular mi carta" onPress={onNext} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 24 },
  emblemZone: { alignItems: "center", marginBottom: 30, marginTop: 20 },
  footer: { paddingBottom: 12, paddingTop: 12 },
  gap: { height: 14 },
  note: { marginBottom: 8 },
  spacer: { flex: 1, minHeight: 16 },
  title: { fontSize: 30, lineHeight: 36 },
});
