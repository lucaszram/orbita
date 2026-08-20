/**
 * La recuperación de la Carta natal: qué operación dispara el botón, una sola
 * vez, y qué pasa después.
 *
 * ## El defecto que cierran estas pruebas
 *
 * `natalChartState` declaraba bien `recovery: "reintentar"` para una carta
 * publicada a la que le falta geometría —los ejes verificados, las doce
 * cúspides—. Pero las dos pantallas cableaban ese botón a `useLayers().refresh`,
 * que ejecuta `layers.refreshForDate` y **nada más**. La geometría sale de la
 * carta persistida en `natalCharts`, y la única operación que la escribe es el
 * cálculo natal: tocar "COMPROBAR DE NUEVO" repetía el cálculo de capas para
 * siempre sin generar nunca lo que faltaba.
 *
 * Y quedaban tres bordes que esta pasada cierra:
 *
 * 1. **El candado terminaba antes que el trabajo.** El recálculo del día se
 *    disparaba sin esperarlo, así que la fase pasaba a `quieto` y el candado se
 *    soltaba mientras el refresco todavía ni había salido. Un segundo toque
 *    volvía a llamar la operación.
 * 2. **Éxito no es "la llamada volvió".** Si la operación respondía y la carta
 *    seguía sin la geometría, el controlador lo festejaba igual.
 * 3. **El fallo era global.** Un store de módulo único pegaba el error de una
 *    cuenta —o de una carta— a la siguiente.
 *
 * Lo que se prueba acá es la OPERACIÓN, no la presencia de un botón: se corre el
 * controlador real contando llamadas, con dos entradas en el mismo tick, con el
 * refresco mantenido en vuelo, con fallo y reintento, y con la salida que no se
 * resuelve calculando. El cableado de las dos pantallas se prueba por el grafo
 * de módulos —el mismo que recorre Metro—, no buscando el nombre de un callback.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  createNatalChartRecoveryRegistry,
  createNatalChartRecoveryStore,
  natalRecoveryScopeKey
} from "../src/domain/natalChartRecovery";
import { natalChartState } from "../src/domain/natalChartState";
import { createRefreshQueue } from "../src/domain/refreshQueue";
import type { NatalChartBase } from "../src/services/layersApi";
import { ROOT, reachableFrom } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const HUB = "src/screens/v492/CartaHubScreen.tsx";
const COMPLETA = "src/screens/v492/CartaCompletaV492Screen.tsx";
const HOOK = "src/hooks/useNatalChartRecovery.ts";
const CONTROLADOR = "src/domain/natalChartRecovery.ts";

/** Cede el turno al bucle de eventos, como haría cualquier `await` real. */
const cede = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Todas las posiciones de un literal dentro de una fuente. */
function indicesDe(source: string, needle: string): number[] {
  const salida: number[] = [];
  let desde = source.indexOf(needle);
  while (desde !== -1) {
    salida.push(desde);
    desde = source.indexOf(needle, desde + needle.length);
  }
  return salida;
}

/**
 * El controlador real con las dos dependencias instrumentadas. Devuelve el
 * store y los contadores: lo que se mide es cuántas veces se llamó a cada cosa
 * y en qué orden, que es exactamente lo que estaba mal.
 *
 * El recálculo del día se puede MANTENER en vuelo (`refrescoDiferido`), porque
 * el defecto que hay que observar es justamente el estado mientras esa segunda
 * mitad todavía corre.
 */
function controladorDePrueba(
  options: {
    falla?: boolean;
    /** La operación responde, pero la carta sigue sin la geometría. */
    noMejora?: boolean;
    /** El cálculo natal queda pendiente hasta que la prueba lo cierre. */
    calculoDiferido?: boolean;
    /** El refresco queda pendiente hasta que la prueba lo cierre. */
    refrescoDiferido?: boolean;
    store?: ReturnType<typeof createNatalChartRecoveryStore>;
  } = {}
) {
  const store = options.store ?? createNatalChartRecoveryStore();
  const traza: string[] = [];
  const refrescos: Array<{ resolve: () => void; reject: (error: unknown) => void }> = [];
  const calculosDiferidos: Array<{ resolve: (mejora: boolean) => void; reject: (error: unknown) => void }> = [];
  let calculos = 0;
  let recalculos = 0;
  let falla = options.falla === true;
  let mejora = options.noMejora !== true;
  // Los DOS predicados, separados igual que en el hook. `alcance` es montado +
  // misma cuenta + misma carta; `salidaReintentar` es que el estado siga
  // ofreciendo el reintento. En el hook son refs vivas; acá, dos banderas que la
  // prueba mueve mientras algo está en vuelo.
  let alcance = true;
  let salidaReintentar = true;
  const deps = {
    recovery: "reintentar" as const,
    mismoAlcance: () => alcance,
    falloVigente: () => alcance && salidaReintentar,
    calcular: async () => {
      calculos += 1;
      traza.push("calcular");
      if (options.calculoDiferido) {
        return await new Promise<boolean>((resolve, reject) => {
          calculosDiferidos.push({ resolve, reject });
        });
      }
      await cede();
      if (falla) throw new Error("proveedor caído");
      return mejora;
    },
    recalcularCapas: () => {
      recalculos += 1;
      traza.push("recalcularCapas");
      if (!options.refrescoDiferido) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        refrescos.push({ resolve, reject });
      });
    }
  };
  return {
    store,
    deps,
    traza,
    refrescos,
    calculosDiferidos,
    fallarA: (valor: boolean) => {
      falla = valor;
    },
    mejorarA: (valor: boolean) => {
      mejora = valor;
    },
    /** El trabajo deja de ser el de esta pantalla: cambió la cuenta o la carta. */
    cambiarDeAlcance: () => {
      alcance = false;
    },
    /**
     * La MISMA carta deja de ofrecer reintento: se completó por otra vía, o su
     * único límite pasó a ser la hora. El alcance no cambió.
     */
    salidaDejaDeSerReintentar: () => {
      salidaReintentar = false;
    },
    get calculos() {
      return calculos;
    },
    get recalculos() {
      return recalculos;
    }
  };
}

