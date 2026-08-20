import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { bootGateSurface } from "../src/domain/accountDeletion";
import { resolveEntryForPlatform, type ModulePlatform } from "./moduleGraph";

const ROOT = join(import.meta.dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const APP_FILES = walk(join(ROOT, "app"));
const SRC_FILES = walk(join(ROOT, "src"));
const fuenteDeEntrada = (ruta: string, plataforma: ModulePlatform) =>
  readFileSync(resolveEntryForPlatform(ruta, plataforma), "utf8");

// --- La dependencia no puede volver a invertirse -----------------------------
// `mapNatalChart` y `Radar` vivían dentro de `src/components/web/`, así que seis
// pantallas NATIVAS importaban desde una pantalla web. Con esa dependencia no se
// podía retirar la implementación web duplicada sin romper el nativo.

/**
 * Ya no queda ninguna ruta apuntando a una pantalla web duplicada. La lista de
 * pendientes llegó a cero: de acá en adelante el patrón está prohibido.
 */
test("ninguna ruta importa una pantalla web duplicada", () => {
  const culpables = APP_FILES.filter((f) => {
    const s = readFileSync(f, "utf8");
    return /from "@\/components\/web\/orbita-(chart|values|home|transit|onboarding|personality|soon)"/.test(s);
  })
    .map((f) => f.replace(ROOT + "/", ""))
    .sort();
  assert.deepEqual(culpables, [], `estas rutas duplican una pantalla: ${culpables.join(", ")}`);
});

test("web y nativo llegan al MISMO onboarding canónico por sus entradas resueltas", () => {
  const canonico = readFileSync(join(ROOT, "src/onboarding/OnboardingFlow.tsx"), "utf8");
  // 15 pasos: la secuencia V4.4 completa, con la cuenta en su lugar original
  // (`14 / Create Account`) y el cierre al final.
  assert.match(canonico, /const TOTAL = 15;/, "el flujo canónico debe tener 15 pasos");
  // La ruta web monta el gate compartido; la entrada nativa histórica
  // `/empezar` es sólo un alias limpio hacia `/onboarding`, que monta ese mismo
  // gate. Así la web conserva su aviso de backend sin meterlo en el bundle iOS.
  const gate = readFileSync(join(ROOT, "src/onboarding/OnboardingGate.tsx"), "utf8");
  assert.ok(/@\/onboarding\/OnboardingFlow/.test(gate), "el gate debe montar el flujo canónico");
  const empezarWeb = fuenteDeEntrada("app/empezar.tsx", "web");
  assert.match(empezarWeb, /OnboardingGate/, "la entrada web debe montar el gate compartido");

  const empezarNative = fuenteDeEntrada("app/empezar.tsx", "native");
  assert.match(empezarNative, /<Redirect href="\/onboarding"\s*\/>/, "el alias nativo entra al onboarding");
  assert.doesNotMatch(
    empezarNative,
    /OnboardingGate|WebNotice|backendConfig/,
    "el alias nativo debe ser una redirección limpia"
  );

  const onboarding = fuenteDeEntrada("app/onboarding.tsx", "native");
  assert.match(onboarding, /OnboardingGate/, "la ruta nativa canónica debe montar el gate compartido");
  assert.throws(
    () => readFileSync(join(ROOT, "src/components/web/orbita-onboarding.tsx"), "utf8"),
    "volvió a aparecer un onboarding web aparte"
  );
});

test("Gate A: el onboarding no reintroduce una pantalla de pago web", () => {
  const canonico = readFileSync(join(ROOT, "src/onboarding/OnboardingFlow.tsx"), "utf8");
  assert.match(canonico, /const PAYWALL_ENABLED = false;/, "Gate A es comercio apagado");
});

test("el borrador de sesión está cableado al flujo canónico", () => {
  const canonico = readFileSync(join(ROOT, "src/onboarding/OnboardingFlow.tsx"), "utf8");
  for (const fn of ["readDraft", "writeDraft", "clearDraft"]) {
    assert.ok(canonico.includes(fn), `OnboardingFlow debe usar ${fn}: sin eso, volver de Clerk borra el alta`);
  }
});

test("mapNatalChart y Radar son módulos compartidos, no partes de una pantalla web", () => {
  const natal = readFileSync(join(ROOT, "src/domain/natalChart.ts"), "utf8");
  assert.ok(/export function mapNatalChart/.test(natal));
  const radar = readFileSync(join(ROOT, "src/components/orbita/Radar.tsx"), "utf8");
  assert.ok(/export function Radar/.test(radar));
});

// --- Alert es no-op en react-native-web -------------------------------------
// `Alert.alert` de react-native-web es `static alert() {}`. El Perfil canónico
// se sirve también en web, así que "Eliminar mi cuenta" abría una promesa que
// nunca resolvía y dejaba tomado el lock de reentrada.

test("react-native-web sigue sin implementar Alert (la razón de ConfirmHost)", () => {
  const rnw = readFileSync(join(ROOT, "node_modules/react-native-web/dist/exports/Alert/index.js"), "utf8");
  assert.match(rnw, /static alert\(\)\s*\{\s*\}/, "si RNW implementó Alert, revisar si ConfirmHost sigue haciendo falta");
});

test("ninguna pantalla compartida confirma ni avisa con Alert directo", () => {
  const compartidas = [
    join(ROOT, "src/screens/PerfilScreen.tsx"),
    join(ROOT, "src/screens/HomeScreen.tsx"),
    resolveEntryForPlatform("app/(tabs)/index.tsx", "native")
  ];
  for (const f of compartidas) {
    const s = readFileSync(f, "utf8");
    assert.ok(!/\bAlert\.alert\(/.test(s), `${f.replace(ROOT + "/", "")} usa Alert.alert, que no hace nada en web`);
  }
});

test("ConfirmHost expone confirmación y aviso, y usa Alert sólo fuera de web", () => {
  const s = readFileSync(join(ROOT, "src/components/orbita/ConfirmHost.tsx"), "utf8");
  assert.ok(/export function useConfirm/.test(s));
  assert.ok(/export function useNotify/.test(s));
  assert.ok(/Platform\.OS === "web"/.test(s));
});

test("el host de confirmación está montado en el layout raíz", () => {
  const layout = readFileSync(join(ROOT, "app/_layout.tsx"), "utf8");
  assert.ok(/<ConfirmHost>/.test(layout), "sin el host montado, useConfirm cae al Alert no-op en web");
});

// --- Guardas P0 que no se pueden perder en la unificación --------------------

test("no vuelve a existir un gate de mocks ni `?live=1`", () => {
  // Se mira el CÓDIGO, no los comentarios: varios explican de qué se migró y
  // nombran el patrón viejo a propósito. Una lista de exclusiones por archivo
  // se desactualiza sola; sacar los comentarios es exacto.
  const todos = [...APP_FILES, ...SRC_FILES];
  const culpables = todos
    .filter((f) => {
      const codigo = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      return /LiveGate|urlForcedLive|live=1/.test(codigo);
    })
    .map((f) => f.replace(ROOT + "/", ""));
  assert.deepEqual(culpables, []);
});

// --- Una sola definición de pantalla por experiencia -------------------------
// El problema original: la web tenía su propia Home, Carta, Tránsitos y Diario
// en `src/components/web/`, y derivaban del nativo sin que nada lo impidiera.

// La Carta ya no tiene una ruta web aparte: `app/carta.tsx` y `app/(tabs)/carta.tsx`
// se disputaban la URL `/carta` (los segmentos de grupo son opcionales en
// expo-router) y montaban DOS shells distintos según por cuál entrabas. Quedó la
// del grupo, que es la que el shell web ya envuelve una sola vez desde el layout.
const CANONICAS = [
  ["src/screens/HomeScreen.tsx", "HomeScreen", ["app/home.tsx", "app/(tabs)/index.tsx"]],
  ["src/screens/CartaScreen.tsx", "CartaScreen", ["app/(tabs)/carta.tsx"]],
  ["src/screens/TransitosScreen.tsx", "TransitosScreen", ["app/transito.tsx", "app/(tabs)/transitos/index.tsx"]],
  ["src/screens/DiarioScreen.tsx", "DiarioScreen", ["app/diario.tsx", "app/reading/diario.tsx"]]
] as const;

test("las rutas web conservan sus pantallas canónicas aunque nativo agregue V4.9.2", () => {
  for (const [modulo, nombre, rutas] of CANONICAS) {
    const canon = readFileSync(join(ROOT, modulo), "utf8");
    assert.ok(new RegExp(`export function ${nombre}`).test(canon), `${modulo} no exporta ${nombre}`);
    for (const ruta of rutas) {
      const s = fuenteDeEntrada(ruta, "web");
      assert.ok(
        s.includes(`@/screens/${nombre}`),
        `${ruta} no resuelve a la pantalla web canónica ${nombre}`
      );
    }
  }

  // Las dos entradas históricas de Home mantienen el ritual canónico en web,
  // pero en iOS redirigen a Hoy sin importar Home, Diario ni tarot.
  for (const ruta of ["app/home.tsx", "app/(tabs)/index.tsx"]) {
    assert.match(fuenteDeEntrada(ruta, "web"), /@\/screens\/HomeScreen/, `${ruta} conserva Home en web`);
    assert.doesNotMatch(
      fuenteDeEntrada(ruta, "native"),
      /@\/screens\/HomeScreen/,
      `${ruta} no puede importar HomeScreen en nativo`
    );
  }
});

test("las pantallas web duplicadas ya no existen", () => {
  for (const f of [
    "src/components/web/orbita-home.tsx",
    "src/components/web/orbita-chart.tsx",
    "src/components/web/orbita-transit.tsx",
    "src/components/web/orbita-values.tsx",
    "src/components/web/orbita-personality.tsx",
    "src/components/web/orbita-soon.tsx"
  ]) {
    assert.throws(() => readFileSync(join(ROOT, f), "utf8"), `${f} volvió a aparecer`);
  }
});

test("web permanece sin cambios y nativo expone las cinco pestañas V4.9.2", () => {
  const nav = readFileSync(join(ROOT, "src/components/web/web-nav.tsx"), "utf8");
  const seccionesWeb = [...nav.matchAll(/\{ key: "(\w+)", label: "([^"]+)", href/g)].map((m) => m[2]);
  const wrapper = readFileSync(join(ROOT, "app/(tabs)/_layout.tsx"), "utf8");
  assert.match(wrapper, /export \{ default \} from "@\/routes\/v492\/tabs-layout"/);

  const nativePath = resolveEntryForPlatform("app/(tabs)/_layout.tsx", "native");
  const webPath = resolveEntryForPlatform("app/(tabs)/_layout.tsx", "web");
  assert.equal(nativePath, join(ROOT, "src/routes/v492/tabs-layout.tsx"));
  assert.equal(webPath, join(ROOT, "src/routes/v492/tabs-layout.web.tsx"));

  const tabsNativas = readFileSync(nativePath, "utf8");
  const tabsWeb = readFileSync(webPath, "utf8");
  const seccionesNativas = [
    ...tabsNativas.matchAll(/<Tabs\.Screen name="(\w+)" options=\{\{ title: "([^"]+)" \}\} \/>/g)
  ].map((m) => ({ name: m[1], title: m[2] }));
  assert.deepEqual(seccionesWeb, ["Inicio", "Tránsitos", "Umbral", "Perfil"], "la navegación web no cambia");
  assert.deepEqual(
    seccionesNativas,
    [
      { name: "hoy", title: "Hoy" },
      { name: "transitos", title: "Tránsitos" },
      { name: "vinculos", title: "Vínculos" },
      { name: "umbral", title: "Umbral" },
      // 2026-08-19: la 5ª pestaña muestra el hub de la carta directamente y se
      // llama por lo que es. El name sigue siendo `perfil` (URL web, redirects).
      { name: "perfil", title: "Carta" }
    ],
    "la app nativa tiene exactamente las cinco pestañas V4.9.2"
  );
  assert.doesNotMatch(tabsNativas, /title: "(?:Diario|Tarot)"/, "Diario y Tarot no vuelven a la barra nativa");
  assert.match(tabsWeb, /<WebAppShell active=\{navKeyForPath\(pathname\)\}>[\s\S]*<Slot \/>/);
});

test("el Umbral es una sección de la web, no una ruta olvidada", () => {
  assert.throws(
    () => readFileSync(join(ROOT, "app/umbral.tsx"), "utf8"),
    "la raíz no puede volver a disputar /umbral con el grupo de pestañas"
  );
  const umbral = readFileSync(join(ROOT, "app/(tabs)/umbral/index.tsx"), "utf8");
  assert.ok(/VoidExperience/.test(umbral), "/umbral debe montar la experiencia canónica dentro de su tab");
  const nav = readFileSync(join(ROOT, "src/components/web/web-nav.tsx"), "utf8");
  assert.ok(/href: "\/umbral"/.test(nav));
});

test("las cinco pestañas son stacks propios y conservan la barra al abrir detalles", () => {
  for (const tab of ["hoy", "transitos", "vinculos", "umbral", "perfil"]) {
    const layout = readFileSync(join(ROOT, `app/(tabs)/${tab}/_layout.tsx`), "utf8");
    assert.match(layout, /(?:import \{[^}]*\bStack\b[^}]*\} from "expo-router"|<Stack\b)/, `${tab} debe tener un stack`);
    assert.match(layout, /<Stack\b/, `${tab} debe montar su stack dentro de la pestaña`);
    readFileSync(join(ROOT, `app/(tabs)/${tab}/index.tsx`), "utf8");
  }
});

test("las rutas nuevas de Tránsitos son wrappers resueltos por plataforma fuera de app", () => {
  const casos = [
    ["app/(tabs)/transitos/momento.tsx", "transitos-momento"],
    ["app/(tabs)/transitos/arco/[arcId].tsx", "transitos-arco"]
  ] as const;

  for (const [ruta, modulo] of casos) {
    const wrapper = readFileSync(join(ROOT, ruta), "utf8");
    assert.match(wrapper, new RegExp(`export \\{ default \\} from "@/routes/v492/${modulo}"`));

    const nativePath = resolveEntryForPlatform(ruta, "native");
    const webPath = resolveEntryForPlatform(ruta, "web");
    assert.equal(nativePath, join(ROOT, `src/routes/v492/${modulo}.tsx`));
    assert.equal(webPath, join(ROOT, `src/routes/v492/${modulo}.web.tsx`));
    assert.ok(!nativePath.startsWith(join(ROOT, "app/")), `${ruta} no puede implementar nativo dentro de app`);
    assert.ok(!webPath.startsWith(join(ROOT, "app/")), `${ruta} no puede implementar web dentro de app`);
  }
});

// --- La fecha del historial no puede volver al reloj del navegador -----------

test("Home y Diario derivan el rango de la fecha canónica del servidor", () => {
  for (const f of ["src/screens/HomeScreen.tsx", "src/screens/DiarioScreen.tsx"]) {
    // Se mira el CÓDIGO, no los comentarios: los comentarios explican
    // justamente de qué se migró y nombran las funciones viejas.
    const s = readFileSync(join(ROOT, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    assert.ok(/useCanonicalLocalDate/.test(s), `${f} debe tomar el día del servidor`);
    assert.ok(/lastNDaysFrom/.test(s), `${f} debe derivar la ventana de esa fecha`);
    assert.ok(!/\blastNDays\(/.test(s), `${f} sigue usando el reloj del navegador`);
    assert.ok(!/\btoLocalDate\(\)/.test(s), `${f} sigue usando el reloj del navegador`);
  }
});

// --- ImageBackground en react-native-web ------------------------------------
// Pasar un `imageStyle` propio pisa el sizing por defecto y el <img> queda a su
// tamaño intrínseco. El fondo del onboarding salía a 393px dentro de un
// viewport de 318 y desbordaba en móvil. En nativo no se nota, así que sólo
// aparece cuando la pantalla se sirve en web — justo lo que hace la paridad.

test("todo imageStyle de una pantalla compartida fija tamaño explícito", () => {
  const compartidas = [
    ...walk(join(ROOT, "src/screens")),
    ...walk(join(ROOT, "src/onboarding")),
    ...walk(join(ROOT, "src/components/orbita")),
    ...walk(join(ROOT, "src/components/home"))
  ];
  const culpables: string[] = [];
  for (const f of compartidas) {
    const s = readFileSync(f, "utf8");
    // `imageStyle={{ ... }}` inline: tiene que declarar width y height.
    for (const m of s.matchAll(/imageStyle=\{\{([^}]*)\}\}/g)) {
      const cuerpo = m[1];
      if (!/width/.test(cuerpo) || !/height/.test(cuerpo)) {
        culpables.push(`${f.replace(ROOT + "/", "")}: ${cuerpo.trim().slice(0, 60)}`);
      }
    }
  }
  assert.deepEqual(culpables, [], `imageStyle sin tamaño explícito (desborda en web): ${culpables.join(" | ")}`);
});

// --- Un solo login ----------------------------------------------------------
// La web tenía `/login` (componente `<SignIn>` de Clerk) además de
// `/iniciar-sesion` (el canónico, compartido con nativo): dos pantallas de
// entrada distintas para el mismo producto.

test("el login canónico es /iniciar-sesion y no hay una pantalla web aparte", () => {
  assert.throws(
    () => readFileSync(join(ROOT, "src/components/web/orbita-login.tsx"), "utf8"),
    "volvió a aparecer un login web aparte"
  );
  const alias = readFileSync(join(ROOT, "app/login.tsx"), "utf8");
  assert.ok(/Redirect/.test(alias) && /\/iniciar-sesion/.test(alias), "/login debe redirigir al canónico");
});

test("ningún enlace público manda a /login: van directo al canónico", () => {
  const publicas = [
    "src/components/web/require-session.tsx",
    "src/components/web/web-nav.tsx",
    "src/components/web/orbita-landing.tsx"
  ];
  for (const f of publicas) {
    const s = readFileSync(join(ROOT, f), "utf8");
    assert.ok(!/href="\/login"/.test(s), `${f} sigue enlazando al alias legado`);
  }
});

test("/login sigue siendo pública, como alias legado", () => {
  const s = readFileSync(join(ROOT, "src/domain/webSession.ts"), "utf8");
  assert.ok(/"\/login"/.test(s), "sacarla de la allowlist rompe los enlaces viejos");
});

// La localización de Clerk NO se puede sacar: Studio y backoffice siguen
// montando `<SignIn>`, y cuelga del ClerkProvider.
test("la localización de Clerk sigue configurada mientras haya componentes de Clerk", () => {
  const usanSignIn = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "app"))].filter((f) =>
    /require\("@clerk\/expo\/web"\)/.test(readFileSync(f, "utf8"))
  );
  if (usanSignIn.length === 0) return; // si nadie los monta, se puede revisar
  const providers = readFileSync(join(ROOT, "src/services/backendProviders.tsx"), "utf8");
  assert.ok(/localization=\{orbitaEsES\}/.test(providers), "quedaría UI de Clerk en inglés");
});

// --- El destino post-login no puede caer en la landing -----------------------
// En web `app/(tabs)/index.tsx` y `app/index.tsx` resuelven los dos a `/`, así
// que `router.replace("/(tabs)")` devolvía a la página pública ya logueado.

test("después de entrar se va a la Home autenticada, no a /(tabs) en web", () => {
  // El login ya no navega a mano: lo decide el resolver, y el gate usa
  // HOME_ROUTE, que en web es `/home` (en web `/(tabs)` resolvía a la landing).
  const login = readFileSync(join(ROOT, "app/iniciar-sesion.tsx"), "utf8");
  assert.ok(!/router\.replace\("\/\(tabs\)"\)/.test(login));
  const puerta = readFileSync(join(ROOT, "src/components/orbita/AccountGate.tsx"), "utf8");
  assert.ok(/HOME_ROUTE/.test(puerta), "el gate navega con el destino por plataforma");
  const rutas = readFileSync(join(ROOT, "src/domain/appRoutes.ts"), "utf8");
  assert.match(rutas, /HOME_ROUTE = IS_WEB \? "\/home" : "\/\(tabs\)"/);
});

test("la landing sólo se renderiza sin sesión, y lo decide el resolver único", () => {
  const wrapper = readFileSync(join(ROOT, "app/index.tsx"), "utf8");
  assert.match(wrapper, /export \{ default \} from "@\/routes\/v492\/index"/);
  const resolved = resolveEntryForPlatform("app/index.tsx", "web");
  assert.equal(resolved, join(ROOT, "src/routes/v492/index.web.tsx"));
  const index = readFileSync(resolved, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  // El orden lo decide `bootGateSurface`, no un `if (IS_WEB)` suelto: el
  // bloqueo por eliminación pendiente gana, y la landing es la superficie
  // siguiente. Antes el `return` de la landing estaba ANTES del bloqueo, así que
  // con una eliminación a medias en disco la web dejaba entrar igual.
  assert.match(index, /bootGateSurface\(\{ pendingDeletion: pendingDeletionBlocking, isWeb: IS_WEB \}\)/);
  const bloqueo = index.indexOf('if (surface === "pending-deletion")');
  const landing = index.indexOf('if (surface === "landing")');
  assert.ok(bloqueo > 0 && landing > 0, "faltan las dos superficies");
  assert.ok(bloqueo < landing, "el bloqueo por eliminación pendiente va primero");

  // Y la landing sigue envuelta por el gate de cuenta compartido.
  const hastaLanding = index.slice(landing, index.indexOf("<OrbitaLanding />"));
  assert.ok(
    /AccountGate surface="landing"/.test(hastaLanding),
    "la landing debe pasar por el gate compartido, no por un guard propio"
  );

  // La decisión pura, con las dos plataformas.
  assert.equal(bootGateSurface({ pendingDeletion: true, isWeb: true }), "pending-deletion");
  assert.equal(bootGateSurface({ pendingDeletion: false, isWeb: true }), "landing");
  assert.equal(bootGateSurface({ pendingDeletion: false, isWeb: false }), "app");
});

// --- Patrones que desbordan en web ------------------------------------------
// Tres formas distintas del mismo problema, todas invisibles en nativo:
//  1. `absoluteFillObject` fija los cuatro lados pero NO el tamaño, y el <img>
//     de react-native-web se va a su tamaño intrínseco (1024px).
//  2. Un contenedor que debe recortar un asset decorativo sin `overflow: hidden`.
//  3. Un item flex que no encoge porque en web `min-width` es `auto`.

test("toda imagen con absoluteFillObject declara tamaño explícito", () => {
  const compartidas = [
    ...walk(join(ROOT, "src/components/orbita")),
    ...walk(join(ROOT, "src/components/home")),
    ...walk(join(ROOT, "src/components/diario")),
    ...walk(join(ROOT, "src/components/void")),
    ...walk(join(ROOT, "src/screens"))
  ];
  const culpables: string[] = [];
  for (const f of compartidas) {
    const s = readFileSync(f, "utf8");
    // Estilos que mezclan absoluteFillObject y se usan sobre una <Image>.
    for (const m of s.matchAll(/^\s*(\w*(?:[Ii]mg|[Ii]mage|backdrop|texture))\s*:\s*\{([^}]*absoluteFillObject[^}]*)\}/gm)) {
      // Sólo estilos de IMAGEN. Los velos y degradés (`backdropScrim`,
      // `heroFade`) son Views de color: no tienen tamaño intrínseco que fugue.
      const cuerpo = m[2];
      if (!/width/.test(cuerpo) || !/height/.test(cuerpo)) {
        culpables.push(`${f.replace(ROOT + "/", "")} → ${m[1]}`);
      }
    }
  }
  assert.deepEqual(culpables, [], `imagen absoluteFill sin tamaño (estira la página en web): ${culpables.join(", ")}`);
});

