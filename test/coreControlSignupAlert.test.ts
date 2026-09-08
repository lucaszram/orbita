/**
 * El aviso de cuenta nueva sale por core-control — entrega, reintentos,
 * deduplicación y privacidad.
 *
 * ## Qué se prueba acá
 *
 * La tarjeta promete dos cosas medibles: que un alta produzca **exactamente un
 * aviso** en core-control, y que Órbita **no vuelva a intentar Telegram por su
 * cuenta**. Las dos se prueban contra las funciones REALES —`getOrCreateUser`,
 * `coreControl.signupPayload` y `coreControl.sendSignup`— con la base en
 * memoria y `fetch` instrumentado: lo que se mide es lo que queda escrito y lo
 * que sale por la red, no un doble.
 *
 * Los handlers de Convex se invocan por `_handler`, que es la función que el
 * runtime termina llamando. Llamar la registración directamente funciona pero
 * imprime la advertencia de "no llames funciones de Convex desde funciones de
 * Convex" y no aporta nada.
 *
 * ## El defecto que cierra la prueba de regresión
 *
 * El aviso colgaba de `users.getOrCreateCurrentUser` y sólo se agendaba cuando
 * ESA llamada era la que creaba la fila. Pero veintitrés mutations llegan a
 * `getOrCreateUser` por `requireUser`, y `onboarding.saveDraft` lo llama
 * directo: si cualquiera de ellas insertaba la cuenta primero, el `ensureUser`
 * posterior ya la encontraba creada y el alta se quedaba sin aviso para
 * siempre. Es exactamente el síntoma de la tarjeta —cuentas creadas, cero
 * avisos—, así que tiene su propio test.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it } from "node:test";
import { getFunctionName } from "convex/server";

import { SIGNUP_RETRY_DELAYS_MS, sendSignup, signupPayload } from "../convex/coreControl";
import { SEND_SIGNUP_REF_NAME, getOrCreateUser, requireUser } from "../convex/lib/users";
import { createMemoryDb, type MemoryDb } from "./convexMemoryDb";
import { ROOT } from "./moduleGraph";

const ENDPOINT = "https://core-control.test/hooks/signup";
const SECRET = "shhh-core-control";

const IDENTIDAD = {
  subject: "user_2abcDEFghiJKLmno",
  tokenIdentifier: "https://clerk.dev|user_2abcDEFghiJKLmno",
  email: "Ana@Orbita.Test",
  givenName: "Ana",
  familyName: "Pérez",
  name: "Ana Pérez"
};

const OTRA_IDENTIDAD = {
  subject: "user_9zyxWVUtsrQPOnml",
  tokenIdentifier: "https://clerk.dev|user_9zyxWVUtsrQPOnml",
  email: "bruno@orbita.test",
  givenName: "Bruno"
};

/** El cuerpo real del handler registrado. */
type Handler = (ctx: any, args: any) => Promise<any>;
const handlerDe = (fn: unknown): Handler => (fn as { _handler: Handler })._handler;

type Agendado = { delayMs: number; ref: string; args: any };

/** Ctx de mutation: lo que reciben `getOrCreateUser` y `requireUser`. */
function ctxDeMutation(memoria: MemoryDb, identity: unknown, agendados: Agendado[]) {
  return {
    auth: { getUserIdentity: async () => identity },
    db: memoria.db,
    scheduler: {
      runAfter: async (delayMs: number, ref: any, args: any) => {
        agendados.push({ delayMs, ref: getFunctionName(ref), args });
      }
    }
  } as any;
}

/** Ctx de action: `runQuery` resuelve contra la query REAL, por su nombre. */
function ctxDeAction(memoria: MemoryDb, agendados: Agendado[]) {
  return {
    runQuery: async (ref: any, args: any) => {
      assert.equal(getFunctionName(ref), "coreControl:signupPayload");
      return await handlerDe(signupPayload)({ db: memoria.db }, args);
    },
    scheduler: {
      runAfter: async (delayMs: number, ref: any, args: any) => {
        agendados.push({ delayMs, ref: getFunctionName(ref), args });
      }
    }
  } as any;
}

type Pedido = { url: string; init: any; body: any };

/**
 * Reemplaza `fetch` y devuelve los pedidos que salieron. `responder` decide qué
 * pasa en cada intento: `true`/`false` es la respuesta HTTP, `"caída"` es el
 * error de red que la action tiene que tragarse.
 */
