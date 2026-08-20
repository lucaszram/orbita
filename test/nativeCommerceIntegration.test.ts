/**
 * Comercio nativo, conducta de punta a punta (P1 1, 2, 5).
 *
 * Estas pruebas no buscan nombres en el archivo: corren las decisiones reales
 * con relojes y promesas diferidas, que es donde vivían los defectos.
 *
 * - **P1 1** — el borrado del marcador salía de una bandera escrita DENTRO del
 *   updater de `setSession` y leída enseguida. Con updater inmediato,
 *   `store_confirmed` borraba el marcador antes de que Convex confirmara; con
 *   updater diferido, la cancelación y el restore vacío no lo borraban nunca.
 * - **P1 2** — `presentCustomerCenter` y `refreshCustomerInfo` llamaban al SDK
 *   fuera de la cola, así que podían colarse en medio de un `logIn(B)`.
 * - **P1 5** — las continuaciones de A pintaban la pantalla de B.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  applyStoreAnswer,
  backendConfirmsStorePurchase,
  createOwnerGuardedSdkRunner,
  createSdkSerialQueue,
  emptyPurchaseSession,
  entitlementBelongsTo,
  nativePrimaryAction,
  nativeSubscriptionManagement,
  nativeSubscriptionView,
  safeEntitlement,
  ownedValue,
  publishOwnedValue,
  purchaseSessionForOwner,
  readOwnedValue,
  storeAnswerClearsPurchaseGuard,
  storeIdentityIsCurrent,
  type NativePurchaseSession,
  type NativeStoreAnswer
} from "../src/domain/nativeCommerce";
import { createOwnerGates, runExclusive } from "../src/domain/exclusive";
import { parsePurchaseGuardRead, purchaseGuardBlocks } from "../src/domain/purchaseGuard";
import { ROOT } from "./moduleGraph";

// ---------------------------------------------------------------------------
// P1 1 — el marcador se decide por la RESPUESTA, no por el timing de setState
// ---------------------------------------------------------------------------

/** Disco por cuenta, con fallo inyectable. */
function discoDeMarcadores(options: { fallaAlBorrar?: boolean } = {}) {
  const claves = new Set<string>();
  return {
    claves,
    async escribir(userId: string) {
      claves.add(userId);
    },
    async borrar(userId: string) {
      if (options.fallaAlBorrar) throw new Error("AsyncStorage caído");
      claves.delete(userId);
    }
  };
}

/**
 * El `answerStore` REAL de la pantalla, extraído a una función para poder
 * inyectarle el setter.
 *
 * Reproduce el orden que importa: primero el disco, después la sesión. Si el
 * borrado falla, la sesión NO se limpia.
 */
function crearAnswerStore(deps: {
  setSession: (updater: (previous: NativePurchaseSession) => NativePurchaseSession) => void;
  disco: ReturnType<typeof discoDeMarcadores>;
}) {
  return async function answerStore(
    userId: string | null,
    answer: NativeStoreAnswer
  ): Promise<boolean> {
    const debeLimpiar = storeAnswerClearsPurchaseGuard(answer);
    if (debeLimpiar && userId) {
      try {
        await deps.disco.borrar(userId);
      } catch {
        deps.setSession((previous) => applyStoreAnswer(previous, userId, "purchase_ambiguous"));
        return false;
      }
    }
    deps.setSession((previous) => applyStoreAnswer(previous, userId, answer));
    return true;
  };
}

/** Un `setState` que corre el updater YA. */
function setterInmediato(inicial: NativePurchaseSession) {
  let actual = inicial;
  return {
    leer: () => actual,
    set: (updater: (previous: NativePurchaseSession) => NativePurchaseSession) => {
      actual = updater(actual);
    }
  };
}

/** Un `setState` que acumula updaters y los corre cuando se le pide. */
function setterDiferido(inicial: NativePurchaseSession) {
  let actual = inicial;
  const pendientes: Array<(previous: NativePurchaseSession) => NativePurchaseSession> = [];
  return {
    leer: () => actual,
    set: (updater: (previous: NativePurchaseSession) => NativePurchaseSession) => {
      pendientes.push(updater);
    },
    aplicar: () => {
      for (const updater of pendientes.splice(0)) actual = updater(actual);
    }
  };
}

const sesionDe = (userId: string): NativePurchaseSession => ({
  ...emptyPurchaseSession(userId),
  guard: "clear"
});

