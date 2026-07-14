import type { SunSignContentPayload } from "@/services/skyRefs";

/** Mock tipado del contenido diario por signo (forma = content.sunSignDaily). */
export const sunSignMock: SunSignContentPayload = {
  sign: "Escorpio",
  date: "2026-07-07",
  headline: "Hoy conviene mirar antes de definir.",
  body: "El día favorece registrar lo que sentís sin convertirlo enseguida en conclusión. Una conversación pendiente se destraba si bajás la intensidad a una frase concreta.",
  mood: "introspectivo",
  disclaimer: "Lectura de contexto para tu signo, en clave de autoconocimiento. No es consejo de salud, dinero ni decisiones de riesgo."
};
