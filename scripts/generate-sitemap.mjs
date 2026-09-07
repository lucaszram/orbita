#!/usr/bin/env node
// Órbita — el sitemap del export web.
//
// Escribe `<dist>/sitemap.xml` con las seis rutas públicas indexables, cada una
// con la MISMA URL absoluta que su `<link rel="canonical">`. Las dos salen de
// `src/web/seo.mjs`, así que no pueden desincronizarse.
//
//   node scripts/generate-sitemap.mjs [ruta-a-dist] [--lastmod ISO] [--only-on-export]
//
// Sin dependencias: sólo `node:fs` y `node:path`.
//
// ## Por qué lo dispara `metro.config.js` y no un script de `package.json`
//
// El único comando de build es `expo export --platform web` (`pnpm build:web`
// en CI, `buildCommand` en Vercel) y el gate `pnpm check:web-export` exige que
// `dist/` ya tenga `sitemap.xml`. Enganchado al arranque del export —Metro
// carga su configuración justo después de que la CLI crea `dist/` vacío y
// justo antes de copiar `public/`— el archivo aparece en las dos rutas de
// build sin agregar un paso que alguien pueda olvidarse de correr.
//
// La decisión de "¿esto es un export?" es pura y está en `shouldWriteSitemap`.

import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { buildSitemapXml } from "../src/web/seo.mjs";

export const SITEMAP_FILENAME = "sitemap.xml";

/**
 * ¿Corresponde escribir el sitemap en esta corrida?
 *
 * `metro.config.js` se evalúa en TODA invocación de Metro —`expo start`,
 * `expo export`, `expo export:embed`—, así que la respuesta no puede ser "sí"
 * siempre: un `expo start` no tiene por qué tocar el `dist/` de un build
 * anterior. Se pregunta por el comando de la CLI, que es el dato honesto, y se
 * exige además que el directorio de salida exista: durante `expo export` la CLI
 * lo borra y lo vuelve a crear vacío ANTES de levantar Metro, así que existir es
 * la prueba de que ya estamos dentro de ese export.
 *
 * `export:embed` es el bundle nativo y no emite web: no entra.
 *
 * @param {{ command?: string, outputDirExists?: boolean }} run
 */
export function shouldWriteSitemap({ command, outputDirExists = false } = {}) {
  return command === "export" && outputDirExists;
}

/** Subcomando de la CLI de Expo en un `process.argv` (`expo export` → "export"). */
export function readCommand(argv = []) {
  return argv.slice(2).find((arg) => !arg.startsWith("-")) ?? null;
}

/**
 * Nombre de la variable por la que `metro.config.js` le pasa a este script el
 * `process.argv` de la CLI que lo invocó.
 *
 * El generador corre como PROCESO HIJO, así que su propio `process.argv` habla
 * del generador y no de Expo: sin este puente no habría forma de distinguir un
 * `expo export` de un `expo start`. Se manda el argv entero, sin interpretar,
 * para que la lectura viva en un solo lugar (`readCommand`).
 */
export const PARENT_ARGV_ENV = "ORBITA_BUILD_ARGV";

/**
 * El `process.argv` de la CLI que invocó a este script, si lo pasó.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function parentArgv(env = process.env) {
  try {
    const raw = JSON.parse(env[PARENT_ARGV_ENV] ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** Escribe el sitemap sí o sí. Devuelve la ruta escrita. */
export function writeSitemap(outputDir, { lastmod = new Date().toISOString() } = {}) {
  mkdirSync(outputDir, { recursive: true });
  const target = join(outputDir, SITEMAP_FILENAME);
  writeFileSync(target, buildSitemapXml(lastmod), "utf8");
  return target;
}

/**
 * Escribe el sitemap sólo si esta corrida es un `expo export`. Devuelve la ruta
 * escrita, o `null` si no correspondía.
 */
export function writeSitemapForExport(outputDir, { argv = parentArgv(), ...options } = {}) {
  const dir = resolve(outputDir);
  const outputDirExists = existsSync(dir) && statSync(dir).isDirectory();
  if (!shouldWriteSitemap({ command: readCommand(argv), outputDirExists })) return null;
  return writeSitemap(dir, options);
}

function main(argv) {
  const args = argv.slice(2);
  const lastmodIndex = args.indexOf("--lastmod");
  const lastmod = lastmodIndex >= 0 ? args[lastmodIndex + 1] : undefined;
  const onlyOnExport = args.includes("--only-on-export");
  const outputDir =
    args.find((arg, i) => !arg.startsWith("--") && !(lastmodIndex >= 0 && i === lastmodIndex + 1)) ??
    "dist";
  const options = lastmod ? { lastmod } : {};

  // `--only-on-export` es el modo que usa `metro.config.js`: mira el comando de
  // la CLI que está corriendo y calla si no es un `expo export`. A mano, sin esa
  // bandera, escribe siempre.
  const target = onlyOnExport
    ? writeSitemapForExport(outputDir, options)
    : writeSitemap(outputDir, options);
  if (target) console.log(`Órbita · sitemap escrito en \`${target}\``);
  return 0;
}

// Sólo corre como CLI; importado desde metro o desde los tests no ejecuta nada.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv));
}
