/**
 * Política de recuperación del recálculo de capas: qué se reintenta, cuántas
 * veces, hasta cuándo se espera y qué se registra.
 *
 * Tres defectos distintos viven acá, y los tres son de la misma familia —"la
 * pantalla se queda esperando algo que no va a llegar"—:
 *
 * 1. **La acción que no vuelve.** Una action de Convex que sale y nunca resuelve
 *    dejaba `CALCULANDO…` para siempre: sin rechazo no hay clasificación, sin
 *    clasificación no hay reintento y sin reintento no hay aviso. Ahora cada
 *    corrida tiene tope (`LAYER_REFRESH_TIMEOUT_MS`, 20 s) y el corte entra por
 *    el mismo camino que cualquier otro error.
 * 2. **Reintentar lo que no se puede arreglar solo.** Un error de sesión, de
 *    argumentos o de datos natales devuelve exactamente lo mismo en el segundo
 *    intento y en el tercero: reintentarlo sólo agrega quince segundos antes de
 *    decir lo que ya se sabía.
 * 3. **El resultado que RESUELVE mal.** `refreshForDate` puede terminar bien y
 *    devolver igual un sobre `stale` porque el proveedor de efemérides no
 *    contestó (`current_ephemeris` / `fresh_ephemeris`). Sin rechazo no hay
 *    clasificación, así que el reintento automático no se enteraba y la pantalla
 *    se quedaba con el cálculo de antes. Ese resultado —y SÓLO ése— se reencauza
 *    como transitorio.
 * 4. **Los logs con PII.** El mensaje crudo de un error de Convex puede traer el
 *    identificador de la persona o el request id de su sesión. Lo que se
 *    registra es el CÓDIGO clasificado.
 *
 * La cola se prueba CORRIENDO: se cuentan acciones y esperas reales (con el
 * reloj inyectado), no se busca el nombre de una constante en el archivo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  LAYER_MAX_RETRIES,
  LAYER_RACE_ERROR,
  LAYER_REFRESH_TIMEOUT_MS,
  LAYER_RETRY_DELAYS_MS,
  LAYER_STALE_EPHEMERIS_ERROR,
  LAYER_TIMEOUT_ERROR,
  STALE_EPHEMERIS_INPUTS,
  classifyLayerError,
  isStaleEphemerisResult,
  isTransientLayerError,
  layerRetryDelay,
  layerRetryLogLine,
  withLayerTimeout,
  type LayerErrorKind,
  type LayerRetryEvent
} from "../src/domain/layerRetry";
import { createRefreshQueue } from "../src/domain/refreshQueue";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PEDIDO = { localDate: "2026-08-20", timezone: "America/Argentina/Buenos_Aires" };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** El encabezado que Convex antepone a cualquier error de una action. */
const CONVEX = (mensaje: string) =>
  new Error(`[Request ID: 7f3a9c1] Server Error\nUncaught Error: ${mensaje}\n  at handler`);

// ---------------------------------------------------------------------------
// Clasificación: qué se reintenta y qué no
// ---------------------------------------------------------------------------

/**
 * Los mensajes REALES del backend, uno por clase.
 *
 * No son inventados para la prueba: son los `throw new Error(...)` que
 * `convex/layers.ts` publica hoy. Si el backend cambia un texto, esta tabla
 * falla y la clasificación se corrige en un solo lugar.
 */
const MENSAJES: readonly { mensaje: string; kind: LayerErrorKind }[] = [
  { mensaje: LAYER_RACE_ERROR, kind: "transient" },
  { mensaje: LAYER_TIMEOUT_ERROR, kind: "transient" },
  // Éste no lo publica el backend: lo fabrica el cliente cuando reconoce un
  // resultado resuelto sin el cielo de hoy, para que recorra el mismo camino.
  { mensaje: LAYER_STALE_EPHEMERIS_ERROR, kind: "transient" },
  { mensaje: "Authentication required", kind: "auth" },
  { mensaje: "User record not found", kind: "auth" },
  { mensaje: "Birth data not found for user", kind: "natal" },
  { mensaje: "Natal chart not found for user", kind: "natal" },
  { mensaje: "Natal ephemeris requires birth data", kind: "natal" },
  { mensaje: "Natal ephemeris does not match the current birth data", kind: "natal" },
  { mensaje: "localDate must be a real date in YYYY-MM-DD format", kind: "validation" },
  {
    mensaje: "localDate must match the server-captured instant in the requested timezone",
    kind: "validation"
  },
  { mensaje: "A valid IANA timezone is required", kind: "validation" },
  { mensaje: "arcId must be an opaque transit arc identifier", kind: "validation" },
  { mensaje: "Something nobody has seen before", kind: "unknown" }
];

