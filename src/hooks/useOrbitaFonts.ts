import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_400Regular, Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { RobotoMono_400Regular, RobotoMono_500Medium } from "@expo-google-fonts/roboto-mono";
import { useFonts } from "expo-font";

/**
 * Carga las familias del sistema Órbita (Newsreader / Inter / Roboto Mono).
 *
 * Los símbolos astrológicos ya NO dependen de ninguna fuente: son vectores
 * propios empaquetados (`domain/astroGlyphs` + `components/orbita/AstroGlyph`),
 * así que acá no se carga ningún font de glifos. La mono sigue dibujando los
 * numerales de casa y la marca `Rx` de la rueda.
 */
export function useOrbitaFonts(): boolean {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Newsreader_400Regular,
    Newsreader_500Medium,
    RobotoMono_400Regular,
    RobotoMono_500Medium
  });

  return loaded;
}
