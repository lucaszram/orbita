import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// Verificación ESTRUCTURAL del acceso (paso 0 del onboarding aprobado):
// "Crear cuenta o ingresar" es UNA sola superficie con dos modos; la
// verificación del email, la contraseña legacy de ingreso y los errores son
// estados internos y no agregan pasos. No se puede renderizar RN en node; se valida la estructura
// del fuente.
const SRC = readFileSync(
  path.join(process.cwd(), "src/onboarding/screens/AuthScreen.tsx"),
  "utf8"
);
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("AuthScreen — la primera superficie del onboarding", () => {
  it("crear cuenta e ingresar son modos de la MISMA pantalla", () => {
    assert.match(CODE, /useState<AuthMode>\("signup"\)/, "el alta es la puerta por defecto");
    assert.match(CODE, /cambiarModo\("signup"\)/);
    assert.match(CODE, /cambiarModo\("signin"\)/);
    // El selector es un grupo accesible con estado por puerta.
    assert.match(CODE, /accessibilityRole="tablist"/);
    assert.match(CODE, /accessibilityRole="tab"/);
    assert.match(CODE, /accessibilityState=\{\{ selected: on \}\}/);
  });

  it("verificación, contraseña legacy y errores son estados internos, no pasos", () => {
    // El código de 6 dígitos y la contraseña de una cuenta legacy se dibujan EN esta pantalla.
    assert.match(CODE, /<CodeInput/);
    assert.match(CODE, /secureTextEntry/);
    assert.match(CODE, /\{passwordPhase \? \(/, "la contraseña sólo aparece al ingresar una cuenta que ya la usa");
    assert.doesNotMatch(CODE, /newPassword|Elegí una contraseña/, "el alta nueva es email + código");
    // Cambiar de fase nunca navega: no hay router.push a otra pantalla del alta.
    assert.ok(!CODE.includes("router.push(\"/crear-cuenta\""), "el acceso no delega en el formulario suelto");
    // El error se dice acá mismo, en español y sin URL técnica.
    assert.match(CODE, /accessibilityRole="alert"/);
    assert.match(CODE, /No perdiste nada/);
  });

  it("el reenvío del código no crea otra cuenta", () => {
    assert.match(CODE, /<CodeHelp onResend=\{flow\.resend\} \/>/);
  });

  it("cambiar de puerta o de email nunca pierde el progreso del acceso", () => {
    // Reintentar o cambiar de vía resetea la fase, no el flujo entero.
    assert.match(CODE, /const volverAlEmail = \(\) => \{/);
    assert.match(CODE, /flow\?\.resetToEmail\(\);/);
    assert.match(CODE, /Usar otro email/);
  });

  it("el estado de entrada se anuncia UNA sola vez", () => {
    // Con la sesión activa, un único anuncio del estado de carga.
    const anuncios = CODE.match(/Entrando a tu cuenta…/g) ?? [];
    assert.equal(anuncios.length, 1, "un solo texto de entrada");
    assert.match(CODE, /accessibilityLiveRegion="polite"/);
  });

  it("los objetivos táctiles cumplen los 44 puntos", () => {
    assert.match(CODE, /minHeight: 44/);
    // CTA de 54 y campos de 62 ya superan el mínimo por diseño.
    assert.match(CODE, /minHeight: 62/);
    assert.match(CODE, /height: 54/);
  });

  it("los términos y la privacidad se declaran y se alcanzan", () => {
    assert.match(CODE, /entretenimiento y autoconocimiento/);
    assert.match(CODE, /router\.push\("\/terminos"\)/);
    assert.match(CODE, /router\.push\("\/privacy"\)/);
    assert.match(CODE, /accessibilityRole="link"/);
  });
});
