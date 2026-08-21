/**
 * QA22-028 — la espera de activación termina, y termina en algo accionable.
 *
 * El defecto que cierra: con la compra ya aceptada por la tienda y el webhook
 * todavía sin llegar a Convex, la pantalla entraba en `activating` y **se quedaba
 * ahí**. A los veinte segundos aparecía un aviso más largo y un único enlace
 * (`COMPROBAR DE NUEVO`), pero la fase no cambiaba nunca: el primario seguía
 * diciendo "ACTIVANDO ÓRBITA PLUS…" deshabilitado y no había ninguna salida
 * nombrada. Una espera sin final es exactamente el escenario en el que alguien
 * vuelve a la tienda y paga dos veces.
 *
 * Lo que se prueba acá, en este orden:
 *
 * 1. **La frontera es un dato, no un reloj.** `nativeActivationPhase` recibe
 *    `elapsedMs` y contesta; el corte es `>=` sobre la MISMA constante que el
 *    timer de la pantalla usa para el plazo y para el valor que publica.
 * 2. **Nada de esto concede acceso.** `backendIsPro === true` gana sobre
 *    cualquier reloj vencido, y sin confirmación de la tienda la fase es `idle`
 *    por más tiempo que pase.
 * 3. **Nunca un segundo cargo.** Con la compra confirmada por la tienda, con el
 *    marcador sin leer o con un resultado ambiguo, `nativePrimaryAction` no
 *    puede devolver `purchase` en ninguna combinación.
 * 4. **Nada de A se ve en B.** El vencimiento viaja con dueño: un plazo armado
 *    para A no puede abrirle a B la tarjeta de reparación.
 * 5. **Un recheck no desmiente un cargo.** `getCustomerInfo` puede contestar del
 *    caché del SDK: `recheck_empty` conserva `purchaseReceived` y el bloqueo, y
 *    sólo la cancelación demostrada y el Restaurar vacío autoritativo limpian.
 * 6. **La pantalla está cableada a esas decisiones**, y no a una copia suya.
 *
 * Las comprobaciones estructurales corren sobre el CÓDIGO, no sobre lo que los
 * comentarios cuentan de él: este archivo documenta largo, y una regla que se
 * cumple sólo en un comentario no se cumple.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  applyStoreAnswer,
  emptyPurchaseSession,
  NATIVE_ACTIVATION_RECOVERY_MS,
  nativeActivationPhase,
  nativePrimaryAction,
  ownedValue,
  publishOwnedValue,
  readOwnedValue,
  storeAnswerClearsPurchaseGuard,
  type NativePrimaryActionInput,
  type NativePurchaseOutcome,
  type NativeStoreAnswer
} from "../src/domain/nativeCommerce";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Una regla se comprueba sobre el código: los comentarios no ejecutan nada. */
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const veces = (source: string, re: RegExp) => (source.match(re) ?? []).length;

/** El cuerpo de una función: de su firma hasta el marcador que la cierra. */
function cuerpo(source: string, desde: string, hasta: string): string {
  const inicio = source.indexOf(desde);
  const fin = source.indexOf(hasta, inicio + desde.length);
  if (inicio < 0) throw new Error(`no encontré \`${desde}\``);
  if (fin <= inicio) throw new Error(`no encontré \`${hasta}\` después de \`${desde}\``);
  return source.slice(inicio, fin);
}

const PAYWALL_REL = "src/screens/v492/PlusPaywallScreen.tsx";
const DOMINIO_REL = "src/domain/nativeCommerce.ts";

const PAYWALL = sinComentarios(leer(PAYWALL_REL));
const DOMINIO = sinComentarios(leer(DOMINIO_REL));

const A = "user_2aaaAAA";
const B = "user_2bbbBBB";

const OUTCOMES: readonly NativePurchaseOutcome[] = ["none", "cancelled", "ambiguous"];
const RESPUESTAS: readonly NativeStoreAnswer[] = [
  "purchase_started",
  "purchase_cancelled",
  "purchase_ambiguous",
  "store_confirmed",
  "restore_empty",
  "recheck_empty"
];

/** Paywall listo para comprar: nada en curso, marcador leído y plan resuelto. */
const LIMPIO: NativePrimaryActionInput = {
  offeringReady: true,
  backendIsPro: false,
  storeConfirmed: false,
  busy: false,
  lastOutcome: "none",
  guardLoaded: true
};

