import type { EstacionVital, EstacionVitalFase, MomentoEstacionVital } from "@/services/appRefs";

/**
 * Tu momento — cómo se lee la estación vital en pantalla (CORE-209).
 *
 * La copy es la de la línea `release/1.0.0` (`src/domain/layerMeaning.ts` y
 * `src/domain/layerReading.ts`, autoridad Build 30), portada tal cual: el
 * verbo y el tema de cada fase, qué se abre y qué se cierra, la acción con su
 * recordatorio de escala y la pregunta. Los números salen del cálculo, nunca
 * de acá. Ver `test/momento.test.ts`.
 */

export const SEASON_DETAIL_EYEBROW = "TU ESTACIÓN VITAL";
export const READING_NOW_HEADING = "QUÉ MARCA AHORA";
export const READING_THEME_HEADING = "QUÉ PONE AL FRENTE";
export const SEASON_CYCLE_HEADING = "QUÉ SE ABRE Y QUÉ SE CIERRA";
export const READING_USE_HEADING = "CÓMO USARLO";
export const READING_QUESTION_HEADING = "PARA OBSERVAR";
export const SEASON_DATA_HEADING = "LOS DATOS DE LA FASE";

export const SEASON_TRACE = {
  calculatedDatum:
    "El ángulo entre el Sol y la Luna progresados a tu edad de hoy, la fase del ciclo en la que cae ese ángulo, y cuándo empieza y cuándo termina esa fase.",
  interpretiveRule:
    "El ciclo entre el Sol y la Luna se divide en ocho fases iguales y cada una se lee como una etapa del mismo proceso largo. La fase describe el tramo del recorrido en el que estás; no fija un plazo ni anticipa un hecho."
} as const;

export type SeasonVerb = "iniciar" | "sostener" | "decidir" | "ajustar" | "mostrar" | "compartir" | "reordenar" | "cerrar";

export type SeasonMeaning = {
  verb: SeasonVerb;
  theme: string;
  meaning: string;
  action: string;
};

const SEASON: Record<EstacionVitalFase, SeasonMeaning> = {
  new: {
    verb: "iniciar",
    theme: "un comienzo que todavía no tiene forma",
    meaning:
      "Estás en el arranque de un ciclo largo. Lo que empieza acá se parece más a una intuición que a un plan, y eso es esperable: recién se está armando.",
    action: "Elegí una sola cosa nueva para probar este mes y escribí por qué te interesa."
  },
  crescent: {
    verb: "sostener",
    theme: "sostener lo que ya empezó",
    meaning:
      "Lo que arrancó necesita continuidad, no ideas nuevas. Es la etapa en la que se ve si algo se sostiene cuando deja de ser novedad.",
    action: "Elegí lo que ya está en marcha y definí cómo lo vas a sostener las próximas semanas."
  },
  first_quarter: {
    verb: "decidir",
    theme: "la primera decisión de fondo",
    meaning:
      "Aparece la primera resistencia real y con ella algo para elegir. Es un tramo de fricción, y la fricción acá es parte del proceso, no una señal de que salió mal.",
    action: "Escribí la decisión que venís postergando y ponele una fecha para tomarla."
  },
  gibbous: {
    verb: "ajustar",
    theme: "corregir antes de que se vea",
    meaning:
      "Ya hay algo armado y lo que pide es corrección fina. Todavía no es el momento de mostrarlo entero: es el de acomodar lo que no termina de encajar.",
    action: "Elegí un detalle que no te cierra y ajustalo este mes."
  },
  full: {
    verb: "mostrar",
    theme: "lo que venías haciendo se vuelve visible",
    meaning:
      "Es la parte del ciclo en la que lo que hiciste se hace visible, con lo bueno y lo incómodo de que se vea. Lo que estaba a medias también se nota.",
    action: "Mostrale a alguien algo en lo que venías trabajando en silencio."
  },
  disseminating: {
    verb: "compartir",
    theme: "contar lo aprendido",
    meaning: "Lo que aprendiste en la subida se vuelve algo para contar. La etapa rinde más en conversación que en soledad.",
    action: "Contale a alguien qué aprendiste de esta etapa. Una charla alcanza."
  },
  last_quarter: {
    verb: "reordenar",
    theme: "revisar lo que ya no encaja",
    meaning:
      "Empieza la revisión: lo que ya no encaja se nota más que lo que funciona. Es un tramo de ordenar, no de arrancar cosas nuevas.",
    action: "Hacé una lista de lo que dejarías de hacer y elegí una sola cosa para soltar."
  },
  balsamic: {
    verb: "cerrar",
    theme: "cerrar antes del próximo comienzo",
    meaning:
      "El ciclo se está cerrando y lo que viene todavía no se ve. Es normal que baje el ritmo: es la parte del recorrido con menos ruido.",
    action: "Dejá un espacio libre en tu semana y anotá qué querés dejar afuera del próximo ciclo."
  }
};

