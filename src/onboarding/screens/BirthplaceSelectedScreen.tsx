import { StyleSheet, View } from "react-native";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { DataRow } from "../components/DataRow";
import { Emblem } from "../components/Emblem";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Title } from "../components/Type";
import { GUTTER } from "../theme";

type Props = { step: number; place: string; onNext: () => void; onBack: () => void };

/** 08 — Birthplace confirmed (ascendant/horizon). */
export function BirthplaceSelectedScreen({ step, place, onNext, onBack }: Props) {
  return (
    <Screen bg={A.dailyTexture} wash={0.48}>
      <Header step={step} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title>Horizonte definido.</Title>
        <Body style={styles.sub}>El lugar afina tu ascendente y tus casas.</Body>

        <View style={styles.emblemZone}>
          <Emblem source={A.ascendant} size={190} />
        </View>

        <DataRow label="Lugar" value={place} />

        <View style={styles.spacer} />
        <Caption style={styles.privacy}>
          La usamos para precisar tu carta. Nunca vendemos ni compartimos tus datos.
        </Caption>
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