test("cada error del backend cae en su clase, venga suelto o envuelto por Convex", () => {
  for (const { mensaje, kind } of MENSAJES) {
    assert.equal(classifyLayerError(new Error(mensaje)), kind, mensaje);
    // Convex antepone su encabezado: la comparación es por inclusión, no por
    // igualdad, y por eso el envoltorio no cambia la clase.
    assert.equal(classifyLayerError(CONVEX(mensaje)), kind, `envuelto: ${mensaje}`);
    // Y lo mismo si llega como texto suelto o como cualquier otra cosa.
    assert.equal(classifyLayerError(mensaje), kind, `string: ${mensaje}`);
  }
  for (const raro of [null, undefined, 42, {}, []]) {
    assert.equal(classifyLayerError(raro), "unknown", `${String(raro)} no puede clasificarse`);
  }
});

test("sólo lo transitorio se reintenta solo: sesión, argumentos y datos natales no", () => {
  for (const { mensaje, kind } of MENSAJES) {
    assert.equal(
      isTransientLayerError(new Error(mensaje)),
      kind === "transient",
      `${mensaje}: reintentar un error estable sólo agrega esperas antes de decir lo mismo`
    );
  }
});

test("tres reintentos, con esperas crecientes, y después se informa", () => {
  assert.deepEqual([...LAYER_RETRY_DELAYS_MS], [1500, 4500, 9000]);
  assert.equal(LAYER_MAX_RETRIES, 3);
  assert.equal(layerRetryDelay(1), 1500);
  assert.equal(layerRetryDelay(2), 4500);
  assert.equal(layerRetryDelay(3), 9000);
  assert.equal(layerRetryDelay(4), null, "el cuarto intento ya no es automático: se avisa");
  for (const invalido of [0, -1, 1.5, Number.NaN]) {
    assert.equal(layerRetryDelay(invalido), null, `intento ${invalido} no existe`);
  }
  // El total es del orden de quince segundos: alcanza para que el alta termine de
  // escribir sus datos y no convierte un backend caído en un bucle.
  assert.equal(LAYER_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0), 15_000);
});

// ---------------------------------------------------------------------------
// El tope: ninguna promesa queda pendiente para siempre
// ---------------------------------------------------------------------------

test("el tope corta la espera de una acción que no vuelve, con su propio código", async () => {
  assert.equal(LAYER_REFRESH_TIMEOUT_MS, 20_000);
  // El disparador se guarda en un objeto y no en un `let`: asignado sólo dentro
  // del closure, TypeScript lo estrecharía a `null` en el punto de lectura.
  const tope: { disparar: (() => void) | null } = { disparar: null };
  const timer = (ms: number, onTimeout: () => void) => {
    assert.equal(ms, LAYER_REFRESH_TIMEOUT_MS, "el tope por defecto es el declarado");
    tope.disparar = onTimeout;
    return () => {
      tope.disparar = null;
    };
  };

  // Una promesa que nunca resuelve: exactamente el caso del defecto.
  const nunca = new Promise<void>(() => undefined);
  const espera = withLayerTimeout(nunca, { timer });
  assert.ok(tope.disparar, "el tope tiene que armarse al empezar la espera");
  tope.disparar();
  await assert.rejects(espera, (error: Error) => error.message === LAYER_TIMEOUT_ERROR);
  // Y ese corte es transitorio: es lo que hace que entre en los reintentos.
  assert.equal(classifyLayerError(new Error(LAYER_TIMEOUT_ERROR)), "transient");
});

