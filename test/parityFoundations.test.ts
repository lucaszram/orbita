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
  // 15 pasos: la secuencia V4.4 completa, con la cuenta en su lugar original
  // (`14 / Create Account`) y el cierre al final.
  assert.match(canonico, /const TOTAL = 15;/, "el flujo canónico debe tener 15 pasos");
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

// La Carta ya no tiene una ruta web aparte: `app/carta.tsx` y `app/(tabs)/carta.tsx`
// se disputaban la URL `/carta` (los segmentos de grupo son opcionales en
// expo-router) y montaban DOS shells distintos según por cuál entrabas. Quedó la
// del grupo, que es la que el shell web ya envuelve una sola vez desde el layout.
const CANONICAS = [
  ["src/screens/HomeScreen.tsx", "HomeScreen", ["app/home.tsx", "app/(tabs)/index.tsx"]],
  ["src/screens/CartaScreen.tsx", "CartaScreen", ["app/(tabs)/carta.tsx"]],
  ["src/screens/TransitosScreen.tsx", "TransitosScreen", ["app/transito.tsx", "app/(tabs)/transitos.tsx"]],
  ["src/screens/DiarioScreen.tsx", "DiarioScreen", ["app/diario.tsx", "app/reading/diario.tsx"]]
] as const;

test("web y nativo resuelven a la MISMA pantalla canónica", () => {
  for (const [modulo, nombre, rutas] of CANONICAS) {
    const canon = readFileSync(join(ROOT, modulo), "utf8");
    assert.ok(new RegExp(`export function ${nombre}`).test(canon), `${modulo} no exporta ${nombre}`);
    for (const ruta of rutas) {
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

// --- El contrato de navegación de la web ------------------------------------
// La web ya no copia la barra nativa. El nativo sigue siendo la autoridad de
// producto, pero su barra responde a otras restricciones: ahí Vínculo está
// parkeado (`href: null`) y Perfil es una pestaña. Las secciones web aprobadas
// son cinco, en este orden, y Perfil no es una de ellas.

/** Barra web aprobada: clave, etiqueta y destino, EN ORDEN. */
const SECCIONES_WEB = [
  { key: "inicio", label: "Hoy", href: "/home" },
  { key: "transitos", label: "Tránsitos", href: "/transito" },
  { key: "vinculo", label: "Vínculos", href: "/vinculo" },
  { key: "umbral", label: "Umbral", href: "/umbral" },
  { key: "carta", label: "Carta", href: "/carta" }
] as const;

/** Destino de la barra tal como está escrito: clave, etiqueta y URL. */
type DestinoDeclarado = { key: string; label: string; href: string };

/**
 * El array `items` de la barra, recortado contando llaves y corchetes. La
 * entrada Carta anida su propia metadata (`destinations`), así que cortar en el
 * primer `];` mezclaría niveles. Los comentarios se sacan antes: una sección
 * comentada no es una sección.
 */
function arrayDeItems(): string {
  const nav = readFileSync(join(ROOT, "src/components/web/web-nav.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const desde = nav.indexOf("const items:");
  assert.ok(desde !== -1, "la barra web tiene que declarar sus items en `const items`");
  // Desde el `=`, no desde el `const`: la anotación de tipo puede traer sus
  // propios corchetes (`NavSection[]`) y el array empieza recién al asignarse.
  const igual = nav.indexOf("=", desde);
  assert.ok(igual !== -1, "`items` tiene que asignarse un array literal");
  const abre = nav.indexOf("[", igual);
  assert.ok(abre !== -1, "`items` tiene que ser un array literal");
  let nivel = 0;
  for (let i = abre; i < nav.length; i += 1) {
    const c = nav[i];
    if (c === "[" || c === "{") nivel += 1;
    else if (c === "]" || c === "}") {
      nivel -= 1;
      if (nivel === 0) return nav.slice(abre, i + 1);
    }
  }
  return assert.fail("el array `items` no cierra");
}

/**
 * Los objetos de PRIMER nivel del array: las secciones de la barra. Lo que
 * cuelga de una sección (los destinos que viven adentro) queda un nivel más
 * abajo y no se cuenta acá — por eso Perfil puede estar declarado sin ser una
 * sexta sección.
 */
function seccionesDeclaradas(): string[] {
  const array = arrayDeItems();
  const fuera: string[] = [];
  let nivel = 0;
  let inicio = -1;
  for (let i = 0; i < array.length; i += 1) {
    const c = array[i];
    if (c === "{") {
      if (nivel === 0) inicio = i;
      nivel += 1;
    } else if (c === "}") {
      nivel -= 1;
      if (nivel === 0) fuera.push(array.slice(inicio, i + 1));
    }
  }
  return fuera;
}

/** Los campos propios de una sección, sin la metadata anidada (que es otro nivel). */
function camposDe(objeto: string): DestinoDeclarado {
  const anidado = objeto.indexOf("[");
  const propio = anidado === -1 ? objeto : objeto.slice(0, anidado);
  const leer = (campo: string) => new RegExp(`${campo}: "([^"]+)"`).exec(propio)?.[1] ?? "";
  const campos = { key: leer("key"), label: leer("label"), href: leer("href") };
  assert.ok(campos.key && campos.label && campos.href, `una sección de la barra está incompleta: ${propio.trim()}`);
  return campos;
}

/** Los items TOP-LEVEL de la barra: las secciones que se dibujan. */
function itemsDeLaBarra(): DestinoDeclarado[] {
  return seccionesDeclaradas().map(camposDe);
}

/** Los destinos que la barra declara DENTRO de una sección. */
function destinosDe(clave: string): DestinoDeclarado[] {
  const objeto = seccionesDeclaradas().find((o) => camposDe(o).key === clave) ?? "";
  assert.notEqual(objeto, "", `la barra no declara la sección "${clave}"`);
  const anidado = objeto.indexOf("[");
  if (anidado === -1) return [];
  assert.match(objeto, /destinations: \[/, "la metadata anidada se declara en `destinations`");
  return [...objeto.slice(anidado).matchAll(/\{ key: "([\w-]+)", label: "([^"]+)", href: "([^"]+)" \}/g)].map((m) => ({
    key: m[1],
    label: m[2],
    href: m[3]
  }));
}

/** Las claves que declara `NavKey`: sin una clave, una sección no puede marcarse. */
function clavesDeNavKey(): Set<string> {
  const nav = readFileSync(join(ROOT, "src/components/web/web-nav.tsx"), "utf8");
  return new Set([...(/export type NavKey =([^;]+);/.exec(nav)?.[1] ?? "").matchAll(/"([\w-]+)"/g)].map((m) => m[1]));
}

test("la barra web ofrece exactamente las cinco secciones aprobadas, en orden", () => {
  assert.deepEqual(
    itemsDeLaBarra(),
    SECCIONES_WEB.map((s) => ({ key: s.key, label: s.label, href: s.href })),
    "las secciones web, sus etiquetas y sus destinos son un contrato de producto"
  );
});

test("cada sección de la barra tiene una clave de NavKey y ninguna se repite", () => {
  const declaradas = clavesDeNavKey();
  const items = itemsDeLaBarra();
  // También los destinos anidados: son NavKey porque la barra marca la sección
  // que los contiene cuando el activo es uno de ellos.
  for (const it of [...items, ...items.flatMap((i) => destinosDe(i.key))]) {
    assert.ok(declaradas.has(it.key), `la clave "${it.key}" no está en NavKey: el activo no podría marcarse`);
  }
  assert.equal(new Set(items.map((i) => i.key)).size, items.length, "dos secciones no pueden compartir clave");
  assert.equal(new Set(items.map((i) => i.href)).size, items.length, "dos secciones no pueden compartir destino");
});

test("Perfil vive DENTRO de Carta: la barra lo declara como destino anidado", () => {
  // El modelo de la barra tiene que decirlo, no sólo el resolvedor de rutas:
  // Carta declara Perfil con su URL de siempre. Es lo que sostiene que Perfil
  // no se perdió al salir de la barra.
  assert.deepEqual(
    destinosDe("carta"),
    [{ key: "perfil", label: "Perfil", href: "/perfil" }],
    "Carta tiene que contener el destino Perfil, con su etiqueta y su /perfil"
  );
  // Y sin volverse una sexta sección: los destinos anidados no se dibujan.
  assert.equal(itemsDeLaBarra().length, 5, "la barra sigue teniendo cinco secciones");
  assert.ok(clavesDeNavKey().has("perfil"), "Perfil conserva su clave: NavKey suma vinculo, no quita perfil");

  // Y la usa de verdad, en las dos barras (escritorio y móvil): el activo se
  // resuelve por sección o por destino anidado, y lo que vive adentro se
  // anuncia. Declarada y sin usar sería un comentario con tipos.
  const nav = readFileSync(join(ROOT, "src/components/web/web-nav.tsx"), "utf8");
  assert.match(
    nav,
    /function esActiva\([\s\S]*?destinations[\s\S]*?\.some\(\(d\) => d\.key === active\)/,
    "el activo de una sección se resuelve también por sus destinos anidados"
  );
  assert.equal(
    [...nav.matchAll(/const on = esActiva\(it, active\)/g)].length,
    2,
    "la barra de escritorio y la inferior resuelven el activo con la misma regla"
  );
  assert.equal(
    [...nav.matchAll(/accessibilityLabel=\{nombreAccesible\(it\)\}/g)].length,
    2,
    "las dos barras anuncian lo que la sección contiene"
  );
});

test("Perfil ya no es sección de la barra: se entra desde la Carta y sólo en web", () => {
  // Perfil no desaparece del producto: deja la barra y pasa a vivir dentro de
  // Carta. La URL no cambia y su dueño tampoco (ver routeOwnership).
  const items = itemsDeLaBarra();
  assert.ok(!items.some((i) => i.href === "/perfil" || i.key === "perfil"), "Perfil dejó de ser sección web");

  const carta = readFileSync(join(ROOT, "src/screens/CartaScreen.tsx"), "utf8");
  assert.match(carta, /const IS_WEB = Platform\.OS === "web";/, "la condición de plataforma es explícita");
  assert.match(
    carta,
    /\{IS_WEB \? <LinkRow label="[^"]+" onPress=\{\(\) => router\.push\("\/perfil"\)\} \/> : null\}/,
    "el enlace al Perfil va condicionado a web: en nativo Perfil sigue siendo pestaña"
  );

  // Y la barra marca Carta cuando la ruta es /perfil, para que la sección
  // activa no quede en ninguna parte.
  const tabs = readFileSync(join(ROOT, "app/(tabs)/_layout.tsx"), "utf8");
  const resolver = tabs.slice(tabs.indexOf("function navKeyForPath"), tabs.indexOf("export default function TabsLayout"));
  assert.match(resolver, /pathname\.startsWith\("\/perfil"\)\) return "carta"/, "/perfil tiene que marcar Carta");
  assert.match(resolver, /pathname\.startsWith\("\/vinculo"\)\) return "vinculo"/, "/vinculo tiene que marcar Vínculos");
});

test("las pestañas NATIVAS no se tocan: siguen siendo Inicio · Tránsitos · Umbral · Perfil", () => {
  // El contrato web es propio, pero no puede pagarse cambiando el nativo, que
  // es la autoridad de producto (Build 30).
  const tabs = readFileSync(join(ROOT, "app/(tabs)/_layout.tsx"), "utf8");
  const seccionesNativas = [...tabs.matchAll(/<Tabs\.Screen name="\w+" options=\{\{ title: "([^"]+)" \}\} \/>/g)].map(
    (m) => m[1]
  );
  assert.deepEqual(seccionesNativas, ["Inicio", "Tránsitos", "Umbral", "Perfil"]);
  // Carta y Vínculo siguen fuera de la barra nativa, con ruta pero sin pestaña.
  for (const fuera of ["carta", "vinculo"]) {
    assert.match(
      tabs,
      new RegExp(`<Tabs\\.Screen name="${fuera}" options=\\{\\{ href: null \\}\\} />`),
      `${fuera} tiene que seguir parkeado en la barra nativa`
    );
  }
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
  const layout = readFileSync(join(ROOT, "app/(tabs)/_layout.tsx"), "utf8");
  assert.ok(/if \(IS_WEB\)/.test(layout), "en web debe salir por WebAppShell");
  assert.ok(/WebAppShell/.test(layout) && /<Slot \/>/.test(layout));
  // El nativo no se toca.
  assert.ok(/<Tabs/.test(layout) && /OrbitaTabBar/.test(layout), "la barra nativa debe seguir igual");
});

test("no existe app/perfil.tsx: /perfil sigue viniendo de (tabs)", () => {
  assert.throws(() => readFileSync(join(ROOT, "app/perfil.tsx"), "utf8"));
});
