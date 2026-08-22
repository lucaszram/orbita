/**
 * QA22 — el indicador de plan: qué dice, cuándo lo dice y de dónde lo saca.
 *
 * El defecto que cierra: al arrancar en frío, `subscriptions.getCurrent` tarda y
 * todo lo que leía el entitlement crudo publicaba "Órbita Free" en el intervalo.
 * A alguien que paga la app le decía, cada arranque, que no paga.
 *
 * La regla tiene un solo filo —el snapshot local **sólo llena el hueco**— y de
 * ahí salen las cuatro garantías que se prueban acá:
 *
 * 1. **La decisión es pura** (`resolvePlanView`). Con respuesta remota manda el
 *    remoto y el snapshot se actualiza; sin respuesta se usa el último
 *    confirmado, y sólo si el disco ya se leyó. Nunca al revés: un `lastConfirmed`
 *    de Plus no puede sobrevivir a un remoto que ya dijo Free.
 * 2. **Presentar no es conceder.** El snapshot pone una etiqueta; `resolved` —el
 *    remoto confirmado para la cuenta vigente— es lo único que autoriza cobrar.
 * 3. **El snapshot viaja con su dueño adentro** y ante cualquier duda no afirma
 *    ningún plan: ilegible, sin dueño vigente o de otra cuenta se leen `null`.
 * 4. **Una sola fuente y un solo dibujante.** UNA `subscriptions.getCurrent` en
 *    el provider central, montado una vez en el layout raíz; las pantallas de
 *    plata leen el REMOTO y no montan query propia; el chip nombra el plan desde
 *    el dominio y los dos extremos de la barra de detalle miden lo mismo.
 *
 * Las comprobaciones estructurales corren sobre el CÓDIGO, no sobre lo que los
 * comentarios cuentan de él: estos archivos documentan largo, y una regla que se
 * cumple sólo en un comentario no se cumple.
 *
 * ## Lo que QA23 movió, y lo que no
 *
 * Cuánto texto escribe el chip dejó de ser una constante y pasó a ser una
 * `variant` obligatoria: la raíz de una pestaña dibuja la marca corta
 * (`PLUS`/`FREE`) y la barra de un detalle el nombre entero (QA23-001). Las
 * cuatro garantías de arriba no se tocan —el chip sigue sin especular, sigue
 * anunciando el nombre COMPLETO por VoiceOver y sigue sacándolo del dominio—,
 * así que acá lo que cambia es la forma que se exige, no la regla. La ventana en
 * la que se publicaba `Free` sin saberlo, y su cierre, se prueban en
 * `planIndicatorQA23.test.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  PLAN_FREE_LABEL,
  PLAN_PLUS_LABEL,
  parsePlanSnapshot,
  planLabel,
  resolvePlanView,
  serializePlanSnapshot,
  type ConfirmedPlan
} from "../src/domain/entitlement";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Una regla se comprueba sobre el código: los comentarios no ejecutan nada. */
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const veces = (source: string, re: RegExp) => (source.match(re) ?? []).length;

/** El cuerpo de una función exportada: de su firma hasta la de la siguiente. */
function cuerpo(source: string, desde: string, hasta: string): string {
  const inicio = source.indexOf(desde);
  const fin = source.indexOf(hasta);
  if (inicio < 0) throw new Error(`no encontré \`${desde}\``);
  if (fin <= inicio) throw new Error(`no encontré \`${hasta}\` después de \`${desde}\``);
  return source.slice(inicio, fin);
}

const PROVIDER_REL = "src/hooks/useLiveApp.tsx";
const PAYWALL_REL = "src/screens/v492/PlusPaywallScreen.tsx";
const PERFIL_REL = "src/components/orbita/ManageSubscription.tsx";

const LAYOUT = sinComentarios(leer("app/_layout.tsx"));
const PROVIDER = sinComentarios(leer(PROVIDER_REL));
const SCREEN = sinComentarios(leer("src/components/v492/Screen.tsx"));
const PAYWALL = sinComentarios(leer(PAYWALL_REL));
const PERFIL = sinComentarios(leer(PERFIL_REL));

