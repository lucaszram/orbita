/**
 * Un solo dueño por destino — con el resolvedor REAL de expo-router.
 *
 * El problema concreto: los segmentos de grupo son OPCIONALES en la URL, así
 * que `app/carta.tsx` y `app/(tabs)/carta.tsx` se disputaban `/carta`. Cuál
 * ganaba lo decidía el desempate interno del router, no una decisión de
 * producto, y cada uno montaba un shell distinto (`app/carta.tsx` envolvía en
 * `WebAppShell` a mano; el grupo ya viene envuelto por su layout). Entrar por
 * una URL o por la otra daba dos árboles de chrome diferentes para la MISMA
 * pantalla.
 *
 * No se afirma "el archivo X no existe": se le pregunta al router a dónde
 * resuelve cada URL y se exige que el destino sea único y esté dentro del
 * grupo que ya aporta el shell.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import Module from "node:module";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { ROOT } from "./moduleGraph";

// El resolvedor de rutas es código de bundler: no toca react-native ni
// react-navigation en runtime, pero los importa. Se stubean para poder correrlo
// en Node — lo que se ejercita es la resolución, que es pura.
const cargar = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (req: string, ...rest: unknown[]) {
  if (req === "react-native" || req.startsWith("react-native/")) return {};
  if (req === "@react-navigation/native") return { validatePathConfig() {} };
  return (cargar as (...a: unknown[]) => unknown).call(this, req, ...rest);
};

const require_ = createRequire(join(ROOT, "package.json"));
const { getRoutes } = require_("expo-router/build/getRoutesCore.js");
const { getReactNavigationConfig } = require_("expo-router/build/getReactNavigationConfig.js");
const { getStateFromPath } = require_("expo-router/build/fork/getStateFromPath.js");

function archivosDeRuta(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name)) out.push("./" + relative(join(ROOT, "app"), p));
    }
  })(join(ROOT, "app"));
  return out;
}

/** El mismo `require.context` que arma expo-router al empaquetar. */
function contexto() {
  const files = archivosDeRuta();
  const ctx = (() => ({ default: () => null })) as unknown as {
    (id: string): unknown;
    keys(): string[];
    resolve(k: string): string;
    id: string;
  };
  ctx.keys = () => files;
  ctx.resolve = (k: string) => k;
  ctx.id = "app";
  return ctx;
}

const config = getReactNavigationConfig(
  getRoutes(contexto(), { platform: "web", ignoreEntryPoints: true, ignoreRequireErrors: true }),
  false
);

/** Cadena de pantallas que el router monta para una URL ("(tabs) > carta"). */
function destino(url: string): string | null {
  const state = getStateFromPath(url, config);
  if (!state) return null;
  const names: string[] = [];
  let s: { routes?: Array<{ name: string; state?: unknown }> } | undefined = state;
  while (s?.routes?.length) {
    const r = s.routes[s.routes.length - 1];
    names.push(r.name);
    s = r.state as typeof s;
  }
  return names.join(" > ");
}

// --- El conflicto de la Carta -----------------------------------------------

test("/carta tiene un solo dueño y vive dentro del grupo de pestañas", () => {
  // Dentro de `(tabs)` el shell web lo monta el layout UNA vez; no hay una
  // segunda ruta que lo vuelva a montar por su cuenta.
  assert.equal(destino("/carta"), "(tabs) > carta");
});

test("la URL con grupo y la URL sin grupo son el MISMO destino", () => {
  // Esta es la propiedad que se rompía: dos árboles distintos para una pantalla.
  assert.equal(destino("/(tabs)/carta"), destino("/carta"));
});

test("las secciones de la navegación web siguen resolviendo donde PR 1 las dejó", () => {
  assert.equal(destino("/home"), "home");
  assert.equal(destino("/transito"), "transito");
  assert.equal(destino("/umbral"), "(tabs) > umbral > index");
  assert.equal(destino("/perfil"), "(tabs) > perfil > index");
});

test("las cinco pestañas canónicas resuelven a la raíz de sus cinco stacks", () => {
  const destinos = new Map([
    ["/hoy", "(tabs) > hoy > index"],
    ["/transitos", "(tabs) > transitos > index"],
    ["/vinculos", "(tabs) > vinculos > index"],
    ["/umbral", "(tabs) > umbral > index"],
    ["/perfil", "(tabs) > perfil > index"]
  ]);

  for (const [url, esperado] of destinos) assert.equal(destino(url), esperado, url);
});

