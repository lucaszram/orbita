import { anyStale, civilDateInTimezone, hasData, latestObservedAt } from "@/domain/layers";
import type { AnalysisEnvelope } from "@/services/layersApi";

/**
 * Qué tan de ahora es lo que estás leyendo — y cuánto ruido merece decirlo.
 *
 * El defecto que cierra: cualquier recálculo que no salía bien pintaba el mismo
 * cartel grande con borde de cobre, `NO PUDIMOS ACTUALIZAR ESTOS DATOS`, arriba
 * de todo. Pero "no pudimos rehacer el cálculo de hace veinte minutos" y "lo
 * único que hay es de anteayer" no son lo mismo, y "todavía no hay ningún
 * cálculo" es otra cosa distinta: los tres se anunciaban igual, así que el caso
 * más leve —el más frecuente— se leía como una falla del producto.
 *
 * Acá se separan en cuatro estados, y cada uno tiene el peso visual que le
 * corresponde:
 *
 * | estado         | qué pasó                                        | cómo se dice        |
 * |----------------|-------------------------------------------------|---------------------|
 * | `fresh`        | el cálculo visible es el de ahora               | no se dice nada     |
 * | `cachedToday`  | no se pudo rehacer, pero el dato es **de hoy**  | una línea discreta  |
 * | `stale`        | el último cálculo es de un **día anterior**     | aviso compacto      |
 * | `unavailable`  | no hay ningún cálculo que leer                  | bloque de error     |
 *
 * El estado normal no se anuncia: eso es lo que hace que el aviso signifique
 * algo cuando aparece.
 *
 * Es un módulo puro: entra el estado del sobre y sale una etiqueta. No hay reloj
 * adentro —el instante y el día civil los pasa quien llama— así que se prueba
 * entero sin simulador y sin viajar en el tiempo.
 */

export type LayerFreshness = "fresh" | "cachedToday" | "stale" | "unavailable";

export type FreshnessInput = {
  /** ¿Hay algo calculado para leer? Sin esto, no hay frescura que juzgar. */
  hasData: boolean;
  /**
   * Cuándo se calculó el último dato VISIBLE. `null` cuando no se puede fechar:
   * entonces no se afirma que sea de hoy, porque no se sabe.
   */
  observedAt: number | null;
  /** El backend marcó alguna capa `stale`: su cálculo no se pudo rehacer. */
  markedStale: boolean;
  /** El recálculo de ESTA sesión falló. */
  refreshFailed: boolean;
  /** Día civil (`YYYY-MM-DD`) con el que se pidió el sobre. */
  localDate: string;
  /** Zona IANA con la que se pidió el sobre. */
  timezone: string;
};

/**
 * En qué estado de frescura está lo que se ve.
 *
 * El orden de las preguntas es el orden de la honestidad:
 *
 * 1. **¿Hay dato?** Sin dato no hay nada que fechar y el bloque grande es el
 *    único honesto: la pantalla no puede mostrar contenido.
 * 2. **¿Se pudo rehacer el cálculo?** Si sí, es de ahora y no se anuncia. Un
 *    sobre puede venir `stale` desde el backend sin que el recálculo de esta
 *    sesión haya fallado, así que se preguntan las dos cosas.
 * 3. **¿De cuándo es lo que quedó?** Si el último cálculo cae en el MISMO día
 *    civil que se está mirando, el dato sigue siendo de hoy y alcanza una línea.
 *    Si es de un día anterior —o no se puede fechar— hace falta el aviso.
 */
export function layerFreshness(input: FreshnessInput): LayerFreshness {
  if (!input.hasData) return "unavailable";
  if (!input.refreshFailed && !input.markedStale) return "fresh";
  return calculadoHoy(input) ? "cachedToday" : "stale";
}

/**
 * ¿El último cálculo cae en el día civil que se está mirando?
 *
 * Sin instante, sin día o sin zona la respuesta es NO: lo que no se puede fechar
 * no se puede afirmar como de hoy, y en la duda el aviso es el compacto y no la
 * línea discreta.
 */
function calculadoHoy(input: FreshnessInput): boolean {
  if (input.observedAt === null || !Number.isFinite(input.observedAt) || input.observedAt <= 0) {
    return false;
  }
  if (!input.localDate || !input.timezone) return false;
  return civilDateInTimezone(input.observedAt, input.timezone) === input.localDate;
}

/**
 * La misma decisión, tomada sobre los sobres de una pantalla.
 *
 * Existe para que ninguna pantalla vuelva a armar la condición a mano: antes
 * cada una escribía su propio `refreshFailed || anyStale(sobres)` y ninguna
 * miraba de cuándo era el dato, que es justo lo que decide cuánto ruido merece
 * el aviso.
 */
