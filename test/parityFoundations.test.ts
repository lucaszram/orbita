import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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

test("web y nativo montan el MISMO onboarding canónico", () => {
  const canonico = readFileSync(join(ROOT, "src/onboarding/OnboardingFlow.tsx"), "utf8");
  // 14 pasos desde que el alta salió del flujo: auth es la puerta anterior y no
  // cuenta en el progreso del onboarding.
  assert.match(canonico, /const TOTAL = 14;/, "el flujo canónico debe tener 14 pasos");
  // Las dos rutas llegan al flujo canónico A TRAVÉS del gate compartido, que es
  // el que impide que una cuenta con datos natales vuelva al alta.
  const gate = readFileSync(join(ROOT, "src/onboarding/OnboardingGate.tsx"), "utf8");
  assert.ok(/@\/onboarding\/OnboardingFlow/.test(gate), "el gate debe montar el flujo canónico");
  for (const ruta of ["app/empezar.tsx", "app/onboarding.tsx"]) {
    const s = readFileSync(join(ROOT, ruta), "utf8");
    assert.ok(/OnboardingGate/.test(s), `${ruta} no pasa por el gate compartido`);
  }
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
    join(ROOT, "app/(tabs)/perfil.tsx"),
    join(ROOT, "app/(tabs)/index.tsx")
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

const CANONICAS = [
  ["src/screens/HomeScreen.tsx", "HomeScreen", "app/home.tsx", "app/(tabs)/index.tsx"],
  ["src/screens/CartaScreen.tsx", "CartaScreen", "app/carta.tsx", "app/(tabs)/carta.tsx"],
  ["src/screens/TransitosScreen.tsx", "TransitosScreen", "app/transito.tsx", "app/(tabs)/transitos.tsx"],
  ["src/screens/DiarioScreen.tsx", "DiarioScreen", "app/diario.tsx", "app/reading/diario.tsx"]
] as const;

test("web y nativo resuelven a la MISMA pantalla canónica", () => {
  for (const [modulo, nombre, rutaWeb, rutaNativa] of CANONICAS) {
    const canon = readFileSync(join(ROOT, modulo), "utf8");
    assert.ok(new RegExp(`export function ${nombre}`).test(canon), `${modulo} no exporta ${nombre}`);
    for (const ruta of [rutaWeb, rutaNativa]) {
      const s = readFileSync(join(ROOT, ruta), "utf8");
      assert.ok(
        s.includes(`@/screens/${nombre}`),
        `${ruta} no renderiza la pantalla canónica ${nombre}`
      );
    }
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

test("la navegación web tiene la misma arquitectura que las pestañas nativas", () => {
  const nav = readFileSync(join(ROOT, "src/components/web/web-nav.tsx"), "utf8");
  const seccionesWeb = [...nav.matchAll(/\{ key: "(\w+)", label: "([^"]+)", href/g)].map((m) => m[2]);
  const tabs = readFileSync(join(ROOT, "app/(tabs)/_layout.tsx"), "utf8");
  const seccionesNativas = [...tabs.matchAll(/<Tabs\.Screen name="\w+" options=\{\{ title: "([^"]+)" \}\} \/>/g)].map((m) => m[1]);
  assert.deepEqual(seccionesWeb, seccionesNativas, "web y nativo deben ofrecer las mismas secciones, en el mismo orden");
});

test("el Umbral es una sección de la web, no una ruta olvidada", () => {
  const umbral = readFileSync(join(ROOT, "app/umbral.tsx"), "utf8");
  assert.ok(/VoidExperience/.test(umbral), "/umbral debe montar la experiencia canónica");
  const nav = readFileSync(join(ROOT, "src/components/web/web-nav.tsx"), "utf8");
  assert.ok(/href: "\/umbral"/.test(nav));
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
  const login = readFileSync(join(ROOT, "app/iniciar-sesion.tsx"), "utf8");
  assert.ok(!/router\.replace\("\/\(tabs\)"\)/.test(login), "en web /(tabs) resuelve a la landing");
  assert.ok(/HOME_ROUTE/.test(login), "debe usar el destino por plataforma");
  const rutas = readFileSync(join(ROOT, "src/domain/appRoutes.ts"), "utf8");
  assert.match(rutas, /HOME_ROUTE = IS_WEB \? "\/home" : "\/\(tabs\)"/);
});

test("la landing sólo se renderiza sin sesión, y lo decide el resolver único", () => {
  const index = readFileSync(join(ROOT, "app/index.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const web = index.slice(index.indexOf("if (IS_WEB)"));
  const hastaLanding = web.slice(0, web.indexOf("<OrbitaLanding />"));
  assert.ok(
    /AccountGate surface="landing"/.test(hastaLanding),
    "la landing debe pasar por el gate compartido, no por un guard propio"
  );
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

test("el hero full-bleed recorta su asset decorativo", () => {
  const s = readFileSync(join(ROOT, "src/components/orbita/ImmersiveHero.tsx"), "utf8");
  const wrap = s.slice(s.indexOf("wrap: {"), s.indexOf("img: {"));
  assert.ok(/overflow: "hidden"/.test(wrap), "sin recorte, la imagen de 1024px estira la página");
  assert.ok(/width: "100%"/.test(wrap), "el contenedor debe quedar acotado al viewport");
});

test("el campo del Umbral puede encoger en pantallas angostas", () => {
  const s = readFileSync(join(ROOT, "src/components/void/VoidExperience.tsx"), "utf8");
  const askInput = s.slice(s.indexOf("askInput: {"), s.indexOf("askBtn: {"));
  assert.ok(/minWidth: 0/.test(askInput), "sin minWidth:0 el botón PREGUNTAR se sale a 320px");
});

// --- Un solo chrome de navegación en web ------------------------------------

test("las tabs no montan la barra de React Navigation en web", () => {
  const layout = readFileSync(join(ROOT, "app/(tabs)/_layout.tsx"), "utf8");
  assert.ok(/if \(IS_WEB\)/.test(layout), "en web debe salir por WebAppShell");
  assert.ok(/WebAppShell/.test(layout) && /<Slot \/>/.test(layout));
  // El nativo no se toca.
  assert.ok(/<Tabs/.test(layout) && /OrbitaTabBar/.test(layout), "la barra nativa debe seguir igual");
});

test("no existe app/perfil.tsx: /perfil sigue viniendo de (tabs)", () => {
  assert.throws(() => readFileSync(join(ROOT, "app/perfil.tsx"), "utf8"));
});