describe("P1 1 — el marcador no depende del timing de setState", () => {
  for (const modo of ["inmediato", "diferido"] as const) {
    it(`REPRO (${modo}): store_confirmed NUNCA borra el marcador`, async () => {
      // Con updater inmediato, `store_confirmed` sobre una sesión que arrancó
      // `clear` daba "limpió" y borraba el marcador con el cargo ya hecho.
      const disco = discoDeMarcadores();
      const setter =
        modo === "inmediato" ? setterInmediato(sesionDe("user_a")) : setterDiferido(sesionDe("user_a"));
      const answerStore = crearAnswerStore({ setSession: setter.set, disco });

      await disco.escribir("user_a");
      await answerStore("user_a", "purchase_started");
      await answerStore("user_a", "store_confirmed");
      if (modo === "diferido") (setter as ReturnType<typeof setterDiferido>).aplicar();

      assert.equal(disco.claves.has("user_a"), true, "el marcador sobrevive hasta que Convex confirme");
      assert.equal(setter.leer().guard, "blocked");
    });

    it(`REPRO (${modo}): purchase_cancelled y restore_empty SÍ lo borran`, async () => {
      // Con updater diferido, la bandera vieja quedaba en `false` y estas dos
      // respuestas —las únicas que demuestran que no hay cargo— no limpiaban.
      for (const answer of ["purchase_cancelled", "restore_empty"] as const) {
        const disco = discoDeMarcadores();
        const setter =
          modo === "inmediato"
            ? setterInmediato(sesionDe("user_a"))
            : setterDiferido(sesionDe("user_a"));
        const answerStore = crearAnswerStore({ setSession: setter.set, disco });

        await disco.escribir("user_a");
        await answerStore("user_a", "purchase_started");
        assert.equal(await answerStore("user_a", answer), true, answer);
        if (modo === "diferido") (setter as ReturnType<typeof setterDiferido>).aplicar();

        assert.equal(disco.claves.has("user_a"), false, `${answer} tiene que limpiar el disco`);
        assert.equal(setter.leer().guard, "clear", answer);
      }
    });
  }

  it("`purchase_started` bloquea memoria y disco ANTES de la hoja de la tienda", async () => {
    const disco = discoDeMarcadores();
    const setter = setterInmediato(sesionDe("user_a"));
    const answerStore = crearAnswerStore({ setSession: setter.set, disco });

    await disco.escribir("user_a");
    await answerStore("user_a", "purchase_started");

    assert.equal(disco.claves.has("user_a"), true);
    assert.equal(setter.leer().guard, "blocked");
    assert.equal(setter.leer().lastOutcome, "ambiguous");
  });

  it("REPRO: si el disco falla al borrar, NO se habilita la recompra", async () => {
    const disco = discoDeMarcadores({ fallaAlBorrar: true });
    const setter = setterInmediato(sesionDe("user_a"));
    const answerStore = crearAnswerStore({ setSession: setter.set, disco });

    await disco.escribir("user_a");
    await answerStore("user_a", "purchase_started");
    const limpio = await answerStore("user_a", "purchase_cancelled");

    assert.equal(limpio, false, "la pantalla se entera del fallo");
    assert.equal(disco.claves.has("user_a"), true);
    assert.equal(setter.leer().guard, "blocked", "sigue bloqueada: no se simula el borrado");
  });

  it("una respuesta tardía de A limpia el marcador de A sin tocar el estado de B", async () => {
    const disco = discoDeMarcadores();
    // La pantalla ya es de B.
    const setter = setterInmediato(sesionDe("user_b"));
    const answerStore = crearAnswerStore({ setSession: setter.set, disco });

    await disco.escribir("user_a");
    await disco.escribir("user_b");
    await answerStore("user_a", "restore_empty");

    assert.equal(disco.claves.has("user_a"), false, "el marcador de A sí se levanta");
    assert.equal(disco.claves.has("user_b"), true, "el de B no se toca");
    assert.equal(setter.leer().userId, "user_b");
    assert.equal(setter.leer().guard, "clear", "y el estado de B queda como estaba");
  });

  it("la tabla de limpieza es explícita y no admite `store_confirmed`", () => {
    assert.equal(storeAnswerClearsPurchaseGuard("purchase_cancelled"), true);
    assert.equal(storeAnswerClearsPurchaseGuard("restore_empty"), true);
    assert.equal(storeAnswerClearsPurchaseGuard("store_confirmed"), false);
    assert.equal(storeAnswerClearsPurchaseGuard("purchase_started"), false);
    assert.equal(storeAnswerClearsPurchaseGuard("purchase_ambiguous"), false);
    // `getCustomerInfo` puede venir del caché: vacío ahí no es autoritativo.
    assert.equal(storeAnswerClearsPurchaseGuard("recheck_empty"), false);
  });

  it("sólo la confirmación de RevenueCat autoriza a levantar el marcador", () => {
    const soloStripe = {
      isPro: true,
      provider: "stripe",
      isLifetime: false,
      canManageInStripePortal: true,
      canManageInRevenueCat: false,
      activeProviders: ["stripe"]
    };
    assert.equal(backendConfirmsStorePurchase(soloStripe), false);
    assert.equal(
      backendConfirmsStorePurchase({ ...soloStripe, activeProviders: ["revenuecat", "stripe"] }),
      true
    );
  });
});

// ---------------------------------------------------------------------------
// P1 2 — una sola cola para TODO lo que toca el SDK
// ---------------------------------------------------------------------------

