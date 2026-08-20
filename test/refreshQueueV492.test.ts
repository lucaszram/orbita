/**
 * La cola del recálculo del día, probada por comportamiento.
 *
 * Vivía dentro de `useLayers` entre `useRef` y `useCallback`, así que lo único
 * verificable de ella era su forma —que existiera un ref usado como mutex, que
 * el nombre de la política de reintento apareciera en el archivo—. Lo que
 * importa no se probaba: dos solicitudes en el mismo tick, una tercera mientras
 * la primera corre, un reintento transitorio que no puede pisar una solicitud
 * más nueva, y sobre todo **quién puede esperar el final**.
 *
 * Ese último punto es el defecto que cierra esta pasada: el recálculo del día se
 * disparaba sin poder esperarlo, así que el candado de la recuperación de la
 * Carta se soltaba en el medio del trabajo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { LAYER_RACE_ERROR } from "../src/domain/layerRetry";
import {
  claveDeAlcance,
  claveTrasCerrar,
  createRefreshCycle,
  type RefreshCycle
} from "../src/domain/refreshCycle";
import { createRefreshQueue, type RefreshRequest } from "../src/domain/refreshQueue";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Cede el turno al bucle de eventos, como haría cualquier `await` real. */
const cede = () => new Promise((resolve) => setTimeout(resolve, 0));

type Diferida = {
  request: RefreshRequest;
  resolve: () => void;
  reject: (error: unknown) => void;
};

/**
 * Una cola con la acción bajo control: cada corrida queda suspendida hasta que
 * la prueba la resuelve o la rechaza. Sin eso no se puede observar el estado
 * mientras algo está en vuelo, que es justo lo que hay que observar.
 *
 * Con `sleepManual`, además, el backoff del reintento automático queda
 * suspendido: es la única forma de comprobar que una solicitud más nueva NO
 * espera el resto de la espera de la anterior.
 */
function colaDePrueba(options: { alive?: () => boolean; sleepManual?: boolean } = {}) {
  const corridas: Diferida[] = [];
  const busy: boolean[] = [];
  const failed: boolean[] = [];
  const esperas: number[] = [];
  /** Los backoffs suspendidos, cuando `sleepManual` está puesto. */
  const dormidas: Array<{ ms: number; despertar: () => void }> = [];
  const cola = createRefreshQueue({
    run: (request) =>
      new Promise<void>((resolve, reject) => {
        corridas.push({ request, resolve, reject });
      }),
    alive: options.alive ?? (() => true),
    onBusyChange: (valor) => busy.push(valor),
    onFailedChange: (valor) => failed.push(valor),
    // La espera del reintento automático no se duerme de verdad: se anota y se
    // cede el turno, así la prueba corre en microsegundos sin aflojar nada.
    sleep: async (ms) => {
      esperas.push(ms);
      if (options.sleepManual) {
        await new Promise<void>((resolve) => dormidas.push({ ms, despertar: resolve }));
        return;
      }
      await cede();
    }
  });
  return { cola, corridas, busy, failed, esperas, dormidas };
}

const PEDIDO = { localDate: "2026-08-17", timezone: "UTC" };
const OTRO = { localDate: "2026-08-18", timezone: "UTC" };
const TERCERO = { localDate: "2026-08-19", timezone: "UTC" };

// ---------------------------------------------------------------------------
// 1 · single-flight y "la más reciente gana"
// ---------------------------------------------------------------------------

test("dos solicitudes del mismo tick largan UNA sola acción", async () => {
  const q = colaDePrueba();
  q.cola.request(PEDIDO);
  q.cola.request(OTRO);

  // El candado se toma antes del primer `await`, así que la segunda entrada del
  // mismo tick no larga nada: espera turno. Sin candado —cuando el único
  // control era la clave del pedido— dos pedidos distintos y seguidos largaban
  // dos acciones a la vez sobre el mismo sobre.
  assert.equal(q.corridas.length, 1, "el candado es sincrónico: la segunda no larga nada");
  assert.deepEqual(q.corridas[0].request, PEDIDO, "la que ya salió es la que corre");
  assert.equal(q.cola.busy(), true);
  assert.deepEqual(q.cola.pending(), OTRO, "y la nueva queda como la única pendiente");
});

test("lo que llega durante una corrida espera turno, y sólo lo último se ejecuta", async () => {
  const q = colaDePrueba();
  q.cola.request(PEDIDO);
  q.cola.request(OTRO);
  q.cola.request(TERCERO);
  assert.equal(q.corridas.length, 1);
  assert.deepEqual(q.cola.pending(), TERCERO, "de las dos que llegaron, queda la más nueva");

  q.corridas[0].resolve();
  await cede();

  assert.equal(q.corridas.length, 2, "una segunda corrida, no dos");
  assert.deepEqual(q.corridas[1].request, TERCERO);
  q.corridas[1].resolve();
  await cede();
  assert.equal(q.cola.busy(), false);
  assert.equal(q.busy.at(-1), false, "con la cola vacía se apaga el hilandero");
});

// ---------------------------------------------------------------------------
// 2 · la vía esperable termina CON la solicitud
// ---------------------------------------------------------------------------

test("requestAndWait no resuelve al encolar: resuelve cuando la solicitud termina", async () => {
  const q = colaDePrueba();
  let terminado = false;
  const espera = q.cola.requestAndWait(PEDIDO).then(() => {
    terminado = true;
  });

  await cede();
  assert.equal(terminado, false, "la acción sigue en vuelo");
  assert.equal(q.corridas.length, 1);

  q.corridas[0].resolve();
  await espera;
  assert.equal(terminado, true);
  assert.equal(q.cola.busy(), false, "y el hilandero quedó libre");
});

test("con una corrida en vuelo, quien espera NO resuelve enseguida: espera a la pendiente más reciente", async () => {
  const q = colaDePrueba();
  q.cola.request(PEDIDO);
  assert.equal(q.corridas.length, 1);

  let terminado = false;
  const espera = q.cola.requestAndWait(OTRO).then(() => {
    terminado = true;
  });

  // La primera termina. Eso NO puede resolver a quien pidió la segunda.
  q.corridas[0].resolve();
  await cede();
  assert.equal(terminado, false, "su solicitud todavía no corrió");
  assert.equal(q.corridas.length, 2, "y no se abrió ninguna acción paralela");
  assert.deepEqual(q.corridas[1].request, OTRO);

  q.corridas[1].resolve();
  await espera;
  assert.equal(terminado, true);
});

test("dos esperas mientras corre la primera se atienden con UNA sola acción, y las dos terminan", async () => {
  const q = colaDePrueba();
  q.cola.request(PEDIDO);
  const a = q.cola.requestAndWait(OTRO);
  const b = q.cola.requestAndWait(TERCERO);

  q.corridas[0].resolve();
  await cede();
  assert.equal(q.corridas.length, 2, "las dos esperas comparten la solicitud coalescida");
  assert.deepEqual(q.corridas[1].request, TERCERO, "la más reciente gana, también acá");

  q.corridas[1].resolve();
  await Promise.all([a, b]);
  assert.equal(q.corridas.length, 2, "y nadie encoló una acción de más");
});

test("un rechazo real rechaza a quien esperaba, y deja la cola libre para el reintento", async () => {
  const q = colaDePrueba();
  const espera = q.cola.requestAndWait(PEDIDO);
  q.corridas[0].reject(new Error("backend caído"));

  await assert.rejects(espera, /backend caído/);
  assert.equal(q.failed.at(-1), true, "el fallo se publica");
  assert.equal(q.cola.busy(), false, "un error no puede dejar la cola muerta");

  // Y el reintento vuelve a correr de verdad.
  const segunda = q.cola.requestAndWait(OTRO);
  assert.equal(q.corridas.length, 2);
  q.corridas[1].resolve();
  await segunda;
  assert.equal(q.failed.at(-1), false, "al salir bien, el aviso se retira");
});

// ---------------------------------------------------------------------------
// 3 · la carrera del alta se reintenta sola, sin soltar a quien espera
// ---------------------------------------------------------------------------

test("la carrera del alta se reintenta sola y quien espera sigue esperando", async () => {
  const q = colaDePrueba();
  let terminado = false;
  const espera = q.cola.requestAndWait(PEDIDO).then(() => {
    terminado = true;
  });

  q.corridas[0].reject(new Error(`[Request ID: x] Server Error ${LAYER_RACE_ERROR}`));
  await cede();
  await cede();

  assert.equal(terminado, false, "no se declaró fallo: el alta todavía escribía");
  assert.deepEqual(q.failed, [], "y no se avisó ningún error a la pantalla");
  assert.equal(q.corridas.length, 2, "se reintentó solo");
  assert.deepEqual(q.corridas[1].request, PEDIDO);
  assert.deepEqual(q.esperas, [1500], "con la primera espera de la política");

  q.corridas[1].resolve();
  await espera;
  assert.equal(terminado, true);
});

test("el reintento automático se agota y entonces sí se dice que falló", async () => {
  const q = colaDePrueba();
  // El desenlace se captura al crear la promesa: si se esperara al final, el
  // rechazo quedaría sin manejar durante unos ticks.
  const desenlace = q.cola.requestAndWait(PEDIDO).then(
    () => "resolvió",
    (error: unknown) => (error instanceof Error ? error.message : String(error))
  );
  const carrera = () => new Error(`Server Error ${LAYER_RACE_ERROR}`);

  for (let intento = 0; intento < 4; intento += 1) {
    assert.equal(q.corridas.length, intento + 1, `intento ${intento}`);
    q.corridas[intento].reject(carrera());
    await cede();
    await cede();
  }

  assert.match(await desenlace, new RegExp(LAYER_RACE_ERROR));
  assert.deepEqual(q.esperas, [1500, 4500, 9000], "tres reintentos, crecientes");
  assert.equal(q.corridas.length, 4, "y no hay un quinto");
  assert.equal(q.failed.at(-1), true);
});

