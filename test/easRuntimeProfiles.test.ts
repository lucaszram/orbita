/**
 * Gates de los perfiles EAS y de la ausencia de actualizaciones remotas.
 *
 * Órbita no distribuye código fuera del binario revisado: cada cambio de JS
 * llega con un build nuevo que pasa por TestFlight y App Review. Por eso el
 * repo no declara `expo-updates`, ni URL de updates, ni runtime, ni canales de
 * EAS Update. Estos tests fallan si alguno vuelve a aparecer.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { ROOT } from "./moduleGraph";

type BuildProfile = {
  extends?: string;
  developmentClient?: boolean;
  distribution?: string;
  environment?: string;
  channel?: string;
  ios?: { simulator?: boolean };
  android?: { buildType?: string };
};

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(ROOT, relativePath), "utf8")) as T;
}

function sourceFiles(relativeDir: string): string[] {
  const dir = join(ROOT, relativeDir);
  return readdirSync(dir).flatMap((name) => {
    const relativePath = join(relativeDir, name);
    if (statSync(join(ROOT, relativePath)).isDirectory()) return sourceFiles(relativePath);
    return /\.(ts|tsx|js|jsx)$/.test(name) ? [relativePath] : [];
  });
}

test("el binario no incluye actualizaciones remotas: sin expo-updates, runtime ni URL de updates", () => {
  const app = readJson<{ expo?: Record<string, unknown> }>("app.json");
  const pkg = readJson<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>("package.json");

  assert.equal(app.expo?.updates, undefined, "app.json no declara `updates`");
  assert.equal(app.expo?.runtimeVersion, undefined, "app.json no declara `runtimeVersion`");
  assert.equal(pkg.dependencies?.["expo-updates"], undefined, "expo-updates no es dependencia");
  assert.equal(pkg.devDependencies?.["expo-updates"], undefined, "expo-updates no es devDependency");
  assert.equal(
    /u\.expo\.dev/.test(readFileSync(join(ROOT, "app.config.js"), "utf8")),
    false,
    "app.config.js no reintroduce la URL de updates"
  );
});

test("ningún módulo de la app importa expo-updates", () => {
  const importers = ["app", "src", "plugins"]
    .flatMap(sourceFiles)
    .filter((relativePath) =>
      /["']expo-updates["']/.test(readFileSync(join(ROOT, relativePath), "utf8"))
    );

  assert.deepEqual(importers, []);
});

test("ningún perfil de EAS apunta a un canal de EAS Update", () => {
  const eas = readJson<{ build?: Record<string, BuildProfile> }>("eas.json");
  const withChannel = Object.entries(eas.build ?? {})
    .filter(([, profile]) => profile.channel !== undefined)
    .map(([name]) => name);

  assert.deepEqual(withChannel, []);
});

test("EAS publica clientes de desarrollo separados para dispositivo y simulador", () => {
  const eas = readJson<{ build?: Record<string, BuildProfile> }>("eas.json");
  const development = eas.build?.development;
  const simulator = eas.build?.["development-simulator"];

  assert.ok(development, "falta el perfil EAS development");
  assert.deepEqual(
    development,
    {
      developmentClient: true,
      distribution: "internal",
      environment: "development",
      ios: { simulator: false },
      android: { buildType: "apk" }
    },
    "development debe ser un dev client interno contra el ambiente de desarrollo"
  );

  assert.deepEqual(
    simulator,
    {
      extends: "development",
      ios: { simulator: true }
    },
    "el simulador debe heredar development y cambiar únicamente el destino iOS"
  );
});

test("preview declara explícitamente su environment", () => {
  const eas = readJson<{ build?: Record<string, BuildProfile> }>("eas.json");
  const preview = eas.build?.preview;

  assert.ok(preview, "falta el perfil EAS preview");
  assert.equal(preview.environment, "preview");
  assert.equal(preview.distribution, "internal");
  assert.equal(preview.ios?.simulator, false);
});
