/**
 * El contrato de eventos de Órbita (v1.1.0) — `src/analytics/eventContract.ts`.
 *
 * Un diccionario de eventos que no se puede correr es una intención, no un
 * contrato: la manera de que un evento inválido no llegue nunca a producción es
 * que su rechazo esté escrito acá. Estos tests son la parte ejecutable de
 * `docs/analytics/event-contract.md`, y prueban las dos mitades:
 *
 *   · lo que el contrato ACEPTA — un evento válido de cada uno de los ocho;
 *   · lo que RECHAZA — nombre fuera del diccionario, propiedad común ausente,
 *     enum inválido, PII, ruta sin sanitizar y versión incompatible.
 *
 * La v1.1.0 suma el alta: los tres eventos nuevos, los once pasos atados a
 * `src/onboarding/steps.ts`, y el rechazo de un payload marcado `1.0.0`.
 *
 * Todo es puro: no hay red, no hay entorno y no hay SDK. El módulo bajo prueba
 * tampoco los tiene, y eso también se verifica.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import {
  ACQUISITION_SOURCES,
  CANONICAL_SECTIONS,
  COMMON_PROPERTIES,
  CONTRACT_VERSION,
  ENVIRONMENTS,
  EVENT_DEFINITIONS,
  EVENT_NAMES,
  IDENTITY_SOURCES,
  LEGACY_EVENT_NAMES,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_PROPERTIES,
  PAGEVIEW_PROPERTIES,
  PLATFORMS,
  REFERRER_CLASSES,
  RESET_TRIGGERS,
  ROUTE_TEMPLATES,
  SECTIONS,
  SURFACES,
  canAlias,
  canCapture,
  isSanitizedPath,
  isStableInternalIdentifier,
  isSupportedContractVersion,
  isValidEvent,
  matchRoutePath,
  normalizeAcquisitionSource,
  normalizeEnvironment,
  requiredPropertiesFor,
  requiresIdentityReset,
  validateEvent,
  type EventInput,
  type EventName,
  type ValidationIssueCode
} from "../src/analytics/eventContract";
// La fuente de los once pasos del alta, importada de verdad: el enum del
// contrato se ata al archivo real y no a una copia que envejece sola.
import * as PASOS_DEL_ALTA from "../src/onboarding/steps";
import { ROOT } from "./moduleGraph";

/** Propiedades comunes de un evento sano, con los reemplazos del caso. */
const comunes = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  environment: "production",
  platform: "web",
  surface: "app",
  section: "hoy",
  contract_version: CONTRACT_VERSION,
  ...extra
});

/** Un `$pageview` válido, que es el único con propiedades propias. */
const pageview = (extra: Record<string, unknown> = {}): EventInput => ({
  name: "$pageview",
  properties: comunes({ path: "/hoy", acquisition_source: "organic_search", ...extra })
});

const codigos = (input: EventInput): ValidationIssueCode[] =>
  validateEvent(input).issues.map((issue) => issue.code);

/** Un `onboarding_step_viewed` válido: adentro del alta, con su paso. */
const pasoVisto = (extra: Record<string, unknown> = {}): EventInput => ({
  name: "onboarding_step_viewed",
  properties: comunes({
    surface: "onboarding",
    section: "sin_seccion",
    onboarding_step: "auth",
    ...extra
  })
});

/** Los cinco de v1.0.0, que esta versión no toca. */
const EVENTOS_V1 = [
  "$pageview",
  "onboarding_completed",
  "paywall_viewed",
  "checkout_started",
  "purchase_completed"
] as const;

/** Los tres que agrega v1.1.0, los tres adentro del alta. */
const EVENTOS_DEL_ALTA = [
  "onboarding_step_viewed",
  "signup_submitted",
  "signup_completed"
] as const;

/** Un evento válido de cada uno de los ocho, con su superficie coherente. */
const VALIDOS: Readonly<Record<EventName, EventInput>> = {
  $pageview: pageview(),
  onboarding_completed: {
    name: "onboarding_completed",
    properties: comunes({ surface: "onboarding", section: "sin_seccion" })
  },
  paywall_viewed: {
    name: "paywall_viewed",
    properties: comunes({ surface: "paywall", section: "sin_seccion", platform: "ios" })
  },
  checkout_started: {
    name: "checkout_started",
    properties: comunes({ surface: "checkout", section: "sin_seccion" })
  },
  purchase_completed: {
    name: "purchase_completed",
    properties: comunes({ surface: "checkout", section: "sin_seccion", environment: "preview" })
  },
  onboarding_step_viewed: pasoVisto({ onboarding_step: "birthdate" }),
  signup_submitted: {
    name: "signup_submitted",
    properties: comunes({ surface: "onboarding", section: "sin_seccion", platform: "android" })
  },
  signup_completed: {
    name: "signup_completed",
    properties: comunes({ surface: "onboarding", section: "sin_seccion" })
  }
};

// --- 1. La lista cerrada ----------------------------------------------------

test("el diccionario v1.1.0 es EXACTAMENTE esos ocho eventos", () => {
  // Los cinco de v1.0.0 en su orden, y los tres del alta. Ni uno más: la lista
  // cerrada es lo que hace que un nombre inventado no sea un evento.
  assert.deepEqual(
    [...EVENT_NAMES],
    [
      "$pageview",
      "onboarding_completed",
      "paywall_viewed",
      "checkout_started",
      "purchase_completed",
      "onboarding_step_viewed",
      "signup_submitted",
      "signup_completed"
    ]
  );
  // La lista y las definiciones no pueden separarse: un evento documentado sin
  // definición (o al revés) es un agujero por donde entra cualquier cosa.
  assert.deepEqual(Object.keys(EVENT_DEFINITIONS).sort(), [...EVENT_NAMES].sort());
});

test("page_view NO está en el diccionario: es legado histórico, sólo lectura", () => {
  assert.ok(!(EVENT_NAMES as readonly string[]).includes("page_view"));
  assert.deepEqual([...LEGACY_EVENT_NAMES], ["page_view"]);
  // Y $pageview sí, porque es el único canónico de navegación.
  assert.ok((EVENT_NAMES as readonly string[]).includes("$pageview"));
});

test("cada evento fija disparador, no-disparador y propiedades obligatorias", () => {
  for (const name of EVENT_NAMES) {
    const def = EVENT_DEFINITIONS[name];
    assert.equal(def.name, name);
    for (const campo of [def.purpose, def.trigger, def.notTrigger]) {
      assert.ok(campo.length > 20, `${name}: ${campo} no explica nada`);
    }
    // Las cinco comunes están en todos, también en los tres del alta; sólo
    // $pageview y onboarding_step_viewed suman las suyas.
    for (const comun of COMMON_PROPERTIES) {
      assert.ok(def.requiredProperties.includes(comun), `${name} no exige ${comun}`);
    }
    const esperadas =
      name === "$pageview"
        ? [...COMMON_PROPERTIES, ...PAGEVIEW_PROPERTIES]
        : name === "onboarding_step_viewed"
          ? [...COMMON_PROPERTIES, ...ONBOARDING_STEP_PROPERTIES]
          : [...COMMON_PROPERTIES];
    assert.deepEqual([...def.requiredProperties], esperadas);
  }
});

