import { observedDateInTimezone } from "@/domain/dailyContext";
import type {
  AnalysisEnvelope,
  AnalysisId,
  AnalysisPrecision,
  AnalysisStatus,
  CumplelunaData,
  ElementKey,
  LunarPhaseKey,
  SourceRef,
  TransitAspect,
  TransitRankingItem,
  TransitReason,
  TransitState
} from "@/services/layersApi";

/**
 * Presentación pura de las capas de tiempo V4.9.2.
 *
 * Todo lo que se ve en pantalla sale del sobre real (`layers.getForDate`). Este
 * módulo sólo TRADUCE: pasa claves internas a lenguaje de usuario, formatea
 * fechas y grados, y decide qué explicación honesta corresponde cuando falta un
 * dato. No inventa valores, no rellena y no muestra jerga sin traducir,
 * puntajes internos ni proveedor.
 *
 * Es puro a propósito: sin React, sin Convex y sin reloj propio (el "ahora"
 * siempre entra por parámetro).
 */

// ---------------------------------------------------------------------------
// Fecha civil del dispositivo
// ---------------------------------------------------------------------------

/** Zona IANA del aparato; si el sistema no la expone, la zona del producto. */
export function deviceTimezoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Argentina/Buenos_Aires";
  } catch {
    return "America/Argentina/Buenos_Aires";
  }
}

/**
 * Fecha civil `YYYY-MM-DD` que el aparato ve en una zona.
 *
 * `layers.refreshForDate` rechaza cualquier `localDate` que no coincida con el
 * instante del servidor en esa zona, así que el par (fecha, zona) tiene que
 * salir del mismo reloj y de la misma zona: la del dispositivo.
 */
export function civilDateInTimezone(nowMs: number, timezone: string): string {
  return observedDateInTimezone(nowMs, timezone);
}

/**
 * Hora civil `YYYY-MM-DDTHH` del aparato en una zona.
 *
 * Es el balde con el que el ciclo de datos decide recalcular: mientras la app
 * queda abierta, cada vez que cambia esta cadena se pide el sobre de nuevo, así
 * que lo que se ve nunca tiene más de una hora de cálculo encima. Zona inválida
 * → cadena vacía, el mismo centinela que `civilDateInTimezone`, para no
 * disparar recálculos en bucle.
 */
export function civilHourInTimezone(nowMs: number, timezone: string): string {
  const date = civilDateInTimezone(nowMs, timezone);
  const clock = clockPartsInTimezone(nowMs, timezone);
  if (!date || !clock) return "";
  return `${date}T${clock.hour}`;
}

// ---------------------------------------------------------------------------
// Formatos
// ---------------------------------------------------------------------------

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
];

const MS_PER_DAY = 86_400_000;