// ---------------------------------------------------------------------------
// 1 · dos entradas del mismo tick, una sola action
// ---------------------------------------------------------------------------

test("el retry compartido ejecuta la operación de cálculo UNA sola vez ante dos entradas", async () => {
  const c = controladorDePrueba();

  // Las dos salen antes de que la primera llegue a su primer await: es el doble
  // toque del mismo render, y también el hub y la carta completa pidiéndolo a la
  // vez desde la misma pila de navegación.
  const [a, b] = await Promise.all([c.store.pedir(c.deps), c.store.pedir(c.deps)]);

  assert.equal(c.calculos, 1, "la segunda entrada no puede llamar a la action");
  assert.equal(a, true, "el primero es el que corrió");
  assert.equal(b, false, "el segundo no corre");
  assert.equal(c.store.ocupado(), false, "el candado se suelta al terminar");

  // Y con el candado libre, un pedido nuevo SÍ corre: un candado que no se
  // suelta deja el botón muerto hasta remontar la pantalla.
  assert.equal(await c.store.pedir(c.deps), true);
  assert.equal(c.calculos, 2);
});

test("el candado es sincrónico: la fase cambia antes del primer await", async () => {
  const c = controladorDePrueba();
  const fases: string[] = [];
  c.store.subscribe(() => fases.push(c.store.fase()));

  const enVuelo = c.store.pedir(c.deps);
  // Todavía no cedimos el turno y el estado ya es el correcto: un `useState` se
  // habría aplicado en el render siguiente y los dos toques habrían pasado.
  assert.equal(c.store.fase(), "calculando");
  assert.equal(c.store.ocupado(), true);
  assert.deepEqual(fases, ["calculando"]);

  await enVuelo;
  assert.equal(c.store.fase(), "quieto");
});

// ---------------------------------------------------------------------------
// 2 · al resolver, encadena el recálculo y las dos pantallas lo ven
// ---------------------------------------------------------------------------

test("al resolver, el cálculo natal encadena el recálculo del día, en ese orden", async () => {
  const c = controladorDePrueba();
  await c.store.pedir(c.deps);

  assert.equal(c.calculos, 1);
  assert.equal(c.recalculos, 1, "el sobre del día se calculó sin esta geometría: hay que rearmarlo");
  // El orden importa: `layers.persistRefresh` rechaza con
  // LAYER_INPUT_CHANGED_DURING_REFRESH un refresco que salió antes de que la
  // carta cambiara.
  assert.deepEqual(c.traza, ["calcular", "recalcularCapas"]);
  assert.equal(c.store.fase(), "quieto");
});

test("las dos pantallas comparten el store: las dos ven el mismo resultado", async () => {
  const c = controladorDePrueba();
  // Dos suscriptores: el hub y la carta completa, montados a la vez en la pila.
  const hub: string[] = [];
  const completa: string[] = [];
  c.store.subscribe(() => hub.push(c.store.fase()));
  c.store.subscribe(() => completa.push(c.store.fase()));

  // La carta completa toca el botón; el hub, que está debajo, no toca nada.
  await c.store.pedir(c.deps);

  assert.deepEqual(hub, ["calculando", "quieto"]);
  assert.deepEqual(completa, hub, "las dos pantallas reciben exactamente lo mismo");
  assert.equal(c.calculos, 1);
  assert.equal(c.recalculos, 1);
});

// ---------------------------------------------------------------------------
// 3 · el fallo se dice, no borra nada, y el reintento vuelve a ejecutar
// ---------------------------------------------------------------------------

test("al fallar, queda marcado el error y un reintento vuelve a ejecutar la action", async () => {
  const c = controladorDePrueba({ falla: true });
  const chart = cartaParcial();

  await c.store.pedir(c.deps);
  assert.equal(c.calculos, 1);
  assert.equal(c.store.fase(), "fallo");
  assert.equal(c.store.ocupado(), false, "un error no puede dejar el botón muerto");
  // El día NO se recalcula: no hay carta nueva con la que rearmarlo.
  assert.equal(c.recalculos, 0);

  // Y lo que ya estaba publicado sigue publicado: el fallo del intento no toca
  // el read-model, así que la carta parcial se sigue mostrando con su salida.
  const estado = natalChartState({ chart, refreshing: false, refreshFailed: true });
  assert.deepEqual(
    [estado.phase, estado.recovery, estado.canRetry],
    ["parcial", "reintentar", true],
    "la carta parcial sigue visible y sigue ofreciendo el reintento"
  );

  // El reintento corre de verdad, y cuando el proveedor responde, encadena.
  c.fallarA(false);
  assert.equal(await c.store.pedir(c.deps), true);
  assert.equal(c.calculos, 2);
  assert.equal(c.recalculos, 1);
  assert.equal(c.store.fase(), "quieto");
});

// ---------------------------------------------------------------------------
// 4 · `completar-hora` no ejecuta la action
// ---------------------------------------------------------------------------