test("el tope se cancela apenas el trabajo termina, gane quien gane", async () => {
  let cancelado = 0;
  const timer = () => () => {
    cancelado += 1;
  };

  assert.equal(await withLayerTimeout(Promise.resolve("ok"), { timer }), "ok");
  assert.equal(cancelado, 1, "una corrida que resuelve no deja el temporizador vivo");

  await assert.rejects(withLayerTimeout(Promise.reject(new Error("boom")), { timer }));
  assert.equal(cancelado, 2, "y una que falla, tampoco");

  // Con tope apagado (`0`) se devuelve la misma promesa, sin armar nada.
  let armados = 0;
  const contador = () => {
    armados += 1;
    return () => undefined;
  };
  assert.equal(await withLayerTimeout(Promise.resolve(7), { ms: 0, timer: contador }), 7);
  assert.equal(armados, 0);
});

// ---------------------------------------------------------------------------
// La cola, corriendo
// ---------------------------------------------------------------------------

test("una acción colgada no deja la cola trabajando para siempre: se corta y se reintenta", async () => {
  const esperas: number[] = [];
  let topes = 0;
  let corridas = 0;
  let fallo: boolean | null = null;

  const cola = createRefreshQueue({
    run: () => {
      corridas += 1;
      // Nunca resuelve: el tope es lo único que la termina.
      return new Promise<void>(() => undefined);
    },
    alive: () => true,
    onBusyChange: () => undefined,
    onFailedChange: (failed) => {
      fallo = failed;
    },
    // El tope, inyectado: dispara en el acto en vez de esperar veinte segundos.
    timer: (_ms, onTimeout) => {
      topes += 1;
      onTimeout();
      return () => undefined;
    },
    // Y el backoff, también: se anotan las esperas y se sigue.
    sleep: async (ms) => {
      esperas.push(ms);
    }
  });

  cola.request(PEDIDO);
  // Cada vuelta del bucle es una microtarea; se le dan de sobra.
  for (let i = 0; i < 40; i += 1) await tick();

  assert.equal(corridas, 1 + LAYER_MAX_RETRIES, "el intento original más los tres reintentos");
  assert.equal(topes, corridas, "cada corrida armó su propio tope");
  assert.deepEqual(esperas, [...LAYER_RETRY_DELAYS_MS], "y esperó lo declarado entre intentos");
  assert.equal(fallo, true, "agotados los reintentos, el fallo se informa en vez de seguir mudo");
  assert.equal(cola.busy(), false, "y la cola queda libre, no colgada de la acción que no volvió");
});

test("un error de sesión no gasta reintentos: se informa de una", async () => {
  const esperas: number[] = [];
  let corridas = 0;
  let fallo: boolean | null = null;

  const cola = createRefreshQueue({
    run: () => {
      corridas += 1;
      return Promise.reject(CONVEX("Authentication required"));
    },
    alive: () => true,
    onBusyChange: () => undefined,
    onFailedChange: (failed) => {
      fallo = failed;
    },
    sleep: async (ms) => {
      esperas.push(ms);
    }
  });

  cola.request(PEDIDO);
  for (let i = 0; i < 20; i += 1) await tick();

  assert.equal(corridas, 1, "una sesión rota no se arregla repitiendo la misma llamada");
  assert.deepEqual(esperas, []);
  assert.equal(fallo, true);
});

test("la carrera del alta sí se reintenta, y un éxito limpia el aviso", async () => {
  const esperas: number[] = [];
  let corridas = 0;
  const estados: boolean[] = [];

  const cola = createRefreshQueue({
    run: () => {
      corridas += 1;
      // Falla dos veces con la carrera del alta y a la tercera anda.
      return corridas <= 2 ? Promise.reject(CONVEX(LAYER_RACE_ERROR)) : Promise.resolve();
    },
    alive: () => true,
    onBusyChange: () => undefined,
    onFailedChange: (failed) => estados.push(failed),
    sleep: async (ms) => {
      esperas.push(ms);
    }
  });

  await cola.requestAndWait(PEDIDO);

  assert.equal(corridas, 3);
  assert.deepEqual(esperas, [1500, 4500]);
  assert.deepEqual(estados, [false], "nunca se dijo que falló: se reintentó y salió bien");
});

