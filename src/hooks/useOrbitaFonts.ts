import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_400Regular, Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { RobotoMono_400Regular, RobotoMono_500Medium } from "@expo-google-fonts/roboto-mono";
import { useFonts } from "expo-font";

import { GLYPH_FONT } from "@/theme/glyphFont";

/**
 * Carga las familias del sistema Órbita (Newsreader / Inter / Roboto Mono) más
 * el font de SÍMBOLOS empaquetado (MaterialCommunityIcons), que es el que dibuja
 * los glifos del zodíaco en la rueda natal.
 *
 * El font de símbolos se carga acá y no con el componente `<MaterialCommunityIcons>`
 * porque `react-native-svg` necesita la familia por nombre en `fontFamily`, y
 * para eso tiene que estar registrada antes de dibujar. Este hook ya gatea el
 * render de todas las pantallas, así que el glifo nunca se pinta sin su font.
 */
export function useOrbitaFonts(): boolean {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Newsreader_400Regular,
    Newsreader_500Medium,
    RobotoMono_400Regular,
    RobotoMono_500Medium,
    ...GLYPH_FONT
  });

  return loaded;
}
