import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { cartaGate, readingBlockPhase } from "../src/domain/cartaNatalCarga";
import {
  natalChapterParagraphs,
  natalChapters,
  natalPlacementLine
} from "../src/domain/lecturaNatal";
import { reachableFrom } from "./moduleGraph";

// La carta astronómica llega en <1 s; la lectura larga tarda 40–61 s (PR
// backend #32 la prewarmea). Regla: la lectura NUNCA participa del loading
// general — se resuelve inline dentro de "Tu carta, explicada".

const CHART_DOC = { payload: { planets: [] } };
const VALUES = { axes: [], note: "nota" };
const READING_7 = {
  sections: Array.from({ length: 7 }, (_, i) => ({
    key: `s${i}`,
    title: `Capítulo ${i + 1}`,
    body: "…",
    placement: { planet: "Sol", label: "Sol", sign: "Cáncer" }
  })),
  disclaimer: "d"
};

describe("cartaGate — el loading general solo mira carta + valores", () => {
  it("carta y valores listos → 'listo', con la lectura todavía en null", () => {
    // La lectura ni siquiera es input de cartaGate: no puede bloquear.
    assert.equal(cartaGate({ doc: CHART_DOC, values: VALUES }), "listo");
  });

  it("queries en vuelo (undefined) → 'cargando'", () => {
    assert.equal(cartaGate({ doc: undefined, values: VALUES }), "cargando");
    assert.equal(cartaGate({ doc: CHART_DOC, values: undefined }), "cargando");
  });

  it("el backend confirmó que no hay carta (null) → 'vacio'", () => {
    assert.equal(cartaGate({ doc: null, values: VALUES }), "vacio");
    // Sin carta, valuesMap también es null: sigue siendo vacío, no carga.
    assert.equal(cartaGate({ doc: null, values: null }), "vacio");
  });

  it("la lectura null jamás produce loading de pantalla completa", () => {
    // cartaGate no acepta la lectura como input (garantía de tipo); con carta
    // y valores resueltos el gate es terminal, pase lo que pase con el LLM.
    const gate = cartaGate({ doc: CHART_DOC, values: VALUES });
    assert.notEqual(gate, "cargando");
  });
});

describe("readingBlockPhase — 'Tu carta, explicada' resuelve inline", () => {
  it("lectura null (cache todavía no 'ready') → carga inline", () => {
    assert.equal(readingBlockPhase({ reading: null, failed: false }), "cargando");
    assert.equal(readingBlockPhase({ reading: undefined, failed: false }), "cargando");
  });

  it("reject del generador → error inline con reintento", () => {
    assert.equal(readingBlockPhase({ reading: null, failed: true }), "error");
  });

  it("una resolución { status: 'pending' } NO es error: la query sigue en null y el bloque sigue cargando", () => {
    // El prewarm del backend tiene el claim; el cliente solo espera la query.
    assert.equal(readingBlockPhase({ reading: null, failed: false, state: "pending" }), "cargando");
  });

  it("lectura lista → 'listo' con los siete capítulos intactos", () => {
    assert.equal(readingBlockPhase({ reading: READING_7, failed: false }), "listo");
    assert.equal(READING_7.sections.length, 7);
  });

  it("el dato manda: si el prewarm del backend terminó, un fallo viejo de la action no tapa la lectura", () => {
    assert.equal(readingBlockPhase({ reading: READING_7, failed: true }), "listo");
    // Ni siquiera un `state` remoto stale en error la tapa.
    assert.equal(readingBlockPhase({ reading: READING_7, failed: true, state: "error" }), "listo");
  });
});

describe("readingBlockPhase — señal remota personalityReadingState (backend #32 24ba2ac)", () => {
  it("REGRESIÓN pending→error sin desmontar: el prewarm falla y el bloque pasa de carga a error inline", () => {
    // Mismo montaje: la action del cliente ya resolvió { status: "pending" }
    // (generating=false, sin reject local) y la query de lectura sigue null.
    const base = { reading: null, failed: false, generating: false } as const;
    assert.equal(readingBlockPhase({ ...base, state: "pending" }), "cargando");
    // El prewarm que tenía el claim falla → el state reactivo flipea a error.
    // Antes de la señal esto quedaba en "Preparando…" para siempre.
    assert.equal(readingBlockPhase({ ...base, state: "error" }), "error");
  });

  it("state 'ready' con la lectura todavía null es la ventana entre queries → sigue cargando, no error", () => {
    assert.equal(readingBlockPhase({ reading: null, failed: false, generating: false, state: "ready" }), "cargando");
  });

  it("reintento: la action recién re-disparada (generating) tapa el error remoto de la ronda anterior", () => {
    // Tap en REINTENTAR → failed se limpia y generate({}) vuelve a correr; el
    // backend todavía no pisó el `error` viejo: el bloque ya muestra carga.
    assert.equal(readingBlockPhase({ reading: null, failed: false, generating: true, state: "error" }), "cargando");
  });

  it("state en vuelo (undefined) no fabrica errores: carga", () => {
    assert.equal(readingBlockPhase({ reading: null, failed: false, generating: false, state: undefined }), "cargando");
  });
});

