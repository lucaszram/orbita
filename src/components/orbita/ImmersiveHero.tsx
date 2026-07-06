import { ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { orbita } from "@/theme/orbita";

/**
 * Hero full-bleed con wash de legibilidad (Figma V4.7: `bg/full-bleed` +
 * `wash/legibility`). Reemplaza al hero circular contenido en las tabs.
 * Children (tríada, fila de planetas) quedan anclados al pie del hero.
 */
const SOURCES = {
  carta: require("../../../assets/orbita/optimized/core/orbita_carta_natal_diagram_a.jpg"),
  transitos: require("../../../assets/orbita/optimized/core/orbita_transitos_visual_a.jpg"),
  vinculo: require("../../../assets/orbita/optimized/core/orbita_vinculo_symbol_a.jpg"),
  luna: require("../../../assets/orbita/optimized/core/orbita_moon_phase_waxing.jpg"),
  perfil: require("../../../assets/orbita/optimized/core/orbita_home_hero_orbital_a.jpg"),
  texture: require("../../../assets/orbita/optimized/core/orbita_daily_texture_b.jpg")
} as const;

export type ImmersiveKind = keyof typeof SOURCES;

export function FullBleedHero({
  kind,
  height = 300,
  children
}: {
  kind: ImmersiveKind;
  height?: number;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.wrap, { height }]}>
      <Image source={SOURCES[kind]} style={styles.img} resizeMode="cover" />
      <LinearGradient
        colors={["rgba(10,11,14,0.1)", "rgba(10,11,14,0.55)", orbita.colors.background]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children ? <View style={styles.foot}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: "flex-end", paddingBottom: orbita.spacing.lg },
  img: { ...StyleSheet.absoluteFillObject, height: "100%", width: "100%" },
  foot: { alignItems: "center", paddingHorizontal: orbita.spacing.gutter }
});