test("cada intento fallido se registra clasificado, con su intento y su espera", async () => {
  const eventos: LayerRetryEvent[] = [];
  let corridas = 0;

  const cola = createRefreshQueue({
    run: () => {
      corridas += 1;
      return Promise.reject(CONVEX(LAYER_RACE_ERROR));
    },
    alive: () => true,
    onBusyChange: () => undefined,
    onFailedChange: () => undefined,
    onRetryEvent: (evento) => eventos.push(evento),
    sleep: async () => undefined
  });

  cola.request(PEDIDO);
  for (let i = 0; i < 40; i += 1) await tick();

  assert.equal(corridas, 1 + LAYER_MAX_RETRIES);
  assert.equal(eventos.length, 1 + LAYER_MAX_RETRIES, "también se registra el intento que se rinde");
  assert.deepEqual(
    eventos.map((evento) => evento.attempt),
    [1, 2, 3, 4]
  );
  assert.deepEqual(
    eventos.map((evento) => evento.delayMs),
    [1500, 4500, 9000, null],
    "el último no anuncia otra espera: no hay otro intento"
  );
  for (const evento of eventos) {
    assert.equal(evento.kind, "transient");
    assert.equal(evento.operation, "layers.refreshForDate");
  }
});

// ---------------------------------------------------------------------------
// El resultado que RESUELVE mal: el sobre sin el cielo de hoy
// ---------------------------------------------------------------------------

/** Un sobre como los que publica el backend, con lo único que el detector mira. */
const sobre = (status: string, missingInputs: readonly string[]) => ({
  analysisId: "ORB-TRN-002",
  status,
  precision: "estimated",
  observedAt: 1_755_000_000_000,
  validUntil: null,
  missingInputs: [...missingInputs],
  limitations: [],
  sourceRefs: [],
  data: null
});

/** La forma del bundle de `layers.refreshForDate`: los sobres van anidados. */
const bundleCon = (transitRanking: unknown) => ({
  localDate: "2026-08-20",
  timezone: "UTC",
  natal: { lunarType: sobre("ready", []) },
  today: { transitRanking, transitArc: sobre("ready", []) },
  moment: { annualProfection: sobre("ready", []) }
});

test("los dos faltantes que declaran que el cielo no llegó son los declarados", () => {
  assert.deepEqual([...STALE_EPHEMERIS_INPUTS], ["current_ephemeris", "fresh_ephemeris"]);
});

test("un resultado con un sobre `stale` sin el cielo de hoy es un fallo, aunque haya resuelto", () => {
  for (const faltante of STALE_EPHEMERIS_INPUTS) {
    // Anidado dentro del bundle del día (`refreshForDate`).
    assert.equal(
      isStaleEphemerisResult(bundleCon(sobre("stale", [faltante]))),
      true,
      `bundle con ${faltante}`
    );
    // Y suelto, como lo devuelve `refreshTransitArc`.
    assert.equal(isStaleEphemerisResult(sobre("stale", [faltante])), true, `sobre suelto con ${faltante}`);
    // Acompañado de otros faltantes sigue contando: basta con que esté.
    assert.equal(
      isStaleEphemerisResult(sobre("stale", ["exact_birth_time", faltante])),
      true,
      `${faltante} junto a otro faltante`
    );
  }
});

test("no se reintenta un `stale` por otro motivo, ni un sobre sin dato", () => {
  // `stale` por algo que repetir la llamada no arregla.
  for (const faltante of ["exact_birth_time", "birth_data", "verified_twelve_house_geometry"]) {
    assert.equal(isStaleEphemerisResult(sobre("stale", [faltante])), false, faltante);
    assert.equal(isStaleEphemerisResult(bundleCon(sobre("stale", [faltante]))), false, `bundle ${faltante}`);
  }
  // `stale` sin ningún faltante declarado.
  assert.equal(isStaleEphemerisResult(sobre("stale", [])), false);

  // Sin dato: el cielo tampoco llegó, pero ahí no hay nada que refrescar y la
  // pantalla ya lo dice con su propio bloque.
  for (const status of ["unavailable", "error", "partial", "ready"]) {
    assert.equal(
      isStaleEphemerisResult(sobre(status, ["current_ephemeris"])),
      false,
      `${status} no entra en la política`
    );
  }

  // Un bundle entero sano.
  assert.equal(isStaleEphemerisResult(bundleCon(sobre("ready", []))), false);

  // Y nada que no sea un sobre rompe la lectura ni dispara un reintento.
  for (const basura of [null, undefined, 0, 1, "", "stale", [], {}, true, [1, 2, 3]]) {
    assert.equal(isStaleEphemerisResult(basura), false, JSON.stringify(basura) ?? String(basura));
  }
  // `missingInputs` que no es una lista de códigos: se ignora, no se adivina.
  assert.equal(isStaleEphemerisResult({ status: "stale", missingInputs: "current_ephemeris" }), false);
  assert.equal(isStaleEphemerisResult({ status: "stale", missingInputs: [7, null] }), false);
});

