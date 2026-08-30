/**
 * Canje de códigos de oferta de Apple — garantías de superficie y de autoridad.
 *
 * La feature es deliberadamente chica: un botón abre la hoja que Apple controla
 * y nadie más opina. Lo que hay que demostrar, entonces, no es que "funcione"
 * —eso lo prueba un iPhone con una cuenta Sandbox— sino que NO haya adquirido
 * poderes que no le corresponden:
 *
 * - que el canje entre por la misma cola serial que el resto del comercio;
 * - que el bundle web no pueda alcanzar StoreKit por esta puerta nueva;
 * - que el botón diga exactamente el copy aprobado, en las dos paywalls
 *   nativas y en ninguna web;
 * - que NO toque el marcador anti doble cobro ni escriba entitlement;
 * - y que el webhook existente siga resolviendo `orbita_pro` cuando la compra
 *   inicial llega con metadata de código de oferta.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { resolveEntitlement } from "../convex/lib/entitlements";
import { deriveRevenueCatEventDecision } from "../convex/lib/revenueCatEvents";
import { applyRevenueCatEvent } from "../convex/payments/revenuecat";
import { importsOf, reachableFrom, ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** El copy aprobado, exacto. Si esto cambia, cambió el contrato con Lucas. */
const COPY = "Canjear código de descuento";

const MODULE_DIR = "modules/orbita-offer-codes";
const CLIENT = leer("src/services/revenuecat/client.ts");
const CLIENT_WEB = leer("src/services/revenuecat/client.web.ts");
const PROVIDER = leer("src/services/revenuecat/RevenueCatProvider.tsx");
const PROVIDER_WEB = leer("src/services/revenuecat/RevenueCatProvider.web.tsx");
const TYPES = leer("src/services/revenuecat/types.ts");
const PAYWALL_APP = leer("src/screens/v492/PlusPaywallScreen.tsx");
const PAYWALL_ONB = leer("src/onboarding/screens/OnboardingPaywallScreen.tsx");
const PAYWALL_APP_WEB = leer("src/routes/v492/paywall.web.tsx");
const PAYWALL_ONB_WEB = leer("src/onboarding/screens/OnboardingPaywallScreen.web.tsx");

/** Expo Router mete en el grafo TODOS los archivos de `app/`. */
function routeEntries(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(t|j)sx?$/.test(name)) out.push(relative(ROOT, full));
    }
  };
  walk(join(ROOT, "app"));
  return out.sort();
}

/** El cuerpo de un handler: de su nombre hasta el `};` que lo cierra. */
function cuerpoDe(source: string, nombre: string): string {
  const start = source.indexOf(nombre);
  assert.ok(start > 0, `falta ${nombre}`);
  return source.slice(start, source.indexOf("\n  };", start));
}

// ---------------------------------------------------------------------------
// 1. El módulo local: un puente Apple, y nada más
// ---------------------------------------------------------------------------

