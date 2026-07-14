import { VoidExperience } from "@/components/void/VoidExperience";

/** Tab El Vacío. Raíz de tab → sin botón "volver". */
export default function VacioTab() {
  return <VoidExperience showBack={false} />;
}