test("la cola reintenta el resultado sin cielo con la MISMA política, y se rinde en el tope", async () => {
  const esperas: number[] = [];
  const eventos: LayerRetryEvent[] = [];
  let corridas = 0;
  let fallo: boolean | null = null;

  const cola = createRefreshQueue({
    // Resuelve SIEMPRE, y siempre con el sobre viejo: nunca hay un rechazo que
    // clasificar, que es exactamente el defecto que se cierra.
    run: () => {
      corridas += 1;
      return Promise.resolve(bundleCon(sobre("stale", ["current_ephemeris"])));
    },
    alive: () => true,
    onBusyChange: () => undefined,
    onFailedChange: (failed) => {
      fallo = failed;
    },
    onRetryEvent: (evento) => eventos.push(evento),
    sleep: async (ms) => {
      esperas.push(ms);
    }
  });

  cola.request(PEDIDO);
  for (let i = 0; i < 40; i += 1) await tick();

  assert.equal(corridas, 1 + LAYER_MAX_RETRIES, "el intento original más los tres reintentos, y ni uno más");
  assert.deepEqual(esperas, [...LAYER_RETRY_DELAYS_MS], "las esperas son las de la política, sin inventar otras");
  assert.equal(fallo, true, "agotado el crédito se informa el fallo en vez de seguir intentando");
  assert.equal(cola.busy(), false, "y la cola queda libre");
  assert.deepEqual(
    eventos.map((evento) => evento.kind),
    ["transient", "transient", "transient", "transient"],
    "los cuatro intentos se registran como lo que son"
  );
});

test("si un reintento trae el cielo, el fallo nunca se anuncia", async () => {
  let corridas = 0;
  const estados: boolean[] = [];

  const cola = createRefreshQueue({
    run: () => {
      corridas += 1;
      // Las dos primeras vuelven sin cielo; la tercera trae el cálculo de ahora.
      return Promise.resolve(
        corridas <= 2 ? bundleCon(sobre("stale", ["fresh_ephemeris"])) : bundleCon(sobre("ready", []))
      );
    },
    alive: () => true,
    onBusyChange: () => undefined,
    onFailedChange: (failed) => estados.push(failed),
    sleep: async () => undefined
  });

  await cola.requestAndWait(PEDIDO);

  assert.equal(corridas, 3);
  assert.deepEqual(estados, [false], "se reintentó y salió bien: no hubo nada que avisar");
});

test("un resultado `stale` por otro motivo termina la corrida: no se reintenta", async () => {
  for (const resultado of [
    bundleCon(sobre("stale", ["exact_birth_time"])),
    bundleCon(sobre("unavailable", ["current_ephemeris"])),
    bundleCon(sobre("ready", []))
  ]) {
    const esperas: number[] = [];
    let corridas = 0;
    const estados: boolean[] = [];

    const cola = createRefreshQueue({
      run: () => {
        corridas += 1;
        return Promise.resolve(resultado);
      },
      alive: () => true,
      onBusyChange: () => undefined,
      onFailedChange: (failed) => estados.push(failed),
      sleep: async (ms) => {
        esperas.push(ms);
      }
    });

    await cola.requestAndWait(PEDIDO);

    assert.equal(corridas, 1, "repetir la llamada devolvería lo mismo");
    assert.deepEqual(esperas, []);
    assert.deepEqual(estados, [false]);
  }
});

// ---------------------------------------------------------------------------
// Los logs, sin PII
// ---------------------------------------------------------------------------

