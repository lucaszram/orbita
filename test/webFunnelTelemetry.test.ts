/**
 * El recorrido real de la persona, del alta a la conversión — CORE-188.
 *
 * Hasta esta tarjeta la web emitía `$pageview` y nada más: se sabía qué rutas se
 * abren y no se sabía dónde se traba la gente en el alta, cuántas cuentas se
 * crean ni cuántas llegan al pago. Lo que se agrega son los siete eventos de
 * producto del contrato v1.1.0, y una medición mal hecha es peor que ninguna:
 * cuenta dos conversiones donde hubo una, publica el dato de alguien, o mide en
 * la superficie equivocada y el embudo deja de poder leerse.
 *
 * Este archivo prueba las seis promesas de la tarjeta:
 *
 *   · UN EVENTO POR HECHO — ni por render, ni por remount, ni por el doble
 *     efecto de StrictMode, ni al volver atrás a un paso ya contado — y el hecho
 *     es de una PERSONA, no de un documento: el segundo alta de la misma pestaña
 *     vuelve a contarse porque el logout reinició la deduplicación;
 *   · IDENTIDAD SIN PII — `identify` con el identificador interno que el contrato
 *     declara, sin propiedades de persona, sin `alias`, y `reset` en los hechos
 *     que el contrato nombra;
 *   · UNA COMPRA ES UN COBRO — una prueba gratuita de siete días no es una
 *     conversión, y el contrato lo descarta con todas las letras;
 *   · EL CONTRATO ES LEY — las propiedades son exactamente las declaradas, la
 *     superficie es la que corresponde, el paso viaja por su NOMBRE y lo que no
 *     valida no sale;
 *   · SIN PII — ni el índice del paso, ni nada de lo que la persona cargó, ni en
 *     el evento ni en el aviso que se escribe cuando algo no se emite;
 *   · FUERA DEL BUNDLE NATIVO — los dos puntos de emisión compartidos
 *     (`OnboardingFlow`, `useAccount`) resuelven la variante inerte, y el grafo
 *     de `app/**` lo demuestra por plataforma.
 *
 * La decisión vive en un módulo puro, así que casi todo se prueba sin navegador.
 * Lo que sólo existe en el borde —dónde se emite cada hecho— se prueba sobre la
 * fuente, que es lo que efectivamente se empaqueta.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import {
  COMMON_PROPERTIES,
  CONTRACT_VERSION,
  EVENT_NAMES,
  FORBIDDEN_PROPERTY_NAMES,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_PROPERTIES,
  RESET_TRIGGERS,
  isStableInternalIdentifier,
  requiredPropertiesFor,
  validateEvent,
  valueLooksLikePii,
  type EventName,
  type OnboardingStep
} from "../src/analytics/eventContract";
import {
  ONBOARDING_STEP_BY_INDEX,
  PLACEMENT_BY_PRODUCT_EVENT,
  PRODUCT_EVENT_NAMES,
  decideIdentify,
  decidePurchaseFact,
  decideProductEvent,
  emitProductEvent,
  factCounted,
  identifiedPerson,
  identifyPerson,
  onboardingStepName,
  productEventWarning,
  purchaseFact,
  resetIdentityFor,
  resetProductEvents,
  type IdentityPort,
  type ProductEventInput,
  type ProductEventName,
  type ProductEventPort,
  type ProductEventProperties,
  type PurchaseSignal
} from "../src/analytics/productEvents";
import { beforeSendWith, IDENTITY_EVENT } from "../src/analytics/webClientOptions";
import { retainedProperties, TRANSPORT_PROPERTY_NAMES } from "../src/analytics/routeClassification";
import * as PASOS_DEL_ALTA from "../src/onboarding/steps";
import { ROOT, importsOf, pathTo, reachableFrom, resolveModule } from "./moduleGraph";

const leer = (ruta: string) => readFileSync(join(ROOT, ruta), "utf8");

const decision = leer("src/analytics/productEvents.ts");
const puente = leer("src/analytics/productTelemetry.ts");
const puenteNativo = leer("src/analytics/productTelemetry.native.ts");
const alta = leer("src/onboarding/OnboardingFlow.tsx");
const cuenta = leer("src/onboarding/useAccount.ts");
const paywallDelAlta = leer("src/onboarding/screens/OnboardingPaywallScreen.web.tsx");
const lanzador = leer("src/components/web/orbita-paywall.tsx");
const vuelta = leer("src/components/web/orbita-checkout-return.tsx");
const arranqueDeCuenta = leer("src/domain/accountBootstrap.ts");
const perfil = leer("src/screens/PerfilScreen.tsx");
const eliminacion = leer("src/domain/accountDeletion.ts");
const contrato = leer("docs/analytics/event-contract.md");

/** Un archivo sin comentarios: lo que corre, no lo que explica. */
const codigo = (fuente: string) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Las entradas REALES del bundle: Expo Router mete todo `app/` en el grafo. */
function rutasDeApp(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const full = join(dir, nombre);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(t|j)sx?$/.test(nombre)) out.push(relative(ROOT, full));
    }
  };
  walk(join(ROOT, "app"));
  return out.sort();
}

/**
 * Una pestaña de prueba: los DOS puertos escriben en la misma línea de tiempo.
 *
 * El orden importa tanto como el contenido —resetear después de capturar no
 * sirve de nada—, así que `linea` registra capturas, identificaciones, resets y
 * borrados en el orden real de ejecución. La memoria de la pestaña es un `Set`
 * de verdad: `remember` escribe en ella y `forget` la vacía, como el
 * `sessionStorage` que representa.
 */
type Registro = {
  readonly eventos: Array<{ name: ProductEventName; properties: ProductEventProperties }>;
  readonly avisos: string[];
  readonly anotados: string[];
  readonly identificados: string[];
  readonly reinicios: number[];
  readonly linea: string[];
  readonly memoria: Set<string>;
  readonly puerto: ProductEventPort;
  readonly identidad: IdentityPort;
};

function registro(recordado: Iterable<string> = []): Registro {
  const eventos: Registro["eventos"] = [];
  const avisos: string[] = [];
  const anotados: string[] = [];
  const identificados: string[] = [];
  const reinicios: number[] = [];
  const linea: string[] = [];
  const memoria = new Set<string>(recordado);
  return {
    eventos,
    avisos,
    anotados,
    identificados,
    reinicios,
    linea,
    memoria,
    puerto: {
      capture: (name, properties) => {
        eventos.push({ name, properties });
        linea.push(`captura:${name}`);
      },
      environment: () => "preview",
      warn: (message) => avisos.push(message),
      recall: (fact) => memoria.has(fact),
      remember: (fact) => {
        anotados.push(fact);
        memoria.add(fact);
      }
    },
    identidad: {
      identify: (distinctId) => {
        identificados.push(distinctId);
        linea.push(`identify:${distinctId}`);
      },
      reset: () => {
        reinicios.push(reinicios.length + 1);
        linea.push("reset");
      },
      forget: () => {
        memoria.clear();
        linea.push("olvida");
      },
      warn: (message) => avisos.push(message)
    }
  };
}

/** Una carga de página nueva: el estado de módulo arranca limpio. */
function cargaNueva(memoria?: Iterable<string>): Registro {
  resetProductEvents();
  return registro(memoria);
}

/**
 * Dos identificadores de cuenta con la forma EXACTA que el contrato exige para
 * el emisor `account`. No son valores de fantasía: si el formato del contrato
 * cambiara, estos dejarían de validar y las pruebas de identidad caerían.
 */
const CUENTA_A = "user_2rLmQxTz8vB4kN6pW1cH9dYs";
const CUENTA_B = "user_9aZq3XyT7wR2mE5nK8vJ4bLd";

/** Un identificador declarado por su origen, como pide el contrato. */
const identidadDe = (value: string) => ({ source: "account" as const, value });

/** Un paso del alta: pintado, fuera de la inspección y sin sesión activa. */
function pasoDelAlta(
  step: number,
  extra: Partial<{ visible: boolean; inspecting: boolean; sessionActive: boolean }> = {}
): ProductEventInput {
  return {
    name: "onboarding_step_viewed",
    step,
    visible: true,
    inspecting: false,
    sessionActive: false,
    ...extra
  };
}

