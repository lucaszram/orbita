/**
 * Comercio nativo — garantías de ALCANCE y de superficie.
 *
 * Hay cosas que no se prueban con una función pura ni renderizando: que el
 * bundle web NUNCA cargue el SDK de la tienda, que el catálogo falle cerrado
 * fuera del mensual vigente, y que el paywall y el Perfil ofrezcan las salidas
 * que App Review exige. Se prueban recorriendo el grafo real de imports —la
 * misma pregunta que se hace Metro— y la estructura del fuente.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { importsOf, reachableFrom, resolveEntryForPlatform, ROOT } from "./moduleGraph";

const STORE_SDK = /^react-native-purchases(-ui)?(\/|$)/;

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

/** Módulos alcanzables que importan el SDK nativo de la tienda. */
function storeSdkImporters(platform: "web" | "native"): string[] {
  return [...reachableFrom(routeEntries(), platform)]
    .filter((rel) => /\.(t|j)sx?$/.test(rel))
    .filter((rel) => importsOf(join(ROOT, rel)).some((spec) => STORE_SDK.test(spec)))
    .sort();
}

const PAYWALL_NATIVE = resolveEntryForPlatform("app/paywall.tsx", "native");
const PAYWALL_WEB = resolveEntryForPlatform("app/paywall.tsx", "web");
const PAYWALL_SCREEN = readFileSync(join(ROOT, "src/screens/v492/PlusPaywallScreen.tsx"), "utf8");
const CLIENT = readFileSync(join(ROOT, "src/services/revenuecat/client.ts"), "utf8");
const PROVIDER = readFileSync(join(ROOT, "src/services/revenuecat/RevenueCatProvider.tsx"), "utf8");
const MANAGE_NATIVE = readFileSync(join(ROOT, "src/components/orbita/ManageSubscription.tsx"), "utf8");
const MANAGE_WEB = readFileSync(join(ROOT, "src/components/orbita/ManageSubscription.web.tsx"), "utf8");
/**
 * El provider central del plan.
 *
 * `EntitlementProvider` (en `useLiveApp`) monta la ÚNICA
 * `subscriptions.getCurrent` de la UI nativa, la correlaciona con el dueño de
 * Clerk y publica `owner` / `remote` / `resolved` / `effective`. Las pantallas
 * de comercio consumen `useEntitlement()` y no tienen query propia.
 */
const PLAN_PROVIDER = readFileSync(join(ROOT, "src/hooks/useLiveApp.tsx"), "utf8");

/** Una regla se comprueba sobre el CÓDIGO, no sobre lo que los comentarios cuentan de él. */
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** El paywall sin prosa: lo que se dibuja se cuenta sobre el código. */
const PAYWALL_CODIGO = sinComentarios(PAYWALL_SCREEN);

/**
 * El bloque JSX de una fase de activación: desde su condición hasta el marcador
 * que la cierra.
 *
 * Se ancla a la PRIMERA aparición, que es la del render —la de `primaryLabel`
 * vive al final del archivo—, y tolera el formato: los operandos pueden partirse
 * en varias líneas sin que la regla deje de aplicarse.
 */
function bloqueDeActivacion(fase: string, hasta: RegExp): string {
  const inicio = new RegExp(`activation\\s*===\\s*"${fase}"`).exec(PAYWALL_CODIGO);
  if (!inicio) throw new Error(`el paywall no renderiza la fase \`${fase}\``);
  const resto = PAYWALL_CODIGO.slice(inicio.index);
  const fin = hasta.exec(resto);
  if (!fin) throw new Error(`no encontré el cierre del bloque \`${fase}\``);
  return resto.slice(0, fin.index);
}

describe("corte web/nativo — Stripe no carga el SDK de la tienda", () => {
  it("ningún módulo del bundle web importa react-native-purchases", () => {
    assert.deepEqual(
      storeSdkImporters("web"),
      [],
      "el bundle web no puede alcanzar el SDK nativo de compras"
    );
  });

  it("el bundle nativo SÍ lo alcanza (si no, la prueba anterior pasaría vacía)", () => {
    const nativos = storeSdkImporters("native");
    assert.ok(
      nativos.includes("src/services/revenuecat/client.ts"),
      `el cliente nativo debe estar en el grafo nativo; alcanzados: ${nativos.join(", ")}`
    );
  });

  it("cada ruta de comercio resuelve a una implementación distinta por plataforma", () => {
    assert.equal(PAYWALL_NATIVE, join(ROOT, "src/routes/v492/paywall.tsx"));
    assert.equal(PAYWALL_WEB, join(ROOT, "src/routes/v492/paywall.web.tsx"));
  });

  it("el provider web no importa nada del SDK y devuelve un contrato inerte", () => {
    const web = readFileSync(join(ROOT, "src/services/revenuecat/RevenueCatProvider.web.tsx"), "utf8");
    assert.equal(importsOf(join(ROOT, "src/services/revenuecat/RevenueCatProvider.web.tsx")).some((s) => STORE_SDK.test(s)), false);
    assert.match(web, /phase: "unavailable"/);
    assert.match(web, /purchase: async \(\) => "inactive"/);
  });

  it("el stub web del cliente cubre todos los exports del nativo", () => {
    const names = (src: string) =>
      [...src.matchAll(/^export (?:async )?function ([a-zA-Z]+)/gm)].map((m) => m[1]).sort();
    const web = readFileSync(join(ROOT, "src/services/revenuecat/client.web.ts"), "utf8");
    assert.deepEqual(
      names(CLIENT),
      names(web),
      "un export que sólo existe en nativo rompe el bundle web al importarlo"
    );
  });

  it("el marcador de compra en vuelo tiene stub web y no arrastra AsyncStorage", () => {
    const nativo = readFileSync(join(ROOT, "src/services/purchaseGuard.ts"), "utf8");
    const web = readFileSync(join(ROOT, "src/services/purchaseGuard.web.ts"), "utf8");
    assert.match(nativo, /@react-native-async-storage\/async-storage/);
    assert.equal(/async-storage/.test(web), false);
    const names = (src: string) =>
      [...src.matchAll(/^export (?:async )?function ([a-zA-Z]+)/gm)].map((m) => m[1]).sort();
    assert.deepEqual(names(nativo), names(web));
  });

  it("ningún secreto de backend puede llegar al cliente", () => {
    // Las claves del cliente son públicas por diseño; las del backend, no.
    const clienteYRutas = [...reachableFrom(routeEntries(), "native")].filter((rel) =>
      /\.(t|j)sx?$/.test(rel)
    );
    for (const rel of clienteYRutas) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      for (const secreto of [
        "REVENUECAT_SECRET_API_KEY",
        "REVENUECAT_WEBHOOK_AUTH",
        "REVENUECAT_SANDBOX_REVIEW_USER_IDS"
      ]) {
        assert.equal(src.includes(secreto), false, `${rel}: nombra el secreto ${secreto}`);
      }
    }
  });

  it("el Perfil web conserva Stripe y no toca RevenueCat", () => {
    assert.equal(/revenuecat/i.test(MANAGE_WEB), false);
    assert.match(MANAGE_WEB, /createPortalSession/);
  });
});