test("completar-hora no llama a la action: esa salida es cargar la hora", async () => {
  const c = controladorDePrueba();

  const sinHora = natalChartState({
    chart: cartaParcial({
      birthTimePrecision: "unknown",
      calculationTimeSource: "full_civil_day",
      access: { isPro: false, positions: true, angles: false, houses: false, aspects: false },
      missingInputs: ["exact_birth_time"],
      limitations: []
    }),
    refreshing: false,
    refreshFailed: true
  });
  assert.equal(sinHora.recovery, "completar-hora");

  const corrio = await c.store.pedir({ ...c.deps, recovery: sinHora.recovery });
  assert.equal(corrio, false);
  assert.equal(c.calculos, 0, "ningún recálculo puede inventar la hora de nacimiento");
  assert.equal(c.recalculos, 0);
  assert.equal(c.store.fase(), "quieto", "y no se anuncia un cálculo que no existe");

  // Lo mismo con la carga de datos: tampoco se resuelve calculando.
  assert.equal(await c.store.pedir({ ...c.deps, recovery: "cargar-datos" }), false);
  assert.equal(await c.store.pedir({ ...c.deps, recovery: "ninguna" }), false);
  assert.equal(c.calculos, 0);
});

test("las dos pantallas mandan a editar datos en la salida de la hora, sin acción de cálculo", () => {
  for (const [nombre, rel] of [
    ["hub", HUB],
    ["carta completa", COMPLETA]
  ] as const) {
    const pantalla = sinComentarios(leer(rel));
    assert.match(pantalla, /estado\.recovery [!=]== "completar-hora"/, nombre);
    assert.match(pantalla, /router\.push\("\/editar-datos"/, `${nombre}: la salida es el editor`);
    // La salida del estado viaja al controlador, que es quien la hace cumplir,
    // y con ella la CARTA: su `inputHash` es el alcance del estado.
    assert.match(
      pantalla,
      /useNatalChartRecovery\(\{ recovery: estado\.recovery, chart \}\)/,
      `${nombre}: el controlador exige la salida declarada y el alcance de la carta`
    );
  }
});

// ---------------------------------------------------------------------------
// 5 · el cableado: las dos pantallas usan el MISMO controlador
// ---------------------------------------------------------------------------

test("el hub y la carta completa recuperan por el mismo controlador compartido", () => {
  // 5.1 · el grafo real —el mismo que recorre Metro— llega desde las dos rutas
  // al hook y al controlador puro. No alcanza con que el nombre aparezca.
  for (const entry of ["app/(tabs)/perfil/index.tsx", "app/(tabs)/perfil/carta/completa.tsx"]) {
    const grafo = reachableFrom([entry], "native");
    assert.ok(grafo.has(HOOK), `${entry} no llega a ${HOOK}`);
    assert.ok(grafo.has(CONTROLADOR), `${entry} no llega a ${CONTROLADOR}`);
  }

  // 5.2 · el registro es UNO, de módulo: si se creara dentro del hook, cada
  // pantalla tendría su propio candado y las dos podrían pedir a la vez. Lo que
  // reparte por alcance es el registro, no el montaje.
  const hook = sinComentarios(leer(HOOK));
  assert.match(hook, /^const registry = createNatalChartRecoveryRegistry\(\);$/m, "un registro por módulo");
  const declaracion = hook.indexOf("const registry = createNatalChartRecoveryRegistry()");
  const funcion = hook.indexOf("export function useNatalChartRecovery");
  assert.ok(declaracion >= 0 && funcion > declaracion, "el registro vive fuera del hook");
  assert.match(hook, /registry\.storeFor\(\{ userId, inputHash \}\)/, "el alcance es cuenta + carta");

  // 5.3 · el hook llama a la operación que dice cómo terminó, por la referencia
  // GENERADA, y encadena la vía ESPERABLE del ciclo de capas: `refresh` a secas
  // soltaba el candado en el medio del trabajo.
  assert.match(hook, /chartsApi\.recoverNatalChart/);
  assert.doesNotMatch(hook, /appApi\./, "la action nueva no se consume por una firma escrita a mano");
  assert.match(hook, /recalcularCapas: refreshAndWait/);
  assert.doesNotMatch(hook, /recalcularCapas: refresh\b/, "el refresco tiene que poder esperarse");
  // Y los DOS predicados se le pasan al controlador. Son dos porque contestan
  // cosas distintas: uno decide si el ciclo sigue hasta el refresco, el otro si
  // un error todavía describe algo. Con uno solo, un éxito salteaba el refresco.
  assert.match(hook, /mismoAlcance,/, "el alcance decide si el ciclo sigue");
  assert.match(hook, /falloVigente: \(\) => mismoAlcance\(\) && salidaViva\.current === "reintentar"/);
  assert.doesNotMatch(hook, /vigente: \(\) =>/, "el predicado único ya no existe");
  assert.match(hook, /montado\.current/, "montado");
  assert.match(hook, /alcanceVivo\.current === alcanceDelPedido/, "mismo alcance");

  // 5.4 · ninguna de las dos pantallas vuelve a cablear el refresco del día a un
  // bloque de recuperación: ése era exactamente el defecto.
  for (const [nombre, rel] of [
    ["hub", HUB],
    ["carta completa", COMPLETA]
  ] as const) {
    const pantalla = sinComentarios(leer(rel));
    assert.match(pantalla, /useNatalChartRecovery/, nombre);
    // El refresco del día sigue existiendo donde SÍ corresponde —el aviso de
    // dato viejo de las capas— y en ningún bloque de recuperación de la carta:
    // ése era exactamente el cableado defectuoso.
    for (const posicion of indicesDe(pantalla, "onRetry={refresh}")) {
      const antes = pantalla.slice(Math.max(0, posicion - 400), posicion);
      assert.ok(
        antes.lastIndexOf("<StaleNotice") > antes.lastIndexOf("<SinCalculo"),
        `${nombre}: el refresco del día no genera la carta`
      );
    }
    for (const bloque of ["SinCalculo", "FaltaCalculo"]) {
      const uso = new RegExp(`<${bloque}[\\s\\S]{0,240}?onRetry=\\{recuperacion\\.recuperar\\}`);
      const anidado = new RegExp(`<${bloque}[\\s\\S]{0,240}?onRetry=\\{onRetry\\}`);
      assert.ok(
        uso.test(pantalla) || anidado.test(pantalla),
        `${nombre}: ${bloque} tiene que recuperar por el controlador`
      );
    }
  }

  // 5.5 · el controlador puro no importa React ni Convex: por eso se puede
  // probar la concurrencia de verdad.
  const controlador = leer(CONTROLADOR);
  assert.doesNotMatch(controlador, /from "react"/);
  assert.doesNotMatch(controlador, /convex\/react/);
  assert.doesNotMatch(controlador, /anyApi/, "no se agrega ningún binding sin tipar");
});

test("el bloqueo y la voz del botón acompañan al trabajo en curso", () => {
  for (const [nombre, rel] of [
    ["hub", HUB],
    ["carta completa", COMPLETA]
  ] as const) {
    const pantalla = sinComentarios(leer(rel));
    assert.match(pantalla, /disabled=\{refreshing\}/, `${nombre}: no se apilan pedidos`);
    assert.match(pantalla, /label=\{refreshing \? "CALCULANDO…"/, `${nombre}: dice qué está haciendo`);
    assert.match(pantalla, /"REINTENTAR"/, `${nombre}: después de un fallo se ofrece reintentar`);
    assert.match(
      pantalla,
      /No pudimos completar el cálculo ahora\./,
      `${nombre}: el fallo se dice, no se disimula`
    );
    // Y se dice en región viva: el estado cambia sin que la persona toque nada.
    const fallo = /function FalloDeRecuperacion\(\)[\s\S]*?\n\}/.exec(pantalla)?.[0] ?? "";
    assert.ok(fallo.length > 0, `${nombre}: falta el bloque de fallo`);
    assert.match(fallo, /accessibilityLiveRegion="polite"/, `${nombre}: VoiceOver tiene que enterarse`);
  }
});

// ---------------------------------------------------------------------------
// 6 · el ciclo completo vive bajo el MISMO candado (P1-B)
//
// El recálculo del día se disparaba sin esperarlo: la fase pasaba a `quieto` y
// el candado se soltaba mientras el refresco todavía ni había salido. Un
// segundo toque volvía a llamar la operación de cálculo.
// ---------------------------------------------------------------------------

test("con el refresco en vuelo, el pedido sigue pendiente, la fase es calculando y el candado sigue tomado", async () => {
  const c = controladorDePrueba({ refrescoDiferido: true });
  let terminado = false;
  const enVuelo = c.store.pedir(c.deps).then((valor) => {
    terminado = true;
    return valor;
  });

  await cede();
  await cede();

  assert.equal(c.calculos, 1);
  assert.equal(c.recalculos, 1, "la segunda mitad ya salió");
  assert.equal(c.refrescos.length, 1, "y sigue en vuelo");
  assert.equal(terminado, false, "el pedido no puede terminar antes que el trabajo");
  assert.equal(c.store.fase(), "calculando", "el botón sigue diciendo CALCULANDO…");
  assert.equal(c.store.ocupado(), true, "y el candado sigue tomado");

  c.refrescos[0].resolve();
  assert.equal(await enVuelo, true);
  assert.equal(c.store.fase(), "quieto");
  assert.equal(c.store.ocupado(), false, "recién ahora se suelta");
});

test("un segundo toque mientras el refresco está en vuelo no vuelve a calcular", async () => {
  const c = controladorDePrueba({ refrescoDiferido: true });
  const primero = c.store.pedir(c.deps);
  await cede();
  await cede();
  assert.equal(c.refrescos.length, 1, "el fixture necesita el refresco en vuelo");

  const segundo = await c.store.pedir(c.deps);
  assert.equal(segundo, false, "el candado no está libre");
  assert.equal(c.calculos, 1, "y no se llamó otra vez a la operación de cálculo");
  assert.equal(c.recalculos, 1);

  c.refrescos[0].resolve();
  await primero;
  assert.equal(c.calculos, 1);
});

test("si el refresco es rechazado, queda fallo, el candado libre y el reintento posible", async () => {
  const c = controladorDePrueba({ refrescoDiferido: true });
  const primero = c.store.pedir(c.deps);
  await cede();
  await cede();

  c.refrescos[0].reject(new Error("backend caído"));
  assert.equal(await primero, true, "corrió: el rechazo no se propaga a quien tocó el botón");
  assert.equal(c.store.fase(), "fallo", "la carta nueva está, pero el día no se pudo rearmar");
  assert.equal(c.store.ocupado(), false, "un error no puede dejar el botón muerto");

  // Y el reintento vuelve a hacer el ciclo entero.
  const segundo = c.store.pedir(c.deps);
  await cede();
  await cede();
  assert.equal(c.calculos, 2);
  assert.equal(c.refrescos.length, 2);
  c.refrescos[1].resolve();
  assert.equal(await segundo, true);
  assert.equal(c.store.fase(), "quieto");
});

test("una respuesta que no mejora nada no es éxito: no recalcula el día y queda en fallo", async () => {
  const c = controladorDePrueba({ noMejora: true });

  await c.store.pedir(c.deps);

  assert.equal(c.calculos, 1);
  assert.equal(c.recalculos, 0, "no hay carta nueva con la que rearmar el día");
  assert.equal(c.store.fase(), "fallo", "que la llamada haya vuelto no es un final");
  assert.equal(c.store.ocupado(), false);

  // Cuando de verdad mejora, el ciclo entero corre.
  c.mejorarA(true);
  assert.equal(await c.store.pedir(c.deps), true);
  assert.equal(c.recalculos, 1);
  assert.equal(c.store.fase(), "quieto");
});

// ---------------------------------------------------------------------------
// 7 · el fallo tiene ALCANCE: no se pega entre cartas ni entre cuentas (P2-A)
// ---------------------------------------------------------------------------

test("el alcance es cuenta + carta, con un valor estable para los huecos", () => {
  assert.equal(natalRecoveryScopeKey({ userId: "u1", inputHash: "h1" }), "u1|h1");
  assert.notEqual(
    natalRecoveryScopeKey({ userId: "u1", inputHash: "h1" }),
    natalRecoveryScopeKey({ userId: "u2", inputHash: "h1" }),
    "otra cuenta, otro alcance"
  );
  assert.notEqual(
    natalRecoveryScopeKey({ userId: "u1", inputHash: "h1" }),
    natalRecoveryScopeKey({ userId: "u1", inputHash: "h2" }),
    "otra carta, otro alcance"
  );
  // Los huecos son estables: dos pantallas mirando la misma ausencia comparten
  // candado en vez de largar dos pedidos.
  assert.equal(
    natalRecoveryScopeKey({ userId: null, inputHash: undefined }),
    natalRecoveryScopeKey({ userId: undefined, inputHash: null })
  );
});

test("las dos pantallas de la MISMA carta comparten store y candado", async () => {
  const registry = createNatalChartRecoveryRegistry();
  const hub = registry.storeFor({ userId: "u1", inputHash: "h1" });
  const completa = registry.storeFor({ userId: "u1", inputHash: "h1" });
  assert.equal(hub, completa, "el mismo alcance es el mismo store");

  const c = controladorDePrueba({ refrescoDiferido: true, store: hub });
  const primero = hub.pedir(c.deps);
  await cede();
  // La otra pantalla ve exactamente lo mismo y no puede largar un segundo pedido.
  assert.equal(completa.fase(), "calculando");
  assert.equal(completa.ocupado(), true);
  assert.equal(await completa.pedir(c.deps), false);
  assert.equal(c.calculos, 1);

  c.refrescos[0].resolve();
  await primero;
});

test("A falla y B entra recuperable: B empieza quieto", async () => {
  const registry = createNatalChartRecoveryRegistry();
  const a = registry.storeFor({ userId: "u1", inputHash: "hA" });
  const ca = controladorDePrueba({ falla: true, store: a });
  await a.pedir(ca.deps);
  assert.equal(a.fase(), "fallo");

  // Otra carta de la misma cuenta, y otra cuenta con la misma carta: ninguna
  // hereda el error ni el candado.
  for (const scope of [
    { userId: "u1", inputHash: "hB" },
    { userId: "u2", inputHash: "hA" }
  ]) {
    const b = registry.storeFor(scope);
    assert.notEqual(b, a, JSON.stringify(scope));
    assert.equal(b.fase(), "quieto", JSON.stringify(scope));
    assert.equal(b.ocupado(), false, JSON.stringify(scope));
  }
  // Y A conserva el suyo: no se limpia solo por mirar otra carta.
  assert.equal(a.fase(), "fallo");
});

test("A falla y después queda listo por otra vía: el fallo se limpia", async () => {
  const a = createNatalChartRecoveryStore();
  const c = controladorDePrueba({ falla: true, store: a });
  await a.pedir(c.deps);
  assert.equal(a.fase(), "fallo");

  // La carta se completó sin tocar el botón —el prewarm, otro dispositivo, el
  // recálculo del alta—: el estado deja de ofrecer reintentar.
  const estado = natalChartState({ chart: cartaCompleta(), refreshing: false, refreshFailed: false });
  assert.notEqual(estado.recovery, "reintentar");
  a.olvidarFallo();

  assert.equal(a.fase(), "quieto", "el error del intento anterior ya no describe nada");
});

test("olvidar el fallo no toca un trabajo en vuelo", async () => {
  const store = createNatalChartRecoveryStore();
  const c = controladorDePrueba({ refrescoDiferido: true, store });
  const enVuelo = store.pedir(c.deps);
  await cede();
  assert.equal(store.fase(), "calculando");

  store.olvidarFallo();
  assert.equal(store.fase(), "calculando", "una corrida viva se sigue anunciando");
  assert.equal(store.ocupado(), true);

  c.refrescos[0].resolve();
  await enVuelo;
});

test("una promesa vieja de A que termina después del cambio no altera a B", async () => {
  const registry = createNatalChartRecoveryRegistry();
  const a = registry.storeFor({ userId: "u1", inputHash: "hA" });
  const ca = controladorDePrueba({ refrescoDiferido: true, store: a });
  const viejo = a.pedir(ca.deps);
  await cede();
  await cede();
  assert.equal(a.fase(), "calculando");

  // La pantalla cambia de carta mientras aquello sigue vivo.
  const b = registry.storeFor({ userId: "u1", inputHash: "hB" });
  assert.equal(b.fase(), "quieto");
  const avisos: string[] = [];
  b.subscribe(() => avisos.push(b.fase()));

  // Y la corrida vieja termina —bien o mal— cuando B ya es lo que se está
  // mirando.
  ca.refrescos[0].reject(new Error("tarde"));
  await viejo;

  assert.equal(a.fase(), "fallo", "el desenlace pertenece al alcance que lo pidió");
  assert.equal(b.fase(), "quieto", "y no puede publicar sobre el alcance nuevo");
  assert.deepEqual(avisos, [], "B no recibió ni un aviso");
  assert.equal(b.ocupado(), false);
});

test("el registro suelta alcances viejos, pero nunca uno con trabajo en vuelo", async () => {
  const registry = createNatalChartRecoveryRegistry({ max: 2 });
  const ocupado = registry.storeFor({ userId: "u1", inputHash: "ocupado" });
  const c = controladorDePrueba({ refrescoDiferido: true, store: ocupado });
  const enVuelo = ocupado.pedir(c.deps);
  await cede();
  assert.equal(ocupado.ocupado(), true);

  // Se piden más alcances de los que el registro recuerda.
  for (const inputHash of ["h1", "h2", "h3", "h4"]) {
    registry.storeFor({ userId: "u1", inputHash });
  }
  assert.ok(registry.size() <= 3, "los alcances libres se sueltan");

  // El que estaba trabajando sigue siendo el MISMO objeto: soltarlo dejaría que
  // un segundo toque creara un store nuevo con el candado libre mientras la
  // operación anterior sigue viva.
  assert.equal(registry.storeFor({ userId: "u1", inputHash: "ocupado" }), ocupado);
  assert.equal(ocupado.ocupado(), true);
  assert.equal(await ocupado.pedir(c.deps), false, "y sigue sin admitir un segundo pedido");

  c.refrescos[0].resolve();
  await enVuelo;
});

// ---------------------------------------------------------------------------
// 8 · el registro tampoco desaloja un store MONTADO (P2-A)
//
// El límite de ocho sólo protegía `ocupado()`. Un store quieto pero con una
// pantalla viva mirándolo podía ser desalojado, y el siguiente `storeFor` del
// MISMO alcance devolvía otro objeto —otro candado— mientras la primera pantalla
// seguía ahí. Dos candados para el mismo alcance es exactamente lo que el
// registro existe para evitar.
// ---------------------------------------------------------------------------

test("un store con suscriptor vivo conserva su identidad aunque se visiten otras cartas", () => {
  const registry = createNatalChartRecoveryRegistry({ max: 2 });
  const a = registry.storeFor({ userId: "u1", inputHash: "hA" });
  // La pantalla se monta: `useSyncExternalStore` se suscribe, y suscribirse ES
  // la retención. Nada de suponer cuándo React termina con un componente.
  const desuscribirA = a.subscribe(() => undefined);
  assert.equal(a.observadores(), 1);
  assert.equal(registry.desalojable({ userId: "u1", inputHash: "hA" }), false);

  // Se visitan otras cartas, muchas más que el límite del registro.
  for (const inputHash of ["hB", "hC", "hD", "hE"]) {
    registry.storeFor({ userId: "u1", inputHash });
  }

  assert.equal(
    registry.storeFor({ userId: "u1", inputHash: "hA" }),
    a,
    "el store de la pantalla montada es el MISMO objeto: un candado, no dos"
  );
  assert.equal(a.observadores(), 1, "y sigue observado");

  // Al desuscribirse —la pantalla se desmonta— vuelve a ser desalojable.
  desuscribirA();
  assert.equal(a.observadores(), 0);
  assert.equal(registry.desalojable({ userId: "u1", inputHash: "hA" }), true);
});

test("desuscribirse permite desalojar, así que la memoria no crece sin límite", () => {
  const registry = createNatalChartRecoveryRegistry({ max: 2 });
  const a = registry.storeFor({ userId: "u1", inputHash: "hA" });
  const desuscribir = a.subscribe(() => undefined);
  registry.storeFor({ userId: "u1", inputHash: "hB" });
  registry.storeFor({ userId: "u1", inputHash: "hC" });
  assert.ok(registry.size() >= 2, "mientras A está montado no se lo puede soltar");
  assert.equal(registry.storeFor({ userId: "u1", inputHash: "hA" }), a);

  desuscribir();
  // Ahora sí: se piden alcances nuevos y A se suelta como cualquier otro.
  for (const inputHash of ["hD", "hE", "hF"]) {
    registry.storeFor({ userId: "u1", inputHash });
  }
  assert.ok(registry.size() <= 3, "el registro no crece sin límite");
  assert.notEqual(
    registry.storeFor({ userId: "u1", inputHash: "hA" }),
    a,
    "un alcance que ya nadie mira se puede soltar, y vuelve quieto"
  );
});

test("un store OCUPADO no se desaloja aunque no tenga ningún suscriptor", async () => {
  const registry = createNatalChartRecoveryRegistry({ max: 1 });
  const ocupado = registry.storeFor({ userId: "u1", inputHash: "ocupado" });
  const c = controladorDePrueba({ refrescoDiferido: true, store: ocupado });
  const enVuelo = ocupado.pedir(c.deps);
  await cede();
  assert.equal(ocupado.observadores(), 0, "nadie lo está mirando…");
  assert.equal(ocupado.ocupado(), true, "…pero está trabajando");
  assert.equal(registry.desalojable({ userId: "u1", inputHash: "ocupado" }), false);

  for (const inputHash of ["h1", "h2", "h3"]) {
    registry.storeFor({ userId: "u1", inputHash });
  }
  assert.equal(registry.storeFor({ userId: "u1", inputHash: "ocupado" }), ocupado);
  assert.equal(await ocupado.pedir(c.deps), false, "y su candado sigue tomado");

  c.refrescos[0].resolve();
  await enVuelo;
  assert.equal(registry.desalojable({ userId: "u1", inputHash: "ocupado" }), true, "al terminar, se puede soltar");
});

// ---------------------------------------------------------------------------
// 9 · una completion vieja no arranca trabajo en el alcance nuevo (P1-E)
//
// El controlador encadenaba `recalcularCapas` de forma incondicional, y lo que
// recibía era el refresco GLOBAL. Si mientras el proveedor respondía cambiaba la
// cuenta, la carta o la propia salida de recuperación, la operación vieja
// largaba un refresco visible sobre el alcance nuevo y le movía los flags.
// ---------------------------------------------------------------------------

test("A calcula, la pantalla pasa a B, A termina: NO se recalcula el día y B queda quieta", async () => {
  const registry = createNatalChartRecoveryRegistry();
  const a = registry.storeFor({ userId: "u1", inputHash: "hA" });
  const c = controladorDePrueba({ calculoDiferido: true, store: a });
  const enVuelo = a.pedir(c.deps);
  await cede();
  assert.equal(c.calculos, 1, "el cálculo natal está en vuelo");
  assert.equal(a.fase(), "calculando");

  // La pantalla cambia de carta —o de cuenta— antes de que el proveedor conteste.
  const b = registry.storeFor({ userId: "u1", inputHash: "hB" });
  const avisos: string[] = [];
  b.subscribe(() => avisos.push(b.fase()));
  c.cambiarDeAlcance();

  // Y recién ahí la operación vieja termina, con éxito.
  c.calculosDiferidos[0].resolve(true);
  assert.equal(await enVuelo, true, "corrió, pero no encadenó");

  assert.equal(c.recalculos, 0, "el ciclo de capas GLOBAL no se toca desde un trabajo que ya no es vigente");
  assert.deepEqual(c.traza, ["calcular"]);
  assert.equal(a.fase(), "quieto", "el gate del store viejo se libera en estado neutro");
  assert.equal(a.ocupado(), false);
  assert.equal(b.fase(), "quieto", "B queda quieta");
  assert.deepEqual(avisos, [], "y no recibió ni un aviso");
});

test("el mismo hash pasa de reintentar a ninguna durante el refresco y después falla: no queda fallo pegado", async () => {
  const store = createNatalChartRecoveryStore();
  const c = controladorDePrueba({ refrescoDiferido: true, store });
  const enVuelo = store.pedir(c.deps);
  await cede();
  await cede();
  assert.equal(c.recalculos, 1, "el refresco salió mientras la carta todavía era recuperable");

  // La carta se completa por otra vía: la salida deja de ser `reintentar`.
  const estado = natalChartState({ chart: cartaCompleta(), refreshing: false, refreshFailed: false });
  assert.notEqual(estado.recovery, "reintentar");
  c.salidaDejaDeSerReintentar();

  // Y el refresco falla tarde.
  c.refrescos[0].reject(new Error("tarde"));
  await enVuelo;

  assert.equal(store.fase(), "quieto", "un error que ya no describe nada no se guarda");
  assert.equal(store.ocupado(), false);

  // Y si ese mismo hash volviera a ser recuperable, no reaparece un fallo viejo.
  assert.equal(store.fase(), "quieto");
});

test("un rechazo del cálculo cuando el trabajo ya no es vigente tampoco deja fallo", async () => {
  for (const [motivo, cambiar] of [
    ["cambió la carta", (c: ReturnType<typeof controladorDePrueba>) => c.cambiarDeAlcance()],
    ["la carta dejó de ser recuperable", (c: ReturnType<typeof controladorDePrueba>) => c.salidaDejaDeSerReintentar()]
  ] as const) {
    const store = createNatalChartRecoveryStore();
    const c = controladorDePrueba({ calculoDiferido: true, store });
    const enVuelo = store.pedir(c.deps);
    await cede();

    cambiar(c);
    c.calculosDiferidos[0].reject(new Error("proveedor caído"));
    await enVuelo;

    assert.equal(store.fase(), "quieto", `${motivo}: el fallo ya no describe nada`);
    assert.equal(c.recalculos, 0, motivo);
  }
});

test("mientras SIGUE siendo vigente, el ciclo entero corre igual que antes", async () => {
  const c = controladorDePrueba();
  await c.store.pedir(c.deps);
  assert.deepEqual(c.traza, ["calcular", "recalcularCapas"], "calcular -> refresco esperado -> quieto");
  assert.equal(c.store.fase(), "quieto");

  // Y un fallo de una carta que SIGUE siendo la de la pantalla sí se dice.
  const d = controladorDePrueba({ falla: true });
  await d.store.pedir(d.deps);
  assert.equal(d.store.fase(), "fallo");
});

// ---------------------------------------------------------------------------
// Fixture — una carta publicada a la que le falta geometría calculable
// ---------------------------------------------------------------------------

function cartaParcial(overrides: Partial<NatalChartBase> = {}): NatalChartBase {
  return {
    methodVersion: "natal-chart-base-v1",
    providerVersion: "astrologyapi-planets-tropical-v1",
    inputHash: "hash-parcial",
    status: "partial",
    observedAt: 1_723_000_000_000,
    calculationTimeSource: "exact_birth_time",
    birthTimePrecision: "known",
    positions: [],
    angles: [],
    houses: [],
    aspects: [],
    access: { isPro: true, positions: true, angles: false, houses: false, aspects: true },
    missingInputs: ["verified_ascendant_mc_geometry"],
    limitations: [
      "Las posiciones planetarias son canónicas, pero la carta vigente no trae Ascendente y Medio Cielo verificables."
    ],
    sourceRefs: [],
    ...overrides
  } as NatalChartBase;
}

/** La misma carta, ya completa: el estado deja de ofrecer reintentar. */
function cartaCompleta(): NatalChartBase {
  return cartaParcial({
    status: "ready",
    access: { isPro: true, positions: true, angles: true, houses: true, aspects: true },
    missingInputs: [],
    limitations: []
  });
}

// ---------------------------------------------------------------------------
// 10 · el desmonte con el refresco colgado libera el candado natal (P1-C)
//
// Acá se enchufan las DOS piezas reales —la cola del ciclo de capas y el store
// de recuperación— porque el defecto vivía justo en la costura: la cola movía
// sus waiters activos fuera del arreglo global antes del `await`, el cleanup
// sólo ponía `mounted = false`, y una action que no resolvía dejaba al store con
// el candado tomado y `CALCULANDO…` para siempre.
// ---------------------------------------------------------------------------

test("con el refresco colgado y la pantalla desmontada, el candado natal se libera y el fallo no se publica en otro alcance", async () => {
  const corridas: Array<() => void> = [];
  let montado = true;
  const cola = createRefreshQueue({
    // La action del ciclo de capas nunca resuelve: es el caso real que dejaba la
    // promesa abierta para siempre.
    run: () => new Promise<void>((resolve) => corridas.push(resolve)),
    alive: () => montado,
    onBusyChange: () => undefined,
    onFailedChange: () => undefined
  });

  const registry = createNatalChartRecoveryRegistry();
  const a = registry.storeFor({ userId: "u1", inputHash: "hA" });
  const c = controladorDePrueba({ store: a });
  const enVuelo = a.pedir({ ...c.deps, recalcularCapas: () => cola.requestAndWait({ localDate: "2026-08-17", timezone: "UTC" }) });
  await cede();
  await cede();
  assert.equal(corridas.length, 1, "el refresco salió y quedó colgado");
  assert.equal(a.fase(), "calculando");
  assert.equal(a.ocupado(), true, "el candado natal está tomado");

  // Otra carta empieza a mirarse mientras aquello sigue vivo.
  const b = registry.storeFor({ userId: "u1", inputHash: "hB" });
  const avisosB: string[] = [];
  b.subscribe(() => avisosB.push(b.fase()));

  // El árbol se desmonta: el cleanup del hook cierra el ciclo de vida.
  montado = false;
  cola.suspend();
  await enVuelo;

  assert.equal(a.ocupado(), false, "el candado natal se libera en vez de quedar tomado para siempre");
  assert.equal(a.fase(), "fallo", "y el desenlace queda en el alcance que lo pidió");
  assert.equal(b.fase(), "quieto", "el otro alcance no se entera de nada");
  assert.deepEqual(avisosB, []);
  assert.equal(cola.waiting(), 0, "ninguna espera queda abierta");

  // Y al volver a montar, el botón vuelve a funcionar.
  montado = true;
  cola.resume();
  const d = controladorDePrueba({ store: a });
  assert.equal(await a.pedir(d.deps), true, "el reintento corre de nuevo");
  assert.equal(a.fase(), "quieto");
});

// ---------------------------------------------------------------------------
// 10 · un ÉXITO nunca puede saltear el refresh del día (P1-C del décimo pase)
//
// El defecto: el controlador exigía UN predicado —montado + alcance + salida
// todavía `reintentar`— para las dos decisiones. Pero `recovery` sale de una
// query REACTIVA: el cálculo que funciona hace que la carta deje de necesitar
// reintento, y esa salida puede llegar ANTES de que la continuación corra. El
// predicado único respondía "ya no es vigente" y el refresco del día se
// salteaba justo cuando la recuperación había salido bien: el sobre quedaba
// armado sin la geometría recién calculada, para siempre.
// ---------------------------------------------------------------------------

test("la salida pasa a `ninguna` antes de que el cálculo resuelva: se recalcula el día EXACTAMENTE una vez", async () => {
  const store = createNatalChartRecoveryStore();
  const c = controladorDePrueba({ calculoDiferido: true, store });
  const enVuelo = store.pedir(c.deps);
  await cede();
  assert.equal(c.calculos, 1, "el cálculo natal está en vuelo");

  // La query reactiva ya vio la carta completa: la misma pantalla, la misma
  // cuenta, la misma carta, y la salida deja de ser `reintentar`.
  c.salidaDejaDeSerReintentar();
  c.calculosDiferidos[0].resolve(true);
  assert.equal(await enVuelo, true);

  assert.equal(c.recalculos, 1, "la segunda mitad del trabajo corre igual: es la que arma el día");
  assert.deepEqual(c.traza, ["calcular", "recalcularCapas"]);
  assert.equal(store.fase(), "quieto");
  assert.equal(store.ocupado(), false, "y el candado queda libre");
});

test("un cambio real de alcance durante el cálculo sigue impidiendo el refresco", async () => {
  const store = createNatalChartRecoveryStore();
  const c = controladorDePrueba({ calculoDiferido: true, store });
  const enVuelo = store.pedir(c.deps);
  await cede();

  c.cambiarDeAlcance();
  c.calculosDiferidos[0].resolve(true);
  await enVuelo;

  assert.equal(c.recalculos, 0, "el ciclo de capas es GLOBAL: no se toca desde otro alcance");
  assert.equal(store.fase(), "quieto", "y el store viejo queda neutro");
});

test("una respuesta `false` que ya no describe nada no deja fallo pegado", async () => {
  const store = createNatalChartRecoveryStore();
  const c = controladorDePrueba({ calculoDiferido: true, store });
  const enVuelo = store.pedir(c.deps);
  await cede();

  // La carta se completó por otra vía mientras el proveedor respondía, y su
  // respuesta llega tarde diciendo que no mejoró nada.
  c.salidaDejaDeSerReintentar();
  c.calculosDiferidos[0].resolve(false);
  await enVuelo;

  assert.equal(store.fase(), "quieto", "el aviso no tendría botón que acompañar");
  assert.equal(c.recalculos, 0, "y no hay nada nuevo con lo que rearmar el día");
});

test("una respuesta `false` que SÍ describe la carta de la pantalla sigue diciendo fallo", async () => {
  const store = createNatalChartRecoveryStore();
  const c = controladorDePrueba({ noMejora: true, store });
  await store.pedir(c.deps);

  assert.equal(store.fase(), "fallo", "respondió, y falta exactamente lo mismo");
  assert.equal(c.recalculos, 0);
});