async function conFetch<T>(
  responder: (intento: number) => boolean | "caída" | number,
  cuerpo: (pedidos: Pedido[]) => Promise<T>
): Promise<T> {
  const original = globalThis.fetch;
  const pedidos: Pedido[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const respuesta = responder(pedidos.length);
    pedidos.push({ url: String(url), init, body: JSON.parse(String(init.body)) });
    if (respuesta === "caída") throw new Error("ECONNRESET");
    const status = typeof respuesta === "number" ? respuesta : respuesta ? 200 : 503;
    return { ok: status >= 200 && status < 300, status } as any;
  }) as any;
  try {
    return await cuerpo(pedidos);
  } finally {
    globalThis.fetch = original;
  }
}

/** Corre con la configuración de core-control puesta, y la deja como estaba. */
async function conEntorno<T>(
  env: { url?: string; secret?: string },
  cuerpo: () => Promise<T>
): Promise<T> {
  const previos = {
    url: process.env.CORE_CONTROL_SIGNUP_URL,
    secret: process.env.CORE_CONTROL_SIGNUP_SECRET
  };
  const poner = (clave: string, valor: string | undefined) => {
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  };
  poner("CORE_CONTROL_SIGNUP_URL", env.url);
  poner("CORE_CONTROL_SIGNUP_SECRET", env.secret);
  try {
    return await cuerpo();
  } finally {
    poner("CORE_CONTROL_SIGNUP_URL", previos.url);
    poner("CORE_CONTROL_SIGNUP_SECRET", previos.secret);
  }
}

const CONFIGURADO = { url: ENDPOINT, secret: SECRET };

/** Una base vacía con el ctx de mutation listo, para probar dónde nace el aviso. */
function alta(identity: unknown = IDENTIDAD) {
  const memoria = createMemoryDb();
  const agendados: Agendado[] = [];
  return { memoria, agendados, ctx: ctxDeMutation(memoria, identity, agendados) };
}

/**
 * Una cuenta REAL ya creada, con su `userId`.
 *
 * La fila la escribe `getOrCreateUser` y no `seed`, así que las pruebas de
 * entrega corren contra la forma exacta que tiene una cuenta en producción. El
 * `userId` sale de la tabla y no del trabajo agendado a propósito: dónde se
 * engancha el aviso es asunto del bloque 1, y estas pruebas tienen que fallar
 * por lo que miden ellas, no por el enganche.
 */
async function cuentaCreada(identity: unknown = IDENTIDAD) {
  const memoria = createMemoryDb();
  await getOrCreateUser(ctxDeMutation(memoria, identity, []));
  return { memoria, userId: memoria.rows("users")[0]._id as string, agendados: [] as Agendado[] };
}

// ---------------------------------------------------------------------------
// 1 · un alta produce exactamente un aviso
// ---------------------------------------------------------------------------

describe("un alta produce exactamente un aviso", () => {
  it("crear la cuenta agenda UN aviso, inmediato y sólo con el userId", async () => {
    const { memoria, agendados, ctx } = alta();
    const user = await getOrCreateUser(ctx);

    assert.equal(agendados.length, 1, "un aviso, ni cero ni dos");
    assert.equal(agendados[0].ref, SEND_SIGNUP_REF_NAME);
    assert.equal(agendados[0].ref, "coreControl:sendSignup", "el nombre que el runtime resuelve");
    assert.equal(agendados[0].delayMs, 0, "el alta no espera a la entrega");
    assert.deepEqual(
      agendados[0].args,
      { userId: user!._id },
      "sólo el userId: el email se lee después, ya dentro de la action"
    );
    assert.equal(memoria.rows("users").length, 1);
  });

  it("volver a entrar con la misma identidad NO agenda un segundo aviso", async () => {
    const { agendados, ctx } = alta();
    await getOrCreateUser(ctx);
    await getOrCreateUser(ctx);
    await getOrCreateUser(ctx);
    assert.equal(agendados.length, 1, "el aviso cuelga del insert, no de la llamada");
  });

  it("REGRESIÓN: el alta que nace por OTRA mutation también avisa", async () => {
    // `requireUser` es el camino de veintitrés mutations (birthData, journal,
    // readings, onboarding…). Con el aviso colgado de `getOrCreateCurrentUser`,
    // una cuenta nacida acá no avisaba nunca: la llamada siguiente ya la
    // encontraba creada. Ése es el síntoma de la tarjeta.
    const { agendados, ctx } = alta();
    const user = await requireUser(ctx);
    assert.equal(agendados.length, 1, "la cuenta nació acá: el aviso sale igual");
    assert.deepEqual(agendados[0].args, { userId: user._id });

    // Y el `ensureUser` que llega después no duplica.
    await getOrCreateUser(ctx);
    assert.equal(agendados.length, 1);
  });

  it("dos cuentas distintas producen dos avisos, uno por cuenta", async () => {
    const memoria = createMemoryDb();
    const agendados: Agendado[] = [];
    const a = await getOrCreateUser(ctxDeMutation(memoria, IDENTIDAD, agendados));
    const b = await getOrCreateUser(ctxDeMutation(memoria, OTRA_IDENTIDAD, agendados));

    assert.equal(agendados.length, 2);
    assert.deepEqual(
      agendados.map((x) => x.args.userId),
      [a!._id, b!._id]
    );
  });
});

