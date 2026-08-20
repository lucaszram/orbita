import { parseDateInput, parseTimeInput } from "@/domain/birthInput";
import { formatCivilDate } from "@/domain/layers";
import type {
  ComparisonLevel,
  RelationshipDimension,
  RelationshipProfile,
  RelationshipProfileId,
  SavePersonArgs
} from "@/services/relationshipsApi";

/**
 * Presentación pura de Vínculos V4.9.2.
 *
 * Sólo TRADUCE lo que el backend ya decidió: el nivel de comparación que los
 * datos cargados permiten y los datos de nacimiento tal como están guardados.
 * No deduce el signo desde la fecha, no completa lo que falta y no convierte
 * una fecha civil en un instante.
 *
 * Es puro a propósito: sin React, sin Convex y sin reloj propio.
 */

/**
 * Cómo se llama cada nivel. Nombra lo que el cálculo COMPARA, no lo que
 * promete: "Signo con signo" deja claro de entrada que ahí no entra nada
 * personal, mientras que "comparación básica" sonaría a una versión reducida de
 * la misma lectura.
 */
export const RELATIONSHIP_LEVEL_LABEL: Record<ComparisonLevel, string> = {
  sign_to_sign: "Signo con signo",
  date_to_date: "Fecha con fecha",
  chart_to_chart: "Carta con carta"
};

/** Qué entra y qué queda afuera en cada nivel, dicho antes de abrir el resultado. */
export const RELATIONSHIP_LEVEL_NOTE: Record<ComparisonLevel, string> = {
  sign_to_sign:
    "Con el signo solo se compara el estilo general —elementos y modalidades—. No entra ninguna posición personal.",
  date_to_date:
    "Con la fecha se cubre toda la franja de ese día y entran únicamente los aspectos y las posiciones que se mantienen durante toda esa franja. La Luna, que se mueve rápido, se muestra como rango o se retira. Las casas y los Ascendentes quedan afuera.",
  chart_to_chart:
    "Con fecha, hora y lugar exactos entran además las casas, los Ascendentes y las superposiciones."
};

/**
 * El número del nivel, tal como se anuncia en pantalla: `01`, `02`, `03`.
 *
 * Es el mismo orden del contrato —lo que cada nivel puede leer crece con el
 * dato cargado— y se muestra como posición dentro de tres, no como puntaje.
 */
export const RELATIONSHIP_LEVEL_RANK: Record<ComparisonLevel, 1 | 2 | 3> = {
  sign_to_sign: 1,
  date_to_date: 2,
  chart_to_chart: 3
};

/** Cuántos niveles hay. Fija el denominador de la barra de nivel. */
export const RELATIONSHIP_LEVEL_COUNT = 3;

/**
 * El nivel como lo escribe el encabezado del frame: `03 · CARTA CONTRA CARTA`.
 *
 * Es una tabla aparte de `RELATIONSHIP_LEVEL_LABEL` a propósito. Ese rótulo se
 * lee dentro de una frase ("permite comparar carta con carta") y por eso usa
 * "con"; el encabezado del canon nombra el MODO del cálculo en mayúsculas y usa
 * "contra". Fundir las dos habría obligado a torcer una de las dos lecturas.
 */
export const RELATIONSHIP_LEVEL_HEADLINE: Record<ComparisonLevel, string> = {
  sign_to_sign: "SIGNO CONTRA SIGNO",
  date_to_date: "FECHA CONTRA FECHA",
  chart_to_chart: "CARTA CONTRA CARTA"
};

/**
 * La línea que sigue a la barra de nivel: qué cargó esta persona y qué se puede
 * leer con eso, en una frase.
 *
 * Dice el DATO ("cargó fecha, hora y lugar") y no el nombre del nivel, que ya
 * está arriba: quien mira tiene que poder saber, sin abrir nada, por qué la
 * pantalla llega hasta donde llega.
 */
export function relationshipLevelSentence(level: ComparisonLevel, name: string): string {
  const quien = name.trim() || "Esta persona";
  if (level === "sign_to_sign") {
    return "Solo tenemos el signo. Alcanza para el choque de estilos, no para leer el vínculo.";
  }
  if (level === "date_to_date") {
    return `${quien} cargó la fecha, no la hora. Se leen los contactos entre las dos cartas; las casas y los ascendentes quedan afuera.`;
  }
  return `${quien} cargó fecha, hora y lugar. Se puede leer todo, incluidas casas y ascendentes.`;
}

/**
 * Qué habilita el dato que falta, para las listas del frame.
 *
 * El reparto es el de la escalera canónica del frame `10 · signo contra signo`,
 * exactamente: con la fecha se agregan `Cómo se cuidan`, `Deseo` y `Fricción`;
 * con la hora y el lugar se agrega `Proyecto en común`, además de las casas y
 * los ascendentes. Una pasada anterior había movido `Proyecto en común` a la
 * primera lista razonando desde el motor; la escalera que se le promete a la
 * persona es la del canon y se respeta como está.
 */
export const RELATIONSHIP_UNLOCK_LABEL = {
  withDate: "CON LA FECHA DE NACIMIENTO SE AGREGAN",
  withTime: "CON LA HORA Y EL LUGAR SE AGREGA"
} as const;

/**
 * Las dimensiones que la escalera canónica promete con la FECHA.
 *
 * No son las cinco: `Cómo se hablan` no está en la escalera porque en el nivel
 * 01 su lugar lo ocupa `Estilo general` —la única lectura disponible con un
 * signo—, y `Proyecto en común` se promete recién con la hora y el lugar.
 */
export const RELATIONSHIP_DATE_UNLOCKS: readonly RelationshipDimensionKey[] = [
  "care",
  "desire",
  "friction"
];

