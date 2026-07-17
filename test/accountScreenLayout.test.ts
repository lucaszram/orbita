import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// Verificación ESTRUCTURAL del bloqueo visual del alta: el formulario (email +
// contraseña + confirmación) crece más que un iPhone chico con el teclado
// abierto, así que tiene que ser scrolleable + keyboard-avoiding con el header
// FIJO. No se puede renderizar RN en node; se valida la estructura del fuente.
const SRC = readFileSync(
  path.join(process.cwd(), "src/onboarding/screens/AccountScreen.tsx"),
  "utf8"
);

const idx = (needle: string) => SRC.indexOf(needle);

describe("AccountScreen — formulario scrolleable + keyboard-avoiding", () => {
  it("importa KeyboardAvoidingView y ScrollView de react-native", () => {
    assert.match(SRC, /KeyboardAvoidingView/);
    assert.match(SRC, /ScrollView/);
  });

  it("usa keyboardShouldPersistTaps=\"handled\" (el CTA se puede tocar con el teclado abierto)", () => {
    assert.match(SRC, /keyboardShouldPersistTaps=["']handled["']/);
  });

  it("el header queda FIJO fuera del scroll (Header antes de abrir el ScrollView)", () => {
    const header = idx("<Header ");
    const scrollOpen = idx("<ScrollView");
    const scrollClose = idx("</ScrollView>");
    assert.ok(header >= 0 && scrollOpen >= 0 && scrollClose >= 0, "faltan Header/ScrollView");
    assert.ok(header < scrollOpen, "el Header debe renderizarse ANTES del ScrollView (fijo)");
    // Y no debe volver a aparecer un Header dentro del scroll.
    assert.equal(SRC.indexOf("<Header ", scrollOpen), -1, "el Header no debe vivir dentro del ScrollView");
  });

  it("el KeyboardAvoidingView envuelve al ScrollView", () => {
    const kav = idx("<KeyboardAvoidingView");
    const scrollOpen = idx("<ScrollView");
    assert.ok(kav >= 0 && kav < scrollOpen, "el ScrollView debe estar dentro del KeyboardAvoidingView");
  });

  it("el contenido del scroll tiene padding inferior (llegar al error y al botón)", () => {
    assert.match(SRC, /scrollContent:\s*\{[^}]*paddingBottom/);
  });

  it("el CTA 'Guardar mi carta' y el error viven dentro del scroll", () => {
    const scrollOpen = idx("<ScrollView");
    const scrollClose = idx("</ScrollView>");
    const cta = idx("label={ctaLabel}");
    const error = idx("styles.error");
    assert.ok(cta > scrollOpen && cta < scrollClose, "el CTA debe estar dentro del scroll");
    assert.ok(error > scrollOpen && error < scrollClose, "el error debe estar dentro del scroll");
  });
});
