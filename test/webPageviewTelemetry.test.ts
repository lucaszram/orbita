/**
 * La visita de la web, de punta a punta — CORE-183.
 *
 * Hasta esta tarjeta la web productiva no registraba una sola visita: el bundle
 * salía sin SDK y PostHog no recibía nada del dominio. Lo que se agrega es la
 * captura, y una captura mal hecha es peor que ninguna: publica la URL de
 * alguien, cuenta tres visitas donde hubo una, o mide en el proyecto equivocado
 * porque adivinó el entorno del hostname.
 *
 * Este archivo prueba las cuatro promesas de la tarjeta:
 *
 *   · UNA visita por navegación real — ni por render, ni por redirección;
 *   · SANITIZADA — plantilla del catálogo, nunca la ruta cruda, nunca la URL,
 *     la query, el fragmento ni el referrer;
 *   · ANÓNIMA — sin `identify`, sin `alias`, sin `reset` y con la allowlist del
 *     contrato cerrada sobre lo que sale del dispositivo;
 *   · APAGADA POR DEFECTO — sin clave no hay cliente, sin consentimiento
 *     tampoco, y en nativo no hay ni SDK en el bundle.
 *
 * La decisión vive en un módulo puro, así que la mayor parte se prueba sin
 * navegador. Lo que sólo existe en el borde —las opciones del SDK, el montaje—
 * se prueba sobre la fuente, que es lo que efectivamente se empaqueta.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ACQUISITION_SOURCES,
  CANONICAL_SECTIONS,
  COMMON_PROPERTIES,
  CONTRACT_VERSION,
  ENVIRONMENTS,
  PAGEVIEW_PROPERTIES,
  REFERRER_CLASSES,
  ROUTE_TEMPLATES,
  canCapture,
  isValidEvent,
  validateEvent,
  type Environment,
  type RoutePath
} from "../src/analytics/eventContract";
import {
  CONTRACT_PROPERTY_NAMES,
  PAGEVIEW_EVENT,
  PLACEMENT_BY_ROUTE,
  TRANSPORT_PROPERTY_NAMES,
  acquisitionSourceFor,
  classifyReferrer,
  decidePageview,
  pageviewWarning,
  retainedProperties
} from "../src/analytics/routeClassification";
import {
  CONSENT_INSTRUMENT,
  PERSISTED_NAVIGATION_KEYS,
  PERSISTED_SESSION_NAVIGATION_KEYS,
  beforeSendWith,
  clientOptions,
  consentUnder,
  currentConsent
} from "../src/analytics/webClientOptions";
import { ROOT, importsOf, reachableFrom, resolveModule } from "./moduleGraph";

const leer = (ruta: string) => readFileSync(join(ROOT, ruta), "utf8");

const cliente = leer("src/analytics/webTelemetry.tsx");
const clienteNativo = leer("src/analytics/webTelemetry.native.tsx");
const clasificacion = leer("src/analytics/routeClassification.ts");
const opcionesFuente = leer("src/analytics/webClientOptions.ts");
const flujo = leer("src/analytics/pageviewStream.ts");
const arranque = leer("src/analytics/bootState.ts");
const puenteArranque = leer("src/analytics/bootSurface.tsx");
const gate = leer("src/components/orbita/AccountGate.tsx");
const layout = leer("app/_layout.tsx");
const legal = leer("src/components/web/orbita-legal.tsx");
const contrato = leer("docs/analytics/event-contract.md");

/** Un archivo sin comentarios: lo que corre, no lo que explica. */
const codigo = (fuente: string) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** La configuración REAL que recibe `posthog.init`, no su texto. */
const opciones = clientOptions({
  apiHost: "https://ph.orbitaastrologia.xyz",
  persisted: () => null
});

/** Una navegación cualquiera, con los reemplazos del caso. */
const navegacion = (extra: Partial<Parameters<typeof decidePageview>[0]> = {}) =>
  decidePageview({
    pathname: "/hoy",
    referrer: "",
    currentHost: "orbitaastrologia.xyz",
    firstOfSession: true,
    environment: "production" as Environment,
    ...extra
  });

/** Las siete propiedades del contrato, tal como salen de una visita real. */
const navegacionEmitida = () => {
  const decision = navegacion();
  assert.ok(decision.emit);
  return decision.properties;
};

// --- 1. El módulo de decisión es puro ----------------------------------------

test("la decisión del pageview no importa el SDK, ni React, ni expo", () => {
  // Si el módulo puro importara el SDK, "probar la decisión" pasaría a exigir un
  // navegador y dejaría de probarse. Es la misma regla que ya cumple el contrato.
  for (const spec of importsOf(join(ROOT, "src/analytics/routeClassification.ts"))) {
    assert.doesNotMatch(spec, /posthog|react|expo|convex|react-native/, `importa ${spec}`);
  }
});

test("la decisión sólo depende del contrato", () => {
  const propios = importsOf(join(ROOT, "src/analytics/routeClassification.ts"));
  assert.deepEqual(propios, ["@/analytics/eventContract"]);
});

// --- 2. Cada ruta del catálogo tiene un lugar decidido ------------------------

