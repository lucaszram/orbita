/**
 * Banco editorial de la Home V4.5 (App Core). Voz Órbita: seco, editorial, una
 * idea por bloque. Sin claims de destino/salud/dinero/legal (ver AGENTS.md):
 * entretenimiento + autoconocimiento.
 *
 * El primer elemento de cada banco coincide con el copy del Figma
 * `UX V4.5 - Órbita App Core`; el resto son variantes para la rotación diaria.
 */

import { Topic } from "../domain/types";

export const signalHeadlines = [
  "Hoy tu energía necesita dirección.",
  "Hay una señal chica pidiendo lugar hoy.",
  "El día se ordena si elegís una cosa a la vez.",
  "Bajá el ruido y va a aparecer lo importante.",
  "No todo lo intenso pide respuesta hoy.",
  "Tu claridad vuelve cuando dejás de forzarla."
] as const;

export const signalBodies = [
  "Una señal concreta para elegir qué mirar primero y qué dejar para después.",
  "Un clima del día para leer con calma, no para obedecer.",
  "Menos interpretación y más presencia sobre lo que ya sabés.",
  "Una lectura breve para acomodar el foco antes de actuar."
] as const;

export const signalCopies = [
  "No respondas desde cansancio. Esperá a tener una frase limpia.",
  "Antes de decidir, fijate qué dato te falta.",
  "Elegí una conversación y bajala a algo concreto.",
  "Si algo pesa, nombralo antes de convertirlo en tarea.",
  "Una pausa corta hoy ordena más que diez ideas juntas."
] as const;

export const guideHeadlines = [
  "Una acción chica ordena el día.",
  "El foco de hoy cabe en una frase.",
  "Menos frentes, más precisión.",
  "Hoy alcanza con sostener una sola cosa.",
  "La calma también es una decisión."
] as const;

export const guideIntros = [
  "Tu carta marca un clima sensible: menos reacción, más lectura fina.",
  "El día pide método antes que impulso.",
  "Hay energía disponible si no la gastás en ruido.",
  "Lo importante hoy no llega gritando: llega repitiéndose."
] as const;

export const energiaLines = [
  "Intensa, pero manejable si no le das todo el volante.",
  "Estable: buena para cerrar algo pendiente.",
  "Sensible; cuidá el ritmo y las respuestas rápidas.",
  "Movida por dentro; dale tierra con una acción simple.",
  "Baja y suave: sirve para ordenar, no para expandir."
] as const;

export const longReadTitles = [
  "Cómo se mueve tu cielo hoy.",
  "Por qué el día se siente así.",
  "Lo que tu carta activa hoy.",
  "Una vuelta más al clima de hoy."
] as const;

export const longReadBodies = [
  "Una lectura breve para entender por qué ciertas conversaciones se sienten más cargadas y qué hacer con eso.",
  "Un repaso corto del tránsito destacado y cómo aterriza en tu día concreto.",
  "Qué parte tuya se activa hoy y por dónde conviene empezar.",
  "El porqué detrás de la señal del día, sin tecnicismos."
] as const;

export const educationalTitles = [
  "Tu carta no predice. Ordena contexto.",
  "La astrología acá es lenguaje, no sentencia.",
  "Un tránsito describe un clima, no un destino.",
  "Leer el cielo es leerte con más aire."
] as const;

export const dailyQuestions = [
  "¿Qué estás queriendo resolver demasiado rápido?",
  "¿Qué conversación necesita menos defensa y más precisión?",
  "¿Qué parte de este deseo pide escucha antes que acción?",
  "¿Qué podés soltar hoy sin dramatizarlo?",
  "¿Dónde estás pidiendo certeza cuando alcanza con calma?",
  "¿Qué dato estás ignorando para decidir tranquilo?",
  "¿Qué te haría bien dejar para mañana sin culpa?"
] as const;

/** Copy por topic de la Home. `title` es la fila serif visible en Topics. */
export const homeTopicCopy: Record<
  "amor" | "trabajo" | "familia" | "vinculos",
  { title: string; oneLine: string; detail: string; hace: string; evita: string; question: string }
> = {
  amor: {
    title: "Amor sin prueba",
    oneLine: "El deseo no necesita examen. Mostrá algo simple y mirá qué responde.",
    detail:
      "Hoy el amor rinde más desde la reciprocidad visible que desde la intensidad. No midas por chispa: mirá dónde hay calma, presencia y continuidad. Una señal clara vale más que diez interpretaciones.",
    hace: "Elegí una señal concreta de afecto y dala sin esperar retorno inmediato.",
    evita: "Hacerte menos para gustar o leer entre líneas lo que podés preguntar.",
    question: "¿Qué parte de este deseo pide escucha antes que acción?"
  },
  trabajo: {
    title: "Trabajo pide foco",
    oneLine: "Una tarea cerrada vale más que cinco ideas abiertas al mismo tiempo.",
    detail:
      "La claridad laboral aparece cuando ordenás el método, no cuando abrís más frentes. Elegí la tarea que desbloquea al resto y dale veinte minutos reales antes de dispersarte.",
    hace: "Marcá la tarea que desbloquea el resto y empezala por veinte minutos.",
    evita: "Abrir diez pestañas mentales y no cerrar ninguna.",
    question: "¿Cuál es el primer paso concreto que estás evitando?"
  },
  familia: {
    title: "Casa y familia",
    oneLine: "Bajá el volumen de lo urgente. Hay algo doméstico que pide orden simple.",
    detail:
      "Una dinámica vieja no necesita repetirse para pertenecer. Podés cuidar con un límite. Ordená un espacio concreto de tu casa como si ordenaras una emoción.",
    hace: "Respondé desde lo que hoy podés sostener, no desde la culpa.",
    evita: "Confundir nostalgia con señal de volver a un lugar viejo.",
    question: "¿Qué heredado no necesitás repetir hoy?"
  },
  vinculos: {
    title: "Tensión en vínculos",
    oneLine: "No todo silencio es distancia. Hoy mirá quién sostiene presencia sin espectáculo.",
    detail:
      "El vínculo se ordena cuando bajás la expectativa a una frase simple. Menos interpretación, más honestidad. Lo que no se pregunta se convierte en fantasía.",
    hace: "Decí lo que necesitás en una línea, sin adornar ni exigir.",
    evita: "Tomar distancia dramática para probar si alguien te busca.",
    question: "¿Qué pregunta abre mejor este tema, sin defensa?"
  }
};

export const homeEndLines = ["Fin de la lectura de hoy.", "Eso es todo por hoy.", "Cerramos la lectura de hoy."] as const;

/** Ayuda para etiquetar la energía a partir del label cualitativo existente. */
export function energiaFromLabel(energyLabel: string): string {
  const map: Record<string, string> = {
    "Baja suave": "Baja y suave: sirve para ordenar, no para expandir.",
    Estable: "Estable: buena para cerrar algo pendiente.",
    Intuitiva: "Sensible; cuidá el ritmo y las respuestas rápidas.",
    Movida: "Movida por dentro; dale tierra con una acción simple.",
    Expansiva: "Intensa, pero manejable si no le das todo el volante."
  };
  return map[energyLabel] ?? energiaLines[0];
}

export const homeTopicKeys: Topic[] = ["amor", "trabajo", "familia", "vinculos"];
