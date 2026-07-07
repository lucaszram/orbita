import { StyleSheet, Text, View } from "react-native";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, Divider, H2, H3, Note } from "@/components/orbita/kit";
import { glyphFor } from "@/components/orbita/GlyphRow";
import { personalityMock } from "@/content/personalityMock";
import { orbita } from "@/theme/orbita";

/** Horóscopo de personalidad (Figma V4.7 · 337:2): secciones por placement. */
export default function PersonalidadScreen() {
  const p = personalityMock;
  return (
    <DetailScreen eyebrow="Horóscopo de personalidad">
      <H2>{p.headline}</H2>
      <Body>No es etiqueta ni predicción: es un mapa de tendencias para conocerte mejor.</Body>

      {p.sections.map((s) => (
        <View key={s.key}>
          <Divider />
          <View style={styles.placementRow}>
            <View style={styles.marker}>
              <Text style={styles.glyph}>{glyphFor(s.placement.label)}</Text>
            </View>
            <Text style={styles.placementLabel}>{s.placement.label.toUpperCase()}</Text>
          </View>
          <H3>{s.title}</H3>
          <Body>{s.body}</Body>
        </View>
      ))}

      <View style={{ height: orbita.spacing.xl }} />
      <Note>{p.disclaimer}</Note>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  placementRow: { alignItems: "center", flexDirection: "row", marginBottom: orbita.spacing.md },
  marker: {
    alignItems: "center",
    borderColor: "rgba(196,106,58,0.5)",
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    marginRight: orbita.spacing.md,
    width: 32
  },
  glyph: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 14 },
  placementLabel: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.5
  }
});