test("el catálogo entero está clasificado: ninguna ruta cae en un default", () => {
  // El tipo ya lo exige (`Record<RoutePath, …>`), pero el tipo se puede aflojar
  // y esto no: una ruta nueva del contrato entra por acá antes de medirse mal.
  for (const ruta of ROUTE_TEMPLATES) {
    assert.ok(ruta in PLACEMENT_BY_ROUTE, `${ruta} no está clasificada`);
  }
  assert.deepEqual(Object.keys(PLACEMENT_BY_ROUTE).sort(), [...ROUTE_TEMPLATES].sort());
});

test("cada ruta medible arma un $pageview que el contrato acepta", () => {
  for (const ruta of ROUTE_TEMPLATES) {
    const lugar = PLACEMENT_BY_ROUTE[ruta];
    if (!lugar) continue;
    const evento = {
      name: PAGEVIEW_EVENT,
      properties: {
        environment: "production",
        platform: "web",
        surface: lugar.surface,
        section: lugar.section,
        contract_version: CONTRACT_VERSION,
        path: ruta,
        acquisition_source: "direct"
      }
    };
    const veredicto = validateEvent(evento);
    assert.ok(veredicto.valid, `${ruta}: ${veredicto.issues.map((i) => i.message).join(" · ")}`);
  }
});

test("la regla de coherencia del validador se respeta ruta por ruta", () => {
  const canonicas = new Set<string>(CANONICAL_SECTIONS);
  for (const ruta of ROUTE_TEMPLATES) {
    const lugar = PLACEMENT_BY_ROUTE[ruta];
    if (!lugar) continue;
    if (lugar.surface === "app") {
      assert.ok(canonicas.has(lugar.section), `${ruta}: app sin sección canónica`);
    } else {
      assert.equal(lugar.section, "sin_seccion", `${ruta}: ${lugar.surface} con sección propia`);
    }
  }
});

test("las cinco secciones canónicas están cubiertas por rutas reales", () => {
  // Una sección sin ninguna ruta sería una sección que nunca aparece en un
  // tablero: el mapa quedaría con un agujero y nadie se enteraría.
  const vistas = new Set(
    ROUTE_TEMPLATES.map((ruta) => PLACEMENT_BY_ROUTE[ruta]).flatMap((lugar) =>
      lugar && lugar.surface === "app" ? [lugar.section] : []
    )
  );
  for (const seccion of CANONICAL_SECTIONS) {
    assert.ok(vistas.has(seccion), `ninguna ruta mide la sección ${seccion}`);
  }
});

test("las cinco superficies del contrato están cubiertas", () => {
  const vistas = new Set(
    ROUTE_TEMPLATES.map((ruta) => PLACEMENT_BY_ROUTE[ruta]?.surface).filter(Boolean)
  );
  for (const superficie of ["landing", "onboarding", "app", "paywall", "checkout"]) {
    assert.ok(vistas.has(superficie as never), `ninguna ruta mide la superficie ${superficie}`);
  }
});

test("las herramientas internas no se miden, y eso está declarado", () => {
  // No es un olvido: `surface: app` exige una de las cinco secciones canónicas y
  // el backoffice no es ninguna. Antes que inventar una sección, no se emite.
  for (const interna of ["/backoffice", "/lab", "/studio"] as RoutePath[]) {
    assert.equal(PLACEMENT_BY_ROUTE[interna], null, `${interna} se estaría midiendo`);
    const decision = navegacion({ pathname: interna });
    assert.equal(decision.emit, false);
    assert.equal(decision.emit === false && decision.reason, "unmeasured_route");
  }
});

test("el Perfil cuenta como Carta y no como sección propia", () => {
  for (const ruta of ["/perfil", "/perfil/ajustes", "/perfil/carta/completa"] as RoutePath[]) {
    assert.deepEqual(PLACEMENT_BY_ROUTE[ruta], { surface: "app", section: "carta" });
  }
});

// --- 3. `path`: plantilla del catálogo, nunca la ruta cruda -------------------

test("un id dentro de la ruta no sobrevive: sale la plantilla", () => {
  const decision = navegacion({ pathname: "/vinculos/8f2c1a9b-4d5e-4f6a-9b8c-1d2e3f4a5b6c" });
  assert.equal(decision.emit, true);
  if (decision.emit) {
    assert.equal(decision.properties.path, "/vinculos/:profileId");
    assert.doesNotMatch(JSON.stringify(decision.properties), /8f2c1a9b/);
  }
});

test("una ruta que no está en el catálogo no produce evento", () => {
  for (const cruda of ["/perfil/nombrepersona", "/ciudad/lugarnatal", "/inventada"]) {
    const decision = navegacion({ pathname: cruda });
    assert.equal(decision.emit, false);
    assert.equal(decision.emit === false && decision.reason, "unknown_route");
  }
});

test("query y fragmento no entran: no hay ruta que los acepte", () => {
  for (const cruda of ["/home?utm_source=news", "/home#seccion", "https://orbitaastrologia.xyz/home"]) {
    assert.equal(navegacion({ pathname: cruda }).emit, false);
  }
});

test("una barra final es la misma visita", () => {
  const decision = navegacion({ pathname: "/hoy/" });
  assert.equal(decision.emit, true);
  if (decision.emit) assert.equal(decision.properties.path, "/hoy");
});

test("sin pathname no hay evento", () => {
  for (const vacio of [null, undefined, ""]) {
    assert.equal(navegacion({ pathname: vacio }).emit, false);
  }
});

