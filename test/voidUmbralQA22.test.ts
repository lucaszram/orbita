/**
 * QA22 · bloque 1 — El Umbral: entrada inmediata, salida siempre visible y un
 * límite que informa.
 *
 * Los tres hallazgos del registro físico del build 22
 * (`native-v492/docs/QA-FISICA-BUILD22.md`):
 *
 * - **QA22-001** — “la pantalla queda durante demasiado tiempo en *Cargando tu
 *   cielo…* antes de permitir usar El Umbral”. La interfaz esperaba la lectura
 *   del día **y** la generación de preguntas sugeridas. El registro agrega una
 *   condición que es fácil de romper al optimizar: la entrada “caliente” ya era
 *   rápida y la corrección **no puede invalidar esa mejora**.
 * - **QA22-002** — “la respuesta no muestra flecha, *Otra pregunta* ni ninguna
 *   acción para regresar al selector… la persona queda atrapada”. La salida
 *   tiene que estar disponible **durante carga, interacción y resultado**.
 * - **QA22-031** — el cupo agotado mostraba *Por hoy alcanzó* y una frase
 *   editorial, sin decir cuántas preguntas se usaron.
 *
 * Qué se prueba y cómo: las decisiones puras se corren (viven en
 * `src/domain/voidSession.ts` justamente para eso); la query nueva se corre
 * contra la base Convex en memoria, con `fetch` saboteado para que salir a la
 * red sea un fallo y no una sospecha; la composición de la pantalla se lee de
 * la fuente, que es lo único que se puede afirmar sin montar React Native.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { localDateForTimezone } from "../convex/daily";
import { suggestedToday, today as voidToday } from "../convex/void";
import {
  resetVoidInteraction,
  shouldGenerateVoidPrompts,
  VOID_NEW_QUESTION_LABEL,
  voidDailyLimitCopy,
  voidSuggestionsState
} from "../src/domain/voidSession";
import { createMemoryDb, type MemoryDb } from "./convexMemoryDb";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const UMBRAL = sinComentarios(leer("src/components/void/VoidExperience.tsx"));
const VOID_BACKEND = leer("convex/void.ts");
const APP_REFS = leer("src/services/appRefs.ts");

const TZ = "America/Argentina/Buenos_Aires";
const HOY = localDateForTimezone(TZ, new Date());
const AYER = localDateForTimezone(TZ, new Date(Date.now() - 24 * 60 * 60 * 1000));

const IDENTIDAD = {
  subject: "user_2abcDEFghiJKLmno",
  tokenIdentifier: "https://clerk.dev|user_2abcDEFghiJKLmno"
};

/** Un set de sugeridas con la forma que escribe `persistPromptSet`. */
const SET_DEL_DIA = {
  categories: [
    { key: "yo", label: "Yo", glyph: "☉", prompts: ["¿Qué estás apurando?", "¿Qué te estás exigiendo?"] },
    { key: "amor", label: "Amor", glyph: "♀", prompts: ["¿Qué te cuesta pedir?"] }
  ]
};

// ---------------------------------------------------------------------------
// Invocación de las functions REALES de Convex
// ---------------------------------------------------------------------------

type Handler<T> = { _handler: (ctx: unknown, args: Record<string, never>) => Promise<T> };

function contexto(memoria: MemoryDb, identity: typeof IDENTIDAD | null) {
  return { auth: { getUserIdentity: async () => identity }, db: memoria.db };
}

/**
 * Corre `suggestedToday` con la red saboteada.
 *
 * El punto entero de la query es no pagar un LLM: si el camino llegara al AI
 * Gateway —hoy, o dentro de seis meses porque alguien reusó un helper— esto
 * falla nombrando la causa en vez de ponerse lento en producción.
 */
async function leerSetDelDia(ctx: unknown) {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("suggestedToday salió a la red");
  }) as unknown as typeof fetch;
  try {
    return await (suggestedToday as unknown as Handler<{ categories: unknown[] } | null>)._handler(ctx, {});
  } finally {
    globalThis.fetch = fetchOriginal;
  }
}

const leerCupo = (ctx: unknown) =>
  (voidToday as unknown as Handler<{ limit: number; used: number; remaining: number; isPro: boolean }>)._handler(
    ctx,
    {}
  );

