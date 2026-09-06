import {
  civilDateInTimezone,
  formatLocalTime,
  TRANSIT_STATE_CHIP,
  TRANSIT_STATE_LABEL
} from "@/domain/layers";
import type { TransitState } from "@/services/layersApi";

/**
 * La etapa de un tránsito, derivada UNA sola vez para todas las superficies.
 *
 * ## El defecto que cierra (QA22-009)
 *
 * El mismo Luna–Marte salía `ACERCÁNDOSE · EXACTO HOY` con orbe 0°07′ en la
 * lista y `EXACTO` —“en su punto más exacto”— en su detalle. No era un error de
 * dibujo: los dos sobres publican `state`, y cada uno lo calcula con una regla
 * distinta.
 *
 * - **`ORB-TRN-002`** (la lista) publica el estado del CONTACTO, y lo decide por
 *   ORBE: `stageFromTrend` en `convex/lib/transitLayers.ts` llama `exact` a un
 *   orbe ≤ `EXACT_TRANSIT_ORB_DEGREES` (0,1°); si no, mira la tendencia.
 * - **`ORB-TRN-001`** (el detalle) publica el estado del ARCO, y lo decide por
 *   TIEMPO: `arcStage` llama `exact` a cualquier contacto que caiga a menos de
 *   `ARC_EXACT_WINDOW_MS` (±6 h) del instante de referencia.
 *
 * Con 0°07′ (0,117°) y el pico más tarde ese mismo día, la primera regla dice
 * "se acerca" y la segunda dice "exacto". Las dos son correctas para su propia
 * definición y contradictorias para la persona, que ve un tránsito y dos
 * respuestas.
 *
 * ## Por qué la derivación canónica vive acá y no en el backend
 *
 * Unificar `stageFromTrend` con `arcStage` arreglaría los cálculos NUEVOS. Lo
 * que las pantallas leen son sobres **persistidos**: los que ya están guardados
 * seguirían contradiciéndose hasta recalcularse, y recalcularlos exige un deploy
 * de Convex que esta tanda no hace. Acá, en cambio, la proyección se aplica al
 * leer, así que vale para un sobre de hoy y para uno guardado la semana pasada.
 * El campo crudo NO se toca: se sigue publicando tal cual y esta capa lo usa
 * como respaldo cuando no hay instantes con los que derivar nada.
 *
 * ## La regla, en una línea
 *
 * El estado sale del **contacto exacto más cercano a ahora** —el único dato que
 * los dos sobres publican con la misma precisión— comparado con el instante
 * actual y con el día civil de la persona:
 *
 * | Cuándo | Estado | Chip |
 * |---|---|---|
 * | el contacto todavía no llegó | `approaching` | `ACERCÁNDOSE` |
 * | corre el MISMO minuto civil del contacto | `exact` | `EXACTO AHORA` |
 * | ese minuto ya pasó | `integrating` | `INTEGRÁNDOSE` |
 *
 * **`EXACTO AHORA` dura un minuto, no un día.** La primera versión de esta capa
 * dejaba `exact` hasta la medianoche —"ya pasó y sigue siendo hoy"—, y eso decía
 * a las 23:40 que un contacto de las 06:00 está ocurriendo *ahora*: la misma
 * mentira que QA22-009 vino a sacar, con otra ventana. `ahora` es el minuto
 * civil del contacto y nada más; a partir del minuto siguiente el arco se está
 * integrando, aunque el ranking siga poniendo `EXACTO HOY` al lado como
 * contexto —es cierto: el contacto es de hoy— y aunque la etapa lo repita con la
 * hora (`Ya pasó el punto exacto, hoy a las 16:00`), que es lo que vuelve
 * legible ese `HOY` en vez de contradecirlo.
 *
 * Es exactamente lo que QA22-009 pide: `ACERCÁNDOSE` **hasta ese instante** —con
 * `EXACTO HOY` al lado, que es el motivo publicado por el ranking— y
 * `EXACTO AHORA` en todas las superficies mientras dura. Sin ventanas inventadas
 * y sin un umbral de orbe nuevo: sólo marcas de tiempo que ya vienen en el sobre,
 * comparadas al minuto en la zona de la persona.
 *
 * Todo entra por parámetro, incluido el "ahora": el módulo es puro y no tiene
 * reloj propio.
 */

export type CanonicalTransitState = {
  /** La etapa canónica, la misma en la lista y en el detalle. */
  state: TransitState;
  /** El chip corto del canon: `ACERCÁNDOSE` · `EXACTO AHORA` · `INTEGRÁNDOSE`. */
  chip: string;
  /** La frase completa: es lo que dice VoiceOver, no el chip. */
  label: string;
  /** El contacto exacto más cercano a ahora. `null` si el sobre no publica ninguno. */
  peakAt: number | null;
  /**
   * Ese contacto cae en el día civil de hoy.
   *
   * Es el dato del RANKING (`EXACTO HOY`), no la etapa: sigue en `true` todo el
   * día, incluso cuando el minuto exacto ya pasó y el estado es `integrating`.
   */
  peakToday: boolean;
  /** El sobre publicaba otra etapa y la proyección la corrigió. */
  corrected: boolean;
};

