/**
 * La GEOMETRÍA de los cuatro frames Free — build 30.
 *
 * `freePlusAccessNative.test.ts` fija QUÉ se ve con cada plan: el copy, la
 * única acción y la lista que no se recorta. Esto fija DÓNDE se ve, que es lo
 * que la auditoría contra Figma encontró corrido: un bloqueo pegado al
 * encabezado, una línea fina a 16 del texto donde el frame pone 20, una primera
 * fila con un margen que el frame no dibuja.
 *
 * Las medidas salen del archivo `BEB5v6SbgJn2Nipm8Qa0wE`, leídas en la posición
 * ABSOLUTA de cada capa dentro de su frame:
 *
 * - `1248:1617` — Hoy: encabezado hasta 207, línea fina en 231, texto en 252,
 *   acción en 342.
 * - `1249:1633` — Tránsitos: encabezado hasta 229, línea en 253, texto en 274,
 *   acción en 386.
 * - `1250:1651` — Vínculos sin personas: encabezado hasta 151, primera línea en
 *   175, encabezado del módulo en 192, tarjeta en 242, nota en 356, alta en
 *   418, línea del patrón en 494, frase del bloqueo en 540, acción en 600.
 * - `1253:1665` — Vínculos con una persona: encabezado hasta 151, primera línea
 *   en 175, tarjeta en 242, "editar datos" en 463, alta en 523, línea del
 *   patrón en 591, frase del bloqueo en 637, acción en 697.
 *
 * Las pruebas no renderizan React Native: leen el fuente, extraen la entrada de
 * `StyleSheet.create` y la resuelven a PUNTOS pasando por el módulo real de
 * tokens. Así una medida escrita con el token equivocado —o un token que cambie
 * de valor— falla acá, y no en un TestFlight.
 *
 * Lo que Plus dibuja no se mueve: cada medida nueva es condicional y su
 * condición nace del plan. La última sección lo comprueba pieza por pieza.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { v492 } from "../src/components/v492/tokens";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PLAN_LOCK = leer("src/components/v492/PlanLock.tsx");
const MODULE = leer("src/components/v492/Module.tsx");
const SCREEN = leer("src/components/v492/Screen.tsx");
const HUB = leer("src/screens/v492/VinculosHubScreen.tsx");
const HOY = leer("src/screens/v492/HoyScreen.tsx");
const TRANSITOS = leer("src/screens/v492/TransitosLayersScreen.tsx");

/** Cuerpo de una entrada de `StyleSheet.create`, por nombre exacto. */
function estilo(codigo: string, nombre: string): string {
  const match = codigo.match(new RegExp(String.raw`\n\s*${nombre}:\s*\{([^{}]*)\}`));
  if (!match) assert.fail(`no encontré el estilo \`${nombre}\``);
  return match[1];
}

/**
 * Una medida escrita en el fuente, resuelta a PUNTOS.
 *
 * Acepta las tres formas que usa el sistema: un número literal, un token de la
 * escala —que se lee del módulo real, no de una copia— y una constante con
 * nombre declarada en el mismo archivo. Cualquier otra cosa falla: si aparece
 * una forma nueva de escribir una medida, esta prueba quiere enterarse.
 */
function medida(codigo: string, nombre: string, propiedad: string): number {
  const cuerpo = estilo(codigo, nombre);
  const match = cuerpo.match(new RegExp(String.raw`\b${propiedad}:\s*([^,}\n]+)`));
  if (!match) assert.fail(`\`${nombre}\` no declara \`${propiedad}\``);
  const expr = match[1].trim();

  if (/^\d+(?:\.\d+)?$/.test(expr)) return Number(expr);

  const token = expr.match(/^v492\.space\.(\w+)$/);
  if (token) {
    const valor = (v492.space as Record<string, number>)[token[1]];
    assert.equal(typeof valor, "number", `token desconocido: \`${expr}\``);
    return valor;
  }

  const constante = codigo.match(new RegExp(String.raw`\bconst ${expr} = (\d+(?:\.\d+)?);`));
  if (constante) return Number(constante[1]);

  return assert.fail(`no sé leer la medida \`${expr}\``);
}

// ---------------------------------------------------------------------------
// 1 · Hoy y Tránsitos: el bloqueo de PANTALLA (`1248:1617`, `1249:1633`)
// ---------------------------------------------------------------------------

test("el bloqueo de pantalla se despega 24 del encabezado", () => {
  // El encabezado de la pantalla cierra con sus 16 de siempre —eso es lo que
  // hace que termine en 207 y en 229—…
  assert.equal(medida(SCREEN, "header", "paddingBottom"), 16);
  // …y el bloque agrega los 24 que el frame pone antes de la línea fina.
  assert.equal(medida(PLAN_LOCK, "screenBlock", "paddingTop"), 24);
  // 191 → 231 en Hoy y 213 → 253 en Tránsitos: 40 desde el final del texto.
  assert.equal(
    medida(SCREEN, "header", "paddingBottom") + medida(PLAN_LOCK, "screenBlock", "paddingTop"),
    40
  );
  assert.match(sinComentarios(PLAN_LOCK), /<View style=\{rule \? styles\.screenBlock : null\}>/);
});

