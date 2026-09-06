/**
 * Lectura del read-model canónico de la carta natal (`layers.getNatalChartBase`).
 *
 * Todo lo que la Carta muestra —signo, grado, ejes, casas, contactos, precisión
 * y acceso— sale de ese contrato y de ningún otro lado. Acá vive la parte pura:
 * traducir cada campo a lo que se lee en pantalla SIN completar nada.
 *
 * Tres reglas que el contrato ya resolvió y que esta capa no puede desandar:
 *
 * 1. **Sin hora exacta no hay grados.** El backend devuelve `degree: null` y
 *    `fullDegree: null` a propósito: elegir el grado del mediodía sería inventar
 *    una hora de nacimiento. Cada posición declara su precisión —`exact`,
 *    `estimated` (el signo se mantiene todo el día), `range` (el signo puede
 *    cambiar) u `omitted` (se retiró)— y eso es exactamente lo que se muestra.
 * 2. **Ascendente, Medio Cielo y casas son geometría sensible a la hora.** Sólo
 *    existen con hora conocida y verificada; cuando no están, no se estiman.
 * 3. **Los códigos del contrato no son copy.** Las comparaciones contra
 *    `calculationTimeSource` o `missingInputs` viven acá; las pantallas
 *    preguntan en castellano.
 */
import { degreeInSign, formatDecimal } from "@/domain/layers";
import { RETROGRADE_CODE } from "@/domain/astroSymbols";
import type { NatalChartAspect, NatalChartPayload, SignPlacement } from "@/services/appRefs";
import type {
  NatalAngle,
  NatalAspect,
  NatalChartBase,
  NatalHouse,
  NatalPlanetKey,
  NatalPosition
} from "@/services/layersApi";

// ---------------------------------------------------------------------------
// Preguntas al contrato (los códigos no salen de este archivo)
// ---------------------------------------------------------------------------

/** ¿La carta se calculó con el instante exacto de nacimiento? */
export function hasExactBirthTime(chart: NatalChartBase): boolean {
  return chart.calculationTimeSource === "exact_birth_time";
}

/**
 * ¿Lo que falta son los datos de nacimiento?
 *
 * Distinto de "todavía no se calculó": sin fecha, lugar y zona no hay nada que
 * calcular, y la salida es completar los datos, no reintentar.
 */
export function needsBirthData(chart: NatalChartBase): boolean {
  return chart.missingInputs.includes("birth_data");
}

/** Línea de contexto: con qué hora se calculó esta carta. */
export function timeSourceLine(chart: NatalChartBase): string {
  if (chart.calculationTimeSource === "exact_birth_time") {
    return "Calculada con tu hora exacta de nacimiento";
  }
  if (chart.calculationTimeSource === "full_civil_day") {
    return "Calculada sobre todo tu día de nacimiento";
  }
  return "Todavía sin posiciones calculadas";
}

/** Cómo quedó guardada tu hora de nacimiento, dicho en castellano. */
export function birthTimePrecisionLabel(chart: NatalChartBase): string {
  if (chart.birthTimePrecision === "known") return "Hora exacta";
  if (chart.birthTimePrecision === "approximate") return "Hora aproximada";
  if (chart.birthTimePrecision === "unknown") return "Hora desconocida";
  return "Sin declarar";
}

/**
 * Por qué una hora aproximada no alcanza. Se dice donde se nota —no hay ejes ni
 * casas— porque de lo contrario parece un cálculo incompleto y no una decisión.
 */