const SEASON_CYCLE: Record<EstacionVitalFase, { opens: string; closes: string; question: string }> = {
  new: {
    opens: "Se abre un ciclo entero: hay lugar para probar cosas que todavía no tienen nombre ni forma definida.",
    closes: "Se termina de cerrar el ciclo anterior, con lo que quedó bien y con lo que quedó a medias.",
    question: "¿Qué estás empezando que todavía no le contaste a nadie?"
  },
  crescent: {
    opens: "Se abre la posibilidad de que lo que empezaste tome forma propia y deje de depender de las ganas del primer día.",
    closes: "Se cierra el permiso de la novedad: lo que arrancó ya no se sostiene solo por ser nuevo.",
    question: "¿Qué de lo que empezaste seguiría en pie si hoy dejara de entusiasmarte?"
  },
  first_quarter: {
    opens: "Se abre una decisión concreta: hay dos caminos y este tramo es el que pide elegir uno.",
    closes: "Se cierra la etapa de tener todas las opciones abiertas al mismo tiempo.",
    question: "¿Qué decisión venís postergando con el argumento de que todavía no es el momento?"
  },
  gibbous: {
    opens: "Se abre el margen para corregir: todavía se puede acomodar lo que no encaja sin rehacerlo entero.",
    closes: "Se cierra el tiempo de armar a puertas cerradas: lo que sigue ya se ve desde afuera.",
    question: "¿Qué detalle sabés que no está bien y venís dejando pasar?"
  },
  full: {
    opens: "Se abre la visibilidad: lo que venías haciendo se nota, y con eso llegan devoluciones que antes no había.",
    closes: "Se cierra la parte privada del proceso, la de trabajar sin que nadie opine.",
    question: "¿Qué se ve hoy de lo que hacés, y qué preferirías que se viera?"
  },
  disseminating: {
    opens: "Se abre la conversación: lo que aprendiste rinde más contado que guardado.",
    closes: "Se cierra la parte de subida del ciclo; lo que faltaba mostrar ya se mostró.",
    question: "¿A quién le serviría lo que aprendiste en esta etapa?"
  },
  last_quarter: {
    opens: "Se abre la revisión: se distingue con claridad qué te sirve y qué venís cargando por costumbre.",
    closes: "Se cierran compromisos que ya cumplieron su función y siguen ocupando lugar.",
    question: "¿Qué seguís sosteniendo sólo porque lo empezaste vos?"
  },
  balsamic: {
    opens: "Se abre un espacio vacío a propósito, el que necesita el ciclo que todavía no empezó.",
    closes: "Se cierra el ciclo entero: lo que quedó afuera ya no entra en esta vuelta.",
    question: "¿Qué parte de esta etapa querés dar por terminada antes de empezar otra?"
  }
};

const SEASON_PRUDENCE = "Es un movimiento de escala mensual: la fase dura unos 3,7 años y no se resuelve en una semana.";
const SEASON_WITHOUT_TIME =
  "Sin tu hora exacta de nacimiento el borde de esta fase se calcula con un margen: lo que se afirma es la etapa, no el día en que empezó.";

export function seasonMeaning(phaseKey: EstacionVitalFase): SeasonMeaning {
  return SEASON[phaseKey] ?? SEASON.new;
}

export type SeasonReading = {
  now: string;
  theme: string;
  opens: string;
  closes: string;
  use: string;
  question: string;
  caveat: string | null;
};

/** La estación vital, desarrollada: fase, qué se abre y qué se cierra, acción prudente. */
export function seasonReading(input: { phaseKey: EstacionVitalFase; phaseName: string; exact: boolean }): SeasonReading {
  const base = seasonMeaning(input.phaseKey);
  const ciclo = SEASON_CYCLE[input.phaseKey] ?? SEASON_CYCLE.new;
  const fase = input.phaseName.trim().toLocaleLowerCase("es");
  return {
    now: `Estás en la fase ${fase} de tu ciclo progresado: la etapa de ${base.verb} dentro de un recorrido de unos 30 años.`,
    theme: base.meaning,
    opens: ciclo.opens,
    closes: ciclo.closes,
    use: `${base.action} ${SEASON_PRUDENCE}`,
    question: ciclo.question,
    caveat: input.exact ? null : SEASON_WITHOUT_TIME
  };
}

