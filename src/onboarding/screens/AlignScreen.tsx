import { ImageBackground, type ImageSourcePropType, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

/** 02 — Align with the universe (value pitch + benefit tiles). */
export function AlignScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <Screen bg={A.dailyTexture} wash={0.44}>
      <Header step={1} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title style={styles.title}>Alineate con el ritmo del universo</Title>
        <Body style={styles.sub}>Descifrá amor, trabajo y camino personal desde tu carta.</Body>

        <View style={styles.gridZone}>
          <View style={styles.grid}>
            <View style={styles.col}>
              <Tile img={A.tileLunar} label="☾  Influencia lunar" h={188} />
              <Tile img={A.tilePractice} label="◇  Práctica diaria" h={202} />
            </View>
            <View style={[styles.col, styles.colOffset]}>
              <Tile img={A.tileGuide} label="✦  Guía personal" h={208} />
              <Tile img={A.tileDecisions} label="◈  Decisiones" h={182} />
            </View>
          </View>
        </View>

        <Caption style={styles.note}>Órbita ordena señales, no dicta destino.</Caption>
        <View style={styles.footer}>
          <CTA label="Empezar el viaje" onPress={onNext} />
        </View>
      </View>
    </Screen>
  );
}

function Tile({ img, label, h }: { img: ImageSourcePropType; label: string; h: number }) {
  return (
    <View style={[styles.tile, { height: h }]}>
      <ImageBackground source={img} style={StyleSheet.absoluteFill} imageStyle={styles.tileImg} resizeMode="cover" />
      <View style={styles.pill}>
        <Text style={styles.pillTxt}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 20 },
  col: { flex: 1, gap: 14 },
  colOffset: { marginTop: 22 },
  footer: { paddingBottom: 12, paddingTop: 12 },
  grid: { flexDirection: "row", gap: 14 },
  gridZone: { flex: 1, justifyContent: "center" },
  note: { color: orbita.faint, marginBottom: 6, textAlign: "center" },
  pill: {
    backgroundColor: "rgba(10,11,14,0.72)",
    borderColor: orbita.line,
    borderRadius: 14,
    borderWidth: 1,
    left: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: "absolute",
    top: -14,
  },
  pillTxt: { color: orbita.bone, fontFamily: font.sansMed, fontSize: 12.5 },
  sub: { marginTop: 10, textAlign: "center" },
  tile: { borderRadius: 16 },
  tileImg: { borderRadius: 16 },
  title: { fontSize: 29, lineHeight: 34, textAlign: "center" },
});
