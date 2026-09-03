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
import { readdirSync, statSync } from "node:fs";
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

test("las cinco secciones de la barra web resuelven a un destino único", () => {
  // El orden es el de la barra (`src/components/web/web-nav.tsx`): Hoy,
  // Tránsitos, Vínculos, Umbral, Carta. Vínculo y Carta viven dentro de
  // `(tabs)`, así que su chrome lo monta el layout del grupo una sola vez; el
  // resto son rutas web de primer nivel, como quedaron en PR 1.
  assert.equal(destino("/home"), "home");
  assert.equal(destino("/transito"), "transito");
  assert.equal(destino("/vinculo"), "(tabs) > vinculo");
  assert.equal(destino("/umbral"), "umbral");
  assert.equal(destino("/carta"), "(tabs) > carta");
});

test("Perfil sale de la barra sin perder su URL ni su dueño", () => {
  // Perfil dejó de ser sección y pasó a entrarse desde Carta. Eso no mueve la
  // ruta: `/perfil` sigue siendo del grupo de pestañas, igual que antes.
  assert.equal(destino("/perfil"), "(tabs) > perfil");
  assert.equal(destino("/(tabs)/perfil"), destino("/perfil"));
});

test("Vínculo entra a la barra con un solo dueño, como la Carta", () => {
  // Misma propiedad que se rompía con `/carta`: los segmentos de grupo son
  // opcionales, así que un `app/vinculo.tsx` se disputaría la URL y montaría un
  // segundo shell. La sección nueva entra por la ruta que ya existe.
  assert.equal(destino("/(tabs)/vinculo"), destino("/vinculo"));
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
