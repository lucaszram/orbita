import { Redirect } from "expo-router";

/**
 * El "horóscopo de personalidad" se unificó con la Carta natal: la explicación de
 * cada planeta vive en la tabla de la carta. Esta ruta redirige a la carta para no
 * romper links/deep-links viejos.
 */
export default function PersonalidadScreen() {
  return <Redirect href="/(tabs)/carta" />;
}
