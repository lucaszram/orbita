/**
 * Superficie legal pública: Soporte, Privacidad, Términos y la divulgación del
 * paywall.
 *
 * Son promesas hechas por escrito a quien va a pagar y a App Review; no
 * "contenido". Un refactor que borre una cláusula, cambie el mail de soporte en
 * una sola pantalla o deje el paywall sin link a los Términos no rompe ningún
 * render, así que sin este archivo nadie se entera hasta que alguien reclama.
 *
 * Se verifica la PRESENCIA de cada compromiso del brief, no su redacción exacta:
 * el copy se puede pulir, los compromisos no se pueden perder.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "./moduleGraph";
import { SUPPORT_EMAIL } from "../src/domain/support";
import { isPublicWebRoute } from "../src/domain/webSession";

const leer = (ruta: string) => readFileSync(join(ROOT, ruta), "utf8");

const legal = leer("src/components/web/orbita-legal.tsx");
const paywall = leer("src/components/web/orbita-paywall.tsx");
const rutaTerminos = leer("app/terminos.tsx");

/** Sección de un archivo, entre el nombre de un componente y el siguiente `export function`. */
function bloque(src: string, componente: string): string {
  const desde = src.indexOf(`export function ${componente}(`);
  assert.notEqual(desde, -1, `no existe el componente ${componente}`);
  const resto = src.slice(desde + 1);
  const hasta = resto.indexOf("\nexport function ");
  return hasta === -1 ? resto : resto.slice(0, hasta);
}

const soporte = bloque(legal, "OrbitaSupport");
const privacidad = bloque(legal, "OrbitaPrivacy");
const terminos = bloque(legal, "OrbitaTerms");

// --- Un solo contacto publicado ---------------------------------------------

test("el contacto de soporte es la casilla de Órbita, no un mail personal", () => {
  assert.equal(SUPPORT_EMAIL, "soporte@orbitaastrologia.xyz");
});

test("ninguna pantalla pública escribe su propio mail de soporte", () => {
  // La constante compartida es lo que impide que dos pantallas publiquen
  // direcciones distintas.
  for (const [nombre, src] of [["legal", legal], ["paywall", paywall]] as const) {
    assert.match(src, /from "@\/domain\/support"/, `${nombre} no usa el contacto compartido`);
    assert.doesNotMatch(src, /[\w.]+@(?!orbitaastrologia)[\w.]+\.\w+/, `${nombre} tiene un mail escrito a mano`);
  }
});

// --- Soporte ----------------------------------------------------------------

test("Soporte dice que hace falta una cuenta", () => {
  assert.match(soporte, /¿Necesito una cuenta para usar Órbita\?/);
  assert.match(soporte, /Sí\./);
});

test("Soporte manda la eliminación de cuenta al perfil, no al mail", () => {
  assert.match(soporte, /¿Cómo elimino mi cuenta y mis datos\?/);
  assert.match(soporte, /Desde tu perfil/);
  assert.match(soporte, /Eliminar mi cuenta/);
});

test("el mail queda como vía de ayuda, no como mecanismo de baja", () => {
  assert.match(soporte, /vía de ayuda/);
});

// --- Privacidad -------------------------------------------------------------

test("Privacidad nombra a los proveedores reales que tocan datos", () => {
  for (const proveedor of ["Clerk", "Google", "Convex", "Stripe"]) {
    assert.match(privacidad, new RegExp(`>${proveedor}<`), `Privacidad no nombra a ${proveedor}`);
  }
});

test("Privacidad ubica a cada proveedor en su función", () => {
  assert.match(privacidad, /Clerk<\/Text> — autenticación/);
  assert.match(privacidad, /Convex<\/Text> — backend/);
  assert.match(privacidad, /Stripe<\/Text> — pagos en la web/);
});

test("Privacidad dice que la eliminación se hace desde el perfil", () => {
  assert.match(privacidad, /desde tu perfil/);
});

// --- Términos ---------------------------------------------------------------

test("/terminos es una ruta pública que monta los Términos", () => {
  assert.ok(isPublicWebRoute("/terminos"));
  assert.match(rutaTerminos, /OrbitaTerms/);
});

test("los Términos cubren los siete compromisos del brief", () => {
  const compromisos: Array<[string, RegExp]> = [
    ["renovación automática", /renuevan autom(á|a)ticamente/i],
    ["prueba de tres días en el anual", /anual incluye[\s\S]{0,80}tres días de prueba/i],
    ["semanal sin prueba", /semanal[\s\S]{0,80}no tiene período de prueba/i],
    ["cancelación desde el perfil", /cancelar cuando quieras[\s\S]{0,120}desde tu perfil/i],
    ["acceso hasta el fin del período pagado", /hasta el final del período\s*\n?\s*que ya pagaste/i],
    ["reembolsos por ley aplicable", /reembolsos se rigen por la normativa aplicable/i],
    ["entretenimiento y no asesoramiento", /No es asesoramiento médico, psicológico, legal ni financiero/i]
  ];

  for (const [nombre, patron] of compromisos) {
    assert.match(terminos, patron, `los Términos ya no dicen: ${nombre}`);
  }
});

test("los Términos descartan la predicción garantizada", () => {
  assert.match(terminos, /predicción garantizada/i);
});

// --- Paywall ----------------------------------------------------------------

test("el paywall linkea Privacidad y Términos y publica una vía de soporte", () => {
  assert.match(paywall, /href="\/privacy"/);
  assert.match(paywall, /href="\/terminos"/);
  assert.match(paywall, /SUPPORT_MAILTO/);
});

test("la divulgación vive en el Shell: se ve con comercio prendido y apagado", () => {
  // Si estuviera dentro de `PlanPicker`, el estado "próximamente" —el que hay
  // hoy, con el comercio apagado— quedaría sin links legales.
  assert.match(paywall, /\{children\}\s*\n\s*<PaywallLegalLinks \/>/);
});

test("el paywall sigue sin escribir precios ni habilitar comercio por su cuenta", () => {
  // Guardia de alcance: esta tarea no toca el camino de cobro.
  assert.doesNotMatch(paywall, /\$\d/);
  assert.doesNotMatch(paywall, /COMMERCE_MODE|PAYWALL_ENABLED/);
});

// --- Navegación entre las tres páginas --------------------------------------

test("el pie legal lleva a las tres páginas públicas", () => {
  for (const href of ["/support", "/privacy", "/terminos"]) {
    assert.match(legal, new RegExp(`href="${href}"`), `el pie legal no lleva a ${href}`);
  }
});
