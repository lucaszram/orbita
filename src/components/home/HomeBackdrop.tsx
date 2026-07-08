import { Image, StyleSheet, View } from "react-native";

const TEXTURE = require("../../../assets/orbita/optimized/core/orbita_daily_texture_a.jpg");

/**
 * Fondo cósmico FIJO detrás de toda la Home: queda quieto mientras el contenido
 * scrollea (inmersivo, como el Figma). Textura orbital sutil + scrim de legibilidad
 * + un glow cobre arriba. Las secciones de la Home son transparentes, así que esto
 * se ve a través de todas.
 */
export function HomeBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={TEXTURE} style={[StyleSheet.absoluteFillObject, styles.texture]} resizeMode="cover" />
      <View style={styles.scrim} />
    </View>
  );
}

const styles = StyleSheet.create({
  // La textura cósmica corre continua por toda la Home, incluido el header (sin glow
  // cálido ni barra oscura arriba): inmersivo y parejo.
  texture: { opacity: 0.5 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(7,8,10,0.42)" }
});
