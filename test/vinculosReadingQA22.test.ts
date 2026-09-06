/**
 * QA22 · pasada 4B-T — la LECTURA de Vínculos, sobre fixtures mínimos.
 *
 * Es la contraparte de `test/vinculosLecturaQA22.test.ts`, que corre el MOTOR
 * real de punta a punta. Acá no hay motor: cada sobre se escribe a mano, tipado
 * contra el contrato, con la cantidad exacta de contactos que hace falta para
 * que una sola regla quede aislada. Es lo que permite afirmar cosas que un
 * fixture calculado sólo puede insinuar —"con dos ids devuelve dos dinámicas",
 * "el desempate final es el id"— sin depender de qué aspectos formen dos cartas.
 *
 * Lo que se fija:
 *
 * 1. **Identidad.** Un contacto es su `id`. El mismo id repetido dentro de una
 *    dimensión es contarlo dos veces y se descarta; dos ids distintos con el
 *    MISMO texto son dos contactos y sobreviven los dos; el mismo id en dos
 *    dimensiones es UNO, se conserva en las dos y la reutilización se dice.
 * 2. **Degradación.** Un sobre del build 22 —`drivers: string[]` y nada más—
 *    sigue abriendo, con `quality`, `weight` y `precision` en `null` y sin
 *    afirmar ninguna reutilización.
 * 3. **Orden.** Peso, calidad, precisión y dos desempates estables. Cada
 *    escalón se prueba con un fixture donde ese escalón es el que decide.
 * 4. **Texto.** Cuenta en singular y plural, balance escrito, las tres
 *    estructuras de cada una de las cinco dimensiones y el copy literal del
 *    control de contactos.
 * 5. **Fuente y validador.** Que el contrato siga siendo aditivo, que los ids
 *    productivos no dependan del índice ni del copy, que la dedupe compare
 *    solamente el id y que la pantalla no vuelva a dibujar la barra.
 *
 * Las rutas por plataforma y la superficie web NO se re-verifican acá: ya las
 * custodian `test/vinculosQA22.test.ts`, `test/vinculosLecturaQA22.test.ts` y
 * `test/vinculosNativeV492.test.ts`. Repetir el recorrido del grafo haría que el
 * mismo gate falle cuatro veces sin decir nada nuevo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import type { Infer } from "convex/values";
import {
  relationshipDriverDetailValidator,
  relationshipDimensionValidator
} from "../convex/lib/layerContract";
import {
  relationshipDriverDetails,
  type RelationshipDriver
} from "../convex/lib/relationshipLayers";
import {
  RELATIONSHIP_DIMENSION_LABEL,
  RELATIONSHIP_READING_LIMITS_LABEL,
  RELATIONSHIP_WHAT_YOU_SEE_LABEL,
  type RelationshipDimensionKey
} from "../src/domain/relationships";
import {
  RELATIONSHIP_BALANCE_LABEL,
  RELATIONSHIP_MAX_DYNAMICS,
  relationshipBalanceWord,
  relationshipContactRole,
  relationshipContactsCollapseLabel,
  relationshipContactsCount,
  relationshipContactsLine,
  relationshipContactsToggleLabel,
  relationshipContactsToggleVoice,
  relationshipDimensionRow,
  relationshipDimensionRowVoice,
  relationshipDynamicRole,
  relationshipDynamicsLead,
  relationshipReading,
  type RelationshipReading
} from "../src/domain/relationshipReading";
import type { RelationshipDimension } from "../src/services/relationshipsApi";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const RESULTADO = "src/screens/v492/VinculosResultScreen.tsx";
const CONECTAR = "src/screens/v492/VinculosConnectScreen.tsx";
const CONTRATO = "convex/lib/layerContract.ts";
const MOTOR = "convex/lib/relationshipLayers.ts";
const BACKEND = "convex/relationships.ts";

// ---------------------------------------------------------------------------
// Fixtures: la voz canónica del motor, escrita a mano
// ---------------------------------------------------------------------------

/**
 * Las oraciones tienen la forma EXACTA que publica el motor, porque el nombre
 * corto se extrae de ahí (`relationshipDriverShortName`). Si se inventaran, la
 * lectura caería a su versión contable y las pruebas de texto pasarían por un
 * camino que la app real no toma.
 */
const MERCURIO_MERCURIO =
  "Su Mercurio forma una conjunción con tu Mercurio, un contacto de 0°; está a 0,5° de su máxima precisión.";
const LUNA_LUNA =
  "Su Luna forma una oposición con tu Luna, un contacto de 180°; está a 1,5° de su máxima precisión.";
const LUNA_VENUS =
  "Su Luna forma un trígono con tu Venus, un contacto de 120°; está a 0,8° de su máxima precisión.";
const VENUS_MARTE =
  "Su Venus forma un trígono con tu Marte, un contacto de 120°; está a 0,0° de su máxima precisión.";
const MARTE_MARTE =
  "Su Marte forma una cuadratura con tu Marte, un contacto de 90°; está a 0,5° de su máxima precisión.";
const MARTE_MARTE_CONJUNCION =
  "Su Marte forma una conjunción con tu Marte, un contacto de 0°; está a 2,4° de su máxima precisión.";
const VENUS_VENUS =
  "Su Venus forma una conjunción con tu Venus, un contacto de 0°; está a 1,8° de su máxima precisión.";
const SOL_VENUS =
  "Su Sol forma un sextil con tu Venus, un contacto de 60°; está a 2,0° de su máxima precisión.";
const VENUS_CASA_5 = "Su Venus cae en tu casa 5, vinculada con deseo y expresión.";
const ASCENDENTE_LUNA =
  "Su Ascendente forma una cuadratura con tu Luna, un contacto de 90°; está a 1,0° de su máxima precisión.";
const SATURNO_SOL =
  "Su Saturno forma una cuadratura con tu Sol, un contacto de 90°; está a 0,3° de su máxima precisión.";
const JUPITER_SATURNO =
  "Su Júpiter forma un sextil con tu Saturno, un contacto de 60°; está a 1,2° de su máxima precisión.";

type Detalle = NonNullable<RelationshipDimension["driverDetails"]>[number];