test("el universo de propiedades del contrato son ocho, y ninguna es contenido natal", () => {
  const todas = new Set(EVENT_NAMES.flatMap((name) => [...requiredPropertiesFor(name)]));
  assert.deepEqual(
    [...todas].sort(),
    [
      "acquisition_source",
      "contract_version",
      "environment",
      "onboarding_step",
      "path",
      "platform",
      "section",
      "surface"
    ]
  );
  // Guardrail de producto: Órbita mide que una pantalla se vio, no qué dice la
  // carta de nadie.
  for (const natal of ["sun_sign", "moon_sign", "ascendant", "birth_date", "birth_place", "chart"]) {
    assert.ok(!todas.has(natal as never), `${natal} no puede ser propiedad de un evento`);
  }
});

// --- 2. Lo que el contrato acepta -------------------------------------------

test("un evento válido de cada uno de los ocho pasa", () => {
  for (const name of EVENT_NAMES) {
    const resultado = validateEvent(VALIDOS[name]);
    assert.deepEqual(resultado.issues, [], `${name} debería ser válido`);
    assert.equal(resultado.valid, true);
    assert.equal(isValidEvent(VALIDOS[name]), true);
  }
});

test("los tres entornos, las tres plataformas y las seis fuentes son aceptables", () => {
  for (const environment of ENVIRONMENTS) {
    assert.ok(isValidEvent(pageview({ environment })), environment);
  }
  for (const platform of PLATFORMS) {
    assert.ok(isValidEvent(pageview({ platform })), platform);
  }
  for (const acquisition_source of ACQUISITION_SOURCES) {
    assert.ok(isValidEvent(pageview({ acquisition_source })), acquisition_source);
  }
  for (const section of CANONICAL_SECTIONS) {
    assert.ok(isValidEvent(pageview({ surface: "app", section })), section);
  }
});

// --- 3. Nombre fuera del diccionario ----------------------------------------

test("un evento que no está en el diccionario se rechaza", () => {
  for (const name of ["carta_abierta", "pageview", "$pageleave", "purchase_completed ", ""]) {
    assert.deepEqual(codigos({ name, properties: comunes() }), ["unknown_event"], name);
  }
});

test("page_view se rechaza con su propio código: no se emite, se consulta", () => {
  const resultado = validateEvent({ name: "page_view", properties: comunes() });
  assert.equal(resultado.valid, false);
  assert.deepEqual(
    resultado.issues.map((i) => i.code),
    ["legacy_event"]
  );
  assert.match(resultado.issues[0].message, /legado/);
  assert.match(resultado.issues[0].message, /\$pageview/);
});

test("un nombre desconocido corta el análisis: el problema es el nombre", () => {
  // Sin definición no hay propiedades que exigir; listar quince faltantes
  // taparía el único problema real.
  assert.deepEqual(codigos({ name: "lo_que_sea", properties: {} }), ["unknown_event"]);
});

// --- 4. Propiedades comunes ausentes ----------------------------------------

test("falta cualquiera de las cinco propiedades comunes y el evento se rechaza", () => {
  for (const ausente of COMMON_PROPERTIES) {
    const properties = comunes();
    delete properties[ausente];
    const resultado = validateEvent({ name: "onboarding_completed", properties });
    assert.equal(resultado.valid, false, `sin ${ausente} debería fallar`);
    const faltante = resultado.issues.find((i) => i.code === "missing_property");
    assert.ok(faltante, `sin ${ausente} falta el missing_property`);
    assert.equal(faltante.property, ausente);
  }
});

test("$pageview sin path o sin acquisition_source se rechaza", () => {
  for (const ausente of PAGEVIEW_PROPERTIES) {
    const properties = comunes({ path: "/home", acquisition_source: "direct" });
    delete properties[ausente];
    const resultado = validateEvent({ name: "$pageview", properties });
    assert.equal(resultado.valid, false);
    assert.ok(
      resultado.issues.some((i) => i.code === "missing_property" && i.property === ausente),
      `falta el rechazo por ${ausente}`
    );
  }
});

test("un evento vacío falla por TODAS sus obligatorias, no por la primera", () => {
  const resultado = validateEvent({ name: "$pageview", properties: {} });
  assert.deepEqual(
    resultado.issues.map((i) => i.property).sort(),
    [...COMMON_PROPERTIES, ...PAGEVIEW_PROPERTIES].sort()
  );
});

// --- 5. Enums cerrados ------------------------------------------------------

test("un valor fuera del enum se rechaza en cada una de las cinco propiedades cerradas", () => {
  const invalidos: Array<[string, unknown]> = [
    ["environment", "staging"],
    ["environment", "prod"],
    ["platform", "windows"],
    ["surface", "home"],
    ["section", "perfil"],
    ["acquisition_source", "google.com"]
  ];
  for (const [property, valor] of invalidos) {
    const resultado = validateEvent(pageview({ [property]: valor }));
    assert.equal(resultado.valid, false, `${property}=${String(valor)} debería fallar`);
    assert.ok(
      resultado.issues.some((i) => i.code === "invalid_enum" && i.property === property),
      `${property}=${String(valor)} no dio invalid_enum`
    );
  }
});

test("perfil no es una sección: vive dentro de carta", () => {
  assert.ok(!(SECTIONS as readonly string[]).includes("perfil"));
  assert.ok((SECTIONS as readonly string[]).includes("carta"));
});

test("texto libre en una propiedad de enum es simplemente inválido", () => {
  for (const texto of ["Hoy, la sección principal", "", " ", "HOY", null, 42, undefined]) {
    assert.equal(isValidEvent(pageview({ section: texto })), false, String(texto));
  }
});

test("surface y section no pueden contradecirse", () => {
  // Una sección canónica sólo existe adentro del producto autenticado.
  const mezcla = validateEvent({
    name: "paywall_viewed",
    properties: comunes({ surface: "paywall", section: "carta" })
  });
  assert.ok(mezcla.issues.some((i) => i.code === "surface_section_mismatch"));

  // Y la app no puede decir que está fuera de la navegación.
  const app = validateEvent(pageview({ surface: "app", section: "sin_seccion" }));
  assert.ok(app.issues.some((i) => i.code === "surface_section_mismatch"));

  assert.ok(isValidEvent(pageview({ surface: "landing", section: "sin_seccion" })));
});

// --- 6. Versión del contrato ------------------------------------------------

test("una versión de contrato incompatible se rechaza", () => {
  for (const version of ["2.0.0", "1.2.0", "1.1.1", "1.0.0", "0.9.0", "1.1", "v1.1.0", "", 1, null]) {
    const resultado = validateEvent(pageview({ contract_version: version }));
    assert.equal(resultado.valid, false, `${String(version)} no debería pasar`);
    assert.ok(
      resultado.issues.some((i) => i.code === "unsupported_contract_version"),
      `${String(version)} no dio unsupported_contract_version`
    );
  }
});

