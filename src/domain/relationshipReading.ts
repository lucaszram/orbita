import { relationshipDriverShortName, type RelationshipDimensionKey } from "@/domain/relationships";
import type {
  RelationshipComparisonData,
  RelationshipDimension
} from "@/services/relationshipsApi";

/**
 * La LECTURA de una comparación de Vínculos (QA22-017 · QA22-019 · QA22-020 ·
 * QA22-021).
 *
 * Es presentación pura: sin React, sin Convex y sin reloj. Toma el sobre tal
 * como lo publica `relationships.getComparison` y arma lo único que la pantalla
 * necesita decidir:
 *
 * 1. **Las dinámicas principales** — dos o tres contactos reales, elegidos por
 *    fuerza, calidad y precisión con un desempate estable. No hay puntaje
 *    global: cada dinámica ES un contacto del cálculo, con su propia oración.
 * 2. **Qué se facilita, qué puede tensarse y una invitación** por dimensión,
 *    apoyados en la evidencia real (`driverDetails`), no en la plantilla por
 *    tono del backend.
 * 3. **Cantidad y balance en TEXTO** — el reemplazo de las barras, que se leían
 *    como un porcentaje de compatibilidad y que en color solo no comunicaban
 *    nada a quien no distingue cobre de azul.
 * 4. **La reutilización de un contacto** — el mismo `id` en varias dimensiones
 *    se dice, no se duplica.
 *
 * **Degradación honesta.** `driverDetails` es aditivo y opcional: los sobres
 * guardados por el build 22 sólo traen `drivers: string[]`. Con esos, la lectura
 * sigue en pie —los contactos se muestran igual, en el orden que el sobre ya
 * trae— y lo que NO se puede afirmar se dice que no se puede afirmar. Nunca se
 * inventa una calidad, un peso ni una precisión por contacto.
 */

/** Una dimensión tal como la publica el contrato. */
type ContractDimension = RelationshipDimension;
/** Un contacto con su evidencia, tal como lo publica el contrato. */
type ContractDetail = NonNullable<ContractDimension["driverDetails"]>[number];

/**
 * Los dos vocabularios cerrados salen del CONTRATO, no de una copia: si Codex
 * agrega o renombra una calidad o una precisión, esto deja de compilar en vez de
 * dibujar una etiqueta vieja.
 */
export type RelationshipDriverQuality = ContractDetail["quality"];
export type RelationshipDriverPrecision = ContractDetail["precision"];

/** Un contacto ya listo para mostrar, con lo que se sabe y lo que no. */
export type RelationshipReadingContact = {
  /** La identidad real del contacto. Es la clave de todo lo demás. */
  id: string;
  /** La oración del backend, tal cual. Nunca se reescribe. */
  text: string;
  /** Nombre corto ("su Venus con tu Sol"), o `null` si la frase no matchea. */
  name: string | null;
  /** `null` en un sobre sin `driverDetails`: no se infiere. */
  quality: RelationshipDriverQuality | null;
  /** `null` en un sobre sin `driverDetails`. No es un porcentaje. */
  weight: number | null;
  /** `null` en un sobre sin `driverDetails`. */
  precision: RelationshipDriverPrecision | null;
  /** Posición dentro de SU dimensión, tal como el sobre la ordenó. */
  order: number;
  /** Rótulos de las OTRAS dimensiones que este MISMO contacto alimenta. */
  alsoIn: string[];
};

/**
 * El balance de una dimensión, en el vocabulario canónico del motor
 * (`RelationshipDimension["tone"]` en `convex/lib/relationshipLayers.ts`),
 * traducido a las palabras que la pantalla escribe.
 */
export type RelationshipBalance =
  | "mas_fluido"
  | "mixto"
  | "mas_exigente"
  | "sutil"
  | "sin_material"
  | "sin_detalle";

export const RELATIONSHIP_BALANCE_LABEL: Record<RelationshipBalance, string> = {
  mas_fluido: "más fluido",
  mixto: "mixto",
  mas_exigente: "más exigente",
  sutil: "sutil",
  sin_material: "sin contactos principales",
  sin_detalle: "balance sin detalle"
};

