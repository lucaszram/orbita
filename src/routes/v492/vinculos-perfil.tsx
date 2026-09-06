import { Redirect, useLocalSearchParams } from "expo-router";
import { VINCULOS_ROUTE } from "@/domain/relationships";
import { VinculosProfileScreen } from "@/screens/v492/VinculosProfileScreen";

/**
 * Perfil canónico de una persona guardada (`/vinculos/[profileId]`).
 *
 * Desde QA23-005 esta ruta es el PERFIL —quién es esa persona, qué datos quedaron
 * guardados y qué vínculo se declaró—, no la comparación: ésa pasó a colgar de
 * acá, en `/vinculos/[profileId]/comparacion`.
 *
 * Lo que llega por la URL es un string, no un id: se pasa como string a la
 * pantalla, que lo resuelve contra la lista autorizada de la cuenta. Sin segmento
 * no hay nada que abrir y se vuelve a la raíz de la sección.
 */
export default function VinculosPerfilRoute() {
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  if (typeof profileId !== "string" || profileId.length === 0) {
    return <Redirect href={VINCULOS_ROUTE as never} />;
  }
  return <VinculosProfileScreen profileId={profileId} />;
}
