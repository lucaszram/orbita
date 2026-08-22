/**
 * QA23-005 · el perfil canónico de una persona, y dónde termina un guardado.
 *
 * ## El defecto
 *
 * Hasta el build 23, `/vinculos/[profileId]` ERA la comparación y el guardado
 * volvía a la raíz global con `?guardada=<id>` (QA22-015). Las dos cosas juntas
 * dejaban al alta sin superficie propia: quien acababa de cargar a alguien
 * aterrizaba en una lista donde su persona es una fila más, y lo único que la
 * nombraba era una lectura que la raíz arrancaba sola —así que guardar y calcular
 * volvían a verse como una sola espera, que es justo lo que QA22-016 había
 * separado—.
 *
 * ## Lo que se fija acá
 *
 * 1. **Rutas.** El perfil es `/vinculos/[profileId]` y la comparación cuelga de
 *    él, en `/vinculos/[profileId]/comparacion`. Los cuatro destinos se arman en
 *    el dominio, nunca en una pantalla.
 * 2. **Post-guardado.** Alta y edición aterrizan en ESE perfil, con una
 *    confirmación breve. Nunca en la raíz global y nunca en la comparación.
 * 3. **Sin cálculo automático.** Ni la raíz ni el perfil montan `getComparison` o
 *    `refreshComparison`. El cálculo empieza cuando alguien abre la comparación.
 * 4. **Ownership.** El `profileId` de la URL se resuelve contra
 *    `relationships.list` ANTES de mostrar un dato, con la misma conversión que
 *    usan el formulario y la comparación. Un id ajeno o inexistente no publica
 *    nada de ninguna cuenta.
 * 5. **Accesibilidad.** Las dos acciones del perfil y el CTA legacy tienen rol,
 *    etiqueta, pista y objetivo táctil; la confirmación es una región viva.
 *
 * Las pruebas de dominio son puras —sin React, sin Convex y sin reloj—; las
 * estructurales leen las pantallas como texto con los comentarios removidos,
 * porque una regla que se cumple sólo en un comentario no se cumple.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

import {
  findRelationshipProfile,
  relationshipComparisonHref,
  relationshipEditHref,
  relationshipProfileHref,
  relationshipSavedConfirmation,
  relationshipSavedHref,
  relationshipSavedMode,
  VINCULOS_FORM_ROUTE,
  VINCULOS_ROUTE
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

const PERFIL = "src/screens/v492/VinculosProfileScreen.tsx";
const HUB = "src/screens/v492/VinculosHubScreen.tsx";
const RESULTADO = "src/screens/v492/VinculosResultScreen.tsx";
const CONECTAR = "src/screens/v492/VinculosConnectScreen.tsx";

const RUTA_RAIZ = "app/(tabs)/vinculos/index.tsx";
const RUTA_CONECTAR = "app/(tabs)/vinculos/conectar.tsx";
const RUTA_PERFIL = "app/(tabs)/vinculos/[profileId].tsx";
const RUTA_COMPARACION = "app/(tabs)/vinculos/[profileId]/comparacion.tsx";

const MIA = "rp_qa23_propia" as RelationshipProfileId;
const AJENA = "rp_qa23_ajena";

/** Perfil guardado mínimo, con los campos que el perfil canónico muestra. */
const perfil = (over: Partial<RelationshipProfile> = {}): RelationshipProfile =>
  ({
    profileId: MIA,
    name: "Persona QA",
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
  }) satisfies RelationshipProfile;

/** El cuerpo de una función del archivo, aislado del resto de la pantalla. */
function bloque(source: string, nombre: string): string {
  const cuerpo = new RegExp(`function ${nombre}\\([\\s\\S]*?\\n\\}\\n`).exec(source)?.[0] ?? "";
  assert.ok(cuerpo.length > 0, `no se encontró el cuerpo de ${nombre}`);
  return cuerpo;
}

// ---------------------------------------------------------------------------
// a) Las rutas: el perfil es la superficie de la persona; la comparación, hija
// ---------------------------------------------------------------------------