function partsInTimezone(ms: number, timezone: string) {
  const iso = observedDateInTimezone(ms, timezone);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    const fallback = new Date(ms);
    return { year: fallback.getFullYear(), month: fallback.getMonth() + 1, day: fallback.getDate() };
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** "12 de mayo" — para fechas dentro del año en curso. */
export function formatDayMonth(ms: number, timezone: string): string {
  const { month, day } = partsInTimezone(ms, timezone);
  return `${day} de ${MONTHS_ES[month - 1]}`;
}

/** "12 MAY" — la fecha corta de las líneas de tiempo del canon V4.9.2. */
export function formatShortDayMonth(ms: number, timezone: string): string {
  const { month, day } = partsInTimezone(ms, timezone);
  return `${day} ${MONTHS_ES[month - 1].slice(0, 3).toLocaleUpperCase("es")}`;
}

/**
 * "MAY 2024" — para los ciclos que se miden en AÑOS.
 *
 * La estación vital dura unos 3,7 años, así que sus dos bordes caen en años
 * distintos: escritos como `17 DIC` / `8 NOV` no se sabe de qué año hablan y
 * `PRÓXIMA FASE 8 NOV` se lee como "este 8 de noviembre". El frame V4.9.2
 * escribe mes y año (`EMPEZÓ MAY 2024` · `PRÓXIMA FASE NOV 2027`); el día sobra
 * en una escala de años y el año no.
 */
export function formatShortMonthYear(ms: number, timezone: string): string {
  const { year, month } = partsInTimezone(ms, timezone);
  return `${MONTHS_ES[month - 1].slice(0, 3).toLocaleUpperCase("es")} ${year}`;
}

/** "12 de mayo de 2026" — cuando el año importa (ventanas largas, cierres). */
export function formatFullDate(ms: number, timezone: string): string {
  const { year, month, day } = partsInTimezone(ms, timezone);
  return `${day} de ${MONTHS_ES[month - 1]} de ${year}`;
}

/**
 * "12 de mayo de 1990" a partir de una fecha civil `YYYY-MM-DD`.
 *
 * Una fecha de nacimiento NO es un instante: pasarla por una zona horaria la
 * puede correr un día entero, que es justo el error que arruina un dato natal.
 * Acá se leen los tres números y se escriben, sin convertir nada. `null` si la
 * cadena no es una fecha civil válida, para no imprimir un dato roto.
 */
export function formatCivilDate(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${day} de ${MONTHS_ES[month - 1]} de ${Number(match[1])}`;
}

/** Encabezado del día: "viernes 15 de agosto". */
export function formatWeekdayDate(ms: number, timezone: string): string {
  const { year, month, day } = partsInTimezone(ms, timezone);
  const weekdays = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const weekday = weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${day} de ${MONTHS_ES[month - 1]}`;
}

function clockPartsInTimezone(ms: number, timezone: string): { hour: string; minute: string } | null {
  if (!Number.isFinite(ms) || !timezone) return null;
  try {
    // `hourCycle: "h23"` evita el "24:05" que devuelven algunas locales a la
    // medianoche: acá la hora se compara y se imprime, así que tiene que ser
    // siempre 00–23.
    const parts = new Intl.DateTimeFormat("es-AR", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(ms));
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;
    if (!hour || !minute) return null;
    return { hour, minute };
  } catch {
    return null;
  }
}

/** "14:35" en la zona pedida. `null` si el sistema no puede resolverla. */
export function formatLocalTime(ms: number, timezone: string): string | null {
  const clock = clockPartsInTimezone(ms, timezone);
  return clock ? `${clock.hour}:${clock.minute}` : null;
}

/**
 * "12 de mayo, 14:35" — fecha y hora local de un instante.
 *
 * Es el formato con el que se dice CUÁNDO se calculó algo: sin la hora, un dato
 * de hace cuarenta minutos y uno de anteayer se leen igual. Con `withYear` suma
 * el año, para la trazabilidad y las ventanas largas. Si la zona no resuelve,
 * degrada a la fecha sola en vez de inventar una hora.
 */
export function formatDateTime(
  ms: number,
  timezone: string,
  options: { withYear?: boolean } = {}
): string {
  const date = options.withYear ? formatFullDate(ms, timezone) : formatDayMonth(ms, timezone);
  const time = formatLocalTime(ms, timezone);
  return time ? `${date}, ${time}` : date;
}

/**
 * Un intervalo de valores publicado por el contrato: grados, días o proporción.
 * Cuando el cálculo no puede fijar un número, publica sus dos bordes.
 */
export type ValueRange = { from: number; to: number };

/** Un intervalo de instantes publicado por el contrato: los bordes de una ventana. */
export type InstantRange = { earliest: number; latest: number };

/**
 * "entre el 3 de mayo de 2024 y el 1 de noviembre de 2024" — la ventana entera.
 *
 * Es la forma de decir una fecha que el cálculo NO puede fijar. El punto medio
 * de estos dos bordes existe y es tentador de imprimir, pero es una fecha que el
 * método nunca afirmó: escribirla sola la convierte en un día agendable.
 */
export function formatInstantRange(range: InstantRange, timezone: string): string {
  if (range.earliest === range.latest) return formatFullDate(range.earliest, timezone);
  return `entre el ${formatFullDate(range.earliest, timezone)} y el ${formatFullDate(
    range.latest,
    timezone
  )}`;
}

/**
 * La misma ventana, corta: "entre el 12 y el 14 de septiembre".
 *
 * Para rótulos y tarjetas, donde el año no aporta. Si los dos bordes caen en el
 * mismo mes, el mes se dice una sola vez; si caen en el mismo día, es un día y
 * se escribe como tal.
 */
export function formatDayMonthRange(range: InstantRange, timezone: string): string {
  const desde = partsInTimezone(range.earliest, timezone);
  const hasta = partsInTimezone(range.latest, timezone);
  if (desde.year === hasta.year && desde.month === hasta.month) {
    if (desde.day === hasta.day) return formatDayMonth(range.earliest, timezone);
    return `entre el ${desde.day} y el ${hasta.day} de ${MONTHS_ES[hasta.month - 1]}`;
  }
  return `entre el ${formatDayMonth(range.earliest, timezone)} y el ${formatDayMonth(
    range.latest,
    timezone
  )}`;
}

/** Días civiles entre dos instantes, en la zona del aparato. */
export function civilDayDistance(fromMs: number, toMs: number, timezone: string): number {
  const from = partsInTimezone(fromMs, timezone);
  const to = partsInTimezone(toMs, timezone);
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((b - a) / MS_PER_DAY);
}

/** "hoy" · "mañana" · "en 11 días" · "hace 3 días". Nunca inventa una hora. */
export function relativeDayLabel(targetMs: number, nowMs: number, timezone: string): string {
  const distance = civilDayDistance(nowMs, targetMs, timezone);
  if (distance === 0) return "hoy";
  if (distance === 1) return "mañana";
  if (distance === -1) return "ayer";
  return distance > 0 ? `en ${distance} días` : `hace ${Math.abs(distance)} días`;
}

/** Decimal con coma, como se escribe en español. */
export function formatDecimal(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits).replace(".", ",");
}

