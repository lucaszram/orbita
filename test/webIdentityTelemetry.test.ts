/**
 * La identidad de persona, con el SDK REAL — CORE-188.
 *
 * La ficha pide `identify` con un identificador interno estable y `reset` al
 * cerrar sesión. El riesgo de esto no es escribir mal la llamada: es que la
 * llamada no haga NADA y nadie se entere. `posthog.identify()` no manda una
 * orden aparte —captura un evento llamado `$identify`—, y esta web descarta en
 * `before_send` todo lo que el diccionario del contrato no declara. Con la
 * comprobación a secas, `identify` habría sido una línea de código sin efecto:
 * el código diría que hay identidad, los datos dirían que no, y la única forma
 * de descubrirlo sería mirar el proyecto de analítica dos semanas después.
 *
 * Por eso esta prueba no lee opciones ni texto: instala un navegador falso —el
 * mínimo que el SDK necesita—, corre el `posthog-js` REAL con la configuración
 * REAL de producción (`clientOptions`), llama a `identify` y a `reset`, y mira
 * qué salió y qué quedó. Es el mismo método de `webTelemetryStorage.test.ts` y
 * por el mismo motivo: no se puede afirmar lo que el SDK hace por su cuenta
 * repitiendo sus reglas acá.
 *
 * Vive en un archivo aparte porque instala globales (`window`, `document`,
 * `localStorage`): el runner de Node corre cada archivo en su propio proceso,
 * así que nada de esto se filtra al resto de la suite.
 */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { CONTRACT_VERSION, isStableInternalIdentifier } from "../src/analytics/eventContract";
import { TRANSPORT_PROPERTY_NAMES } from "../src/analytics/routeClassification";
import { clientOptions, IDENTITY_EVENT } from "../src/analytics/webClientOptions";
import { ROOT } from "./moduleGraph";

const URL_VISITA = "https://orbitaastrologia.xyz/paywall?utm_source=news#abajo";
const REFERRER = "https://www.google.com/search?q=orbita+astrologia";
const API_HOST = "https://ph.orbitaastrologia.xyz";

/** La cuenta, con la forma EXACTA que el contrato exige para el emisor `account`. */
const CUENTA = "user_2rLmQxTz8vB4kN6pW1cH9dYs";

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

/** Los temporizadores del SDK no pueden sostener el proceso de pruebas. */
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
    // La red no existe en esta prueba: lo que se mide es qué sale de
    // `before_send`, no si llega.
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

type Salida = { event: string; properties: Record<string, unknown> } | null;

type PostHogMinimo = {
  init: (key: string, config: unknown, name?: string) => PostHogMinimo;
  capture: (event: string, properties: Record<string, unknown>) => void;
  identify: (distinctId: string) => void;
  reset: () => void;
  get_distinct_id: () => string;
  unregister: (property: string) => void;
  unregister_for_session: (property: string) => void;
};

let cliente: PostHogMinimo;
/** Lo que ENTRÓ y lo que SALIÓ de `before_send`, en orden. */
const paso: Array<{ entrada: { event: string }; salida: Salida }> = [];

/** Las cinco comunes de un evento del contrato, para capturar de verdad. */
const COMUNES = {
  environment: "preview",
  platform: "web",
  surface: "onboarding",
  section: "sin_seccion",
  contract_version: CONTRACT_VERSION
} as const;

before(async () => {
  // El navegador falso se instala ANTES de importar: el SDK lee `window` al
  // evaluarse, y por eso el import es dinámico.
  instalarNavegador();
  const modulo = (await import(
    pathToFileURL(join(ROOT, "node_modules/posthog-js/dist/module.slim.js")).href
  )) as { default: PostHogMinimo };
  const posthog = modulo.default;

  // La configuración de producción, entera. Lo único que se envuelve es
  // `before_send`, para poder VER lo que pasa por él sin cambiar lo que decide.
  const opciones = clientOptions({ apiHost: API_HOST, persisted: () => posthog });
  const real = opciones.before_send;
  cliente = posthog.init("phc_orbita_test", {
    ...opciones,
    before_send: (entrada: { event: string }) => {
      const salida = (real as (r: unknown) => Salida)(entrada);
      paso.push({ entrada, salida });
      return salida;
    }
  });
});

const primero = (event: string) => paso.find((p) => p.entrada.event === event);

