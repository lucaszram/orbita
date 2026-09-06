/**
 * QA23-004 · el tipo de vínculo, del lado del cliente.
 *
 * Es la contraparte de `test/tipoVinculoQA23.test.ts`, que corre el MOTOR real y
 * fija el contrato. Acá se fija lo que decide el front: el vocabulario exacto,
 * la lectura neutral, dónde se pregunta, qué viaja al guardar, qué pasa contra
 * un backend que todavía no conoce el campo, y que el tipo entre en la identidad
 * que el cliente usa para no quedarse mirando un estado viejo.
 *
 * Las pruebas de dominio son puras —sin React, sin Convex y sin reloj— y las
 * estructurales leen las pantallas como texto, que es la única forma de fijar
 * que una regla siga viviendo donde tiene que vivir.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  createRelationshipIdempotencyKey,
  emptyRelationshipDraft,
  relationshipDimensionLabel,
  relationshipDisclaimer,
  relationshipDraftBlock,
  relationshipDraftFromProfile,
  relationshipLevelFromDraft,
  relationshipSaveArgs,
  relationshipSaveArgsWithoutType,
  relationshipSaveSignature,
  RELATIONSHIP_DIMENSION_ORDER,
  RELATIONSHIP_NEUTRAL_COMPARISON_DISCLAIMER,
  type RelationshipDraft
} from "../src/domain/relationships";
import { relationshipCalcKey } from "../src/domain/relationshipCalc";
import {
  relationshipContactRole,
  relationshipContactsCollapseLabel,
  relationshipContactsToggleLabel,
  relationshipContactsToggleVoice,
  relationshipDynamicRole,
  relationshipReading,
  relationshipReadingKey
} from "../src/domain/relationshipReading";
import {
  readRelationshipType,
  relationshipTypeAllowsDesire,
  relationshipTypeChip,
  relationshipTypeDefineVoice,
  relationshipTypeIsDeclared,
  relationshipTypeLine,
  relationshipTypeNeedsDefinition,
  relationshipTypeRejectedByBackend,
  relationshipTypeSaveField,
  relationshipTypeValue,
  RELATIONSHIP_NEUTRAL_DESIRE_LABEL,
  RELATIONSHIP_TYPE_DEFINE_CTA,
  RELATIONSHIP_TYPE_FIELD_LABEL,
  RELATIONSHIP_TYPE_LABEL,
  RELATIONSHIP_TYPE_OPTIONS,
  RELATIONSHIP_TYPES,
  type RelationshipTypeKey
} from "../src/domain/relationshipType";
import type {
  RelationshipDimension,
  RelationshipProfile,
  RelationshipProfileId
} from "../src/services/relationshipsApi";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CONECTAR = "src/screens/v492/VinculosConnectScreen.tsx";
const HUB = "src/screens/v492/VinculosHubScreen.tsx";
const PERFIL = "src/screens/v492/VinculosProfileScreen.tsx";
const RESULTADO = "src/screens/v492/VinculosResultScreen.tsx";
const DOMINIO_TIPO = "src/domain/relationshipType.ts";
const DOMINIO = "src/domain/relationships.ts";
const LECTURA = "src/domain/relationshipReading.ts";

const PERFIL_ID = "rp_qa23" as RelationshipProfileId;

/**
 * Todo lo que NO puede aparecer en una lectura que no declaró un vínculo
 * romántico. Es la misma barra que se pone el motor en
 * `test/tipoVinculoQA23.test.ts`: si las dos mitades no usan la misma, una
 * pantalla podría escribir en una clave lo que el sobre escribió en la otra.
 */
const LENGUAJE_DE_DESEO = /deseo|sexual|erótic|atracción|intimidad|romántic/i;

/** Los ocho, más el legacy sin definir: el conjunto completo de estados. */
const TODOS: ReadonlyArray<RelationshipTypeKey | null> = [...RELATIONSHIP_TYPES, null];

/** Los que tienen que leer neutral: siete tipos declarados y el legacy. */
const NEUTRALES = TODOS.filter((tipo) => tipo !== "romantic");

const borrador = (over: Partial<RelationshipDraft> = {}): RelationshipDraft => ({
  ...emptyRelationshipDraft(),
  name: "Martina QA",
  zodiacSign: "taurus",
  ...over
});

/**
 * Un perfil guardado. El tipo se pasa como propiedad suelta a propósito: el
 * contrato lo publica como campo opcional, así que un perfil sin él —build
 * 22/23, o un backend sin desplegar— tiene que seguir siendo un perfil válido
 * para este cliente.
 */
