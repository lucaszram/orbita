import { ReactNode } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { ImageBackground, StyleSheet, useWindowDimensions, View } from "react-native";
import { webAssets } from "@/content/webAssets";

type BgKey = keyof typeof webAssets;

/**
 * Envuelve una pantalla con fondo cósmico FIJO.
 *
 * Clave: la raíz tiene ALTURA EXPLÍCITA = viewport (`useWindowDimensions`), no
 * `flex:1`. En la web el layout de Expo hace que el documento scrollee y un
 * `flex:1` crece con el contenido → el `absoluteFill` del scrim colapsa y deja la
 * imagen a brillo pleno. Con altura fija, el ScrollView hijo scrollea internamente
 * y el fondo (imagen + scrim) queda fijo y parejo detrás.
 */
export function ImmersiveScreen({
  children,
  asset = "heroOrbital",
  opacity = 0.3
}: {
  children: ReactNode;
  asset?: BgKey;
  opacity?: number;
}) {
  const { height, width } = useWindowDimensions();
  return (
    <View style={[styles.root, { height, width }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ImageBackground source={webAssets[asset].require} resizeMode="cover" style={StyleSheet.absoluteFill} imageStyle={{ opacity }}>
          <View style={styles.scrim} />
          <LinearGradient colors={["rgba(196,106,58,0.16)", "rgba(196,106,58,0)"]} style={styles.glow} />
        </ImageBackground>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#07080A", overflow: "hidden" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(7,8,10,0.66)" },
  glow: { height: 460, left: 0, position: "absolute", right: 0, top: 0 }
});

export default ImmersiveScreen;
