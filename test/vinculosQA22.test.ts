/**
 * QA22 · bloque 4A — Vínculos: alta, edición y cálculo localizado.
 *
 * Cinco hallazgos del registro físico del build 22
 * (`native-v492/docs/QA-FISICA-BUILD22.md`), cada uno con su regresión:
 *
 * - **QA22-013** — al elegir una de las tres modalidades, `CONTINUAR` quedaba
 *   fuera de la zona visible y la elección parecía no habilitar nada.
 * - **QA22-015** — guardar una persona saltaba directo a su lectura y nunca
 *   constaba que hubiera quedado en la lista.
 * - **QA22-016** — guardar y calcular se veían como una sola espera, y la
 *   pantalla entera quedaba tomada por la generación de la comparación.
 * - **QA22-018** — "Completar sus datos" volvía a preguntar QUÉ COMPARAR, que es
 *   una consecuencia de los datos y no una preferencia.
 * - **QA22-023** — con los datos completos desaparecía toda forma de editarlos:
 *   desde adentro sólo se podía borrar a la persona.
 *
 * Lo que se prueba corriendo es la decisión pura —la derivación del nivel, qué
 * bloquea el guardado, a dónde vuelve y en qué fase está el cálculo—; lo
 * estructural sólo cubre el cableado que una prueba de dominio no puede ver.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

import { relationshipAvailableLevel } from "../convex/relationships";
import {
  relationshipCalcKey,
  relationshipCalcNote,
  relationshipCalcPhase,
  relationshipNeedsCalculation,
  relationshipRowCanRetry,
  RELATIONSHIP_ROW_RETRY_LIMIT
} from "../src/domain/relationshipCalc";
import {
  emptyRelationshipDraft,
  relationshipDataLevelLine,
  relationshipDraftBlock,
  relationshipDraftFromProfile,
  relationshipEditHref,
  relationshipLevelFromDraft,
  relationshipSaveArgs,
  relationshipSavedConfirmation,
  relationshipSavedHref,
  relationshipSavedMode,
  relationshipSaveSignature,
  type RelationshipDraft
} from "../src/domain/relationships";
import type {
  RelationshipProfile,
  RelationshipProfileId
} from "../src/services/relationshipsApi";
import { ROOT, reachableFrom, resolveEntryForPlatform } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const relativo = (absolute: string) => relative(ROOT, absolute);
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CONECTAR = "src/screens/v492/VinculosConnectScreen.tsx";
const HUB = "src/screens/v492/VinculosHubScreen.tsx";
const RESULTADO = "src/screens/v492/VinculosResultScreen.tsx";

const PERFIL_ID = "rp_qa22" as RelationshipProfileId;

/** La ciudad tal como la deja el buscador: etiqueta y coordenadas, nunca zona. */
const CIUDAD = { label: "Buenos Aires, Argentina", latitude: -34.6, longitude: -58.4 };
const ZONA = "America/Argentina/Buenos_Aires";

const borrador = (over: Partial<RelationshipDraft> = {}): RelationshipDraft => ({
  ...emptyRelationshipDraft(),
  name: "Martina QA",
  ...over
});

/** Perfil guardado mínimo, con los campos que la derivación mira. */
const perfil = (over: Partial<RelationshipProfile> = {}): RelationshipProfile =>
  ({
    profileId: PERFIL_ID,
    name: "Martina QA",
    birthDate: null,
    birthTime: null,
    birthTimePrecision: "unknown",
    birthPlaceLabel: null,
    latitude: null,
    longitude: null,
    timezone: null,
    zodiacSign: null,
    availableLevel: "sign_to_sign",
    createdAt: 0,
    updatedAt: 0,
    ...over
  }) satisfies RelationshipProfile;

// ---------------------------------------------------------------------------
// QA22-018 — el nivel se DERIVA de los datos, y hay una sola derivación
// ---------------------------------------------------------------------------