/** Un contacto del contrato. Por omisión apoya, pesa 1 y es exacto. */
function contacto(
  id: string,
  text: string,
  over: Partial<Omit<Detalle, "id" | "text">> = {}
): Detalle {
  return { id, text, quality: "support", weight: 1, precision: "exact", ...over };
}

/**
 * Una dimensión publicada. `value` va con un número cualquiera A PROPÓSITO: el
 * contrato lo sigue publicando y la lectura no lo mira, así que ninguna prueba
 * puede pasar apoyándose en él. Lo mismo con `summary`, que es la plantilla por
 * tono que la pantalla dejó de mostrar.
 */
function dimension(key: RelationshipDimensionKey, detalles: readonly Detalle[]): RelationshipDimension {
  return {
    key,
    label: RELATIONSHIP_DIMENSION_LABEL[key],
    value: 0.5,
    summary: `Plantilla por tono de ${RELATIONSHIP_DIMENSION_LABEL[key]}.`,
    drivers: detalles.map((detalle) => detalle.text),
    driverDetails: [...detalles],
    precision: "exact"
  };
}

/** Una dimensión del build 22: sólo oraciones, sin la evidencia estructurada. */
function dimensionLegacy(
  key: RelationshipDimensionKey,
  drivers: readonly string[]
): RelationshipDimension {
  return {
    key,
    label: RELATIONSHIP_DIMENSION_LABEL[key],
    value: 0.5,
    summary: `Plantilla por tono de ${RELATIONSHIP_DIMENSION_LABEL[key]}.`,
    drivers: [...drivers],
    precision: "exact"
  };
}

const comparacion = (dimensions: readonly RelationshipDimension[]) => ({
  generalOnly: false,
  dimensions: [...dimensions]
});

/**
 * La lectura de este fixture, leída como un vínculo ROMÁNTICO declarado.
 *
 * Los sobres de acá arriba se arman con `RELATIONSHIP_DIMENSION_LABEL`, que es
 * el vocabulario romántico —la quinta dimensión se llama `Deseo`—, así que el
 * tipo se declara para que el rótulo del sobre y el de la lectura sean el
 * mismo. Estas pruebas son sobre IDENTIDAD y ORDEN de contactos, no sobre el
 * tipo de vínculo: el vocabulario neutral y su regla viven en
 * `test/tipoVinculoFrontQA23.test.ts`.
 */
function lecturaDe(dimensions: readonly RelationshipDimension[]): RelationshipReading {
  const lectura = relationshipReading(comparacion(dimensions), "romantic");
  assert.ok(lectura, "el fixture tiene dimensiones: la lectura no puede ser null");
  return lectura;
}

const porClave = (lectura: RelationshipReading, key: RelationshipDimensionKey) => {
  const leida = lectura.dimensions.find((candidata) => candidata.key === key);
  assert.ok(leida, `falta la dimensión ${key} en el fixture`);
  return leida;
};

// ---------------------------------------------------------------------------
// a) Identidad dentro de una dimensión: el mismo id es un solo contacto
// ---------------------------------------------------------------------------

test("el mismo id repetido dentro de una dimensión se cuenta una sola vez", () => {
  // Tres filas, dos contactos. La segunda repite el id de la primera con otro
  // texto, otra calidad y un peso enorme: si la dedupe mirara cualquier otra
  // cosa que el id, esa fila entraría y encabezaría la dimensión.
  const deseo = dimension("desire", [
    contacto("aspect:a:mars:b:venus:trine", VENUS_MARTE, { weight: 1.5, quality: "support" }),
    contacto("aspect:a:mars:b:venus:trine", "Texto distinto del mismo contacto.", {
      weight: 9,
      quality: "tension"
    }),
    contacto("aspect:a:venus:b:sun:sextile", SOL_VENUS, { weight: 0.8 })
  ]);

  const lectura = lecturaDe([deseo]);
  const leida = porClave(lectura, "desire");

  assert.equal(leida.contacts, 2, "tres filas, dos identidades");
  assert.deepEqual(
    leida.contactsList.map((c) => c.id),
    ["aspect:a:mars:b:venus:trine", "aspect:a:venus:b:sun:sextile"]
  );
  // Gana la PRIMERA aparición: es la que el sobre ordenó, y descartar la repetida
  // no puede cambiar lo que ya se había publicado.
  assert.equal(leida.contactsList[0]!.text, VENUS_MARTE);
  assert.equal(leida.contactsList[0]!.weight, 1.5);
  assert.equal(leida.contactsList[0]!.quality, "support");

  // La cuenta global también es de identidades, no de filas.
  assert.equal(lectura.uniqueContacts, 2);
  assert.equal(lectura.sharedContacts, 0);
  assert.equal(deseo.drivers.length, 3, "el sobre sí traía tres oraciones");
});

// ---------------------------------------------------------------------------
// b) Dos ids con el mismo texto son dos contactos
// ---------------------------------------------------------------------------

test("dos contactos con el MISMO texto y distinto id sobreviven los dos", () => {
  // El caso que el registro pidió no borrar (QA22-021): `Su Ascendente □ tu Luna`
  // y `Su Descendente □ tu Luna` pueden quedar redactados casi igual, y son dos
  // hechos distintos del cálculo. Acá el texto es literalmente idéntico, que es
  // el peor caso posible para una dedupe por copy.
  const cuidado = dimension("care", [
    contacto("aspect:a:moon:b:ascendant:square", ASCENDENTE_LUNA, {
      quality: "tension",
      weight: 1
    }),
    contacto("aspect:a:moon:b:descendant:square", ASCENDENTE_LUNA, {
      quality: "tension",
      weight: 0.9
    })
  ]);

  const leida = porClave(lecturaDe([cuidado]), "care");
  assert.equal(leida.contacts, 2, "borrar uno perdería evidencia real");
  assert.deepEqual(
    leida.contactsList.map((c) => c.id),
    ["aspect:a:moon:b:ascendant:square", "aspect:a:moon:b:descendant:square"]
  );
  assert.equal(new Set(leida.contactsList.map((c) => c.text)).size, 1, "el texto sí es el mismo");
});