test("un reintento transitorio no pisa una solicitud más nueva", async () => {
  const q = colaDePrueba();
  q.cola.request(PEDIDO);
  // Llega algo más nuevo mientras la primera corre…
  q.cola.request(OTRO);
  // …y la primera se cae por la carrera del alta.
  q.corridas[0].reject(new Error(LAYER_RACE_ERROR));
  await cede();
  await cede();

  assert.equal(q.corridas.length, 2);
  assert.deepEqual(
    q.corridas[1].request,
    OTRO,
    "recalcular el día con datos de hace dos cambios no le sirve a nadie"
  );
});

test("un reintento explícito devuelve el crédito de reintentos automáticos", async () => {
  const q = colaDePrueba();
  const carrera = () => new Error(LAYER_RACE_ERROR);
  q.cola.request(PEDIDO);
  for (let intento = 0; intento < 4; intento += 1) {
    q.corridas[intento].reject(carrera());
    await cede();
    await cede();
  }
  assert.equal(q.failed.at(-1), true, "el crédito se gastó");

  q.cola.resetRetries();
  q.cola.request(OTRO);
  assert.equal(q.corridas.length, 5);
  q.corridas[4].reject(carrera());
  await cede();
  await cede();
  assert.equal(q.corridas.length, 6, "vuelve a tener reintentos automáticos");
  assert.deepEqual(q.esperas, [1500, 4500, 9000, 1500]);
});

// ---------------------------------------------------------------------------
// 4 · desmonte
// ---------------------------------------------------------------------------

test("sin ciclo de datos vivo, la espera rechaza en vez de quedar colgada para siempre", async () => {
  const q = colaDePrueba({ alive: () => false });
  await assert.rejects(q.cola.requestAndWait(PEDIDO), /LAYERS_REFRESH_UNAVAILABLE/);
  assert.equal(q.corridas.length, 0);
});

test("un desmonte corta las esperas en vez de dejarlas colgadas para siempre", async () => {
  let vivo = true;
  const q = colaDePrueba({ alive: () => vivo });
  // Quien espera tiene un candado tomado —la recuperación de la Carta lo tiene—,
  // así que una promesa que nunca termina mataría el botón hasta remontar.
  const desenlace = q.cola.requestAndWait(PEDIDO).then(
    () => "resolvió",
    (error: unknown) => (error instanceof Error ? error.message : String(error))
  );
  assert.equal(q.corridas.length, 1);

  vivo = false;
  q.corridas[0].resolve();
  await cede();

  assert.equal(await desenlace, "resolvió", "la corrida que SÍ terminó resuelve normal");

  // Y una espera que el desmonte deja sin atender se corta con su motivo.
  vivo = true;
  const segunda = q.cola.requestAndWait(OTRO).then(
    () => "resolvió",
    (error: unknown) => (error instanceof Error ? error.message : String(error))
  );
  assert.equal(q.corridas.length, 2);
  vivo = false;
  q.corridas[1].resolve();
  await cede();
  const tercera = new Promise<string>((resolve) => {
    q.cola.requestAndWait(TERCERO).then(
      () => resolve("resolvió"),
      (error: unknown) => resolve(error instanceof Error ? error.message : String(error))
    );
  });
  assert.equal(await segunda, "resolvió");
  assert.match(await tercera, /LAYERS_REFRESH_UNAVAILABLE/);
});

test("lo pendiente sobrevive a un desmonte y se retoma con resume()", async () => {
  let vivo = true;
  const q = colaDePrueba({ alive: () => vivo });
  q.cola.request(PEDIDO);
  q.cola.request(OTRO);
  assert.deepEqual(q.cola.pending(), OTRO);

  vivo = false;
  q.corridas[0].resolve();
  await cede();
  assert.equal(q.corridas.length, 1, "desmontado, el bucle no sigue trabajando");
  assert.deepEqual(q.cola.pending(), OTRO, "pero no se pierde la solicitud");

  vivo = true;
  q.cola.resume();
  await cede();
  assert.equal(q.corridas.length, 2, "al volver, se retoma");
  assert.deepEqual(q.corridas[1].request, OTRO);
});

// ---------------------------------------------------------------------------
// 5 · el ciclo de vida explícito: `suspend()` / `resume()` (P1-C)
//
// El defecto: `requestAndWait` movía sus waiters ACTIVOS fuera del arreglo
// global antes del `await`, y el cleanup del hook sólo ponía `mounted = false`.
// Si la action no resolvía y el árbol se desmontaba, esa promesa no terminaba
// nunca: el candado natal quedaba tomado y `CALCULANDO…` no se desbloqueaba ni
// volviendo a montar.
// ---------------------------------------------------------------------------

test("una acción que nunca resuelve + desmonte: la espera rechaza en vez de quedar colgada", async () => {
  const q = colaDePrueba();
  const desenlace = q.cola.requestAndWait(PEDIDO).then(
    () => "resolvió",
    (error: unknown) => (error instanceof Error ? error.message : String(error))
  );
  await cede();
  assert.equal(q.corridas.length, 1, "la action salió…");
  assert.equal(q.cola.waiting(), 1, "…y alguien la está esperando");

  // El cleanup del hook. La action sigue viva —no se puede cancelar— pero quien
  // esperaba no puede quedar pendiente para siempre.
  q.cola.suspend();

  assert.match(await desenlace, /LAYERS_REFRESH_UNAVAILABLE/);
  assert.equal(q.cola.waiting(), 0, "no queda ninguna espera abierta");
  assert.equal(q.cola.suspended(), true);
});

test("las esperas que todavía no salieron también se cortan al desmontar", async () => {
  const q = colaDePrueba();
  q.cola.request(PEDIDO);
  const enTurno = q.cola.requestAndWait(OTRO).then(
    () => "resolvió",
    (error: unknown) => (error instanceof Error ? error.message : String(error))
  );
  assert.equal(q.cola.waiting(), 1, "espera turno detrás de la que corre");

  q.cola.suspend();
  assert.match(await enTurno, /LAYERS_REFRESH_UNAVAILABLE/, "la pendiente tampoco queda colgada");
  assert.equal(q.cola.waiting(), 0);
});

test("una completion tardía después del desmonte no toca los flags del ciclo nuevo", async () => {
  const q = colaDePrueba();
  const cortada = q.cola.requestAndWait(PEDIDO).catch(() => "cortada");
  await cede();
  q.cola.suspend();
  assert.equal(await cortada, "cortada");

  // Ciclo nuevo: se vuelve a montar y se empieza a observar de cero.
  q.cola.resume();
  q.busy.length = 0;
  q.failed.length = 0;

  // Y RECIÉN AHORA termina la action del ciclo viejo, bien o mal.
  q.corridas[0].resolve();
  await cede();
  assert.deepEqual(q.failed, [], "una corrida de otro ciclo no publica nada");
  assert.deepEqual(q.busy, [], "ni siquiera el apagado del hilandero");

  const q2 = colaDePrueba();
  const cortada2 = q2.cola.requestAndWait(PEDIDO).catch(() => "cortada");
  await cede();
  q2.cola.suspend();
  await cortada2;
  q2.cola.resume();
  q2.failed.length = 0;
  q2.corridas[0].reject(new Error("tarde y mal"));
  await cede();
  await cede();
  assert.deepEqual(q2.failed, [], "un rechazo tardío tampoco enciende el aviso del ciclo nuevo");
});

// El defecto que cierra esta sección (P1-D del décimo pase): el mutex era un
// booleano GLOBAL. `suspend()` cortaba los waiters pero lo dejaba tomado, así
// que si la action de A no resolvía nunca, `resume()` no podía arrancar nada: la
// solicitud del ciclo nuevo quedaba encolada para siempre y `CALCULANDO…` no se
// apagaba. La semántica correcta es single-flight POR GENERACIÓN VIVA: una
// action de una generación cerrada queda huérfana y sin efectos.
test("A eterna: `suspend()` corta la espera y `resume()` deja el ciclo vivo sin busy falso", async () => {
  const q = colaDePrueba();
  const cortada = q.cola.requestAndWait(PEDIDO).then(
    () => "resolvió",
    (error: unknown) => (error instanceof Error ? error.message : String(error))
  );
  await cede();
  assert.equal(q.corridas.length, 1, "la action salió y no va a resolver nunca");
  assert.equal(q.cola.busy(), true);

  q.cola.suspend();
  assert.match(await cortada, /LAYERS_REFRESH_UNAVAILABLE/);

  // El ciclo cerrado no tiene trabajo vivo: decir lo contrario dejaría
  // `CALCULANDO…` colgado de una corrida que ya no pertenece a nadie.
  assert.equal(q.cola.busy(), false, "el candado del ciclo cerrado se soltó");
  assert.equal(q.busy.at(-1), false, "y se publicó");

  q.cola.resume();
  assert.equal(q.cola.suspended(), false);
  assert.equal(q.cola.busy(), false, "sin trabajo pedido, el ciclo nuevo arranca quieto");
  assert.equal(q.busy.at(-1), false);
});