test("el hero full-bleed recorta su asset decorativo y lo dibuja MEDIDO", () => {
  const s = readFileSync(join(ROOT, "src/components/orbita/ImmersiveHero.tsx"), "utf8");
  const wrap = s.slice(s.indexOf("wrap: {"), s.indexOf("rounded: {"));
  assert.ok(/overflow: "hidden"/.test(wrap), "sin recorte, la imagen de 1024px estira la página");
  // El contenedor ya no se acota con `width: "100%"` sobre un `absoluteFill`:
  // ese combo podía terminar sin pintar en react-native-web y dejaba un hueco
  // negro del alto del hero (regresión de Tránsitos en móvil). Ahora el ancho
  // sale de `MeasuredBox` y la imagen se dibuja en píxeles.
  assert.ok(/<MeasuredBox height=\{h\}/.test(s), "el alto y el ancho salen de una medida real");
  assert.ok(/style=\{\{ height: h, width \}\}/.test(s), "la imagen se dibuja con píxeles");
  assert.ok(!/absoluteFillObject/.test(s), "el `absoluteFill` + porcentaje era el bug");
});

test("el campo del Umbral puede encoger en pantallas angostas", () => {
  const s = readFileSync(join(ROOT, "src/components/void/VoidExperience.tsx"), "utf8");
  const askInput = s.slice(s.indexOf("askInput: {"), s.indexOf("askBtn: {"));
  assert.ok(/minWidth: 0/.test(askInput), "sin minWidth:0 el botón PREGUNTAR se sale a 320px");
});

