import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContentCanvas } from "@/components/orbita/ContentCanvas";
import { orbita } from "@/theme/orbita";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";

/**
 * Shell dark reutilizable para las pantallas de detalle de la Home.
 *
 * El lienzo de contenido se monta acá (una vez): en móvil no cambia nada —el
 * tope de 720 nunca se alcanza— y en escritorio el texto deja de medir el ancho
 * de la ventana. La barra de volver viaja en el mismo lienzo para no quedar a
 * media pantalla del título que encabeza.
 */
export function DetailScreen({ eyebrow, children }: { eyebrow?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useOrbitaFonts();
  if (!fontsLoaded) return <View style={styles.screen} />;
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + orbita.spacing.sm }}>
        <ContentCanvas>
          <View style={styles.topbar}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Volver"
              style={styles.backBtn}
            >
              <Text style={styles.back}>←</Text>
            </Pressable>
            {eyebrow ? <Text style={styles.topEyebrow}>{eyebrow}</Text> : null}
            <View style={styles.spacer} />
          </View>
        </ContentCanvas>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + orbita.spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <ContentCanvas>
          <View style={styles.body}>{children}</View>
        </ContentCanvas>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: orbita.colors.background, flex: 1 },
  body: { paddingHorizontal: orbita.spacing.gutter },
  topbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: orbita.spacing.md,
    paddingHorizontal: orbita.spacing.gutter
  },
  // 44px: el mínimo táctil accesible. `hitSlop` no existe en web, así que sin
  // esto el objetivo real de "volver" eran los 26px del carácter.
  backBtn: { justifyContent: "center", minHeight: 44, minWidth: 44 },
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