/** Una cuenta con su lugar natal cargado, que es lo que fija el día civil. */
function cuenta(): { memoria: MemoryDb; userId: string } {
  const memoria = createMemoryDb();
  const userId = memoria.seed("users", { tokenIdentifier: IDENTIDAD.tokenIdentifier, email: "a@orbita.test" });
  memoria.seed("birthData", { userId, timezone: TZ, birthDate: "1994-05-04" });
  return { memoria, userId };
}

// ---------------------------------------------------------------------------
// 1 · las decisiones puras
// ---------------------------------------------------------------------------

describe("QA22-031 · el cupo agotado declara el estado concreto", () => {
  it("usa el copy exacto, con el límite real del día", () => {
    // El registro lo escribe así, textual, con la cuota Plus.
    assert.equal(voidDailyLimitCopy(5), "Usaste tus 5 preguntas de hoy. Volvé mañana para hacer más.");
    assert.equal(voidDailyLimitCopy(3), "Usaste tus 3 preguntas de hoy. Volvé mañana para hacer más.");
  });

  it("el número es el límite, no el consumo ni un texto fijo", () => {
    assert.notEqual(voidDailyLimitCopy(5), voidDailyLimitCopy(3));
    assert.match(voidDailyLimitCopy(5), /\b5\b/);
  });
});

describe("QA22-002 · volver al selector resetea la interacción y NADA más", () => {
  it("devuelve la entrada vacía", () => {
    assert.deepEqual(resetVoidInteraction(), {
      phase: "entrada",
      typed: "",
      payload: null,
      locked: false,
      askFailed: false
    });
  });

  it("no existe un campo de cuota que este camino pueda tocar", () => {
    // La garantía es de FORMA: sin campo de cuota en el resultado, volver al
    // selector no puede devolver ni consumir una pregunta aunque alguien lo
    // intentara. La cuota la publica `void.today`, que es reactiva.
    const claves = Object.keys(resetVoidInteraction()).sort();
    assert.deepEqual(claves, ["askFailed", "locked", "payload", "phase", "typed"]);
  });

  it("la etiqueta es la que pide el registro", () => {
    assert.equal(VOID_NEW_QUESTION_LABEL, "HACER OTRA PREGUNTA");
  });
});

describe("QA22-001 · cuándo se dispara la generación (y con ella el LLM)", () => {
  it("mientras la query viaja, NO: `undefined` no es «no hay set»", () => {
    assert.equal(shouldGenerateVoidPrompts({ cached: undefined, generated: false }), false);
  });

  it("con el set del día cacheado, NO: esa es la carga caliente que no hay que invalidar", () => {
    assert.equal(shouldGenerateVoidPrompts({ cached: { categories: [{}, {}] }, generated: false }), false);
  });

  it("sin set del día, SÍ", () => {
    assert.equal(shouldGenerateVoidPrompts({ cached: null, generated: false }), true);
  });

  it("un set vacío cuenta como sin set", () => {
    assert.equal(shouldGenerateVoidPrompts({ cached: { categories: [] }, generated: false }), true);
  });

  it("ya generado en esta sesión, NO se vuelve a generar", () => {
    // Si no, la propia respuesta de la action —que además persiste el set—
    // volvería a entrar por el efecto.
    assert.equal(shouldGenerateVoidPrompts({ cached: null, generated: true }), false);
  });
});

describe("QA22-001 · la sección de sugeridas se resuelve sola", () => {
  it("con categorías, están listas", () => {
    assert.equal(voidSuggestionsState({ categories: [{}], failed: false }), "listas");
  });

  it("con categorías, un fallo posterior no borra lo que ya se puede leer", () => {
    assert.equal(voidSuggestionsState({ categories: [{}], failed: true }), "listas");
  });

  it("sin categorías y con fallo, es error", () => {
    assert.equal(voidSuggestionsState({ categories: null, failed: true }), "error");
  });

  it("sin nada, sigue cargando — no se rellena con el catálogo genérico", () => {
    assert.equal(voidSuggestionsState({ categories: null, failed: false }), "cargando");
    assert.equal(voidSuggestionsState({ categories: [], failed: false }), "cargando");
  });
});

// ---------------------------------------------------------------------------
// 2 · la query nueva, corrida de verdad
// ---------------------------------------------------------------------------

