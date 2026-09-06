/**
 * QA23-001 — el encabezado no dice `FREE` antes de saberlo, y dice el plan con
 * la forma que corresponde a cada superficie.
 *
 * ## El defecto medido en el build 23
 *
 * En el arranque del iPhone, el chip del encabezado mostraba `FREE` durante el
 * intervalo en el que la única `subscriptions.getCurrent` seguía en vuelo. No
 * era el chip: `labelReady` tenía DOS caminos, y el segundo —«la sesión de Clerk
 * terminó de resolver y el disco ya se leyó»— es verdadero en cualquier
 * instalación nueva y en cualquier arranque sin snapshot, mucho antes de que el
 * backend conteste. Con eso, "todavía no sé" se publicaba como "Free".
 *
 * El corte es de una línea y de una idea: **el plan se puede nombrar cuando ya
 * se sabe cuál es, y sólo entonces** (`effective !== undefined`). `undefined` es
 * "no sé"; `null` sí es una respuesta —el backend contestó que no hay plan— y
 * ésa se dice Free.
 *
 * ## Lo otro que pedía el hallazgo
 *
 * La raíz de una pestaña escribe la marca corta (`PLUS` / `FREE`) y la barra de
 * un detalle el nombre entero (`Órbita Plus` / `Órbita Free`), pero las dos
 * ANUNCIAN el nombre completo: la forma corta no puede pedirle a nadie que ya
 * sepa qué es "PLUS" acá adentro.
 *
 * Las cuatro garantías estructurales de `planIndicatorQA22.test.ts` —una sola
 * fuente, presentar no es conceder, el snapshot con su dueño adentro y los
 * extremos simétricos— siguen ahí y no se repiten acá.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  PLAN_FREE_LABEL,
  PLAN_PLUS_LABEL,
  planLabel,
  planMark,
  resolvePlanView,
  type ConfirmedPlan
} from "../src/domain/entitlement";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Una regla se comprueba sobre el código: los comentarios no ejecutan nada. */
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PROVIDER = sinComentarios(leer("src/hooks/useLiveApp.tsx"));
const SCREEN = sinComentarios(leer("src/components/v492/Screen.tsx"));

const PLUS: ConfirmedPlan = { isPro: true };
const FREE: ConfirmedPlan = { isPro: false };

/**
 * La regla NUEVA, escrita como la escribe el provider: la vista efectiva afirma
 * un plan.
 */
const nombrable = (view: unknown) => view !== undefined;

/**
 * La regla VIEJA, la que publicaba `Free` de más.
 *
 * Está acá para poder señalar la celda exacta en la que las dos difieren: sin
 * ella, "el arreglo funciona" sería una afirmación sobre una sola condición y no
 * sobre el cambio.
 */
const nombrableAntes = (view: unknown, hydrated: boolean, authLoading: boolean) =>
  view !== undefined || (hydrated && !authLoading);

// ---------------------------------------------------------------------------
// La celda del defecto
// ---------------------------------------------------------------------------

test("arranque sin snapshot y con la sesión resuelta: antes decía Free, ahora no dice nada", () => {
  // El estado exacto del arranque en frío de una instalación nueva: Clerk ya
  // resolvió, el disco ya se leyó y no había nada guardado, y la única
  // `getCurrent` sigue en vuelo.
  const decision = resolvePlanView({ remote: undefined, lastConfirmed: null, hydrated: true });
  assert.equal(decision.view, undefined, "el backend todavía no contestó");
  assert.equal(decision.source, "unknown");
  assert.equal(decision.resolved, false);

  // La regla vieja daba el visto bueno, y lo que se dibujaba con ese visto bueno
  // era `FREE`: `planLabel(undefined)` cae en Free por diseño.
  assert.equal(nombrableAntes(decision.view, true, false), true);
  assert.equal(planLabel(decision.view), PLAN_FREE_LABEL);
  assert.equal(planMark(decision.view), "FREE");

  // La regla nueva no: sin plan afirmado no hay nombre que dar, y el chip no
  // dibuja nada. Un hueco de un instante es más honesto que un plan inventado.
  assert.equal(nombrable(decision.view), false);
});

