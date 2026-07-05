import { Pressable, StyleSheet, Text, View } from "react-native";

import { A } from "../assets";
import { Screen } from "../components/Screen";
import { font, orbita } from "../theme";

/** 01 — Logo splash. Tap anywhere to enter. */
export function SplashScreen({ onNext }: { onNext: () => void }) {
  return (
    <Screen bg={A.splashBg} wash={0.42}>
      <Pressable style={styles.root} onPress={onNext} accessibilityRole="button" accessibilityLabel="Entrar a Órbita">
        <View style={styles.mark}>
          <View style={styles.orbit} />
          <View style={styles.core} />
          <View style={styles.signal} />
        </View>
        <Text style={styles.wordmark}>Órbita</Text>
        <Text style={styles.tagline}>tu astróloga personal</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  core: { backgroundColor: orbita.copperSoft, borderRadius: 6, height: 12, width: 12 },
  mark: { alignItems: "center", height: 56, justifyContent: "center", marginBottom: 28, width: 100 },
  orbit: {
    borderColor: orbita.copper,
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    opacity: 0.8,
    position: "absolute",
    width: 100,
  },
  root: { alignItems: "center", flex: 1, justifyContent: "center", paddingBottom: 40 },
  signal: {
    backgroundColor: orbita.copper,
    borderRadius: 4,
    height: 8,
    position: "absolute",
    right: 6,
    top: 10,
    width: 8,
  },
  tagline: { color: orbita.faint, fontFamily: font.sans, fontSize: 14, letterSpacing: 0.3, marginTop: 12 },
  wordmark: {
    color: orbita.bone,
    fontFamily: font.serif,
    fontSize: 58,
    lineHeight: 74,
    textShadowColor: orbita.copperGlow,
    textShadowOffset: { height: 0, width: 0 },
    textShadowRadius: 28,
  },
});
