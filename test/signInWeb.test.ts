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
  // El tema es el que Clerk resuelve para la instancia: pisarlo acoplaba la
  // pantalla a variables internas del componente, que ya cambiaron una vez. La
  // única `appearance` permitida es la que oculta la salida al alta, y no
  // tematiza: se verifica pieza por pieza en el bloque de más abajo.
  const props = web.match(/<SignIn([^>]*)\/>/);
  assert.ok(props, "el componente oficial se monta en la pantalla");
  assert.match(
    props[1],
    /^ appearance=\{SIN_ALTA_DE_CLERK\} $/,
    "salvo esa `appearance`, el componente se monta pelado: Clerk es el dueño del login"
  );
});

// --- La salida al alta es UNA sola, y es la de Órbita ------------------------

/**
 * La declaración de la `appearance`, aislada del resto del archivo: los estilos
 * propios de Órbita (el `StyleSheet` del shell) también hablan de `fontFamily`
 * o de alturas, y no son un tema para Clerk.
 */
const appearanceDe = (web: string) => {
  const decl = web.match(/const SIN_ALTA_DE_CLERK\s*=([\s\S]*?);/)?.[1];
  assert.ok(decl, "la excepción vive en una constante de módulo, con su nombre a la vista");
  return decl;
};

test("el pie «Registrate» de Clerk queda oculto: es una segunda salida y evade el callback", () => {
  // El link del pie oficial va a la instancia alojada (`…accounts.dev/sign-up`)
  // sin pasar por `onCreateAccount` → `leaveWithoutSignIn`, que archiva y limpia
  // lo del dueño anterior antes de soltar el equipo y entra al onboarding
  // canónico. Con el link de Órbita debajo, además, quedaba duplicado.
  const decl = appearanceDe(sinComentarios(leer(WEB)));
  // El modificador nombra la tarjeta que emite el pie, no el destino del link:
  // en el DOM de `@clerk/expo` 3.6.5 es `cl-footerAction cl-footerAction__signIn`.
  assert.match(
    decl,
    /elements:\s*\{\s*footerAction__signIn:\s*\{\s*display:\s*"none"\s*\}\s*\}/,
    "la salida al alta de Clerk tiene que quedar oculta"
  );
  // Sacarlo del árbol, no maquillarlo: escondido pero enfocable sigue siendo
  // alcanzable con teclado o lector de pantalla, o sea sigue siendo la salida.
  assert.doesNotMatch(
    decl,
    /visibility:|opacity:|fontSize:|height:/,
    "el pie se oculta con `display: none`, no con un maquillaje que lo deja enfocable"
  );
});

test("no se configura un `signUpUrl` que evada el callback", () => {
  // Cambiar el destino del link no lo hace seguro: seguiría siendo una salida
  // que navega sin ejecutar `onCreateAccount`, ahora hacia adentro de Órbita —
  // y sin archivar lo del dueño anterior. Por eso se saca, no se redirige.
  const web = sinComentarios(leer(WEB));
  assert.doesNotMatch(
    web,
    /signUpUrl|signInUrl|forceRedirectUrl|fallbackRedirectUrl/,
    "la salida de Clerk no se redirige a ningún lado: igual evadiría el callback"
  );
  // Y tampoco desde el provider, que aplica a TODOS los componentes de Clerk.
  assert.doesNotMatch(
    leer("src/services/backendProviders.tsx"),
    /signUpUrl|signInUrl/,
    "un `signUpUrl` global le devolvería el link al pie de la tarjeta"
  );
});

test("esa `appearance` oculta un elemento y nada más: no tematiza ni recrea la UI", () => {
  const decl = appearanceDe(sinComentarios(leer(WEB)));
  // Nada de lo que ya se rompió cuando las variables internas de Clerk
  // cambiaron: sin tema base, sin variables, sin layout, sin colores ni
  // tipografías propias.
  for (const tema of ["baseTheme", "variables", "layout", "color", "font", "cssLayerName"]) {
    assert.ok(!decl.includes(tema), `la excepción se convirtió en un tema propio por «${tema}»`);
  }
  // Un solo selector, y con el modificador `__signIn` que Clerk le pone a ese
  // pie: los otros pies de tarjeta (probar otro método, tengo problemas,
  // passkey) son pasos del flujo y los pinta Clerk.
  const dentroDeElements = decl.match(/elements:\s*\{([\s\S]*)\}/)?.[1] ?? "";
  const pisados = [...dentroDeElements.matchAll(/(\w+):\s*\{/g)].map((m) => m[1]);
  assert.deepEqual(
    pisados,
    ["footerAction__signIn"],
    `la excepción es UN elemento y es el pie del alta; se están pisando: ${pisados.join(", ")}`
  );
});

test("hay UNA sola salida al alta en la pantalla, y es la que archiva", () => {
  const web = sinComentarios(leer(WEB));
  const salidas = [...web.matchAll(/onCreateAccount\(/g)];
  assert.equal(salidas.length, 1, `la salida al alta está duplicada (${salidas.length} veces)`);
  assert.match(web, /onCreateAccount\(""\)/, "y es la que archiva antes de soltar el equipo");
  // Y un solo control que la ofrezca: dos enlaces al alta son la misma
  // duplicación que se vino a sacar, aunque los dos sean de Órbita. El de
  // volver es `role="button"`, así que no cuenta acá.
  const enlaces = [...web.matchAll(/accessibilityRole="link"/g)];
  assert.equal(enlaces.length, 1, `hay ${enlaces.length} enlaces a la vista, tiene que haber uno`);
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

test("el escenario de Órbita y las dos salidas se conservan", () => {
  const web = sinComentarios(leer(WEB));
  // Mismo fondo full-bleed y mismo wash que el resto del alta: la UI oficial se
  // apoya sobre el escenario de Órbita, no lo reemplaza.
  assert.match(
    web,
    /<Screen bg=\{A\.splashBg\} bgOpacity=\{0\.9\} wash=\{0\.55\} scroll>/,
    "el fondo inmersivo y el scroll del shell tienen que quedar"
  );
  // Volver y crear cuenta son de Órbita porque archivan los datos del dueño
  // anterior antes de soltar el equipo (`leaveWithoutSignIn` en la ruta).
  assert.match(web, /onPress=\{onBack\}/, "el control de volver sigue existiendo");
  assert.match(web, /onCreateAccount\(""\)/, "y la salida al alta también");
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
