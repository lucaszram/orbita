import type { ValuesMapPayload } from "@/services/appRefs";

/** Mock tipado del mapa de valores para la Web B0 (forma = charts.valuesMap). */
export const valuesMock: ValuesMapPayload = {
  axes: [
    { key: "amor", label: "Amor", harmony: 0.85, tension: 0.42 },
    { key: "familia", label: "Familia", harmony: 0.62, tension: 0.5 },
    { key: "trabajo", label: "Trabajo", harmony: 0.72, tension: 0.6 },
    { key: "dinero", label: "Dinero", harmony: 0.4, tension: 0.72 },
    { key: "libertad", label: "Libertad", harmony: 0.82, tension: 0.32 },
    { key: "creatividad", label: "Creatividad", harmony: 0.9, tension: 0.36 },
    { key: "estabilidad", label: "Estabilidad", harmony: 0.5, tension: 0.66 },
    { key: "vinculos", label: "Vínculos", harmony: 0.75, tension: 0.46 }
  ],
  topDrivers: [
    { label: "Creatividad", value: 0.9 },
    { label: "Amor", value: 0.85 },
    { label: "Libertad", value: 0.82 }
  ],
  topStressors: [
    { label: "Dinero", value: 0.72 },
    { label: "Estabilidad", value: 0.66 },
    { label: "Trabajo", value: 0.6 }
  ],
  note: "Este mapa es una foto, no una sentencia. Muestra tendencias de tu carta para que sepas dónde apoyarte y dónde ir más despacio. Cambia con el trabajo personal."
};