// ---------------------------------------------------------------------------
// 2 · qué viaja, y qué no
// ---------------------------------------------------------------------------

describe("del alta sólo viajan producto, email y el identificador del evento", () => {
  it("el cuerpo tiene EXACTAMENTE esas cuatro claves", async () => {
    const { memoria, userId, agendados } = await cuentaCreada();

    await conEntorno(CONFIGURADO, () =>
      conFetch(
        () => true,
        async (pedidos) => {
          const entregado = await handlerDe(sendSignup)(
            ctxDeAction(memoria, agendados),
            { userId }
          );
          assert.equal(entregado, true);
          assert.equal(pedidos.length, 1);
          assert.deepEqual(Object.keys(pedidos[0].body).sort(), [
            "appSlug",
            "email",
            "eventId",
            "occurredAt"
          ]);
          assert.equal(pedidos[0].body.appSlug, "orbita");
          assert.equal(pedidos[0].body.email, "ana@orbita.test", "normalizado");
          assert.equal(pedidos[0].init.method, "POST");
          assert.equal(pedidos[0].init.headers.authorization, `Bearer ${SECRET}`);
        }
      )
    );
  });

  it("nada más de la persona entra en el pedido", async () => {
    const { memoria, userId, agendados } = await cuentaCreada();

    await conEntorno(CONFIGURADO, () =>
      conFetch(
        () => true,
        async (pedidos) => {
          await handlerDe(sendSignup)(ctxDeAction(memoria, agendados), { userId });
          const crudo = JSON.stringify(pedidos[0].body);
          for (const ajeno of [IDENTIDAD.givenName, IDENTIDAD.familyName, IDENTIDAD.name, IDENTIDAD.tokenIdentifier]) {
            assert.ok(!crudo.includes(ajeno), `${ajeno} no tiene por qué viajar`);
          }
        }
      )
    );
  });

  it("el email no queda escrito en ninguna tabla nueva de Órbita", async () => {
    const { memoria, userId, agendados } = await cuentaCreada();
    await conEntorno(CONFIGURADO, () =>
      conFetch(
        () => "caída",
        async () => {
          await handlerDe(sendSignup)(ctxDeAction(memoria, agendados), { userId });
        }
      )
    );

    // La única fila que puede tener el email es la cuenta misma: es su registro,
    // no una copia nueva creada por el aviso.
    for (const tabla of ["productEvents", "productActors", "productDigests", "onboardingDrafts"]) {
      const crudo = JSON.stringify(memoria.rows(tabla));
      assert.ok(!crudo.toLowerCase().includes("orbita.test"), `${tabla} no guarda el email`);
    }
    // Y tampoco viaja en los argumentos del trabajo agendado, que Convex sí persiste.
    for (const agendado of agendados) {
      assert.ok(!JSON.stringify(agendado.args).toLowerCase().includes("orbita.test"));
      for (const clave of Object.keys(agendado.args)) {
        assert.ok(["userId", "attempt"].includes(clave), `el trabajo agendado no debería llevar \`${clave}\``);
      }
    }
  });

  it("la entrega no loguea: ni el email ni el fallo salen por consola", async () => {
    const { memoria, userId, agendados } = await cuentaCreada();

    const metodos = ["log", "info", "warn", "error", "debug"] as const;
    const originales = metodos.map((m) => console[m]);
    const escrito: string[] = [];
    for (const m of metodos) console[m] = ((...args: unknown[]) => escrito.push(args.join(" "))) as any;
    try {
      await conEntorno(CONFIGURADO, () =>
        conFetch(
          (intento) => (intento === 0 ? "caída" : 500),
          async () => {
            // Los dos fallos que la action tiene que tragarse callada: la red
            // que se corta y el endpoint que contesta 500.
            await handlerDe(sendSignup)(ctxDeAction(memoria, agendados), { userId });
            await handlerDe(sendSignup)(ctxDeAction(memoria, agendados), agendados[0].args);
          }
        )
      );
    } finally {
      metodos.forEach((m, i) => (console[m] = originales[i]));
    }
    assert.deepEqual(escrito, [], "ni un fallo de red justifica dejar el email en los logs");
  });
});

