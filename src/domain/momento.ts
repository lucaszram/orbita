import type { EstacionVital, EstacionVitalFase, MomentoEstacionVital, MomentoTemaDelAno, TemaDelAno } from "@/services/appRefs";

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

// ---------------------------------------------------------------------------
// Tema del año — la casa de la profección (CORE-210). Copy de Build 30,
// portada de `release/1.0.0` (`yearMeaning`, `yearReading`).
// ---------------------------------------------------------------------------

export const YEAR_DETAIL_EYEBROW = "TEMA DE TU AÑO";
export const YEAR_RULER_HEADING = "QUIÉN RIGE ESTE AÑO";
export const YEAR_DATA_HEADING = "LOS DATOS DEL AÑO";

export const YEAR_TRACE = {
  calculatedDatum:
    "Qué casa de tu carta le toca a tu edad actual, en qué signo empieza esa casa, qué planeta la rige y entre qué fechas corre el año que va de un cumpleaños al siguiente.",
  interpretiveRule:
    "El recorrido arranca en tu Ascendente, avanza una casa por año y vuelve a empezar cada doce años. La casa del año indica en qué área se concentra la lectura; no afirma que algo vaya a ocurrir en esa área."
} as const;

export type YearMeaning = { area: string; meaning: string; action: string };

const YEAR_HOUSE: Record<number, YearMeaning> = {
  1: { area: "cómo arrancás y cómo te presentás", meaning: "El año pone en primer plano lo tuyo: cómo empezás las cosas, qué mostrás primero y qué imagen queda de vos.", action: "Escribí en una línea qué te gustaría que la gente note de vos este año." },
  2: { area: "lo que tenés y lo que valorás", meaning: "El foco cae en lo concreto de todos los días: lo que tenés, lo que usás y a qué le das valor cuando repartís tu tiempo.", action: "Anotá tres cosas tuyas —un objeto, una hora del día, algo que sabés hacer— que quieras cuidar mejor este año." },
  3: { area: "las conversaciones y el entorno cercano", meaning: "Las charlas, los mensajes, los trayectos cortos y lo que aprendés sobre la marcha ocupan más lugar que de costumbre.", action: "Escribí a quién te gustaría escribirle más seguido y mandale un mensaje esta semana." },
  4: { area: "la casa y la gente de confianza", meaning: "El año trabaja puertas adentro: dónde vivís, con quién, y qué necesitás para sentirte en tu lugar.", action: "Elegí un rincón de tu casa y dejalo como te gustaría encontrarlo." },
  5: { area: "lo que hacés por gusto", meaning: "Lo que hacés porque te gusta —crear, jugar, mostrar algo tuyo— pide más espacio del que suele tener.", action: "Reservá una hora por semana para algo que hagas sólo porque te divierte." },
  6: { area: "las rutinas y las tareas de todos los días", meaning: "El año se juega en lo chico: cómo organizás el día, qué tareas se repiten y qué se te acumula.", action: "Elegí una sola rutina y cambiale algo mínimo, para ver si así se sostiene." },
  7: { area: "los vínculos de a dos", meaning: "Los temas de a dos —pareja, socios, acuerdos, la persona con la que trabajás— pasan al frente.", action: "Escribí qué acuerdo, dicho o no dicho, te gustaría revisar con alguien, y buscá el momento de hablarlo." },
  8: { area: "lo compartido y lo que no se muestra", meaning: "Toma peso lo que compartís con pocos y lo que preferís no mostrar: lo que está cambiando de fondo, sin anuncio.", action: "Anotá una cosa que hoy te cueste decir y a quién se la dirías si te animaras." },
  9: { area: "lo que te saca de tu radio habitual", meaning: "Gana lugar lo que amplía: estudiar, viajar, conocer otra manera de hacer las cosas, buscarle sentido a lo que hacés.", action: "Elegí un tema que te dé curiosidad y reservá una tarde para meterte en él." },
  10: { area: "tu dirección y lo que se ve de vos", meaning: "El año mira hacia afuera: en qué dirección va lo que hacés y cómo te ven los que no te conocen de cerca.", action: "Escribí en una línea cómo te gustaría que te describan dentro de un año." },
  11: { area: "la gente y lo que viene", meaning: "La gente con la que te juntás, los proyectos compartidos y lo que viene después ocupan más lugar del habitual.", action: "Elegí una persona o un grupo con quien quieras armar algo y proponé una fecha." },
  12: { area: "lo que se cierra y lo que descansa", meaning: "El año pide cerrar más que abrir: lo que ya terminó, lo que descansa y lo que pasa puertas adentro.", action: "Elegí algo que ya terminó y date un rato para cerrarlo bien: tirar, archivar, avisar." }
};