// Verificación ESTRUCTURAL del cableado (no se puede renderizar RN en node;
// mismo patrón que perfilAppReview.test.ts).
//
// El cableado —query, señal remota, action, fallo y reintento— ya NO vive en la
// pantalla: vive UNA sola vez en `@/hooks/useNatalReading`, porque las dos
// superficies que muestran el bloque lo comparten. La pantalla canónica
// (`CartaScreen`, nativa y web) y la Carta completa V4.9.2 sólo lo consumen.
const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
const CARTA_REL = "src/screens/CartaScreen.tsx";
const COMPLETA_REL = "src/screens/v492/CartaCompletaV492Screen.tsx";
const HOOK_REL = "src/hooks/useNatalReading.ts";
const CARTA = leer(CARTA_REL);
const COMPLETA = leer(COMPLETA_REL);
const HOOK = leer(HOOK_REL);

describe("carta.tsx — cableado anti-bloqueo", () => {
  it("el gate general usa cartaGate({ doc, values }) — sin la lectura", () => {
    assert.match(CARTA, /cartaGate\(\{ doc, values \}\)/);
    assert.match(CARTA, /gate === "cargando"/);
    // El patrón viejo que bloqueaba toda la pantalla por la lectura no existe más.
    assert.doesNotMatch(CARTA, /pending:\s*reading/);
    assert.doesNotMatch(CARTA, /dataPhase/);
  });

  it("la lectura resuelve inline: carga 'Preparando tu lectura…' y error con REINTENTAR", () => {
    // La FASE la calcula el hook compartido; la pantalla sólo la consume.
    assert.match(
      HOOK,
      /readingBlockPhase\(\{\s*reading,\s*failed: generateFailed,\s*generating,\s*state: readingState\?\.status\s*\}\)/
    );
    assert.match(CARTA, /readingPhase=\{lectura\.phase\}/);
    assert.match(CARTA, /Preparando tu lectura…/);
    assert.match(CARTA, /label="REINTENTAR" onPress=\{onRetryReading\}/);
  });

  it("escucha la señal remota personalityReadingState (pending/ready/error) por query reactiva", () => {
    assert.match(HOOK, /useQuery\(appApi\.charts\.personalityReadingState, \{\}\)/);
  });

  it("el reintento limpia el fallo local y re-dispara la action; generating cubre la ventana", () => {
    assert.match(HOOK, /setGenerateFailed\(false\);\s*\n\s*setGenerating\(true\);/);
    assert.match(HOOK, /\.finally\(\(\) => \{\s*\n\s*if \(alive\) setGenerating\(false\);/);
    // Y el reintento que ve la pantalla es el del hook, no un contador propio.
    assert.match(HOOK, /const retry = useCallback\(\(\) => setAttempt\(\(a\) => a \+ 1\), \[\]\);/);
    assert.match(CARTA, /onRetryReading=\{lectura\.retry\}/);
  });

  it("MinimalLoading y ErrorState de pantalla completa quedan solo para sesión/carta, nunca para la lectura", () => {
    // Dentro de CartaLive, MinimalLoading aparece una sola vez y gated por cartaGate.
    const live = CARTA.slice(CARTA.indexOf("function CartaLive"), CARTA.indexOf("// --- Vista"));
    const minimalCount = live.split("<MinimalLoading />").length - 1;
    assert.equal(minimalCount, 1);
    assert.ok(live.indexOf("gate === \"cargando\"") < live.indexOf("<MinimalLoading />"));
    // El fallo del generador ya no rutea a un ErrorState de pantalla completa.
    assert.doesNotMatch(live, /generateFailed[\s\S]{0,200}<ErrorState/);
  });

  it("generatePersonalityReading({}) se sigue disparando y solo un REJECT marca fallo", () => {
    assert.match(HOOK, /generate\(\{\}\)\s*\n?\s*\.catch\(/);
    // Ninguna rama marca fallo a partir de un resultado resuelto (p. ej. { status: "pending" }).
    assert.doesNotMatch(HOOK, /then\([^)]*setGenerateFailed/);
  });

  it("bloqueado (Free) expone una salida a /paywall, no REINTENTAR", () => {
    // El plan Free rechaza la generación por diseño: no es un error, así que
    // el bloque bloqueado nunca ofrece REINTENTAR — solo la salida a Plus.
    const blockedStart = CARTA.indexOf('readingPhase === "bloqueado"');
    const blockedEnd = CARTA.indexOf(") : (", blockedStart);
    const blocked = CARTA.slice(blockedStart, blockedEnd);
    assert.match(blocked, /router\.push\("\/paywall"\)/);
    // Buscamos el Pill renderizado (label="REINTENTAR"), no la palabra suelta:
    // el comentario de arriba la menciona a propósito y no debe hacer fallar esto.
    assert.doesNotMatch(blocked, /label="REINTENTAR"/);
    // La rueda, la tríada y las posiciones se dibujan antes de "Tu carta,
    // explicada" y no dependen de readingPhase: siguen visibles bloqueado.
    assert.ok(CARTA.indexOf("const rueda = (") < blockedStart);
    assert.ok(CARTA.indexOf("const triada = ") < blockedStart);
  });

  it("el error real (no bloqueado) sigue ofreciendo REINTENTAR", () => {
    const blockedStart = CARTA.indexOf('readingPhase === "bloqueado"');
    const errorStart = CARTA.indexOf(") : (", blockedStart);
    // El cierre del ternario completo ")}" — buscado desde errorStart, no desde
    // blockedStart, porque `router.push("/paywall")}` dentro de la rama
    // bloqueada también matchea ")}" y cortaba este slice vacío.
    const errorEnd = CARTA.indexOf(")}", errorStart);
    const errorBranch = CARTA.slice(errorStart, errorEnd);
    assert.match(errorBranch, /label="REINTENTAR" onPress=\{onRetryReading\}/);
    assert.doesNotMatch(errorBranch, /router\.push\("\/paywall"\)/);
  });

  it("HOTFIX Free: la action Plus solo se dispara con la señal remota resuelta y no 'locked'", () => {
    // Reproducido en producción: una cuenta Free mostraba el bloqueo pero
    // igualmente disparaba generatePersonalityReading y la consola registraba
    // un Server Error. El booleano exige que personalityReadingState haya
    // resuelto (undefined = query en vuelo) y que no sea `locked`.
    assert.match(
      HOOK,
      /const canGenerate = readingState !== undefined && readingState\.status !== "locked";/
    );
    // El guard corta el efecto ANTES de generate({}): bloqueado o sin señal,
    // la action no sale nunca.
    const generateCall = HOOK.indexOf("generate({})");
    const effect = HOOK.slice(HOOK.lastIndexOf("useEffect(() => {", generateCall), generateCall);
    assert.match(effect, /if \(!canGenerate\) return;/);
  });

  it("HOTFIX Free: la dependencia del efecto es el booleano, no el status crudo", () => {
    // pending→ready/error mantiene canGenerate=true sin cambiar de identidad:
    // el efecto no se re-dispara en esas transiciones. Depender de readingState
    // (o de su status) sí lo re-dispararía en cada cambio remoto.
    assert.match(HOOK, /\}, \[generate, attempt, canGenerate\]\);/);
    assert.doesNotMatch(HOOK, /\}, \[[^\]]*readingState[^\]]*\]\);/);
  });

  it("los siete capítulos largos se muestran intactos cuando la lectura está lista", () => {
    // Los capítulos se dibujan desde una sola función (`explicada`), montada
    // con la primera y la segunda mitad. Antes eran dos bloques duplicados; el
    // contenido y el corte son los mismos.
    assert.match(CARTA, /chapters\.map\(\(s, i\) => \(\s*<SectorBlock key=\{s\.key\} s=\{s\} n=\{from \+ i\} \/>/);
    assert.match(CARTA, /\{explicada\(sectionsA, 1, true\)\}/);
    assert.match(CARTA, /\{explicada\(sectionsB, mid \+ 1, false\)\}/);
    assert.match(CARTA, /reading\?\.sections \?\? \[\]/);
  });
});