const perfil = (over: Record<string, unknown> = {}): RelationshipProfile =>
  ({
    profileId: PERFIL_ID,
    name: "Martina QA",
    birthDate: "1994-05-04",
    birthTime: null,
    birthTimePrecision: "unknown",
    birthPlaceLabel: null,
    latitude: null,
    longitude: null,
    timezone: null,
    zodiacSign: "taurus",
    availableLevel: "date_to_date",
    createdAt: 1,
    updatedAt: 2,
    ...over
  }) as unknown as RelationshipProfile;

type Detalle = NonNullable<RelationshipDimension["driverDetails"]>[number];

const contacto = (
  id: string,
  text: string,
  over: Partial<Omit<Detalle, "id" | "text">> = {}
): Detalle => ({ id, text, quality: "support", weight: 1, precision: "exact", ...over });

/**
 * Un sobre en el PEOR caso posible para esta regla: la dimensión llega rotulada
 * `Deseo` y con una oración que habla de atracción, como la escribía el motor
 * antes de QA23. Si el cliente se limitara a repetir lo que el sobre trae, un
 * vínculo declarado `Amistad` leería eso mismo.
 */
const REUTILIZADO = "aspect:a:mars:b:mars:square";
const dimensiones = (): RelationshipDimension[] =>
  [
    {
      key: "desire",
      label: "Deseo",
      value: 0.5,
      summary: "Plantilla por tono.",
      drivers: [
        "Su Venus forma un trígono con tu Marte, un contacto de 120°; está a 0,0° de su máxima precisión. Se toma como una vía de atracción y ritmo compartido, no como una garantía.",
        "Su Marte forma una cuadratura con tu Marte, un contacto de 90°; está a 0,5° de su máxima precisión."
      ],
      driverDetails: [
        contacto(
          "aspect:a:mars:b:venus:trine",
          "Su Venus forma un trígono con tu Marte, un contacto de 120°; está a 0,0° de su máxima precisión. Se toma como una vía de atracción y ritmo compartido, no como una garantía.",
          { weight: 1.5 }
        ),
        contacto(
          REUTILIZADO,
          "Su Marte forma una cuadratura con tu Marte, un contacto de 90°; está a 0,5° de su máxima precisión.",
          { quality: "tension", weight: 1.2 }
        )
      ],
      precision: "exact"
    },
    {
      key: "friction",
      label: "Fricción",
      value: 0.4,
      summary: "Plantilla por tono.",
      drivers: [
        "Su Marte forma una cuadratura con tu Marte, un contacto de 90°; está a 0,5° de su máxima precisión."
      ],
      driverDetails: [
        contacto(
          REUTILIZADO,
          "Su Marte forma una cuadratura con tu Marte, un contacto de 90°; está a 0,5° de su máxima precisión.",
          { quality: "tension", weight: 0.9 }
        )
      ],
      precision: "exact"
    }
  ] as RelationshipDimension[];

const lecturaDe = (tipo: RelationshipTypeKey | null) => {
  const lectura = relationshipReading(
    { generalOnly: false, dimensions: dimensiones() },
    tipo
  );
  assert.ok(lectura, "el fixture tiene dimensiones");
  return lectura;
};

const porClave = (
  lectura: ReturnType<typeof lecturaDe>,
  key: RelationshipDimension["key"]
) => {
  const leida = lectura.dimensions.find((candidata) => candidata.key === key);
  assert.ok(leida, `falta la dimensión ${key}`);
  return leida;
};

// ---------------------------------------------------------------------------
// a) El vocabulario: ocho valores internos y ocho etiquetas, exactos
// ---------------------------------------------------------------------------

test("los ocho valores internos y sus etiquetas son los declarados, en su orden", () => {
  assert.deepEqual(
    [...RELATIONSHIP_TYPES],
    [
      "romantic",
      "parent_or_caregiver",
      "child",
      "sibling",
      "friendship",
      "work_or_project",
      "other",
      "prefer_not_to_say"
    ]
  );
  assert.deepEqual(RELATIONSHIP_TYPE_LABEL, {
    romantic: "Vínculo romántico",
    parent_or_caregiver: "Madre, padre o cuidador/a",
    child: "Hijo/a",
    sibling: "Hermano/a",
    friendship: "Amistad",
    work_or_project: "Trabajo o proyecto",
    other: "Otro vínculo",
    prefer_not_to_say: "Prefiero no decirlo"
  });
  // El selector se dibuja desde las dos tablas: no hay una lista paralela que se
  // pueda desincronizar del valor que se guarda.
  assert.deepEqual(
    RELATIONSHIP_TYPE_OPTIONS.map((opcion) => [opcion.key, opcion.label]),
    RELATIONSHIP_TYPES.map((key) => [key, RELATIONSHIP_TYPE_LABEL[key]])
  );
});

