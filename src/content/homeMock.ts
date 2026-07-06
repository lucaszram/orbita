import type { PublicDailyHome } from "@/services/publicLabRefs";

/**
 * Mock tipado de la Home diaria para la Web B0.
 * Forma = `PublicDailyHome` (lo que devolverá `appApi.readings.getToday`).
 * Copy alineado con el diseño Figma `Home Web / Desktop`.
 */
export const homeMock: PublicDailyHome = {
  displayName: "Lucas",
  localDate: "2026-07-05",
  timezone: "America/Argentina/Buenos_Aires",
  header: {
    localDate: "2026-07-05",
    timezone: "America/Argentina/Buenos_Aires",
    greeting: "Buenas, Lucas.",
    headline: "Un día para ordenar antes de avanzar.",
    subheadline:
      "Tu día leído contra tu carta. Sin promesas raras: contexto para elegir con un poco más de claridad."
  },
  natalBase: {
    sun: { sign: "Leo" },
    moon: { sign: "Piscis" },
    ascendant: { sign: "Libra" },
    accuracy: "Hora exacta · ascendente afinado",
    limitations: []
  },
  highlightedTransit: null,
  modules: {
    do: [
      "Cerrá una conversación que quedó abierta.",
      "Elegí una sola prioridad para la mañana.",
      "Dejá margen antes de decir que sí."
    ],
    avoid: [
      "Arrancar tres cosas nuevas a la vez.",
      "Forzar una respuesta que todavía no está.",
      "Medir el día por lo que no llegaste a hacer."
    ],
    energy: "Media, en subida. Rinde más el foco sostenido que los arranques.",
    action: "Escribí en una línea qué querés resolver antes de que termine el día.",
    question: "¿Qué estás sosteniendo por costumbre más que por deseo?"
  },
  topics: [
    {
      topic: "amor",
      title: "Amor",
      oneLine: "Se pide presencia, no promesas. Un gesto concreto vale más que una definición.",
      question: "¿Dónde estás esperando en vez de decir?"
    },
    {
      topic: "trabajo",
      title: "Trabajo",
      oneLine: "Rinde cerrar lo abierto antes que sumar. Tu foco es el recurso escaso de hoy.",
      question: "¿Qué tarea estás evitando por aburrida?"
    },
    {
      topic: "familia",
      title: "Familia",
      oneLine: "Aparece una conversación pendiente. Escuchar destraba más que explicar.",
      question: "¿A quién le debés una respuesta?"
    },
    {
      topic: "vinculos",
      title: "Vínculos",
      oneLine: "Los lazos piden mantenimiento simple: un mensaje, una pregunta real.",
      question: "¿A quién extrañás sin habérselo dicho?"
    }
  ],
  longRead: {
    title: "El tránsito de hoy, con más contexto.",
    body:
      "Cuando la Luna toca a Mercurio, lo que sentís pesa más que lo que pensás. Te contamos por qué hoy conviene posponer las definiciones finas y qué mirar en cambio."
  },
  void: {
    questionOfDay: "¿Qué estás sosteniendo por costumbre más que por deseo?"
  },
  futureSelf: {
    prompt: "¿Qué te movió hoy?",
    placeholder: "Hoy noto que…"
  },
  personalization: { explanation: "Demo sin proveedor: contenido de maqueta.", basedOn: [], confidence: "demo" },
  chartProfile: null,
  transits: {
    highlighted: { displayText: "Luna en Piscis en tensión con Mercurio." },
    secondary: [
      { displayText: "Sol en armonía con Saturno" },
      { displayText: "Venus entra en Cáncer" },
      { displayText: "Marte en Aries, en cierre" }
    ],
    explanation:
      "Las palabras salen más cargadas de emoción que de precisión. No es día para cerrar acuerdos finos; sí para escuchar lo que aparece entre líneas."
  },
  provider: { status: "demo", warnings: [], error: null },
  modelGaps: [],
  modelVersions: {},
  reviewStatus: "demo",
  contentVersion: "mock-1",
  calculationVersion: "mock-1",
  mode: "demo",
  source: "mock"
};