/** Las dimensiones que la escalera canónica promete con la HORA y el LUGAR. */
export const RELATIONSHIP_TIME_UNLOCK_DIMENSIONS: readonly RelationshipDimensionKey[] = [
  "shared_project"
];

/** Lo que sólo aparece con hora y lugar exactos, además de esa dimensión. */
export const RELATIONSHIP_TIME_UNLOCKS = "Casas y ascendentes";

/** `01` · `02` · `03` — el rótulo del encabezado, con cero a la izquierda. */
export function relationshipLevelBadge(level: ComparisonLevel): string {
  return String(RELATIONSHIP_LEVEL_RANK[level]).padStart(2, "0");
}

/** Proporción de la barra de nivel: en qué escalón de tres está este perfil. */
export function relationshipLevelShare(level: ComparisonLevel): number {
  return RELATIONSHIP_LEVEL_RANK[level] / RELATIONSHIP_LEVEL_COUNT;
}

/**
 * Lo que hay que decir ANTES de pedir cada dato: qué pide el nivel, qué suma
 * respecto del anterior y —sobre todo— qué no puede leer.
 *
 * El último campo es el que evita la promesa de más: alguien que carga sólo el
 * signo tiene que saber, antes de guardar, que ahí no entra nada personal de
 * esa persona y que dos personas del mismo signo devuelven exactamente lo
 * mismo. Es la misma regla de las capas —el límite viaja junto al dato—,
 * aplicada al formulario que produce el dato.
 */
export type RelationshipLevelForm = {
  /** Qué datos hay que cargar para alcanzar este nivel. */
  asks: string;
  /** Qué agrega al cálculo respecto del nivel anterior. */
  adds: string;
  /** Qué NO puede leer, aunque los datos estén completos. */
  cannot: string;
  /**
   * Un dato que el nivel puede aprovechar pero NO exige, con lo que cambia si
   * se carga y lo que sigue sin habilitar. `null` cuando el nivel no admite
   * ninguno: un opcional que no cambia nada sería sólo un campo más.
   */
  optional: string | null;
};

export const RELATIONSHIP_LEVEL_FORM: Record<ComparisonLevel, RelationshipLevelForm> = {
  sign_to_sign: {
    asks: "Sólo el signo.",
    adds:
      "Compara el estilo general de los dos signos: el elemento —fuego, tierra, aire, agua— y la modalidad.",
    cannot:
      "No lee nada personal de esa persona: ni sus planetas, ni sus casas, ni su Ascendente. Dos personas del mismo signo dan exactamente el mismo resultado.",
    optional: null
  },
  date_to_date: {
    asks: "El día de nacimiento. La ciudad, si la sabés.",
    adds:
      "Cubre toda la franja de ese día y suma los aspectos y las posiciones que se mantienen durante toda esa franja. Lo que se mueve dentro del día —la Luna, sobre todo— se muestra como rango o se retira.",
    cannot:
      "No lee las casas ni los Ascendentes: eso lo define la hora, y acá no se pide. Nada que pueda cambiar dentro de esa franja se afirma como un valor único.",
    optional:
      "La ciudad de nacimiento es opcional. Si la cargás, la franja se acota a ese día en esa zona horaria; sin ella se cubre la franja posible de esa fecha en cualquier zona. No habilita casas ni Ascendente: eso lo define la hora."
  },
  chart_to_chart: {
    asks: "El día, la hora exacta y la ciudad de nacimiento.",
    adds:
      "Suma las casas, los dos Ascendentes y las superposiciones: qué planeta de una carta cae en qué casa de la otra.",
    cannot:
      "No mide compatibilidad ni anticipa cómo va a salir la relación: cuenta los contactos reales entre las dos cartas y los describe.",
    optional: null
  }
};

/**
 * Las cinco dimensiones del contrato, en el orden en que las publica el
 * backend. Es una tabla de RÓTULOS —no de datos—: sirve para poder nombrarlas
 * cuando el cálculo todavía no puede producirlas, y está tipada contra la clave
 * del contrato, así que si el backend agrega o renombra una, esto deja de
 * compilar en vez de mostrar una lista vieja.
 */
export type RelationshipDimensionKey = RelationshipDimension["key"];

export const RELATIONSHIP_DIMENSION_ORDER: readonly RelationshipDimensionKey[] = [
  "communication",
  "care",
  "desire",
  "friction",
  "shared_project"
];

/**
 * Las dimensiones que la escalera canónica deja bloqueadas en el nivel 01, en
 * el orden en que las lista el frame: primero las tres de la fecha, después la
 * de la hora y el lugar.
 */
export const RELATIONSHIP_LOCKED_DIMENSIONS: readonly RelationshipDimensionKey[] = [
  ...RELATIONSHIP_DATE_UNLOCKS,
  ...RELATIONSHIP_TIME_UNLOCK_DIMENSIONS
];

/**
 * Superficies de la escalera del nivel 01: `Estilo general` —la única que sale
 * del signo solo— más las cuatro que se desbloquean con más datos. Son CINCO,
 * no seis: `Cómo se hablan` no entra en la escalera porque en este nivel su
 * lugar lo ocupa `Estilo general`.
 */
export const RELATIONSHIP_READABLE_COUNT = 1 + RELATIONSHIP_LOCKED_DIMENSIONS.length;

/**
 * Cuántas lecturas quedan apagadas con el signo solo, EN PALABRAS.
 *
 * El número sale del largo de la lista que la pantalla dibuja debajo, no de un
 * literal: así la frase y la lista no pueden divergir, que fue el defecto que
 * hizo decir "las otras cuatro" mientras se listaban cinco. Con la escalera
 * canónica los dos valen cuatro.
 */