// ---------------------------------------------------------------------------
// 3 · entrega y reintentos
// ---------------------------------------------------------------------------

describe("entrega y reintentos", () => {
  it("una entrega exitosa no reintenta", async () => {
    const { memoria, userId, agendados } = await cuentaCreada();
    const posteriores: Agendado[] = [];

    await conEntorno(CONFIGURADO, () =>
      conFetch(
        () => true,
        async (pedidos) => {
          const ok = await handlerDe(sendSignup)(ctxDeAction(memoria, posteriores), { userId });
          assert.equal(ok, true);
          assert.equal(pedidos.length, 1);
          assert.deepEqual(posteriores, [], "nada que reintentar");
        }
      )
    );
  });

  it("un fallo transitorio reintenta UNA vez, y el reintento no duplica el aviso", async () => {
    const { memoria, userId, agendados } = await cuentaCreada();
    const posteriores: Agendado[] = [];

    await conEntorno(CONFIGURADO, () =>
      conFetch(
        (intento) => (intento === 0 ? "caída" : true),
        async (pedidos) => {
          const primero = await handlerDe(sendSignup)(ctxDeAction(memoria, posteriores), { userId });
          assert.equal(primero, false);
          assert.deepEqual(posteriores.length, 1, "un solo reintento agendado");
          assert.equal(posteriores[0].delayMs, SIGNUP_RETRY_DELAYS_MS[0]);
          assert.deepEqual(posteriores[0].args, { userId, attempt: 1 });

          const segundo = await handlerDe(sendSignup)(ctxDeAction(memoria, posteriores), posteriores[0].args);
          assert.equal(segundo, true);
          assert.equal(posteriores.length, 1, "entregado: la cadena se corta");

          // Salieron dos pedidos, pero con el MISMO eventId: core-control
          // deduplica por su hash, así que del otro lado hay un solo aviso.
          assert.equal(pedidos.length, 2);
          assert.equal(pedidos[0].body.eventId, pedidos[1].body.eventId);
          assert.equal(new Set(pedidos.map((p) => p.body.eventId)).size, 1);
        }
      )
    );
  });

  it("un 500 se reintenta; un 200 corta la cadena", async () => {
    for (const [status, esperado] of [[500, 1], [200, 0]] as const) {
      const { memoria, userId } = await cuentaCreada();
      const posteriores: Agendado[] = [];
      await conEntorno(CONFIGURADO, () =>
        conFetch(
          () => status,
          async () => {
            await handlerDe(sendSignup)(ctxDeAction(memoria, posteriores), { userId });
          }
        )
      );
      assert.equal(posteriores.length, esperado, `status ${status}`);
    }
  });

  it("los reintentos respetan sus plazos y la cadena TERMINA", async () => {
    const { memoria, userId, agendados } = await cuentaCreada();
    const posteriores: Agendado[] = [];

    await conEntorno(CONFIGURADO, () =>
      conFetch(
        () => "caída",
        async (pedidos) => {
          let siguiente: any = { userId };
          // Cota dura: si la cadena no terminara, este for lo diría en vez de
          // colgarse. Se pide una vuelta MÁS de las que debería haber.
          for (let i = 0; i < SIGNUP_RETRY_DELAYS_MS.length + 3 && siguiente; i += 1) {
            const antes = posteriores.length;
            await handlerDe(sendSignup)(ctxDeAction(memoria, posteriores), siguiente);
            siguiente = posteriores.length > antes ? posteriores[posteriores.length - 1].args : null;
          }

          assert.deepEqual(
            posteriores.map((p) => p.delayMs),
            [...SIGNUP_RETRY_DELAYS_MS],
            "un minuto, cinco, media hora y dos horas"
          );
          assert.deepEqual(
            posteriores.map((p) => p.args.attempt),
            [1, 2, 3, 4]
          );
          assert.equal(pedidos.length, SIGNUP_RETRY_DELAYS_MS.length + 1, "cinco entregas y se acabó");
        }
      )
    );

    // Los plazos crecen y el total está acotado: nada gira para siempre.
    const total = SIGNUP_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
    assert.ok(total < 3 * 60 * 60_000, `la cadena entera dura ${total}ms`);
    for (let i = 1; i < SIGNUP_RETRY_DELAYS_MS.length; i += 1) {
      assert.ok(SIGNUP_RETRY_DELAYS_MS[i] > SIGNUP_RETRY_DELAYS_MS[i - 1], "los plazos crecen");
    }
  });

  it("sin configuración no hay pedido NI cadena de reintentos", async () => {
    for (const env of [{}, { url: ENDPOINT }, { secret: SECRET }]) {
      const { memoria, userId } = await cuentaCreada();
      const posteriores: Agendado[] = [];
      await conEntorno(env, () =>
        conFetch(
          () => true,
          async (pedidos) => {
            const ok = await handlerDe(sendSignup)(ctxDeAction(memoria, posteriores), { userId });
            assert.equal(ok, false);
            assert.deepEqual(pedidos, [], "sin secreto no se sale a la red");
          }
        )
      );
      assert.deepEqual(posteriores, [], "una config incompleta no se arregla esperando");
    }
  });

  it("un endpoint que no es https no recibe el secreto", async () => {
    const { memoria, userId, agendados } = await cuentaCreada();
    const posteriores: Agendado[] = [];
    await conEntorno({ url: "http://core-control.test/hooks/signup", secret: SECRET }, () =>
      conFetch(
        () => true,
        async (pedidos) => {
          assert.equal(await handlerDe(sendSignup)(ctxDeAction(memoria, posteriores), { userId }), false);
          assert.deepEqual(pedidos, [], "el Bearer no viaja en claro");
        }
      )
    );
    assert.deepEqual(posteriores, []);
  });
});

