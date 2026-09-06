import { houseTheme } from "@/domain/layers";
import type { LunarPhaseKey, TransitAspect, TransitState } from "@/services/layersApi";

/**
 * Significado y acción de las capas de tiempo — la capa editorial de Órbita.
 *
 * Traduce los datos que YA calculó el backend a dos cosas que se puedan leer sin
 * saber astrología: **qué significa** y **para bajarlo a tierra**. No pide nada,
 * no llama a ningún modelo y no guarda estado: son tablas fijas y una
 * composición determinística sobre los campos del sobre. La misma entrada
 * devuelve exactamente el mismo texto, hoy y dentro de un año.
 *
 * ## Qué NO hace
 *
 * - **No inventa datos.** Si el cálculo no publicó la casa, el texto no la
 *   nombra: se apoya en lo que sí hay (signo, fase, aspecto, etapa).
 * - **No afirma hechos futuros.** Describe un clima y un foco de atención;
 *   nunca "va a pasar", "vas a conocer" ni "te conviene esperar a que…".
 * - **No aconseja sobre salud, dinero, leyes ni tratamientos.** Las acciones son
 *   micro-gestos de registro y conversación: anotar, elegir, ordenar, avisar.
 *   Entretenimiento y autoconocimiento, que es el marco del producto.
 *
 * ## Por qué vive en el dominio y no en la pantalla
 *
 * Porque el mismo significado lo usan varias superficies —la Luna del día, el
 * detalle de un tránsito, la estación vital, el tema del año y el cumpleluna— y
 * porque así se puede probar entero: las doce casas, las ocho fases, los cinco
 * aspectos, los puntos natales admitidos y los cuatro momentos del ciclo
 * personal, sin montar un solo componente.
 */

/** Un significado con su acción. Las dos partes SIEMPRE traen texto. */
export type Significado = {
  /** Qué está pasando, en palabras de todos los días. */
  meaning: string;
  /** Un gesto chico y seguro para hoy. Nunca una recomendación profesional. */
  action: string;
};

/** Rótulos del bloque editorial. Viven acá para que pantalla y prueba coincidan. */
export const MEANING_HEADING = "QUÉ SIGNIFICA HOY";
export const TRANSIT_MEANING_HEADING = "QUÉ SIGNIFICA PARA VOS";
export const ACTION_HEADING = "PARA BAJARLO A TIERRA";
/**
 * El bloque técnico del detalle de un tránsito.
 *
 * Se llamaba `DATOS DEL CONTACTO`, que describía el sobre y no lo que la persona
 * va a leer: abajo hay una duración y unos momentos, no una ficha de datos.
 */
export const TRANSIT_TIMING_HEADING = "DURACIÓN Y MOMENTOS CLAVE";
/** El nombre visible del detalle de un tránsito. No es "el arco": eso es jerga. */
export const TRANSIT_DETAIL_EYEBROW = "DETALLE DEL TRÁNSITO";
/** La guía de tres pasos del día. */
export const GUIDE_HEADING = "TU GUÍA PARA HOY";
/** Por qué esta capa aparece hoy — el criterio, no el método. */
export const WHY_HEADING = "POR QUÉ SE MUESTRA";
/** Cómo se calcula. Va al final, y su contenido vive en la trazabilidad. */
export const METHOD_HEADING = "MÉTODO";

// ---------------------------------------------------------------------------
// La Luna sobre tu carta
// ---------------------------------------------------------------------------

/**
 * Qué significa hoy la Luna, y un gesto chico para hoy.
 *
 * Con casa publicada el significado sale de la casa —que es el dato personal— y
 * la fase agrega el momento del ciclo. Sin casa no se inventa ninguna: se dice
 * el clima del día a partir del signo y de la fase, y la acción es una que
 * sirve igual sin saber por dónde de tu carta está pasando.
 */
export function moonMeaning(input: {
  sign: string;
  phaseKey: LunarPhaseKey;
  natalHouse: number | null;
}): Significado {
  const fase = MOON_PHASE[input.phaseKey] ?? MOON_PHASE.new;
  const casa = houseNumber(input.natalHouse);
  if (casa === null) {
    return {
      meaning: `La Luna está en ${input.sign} y ${fase.climate} Sin tu hora exacta de nacimiento no podemos decir por qué parte de tu carta está pasando, así que esto describe el clima del día y no un área tuya.`,
      action: fase.action
    };
  }
  const area = houseTheme(casa);
  return {
    meaning: `Estos días la Luna pasa por tu casa ${casa}${area ? `, la de ${area}` : ""}. ${MOON_HOUSE[casa].meaning} Y ${fase.climate}`,
    action: MOON_HOUSE[casa].action
  };
}

