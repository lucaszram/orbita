import { parseDateInput, parseTimeInput } from "@/domain/birthInput";
import { formatCivilDate } from "@/domain/layers";
import {
  readRelationshipType,
  relationshipTypeAllowsDesire,
  relationshipTypeSaveField,
  RELATIONSHIP_NEUTRAL_DESIRE_LABEL,
  type RelationshipTypeKey
} from "@/domain/relationshipType";
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

export const RELATIONSHIP_DIMENSION_LABEL: Record<RelationshipDimensionKey, string> = {
  communication: "Cómo se hablan",
  care: "Cómo se cuidan",
  desire: "Deseo",
  friction: "Fricción",
  shared_project: "Proyecto en común"
};

/**
 * Cómo se llama una dimensión PARA ESTE VÍNCULO (QA23-004).
 *
 * La tabla de arriba es el vocabulario completo del cálculo —las cinco
 * dimensiones existen siempre y se calculan siempre—; esto es cómo se NOMBRAN
 * según el tipo declarado. `Deseo` sólo se puede escribir con un vínculo
 * romántico declarado; en todo lo demás —los otros seis tipos,
 * `prefer_not_to_say` y el legacy `null`— la misma dimensión se llama
 * `Energía compartida`, que es el literal que el motor ya publica en el sobre.
 *
 * El cálculo no cambia: cambian el rótulo y la voz. Lo que se muestra son los
 * mismos contactos, con las mismas identidades y los mismos pesos.
 */
export function relationshipDimensionLabel(
  key: RelationshipDimensionKey,
  type: RelationshipTypeKey | null
): string {
  if (key === "desire" && !relationshipTypeAllowsDesire(type)) {
    return RELATIONSHIP_NEUTRAL_DESIRE_LABEL;
  }
  return RELATIONSHIP_DIMENSION_LABEL[key];
}

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

// ---------------------------------------------------------------------------
// Qué vas a ver, y qué no (QA22-014)
// ---------------------------------------------------------------------------

/**
 * El descargo del alta, con jerarquía progresiva.
 *
 * En el build 22 el bloque se titulaba `LO QUE ESTE CÁLCULO NO DICE` en medio
 * del alta y no se entendía si explicaba qué compara la lectura, una limitación
 * del cálculo o una advertencia legal (QA22-014). Ahora son DOS piezas con dos
 * funciones distintas y en ese orden: primero qué información usa esta lectura,
 * y detrás —a un toque— qué no puede afirmar.
 *
 * Los dos rótulos viven acá y no en la pantalla porque son copy exigido y
 * literal: si se escribieran sueltos, cualquier pasada podría reescribirlos sin
 * que nada lo note.
 */
export const RELATIONSHIP_WHAT_YOU_SEE_LABEL = "QUÉ VAS A VER";

export const RELATIONSHIP_READING_LIMITS_LABEL = "LÍMITES DE ESTA LECTURA";

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

/**
 * El mismo límite para un vínculo que no se declaró romántico.
 *
 * "No mide amor" no es lo que hay que decirle a alguien que guardó a su hermana
 * o a un socio: nombra un plano que esa persona no pidió leer. El hecho es el
 * mismo —esto no mide el vínculo ni predice cuánto dura—, dicho sin suponer de
 * qué vínculo se trata. Es la misma pareja de textos que el motor publica en
 * `disclaimer`; esta versión sólo cubre los cachés viejos, que no lo traen.
 */
export const RELATIONSHIP_NEUTRAL_COMPARISON_DISCLAIMER =
  "Esto muestra patrones simbólicos entre dos cartas. No mide el valor del vínculo, no decide si son compatibles y no predice cuánto puede durar.";

