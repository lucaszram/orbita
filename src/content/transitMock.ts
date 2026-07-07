import type { TransitDetailPayload } from "@/services/appRefs";

/** Mock tipado del tránsito destacado del día para la Web B0. */
export const transitMock: TransitDetailPayload = {
  title: "Mercurio cruza tu Venus.",
  aspect: { type: "Conjunción", angleLabel: "0°" },
  scene: {
    transitingBody: { name: "Mercurio", label: "MERCURIO · HOY" },
    natalPoint: { name: "Venus", sign: "Leo", label: "TU VENUS · LEO" }
  },
  reading: {
    fragments: [
      { source: "MERCURIO · HOY", text: "Lo que decís y pensás hoy" },
      { source: "CONJUNCIÓN · 0°", text: "se junta y amplifica" },
      { source: "TU VENUS EN LEO", text: "tu forma cálida de querer y crear." }
    ],
    plain: "En criollo: buen día para poner en palabras algo que venís sintiendo."
  },
  frequency: {
    label: "Una vez por año, más o menos.",
    timeline: [
      { label: "Ene 2024", current: false },
      { label: "Ene 2025", current: false },
      { label: "Ene 2026", current: true },
      { label: "Ene 2027", current: false }
    ]
  },
  earth: {
    headline: "Ahora mismo, te empuja a decir lo que sentís.",
    suggestions: [
      "Decirle a alguien lo que significa para vos.",
      "Tener una conversación honesta sobre lo que necesitás.",
      "Poner en palabras algo que venías rumiando."
    ]
  },
  window: {
    label: "~ 5 días",
    note: "No es una obligación: es una ventana que se abre y se cierra sola."
  }
};
