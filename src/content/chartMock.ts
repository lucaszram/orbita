import type { NatalChartPayload } from "@/services/appRefs";

/**
 * Mock tipado de la carta natal (forma = natalCharts.payload). Es el estado DEMO
 * (invitado / sin sesión). Lleva longitudes/cúspides/Asc coherentes para que la
 * rueda se vea como una carta real (no es data de ningún usuario).
 */
export const chartMock: NatalChartPayload = {
  triad: {
    sun: { planet: "Sol", key: "sun", sign: "Leo", house: 10 },
    moon: { planet: "Luna", key: "moon", sign: "Piscis", house: 3 },
    ascendant: { planet: "Ascendente", key: "ascendant", sign: "Libra", house: 1 }
  },
  placements: [
    { planet: "Sol", key: "sun", sign: "Leo", house: 10, fullDegree: 128, normDegree: 8 },
    { planet: "Luna", key: "moon", sign: "Piscis", house: 3, fullDegree: 340, normDegree: 10 },
    { planet: "Mercurio", key: "mercury", sign: "Leo", house: 10, fullDegree: 138, normDegree: 18 },
    { planet: "Venus", key: "venus", sign: "Virgo", house: 11, fullDegree: 160, normDegree: 10 },
    { planet: "Marte", key: "mars", sign: "Escorpio", house: 1, fullDegree: 220, normDegree: 10, isRetrograde: true },
    { planet: "Júpiter", key: "jupiter", sign: "Tauro", house: 7, fullDegree: 45, normDegree: 15 },
    { planet: "Saturno", key: "saturn", sign: "Piscis", house: 5, fullDegree: 350, normDegree: 20 }
  ],
  houses: [
    { house: 1, sign: "Libra", cusp: 185, theme: "Identidad y presencia" },
    { house: 2, sign: "Escorpio", cusp: 215, theme: "Recursos y valores" },
    { house: 3, sign: "Sagitario", cusp: 245, theme: "Mente y vínculos cercanos" },
    { house: 4, sign: "Capricornio", cusp: 275, theme: "Hogar y raíces" },
    { house: 5, sign: "Acuario", cusp: 305, theme: "Creatividad y disfrute" },
    { house: 6, sign: "Piscis", cusp: 335, theme: "Rutina y cuerpo" },
    { house: 7, sign: "Aries", cusp: 5, theme: "Vínculos y acuerdos" },
    { house: 8, sign: "Tauro", cusp: 35, theme: "Intimidad y transformación" },
    { house: 9, sign: "Géminis", cusp: 65, theme: "Sentido y horizonte" },
    { house: 10, sign: "Cáncer", cusp: 95, theme: "Vocación y rumbo" },
    { house: 11, sign: "Leo", cusp: 125, theme: "Comunidad y futuro" },
    { house: 12, sign: "Virgo", cusp: 155, theme: "Interioridad y descanso" }
  ],
  aspects: [
    { from: "Sol", to: "Luna", type: "conjunction", typeEs: "conjunción", harmony: "harmony", orb: 2, isMajor: true },
    { from: "Venus", to: "Marte", type: "opposition", typeEs: "oposición", harmony: "tension", orb: 3, isMajor: true },
    { from: "Júpiter", to: "Saturno", type: "trine", typeEs: "trígono", harmony: "harmony", orb: 1, isMajor: true },
    { from: "Sol", to: "Júpiter", type: "sextile", typeEs: "sextil", harmony: "harmony", orb: 4, isMajor: true }
  ],
  ascendantDegree: 185,
  mc: 95,
  mainAspects: [
    { from: "Sol", to: "Luna", type: "conjunction", typeEs: "conjunción", harmony: "harmony", orb: 2, isMajor: true },
    { from: "Júpiter", to: "Saturno", type: "trine", typeEs: "trígono", harmony: "harmony", orb: 1, isMajor: true },
    { from: "Venus", to: "Marte", type: "opposition", typeEs: "oposición", harmony: "tension", orb: 3, isMajor: true }
  ],
  accuracy: "Hora exacta · ascendente afinado",
  limitations: []
};
