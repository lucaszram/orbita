import { VinculosConnectScreen } from "@/screens/v492/VinculosConnectScreen";

/**
 * Alta de una persona (`/vinculos/conectar`).
 *
 * Cuelga del stack de Vínculos: al guardar se abre el perfil persistido sin
 * salir de la pestaña. La web conserva `/vinculo` — ver `.web.tsx`.
 */
export default function VinculosConectarRoute() {
  return <VinculosConnectScreen />;
}