// ---------------------------------------------------------------------------
// Una sola lógica para las dos superficies
//
// El bloque "Tu carta, explicada" se muestra en la pantalla canónica y en la
// Carta completa V4.9.2. Mientras cada una montaba su propio efecto de
// generación las dos podían derivar sobre EL MISMO dato: una disparando la
// action donde la otra no, una leyendo la señal remota y la otra no. El efecto
// vive una sola vez.
// ---------------------------------------------------------------------------

describe("useNatalReading — el cableado de la lectura no se duplica", () => {
  const PANTALLAS = [
    ["carta canónica", CARTA_REL, CARTA],
    ["carta completa V4.9.2", COMPLETA_REL, COMPLETA]
  ] as const;

  it("las dos pantallas consumen el hook compartido", () => {
    for (const [nombre, , source] of PANTALLAS) {
      assert.match(source, /from "@\/hooks\/useNatalReading"/, `${nombre} no importa el hook`);
      assert.match(source, /useNatalReading\(\)/, `${nombre} no lo llama`);
    }
  });

  it("ninguna pantalla vuelve a montar su propio efecto de generación", () => {
    for (const [nombre, , source] of PANTALLAS) {
      assert.doesNotMatch(
        source,
        /useAction\(appApi\.charts\.generatePersonalityReading\)/,
        `${nombre} vuelve a disparar la action por su cuenta`
      );
      assert.doesNotMatch(
        source,
        /useQuery\(appApi\.charts\.personalityReading(State)?, \{\}\)/,
        `${nombre} vuelve a montar la query de la lectura`
      );
      assert.doesNotMatch(
        source,
        /readingBlockPhase\(/,
        `${nombre} vuelve a decidir la fase por su cuenta`
      );
    }
    // Y el hook es el ÚNICO lugar donde vive el efecto.
    assert.equal(HOOK.split("generate({})").length - 1, 1, "un solo disparo de la action");
  });

  it("el grafo real —el mismo que recorre Metro— llega al hook desde las dos rutas", () => {
    const nativo = reachableFrom(["app/(tabs)/perfil/carta/completa.tsx"], "native");
    assert.ok(nativo.has(HOOK_REL), "la ruta nativa de la carta completa no llega al hook");
    const web = reachableFrom(["app/(tabs)/carta.tsx"], "web");
    assert.ok(web.has(HOOK_REL), "la carta canónica web no llega al hook");
  });

  it("la lectura recibida MANDA: el hook la entrega sólo en 'listo' y nunca a medias", () => {
    // El tipo es la garantía: `reading` sale null salvo que la fase sea listo,
    // así que ninguna pantalla puede dibujar media lectura mientras carga.
    assert.match(HOOK, /reading: phase === "listo" \? reading! : null/);
    assert.match(HOOK, /\/\*\* Sólo no-null cuando `phase === "listo"`/);
  });
});

// ---------------------------------------------------------------------------
// Los capítulos, como se dibujan
// ---------------------------------------------------------------------------

describe("lecturaNatal — la lectura recibida se dibuja tal cual llegó", () => {
  const SECCION = {
    key: "sol",
    title: "El motor",
    intro: "i",
    body: "Primer párrafo.\n\nSegundo párrafo.",
    placement: { label: "Sol", planet: "Sol", sign: "Cáncer", house: 4 },
    questions: ["¿Qué te empuja?", "¿Qué te frena?"]
  };

  it("el placement va COMPLETO: planeta, signo y casa", () => {
    assert.equal(natalPlacementLine(SECCION.placement), "SOL EN CÁNCER · CASA 4");
    // Sin casa no se inventa ninguna.
    assert.equal(
      natalPlacementLine({ label: "Luna", planet: "Luna", sign: "Aries" }),
      "LUNA EN ARIES"
    );
  });

  it("el cuerpo conserva sus párrafos y no se inventa texto", () => {
    assert.deepEqual(natalChapterParagraphs(SECCION.body), ["Primer párrafo.", "Segundo párrafo."]);
    // Un cuerpo sin saltos es un párrafo; uno vacío no fabrica ninguno.
    assert.deepEqual(natalChapterParagraphs("Uno solo."), ["Uno solo."]);
    assert.deepEqual(natalChapterParagraphs(""), []);
    assert.deepEqual(natalChapterParagraphs(undefined), []);
  });

  it("los siete capítulos salen numerados, en orden y con sus preguntas", () => {
    const reading = {
      headline: "h",
      disclaimer: "d",
      sections: Array.from({ length: 7 }, (_, i) => ({ ...SECCION, key: `s${i}`, title: `T${i + 1}` }))
    };
    const capitulos = natalChapters(reading);
    assert.equal(capitulos.length, 7);
    assert.deepEqual(
      capitulos.map((c) => c.n),
      [1, 2, 3, 4, 5, 6, 7]
    );
    assert.equal(capitulos[0].numero, "Capítulo 01");
    assert.equal(capitulos[6].numero, "Capítulo 07");
    // El orden es EL del backend: no se reordena ni se recorta.
    assert.deepEqual(
      capitulos.map((c) => c.title),
      ["T1", "T2", "T3", "T4", "T5", "T6", "T7"]
    );
    assert.deepEqual(capitulos[0].questions, ["¿Qué te empuja?", "¿Qué te frena?"]);
    assert.equal(capitulos[0].glyph, "sun");
    // VoiceOver no deletrea el placement en mayúsculas.
    assert.equal(capitulos[0].voice, "Capítulo 1. Sol en cáncer · casa 4. T1");
  });

  it("sin preguntas no se fabrica ninguna, y sin lectura no hay capítulos", () => {
    const [capitulo] = natalChapters({
      headline: "h",
      disclaimer: "d",
      sections: [{ ...SECCION, questions: undefined }]
    });
    assert.deepEqual(capitulo.questions, []);
    assert.deepEqual(natalChapters(null), []);
    assert.deepEqual(natalChapters(undefined), []);
  });
});
