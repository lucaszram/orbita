/**
 * Sign in with Apple NATIVO en iOS — superficie, configuración y autoridad.
 *
 * Lo que cambió en el build 29 es de dónde sale el botón y por dónde entra la
 * identidad:
 *
 * - El botón lo dibuja Apple (`AppleAuthenticationButton`), no Órbita. Texto,
 *   localización, tipografía, logo y accesibilidad son del sistema; lo único que
 *   elige la app son el tipo, el estilo y el radio.
 * - La identidad entra por la hoja del sistema y el `identityToken`
 *   (`useSignInWithApple` de `@clerk/expo/apple`), no por el navegador.
 *
 * Lo que NO cambió es todo lo demás, y esta suite existe sobre todo para
 * demostrar eso: la clasificación de la sesión creada, el descarte del marcador
 * ANTES de activarla, el teléfono compartido y Google —vía, marca y geometría—
 * quedan exactamente donde estaban.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  APPLE_SIGN_IN_CANCELLED,
  classifySsoOutcome,
  isSsoCancellation
} from "../src/onboarding/authGate";
import { importsOf, ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const APP_JSON = JSON.parse(leer("app.json"));
const PACKAGE = JSON.parse(leer("package.json"));
const IOS_BTN_REL = "src/onboarding/components/AppleAuthButton.ios.tsx";
const FALLBACK_REL = "src/onboarding/components/AppleAuthButton.tsx";
const IOS_BTN = sinComentarios(leer(IOS_BTN_REL));
const FALLBACK = sinComentarios(leer(FALLBACK_REL));
const PASTILLA = sinComentarios(leer("src/onboarding/components/ProviderButton.tsx"));
const ACCESO = sinComentarios(leer("src/onboarding/screens/AuthScreen.tsx"));
const HOOK = sinComentarios(leer("src/onboarding/useAccount.ts"));
const SSO = HOOK.slice(HOOK.indexOf("function useSSOOauth"), HOOK.indexOf("function useAccountFlowInner"));

// ---------------------------------------------------------------------------
// 1 · El binario: dependencias, plugin y localización
// ---------------------------------------------------------------------------

test("las dependencias del acceso nativo son las del SDK 54, y son las dos", () => {
  // `expo-crypto` no es opcional: el hook de Clerk arma el `nonce` con
  // `Crypto.randomUUID()` y sin el paquete el flujo tira antes de abrir la hoja.
  assert.equal(PACKAGE.dependencies["expo-apple-authentication"], "~8.0.8");
  assert.equal(PACKAGE.dependencies["expo-crypto"], "~15.0.9");
  // Y el rango sigue atado al SDK que instala esas versiones.
  assert.match(PACKAGE.dependencies.expo, /^~54\./);
  // No entran en el bundle web como dependencia de una superficie web.
  assert.equal("expo-apple-authentication" in (PACKAGE.devDependencies ?? {}), false);
});

test("el plugin de Expo entra y Clerk conserva su configuración de Apple", () => {
  const plugins: unknown[] = APP_JSON.expo.plugins;
  assert.ok(
    plugins.includes("expo-apple-authentication"),
    "sin el plugin, el entitlement `com.apple.developer.applesignin` no se escribe"
  );
  // La configuración que ya existía no se toca: las dos siguen siendo necesarias.
  assert.equal(APP_JSON.expo.ios.usesAppleSignIn, true);
  const clerk = plugins.find((entry) => Array.isArray(entry) && entry[0] === "@clerk/expo") as
    | [string, { appleSignIn?: boolean }]
    | undefined;
  assert.ok(clerk, "el plugin de Clerk sigue declarado");
  assert.equal(clerk![1].appleSignIn, true);
});

test("el botón nativo puede hablar el idioma del teléfono", () => {
  // `CFBundleAllowMixedLocalizations` es lo que deja que una vista del sistema
  // —el botón de Apple es una— se dibuje en el idioma del dispositivo aunque el
  // bundle de Órbita no envíe esa localización. Sin esto, el texto que pone
  // Apple puede quedar clavado en el idioma de desarrollo del binario.
  assert.equal(APP_JSON.expo.ios.infoPlist.CFBundleAllowMixedLocalizations, true);
  // Y Órbita no reemplaza ese texto por uno propio: en iOS no hay copy de Apple
  // en el repositorio.
  assert.equal(
    IOS_BTN.includes("Continuar con Apple"),
    false,
    "el texto del botón lo pone el sistema, no Órbita"
  );
});

// ---------------------------------------------------------------------------
// 2 · El botón: de Apple, con la geometría de la fila
// ---------------------------------------------------------------------------

test("iOS monta el botón de Apple con CONTINUE, WHITE y el radio de la fila", () => {
  assert.match(IOS_BTN, /import \* as AppleAuthentication from "expo-apple-authentication";/);
  assert.match(IOS_BTN, /<AppleAuthentication\.AppleAuthenticationButton/);
  assert.match(
    IOS_BTN,
    /buttonType=\{AppleAuthentication\.AppleAuthenticationButtonType\.CONTINUE\}/,
    "CONTINUE es el copy que ya usaba la pantalla"
  );
  assert.match(
    IOS_BTN,
    /buttonStyle=\{AppleAuthentication\.AppleAuthenticationButtonStyle\.WHITE\}/,
    "WHITE es uno de los dos botones que publica la guía, y el que ya tenía Órbita"
  );
  assert.match(IOS_BTN, /cornerRadius=\{PROVIDER_RADIUS\}/);
  assert.match(IOS_BTN, /onPress=\{onPress\}/, "el callback del acceso no cambia");
});

test("mide 54 de alto y ocupa el ancho de la columna, con la geometría compartida", () => {
  assert.match(IOS_BTN, /import \{ PROVIDER_HEIGHT, PROVIDER_RADIUS \} from "\.\/ProviderButton";/);
  assert.match(PASTILLA, /export const PROVIDER_HEIGHT = 54;/);
  assert.match(PASTILLA, /export const PROVIDER_RADIUS = 27;/);
  // El marco y el botón: mismo alto, ancho de la columna. El nativo no se mide
  // solo, así que las dos medidas son explícitas.
  assert.match(IOS_BTN, /slot: \{ alignSelf: "stretch", height: PROVIDER_HEIGHT \}/);
  assert.match(IOS_BTN, /button: \{ height: PROVIDER_HEIGHT, width: "100%" \}/);
  // Ningún número suelto: si alguien cambia 54 o 27, se mueve toda la fila.
  assert.equal(/height: 54|cornerRadius=\{27\}/.test(IOS_BTN), false, "sin literales duplicados");
});

test("la variante iOS no dibuja NADA de Apple por su cuenta", () => {
  // Todo lo que el sistema aporta —logo, texto, tipografía, color, borde— tiene
  // que estar ausente acá: es lo único que garantiza que no pueda divergir.
  for (const prohibido of [
    /\bSvg\b/,
    /\bPath\b/,
    /AppleMark/,
    /\bText\b/,
    /fontFamily/,
    /fontSize/,
    /tintColor/,
    /borderWidth/,
    /borderColor/,
    /backgroundColor/,
    /accessibilityLabel/,
    /components\/brand\/ProviderMarks/
  ]) {
    assert.doesNotMatch(IOS_BTN, prohibido, `la variante iOS no puede traer ${prohibido}`);
  }
  // Y tampoco la pastilla de Órbita: en iOS Apple no pasa por ella.
  assert.doesNotMatch(IOS_BTN, /<ProviderButton/);
});

test("sólo se dibuja si `isAvailableAsync` lo confirma, y sin salto de layout", () => {
  assert.match(IOS_BTN, /AppleAuthentication\.isAvailableAsync\(\)/);
  // Tres estados, en este orden: sin respuesta → marco reservado; `false` →
  // nada; `true` → el botón. Reservar el marco desde el primer frame es lo que
  // evita que la fila se mueva en el caso normal, que es el que se ve.
  const iSlot = IOS_BTN.indexOf("if (available === null) return <View style={styles.slot} />;");
  const iNull = IOS_BTN.indexOf("if (!available) return null;");
  const iBoton = IOS_BTN.indexOf("<AppleAuthentication.AppleAuthenticationButton");
  assert.ok(iSlot > 0, "falta el marco reservado mientras se consulta");
  assert.ok(iNull > iSlot, "el cierre del hueco va después, y sólo con un `false` explícito");
  assert.ok(iBoton > iNull, "el botón se monta recién cuando Apple confirmó");
  // El marco reservado y el marco montado son EL MISMO estilo: si midieran
  // distinto, aparecer el botón movería la fila.
  assert.match(IOS_BTN, /<View style=\{\[styles\.slot, off && styles\.off\]\}/);
  // Falla cerrado: si la consulta se rompe, no se ofrece la vía.
  assert.match(IOS_BTN, /\.catch\(\(\) => \{\s*if \(vigente\) setAvailable\(false\);\s*\}\)/);
  // Y no se toca el estado después de desmontar.
  assert.match(IOS_BTN, /return \(\) => \{\s*vigente = false;\s*\}/);
});

test("ocupado o deshabilitado apaga el botón sin reescribir a Apple", () => {
  // El nativo no tiene "Un momento…": su texto es del sistema. La protección es
  // de opacidad y de toques, que es lo mismo que hace la pastilla custom.
  assert.match(IOS_BTN, /const off = busy \|\| disabled;/);
  assert.match(IOS_BTN, /pointerEvents=\{off \? "none" : "auto"\}/);
  assert.match(IOS_BTN, /off: \{ opacity: 0\.55 \}/);
  assert.equal(/Un momento…/.test(IOS_BTN), false, "el copy del sistema no se pisa");
});

// ---------------------------------------------------------------------------
// 3 · La separación por plataforma
// ---------------------------------------------------------------------------

test("el bundle web NUNCA importa `expo-apple-authentication`", () => {
  // La elección la hace el bundler por archivo de plataforma, no un
  // `Platform.OS` adentro: un `if` en runtime dejaría el import en el bundle.
  const webImports = importsOf(join(ROOT, FALLBACK_REL));
  assert.equal(
    webImports.includes("expo-apple-authentication"),
    false,
    "el módulo es sólo de iOS: en web ni siquiera puede aparecer el import"
  );
  // Y el de iOS SÍ lo importa: si no, la prueba de arriba pasaría vacía.
  assert.ok(importsOf(join(ROOT, IOS_BTN_REL)).includes("expo-apple-authentication"));
  // La pantalla no elige plataforma a mano.
  assert.doesNotMatch(ACCESO, /Platform\.OS/, "la elección la hace el bundler, no la pantalla");
  assert.match(ACCESO, /import \{ AppleAuthButton \} from "\.\.\/components\/AppleAuthButton";/);
});

test("fuera de iOS se conserva la pastilla de Órbita, con su copy y su marca", () => {
  assert.match(FALLBACK, /import \{ ProviderButton \} from "\.\/ProviderButton";/);
  assert.match(FALLBACK, /const LABEL = "Continuar con Apple";/);
  assert.match(
    FALLBACK,
    /<ProviderButton icon="apple" label=\{LABEL\} busy=\{busy\} disabled=\{disabled\} onPress=\{onPress\} \/>/
  );
  // Mismo contrato de props que la variante nativa: la pantalla no sabe cuál
  // de las dos le tocó.
  for (const source of [IOS_BTN, FALLBACK]) {
    assert.match(source, /busy: boolean;\s*disabled: boolean;\s*onPress: \(\) => void;/);
  }
});

// ---------------------------------------------------------------------------
// 4 · Clerk nativo: misma transición, distinta puerta
// ---------------------------------------------------------------------------

test("iOS entra por la hoja del sistema; Google y la web siguen por el navegador", () => {
  assert.match(HOOK, /export const APPLE_NATIVE_SIGN_IN = Platform\.OS === "ios";/);
  assert.match(
    SSO,
    /const \{ useSignInWithApple \} = require\("@clerk\/expo\/apple"\) as typeof import\("@clerk\/expo\/apple"\);/
  );
  assert.match(SSO, /const \{ startAppleAuthenticationFlow \} = useSignInWithApple\(\);/);
  assert.match(
    SSO,
    /provider === "apple" && APPLE_NATIVE_SIGN_IN\s*\?\s*await startAppleAuthenticationFlow\(\)\s*:\s*await startSSOFlow\(\{ strategy, redirectUrl \}\);/
  );
  // Google NO se toca: misma estrategia, mismo callback allowlisteado.
  assert.match(
    SSO,
    /const strategy = provider === "apple" \? \("oauth_apple" as const\) : \("oauth_google" as const\);/
  );
  assert.match(
    SSO,
    /AuthSession\.makeRedirectUri\(\{ scheme: "com\.lucasssram\.orbita", path: "callback" \}\)/
  );
  // Y el hook nuevo entra en las dependencias del callback.
  assert.match(SSO, /\[redirectUrl, startSSOFlow, startAppleAuthenticationFlow\]/);
});

test("la vía nativa NO se saltea la clasificación ni el descarte del marcador", () => {
  // Éste es el corazón del cambio: la hoja de Apple devuelve exactamente la
  // misma forma que el navegador, así que todo lo que venía después sigue
  // corriendo, en el mismo orden, para las dos vías.
  const iApple = SSO.indexOf("await startAppleAuthenticationFlow()");
  const iClassify = SSO.indexOf("classifySsoOutcome({");
  const iDiscard = SSO.indexOf('if (outcome === "existing_account") hooks?.onExistingAccount?.();');
  const iActivate = SSO.indexOf("await setActive({ session: createdSessionId });");
  assert.ok(iApple > 0 && iClassify > iApple, "la clasificación corre después de la hoja");
  assert.ok(iDiscard > iClassify, "y el descarte, después de clasificar");
  assert.ok(iActivate > iDiscard, "la sesión se activa ÚLTIMA");
  // La clasificación sigue leyendo los dos recursos, no un status.
  assert.match(SSO, /signUpCreatedSessionId: signUp\?\.createdSessionId \?\? null/);
  assert.match(SSO, /signInCreatedSessionId: signIn\?\.createdSessionId \?\? null/);
});

test("la forma que devuelve la hoja de Apple clasifica igual que la del navegador", () => {
  // `startAppleAuthenticationFlow` devuelve `{ createdSessionId, setActive,
  // signIn, signUp }`: cancelación sin sesión, alta nueva por el recurso de
  // alta (el `transfer`) y cuenta existente por el de ingreso.
  assert.equal(
    classifySsoOutcome({
      createdSessionId: null,
      signUpCreatedSessionId: null,
      signInCreatedSessionId: null
    }),
    "cancelled"
  );
  assert.equal(
    classifySsoOutcome({
      createdSessionId: "sess_apple",
      signUpCreatedSessionId: "sess_apple",
      signInCreatedSessionId: null
    }),
    "new_account"
  );
  assert.equal(
    classifySsoOutcome({
      createdSessionId: "sess_apple",
      signUpCreatedSessionId: null,
      signInCreatedSessionId: "sess_apple"
    }),
    "existing_account"
  );
  // Y el lado seguro sigue siendo descartar el marcador cuando no hay
  // coincidencia clara.
  assert.equal(
    classifySsoOutcome({
      createdSessionId: "sess_apple",
      signUpCreatedSessionId: "otra",
      signInCreatedSessionId: "otra"
    }),
    "existing_account"
  );
});

// ---------------------------------------------------------------------------
// 5 · Cancelar la hoja no es un error
// ---------------------------------------------------------------------------

test("`ERR_REQUEST_CANCELED` es cancelación, y nada más lo es", () => {
  assert.equal(APPLE_SIGN_IN_CANCELLED, "ERR_REQUEST_CANCELED");
  assert.equal(isSsoCancellation({ code: APPLE_SIGN_IN_CANCELLED }), true);
  // Un fallo real NO puede pasar por cancelación: ahí sí hay que decir algo.
  assert.equal(isSsoCancellation({ code: "ERR_INVALID_RESPONSE" }), false);
  assert.equal(isSsoCancellation({ code: "ERR_REQUEST_UNKNOWN" }), false);
  assert.equal(isSsoCancellation(new Error("boom")), false);
  assert.equal(isSsoCancellation({ message: APPLE_SIGN_IN_CANCELLED }), false);
  // Ni un valor suelto con el mismo texto.
  assert.equal(isSsoCancellation(APPLE_SIGN_IN_CANCELLED), false);
  assert.equal(isSsoCancellation(null), false);
  assert.equal(isSsoCancellation(undefined), false);
});

test("cerrar la hoja sale en silencio: sin cartel de error y sin perder nada", () => {
  const iCancel = SSO.indexOf('if (isSsoCancellation(e)) return "cancelled";');
  const iError = SSO.indexOf("setError(clerkErrorMessage(e));");
  assert.ok(iCancel > 0, "la cancelación tiene que resolverse antes de reportar un fallo");
  assert.ok(iError > iCancel, "el mensaje de error queda para lo que sí es un error");
  // El estado de ocupado se libera igual por las dos salidas.
  assert.match(SSO, /finally \{\s*setOauthBusy\(null\);\s*\}/);
});

// ---------------------------------------------------------------------------
// 6 · Google, intacto
// ---------------------------------------------------------------------------

test("Google no cambió de vía, de marca ni de geometría", () => {
  // La pantalla lo sigue montando con la pastilla, con su copy y su flag.
  assert.match(ACCESO, /GOOGLE_AUTH_ENABLED \?[\s\S]{0,240}label="Continuar con Google"/);
  assert.match(ACCESO, /onPress=\{\(\) => onPress\("google"\)\}/);
  // La G oficial y la pastilla de 54/27 siguen siendo las de siempre.
  assert.match(PASTILLA, /apple \? <AppleMark tone="black" \/> : <GoogleMark \/>/);
  assert.match(PASTILLA, /borderRadius: PROVIDER_RADIUS/);
  assert.match(PASTILLA, /height: PROVIDER_HEIGHT/);
  const google = sinComentarios(leer("src/onboarding/components/GoogleButton.tsx"));
  assert.match(google, /borderRadius: 27,/);
  assert.match(google, /height: 54,/);
  assert.match(google, /<GoogleMark \/>/);
  // Y ninguna superficie de Google puede arrastrar el módulo de Apple.
  for (const rel of [
    "src/onboarding/components/GoogleButton.tsx",
    "src/onboarding/components/ProviderButton.tsx"
  ]) {
    assert.equal(
      importsOf(join(ROOT, rel)).includes("expo-apple-authentication"),
      false,
      `${rel} no puede importar el módulo de Apple`
    );
  }
});