test("el validador acepta exactamente la versión que implementa", () => {
  assert.equal(CONTRACT_VERSION, "1.1.0");
  assert.equal(isSupportedContractVersion("1.1.0"), true);
  // Una minor futura puede traer eventos que este código no conoce: aceptarla
  // sería afirmar algo que no se puede verificar.
  assert.equal(isSupportedContractVersion("1.2.0"), false);
  assert.equal(isSupportedContractVersion("1.1.1"), false);
  // Y la versión anterior tampoco: el emisor y el contrato viajan en el mismo
  // bundle, así que un 1.0.0 entrante es un despliegue incoherente, no un
  // cliente viejo. El caso completo está en la sección 15.
  assert.equal(isSupportedContractVersion("1.0.0"), false);
});

// --- 7. PII y allowlist -----------------------------------------------------

test("PII en las propiedades se rechaza: email, nombre y fecha de nacimiento", () => {
  const casos: Array<[string, unknown]> = [
    ["email", "lucas@example.com"],
    ["name", "Lucas Ramos"],
    ["birth_date", "1991-04-17"],
    ["birth_place", "Buenos Aires"],
    ["birth_time", "04:20"],
    ["sun_sign", "aries"],
    ["referrer", "https://www.google.com/search?q=orbita"],
    ["query", "?utm_source=ig"],
    ["ip", "200.1.2.3"]
  ];
  for (const [property, valor] of casos) {
    const resultado = validateEvent(pageview({ [property]: valor }));
    assert.equal(resultado.valid, false, `${property} debería rechazarse`);
    assert.ok(
      resultado.issues.some((i) => i.code === "pii_property" && i.property === property),
      `${property} no dio pii_property`
    );
  }
});

test("PII escondida en una propiedad de nombre inocente también se rechaza", () => {
  // La allowlist ya frena la propiedad; el escaneo del VALOR es el cinturón.
  for (const valor of ["alguien@example.com", "nació el 1991-04-17"]) {
    const resultado = validateEvent(pageview({ detalle: valor }));
    assert.ok(
      resultado.issues.some((i) => i.code === "pii_property" && i.property === "detalle"),
      `${valor} pasó sin ser detectada`
    );
  }
});

test("la allowlist es cerrada: una propiedad no declarada no entra", () => {
  const resultado = validateEvent(pageview({ experiment_variant: "b" }));
  assert.equal(resultado.valid, false);
  assert.ok(
    resultado.issues.some(
      (i) => i.code === "property_not_allowed" && i.property === "experiment_variant"
    )
  );
  // Y lo propio de $pageview no se cuela en los otros cuatro.
  assert.ok(
    validateEvent({
      name: "onboarding_completed",
      properties: comunes({ surface: "onboarding", section: "sin_seccion", path: "/home" })
    }).issues.some((i) => i.code === "property_not_allowed" && i.property === "path")
  );
});

// --- 8. Rutas: catálogo cerrado, no forma -----------------------------------

/**
 * Las rutas públicas derivadas del árbol del router, con sus mismas reglas:
 * los grupos `(tabs)` desaparecen de la URL, `index` es el padre, `[param]` es
 * `:param`, y los `_layout` / `+not-found` no son rutas.
 *
 * Se deriva acá, del árbol real, para que el catálogo del contrato no pueda
 * quedar viejo en silencio: una ruta nueva sin declarar rompe este test.
 */
const rutasDelRouter = (): string[] => {
  const base = join(ROOT, "app");
  const archivos: string[] = [];
  const recorrer = (dir: string): void => {
    for (const entrada of readdirSync(dir)) {
      const completo = join(dir, entrada);
      if (statSync(completo).isDirectory()) recorrer(completo);
      else archivos.push(completo);
    }
  };
  recorrer(base);

  const rutas = new Set<string>();
  for (const archivo of archivos) {
    const partes = relative(base, archivo).replace(/\.tsx?$/, "").split("/");
    if (partes.some((parte) => parte.startsWith("_") || parte.startsWith("+"))) continue;
    const segmentos = partes
      .filter((parte) => !/^\(.*\)$/.test(parte))
      .map((parte) => parte.replace(/^\[(\.\.\.)?(.+)\]$/, (_m, resto, nombre) => (resto ? "*" : ":") + nombre));
    if (segmentos[segmentos.length - 1] === "index") segmentos.pop();
    rutas.add("/" + segmentos.join("/"));
  }
  return [...rutas].sort();
};

/** Los tres casos exactos que la v1.0.0 dejaba pasar validando por forma. */
const SEGMENTOS_DINAMICOS_DISFRAZADOS = [
  "/perfil/nombrepersona",
  "/ciudad/lugarnatal",
  "/reading/identificadordinamico"
];

test("el catálogo de rutas es EXACTAMENTE el árbol del router", () => {
  // El origen confiable del catálogo es `app/**`, y esta igualdad es lo que lo
  // mantiene confiable: sin ella el catálogo envejece y alguien lo "arregla"
  // aflojando la validación, que es de dónde salió el agujero.
  assert.deepEqual([...ROUTE_TEMPLATES].sort(), rutasDelRouter());
});

