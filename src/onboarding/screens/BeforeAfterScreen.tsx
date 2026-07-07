import { Image, type ImageSourcePropType, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

const ANTES = [
  "Vivía en automático",
  "No sabía qué priorizar",
  "Dudaba de lo que quería",
  "Me sentía agotada",
  "Vínculos poco claros",
];

const DESPUES = [
  "Con calma y confianza",
  "Conozco mis fortalezas y límites",
  "Centrada y enfocada en lo importante",
  "Confío más en mi intuición",
  "Me vinculo con más claridad",
];

type Props = { step: number; onNext: () => void; onBack: () => void };

/** 13 — Before / after Órbita. */
export function BeforeAfterScreen({ step, onNext, onBack }: Props) {
  return (
    <Screen bg={A.beforeAfterBg} bgOpacity={0.8} wash={0.6}>
      <Header step={step} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title style={styles.title}>Antes y después{"\n"}de Órbita</Title>
        <Body style={styles.sub}>Una guía diaria puede cambiar cómo mirás tu día.</Body>

        <View style={styles.columns}>
          <Column icon={A.moon} title="Antes" items={ANTES} positive={false} />
          <Column icon={A.sun} title="Después" items={DESPUES} positive />
        </View>

        <View style={styles.spacer} />
        <Caption style={styles.note}>No resuelve por vos. Te devuelve contexto.</Caption>
        <View style={styles.footer}>
          <CTA label="Continuar" onPress={onNext} />
        </View>
      </View>
    </Screen>
  );
}

function Column({
  icon,
  title,
  items,
  positive,
}: {
  icon: ImageSourcePropType;
  title: string;
  items: string[];
  positive: boolean;
}) {
  return (
    <View style={[styles.card, positive && styles.cardAfter]}>
      <Image source={icon} style={styles.icon} resizeMode="cover" />
      <Text style={styles.cardTitle}>{title}</Text>
      {items.map((item) => (
        <View key={item} style={styles.row}>
          <View style={[styles.chip, positive ? styles.chipAfter : styles.chipBefore]}>
            <Text style={[styles.mark, { color: positive ? orbita.copper : orbita.muted }]}>
              {positive ? "✓" : "✕"}
            </Text>
          </View>
          <Text style={styles.rowTxt}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 22 },
  card: {
    alignItems: "center",
    backgroundColor: "rgba(18,20,26,0.82)",
    borderColor: orbita.line,
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  cardAfter: { borderColor: "rgba(196,106,58,0.55)" },
  cardTitle: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 18 },
  chip: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    marginTop: 1,
    width: 22,
  },
  chipAfter: { backgroundColor: "rgba(196,106,58,0.16)", borderColor: "rgba(196,106,58,0.5)" },
  chipBefore: { backgroundColor: "rgba(140,136,128,0.12)", borderColor: "rgba(140,136,128,0.4)" },
  columns: { flexDirection: "row", gap: 12, marginTop: 24 },
  footer: { paddingBottom: 12, paddingTop: 12 },
  icon: { borderRadius: 20, height: 40, width: 40 },
  mark: { fontFamily: font.sansBold, fontSize: 11 },
  note: { marginBottom: 8, textAlign: "center" },
  row: { alignSelf: "stretch", flexDirection: "row", gap: 8 },
  rowTxt: { color: orbita.bone, flex: 1, fontFamily: font.sansMed, fontSize: 12.5, lineHeight: 17 },
  spacer: { flex: 1, minHeight: 12 },
  sub: { marginTop: 10, textAlign: "center" },
  title: { textAlign: "center" },
});
