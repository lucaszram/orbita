const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

/**
 * El sitemap del export web se genera acá (CORE-272).
 *
 * `expo export` borra el directorio de salida, lo vuelve a crear vacío y recién
 * entonces levanta Metro —o sea, evalúa este archivo— antes de copiar `public/`
 * y de emitir un HTML por ruta. Ese instante es el único hook de build que
 * corre en las DOS rutas de build (`pnpm build:web` en CI y el `buildCommand`
 * de Vercel) sin agregar un paso que alguien pueda olvidarse de correr.
 *
 * `scripts/generate-sitemap.mjs` decide solo si corresponde escribir —mira el
 * subcomando de la CLI y calla si no es un `expo export`—, así que `expo start`
 * no toca el `dist/` de un build anterior. Es un módulo ESM y esto es
 * CommonJS: se lo invoca como proceso, de forma síncrona, para que el archivo
 * esté antes de que la CLI copie `public/` y escriba los HTML.
 */
function generateSitemap() {
  execFileSync(
    process.execPath,
    [
      path.join(__dirname, "scripts/generate-sitemap.mjs"),
      readOutputDir(process.argv),
      "--only-on-export"
    ],
    {
      cwd: __dirname,
      stdio: "inherit",
      // El hijo tiene su propio `process.argv`: el de la CLI de Expo viaja
      // entero por acá para que el generador pueda ver si esto es un `export`.
      env: { ...process.env, ORBITA_BUILD_ARGV: JSON.stringify(process.argv) }
    }
  );
}

/** `--output-dir <dir>` de `expo export`, o el `dist` por defecto. */
function readOutputDir(argv) {
  const flag = argv.indexOf("--output-dir");
  return flag >= 0 && argv[flag + 1] ? argv[flag + 1] : "dist";
}

generateSitemap();

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
