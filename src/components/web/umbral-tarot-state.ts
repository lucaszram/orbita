/**
 * Qué muestra Umbral › Tarot, resuelto sin pintar nada.
 *
 * Vive aparte del componente porque `tsx --test` corre en node: un módulo que
 * importe react-native no se puede testear. Acá está la única decisión que no
 * es obvia mirando la pantalla, y es la que causó un incidente real.
 *
 * La regla: `revealed` llega por `daily.getStrip` (query reactiva) y la carta
 * por `daily.getGuide` (action), así que el estado revelado puede llegar ANTES
 * que la carta. «Revelada sin carta» es carga inconsistente, no una carta dada
 * vuelta — si no, el flip gira hacia una cara vacía y queda sólo el marco.
 */

export type TarotPanelMode =
  | "cargando"   // la guía del día todavía no llegó
  | "error"      // la guía falló y se puede reintentar
  | "cerrada"    // hay carta y todavía no se dio vuelta: el ritual está disponible
  | "revelada";  // dada vuelta, con carta válida para mostrar

export type TarotPanelView = {
  mode: TarotPanelMode;
  /** La carta no se puede tocar todavía. */
  disabled: boolean;
};

export function umbralTarotView(input: {
  /** Estado de `useDailyGuide` para hoy. */
  status: "loading" | "ready" | "error";
  /** ¿El payload trae carta? El sorteo no depende del LLM, pero puede no haber llegado. */
  hasCarta: boolean;
  /** `revealedAt` de hoy según `daily.getStrip`. */
  revealed: boolean;
}): TarotPanelView {
  if (input.status === "error") return { mode: "error", disabled: true };
  if (input.status !== "ready" || !input.hasCarta) return { mode: "cargando", disabled: true };
  if (input.revealed) return { mode: "revelada", disabled: true };
  return { mode: "cerrada", disabled: false };
}
