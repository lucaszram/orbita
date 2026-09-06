/**
 * Vínculos — el alta de la primera persona (CORE-212), lado del front.
 *
 * Se prueba el dominio puro: qué pide cada nivel, qué fecha y hora se aceptan,
 * cómo se cuenta la comparación y cómo se dibujan las barras sin dividir por
 * cero. Nada de acá toca la red.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rotuloAccesible } from "../src/domain/webLayout";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  type AltaForm,
  NIVELES,
  SIGNOS,
  TIPOS_DE_VINCULO,
  accionDeAgregar,
  copyDeListaVacia,
  descripcionDeNivel,
  escalaDeDimensiones,
  etiquetaDeNivel,
  fechaCorta,
  fechaIsoDesdeTexto,
  fraccionDeBarra,
  horaNormalizada,
  inicial,
  lineaDePersona,
  notaDePlan,
  numeroDeNivel,
  perfilIdValido,
  resumenDeVinculo,
  rotuloDeCupo,
  rotuloDeNivel,
  titularDeContactos,
  titularDeContactosCorto,
  validarAlta
} from "../src/domain/vinculo";

const base: AltaForm = {
  nombre: "Vera",
  tipo: "friendship",
  nivel: "carta",
  signo: null,
  fecha: "28/01/1988",
  hora: "19:45",
  lugar: { label: "Córdoba, AR", latitude: -31.4, longitude: -64.2 }
};

describe("fecha y hora", () => {
  it("acepta día/mes/año con barras, puntos, guiones y espacios, y el ISO", () => {
    assert.equal(fechaIsoDesdeTexto("28/01/1988"), "1988-01-28");
    assert.equal(fechaIsoDesdeTexto("28 / 01 / 1988"), "1988-01-28");
    assert.equal(fechaIsoDesdeTexto("5.3.2001"), "2001-03-05");
    assert.equal(fechaIsoDesdeTexto("1988-01-28"), "1988-01-28");
  });

  it("rechaza fechas que no existen o están fuera de rango", () => {
    assert.equal(fechaIsoDesdeTexto("31/02/1990"), null);
    assert.equal(fechaIsoDesdeTexto("29/02/2001"), null);
    assert.equal(fechaIsoDesdeTexto("29/02/2000"), "2000-02-29");
    assert.equal(fechaIsoDesdeTexto("01/01/1850"), null);
    assert.equal(fechaIsoDesdeTexto("ayer"), null);
    assert.equal(fechaIsoDesdeTexto(""), null);
  });

  it("normaliza horas con dos puntos, punto, h o sin separador", () => {
    assert.equal(horaNormalizada("19:45"), "19:45");
    assert.equal(horaNormalizada("7:05"), "07:05");
    assert.equal(horaNormalizada("19.45"), "19:45");
    assert.equal(horaNormalizada("1945"), "19:45");
    assert.equal(horaNormalizada("19h45"), "19:45");
    assert.equal(horaNormalizada("24:00"), null);
    assert.equal(horaNormalizada("19:60"), null);
    assert.equal(horaNormalizada("noche"), null);
  });
});

describe("qué pide cada nivel", () => {
  it("los tres niveles existen en el orden del frame con su rótulo de datos", () => {
    assert.deepEqual(
      NIVELES.map((n) => [n.key, n.pide]),
      [
        ["signo", "SIN FECHA"],
        ["fecha", "PIDE FECHA"],
        ["carta", "PIDE FECHA, HORA Y LUGAR"]
      ]
    );
    assert.equal(etiquetaDeNivel("carta"), "Carta con carta");
    assert.equal(TIPOS_DE_VINCULO.length, 4);
    assert.equal(SIGNOS.length, 12);
  });

  it("signo con signo: nombre y signo, nada más", () => {
    assert.deepEqual(validarAlta({ ...base, nivel: "signo", signo: "leo", fecha: "", hora: "", lugar: null }), {});
    assert.deepEqual(validarAlta({ ...base, nivel: "signo", signo: null }), { signo: "Elegí su signo solar." });
  });

  it("fecha con fecha: la fecha es obligatoria; hora y lugar opcionales pero válidos si se escriben", () => {
    assert.deepEqual(validarAlta({ ...base, nivel: "fecha", hora: "", lugar: null }), {});
    assert.equal(validarAlta({ ...base, nivel: "fecha", fecha: "" }).fecha, "Una fecha real, día / mes / año.");
    assert.equal(validarAlta({ ...base, nivel: "fecha", hora: "veinte" }).hora, "La hora de nacimiento, HH:MM.");
    // Una hora sin lugar no se puede ubicar en una zona: se pide el lugar, no se descarta la hora.
    assert.equal(validarAlta({ ...base, nivel: "fecha", hora: "19:45", lugar: null }).lugar, "Para usar la hora hace falta el lugar de nacimiento.");
    assert.deepEqual(validarAlta({ ...base, nivel: "fecha", hora: "19:45" }), {});
  });

  it("carta con carta: fecha, hora y un lugar elegido de la lista (con coordenadas)", () => {
    assert.deepEqual(validarAlta(base), {});
    assert.equal(validarAlta({ ...base, hora: "" }).hora, "La hora de nacimiento, HH:MM.");
    assert.equal(validarAlta({ ...base, lugar: null }).lugar, "Elegí el lugar de la lista para ubicar la carta.");
    assert.equal(validarAlta({ ...base, lugar: { label: "Córdoba" } }).lugar, "Elegí el lugar de la lista para ubicar la carta.");
  });

  it("el nombre es obligatorio y acotado", () => {
    assert.equal(validarAlta({ ...base, nombre: "   " }).nombre, "Escribí cómo la llamás.");
    assert.equal(validarAlta({ ...base, nombre: "x".repeat(61) }).nombre, "Un nombre más corto.");
  });
});

describe("cómo se cuenta la comparación", () => {
  it("el titular cuenta contactos entre tu carta y la de la persona", () => {
    assert.equal(titularDeContactos(14, "Mara"), "14 contactos entre tu carta y la de Mara.");
    assert.equal(titularDeContactos(1, "Mara"), "Un contacto entre tu carta y la de Mara.");
    assert.equal(titularDeContactos(0, "Mara"), "Sin contactos dentro de orbe entre tu carta y la de Mara.");
  });

  it("en escritorio el titular es el corto del frame 1757:2674: entre las dos cartas", () => {
    assert.equal(titularDeContactosCorto(14), "14 contactos entre las dos cartas.");
    assert.equal(titularDeContactosCorto(1), "Un contacto entre las dos cartas.");
    assert.equal(titularDeContactosCorto(0), "Sin contactos dentro de orbe entre las dos cartas.");
  });

  it("la fracción de una barra queda entre 0 y 1 y no divide por cero", () => {
    assert.equal(fraccionDeBarra(9, 14), 9 / 14);
    assert.equal(fraccionDeBarra(0, 0), 0);
    assert.equal(fraccionDeBarra(5, 0), 0);
    assert.equal(fraccionDeBarra(20, 14), 1);
    assert.equal(fraccionDeBarra(Number.NaN, 3), 0);
  });

  it("las tres dimensiones comparten escala: el máximo, nunca menos de 1", () => {
    const resumen = {
      total: 0,
      armonicos: 0,
      tensos: 0,
      fusiones: 0,
      dimensions: [
        { key: "hablan" as const, label: "", total: 5, armonicos: 0, tensos: 0, fusiones: 0 },
        { key: "cuidan" as const, label: "", total: 6, armonicos: 0, tensos: 0, fusiones: 0 },
        { key: "deseo" as const, label: "", total: 3, armonicos: 0, tensos: 0, fusiones: 0 }
      ]
    };
    assert.equal(escalaDeDimensiones(resumen), 6);
    assert.equal(escalaDeDimensiones({ ...resumen, dimensions: [] }), 1);
  });

  it("la inicial del chip sale del nombre en mayúscula", () => {
    assert.equal(inicial("mara"), "M");
    assert.equal(inicial("  Ñandú"), "Ñ");
    assert.equal(inicial(""), "?");
  });
});

describe("la biblioteca de personas guardadas (CORE-213)", () => {
  it("la línea de una persona muestra sólo lo que se guardó", () => {
    assert.equal(fechaCorta("1994-03-12"), "12 mar 1994");
    assert.equal(fechaCorta("nada"), null);
    assert.equal(
      lineaDePersona({ level: "carta", zodiacSign: null, birthDate: "1994-03-12", birthTime: "08:20", birthPlaceLabel: "Rosario, Santa Fe, AR" }),
      "12 mar 1994 · 08:20 · Rosario"
    );
    assert.equal(lineaDePersona({ level: "fecha", zodiacSign: null, birthDate: "1994-03-12", birthTime: null, birthPlaceLabel: null }), "12 mar 1994");
    assert.equal(lineaDePersona({ level: "signo", zodiacSign: "leo", birthDate: null, birthTime: null, birthPlaceLabel: null }), "Leo · sólo signo");
    assert.equal(lineaDePersona({ level: "fecha", zodiacSign: null, birthDate: null, birthTime: null, birthPlaceLabel: null }), "Fecha con fecha");
  });

  it("el resumen del vínculo cuenta contactos y tonos, y calla las fusiones si no hay", () => {
    assert.equal(resumenDeVinculo({ total: 14, armonicos: 9, tensos: 5, fusiones: 0 }), "14 CONTACTOS · 9 ARMÓNICOS · 5 TENSOS");
    assert.equal(resumenDeVinculo({ total: 3, armonicos: 1, tensos: 1, fusiones: 1 }), "3 CONTACTOS · 1 ARMÓNICO · 1 TENSO · 1 FUSIÓN");
    assert.equal(resumenDeVinculo({ total: 0, armonicos: 0, tensos: 0, fusiones: 0 }), "0 CONTACTOS");
  });

  it("el nivel se numera de 1 a 3 y se describe sin prometer casas que no hay", () => {
    assert.equal(numeroDeNivel("signo"), 1);
    assert.equal(numeroDeNivel("carta"), 3);
    assert.equal(rotuloDeNivel("fecha"), "NIVEL 2 DE 3");
    assert.match(descripcionDeNivel("signo", false), /sin contactos/);
    assert.match(descripcionDeNivel("fecha", false), /sin casas ni ejes/);
    assert.match(descripcionDeNivel("fecha", true), /suma casas y ejes si tu carta también tiene hora/);
    assert.match(descripcionDeNivel("carta", true), /suma casas y ejes si tu carta también tiene hora/);
  });

  it("un id de perfil se acepta sólo si tiene la forma de un id de Convex", () => {
    assert.equal(perfilIdValido("kn702nxfqb9cjmfey6qft7nwf58apw6w"), "kn702nxfqb9cjmfey6qft7nwf58apw6w");
    assert.equal(perfilIdValido(" kn702nxfqb9cjmfey6qft7nwf58apw6w "), "kn702nxfqb9cjmfey6qft7nwf58apw6w");
    assert.equal(perfilIdValido("kn702nxfqb9c"), null, "un id corto no es un id de Convex");
    assert.equal(perfilIdValido("../otra"), null);
    assert.equal(perfilIdValido(""), null);
    assert.equal(perfilIdValido(undefined), null);
  });
});

describe("el límite Free, dicho con honestidad (CORE-214)", () => {
  const free = { isPro: false, limit: 1, remaining: 0, atLimit: true };
  const freeLibre = { isPro: false, limit: 1, remaining: 1, atLimit: false };
  const plus = { isPro: true, limit: null, remaining: null, atLimit: false };

  it("el rótulo del cupo cuenta contra el límite en Free y sin límite en Plus", () => {
    assert.equal(rotuloDeCupo(free, 1, true), "1 DE 1");
    assert.equal(rotuloDeCupo(freeLibre, 0, true), "0 DE 1");
    assert.equal(rotuloDeCupo(free, 1, false), "1 persona incluida");
    assert.equal(rotuloDeCupo(freeLibre, 0, false), "0 de 1 persona");
    assert.equal(rotuloDeCupo(plus, 3, true), "3 PERSONAS");
    assert.equal(rotuloDeCupo(plus, 1, false), "1 persona guardada");
  });

  it("la nota del plan y la lista vacía no prometen cupos que el plan no tiene", () => {
    assert.equal(notaDePlan(free), "Órbita Free incluye una persona.");
    assert.doesNotMatch(notaDePlan(plus), /Plus|Free/, "a quien ya es Plus no se le vende Plus");
    assert.match(copyDeListaVacia(freeLibre).texto, /Con Órbita Free podés guardar una\.$/);
    assert.doesNotMatch(copyDeListaVacia(plus).texto, /Free/);
  });

  it("agregar abre el alta salvo que Free ya haya usado su cupo: entonces muestra el límite", () => {
    assert.equal(accionDeAgregar(freeLibre), "alta");
    assert.equal(accionDeAgregar(free), "limite");
    assert.equal(accionDeAgregar(plus), "alta");
  });
});

describe("la biblioteca se ve como el frame (CORE-235)", () => {
  const fuente = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "screens", "VinculosScreen.tsx"), "utf8");
  const biblioteca = fuente.slice(fuente.indexOf("function Biblioteca("), fuente.indexOf("const styles = StyleSheet.create"));

  it("con el cupo lleno el único botón es editar a la persona elegida; agregar es un enlace mono que abre el límite", () => {
    assert.match(biblioteca, /access\.atLimit \? \(\s*editar\s*\)/);
    assert.match(biblioteca, /<PEnlace label="AGREGAR OTRA PERSONA" onPress=\{onAgregar\} \/>/);
    assert.doesNotMatch(biblioteca, /label="AGREGAR PERSONA" variante="contorno"/, "el frame no dibuja un segundo botón de agregar");
  });

  it("volver a la lista desde el límite es un enlace, no un botón", () => {
    assert.match(biblioteca, /<PEnlace label="VOLVER A LA LISTA" onPress=\{onVolver\} \/>/);
    assert.doesNotMatch(biblioteca, /PBoton label="VOLVER A LA LISTA"/);
  });

  it("en móvil el límite apila sus dos botones y el nivel va después de una línea (frames 1757:2579 / 1757:2475)", () => {
    assert.match(biblioteca, /!desktop && styles\.accionesApiladas/);
    assert.match(biblioteca, /\{!limite && !desktop \? <View style=\{styles\.separador\} \/> : null\}\s*\{!limite \? nivel : null\}/);
    assert.match(fuente, /accionesApiladas: \{ alignItems: "flex-start", flexDirection: "column" \}/);
  });
});

describe("la comparación se ve como el frame (CORE-236)", () => {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
  const pantalla = readFileSync(join(raiz, "src", "screens", "VinculoComparacionScreen.tsx"), "utf8");
  const ruta = readFileSync(join(raiz, "app", "reading", "vinculo-result.tsx"), "utf8");

  it("en web la ruta viaja dentro del shell con Vínculos activa, como /transito", () => {
    assert.match(ruta, /<WebAppShell active="vinculo">\s*<VinculoComparacionScreen \/>/);
    assert.match(ruta, /process\.env\.EXPO_OS !== "web"/);
  });

  it("la barra móvil dice ‹ VOLVER y es una acción; en escritorio el encabezado lleva el mismo rótulo", () => {
    assert.match(pantalla, /<OrbitaScreen canvas="wide" right=\{ROTULO_VOLVER\} onRight=\{volver\}>/);
    assert.match(pantalla, /<PEncabezado izquierda="VÍNCULOS · COMPARACIÓN" derecha=\{ROTULO_VOLVER\} onDerecha=\{volver\} \/>/);
    assert.doesNotMatch(pantalla, /DetailScreen/);
  });

  it("el lector de pantalla oye «Volver», no el chevron", () => {
    assert.equal(rotuloAccesible("‹ VOLVER"), "Volver");
    assert.equal(rotuloAccesible("NUEVA PERSONA"), "Nueva persona");
  });

  it("las dos cartas son discos en escritorio y chips en móvil; el titular corto sólo en escritorio", () => {
    assert.match(pantalla, /desktop \? \(\s*<View style=\{styles\.discos\}>\s*<VDiscos nombre=\{nombre\} \/>/);
    assert.match(pantalla, /<VPersonaChip inicial=\{inicial\(nombre\)\} nombre=\{nombre\} tono="cobre" \/>/);
    assert.match(pantalla, /desktop \? titularDeContactosCorto\(total\) : titularDeContactos\(total, nombre\)/);
  });
});
