/**
 * QA22 · bloque 4B — Vínculos: contrato aditivo y lectura explicativa.
 *
 * Cinco hallazgos del registro físico del build 22
 * (`native-v492/docs/QA-FISICA-BUILD22.md`):
 *
 * - **QA22-014** — el descargo del alta no explicaba su función: no se entendía
 *   si decía qué compara la lectura, una limitación o una advertencia legal.
 * - **QA22-017** — la lectura priorizaba método y limitaciones sobre una
 *   interpretación útil; el resumen enumeraba contactos y cada dimensión repetía
 *   la misma fórmula.
 * - **QA22-019** — `+ 1 CONTACTO MÁS` no decía a qué dimensión pertenecía lo
 *   plegado, cuántos había ni con qué criterio se ordenaban.
 * - **QA22-020** — el largo y el color de las barras no tenían una semántica
 *   reconstruible, y se leían como un porcentaje de compatibilidad.
 * - **QA22-021** — un mismo contacto podía alimentar dos dimensiones sin que la
 *   interfaz explicara la reutilización, así que parecía un duplicado.
 *
 * Se prueba el CONTRATO corriendo el motor real —los ids, la forma cerrada de
 * `driverDetails` y la compatibilidad de `drivers`—, la LECTURA como función
 * pura sobre sobres nuevos y viejos, y sólo estructuralmente el cableado que una
 * prueba de dominio no puede ver.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

import { buildRelationshipComparisonResult } from "../convex/relationships";
import type { Infer } from "convex/values";
import { relationshipDimensionValidator } from "../convex/lib/layerContract";
import {
  RELATIONSHIP_READING_LIMITS_LABEL,
  RELATIONSHIP_WHAT_YOU_SEE_LABEL
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
  relationshipDimensionBalance,
  relationshipDimensionRow,
  relationshipDimensionRowVoice,
  relationshipDynamicRole,
  relationshipDynamicsLead,
  relationshipReading,
  type RelationshipReadingContact
} from "../src/domain/relationshipReading";
import type {
  RelationshipComparisonData,
  RelationshipDimension
} from "../src/services/relationshipsApi";
import { ROOT, reachableFrom, resolveEntryForPlatform } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const relativo = (absolute: string) => relative(ROOT, absolute);
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const RESULTADO = "src/screens/v492/VinculosResultScreen.tsx";
const CONECTAR = "src/screens/v492/VinculosConnectScreen.tsx";
const LECTURA = "src/domain/relationshipReading.ts";

// ---------------------------------------------------------------------------
// El motor real, con dos cartas cuyos contactos son verificables a mano
// ---------------------------------------------------------------------------

type Punto = {
  key: string;
  label: string;
  sign: string | null;
  longitude: number | null;
  longitudeSamples: number[];
  timeStable: boolean;
  house: number | null;
};

const punto = (key: string, label: string, longitude: number): Punto => ({
  key,
  label,
  sign: null,
  longitude,
  longitudeSamples: [],
  timeStable: true,
  house: null
});

/**
 * Grados elegidos para que cada contacto caiga EXACTO en su ángulo. Así el orbe
 * es 0, la fuerza es 1 y el peso publicado es exactamente el multiplicador del
 * par: se puede verificar a mano contra `PAIR_WEIGHTS`.
 */
const PUNTOS_A: Punto[] = [
  punto("sun", "Sol", 0),
  punto("moon", "Luna", 10),
  punto("mercury", "Mercurio", 20),
  punto("venus", "Venus", 30),
  punto("mars", "Marte", 40),
  punto("jupiter", "Júpiter", 50),
  punto("saturn", "Saturno", 60)
];

const PUNTOS_B: Punto[] = [
  punto("sun", "Sol", 120),
  punto("moon", "Luna", 190),
  punto("mercury", "Mercurio", 140),
  punto("venus", "Venus", 30),
  punto("mars", "Marte", 40),
  punto("jupiter", "Júpiter", 170),
  punto("saturn", "Saturno", 300)
];

function carta(name: string, placements: Punto[]) {
  return {
    name,
    zodiacSign: null,
    birthTimePrecision: "known" as const,
    placements,
    houses: []
  };
}

function comparar(options?: { placementsA?: Punto[]; placementsB?: Punto[]; name?: string }) {
  return buildRelationshipComparisonResult({
    inputHash: "hash-qa22-4b",
    requestedLevel: "date_to_date",
    personA: carta("Vos", options?.placementsA ?? PUNTOS_A),
    personB: carta(options?.name ?? "Martina QA", options?.placementsB ?? PUNTOS_B),
    observedAt: 1_700_000_000_000
  });
}