/** Un cobro REAL: el retorno confirmó y la suscripción NO está en prueba. */
const COBRO: PurchaseSignal = {
  checkoutStatus: "active",
  subscriptionStatus: "active",
  subscriptionOwner: CUENTA_A,
  sessionOwner: CUENTA_A,
  periodEnd: 1_799_000_000_000
};

/** El mismo retorno, con lo que se quiera cambiar. */
function compra(over: Partial<PurchaseSignal> = {}): ProductEventInput {
  return { name: "purchase_completed", ...COBRO, ...over };
}

/**
 * Los módulos COMPARTIDOS que llaman al puente.
 *
 * Ninguno tiene variante `.web`: el mismo archivo se empaqueta para iOS y para
 * Android. Quién contesta ese import es lo único que separa una app nativa que
 * no mide de una web que sí, y es el defecto que la revisión de CORE-183
 * rechazó.
 */
const COMPARTIDOS = [
  "src/onboarding/OnboardingFlow.tsx",
  "src/onboarding/useAccount.ts",
  "src/hooks/useAccountBootstrap.tsx",
  "src/screens/PerfilScreen.tsx"
];

/** Todos los hechos posibles, uno por evento (el del alta, con su paso). */
const HECHOS: readonly ProductEventInput[] = [
  pasoDelAlta(PASOS_DEL_ALTA.STEP_BIRTHDATE),
  { name: "signup_submitted" },
  { name: "signup_completed" },
  { name: "onboarding_completed" },
  { name: "paywall_viewed" },
  { name: "checkout_started", attempt: 1 },
  compra()
];

// --- 1. El módulo de decisión es puro ----------------------------------------

test("la decisión de los eventos de producto no importa el SDK, ni React, ni expo", () => {
  // Si el módulo puro importara el SDK, "probar el embudo" pasaría a exigir un
  // navegador y dejaría de probarse. Es la misma regla del contrato y de la
  // decisión del pageview.
  for (const spec of importsOf(join(ROOT, "src/analytics/productEvents.ts"))) {
    assert.doesNotMatch(spec, /posthog|^react|^expo|convex|react-native/, `importa ${spec}`);
  }
});

test("la decisión sólo depende del contrato y de los pasos del flujo", () => {
  assert.deepEqual(importsOf(join(ROOT, "src/analytics/productEvents.ts")), [
    "@/analytics/eventContract",
    "@/onboarding/steps"
  ]);
});

