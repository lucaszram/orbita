import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { FREE_TAROT_REVEAL_LIMIT, FREE_TAROT_REVEAL_LIMIT_REACHED } from "../convex/lib/tarotAccess";
import { recepcionCta } from "../src/domain/entitlement";
import { plusActivation } from "../src/domain/paywall";
import { FREE_TAROT_LIMIT_MARKER, revealFailureKind } from "../src/domain/ritual";

/**
 * El cierre del alta: recepción → carta o paywall, el CTA de la carta parcial,
 * el copy de la oferta, la activación desde Perfil y el límite Free del Tarot.
 *
 * No se puede renderizar React Native en node: lo que se verifica del lado de
 * las pantallas es ESTRUCTURAL (mismo patrón que `perfilAppReview.test.ts`), y
 * las decisiones reales viven en módulos de dominio puros que sí se ejecutan.
 */
const ROOT = join(import.meta.dirname, "..");
const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Un comentario no es conducta: las afirmaciones no pueden pasar por citarlo. */
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const FLOW = sinComentarios(leer("src/onboarding/OnboardingFlow.tsx"));
const RECEPCION = sinComentarios(leer("app/recepcion.tsx"));
const CARTA = sinComentarios(leer("src/screens/CartaScreen.tsx"));
const PAYWALL = sinComentarios(leer("src/components/web/orbita-paywall.tsx"));
const PLAN_BLOCK = sinComentarios(leer("src/components/orbita/ManageSubscription.tsx"));
const HOME = sinComentarios(leer("src/screens/HomeScreen.tsx"));

// --- 1. El alta termina en la recepción -------------------------------------