function datos(): RelationshipComparisonData {
  const resultado = comparar();
  assert.ok(resultado.data, "el motor tiene que producir una comparación");
  return resultado.data as RelationshipComparisonData;
}

// ---------------------------------------------------------------------------
// QA22 · contrato — `driverDetails` es aditivo, cerrado y determinístico
// ---------------------------------------------------------------------------

test("el contrato agrega driverDetails sin tocar drivers ni volverse obligatorio", () => {
  // COMPATIBILIDAD DE TIPO: un sobre del build 22 —sin `driverDetails`— sigue
  // siendo una dimensión válida. Si el campo fuera obligatorio, esto no
  // compilaría, y ése es exactamente el gate que queremos.
  const legacy: Infer<typeof relationshipDimensionValidator> = {
    key: "desire",
    label: "Deseo",
    value: 0.5,
    summary: "En deseo conviven recursos y diferencias.",
    drivers: ["Su Marte forma una conjunción con tu Marte, un contacto de 0°."],
    precision: "exact"
  };
  assert.equal(legacy.driverDetails, undefined);

  // Y el validador lo declara opcional, con los dos vocabularios canónicos.
  const contrato = leer("convex/lib/layerContract.ts");
  assert.match(contrato, /driverDetails: v\.optional\(v\.array\(relationshipDriverDetailValidator\)\)/);
  assert.match(
    contrato,
    /relationshipDriverQualityValidator = v\.union\(\s*v\.literal\("support"\),\s*v\.literal\("tension"\),\s*v\.literal\("neutral"\),\s*\)/,
    "la calidad es el vocabulario cerrado del motor"
  );
  assert.match(
    contrato,
    /relationshipDriverDetailValidator = v\.object\(\{\s*id: v\.string\(\),\s*text: v\.string\(\),\s*quality: relationshipDriverQualityValidator,\s*weight: v\.number\(\),\s*precision: precisionValidator,\s*\}\)/,
    "la forma es cerrada y la precisión es la del contrato, no una copia"
  );

  const data = datos();
  assert.equal(data.dimensions.length, 5);
  for (const dimension of data.dimensions) {
    assert.ok(Array.isArray(dimension.driverDetails), `${dimension.key} tiene que traer el detalle`);
    // `drivers` conserva EXACTAMENTE su semántica: mismas oraciones, mismo orden.
    assert.deepEqual(
      dimension.drivers,
      dimension.driverDetails!.map((detalle) => detalle.text),
      `${dimension.key}: drivers y driverDetails no pueden divergir`
    );
  }
});

test("los ids salen de la identidad del contacto, no del índice ni del copy", () => {
  const data = datos();

  for (const dimension of data.dimensions) {
    const ids = dimension.driverDetails!.map((detalle) => detalle.id);
    assert.equal(new Set(ids).size, ids.length, `${dimension.key}: un id repetido sería contar dos veces`);
    for (const detalle of dimension.driverDetails!) {
      assert.match(
        detalle.id,
        /^(?:aspect:[ab]:[a-z]+:[ab]:[a-z]+:[a-z]+|house:[ab]:[a-z]+:[ab]:\d+)$/,
        "el id nombra qué toca a qué"
      );
      // El id no puede llevar el texto adentro: si lo llevara, reescribir una
      // oración cambiaría la identidad del contacto.
      assert.ok(!detalle.id.includes(detalle.text.slice(0, 12)), "el id no puede derivar del copy");
      assert.ok(detalle.id.length < 60, "el id es una identidad, no una frase");
    }
  }

  // Reordenar la ENTRADA no mueve ningún id ni ningún orden: la identidad no
  // depende de la posición en el arreglo que llegó del proveedor.
  const alReves = comparar({
    placementsA: [...PUNTOS_A].reverse(),
    placementsB: [...PUNTOS_B].reverse()
  });
  assert.deepEqual(alReves.data, data, "la derivación es independiente del orden de entrada");

  // Y dos corridas del mismo sobre dan exactamente lo mismo.
  assert.deepEqual(datos(), data, "la derivación es determinística");
});

