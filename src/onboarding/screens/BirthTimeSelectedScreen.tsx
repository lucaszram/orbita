import { StyleSheet, View } from "react-native";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { DataRow } from "../components/DataRow";
import { Emblem } from "../components/Emblem";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Title } from "../components/Type";
import { GUTTER } from "../theme";

type Props = { step: number; timeLabel: string; onNext: () => void; onBack: () => void };

/** 10 — Birth time confirmed (ascendant refined). */
export function BirthTimeSelectedScreen({ step, timeLabel, onNext, onBack }: Props) {
  return (
    <Screen bg={A.dailyTexture} wash={0.48}>
      <Header step={step} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title>Ascendente afinado.</Title>
        <Body style={styles.sub}>La hora ordena las casas de tu carta.</Body>

        <View style={styles.emblemZone}>
          <Emblem source={A.rings} size={188} />
        </View>

        <DataRow label="Hora" value={timeLabel} />

        <View style={styles.spacer} />
        <Caption style={styles.privacy}>Podés volver atrás si necesitás cambiar la hora.</Caption>
        <View style={styles.footer}>
          <CTA label="Continuar" onPress={onNext} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 26 },
  emblemZone: { alignItems: "center", marginBottom: 36, marginTop: 30 },
  footer: { paddingBottom: 12, paddingTop: 12 },
  privacy: { marginBottom: 8, textAlign: "center" },
  spacer: { flex: 1, minHeight: 16 },
  sub: { marginTop: 10 },
});
