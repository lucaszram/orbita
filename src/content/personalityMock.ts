import type { PersonalityReadingPayload } from "@/services/appRefs";

/** Mock tipado del horóscopo de personalidad (forma = charts.personalityReading). */
export const personalityMock: PersonalityReadingPayload = {
  headline: "Quién sos, en tu propio cielo.",
  sections: [
    {
      key: "identidad",
      title: "Identidad",
      intro: "Cómo te parás en el mundo y qué te enciende.",
      placement: { label: "Sol en Leo", planet: "Sol", sign: "Leo" },
      body:
        "Tu identidad se juega desde el brillo y la generosidad: necesitás que lo que hacés lleve un sello propio, y cuando te reconocen, florecés. El aprendizaje es no depender de la mirada ajena para sentir que valés — el brillo más sólido es el que no pide permiso."
    },
    {
      key: "amor",
      title: "Amor y relaciones",
      intro: "Cómo querés y cómo te gusta que te quieran.",
      placement: { label: "Venus en Libra", planet: "Venus", sign: "Libra" },
      body:
        "Buscás vínculos con armonía, estética y reciprocidad. Te cuesta el conflicto directo: preferís tender puentes antes que romperlos. Tu aprendizaje es sostener tu propio deseo sin diluirlo para evitar la fricción — querer bien también incluye poder decir que no."
    },
    {
      key: "expansion",
      title: "Crecimiento y expansión",
      intro: "Dónde se te abre el juego cuando confiás.",
      placement: { label: "Júpiter en la casa 12", planet: "Júpiter", house: 12 },
      body:
        "Tu expansión pasa por lo invisible: el mundo interno, el descanso, lo simbólico. Crecés cuando te permitís soltar el control y confiar en procesos que todavía no ves del todo. La generosidad silenciosa y el trabajo con vos mismo suelen abrirte más que la búsqueda de reconocimiento."
    }
  ],
  disclaimer: "Esta lectura describe tendencias de tu carta, no un destino. Sos vos quien las habita, las trabaja y las cambia."
};