describe("void.suggestedToday · el set del día, sin generar nada", () => {
  it("devuelve el set cacheado del día y no sale a la red", async () => {
    const { memoria, userId } = cuenta();
    memoria.seed("voidPromptSets", { userId, localDate: HOY, payload: SET_DEL_DIA, createdAt: Date.now() });

    const salida = await leerSetDelDia(contexto(memoria, IDENTIDAD));

    assert.deepEqual(salida, SET_DEL_DIA);
  });

  it("no escribe: leer el set no crea filas", async () => {
    const { memoria, userId } = cuenta();
    memoria.seed("voidPromptSets", { userId, localDate: HOY, payload: SET_DEL_DIA, createdAt: Date.now() });

    await leerSetDelDia(contexto(memoria, IDENTIDAD));

    assert.equal(memoria.rows("voidPromptSets").length, 1);
    assert.equal(memoria.rows("voidAnswers").length, 0);
  });

  it("sin set del día devuelve null: es la señal con la que el front genera", async () => {
    const { memoria } = cuenta();

    assert.equal(await leerSetDelDia(contexto(memoria, IDENTIDAD)), null);
  });

  it("el set de AYER no se publica como el de hoy", async () => {
    const { memoria, userId } = cuenta();
    memoria.seed("voidPromptSets", { userId, localDate: AYER, payload: SET_DEL_DIA, createdAt: Date.now() });

    assert.equal(await leerSetDelDia(contexto(memoria, IDENTIDAD)), null);
  });

  it("sin sesión devuelve null, que es un estado normal y no un error", async () => {
    const { memoria } = cuenta();

    assert.equal(await leerSetDelDia(contexto(memoria, null)), null);
  });

  it("una fila deformada se descarta entera, no se publica a medias", async () => {
    // Una categoría sin preguntas dibujaría una pestaña vacía, que desde la
    // pantalla se ve igual que un bug de carga. Todo o nada.
    const { memoria, userId } = cuenta();
    memoria.seed("voidPromptSets", {
      userId,
      localDate: HOY,
      payload: { categories: [SET_DEL_DIA.categories[0], { key: "amor", label: "Amor", glyph: "♀", prompts: [] }] },
      createdAt: Date.now()
    });

    assert.equal(await leerSetDelDia(contexto(memoria, IDENTIDAD)), null);
  });

  it("un payload sin `categories` tampoco rompe el contrato de salida", async () => {
    const { memoria, userId } = cuenta();
    memoria.seed("voidPromptSets", { userId, localDate: HOY, payload: { viejo: true }, createdAt: Date.now() });

    assert.equal(await leerSetDelDia(contexto(memoria, IDENTIDAD)), null);
  });

  it("una fila sin glifo sigue siendo legible: el front dibuja su propio símbolo", async () => {
    const { memoria, userId } = cuenta();
    memoria.seed("voidPromptSets", {
      userId,
      localDate: HOY,
      payload: { categories: [{ key: "yo", label: "Yo", prompts: ["¿Qué estás apurando?"] }] },
      createdAt: Date.now()
    });

    const salida = await leerSetDelDia(contexto(memoria, IDENTIDAD));

    assert.deepEqual(salida, { categories: [{ key: "yo", label: "Yo", glyph: "", prompts: ["¿Qué estás apurando?"] }] });
  });

  it("el cupo y las sugeridas resuelven el MISMO día civil", async () => {
    // Si divergieran, la pantalla mostraría el contador de hoy al lado de las
    // preguntas de ayer. Las dos functions usan el mismo helper.
    const { memoria, userId } = cuenta();
    memoria.seed("voidPromptSets", { userId, localDate: HOY, payload: SET_DEL_DIA, createdAt: Date.now() });
    memoria.seed("voidAnswers", {
      userId,
      localDate: HOY,
      question: "¿Qué estás apurando?",
      payload: {},
      createdAt: Date.now()
    });
    const ctx = contexto(memoria, IDENTIDAD);

    const cupo = await leerCupo(ctx);
    const set = await leerSetDelDia(ctx);

    assert.equal(cupo.used, 1);
    assert.equal(cupo.limit, 3);
    assert.equal(cupo.remaining, 2);
    assert.deepEqual(set, SET_DEL_DIA);
  });
});

// ---------------------------------------------------------------------------
// 3 · el contrato publicado
// ---------------------------------------------------------------------------