const BADGE = cuerpo(SCREEN, "export function PlanBadge(", "export function LayerScreen(");
const CAPA = cuerpo(SCREEN, "export function LayerScreen(", "export function DetailLayerScreen(");
const DETALLE = cuerpo(SCREEN, "export function DetailLayerScreen(", "export function Section(");

const PLUS: ConfirmedPlan = { isPro: true };
const FREE: ConfirmedPlan = { isPro: false };
const DUEÑO = "user_2abcDEF";

// ---------------------------------------------------------------------------
// La decisión pura: qué plan mostrar mientras el remoto no contesta
// ---------------------------------------------------------------------------

test("un remoto confirmado gana al snapshot contrario, en los dos sentidos", () => {
  // Plus remoto sobre un cache Free: la etiqueta sube apenas el backend contesta.
  assert.deepEqual(resolvePlanView({ remote: PLUS, lastConfirmed: FREE, hydrated: true }), {
    view: PLUS,
    resolved: true,
    source: "remote",
    snapshot: "write"
  });

  // Y el filo que de verdad importa: Free remoto sobre un cache Plus. Dejar
  // ganar al snapshot acá es exactamente cómo una suscripción vencida se
  // quedaría "activa" para siempre en esta pantalla.
  const vencida = resolvePlanView({ remote: FREE, lastConfirmed: PLUS, hydrated: true });
  assert.deepEqual(vencida, { view: FREE, resolved: true, source: "remote", snapshot: "write" });
  assert.equal(planLabel(vencida.view), PLAN_FREE_LABEL);

  // Sin hidratar el disco tampoco cambia nada: con respuesta remota el snapshot
  // no participa de la decisión, sólo la recibe.
  assert.deepEqual(resolvePlanView({ remote: PLUS, lastConfirmed: null, hydrated: false }), {
    view: PLUS,
    resolved: true,
    source: "remote",
    snapshot: "write"
  });
});

test("un remoto que no reconoce plan es una RESPUESTA, y borra el snapshot", () => {
  const decision = resolvePlanView({ remote: null, lastConfirmed: PLUS, hydrated: true });
  assert.deepEqual(decision, { view: null, resolved: true, source: "remote", snapshot: "clear" });

  // `null` no es "todavía no sé": el backend contestó. Por eso `resolved` sube
  // —autoriza cobrar— y el Plus viejo se retira del disco en vez de revivir en
  // el próximo arranque en frío.
  assert.notEqual(decision.view, undefined);
  assert.equal(decision.source, "remote");
  assert.equal(planLabel(decision.view), PLAN_FREE_LABEL);
});

test("sin remoto, el snapshot llena el hueco pero no autoriza nada", () => {
  for (const guardado of [PLUS, FREE]) {
    const decision = resolvePlanView({
      remote: undefined,
      lastConfirmed: guardado,
      hydrated: true
    });
    const contexto = `lastConfirmed isPro=${guardado.isPro}`;

    // Presenta: la etiqueta es la del último plan confirmado…
    assert.deepEqual(
      decision,
      { view: guardado, resolved: false, source: "cache", snapshot: "keep" },
      contexto
    );
    assert.equal(
      planLabel(decision.view),
      guardado.isPro ? PLAN_PLUS_LABEL : PLAN_FREE_LABEL,
      contexto
    );
    // …y no concede: `resolved` en falso es lo único que mira el cobro, y
    // `source` deja dicho que esto salió del disco y no del backend.
    assert.equal(decision.resolved, false, contexto);
    assert.equal(decision.source, "cache", contexto);
    // Ni se reescribe el disco con lo que acaba de salir del disco.
    assert.equal(decision.snapshot, "keep", contexto);
  }
});