test("el peso expresa evidencia real y no se presenta como porcentaje", () => {
  const data = datos();
  const porClave = new Map(data.dimensions.map((dimension) => [dimension.key, dimension]));

  const deseo = porClave.get("desire")!;
  const friccion = porClave.get("friction")!;
  const marteEnDeseo = deseo.driverDetails!.find((detalle) => detalle.id.includes(":mars:b:mars:"));
  const marteEnFriccion = friccion.driverDetails!.find((detalle) =>
    detalle.id.includes(":mars:b:mars:")
  );
  assert.ok(marteEnDeseo && marteEnFriccion, "Marte con Marte alimenta Deseo y Fricción");
  assert.equal(marteEnDeseo.id, marteEnFriccion.id, "es el MISMO contacto, con el mismo id");
  assert.notEqual(
    marteEnDeseo.weight,
    marteEnFriccion.weight,
    "el mismo contacto pesa distinto en cada dimensión: eso no es un porcentaje"
  );

  const pesos = data.dimensions.flatMap((dimension) =>
    dimension.driverDetails!.map((detalle) => detalle.weight)
  );
  assert.ok(pesos.every((peso) => peso > 0), "un contacto que no pesa no es evidencia");
  assert.ok(pesos.some((peso) => peso > 1), "los pesos no están acotados a 0–1: no son una fracción");
  const proyecto = porClave.get("shared_project")!;
  const suma = proyecto.driverDetails!.reduce((total, detalle) => total + detalle.weight, 0);
  assert.notEqual(suma, 1, "los pesos de una dimensión no suman 1: se suman, no se reparten");

  // Los dos vocabularios son cerrados y salen del motor.
  for (const detalle of data.dimensions.flatMap((dimension) => dimension.driverDetails!)) {
    assert.ok(["support", "tension", "neutral"].includes(detalle.quality), detalle.id);
    assert.ok(["exact", "estimated", "range", "not_applicable"].includes(detalle.precision), detalle.id);
  }
});

test("un mismo contacto en dos dimensiones se conserva en las dos", () => {
  const data = datos();
  const dondeAparece = new Map<string, string[]>();
  for (const dimension of data.dimensions) {
    for (const detalle of dimension.driverDetails!) {
      dondeAparece.set(detalle.id, [...(dondeAparece.get(detalle.id) ?? []), dimension.label]);
    }
  }
  const compartidos = [...dondeAparece.entries()].filter(([, donde]) => donde.length > 1);
  assert.ok(
    compartidos.length >= 2,
    "el fixture tiene que ejercitar la reutilización real que registró QA22-021"
  );
  // Y nada se borró por parecerse: la evidencia distinta sobrevive aunque su
  // redacción sea casi igual.
  const textos = data.dimensions.flatMap((dimension) =>
    dimension.driverDetails!.map((detalle) => detalle.text)
  );
  assert.ok(textos.length > new Set(dondeAparece.keys()).size, "hay filas repetidas por reutilización");
});

// ---------------------------------------------------------------------------
// QA22-017 — la síntesis abre con dinámicas reales, elegidas sin azar
// ---------------------------------------------------------------------------

test("la síntesis abre con dos o tres dinámicas reales y un orden estable", () => {
  const lectura = relationshipReading(datos());
  assert.ok(lectura);

  assert.ok(lectura.dynamics.length >= 2, "el registro pide dos o tres, no una");
  assert.ok(lectura.dynamics.length <= RELATIONSHIP_MAX_DYNAMICS);
  assert.equal(RELATIONSHIP_MAX_DYNAMICS, 3);

  // El orden es por fuerza y, a igual fuerza, por calidad y precisión. Nunca por
  // azar ni por el índice del arreglo.
  const pesos = lectura.dynamics.map((dinamica) => dinamica.weight ?? -1);
  assert.deepEqual(pesos, [...pesos].sort((a, b) => b - a), "las dinámicas van de mayor a menor peso");
  assert.deepEqual(
    lectura.dynamics.map((dinamica) => dinamica.id),
    relationshipReading(datos())!.dynamics.map((dinamica) => dinamica.id),
    "dos corridas eligen las mismas dinámicas"
  );

  // Cada dinámica ES un contacto del cálculo, con su oración intacta.
  const textos = datos().dimensions.flatMap((dimension) => dimension.drivers);
  for (const dinamica of lectura.dynamics) {
    assert.ok(textos.includes(dinamica.text), "una dinámica no se escribe: se elige");
    assert.ok(dinamica.dimensions.length >= 1);
  }

  const lead = relationshipDynamicsLead(lectura);
  assert.ok(lead);
  assert.match(lead, /dinámicas/i);
  assert.doesNotMatch(lead, /puntaje|compatibilidad|%/i, "no hay score global");

  // El cierre cuenta contactos DISTINTOS, no filas: sumando filas, el contacto
  // reutilizado se contaba dos veces (QA22-021).
  const filas = datos().dimensions.reduce((total, dimension) => total + dimension.drivers.length, 0);
  assert.ok(lectura.uniqueContacts < filas, "el fixture reutiliza contactos");
  const cierre = relationshipContactsLine(lectura);
  assert.match(cierre, new RegExp(`${lectura.uniqueContacts} contactos reales`));
  assert.match(cierre, /más de una dimensión/);
  assert.doesNotMatch(cierre, /puntaje|compatibilidad|%/i);
});

