import { formatDecimal } from "@/domain/layers";
import {
  cumplelunaStage,
  moonHouseAction,
  moonHouseNotice,
  moonPhaseAction,
  moonPhaseClimate,
  seasonMeaning,
  yearMeaning
} from "@/domain/layerMeaning";
import type { LunarPhaseKey } from "@/services/layersApi";

/**
 * La LECTURA de cada ritmo: la jerarquía editorial que comparten los cuatro
 * detalles de `Tu momento` (QA22-024, QA22-025, QA22-026).
 *
 * ## El defecto que cierra
 *
 * `Tu momento` mostraba nombres y estados —`Gibosa`, `Casa 11`, `día 12 de
 * 29,5`, `Luna en Sagitario`— y, como mucho, una frase. Los desplegables
 * técnicos explicaban el CÁLCULO, que es otra cosa: responden por qué existe el
 * dato, no qué significa para esta persona. Y donde sí había texto, repetía la
 * etiqueta en vez de interpretarla (`Priorizá: lo de tu casa 11: la gente y lo
 * que viene`).
 *
 * ## La jerarquía, y por qué es siempre la misma
 *
 * Los cuatro ritmos se leen en cuatro pasos, en este orden:
 *
 * 1. **qué marca ahora** (`now`) — la síntesis de apertura, con el dato de esta
 *    persona ya adentro;
 * 2. **qué tema personal pone al frente** (`theme`) — la interpretación, no la
 *    etiqueta;
 * 3. **cómo usarlo** (`use`) — un gesto chico, seguro y a la escala del ciclo;
 * 4. **una pregunta para observar** (`question`) — lo que deja decidir a quien
 *    lee, en vez de ordenarle.
 *
 * Los números, el método y la trazabilidad van DESPUÉS, como fundamento. Ése es
 * el orden que las cuatro pantallas dibujan y el que las pruebas fijan: si un
 * detalle nuevo entra a la sección, entra con esta forma.
 *
 * `caveat` es la quinta pieza y sólo aparece cuando hace falta: es el límite del
 * dato —falta de hora, avance que sólo se puede acotar— dicho una vez y en el
 * lugar donde cambia lo que se afirma.
 *
 * ## Qué NO hace
 *
 * Lo mismo que `layerMeaning`, del que sale todo el vocabulario base: tablas
 * fijas y composición determinística. Sin LLM, sin azar, sin reloj, sin red y
 * sin backend nuevo. La misma entrada devuelve exactamente el mismo texto.
 *
 * Y no inventa datos: sin casa no se nombra ninguna, sin hora exacta no se
 * afirma un día del ciclo, y un signo o un regente que la tabla no conoce cae en
 * una frase que dice lo que sí se sabe.
 */

// ---------------------------------------------------------------------------
// La forma común
// ---------------------------------------------------------------------------

/** Los cuatro pasos que comparten los cuatro detalles, más su límite. */
export type LayerReading = {
  /** Qué marca ahora: la síntesis de apertura, con el dato propio adentro. */
  now: string;
  /** Qué tema personal pone al frente. Interpreta; no repite la etiqueta. */
  theme: string;
  /** Cómo usarlo: un gesto chico y seguro, a la escala del ciclo. */
  use: string;
  /** Una pregunta para observar. Siempre termina en signo de pregunta. */
  question: string;
  /**
   * Qué NO se puede afirmar con los datos de hoy.
   *
   * `null` cuando no hay límite que declarar. Nunca es un descargo genérico: se
   * escribe sólo para el caso que lo produce (falta de hora, avance acotado) y
   * en el lugar donde cambia lo que la pantalla afirma.
   */
  caveat: string | null;
};

/** Los rótulos de la jerarquía. Viven acá para que pantalla y prueba coincidan. */
export const READING_NOW_HEADING = "QUÉ MARCA AHORA";
export const READING_THEME_HEADING = "QUÉ PONE AL FRENTE";
export const READING_USE_HEADING = "CÓMO USARLO";
export const READING_QUESTION_HEADING = "PARA OBSERVAR";

