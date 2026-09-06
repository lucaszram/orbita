import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");

test("Expo y Clerk conservan Sign in with Apple en el binario iOS", () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, "app.json"), "utf8"));
  const clerkPlugin = appJson.expo.plugins.find(
    (entry: unknown) => Array.isArray(entry) && entry[0] === "@clerk/expo",
  );

  assert.equal(appJson.expo.ios.usesAppleSignIn, true);
  assert.ok(clerkPlugin);
  assert.equal(clerkPlugin[1].appleSignIn, true);
});

test("el plugin de producción preserva Apple y sólo limpia push remoto", () => {
  const plugin = fs.readFileSync(
    path.join(ROOT, "plugins", "withStripUnusedEntitlements.js"),
    "utf8",
  );

  assert.doesNotMatch(plugin, /delete config\.modResults\['com\.apple\.developer\.applesignin'\]/);
  assert.match(plugin, /delete config\.modResults\['aps-environment'\]/);
});