/**
 * Las cuatro piezas sueltas de la Luna, para quien componga con ellas.
 *
 * `moonMeaning` compone un párrafo cerrado, que es lo que necesita una tarjeta.
 * La lectura del detalle (`domain/layerReading`) arma otra cosa —clima, dónde
 * notarlo, posibilidad y tensión, gesto y pregunta— y para eso necesita las
 * piezas por separado, no el párrafo ya cosido.
 *
 * Se exponen como accesores y no como tablas: quien compone elige el orden, no
 * puede tocar el contenido, y una casa fuera de 1–12 devuelve `null` en vez de
 * un texto inventado.
 */

/** El clima de una fase, en minúscula: entra a mitad de oración. */
export function moonPhaseClimate(phaseKey: LunarPhaseKey): string {
  return (MOON_PHASE[phaseKey] ?? MOON_PHASE.new).climate;
}

/** El gesto de una fase. Es el que sirve cuando no hay casa que nombrar. */
export function moonPhaseAction(phaseKey: LunarPhaseKey): string {
  return (MOON_PHASE[phaseKey] ?? MOON_PHASE.new).action;
}

/** Qué se nota cuando la Luna recorre una casa, o `null` fuera de 1–12. */
export function moonHouseNotice(house: number | null | undefined): string | null {
  const casa = houseNumber(house);
  return casa === null ? null : MOON_HOUSE[casa].meaning;
}

/** El gesto de esa casa, o `null` fuera de 1–12. */
export function moonHouseAction(house: number | null | undefined): string | null {
  const casa = houseNumber(house);
  return casa === null ? null : MOON_HOUSE[casa].action;
}

/**
 * La guía del día en tres pasos: qué priorizar, qué probar y qué observar.
 *
 * Es la forma CORTA de la Luna, la que entra en una tarjeta. Un párrafo de
 * significado y otro de acción decían lo mismo dos veces —el segundo empezaba
 * donde terminaba el primero— y no se podía saltear: había que leer los dos para
 * saber qué hacer hoy. Tres líneas rotuladas se recorren en cinco segundos y
 * cada una tiene un trabajo distinto.
 *
 * **El área se dice UNA vez**, en `prioriza`. Ni `proba` ni `observa` la
 * repiten: la casa y su tema aparecían en el resumen del cálculo, en la fila de
 * datos y en el texto, tres veces seguidas con las mismas palabras.
 *
 * Convive con `moonReading` (`domain/layerReading`), que es la forma LARGA —la
 * del detalle, con clima, tensión, gesto, pregunta y su límite—. Las dos
 * componen las MISMAS piezas y ninguna copia el texto de la otra: por eso las
 * tablas se leen por los accesores de arriba y no se duplican acá.
 */
export type GuiaDelDia = {
  /** Qué poner adelante hoy: el área de tu carta, cuando se puede ubicar. */
  prioriza: string;
  /** El gesto chico. Uno solo, y siempre seguro. */
  proba: string;
  /** Qué mirar sin hacer nada: cómo se nota el día. */
  observa: string;
};

/** Los rótulos de los tres pasos, en el orden en que se leen. */
export const GUIDE_STEP_LABEL = {
  prioriza: "PRIORIZÁ",
  proba: "PROBÁ",
  observa: "OBSERVÁ"
} as const;

/**
 * La guía de la Luna de hoy.
 *
 * Con casa publicada, `prioriza` nombra el área —una vez—, `proba` es la
 * microacción de esa casa y `observa` dice en DOS frases cómo se nota esa casa
 * y, aparte, el clima de la fase. Sin casa no se inventa ninguna: se prioriza el
 * clima del día, se prueba el gesto de la fase y se observa la fase, diciendo
 * por qué falta el área.
 */
export function moonGuide(input: {
  sign: string;
  phaseKey: LunarPhaseKey;
  natalHouse: number | null;
}): GuiaDelDia {
  const clima = moonPhaseClimate(input.phaseKey);
  const casa = houseNumber(input.natalHouse);
  // Las tres piezas de la casa van juntas: o hay casa —y entonces hay área,
  // nota y gesto— o no la hay y el día se lee con el signo y la fase. Se piden
  // por separado para que el compilador exija las dos, no para que una pueda
  // faltar.
  const nota = moonHouseNotice(casa);
  const gesto = moonHouseAction(casa);
  if (casa === null || nota === null || gesto === null) {
    return {
      prioriza: `El clima del día: la Luna está en ${input.sign}. Sin tu hora exacta de nacimiento no podemos ubicar por qué área de tu carta pasa, así que esto no describe un área tuya.`,
      proba: moonPhaseAction(input.phaseKey),
      observa: capitalizar(clima)
    };
  }
  const area = houseTheme(casa);
  return {
    prioriza: `Lo de tu casa ${casa}${area ? `: ${area}` : ""}.`,
    proba: gesto,
    // Dos frases, no una pegada con "Y": lo que se nota del área y, aparte, el
    // momento del ciclo. Leído en voz alta, «Suele notarse… Y aparece…» sonaba
    // a dos renglones cosidos; son dos cosas distintas para mirar y se dicen
    // como tales. El área NO se repite acá: ya la dijo `prioriza`.
    observa: `${nota} Prestá atención también a que ${clima}`
  };
}

