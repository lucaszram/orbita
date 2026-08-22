/**
 * El TIPO DE VÍNCULO: qué es esa persona para quien la guarda (QA23-004).
 *
 * Es un dato **declarado**, no calculado. No sale del signo, ni de la fecha, ni
 * de la carta, ni del nombre, ni de la edad: se pregunta y se guarda tal como se
 * respondió. Ninguna función de este archivo mira datos de nacimiento, y ésa es
 * justamente la garantía —un vínculo no se infiere de una carta—.
 *
 * Vive suelto, sin importar el contrato generado, por dos razones:
 *
 * 1. **Compatibilidad.** El campo es aditivo y opcional en `convex/**`. Un
 *    cliente de los builds 22/23 no lo conoce, y este cliente tiene que poder
 *    leer perfiles y sobres que todavía no lo traen. Por eso la lectura entra
 *    por `readRelationshipType`, que acepta cualquier cosa y devuelve `null` si
 *    no es uno de los ocho valores.
 * 2. **Sin ciclos.** Lo usan el dominio de Vínculos, la lectura y las tres
 *    pantallas; si dependiera de `@/services/relationshipsApi` arrastraría el
 *    contrato entero a lugares que sólo necesitan el vocabulario.
 *
 * **`null` y `prefer_not_to_say` no son lo mismo.** `null` es un perfil LEGACY:
 * se guardó antes de que el campo existiera, o se guardó sin contestar, y nadie
 * declaró nada. `prefer_not_to_say` es una respuesta explícita: la persona vio
 * la pregunta y eligió no decirlo. La diferencia se ve en pantalla —sólo el
 * primero ofrece `DEFINIR TIPO DE VÍNCULO`— y ninguno de los dos bloquea nada.
 */

/**
 * Los ocho valores internos, en el orden en que se presentan. Son los que fija
 * el contrato (`relationshipTypeValidator` en `convex/lib/layerContract.ts`) y
 * viajan crudos al backend: lo que se ve en pantalla es su etiqueta, nunca la
 * clave.
 */
export const RELATIONSHIP_TYPES = [
  "romantic",
  "parent_or_caregiver",
  "child",
  "sibling",
  "friendship",
  "work_or_project",
  "other",
  "prefer_not_to_say"
] as const;

export type RelationshipTypeKey = (typeof RELATIONSHIP_TYPES)[number];

/**
 * Cómo se llama cada uno en pantalla. Es copy literal y cerrado: son las
 * etiquetas que definió Lucas, y ninguna pasada puede reescribirlas sin que la
 * prueba de vocabulario lo note.
 */
export const RELATIONSHIP_TYPE_LABEL: Record<RelationshipTypeKey, string> = {
  romantic: "Vínculo romántico",
  parent_or_caregiver: "Madre, padre o cuidador/a",
  child: "Hijo/a",
  sibling: "Hermano/a",
  friendship: "Amistad",
  work_or_project: "Trabajo o proyecto",
  other: "Otro vínculo",
  prefer_not_to_say: "Prefiero no decirlo"
};

/** El selector, ya armado desde las dos tablas: una sola fuente de verdad. */
export const RELATIONSHIP_TYPE_OPTIONS: ReadonlyArray<{
  key: RelationshipTypeKey;
  label: string;
}> = RELATIONSHIP_TYPES.map((key) => ({ key, label: RELATIONSHIP_TYPE_LABEL[key] }));

/**
 * Un valor que llegó de afuera —del contrato, de una URL, de un caché viejo—
 * convertido en uno de los ocho, o `null`.
 *
 * `null` es la respuesta para todo lo que no sea exactamente una de las ocho
 * claves: `undefined` de un sobre viejo, un string desconocido de un backend
 * más nuevo, o un `null` explícito. En los tres casos la lectura que
 * corresponde es la neutral, así que la degradación es la misma.
 */
export function relationshipTypeValue(raw: unknown): RelationshipTypeKey | null {
  if (typeof raw !== "string") return null;
  return RELATIONSHIP_TYPES.find((key) => key === raw) ?? null;
}