export function relationshipLockedDimensionsNote(): string {
  const palabras = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete"];
  const n = RELATIONSHIP_LOCKED_DIMENSIONS.length;
  return `Con el signo solo se puede una dimensión. Las otras ${palabras[n] ?? String(n)} necesitan la fecha completa.`;
}

/**
 * Cuánto ocupa la barra del estilo general: una lectura sobre las cinco
 * superficies de la escalera. Es cuánto se puede LEER con un signo, no cuánto
 * compatibilizan.
 */
export function relationshipGeneralOnlyShare(): number {
  return 1 / RELATIONSHIP_READABLE_COUNT;
}

export const RELATIONSHIP_DIMENSION_LABEL: Record<RelationshipDimensionKey, string> = {
  communication: "Cómo se hablan",
  care: "Cómo se cuidan",
  desire: "Deseo",
  friction: "Fricción",
  shared_project: "Proyecto en común"
};

/**
 * Qué NO se pudo calcular, dicho antes de las causas.
 *
 * Es una sola frase sobre el CÁLCULO, sin atribuir el faltante a nadie: de quién
 * es el dato lo dicen las causas reales (`relationshipGaps`), y decirlo acá fue
 * exactamente el defecto —el nivel 01 sin cálculo culpaba a la fecha de la otra
 * persona aunque lo que faltara fuera la carta propia—.
 */
export function relationshipDimensionsLock(level: ComparisonLevel): string {
  if (level === "sign_to_sign") {
    return "Esta comparación todavía no se pudo calcular, así que no hay una lectura de estilo general que mostrar. No es un resultado en cero: es una lectura que falta.";
  }
  return "Esta comparación todavía no se pudo calcular, así que las cinco dimensiones quedan sin material. No son resultados en cero: son lecturas que faltan.";
}

/**
 * Cuánto ocupa la barra de una dimensión: su cantidad de contactos contra la
 * mayor cantidad VISIBLE en esta misma comparación.
 *
 * Es una proporción entre las cinco dimensiones de la pantalla, no una medida
 * absoluta: la más llena es la que más contactos reunió. Sin contactos en
 * ninguna, todas quedan en cero y se ve el riel vacío.
 */
export function relationshipDriverShare(count: number, max: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(1, count / max));
}

// ---------------------------------------------------------------------------
// El color de cada dimensión
// ---------------------------------------------------------------------------

/**
 * De qué tono se pinta la barra de una dimensión.
 *
 * `fluido` = en esa dimensión pesan más los contactos de apoyo; `tenso` = pesan
 * más los de tensión, o los dos pesan igual. El frame canónico pinta de azul
 * `Cómo se hablan` y `Proyecto en común` de su fixture y de cobre las otras
 * tres: no es un color decorativo ni un color fijo, es la evidencia de cada
 * dimensión.
 */
export type RelationshipDimensionTone = "fluido" | "tenso";

/**
 * El tono de una dimensión, derivado de SU propia evidencia.
 *
 * El backend publica `dimension.value` como el balance del sobre:
 * `0,5 + (apoyo − tensión) / (2 · total)`. Por encima de 0,5 pesan más los
 * contactos de apoyo; por debajo, los de tensión; exactamente 0,5 es empate —o
 * una dimensión sin pesos— y va al mismo tono que la tensión, porque el canon
 * usa el azul sólo para lo francamente fluido y el cobre para tensión y
 * ambivalencia.
 *
 * **No es un puntaje del vínculo.** El LARGO de la barra sigue contando
 * contactos, que es lo que dice la leyenda; el color dice de qué clase son esos
 * contactos. Cada barra lo declara en su etiqueta accesible, y por eso el color
 * no agrega una lectura escondida.
 */
export function relationshipDimensionTone(value: number | null | undefined): RelationshipDimensionTone {
  return typeof value === "number" && Number.isFinite(value) && value > 0.5 ? "fluido" : "tenso";
}

/** El tono dicho en palabras, para la etiqueta que lee un lector de pantalla. */
export function relationshipToneVoice(tone: RelationshipDimensionTone): string {
  return tone === "fluido"
    ? "Pesan más los contactos fluidos que los de tensión"
    : "Pesan tanto o más los contactos de tensión que los fluidos";
}

// ---------------------------------------------------------------------------
// Qué mostrar cuando el cálculo no llegó
// ---------------------------------------------------------------------------

/**
 * Qué cuerpo corresponde mostrar, mirando el nivel guardado Y si hubo cálculo.
 *
 * Antes esto se derivaba SÓLO de `data?.generalOnly`. Con el sobre sin datos ese
 * campo no existe, así que un nivel 01 sin cálculo caía en la rama de las cinco
 * dimensiones y dibujaba cinco barras en cero: presentaba como resultado
 * calculado algo que nunca se calculó, y encima con la leyenda equivocada.
 */
export type RelationshipResultMode =
  /** Hay cálculo y llegó hasta el estilo general de los dos signos. */
  | "general"
  /** Hay cálculo con las dimensiones de contacto. */
  | "dimensiones"
  /** No hay cálculo, y el nivel guardado sólo permitía el estilo general. */
  | "general-sin-calculo"
  /** No hay cálculo, y el nivel guardado permitía las dimensiones. */
  | "dimensiones-sin-calculo";

export function relationshipResultMode(args: {
  /** El nivel que permiten los datos guardados de esa persona. */
  level: ComparisonLevel;
  /** El cálculo del sobre, o `null` si no hay ninguno. */
  data: { generalOnly: boolean; dimensions: readonly unknown[] } | null | undefined;
}): RelationshipResultMode {
  if (args.data) {
    return args.data.generalOnly || args.data.dimensions.length === 0 ? "general" : "dimensiones";
  }
  return args.level === "sign_to_sign" ? "general-sin-calculo" : "dimensiones-sin-calculo";
}

