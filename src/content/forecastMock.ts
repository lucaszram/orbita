import type { LongRangeForecastPayload } from "@/services/skyRefs";

/** Mock tipado del pronóstico largo (forma = forecast.getLongRange). */
export const forecastMock: LongRangeForecastPayload = {
  headline: "Tus próximos años, en los ciclos lentos que ya se están moviendo.",
  windows: [
    {
      id: "saturn-h10",
      title: "Saturno por tu casa 10",
      range: "hasta marzo 2027",
      theme: "estructura",
      body: "Un tramo para ordenar cómo querés que te vean y sostener lo que construís. Menos improvisación, más método propio."
    },
    {
      id: "jupiter-h5",
      title: "Júpiter por tu casa 5",
      range: "los próximos meses",
      theme: "expresión",
      body: "Se abre espacio para mostrar algo tuyo con menos filtro. Buen contexto para el juego, la creación y lo que te da placer."
    },
    {
      id: "outer-slow",
      title: "Fondo lento (Urano · Neptuno)",
      range: "ventana amplia",
      theme: "identidad",
      body: "Cambios de fondo que no se resuelven en un día. Sirve registrarlos como dirección, no como urgencia."
    }
  ],
  disclaimer:
    "Es lectura de contexto sobre ciclos, no un calendario de hechos garantizados. Órbita no predice destino ni resultados."
};