test("el vocabulario del cliente es el MISMO que el del contrato", () => {
  // Los valores no se copian a mano: si Codex agrega o renombra uno en el
  // validator, esto falla en vez de dejar una opción que el backend rechaza.
  const contrato = leer("convex/lib/layerContract.ts");
  const bloque = contrato.slice(
    contrato.indexOf("export const relationshipTypeValidator"),
    contrato.indexOf("export const relationshipComparisonDataValidator")
  );
  const literales = [...bloque.matchAll(/v\.literal\("([a-z_]+)"\)/g)].map((match) => match[1]);
  assert.deepEqual(literales, [...RELATIONSHIP_TYPES]);

  // Y el rótulo neutral de la quinta dimensión también: la escalera del nivel
  // 01 lo escribe sin sobre, así que si divergiera prometería una dimensión con
  // un nombre y después mostraría otro.
  const motor = leer("convex/lib/relationshipLayers.ts");
  const neutral = motor.match(/const NEUTRAL_DESIRE_LABEL = "([^"]+)"/);
  assert.ok(neutral, "el motor declara su rótulo neutral");
  assert.equal(neutral[1], RELATIONSHIP_NEUTRAL_DESIRE_LABEL);
});

// ---------------------------------------------------------------------------
// b) Lectura defensiva: builds 22/23 y backend sin desplegar
// ---------------------------------------------------------------------------

test("un perfil sin el campo se lee como sin definir, no como un error", () => {
  // El caso real de la degradación: el contrato es aditivo y opcional, así que
  // un perfil publicado por un backend sin desplegar no trae la propiedad.
  assert.equal(readRelationshipType(perfil()), null);
  assert.equal(readRelationshipType(perfil({ relationshipType: null })), null);
  assert.equal(readRelationshipType(perfil({ relationshipType: undefined })), null);
  assert.equal(readRelationshipType(perfil({ relationshipType: "friendship" })), "friendship");

  // Un valor que este cliente no conoce —un backend más nuevo— tampoco rompe:
  // cae en la lectura neutral, que es la degradación segura.
  assert.equal(readRelationshipType(perfil({ relationshipType: "colega_de_padel" })), null);
  assert.equal(readRelationshipType(perfil({ relationshipType: 7 })), null);
  assert.equal(readRelationshipType(null), null);
  assert.equal(readRelationshipType(undefined), null);
  assert.equal(readRelationshipType("romantic"), null, "un string suelto no es un perfil");

  for (const tipo of RELATIONSHIP_TYPES) assert.equal(relationshipTypeValue(tipo), tipo);
  assert.equal(relationshipTypeValue("ROMANTIC"), null, "la clave es exacta, no case-insensitive");
  assert.equal(relationshipTypeValue(""), null);
});

test("`null` es legacy sin definir y `prefer_not_to_say` es una elección explícita", () => {
  assert.equal(relationshipTypeNeedsDefinition(null), true);
  assert.equal(relationshipTypeIsDeclared(null), false);
  for (const tipo of RELATIONSHIP_TYPES) {
    assert.equal(relationshipTypeNeedsDefinition(tipo), false, tipo);
    assert.equal(relationshipTypeIsDeclared(tipo), true, tipo);
  }
  // Los dos leen neutral, y aun así no dicen lo mismo: uno pide algo y el otro
  // ya contestó.
  assert.notEqual(relationshipTypeLine(null), relationshipTypeLine("prefer_not_to_say"));
  assert.match(relationshipTypeLine(null), /Todavía no declaraste/);
  assert.match(relationshipTypeLine("prefer_not_to_say"), /Elegiste no declarar/);
  assert.equal(relationshipTypeChip(null), null, "sin definir no se inventa un chip");
  assert.equal(relationshipTypeChip("prefer_not_to_say"), "PREFIERO NO DECIRLO");
  assert.equal(relationshipTypeChip("parent_or_caregiver"), "MADRE, PADRE O CUIDADOR/A");
});

// ---------------------------------------------------------------------------
// c) Sólo `romantic` puede nombrar Deseo
// ---------------------------------------------------------------------------

test("`romantic` es la ÚNICA puerta del lenguaje de deseo", () => {
  assert.equal(relationshipTypeAllowsDesire("romantic"), true);
  for (const tipo of NEUTRALES) {
    assert.equal(relationshipTypeAllowsDesire(tipo), false, String(tipo));
  }

  assert.equal(relationshipDimensionLabel("desire", "romantic"), "Deseo");
  for (const tipo of NEUTRALES) {
    assert.equal(
      relationshipDimensionLabel("desire", tipo),
      RELATIONSHIP_NEUTRAL_DESIRE_LABEL,
      String(tipo)
    );
  }
  // Las otras cuatro no dependen del tipo: se llaman igual siempre.
  for (const clave of RELATIONSHIP_DIMENSION_ORDER.filter((key) => key !== "desire")) {
    for (const tipo of TODOS) {
      assert.equal(
        relationshipDimensionLabel(clave, tipo),
        relationshipDimensionLabel(clave, "romantic"),
        `${clave} · ${String(tipo)}`
      );
    }
  }
});