export function envelopesFreshness(input: {
  envelopes: readonly AnalysisEnvelope[];
  refreshFailed: boolean;
  localDate: string;
  timezone: string;
}): LayerFreshness {
  return layerFreshness({
    hasData: input.envelopes.some(hasData),
    observedAt: latestObservedAt(input.envelopes),
    markedStale: anyStale(input.envelopes),
    refreshFailed: input.refreshFailed,
    localDate: input.localDate,
    timezone: input.timezone
  });
}

/** Cuánto pesa el aviso en pantalla. Lo elige el estado, no la pantalla. */
export type FreshnessWeight = "none" | "line" | "compact" | "block";

export const FRESHNESS_WEIGHT: Record<LayerFreshness, FreshnessWeight> = {
  fresh: "none",
  cachedToday: "line",
  stale: "compact",
  unavailable: "block"
};

/** Lo que hay que decir, ya escrito. `null` cuando no hay nada que decir. */
export type FreshnessNotice = {
  weight: FreshnessWeight;
  /**
   * El rótulo en versalita del aviso. `null` en la línea discreta: una línea
   * gris con la hora del cálculo no necesita un título encima.
   */
  label: string | null;
  /** La frase, con la fecha del último cálculo cuando se la puede afirmar. */
  body: string;
  /** El texto del reintento, que en los tres casos visibles existe. */
  retryLabel: string;
  /**
   * Se OFRECE el reintento ahora mismo.
   *
   * `false` sólo mientras el reintento automático corre sobre un dato de hoy: la
   * línea ya dice «intentando actualizar», y un control al lado sería la segunda
   * versión del mismo estado —la persona no tiene nada que decidir hasta que ese
   * intento termine—.
   */
  retryable: boolean;
  /**
   * Se anuncia como alerta (`accessibilityRole="alert"`).
   *
   * Sólo los dos casos que cambian lo que la persona puede concluir de lo que
   * está leyendo. La línea discreta NO interrumpe: es un dato de contexto, y
   * robar el foco del lector para decir "esto se calculó a las 14:05" convierte
   * el caso más leve en el más ruidoso.
   */
  alert: boolean;
};

/**
 * El aviso que corresponde, con la fecha del último cálculo ya escrita.
 *
 * `formatted` es la fecha —u hora— del último dato visible, tal como la escribe
 * la pantalla; entra como texto porque el formato depende de la zona y del
 * idioma, y este módulo no formatea nada. `null` cuando no hay cómo fecharlo: el
 * aviso se da igual, sin inventar una hora.
 *
 * `retrying` dice si el reintento automático está corriendo AHORA. Sólo cambia
 * el caso `cachedToday`, y ahí es lo que evita el estado indefinido: mientras la
 * política reintenta, la línea dice `Actualizado 14:05 · intentando actualizar`
 * y no ofrece control; cuando los tres intentos se agotan pasa a `Actualizado
 * 14:05 · no se pudo actualizar` y recién entonces aparece el reintento. Nunca
 * una tarjeta grande: el dato de hoy sigue siendo legible y el bloque queda
 * reservado para cuando no hay nada que leer.
 *
 * El texto sirve para CUALQUIER capa y por eso no nombra el cielo ni "este
 * momento": el mismo aviso encabeza el tipo lunar y el mapa elemental, que son
 * natales y no cambian con el día pero se vuelven a pedir en el mismo sobre.
 */
export function freshnessNotice(
  freshness: LayerFreshness,
  formatted: string | null,
  options: { retrying?: boolean } = {}
): FreshnessNotice | null {
  const retrying = options.retrying ?? false;
  switch (freshness) {
    case "fresh":
      return null;
    case "cachedToday": {
      // Dos estados y ninguno más: se está intentando, o se intentó y no salió.
      // El texto es el mismo salvo el final, así que la línea se lee igual antes
      // y después y lo único que cambia es en cuál de los dos está.
      const actualizado = formatted ? `Actualizado ${formatted}` : "Actualizado hoy";
      return {
        weight: "line",
        label: null,
        body: retrying
          ? `${actualizado} · intentando actualizar`
          : `${actualizado} · no se pudo actualizar`,
        retryLabel: "REINTENTAR",
        retryable: !retrying,
        alert: false
      };
    }
    case "stale":
      return {
        weight: "compact",
        label: "SIN DATOS DE HOY",
        body: formatted
          ? `Estás viendo el último cálculo verificado, del ${formatted}. Todavía no pudimos rehacerlo.`
          : "Estás viendo el último cálculo verificado, de un día anterior. Todavía no pudimos rehacerlo.",
        retryLabel: "REINTENTAR",
        retryable: true,
        alert: true
      };
    case "unavailable":
    default:
      return {
        weight: "block",
        label: "NO PUDIMOS CALCULAR ESTOS DATOS",
        body: "Todavía no hay un cálculo guardado para mostrar. Tus datos siguen guardados: probá de nuevo en un momento.",
        retryLabel: "REINTENTAR",
        retryable: true,
        alert: true
      };
  }
}