export type RelationshipDimensionReading = {
  key: RelationshipDimensionKey;
  label: string;
  /** Contactos ÚNICOS por id. Es el N del copy y el de la fila textual. */
  contacts: number;
  balance: RelationshipBalance;
  /** ¿Este sobre trae la evidencia por contacto? */
  detailed: boolean;
  /** Qué se facilita, apoyado en los contactos de apoyo reales. */
  facilitates: string;
  /** Qué puede tensarse, apoyado en los contactos de tensión reales. */
  strains: string;
  /** Una acción concreta o una pregunta. Nunca las dos. */
  invitation: string;
  precision: ContractDimension["precision"];
  /** Todos los contactos de la dimensión, ordenados y sin repetir id. */
  contactsList: RelationshipReadingContact[];
};

/** Un contacto elevado a dinámica principal de la lectura entera. */
export type RelationshipDynamic = {
  id: string;
  text: string;
  name: string | null;
  quality: RelationshipDriverQuality | null;
  precision: RelationshipDriverPrecision | null;
  weight: number | null;
  /** TODAS las dimensiones que este contacto alimenta, en orden de contrato. */
  dimensions: string[];
};

export type RelationshipReading = {
  /** Dos o tres, o menos si el cálculo no dio para más. Nunca más de tres. */
  dynamics: RelationshipDynamic[];
  dimensions: RelationshipDimensionReading[];
  /** Contactos distintos por id en toda la comparación. */
  uniqueContacts: number;
  /** Cuántos de ésos cuentan en más de una dimensión. */
  sharedContacts: number;
  /** ¿El sobre entero trae evidencia por contacto? */
  detailed: boolean;
};

/** Cuántas dinámicas puede abrir la síntesis. El registro pide dos o tres. */
export const RELATIONSHIP_MAX_DYNAMICS = 3;

// ---------------------------------------------------------------------------
// Vocabulario editorial por dimensión
// ---------------------------------------------------------------------------

/**
 * Qué facilita cada dimensión cuando aparece un contacto de apoyo. Es la
 * definición de la dimensión, no una promesa: describe el terreno, y el contacto
 * real que se nombra al lado es lo que lo apoya.
 */
const FACILITA: Record<RelationshipDimensionKey, string> = {
  communication: "encontrar un idioma común para lo que hay que decirse",
  care: "registrar y acompañar lo que le pasa al otro",
  desire: "que la atracción encuentre un ritmo compartido",
  friction: "tramitar una diferencia sin que se rompa nada",
  shared_project: "coordinar dirección, tiempos y responsabilidades"
};

/** Qué puede tensarse en cada dimensión. Mismo criterio, del otro lado. */
const TENSA: Record<RelationshipDimensionKey, string> = {
  communication: "que cada uno hable en un tiempo distinto y haya que traducir",
  care: "que el cuidado que uno ofrece no sea el que el otro necesita",
  desire: "que los ritmos del deseo no coincidan y haya que acordarlos",
  friction: "que la diferencia se sienta más rápido o con más fuerza",
  shared_project: "que los criterios sobre cómo avanzar no coincidan"
};

/**
 * La invitación de cada dimensión: una acción o una pregunta.
 *
 * Cuál de las dos se muestra lo decide el BALANCE, no un azar: donde el cálculo
 * encontró más recursos que roces hay algo que usar —una acción—, y donde no,
 * lo honesto es una pregunta que las dos personas puedan contestar. Ninguna de
 * las dos afirma nada sobre el vínculo ni promete un resultado.
 */
