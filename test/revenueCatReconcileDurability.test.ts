/**
 * Durabilidad de la reconciliación (P1 8, 9, 10).
 *
 * ## Por qué no alcanzaba con el intento anterior
 *
 * Las scheduled **actions** de Convex son at-most-once y no se reprograman
 * solas. Hacer que la action preagendara su sucesora tapaba "la proyección
 * tira", pero no lo que importa: si la action **nunca llega a su primera
 * línea**, o si ese `runAfter` **rechaza**, muere sin sucesora y la reparación
 * se pierde con el cargo hecho. Una action no puede sostener su durabilidad.
 *
 * ## El modelo
 *
 * Estado persistido (`reconcileJobs`) + una **mutation** agendada que lo vigila
 * (`runReconcileJob`): las mutations se reintentan ante fallos transitorios y
 * su `scheduler.runAfter` es parte de su transacción.
 *
 * ## Lo que este archivo agrega sobre eso
 *
 * - **Lost wakeup**: un webhook que llega mientras una corrida está en vuelo
 *   incrementa `requestedSeq`. La corrida vieja ya no puede liquidar: su
 *   snapshot es anterior a esa señal.
 * - **Stale settle**: cada corrida lleva un `leaseToken`. Un resultado tardío
 *   con un lease viejo no liquida nada y —esto es lo grave— no cancela el
 *   watchdog de la corrida nueva.
 * - **Auth**: el lease se revalida antes de la red y antes de proyectar. Tras
 *   un borrado de cuenta, una action ya agendada sale con cero fetch.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RECONCILE_COOLDOWN,
  RECONCILE_FETCH_TIMEOUT_MS,
  RECONCILE_MAX_ATTEMPTS
} from "../convex/lib/revenueCatRetry";
import { applyRevenueCatEvent } from "../convex/payments/revenuecat";
import {
  enqueueStoreReconcile,
  projectReconcileResult,
  reconcileLeaseIsCurrent,
  reconcileStoreEntitlement,
  runReconcileJob,
  settleReconcileJob
} from "../convex/payments/revenuecatRest";

const NOW = 1_800_000_000_000;
const FUTURE = 2_000_000_000_000;

const enqueueHandler = (enqueueStoreReconcile as any)._handler;
const runJobHandler = (runReconcileJob as any)._handler;
const settleHandler = (settleReconcileJob as any)._handler;
const leaseHandler = (reconcileLeaseIsCurrent as any)._handler;
const projectResultHandler = (projectReconcileResult as any)._handler;
const actionHandler = (reconcileStoreEntitlement as any)._handler;
const applyEventHandler = (applyRevenueCatEvent as any)._handler;

const CUERPO_VALIDO = {
  request_date_ms: NOW,
  subscriber: {
    original_app_user_id: "user_a",
    entitlements: {
      orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" }
    },
    subscriptions: {
      orbita_monthly: { expires_date_ms: FUTURE, period_type: "normal", is_sandbox: true }
    },
    non_subscriptions: {}
  }
};

type Respuesta = { status: number; body?: unknown } | "throw";
type Programado = { id: string; args: any; tipo: "watchdog" | "action"; runAt: number; orden: number };

function banco(opciones: {
  respuestas: Respuesta[];
  /** Intentos (1-based) cuya proyección rechaza. */
  proyeccionFalla?: number[];
  /** Cuántas veces seguidas debe rechazar el `runAfter` de la action. */
  runAfterFallaVeces?: number;
  /** Empezar sin la cuenta local (borrada). */
  sinUsuario?: boolean;
  /**
   * Se ejecuta JUSTO DESPUÉS de cada `fetch`, antes de que esa corrida
   * proyecte. Es el único punto donde se puede meter un webhook nuevo en el
   * medio de una corrida en vuelo.
   */
  trasFetch?: (n: number, encolar: (trigger?: string) => Promise<void>) => Promise<void>;
}) {
  const filas = new Map<string, any>();
  let secuenciaFila = 0;
  let secuenciaJob = 0;
  let orden = 0;
  let reloj = 0;
  let indiceRespuesta = 0;
  let lanzamientos = 0;
  let fallasRunAfterRestantes = opciones.runAfterFallaVeces ?? 0;
  const pedidos: string[] = [];
  const proyectados: any[] = [];
  const aplicados: any[] = [];
  const cola: Programado[] = [];
  const cancelados: string[] = [];

  const insertar = (table: string, value: Record<string, unknown>) => {
    const id = `${table}_${++secuenciaFila}`;
    filas.set(id, { _id: id, _table: table, ...value });
    return id;
  };

  if (!opciones.sinUsuario) insertar("users", { clerkUserId: "user_a" });

  const db = {
    async get(id: string) {
      const fila = filas.get(id);
      return fila ? { ...fila } : null;
    },
    async insert(table: string, value: Record<string, unknown>) {
      return insertar(table, value);
    },
    async patch(id: string, value: Record<string, unknown>) {
      const fila = filas.get(id);
      if (!fila) throw new Error(`patch sobre fila inexistente: ${id}`);
      Object.assign(fila, value);
    },
    async delete(id: string) {
      filas.delete(id);
    },
    query(table: string) {
      const filtros = new Map<string, unknown>();
      const q = {
        eq(field: string, value: unknown) {
          filtros.set(field, value);
          return q;
        }
      };
      return {
        withIndex(_i: string, build?: (b: typeof q) => unknown) {
          if (build) build(q);
          const encontrados = () =>
            [...filas.values()].filter(
              (fila) => fila._table === table && [...filtros].every(([f, v]) => fila[f] === v)
            );
          return {
            first: async () => encontrados()[0] ?? null,
            collect: async () => encontrados()
          };
        }
      };
    }
  };

  const scheduler = {
    async runAfter(delay: number, _ref: unknown, args: any) {
      // La forma de los argumentos distingue las dos entradas de este módulo:
      // `{ jobId }` a secas es el watchdog; con `clerkUserId`, la action.
      const tipo: Programado["tipo"] = args?.clerkUserId ? "action" : "watchdog";
      if (tipo === "action" && fallasRunAfterRestantes > 0) {
        fallasRunAfterRestantes -= 1;
        throw new Error("scheduler no disponible");
      }
      if (tipo === "action") lanzamientos += 1;
      const id = `sched_${++secuenciaJob}`;
      cola.push({ id, args, tipo, runAt: reloj + delay, orden: ++orden });
      return id;
    },
    async cancel(id: string) {
      cancelados.push(id);
      const indice = cola.findIndex((entrada) => entrada.id === id);
      if (indice >= 0) cola.splice(indice, 1);
    }
  };

  const ctxMutation: any = { db, scheduler };

  const encolarInterno = async (trigger = "webhook:TEST") => {
    await enqueueHandler(ctxMutation, { clerkUserId: "user_a", trigger });
  };

  const fetchGuionado = (async () => {
    const guion = opciones.respuestas[Math.min(indiceRespuesta, opciones.respuestas.length - 1)];
    indiceRespuesta += 1;
    pedidos.push("fetch");
    if (guion === "throw") throw new Error("network down");
    const respuesta = { status: guion.status, json: async () => guion.body ?? {} } as any;
    await opciones.trasFetch?.(indiceRespuesta, encolarInterno);
    return respuesta;
  }) as any;

  /** El ctx de la action: despacha por la forma de los argumentos. */
  const ctxAction: any = {
    runQuery: async (_ref: unknown, args: any) => await leaseHandler(ctxMutation, args),
    runMutation: async (_ref: unknown, args: any) => {
      if (args && "result" in args) return await settleHandler(ctxMutation, args);
      if (opciones.proyeccionFalla?.includes(lanzamientos)) throw new Error("proyección caída");
      // `proyectados` = lo que se INTENTÓ proyectar; `aplicados` = lo que la
      // mutation aceptó de verdad. La diferencia es justo el snapshot viejo.
      proyectados.push(args.outcome);
      const salida = await projectResultHandler(ctxMutation, args);
      if (salida?.status === "applied") aplicados.push(args.outcome);
      return salida;
    }
  };

  async function conEntorno<T>(run: () => Promise<T>): Promise<T> {
    const previoSecret = process.env.REVENUECAT_SECRET_API_KEY;
    const previoEnv = process.env.ORBITA_ENVIRONMENT;
    const fetchOriginal = globalThis.fetch;
    process.env.REVENUECAT_SECRET_API_KEY = "sk-de-prueba";
    process.env.ORBITA_ENVIRONMENT = "development";
    globalThis.fetch = fetchGuionado;
    try {
      return await run();
    } finally {
      globalThis.fetch = fetchOriginal;
      if (previoSecret === undefined) delete process.env.REVENUECAT_SECRET_API_KEY;
      else process.env.REVENUECAT_SECRET_API_KEY = previoSecret;
      if (previoEnv === undefined) delete process.env.ORBITA_ENVIRONMENT;
      else process.env.ORBITA_ENVIRONMENT = previoEnv;
    }
  }

  const job = () => [...filas.values()].find((fila) => fila._table === "reconcileJobs") ?? null;
  const borrarUsuario = () => {
    for (const [id, fila] of filas) if (fila._table === "users") filas.delete(id);
  };

  function proxima(): Programado | null {
    if (cola.length === 0) return null;
    let elegida = 0;
    for (let i = 1; i < cola.length; i += 1) {
      const a = cola[i];
      const b = cola[elegida];
      if (a.runAt < b.runAt || (a.runAt === b.runAt && a.orden < b.orden)) elegida = i;
    }
    const [entrada] = cola.splice(elegida, 1);
    reloj = Math.max(reloj, entrada.runAt);
    return entrada;
  }

  async function ejecutar(entrada: Programado) {
    let error: unknown = null;
    await conEntorno(async () => {
      try {
        if (entrada.tipo === "watchdog") await runJobHandler(ctxMutation, entrada.args);
        else await actionHandler(ctxAction, entrada.args);
      } catch (e) {
        error = e;
      }
    });
    return error;
  }

  async function drenar(maxPasos = 40) {
    const errores: unknown[] = [];
    let pasos = 0;
    while (pasos < maxPasos) {
      const entrada = proxima();
      if (!entrada) break;
      pasos += 1;
      const error = await ejecutar(entrada);
      if (error) errores.push(error);
    }
    return {
      errores,
      pedidos,
      proyectados,
      aplicados,
      job: job(),
      pendientes: cola.length,
      cancelados
    };
  }

  async function encolar(clerkUserId = "user_a", trigger = "webhook:TEST") {
    await enqueueHandler(ctxMutation, { clerkUserId, trigger });
    return job();
  }

  async function paso() {
    const entrada = proxima();
    if (!entrada) return null;
    return { entrada, error: await ejecutar(entrada) };
  }

  function perderProxima() {
    return proxima();
  }

  const suscripciones = () =>
    [...filas.values()].filter((fila) => fila._table === "subscriptions");
  const auditorias = () => [...filas.values()].filter((fila) => fila._table === "paymentEvents");

  /** Siembra una fila de la tienda ya proyectada para esta cuenta. */
  const sembrarSuscripcion = (fields: Record<string, unknown>) => {
    const user = [...filas.values()].find((fila) => fila._table === "users");
    return insertar("subscriptions", {
      userId: user?._id,
      clerkUserId: "user_a",
      provider: "revenuecat",
      environment: "sandbox",
      updatedAt: 0,
      ...fields
    });
  };

  return {
    drenar,
    encolar,
    paso,
    perderProxima,
    borrarUsuario,
    job,
    suscripciones,
    auditorias,
    sembrarSuscripcion,
    cola,
    pedidos,
    proyectados,
    aplicados,
    cancelados,
    ctxMutation,
    ctxAction,
    conEntorno
  };
}