/**
 * Por qué la Luna aparece en el día.
 *
 * Es el CRITERIO, no el método: por qué esta capa encabeza la lectura del día y
 * qué escala describe. El método —qué se calculó, con qué fuentes y con qué
 * precisión— vive en la trazabilidad, al final de la pantalla.
 */
export function moonWhy(natalHouse: number | null): string {
  const casa = houseNumber(natalHouse);
  const base =
    "La Luna es la capa más rápida de tu carta: cambia de signo cada dos o tres días, así que describe un clima breve y no una etapa.";
  return casa === null
    ? `${base} Sin tu hora exacta de nacimiento no hay casas que recorrer, así que lo que se lee es el cielo del día.`
    : `${base} Aparece primero porque es la que más cambia entre un día y el siguiente.`;
}

/**
 * El clima de cada fase del ciclo de hoy.
 *
 * `climate` se escribe en minúscula y cerrando la frase porque entra a mitad de
 * la oración ("…y el ciclo recién arranca…"): la fase ya se nombra arriba, con
 * el nombre que trae el sobre, así que acá no se repite la etiqueta.
 */
const MOON_PHASE: Record<LunarPhaseKey, { climate: string; action: string }> = {
  new: {
    climate: "el ciclo lunar recién arranca: hay más para preparar que para mostrar.",
    action: "Anotá una sola cosa que quieras empezar y dejala escrita donde la veas."
  },
  crescent: {
    climate: "la Luna viene creciendo: lo que ya empezaste pide continuidad más que ideas nuevas.",
    action: "Retomá algo que arrancaste y dedicale quince minutos hoy."
  },
  first_quarter: {
    climate: "aparece la primera resistencia del ciclo y suele haber algo chico para resolver.",
    action: "Elegí una cosa que venís postergando y decidí hoy si la hacés o la soltás."
  },
  gibbous: {
    climate: "falta poco para el punto más alto del ciclo y se notan los detalles sin terminar.",
    action: "Revisá un detalle que no te cierra y corregilo antes de seguir."
  },
  full: {
    climate: "el ciclo llega a su punto más visible: lo que venías haciendo se ve más que otros días.",
    action: "Mostrale a alguien algo en lo que venías trabajando sin comentarlo."
  },
  disseminating: {
    climate: "el ciclo empieza a bajar y lo que pasó se vuelve algo para contar.",
    action: "Contale a alguien cómo te fue con algo que terminaste hace poco."
  },
  last_quarter: {
    climate: "el ciclo va cerrando: rinde más sacar que sumar.",
    action: "Elegí una cosa de tu semana para sacar de la lista y sacala."
  },
  balsamic: {
    climate: "es el tramo final del ciclo, el de menos ruido.",
    action: "Date un rato tranquilo hoy, sin tarea y sin pantalla."
  }
};

/**
 * Las doce casas, dichas como lo que se nota en dos o tres días.
 *
 * El área de cada casa NO se repite acá: sale de `houseTheme`, que es la única
 * tabla de áreas del producto. Esto es lo otro —qué se nota y qué hacer—, y el
 * texto está escrito para que la casa se entienda sin haber leído qué es una
 * casa.
 */