/**
 * El chip del canon: el del sistema, con UNA palabra cambiada.
 *
 * `EXACTO` a secas no distinguía "es exacto ahora" de "es exacto hoy más tarde",
 * y era justo la ambigüedad que QA22-009 registró. `EXACTO AHORA` sólo aparece
 * cuando el contacto ya llegó; antes de eso el chip dice `ACERCÁNDOSE` y el
 * motivo del ranking pone `EXACTO HOY` al lado, que es la forma que el hallazgo
 * pide. Los otros dos rótulos son los mismos, y se derivan para que no haya dos
 * tablas de vocabulario que puedan separarse.
 */
export const CANONICAL_STATE_CHIP: Record<TransitState, string> = {
  ...TRANSIT_STATE_CHIP,
  exact: "EXACTO AHORA"
};

/**
 * La etapa canónica de un arco en un instante.
 *
 * `contacts` son todos los instantes exactos que el sobre publica —el pico, las
 * pasadas verificadas, `previousExactAt` y `nextExactAt`—: el que mande es el
 * más cercano a ahora, porque es el que la persona está mirando. Los valores que
 * no son fechas se descartan antes de comparar.
 */
export function canonicalTransitState(input: {
  /** La etapa tal como la publicó el sobre. Es el respaldo, no la fuente. */
  published: TransitState;
  contacts: readonly (number | null | undefined)[];
  nowMs: number;
  timezone: string;
}): CanonicalTransitState {
  const peakAt = nearestContact(input.contacts, input.nowMs);
  const peakToday =
    peakAt !== null &&
    civilDateInTimezone(peakAt, input.timezone) === civilDateInTimezone(input.nowMs, input.timezone);
  // El orden importa: primero el MINUTO (¿está ocurriendo?), y sólo si no, el
  // instante (¿falta o ya fue?). Al revés, un contacto a las 16:00:45 leído a las
  // 16:00:10 saldría `approaching` mientras el reloj ya marca su minuto.
  const state: TransitState =
    peakAt === null
      ? input.published
      : sameCivilMinute(input.nowMs, peakAt, input.timezone)
        ? "exact"
        : input.nowMs < peakAt
          ? "approaching"
          : "integrating";
  const hora = peakAt !== null && peakToday ? formatLocalTime(peakAt, input.timezone) : null;
  return {
    state,
    chip: CANONICAL_STATE_CHIP[state],
    label: stateLabel(state, hora),
    peakAt,
    peakToday,
    corrected: state !== input.published
  };
}

/**
 * ¿Los dos instantes caen en el MISMO minuto civil de la zona?
 *
 * Es la única comparación que produce `exact`, y por eso se hace con la fecha y
 * la hora que la persona ve en su reloj —no con una tolerancia en milisegundos,
 * que volvería a ser una ventana inventada—. El minuto es la precisión con la que
 * el producto imprime un contacto (`EXACTO 16:00`), así que es también la
 * precisión con la que puede afirmar que está ocurriendo.
 *
 * Si la zona no resuelve, `Intl` no da partes y las dos claves salen `null`: ahí
 * degrada al minuto del epoch, que es el mismo borde, porque toda zona IANA
 * vigente tiene un desfase de minutos enteros.
 */
function sameCivilMinute(a: number, b: number, timezone: string): boolean {
  const uno = civilMinuteInTimezone(a, timezone);
  const otro = civilMinuteInTimezone(b, timezone);
  if (uno === null || otro === null) return Math.floor(a / 60_000) === Math.floor(b / 60_000);
  return uno === otro;
}

/** `2026-08-20T16:00` en la zona pedida; `null` si la zona no resuelve. */
function civilMinuteInTimezone(ms: number, timezone: string): string | null {
  const date = civilDateInTimezone(ms, timezone);
  const time = formatLocalTime(ms, timezone);
  return date && time ? `${date}T${time}` : null;
}

/**
 * El contacto exacto más cercano a `nowMs`. Empata a favor del más temprano, así
 * que la derivación es determinística.
 */
function nearestContact(
  contacts: readonly (number | null | undefined)[],
  nowMs: number
): number | null {
  let mejor: number | null = null;
  for (const value of contacts) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    if (mejor === null) {
      mejor = value;
      continue;
    }
    const distancia = Math.abs(value - nowMs);
    const actual = Math.abs(mejor - nowMs);
    if (distancia < actual || (distancia === actual && value < mejor)) mejor = value;
  }
  return mejor;
}

