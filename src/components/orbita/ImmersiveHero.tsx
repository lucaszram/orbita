import { ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MeasuredBox } from "@/components/orbita/ContentCanvas";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { orbita } from "@/theme/orbita";

/**
 * Hero full-bleed con wash de legibilidad (Figma V4.7: `bg/full-bleed` +
 * `wash/legibility`). Children (tríada, fila de planetas) quedan anclados al pie.
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

/** Alto por defecto. En móvil 230: con los 300 de antes el hero se comía el
 *  primer viewport entero de un teléfono y el título de la pantalla quedaba
 *  debajo del pliegue. En escritorio la escena puede respirar. */
const DEFAULT_HEIGHT = { mobile: 230, desktop: 360 } as const;

export function FullBleedHero({
  kind,
  height,
  rounded,
  children
}: {
  kind: ImmersiveKind;
  height?: number;
  /** Escena contenida (escritorio, Figma `271:70`) en vez de banda full-bleed. */
  rounded?: boolean;
  children?: ReactNode;
}) {
  const desktop = useIsDesktop();
  const h = height ?? (desktop ? DEFAULT_HEIGHT.desktop : DEFAULT_HEIGHT.mobile);

  return (
    // El alto y el ancho de la imagen salen de una MEDIDA en píxeles, no de un
    // porcentaje: en react-native-web una `<Image>` con `width/height: "100%"`
    // dentro de una caja `position: absolute` podía no pintar y dejar un hueco
    // negro del alto del hero — el agujero que se veía en Tránsitos. El
    // contenedor además recorta (`overflow: hidden`): sin eso la imagen se va a
    // su tamaño intrínseco (1024px) y estira la página.
    <MeasuredBox height={h} style={[styles.wrap, rounded && styles.rounded]}>
      {(width) => (
        <>
          <Image source={SOURCES[kind]} style={{ height: h, width }} resizeMode="cover" />
          <LinearGradient
            colors={["rgba(10,11,14,0.1)", "rgba(10,11,14,0.55)", orbita.colors.background]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {children ? <View style={[styles.foot, { width }]}>{children}</View> : null}
        </>
      )}
    </MeasuredBox>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Color de respaldo: aunque la imagen tarde o falle, nunca queda un
    // rectángulo negro plano que se lea como "acá no cargó nada".
    backgroundColor: orbita.colors.surface,
    justifyContent: "flex-end",
    overflow: "hidden"
  },
  rounded: { borderColor: orbita.colors.line, borderRadius: orbita.radius.lg, borderWidth: 1 },
  foot: { alignItems: "center", bottom: orbita.spacing.lg, paddingHorizontal: orbita.spacing.gutter, position: "absolute" }
});