test("la lectura neutral no escribe deseo, ni aunque el sobre lo traiga escrito", () => {
  const romantica = porClave(lecturaDe("romantic"), "desire");
  assert.equal(romantica.label, "Deseo");
  assert.match(
    `${romantica.facilitates} ${romantica.strains}`,
    LENGUAJE_DE_DESEO,
    "declarado romántico, la dimensión sí se puede nombrar"
  );

  for (const tipo of NEUTRALES) {
    const leida = porClave(lecturaDe(tipo), "desire");
    // El rótulo se corrige hacia la versión neutral aunque el sobre diga otra
    // cosa: la corrección va en un solo sentido y es la segura.
    assert.equal(leida.label, RELATIONSHIP_NEUTRAL_DESIRE_LABEL, String(tipo));
    const escrito = [
      leida.label,
      leida.facilitates,
      leida.strains,
      leida.invitation,
      relationshipContactsToggleLabel(leida),
      relationshipContactsCollapseLabel(leida),
      relationshipContactsToggleVoice(leida)
    ].join(" ");
    assert.doesNotMatch(escrito, LENGUAJE_DE_DESEO, `el tipo ${String(tipo)} lee neutral`);
  }
});

test("sin tipo declarado la lectura es la neutral: el olvido falla cerrado", () => {
  // El parámetro tiene default `null` a propósito. Una llamada sin tipo no puede
  // terminar en lenguaje de deseo sobre un vínculo que nadie declaró.
  const porOmision = relationshipReading({ generalOnly: false, dimensions: dimensiones() });
  assert.ok(porOmision);
  assert.deepEqual(porOmision, lecturaDe(null));
  const deseo = porOmision.dimensions.find((dimension) => dimension.key === "desire");
  assert.equal(deseo?.label, RELATIONSHIP_NEUTRAL_DESIRE_LABEL);
});

test("cambia el vocabulario, no el cálculo: mismos contactos, mismos ids, mismos pesos", () => {
  const romantica = porClave(lecturaDe("romantic"), "desire");
  const neutral = porClave(lecturaDe("friendship"), "desire");
  assert.deepEqual(
    neutral.contactsList.map((contact) => [contact.id, contact.text, contact.weight]),
    romantica.contactsList.map((contact) => [contact.id, contact.text, contact.weight]),
    "la evidencia es la misma: lo que cambia es cómo se la nombra"
  );
  assert.equal(neutral.contacts, romantica.contacts);
  assert.equal(neutral.balance, romantica.balance);
  assert.equal(neutral.precision, romantica.precision);
});

test("la reutilización de un contacto tampoco filtra el rótulo romántico", () => {
  // El mismo contacto alimenta las dos dimensiones. Si `alsoIn` guardara el
  // rótulo del sobre, `Fricción` diría "también cuenta en Deseo" dentro de una
  // lectura que en ningún otro lado nombra esa dimensión.
  const neutral = lecturaDe("work_or_project");
  const enFriccion = porClave(neutral, "friction").contactsList.find(
    (contact) => contact.id === REUTILIZADO
  );
  assert.ok(enFriccion);
  assert.deepEqual(enFriccion.alsoIn, [RELATIONSHIP_NEUTRAL_DESIRE_LABEL]);
  assert.doesNotMatch(relationshipContactRole(enFriccion)!, LENGUAJE_DE_DESEO);

  const dinamica = neutral.dynamics.find((candidata) => candidata.id === REUTILIZADO);
  assert.ok(dinamica);
  assert.deepEqual(dinamica.dimensions, [RELATIONSHIP_NEUTRAL_DESIRE_LABEL, "Fricción"]);
  assert.doesNotMatch(relationshipDynamicRole(dinamica), LENGUAJE_DE_DESEO);

  // Declarado romántico, el mismo contacto sí nombra la dimensión.
  const romantica = lecturaDe("romantic");
  const mismaDinamica = romantica.dynamics.find((candidata) => candidata.id === REUTILIZADO);
  assert.deepEqual(mismaDinamica?.dimensions, ["Deseo", "Fricción"]);
});

test("el descargo de un caché viejo también deja de suponer un vínculo romántico", () => {
  // Los sobres anteriores a V4.9.2 no traen `disclaimer`, y el de reemplazo
  // decía "no mide amor": nombra un plano que quien guardó a su hermana no pidió.
  assert.match(relationshipDisclaimer(null, "romantic"), /No mide amor/);
  for (const tipo of NEUTRALES) {
    assert.equal(
      relationshipDisclaimer(undefined, tipo),
      RELATIONSHIP_NEUTRAL_COMPARISON_DISCLAIMER,
      String(tipo)
    );
    assert.doesNotMatch(relationshipDisclaimer(null, tipo), LENGUAJE_DE_DESEO);
  }
  // Y cuando el sobre trae el suyo, manda el sobre: lo escribió el motor con el
  // tipo real del cálculo.
  assert.equal(relationshipDisclaimer("El límite de este cálculo.", null), "El límite de este cálculo.");
});