describe("catálogo — la oferta mensual falla cerrada", () => {
  it("un Offering que no sea exactamente un mensual no se publica", () => {
    assert.match(CLIENT, /offering\?\.availablePackages\.length !== 1/);
    assert.match(CLIENT, /packageType !== "MONTHLY"/);
    assert.match(CLIENT, /subscriptionPeriod !== "P1M"/);
    // Semanal, anual y lifetime no forman parte del contrato vigente.
    assert.equal(/PACKAGE_TYPE\.(ANNUAL|WEEKLY|LIFETIME)/.test(CLIENT), false);
  });

  it("el Offering se lee de `current`, sin fijar un id inventado", () => {
    assert.match(CLIENT, /getOfferings\(\)\)\.current/);
    assert.equal(/offerings\.all\[/.test(CLIENT), false);
  });

  it("precio, moneda, período y prueba salen del producto de la tienda", () => {
    for (const campo of [
      "item.product.priceString",
      "item.product.subscriptionPeriod",
      "item.product.introPrice"
    ]) {
      assert.ok(CLIENT.includes(campo), `${campo} debe venir de la tienda`);
    }
    // Ningún importe ni duración escritos a mano en el cliente.
    assert.equal(/[$€]\s?\d/.test(CLIENT), false);
  });

  it("la elegibilidad se pregunta a la tienda y degrada a UNKNOWN sin romper la oferta", () => {
    assert.match(CLIENT, /checkTrialOrIntroductoryPriceEligibility/);
    assert.match(CLIENT, /return "unknown";/);
  });

  it("sólo se acepta una clave pública, y sin ella el comercio falla cerrado", () => {
    assert.match(CLIENT, /EXPO_PUBLIC_REVENUECAT_IOS_API_KEY/);
    assert.match(CLIENT, /EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY/);
    assert.match(CLIENT, /return __DEV__ && testKey \? testKey : null;/);
    // Una secret key jamás viaja en el cliente.
    assert.equal(/SECRET|secretKey|sk_/.test(CLIENT), false);
  });
});

