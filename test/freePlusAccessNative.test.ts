/**
 * Free/Plus en la app nativa — build 30.
 *
 * Lo que se fija acá es la frontera del plan en el CLIENTE. El gating real lo
 * aplica el servidor (`…WithAccess`), y por eso estas pruebas no intentan
 * demostrar que un Free no puede leer un tránsito: demuestran que el cliente no
 * lo pide, no lo dibuja y no lo promete.
 *
 * Cinco garantías:
 *
 * 1. **El helper.** `planAccess` sólo autoriza con el remoto confirmado para el
 *    dueño vigente. Ni el snapshot local ni la vista efectiva participan: un
 *    plan cacheado puede poner una etiqueta, nunca abrir una pantalla.
 * 2. **El destino de arranque.** Plus entra por Hoy, Free por su carta, el plan
 *    sin resolver espera y la sesión degradada cae en la carta. Vale para las
 *    DOS puertas: la raíz de las pestañas y el arranque real de la app
 *    (`src/routes/v492/index.tsx`), que es por donde entra un relanzamiento
 *    normal y por donde entraba el `/hoy` fijo.
 * 3. **Los datos.** `layersApi` enlaza EXCLUSIVAMENTE las funciones con el plan
 *    resuelto en el servidor, y `useLayers` no pide el sobre hasta saber el
 *    plan.
 * 4. **Las superficies temporales.** Hoy y Tránsitos quedan bloqueadas con el
 *    copy del frame y una sola acción; cualquier deep link a un detalle
 *    temporal aterriza en Tránsitos antes de montar el cálculo.
 * 5. **Vínculos.** Cero personas abre el formulario; una o más conserva todas
 *    las filas y manda `AGREGAR A UNA PERSONA` a la paywall; el patrón
 *    relacional queda cerrado y su CTA va al mismo lugar. El cupo lo dice el
 *    backend (`canCreate`), nunca un conteo hecho en el front.
 *
 * El copy y la composición salen del archivo Figma `BEB5v6SbgJn2Nipm8Qa0wE`,
 * frames `1248:1617` (Hoy), `1249:1633` (Tránsitos), `1250:1651` (Vínculos sin
 * personas) y `1253:1665` (Vínculos con una persona).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { ROOT } from "./moduleGraph";
import {
  HOY_FREE_INTRO,
  HOY_FREE_LOCK,
  PLUS_CTA_LABEL,
  PLUS_PAYWALL_ROUTE,
  RELATIONSHIP_PLUS_REQUIRED,
  TRANSITOS_FREE_INTRO,
  TRANSITOS_FREE_LOCK,
  VINCULOS_ADD_BLOCKED_LABEL,
  VINCULOS_ADD_LABEL,
  VINCULOS_FREE_QUOTA_NOTE,
  VINCULOS_PATTERN_AND_QUOTA_LOCK,
  VINCULOS_PATTERN_LOCK,
  planAccess,
  relationshipAddIntent,
  relationshipPlusRequired,
  startTab
} from "../src/domain/planAccess";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const HOY = "src/screens/v492/HoyScreen.tsx";
const TRANSITOS = "src/screens/v492/TransitosLayersScreen.tsx";
const HUB = "src/screens/v492/VinculosHubScreen.tsx";
const CONECTAR = "src/screens/v492/VinculosConnectScreen.tsx";
const LAYERS_API = "src/services/layersApi.ts";
const VINCULOS_API = "src/services/relationshipsApi.ts";
const USE_LAYERS = "src/hooks/useLayers.tsx";
const GATE = "src/components/v492/PlanGate.tsx";
const ARRANQUE = "src/routes/v492/tabs-index.tsx";
/** El arranque REAL de la app nativa: por acá entra un relanzamiento normal. */
const ARRANQUE_REAL = "src/routes/v492/index.tsx";

const PLUS = { isPro: true };
const FREE = { isPro: false };

// ---------------------------------------------------------------------------
// 1 · El helper
// ---------------------------------------------------------------------------

