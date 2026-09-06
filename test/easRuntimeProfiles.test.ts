/**
 * Gates de compatibilidad nativa para EAS Update y los clientes de desarrollo.
 *
 * RevenueCat agrega módulos nativos. Una runtime basada únicamente en la
 * versión de Expo permitiría enviar su bundle JS a binarios SDK 54 anteriores,
 * que no contienen esos módulos. El fingerprint separa esos binarios de forma
 * automática cuando cambia la superficie nativa.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("la runtime nativa usa fingerprint y nunca agrupa RevenueCat con binarios SDK 54 viejos", () => {
  const app = readJson<{
    expo?: { runtimeVersion?: { policy?: string } };
  }>("app.json");

  assert.deepEqual(app.expo?.runtimeVersion, { policy: "fingerprint" });
  assert.notEqual(app.expo?.runtimeVersion?.policy, "sdkVersion");
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
      channel: "development",
      ios: { simulator: false },
      android: { buildType: "apk" }
    },
    "development debe ser un dev client interno contra el ambiente/canal de desarrollo"
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

test("preview declara explícitamente el mismo environment y channel", () => {
  const eas = readJson<{ build?: Record<string, BuildProfile> }>("eas.json");
  const preview = eas.build?.preview;

  assert.ok(preview, "falta el perfil EAS preview");
  assert.equal(preview.environment, "preview");
  assert.equal(preview.channel, "preview");
  assert.equal(preview.distribution, "internal");
  assert.equal(preview.ios?.simulator, false);
});