// --- 4. El referrer se clasifica en el borde y se descarta ahí ----------------

test("sin referrer la visita es directa", () => {
  assert.equal(classifyReferrer({ referrer: "", currentHost: "orbitaastrologia.xyz" }), "none");
  assert.equal(classifyReferrer({ referrer: null, currentHost: "orbitaastrologia.xyz" }), "none");
  assert.equal(
    acquisitionSourceFor({ referrer: "", currentHost: "orbitaastrologia.xyz", firstOfSession: true }),
    "direct"
  );
});

test("el mismo host es navegación interna, con o sin www y con puerto", () => {
  for (const referrer of [
    "https://orbitaastrologia.xyz/hoy",
    "https://www.orbitaastrologia.xyz/hoy",
    "https://orbitaastrologia.xyz:443/hoy"
  ]) {
    assert.equal(classifyReferrer({ referrer, currentHost: "orbitaastrologia.xyz" }), "internal");
  }
});

test("los buscadores se reconocen con su dominio de país", () => {
  for (const referrer of [
    "https://www.google.com/",
    "https://www.google.com.ar/search",
    "https://news.google.com/",
    "https://duckduckgo.com/",
    "https://www.bing.com/search"
  ]) {
    assert.equal(
      classifyReferrer({ referrer, currentHost: "orbitaastrologia.xyz" }),
      "search_engine",
      referrer
    );
  }
});

test("las redes sociales incluyen sus acortadores", () => {
  for (const referrer of [
    "https://www.instagram.com/",
    "https://l.facebook.com/",
    "https://x.com/alguien",
    "https://t.co/abc123",
    "https://wa.me/",
    "https://lnkd.in/xyz"
  ]) {
    assert.equal(
      classifyReferrer({ referrer, currentHost: "orbitaastrologia.xyz" }),
      "social_network",
      referrer
    );
  }
});

test("cualquier otro sitio es un referral, y lo que no es URL no se adivina", () => {
  assert.equal(
    classifyReferrer({ referrer: "https://un-blog-cualquiera.com/nota", currentHost: "orbitaastrologia.xyz" }),
    "external_site"
  );
  assert.equal(
    classifyReferrer({ referrer: "no-es-una-url", currentHost: "orbitaastrologia.xyz" }),
    "unclassified"
  );
});

test("la clasificación devuelve SIEMPRE una clase del contrato, nunca la URL", () => {
  const entradas = [
    "https://www.google.com/search?q=nombre+apellido",
    "https://orbitaastrologia.xyz/vinculos/8f2c1a9b",
    "https://x.com/",
    "basura",
    "",
    "javascript:alert(1)"
  ];
  for (const referrer of entradas) {
    const clase = classifyReferrer({ referrer, currentHost: "orbitaastrologia.xyz" });
    assert.ok((REFERRER_CLASSES as readonly string[]).includes(clase), `${referrer} -> ${clase}`);
    assert.doesNotMatch(clase, /http|\/|\?|=/);
  }
});

test("`paid_campaign` no se emite: exigiría leer la query, que el contrato prohíbe", () => {
  const entradas = [
    "https://www.google.com/aclk?sa=L",
    "https://l.facebook.com/?utm_medium=paid",
    "https://un-sitio.com/?gclid=abc"
  ];
  for (const referrer of entradas) {
    assert.notEqual(classifyReferrer({ referrer, currentHost: "orbitaastrologia.xyz" }), "paid_campaign");
  }
});

test("sólo la primera visita de la carga lee el referrer", () => {
  // `document.referrer` no cambia cuando la SPA cambia de ruta. Sin esta regla,
  // una persona que llega de un buscador y ve cinco pantallas se contaría como
  // cinco adquisiciones orgánicas.
  const referrer = "https://www.google.com/";
  assert.equal(
    acquisitionSourceFor({ referrer, currentHost: "orbitaastrologia.xyz", firstOfSession: true }),
    "organic_search"
  );
  assert.equal(
    acquisitionSourceFor({ referrer, currentHost: "orbitaastrologia.xyz", firstOfSession: false }),
    "direct"
  );
});

test("la fuente de adquisición siempre está en el enum del contrato", () => {
  for (const firstOfSession of [true, false]) {
    for (const referrer of ["", "https://x.com/", "basura", "https://orbitaastrologia.xyz/"]) {
      const fuente = acquisitionSourceFor({
        referrer,
        currentHost: "orbitaastrologia.xyz",
        firstOfSession
      });
      assert.ok((ACQUISITION_SOURCES as readonly string[]).includes(fuente));
    }
  }
});

// --- 5. El evento completo ----------------------------------------------------

test("un $pageview lleva exactamente las siete propiedades del contrato", () => {
  const decision = navegacion({ pathname: "/paywall" });
  assert.equal(decision.emit, true);
  if (!decision.emit) return;
  assert.deepEqual(
    Object.keys(decision.properties).sort(),
    [...COMMON_PROPERTIES, ...PAGEVIEW_PROPERTIES].sort()
  );
  assert.deepEqual(decision.properties, {
    environment: "production",
    platform: "web",
    surface: "paywall",
    section: "sin_seccion",
    contract_version: CONTRACT_VERSION,
    path: "/paywall",
    acquisition_source: "direct"
  });
});