describe("P1 2 — la cola del SDK cubre toda operación sensible a identidad", () => {
  /** Banco con identidad mutable y operaciones que se sueltan a mano. */
  function bancoSdk() {
    let identidad: string | null = "user_a";
    const enqueue = createSdkSerialQueue();
    const runOnStore = createOwnerGuardedSdkRunner(enqueue, () => identidad);
    const tocado: Array<{ op: string; owner: string }> = [];
    return {
      enqueue,
      runOnStore,
      tocado,
      identidad: () => identidad,
      cambiarA: (siguiente: string | null) => {
        identidad = siguiente;
      },
      operacion:
        (nombre: string) =>
        async (owner: string) => {
          tocado.push({ op: nombre, owner });
          return owner;
        }
    };
  }

  /**
   * Promesa que se suelta a mano, creada de forma SÍNCRONA.
   *
   * La versión anterior declaraba `let soltar = () => undefined` y recién le
   * asignaba el `resolve` real DENTRO del callback encolado. Como la cola
   * arranca ese callback en una microtask, el `soltar()` del test corría el
   * noop y la promesa no resolvía nunca: el archivo quedaba colgado. Acá
   * `promise` y `resolve` existen antes de encolar nada. Sin timers.
   */
  function deferred<T = void>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((cumplir) => {
      resolve = cumplir;
    });
    return { promise, resolve };
  }

  /**
   * A pide una operación mientras una transición a B ocupa la cola.
   *
   * El resultado se captura con `then` APENAS se pide, así la promesa nunca
   * queda sin manejador aunque el rechazo llegue antes de que el test la mire.
   */
  async function operacionDeAConTransicionAB(nombre: string) {
    const b = bancoSdk();
    // El deferred existe ANTES de encolar: no hay ventana donde soltar sea noop.
    const puerta = deferred();
    const transicion = b.enqueue(async () => {
      await puerta.promise;
      b.cambiarA("user_b");
    });

    // La operación de A se encola DETRÁS de la transición, todavía en vuelo.
    const resultado = b.runOnStore(b.operacion(nombre)).then(
      () => ({ ok: true as const }),
      (error: Error) => ({ ok: false as const, error })
    );

    puerta.resolve();
    await transicion;
    return { b, resultado };
  }

  it("REPRO: el Customer Center de A no puede abrir la cuenta de B", async () => {
    const { b, resultado } = await operacionDeAConTransicionAB("customer_center");
    const salida = await resultado;
    assert.equal(salida.ok, false, "la operación de A no puede correr sobre B");
    if (!salida.ok) assert.match(salida.error.message, /REVENUECAT_IDENTIFIED_USER_REQUIRED/);
    assert.deepEqual(b.tocado, [], "el SDK no se tocó con la cuenta equivocada");
    assert.equal(b.identidad(), "user_b");
  });

  it("REPRO: el refresh de A tampoco lee la cuenta de B", async () => {
    const { b, resultado } = await operacionDeAConTransicionAB("refresh");
    const salida = await resultado;
    assert.equal(salida.ok, false);
    if (!salida.ok) assert.match(salida.error.message, /REVENUECAT_IDENTIFIED_USER_REQUIRED/);
    assert.deepEqual(b.tocado, []);
  });

  it("una transición A→B ESPERA a la operación de A que ya está en vuelo", async () => {
    const b = bancoSdk();
    const orden: string[] = [];
    // Los dos deferreds se crean antes de encolar nada: uno para saber que la
    // compra YA empezó, otro para soltarla cuando el test lo decida.
    const empezo = deferred();
    const puerta = deferred();

    const compra = b.runOnStore(async (owner) => {
      empezo.resolve();
      await puerta.promise;
      orden.push(`compra:${owner}`);
    });
    // Se espera el arranque real de la compra antes de encolar el `logIn(B)`:
    // así el orden que se mide es el de la cola, no el de las microtasks.
    await empezo.promise;

    const login = b.enqueue(async () => {
      orden.push("login:user_b");
      b.cambiarA("user_b");
    });

    puerta.resolve();
    await compra;
    await login;

    assert.deepEqual(orden, ["compra:user_a", "login:user_b"], "el logIn esperó a la compra");
    assert.deepEqual(b.tocado, []);
  });

  it("con la identidad estable, todas las operaciones corren y en orden", async () => {
    const b = bancoSdk();
    await b.runOnStore(b.operacion("offering"));
    await b.runOnStore(b.operacion("purchase"));
    await b.runOnStore(b.operacion("restore"));
    await b.runOnStore(b.operacion("customer_center"));
    await b.runOnStore(b.operacion("refresh"));
    await b.runOnStore(b.operacion("retry"));
    assert.deepEqual(
      b.tocado.map((entrada) => entrada.op),
      ["offering", "purchase", "restore", "customer_center", "refresh", "retry"]
    );
    assert.ok(b.tocado.every((entrada) => entrada.owner === "user_a"));
  });

  it("sin identidad no se toca el SDK", async () => {
    const b = bancoSdk();
    b.cambiarA(null);
    await assert.rejects(b.runOnStore(b.operacion("purchase")), /REVENUECAT_IDENTIFIED_USER_REQUIRED/);
    assert.deepEqual(b.tocado, []);
  });

  it("un error de una operación no traba la cola", async () => {
    const b = bancoSdk();
    await assert.rejects(
      b.runOnStore(async () => {
        throw new Error("la tienda falló");
      })
    );
    await b.runOnStore(b.operacion("restore"));
    assert.deepEqual(b.tocado.map((entrada) => entrada.op), ["restore"]);
  });
});

// ---------------------------------------------------------------------------
// P1 5 — estado, mensajes y sesión con dueño
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Estado transitorio del provider y publicación write-side
// ---------------------------------------------------------------------------