describe("P1 8 — el trabajo durable existe antes que la action", () => {
  it("encolar deja una fila `pending` y su primer disparo agendado", async () => {
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }] });
    const fila = await b.encolar();
    assert.equal(fila?.status, "pending");
    assert.equal(fila?.attempt, 0);
    assert.equal(fila?.generation, 1);
    assert.equal(fila?.requestedSeq, 1);
    assert.equal(b.cola.length, 1, "el primer watchdog queda agendado en la misma transacción");
  });

  it("sin cuenta local no se encola nada", async () => {
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }], sinUsuario: true });
    await b.encolar();
    assert.equal(b.job(), null);
    assert.equal(b.cola.length, 0);
  });

  it("el camino feliz proyecta, liquida el trabajo y no deja nada vivo", async () => {
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }] });
    await b.encolar();
    const { proyectados, job, pendientes } = await b.drenar();
    assert.equal(proyectados[0].kind, "resolved");
    assert.equal(job?.status, "settled");
    assert.equal(job?.outcome, "resolved");
    assert.equal(pendientes, 0, "el watchdog se canceló al liquidar");
  });

  it("REPRO: la action que NUNCA arranca igual se recupera", async () => {
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }] });
    await b.encolar();
    await b.paso();
    const perdida = b.perderProxima();
    assert.equal(perdida?.tipo, "action");
    assert.equal(b.job()?.status, "pending");
    assert.equal(b.pedidos.length, 0, "nunca se tocó la red");

    const { proyectados, job } = await b.drenar();
    assert.equal(proyectados.length, 1);
    assert.equal(job?.status, "settled");
    assert.equal(job?.attempt, 2);
  });

  it("REPRO: si el `runAfter` de la action rechaza, no queda un intento consumido sin sucesor", async () => {
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }], runAfterFallaVeces: 1 });
    await b.encolar();
    const primero = await b.paso();
    assert.ok(primero?.error, "la mutation falla y Convex la reintenta");
    assert.equal(b.job()?.attempt, 0, "el intento no se consumió");
    assert.equal(b.job()?.status, "pending");

    await b.ctxMutation.scheduler.runAfter(0, null, { jobId: b.job()._id });
    const { job, proyectados } = await b.drenar();
    assert.equal(proyectados[0].kind, "resolved");
    assert.equal(job?.status, "settled");
  });

  it("una proyección que tira deja el trabajo vivo y el reintento lo repara", async () => {
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }], proyeccionFalla: [1] });
    await b.encolar();
    const { errores, proyectados, job } = await b.drenar();
    assert.equal(errores.length, 1, "la action muere sin liquidar");
    assert.equal(proyectados.length, 1, "el segundo intento sí proyectó");
    assert.equal(job?.status, "settled");
    assert.equal(job?.outcome, "resolved");
  });
});

