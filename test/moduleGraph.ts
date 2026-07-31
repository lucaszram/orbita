/**
 * Grafo de imports del repo — la misma pregunta que se hace el bundler.
 *
 * Existe porque varias garantías de este PR son de ALCANCE, no de texto: "¿desde
 * el Perfil se puede llegar a un mock de carta?", "¿esta pantalla queda adentro
 * del lienzo?". Buscar un string en un archivo no las contesta (el mock se
 * alcanzaba a TRES saltos de distancia: perfil → appData → chartMock). Recorrer
 * el grafo sí.
 *
 * Es un recorrido estático de los `import ... from "…"` reales, con las mismas
 * reglas de resolución que usa el proyecto: alias `@/` → `src/`, extensiones
 * `.ts/.tsx/.js/.jsx`, `index.*` para directorios y la variante `.web.tsx` que
 * Metro prefiere al empaquetar para web.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "..");

const EXTS = [".web.tsx", ".web.ts", ".tsx", ".ts", ".jsx", ".js"];

/** Módulos del repo (no `node_modules`) que un import puede señalar. */
function resolveModule(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // paquete externo: fuera del grafo del repo

  for (const ext of EXTS) {
    if (existsSync(base + ext)) return base + ext;
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const ext of EXTS) {
      if (existsSync(join(base, "index" + ext))) return join(base, "index" + ext);
    }
  }
  // `require("../assets/…")` y compañía: existe, pero no es un módulo del grafo.
  return existsSync(base) ? base : null;
}

const IMPORT_RE =
  /(?:^|[\s;{(])(?:import|export)\s+(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']|\brequire\(\s*["']([^"']+)["']\s*\)|\bimport\(\s*["']([^"']+)["']\s*\)/g;

/** Especificadores importados por un archivo (sin comentarios). */
export function importsOf(file: string): string[] {
  const src = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const out: string[] = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (spec) out.push(spec);
  }
  return out;
}

/**
 * Todos los módulos del repo alcanzables desde `entries`, ellos incluidos.
 * Devuelve rutas relativas a la raíz para que los mensajes de fallo se lean.
 */
export function reachableFrom(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const queue = entries.map((e) => (e.startsWith("/") ? e : join(ROOT, e)));
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    if (!/\.(t|j)sx?$/.test(file)) continue;
    for (const spec of importsOf(file)) {
      const target = resolveModule(file, spec);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return new Set([...seen].map((f) => relative(ROOT, f)));
}

/** ¿`needle` es alcanzable desde `entry`? Con el camino, para poder explicarlo. */
export function pathTo(entry: string, predicate: (rel: string) => boolean): string[] | null {
  const start = join(ROOT, entry);
  const prev = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const file = queue.shift()!;
    const rel = relative(ROOT, file);
    if (file !== start && predicate(rel)) {
      const chain: string[] = [];
      for (let cur: string | null = file; cur; cur = prev.get(cur) ?? null) chain.unshift(relative(ROOT, cur));
      return chain;
    }
    if (!/\.(t|j)sx?$/.test(file) || !existsSync(file)) continue;
    for (const spec of importsOf(file)) {
      const target = resolveModule(file, spec);
      if (target && !prev.has(target)) {
        prev.set(target, file);
        queue.push(target);
      }
    }
  }
  return null;
}
