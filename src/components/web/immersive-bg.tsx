import { ReactNode } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import { webAssets } from "@/content/webAssets";

type BgKey = keyof typeof webAssets;

/**
 * Capa de fondo cósmico: base negra + imagen tenue + scrim sólido + glows.
 * Debe montarse dentro de un contenedor con ALTURA DEFINIDA (ver ImmersiveScreen),
 * porque en react-native-web un `top:0/bottom:0` sin altura de padre colapsa y el
 * scrim no cubre — dejando la imagen a brillo pleno abajo.
 */
export function ImmersiveBg({ asset = "heroOrbital", opacity = 0.28 }: { asset?: BgKey; opacity?: number }) {
  const src = webAssets[asset];
  return (
    <View style={styles.fill} pointerEvents="none">
      <Image source={src.require} resizeMode="cover" style={[styles.fill, { opacity }]} />
      <View style={styles.scrim} />
      <LinearGradient colors={["rgba(196,106,58,0.18)", "rgba(196,106,58,0)"]} style={styles.glowTop} />
    </View>
  );
}

/** Envuelve una pantalla: base negra + fondo inmersivo FIJO (alto = viewport) detrás del contenido. */
export function ImmersiveScreen({
  children,
  asset = "heroOrbital",
  opacity = 0.28
}: {
  children: ReactNode;
  asset?: BgKey;
  opacity?: number;
}) {
  const { height } = useWindowDimensions();
  return (
    <View style={styles.root}>
      <View style={[styles.bgBox, { height }]} pointerEvents="none">
        <ImmersiveBg asset={asset} opacity={opacity} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#07080A", flex: 1 },
  bgBox: { left: 0, position: "absolute", right: 0, top: 0 },
  fill: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  scrim: { backgroundColor: "rgba(7,8,10,0.64)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  glowTop: { height: 460, left: 0, position: "absolute", right: 0, top: 0 }
});

export default ImmersiveBg;