export function relationshipDisclaimer(
  disclaimer: string | null | undefined,
  type: RelationshipTypeKey | null = null
): string {
  const propio = disclaimer?.trim();
  if (propio) return propio;
  return relationshipTypeAllowsDesire(type)
    ? RELATIONSHIP_COMPARISON_DISCLAIMER
    : RELATIONSHIP_NEUTRAL_COMPARISON_DISCLAIMER;
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
// Rutas de Vínculos: dónde termina un guardado y dónde se editan los datos
// ---------------------------------------------------------------------------

/** La raíz de la sección: tu patrón relacional y la lista de tus personas. */
export const VINCULOS_ROUTE = "/vinculos";

/** El formulario de datos de una persona. Sin id, es un alta. */
export const VINCULOS_FORM_ROUTE = "/vinculos/conectar";

/**
 * El PERFIL canónico de una persona guardada (QA23-005).
 *
 * Es la superficie de esa persona y el destino de todo guardado: quién es, qué
 * datos quedaron cargados y qué vínculo se declaró. Desde acá cuelgan sus dos
 * acciones —ver la comparación y editar los datos—, así que una fila de la lista,
 * un deep link y el final de un alta llegan todos al mismo lugar.
 */
export function relationshipProfileHref(profileId: string): string {
  return `${VINCULOS_ROUTE}/${profileId}`;
}

/**
 * La comparación de esa persona, como ruta HIJA de su perfil (QA23-005).
 *
 * La jerarquía es el punto: la comparación es UNA de las cosas que se pueden
 * hacer con una persona guardada, no la persona. Colgándola del perfil, "volver"
 * cae en el perfil —que es de donde se abrió— en vez de saltar a la raíz global,
 * y el guardado deja de competir con ella por el mismo destino.
 */
export function relationshipComparisonHref(profileId: string): string {
  return `${relationshipProfileHref(profileId)}/comparacion`;
}

/** Si ese guardado fue un alta o una edición: cambian la confirmación. */
export const RELATIONSHIP_SAVED_MODE_PARAM = "modo";

export type RelationshipSaveMode = "alta" | "edicion";

/**
 * El formulario de ESA persona, precompletado (QA22-018 / QA22-023).
 *
 * Es el único destino de "Completar sus datos" y de "Editar datos de …": los dos
 * abren lo mismo, porque son lo mismo. El id viaja como parámetro y la pantalla
 * lo valida contra la lista autorizada de la cuenta antes de abrir nada.
 */
export function relationshipEditHref(profileId: string): string {
  return `${VINCULOS_FORM_ROUTE}?profileId=${profileId}`;
}

/**
 * Dónde termina un guardado: el PERFIL de esa persona, declarando qué acaba de
 * pasar (QA23-005).
 *
 * Sigue sin abrir la lectura (QA22-015) y ahora tampoco vuelve a la raíz global:
 * el alta y la edición aterrizan en la superficie de la persona que se guardó,
 * que es la única que puede confirmar el guardado mostrando el resultado. El
 * `profileId` es el SEGMENTO de la ruta —el que devolvió el backend—, así que lo
 * único que viaja como parámetro es el modo.
 */
export function relationshipSavedHref(profileId: string, modo: RelationshipSaveMode): string {
  return `${relationshipProfileHref(profileId)}?${RELATIONSHIP_SAVED_MODE_PARAM}=${modo}`;
}

/** El modo declarado en la URL, o `null` si no vino o no es uno de los dos. */
export function relationshipSavedMode(raw: unknown): RelationshipSaveMode | null {
  if (raw === "alta" || raw === "edicion") return raw;
  return null;
}

/**
 * La confirmación del guardado, con el nombre de la persona.
 *
 * Dice lo que PASÓ y dónde quedó: sin esta frase, aterrizar en una pantalla con
 * los datos cargados no alcanza para saber que el guardado terminó bien —fue
 * exactamente lo que quedó registrado en QA22-015—.
 *
 * Y no promete un cálculo (QA23-005). Guardar no arranca ninguna comparación: la
 * frase dice que la comparación se abre —y recién ahí se calcula— en vez de
 * sugerir que algo está corriendo en el fondo.
 */
export function relationshipSavedConfirmation(name: string, modo: RelationshipSaveMode): string {
  const quien = name.trim() || "esta persona";
  return modo === "alta"
    ? `Guardamos a ${quien} en tu cuenta y ya está en tu lista. Éste es su perfil: la comparación se calcula cuando la abrís.`
    : `Guardamos los datos de ${quien}. La comparación se vuelve a calcular con los datos nuevos cuando la abrís.`;
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
 *
 * **No lleva `level` (QA22-018).** El nivel de comparación no es una
 * preferencia que se pueda guardar al lado de los datos: es una CONSECUENCIA de
 * qué datos hay. Cuando el borrador tenía su propio `level`, el formulario podía
 * decir "carta con carta" con una persona que sólo tenía el signo, y al guardar
 * el backend devolvía otro nivel. Ahora hay una sola derivación
 * —`relationshipLevelFromDraft`— y nada que la pueda contradecir.
 *
 * **Sí lleva `relationshipType` (QA23-004), y es lo contrario del nivel.** El
 * nivel se deriva y no se pregunta; el tipo se pregunta y no se deriva. Va junto
 * al NOMBRE y no junto a los datos de nacimiento porque no es un dato de
 * nacimiento: no participa de `relationshipLevelFromDraft`, no habilita ni
 * bloquea ningún escalón y no se puede completar mirando el signo, la fecha ni
 * la carta.
 */
export type RelationshipDraft = {
  name: string;
  /**
   * Qué vínculo tiene con esa persona, declarado. `null` es "sin definir": no
   * se contestó y nadie lo va a suponer.
   */
  relationshipType: RelationshipTypeKey | null;
  /** Sin fecha, uno de los doce signos elegido a mano. */
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
    name: "",
    relationshipType: null,
    zodiacSign: null,
    birthDate: null,
    birthTime: null,
    place: null
  };
}

/**
 * El nivel que permiten estos datos. **Única derivación del front** (QA22-018).
 *
 * Es la misma regla que aplica el backend en `relationshipAvailableLevel` sobre
 * el perfil ya guardado —día + hora exacta + coordenadas + zona ⇒ carta; sólo el
 * día ⇒ fecha; nada de eso ⇒ signo—, escrita acá sobre el borrador para que el
 * formulario pueda ANUNCIAR el nivel antes de guardar sin inventar uno propio.
 * Si las dos divergieran, la pantalla prometería una lectura que el perfil
 * persistido no da.
 *
 * La zona horaria no entra como parámetro a propósito: se resuelve al guardar, a
 * partir de las coordenadas de la ciudad elegida, y si no se resuelve no se
 * guarda nada (`relationshipSavePayload` devuelve `null`). Por eso acá alcanza
 * con que HAYA una ciudad elegida.
 *
 * **El tipo de vínculo no entra, y no puede entrar (QA23-004).** El nivel lo
 * fijan la fecha, la hora y la ciudad; declarar `Amistad` o `Vínculo romántico`
 * no agrega ni quita una sola posición. La función mira tres campos y ninguno
 * es el tipo.
 */
export function relationshipLevelFromDraft(draft: RelationshipDraft): ComparisonLevel {
  const fecha = draft.birthDate ? parseDateInput(draft.birthDate) : null;
  if (!fecha) return "sign_to_sign";
  const hora = draft.birthTime ? parseTimeInput(draft.birthTime) : null;
  return hora && draft.place ? "chart_to_chart" : "date_to_date";
}

/**
 * El nivel derivado, dicho en el formulario: hasta dónde llega la comparación
 * con lo que hay cargado y qué haría falta para el escalón siguiente.
 *
 * Explica el resultado; no lo pide como decisión. Es exactamente lo que separa
 * este texto del selector de modalidad que la edición ya no muestra.
 */
export function relationshipDataLevelLine(level: ComparisonLevel): string {
  if (level === "sign_to_sign") {
    return "Con estos datos la comparación llega a signo con signo: el estilo general de los dos signos. Cargá la fecha de nacimiento para que entren las posiciones de ese día.";
  }
  if (level === "date_to_date") {
    return "Con estos datos la comparación llega a fecha con fecha: los contactos que se mantienen durante toda la franja de ese día. Sumá la hora exacta y la ciudad para que entren las casas y los Ascendentes.";
  }
  return "Con estos datos la comparación llega a carta con carta: entran además las casas, los dos Ascendentes y las superposiciones.";
}

/**
 * El borrador que corresponde a una persona YA guardada, para editarla o para
 * subirle el nivel sin cargar todo de nuevo.
 *
 * Muestra exactamente lo guardado y nada más: el signo sólo si es una de las
 * doce claves del selector, y la ciudad sólo si además de coordenadas tiene una
 * etiqueta que mostrar. Un lugar sin etiqueta se deja vacío para que se vuelva a
 * elegir: una tarjeta de ciudad en blanco no es un dato, es un hueco.
 *
 * No copia `availableLevel`: el nivel se vuelve a derivar de estos mismos datos
 * (`relationshipLevelFromDraft`), así que el formulario no puede quedar
 * afirmando un escalón que los campos que muestra ya no sostienen.
 */
export function relationshipDraftFromProfile(profile: RelationshipProfile): RelationshipDraft {
  const label = profile.birthPlaceLabel?.trim() ?? "";
  const { latitude, longitude } = profile;
  return {
    name: profile.name,
    // Lo declarado se muestra tal cual, y un perfil legacy —o uno publicado por
    // un backend que todavía no expone el campo— entra como `null`: sin definir,
    // que es exactamente lo que es. Editar no lo inventa ni lo hereda del signo.
    relationshipType: readRelationshipType(profile),
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
 * Qué le falta al borrador para poder guardarse, dicho en una línea. `null`
 * significa que está completo.
 *
 * Es lo único que decide si Guardar se habilita, y por eso vive acá y no en la
 * pantalla: el mensaje que explica el bloqueo y la condición que lo produce
 * tienen que ser el MISMO hecho, o el botón queda apagado sin razón visible.
 *
 * Sin `objetivo` —la EDICIÓN— sólo se exige lo que hace falta para que haya algo
 * que comparar: un nombre y, o bien una fecha válida, o bien un signo. Lo demás
 * es opcional, y quitarlo baja el nivel en vez de bloquear (QA22-023).
 *
 * Con `objetivo` —el ALTA, donde la persona ya dijo qué iba a cargar— además se
 * exige lo que ese escalón necesita: guardar "carta con carta" a medias sería
 * prometer una lectura que no va a llegar. El objetivo es intención de pantalla
 * y no se guarda en ningún lado: lo que queda persistido es el nivel derivado.
 *
 * **El tipo de vínculo nunca bloquea (QA23-004).** Es opcional en el alta y en
 * la edición: sin definir se guarda igual, la comparación se calcula igual y la
 * lectura es la neutral. Exigirlo convertiría un dato declarado en un peaje.
 */
export function relationshipDraftBlock(
  draft: RelationshipDraft,
  objetivo?: ComparisonLevel | null
): string | null {
  if (!draft.name.trim()) return "Escribí un nombre para guardar a esta persona.";

  const fecha = draft.birthDate ? parseDateInput(draft.birthDate) : null;
  const hora = draft.birthTime ? parseTimeInput(draft.birthTime) : null;

  // Un dato escrito mal se dice antes que cualquier otra cosa: todo lo demás se
  // deriva de él, así que un "falta la ciudad" encima de una fecha inválida
  // mandaría a corregir el campo equivocado.
  if (draft.birthDate && !fecha) {
    return "Revisá la fecha de nacimiento: ese día no existe en el calendario.";
  }
  if (draft.birthTime && !hora) {
    return "Revisá la hora de nacimiento: tiene que ser una hora del reloj.";
  }
  // La hora sin ciudad no se puede ubicar en un instante, así que no se guarda.
  // Se bloquea en vez de descartarla en silencio: la hora está escrita en
  // pantalla y guardar sin ella se leería como que quedó guardada.
  if (hora && !draft.place) {
    return "Elegí la ciudad de nacimiento en el buscador: sin sus coordenadas esa hora no se puede ubicar en un instante y quedaría sin guardar.";
  }

  if (objetivo === "sign_to_sign" && !draft.zodiacSign) return "Elegí uno de los doce signos.";
  if ((objetivo === "date_to_date" || objetivo === "chart_to_chart") && !fecha) {
    return "Elegí la fecha de nacimiento de esa persona.";
  }
  if (objetivo === "chart_to_chart" && !hora) {
    return "Elegí la hora exacta de nacimiento: sin ella no hay casas ni Ascendente que comparar.";
  }
  if (objetivo === "chart_to_chart" && !draft.place) {
    return "Elegí la ciudad de nacimiento en el buscador: de sus coordenadas sale la zona horaria del cálculo.";
  }

  if (!fecha && !draft.zodiacSign) {
    return "Elegí la fecha de nacimiento de esa persona, o su signo si no la sabés.";
  }
  return null;
}

/**
 * Los argumentos de `relationships.savePerson` **más** el campo aditivo del tipo
 * de vínculo.
 *
 * La intersección existe por una razón de tiempos, no de gusto: el contrato ya
 * declara `relationshipType` como argumento opcional, pero mientras no corra el
 * codegen `SavePersonArgs` —que se deriva de `convex/_generated`— todavía no lo
 * conoce. Declararlo acá hace que el pedido compile hoy y siga compilando
 * después, cuando el generado lo incluya con exactamente esta forma.
 *
 * Es opcional y NO admite `null`, igual que el validator: el campo se omite o
 * lleva uno de los ocho valores. Ver `relationshipTypeSaveField`.
 */
export type RelationshipSaveArgs = SavePersonArgs & {
  relationshipType?: RelationshipTypeKey;
};

/** Lo que se manda a guardar, sin la clave que identifica al INTENTO. */
type RelationshipSavePayload = Omit<RelationshipSaveArgs, "idempotencyKey">;

/**
 * El pedido que corresponde a este borrador, o `null` si no se puede guardar.
 *
 * Acá está la regla entera de honestidad del alta, en un solo lugar y sin
 * React de por medio. El escalón NO llega por parámetro: se deriva de los datos
 * con `relationshipLevelFromDraft`, la misma regla que la pantalla anuncia y que
 * el backend aplicará sobre el perfil persistido.
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
  // El nivel sale de los datos, nunca de una elección guardada: es la MISMA
  // derivación que el formulario muestra y que el backend va a aplicar sobre el
  // perfil persistido.
  const level = relationshipLevelFromDraft(draft);

  const sinDatos = {
    ...(profileId ? { profileId } : {}),
    // Declarado, no derivado: el tipo viaja con los tres niveles sin mirar qué
    // datos hay. Y viaja OMITIDO cuando no se definió —el validator acepta los
    // ocho valores o la ausencia del campo, nunca `null`—, que además es lo que
    // impide que un guardado sin contestar borre una elección anterior.
    ...relationshipTypeSaveField(draft.relationshipType),
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

  if (level === "sign_to_sign") {
    return { ...sinDatos, name, birthTimePrecision: "unknown", zodiacSign: draft.zodiacSign };
  }
  if (level === "date_to_date") {
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
): RelationshipSaveArgs | null {
  const payload = relationshipSavePayload(draft, resolvedTimezone, profileId);
  return payload ? { ...payload, idempotencyKey } : null;
}

/**
 * El MISMO pedido, sin el campo del tipo de vínculo.
 *
 * Es la degradación ante un backend que todavía no desplegó el contrato
 * aditivo: Convex rechaza un argumento que su validator no declara, así que un
 * cliente nuevo contra un deployment viejo no guardaría nada —ni el nombre, ni
 * la fecha, ni la carta—. Reconocido el rechazo
 * (`relationshipTypeRejectedByBackend`), el pedido se reintenta por acá.
 *
 * Se conserva la clave de idempotencia del intento original a propósito: el
 * primer pedido no llegó a ejecutarse —lo frenó la validación de argumentos—,
 * así que esto no es un pedido nuevo, es el mismo pedido en el idioma que ese
 * backend entiende.
 */
export function relationshipSaveArgsWithoutType(args: RelationshipSaveArgs): SavePersonArgs {
  const { relationshipType: _declarado, ...resto } = args;
  return resto;
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
 *
 * Ese "entra solo" es lo que mete al TIPO DE VÍNCULO en la identidad del pedido
 * sin una línea propia (QA23-004): cambiar `Amistad` por `Trabajo o proyecto` es
 * otro pedido, estrena clave de idempotencia y el backend lo trata como una
 * escritura nueva en vez de devolver la persona que ya había guardado.
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
// Cómo se nombra un contacto
// ---------------------------------------------------------------------------

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

/**
 * La síntesis general —cuántos contactos hay, cuáles pesan y qué se concentra
 * dónde— ya no vive acá: la arma `src/domain/relationshipReading.ts` sobre la
 * evidencia real por contacto (`driverDetails`) en vez de sobre el recuento de
 * oraciones. La diferencia no es de estilo: sumando filas, un contacto que
 * alimenta dos dimensiones se contaba dos veces (QA22-021).
 */