export function yearMeaning(house: number): YearMeaning | null {
  return Number.isInteger(house) && house >= 1 && house <= 12 ? YEAR_HOUSE[house] : null;
}

type YearStretch = "apertura" | "desarrollo" | "revision" | "cierre";
function yearStretch(monthIndex: number): YearStretch {
  if (monthIndex <= 3) return "apertura";
  if (monthIndex <= 6) return "desarrollo";
  if (monthIndex <= 9) return "revision";
  return "cierre";
}
const YEAR_STRETCH: Record<YearStretch, string> = {
  apertura: "Estás en los primeros meses del año personal: es el tramo en el que el tema aparece y todavía no tiene forma definida.",
  desarrollo: "Estás en el desarrollo del año: el tema ya se nota en lo cotidiano y pide tiempo encima más que ideas nuevas.",
  revision: "Pasaste la mitad del año personal: es el tramo de mirar qué funcionó de lo que probaste y qué conviene acomodar.",
  cierre: "Estás en los últimos meses del año personal: rinde cerrar lo que abriste antes de que el recorrido cambie de casa."
};
const YEAR_MONTH_UNKNOWN = "El cálculo no publicó en qué mes del año personal estás, así que la lectura se apoya en la casa y en su regente.";
const YEAR_PRUDENCE = "Es un foco de todo el año, así que conviene volver sobre él cada tanto en vez de resolverlo de una vez.";
const YEAR_RULER: Record<string, string> = {
  sun: "Pone el foco en lo que querés sostener y en lo que estás dispuesto a mostrar como propio.",
  moon: "Pone el foco en cómo te sentís mientras hacés las cosas, no sólo en cómo salen.",
  mercury: "Pone el foco en cómo nombrás las cosas: lo que conversás, lo que escribís y lo que dejás por escrito.",
  venus: "Pone el foco en los vínculos y en el gusto: con quién y con qué te querés rodear.",
  mars: "Pone el foco en la iniciativa: qué empezás, con cuánta fuerza y a qué ritmo.",
  jupiter: "Pone el foco en abrir: aparece más espacio del habitual y también más de todo.",
  saturn: "Pone el foco en el tiempo y en la estructura: rinde lo que se sostiene, no lo que se apura.",
  uranus: "Pone el foco en cambiar la forma: lo que venía igual empieza a pedir otra manera.",
  neptune: "Pone el foco en lo que no tiene bordes claros: hay más matiz que definición.",
  pluto: "Pone el foco en lo que cambia de raíz, de a poco y sin anuncio."
};
const YEAR_RULER_UNKNOWN = "Es el planeta con el que este método lee cómo se expresan los temas de la casa durante el año.";
const YEAR_QUESTION: Record<number, string> = {
  1: "¿Qué te gustaría que se note de vos este año, sin tener que explicarlo?",
  2: "¿Qué de lo que ya tenés estás usando poco?",
  3: "¿Con quién te gustaría hablar más seguido este año?",
  4: "¿Qué te falta para sentirte en tu lugar donde vivís?",
  5: "¿Cuándo fue la última vez que hiciste algo sólo porque te divertía?",
  6: "¿Qué parte de tu día se repite sin que la hayas elegido?",
  7: "¿Qué acuerdo tuyo con otra persona nunca se dijo en voz alta?",
  8: "¿Qué estás cambiando de fondo que todavía no le contaste a nadie?",
  9: "¿Qué te daría curiosidad aprender si tuvieras el tiempo?",
  10: "¿Cómo te gustaría que te describa alguien que te conoce poco?",
  11: "¿Con quiénes querés construir lo que viene?",
  12: "¿Qué venís arrastrando que ya podría darse por terminado?"
};

