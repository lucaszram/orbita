import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Emblem } from "../components/Emblem";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Caption, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

type Props = { step: number; place: string; onNext: () => void; onBack: () => void };

/** 08 — Birthplace confirmed (Figma 151:314): título → lugar → línea serif → horizonte. */
export function BirthplaceSelectedScreen({ step, place, onNext, onBack }: Props) {
  return (
    <Screen bg={A.dailyTexture} wash={0.48}>
      <Header step={step} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title>Horizonte definido.</Title>
        <Text style={styles.place}>{place}</Text>
        <View style={styles.hairline} />
        <Text style={styles.serifLine}>El lugar afina tu ascendente y tus casas.</Text>

        <View style={styles.emblemZone}>
          <Emblem source={A.ascendant} size={240} />
        </View>

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
  emblemZone: { alignItems: "center", flex: 1, justifyContent: "center" },
  footer: { paddingBottom: 12, paddingTop: 12 },
  hairline: { backgroundColor: orbita.line, height: 1, marginTop: 22 },
  place: { color: orbita.muted, fontFamily: font.sans, fontSize: 16, marginTop: 12 },
  privacy: { marginBottom: 8, textAlign: "center" },
  serifLine: {
    color: orbita.bone,
    fontFamily: font.serif,
    fontSize: 24,
    lineHeight: 31,
    marginTop: 22,
  },
});