/** ¿Este modo muestra la lectura general en vez de las dimensiones? */
export function relationshipModeIsGeneral(mode: RelationshipResultMode): boolean {
  return mode === "general" || mode === "general-sin-calculo";
}

/** ¿Este modo tiene un cálculo detrás? */
export function relationshipModeHasCalculation(mode: RelationshipResultMode): boolean {
  return mode === "general" || mode === "dimensiones";
}

/** De quién es el dato que falta. Decide a quién se le puede pedir algo. */
export type RelationshipGapOwner =
  /** Falta un dato TUYO (tu carta, tu signo, tu hora exacta). */
  | "propio"
  /** Falta un dato de la persona guardada. */
  | "otra"
  /** No faltan datos: falló el proveedor de posiciones. */
  | "proveedor"
  /** El sobre no permite decidir de quién es. */
  | "indeterminado";

export type RelationshipGap = { reason: string; owner: RelationshipGapOwner };

/**
 * Traducción de los `missingInputs` de una comparación.
 *
 * Vive acá y no en `missingReasons` porque estos códigos son de Vínculos y
 * llevan una información que ninguna otra capa tiene: DE QUIÉN es el dato que
 * falta. Sin eso la pantalla decía "falta la fecha de nacimiento de esta
 * persona" cuando lo que faltaba era la carta propia, y ofrecía ir a completar
 * los datos de alguien que ya los tenía completos.
 *
 * `exact_birth_time_and_place` es el único ambiguo —el backend lo emite tanto
 * por la hora propia como por la de la otra persona—, así que se resuelve con
 * el perfil guardado: si esa persona ya cargó hora exacta y lugar, el faltante
 * es propio.
 */
export function relationshipGaps(
  envelope: { missingInputs: readonly string[]; limitations: readonly string[] },
  profile: RelationshipProfile
): RelationshipGap[] {
  const otraTieneHoraYLugar =
    profile.birthTimePrecision === "known" &&
    Boolean(profile.birthTime) &&
    Boolean(profile.birthPlaceLabel);

  const vistos = new Set<string>();
  const gaps: RelationshipGap[] = [];
  const agregar = (gap: RelationshipGap | null) => {
    if (!gap || vistos.has(gap.reason)) return;
    vistos.add(gap.reason);
    gaps.push(gap);
  };

  for (const code of envelope.missingInputs) {
    switch (code) {
      case "own_natal_chart":
        agregar({
          reason:
            "Todavía no hay una carta natal calculada para tu cuenta: sin ella no hay contra qué comparar.",
          owner: "propio"
        });
        break;
      case "own_sun_sign":
        agregar({
          reason: "Todavía no hay un signo solar verificado en tu carta.",
          owner: "propio"
        });
        break;
      case "other_sun_sign":
        agregar({
          reason: `Falta el signo solar de ${nombreDe(profile)}.`,
          owner: "otra"
        });
        break;
      case "birth_date":
        agregar({
          reason: `Falta la fecha de nacimiento de ${nombreDe(profile)}.`,
          owner: "otra"
        });
        break;
      case "comparison_ephemeris":
        agregar({
          reason:
            "No pudimos traer las posiciones que necesita esta comparación. No es un dato que falte: es el cálculo que no se pudo completar.",
          owner: "proveedor"
        });
        break;
      case "exact_birth_time_and_place":
        agregar(
          otraTieneHoraYLugar
            ? {
                reason:
                  "Falta tu hora exacta y tu lugar de nacimiento: sin ellos no hay casas ni Ascendente propios que comparar.",
                owner: "propio"
              }
            : {
                reason: `Faltan la hora exacta y el lugar de nacimiento de ${nombreDe(profile)}.`,
                owner: "otra"
              }
        );
        break;
      case "unambiguous_birth_instant":
        agregar({
          reason:
            "Una de las horas guardadas cae en un cambio de horario y no se puede ubicar en un instante único.",
          owner: "indeterminado"
        });
        break;
      default:
        break;
    }
  }

  if (gaps.length > 0) return gaps;
  for (const limitacion of envelope.limitations.slice(0, 2)) {
    agregar({ reason: limitacion, owner: "indeterminado" });
  }
  if (gaps.length > 0) return gaps;
  return [
    {
      reason: "Todavía no hay una comparación calculada para esta persona.",
      owner: "indeterminado"
    }
  ];
}

/**
 * ¿Se puede ofrecer "completar sus datos" por este faltante?
 *
 * Sólo si alguno de los huecos es de esa persona. Ofrecerlo por un faltante
 * propio —o por un proveedor caído— manda a editar datos que ya estaban bien.
 */
export function relationshipGapsBlameOther(gaps: readonly RelationshipGap[]): boolean {
  return gaps.some((gap) => gap.owner === "otra");
}

/** ¿Alguno de los huecos es un dato TUYO? Habilita ir a tus datos, no a los suyos. */
export function relationshipGapsBlameOwn(gaps: readonly RelationshipGap[]): boolean {
  return gaps.some((gap) => gap.owner === "propio");
}

/** El nombre guardado, o una referencia neutra cuando no hay ninguno. */
function nombreDe(profile: RelationshipProfile): string {
  const nombre = profile.name?.trim();
  return nombre ? nombre : "esta persona";
}

/**
 * Lo que el resultado NO dice, cuando el sobre no trae su propio texto.
 *
 * El backend publica `disclaimer` con cada comparación nueva; los cachés
 * anteriores a V4.9.2 pueden no tenerlo, y ahí entra esta línea. No es un
 * relleno editorial: es el mismo límite, escrito una sola vez.
 */