describe("identidad — comprar y restaurar exigen una cuenta lista", () => {
  it("el SDK se configura recién con Clerk y la fila Convex resueltas", () => {
    assert.match(PROVIDER, /const liveUserId = live\.isLive \? live\.auth\?\.userId \?\? null : null;/);
    assert.match(PROVIDER, /REVENUECAT_IDENTIFIED_USER_REQUIRED/);
  });

  it("un id anónimo del SDK nunca se acepta como cuenta", () => {
    assert.match(CLIENT, /startsWith\("\$RCAnonymousID:"\)/);
    assert.match(CLIENT, /REVENUECAT_IDENTIFIED_USER_REQUIRED/);
  });

  it("la identidad se verifica DESPUÉS de configurar, contra el SDK real", () => {
    assert.match(CLIENT, /if \(\(await Purchases\.getAppUserID\(\)\) !== cleanUserId\)/);
    assert.match(CLIENT, /REVENUECAT_IDENTITY_MISMATCH/);
  });

  it("cada acción de compra revalida el app user id contra la cuenta viva", () => {
    assert.match(CLIENT, /async function requireMatchingUser/);
    for (const accion of [
      "purchaseNativePackage",
      "restoreNativePurchases",
      "refreshNativeCustomerInfo",
      "presentNativeCustomerCenter"
    ]) {
      const start = CLIENT.indexOf(`function ${accion}`);
      assert.ok(start > 0, `falta ${accion}`);
      assert.match(
        CLIENT.slice(start, start + 400),
        /requireMatchingUser\(/,
        `${accion} debe revalidar la identidad antes de tocar la tienda`
      );
    }
  });

  it("el cambio de cuenta se serializa y no hereda el estado de la anterior", () => {
    // Una sola cola para TODO lo que toca el SDK: una transición A → B no puede
    // colarse entre el `purchasePackage` de A y su respuesta.
    assert.match(PROVIDER, /sdkQueueRef/);
    assert.match(PROVIDER, /const enqueue = useCallback/);
    // P1 2: TODA operación sensible a identidad pasa por la cola. El Customer
    // Center y el refresh llamaban al SDK directo y podían colarse en medio de
    // un `logIn(B)`; el reintento del Offering tampoco revalidaba adentro.
    for (const accion of [
      "const purchase =",
      "const restore =",
      "const presentCustomerCenter =",
      "const retry =",
      "const refreshCustomerInfo ="
    ]) {
      const start = PROVIDER.indexOf(accion);
      assert.ok(start > 0, `falta ${accion}`);
      assert.match(
        PROVIDER.slice(start, start + 700),
        /runOnStore\(/,
        `${accion} tiene que pasar por la cola con el dueño capturado`
      );
    }
    // Y el SDK nunca recibe un logout: eso fabricaría un anónimo.
    const clienteSinComentarios = readFileSync(join(ROOT, "src/services/revenuecat/client.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.equal(
      /Purchases\.logOut\(/.test(clienteSinComentarios),
      false,
      "logOut crea un usuario anónimo capaz de recibir una compra huérfana"
    );
    // El estado de tienda sólo se publica si la identidad sigue siendo la misma.
    assert.match(PROVIDER, /if \(identityRef\.current !== userId\) return false;/);
    // Toda acción que vuelve DESPUÉS de un await revalida antes de publicar:
    // Clerk puede haber cambiado de cuenta mientras la tienda resolvía.
    for (const accion of ["const purchase =", "const restore =", "const refreshCustomerInfo ="]) {
      const start = PROVIDER.indexOf(accion);
      assert.ok(start > 0, `falta ${accion}`);
      assert.match(
        PROVIDER.slice(start, start + 600),
        /publishStoreState\(userId,/,
        `${accion} debe publicar el estado de tienda revalidando la identidad`
      );
    }
  });

  it("el listener de CustomerInfo se desmonta y respeta la generación vigente", () => {
    assert.match(PROVIDER, /removeListener\?\.\(\)/);
    assert.match(PROVIDER, /generationRef\.current === generation && identityRef\.current === targetUserId/);
  });
});

describe("impresiones — sólo cuenta lo que alguien vio", () => {
  it("REPRO: cargar el Offering (o reintentarlo) ya NO cuenta una impresión", () => {
    // El provider envuelve la app entera: esto corría en el arranque de
    // cualquier sesión, con la persona en la Home, y otra vez por cada retry.
    const publish = PROVIDER.indexOf("const publishOffering =");
    const cuerpo = PROVIDER.slice(publish, PROVIDER.indexOf("const requireIdentity", publish));
    assert.ok(publish > 0, "falta publishOffering");
    assert.equal(
      cuerpo.includes("trackNativePaywall("),
      false,
      "publicar el Offering no es una impresión"
    );
    const retry = PROVIDER.indexOf("const retry =");
    const cuerpoRetry = PROVIDER.slice(retry, PROVIDER.indexOf("const trackPaywallImpression", retry));
    assert.equal(cuerpoRetry.includes("trackNativePaywall("), false, "el reintento tampoco");
  });

  it("la impresión es un método propio, serializado y cercado por dueño", () => {
    const start = PROVIDER.indexOf("const trackPaywallImpression =");
    assert.ok(start > 0, "falta el método de impresión");
    const cuerpo = PROVIDER.slice(start, start + 500);
    assert.match(cuerpo, /runOnStore\(/, "pasa por la cola con el dueño capturado");
    assert.match(cuerpo, /trackNativePaywall\(offering\.offering\)/);
    // Y es la ÚNICA llamada al tracker en todo el provider.
    assert.equal((PROVIDER.match(/trackNativePaywall\(/g) ?? []).length, 1);
  });

  it("la pide la PANTALLA, con foco real y la oferta REALMENTE dibujada", () => {
    assert.match(PAYWALL_SCREEN, /revenueCat\.trackPaywallImpression/);
    // Las CUATRO condiciones: foco real de pantalla, entitlement validado para
    // esta cuenta, `activation === "idle"` —con el acceso confirmado o una
    // compra ya aceptada se dibuja otra cosa, no la oferta— y el Offering listo.
    assert.match(
      PAYWALL_SCREEN,
      /const offeringVisible =\s*focused && entitlementResuelto && activation === "idle" && revenueCat\.phase === "ready";/
    );
    // El foco es el real del router, y al perderlo se olvida la última contada:
    // otra visita es otra vista.
    assert.match(PAYWALL_SCREEN, /useFocusEffect\(/);
    assert.match(PAYWALL_SCREEN, /setFocused\(true\)/);
    assert.match(PAYWALL_SCREEN, /impresionRef\.current = null;/);
    // Dedupe por vista enfocada + dueño + oferta.
    assert.match(PAYWALL_SCREEN, /const clave = `\$\{paywallOwner\}:\$\{paywallOfferingId\}`/);
    assert.match(PAYWALL_SCREEN, /if \(impresionRef\.current === clave\) return;/);
    // Sin visibilidad, sin dueño o sin oferta no se cuenta nada.
    assert.match(
      PAYWALL_SCREEN,
      /if \(!offeringVisible \|\| !paywallOwner \|\| !paywallOfferingId\) return;/
    );
    // Y se marca emitida SÓLO si la llamada cercada por dueño/generación salió.
    assert.match(PAYWALL_SCREEN, /trackImpression\(\)\.then\(\(emitida\) => \{/);
    assert.match(PAYWALL_SCREEN, /if \(alive && emitida\) impresionRef\.current = clave;/);
  });

  it("el stub web declara el mismo contrato (no rompe el bundle web)", () => {
    const web = readFileSync(join(ROOT, "src/services/revenuecat/RevenueCatProvider.web.tsx"), "utf8");
    // Devuelve `false`, no `undefined`: el contrato dice si REALMENTE se emitió,
    // y en web nunca se emite.
    assert.match(web, /trackPaywallImpression: async \(\) => false/);
    assert.match(web, /offeringId: null/);
    const types = readFileSync(join(ROOT, "src/services/revenuecat/types.ts"), "utf8");
    assert.match(types, /trackPaywallImpression: \(\) => Promise<boolean>/);
  });
});

describe("paywall — salidas, honestidad y doble cobro", () => {
  it("deja seguir con Free y ofrece Restaurar", () => {
    assert.match(PAYWALL_SCREEN, /SEGUIR CON ÓRBITA FREE/);
    assert.match(PAYWALL_SCREEN, /Restaurar/);
  });

  it("muestra Términos y Privacidad con las URLs públicas", () => {
    assert.match(PAYWALL_SCREEN, /https:\/\/orbitaastrologia\.xyz\/terminos/);
    assert.match(PAYWALL_SCREEN, /https:\/\/orbitaastrologia\.xyz\/privacy/);
    assert.match(PAYWALL_SCREEN, /accessibilityRole="link"/);
  });

  it("explica renovación y cancelación", () => {
    assert.match(PAYWALL_SCREEN, /renovación automática/);
    assert.match(PAYWALL_SCREEN, /cancelarla desde la gestión de tu cuenta/);
  });

  it("la prueba se nombra sólo desde el plan de la tienda", () => {
    assert.match(PAYWALL_SCREEN, /plan\.trial/);
    assert.match(PAYWALL_SCREEN, /selected\?\.trial/);
    // Ninguna duración ni importe escritos a mano en la pantalla.
    assert.equal(/7 días|siete días|[$€]\s?\d/.test(PAYWALL_SCREEN), false);
  });

  it("la decisión del botón primario vive en el dominio puro, no en el JSX", () => {
    assert.match(PAYWALL_SCREEN, /nativePrimaryAction\(\{/);
    assert.match(PAYWALL_SCREEN, /nativeActivationPhase\(\{/);
  });

  it("las transiciones de compra pasan por la decisión pura, no por strings sueltos", () => {
    // Ahora la transición lleva DUEÑO: `applyStoreAnswer` descarta la respuesta
    // si la cuenta cambió mientras la tienda contestaba.
    assert.match(PAYWALL_SCREEN, /answerStore\(userId, "purchase_ambiguous"\)/);
    assert.match(PAYWALL_SCREEN, /answerStore\(userId, "purchase_cancelled"\)/);
    assert.match(PAYWALL_SCREEN, /answerStore\(userId, "restore_empty"\)/);
    assert.match(PAYWALL_SCREEN, /answerStore\(userId, "recheck_empty"\)/);
    assert.match(PAYWALL_SCREEN, /applyStoreAnswer\(previous, userId, answer\)/);
    assert.match(PAYWALL_SCREEN, /No vuelvas a comprar; probá Restaurar/);
    // La regla protege las RESPUESTAS DE LA TIENDA: ésas no pueden escribirse a
    // mano. Leer el marcador persistido y cerrarlo sí son escrituras directas
    // legítimas, y viven fuera de los handlers de compra/restauración.
    const handlers = ["const purchase =", "const restore =", "const retryActivation ="];
    for (const nombre of handlers) {
      const start = PAYWALL_SCREEN.indexOf(nombre);
      assert.ok(start > 0, `falta ${nombre}`);
      const cuerpo = PAYWALL_SCREEN.slice(start, PAYWALL_SCREEN.indexOf("};", start));
      assert.equal(
        /setSession\(/.test(cuerpo),
        false,
        `${nombre}: escribir la sesión a mano se saltea la regla de dueño`
      );
    }
  });

  it("el marcador de compra se persiste ANTES de abrir la hoja de la tienda", () => {
    // El marcador se pone en DISCO y en MEMORIA por el mismo helper, y en ese
    // orden: si el disco falla, la memoria no miente diciendo que hay algo en
    // vuelo, y la tienda no se toca.
    const armado = PAYWALL_SCREEN.indexOf("const armStoreGuard =");
    const cuerpoArmado = PAYWALL_SCREEN.slice(armado, PAYWALL_SCREEN.indexOf("const purchase =", armado));
    const disco = cuerpoArmado.indexOf("storePurchaseGuard(");
    const memoria = cuerpoArmado.indexOf('answerStore(userId, "purchase_started")');
    assert.ok(disco > 0 && memoria > 0, "faltan el marcador en disco o el bloqueo en memoria");
    assert.ok(disco < memoria, "primero el disco: sobrevive al desmontaje");
    assert.match(cuerpoArmado, /return false;/, "un disco que falla corta la acción");

    for (const [nombre, accion] of [
      ["const purchase =", "revenueCat.purchase("],
      ["const restore =", "revenueCat.restore("]
    ] as const) {
      const start = PAYWALL_SCREEN.indexOf(nombre);
      const cuerpo = PAYWALL_SCREEN.slice(start, PAYWALL_SCREEN.indexOf("};", start));
      const guardado = cuerpo.indexOf("armStoreGuard(userId)");
      const tienda = cuerpo.indexOf(accion);
      assert.ok(guardado > 0 && tienda > 0, `${nombre}: faltan el marcador o la acción`);
      assert.ok(guardado < tienda, `${nombre}: un cargo posible no puede quedar sin marcar`);
      // Y si el marcador no se pudo poner, la tienda NO se toca.
      assert.match(cuerpo, /if \(!\(await armStoreGuard\(userId\)\)\) \{/, nombre);
    }
  });

  it("un restore que falla deja la pantalla en Restaurar, no en Comprar", () => {
    const start = PAYWALL_SCREEN.indexOf("const restore =");
    const cuerpo = PAYWALL_SCREEN.slice(start, PAYWALL_SCREEN.indexOf("};", start));
    // El error no puede dejar la sesión limpia: restaurar pudo REVELAR una
    // compra viva antes de tirar.
    assert.match(cuerpo, /catch \{[\s\S]*answerStore\(userId, "purchase_ambiguous"\)/);
    assert.match(cuerpo, /No pudimos restaurar tus compras/);
  });

  it("no hay ventana para comprar antes de leer el marcador persistido", () => {
    // El estado arranca en `loading` y siempre se lee a través del dueño
    // vigente, así que un render con la cuenta nueva no puede ver el
    // `guard: "clear"` de la anterior ni por un frame.
    assert.match(PAYWALL_SCREEN, /emptyPurchaseSession\(null\)/);
    assert.match(PAYWALL_SCREEN, /purchaseSessionForOwner\(session, identifiedUserId\)/);
    assert.match(PAYWALL_SCREEN, /guardLoaded: owned\.guard !== "loading"/);
    assert.match(PAYWALL_SCREEN, /readPurchaseGuard\(/);
  });

  it("sólo una confirmación de RevenueCat levanta el marcador de la tienda", () => {
    assert.match(PAYWALL_SCREEN, /backendConfirmsStorePurchase\(entitlement\)/);
    // Un `isPro` a secas no puede limpiarlo: alguien con Stripe activo lo tiene
    // desde el primer día.
    assert.equal(
      /if \(backendIsPro !== true\) return;[\s\S]{0,120}clearPurchaseGuard/.test(PAYWALL_SCREEN),
      false
    );
  });

  it("compra, restauración y comprobación demorada piden la lectura autoritativa", () => {
    // P1 8: la superficie pública es una MUTATION. Como action era at-most-once
    // y podía morir antes de dejar el trabajo escrito.
    assert.match(PAYWALL_SCREEN, /appApi\.subscriptions\.requestStoreReconcile/);
    assert.match(PAYWALL_SCREEN, /useMutation\(appApi\.subscriptions\.requestStoreReconcile\)/);
    assert.doesNotMatch(PAYWALL_SCREEN, /useAction\(appApi\.subscriptions\./);
    for (const nombre of ["const purchase =", "const restore =", "const retryActivation ="]) {
      const start = PAYWALL_SCREEN.indexOf(nombre);
      const cuerpo = PAYWALL_SCREEN.slice(start, PAYWALL_SCREEN.indexOf("};", start));
      assert.match(cuerpo, /askBackendToReconcile\(\)/, `${nombre} debe reconciliar`);
    }
    // Y nunca se le manda al backend nada del teléfono.
    assert.match(PAYWALL_SCREEN, /reconcile\(\{\}\)/);
    assert.equal(
      /reconcile\(\{\s*(clerkUserId|userId|customerInfo|entitlement|receipt)/.test(PAYWALL_SCREEN),
      false,
      "la reconciliación no acepta identidad ni recibos del cliente"
    );
  });

  it("el doble toque se corta con el candado síncrono POR DUEÑO, no con estado de React", () => {
    // El candado era uno solo para la pantalla: una compra de A en vuelo dejaba
    // a B sin poder tocar nada, y el `finally` de A liberaba el de B.
    assert.match(PAYWALL_SCREEN, /createOwnerGates\(\)/);
    assert.match(PAYWALL_SCREEN, /const gate = gates\.for\(identifiedUserId\)/);
    const acciones = PAYWALL_SCREEN.match(/runExclusive\(gate,/g) ?? [];
    assert.ok(acciones.length >= 4, `todas las acciones deben tomar el candado (vi ${acciones.length})`);
  });

  it("la espera del backend se nombra, y sólo la vencida ofrece salidas", () => {
    // La afirmación es la misma en las dos fases —la tienda cobró, Convex
    // todavía no lo refleja— y ninguna de las dos abre nada.
    assert.match(PAYWALL_SCREEN, /Tu compra está confirmada/);
    assert.match(PAYWALL_SCREEN, /Estamos activando tu acceso/);

    // El enlace de la espera SIN FINAL se retiró: no nombraba ninguna salida y
    // dejaba la fase clavada en "activando" para siempre, que es el escenario en
    // el que alguien vuelve a la tienda y paga dos veces.
    assert.equal(
      /COMPROBAR DE NUEVO/.test(PAYWALL_SCREEN),
      false,
      "la espera vencida ofrece dos salidas nombradas, no un enlace que no promete nada"
    );

    // Espera JOVEN: se nombra y NO se ofrece nada. Poner acá los botones sería
    // empujar a tocar la tienda mientras el webhook viene en camino.
    const activando = bloqueDeActivacion("activating", /activation\s*===\s*"recoverable"/);
    assert.match(activando, /Tu compra está confirmada/);
    assert.match(activando, /Estamos activando tu acceso/);
    assert.equal(
      (activando.match(/<Pressable\b/g) ?? []).length,
      0,
      "la espera joven no ofrece ninguna acción"
    );
    assert.equal(/REINTENTAR ACTIVACIÓN|RESTAURAR COMPRA/.test(activando), false);

    // Espera VENCIDA: exactamente las DOS salidas que reparan sin volver a
    // cobrar, con estos literales y no con tres nombres del mismo circuito.
    const recuperable = bloqueDeActivacion("recoverable", /\{notice\s*\?/);
    assert.match(recuperable, /REINTENTAR ACTIVACIÓN/);
    assert.match(recuperable, /RESTAURAR COMPRA/);
    assert.match(recuperable, /No vuelvas a comprar/);
    assert.equal(
      (recuperable.match(/<Pressable\b/g) ?? []).length,
      2,
      "el estado recuperable ofrece exactamente dos acciones"
    );
    assert.match(recuperable, /onPress=\{\s*\(\)\s*=>\s*void retryActivation\(\)\s*\}/);
    assert.match(recuperable, /onPress=\{\s*\(\)\s*=>\s*void restore\(\)\s*\}/);
    assert.equal(
      /purchase\(/.test(recuperable),
      false,
      "reparar una activación no puede ser volver a cobrar"
    );

    // Y el primario deja de prometer un final inminente que ya se incumplió:
    // dice lo único cierto, deshabilitado.
    assert.match(
      PAYWALL_CODIGO,
      /if\s*\(activation\s*===\s*"recoverable"\)\s*return\s*"ACTIVACIÓN PENDIENTE";/
    );
    assert.match(
      PAYWALL_CODIGO,
      /if\s*\(activation\s*===\s*"activating"\)\s*return\s*"ACTIVANDO ÓRBITA PLUS…";/
    );
  });

  it("no promete estados terminales como si fueran una espera", () => {
    assert.match(PAYWALL_SCREEN, /COMPRAS NO DISPONIBLES/);
    assert.match(PAYWALL_SCREEN, /SIN OFERTA DISPONIBLE/);
    assert.match(PAYWALL_SCREEN, /NO PUDIMOS CARGAR LA OFERTA/);
  });

  it("el acceso lo decide Convex: la pantalla no escribe entitlement", () => {
    // El entitlement se LEE, y de una sola autoridad: el provider central, que
    // monta la query correlacionada con el dueño de Clerk. La pantalla no tiene
    // ninguna query propia —ni de plan ni de nada— y toma el REMOTO, que es lo
    // único que el backend confirmó para esta cuenta.
    assert.match(
      PAYWALL_SCREEN,
      /const \{ remote: entitlement, resolved: entitlementResuelto \} = useEntitlement\(\);/
    );
    assert.equal(/useQuery\(/.test(PAYWALL_SCREEN), false, "la pantalla no monta su propia query");
    assert.match(
      PLAN_PROVIDER,
      /useQuery\(appApi\.subscriptions\.getCurrent, isLive \? \{\} : "skip"\)/
    );
    assert.equal(/setEntitlement|grantPro|setIsPro|writeEntitlement/.test(PAYWALL_SCREEN), false);

    // La invariancia real no es "cero mutations" —desde P1 8 la pantalla usa
    // una para pedir la reparación de forma durable— sino que la ÚNICA
    // mutation que toca sea la que no puede conceder nada.
    const mutations = [...PAYWALL_SCREEN.matchAll(/useMutation\(([^)]*)\)/g)].map((match) =>
      match[1].trim()
    );
    assert.deepEqual(mutations, ["appApi.subscriptions.requestStoreReconcile"]);
    // Y se la llama SIN argumentos: no puede transportar un entitlement, un
    // CustomerInfo ni un recibo. El backend deriva la cuenta de `ctx.auth`.
    assert.match(PAYWALL_SCREEN, /reconcile\(\{\}\)/);
    assert.equal(/reconcile\(\{\s*[a-zA-Z]/.test(PAYWALL_SCREEN), false);
  });

  it("los beneficios anunciados son los que el producto abre de verdad", () => {
    // `convex/layers.ts` cierra casas y aspectos; `convex/void.ts` sube el cupo
    // de 3 a 5. Nada más está detrás de Plus en esta versión.
    assert.match(PAYWALL_SCREEN, /doce casas/);
    assert.match(PAYWALL_SCREEN, /aspectos/);
    assert.match(PAYWALL_SCREEN, /Cinco preguntas por día en El Umbral, en vez de tres/);
    const voidSrc = readFileSync(join(ROOT, "convex/void.ts"), "utf8");
    assert.match(voidSrc, /const LIMIT_FREE = 3;/);
    assert.match(voidSrc, /const LIMIT_PRO = 5;/);
  });

  it("los controles táctiles conservan un objetivo alcanzable", () => {
    assert.ok((PAYWALL_SCREEN.match(/minHeight: 44/g) ?? []).length >= 4);
    assert.match(PAYWALL_SCREEN, /accessibilityRole="radiogroup"/);
    assert.match(PAYWALL_SCREEN, /accessibilityState=\{\{ checked: selected \}\}/);
  });
});

describe("Perfil — plan, gestión y restauración por el canal correcto", () => {
  it("Free nombra con precisión lo que conserva y ofrece el camino a Plus", () => {
    assert.match(MANAGE_NATIVE, /Estás en Órbita Free/);
    assert.match(
      MANAGE_NATIVE,
      /Hoy, Tránsitos, Vínculos, tu carta base y tres preguntas por día en El Umbral/
    );
    assert.match(MANAGE_NATIVE, /router\.push\("\/paywall"\)/);
  });

  it("cada salida se ofrece por su FLAG, no por el proveedor ganador", () => {
    // P1 3: elegir una rama por `view` escondía el Customer Center de una
    // compra de Apple viva cuando Stripe ganaba el rango, y dejaba sin ninguna
    // salida al caso `stub` + RevenueCat.
    assert.match(MANAGE_NATIVE, /presentCustomerCenter\(\)/);
    assert.match(MANAGE_NATIVE, /createPortal\(\{\}\)/);
    assert.match(MANAGE_NATIVE, /\{management\.showStoreCenter \?/);
    assert.match(MANAGE_NATIVE, /\{management\.showStripePortal \?/);
    assert.doesNotMatch(MANAGE_NATIVE, /if \(view === "stripe"\)/);
    assert.doesNotMatch(MANAGE_NATIVE, /if \(view === "revenuecat" \|\| view === "lifetime"\)/);
  });

  it("un lifetime no ofrece cancelar una renovación que no existe", () => {
    assert.match(MANAGE_NATIVE, /Este acceso no tiene una renovación que cancelar/);
  });

  it("las acciones simultáneas se excluyen con el candado síncrono POR DUEÑO", () => {
    assert.match(MANAGE_NATIVE, /createOwnerGates\(\)/);
    assert.match(MANAGE_NATIVE, /const gate = gates\.for\(clerkOwner\)/);
    const acciones = MANAGE_NATIVE.match(/runExclusive\(gate,/g) ?? [];
    assert.equal(acciones.length, 3, "portal, Customer Center y restaurar comparten UN candado");
    assert.equal(
      /if \(state === "(opening|restoring)"\) return;/.test(MANAGE_NATIVE),
      false,
      "una guarda por estado de React no corta dos toques del mismo tick"
    );
  });

  it("un botón bloqueado se anuncia bloqueado", () => {
    assert.match(MANAGE_NATIVE, /disabled=\{busy\}/);
    assert.match(MANAGE_NATIVE, /accessibilityState=\{\{ disabled \}\}/);
    const kit = readFileSync(join(ROOT, "src/components/orbita/kit.tsx"), "utf8");
    assert.match(kit, /accessibilityState=\{\{ disabled: Boolean\(disabled\) \}\}/);
  });

  it("el Perfil no afirma un plan mientras el entitlement no resolvió", () => {
    assert.match(MANAGE_NATIVE, /if \(view === "loading"\)/);
    // El plan lo publica el provider central y acá se toma el REMOTO: es lo
    // único que el backend confirmó para ESTA cuenta. `undefined` es "validando"
    // y `view` responde `loading`, así que no se dibuja ninguna salida todavía.
    assert.match(
      MANAGE_NATIVE,
      /const \{ remote: entitlement, owner: clerkOwner \} = useEntitlement\(\);/
    );
    assert.equal(
      /useQuery\(/.test(MANAGE_NATIVE),
      false,
      "el Perfil no monta su propia query de plan: era una tercera copia de la misma verdad"
    );
    // Y la vista EFECTIVA —remoto o snapshot cacheado— no gobierna ninguna
    // gestión: un snapshot local no puede abrir un portal de facturación ni
    // autorizar una restauración.
    const gestion = sinComentarios(MANAGE_NATIVE);
    assert.equal(
      /\beffective\b|EntitlementSnapshot|labelReady/.test(gestion),
      false,
      "la gestión se decide con el remoto, nunca con la vista cacheada"
    );
    // La ÚNICA `subscriptions.getCurrent` de la UI nativa vive en el provider,
    // con `skip` sin sesión viva y correlacionada con el dueño de Clerk antes de
    // publicarse.
    assert.equal(
      (PLAN_PROVIDER.match(/useQuery\(appApi\.subscriptions\.getCurrent/g) ?? []).length,
      1,
      "una segunda `getCurrent` reabre la ventana en la que el plan de A vale para B"
    );
    assert.match(
      PLAN_PROVIDER,
      /useQuery\(appApi\.subscriptions\.getCurrent, isLive \? \{\} : "skip"\)/
    );
    assert.equal(
      (PLAN_PROVIDER.match(/safeEntitlement\(/g) ?? []).length,
      1,
      "la correlación con el dueño se hace UNA vez, sobre la única query"
    );
    assert.match(
      PLAN_PROVIDER,
      /safeEntitlement\(raw as NativeSubscriptionSnapshot \| null \| undefined, owner\)/
    );
  });

  it("REPRO: el portal de Stripe NO depende de la identidad de RevenueCat", () => {
    // Atado a `revenueCat.identifiedUserId`, una suscripción de Stripe viva se
    // quedaba sin forma de cancelarse en cuanto el SDK estaba `unavailable`.
    //
    // La cuenta de Órbita ya no se vuelve a derivar acá: sale del mismo provider
    // que publica el plan, así que el dueño y el entitlement que se le atribuye
    // no pueden desalinearse ni por un render.
    assert.match(
      MANAGE_NATIVE,
      /const \{ remote: entitlement, owner: clerkOwner \} = useEntitlement\(\);/
    );
    assert.equal(
      /useOrbitaAuth|auth\?\.(isSignedIn|userId)/.test(MANAGE_NATIVE),
      false,
      "una segunda derivación del dueño es una segunda ventana A → B"
    );
    // Y esa derivación única vive en el provider, atada a Clerk y a nada más.
    assert.match(PLAN_PROVIDER, /const owner = auth\?\.isSignedIn \? auth\.userId \?\? null : null;/);
    assert.equal(
      /identifiedUserId|[rR]evenueCat/.test(sinComentarios(PLAN_PROVIDER)),
      false,
      "el dueño del plan es el de Clerk: la tienda no participa de esa decisión"
    );
    assert.match(MANAGE_NATIVE, /const storeOwner = revenueCat\.identifiedUserId;/);

    const portal = MANAGE_NATIVE.indexOf("const openStripePortal =");
    const cuerpoPortal = MANAGE_NATIVE.slice(portal, MANAGE_NATIVE.indexOf("const openCustomerCenter =", portal));
    assert.match(cuerpoPortal, /const dueño = clerkOwner;/);
    assert.equal(
      /storeOwner|revenueCat\./.test(cuerpoPortal),
      false,
      "el portal de Stripe no puede consultar la tienda"
    );
    // Y revalida el dueño de Clerk DOS veces: antes de pedir la URL y antes de
    // abrirla. La URL de A nunca se reusa para B.
    assert.equal((cuerpoPortal.match(/ownerRef\.current !== dueño/g) ?? []).length, 2);

    // Las acciones de tienda sí exigen la identidad de RevenueCat alineada.
    for (const nombre of ["const openCustomerCenter =", "const restore ="]) {
      const start = MANAGE_NATIVE.indexOf(nombre);
      const cuerpo = MANAGE_NATIVE.slice(start, MANAGE_NATIVE.indexOf("}, [", start));
      assert.match(cuerpo, /const dueñoTienda = storeOwner;/, nombre);
      assert.match(cuerpo, /if \(!dueño \|\| !dueñoTienda\) return;/, nombre);
    }
    // El marcador de compra se guarda bajo la identidad de la TIENDA.
    assert.match(MANAGE_NATIVE, /storePurchaseGuard\(dueñoTienda, Date\.now\(\)\)/);
    assert.match(MANAGE_NATIVE, /clearPurchaseGuard\(dueñoTienda\)/);
  });

  it("el portal web no hereda el estado de la cuenta anterior ni abre dos sesiones", () => {
    // Estado con dueño: B no puede leer el "ABRIENDO…" ni el error de A.
    assert.match(MANAGE_WEB, /readOwnedValue\(stateSlot, owner, "idle"\)/);
    assert.match(MANAGE_WEB, /publishOwnedValue\(previous, producedBy, ownerRef\.current, value\)/);
    // Candado SÍNCRONO y por dueño: dos toques del mismo tick → una sesión, y
    // un pedido de A en vuelo no deja a B esperando.
    assert.match(MANAGE_WEB, /createOwnerGates\(\)/);
    assert.match(MANAGE_WEB, /const gate = gates\.for\(owner\);/);
    assert.match(MANAGE_WEB, /runExclusive\(gate,/);
    assert.equal(
      /if \(state === "abriendo"\) return;/.test(MANAGE_WEB),
      false,
      "una guarda por estado de React no corta dos toques del mismo tick"
    );
    // Doble revalidación alrededor de la URL, igual que en nativo.
    assert.equal((MANAGE_WEB.match(/ownerRef\.current !== dueño/g) ?? []).length, 2);
    assert.match(MANAGE_WEB, /window\.location\.assign\(url\)/);
  });
});

describe("la paywall del onboarding sigue apagada", () => {
  it("ninguna pantalla de onboarding empuja a /paywall", () => {
    const alcanzables = [...reachableFrom(["app/onboarding.tsx", "app/empezar.tsx"], "native")]
      .filter((rel) => rel.startsWith("src/onboarding/") || rel.startsWith("src/screens/"))
      .filter((rel) => /\.(t|j)sx?$/.test(rel))
      .filter((rel) => /router\.(push|replace)\(\s*["'`]\/paywall/.test(readFileSync(join(ROOT, rel), "utf8")));
    assert.deepEqual(alcanzables, [], "el paywall del onboarding no está autorizado todavía");
  });
});

describe("C13/C14 — configuración sin duplicados ni credenciales de máquina", () => {
  it("`.env.example` declara cada variable una sola vez", () => {
    const lineas = readFileSync(join(ROOT, ".env.example"), "utf8").split("\n");
    const nombres = lineas
      .map((linea) => /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(linea)?.[1])
      .filter((nombre): nombre is string => Boolean(nombre));
    const duplicados = nombres.filter((nombre, index) => nombres.indexOf(nombre) !== index);
    assert.deepEqual([...new Set(duplicados)], []);
  });

  it("`.env.example` no trae ningún secreto cargado", () => {
    const env = readFileSync(join(ROOT, ".env.example"), "utf8");
    for (const clave of [
      "REVENUECAT_WEBHOOK_AUTH",
      "REVENUECAT_SECRET_API_KEY",
      "REVENUECAT_SANDBOX_REVIEW_USER_IDS",
      "STRIPE_SECRET_KEY",
      "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY"
    ]) {
      assert.match(
        env,
        new RegExp("^" + clave + "=[ \\t]*$", "m"),
        `${clave} debe quedar vacía en el ejemplo`
      );
    }
  });

  it("`eas.json` no versiona rutas de máquina ni credenciales de App Store", () => {
    const eas = readFileSync(join(ROOT, "eas.json"), "utf8");
    // Una ruta absoluta a Downloads sólo funciona en una computadora y expone
    // dónde vive la clave privada. Las credenciales van en el almacenamiento
    // seguro de EAS.
    assert.equal(/\/Users\//.test(eas), false, "ruta absoluta de máquina");
    assert.equal(/\.p8/.test(eas), false, "referencia a la clave privada");
    assert.equal(/ascApiKey(Path|Id|IssuerId)/.test(eas), false, "credencial versionada");
    // El id público de la app sí puede quedar.
    assert.match(eas, /"ascAppId"/);
    JSON.parse(eas);
  });
});