test("sin remoto y sin snapshot la respuesta es «no sé», antes y después de hidratar", () => {
  const DESCONOCIDO = { view: undefined, resolved: false, source: "unknown", snapshot: "keep" };

  for (const hydrated of [false, true]) {
    const decision = resolvePlanView({ remote: undefined, lastConfirmed: null, hydrated });
    assert.deepEqual(decision, DESCONOCIDO, `hydrated=${hydrated}`);
    // `undefined` es otra cosa que `null`, y sólo `source` distingue este hueco
    // de un plan que el backend sí contestó.
    assert.equal(decision.view, undefined, `hydrated=${hydrated}`);
    assert.equal(decision.source, "unknown", `hydrated=${hydrated}`);
    // Nada de esto afirma Plus: la etiqueta cae en Free —equivocarse hacia Free
    // muestra de menos por un momento— y el cobro sigue cerrado.
    assert.equal(planLabel(decision.view), PLAN_FREE_LABEL, `hydrated=${hydrated}`);
    assert.notEqual(planLabel(decision.view), PLAN_PLUS_LABEL, `hydrated=${hydrated}`);
    assert.equal(decision.resolved, false, `hydrated=${hydrated}`);
  }

  // Un plan en memoria que todavía no se leyó del disco tampoco alcanza: usarlo
  // antes de `hydrated` es afirmar un plan que nadie confirmó en esta sesión.
  assert.deepEqual(
    resolvePlanView({ remote: undefined, lastConfirmed: PLUS, hydrated: false }),
    DESCONOCIDO
  );
});

// ---------------------------------------------------------------------------
// El snapshot en disco: siempre con su dueño adentro
// ---------------------------------------------------------------------------

test("el snapshot vuelve entero para su dueño, y guarda SÓLO el plan", () => {
  for (const plan of [FREE, PLUS]) {
    const raw = serializePlanSnapshot({ owner: DUEÑO, isPro: plan.isPro });
    assert.deepEqual(parsePlanSnapshot(raw, DUEÑO), plan, `isPro=${plan.isPro}`);
    // El dueño viaja EN EL VALOR, no sólo en la clave: un valor movido de lugar
    // no puede terminar mostrándole el plan de A a B.
    assert.deepEqual(Object.keys(JSON.parse(raw)), ["owner", "isPro"], `isPro=${plan.isPro}`);
    // Y nada más que eso: el proveedor, el portal y la vida del cargo son
    // decisiones de plata, y ésas exigen el remoto.
    assert.equal(JSON.parse(raw).isPro, plan.isPro, `isPro=${plan.isPro}`);
  }
});

test("un snapshot de otra cuenta, ilegible o mal formado no afirma ningún plan", () => {
  const deA = serializePlanSnapshot({ owner: DUEÑO, isPro: true });

  // El caso que la clave por cuenta no cubre sola: el dueño adentro lo corta.
  assert.equal(parsePlanSnapshot(deA, "user_otro"), null);

  // Sin dueño vigente no hay nada que correlacionar, y sin snapshot no hay nada
  // que leer. Los dos huecos se contestan igual: "no hay snapshot".
  for (const owner of [null, undefined, ""]) {
    assert.equal(parsePlanSnapshot(deA, owner), null, `owner=${String(owner)}`);
  }
  for (const raw of [null, undefined, ""]) {
    assert.equal(parsePlanSnapshot(raw, DUEÑO), null, `raw=${String(raw)}`);
  }

  // Ilegible: un JSON roto no puede afirmar un plan, y el costo de perderlo es
  // un arranque que dice Free de más.
  for (const raw of ["{", "no-json", "{owner:'x'}", `{"owner":"${DUEÑO}",}`]) {
    assert.equal(parsePlanSnapshot(raw, DUEÑO), null, raw);
  }

  // JSON válido con la forma equivocada: falta el plan, falta el dueño, el tipo
  // no es el que se guardó, o no es siquiera un objeto.
  for (const raw of [
    `{"owner":"${DUEÑO}"}`,
    `{"isPro":true}`,
    `{"owner":"${DUEÑO}","isPro":"true"}`,
    `{"owner":"${DUEÑO}","isPro":1}`,
    `{"owner":"${DUEÑO}","isPro":null}`,
    `{"owner":null,"isPro":true}`,
    `["${DUEÑO}",true]`,
    `"${DUEÑO}"`,
    "42",
    "true",
    "null",
    // `__proto__` no es un dueño: `JSON.parse` lo deja como propiedad propia, así
    // que la lectura sigue sin encontrar ni `owner` ni `isPro`.
    `{"__proto__":{"owner":"${DUEÑO}","isPro":true}}`
  ]) {
    assert.equal(parsePlanSnapshot(raw, DUEÑO), null, raw);
  }
});

