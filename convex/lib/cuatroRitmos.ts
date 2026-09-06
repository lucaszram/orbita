/**
 * Tu momento · Tus cuatro ritmos — el mandala temporal (CORE-211).
 *
 * El mandala no calcula nada por su cuenta: toma el resultado de los cuatro
 * análisis que ya corrieron por separado —la estación vital (CORE-209), el
 * tema del año (CORE-210), el ritmo lunar de `home.getLunaSobreLaCarta`
 * (CORE-192) y el tránsito activo del panorama de Tránsitos (CORE-207)— y los
 * describe como cuatro anillos, del más lento afuera al más rápido adentro.
 * Reproduce `buildTemporalMandalaData` de la línea `release/1.0.0`
 * (`convex/lib/layerAssembly.ts`): mismas claves, mismos rótulos, misma
 * política de avance: `point` cuando la fuente certifica un solo valor
 * (precisión exacta), `range` cuando publica un margen, `unavailable` sin
 * cálculo. El ritmo lunar de main siempre publica una ventana (la velocidad
 * de la Luna varía dentro del ciclo), así que ese anillo es siempre franja. El tránsito avanza por su posición
 * dentro de la ventana (`(ahora − inicio) / (fin − inicio)`, como
 * `adaptTransitArcToData` de release), no por su cercanía al exacto.
 *
 * Qué NO se inventa: un ritmo sin cálculo no recibe un anillo estimado; se
 * declara `available: false` con el motivo en sus propias palabras.
 */
import type { EstacionVital } from "./estacionVital";
import type { TemaDelAno } from "./temaDelAno";
import { parseNaiveTime, type TransitPanorama, type TransitPanoramaRow } from "./transitPanorama";

export type AnilloKey = "progressed_lunation" | "annual_profection" | "cumpleluna" | "transit_arc";

export const ORDEN_DE_ANILLOS: readonly AnilloKey[] = ["progressed_lunation", "annual_profection", "cumpleluna", "transit_arc"];

export const ROTULO_DE_ANILLO: Record<AnilloKey, string> = {
  progressed_lunation: "Estación vital",
  annual_profection: "Año personal",
  cumpleluna: "Tu ritmo lunar",
  transit_arc: "Tránsito activo"
};

export type Anillo = {
  key: AnilloKey;
  label: string;
  cadence: string;
  /** `Nueva` · `Casa 6 · mes 10 de 12` · `Día 19,7 de 29,4` · `Luna con tu Marte · máxima precisión`. */
  state: string;
  status: "ready" | "unavailable";
  precision: "exact" | "estimated" | "range" | "not_applicable";
  /** `point`: `progress` vale; `range`: `progressRange` vale; `unavailable`: nada. */
  progressMode: "point" | "range" | "unavailable";
  progress: number | null;
  progressRange?: { from: number; to: number };
  detail: string;
  available: boolean;
  /** `true` sólo cuando la fuente falló hoy (no cuando el ritmo no aplica): habilita reintentar. */
  failed: boolean;
  limitations: string[];
};

export type CuatroRitmos = {
  status: "ready";
  /** Raíz natal exacta: sin ella los avances son franjas, no puntos. */
  exact: boolean;
  rings: Anillo[];
  availableCount: number;
  summary: string;
  observedAt: number;
};

/** Lo que la Luna sobre la carta aporta al mandala; estructural para no acoplar `home.ts`. */
export type RitmoLunarFuente = {
  cumpleluna: {
    cycleFraction: number;
    cycleDay: number;
    cycleDayWindowDays: { from: number; to: number };
    cycleLengthDays: number;
    daysRemaining: number;
    daysRemainingWindowDays: { from: number; to: number };
    precision: "estimated" | "range";
  } | null;
  limitations: string[];
};

export const SUMMARY_DEL_MANDALA =
  "Cada anillo representa un ritmo personal distinto. Los externos avanzan en años o meses; los internos, entre dos Cumplelunas personales o según la duración de un tránsito. Así podés ubicar lo cotidiano dentro de procesos más largos.";

const SIN_FUENTE = "No pudimos obtener este cálculo ahora. El anillo queda vacío hasta que vuelva a estar disponible.";