test("una dinámica reutilizada dice que es una sola, no dos", () => {
  const lectura = relationshipReading(datos())!;
  const reutilizada = lectura.dynamics.find((dinamica) => dinamica.dimensions.length > 1);
  assert.ok(reutilizada, "el fixture tiene que traer una dinámica compartida");
  const papel = relationshipDynamicRole(reutilizada);
  assert.match(papel, /El mismo contacto cuenta en/);
  for (const label of reutilizada.dimensions) assert.ok(papel.includes(label), label);

  const propia = lectura.dynamics.find((dinamica) => dinamica.dimensions.length === 1)!;
  assert.match(relationshipDynamicRole(propia), /^Pesa en /);
});

// ---------------------------------------------------------------------------
// QA22-017 — cada dimensión explica qué facilita, qué tensa y qué hacer
// ---------------------------------------------------------------------------

test("cada dimensión declara las tres estructuras y se apoya en su evidencia", () => {
  const lectura = relationshipReading(datos())!;
  assert.equal(lectura.dimensions.length, 5);

  const vistos = new Set<string>();
  for (const dimension of lectura.dimensions) {
    assert.ok(dimension.facilitates.length > 0, `${dimension.key}: falta qué se facilita`);
    assert.ok(dimension.strains.length > 0, `${dimension.key}: falta qué puede tensarse`);
    assert.ok(dimension.invitation.length > 0, `${dimension.key}: falta la acción o la pregunta`);
    // La invitación es una acción o una pregunta, y no se repite entre
    // dimensiones: la repetición fue el defecto registrado.
    assert.ok(!vistos.has(dimension.invitation), `${dimension.key}: la invitación se repite`);
    vistos.add(dimension.invitation);
    assert.ok(
      dimension.invitation.includes("?") || /^[A-ZÁÉÍÓÚÑ]/.test(dimension.invitation),
      "una pregunta o una acción concreta"
    );
  }

  // `Cómo se hablan` sólo reunió un contacto de apoyo: lo que facilita se dice
  // NOMBRÁNDOLO, y lo que puede tensarse se dice que no aparece.
  const comunicacion = lectura.dimensions.find((dimension) => dimension.key === "communication")!;
  assert.equal(comunicacion.contacts, 1);
  assert.match(comunicacion.facilitates, /^Se facilita /);
  assert.match(comunicacion.facilitates, /su Mercurio con tu Mercurio/);
  assert.match(comunicacion.strains, /No aparece un contacto que tense/);

  // `Cómo se cuidan` es al revés: la oposición Luna–Luna tensa y no hay apoyo.
  const cuidado = lectura.dimensions.find((dimension) => dimension.key === "care")!;
  assert.match(cuidado.strains, /^Puede tensarse /);
  assert.match(cuidado.strains, /su Luna con tu Luna/);
  assert.match(cuidado.facilitates, /Ningún contacto/);

  // Y la acción sólo aparece donde hay recursos que usar; si no, es una pregunta.
  const fluida = lectura.dimensions.find((dimension) => dimension.balance === "mas_fluido")!;
  const exigente = lectura.dimensions.find((dimension) => dimension.balance === "mas_exigente")!;
  assert.doesNotMatch(fluida.invitation, /\?/, "con recursos hay algo concreto que hacer");
  assert.match(exigente.invitation, /\?/, "sin recursos, lo honesto es preguntar");
});

// ---------------------------------------------------------------------------
// QA22-020 — cantidad y balance en texto, sin barra y sin color solo
// ---------------------------------------------------------------------------