test("el perfil es la ruta de la persona y la comparación cuelga de él", () => {
  assert.equal(VINCULOS_ROUTE, "/vinculos");
  assert.equal(VINCULOS_FORM_ROUTE, "/vinculos/conectar");
  assert.equal(relationshipProfileHref("rp_1"), "/vinculos/rp_1");
  assert.equal(relationshipComparisonHref("rp_1"), "/vinculos/rp_1/comparacion");
  assert.equal(relationshipEditHref("rp_1"), "/vinculos/conectar?profileId=rp_1");

  // La jerarquía es el punto: la comparación es UNA de las cosas que se pueden
  // hacer con una persona guardada, así que su ruta empieza por la de la persona.
  assert.ok(relationshipComparisonHref("rp_1").startsWith(`${relationshipProfileHref("rp_1")}/`));
  // Y el perfil cuelga de la raíz, no la reemplaza.
  assert.ok(relationshipProfileHref("rp_1").startsWith(`${VINCULOS_ROUTE}/`));

  // El formulario vive en el mismo nivel que el perfil, como segmento ESTÁTICO:
  // en Expo Router gana contra el dinámico, así que "conectar" nunca se resuelve
  // como el id de una persona. Los ids reales de Convex no se parecen a un slug.
  assert.equal(VINCULOS_FORM_ROUTE, relationshipProfileHref("conectar"));
  assert.equal(relationshipEditHref("rp_1").split("?")[0], VINCULOS_FORM_ROUTE);
});

test("las cuatro rutas existen como wrappers y la web degrada a /vinculo", () => {
  const rutas = [RUTA_RAIZ, RUTA_CONECTAR, RUTA_PERFIL, RUTA_COMPARACION] as const;

  for (const entry of rutas) {
    assert.ok(existsSync(join(ROOT, entry)), `falta la ruta ${entry}`);
    const wrapper = sinComentarios(leer(entry));
    assert.match(wrapper, /export \{ default \} from "@\/routes\/v492\/vinculos[^"]*"/, entry);

    const nativeImpl = relativo(resolveEntryForPlatform(entry, "native"));
    const webImpl = relativo(resolveEntryForPlatform(entry, "web"));
    assert.match(nativeImpl, /^src\/routes\/v492\/vinculos[^/]*\.tsx$/, entry);
    assert.match(webImpl, /^src\/routes\/v492\/vinculos[^/]*\.web\.tsx$/, entry);
    assert.notEqual(nativeImpl, webImpl, `${entry} no puede compartir implementación`);

    // La superficie web histórica es `/vinculo` y no se toca: la ruta nueva
    // redirige igual que las tres anteriores, y su árbol nativo no llega al
    // paquete web.
    assert.match(sinComentarios(leer(webImpl)), /<Redirect\s+href="\/vinculo"\s*\/>/, entry);
    assert.ok(
      ![...reachableFrom([entry], "web")].some((rel) => rel.startsWith("src/screens/v492/")),
      `${entry} arrastra la experiencia nativa al paquete web`
    );
    assert.ok(
      [...reachableFrom([entry], "native")].some((rel) => rel.startsWith("src/screens/v492/")),
      `${entry} no llega a una pantalla V4.9.2 en nativo`
    );
  }

  // Cada ruta nativa monta LO SUYO: el perfil el perfil, la comparación la
  // comparación. Si se cruzaran, "volver" y el post-guardado apuntarían al mismo
  // lugar otra vez.
  const perfilNativo = sinComentarios(readFileSync(resolveEntryForPlatform(RUTA_PERFIL, "native"), "utf8"));
  assert.match(perfilNativo, /<VinculosProfileScreen profileId=\{profileId\} \/>/);
  assert.doesNotMatch(perfilNativo, /VinculosResultScreen/);

  const comparacionNativa = sinComentarios(
    readFileSync(resolveEntryForPlatform(RUTA_COMPARACION, "native"), "utf8")
  );
  assert.match(comparacionNativa, /<VinculosResultScreen profileId=\{profileId\} \/>/);
  assert.doesNotMatch(comparacionNativa, /VinculosProfileScreen/);

  // Sin segmento no hay nada que abrir: las dos vuelven a la raíz de la sección
  // en vez de montar una pantalla sin persona.
  for (const fuente of [perfilNativo, comparacionNativa]) {
    assert.match(fuente, /if \(typeof profileId !== "string" \|\| profileId\.length === 0\)/);
    assert.match(fuente, /<Redirect href=\{VINCULOS_ROUTE as never\} \/>/);
  }
});

