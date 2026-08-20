import { civilDateInTimezone, formatDayMonth, formatShortDayMonth, type InstantRange } from "@/domain/layers";

/**
 * El modelo del **detalle del tránsito**: qué momentos tiene la ventana y cómo
 * se leen los campos del sobre sin dar por seguro que un cache viejo los traiga.
 *
 * Son dos cosas separadas y las dos son puras:
 *
 * 1. **`transitTimeline`** — la línea de tiempo como DATOS: una marca por
 *    momento, con su posición, su rótulo y su fecha. La pantalla dibuja lo que
 *    este modelo dice; no decide nada por su cuenta. Así se puede probar la
 *    coincidencia de `HOY` con un contacto exacto, el año que aparece cuando la
 *    ventana cruza diciembre y el único anuncio de VoiceOver, sin montar un
 *    componente.
 * 2. **`transitDetailExtras`** — los cinco campos que `ORB-TRN-001` publica
 *    además de la ventana (`previousExactAt`, `nextExactAt`, `rankingWindow`,
 *    `rankingReason`, `natalHouse`), leídos como OPCIONALES aunque el contrato
 *    los declare obligatorios.
 *
 * ## Por qué se siguen leyendo como opcionales
 *
 * El contrato describe lo que el backend calcula HOY; la pantalla lee sobres
 * PERSISTIDOS, y un sobre guardado antes del cambio sigue siendo perfectamente
 * válido para mostrar —tiene su ventana, sus pasadas y su trazabilidad— pero no
 * trae estos cinco campos. Exigirlos convertiría un cache viejo en una pantalla
 * rota o, peor, en una fecha `undefined` dicha como si fuera un dato. Cada campo
 * se valida antes de aceptarse y, cuando no está, el bloque que dependía de él
 * simplemente no se dibuja.
 *
 * ## La regla que no se rompe: un solo sobre
 *
 * Todo sale del sobre del ARCO. El ranking del día (`ORB-TRN-002`) es otro
 * análisis, con otro método, otra precisión y otras fechas: publica sus propios
 * `natalHouse`, `rankingReason` y `reasons`, y tomarlos prestados haría que el
 * detalle afirmara —con la trazabilidad del arco— cosas que el arco nunca
 * calculó. Por eso `transitDetailExtras` recibe el `data` del arco y nada más.
 */

// ---------------------------------------------------------------------------
// Campos opcionales del sobre del arco
// ---------------------------------------------------------------------------

/** Por qué este tránsito encabeza la lista, dicho por el propio cálculo. */
export type TransitRankingReason = {
  /** El rótulo del criterio (`Cercanía`), si el sobre lo trae. */
  label: string | null;
  /** La explicación en una frase. Es lo único obligatorio. */
  explanation: string;
};

/**
 * Lo que el sobre del arco publica además de su ventana. Todo `null` cuando el
 * sobre guardado no lo trae: no se estima, no se deriva de otro análisis y no se
 * dibuja un bloque vacío.
 */
export type TransitDetailExtras = {
  /** El contacto exacto ANTERIOR a hoy, cuando el cálculo lo verificó. */
  previousExactAt: number | null;
  /** El próximo contacto exacto. */
  nextExactAt: number | null;
  /** La ventana con la que el ranking consideró activo el contacto. */
  rankingWindow: InstantRange | null;
  /** Por qué el ranking lo puso donde lo puso. */
  rankingReason: TransitRankingReason | null;
  /** La casa de tu carta que el contacto activa (1–12). */
  natalHouse: number | null;
};

const SIN_EXTRAS: TransitDetailExtras = {
  previousExactAt: null,
  nextExactAt: null,
  rankingWindow: null,
  rankingReason: null,
  natalHouse: null
};