export const RELATIONSHIP_COMPARISON_DISCLAIMER =
  "Esto muestra patrones simbólicos entre dos cartas. No mide amor, compatibilidad ni cuánto puede durar una relación.";

export function relationshipDisclaimer(disclaimer: string | null | undefined): string {
  const propio = disclaimer?.trim();
  return propio ? propio : RELATIONSHIP_COMPARISON_DISCLAIMER;
}

/**
 * Lo que NO dice una comparación de nivel 01.
 *
 * El descargo del sobre habla de "las dos cartas", y en signo contra signo no
 * hay dos cartas: hay dos signos. Decirlo con el texto general dejaría creer
 * que algo personal de esa persona entró en el cálculo, que es exactamente lo
 * que este nivel no hace.
 */
export const RELATIONSHIP_GENERAL_ONLY_DISCLAIMER =
  "Con el signo solo, esto es astrología general: no usa nada propio de ninguno de los dos más allá del signo de nacimiento.";

const SIGN_LABEL: Record<string, string> = {
  aries: "Aries",
  taurus: "Tauro",
  gemini: "Géminis",
  cancer: "Cáncer",
  leo: "Leo",
  virgo: "Virgo",
  libra: "Libra",
  scorpio: "Escorpio",
  sagittarius: "Sagitario",
  capricorn: "Capricornio",
  aquarius: "Acuario",
  pisces: "Piscis"
};

/**
 * Los doce signos en orden zodiacal, con la clave EXACTA que acepta y publica
 * el backend. El selector del formulario se dibuja desde acá: así lo que se
 * elige en pantalla y lo que se guarda son el mismo valor, y no hay una tabla
 * paralela que se pueda desincronizar de `relationshipSignLabel`.
 */
const SIGN_ORDER = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces"
] as const;

export type RelationshipSignKey = (typeof SIGN_ORDER)[number];

export const RELATIONSHIP_SIGNS: ReadonlyArray<{ key: RelationshipSignKey; label: string }> =
  SIGN_ORDER.map((key) => ({ key, label: SIGN_LABEL[key] }));

/**
 * El signo guardado, en castellano. El backend lo publica con su clave canónica
 * (`taurus`), que es jerga de motor: si no está en la tabla se devuelve `null` y
 * la pantalla no muestra nada, en vez de imprimir la clave cruda.
 */
export function relationshipSignLabel(sign: string | null): string | null {
  return sign ? SIGN_LABEL[sign] ?? null : null;
}

/** El signo guardado como clave elegible del selector, o `null` si no es una. */
export function relationshipSignKey(sign: string | null): RelationshipSignKey | null {
  return SIGN_ORDER.find((key) => key === sign) ?? null;
}

/**
 * Un `profileId` que llegó por URL vale lo que valga en TU lista.
 *
 * Es la única conversión autorizada de string a persona guardada, y por eso
 * vive acá: la usan la comparación —que lo recibe como segmento de ruta— y el
 * formulario —que lo recibe como parámetro de búsqueda para editar—, y las dos
 * tienen que aceptar y rechazar exactamente lo mismo. `undefined` cuando la
 * lista todavía no llegó; `null` cuando ese id no está en ella.
 */
export function findRelationshipProfile(
  profiles: readonly RelationshipProfile[] | undefined,
  rawProfileId: string | null | undefined
): RelationshipProfile | null | undefined {
  if (profiles === undefined) return undefined;
  const buscado = typeof rawProfileId === "string" ? rawProfileId.trim() : "";
  if (!buscado) return null;
  return profiles.find((profile) => profile.profileId === buscado) ?? null;
}

/**
 * Cómo se encabeza la comparación: el canon `VOS Y …` del frame V4.9.2.
 *
 * En el **nivel 01** el encabezado es siempre `VOS Y ALGUIEN DE TAURO`, aunque
 * el perfil tenga un nombre guardado. Ese nivel no compara personas: compara
 * signos, y lo declara su propio descargo ("sin la fecha completa no describe
 * un vínculo concreto"). Encabezarlo con el nombre presentaba una lectura
 * general como si fuera de esa persona. Desde el nivel 02, donde el cálculo sí
 * usa sus datos, se nombra a la persona.
 *
 * Es una REGLA y por eso vive acá: la pantalla sólo la muestra.
 */
export function relationshipHeadline(profile: RelationshipProfile): string {
  const signo = relationshipSignLabel(profile.zodiacSign);
  const porSigno = signo ? `VOS Y ALGUIEN DE ${signo.toLocaleUpperCase("es")}` : "VOS Y ESTA PERSONA";
  if (profile.availableLevel === "sign_to_sign") return porSigno;
  const nombre = profile.name?.trim();
  return nombre ? `VOS Y ${nombre.toLocaleUpperCase("es")}` : porSigno;
}

/**
 * Qué datos hay cargados de esa persona, exactamente los que hay.
 *
 * La hora sólo se muestra cuando el perfil declara una precisión, y una hora
 * aproximada se dice aproximada: mostrarla igual que una exacta haría creer que
 * la comparación puede usar casas cuando no puede. Sin fecha se cae al signo,
 * que es el único dato verificable de ese perfil. `null` cuando no hay nada
 * que mostrar.
 */
export function relationshipBirthLine(profile: RelationshipProfile): string | null {
  const fecha = profile.birthDate ? formatCivilDate(profile.birthDate) : null;
  const hora =
    profile.birthTime && profile.birthTimePrecision !== "unknown"
      ? profile.birthTimePrecision === "approximate"
        ? `${profile.birthTime} (aproximada)`
        : profile.birthTime
      : null;
  const partes = fecha
    ? [fecha, hora, profile.birthPlaceLabel]
    : [relationshipSignLabel(profile.zodiacSign)];
  const visibles = partes.filter((parte): parte is string => Boolean(parte));
  return visibles.length > 0 ? visibles.join(" · ") : null;
}

