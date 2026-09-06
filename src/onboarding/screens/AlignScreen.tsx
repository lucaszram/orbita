import { useState } from "react";
import { ImageBackground, type ImageSourcePropType, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Text } from "@/components/ui/text";
import { AstroGlyph } from "@/components/orbita/AstroGlyph";
import type { AstroGlyphKey } from "@/domain/astroGlyphs";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { ONBOARDING_TOTAL } from "../steps";
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
export function AlignScreen({
  step,
  onNext,
  onBack
}: {
  step: number;
  onNext: () => void;
  /** Con sesión activa el acceso quedó atrás: sin handler no hay chevron. */
  onBack?: () => void;
}) {
  return (
    <Screen bg={A.dailyTexture} wash={0.44}>
      <Header step={step} total={ONBOARDING_TOTAL} onBack={onBack} showBack={Boolean(onBack)} />
      <View style={styles.body}>
        <Title style={styles.title}>Alineate con el ritmo del universo</Title>
        <Body style={styles.sub}>Descifrá amor, trabajo y camino personal desde tu carta.</Body>

        {/* La grilla se monta UNA vez y acá: entre el subtítulo y la nota, que
            es su lugar en el flujo. Su `flex: 1` es el resorte que reparte el
            aire de la columna, para que la nota y el CTA se apoyen abajo en vez
            de amontonarse contra el título. */}
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

/**
 * Cuatro mosaicos del MISMO alto, en una grilla pareja de 2x2.
 *
 * El escalonado con cuatro alturas distintas y las píldoras colgando fuera del
 * borde leía como una maqueta a medio terminar. Una grilla pareja con la
 * etiqueta adentro es lo mismo que ya hace la app en Home y en el Diario: se
 * ve deliberada, y aguanta cualquier ancho sin dejar huecos.
 */
const TILE_H = 190;
const COL_GAP = 12;
/** Alto natural de la grilla (dos filas + el aire entre ellas). */
const NATURAL_H = TILE_H * 2 + COL_GAP;

function TileGrid() {
  const [available, setAvailable] = useState<number | null>(null);
  // Nunca más alto que su alto natural: con espacio de sobra la grilla no se
  // estira, se queda como en el Figma y el aire sobrante va al layout.
  const h = available === null ? NATURAL_H : Math.min(available, NATURAL_H);
  const scale = h / NATURAL_H;
  const px = (n: number) => Math.max(1, Math.round(n * scale));
  const tile = px(TILE_H);

  return (
    <View
      style={styles.gridMeasure}
      onLayout={(e) => {
        const next = e.nativeEvent.layout.height;
        setAvailable((prev) => (next > 0 && (prev === null || Math.abs(prev - next) >= 1) ? next : prev));
      }}
    >
      <View style={[styles.grid, { gap: px(COL_GAP), height: h }]}>
        <View style={[styles.col, { gap: px(COL_GAP) }]}>
          {/* El emblema lunar es el glifo vectorial propio: el carácter `☾` caía
              al font de emoji en web y Android (ver `domain/astroGlyphs`). */}
          <Tile img={A.tileLunar} glyph="moon" label="Influencia lunar" h={tile} />
          <Tile img={A.tilePractice} label="◇  Práctica diaria" h={tile} />
        </View>
        <View style={[styles.col, { gap: px(COL_GAP) }]}>
          <Tile img={A.tileGuide} label="✦  Guía personal" h={tile} />
          <Tile img={A.tileDecisions} label="◈  Decisiones" h={tile} />
        </View>
      </View>
    </View>
  );
}

function Tile({
  img,
  label,
  h,
  glyph
}: {
  img: ImageSourcePropType;
  label: string;
  h: number;
  glyph?: AstroGlyphKey;
}) {
  return (
    <View style={[styles.tile, { height: h }]}>
      {/* `imageStyle` propio PISA el sizing por defecto de react-native-web: sin
          width/height/resizeMode explícitos el <img> se va a su tamaño
          intrínseco (1024px) y arrastra la columna con él. Es el mismo bug que
          ya está documentado en `components/Screen.tsx` para el fondo. */}
      <ImageBackground source={img} style={StyleSheet.absoluteFill} imageStyle={styles.tileImg} resizeMode="cover" />
      {/* La etiqueta vive ADENTRO del mosaico, al pie, sobre un degradé de
          legibilidad. Antes era una píldora flotando fuera del borde superior:
          se cruzaba con el mosaico de al lado y leía como un accidente. */}
      <LinearGradient
        colors={["rgba(10,11,14,0)", "rgba(10,11,14,0.82)"]}
        locations={[0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.tileLabelRow}>
        {glyph ? <AstroGlyph symbol={glyph} size={13} color={orbita.bone} /> : null}
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 20 },
  // `minWidth: 0` no es decorativo: en CSS un item flex arranca con
  // `min-width: auto`, o sea que NO baja de la medida intrínseca de su
  // contenido. Con una imagen de 1024px adentro, la columna se negaba a
  // encogerse y la grilla se salía por la derecha del lienzo de 480.
  col: { flex: 1, minWidth: 0 },
  footer: { paddingBottom: 12, paddingTop: 12 },
  grid: { flexDirection: "row" },
  gridMeasure: { flex: 1, justifyContent: "center" },
  gridZone: { flex: 1, justifyContent: "center", minHeight: 180 },
  note: { color: orbita.faint, marginBottom: 6, textAlign: "center" },
  tileLabelRow: {
    alignItems: "center",
    bottom: 12,
    flexDirection: "row",
    gap: 6,
    left: 12,
    position: "absolute",
    right: 12,
  },
  tileLabel: {
    color: orbita.bone,
    fontFamily: font.sansMed,
    fontSize: 13,
    flexShrink: 1,
  },
  sub: { marginTop: 10, textAlign: "center" },
  // `overflow: "hidden"` recorta lo que la imagen quiera desbordar, y
  // `width: "100%"` la ata al ancho de SU columna en vez de al del asset.
  tile: { borderRadius: 16, overflow: "hidden", width: "100%" },
  tileImg: { borderRadius: 16, height: "100%", resizeMode: "cover", width: "100%" },
  title: { fontSize: 29, lineHeight: 34, textAlign: "center" },
});
