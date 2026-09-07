/**
 * Qué queda GUARDADO en el dispositivo después de capturar — CORE-183.
 *
 * El contrato (`docs/analytics/event-contract.md`, sección 8) prohíbe la query,
 * el fragmento y el referrer crudo, y no dice "en el payload": guardar el
 * referrer en `localStorage` ya es tratarlo, aunque `before_send` lo descarte al
 * enviar. Y el SDK, con su configuración por defecto, guarda exactamente eso en
 * cada captura: el referrer crudo, la URL inicial y los parámetros de campaña.
 *
 * Esta prueba no lee opciones ni texto: instala un navegador falso —el mínimo
 * que el SDK necesita— , corre el `posthog-js` REAL con la configuración REAL de
 * producción (`clientOptions`), captura, y después abre el almacenamiento a ver
 * qué quedó. Es la única forma de afirmar algo sobre lo que el SDK hace por su
 * cuenta sin repetir sus reglas acá.
 *
 * El caso de control está incluido a propósito: la misma captura con los
 * defaults del SDK SÍ ensucia el almacenamiento. Sin eso, una prueba que pasa no
 * distinguiría "está limpio" de "no estoy mirando donde hay que mirar".
 *
 * Vive en un archivo aparte porque instala globales (`window`, `document`,
 * `localStorage`): el runner de Node corre cada archivo en su propio proceso, así
 * que nada de esto se filtra al resto de la suite.
 */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { clientOptions } from "../src/analytics/webClientOptions";
import { decidePageview } from "../src/analytics/routeClassification";
import { ROOT } from "./moduleGraph";

/** Una visita con TODO lo que no puede sobrevivir: query, campaña y fragmento. */
const URL_VISITA =
  "https://orbitaastrologia.xyz/vinculos/8f2c1a9b?utm_source=news&utm_campaign=lanzamiento&gclid=Cj0abc#abajo";
const REFERRER = "https://www.google.com/search?q=orbita+astrologia+carta+natal";
const API_HOST = "https://ph.orbitaastrologia.xyz";

// --- El navegador falso -------------------------------------------------------

type Bolsa = Record<string, string>;

function almacenamiento(bolsa: Bolsa) {
  return {
    getItem: (k: string) => (k in bolsa ? bolsa[k] : null),
    setItem: (k: string, v: unknown) => {
      bolsa[k] = String(v);
    },
    removeItem: (k: string) => {
      delete bolsa[k];
    },
    clear: () => {
      for (const k of Object.keys(bolsa)) delete bolsa[k];
    },
    key: (i: number) => Object.keys(bolsa)[i] ?? null,
    get length() {
      return Object.keys(bolsa).length;
    }
  };
}

const local: Bolsa = {};
const sesion: Bolsa = {};

/**
 * Los temporizadores del SDK no pueden sostener el proceso de pruebas: se los
 * deja sin referencia (`unref`) para que el runner termine igual. Siguen
 * corriendo mientras haya algo más vivo, así que no cambian lo que se mide.
 */
const setTimeoutReal = globalThis.setTimeout;
const setIntervalReal = globalThis.setInterval;
const sinReferencia = <T extends { unref?: () => void }>(handle: T): T => {
  handle.unref?.();
  return handle;
};

function instalarNavegador(): void {
  const url = new URL(URL_VISITA);
  const location = {
    href: URL_VISITA,
    protocol: url.protocol,
    host: url.host,
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    origin: url.origin,
    toString: () => URL_VISITA
  };
  const elemento = () => ({
    style: {},
    dataset: {},
    setAttribute() {},
    getAttribute: () => null,
    appendChild: (hijo: unknown) => hijo,
    removeChild() {},
    addEventListener() {},
    removeEventListener() {},
    remove() {},
    classList: { add() {}, remove() {} }
  });
  const head = elemento();
  const document = {
    referrer: REFERRER,
    URL: URL_VISITA,
    title: "Órbita",
    cookie: "",
    visibilityState: "visible",
    hidden: false,
    location,
    body: elemento(),
    head,
    documentElement: elemento(),
    createElement: () => elemento(),
    createTextNode: () => elemento(),
    getElementsByTagName: () => [head],
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: () => null,
    addEventListener() {},
    removeEventListener() {}
  };
  const navigator = {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    language: "es-AR",
    languages: ["es-AR"],
    vendor: "",
    platform: "MacIntel",
    product: "Gecko",
    webdriver: false,
    cookieEnabled: true,
    doNotTrack: null,
    sendBeacon: () => true
  };
  const window = {
    location,
    document,
    navigator,
    localStorage: almacenamiento(local),
    sessionStorage: almacenamiento(sesion),
    screen: { width: 1440, height: 900 },
    innerWidth: 1440,
    innerHeight: 900,
    devicePixelRatio: 2,
    addEventListener() {},
    removeEventListener() {},
    setTimeout: (...args: Parameters<typeof setTimeout>) => sinReferencia(setTimeoutReal(...args)),
    clearTimeout: (id: never) => clearTimeout(id),
    setInterval: (...args: Parameters<typeof setInterval>) => sinReferencia(setIntervalReal(...args)),
    clearInterval: (id: never) => clearInterval(id),
    // La red no existe en esta prueba: lo que se mide es el disco, no el envío.
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "{}" }),
    XMLHttpRequest: class {
      open() {}
      setRequestHeader() {}
      send() {}
      addEventListener() {}
    },
    performance: { now: () => Date.now() }
  };
  Object.assign(window, { window, self: window, top: window, parent: window });
  Object.assign(document, { defaultView: window });

  const poner = (nombre: string, valor: unknown) =>
    Object.defineProperty(globalThis, nombre, { value: valor, configurable: true, writable: true });
  poner("window", window);
  poner("document", document);
  poner("navigator", navigator);
  poner("location", location);
  poner("localStorage", window.localStorage);
  poner("sessionStorage", window.sessionStorage);
  poner("screen", window.screen);
  poner("XMLHttpRequest", window.XMLHttpRequest);
  poner("setTimeout", window.setTimeout);
  poner("setInterval", window.setInterval);
}