const INVITACION: Record<RelationshipDimensionKey, { accion: string; pregunta: string }> = {
  communication: {
    accion:
      "Probá contarle una decisión reciente con el detalle que a vos te parece obvio: eso es lo que este cruce vuelve visible.",
    pregunta:
      "¿Cuándo fue la última vez que le preguntaste qué quiso decir, en vez de suponerlo?"
  },
  care: {
    accion:
      "Decile una forma concreta en la que te gusta que te cuiden, dicha como pedido y no como reclamo.",
    pregunta: "¿Lo que hacés para cuidar a esa persona es lo que pide, o lo que a vos te calmaría?"
  },
  desire: {
    accion:
      "Elijan un plan que los dos quieran y que no tenga que ser especial: el deseo también se sostiene en lo común.",
    pregunta:
      "¿Están diciendo lo que cada uno quiere, o esperando que el otro lo adivine?"
  },
  friction: {
    accion:
      "La próxima vez que aparezca el roce, nombralo en el momento y en una frase, sin tener que resolverlo ahí.",
    pregunta:
      "¿Qué diferencia se repite siempre igual, y qué pasaría si la dijeran antes de que escale?"
  },
  shared_project: {
    accion:
      "Pongan por escrito quién hace qué y para cuándo, aunque lo que estén armando sea chico.",
    pregunta: "¿Están de acuerdo en adónde van, o sólo en que quieren ir juntos?"
  }
};

// ---------------------------------------------------------------------------
// Orden determinístico
// ---------------------------------------------------------------------------

/** Mejor precisión primero. Lo desconocido va último: no se premia el hueco. */
function precisionRank(precision: RelationshipDriverPrecision | null): number {
  if (precision === "exact") return 0;
  if (precision === "estimated") return 1;
  if (precision === "range") return 2;
  if (precision === "not_applicable") return 3;
  return 4;
}

/**
 * Apoyo y tensión antes que neutral: los dos primeros inclinan la lectura y el
 * tercero sólo señala que ahí hay material. Lo desconocido va último.
 */
function qualityRank(quality: RelationshipDriverQuality | null): number {
  if (quality === "support") return 0;
  if (quality === "tension") return 1;
  if (quality === "neutral") return 2;
  return 3;
}

/**
 * El orden canónico de los contactos: **fuerza, calidad, precisión** y, recién
 * ahí, dos desempates estables —la posición que el sobre ya traía y el id—.
 *
 * Es totalmente determinístico: dos corridas del mismo sobre devuelven la misma
 * lista, y el último criterio es un id que no depende del texto ni del índice de
 * ningún arreglo intermedio.
 */
function compareContacts(
  a: { weight: number | null; quality: RelationshipDriverQuality | null; precision: RelationshipDriverPrecision | null; order: number; id: string },
  b: { weight: number | null; quality: RelationshipDriverQuality | null; precision: RelationshipDriverPrecision | null; order: number; id: string }
): number {
  // Sin peso publicado no se inventa uno: esos contactos quedan detrás de los
  // que sí lo traen y se ordenan por lo que el sobre ya había decidido.
  const pesoA = typeof a.weight === "number" && Number.isFinite(a.weight) ? a.weight : -1;
  const pesoB = typeof b.weight === "number" && Number.isFinite(b.weight) ? b.weight : -1;
  if (pesoA !== pesoB) return pesoB - pesoA;
  const calidad = qualityRank(a.quality) - qualityRank(b.quality);
  if (calidad !== 0) return calidad;
  const precision = precisionRank(a.precision) - precisionRank(b.precision);
  if (precision !== 0) return precision;
  if (a.order !== b.order) return a.order - b.order;
  return a.id.localeCompare(b.id);
}

// ---------------------------------------------------------------------------
// Normalización de una dimensión
// ---------------------------------------------------------------------------

/**
 * Los contactos de una dimensión, uno por id.
 *
 * Con `driverDetails` sale de ahí, con su calidad, su peso y su precisión. Sin
 * él —sobres del build 22— sale de `drivers`, que son sólo oraciones: cada una
 * conserva su posición y su id se construye a partir de la dimensión y del
 * TEXTO, que es lo único que ese sobre publica. Ese id sintético existe para
 * poder listar y dedupear dentro de la pantalla; no se presenta como si fuera la
 * identidad que el backend certifica, y por eso un sobre legacy nunca declara
 * que un contacto se reutiliza en otra dimensión.
 *
 * **Se deduplica sólo por id.** Dos contactos con texto parecido —o incluso
 * igual— y distinto id son dos contactos, y borrar uno perdería evidencia real.
 */