test("el nivel sale de los datos: signo, fecha o carta, y nada más", () => {
  // Nada cargado: el escalón más bajo, que es el que el backend también usa como
  // piso. No es "sin nivel": es lo que se puede leer con lo que hay.
  assert.equal(relationshipLevelFromDraft(borrador()), "sign_to_sign");
  assert.equal(relationshipLevelFromDraft(borrador({ zodiacSign: "taurus" })), "sign_to_sign");

  // Con la fecha entran las posiciones del día. La ciudad sola no sube el
  // escalón: lo que habilita casas y Ascendente es la HORA.
  assert.equal(relationshipLevelFromDraft(borrador({ birthDate: "1994-05-04" })), "date_to_date");
  assert.equal(
    relationshipLevelFromDraft(borrador({ birthDate: "1994-05-04", place: CIUDAD })),
    "date_to_date"
  );
  // Y la hora sin ciudad tampoco: sin coordenadas no hay zona, y sin zona esa
  // hora no es un instante.
  assert.equal(
    relationshipLevelFromDraft(borrador({ birthDate: "1994-05-04", birthTime: "09:12" })),
    "date_to_date"
  );

  assert.equal(
    relationshipLevelFromDraft(
      borrador({ birthDate: "1994-05-04", birthTime: "09:12", place: CIUDAD })
    ),
    "chart_to_chart"
  );
});

test("los bordes incompletos no suben de escalón: un dato inválido no es un dato", () => {
  // 31 de febrero: el control puede entregarlo, el calendario no lo tiene.
  assert.equal(relationshipLevelFromDraft(borrador({ birthDate: "2026-02-31" })), "sign_to_sign");
  assert.equal(relationshipLevelFromDraft(borrador({ birthDate: "no-es-fecha" })), "sign_to_sign");
  assert.equal(relationshipLevelFromDraft(borrador({ birthDate: "" })), "sign_to_sign");
  // Una hora imposible deja el escalón en fecha en vez de prometer una carta.
  assert.equal(
    relationshipLevelFromDraft(
      borrador({ birthDate: "1994-05-04", birthTime: "99:99", place: CIUDAD })
    ),
    "date_to_date"
  );
  assert.equal(
    relationshipLevelFromDraft(borrador({ birthDate: "1994-05-04", birthTime: "", place: CIUDAD })),
    "date_to_date"
  );
});

test("la derivación del front es la MISMA regla que aplica el backend", () => {
  // El defecto de fondo de QA22-018 es que hubiera dos nociones de nivel. Acá se
  // compara la del formulario contra `relationshipAvailableLevel`, que es la que
  // el backend corre sobre el perfil YA guardado: si divergieran, la pantalla
  // prometería un escalón que el perfil persistido no da.
  const casos: RelationshipDraft[] = [
    borrador({ zodiacSign: "taurus" }),
    borrador({ birthDate: "1994-05-04" }),
    borrador({ birthDate: "1994-05-04", place: CIUDAD }),
    borrador({ birthDate: "1994-05-04", birthTime: "09:12", place: CIUDAD })
  ];
  for (const draft of casos) {
    const args = relationshipSaveArgs(draft, ZONA, null, "orbita-vinculo-test");
    assert.ok(args, `el borrador tendría que poder guardarse: ${JSON.stringify(draft)}`);
    assert.equal(
      relationshipLevelFromDraft(draft),
      relationshipAvailableLevel({
        birthDate: args.birthDate ?? null,
        birthTime: args.birthTime ?? null,
        birthTimePrecision: args.birthTimePrecision,
        latitude: args.latitude ?? null,
        longitude: args.longitude ?? null,
        timezone: args.timezone ?? null
      }),
      JSON.stringify(draft)
    );
  }
});

test("el borrador de una persona guardada no copia su nivel: lo vuelve a derivar", () => {
  // Si copiara `availableLevel` habría dos estados que pueden contradecirse: el
  // que dice el perfil y el que dicen los campos que el formulario muestra.
  const guardada = perfil({
    birthDate: "1994-05-04",
    birthTime: "09:12",
    birthTimePrecision: "known",
    birthPlaceLabel: CIUDAD.label,
    latitude: CIUDAD.latitude,
    longitude: CIUDAD.longitude,
    timezone: ZONA,
    availableLevel: "chart_to_chart"
  });
  const draft = relationshipDraftFromProfile(guardada);
  assert.ok(!("level" in draft), "el borrador no guarda un nivel propio");
  assert.equal(relationshipLevelFromDraft(draft), "chart_to_chart");

  // Y bajar de nivel es posible: quitar la hora deja la comparación en fecha,
  // sin que haya que borrar a la persona y volver a crearla (QA22-023).
  assert.equal(relationshipLevelFromDraft({ ...draft, birthTime: null }), "date_to_date");
  assert.equal(
    relationshipLevelFromDraft({ ...draft, birthDate: null, birthTime: null, place: null }),
    "sign_to_sign"
  );

  // Una persona de nivel 01 abre con su signo y sin datos inventados.
  const soloSigno = relationshipDraftFromProfile(perfil({ zodiacSign: "taurus" }));
  assert.equal(soloSigno.zodiacSign, "taurus");
  assert.equal(soloSigno.birthDate, null);
  assert.equal(soloSigno.birthTime, null);
  assert.equal(soloSigno.place, null);
  assert.equal(relationshipLevelFromDraft(soloSigno), "sign_to_sign");
});