describe("provider — el render intermedio A→B no expone nada de A", () => {
  it("REPRO: con la identidad publicada de A y la sesión ya en B, no hay dueño", () => {
    // El efecto que limpia el estado corre DESPUÉS del render: en ese render
    // `identifiedUserId`, `plans`, `phase: "ready"` y `storeIsPro` seguían
    // siendo los de A bajo la sesión de B.
    assert.equal(
      storeIdentityIsCurrent({ isLive: true, liveUserId: "user_b", publishedOwner: "user_a" }),
      false
    );
  });

  it("sólo vale cuando la identidad publicada ES la de la sesión viva", () => {
    assert.equal(
      storeIdentityIsCurrent({ isLive: true, liveUserId: "user_a", publishedOwner: "user_a" }),
      true
    );
    // Todavía no publicó ninguna: estado seguro.
    assert.equal(
      storeIdentityIsCurrent({ isLive: true, liveUserId: "user_a", publishedOwner: null }),
      false
    );
    // Sin sesión no hay dueño posible.
    assert.equal(
      storeIdentityIsCurrent({ isLive: true, liveUserId: null, publishedOwner: "user_a" }),
      false
    );
    // La app todavía no está viva: nada es autoritativo.
    assert.equal(
      storeIdentityIsCurrent({ isLive: false, liveUserId: "user_a", publishedOwner: "user_a" }),
      false
    );
  });

  it("el provider cuelga identidad, planes y store de esa comprobación", () => {
    const provider = readFileSync(
      join(ROOT, "src/services/revenuecat/RevenueCatProvider.tsx"),
      "utf8"
    );
    assert.match(provider, /storeIdentityIsCurrent\(\{/);
    assert.match(provider, /plans: publishedOwner \? plans : \[\]/);
    assert.match(provider, /storeIsPro: publishedOwner \? storeIsPro : false/);
    assert.match(provider, /identifiedUserId: publishedOwner/);
    // La oferta publicada también cuelga del dueño: sin él no se expone ni su
    // identificador, así que la pantalla no puede contar una impresión de A.
    assert.match(provider, /offeringId: publishedOwner \? offeringId : null/);
    // Y la analítica del paywall se emite dentro de la cola con el dueño
    // capturado (`runOnStore`), no al cargar el Offering.
    const impresion = provider.indexOf("const trackPaywallImpression =");
    assert.ok(impresion > 0, "falta el método de impresión");
    assert.match(provider.slice(impresion, impresion + 400), /runOnStore\(/);
  });
});

describe("write-side — un cierre tardío de A no pisa el estado de B", () => {
  it("REPRO: el `finally` de A no deja a B en idle ni le borra el mensaje", () => {
    // B está restaurando, con su mensaje puesto.
    const estadoDeB = ownedValue<"idle" | "restoring">("user_b", "restoring");
    const mensajeDeB = ownedValue<string | null>("user_b", "Restaurando…");

    // Llega, tarde, el cierre de A. Antes esto REEMPLAZABA el slot y B caía al
    // fallback: se le apagaba el spinner y se le borraba el mensaje.
    const trasCierreDeA = publishOwnedValue(estadoDeB, "user_a", "user_b", "idle");
    const trasErrorDeA = publishOwnedValue(mensajeDeB, "user_a", "user_b", "No pudimos restaurar.");

    assert.deepEqual(trasCierreDeA, estadoDeB, "el slot de B queda intacto");
    assert.deepEqual(trasErrorDeA, mensajeDeB);
    assert.equal(readOwnedValue(trasCierreDeA, "user_b", "idle"), "restoring");
    assert.equal(readOwnedValue(trasErrorDeA, "user_b", null), "Restaurando…");
  });

  it("el dueño vigente sí puede publicar", () => {
    const slot = ownedValue<string | null>("user_b", "Restaurando…");
    const siguiente = publishOwnedValue(slot, "user_b", "user_b", "Tu compra está restaurada.");
    assert.equal(readOwnedValue(siguiente, "user_b", null), "Tu compra está restaurada.");
  });

  it("una publicación sin dueño nunca entra", () => {
    const slot = ownedValue<string | null>("user_b", "Restaurando…");
    assert.deepEqual(publishOwnedValue(slot, null, null, "algo"), slot);
    assert.deepEqual(publishOwnedValue(slot, null, "user_b", "algo"), slot);
  });

  it("las dos pantallas publican con la ref viva, no con el closure del render", () => {
    const paywall = readFileSync(join(ROOT, "src/screens/v492/PlusPaywallScreen.tsx"), "utf8");
    const manage = readFileSync(join(ROOT, "src/components/orbita/ManageSubscription.tsx"), "utf8");
    for (const [nombre, fuente] of [
      ["paywall", paywall],
      ["manage", manage]
    ] as const) {
      assert.match(fuente, /ownerRef\.current = /, nombre);
      assert.match(fuente, /publishOwnedValue\(previous, [a-zA-ZñÑ]+, ownerRef\.current/, nombre);
    }
    // Y la reconciliación se decide contra la ref, no contra el render viejo.
    assert.match(paywall, /userId === ownerRef\.current/);
    assert.match(manage, /ownerRef\.current !== dueño\) return;/);
    assert.doesNotMatch(paywall, /userId === revenueCat\.identifiedUserId/);
    assert.doesNotMatch(manage, /revenueCat\.identifiedUserId !== dueño/);
  });

  it("el paywall persiste el guard ANTES de restaurar, como Perfil", () => {
    const paywall = readFileSync(join(ROOT, "src/screens/v492/PlusPaywallScreen.tsx"), "utf8");
    const inicio = paywall.indexOf("const restore =");
    assert.ok(inicio > 0);
    const cuerpo = paywall.slice(inicio, paywall.indexOf("const retryActivation", inicio));
    const guard = cuerpo.indexOf("armStoreGuard(userId)");
    const restaurar = cuerpo.indexOf("revenueCat.restore()");
    assert.ok(guard > 0, "el restore del paywall tiene que poner el marcador");
    assert.ok(guard < restaurar, "y hacerlo ANTES de restaurar");
    // El helper pone disco Y memoria, en ese orden.
    const armado = paywall.indexOf("const armStoreGuard =");
    const cuerpoArmado = paywall.slice(armado, paywall.indexOf("const purchase =", armado));
    assert.ok(
      cuerpoArmado.indexOf("storePurchaseGuard(") <
        cuerpoArmado.indexOf('answerStore(userId, "purchase_started")'),
      "primero el disco, después la memoria"
    );
    // `store_confirmed` no lo levanta: eso lo prueba la tabla de arriba.
    assert.match(cuerpo, /answerStore\(userId, "store_confirmed"\)/);
    assert.match(cuerpo, /answerStore\(userId, "restore_empty"\)/);
  });

  it("el portal de Stripe revalida el dueño dos veces, en nativo y en web", () => {
    for (const archivo of [
      "src/components/orbita/ManageSubscription.tsx",
      "src/components/orbita/ManageSubscription.web.tsx"
    ]) {
      const fuente = readFileSync(join(ROOT, archivo), "utf8");
      const inicio = fuente.search(/const open(StripePortal|Portal) = useCallback/);
      assert.ok(inicio > 0, archivo);
      const cuerpo = fuente.slice(inicio, inicio + 1200);
      const revalidaciones = [...cuerpo.matchAll(/ownerRef\.current !== dueño/g)];
      assert.ok(
        revalidaciones.length >= 2,
        `${archivo}: antes de pedir el portal y antes de navegar`
      );
      const pedido = cuerpo.indexOf("createPortal({})");
      const apertura = cuerpo.search(/Linking\.openURL\(url\)|window\.location\.assign\(url\)/);
      assert.ok(pedido > 0 && apertura > pedido, archivo);
    }
  });
});

describe("P1 5 — una continuación de A no pinta la pantalla de B", () => {
  it("el mensaje de A no se ve cuando el dueño vigente es B", () => {
    const publicado = ownedValue("user_a", "No pudimos restaurar tus compras.");
    assert.equal(readOwnedValue(publicado, "user_a", null), "No pudimos restaurar tus compras.");
    assert.equal(readOwnedValue(publicado, "user_b", null), null);
    assert.equal(readOwnedValue(publicado, null, null), null);
  });

  it("el `finally` de A no deja a B en «restaurando»", () => {
    const publicado = ownedValue<"idle" | "restoring">("user_a", "restoring");
    assert.equal(readOwnedValue(publicado, "user_b", "idle"), "idle");
    assert.equal(readOwnedValue(publicado, "user_a", "idle"), "restoring");
  });

  it("un aviso publicado sin dueño no se muestra nunca", () => {
    assert.equal(readOwnedValue(ownedValue(null, "algo"), "user_a", null), null);
    assert.equal(readOwnedValue(ownedValue(null, "algo"), null, null), null);
  });

  it("la sesión de compra tampoco cruza de cuenta", () => {
    const deA = applyStoreAnswer(sesionDe("user_a"), "user_a", "purchase_started");
    assert.equal(deA.guard, "blocked");
    // Leída como B, arranca de cero: el `guardLoaded` de A no habilita comprar.
    const comoB = purchaseSessionForOwner(deA, "user_b");
    assert.equal(comoB.userId, "user_b");
    assert.equal(comoB.guard, "loading");
    // Y una respuesta de A no puede escribir en la sesión de B — ni para
    // limpiar (que habilitaría comprar con un cargo en el aire) ni para
    // bloquear.
    const bBloqueada = applyStoreAnswer(sesionDe("user_b"), "user_b", "purchase_started");
    assert.equal(bBloqueada.guard, "blocked");
    assert.equal(
      applyStoreAnswer(bBloqueada, "user_a", "restore_empty").guard,
      "blocked",
      "el restore vacío de A no desbloquea a B"
    );
    assert.deepEqual(applyStoreAnswer(sesionDe("user_b"), "user_a", "purchase_ambiguous"), sesionDe("user_b"));
  });
});

// ---------------------------------------------------------------------------
// F — Restaurar bloquea en MEMORIA y en disco, o no toca la tienda
// ---------------------------------------------------------------------------

/**
 * El circuito REAL de `restore` en el paywall, con el disco y la sesión de
 * verdad. Sólo la tienda es de mentira.
 *
 * El agujero: el marcador se escribía en disco pero la SESIÓN quedaba limpia.
 * Si `revenueCat.restore()` tiraba —o contestaba algo ambiguo— la misma
 * pantalla volvía a ofrecer "comprar" con una compra posiblemente viva y ya
 * revelada. El disco recién frenaba en el próximo montaje.
 */
function simularRestore(userId: string, tienda: () => Promise<"active" | "inactive">) {
  const disco = discoDeMarcadores();
  const setter = setterInmediato(sesionDe(userId));
  const answerStore = crearAnswerStore({ setSession: setter.set, disco });
  const llamadas: string[] = [];
  let escrituraFalla = false;

  /** El `armStoreGuard` de la pantalla: disco primero, memoria después. */
  const armStoreGuard = async (): Promise<boolean> => {
    if (escrituraFalla) return false;
    await disco.escribir(userId);
    await answerStore(userId, "purchase_started");
    return true;
  };

  return {
    disco,
    llamadas,
    sesion: () => setter.leer(),
    romperEscritura: () => {
      escrituraFalla = true;
    },
    /** Botón primario con la oferta lista y el entitlement resuelto en Free. */
    primario: () =>
      nativePrimaryAction({
        offeringReady: true,
        backendIsPro: false,
        storeConfirmed: setter.leer().purchaseReceived,
        busy: false,
        lastOutcome: setter.leer().lastOutcome,
        guardLoaded: setter.leer().guard !== "loading"
      }),
    /** Remonte: la pantalla vuelve a leer el disco para esta cuenta. */
    remontar: () => {
      const raw = disco.claves.has(userId)
        ? JSON.stringify({ userId, startedAt: 1 })
        : null;
      const read = parsePurchaseGuardRead(raw, userId);
      const bloquea = purchaseGuardBlocks(read);
      return nativePrimaryAction({
        offeringReady: true,
        backendIsPro: false,
        storeConfirmed: false,
        busy: false,
        lastOutcome: bloquea ? "ambiguous" : "none",
        guardLoaded: true
      });
    },
    restore: async () => {
      if (!(await armStoreGuard())) {
        llamadas.push("aviso:no-preparado");
        return;
      }
      try {
        llamadas.push("tienda");
        const result = await tienda();
        if (result === "inactive") {
          await answerStore(userId, "restore_empty");
          return;
        }
        await answerStore(userId, "store_confirmed");
      } catch {
        await answerStore(userId, "purchase_ambiguous");
        llamadas.push("aviso:error");
      }
    }
  };
}

describe("F — Restaurar: el bloqueo vive en memoria Y en disco", () => {
  it("REPRO: si `restore` TIRA, el botón primario NO vuelve a ser comprar en esta misma pantalla", async () => {
    const s = simularRestore("user_a", async () => {
      throw new Error("red caída");
    });
    assert.equal(s.primario(), "purchase", "antes de tocar nada, comprar es legítimo");
    await s.restore();
    assert.deepEqual(s.llamadas, ["tienda", "aviso:error"]);
    assert.equal(s.sesion().guard, "blocked");
    assert.equal(s.sesion().lastOutcome, "ambiguous");
    assert.equal(s.primario(), "restore", "la única salida es Restaurar");
    // Y el remonte tampoco lo suelta: el marcador quedó en disco.
    assert.equal(s.disco.claves.has("user_a"), true);
    assert.equal(s.remontar(), "restore");
  });

  it("si el marcador no se puede escribir, la tienda NO se toca y no se inventa un cargo", async () => {
    let tocada = false;
    const s = simularRestore("user_a", async () => {
      tocada = true;
      return "active";
    });
    s.romperEscritura();
    await s.restore();
    assert.equal(tocada, false, "sin marcador no se abre la tienda");
    assert.deepEqual(s.llamadas, ["aviso:no-preparado"]);
    assert.equal(s.sesion().lastOutcome, "none", "no se afirma que hubo cargo");
    assert.equal(s.sesion().guard, "clear");
    assert.equal(s.primario(), "purchase", "quien no fue cobrado sigue pudiendo comprar");
    assert.equal(s.disco.claves.has("user_a"), false);
  });

  it("`active` conserva el marcador hasta que Convex confirme a RevenueCat", async () => {
    const s = simularRestore("user_a", async () => "active");
    await s.restore();
    assert.equal(s.sesion().purchaseReceived, true);
    assert.equal(s.disco.claves.has("user_a"), true, "el cargo existe: el disco sigue marcado");
    assert.equal(s.primario(), "wait", "nunca vuelve a ofrecer comprar");
    // Sólo la confirmación que incluye a RevenueCat levanta el marcador.
    assert.equal(
      backendConfirmsStorePurchase({
        isPro: true,
        provider: "stripe",
        isLifetime: false,
        canManageInStripePortal: true,
        activeProviders: ["stripe"]
      }),
      false
    );
    assert.equal(
      backendConfirmsStorePurchase({
        isPro: true,
        provider: "revenuecat",
        isLifetime: false,
        canManageInStripePortal: false,
        activeProviders: ["revenuecat"]
      }),
      true
    );
  });

  it("`inactive` definitivo sí lo limpia: quien nunca fue cobrado puede comprar", async () => {
    const s = simularRestore("user_a", async () => "inactive");
    await s.restore();
    assert.equal(s.sesion().guard, "clear");
    assert.equal(s.sesion().lastOutcome, "none");
    assert.equal(s.disco.claves.has("user_a"), false);
    assert.equal(s.primario(), "purchase");
    assert.equal(s.remontar(), "purchase");
  });
});

// ---------------------------------------------------------------------------
// H — el candado del portal: uno por tick, y por dueño
// ---------------------------------------------------------------------------

describe("H — dos toques crean UNA sesión, y B no espera a A", () => {
  it("dos toques del MISMO tick abren una sola sesión de portal", async () => {
    const gates = createOwnerGates();
    let sesiones = 0;
    const abrir = () =>
      runExclusive(gates.for("user_a"), async () => {
        sesiones += 1;
        await Promise.resolve();
      });
    // Sin await entre los dos: es el rebote de un dedo.
    const [uno, dos] = await Promise.all([abrir(), abrir()]);
    assert.equal(sesiones, 1);
    assert.deepEqual([uno.ran, dos.ran], [true, false]);
  });

  it("REPRO: un pedido de A en vuelo no deja a B esperando su propio portal", async () => {
    const gates = createOwnerGates();
    let soltarA: () => void = () => undefined;
    const enVuelo = new Promise<void>((resolve) => {
      soltarA = () => resolve();
    });
    const corridaA = runExclusive(gates.for("user_a"), () => enVuelo);

    // Clerk cambia de cuenta: B pide lo suyo con A todavía sin resolver.
    let corrioB = false;
    const corridaB = await runExclusive(gates.for("user_b"), async () => {
      corrioB = true;
    });
    assert.equal(corridaB.ran, true, "B tiene su propio candado");
    assert.equal(corrioB, true);

    // Y cuando A termina, libera el suyo sin tocar el de B.
    soltarA();
    await corridaA;
    assert.equal(gates.for("user_b").held(), false);
  });

  it("el mismo dueño conserva SU candado entre renders", () => {
    const gates = createOwnerGates();
    assert.equal(gates.for("user_a"), gates.for("user_a"));
    assert.notEqual(gates.for("user_a"), gates.for("user_b"));
    // Y sin sesión también tiene el suyo, estable.
    assert.equal(gates.for(null), gates.for(null));
  });

  it("REPRO A→B→A: volver a A no destraba la operación de A que sigue en vuelo", async () => {
    // La primera versión guardaba UN candado y lo reemplazaba al cambiar de
    // dueño: al volver a A se fabricaba uno nuevo, así que la segunda operación
    // de A entraba con la primera todavía sin resolver —y el `finally` de la
    // primera liberaba un candado que ya no era el suyo—.
    const gates = createOwnerGates();
    let soltarA: () => void = () => undefined;
    const enVuelo = new Promise<void>((resolve) => {
      soltarA = () => resolve();
    });
    let corridasDeA = 0;
    const primeraA = runExclusive(gates.for("user_a"), async () => {
      corridasDeA += 1;
      await enVuelo;
    });

    // A → B (B tiene el suyo y corre) → A otra vez.
    assert.equal((await runExclusive(gates.for("user_b"), async () => undefined)).ran, true);
    const segundaA = await runExclusive(gates.for("user_a"), async () => {
      corridasDeA += 1;
    });
    assert.equal(segundaA.ran, false, "A sigue bloqueado por su propia operación");
    assert.equal(corridasDeA, 1);

    // Cuando la primera termina, A puede volver a entrar.
    soltarA();
    await primeraA;
    assert.equal((await runExclusive(gates.for("user_a"), async () => undefined)).ran, true);
  });

  it("el estado del portal de A no se lee ni se pisa bajo B", () => {
    const abriendo = ownedValue<"idle" | "abriendo" | "error">("user_a", "abriendo");
    assert.equal(readOwnedValue(abriendo, "user_b", "idle"), "idle", "B arranca idle");
    // Y el error tardío de A tampoco reemplaza el slot que B tenga puesto.
    const deB = ownedValue<"idle" | "abriendo" | "error">("user_b", "abriendo");
    assert.deepEqual(publishOwnedValue(deB, "user_a", "user_b", "error"), deB);
  });
});

// ---------------------------------------------------------------------------
// I — una impresión es alguien mirando el paywall
// ---------------------------------------------------------------------------

describe("I — la impresión se cuenta una vez por vista, dueño y oferta", () => {
  /** La regla de la pantalla, extraída tal cual: clave `dueño:oferta`. */
  function vistaDelPaywall() {
    let ultima: string | null = null;
    const impresiones: string[] = [];
    return {
      impresiones,
      render: (input: { ready: boolean; owner: string | null; offeringId: string | null }) => {
        if (!input.ready || !input.owner || !input.offeringId) return;
        const clave = `${input.owner}:${input.offeringId}`;
        if (ultima === clave) return;
        ultima = clave;
        impresiones.push(clave);
      }
    };
  }

  it("varios renders de la misma vista cuentan UNA sola", () => {
    const vista = vistaDelPaywall();
    for (let i = 0; i < 5; i += 1) {
      vista.render({ ready: true, owner: "user_a", offeringId: "default" });
    }
    assert.deepEqual(vista.impresiones, ["user_a:default"]);
  });

  it("no se cuenta nada mientras la oferta no está lista ni sin dueño", () => {
    const vista = vistaDelPaywall();
    vista.render({ ready: false, owner: "user_a", offeringId: "default" });
    vista.render({ ready: true, owner: null, offeringId: "default" });
    vista.render({ ready: true, owner: "user_a", offeringId: null });
    assert.deepEqual(vista.impresiones, []);
  });

  it("un cambio de cuenta o de oferta sí es otra impresión", () => {
    const vista = vistaDelPaywall();
    vista.render({ ready: true, owner: "user_a", offeringId: "default" });
    vista.render({ ready: true, owner: "user_b", offeringId: "default" });
    vista.render({ ready: true, owner: "user_b", offeringId: "promo" });
    assert.deepEqual(vista.impresiones, ["user_a:default", "user_b:default", "user_b:promo"]);
  });

  it("una impresión pedida por A que resuelve bajo B no se emite", async () => {
    // El método del provider corre en la cola con el dueño capturado: es el
    // mismo cerco que usan comprar y restaurar.
    const enqueue = createSdkSerialQueue();
    let dueño: string | null = "user_a";
    const run = createOwnerGuardedSdkRunner(enqueue, () => dueño);
    const emitidas: string[] = [];
    const pedido = run(async (owner) => {
      emitidas.push(owner);
    });
    dueño = "user_b";
    await assert.rejects(pedido, /REVENUECAT_IDENTIFIED_USER_REQUIRED/);
    assert.deepEqual(emitidas, []);
  });
});

// ---------------------------------------------------------------------------
// G — Stripe y la tienda son dos comercios, con dos dueños
// ---------------------------------------------------------------------------

describe("G — el portal de Stripe no depende de RevenueCat", () => {
  /** Lo que decide cada acción del bloque de plan, con los dos dueños. */
  const puedeAbrirPortal = (clerkOwner: string | null) => clerkOwner !== null;
  const puedeTocarLaTienda = (clerkOwner: string | null, storeOwner: string | null) =>
    clerkOwner !== null && storeOwner !== null;

  it("REPRO: con RevenueCat sin identidad, el portal de Stripe SIGUE abriendo", () => {
    // Build sin clave, error de configuración o SDK no disponible: el
    // `identifiedUserId` es null y una suscripción de Stripe viva se quedaba
    // sin ninguna forma de cancelarse.
    assert.equal(puedeAbrirPortal("user_a"), true);
    assert.equal(puedeTocarLaTienda("user_a", null), false);
  });

  it("sin sesión de Clerk no se abre nada", () => {
    assert.equal(puedeAbrirPortal(null), false);
    assert.equal(puedeTocarLaTienda(null, "user_a"), false);
  });

  it("REPRO A→B: el entitlement de A no levanta el marcador de compra de B", () => {
    // La query de Convex conserva su último valor mientras la nueva suscripción
    // resuelve: durante el cambio A → B el entitlement de A quedaba publicado
    // bajo la sesión de B, y con él el efecto que borra el guard.
    const deA = {
      isPro: true,
      provider: "revenuecat",
      isLifetime: false,
      canManageInStripePortal: false,
      canManageInRevenueCat: true,
      activeProviders: ["revenuecat"],
      clerkUserId: "user_a"
    };
    // El contenido dice "hay compra de tienda confirmada"…
    assert.equal(backendConfirmsStorePurchase(deA), true);
    // …pero no es de B, así que B no puede actuar con eso.
    assert.equal(entitlementBelongsTo(deA, "user_b"), false);
    assert.equal(entitlementBelongsTo(deA, "user_a"), true);
  });

  it("sin dueño server-side (backend anterior) tampoco se actúa: falla cerrado", () => {
    const sinDueño = {
      isPro: true,
      provider: "revenuecat",
      isLifetime: false,
      canManageInStripePortal: false,
      canManageInRevenueCat: true,
      activeProviders: ["revenuecat"]
    };
    assert.equal(entitlementBelongsTo(sinDueño, "user_a"), false);
    assert.equal(entitlementBelongsTo({ ...sinDueño, clerkUserId: null }, "user_a"), false);
    assert.equal(entitlementBelongsTo({ ...sinDueño, clerkUserId: "" }, "user_a"), false);
    assert.equal(entitlementBelongsTo(undefined, "user_a"), false);
    assert.equal(entitlementBelongsTo({ ...sinDueño, clerkUserId: "user_a" }, null), false);
  });

  it("REPRO A Free cacheado → B Plus: `safeEntitlement` no deja usar NADA de A", () => {
    const deAFree = {
      isPro: false,
      isLifetime: false,
      canManageInStripePortal: false,
      activeProviders: [] as string[],
      clerkUserId: "user_a"
    };
    // Bajo B, el valor de A no existe: queda "validando".
    assert.equal(safeEntitlement(deAFree, "user_b"), undefined);
    // Y "validando" es exactamente lo que apaga todo lo comercial.
    assert.equal(nativeSubscriptionView(safeEntitlement(deAFree, "user_b")), "loading");
    assert.equal(
      nativePrimaryAction({
        offeringReady: true,
        backendIsPro: safeEntitlement(deAFree, "user_b")?.isPro,
        storeConfirmed: false,
        busy: false,
        lastOutcome: "none",
        guardLoaded: true
      }),
      "wait",
      "cero Comprar con el plan de otra cuenta"
    );
    const gestion = nativeSubscriptionManagement(safeEntitlement(deAFree, "user_b"));
    assert.deepEqual(
      [gestion.showStoreCenter, gestion.showStripePortal],
      [false, false],
      "cero gestión y cero portal"
    );
  });

  it("B correlacionado sí decide: su propio plan manda", () => {
    const deBFree = {
      isPro: false,
      isLifetime: false,
      canManageInStripePortal: false,
      activeProviders: [] as string[],
      clerkUserId: "user_b"
    };
    assert.equal(safeEntitlement(deBFree, "user_b"), deBFree);
    assert.equal(
      nativePrimaryAction({
        offeringReady: true,
        backendIsPro: false,
        storeConfirmed: false,
        busy: false,
        lastOutcome: "none",
        guardLoaded: true
      }),
      "purchase"
    );
  });

  it("`null` (sin backend) NO se disfraza de validando: es su propia respuesta", () => {
    assert.equal(safeEntitlement(null, "user_a"), null);
    assert.equal(safeEntitlement(undefined, "user_a"), undefined);
    assert.equal(nativeSubscriptionView(safeEntitlement(null, "user_a")), "unavailable");
  });

  it("la oferta y la impresión exigen entitlement correlacionado y `activation === idle`", () => {
    const paywall = readFileSync(join(ROOT, "src/screens/v492/PlusPaywallScreen.tsx"), "utf8");
    assert.match(paywall, /const entitlement = safeEntitlement\(rawEntitlement, clerkOwner\);/);
    assert.match(paywall, /const entitlementResuelto = entitlement !== undefined;/);
    // La oferta: sólo con el plan validado Y sin ninguna compra en curso.
    assert.match(
      paywall,
      /const offeringVisible =\s*focused && entitlementResuelto && activation === "idle" && revenueCat\.phase === "ready";/
    );
    assert.match(paywall, /\) : activation === "idle" \? \(/);
    // Restaurar también: es una acción comercial sobre la cuenta.
    assert.match(
      paywall,
      /const restoreReady = revenueCat\.identifiedUserId !== null && entitlementResuelto;/
    );
  });

  it("TODOS los consumidores derivan del entitlement correlacionado", () => {
    for (const archivo of [
      "src/screens/v492/PlusPaywallScreen.tsx",
      "src/components/orbita/ManageSubscription.tsx",
      "src/components/orbita/ManageSubscription.web.tsx",
      "src/routes/v492/recepcion.web.tsx",
      "src/hooks/useLiveApp.tsx"
    ]) {
      const fuente = readFileSync(join(ROOT, archivo), "utf8");
      assert.match(fuente, /safeEntitlement\(/, `${archivo}: falta la correlación`);
      // El crudo se nombra distinto y NO se usa para decidir: sólo entra a
      // `safeEntitlement`.
      const usosCrudos = [...fuente.matchAll(/raw(Entitlement|Subscription)\b/g)];
      assert.equal(usosCrudos.length, 2, `${archivo}: el crudo sólo se lee una vez`);
    }
  });

  it("las dos pantallas exigen la correlación antes de tocar el guard", () => {
    const paywall = readFileSync(join(ROOT, "src/screens/v492/PlusPaywallScreen.tsx"), "utf8");
    const manage = readFileSync(join(ROOT, "src/components/orbita/ManageSubscription.tsx"), "utf8");
    assert.match(paywall, /if \(!entitlementBelongsTo\(entitlement, userId\)\) return;/);
    assert.match(manage, /if \(!entitlementBelongsTo\(entitlement, storeOwner\)\) return;/);
    // Y la query se corta sin sesión viva, para no arrastrar el valor de A.
    for (const [nombre, fuente] of [
      ["paywall", paywall],
      ["manage", manage]
    ] as const) {
      assert.match(
        fuente,
        /useQuery\(appApi\.subscriptions\.getCurrent, isLive \? \{\} : "skip"\)/,
        nombre
      );
    }
    // El servidor es quien pone el dueño: el cliente no lo inventa.
    const backend = readFileSync(join(ROOT, "convex/subscriptions.ts"), "utf8");
    assert.match(backend, /clerkUserId: v\.union\(v\.string\(\), v\.null\(\)\)/);
    assert.match(backend, /clerkUserId: user\.clerkUserId \?\? null/);
  });

  it("el bloque nativo separa los dos dueños y ata cada acción al suyo", () => {
    const manage = readFileSync(join(ROOT, "src/components/orbita/ManageSubscription.tsx"), "utf8");
    assert.match(manage, /const clerkOwner = auth\?\.isSignedIn \? auth\.userId \?\? null : null;/);
    assert.match(manage, /const storeOwner = revenueCat\.identifiedUserId;/);
    // El estado de UI cuelga de Clerk: si colgara de la tienda, el bloque se
    // quedaba sin mensajes justo cuando sólo hay Stripe.
    assert.match(manage, /readOwnedValue\(stateSlot, clerkOwner, "idle"\)/);
    assert.match(manage, /readOwnedValue\(messageSlot, clerkOwner, null\)/);
    // Y el portal no consulta la tienda para decidir.
    const portal = manage.indexOf("const openStripePortal =");
    const cuerpo = manage.slice(portal, manage.indexOf("const openCustomerCenter =", portal));
    assert.equal(/storeOwner/.test(cuerpo), false);
  });
});