// ---------------------------------------------------------------------------
// Alta de una persona: del borrador de pantalla a los argumentos del contrato
// ---------------------------------------------------------------------------

/** El buscador de ciudades es Photon (Komoot, sobre OpenStreetMap). */
const PLACE_PROVIDER = "photon";

/** Una ciudad ELEGIDA en el buscador, con las coordenadas que trajo. */
export type RelationshipPlaceChoice = {
  label: string;
  latitude: number;
  longitude: number;
};

/**
 * Lo que la persona cargó en pantalla. Cada campo puede estar vacío: el
 * borrador describe el estado del formulario, no una persona guardable.
 */
export type RelationshipDraft = {
  level: ComparisonLevel;
  name: string;
  /** Nivel signo: una de las doce claves canónicas, elegida a mano. */
  zodiacSign: RelationshipSignKey | null;
  /** `YYYY-MM-DD` */
  birthDate: string | null;
  /** `HH:MM` */
  birthTime: string | null;
  place: RelationshipPlaceChoice | null;
};

/** Un borrador vacío: el punto de partida del alta, sin nada preseleccionado. */
export function emptyRelationshipDraft(): RelationshipDraft {
  return {
    level: "sign_to_sign",
    name: "",
    zodiacSign: null,
    birthDate: null,
    birthTime: null,
    place: null
  };
}

/**
 * El borrador que corresponde a una persona YA guardada, para editarla o para
 * subirle el nivel sin cargar todo de nuevo.
 *
 * Muestra exactamente lo guardado y nada más: el nivel que esos datos permiten
 * —no el que se querría alcanzar—, el signo sólo si es una de las doce claves
 * del selector, y la ciudad sólo si además de coordenadas tiene una etiqueta
 * que mostrar. Un lugar sin etiqueta se deja vacío para que se vuelva a elegir:
 * una tarjeta de ciudad en blanco no es un dato, es un hueco.
 */
export function relationshipDraftFromProfile(profile: RelationshipProfile): RelationshipDraft {
  const label = profile.birthPlaceLabel?.trim() ?? "";
  const { latitude, longitude } = profile;
  return {
    level: profile.availableLevel,
    name: profile.name,
    zodiacSign: relationshipSignKey(profile.zodiacSign),
    birthDate: profile.birthDate,
    birthTime: profile.birthTimePrecision === "unknown" ? null : profile.birthTime,
    place:
      label && typeof latitude === "number" && typeof longitude === "number"
        ? { label, latitude, longitude }
        : null
  };
}

/**
 * Qué le falta al borrador para poder guardarse en el nivel elegido, dicho en
 * una línea. `null` significa que está completo.
 *
 * Es lo único que decide si Guardar se habilita, y por eso vive acá y no en la
 * pantalla: el mensaje que explica el bloqueo y la condición que lo produce
 * tienen que ser el MISMO hecho, o el botón queda apagado sin razón visible.
 */
export function relationshipDraftBlock(draft: RelationshipDraft): string | null {
  if (!draft.name.trim()) return "Escribí un nombre para guardar a esta persona.";

  if (draft.level === "sign_to_sign") {
    return draft.zodiacSign ? null : "Elegí uno de los doce signos.";
  }

  if (!draft.birthDate || !parseDateInput(draft.birthDate)) {
    return "Elegí la fecha de nacimiento de esa persona.";
  }
  if (draft.level === "date_to_date") return null;

  if (!draft.birthTime || !parseTimeInput(draft.birthTime)) {
    return "Elegí la hora exacta de nacimiento: sin ella no hay casas ni Ascendente que comparar.";
  }
  if (!draft.place) {
    return "Elegí la ciudad de nacimiento en el buscador: de sus coordenadas sale la zona horaria del cálculo.";
  }
  return null;
}

/** Lo que se manda a guardar, sin la clave que identifica al INTENTO. */
type RelationshipSavePayload = Omit<SavePersonArgs, "idempotencyKey">;

/**
 * El pedido que corresponde a este borrador, o `null` si no se puede guardar.
 *
 * Acá está la regla entera de honestidad del alta, en un solo lugar y sin
 * React de por medio:
 *
 * - **Signo**: se guarda el signo elegido y NADA más. No hay fecha, hora, lugar
 *   ni precisión: `unknown` es la verdad.
 * - **Fecha**: se guarda el día. No se deriva el signo desde la fecha —eso
 *   convertiría un dato genérico en uno que parece calculado— y no se inventa
 *   una hora: `unknown` otra vez, pase lo que pase con el lugar. Si además se
 *   eligió una ciudad, viajan sus coordenadas y su zona ya resuelta: acotan la
 *   franja del día a esa zona en vez de cubrir la franja posible de cualquier
 *   zona. Sin hora exacta no habilitan nada más, y `unknown` impide que el
 *   backend calcule casas o Ascendente con ellas.
 * - **Carta completa**: además del día y la hora exacta, la ciudad elegida con
 *   sus coordenadas y la zona horaria YA resuelta a partir de ellas. Sin esa
 *   zona devuelve `null` y no se guarda nada: fallar cerrado. La zona nunca
 *   sale del reloj del dispositivo, que para alguien nacido en otra zona es la
 *   equivocada.
 *
 * Los campos que el nivel no puede sostener viajan en `null` explícito, no
 * omitidos: al editar una persona eso los limpia en vez de dejar restos de un
 * nivel anterior conviviendo con los datos nuevos. `profileId` es justamente lo
 * contrario: cuando se está editando viaja siempre, porque es lo único que hace
 * que esta persona se actualice en vez de duplicarse.
 */