// ---------------------------------------------------------------------------
// c) El mismo id en dos dimensiones: uno solo, en las dos, y dicho
// ---------------------------------------------------------------------------

/** Marte con Marte alimenta Deseo y Fricción, con distinto peso en cada una. */
const REUTILIZADO = "aspect:a:mars:b:mars:square";

function fixtureReutilizacion() {
  return [
    dimension("desire", [
      contacto("aspect:a:mars:b:venus:trine", VENUS_MARTE, { weight: 1.5, quality: "support" }),
      contacto(REUTILIZADO, MARTE_MARTE, { weight: 1, quality: "tension" })
    ]),
    dimension("friction", [contacto(REUTILIZADO, MARTE_MARTE, { weight: 1.2, quality: "tension" })])
  ];
}

test("un contacto que alimenta dos dimensiones se cuenta una vez y se queda en las dos", () => {
  const lectura = lecturaDe(fixtureReutilizacion());
  const deseo = porClave(lectura, "desire");
  const friccion = porClave(lectura, "friction");

  // Tres filas publicadas, dos contactos reales.
  assert.equal(deseo.contacts + friccion.contacts, 3);
  assert.equal(lectura.uniqueContacts, 2, "el reutilizado es uno, no dos");
  assert.equal(lectura.sharedContacts, 1);

  // Permanece en las DOS: no se esconde de ninguna para no repetirlo.
  const enDeseo = deseo.contactsList.find((c) => c.id === REUTILIZADO);
  const enFriccion = friccion.contactsList.find((c) => c.id === REUTILIZADO);
  assert.ok(enDeseo && enFriccion);
  assert.equal(enDeseo.text, enFriccion.text, "es la misma relación, con la misma oración");

  // Y cada lado nombra al OTRO, nunca a sí mismo.
  assert.deepEqual(enDeseo.alsoIn, ["Fricción"]);
  assert.deepEqual(enFriccion.alsoIn, ["Deseo"]);
  assert.deepEqual(
    deseo.contactsList.find((c) => c.id !== REUTILIZADO)!.alsoIn,
    [],
    "un contacto de una sola dimensión no declara reutilización"
  );

  // El papel lo explica: qué aporta acá y que es el MISMO de allá.
  assert.equal(
    relationshipContactRole(enDeseo),
    "Cuenta como punto de tensión. Es el MISMO contacto que también cuenta en Fricción: uno solo, leído desde dos lados."
  );
  assert.equal(
    relationshipContactRole(deseo.contactsList.find((c) => c.id !== REUTILIZADO)!),
    "Cuenta como recurso de fluidez."
  );

  // Como dinámica es una sola, conserva el peso MAYOR que alcanzó y nombra las
  // dos dimensiones en el orden en que el contrato las publica.
  assert.equal(lectura.dynamics.length, 2);
  const dinamica = lectura.dynamics.find((d) => d.id === REUTILIZADO)!;
  assert.deepEqual(dinamica.dimensions, ["Deseo", "Fricción"]);
  assert.equal(dinamica.weight, 1.2, "se queda con el peso de la dimensión donde más importa");
  assert.equal(
    relationshipDynamicRole(dinamica),
    "El mismo contacto cuenta en Deseo y en Fricción, como punto de tensión."
  );
  assert.equal(
    relationshipDynamicRole(lectura.dynamics.find((d) => d.id !== REUTILIZADO)!),
    "Pesa en Deseo, como recurso de fluidez."
  );

  // Y el cierre factual cuenta identidades, no filas.
  assert.equal(
    relationshipContactsLine(lectura),
    "Entre las dos cartas hay 2 contactos reales distintos. Uno de ellos cuenta en más de una dimensión: es el mismo contacto leído desde dos lados, no una repetición."
  );
});

// ---------------------------------------------------------------------------
// d) Sobres del build 22: usables, y sin afirmar lo que no pueden afirmar
// ---------------------------------------------------------------------------

test("un sobre sin driverDetails se lee igual y deja calidad, peso y precisión en null", () => {
  // El MISMO texto en dos dimensiones. En un sobre con evidencia sería un
  // contacto reutilizado; acá no hay id que lo demuestre, así que no se dice.
  const lectura = lecturaDe([
    dimensionLegacy("desire", [VENUS_MARTE, MARTE_MARTE]),
    dimensionLegacy("friction", [MARTE_MARTE])
  ]);

  assert.equal(lectura.detailed, false);
  const deseo = porClave(lectura, "desire");
  const friccion = porClave(lectura, "friction");

  for (const leida of [deseo, friccion]) {
    assert.equal(leida.detailed, false);
    assert.equal(leida.balance, "sin_detalle", "no se inventa un balance que el sobre no permite");
    assert.match(leida.facilitates, /sin el detalle de cada contacto/);
    assert.match(leida.strains, /tampoco podemos señalar/);
    // La invitación no depende de la calidad de los contactos: sigue en pie, y
    // es lo que mantiene la pantalla usable.
    assert.ok(leida.invitation.length > 0);
    for (const c of leida.contactsList) {
      assert.equal(c.quality, null, "sin evidencia no se fabrica una calidad");
      assert.equal(c.weight, null, "ni un peso");
      assert.equal(c.precision, null, "ni una precisión");
      assert.deepEqual(c.alsoIn, [], "un id sintético no certifica reutilización");
      assert.equal(relationshipContactRole(c), null, "no hay papel que declarar");
    }
  }

  // Nada se presenta como compartido, ni siquiera el texto que se repite.
  assert.equal(lectura.sharedContacts, 0);
  assert.equal(lectura.uniqueContacts, 3, "tres oraciones, tres ids sintéticos distintos");

  // Y los contactos se muestran igual, en el orden que el sobre ya traía.
  assert.deepEqual(
    deseo.contactsList.map((c) => c.text),
    [VENUS_MARTE, MARTE_MARTE]
  );

  // La fila lo dice con todas las letras, y el lector de pantalla también.
  assert.equal(relationshipDimensionRow(friccion), "1 contacto · balance sin detalle");
  assert.match(relationshipDimensionRowVoice(friccion), /sin el detalle de cada contacto/);

  // Dos oraciones IDÉNTICAS dentro de la misma dimensión sí colapsan: sin ids,
  // el texto es lo único que ese sobre publica. Es la contrapartida asumida de
  // la degradación, no un descuido — y por eso un sobre viejo tampoco afirma
  // nunca que un contacto se reutilice.
  const repetida = porClave(lecturaDe([dimensionLegacy("care", [LUNA_LUNA, LUNA_LUNA])]), "care");
  assert.equal(repetida.contacts, 1);
});