test("después de `resume()`, una solicitud pertinente arranca YA aunque A siga colgada", async () => {
  const q = colaDePrueba();
  const cortada = q.cola.requestAndWait(PEDIDO).catch(() => "cortada");
  await cede();
  q.cola.suspend();
  await cortada;
  q.cola.resume();

  let terminado = false;
  const segunda = q.cola.requestAndWait(OTRO).then(() => {
    terminado = true;
  });
  await cede();

  // Ésta es la diferencia con el booleano global: B corre AHORA. Se admite el
  // solapamiento físico entre generaciones —una action Convex que ya salió no se
  // puede cancelar— porque la alternativa es no progresar nunca.
  assert.equal(q.corridas.length, 2, "B arrancó sin esperar a la huérfana");
  assert.deepEqual(q.corridas[1].request, OTRO);
  assert.equal(q.cola.busy(), true, "y el ciclo vivo sí está trabajando");
  assert.equal(terminado, false);

  // Y B resuelve aunque A siga pendiente para siempre.
  q.corridas[1].resolve();
  await segunda;
  assert.equal(terminado, true, "la espera nueva termina con SU solicitud");
  assert.equal(q.cola.busy(), false);
  assert.equal(q.failed.at(-1), false);
});

test("A termina MIENTRAS B corre: no apaga B, no toca `failed` y no resuelve waiters nuevos", async () => {
  const q = colaDePrueba();
  const cortada = q.cola.requestAndWait(PEDIDO).catch(() => "cortada");
  await cede();
  q.cola.suspend();
  await cortada;
  q.cola.resume();

  let terminado = false;
  const segunda = q.cola.requestAndWait(OTRO).then(() => {
    terminado = true;
  });
  await cede();
  assert.equal(q.corridas.length, 2);
  q.busy.length = 0;
  q.failed.length = 0;

  // La huérfana termina, bien y mal, con B todavía en vuelo.
  q.corridas[0].resolve();
  await cede();
  await cede();

  assert.deepEqual(q.busy, [], "no apagó el hilandero del ciclo nuevo");
  assert.deepEqual(q.failed, [], "ni tocó el aviso de fallo");
  assert.equal(q.cola.busy(), true, "B sigue siendo la dueña del ciclo vivo");
  assert.equal(q.cola.waiting(), 1, "y su espera sigue abierta");
  assert.equal(terminado, false, "la completion de A no resuelve la espera de B");

  q.corridas[1].resolve();
  await segunda;
  assert.equal(terminado, true);
  assert.equal(q.cola.busy(), false);
});

test("A termina DESPUÉS de B: tampoco reanima nada del ciclo nuevo", async () => {
  const q = colaDePrueba();
  const cortada = q.cola.requestAndWait(PEDIDO).catch(() => "cortada");
  await cede();
  q.cola.suspend();
  await cortada;
  q.cola.resume();

  const segunda = q.cola.requestAndWait(OTRO);
  await cede();
  q.corridas[1].resolve();
  await segunda;
  assert.equal(q.cola.busy(), false);
  q.busy.length = 0;
  q.failed.length = 0;

  // Y recién ahora se cae la huérfana.
  q.corridas[0].reject(new Error("tarde y mal"));
  await cede();
  await cede();

  assert.deepEqual(q.failed, [], "un rechazo huérfano no enciende el aviso");
  assert.deepEqual(q.busy, [], "ni reanima el hilandero");
  assert.equal(q.cola.busy(), false);
  assert.equal(q.corridas.length, 2, "y no largó ningún reintento");
});

test("una acción por generación viva; la física huérfana de la anterior puede convivir", async () => {
  const q = colaDePrueba();
  /** Cuántas acciones físicas hay vivas, contando la de la generación cerrada. */
  let fisicasVivas = 0;
  let maximoFisicas = 0;
  const salir = () => {
    fisicasVivas -= 1;
  };
  const entrar = () => {
    fisicasVivas += 1;
    maximoFisicas = Math.max(maximoFisicas, fisicasVivas);
  };

  const cortada = q.cola.requestAndWait(PEDIDO).catch(() => "cortada");
  entrar();
  await cede();
  q.cola.suspend();
  await cortada;
  q.cola.resume();

  const segunda = q.cola.requestAndWait(OTRO);
  entrar();
  await cede();
  assert.equal(q.corridas.length, 2);

  // Dentro de la generación viva, pedir más cosas NO abre otra action.
  q.cola.request(TERCERO);
  q.cola.request(PEDIDO);
  await cede();
  assert.equal(q.corridas.length, 2, "single-flight intacto dentro de la generación viva");
  assert.deepEqual(q.cola.pending(), PEDIDO, "lo nuevo espera turno, como siempre");

  // Y lo que el diseño NO promete: que no haya dos acciones FÍSICAS a la vez.
  assert.equal(maximoFisicas, 2, "la huérfana de la generación cerrada sigue viva, y se dice");

  q.corridas[0].resolve();
  salir();
  q.corridas[1].resolve();
  salir();
  await cede();
  entrar();
  assert.equal(q.corridas.length, 3, "el turno siguiente del ciclo vivo");
  q.corridas[2].resolve();
  salir();
  await cede();
  assert.equal(q.cola.busy(), false);
  assert.equal(fisicasVivas, 0);
});

test("lo pendiente que nunca salió se retoma UNA sola vez al reanudar", async () => {
  const q = colaDePrueba();
  q.cola.request(PEDIDO);
  q.cola.request(OTRO);
  assert.equal(q.corridas.length, 1, "PEDIDO en vuelo, OTRO esperando turno");

  q.cola.suspend();
  assert.deepEqual(q.cola.pending(), OTRO, "lo que no salió sobrevive");

  q.cola.resume();
  await cede();
  assert.equal(q.corridas.length, 2, "se retoma…");
  assert.deepEqual(q.corridas[1].request, OTRO);
  assert.equal(q.cola.pending(), null, "…y deja de estar pendiente");

  // Reanudar de nuevo no lo vuelve a largar.
  q.cola.resume();
  await cede();
  assert.equal(q.corridas.length, 2, "una sola vez");

  q.corridas[1].resolve();
  await cede();
  assert.equal(q.corridas.length, 2);
  assert.equal(q.cola.busy(), false);
});

test("lo pendiente sobrevive al desmonte y `resume()` lo retoma sin waiters huérfanos", async () => {
  const q = colaDePrueba();
  q.cola.request(PEDIDO);
  const cortada = q.cola.requestAndWait(OTRO).catch(() => "cortada");
  q.cola.suspend();
  await cortada;

  assert.deepEqual(q.cola.pending(), OTRO, "el trabajo no se pierde");
  assert.equal(q.cola.waiting(), 0, "pero su waiter ya terminó");

  q.cola.resume();
  q.corridas[0].resolve();
  await cede();
  assert.equal(q.corridas.length, 2, "se retoma lo pendiente");
  assert.deepEqual(q.corridas[1].request, OTRO);
  q.corridas[1].resolve();
  await cede();
  assert.equal(q.cola.busy(), false);
});

test("estando suspendida, una espera nueva rechaza en el acto", async () => {
  const q = colaDePrueba();
  q.cola.suspend();
  await assert.rejects(q.cola.requestAndWait(PEDIDO), /LAYERS_REFRESH_UNAVAILABLE/);
  assert.equal(q.corridas.length, 0, "y no se larga ninguna action");
});

// ---------------------------------------------------------------------------
// 6 · el presupuesto de reintentos es DEL TRABAJO (P1-D)
//
// El defecto: `reintentos` era global a la cola. Si A gastaba el presupuesto y B
// llegaba mientras A dormía su backoff, B esperaba el resto de esa espera y su
// primer fallo se contaba como intento 4 — sin ningún reintento propio.
// ---------------------------------------------------------------------------

test("una solicitud más nueva no espera el backoff de la anterior y arranca con su presupuesto entero", async () => {
  const q = colaDePrueba({ sleepManual: true });
  q.cola.request(PEDIDO);

  // A se cae con la carrera del alta y entra en backoff: la espera queda
  // SUSPENDIDA, así que si B la respetara no correría nunca.
  q.corridas[0].reject(new Error(`Server Error ${LAYER_RACE_ERROR}`));
  await cede();
  await cede();
  assert.deepEqual(q.esperas, [1500], "A entró en su primer backoff");
  assert.equal(q.dormidas.length, 1, "y está durmiendo");
  assert.equal(q.corridas.length, 1, "todavía no volvió a correr");

  // Llega B mientras A duerme.
  q.cola.request(OTRO);
  await cede();
  await cede();

  assert.equal(q.dormidas[0].ms, 1500);
  assert.equal(q.corridas.length, 2, "B corre enseguida, sin esperar el resto del backoff de A");
  assert.deepEqual(q.corridas[1].request, OTRO, "y es B la que corre, no el reintento de A");

  // Y B tiene su propio presupuesto COMPLETO: tres reintentos crecientes.
  const carrera = () => new Error(`Server Error ${LAYER_RACE_ERROR}`);
  for (let intento = 0; intento < 3; intento += 1) {
    q.corridas[q.corridas.length - 1].reject(carrera());
    await cede();
    await cede();
    q.dormidas[q.dormidas.length - 1].despertar();
    await cede();
    await cede();
  }
  assert.deepEqual(
    q.esperas,
    [1500, 1500, 4500, 9000],
    "el 1500 de A, y después el presupuesto entero de B"
  );
  assert.equal(q.corridas.length, 5, "B corrió una vez y se reintentó tres");
  for (const corrida of q.corridas.slice(1)) {
    assert.deepEqual(corrida.request, OTRO, "todas las corridas de B son de B");
  }

  // El cuarto fallo de B sí agota su crédito.
  q.corridas[4].reject(carrera());
  await cede();
  await cede();
  assert.equal(q.corridas.length, 5, "y no hay una sexta");
  assert.equal(q.failed.at(-1), true, "agotado el crédito, se dice");
});