// ---------------------------------------------------------------------------
// 4 · la clave con la que core-control deduplica
// ---------------------------------------------------------------------------

describe("deduplicación: el eventId es el identificador estable de la cuenta", () => {
  it("es el id de Clerk, no el id interno de Convex", async () => {
    const { memoria, userId, agendados } = await cuentaCreada();

    await conEntorno(CONFIGURADO, () =>
      conFetch(
        () => true,
        async (pedidos) => {
          await handlerDe(sendSignup)(ctxDeAction(memoria, agendados), { userId });
          assert.equal(pedidos[0].body.eventId, IDENTIDAD.subject);
          assert.equal(pedidos[0].body.eventId, memoria.rows("users")[0].clerkUserId);
          assert.notEqual(pedidos[0].body.eventId, String(userId), "el id interno no es estable entre entornos");
        }
      )
    );
  });

  it("no cambia entre reintentos aunque cambien el email y el nombre", async () => {
    const { memoria, userId, agendados } = await cuentaCreada();
    const posteriores: Agendado[] = [];

    await conEntorno(CONFIGURADO, () =>
      conFetch(
        (intento) => (intento === 0 ? "caída" : true),
        async (pedidos) => {
          await handlerDe(sendSignup)(ctxDeAction(memoria, posteriores), { userId });

          // Entre un intento y el otro la persona cambia su email en Clerk: el
          // patch de `getOrCreateUser` lo baja a la fila. Si el eventId saliera
          // de ahí, el reintento contaría como un alta nueva del otro lado.
          await memoria.db.patch(memoria.rows("users")[0]._id, {
            email: "ana.nueva@orbita.test",
            name: "Ana Otra"
          });
          await handlerDe(sendSignup)(ctxDeAction(memoria, posteriores), posteriores[0].args);

          assert.equal(pedidos[0].body.eventId, pedidos[1].body.eventId, "la clave no se mueve");
          assert.equal(pedidos[0].body.occurredAt, pedidos[1].body.occurredAt, "la fecha del alta tampoco");
          assert.notEqual(pedidos[0].body.email, pedidos[1].body.email, "el email sí es el vigente");
        }
      )
    );
  });

  it("sin email no hay aviso ni cadena de reintentos", async () => {
    const memoria = createMemoryDb();
    const agendados: Agendado[] = [];
    const userId = memoria.seed("users", {
      tokenIdentifier: "https://clerk.dev|user_sin_mail",
      clerkUserId: "user_sin_mail",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000
    });

    await conEntorno(CONFIGURADO, () =>
      conFetch(
        () => true,
        async (pedidos) => {
          assert.equal(await handlerDe(sendSignup)(ctxDeAction(memoria, agendados), { userId }), false);
          assert.deepEqual(pedidos, []);
        }
      )
    );
    assert.deepEqual(agendados, [], "no es un fallo que se resuelva reintentando");
  });
});