test("la línea de log dice el código y nunca el mensaje crudo", () => {
  const linea = layerRetryLogLine({
    operation: "layers.refreshForDate",
    kind: "natal",
    attempt: 2,
    delayMs: 4500
  });
  assert.equal(linea, "[orbita] layers op=layers.refreshForDate motivo=natal intento=2 reintento_en_ms=4500");

  const ultimo = layerRetryLogLine({
    operation: "layers.refreshTransitArc",
    kind: "auth",
    attempt: 1,
    delayMs: null
  });
  assert.match(ultimo, /reintento=no$/, "cuando no hay otro intento, se dice");

  // Lo que NO puede aparecer: nada que identifique a una persona ni a su sesión.
  const sensible = [
    "user_2abcXYZ",
    "usuario@correo.com",
    "1990-05-12",
    "[Request ID: 7f3a9c1]",
    "America/Argentina/Buenos_Aires"
  ];
  for (const kind of ["transient", "auth", "validation", "natal", "unknown"] as const) {
    const texto = layerRetryLogLine({ operation: "layers.refreshForDate", kind, attempt: 1, delayMs: null });
    for (const dato of sensible) {
      assert.ok(!texto.includes(dato), `el log no puede contener «${dato}»`);
    }
  }
});

test("quien registra el fallo pasa por la línea sin PII, y no imprime el error", () => {
  for (const rel of ["src/hooks/useLayers.tsx", "src/hooks/useTransitArc.ts"]) {
    const source = sinComentarios(leer(rel));
    assert.match(source, /layerRetryLogLine\(/, `${rel}: el log tiene que salir del dominio`);
    // El error crudo no se imprime en ningún lado: ni el objeto ni su mensaje.
    const logs = source.match(/console\.(?:warn|error|log)\([\s\S]{0,240}?\);/g) ?? [];
    assert.ok(logs.length > 0, `${rel}: falta el registro del fallo`);
    for (const log of logs) {
      assert.ok(!/\berror\b(?!\))/.test(log.replace(/classifyLayerError\(error\)/g, "")), `${rel}: ${log}`);
      assert.ok(!/\.message/.test(log), `${rel}: el mensaje crudo puede traer PII`);
    }
  }
});

// ---------------------------------------------------------------------------
// El cableado: el tope está donde tiene que estar
// ---------------------------------------------------------------------------

test("las dos acciones de capas corren con tope y con la misma política", () => {
  const cola = sinComentarios(leer("src/domain/refreshQueue.ts"));
  assert.match(
    cola,
    /await withLayerTimeout\(deps\.run\(next\), \{ ms: timeoutMs, timer \}\)/,
    "el recálculo del día corre con tope"
  );
  assert.match(cola, /classifyLayerError\(error\)/, "y el fallo se clasifica antes de registrarlo");

  const arco = sinComentarios(leer("src/hooks/useTransitArc.ts"));
  assert.match(
    arco,
    /await withLayerTimeout\(refreshTransitArc\(\{ localDate, timezone, arcId \}\)\)/,
    "el cálculo de un tránsito también"
  );
  assert.match(arco, /isTransientLayerError\(error\)/, "con la misma clasificación");
  assert.match(arco, /layerRetryDelay\(reintentos\.current \+ 1\)/, "y las mismas esperas");
});

test("el detector del resultado sin cielo corre DESPUÉS del await, en las dos acciones", () => {
  // La cola lo tiene inyectable, con el detector del dominio por defecto, y lo
  // aplica al resultado de la corrida antes de darla por buena.
  const cola = sinComentarios(leer("src/domain/refreshQueue.ts"));
  assert.match(cola, /const staleResult = deps\.staleResult \?\? isStaleEphemerisResult;/);
  assert.match(
    cola,
    /const resultado = await withLayerTimeout\(deps\.run\(next\)[\s\S]{0,400}?if \(staleResult\(resultado\)\) throw new Error\(LAYER_STALE_EPHEMERIS_ERROR\);/,
    "el resultado se mira después del await y se reencauza dentro del mismo `try`"
  );

  const arco = sinComentarios(leer("src/hooks/useTransitArc.ts"));
  assert.match(
    arco,
    /const resultado = await withLayerTimeout\(refreshTransitArc\([\s\S]{0,300}?if \(isStaleEphemerisResult\(resultado\)\) throw new Error\(LAYER_STALE_EPHEMERIS_ERROR\);/,
    "el cálculo de un tránsito lo mira igual"
  );
});