test("los waiters de A y de B terminan exactamente una vez, con el resultado del trabajo vigente", async () => {
  const q = colaDePrueba({ sleepManual: true });
  const desenlaces: string[] = [];
  const contar = (etiqueta: string) => (promesa: Promise<void>) =>
    promesa.then(
      () => desenlaces.push(`${etiqueta}:ok`),
      (error: unknown) => desenlaces.push(`${etiqueta}:${error instanceof Error ? error.message : String(error)}`)
    );

  const esperaA = contar("A")(q.cola.requestAndWait(PEDIDO));
  q.corridas[0].reject(new Error(`Server Error ${LAYER_RACE_ERROR}`));
  await cede();
  await cede();
  assert.equal(q.dormidas.length, 1, "A está en backoff, con su waiter todavía abierto");
  assert.equal(q.cola.waiting(), 1);

  const esperaB = contar("B")(q.cola.requestAndWait(OTRO));
  await cede();
  await cede();
  assert.equal(q.corridas.length, 2, "una sola action viva en cada momento");
  assert.equal(q.cola.waiting(), 2, "los dos esperan al trabajo vigente");

  q.corridas[1].resolve();
  await Promise.all([esperaA, esperaB]);
  assert.deepEqual(desenlaces.sort(), ["A:ok", "B:ok"], "los dos terminan, una sola vez cada uno");
  assert.equal(q.cola.waiting(), 0);
  assert.equal(q.cola.busy(), false);
  assert.equal(q.failed.at(-1), false);
});

test("dentro de una generación viva nunca hay más de una action, ni con reintentos ni con esperas", async () => {
  const q = colaDePrueba({ sleepManual: true });
  let vivas = 0;
  let maximo = 0;
  const observar = () => {
    maximo = Math.max(maximo, vivas);
  };

  q.cola.request(PEDIDO);
  vivas += 1;
  observar();
  q.cola.request(OTRO);
  void q.cola.requestAndWait(TERCERO).catch(() => undefined);
  observar();
  assert.equal(q.corridas.length, 1);

  q.corridas[0].reject(new Error(`Server Error ${LAYER_RACE_ERROR}`));
  vivas -= 1;
  await cede();
  await cede();
  // Había algo más nuevo, así que corre eso y no el reintento.
  assert.equal(q.corridas.length, 2);
  vivas += 1;
  observar();

  q.cola.request(PEDIDO);
  observar();
  assert.equal(q.corridas.length, 2, "lo nuevo espera turno");

  q.corridas[1].resolve();
  vivas -= 1;
  await cede();
  vivas += 1;
  observar();
  assert.equal(q.corridas.length, 3);
  q.corridas[2].resolve();
  vivas -= 1;
  await cede();
  assert.equal(q.corridas.length, 3);
  assert.equal(maximo, 1, "el single-flight no se rompe en ningún momento");
});

// ---------------------------------------------------------------------------
// 7 · el pedido del ciclo cerrado no se pierde (P1-D del décimo pase)
//
// Lo que ya SALIÓ no vuelve a la cola: su efecto se descartó al cerrar la
// generación, así que el ciclo nuevo necesita pedirlo otra vez. Quien lo pide es
// el consumidor —`useLayers` borra la clave del último pedido admitido en el
// cleanup—; sin eso, el doble montaje de StrictMode perdía el primer refresh:
// el ciclo nuevo creía que ya lo había pedido y la cola no tenía nada pendiente.
// ---------------------------------------------------------------------------

test("lo que ya salió no se reencola solo: `resume()` no lo repite por su cuenta", async () => {
  const q = colaDePrueba();
  q.cola.request(PEDIDO);
  assert.equal(q.corridas.length, 1, "salió");
  assert.equal(q.cola.pending(), null, "y por eso dejó de estar pendiente");

  q.cola.suspend();
  assert.equal(q.cola.pending(), null, "la cola no lo inventa de nuevo");

  q.cola.resume();
  await cede();
  assert.equal(q.corridas.length, 1, "`resume()` sólo retoma lo que nunca salió");
});

// ---------------------------------------------------------------------------
// 8 · la costura: cola + clave del último pedido admitido (P1-B del undécimo)
//
// El defecto no vivía en ninguna de las dos mitades: vivía JUSTO EN EL MEDIO. El
// cleanup llamaba `suspend()` —que CONSERVA lo pendiente— y además borraba la
// clave, así que al volver a montar la cola retomaba B y el efecto, viendo la
// clave en blanco, volvía a encolar exactamente la misma B: secuencia física
// A/B/B. Y si la B retomada salía bien y el duplicado fallaba, `refreshFailed`
// terminaba en `true` sobre datos frescos.
//
// La costura ahora vive en `src/domain/refreshCycle.ts`, así que se corre de
// verdad —con la cola real— en vez de buscar líneas en el hook. La prueba de
// forma que había acá quedó reemplazada por estas cuatro conductuales más el
// cableado del hook, que es estrictamente más de lo que verificaba antes.
// ---------------------------------------------------------------------------

/** Las claves del efecto del reloj: `cuenta|día|zona|hora civil|intento`. */
const CLAVE_A = "cuenta|2026-08-17|UTC|2026-08-17T23|0";
const CLAVE_B = "cuenta|2026-08-18|UTC|2026-08-18T00|0";
const CLAVE_C = "cuenta|2026-08-19|UTC|2026-08-19T00|0";

/** La política pura, sin cola: la clave sobrevive si su pedido sobrevive. */
test("la clave del pedido sobrevive exactamente cuando queda algo pendiente", () => {
  assert.equal(claveTrasCerrar(CLAVE_B, OTRO), CLAVE_B, "hay pendiente: el ciclo nuevo lo retoma solo");
  assert.equal(claveTrasCerrar(CLAVE_A, null), null, "no quedó nada: hay que volver a pedirlo");
  assert.equal(claveTrasCerrar(null, OTRO), null, "sin clave previa no se inventa ninguna");
});

test("A en vuelo y B pendiente: el remonte con la MISMA clave corre A/B, no A/B/B", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);

  // Montaje: el efecto del reloj pide A, que sale enseguida.
  ciclo.abrir();
  ciclo.pedir(CLAVE_A, PEDIDO);
  assert.equal(q.corridas.length, 1, "A salió");
  // Cruce de medianoche: B queda como la única pendiente, detrás de A.
  ciclo.pedir(CLAVE_B, OTRO);
  assert.deepEqual(q.cola.pending(), OTRO);

  // Desmonte y remonte con el mismo reloj: el efecto vuelve a correr con B.
  ciclo.cerrar();
  assert.equal(ciclo.clave(), CLAVE_B, "la clave sobrevive porque su pedido sobrevive");
  ciclo.abrir();
  ciclo.pedir(CLAVE_B, { ...OTRO });
  await cede();

  assert.deepEqual(
    q.corridas.map((corrida) => corrida.request),
    [PEDIDO, OTRO],
    "la secuencia física es A/B: la B retomada no se duplica"
  );

  // Y cuando B termina, no queda nada más esperando turno.
  q.corridas[1].resolve();
  await cede();
  assert.equal(q.corridas.length, 2, "ninguna corrida de más");
  assert.equal(q.cola.pending(), null);
  assert.equal(q.cola.busy(), false);
});

test("A en vuelo y nada pendiente: el ciclo nuevo vuelve a pedir A exactamente una vez", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);

  ciclo.abrir();
  ciclo.pedir(CLAVE_A, PEDIDO);
  assert.equal(q.cola.pending(), null, "A ya salió: no quedó nada esperando turno");

  // Su corrida queda huérfana al cerrar, así que el ciclo nuevo tiene que
  // volver a pedirla: es el primer refresh del doble montaje de StrictMode.
  ciclo.cerrar();
  assert.equal(ciclo.clave(), null, "sin pendiente, la clave se borra");
  ciclo.abrir();
  ciclo.pedir(CLAVE_A, { ...PEDIDO });
  await cede();
  assert.equal(q.corridas.length, 2, "el ciclo nuevo pide A de nuevo…");

  // …y el efecto que vuelve a correr con la misma clave no la repite.
  ciclo.pedir(CLAVE_A, { ...PEDIDO });
  await cede();
  assert.equal(q.corridas.length, 2, "…una sola vez");
  assert.equal(q.cola.pending(), null);
});

test("B pendiente y el reloj ya cambió a C: B se retoma, C queda como la única siguiente", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);

  ciclo.abrir();
  ciclo.pedir(CLAVE_A, PEDIDO);
  ciclo.pedir(CLAVE_B, OTRO);
  ciclo.cerrar();

  // El montaje nuevo llega con otro día civil: clave distinta, pedido distinto.
  ciclo.abrir();
  await cede();
  assert.deepEqual(q.corridas[1]?.request, OTRO, "B se retoma sola");
  ciclo.pedir(CLAVE_C, TERCERO);
  assert.deepEqual(q.cola.pending(), TERCERO, "y C queda como la única pendiente");

  q.corridas[1].resolve();
  await cede();
  assert.deepEqual(
    q.corridas.map((corrida) => corrida.request),
    [PEDIDO, OTRO, TERCERO],
    "cada una corrió una sola vez"
  );

  q.corridas[2].resolve();
  await cede();
  assert.equal(q.corridas.length, 3, "y nada vuelve a salir");
  assert.equal(q.cola.pending(), null);
});

test("la B retomada sale bien y no queda ningún duplicado que pueda decir que falló", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);

  ciclo.abrir();
  ciclo.pedir(CLAVE_A, PEDIDO);
  ciclo.pedir(CLAVE_B, OTRO);
  ciclo.cerrar();
  ciclo.abrir();
  ciclo.pedir(CLAVE_B, { ...OTRO });
  await cede();

  // La B retomada sale BIEN: el sobre del día quedó recalculado.
  assert.equal(q.corridas.length, 2);
  q.corridas[1].resolve();
  await cede();

  // Acá vivía el defecto: el duplicado corría después del éxito y, si fallaba,
  // dejaba `refreshFailed` en true sobre datos recién calculados. Si existiera,
  // sería `corridas[2]` y este rechazo encendería el aviso.
  (q.corridas[2] as Diferida | undefined)?.reject(new Error("el duplicado que no debería existir"));
  await cede();
  await cede();

  assert.equal(q.corridas.length, 2, "no hay duplicado que pueda fallar");
  assert.deepEqual(q.failed, [false], "el único evento de fallo es el apagado del éxito de B");
  assert.equal(q.cola.busy(), false);
});

