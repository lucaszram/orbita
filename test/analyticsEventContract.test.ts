/**
 * El contrato de eventos de Órbita (v1.0.0) — `src/analytics/eventContract.ts`.
 *
 * Un diccionario de eventos que no se puede correr es una intención, no un
 * contrato: la manera de que un evento inválido no llegue nunca a producción es
 * que su rechazo esté escrito acá. Estos tests son la parte ejecutable de
 * `docs/analytics/event-contract.md`, y prueban las dos mitades:
 *
 *   · lo que el contrato ACEPTA — un evento válido de cada uno de los cinco;
 *   · lo que RECHAZA — nombre fuera del diccionario, propiedad común ausente,
 *     enum inválido, PII, ruta sin sanitizar y versión incompatible.
 *
 * Todo es puro: no hay red, no hay entorno y no hay SDK. El módulo bajo prueba
 * tampoco los tiene, y eso también se verifica.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ACQUISITION_SOURCES,
  CANONICAL_SECTIONS,
  COMMON_PROPERTIES,
  CONTRACT_VERSION,
  ENVIRONMENTS,
  EVENT_DEFINITIONS,
  EVENT_NAMES,
  LEGACY_EVENT_NAMES,
  PAGEVIEW_PROPERTIES,
  PLATFORMS,
  REFERRER_CLASSES,
  RESET_TRIGGERS,
  SECTIONS,
  SURFACES,
  canAlias,
  canCapture,
  isSanitizedPath,
  isStableInternalIdentifier,
  isSupportedContractVersion,
  isValidEvent,
  normalizeAcquisitionSource,
  normalizeEnvironment,
  requiredPropertiesFor,
  requiresIdentityReset,
  validateEvent,
  type EventInput,
  type EventName,
  type ValidationIssueCode
} from "../src/analytics/eventContract";
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
  properties: comunes({ path: "/reading/:id", acquisition_source: "organic_search", ...extra })
});

const codigos = (input: EventInput): ValidationIssueCode[] =>
  validateEvent(input).issues.map((issue) => issue.code);

/** Un evento válido de cada uno de los cinco, con su superficie coherente. */
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
  }
};

// --- 1. La lista cerrada ----------------------------------------------------

test("el diccionario v1 es EXACTAMENTE esos cinco eventos", () => {
  assert.deepEqual(
    [...EVENT_NAMES],
    ["$pageview", "onboarding_completed", "paywall_viewed", "checkout_started", "purchase_completed"]
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
    // Las cinco comunes están en todos; sólo $pageview suma las suyas.
    for (const comun of COMMON_PROPERTIES) {
      assert.ok(def.requiredProperties.includes(comun), `${name} no exige ${comun}`);
    }
    const esperadas =
      name === "$pageview"
        ? [...COMMON_PROPERTIES, ...PAGEVIEW_PROPERTIES]
        : [...COMMON_PROPERTIES];
    assert.deepEqual([...def.requiredProperties], esperadas);
  }
});

test("el universo de propiedades del contrato son siete, y ninguna es contenido natal", () => {
  const todas = new Set(EVENT_NAMES.flatMap((name) => [...requiredPropertiesFor(name)]));
  assert.deepEqual(
    [...todas].sort(),
    [
      "acquisition_source",
      "contract_version",
      "environment",
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

test("un evento válido de cada uno de los cinco pasa", () => {
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
  for (const version of ["2.0.0", "1.1.0", "0.9.0", "1.0", "v1.0.0", "", 1, null]) {
    const resultado = validateEvent(pageview({ contract_version: version }));
    assert.equal(resultado.valid, false, `${String(version)} no debería pasar`);
    assert.ok(
      resultado.issues.some((i) => i.code === "unsupported_contract_version"),
      `${String(version)} no dio unsupported_contract_version`
    );
  }
});

test("el validador acepta exactamente la versión que implementa", () => {
  assert.equal(CONTRACT_VERSION, "1.0.0");
  assert.equal(isSupportedContractVersion("1.0.0"), true);
  // Una minor futura puede traer eventos que este código no conoce: aceptarla
  // sería afirmar algo que no se puede verificar.
  assert.equal(isSupportedContractVersion("1.1.0"), false);
  assert.equal(isSupportedContractVersion("1.0.1"), false);
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

// --- 8. Rutas sanitizadas ---------------------------------------------------

test("path no sanitizada se rechaza: query, fragmento e id dinámico crudo", () => {
  const sucias = [
    "/home?utm_source=instagram",
    "/home#seccion",
    "/reading/42",
    "/reading/8f2c1a9b-4d5e-4f6a-9b8c-1d2e3f4a5b6c",
    "/reading/a1b2c3d4e5f6a7b8",
    "/perfil/user_2abcDEF456ghiJKL",
    "/perfil/alguien@example.com",
    "https://orbitaastrologia.xyz/home",
    "reading/:id",
    "/home/",
    "/mi ruta",
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

test("las plantillas de ruta sí pasan", () => {
  for (const path of [
    "/",
    "/home",
    "/reading/:id",
    "/reading/carta-completa",
    "/checkout/success",
    "/iniciar-sesion",
    "/vinculo/:vinculoId/resultado"
  ]) {
    assert.equal(isSanitizedPath(path), true, `${path} debería ser válida`);
  }
});

test("path sólo acepta strings", () => {
  for (const valor of [null, undefined, 42, {}, ["/home"]]) {
    assert.equal(isSanitizedPath(valor), false, String(valor));
  }
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

// --- 11. Identidad ----------------------------------------------------------

test("identify sólo con un identificador interno estable", () => {
  assert.equal(isStableInternalIdentifier("user_2abcDEF456ghiJKL"), true);
  assert.equal(isStableInternalIdentifier("k57d9c8b1a2f3e4d5c6b7a8"), true);
  for (const pii of [
    "lucas@example.com",
    "Lucas Ramos",
    "1991-04-17",
    "Buenos Aires, Argentina",
    "corto",
    "  user_2abc  ",
    "",
    null,
    42
  ]) {
    assert.equal(isStableInternalIdentifier(pii), false, String(pii));
  }
});

test("alias sólo con dos identificadores estables, reales y distintos", () => {
  assert.equal(canAlias({ current: "user_2abcDEF456ghi", incoming: "cnv_9zyxWVU321tsr" }), true);
  // El flujo normal no aliasa nada: el mismo id, un id inventado o un dato
  // personal no habilitan la operación.
  assert.equal(canAlias({ current: "user_2abcDEF456ghi", incoming: "user_2abcDEF456ghi" }), false);
  assert.equal(canAlias({ current: "user_2abcDEF456ghi", incoming: "lucas@example.com" }), false);
  assert.equal(canAlias({ current: null, incoming: "user_2abcDEF456ghi" }), false);
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

test("el documento describe EXACTAMENTE los cinco eventos del diccionario", () => {
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
    ...COMMON_PROPERTIES,
    ...PAGEVIEW_PROPERTIES
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