/** El bloque propio de la estación vital: qué se abre y qué se cierra. */
export const SEASON_CYCLE_HEADING = "QUÉ SE ABRE Y QUÉ SE CIERRA";
/** El bloque propio del año: el planeta con el que el método lee la casa. */
export const YEAR_RULER_HEADING = "QUIÉN RIGE ESTE AÑO";
/** El bloque propio de la Luna: qué se abre y qué conviene mirar hoy. */
export const MOON_TENSION_HEADING = "POSIBILIDAD Y TENSIÓN";

/** Los rótulos de los dos detalles nuevos, y el de sus datos. */
export const SEASON_DETAIL_EYEBROW = "TU ESTACIÓN VITAL";
export const YEAR_DETAIL_EYEBROW = "TEMA DE TU AÑO";
export const SEASON_DATA_HEADING = "LOS DATOS DE LA FASE";
export const YEAR_DATA_HEADING = "LOS DATOS DEL AÑO";

/**
 * Qué calculó cada análisis y con qué regla se lee, dicho UNA vez.
 *
 * La portada de `Tu momento` y el detalle de cada ritmo montan el mismo
 * `TraceAccordion` sobre el mismo sobre: con el texto escrito en las dos
 * pantallas, corregir una y no la otra deja al producto explicando el mismo
 * cálculo de dos maneras.
 */
export const SEASON_TRACE = {
  calculatedDatum:
    "El ángulo entre el Sol y la Luna progresados a tu edad de hoy, la fase del ciclo en la que cae ese ángulo, y cuándo empieza y cuándo termina esa fase.",
  interpretiveRule:
    "El ciclo entre el Sol y la Luna se divide en ocho fases iguales y cada una se lee como una etapa del mismo proceso largo. La fase describe el tramo del recorrido en el que estás; no fija un plazo ni anticipa un hecho."
} as const;

export const YEAR_TRACE = {
  calculatedDatum:
    "Qué casa de tu carta le toca a tu edad actual, en qué signo empieza esa casa, qué planeta la rige y entre qué fechas corre el año que va de un cumpleaños al siguiente.",
  interpretiveRule:
    "El recorrido arranca en tu Ascendente, avanza una casa por año y vuelve a empezar cada doce años. La casa del año indica en qué área se concentra la lectura; no afirma que algo vaya a ocurrir en esa área."
} as const;

// ---------------------------------------------------------------------------
// Estación vital — las ocho fases de la lunación progresada
// ---------------------------------------------------------------------------

export type SeasonReading = LayerReading & {
  /** Qué se abre en esta fase del ciclo largo. */
  opens: string;
  /** Qué se cierra en esta fase del ciclo largo. */
  closes: string;
};

/**
 * La estación vital, desarrollada: la fase, qué se abre y qué se cierra en ella,
 * y una acción prudente.
 *
 * El nombre de la fase lo trae el cálculo (`Gibosa`, `Balsámica`) y acá se usa
 * tal cual, en minúscula, dentro de la frase: la pantalla lo escribe arriba con
 * su caja original y esta lectura no lo reinventa.
 *
 * La acción sale de `seasonMeaning` —es la misma que la portada— y se cierra
 * con la escala real del ciclo: una fase dura unos 3,7 años, así que un gesto
 * que prometa resolverla en una semana sería mentira sobre el propio método.
 */
export function seasonReading(input: {
  phaseKey: LunarPhaseKey;
  /** El nombre de la fase, tal como lo publica el cálculo. */
  phaseName: string;
  /** El sobre tiene raíz exacta: sin ella, los bordes de la fase son ventanas. */
  exact: boolean;
}): SeasonReading {
  const base = seasonMeaning(input.phaseKey);
  const ciclo = SEASON_CYCLE[input.phaseKey] ?? SEASON_CYCLE.new;
  const fase = input.phaseName.trim().toLocaleLowerCase("es");
  return {
    // El verbo entra y el tema NO: `crescent` tiene el verbo `sostener` y el
    // tema «sostener lo que ya empezó», así que decir los dos en la misma frase
    // repetía la palabra. Lo que agrega la apertura es la escala, que es lo que
    // cambia cómo se lee todo lo demás.
    now: `Estás en la fase ${fase} de tu ciclo progresado: la etapa de ${base.verb} dentro de un recorrido de unos 30 años.`,
    theme: base.meaning,
    opens: ciclo.opens,
    closes: ciclo.closes,
    use: `${base.action} ${SEASON_PRUDENCE}`,
    question: ciclo.question,
    caveat: input.exact ? null : SEASON_WITHOUT_TIME
  };
}