test("la línea fina deja 20 hasta el texto, y el texto 24 hasta la acción", () => {
  // 231 → 252 y 253 → 274. La escala salta de 16 a 24 y no tiene este paso: la
  // medida vive con su nombre y su origen adentro del componente.
  assert.equal(medida(PLAN_LOCK, "rule", "marginBottom"), 20);
  assert.match(sinComentarios(PLAN_LOCK), /const RULE_TO_TEXT = 20;/);
  // 318 → 342 en Hoy y 362 → 386 en Tránsitos.
  assert.equal(medida(PLAN_LOCK, "cta", "marginTop"), 24);
});

test("Hoy y Tránsitos toman esa composición sin tener que pedirla", () => {
  // `rule` viene encendido, así que la geometría del frame no depende de que
  // las dos pantallas se acuerden de declararla.
  assert.match(sinComentarios(PLAN_LOCK), /rule = true/);
  for (const [pantalla, source] of [
    ["Hoy", HOY],
    ["Tránsitos", TRANSITOS]
  ] as const) {
    const usos = sinComentarios(source).match(/<PlanLockBlock[\s\S]*?\/>/g) ?? [];
    assert.equal(usos.length, 1, `${pantalla}: un solo bloqueo`);
    assert.doesNotMatch(usos[0], /rule=/, `${pantalla}: la línea fina y su aire quedan encendidos`);
  }
});

// ---------------------------------------------------------------------------
// 2 · El bloqueo DENTRO de un módulo (`1250:1651`, `1253:1665`)
// ---------------------------------------------------------------------------

test("dentro de un módulo el bloqueo no agrega separación ni una segunda línea", () => {
  const src = sinComentarios(PLAN_LOCK);
  // El encabezado del módulo ya trajo su línea y ya dejó su aire.
  assert.match(src, /\{rule \? <Divider style=\{styles\.rule\} \/> : null\}/);
  assert.match(src, /<View style=\{rule \? styles\.screenBlock : null\}>/);
  // Y del texto a la acción van 16, no 24 (`1250:1651`, 584 → 600).
  assert.equal(medida(PLAN_LOCK, "ctaInModule", "marginTop"), 16);
  assert.match(src, /<View style=\{rule \? styles\.cta : styles\.ctaInModule\}>/);
});

test("el encabezado del patrón cerrado acerca su frase a 12", () => {
  // 494 → 511 la línea fina y su aire; el encabezado cierra en 528 y la frase
  // abre en 540: abajo no hay un bloque de contenido sino un renglón corto.
  assert.equal(v492.space.md, 12);
  assert.match(
    sinComentarios(HUB),
    /gap=\{patronBloqueado \? v492\.space\.md : undefined\}/
  );
});

test("`gap` es opcional y su default no mueve ningún módulo existente", () => {
  const src = sinComentarios(MODULE);
  assert.match(src, /gap = v492\.space\.lg/, "el default es el aire del canon");
  assert.equal(v492.space.lg, 16);
  assert.match(src, /<View style=\{\{ marginBottom: gap \}\}>/);
  // `LayerModule` —el patrón que repiten TODAS las pantallas de capas— no lo
  // pasa, así que Carta, Umbral, el perfil y los detalles no se mueven.
  assert.match(src, /<ModuleHeader module=\{module\} cadence=\{cadence\} intro=\{intro\} \/>/);
});

test("en todo el repo, el único encabezado que pide otro aire es el patrón cerrado", () => {
  const archivos = readdirSync(join(ROOT, "src"), { encoding: "utf8", recursive: true }).filter(
    (nombre) => nombre.endsWith(".tsx")
  );
  const conGap: string[] = [];
  for (const archivo of archivos) {
    const source = sinComentarios(readFileSync(join(ROOT, "src", archivo), "utf8"));
    for (const uso of source.match(/<ModuleHeader[\s\S]*?\/>/g) ?? []) {
      if (/\bgap=/.test(uso)) conGap.push(archivo);
    }
  }
  assert.deepEqual(conGap, ["screens/v492/VinculosHubScreen.tsx"]);
});

// ---------------------------------------------------------------------------
// 3 · Vínculos sin personas (`1250:1651`)
// ---------------------------------------------------------------------------

test("la composición Free de Vínculos arranca 24 debajo del encabezado", () => {
  // 151 → 175, con el encabezado ya cerrado con sus 16.
  assert.equal(medida(HUB, "freeTop", "paddingTop"), 24);
  const src = sinComentarios(HUB);
  assert.match(src, /const free = plan === "free";/);
  assert.match(src, /<Section style=\{free \? styles\.freeTop : undefined\}>/);
});