// ---------------------------------------------------------------------------
// e) El orden: peso, calidad, precisión y dos desempates estables
// ---------------------------------------------------------------------------

/**
 * Cinco contactos ordenados A PROPÓSITO al revés de como deben salir: cada
 * escalón del comparador tiene que mover algo, o la prueba no probaría nada.
 */
const ORDEN_ID_PESO = "aspect:a:mars:b:venus:trine";
const ORDEN_ID_TENSION_EXACTA = "aspect:a:mars:b:mars:square";
const ORDEN_ID_APOYO = "aspect:a:venus:b:sun:sextile";
/** La Luna sin hora exacta es justo lo que el motor acota a un rango. */
const ORDEN_ID_RANGO = "aspect:a:moon:b:moon:opposition";
const ORDEN_ID_ESTIMADO = "aspect:a:venus:b:venus:conjunction";

function fixtureOrden() {
  return [
    dimension("desire", [
      contacto(ORDEN_ID_PESO, VENUS_MARTE, {
        weight: 1.5,
        quality: "support",
        precision: "exact"
      }),
      contacto(ORDEN_ID_TENSION_EXACTA, MARTE_MARTE, {
        weight: 0.8,
        quality: "tension",
        precision: "exact"
      }),
      contacto(ORDEN_ID_APOYO, SOL_VENUS, {
        weight: 0.8,
        quality: "support",
        precision: "exact"
      }),
      contacto(ORDEN_ID_RANGO, VENUS_CASA_5, {
        weight: 0.8,
        quality: "tension",
        precision: "range"
      }),
      contacto(ORDEN_ID_ESTIMADO, VENUS_VENUS, {
        weight: 0.8,
        quality: "tension",
        precision: "estimated"
      })
    ])
  ];
}

test("los contactos se ordenan por peso, después calidad y después precisión", () => {
  const deseo = porClave(lecturaDe(fixtureOrden()), "desire");

  assert.deepEqual(deseo.contactsList.map((c) => c.id), [
    // 1,5 — el peso manda antes que nada.
    ORDEN_ID_PESO,
    // Empatados en 0,8: el apoyo salta por encima de la tensión aunque el sobre
    // lo trajera después.
    ORDEN_ID_APOYO,
    ORDEN_ID_TENSION_EXACTA,
    // Y entre tensiones, la precisión: exacta, estimada y recién ahí el rango.
    ORDEN_ID_ESTIMADO,
    ORDEN_ID_RANGO
  ]);

  const pesos = deseo.contactsList.map((c) => c.weight ?? -1);
  assert.deepEqual(pesos, [...pesos].sort((a, b) => b - a));
});

test("la selección de dinámicas devuelve tres cuando hay tres, y dos cuando hay dos", () => {
  assert.equal(RELATIONSHIP_MAX_DYNAMICS, 3);

  const conCinco = lecturaDe(fixtureOrden());
  assert.equal(conCinco.uniqueContacts, 5);
  assert.equal(conCinco.dynamics.length, RELATIONSHIP_MAX_DYNAMICS, "nunca más de tres");
  assert.deepEqual(conCinco.dynamics.map((d) => d.id), [
    ORDEN_ID_PESO,
    ORDEN_ID_APOYO,
    ORDEN_ID_TENSION_EXACTA
  ]);
  assert.equal(relationshipDynamicsLead(conCinco), "Tres dinámicas concentran lo que este cálculo encontró entre las dos cartas.");

  // Con dos identidades hay dos dinámicas: no se rellena hasta tres.
  const conDos = lecturaDe(fixtureReutilizacion());
  assert.equal(conDos.dynamics.length, 2);
  assert.equal(relationshipDynamicsLead(conDos), "Dos dinámicas concentran lo que este cálculo encontró entre las dos cartas.");

  // Y con una, una sola, dicha en singular.
  const conUna = lecturaDe([dimension("care", [contacto("aspect:a:moon:b:venus:trine", LUNA_VENUS)])]);
  assert.equal(conUna.dynamics.length, 1);
  assert.equal(relationshipDynamicsLead(conUna), "Una dinámica concentra lo que este cálculo encontró entre las dos cartas.");

  // Nunca hay puntaje: el encabezado cuenta dinámicas, no califica el vínculo.
  for (const lead of [conCinco, conDos, conUna].map(relationshipDynamicsLead)) {
    assert.doesNotMatch(lead!, /puntaje|compatibilidad|%|nota/i);
  }
});

test("empatado todo, decide la posición del sobre; empatada también, el id", () => {
  // Mismo peso, misma calidad y misma precisión dentro de una dimensión: gana la
  // posición que el sobre ya había decidido, aunque el id ordene al revés.
  const porPosicion = porClave(
    lecturaDe([
      dimension("desire", [
        contacto("aspect:a:venus:b:venus:conjunction", VENUS_VENUS, {
          weight: 1,
          quality: "neutral"
        }),
        contacto("aspect:a:mars:b:mars:conjunction", MARTE_MARTE_CONJUNCION, {
          weight: 1,
          quality: "neutral"
        })
      ])
    ]),
    "desire"
  );
  assert.deepEqual(porPosicion.contactsList.map((c) => c.id), [
    "aspect:a:venus:b:venus:conjunction",
    "aspect:a:mars:b:mars:conjunction"
  ]);
  assert.ok(
    "aspect:a:mars:b:mars:conjunction".localeCompare("aspect:a:venus:b:venus:conjunction") < 0,
    "si el id hubiera decidido, el orden sería el otro"
  );

  // Dos contactos primeros de SU dimensión empatan también en posición. Ahí, y
  // sólo ahí, decide el id: es un valor estable que no depende del texto ni del
  // índice de ningún arreglo intermedio.
  const porId = lecturaDe([
    dimension("communication", [
      contacto("aspect:a:mercury:b:mercury:conjunction", MERCURIO_MERCURIO, {
        weight: 1,
        quality: "neutral"
      })
    ]),
    dimension("care", [
      contacto("aspect:a:moon:b:moon:opposition", LUNA_LUNA, { weight: 1, quality: "neutral" })
    ])
  ]);
  assert.deepEqual(porId.dynamics.map((d) => d.id), [
    "aspect:a:mercury:b:mercury:conjunction",
    "aspect:a:moon:b:moon:opposition"
  ]);
});