test("el evento emitido pasa el validador del contrato", () => {
  for (const entorno of ENVIRONMENTS) {
    const decision = navegacion({ environment: entorno, pathname: "/vinculos/conectar" });
    assert.equal(decision.emit, true);
    if (decision.emit) {
      assert.ok(isValidEvent({ name: PAGEVIEW_EVENT, properties: decision.properties }));
      assert.equal(decision.properties.environment, entorno);
    }
  }
});

test("la versión del contrato viaja en cada evento", () => {
  const decision = navegacion();
  assert.equal(decision.emit && decision.properties.contract_version, CONTRACT_VERSION);
});

test("el aviso de descarte no lleva la ruta, el referrer ni ningún valor", () => {
  // Un log es un lugar donde los datos se quedan: la allowlist rige también acá.
  const decision = navegacion({ pathname: "/perfil/nombre-de-alguien" });
  const aviso = pageviewWarning(decision);
  assert.equal(typeof aviso, "string");
  assert.doesNotMatch(String(aviso), /nombre-de-alguien/);
  assert.match(String(aviso), /unknown_route/);
  assert.equal(pageviewWarning(navegacion()), null);
});

// --- 6. Lo que sale del dispositivo -------------------------------------------

test("el filtro de salida borra la URL, el referrer y la campaña que agrega el SDK", () => {
  const automaticas = {
    $current_url: "https://orbitaastrologia.xyz/vinculos/8f2c1a9b?utm_source=news#abajo",
    $host: "orbitaastrologia.xyz",
    $pathname: "/vinculos/8f2c1a9b",
    $referrer: "https://www.google.com/search?q=nombre+apellido",
    $referring_domain: "www.google.com",
    $initial_current_url: "https://orbitaastrologia.xyz/",
    $initial_referrer: "https://www.google.com/",
    $session_entry_url: "https://orbitaastrologia.xyz/",
    $session_entry_referrer: "https://www.google.com/",
    utm_source: "news",
    gclid: "abc123",
    title: "Órbita — Vínculos",
    $raw_user_agent: "Mozilla/5.0 (Macintosh)",
    $screen_height: 1080,
    $viewport_width: 800,
    $browser: "Chrome",
    $os: "Mac OS X",
    $timezone: "America/Argentina/Buenos_Aires",
    $ip: "1.2.3.4"
  };
  const salida = retainedProperties({ ...automaticas, path: "/vinculos/:profileId" });
  for (const prohibida of Object.keys(automaticas)) {
    assert.ok(!(prohibida in salida), `${prohibida} salió del dispositivo`);
  }
  assert.deepEqual(salida, { path: "/vinculos/:profileId" });
  assert.doesNotMatch(JSON.stringify(salida), /google|utm|8f2c1a9b|Mozilla/);
});

test("el filtro conserva el contrato y el transporte mínimo del SDK", () => {
  const entrada: Record<string, unknown> = {
    token: "phc_x",
    distinct_id: "01931f3e-anonimo",
    $session_id: "s1",
    $window_id: "w1",
    $lib: "web",
    $lib_version: "1.427.2",
    $insert_id: "i1",
    $time: 1,
    $is_identified: false,
    $process_person_profile: false,
    environment: "production",
    platform: "web",
    surface: "app",
    section: "hoy",
    contract_version: CONTRACT_VERSION,
    path: "/hoy",
    acquisition_source: "direct"
  };
  assert.deepEqual(retainedProperties(entrada), entrada);
});

test("la allowlist de salida es cerrada: lo desconocido no pasa", () => {
  assert.deepEqual(retainedProperties({ propiedad_nueva_del_sdk: "lo que sea" }), {});
  assert.deepEqual(retainedProperties({}), {});
});

test("las propiedades del contrato en el filtro son las del contrato", () => {
  assert.deepEqual(
    [...CONTRACT_PROPERTY_NAMES].sort(),
    [...COMMON_PROPERTIES, ...PAGEVIEW_PROPERTIES].sort()
  );
  // El transporte es la única excepción declarada, y ninguna de sus claves puede
  // llevar URL, referrer ni huella del dispositivo.
  for (const clave of TRANSPORT_PROPERTY_NAMES) {
    assert.doesNotMatch(clave, /url|referr|path|host|screen|viewport|agent|ip|utm|campaign/i);
  }
});

// --- 7. El cliente: apagado por defecto, sin captura automática ---------------

test("el cliente se configura con toda la captura automática apagada", () => {
  // Sobre el OBJETO que recibe `posthog.init`, no sobre el texto del archivo:
  // una opción mal escrita o movida a otro módulo se nota acá.
  const apagadas = {
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    capture_performance: false,
    rageclick: false,
    enable_heatmaps: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true
  } as const;
  for (const [opcion, valor] of Object.entries(apagadas)) {
    assert.equal(
      (opciones as Record<string, unknown>)[opcion],
      valor,
      `${opcion} tendría que valer ${valor}`
    );
  }
});

test("el SDK no guarda navegación en el dispositivo", () => {
  // Los defaults del SDK instalado son `true`: con ellos, CADA captura escribe
  // el referrer crudo y la URL inicial en el almacenamiento del navegador,
  // aunque `before_send` los descarte al enviar. Guardarlos ya es tratarlos.
  assert.equal(opciones.save_campaign_params, false);
  assert.equal(opciones.save_referrer, false);
  assert.equal(opciones.store_google, false);
  assert.equal(opciones.disable_capture_url_hashes, true);
  assert.equal(opciones.mask_personal_data_properties, true);
  // Y la persistencia NO se apaga entera: el distinct ID anónimo tiene que
  // sobrevivir a la recarga (contrato, sección 7).
  assert.equal(opciones.persistence, "localStorage");
});