test("del encabezado del módulo a la tarjeta, a la nota y al alta: 16, 16 y 24", () => {
  // 175 → 192: la línea fina del encabezado y su aire.
  assert.equal(medida(MODULE, "headerRule", "marginBottom"), 16);
  // 226 → 242: la fila del encabezado y el `gap` por default.
  assert.equal(v492.space.lg, 16);
  // 340 → 356: la tarjeta del estado vacío y la nota del cupo.
  assert.equal(medida(HUB, "cupo", "marginTop"), 16);
  // 394 → 418: la nota y el alta.
  assert.equal(medida(HUB, "cta", "marginTop"), 24);
  // 462 → 494: el alta y la línea fina del patrón.
  assert.equal(medida(HUB, "module", "marginTop"), 32);
});

// ---------------------------------------------------------------------------
// 4 · Vínculos con una persona (`1253:1665`)
// ---------------------------------------------------------------------------

test("la primera fila Free arranca pegada al encabezado, y sólo la primera", () => {
  const src = sinComentarios(HUB);
  // El aire lo puso el encabezado del módulo: 226 → 242 y nada más.
  assert.equal(medida(HUB, "personaRowFlush", "marginTop"), 0);
  // Las demás filas conservan el suyo, y con Plus lo conservan todas.
  assert.equal(medida(HUB, "personaRow", "marginTop"), 12);
  assert.match(src, /<PersonasBlock personas=\{personas\} flushFirst=\{free\} \/>/);
  assert.match(src, /flush=\{flushFirst && index === 0\}/);
  assert.match(src, /style=\{\[styles\.personaRow, flush \? styles\.personaRowFlush : null\]\}/);
});

test("entre la tarjeta y `editar datos` no hay hueco", () => {
  // El toque abre donde la tarjeta cierra (463 en el frame): sus 44 de alto ya
  // dejan el aire debajo del rótulo, y un margen encima lo duplicaría.
  assert.doesNotMatch(estilo(HUB, "personaEditar"), /margin/);
  assert.match(estilo(HUB, "personaEditar"), /minHeight: v492\.touch/);
  assert.equal(v492.touch, 44);
});

test("después de la fila, el alta y el patrón se acercan a 16 y 24", () => {
  const src = sinComentarios(HUB);
  // 507 → 523: el toque de editar y el alta.
  assert.equal(medida(HUB, "ctaTrasFila", "marginTop"), 16);
  // 567 → 591: el alta y la línea fina del patrón.
  assert.equal(medida(HUB, "moduleTrasFila", "marginTop"), 24);
  assert.match(src, /const freeConFila = free && personas !== undefined && personas\.length > 0;/);
  assert.match(src, /<View style=\{freeConFila \? styles\.ctaTrasFila : styles\.cta\}>/);
  assert.match(src, /<View style=\{freeConFila \? styles\.moduleTrasFila : styles\.module\}>/);
});

// ---------------------------------------------------------------------------
// 5 · Plus no se movió un punto
// ---------------------------------------------------------------------------

test("las cinco medidas nuevas de Vínculos son condicionales, y su condición es el plan", () => {
  const src = sinComentarios(HUB);
  assert.match(src, /const free = plan === "free";/);
  assert.match(src, /const patronBloqueado = free;/);
  assert.match(src, /const freeConFila = free &&/);
  for (const uso of [
    /style=\{free \? styles\.freeTop : undefined\}/,
    /flushFirst=\{free\}/,
    /style=\{freeConFila \? styles\.ctaTrasFila : styles\.cta\}/,
    /style=\{freeConFila \? styles\.moduleTrasFila : styles\.module\}/,
    /gap=\{patronBloqueado \? v492\.space\.md : undefined\}/
  ]) {
    assert.match(src, uso);
  }
});

test("con Plus, Vínculos dibuja exactamente los valores del canon", () => {
  // Los tres que la pantalla usaba antes del build 30, sin tocar.
  assert.equal(medida(HUB, "cta", "marginTop"), 24);
  assert.equal(medida(HUB, "module", "marginTop"), 32);
  assert.equal(medida(HUB, "personaRow", "marginTop"), 12);
  // Y el módulo del patrón abierto sigue empezando donde empezaba: el `gap` del
  // encabezado sólo se acorta con el bloqueo.
  assert.equal(v492.space.lg, 16);
});

test("con Plus, Hoy y Tránsitos ni siquiera montan el bloque de plan", () => {
  for (const [pantalla, source] of [
    ["Hoy", HOY],
    ["Tránsitos", TRANSITOS]
  ] as const) {
    const src = sinComentarios(source);
    const bloqueo = src.indexOf("<PlanLockBlock");
    const rama = src.indexOf('acceso === "free"');
    assert.ok(rama > 0 && bloqueo > rama, `${pantalla}: el bloque vive en la rama Free`);
    // Y la rama Free termina antes de la primera fase del sobre, que es por
    // donde entra Plus.
    assert.ok(bloqueo < src.indexOf('phase === "cargando"'), pantalla);
  }
  // La geometría que cambió vive ENTERA adentro del bloque: ni el encabezado de
  // la pantalla ni el cuerpo de Hoy se tocaron.
  assert.equal(medida(SCREEN, "header", "paddingBottom"), 16);
  assert.equal(medida(HOY, "principal", "paddingTop"), 16);
  assert.equal(medida(HOY, "bloque", "marginTop"), 8);
});