test("el nivel derivado se DICE, con lo que agregaría el dato siguiente", () => {
  const signo = relationshipDataLevelLine("sign_to_sign");
  assert.match(signo, /signo con signo/);
  assert.match(signo, /fecha/i, "dice qué haría falta para el escalón siguiente");

  const fecha = relationshipDataLevelLine("date_to_date");
  assert.match(fecha, /fecha con fecha/);
  assert.match(fecha, /hora exacta/i);

  const carta = relationshipDataLevelLine("chart_to_chart");
  assert.match(carta, /carta con carta/);
  // Nunca promete compatibilidad ni resultado: describe qué entra en el cálculo.
  for (const linea of [signo, fecha, carta]) {
    assert.doesNotMatch(linea, /compatibilidad|puntaje|%/i);
  }
});

// ---------------------------------------------------------------------------
// Qué bloquea el guardado: editar pide el mínimo; el alta, lo que prometió
// ---------------------------------------------------------------------------

test("al editar sólo se exige lo mínimo para que haya algo que comparar", () => {
  assert.match(relationshipDraftBlock(borrador({ name: "  " })) ?? "", /Escribí un nombre/);
  // Nombre sin ningún dato: no hay nada que comparar, y se dice con las dos
  // salidas posibles.
  const vacio = relationshipDraftBlock(borrador());
  assert.match(vacio ?? "", /fecha de nacimiento/i);
  assert.match(vacio ?? "", /signo/i);

  assert.equal(relationshipDraftBlock(borrador({ zodiacSign: "taurus" })), null);
  assert.equal(relationshipDraftBlock(borrador({ birthDate: "1994-05-04" })), null);
  assert.equal(
    relationshipDraftBlock(borrador({ birthDate: "1994-05-04", place: CIUDAD })),
    null,
    "la ciudad sola es opcional y no bloquea"
  );
  assert.equal(
    relationshipDraftBlock(
      borrador({ birthDate: "1994-05-04", birthTime: "09:12", place: CIUDAD })
    ),
    null
  );

  // Una hora escrita SIN ciudad no se descarta en silencio: se bloquea, porque
  // está a la vista y guardar sin ella se leería como que quedó guardada.
  assert.match(
    relationshipDraftBlock(borrador({ birthDate: "1994-05-04", birthTime: "09:12" })) ?? "",
    /ciudad/i
  );

  // Los datos escritos mal se dicen antes que cualquier otra cosa.
  assert.match(relationshipDraftBlock(borrador({ birthDate: "2026-02-31" })) ?? "", /fecha/i);
  assert.match(
    relationshipDraftBlock(borrador({ birthDate: "1994-05-04", birthTime: "99:99" })) ?? "",
    /hora/i
  );
});

test("en el alta se exige lo que la modalidad elegida prometió", () => {
  assert.match(
    relationshipDraftBlock(borrador(), "sign_to_sign") ?? "",
    /doce signos/,
    "signo con signo pide el signo, no la fecha"
  );
  assert.equal(relationshipDraftBlock(borrador({ zodiacSign: "taurus" }), "sign_to_sign"), null);

  assert.match(relationshipDraftBlock(borrador(), "date_to_date") ?? "", /fecha de nacimiento/i);
  assert.equal(relationshipDraftBlock(borrador({ birthDate: "1994-05-04" }), "date_to_date"), null);

  assert.match(relationshipDraftBlock(borrador(), "chart_to_chart") ?? "", /fecha de nacimiento/i);
  assert.match(
    relationshipDraftBlock(borrador({ birthDate: "1994-05-04" }), "chart_to_chart") ?? "",
    /hora exacta/i
  );
  assert.match(
    relationshipDraftBlock(borrador({ birthDate: "1994-05-04", birthTime: "09:12" }), "chart_to_chart") ??
      "",
    /ciudad/i
  );
  assert.equal(
    relationshipDraftBlock(
      borrador({ birthDate: "1994-05-04", birthTime: "09:12", place: CIUDAD }),
      "chart_to_chart"
    ),
    null
  );

  // La misma fecha sola, que en el alta de "carta con carta" bloquea, al editar
  // se guarda: ahí no hay promesa que romper, sólo un escalón más bajo.
  assert.equal(relationshipDraftBlock(borrador({ birthDate: "1994-05-04" })), null);
});