test("ni el disco leído ni la sesión resuelta alcanzan por sí solos", () => {
  // Las cuatro combinaciones de "el disco ya se leyó" × "Clerk ya resolvió", con
  // el remoto siempre en vuelo y sin nada guardado: NINGUNA nombra un plan.
  for (const hydrated of [false, true]) {
    for (const authLoading of [false, true]) {
      const { view } = resolvePlanView({ remote: undefined, lastConfirmed: null, hydrated });
      const contexto = `hydrated=${hydrated} authLoading=${authLoading}`;
      assert.equal(nombrable(view), false, contexto);
      // Y la regla vieja se equivocaba en la única celda que importa: la que
      // pasa siempre, un instante después de abrir la app.
      assert.equal(nombrableAntes(view, hydrated, authLoading), hydrated && !authLoading, contexto);
    }
  }
});

// ---------------------------------------------------------------------------
// Cuándo SÍ se puede nombrar: la matriz entera
// ---------------------------------------------------------------------------

test("se nombra el plan exactamente cuando hay respuesta remota o snapshot hidratado", () => {
  const CASOS = [
    // Remoto confirmado: se nombra, venga lo que viniere del disco.
    { remote: PLUS, lastConfirmed: null, hydrated: false, nombra: true, label: PLAN_PLUS_LABEL },
    { remote: PLUS, lastConfirmed: FREE, hydrated: true, nombra: true, label: PLAN_PLUS_LABEL },
    { remote: FREE, lastConfirmed: PLUS, hydrated: true, nombra: true, label: PLAN_FREE_LABEL },
    // `null` es una RESPUESTA: el backend dijo que no hay plan, y eso se dice Free.
    { remote: null, lastConfirmed: PLUS, hydrated: true, nombra: true, label: PLAN_FREE_LABEL },
    // Sin remoto, el último confirmado en disco llena el hueco…
    { remote: undefined, lastConfirmed: PLUS, hydrated: true, nombra: true, label: PLAN_PLUS_LABEL },
    { remote: undefined, lastConfirmed: FREE, hydrated: true, nombra: true, label: PLAN_FREE_LABEL },
    // …pero sólo si YA se leyó: un plan en memoria sin hidratar no afirma nada.
    { remote: undefined, lastConfirmed: PLUS, hydrated: false, nombra: false, label: null },
    { remote: undefined, lastConfirmed: null, hydrated: true, nombra: false, label: null },
    { remote: undefined, lastConfirmed: null, hydrated: false, nombra: false, label: null }
  ] as const;

  for (const caso of CASOS) {
    const contexto = `remote=${String(caso.remote?.isPro ?? caso.remote)} cache=${String(
      caso.lastConfirmed?.isPro ?? caso.lastConfirmed
    )} hydrated=${caso.hydrated}`;
    const { view } = resolvePlanView({
      remote: caso.remote,
      lastConfirmed: caso.lastConfirmed,
      hydrated: caso.hydrated
    });
    assert.equal(nombrable(view), caso.nombra, contexto);
    if (caso.label !== null) {
      assert.equal(planLabel(view), caso.label, contexto);
      // Y las dos formas del chip nombran el MISMO plan: la marca corta se
      // deriva del nombre entero, así que no pueden divergir.
      assert.equal(planMark(view), caso.label === PLAN_PLUS_LABEL ? "PLUS" : "FREE", contexto);
    }
  }
});

test("nunca se afirma Plus sin un Plus confirmado, en ningún estado de espera", () => {
  for (const remote of [undefined, null, FREE] as const) {
    for (const lastConfirmed of [null, FREE] as const) {
      for (const hydrated of [false, true]) {
        const { view } = resolvePlanView({ remote, lastConfirmed, hydrated });
        assert.notEqual(planLabel(view), PLAN_PLUS_LABEL);
        assert.notEqual(planMark(view), "PLUS");
      }
    }
  }
});

// ---------------------------------------------------------------------------
// El provider: una sola condición, y nada más que ésa
// ---------------------------------------------------------------------------

/** El cuerpo del provider del plan, que es donde vive la decisión. */
const PROVIDER_PLAN = PROVIDER.slice(
  PROVIDER.indexOf("function EntitlementProviderInner("),
  PROVIDER.indexOf("export function useEntitlement(")
);

