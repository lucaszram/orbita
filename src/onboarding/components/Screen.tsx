import { type ReactNode } from "react";
import {
  ImageBackground,
  type ImageSourcePropType,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { ContentCanvas } from "@/components/orbita/ContentCanvas";

import { orbita } from "../theme";

type Props = {
  /** Full-bleed immersive background asset. */
  bg?: ImageSourcePropType;
  /** Image opacity (kept high; the gradient handles legibility). */
  bgOpacity?: number;
  /** Strength of the dark legibility wash over the asset. */
  wash?: number;
  children: ReactNode;
};

/**
 * Dark immersive screen shell: full-bleed asset + legibility wash + safe area.
 *
 * El fondo sigue siendo full-bleed (es atmósfera); el CONTENIDO viaja en el
 * lienzo compartido, en la variante `form`: una columna de 480 centrada. Los
 * quince pasos del alta, el login, la recuperación y el editor de datos montan
 * este shell, así que en escritorio ninguno estira sus CTAs
 * (`alignSelf: stretch`) ni sus párrafos a lo ancho de la ventana.
 *
 * Por qué 480 y no la columna de lectura de 720: cada paso es UNA pregunta con
 * un CTA al pie. A 720 el botón medía media ventana y el paso se leía como una
 * captura de teléfono estirada; a 480 es una columna deliberada sobre el fondo
 * cósmico, que es como se compone un alta en la web. Debajo de 480 la variante
 * es ancho completo, así que en un teléfono no cambia NADA: el nativo y la web
 * angosta quedan idénticos.
 */
export function Screen({ bg, bgOpacity = 1, wash = 0.55, children }: Props) {
  return (
    <View style={styles.root}>
      {bg ? (
        <ImageBackground
          source={bg}
          style={StyleSheet.absoluteFill}
          // width/height/resizeMode van EXPLÍCITOS en `imageStyle`: en
          // react-native-web, pasar un imageStyle propio pisa el sizing por
          // defecto y el <img> queda a su tamaño intrínseco. Acá el fondo salía
          // a 393px dentro de un viewport de 318 y desbordaba el onboarding en
          // móvil. En nativo no se nota, por eso nunca apareció.
          imageStyle={{ height: "100%", opacity: bgOpacity, resizeMode: "cover", width: "100%" }}
          resizeMode="cover"
        >
          <LinearGradient
            colors={[
              `rgba(6,7,10,${Math.max(0, wash - 0.38)})`,
              `rgba(6,7,10,${Math.max(0, wash - 0.12)})`,
              `rgba(6,7,10,${wash})`,
              "rgba(6,7,10,0.88)",
            ]}
            locations={[0, 0.42, 0.68, 1]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      ) : null}
      <SafeAreaView style={styles.safe}>
        <ContentCanvas fill variant="form">{children}</ContentCanvas>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: orbita.bg, flex: 1 },
  safe: { flex: 1 },
});