test("el pedido guarda exactamente los datos del nivel derivado, sin completar nada", () => {
  const clave = "orbita-vinculo-test";

  const signo = relationshipSaveArgs(borrador({ zodiacSign: "taurus" }), null, null, clave);
  assert.ok(signo);
  assert.equal(signo.zodiacSign, "taurus");
  assert.equal(signo.birthDate, null);
  assert.equal(signo.birthTime, null);
  assert.equal(signo.birthTimePrecision, "unknown");
  assert.equal(signo.timezone, null);

  // La fecha NO deriva el signo: un dato que nadie cargó no se guarda como si
  // lo hubieran cargado.
  const fecha = relationshipSaveArgs(borrador({ birthDate: "1994-05-04" }), null, null, clave);
  assert.ok(fecha);
  assert.equal(fecha.birthDate, "1994-05-04");
  assert.equal(fecha.zodiacSign, null);
  assert.equal(fecha.birthTimePrecision, "unknown");
  assert.equal(fecha.birthTime, null);

  // Con ciudad viaja su zona ya resuelta; sin zona no se guarda NADA.
  const conCiudad = relationshipSaveArgs(
    borrador({ birthDate: "1994-05-04", place: CIUDAD }),
    ZONA,
    null,
    clave
  );
  assert.ok(conCiudad);
  assert.equal(conCiudad.timezone, ZONA);
  assert.equal(conCiudad.birthTimePrecision, "unknown");
  assert.equal(
    relationshipSaveArgs(borrador({ birthDate: "1994-05-04", place: CIUDAD }), null, null, clave),
    null,
    "fallar cerrado: sin zona resuelta no se guarda la ciudad a medias"
  );

  const carta = relationshipSaveArgs(
    borrador({ birthDate: "1994-05-04", birthTime: "09:12", place: CIUDAD }),
    ZONA,
    PERFIL_ID,
    clave
  );
  assert.ok(carta);
  assert.equal(carta.birthTimePrecision, "known");
  assert.equal(carta.profileId, PERFIL_ID, "editar viaja con el id: es lo que evita el duplicado");
  assert.equal(
    relationshipSaveArgs(
      borrador({ birthDate: "1994-05-04", birthTime: "09:12", place: CIUDAD }),
      null,
      PERFIL_ID,
      clave
    ),
    null
  );
});

// ---------------------------------------------------------------------------
// QA22-015 — dónde termina un guardado, y dónde se editan los datos
// ---------------------------------------------------------------------------

test("los destinos de Vínculos se arman en el dominio y son unívocos", () => {
  assert.equal(relationshipEditHref("rp_1"), "/vinculos/conectar?profileId=rp_1");
  assert.equal(relationshipSavedHref("rp_1", "alta"), "/vinculos?guardada=rp_1&modo=alta");
  assert.equal(relationshipSavedHref("rp_1", "edicion"), "/vinculos?guardada=rp_1&modo=edicion");
  // El destino del guardado es la RAÍZ de la sección, no la lectura.
  assert.doesNotMatch(relationshipSavedHref("rp_1", "alta"), /^\/vinculos\/rp_1/);

  assert.equal(relationshipSavedMode("alta"), "alta");
  assert.equal(relationshipSavedMode("edicion"), "edicion");
  assert.equal(relationshipSavedMode("otra-cosa"), null);
  // Un parámetro repetido llega como arreglo: un modo ambiguo no es un modo.
  assert.equal(relationshipSavedMode(["alta", "edicion"]), null);
  assert.equal(relationshipSavedMode(undefined), null);
});