// ---------------------------------------------------------------------------
// d) Declarado y separado: nunca se infiere
// ---------------------------------------------------------------------------

test("el tipo no participa del nivel ni bloquea el guardado", () => {
  const base = borrador();
  for (const tipo of TODOS) {
    const conTipo = { ...base, relationshipType: tipo };
    assert.equal(
      relationshipLevelFromDraft(conTipo),
      relationshipLevelFromDraft(base),
      `el tipo ${String(tipo)} no puede mover el nivel`
    );
    assert.equal(relationshipDraftBlock(conTipo), null, "es opcional: nunca bloquea");
    assert.equal(relationshipDraftBlock(conTipo, "sign_to_sign"), null);
  }
  // Y la derivación del nivel sigue mirando fecha, hora y ciudad, y nada más.
  assert.equal(relationshipLevelFromDraft(borrador({ relationshipType: "romantic" })), "sign_to_sign");
  assert.equal(
    relationshipLevelFromDraft(borrador({ relationshipType: null, birthDate: "1994-05-04" })),
    "date_to_date"
  );
});

test("la derivación del nivel no menciona el tipo, ni el módulo del tipo mira una carta", () => {
  // Estructural a propósito: "no inferirlo" es una propiedad del código, no de
  // un resultado. La derivación no puede ni siquiera leer el campo.
  const dominio = sinComentarios(leer(DOMINIO));
  const derivacion = dominio.slice(
    dominio.indexOf("export function relationshipLevelFromDraft"),
    dominio.indexOf("export function relationshipDataLevelLine")
  );
  assert.ok(derivacion.length > 0, "la derivación sigue existiendo");
  assert.doesNotMatch(derivacion, /relationshipType/);

  // Y el módulo del vocabulario no importa nada de nacimiento ni de cartas: no
  // tiene con qué inferir aunque quisiera.
  const tipoFuente = leer(DOMINIO_TIPO);
  assert.doesNotMatch(tipoFuente, /^import /m, "el vocabulario no depende de nada");
  assert.doesNotMatch(tipoFuente, /birthDate|zodiacSign|natal|chart/i);
});

test("el borrador de una persona guardada muestra lo declarado, y legacy es legacy", () => {
  assert.equal(emptyRelationshipDraft().relationshipType, null, "el alta no preselecciona nada");
  assert.equal(
    relationshipDraftFromProfile(perfil({ relationshipType: "sibling" })).relationshipType,
    "sibling"
  );
  // Un perfil sin el campo entra como sin definir: editar no lo inventa.
  assert.equal(relationshipDraftFromProfile(perfil()).relationshipType, null);
  assert.equal(
    relationshipDraftFromProfile(perfil({ relationshipType: "prefer_not_to_say" })).relationshipType,
    "prefer_not_to_say"
  );
  // El resto del borrador no se contamina: el tipo no toca los datos.
  const conTipo = relationshipDraftFromProfile(perfil({ relationshipType: "child" }));
  const sinTipo = relationshipDraftFromProfile(perfil());
  assert.deepEqual({ ...conTipo, relationshipType: null }, sinTipo);
});

// ---------------------------------------------------------------------------
// e) Qué viaja al guardar
// ---------------------------------------------------------------------------

test("el pedido lleva el tipo declarado, y OMITE el campo cuando no se definió", () => {
  const clave = "orbita-vinculo-test";
  const declarado = relationshipSaveArgs(
    borrador({ relationshipType: "friendship" }),
    null,
    null,
    clave
  );
  assert.ok(declarado);
  assert.equal(declarado.relationshipType, "friendship");

  const sinDefinir = relationshipSaveArgs(borrador(), null, null, clave);
  assert.ok(sinDefinir);
  // El validator del contrato acepta los ocho valores o la AUSENCIA del campo,
  // nunca `null`: mandarlo sería un error de validación, y omitirlo además
  // impide que un guardado sin contestar borre una elección anterior.
  assert.equal("relationshipType" in sinDefinir, false);
  assert.equal(
    JSON.stringify(sinDefinir).includes("relationshipType"),
    false,
    "nunca viaja `relationshipType: null`"
  );

  // El resto del pedido es idéntico: el tipo no cambia ni un dato de nacimiento.
  assert.deepEqual(relationshipSaveArgsWithoutType(declarado), sinDefinir);
  assert.equal(relationshipSaveArgsWithoutType(declarado).idempotencyKey, clave);
});