function relationshipSavePayload(
  draft: RelationshipDraft,
  /** Zona IANA del LUGAR, resuelta en el backend desde sus coordenadas. */
  resolvedTimezone: string | null,
  /** La persona que se está editando, o `null` si es un alta. */
  profileId: RelationshipProfileId | null
): RelationshipSavePayload | null {
  if (relationshipDraftBlock(draft) !== null) return null;

  const sinDatos = {
    ...(profileId ? { profileId } : {}),
    birthDate: null,
    birthTime: null,
    birthPlaceLabel: null,
    placeId: null,
    placeProvider: null,
    latitude: null,
    longitude: null,
    timezone: null,
    zodiacSign: null
  };
  const name = draft.name.trim();
  const timezone = (resolvedTimezone ?? "").trim();

  if (draft.level === "sign_to_sign") {
    return { ...sinDatos, name, birthTimePrecision: "unknown", zodiacSign: draft.zodiacSign };
  }
  if (draft.level === "date_to_date") {
    const soloFecha = {
      ...sinDatos,
      name,
      birthTimePrecision: "unknown" as const,
      birthDate: draft.birthDate
    };
    if (!draft.place) return soloFecha;
    // La ciudad es opcional, pero elegida sin poder resolver su zona no sirve
    // para lo único que hace acá —acotar la franja del día—, así que tampoco se
    // guarda a medias: se falla cerrado igual que en carta completa.
    if (!timezone) return null;
    return {
      ...soloFecha,
      birthPlaceLabel: draft.place.label,
      placeProvider: PLACE_PROVIDER,
      latitude: draft.place.latitude,
      longitude: draft.place.longitude,
      timezone
    };
  }

  if (!timezone || !draft.place || !draft.birthDate || !draft.birthTime) return null;
  return {
    ...sinDatos,
    name,
    birthDate: draft.birthDate,
    birthTime: draft.birthTime,
    birthTimePrecision: "known",
    birthPlaceLabel: draft.place.label,
    placeProvider: PLACE_PROVIDER,
    latitude: draft.place.latitude,
    longitude: draft.place.longitude,
    timezone
  };
}

/**
 * Argumentos completos de `relationships.savePerson`: el pedido de este
 * borrador más la clave del intento que lo manda. `null` si no se puede
 * guardar, por la misma regla de arriba.
 *
 * La clave NO describe ni identifica a la persona: identifica al INTENTO de
 * guardarla. El backend la usa para reconocer un reintento del mismo pedido y
 * devolver la persona que ya creó, en vez de crear una segunda idéntica cuando
 * la primera respuesta se perdió en el camino. Quién es esa persona lo sigue
 * diciendo el `profileId` que devuelve el backend, y sólo él.
 */
export function relationshipSaveArgs(
  draft: RelationshipDraft,
  resolvedTimezone: string | null,
  profileId: RelationshipProfileId | null,
  idempotencyKey: string
): SavePersonArgs | null {
  const payload = relationshipSavePayload(draft, resolvedTimezone, profileId);
  return payload ? { ...payload, idempotencyKey } : null;
}

/**
 * La huella de lo que se va a mandar: el mismo pedido —misma persona editada o
 * la misma alta, con los mismos datos exactos— da la misma huella. `null`
 * cuando no hay pedido posible.
 *
 * Se firma el pedido YA armado y no lo tipeado: `"Ana "` y `"Ana"` producen el
 * mismo pedido, y corregir un espacio antes de reintentar tiene que seguir
 * siendo el mismo intento. Los campos se ordenan para que la huella no dependa
 * del orden en que se armó el objeto, y se recorre el pedido entero en vez de
 * una lista de campos aparte: si el contrato agrega uno, entra solo.
 */
export function relationshipSaveSignature(
  draft: RelationshipDraft,
  resolvedTimezone: string | null,
  profileId: RelationshipProfileId | null
): string | null {
  const payload = relationshipSavePayload(draft, resolvedTimezone, profileId);
  if (!payload) return null;
  return Object.entries(payload)
    .map(([campo, valor]) => `${campo}=${JSON.stringify(valor ?? null)}`)
    .sort()
    .join("|");
}

/** Un pedido que ya viajó: su huella y la clave con la que viajó. */
export type RelationshipSaveIntent = {
  /** Lo que devolvió `relationshipSaveSignature` para ese pedido. */
  signature: string;
  /** La clave que el backend ya vio asociada a esa huella. */
  idempotencyKey: string;
};

/** Prefijo de la clave: dice de qué flujo salió y nada más. */
const SAVE_INTENT_PREFIX = "orbita-vinculo-";

/**
 * Una clave nueva para un intento nuevo.
 *
 * Es opaca a propósito: no lleva nada de la persona, del dispositivo ni del
 * reloj. No se muestra en pantalla y no nombra a nadie —sólo distingue este
 * pedido del siguiente—. El azar entra por parámetro, como en el id del alta,
 * para que la función se pueda verificar sin depender de `Math.random`.
 */
export function createRelationshipIdempotencyKey(random: () => number = Math.random): string {
  const bloque = () => Math.floor(random() * 0xffffffff).toString(36).padStart(7, "0");
  return `${SAVE_INTENT_PREFIX}${bloque()}${bloque()}`;
}

// ---------------------------------------------------------------------------
// El resumen general: hechos, nunca un puntaje
// ---------------------------------------------------------------------------

/** La forma mínima que el resumen necesita: no importa de qué API venga. */
export type RelationshipSummaryDimension = {
  label: string;
  value?: number | null;
  /** Cada contacto YA es la frase del canon ("Su Venus forma un trígono con tu Sol, …"). */
  drivers: ReadonlyArray<string>;
};