function normalizeContacts(dimension: ContractDimension): {
  contacts: RelationshipReadingContact[];
  detailed: boolean;
} {
  const details = dimension.driverDetails;
  const vistos = new Set<string>();
  const contacts: RelationshipReadingContact[] = [];

  if (Array.isArray(details)) {
    details.forEach((detail, index) => {
      if (vistos.has(detail.id)) return;
      vistos.add(detail.id);
      contacts.push({
        id: detail.id,
        text: detail.text,
        name: relationshipDriverShortName(detail.text),
        quality: detail.quality,
        weight: detail.weight,
        precision: detail.precision,
        order: index,
        alsoIn: []
      });
    });
    return { contacts, detailed: true };
  }

  dimension.drivers.forEach((text, index) => {
    const id = `legacy:${dimension.key}:${text}`;
    if (vistos.has(id)) return;
    vistos.add(id);
    contacts.push({
      id,
      text,
      name: relationshipDriverShortName(text),
      quality: null,
      weight: null,
      precision: null,
      order: index,
      alsoIn: []
    });
  });
  return { contacts, detailed: false };
}

/**
 * El balance de una dimensión.
 *
 * **Con evidencia** se reproduce la MISMA regla que el backend usa para su
 * propio tono (`dimensionSummary`): apoyo por encima de tensión con margen
 * ⇒ más fluido; tensión por encima de apoyo con el mismo margen ⇒ más exigente;
 * sólo contactos neutrales ⇒ sutil; el resto ⇒ mixto. Se calcula acá y no se
 * pide al contrato porque el sobre no publica su tono, y derivarlo con otra
 * regla haría que la fila y el resumen del backend dijeran cosas distintas.
 *
 * **Sin evidencia** —sobres del build 22— no hay con qué separar apoyo de
 * tensión, y no se inventa: la fila lo dice y muestra la cantidad, que sí es un
 * hecho verificable.
 */
export function relationshipDimensionBalance(args: {
  detailed: boolean;
  contacts: readonly RelationshipReadingContact[];
}): RelationshipBalance {
  if (args.contacts.length === 0) return "sin_material";
  if (!args.detailed) return "sin_detalle";
  let apoyo = 0;
  let tension = 0;
  let neutral = 0;
  for (const contacto of args.contacts) {
    const peso = typeof contacto.weight === "number" && Number.isFinite(contacto.weight) ? contacto.weight : 0;
    if (contacto.quality === "support") apoyo += peso;
    else if (contacto.quality === "tension") tension += peso;
    else neutral += peso;
  }
  if (apoyo > tension * 1.25) return "mas_fluido";
  if (tension > apoyo * 1.25) return "mas_exigente";
  if (neutral > 0 && apoyo === 0 && tension === 0) return "sutil";
  return "mixto";
}

/** "3 contactos" · "1 contacto" · "sin contactos principales". */
export function relationshipContactsCount(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return "sin contactos principales";
  return total === 1 ? "1 contacto" : `${total} contactos`;
}

/**
 * El balance en una palabra, o `null` cuando no hay ninguno que decir: sin
 * contactos, la cuenta ya dice todo y repetirlo sería decir dos veces lo mismo.
 *
 * Va SEPARADO de la cuenta a propósito. El color de la pantalla acompaña sólo a
 * esta palabra —"más fluido" o "más exigente"—; teñir también la cantidad haría
 * creer que el número significa algo de lo que no significa.
 */
export function relationshipBalanceWord(reading: RelationshipDimensionReading): string | null {
  return reading.contacts === 0 ? null : RELATIONSHIP_BALANCE_LABEL[reading.balance];
}

/**
 * La fila textual que reemplaza a la barra: cuántos contactos y cómo se
 * inclinan, escrito. Sin riel, sin porcentaje y sin depender del color.
 */
export function relationshipDimensionRow(reading: RelationshipDimensionReading): string {
  const cuenta = relationshipContactsCount(reading.contacts);
  const balance = relationshipBalanceWord(reading);
  return balance ? `${cuenta} · ${balance}` : cuenta;
}