// ---------------------------------------------------------------------------
// Cómo se llama el plan
// ---------------------------------------------------------------------------

test("los dos nombres son exactamente ésos, y sólo un Plus confirmado cambia el chip", () => {
  assert.equal(PLAN_PLUS_LABEL, "Órbita Plus");
  assert.equal(PLAN_FREE_LABEL, "Órbita Free");
  assert.equal(planLabel({ isPro: true }), "Órbita Plus");
  assert.equal(planLabel({ isPro: false }), "Órbita Free");

  // "No sé" y "no hay plan" se dicen igual —Free—: equivocarse hacia Plus le
  // promete a alguien un acceso que la app le va a negar en la pantalla
  // siguiente.
  assert.equal(planLabel(null), "Órbita Free");
  assert.equal(planLabel(undefined), "Órbita Free");

  // Mismo largo y forma compuesta: la reserva de ancho de la barra de detalle se
  // calcula con estos nombres, así que cambiar de plan no mueve ni un punto.
  assert.equal(PLAN_FREE_LABEL.length, PLAN_PLUS_LABEL.length);
  for (const label of [PLAN_FREE_LABEL, PLAN_PLUS_LABEL]) {
    assert.equal(label.normalize("NFC"), label, label);
  }
});

// ---------------------------------------------------------------------------
// Una sola fuente del plan
// ---------------------------------------------------------------------------

test("el plan se monta UNA vez, en el layout raíz y dentro de la sesión", () => {
  assert.match(LAYOUT, /import \{[^}]*\bEntitlementProvider\b[^}]*\} from "@\/hooks\/useLiveApp";/);
  assert.equal(
    veces(LAYOUT, /<EntitlementProvider\b/g),
    1,
    "una segunda copia del provider es una segunda query y una segunda ventana de espera"
  );
  assert.equal(veces(LAYOUT, /<\/EntitlementProvider>/g), 1);

  // Y cuelga de la sesión: sin dueño de Clerk no hay plan que correlacionar.
  const sesion = LAYOUT.indexOf("<OrbitaSessionProvider>");
  const plan = LAYOUT.indexOf("<EntitlementProvider>");
  assert.ok(sesion > 0, "falta la sesión central");
  assert.ok(plan > sesion, "el plan va DENTRO de la sesión, no al revés");
  assert.ok(LAYOUT.indexOf("</EntitlementProvider>") < LAYOUT.indexOf("</OrbitaSessionProvider>"));
});