export type YearReading = { now: string; theme: string; ruler: string; month: string; use: string; question: string };

/** El tema del año, desarrollado. `null` para una casa que el método no tiene. */
export function yearReading(input: { house: number; ruler: string; rulerKey: string; monthIndex: number }): YearReading | null {
  const base = yearMeaning(input.house);
  if (!base) return null;
  const mes = Number.isInteger(input.monthIndex) && input.monthIndex >= 1 && input.monthIndex <= 12 ? input.monthIndex : null;
  const regente = YEAR_RULER[input.rulerKey] ?? YEAR_RULER_UNKNOWN;
  return {
    now: `Tu año personal corre por tu casa ${input.house}${mes === null ? "." : `, y vas por el mes ${mes} de 12.`}${mes === null ? "" : ` ${YEAR_STRETCH[yearStretch(mes)]}`}`,
    theme: base.meaning,
    ruler: `El regente de este año es ${input.ruler}. ${regente}`,
    month: mes === null ? YEAR_MONTH_UNKNOWN : YEAR_STRETCH[yearStretch(mes)],
    use: `${base.action} ${YEAR_PRUDENCE}`,
    question: YEAR_QUESTION[input.house]
  };
}

/** `Casa 6 · rutinas, tareas y organización cotidiana` (el tema corto de la casa, para el titular). */
export function tituloDelAno(tema: Extract<TemaDelAno, { status: "ready" }>): string {
  return `Casa ${tema.house} · ${tema.houseTheme}`;
}

/** `MES 10 DE 12 · REGENTE DEL AÑO: MERCURIO` */
export function subtituloDelAno(tema: Extract<TemaDelAno, { status: "ready" }>): string {
  return `MES ${tema.monthIndex} DE 12 · REGENTE DEL AÑO: ${tema.ruler.toLocaleUpperCase("es")}`;
}

/** `Casa 6 · mes 10 de 12` para la tarjeta del hub. */
export function resumenDelAno(tema: Extract<TemaDelAno, { status: "ready" }>): string {
  return `Casa ${tema.house} · mes ${tema.monthIndex} de 12`;
}

/** `11 NOV` en la zona natal. */
export function diaMes(ms: number, timeZone?: string): string {
  if (!Number.isFinite(ms)) return "—";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? "UTC", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
    const day = Number(parts.find((p) => p.type === "day")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    return `${day} ${MESES_CORTOS[month - 1] ?? "—"}`;
  } catch {
    const d = new Date(ms);
    return `${d.getUTCDate()} ${MESES_CORTOS[d.getUTCMonth()]}`;
  }
}

export type TemaEstado =
  | { kind: "cargando" }
  | { kind: "error" }
  | { kind: "bloqueado" }
  | { kind: "sin_datos"; tema: Exclude<TemaDelAno, { status: "ready" }> }
  | { kind: "listo"; tema: Extract<TemaDelAno, { status: "ready" }>; timezone: string | null };

export function estadoDeTema(value: MomentoTemaDelAno | null | undefined): TemaEstado {
  if (!value || typeof value !== "object" || !("status" in value)) return { kind: "error" };
  if (value.status === "locked") return { kind: "bloqueado" };
  if (value.status === "ready") {
    if (value.tema.status === "ready") return { kind: "listo", tema: value.tema, timezone: value.timezone ?? null };
    return { kind: "sin_datos", tema: value.tema };
  }
  return { kind: "error" };
}

export function copyDeSinTema(tema: Exclude<TemaDelAno, { status: "ready" }>): { titulo: string; cuerpo: string } {
  switch (tema.status) {
    case "needs_birth_data":
      return { titulo: "Falta tu fecha de nacimiento.", cuerpo: tema.limitations[0] ?? "" };
    case "needs_birth_time":
      return { titulo: "Hace falta tu hora exacta.", cuerpo: tema.limitations[0] ?? "El Ascendente define desde dónde arranca el recorrido." };
    case "needs_natal_chart":
      return { titulo: "Primero, tu carta.", cuerpo: tema.limitations[0] ?? "" };
    default:
      return { titulo: "No pudimos ubicar tu año personal.", cuerpo: tema.limitations[0] ?? "Probá de nuevo en un momento." };
  }
}