/**
 * La frase de la etapa. Cuando el contacto es HOY, la hora va adentro: es la
 * diferencia entre "se acerca" y "se acerca, y es hoy a las 14:20", que es justo
 * el dato que QA22-009 y QA22-010 echan en falta.
 *
 * Vale para los dos lados del pico. Después del minuto exacto el chip dice
 * `INTEGRÁNDOSE` mientras el ranking sigue diciendo `EXACTO HOY`; sin la hora,
 * las dos frases se leen como una contradicción. Con ella —"Ya pasó el punto
 * exacto, hoy a las 16:00"— dicen lo mismo.
 */
function stateLabel(state: TransitState, horaDeHoy: string | null): string {
  if (state === "exact") return "Está en su punto más exacto ahora";
  if (!horaDeHoy) return TRANSIT_STATE_LABEL[state];
  return `${TRANSIT_STATE_LABEL[state]}, hoy a las ${horaDeHoy}`;
}

// ---------------------------------------------------------------------------
// El resumen del sobre, alineado con la etapa canónica
// ---------------------------------------------------------------------------

/**
 * Las frases de etapa que el backend pega al final de cada resumen.
 *
 * **Esto es un contrato de copy, y por eso está escrito.** `ORB-TRN-001` y
 * `ORB-TRN-002` componen su `summary` como `<contacto> + <frase de la etapa>`
 * (`adaptTransitArcToData` y `transitStageSummary`, en
 * `convex/lib/layerAssembly.ts`). Si la etapa canónica corrige a la publicada y
 * el resumen se dibujara igual, la pantalla diría `ACERCÁNDOSE` arriba y "Ahora
 * está en su momento más preciso" tres líneas abajo: el defecto de QA22-009
 * mudado de lugar.
 *
 * Se reconoce el cierre por texto EXACTO y sólo para reemplazarlo por el de la
 * misma familia. Una frase que no esté en la tabla —un sobre viejo, un cambio de
 * copy del backend— deja el resumen intacto: nunca se recorta a ciegas.
 */
const SUMMARY_STATE_CLAUSES: readonly Record<TransitState, string>[] = [
  {
    // `ORB-TRN-001` — el detalle del arco.
    approaching:
      "Todavía se acerca al punto más preciso; la línea de tiempo ubica el proceso, pero no predice un hecho concreto.",
    exact:
      "Ahora está en su momento más preciso. Esto señala un tema para observar, no un hecho que tenga que ocurrir.",
    integrating:
      "El punto más preciso ya pasó, pero el tránsito sigue activo dentro del margen de 3° hasta la fecha de cierre."
  },
  {
    // `ORB-TRN-002` — la fila del ranking.
    approaching: "Todavía se está acercando al punto más preciso.",
    exact: "Está en su momento de mayor exactitud.",
    integrating:
      "El punto más preciso ya pasó, pero el contacto sigue activo dentro del margen de 3° que usa Órbita."
  }
];

const ESTADOS: readonly TransitState[] = ["approaching", "exact", "integrating"];

/**
 * El resumen del sobre con su frase de etapa puesta al día.
 *
 * Devuelve el mismo texto cuando ya coincide con la etapa canónica o cuando el
 * cierre no se reconoce. No reescribe la parte factual —qué planeta, qué punto,
 * qué ángulo—: eso lo calculó el backend y sigue siendo suyo.
 */
export function summaryWithCanonicalState(summary: string, canonical: TransitState): string {
  if (typeof summary !== "string" || summary.length === 0) return summary;
  for (const familia of SUMMARY_STATE_CLAUSES) {
    for (const estado of ESTADOS) {
      if (estado === canonical) continue;
      const frase = familia[estado];
      if (!summary.endsWith(frase)) continue;
      return `${summary.slice(0, summary.length - frase.length)}${familia[canonical]}`;
    }
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Si un contacto exacto ya es hoy, no se anuncia como "próximo"
// ---------------------------------------------------------------------------

/**
 * ¿Se dice esta fecha como un contacto aparte? (QA22-009)
 *
 * El detalle imprimía `Próximo contacto exacto: 20 de agosto` en una pantalla
 * que en la misma vista ya trata ese contacto como el de hoy. Un contacto que
 * cae en el día civil de hoy ya está dicho —por la etapa, por el motivo del
 * ranking y por la marca `EXACTO` de la línea de tiempo—, así que la línea de
 * "anterior / próximo" existe para los OTROS contactos y no para repetir éste.
 */
export function contactWorthNaming(
  atMs: number | null,
  nowMs: number,
  timezone: string
): atMs is number {
  if (atMs === null || !Number.isFinite(atMs) || atMs <= 0) return false;
  return civilDateInTimezone(atMs, timezone) !== civilDateInTimezone(nowMs, timezone);
}