test("sin respuesta remota confirmada, el plan no autoriza nada", () => {
  // Arranque en frío: la query todavía viaja.
  assert.equal(planAccess({ remote: undefined, resolved: false }), "loading");
  // Y el estado offline del provider (`remote: null, resolved: false`), que es
  // el del build sin backend: tampoco autoriza ni bloquea, porque no hay cuenta
  // que consultar. Las pantallas caen en sus estados de sesión de siempre en
  // vez de mostrar un bloqueo inventado.
  assert.equal(planAccess({ remote: null, resolved: false }), "loading");
});

test("con el remoto confirmado, Plus abre y todo lo demás es Free", () => {
  assert.equal(planAccess({ remote: PLUS, resolved: true }), "plus");
  assert.equal(planAccess({ remote: FREE, resolved: true }), "free");
  // `null` es una RESPUESTA —el backend no reconoce plan—, no una espera.
  assert.equal(planAccess({ remote: null, resolved: true }), "free");
});

test("un remoto ausente nunca se lee como Plus, aunque diga resuelto", () => {
  // Defensa en profundidad: si `resolved` dejara de implicar un remoto presente,
  // la respuesta sigue siendo esperar y no abrir.
  assert.equal(planAccess({ remote: undefined, resolved: true }), "loading");
});

test("el helper mira exactamente dos señales del entitlement", () => {
  const source = sinComentarios(leer("src/domain/planAccess.ts"));
  const cuerpo = source.slice(source.indexOf("export function planAccess"), source.indexOf("export type StartTab"));
  assert.match(cuerpo, /input\.resolved/);
  assert.match(cuerpo, /input\.remote/);
  // Ni la vista efectiva, ni el snapshot, ni el origen: los tres pueden venir
  // del disco y ninguno autoriza.
  assert.doesNotMatch(cuerpo, /effective|hydrated|source|lastConfirmed/);
});

test("el hook del plan deriva del helper y no repite la regla", () => {
  const source = sinComentarios(leer("src/hooks/usePlanAccess.ts"));
  assert.match(source, /const \{ remote, resolved \} = useEntitlement\(\)/);
  assert.match(source, /return planAccess\(\{ remote, resolved \}\)/);
  assert.doesNotMatch(source, /isPro/, "la comparación del plan vive en el dominio, no acá");
});

// ---------------------------------------------------------------------------
// 2 · El destino de arranque
// ---------------------------------------------------------------------------

test("Plus arranca en Hoy y Free en su carta", () => {
  const base = { degraded: false, backendConfigured: true };
  assert.equal(startTab({ ...base, access: "plus" }), "hoy");
  assert.equal(startTab({ ...base, access: "free" }), "carta");
});

test("online sin resolver el plan, el arranque espera", () => {
  assert.equal(
    startTab({ access: "loading", degraded: false, backendConfigured: true }),
    "esperar"
  );
});

test("con la sesión degradada se abre la carta, no un spinner eterno", () => {
  // El plan no va a resolver —por eso está degradada—, así que esperar sería
  // una promesa que no se cumple. Manda sobre cualquier acceso.
  for (const access of ["loading", "free", "plus"] as const) {
    assert.equal(startTab({ access, degraded: true, backendConfigured: true }), "carta", access);
  }
});

test("sin backend configurado el arranque histórico no se mueve", () => {
  assert.equal(
    startTab({ access: "loading", degraded: false, backendConfigured: false }),
    "hoy"
  );
});

