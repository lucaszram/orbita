/**
 * `.easignore` — el gate de lo que NO puede viajar a un build de EAS.
 *
 * ## Por qué existe
 *
 * EAS empaqueta el proyecto y lo sube a un servidor de builds. Para decidir qué
 * entra usa `.gitignore`… **salvo que exista `.easignore`, en cuyo caso
 * `.gitignore` deja de leerse por completo**. Este repo tiene `.easignore`, así
 * que todo lo que sólo estaba excluido por `.gitignore` volvía a entrar sin que
 * nadie lo dijera:
 *
 * - `.local/` — cientos de megas de evidencia de auditoría: capturas, logs,
 *   comparaciones y herramientas que existen sólo en esta máquina;
 * - `dist-ios/` y `dist-android/` — los exports temporales que las auditorías
 *   generan para inspeccionar el bundle y retiran en la misma corrida. Si una
 *   corrida se cortaba a la mitad, el tarball del build se los llevaba.
 *
 * Ninguno de los tres es producto. Ninguno de los tres se borra: viven fuera de
 * git a propósito. Lo único que cambia es que ya no suben a ningún lado.
 *
 * ## Por qué se prueba con el motor de git y no con una expresión regular
 *
 * `.easignore` usa la sintaxis de `.gitignore`, con todo lo que eso implica:
 * precedencia por orden, negaciones (`!.env.example`), barras finales que sólo
 * matchean directorios, patrones anclados y no anclados. Reimplementar eso acá
 * sería probar la reimplementación, no el archivo.
 *
 * Así que se le pregunta al motor real: un repositorio vacío y descartable bajo
 * el temporal del sistema, con `core.excludesFile` apuntando al `.easignore` DE
 * ESTE repo. Es el mismo algoritmo que aplica EAS, sobre el archivo verdadero, y
 * sin tocar el árbol de trabajo: `--no-index` no necesita que las rutas existan.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { ROOT } from "./moduleGraph";

const EASIGNORE = join(ROOT, ".easignore");

/**
 * ¿El motor de gitignore excluye estas rutas con las reglas de `.easignore`?
 *
 * Devuelve un mapa `ruta → excluida`. El repositorio de prueba se crea y se
 * borra acá adentro; nunca se corre nada contra el worktree real.
 */
function excluidasPorEasignore(rutas: readonly string[]): Map<string, boolean> {
  const banco = mkdtempSync(join(tmpdir(), "orbita-easignore-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: banco, stdio: "ignore" });
    const veredicto = new Map<string, boolean>();
    for (const ruta of rutas) {
      let excluida = false;
      try {
        execFileSync(
          "git",
          ["-c", `core.excludesFile=${EASIGNORE}`, "check-ignore", "--no-index", "-q", "--", ruta],
          { cwd: banco, stdio: "ignore" }
        );
        excluida = true;
      } catch {
        // `check-ignore` sale 1 cuando la ruta NO está ignorada: es una
        // respuesta, no un error.
        excluida = false;
      }
      veredicto.set(ruta, excluida);
    }
    return veredicto;
  } finally {
    rmSync(banco, { recursive: true, force: true });
  }
}

test("el motor de gitignore responde: el banco de pruebas sirve para decidir algo", () => {
  // Control de sanidad en las dos direcciones. Sin esto, un `check-ignore` que
  // siempre fallara haría pasar el gate entero diciendo que nada se excluye… o
  // uno que siempre saliera 0 lo haría pasar diciendo que todo se excluye.
  const veredicto = excluidasPorEasignore(["node_modules/react/index.js", "package.json"]);
  assert.equal(veredicto.get("node_modules/react/index.js"), true, "`node_modules/` sí está en el archivo");
  assert.equal(veredicto.get("package.json"), false, "y `package.json` no puede estar excluido");
});

test("`.easignore` excluye la evidencia local y los exports temporales", () => {
  // Las tres rutas exactas que el parser real incluía antes de esta pasada.
  const rutas = [
    ".local/audit.bin",
    ".local/audits/native-v492-recertification-2026-08-17/README.md",
    "dist-ios/bundle.hbc",
    "dist-ios/_expo/static/js/ios/index.hbc",
    "dist-android/bundle.hbc",
    "dist-android/_expo/static/js/android/index.hbc"
  ];
  const veredicto = excluidasPorEasignore(rutas);
  for (const ruta of rutas) {
    assert.equal(veredicto.get(ruta), true, `${ruta} no puede viajar a un build de EAS`);
  }
});

test("`.easignore` sigue dejando pasar el producto y sigue frenando los secretos", () => {
  const veredicto = excluidasPorEasignore([
    "src/domain/refreshCycle.ts",
    "src/hooks/useLayers.tsx",
    "app/home.tsx",
    "convex/schema.ts",
    "assets/orbita/higgsfield/archive-10/selected/home.png",
    ".env",
    ".env.local",
    ".env.production",
    "dist/index.html",
    "android/gradlew",
    "ios/Podfile"
  ]);

  // Lo que el build necesita.
  for (const ruta of [
    "src/domain/refreshCycle.ts",
    "src/hooks/useLayers.tsx",
    "app/home.tsx",
    "convex/schema.ts",
    "assets/orbita/higgsfield/archive-10/selected/home.png"
  ]) {
    assert.equal(veredicto.get(ruta), false, `${ruta} es producto: tiene que entrar`);
  }

  // Y lo que nunca puede salir de esta máquina, que no se aflojó al agregar
  // las tres exclusiones nuevas.
  for (const ruta of [".env", ".env.local", ".env.production"]) {
    assert.equal(veredicto.get(ruta), true, `${ruta} no puede viajar a ningún lado`);
  }
  for (const ruta of ["dist/index.html", "android/gradlew", "ios/Podfile"]) {
    assert.equal(veredicto.get(ruta), true, `${ruta} lo regenera el propio build`);
  }
});

test("`.env.example` sigue siendo la excepción declarada, y sigue entrando", () => {
  // La negación es lo primero que rompe una reescritura descuidada del archivo:
  // `.env.*` la excluiría si `!.env.example` no viniera DESPUÉS.
  const veredicto = excluidasPorEasignore([".env.example"]);
  assert.equal(veredicto.get(".env.example"), false, "es la plantilla pública de configuración");
});
