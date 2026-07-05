import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { DataRow } from "../components/DataRow";
import { Emblem } from "../components/Emblem";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

type Props = {
  step: number;
  sign: string;
  element: string;
  dateLabel: string;
  onNext: () => void;
  onBack: () => void;
};

/** 06 — Birthdate confirmed (Sun sign + element). */
export function BirthdateSelectedScreen({ step, sign, element, dateLabel, onNext, onBack }: Props) {
  return (
    <Screen bg={A.dailyTexture} bgOpacity={0.55} wash={0.72}>
      <Header step={step} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title>Sol en {sign}.</Title>
        <Body style={styles.sub}>{dateLabel}</Body>

        <View style={styles.emblemZone}>
          <Emblem source={A.sun} size={168} />
        </View>

        <DataRow label="Sol" value={sign} />
        <View style={styles.gap} />
        <DataRow label="Elemento" value={element} />

        <Pressable onPress={onBack} hitSlop={10} style={styles.changeBtn}>
          <Text style={styles.change}>Cambiar fecha</Text>
        </Pressable>

        <View style={styles.spacer} />
        <Caption style={styles.privacy}>
          La usamos para armar tu carta. Nunca vendemos ni compartimos tus datos.
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
  change: { color: orbita.copper, fontFamily: font.sansMed, fontSize: 14, textAlign: "center" },
  changeBtn: { alignSelf: "center", marginTop: 26, paddingVertical: 6 },
  emblemZone: { alignItems: "center", marginBottom: 34, marginTop: 30 },
  footer: { paddingBottom: 12, paddingTop: 12 },
  gap: { height: 16 },
  privacy: { marginBottom: 8, textAlign: "center" },
  spacer: { flex: 1, minHeight: 16 },
  sub: { marginTop: 8 },
});