/**
 * El tipo declarado de un perfil o de un sobre, leído sin exigir que el campo
 * exista.
 *
 * Recibe `unknown` a propósito: mientras el codegen del contrato no incluya el
 * campo, `RelationshipProfile` no lo declara y cualquier acceso tipado no
 * compilaría. Con el campo publicado sigue funcionando igual —lee la misma
 * propiedad— así que no hay una segunda versión que mantener.
 */
export function readRelationshipType(source: unknown): RelationshipTypeKey | null {
  if (!source || typeof source !== "object") return null;
  return relationshipTypeValue((source as { relationshipType?: unknown }).relationshipType);
}

/** ¿Alguien declaró algo? `prefer_not_to_say` cuenta: es una respuesta. */
export function relationshipTypeIsDeclared(type: RelationshipTypeKey | null): boolean {
  return type !== null;
}

/**
 * ¿Este perfil quedó sin definir? Es el único caso que ofrece el CTA.
 *
 * Legacy no bloquea nada: la comparación se abre, se calcula y se lee igual.
 * Lo único que cambia es que la lectura es la neutral y que hay un lugar
 * visible para declararlo.
 */
export function relationshipTypeNeedsDefinition(type: RelationshipTypeKey | null): boolean {
  return type === null;
}

/**
 * La única puerta del lenguaje de deseo. **Sólo `romantic`.**
 *
 * Todo lo demás —los otros seis, `prefer_not_to_say` y el legacy `null`— lee la
 * versión neutral: la dimensión se llama `Energía compartida` y su texto habla
 * de iniciativa, expresión y ritmo, nunca de atracción ni de sexo. La regla está
 * escrita una sola vez, acá, y la reproduce el backend con la misma condición
 * (`args.relationshipType === "romantic"` en `convex/lib/relationshipLayers.ts`).
 */
export function relationshipTypeAllowsDesire(type: RelationshipTypeKey | null): boolean {
  return type === "romantic";
}

/**
 * Cómo se llama la quinta dimensión cuando el vínculo declarado no es
 * romántico. Es el MISMO literal que publica el motor
 * (`NEUTRAL_DESIRE_LABEL`): si divergieran, la escalera del nivel 01 y la fila
 * calculada nombrarían dos cosas distintas para la misma dimensión.
 */
export const RELATIONSHIP_NEUTRAL_DESIRE_LABEL = "Energía compartida";

// ---------------------------------------------------------------------------
// Copy de la pregunta y del CTA
// ---------------------------------------------------------------------------

/** El rótulo del campo, junto al nombre. */
export const RELATIONSHIP_TYPE_FIELD_LABEL = "TIPO DE VÍNCULO";

/**
 * Qué es y qué no es, dicho donde se pregunta.
 *
 * Las dos mitades importan: que lo declara la persona —no un cálculo— y que
 * cambia CÓMO se escribe la lectura, no QUÉ se calcula. Sin la segunda mitad,
 * elegir un tipo se leería como pedir otro resultado.
 */
export const RELATIONSHIP_TYPE_FIELD_HINT =
  "Lo declarás vos. No sale del signo, ni de la fecha, ni de la carta: cambia cómo se escribe la lectura, no lo que se calcula.";

/** Que se puede guardar sin contestar, dicho antes de guardar. */
export const RELATIONSHIP_TYPE_OPTIONAL_HINT =
  "Es opcional. Podés guardar sin elegir ninguno y definirlo más adelante.";

/**
 * El CTA de un perfil legacy. Copy literal del registro: `DEFINIR TIPO DE
 * VÍNCULO`, en mayúsculas y sin nombre adentro —el nombre va en la etiqueta
 * accesible, que es donde se escucha—.
 */
export const RELATIONSHIP_TYPE_DEFINE_CTA = "DEFINIR TIPO DE VÍNCULO";

/** La misma acción, dicha entera para un lector de pantalla. */
export function relationshipTypeDefineVoice(name: string): string {
  const quien = name.trim();
  return quien ? `Definir el tipo de vínculo con ${quien}` : "Definir el tipo de vínculo";
}

/** Qué va a pasar al tocarlo, incluido lo que NO va a pasar. */
export const RELATIONSHIP_TYPE_DEFINE_HINT =
  "Abre sus datos para declararlo. La comparación se puede abrir igual.";