describe("P1 9 — señales, generaciones y lease", () => {
  it("REPRO (lost wakeup): un webhook durante la corrida NO se pierde", async () => {
    // El defecto: `enqueue` sobre un trabajo `pending` volvía sin dejar rastro.
    // La corrida en vuelo —con un snapshot anterior a ese webhook— liquidaba el
    // trabajo y esa señal nunca se atendía.
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }] });
    await b.encolar();
    await b.paso(); // watchdog: lanza el intento 1
    assert.equal(b.job()?.startedSeq, 1);

    // Llega otro webhook mientras la action está en vuelo.
    await b.encolar("user_a", "webhook:RENEWAL");
    assert.equal(b.job()?.requestedSeq, 2, "la señal quedó registrada");
    assert.equal(b.job()?.status, "pending");

    // La action de la señal 1 termina. NO puede cerrar el trabajo.
    const accion = await b.paso();
    assert.equal(accion?.entrada.tipo, "action");
    assert.equal(b.job()?.status, "pending", "la señal nueva impide liquidar");

    const { job, pedidos } = await b.drenar();
    assert.equal(pedidos.length, 2, "la señal nueva se atendió con su propia lectura");
    assert.equal(job?.status, "settled");
    assert.equal(job?.startedSeq, 2);
  });

  it("REPRO: un snapshot que quedó viejo NO proyecta; la señal nueva sí", async () => {
    // El agujero: `enqueueStoreReconcile` subía `requestedSeq` sin tocar el
    // lease, y `reconcileLeaseIsCurrent` sólo miraba status/usuario/token. Con
    // `requestedSeq: 2`, `startedSeq: 1` y lease `1:1:1` decía "sí", y la
    // corrida vieja —con un snapshot ANTERIOR a ese webhook— proyectaba. Aun
    // comprobando la señal en el query quedaba la ventana entre el query y la
    // mutation de proyección.
    const segundoCuerpo = {
      request_date_ms: NOW + 1,
      subscriber: {
        original_app_user_id: "user_a",
        entitlements: {
          orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly_v2" }
        },
        subscriptions: {
          orbita_monthly_v2: { expires_date_ms: FUTURE, period_type: "normal", is_sandbox: true }
        },
        non_subscriptions: {}
      }
    };

    const b = banco({
      respuestas: [{ status: 200, body: CUERPO_VALIDO }, { status: 200, body: segundoCuerpo }],
      // El webhook nuevo entra JUSTO entre el fetch de la corrida 1 y su
      // proyección: el punto exacto donde antes se colaba.
      trasFetch: async (n, encolar) => {
        if (n === 1) await encolar("webhook:RENEWAL");
      }
    });

    await b.encolar();
    const { pedidos, proyectados, aplicados, job } = await b.drenar();

    assert.equal(proyectados.length, 2, "las dos corridas intentaron proyectar");
    assert.equal(aplicados.length, 1, "pero sólo una pudo tocar el acceso");
    assert.equal(
      aplicados[0].patch.productId,
      "orbita_monthly_v2",
      "y es la de la señal nueva, no el snapshot viejo"
    );

    // La fila refleja la lectura nueva, nunca la vieja.
    const fila = b.suscripciones()[0];
    assert.equal(fila?.productId, "orbita_monthly_v2");
    assert.equal(b.suscripciones().length, 1);

    assert.equal(pedidos.length, 2);
    assert.equal(job?.status, "settled");
    assert.equal(job?.startedSeq, 2, "la corrida que cerró es la de la señal 2");
  });

  it("y la señal nueva se adelanta: no espera al watchdog largo", async () => {
    // Al detectar `stale`, la action liquida con el lease que TODAVÍA es suyo,
    // así `settleReconcileJob` ve la señal nueva y agenda la próxima corrida en
    // el acto (delay 0) en vez de dejarla para el watchdog de un minuto.
    const b = banco({
      respuestas: [{ status: 200, body: CUERPO_VALIDO }],
      trasFetch: async (n, encolar) => {
        if (n === 1) await encolar("webhook:RENEWAL");
      }
    });
    await b.encolar();
    await b.paso(); // watchdog → intento 1
    await b.paso(); // action 1 → stale → liquida pidiendo reintento

    assert.equal(b.job()?.status, "pending", "el trabajo sigue abierto");
    assert.equal(b.job()?.attempt, 0, "los intentos se reinician con la señal nueva");
    const próxima = b.cola.find((entrada) => entrada.tipo === "watchdog");
    assert.ok(próxima, "hay una corrida agendada");
    assert.equal(próxima?.runAt, 0, "y es inmediata, no dentro de un minuto");
  });

  it("con la señal al día, la proyección se aplica normal", async () => {
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }] });
    await b.encolar();
    const { aplicados, proyectados } = await b.drenar();
    assert.equal(proyectados.length, 1);
    assert.equal(aplicados.length, 1);
  });

  it("REPRO: el webhook sube la señal en SU transacción; el snapshot viejo no reescribe", async () => {
    // El agujero: `applyRevenueCatEvent` aplicaba el evento y después hacía
    // `scheduler.runAfter(0, enqueueStoreReconcile, …)`. Esa mutation corre
    // DESPUÉS, así que `requestedSeq` recién subía más tarde. En ese hueco, una
    // corrida en vuelo con un snapshot anterior al webhook todavía se veía
    // `requestedSeq === startedSeq` y `projectReconcileResult` la aceptaba: un
    // `EXPIRATION` que acababa de dejar la fila en Free era reescrito a Pro.
    //
    // Acá el webhook se aplica JUSTO DESPUÉS del fetch de la corrida 1 y la
    // cola del scheduler NO se drena, que es exactamente ese hueco.
    let b: ReturnType<typeof banco>;
    const aplicarExpiracion = async () => {
      await applyEventHandler(b.ctxMutation, {
        event: {
          id: "rc_expiracion",
          type: "EXPIRATION",
          event_timestamp_ms: NOW + 10,
          environment: "SANDBOX",
          entitlement_ids: ["orbita_pro"],
          app_user_id: "user_a",
          product_id: "orbita_monthly",
          expiration_at_ms: NOW + 10
        }
      });
    };

    b = banco({
      respuestas: [
        // 1) el snapshot Pro que la corrida vieja ya traía en la mano;
        { status: 200, body: CUERPO_VALIDO },
        // 2) la lectura de la corrida nueva, que ya ve la cuenta sin acceso.
        {
          status: 200,
          body: {
            request_date_ms: NOW + 20,
            subscriber: {
              original_app_user_id: "user_a",
              entitlements: {},
              subscriptions: {},
              non_subscriptions: {}
            }
          }
        }
      ],
      trasFetch: async (n) => {
        if (n === 1) await aplicarExpiracion();
      }
    });

    b.sembrarSuscripcion({
      entitlement: "orbita_pro",
      status: "active",
      plan: "monthly",
      productId: "orbita_monthly",
      currentPeriodEnd: FUTURE,
      isLifetime: false,
      willRenew: true
    });

    await b.encolar();
    await b.paso(); // watchdog → intento 1, startedSeq 1, lease 1:1:1
    await b.paso(); // action 1: fetch Pro → llega el EXPIRATION → proyecta

    // La señal quedó escrita por el propio webhook, sin drenar nada.
    assert.equal(b.job()?.requestedSeq, 2, "la señal está persistida ya mismo");
    assert.equal(b.job()?.startedSeq, 1);

    // Y el snapshot viejo NO tocó el acceso.
    assert.equal(b.aplicados.length, 0, "cero proyecciones del snapshot viejo");
    assert.equal(
      b.suscripciones()[0]?.entitlement,
      "free",
      "la fila sigue como la dejó el EXPIRATION"
    );
    assert.equal(
      b.auditorias().filter((fila) => fila.eventType === "RECONCILE").length,
      0,
      "y no dejó auditoría de reconciliación"
    );

    // La próxima corrida está agendada y puede reparar.
    assert.equal(b.job()?.status, "pending");
    const { job } = await b.drenar();
    assert.equal(job?.startedSeq, 2);
    assert.equal(b.suscripciones()[0]?.entitlement, "free", "la lectura nueva confirma Free");
  });

  it("encolar dos veces no arma dos cadenas, pero sí dos señales", async () => {
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }] });
    await b.encolar();
    await b.encolar();
    assert.equal(b.cola.length, 1, "una sola cadena");
    assert.equal(b.job()?.requestedSeq, 2, "dos señales");
  });

  it("REPRO (stale settle): un lease viejo no liquida ni cancela el watchdog nuevo", async () => {
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }] });
    await b.encolar();
    await b.paso(); // intento 1
    const leaseViejo = b.job()?.leaseToken;
    assert.ok(leaseViejo);

    // Una señal nueva reabre la corrida: el watchdog relanza con otro lease.
    await b.encolar("user_a", "webhook:RENEWAL");
    b.perderProxima(); // la action del intento 1 se pierde
    await b.paso(); // watchdog → intento 2, lease nuevo
    const leaseNuevo = b.job()?.leaseToken;
    assert.notEqual(leaseNuevo, leaseViejo);
    const vivosAntes = b.cola.length;

    // Ahora llega, tardísimo, el resultado de la corrida vieja.
    await settleHandler(b.ctxMutation, {
      jobId: b.job()._id,
      clerkUserId: "user_a",
      lease: leaseViejo,
      result: "settled",
      outcome: "resolved"
    });

    assert.equal(b.job()?.status, "pending", "un lease viejo no cierra el trabajo");
    assert.equal(b.job()?.leaseToken, leaseNuevo, "ni le roba el lease a la corrida nueva");
    assert.equal(b.cola.length, vivosAntes, "ni le cancela el watchdog");
  });

  it("un settle con otra cuenta no toca el trabajo", async () => {
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }] });
    await b.encolar();
    await b.paso();
    await settleHandler(b.ctxMutation, {
      jobId: b.job()._id,
      clerkUserId: "user_b",
      lease: b.job().leaseToken,
      result: "settled",
      outcome: "resolved"
    });
    assert.equal(b.job()?.status, "pending");
  });

  it("una señal nueva sobre un trabajo AGOTADO reinicia la generación", async () => {
    const b = banco({ respuestas: [{ status: 429 }] });
    await b.encolar();
    const primero = await b.drenar(80);
    assert.equal(primero.job?.status, "settled");
    assert.equal(primero.job?.outcome, "exhausted");
    assert.equal(primero.pedidos.length, RECONCILE_MAX_ATTEMPTS);

    await b.encolar("user_a", "webhook:RENEWAL");
    const reabierto = b.job();
    assert.equal(reabierto?.status, "pending");
    assert.equal(reabierto?.generation, 2, "generación nueva");
    assert.equal(reabierto?.attempt, 0, "intentos en cero");
    assert.equal(reabierto?.outcome, undefined);
    assert.equal(b.cola.length, 1, "y una cadena nueva agendada");
  });
});