describe("módulo local — un solo puente, sólo Apple", () => {
  it("se autolinkea como módulo Apple, sin vista, Android ni web", () => {
    const config = JSON.parse(leer(`${MODULE_DIR}/expo-module.config.json`));
    assert.deepEqual(config.platforms, ["apple"]);
    assert.deepEqual(config.apple.modules, ["OrbitaOfferCodesModule"]);
    assert.equal("android" in config, false, "el módulo no declara Android");
    assert.equal("web" in config, false, "el módulo no declara web");

    const archivos = readdirSync(join(ROOT, MODULE_DIR));
    assert.equal(archivos.includes("android"), false, "quedó boilerplate de Android");
    const src = readdirSync(join(ROOT, MODULE_DIR, "src"));
    assert.deepEqual(src, ["OrbitaOfferCodesModule.ts"], "quedó boilerplate de vista o web");
  });

  it("Swift usa StoreKit 2 en iOS 16+ y conserva el fallback de 15.1, en MainActor", () => {
    // Sobre el CÓDIGO, no sobre los comentarios que explican las dos APIs.
    const swift = sinComentarios(leer(`${MODULE_DIR}/ios/OrbitaOfferCodesModule.swift`));
    assert.match(swift, /import StoreKit/);
    assert.match(swift, /import UIKit/, "la escena de StoreKit 2 es de UIKit");
    assert.match(swift, /Name\("OrbitaOfferCodes"\)/);
    assert.match(swift, /AsyncFunction\("presentOfferCodeRedemptionSheet"\)/);

    // La API vigente, con la escena, detrás de una guarda de RUNTIME: un solo
    // binario cubre 15.1 y 16+.
    assert.match(swift, /if #available\(iOS 16\.0, \*\)/);
    assert.match(swift, /try await AppStore\.presentOfferCodeRedeemSheet\(in: scene\)/);
    // Y el fallback sigue existiendo: subir el piso dejaría sin canje a 15.1–15.x.
    assert.match(swift, /SKPaymentQueue\.default\(\)\.presentCodeRedemptionSheet\(\)/);
    assert.ok(
      swift.indexOf("AppStore.presentOfferCodeRedeemSheet") <
        swift.indexOf("SKPaymentQueue.default().presentCodeRedemptionSheet()"),
      "StoreKit 2 va en la rama moderna y StoreKit 1 en el `else`"
    );

    // UIKit y StoreKit exigen el hilo principal, dicho en las dos capas.
    assert.match(swift, /\.runOnQueue\(\.main\)/);
    assert.match(swift, /Task \{ @MainActor in/);
    assert.match(swift, /@MainActor\s+private func foregroundWindowScene\(\) -> UIWindowScene\?/);

    // Fuera de iOS no hay hoja: se rechaza, no se resuelve en silencio.
    assert.match(swift, /#if os\(iOS\) && !targetEnvironment\(macCatalyst\)/);
    assert.match(swift, /promise\.reject\(OfferCodeRedemptionUnavailableException\(\)\)/);
    // Y no se fabrica una hoja propia ni se toca el código de nadie.
    assert.equal(/UIAlertController|UITextField|SKProductDiscount/.test(swift), false);
  });

  it("sin escena en primer plano NO se presenta ni se resuelve: rechaza", () => {
    const swift = sinComentarios(leer(`${MODULE_DIR}/ios/OrbitaOfferCodesModule.swift`));
    // La escena tiene que estar ADELANTE: `connectedScenes` incluye escenas de
    // fondo, y presentar sobre una de ésas no muestra nada.
    assert.match(swift, /UIApplication\.shared\.connectedScenes/);
    assert.match(swift, /\.compactMap \{ \$0 as\? UIWindowScene \}/);
    assert.match(swift, /\.first \{ \$0\.activationState == \.foregroundActive \}/);
    // Falla cerrado: sin escena, ni presentación ni promesa resuelta.
    assert.match(
      swift,
      /guard let scene = foregroundWindowScene\(\) else \{\s*promise\.reject\(OfferCodeRedemptionNoSceneException\(\)\)\s*return\s*\}/
    );
    // No hay respaldo silencioso: nada de tomar "la primera escena que haya".
    assert.equal(
      /connectedScenes\.first\b|keyWindow|\.windows\.first/.test(swift),
      false,
      "no se presenta sobre una escena que no está en primer plano"
    );
    // Y un fallo de Apple al presentar tampoco se traga.
    assert.match(swift, /promise\.reject\(OfferCodeRedemptionFailedException\(\)\.causedBy\(error\)\)/);
    // Sólo se resuelve después de presentar de verdad.
    assert.equal((swift.match(/promise\.resolve\(\)/g) ?? []).length, 2, "una resolución por rama");
  });

  it("el podspec apunta al piso real de la app y no arrastra tvOS", () => {
    // Sobre el CÓDIGO, no sobre el comentario que explica por qué no hay tvOS.
    const podspec = leer(`${MODULE_DIR}/ios/OrbitaOfferCodes.podspec`).replace(/^\s*#.*$/gm, "");
    // 15.1 y no 16: la API moderna se elige en runtime, no subiendo el piso.
    assert.match(podspec, /:ios => '15\.1'/);
    assert.equal(/:tvos\s*=>/.test(podspec), false, "la hoja de canje no existe en tvOS");
    assert.match(podspec, /s\.dependency 'ExpoModulesCore'/);
  });

  it("el binario sin el módulo falla cerrado en la llamada, no al importar", () => {
    const bridge = sinComentarios(leer(`${MODULE_DIR}/src/OrbitaOfferCodesModule.ts`));
    // `requireNativeModule` tira en el IMPORT: el build 28 se compiló antes de
    // que este módulo existiera y rompería la app entera al cargar el grafo.
    assert.match(bridge, /requireOptionalNativeModule/);
    assert.equal(/requireNativeModule\b/.test(bridge), false);
    const index = leer(`${MODULE_DIR}/index.ts`);
    assert.match(index, /if \(!OrbitaOfferCodesModule\) throw new Error\(OFFER_CODE_MODULE_UNAVAILABLE\)/);
  });

  it("el puente Apple es visible para git y para el tarball de EAS", () => {
    // `ios/` sin barra inicial matchea a cualquier profundidad: sin la
    // reexclusión, el podspec y el Swift quedaban fuera del repositorio y del
    // build, con la suite igual de verde.
    for (const archivo of [".gitignore", ".easignore"]) {
      assert.match(leer(archivo), /^!modules\/\*\*\/ios\/$/m, `${archivo} tapa el puente nativo`);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Servicio y provider: la misma cola que el resto del comercio
// ---------------------------------------------------------------------------

describe("servicio — el canje entra por la puerta de siempre", () => {
  it("el cliente nativo revalida identidad antes de presentar la hoja", () => {
    const start = CLIENT.indexOf("function presentNativeOfferCodeRedemption");
    assert.ok(start > 0, "falta la acción en el cliente nativo");
    const cuerpo = CLIENT.slice(start, start + 300);
    assert.match(cuerpo, /await requireMatchingUser\(userId\)/);
    assert.match(cuerpo, /await presentOfferCodeRedemptionSheet\(\)/);
    // El orden importa: primero la identidad, después la tienda.
    assert.ok(
      cuerpo.indexOf("requireMatchingUser(") < cuerpo.indexOf("presentOfferCodeRedemptionSheet("),
      "un canje bajo la identidad equivocada ata el beneficio a otra cuenta"
    );
  });

  it("no devuelve nada que pueda leerse como éxito", () => {
    assert.match(CLIENT, /export async function presentNativeOfferCodeRedemption\(userId: string\): Promise<void>/);
    assert.match(TYPES, /redeemOfferCode: \(\) => Promise<void>;/);
  });

  it("el provider lo serializa en la cola del SDK con el dueño capturado", () => {
    const cuerpo = PROVIDER.slice(
      PROVIDER.indexOf("const redeemOfferCode = useCallback"),
      PROVIDER.indexOf("const retry = useCallback")
    );
    assert.ok(cuerpo.length > 0, "falta la acción en el provider");
    assert.match(cuerpo, /await runOnStore\(async \(userId\) => \{/);
    assert.match(cuerpo, /await presentNativeOfferCodeRedemption\(userId\)/);
    // No publica estado de tienda: Apple no informó ningún resultado.
    assert.equal(
      /publishStoreState\(/.test(cuerpo),
      false,
      "presentar una hoja no es una respuesta de la tienda"
    );
  });

  it("REPRO: ninguna acción de tienda puede saltearse la cola", () => {
    // Gate de conteo: si aparece un camino nuevo al SDK, esto lo caza.
    const sin = sinComentarios(PROVIDER);
    const nombres = [
      "purchase",
      "restore",
      "presentCustomerCenter",
      "redeemOfferCode",
      "retry",
      "trackPaywallImpression",
      "refreshCustomerInfo"
    ];
    assert.equal((sin.match(/await runOnStore\(/g) ?? []).length, nombres.length);
    for (const nombre of nombres) {
      assert.match(sin, new RegExp(`const ${nombre} = useCallback[\\s\\S]{0,240}?await runOnStore\\(`), nombre);
    }
  });
});

describe("web — la puerta nueva no abre StoreKit en el bundle de Stripe", () => {
  it("ningún módulo del bundle web alcanza el puente nativo", () => {
    const alcanzados = [...reachableFrom(routeEntries(), "web")].filter((rel) =>
      rel.startsWith("modules/")
    );
    assert.deepEqual(alcanzados, [], "el bundle web no puede alcanzar el módulo Apple");
  });

  it("el bundle nativo SÍ lo alcanza (si no, la prueba anterior pasaría vacía)", () => {
    const alcanzados = [...reachableFrom(routeEntries(), "native")].filter((rel) =>
      rel.startsWith("modules/")
    );
    assert.ok(
      alcanzados.includes(`${MODULE_DIR}/index.ts`),
      `el puente debe estar en el grafo nativo; alcanzados: ${alcanzados.join(", ")}`
    );
  });

  it("el stub web del cliente declara la acción y no importa el módulo", () => {
    assert.match(CLIENT_WEB, /export async function presentNativeOfferCodeRedemption\(\): Promise<never>/);
    assert.equal(
      importsOf(join(ROOT, "src/services/revenuecat/client.web.ts")).some((spec) =>
        spec.includes("orbita-offer-codes")
      ),
      false
    );
    // Y el cliente NATIVO sí lo importa: si no, el stub no estaría tapando nada.
    assert.ok(
      importsOf(join(ROOT, "src/services/revenuecat/client.ts")).some((spec) =>
        spec.includes("orbita-offer-codes")
      )
    );
  });

  it("el provider web declara el mismo contrato inerte", () => {
    assert.match(PROVIDER_WEB, /redeemOfferCode: async \(\) => undefined/);
    assert.equal(
      importsOf(join(ROOT, "src/services/revenuecat/RevenueCatProvider.web.tsx")).some((spec) =>
        spec.includes("orbita-offer-codes")
      ),
      false
    );
  });
});

// ---------------------------------------------------------------------------
// 3. El botón: copy exacto, dos paywalls nativas, ninguna web
// ---------------------------------------------------------------------------

describe("botón — el copy aprobado, donde corresponde", () => {
  it("dice exactamente el copy aprobado en las DOS paywalls nativas", () => {
    for (const [nombre, fuente] of [
      ["in-app", PAYWALL_APP],
      ["onboarding", PAYWALL_ONB]
    ] as const) {
      assert.ok(fuente.includes(COPY), `${nombre}: falta el copy aprobado`);
      assert.match(fuente, new RegExp(`accessibilityLabel="${COPY}"`), nombre);
      assert.match(fuente, /accessibilityRole="button"/, nombre);
      assert.match(fuente, /accessibilityState=\{\{ disabled: busy \}\}/, nombre);
    }
  });

  it("NUNCA aparece en una superficie web", () => {
    for (const [nombre, fuente] of [
      ["paywall web", PAYWALL_APP_WEB],
      ["onboarding web", PAYWALL_ONB_WEB]
    ] as const) {
      assert.equal(fuente.includes(COPY), false, `${nombre}: el canje de Apple no existe en web`);
      assert.equal(/redeemOfferCode/.test(fuente), false, nombre);
    }
  });

  it("es una acción full-width con objetivo táctil de 54 y radio continuo", () => {
    for (const [nombre, fuente] of [
      ["in-app", PAYWALL_APP],
      ["onboarding", PAYWALL_ONB]
    ] as const) {
      const estilo = fuente.slice(fuente.indexOf("offerCodeButton: {"), fuente.indexOf("offerCodeText:"));
      assert.ok(estilo.length > 0, `${nombre}: falta el estilo del botón`);
      assert.match(estilo, /alignSelf: "stretch"/, `${nombre}: full-width`);
      assert.match(estilo, /minHeight: 54/, `${nombre}: objetivo táctil`);
      assert.match(estilo, /borderWidth: 1/, `${nombre}: borde`);
      assert.match(estilo, /borderCurve: "continuous"/, `${nombre}: radio continuo`);
      assert.match(fuente, /offerCodeText: \{[^}]*textAlign: "center"/, `${nombre}: label centrado`);
    }
  });

  it("se esconde sin iOS, sin oferta visible, con Plus ya activo o sin identidad", () => {
    // In-app: `activation === "idle"` cubre a la vez "el backend no dice Pro" y
    // "no hay compra ya aceptada".
    assert.match(
      sinComentarios(PAYWALL_APP),
      /const offerCodeVisible =\s*Platform\.OS === "ios" &&\s*entitlementResuelto &&\s*activation === "idle" &&\s*revenueCat\.phase === "ready" &&\s*identifiedUserId !== null;/
    );
    // Onboarding: la misma idea, más el modo inspección, que no ejecuta nada.
    assert.match(
      sinComentarios(PAYWALL_ONB),
      /const offerCodeVisible =\s*Platform\.OS === "ios" &&\s*!inspect &&\s*entitlementResuelto &&\s*backendIsPro !== true &&\s*!storeConfirmed &&\s*revenueCat\.phase === "ready" &&\s*identifiedUserId !== null;/
    );
    for (const fuente of [PAYWALL_APP, PAYWALL_ONB]) {
      assert.match(fuente, /\{offerCodeVisible \? \(/, "el botón cuelga de esa decisión");
    }
    assert.match(PAYWALL_ONB, /if \(inspect \|\| !offerCodeVisible\) return;/, "inspección no canjea");
  });

  it("dos toques no abren dos hojas: el candado por dueño y la protección de `busy`", () => {
    for (const [nombre, fuente] of [
      ["in-app", PAYWALL_APP],
      ["onboarding", PAYWALL_ONB]
    ] as const) {
      const cuerpo = cuerpoDe(fuente, "const redeemOfferCode = async");
      assert.match(cuerpo, /await runExclusive\(gate, async \(\) => \{/, nombre);
      assert.match(cuerpo, /setAction\(userId, "redeeming"\)/, nombre);
      assert.match(fuente, /onPress=\{busy \? undefined : \(\) => void redeemOfferCode\(\)\}/, nombre);
      assert.match(fuente, /disabled=\{busy\}/, nombre);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Lo que el canje NO puede hacer
// ---------------------------------------------------------------------------

describe("autoridad — el canje no cobra, no marca y no concede", () => {
  it("NO toca el marcador anti doble cobro", () => {
    // Abrir la hoja de códigos no es empezar la compra de un paquete: no hay
    // cargo en vuelo que proteger. Armarlo acá dejaría a la persona empujada a
    // "Restaurar" después de cerrar una hoja que nunca cobró nada.
    for (const [nombre, fuente] of [
      ["in-app", PAYWALL_APP],
      ["onboarding", PAYWALL_ONB]
    ] as const) {
      const cuerpo = cuerpoDe(fuente, "const redeemOfferCode = async");
      for (const prohibido of [
        "armStoreGuard",
        "storePurchaseGuard",
        "clearPurchaseGuard",
        "answerStore",
        "setSession"
      ]) {
        assert.equal(
          cuerpo.includes(prohibido),
          false,
          `${nombre}: el canje no puede tocar ${prohibido}`
        );
      }
    }
  });

  it("NO concede entitlement ni afirma éxito por haber abierto la hoja", () => {
    for (const [nombre, fuente] of [
      ["in-app", PAYWALL_APP],
      ["onboarding", PAYWALL_ONB]
    ] as const) {
      const cuerpo = cuerpoDe(fuente, "const redeemOfferCode = async");
      assert.equal(/setEntitlement|grantPro|setIsPro|setStoreIsPro/.test(cuerpo), false, nombre);
      // Nada de navegar a la Carta ni de anunciar acceso: Apple no informó nada.
      assert.equal(/onEnterCarta\(\)/.test(cuerpo), false, `${nombre}: un canje no demuestra acceso`);
      assert.equal(
        /store_confirmed/.test(cuerpo),
        false,
        `${nombre}: la tienda no confirmó ninguna compra`
      );
    }
  });

  it("después de presentar pide las DOS lecturas autoritativas que ya existen", () => {
    for (const [nombre, fuente] of [
      ["in-app", PAYWALL_APP],
      ["onboarding", PAYWALL_ONB]
    ] as const) {
      const cuerpo = cuerpoDe(fuente, "const redeemOfferCode = async");
      assert.match(cuerpo, /askBackendToReconcile\(\)/, `${nombre}: falta la reconciliación`);
      assert.match(cuerpo, /revenueCat\.refreshCustomerInfo\(\)/, `${nombre}: falta el refresh`);
      // Y el pedido al backend sólo si la cuenta sigue siendo la misma.
      assert.match(cuerpo, /if \(stillOwner\(userId\)\)/, nombre);
    }
  });

  it("sin confirmación, el copy es neutral y deja Restaurar a mano", () => {
    for (const [nombre, fuente] of [
      ["in-app", PAYWALL_APP],
      ["onboarding", PAYWALL_ONB]
    ] as const) {
      const cuerpo = cuerpoDe(fuente, "const redeemOfferCode = async");
      assert.match(cuerpo, /Apple lo está procesando/, nombre);
      assert.match(cuerpo, /Tu acceso se actualiza solo/, nombre);
      assert.match(cuerpo, /probá Restaurar/, nombre);
      // No se promete que el código haya sido válido ni aplicado.
      assert.equal(
        /canjeado con éxito|código aplicado|descuento aplicado/i.test(cuerpo),
        false,
        `${nombre}: no se afirma un canje que Apple no informó`
      );
    }
  });

  it("el cliente no lee, valida ni transporta el código", () => {
    // No hay input, ni tabla de cupones, ni validador, ni calculadora.
    const superficies = [PAYWALL_APP, PAYWALL_ONB, CLIENT, PROVIDER, leer(`${MODULE_DIR}/index.ts`)];
    for (const fuente of superficies) {
      assert.equal(/<TextInput|couponCode|promoCode|validateCode|discountPercent/.test(fuente), false);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Backend: el webhook vigente ya resuelve un canje, sin cambiarlo
// ---------------------------------------------------------------------------

type MemoryRow = Record<string, any> & { _id: string };

function revenueCatMemoryDb(seed: Record<string, MemoryRow[]>) {
  const initialRows: Record<string, MemoryRow[]> = {
    users: [],
    subscriptions: [],
    paymentEvents: [],
    ...seed
  };
  const rows = new Map<string, MemoryRow[]>(
    Object.entries(initialRows).map(([table, entries]) => [table, entries.map((e) => ({ ...e }))])
  );
  let sequence = 0;
  const db = {
    query(table: string) {
      const filters = new Map<string, unknown>();
      const q = {
        eq(field: string, value: unknown) {
          filters.set(field, value);
          return q;
        }
      };
      return {
        withIndex(_index: string, build: (builder: typeof q) => unknown) {
          build(q);
          const found = () =>
            (rows.get(table) ?? []).filter((row) =>
              [...filters].every(([field, value]) => row[field] === value)
            );
          return { first: async () => found()[0] ?? null, collect: async () => found() };
        }
      };
    },
    async insert(table: string, value: Record<string, unknown>) {
      const id = `${table}_${++sequence}`;
      const tableRows = rows.get(table) ?? [];
      tableRows.push({ _id: id, ...value } as MemoryRow);
      rows.set(table, tableRows);
      return id;
    },
    async patch(id: string, value: Record<string, unknown>) {
      for (const tableRows of rows.values()) {
        const row = tableRows.find((entry) => entry._id === id);
        if (row) return void Object.assign(row, value);
      }
      throw new Error(`Missing row ${id}`);
    }
  };
  return { db, rows };
}

/** El harness declara su entorno: un deployment sin declararlo no consume nada. */
async function applyEvent(ctx: unknown, event: Record<string, unknown>) {
  const previous = process.env.ORBITA_ENVIRONMENT;
  process.env.ORBITA_ENVIRONMENT = "development";
  try {
    return await (applyRevenueCatEvent as any)._handler(ctx, { event });
  } finally {
    if (previous === undefined) delete process.env.ORBITA_ENVIRONMENT;
    else process.env.ORBITA_ENVIRONMENT = previous;
  }
}

const FUTURE = 2_000_000_000_000;

/**
 * Un `INITIAL_PURCHASE` real de un canje de código de oferta de Apple.
 *
 * La metadata que agrega el canje es `offer_code`, y `period_type` viaja como
 * `PROMOTIONAL` en vez de `NORMAL`. Todo lo demás —entitlement canónico,
 * producto, vencimiento— es idéntico a una compra pagada.
 */
const CANJE = {
  id: "rc_offer_code_1",
  type: "INITIAL_PURCHASE",
  app_user_id: "user_canje",
  event_timestamp_ms: 1_900_000_000_000,
  environment: "SANDBOX",
  entitlement_ids: ["orbita_pro"],
  product_id: "orbita_plus_monthly",
  period_type: "PROMOTIONAL",
  offer_code: "ORBITA-LANZAMIENTO",
  presented_offering_id: "orbita_plus",
  expiration_at_ms: FUTURE
};

describe("backend — un canje válido sigue resolviendo orbita_pro, sin tocar Convex", () => {
  it("la decisión del webhook trata el canje como cualquier compra inicial", () => {
    const decision = deriveRevenueCatEventDecision(CANJE);
    assert.equal(decision.kind, "apply");
    if (decision.kind === "apply") {
      assert.equal(decision.allowCreate, true);
      assert.equal(decision.patch.entitlement, "orbita_pro");
      assert.equal(decision.patch.plan, "monthly");
      assert.equal(decision.patch.currentPeriodEnd, FUTURE);
      assert.equal(decision.patch.willRenew, true);
      // `PROMOTIONAL` no es una prueba: sólo `TRIAL` produce `trialing`.
      assert.equal(decision.patch.status, "active");
      // Un canje jamás puede escribir acceso permanente.
      assert.equal(decision.patch.isLifetime, false);
      assert.equal(decision.lifetimeAuthority, undefined);
    }
  });

  it("de punta a punta: el evento crea la fila y `resolveEntitlement` dice Pro", async () => {
    const memory = revenueCatMemoryDb({
      users: [{ _id: "user_canje_id", clerkUserId: "user_canje" }]
    });
    await applyEvent({ db: memory.db }, CANJE);

    const fila = memory.rows.get("subscriptions")?.find((row) => row.userId === "user_canje_id");
    assert.ok(fila, "el canje tiene que dejar una fila de suscripción");
    assert.equal(fila?.entitlement, "orbita_pro");
    assert.equal(fila?.provider, "revenuecat");
    assert.equal(fila?.status, "active");
    assert.equal(fila?.environment, "sandbox");

    // La lectura del entitlement aplica el MISMO corte de entorno que el
    // webhook: una fila Sandbox sólo concede donde Sandbox está autorizado.
    const resuelto = resolveEntitlement([fila as any], CANJE.event_timestamp_ms, {
      sandboxAllowed: true
    });
    assert.equal(resuelto.isPro, true);
    assert.equal(resuelto.entitlement, "orbita_pro");
    assert.deepEqual(resuelto.activeProviders, ["revenuecat"]);
    assert.equal(resuelto.canManageInRevenueCat, true);

    // Y falla CERRADO en la otra dirección: sin ese permiso, el mismo canje no
    // concede nada. Un canje no es una puerta de atrás al corte de entorno.
    assert.equal(resolveEntitlement([fila as any], CANJE.event_timestamp_ms).isPro, false);
  });

  it("la metadata del canje no viaja cruda a la auditoría", async () => {
    const memory = revenueCatMemoryDb({
      users: [{ _id: "user_canje_id", clerkUserId: "user_canje" }]
    });
    await applyEvent({ db: memory.db }, CANJE);
    const auditoria = memory.rows.get("paymentEvents")?.[0];
    assert.ok(auditoria, "el evento tiene que quedar auditado");
    const crudo = JSON.stringify(auditoria);
    assert.equal(crudo.includes("ORBITA-LANZAMIENTO"), false, "el código no se guarda");
  });

  it("un canje de OTRO entitlement no puede encender Órbita Plus", () => {
    assert.deepEqual(
      deriveRevenueCatEventDecision({ ...CANJE, entitlement_ids: ["otro"] }),
      { kind: "ignore", reason: "unrelated_entitlement" }
    );
  });
});