test("cambiar el tipo es otro pedido: estrena huella y estrena clave", () => {
  const amistad = relationshipSaveSignature(borrador({ relationshipType: "friendship" }), null, PERFIL_ID);
  const trabajo = relationshipSaveSignature(
    borrador({ relationshipType: "work_or_project" }),
    null,
    PERFIL_ID
  );
  const sinDefinir = relationshipSaveSignature(borrador(), null, PERFIL_ID);
  assert.ok(amistad && trabajo && sinDefinir);
  assert.notEqual(amistad, trabajo, "declarar otra cosa es otro pedido");
  assert.notEqual(amistad, sinDefinir);
  // Y el mismo pedido sigue dando la misma huella: corregir un espacio en el
  // nombre no estrena clave de idempotencia.
  assert.equal(
    amistad,
    relationshipSaveSignature(
      borrador({ relationshipType: "friendship", name: "  Martina QA  " }),
      null,
      PERFIL_ID
    )
  );
  // La clave del intento sigue siendo opaca: no lleva nada de la persona.
  const clave = createRelationshipIdempotencyKey(() => 0.5);
  assert.doesNotMatch(clave, /friendship|Martina/);
});

test("contra un backend que no conoce el campo, la persona se guarda igual", () => {
  // El mensaje real de Convex cuando la mutation recibe un argumento que su
  // validator no declara. Sin reconocerlo, un deployment viejo no guardaría NADA
  // —ni el nombre, ni la fecha— por un campo opcional.
  const rechazo = new Error(
    "ArgumentValidationError: Object contains extra field `relationshipType` that is not in the validator."
  );
  assert.equal(relationshipTypeRejectedByBackend(rechazo), true);
  assert.equal(relationshipTypeRejectedByBackend(String(rechazo)), true);
  assert.equal(relationshipTypeRejectedByBackend({ message: String(rechazo) }), true);

  // Y es deliberadamente estrecho: cualquier otro fallo sigue siendo un fallo.
  assert.equal(relationshipTypeRejectedByBackend(new Error("Network request failed")), false);
  assert.equal(
    relationshipTypeRejectedByBackend(
      new Error("ArgumentValidationError: Object is missing the required field `name`.")
    ),
    false,
    "otro campo no habilita el reintento sin tipo"
  );
  assert.equal(relationshipTypeRejectedByBackend(new Error("relationshipType")), false);
  assert.equal(relationshipTypeRejectedByBackend(null), false);
  assert.equal(relationshipTypeRejectedByBackend(undefined), false);

  // El campo se arma en un solo lugar y nunca produce `null`.
  assert.deepEqual(relationshipTypeSaveField(null), {});
  assert.deepEqual(relationshipTypeSaveField("child"), { relationshipType: "child" });
});

// ---------------------------------------------------------------------------
// f) El tipo entra en la identidad del lado cliente
// ---------------------------------------------------------------------------

test("el tipo forma parte de la identidad del estado y de la lectura", () => {
  const base = { profileId: "rp_1", level: "date_to_date", inputHash: "h1" };
  assert.notEqual(
    relationshipCalcKey({ ...base, relationshipType: "romantic" }),
    relationshipCalcKey({ ...base, relationshipType: "friendship" })
  );
  assert.notEqual(
    relationshipCalcKey({ ...base, relationshipType: null }),
    relationshipCalcKey({ ...base, relationshipType: "prefer_not_to_say" })
  );
  // Ausente y `null` son la misma cosa —sin definir—, igual que en el hash del
  // backend: si no, una fila legacy estrenaría estado en cada render.
  assert.equal(
    relationshipCalcKey(base),
    relationshipCalcKey({ ...base, relationshipType: null })
  );
  // Y lo que ya distinguía, sigue distinguiendo.
  assert.notEqual(relationshipCalcKey(base), relationshipCalcKey({ ...base, inputHash: "h2" }));
  assert.notEqual(relationshipCalcKey(base), relationshipCalcKey({ ...base, profileId: "rp_2" }));

  const lectura = {
    profileId: "rp_1",
    relationshipType: "friendship" as RelationshipTypeKey | null,
    inputHash: "h1",
    observedAt: 1_700_000_000_000
  };
  assert.equal(relationshipReadingKey(lectura), relationshipReadingKey({ ...lectura }));
  assert.notEqual(
    relationshipReadingKey(lectura),
    relationshipReadingKey({ ...lectura, relationshipType: "romantic" })
  );
  assert.notEqual(
    relationshipReadingKey(lectura),
    relationshipReadingKey({ ...lectura, relationshipType: null })
  );
  assert.notEqual(
    relationshipReadingKey(lectura),
    relationshipReadingKey({ ...lectura, observedAt: lectura.observedAt + 1 })
  );
  assert.notEqual(
    relationshipReadingKey(lectura),
    relationshipReadingKey({ ...lectura, inputHash: "h2" })
  );
});

