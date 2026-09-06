/**
 * Tránsitos · AHORA — el panorama del cielo de hoy (CORE-207).
 *
 * Deriva, de la lectura persistida del día, la lista completa de contactos
 * activos con lo que hace falta para ordenarlos y dibujarlos: identidad
 * (`transitId`, la misma que abre `transits.getDetail`), cuerpos, aspecto,
 * casa natal, ventana, fase respecto del punto exacto y una cercanía medida en
 * TIEMPO. Es puro: recibe el payload y la fecha canónica y devuelve un sobre
 * serializable; nada llama al proveedor.
 *
 * Qué NO se inventa: el proveedor diario no publica el orbe en grados ni la
 * posición del planeta, así que acá no hay `0°43'` ni un puntaje. La cercanía
 * se mide contra `exactTime` con la resolución que el proveedor da (minutos,
 * sin zona), y la fila lo declara: «cercanía al punto exacto en el tiempo».
 *
 * El ORDEN no es de este módulo: es el del backend (`selectRelevantTransits`,
 * pesos fijos por planeta en tránsito, punto natal y aspecto, más uno con hora
 * exacta). Lo que la pantalla explique del orden tiene que describir eso.
 */
import {
  assignTransitIds,
  asArray,
  asRecord,
  normalizedTransitFromValue,
  RANKED_TRANSITS_LIMIT,
  transitCadence,
  type NormalizedAstroTransit
} from "./orbita";

export type TransitPhase = "acercandose" | "exacto" | "integrandose";

export type TransitPanoramaRow = {
  transitId: string;
  rank: number;
  /** `"Luna trígono tu Marte"` */
  title: string;
  /** `"LUNA"` · `"MARTE"`: planeta en tránsito y punto natal, para la línea mono. */
  transitPlanet: string;
  natalPoint: string;
  aspectType: string;
  aspectEs: string;
  /** Ángulo del aspecto mayor, en grados; `null` si no es uno de los cinco. */
  aspectAngle: number | null;
  natalHouse: number | null;
  /** Fase respecto del punto exacto, si `exactTime` se pudo leer. */
  phase: TransitPhase | null;
  /** `EXACTO HOY` · `PICO MAÑANA` · `PICO EN 2 DÍAS` · `PICO HACE 3 DÍAS`; `null` sin hora exacta. */
  peakLabel: string | null;
  /** 0–1: 1 en el punto exacto, 0 en el borde de la ventana. `null` si falta ventana o exacto. */
  closeness: number | null;
  /** `Cambia dentro del día` · `Dura 5 días`; `undefined` sin ventana. */
  cadence?: string;
  /** Una oración honesta sobre el contacto y su fase. */
  body: string;
  startTime: string | null;
  exactTime: string | null;
  endTime: string | null;
};

export type TransitPanorama =
  | {
      status: "ready";
      localDate: string;
      count: number;
      rows: TransitPanoramaRow[];
      /** Cuántos aspectos mayores publicó el proveedor para hoy (`transitTotals.major`); la lista se corta en `RANKED_TRANSITS_LIMIT`. `null` en documentos anteriores, que no guardaron el total. */
      activeTotal: number | null;
      cadence: "Cambia a diario";
      access: { isPro: true; personalized: true };
    }
  | { status: "empty"; localDate: string; access: { isPro: true; personalized: true } }
  | { status: "locked"; localDate: string; access: { isPro: false; personalized: false } };

const ASPECT_ANGLES: Record<string, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180
};

/**
 * Parsea la hora del proveedor (`2026-09-05T14:30`, sin zona) como instante
 * «ingenuo»: los componentes se leen tal cual, sin desplazarlos por la zona del
 * deployment. Sirve para comparar entre sí horas escritas en la misma zona
 * local del proveedor. Acepta también `YYYY-MM-DD HH:mm[:ss]` y una fecha sola.
 */
export function parseNaiveTime(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)];
  const ms = Date.UTC(y, mo - 1, d, h, mi, s);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return ms;
}

/** Diferencia en días civiles entre la fecha del exacto y `localDate` (positivo = futuro). */
export function daysUntilExact(exactTime: string | null, localDate: string): number | null {
  const exact = parseNaiveTime(exactTime);
  const day = parseNaiveTime(localDate);
  if (exact === null || day === null) return null;
  const exactDay = Date.UTC(new Date(exact).getUTCFullYear(), new Date(exact).getUTCMonth(), new Date(exact).getUTCDate());
  return Math.round((exactDay - day) / 86_400_000);
}

export function peakLabelFor(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return "EXACTO HOY";
  if (days === 1) return "PICO MAÑANA";
  if (days === -1) return "PICO AYER";
  if (days > 1) return `PICO EN ${days} DÍAS`;
  return `PICO HACE ${Math.abs(days)} DÍAS`;
}

export function phaseFor(days: number | null): TransitPhase | null {
  if (days === null) return null;
  if (days === 0) return "exacto";
  return days > 0 ? "acercandose" : "integrandose";
}

/**
 * «Ahora» en la zona de la lectura, escrito como la hora del proveedor
 * (`YYYY-MM-DDTHH:mm`, sin zona) para poder compararlo con `exactTime`. Sin
 * zona válida devuelve `null` y la cercanía cae al mediodía de `localDate`.
 */
export function naiveNowIn(timezone: string | undefined, at: Date = new Date()): string | null {
  if (!timezone) return null;
  try {
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(at);
    const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})/.exec(parts);
    return m ? `${m[1]}T${m[2] === "24" ? "00" : m[2]}:${m[3]}` : null;
  } catch {
    return null;
  }
}

