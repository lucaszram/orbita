/**
 * La sección **Hoy** como estructura (CORE-191).
 *
 * Lo que se cuida acá no es cómo se ve, sino qué MONTA la pantalla: qué lienzo,
 * en qué orden, con qué fuentes, cuántas veces, y qué no puede volver a
 * aparecer. React Native no se puede renderizar en Node, así que —como el resto
 * de la suite— lo estructural se afirma sobre el fuente y las decisiones reales
 * viven en módulos puros que sí se ejecutan (`hoyPrincipal`, `lunaCarta`).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, test } from "node:test";

import { hoyBloques, numeroDeBloque } from "../src/domain/hoyPrincipal";
import { lunaCartaStateFromPayload, resolveLunaReadKey } from "../src/services/lunaCartaStore";
import type { LunaSobreLaCartaPayload } from "../src/services/appRefs";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Un comentario no es conducta: nada se afirma citando una explicación. */
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const HOME = sinComentarios(leer("src/screens/HomeScreen.tsx"));
const LAYOUT = sinComentarios(leer("src/components/home/hoy/HoyLayout.tsx"));
const DIALS = sinComentarios(leer("src/components/home/hoy/HoyDials.tsx"));
const LUNA = sinComentarios(leer("src/components/home/hoy/HoyLuna.tsx"));
const RANKING = sinComentarios(leer("src/components/home/hoy/HoyRanking.tsx"));
const PRINCIPAL = sinComentarios(leer("src/components/home/hoy/HoyPrincipal.tsx"));
const STORE = sinComentarios(leer("src/services/lunaCartaStore.ts"));

const SUPERFICIE_HOY: Array<[string, string]> = [
  ["src/screens/HomeScreen.tsx", HOME],
  ["src/components/home/hoy/HoyLayout.tsx", LAYOUT],
  ["src/components/home/hoy/HoyDials.tsx", DIALS],
  ["src/components/home/hoy/HoyLuna.tsx", LUNA],
  ["src/components/home/hoy/HoyRanking.tsx", RANKING],
  ["src/components/home/hoy/HoyPrincipal.tsx", PRINCIPAL]
];

// --- 1. La jerarquía del canon ----------------------------------------------

