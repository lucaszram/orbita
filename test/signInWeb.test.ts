/**
 * El login WEB usa la UI oficial de Clerk.
 *
 * `/iniciar-sesion` montaba en las dos plataformas el mismo formulario propio
 * (`SignInScreen.tsx`): email → contraseña o código, reenvío, botón de Google y
 * mensajes de error escritos por Órbita. Eso es la máquina de estados de Clerk
 * reimplementada a mano, y cada requisito nuevo de la instancia la dejaba fuera
 * de sincronía. En web ahora monta `SignIn` de `@clerk/expo/web`, la misma
 * decisión que ya había tomado el alta con `SignUp` (`ClerkSignUp.web.tsx`).
 *
 * El nativo NO cambia: ahí la superficie oficial es otra y el formulario propio
 * sigue siendo el camino. Por eso la separación es por plataforma (`.web.tsx`),
 * la misma que usan `BirthPicker` y `ClerkSignUp`.
 *
 * La salida al alta es UNA y está DENTRO de la tarjeta oficial: su pie «¿No
 * tenés cuenta? Registrate», apuntado al onboarding canónico. Hubo un momento
 * en que ese pie se ocultaba y Órbita ponía su propio enlace debajo — dos
 * salidas apiladas, una escondida y una visible. Lo que queda pinchado acá es
 * la forma final: pie a la vista, `signUpUrl` al onboarding, cero enlaces
 * propios, y ningún camino que cree la cuenta desde el login.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT, reachableFrom } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const RUTA = "app/iniciar-sesion.tsx";
const WEB = "src/onboarding/screens/SignInScreen.web.tsx";
const NATIVO = "src/onboarding/screens/SignInScreen.tsx";

// --- Qué entra al paquete web ------------------------------------------------

test("al empaquetar para web, /iniciar-sesion llega a la pantalla oficial y NO al formulario manual", () => {
  // Es la pregunta del bundler, no una búsqueda de texto: se recorren los
  // imports reales con las mismas reglas de resolución (alias `@/` y la
  // variante `.web.tsx` que Metro prefiere al empaquetar para web).
  const alcanzables = reachableFrom([RUTA]);
  assert.ok(alcanzables.has(WEB), "la ruta web tiene que resolver a la pantalla con la UI oficial");
  assert.ok(
    !alcanzables.has(NATIVO),
    "el formulario manual no puede entrar al paquete web: sería el segundo login"
  );
});

test("la pantalla web monta el componente oficial de Clerk, sin tema ni rutas propias", () => {
  const web = sinComentarios(leer(WEB));
  assert.match(web, /from "@clerk\/expo\/web"/, "la UI oficial de web viene del entrypoint de web");
  // El login es UNA ruta sin sub-rutas: declarar `path` obligaría a un
  // catch-all en el router.
  assert.doesNotMatch(web, /\brouting=|\bpath=/, "el login no tiene rutas propias");
  // Los ÚNICOS props son los dos que deciden qué puede pasar con una cuenta que
  // todavía no existe; cada uno tiene su test abajo. Nada de layout ni de tema:
  // el componente se monta pelado porque Clerk es el dueño del login.
  const props = web.match(/<SignIn([^>]*)\/>/);
  assert.ok(props, "el componente oficial se monta en la pantalla");
  assert.match(
    props[1],
    /^ signUpUrl=\{ONBOARDING_ROUTE\} transferable=\{false\} $/,
    "salvo esos dos props, el componente se monta pelado: Clerk es el dueño del login"
  );
});

// --- La salida al alta es UNA, y es el pie de la tarjeta oficial --------------

test("el pie «Registrate» de Clerk queda A LA VISTA: es la única salida al alta", () => {
  // Estuvo oculto con una `appearance` (`footerAction__signIn: display none`)
  // mientras Órbita ponía su propio enlace debajo. Eran dos salidas apiladas y
  // la persona buscaba la que la tarjeta ya traía. Ahora se restituye el pie y
  // se le cambia el DESTINO (`signUpUrl`), que es lo que había que arreglar.
  const web = sinComentarios(leer(WEB));
  assert.doesNotMatch(web, /appearance=/, "sin `appearance`: el pie no se vuelve a ocultar");
  assert.doesNotMatch(web, /SIN_ALTA_DE_CLERK/, "la constante que lo ocultaba no puede volver");
  // Ni por el nombre del elemento ni por la regla, con `appearance` o sin ella.
  assert.doesNotMatch(web, /footerAction/, "no se toca el pie de ninguna tarjeta de Clerk");
  assert.doesNotMatch(web, /display:\s*"none"/, "nada de la UI oficial se saca del árbol");
});

test("el registro del pie va al onboarding canónico (`/empezar`), no a accounts.dev ni al alta suelta", () => {
  // Sin `signUpUrl` el pie apunta a la instancia alojada
  // (`…accounts.dev/sign-up`): crea la cuenta AFUERA de la secuencia. Y el
  // formulario suelto (`/crear-cuenta`) tampoco es la entrada del alta.
  const web = sinComentarios(leer(WEB));
  assert.match(web, /signUpUrl=\{ONBOARDING_ROUTE\}/, "el pie tiene que ir al onboarding canónico");
  assert.match(
    web,
    /import \{ ONBOARDING_ROUTE \} from "@\/domain\/appRoutes"/,
    "el destino sale de la constante canónica, no de un string suelto que se desincroniza"
  );
  // Y esa constante es `/empezar` en web, que es donde tiene que caer.
  assert.match(
    sinComentarios(leer("src/domain/appRoutes.ts")),
    /export const ONBOARDING_ROUTE = IS_WEB \? "\/empezar" : "\/onboarding";/,
    "`ONBOARDING_ROUTE` en web es `/empezar`"
  );
  for (const destino of ["accounts.dev", "SIGN_UP_ROUTE", "/crear-cuenta"]) {
    assert.ok(!web.includes(destino), `el registro no puede apuntar a «${destino}»`);
  }
  // Nada de redirecciones propias: adónde va DESPUÉS de entrar lo resuelve
  // `AccountGate`, que es quien conoce el estado real de la cuenta.
  assert.doesNotMatch(
    web,
    /signInUrl|forceRedirectUrl|fallbackRedirectUrl/,
    "el destino post-login es del gate, no de esta pantalla"
  );
  // El destino se declara en el componente que lo usa. Desde el provider
  // aplicaría a TODAS las superficies de Clerk —incluido el `SignUp` del paso
  // de cuenta— sin aparecer en este archivo.
  assert.doesNotMatch(
    leer("src/services/backendProviders.tsx"),
    /signUpUrl|signInUrl/,
    "un `signUpUrl` global repunta en silencio todos los componentes de Clerk"
  );
});

test("desde el login NO se crea una cuenta: ni con `withSignUp` ni por Google", () => {
  const web = sinComentarios(leer(WEB));
  // `withSignUp` (sign-in-or-up) dejaría registrarse en esta misma tarjeta:
  // salta los quince pasos y el borrador durable. La cuenta se crea con Clerk
  // en el paso 14 (índice 13), con fecha, lugar y hora ya confirmados.
  assert.doesNotMatch(web, /withSignUp/, "el login no habilita el alta en la propia tarjeta");
  // La misma puerta, por el lado social: `transferable` es `true` por defecto,
  // así que "Continuar con Google" con un email inexistente creaba la cuenta en
  // silencio (opaque sign-up) sin que la persona pidiera registrarse. La
  // semántica está en el contrato instalado: `TransferableOption` en
  // `@clerk/shared` 4.23.0, vía `@clerk/expo` 3.6.5 → `@clerk/react` 6.11.3.
  assert.match(web, /transferable=\{false\}/, "Google no puede crear una cuenta desde el login");
});

test("no queda ningún enlace propio al alta: la salida es sólo la de la tarjeta", () => {
  const web = sinComentarios(leer(WEB));
  // El `Pressable` de Órbita («Todavía no tengo cuenta · Crear una cuenta») se
  // fue: duplicaba el pie oficial. `onCreateAccount` sigue en el contrato de
  // props porque el nativo la monta, pero acá no se invoca.
  assert.doesNotMatch(web, /onCreateAccount\(/, "la pantalla web ya no llama a la salida propia");
  for (const resto of [
    "Crear una cuenta",
    "Todavía no tengo cuenta",
    "SIGN_IN_LINK_ROW", // el par de estilos del enlace compartido
    "SIGN_IN_LINK_TEXT",
  ]) {
    assert.ok(!web.includes(resto), `el enlace exterior volvió por «${resto}»`);
  }
  // Y ningún otro control con rol de enlace: el de volver es `role="button"`.
  const enlaces = [...web.matchAll(/accessibilityRole="link"/g)];
  assert.equal(enlaces.length, 0, `hay ${enlaces.length} enlaces propios, no tiene que haber ninguno`);
});

test("la pantalla web no recrea ni un campo, ni un paso, ni un botón, ni un error del login", () => {
  const web = sinComentarios(leer(WEB));
  const PROHIBIDO = [
    "TextInput", // email y contraseña
    "CodeInput", // código de verificación
    "CodeHelp", // reenvío
    "GoogleButton", // los proveedores sociales los ofrece la instancia
    "EmailDivider",
    "GOOGLE_AUTH_ENABLED",
    "secureTextEntry",
    "flow.start", // la máquina de estados entera es de Clerk
    "flow.verify",
    "verifyPassword",
    "sendEmailCode",
    "resetToEmail",
    "flow.error", // y sus mensajes también
    "accessibilityRole=\"alert\"",
    "Verificar código",
    "Usar otro email",
  ];
  for (const nombre of PROHIBIDO) {
    assert.ok(!web.includes(nombre), `el formulario propio volvió por «${nombre}»`);
  }
});

// --- Lo que sigue siendo de Órbita ------------------------------------------

test("el escenario de Órbita y la salida de volver se conservan", () => {
  const web = sinComentarios(leer(WEB));
  // Mismo fondo full-bleed y mismo wash que el resto del alta: la UI oficial se
  // apoya sobre el escenario de Órbita, no lo reemplaza.
  assert.match(
    web,
    /<Screen bg=\{A\.splashBg\} bgOpacity=\{0\.9\} wash=\{0\.55\} scroll>/,
    "el fondo inmersivo y el scroll del shell tienen que quedar"
  );
  // Volver sigue siendo de Órbita: pasa por `leaveWithoutSignIn`, que archiva
  // los datos del dueño anterior antes de soltar el equipo (ruta).
  assert.match(web, /onPress=\{onBack\}/, "el control de volver sigue existiendo");
  assert.match(web, /minHeight: 44/, "sin `hitSlop` en web, el objetivo táctil va declarado");
});

test("la ruta no cambia: sigue detrás del gate y sin montar Clerk por su cuenta", () => {
  const ruta = leer(RUTA);
  assert.match(ruta, /<AccountGate surface="auth">/, "la UI de ingreso sigue detrás del gate");
  const codigo = sinComentarios(ruta);
  assert.doesNotMatch(
    codigo,
    /@clerk\/expo\/web/,
    "quien elige la UI por plataforma es Metro, no un `Platform.OS` en la ruta"
  );
  assert.doesNotMatch(codigo, /Platform\.OS/, "la ruta es la misma en las dos plataformas");
  assert.match(codigo, /useSignInHydrate/, "la hidratación de la cuenta sigue igual");
});

// --- La separación por plataforma es sana ------------------------------------

test("las dos plataformas exportan la MISMA pantalla con la misma firma", () => {
  // Metro elige el archivo; la ruta monta `<SignInScreen ... />` sin saber en
  // cuál corre. Si las props se desfasan, en web se cae recién en tiempo de
  // ejecución (TypeScript typa la ruta contra la variante nativa).
  const web = sinComentarios(leer(WEB));
  const nativo = sinComentarios(leer(NATIVO));
  for (const [rel, codigo] of [[WEB, web], [NATIVO, nativo]] as const) {
    assert.match(codigo, /export function SignInScreen\(/, `${rel}: mismo componente exportado`);
    for (const prop of ["flow: SignInFlow", "onSignedIn", "onCreateAccount", "onBack"]) {
      assert.ok(codigo.includes(prop), `${rel}: falta la prop ${prop} del contrato compartido`);
    }
  }
});

test("el login NATIVO queda intacto: sigue con su formulario propio", () => {
  const nativo = sinComentarios(leer(NATIVO));
  assert.doesNotMatch(nativo, /@clerk\/expo\/web/, "el entrypoint de web no puede entrar al nativo");
  assert.doesNotMatch(nativo, /<SignIn\b/, "el nativo no monta el componente de web");
  for (const pieza of ["<CodeInput", "<GoogleButton", "flow.verify", "flow.error"]) {
    assert.ok(nativo.includes(pieza), `el login nativo perdió ${pieza}`);
  }
});
