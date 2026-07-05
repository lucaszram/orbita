import { Pressable, StyleSheet, Text, View } from "react-native";

import { font, GUTTER, orbita } from "../theme";

type Props = {
  /** Zero-based index of the current step (fills segments 0..step). */
  step: number;
  total: number;
  onBack?: () => void;
  showBack?: boolean;
};

/** Consistent onboarding header: back chevron (top-left) + segmented progress. */
export function Header({ step, total, onBack, showBack = true }: Props) {
  return (
    <View style={styles.wrap}>
      {showBack ? (
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
          <Text style={styles.chev}>‹</Text>
        </Pressable>
      ) : (
        <View style={styles.backBtn} />
      )}
      <View style={styles.progress}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[styles.seg, { backgroundColor: i <= step ? orbita.copper : orbita.line }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: { alignItems: "flex-start", height: 30, justifyContent: "center", width: 28 },
  chev: { color: orbita.bone, fontFamily: font.sans, fontSize: 26, lineHeight: 30 },
  progress: { flexDirection: "row", gap: 4, marginTop: 12 },
  seg: { borderRadius: 1, flex: 1, height: 2 },
  wrap: { paddingHorizontal: GUTTER, paddingTop: 6 },
});