test("hay UNA `subscriptions.getCurrent` operativa y UNA correlación con su dueño", () => {
  // La prosa del archivo la nombra varias veces —cuenta de dónde salía antes—:
  // lo que se cuenta acá es el código, no lo que el comentario dice de él.
  assert.ok(
    veces(leer(PROVIDER_REL), /subscriptions\.getCurrent/g) > 1,
    "si el archivo dejara de documentarlo, esta prueba dejaría de demostrar el corte"
  );
  assert.equal(
    veces(PROVIDER, /subscriptions\.getCurrent/g),
    1,
    "una segunda `getCurrent` reabre la ventana en la que el plan de A vale para B"
  );
  assert.equal(veces(PROVIDER, /useQuery\(\s*appApi\.subscriptions\.getCurrent\b/g), 1);
  assert.match(
    PROVIDER,
    /const raw = useQuery\(appApi\.subscriptions\.getCurrent, isLive \? \{\} : "skip"\);/,
    "con `skip` sin sesión viva: montarla igual la corre con la cuenta anterior"
  );

  // El `skip` no alcanza —Convex conserva el último valor mientras la nueva
  // suscripción resuelve—, así que el resultado se correlaciona con el dueño de
  // Clerk antes de publicarse, y eso pasa exactamente una vez.
  assert.equal(
    veces(PROVIDER, /safeEntitlement\(/g),
    1,
    "la correlación con el dueño se hace UNA vez, sobre la única query"
  );
  assert.match(
    PROVIDER,
    /const remote = safeEntitlement\(\s*raw as NativeSubscriptionSnapshot \| null \| undefined,\s*owner\s*\);/
  );
  assert.match(PROVIDER, /const owner = auth\?\.isSignedIn \? auth\.userId \?\? null : null;/);

  // Y ese `remote` ya correlacionado es el que entra a la decisión pura, junto
  // con el snapshot de ESE mismo dueño y su estado de hidratación.
  assert.match(
    PROVIDER,
    /resolvePlanView\(\{\s*remote,\s*lastConfirmed: cached\.plan,\s*hydrated: cached\.hydrated\s*\}\)/
  );
});

const CONSUMIDORES = [
  {
    rel: PAYWALL_REL,
    source: PAYWALL,
    lectura: /const \{ remote: entitlement, resolved: entitlementResuelto \} = useEntitlement\(\);/
  },
  {
    rel: PERFIL_REL,
    source: PERFIL,
    lectura: /const \{ remote: entitlement, owner: clerkOwner \} = useEntitlement\(\);/
  }
] as const;

test("las dos pantallas de plata leen el REMOTO del provider y no montan query propia", () => {
  for (const { rel, source, lectura } of CONSUMIDORES) {
    assert.match(source, /import \{[^}]*\buseEntitlement\b[^}]*\} from "@\/hooks\/useLiveApp";/, rel);
    assert.match(source, lectura, rel);

    // Ninguna consulta propia: era la misma verdad copiada, cada copia con su
    // ventana de espera y su propia correlación con Clerk.
    assert.equal(veces(source, /useQuery\(/g), 0, `${rel}: monta una query propia`);
    assert.equal(
      /import \{[^}]*\buseQuery\b[^}]*\} from "convex\/react";/.test(source),
      false,
      `${rel}: importa useQuery`
    );
    assert.equal(
      source.includes("subscriptions.getCurrent"),
      false,
      `${rel}: vuelve a pedir el plan por su cuenta`
    );

    // Y nunca la vista EFECTIVA: un snapshot cacheado puede poner una etiqueta,
    // jamás abrir una compra ni un portal de facturación.
    assert.equal(
      /\beffective\b|\blabelReady\b/.test(source),
      false,
      `${rel}: decide plata con la vista cacheada`
    );
  }
});

// ---------------------------------------------------------------------------
// El chip: qué dibuja y dónde
// ---------------------------------------------------------------------------