// ---------------------------------------------------------------------------
// f) Cuenta y balance, escritos
// ---------------------------------------------------------------------------

/** Un fixture con los cinco balances posibles, uno por dimensión. */
function fixtureBalances() {
  return [
    // Sólo apoyo ⇒ más fluido, y con un único contacto: el singular.
    dimension("communication", [
      contacto("aspect:a:mercury:b:mercury:conjunction", MERCURIO_MERCURIO, {
        weight: 2,
        quality: "support"
      })
    ]),
    // La tensión pasa el margen de 1,25 ⇒ más exigente.
    dimension("care", [
      contacto("aspect:a:moon:b:moon:opposition", LUNA_LUNA, { weight: 2, quality: "tension" }),
      contacto("aspect:a:venus:b:moon:trine", LUNA_VENUS, { weight: 1, quality: "support" })
    ]),
    // Empatados dentro del margen ⇒ mixto.
    dimension("desire", [
      contacto("aspect:a:mars:b:venus:trine", VENUS_MARTE, { weight: 1, quality: "support" }),
      contacto("aspect:a:mars:b:mars:square", MARTE_MARTE, { weight: 1, quality: "tension" })
    ]),
    // Sólo neutrales ⇒ sutil.
    dimension("friction", [
      contacto("aspect:a:sun:b:saturn:square", SATURNO_SOL, { weight: 1, quality: "neutral" })
    ]),
    // Sin contactos ⇒ sin material. No es un cero: es una dimensión sin nada que
    // contar.
    dimension("shared_project", [])
  ];
}

test("la cuenta concuerda en singular y plural, y el balance va escrito al lado", () => {
  assert.equal(relationshipContactsCount(0), "sin contactos principales");
  assert.equal(relationshipContactsCount(1), "1 contacto");
  assert.equal(relationshipContactsCount(2), "2 contactos");

  const lectura = lecturaDe(fixtureBalances());
  const comunicacion = porClave(lectura, "communication");
  const cuidado = porClave(lectura, "care");
  const deseo = porClave(lectura, "desire");
  const friccion = porClave(lectura, "friction");
  const proyecto = porClave(lectura, "shared_project");

  assert.equal(comunicacion.balance, "mas_fluido");
  assert.equal(cuidado.balance, "mas_exigente");
  assert.equal(deseo.balance, "mixto");
  assert.equal(friccion.balance, "sutil");
  assert.equal(proyecto.balance, "sin_material");

  assert.equal(relationshipDimensionRow(comunicacion), "1 contacto · más fluido");
  assert.equal(relationshipDimensionRow(cuidado), "2 contactos · más exigente");
  assert.equal(relationshipDimensionRow(deseo), "2 contactos · mixto");
  assert.equal(relationshipDimensionRow(friccion), "1 contacto · sutil");
  // Sin contactos el balance no se repite: la cuenta ya lo dijo todo.
  assert.equal(relationshipBalanceWord(proyecto), null);
  assert.equal(relationshipDimensionRow(proyecto), "sin contactos principales");

  // Las etiquetas son las canónicas y ninguna se pisa con otra.
  assert.equal(RELATIONSHIP_BALANCE_LABEL.mas_fluido, "más fluido");
  assert.equal(RELATIONSHIP_BALANCE_LABEL.mas_exigente, "más exigente");
  const etiquetas = Object.values(RELATIONSHIP_BALANCE_LABEL);
  assert.equal(new Set(etiquetas).size, etiquetas.length);

  // El lector de pantalla escucha la MISMA información, nunca menos.
  assert.equal(
    relationshipDimensionRowVoice(comunicacion),
    "Cómo se hablan: 1 contacto, balance más fluido."
  );
  assert.equal(
    relationshipDimensionRowVoice(proyecto),
    "Proyecto en común: sin contactos principales en esta comparación."
  );

  // Y en ningún lado aparece un porcentaje.
  for (const leida of lectura.dimensions) {
    assert.doesNotMatch(relationshipDimensionRow(leida), /%|por ciento|compatibilidad/i);
    assert.doesNotMatch(relationshipDimensionRowVoice(leida), /%|por ciento|compatibilidad/i);
  }
});

// ---------------------------------------------------------------------------
// g) Las cinco dimensiones explican qué facilita, qué tensa y qué hacer
// ---------------------------------------------------------------------------

const CINCO: readonly RelationshipDimensionKey[] = [
  "communication",
  "care",
  "desire",
  "friction",
  "shared_project"
];

/** Las cinco dimensiones, todas con la misma inclinación, para comparar textos. */
function fixtureCinco(quality: Detalle["quality"]) {
  const texto: Record<RelationshipDimensionKey, string> = {
    communication: MERCURIO_MERCURIO,
    care: LUNA_VENUS,
    desire: VENUS_MARTE,
    friction: SATURNO_SOL,
    shared_project: JUPITER_SATURNO
  };
  return CINCO.map((key) =>
    dimension(key, [contacto(`aspect:a:sun:b:${key}:trine`, texto[key], { quality, weight: 1 })])
  );
}