// --- Un solo chrome de navegación en web ------------------------------------

test("las tabs no montan la barra de React Navigation en web", () => {
  const web = fuenteDeEntrada("app/(tabs)/_layout.tsx", "web");
  const native = fuenteDeEntrada("app/(tabs)/_layout.tsx", "native");
  const nativeCode = native.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  const webBranch = web.indexOf("if (IS_WEB)");
  const webShell = web.indexOf("<WebAppShell", webBranch);
  const nativeTabsFallback = web.indexOf("<Tabs", webShell);
  assert.ok(webBranch >= 0, "la implementación web debe decidir su chrome explícitamente");
  assert.ok(webShell > webBranch, "en web debe salir por WebAppShell");
  assert.ok(/<Slot \/>/.test(web.slice(webShell, nativeTabsFallback)), "el shell web monta la ruta hija con Slot");
  assert.ok(
    nativeTabsFallback > webShell,
    "la rama WebAppShell debe cortar antes del fallback de React Navigation"
  );

  // La implementación nativa conserva el único chrome de cinco pestañas.
  assert.doesNotMatch(nativeCode, /WebAppShell|<Slot \/>/, "el bundle nativo no importa el shell web");
  assert.ok(/<Tabs/.test(nativeCode) && /OrbitaTabBar/.test(nativeCode), "la barra nativa debe seguir igual");
});

test("no existe app/perfil.tsx: /perfil sigue viniendo de (tabs)", () => {
  assert.throws(() => readFileSync(join(ROOT, "app/perfil.tsx"), "utf8"));
});