test("Carta y sus tres detalles tienen destinos únicos dentro del stack de Perfil", () => {
  const destinos = new Map([
    ["/perfil/carta", "(tabs) > perfil > carta"],
    ["/perfil/carta/completa", "(tabs) > perfil > carta/completa"],
    ["/perfil/carta/tipo-lunar", "(tabs) > perfil > carta/tipo-lunar"],
    ["/perfil/carta/mapa-elemental", "(tabs) > perfil > carta/mapa-elemental"]
  ]);

  for (const [url, esperado] of destinos) assert.equal(destino(url), esperado, url);
});

test("Tu momento y cada arco tienen destinos no ambiguos dentro del stack de Tránsitos", () => {
  assert.equal(destino("/transitos/momento"), "(tabs) > transitos > momento");
  assert.equal(destino("/transitos/arco/foo"), "(tabs) > transitos > arco/[arcId]");

  // Un dinámico suelto (`transitos/[arcId]`) también aceptaría `momento` y
  // cualquier futura vista de un segmento. El prefijo `arco/` hace explícita
  // la diferencia entre una vista del tab y el detalle de un evento.
  assert.equal(
    existsSync(join(ROOT, "app/(tabs)/transitos/[arcId].tsx")),
    false,
    "el detalle legado transitos/[arcId] debe retirarse: todos los arcos viven en transitos/arco/[arcId]"
  );
});

test("los detalles de capa de Tránsitos resuelven dentro de su stack, sin disputar otra vista", () => {
  // QA22-027: un detalle abierto desde `Tu momento` tiene que apilarse en ESTE
  // stack, o "volver" no puede devolver a `Tu momento`. El prefijo `capa/` es lo
  // que evita que un dinámico suelto se quede además con `/transitos/momento`.
  assert.equal(destino("/transitos/capa/cumpleluna"), "(tabs) > transitos > capa/[layer]");
  assert.equal(destino("/transitos/capa/luna"), "(tabs) > transitos > capa/[layer]");
  // Y los dos detalles que nacen en esta sección (QA22-024), con el slug sin
  // acentos con el que viajan en la URL.
  assert.equal(destino("/transitos/capa/estacion"), "(tabs) > transitos > capa/[layer]");
  assert.equal(destino("/transitos/capa/ano"), "(tabs) > transitos > capa/[layer]");

  // Y las rutas que ya existían siguen resolviendo donde estaban.
  assert.equal(destino("/transitos/momento"), "(tabs) > transitos > momento");
  assert.equal(destino("/transitos"), "(tabs) > transitos > index");

  // La misma pantalla sigue teniendo su ruta en el stack de Hoy: no se movió el
  // detalle, se le agregó el lugar del que cuelga cuando lo abre la otra sección.
  assert.equal(destino("/hoy/cumpleluna"), "(tabs) > hoy > cumpleluna");
  assert.equal(destino("/hoy/luna"), "(tabs) > hoy > luna");
});

test("/vacio conserva el deep link histórico y redirige a la ruta canónica existente", () => {
  assert.equal(destino("/vacio"), "(tabs) > vacio");

  const alias = readFileSync(join(ROOT, "app/(tabs)/vacio.tsx"), "utf8");
  const target = alias.match(/<Redirect\s+href="([^"]+)"\s*\/>/)?.[1];
  assert.equal(target, "/umbral", "el alias histórico debe apuntar al nombre de producto actual");
  assert.equal(destino(target), "(tabs) > umbral > index", "el destino del alias debe existir en el router");
});

test("la entrada `/` sigue siendo el resolvedor de destino, no una pestaña", () => {
  // La entrada auth-first vive en `app/index.tsx`. Si una pestaña le ganara la
  // URL, una cuenta sin sesión entraría directo al producto.
  assert.equal(destino("/"), "index");
});

test("los alias legados siguen llegando a algún lado", () => {
  for (const url of ["/login", "/profile", "/personalidad", "/valores", "/diario", "/empezar", "/crear-cuenta"]) {
    assert.ok(destino(url), `${url} quedó sin destino`);
  }
});

// --- Un solo shell por ruta -------------------------------------------------

test("ninguna ruta del grupo de pestañas monta el shell web por su cuenta", () => {
  // El layout de `(tabs)` ya envuelve todo en `WebAppShell`. Una ruta del grupo
  // que lo montara otra vez daría dos navegaciones y dos colchones inferiores.
  const dentroDelGrupo = archivosDeRuta().filter((f) => f.startsWith("./(tabs)/") && !f.endsWith("_layout.tsx"));
  assert.ok(dentroDelGrupo.length > 0, "no se encontraron rutas del grupo");
  for (const f of dentroDelGrupo) {
    const src = require("node:fs").readFileSync(join(ROOT, "app", f.slice(2)), "utf8") as string;
    assert.doesNotMatch(src, /WebAppShell/, `${f} vuelve a montar el shell que ya pone el layout`);
  }
});
