import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { orbita } from "@/theme/orbita";

/** Shell dark reutilizable para las pantallas de detalle de la Home. */
export function DetailScreen({ eyebrow, children }: { eyebrow?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useOrbitaFonts();
  if (!fontsLoaded) return <View style={styles.screen} />;
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.topbar, { paddingTop: insets.top + orbita.spacing.sm }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          hitSlop={12}
          accessibilityRole="button"
        >
          <Text style={styles.back}>←</Text>
        </Pressable>
        {eyebrow ? <Text style={styles.topEyebrow}>{eyebrow}</Text> : null}
        <View style={styles.spacer} />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: orbita.spacing.gutter, paddingBottom: insets.bottom + orbita.spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: orbita.colors.background, flex: 1 },
  topbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: orbita.spacing.md,
    paddingHorizontal: orbita.spacing.gutter
  },
  back: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 26, width: 40 },
  topEyebrow: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  spacer: { width: 40 }
});