test("la ruta raíz de las pestañas aplica esa decisión y ninguna otra", () => {
  const source = sinComentarios(leer(ARRANQUE));
  assert.match(source, /startTab\(\{/);
  assert.match(source, /degraded: confidence === "degraded-local"/);
  assert.match(source, /backendConfigured: backendConfig\.isConfigured/);
  assert.match(source, /destino === "hoy" \? "\/hoy" : CARTA_TAB_ROUTE/);
  // La espera se pinta con el fondo del shell: un frame claro acá es el
  // parpadeo de arranque que se corrigió en QA23-006.
  assert.match(source, /BOOT_BACKGROUND/);
  assert.doesNotMatch(source, /isPro/, "la ruta no vuelve a decidir el plan por su cuenta");
});

// ---------------------------------------------------------------------------
// 2b · El arranque REAL
// ---------------------------------------------------------------------------
//
// La raíz de las pestañas no es por donde entra la app. Un relanzamiento normal
// —el caso más común de todos— abre `app/index.tsx`, que resuelve a
// `src/routes/v492/index.tsx`: ahí `resolveStart` contesta `home` y ESA rama era
// la que fijaba `/hoy`, así que una cuenta Free saltaba la decisión de plan y
// abría la app en una pestaña bloqueada. Lo mismo el arranque en frío sin red,
// que entra por `auth-timeout` con la identidad probada en el llavero.

test("los cinco arranques reales caen donde corresponde", () => {
  // Sesión viva, plan todavía en vuelo: no se afirma ninguna pestaña.
  assert.equal(
    startTab({ access: "loading", degraded: false, backendConfigured: true }),
    "esperar"
  );
  // Plan confirmado: cada uno a lo suyo.
  assert.equal(startTab({ access: "free", degraded: false, backendConfigured: true }), "carta");
  assert.equal(startTab({ access: "plus", degraded: false, backendConfigured: true }), "hoy");
  // Sesión sin confirmar: el plan no va a resolver nunca, así que la espera
  // sería eterna. Manda sobre cualquier acceso, incluido un Plus cacheado.
  for (const access of ["loading", "free", "plus"] as const) {
    assert.equal(startTab({ access, degraded: true, backendConfigured: true }), "carta", access);
  }
  // Build local sin envs: no hay cuenta ni plan que consultar y el arranque
  // histórico no se mueve, pase lo que pase con las otras dos señales.
  for (const access of ["loading", "free", "plus"] as const) {
    for (const degraded of [false, true]) {
      assert.equal(startTab({ access, degraded, backendConfigured: false }), "hoy", access);
    }
  }
});

test("el arranque real aplica la MISMA decisión, con la misma función pura", () => {
  const source = sinComentarios(leer(ARRANQUE_REAL));
  // El mismo hook y la misma regla: no hay una segunda lectura del plan.
  assert.match(source, /import \{ startTab \} from "@\/domain\/planAccess"/);
  assert.match(source, /const acceso = usePlanAccess\(\);/);
  assert.match(source, /startTab\(\{/);
  assert.match(source, /access: acceso,/);
  assert.match(source, /degraded: confidence === "degraded-local",/);
  assert.match(source, /backendConfigured: BACKEND_CONFIGURED/);
  // Y las dos rutas escriben el destino igual: si una divergiera, la app
  // arrancaría en un lugar distinto según por dónde entró.
  const salida = /destino === "hoy" \? "\/hoy" : CARTA_TAB_ROUTE/;
  assert.match(source, salida);
  assert.match(sinComentarios(leer(ARRANQUE)), salida);
});

test("las dos rutas leen el MISMO «hay backend», escrito de dos maneras", () => {
  // `index.tsx` ya traía su propia constante y no se reescribió para esto. Que
  // las dos digan lo mismo no puede quedar en la palabra de un comentario: las
  // tres banderas salen del mismo par de envs, y acá se comprueba.
  assert.match(
    sinComentarios(leer(ARRANQUE_REAL)),
    /const BACKEND_CONFIGURED = backendConfig\.hasConvex && backendConfig\.hasClerk;/
  );
  const providers = sinComentarios(leer("src/services/backendProviders.tsx"));
  assert.match(providers, /hasConvex: Boolean\(convexUrl\)/);
  assert.match(providers, /hasClerk: Boolean\(clerkPublishableKey\)/);
  assert.match(providers, /isConfigured: Boolean\(convexUrl && clerkPublishableKey\)/);
});

test("ninguna rama del arranque real fija la pestaña por fuera de startTab", () => {
  const source = sinComentarios(leer(ARRANQUE_REAL));
  // El defecto exacto: `case "home"` redirigía a `/hoy` a cualquier cuenta.
  const home = source.slice(source.indexOf('case "home":'), source.indexOf('case "resume-onboarding":'));
  assert.match(home, /return arranque;/);
  assert.doesNotMatch(home, /Redirect/, "la rama del producto no arma su propio destino");
  // El arranque en frío con la identidad probada tampoco: entra por la misma
  // puerta, que con la sesión degradada es la carta.
  assert.match(source, /if \(confidence === "degraded-local"\) return arranque;/);
  // Y en TODO el archivo, `/hoy` aparece una sola vez: adentro de la decisión.
  assert.equal(
    (source.match(/"\/hoy"/g) ?? []).length,
    1,
    "un segundo `/hoy` es una rama que saltea el plan"
  );
  assert.doesNotMatch(source, /href="\/hoy"/);
});

test("el arranque espera con su superficie neutral y no nombra ningún plan", () => {
  const source = sinComentarios(leer(ARRANQUE_REAL));
  // `esperar` reutiliza la MISMA espera oscura del resto del arranque; no
  // aparece una superficie nueva ni un frame claro (QA23-006).
  assert.match(source, /const arranque =\s*destino === "esperar" \? \(\s*espera\s*\)/);
  assert.match(source, /const espera = \(\s*<View style=\{styles\.loading\}>\s*<ActivityIndicator color=\{BOOT_ACCENT\} \/>/);
  assert.match(source, /backgroundColor: BOOT_BACKGROUND/);
  // Y la espera es la de siempre: los otros estados neutrales la comparten, así
  // que no puede divergir de un lado.
  assert.equal((source.match(/<ActivityIndicator/g) ?? []).length, 1);
  assert.match(source, /if \(surface === "pending-deletion"\) \{\s*return espera;/);

  // El arranque decide una pestaña; no dibuja el bloqueo ni afirma un plan. Y
  // la autoridad es el remoto confirmado: ni `isPro`, ni el snapshot local, ni
  // la vista efectiva entran acá, así que un cambio de cuenta o un vencimiento
  // no pueden abrir Hoy con un plan que el servidor ya no reconoce.
  assert.doesNotMatch(source, /isPro|useEntitlement|effective|hydrated|lastConfirmed/);
  assert.doesNotMatch(source, /PlanLock|PlanGate|PLUS_CTA_LABEL|PLUS_PAYWALL_ROUTE|HOY_FREE/);
});

// ---------------------------------------------------------------------------
// 3 · Los datos: sólo `…WithAccess`, y nunca sin plan resuelto
// ---------------------------------------------------------------------------

test("el front sólo enlaza las funciones de capas que resuelven el plan", () => {
  const source = sinComentarios(leer(LAYERS_API));
  for (const fn of [
    "getForDateWithAccess",
    "refreshForDateWithAccess",
    "getTransitArcWithAccess",
    "refreshTransitArcWithAccess"
  ]) {
    assert.match(source, new RegExp(`api\\.layers\\.${fn}\\b`), fn);
  }
  // Las versiones sin sufijo siguen existiendo en `convex/` para la convivencia
  // con el build 29, pero el cliente nativo no puede enlazarlas: si una
  // pantalla pudiera elegir el endpoint, el gating dependería de qué componente
  // pregunta.
  for (const fn of ["getForDate", "refreshForDate", "getTransitArc", "refreshTransitArc"]) {
    assert.doesNotMatch(source, new RegExp(`api\\.layers\\.${fn}\\b`), fn);
  }
  // Las natales no cambian: la carta es lo que Free tiene entero.
  assert.match(source, /api\.layers\.getNatalBase\b/);
  assert.match(source, /api\.layers\.getNatalChartBase\b/);
});

test("Vínculos enlaza la lista y el alta con el cupo resuelto en el servidor", () => {
  const source = sinComentarios(leer(VINCULOS_API));
  assert.match(source, /api\.relationships\.listWithAccess\b/);
  assert.match(source, /api\.relationships\.savePersonWithAccess\b/);
  assert.doesNotMatch(source, /api\.relationships\.list\b/);
  assert.doesNotMatch(source, /api\.relationships\.savePerson\b/);
  // Editar, borrar y comparar no se tocan: el cupo limita crear, no tener.
  assert.match(source, /api\.relationships\.removePerson\b/);
  assert.match(source, /api\.relationships\.getComparison\b/);
  assert.match(source, /api\.relationships\.refreshComparison\b/);
});

test("el ciclo de capas no pide el sobre del día hasta saber el plan", () => {
  const source = sinComentarios(leer(USE_LAYERS));
  assert.match(
    source,
    /const accountKey = live\.isLive && access !== "loading"/,
    "la cuenta y el plan entran en la MISMA llave del ciclo"
  );
  assert.match(source, /const access = usePlanAccess\(\)/);
  // Y mientras no se sabe, la fase es carga: publicar `vacio` le diría a una
  // cuenta con datos que no tiene carta sólo porque su plan tarda.
  assert.match(source, /if \(access === "loading"\) return "cargando";/);
  assert.match(source, /useQuery\(\s*\n?\s*layersApi\.getForDateWithAccess/);
  assert.match(source, /useAction\(layersApi\.refreshForDateWithAccess\)/);
});

// ---------------------------------------------------------------------------
// 4 · Hoy y Tránsitos
// ---------------------------------------------------------------------------

test("el copy del bloqueo es exactamente el del frame", () => {
  assert.equal(
    HOY_FREE_INTRO,
    "Hoy lee los movimientos del día sobre tu carta. Con Órbita Free esta pestaña no se calcula."
  );
  assert.equal(
    HOY_FREE_LOCK,
    "Con Órbita Plus, Hoy se calcula todos los días: el ranking de tránsitos, la Luna sobre tu carta y tu cumpleluna."
  );
  assert.equal(
    TRANSITOS_FREE_INTRO,
    "Tránsitos reúne los movimientos activos sobre tu carta. Con Órbita Free esta pestaña no se calcula."
  );
  assert.equal(
    TRANSITOS_FREE_LOCK,
    "Con Órbita Plus se abre la lista completa de hoy y el detalle de cada tránsito, con su ventana y sus fechas. Cualquier link a un tránsito aterriza acá hasta que actives Plus."
  );
  assert.equal(PLUS_CTA_LABEL, "VER ÓRBITA PLUS");
  assert.equal(PLUS_PAYWALL_ROUTE, "/paywall");
});

test("el bloqueo tiene UNA acción y siempre es la paywall", () => {
  const source = sinComentarios(leer("src/components/v492/PlanLock.tsx"));
  assert.match(source, /label=\{PLUS_CTA_LABEL\}/);
  assert.match(source, /router\.push\(PLUS_PAYWALL_ROUTE as never\)/);
  // Una sola: un bloque cerrado por plan con dos salidas obliga a elegir entre
  // dos cosas que abren lo mismo.
  assert.equal((source.match(/<PrimaryButton/g) ?? []).length, 1);
  // Piezas existentes, sin color, tarjeta ni candado nuevos: el bloqueo se
  // compone con `Divider`, `Body` y `PrimaryButton`, que ya existían.
  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b|rgba\(/, "sin colores propios");
  assert.doesNotMatch(source, /<Card\b/, "no es una tarjeta nueva");
  assert.doesNotMatch(source, /🔒|candado|Ionicons|MaterialIcons|Feather/i, "ni un candado dibujado");
  for (const pieza of ["<Divider", "<Body>", "<PrimaryButton"]) {
    assert.ok(source.includes(pieza), pieza);
  }
});

test("Hoy con Free se resuelve antes que cualquier fase, sin datos y sin refresco", () => {
  const source = sinComentarios(leer(HOY));
  const cuerpo = source.slice(source.indexOf("export function HoyScreen"), source.indexOf("function Shell"));

  const bloqueo = cuerpo.indexOf('acceso === "free"');
  const cargando = cuerpo.indexOf('phase === "cargando"');
  assert.ok(bloqueo > 0 && cargando > bloqueo, "el bloqueo se decide antes que las fases del sobre");

  const rama = cuerpo.slice(bloqueo, cargando);
  assert.match(rama, /intro=\{HOY_FREE_INTRO\}/);
  assert.match(rama, /<PlanLockBlock/);
  assert.match(rama, /line=\{HOY_FREE_LOCK\}/);
  // Ni contador de capas, ni pull para actualizar: no hay cálculo que contar ni
  // que rehacer.
  assert.doesNotMatch(rama, /capas=|onRefresh=|refreshing=/);
  // Y ninguno de los tres bloques del día.
  assert.doesNotMatch(rama, /RankingBloque|LunaBloque|CumplelunaBloque|HoyContent/);
});

test("Tránsitos con Free queda sin datos y SIN selector de vista", () => {
  const source = sinComentarios(leer(TRANSITOS));
  const cuerpo = source.slice(
    source.indexOf("export function TransitosLayersScreen"),
    source.indexOf("function introMomento")
  );

  const bloqueo = cuerpo.indexOf('acceso === "free"');
  const cargando = cuerpo.indexOf('phase === "cargando"');
  assert.ok(bloqueo > 0 && cargando > bloqueo, "el bloqueo se decide antes que las fases del sobre");

  const rama = cuerpo.slice(bloqueo, cargando);
  assert.match(rama, /intro=\{TRANSITOS_FREE_INTRO\}/);
  assert.match(rama, /line=\{TRANSITOS_FREE_LOCK\}/);
  // `Ahora` y `Tu momento` son dos vistas del MISMO cálculo: ofrecer el cambio
  // sería mover a la persona entre dos bloqueos idénticos.
  assert.match(rama, /pills=\{null\}/);
  assert.match(rama, /capas=\{null\}/);
  assert.doesNotMatch(rama, /AhoraView|MomentoView|onRefresh=/);
});

test("Plus conserva Hoy y Tránsitos tal como estaban", () => {
  const hoy = sinComentarios(leer(HOY));
  // Los tres bloques del día siguen ahí, en su orden, y la lista completa
  // también: el plan sólo agrega una rama, no reescribe la pantalla.
  for (const pieza of ["RankingBloque", "LunaBloque", "CumplelunaBloque", "LO PRINCIPAL HOY"]) {
    assert.match(hoy, new RegExp(pieza), pieza);
  }
  const transitos = sinComentarios(leer(TRANSITOS));
  for (const pieza of ["AhoraView", "MomentoView", "<Segmented", "TU MOMENTO · EL CAPÍTULO ACTUAL"]) {
    assert.ok(transitos.includes(pieza), pieza);
  }
});

// ---------------------------------------------------------------------------
// 4b · Deep links temporales
// ---------------------------------------------------------------------------

test("el gate temporal redirige a Tránsitos con Free y espera mientras no sabe", () => {
  const source = sinComentarios(leer(GATE));
  assert.match(source, /if \(acceso === "free"\) return <Redirect href=\{TRANSITOS_ROUTE as never\} \/>;/);
  // Con el plan sin resolver NO se redirige: mandaría a Tránsitos a alguien que
  // sí tiene Plus, sólo porque su red estaba lenta. El hijo dibuja su carga,
  // porque el ciclo tampoco pidió su sobre.
  assert.doesNotMatch(source, /acceso === "loading"[\s\S]*Redirect/);
  assert.match(source, /return <>\{children\}<\/>;/);
});

test("todas las superficies temporales pasan por el gate antes de montar", () => {
  const rutas = [
    "src/routes/v492/hoy-luna.tsx",
    "src/routes/v492/hoy-cumpleluna.tsx",
    "src/routes/v492/transitos-momento.tsx",
    "src/routes/v492/transitos-arco.tsx",
    "src/routes/v492/transitos-capa.tsx"
  ];
  for (const ruta of rutas) {
    const source = sinComentarios(leer(ruta));
    assert.match(source, /import \{ TemporalPlusGate \} from "@\/components\/v492\/PlanGate"/, ruta);
    assert.match(source, /<TemporalPlusGate>/, ruta);
  }
  // Y las dos rutas de `app/` que montan esos detalles delegan en las de arriba.
  for (const wrapper of ["app/(tabs)/hoy/luna.tsx", "app/(tabs)/hoy/cumpleluna.tsx"]) {
    assert.match(sinComentarios(leer(wrapper)), /@\/routes\/v492\/hoy-/, wrapper);
  }
  // `/hoy/arco` es una traducción de enlace viejo: con Free no espera un `arcId`
  // que nunca va a existir, cae directo en el bloqueo.
  const arco = sinComentarios(leer("app/(tabs)/hoy/arco.tsx"));
  assert.match(arco, /if \(acceso === "free"\) return <Redirect href=\{TRANSITOS_ROUTE as never\} \/>;/);
});

// ---------------------------------------------------------------------------
// 5 · Vínculos
// ---------------------------------------------------------------------------

test("el cupo lo decide el backend: cero abre el formulario, uno o más la paywall", () => {
  assert.equal(relationshipAddIntent({ currentCount: 0, canCreate: true }), "formulario");
  assert.equal(relationshipAddIntent({ currentCount: 1, canCreate: false }), "paywall");
  // Una cuenta histórica Free con VARIAS personas las conserva todas; lo único
  // que no puede es crear otra.
  assert.equal(relationshipAddIntent({ currentCount: 3, canCreate: false }), "paywall");
  // Plus: siempre puede, tenga las que tenga.
  assert.equal(relationshipAddIntent({ currentCount: 7, canCreate: true }), "formulario");
});

test("mientras la lista viaja, el alta no afirma ninguno de los dos destinos", () => {
  assert.equal(relationshipAddIntent(undefined), "esperar");
});

test("el rechazo del backend se reconoce por su código estable", () => {
  assert.equal(RELATIONSHIP_PLUS_REQUIRED, "RELATIONSHIP_PLUS_REQUIRED");
  // Convex envuelve el mensaje: llega adentro del texto del error.
  assert.ok(relationshipPlusRequired(new Error("Uncaught Error: RELATIONSHIP_PLUS_REQUIRED at ...")));
  assert.ok(relationshipPlusRequired("RELATIONSHIP_PLUS_REQUIRED"));
  assert.ok(relationshipPlusRequired({ message: "… RELATIONSHIP_PLUS_REQUIRED …" }));
  // Y no se confunde con cualquier otro fallo, que sí se dice como fallo.
  assert.equal(relationshipPlusRequired(new Error("Network request failed")), false);
  assert.equal(relationshipPlusRequired(null), false);
  assert.equal(relationshipPlusRequired(undefined), false);
});

test("la raíz de Vínculos conserva TODAS las filas y sólo cambia el destino del alta", () => {
  const source = sinComentarios(leer(HUB));
  const live = source.slice(source.indexOf("function VinculosHubLive"), source.indexOf("function metaPersonas"));

  // El cupo sale de la respuesta del backend, nunca de contar la lista acá.
  assert.match(live, /const alta = relationshipAddIntent\(acceso\)/);
  assert.doesNotMatch(live, /profiles\.length/);
  // Contar las filas puede decidir GEOMETRÍA —el frame acerca el alta cuando
  // arriba hay una fila guardada— y NADA MÁS: el permiso es `alta`. El único
  // conteo que esta función puede hacer es ese, y se escribe entero acá para
  // que agregar otro rompa la prueba en vez de pasar inadvertido.
  assert.deepEqual(
    (live.match(/^.*personas\.length.*$/gm) ?? []).map((linea) => linea.trim()),
    ["const freeConFila = free && personas !== undefined && personas.length > 0;"]
  );
  // Las filas se dibujan igual, con Free y con Plus: la lista entra entera, sin
  // recorte ni condición.
  assert.match(live, /<PersonasBlock personas=\{personas\} flushFirst=\{free\} \/>/);

  // Un solo botón, con los dos rótulos del frame y los dos destinos.
  assert.match(live, /label=\{alta === "paywall" \? VINCULOS_ADD_BLOCKED_LABEL : VINCULOS_ADD_LABEL\}/);
  assert.match(
    live,
    /router\.push\(\(alta === "paywall" \? PLUS_PAYWALL_ROUTE : VINCULOS_FORM_ROUTE\) as never\)/
  );
  assert.match(live, /disabled=\{alta === "esperar"\}/);
  assert.equal(VINCULOS_ADD_LABEL, "AGREGAR UNA PERSONA");
  assert.equal(VINCULOS_ADD_BLOCKED_LABEL, "AGREGAR A UNA PERSONA");
});

test("con cupo libre se dice qué incluye Free, y con el cupo tomado ya no", () => {
  const source = sinComentarios(leer(HUB));
  const live = source.slice(source.indexOf("function VinculosHubLive"), source.indexOf("function metaPersonas"));
  assert.match(live, /patronBloqueado && alta === "formulario" \? \(\s*<Note style=\{styles\.cupo\}>\{VINCULOS_FREE_QUOTA_NOTE\}/);
  assert.equal(
    VINCULOS_FREE_QUOTA_NOTE,
    "Órbita Free incluye una persona. Podés guardar sus datos, editarlos y ver la comparación completa."
  );
});

test("el patrón relacional se cierra directo, sin estado ni trazabilidad", () => {
  const source = sinComentarios(leer(HUB));
  const live = source.slice(source.indexOf("function VinculosHubLive"), source.indexOf("function metaPersonas"));
  const bloqueo = live.slice(live.indexOf("patronBloqueado ? ("), live.indexOf("<StatusLine"));

  assert.match(bloqueo, /<PlanLockBlock/);
  assert.match(bloqueo, /rule=\{false\}/, "el encabezado del módulo ya trae su línea fina");
  assert.match(
    bloqueo,
    /line=\{alta === "paywall" \? VINCULOS_PATTERN_AND_QUOTA_LOCK : VINCULOS_PATTERN_LOCK\}/
  );
  // No hay cálculo que declarar ni que trazar: decirlo sería inventar un estado.
  assert.doesNotMatch(bloqueo, /StatusLine|TraceAccordion|MissingBlock|PatternBody/);

  assert.equal(VINCULOS_PATTERN_LOCK, "Tu patrón relacional está disponible con Órbita Plus.");
  assert.equal(
    VINCULOS_PATTERN_AND_QUOTA_LOCK,
    "Con Órbita Plus podés guardar más personas y abrir tu patrón relacional."
  );
});

test("Plus conserva el patrón relacional entero", () => {
  const source = sinComentarios(leer(HUB));
  const live = source.slice(source.indexOf("function VinculosHubLive"), source.indexOf("function metaPersonas"));
  const abierto = live.slice(live.indexOf("<StatusLine"));
  for (const pieza of ["StatusLine", "PatternBody", "LimitationList", "MissingBlock", "TraceAccordion"]) {
    assert.ok(abierto.includes(pieza), pieza);
  }
});

test("el formulario directo respeta el cupo antes de montarse, y editar sigue abierto", () => {
  const source = sinComentarios(leer(CONECTAR));
  const flow = source.slice(source.indexOf("function ConnectFlow"), source.indexOf("function ConnectForm"));

  // La lista se pide SIEMPRE: el cupo viaja en la misma respuesta que valida el
  // id, y un alta directa también tiene que respetarlo.
  assert.match(flow, /useQuery\(relationshipsApi\.listWithAccess, \{\}\)/);
  assert.doesNotMatch(flow, /"skip"/);

  // Sin id: se espera, se ofrece la paywall, o se abre el formulario.
  const alta = flow.slice(flow.indexOf("if (!pedido)"), flow.indexOf("if (persona === undefined)"));
  assert.match(alta, /alta === "esperar"/);
  assert.match(alta, /if \(alta === "paywall"\) return <Redirect href=\{PLUS_PAYWALL_ROUTE as never\} \/>;/);
  assert.match(alta, /return <ConnectForm persona=\{null\} \/>;/);

  // Con id, editar no depende del cupo: la persona ya está guardada.
  const edicion = flow.slice(flow.indexOf("if (persona === undefined)"));
  assert.doesNotMatch(edicion, /alta === "paywall"|PLUS_PAYWALL_ROUTE/);
  assert.match(edicion, /<ConnectForm key=\{persona\.profileId\} persona=\{persona\} \/>/);
});

test("un guardado rechazado por cupo va a la paywall y no se dice como fallo", () => {
  const source = sinComentarios(leer(CONECTAR));
  assert.match(source, /useMutation\(relationshipsApi\.savePersonWithAccess\)/);
  const captura = source.slice(source.indexOf("} catch (error) {"));
  const salida = captura.slice(0, captura.indexOf("setSaveError"));
  assert.match(salida, /if \(relationshipPlusRequired\(error\)\) \{/);
  assert.match(salida, /router\.replace\(PLUS_PAYWALL_ROUTE as never\)/);
  // No hay nada que reintentar hasta que el plan cambie: el mensaje de error de
  // red queda para lo que de verdad es un error de red.
  assert.match(captura, /No pudimos guardar/);
});
