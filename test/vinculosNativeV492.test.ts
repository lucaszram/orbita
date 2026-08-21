/**
 * Vínculos V4.9.2: rutas por plataforma, datos reales y presentación honesta.
 *
 * Estas pruebas son deliberadamente estructurales. Siguen el grafo que Metro
 * empaqueta para comprobar que iOS llega a la experiencia nueva mientras web
 * conserva `/vinculo`, y que ninguna de las tres pantallas puede completar un
 * perfil o una comparación con datos de maqueta.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

import {
  RELATIONSHIP_DATE_UNLOCKS,
  RELATIONSHIP_DIMENSION_ORDER,
  RELATIONSHIP_LOCKED_DIMENSIONS,
  RELATIONSHIP_READABLE_COUNT,
  RELATIONSHIP_TIME_UNLOCK_DIMENSIONS,
  relationshipDriverShortName,
  relationshipGaps,
  relationshipGapsBlameOther,
  relationshipGapsBlameOwn,
  relationshipHeadline,
  relationshipLockedDimensionsNote,
  relationshipModeHasCalculation,
  relationshipModeIsGeneral,
  relationshipResultMode
} from "../src/domain/relationships";
import type { RelationshipProfile } from "../src/services/relationshipsApi";
import {
  ROOT,
  pathTo,
  reachableFrom,
  resolveEntryForPlatform
} from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const relativo = (absolute: string) => relative(ROOT, absolute);
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const VINCULOS_ROUTES = [
  "app/(tabs)/vinculos/index.tsx",
  "app/(tabs)/vinculos/conectar.tsx",
  "app/(tabs)/vinculos/[profileId].tsx"
] as const;

/**
 * La pantalla del resultado. Se declara acá arriba porque desde 4B la miran dos
 * grupos de pruebas: las del grafo —qué llega al bundle nativo— y las
 * estructurales de los dos frames canónicos, más abajo.
 */
const RESULTADO = "src/screens/v492/VinculosResultScreen.tsx";

function fuenteNativa(entry: (typeof VINCULOS_ROUTES)[number]) {
  return [...reachableFrom([entry], "native")]
    .filter((rel) => /\.(?:ts|tsx|js|jsx)$/.test(rel))
    .map((rel) => sinComentarios(leer(rel)))
    .join("\n");
}

test("las tres rutas de Vínculos son wrappers nativo/web fuera de app", () => {
  for (const entry of VINCULOS_ROUTES) {
    const wrapper = sinComentarios(leer(entry));
    assert.match(
      wrapper,
      /export \{ default \} from "@\/routes\/v492\/vinculos[^\"]*"/,
      `${entry} debe delegar en un módulo V4.9.2 resoluble por plataforma`
    );

    const nativeImpl = relativo(resolveEntryForPlatform(entry, "native"));
    const webImpl = relativo(resolveEntryForPlatform(entry, "web"));
    assert.match(nativeImpl, /^src\/routes\/v492\/vinculos[^/]*\.tsx$/, entry);
    assert.match(webImpl, /^src\/routes\/v492\/vinculos[^/]*\.web\.tsx$/, entry);
    assert.notEqual(nativeImpl, webImpl, `${entry} no puede compartir implementación nativa y web`);

    const nativeGraph = reachableFrom([entry], "native");
    const webGraph = reachableFrom([entry], "web");
    assert.ok(
      [...nativeGraph].some((rel) => rel.startsWith("src/screens/v492/")),
      `${entry} no llega a una pantalla V4.9.2 en nativo`
    );
    assert.ok(
      ![...webGraph].some((rel) => rel.startsWith("src/screens/v492/")),
      `${entry} arrastra la experiencia nativa al paquete web`
    );
    assert.match(
      sinComentarios(leer(webImpl)),
      /<Redirect\s+href="\/vinculo"\s*\/>/,
      `${entry} debe preservar la superficie web histórica`
    );
  }
});