test("la captura ocurre en un solo lugar de cada módulo", () => {
  for (const fuente of [decision, puente, puenteNativo]) {
    assert.ok((codigo(fuente).match(/\.capture\(/g) ?? []).length <= 1);
  }
  assert.equal((codigo(decision).match(/port\.capture\(/g) ?? []).length, 1);
  // Lo mismo con la identidad: un solo `identify` y un solo `reset` en el
  // módulo que decide, y ninguno en el que sólo avisa hechos.
  assert.equal((codigo(decision).match(/port\.identify\(/g) ?? []).length, 1);
  assert.equal((codigo(decision).match(/port\.reset\(/g) ?? []).length, 1);
});

// --- 2. Los siete eventos, y su superficie -----------------------------------

test("los siete eventos son los del diccionario menos la visita", () => {
  // Derivados del contrato y no escritos a mano: un evento nuevo aparece acá
  // solo, y el mapa de superficies deja de compilar hasta que alguien decida.
  assert.deepEqual(
    [...PRODUCT_EVENT_NAMES].sort(),
    EVENT_NAMES.filter((name) => name !== "$pageview").sort()
  );
  assert.equal(PRODUCT_EVENT_NAMES.length, 7);
  assert.ok(!PRODUCT_EVENT_NAMES.includes("$pageview" as never));
});

test("cada evento tiene una superficie decidida, y ninguna es una sección de la app", () => {
  assert.deepEqual(Object.keys(PLACEMENT_BY_PRODUCT_EVENT).sort(), [...PRODUCT_EVENT_NAMES].sort());
  for (const name of PRODUCT_EVENT_NAMES) {
    const { surface, section } = PLACEMENT_BY_PRODUCT_EVENT[name];
    assert.notEqual(surface, "app", `${name} sale de la navegación autenticada`);
    // La regla de coherencia del contrato: fuera de `app`, la sección honesta
    // es `sin_seccion` y no un vacío, un null ni un texto.
    assert.equal(section, "sin_seccion", name);
  }
});

test("los cuatro del alta salen de onboarding; la oferta, el cobro y la compra, de lo suyo", () => {
  const superficie = (name: ProductEventName) => PLACEMENT_BY_PRODUCT_EVENT[name].surface;
  for (const name of [
    "onboarding_step_viewed",
    "signup_submitted",
    "signup_completed",
    "onboarding_completed"
  ] as const) {
    assert.equal(superficie(name), "onboarding", name);
  }
  // La impresión de la oferta se mide en `paywall`; el intento y el cobro, en
  // `checkout`. La conversión se lee como el salto entre las dos superficies:
  // con `checkout_started` en `paywall` no habría salto que leer.
  assert.equal(superficie("paywall_viewed"), "paywall");
  assert.equal(superficie("checkout_started"), "checkout");
  assert.equal(superficie("purchase_completed"), "checkout");
});

test("los tres eventos del alta salen de la superficie que el contrato les EXIGE", () => {
  // No es una preferencia: el validador rechaza otra superficie con
  // `unexpected_surface`, y acá se comprueba contra el contrato, no contra el mapa.
  for (const name of ["onboarding_step_viewed", "signup_submitted", "signup_completed"] as const) {
    const otra = validateEvent({
      name,
      properties: {
        environment: "preview",
        platform: "web",
        surface: "checkout",
        section: "sin_seccion",
        contract_version: CONTRACT_VERSION,
        ...(name === "onboarding_step_viewed" ? { onboarding_step: "auth" } : {})
      }
    });
    assert.ok(
      otra.issues.some((issue) => issue.code === "unexpected_surface"),
      `${name} podría salir de otra superficie`
    );
  }
});

// --- 3. Las propiedades son las del contrato, y nada más ---------------------

test("cada evento emite exactamente las propiedades que el contrato le exige", () => {
  for (const hecho of HECHOS) {
    const d = decideProductEvent({ ...hecho, environment: "production" });
    assert.ok(d.emit, `${hecho.name} no se emitió`);
    assert.deepEqual(
      Object.keys(d.properties).sort(),
      [...requiredPropertiesFor(hecho.name)].sort(),
      hecho.name
    );
    // El validador es la última palabra, también sobre el módulo que arma.
    assert.deepEqual(validateEvent({ name: d.name, properties: d.properties }).issues, [], hecho.name);
  }
});

test("las cinco comunes viajan en los siete, con la versión vigente del contrato", () => {
  for (const hecho of HECHOS) {
    const d = decideProductEvent({ ...hecho, environment: "development" });
    assert.ok(d.emit);
    const p = d.properties as unknown as Record<string, unknown>;
    for (const comun of COMMON_PROPERTIES) assert.ok(comun in p, `${hecho.name} sin ${comun}`);
    assert.equal(p.contract_version, CONTRACT_VERSION);
    assert.equal(p.platform, "web");
    // El entorno sale del puerto —de la configuración del build—, nunca del
    // hostname ni del proyecto de destino.
    assert.equal(p.environment, "development");
  }
});

test("`onboarding_step` es exclusiva de su evento, en el contrato y en el filtro de salida", () => {
  for (const hecho of HECHOS) {
    const d = decideProductEvent({ ...hecho, environment: "preview" });
    assert.ok(d.emit);
    const lleva = "onboarding_step" in (d.properties as unknown as Record<string, unknown>);
    assert.equal(lleva, hecho.name === "onboarding_step_viewed", hecho.name);
  }
  // Y el último punto antes de la red opina lo mismo: la allowlist se resuelve
  // por evento contra el diccionario, así que el paso no puede colarse pegado a
  // otro evento ni siquiera si alguien lo agregara a mano.
  const conPaso = { onboarding_step: "birthdate", distinct_id: "anonimo" };
  assert.deepEqual(retainedProperties(conPaso, "onboarding_step_viewed"), conPaso);
  for (const otro of PRODUCT_EVENT_NAMES.filter((n) => n !== "onboarding_step_viewed")) {
    assert.deepEqual(retainedProperties(conPaso, otro), { distinct_id: "anonimo" }, otro);
  }
  assert.deepEqual(retainedProperties(conPaso, "$pageview"), { distinct_id: "anonimo" });
});

test("ninguna propiedad prohibida puede viajar, ni por nombre ni por valor", () => {
  const prohibidas = new Set<string>(FORBIDDEN_PROPERTY_NAMES);
  for (const hecho of HECHOS) {
    const d = decideProductEvent({ ...hecho, environment: "production" });
    assert.ok(d.emit);
    for (const [nombre, valor] of Object.entries(d.properties)) {
      assert.ok(!prohibidas.has(nombre), `${hecho.name} lleva ${nombre}`);
      assert.equal(valueLooksLikePii(valor), false, `${hecho.name}.${nombre} parece un dato personal`);
    }
    // Ni el contenido natal ni nada escrito por la persona: los valores son
    // literales cerrados del contrato.
    assert.doesNotMatch(JSON.stringify(d.properties), /@|\d{4}-\d{2}-\d{2}/);
  }
});

// --- 4. El paso del alta: su nombre, nunca su índice -------------------------

test("el mapa de pasos es el del flujo y el del contrato, sin nombres inventados", () => {
  const indices = PASOS_DEL_ALTA as unknown as Record<string, number>;
  assert.equal(Object.keys(ONBOARDING_STEP_BY_INDEX).length, PASOS_DEL_ALTA.ONBOARDING_TOTAL);
  ONBOARDING_STEPS.forEach((paso, i) => {
    // Cada nombre viaja pegado a SU constante del flujo, no a un número suelto.
    assert.equal(indices[`STEP_${paso.toUpperCase()}`], i, `${paso} no es el paso ${i}`);
    assert.equal(onboardingStepName(i), paso, `el índice ${i} no nombra a ${paso}`);
  });
  // Y ningún valor del mapa cae fuera del enum del contrato.
  for (const nombre of Object.values(ONBOARDING_STEP_BY_INDEX)) {
    assert.ok((ONBOARDING_STEPS as readonly string[]).includes(nombre), nombre);
  }
});

test("el evento del paso lleva el NOMBRE, nunca el índice", () => {
  for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
    const d = decideProductEvent({ ...pasoDelAlta(i), environment: "preview" });
    assert.ok(d.emit);
    const p = d.properties as unknown as Record<string, unknown>;
    assert.equal(p.onboarding_step, ONBOARDING_STEPS[i]);
    // El número no viaja en ninguna propiedad, ni siquiera como texto: los
    // valores son literales cerrados del contrato, no la posición en el flujo.
    for (const [nombre, valor] of Object.entries(p)) {
      assert.equal(typeof valor, "string", nombre);
      assert.notEqual(valor, String(i), nombre);
    }
  }
});

test("un paso que el contrato no nombra no se emite, y el aviso no lleva el valor", () => {
  const carga = cargaNueva();
  for (const fuera of [PASOS_DEL_ALTA.ONBOARDING_TOTAL, -1, 1.5, Number.NaN]) {
    emitProductEvent(pasoDelAlta(fuera), carga.puerto);
  }
  assert.deepEqual(carga.eventos, [], "salió un evento con un paso que el contrato no nombra");
  assert.equal(carga.avisos.length, 4);
  for (const aviso of carga.avisos) {
    assert.equal(aviso, "[orbita] onboarding_step_viewed no emitido: unknown_step");
    assert.doesNotMatch(aviso, /\d/, "el aviso lleva el índice adentro");
  }
});

test("el aviso de un evento inválido lleva el código y ningún valor", () => {
  const invalido = productEventWarning({
    emit: false,
    name: "purchase_completed",
    reason: "invalid_event",
    issues: ["invalid_enum", "property_not_allowed"]
  });
  assert.equal(
    invalido,
    "[orbita] purchase_completed no emitido: invalid_event (invalid_enum, property_not_allowed)"
  );
  assert.equal(productEventWarning({ emit: true, name: "paywall_viewed", fact: "x", properties: {} as never }), null);
});

// --- 5. Un evento por hecho --------------------------------------------------

test("el mismo hecho, avisado dos veces, emite una sola vez", () => {
  const carga = cargaNueva();
  for (const hecho of HECHOS) {
    emitProductEvent(hecho, carga.puerto);
    emitProductEvent(hecho, carga.puerto);
    emitProductEvent(hecho, carga.puerto);
  }
  assert.deepEqual(
    carga.eventos.map((e) => e.name),
    HECHOS.map((h) => h.name)
  );
});

test("el estado que evita el evento repetido vive en el MÓDULO, no en el componente", () => {
  // Con el estado en la instancia, un remount —un cambio de layout, el doble
  // efecto de StrictMode, un árbol que React descarta y vuelve a montar—
  // contaba el mismo hecho de nuevo. Acá se ejecuta esa diferencia: el segundo
  // "montaje" trae un puerto nuevo, como haría un componente recreado.
  const primera = cargaNueva();
  emitProductEvent({ name: "paywall_viewed" }, primera.puerto);
  const remontaje = registro();
  emitProductEvent({ name: "paywall_viewed" }, remontaje.puerto);
  assert.equal(primera.eventos.length, 1);
  assert.deepEqual(remontaje.eventos, [], "el remount volvió a contar la impresión");
  // Y se dice dónde vive, para que no vuelva a mudarse a un componente.
  assert.match(codigo(decision), /^const contados = new Set<string>\(\);$/m);
});

test("volver atrás a un paso ya contado no emite; avanzar al siguiente sí", () => {
  const carga = cargaNueva();
  const ver = (step: number) => emitProductEvent(pasoDelAlta(step), carga.puerto);
  ver(PASOS_DEL_ALTA.STEP_BIRTHDATE);
  ver(PASOS_DEL_ALTA.STEP_BIRTHPLACE);
  ver(PASOS_DEL_ALTA.STEP_BIRTHDATE); // volvió atrás a editar la fecha
  ver(PASOS_DEL_ALTA.STEP_BIRTHPLACE);
  ver(PASOS_DEL_ALTA.STEP_BIRTHTIME);
  assert.deepEqual(
    carga.eventos.map((e) => (e.properties as { onboarding_step: OnboardingStep }).onboarding_step),
    ["birthdate", "birthplace", "birthtime"]
  );
});

test("los once pasos del alta se cuentan uno por uno", () => {
  const carga = cargaNueva();
  for (let i = 0; i < PASOS_DEL_ALTA.ONBOARDING_TOTAL; i++) {
    emitProductEvent(pasoDelAlta(i), carga.puerto);
  }
  assert.equal(carga.eventos.length, PASOS_DEL_ALTA.ONBOARDING_TOTAL);
  assert.deepEqual(
    carga.eventos.map((e) => (e.properties as { onboarding_step: OnboardingStep }).onboarding_step),
    [...ONBOARDING_STEPS]
  );
});

test("una carga nueva cuenta de nuevo: el estado dura lo que dura el documento", () => {
  const primera = cargaNueva();
  emitProductEvent({ name: "signup_completed" }, primera.puerto);
  const segunda = cargaNueva();
  emitProductEvent({ name: "signup_completed" }, segunda.puerto);
  assert.equal(primera.eventos.length, 1);
  assert.equal(segunda.eventos.length, 1);
});

test("el hecho se anota ANTES de capturar: una captura que falla no se reintenta", () => {
  resetProductEvents();
  const roto: ProductEventPort = {
    capture: () => {
      throw new Error("la red se cayó");
    },
    environment: () => "preview",
    warn: () => undefined,
    recall: () => false,
    remember: () => undefined
  };
  assert.throws(() => emitProductEvent({ name: "checkout_started", attempt: 1 }, roto));
  assert.equal(factCounted("checkout_started:1"), true);
});

// --- 6. La compra no se cuenta dos veces al reabrir la pantalla --------------

test("la compra se anota para la carga siguiente, y sólo ella", () => {
  const carga = cargaNueva();
  for (const hecho of HECHOS) emitProductEvent(hecho, carga.puerto);
  assert.deepEqual(carga.anotados, [purchaseFact(COBRO.periodEnd)]);
  // Lo que se anota es la clave del hecho y nada más: el nombre del evento y el
  // fin del período. Sin id de la sesión de pago, sin URL y sin nada de la
  // query, que es lo que el contrato prohíbe guardar (sección 8).
  for (const anotado of carga.anotados) {
    assert.match(anotado, /^[a-z_]+:\d+$/);
    assert.doesNotMatch(anotado, /cs_|https?:|\?|=|session/);
  }
});

test("dos compras distintas son dos claves distintas: la segunda no queda tapada", () => {
  // El defecto que cierra: con la clave genérica, quien cancela y vuelve a
  // comprar en la misma pestaña tenía su segunda compra escondida detrás de la
  // marca de la primera. El fin del período las separa sin guardar nada sensible.
  const primera = cargaNueva();
  emitProductEvent(compra({ periodEnd: 1_799_000_000_000 }), primera.puerto);
  const recarga = cargaNueva(primera.memoria);
  emitProductEvent(compra({ periodEnd: 1_799_000_000_000 }), recarga.puerto);
  assert.deepEqual(recarga.eventos, [], "la recarga contó de nuevo la MISMA compra");

  const segundaCompra = cargaNueva(primera.memoria);
  emitProductEvent(compra({ periodEnd: 1_801_700_000_000 }), segundaCompra.puerto);
  assert.deepEqual(
    segundaCompra.eventos.map((e) => e.name),
    ["purchase_completed"],
    "una compra posterior legítima quedó tapada por la marca de la anterior"
  );
});

test("volver a abrir la pantalla de compra exitosa no cuenta otra conversión", () => {
  // El caso real: la persona recarga `/checkout/success`. La carga es nueva —el
  // estado de módulo arranca limpio— y el backend vuelve a contestar `active`.
  const reapertura = cargaNueva([purchaseFact(COBRO.periodEnd)]);
  emitProductEvent(compra(), reapertura.puerto);
  assert.deepEqual(reapertura.eventos, [], "la recarga contó una segunda compra");
  assert.deepEqual(reapertura.anotados, [], "una compra ya contada se vuelve a anotar");
});

test("la memoria entre cargas no toca ningún otro hecho", () => {
  // Una memoria que dijera "sí" para todo no puede apagar el resto del embudo:
  // los otros seis se cuentan dentro de la carga y no la consultan.
  const carga = cargaNueva([...PRODUCT_EVENT_NAMES, purchaseFact(COBRO.periodEnd)]);
  for (const hecho of HECHOS) emitProductEvent(hecho, carga.puerto);
  assert.deepEqual(
    carga.eventos.map((e) => e.name),
    HECHOS.filter((h) => h.name !== "purchase_completed").map((h) => h.name)
  );
});

// --- 7. Dónde se emite cada hecho --------------------------------------------

test("el paso del alta se emite UNA vez, desde el único estado que lo sabe", () => {
  // Un efecto por pantalla serían once definiciones distintas de "se vio un
  // paso"; acá hay un solo efecto, sobre `step`, en el contenedor del flujo.
  assert.equal((codigo(alta).match(/trackOnboardingStepViewed\(/g) ?? []).length, 1);
  // La pantalla no decide: pasa los cuatro datos que sabe, y los cuatro están en
  // las dependencias del efecto — incluida la señal de "listo para mostrar", que
  // es la que faltaba.
  assert.match(
    codigo(alta),
    /trackOnboardingStepViewed\(\{\s*step,\s*visible: pasoVisible,\s*inspecting: inspeccion,\s*sessionActive: sesionActiva\s*\}\);\s*\}, \[step, pasoVisible, inspeccion, sesionActiva\]\);/
  );
  // Ninguna pantalla del alta emite lo suyo.
  const pantallas = readdirSync(join(ROOT, "src/onboarding/screens"));
  for (const pantalla of pantallas) {
    if (pantalla === "OnboardingPaywallScreen.web.tsx") continue;
    assert.doesNotMatch(
      leer(join("src/onboarding/screens", pantalla)),
      /productTelemetry/,
      `${pantalla} emite su propio evento`
    );
  }
});

test("la inspección visual del alta no emite nada, y el acceso con sesión tampoco", () => {
  // `/preview-alta` monta los once pasos a la vez y en ocho tamaños: sin esta
  // guarda, una herramienta interna publicaría 88 pasos que nadie recorrió. Y el
  // acceso con la sesión ya activa no es la primera pantalla del alta sino la
  // espera mientras el flujo decide la salida: un paso que saltea solo.
  //
  // Se prueba EJECUTANDO y no leyendo: las dos guardas viven en el módulo puro.
  const carga = cargaNueva();
  emitProductEvent(pasoDelAlta(PASOS_DEL_ALTA.STEP_BIRTHDATE, { inspecting: true }), carga.puerto);
  emitProductEvent(pasoDelAlta(PASOS_DEL_ALTA.STEP_AUTH, { sessionActive: true }), carga.puerto);
  assert.equal(carga.eventos.length, 0, "salió un paso de la inspección o de la espera");
  assert.equal(carga.avisos.length, 0, "una guarda normal escribió un aviso");
  // Y el alta que SÍ empieza en el acceso —sin sesión— se cuenta.
  emitProductEvent(pasoDelAlta(PASOS_DEL_ALTA.STEP_AUTH), carga.puerto);
  assert.deepEqual(carga.eventos.map((e) => e.name), ["onboarding_step_viewed"]);
});

test("la activación se emite cuando la carta quedó disponible, no antes", () => {
  const cuerpo = codigo(alta);
  assert.equal((cuerpo.match(/trackOnboardingCompleted\(\)/g) ?? []).length, 1);
  // Después de que `createProfile` resolvió: si la creación falla, el flujo
  // muestra el reintento y no hay activación que contar.
  const creacion = cuerpo.indexOf("await createProfile(");
  const activacion = cuerpo.indexOf("trackOnboardingCompleted()");
  assert.ok(creacion > 0 && activacion > creacion, "la activación se emite antes de tener carta");
  assert.ok(activacion < cuerpo.indexOf("router.replace(CARTA_TAB_ROUTE"));
});

test("el registro se emite en el alta y nunca en un ingreso", () => {
  const cuerpo = codigo(cuenta);
  // Rama de email: `flowRef` separa el alta del ingreso, y sólo la rama `signUp`
  // emite. La confirmación va ANTES del intento; la cuenta creada, después de
  // activar la sesión.
  const rama = cuerpo.indexOf('if (flowRef.current === "signUp") {');
  const submitted = cuerpo.indexOf("trackSignupSubmitted()", rama);
  const intento = cuerpo.indexOf("attemptEmailAddressVerification", rama);
  const activar = cuerpo.indexOf("await setActiveSignUp(", rama);
  const completed = cuerpo.indexOf("trackSignupCompleted()", rama);
  assert.ok(rama > 0 && submitted > rama, "la rama del alta no emite la confirmación");
  assert.ok(submitted < intento, "la confirmación se emite después del intento");
  assert.ok(activar < completed, "la cuenta se cuenta antes de tener sesión");
  // Rama de ingreso (`attemptFirstFactor`) y pantalla de login: sin eventos.
  const ingreso = cuerpo.indexOf("attemptFirstFactor");
  assert.ok(ingreso > 0);
  assert.ok(!cuerpo.slice(ingreso).includes("trackSignup"), "un ingreso emite eventos de alta");
  // Proveedor externo: sólo la cuenta nueva. Un ingreso con Google o Apple a una
  // cuenta que ya existía no emite ninguno de los dos.
  assert.equal((cuerpo.match(/outcome === "new_account"\) trackSignup/g) ?? []).length, 2);
  assert.ok(!/existing_account"\) trackSignup/.test(cuerpo));
});

test("la impresión de la oferta se mide donde hay oferta, y el intento donde se confirma", () => {
  const cuerpo = codigo(paywallDelAlta);
  // La misma condición que dibuja la tarjeta de plan: cargada, con plan y sin
  // Plus activo. Ni en carga, ni en error, ni con la compra ya hecha.
  assert.match(cuerpo, /const ofertaVisible = !isPro && phase === "disponible" && plan !== null;/);
  assert.match(cuerpo, /if \(!ofertaVisible\) return;\n\s*trackPaywallViewed\(\);\n\s*\}, \[ofertaVisible\]\);/);
  // El intento sale del toque confirmado, después del guard que ya evitaba dos
  // sesiones de pago por un doble tap.
  const guard = cuerpo.indexOf("if (checkoutLock.current || phase !== \"disponible\") return;");
  const intento = cuerpo.indexOf("trackCheckoutStarted(checkoutAttempt.current)");
  assert.ok(guard > 0 && intento > guard);
  assert.ok(intento < cuerpo.indexOf("createCheckout({ plan:"));
  // El número lo lleva un ref y se incrementa en el toque confirmado: un
  // reintento después de un error es OTRO intento, y crea otra sesión de pago.
  assert.match(cuerpo, /checkoutAttempt\.current \+= 1;\n\s*trackCheckoutStarted\(checkoutAttempt\.current\);/);
});