/**
 * Cercanía 0–1 medida en tiempo: la distancia entre «ahora» (`now`, en la zona
 * de la lectura; si falta, el mediodía de `localDate`) y `exactTime`, sobre la
 * mitad de la ventana del contacto. Sin ventana no hay escala y se devuelve
 * `null`: nunca un valor por defecto que parezca medido.
 */
export function closenessFor(
  transit: Pick<NormalizedAstroTransit, "startTime" | "exactTime" | "endTime">,
  localDate: string,
  now?: string | null
): number | null {
  const exact = parseNaiveTime(transit.exactTime);
  const start = parseNaiveTime(transit.startTime);
  const end = parseNaiveTime(transit.endTime);
  const day = parseNaiveTime(localDate);
  if (exact === null || start === null || end === null || day === null || end <= start) return null;
  const reference = parseNaiveTime(now) ?? day + 12 * 3_600_000;
  const half = Math.max((end - start) / 2, 12 * 3_600_000);
  const distance = Math.abs(exact - reference);
  return Math.max(0, Math.min(1, 1 - distance / half));
}

function transitTitle(transit: NormalizedAstroTransit): string {
  return `${transit.transitPlanetEs} ${transit.aspectTypeEs} tu ${transit.natalPointEs}`;
}

function bodyFor(transit: NormalizedAstroTransit, phase: TransitPhase | null, angle: number | null): string {
  const contacto = angle === null ? "un contacto" : `un contacto de ${angle}°`;
  const base = `${transit.transitPlanetEs} y tu ${transit.natalPointEs} forman ${aspectoConArticulo(transit.aspectTypeEs)}, ${contacto}.`;
  if (phase === "acercandose") return `${base} Todavía se está acercando al punto más preciso.`;
  if (phase === "integrandose") return `${base} El punto más preciso ya pasó, pero el contacto sigue activo dentro de su ventana.`;
  if (phase === "exacto") return `${base} Hoy pasa por su punto más preciso.`;
  return `${base} El proveedor no publicó la hora exacta de este contacto.`;
}

function aspectoConArticulo(aspectEs: string): string {
  const femenino = /^(conjunci|cuadratura|oposici)/i.test(aspectEs);
  return `${femenino ? "una" : "un"} ${aspectEs}`;
}

/**
 * Los contactos del día con identidad. Las lecturas nuevas ya traen
 * `rankedTransits` con `transitId` guardado. Para documentos anteriores se
 * recorren los MISMOS candidatos, en el MISMO orden y con la MISMA identidad
 * (`transitIdFor`) que `findTransitInPayload` usa en su vía legacy: no se
 * reordena, porque un reordenamiento cambiaría qué contacto abre cada id
 * cuando hay dos ventanas del mismo par.
 */
export function listRankedTransits(payload: unknown): Array<NormalizedAstroTransit & { transitId: string }> {
  const record = asRecord(payload);
  const stored = asArray(record.rankedTransits)
    .map((value) => ({ transit: normalizedTransitFromValue(value), id: asRecord(value).transitId }))
    .filter((e): e is { transit: NormalizedAstroTransit; id: string } => e.transit !== null && typeof e.id === "string" && e.id.length > 0);
  if (stored.length > 0) return stored.map((e) => ({ ...e.transit, transitId: e.id }));

  const transits = asRecord(record.transits);
  const legacy = [...asArray(record.selectedTransits), transits.highlighted, ...asArray(transits.secondary), record.highlightedTransit]
    .map(normalizedTransitFromValue)
    .filter((t): t is NormalizedAstroTransit => t !== null);
  const seen = new Set<string>();
  const unique = legacy.filter((t) => {
    const key = `${t.transitPlanet}|${t.aspectType}|${t.natalPoint}|${t.exactTime ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return assignTransitIds(unique.slice(0, RANKED_TRANSITS_LIMIT));
}

export function buildTransitPanorama(args: {
  payload: unknown;
  localDate: string;
  isPro: boolean;
  /** «Ahora» en la zona de la lectura (`YYYY-MM-DDTHH:mm`); sin él, el mediodía de `localDate`. */
  now?: string | null;
}): TransitPanorama {
  if (!args.isPro) {
    return { status: "locked", localDate: args.localDate, access: { isPro: false, personalized: false } };
  }
  const ranked = listRankedTransits(args.payload);
  if (ranked.length === 0) {
    return { status: "empty", localDate: args.localDate, access: { isPro: true, personalized: true } };
  }
  const rows: TransitPanoramaRow[] = ranked.map((transit, index) => {
    const days = daysUntilExact(transit.exactTime, args.localDate);
    const phase = phaseFor(days);
    const angle = ASPECT_ANGLES[transit.aspectType] ?? null;
    return {
      transitId: transit.transitId,
      rank: index + 1,
      title: transitTitle(transit),
      transitPlanet: transit.transitPlanetEs.toLocaleUpperCase("es"),
      natalPoint: transit.natalPointEs.toLocaleUpperCase("es"),
      aspectType: transit.aspectType,
      aspectEs: transit.aspectTypeEs,
      aspectAngle: angle,
      natalHouse: transit.natalHouse,
      phase,
      peakLabel: peakLabelFor(days),
      closeness: closenessFor(transit, args.localDate, args.now),
      cadence: transitCadence(transit),
      body: bodyFor(transit, phase, angle),
      startTime: transit.startTime,
      exactTime: transit.exactTime,
      endTime: transit.endTime
    };
  });
  const totals = asRecord(asRecord(args.payload).transitTotals);
  const activeTotal = typeof totals.major === "number" && Number.isFinite(totals.major) ? Math.max(totals.major, rows.length) : null;
  return {
    status: "ready",
    localDate: args.localDate,
    count: rows.length,
    rows,
    activeTotal,
    cadence: "Cambia a diario",
    access: { isPro: true, personalized: true }
  };
}