test("el chip nombra el plan desde el dominio, y no dibuja nada cuando no lo sabe", () => {
  assert.match(BADGE, /const \{ effective, labelReady \} = useEntitlement\(\);/);
  // No especula: mientras el provider no pueda nombrar el plan sin inventarlo,
  // no hay chip. Un "Free" parpadeando encima de alguien que paga es peor que
  // un hueco.
  assert.match(BADGE, /if \(!labelReady\) return null;/);
  // El nombre entero se resuelve SIEMPRE, sea cual sea la forma que se dibuje:
  // es el que anuncia VoiceOver y del que se deriva la marca corta, así que las
  // dos variantes no pueden llegar a nombrar planes distintos.
  assert.match(BADGE, /const label = planLabel\(effective\);/);
  assert.match(BADGE, /accessibilityLabel=\{`Tu plan: \$\{label\}`\}/);
  // Y la forma corta también sale del dominio: `PLUS`/`FREE` escrito a mano acá
  // sería un segundo lugar donde el producto decide cómo se llama un plan.
  assert.match(BADGE, /\{variant === "mark" \? planMark\(effective\) : label\}/);
  assert.equal(
    /["'`](PLUS|FREE)["'`]/.test(BADGE),
    false,
    "la marca corta se deriva del dominio, no de un literal en el chip"
  );

  // Un solo lugar de la pantalla nombra el plan, y ninguno lo escribe a mano.
  assert.equal(veces(SCREEN, /planLabel\(/g), 1);
  assert.equal(veces(SCREEN, /planMark\(/g), 1);
  assert.match(SCREEN, /import \{[^}]*\bplanLabel\b[^}]*\} from "@\/domain\/entitlement";/);
  assert.match(SCREEN, /import \{[^}]*\bplanMark\b[^}]*\} from "@\/domain\/entitlement";/);
  assert.equal(
    /["'`]Órbita (Plus|Free)["'`]/.test(SCREEN),
    false,
    "el nombre del plan sale del dominio, no de un literal suelto"
  );
});

test("las dos pantallas base montan el chip, una sola vez cada una y con su forma", () => {
  assert.equal(veces(CAPA, /<PlanBadge\b/g), 1, "LayerScreen dibuja el plan");
  assert.equal(veces(DETALLE, /<PlanBadge\b/g), 1, "DetailLayerScreen también");
  assert.equal(veces(SCREEN, /<PlanBadge\b/g), 2, "no hay una tercera superficie dibujándolo");
  // Cada superficie declara su variante: la raíz comparte renglón con la marca y
  // la fecha —ahí el nombre entero empujaba a la meta contra el borde— y el
  // detalle lleva el chip solo en su extremo, con la reserva ya hecha.
  assert.match(CAPA, /<PlanBadge variant="mark" \/>/);
  assert.match(DETALLE, /<PlanBadge variant="full" style=\{styles\.detailBadgeText\} \/>/);
  // Sin default: una superficie nueva TIENE que elegir, y las dos que existen no
  // pueden divergir por olvido.
  assert.match(SCREEN, /export type PlanBadgeVariant = "mark" \| "full";/);
  assert.match(BADGE, /variant: PlanBadgeVariant;/);
  assert.equal(
    /variant\s*=\s*"(mark|full)"/.test(BADGE),
    false,
    "un default volvería opcional la decisión que este chip obliga a tomar"
  );
});

test("los dos extremos de la barra de detalle miden lo mismo: por eso el rótulo va centrado", () => {
  // Fijo y no `minWidth`: un mínimo deja que el lado del chip crezca solo y
  // descentre el rótulo apenas el nombre del plan mida distinto.
  assert.match(SCREEN, /detailBack: \{[^{}]*\bwidth: DETAIL_EDGE\b[^{}]*\}/);
  assert.match(SCREEN, /detailBadge: \{[^{}]*\bwidth: DETAIL_EDGE\b[^{}]*\}/);
  assert.equal(veces(SCREEN, /\bwidth: DETAIL_EDGE\b/g), 2, "los dos extremos, y sólo ellos");
  assert.equal(
    /(detailBack|detailBadge): \{[^{}]*\bminWidth\b/.test(SCREEN),
    false,
    "un mínimo no fija la simetría"
  );

  // El rótulo del medio se centra con `flex: 1`, que es lo que vuelve exigible
  // la simetría de los extremos.
  assert.match(SCREEN, /detailEyebrow: \{ flex: 1, textAlign: "center" \}/);

  // La reserva nunca baja del toque mínimo, y no depende de qué plan se muestre:
  // los dos nombres tienen el mismo largo.
  assert.match(SCREEN, /const DETAIL_EDGE = Math\.max\(v492\.touch, PLAN_BADGE_WIDTH\);/);
  assert.match(SCREEN, /Math\.max\(PLAN_FREE_LABEL\.length, PLAN_PLUS_LABEL\.length\)/);
});