test("`useLayers` delega la costura entera en el ciclo, sin copiar la clave", () => {
  const hook = sinComentarios(leer("src/hooks/useLayers.tsx"));

  // La política y el interleaving se prueban arriba, corriendo. Del hook sólo
  // queda por verificar el cableado: que use ESTE ciclo y no una copia propia.
  assert.match(hook, /createRefreshCycle\(/, "la costura es la compartida");
  assert.match(hook, /createRefreshQueue\(/, "sobre la cola compartida");
  assert.match(hook, /ciclo\.abrir\(\);/, "el montaje retoma lo pendiente");
  assert.match(hook, /ciclo\.cerrar\(\);/, "el cleanup cierra el ciclo y decide la clave");
  assert.match(hook, /ciclo\.pedir\(key, \{/, "y el efecto del reloj pide por clave");
  assert.match(hook, /ciclo\.pedirYEsperar\(/, "el reintento esperable entra por la misma costura");
  assert.doesNotMatch(
    hook,
    /requested\.current/,
    "no queda ninguna copia de la clave fuera del ciclo: era la mitad del defecto"
  );

  // Y el cableado del INTENTO, que es el P1 del decimotercer pase. Lo que se
  // verifica acá es que el hook no pueda volver a armar un alcance viejo:
  // la clave sale del armador compartido y el nonce sale del ciclo.
  assert.match(hook, /claveDeAlcance\(\{/, "la clave se arma con el armador compartido");
  assert.doesNotMatch(
    hook,
    /\$\{accountKey\}\|/,
    "ya no hay una plantilla de clave copiada a mano en el hook"
  );
  assert.match(
    hook,
    /intento: ciclo\.intento\(\)/,
    "el efecto del reloj arma la clave con el intento VIGENTE del ciclo"
  );
  assert.doesNotMatch(
    hook,
    /intento: intentoEspejo/,
    "el espejo de React nunca arma la clave: sólo vuelve a disparar el efecto"
  );
  assert.match(
    hook,
    /ciclo\.pedirYEsperar\(\s*\(intento\) =>/,
    "la vía forzada recibe el intento RESERVADO por el ciclo, no uno que ella elija"
  );
  // Las DOS vías que fuerzan un alcance nuevo sin esperar —el botón de reintento
  // y el regreso del background— tienen que reservar por el ciclo. Contar las
  // apariciones es lo que hace que revertir UNA sola se note: con un `match` a
  // secas, la otra tapaba el agujero.
  const reservas = [...hook.matchAll(/setIntentoEspejo\(ciclo\.reservarIntento\(\)\)/g)].length;
  assert.equal(reservas, 2, "el botón y el regreso del background reservan por el ciclo, los dos");
  assert.doesNotMatch(
    hook,
    /setIntentoEspejo\(\(/,
    "ningún updater de React fabrica el nonce: el contador no vuelve a vivir en el hook"
  );
  assert.doesNotMatch(
    hook,
    /setAttempt\(/,
    "no queda ningún contador de intentos propio del hook: era la fuente del defecto"
  );
});

// ---------------------------------------------------------------------------
// 9 · `busy` describe al ciclo VIVO, nunca a uno suspendido (P2-A del undécimo)
//
// `encolar()` publicaba `onBusyChange(true)` aunque la cola estuviera
// suspendida: `CALCULANDO…` se encendía por trabajo que ningún ciclo vivo estaba
// haciendo —la generación cerrada ya no trabaja, y la nueva todavía no existe—.
// ---------------------------------------------------------------------------

test("una solicitud durante la suspensión se acepta, pero no enciende `CALCULANDO…`", async () => {
  const q = colaDePrueba();
  q.cola.suspend();
  q.busy.length = 0;
  q.failed.length = 0;

  q.cola.request(PEDIDO);
  await cede();
  assert.deepEqual(q.cola.pending(), PEDIDO, "la solicitud se conserva");
  assert.equal(q.cola.suspended(), true);
  assert.equal(q.cola.busy(), false, "pero no hay trabajo vivo");
  assert.deepEqual(q.busy, [], "y no se publicó ni un solo `true`");
  assert.deepEqual(q.failed, [], "ni nada sobre fallos");
  assert.equal(q.corridas.length, 0, "ninguna action salió");

  q.cola.resume();
  await cede();
  assert.equal(q.corridas.length, 1, "al reanudar corre, una vez");
  assert.deepEqual(q.busy, [true], "y recién ahí se enciende, una sola vez");

  q.corridas[0].resolve();
  await cede();
  assert.deepEqual(q.busy, [true, false], "y se apaga al terminar");
});

test("dos solicitudes durante la suspensión: se conserva y corre sólo la última", async () => {
  const q = colaDePrueba();
  q.cola.suspend();
  q.busy.length = 0;

  q.cola.request(PEDIDO);
  q.cola.request(OTRO);
  assert.deepEqual(q.busy, [], "la más reciente gana sin publicar nada");
  assert.deepEqual(q.cola.pending(), OTRO);

  q.cola.resume();
  await cede();
  assert.equal(q.corridas.length, 1, "una sola corrida");
  assert.deepEqual(q.corridas[0].request, OTRO);
});

test("`resume()` sincroniza el flag con el trabajo real del ciclo vivo", () => {
  const q = colaDePrueba();
  q.cola.request(PEDIDO);
  assert.deepEqual(q.busy, [true], "A salió y el flag se encendió");

  q.cola.suspend();
  assert.deepEqual(q.busy, [true, false], "el ciclo cerrado no tiene trabajo vivo");

  // Sin nada pendiente, el ciclo nuevo arranca quieto: el flag se sincroniza en
  // `false` en vez de quedar colgado de lo que hubiera publicado último.
  q.cola.resume();
  assert.deepEqual(q.busy, [true, false, false]);
  assert.equal(q.cola.busy(), false);
});

// ---------------------------------------------------------------------------
// 10 · liveness: la solicitud pertinente MÁS NUEVA progresa aunque una action
//      anterior no termine nunca (P1-A del duodécimo pase)
//
// El defecto: `drain()` estaba parado en `await deps.run(A)`. Si A no resolvía
// —la red cortada a mitad de la action— todo lo que llegara después quedaba
// `pending` PARA SIEMPRE, aunque tuviera otro alcance y la corrida vieja ya no
// pudiera servirle a nadie: `busy` en `true`, `CALCULANDO…` permanente, y volver
// de background sólo movía el reloj y el intento sin destrabar nada.
//
// La regla que faltaba: una corrida cuyo alcance dejó de ser el vigente no puede
// seguir siendo dueña del ciclo. La cola la RELEVA —cierra su generación, la deja
// huérfana y sin efectos— y arranca la pertinente. El disparador es el cambio de
// alcance, no el paso del tiempo: no hay ningún temporizador, y por eso todo esto
// se prueba por comportamiento.
// ---------------------------------------------------------------------------

test("A colgada + B + C con otra clave: C arranca sin esperar a A, y B se descarta como intermedia", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);

  ciclo.abrir();
  ciclo.pedir(CLAVE_A, PEDIDO);
  assert.equal(q.corridas.length, 1, "A salió y no va a resolver NUNCA");

  // Cruce de medianoche y, enseguida, otro cambio de alcance en la misma ráfaga.
  ciclo.pedir(CLAVE_B, OTRO);
  ciclo.pedir(CLAVE_C, TERCERO);
  assert.equal(q.corridas.length, 1, "el relevo se decide al final del tick, no en el acto");
  assert.deepEqual(q.cola.pending(), TERCERO, "y para entonces la pendiente ya es la más nueva");

  await cede();

  // Acá vivía el cuelgue: antes esto era `[PEDIDO]` y C no arrancaba nunca.
  assert.deepEqual(
    q.corridas.map((corrida) => corrida.request),
    [PEDIDO, TERCERO],
    "la secuencia física es A/C: B se descarta como intermedia y A queda huérfana"
  );
  assert.equal(q.cola.pending(), null, "no queda nada esperando a una action colgada");
  assert.equal(q.cola.busy(), true, "y el hilandero describe trabajo que de verdad está corriendo");

  // Y C termina aunque A no resuelva jamás.
  q.corridas[1].resolve();
  await cede();
  assert.equal(q.cola.busy(), false, "`CALCULANDO…` se apaga porque el trabajo REAL terminó");
  assert.equal(q.busy.at(-1), false);
  assert.equal(q.failed.at(-1), false, "y el día quedó recalculado, sin aviso de fallo");
});

test("A termina MIENTRAS C corre: no apaga el hilandero, no toca `failed` y no resuelve a nadie", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();

  let terminado = false;
  const esperaA = ciclo.pedirYEsperar(() => CLAVE_A, PEDIDO).then(() => {
    terminado = true;
  });
  await cede();
  assert.equal(q.corridas.length, 1);

  ciclo.pedir(CLAVE_C, TERCERO);
  await cede();
  assert.equal(q.corridas.length, 2, "C arrancó sin esperar a A");
  q.busy.length = 0;
  q.failed.length = 0;

  // La relevada termina —bien— con C todavía en vuelo.
  q.corridas[0].resolve();
  await cede();
  await cede();

  assert.deepEqual(q.busy, [], "no apagó el hilandero del ciclo vigente");
  assert.deepEqual(q.failed, [], "ni tocó el aviso de fallo");
  assert.equal(q.cola.busy(), true, "C sigue siendo la dueña del ciclo vivo");
  assert.equal(terminado, false, "la completion de A no resuelve la espera");
  assert.equal(q.cola.waiting(), 1, "que sigue abierta, transferida al trabajo vigente");

  q.corridas[1].resolve();
  await esperaA;
  assert.equal(terminado, true, "y termina con el refresco que SÍ corrió");
  assert.equal(q.cola.busy(), false);
  assert.equal(q.failed.at(-1), false);
});

test("C sale bien y A falla DESPUÉS: `refreshFailed` termina en false", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();
  ciclo.pedir(CLAVE_A, PEDIDO);
  ciclo.pedir(CLAVE_C, TERCERO);
  await cede();
  assert.equal(q.corridas.length, 2);

  q.corridas[1].resolve();
  await cede();
  assert.equal(q.failed.at(-1), false, "el día se recalculó");
  assert.equal(q.cola.busy(), false);

  // Y recién ahora se cae la relevada, con un error REAL —no la carrera del alta—.
  q.corridas[0].reject(new Error("la que quedó colgada, tarde y mal"));
  await cede();
  await cede();

  assert.deepEqual(q.failed, [false], "una huérfana no puede encender el aviso sobre datos frescos");
  assert.equal(q.corridas.length, 2, "ni largar un reintento propio");
  assert.equal(q.cola.busy(), false);
});

test("cada eje del alcance releva a la corrida colgada: cuenta, día, zona, hora civil e intento", async () => {
  // Los cinco ejes de la clave del efecto del reloj. Mover cualquiera hace que lo
  // que está en vuelo deje de poder servir, así que la solicitud nueva no lo
  // espera. No se mezcla estado entre alcances: cada uno corre lo suyo.
  const ejes: Array<[string, string, RefreshRequest]> = [
    ["cuenta", "otra-cuenta|2026-08-17|UTC|2026-08-17T23|0", { ...PEDIDO }],
    ["día civil", CLAVE_B, OTRO],
    [
      "zona",
      "cuenta|2026-08-17|America/Argentina/Buenos_Aires|2026-08-17T20|0",
      { localDate: "2026-08-17", timezone: "America/Argentina/Buenos_Aires" }
    ],
    ["hora civil", "cuenta|2026-08-17|UTC|2026-08-18T00|0", { ...PEDIDO }],
    ["intento", "cuenta|2026-08-17|UTC|2026-08-17T23|1", { ...PEDIDO }]
  ];

  for (const [eje, clave, request] of ejes) {
    const q = colaDePrueba();
    const ciclo = createRefreshCycle(q.cola);
    ciclo.abrir();
    ciclo.pedir(CLAVE_A, PEDIDO);
    assert.equal(q.corridas.length, 1, `${eje}: A salió y queda colgada`);

    ciclo.pedir(clave, request);
    await cede();

    assert.equal(q.corridas.length, 2, `${eje}: la solicitud pertinente no espera a A`);
    assert.deepEqual(q.corridas[1].request, request, `${eje}: y corre exactamente lo que se pidió`);
    q.corridas[1].resolve();
    await cede();
    assert.equal(q.cola.busy(), false, `${eje}: el hilandero se apaga con el trabajo vigente`);
  }
});

test("volver de background destraba un refresco colgado: alcanza con que suba el intento", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  const clavePara = (intento: number) => `cuenta|2026-08-17|UTC|2026-08-17T23|${intento}`;

  ciclo.abrir();
  ciclo.pedir(clavePara(0), PEDIDO);
  assert.equal(q.corridas.length, 1, "el refresco del montaje salió y quedó colgado");
  assert.equal(q.cola.busy(), true, "`CALCULANDO…` encendido");

  // La app vuelve al frente. `syncClock()` no mueve nada —misma hora civil— y lo
  // único que cambia es el intento. Antes eso no rotaba nada y la pantalla se
  // quedaba calculando para siempre.
  ciclo.pedir(clavePara(1), { ...PEDIDO });
  await cede();

  assert.equal(q.corridas.length, 2, "el refresco vigente arranca sin esperar a la colgada");
  assert.deepEqual(q.corridas[1].request, PEDIDO);
  q.corridas[1].resolve();
  await cede();
  assert.equal(q.cola.busy(), false, "y `CALCULANDO…` se apaga con datos de verdad");
  assert.equal(q.failed.at(-1), false);
});

test("una clave idéntica no releva nada ni duplica trabajo", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();
  ciclo.pedir(CLAVE_A, PEDIDO);

  // El efecto vuelve a correr sin que cambie ningún eje: mismo alcance.
  ciclo.pedir(CLAVE_A, { ...PEDIDO });
  ciclo.pedir(CLAVE_A, { ...PEDIDO });
  await cede();
  await cede();
  assert.equal(q.corridas.length, 1, "ni una action de más");
  assert.equal(q.cola.pending(), null, "ni nada esperando turno");
  assert.equal(q.cola.busy(), true, "la corrida de siempre sigue siendo la vigente");

  // Y por la vía cruda, con el MISMO alcance, tampoco releva: lo que está en
  // vuelo es exactamente el trabajo que se está pidiendo.
  q.cola.request({ ...PEDIDO }, CLAVE_A);
  await cede();
  await cede();
  assert.equal(q.corridas.length, 1, "el mismo alcance espera turno, no releva");
  assert.deepEqual(q.cola.pending(), PEDIDO);
});

test("el relevo deja UNA action del ciclo vigente y exactamente UNA huérfana física", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();

  let resueltas = 0;
  /** Acciones físicas todavía sin resolver, contando la huérfana. */
  const vivasFisicas = () => q.corridas.length - resueltas;

  ciclo.pedir(CLAVE_A, PEDIDO);
  assert.equal(q.cola.scope(), CLAVE_A, "la corrida viva declara el alcance con el que se pidió");
  ciclo.pedir(CLAVE_B, OTRO);
  await cede();
  assert.equal(q.corridas.length, 2);
  assert.equal(q.cola.scope(), CLAVE_B, "y tras el relevo, el alcance vivo es el de la corrida nueva");
  assert.equal(vivasFisicas(), 2, "la relevada sigue físicamente viva: no se puede cancelar, y se dice");

  // Dentro de la generación NUEVA vale el single-flight de siempre.
  ciclo.pedir(CLAVE_B, { ...OTRO });
  await cede();
  assert.equal(q.corridas.length, 2, "single-flight intacto dentro de la generación viva");

  // Y la huérfana, al caer, no toca nada del ciclo vigente.
  q.corridas[0].reject(new Error("la relevada, tarde y mal"));
  resueltas += 1;
  await cede();
  await cede();
  assert.deepEqual(q.failed, [], "ni un aviso de fallo");
  assert.equal(q.cola.busy(), true, "y el ciclo vigente sigue trabajando");

  q.corridas[1].resolve();
  resueltas += 1;
  await cede();
  assert.equal(q.corridas.length, 2, "ninguna corrida de más");
  assert.equal(vivasFisicas(), 0);
  assert.equal(q.cola.busy(), false);
  assert.equal(q.cola.scope(), null, "sin corrida viva no hay alcance vigente que declarar");
  assert.deepEqual(q.failed, [false], "el único evento es el éxito del trabajo vigente");
});

test("sin alcance declarado la cola no releva: la política de siempre queda intacta", async () => {
  const q = colaDePrueba();
  // La cola no inventa pertinencia. Si quien pide no declara alcance —o la
  // corrida viva no tenía ninguno—, no hay forma de saber si el trabajo nuevo
  // reemplaza al viejo o simplemente lo sigue.
  q.cola.request(PEDIDO);
  q.cola.request(OTRO, "una-clave-nueva");
  await cede();
  await cede();
  assert.equal(q.corridas.length, 1, "sin alcance en la corrida viva no se releva nada");
  assert.deepEqual(q.cola.pending(), OTRO, "OTRO espera turno, como siempre");

  q.corridas[0].resolve();
  await cede();
  assert.equal(q.corridas.length, 2, "y corre al terminar la anterior");
});

test("el relevo no es un temporizador: sin una solicitud pertinente más nueva no releva nada", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();
  // `abrir()` sincroniza el flag en `false` (no hay trabajo todavía); lo que se
  // mira acá es lo que se publica DESPUÉS de que la corrida arranque.
  q.busy.length = 0;
  ciclo.pedir(CLAVE_A, PEDIDO);

  // Pasan todos los turnos del bucle de eventos que se quieran. Sin un alcance
  // nuevo, la corrida sigue siendo la vigente y `CALCULANDO…` sigue describiendo
  // trabajo real: apagar el hilandero acá sería el consuelo cosmético que
  // esconde una cola bloqueada.
  for (let turno = 0; turno < 5; turno += 1) await cede();

  assert.equal(q.corridas.length, 1, "no se larga una segunda action por el mero paso del tiempo");
  assert.equal(q.cola.busy(), true, "el hilandero describe la corrida que SÍ está viva");
  assert.deepEqual(q.busy, [true], "y no se publicó ningún apagado de consuelo");
});

test("la espera atada a la corrida relevada la termina el trabajo vigente, una sola vez", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();

  const desenlaces: string[] = [];
  const contar = (etiqueta: string) => (promesa: Promise<void>) =>
    promesa.then(
      () => desenlaces.push(`${etiqueta}:ok`),
      (error: unknown) =>
        desenlaces.push(`${etiqueta}:${error instanceof Error ? error.message : String(error)}`)
    );

  const esperaA = contar("A")(ciclo.pedirYEsperar(() => CLAVE_A, PEDIDO));
  await cede();
  assert.equal(q.cola.waiting(), 1);

  const esperaC = contar("C")(ciclo.pedirYEsperar(() => CLAVE_C, TERCERO));
  await cede();
  assert.equal(q.corridas.length, 2, "C corre sin esperar a A");
  assert.equal(q.cola.waiting(), 2, "y las dos esperas quedan atadas al trabajo vigente");
  assert.deepEqual(desenlaces, [], "ninguna terminó todavía");

  q.corridas[1].resolve();
  await Promise.all([esperaA, esperaC]);
  assert.deepEqual(desenlaces.sort(), ["A:ok", "C:ok"], "las dos terminan, una sola vez cada una");
  assert.equal(q.cola.waiting(), 0);
  assert.equal(q.cola.busy(), false);
});

test("un reintento automático conserva su alcance: si SU corrida se cuelga, la pertinente igual releva", async () => {
  const q = colaDePrueba({ sleepManual: true });
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();
  ciclo.pedir(CLAVE_A, PEDIDO);
  assert.equal(q.corridas.length, 1);

  // La carrera del alta: se reintenta sola, y el reintento es EL MISMO trabajo,
  // así que conserva el alcance con el que se pidió.
  q.corridas[0].reject(new Error(`Server Error ${LAYER_RACE_ERROR}`));
  await cede();
  await cede();
  assert.equal(q.dormidas.length, 1, "entró en backoff");
  q.dormidas[0].despertar();
  await cede();
  await cede();
  assert.equal(q.corridas.length, 2, "el reintento salió…");
  assert.deepEqual(q.corridas[1].request, PEDIDO);

  // …y se cuelga. Llega el cruce de medianoche: si el reintento hubiera perdido
  // su alcance, la cola no tendría con qué compararlo y volveríamos al cuelgue.
  ciclo.pedir(CLAVE_B, OTRO);
  await cede();
  assert.equal(q.corridas.length, 3, "el reintento colgado no bloquea al alcance nuevo");
  assert.deepEqual(q.corridas[2].request, OTRO);

  q.corridas[2].resolve();
  await cede();
  assert.equal(q.cola.busy(), false);
  assert.equal(q.failed.at(-1), false);
});

// ---------------------------------------------------------------------------
// 11 · la clave sólo representa pedidos ADMITIDOS (P2-A del duodécimo pase)
//
// `pedirYEsperar` escribía la clave ANTES de llamar a `requestAndWait`, que con
// el ciclo suspendido rechaza en el acto y sin encolar nada. La clave quedaba
// anotada por un pedido que nunca salió, así que al reabrir el efecto la veía
// como propia y se salteaba el refresco: la pantalla se quedaba con el sobre
// viejo y sin nada en vuelo que lo arreglara.
// ---------------------------------------------------------------------------

test("`pedirYEsperar` rechazada por suspensión no envenena la clave: al reabrir, B corre UNA vez", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);

  ciclo.abrir();
  ciclo.pedir(CLAVE_A, PEDIDO);
  assert.equal(q.corridas.length, 1, "A corre");
  assert.equal(ciclo.clave(), CLAVE_A);

  // El árbol se desmonta con A todavía en vuelo: su corrida queda huérfana y no
  // sobrevive nada pendiente, así que la clave se borra.
  ciclo.cerrar();
  assert.equal(ciclo.clave(), null);

  // Y justo ahí alguien toca el reintento esperable.
  await assert.rejects(ciclo.pedirYEsperar(() => CLAVE_B, OTRO), /LAYERS_REFRESH_UNAVAILABLE/);
  assert.equal(q.corridas.length, 1, "no salió ninguna action");
  assert.equal(q.cola.pending(), null, "ni quedó nada esperando turno");
  assert.equal(ciclo.clave(), null, "la clave NO representa un pedido que nunca se admitió");

  // Al reabrir, el efecto pide B: tiene que correr, y exactamente una vez.
  ciclo.abrir();
  ciclo.pedir(CLAVE_B, OTRO);
  await cede();
  assert.equal(q.corridas.length, 2, "B corre…");
  assert.deepEqual(q.corridas[1].request, OTRO);

  ciclo.pedir(CLAVE_B, { ...OTRO });
  await cede();
  assert.equal(q.corridas.length, 2, "…exactamente una vez");
  assert.equal(q.cola.pending(), null);
});