// ---------------------------------------------------------------------------
// La frontera de los veinte segundos: un dato, no un reloj
// ---------------------------------------------------------------------------

test("el plazo es UNO solo, y vale veinte segundos", () => {
  assert.equal(NATIVE_ACTIVATION_RECOVERY_MS, 20_000);
  assert.match(DOMINIO, /export const NATIVE_ACTIVATION_RECOVERY_MS = 20_?000;/);

  // Y la decisión no mide nada: el tiempo entra como argumento. Un reloj adentro
  // volvería la frontera imposible de probar sin timers falsos.
  const fase = cuerpo(
    DOMINIO,
    "export function nativeActivationPhase(",
    "export type NativeSubscriptionManagement ="
  );
  assert.equal(
    /Date\.now\(\)|setTimeout|setInterval|performance\.now/.test(fase),
    false,
    "el tiempo transcurrido entra como dato, no se lee de un reloj interno"
  );
  assert.match(fase, /elapsed\s*>=\s*NATIVE_ACTIVATION_RECOVERY_MS/);
});

test("la espera cambia de fase exactamente en el umbral, y no antes", () => {
  const esperando = (elapsedMs: number) =>
    nativeActivationPhase({ backendIsPro: false, storeConfirmed: true, elapsedMs });

  // Recién arrancada y a un milisegundo del corte: sigue siendo la espera joven,
  // la que no ofrece nada porque todavía no hay nada que reparar.
  assert.equal(esperando(0), "activating");
  assert.equal(esperando(1), "activating");
  assert.equal(esperando(NATIVE_ACTIVATION_RECOVERY_MS - 1), "activating");
  assert.equal(esperando(19_999), "activating");

  // El corte es `>=`: veinte mil clavados ya es recuperable.
  assert.equal(esperando(NATIVE_ACTIVATION_RECOVERY_MS), "recoverable");
  assert.equal(esperando(20_000), "recoverable");

  // Y de ahí no vuelve: más tiempo no es menos reparable.
  assert.equal(esperando(NATIVE_ACTIVATION_RECOVERY_MS + 1), "recoverable");
  assert.equal(esperando(10 * NATIVE_ACTIVATION_RECOVERY_MS), "recoverable");
});

test("un tiempo que no se sabe no adelanta la reparación", () => {
  // Sin dato, la espera recién empieza. `NaN` y los negativos caen del mismo
  // lado conservador: adelantar la reparación no es más seguro que atrasarla,
  // sólo cambia qué se le ofrece a alguien cuyo cargo ya existe.
  assert.equal(
    nativeActivationPhase({ backendIsPro: false, storeConfirmed: true }),
    "activating",
    "sin `elapsedMs` la espera recién empieza"
  );
  for (const elapsedMs of [undefined, Number.NaN, -1, -NATIVE_ACTIVATION_RECOVERY_MS, -1e12]) {
    assert.equal(
      nativeActivationPhase({ backendIsPro: false, storeConfirmed: true, elapsedMs }),
      "activating",
      `elapsedMs=${String(elapsedMs)}`
    );
  }
});