/** La misma fila, dicha entera para un lector de pantalla. */
export function relationshipDimensionRowVoice(reading: RelationshipDimensionReading): string {
  if (reading.contacts === 0) {
    return `${reading.label}: sin contactos principales en esta comparación.`;
  }
  if (reading.balance === "sin_detalle") {
    return `${reading.label}: ${relationshipContactsCount(reading.contacts)}. Esta comparación se guardó sin el detalle de cada contacto, así que no se puede decir su balance.`;
  }
  return `${reading.label}: ${relationshipContactsCount(reading.contacts)}, balance ${RELATIONSHIP_BALANCE_LABEL[reading.balance]}.`;
}

/** Los contactos nombrados, o su recuento si sus frases no se pueden nombrar. */
function nombrar(contacts: readonly RelationshipReadingContact[], maximo: number): string {
  const nombres = contacts
    .slice(0, maximo)
    .map((contacto) => contacto.name)
    .filter((nombre): nombre is string => Boolean(nombre));
  if (nombres.length === 0) return relationshipContactsCount(contacts.length);
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

function facilitatesText(
  key: RelationshipDimensionKey,
  detailed: boolean,
  contacts: readonly RelationshipReadingContact[]
): string {
  if (contacts.length === 0) {
    return `Con estos datos no hay ningún contacto principal que facilite ${FACILITA[key]}. No es lo mismo que decir que no pasa: es que el cálculo no lo encuentra.`;
  }
  if (!detailed) {
    return `Esta comparación se guardó sin el detalle de cada contacto, así que no podemos separar cuáles facilitan ${FACILITA[key]}. Los contactos están abajo, tal como se calcularon.`;
  }
  const apoyos = contacts.filter((contacto) => contacto.quality === "support");
  if (apoyos.length > 0) {
    return `Se facilita ${FACILITA[key]}: ${nombrar(apoyos, 2)}.`;
  }
  const neutrales = contacts.filter((contacto) => contacto.quality === "neutral");
  if (neutrales.length > 0) {
    return `Ningún contacto acá empuja hacia ${FACILITA[key]}: ${nombrar(neutrales, 2)} concentra el tema sin inclinarlo para ningún lado.`;
  }
  return `Ningún contacto de esta dimensión facilita ${FACILITA[key]}: los que hay marcan diferencia, no encuentro.`;
}

function strainsText(
  key: RelationshipDimensionKey,
  detailed: boolean,
  contacts: readonly RelationshipReadingContact[]
): string {
  if (contacts.length === 0) {
    return `Tampoco aparece un contacto que tense ${TENSA[key]}. Esta dimensión queda sin material, no en cero.`;
  }
  if (!detailed) {
    return `Por lo mismo, tampoco podemos señalar cuáles tensan ${TENSA[key]}. Volvé a calcular la comparación para recuperar ese detalle.`;
  }
  const tensiones = contacts.filter((contacto) => contacto.quality === "tension");
  if (tensiones.length > 0) {
    return `Puede tensarse ${TENSA[key]}: ${nombrar(tensiones, 2)}.`;
  }
  return `No aparece un contacto que tense ${TENSA[key]}. Eso no vuelve fácil la dimensión: sólo dice que el roce no está en el cálculo.`;
}

function invitationText(key: RelationshipDimensionKey, balance: RelationshipBalance): string {
  return balance === "mas_fluido" ? INVITACION[key].accion : INVITACION[key].pregunta;
}

// ---------------------------------------------------------------------------
// El copy exacto de la divulgación progresiva (QA22-019)
// ---------------------------------------------------------------------------

/**
 * `VER LOS 2 CONTACTOS QUE FORMAN DESEO`.
 *
 * El copy es el del registro físico, literal: `VER LOS {N} CONTACTOS QUE FORMAN
 * {DIMENSIÓN}`. `N` son los contactos ÚNICOS por id —no la suma de filas— y la
 * dimensión es su rótulo real, no una referencia genérica.
 *
 * Con un solo contacto la plantilla queda en plural. Se respeta igual, porque es
 * el texto pedido; la concordancia se resuelve donde se puede resolver sin
 * cambiarlo: en la etiqueta accesible (`relationshipContactsToggleVoice`), que
 * es la que se escucha.
 */
export function relationshipContactsToggleLabel(reading: RelationshipDimensionReading): string {
  return `VER LOS ${reading.contacts} CONTACTOS QUE FORMAN ${reading.label.toLocaleUpperCase("es")}`;
}

/** Y cómo se cierra otra vez, con la misma dimensión nombrada. */
export function relationshipContactsCollapseLabel(reading: RelationshipDimensionReading): string {
  return `OCULTAR LOS CONTACTOS QUE FORMAN ${reading.label.toLocaleUpperCase("es")}`;
}

/** La misma acción, con la concordancia que el copy visible no puede tener. */
export function relationshipContactsToggleVoice(reading: RelationshipDimensionReading): string {
  return reading.contacts === 1
    ? `Ver el contacto que forma ${reading.label}`
    : `Ver los ${reading.contacts} contactos que forman ${reading.label}`;
}

/**
 * Qué aporta este contacto ACÁ, y si es el mismo que ya aporta en otra
 * dimensión (QA22-021).
 *
 * La reutilización se dice con el mismo id, así que la pantalla no la presenta
 * como dos contactos distintos ni la esconde: es una sola relación leída desde
 * dos lados, y eso es exactamente lo que se escribe.
 */
export function relationshipContactRole(contact: RelationshipReadingContact): string | null {
  const aporte =
    contact.quality === "support"
      ? "Cuenta como recurso de fluidez"
      : contact.quality === "tension"
        ? "Cuenta como punto de tensión"
        : contact.quality === "neutral"
          ? "Cuenta como foco: concentra el tema sin inclinarlo"
          : null;
  if (contact.alsoIn.length === 0) return aporte ? `${aporte}.` : null;
  const otras =
    contact.alsoIn.length === 1
      ? contact.alsoIn[0]
      : `${contact.alsoIn.slice(0, -1).join(", ")} y ${contact.alsoIn[contact.alsoIn.length - 1]}`;
  const reutilizacion = `Es el MISMO contacto que también cuenta en ${otras}: uno solo, leído desde dos lados.`;
  return aporte ? `${aporte}. ${reutilizacion}` : reutilizacion;
}

// ---------------------------------------------------------------------------
// La lectura completa
// ---------------------------------------------------------------------------

/**
 * La lectura de una comparación con dimensiones. `null` cuando no hay ninguna
 * que leer: la lectura de un signo solo es otra cosa y la resuelve la pantalla
 * con su propia fila.
 */
export function relationshipReading(
  data: Pick<RelationshipComparisonData, "generalOnly" | "dimensions">
): RelationshipReading | null {
  if (data.generalOnly || data.dimensions.length === 0) return null;

  const porDimension = data.dimensions.map((dimension) => {
    const { contacts, detailed } = normalizeContacts(dimension);
    return { dimension, contacts, detailed };
  });

  // Dónde aparece cada id. Es lo único que permite explicar la reutilización
  // sin duplicar el contacto ni borrarlo de una de las dos dimensiones.
  const dimensionesPorId = new Map<string, string[]>();
  for (const { dimension, contacts } of porDimension) {
    for (const contacto of contacts) {
      const donde = dimensionesPorId.get(contacto.id) ?? [];
      if (!donde.includes(dimension.label)) donde.push(dimension.label);
      dimensionesPorId.set(contacto.id, donde);
    }
  }

  const dimensions: RelationshipDimensionReading[] = porDimension.map(
    ({ dimension, contacts, detailed }) => {
      const conReutilizacion = contacts
        .map((contacto) => ({
          ...contacto,
          alsoIn: (dimensionesPorId.get(contacto.id) ?? []).filter(
            (label) => label !== dimension.label
          )
        }))
        .sort(compareContacts);
      const balance = relationshipDimensionBalance({ detailed, contacts: conReutilizacion });
      return {
        key: dimension.key,
        label: dimension.label,
        contacts: conReutilizacion.length,
        balance,
        detailed,
        facilitates: facilitatesText(dimension.key, detailed, conReutilizacion),
        strains: strainsText(dimension.key, detailed, conReutilizacion),
        invitation: invitationText(dimension.key, balance),
        precision: dimension.precision,
        contactsList: conReutilizacion
      };
    }
  );

  // Las dinámicas se eligen sobre contactos ÚNICOS: un contacto que alimenta dos
  // dimensiones es una dinámica, no dos. Se queda con el peso mayor que alcanzó
  // —el de la dimensión donde más importa— y nombra todas las dimensiones donde
  // cuenta, en el orden en que el contrato las publica.
  const unicos = new Map<string, RelationshipDynamic & { order: number }>();
  for (const { dimension, contacts } of porDimension) {
    for (const contacto of contacts) {
      const previo = unicos.get(contacto.id);
      if (!previo) {
        unicos.set(contacto.id, {
          id: contacto.id,
          text: contacto.text,
          name: contacto.name,
          quality: contacto.quality,
          precision: contacto.precision,
          weight: contacto.weight,
          dimensions: [dimension.label],
          order: contacto.order
        });
        continue;
      }
      if (!previo.dimensions.includes(dimension.label)) previo.dimensions.push(dimension.label);
      const peso = typeof contacto.weight === "number" ? contacto.weight : null;
      if (peso !== null && (previo.weight === null || peso > previo.weight)) previo.weight = peso;
      previo.order = Math.min(previo.order, contacto.order);
    }
  }

  const dynamics = [...unicos.values()]
    .sort(compareContacts)
    .slice(0, RELATIONSHIP_MAX_DYNAMICS)
    .map(({ order: _order, ...dynamic }) => dynamic);

  const uniqueContacts = unicos.size;
  const sharedContacts = [...unicos.values()].filter(
    (dynamic) => dynamic.dimensions.length > 1
  ).length;

  return {
    dynamics,
    dimensions,
    uniqueContacts,
    sharedContacts,
    detailed: porDimension.every(({ detailed }) => detailed)
  };
}

/**
 * Cómo abre la síntesis: cuántas dinámicas hay y qué son. No es un veredicto —no
 * hay puntaje ni nota—: es el índice de lo que sigue.
 */
export function relationshipDynamicsLead(reading: RelationshipReading): string | null {
  const total = reading.dynamics.length;
  if (total === 0) return null;
  const palabras = ["", "Una dinámica", "Dos dinámicas", "Tres dinámicas"];
  const sujeto = palabras[total] ?? `${total} dinámicas`;
  return total === 1
    ? `${sujeto} concentra lo que este cálculo encontró entre las dos cartas.`
    : `${sujeto} concentran lo que este cálculo encontró entre las dos cartas.`;
}

/** Qué papel cumple una dinámica, y dónde. La reutilización se dice acá también. */
export function relationshipDynamicRole(dynamic: RelationshipDynamic): string {
  const donde =
    dynamic.dimensions.length === 1
      ? `Pesa en ${dynamic.dimensions[0]}`
      : `El mismo contacto cuenta en ${dynamic.dimensions.slice(0, -1).join(", ")} y en ${dynamic.dimensions[dynamic.dimensions.length - 1]}`;
  const clase =
    dynamic.quality === "support"
      ? "como recurso de fluidez"
      : dynamic.quality === "tension"
        ? "como punto de tensión"
        : dynamic.quality === "neutral"
          ? "concentrando el tema sin inclinarlo"
          : null;
  return clase ? `${donde}, ${clase}.` : `${donde}.`;
}

/**
 * El cierre factual de la síntesis: cuántos contactos DISTINTOS hay y cuántos se
 * reutilizan. Reemplaza al recuento anterior, que sumaba filas y por eso contaba
 * dos veces el contacto que alimenta dos dimensiones (QA22-021).
 */
export function relationshipContactsLine(reading: RelationshipReading): string {
  const cuenta =
    reading.uniqueContacts === 1
      ? "Entre las dos cartas hay 1 contacto real."
      : `Entre las dos cartas hay ${reading.uniqueContacts} contactos reales distintos.`;
  if (reading.sharedContacts === 0) return cuenta;
  const compartidos =
    reading.sharedContacts === 1
      ? "Uno de ellos cuenta en más de una dimensión"
      : `${reading.sharedContacts} de ellos cuentan en más de una dimensión`;
  return `${cuenta} ${compartidos}: es el mismo contacto leído desde dos lados, no una repetición.`;
}
