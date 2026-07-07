import { Image, type ImageSourcePropType, StyleSheet, View, type ViewStyle } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Emblem } from "../components/Emblem";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

/** 04 — Daily guidance (value before asking data). Central emblem + orbiting topics. */
export function DailyGuidanceScreen({ step, onNext, onBack }: { step: number; onNext: () => void; onBack: () => void }) {
  return (
    <Screen bg={A.guidanceBg} wash={0.44}>
      <Header step={step} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title style={styles.title}>Guía diaria,{"\n"}ajustada a vos</Title>
        <Body style={styles.sub}>Micro-rituales, señales y contexto para tu día.</Body>

        <View style={styles.orbit}>
          <Emblem source={A.heroEclipse} size={200} />
          <TopicBadge img={A.heart} label="Amor" style={{ left: 0, top: 18 }} />
          <TopicBadge img={A.saturn} label="Decisiones" style={{ right: 0, top: 18 }} />
          <TopicBadge img={A.moon} label="Cuidado" style={{ bottom: 24, left: 0 }} />
          <TopicBadge img={A.sun} label="Energía" style={{ bottom: 24, right: 0 }} />
        </View>

        <Text style={styles.readingTitle}>Tu energía{"\n"}se mueve suave</Text>
        <Text style={styles.readingBody}>Una acción pequeña ordena el día.</Text>

        <View style={styles.spacer} />
        <View style={styles.footer}>
          <CTA label="Estoy en órbita" onPress={onNext} />
        </View>
      </View>
    </Screen>
  );
}

function TopicBadge({ img, label, style }: { img: ImageSourcePropType; label: string; style?: ViewStyle }) {
  return (
    <View style={[styles.badge, style]}>
      <Image source={img} style={styles.badgeIcon} resizeMode="cover" />
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    backgroundColor: "rgba(10,11,14,0.72)",
    borderColor: orbita.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 7,
    position: "absolute",
  },
  badgeIcon: { borderRadius: 10, height: 20, width: 20 },
  badgeLabel: { color: orbita.bone, fontFamily: font.sansMed, fontSize: 13 },
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 24 },
  footer: { paddingBottom: 12, paddingTop: 12 },
  orbit: { alignItems: "center", height: 300, justifyContent: "center", marginTop: 12 },
  readingBody: { color: orbita.muted, fontFamily: font.sans, fontSize: 13, textAlign: "center" },
  readingTitle: {
    color: orbita.bone,
    fontFamily: font.serif,
    fontSize: 21,
    lineHeight: 26,
    marginBottom: 6,
    textAlign: "center",
  },
  spacer: { flex: 1, minHeight: 12 },
  sub: { marginTop: 10, textAlign: "center" },
  title: { fontSize: 30, lineHeight: 36, textAlign: "center" },
});