test("`pedirYEsperar` ADMITIDA sí anota la clave: el efecto no vuelve a pedir lo mismo", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();

  const espera = ciclo.pedirYEsperar(() => CLAVE_A, PEDIDO);
  assert.equal(ciclo.clave(), CLAVE_A, "el pedido se admitió: la clave lo representa");
  assert.equal(q.corridas.length, 1);

  ciclo.pedir(CLAVE_A, { ...PEDIDO });
  assert.equal(q.cola.pending(), null, "el efecto con la misma clave no encola nada");

  q.corridas[0].resolve();
  await espera;
  assert.equal(q.corridas.length, 1, "una sola corrida");
  assert.equal(q.cola.busy(), false);
});

test("`accepts()` es exactamente la condición con la que la espera rechaza en el acto", async () => {
  let montado = true;
  const q = colaDePrueba({ alive: () => montado });
  assert.equal(q.cola.accepts(), true);

  q.cola.suspend();
  assert.equal(q.cola.accepts(), false, "ciclo cerrado: no se admite nada");
  await assert.rejects(q.cola.requestAndWait(PEDIDO), /LAYERS_REFRESH_UNAVAILABLE/);

  q.cola.resume();
  assert.equal(q.cola.accepts(), true);

  montado = false;
  assert.equal(q.cola.accepts(), false, "desmontado sin suspender: tampoco");
  await assert.rejects(q.cola.requestAndWait(PEDIDO), /LAYERS_REFRESH_UNAVAILABLE/);
});