function d1(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function rango(from: number, to: number): { from: number; to: number } {
  const a = round6(clamp01(Math.min(from, to)));
  const b = round6(clamp01(Math.max(from, to)));
  return { from: a, to: b };
}

type Avance = Pick<Anillo, "progressMode" | "progress" | "progressRange">;

function avancePunto(p: number): Avance {
  return { progressMode: "point", progress: round6(clamp01(p)) };
}

function avanceRango(from: number, to: number): Avance {
  return { progressMode: "range", progress: null, progressRange: rango(from, to) };
}

const SIN_AVANCE: Avance = { progressMode: "unavailable", progress: null };

function anilloVacio(key: AnilloKey, cadence: string, detail: string, limitations: string[], state = "Sin cálculo disponible"): Anillo {
  return {
    key,
    label: ROTULO_DE_ANILLO[key],
    cadence,
    state,
    status: "unavailable",
    precision: "not_applicable",
    ...SIN_AVANCE,
    detail,
    available: false,
    failed: detail === SIN_FUENTE,
    limitations
  };
}

function anilloEstacion(estacion: EstacionVital | null, observedAt: number): Anillo {
  const cadence = "cada fase dura alrededor de 3,7 años";
  if (!estacion) return anilloVacio("progressed_lunation", cadence, SIN_FUENTE, []);
  if (estacion.status !== "ready") {
    return anilloVacio(
      "progressed_lunation",
      cadence,
      estacion.limitations[0] ?? "Necesitamos una hora de nacimiento exacta para ubicar esta etapa de varios años sin inventar una fecha.",
      estacion.limitations
    );
  }
  let avance: Avance = avancePunto(estacion.progress);
  if (estacion.precision === "range") {
    const s = estacion.phaseStartedAtRange;
    const n = estacion.nextPhaseAtRange;
    if (s && n && n.earliest > s.latest && n.latest > s.earliest) {
      avance = avanceRango((observedAt - s.latest) / (n.latest - s.latest), (observedAt - s.earliest) / (n.earliest - s.earliest));
    } else {
      avance = avanceRango(estacion.progress, estacion.progress);
    }
  }
  return {
    key: "progressed_lunation",
    label: ROTULO_DE_ANILLO.progressed_lunation,
    cadence,
    state: estacion.name,
    status: "ready",
    precision: estacion.precision,
    ...avance,
    detail: `La fase actual de tu estación vital es ${estacion.name}.`,
    available: true,
    failed: false,
    limitations: estacion.limitations
  };
}

function anilloTema(tema: TemaDelAno | null): Anillo {
  const cadence = "de cumpleaños a cumpleaños";
  if (!tema) return anilloVacio("annual_profection", cadence, SIN_FUENTE, []);
  if (tema.status !== "ready") {
    return anilloVacio(
      "annual_profection",
      cadence,
      tema.limitations[0] ?? "Necesitamos una hora de nacimiento exacta para saber qué casa de tu carta corresponde a este año.",
      tema.limitations
    );
  }
  return {
    key: "annual_profection",
    label: ROTULO_DE_ANILLO.annual_profection,
    cadence,
    state: `Casa ${tema.house} · mes ${tema.monthIndex} de 12`,
    status: "ready",
    precision: "exact",
    ...avancePunto(tema.progress),
    detail: tema.summary,
    available: true,
    failed: false,
    limitations: tema.limitations
  };
}

function anilloLunar(fuente: RitmoLunarFuente | null): Anillo {
  const cadence = "Cumpleluna personal";
  if (!fuente) return anilloVacio("cumpleluna", cadence, SIN_FUENTE, []);
  const c = fuente.cumpleluna;
  if (!c) {
    return anilloVacio("cumpleluna", cadence, "Necesitamos calcular dos Cumplelunas personales consecutivas para ubicar tu ritmo lunar.", fuente.limitations);
  }
  // Release dibuja como franja toda precisión distinta de `exact`, y la
  // Cumpleluna de main nunca es `exact`: aun con hora natal exacta, la
  // ventana del día del ciclo sale de la variación de velocidad de la Luna y
  // tiene ancho real. El punto queda sólo como resguardo para una ventana
  // degenerada (arco cero).
  const enRango = c.cycleDayWindowDays.to > c.cycleDayWindowDays.from;
  const state = enRango
    ? `Día entre ${d1(Math.max(0, c.cycleDayWindowDays.from))} y ${d1(Math.max(0, c.cycleDayWindowDays.to))} de ${d1(c.cycleLengthDays)}`
    : `Día ${d1(c.cycleDay)} de ${d1(c.cycleLengthDays)}`;
  const faltan = enRango
    ? `Faltan entre ${d1(Math.max(0, c.daysRemainingWindowDays.from))} y ${d1(Math.max(0, c.daysRemainingWindowDays.to))} días para tu próxima Cumpleluna personal.`
    : Math.max(0, Math.ceil(c.daysRemaining)) < 1
      ? "Tu próxima Cumpleluna personal es hoy."
      : Math.max(0, Math.ceil(c.daysRemaining)) === 1
        ? "Falta 1 día para tu próxima Cumpleluna personal."
        : `Faltan ${Math.max(0, Math.ceil(c.daysRemaining))} días para tu próxima Cumpleluna personal.`;
  const avance = enRango && c.cycleLengthDays > 0 ? avanceRango(c.cycleDayWindowDays.from / c.cycleLengthDays, c.cycleDayWindowDays.to / c.cycleLengthDays) : avancePunto(c.cycleFraction);
  return {
    key: "cumpleluna",
    label: ROTULO_DE_ANILLO.cumpleluna,
    cadence,
    state,
    status: "ready",
    precision: c.precision,
    ...avance,
    detail: `${faltan} Este ritmo va de una repetición de tu ángulo natal Sol–Luna a la siguiente.`,
    available: true,
    failed: false,
    limitations: fuente.limitations
  };
}

/** Los rótulos de fase de release (`transitStateLabel`); sin hora del exacto no hay fase. */
export function etiquetaDeFase(row: Pick<TransitPanoramaRow, "phase">): string {
  if (row.phase === "exacto") return "máxima precisión";
  if (row.phase === "acercandose") return "se acerca";
  if (row.phase === "integrandose") return "sigue activo después del punto más preciso";
  return "sin hora exacta";
}

/** Posición de «ahora» dentro de la ventana del tránsito (0 al empezar, 1 al terminar), o `null`. */
export function avanceDelTransito(row: Pick<TransitPanoramaRow, "startTime" | "endTime">, ahora: string | null | undefined): number | null {
  const inicio = parseNaiveTime(row.startTime);
  const fin = parseNaiveTime(row.endTime);
  const now = parseNaiveTime(ahora);
  if (inicio === null || fin === null || now === null || fin <= inicio) return null;
  return clamp01((now - inicio) / (fin - inicio));
}

const SIN_TRANSITO = "No hay un contacto entre el cielo de hoy y tu carta lo bastante cercano como para seguirlo como un proceso.";
const LIMITE_DEL_TRANSITO = "La exactitud geométrica no garantiza el momento de mayor intensidad subjetiva.";

function anilloTransito(panorama: TransitPanorama | null, ahora: string | null | undefined): Anillo {
  const cadence = "dura días o semanas";
  if (!panorama) return anilloVacio("transit_arc", cadence, SIN_FUENTE, []);
  if (panorama.status !== "ready" || panorama.rows.length === 0) return anilloVacio("transit_arc", cadence, SIN_TRANSITO, [], "Sin tránsito activo");
  const row = panorama.rows[0];
  const avance = avanceDelTransito(row, ahora);
  return {
    key: "transit_arc",
    label: ROTULO_DE_ANILLO.transit_arc,
    cadence: row.cadence ?? cadence,
    state: `${row.transitPlanet} con tu ${row.natalPoint} · ${etiquetaDeFase(row)}`,
    status: "ready",
    precision: avance === null ? "estimated" : "exact",
    ...(avance === null ? SIN_AVANCE : avancePunto(avance)),
    detail: row.body,
    available: true,
    failed: false,
    limitations: avance === null ? [LIMITE_DEL_TRANSITO, "Sin las horas de esta ventana, el avance del contacto no se ubica dentro de ella."] : [LIMITE_DEL_TRANSITO]
  };
}

export function buildCuatroRitmos(args: {
  observedAt: number;
  /** Hora natal exacta: define si los avances son puntos o franjas. */
  exact: boolean;
  /** `null` = la fuente falló hoy (no «no aplica»). */
  estacion: EstacionVital | null;
  tema: TemaDelAno | null;
  lunar: RitmoLunarFuente | null;
  transito: TransitPanorama | null;
  /** «Ahora» en la zona natal, `YYYY-MM-DD HH:mm`, como `naiveNowIn`: ubica el tránsito en su ventana. */
  transitNow?: string | null;
}): CuatroRitmos {
  const rings = [anilloEstacion(args.estacion, args.observedAt), anilloTema(args.tema), anilloLunar(args.lunar), anilloTransito(args.transito, args.transitNow)];
  return {
    status: "ready",
    exact: args.exact,
    rings,
    availableCount: rings.filter((r) => r.available).length,
    summary: SUMMARY_DEL_MANDALA,
    observedAt: args.observedAt
  };
}
