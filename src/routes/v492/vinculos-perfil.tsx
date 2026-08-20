import { Redirect, useLocalSearchParams } from "expo-router";
import { VinculosResultScreen } from "@/screens/v492/VinculosResultScreen";

/**
 * Comparación con una persona guardada (`/vinculos/[profileId]`).
 *
 * Lo que llega por la URL es un string, no un id: se pasa como string a la
 * pantalla, que lo resuelve contra la lista autorizada de la cuenta. Sin
 * segmento no hay nada que abrir y se vuelve a la raíz de la sección.
 */
export default function VinculosPerfilRoute() {
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  if (typeof profileId !== "string" || profileId.length === 0) {
    return <Redirect href="/vinculos" />;
  }
  return <VinculosResultScreen profileId={profileId} />;
}