test("el cliente de Vínculos deriva argumentos y resultados del API generado", () => {
  const source = sinComentarios(leer("src/services/relationshipsApi.ts"));

  assert.match(source, /import \{ api \} from ["'][^"']*convex\/_generated\/api["']/);
  for (const method of ["list", "savePerson", "removePerson", "getComparison", "refreshComparison"]) {
    assert.match(source, new RegExp(`api\\.relationships\\.${method}\\b`), method);
  }
  assert.match(
    source,
    /FunctionReturnType<\s*typeof api\.relationships\.(?:list|getComparison)\s*>/,
    "los datos de salida deben derivarse del contrato generado"
  );
  assert.match(
    source,
    /FunctionArgs<\s*typeof api\.relationships\.(?:savePerson|getComparison|refreshComparison)\s*>/,
    "los argumentos públicos deben derivarse del contrato generado"
  );
  assert.doesNotMatch(source, /\banyApi\b|\bFunctionReference\b|\bv\.any\b|\bas any\b/);
});

test("la raíz muestra el patrón propio y la lista real de personas guardadas", () => {
  const source = fuenteNativa("app/(tabs)/vinculos/index.tsx");

  assert.match(source, /useLayers\s*\(/);
  assert.match(source, /\.natal\.relationshipPattern\b/);
  assert.match(source, /relationshipsApi\.list\b/);
  assert.match(source, /useQuery\s*\(\s*relationshipsApi\.list\s*,\s*\{\s*\}\s*\)/);
  assert.match(source, /(?:profile|person|persona)\.name\b/);
  assert.match(source, /(?:profile|person|persona)\.profileId\b/);
  assert.match(source, /TraceAccordion\b/, "ORB-REL-001 debe exponer su trazabilidad");
  assert.match(source, /StatusLine\b/);
  assert.match(source, /MissingBlock\b/);
  assert.match(source, /\/vinculos\/conectar/);
});

test("Conectar ofrece signo, fecha y carta completa sin fabricar precisión", () => {
  const source = fuenteNativa("app/(tabs)/vinculos/conectar.tsx");

  for (const level of ["sign_to_sign", "date_to_date", "chart_to_chart"]) {
    assert.match(source, new RegExp(`["]${level}["]`), `falta el nivel ${level}`);
  }
  assert.match(source, /relationshipsApi\.savePerson\b/);
  assert.match(source, /useMutation\s*\(\s*relationshipsApi\.savePerson\s*\)/);
  assert.match(source, /birthTimePrecision\b/);
  assert.match(source, /(?:searchPlaces|geocod|Photon)/i, "la carta completa debe resolver el lugar real");
  assert.match(source, /(?:placeTimezone|atCoordinates|withResolvedTimezone)/, "la carta completa debe resolver la zona del lugar");
  // El id que se usa después de guardar es el que devolvió el backend, nunca uno
  // armado en el front. Desde QA22-015 ese id no abre la lectura: confirma el
  // alta en la raíz de Vínculos (ver `test/vinculosQA22.test.ts`).
  assert.match(source, /saved\.profileId|profile\.profileId/, "se usa el perfil persistido");

  assert.doesNotMatch(
    source,
    /(?:zodiacSignFromDate|sunSignFromDate|signFromBirthDate)/,
    "la fecha no debe convertirse por sí sola en una carta o signo personales"
  );
});

test("el resultado valida profileId y usa la comparación persistida", () => {
  const source = fuenteNativa("app/(tabs)/vinculos/[profileId].tsx");

  assert.match(source, /useLocalSearchParams\s*</);
  assert.match(source, /relationshipsApi\.list\b/);
  assert.match(source, /\.find\s*\(/, "el id del deep link debe resolverse contra la lista autorizada");
  assert.match(source, /relationshipsApi\.getComparison\b/);
  assert.match(source, /relationshipsApi\.refreshComparison\b/);
  assert.match(source, /useQuery\s*\(\s*relationshipsApi\.getComparison/);
  assert.match(source, /useAction\s*\(\s*relationshipsApi\.refreshComparison\s*\)/);
  assert.doesNotMatch(
    source,
    /(?:params\.)?profileId\s+as\s+(?:Id<|RelationshipProfile)/,
    "un string de URL no se puede convertir por cast en un id autorizado"
  );
});

test("signo contra signo es general; fecha y carta muestran cinco dimensiones reales", () => {
  const source = fuenteNativa("app/(tabs)/vinculos/[profileId].tsx");

  assert.match(source, /data\.generalOnly\b/);
  assert.match(source, /data\.resolvedLevel\b/);
  assert.match(source, /data\.dimensions\.map\s*\(/);
  assert.match(source, /dimension\.label\b/);
  // Lo que explica cada dimensión ya NO es `dimension.summary` —la plantilla por
  // tono del backend, idéntica en las cinco salvo el nombre—: es la LECTURA
  // armada en el dominio sobre la evidencia por contacto. Las cuatro piezas que
  // esa lectura publica tienen que llegar a la pantalla, y los contactos con
  // ellas.
  assert.match(source, /relationshipReading\(data\)/);
  assert.match(source, /dimension\.facilitates\b/);
  assert.match(source, /dimension\.strains\b/);
  assert.match(source, /dimension\.invitation\b/);
  assert.match(source, /dimension\.contactsList\b/);
  assert.match(source, /dimension\.drivers\b/);
  assert.match(
    source,
    /no (?:es|son) un porcentaje de compatibilidad/i,
    "las barras deben explicar que cuentan contactos y no compatibilidad"
  );

  assert.doesNotMatch(source, /\b(?:globalScore|totalScore|compatibilityScore|overallScore)\b/);
  assert.doesNotMatch(source, /formatPercent\s*\(\s*dimension\.value|dimension\.value\s*\*\s*100/);
});

test("comparaciones parciales, viejas o sin datos se explican y pueden reintentarse", () => {
  const source = fuenteNativa("app/(tabs)/vinculos/[profileId].tsx");

  assert.match(source, /StatusLine\b/);
  assert.match(source, /StaleNotice\b/);
  assert.match(source, /observedAt\b/);
  assert.match(source, /refreshComparison\b/);
  assert.match(source, /TraceAccordion\b/, "ORB-REL-002/003 debe exponer método, fuentes y límites");

  // Sin comparación calculada hay que decir POR QUÉ, con las razones del sobre.
  // Se pide el origen del dato y no el nombre del componente que lo dibuja: el
  // canon V4.9.2 los publica bajo el rótulo `LO QUE ESTO NO DICE` en vez de en
  // una caja aparte —dos descargos casi idénticos fueron una de las diferencias
  // registradas contra el frame—, y la garantía es que las razones se muestren,
  // no con qué caja.
  assert.match(
    source,
    /missingReasons\s*\(/,
    "una comparación sin datos debe explicar las razones que trajo el sobre"
  );
  assert.match(
    source,
    /comparison\.limitations\b/,
    "los límites declarados por el cálculo tienen que llegar a la pantalla"
  );
  assert.match(
    source,
    /LO QUE ESTO NO DICE/,
    "el descargo del canon cierra la pantalla y absorbe los límites del cálculo"
  );
  // Ojo: `fuenteNativa` concatena TODO el grafo, así que la biblioteca compartida
  // aparece entera y no se puede afirmar por ausencia qué usa esta pantalla. Que
  // los límites vayan bajo un solo rótulo se verifica en la comparación visual.
});

test("Vínculos nativo no alcanza mocks ni la pantalla Próximamente anterior", () => {
  for (const entry of VINCULOS_ROUTES) {
    const mockPath = pathTo(
      entry,
      (rel) => /(?:^|\/)(?:content|domain)\/[^/]*(?:mock|fixture|sample|demo)/i.test(rel),
      "native"
    );
    assert.equal(mockPath, null, mockPath ? `${entry}: ${mockPath.join(" -> ")}` : entry);

    const oldPath = pathTo(entry, (rel) => rel === "src/screens/VinculoScreen.tsx", "native");
    assert.equal(oldPath, null, oldPath ? `${entry}: ${oldPath.join(" -> ")}` : entry);
  }

  const source = VINCULOS_ROUTES.map(fuenteNativa).join("\n");
  assert.doesNotMatch(source, /VÍNCULO\s*·\s*PRÓXIMAMENTE|TE AVISAMOS CUANDO ESTÉ/i);
  assert.doesNotMatch(source, /\bMartina\b/, "un nombre del frame no puede presentarse como dato real");
  assert.doesNotMatch(source, /relationshipMock|comparisonMock|createFallbackProfile/);
});


// ---------------------------------------------------------------------------
// Los dos frames canónicos: `09 · carta contra carta` y `10 · signo contra
// signo`. La certificación los marcó FAIL por bloques ausentes y por texto
// genérico repetido; estos gates cubren exactamente esas diferencias.
// ---------------------------------------------------------------------------

// `RESULTADO` ya está declarado arriba, junto a las rutas: desde 4B lo miran los
// dos grupos de pruebas y una segunda declaración en el mismo módulo no compila.

/** Perfil guardado mínimo, con los campos que la regla del encabezado mira. */
const perfil = (over: Partial<RelationshipProfile> = {}): RelationshipProfile =>
  ({
    profileId: "rp_1" as RelationshipProfile["profileId"],
    name: "",
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

test("el nivel 01 se encabeza por el signo aunque la persona tenga nombre", () => {
  // La regla, no el string: el frame `10 · signo contra signo` escribe
  // `VOS Y ALGUIEN DE TAURO`. La implementación anterior usaba el nombre en
  // cuanto existía y mostraba `VOS Y PERSONA TAURO`, presentando una lectura
  // general —"sin la fecha completa no describe un vínculo concreto"— como si
  // fuera de esa persona.
  assert.equal(
    relationshipHeadline(perfil({ name: "Persona Tauro", zodiacSign: "taurus" })),
    "VOS Y ALGUIEN DE TAURO"
  );
  assert.equal(relationshipHeadline(perfil({ zodiacSign: "taurus" })), "VOS Y ALGUIEN DE TAURO");

  // Desde el nivel 02 el cálculo sí usa los datos de esa persona: se la nombra.
  assert.equal(
    relationshipHeadline(
      perfil({ name: "Martina QA", zodiacSign: "taurus", availableLevel: "date_to_date" })
    ),
    "VOS Y MARTINA QA"
  );
  assert.equal(
    relationshipHeadline(
      perfil({ name: "Martina QA", zodiacSign: "taurus", availableLevel: "chart_to_chart" })
    ),
    "VOS Y MARTINA QA"
  );
  // Sin nombre y sin signo reconocible, nunca se imprime la clave cruda.
  assert.equal(
    relationshipHeadline(perfil({ zodiacSign: "ofiuco", availableLevel: "chart_to_chart" })),
    "VOS Y ESTA PERSONA"
  );
});

test("el resultado arma el encabezado del canon: VOS Y … y el nivel con su barra", () => {
  const source = sinComentarios(leer(RESULTADO));

  // El encabezado nombra el VÍNCULO, no la sección: `← VÍNCULOS · COMPARACIÓN`
  // era lo que se veía, y el nombre de la persona se partía en dos líneas. La
  // REGLA de cómo se nombra se prueba arriba, sobre `relationshipHeadline`;
  // acá sólo se comprueba que la pantalla la use en vez de armar su propio texto.
  assert.match(source, /relationshipHeadline\(persona\)/, "el rótulo sale de la regla del dominio");
  assert.doesNotMatch(source, /`VOS Y /, "la pantalla no arma el encabezado por su cuenta");
  assert.match(source, /eyebrowLines=\{1\}/, "un nombre largo se recorta, no parte el encabezado");

  assert.match(source, /NIVEL DE DATOS/);
  assert.match(
    source,
    /relationshipLevelBadge\(nivel\)\}\s*·\s*\$\{RELATIONSHIP_LEVEL_HEADLINE\[/,
    "el nivel se escribe `03 · CARTA CONTRA CARTA`"
  );
  assert.match(source, /relationshipLevelShare\(nivel\)/, "y la barra dibuja el escalón de tres");
  assert.match(source, /relationshipLevelSentence\(/, "debajo va la frase de qué se puede leer");
  // Los datos natales, en una línea de ancho completo: en una columna angosta se
  // partían en cuatro renglones.
  assert.match(source, /relationshipBirthLine\(persona\)/);
});

test("POR DIMENSIÓN trae su leyenda, y la leyenda ya no describe una barra", () => {
  const source = sinComentarios(leer(RESULTADO));

  assert.match(source, /POR DIMENSIÓN/);
  // QA22-020: la barra se fue. La leyenda describe lo que la fila DICE —cuántos
  // contactos y hacia dónde se inclinan—, y sigue negando el porcentaje.
  assert.match(
    source,
    /CADA DIMENSIÓN DICE CUÁNTOS CONTACTOS REÚNE Y HACIA DÓNDE SE INCLINAN · NO ES UN PORCENTAJE DE COMPATIBILIDAD · NO HAY PUNTAJE/
  );
  assert.match(source, /NO ES UN PORCENTAJE DE COMPATIBILIDAD`/);
  assert.doesNotMatch(source, /LAS BARRAS CUENTAN CONTACTOS REALES/);
  assert.doesNotMatch(source, /LA BARRA MUESTRA CUÁNTO SE PUEDE LEER/);
  assert.doesNotMatch(
    source,
    /EL COLOR DICE SI PESAN MÁS LOS CONTACTOS FLUIDOS O LOS DE TENSIÓN/,
    "ya no hay un color que explicar: el balance está escrito"
  );
});

test("cada dimensión se explica con su evidencia real, no con la plantilla del sobre", () => {
  const source = sinComentarios(leer(RESULTADO));

  // Éste es el FAIL exacto de 09: "Cómo se hablan" y "Cómo se cuidan" traían la
  // MISMA frase cambiando el nombre, porque las dos venían de `dimension.summary`,
  // que el backend arma por tono. Desde 4B cada dimensión declara TRES cosas, y
  // las tres salen de la evidencia por contacto.
  assert.match(source, /dimension\.facilitates/);
  assert.match(source, /dimension\.strains/);
  assert.match(source, /dimension\.invitation/);
  assert.doesNotMatch(source, /dimension\.summary/, "el resumen por tono ya no se muestra");
  // Y los contactos siguen accesibles, ahora todos detrás de una acción que los
  // nombra (QA22-019).
  assert.match(source, /relationshipContactsToggleLabel\(dimension\)/);
  assert.match(source, /dimension\.contactsList\.map/);
  assert.doesNotMatch(source, /CONTACTOS MÁS/, "el control genérico se reemplazó por el copy exigido");

  // Y la fila de una dimensión no vuelve a dibujar la barra ni a leer el valor
  // del contrato. `dimension.value` sigue publicándose —es aditivo y los
  // clientes viejos lo usan—, pero acá no entra: era el número que la barra
  // convertía en un porcentaje de compatibilidad (QA22-020).
  const fila = /function DimensionLeida\(\{[\s\S]*?\n\}\n/.exec(source)?.[0] ?? "";
  assert.ok(fila, "no se encontró el cuerpo de DimensionLeida");
  assert.doesNotMatch(fila, /MeterBar/, "la barra de la comparación se fue");
  assert.doesNotMatch(fila, /dimension\.value/, "el valor del contrato no vuelve por la ventana");

  // La otra barra sí se queda: `NIVEL DE DATOS` no mide el vínculo, dice en qué
  // escalón de tres está el perfil guardado y lo anuncia como "N de 3".
  const nivel = /function NivelDeDatos\(\{[\s\S]*?\n\}\n/.exec(source)?.[0] ?? "";
  assert.ok(nivel, "no se encontró el cuerpo de NivelDeDatos");
  assert.match(nivel, /<MeterBar/, "el escalón del nivel conserva su riel");
});

test("el nivel incompleto lista qué habilita cada dato y ofrece el botón real", () => {
  const source = sinComentarios(leer(RESULTADO));

  assert.match(source, /RELATIONSHIP_UNLOCK_LABEL\.withDate/);
  assert.match(source, /RELATIONSHIP_UNLOCK_LABEL\.withTime/);
  assert.match(source, /RELATIONSHIP_TIME_UNLOCKS/);
  // `COMPLETAR SUS DATOS` era sólo texto; ahora es un botón que abre los datos
  // guardados de ESA persona —con su `profileId`— para editarlos sin duplicarla.
  assert.match(source, /label="COMPLETAR SUS DATOS"/);
  // El destino sale del dominio (`relationshipEditHref`), que es el mismo que usa
  // "Editar datos de …": son la misma pantalla y la misma persona.
  assert.match(source, /relationshipEditHref\(persona\.profileId\)/);
  assert.match(source, /align="start"/, "el botón se apoya en el margen, como el frame");
  // Y no aparece cuando no hay nada que completar.
  assert.match(source, /nivel !== "chart_to_chart" \? \(\s*<QueFalta/);
});

test("la edición desde el resultado completa a la MISMA persona, no crea otra", () => {
  const conectar = sinComentarios(leer("src/screens/v492/VinculosConnectScreen.tsx"));

  assert.match(conectar, /useLocalSearchParams<\{\s*profileId\?:\s*string\s*\}>/);
  assert.match(conectar, /findRelationshipProfile\(personas,\s*pedido\)/, "el id se valida contra tu lista");
  assert.match(
    conectar,
    /const perfilEditado = persona \? persona\.profileId : null/,
    "el profileId viaja sólo al editar: es lo que evita el duplicado"
  );
  assert.match(conectar, /relationshipDraftFromProfile\(persona\)/, "y el formulario abre prellenado");
  // Un id que no está en tu lista NO abre un formulario vacío: guardarlo crearía
  // una persona nueva en lugar de completar la que se pidió.
  assert.match(conectar, /No abrimos un formulario vacío/);
});

test("la escalera del nivel 01 es la canónica: una lectura de cinco, cuatro por desbloquear", () => {
  // El frame `10 · signo contra signo` dice "una dimensión" y "las otras
  // cuatro", y su escalera es: con la FECHA se agregan `Cómo se cuidan`,
  // `Deseo` y `Fricción`; con la HORA y el LUGAR se agrega `Proyecto en común`.
  // `Cómo se hablan` no está en la escalera porque en el nivel 01 su lugar lo
  // ocupa `Estilo general`.
  //
  // Una pasada anterior "arregló" la contradicción listando las cinco
  // dimensiones y diciendo "las otras cinco" (1/6). Eso no era el canon: es la
  // escalera la que manda, y la cuenta se deriva de ella.
  assert.deepEqual([...RELATIONSHIP_DATE_UNLOCKS], ["care", "desire", "friction"]);
  assert.deepEqual([...RELATIONSHIP_TIME_UNLOCK_DIMENSIONS], ["shared_project"]);
  assert.equal(RELATIONSHIP_LOCKED_DIMENSIONS.length, 4);
  assert.equal(RELATIONSHIP_READABLE_COUNT, 5);
  // Las cinco dimensiones del cálculo siguen siendo cinco: la escalera del
  // nivel 01 es otra cosa y no las redefine.
  assert.equal(RELATIONSHIP_DIMENSION_ORDER.length, 5);

  const nota = relationshipLockedDimensionsNote();
  assert.match(nota, /Con el signo solo se puede una dimensión/);
  assert.match(nota, /Las otras cuatro necesitan la fecha completa/);
  assert.doesNotMatch(nota, /otras cinco/);

  const pantalla = sinComentarios(leer(RESULTADO));
  assert.match(pantalla, /relationshipLockedDimensionsNote\(\)/);
  // La lectura del signo solo es 1 de las cinco superficies, dicha como CUENTA
  // y no como riel: una barra ahí se leía como una medida de afinidad
  // (QA22-020).
  assert.match(pantalla, /1 LECTURA DE \$\{RELATIONSHIP_READABLE_COUNT\}/);
  assert.doesNotMatch(pantalla, /relationshipGeneralOnlyShare/);
  // Y las listas se dibujan desde la escalera, no desde las cinco dimensiones.
  assert.match(pantalla, /RELATIONSHIP_DATE_UNLOCKS\.map/);
  assert.match(pantalla, /RELATIONSHIP_TIME_UNLOCK_DIMENSIONS\.map/);
});

test("sin cálculo, el cuerpo sale del NIVEL guardado y no de `data.generalOnly`", () => {
  // El defecto: el modo se derivaba sólo de `data?.generalOnly`, un campo que
  // sin cálculo no existe. Un nivel 01 sin comparación caía en la rama de las
  // cinco dimensiones y dibujaba cinco barras en cero — resultados calculados
  // que nunca se calcularon — con la leyenda de las dos cartas.
  assert.equal(
    relationshipResultMode({ level: "sign_to_sign", data: null }),
    "general-sin-calculo"
  );
  assert.equal(
    relationshipResultMode({ level: "date_to_date", data: undefined }),
    "dimensiones-sin-calculo"
  );
  assert.equal(
    relationshipResultMode({ level: "chart_to_chart", data: null }),
    "dimensiones-sin-calculo"
  );
  assert.equal(
    relationshipResultMode({ level: "sign_to_sign", data: { generalOnly: true, dimensions: [] } }),
    "general"
  );
  // El cálculo puede quedarse corto: nivel 03 guardado, resultado general.
  assert.equal(
    relationshipResultMode({ level: "chart_to_chart", data: { generalOnly: true, dimensions: [] } }),
    "general"
  );
  assert.equal(
    relationshipResultMode({
      level: "chart_to_chart",
      data: { generalOnly: false, dimensions: [{}, {}] }
    }),
    "dimensiones"
  );

  // Y las dos preguntas derivadas responden lo mismo con y sin cálculo.
  assert.equal(relationshipModeIsGeneral("general-sin-calculo"), true);
  assert.equal(relationshipModeIsGeneral("dimensiones-sin-calculo"), false);
  assert.equal(relationshipModeHasCalculation("general-sin-calculo"), false);
  assert.equal(relationshipModeHasCalculation("general"), true);

  const pantalla = sinComentarios(leer(RESULTADO));
  assert.match(pantalla, /relationshipResultMode\(\{ level: nivel, data \}\)/);
  // Sin cálculo no se dibuja ni una barra: una barra en cero es un resultado.
  assert.match(pantalla, /SIN CALCULAR/);
  const sinComparacion = /function SinComparacion\(\{[\s\S]*?\n\}/.exec(pantalla)?.[0] ?? "";
  assert.ok(sinComparacion, "no se encontró el cuerpo sin cálculo");
  assert.doesNotMatch(
    sinComparacion,
    /<MeterBar/,
    "una barra en cero se lee como «no hay ni un contacto», y acá no se calculó nada"
  );
});

test("la causa que se muestra dice DE QUIÉN es el dato que falta", () => {
  // La pantalla decía "falta la fecha de nacimiento de esta persona" aunque lo
  // que faltara fuera la carta propia, y ofrecía completar los datos de alguien
  // que ya los tenía completos.
  const persona = {
    profileId: "p1",
    name: "Martina QA",
    zodiacSign: "taurus",
    availableLevel: "chart_to_chart",
    birthDate: "1994-05-04",
    birthTime: "09:12",
    birthTimePrecision: "known",
    birthPlaceLabel: "Buenos Aires, Argentina"
  } as unknown as RelationshipProfile;

  const propio = relationshipGaps(
    { missingInputs: ["own_natal_chart"], limitations: [] },
    persona
  );
  assert.deepEqual(propio.map((g) => g.owner), ["propio"]);
  assert.match(propio[0]!.reason, /carta natal calculada para tu cuenta/i);
  assert.doesNotMatch(propio[0]!.reason, /Martina/);
  assert.equal(relationshipGapsBlameOther(propio), false, "no se le puede pedir nada a esa persona");
  assert.equal(relationshipGapsBlameOwn(propio), true);

  const ajeno = relationshipGaps({ missingInputs: ["birth_date"], limitations: [] }, persona);
  assert.deepEqual(ajeno.map((g) => g.owner), ["otra"]);
  assert.match(ajeno[0]!.reason, /Martina QA/);
  assert.equal(relationshipGapsBlameOther(ajeno), true);

  // El proveedor caído no es un dato que falte, y no manda a nadie a editar.
  const proveedor = relationshipGaps(
    { missingInputs: ["comparison_ephemeris"], limitations: [] },
    persona
  );
  assert.deepEqual(proveedor.map((g) => g.owner), ["proveedor"]);
  assert.equal(relationshipGapsBlameOther(proveedor), false);
  assert.equal(relationshipGapsBlameOwn(proveedor), false);

  // `exact_birth_time_and_place` es ambiguo en el contrato: el backend lo emite
  // por la hora propia y por la ajena. Se resuelve con el perfil guardado.
  const conHoraCompleta = relationshipGaps(
    { missingInputs: ["exact_birth_time_and_place"], limitations: [] },
    persona
  );
  assert.deepEqual(conHoraCompleta.map((g) => g.owner), ["propio"]);
  assert.match(conHoraCompleta[0]!.reason, /Falta tu hora exacta/);

  const sinHoraDeElla = relationshipGaps(
    { missingInputs: ["exact_birth_time_and_place"], limitations: [] },
    { ...persona, birthTimePrecision: "unknown", birthTime: null } as unknown as RelationshipProfile
  );
  assert.deepEqual(sinHoraDeElla.map((g) => g.owner), ["otra"]);
  assert.match(sinHoraDeElla[0]!.reason, /Martina QA/);

  // Un código que no sabemos traducir no se imprime crudo: cae en las
  // limitaciones del sobre, y si tampoco hay, en una frase honesta.
  const desconocido = relationshipGaps(
    { missingInputs: ["algo_que_no_conocemos"], limitations: ["Se cayó el cálculo."] },
    persona
  );
  assert.deepEqual(desconocido, [{ reason: "Se cayó el cálculo.", owner: "indeterminado" }]);
  assert.equal(
    relationshipGaps({ missingInputs: [], limitations: [] }, persona)[0]!.owner,
    "indeterminado"
  );

  // Y la pantalla ofrece el botón del DUEÑO del faltante, no siempre el ajeno.
  const pantalla = sinComentarios(leer(RESULTADO));
  assert.match(pantalla, /relationshipGapsBlameOther\(huecos\)/);
  assert.match(pantalla, /relationshipGapsBlameOwn\(huecos\)/);
  assert.match(pantalla, /REVISAR MIS DATOS DE NACIMIENTO/);
});

test("el hub de Vínculos pone a las personas arriba y el patrón abajo", () => {
  // Decisión de producto (Lucas, 2026-08-19, probando en iPhone): lo primero
  // del hub es la acción — elegir o agregar una persona. El patrón relacional
  // es contexto natal que no cambia, y se lee después.
  const hub = readFileSync(join(ROOT, "src/screens/v492/VinculosHubScreen.tsx"), "utf8");
  const personas = hub.indexOf('module="Personas guardadas"');
  const patron = hub.indexOf('module="Tu patrón relacional"');
  assert.ok(personas > 0 && patron > 0, "los dos módulos existen");
  assert.ok(personas < patron, "Personas guardadas va antes que Tu patrón relacional");
});

test("agregar una persona es un flujo de tres pasos; editar sigue siendo una pantalla", () => {
  // Decisión de producto (Lucas, 2026-08-19, en iPhone): la pantalla única
  // pedía decidir todo a la vez y la consecuencia de elegir nivel quedaba
  // fuera de la vista. El alta ahora es: 1 nombre → 2 qué comparar → 3 los
  // datos de ese nivel. Editar conserva la vista completa: ahí el contexto ya
  // se conoce y saltar de paso en paso sería un peaje.
  const form = readFileSync(join(ROOT, "src/screens/v492/VinculosConnectScreen.tsx"), "utf8");
  assert.match(form, /"nombre" \| "nivel" \| "datos"/, "la máquina de pasos existe");
  assert.match(form, /persona \? "datos" : "nombre"/, "editar entra directo; crear arranca por el nombre");
  assert.match(form, /PASO 1 DE 3/, "el paso se anuncia");
  assert.match(form, /PASO 2 DE 3/);
  assert.match(form, /PASO 3 DE 3/);
  // Al editar se ven todos los bloques MENOS el selector de modalidad: el nivel
  // ahí no es una decisión, es lo que los datos permiten (QA22-018). El detalle
  // de esa regla vive en `test/vinculosQA22.test.ts`.
  assert.match(
    form,
    /editando \? bloque !== "nivel" : paso === bloque/,
    "editar muestra los datos y no repite el selector de modalidad"
  );
  assert.match(form, /label="CONTINUAR"/, "los pasos avanzan con un CTA explícito");
  assert.match(form, /VOLVER AL PASO ANTERIOR/, "y se puede volver sin perder lo cargado");
});

test("un contacto se sabe nombrar corto, y una frase desconocida no se inventa", () => {
  // El nombre corto es lo que vuelve puntual la síntesis ("su Venus con tu Sol")
  // sin reescribir la oración astrológica del backend. La síntesis completa se
  // prueba en `test/vinculosLecturaQA22.test.ts`, que es donde vive desde 4B.
  assert.equal(
    relationshipDriverShortName(
      "Su Venus forma un trígono con tu Sol, un contacto de 120°; está a 0,4° de su máxima precisión."
    ),
    "su Venus con tu Sol"
  );
  // Las superposiciones de casa también se saben nombrar.
  assert.equal(
    relationshipDriverShortName("Su Sol cae en tu casa 7, vinculada con pareja y asociaciones."),
    "su Sol en tu casa 7"
  );
  // Una frase que no matchea NO inventa: cae a null y la lectura usa su versión
  // contable.
  assert.equal(relationshipDriverShortName("Texto inesperado del futuro."), null);
});

test("la pantalla monta el resumen antes de POR DIMENSIÓN", () => {
  const source = readFileSync(
    join(ROOT, "src/screens/v492/VinculosResultScreen.tsx"),
    "utf8"
  );
  const resumen = source.indexOf('title="EN RESUMEN"');
  const porDimension = source.indexOf('title="POR DIMENSIÓN"');
  assert.ok(resumen > 0, "existe el bloque EN RESUMEN");
  assert.ok(resumen < porDimension, "y va antes de las dimensiones");
});
