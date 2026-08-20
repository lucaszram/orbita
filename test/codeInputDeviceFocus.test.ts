/**
 * El código de verificación tiene que poder recibir foco en un iPhone REAL.
 *
 * ## El bloqueante, encontrado en dispositivo físico (2026-08-19)
 *
 * `CodeInput` dibuja los casilleros con `pointerEvents="none"` y pone encima un
 * `TextInput` invisible (`opacity: 0`, absoluteFill) que captura los toques.
 * Todo el input depende de que una vista con opacidad CERO reciba el tap.
 *
 * En iPhone 13 Pro Max (iOS 26.6), con el build compilado con
 * `RCT_NEW_ARCH_ENABLED=1`, ese TextInput **no recibe ningún toque**: no se
 * puede escribir, no se puede borrar, no se puede enfocar. Lo único que logró
 * escribir fue el autofill de QuickType — que metió un código y quedó clavado
 * con "Incorrect code" sin forma de corregirlo. Login imposible en dispositivo.
 *
 * En simulador no se ve: el `autoFocus` inicial enfoca sin necesitar el tap, y
 * no existe QuickType. Por eso 15 pasadas de certificación pasaron de largo.
 *
 * ## La regla que estas pruebas fijan
 *
 * El foco NUNCA puede depender del hit-testing de una vista invisible. El tap
 * lo captura un `Pressable` visible (los casilleros), que enfoca el input por
 * ref — programáticamente, sin apostar a cómo cada arquitectura de RN trata la
 * opacidad cero.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { ROOT } from "./moduleGraph";

const fuente = readFileSync(join(ROOT, "src/onboarding/components/CodeInput.tsx"), "utf8");

describe("CodeInput — el foco no depende de una vista invisible", () => {
  it("REPRO: un Pressable visible captura el tap y enfoca por ref", () => {
    assert.ok(
      fuente.includes("Pressable"),
      "los casilleros tienen que estar envueltos en un Pressable que tome el tap"
    );
    assert.ok(
      /onPress=\{[^}]*focus\(\)/s.test(fuente),
      "el tap tiene que enfocar el TextInput por ref (focus programático)"
    );
  });

  it("el TextInput invisible no participa del hit-testing", () => {
    // Si el input invisible sigue capturando toques, el arreglo queda a merced
    // del mismo comportamiento que lo rompió: según la arquitectura, una vista
    // con opacity 0 puede o no recibir taps. Se saca del hit-testing y el tap
    // pasa siempre por el Pressable.
    // `lastIndexOf`: `useRef<TextInput>` también matchea "<TextInput".
    const inputBlock = fuente.slice(fuente.lastIndexOf("<TextInput"));
    assert.ok(
      /pointerEvents="none"/.test(inputBlock),
      'el TextInput oculto lleva pointerEvents="none": el tap es del Pressable'
    );
  });

  it("el autofill de iOS sigue habilitado — es como entra el código del mail", () => {
    assert.ok(fuente.includes('textContentType="oneTimeCode"'));
    assert.ok(fuente.includes('autoComplete="one-time-code"'));
  });

  it("los casilleros siguen siendo decorativos (no roban el tap al Pressable)", () => {
    const fila = fuente.slice(fuente.indexOf("styles.row}"), fuente.lastIndexOf("<TextInput"));
    assert.ok(
      /pointerEvents="none"/.test('style={styles.row} pointerEvents="none"') &&
        fuente.includes('style={styles.row} pointerEvents="none"'),
      "la fila de casilleros conserva pointerEvents none"
    );
    assert.ok(fila.length > 0);
  });
});
