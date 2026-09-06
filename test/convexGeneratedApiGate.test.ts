/**
 * `convex/_generated/api.d.ts` tiene que enumerar TODOS los módulos de `convex/`.
 *
 * ## El defecto que cierra este gate
 *
 * El árbol trae `convex/lib/natalGeometry.ts` y `convex/lib/natalRevision.ts`,
 * y el artifact generado —escrito antes de que esos dos módulos existieran— no
 * los enumera. La documentación de las últimas pasadas afirmaba que no hacía
 * falta regenerar nada porque `ApiFromModules` deriva el `api` de los módulos.
 * **Eso es falso a nivel de módulo.** Lo que `ApiFromModules` deriva son las
 * FUNCIONES de los módulos que el archivo ya lista: `api.charts.loQueSea`
 * compila sin regenerar porque `charts` está en la tabla. Un módulo NUEVO no
 * aparece solo: `fullApi` es un tipo escrito por el codegen y sin su entrada no
 * existen `api.<módulo>` ni `internal.<módulo>`.
 *
 * Que hoy nadie referencie esos dos módulos por `api.*` es una coincidencia, no
 * una garantía: el artifact está desincronizado del código y la próxima función
 * pública que viva ahí no compilaría.
 *
 * ## Qué hace este gate
 *
 * Compara, sin red y sin ejecutar el CLI, los módulos elegibles de `convex/**`
 * contra los `import type * as …` y las entradas de `fullApi`. Las listas tienen
 * que coincidir exactamente:
 *
 * - un módulo del disco que no está en el artifact → **falta codegen**;
 * - una entrada del artifact que ya no existe en el disco → **binding muerto**;
 * - un alias que no apunta a la ruta de su clave → artifact inconsistente.
 *
 * La decisión es pura (`compararArtifact`) y se auto-prueba en las DOS
 * direcciones con artifacts sintéticos: uno completo tiene que dar verde y uno
 * al que le falta un módulo tiene que nombrarlo. Sin eso, un gate que sólo falla
 * hoy podría estar fallando por el motivo equivocado.
 *
 * ## Qué se excluye, y por qué exactamente eso
 *
 * Los criterios NO son una lista de nombres: son las reglas reales de
 * `entryPoints()` del bundler de Convex 1.42.1
 * (`node_modules/convex/dist/cjs/bundler/index.js`), replicadas acá:
 *
 * | Regla | Qué saca en este árbol |
 * |---|---|
 * | extensión no ejecutable | `content/tarotEditorial.generated.json`, `CHANGELOG.md` |
 * | `_generated/` | el propio artifact y sus vecinos |
 * | nombre que empieza con `.` o `#` | dotfiles y temporales de editor |
 * | `schema.ts` / `schema.js` | el schema, que se sube aparte |
 * | más de un punto en el nombre | `auth.config.ts`, cualquier `*.test.ts` |
 * | espacios en la ruta | nada, hoy |
 * | `.ts`/`.tsx` sin `import` ni `export` | nada, hoy |
 * | directorio con `convex.config.ts` | componentes anidados; no hay ninguno |
 *
 * Ningún nombre de módulo está escrito a mano acá: si mañana se agrega
 * `convex/lib/loQueSea.ts`, el gate lo exige igual.
 *
 * ## Quién lo puso en verde
 *
 * **Codex**, corriendo `pnpm convex:codegen --typecheck disable` el 2026-08-18.
 * El workflow del repo reserva ese comando al backend y Claude no lo ejecuta;
 * tampoco se edita `convex/_generated/**` a mano, que dejaría un artifact
 * inventado con pinta de generado. Mientras el codegen no corrió, este gate
 * falló a propósito y esa falla ERA el estado honesto del árbol; con el artifact
 * ya regenerado pasa 7/7. Sigue vivo: el próximo módulo que entre a `convex/**`
 * sin codegen lo vuelve a romper, que es todo el punto.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

import { ROOT } from "./moduleGraph";

const CONVEX = join(ROOT, "convex");
const ARTIFACT = join(CONVEX, "_generated", "api.d.ts");

/** Las extensiones que el bundler de Convex acepta como punto de entrada. */
const ENTRY_POINT_EXTENSIONS = [".js", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".jsx"];

/** Un archivo del árbol de `convex/`, con su ruta relativa en formato POSIX. */
type Archivo = { absoluto: string; relativo: string };

function caminar(dir: string): Archivo[] {
  // Un directorio con `convex.config.ts` es la definición de un componente
  // anidado: el bundler no lo recorre. Hoy no hay ninguno, pero la regla es
  // parte del criterio y no de la lista de nombres.
  if (dir !== CONVEX && readdirSync(dir).includes("convex.config.ts")) return [];

  const salida: Archivo[] = [];
  for (const entrada of readdirSync(dir)) {
    const absoluto = join(dir, entrada);
    if (statSync(absoluto).isDirectory()) {
      salida.push(...caminar(absoluto));
      continue;
    }
    salida.push({ absoluto, relativo: relative(CONVEX, absoluto).split(sep).join("/") });
  }
  return salida;
}

