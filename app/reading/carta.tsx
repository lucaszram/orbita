import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Divider, Eyebrow, TabStrip } from "@/components/orbita/kit";
import { useAppData } from "@/domain/appData";
import { orbita } from "@/theme/orbita";

type Tab = "planetas" | "casas" | "aspectos" | "elementos";

/** Glifo por cuerpo, derivado del título de la posición (Figma V4.7 Posiciones). */
const GLYPHS: [RegExp, string][] = [
  [/^Sol/i, "☉"],
  [/^Luna/i, "☽"],
  [/^Ascendente/i, "↑"],
  [/^Mercurio/i, "☿"],
  [/^Venus/i, "♀"],
  [/^Marte/i, "♂"],
  [/^J[úu]piter/i, "♃"],
  [/^Saturno/i, "♄"]
];

function glyphFor(title: string): string {
  const hit = GLYPHS.find(([re]) => re.test(title));
  return hit ? hit[1] : "☉";
}

function PositionRow({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <View style={styles.marker}>
          <Text style={styles.glyph}>{glyphFor(title)}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.arrow}>→</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

export default function CartaPosicionesScreen() {
  const { carta } = useAppData();
  const [tab, setTab] = useState<Tab>("planetas");
  return (
    <DetailScreen eyebrow="Carta">
      <TabStrip
        tabs={[
          { key: "planetas", label: "Planetas" },
          { key: "casas", label: "Casas" },
          { key: "aspectos", label: "Aspectos" },
          { key: "elementos", label: "Elementos" }
        ]}
        active={tab}
        onChange={setTab}
      />
      <Divider />
      <Eyebrow>POSICIONES</Eyebrow>
      {carta.positions.map((p) => (
        <PositionRow key={p.title} title={p.title} body={p.body} />
      ))}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomColor: orbita.colors.line, borderBottomWidth: 1, paddingVertical: orbita.spacing.xl },
  head: { alignItems: "center", flexDirection: "row" },
  marker: {
    alignItems: "center",
    borderColor: orbita.colors.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    marginRight: orbita.spacing.md,
    width: 24
  },
  glyph: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 12 },
  title: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.serif, fontSize: 24, lineHeight: 30 },
  arrow: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 20, marginLeft: orbita.spacing.md },
  body: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 24 + orbita.spacing.md,
    marginTop: orbita.spacing.sm
  }
});