// ---------------------------------------------------------------------------
// 12 · el MISMO alcance ya no deja la vía forzada detrás de una action colgada
//      (P1 del decimotercer pase)
//
// El relevo del duodécimo pase cubría el cambio de alcance, y por eso el cuelgue
// seguía vivo justo donde nada cambiaba:
//
// 1. el refresco automático A está en vuelo y no resuelve;
// 2. la recuperación natal termina `recoverNatalChart` y llama `refreshAndWait()`
//    para el MISMO usuario, día, zona y hora;
// 3. el hook armaba la clave con el `attempt` que tenía en la mano —estado de
//    React, que en el mismo tick vale lo mismo—;
// 4. `pedirYEsperar` encolaba esa clave IDÉNTICA;
// 5. la cola sólo releva cuando el alcance cambia: A seguía siendo la dueña, B
//    quedaba `pending` para siempre y el waiter —con el candado natal tomado— no
//    terminaba nunca. `runs=1`, `waiting=1`, `busy=true`, promesa sin resolver.
//
// Y ni siquiera era una deduplicación honesta: si A terminaba alguna vez, recién
// entonces arrancaba una segunda action idéntica.
//
// El arreglo es la RESERVA sincrónica del intento, adentro del ciclo, en el mismo
// instante en que se encola. Se prueba por comportamiento, contando acciones
// físicas y con la action bajo control, no mirando un flag ni un timeout.
// ---------------------------------------------------------------------------

/** El reloj que NO cambia: cuenta, día, zona y hora civil idénticos en todo el bloque. */
const RELOJ = {
  cuenta: "cuenta",
  localDate: "2026-08-17",
  timezone: "UTC",
  civilHour: "2026-08-17T23"
} as const;

/**
 * Exactamente lo que hace el efecto del reloj en `useLayers`: la clave con el
 * intento VIGENTE del ciclo.
 */
const claveVigente = (ciclo: RefreshCycle) => claveDeAlcance({ ...RELOJ, intento: ciclo.intento() });

/**
 * Y exactamente lo que hace `refreshAndWait`: la clave con el intento que el
 * ciclo acaba de RESERVAR. Quien pide no lo elige, lo recibe.
 */
const claveReservada = (intento: number) => claveDeAlcance({ ...RELOJ, intento });

test("la clave/alcance se arma en un solo lugar, y las dos vías producen la misma cadena", () => {
  // El contrato es literal: `cuenta|día|zona|hora|intento`. Si las dos vías no
  // producen la MISMA cadena para los mismos datos, el efecto posterior a una
  // reserva no reconoce el pedido como propio y lo duplica.
  assert.equal(claveDeAlcance({ ...RELOJ, intento: 0 }), "cuenta|2026-08-17|UTC|2026-08-17T23|0");
  assert.equal(claveDeAlcance({ ...RELOJ, intento: 7 }), "cuenta|2026-08-17|UTC|2026-08-17T23|7");
  assert.equal(CLAVE_A, claveDeAlcance({ ...RELOJ, intento: 0 }), "es la misma forma que ya se usaba");

  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  assert.equal(ciclo.intento(), 0, "el contador arranca en cero");
  assert.equal(claveVigente(ciclo), claveReservada(ciclo.intento()), "las dos vías coinciden");
});

test("el intento se RESERVA sincrónicamente: dos reservas nunca dan el mismo nonce", () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);

  // Sin esperar ningún render: el contador avanza en el acto. `setAttempt` no
  // podía hacer esto, y ahí vivía el defecto.
  assert.equal(ciclo.reservarIntento(), 1);
  assert.equal(ciclo.intento(), 1, "y el vigente ya es el reservado, en el mismo tick");
  assert.equal(ciclo.reservarIntento(), 2);
  assert.equal(ciclo.reservarIntento(), 3);
  assert.equal(ciclo.intento(), 3, "monótono: nunca vuelve atrás");
});