test("el balance usa el vocabulario canónico y reproduce la regla del backend", () => {
  const contacto = (
    quality: RelationshipReadingContact["quality"],
    weight: number,
    id: string
  ): RelationshipReadingContact => ({
    id,
    text: `contacto ${id}`,
    name: null,
    quality,
    weight,
    precision: "exact",
    order: 0,
    alsoIn: []
  });

  // Misma regla que `dimensionSummary` en el motor: el margen es 1,25.
  assert.equal(
    relationshipDimensionBalance({
      detailed: true,
      contacts: [contacto("support", 2, "a"), contacto("tension", 1, "b")]
    }),
    "mas_fluido"
  );
  assert.equal(
    relationshipDimensionBalance({
      detailed: true,
      contacts: [contacto("tension", 2, "a"), contacto("support", 1, "b")]
    }),
    "mas_exigente"
  );
  assert.equal(
    relationshipDimensionBalance({
      detailed: true,
      contacts: [contacto("support", 1, "a"), contacto("tension", 1, "b")]
    }),
    "mixto",
    "dentro del margen no se inclina para ningún lado"
  );
  assert.equal(
    relationshipDimensionBalance({ detailed: true, contacts: [contacto("neutral", 1, "a")] }),
    "sutil"
  );
  assert.equal(relationshipDimensionBalance({ detailed: true, contacts: [] }), "sin_material");
  // Sin detalle NO se inventa un balance: se dice que no se puede decir.
  assert.equal(
    relationshipDimensionBalance({ detailed: false, contacts: [contacto(null, 0, "a")] }),
    "sin_detalle"
  );

  // Las cinco etiquetas existen y son distintas entre sí.
  const etiquetas = Object.values(RELATIONSHIP_BALANCE_LABEL);
  assert.equal(new Set(etiquetas).size, etiquetas.length);
  assert.equal(RELATIONSHIP_BALANCE_LABEL.mas_fluido, "más fluido");
  assert.equal(RELATIONSHIP_BALANCE_LABEL.mixto, "mixto");
  assert.equal(RELATIONSHIP_BALANCE_LABEL.mas_exigente, "más exigente");
});

test("la fila dice cantidad y balance en palabras, y el lector escucha lo mismo", () => {
  const lectura = relationshipReading(datos())!;
  const comunicacion = lectura.dimensions.find((dimension) => dimension.key === "communication")!;
  const proyecto = lectura.dimensions.find((dimension) => dimension.key === "shared_project")!;

  assert.equal(relationshipContactsCount(0), "sin contactos principales");
  assert.equal(relationshipContactsCount(1), "1 contacto");
  assert.equal(relationshipContactsCount(5), "5 contactos");

  assert.equal(relationshipDimensionRow(comunicacion), "1 contacto · más fluido");
  assert.equal(relationshipDimensionRow(proyecto), `${proyecto.contacts} contactos · más fluido`);
  // Sin contactos, el balance no se repite: la cuenta ya lo dijo.
  const vacia = { ...comunicacion, contacts: 0, balance: "sin_material" as const };
  assert.equal(relationshipBalanceWord(vacia), null);
  assert.equal(relationshipDimensionRow(vacia), "sin contactos principales");

  // La etiqueta accesible dice la MISMA información, nunca menos.
  const voz = relationshipDimensionRowVoice(comunicacion);
  assert.match(voz, /Cómo se hablan/);
  assert.match(voz, /1 contacto/);
  assert.match(voz, /más fluido/);
  assert.match(
    relationshipDimensionRowVoice({ ...comunicacion, balance: "sin_detalle" }),
    /sin el detalle de cada contacto/
  );
});