/**
 * Qué hay que decir del tipo en el perfil de una persona.
 *
 * Tres estados y tres frases distintas, porque son tres cosas distintas:
 * declarado, elegido-en-blanco y nunca-definido. `null` es el único que pide
 * algo, y lo pide sin bloquear.
 */
export function relationshipTypeLine(type: RelationshipTypeKey | null): string {
  if (type === null) {
    return "Todavía no declaraste qué vínculo tenés con esta persona. La lectura usa la versión neutral y la comparación se abre igual.";
  }
  if (type === "prefer_not_to_say") {
    return "Elegiste no declarar el tipo de vínculo. La lectura usa la versión neutral.";
  }
  if (type === "romantic") {
    return "Declaraste un vínculo romántico, así que la lectura puede nombrar el plano del deseo.";
  }
  return `Declaraste: ${RELATIONSHIP_TYPE_LABEL[type].toLocaleLowerCase("es")}. La lectura usa la versión neutral.`;
}

/** El chip de la fila: la etiqueta declarada, o `null` si no hay ninguna. */
export function relationshipTypeChip(type: RelationshipTypeKey | null): string | null {
  return type === null ? null : RELATIONSHIP_TYPE_LABEL[type].toLocaleUpperCase("es");
}

// ---------------------------------------------------------------------------
// Guardado: qué viaja, y qué pasa si el backend todavía no lo conoce
// ---------------------------------------------------------------------------

/**
 * El campo tal como viaja en el pedido de guardado, o nada.
 *
 * El validator del contrato es `v.optional(relationshipTypeValidator)`: acepta
 * los ocho valores o la AUSENCIA del campo, **no `null`**. Mandar `null` sería
 * un error de validación, y omitirlo tiene además la semántica correcta —el
 * backend sólo toca el campo cuando viene declarado, así que editar desde un
 * cliente que no lo conoce no borra una elección hecha desde otro—.
 *
 * Por eso "sin definir" se guarda NO mandando nada, y volver a "sin definir"
 * desde la app no existe: para eso está `prefer_not_to_say`, que además dice
 * algo distinto.
 */
export function relationshipTypeSaveField(
  type: RelationshipTypeKey | null
): { relationshipType?: RelationshipTypeKey } {
  return type === null ? {} : { relationshipType: type };
}

/** El texto de un error, venga como venga. */
function mensajeDeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (error && typeof error === "object") {
    const candidato = error as { message?: unknown; data?: unknown };
    if (typeof candidato.message === "string") return candidato.message;
    if (typeof candidato.data === "string") return candidato.data;
  }
  return "";
}

/**
 * ¿Este error es "tu backend todavía no conoce el tipo de vínculo"?
 *
 * Degradación ante un deployment viejo. Convex valida los argumentos de la
 * mutation contra su validator y rechaza un campo que no declaró
 * —`ArgumentValidationError: Object contains extra field 'relationshipType'…`—,
 * así que un cliente nuevo contra un backend sin desplegar no guardaría NADA:
 * ni el nombre, ni la fecha, ni la carta. Reconocerlo permite reintentar el
 * mismo pedido sin el campo y guardar a la persona igual, diciendo que el tipo
 * quedó sin registrar.
 *
 * Es deliberadamente estrecho: exige que el error nombre EL campo y que sea un
 * rechazo de validación. Un fallo de red, un error de permisos o cualquier otra
 * excepción no entran acá y siguen tratándose como lo que son.
 */
export function relationshipTypeRejectedByBackend(error: unknown): boolean {
  const mensaje = mensajeDeError(error);
  if (!mensaje.includes("relationshipType")) return false;
  return (
    mensaje.includes("ArgumentValidationError") ||
    mensaje.includes("extra field") ||
    mensaje.includes("Unexpected field") ||
    mensaje.includes("not in the validator")
  );
}

/** Lo que se dice cuando la persona se guardó pero el tipo no pudo viajar. */
export const RELATIONSHIP_TYPE_NOT_SAVED_NOTE =
  "Guardamos a esta persona, pero el tipo de vínculo todavía no se pudo registrar en tu cuenta. La lectura queda en su versión neutral y podés volver a intentarlo más adelante.";