test("cada plantilla del catálogo está bien formada y se acepta a sí misma", () => {
  for (const plantilla of ROUTE_TEMPLATES) {
    assert.ok(plantilla.startsWith("/"), `${plantilla} no arranca en /`);
    assert.doesNotMatch(plantilla, /[?#\s]|\/\/|\(|\)/, `${plantilla} trae ruido de URL`);
    if (plantilla !== "/") assert.ok(!plantilla.endsWith("/"), `${plantilla} termina en /`);
    for (const segmento of plantilla === "/" ? [] : plantilla.slice(1).split("/")) {
      assert.match(
        segmento,
        /^(:[a-z][a-zA-Z0-9]*|[a-z0-9]+(?:-[a-z0-9]+)*)$/,
        `${plantilla}: el segmento ${segmento} no es literal ni parámetro`
      );
    }
    assert.equal(isSanitizedPath(plantilla), true, `${plantilla} debería ser válida`);
    assert.equal(isValidEvent(pageview({ path: plantilla })), true, plantilla);
  }
});

test("un segmento dinámico resuelto NO es una ruta sanitizada", () => {
  // El rechazo de la revisión, tal cual: estas tres pasaban por ser minúsculas
  // con guiones, y llevaban adentro el nombre o el lugar de nacimiento de
  // alguien. La forma no las distingue de un slug legítimo; el catálogo sí.
  for (const path of SEGMENTOS_DINAMICOS_DISFRAZADOS) {
    assert.equal(isSanitizedPath(path), false, `${path} no debería pasar como sanitizada`);
    assert.ok(
      codigos(pageview({ path })).includes("unsanitized_path"),
      `${path} no dio unsanitized_path`
    );
  }
});

test("PII con forma de slug se rechaza en cualquier ruta, exista o no el prefijo", () => {
  // `/vinculos` y `/perfil` SÍ existen: lo que no existe es la ruta completa. Un
  // nombre propio en el segmento dinámico es exactamente el caso que importa,
  // porque el id de un vínculo es el de otra persona.
  for (const path of [
    "/vinculos/juan-perez",
    "/vinculos/maria-lopez/comparacion",
    "/perfil/lucas",
    "/perfil/carta/nombrepersona",
    "/ciudad/buenos-aires",
    "/reading/mi-carta-natal",
    "/hoy/alguien",
    "/transitos/arco/nombre-de-alguien"
  ]) {
    assert.equal(isSanitizedPath(path), false, `${path} no debería pasar como sanitizada`);
  }
});

test("un id crudo tampoco entra, en ninguno de sus formatos", () => {
  for (const path of [
    "/vinculos/42",
    "/vinculos/8f2c1a9b-4d5e-4f6a-9b8c-1d2e3f4a5b6c",
    "/vinculos/a1b2c3d4e5f6a7b8",
    "/vinculos/user_2abcDEF456ghiJKL",
    "/transitos/arco/7",
    "/reading/8f2c1a9b"
  ]) {
    assert.equal(isSanitizedPath(path), false, path);
  }
});

test("una plantilla inventada no es una plantilla: el parámetro no es un comodín", () => {
  // Escribir `:algo` no habilita nada por sí solo. Si la plantilla no está
  // declarada, no existe — si no, alcanzaría con inventar un nombre de
  // parámetro para colar cualquier prefijo.
  for (const path of [
    "/reading/:id",
    "/vinculo/:vinculoId/resultado",
    "/perfil/:nombre",
    "/vinculos/:otroParametro",
    "/:algo",
    "/vinculos/:profileId/:otro"
  ]) {
    assert.equal(isSanitizedPath(path), false, path);
  }
});

test("query, fragmento, barra y URL absoluta se rechazan por no estar en el catálogo", () => {
  const sucias = [
    "/home?utm_source=instagram",
    "/home#seccion",
    "/home/",
    "//home",
    "/home//hoy",
    "/perfil/alguien@example.com",
    "/perfil/alguien%40example.com",
    "https://orbitaastrologia.xyz/home",
    "orbitaastrologia.xyz/home",
    "home",
    "/HOME",
    "/Home",
    "/perfil/josé",
    "/perfil/../perfil/juan",
    "/mi ruta",
    " /home",
    "/home ",
    ""
  ];
  for (const path of sucias) {
    assert.equal(isSanitizedPath(path), false, `${path} no debería pasar como sanitizada`);
    const resultado = validateEvent(pageview({ path }));
    assert.equal(resultado.valid, false, `${path} debería rechazar el evento`);
    assert.ok(
      resultado.issues.some((i) => i.code === "unsanitized_path" || i.code === "pii_property"),
      `${path} no dio unsanitized_path`
    );
  }
});

test("path sólo acepta strings", () => {
  for (const valor of [null, undefined, 42, {}, ["/home"], true]) {
    assert.equal(isSanitizedPath(valor), false, String(valor));
  }
});

test("matchRoutePath devuelve SIEMPRE una plantilla del catálogo, o null", () => {
  // La propiedad que hace segura a la sanitización del borde: nada de lo que
  // entra puede salir. La salida pertenece al catálogo o no hay salida.
  const entradas = [
    "/",
    "/hoy",
    "/vinculos/juan-perez",
    "/vinculos/8f2c1a9b-4d5e-4f6a-9b8c-1d2e3f4a5b6c",
    "/vinculos/alguien@example.com/comparacion",
    "/transitos/arco/1991-04-17",
    "/transitos/capa/Lucas%20Ramos",
    "/perfil/nombrepersona",
    "/ciudad/lugarnatal",
    "/home?utm_source=x",
    "/home#seccion",
    "https://orbitaastrologia.xyz/home",
    "",
    null,
    42
  ];
  for (const entrada of entradas) {
    const plantilla = matchRoutePath(entrada);
    if (plantilla === null) continue;
    assert.equal(isSanitizedPath(plantilla), true, `${String(entrada)} -> ${plantilla}`);
    assert.ok(
      (ROUTE_TEMPLATES as readonly string[]).includes(plantilla),
      `${String(entrada)} -> ${plantilla} no está en el catálogo`
    );
  }
});

test("matchRoutePath no deja sobrevivir el valor del segmento dinámico", () => {
  // [ruta real, plantilla esperada, el valor que NO puede quedar en la salida]
  const casos: Array<[string, string, string]> = [
    ["/vinculos/juan-perez", "/vinculos/:profileId", "juan-perez"],
    ["/vinculos/maria-lopez/comparacion", "/vinculos/:profileId/comparacion", "maria-lopez"],
    [
      "/vinculos/8f2c1a9b-4d5e-4f6a-9b8c-1d2e3f4a5b6c",
      "/vinculos/:profileId",
      "8f2c1a9b-4d5e-4f6a-9b8c-1d2e3f4a5b6c"
    ],
    ["/transitos/arco/nombre-de-alguien", "/transitos/arco/:arcId", "nombre-de-alguien"],
    ["/transitos/capa/1991-04-17", "/transitos/capa/:layer", "1991-04-17"]
  ];
  for (const [crudo, esperado, valor] of casos) {
    const plantilla = matchRoutePath(crudo);
    assert.equal(plantilla, esperado, crudo);
    assert.ok(!String(plantilla).includes(valor), `${valor} sobrevivió a la llamada`);
  }
});

test("matchRoutePath prefiere el literal al parámetro", () => {
  // `/vinculos/conectar` es una pantalla, no un vínculo que se llama "conectar".
  assert.equal(matchRoutePath("/vinculos/conectar"), "/vinculos/conectar");
  assert.equal(matchRoutePath("/vinculos/otra-cosa"), "/vinculos/:profileId");
  assert.equal(matchRoutePath("/perfil/carta/completa"), "/perfil/carta/completa");
});

test("matchRoutePath devuelve null para lo que no es una ruta del producto", () => {
  for (const entrada of [
    "/perfil/nombrepersona",
    "/ciudad/lugarnatal",
    "/reading/identificadordinamico",
    "/vinculos/juan/perez/extra",
    "/home?utm_source=x",
    "/home#seccion",
    "//home",
    "/mi ruta",
    "https://orbitaastrologia.xyz/home",
    "home",
    "",
    null,
    undefined,
    42,
    {},
    ["/home"]
  ]) {
    assert.equal(matchRoutePath(entrada), null, String(entrada));
  }
});

test("matchRoutePath tolera la barra final, que es la misma ruta", () => {
  assert.equal(matchRoutePath("/"), "/");
  assert.equal(matchRoutePath("/hoy/"), "/hoy");
  assert.equal(matchRoutePath("/vinculos/juan-perez/"), "/vinculos/:profileId");
});

// --- 9. Adquisición sin URL -------------------------------------------------

test("la fuente de adquisición sale de una clase de referrer, no de una URL", () => {
  assert.deepEqual(
    REFERRER_CLASSES.map(normalizeAcquisitionSource),
    ["direct", "direct", "organic_search", "social", "referral", "paid", "unknown"]
  );
  // Toda salida pertenece al enum cerrado.
  for (const clase of REFERRER_CLASSES) {
    assert.ok((ACQUISITION_SOURCES as readonly string[]).includes(normalizeAcquisitionSource(clase)));
  }
});

test("si alguien pasa el referrer crudo, no sobrevive a la llamada", () => {
  for (const crudo of [
    "https://www.google.com/search?q=orbita+astrologia",
    "https://instagram.com/",
    "google",
    "",
    null,
    undefined,
    { host: "google.com" }
  ]) {
    assert.equal(normalizeAcquisitionSource(crudo), "unknown", String(crudo));
  }
});

// --- 10. El entorno sale del scope ------------------------------------------

test("environment no se infiere del hostname ni del proyecto", () => {
  for (const environment of ENVIRONMENTS) {
    assert.equal(normalizeEnvironment(environment), environment);
  }
  for (const impostor of [
    "orbitaastrologia.xyz",
    "orbita-git-main.vercel.app",
    "localhost",
    "517300",
    "592867",
    "main",
    null
  ]) {
    assert.equal(normalizeEnvironment(impostor), null, String(impostor));
  }
});

// --- 11. Identidad: origen declarado, no heurística de texto ----------------

/** Un id de cuenta con la forma que emite el proveedor de identidad. */
const CUENTA = { source: "account", value: "user_2abcDEF456ghiJKLmnoPQR789st" } as const;
const OTRA_CUENTA = { source: "account", value: "user_2zzzYYYxxxWWWvvvUUUtttSSS12" } as const;
/** Un id de instalación: UUID v4 canónico, sorteado por la app. */
const INSTALACION = { source: "installation", value: "8f2c1a9b-4d5e-4f6a-9b8c-1d2e3f4a5b6c" } as const;
const OTRA_INSTALACION = {
  source: "installation",
  value: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
} as const;

test("la frontera de identidad son dos orígenes declarados y nada más", () => {
  assert.deepEqual([...IDENTITY_SOURCES], ["account", "installation"]);
});

test("identify acepta un identificador con origen declarado y formato del emisor", () => {
  assert.equal(isStableInternalIdentifier(CUENTA), true);
  assert.equal(isStableInternalIdentifier(INSTALACION), true);
  // 24–32 caracteres para la cuenta: Clerk emite 27.
  assert.equal(isStableInternalIdentifier({ source: "account", value: "user_" + "a".repeat(27) }), true);
  assert.equal(isStableInternalIdentifier({ source: "account", value: "user_" + "a".repeat(24) }), true);
  assert.equal(isStableInternalIdentifier({ source: "account", value: "user_" + "a".repeat(32) }), true);
});

test("un nombre y un lugar de nacimiento NO son identificadores estables", () => {
  // El rechazo de la revisión: la v1.0.0 aceptaba estos dos como cadenas
  // "opacas" y `canAlias` los habilitaba. No se rechazan por parecer PII —
  // ninguna regla de texto puede decidir eso— sino por no tener el formato del
  // emisor que dicen tener, y por no declarar ninguno cuando viajan sueltos.
  for (const nombre of ["NombreApellido", "LugarNatal"]) {
    assert.equal(isStableInternalIdentifier(nombre), false, nombre);
    for (const source of IDENTITY_SOURCES) {
      assert.equal(isStableInternalIdentifier({ source, value: nombre }), false, `${source}/${nombre}`);
    }
  }
});

test("una cadena suelta no es un identificador, por más pinta que tenga", () => {
  // Sin origen declarado no hay nada que verificar. Incluso el valor correcto
  // de una cuenta real se rechaza si llega sin decir de dónde salió.
  for (const suelto of [
    CUENTA.value,
    INSTALACION.value,
    "user_2abcDEF456ghiJKL",
    "k57d9c8b1a2f3e4d5c6b7a8",
    "NombreApellido",
    "lucas@example.com",
    ""
  ]) {
    assert.equal(isStableInternalIdentifier(suelto), false, suelto);
  }
});

test("PII declarada como identificador se rechaza por el formato, no por el texto", () => {
  const pii = [
    "lucas@example.com",
    "Lucas Ramos",
    "Lucas Ramos Buenos Aires 1991",
    "1991-04-17",
    "Buenos Aires, Argentina",
    "LugarNatalDeUnaPersonaLarguisimo",
    "+54 9 11 5555 5555",
    "corto",
    "",
    "   "
  ];
  for (const source of IDENTITY_SOURCES) {
    for (const valor of pii) {
      assert.equal(isStableInternalIdentifier({ source, value: valor }), false, `${source}/${valor}`);
    }
  }
});

test("el formato de un origen no vale para el otro", () => {
  assert.equal(isStableInternalIdentifier({ source: "account", value: INSTALACION.value }), false);
  assert.equal(isStableInternalIdentifier({ source: "installation", value: CUENTA.value }), false);
});

test("la cuenta exige el prefijo del emisor y su largo", () => {
  for (const valor of [
    "2abcDEF456ghiJKLmnoPQR789st",
    "usuario_2abcDEF456ghiJKLmnoPQR",
    "user_2abcDEF456ghiJKL",
    "user_" + "a".repeat(23),
    "user_" + "a".repeat(33),
    "user_2abcDEF456ghiJKLmnoPQR-89st",
    "user_2abcDEF456ghiJKLmnoPQR.89st",
    " user_2abcDEF456ghiJKLmnoPQR789st",
    "user_2abcDEF456ghiJKLmnoPQR789st "
  ]) {
    assert.equal(isStableInternalIdentifier({ source: "account", value: valor }), false, valor);
  }
});

test("la instalación exige un UUID v4 canónico, con versión y variante", () => {
  for (const valor of [
    "8f2c1a9b-4d5e-1f6a-9b8c-1d2e3f4a5b6c", // versión 1
    "8f2c1a9b-4d5e-4f6a-7b8c-1d2e3f4a5b6c", // variante fuera de [89ab]
    "8F2C1A9B-4D5E-4F6A-9B8C-1D2E3F4A5B6C", // mayúsculas
    "8f2c1a9b4d5e4f6a9b8c1d2e3f4a5b6c", // sin guiones
    "8f2c1a9b-4d5e-4f6a-9b8c-1d2e3f4a5b6", // corto
    "{8f2c1a9b-4d5e-4f6a-9b8c-1d2e3f4a5b6c}",
    "urn:uuid:8f2c1a9b-4d5e-4f6a-9b8c-1d2e3f4a5b6c"
  ]) {
    assert.equal(isStableInternalIdentifier({ source: "installation", value: valor }), false, valor);
  }
});

test("un origen que no está en el catálogo no habilita nada", () => {
  for (const source of ["clerk", "email", "device", "user", "", null, undefined, 42]) {
    assert.equal(isStableInternalIdentifier({ source, value: CUENTA.value }), false, String(source));
  }
});

test("un identificador es un par, no cualquier cosa", () => {
  for (const valor of [
    null,
    undefined,
    42,
    "account",
    [CUENTA],
    {},
    { source: "account" },
    { value: CUENTA.value },
    { source: "account", value: null },
    { source: "account", value: 42 },
    { source: ["account"], value: CUENTA.value }
  ]) {
    assert.equal(isStableInternalIdentifier(valor), false, String(valor));
  }
});

test("alias sólo cruza orígenes: la instalación anónima con la cuenta", () => {
  assert.equal(canAlias({ current: INSTALACION, incoming: CUENTA }), true);
  assert.equal(canAlias({ current: CUENTA, incoming: INSTALACION }), true);
});

test("alias NUNCA une dos identificadores del mismo origen: eso fusiona personas", () => {
  // Dos cuentas son dos personas, y dos instalaciones son dos aparatos. Unirlas
  // no vincula nada: mezcla dos perfiles en uno y no hay forma de deshacerlo.
  assert.equal(canAlias({ current: CUENTA, incoming: OTRA_CUENTA }), false);
  assert.equal(canAlias({ current: INSTALACION, incoming: OTRA_INSTALACION }), false);
  assert.equal(canAlias({ current: CUENTA, incoming: CUENTA }), false);
});

test("alias no se habilita con PII ni con identificadores inválidos", () => {
  // El caso exacto del rechazo: con la heurística vieja, dos nombres propios
  // habilitaban un alias.
  assert.equal(
    canAlias({
      current: { source: "account", value: "NombreApellido" },
      incoming: { source: "installation", value: "LugarNatal" }
    }),
    false
  );
  assert.equal(canAlias({ current: "NombreApellido", incoming: "LugarNatal" }), false);
  assert.equal(canAlias({ current: INSTALACION, incoming: "lucas@example.com" }), false);
  assert.equal(canAlias({ current: null, incoming: CUENTA }), false);
  assert.equal(canAlias({ current: CUENTA, incoming: undefined }), false);
  assert.equal(
    canAlias({ current: INSTALACION, incoming: { source: "account", value: "user_corto" } }),
    false
  );
});

test("reset es obligatorio en logout, cambio de cuenta, eliminación y retiro", () => {
  assert.deepEqual(
    [...RESET_TRIGGERS],
    ["logout", "account_switch", "account_deletion", "consent_withdrawn"]
  );
  for (const trigger of RESET_TRIGGERS) {
    assert.equal(requiresIdentityReset(trigger), true, trigger);
  }
  for (const otro of ["app_start", "navigation", "purchase_completed", "", null]) {
    assert.equal(requiresIdentityReset(otro), false, String(otro));
  }
});

// --- 12. Consentimiento -----------------------------------------------------

test("no hay captura antes del consentimiento aplicable", () => {
  assert.equal(canCapture("granted"), true);
  // "Todavía no contestó" es un no.
  for (const estado of ["denied", "withdrawn", "unknown", "", null, undefined, true]) {
    assert.equal(canCapture(estado), false, String(estado));
  }
});

// --- 13. El módulo es puro --------------------------------------------------

const FUENTE = readFileSync(join(ROOT, "src/analytics/eventContract.ts"), "utf8");
const CODIGO = FUENTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("el diccionario no importa NADA: ni React, ni expo, ni el SDK, ni Convex", () => {
  // Un contrato que arrastra el runtime de la app no se puede testear sin
  // montarla, y termina siendo una capa de captura disfrazada de documento.
  assert.doesNotMatch(CODIGO, /^\s*import\s/m, "el módulo no debe importar nada");
  assert.doesNotMatch(CODIGO, /\bfrom\s+["']/);
  assert.doesNotMatch(CODIGO, /\brequire\s*\(/);
  assert.doesNotMatch(CODIGO, /\b(react|expo|posthog|convex)\b/i);
});

test("el diccionario no lee el entorno ni el reloj: es una función de sus argumentos", () => {
  for (const impureza of [/process\.env/, /globalThis/, /window\./, /Date\.now/, /Math\.random/]) {
    assert.doesNotMatch(CODIGO, impureza, `${impureza} rompe la pureza del contrato`);
  }
});

// --- 14. El documento y el código no se separan -----------------------------

const DOC = readFileSync(join(ROOT, "docs/analytics/event-contract.md"), "utf8");

/** Una sección del documento, con el salto de línea del wrap colapsado. */
const seccion = (desde: string, hasta?: string): string => {
  const inicio = DOC.indexOf(desde);
  assert.ok(inicio >= 0, `el documento no tiene la sección ${desde}`);
  const fin = hasta === undefined ? DOC.length : DOC.indexOf(hasta);
  return DOC.slice(inicio, fin).replace(/[ \t]*\n[ \t]*/g, " ").replace(/ {2,}/g, " ");
};

test("el documento declara la misma versión que el código", () => {
  assert.match(DOC, new RegExp(`# Contrato de eventos de Órbita — v${CONTRACT_VERSION}`));
});

test("el documento describe EXACTAMENTE los ocho eventos del diccionario", () => {
  const documentados = [...DOC.matchAll(/^### `([^`]+)`$/gm)].map((m) => m[1]);
  assert.deepEqual(documentados, [...EVENT_NAMES]);
});

test("el documento explica page_view como legado excluido", () => {
  const legado = seccion("## 4.", "## 5.");
  assert.match(legado, /legado excluido/);
  for (const regla of ["no se migra", "no se borra", "no se reetiqueta", "no hay doble emisión"]) {
    assert.ok(legado.includes(regla), `falta la regla: ${regla}`);
  }
});

test("cada literal cerrado del código aparece en el documento", () => {
  const literales = [
    ...ENVIRONMENTS,
    ...PLATFORMS,
    ...SURFACES,
    ...SECTIONS,
    ...ACQUISITION_SOURCES,
    ...ONBOARDING_STEPS,
    ...COMMON_PROPERTIES,
    ...PAGEVIEW_PROPERTIES,
    ...ONBOARDING_STEP_PROPERTIES
  ];
  for (const literal of literales) {
    assert.ok(DOC.includes(`\`${literal}\``), `el documento no enumera ${literal}`);
  }
});

test("el documento deja escrito el mapa de métricas para CORE-190", () => {
  const metricas = seccion("## 6.", "## 7.");
  assert.match(metricas, /CORE-190/);
  assert.match(metricas, /Activación[^|]*\| `onboarding_completed`/);
  assert.match(metricas, /Conversión.*paywall_viewed.*checkout_started.*purchase_completed/);
  assert.match(metricas, /Retención.*\$pageview/);
  assert.match(metricas, /Adquisición.*acquisition_source/);
  // v1.1.0: el alta, y el embudo entero encadenado con los cinco viejos.
  assert.match(metricas, /Alta paso a paso[^|]*\| `onboarding_step_viewed`/);
  assert.match(metricas, /Registro.*`signup_submitted` → `signup_completed`/);
  assert.match(
    metricas,
    /onboarding_step_viewed.*signup_submitted.*signup_completed.*onboarding_completed.*paywall_viewed.*checkout_started.*purchase_completed/
  );
});

test("el documento hereda la separación de proyectos de CORE-182 sin invertirla", () => {
  const proyectos = seccion("## 9.", "## 10.");
  assert.match(proyectos, /CORE-182/);
  assert.match(proyectos, /`production` \| `517300`/);
  assert.match(proyectos, /`preview` \| `592867`/);
  assert.match(proyectos, /`development` \| `592867`/);
  // El entorno lo define el contrato: el proyecto es el destino, no la fuente.
  assert.match(proyectos, /no se infiere el entorno a partir del proyecto/);
});

test("el documento fija la regla de evolución", () => {
  const evolucion = seccion("## 10.");
  for (const regla of [
    /Agregar un evento compatible \| \*\*minor\*\*/,
    /aclaración que no cambia el comportamiento \| \*\*patch\*\*/,
    /Renombrar un evento o una propiedad \| \*\*major\*\*/,
    /Eliminar un evento o una propiedad \| \*\*major\*\*/,
    /Volver obligatoria una propiedad que no lo era \| \*\*major\*\*/,
    /deprecación es \*\*explícita\*\*/,
    /ventana de consulta/
  ]) {
    assert.match(evolucion, regla);
  }
});

test("el documento declara el catálogo de rutas, su origen y su precio", () => {
  const rutas = seccion("### `path`:", "### `acquisition_source`");
  assert.match(rutas, /catálogo cerrado, no por forma/);
  assert.match(rutas, /`ROUTE_TEMPLATES`/);
  assert.match(rutas, /`app\/\*\*`/);
  assert.match(rutas, /`matchRoutePath`/);
  // El precio de un catálogo se documenta o se paga por sorpresa.
  assert.match(rutas, /agregar una ruta es un\s+cambio de contrato/i);
  assert.match(seccion("## 10."), /Agregar una ruta al catálogo de `path` \| \*\*minor\*\*/);
});

test("los ejemplos de ruta del documento son verdaderos", () => {
  // Un documento con ejemplos que el código no cumple es peor que no tenerlos:
  // se leen como permiso.
  const validas = [
    "/",
    "/home",
    "/hoy",
    "/reading/carta-completa",
    "/checkout/success",
    "/iniciar-sesion",
    "/vinculos/:profileId",
    "/transitos/arco/:arcId"
  ];
  const rechazadas = [
    "/home?utm_source=x",
    "/home#seccion",
    "/vinculos/42",
    "/vinculos/8f2c1a9b-4d5e-4f6a-9b8c-1d2e3f4a5b6c",
    "/perfil/nombrepersona",
    "/ciudad/lugarnatal",
    "/reading/identificadordinamico",
    "https://orbitaastrologia.xyz/home",
    "/home/"
  ];
  for (const path of validas) {
    assert.equal(isSanitizedPath(path), true, `${path} está en el documento como válida`);
    assert.ok(DOC.includes(`\`${path}\``), `el documento no muestra ${path}`);
  }
  for (const path of rechazadas) {
    assert.equal(isSanitizedPath(path), false, `${path} está en el documento como rechazada`);
    assert.ok(DOC.includes(`\`${path}\``), `el documento no muestra ${path}`);
  }
});

test("el documento declara los dos orígenes de identidad y sus formatos", () => {
  const identidad = seccion("## 7.", "## 8.");
  for (const source of IDENTITY_SOURCES) {
    assert.ok(identidad.includes(`\`${source}\``), `el documento no declara el origen ${source}`);
  }
  // Origen confiable y formato admitido, los dos por escrito.
  assert.match(identidad, /Clerk/);
  assert.match(identidad, /`clerkUserId`/);
  assert.match(identidad, /UUID v4/);
  assert.match(identidad, /origen declarado/);
  // Y lo que el contrato NO puede verificar, dicho como obligación de quien llama.
  assert.match(identidad, /obligación de quien\s+llama/);
  assert.match(identidad, /NombreApellido/);
});

test("el documento explica que alias sólo cruza orígenes", () => {
  const identidad = seccion("## 7.", "## 8.");
  assert.match(identidad, /alias.*sólo cruza orígenes/i);
  assert.match(identidad, /mismo.*origen son dos sujetos distintos/i);
  assert.match(seccion("## 10."), /Agregar un origen a la frontera de identidad \| \*\*minor\*\*/);
  assert.match(
    seccion("## 10."),
    /Sacar una ruta del catálogo o un origen de identidad \| \*\*major\*\*/
  );
});

// --- 15. El alta paso a paso: lo que agrega v1.1.0 --------------------------

test("el enum de pasos es EXACTAMENTE los once del alta, en su orden", () => {
  assert.deepEqual(
    [...ONBOARDING_STEPS],
    [
      "auth",
      "promise",
      "identity",
      "guidance",
      "birthdate",
      "birthplace",
      "birthtime",
      "summary",
      "triad",
      "before_after",
      "paywall"
    ]
  );
});

test("los once pasos son los de src/onboarding/steps.ts, en orden y con su nombre", () => {
  // Atado al archivo real del flujo, no a una copia: una copia queda vieja en
  // silencio, y un paso que se reordena sin que nadie se entere es exactamente
  // el dato mal leído que el enum por nombre evita.
  const indices = PASOS_DEL_ALTA as unknown as Record<string, number>;
  assert.equal(ONBOARDING_STEPS.length, PASOS_DEL_ALTA.ONBOARDING_TOTAL);
  ONBOARDING_STEPS.forEach((paso, i) => {
    assert.equal(indices[`STEP_${paso.toUpperCase()}`], i, `${paso} no es el paso ${i} del flujo`);
  });
  // Y al revés: ningún paso del flujo se queda afuera del contrato.
  assert.deepEqual(
    Object.keys(indices)
      .filter((clave) => clave.startsWith("STEP_"))
      .sort(),
    ONBOARDING_STEPS.map((paso) => `STEP_${paso.toUpperCase()}`).sort()
  );
});

test("los tres eventos del alta, emitidos como corresponde, pasan", () => {
  for (const name of EVENTOS_DEL_ALTA) {
    assert.deepEqual(validateEvent(VALIDOS[name]).issues, [], `${name} debería ser válido`);
    assert.equal(isValidEvent(VALIDOS[name]), true, name);
  }
});

test("los cinco de v1.0.0 siguen siendo válidos con la versión nueva", () => {
  // Una minor no puede invalidar lo que ya se emitía: lo único que cambia en
  // ellos es el número que viaja en `contract_version`.
  for (const name of EVENTOS_V1) {
    assert.deepEqual(validateEvent(VALIDOS[name]).issues, [], name);
    assert.equal(VALIDOS[name].properties.contract_version, "1.1.0");
  }
});

test("los once pasos se aceptan como valor de onboarding_step", () => {
  for (const onboarding_step of ONBOARDING_STEPS) {
    assert.equal(isValidEvent(pasoVisto({ onboarding_step })), true, onboarding_step);
  }
});

test("onboarding_step_viewed sin onboarding_step se rechaza", () => {
  // Sin el paso, el evento dice "alguien vio algo del alta" y no se puede leer.
  const resultado = validateEvent({
    name: "onboarding_step_viewed",
    properties: comunes({ surface: "onboarding", section: "sin_seccion" })
  });
  assert.equal(resultado.valid, false);
  assert.ok(
    resultado.issues.some((i) => i.code === "missing_property" && i.property === "onboarding_step")
  );
});

test("un paso fuera del enum se rechaza: ni el índice, ni texto libre", () => {
  // El índice es el caso que importa: hoy `4` es birthdate y mañana, si el
  // flujo se reordena, es otra pantalla — y la serie vieja quedaría mal leída.
  for (const valor of [
    0,
    4,
    "0",
    "4",
    "paso 4",
    "AUTH",
    "auth ",
    "fecha de nacimiento",
    "birth_date",
    "onboarding",
    "",
    null,
    undefined,
    true,
    ["auth"]
  ]) {
    const resultado = validateEvent(pasoVisto({ onboarding_step: valor }));
    assert.equal(resultado.valid, false, String(valor));
    assert.ok(
      resultado.issues.some((i) => i.code === "invalid_enum" && i.property === "onboarding_step"),
      `${String(valor)} no dio invalid_enum`
    );
  }
});

test("onboarding_step es EXCLUSIVA de onboarding_step_viewed", () => {
  // En cualquier otro evento no está declarada, y la allowlist la rechaza: el
  // mismo hecho contado dos veces desde dos lugares no es un dato, es ruido.
  for (const name of EVENT_NAMES) {
    if (name === "onboarding_step_viewed") continue;
    const resultado = validateEvent({
      name,
      properties: { ...VALIDOS[name].properties, onboarding_step: "auth" }
    });
    assert.equal(resultado.valid, false, name);
    assert.ok(
      resultado.issues.some(
        (i) => i.code === "property_not_allowed" && i.property === "onboarding_step"
      ),
      `${name} aceptó onboarding_step`
    );
  }
});

test("PII en los tres eventos del alta se rechaza, esté en el nombre o en el valor", () => {
  // El alta es justo donde la persona escribe su email, su nombre y sus datos
  // natales. Ninguno de los tres eventos los lleva: el paso se identifica por
  // su nombre, no por lo que se cargó en él.
  const casos: Array<[string, unknown]> = [
    ["email", "lucas@example.com"],
    ["name", "Lucas Ramos"],
    ["birth_date", "1991-04-17"],
    ["birth_place", "Buenos Aires"],
    ["birth_time", "04:20"],
    ["ciudad", "Buenos Aires"],
    ["detalle", "alguien@example.com"],
    ["detalle", "nació el 1991-04-17"]
  ];
  for (const name of EVENTOS_DEL_ALTA) {
    for (const [property, valor] of casos) {
      const resultado = validateEvent({
        name,
        properties: { ...VALIDOS[name].properties, [property]: valor }
      });
      assert.equal(resultado.valid, false, `${name}/${property}`);
      assert.ok(
        resultado.issues.some((i) => i.code === "pii_property" && i.property === property),
        `${name}/${property} no dio pii_property`
      );
    }
  }
});

test("los tres eventos del alta sólo salen del alta, y ahí no hay sección", () => {
  for (const name of EVENTOS_DEL_ALTA) {
    const base = VALIDOS[name].properties;
    for (const surface of SURFACES) {
      if (surface === "onboarding") continue;
      const resultado = validateEvent({ name, properties: { ...base, surface } });
      assert.equal(resultado.valid, false, `${name} desde ${surface}`);
      assert.ok(
        resultado.issues.some((i) => i.code === "unexpected_surface" && i.property === "surface"),
        `${name} desde ${surface} no dio unexpected_surface`
      );
    }
    // La superficie del alta vive fuera de la navegación canónica, así que
    // cualquiera de las cinco secciones reales es una contradicción medida.
    for (const section of CANONICAL_SECTIONS) {
      const resultado = validateEvent({ name, properties: { ...base, section } });
      assert.equal(resultado.valid, false, `${name} en ${section}`);
      assert.ok(
        resultado.issues.some((i) => i.code === "surface_section_mismatch"),
        `${name} en ${section} no dio surface_section_mismatch`
      );
    }
  }
});

test("los tres del alta declaran su superficie; los cinco de v1.0.0 no", () => {
  // La asimetría es a propósito: fijarles la superficie a los cinco viejos
  // sería volver obligatorio algo que no lo era, y eso es un major.
  for (const name of EVENTOS_DEL_ALTA) {
    assert.equal(EVENT_DEFINITIONS[name].surface, "onboarding", name);
  }
  for (const name of EVENTOS_V1) {
    assert.equal(EVENT_DEFINITIONS[name].surface, undefined, name);
  }
});

test("un evento marcado 1.0.0 se rechaza, sea cual sea el evento", () => {
  // El emisor y el contrato viajan en el mismo bundle: una versión vieja en el
  // payload es un despliegue incoherente, no un cliente al que haya que
  // tenerle paciencia. Aceptarlo mezclaría dos diccionarios en la misma serie.
  for (const name of EVENT_NAMES) {
    const resultado = validateEvent({
      name,
      properties: { ...VALIDOS[name].properties, contract_version: "1.0.0" }
    });
    assert.equal(resultado.valid, false, name);
    assert.ok(
      resultado.issues.some(
        (i) => i.code === "unsupported_contract_version" && i.property === "contract_version"
      ),
      `${name} aceptó un payload v1.0.0`
    );
  }
});

test("el documento describe los tres eventos del alta con su no-disparador", () => {
  const alta = seccion("### `onboarding_step_viewed`", "### Por qué");
  for (const evento of EVENTOS_DEL_ALTA) {
    assert.ok(alta.includes(`\`${evento}\``), `el documento no describe ${evento}`);
  }
  // El no-disparador es la mitad que evita que un evento se estire solo.
  assert.match(alta, /No dispara:\*\* un re-render; volver atrás a un paso ya contado/);
  assert.match(alta, /No dispara:\*\* abrir la pantalla; escribir sin enviar/);
  assert.match(alta, /No dispara:\*\* un alta que falla/);
  // Y la superficie declarada, con la razón de que los viejos no la declaren.
  assert.match(alta, /sólo salen con `surface: onboarding`/);
  assert.match(alta, /volver obligatorio algo que no lo era/);
});

test("el documento declara los once pasos, y por qué el nombre y no el índice", () => {
  const pasos = seccion("### `onboarding_step`:", "## 6.");
  for (const paso of ONBOARDING_STEPS) {
    assert.ok(pasos.includes(`\`${paso}\``), `el documento no enumera el paso ${paso}`);
  }
  assert.match(pasos, /`src\/onboarding\/steps\.ts`/);
  assert.match(pasos, /Nunca el índice numérico, y nunca texto libre/);
  assert.match(pasos, /el dato viejo quedaría mal leído/);
  assert.match(pasos, /\*\*exclusiva\*\* de `onboarding_step_viewed`/);
});

test("el documento explica qué pasa con un evento marcado 1.0.0", () => {
  const evolucion = seccion("## 10.");
  assert.match(evolucion, /El validador acepta \*\*exactamente\*\* `1\.1\.0`/);
  assert.match(evolucion, /llega marcado `1\.0\.0` \*\*se rechaza\*\*/);
  assert.match(evolucion, /viajan en el mismo bundle/);
  // La minor queda fechada, como toda decisión de este documento.
  assert.match(evolucion, /### v1\.1\.0 — 2026-09-08/);
});
