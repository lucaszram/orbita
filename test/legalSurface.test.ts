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
  // direcciones distintas. `/paywall` ya no publica contacto —dejó de ser una
  // pantalla y pasó a ser el lanzador del pago—, pero tampoco puede inventar
  // uno propio si alguien vuelve a agregarle texto.
  assert.match(legal, /from "@\/domain\/support"/, "legal no usa el contacto compartido");
  for (const [nombre, src] of [["legal", legal], ["paywall", paywall]] as const) {
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
    ["renovación automática mensual", /al final de cada mes[\s\S]{0,120}renueva autom(á|a)ticamente/i],
    ["prueba de siete días en el mensual", /mensual incluye[\s\S]{0,80}siete días de prueba/i],
    ["la prueba incluye carta natal completa y Tarot diario", /siete días de prueba[\s\S]{0,160}carta natal completa[\s\S]{0,40}Tarot diario/i],
    ["cancelar durante la prueba no cuesta nada", /cancelás antes de que termine la prueba, no se cobra nada/i],
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

// --- Paywall: lanzador, no pantalla comercial --------------------------------
//
// `/paywall` dejó de ser una oferta intermedia: monta, crea UNA sesión de
// Checkout y redirige. La divulgación comercial —precio, moneda, días de
// prueba, renovación automática y aceptación de términos— la muestra Stripe
// Checkout en el paso siguiente, que es donde efectivamente se paga. Lo que
// esta suite sigue custodiando es que las páginas legales existan, sean
// públicas y se alcancen desde la superficie pública.

test("el lanzador de pago no publica una divulgación propia que pueda desincronizarse", () => {
  assert.doesNotMatch(paywall, /href="\/privacy"/);
  assert.doesNotMatch(paywall, /href="\/terminos"/);
  assert.doesNotMatch(paywall, /SUPPORT_MAILTO/);
  // Y no vuelve a inventar términos por su cuenta. Se mira el CÓDIGO: un
  // comentario que explique por qué la divulgación se fue no es una promesa.
  const codigo = paywall.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(codigo, /se renueva sola|días de prueba|cancelás/);
});

test("Privacidad y Términos siguen publicados y alcanzables desde la superficie pública", () => {
  const landing = leer("src/components/web/orbita-landing.tsx");
  for (const href of ["/privacy", "/terminos", "/support"]) {
    assert.match(landing, new RegExp(`href="${href}"`), `la landing no lleva a ${href}`);
  }
  for (const ruta of ["/privacy", "/terminos", "/support"]) {
    assert.equal(isPublicWebRoute(ruta), true, `${ruta} tiene que ser pública`);
  }
});

test("el paywall sigue sin escribir precios ni habilitar comercio por su cuenta", () => {
  // Guardia de alcance: el importe, la moneda y la prueba son los del Price de
  // Stripe; el cliente nunca los escribe ni decide si el comercio está activo.
  assert.doesNotMatch(paywall, /\$\d/);
  assert.doesNotMatch(paywall, /COMMERCE_MODE|PAYWALL_ENABLED/);
});

// --- Navegación entre las tres páginas --------------------------------------

test("el pie legal lleva a las tres páginas públicas", () => {
  for (const href of ["/support", "/privacy", "/terminos"]) {
    assert.match(legal, new RegExp(`href="${href}"`), `el pie legal no lleva a ${href}`);
  }
});

// --- Nav de escritorio en las páginas legales standalone --------------------

test("Soporte/Privacidad/Términos montan WebLayoutProvider alrededor de WebNav", () => {
  // Estas páginas montan WebNav fuera de WebAppShell (no hay sesión ni layout
  // autenticado detrás). Sin WebLayoutProvider, useIsDesktop() cae al default
  // del contexto ("mobile") y la barra de navegación de escritorio nunca
  // aparece, aunque la ventana sea ancha.
  assert.match(legal, /from "@\/components\/web\/web-layout-provider"/);
  assert.match(legal, /<WebLayoutProvider>\s*<View style=\{styles\.page\}>\s*<WebNav/);
});

test("el pie legal no monta WebNav dos veces por fuera del provider", () => {
  const aperturas = legal.match(/<WebLayoutProvider>/g) ?? [];
  assert.equal(aperturas.length, 1, "un solo shell legal, un solo provider");
});
