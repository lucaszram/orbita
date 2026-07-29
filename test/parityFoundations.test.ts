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
  "app/carta.tsx",
  "app/empezar.tsx",
  "app/home.tsx",
  "app/transito.tsx",
  "app/valores.tsx"
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