describe("P1 10 — el trabajo, la cuenta y el lease se revalidan", () => {
  it("REPRO: tras borrar la cuenta, la action agendada hace CERO fetch", async () => {
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }] });
    await b.encolar();
    await b.paso(); // el watchdog dejó la action agendada

    b.borrarUsuario();

    const accion = await b.paso();
    assert.equal(accion?.entrada.tipo, "action");
    assert.deepEqual(b.pedidos, [], "no se le pregunta a RevenueCat por una cuenta borrada");
    assert.deepEqual(b.proyectados, []);
  });

  it("el watchdog retira el trabajo si la cuenta ya no existe", async () => {
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }] });
    await b.encolar();
    b.borrarUsuario();
    await b.paso(); // watchdog
    assert.equal(b.job(), null, "no queda trabajo apuntando a un id inexistente");
    assert.equal(b.cola.length, 0);
  });

  it("el lease exige que jobId y clerkUserId correspondan", async () => {
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }] });
    await b.encolar();
    await b.paso();
    const job = b.job();
    assert.equal(
      await leaseHandler(b.ctxMutation, {
        jobId: job._id,
        clerkUserId: "user_a",
        lease: job.leaseToken
      }),
      true
    );
    assert.equal(
      await leaseHandler(b.ctxMutation, {
        jobId: job._id,
        clerkUserId: "user_otro",
        lease: job.leaseToken
      }),
      false
    );
    assert.equal(
      await leaseHandler(b.ctxMutation, {
        jobId: job._id,
        clerkUserId: "user_a",
        lease: "1:1:99"
      }),
      false
    );
  });
});

