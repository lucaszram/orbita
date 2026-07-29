import { Redirect } from "expo-router";

/**
 * El "horóscopo de personalidad" se unificó con la Carta natal: la explicación
 * de cada planeta vive en la tabla de la carta (igual que en nativo, ver
 * `app/reading/personalidad.tsx`). La web mantenía una pantalla aparte, que era
 * justamente la deriva que este trabajo elimina.
 */
export default function PersonalidadRoute() {
  return <Redirect href="/carta" />;
}
