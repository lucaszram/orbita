/**
 * La barra de pestañas: adónde va cada toque.
 *
 * El defecto que se cierra: `Ahora` y `Tu momento` no son una pantalla y su
 * detalle, son DOS VISTAS de la sección Tránsitos, y el selector cambia de ruta
 * con `replace`. Como `navigate(nombre)` a secas devuelve la sección tal como
 * quedó, después de mirar `Tu momento` tocar `Tránsitos` en la barra volvía a
 * `Tu momento`: la pestaña se llamaba como la vista que no abría y, desde la
 * barra, no había forma de llegar a `Ahora`.
 *
 * La decisión vive en `src/domain/tabPress.ts`, sin React, así que acá se prueba
 * CORRIENDO —con los nombres de ruta reales de la barra— y no buscando un
 * `if` en el archivo del componente. Lo que sí se verifica por lectura es el
 * cableado: que la barra use esa decisión y que le pase el `screen` al navegador.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { TAB_ROOT_SCREEN, tabPressAction } from "../src/domain/tabPress";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const TAB_BAR = "src/components/orbita/TabBar.tsx";

/** Las cinco pestañas de la barra, en el orden en que se dibujan. */
const PESTANAS = ["hoy", "transitos", "vinculos", "umbral", "perfil"] as const;

const tocar = (name: string) => tabPressAction({ name, focused: false, defaultPrevented: false });

test("tocar Tránsitos abre su raíz, no la vista en la que había quedado la sección", () => {
  assert.deepEqual(tocar("transitos"), { kind: "navigate", name: "transitos", screen: "index" });
  // `index` es la vista `Ahora`: la raíz de la sección, no una pantalla aparte.
  const raiz = sinComentarios(leer("src/routes/v492/transitos-index.tsx"));
  assert.match(raiz, /<TransitosLayersScreen mode="ahora" \/>/);
  // Y el destino no depende de dónde estuviera parada la sección: la decisión no
  // recibe la ruta anidada actual, así que `/transitos/momento` no puede ganarle.
  assert.deepEqual(tocar("transitos"), tocar("transitos"));
});

test("las demás pestañas siguen navegando como siempre", () => {
  for (const name of PESTANAS) {
    if (name === "transitos") continue;
    assert.deepEqual(
      tocar(name),
      { kind: "navigate", name, screen: null },
      `${name}: volver a la sección donde estaba es lo esperado`
    );
  }
  // La tabla de excepciones tiene exactamente una entrada, y es la que se pidió.
  assert.deepEqual(TAB_ROOT_SCREEN, { transitos: "index" });
});

test("re-tocar la pestaña activa no navega, y un tabPress vetado tampoco", () => {
  for (const name of PESTANAS) {
    assert.deepEqual(
      tabPressAction({ name, focused: true, defaultPrevented: false }),
      { kind: "none" },
      `${name}: re-tocar la activa ya lo maneja el navegador`
    );
    assert.deepEqual(
      tabPressAction({ name, focused: false, defaultPrevented: true }),
      { kind: "none" },
      `${name}: el veto existe para que una pantalla pueda quedarse`
    );
    assert.deepEqual(tabPressAction({ name, focused: true, defaultPrevented: true }), { kind: "none" });
  }
});

test("la barra usa esa decisión y le pasa el `screen` al navegador", () => {
  const source = sinComentarios(leer(TAB_BAR));

  assert.match(source, /import \{ tabPressAction \} from "@\/domain\/tabPress";/);
  assert.match(
    source,
    /const accion = tabPressAction\(\{\s*name: route\.name,\s*focused,\s*defaultPrevented: event\.defaultPrevented\s*\}\);/,
    "la barra no vuelve a decidir por su cuenta"
  );
  assert.match(source, /if \(accion\.kind === "none"\) return;/);
  assert.match(
    source,
    /navigation\.navigate\(accion\.name, \{ screen: accion\.screen \}\)/,
    "con raíz declarada, el destino viaja explícito al navegador"
  );
  assert.match(source, /else navigation\.navigate\(accion\.name\);/, "y sin raíz, la navegación de siempre");

  // El tipo del navegador admite el segundo argumento: sin eso no compilaría.
  assert.match(source, /navigate: \(name: string, params\?: \{ screen: string \}\) => void;/);

  // El `emit` sigue saliendo antes de decidir: el veto tiene que poder llegar.
  const orden = source.indexOf("navigation.emit(");
  assert.ok(orden > 0 && orden < source.indexOf("tabPressAction({"), "el evento se emite antes de decidir");
});

test("la barra dibuja las cinco pestañas de la arquitectura, y la tabla habla de ellas", () => {
  const source = sinComentarios(leer(TAB_BAR));
  const labels = /const LABELS: Record<string, string> = \{([\s\S]*?)\};/.exec(source)?.[1] ?? "";
  assert.ok(labels, "no se encontró la tabla de labels");
  for (const name of PESTANAS) {
    assert.match(labels, new RegExp(`\\b${name}:`), `${name} tiene que estar en la barra`);
  }
  // Ninguna raíz declarada puede apuntar a una pestaña que no existe.
  for (const name of Object.keys(TAB_ROOT_SCREEN)) {
    assert.ok(PESTANAS.includes(name as (typeof PESTANAS)[number]), `${name} no es una pestaña de la barra`);
  }
});