describe("P1 8 — acotado, idempotente y sin tormentas", () => {
  it("un 401 liquida el trabajo en el acto: cero reintentos", async () => {
    const b = banco({ respuestas: [{ status: 401 }] });
    await b.encolar();
    const { pedidos, job, pendientes } = await b.drenar();
    assert.equal(pedidos.length, 1);
    assert.equal(job?.status, "settled");
    assert.equal(job?.outcome, "http_401");
    assert.equal(pendientes, 0);
  });

  it("un 403 y un 404 tampoco reintentan", async () => {
    for (const status of [403, 404]) {
      const b = banco({ respuestas: [{ status }] });
      await b.encolar();
      const { pedidos, job } = await b.drenar();
      assert.equal(pedidos.length, 1, `http_${status}`);
      assert.equal(job?.status, "settled", `http_${status}`);
    }
  });

  it("una identidad ajena queda en cuarentena y no se reintenta", async () => {
    const b = banco({
      respuestas: [
        {
          status: 200,
          body: {
            request_date_ms: NOW,
            subscriber: {
              original_app_user_id: "user_b_custom",
              entitlements: {},
              subscriptions: {},
              non_subscriptions: {}
            }
          }
        }
      ]
    });
    await b.encolar();
    const { pedidos, job } = await b.drenar();
    assert.equal(pedidos.length, 1);
    assert.equal(job?.outcome, "subscriber_identity_mismatch");
    assert.equal(job?.status, "settled");
  });

  it("un original ANÓNIMO tampoco es autoridad, y tampoco se reintenta", async () => {
    // El cliente es custom-ID-only: nunca produce un original anónimo, y el
    // mismo id anónimo puede estar aliased a dos cuentas de Clerk.
    const b = banco({
      respuestas: [
        {
          status: 200,
          body: {
            request_date_ms: NOW,
            subscriber: {
              original_app_user_id: "$RCAnonymousID:abc",
              entitlements: {
                orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" }
              },
              subscriptions: { orbita_monthly: { expires_date_ms: FUTURE, is_sandbox: true } },
              non_subscriptions: {}
            }
          }
        }
      ]
    });
    await b.encolar();
    const { pedidos, job } = await b.drenar();
    assert.equal(pedidos.length, 1);
    assert.equal(job?.outcome, "anonymous_subscriber_identity");
    assert.equal(job?.status, "settled");
  });

  it("un 503 se reintenta y la lectura buena repara", async () => {
    const b = banco({ respuestas: [{ status: 503 }, { status: 200, body: CUERPO_VALIDO }] });
    await b.encolar();
    const { pedidos, proyectados, job } = await b.drenar();
    assert.equal(pedidos.length, 2);
    assert.equal(proyectados[0].kind, "unavailable");
    assert.equal(proyectados[1].kind, "resolved");
    assert.equal(job?.status, "settled");
  });

  it("un `active_without_environment` se reintenta y no muta nada", async () => {
    // P1 3: antes esto resolvía sin entorno, el proyector no concedía y el
    // trabajo se liquidaba igual — reparación cerrada sin reparar.
    const sinEntorno = {
      request_date_ms: NOW,
      subscriber: {
        original_app_user_id: "user_a",
        entitlements: {
          orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" }
        },
        subscriptions: {},
        non_subscriptions: {}
      }
    };
    const b = banco({
      respuestas: [{ status: 200, body: sinEntorno }, { status: 200, body: CUERPO_VALIDO }]
    });
    await b.encolar();
    const { pedidos, proyectados, job } = await b.drenar();
    assert.equal(proyectados[0].reason, "active_without_environment");
    assert.equal(pedidos.length, 2, "se vuelve a pedir");
    assert.equal(job?.status, "settled");
    assert.equal(job?.outcome, "resolved");
  });

  it("un producto permanente sin declarar liquida sin tormenta", async () => {
    // P1 8: es una decisión de CATÁLOGO —el V1 es mensual y la allowlist está
    // vacía a propósito—, no una ventana. La próxima lectura diría lo mismo, y
    // reintentarla cuatro veces sólo gasta cupo contra la API.
    const sinDeclarar = {
      request_date_ms: NOW,
      subscriber: {
        original_app_user_id: "user_a",
        entitlements: {
          orbita_pro: { expires_date: null, product_identifier: "orbita_lifetime" }
        },
        subscriptions: {},
        non_subscriptions: {
          orbita_lifetime: [
            { id: "tx_1", is_sandbox: false, purchase_date: "2025-01-01T00:00:00Z", store: "app_store" }
          ]
        }
      }
    };
    const b = banco({ respuestas: [{ status: 200, body: sinDeclarar }] });
    await b.encolar();
    const { pedidos, proyectados, job, pendientes } = await b.drenar(80);
    assert.equal(pedidos.length, 1, "una sola lectura");
    assert.equal(proyectados[0].reason, "lifetime_product_not_allowlisted");
    assert.equal(job?.status, "settled");
    assert.equal(job?.outcome, "lifetime_product_not_allowlisted");
    assert.equal(pendientes, 0);
  });

  it("un JSON ilegible es transitorio y se vuelve a pedir", async () => {
    const b = banco({
      respuestas: [{ status: 200, body: "no-es-json" }, { status: 200, body: CUERPO_VALIDO }]
    });
    await b.encolar();
    const { pedidos, proyectados, job } = await b.drenar();
    assert.equal(pedidos.length, 2);
    assert.equal(proyectados[0].reason, "invalid_shape");
    assert.equal(job?.status, "settled");
  });

  it("un 429 permanente se agota en el techo y cierra el trabajo", async () => {
    const b = banco({ respuestas: [{ status: 429 }] });
    await b.encolar();
    const { pedidos, job, pendientes } = await b.drenar(80);
    assert.equal(pedidos.length, RECONCILE_MAX_ATTEMPTS);
    assert.equal(job?.status, "settled");
    assert.equal(job?.outcome, "exhausted");
    assert.equal(pendientes, 0);
  });

  it("una proyección que SIEMPRE falla tampoco gira para siempre", async () => {
    const b = banco({
      respuestas: [{ status: 200, body: CUERPO_VALIDO }],
      proyeccionFalla: [1, 2, 3, 4, 5, 6, 7, 8]
    });
    await b.encolar();
    const { pedidos, job, pendientes } = await b.drenar(80);
    assert.equal(pedidos.length, RECONCILE_MAX_ATTEMPTS);
    assert.equal(job?.status, "settled");
    assert.equal(job?.outcome, "exhausted");
    assert.equal(pendientes, 0);
  });

  it("liquidar dos veces el mismo trabajo no lo reabre ni lo pisa", async () => {
    const b = banco({ respuestas: [{ status: 200, body: CUERPO_VALIDO }] });
    await b.encolar();
    await b.drenar();
    const antes = { ...b.job() };
    await settleHandler(b.ctxMutation, {
      jobId: antes._id,
      clerkUserId: "user_a",
      lease: "1:1:1",
      result: "settled",
      outcome: "otra_cosa"
    });
    assert.equal(b.job()?.outcome, antes.outcome);
    assert.equal(b.job()?.status, "settled");
  });
});

describe("P1 8 — se conservan el timeout y el cupo por cuenta", () => {
  it("la lectura sigue teniendo un corte propio", () => {
    assert.ok(RECONCILE_FETCH_TIMEOUT_MS > 0 && RECONCILE_FETCH_TIMEOUT_MS <= 30_000);
  });

  it("el cupo de la comprobación del cliente sigue siendo por cuenta y acotado", () => {
    assert.equal(RECONCILE_COOLDOWN.scope, "revenuecat_reconcile");
    assert.ok(RECONCILE_COOLDOWN.max >= 1 && RECONCILE_COOLDOWN.max <= 10);
    assert.ok(RECONCILE_COOLDOWN.windowMs >= 10_000);
  });
});
