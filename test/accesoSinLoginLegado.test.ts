/**
 * El acceso de Órbita es UNO. `/iniciar-sesion` es un alias, no una pantalla.
 *
 * Había dos puertas para la misma cuenta:
 *
 * 1. La canónica: `AuthScreen`, primera superficie del onboarding (`STEP_AUTH`),
 *    donde "Crear cuenta" e "Ingresar" son dos modos de la MISMA pantalla, con
 *    email + código, Apple y Google.
 * 2. La legada: `/iniciar-sesion`, que montaba `SignInScreen` dentro de su
 *    propio shell —su `WebLayoutProvider`, su archivado, su hidratación, su
 *    salida a "Crear una cuenta"— con su propia máquina de estados.
 *
 * Dos puertas para la misma cuenta divergen siempre, y ya habían divergido: la
 * legada no tenía el selector de modo ni la vía de Apple. Esta tanda deja UNA:
 * la ruta conserva el gate —un usuario con sesión NUNCA puede montar una
 * pantalla de acceso— y reenvía a la puerta única con `mode=signin`, que es
 * exactamente lo que pidió quien tocó "Ya tengo cuenta".
 *
 * Lo que este archivo fija es el conjunto entero, porque el defecto vuelve por
 * cualquiera de las puntas: la ruta que vuelve a montar UI, el param que se
 * renombra, el default de la pantalla que se da vuelta, o el destino que deja
 * de existir.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { destinationAllows, resolveAccountDestination } from "../src/domain/accountDestination";
import { isPublicWebRoute } from "../src/domain/webSession";
import { ROOT, reachableFrom } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (x: string) =>
  x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const RUTA = "app/iniciar-sesion.tsx";
const ALIAS = sinComentarios(leer(RUTA));
const FLUJO = sinComentarios(leer("src/onboarding/OnboardingFlow.tsx"));
const ACCESO = sinComentarios(leer("src/onboarding/screens/AuthScreen.tsx"));

// ---------------------------------------------------------------------------
// 1 · La ruta no tiene UI propia
// ---------------------------------------------------------------------------

test("`/iniciar-sesion` no monta ninguna pantalla de acceso", () => {
  // Ni la pantalla legada ni una nueva escrita a mano: el archivo entero es el
  // gate más la redirección.
  for (const prohibido of [
    "<SignInScreen",
    "<TextInput",
    "<CodeInput",
    "<GoogleButton",
    "<Screen",
    "<CTA",
    "WebLayoutProvider"
  ]) {
    assert.ok(!ALIAS.includes(prohibido), `la ruta volvió a montar UI de ingreso: «${prohibido}»`);
  }
  // Y tampoco el cableado del ingreso: los flujos de Clerk, la hidratación y el
  // estado de la app vivían acá y eran la mitad del problema.
  for (const hook of ["useSignInFlow", "useSignInHydrate", "useAppState", "useOrbitaFonts", "useState"]) {
    assert.ok(!ALIAS.includes(hook), `la ruta no puede tener estado propio: «${hook}»`);
  }
});

test("la ruta sigue detrás del gate compartido, con la superficie de acceso", () => {
  // Es lo único que impide que alguien con sesión activa vea una pantalla de
  // ingreso: `auth` sólo se permite cuando todavía NO hay sesión.
  assert.match(ALIAS, /<AccountGate surface="auth">/, "la ruta pasa por el gate compartido");
  assert.equal(destinationAllows("sign-in", "auth"), true, "sin sesión, la ruta abre");
  for (const destino of ["app-home", "onboarding", "edit-birth-data", "bootstrap"] as const) {
    assert.equal(
      destinationAllows(destino, "auth"),
      false,
      `con destino «${destino}» la ruta tiene que navegar, no renderizar`
    );
  }
});

// ---------------------------------------------------------------------------
// 2 · El reenvío: replace, al destino canónico, en modo ingreso
// ---------------------------------------------------------------------------

test("el alias REEMPLAZA hacia el acceso único, con `mode=signin`", () => {
  assert.match(ALIAS, /<Redirect href=\{\{ pathname: ONBOARDING_ROUTE, params: \{ mode: "signin" \} \}/);
  assert.match(
    ALIAS,
    /import \{ ONBOARDING_ROUTE \} from "@\/domain\/appRoutes"/,
    "el destino sale de la constante canónica, no de un string suelto"
  );
  // `<Redirect>` es un replace: no deja el alias debajo en el historial, así que
  // "volver" desde el acceso no puede rebotar de nuevo acá.
  assert.doesNotMatch(ALIAS, /router\.push\(/, "un alias no apila");
  assert.doesNotMatch(ALIAS, /<Link\b/, "un alias no ofrece navegación");
  // Y no inventa un destino propio: `/crear-cuenta` es un formulario suelto que
  // se saltea la secuencia, y una ruta nueva sería una tercera puerta.
  for (const destino of ["SIGN_UP_ROUTE", "/crear-cuenta", "HOME_ROUTE", "RECEPTION_ROUTE"]) {
    assert.ok(!ALIAS.includes(destino), `el alias no puede apuntar a «${destino}»`);
  }
});

test("el destino existe en las dos plataformas y monta el gate del alta", () => {
  // `ONBOARDING_ROUTE` es `/empezar` en web y `/onboarding` en nativo: las dos
  // entradas reales del alta. Si el reenvío apuntara a una ruta inexistente, el
  // enlace publicado quedaría en una pantalla en blanco.
  const rutas = sinComentarios(leer("src/domain/appRoutes.ts"));
  assert.match(rutas, /export const ONBOARDING_ROUTE = IS_WEB \? "\/empezar" : "\/onboarding";/);
  for (const archivo of ["app/empezar.tsx", "app/onboarding.tsx"]) {
    assert.ok(existsSync(join(ROOT, archivo)), `${archivo} tiene que existir`);
  }
  for (const impl of ["src/routes/v492/empezar.web.tsx", "app/onboarding.tsx"]) {
    assert.match(sinComentarios(leer(impl)), /OnboardingGate/, `${impl} monta el gate del alta`);
  }
  // Y ese gate permite montarse justamente cuando todavía no hay sesión, que es
  // el único estado en el que el alias llega a redirigir. Sin esto habría un
  // rebote infinito entre las dos rutas.
  assert.equal(destinationAllows("sign-in", "onboarding"), true);
});

// ---------------------------------------------------------------------------
// 3 · El param llega hasta el modo inicial de la puerta única
// ---------------------------------------------------------------------------

test("el flujo lee `mode` y sólo `signin` cambia el modo inicial", () => {
  assert.match(FLUJO, /\n {4}mode\?: string;\n/, "el flujo declara el param");
  assert.match(
    FLUJO,
    /initialMode=\{params\.mode === "signin" \? "signin" : undefined\}/,
    "cualquier otro valor deja el default del alta"
  );
  // El param NO puede tocar nada más: ni el paso de entrada, ni el borrador, ni
  // el marcador de alta en curso.
  const usos = FLUJO.match(/params\.mode/g) ?? [];
  assert.equal(usos.length, 1, `«params.mode» se usa ${usos.length} veces: tiene que decidir sólo el modo`);
});

test("`AuthScreen` acepta el modo inicial sin cambiar ninguna otra conducta", () => {
  assert.match(ACCESO, /initialMode\?: AuthMode;/, "es un prop opcional del contrato");
  assert.match(
    ACCESO,
    /const \[mode, setMode\] = useState<AuthMode>\(initialMode \?\? "signup"\);/,
    "decide el estado INICIAL, y el default sigue siendo el alta"
  );
  // Sólo el `useState` lo consume: si apareciera en la lógica de la pantalla,
  // "abrir en Ingresar" empezaría a significar algo más que eso.
  const usos = ACCESO.match(/initialMode/g) ?? [];
  assert.equal(usos.length, 3, "declaración de prop, destructuring y estado inicial: nada más");
  // Y el selector sigue mandando después: abrir en un modo no lo congela.
  assert.match(ACCESO, /onPress=\{\(\) => cambiarModo\("signup"\)\}/);
  assert.match(ACCESO, /onPress=\{\(\) => cambiarModo\("signin"\)\}/);
});

// ---------------------------------------------------------------------------
// 4 · La ruta sigue siendo un deep link publicado
// ---------------------------------------------------------------------------

test("`/iniciar-sesion` sigue declarada, pública y como destino del resolver", () => {
  // Es un enlace publicado: `/login`, el pie de las tarjetas de Clerk y los
  // enlaces viejos caen acá. Borrar la ruta los rompería.
  assert.ok(existsSync(join(ROOT, RUTA)), "la ruta no se borra: es un deep link");
  assert.match(
    sinComentarios(leer("app/_layout.tsx")),
    /<Stack\.Screen name="iniciar-sesion"/,
    "el Stack raíz la sigue declarando"
  );
  assert.equal(isPublicWebRoute("/iniciar-sesion"), true, "sigue siendo pública en web");
  assert.match(sinComentarios(leer("app/login.tsx")), /\/iniciar-sesion/, "`/login` sigue apuntando acá");
  // El gate sigue mandando acá cuando no hay sesión; es la constante canónica.
  assert.match(sinComentarios(leer("src/domain/appRoutes.ts")), /export const SIGN_IN_ROUTE = "\/iniciar-sesion";/);
  assert.match(
    sinComentarios(leer("src/components/orbita/AccountGate.tsx")),
    /case "sign-in":\s*return <Redirect href=\{SIGN_IN_ROUTE as never\} \/>;/
  );
  // Un salto de más, no un rebote: `sign-in` → alias → alta, y el alta se monta.
  assert.equal(resolveAccountDestination({ backendConfigured: true, clerkLoaded: true, signedIn: false, completionResolved: false }), "sign-in");
});

// ---------------------------------------------------------------------------
// 5 · `SignInScreen` no se borra ni queda suelta: tiene UN dueño
// ---------------------------------------------------------------------------

test("la pantalla legada sobrevive SÓLO donde todavía hace falta", () => {
  // El boundary de eliminación pendiente desmonta el `Stack`: no hay a dónde
  // navegar, así que el ingreso se monta ahí adentro. Es la única excepción, y
  // no ofrece ni alta ni proveedor.
  const boundary = sinComentarios(leer("src/components/PendingDeletionBoundary.tsx"));
  assert.match(boundary, /import \{ SignInScreen \} from "@\/onboarding\/screens\/SignInScreen"/);
  assert.match(boundary, /allowSignup=\{false\}/);
  assert.match(boundary, /allowOAuth=\{false\}/);
});

test("ninguna ruta de `app/` monta `SignInScreen`: la puerta es una sola", () => {
  for (const plataforma of ["web", "native"] as const) {
    const alcanzables = reachableFrom([RUTA], plataforma);
    for (const pantalla of [
      "src/onboarding/screens/SignInScreen.tsx",
      "src/onboarding/screens/SignInScreen.web.tsx"
    ]) {
      assert.ok(
        !alcanzables.has(pantalla),
        `${plataforma}: el alias no puede arrastrar ${pantalla} al paquete`
      );
    }
  }
});