test("lo que ninguna opción apaga se borra en la misma captura", () => {
  const borradas: string[] = [];
  const deSesion: string[] = [];
  const antes = beforeSendWith(() => ({
    unregister: (clave) => borradas.push(clave),
    unregister_for_session: (clave) => deSesion.push(clave)
  }));

  antes({ uuid: "u", event: PAGEVIEW_EVENT, properties: {} } as never);

  assert.deepEqual(borradas, [...PERSISTED_NAVIGATION_KEYS]);
  assert.deepEqual(deSesion, [...PERSISTED_SESSION_NAVIGATION_KEYS]);
  // Las dos escrituras que el SDK instalado hace pase lo que pase: el
  // `SessionPropsManager` (referrer + URL de entrada) y la palabra que la
  // persona buscó en Google.
  assert.ok(PERSISTED_NAVIGATION_KEYS.includes("$client_session_props"));
  assert.ok(PERSISTED_SESSION_NAVIGATION_KEYS.includes("ph_keyword"));
  assert.ok(PERSISTED_SESSION_NAVIGATION_KEYS.includes("$search_engine"));
});

test("borrar lo persistido no depende de que el evento salga", () => {
  // El borrado va ANTES del descarte: un evento que `before_send` tira igual
  // dejó escrito lo suyo en el disco.
  const borradas: string[] = [];
  const antes = beforeSendWith(() => ({
    unregister: (clave) => borradas.push(clave),
    unregister_for_session: () => {}
  }));
  assert.equal(antes(null as never), null);
  assert.ok(borradas.length > 0, "un evento descartado no limpió nada");
});

test("no hay identidad de persona en esta tarjeta", () => {
  // El distinct ID anónimo del SDK alcanza para contar visitantes; atar una
  // persona es otra tarjeta y hacerlo mal no se deshace.
  for (const fuente of [cliente, opcionesFuente, flujo]) {
    for (const prohibido of [".identify(", ".alias(", ".reset(", "createAlias"]) {
      assert.ok(!codigo(fuente).includes(prohibido), `la telemetría llama a ${prohibido}`);
    }
  }
});

test("sin clave no se inicializa el cliente", () => {
  // Es el caso normal de CI y de un build local: sin variables, el bundle lleva
  // el código y no emite nada.
  assert.match(cliente, /const key = process\.env\.EXPO_PUBLIC_POSTHOG_KEY;/);
  assert.match(cliente, /if \(!key\) return null;/);
  assert.match(cliente, /process\.env\.EXPO_PUBLIC_POSTHOG_HOST/);
});

test("el consentimiento decide, y lo decide el contrato", () => {
  assert.match(cliente, /canCapture\(currentConsent\(\)\)/);
  assert.match(cliente, /if \(!canCapture\(currentConsent\(\)\)\) return null;/);
  assert.ok(cliente.includes('from "@/analytics/eventContract"'));
});

test("el instrumento de consentimiento está nombrado, no implícito", () => {
  // Decisión de Lucas, 2026-09-07: para una visita anónima y sanitizada el
  // instrumento aplicable es la política de privacidad publicada. Lo que se fija
  // acá es que sea una decisión LEGIBLE y no un `granted` sin dueño.
  assert.equal(CONSENT_INSTRUMENT, "privacy_policy");
  assert.equal(consentUnder(CONSENT_INSTRUMENT, "web"), "granted");
  assert.equal(canCapture(consentUnder(CONSENT_INSTRUMENT, "web")), true);
});

test("el consentimiento vale sólo en la web y sólo bajo ese instrumento", () => {
  // Nativo mide por otro canal y esta política no lo cubre.
  for (const plataforma of ["ios", "android", "", null, undefined]) {
    assert.equal(consentUnder(CONSENT_INSTRUMENT, plataforma), "unknown", String(plataforma));
    assert.equal(canCapture(consentUnder(CONSENT_INSTRUMENT, plataforma)), false);
  }
  // Un opt-in que todavía no existe no otorga nada: "todavía no contestó" es un no.
  for (const otro of ["explicit_opt_in", "banner", "legitimate_interest", ""]) {
    assert.equal(consentUnder(otro, "web"), "unknown", otro);
  }
});

test("el consentimiento sigue la plataforma del build, no una constante suelta", () => {
  const original = process.env.EXPO_OS;
  try {
    process.env.EXPO_OS = "web";
    assert.equal(currentConsent(), "granted");
    for (const plataforma of ["ios", "android"]) {
      process.env.EXPO_OS = plataforma;
      assert.equal(currentConsent(), "unknown", plataforma);
    }
    delete process.env.EXPO_OS;
    assert.equal(currentConsent(), "unknown", "sin plataforma no se captura");
  } finally {
    if (original === undefined) delete process.env.EXPO_OS;
    else process.env.EXPO_OS = original;
  }
});

