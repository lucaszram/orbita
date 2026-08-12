import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// Verificación ESTRUCTURAL del paso de cuenta. La cuenta la crea la UI OFICIAL
// de Clerk (`ClerkSignUp`), que trae su propio formulario, su propio manejo de
// teclado y su propio botón: acá ya no hay campos, ni CTA "Guardar mi carta",
// ni KeyboardAvoidingView propio — envolver el widget de Clerk en uno anidaba
// dos manejos del teclado.
//
// Lo que SÍ sigue siendo responsabilidad de la pantalla: que el escenario
// (sello + título + copy) y el widget entren en una pantalla chica sin dejar
// nada fuera de alcance, con el header fijo. No se puede renderizar RN en node;
// se valida la estructura del fuente.
const SRC = readFileSync(
  path.join(process.cwd(), "src/onboarding/screens/AccountScreen.tsx"),
  "utf8"
);

const idx = (needle: string) => SRC.indexOf(needle);

describe("AccountScreen — escenario scrolleable alrededor de la UI de Clerk", () => {
  it("monta la UI oficial de Clerk y ningún campo propio", () => {
    // Con el email como PRELLENADO: la pantalla no tiene campo de email, sólo
    // le pasa a Clerk el que la persona ya escribió antes de llegar.
    assert.match(SRC, /<ClerkSignUp email=\{email\} \/>/);
    for (const prohibido of ["TextInput", "CodeInput", "secureTextEntry", "Guardar mi carta"]) {
      assert.ok(!SRC.includes(prohibido), `el formulario propio no puede volver: ${prohibido}`);
    }
    // El widget de Clerk maneja su propio teclado: anidar otro descoordinaba
    // los dos y dejaba el botón de Clerk fuera de pantalla.
    assert.ok(!SRC.includes("KeyboardAvoidingView"), "no se anida un keyboard-avoiding propio");
  });

  it("el contenido scrollea", () => {
    assert.match(SRC, /<ScrollView/);
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

  it("el contenido del scroll tiene padding inferior (llegar al final del widget)", () => {
    assert.match(SRC, /scrollContent:\s*\{[^}]*paddingBottom/);
  });

  it("el área de Clerk vive DENTRO del scroll", () => {
    const scrollOpen = idx("<ScrollView");
    const scrollClose = idx("</ScrollView>");
    const clerk = idx("<ClerkSignUp ");
    assert.ok(clerk > scrollOpen && clerk < scrollClose, "el widget debe estar dentro del scroll");
    // Y con alto reservado: sin esto el widget arranca colapsado dentro de un
    // contenedor que se encoge a su contenido.
    assert.match(SRC, /clerkZone:\s*\{[^}]*minHeight/);
  });

  it("el error del borrador y su reintento también viven dentro del scroll", () => {
    const scrollOpen = idx("<ScrollView");
    const scrollClose = idx("</ScrollView>");
    const error = idx("styles.error");
    const retry = idx('label="Reintentar"');
    assert.ok(error > scrollOpen && error < scrollClose, "el error debe estar dentro del scroll");
    assert.ok(retry > scrollOpen && retry < scrollClose, "el reintento debe estar dentro del scroll");
  });
});