/** Un instante real: finito y positivo. Un 0 no es una fecha, es un campo vacío. */
function instant(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** Una casa real (1–12) o `null`. Nunca una casa inventada ni un índice suelto. */
function house(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= 1 && value <= 12 ? value : null;
}

/** Un texto con contenido, ya recortado. `null` si viene vacío o no es texto. */
function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const limpio = value.trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * Una ventana, en cualquiera de las dos formas que el contrato ya usa:
 * `{ earliest, latest }` (los rangos publicados) o `{ startsAt, endsAt }` (las
 * ventanas del ranking). Una forma que no sea ninguna de las dos se IGNORA: es
 * mejor no dibujar la ventana que adivinar cuál de sus números es el borde.
 */
function window(value: unknown): InstantRange | null {
  if (!value || typeof value !== "object") return null;
  const bruto = value as Record<string, unknown>;
  const earliest = instant(bruto.earliest) ?? instant(bruto.startsAt);
  const latest = instant(bruto.latest) ?? instant(bruto.endsAt);
  if (earliest === null || latest === null || latest < earliest) return null;
  return { earliest, latest };
}

/**
 * El criterio de orden, si el sobre lo publica. Acepta la frase suelta y también
 * la forma `{ label, explanation }` con la que el ranking ya describe sus
 * razones, porque es la que el contrato tiene a mano.
 */
function reason(value: unknown): TransitRankingReason | null {
  const frase = text(value);
  if (frase) return { label: null, explanation: frase };
  if (!value || typeof value !== "object") return null;
  const bruto = value as Record<string, unknown>;
  const explanation = text(bruto.explanation) ?? text(bruto.detail);
  if (!explanation) return null;
  return { label: text(bruto.label), explanation };
}

/**
 * Los cinco campos del sobre del arco, leídos sin exigirlos.
 *
 * Se lee ESTRUCTURALMENTE y no por el tipo, a propósito: el tipo generado
 * describe lo que el backend calcula ahora, y lo que la pantalla recibe puede
 * ser un sobre persistido antes del cambio de contrato. Leerlo por el tipo haría
 * que TypeScript diera por seguro un campo que en runtime no está, que es
 * exactamente cómo una fecha se convierte en `undefined` dicho en voz alta. Cada
 * campo se valida antes de aceptarse: un instante tiene que ser finito, una casa
 * tiene que estar entre 1 y 12 y un texto tiene que tener contenido.
 *
 * `previousExactAt` y `nextExactAt` se descartan si están al revés: dos fechas
 * incoherentes no describen ningún contacto, y mostrarlas sería peor que no
 * mostrar nada.
 */
export function transitDetailExtras(data: unknown): TransitDetailExtras {
  if (!data || typeof data !== "object") return SIN_EXTRAS;
  const bruto = data as Record<string, unknown>;
  const previousExactAt = instant(bruto.previousExactAt);
  const nextExactAt = instant(bruto.nextExactAt);
  const coherentes =
    previousExactAt === null || nextExactAt === null || previousExactAt < nextExactAt;
  return {
    previousExactAt: coherentes ? previousExactAt : null,
    nextExactAt: coherentes ? nextExactAt : null,
    rankingWindow: window(bruto.rankingWindow),
    rankingReason: reason(bruto.rankingReason),
    natalHouse: house(bruto.natalHouse)
  };
}

// ---------------------------------------------------------------------------
// La línea de tiempo, como datos
// ---------------------------------------------------------------------------

/**
 * Qué es cada marca de la línea.
 *
 * El tipo decide el color y la forma, y el criterio es de jerarquía: los bordes
 * de la ventana son contexto (gris, hueco), los contactos exactos son el dato
 * (hueso) y HOY es dónde estás parado (cobre). Cuando hoy ES el contacto, la
 * marca es una sola y gana el cobre: primero importa dónde estás.
 */
export type TimelineMarkKind = "start" | "end" | "contact" | "today";

export type TimelineMark = {
  kind: TimelineMarkKind;
  atMs: number;
  /** Posición sobre la ventana, 0–1. */
  ratio: number;
  /** `INICIO` · `CIERRE` · `EXACTO` · `HOY` · `HOY · EXACTO`. */
  label: string;
  /** `12 SEP`, y con año (`12 SEP 2027`) cuando la ventana cruza el año. */
  dateLabel: string;
  /** Hoy cae en el mismo día civil que un contacto exacto. */
  isTodayContact: boolean;
};

export type TransitTimeline = {
  /** Las marcas, ordenadas por posición. */
  marks: readonly TimelineMark[];
  /** La ventana cruza un cambio de año, así que las fechas llevan el año. */
  crossesYear: boolean;
  /** Hoy cae dentro de la ventana. */
  todayInside: boolean;
  /** Hoy es el día de un contacto exacto. */
  todayIsContact: boolean;
  /** Las fechas son bordes calculados, no contactos verificados. */
  estimated: boolean;
  /** El ÚNICO anuncio de VoiceOver de toda la línea. */
  voice: string;
};

export const TIMELINE_LABEL = {
  start: "INICIO",
  end: "CIERRE",
  contact: "EXACTO",
  today: "HOY",
  /** Hoy y el contacto exacto caen el mismo día: una marca, un rótulo. */
  todayContact: "HOY · EXACTO"
} as const;

/**
 * La ventana de un tránsito, resuelta en marcas.
 *
 * Qué resuelve, y por qué cada cosa:
 *
 * - **Los contactos exactos son marcas propias.** Un tránsito retrógrado pasa
 *   dos o tres veces por el mismo punto: dibujar sólo el "pico" borraba los
 *   otros contactos, que son parte del mismo proceso.
 * - **HOY se dibuja.** Sin esa marca la línea era una ventana abstracta y no
 *   había forma de ver, de un vistazo, si el contacto ya pasó o todavía falta.
 *   Sólo se dibuja si hoy cae DENTRO de la ventana: fuera de ella no hay dónde
 *   ponerla sin mentir.
 * - **Coincidencia.** Si hoy es el día de un contacto exacto, las dos marcas se
 *   fusionan en una sola (`HOY · EXACTO`). Dos puntos superpuestos en el mismo
 *   milímetro se leían como un error de dibujo.
 * - **El año aparece cuando hace falta.** `12 SEP` y `3 ENE` en la misma línea
 *   no dicen que hay catorce meses entre los dos. Si los bordes caen en años
 *   distintos, TODAS las fechas llevan el año: media línea con año y media sin
 *   es peor que ninguna.
 * - **Un solo anuncio.** La línea entera es una imagen con una etiqueta; los
 *   rótulos de abajo quedan ocultos para el lector, así que VoiceOver dice la
 *   ventana una vez en vez de leer seis fragmentos sueltos.
 *
 * Todo entra por parámetro —incluido el instante de "ahora"— así que no hay
 * reloj adentro y el modelo es determinístico.
 */
export function transitTimeline(input: {
  startsAt: number;
  peakAt: number;
  endsAt: number;
  /** Los contactos exactos verificados. Sin ellos, el pico es el único contacto. */
  contacts?: readonly number[];
  nowMs: number;
  timezone: string;
  /** La cronología es una ventana calculada y no contactos confirmados. */
  estimated?: boolean;
}): TransitTimeline {
  const { startsAt, endsAt, timezone } = input;
  const estimated = input.estimated ?? false;
  const span = endsAt - startsAt;
  const ratio = (at: number) => {
    if (!(span > 0)) return 0.5;
    return Math.max(0, Math.min(1, (at - startsAt) / span));
  };

  // Los contactos: los verificados que caen dentro de la ventana y, si no hay
  // ninguno, el pico. Se ordenan y se dejan como máximo uno por día civil: dos
  // puntos en la misma fecha son el mismo momento dibujado dos veces.
  const declarados = (input.contacts ?? []).filter(
    (at) => Number.isFinite(at) && at >= startsAt && at <= endsAt
  );
  const base = declarados.length > 0 ? declarados : [input.peakAt];
  const contactos: number[] = [];
  const diasVistos = new Set<string>();
  for (const at of [...base].sort((a, b) => a - b)) {
    const dia = civilDateInTimezone(at, timezone);
    if (diasVistos.has(dia)) continue;
    diasVistos.add(dia);
    contactos.push(at);
  }

  const hoy = civilDateInTimezone(input.nowMs, timezone);
  const diaInicio = civilDateInTimezone(startsAt, timezone);
  const diaCierre = civilDateInTimezone(endsAt, timezone);
  // Las fechas civiles `YYYY-MM-DD` se comparan como texto sin ambigüedad, y así
  // "hoy adentro" incluye los dos días borde enteros.
  const todayInside = hoy >= diaInicio && hoy <= diaCierre;
  const contactoDeHoy = contactos.find((at) => civilDateInTimezone(at, timezone) === hoy) ?? null;
  const todayIsContact = todayInside && contactoDeHoy !== null;

  // El año se dice cuando la ventana lo cruza. Se miran los dos bordes y también
  // los contactos: un contacto de enero dentro de una ventana de diciembre a
  // febrero es exactamente el caso que se lee mal.
  const anios = new Set(
    [startsAt, endsAt, ...contactos].map((at) => civilDateInTimezone(at, timezone).slice(0, 4))
  );
  const crossesYear = anios.size > 1;
  const fecha = (at: number) =>
    crossesYear
      ? `${formatShortDayMonth(at, timezone)} ${civilDateInTimezone(at, timezone).slice(0, 4)}`
      : formatShortDayMonth(at, timezone);

  const marks: TimelineMark[] = [
    {
      kind: "start",
      atMs: startsAt,
      ratio: 0,
      label: TIMELINE_LABEL.start,
      dateLabel: fecha(startsAt),
      isTodayContact: false
    }
  ];

  for (const at of contactos) {
    const esHoy = todayIsContact && at === contactoDeHoy;
    marks.push({
      // Fusión: cuando hoy es el contacto, la marca es UNA y su tipo es `today`
      // —el cobre gana— con el rótulo que dice las dos cosas.
      kind: esHoy ? "today" : "contact",
      atMs: at,
      ratio: ratio(at),
      label: esHoy ? TIMELINE_LABEL.todayContact : TIMELINE_LABEL.contact,
      dateLabel: fecha(at),
      isTodayContact: esHoy
    });
  }

  if (todayInside && !todayIsContact) {
    marks.push({
      kind: "today",
      atMs: input.nowMs,
      ratio: ratio(input.nowMs),
      label: TIMELINE_LABEL.today,
      dateLabel: fecha(input.nowMs),
      isTodayContact: false
    });
  }

  marks.push({
    kind: "end",
    atMs: endsAt,
    ratio: 1,
    label: TIMELINE_LABEL.end,
    dateLabel: fecha(endsAt),
    isTodayContact: false
  });

  marks.sort((a, b) => a.ratio - b.ratio || ORDEN[a.kind] - ORDEN[b.kind]);

  return {
    marks,
    crossesYear,
    todayInside,
    todayIsContact,
    estimated,
    voice: anuncio({ marks, estimated, timezone, crossesYear })
  };
}

/** Con la misma posición, el borde va primero y HOY después: es lo que se lee. */
const ORDEN: Record<TimelineMarkKind, number> = { start: 0, contact: 1, today: 2, end: 3 };

/**
 * El único anuncio de la línea, en una frase.
 *
 * Antes cada rótulo era un elemento accesible propio, así que VoiceOver leía
 * `INICIO`, `12 SEP`, `PICO`, `20 SEP`… sin decir de qué eran. Acá la línea se
 * dice entera, en orden y con los verbos que corresponden.
 */
function anuncio(input: {
  marks: readonly TimelineMark[];
  estimated: boolean;
  timezone: string;
  crossesYear: boolean;
}): string {
  const fecha = (mark: TimelineMark) =>
    input.crossesYear
      ? `${formatDayMonth(mark.atMs, input.timezone)} de ${civilDateInTimezone(
          mark.atMs,
          input.timezone
        ).slice(0, 4)}`
      : formatDayMonth(mark.atMs, input.timezone);
  const partes = input.marks.map((mark) => {
    if (mark.kind === "start") return `empieza el ${fecha(mark)}`;
    if (mark.kind === "end") return `cierra el ${fecha(mark)}`;
    if (mark.isTodayContact) return `hoy, ${fecha(mark)}, es el contacto exacto`;
    if (mark.kind === "today") return `hoy es el ${fecha(mark)}`;
    return `contacto exacto el ${fecha(mark)}`;
  });
  const cabeza = input.estimated
    ? "Duración y momentos clave, con fechas estimadas"
    : "Duración y momentos clave";
  return `${cabeza}: ${partes.join("; ")}.`;
}