test("el consentimiento se pregunta en UN solo lugar", () => {
  // Si mañana hay un banner, cambia `currentConsent` y nada más. Eso sólo es
  // cierto si nadie más decide por su cuenta.
  const emisores = [...reachableFrom(["app/_layout.tsx"], "web")].filter((modulo) =>
    /\.(t|j)sx?$/.test(modulo)
  );
  const deciden = emisores.filter((modulo) => codigo(leer(modulo)).includes("CONSENT_INSTRUMENT"));
  assert.deepEqual(deciden, ["src/analytics/webClientOptions.ts"]);
});

test("el entorno sale de la configuración de despliegue, nunca del hostname", () => {
  assert.match(cliente, /normalizeEnvironment\(extra\?\.environment\) \?\? "development"/);
  assert.ok(!/location\.hostname/.test(cliente), "el cliente mira el hostname");
  // El host sólo se lee para clasificar el referrer contra el sitio actual.
  assert.equal((cliente.match(/window\.location\.host/g) ?? []).length, 1);
});

test("el único evento que puede salir es $pageview", () => {
  // Se EJECUTA el hook de salida real, con lo que el SDK arma de verdad.
  const antes = beforeSendWith(() => null);
  for (const otro of ["$web_vitals", "$exception", "$autocapture", "survey shown", "page_view"]) {
    assert.equal(antes({ uuid: "u", event: otro, properties: {} } as never), null, otro);
  }

  const salida = antes({
    uuid: "u",
    event: PAGEVIEW_EVENT,
    properties: {
      ...navegacionEmitida(),
      $current_url: "https://orbitaastrologia.xyz/vinculos/8f2c1a9b?utm_source=news#abajo",
      $referrer: "https://www.google.com/search?q=orbita",
      utm_source: "news",
      $raw_user_agent: "Mozilla/5.0",
      distinct_id: "01a0-7e1c"
    },
    $set: { $initial_referrer: "https://www.google.com/" },
    $set_once: { $initial_current_url: "https://orbitaastrologia.xyz/hoy" }
  } as never) as { properties: Record<string, unknown>; $set?: unknown; $set_once?: unknown };

  assert.deepEqual(
    Object.keys(salida.properties).sort(),
    [...CONTRACT_PROPERTY_NAMES, "distinct_id"].sort()
  );
  assert.equal(salida.$set, undefined);
  assert.equal(salida.$set_once, undefined);
});