test("cada una de las cinco dimensiones publica qué facilita, qué tensa y una invitación", () => {
  for (const quality of ["support", "tension"] as const) {
    const lectura = lecturaDe(fixtureCinco(quality));
    assert.equal(lectura.dimensions.length, 5);

    const facilita = new Set<string>();
    const tensa = new Set<string>();
    const invita = new Set<string>();

    for (const key of CINCO) {
      const leida = porClave(lectura, key);
      assert.ok(leida.facilitates.length > 0, `${key}: falta qué se facilita`);
      assert.ok(leida.strains.length > 0, `${key}: falta qué puede tensarse`);
      assert.ok(leida.invitation.length > 0, `${key}: falta la acción o la pregunta`);
      facilita.add(leida.facilitates);
      tensa.add(leida.strains);
      invita.add(leida.invitation);
    }

    // Cinco dimensiones, cinco textos distintos en cada estructura. La repetición
    // de la MISMA frase cambiando sólo el nombre fue el defecto registrado.
    assert.equal(facilita.size, 5, "qué se facilita no puede ser la misma frase cinco veces");
    assert.equal(tensa.size, 5);
    assert.equal(invita.size, 5);
  }

  // Con recursos hay algo concreto que hacer; sin ellos, lo honesto es preguntar.
  const conApoyo = lecturaDe(fixtureCinco("support"));
  const conTension = lecturaDe(fixtureCinco("tension"));
  for (const key of CINCO) {
    const fluida = porClave(conApoyo, key);
    const exigente = porClave(conTension, key);
    assert.equal(fluida.balance, "mas_fluido", key);
    assert.equal(exigente.balance, "mas_exigente", key);
    assert.doesNotMatch(fluida.invitation, /\?/, `${key}: con apoyo va una acción`);
    assert.match(exigente.invitation, /\?/, `${key}: sin apoyo va una pregunta`);
    assert.notEqual(fluida.invitation, exigente.invitation);
    // Y las dos se apoyan en la evidencia: el contacto se NOMBRA, no se cuenta.
    assert.match(fluida.facilitates, /^Se facilita /);
    assert.match(exigente.strains, /^Puede tensarse /);
  }
});

// ---------------------------------------------------------------------------
// h) El copy literal del control de contactos
// ---------------------------------------------------------------------------

test("el control dice VER LOS {N} CONTACTOS QUE FORMAN {DIMENSIÓN}, literal", () => {
  const lectura = lecturaDe(fixtureBalances());

  assert.equal(
    relationshipContactsToggleLabel(porClave(lectura, "communication")),
    "VER LOS 1 CONTACTOS QUE FORMAN CÓMO SE HABLAN"
  );
  assert.equal(
    relationshipContactsToggleLabel(porClave(lectura, "care")),
    "VER LOS 2 CONTACTOS QUE FORMAN CÓMO SE CUIDAN"
  );
  assert.equal(
    relationshipContactsToggleLabel(porClave(lectura, "desire")),
    "VER LOS 2 CONTACTOS QUE FORMAN DESEO"
  );
  assert.equal(
    relationshipContactsToggleLabel(porClave(lectura, "friction")),
    "VER LOS 1 CONTACTOS QUE FORMAN FRICCIÓN"
  );
  // El rótulo es una función PURA de la lectura, incluso donde la pantalla no
  // llega a dibujarlo: sin contactos no hay control que abrir, y la fila lo dice
  // con `sin contactos principales`.
  assert.equal(
    relationshipContactsToggleLabel(porClave(lectura, "shared_project")),
    "VER LOS 0 CONTACTOS QUE FORMAN PROYECTO EN COMÚN"
  );

  // `N` son los contactos ÚNICOS, no las filas: el sobre de abajo publica tres
  // oraciones y dos identidades.
  const conRepetido = porClave(
    lecturaDe([
      dimension("desire", [
        contacto("aspect:a:mars:b:venus:trine", VENUS_MARTE),
        contacto("aspect:a:mars:b:venus:trine", VENUS_MARTE),
        contacto("aspect:a:mars:b:mars:square", MARTE_MARTE, { quality: "tension" })
      ])
    ]),
    "desire"
  );
  assert.equal(conRepetido.contacts, 2);
  assert.equal(
    relationshipContactsToggleLabel(conRepetido),
    "VER LOS 2 CONTACTOS QUE FORMAN DESEO"
  );

  // Cerrar nombra la misma dimensión, y la voz resuelve la concordancia que el
  // copy visible —que es literal y no se toca— no puede tener.
  assert.equal(
    relationshipContactsCollapseLabel(conRepetido),
    "OCULTAR LOS CONTACTOS QUE FORMAN DESEO"
  );
  assert.equal(
    relationshipContactsToggleVoice(porClave(lectura, "communication")),
    "Ver el contacto que forma Cómo se hablan"
  );
  assert.equal(
    relationshipContactsToggleVoice(porClave(lectura, "care")),
    "Ver los 2 contactos que forman Cómo se cuidan"
  );
});

// ---------------------------------------------------------------------------
// i) Misma entrada, mismo resultado
// ---------------------------------------------------------------------------

test("la lectura es una función pura: misma entrada, mismo resultado, sin tocar el sobre", () => {
  const entrada = comparacion(fixtureOrden());
  const antes = JSON.stringify(entrada);

  const primera = relationshipReading(entrada);
  const segunda = relationshipReading(entrada);
  assert.deepEqual(primera, segunda, "dos corridas sobre el mismo objeto dan lo mismo");

  // Y sobre un sobre equivalente construido de cero, también.
  assert.deepEqual(primera, relationshipReading(comparacion(fixtureOrden())));

  // El sobre que llega no se modifica: la lectura ordena copias, no el arreglo
  // que publicó el backend.
  assert.equal(JSON.stringify(entrada), antes, "la lectura no puede mutar su entrada");

  // La lectura de un signo solo es otra cosa y la resuelve la pantalla.
  assert.equal(relationshipReading({ generalOnly: true, dimensions: [] }), null);
  assert.equal(relationshipReading({ generalOnly: false, dimensions: [] }), null);
});

// ---------------------------------------------------------------------------
// El derivador del backend: dedupe por id, orden intacto, campos exactos
// ---------------------------------------------------------------------------