/** El recordatorio de escala. Va pegado a la acción de cualquier fase. */
const SEASON_PRUDENCE =
  "Es un movimiento de escala mensual: la fase dura unos 3,7 años y no se resuelve en una semana.";

/** Sin hora exacta, la fase es firme y su borde no. Se dice ahí, una vez. */
const SEASON_WITHOUT_TIME =
  "Sin tu hora exacta de nacimiento el borde de esta fase se calcula con un margen: lo que se afirma es la etapa, no el día en que empezó.";

const SEASON_CYCLE: Record<LunarPhaseKey, { opens: string; closes: string; question: string }> = {
  new: {
    opens:
      "Se abre un ciclo entero: hay lugar para probar cosas que todavía no tienen nombre ni forma definida.",
    closes: "Se termina de cerrar el ciclo anterior, con lo que quedó bien y con lo que quedó a medias.",
    question: "¿Qué estás empezando que todavía no le contaste a nadie?"
  },
  crescent: {
    opens:
      "Se abre la posibilidad de que lo que empezaste tome forma propia y deje de depender de las ganas del primer día.",
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
    opens:
      "Se abre la visibilidad: lo que venías haciendo se nota, y con eso llegan devoluciones que antes no había.",
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

// ---------------------------------------------------------------------------
// Tema del año — la casa de la profección
// ---------------------------------------------------------------------------

export type YearReading = LayerReading & {
  /** El planeta que rige el año y qué pone en primer plano. */
  ruler: string;
  /** En qué tramo del año personal cae el mes en curso. */
  month: string;
};

/**
 * El tema del año, desarrollado: la casa, el regente, el mes dentro del año y
 * cómo puede vivirse ese foco.
 *
 * Devuelve `null` para una casa que el método no tiene (fuera de 1–12): no hay
 * área que inventar, y quien llama muestra los datos crudos en vez de un texto
 * que afirma algo falso.
 *
 * El regente llega como nombre visible del sobre (`Saturno`) y se resuelve por
 * una clave sin acentos, así que un planeta que la tabla no conozca no rompe el
 * texto: se lo nombra y se dice para qué lo usa el método.
 */
export function yearReading(input: {
  house: number;
  /** El regente del año, con el nombre que publica el sobre. */
  ruler: string;
  /** Mes en curso dentro del año personal, 1–12. */
  monthIndex: number;
  /** El sobre tiene raíz exacta: sin ella, los bordes del año son estimados. */
  exact: boolean;
}): YearReading | null {
  const base = yearMeaning(input.house);
  if (!base) return null;
  const mes = yearMonthIndex(input.monthIndex);
  const regente = YEAR_RULER[bodyKey(input.ruler)] ?? YEAR_RULER_UNKNOWN;
  return {
    // La casa se NOMBRA y no se etiqueta: el área ya está en el título de la
    // pantalla y en la tabla de datos, así que repetirla acá sería la misma
    // frase dos veces y no una lectura (QA22-024). Lo que la interpreta es
    // `theme`.
    now: `Tu año personal corre por tu casa ${input.house}${
      mes === null ? "." : `, y vas por el mes ${mes} de 12.`
    }`,
    theme: base.meaning,
    ruler: `El regente de este año es ${input.ruler}. ${regente}`,
    month: mes === null ? YEAR_MONTH_UNKNOWN : YEAR_STRETCH[yearStretch(mes)],
    use: `${base.action} ${YEAR_PRUDENCE}`,
    question: YEAR_QUESTION[input.house],
    caveat: input.exact ? null : YEAR_WITHOUT_TIME
  };
}

/** El mes dentro del año personal, o `null` si el sobre trae uno imposible. */
function yearMonthIndex(monthIndex: number): number | null {
  if (!Number.isInteger(monthIndex)) return null;
  return monthIndex >= 1 && monthIndex <= 12 ? monthIndex : null;
}

/** Los cuatro tramos del año personal, tres meses cada uno. */
type YearStretch = "apertura" | "desarrollo" | "revision" | "cierre";

function yearStretch(monthIndex: number): YearStretch {
  if (monthIndex <= 3) return "apertura";
  if (monthIndex <= 6) return "desarrollo";
  if (monthIndex <= 9) return "revision";
  return "cierre";
}

const YEAR_STRETCH: Record<YearStretch, string> = {
  apertura:
    "Estás en los primeros meses del año personal: es el tramo en el que el tema aparece y todavía no tiene forma definida.",
  desarrollo:
    "Estás en el desarrollo del año: el tema ya se nota en lo cotidiano y pide tiempo encima más que ideas nuevas.",
  revision:
    "Pasaste la mitad del año personal: es el tramo de mirar qué funcionó de lo que probaste y qué conviene acomodar.",
  cierre:
    "Estás en los últimos meses del año personal: rinde cerrar lo que abriste antes de que el recorrido cambie de casa."
};

/** Un mes fuera de 1–12 no se ubica en ningún tramo, y eso se dice. */
const YEAR_MONTH_UNKNOWN =
  "El cálculo no publicó en qué mes del año personal estás, así que la lectura se apoya en la casa y en su regente.";

/** El recordatorio de escala del año: doce meses, no una semana. */
const YEAR_PRUDENCE =
  "Es un foco de todo el año, así que conviene volver sobre él cada tanto en vez de resolverlo de una vez.";

/** Sin hora exacta no hay profección; con bordes estimados, se dice. */
const YEAR_WITHOUT_TIME =
  "Las fechas de este año se calculan con un margen, así que el cambio de casa no cae en un día exacto.";

/** Con qué mira cada regente los temas de la casa del año. */
const YEAR_RULER: Record<string, string> = {
  sun: "Pone el foco en lo que querés sostener y en lo que estás dispuesto a mostrar como propio.",
  moon: "Pone el foco en cómo te sentís mientras hacés las cosas, no sólo en cómo salen.",
  mercury:
    "Pone el foco en cómo nombrás las cosas: lo que conversás, lo que escribís y lo que dejás por escrito.",
  venus: "Pone el foco en los vínculos y en el gusto: con quién y con qué te querés rodear.",
  mars: "Pone el foco en la iniciativa: qué empezás, con cuánta fuerza y a qué ritmo.",
  jupiter: "Pone el foco en abrir: aparece más espacio del habitual y también más de todo.",
  saturn: "Pone el foco en el tiempo y en la estructura: rinde lo que se sostiene, no lo que se apura.",
  uranus: "Pone el foco en cambiar la forma: lo que venía igual empieza a pedir otra manera.",
  neptune: "Pone el foco en lo que no tiene bordes claros: hay más matiz que definición.",
  pluto: "Pone el foco en lo que cambia de raíz, de a poco y sin anuncio."
};

/** Un regente fuera de tabla se nombra igual, y se dice para qué se lo usa. */
const YEAR_RULER_UNKNOWN =
  "Es el planeta con el que este método lee cómo se expresan los temas de la casa durante el año.";

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

// ---------------------------------------------------------------------------
// Cumpleluna — el ciclo lunar personal
// ---------------------------------------------------------------------------

/**
 * El ciclo lunar personal, dicho como una lectura y no como una etiqueta con
 * números al lado (QA22-025).
 *
 * Abre con `Estás en {etapa}, día {X} de {Y}` **sólo cuando esos dos números son
 * seguros**: con raíz exacta y con valores finitos. Sin hora exacta de
 * nacimiento el día del ciclo es una ventana, y escribir su centro sería
 * inventar un día singular que el método nunca afirmó; ahí la apertura nombra el
 * tramo —que sí se sostiene— y el límite se declara en `caveat`.
 *
 * El tema conecta las tres piezas que la pantalla ya tenía sueltas: el tramo del
 * recorrido, el avance dentro de él y el dato lunar de nacimiento que define de
 * dónde se cuenta el ciclo.
 */
export function cumplelunaReading(input: {
  /** El avance 0–1 con el que se elige el tramo. */
  progress: number;
  /** El día del ciclo que publica el sobre. */
  cycleDay: number;
  /** El largo del ciclo que publica el sobre, en días. */
  cycleLength: number;
  /** El sobre tiene raíz exacta: sin ella, cada número es una ventana. */
  exact: boolean;
  /** El tipo lunar de nacimiento, si la base natal lo publicó. */
  lunarType: string | null;
}): LayerReading {
  const tramo = cumplelunaStage(input.progress);
  const etapa = tramo.label.toLocaleLowerCase("es");
  // Los dos números de la apertura, sólo si los dos son seguros: un ciclo de
  // largo cero o un día que no es finito no se escriben "por completar la
  // frase", se omiten y la apertura queda en el tramo.
  const numeros =
    input.exact &&
    Number.isFinite(input.cycleDay) &&
    Number.isFinite(input.cycleLength) &&
    input.cycleLength > 0;
  const tipo = input.lunarType?.trim();
  return {
    now: numeros
      ? `Estás en ${etapa}, día ${formatDecimal(Math.max(0, input.cycleDay))} de ${formatDecimal(
          input.cycleLength
        )}.`
      : `Estás en ${etapa} de tu ciclo lunar personal.`,
    theme: `${tramo.focus} ${
      tipo
        ? `Tu ciclo se cuenta desde el ángulo Sol–Luna con el que naciste, el de ${tipo.toLocaleLowerCase(
            "es"
          )}: cada vez que ese ángulo vuelve a repetirse, el recorrido empieza otra vez.`
        : "Tu ciclo se cuenta desde el ángulo Sol–Luna con el que naciste: cada vez que ese ángulo vuelve a repetirse, el recorrido empieza otra vez."
    }`,
    use: tramo.action,
    question: tramo.question,
    caveat: numeros ? null : CUMPLELUNA_WITHOUT_ROOT
  };
}

/** Sin raíz exacta el tramo se sostiene y el día no. Se dice una vez. */
const CUMPLELUNA_WITHOUT_ROOT =
  "Sin tu hora exacta de nacimiento el día del ciclo no es uno solo: los números de abajo se dicen como intervalos y lo que se afirma acá es el tramo.";

// ---------------------------------------------------------------------------
// La Luna sobre tu carta — signo × fase × casa
// ---------------------------------------------------------------------------

export type MoonReading = LayerReading & {
  /** Qué se abre hoy y qué conviene mirar mientras tanto. */
  tension: string;
};

/**
 * La Luna del día, interpretada (QA22-026).
 *
 * Las tres piezas del cálculo entran una vez cada una y con un trabajo distinto:
 * el **signo** y la **fase** arman el clima (`now`), la **casa** dice dónde
 * puede notarse (`theme`), el signo aporta la posibilidad y la fase la tensión
 * (`tension`), la casa da el gesto (`use`) y la fase la pregunta (`question`).
 *
 * **La etiqueta de la casa no es la interpretación.** El defecto medido era
 * `Priorizá: lo de tu casa 11: la gente y lo que viene`, que es el área tal como
 * la nombra la tabla, sin decir nada más. Acá el área vive en el título del
 * bloque de datos y lo que se lee es qué se nota cuando la Luna pasa por ahí.
 *
 * **Sin casa no se inventa ninguna.** El clima y la tensión salen igual del
 * signo y de la fase, `theme` dice dónde suele notarse ESE signo y el límite se
 * declara una vez en `caveat`.
 */
export function moonReading(input: {
  sign: string;
  phaseKey: LunarPhaseKey;
  natalHouse: number | null;
}): MoonReading {
  const signo = MOON_SIGN[bodyKey(input.sign)] ?? null;
  const clima = moonPhaseClimate(input.phaseKey);
  const mirar = MOON_PHASE_WATCH[input.phaseKey] ?? MOON_PHASE_WATCH.new;
  const casa = houseNumber(input.natalHouse);
  const notaDeCasa = moonHouseNotice(casa);
  const gestoDeCasa = moonHouseAction(casa);
  return {
    now: signo
      ? `La Luna pasa por ${input.sign}: ${signo.climate} ${capitalizar(clima)}`
      : `La Luna pasa por ${input.sign}. ${capitalizar(clima)}`,
    theme:
      casa !== null && notaDeCasa
        ? `Estos días la Luna recorre tu casa ${casa}. ${notaDeCasa}`
        : signo
          ? signo.where
          : MOON_WHERE_UNKNOWN,
    tension: signo ? `${signo.possibility} ${mirar}` : mirar,
    use: gestoDeCasa ?? moonPhaseAction(input.phaseKey),
    question: MOON_PHASE_QUESTION[input.phaseKey] ?? MOON_PHASE_QUESTION.new,
    caveat: casa === null ? MOON_WITHOUT_HOUSE : null
  };
}

/**
 * Sin hora exacta no hay casa que ubicar, y eso cambia lo que se afirma.
 *
 * Dice qué NO se nombra —ninguna casa— y de qué sale lo que sí se lee. Es otra
 * cosa que `moonWhy`, que responde por qué esta capa encabeza el día.
 */
const MOON_WITHOUT_HOUSE =
  "Sin tu hora exacta de nacimiento no hay una casa que ubicar, así que esta lectura no nombra ninguna: lo que se afirma sale del signo y de la fase.";

/** Un signo fuera de tabla no recibe un lugar inventado donde notarse. */
const MOON_WHERE_UNKNOWN =
  "La Luna cambia de área cada dos o tres días, así que lo que describe es un clima breve y no una etapa.";

/**
 * Los doce signos, con el tono que le dan al día.
 *
 * `climate` entra a mitad de frase, después de dos puntos, así que empieza en
 * minúscula y cierra la oración. `where` y `possibility` abren su propia línea.
 *
 * Un signo que la tabla no conozca —un nombre nuevo del contrato— no rompe el
 * texto ni recibe un tono inventado: la lectura se apoya en la fase, que sí está.
 */
const MOON_SIGN: Record<string, { climate: string; where: string; possibility: string }> = {
  aries: {
    climate: "el ánimo arranca rápido y busca resolver en el momento.",
    where: "Suele notarse en las ganas de encarar de una y en la impaciencia con lo que tarda.",
    possibility: "Hoy rinde empezar algo sin darle demasiadas vueltas."
  },
  tauro: {
    climate: "el ritmo baja y el cuerpo pide cosas concretas y conocidas.",
    where: "Suele notarse en las ganas de quedarte donde ya estás cómodo.",
    possibility: "Hoy rinde sostener una sola cosa y hacerla despacio."
  },
  geminis: {
    climate: "la cabeza va más rápido que el día y salta de un tema a otro.",
    where: "Suele notarse en la cantidad de conversaciones cortas y de idas y vueltas.",
    possibility: "Hoy rinde escribir lo que estás pensando antes de que se disperse."
  },
  cancer: {
    climate: "lo afectivo pesa más que de costumbre y se busca resguardo.",
    where: "Suele notarse en las ganas de estar con gente de confianza o directamente en tu casa.",
    possibility: "Hoy rinde ocuparte de alguien, y eso te incluye."
  },
  leo: {
    climate: "hay más ganas de que lo tuyo se vea y de ponerle presencia al día.",
    where: "Suele notarse en cómo te presentás y en cuánto te importa la devolución.",
    possibility: "Hoy rinde mostrar algo tuyo sin esperar a que esté perfecto."
  },
  virgo: {
    climate: "el foco se va al detalle y a lo que está sin terminar.",
    where: "Suele notarse en la exigencia con vos mismo y en las ganas de ordenar.",
    possibility: "Hoy rinde corregir una cosa chica y dejarla lista."
  },
  libra: {
    climate: "el día se acomoda a lo que quiere el otro y cuesta más elegir.",
    where: "Suele notarse en las decisiones de a dos y en el tiempo que tardan.",
    possibility: "Hoy rinde decir qué preferís antes de preguntar qué prefiere el otro."
  },
  escorpio: {
    climate: "todo se lee un poco más hondo y lo dicho a medias molesta.",
    where: "Suele notarse en lo que no se dice y en las ganas de saber qué hay debajo.",
    possibility: "Hoy rinde nombrar una sola cosa que venías guardando."
  },
  sagitario: {
    climate: "el ánimo se estira hacia lo que queda lejos y cuesta quedarse en el detalle.",
    where: "Suele notarse en las ganas de salir de la conversación de siempre.",
    possibility: "Hoy rinde mirar el asunto desde más arriba antes de meterte en la letra chica."
  },
  capricornio: {
    climate: "el día se organiza solo alrededor de lo que hay que hacer.",
    where: "Suele notarse en la seriedad con la que te tomás lo pendiente.",
    possibility: "Hoy rinde avanzar un tramo concreto de algo largo."
  },
  acuario: {
    climate: "aparece distancia: se ve mejor el conjunto que el detalle personal.",
    where: "Suele notarse en las ganas de hacer las cosas de otra manera y con otra gente.",
    possibility: "Hoy rinde probar una forma distinta de algo que hacés siempre."
  },
  piscis: {
    climate: "los bordes se difuminan y el ánimo se contagia de lo que hay alrededor.",
    where: "Suele notarse en el cansancio sin causa clara y en la sensibilidad al clima ajeno.",
    possibility: "Hoy rinde bajar el ruido antes de decidir cualquier cosa."
  }
};

/** Qué conviene mirar en cada fase. Es la tensión, no una advertencia. */
const MOON_PHASE_WATCH: Record<LunarPhaseKey, string> = {
  new: "Lo que conviene mirar es la impaciencia con algo que recién empieza.",
  crescent: "Lo que conviene mirar es si lo que arrancaste sigue teniendo tu atención cuando ya no es novedad.",
  first_quarter: "Lo que conviene mirar es la tentación de resolver de un tirón algo que pide una decisión.",
  gibbous: "Lo que conviene mirar es el detalle que sabés que falta y estás dejando pasar.",
  full: "Lo que conviene mirar es cuánto de lo que sentís hoy viene de que las cosas se ven más.",
  disseminating: "Lo que conviene mirar es si estás contando lo que pasó o repitiéndolo.",
  last_quarter: "Lo que conviene mirar es qué estás sosteniendo sólo por no dejarlo.",
  balsamic: "Lo que conviene mirar es el cansancio del final del ciclo, que suele confundirse con desgano."
};

/** La pregunta de cierre, una por fase: es lo que se puede observar hoy. */
const MOON_PHASE_QUESTION: Record<LunarPhaseKey, string> = {
  new: "¿Qué querés preparar hoy sin mostrarlo todavía?",
  crescent: "¿A qué le estás dando continuidad de verdad?",
  first_quarter: "¿Qué cosa chica venís postergando desde hace días?",
  gibbous: "¿Qué detalle sabés que no te cierra?",
  full: "¿Qué se está viendo hoy de lo que venías haciendo?",
  disseminating: "¿A quién le contarías cómo te fue?",
  last_quarter: "¿Qué podrías sacar de tu semana sin que se note?",
  balsamic: "¿Qué te haría bien no hacer hoy?"
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * La misma frase con la primera letra en mayúscula.
 *
 * Los climas de fase están escritos para entrar a mitad de oración, así que
 * empiezan en minúscula. Cuando uno abre una oración propia hace falta la
 * mayúscula, y la tabla no se duplica para eso.
 */
function capitalizar(frase: string): string {
  return frase.charAt(0).toLocaleUpperCase("es") + frase.slice(1);
}

/** Una casa real (1–12) o `null`. Nunca una casa inventada. */
function houseNumber(house: number | null | undefined): number | null {
  if (typeof house !== "number" || !Number.isInteger(house)) return null;
  return house >= 1 && house <= 12 ? house : null;
}

/**
 * Del nombre visible de un signo o de un planeta a la clave de las tablas.
 *
 * El sobre nombra las dos cosas en español —`Géminis`, `Plutón`—, así que la
 * clave se resuelve sin acentos y en minúscula: se descompone en NFD y se
 * descartan los diacríticos, que quedan como marcas combinantes propias. Un
 * nombre que la tabla no tenga devuelve una clave sin entrada, y quien llama cae
 * en su frase neutra.
 */
function bodyKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