test("`labelReady` es exactamente «la vista efectiva afirma un plan»", () => {
  assert.ok(PROVIDER_PLAN.length > 0, "no se encontró el provider del plan");
  assert.match(PROVIDER_PLAN, /const labelReady = view !== undefined;/);
  // El segundo camino era el defecto: cualquiera de estas dos señales de vuelta
  // en la condición vuelve a publicar un plan que nadie confirmó.
  assert.equal(
    /labelReady = [^;]*\bhydrated\b/.test(PROVIDER_PLAN),
    false,
    "el disco leído no nombra un plan: dice que no había ninguno guardado"
  );
  assert.equal(
    /labelReady = [^;]*\bisAuthLoading\b/.test(PROVIDER_PLAN),
    false,
    "la sesión resuelta tampoco: Clerk no sabe nada del plan"
  );
  // Y el provider del plan ya no lee el estado de carga de la sesión para nada:
  // una dependencia que no se usa vuelve a ser una tentación de condición. El
  // tipo `LiveApp` la sigue publicando para quien sí decide con ella.
  assert.equal(
    PROVIDER_PLAN.includes("isAuthLoading"),
    false,
    "el plan no se decide con el reloj de Clerk"
  );
  assert.match(PROVIDER_PLAN, /const \{ isLive, auth \} = useLiveApp\(\);/);

  // `hydrated` sigue publicándose —quien lo necesite lo tiene—, pero como dato
  // del estado y no como parte de la decisión de nombrar.
  assert.match(PROVIDER_PLAN, /const hydrated = cached\.hydrated;/);
  assert.match(PROVIDER_PLAN, /hydrated,\s*source: decision\.source,\s*labelReady/);
});

test("sin backend el plan SÍ se puede nombrar, y sigue sin autorizar un cobro", () => {
  // Un build sin Convex/Clerk no tiene a quién preguntarle: eso es una respuesta
  // —`effective: null`—, no una espera. Por eso el chip dibuja Free y no un
  // hueco permanente.
  const offline = /const OFFLINE_ENTITLEMENT: EntitlementState = \{([\s\S]*?)\n\};/.exec(PROVIDER)?.[1];
  assert.ok(offline, "no se encontró el estado offline");
  assert.match(offline, /effective: null/);
  assert.match(offline, /labelReady: true/);
  // Pero nada de eso concede: `resolved` es lo único que mira una compra.
  assert.match(offline, /resolved: false/);
  assert.equal(planLabel(null), PLAN_FREE_LABEL);
});

// ---------------------------------------------------------------------------
// Las dos formas del chip
// ---------------------------------------------------------------------------

test("la raíz escribe la marca corta y el detalle el nombre entero", () => {
  const capa = SCREEN.slice(
    SCREEN.indexOf("export function LayerScreen("),
    SCREEN.indexOf("export function DetailLayerScreen(")
  );
  const detalle = SCREEN.slice(
    SCREEN.indexOf("export function DetailLayerScreen("),
    SCREEN.indexOf("export function Section(")
  );

  assert.match(capa, /<PlanBadge variant="mark" \/>/, "la raíz de la pestaña, pegada a la marca");
  assert.match(
    detalle,
    /<PlanBadge variant="full" style=\{styles\.detailBadgeText\} \/>/,
    "la barra del detalle, con la reserva de ancho ya hecha"
  );

  // Las dos formas del dominio, y su relación: la marca se deriva del nombre.
  assert.equal(planMark(PLUS), "PLUS");
  assert.equal(planMark(FREE), "FREE");
  assert.equal(planLabel(PLUS), "Órbita Plus");
  assert.equal(planLabel(FREE), "Órbita Free");
  for (const view of [PLUS, FREE, null, undefined] as const) {
    assert.equal(planMark(view), planLabel(view) === PLAN_PLUS_LABEL ? "PLUS" : "FREE");
  }
});

test("las dos variantes anuncian el nombre COMPLETO, y ninguna dibuja sin saber", () => {
  const badge = SCREEN.slice(
    SCREEN.indexOf("export function PlanBadge("),
    SCREEN.indexOf("export function LayerScreen(")
  );

  // Un solo `accessibilityLabel`, con el nombre entero, para las dos formas: la
  // marca corta no puede quedar sin traducir para quien escucha la pantalla.
  assert.equal((badge.match(/accessibilityLabel=/g) ?? []).length, 1);
  assert.match(badge, /accessibilityLabel=\{`Tu plan: \$\{label\}`\}/);
  assert.match(badge, /const label = planLabel\(effective\);/);

  // Y el corte de QA23-001 vive en el chip, antes de cualquier texto: sin plan
  // que nombrar no hay nodo, así que no hay nada que parpadee.
  const guarda = badge.indexOf("if (!labelReady) return null;");
  const nodoTexto = badge.search(/<Text(?:\s|>)/);
  assert.ok(guarda > 0, "el chip tiene que poder no dibujarse");
  assert.ok(guarda < badge.indexOf("planLabel("), "la guarda va antes de nombrar el plan");
  assert.ok(nodoTexto > 0 && guarda < nodoTexto, "y antes de montar cualquier texto");
});
