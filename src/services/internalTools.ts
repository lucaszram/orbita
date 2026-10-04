import { Platform } from "react-native";

/**
 * Superficies internas (Studio, Lab, backoffice) fuera del sitio público.
 *
 * El backend ya falla cerrado en producción: `publicLab` rechaza aunque se
 * conozca la URL y backoffice/Studio exigen identidad Clerk allowlisteada. Este
 * flag es la otra mitad — que la web publicada ni siquiera rutee a esas
 * pantallas — para no publicar un shell interno que cualquiera pueda tantear.
 *
 * Apagado salvo que se pida explícitamente. Un deploy que se olvida de setear
 * la variable queda cerrado, no abierto.
 *
 * SÓLO WEB. En la app nativa vale `false` sin mirar la variable: el binario de
 * la tienda no puede tener un modo interno que se encienda desde el entorno de
 * compilación (salto de pasos del alta por `debugStep`, superficies de lab).
 */
export const INTERNAL_TOOLS_ENABLED =
  Platform.OS === "web" && process.env.EXPO_PUBLIC_ORBITA_INTERNAL_TOOLS === "true";