test("la salida del alta navega a /recepcion, no a Home", () => {
  assert.match(FLOW, /import \{ RECEPTION_ROUTE \} from "@\/domain\/appRoutes"/);
  assert.match(FLOW, /router\.replace\(\{\s*pathname: RECEPTION_ROUTE,/);
  assert.doesNotMatch(FLOW, /HOME_ROUTE/, "el destino del cierre ya no es Home");
  assert.match(sinComentarios(leer("src/domain/appRoutes.ts")), /RECEPTION_ROUTE = "\/recepcion"/);
});

test("la tríada REAL calculada por el alta viaja en los params", () => {
  const salida = FLOW.slice(FLOW.indexOf("const enterApp = async () => {"));
  assert.match(salida, /sol: computed\.sun/);
  assert.match(salida, /luna: computed\.moon/);
  assert.match(salida, /asc: computed\.ascendant/);
  // Y sólo se manda lo que se calculó: nada de placeholders ni signos inventados.
  assert.match(salida, /\.\.\.\(computed\?\.sun \? \{ sol: computed\.sun \} : \{\}\)/);
});

test("el cierre conserva perfil, limpieza del borrador y su lock de una sola salida", () => {
  const salida = FLOW.slice(FLOW.indexOf("const enterApp = async () => {"));
  const perfil = salida.indexOf("await createProfile(");
  const limpiar = salida.indexOf("clearDraft()");
  const navegar = salida.indexOf("router.replace(");
  assert.ok(perfil !== -1 && limpiar > perfil && navegar > limpiar, "el orden de salida se conserva");
  assert.match(FLOW, /if \(enterLock\.current\) return;\s*enterLock\.current = true;/);
  assert.match(FLOW, /if \(!isBirthDataReady\(completion\)\) return;\s*void enterApp\(\);/);
  assert.match(FLOW, /resolveProfileOwnerAtCreation\(\{/, "la adopción del perfil sigue igual");
});

// --- 2. La recepción decide con el entitlement autoritativo -----------------

test("Free ve la salida a la paywall y Plus la salida a su carta", () => {
  assert.equal(recepcionCta({ entitlement: { isPro: false }, live: true }), "desbloquear");
  assert.equal(recepcionCta({ entitlement: { isPro: true }, live: true }), "entrar");
});

test("mientras el plan no resolvió no se afirma que la cuenta es Free", () => {
  assert.equal(recepcionCta({ entitlement: undefined, live: true }), "cargando");
});

test("un entitlement ilegible falla cerrado y una app sin backend conserva su salida", () => {
  assert.equal(recepcionCta({ entitlement: null, live: true }), "desbloquear");
  assert.equal(recepcionCta({ entitlement: undefined, live: false }), "entrar");
});

test("la recepción consulta el entitlement real y cablea los tres estados", () => {
  assert.match(RECEPCION, /useQuery\(appApi\.subscriptions\.getCurrent, isLive \? \{\} : "skip"\)/);
  assert.match(RECEPCION, /recepcionCta\(\{ entitlement, live: isLive \}\)/);
  assert.match(RECEPCION, /cta === "desbloquear" \? "\/paywall" : "\/\(tabs\)\/carta"/);
  assert.match(RECEPCION, /DESBLOQUEAR MI CARTA NATAL/);
  assert.match(RECEPCION, /ENTRAR A MI CARTA/);
  // Cargando: el botón no navega ni promete un plan.
  assert.match(RECEPCION, /if \(cta === "cargando"\) return;/);
  assert.match(RECEPCION, /disabled=\{cta === "cargando"\}/);
  assert.match(RECEPCION, /cta === "cargando"\s*\?\s*"UN MOMENTO…"/);
});

test("VER DESPUÉS sigue llevando a la Home autenticada de cada plataforma", () => {
  assert.match(RECEPCION, /VER DESPUÉS/);
  assert.match(RECEPCION, /router\.replace\(HOME_ROUTE as never\)/);
  // `/(tabs)` en web resuelve a la landing pública: por eso el destino es HOME_ROUTE.
  assert.doesNotMatch(RECEPCION, /router\.replace\("\/\(tabs\)"\)/);
});

test("la ceremonia conserva rueda real, tríada y la marca de primera vez", () => {
  assert.match(RECEPCION, /personalChartGate\(\{ birth: remoteBirth, chart: chartDoc \}\)/);
  assert.match(RECEPCION, /<NatalWheel payload=\{payload\} size=\{size\} \/>/);
  assert.match(RECEPCION, /<TriadLine/);
  assert.match(RECEPCION, /markFirstRun\(\{ recepcionVista: true \}\)/);
});

// --- 3. El CTA de la carta bloqueada ---------------------------------------

test("la carta Free bloqueada ofrece DESBLOQUEAR MI CARTA NATAL hacia /paywall", () => {
  assert.match(CARTA, /<Pill label="DESBLOQUEAR MI CARTA NATAL" onPress=\{\(\) => router\.push\("\/paywall"\)\} \/>/);
  assert.doesNotMatch(CARTA, /VER ÓRBITA PLUS/);
});

test("el bloqueo por plan no ofrece REINTENTAR, y el error real sí", () => {
  const bloque = CARTA.slice(CARTA.indexOf('readingPhase === "bloqueado"'), CARTA.indexOf("if (chapters.length === 0)"));
  assert.doesNotMatch(bloque.slice(0, bloque.indexOf("REINTENTAR")), /Pill label="REINTENTAR"/);
  assert.match(CARTA, /<Pill label="REINTENTAR" onPress=\{onRetryReading\} \/>/);
  assert.match(CARTA, /state === "failed" \? "REINTENTAR"/, "el recálculo de la carta conserva su reintento");
});

test("la carta conserva rueda, tríada y posiciones", () => {
  assert.match(CARTA, /<NatalWheel/);
  assert.match(CARTA, /<CartaTriad triad=\{payload\.triad\} \/>/);
  assert.match(CARTA, /payload\.placements\.map/);
});

// --- 4. Qué desbloquea Plus, dicho ANTES de mandar al pago -------------------
//
// La oferta intermedia de `/paywall` se eliminó: la ruta es el lanzador del
// checkout (ver `test/paywall.test.ts`). La explicación de qué se desbloquea
// tiene que vivir entonces en la superficie que trae a la persona hasta ahí —
// que además es donde el bloqueo se está viviendo—, no después del CTA.

test("la carta natal completa se nombra donde se ofrece Plus: rueda, casas, aspectos y capítulos", () => {
  const oferta = PLAN_BLOCK.slice(PLAN_BLOCK.indexOf('if (activacion === "activar")'));
  for (const palabra of ["rueda", "casas", "aspectos", "capítulos"]) {
    assert.ok(oferta.includes(palabra), `Perfil no nombra "${palabra}" al ofrecer Plus`);
  }
  // Y la carta bloqueada dice exactamente qué falta antes de mandar al pago.
  assert.match(CARTA, /Los siete capítulos de tu carta son parte de Órbita Plus/);
});

test("el límite del Tarot se explica en la Home, no después del CTA", () => {
  assert.match(HOME, /Órbita Free incluye siete cartas de Tarot/);
  // Voseo, como el resto de la marca.
  assert.match(HOME, /seguís sacando una carta/);
});

test("ninguna de esas superficies escribe precios: el importe es el de Stripe", () => {
  for (const [nombre, src] of [["Perfil", PLAN_BLOCK], ["Carta", CARTA], ["Home", HOME]] as const) {
    assert.doesNotMatch(src, /\$\s?\d|USD\s?\d/, `${nombre} escribe un importe a mano`);
  }
  // El único camino a checkout sigue siendo `/paywall`.
  assert.doesNotMatch(PLAN_BLOCK, /createCheckoutSession/);
  assert.doesNotMatch(CARTA, /createCheckoutSession/);
  assert.doesNotMatch(HOME, /createCheckoutSession/);
});

test("`/paywall` abre Stripe directo, así que los CTA existentes siguen sirviendo", () => {
  assert.match(PAYWALL, /createCheckout\(\{ plan: "monthly" \}\)/);
  assert.match(PAYWALL, /window\.location\.replace\(url\)/);
  assert.doesNotMatch(PAYWALL, /window\.location\.assign\(/);
  assert.match(PAYWALL, /Abriendo el pago seguro…/);
  // Y ya no hay una oferta intermedia que leer.
  assert.equal(PAYWALL.includes("QUÉ INCLUYE"), false);
});

// --- 5. Activación de Plus desde Perfil ------------------------------------

test("una cuenta sin acceso puede activar Plus", () => {
  assert.equal(
    plusActivation({ entitlement: { isPro: false, canManageInStripePortal: false } }),
    "activar"
  );
});

test("una cuenta con acceso nunca ve una invitación a contratar de nuevo", () => {
  assert.equal(
    plusActivation({ entitlement: { isPro: true, canManageInStripePortal: true } }),
    "oculto"
  );
  // Lifetime / RevenueCat: el portal no los gestiona, pero tienen acceso.
  assert.equal(
    plusActivation({ entitlement: { isPro: true, canManageInStripePortal: false } }),
    "oculto"
  );
});

test("sin entitlement resuelto no se afirma Free, y uno ilegible falla cerrado", () => {
  assert.equal(plusActivation({ entitlement: undefined }), "cargando");
  assert.equal(plusActivation({ entitlement: null }), "oculto");
});

test("Perfil ofrece ACTIVAR ÓRBITA PLUS hacia /paywall con la autoridad del backend", () => {
  assert.match(PLAN_BLOCK, /useQuery\(appApi\.subscriptions\.getCurrent, \{\}\)/);
  assert.match(PLAN_BLOCK, /plusActivation\(\{ entitlement \}\)/);
  assert.match(PLAN_BLOCK, /if \(activacion === "activar"\)/);
  assert.match(PLAN_BLOCK, /<Pill label="ACTIVAR ÓRBITA PLUS" onPress=\{\(\) => router\.push\("\/paywall"\)\} \/>/);
  // El bloque no escribe precios: los pide `/paywall` a Stripe.
  assert.doesNotMatch(PLAN_BLOCK, /\$\s?\d/);
});

test("una cuenta Plus conserva la gestión de suscripción y el camino de soporte", () => {
  assert.match(PLAN_BLOCK, /manageSubscription\(\{ entitlement, commerceEnabled \}\)/);
  assert.match(PLAN_BLOCK, /createPortal\(\{\}\)/);
  assert.match(PLAN_BLOCK, /GESTIONAR SUSCRIPCIÓN/);
  assert.match(PLAN_BLOCK, /decision === "soporte"/);
  assert.match(PLAN_BLOCK, /SUPPORT_URL/);
  // La activación se decide ANTES de ocultar por "no hay nada que gestionar",
  // que es exactamente el caso Free.
  assert.ok(
    PLAN_BLOCK.indexOf('if (activacion === "activar")') < PLAN_BLOCK.indexOf('if (decision === "oculto") return null;')
  );
});

// --- 6. El límite Free del Tarot en la Home --------------------------------

test("el marcador del frontend es exactamente el que publica el backend", () => {
  assert.equal(FREE_TAROT_LIMIT_MARKER, FREE_TAROT_REVEAL_LIMIT_REACHED);
  assert.equal(FREE_TAROT_REVEAL_LIMIT, 7);
});

test("el marcador se reconoce envuelto en el mensaje de error de Convex", () => {
  const envuelto = new Error(
    "[Request ID: abc123] Server Error\nUncaught Error: FREE_TAROT_REVEAL_LIMIT_REACHED\n    at handler (../convex/daily.ts:1522:9)"
  );
  assert.equal(revealFailureKind(envuelto), "limite_free");
  assert.equal(revealFailureKind(new Error(FREE_TAROT_REVEAL_LIMIT_REACHED)), "limite_free");
});

// El incidente real: producción tira `new ConvexError({ code })`. El marcador
// viaja en `error.data.code` y el mensaje queda en "Server Error", así que
// mirar sólo el mensaje devolvía `desconocido`: la carta volvía al dorso y
// nunca aparecía `DESBLOQUEAR TAROT DIARIO`.
test("el error real de producción (ConvexError con data.code) es el límite Free", () => {
  const produccion = Object.assign(new Error("Server Error"), {
    data: { code: FREE_TAROT_LIMIT_MARKER }
  });
  assert.equal(revealFailureKind(produccion), "limite_free");

  // Con request id adelante, como lo muestra el navegador.
  const conRequestId = Object.assign(new Error("[Request ID: abc123] Server Error"), {
    data: { code: FREE_TAROT_REVEAL_LIMIT_REACHED }
  });
  assert.equal(revealFailureKind(conRequestId), "limite_free");
});

test("cualquier otro fallo conserva el comportamiento de siempre", () => {
  assert.equal(revealFailureKind(new Error("Network request failed")), "desconocido");
  assert.equal(revealFailureKind(new Error("Sólo se puede revelar la carta del día actual")), "desconocido");
  // Otro ConvexError con datos propios no se confunde con el límite.
  assert.equal(
    revealFailureKind(Object.assign(new Error("Server Error"), { data: { code: "OTRA_COSA" } })),
    "desconocido"
  );
  assert.equal(
    revealFailureKind(Object.assign(new Error("Server Error"), { data: { code: 42 } })),
    "desconocido"
  );
  assert.equal(revealFailureKind(Object.assign(new Error("Server Error"), { data: null })), "desconocido");
  // Un valor que ni siquiera es un Error no puede colar un límite falso.
  assert.equal(revealFailureKind("FREE_TAROT_REVEAL_LIMIT_REACHED"), "desconocido");
  assert.equal(revealFailureKind({ message: "FREE_TAROT_REVEAL_LIMIT_REACHED" }), "desconocido");
  assert.equal(revealFailureKind({ data: { code: FREE_TAROT_LIMIT_MARKER } }), "desconocido");
  assert.equal(revealFailureKind(undefined), "desconocido");
});

test("la Home no muestra el giro como exitoso y abre una salida a Plus", () => {
  const pull = HOME.slice(HOME.indexOf("async function pullCard()"), HOME.indexOf("const prevRevealed"));
  assert.match(pull, /revealFailureKind\(e\) === "limite_free"/);
  assert.match(pull, /setTarotLimite\(true\);\s*return false;/, "el reveal fallido nunca devuelve true");
  // El error desconocido conserva su rama: aviso en consola y `false`.
  assert.match(pull, /console\.warn\("\[orbita\] daily\.revealCard falló:"/);
  assert.match(HOME, /DESBLOQUEAR TAROT DIARIO/);
  assert.match(pull, /if \(tarotLimite\) \{\s*router\.push\("\/paywall"\);\s*return false;/);
  assert.match(HOME, /onReveal=\{handleCardPress\}/);
  assert.match(HOME, /ctaMode=\{tarotLimite \? "unlock" : "reveal"\}/);
  assert.match(HOME, /\{tarotLimite \? \(/);
});

test("el estado del límite no agrega un botón duplicado: la carta es el CTA", () => {
  const bloque = HOME.slice(HOME.indexOf("{tarotLimite ? ("), HOME.indexOf("{revealed && primerRitualHoy ? ("));
  assert.doesNotMatch(bloque, /REINTENTAR|Pressable|router\.push|DESBLOQUEAR TAROT DIARIO/);
  assert.match(bloque, /Usaste tus siete cartas\./);
  assert.match(HOME, /if \(tarotLimite\) \{\s*cartaCtaLabel = "DESBLOQUEAR TAROT DIARIO";/);
});

test("la carta en modo unlock navega sin animar un reveal imposible", () => {
  const carta = leer("src/components/home/CartaDelDia.tsx");
  const pull = carta.slice(carta.indexOf("async function pull()"), carta.indexOf("// Las dos caras"));
  assert.match(pull, /if \(ctaMode === "unlock"\) \{\s*await Promise\.resolve\(onReveal\(\)\);\s*return;/);
  assert.ok(
    pull.indexOf('if (ctaMode === "unlock")') < pull.indexOf("setPulling(true)"),
    "unlock debe salir antes del flip optimista"
  );
  assert.match(carta, /Desbloquear el Tarot diario con Órbita Plus/);
});

test("el texto bajo el dorso también es clicable, igual que la carta", () => {
  const carta = leer("src/components/home/CartaDelDia.tsx");
  assert.equal(
    (carta.match(/onPress=\{pull\}/g) ?? []).length,
    2,
    "la imagen y su CTA textual deben ejecutar la misma acción"
  );
  assert.match(
    carta,
    /<Pressable\s+onPress=\{pull\}\s+disabled=\{closedActionDisabled\}[\s\S]*?accessibilityLabel=\{closedActionLabel\}[\s\S]*?<Text style=\{styles\.revealCta\}>/
  );
  assert.match(carta, /ctaMode === "unlock"[\s\S]*?Desbloquear el Tarot diario con Órbita Plus/);
});
