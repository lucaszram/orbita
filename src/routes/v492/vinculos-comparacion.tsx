import { Redirect, useLocalSearchParams } from "expo-router";
import { VINCULOS_ROUTE } from "@/domain/relationships";
import { VinculosResultScreen } from "@/screens/v492/VinculosResultScreen";

/**
 * Comparación con una persona guardada
 * (`/vinculos/[profileId]/comparacion`).
 *
 * Es una ruta HIJA del perfil (QA23-005): la comparación es una de las cosas que
 * se pueden hacer con una persona guardada, no la persona. Colgando de ahí,
 * `Atrás` es un `pop` que cae en su perfil —el que la abrió— y un deep link
 * directo tiene ese mismo perfil como respaldo.
 *
 * Lo que llega por la URL es un string, no un id: se pasa como string a la
 * pantalla, que lo resuelve contra la lista autorizada de la cuenta. Sin segmento
 * no hay comparación posible y se vuelve a la raíz de la sección.
 */
export default function VinculosComparacionRoute() {
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  if (typeof profileId !== "string" || profileId.length === 0) {
    return <Redirect href={VINCULOS_ROUTE as never} />;
  }
  return <VinculosResultScreen profileId={profileId} />;
}