// ---------------------------------------------------------------------------
// 5 · no queda ningún camino que intente Telegram desde Órbita
// ---------------------------------------------------------------------------

describe("Órbita ya no tiene forma de hablar con Telegram", () => {
  /** Los archivos de código del árbol, sin `node_modules` ni bitácoras. */
  function fuentes(dir: string): string[] {
    const salida: string[] = [];
    for (const entrada of readdirSync(dir)) {
      const absoluto = join(dir, entrada);
      if (statSync(absoluto).isDirectory()) {
        if (entrada === "node_modules" || entrada === "_generated") continue;
        salida.push(...fuentes(absoluto));
        continue;
      }
      if (/\.(t|j)sx?$/.test(entrada)) salida.push(absoluto);
    }
    return salida;
  }

  // El token, el chat y el host de la API: los tres marcadores de un cliente de
  // Telegram. La palabra suelta no sirve como criterio —`src/analytics/
  // routeClassification.ts` la usa como host de referrer, que es otra cosa— y
  // `convex/CHANGELOG.md` es historia, no código.
  const MARCADORES = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "api.telegram.org", "sendTelegram"];

  it("ni `convex/` ni `src/` conservan token, chat, host ni cliente", () => {
    const culpables: string[] = [];
    for (const archivo of [...fuentes(join(ROOT, "convex")), ...fuentes(join(ROOT, "src"))]) {
      const fuente = readFileSync(archivo, "utf8");
      for (const marcador of MARCADORES) {
        if (fuente.includes(marcador)) culpables.push(`${relative(ROOT, archivo).split(sep).join("/")} → ${marcador}`);
      }
    }
    assert.deepEqual(culpables, [], "el envío propio tiene que haber desaparecido del código");
  });

  it("`convex/notify.ts` no existe y nadie lo importa", () => {
    assert.ok(!existsSync(join(ROOT, "convex/notify.ts")), "el cliente de Telegram se borró");
    for (const archivo of fuentes(join(ROOT, "convex"))) {
      assert.ok(!/from\s+["']\.\/notify["']/.test(readFileSync(archivo, "utf8")), archivo);
    }
  });

  it("el cron no agenda ningún envío propio", () => {
    const crons = readFileSync(join(ROOT, "convex/crons.ts"), "utf8");
    assert.doesNotMatch(crons, /crons\.(daily|cron|interval|hourly|weekly|monthly)\(/, "no queda trabajo programado");
    assert.match(crons, /core-control/, "y el archivo dice dónde viven ahora");
  });

  it("`.env.example` ya no pide credenciales de Telegram, y sí las de core-control", () => {
    const env = readFileSync(join(ROOT, ".env.example"), "utf8");
    for (const marcador of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]) {
      assert.ok(!env.includes(marcador), `${marcador} no se configura más en Órbita`);
    }
    assert.match(env, /^CORE_CONTROL_SIGNUP_URL=/m);
    assert.match(env, /^CORE_CONTROL_SIGNUP_SECRET=/m);
    assert.ok(!/EXPO_PUBLIC_CORE_CONTROL/.test(env), "el secreto no puede ser público");
  });

  it("`appOpened` sigue existiendo para los builds viejos, y ya no manda nada", async () => {
    const telemetry = readFileSync(join(ROOT, "convex/telemetry.ts"), "utf8");
    assert.match(telemetry, /export const appOpened = mutation\(/, "InstallPing la sigue llamando");
    assert.ok(!/scheduler\.runAfter/.test(telemetry), "y ya no agenda ningún envío");

    // El cliente del ping sigue apuntando al mismo binding: quitarlo rompería
    // los builds ya publicados, que llaman a esta mutation.
    assert.match(
      readFileSync(join(ROOT, "src/components/InstallPing.tsx"), "utf8"),
      /proposedApi\.appOpened/
    );
    assert.match(
      readFileSync(join(ROOT, "src/services/appRefs.ts"), "utf8"),
      /appOpened: anyApi\.telemetry\.appOpened/
    );
  });
});