test("la captura ocurre en un solo lugar de todo el módulo", () => {
  for (const fuente of [cliente, flujo, opcionesFuente, arranque, puenteArranque]) {
    assert.ok((codigo(fuente).match(/\.capture\(/g) ?? []).length <= 1);
  }
  assert.equal((codigo(flujo).match(/port\.capture\(/g) ?? []).length, 1);
});

test("el cliente no se monta en el render estático", () => {
  assert.match(cliente, /if \(typeof window === "undefined"\) return null;/);
});

test("el SDK entra por el build `slim`, y ese build existe", () => {
  // El build completo trae grabador de sesión, encuestas y autocapture —todo lo
  // que esta tarjeta apaga— y con él el export no entra en el techo de JS. Es
  // una ruta profunda del paquete: si una versión la mueve, esto falla acá y no
  // en el deploy.
  assert.match(cliente, /from "posthog-js\/dist\/module\.slim"/);
  assert.ok(existsSync(join(ROOT, "node_modules/posthog-js/dist/module.slim.js")));
  assert.ok(existsSync(join(ROOT, "node_modules/posthog-js/dist/module.slim.d.ts")));
});

test("la identidad anónima persiste sin cookie", () => {
  assert.equal(opciones.persistence, "localStorage");
  assert.equal(opciones.person_profiles, "identified_only");
});

// --- 8. Un evento por navegación real ----------------------------------------

test("el efecto depende de la ruta y de nada más", () => {
  // Con `[pathname]` React lo vuelve a correr cuando la ruta cambia y no cuando
  // el árbol se redibuja: eso es lo que hace que no haya un evento por render.
  assert.match(cliente, /useEffect\(\(\) => \{/);
  assert.match(cliente, /\}, \[pathname\]\);/);
  assert.match(cliente, /const pathname = usePathname\(\);/);
});

test("no queda ninguna ventana de tiempo: lo que decide es el arranque", () => {
  // La primera versión esperaba 200 ms y contaba lo que quedara: una redirección
  // más lenta que la ventana contaba la ruta intermedia y una navegación más
  // rápida se cancelaba. La condición ahora es un hecho, no un plazo.
  for (const fuente of [cliente, flujo, arranque, puenteArranque]) {
    assert.doesNotMatch(codigo(fuente), /setTimeout|setInterval|requestAnimationFrame/);
    assert.doesNotMatch(codigo(fuente), /ROUTE_SETTLE_MS|SETTLE_MS|_DELAY_MS/);
  }
  assert.match(codigo(flujo), /if \(bootPhase\(\) !== "resolved"\) return;/);
});

test("el estado que evita el evento repetido vive en el MÓDULO, no en el componente", () => {
  // Con el estado en la instancia, un remount o el doble efecto de StrictMode
  // contaban la misma navegación de nuevo. El comportamiento se ejecuta en
  // `webPageviewLifecycle.test.ts`; acá se fija dónde vive.
  assert.doesNotMatch(codigo(cliente), /useRef|useState/);
  assert.match(codigo(flujo), /^let decided: string \| null \| undefined;$/m);
  assert.match(codigo(flujo), /^let emitted: EmittedPageview \| null = null;$/m);
  assert.equal((codigo(cliente).match(/useEffect\(/g) ?? []).length, 1);
});

test("el gate marca el arranque, y sólo cuando muestra el contenido de su ruta", () => {
  assert.match(codigo(gate), /const arranque = useBootSurface\(\);/);
  assert.match(codigo(gate), /const enDestino = \(\) => <AtDestination surface=\{arranque\}>/);
  // Ni una espera, ni un aviso, ni una redirección quedan marcadas como destino.
  const marcados = codigo(gate).match(/<AtDestination[\s\S]*?<\/AtDestination>/g) ?? [];
  assert.ok(marcados.length > 0);
  for (const bloque of marcados) {
    for (const prohibido of ["Redirect", "MinimalLoading", "ErrorState", "UnconfirmedSessionScreen"]) {
      assert.ok(!bloque.includes(prohibido), `el gate marca ${prohibido} como destino`);
    }
  }
});

test("la lógica de destino del gate sigue intacta", () => {
  // La señal se agrega envolviendo lo que ya se devolvía; las decisiones son las
  // mismas y las cuatro redirecciones siguen saliendo sin marcar nada.
  for (const ruta of ["SIGN_IN_ROUTE", "ONBOARDING_ROUTE", "EDIT_BIRTH_DATA_ROUTE", "HOME_ROUTE"]) {
    assert.ok(
      codigo(gate).includes(`return <Redirect href={${ruta} as never} />;`),
      `cambió la redirección a ${ruta}`
    );
  }
  assert.match(codigo(gate), /const permitido = destinationAllows\(destination, surface\);/);
  assert.equal((codigo(gate).match(/<Redirect/g) ?? []).length, 4);
});

test("el arranque y el contador no importan el SDK, ni React, ni expo", () => {
  // Si el contador arrastrara el runtime, "un evento por navegación" volvería a
  // ser una afirmación sobre el texto de un archivo.
  for (const modulo of ["src/analytics/pageviewStream.ts", "src/analytics/bootState.ts"]) {
    for (const spec of importsOf(join(ROOT, modulo))) {
      assert.doesNotMatch(spec, /posthog|^react|^expo|convex/, `${modulo} importa ${spec}`);
    }
  }
  // El puente con React es lo único que toca React, y no toca nada más.
  assert.deepEqual(importsOf(join(ROOT, "src/analytics/bootSurface.tsx")), [
    "react",
    "@/analytics/bootState"
  ]);
});

test("las opciones del SDK lo nombran sólo como tipo", () => {
  // `import type` lo borra Babel: el módulo se puede importar en Node —que es lo
  // que permite probar la configuración de verdad— y no mete el SDK en el grafo.
  assert.match(opcionesFuente, /import type \{ PostHogConfig \} from "posthog-js\/dist\/module\.slim";/);
  assert.deepEqual(
    importsOf(join(ROOT, "src/analytics/webClientOptions.ts")).filter((spec) =>
      spec.startsWith("posthog")
    ),
    []
  );
});

test("el layout raíz monta la telemetría una vez, fuera de los proveedores", () => {
  assert.match(layout, /import \{ WebPageviewTelemetry \} from "@\/analytics\/webTelemetry";/);
  assert.equal((layout.match(/<WebPageviewTelemetry \/>/g) ?? []).length, 1);
  const telemetria = layout.indexOf("<WebPageviewTelemetry />");
  const proveedores = layout.indexOf("<BackendProviders>");
  const estatico = layout.indexOf("if (isStaticRender())");
  assert.ok(telemetria > estatico, "la telemetría se montaría en el render estático");
  assert.ok(telemetria < proveedores, "la telemetría depende de Clerk o Convex");
});

test("ninguna pantalla emite su propia visita", () => {
  // Si cada pantalla emitiera la suya, "visita" tendría tantas definiciones como
  // pantallas y el número dejaría de significar algo.
  const emisores = [...reachableFrom(["app/_layout.tsx"], "web")].filter((modulo) =>
    /\.(t|j)sx?$/.test(modulo)
  );
  const conSdk = emisores.filter((modulo) =>
    importsOf(join(ROOT, modulo)).some((spec) => /^posthog-js/.test(spec))
  );
  assert.deepEqual(conSdk, ["src/analytics/webTelemetry.tsx"]);
});

// --- 9. Nativo: ni SDK ni evento ---------------------------------------------

test("la variante nativa no renderiza nada y no importa nada", () => {
  assert.match(clienteNativo, /export function WebPageviewTelemetry\(\)/);
  assert.match(clienteNativo, /return null;/);
  assert.deepEqual(importsOf(join(ROOT, "src/analytics/webTelemetry.native.tsx")), []);
});

test("el bundle nativo no llega al SDK de la web", () => {
  const nativo = resolveModule(join(ROOT, "app/_layout.tsx"), "@/analytics/webTelemetry", "native");
  assert.equal(nativo, join(ROOT, "src/analytics/webTelemetry.native.tsx"));
  for (const modulo of reachableFrom(["app/_layout.tsx"], "native")) {
    if (!/\.(t|j)sx?$/.test(modulo)) continue;
    for (const spec of importsOf(join(ROOT, modulo))) {
      assert.doesNotMatch(spec, /^posthog-js/, `${modulo} arrastra el SDK a nativo`);
    }
  }
});

test("la web sí resuelve el cliente real", () => {
  const web = resolveModule(join(ROOT, "app/_layout.tsx"), "@/analytics/webTelemetry", "web");
  assert.equal(web, join(ROOT, "src/analytics/webTelemetry.tsx"));
});

// --- 10. El entorno del build -------------------------------------------------

test("app.config.js envuelve app.json sin cambiar ningún campo", async () => {
  const appJson = JSON.parse(leer("app.json")) as { expo: Record<string, unknown> };
  const configurar = (await import(join(ROOT, "app.config.js"))).default as (input: {
    config: Record<string, unknown>;
  }) => Record<string, unknown>;

  const resultado = configurar({ config: appJson.expo });
  for (const [clave, valor] of Object.entries(appJson.expo)) {
    if (clave === "extra") continue;
    assert.deepEqual(resultado[clave], valor, `app.config.js cambió ${clave}`);
  }
  const extra = resultado.extra as Record<string, unknown>;
  for (const [clave, valor] of Object.entries(appJson.expo.extra as Record<string, unknown>)) {
    assert.deepEqual(extra[clave], valor, `app.config.js cambió extra.${clave}`);
  }
});

test("el entorno sale de VERCEL_ENV y acepta exactamente los tres del contrato", async () => {
  const appJson = JSON.parse(leer("app.json")) as { expo: Record<string, unknown> };
  const configurar = (await import(join(ROOT, "app.config.js"))).default as (input: {
    config: Record<string, unknown>;
  }) => { extra: Record<string, unknown> };
  const original = process.env.VERCEL_ENV;

  try {
    for (const entorno of ENVIRONMENTS) {
      process.env.VERCEL_ENV = entorno;
      assert.equal(configurar({ config: appJson.expo }).extra.environment, entorno);
    }
    // Un hostname, una rama o un nombre de proyecto entran por acá y NO salen
    // convertidos en entorno.
    for (const basura of ["orbitaastrologia.xyz", "orb/core-183", "Production", ""]) {
      process.env.VERCEL_ENV = basura;
      assert.equal(configurar({ config: appJson.expo }).extra.environment, "development");
    }
    delete process.env.VERCEL_ENV;
    assert.equal(configurar({ config: appJson.expo }).extra.environment, "development");
  } finally {
    if (original === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = original;
  }
});

// --- 11. La política de privacidad dice lo que se registra --------------------

test("Privacidad nombra a PostHog como proveedor de analítica", () => {
  assert.match(legal, />PostHog</);
  assert.match(legal, /PostHog<\/Text> — analítica/);
});

test("Privacidad dice que la visita es anónima y sin la dirección completa", () => {
  assert.match(legal, /de forma anónima/);
  assert.match(legal, /No guardamos la dirección completa/);
});

test("el contrato registra la aclaración de consentimiento con su fecha", () => {
  const inicio = contrato.indexOf("### Aclaración registrada 2026-09-07");
  assert.ok(inicio > 0, "el documento no registra la aclaración");
  // Va DENTRO de privacidad y consentimiento, no en una sección nueva.
  assert.ok(contrato.indexOf("## 8. Privacidad y consentimiento") < inicio);
  assert.ok(inicio < contrato.indexOf("## 9."));

  const aclaracion = contrato.slice(inicio, contrato.indexOf("## 9.")).replace(/[ \t]*\n[ \t]*/g, " ");
  assert.match(aclaracion, /`\$pageview` \*\*anónimo y sanitizado de la web\*\*/);
  assert.match(aclaracion, /consentimiento aplicable es la \*\*política de privacidad vigente\*\*/);
  assert.match(aclaracion, /No hay banner/);
  // Un opt-in futuro cambia un solo lugar, y el documento dice cuál.
  assert.match(aclaracion, /`currentConsent\(\)`/);
  assert.match(aclaracion, /src\/analytics\/webClientOptions\.ts/);
});

test("la aclaración es aclaración: no sube la versión del contrato", () => {
  const aclaracion = contrato
    .slice(contrato.indexOf("### Aclaración registrada 2026-09-07"), contrato.indexOf("## 9."))
    .replace(/[ \t]*\n[ \t]*/g, " ");
  assert.match(aclaracion, /\*\*aclaración, no un cambio de contrato\*\*/);
  assert.match(aclaracion, /no sube `CONTRACT_VERSION`/);
  // Y efectivamente no la subió: el evento sigue viajando con la misma versión.
  assert.equal(CONTRACT_VERSION, "1.0.0");
  assert.equal(navegacionEmitida().contract_version, "1.0.0");
});

// --- 12. Nada de eventos de producto en esta tarjeta -------------------------

test("esta tarjeta emite $pageview y ningún evento de producto", () => {
  assert.equal(PAGEVIEW_EVENT, "$pageview");
  for (const deOtraTarjeta of [
    "onboarding_completed",
    "paywall_viewed",
    "checkout_started",
    "purchase_completed",
    "page_view"
  ]) {
    for (const fuente of [cliente, flujo, opcionesFuente, arranque, puenteArranque]) {
      assert.ok(!codigo(fuente).includes(deOtraTarjeta), `la telemetría emite ${deOtraTarjeta}`);
    }
    assert.ok(!clasificacion.includes(`"${deOtraTarjeta}"`), `la decisión conoce ${deOtraTarjeta}`);
  }
});