const MOON_HOUSE: Record<number, Significado> = {
  1: {
    meaning: "Suele notarse como más registro de uno mismo: cómo aparecés, qué cara traés, qué te sale responder.",
    action: "Elegí una cosa chica que quieras que se note de vos hoy y hacela."
  },
  2: {
    meaning: "Suele notarse en lo concreto: lo que tenés a mano, lo que usás y lo que te da tranquilidad.",
    action: "Ordená una sola cosa tuya de las que usás todos los días."
  },
  3: {
    meaning: "Suele notarse en las conversaciones cortas, los mensajes y las idas y vueltas del barrio.",
    action: "Mandá ese mensaje que venís dejando para después. Una línea alcanza."
  },
  4: {
    meaning: "Suele notarse puertas adentro: la casa, la gente con la que estás en confianza, las ganas de estar tranquilo.",
    action: "Escribile o llamá a alguien de tu casa o de tu círculo más cercano."
  },
  5: {
    meaning: "Suele notarse en las ganas de hacer algo por gusto: crear, jugar, mostrar algo tuyo.",
    action: "Hacé algo hoy sin ninguna utilidad, sólo porque te divierte."
  },
  6: {
    meaning: "Suele notarse en lo cotidiano: las tareas chicas, los horarios y cómo se acomoda el día.",
    action: "Tachá una tarea chica de las que vienen arrastrándose."
  },
  7: {
    meaning: "Suele notarse en los vínculos de a dos: lo que se acuerda, lo que se espera y lo que se conversa.",
    action: "Preguntale a alguien cómo está y quedate a escuchar la respuesta entera."
  },
  8: {
    meaning: "Suele notarse en lo que no se muestra: lo que compartís con pocos y lo que está cambiando de fondo.",
    action: "Anotá algo que hoy no dirías en voz alta. No hace falta que se lo muestres a nadie."
  },
  9: {
    meaning: "Suele notarse en las ganas de salir de la rutina: aprender algo, moverte, mirar más lejos.",
    action: "Dedicale diez minutos a algo que no tenga nada que ver con tu día."
  },
  10: {
    meaning: "Suele notarse en lo que se ve de vos desde afuera: tu trabajo, tu rol, lo que estás construyendo.",
    action: "Escribí la próxima cosa concreta que querés que avance en lo que hacés."
  },
  11: {
    meaning: "Suele notarse en la gente: los grupos, los proyectos compartidos y lo que viene después.",
    action: "Escribile a alguien de un grupo con el que hace rato no hablás."
  },
  12: {
    meaning: "Suele notarse como ganas de bajar el ruido: lo que se cierra, lo que descansa, lo que queda para adentro.",
    action: "Date quince minutos hoy sin pantalla y sin nada pendiente."
  }
};

// ---------------------------------------------------------------------------
// Tránsitos
// ---------------------------------------------------------------------------

/**
 * Qué significa un tránsito PARA VOS, compuesto con lo que el cálculo publica.
 *
 * Se arma con cinco piezas y en este orden: el planeta que se mueve, el punto de
 * tu carta que toca, el aspecto que forman —los cinco mayores—, la etapa del
 * contacto y, si el cálculo la publicó, la casa que activa. Cada pieza aporta UNA
 * frase; ninguna repite a la otra.
 *
 * Un nombre que la tabla no conozca —un punto que el backend agregue mañana— no
 * rompe nada ni se inventa: cae en una frase neutra que dice lo que sí se sabe.
 * Es la misma decisión que toma la fila compacta con los glifos.
 */
export function transitMeaning(input: {
  transitPlanet: string;
  natalPoint: string;
  aspect: TransitAspect;
  state: TransitState;
  natalHouse: number | null;
}): Significado {
  const planeta = TRANSIT_PLANET[bodyKey(input.transitPlanet)] ?? "se está moviendo sobre tu carta en estos días";
  const punto = NATAL_POINT[bodyKey(input.natalPoint)] ?? "un punto de tu carta";
  const aspecto = TRANSIT_ASPECT[input.aspect];
  const casa = houseNumber(input.natalHouse);
  const area = casa === null ? null : houseTheme(casa);
  const frases = [
    `${input.transitPlanet} ${planeta}.`,
    `${aspecto.contact} tu ${input.natalPoint}: ${punto}.`,
    TRANSIT_STATE[input.state],
    casa === null
      ? null
      : `Lo activa en tu casa ${casa}${area ? `, la de ${area}` : ""}.`
  ];
  return {
    meaning: frases.filter((frase): frase is string => Boolean(frase)).join(" "),
    action: `${aspecto.action} ${TRANSIT_STATE_ACTION[input.state]}`
  };
}

/**
 * Qué mueve cada planeta cuando transita, en una frase.
 *
 * Se lee pegada al nombre que trae el sobre (`Saturno` + `va despacio y pide
 * tiempo…`), así que empieza en verbo y sin artículo.
 */
const TRANSIT_PLANET: Record<string, string> = {
  sun: "ilumina, durante unos días, aquello que estás poniendo al frente",
  moon: "pasa rápido y toca el ánimo del día más que el fondo del asunto",
  mercury: "mueve conversaciones, mensajes, trámites y la forma de nombrar las cosas",
  venus: "mueve el gusto, los vínculos y lo que te resulta agradable o no",
  mars: "sube la energía y las ganas de hacer, con la impaciencia que eso trae",
  jupiter: "abre el tema y lo agranda: aparece más espacio y también más de todo",
  saturn: "va despacio y pide tiempo, orden y límites concretos",
  uranus: "sacude la rutina y trae lo inesperado, para bien o para incómodo",
  neptune: "difumina los bordes: cuesta más ver con nitidez y se nota lo sutil",
  pluto: "trabaja de fondo y muy de a poco, en lo que ya venía cambiando"
};