test("la lectura no dibuja barras ni convierte el color en el dato", () => {
  const pantalla = sinComentarios(leer(RESULTADO));

  const cuerpo = /function CuerpoComparacion\(\{[\s\S]*?\n\}\n/.exec(pantalla)?.[0] ?? "";
  const fila = /function DimensionLeida\(\{[\s\S]*?\n\}\n/.exec(pantalla)?.[0] ?? "";
  assert.ok(cuerpo && fila, "no se encontraron el cuerpo y la fila de dimensión");
  for (const [nombre, bloque] of [
    ["CuerpoComparacion", cuerpo],
    ["DimensionLeida", fila]
  ] as const) {
    assert.doesNotMatch(bloque, /<MeterBar/, `${nombre} no puede volver a dibujar una barra`);
    assert.doesNotMatch(bloque, /proporcion=/, `${nombre} no calcula proporciones`);
  }
  // `NIVEL DE DATOS` conserva su riel: es la posición en una escalera de tres y
  // dice "N de 3" en voz. No es lo que registró QA22-020, que son las barras de
  // la comparación.
  assert.match(pantalla, /relationshipLevelShare\(nivel\)/);

  // El color acompaña SÓLO a la palabra del balance, y la palabra está escrita.
  assert.match(fila, /relationshipContactsCount\(dimension\.contacts\)/);
  assert.match(fila, /relationshipBalanceWord\(dimension\)/);
  assert.match(fila, /styles\.balanceFluido/);
  assert.match(fila, /styles\.balanceExigente/);
  assert.match(fila, /accessibilityLabel=\{relationshipDimensionRowVoice\(dimension\)\}/);

  // Y las advertencias de precisión se dicen una vez, no una por dimensión.
  assert.match(pantalla, /function NotaDePrecision/);
  assert.doesNotMatch(fila, /precision === "range"/, "la advertencia ya no vive en cada fila");
});

// ---------------------------------------------------------------------------
// QA22-019 / QA22-021 — la divulgación se nombra y la reutilización se explica
// ---------------------------------------------------------------------------

test("el control de contactos usa el copy exigido, con el N único y la dimensión real", () => {
  const lectura = relationshipReading(datos())!;
  const deseo = lectura.dimensions.find((dimension) => dimension.key === "desire")!;
  const comunicacion = lectura.dimensions.find((dimension) => dimension.key === "communication")!;

  assert.equal(
    relationshipContactsToggleLabel(deseo),
    `VER LOS ${deseo.contacts} CONTACTOS QUE FORMAN DESEO`
  );
  assert.equal(
    relationshipContactsToggleLabel(comunicacion),
    "VER LOS 1 CONTACTOS QUE FORMAN CÓMO SE HABLAN",
    "el copy exigido se respeta literal, aun en singular"
  );
  // La concordancia se resuelve donde se puede resolver sin traicionar el copy:
  // en la etiqueta que se escucha.
  assert.equal(
    relationshipContactsToggleVoice(comunicacion),
    "Ver el contacto que forma Cómo se hablan"
  );
  assert.equal(
    relationshipContactsToggleVoice(deseo),
    `Ver los ${deseo.contacts} contactos que forman Deseo`
  );
  assert.match(relationshipContactsCollapseLabel(deseo), /^OCULTAR LOS CONTACTOS QUE FORMAN DESEO$/);

  // El N es de contactos ÚNICOS por id, no de filas.
  assert.equal(deseo.contacts, new Set(deseo.contactsList.map((c) => c.id)).size);

  // Y al abrir, los contactos van ordenados por cuánto pesan.
  const pesos = deseo.contactsList.map((contacto) => contacto.weight ?? -1);
  assert.deepEqual(pesos, [...pesos].sort((a, b) => b - a));
});

test("un contacto que alimenta dos dimensiones se explica con su mismo id", () => {
  const lectura = relationshipReading(datos())!;
  const conReuso = lectura.dimensions
    .flatMap((dimension) => dimension.contactsList.map((contacto) => ({ dimension, contacto })))
    .filter(({ contacto }) => contacto.alsoIn.length > 0);
  assert.ok(conReuso.length >= 2, "el fixture reutiliza al menos un contacto");

  for (const { dimension, contacto } of conReuso) {
    assert.ok(!contacto.alsoIn.includes(dimension.label), "no se nombra a sí misma");
    const papel = relationshipContactRole(contacto)!;
    assert.match(papel, /Es el MISMO contacto que también cuenta en/);
    for (const label of contacto.alsoIn) assert.ok(papel.includes(label), label);
  }

  // La identidad es el ID, no el texto. Cada id compartido aparece en dos o más
  // dimensiones, UNA sola vez en cada una —se deduplica por id DENTRO de la
  // dimensión— y cada aparición nombra exactamente a las otras: ni se duplica
  // como si fueran dos contactos distintos, ni se borra de una de las dos.
  const compartidos = [...new Set(conReuso.map(({ contacto }) => contacto.id))];
  for (const id of compartidos) {
    const apariciones = lectura.dimensions
      .map((dimension) => ({
        dimension,
        filas: dimension.contactsList.filter((contacto) => contacto.id === id)
      }))
      .filter(({ filas }) => filas.length > 0);
    assert.ok(apariciones.length >= 2, `${id} tiene que contar en dos dimensiones`);
    for (const { dimension, filas } of apariciones) {
      assert.equal(filas.length, 1, `${id} se lista una sola vez en ${dimension.label}`);
      assert.deepEqual(
        [...filas[0]!.alsoIn].sort(),
        apariciones
          .map(({ dimension: otra }) => otra.label)
          .filter((label) => label !== dimension.label)
          .sort(),
        `${id}: cada aparición nombra a las otras dimensiones donde cuenta`
      );
    }
  }

  // Y el TEXTO puede cambiar entre dimensiones sin que eso lo vuelva otro
  // contacto: el id es semántico —el mismo aspecto entre los mismos puntos— pero
  // el cierre lo escribe `DRIVER_ENDINGS[dimension]`, que explica el papel que
  // ese contacto juega ACÁ. Por eso la deduplicación es por id dentro de cada
  // dimensión y NUNCA global por texto.
  const primero = conReuso[0]!.contacto;
  const gemelos = lectura.dimensions.flatMap((dimension) =>
    dimension.contactsList.filter((contacto) => contacto.id === primero.id)
  );
  assert.ok(gemelos.length >= 2);
  const hecho = (contacto: RelationshipReadingContact) => contacto.text.split(". ")[0]!;
  assert.equal(
    new Set(gemelos.map(hecho)).size,
    1,
    "el hecho astronómico no cambia: es el mismo contacto leído desde dos lados"
  );
  assert.equal(
    new Set(gemelos.map((contacto) => contacto.name)).size,
    1,
    "el nombre corto sale de la identidad del contacto, no de su cierre"
  );
  if (gemelos.every((contacto) => contacto.id.startsWith("aspect:"))) {
    assert.equal(
      new Set(gemelos.map((contacto) => contacto.text)).size,
      gemelos.length,
      "cada dimensión contextualiza el cierre: los textos difieren y eso es el diseño"
    );
  }

  // Y el contador de compartidos es el de contactos, no el de filas.
  assert.equal(
    lectura.sharedContacts,
    new Set(conReuso.map(({ contacto }) => contacto.id)).size
  );
});

test("dentro de una dimensión se deduplica por id y NUNCA por texto", () => {
  const detalle = (id: string, text: string) =>
    ({ id, text, quality: "support", weight: 1, precision: "exact" }) as const;
  const dimension = {
    key: "care",
    label: "Cómo se cuidan",
    value: 0.6,
    summary: "…",
    drivers: ["Su Ascendente forma una cuadratura con tu Luna, un contacto de 90°."],
    driverDetails: [
      detalle("aspect:a:moon:b:ascendant:square", "Su Ascendente □ tu Luna."),
      // Texto CASI idéntico pero otro contacto: sobrevive entero. Es el caso que
      // el registro pidió no borrar (QA22-021).
      detalle("aspect:a:moon:b:descendant:square", "Su Ascendente □ tu Luna."),
      // El mismo id dos veces sí es contarlo dos veces: se descarta.
      detalle("aspect:a:moon:b:ascendant:square", "Su Ascendente □ tu Luna.")
    ],
    precision: "exact"
  } as unknown as RelationshipDimension;

  const lectura = relationshipReading({ generalOnly: false, dimensions: [dimension] })!;
  const cuidado = lectura.dimensions[0]!;
  assert.equal(cuidado.contacts, 2, "dos evidencias distintas con el mismo texto son dos");
  assert.deepEqual(
    cuidado.contactsList.map((contacto) => contacto.id),
    ["aspect:a:moon:b:ascendant:square", "aspect:a:moon:b:descendant:square"]
  );
});

// ---------------------------------------------------------------------------
// QA22 · sobres del build 22 — se degrada sin inventar nada
// ---------------------------------------------------------------------------

test("un sobre sin driverDetails sigue siendo usable y no fabrica evidencia", () => {
  const data = datos();
  const legacy = {
    generalOnly: false,
    dimensions: data.dimensions.map((dimension) => {
      const { driverDetails: _detalle, ...resto } = dimension;
      return resto as RelationshipDimension;
    })
  };

  const lectura = relationshipReading(legacy)!;
  assert.equal(lectura.detailed, false);
  for (const dimension of lectura.dimensions) {
    assert.equal(dimension.detailed, false);
    if (dimension.contacts > 0) {
      assert.equal(dimension.balance, "sin_detalle", "no se inventa un balance");
      assert.match(dimension.facilitates, /sin el detalle de cada contacto/);
      assert.match(dimension.strains, /tampoco podemos señalar/);
    }
    // La invitación NO depende de la calidad de los contactos, así que sigue en
    // pie: es lo que mantiene la pantalla usable.
    assert.ok(dimension.invitation.length > 0);
    for (const contacto of dimension.contactsList) {
      assert.equal(contacto.quality, null, "sin evidencia no se inventa una calidad");
      assert.equal(contacto.weight, null);
      assert.equal(contacto.precision, null);
      // Un sobre viejo no puede afirmar que un contacto se reutiliza: sus ids
      // son sintéticos y no son la identidad que el backend certifica.
      assert.deepEqual(contacto.alsoIn, []);
    }
  }
  // Y los contactos siguen ahí, con el orden que el sobre ya traía.
  assert.deepEqual(
    lectura.dimensions.map((dimension) => dimension.contactsList.map((c) => c.text)),
    data.dimensions.map((dimension) => [...dimension.drivers])
  );

  // La lectura de un signo solo no finge contactos personalizados.
  assert.equal(relationshipReading({ generalOnly: true, dimensions: [] }), null);
  assert.equal(relationshipReading({ generalOnly: false, dimensions: [] }), null);
});

// ---------------------------------------------------------------------------
// QA22-014 — el descargo del alta explica su función
// ---------------------------------------------------------------------------

test("el alta abre con QUÉ VAS A VER y esconde los LÍMITES DE ESTA LECTURA a un toque", () => {
  assert.equal(RELATIONSHIP_WHAT_YOU_SEE_LABEL, "QUÉ VAS A VER");
  assert.equal(RELATIONSHIP_READING_LIMITS_LABEL, "LÍMITES DE ESTA LECTURA");

  const conectar = sinComentarios(leer(CONECTAR));
  const bloque = /function QueVasAVer\(\{[\s\S]*?\n\}\n/.exec(conectar)?.[0] ?? "";
  assert.ok(bloque, "no se encontró el bloque del descargo del alta");

  // Los dos rótulos salen del dominio: son copy literal y no pueden reescribirse
  // sin que nada lo note.
  assert.match(bloque, /RELATIONSHIP_WHAT_YOU_SEE_LABEL/);
  assert.match(bloque, /RELATIONSHIP_READING_LIMITS_LABEL/);
  assert.doesNotMatch(conectar, /"QUÉ VAS A VER"/, "el copy no se escribe suelto en la pantalla");
  assert.doesNotMatch(conectar, /"LÍMITES DE ESTA LECTURA"/);

  // Jerarquía: primero qué información usa, después —plegado— qué no puede
  // afirmar. El rótulo del límite se ve siempre; su texto es lo que se abre.
  assert.ok(
    bloque.indexOf("RELATIONSHIP_WHAT_YOU_SEE_LABEL") <
      bloque.indexOf("RELATIONSHIP_READING_LIMITS_LABEL"),
    "qué vas a ver va primero"
  );
  assert.match(bloque, /form\.adds/, "qué información usa esta lectura");
  assert.match(bloque, /abierto \? <Note[^>]*>\{form\.cannot\}/, "el límite se abre a pedido");
  assert.match(bloque, /accessibilityState=\{\{ expanded: abierto \}\}/);
  assert.match(bloque, /accessibilityRole="button"/);
  // Y el descargo genérico del build 22 ya no está.
  assert.doesNotMatch(conectar, /LimitationList/);
});

// ---------------------------------------------------------------------------
// Lo que no tenía que moverse
// ---------------------------------------------------------------------------

test("la lectura es pura: sin React, sin Convex y sin reloj propio", () => {
  const lectura = leer(LECTURA);
  assert.doesNotMatch(lectura, /from "react"/);
  assert.doesNotMatch(lectura, /from "convex/);
  assert.doesNotMatch(lectura, /Date\.now\(\)|new Date\(/);
  assert.doesNotMatch(lectura, /Math\.random/);
});

test("las tres rutas de Vínculos y la superficie web quedan como estaban", () => {
  const rutas = [
    "app/(tabs)/vinculos/index.tsx",
    "app/(tabs)/vinculos/conectar.tsx",
    "app/(tabs)/vinculos/[profileId].tsx"
  ] as const;

  for (const entry of rutas) {
    const wrapper = sinComentarios(leer(entry));
    assert.match(wrapper, /export \{ default \} from "@\/routes\/v492\/vinculos[^"]*"/, entry);
    const nativeImpl = relativo(resolveEntryForPlatform(entry, "native"));
    const webImpl = relativo(resolveEntryForPlatform(entry, "web"));
    assert.match(nativeImpl, /^src\/routes\/v492\/vinculos[^/]*\.tsx$/, entry);
    assert.match(webImpl, /^src\/routes\/v492\/vinculos[^/]*\.web\.tsx$/, entry);
    assert.match(
      sinComentarios(leer(webImpl)),
      /<Redirect\s+href="\/vinculo"\s*\/>/,
      `${entry} debe preservar la superficie web histórica`
    );
    assert.ok(
      ![...reachableFrom([entry], "web")].some((rel) => rel.startsWith("src/screens/v492/")),
      `${entry} arrastra la experiencia nativa al paquete web`
    );
  }
});
