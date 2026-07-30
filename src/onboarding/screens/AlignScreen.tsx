import { useState } from "react";
import { ImageBackground, type ImageSourcePropType, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

/**
 * 02 — Align with the universe (value pitch + benefit tiles).
 *
 * La grilla de mosaicos tenía altos FIJOS (188/202/208/182) sumando ~426px de
 * columna. En un viewport bajo —un portátil de 768, un teléfono de 568— eso no
 * entra junto al título, la nota y el CTA, y la pantalla se desbordaba: los
 * mosaicos se comían el pie y el botón quedaba fuera. Ahora la zona de la
 * grilla es una caja MEDIDA y los altos salen de una proporción de lo que haya
 * disponible, con el mismo escalonado del Figma. Cuando hay espacio de sobra la
 * grilla se queda en su alto natural: no crece hasta deformarse.
 */
export function AlignScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <Screen bg={A.dailyTexture} wash={0.44}>
      <Header step={1} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title style={styles.title}>Alineate con el ritmo del universo</Title>
        <Body style={styles.sub}>Descifrá amor, trabajo y camino personal desde tu carta.</Body>

        <View style={styles.gridZone}>
          <TileGrid />
        </View>

        <Caption style={styles.note}>Órbita ordena señales, no dicta destino.</Caption>
        <View style={styles.footer}>
          <CTA label="Empezar el viaje" onPress={onNext} />
        </View>
      </View>
    </Screen>
  );
}

/** Alturas de referencia del Figma; se usan como PROPORCIÓN, no como píxeles. */
const TILE_H = { lunar: 188, practice: 202, guide: 208, decisions: 182 } as const;
const COL_GAP = 14;
const COL_OFFSET = 22;
/** Alto natural de la columna más alta (la de la derecha, con su desfase). */
const NATURAL_H = COL_OFFSET + TILE_H.guide + COL_GAP + TILE_H.decisions;

function TileGrid() {
  const [available, setAvailable] = useState<number | null>(null);
  // Nunca más alto que su alto natural: con espacio de sobra la grilla no se
  // estira, se queda como en el Figma y el aire sobrante va al layout.
  const h = available === null ? NATURAL_H : Math.min(available, NATURAL_H);
  const scale = h / NATURAL_H;
  const px = (n: number) => Math.max(1, Math.round(n * scale));

  return (
    <View
      style={styles.gridMeasure}
      onLayout={(e) => {
        const next = e.nativeEvent.layout.height;
        setAvailable((prev) => (next > 0 && (prev === null || Math.abs(prev - next) >= 1) ? next : prev));
      }}
    >
      <View style={[styles.grid, { height: h }]}>
        <View style={[styles.col, { gap: px(COL_GAP) }]}>
          <Tile img={A.tileLunar} label="☾  Influencia lunar" h={px(TILE_H.lunar)} />
          <Tile img={A.tilePractice} label="◇  Práctica diaria" h={px(TILE_H.practice)} />
        </View>
        <View style={[styles.col, { gap: px(COL_GAP), marginTop: px(COL_OFFSET) }]}>
          <Tile img={A.tileGuide} label="✦  Guía personal" h={px(TILE_H.guide)} />
          <Tile img={A.tileDecisions} label="◈  Decisiones" h={px(TILE_H.decisions)} />
        </View>
      </View>
    </View>
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
  col: { flex: 1 },
  footer: { paddingBottom: 12, paddingTop: 12 },
  grid: { flexDirection: "row", gap: 14 },
  gridMeasure: { flex: 1, justifyContent: "center" },
  gridZone: { flex: 1, justifyContent: "center", minHeight: 180 },
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