/**
 * Qué parte tuya es cada punto natal.
 *
 * Están los admitidos por el ranking: las diez posiciones y los cuatro ejes. Se
 * lee después de dos puntos, así que va en sustantivo.
 */
const NATAL_POINT: Record<string, string> = {
  sun: "tu identidad y lo que querés sostener",
  moon: "tu vida afectiva y lo que necesitás para estar bien",
  mercury: "tu forma de pensar y de decir las cosas",
  venus: "tu manera de vincularte y lo que te gusta",
  mars: "tu empuje y tu forma de encarar",
  jupiter: "tu sentido de la oportunidad y lo que te abre",
  saturn: "tu estructura, tus límites y lo que te tomás en serio",
  uranus: "tu necesidad de libertad y de cambiar de forma",
  neptune: "tu sensibilidad y lo que imaginás",
  pluto: "lo que en vos cambia de raíz y no vuelve atrás",
  ascendant: "cómo aparecés y cómo entrás al mundo",
  descendant: "cómo te ponés frente al otro en los vínculos de a dos",
  mc: "tu dirección y lo que se ve de vos desde afuera",
  ic: "tu raíz, tu casa y tu vida más privada"
};

/**
 * Los cinco aspectos mayores: cómo se encuentran los dos puntos, y qué hacer.
 *
 * `contact` empieza la frase, así que va en mayúscula y termina abierto: lo que
 * sigue es el punto natal. `action` es el gesto, y se cierra con la etapa.
 */
const TRANSIT_ASPECT: Record<TransitAspect, { contact: string; action: string }> = {
  conjunction: {
    contact: "Se junta en el mismo punto con",
    action: "Los dos temas se mezclan, así que conviene nombrarlos por separado: escribí en dos líneas qué es de uno y qué es del otro."
  },
  sextile: {
    contact: "Se toca de costado con",
    action: "Es una puerta que se abre sólo si la empujás: elegí un paso chico y dalo esta semana."
  },
  square: {
    contact: "Se cruza en tensión con",
    action: "Las dos cosas piden algo distinto al mismo tiempo: elegí una sola para ajustar y dejá la otra como está."
  },
  trine: {
    contact: "Se acompaña sin fricción con",
    action: "Este contacto no hace ruido, y por eso suele pasar de largo: usalo para algo que venías dejando y anotá qué hiciste."
  },
  opposition: {
    contact: "Queda enfrentado con",
    action: "Se ve como dos polos: escribí los dos lados antes de decidir, en vez de quedarte con el primero."
  }
};

/** La etapa del contacto, dicha sin jerga y sin anticipar un hecho. */
const TRANSIT_STATE: Record<TransitState, string> = {
  approaching: "Todavía se está acercando a su punto más exacto, así que recién empieza a notarse.",
  exact: "Está en su punto más exacto: es cuando el tema se nota más nítido.",
  integrating: "Ya pasó su punto más exacto y ahora queda el eco, no la novedad."
};

/** El cierre de la acción según la etapa: cuándo tiene sentido hacerla. */
const TRANSIT_STATE_ACTION: Record<TransitState, string> = {
  approaching: "No hace falta resolverlo hoy: todavía hay tiempo.",
  exact: "Si vas a hacer algo con esto, estos días es cuando más se nota.",
  integrating: "A esta altura rinde más revisar qué quedó que empezar algo nuevo."
};

// ---------------------------------------------------------------------------
// Estación vital — las ocho fases de la lunación progresada
// ---------------------------------------------------------------------------

/** El verbo de la etapa: qué tipo de movimiento pide esta fase del ciclo largo. */
export type SeasonVerb =
  | "iniciar"
  | "sostener"
  | "decidir"
  | "ajustar"
  | "mostrar"
  | "compartir"
  | "reordenar"
  | "cerrar";

export type SeasonMeaning = Significado & {
  /** El verbo de la etapa, para el renglón corto (`Etapa de sostener: …`). */
  verb: SeasonVerb;
  /** El tema de la etapa, en una frase corta que cierra ese mismo renglón. */
  theme: string;
};

/**
 * La estación vital traducida: tema comprensible y acción prudente.
 *
 * Las ocho fases de la lunación progresada son un ciclo de unos 30 años, así que
 * la acción no puede ser "hacelo hoy": es un movimiento de escala mensual, dicho
 * con prudencia y sin prometer un resultado.
 */
export function seasonMeaning(phaseKey: LunarPhaseKey): SeasonMeaning {
  return SEASON[phaseKey] ?? SEASON.new;
}