function driver(over: Partial<RelationshipDriver> & Pick<RelationshipDriver, "id" | "text">): RelationshipDriver {
  return {
    kind: "cross_aspect",
    dimension: "desire",
    quality: "support",
    source: { person: "a", point: "venus", label: "Venus" },
    target: { person: "b", point: "mars", label: "Marte" },
    aspect: "trine",
    orb: 0,
    orbRange: null,
    precision: "exact",
    strength: 1,
    weight: 1.5,
    ...over
  };
}

test("relationshipDriverDetails deduplica por id, conserva el orden y publica cinco campos", () => {
  const entrada: RelationshipDriver[] = [
    driver({ id: "aspect:a:mars:b:venus:trine", text: VENUS_MARTE, weight: 1.5 }),
    // Mismo id, otro todo: es el mismo contacto contado dos veces y se descarta.
    driver({
      id: "aspect:a:mars:b:venus:trine",
      text: "Otra redacción del mismo contacto.",
      weight: 9,
      quality: "tension"
    }),
    // Mismo TEXTO, otro id: son dos contactos y sobreviven los dos.
    driver({ id: "aspect:a:moon:b:ascendant:square", text: ASCENDENTE_LUNA, quality: "tension" }),
    driver({ id: "aspect:a:moon:b:descendant:square", text: ASCENDENTE_LUNA, quality: "tension" })
  ];
  const copia = JSON.stringify(entrada);

  const detalles = relationshipDriverDetails(entrada);

  assert.deepEqual(detalles.map((detalle) => detalle.id), [
    "aspect:a:mars:b:venus:trine",
    "aspect:a:moon:b:ascendant:square",
    "aspect:a:moon:b:descendant:square"
  ]);
  // Gana la primera aparición, con su texto y su peso.
  assert.equal(detalles[0]!.text, VENUS_MARTE);
  assert.equal(detalles[0]!.weight, 1.5);
  assert.equal(detalles[0]!.quality, "support");

  // Cada detalle es un SUBCONJUNTO exacto del driver: ni un campo de más —`kind`,
  // `source`, `orb` no se publican— ni uno de menos.
  for (const detalle of detalles) {
    assert.deepEqual(Object.keys(detalle).sort(), ["id", "precision", "quality", "text", "weight"]);
  }
  assert.equal(JSON.stringify(entrada), copia, "el derivador no puede tocar los drivers");

  // Sin drivers no hay detalles, y no se inventa una fila vacía.
  assert.deepEqual(relationshipDriverDetails([]), []);
});

// ---------------------------------------------------------------------------
// Contrato: aditivo, cerrado y con ids que no dependen del copy
// ---------------------------------------------------------------------------

test("el contrato conserva drivers y agrega driverDetails como opcional cerrado", () => {
  // COMPATIBILIDAD DE TIPO: un sobre del build 22 sigue siendo una dimensión
  // válida. Si `driverDetails` fuera obligatorio, esto no compilaría.
  const legacy: Infer<typeof relationshipDimensionValidator> = {
    key: "desire",
    label: "Deseo",
    value: 0.5,
    summary: "En deseo conviven recursos y diferencias.",
    drivers: [MARTE_MARTE],
    precision: "exact"
  };
  assert.equal(legacy.driverDetails, undefined);
  assert.deepEqual(legacy.drivers, [MARTE_MARTE], "drivers sigue siendo un arreglo de oraciones");

  // Y la forma del detalle es cerrada: estos cinco campos, ni uno más.
  const detalle: Infer<typeof relationshipDriverDetailValidator> = {
    id: "aspect:a:mars:b:venus:trine",
    text: VENUS_MARTE,
    quality: "support",
    weight: 1.5,
    precision: "exact"
  };
  assert.deepEqual(Object.keys(detalle).sort(), ["id", "precision", "quality", "text", "weight"]);

  const contrato = leer(CONTRATO);
  assert.match(contrato, /drivers: v\.array\(v\.string\(\)\),/, "drivers no cambió de forma");
  assert.match(
    contrato,
    /driverDetails: v\.optional\(v\.array\(relationshipDriverDetailValidator\)\),/,
    "driverDetails es aditivo: opcional, y de la forma cerrada"
  );
  assert.match(
    contrato,
    /relationshipDriverDetailValidator = v\.object\(\{\s*id: v\.string\(\),\s*text: v\.string\(\),\s*quality: relationshipDriverQualityValidator,\s*weight: v\.number\(\),\s*precision: precisionValidator,\s*\}\)/,
    "id, text, quality, weight y precision; la precisión es la del contrato, no una copia"
  );
  assert.match(
    contrato,
    /relationshipDriverQualityValidator = v\.union\(\s*v\.literal\("support"\),\s*v\.literal\("tension"\),\s*v\.literal\("neutral"\),\s*\)/,
    "la calidad es el vocabulario cerrado del motor"
  );
});

test("comparisonData publica drivers como antes y SIEMPRE deriva driverDetails", () => {
  const backend = sinComentarios(leer(BACKEND));
  const cuerpo = /function comparisonData\([\s\S]*?\n\}\n/.exec(backend)?.[0] ?? "";
  assert.ok(cuerpo, "no se encontró el ensamblador del sobre público");

  assert.match(
    cuerpo,
    /drivers: dimension\.drivers\.map\(\(driver\) => driver\.text\),/,
    "misma fuente, mismo orden, mismas oraciones"
  );
  // Una sola asignación, y sin condicional: un sobre nuevo nunca se publica sin
  // su evidencia. Se compara la lista COMPLETA de asignaciones en vez de negar
  // una forma, para que una bandera o un ternario no puedan colarse por al lado.
  assert.deepEqual(
    [...cuerpo.matchAll(/driverDetails:[^\n]*/g)].map((match) => match[0]),
    ["driverDetails: relationshipDriverDetails(dimension.drivers),"],
    "el detalle sale de la MISMA derivación determinística, siempre y sin condiciones"
  );
});