test("el respaldo sin historial de la comparación es su perfil, y el del perfil, la raíz", () => {
  const perfilSource = sinComentarios(leer(PERFIL));
  const resultado = sinComentarios(leer(RESULTADO));

  // Con historial manda el `pop` del stack —y la pestaña conserva su ancla en
  // `index`—; el `fallbackHref` es el respaldo declarado de cada pantalla, y es
  // el que dice a qué superficie pertenece.
  assert.match(
    perfilSource,
    /<DetailLayerScreen eyebrow="VÍNCULOS · PERFIL" fallbackHref=\{VINCULOS_ROUTE\}>/
  );
  assert.match(resultado, /const volverAlPerfil = relationshipProfileHref\(profileId\)/);
  assert.match(resultado, /const volverAlPerfil = relationshipProfileHref\(persona\.profileId\)/);
  assert.match(resultado, /<DetailLayerScreen eyebrow=\{eyebrow\} fallbackHref=\{fallbackHref\}/);
  // Y ninguna superficie de la comparación se quedó sin destino de vuelta: si una
  // sola se olvida, el "volver" depende del estado con el que se abrió.
  const shells = resultado.match(/<Shell(?:\s|>)/g)?.length ?? 0;
  const conVuelta = resultado.match(/<Shell[^>]*fallbackHref=\{/g)?.length ?? 0;
  assert.ok(shells >= 8, "se esperaban todas las superficies de la comparación");
  assert.equal(conVuelta, shells, "hay superficies de la comparación sin destino de vuelta");

  // Un id que ya no existe —recién borrado, o de otra cuenta— no vuelve a un
  // perfil que tampoco tiene nada: sale a la raíz.
  assert.match(resultado, /<Shell fallbackHref=\{VINCULOS_ROUTE\}>/);
});

// ---------------------------------------------------------------------------
// b) Post-guardado: aterriza en ESE perfil, y no arranca ningún cálculo
// ---------------------------------------------------------------------------

test("el destino del guardado es el perfil de esa persona, con el modo declarado", () => {
  assert.equal(relationshipSavedHref("rp_1", "alta"), "/vinculos/rp_1?modo=alta");
  assert.equal(relationshipSavedHref("rp_1", "edicion"), "/vinculos/rp_1?modo=edicion");

  for (const modo of ["alta", "edicion"] as const) {
    const destino = relationshipSavedHref("rp_1", modo);
    // El perfil, y nada más que el perfil.
    assert.ok(destino.startsWith(relationshipProfileHref("rp_1")), modo);
    assert.notEqual(destino, VINCULOS_ROUTE, `${modo}: no vuelve a la raíz global`);
    assert.doesNotMatch(destino, /^\/vinculos\?/, `${modo}: la raíz ya no recibe el guardado`);
    assert.ok(!destino.includes("/comparacion"), `${modo}: el guardado no abre la comparación`);

    // El id viaja como SEGMENTO —es el que devolvió el backend— y lo único que
    // viaja como parámetro es el modo, que sólo cambia la confirmación.
    const url = new URL(destino, "https://orbita.test");
    assert.equal(url.pathname, "/vinculos/rp_1");
    assert.equal([...url.searchParams.keys()].join(","), "modo");
    assert.equal(relationshipSavedMode(url.searchParams.get("modo")), modo);
  }

  // Un modo que no es uno de los dos —o repetido, que llega como arreglo— no es
  // un modo: la pantalla se dibuja sin confirmación, no con una inventada.
  for (const crudo of [undefined, null, "", "ALTA", " alta", ["alta", "edicion"], 1]) {
    assert.equal(relationshipSavedMode(crudo), null, String(crudo));
  }
});

test("la confirmación es del guardado y no promete un cálculo que nadie arrancó", () => {
  const alta = relationshipSavedConfirmation("Persona QA", "alta");
  const edicion = relationshipSavedConfirmation("Persona QA", "edicion");

  for (const frase of [alta, edicion]) {
    assert.match(frase, /Persona QA/);
    assert.match(frase, /Guardamos/, "dice lo que PASÓ");
    assert.match(frase, /cuando la abr[ií]s/i, "y cuándo empieza el cálculo: al abrir");
    // Nada de "estamos preparando su lectura": eso describía el recálculo que la
    // raíz disparaba sola, y ya no ocurre.
    assert.doesNotMatch(frase, /prepar|calculando|en un momento|en breve/i);
  }
  assert.notEqual(alta, edicion, "dar de alta no es lo mismo que actualizar");
  assert.match(relationshipSavedConfirmation("   ", "alta"), /esta persona/);
});

test("el formulario navega al perfil y no puede terminar en la comparación", () => {
  const conectar = sinComentarios(leer(CONECTAR));

  assert.match(
    conectar,
    /const destino = relationshipSavedHref\(saved\.profileId, persona \? "edicion" : "alta"\)/,
    "el id es el que devolvió el backend, no uno armado en el front"
  );
  assert.match(conectar, /router\.replace\(destino as never\)/);
  // La degradación del tipo de vínculo (QA23-004) sale al MISMO destino: si
  // guardara la persona y mandara a otro lado, la confirmación quedaría huérfana.
  assert.match(conectar, /setTipoSinGuardar\(destino\)/);
  assert.match(conectar, /router\.replace\(tipoSinGuardar as never\)/);

  // Ninguna vía del guardado abre la comparación ni arma un destino a mano.
  assert.doesNotMatch(conectar, /relationshipComparisonHref|\/comparacion/);
  assert.doesNotMatch(conectar, /router\.(?:replace|push|navigate|dismissTo)\(\s*`\/vinculos\/\$\{/);
  // Ni dispara un recálculo por su cuenta: guardar escribe, y ahí termina.
  assert.doesNotMatch(conectar, /refreshComparison|getComparison/);
});

test("nadie arranca la comparación por haber guardado: sólo la comparación calcula", () => {
  const hub = sinComentarios(leer(HUB));
  const perfilSource = sinComentarios(leer(PERFIL));
  const resultado = sinComentarios(leer(RESULTADO));

  // Las dos superficies por las que se pasa después de guardar no consultan ni
  // recalculan nada. Es una garantía de AUSENCIA a propósito: cualquier consulta
  // nueva acá volvería a mezclar las dos esperas.
  for (const [nombre, source] of [
    ["la raíz", hub],
    ["el perfil", perfilSource]
  ] as const) {
    assert.doesNotMatch(source, /getComparison/, `${nombre} consulta una comparación`);
    assert.doesNotMatch(source, /refreshComparison/, `${nombre} dispara un recálculo`);
    assert.doesNotMatch(source, /useAction/, `${nombre} ejecuta una acción`);
    assert.doesNotMatch(source, /useEffect/, `${nombre} corre algo al montarse`);
  }

  // Y la comparación sigue teniendo su recálculo acotado, que es donde
  // corresponde: se llega ahí por una acción explícita.
  assert.match(resultado, /useQuery\(relationshipsApi\.getComparison, \{ profileId: persona\.profileId \}\)/);
  assert.match(resultado, /useAction\(relationshipsApi\.refreshComparison\)/);
  assert.match(resultado, /if \(pedidoAutomatico\.current === clave\) return;/);
});

// ---------------------------------------------------------------------------
// c) Ownership: el id de la URL vale lo que valga en TU lista
// ---------------------------------------------------------------------------

test("un profileId sólo vale si aparece en la lista autorizada de la cuenta", () => {
  const mias = [perfil()];

  // Mientras la lista viaja no se sabe nada, y no saber no es "no existe".
  assert.equal(findRelationshipProfile(undefined, MIA), undefined);
  // Con la lista en mano, el id de la URL se resuelve contra ELLA.
  assert.equal(findRelationshipProfile(mias, MIA)?.profileId, MIA);
  assert.equal(findRelationshipProfile(mias, ` ${MIA} `)?.profileId, MIA, "se recorta el espacio");

  // Un id de otra cuenta, uno borrado o uno inventado son todos lo mismo: `null`.
  for (const crudo of [AJENA, "rp_no_existe", "", "   ", null, undefined, "__proto__", "toString"]) {
    assert.equal(findRelationshipProfile(mias, crudo), null, String(crudo));
  }
  // Una lista vacía no puede autorizar nada.
  assert.equal(findRelationshipProfile([], MIA), null);
});

test("con un id ajeno, el perfil no publica NINGÚN dato de esa persona", () => {
  const source = sinComentarios(leer(PERFIL));
  const live = bloque(source, "VinculosProfileLive");

  // La resolución es la misma conversión autorizada que usan el formulario y la
  // comparación: entra el string de la URL, sale una persona de TU lista.
  assert.match(live, /useQuery\(relationshipsApi\.list, \{\}\)/);
  assert.match(live, /const persona = findRelationshipProfile\(personas, profileId\)/);
  // Y nunca por conversión de tipos.
  assert.doesNotMatch(source, /profileId\s+as\s+(?:Id<|RelationshipProfile)/);
  assert.doesNotMatch(source, /as unknown as/);

  // Los tres estados, en orden y sin filtrar nada: en vuelo, no autorizado y
  // recién entonces el cuerpo con datos.
  const enVuelo = live.indexOf("persona === undefined");
  const noAutorizado = live.indexOf("persona === null");
  const cuerpo = live.indexOf("<PerfilCanonico");
  assert.ok(enVuelo > 0 && noAutorizado > enVuelo && cuerpo > noAutorizado);
  assert.match(live, /Este enlace no corresponde a ninguna persona guardada en tu cuenta/);

  // El bloque del id no autorizado no puede nombrar a nadie ni mostrar un dato:
  // sólo dice qué pasó y ofrece la salida.
  const rechazo = live.slice(noAutorizado, cuerpo);
  assert.doesNotMatch(rechazo, /persona\.(?:name|birth|zodiacSign|availableLevel|profileId)/);
  assert.match(rechazo, /label="VOLVER A TUS PERSONAS"/);

  // Y el cuerpo con datos SÓLO se monta con una persona ya resuelta.
  const canonico = bloque(source, "PerfilCanonico");
  assert.match(canonico, /persona: RelationshipProfile;/);
  assert.doesNotMatch(canonico, /findRelationshipProfile|useQuery/);
});

test("el perfil hereda las mismas fases de sesión que el resto de Vínculos", () => {
  const source = sinComentarios(leer(PERFIL));
  const gate = bloque(source, "VinculosProfileScreen");

  // Sin sesión no hay lista autorizada, y sin carta propia no hay contra qué
  // comparar a nadie: los cuatro estados existen antes de pedir la lista.
  assert.match(gate, /const \{ phase, retrySession \} = useLayers\(\)/);
  for (const [fase, bloqueEsperado] of [
    ["cargando", "LoadingBlock"],
    ["error", "ErrorBlock"],
    ["invitado", "GuestBlock"],
    ["vacio", "EmptyBlock"]
  ] as const) {
    assert.match(gate, new RegExp(`phase === "${fase}"`), fase);
    assert.match(gate, new RegExp(`<${bloqueEsperado}`), bloqueEsperado);
  }
  assert.ok(
    gate.indexOf("<VinculosProfileLive") > gate.indexOf('phase === "vacio"'),
    "la lista se pide recién con la sesión resuelta"
  );
});

// ---------------------------------------------------------------------------
// d) Qué muestra y qué ofrece el perfil
// ---------------------------------------------------------------------------

test("el perfil muestra los datos canónicos y el tipo declarado o legacy", () => {
  const canonico = bloque(sinComentarios(leer(PERFIL)), "PerfilCanonico");

  // Los datos, tal como quedaron guardados: nada se completa ni se deriva acá.
  assert.match(canonico, /const datos = relationshipBirthLine\(persona\)/);
  assert.match(canonico, /label="DATOS DE NACIMIENTO"/);
  assert.match(canonico, /label="NIVEL DE DATOS"/);
  assert.match(canonico, /relationshipLevelBadge\(nivel\)/);
  assert.match(canonico, /RELATIONSHIP_LEVEL_HEADLINE\[nivel\]/);
  assert.match(canonico, /RELATIONSHIP_LEVEL_NOTE\[nivel\]/);
  assert.match(canonico, /<Subtitle style=\{styles\.nombre\}>\{persona\.name\}<\/Subtitle>/);
  // El nivel sale del perfil guardado, no de una elección: el perfil lo muestra,
  // no lo pregunta.
  assert.doesNotMatch(canonico, /setNivel|relationshipLevelFromDraft/);

  // Lo DECLARADO, con sus tres estados. Legacy (`null`) es el único que pide algo.
  assert.match(canonico, /const tipo = readRelationshipType\(persona\)/);
  assert.match(canonico, /RELATIONSHIP_TYPE_FIELD_LABEL/);
  assert.match(canonico, /relationshipTypeChip\(tipo\)/);
  assert.match(canonico, /relationshipTypeLine\(tipo\)/);
  assert.match(canonico, /relationshipTypeNeedsDefinition\(tipo\) \?/);
  assert.match(canonico, /RELATIONSHIP_TYPE_DEFINE_CTA/);
  // Y nada se deriva acá: la pantalla no toca un solo campo de nacimiento por su
  // cuenta —los formatea el dominio— ni podría inferir el tipo de ninguno.
  assert.doesNotMatch(canonico, /persona\.(?:zodiacSign|birthDate|birthTime|birthPlaceLabel)/);
});

test("el perfil ofrece EXACTAMENTE dos acciones, y el CTA legacy no bloquea", () => {
  const source = sinComentarios(leer(PERFIL));
  const canonico = bloque(source, "PerfilCanonico");

  const primarios = [...canonico.matchAll(/<PrimaryButton\s+label="([^"]+)"/g)].map(
    (match) => match[1]
  );
  assert.deepEqual(primarios, ["VER LA COMPARACIÓN", "EDITAR DATOS"], "dos acciones y en ese orden");
  assert.equal(
    (canonico.match(/<PrimaryButton/g) ?? []).length,
    2,
    "exactamente dos: ni un tercer botón primario ni una acción escondida"
  );

  // Cada una a su destino del dominio, con el `profileId` que publicó el backend.
  assert.match(canonico, /router\.push\(relationshipComparisonHref\(persona\.profileId\) as never\)/);
  assert.match(canonico, /router\.push\(relationshipEditHref\(persona\.profileId\) as never\)/);
  // Y ninguna arma su URL a mano.
  assert.doesNotMatch(source, /`\/vinculos\//);

  // El CTA legacy es una acción secundaria —no un tercer botón primario— y no
  // condiciona nada: las dos acciones existen igual sin tipo declarado.
  const definir = canonico.indexOf("RELATIONSHIP_TYPE_DEFINE_CTA");
  const comparacion = canonico.indexOf('label="VER LA COMPARACIÓN"');
  assert.ok(definir > 0 && comparacion > definir, "definir el tipo va antes, como invitación");
  assert.doesNotMatch(
    canonico,
    /relationshipTypeNeedsDefinition\([^)]*\)\s*\?[\s\S]{0,120}?label="VER LA COMPARACIÓN"/,
    "ver la comparación no puede depender del tipo declarado"
  );
});

test("la confirmación del guardado vive en el perfil, es breve y se puede cerrar", () => {
  const source = sinComentarios(leer(PERFIL));
  const live = bloque(source, "VinculosProfileLive");
  const canonico = bloque(source, "PerfilCanonico");

  // El modo llega por la URL y se valida con la misma regla del dominio.
  assert.match(live, /relationshipSavedMode\(params\[RELATIONSHIP_SAVED_MODE_PARAM\]\)/);
  assert.match(live, /<PerfilCanonico persona=\{persona\} modo=\{modo\} \/>/);

  // Sin modo no hay confirmación: entrar desde la lista no dice "guardamos".
  assert.match(canonico, /\{modo && !confirmacionCerrada \?/);
  assert.match(canonico, /relationshipSavedConfirmation\(persona\.name, modo\)/);
  assert.match(canonico, /modo === "edicion" \? "DATOS ACTUALIZADOS" : "PERSONA GUARDADA"/);
  // Se anuncia sin que haya que ir a buscarla, y se puede cerrar.
  assert.match(canonico, /accessibilityLiveRegion="polite"/);
  assert.match(canonico, /accessibilityLabel="Cerrar esta confirmación"/);
  assert.match(canonico, /ENTENDIDO/);
});

// ---------------------------------------------------------------------------
// e) La raíz: las filas abren el perfil
// ---------------------------------------------------------------------------

test("cada fila de la raíz abre el perfil de SU persona", () => {
  const hub = sinComentarios(leer(HUB));
  const fila = bloque(hub, "PersonaRow");

  assert.match(fila, /router\.push\(relationshipProfileHref\(persona\.profileId\) as never\)/);
  assert.match(fila, /hint="Abre el perfil de esta persona, con sus datos y su comparación"/);
  // La tarjeta entera es el objetivo táctil y anuncia de quién es; editar y
  // definir el tipo viven FUERA, porque un botón adentro de otro botón no se
  // puede alcanzar con un lector de pantalla (QA22-023).
  const tarjeta = /<CardButton[\s\S]*?<\/CardButton>/.exec(fila)?.[0] ?? "";
  assert.ok(tarjeta.length > 0, "la tarjeta que abre el perfil existe");
  assert.match(tarjeta, /accessibilityLabel=\{`\$\{persona\.name\}\. \$\{nivel\}\.`\}/);
  assert.doesNotMatch(tarjeta, /EDITAR DATOS DE|RELATIONSHIP_TYPE_DEFINE_CTA/);
  // Y ninguna fila abre la comparación de un salto: son dos toques, y el del
  // medio es el que muestra de quién es la lectura que se va a calcular.
  assert.doesNotMatch(hub, /relationshipComparisonHref/);
});

// ---------------------------------------------------------------------------
// f) Accesibilidad de las superficies nuevas
// ---------------------------------------------------------------------------

test("las acciones del perfil se anuncian enteras y con objetivo táctil", () => {
  const source = sinComentarios(leer(PERFIL));
  const canonico = bloque(source, "PerfilCanonico");

  // Los rótulos en mayúsculas no alcanzan a decir qué hacen: cada acción declara
  // su etiqueta con el nombre de la persona y su pista con la consecuencia.
  assert.match(canonico, /accessibilityLabel=\{`Ver la comparación con \$\{nombre\}`\}/);
  assert.match(
    canonico,
    /accessibilityHint="Abre la comparación entre tu carta y la suya\. El cálculo empieza al abrirla\."/
  );
  assert.match(canonico, /accessibilityLabel=\{`Editar los datos de \$\{nombre\}`\}/);
  assert.match(canonico, /accessibilityHint="Abre su formulario con los datos que ya cargaste/);
  // Sin nombre guardado no se anuncia un hueco.
  assert.match(canonico, /const nombre = persona\.name\.trim\(\) \|\| "esta persona"/);

  // El CTA legacy y el cierre de la confirmación son botones de verdad, con el
  // alto mínimo del sistema.
  assert.match(canonico, /accessibilityRole="button"/);
  assert.match(canonico, /accessibilityLabel=\{relationshipTypeDefineVoice\(persona\.name\)\}/);
  assert.match(canonico, /accessibilityHint=\{RELATIONSHIP_TYPE_DEFINE_HINT\}/);
  for (const estilo of ["tipoDefinir", "confirmacionCerrar"]) {
    assert.match(
      source,
      new RegExp(`${estilo}: \\{[^}]*minHeight: v492\\.touch`, "s"),
      `${estilo} tiene que ser un objetivo táctil`
    );
  }

  // Ni un color ni un espaciado hardcodeado: todo sale de los tokens.
  const styles = /const styles = StyleSheet\.create\(\{[\s\S]*\}\);/.exec(source)?.[0] ?? "";
  assert.ok(styles.length > 0, "no se encontró la hoja de estilos");
  assert.doesNotMatch(styles, /#[0-9a-fA-F]{3,8}\b/, "no se hardcodean colores");
  assert.doesNotMatch(styles, /(?:margin|padding)[A-Za-z]*: \d/, "no se hardcodean espaciados");
});