test("el lanzador de pago mide el intento y no una impresión que no existe", () => {
  // `/paywall` no muestra oferta: monta, crea la sesión y redirige. Contar una
  // impresión ahí sería contar una paywall en estado de carga, que el contrato
  // descarta expresamente.
  const cuerpo = codigo(lanzador);
  assert.equal((cuerpo.match(/trackCheckoutStarted\(attempt\)/g) ?? []).length, 1);
  assert.ok(!cuerpo.includes("trackPaywallViewed"), "el lanzador cuenta una impresión inexistente");
  assert.match(cuerpo, /startedFor\.current = attempt;\n\s*trackCheckoutStarted\(attempt\);/);
});

test("la pantalla de retorno pasa las DOS autoridades, y no decide ninguna", () => {
  const cuerpo = codigo(vuelta);
  assert.equal((cuerpo.match(/trackPurchaseCompleted\(/g) ?? []).length, 1);
  // `active` lo dice el backend después de verificar el webhook: ni la URL de
  // retorno, ni un cobro pendiente, ni uno fallido conceden nada.
  assert.ok(cuerpo.includes("getCheckoutStatus({ sessionId"));
  // Y la segunda autoridad, la que separa el cobro de la prueba: el estado real
  // de la suscripción, con su dueño, que `getCheckoutStatus` no puede contestar.
  assert.ok(
    cuerpo.includes("useQuery(appApi.subscriptions.getCurrent"),
    "la pantalla no consulta el estado que distingue la prueba del cobro"
  );
  assert.match(cuerpo, /checkoutStatus: status,/);
  assert.match(cuerpo, /subscriptionStatus: subscription\?\.status \?\? null,/);
  assert.match(cuerpo, /subscriptionOwner: subscription\?\.clerkUserId \?\? null,/);
  assert.match(cuerpo, /sessionOwner: auth\?\.userId \?\? null,/);
  // Ningún `if` de negocio en la pantalla: la regla vive en el módulo puro.
  assert.doesNotMatch(cuerpo, /if \(status !== "active"\) return;\s*trackPurchaseCompleted/);
});

test("ninguna otra pantalla del producto emite eventos de producto", () => {
  const web = [...reachableFrom(rutasDeApp(), "web")].filter((modulo) => /\.(t|j)sx?$/.test(modulo));
  const emisores = web.filter((modulo) => codigo(leer(modulo)).includes("@/analytics/productTelemetry"));
  assert.deepEqual(emisores.sort(), [
    "src/components/web/orbita-checkout-return.tsx",
    "src/components/web/orbita-paywall.tsx",
    // Los dos de la identidad, y ningún otro: el arranque de cuenta (identify y
    // el reset del cambio de cuenta) y el Perfil (logout y eliminación).
    "src/hooks/useAccountBootstrap.tsx",
    "src/onboarding/OnboardingFlow.tsx",
    "src/onboarding/screens/OnboardingPaywallScreen.web.tsx",
    "src/onboarding/useAccount.ts",
    "src/screens/PerfilScreen.tsx"
  ]);
});

// --- 7 bis. La identidad de persona ------------------------------------------

test("identify sale con un identificador INTERNO del contrato, y con ninguna otra cosa", () => {
  // Quién es un identificador válido lo decide el CONTRATO, no una heurística
  // de acá: el origen tiene que estar en su catálogo cerrado y el valor tiene que
  // tener la forma exacta que ese emisor produce.
  assert.ok(isStableInternalIdentifier(identidadDe(CUENTA_A)));
  const buena = decideIdentify(identidadDe(CUENTA_A));
  assert.deepEqual(buena, { identify: true, distinctId: CUENTA_A });

  // Nada de PII, y nada que el contrato no declare. Un email, un nombre, un id
  // de otra base o un valor suelto sin origen no identifican a nadie.
  const rechazados: unknown[] = [
    { source: "account", value: "lucas@orbitaastrologia.xyz" },
    { source: "account", value: "Lucas Ramos" },
    // El `_id` de la fila de Convex: es interno y es estable, pero el contrato
    // no declara un emisor con su formato, así que hoy no puede identificar.
    { source: "account", value: "jd7dkm93n4pqr82vx5hy6tzw1c" },
    { source: "convex", value: CUENTA_A },
    { source: "installation", value: CUENTA_A },
    CUENTA_A,
    null,
    undefined
  ];
  for (const valor of rechazados) {
    assert.deepEqual(
      decideIdentify(valor),
      { identify: false, reason: "not_internal_identifier" },
      JSON.stringify(valor)
    );
  }

  // Y el que no valida NO identifica: el contrato se cierra en vez de dejar
  // pasar cualquier cosa.
  const carga = cargaNueva();
  for (const valor of rechazados) identifyPerson(valor, carga.identidad);
  assert.deepEqual(carga.identificados, []);
  assert.equal(identifiedPerson(), null);
  assert.equal(carga.avisos.length, rechazados.length);
  for (const aviso of carga.avisos) {
    assert.equal(aviso, "[orbita] identify no emitido: not_internal_identifier");
    // El aviso no puede llevar adentro el valor que se rechazó, que es
    // justamente el que podría ser PII.
    assert.doesNotMatch(aviso, /@|user_|Lucas/);
  }
});

test("identify no lleva propiedades de persona: el puerto ni siquiera las recibe", () => {
  // La promesa "identify sólo con el identificador" no depende de que nadie se
  // acuerde en el llamado: el puerto recibe UN string y nada más.
  const carga = cargaNueva();
  identifyPerson(identidadDe(CUENTA_A), carga.identidad);
  assert.deepEqual(carga.identificados, [CUENTA_A]);
  assert.match(codigo(decision), /identify: \(distinctId: string\) => void;/);
  assert.match(codigo(puente), /ensureClient\(\)\?\.identify\(distinctId\)/);
  // Un segundo argumento en el llamado del SDK sería `$set`.
  assert.doesNotMatch(codigo(puente), /\.identify\([^)]*,/);
});

test("`$set` y `$set_once` no salen ni por la puerta de identify", () => {
  // Cinturón sobre tirante: aunque alguien pasara propiedades de persona, el
  // último punto antes de la red las anula. Y `$identify` sí sale —si se
  // descartara, `identify` sería una línea sin efecto.
  const antes = beforeSendWith(() => null);
  const salida = antes({
    uuid: "1",
    event: IDENTITY_EVENT,
    properties: {
      distinct_id: CUENTA_A,
      $anon_distinct_id: "0192-anonimo",
      $current_url: "https://orbitaastrologia.xyz/paywall?utm_source=news",
      $referrer: "https://www.google.com/search?q=orbita"
    },
    $set: { email: "lucas@orbitaastrologia.xyz" },
    $set_once: { $initial_current_url: "https://orbitaastrologia.xyz/?gclid=abc" }
  } as never) as {
    event: string;
    properties: Record<string, unknown>;
    $set?: unknown;
    $set_once?: unknown;
  } | null;

  assert.ok(salida, "`$identify` se descartó: identify no llegaría nunca");
  assert.equal(salida.event, IDENTITY_EVENT);
  assert.equal(salida.$set, undefined);
  assert.equal(salida.$set_once, undefined);
  // Sólo el identificador y el anónimo anterior, que es lo que ata la visita de
  // antes del login con la cuenta. Ni URL, ni referrer, ni campaña.
  assert.deepEqual(Object.keys(salida.properties).sort(), ["$anon_distinct_id", "distinct_id"]);
  assert.ok(TRANSPORT_PROPERTY_NAMES.includes("$anon_distinct_id"));
});

test("el filtro sigue cerrado: `$identify` es la ÚNICA excepción al diccionario", () => {
  const antes = beforeSendWith(() => null);
  const pasa = (event: string) =>
    antes({ uuid: "1", event, properties: { distinct_id: "d" } } as never) !== null;
  assert.equal(pasa(IDENTITY_EVENT), true);
  assert.equal(pasa("$pageview"), true);
  for (const otro of [
    "$create_alias",
    "$groupidentify",
    "$set",
    "page_view",
    "$web_vitals",
    "$exception",
    "survey shown",
    "$feature_flag_called"
  ]) {
    assert.equal(pasa(otro), false, `${otro} salió`);
  }
});

test("reset corre en los cuatro motivos del contrato, y en ningún otro", () => {
  // La lista NO se escribe acá: es la del contrato, leída del contrato.
  assert.deepEqual([...RESET_TRIGGERS], [
    "logout",
    "account_switch",
    "account_deletion",
    "consent_withdrawn"
  ]);
  for (const motivo of RESET_TRIGGERS) {
    const carga = cargaNueva();
    identifyPerson(identidadDe(CUENTA_A), carga.identidad);
    assert.equal(resetIdentityFor(motivo, carga.identidad), true, motivo);
    assert.equal(carga.reinicios.length, 1, motivo);
    assert.equal(identifiedPerson(), null, motivo);
  }
  for (const inventado of ["session_expired", "logOut", "", null, undefined, "reset"]) {
    const carga = cargaNueva();
    assert.equal(resetIdentityFor(inventado, carga.identidad), false, String(inventado));
    assert.deepEqual(carga.reinicios, [], String(inventado));
    assert.deepEqual(carga.avisos, ["[orbita] reset no aplicado: motivo fuera del contrato"]);
  }
});

test("el reset ocurre ANTES de la captura siguiente, y reinicia la deduplicación", () => {
  // El caso real que estaba roto: crear cuenta, cerrar sesión y crear otra en la
  // MISMA pestaña. Con la deduplicación atada al documento, el segundo alta no
  // emitía nada — y el embudo perdía una cuenta entera.
  const carga = cargaNueva();
  identifyPerson(identidadDe(CUENTA_A), carga.identidad);
  emitProductEvent({ name: "signup_submitted" }, carga.puerto);
  emitProductEvent({ name: "signup_completed" }, carga.puerto);

  resetIdentityFor("logout", carga.identidad);

  identifyPerson(identidadDe(CUENTA_B), carga.identidad);
  emitProductEvent({ name: "signup_submitted" }, carga.puerto);
  emitProductEvent({ name: "signup_completed" }, carga.puerto);

  assert.deepEqual(carga.eventos.map((e) => e.name), [
    "signup_submitted",
    "signup_completed",
    "signup_submitted",
    "signup_completed"
  ]);
  // Y en el orden real: el reset cae entre las dos altas, nunca después.
  assert.deepEqual(carga.linea, [
    `identify:${CUENTA_A}`,
    "captura:signup_submitted",
    "captura:signup_completed",
    "reset",
    "olvida",
    `identify:${CUENTA_B}`,
    "captura:signup_submitted",
    "captura:signup_completed"
  ]);
});

test("el reset borra también la marca de la pestaña: no es del documento, es de la persona", () => {
  const carga = cargaNueva();
  identifyPerson(identidadDe(CUENTA_A), carga.identidad);
  emitProductEvent(compra(), carga.puerto);
  assert.equal(carga.memoria.size, 1);
  resetIdentityFor("account_deletion", carga.identidad);
  assert.equal(carga.memoria.size, 0, "la compra de la cuenta borrada sobrevivió en la pestaña");
});

test("identificar a OTRA persona resetea sola; identificar a la misma no hace nada", () => {
  // El SDK, ya identificado como A, IGNORA un identify con el id de B. Sin este
  // reset, los eventos de B se irían al perfil de A por cualquier camino de
  // cambio de cuenta que no pasara por el nombrado.
  const carga = cargaNueva();
  assert.equal(identifyPerson(identidadDe(CUENTA_A), carga.identidad), true);
  assert.equal(identifyPerson(identidadDe(CUENTA_A), carga.identidad), false, "identificó dos veces");
  assert.deepEqual(carga.linea, [`identify:${CUENTA_A}`]);

  assert.equal(identifyPerson(identidadDe(CUENTA_B), carga.identidad), true);
  assert.deepEqual(carga.linea, [
    `identify:${CUENTA_A}`,
    "reset",
    "olvida",
    `identify:${CUENTA_B}`
  ]);
  assert.equal(identifiedPerson(), CUENTA_B);
});

test("sin alias: el flujo normal no usa el único emisor que el contrato reserva", () => {
  for (const fuente of [
    decision,
    puente,
    puenteNativo,
    alta,
    cuenta,
    paywallDelAlta,
    lanzador,
    vuelta,
    arranqueDeCuenta,
    perfil,
    eliminacion
  ]) {
    assert.doesNotMatch(codigo(fuente), /\.alias\(|createAlias|\$create_alias/);
  }
  // El contrato lo declara para unir DOS emisores distintos sobre la misma
  // persona, y esta tarjeta no tiene ese caso: el distinct ID anónimo viaja
  // desde la primera visita y `identify` lo ata solo.
  assert.match(contrato, /alias/i);
});

test("los tres momentos del reset están cableados donde ocurren de verdad", () => {
  // El cambio de cuenta, en la ÚNICA transacción que lo detecta, y antes de
  // tocar nada: el orden se prueba ejecutando en `accountBootstrapTx.test.ts`.
  assert.match(codigo(arranqueDeCuenta), /deps\.resetAnalyticsIdentity\("account_switch"\);/);
  assert.match(codigo(arranqueDeCuenta), /deps\.identifyAccount\(clerkUserId\);/);
  // El logout, con la sesión ya cerrada.
  const cierre = codigo(perfil);
  const salir = cierre.indexOf("await auth.signOut();");
  const reinicio = cierre.indexOf('resetAnalyticsIdentity("logout")');
  assert.ok(salir > 0 && reinicio > salir, "el logout no resetea, o resetea antes de cerrar sesión");
  // La eliminación, como paso del flujo y con el marcador ya escrito.
  assert.match(codigo(perfil), /resetAnalyticsIdentity: \(\) => resetAnalyticsIdentity\("account_deletion"\)/);
  const borrado = codigo(eliminacion);
  const marcador = borrado.indexOf("await steps.markDeletionRequested();");
  const corte = borrado.indexOf("steps.resetAnalyticsIdentity();");
  // Y no puede abortar el borrado: la telemetría nunca manda sobre una
  // eliminación de cuenta que ya quedó escrita en disco.
  assert.match(borrado, /try \{\s*steps\.resetAnalyticsIdentity\(\);\s*\} catch \{/);
  assert.ok(marcador > 0 && corte > marcador, "la eliminación no resetea después del marcador");
  assert.ok(
    corte < borrado.indexOf('return { status: "handoff"'),
    "resetea después de entregar el control"
  );
});

// --- 7 ter. La compra es un cobro, no una prueba gratuita --------------------

test("la prueba gratuita de siete días NO es una compra", () => {
  // El estado que llega al retorno COLAPSA la prueba en `active`: la unión de
  // `getCheckoutStatus` tiene tres literales y el entitlement trata `trialing`
  // como acceso concedido. La segunda autoridad es la que lo desarma.
  assert.deepEqual(decidePurchaseFact({ ...COBRO, subscriptionStatus: "trialing" }), {
    charged: false,
    reason: "free_trial"
  });
  const carga = cargaNueva();
  emitProductEvent(compra({ subscriptionStatus: "trialing" }), carga.puerto);
  assert.deepEqual(carga.eventos, [], "una prueba gratuita se contó como conversión");
  assert.deepEqual(carga.anotados, [], "una prueba gratuita dejó marca de compra");
  // Y no es un defecto: es la conducta correcta, así que no escribe un aviso.
  assert.deepEqual(carga.avisos, []);
});

test("ni pendiente, ni fallido, ni cancelado, ni de otra cuenta", () => {
  const casos: Array<[Partial<PurchaseSignal>, string]> = [
    [{ checkoutStatus: "pending" }, "checkout_unconfirmed"],
    [{ checkoutStatus: "failed" }, "checkout_unconfirmed"],
    [{ checkoutStatus: null }, "checkout_unconfirmed"],
    [{ subscriptionStatus: undefined }, "subscription_unknown"],
    [{ subscriptionStatus: "" }, "subscription_unknown"],
    // La query conserva su último valor mientras la nueva resuelve: en un
    // cambio A → B, el estado de A queda publicado bajo la sesión de B.
    [{ subscriptionOwner: CUENTA_B }, "owner_mismatch"],
    [{ subscriptionOwner: null }, "owner_mismatch"],
    [{ sessionOwner: null }, "owner_mismatch"],
    [{ subscriptionStatus: "trialing" }, "free_trial"],
    [{ subscriptionStatus: "past_due" }, "not_charged"],
    [{ subscriptionStatus: "billing_issue" }, "not_charged"],
    [{ subscriptionStatus: "canceled" }, "not_charged"],
    [{ subscriptionStatus: "expired" }, "not_charged"],
    [{ subscriptionStatus: "inactive" }, "not_charged"]
  ];
  for (const [cambio, razon] of casos) {
    assert.deepEqual(
      decidePurchaseFact({ ...COBRO, ...cambio }),
      { charged: false, reason: razon },
      JSON.stringify(cambio)
    );
    const carga = cargaNueva();
    emitProductEvent(compra(cambio), carga.puerto);
    assert.deepEqual(carga.eventos, [], JSON.stringify(cambio));
  }
  // Y el cobro real sí sale, con la misma función y sin ningún cambio.
  assert.deepEqual(decidePurchaseFact(COBRO), { charged: true, fact: purchaseFact(COBRO.periodEnd) });
});

test("los siete estados de la suscripción están contemplados, y sólo uno cobra", () => {
  // La lista sale del esquema de Convex y no de la memoria de nadie.
  const esquema = leer("convex/schema.ts");
  const bloque = esquema.slice(esquema.indexOf("const subscriptionStatus = v.union("));
  const estados = [...bloque.slice(0, bloque.indexOf(");")).matchAll(/v\.literal\("(\w+)"\)/g)].map(
    (m) => m[1]
  );
  assert.deepEqual(estados, [
    "inactive",
    "trialing",
    "active",
    "past_due",
    "billing_issue",
    "canceled",
    "expired"
  ]);
  const cobran = estados.filter(
    (estado) => decidePurchaseFact({ ...COBRO, subscriptionStatus: estado }).charged
  );
  assert.deepEqual(cobran, ["active"], "más de un estado cuenta como cobro");
});

test("un segundo checkout confirmado por la persona SÍ se cuenta", () => {
  // El contrato descarta "un reintento AUTOMÁTICO del mismo intento ya contado",
  // no el que alguien vuelve a confirmar después de un error: ése crea otra
  // sesión de pago real, así que es otra intención de pagar.
  const carga = cargaNueva();
  emitProductEvent({ name: "checkout_started", attempt: 1 }, carga.puerto);
  emitProductEvent({ name: "checkout_started", attempt: 1 }, carga.puerto); // remontaje
  emitProductEvent({ name: "checkout_started", attempt: 1 }, carga.puerto); // StrictMode
  assert.equal(carga.eventos.length, 1, "un remontaje contó un intento que no existió");
  emitProductEvent({ name: "checkout_started", attempt: 2 }, carga.puerto);
  assert.equal(carga.eventos.length, 2, "el reintento confirmado no se contó");
});

test("el paso montado y todavía NO pintado no se cuenta; el mismo paso pintado sí", () => {
  // El defecto que cierra: el alta devuelve una vista vacía mientras las fuentes
  // no cargaron. Ahí el componente ya está montado y su `step` ya vale, y no hay
  // nada que ver — el disparador del contrato es "montado y VISIBLE".
  const carga = cargaNueva();
  for (let i = 0; i < 5; i++) {
    emitProductEvent(pasoDelAlta(PASOS_DEL_ALTA.STEP_BIRTHDATE, { visible: false }), carga.puerto);
  }
  assert.equal(carga.eventos.length, 0, "se contó un paso que todavía no se veía");
  assert.equal(carga.avisos.length, 0, "esperar a que se pinte no es un defecto que avisar");

  // Las fuentes cargaron: el mismo paso, ahora sí.
  emitProductEvent(pasoDelAlta(PASOS_DEL_ALTA.STEP_BIRTHDATE), carga.puerto);
  assert.deepEqual(
    carga.eventos.map((e) => (e.properties as { onboarding_step: OnboardingStep }).onboarding_step),
    ["birthdate"]
  );
  // Y no se cuenta dos veces por haber esperado.
  emitProductEvent(pasoDelAlta(PASOS_DEL_ALTA.STEP_BIRTHDATE), carga.puerto);
  assert.equal(carga.eventos.length, 1);
});

test("la señal de «listo para mostrar» es la MISMA que decide qué se pinta", () => {
  // Si el conteo mirara una condición parecida pero no la misma, volvería a
  // separarse de lo que hay en pantalla. Acá hay una sola constante, y el render
  // vacío cuelga de ella.
  const cuerpo = codigo(alta);
  assert.match(cuerpo, /const pasoVisible = fontsLoaded;/);
  assert.match(cuerpo, /if \(!pasoVisible\) return <View style=\{styles\.fill\} \/>;/);
  assert.ok(!cuerpo.includes("if (!fontsLoaded) return"), "quedó una segunda definición de visible");
});

// --- 8. Nativo: ni SDK, ni contrato, ni evento -------------------------------

test("las dos variantes del puente exportan la MISMA firma", async () => {
  // Quien las importa no sabe en qué plataforma está, así que una variante que
  // exportara de menos —o con otro argumento— rompería el alta recién al
  // correrla en ese bundle. El typecheck no lo cubre: TypeScript resuelve el
  // alias a la variante web y nunca compara las dos.
  //
  // La comparación de las firmas es sobre la fuente porque el puente web no se
  // puede importar en Node: arrastra el SDK y react-native, que es justamente el
  // motivo por el que la variante inerte existe. El nativo, que no importa nada,
  // sí se ejecuta de verdad.
  const firmas = (fuente: string) =>
    [...codigo(fuente).matchAll(/export function (\w+\([^)]*\): \w+)/g)].map((m) => m[1]).sort();

  assert.equal(firmas(puente).length, 9);
  assert.deepEqual(firmas(puenteNativo), firmas(puente));

  const nativo = await import("../src/analytics/productTelemetry.native");
  assert.deepEqual(
    Object.keys(nativo).sort(),
    firmas(puente).map((firma) => firma.slice(0, firma.indexOf("("))).sort()
  );
  for (const nombre of Object.keys(nativo) as Array<keyof typeof nativo>) {
    assert.equal(typeof nativo[nombre], "function", `nativo no exporta ${nombre}`);
  }
  // Y no hacen nada: llamarlas en nativo no puede fallar ni devolver un evento.
  assert.equal(
    nativo.trackOnboardingStepViewed({
      step: 0,
      visible: true,
      inspecting: false,
      sessionActive: false
    }),
    undefined
  );
  assert.equal(nativo.trackPurchaseCompleted(COBRO), undefined);
  assert.equal(nativo.identifyAccount(CUENTA_A), undefined);
  assert.equal(nativo.resetAnalyticsIdentity("logout"), undefined);
});

test("la variante nativa no importa nada y no puede alcanzar la telemetría", () => {
  // No es que no capture: no LLEGA. Sin un solo import que sobreviva al
  // empaquetado, desde ahí no hay camino al SDK, a la decisión ni al contrato.
  assert.deepEqual(importsOf(join(ROOT, "src/analytics/productTelemetry.native.ts")), []);
  assert.equal(
    pathTo("src/analytics/productTelemetry.native.ts", (rel) => rel.includes("analytics/"), "native"),
    null
  );
  assert.doesNotMatch(codigo(puenteNativo), /useEffect|capture|posthog/);
});

test("Metro elige la variante inerte en los dos puntos de emisión COMPARTIDOS", () => {
  // `OnboardingFlow.tsx` y `useAccount.ts` no tienen variante `.web`: el mismo
  // archivo se empaqueta para iOS y para Android. Quién contesta este import es
  // lo único que separa una app nativa que no mide de una web que sí. Es el
  // defecto que la revisión de CORE-183 rechazó, y se comprueba acá.
  for (const compartido of COMPARTIDOS) {
    const desde = join(ROOT, compartido);
    assert.equal(
      resolveModule(desde, "@/analytics/productTelemetry", "native"),
      join(ROOT, "src/analytics/productTelemetry.native.ts"),
      compartido
    );
    assert.equal(
      resolveModule(desde, "@/analytics/productTelemetry", "web"),
      join(ROOT, "src/analytics/productTelemetry.ts"),
      compartido
    );
  }
});

test("la telemetría web no entra al bundle nativo por el alta", () => {
  const nativo = reachableFrom(rutasDeApp(), "native");
  // Si estos dos dejaran de estar en el grafo nativo, esta prueba dejaría de
  // probar algo: son los archivos compartidos que emiten.
  for (const compartido of COMPARTIDOS) {
    assert.ok(nativo.has(compartido), `${compartido} no está en el grafo nativo`);
  }
  assert.ok(nativo.has("src/analytics/productTelemetry.native.ts"), "no se empaqueta la variante inerte");
  for (const modulo of [
    "src/analytics/productTelemetry.ts",
    "src/analytics/productEvents.ts",
    "src/analytics/webTelemetry.tsx",
    "src/analytics/webClientOptions.ts",
    "src/analytics/routeClassification.ts",
    "src/analytics/pageviewStream.ts",
    "src/analytics/bootState.ts",
    "src/components/web/orbita-paywall.tsx",
    "src/components/web/orbita-checkout-return.tsx",
    "src/onboarding/screens/OnboardingPaywallScreen.web.tsx"
  ]) {
    assert.ok(!nativo.has(modulo), `${modulo} llega al bundle nativo`);
  }
  // Y el SDK tampoco, por ningún camino.
  for (const modulo of nativo) {
    if (!/\.(t|j)sx?$/.test(modulo)) continue;
    for (const spec of importsOf(join(ROOT, modulo))) {
      assert.doesNotMatch(spec, /^posthog-js/, `${modulo} arrastra el SDK a nativo`);
    }
  }
});

test("la web sí mide: el mismo grafo, del otro lado", () => {
  // Sin esto, borrar la telemetría entera dejaría la prueba de arriba en verde.
  const web = reachableFrom(rutasDeApp(), "web");
  for (const modulo of [
    "src/analytics/productTelemetry.ts",
    "src/analytics/productEvents.ts",
    "src/analytics/webTelemetry.tsx",
    "src/components/web/orbita-paywall.tsx",
    "src/components/web/orbita-checkout-return.tsx",
    "src/onboarding/screens/OnboardingPaywallScreen.web.tsx"
  ]) {
    assert.ok(web.has(modulo), `${modulo} desapareció del bundle de la web`);
  }
  assert.ok(!web.has("src/analytics/productTelemetry.native.ts"), "la web resuelve la variante inerte");
});

test("el cliente del SDK sigue siendo UNO solo en toda la web", () => {
  // Dos `init` serían dos distinct IDs anónimos y dos configuraciones: la misma
  // persona quedaría partida en dos. El puente captura por `ensureClient()`.
  const web = [...reachableFrom(rutasDeApp(), "web")].filter((modulo) => /\.(t|j)sx?$/.test(modulo));
  const conSdk = web.filter((modulo) =>
    importsOf(join(ROOT, modulo)).some((spec) => /^posthog-js/.test(spec))
  );
  assert.deepEqual(conSdk, ["src/analytics/webTelemetry.tsx"]);
  assert.match(codigo(puente), /ensureClient\(\)\?\.capture\(event, properties\)/);
  assert.equal((leer("src/analytics/webTelemetry.tsx").match(/posthog\.init\(/g) ?? []).length, 1);
});

// --- 9. El documento del contrato no cambió ----------------------------------

test("esta tarjeta emite el contrato vigente y no lo redefine", () => {
  // El contrato es de CORE-187 y CORE-313: acá se captura, no se define. Si esta
  // tarjeta hubiera necesitado tocarlo, la versión habría cambiado.
  assert.equal(CONTRACT_VERSION, "1.1.0");
  assert.match(contrato, /# Contrato de eventos de Órbita — v1\.1\.0/);
  assert.deepEqual([...ONBOARDING_STEP_PROPERTIES], ["onboarding_step"]);
  assert.equal(EVENT_NAMES.length, 8);
  // Y el emisor viaja con el validador: lo que sale pasa la misma puerta que lo
  // que entra.
  for (const hecho of HECHOS) {
    const d = decideProductEvent({ ...hecho, environment: "production" });
    assert.ok(d.emit);
    const p = d.properties as unknown as Record<string, unknown>;
    assert.equal(p.contract_version, CONTRACT_VERSION);
  }
});

test("el embudo del documento se puede armar con lo que esta tarjeta emite", () => {
  // La secuencia de la sección 6 del contrato, de punta a punta.
  const carga = cargaNueva();
  emitProductEvent(pasoDelAlta(PASOS_DEL_ALTA.STEP_AUTH), carga.puerto);
  emitProductEvent({ name: "signup_submitted" }, carga.puerto);
  emitProductEvent({ name: "signup_completed" }, carga.puerto);
  for (const paso of [
    PASOS_DEL_ALTA.STEP_BIRTHDATE,
    PASOS_DEL_ALTA.STEP_BIRTHPLACE,
    PASOS_DEL_ALTA.STEP_BIRTHTIME,
    PASOS_DEL_ALTA.STEP_SUMMARY,
    PASOS_DEL_ALTA.STEP_PAYWALL
  ]) {
    emitProductEvent(pasoDelAlta(paso), carga.puerto);
  }
  emitProductEvent({ name: "onboarding_completed" }, carga.puerto);
  emitProductEvent({ name: "paywall_viewed" }, carga.puerto);
  emitProductEvent({ name: "checkout_started", attempt: 1 }, carga.puerto);
  emitProductEvent(compra(), carga.puerto);

  assert.deepEqual(
    carga.eventos.map((e) => e.name),
    [
      "onboarding_step_viewed",
      "signup_submitted",
      "signup_completed",
      "onboarding_step_viewed",
      "onboarding_step_viewed",
      "onboarding_step_viewed",
      "onboarding_step_viewed",
      "onboarding_step_viewed",
      "onboarding_completed",
      "paywall_viewed",
      "checkout_started",
      "purchase_completed"
    ]
  );
  // Los ocho eventos del contrato menos la visita: los siete salieron.
  const emitidos = new Set<EventName>(carga.eventos.map((e) => e.name));
  assert.deepEqual([...emitidos].sort(), [...PRODUCT_EVENT_NAMES].sort());
  // Y ninguno salió sin pasar por el validador.
  for (const evento of carga.eventos) {
    assert.deepEqual(validateEvent({ name: evento.name, properties: evento.properties }).issues, []);
  }
});