const SEASON: Record<LunarPhaseKey, SeasonMeaning> = {
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
    meaning:
      "Lo que aprendiste en la subida se vuelve algo para contar. La etapa rinde más en conversación que en soledad.",
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

// ---------------------------------------------------------------------------
// Tema del año — la casa de la profección
// ---------------------------------------------------------------------------

export type YearMeaning = Significado & {
  /** El área cotidiana del año, en palabras corrientes. */
  area: string;
};

/**
 * El tema del año traducido a un área de todos los días.
 *
 * La pantalla ya escribe `Casa N · <área de la carta>` arriba, así que esto NO
 * repite esa etiqueta: dice qué se pone en primer plano en lo cotidiano y qué
 * hacer con eso durante el año.
 */
export function yearMeaning(house: number): YearMeaning | null {
  const casa = houseNumber(house);
  return casa === null ? null : YEAR_HOUSE[casa];
}

const YEAR_HOUSE: Record<number, YearMeaning> = {
  1: {
    area: "cómo arrancás y cómo te presentás",
    meaning:
      "El año pone en primer plano lo tuyo: cómo empezás las cosas, qué mostrás primero y qué imagen queda de vos.",
    action: "Escribí en una línea qué te gustaría que la gente note de vos este año."
  },
  2: {
    area: "lo que tenés y lo que valorás",
    meaning:
      "El foco cae en lo concreto de todos los días: lo que tenés, lo que usás y a qué le das valor cuando repartís tu tiempo.",
    action: "Anotá tres cosas tuyas —un objeto, una hora del día, algo que sabés hacer— que quieras cuidar mejor este año."
  },
  3: {
    area: "las conversaciones y el entorno cercano",
    meaning:
      "Las charlas, los mensajes, los trayectos cortos y lo que aprendés sobre la marcha ocupan más lugar que de costumbre.",
    action: "Escribí a quién te gustaría escribirle más seguido y mandale un mensaje esta semana."
  },
  4: {
    area: "la casa y la gente de confianza",
    meaning:
      "El año trabaja puertas adentro: dónde vivís, con quién, y qué necesitás para sentirte en tu lugar.",
    action: "Elegí un rincón de tu casa y dejalo como te gustaría encontrarlo."
  },
  5: {
    area: "lo que hacés por gusto",
    meaning:
      "Lo que hacés porque te gusta —crear, jugar, mostrar algo tuyo— pide más espacio del que suele tener.",
    action: "Reservá una hora por semana para algo que hagas sólo porque te divierte."
  },
  6: {
    area: "las rutinas y las tareas de todos los días",
    meaning:
      "El año se juega en lo chico: cómo organizás el día, qué tareas se repiten y qué se te acumula.",
    action: "Elegí una sola rutina y cambiale algo mínimo, para ver si así se sostiene."
  },
  7: {
    area: "los vínculos de a dos",
    meaning:
      "Los temas de a dos —pareja, socios, acuerdos, la persona con la que trabajás— pasan al frente.",
    action: "Escribí qué acuerdo, dicho o no dicho, te gustaría revisar con alguien, y buscá el momento de hablarlo."
  },
  8: {
    area: "lo compartido y lo que no se muestra",
    meaning:
      "Toma peso lo que compartís con pocos y lo que preferís no mostrar: lo que está cambiando de fondo, sin anuncio.",
    action: "Anotá una cosa que hoy te cueste decir y a quién se la dirías si te animaras."
  },
  9: {
    area: "lo que te saca de tu radio habitual",
    meaning:
      "Gana lugar lo que amplía: estudiar, viajar, conocer otra manera de hacer las cosas, buscarle sentido a lo que hacés.",
    action: "Elegí un tema que te dé curiosidad y reservá una tarde para meterte en él."
  },
  10: {
    area: "tu dirección y lo que se ve de vos",
    meaning:
      "El año mira hacia afuera: en qué dirección va lo que hacés y cómo te ven los que no te conocen de cerca.",
    action: "Escribí en una línea cómo te gustaría que te describan dentro de un año."
  },
  11: {
    area: "la gente y lo que viene",
    meaning:
      "La gente con la que te juntás, los proyectos compartidos y lo que viene después ocupan más lugar del habitual.",
    action: "Elegí una persona o un grupo con quien quieras armar algo y proponé una fecha."
  },
  12: {
    area: "lo que se cierra y lo que descansa",
    meaning:
      "El año pide cerrar más que abrir: lo que ya terminó, lo que descansa y lo que pasa puertas adentro.",
    action: "Elegí algo que ya terminó y date un rato para cerrarlo bien: tirar, archivar, avisar."
  }
};

// ---------------------------------------------------------------------------
// Cumpleluna — los cuatro tramos del ciclo personal
// ---------------------------------------------------------------------------

/**
 * En qué tramo del ciclo personal estás. Cuatro, uno por cuarto de recorrido.
 *
 * `revision` se llamaba `ajuste`, y "ajuste" no dice qué hacer: el tramo que
 * sigue a la mitad del ciclo es el de MIRAR lo que se abrió y decidir si sigue
 * como está. Los cuatro nombres son ahora los cuatro verbos del ciclo.
 */
export type CumplelunaMoment = "inicio" | "desarrollo" | "revision" | "cierre";

/** Los cuatro tramos, en orden de recorrido. */
export const CUMPLELUNA_MOMENTS: readonly CumplelunaMoment[] = [
  "inicio",
  "desarrollo",
  "revision",
  "cierre"
];

/**
 * Las fronteras de los tramos, en PORCENTAJE del ciclo: 0, 25, 50, 75 y 100.
 *
 * Se declaran una sola vez y en porcentaje porque es como se leen en pantalla
 * (`0–25 %`). El avance del sobre es 0–1, así que la comparación divide por cien
 * en un solo lugar: dos escalas escritas a mano en dos archivos distintos fue
 * exactamente el tipo de desfasaje que este módulo existe para evitar.
 */
export const CUMPLELUNA_BOUNDARIES_PERCENT: readonly number[] = [0, 25, 50, 75, 100];

/** El tramo del ciclo, con su foco, su gesto y su pregunta. */
export type CumplelunaStage = {
  moment: CumplelunaMoment;
  /** El rótulo visible del tramo (`REVISIÓN`). */
  label: string;
  /** Las fronteras del tramo, en porcentaje del ciclo. */
  range: { fromPercent: number; toPercent: number };
  /** De qué se trata este tramo. */
  focus: string;
  /** Un gesto chico y seguro. Uno solo: el ciclo dura ~29 días. */
  action: string;
  /**
   * Una pregunta para hoy.
   *
   * Es lo que hace que el tramo se pueda usar y no sólo leer: un foco describe y
   * una acción ordena, pero una pregunta deja que la persona decida. Siempre
   * termina en signo de pregunta y nunca pide un dato sensible.
   */
  question: string;
};

/**
 * En qué momento del ciclo personal cae un avance 0–1.
 *
 * Los bordes son cerrados a la izquierda: `0,25` ya es desarrollo. Un avance que
 * no sea un número finito se trata como el comienzo del ciclo —es lo único que
 * se puede afirmar sin dato— y nunca deja la pantalla sin texto.
 */
export function cumplelunaMoment(progress: number): CumplelunaMoment {
  if (!Number.isFinite(progress)) return "inicio";
  const porcentaje = Math.max(0, Math.min(1, progress)) * 100;
  if (porcentaje < CUMPLELUNA_BOUNDARIES_PERCENT[1]) return "inicio";
  if (porcentaje < CUMPLELUNA_BOUNDARIES_PERCENT[2]) return "desarrollo";
  if (porcentaje < CUMPLELUNA_BOUNDARIES_PERCENT[3]) return "revision";
  return "cierre";
}

/** El tramo del ciclo personal que corresponde a un avance 0–1. */
export function cumplelunaStage(progress: number): CumplelunaStage {
  return CUMPLELUNA[cumplelunaMoment(progress)];
}

/** El tramo que sigue, o `null` cuando el ciclo termina en vez de seguir. */
export function nextCumplelunaMoment(moment: CumplelunaMoment): CumplelunaMoment | null {
  const indice = CUMPLELUNA_MOMENTS.indexOf(moment);
  if (indice < 0) return null;
  return CUMPLELUNA_MOMENTS[indice + 1] ?? null;
}

/** El cambio de tramo: cuál viene y cuándo empieza. */
export type CumplelunaTransition = {
  next: CumplelunaMoment;
  /** El rótulo visible del tramo que viene. */
  label: string;
  /** El instante en que empieza, derivado de las dos raíces del ciclo. */
  atMs: number;
};

/**
 * Cuándo entrás en el tramo siguiente.
 *
 * **Sólo con raíz exacta.** El instante se deriva de las dos repeticiones del
 * ángulo natal (`previousExactAt` / `nextExactAt`): sin hora exacta de
 * nacimiento esas dos fechas son ventanas, y una frontera calculada sobre el
 * centro de dos ventanas sería una fecha agendable que el método nunca afirmó.
 * Quien llama decide si tiene raíz exacta y no llama si no la tiene; acá se
 * exige, además, que las dos raíces sean coherentes.
 *
 * En el tramo de cierre devuelve `null`: lo que viene no es otro tramo, es el
 * próximo cumpleluna, y esa fecha la pantalla ya la dice como tal. Repetirla con
 * el rótulo `INICIO` la contaría dos veces.
 */
export function cumplelunaTransition(input: {
  /** El avance 0–1 con el que se eligió el tramo actual. */
  progress: number;
  previousExactAt: number;
  nextExactAt: number;
}): CumplelunaTransition | null {
  const { previousExactAt, nextExactAt } = input;
  if (!Number.isFinite(previousExactAt) || !Number.isFinite(nextExactAt)) return null;
  if (nextExactAt <= previousExactAt) return null;
  const siguiente = nextCumplelunaMoment(cumplelunaMoment(input.progress));
  if (siguiente === null) return null;
  const tramo = CUMPLELUNA[siguiente];
  const largo = nextExactAt - previousExactAt;
  return {
    next: siguiente,
    label: tramo.label,
    atMs: previousExactAt + (largo * tramo.range.fromPercent) / 100
  };
}

const CUMPLELUNA: Record<CumplelunaMoment, CumplelunaStage> = {
  inicio: {
    moment: "inicio",
    label: "INICIO",
    range: { fromPercent: 0, toPercent: 25 },
    focus:
      "Tu ciclo personal recién arrancó: el ángulo Sol–Luna con el que naciste volvió a repetirse hace poco. Es el tramo de abrir, cuando todavía no hay mucho hecho.",
    action: "Anotá con qué querés que arranque este ciclo tuyo. Una frase alcanza.",
    question: "¿Qué querés que sea distinto cuando este ciclo termine?"
  },
  desarrollo: {
    moment: "desarrollo",
    label: "DESARROLLO",
    range: { fromPercent: 25, toPercent: 50 },
    focus:
      "Estás en la parte de más movimiento del ciclo: lo que abriste al principio ya está andando y pide tiempo encima.",
    action: "Elegí lo que ya está en marcha y dale una hora esta semana.",
    question: "¿A qué le estás dando tiempo de verdad y a qué sólo de palabra?"
  },
  revision: {
    moment: "revision",
    label: "REVISIÓN",
    range: { fromPercent: 50, toPercent: 75 },
    focus:
      "El ciclo pasó su mitad. Es el tramo de revisar: se nota lo que no está funcionando y todavía hay margen para acomodarlo.",
    action: "Releé qué te propusiste al empezar el ciclo y ajustá una sola cosa.",
    question: "¿Qué de lo que empezaste sigue teniendo sentido tal como está?"
  },
  cierre: {
    moment: "cierre",
    label: "CIERRE",
    range: { fromPercent: 75, toPercent: 100 },
    focus:
      "El ciclo está terminando y tu próximo cumpleluna ya está cerca. Rinde más cerrar lo que quedó abierto que empezar algo nuevo.",
    action: "Elegí una cosa que quede pendiente y cerrala antes de que empiece el próximo ciclo.",
    question: "¿Qué te gustaría no arrastrar al ciclo que viene?"
  }
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * La misma frase con la primera letra en mayúscula.
 *
 * Los climas de fase están escritos para entrar a mitad de oración, así que
 * empiezan en minúscula. Cuando uno abre una línea propia —`OBSERVÁ` sin casa—
 * hace falta la mayúscula, y el texto de la tabla no se duplica para eso.
 */
function capitalizar(frase: string): string {
  return frase.charAt(0).toLocaleUpperCase("es") + frase.slice(1);
}

/** Una casa real (1–12) o `null`. Nunca una casa inventada ni un índice fuera de rango. */
function houseNumber(house: number | null | undefined): number | null {
  if (typeof house !== "number" || !Number.isInteger(house)) return null;
  return house >= 1 && house <= 12 ? house : null;
}

/**
 * Del nombre visible de un cuerpo o eje a la clave de las tablas.
 *
 * El sobre nombra los puntos en español —`Sol`, `Medio Cielo`, `Plutón`—, así
 * que la clave se resuelve sin acentos y con los alias del contrato. Un nombre
 * que no está en la tabla devuelve una clave que ninguna tabla tiene, y quien
 * llama cae en su frase neutra: preferimos una frase general antes que un texto
 * vacío o un punto llamado por un nombre que no es el suyo.
 */
function bodyKey(name: string): string {
  const plano = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return BODY_ALIAS[plano] ?? plano;
}

/** Los nombres en español del contrato, mapeados a la clave inglesa de las tablas. */
const BODY_ALIAS: Record<string, string> = {
  sol: "sun",
  luna: "moon",
  mercurio: "mercury",
  marte: "mars",
  jupiter: "jupiter",
  saturno: "saturn",
  urano: "uranus",
  neptuno: "neptune",
  pluton: "pluto",
  asc: "ascendant",
  ascendente: "ascendant",
  descendente: "descendant",
  desc: "descendant",
  medio_cielo: "mc",
  midheaven: "mc",
  fondo_del_cielo: "ic",
  imum_coeli: "ic"
};