/** ¿El bundler de Convex tomaría este archivo como módulo? */
function esModulo(archivo: Archivo): boolean {
  const { relativo, absoluto } = archivo;
  const base = relativo.slice(relativo.lastIndexOf("/") + 1);
  const extension = base.slice(base.lastIndexOf("."));

  if (!ENTRY_POINT_EXTENSIONS.some((ext) => relativo.endsWith(ext))) return false;
  if (relativo.startsWith("_generated/")) return false;
  if (base.startsWith(".")) return false;
  if (base.startsWith("#")) return false;
  if (base === "schema.ts" || base === "schema.js") return false;
  if ((base.match(/\./g) ?? []).length > 1) return false;
  if (relativo.includes(" ")) return false;
  // Un `.ts` sin `import` ni `export` no es un módulo TypeScript válido, y el
  // bundler lo descarta con ese mismo criterio.
  if (extension === ".ts" || extension === ".tsx") {
    if (!/^\s{0,100}(import|export)/m.test(readFileSync(absoluto, "utf8"))) return false;
  }
  return true;
}

/** El nombre con el que el codegen enumera un módulo: la ruta sin extensión. */
const nombreDeModulo = (relativo: string) => relativo.slice(0, relativo.lastIndexOf("."));

/** `import type * as lib_users from "../lib/users.js";` → alias → módulo. */
function leerImports(source: string): Map<string, string> {
  const mapa = new Map<string, string>();
  const re = /^import type \* as ([A-Za-z0-9_$]+) from "\.\.\/(.+?)\.js";$/gm;
  for (const match of source.matchAll(re)) mapa.set(match[1], match[2]);
  return mapa;
}

/** Las entradas de `fullApi`: `"lib/users": typeof lib_users;` → clave → alias. */
function leerEntradas(source: string): Map<string, string> {
  const bloque = source.match(/declare const fullApi: ApiFromModules<\{([\s\S]*?)\}>;/);
  if (!bloque) return new Map();
  const mapa = new Map<string, string>();
  const re = /^\s+"?([^":\s]+)"?:\s*typeof\s+([A-Za-z0-9_$]+);$/gm;
  for (const match of bloque[1].matchAll(re)) mapa.set(match[1], match[2]);
  return mapa;
}

export type ComparacionArtifact = {
  /** Módulos del disco sin `import type * as …`. */
  sinImport: string[];
  /** Módulos del disco sin entrada en `fullApi`. */
  sinEntrada: string[];
  /** Imports que apuntan a un archivo que ya no existe. */
  importsMuertos: string[];
  /** Entradas de `fullApi` de módulos que ya no existen. */
  entradasMuertas: string[];
  /** Entradas cuyo alias no apunta a la ruta de su propia clave. */
  desajustes: string[];
  /** Cuántos módulos enumera el artifact (para que el gate no lea otra cosa). */
  enumerados: number;
};

/**
 * La decisión, pura: dado el conjunto de módulos del disco y el TEXTO del
 * artifact, ¿qué falta, qué sobra y qué no cierra?
 */
export function compararArtifact(modulos: string[], artifact: string): ComparacionArtifact {
  const imports = leerImports(artifact);
  const entradas = leerEntradas(artifact);
  const enDisco = new Set(modulos);
  const importados = new Set(imports.values());

  const desajustes: string[] = [];
  for (const [clave, alias] of entradas) {
    const modulo = imports.get(alias);
    if (modulo === undefined) {
      desajustes.push(`${clave}: usa el alias \`${alias}\`, que no se importa`);
      continue;
    }
    // El alias no siempre es el nombre del módulo —`void.ts` se importa como
    // `void_` porque `void` es palabra reservada—, así que lo que se compara es
    // a qué RUTA apunta ese alias.
    if (modulo !== clave) desajustes.push(`${clave}: su alias \`${alias}\` apunta a \`${modulo}\``);
  }

  return {
    sinImport: modulos.filter((modulo) => !importados.has(modulo)).sort(),
    sinEntrada: modulos.filter((modulo) => !entradas.has(modulo)).sort(),
    importsMuertos: [...importados].filter((modulo) => !enDisco.has(modulo)).sort(),
    entradasMuertas: [...entradas.keys()].filter((clave) => !enDisco.has(clave)).sort(),
    desajustes: desajustes.sort(),
    enumerados: entradas.size
  };
}

const modulosDelDisco = caminar(CONVEX)
  .filter(esModulo)
  .map((archivo) => nombreDeModulo(archivo.relativo))
  .sort();

