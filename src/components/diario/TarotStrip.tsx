import type { ImageSourcePropType } from "react-native";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CARD_BACK } from "@/content/tarotDeck";
import { orbita } from "@/theme/orbita";

export type DiaCelda = {
  wd: string;
  n: string;
  image: ImageSourcePropType | null; // null = día futuro (dorso)
  revealed: boolean;
};

const CW = 54;
const CH = 81;

/** Tira horizontal del diario: una mini-carta por día. Días pasados/hoy muestran
 *  la carta que salió; futuros van boca-abajo (dorso). El activo se resalta. */
export function TarotStrip({
  dias,
  sel,
  onSel
}: {
  dias: DiaCelda[];
  sel: number;
  onSel: (i: number) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {dias.map((d, i) => {
        const on = i === sel;
        return (
          <Pressable key={i} onPress={() => onSel(i)} style={styles.cell} hitSlop={4} accessibilityRole="button">
            <Text style={[styles.wd, on && styles.on, !d.revealed && styles.dim]}>{d.wd}</Text>
            <View style={[styles.card, on && styles.cardOn]}>
              <Image
                source={d.revealed && d.image ? d.image : CARD_BACK}
                style={styles.img}
                resizeMode="cover"
              />
              {!d.revealed ? <View style={styles.lock} /> : null}
            </View>
            <Text style={[styles.n, on ? styles.nOn : null, !d.revealed && styles.dim]}>{d.n}</Text>
            <View style={[styles.dot, !d.revealed && styles.dotHidden]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: orbita.spacing.sm, paddingHorizontal: orbita.spacing.gutter, paddingVertical: orbita.spacing.sm },
  cell: { alignItems: "center", width: CW },
  wd: { color: orbita.colors.muted, fontFamily: orbita.fonts.mono, fontSize: 10, letterSpacing: 0.5, marginBottom: 8 },
  on: { color: orbita.colors.copper },
  dim: { opacity: 0.5 },
  card: {
    borderColor: "rgba(196,106,58,0.4)",
    borderRadius: 6,
    borderWidth: 0.75,
    height: CH,
    overflow: "hidden",
    width: CW
  },
  cardOn: { borderColor: orbita.colors.copper, borderWidth: 1.5 },
  img: { height: CH, width: CW },
  lock: { backgroundColor: "rgba(7,8,10,0.45)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  n: { color: orbita.colors.bone, fontFamily: orbita.fonts.mono, fontSize: 13, marginTop: 8 },
  nOn: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium },
  dot: { backgroundColor: orbita.colors.copper, borderRadius: 2, height: 4, marginTop: 6, width: 4 },
  dotHidden: { opacity: 0 }
});
