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
 * Rutas que TODAVÍA apuntan a una pantalla web duplicada. Esta lista existe
 * para que la deuda quede visible y se achique: cada ruta sale de acá cuando
 * pasa a renderizar la pantalla canónica. Cuando quede vacía, el test pasa a
 * prohibir el patrón por completo.
 */
const PENDIENTES_DE_UNIFICAR = [
  // Último pendiente: el onboarding web de 12 pasos debe pasar al
  // `OnboardingFlow` canónico de 15. Cuando salga, la lista queda vacía.
  "app/empezar.tsx"
];

test("sólo las rutas ya conocidas importan una pantalla web duplicada", () => {
  const culpables = APP_FILES.filter((f) => {
    const s = readFileSync(f, "utf8");
    return /from "@\/components\/web\/orbita-(chart|values|home|transit|onboarding)"/.test(s);
  })
    .map((f) => f.replace(ROOT + "/", ""))
    .sort();
  const nuevas = culpables.filter((f) => !PENDIENTES_DE_UNIFICAR.includes(f));
  assert.deepEqual(nuevas, [], `ruta nueva apuntando a una pantalla web: ${nuevas.join(", ")}`);
  // La lista sólo puede achicarse: si una ruta ya se unificó, hay que sacarla.
  const resueltas = PENDIENTES_DE_UNIFICAR.filter((f) => !culpables.includes(f));
  assert.deepEqual(resueltas, [], `ya unificadas, sacar de PENDIENTES_DE_UNIFICAR: ${resueltas.join(", ")}`);
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
  const todos = [...APP_FILES, ...SRC_FILES];
  const culpables = todos.filter((f) => /LiveGate|urlForcedLive|live=1/.test(readFileSync(f, "utf8")))
    .map((f) => f.replace(ROOT + "/", ""))
    .filter((f) => !f.startsWith("src/domain/webSession.ts"));
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