const comparacion = compararArtifact(modulosDelDisco, readFileSync(ARTIFACT, "utf8"));

// ---------------------------------------------------------------------------
// 1 · el gate se prueba a sí mismo, en las dos direcciones
// ---------------------------------------------------------------------------

/** Un artifact sintético con la forma exacta que escribe el codegen. */
function artifactSintetico(modulos: Array<[string, string]>): string {
  const imports = modulos.map(([alias, modulo]) => `import type * as ${alias} from "../${modulo}.js";`);
  const entradas = modulos.map(([alias, modulo]) =>
    modulo.includes("/") ? `  "${modulo}": typeof ${alias};` : `  ${modulo}: typeof ${alias};`
  );
  return [
    ...imports,
    "",
    "declare const fullApi: ApiFromModules<{",
    ...entradas,
    "}>;",
    ""
  ].join("\n");
}

test("un artifact COMPLETO da verde", () => {
  const completo = artifactSintetico([
    ["charts", "charts"],
    ["lib_users", "lib/users"],
    ["void_", "void"]
  ]);
  assert.deepEqual(compararArtifact(["charts", "lib/users", "void"], completo), {
    sinImport: [],
    sinEntrada: [],
    importsMuertos: [],
    entradasMuertas: [],
    desajustes: [],
    enumerados: 3
  });
});

test("un artifact al que le falta un módulo lo NOMBRA, en las dos listas", () => {
  const incompleto = artifactSintetico([["charts", "charts"]]);
  const salida = compararArtifact(["charts", "lib/natalRevision"], incompleto);
  assert.deepEqual(salida.sinImport, ["lib/natalRevision"]);
  assert.deepEqual(salida.sinEntrada, ["lib/natalRevision"]);
});

test("un artifact que enumera un módulo borrado también se reporta", () => {
  const viejo = artifactSintetico([
    ["charts", "charts"],
    ["lib_borrado", "lib/borrado"]
  ]);
  const salida = compararArtifact(["charts"], viejo);
  assert.deepEqual(salida.importsMuertos, ["lib/borrado"]);
  assert.deepEqual(salida.entradasMuertas, ["lib/borrado"]);
});

test("una entrada cuyo alias apunta a otra ruta se reporta como desajuste", () => {
  const cruzado = [
    'import type * as charts from "../charts.js";',
    'import type * as lib_users from "../lib/users.js";',
    "",
    "declare const fullApi: ApiFromModules<{",
    "  charts: typeof lib_users;",
    '  "lib/users": typeof lib_users;',
    "}>;",
    ""
  ].join("\n");
  const salida = compararArtifact(["charts", "lib/users"], cruzado);
  assert.equal(salida.desajustes.length, 1);
  assert.match(salida.desajustes[0], /charts/);
});

// ---------------------------------------------------------------------------
// 2 · el árbol real
// ---------------------------------------------------------------------------

test("el gate lee el árbol real y un artifact con forma de codegen de Convex", () => {
  // Si esto fallara, el resto no significaría nada: el gate estaría leyendo
  // otra cosa.
  assert.ok(modulosDelDisco.length > 50, `módulos leídos: ${modulosDelDisco.length}`);
  assert.ok(comparacion.enumerados > 50, `entradas leídas: ${comparacion.enumerados}`);
  assert.ok(modulosDelDisco.includes("charts"), "`charts` es un módulo del disco");
  assert.ok(modulosDelDisco.includes("payments/stripeActions"), "los anidados también");
  assert.ok(!modulosDelDisco.includes("schema"), "`schema.ts` se sube aparte");
  assert.ok(!modulosDelDisco.includes("auth.config"), "`auth.config.ts` no es un entry point");
  assert.ok(
    !modulosDelDisco.some((modulo) => modulo.startsWith("_generated")),
    "el propio artifact no se enumera a sí mismo"
  );
});

test("cada módulo de `convex/**` está enumerado en `_generated/api.d.ts`", () => {
  assert.deepEqual(
    { sinImport: comparacion.sinImport, sinEntrada: comparacion.sinEntrada },
    { sinImport: [], sinEntrada: [] },
    [
      "El artifact generado está desincronizado del código.",
      "Falta correr el codegen real: `pnpm convex:codegen --typecheck disable`.",
      "Ese comando lo corre CODEX (el workflow del repo se lo reserva al backend);",
      "no se edita `convex/_generated/**` a mano."
    ].join(" ")
  );
});

test("`_generated/api.d.ts` no enumera módulos que ya no existen, y es consistente", () => {
  assert.deepEqual(
    {
      importsMuertos: comparacion.importsMuertos,
      entradasMuertas: comparacion.entradasMuertas,
      desajustes: comparacion.desajustes
    },
    { importsMuertos: [], entradasMuertas: [], desajustes: [] },
    "un binding que apunta a un módulo borrado también exige regenerar"
  );
});
