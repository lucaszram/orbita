import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_400Regular, Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { RobotoMono_400Regular, RobotoMono_500Medium } from "@expo-google-fonts/roboto-mono";
import { useFonts } from "expo-font";

/** Carga las familias del sistema Órbita (Newsreader / Inter / Roboto Mono). */
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