test("la confirmación nombra a la persona y dice dónde quedó", () => {
  const alta = relationshipSavedConfirmation("Martina QA", "alta");
  assert.match(alta, /Martina QA/);
  assert.match(alta, /list/i, "dice que quedó en la lista");
  assert.match(alta, /tocala|toc[aá]/i, "y que abrir la comparación es una acción tuya");

  const edicion = relationshipSavedConfirmation("Martina QA", "edicion");
  assert.match(edicion, /Martina QA/);
  assert.notEqual(edicion, alta, "actualizar no es lo mismo que dar de alta");

  // Sin nombre guardado no se imprime un hueco.
  assert.match(relationshipSavedConfirmation("   ", "alta"), /esta persona/);
});

test("guardar vuelve a la raíz y NO abre la lectura", () => {
  const conectar = sinComentarios(leer(CONECTAR));

  assert.match(
    conectar,
    /router\.dismissTo\(\s*relationshipSavedHref\(saved\.profileId, persona \? "edicion" : "alta"\)/,
    "se vuelve a la raíz con el id que devolvió el backend"
  );
  // El defecto exacto: `router.replace(`/vinculos/${saved.profileId}`)`.
  assert.doesNotMatch(
    conectar,
    /router\.(?:replace|push|navigate|dismissTo)\(\s*`\/vinculos\/\$\{/,
    "el alta no puede convertirse por sí sola en una lectura"
  );

  const hub = sinComentarios(leer(HUB));
  assert.match(hub, /relationshipSavedConfirmation\(/, "la raíz confirma el guardado");
  assert.match(hub, /RECIÉN GUARDADA/, "y la persona queda señalada en la lista");
  assert.match(
    hub,
    /findRelationshipProfile\(personas, guardada\)/,
    "el id de la URL vale lo que valga en TU lista"
  );
});

// ---------------------------------------------------------------------------
// QA22-013 — elegir una modalidad deja CONTINUAR a la vista y accionable
// ---------------------------------------------------------------------------

/** El bloque del paso 2, aislado: lo demás de la pantalla no cuenta acá. */
function bloqueNivel(): string {
  const conectar = leer(CONECTAR);
  const bloque = /\{visible\("nivel"\) \? \(\n([\s\S]*?)\n {8}\) : null\}/.exec(conectar)?.[1];
  assert.ok(bloque, "no se encontró el bloque del paso 2");
  return bloque;
}

test("elegir una modalidad no navega y no apaga el CTA", () => {
  const bloque = bloqueNivel();

  // Elegir sólo elige. Ni `setPaso` ni el router entran en el handler de la
  // opción: seleccionar no puede llevarte a la pantalla siguiente por su cuenta.
  assert.match(bloque, /onSelect=\{\(\) => setObjetivo\(level\)\}/);
  assert.doesNotMatch(bloque, /onSelect=\{[^}]*setPaso/);
  assert.doesNotMatch(bloque, /onSelect=\{[^}]*router\./);

  // Y el CTA del paso nunca se apaga: hay una modalidad elegida desde el primer
  // render, así que siempre hay algo que continuar.
  assert.doesNotMatch(bloque, /disabled=/, "el CTA del paso 2 no depende de la selección");
});

test("CONTINUAR queda pegado a las opciones y el límite no lo empuja fuera de la vista", () => {
  const bloque = bloqueNivel();

  const opciones = bloque.indexOf('accessibilityRole="radiogroup"');
  const cta = bloque.indexOf('label="CONTINUAR"');
  // El bloque del límite cambió de forma en 4B —pasó a ser `QUÉ VAS A VER` con
  // `LÍMITES DE ESTA LECTURA` a un toque (QA22-014)—, pero la garantía de
  // QA22-013 es la misma: va DEBAJO del CTA, no entre las opciones y el CTA.
  const limite = bloque.indexOf("<QueVasAVer");
  assert.ok(opciones >= 0 && cta >= 0 && limite >= 0, "los tres bloques existen");
  assert.ok(opciones < cta, "el CTA va después de las opciones");
  assert.ok(
    cta < limite,
    "el límite del nivel iba entre las opciones y el CTA, y era lo que lo empujaba fuera de la pantalla"
  );

  // La elección acusa recibo, y lo hace en una región que VoiceOver anuncia sin
  // que haya que ir a buscarla.
  assert.match(bloque, /accessibilityLiveRegion="polite"/);
  assert.match(bloque, /Elegiste \$\{objetivoLabel/);
  assert.match(bloque, /CONTINUAR, acá abajo/);
});

// ---------------------------------------------------------------------------
// QA22-018 / QA22-023 — completar y editar abren el formulario precompletado
// ---------------------------------------------------------------------------

test("editar entra directo a los datos y no repite el selector de modalidad", () => {
  const conectar = sinComentarios(leer(CONECTAR));

  assert.match(conectar, /persona \? "datos" : "nombre"/, "editar entra directo a los datos");
  assert.match(
    conectar,
    /editando \? bloque !== "nivel" : paso === bloque/,
    "al editar se ven todos los bloques MENOS el selector de modalidad"
  );
  // La intención de nivel existe SÓLO en el alta: al editar no hay nada que
  // elegir, y por eso no viaja al bloqueo del guardado.
  assert.match(conectar, /const intencion = editando \? null : objetivo/);
  assert.match(conectar, /relationshipDraftBlock\(draft, intencion\)/);
  // El formulario abre con lo guardado y anuncia el nivel derivado.
  assert.match(conectar, /relationshipDraftFromProfile\(persona\)/);
  assert.match(conectar, /relationshipLevelFromDraft\(draft\)/);
  assert.match(conectar, /NIVEL QUE PERMITEN ESTOS DATOS/);
  assert.match(conectar, /relationshipDataLevelLine\(nivelDerivado\)/);
});

test("editar los datos está SIEMPRE: en la lectura y en la fila de la lista", () => {
  const resultado = sinComentarios(leer(RESULTADO));
  const hub = sinComentarios(leer(HUB));

  // En la lectura, fuera de cualquier condición de nivel: con los datos
  // completos era justo cuando desaparecía la única entrada a editarlos.
  assert.match(resultado, /EDITAR DATOS DE \$\{\(persona\.name/);
  assert.match(resultado, /relationshipEditHref\(persona\.profileId\)/);
  const editar = resultado.indexOf("EDITAR DATOS DE ${(persona.name");
  const queFalta = resultado.indexOf('nivel !== "chart_to_chart" ? (');
  assert.ok(editar > 0 && queFalta > 0);
  const cierreQueFalta = resultado.indexOf(") : null}", queFalta);
  assert.ok(
    cierreQueFalta > 0 && cierreQueFalta < editar,
    "la edición vive fuera del bloque de lo que falta"
  );
  // Y es un bloque de la columna, no la rama de un condicional: la sangría del
  // JSX lo dice —ocho espacios es el nivel de `<Section>`—.
  assert.match(
    resultado,
    /\n {8}<View style=\{styles\.cta\}>\n {10}<PrimaryButton\n {12}label=\{`EDITAR DATOS DE /,
    "editar no puede depender de que falte un dato"
  );

  // Y en la fila de la lista, FUERA de la tarjeta: un botón adentro de otro
  // botón no se puede alcanzar con un lector de pantalla.
  assert.match(hub, /EDITAR DATOS DE \$\{persona\.name/);
  assert.match(hub, /relationshipEditHref\(persona\.profileId\)/);
  const cardButton = /<CardButton[\s\S]*?<\/CardButton>/.exec(hub)?.[0] ?? "";
  assert.ok(cardButton, "la tarjeta que abre la comparación existe");
  assert.doesNotMatch(cardButton, /EDITAR DATOS DE/, "la acción de editar va fuera de la tarjeta");
});

// ---------------------------------------------------------------------------
// QA22-016 — guardar y calcular son dos cosas, y el cálculo se dice en su fila
// ---------------------------------------------------------------------------

/** Un sobre con la forma mínima que las reglas del cálculo miran. */
type Sobre = Parameters<typeof relationshipNeedsCalculation>[0];
const sobre = (status: string, conDatos: boolean): Sobre =>
  ({
    status,
    data: conDatos ? { generalOnly: false, dimensions: [] } : null
  }) as unknown as Sobre;

test("la fase del cálculo es una función pura de sobre, corrida e intento", () => {
  const listo = sobre("ready", true);
  const sinDatos = sobre("ready", false);
  const parcial = sobre("partial", true);
  const quieto = { running: false, failed: false, attempted: false };

  // Mientras la consulta viaja no se sabe nada, y eso es lo que se dice.
  assert.equal(relationshipCalcPhase({ comparison: undefined, ...quieto }), "buscando");
  // Con cálculo usable no se anuncia nada: lo esperado no necesita etiqueta.
  assert.equal(relationshipCalcPhase({ comparison: listo, ...quieto }), "lista");
  assert.equal(relationshipCalcNote("lista"), null);

  // Sin cálculo y sin intento gastado, el automático está por salir.
  assert.equal(relationshipCalcPhase({ comparison: sinDatos, ...quieto }), "calculando");
  assert.equal(
    relationshipCalcPhase({ comparison: sinDatos, running: true, failed: false, attempted: false }),
    "calculando"
  );
  // Falló: se puede reintentar, y se dice que los datos siguen guardados.
  assert.equal(
    relationshipCalcPhase({ comparison: sinDatos, running: false, failed: true, attempted: true }),
    "error"
  );
  // Corrió y volvió corto —el proveedor caído— : no es un fallo de red y no se
  // reabre el ciclo automático, que era el riesgo de dejarlo girando.
  assert.equal(
    relationshipCalcPhase({ comparison: parcial, running: false, failed: false, attempted: true }),
    "pendiente"
  );
  // Una corrida en vuelo gana sobre el fallo anterior: lo que se ve es lo nuevo.
  assert.equal(
    relationshipCalcPhase({ comparison: sinDatos, running: true, failed: true, attempted: true }),
    "calculando"
  );

  for (const fase of ["buscando", "calculando", "error", "pendiente"] as const) {
    const nota = relationshipCalcNote(fase);
    assert.ok(nota && nota.length > 0, fase);
  }
  assert.match(relationshipCalcNote("error") ?? "", /guardados/, "guardar no es calcular");
  assert.match(relationshipCalcNote("pendiente") ?? "", /guardados/);
});

test("qué hace falta recalcular, y cuándo se gasta el intento automático", () => {
  assert.equal(relationshipNeedsCalculation(sobre("ready", false)), true);
  assert.equal(relationshipNeedsCalculation(sobre("ready", true)), false);
  for (const status of ["partial", "stale", "unavailable", "error"] as const) {
    assert.equal(relationshipNeedsCalculation(sobre(status, true)), true, status);
  }
  // `needs_birth_time` queda afuera a propósito: ahí no falta una corrida, falta
  // un dato, y reintentar devolvería exactamente lo mismo.
  assert.equal(relationshipNeedsCalculation(sobre("needs_birth_time", true)), false);

  // La huella del intento cambia cuando cambia la persona, su nivel o las
  // entradas del cálculo — y sólo entonces.
  const base = { profileId: "rp_1", level: "date_to_date", inputHash: "h1" };
  assert.equal(relationshipCalcKey(base), relationshipCalcKey({ ...base }));
  assert.notEqual(relationshipCalcKey(base), relationshipCalcKey({ ...base, inputHash: "h2" }));
  assert.notEqual(
    relationshipCalcKey(base),
    relationshipCalcKey({ ...base, level: "chart_to_chart" })
  );
  assert.notEqual(relationshipCalcKey(base), relationshipCalcKey({ ...base, profileId: "rp_2" }));

  // El reintento de la fila está acotado: agotado, la salida es su lectura.
  assert.equal(relationshipRowCanRetry(0), true);
  assert.equal(relationshipRowCanRetry(RELATIONSHIP_ROW_RETRY_LIMIT - 1), true);
  assert.equal(relationshipRowCanRetry(RELATIONSHIP_ROW_RETRY_LIMIT), false);
});

test("la raíz muestra a la persona antes del cálculo: el sobre se pide en su fila", () => {
  const hub = leer(HUB);

  // La lista se dibuja siempre; la comparación se consulta DENTRO de la fila de
  // la persona recién guardada. Si la consulta viviera en el cuerpo de la raíz,
  // su estado tomaría la pantalla entera — que es el defecto de QA22-016.
  const live = /function VinculosHubLive\(\{[\s\S]*?\n\}\n/.exec(hub)?.[0] ?? "";
  assert.ok(live, "no se encontró el cuerpo de la raíz");
  assert.doesNotMatch(live, /getComparison/, "la raíz no espera ninguna comparación para dibujarse");
  assert.doesNotMatch(live, /refreshComparison/);
  assert.match(live, /<PersonasBlock/, "la lista se dibuja igual");

  const fila = /function EstadoLectura\(\{[\s\S]*?\n\}\n/.exec(hub)?.[0] ?? "";
  assert.ok(fila, "no se encontró el bloque de estado de la fila");
  assert.match(fila, /useQuery\(relationshipsApi\.getComparison/);
  assert.match(fila, /useAction\(relationshipsApi\.refreshComparison\)/);
  assert.match(fila, /accessibilityLiveRegion="polite"/, "el estado se anuncia donde ocurre");
  assert.match(fila, /REINTENTAR SU LECTURA/);
  assert.match(fila, /relationshipRowCanRetry\(reintentos\)/, "el reintento manual está acotado");
  assert.match(
    fila,
    /if \(automatico\.current === clave\) return;/,
    "el automático es UNO por estado del sobre"
  );
  // Y sólo se monta para la persona que se acaba de guardar: la raíz no abre una
  // consulta por cada fila de la lista.
  assert.match(hub, /\{reciente \? <EstadoLectura persona=\{persona\} \/> : null\}/);
});

test("la lectura y la fila comparten la misma regla de recálculo", () => {
  const resultado = sinComentarios(leer(RESULTADO));
  assert.match(resultado, /relationshipNeedsCalculation\(comparison\)/);
  assert.match(resultado, /relationshipCalcKey\(\{/);
  // La condición vive en el dominio, no duplicada en la pantalla.
  assert.doesNotMatch(resultado, /ESTADOS_A_RECALCULAR/);
  assert.doesNotMatch(resultado, /function necesitaRecalculo/);
});

// ---------------------------------------------------------------------------
// Doble toque, y las superficies que no tenían que moverse
// ---------------------------------------------------------------------------

test("dos toques en Guardar no guardan dos veces", () => {
  const conectar = sinComentarios(leer(CONECTAR));

  // El candado real es un ref: `saving` recién existe en el render siguiente, y
  // dos toques del mismo tick entrarían los dos al handler.
  assert.match(conectar, /const enVuelo = useRef\(false\)/);
  assert.match(conectar, /const guardado = useRef\(false\)/);
  // Dos guards consecutivos y en ese orden: primero lo ya guardado, después lo
  // que está en vuelo o bloqueado. Es la forma canónica que fija la regresión de
  // `nativeDefectsV492` para el segundo guard, y acá se exige además el primero.
  assert.match(
    conectar,
    /if \(guardado\.current\) return;\s*if \(enVuelo\.current \|\| block !== null\) return;/,
    "la puerta se cierra en el mismo tick, y queda cerrada una vez confirmado"
  );
  assert.ok(
    conectar.indexOf("guardado.current = true;") < conectar.indexOf("router.dismissTo("),
    "la puerta se cierra ANTES de navegar: entre la respuesta y el desmonte hay frames"
  );

  // Y el mismo pedido reintentado viaja con la MISMA clave, así que el backend
  // devuelve la persona que ya creó en vez de crear una segunda.
  const draft = borrador({ birthDate: "1994-05-04", place: CIUDAD });
  assert.equal(
    relationshipSaveSignature(draft, ZONA, null),
    relationshipSaveSignature({ ...draft, name: "  Martina QA  " }, ZONA, null),
    "corregir un espacio no cambia el pedido"
  );
  assert.notEqual(
    relationshipSaveSignature(draft, ZONA, null),
    relationshipSaveSignature({ ...draft, birthDate: "1994-05-05" }, ZONA, null),
    "cambiar un dato es otra intención y estrena clave"
  );
  assert.notEqual(
    relationshipSaveSignature(draft, ZONA, null),
    relationshipSaveSignature(draft, ZONA, PERFIL_ID),
    "editar no es lo mismo que dar de alta"
  );
  assert.equal(relationshipSaveSignature(borrador(), ZONA, null), null, "sin pedido no hay huella");
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
    // Nada de esta pasada puede arrastrar la experiencia nativa al paquete web.
    assert.ok(
      ![...reachableFrom([entry], "web")].some((rel) => rel.startsWith("src/screens/v492/")),
      `${entry} arrastra la experiencia nativa al paquete web`
    );
  }

  // El stack conserva su ancla: entrar por deep link a un detalle deja la raíz
  // debajo, y es lo que hace que volver de un guardado sea un `pop` y no un
  // segundo `index` apilado.
  const layout = sinComentarios(leer("app/(tabs)/vinculos/_layout.tsx"));
  assert.match(layout, /unstable_settings = \{ anchor: "index" \}/);
  assert.match(layout, /<Redirect href="\/vinculo" \/>/, "web sigue en su ruta histórica");
});
