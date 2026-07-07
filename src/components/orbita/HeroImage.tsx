import { Image, StyleSheet, View } from "react-native";
import { orbita } from "@/theme/orbita";

/**
 * Heros reales del app core (Figma V4.7). Un asset por pantalla, igual que los
 * `asset-slot/*` del Figma. Derivados optimizados en `assets/orbita/optimized/core/`.
 */
const SOURCES = {
  home: require("../../../assets/orbita/optimized/core/orbita_home_hero_orbital_b.jpg"),
  carta: require("../../../assets/orbita/optimized/core/orbita_carta_natal_diagram_a.jpg"),
  transitos: require("../../../assets/orbita/optimized/core/orbita_transitos_visual_a.jpg"),
  vinculo: require("../../../assets/orbita/optimized/core/orbita_vinculo_symbol_a.jpg"),
  perfil: require("../../../assets/orbita/optimized/core/orbita_home_hero_orbital_a.jpg"),
  longRead: require("../../../assets/orbita/optimized/core/orbita_long_read_thumbnail_a.jpg"),
  texture: require("../../../assets/orbita/optimized/core/orbita_daily_texture_b.jpg"),
  luna: require("../../../assets/orbita/optimized/core/orbita_moon_phase_waxing.jpg")
} as const;

export type HeroKind = keyof typeof SOURCES;

/** Hero circular integrado sobre dark (como `asset-slot` 188x188 de Home V1.1). */
export function HeroImage({ kind, size = 200, opacity = 1 }: { kind: HeroKind; size?: number; opacity?: number }) {
  return (
    <Image
      source={SOURCES[kind]}
      style={{ width: size, height: size, borderRadius: size / 2, opacity }}
      resizeMode="cover"
    />
  );
}

/** Thumbnail editorial rectangular (lectura larga). */
export function EditorialThumb({ kind = "longRead", height = 170 }: { kind?: HeroKind; height?: number }) {
  return (
    <View style={[styles.thumbWrap, { height }]}>
      <Image source={SOURCES[kind]} style={styles.thumbImg} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  thumbWrap: {
    backgroundColor: orbita.colors.surfaceRaised,
    borderRadius: orbita.radius.xl,
    overflow: "hidden",
    width: "100%"
  },
  thumbImg: { height: "100%", width: "100%" }
});