/**
 * Extrae el nombre corto de un contacto desde su frase canónica.
 *
 * El contrato publica los contactos como PROSA —"Su Venus forma un trígono con
 * tu Sol, un contacto de 120°; …" / "Su Sol cae en tu casa 7, vinculada…"—, no
 * como estructura. La voz de esas frases es estable y está fijada por sus
 * propios tests, así que el nombre se extrae de ahí; si la frase no matchea, el
 * resumen cae a su versión contable en vez de inventar.
 */
export function relationshipDriverShortName(texto: string): string | null {
  const aspecto = texto.match(
    /^(Su|Tu)\s+([A-Za-zÁÉÍÓÚÜáéíóúü]+)\s+(?:forma|hace)?[^,;.]*?\bcon\s+(su|tu)\s+([A-Za-zÁÉÍÓÚÜáéíóúü]+)/u
  );
  if (aspecto) {
    return `${aspecto[1].toLowerCase()} ${aspecto[2]} con ${aspecto[3].toLowerCase()} ${aspecto[4]}`;
  }
  const casa = texto.match(/^(Su|Tu)\s+([A-Za-zÁÉÍÓÚÜáéíóúü]+)\s+cae en\s+(su|tu)\s+casa\s+(\d+)/u);
  if (casa) {
    return `${casa[1].toLowerCase()} ${casa[2]} en ${casa[3].toLowerCase()} casa ${casa[4]}`;
  }
  return null;
}

export type RelationshipComparisonSummary = {
  contactos: number;
  fluidas: number;
  tensas: number;
  /** Hasta dos dimensiones, las que más contactos reúnen. */
  destacadas: string[];
  /**
   * Los contactos que MÁS pesan entre estas dos cartas, ya nombrados con la voz
   * del canon ("su Venus con tu Sol") y su dimensión. Es lo que vuelve el
   * resumen puntual de ESTE vínculo en vez de una estadística genérica.
   */
  principales: { contacto: string; dimension: string }[];
};

/**
 * Qué hay entre las dos cartas, en números REALES: cuántos contactos, cuántas
 * dimensiones inclinan a lo fluido o a la tensión, y dónde se concentra el
 * material. Existe porque a la pantalla le faltaba una lectura general antes de
 * las cinco dimensiones (2026-08-19) — y es factual a propósito: un resumen con
 * nota sería el puntaje global de compatibilidad que este producto prohíbe.
 *
 * `null` cuando no hay nada que resumir: la lectura de un signo solo es una
 * única fila, y una comparación sin contactos ya lo dice fila por fila.
 */
export function relationshipComparisonSummary(data: {
  generalOnly?: boolean;
  dimensions: ReadonlyArray<RelationshipSummaryDimension>;
}): RelationshipComparisonSummary | null {
  if (data.generalOnly) return null;
  const conMaterial = data.dimensions.filter((dimension) => dimension.drivers.length > 0);
  const contactos = conMaterial.reduce((total, dimension) => total + dimension.drivers.length, 0);
  if (contactos === 0) return null;

  let fluidas = 0;
  let tensas = 0;
  for (const dimension of conMaterial) {
    if (relationshipDimensionTone(dimension.value) === "fluido") fluidas += 1;
    else tensas += 1;
  }
  const destacadas = [...conMaterial]
    .sort((a, b) => b.drivers.length - a.drivers.length)
    .slice(0, 2)
    .map((dimension) => dimension.label);

  // El contacto PRINCIPAL de cada dimensión destacada, nombrado. Los drivers
  // llegan ordenados por peso dentro de su dimensión, así que el primero es el
  // que más pesa — el mismo que la pantalla muestra arriba.
  const porMaterial = [...conMaterial].sort((a, b) => b.drivers.length - a.drivers.length);
  const principales: { contacto: string; dimension: string }[] = [];
  for (const dimension of porMaterial) {
    if (principales.length === 2) break;
    const nombre = relationshipDriverShortName(dimension.drivers[0] ?? "");
    if (nombre) principales.push({ contacto: nombre, dimension: dimension.label });
  }

  return { contactos, fluidas, tensas, destacadas, principales };
}

/**
 * La frase del resumen: PUNTUAL de este vínculo, no genérica. Abre nombrando
 * los contactos que más pesan entre estas dos cartas y recién después dice el
 * balance. Sin nota, sin porcentaje, sin "compatibilidad".
 */
export function relationshipSummaryLine(resumen: RelationshipComparisonSummary): string {
  const balance =
    resumen.fluidas > resumen.tensas
      ? "pesan más los fluidos: las vías de encuentro aparecen con más fuerza que los roces"
      : resumen.tensas > resumen.fluidas
        ? "pesan más los de tensión: los puntos a tramitar aparecen con más fuerza que las vías de encuentro"
        : "lo fluido y la tensión pesan parecido";
  const cuenta =
    resumen.contactos === 1
      ? `Es el único contacto real entre las dos cartas.`
      : `En total hay ${resumen.contactos} contactos reales y ${balance}.`;

  if (resumen.principales.length === 0) {
    // Sin labels para nombrar (no debería pasar con el contrato actual): la
    // versión contable sigue siendo verdadera.
    const foco =
      resumen.destacadas.length === 2
        ? `El material se concentra en ${resumen.destacadas[0]} y ${resumen.destacadas[1]}.`
        : `El material se concentra en ${resumen.destacadas[0]}.`;
    return `${cuenta} ${foco}`;
  }

  const nombres = resumen.principales
    .map((item) => `${item.contacto}, en ${item.dimension}`)
    .join(", y ");
  return `Lo que más define este vínculo: ${nombres}. ${cuenta}`;
}