export function birthTimePrecisionNote(chart: NatalChartBase): string | null {
  if (chart.birthTimePrecision === "approximate") {
    return "Una hora aproximada, sin un margen declarado, se trata como desconocida: se revisa todo el día civil.";
  }
  if (chart.birthTimePrecision === "unknown") {
    return "Sin hora se revisa todo el día civil: se conserva lo que no cambia y se retira lo que sí.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Posiciones (Sol–Plutón)
// ---------------------------------------------------------------------------

export type NatalPositionView = {
  key: NatalPlanetKey;
  /** Nombre del punto, tal como lo publica el contrato ("Sol", "Plutón"). */
  label: string;
  /** El dato: signo con grado, signo estable, rango de signos o dato retirado. */
  value: string;
  /** Marca corta de precisión. `null` cuando la posición es exacta. */
  tag: string | null;
  /** La misma fila dicha en palabras, para VoiceOver. */
  voice: string;
  /** El límite que el contrato declaró para ESTE punto. */
  limitation: string | null;
};

/** ¿Esta posición se puede ubicar en la rueda? Sólo con longitud publicada. */
export function hasLongitude(position: NatalPosition): boolean {
  return typeof position.fullDegree === "number" && Number.isFinite(position.fullDegree);
}

/** Cuántas de las diez posiciones tienen longitud y se pueden dibujar. */
export function drawablePositions(chart: NatalChartBase): number {
  return chart.positions.filter(hasLongitude).length;
}

/** Una posición por su clave canónica, o `null` si el contrato no la trae. */
export function positionByKey(chart: NatalChartBase, key: NatalPlanetKey): NatalPosition | null {
  return chart.positions.find((position) => position.key === key) ?? null;
}

export function positionView(position: NatalPosition): NatalPositionView {
  const base = { key: position.key, label: position.label, limitation: position.limitation };

  if (position.precision === "range" && position.possibleSignsEs.length > 0) {
    const signos = listado(position.possibleSignsEs);
    return {
      ...base,
      value: signos,
      tag: "DEPENDE DE LA HORA",
      voice: `${position.label}, entre ${signos}, según la hora del día.`
    };
  }

  if (!position.signEs) {
    return {
      ...base,
      value: "Dato retirado",
      tag: "RETIRADO",
      voice: `${position.label}: dato retirado. ${position.limitation ?? ""}`.trim()
    };
  }

  if (position.precision === "estimated") {
    return {
      ...base,
      value: position.signEs,
      tag: "SIN GRADO",
      voice: `${position.label} en ${position.signEs}. El signo se mantiene todo el día; el grado depende de tu hora.`
    };
  }

  const grado = position.degree === null ? null : `${Math.floor(degreeInSign(position.degree))}°`;
  const partes = [grado ? `${position.signEs} ${grado}` : position.signEs];
  const dichas = [`${position.label} en ${position.signEs}`];
  if (grado) dichas.push(`${Math.floor(degreeInSign(position.degree as number))} grados`);
  if (position.isRetrograde === true) {
    partes.push(RETROGRADE_CODE);
    dichas.push("retrógrado");
  }
  if (position.house !== null) {
    partes.push(`Casa ${position.house}`);
    dichas.push(`casa ${position.house}`);
  }
  return { ...base, value: partes.join(" · "), tag: null, voice: `${dichas.join(", ")}.` };
}

/** Los límites por punto, sin repetir: diez filas suelen declarar el mismo. */
export function positionLimitations(chart: NatalChartBase): string[] {
  const vistos = new Set<string>();
  for (const position of chart.positions) {
    if (position.limitation) vistos.add(position.limitation);
  }
  return Array.from(vistos);
}

// ---------------------------------------------------------------------------
// Ejes, casas y contactos
// ---------------------------------------------------------------------------

export type NatalRowView = { label: string; value: string; voice: string };

/** Ascendente o Medio Cielo: siempre exactos, porque sólo existen con hora. */
export function angleView(angle: NatalAngle): NatalRowView {
  const grado = `${Math.floor(degreeInSign(angle.degree))}°`;
  return {
    label: angle.label,
    value: `${angle.signEs} ${grado}`,
    voice: `${angle.label} en ${angle.signEs}, ${Math.floor(degreeInSign(angle.degree))} grados.`
  };
}

/**
 * En qué estado está un eje, resuelto UNA vez.
 *
 * - `listo` — el cálculo publicó la geometría verificada de ese eje.
 * - `calculando` — la hora exacta está guardada y el eje todavía no llegó. No
 *   falta ningún dato de la persona: falta el cálculo.
 * - `sin-hora` — la carta se calculó sobre el día civil entero. Sin hora no hay
 *   eje posible, y la salida es completar la hora.
 */
export type NatalAngleState = "listo" | "calculando" | "sin-hora";

/** El texto visible de un eje pendiente. Uno solo en toda la Carta. */
export const CALCULANDO_EJE = "Calculando…";

/** El texto visible de un eje que no se puede calcular con los datos guardados. */
export const NECESITA_HORA = "Necesita tu hora";

/**
 * Qué es el Ascendente respecto de las casas, en la columna de la tríada.
 *
 * El Ascendente NO está "en la casa 1": es el grado exacto con el que la casa 1
 * empieza, su cúspide. Escribir `CASA 1` ahí lo trataría como una ubicación —el
 * mismo error que cometía el guion fijo que hubo antes— y dejar la celda vacía
 * hacía leer un dato retenido justo en la fila del eje que sí define el sistema
 * de casas entero. `INICIO CASA 1` dice lo que es: dónde empieza.
 *
 * Sólo corresponde cuando el eje está publicado. Sin hora —o con el cálculo
 * todavía sin publicar la geometría— no hay cúspide que anunciar.
 */
export const ASCENDENTE_INICIO_CASA = "INICIO CASA 1";

/** La misma idea para VoiceOver, dicha una sola vez y pegada a la fila del eje. */
export const ASCENDENTE_INICIO_CASA_VOZ = "Es el grado con el que empieza tu casa 1.";

/** Por qué ese eje no se estima. Cada uno depende de la hora a su manera. */
const SIN_HORA_POR_EJE: Record<NatalAngle["key"], string> = {
  ascendant: "Cambia cada dos horas, así que estimarlo sería inventarlo.",
  mc: "Depende de la hora y el lugar exactos, así que estimarlo sería inventarlo."
};

/**
 * Una fila de eje —valor visible y voz— derivada del MISMO hecho.
 *
 * El defecto que cierra: con hora exacta guardada y los ejes todavía sin
 * publicar, la fila decía `Necesita tu hora` mientras VoiceOver decía que el
 * cálculo no había publicado los ejes. Las dos frases salían de dos ramas
 * distintas, y la visible mandaba a corregir un dato que ya estaba bien.
 */
export function angleRowView(chart: NatalChartBase, key: NatalAngle["key"], label: string): NatalRowView & {
  state: NatalAngleState;
} {
  const angle = publishedAngle(chart, key);
  if (angle) return { state: "listo", ...angleView(angle) };
  if (hasExactBirthTime(chart)) {
    return {
      state: "calculando",
      label,
      value: CALCULANDO_EJE,
      voice: `${label}: el cálculo todavía no publicó los ejes verificados. Tu hora ya está guardada.`
    };
  }
  return {
    state: "sin-hora",
    label,
    value: NECESITA_HORA,
    voice: `${label}: necesita tu hora de nacimiento. ${SIN_HORA_POR_EJE[key]}`
  };
}

/**
 * El eje publicado, o `null`.
 *
 * `access.angles` vale `angles.length > 0` en el contrato: dice si el cálculo
 * publicó la geometría verificada, no si la cuenta tiene acceso. Se pregunta acá
 * para que ninguna pantalla lea la lista por su cuenta.
 */
export function publishedAngle(chart: NatalChartBase, key: NatalAngle["key"]): NatalAngle | null {
  if (!chart.access.angles) return null;
  return chart.angles.find((angle) => angle.key === key) ?? null;
}

/** El comienzo de una casa: el signo y el grado donde arranca, más su área. */
export function houseView(house: NatalHouse): NatalRowView & { theme: string } {
  const grado = Math.floor(degreeInSign(house.degree));
  return {
    label: `CASA ${house.house}`,
    value: `${house.signEs} ${grado}°`,
    theme: house.theme,
    voice: `Casa ${house.house}, empieza en ${house.signEs}, ${grado} grados. ${house.theme}`
  };
}

export type NatalAspectView = {
  key: string;
  /** "Sol cuadratura Luna" — los dos puntos y el ángulo que forman. */
  line: string;
  /** Cuánto le falta al ángulo para ser exacto, o su rango. `null` si no se publicó. */
  orb: string | null;
  voice: string;
};

/**
 * Los contactos con los nombres que ya trae el read-model.
 *
 * Los aspectos referencian los puntos por clave; el nombre visible sale de la
 * misma lista de posiciones, así que la tabla y la rueda nombran igual.
 */
export function aspectViews(chart: NatalChartBase): NatalAspectView[] {
  const nombres = planetLabels(chart);
  return chart.aspects.map((aspect, index) => {
    const from = nombres.get(aspect.from) ?? aspect.from;
    const to = nombres.get(aspect.to) ?? aspect.to;
    const line = `${from} ${aspect.typeEs} ${to}`;
    const orb = orbLabel(aspect);
    return {
      key: `${aspect.from}-${aspect.type}-${aspect.to}-${index}`,
      line,
      orb,
      voice: orb ? `${line}, ${orb.replace("°", " grados")}.` : `${line}.`
    };
  });
}

function orbLabel(aspect: NatalAspect): string | null {
  if (aspect.orb !== null) return `orbe ${formatDecimal(aspect.orb)}°`;
  if (aspect.orbRange) {
    return `orbe entre ${formatDecimal(aspect.orbRange.from)}° y ${formatDecimal(aspect.orbRange.to)}°`;
  }
  return null;
}

/** Nombre visible de cada punto, tomado del propio read-model. */
function planetLabels(chart: NatalChartBase): Map<NatalPlanetKey, string> {
  return new Map(chart.positions.map((position) => [position.key, position.label]));
}

// ---------------------------------------------------------------------------
// La rueda
// ---------------------------------------------------------------------------

const HARMONY_BY_TYPE: Record<NatalAspect["type"], "harmony" | "tension"> = {
  conjunction: "harmony",
  sextile: "harmony",
  trine: "harmony",
  square: "tension",
  opposition: "tension"
};

/**
 * Lo que la rueda necesita, armado desde el read-model.
 *
 * Sólo entran los puntos CON longitud: sin hora exacta el contrato no publica
 * ninguna, así que la rueda queda sin planetas y la pantalla lo dice en vez de
 * dibujar el cielo del mediodía. Sin Ascendente verificado tampoco se rota ni se
 * reparten casas — `buildWheelLayout` ya resuelve las dos omisiones.
 *
 * La tríada del payload existe porque la forma de la rueda la declara; el dibujo
 * no la lee (usa `placements`, `houses` y `aspects`), y las pantallas muestran
 * sus tres puntos directamente desde el read-model.
 */
export function natalWheelPayload(chart: NatalChartBase): NatalChartPayload {
  const nombres = planetLabels(chart);
  const placements: SignPlacement[] = chart.positions.filter(hasLongitude).map(toPlacement);
  const ascendant = publishedAngle(chart, "ascendant");
  const mc = publishedAngle(chart, "mc");
  const aspects: NatalChartAspect[] = chart.aspects.map((aspect) => ({
    from: nombres.get(aspect.from) ?? aspect.from,
    to: nombres.get(aspect.to) ?? aspect.to,
    type: aspect.type,
    typeEs: aspect.typeEs,
    harmony: HARMONY_BY_TYPE[aspect.type],
    orb: aspect.orb ?? undefined,
    isMajor: true
  }));

  return {
    triad: {
      sun: placementFor(chart, "sun"),
      moon: placementFor(chart, "moon"),
      ascendant: ascendant
        ? {
            planet: ascendant.label,
            key: ascendant.key,
            sign: ascendant.signEs,
            house: ascendant.house,
            fullDegree: ascendant.fullDegree,
            normDegree: ascendant.degree
          }
        : { planet: "Ascendente", key: "ascendant", sign: SIN_DATO }
    },
    placements,
    houses: chart.houses.map((house) => ({
      house: house.house,
      sign: house.signEs,
      cusp: house.degree,
      theme: house.theme
    })),
    aspects,
    ascendantDegree: ascendant?.fullDegree,
    mc: mc?.fullDegree,
    accuracy: timeSourceLine(chart),
    limitations: chart.limitations
  };
}

/** Marca de "acá no hay dato", la misma que usa el resto de la carta. */
const SIN_DATO = "—";

function toPlacement(position: NatalPosition): SignPlacement {
  return {
    planet: position.label,
    key: position.key,
    sign: position.signEs ?? SIN_DATO,
    house: position.house ?? undefined,
    fullDegree: position.fullDegree ?? undefined,
    normDegree: position.degree ?? undefined,
    isRetrograde: position.isRetrograde === true
  };
}

function placementFor(chart: NatalChartBase, key: NatalPlanetKey): SignPlacement {
  const position = positionByKey(chart, key);
  return position ? toPlacement(position) : { planet: key, sign: SIN_DATO };
}

// ---------------------------------------------------------------------------

/** "Tauro o Géminis" — la lista de signos posibles, dicha como se habla. */
function listado(values: readonly string[]): string {
  if (values.length <= 1) return values[0] ?? SIN_DATO;
  return `${values.slice(0, -1).join(", ")} o ${values[values.length - 1]}`;
}