test("`identify` del SDK captura un `$identify`, y este cliente lo deja salir", () => {
  // La cuenta primero: si el identificador no fuera el que el contrato declara,
  // esta prueba estaría midiendo otra cosa.
  assert.ok(isStableInternalIdentifier({ source: "account", value: CUENTA }));

  cliente.identify(CUENTA);

  const identificacion = primero(IDENTITY_EVENT);
  assert.ok(identificacion, "`identify` no capturó nada: el SDK cambió de mecanismo");
  assert.notEqual(
    identificacion.salida,
    null,
    "`before_send` descartó `$identify`: identify sería una línea sin efecto"
  );
});

test("lo que sale de `$identify` es el identificador y el anónimo anterior, nada más", () => {
  const salida = primero(IDENTITY_EVENT)?.salida;
  assert.ok(salida);
  // `$identify` no está en el diccionario, así que no tiene propiedades
  // declaradas: lo único que sobrevive es la allowlist de TRANSPORTE. Ni URL, ni
  // referrer, ni campaña, ni huella de pantalla —el SDK las calcula igual, eso no
  // se puede apagar— y el filtro de salida las deja afuera.
  for (const nombre of Object.keys(salida.properties)) {
    assert.ok(TRANSPORT_PROPERTY_NAMES.includes(nombre), `salió ${nombre} en $identify`);
  }
  assert.deepEqual(
    Object.keys(salida.properties)
      .filter((n) => n === "distinct_id" || n === "$anon_distinct_id")
      .sort(),
    ["$anon_distinct_id", "distinct_id"],
    "falta lo que la identificación necesita para atar el perfil anónimo"
  );
  const texto = JSON.stringify(salida.properties);
  assert.doesNotMatch(texto, /orbitaastrologia\.xyz|utm_|google\.com|abajo/, texto);
  assert.equal(salida.properties.distinct_id, CUENTA);
  // El anónimo anterior es lo que ata la visita de antes del login con la
  // cuenta: sin él, `identify` estrenaría un perfil y el recorrido previo
  // quedaría huérfano.
  assert.equal(typeof salida.properties.$anon_distinct_id, "string");
  assert.notEqual(salida.properties.$anon_distinct_id, CUENTA);
  // Sin propiedades de persona: ahí viajarían `$initial_referrer` y compañía.
  const crudo = salida as unknown as Record<string, unknown>;
  assert.equal(crudo.$set, undefined);
  assert.equal(crudo.$set_once, undefined);
});

test("después de identificar, los eventos del contrato viajan con la cuenta", () => {
  assert.equal(cliente.get_distinct_id(), CUENTA);
  cliente.capture("signup_completed", { ...COMUNES });
  const evento = primero("signup_completed");
  assert.ok(evento?.salida);
  assert.equal(evento.salida.properties.distinct_id, CUENTA);
  // Y sigue siendo un evento del contrato: sus cinco comunes más el transporte,
  // y nada más. Identificarse no aflojó el filtro de salida.
  const permitidas = new Set<string>([...Object.keys(COMUNES), ...TRANSPORT_PROPERTY_NAMES]);
  for (const nombre of Object.keys(evento.salida.properties)) {
    assert.ok(permitidas.has(nombre), `salió ${nombre} en signup_completed`);
  }
  for (const comun of Object.keys(COMUNES)) {
    assert.ok(comun in evento.salida.properties, `falta ${comun}`);
  }
});

test("`reset` corta el vínculo: el identificador siguiente ya no es la cuenta", () => {
  const antes = paso.length;
  cliente.reset();
  // `reset` no captura nada: sortea un distinct ID anónimo nuevo y punto.
  assert.equal(paso.length, antes, "`reset` emitió un evento");
  const despues = cliente.get_distinct_id();
  assert.notEqual(despues, CUENTA, "el distinct ID siguió siendo el de la cuenta cerrada");

  // Y lo que se capture ahora viaja con el anónimo nuevo, no con la cuenta: es
  // exactamente lo que impide que dos cuentas terminen en un solo perfil.
  cliente.capture("paywall_viewed", {
    ...COMUNES,
    surface: "paywall"
  });
  const posterior = paso.filter((p) => p.entrada.event === "paywall_viewed").pop();
  assert.ok(posterior?.salida);
  assert.equal(posterior.salida.properties.distinct_id, despues);
  assert.notEqual(posterior.salida.properties.distinct_id, CUENTA);
});

test("el almacenamiento no guarda la cuenta después del reset", () => {
  // El contrato pide cortar el vínculo, no sólo dejar de mandarlo: si el
  // identificador siguiera escrito en el dispositivo, la persona siguiente
  // heredaría el perfil de la anterior al recargar.
  const guardado = Object.entries(local)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join("\n");
  assert.ok(!guardado.includes(CUENTA), `la cuenta quedó guardada:\n${guardado}`);
});