test("A colgada del MISMO alcance: `refreshAndWait` reserva y B arranca sin esperarla", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();

  // El refresco automático del reloj. No resuelve NUNCA: la red se cortó a mitad
  // de la action.
  ciclo.pedir(claveVigente(ciclo), PEDIDO);
  assert.equal(q.corridas.length, 1, "A salió");
  const alcanceDeA = ciclo.clave();
  assert.equal(alcanceDeA, claveDeAlcance({ ...RELOJ, intento: 0 }));

  // La recuperación natal terminó de calcular la carta y pide el refresco
  // esperable. Nada del reloj cambió: sin la reserva, esta clave sería IDÉNTICA
  // a la de A y la cola no relevaría nada.
  let terminado = false;
  const espera = ciclo.pedirYEsperar(claveReservada, OTRO).then(() => {
    terminado = true;
  });
  assert.notEqual(ciclo.clave(), alcanceDeA, "la reserva produjo un alcance NUEVO, en el mismo tick");
  assert.equal(ciclo.clave(), claveDeAlcance({ ...RELOJ, intento: 1 }));
  assert.equal(q.corridas.length, 1, "el relevo se decide al final del tick, no en el acto");

  await cede();

  // Acá vivía el cuelgue: antes esto era `1`, con `pending` guardando el mismo
  // pedido, `waiting=1`, `busy=true` y la promesa sin resolver para siempre.
  assert.equal(q.corridas.length, 2, "B arrancó SIN esperar a A");
  assert.deepEqual(q.corridas[1].request, OTRO);
  assert.equal(q.cola.pending(), null, "no queda nada esperando a una action colgada");
  assert.equal(q.cola.busy(), true, "y el hilandero describe trabajo que de verdad corre");
  assert.equal(terminado, false, "la espera sigue abierta porque B todavía no terminó");

  // Y B cierra el ciclo aunque A no resuelva jamás.
  q.corridas[1].resolve();
  await espera;
  assert.equal(terminado, true, "el waiter resuelve con el trabajo que SÍ corrió");
  assert.equal(q.cola.busy(), false);
  assert.equal(q.busy.at(-1), false, "`CALCULANDO…` se apaga");
  assert.equal(q.failed.at(-1), false, "y sin aviso de fallo");
  assert.equal(q.cola.waiting(), 0, "ninguna espera queda colgada");
});

test("el efecto posterior a la reserva NO vuelve a encolar B: la clave ya es propia", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();

  ciclo.pedir(claveVigente(ciclo), PEDIDO);
  const espera = ciclo.pedirYEsperar(claveReservada, OTRO);
  await cede();
  assert.equal(q.corridas.length, 2, "A huérfana, B corriendo");

  // El render que sigue a la reserva: el efecto del reloj vuelve a correr con el
  // MISMO reloj y el intento vigente del ciclo, que ya es el reservado. Si acá
  // se encolara, la reserva habría cambiado un cuelgue por un duplicado.
  ciclo.pedir(claveVigente(ciclo), { ...OTRO });
  assert.equal(q.cola.pending(), null, "el efecto reconoce el pedido reservado como propio");
  await cede();
  assert.equal(q.corridas.length, 2, "y no hay una tercera action");

  // Y sigue valiendo para los renders siguientes.
  ciclo.pedir(claveVigente(ciclo), { ...OTRO });
  await cede();
  assert.equal(q.corridas.length, 2);

  q.corridas[1].resolve();
  await espera;
  assert.equal(q.cola.busy(), false);
});

test("A FALLA mientras B corre: no enciende el aviso ni resuelve la espera de B", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();

  ciclo.pedir(claveVigente(ciclo), PEDIDO);
  let desenlace = "";
  const espera = ciclo.pedirYEsperar(claveReservada, OTRO).then(
    () => {
      desenlace = "ok";
    },
    (error: unknown) => {
      desenlace = error instanceof Error ? error.message : String(error);
    }
  );
  await cede();
  assert.equal(q.corridas.length, 2);
  q.busy.length = 0;
  q.failed.length = 0;

  // La huérfana rechaza con B todavía en vuelo.
  q.corridas[0].reject(new Error("A_ROTA"));
  await cede();
  await cede();

  assert.deepEqual(q.failed, [], "una huérfana no puede encender el aviso sobre el trabajo vigente");
  assert.deepEqual(q.busy, [], "ni apagar el hilandero de B");
  assert.equal(q.cola.busy(), true, "B sigue siendo la dueña del ciclo vivo");
  assert.equal(q.cola.waiting(), 1, "y la espera sigue abierta");
  assert.equal(desenlace, "", "la completion de A no resuelve ni rechaza a nadie");

  q.corridas[1].resolve();
  await espera;
  assert.equal(desenlace, "ok", "termina con el resultado de B");
  assert.equal(q.failed.at(-1), false, "y `refreshFailed` queda en false sobre datos frescos");
  assert.equal(q.cola.busy(), false);
});

test("A resuelve DESPUÉS de que B terminó: no reanima flags, waiters ni resultado", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();

  ciclo.pedir(claveVigente(ciclo), PEDIDO);
  const espera = ciclo.pedirYEsperar(claveReservada, OTRO);
  await cede();
  assert.equal(q.corridas.length, 2);

  q.corridas[1].resolve();
  await espera;
  assert.equal(q.cola.busy(), false, "el ciclo cerró con el trabajo de B");
  q.busy.length = 0;
  q.failed.length = 0;

  // Y recién ahora aparece la huérfana, primero bien y después mal.
  q.corridas[0].resolve();
  await cede();
  await cede();
  assert.deepEqual(q.busy, [], "no vuelve a encender `CALCULANDO…`");
  assert.deepEqual(q.failed, [], "ni toca el aviso de fallo");
  assert.equal(q.cola.busy(), false);
  assert.equal(q.cola.pending(), null);
  assert.equal(q.cola.waiting(), 0);
  assert.equal(q.corridas.length, 2, "y no larga ninguna action nueva");
});

test("dos `refreshAndWait` del mismo tick: nonces distintos y ninguna espera detrás de la otra", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();

  ciclo.pedir(claveVigente(ciclo), PEDIDO);
  assert.equal(q.corridas.length, 1, "A salió y no va a resolver NUNCA");

  const nonces: number[] = [];
  const anotar = (intento: number) => {
    nonces.push(intento);
    return claveReservada(intento);
  };
  const primera = ciclo.pedirYEsperar(anotar, OTRO);
  const segunda = ciclo.pedirYEsperar(anotar, TERCERO);

  assert.deepEqual(nonces, [1, 2], "cada llamada reserva su propio nonce, sin esperar un render");
  assert.equal(new Set(nonces).size, 2, "no se fabrica dos veces el mismo");

  await cede();

  assert.deepEqual(
    q.corridas.map((corrida) => corrida.request),
    [PEDIDO, TERCERO],
    "la secuencia física es A/C: la intermedia se descarta y A queda huérfana"
  );
  assert.equal(q.cola.waiting(), 2, "las DOS esperas quedan atadas al trabajo vigente");
  assert.equal(q.cola.pending(), null, "ninguna espera quedó detrás de la corrida colgada");

  q.corridas[1].resolve();
  await Promise.all([primera, segunda]);
  assert.equal(q.cola.busy(), false);
  assert.equal(q.cola.waiting(), 0, "las dos terminan, una sola vez cada una");
  assert.equal(q.corridas.length, 2, "y nunca salió una tercera action");
});

test("la vía automática y la forzada son distintas A PROPÓSITO, con los mismos datos", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();

  ciclo.pedir(claveVigente(ciclo), PEDIDO);
  assert.equal(q.corridas.length, 1);

  // Automática con clave idéntica: sigue sin encolar y sin relevar. Es el reloj
  // repitiéndose, y duplicar eso no le sirve a nadie.
  ciclo.pedir(claveVigente(ciclo), { ...PEDIDO });
  ciclo.pedir(claveVigente(ciclo), { ...PEDIDO });
  await cede();
  assert.equal(q.corridas.length, 1, "la deduplicación del reloj quedó intacta");
  assert.equal(q.cola.pending(), null);
  assert.equal(q.cola.busy(), true, "A sigue siendo la dueña, como siempre");

  // Forzada con los MISMOS datos: reserva, releva y larga trabajo nuevo. Es la
  // recuperación natal, que pide sobre datos que acaban de cambiar.
  const espera = ciclo.pedirYEsperar(claveReservada, PEDIDO);
  await cede();
  assert.equal(q.corridas.length, 2, "la vía forzada SÍ progresa sin esperar a A");

  q.corridas[1].resolve();
  await espera;
  assert.equal(q.cola.busy(), false);
});

test("la reserva no rompe el ciclo suspendido: rechaza, no anota la clave y B corre al reabrir", async () => {
  const q = colaDePrueba();
  const ciclo = createRefreshCycle(q.cola);
  ciclo.abrir();

  ciclo.pedir(claveVigente(ciclo), PEDIDO);
  ciclo.cerrar();
  assert.equal(ciclo.clave(), null, "A quedó huérfana sin nada pendiente");

  const antes = ciclo.intento();
  await assert.rejects(ciclo.pedirYEsperar(claveReservada, OTRO), /LAYERS_REFRESH_UNAVAILABLE/);
  assert.equal(ciclo.intento(), antes + 1, "el nonce se consume igual: nunca se reusa");
  assert.equal(ciclo.clave(), null, "pero la clave NO representa un pedido que nunca se admitió");
  assert.equal(q.corridas.length, 1, "no salió ninguna action");
  assert.equal(q.cola.pending(), null);

  // Al reabrir, el efecto pide con el intento vigente —que ya es el reservado— y
  // esta vez sí tiene que correr, exactamente una vez.
  ciclo.abrir();
  ciclo.pedir(claveVigente(ciclo), OTRO);
  await cede();
  assert.equal(q.corridas.length, 2, "B corre…");
  ciclo.pedir(claveVigente(ciclo), { ...OTRO });
  await cede();
  assert.equal(q.corridas.length, 2, "…exactamente una vez");
});