describe("la jerarquía de Hoy", () => {
  it("encabeza con `HOY · LO ACTIVO AHORA` y el título de la sección", () => {
    assert.match(HOME, /eyebrow="HOY · LO ACTIVO AHORA"/);
    assert.match(HOME, /titulo="Hoy"/);
  });

  it("`LO PRINCIPAL HOY` es el primer módulo numerado, no una síntesis aparte", () => {
    // Los cuatro módulos pasan por el MISMO marco (`HoyBloque`): el primero se
    // numera y se renumera igual que los otros tres, y su cuerpo resuelve
    // carga, error y ausencia parcial dentro de `cuerpoDe`.
    assert.match(HOME, /principal: "LO PRINCIPAL HOY"/);
    assert.match(HOME, /key === "principal" \|\| key === "ranking"/);
    assert.match(HOME, /key === "principal"[\s\S]*?<HoyPrincipalBloque principal=\{principal\} \/>/);
    assert.match(HOME, /<HoyFalta lineas=\{\["La lectura de hoy no trajo una síntesis principal\."\]\}/);
    assert.doesNotMatch(HOME, /HoyPrincipalEstado/);
    assert.doesNotMatch(PRINCIPAL, /LO PRINCIPAL HOY</);
    for (const orden of [hoyBloques(false), hoyBloques(true)]) {
      assert.ok(orden.includes("principal"));
    }
  });

  it("los cuatro módulos numerados son los de la tarjeta, con su cadencia", () => {
    for (const titulo of ["LO PRINCIPAL HOY", "RANKING DE TRÁNSITOS", "LA LUNA EN TU CARTA", "CUMPLELUNA"]) {
      const apariciones = HOME.split(titulo).length - 1;
      assert.equal(apariciones, 1, `«${titulo}» tiene que declararse una sola vez, hay ${apariciones}`);
    }
    assert.match(HOME, /CADENCIA: Record<HoyBloqueKey, string>/);
    assert.match(HOME, /TITULO: Record<HoyBloqueKey, string>/);
  });

  it("el orden y la numeración salen del dominio, no de una lista escrita a mano", () => {
    assert.match(HOME, /const orden = hoyBloques\(evento !== null\);/);
    assert.match(HOME, /orden\.map\(\(key, index\) => \(/);
    assert.match(HOME, /indice=\{numeroDeBloque\(index\)\}/);
  });

  it("con Cumpleluna hoy el evento es 01 y los otros tres corren", () => {
    const orden = hoyBloques(true);
    assert.equal(orden[0], "cumpleluna");
    assert.equal(numeroDeBloque(0), "01");
    assert.equal(numeroDeBloque(orden.indexOf("principal")), "02");
    assert.equal(numeroDeBloque(orden.indexOf("ranking")), "03");
    assert.equal(numeroDeBloque(orden.indexOf("luna")), "04");
  });
});

// --- 2. Responsive: un lienzo, dos composiciones, un solo montaje -----------

describe("responsive", () => {
  it("es el lienzo ancho compartido, declarado una sola vez", () => {
    assert.match(HOME, /from "@\/components\/orbita\/ContentCanvas"/);
    const montajes = HOME.match(/<ContentCanvas/g) ?? [];
    assert.equal(montajes.length, 1, "la pantalla monta su lienzo una sola vez");
    assert.match(HOME, /<ContentCanvas variant="wide">/);
  });

  it("en escritorio compone en columnas y deja el texto a medida de lectura", () => {
    assert.match(HOME, /from "@\/components\/orbita\/Layout"/);
    assert.match(HOME, /<Columns gap=\{orbita\.spacing\.xxl\}>/);
    assert.match(HOME, /<Column weight=\{3\}>/);
    // Un lienzo de 1200 sin esto serían párrafos de ancho de monitor. El
    // encabezado también vive adentro: su introducción es texto de lectura.
    assert.match(HOME, /<ReadingBlock>/);
    const reading = HOME.slice(HOME.indexOf("<ReadingBlock>"), HOME.indexOf("</ReadingBlock>"));
    assert.match(reading, /<HoyEncabezado/);
    // Los cuatro módulos —el principal incluido— viven en la misma columna de
    // lectura, montados por el mismo mapa numerado.
    assert.match(reading, /\{orden\.map\(\(key, index\) => \(/);
    assert.match(reading, /\{cuerpoDe\(key\)\}/);
  });

  it("la composición lateral se monta UNA vez: una condición usada invertida", () => {
    assert.match(HOME, /const fichaEnColumna = desktop && hayFicha;/);
    assert.match(HOME, /<Column weight=\{2\}>\{fichaEnColumna \? ficha : null\}<\/Column>/);
    assert.match(HOME, /\{fichaEnColumna \? null : ficha\}/);
    // Un `{ficha}` suelto es exactamente el bug: en móvil `Column` es
    // transparente y la sección saldría dos veces seguidas.
    assert.doesNotMatch(HOME, /\{ficha\}/);
  });

  it("la ficha lateral NO agrega datos: sale de la misma generación del día", () => {
    assert.match(HOME, /daily\.basadoEn/);
    assert.match(HOME, /daily\.disclaimer/);
    assert.match(HOME, /const hayFicha = basadoEn\.length > 0 \|\| disclaimer !== null;/);
  });

  it("en móvil la sección apila con la gutter de WEB V1 y respeta el área segura", () => {
    assert.match(LAYOUT, /export const HOY_GUTTER = 20;/);
    assert.match(HOME, /paddingBottom: insets\.bottom \+ orbita\.spacing\.xxl/);
    // El header interno sigue decidiéndose por el contrato compartido.
    assert.match(HOME, /showsScreenHeader\(\{ web: IS_WEB, mode \}\)/);
  });

  it("ninguna pieza de Hoy mide la ventana: el modo viene del contexto", () => {
    for (const [rel, codigo] of SUPERFICIE_HOY) {
      assert.doesNotMatch(codigo, /useWindowDimensions|Dimensions\.get|window\.innerWidth/, `${rel} mide el viewport`);
    }
    assert.match(HOME, /const mode = useLayoutMode\(\);/);
  });
});

// --- 3. Datos reales, cada fuente por su cuenta -----------------------------

describe("las fuentes", () => {
  it("«lo principal» y el ranking salen de la guía diaria ya existente", () => {
    assert.match(HOME, /from "@\/services\/dailyGuideStore"/);
    assert.match(HOME, /useDailyGuide\(claveDelDia, today \?\? "", isAuthLoading\)/);
    assert.match(HOME, /hoyPrincipal\(daily\)/);
    assert.match(HOME, /hoyRanking\(daily\)/);
  });

  it("la Luna y el Cumpleluna salen del sobre de CORE-192", () => {
    assert.match(HOME, /from "@\/services\/lunaCartaStore"/);
    assert.match(HOME, /useLunaCarta\(claveDelDia, today \?\? "", isAuthLoading\)/);
    assert.match(STORE, /useAction\(appApi\.home\.getLunaSobreLaCarta\)/);
    // Sin `localDate` ni `timezone`: el día lo resuelve el servidor y mandarlos
    // sólo agrega una forma de que el sobre vuelva `needs_daily_context`.
    assert.match(STORE, /run\(\{\}\)/);
  });

  it("el sobre se adapta SIEMPRE con el lector defensivo, sin relleno", () => {
    assert.match(STORE, /toLunaSobreLaCarta\(raw\)/);
    assert.match(STORE, /hasLunaSobreLaCartaData\(payload\)/);
    assert.match(HOME, /lunaVista\(sobre\.moonOnChart, sobre\)/);
    assert.match(HOME, /cumplelunaVista\(sobre\.cumpleluna, sobre, evento\)/);
  });

  it("cada fuente carga, falla y se reintenta por separado", () => {
    assert.match(HOME, /retry: retryDaily/);
    assert.match(HOME, /retry: retryLuna/);
    assert.match(HOME, /dailyState\.status === "error"[\s\S]*?onRetry=\{retryDaily\}/);
    assert.match(HOME, /lunaState\.status === "error"[\s\S]*?onRetry=\{retryLuna\}/);
    // Y el fallo de una no puede vaciar la otra: el ranking se resuelve con
    // `dailyState` antes de mirar nada de la Luna.
    const cuerpo = HOME.slice(HOME.indexOf("function cuerpoDe("));
    assert.ok(
      cuerpo.indexOf('key === "ranking"') < cuerpo.indexOf('lunaState.status === "error"'),
      "el ranking no puede depender del estado de la Luna"
    );
  });

  it("un bloque sin dato explica por qué, con las limitaciones del sobre", () => {
    assert.match(HOME, /lineasDeFalta\(sobre, "luna"\)/);
    assert.match(HOME, /lineasDeFalta\(sobre, "cumpleluna"\)/);
    assert.match(LAYOUT, /export function HoyFalta/);
  });

  it("el día es el canónico del servidor: el reloj del dispositivo no participa", () => {
    assert.match(HOME, /useDailyContext/);
    assert.match(HOME, /dailyContext\.status === "listo" \? dailyContext\.context\.localDate : null/);
    assert.match(HOME, /fechaCivilLarga\(today\)/);
    for (const [rel, codigo] of [...SUPERFICIE_HOY, ["src/domain/lunaCarta.ts", sinComentarios(leer("src/domain/lunaCarta.ts"))] as [string, string]]) {
      assert.doesNotMatch(codigo, /Date\.now\(/, `${rel} lee el reloj del dispositivo`);
      assert.doesNotMatch(codigo, /new Date\(\s*\)/, `${rel} lee el reloj del dispositivo`);
      assert.doesNotMatch(codigo, /toLocalDate\(\)/, `${rel} lee el reloj del dispositivo`);
    }
  });

  it("la primera respuesta genérica de la guía se trata como carga y se vuelve a consultar", () => {
    // `getGuide` contesta rápido con un payload sin tránsitos marcado
    // `enrichment.status: "pending"`. Mostrarlo sería un mock con otro nombre.
    assert.match(HOME, /const dailyPendiente = daily !== null && guiaPendiente\(daily\);/);
    assert.match(HOME, /if \(dailyState\.status !== "ready" \|\| dailyPendiente\)/);
    // La reconsulta es un temporizador acotado que llama al reintento del store,
    // no una segunda suscripción ni una llamada directa a la acción.
    assert.match(HOME, /setTimeout\(\(\) => \{[\s\S]*?retryDaily\(\);[\s\S]*?\}, REINTENTO_PENDIENTE_MS\)/);
    assert.match(HOME, /REINTENTOS_PENDIENTE_MAX/);
    assert.match(HOME, /const esperaAgotada =/);
    assert.match(HOME, /mensaje="La lectura de hoy está tardando más de lo normal\."/);
    assert.doesNotMatch(HOME, /useAction\(/);
  });

  it("el contador cuenta módulos con dato, o no se muestra", () => {
    assert.match(HOME, /etiquetaDeModulos\(\s*contarModulos\(\{/);
    assert.match(HOME, /principal: principal !== null/);
    assert.match(HOME, /luna: luna !== null/);
  });
});

// --- 4. Estados honestos, cero maqueta --------------------------------------

describe("estados y ausencia de maqueta", () => {
  it("sesión cargando, error de sesión e invitado usan los estados existentes", () => {
    assert.match(HOME, /\{sessionPending \? \(/);
    assert.match(HOME, /<LoadingState \/>/);
    assert.match(HOME, /No pudimos abrir tu sesión\./);
    assert.match(HOME, /onPress=\{retryUser\}/);
    assert.match(HOME, /<GuestState/);
    assert.match(HOME, /const guest = !isAuthLoading && !userError && !auth\?\.isSignedIn;/);
  });

  it("invitado: la sección se ve entera y cada módulo resuelve su propio estado", () => {
    // Nada reemplaza el tablero por un solo estado vacío: el encabezado y los
    // cuatro bloques se montan, cada uno dice qué necesita, y hay UN solo CTA.
    assert.doesNotMatch(HOME, /\) : guest \? \(/);
    assert.match(HOME, /INVITADO: Record<HoyBloqueKey, string>/);
    assert.match(HOME, /if \(guest\) return <HoyFalta lineas=\{\[INVITADO\[key\]\]\} \/>;/);
    assert.match(HOME, /intro=\{guest \? INTRO_INVITADO : intro\}/);
    const guestStates = HOME.match(/<GuestState/g) ?? [];
    assert.equal(guestStates.length, 1);
  });

  it("sin fecha canónica se dice, en vez de dejar los módulos cargando para siempre", () => {
    assert.match(HOME, /const contextPending =/);
    assert.match(HOME, /dailyContext\.status === "idle" \|\| dailyContext\.status === "cargando"/);
    assert.match(HOME, /\) : contextPending \? \(/);
    assert.match(HOME, /dailyContext\.status === "error"/);
    assert.match(HOME, /onPress=\{dailyContext\.refresh\}/);
  });

  it("ninguna superficie de Hoy fabrica contenido personal", () => {
    const TIPOS = ["MoonOnChartData", "CumplelunaData", "LunaSobreLaCartaPayload", "DailyGuidePayload"];
    for (const [rel, codigo] of SUPERFICIE_HOY) {
      for (const tipo of TIPOS) {
        assert.doesNotMatch(
          codigo,
          new RegExp(`(const|let|var)\\s+\\w+\\s*:\\s*${tipo}\\s*=\\s*[{[]`),
          `${rel} declara un ${tipo} literal`
        );
      }
    }
  });

  it("no se inventan orbe, barra de cercanía, exactitud ni contador de activos", () => {
    for (const [rel, codigo] of SUPERFICIE_HOY) {
      assert.doesNotMatch(codigo, /activeCount|exactnessRatio|orbDegrees|yesterdayOrb/, `${rel} deriva un dato inexistente`);
    }
  });

  it("no hay links a pantallas que no existen ni gating Free/Plus", () => {
    for (const [rel, codigo] of SUPERFICIE_HOY) {
      assert.doesNotMatch(codigo, /hoy\/luna|hoy\/cumpleluna|transitos\/momento/, `${rel} enlaza una ruta inexistente`);
      assert.doesNotMatch(codigo, /router\.push/, `${rel} navega por su cuenta`);
      assert.doesNotMatch(codigo, /paywall|entitlement|isPro|PlanLock/, `${rel} agrega gating que la tarjeta no pide`);
    }
  });

  it("los discos se dibujan con SVG, sin un solo asset", () => {
    assert.match(DIALS, /from "react-native-svg"/);
    assert.match(DIALS, /export function MoonDial/);
    assert.match(DIALS, /export function CycleRing/);
    for (const [rel, codigo] of SUPERFICIE_HOY) {
      assert.doesNotMatch(codigo, /require\(/, `${rel} carga un asset`);
    }
  });

  it("el canon no usa tarjetas: la separación es una línea fina", () => {
    assert.match(LAYOUT, /linea: \{ backgroundColor: orbita\.colors\.line, height: 1/);
    assert.doesNotMatch(LAYOUT, /borderRadius: orbita\.radius/);
    assert.doesNotMatch(RANKING, /borderRadius/);
  });
});

// --- 5. El ritual dejó de vivir en Hoy, pero no se borró --------------------

describe("Hoy ya no es el ritual", () => {
  it("la pantalla no monta ninguna pieza del Tarot diario", () => {
    for (const pieza of ["DiarioStrip", "CartaDelDia", "SignalTop", "TopicsSection", "LongReadEnd", "revealCard"]) {
      assert.ok(!HOME.includes(pieza), `Hoy volvió a montar «${pieza}»`);
    }
    assert.doesNotMatch(HOME, /veiled|velo|tarotLimite/i);
  });

  it("los componentes, sus datos y sus rutas siguen existiendo", () => {
    // La tarjeta pide dejar de RENDERIZARLO en Hoy, no borrarlo del producto:
    // el Umbral sigue montando el mismo componente con los mismos datos.
    for (const rel of [
      "src/components/home/CartaDelDia.tsx",
      "src/components/diario/DiarioStrip.tsx",
      "src/components/web/umbral-tarot.tsx"
    ]) {
      assert.ok(leer(rel).length > 0, `${rel} no puede borrarse`);
    }
    assert.match(sinComentarios(leer("src/components/web/umbral-tarot.tsx")), /<CartaDelDia/);
  });
});

// --- 6. La navegación de CORE-113 no se toca -------------------------------

test("la navegación canónica sigue exactamente igual", () => {
  const nav = sinComentarios(leer("src/components/web/web-nav.tsx"));
  assert.match(nav, /\{ key: "inicio", label: "Hoy", href: "\/home" \}/);
  assert.match(nav, /\{ key: "transitos", label: "Tránsitos", href: "\/transito" \}/);
  assert.match(nav, /\{ key: "vinculo", label: "Vínculos", href: "\/vinculo" \}/);
  assert.match(nav, /\{ key: "umbral", label: "Umbral", href: "\/umbral" \}/);
  assert.match(nav, /\{ key: "carta", label: "Carta", href: "\/carta" \}/);
  // Y las dos rutas siguen montando la MISMA pantalla canónica.
  assert.match(leer("app/(tabs)/index.tsx"), /@\/screens\/HomeScreen/);
  assert.match(leer("app/home.tsx"), /@\/screens\/HomeScreen/);
  assert.match(HOME, /export function HomeScreen\(\)/);
});

// --- 7. El caché del sobre: una ejecución por (cuenta, día) -----------------

describe("resolveLunaReadKey — aislamiento de sesión del sobre", () => {
  const A = "user_A:2026-09-12";
  const B = "user_B:2026-09-12";

  /** Simula la secuencia de renders: cada paso alimenta el `lastKey` siguiente. */
  function play(steps: Array<{ currentKey: string | null; holdLastKey: boolean }>) {
    let lastKey: string | null = null;
    const reads: Array<string | null> = [];
    for (const step of steps) {
      const r = resolveLunaReadKey({ ...step, lastKey });
      lastKey = r.nextLastKey;
      reads.push(r.readKey);
    }
    return { reads, lastKey };
  }

  it("sesión viva: lee y retiene la clave de la cuenta", () => {
    assert.deepEqual(play([{ currentKey: A, holdLastKey: false }]).reads, [A]);
  });

  it("reconexión transitoria: no degrada a «cargando» por un parpadeo de red", () => {
    const { reads } = play([
      { currentKey: A, holdLastKey: false },
      { currentKey: null, holdLastKey: true },
      { currentKey: A, holdLastKey: false }
    ]);
    assert.deepEqual(reads, [A, A, A]);
  });

  it("signed-out confirmado: el sobre de la cuenta anterior no sobrevive", () => {
    const { reads, lastKey } = play([
      { currentKey: A, holdLastKey: false },
      { currentKey: null, holdLastKey: false },
      { currentKey: null, holdLastKey: true }
    ]);
    assert.deepEqual(reads, [A, null, null]);
    assert.equal(lastKey, null);
  });

  it("cambio de cuenta: nunca se lee la clave de la anterior", () => {
    const { reads } = play([
      { currentKey: A, holdLastKey: false },
      { currentKey: null, holdLastKey: false },
      { currentKey: B, holdLastKey: false }
    ]);
    assert.deepEqual(reads, [A, null, B]);
  });

  it("la clave incluye el día: al cruzar la medianoche el sobre de ayer no vale", () => {
    assert.match(STORE, /`\$\{userKey\}:\$\{localDate\}`/);
    assert.match(STORE, /const key = userKey && localDate \? /);
  });

  it("una respuesta tardía no pisa a la ejecución que la reemplazó", () => {
    assert.match(STORE, /if \(entries\.get\(key\)\?\.runId !== runId\) return;/);
    assert.match(STORE, /const runId = \+\+runSeq;/);
  });

  it("hay techo de espera y reintento explícito", () => {
    assert.match(STORE, /const TIMEOUT_MS = 30_000;/);
    assert.match(STORE, /const retry = useCallback\(\(\) => fetchLuna\(true\), \[fetchLuna\]\);/);
    assert.match(STORE, /export function resetLunaCartaStore/);
  });

  it("un fallo que vuelve como sobre sigue teniendo reintento; una ausencia estable no", () => {
    const sobre = (status: LunaSobreLaCartaPayload["status"]): LunaSobreLaCartaPayload => ({
      methodVersion: "test",
      providerVersion: "test",
      status,
      precision: "not_applicable",
      localDate: "2026-09-12",
      timezone: "America/Argentina/Buenos_Aires",
      observedAt: null,
      moonOnChart: null,
      cumpleluna: null,
      missingInputs: [],
      limitations: []
    });

    assert.equal(lunaCartaStateFromPayload(sobre("provider_error")).status, "error");
    assert.equal(lunaCartaStateFromPayload(sobre("needs_daily_context")).status, "error");
    assert.equal(lunaCartaStateFromPayload(sobre("ready")).status, "error", "un sobre ready roto no es vacío");
    assert.equal(lunaCartaStateFromPayload(sobre("needs_natal_chart")).status, "empty");
    assert.equal(lunaCartaStateFromPayload(sobre("not_configured")).status, "empty");
  });
});

// --- 8. Accesibilidad -------------------------------------------------------

describe("accesibilidad de la sección", () => {
  it("los encabezados son encabezados, con su cadencia dicha una sola vez", () => {
    assert.match(LAYOUT, /accessibilityRole="header"\s*accessibilityLabel=\{`\$\{titulo\}\. \$\{cadencia\}\.`\}/);
    assert.match(LAYOUT, /accessibilityRole="header"\s*accessibilityLabel=\{`\$\{eyebrow\}\. \$\{titulo\}\.`\}/);
    // El encabezado de «lo principal» lo pone `HoyBloque`, como a los otros
    // tres: el cuerpo no declara un segundo header para el mismo módulo.
    assert.doesNotMatch(PRINCIPAL, /accessibilityRole="header"/);
  });

  it("el medidor se anuncia con el valor en SUS unidades, no con un porcentaje", () => {
    assert.match(LAYOUT, /accessibilityRole="progressbar"/);
    assert.match(LAYOUT, /accessibilityValue=\{\{ text: valueText \}\}/);
    assert.match(LUNA, /valueText=\{vista\.relojDelCiclo\}/);
  });

  it("los discos son una sola etiqueta y el pie de la barra no se lee dos veces", () => {
    assert.match(DIALS, /accessibilityRole="image"/);
    assert.match(LUNA, /accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/);
  });

  it("el fallo de un módulo se anuncia solo, dice QUÉ reintenta y es tocable", () => {
    assert.match(LAYOUT, /accessibilityRole="alert" accessibilityLiveRegion="polite"/);
    assert.match(LAYOUT, /reintentar: \{[^}]*minHeight: 44[^}]*\}/);
    assert.match(HOME, /retryBtn: \{[^}]*minHeight: 44[^}]*\}/);
    // Pueden convivir tres reintentos, y dos de ellos apuntan a fuentes
    // distintas: con una etiqueta genérica el rotor de botones los listaba
    // iguales y no había forma de saber cuál era cuál.
    assert.match(LAYOUT, /accessibilityLabel=\{`Reintentar \$\{modulo\.toLocaleLowerCase\("es"\)\}`\}/);
    const errores = HOME.match(/<HoyError[\s\S]*?\/>/g) ?? [];
    assert.equal(errores.length, 3, `Hoy monta un reintento por módulo, hay ${errores.length}`);
    for (const e of errores) assert.match(e, /modulo=/, `un reintento quedó sin nombrar su módulo: ${e}`);
  });
});
