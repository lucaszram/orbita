import type { NatalChartPayload } from "@/services/appRefs";

/** Mock tipado de la carta natal para la Web B0 (forma = natalCharts.payload). */
export const chartMock: NatalChartPayload = {
  triad: {
    sun: { planet: "Sol", sign: "Leo", house: 10 },
    moon: { planet: "Luna", sign: "Piscis", house: 3 },
    ascendant: { planet: "Ascendente", sign: "Libra" }
  },
  placements: [
    { planet: "Sol", sign: "Leo", house: 10 },
    { planet: "Luna", sign: "Piscis", house: 3 },
    { planet: "Mercurio", sign: "Leo", house: 10 },
    { planet: "Venus", sign: "Virgo", house: 11 },
    { planet: "Marte", sign: "Escorpio", house: 1 },
    { planet: "Júpiter", sign: "Tauro", house: 7 },
    { planet: "Saturno", sign: "Piscis", house: 5 }
  ],
  houses: [
    { house: 1, sign: "Libra" },
    { house: 2, sign: "Escorpio" },
    { house: 3, sign: "Sagitario" },
    { house: 4, sign: "Capricornio" },
    { house: 5, sign: "Acuario" },
    { house: 6, sign: "Piscis" },
    { house: 7, sign: "Aries" },
    { house: 8, sign: "Tauro" },
    { house: 9, sign: "Géminis" },
    { house: 10, sign: "Cáncer" },
    { house: 11, sign: "Leo" },
    { house: 12, sign: "Virgo" }
  ],
  aspects: [
    { from: "Sol", to: "Luna", type: "conjunción", harmony: "harmony" },
    { from: "Venus", to: "Marte", type: "oposición", harmony: "tension" },
    { from: "Júpiter", to: "Saturno", type: "trígono", harmony: "harmony" },
    { from: "Sol", to: "Júpiter", type: "sextil", harmony: "harmony" }
  ],
  accuracy: "Hora exacta · ascendente afinado",
  limitations: []
};