test("los ids productivos nombran qué toca a qué: ni el índice ni el texto entran", () => {
  const motor = sinComentarios(leer(MOTOR));

  assert.match(
    motor,
    /id: `aspect:a:\$\{args\.a\.key\}:b:\$\{args\.b\.key\}:\$\{args\.aspect\.type\}`/,
    "un aspecto se identifica por sus dos puntos y su tipo"
  );
  assert.match(
    motor,
    /id: `house:\$\{args\.sourcePerson\}:\$\{key\}:\$\{args\.targetPerson\}:\$\{house\}`/,
    "una superposición, por quién cae en la casa de quién"
  );

  // Ninguna plantilla de id puede llevar el texto ni una posición adentro: con el
  // texto, reescribir una oración cambiaría la identidad del contacto; con el
  // índice, reordenar el arreglo la cambiaría sola.
  const plantillas = [...motor.matchAll(/id: `([^`]*)`/g)].map((match) => match[1]!);
  assert.ok(plantillas.length >= 2, "el motor tiene que declarar sus dos familias de id");
  for (const plantilla of plantillas) {
    assert.match(plantilla, /^(?:aspect|house):/, plantilla);
    assert.doesNotMatch(plantilla, /text|index/i, plantilla);
  }
});

test("la dedupe del derivador compara SÓLO el id", () => {
  const motor = sinComentarios(leer(MOTOR));
  const cuerpo = /export function relationshipDriverDetails\([\s\S]*?\n\}\n/.exec(motor)?.[0] ?? "";
  assert.ok(cuerpo, "no se encontró el derivador");

  assert.match(cuerpo, /vistos\.has\(driver\.id\)/);
  assert.match(cuerpo, /vistos\.add\(driver\.id\)/);
  assert.doesNotMatch(
    cuerpo,
    /vistos\.(?:has|add)\((?!driver\.id\))/,
    "el conjunto de vistos no puede llenarse con nada que no sea el id"
  );
  assert.doesNotMatch(
    cuerpo,
    /driver\.text\s*(?:===|!==|\.localeCompare|\.trim)/,
    "el texto no se compara: dos oraciones iguales pueden ser dos contactos"
  );
});

// ---------------------------------------------------------------------------
// Pantalla: la fila no volvió a ser una barra, y el descargo del alta se ve
// ---------------------------------------------------------------------------

test("DimensionLeida dice el dato en texto: sin barra, sin porcentaje y sin depender del color", () => {
  const pantalla = sinComentarios(leer(RESULTADO));
  const fila = /function DimensionLeida\(\{[\s\S]*?\n\}\n/.exec(pantalla)?.[0] ?? "";
  assert.ok(fila, "no se encontró el cuerpo de DimensionLeida");

  assert.doesNotMatch(fila, /MeterBar/, "la barra de la comparación se fue (QA22-020)");
  assert.doesNotMatch(fila, /dimension\.value/, "el valor del contrato no se dibuja");
  assert.doesNotMatch(fila, /%/, "no hay porcentaje que mostrar");

  // La cantidad y el balance van ESCRITOS.
  assert.match(fila, /relationshipContactsCount\(dimension\.contacts\)/);
  assert.match(fila, /relationshipBalanceWord\(dimension\)/);

  // El color acompaña a la palabra, nunca la reemplaza: los dos estilos de
  // balance viven en el MISMO elemento que imprime la palabra.
  const balance = /styles\.filaBalance[\s\S]*?<\/Mono>/.exec(fila)?.[0] ?? "";
  assert.ok(balance, "no se encontró el elemento del balance");
  assert.match(balance, /styles\.balanceFluido/);
  assert.match(balance, /styles\.balanceExigente/);
  assert.match(balance, /relationshipBalanceWord\(dimension\)!\.toLocaleUpperCase\("es"\)/);

  // Y la fila se anuncia ENTERA, en una sola parada del lector de pantalla.
  assert.match(fila, /accessible\b/);
  assert.match(fila, /accessibilityLabel=\{relationshipDimensionRowVoice\(dimension\)\}/);

  // Las tres estructuras salen de la lectura, no del resumen por tono.
  assert.match(fila, /dimension\.facilitates/);
  assert.match(fila, /dimension\.strains/);
  assert.match(fila, /dimension\.invitation/);
  assert.doesNotMatch(fila, /dimension\.summary/);
});

test("el alta muestra QUÉ VAS A VER y deja los LÍMITES DE ESTA LECTURA a un toque", () => {
  // Los dos rótulos son copy exigido y viven en el dominio: si se escribieran
  // sueltos en la pantalla, cualquier pasada podría reescribirlos sin que nada
  // lo note.
  assert.equal(RELATIONSHIP_WHAT_YOU_SEE_LABEL, "QUÉ VAS A VER");
  assert.equal(RELATIONSHIP_READING_LIMITS_LABEL, "LÍMITES DE ESTA LECTURA");

  const conectar = sinComentarios(leer(CONECTAR));
  const bloque = /function QueVasAVer\(\{[\s\S]*?\n\}\n/.exec(conectar)?.[0] ?? "";
  assert.ok(bloque, "no se encontró el bloque del descargo del alta");

  assert.match(bloque, /<Label style=\{styles\.queVasAVerLabel\}>\{RELATIONSHIP_WHAT_YOU_SEE_LABEL\}<\/Label>/);
  assert.match(bloque, /<Label style=\{styles\.limitesTexto\}>\{RELATIONSHIP_READING_LIMITS_LABEL\}<\/Label>/);
  assert.doesNotMatch(conectar, /"QUÉ VAS A VER"|"LÍMITES DE ESTA LECTURA"/);

  // Jerarquía: primero qué información usa esta lectura, y detrás —a un toque—
  // qué no puede afirmar. Los DOS rótulos se ven siempre; lo que se pliega es el
  // TEXTO del límite, nunca su título, así que no es una letra chica.
  assert.ok(
    bloque.indexOf("RELATIONSHIP_WHAT_YOU_SEE_LABEL") <
      bloque.indexOf("RELATIONSHIP_READING_LIMITS_LABEL"),
    "qué vas a ver va primero"
  );
  assert.ok(
    bloque.indexOf("RELATIONSHIP_READING_LIMITS_LABEL") < bloque.indexOf("abierto ? <Note"),
    "el rótulo del límite se dibuja antes del bloque que se abre, no adentro"
  );
  assert.match(bloque, /abierto \? <Note[^>]*>\{form\.cannot\}/, "el texto del límite sí se abre");
});
