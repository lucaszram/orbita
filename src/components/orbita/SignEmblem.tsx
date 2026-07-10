import { Image, StyleSheet, View } from "react-native";
import type { ZodiacSign } from "@/domain/types";
import { orbita } from "@/theme/orbita";

// Emblemas de cobre por signo (assets optimizados desde archive-10/zodiac-emblems).
// Capricornio todavía no tiene asset generado → cae al placeholder (aro de cobre).
const EMBLEMS: Partial<Record<ZodiacSign, ReturnType<typeof require>>> = {
  aries: require("../../../assets/orbita/optimized/emblems/zodiac_aries.jpg"),
  tauro: require("../../../assets/orbita/optimized/emblems/zodiac_taurus.jpg"),
  geminis: require("../../../assets/orbita/optimized/emblems/zodiac_gemini.jpg"),
  cancer: require("../../../assets/orbita/optimized/emblems/zodiac_cancer.jpg"),
  leo: require("../../../assets/orbita/optimized/emblems/zodiac_leo.jpg"),
  virgo: require("../../../assets/orbita/optimized/emblems/zodiac_virgo.jpg"),
  libra: require("../../../assets/orbita/optimized/emblems/zodiac_libra.jpg"),
  escorpio: require("../../../assets/orbita/optimized/emblems/zodiac_scorpio.jpg"),
  sagitario: require("../../../assets/orbita/optimized/emblems/zodiac_sagittarius.jpg"),
  acuario: require("../../../assets/orbita/optimized/emblems/zodiac_aquarius.jpg"),
  piscis: require("../../../assets/orbita/optimized/emblems/zodiac_pisces.jpg")
  // capricornio: pendiente de generar
};

/** Emblema de cobre de un signo, en círculo. Fondo oscuro del asset = se funde con la app. */
export function SignEmblem({ sign, size = 48 }: { sign: ZodiacSign; size?: number }) {
  const src = EMBLEMS[sign];
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {src ? <Image source={src} style={{ width: size, height: size }} resizeMode="cover" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    backgroundColor: "#12121A",
    borderColor: "rgba(196,106,58,0.35)",
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden"
  }
});