// ---------------------------------------------------------------------------
// g) Dónde se pregunta, dónde se edita y dónde se ofrece definirlo
// ---------------------------------------------------------------------------

test("el alta lo pregunta JUNTO AL NOMBRE, y la edición lo muestra igual", () => {
  const conectar = sinComentarios(leer(CONECTAR));

  // El bloque del paso 1. El tipo vive adentro, con el nombre, y no en el paso
  // de los datos de nacimiento.
  const pasoNombre = conectar.slice(
    conectar.indexOf('{visible("nombre") ?'),
    conectar.indexOf('{visible("nivel") ?')
  );
  assert.ok(pasoNombre.length > 0, "el paso del nombre sigue existiendo");
  assert.match(pasoNombre, /<Label>NOMBRE<\/Label>/);
  assert.match(pasoNombre, /<TipoDeVinculo/);
  assert.match(pasoNombre, /onChange=\{\(relationshipType\) => patch\(\{ relationshipType \}\)\}/);

  // Y NO aparece en los bloques del signo, la fecha, la hora ni la ciudad: es un
  // dato declarado y está separado de todo lo que se calcula.
  const pasoDatos = conectar.slice(
    conectar.indexOf('{visible("datos") && pideFecha'),
    conectar.indexOf("function QueVasAVer")
  );
  assert.ok(pasoDatos.length > 0, "el paso de los datos sigue existiendo");
  assert.doesNotMatch(pasoDatos, /TipoDeVinculo/);
  assert.match(pasoDatos, /<BirthDateField/, "y sigue siendo el de los datos de nacimiento");

  // La edición entra directo a `datos`, pero el bloque del nombre se muestra
  // igual (`visible` sólo esconde el paso del nivel), así que el tipo se puede
  // cambiar sin borrar a la persona.
  assert.match(
    conectar,
    /const visible = \(bloque: "nombre" \| "nivel" \| "datos"\) =>\s*editando \? bloque !== "nivel" : paso === bloque;/
  );

  // El selector se dibuja desde la tabla del dominio y no preselecciona nada:
  // no elegir es no elegir.
  assert.match(conectar, /RELATIONSHIP_TYPE_OPTIONS\.map/);
  assert.doesNotMatch(conectar, /useState<RelationshipTypeKey>\(/);
  // Ni CONTINUAR ni GUARDAR dependen del tipo: es opcional de verdad.
  assert.match(conectar, /disabled=\{draft\.name\.trim\(\)\.length === 0\}/);
  assert.match(conectar, /disabled=\{saving \|\| \(!tipoSinGuardar && \(block !== null \|\| !escritura\.allowed\)\)\}/);
});

test("el selector del tipo es accesible como un grupo de radios de verdad", () => {
  const conectar = leer(CONECTAR);
  const selector = conectar.slice(
    conectar.indexOf("function TipoDeVinculo"),
    conectar.indexOf("function LevelOption")
  );
  assert.ok(selector.length > 0);
  assert.match(selector, /accessibilityRole="radiogroup"/);
  assert.match(selector, /accessibilityLabel="Tipo de vínculo con esta persona"/);
  assert.match(selector, /accessibilityRole="radio"/);
  assert.match(selector, /accessibilityState=\{\{ checked: selected \}\}/);
  assert.match(selector, /accessibilityLabel=\{opcion\.label\}/);
  // Cada opción es un objetivo táctil del alto mínimo del sistema.
  assert.match(conectar, /tipoOpcion: \{[^}]*minHeight: v492\.touch/s);
  // El rótulo del campo es el del dominio, no un literal suelto en la pantalla.
  assert.match(selector, /RELATIONSHIP_TYPE_FIELD_LABEL/);
  assert.equal(RELATIONSHIP_TYPE_FIELD_LABEL, "TIPO DE VÍNCULO");
});

test("el guardado degrada solo si el backend rechaza EL campo, y lo dice", () => {
  const conectar = sinComentarios(leer(CONECTAR));
  assert.match(conectar, /relationshipTypeRejectedByBackend\(error\)/);
  assert.match(conectar, /savePerson\(relationshipSaveArgsWithoutType\(args\)\)/);
  // Cualquier otro error se vuelve a lanzar: el catch de siempre lo trata como
  // lo que es.
  assert.match(conectar, /throw error;/);
  // Y la persona guardada sin su tipo lo anuncia, sin llamarlo error.
  assert.match(conectar, /RELATIONSHIP_TYPE_NOT_SAVED_NOTE/);
  assert.match(conectar, /tipoSinGuardar/);
});

test("legacy ofrece DEFINIR TIPO DE VÍNCULO y no bloquea nada", () => {
  assert.equal(RELATIONSHIP_TYPE_DEFINE_CTA, "DEFINIR TIPO DE VÍNCULO");
  assert.equal(relationshipTypeDefineVoice("Martina QA"), "Definir el tipo de vínculo con Martina QA");
  assert.equal(relationshipTypeDefineVoice("   "), "Definir el tipo de vínculo");

  // Las TRES superficies que muestran a una persona guardada: su fila en la raíz,
  // su perfil canónico (QA23-005) y su comparación.
  for (const pantalla of [HUB, PERFIL, RESULTADO]) {
    const source = sinComentarios(leer(pantalla));
    // El CTA sale de la constante —no es un literal reescribible— y aparece SÓLO
    // cuando el tipo está sin definir.
    assert.match(source, /RELATIONSHIP_TYPE_DEFINE_CTA/, pantalla);
    assert.match(source, /relationshipTypeNeedsDefinition\(/, pantalla);
    assert.match(source, /relationshipTypeDefineVoice\(/, pantalla);
    assert.match(source, /RELATIONSHIP_TYPE_DEFINE_HINT/, pantalla);
    assert.doesNotMatch(source, /"DEFINIR TIPO DE VÍNCULO"/, pantalla);
  }

  // Y no bloquea: la fila sigue abriendo el perfil, el perfil sigue ofreciendo
  // sus dos acciones y la comparación sigue mostrando su cuerpo sin
  // condicionarlo al tipo.
  const hub = sinComentarios(leer(HUB));
  assert.match(hub, /router\.push\(relationshipProfileHref\(persona\.profileId\) as never\)/);
  const perfil = sinComentarios(leer(PERFIL));
  assert.doesNotMatch(perfil, /relationshipTypeNeedsDefinition\([^)]*\)\s*\?\s*<(?:Empty|Guest|Loading)/);
  assert.match(perfil, /label="VER LA COMPARACIÓN"/);
  const resultado = sinComentarios(leer(RESULTADO));
  assert.doesNotMatch(resultado, /relationshipTypeNeedsDefinition\([^)]*\)\s*\?\s*<(?:Empty|Guest|Loading)/);
  assert.match(resultado, /<CuerpoComparacion data=\{data\} lectura=\{lectura\} \/>/);
});

test("las pantallas leen el tipo del PERFIL, y la lectura lo recibe", () => {
  const resultado = sinComentarios(leer(RESULTADO));
  // El tipo sale del PERFIL —lo declarado hoy— y no del sobre.
  assert.match(resultado, /const tipo = readRelationshipType\(persona\);/);
  assert.match(resultado, /relationshipReading\(datosComparacion, tipo\)/);
  // Y entra en las dos identidades del cliente.
  assert.match(resultado, /relationshipCalcKey\(\{[^}]*relationshipType: tipo/s);
  assert.match(resultado, /relationshipReadingKey\(\{[^}]*relationshipType: tipo/s);
  // Las listas que nombran dimensiones sin sobre —la escalera y las pendientes—
  // se escriben en la clave del vínculo.
  assert.match(resultado, /relationshipDimensionLabel\(clave, tipo\)/);
  assert.doesNotMatch(resultado, /RELATIONSHIP_DIMENSION_LABEL\[/);
  assert.match(resultado, /relationshipDisclaimer\(data\?\.disclaimer, tipo\)/);

  // La fila de la raíz y el perfil leen lo mismo, del mismo lado: el PERFIL. La
  // raíz ya no monta ninguna consulta de comparación (QA23-005), así que el tipo
  // le sirve para nombrar a la persona —su chip— y nada más.
  const hub = sinComentarios(leer(HUB));
  assert.match(hub, /const tipo = readRelationshipType\(persona\);/);
  assert.match(hub, /relationshipTypeChip\(tipo\)/);

  const perfil = sinComentarios(leer(PERFIL));
  assert.match(perfil, /const tipo = readRelationshipType\(persona\);/);
  assert.match(perfil, /relationshipTypeChip\(tipo\)/);
  assert.match(perfil, /relationshipTypeLine\(tipo\)/);
});

test("la lectura decide el vocabulario en UN solo lugar", () => {
  // Toda la regla cuelga de `relationshipTypeAllowsDesire`. Si alguna pasada
  // agregara una segunda condición —un `=== "romantic"` suelto—, habría dos
  // reglas para lo mismo y podrían divergir.
  const lectura = sinComentarios(leer(LECTURA));
  assert.doesNotMatch(lectura, /=== "romantic"/);
  assert.match(lectura, /function vocabulario\(/);
  assert.match(lectura, /function rotulo\(/);
  const dominio = sinComentarios(leer(DOMINIO));
  assert.doesNotMatch(dominio, /=== "romantic"/);
  assert.match(dominio, /relationshipTypeAllowsDesire\(/);
});