test("sólo Convex confirma: el backend gana sobre cualquier reloj vencido", () => {
  // El webhook llega al segundo veinticinco: la fase pasa a `confirmed` sola.
  for (const elapsedMs of [undefined, 0, 19_999, 20_000, 25_000, 1e9]) {
    assert.equal(
      nativeActivationPhase({ backendIsPro: true, storeConfirmed: true, elapsedMs }),
      "confirmed",
      `elapsedMs=${String(elapsedMs)}`
    );
  }
  // Y sin que la tienda haya confirmado nada no hay espera que mostrar, por más
  // tiempo que haya pasado: la tarjeta de reparación no se le dibuja a alguien
  // que nunca compró.
  for (const backendIsPro of [false, undefined]) {
    for (const elapsedMs of [undefined, 0, 20_000, 1e9]) {
      assert.equal(
        nativeActivationPhase({ backendIsPro, storeConfirmed: false, elapsedMs }),
        "idle",
        `backendIsPro=${String(backendIsPro)} elapsedMs=${String(elapsedMs)}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Nunca un segundo cargo
// ---------------------------------------------------------------------------

test("con la compra ya aceptada por la tienda el primario NUNCA ofrece comprar", () => {
  // Control positivo: sin nada de todo eso, la pantalla sí ofrece comprar. Sin
  // esto, el barrido de abajo pasaría aunque la función devolviera "wait"
  // siempre.
  assert.equal(nativePrimaryAction(LIMPIO), "purchase");

  for (const backendIsPro of [false, undefined]) {
    for (const busy of [false, true]) {
      for (const guardLoaded of [false, true]) {
        for (const lastOutcome of OUTCOMES) {
          for (const offeringReady of [false, true]) {
            const contexto = `backendIsPro=${String(backendIsPro)} busy=${busy} guardLoaded=${guardLoaded} lastOutcome=${lastOutcome} offeringReady=${offeringReady}`;
            const decision = nativePrimaryAction({
              ...LIMPIO,
              backendIsPro,
              storeConfirmed: true,
              busy,
              guardLoaded,
              lastOutcome,
              offeringReady
            });
            assert.notEqual(decision, "purchase", contexto);
            // Y en TODA la espera —joven o vencida— la salida es la misma: el
            // primario no invita a nada y las acciones viven en la tarjeta.
            assert.equal(decision, "wait", contexto);
          }
        }
      }
    }
  }

  // La fase recuperable se DERIVA de `storeConfirmed`, así que llegar ahí ya
  // implica que la salida no es comprar.
  for (const elapsedMs of [0, NATIVE_ACTIVATION_RECOVERY_MS]) {
    const fase = nativeActivationPhase({ backendIsPro: false, storeConfirmed: true, elapsedMs });
    assert.ok(fase === "activating" || fase === "recoverable", fase);
    assert.notEqual(
      nativePrimaryAction({ ...LIMPIO, storeConfirmed: true }),
      "purchase",
      fase
    );
  }
});

test("sin el marcador leído, o con un resultado ambiguo, tampoco se ofrece comprar", () => {
  // Mientras el marcador persistido no se leyó había una VENTANA: la pantalla
  // montaba, ofrecía comprar y alguien podía tocar antes de que el disco
  // contestara.
  for (const lastOutcome of OUTCOMES) {
    assert.equal(
      nativePrimaryAction({ ...LIMPIO, guardLoaded: false, lastOutcome }),
      "wait",
      lastOutcome
    );
  }

  // Después de un resultado ambiguo la única acción es restaurar: repetir la
  // compra es exactamente el camino al cargo duplicado.
  assert.equal(nativePrimaryAction({ ...LIMPIO, lastOutcome: "ambiguous" }), "restore");
  // Una cancelación demostrada no bloquea nada: no hubo cargo.
  assert.equal(nativePrimaryAction({ ...LIMPIO, lastOutcome: "cancelled" }), "purchase");
  // Y mientras el plan no resolvió no se compra a ciegas.
  assert.equal(nativePrimaryAction({ ...LIMPIO, backendIsPro: undefined }), "wait");
  // Con acceso confirmado no hay nada que comprar, pase lo que pase alrededor.
  assert.equal(
    nativePrimaryAction({
      ...LIMPIO,
      backendIsPro: true,
      storeConfirmed: true,
      busy: true,
      guardLoaded: false,
      lastOutcome: "ambiguous"
    }),
    "leave"
  );
});

// ---------------------------------------------------------------------------
// Nada de A se ve en B
// ---------------------------------------------------------------------------

test("un plazo armado para A no puede abrirle a B la tarjeta de reparación", () => {
  // A entra en la espera: el efecto publica el arranque con su dueño adentro.
  let slot = publishOwnedValue(ownedValue(null, 0), A, A, 0);
  assert.deepEqual(slot, { owner: A, value: 0 });

  // Clerk pasa a B antes de que el plazo venza, y B estrena su propia espera.
  slot = publishOwnedValue(slot, B, B, 0);
  assert.deepEqual(slot, { owner: B, value: 0 });

  // Ahora llega el vencimiento del timer de A. El slot es UNO solo: sin la
  // guarda de publicación, esto reemplazaba físicamente lo de B y le abría una
  // tarjeta de reparación que no le corresponde.
  slot = publishOwnedValue(slot, A, B, NATIVE_ACTIVATION_RECOVERY_MS);
  assert.deepEqual(
    slot,
    { owner: B, value: 0 },
    "una publicación fuera de turno devuelve el slot anterior sin tocarlo"
  );
  assert.equal(
    nativeActivationPhase({
      backendIsPro: false,
      storeConfirmed: true,
      elapsedMs: readOwnedValue(slot, B, 0)
    }),
    "activating",
    "B sigue en su propia espera joven"
  );

  // La lectura corta lo mismo por el otro lado: aunque el slot quedara con el
  // vencimiento de A, B no lo lee y cae al arranque.
  const vencidoDeA = ownedValue(A, NATIVE_ACTIVATION_RECOVERY_MS);
  assert.equal(readOwnedValue(vencidoDeA, B, 0), 0);
  assert.equal(readOwnedValue(vencidoDeA, null, 0), 0, "sin dueño vigente no se lee nada");
  assert.equal(
    nativeActivationPhase({
      backendIsPro: false,
      storeConfirmed: true,
      elapsedMs: readOwnedValue(vencidoDeA, B, 0)
    }),
    "activating"
  );

  // Y A sí ve su propio vencimiento: la guarda protege a B sin dejar a A sin
  // salidas.
  assert.equal(readOwnedValue(vencidoDeA, A, 0), NATIVE_ACTIVATION_RECOVERY_MS);
  assert.equal(
    nativeActivationPhase({
      backendIsPro: false,
      storeConfirmed: true,
      elapsedMs: readOwnedValue(vencidoDeA, A, 0)
    }),
    "recoverable"
  );
});

// ---------------------------------------------------------------------------
// Un recheck no desmiente un cargo
// ---------------------------------------------------------------------------

test("`recheck_empty` conserva la compra confirmada y el bloqueo", () => {
  // La secuencia real: marcador armado antes de abrir la hoja, tienda que cobra.
  const comprada = applyStoreAnswer(
    applyStoreAnswer(emptyPurchaseSession(A), A, "purchase_started"),
    A,
    "store_confirmed"
  );
  assert.deepEqual(comprada, {
    userId: A,
    guard: "blocked",
    lastOutcome: "none",
    purchaseReceived: true
  });

  // Veinte segundos después, REINTENTAR ACTIVACIÓN: `getCustomerInfo` contesta
  // del caché del SDK y dice que no hay nada. Eso NO prueba que no haya compra.
  const tras = applyStoreAnswer(comprada, A, "recheck_empty");
  assert.equal(
    tras.purchaseReceived,
    true,
    "un recheck vacío no puede borrar un cargo que la tienda ya confirmó"
  );
  assert.equal(tras.guard, "blocked", "el marcador persistido sigue puesto");
  assert.equal(tras.lastOutcome, "ambiguous", "la salida sigue siendo Restaurar");
  assert.equal(storeAnswerClearsPurchaseGuard("recheck_empty"), false);

  // Con `purchaseReceived` intacto la pantalla no se cae a la oferta: sigue en
  // la tarjeta de reparación, y el primario sigue sin ofrecer comprar.
  assert.equal(
    nativeActivationPhase({
      backendIsPro: false,
      storeConfirmed: tras.purchaseReceived,
      elapsedMs: NATIVE_ACTIVATION_RECOVERY_MS
    }),
    "recoverable"
  );
  assert.notEqual(
    nativePrimaryAction({
      ...LIMPIO,
      storeConfirmed: tras.purchaseReceived,
      lastOutcome: tras.lastOutcome,
      // El guard ya quedó fijado en "blocked" por la aserción de arriba: está cargado.
      guardLoaded: true
    }),
    "purchase"
  );

  // El Restaurar SÍ fuerza un refresh del recibo contra la tienda: "no hay
  // compra" ahí es definitivo y libera todo, para no dejar sin comprar a quien
  // nunca fue cobrado.
  const vacio = applyStoreAnswer(tras, A, "restore_empty");
  assert.deepEqual(vacio, {
    userId: A,
    guard: "clear",
    lastOutcome: "none",
    purchaseReceived: false
  });
  assert.equal(
    nativeActivationPhase({
      backendIsPro: false,
      storeConfirmed: vacio.purchaseReceived,
      elapsedMs: 10 * NATIVE_ACTIVATION_RECOVERY_MS
    }),
    "idle"
  );
  assert.equal(
    nativePrimaryAction({ ...LIMPIO, guardLoaded: vacio.guard !== "loading" }),
    "purchase"
  );

  // Una respuesta que vuelve cuando la cuenta ya cambió no toca nada.
  for (const ajeno of [B, null]) {
    assert.equal(
      applyStoreAnswer(tras, ajeno, "restore_empty"),
      tras,
      `una respuesta de otro dueño (${String(ajeno)}) no puede limpiar esta sesión`
    );
  }
});

test("sólo una cancelación demostrada o un Restaurar vacío levantan el marcador", () => {
  const LIMPIAN = new Set<NativeStoreAnswer>(["purchase_cancelled", "restore_empty"]);

  for (const answer of RESPUESTAS) {
    assert.equal(storeAnswerClearsPurchaseGuard(answer), LIMPIAN.has(answer), answer);
  }

  // Sobre una sesión con el cargo hecho y el marcador puesto: sólo esas dos
  // respuestas lo levantan, y las dos son afirmaciones DEMOSTRADAS de la tienda.
  const bloqueada = applyStoreAnswer(
    applyStoreAnswer(emptyPurchaseSession(A), A, "purchase_started"),
    A,
    "store_confirmed"
  );
  for (const answer of RESPUESTAS) {
    const next = applyStoreAnswer(bloqueada, A, answer);
    if (LIMPIAN.has(answer)) {
      assert.equal(next.guard, "clear", answer);
      assert.equal(next.purchaseReceived, false, answer);
    } else {
      assert.notEqual(next.guard, "clear", answer);
      assert.equal(
        next.purchaseReceived,
        true,
        `${answer}: el cargo confirmado por la tienda sigue en pie`
      );
    }
  }

  // `store_confirmed` jamás limpia: el cargo existe y falta que Convex lo
  // refleje. Ésa es toda la diferencia entre esperar y volver a cobrar.
  assert.equal(storeAnswerClearsPurchaseGuard("store_confirmed"), false);
  assert.equal(applyStoreAnswer(bloqueada, A, "store_confirmed").guard, "blocked");

  // Y la cancelación deja el arrastre nombrado como lo que fue.
  const cancelada = applyStoreAnswer(bloqueada, A, "purchase_cancelled");
  assert.deepEqual(cancelada, {
    userId: A,
    guard: "clear",
    lastOutcome: "cancelled",
    purchaseReceived: false
  });
});

// ---------------------------------------------------------------------------
// La pantalla cableada a esas decisiones, no a una copia suya
// ---------------------------------------------------------------------------

test("el paywall importa el plazo y la fase del dominio, y no los copia", () => {
  const importado = /import \{([^}]*)\} from "@\/domain\/nativeCommerce";/.exec(PAYWALL);
  if (!importado) throw new Error("el paywall no importa el dominio de comercio nativo");
  assert.match(importado[1], /\bNATIVE_ACTIVATION_RECOVERY_MS\b/);
  assert.match(importado[1], /\bnativeActivationPhase\b/);

  // Ni el plazo escrito a mano ni el nombre viejo de la constante: con una copia
  // en cada lado, cambiar uno dejaba una franja en la que la fase decía una cosa
  // y el reloj otra.
  assert.equal(/\b20_?000\b/.test(PAYWALL), false, "el plazo se importa, no se copia");
  for (const rel of [PAYWALL_REL, DOMINIO_REL]) {
    const crudo = leer(rel);
    assert.equal(
      /BACKEND_ACTIVATION_WAIT_MS/.test(crudo),
      false,
      `${rel}: el nombre viejo del plazo quedó vivo`
    );
    assert.equal(
      /COMPROBAR DE NUEVO/.test(crudo),
      false,
      `${rel}: el enlace de la espera sin final quedó vivo`
    );
  }

  // La fase se calcula con el tiempo LEÍDO POR DUEÑO, no con un contador suelto.
  assert.match(
    PAYWALL,
    /const activationWaitMs = readOwnedValue\(activationWaitSlot, identifiedUserId, 0\);/
  );
  assert.match(
    PAYWALL,
    /nativeActivationPhase\(\{\s*backendIsPro,\s*storeConfirmed,\s*elapsedMs: activationWaitMs\s*\}\)/
  );
});

test("el único reloj de la pantalla usa la constante para el plazo Y para el valor", () => {
  assert.equal(veces(PAYWALL, /setTimeout\(/g), 1, "un segundo timer es una segunda verdad");

  const timer = PAYWALL.indexOf("setTimeout(");
  const inicio = PAYWALL.lastIndexOf("useEffect(", timer);
  const fin = PAYWALL.indexOf("]);", timer);
  if (inicio < 0 || fin < 0) throw new Error("no pude aislar el efecto del reloj");
  const reloj = PAYWALL.slice(inicio, fin + 3);

  // El mismo número para las dos cosas que tienen que coincidir: cuánto se
  // espera y qué se publica cuando esa espera vence.
  assert.match(
    reloj,
    /setTimeout\(\s*\(\)\s*=>\s*publicar\(\s*NATIVE_ACTIVATION_RECOVERY_MS\s*\),\s*NATIVE_ACTIVATION_RECOVERY_MS\s*\)/
  );

  // Arranca en cero, no arma nada si no hay espera y desarma al salir.
  assert.match(reloj, /publicar\(0\);/);
  assert.ok(
    reloj.indexOf("publicar(0);") < reloj.indexOf("setTimeout("),
    "el arranque en cero va antes de armar el plazo"
  );
  assert.match(reloj, /if \(!waitingForBackend\) return;/);
  assert.match(reloj, /return \(\) => clearTimeout\(timeout\);/);

  // Y el valor se publica con el dueño capturado: un plazo de A no pinta a B.
  assert.match(reloj, /publishOwnedValue\(\s*previous,\s*owner,\s*ownerRef\.current,\s*ms\s*\)/);

  // La ENTRADA del reloj es la espera, no la fase que él mismo produce. Si
  // dependiera de `activation`, publicar el vencimiento cambiaría la fase, el
  // efecto volvería a correr, reiniciaría su propio plazo y la pantalla
  // oscilaría entre "activando" y la reparación para siempre.
  assert.match(PAYWALL, /const waitingForBackend = storeConfirmed && backendIsPro !== true;/);
  assert.match(reloj, /\},\s*\[waitingForBackend,\s*identifiedUserId\]\);\s*$/);
  assert.equal(
    /\bactivation\b/.test(reloj),
    false,
    "el timer no puede depender de la fase que él mismo produce"
  );
});

test("el estado recuperable ofrece exactamente dos salidas, y las dos reparan", () => {
  const desde = /activation\s*===\s*"recoverable"/.exec(PAYWALL);
  if (!desde) throw new Error("el paywall no renderiza la fase `recoverable`");
  const resto = PAYWALL.slice(desde.index);
  const hasta = /\{notice\s*\?/.exec(resto);
  if (!hasta) throw new Error("no encontré el cierre de la tarjeta de reparación");
  const tarjeta = resto.slice(0, hasta.index);

  // La afirmación no cambia —la tienda cobró, Convex todavía no lo refleja— y el
  // aviso dice en voz alta lo que evita el segundo cargo.
  assert.match(tarjeta, /Tu compra está confirmada/);
  assert.match(tarjeta, /No vuelvas a comprar/);
  assert.match(tarjeta, /accessibilityRole="alert"/);

  const botones = tarjeta.split(/<Pressable\b/).slice(1);
  assert.equal(botones.length, 2, "dos salidas, ni una más ni una menos");

  const reintentar = botones.find((boton) => boton.includes("REINTENTAR ACTIVACIÓN"));
  const restaurar = botones.find((boton) => boton.includes("RESTAURAR COMPRA"));
  if (!reintentar || !restaurar) throw new Error("faltan las dos salidas con su literal exacto");

  // Reintentar: el circuito de activación, deshabilitado mientras algo corre y
  // ANUNCIADO como deshabilitado.
  assert.match(reintentar, /onPress=\{\s*\(\)\s*=>\s*void retryActivation\(\)\s*\}/);
  assert.match(reintentar, /disabled=\{\s*busy\s*\}/);
  assert.match(reintentar, /accessibilityState=\{\{\s*disabled:\s*busy\s*\}\}/);
  assert.match(reintentar, /accessibilityRole="button"/);

  // Restaurar: el MISMO `restore()` de siempre —mismo candado por dueño, mismo
  // marcador armado antes de tocar la tienda—, y encima exige la identidad de la
  // tienda lista.
  assert.match(restaurar, /onPress=\{\s*\(\)\s*=>\s*void restore\(\)\s*\}/);
  assert.match(restaurar, /disabled=\{\s*busy\s*\|\|\s*!restoreReady\s*\}/);
  assert.match(restaurar, /accessibilityState=\{\{\s*disabled:\s*busy\s*\|\|\s*!restoreReady\s*\}\}/);
  assert.match(restaurar, /accessibilityRole="button"/);

  // Ninguna de las dos vuelve a la tienda a comprar.
  assert.equal(/purchase\(/.test(tarjeta), false, "reparar no puede ser volver a cobrar");

  // Los literales viven en un solo lugar: no hay un tercer nombre del mismo
  // circuito escondido en otra rama.
  assert.equal(veces(PAYWALL, /REINTENTAR ACTIVACIÓN/g), 1);
  assert.equal(veces(PAYWALL, /RESTAURAR COMPRA/g), 1);
});

test("reintentar empieza por el backend y sigue por la tienda, en ese orden", () => {
  const retry = cuerpo(PAYWALL, "const retryActivation =", "const openCustomerCenter =");

  const backend = retry.indexOf("askBackendToReconcile()");
  const tienda = retry.indexOf("revenueCat.refreshCustomerInfo()");
  assert.ok(backend > 0, "el reintento tiene que pedir la reparación durable");
  assert.ok(tienda > 0, "y después preguntarle al SDK");
  assert.ok(
    backend < tienda,
    "si el webhook se perdió, la lectura autoritativa lo repara sin depender del caché del SDK"
  );
  assert.match(retry, /await askBackendToReconcile\(\);/);

  // Una respuesta vacía es `recheck_empty` y NO levanta el marcador.
  assert.match(retry, /answerStore\(userId, "recheck_empty"\)/);
  assert.equal(
    /answerStore\(userId, "restore_empty"\)/.test(retry),
    false,
    "el recheck no puede hacerse pasar por un Restaurar autoritativo"
  );

  // Mismo candado por dueño que el resto de las acciones, y nunca compra.
  assert.match(retry, /runExclusive\(gate,/);
  assert.match(retry, /setAction\(userId, "checking"\)/);
  assert.equal(/revenueCat\.purchase\(/.test(retry), false);

  // Y la mutation sigue siendo la única superficie de reparación, sin argumentos.
  assert.match(PAYWALL, /useMutation\(appApi\.subscriptions\.requestStoreReconcile\)/);
  assert.match(PAYWALL, /return await reconcile\(\{\}\);/);
});

test("la oferta se dibuja SÓLO en `idle`, y el primario vencido dice lo único cierto", () => {
  // Con la compra ya aceptada por la tienda no se dibuja la oferta ni se cuenta
  // una impresión: sería inflar la métrica con gente que ya pagó y, peor,
  // ofrecerle comprar de nuevo.
  assert.match(
    PAYWALL,
    /const offeringVisible =\s*focused\s*&&\s*entitlementResuelto\s*&&\s*activation === "idle"\s*&&\s*revenueCat\.phase === "ready";/
  );
  assert.match(PAYWALL, /activation === "idle" \?\s*\(\s*<OfferingSection/);
  assert.equal(veces(PAYWALL, /<OfferingSection/g), 1, "una sola rama dibuja la oferta");

  const label = cuerpo(PAYWALL, "function primaryLabel(", "const styles = StyleSheet.create(");
  // "ACTIVANDO ÓRBITA PLUS…" prometía un final inminente que ya se incumplió.
  assert.match(label, /if \(activation === "recoverable"\) return "ACTIVACIÓN PENDIENTE";/);
  assert.match(label, /if \(activation === "activating"\) return "ACTIVANDO ÓRBITA PLUS…";/);
  // Y el rótulo no invita a comprar: con `primary === "wait"` el CTA va apagado.
  assert.equal(
    /(recoverable|activating)"\) return "[^"]*(COMPRAR|DESBLOQUEAR|EMPEZAR)/.test(label),
    false,
    "la espera no puede rotularse como una invitación a comprar"
  );
  assert.match(
    PAYWALL,
    /disabled=\{primary === "wait" \|\| \(primary === "restore" && !restoreReady\)\}/
  );
});