/** `Etapa de iniciar: un comienzo que todavía no tiene forma.` */
export function seasonHeadline(phaseKey: EstacionVitalFase): string {
  const base = seasonMeaning(phaseKey);
  return `Etapa de ${base.verb}: ${base.theme}.`;
}

// ---------------------------------------------------------------------------
// Números y fechas, sin inventar precisión
// ---------------------------------------------------------------------------

const MESES_CORTOS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

/** `DIC 2025` en la zona dada (o UTC). */
export function mesAno(ms: number, timeZone?: string): string {
  const d = new Date(ms);
  if (!Number.isFinite(ms)) return "—";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? "UTC", year: "numeric", month: "2-digit" }).formatToParts(d);
    const year = parts.find((p) => p.type === "year")?.value ?? "";
    const month = Number(parts.find((p) => p.type === "month")?.value);
    return `${MESES_CORTOS[month - 1] ?? "—"} ${year}`;
  } catch {
    return `${MESES_CORTOS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
}

/** Coma decimal con un decimal: `3,7`. */
export function decimalEs(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(decimals).replace(".", ",");
}

/** `año 0,6 de 3,7` */
export function anoDeFase(estacion: Extract<EstacionVital, { status: "ready" }>): string {
  return `año ${decimalEs(estacion.yearsIntoPhase)} de ${decimalEs(estacion.phaseYears)}`;
}

/** `ETAPA VITAL · ~3,7 AÑOS` */
export function etiquetaDeEtapa(estacion: Extract<EstacionVital, { status: "ready" }>): string {
  return `ETAPA VITAL · ~${decimalEs(estacion.phaseYears)} AÑOS`;
}

/** `8,5°` */
export function anguloProgresado(estacion: Extract<EstacionVital, { status: "ready" }>): string {
  return `${decimalEs(estacion.progressedElongationDegrees)}°`;
}

/** Fecha de un borde: exacta (`DIC 2025`) o rango (`NOV–DIC 2025`) cuando el cálculo la publica así. */
export function bordeDeFase(ms: number, range: { earliest: number; latest: number } | undefined, timeZone?: string): string {
  if (!range) return mesAno(ms, timeZone);
  const a = mesAno(range.earliest, timeZone);
  const b = mesAno(range.latest, timeZone);
  return a === b ? a : `${a} – ${b}`;
}

/** Estado de pantalla a partir del sobre. */
export type EstacionEstado =
  | { kind: "cargando" }
  | { kind: "error" }
  | { kind: "bloqueado" }
  | { kind: "sin_datos"; estacion: Exclude<EstacionVital, { status: "ready" }> }
  | { kind: "listo"; estacion: Extract<EstacionVital, { status: "ready" }>; localDate: string; timezone: string | null };

export function estadoDeEstacion(value: MomentoEstacionVital | null | undefined): EstacionEstado {
  if (!value || typeof value !== "object" || !("status" in value)) return { kind: "error" };
  if (value.status === "locked") return { kind: "bloqueado" };
  if (value.status === "ready") {
    if (value.estacion.status === "ready") return { kind: "listo", estacion: value.estacion, localDate: value.localDate, timezone: value.timezone ?? null };
    return { kind: "sin_datos", estacion: value.estacion };
  }
  return { kind: "error" };
}

/** Título y cuerpo honestos para cada estado sin fase. */
export function copyDeSinDatos(estacion: Exclude<EstacionVital, { status: "ready" }>): { titulo: string; cuerpo: string } {
  switch (estacion.status) {
    case "needs_birth_data":
      return { titulo: "Falta tu fecha de nacimiento.", cuerpo: estacion.limitations[0] ?? "Sin fecha no hay ciclo progresado que calcular." };
    case "needs_birth_time":
      return { titulo: "Hace falta tu hora exacta.", cuerpo: estacion.limitations[0] ?? "La hora natal define la fase." };
    case "partial":
      return {
        titulo: estacion.possiblePhases && estacion.possiblePhases.length > 1 ? `Puede ser ${estacion.possiblePhases.join(" o ")}.` : "La fase no se puede certificar.",
        cuerpo: estacion.limitations.join(" ")
      };
    case "not_configured":
      return { titulo: "El cálculo no está disponible en este entorno.", cuerpo: estacion.limitations[0] ?? "" };
    default:
      return { titulo: "No pudimos calcular tu estación vital.", cuerpo: estacion.limitations[0] ?? "Probá de nuevo en un momento." };
  }
}