/** Porcentaje entero a partir de una fracción 0–1. */
export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return "—";
  return `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
}

/**
 * Grado dentro del signo, que es como se lee una posición ("13° de Escorpio").
 * La longitud eclíptica cruda (0–360) es una coordenada de cálculo: no se
 * muestra porque no significa nada fuera del motor.
 */
export function degreeInSign(longitudeDegrees: number): number {
  if (!Number.isFinite(longitudeDegrees)) return 0;
  return ((longitudeDegrees % 30) + 30) % 30;
}

/** Orbe en grados y minutos: `1°12′`. Es el dato, no un puntaje. */
export function formatOrb(degrees: number): string {
  if (!Number.isFinite(degrees)) return "—";
  const total = Math.abs(degrees);
  let whole = Math.floor(total);
  let minutes = Math.round((total - whole) * 60);
  if (minutes === 60) {
    whole += 1;
    minutes = 0;
  }
  return `${whole}°${String(minutes).padStart(2, "0")}′`;
}

// ---------------------------------------------------------------------------
// Vocabulario de tránsitos
// ---------------------------------------------------------------------------

export const ASPECT_LABEL: Record<TransitAspect, string> = {
  conjunction: "conjunción",
  sextile: "sextil",
  square: "cuadratura",
  trine: "trígono",
  opposition: "oposición"
};

/** "Saturno en cuadratura con tu Ascendente" — dato primero, sin interpretar. */
export function transitHeadline(input: {
  transitPlanet: string;
  aspect: TransitAspect;
  natalPoint: string;
}): string {
  return `${input.transitPlanet} en ${ASPECT_LABEL[input.aspect]} con tu ${input.natalPoint}`;
}

/** Etapa del contacto, dicha sin jerga ("aplicando/separando" no se muestra). */
export const TRANSIT_STATE_LABEL: Record<TransitState, string> = {
  approaching: "Se acerca al punto exacto",
  exact: "En su punto más exacto",
  integrating: "Ya pasó el punto exacto"
};

/**
 * La etapa en una palabra, para el chip del canon (`EXACTO`, `ACERCÁNDOSE`,
 * `INTEGRÁNDOSE`). La frase completa sigue viva en la etiqueta accesible de la
 * fila: el chip corto nunca es el único portador del significado.
 */
export const TRANSIT_STATE_CHIP: Record<TransitState, string> = {
  approaching: "ACERCÁNDOSE",
  exact: "EXACTO",
  integrating: "INTEGRÁNDOSE"
};

/**
 * Cómo cambió el orbe respecto de AYER: `↓ AYER 1°10′` · `↑ AYER 0°58′`.
 *
 * El número de ayer no se estima ni se extrapola: sale del sobre que quedó
 * guardado para el día civil anterior. Si esa cuenta no existe —cuenta nueva,
 * día sin abrir la app, tránsito que ayer no estaba activo— la fila NO dice
 * nada. Es la diferencia entre un dato y un relleno.
 *
 * La flecha describe el orbe, no una valoración: ↓ es que se acercó al punto
 * exacto y ↑ que se alejó.
 */
export function orbDeltaLabel(todayOrb: number, yesterdayOrb: number | null): string | null {
  if (yesterdayOrb === null || !Number.isFinite(yesterdayOrb) || !Number.isFinite(todayOrb)) return null;
  const arrow = todayOrb < yesterdayOrb ? "↓" : todayOrb > yesterdayOrb ? "↑" : "=";
  return `${arrow} AYER ${formatOrb(yesterdayOrb)}`;
}

/**
 * El orbe que cada arco tenía ayer, indexado por `arcId`.
 *
 * Se arma con el ranking del día anterior tal como quedó persistido; nunca se
 * infiere de la velocidad del planeta ni de la fecha del pico.
 */
export function orbsByArc(items: readonly TransitRankingItem[] | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items ?? []) map.set(item.arcId, item.orbDegrees);
  return map;
}

/** El día civil anterior a `YYYY-MM-DD`, en el mismo calendario civil. */
export function previousCivilDate(localDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return "";
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) - MS_PER_DAY;
  const date = new Date(utc);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/** Área de la carta que activa el tránsito, si hay casas verificadas. */
export function houseLine(natalHouse: number | null): string | null {
  if (natalHouse === null) return null;
  const theme = houseTheme(natalHouse);
  return theme ? `Activa tu casa ${natalHouse}, asociada a ${theme}.` : `Activa tu casa ${natalHouse}.`;
}

/**
 * De qué habla una casa, en asuntos de todos los días.
 *
 * Es la traducción que necesita cualquier pantalla que nombre una casa por su
 * número: "casa 7" no dice nada, "pareja, sociedades y acuerdos" sí. El número
 * fuera de 1–12 devuelve `null` en vez de un tema inventado, y quien llama
 * decide si muestra la casa sola o no la muestra.
 */
export function houseTheme(house: number): string | null {
  return HOUSE_THEMES[house] ?? null;
}

const HOUSE_THEMES: Record<number, string> = {
  1: "identidad y forma de entrar al mundo",
  2: "recursos, cuerpo y valor propio",
  3: "conversaciones, aprendizaje y entorno cercano",
  4: "raíz, casa e intimidad",
  5: "deseo, juego y expresión",
  6: "rutinas, tareas y organización cotidiana",
  7: "pareja, sociedades y acuerdos",
  8: "profundidad, confianza y cambio",
  9: "sentido, búsqueda y expansión",
  10: "dirección, vocación y exposición",
  11: "redes, futuro y pertenencia",
  12: "descanso, cierre y mundo interno"
};

/**
 * Etiqueta del criterio de orden. El backend ya manda `label` y `explanation`
 * en español; acá sólo se corrige el rótulo que en V4.9.1 sonaba a jerga
 * (`REGENCIA` → `CASAS QUE RIGE`, handoff de claridad editorial).
 */
export function reasonLabel(reason: TransitReason): string {
  if (reason.key === "rulership") return "Casas que rige";
  return reason.label;
}

/**
 * Orbe máximo que el método declara para considerar activo un aspecto (3°).
 * Es el mismo límite que el backend publica en sus limitaciones; sirve para
 * dibujar la cercanía al punto exacto SIN inventar una escala propia.
 */
export const TRANSIT_MAX_ORB_DEGREES = 3;

/** Cercanía al punto exacto, 0–1. El grado real siempre se muestra al lado. */
export function exactnessRatio(orbDegrees: number): number {
  if (!Number.isFinite(orbDegrees)) return 0;
  const clamped = Math.max(0, Math.min(TRANSIT_MAX_ORB_DEGREES, Math.abs(orbDegrees)));
  return 1 - clamped / TRANSIT_MAX_ORB_DEGREES;
}

/** Progreso 0–1 de un instante dentro de una ventana. */
export function windowProgress(startsAt: number, endsAt: number, nowMs: number): number {
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) return 0;
  return Math.max(0, Math.min(1, (nowMs - startsAt) / (endsAt - startsAt)));
}

/** Los tres primeros del orden real: no se re-ordena ni se filtra en el front. */
export function topTransits(items: readonly TransitRankingItem[], count = 3): TransitRankingItem[] {
  return items.slice(0, count);
}

/**
 * El instante del Cumpleluna que cae en el día civil de hoy, si hay alguno.
 *
 * El sobre trae DOS repeticiones del ángulo natal: la anterior y la próxima.
 * Mirando sólo la próxima, un Cumpleluna que ocurrió a las 03:00 desaparecía de
 * la pantalla el mismo día en que pasó —justo el día que importa—, porque a esa
 * altura `nextExactAt` ya apuntaba a dentro de 29 días.
 *
 * SÓLO se puede preguntar con un sobre de precisión `exact`. Sin raíz exacta
 * estos dos números son el CENTRO de una ventana, y preguntarles "¿cae hoy?"
 * convierte ese centro en un evento con día —y después con hora—. Para el resto
 * de las precisiones está `cumplelunaToday`, que mira las ventanas publicadas.
 */
export function cumplelunaExactToday(
  data: CumplelunaData,
  nowMs: number,
  timezone: string
): number | null {
  if (civilDayDistance(nowMs, data.nextExactAt, timezone) === 0) return data.nextExactAt;
  if (civilDayDistance(nowMs, data.previousExactAt, timezone) === 0) return data.previousExactAt;
  return null;
}

/**
 * El Cumpleluna ocurre hoy (la repetición del ángulo cae en el día civil).
 * Misma condición que `cumplelunaExactToday`: sólo vale con precisión `exact`.
 */
export function isCumplelunaToday(data: CumplelunaData, nowMs: number, timezone: string): boolean {
  return cumplelunaExactToday(data, nowMs, timezone) !== null;
}

/**
 * El Cumpleluna de hoy, dicho con la certeza que el sobre sostiene.
 *
 * - `exact`: la raíz del cálculo es exacta, así que hay un INSTANTE —y por eso
 *   se puede decir si ya fue o si todavía es— con su hora.
 * - `today`: no hay instante, pero la ventana publicada entra ENTERA en el día
 *   civil: el evento ocurre hoy aunque nadie pueda decir a qué hora.
 * - `possible`: la ventana sólo toca el día de hoy, así que el Cumpleluna puede
 *   caer hoy y también puede caer otro día.
 */
export type CumplelunaToday =
  | { certainty: "exact"; at: number; past: boolean }
  | { certainty: "today"; range: InstantRange }
  | { certainty: "possible"; range: InstantRange };

/**
 * Resuelve el evento de hoy sin afirmar más precisión que la del sobre.
 *
 * Con raíz exacta el instante es el dato. Sin ella el sobre publica las dos
 * repeticiones como ventanas (`previousExactAtRange`, `nextExactAtRange`) y sólo
 * la ventana entera puede decir algo del día de hoy: el punto medio es el número
 * con el que el cálculo sigue operando, no una fecha que el método afirme. Si el
 * sobre no publica ninguna ventana, `null` — no hay nada honesto que decir del
 * día, y la pantalla no lo destaca.
 */
export function cumplelunaToday(
  data: CumplelunaData,
  precision: AnalysisPrecision,
  nowMs: number,
  timezone: string
): CumplelunaToday | null {
  if (precision === "exact") {
    const at = cumplelunaExactToday(data, nowMs, timezone);
    return at === null ? null : { certainty: "exact", at, past: at <= nowMs };
  }

  let posible: CumplelunaToday | null = null;
  for (const range of [data.previousExactAtRange, data.nextExactAtRange]) {
    if (!range) continue;
    const desde = civilDayDistance(nowMs, range.earliest, timezone);
    const hasta = civilDayDistance(nowMs, range.latest, timezone);
    // La ventana entera cae en el día civil: es lo más cerca de "hoy" que se
    // puede afirmar sin raíz exacta, y gana sobre cualquier superposición.
    if (desde === 0 && hasta === 0) return { certainty: "today", range };
    if (desde <= 0 && hasta >= 0 && !posible) posible = { certainty: "possible", range };
  }
  return posible;
}

/**
 * El intervalo que corresponde mostrar, o `null` cuando el número basta.
 *
 * Con precisión `exact` el valor publicado ES el dato. En cualquier otro caso
 * ese valor es el CENTRO de una ventana que el sobre también publica, y mostrar
 * sólo el centro afirma una precisión que el cálculo no tiene. Si la ventana no
 * viene, se cae al número —es lo único que hay— y el estado del sobre sigue
 * diciendo arriba que el dato no es exacto.
 */
function visibleRange<T>(precision: AnalysisPrecision, range: T | undefined | null): T | null {
  if (precision === "exact") return null;
  return range ?? null;
}

/**
 * Los números del Cumpleluna, ya en palabras y con la forma que el cálculo
 * sostiene: un valor único cuando la raíz es exacta, y el intervalo entero
 * cuando no lo es.
 */
export type CumplelunaView = {
  /** "en 11 días · 27 de agosto" · "entre el 12 y el 14 de septiembre". */
  nextWhen: string;
  /** La fecha del próximo contacto, con hora sólo si el cálculo la sostiene. */
  nextExact: string;
  /** "28,8 días" · "entre 27,4 y 30,1 días" · "menos de un día". */
  daysRemaining: string;
  /** "18,5" · "entre 17,9 y 19,1". */
  cycleDay: string;
  /** "29,5 días" · "entre 29,3 y 29,8 días". */
  cycleLength: string;
  /** "108,0°" · "entre 106,2° y 109,8°". */
  natalAngle: string;
  /** "DÍA 18,5 DE 29,5" — el reloj personal, para el disco y las tarjetas. */
  cycleClock: string;
  /** La franja posible del avance; `null` cuando el avance es un punto. */
  progressBand: ValueRange | null;
};

/**
 * Traducción completa del Cumpleluna para pantalla.
 *
 * Sin una hora de nacimiento exacta, el método no puede fijar ni el ángulo natal
 * ni las dos repeticiones que abren y cierran el ciclo: el sobre publica cada
 * dato con su ventana (`natalElongationRangeDegrees`, `nextExactAtRange`,
 * `daysRemainingRange`, `cycleDayRange`, `cycleLengthDaysRange`, `progressRange`)
 * y acá cada uno se dice como lo que es. El punto medio de una ventana nunca se
 * imprime solo: es el número que el cálculo eligió para poder seguir operando,
 * no una afirmación sobre tu ciclo.
 */
export function cumplelunaView(
  data: CumplelunaData,
  precision: AnalysisPrecision,
  nowMs: number,
  timezone: string
): CumplelunaView {
  const proximo = visibleRange(precision, data.nextExactAtRange);
  const faltan = visibleRange(precision, data.daysRemainingRange);
  const dia = visibleRange(precision, data.cycleDayRange);
  const largo = visibleRange(precision, data.cycleLengthDaysRange);
  const angulo = visibleRange(precision, data.natalElongationRangeDegrees);

  const cycleDay = dia
    ? `entre ${formatDecimal(Math.max(0, dia.from))} y ${formatDecimal(Math.max(0, dia.to))}`
    : formatDecimal(Math.max(0, data.cycleDay));
  const cycleLength = largo
    ? `entre ${formatDecimal(largo.from)} y ${formatDecimal(largo.to)} días`
    : `${formatDecimal(data.cycleLengthDays)} días`;

  return {
    nextWhen: proximo
      ? formatDayMonthRange(proximo, timezone)
      : `${relativeDayLabel(data.nextExactAt, nowMs, timezone)} · ${formatDayMonth(
          data.nextExactAt,
          timezone
        )}`,
    nextExact: proximo
      ? formatInstantRange(proximo, timezone)
      : precision === "exact"
        ? formatDateTime(data.nextExactAt, timezone, { withYear: true })
        : formatFullDate(data.nextExactAt, timezone),
    daysRemaining: faltan
      ? `entre ${formatDecimal(Math.max(0, faltan.from))} y ${formatDecimal(
          Math.max(0, faltan.to)
        )} días`
      : data.daysRemaining < 1
        ? "menos de un día"
        : `${formatDecimal(data.daysRemaining)} días`,
    cycleDay,
    cycleLength,
    natalAngle: angulo
      ? `entre ${formatDecimal(angulo.from)}° y ${formatDecimal(angulo.to)}°`
      : `${formatDecimal(data.natalElongationDegrees)}°`,
    // El reloj repite los dos números del ciclo en un solo renglón, así que
    // hereda su forma: con ventana dice las dos ventanas, no sus centros.
    cycleClock: `DÍA ${cycleDay.toLocaleUpperCase("es")} DE ${(largo
      ? `entre ${formatDecimal(largo.from)} y ${formatDecimal(largo.to)}`
      : formatDecimal(data.cycleLengthDays)
    ).toLocaleUpperCase("es")}`,
    progressBand: visibleRange(precision, data.progressRange)
  };
}

// ---------------------------------------------------------------------------
// Vocabulario natal (tipo lunar y mapa elemental)
// ---------------------------------------------------------------------------

/**
 * Los cuatro elementos, en el orden editorial en que se leen en pantalla:
 * agua, tierra, fuego y aire.
 *
 * No es el orden del zodíaco ni una jerarquía: es el orden fijo con el que el
 * mapa elemental se lee siempre igual, así que dos cartas distintas se pueden
 * comparar fila por fila. El recuento de cada elemento sale del sobre y no
 * depende de este orden.
 */
export const ELEMENT_ORDER: readonly ElementKey[] = ["water", "earth", "fire", "air"];

/**
 * Los cuatro elementos, escritos como los escribe el frame: en caja de oración.
 *
 * No van en mayúsculas. En el canon (`08 · mapa elemental`) la mayúscula es el
 * registro de los RÓTULOS —`RECURSO`, `TOTAL 10 DE 10 POSICIONES`, la lista de
 * planetas—, y el nombre del elemento es el contenido de la fila, no su rótulo.
 * Ponerlo en mayúsculas lo igualaba con los metadatos que tiene al lado.
 */
export const ELEMENT_LABEL: Record<ElementKey, string> = {
  fire: "Fuego",
  earth: "Tierra",
  air: "Aire",
  water: "Agua"
};

/** "fuego · agua" — enumeración corta para una fila de dato. `—` si no hay. */
export function elementList(elements: readonly ElementKey[]): string {
  if (elements.length === 0) return "—";
  return elements.map((element) => ELEMENT_LABEL[element].toLocaleLowerCase("es")).join(" · ");
}

/**
 * Artículo definido de cada elemento, para los rótulos que lo necesitan.
 *
 * No se puede derivar del género: `tierra` y `agua` son femeninos y sólo
 * `tierra` lleva `la` —`agua` empieza con /a/ tónica—. Con un `EL` fijo el
 * rótulo del mapa elemental decía `CUANDO EL TIERRA SATURA`.
 */
export const ELEMENT_ARTICLE: Record<ElementKey, "el" | "la"> = {
  fire: "el",
  earth: "la",
  air: "el",
  water: "el"
};

/**
 * "el agua" / "la tierra" para un elemento, o "los elementos" cuando hay más de
 * uno empatado: con dos elementos el artículo singular no existe.
 */
export function elementWithArticle(elements: readonly ElementKey[]): string {
  if (elements.length === 0) return "—";
  if (elements.length > 1) return `los ${elementList(elements)}`;
  return `${ELEMENT_ARTICLE[elements[0]]} ${ELEMENT_LABEL[elements[0]].toLocaleLowerCase("es")}`;
}

/**
 * El rótulo del elemento MENOS representado, según lo que realmente se contó.
 *
 * `SIN PLANETAS` sólo si el recuento es exactamente cero. Con uno o más el
 * elemento está presente —poco, pero presente— y el rótulo tiene que decir eso:
 * la captura de la certificación mostraba `Aire 1 · Urano` en la barra y
 * `AIRE SIN PLANETAS` a la derecha, en la misma pantalla.
 *
 * Con empate se nombran los dos —`AIRE · FUEGO`— y el rótulo se pluraliza sólo
 * cuando el recuento común es cero. Un empate no autoriza a elegir uno de los
 * dos ni a inventar un texto que valga para los dos.
 */
export function leastElementTag(
  elements: readonly ElementKey[],
  /** Cuántas posiciones cayeron en ese elemento (el mismo número para los empatados). */
  count: number
): string {
  const nombres = elementList(elements).toLocaleUpperCase("es");
  if (elements.length === 0) return "SIN DATO";
  if (count === 0) return `${nombres} SIN PLANETAS`;
  return `${nombres} MENOS PRESENTE`;
}

/**
 * Cuántas posiciones tiene el elemento menos representado.
 *
 * Con empate los elementos comparten recuento, así que alcanza con el primero;
 * si el sobre trajera una lista vacía se devuelve `null` y quien llama decide
 * —nunca un cero, que sería afirmar un recuento que no vino—.
 */
export function leastElementCount(
  counts: Record<ElementKey, number>,
  elements: readonly ElementKey[]
): number | null {
  const primero = elements[0];
  if (!primero) return null;
  const valor = counts[primero];
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

/**
 * Las ocho fases del ciclo Sol–Luna, en orden y con el tramo de grados que
 * ocupa cada una.
 *
 * El ciclo son 360° repartidos en ocho sectores de 45° a partir de 0°, que es
 * exactamente como el método asigna `phaseIndex`. Esta tabla existe para poder
 * dibujar el ciclo ENTERO —las siete fases que no son la tuya incluidas—, no
 * para nombrar la tuya: esa siempre sale del sobre (`data.name`), así que si el
 * backend cambia una etiqueta, lo que se lee de tu fase sigue siendo lo suyo.
 */
export const LUNAR_CYCLE: readonly {
  key: LunarPhaseKey;
  name: string;
  startDegrees: number;
  endDegrees: number;
}[] = [
  { key: "new", name: "Nueva", startDegrees: 0, endDegrees: 45 },
  { key: "crescent", name: "Creciente", startDegrees: 45, endDegrees: 90 },
  { key: "first_quarter", name: "Cuarto creciente", startDegrees: 90, endDegrees: 135 },
  { key: "gibbous", name: "Gibosa", startDegrees: 135, endDegrees: 180 },
  { key: "full", name: "Llena", startDegrees: 180, endDegrees: 225 },
  { key: "disseminating", name: "Diseminante", startDegrees: 225, endDegrees: 270 },
  { key: "last_quarter", name: "Cuarto menguante", startDegrees: 270, endDegrees: 315 },
  { key: "balsamic", name: "Balsámica", startDegrees: 315, endDegrees: 360 }
];

/**
 * Fracción iluminada que le corresponde a un ángulo Sol–Luna.
 *
 * Es la misma identidad geométrica con la que el backend calcula tu
 * iluminación, y acá sólo se usa para dibujar el punto medio de cada fase del
 * ciclo de referencia. Tu disco NUNCA se dibuja con esto: usa el valor que trae
 * el sobre.
 */
export function illuminatedFractionAt(elongationDegrees: number): number {
  if (!Number.isFinite(elongationDegrees)) return 0;
  return (1 - Math.cos((elongationDegrees * Math.PI) / 180)) / 2;
}

/**
 * La forma que tiene una fase, dibujada en el punto medio de su tramo.
 *
 * No es la iluminación de nadie: es el aspecto característico de la fase, el
 * mismo con el que se dibujan las siete que no son la tuya. Sirve para poder
 * mostrar la fase —que sin hora exacta el método SÍ sostiene, porque es la
 * misma durante todo el día de nacimiento— sin afirmar una fracción iluminada
 * que sólo la hora exacta permitiría medir.
 */
export function phaseShapeIllumination(phaseKey: LunarPhaseKey): number {
  const fase = LUNAR_CYCLE.find((entry) => entry.key === phaseKey);
  if (!fase) return 0;
  return illuminatedFractionAt((fase.startDegrees + fase.endDegrees) / 2);
}

/** "0° a 45°" — el tramo del ciclo que ocupa una fase. */
export function degreeRangeLabel(startDegrees: number, endDegrees: number): string {
  return `${startDegrees}° a ${endDegrees}°`;
}

// ---------------------------------------------------------------------------
// Estados del sobre
// ---------------------------------------------------------------------------

export type StatusTone = "neutral" | "warn" | "muted";

export type StatusChip = { label: string; tone: StatusTone; note: string };

/**
 * Qué mostrar según el estado del cálculo. `ready` no lleva chip: el estado
 * normal no se anuncia. El resto SIEMPRE se dice, aunque haya datos viejos
 * abajo, porque la alternativa es que parezcan de hoy.
 */
export function statusChip(status: AnalysisStatus): StatusChip | null {
  switch (status) {
    case "ready":
      return null;
    case "partial":
      return {
        label: "PARCIAL",
        tone: "warn",
        note: "Mostramos lo que se puede calcular con tus datos actuales; el resto queda afuera."
      };
    case "needs_birth_time":
      return {
        label: "FALTA TU HORA DE NACIMIENTO",
        tone: "warn",
        note: "Este cálculo depende de la hora exacta de nacimiento. Sin ella no lo estimamos."
      };
    case "stale":
      return {
        // El aviso lo comparten capas del día y capas natales, así que no puede
        // hablar del cielo ni de "este momento": una capa natal no cambia con el
        // día. Lo que se afirma es que ESTE cálculo no se pudo rehacer, y la
        // fecha del último resultado la pone `StaleNotice` con `observedAt`.
        label: "ÚLTIMO DATO DISPONIBLE",
        tone: "warn",
        note: "No pudimos rehacer este cálculo ahora: es el último resultado verificado que quedó guardado."
      };
    case "unavailable":
      return {
        label: "SIN DATOS",
        tone: "muted",
        note: "Todavía no hay un cálculo disponible para esta parte."
      };
    case "error":
      return {
        label: "NO SE PUDO CALCULAR",
        tone: "warn",
        note: "Hubo un problema al calcular esta parte. Probá de nuevo en un rato."
      };
    default:
      return null;
  }
}

/** Cómo se leen los cuatro grados de precisión del contrato, sin jerga. */
export const PRECISION_LABEL: Record<AnalysisPrecision, string> = {
  exact: "exacta",
  estimated: "estimada",
  range: "rango",
  not_applicable: "no aplica"
};

/**
 * Qué tan preciso es lo que se muestra.
 *
 * `not_applicable` no dice nada: no hay valor que calificar. `exact` tampoco se
 * anuncia mientras el estado es el normal —la precisión esperada no es noticia—,
 * pero SÍ cuando el cálculo está degradado: ahí importa saber si los números que
 * quedaron a la vista son exactos o aproximados. `estimated` y `range` se dicen
 * siempre, porque callarlos es dejar leer una estimación como si fuera un dato
 * cerrado.
 */
export function precisionChip(
  precision: AnalysisPrecision,
  status: AnalysisStatus
): StatusChip | null {
  switch (precision) {
    case "estimated":
      return {
        label: "DATO ESTIMADO",
        tone: "warn",
        // La misma explicación la comparten la carta, los ciclos largos y los
        // tránsitos: no puede dar por hecho que el dato estimado sea un contacto
        // —un tipo lunar o un mapa elemental no lo son—, así que nombra el
        // margen y nada más.
        note: "Las fechas y valores son una aproximación calculada; pueden variar dentro del margen indicado."
      };
    case "range":
      return {
        label: "DATO EN RANGO",
        tone: "warn",
        note: "Falta un dato de partida exacto, así que esto se acota a un rango posible y no a un valor único."
      };
    case "exact":
      if (status === "ready") return null;
      return {
        label: "DATO EXACTO",
        tone: "neutral",
        note: "Lo que quedó a la vista sí sale del cálculo exacto; lo que falta se explica arriba."
      };
    default:
      return null;
  }
}

/** ¿El sobre tiene algo que mostrar? */
export function hasData(envelope: AnalysisEnvelope): boolean {
  return envelope.data !== null && envelope.data !== undefined;
}

/**
 * Cuándo se calculó el último dato visible de un conjunto de capas.
 *
 * Sólo cuentan los sobres que traen datos: es la hora del cálculo que la
 * persona está leyendo, no la del intento que no devolvió nada. `null` cuando
 * no hay ninguno, y entonces no se afirma ninguna hora.
 */
export function latestObservedAt(envelopes: readonly AnalysisEnvelope[]): number | null {
  const stamps = envelopes
    .filter(hasData)
    .map((envelope) => envelope.observedAt)
    .filter((ms) => Number.isFinite(ms) && ms > 0);
  return stamps.length > 0 ? Math.max(...stamps) : null;
}

/**
 * ¿Alguna de estas capas trae datos?
 *
 * Sirve para distinguir la PRIMERA carga —todavía no hay nada persistido y el
 * recálculo está en vuelo— de un día realmente sin datos. En el primer caso se
 * muestra carga; en el segundo, la explicación de cada módulo. Sin esta
 * distinción, abrir la app por primera vez mostraba cuatro "SIN DATOS" que un
 * segundo después se llenaban solos.
 */
export function anyDataReady(envelopes: readonly AnalysisEnvelope[]): boolean {
  return envelopes.some(hasData);
}

/**
 * Cuántas de estas capas tienen cálculo — el contador `4 CAPAS` del encabezado.
 *
 * Cuenta datos reales, no bloques dibujados: una capa que hoy no se puede
 * calcular no suma, y por eso el mismo encabezado puede decir `3 CAPAS` un día
 * y `4 CAPAS` al siguiente sin que nada mienta.
 */
export function countReady(envelopes: readonly AnalysisEnvelope[]): number {
  return envelopes.filter(hasData).length;
}

/**
 * `4 CAPAS` cuando están todas y `2/3 CAPAS` cuando falta alguna.
 *
 * La forma con barra es la del frame sin hora de nacimiento: dice de un vistazo
 * que la pantalla está incompleta y cuánto le falta, sin esconderlo en un chip.
 */
export function layerCountLabel(envelopes: readonly AnalysisEnvelope[]): string {
  const listas = countReady(envelopes);
  const total = envelopes.length;
  return listas === total ? `${total} CAPAS` : `${listas}/${total} CAPAS`;
}

/**
 * ¿Alguna de estas capas quedó con el último cálculo guardado?
 *
 * El sobre puede llegar `stale` sin que el recálculo de ESTA sesión haya
 * fallado: el backend ya lo había marcado antes. Mirando sólo `refreshFailed`,
 * ese caso se pintaba como si el dato fuera de ahora, así que la pantalla lo
 * pregunta a los sobres además de al ciclo de datos — y entonces `StaleNotice`
 * puede fechar lo que se está leyendo.
 */
export function anyStale(envelopes: readonly AnalysisEnvelope[]): boolean {
  return envelopes.some((envelope) => envelope.status === "stale");
}

const MISSING_INPUT_LABEL: Record<string, string> = {
  exact_birth_time: "Falta tu hora exacta de nacimiento.",
  natal_chart: "Todavía no hay una carta natal calculada para tu cuenta.",
  natal_sun_and_moon: "Faltan las posiciones del Sol y de la Luna de tu nacimiento.",
  natal_planet_positions: "Todavía no hay posiciones natales calculadas para contar.",
  birth_time_or_full_day_lunar_samples:
    "Sin tu hora exacta hay que revisar todo tu día de nacimiento, y ese repaso todavía no está disponible.",
  full_day_natal_samples:
    "Sin tu hora exacta hay que revisar todo tu día de nacimiento, y ese repaso todavía no está disponible.",
  exact_birth_time_or_certified_lunar_phase:
    "Sin tu hora exacta, la Luna queda cerca de cambiar de fase durante tu día de nacimiento.",
  complete_natal_houses: "Faltan cúspides de casas suficientes para ubicar el punto en tu carta.",
  exact_birth_time_and_houses:
    "Sin tu hora exacta de nacimiento y las doce casas de tu carta no hay Descendente ni casa 7 que leer.",
  ascendant_sign: "No hay un Ascendente verificado en tu carta.",
  natal_and_current_sun_moon: "Faltan posiciones verificadas de Sol y Luna.",
  current_sun_and_moon: "Faltan posiciones actuales verificadas de Sol y Luna.",
  current_ephemeris: "No pudimos traer las posiciones del cielo de hoy.",
  fresh_ephemeris: "No pudimos traer las posiciones del cielo de hoy.",
  active_transit_arc: "Hoy no hay ningún tránsito mayor activo para formar un arco.",
  // El arco guardado describía OTRO contacto que el que hoy encabeza la lista.
  // No es "no hay tránsito activo": hay lista, y falta su arco.
  matching_transit_arc: "Todavía no está calculado el arco del tránsito que hoy encabeza tu lista.",
  requested_transit_arc: "No encontramos ese tránsito entre los activos de hoy.",
  requested_transit_arc_calculation:
    "Todavía no calculamos la línea de tiempo de este tránsito para hoy.",
  progressed_ephemeris: "No pudimos calcular las posiciones progresadas.",
  progressed_sun_and_moon: "Faltan el Sol o la Luna en el cálculo progresado.",
  progressed_relative_speed: "El cálculo progresado no permite acotar la fase con seguridad.",
  progressed_phase_roots: "No pudimos acotar el inicio y el final de la fase progresada.",
  cumpleluna_roots: "No pudimos acotar dos repeticiones consecutivas de tu ángulo natal."
};

/** Los diez planetas que cuentan las capas natales, en palabras. */
const PLANET_LABEL: Record<string, string> = {
  sun: "Sol",
  moon: "Luna",
  mercury: "Mercurio",
  venus: "Venus",
  mars: "Marte",
  jupiter: "Júpiter",
  saturn: "Saturno",
  uranus: "Urano",
  neptune: "Neptuno",
  pluto: "Plutón"
};

/** "del Sol" · "de la Luna" · "de Mercurio": sólo las luminarias llevan artículo. */
function planetComplement(key: string): string | null {
  const label = PLANET_LABEL[key];
  if (!label) return null;
  if (key === "sun") return "del Sol";
  if (key === "moon") return "de la Luna";
  return `de ${label}`;
}

/** "El Sol" · "La Luna" · "Marte": la misma regla, como sujeto de la frase. */
function planetSubject(key: string): string | null {
  const label = PLANET_LABEL[key];
  if (!label) return null;
  if (key === "sun") return "El Sol";
  if (key === "moon") return "La Luna";
  return label;
}

/**
 * Traducción de un `missingInput`.
 *
 * Algunos códigos del contrato llevan el planeta adentro (`natal_venus`,
 * `stable_natal_pluto`): son una familia, no una lista cerrada, así que se
 * arman con el nombre del planeta en vez de dejarlos caer al texto genérico —
 * que es lo que pasaba con el mapa elemental incompleto. La tabla exacta manda:
 * `natal_chart` no es "la posición natal de chart".
 */
function missingInputLine(code: string): string | null {
  const exact = MISSING_INPUT_LABEL[code];
  if (exact) return exact;
  if (code.startsWith("stable_natal_")) {
    const subject = planetSubject(code.slice("stable_natal_".length));
    return subject ? `${subject} puede cambiar de signo durante tu día de nacimiento.` : null;
  }
  if (code.startsWith("natal_")) {
    const complement = planetComplement(code.slice("natal_".length));
    return complement ? `Falta la posición natal ${complement}.` : null;
  }
  return null;
}

/**
 * Por qué falta el dato, en lenguaje de usuario.
 *
 * Prioridad: (1) los `missingInputs` que sabemos traducir, (2) las
 * `limitations` del backend —que ya vienen escritas para leer—, (3) una frase
 * honesta genérica. Un código interno NUNCA se imprime en pantalla.
 */
export function missingReasons(envelope: AnalysisEnvelope): string[] {
  const translated = envelope.missingInputs
    .map(missingInputLine)
    .filter((line): line is string => Boolean(line));
  if (translated.length > 0) return uniqueLines(translated);
  if (envelope.limitations.length > 0) return uniqueLines(envelope.limitations.slice(0, 2));
  return ["Todavía no hay un cálculo verificable para esta parte."];
}

/**
 * El código con el que `layers.getTransitArc` declara que ese arco todavía no
 * tiene cálculo propio. Es un hecho distinto de "ese tránsito ya no está activo"
 * y la pantalla no puede confundirlos: uno se resuelve esperando el cálculo, el
 * otro es una respuesta final.
 */
export const TRANSIT_ARC_PENDING_INPUT = "requested_transit_arc_calculation";

/**
 * ¿Este sobre de arco es el hueco previo al cálculo, y no una respuesta?
 *
 * El sobre existe y es `ORB-TRN-001` —con su método, su hash y sus fuentes—, pero
 * dice que el arco pedido nunca se calculó para hoy. Mientras eso sea cierto la
 * pantalla muestra carga o el fallo del cálculo, nunca "ese tránsito ya no está
 * entre los activos".
 */
export function transitArcPending(envelope: AnalysisEnvelope): boolean {
  return envelope.data === null && envelope.missingInputs.includes(TRANSIT_ARC_PENDING_INPUT);
}

/**
 * Líneas sin repeticiones, en su orden original.
 *
 * El sobre puede traer la misma limitación dos veces —una capa que se arma en
 * dos pasos suma la suya en cada uno—, y repetirla en pantalla la hace parecer
 * dos límites distintos.
 */
export function uniqueLines(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

/** Título del análisis para la trazabilidad (mismo registro que el backend). */
export const ANALYSIS_TITLE: Record<AnalysisId, string> = {
  "ORB-LUN-001": "Tipo lunar natal",
  "ORB-NAT-001": "Mapa elemental",
  "ORB-CYC-002": "Estación vital",
  "ORB-CYC-001": "Tema del año",
  "ORB-CYC-007": "Mandala temporal",
  "ORB-TRN-002": "Orden de los tránsitos de hoy",
  "ORB-TRN-001": "Arco del tránsito",
  "ORB-LUN-003": "La Luna en tu carta",
  "ORB-LUN-002": "Cumpleluna",
  "ORB-REL-001": "Patrón relacional",
  "ORB-REL-002": "Intercambio elemental",
  "ORB-REL-003": "Comparación de cartas"
};

/** Cómo se elaboró el análisis, dicho sin jerga de método. */
export function elaborationNote(envelope: AnalysisEnvelope): string {
  switch (envelope.elaboration) {
    case "direct":
      return "Cálculo directo a partir de las fuentes citadas.";
    case "orbita_synthesis":
      return "Composición propia de Órbita a partir de las fuentes citadas.";
    case "experimental":
      return "Lectura experimental: se muestra como tal, no como técnica establecida.";
    default:
      return "";
  }
}

/** Qué relación tiene la fuente con lo que se muestra. */
export const SOURCE_RELATION_LABEL: Record<string, string> = {
  direct: "Fuente directa",
  synthesis: "Usada en la síntesis",
  contextual: "Contexto",
  doctrinal_disagreement: "Los autores no coinciden"
};

/** Páginas de una fuente, sin inventar folios que el archivo no conserva. */
export function sourcePages(source: {
  pdfPages: { from: number; to: number };
  printedPages: { from: number; to: number } | null;
}): string {
  const range = source.printedPages ?? source.pdfPages;
  const label = source.printedPages ? "págs." : "págs. del archivo";
  return range.from === range.to ? `${label} ${range.from}` : `${label} ${range.from}–${range.to}`;
}

/**
 * Qué hace que dos citas sean la MISMA cita: la obra y el localizador exacto.
 *
 * No alcanza con `sourceId`: un mismo libro puede citarse por dos capítulos
 * distintos y ésas son dos citas legítimas. Y no alcanza con el título: la
 * edición y las páginas son parte del localizador, porque las páginas que se
 * citan sólo se encuentran en la edición usada.
 */
function sourceCitationKey(source: SourceRef): string {
  return [
    source.sourceId,
    source.title,
    source.author,
    source.chapter,
    source.section ?? "",
    sourcePages(source)
  ].join("|");
}

/**
 * Fuentes sin repeticiones, en su orden original.
 *
 * Una capa que se arma en dos pasos cita la misma obra en cada uno, y la
 * bibliografía repetida se lee como dos respaldos distintos donde hay uno. Se
 * conserva la PRIMERA aparición entera —con su edición, su relación y su nota
 * de localizador—: no se fusionan campos ni se recorta ninguno.
 */
export function uniqueSources(sources: readonly SourceRef[]): SourceRef[] {
  const vistas = new Set<string>();
  return sources.filter((source) => {
    const key = sourceCitationKey(source);
    if (vistas.has(key)) return false;
    vistas.add(key);
    return true;
  });
}
