import type { SolarReturnPayload } from "@/services/skyRefs";

/** Mock tipado de la revolución solar (forma = charts.solarReturn). */
export const solarReturnMock: SolarReturnPayload = {
  year: 2026,
  headline: "Tu año, leído desde tu vuelta al Sol.",
  ascendant: "Géminis",
  themes: [
    { area: "Foco del año", body: "Aparece un tono más curioso y conversador: aprender, moverte y conectar puntos que venías teniendo sueltos." },
    { area: "Dónde poner energía", body: "Vínculos y acuerdos cotidianos. El año pide claridad en cómo pedís y cómo respondés." }
  ],
  highlights: [
    { label: "Ascendente del año", body: "Géminis: te presentás más liviano y disponible; sirve no dispersarte." },
    { label: "Clima general", body: "Movimiento por sobre quietud. Mejor decisiones chicas y frecuentes que un solo gran salto." }
  ],
  disclaimer:
    "La revolución solar es un marco de tendencias para tu año, no una promesa de hechos. Sin claims de salud, dinero ni resultados."
};