type PostHogMinimo = {
  init: (key: string, config: unknown, name?: string) => PostHogMinimo;
  capture: (event: string, properties: Record<string, unknown>) => void;
  unregister: (property: string) => void;
  unregister_for_session: (property: string) => void;
};

let posthog: PostHogMinimo;

/** Las siete propiedades del contrato para esta visita. */
const decision = decidePageview({
  pathname: "/vinculos/8f2c1a9b",
  referrer: REFERRER,
  currentHost: "orbitaastrologia.xyz",
  firstOfSession: true,
  environment: "production"
});

before(async () => {
  assert.ok(decision.emit);
  // El navegador falso se instala ANTES de importar: el SDK lee `window` al
  // evaluarse, y por eso el import es dinámico.
  instalarNavegador();
  const modulo = (await import(
    pathToFileURL(join(ROOT, "node_modules/posthog-js/dist/module.slim.js")).href
  )) as { default: PostHogMinimo };
  posthog = modulo.default;

  // El cliente de producción: la MISMA configuración que arma `webTelemetry`.
  const cliente = posthog.init(
    "phc_orbita_test",
    clientOptions({ apiHost: API_HOST, persisted: () => posthog })
  );
  cliente.capture("$pageview", decision.properties);
  cliente.capture("$pageview", { ...decision.properties, path: "/hoy" });
});

const guardado = (bolsa: Bolsa, token: string) =>
  Object.entries(bolsa)
    .filter(([clave]) => clave.includes(token))
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join("\n");

const enDisco = () => guardado(local, "phc_orbita_test");
const enSesion = () => guardado(sesion, "phc_orbita_test");

// --- 1. Después de init + capture, nada de navegación quedó guardado ----------

test("el localStorage del SDK no guarda ninguna URL", () => {
  assert.doesNotMatch(enDisco(), /https?:\/\//, enDisco());
  assert.ok(!enDisco().includes("orbitaastrologia.xyz"), enDisco());
  assert.ok(!enDisco().includes("/vinculos/"), enDisco());
  assert.ok(!enDisco().includes("abajo"), enDisco());
});

test("el localStorage del SDK no guarda el referrer ni de dónde vino la visita", () => {
  for (const rastro of ["google", "search", "orbita+astrologia", "$direct", "referr"]) {
    assert.ok(!enDisco().toLowerCase().includes(rastro), `${rastro} quedó guardado: ${enDisco()}`);
  }
});

test("el localStorage del SDK no guarda parámetros de campaña", () => {
  for (const rastro of ["utm_", "gclid", "lanzamiento", "news", "campaign"]) {
    assert.ok(!enDisco().toLowerCase().includes(rastro), `${rastro} quedó guardado: ${enDisco()}`);
  }
});

test("el sessionStorage tampoco guarda URL, referrer ni la búsqueda de la persona", () => {
  // `ph_keyword` es, literalmente, lo que la persona escribió en el buscador:
  // `update_search_keyword` corre en TODA captura y ninguna opción lo apaga.
  assert.doesNotMatch(enSesion(), /https?:\/\//, enSesion());
  for (const rastro of ["google", "keyword", "orbita+astrologia", "utm_", "gclid", "referr"]) {
    assert.ok(!enSesion().toLowerCase().includes(rastro), `${rastro} quedó en sesión: ${enSesion()}`);
  }
});

test("no se escribe ninguna cookie", () => {
  assert.equal((globalThis as { document: { cookie: string } }).document.cookie, "");
});

// --- 2. Y lo que SÍ tiene que quedar, queda ----------------------------------

test("el distinct ID anónimo sí persiste: sin él no hay visitante estable", () => {
  // Contrato, sección 7: el distinct ID del SDK es estable desde la primera
  // visita. Es la razón por la que la persistencia no se apaga entera.
  assert.match(enDisco(), /"distinct_id":"[0-9a-f-]{16,}"/);
  assert.match(enDisco(), /"\$device_id":"[0-9a-f-]{16,}"/);
});

// --- 3. El control: con los defaults del SDK, esto ensucia --------------------

test("con la configuración por defecto del SDK el referrer SÍ queda guardado", () => {
  // Prueba de que la prueba sirve. Mismo navegador, misma captura, otra
  // configuración: las banderas que esta tarjeta apaga son las que importan.
  const control = posthog.init(
    "phc_orbita_control",
    {
      api_host: API_HOST,
      autocapture: false,
      capture_pageview: false,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      persistence: "localStorage",
      before_send: () => null
    },
    "control"
  );
  control.capture("$pageview", { path: "/hoy" });

  const sucio = guardado(local, "phc_orbita_control") + guardado(sesion, "phc_orbita_control");
  assert.match(sucio, /https?:\/\//, "el control tendría que haber guardado la URL");
  assert.ok(sucio.includes("google"), "el control tendría que haber guardado el referrer");
});