describe("contrato · la query es aditiva y cerrada", () => {
  it("`suggestedToday` es una query con `returns` cerrado", () => {
    assert.match(
      VOID_BACKEND,
      /export const suggestedToday = query\(\{\s*args: \{\},\s*returns: v\.union\(v\.object\(\{ categories: v\.array\(voidPromptCategoryValidator\) \}\), v\.null\(\)\)/s
    );
    const bloque = VOID_BACKEND.slice(
      VOID_BACKEND.indexOf("export const suggestedToday"),
      VOID_BACKEND.indexOf("export const suggestedQuestions")
    );
    assert.doesNotMatch(bloque, /\bv\.any\s*\(/, "el contrato de salida no puede ser abierto");
    assert.doesNotMatch(bloque, /fetch\(|gatewayGenerateText|generateSuggestedQuestions/, "la query no genera nada");
    assert.doesNotMatch(bloque, /ctx\.db\.(insert|patch|delete)/, "es una lectura");
  });

  it("las tres functions anteriores siguen publicadas sin cambio de firma", () => {
    assert.match(VOID_BACKEND, /export const ask = action\(\{\s*args: \{\s*question: v\.string\(\)\s*\}/s);
    assert.match(VOID_BACKEND, /export const today = query\(\{\s*args: \{\},\s*returns: v\.object\(\{/s);
    assert.match(VOID_BACKEND, /export const suggestedQuestions = action\(\{\s*args: \{\},/s);
  });

  it("el día civil se resuelve con un solo helper en los tres caminos", () => {
    const usos = VOID_BACKEND.match(/await resolveVoidLocalDate\(ctx, user\._id\)/g) ?? [];
    assert.equal(usos.length, 3, `getVoidState + today + suggestedToday, hay ${usos.length}`);
  });

  it("el front declara la referencia como QUERY, no como action", () => {
    assert.match(
      APP_REFS,
      /voidSuggestedToday: anyApi\.void\.suggestedToday as FunctionReference<\s*"query",\s*"public",\s*Empty,\s*VoidSuggestedPayload \| null\s*>/s
    );
    // La action que sí genera sigue siendo una action: si alguien las confunde,
    // el front volvería a pagar un LLM en cada entrada.
    assert.match(APP_REFS, /voidSuggested: anyApi\.void\.suggestedQuestions as FunctionReference<"action"/);
  });

  it("el cambio de contrato está documentado", () => {
    const changelog = leer("convex/CHANGELOG.md");
    assert.match(changelog, /void\.suggestedToday/);
    assert.match(changelog, /Aditivo, no breaking/);
  });
});

// ---------------------------------------------------------------------------
// 4 · la composición de la pantalla
// ---------------------------------------------------------------------------

describe("QA22-001 · la pantalla ya no espera al LLM", () => {
  it("el único gate a pantalla completa es el cupo", () => {
    assert.match(UMBRAL, /if \(today === undefined\) \{/, "el gate tiene que ser sólo la query de cupo");
    assert.doesNotMatch(
      UMBRAL,
      /categories === null \|\| today === undefined/,
      "el gate viejo esperaba también a la action del LLM"
    );
  });

  it("la entrada lee el set del día por la query nueva", () => {
    assert.match(UMBRAL, /useQuery\(proposedApi\.voidSuggestedToday, \{\}\)/);
  });

  it("la action sólo se dispara por la decisión pura", () => {
    assert.match(UMBRAL, /shouldGenerateVoidPrompts\(\{ cached, generated: generated !== null \}\)/);
    assert.match(UMBRAL, /if \(!generar\) return;/, "el efecto no puede generar por su cuenta");
  });

  it("lo generado en la sesión manda sobre lo que publique la query después", () => {
    // Sin esta precedencia, la action persiste el set, la query lo devuelve y
    // las pestañas cambian solas aunque el contenido sea el mismo.
    assert.match(
      UMBRAL,
      /const categories = generated \?\? \(cached\?\.categories\?\.length \? cached\.categories : null\)/
    );
  });

  it("el catálogo genérico es sólo el respaldo de una respuesta vacía, nunca el relleno de la espera", () => {
    assert.match(UMBRAL, /setGenerated\(r\?\.categories\?\.length \? r\.categories : VOID_CATEGORIES\)/);
    const entrada = UMBRAL.slice(UMBRAL.indexOf('{phase === "entrada"'), UMBRAL.indexOf('{phase === "escuchando"'));
    assert.doesNotMatch(entrada, /VOID_CATEGORIES/, "la entrada no puede dibujar genéricas mientras espera");
    assert.match(entrada, /<SuggestionsLoading \/>/, "mientras no están, se dice que están cargando");
  });

  it("la cuota y la barra de preguntar quedan FUERA de la sección de sugeridas", () => {
    const entrada = UMBRAL.slice(UMBRAL.indexOf('{phase === "entrada"'), UMBRAL.indexOf('{phase === "escuchando"'));
    const cuota = entrada.indexOf("{counterLabel}");
    const seccion = entrada.indexOf('suggestions === "listas"');
    const barra = entrada.indexOf("styles.askBar");
    assert.ok(cuota >= 0 && seccion > cuota, "la cuota se dibuja antes que las sugeridas");
    assert.ok(barra > seccion, "la barra de preguntar se dibuja después, y fuera de la sección");
  });

  it("el error de las sugeridas es local: preguntar sigue disponible", () => {
    assert.match(UMBRAL, /<SuggestionsError onRetry=\{onRetrySuggestions\} \/>/);
    // El error a pantalla completa era el que dejaba la sección inutilizable.
    assert.doesNotMatch(UMBRAL, /<ErrorState onRetry=\{\(\) => setAttempt/);
  });
});

describe("QA22-002 · la salida está en las cuatro superficies", () => {
  it("respuesta, error, espera y cupo agotado ofrecen HACER OTRA PREGUNTA", () => {
    const salidas = UMBRAL.match(/<GhostCta label=\{VOID_NEW_QUESTION_LABEL\} onPress=\{resetInteraction\} \/>/g) ?? [];
    assert.equal(salidas.length, 4, `el registro pide carga, interacción y resultado; hay ${salidas.length}`);
  });

  it("cada fase con contenido terminal tiene la suya", () => {
    const fase = (desde: string, hasta: string) => UMBRAL.slice(UMBRAL.indexOf(desde), UMBRAL.indexOf(hasta));
    const escuchando = fase('{phase === "escuchando"', '{phase === "respuesta" && locked');
    const limite = fase('{phase === "respuesta" && locked', "phase === \"respuesta\" && askFailed");
    const error = fase('phase === "respuesta" && askFailed', "phase === \"respuesta\" ? (");
    const respuesta = UMBRAL.slice(UMBRAL.indexOf('phase === "respuesta" ? ('));
    for (const [nombre, bloque] of [
      ["escuchando", escuchando],
      ["cupo agotado", limite],
      ["error", error],
      ["respuesta", respuesta]
    ] as const) {
      assert.match(bloque, /VOID_NEW_QUESTION_LABEL/, `la fase ${nombre} quedó sin salida`);
    }
  });

  it("el error conserva REINTENTAR: reintentar y volver al selector son dos cosas", () => {
    assert.match(UMBRAL, /<GhostCta\s+label="REINTENTAR"/);
  });

  it("volver al selector no llama a nada: no consume ni devuelve cupo", () => {
    // Sólo el cuerpo de la función: más abajo vive el efecto del pulso, que sí
    // llama a `ask` y haría pasar esta prueba por el motivo equivocado.
    const cuerpo = UMBRAL.slice(
      UMBRAL.indexOf("const resetInteraction = () => {"),
      UMBRAL.indexOf("const shownQuestion")
    );
    assert.match(cuerpo, /resetVoidInteraction<VoidAnswerPayload>\(\)/);
    assert.doesNotMatch(cuerpo, /\bask\(|useAction|useMutation|setAttempt/, "el reset es local y sin efectos");
  });
});

describe("QA22-031 · el cupo agotado informa el límite", () => {
  it("la pantalla usa el copy exacto con el límite del día", () => {
    assert.match(UMBRAL, /voidDailyLimitCopy\(dailyLimit\)/);
    assert.match(UMBRAL, /const dailyLimit = today\?\.limit \?\? 3;/, "el límite sale del backend");
  });

  it("la frase editorial ya no reemplaza la explicación de cuota", () => {
    assert.doesNotMatch(UMBRAL, /alcanzó/, "«Por hoy alcanzó» no declaraba el estado concreto");
    assert.doesNotMatch(
      UMBRAL,
      /que diez apuradas\. Volvé mañana\./,
      "«Volvé mañana» ahora vive en la explicación, no en la frase editorial"
    );
    // Pero la frase editorial se conserva como texto secundario, que es lo que
    // el registro pide explícitamente.
    assert.match(UMBRAL, /rinde más que diez apuradas\./);
  });
});
