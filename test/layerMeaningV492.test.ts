/**
 * La capa editorial de las capas de tiempo: significado + acción.
 *
 * Lo que se prueba acá NO es la redacción —eso cambia— sino las cuatro
 * garantías que la hacen publicable:
 *
 * 1. **Cobertura completa.** Las doce casas, las ocho fases, los cinco aspectos,
 *    las tres etapas, los puntos natales admitidos y los cuatro momentos del
 *    ciclo personal tienen texto. Ninguna combinación deja la pantalla en
 *    blanco ni cae en un `undefined`.
 * 2. **Determinismo.** La misma entrada devuelve exactamente la misma salida, y
 *    no hay reloj, azar ni estado adentro.
 * 3. **Guardrails.** Ni destino, ni diagnóstico, ni consejo médico, legal,
 *    financiero o psicológico. Es entretenimiento y autoconocimiento.
 * 4. **Honestidad del dato.** Sin casa publicada, el texto no nombra ninguna.
 *
 * Y, del lado de las pantallas, las regresiones que motivaron el bloque: el
 * resumen lunar que se decía tres veces, el mandala que repetía `ring.detail`
 * debajo del dibujo y el Ascendente que aparecía sin cúspide o con una casa que
 * no le corresponde.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  ACTION_HEADING,
  CUMPLELUNA_BOUNDARIES_PERCENT,
  CUMPLELUNA_MOMENTS,
  GUIDE_HEADING,
  GUIDE_STEP_LABEL,
  MEANING_HEADING,
  METHOD_HEADING,
  TRANSIT_DETAIL_EYEBROW,
  TRANSIT_MEANING_HEADING,
  TRANSIT_TIMING_HEADING,
  WHY_HEADING,
  cumplelunaMoment,
  cumplelunaStage,
  cumplelunaTransition,
  moonGuide,
  moonMeaning,
  moonWhy,
  nextCumplelunaMoment,
  seasonMeaning,
  transitMeaning,
  yearMeaning,
  type CumplelunaMoment,
  type Significado
} from "../src/domain/layerMeaning";
import { houseTheme } from "../src/domain/layers";
import type { LunarPhaseKey, TransitAspect, TransitState } from "../src/services/layersApi";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CASAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const FASES: readonly LunarPhaseKey[] = [
  "new",
  "crescent",
  "first_quarter",
  "gibbous",
  "full",
  "disseminating",
  "last_quarter",
  "balsamic"
];

const ASPECTOS: readonly TransitAspect[] = [
  "conjunction",
  "sextile",
  "square",
  "trine",
  "opposition"
];

const ETAPAS: readonly TransitState[] = ["approaching", "exact", "integrating"];

/**
 * Los puntos natales que el ranking admite, con el nombre EXACTO con el que el
 * contrato los publica: el sobre nombra los puntos en español, así que ése es el
 * nombre que la capa editorial tiene que saber leer.
 */
const PUNTOS_NATALES = [
  "Sol",
  "Luna",
  "Mercurio",
  "Venus",
  "Marte",
  "Júpiter",
  "Saturno",
  "Urano",
  "Neptuno",
  "Plutón",
  "Ascendente",
  "Descendente",
  "Medio Cielo",
  "Fondo del Cielo"
] as const;

/** Los planetas que pueden estar en tránsito, con el nombre del contrato. */
const PLANETAS_EN_TRANSITO = [
  "Sol",
  "Luna",
  "Mercurio",
  "Venus",
  "Marte",
  "Júpiter",
  "Saturno",
  "Urano",
  "Neptuno",
  "Plutón"
] as const;

const MOMENTOS: readonly CumplelunaMoment[] = ["inicio", "desarrollo", "revision", "cierre"];

// ---------------------------------------------------------------------------
// Guardrails: qué no puede decir NUNCA un texto de esta capa
// ---------------------------------------------------------------------------

/**
 * Lo prohibido, por familia.
 *
 * No es una lista de palabras feas: cada patrón corresponde a una de las cosas
 * que el producto no puede afirmar —destino, diagnóstico, consejo profesional—
 * y a la forma concreta en la que un texto de horóscopo suele colarse.
 */
const PROHIBIDO: readonly { patron: RegExp; familia: string }[] = [
  { patron: /\bdestino\b|\bestá escrito\b|\bpredice\b|\bpredicción\b/i, familia: "destino" },
  { patron: /\bva a (?:pasar|ocurrir|suceder|llegar|conocer)\b|\bte espera\b/i, familia: "hecho futuro" },
  { patron: /\bgarantiz|\bseguro que\b|\bsin duda vas\b|\binevitable\b/i, familia: "promesa" },
  { patron: /\bsuerte\b|\bafortunad|\bmala racha\b|\bkarma\b/i, familia: "fortuna" },
  {
    patron: /\bmédic|\bdiagnóst|\bsíntoma|\benfermedad|\btratamiento\b|\bterapia\b|\bterapeut|\bmedicaci|\bremedio\b|\bcurar\b|\bansiedad\b|\bdepresi/i,
    familia: "salud"
  },
  {
    patron: /\bdiagnostic|\btrastorno\b|\bpatolog|\btu psiquis\b|\btraumas?\b/i,
    familia: "diagnóstico"
  },
  {
    patron: /\binvertí\b|\binvertir\b|\binversión\b|\bacciones\b|\bcriptomoned|\bpréstamo\b|\bdeuda\b|\bcomprá\b|\bvendé\b|\bahorrá\b/i,
    familia: "dinero"
  },
  {
    patron: /\babogad|\bjuicio\b|\bdemand|\bdenunci|\bcontrato legal\b|\bherencia\b|\bdivorci/i,
    familia: "legal"
  }
];

/** Todo texto de la capa pasa por acá: es el gate, no una sugerencia. */
function assertTextoPublicable(texto: string, contexto: string) {
  assert.equal(typeof texto, "string", `${contexto}: no devolvió texto`);
  assert.ok(texto.trim().length >= 20, `${contexto}: texto demasiado corto («${texto}»)`);
  // Con límites de palabra y respetando la caja: `NaN` sin ellos casa dentro de
  // «funcio-nan-do», que es una palabra corriente del copy.
  assert.doesNotMatch(
    texto,
    /\bundefined\b|\bnull\b|\bNaN\b|\[object/,
    `${contexto}: se filtró un valor sin resolver`
  );
  assert.match(texto.trim(), /[.!?…]$/, `${contexto}: la frase no cierra («${texto}»)`);
  for (const { patron, familia } of PROHIBIDO) {
    assert.doesNotMatch(texto, patron, `${contexto}: entra en «${familia}» → «${texto}»`);
  }
}

function assertSignificado(valor: Significado, contexto: string) {
  assertTextoPublicable(valor.meaning, `${contexto} · significado`);
  assertTextoPublicable(valor.action, `${contexto} · acción`);
  assert.notEqual(valor.meaning, valor.action, `${contexto}: el significado y la acción no pueden ser el mismo texto`);
}

// ---------------------------------------------------------------------------
// La Luna: doce casas × ocho fases, y el camino sin casa
// ---------------------------------------------------------------------------

test("la Luna tiene significado y microacción para las doce casas y las ocho fases", () => {
  const acciones = new Set<string>();
  for (const casa of CASAS) {
    for (const fase of FASES) {
      const lectura = moonMeaning({ sign: "Cáncer", phaseKey: fase, natalHouse: casa });
      assertSignificado(lectura, `Luna casa ${casa} · fase ${fase}`);
      // La casa se nombra —es el dato personal— y con el área que le
      // corresponde, la misma tabla que usa el resto del producto.
      assert.match(lectura.meaning, new RegExp(`casa ${casa}\\b`));
      assert.ok(lectura.meaning.includes(houseTheme(casa) ?? ""), `la casa ${casa} tiene que decir su área`);
    }
    // La microacción es de la CASA: doce acciones distintas, una por área.
    acciones.add(moonMeaning({ sign: "Cáncer", phaseKey: "full", natalHouse: casa }).action);
  }
  assert.equal(acciones.size, 12, "cada casa tiene su propia microacción, no una genérica repetida");
});

test("sin casa publicada la Luna se apoya en signo y fase, y no inventa una casa", () => {
  for (const fase of FASES) {
    const lectura = moonMeaning({ sign: "Escorpio", phaseKey: fase, natalHouse: null });
    assertSignificado(lectura, `Luna sin casa · fase ${fase}`);
    assert.match(lectura.meaning, /Escorpio/, "el signo sí se puede afirmar sin hora");
    assert.doesNotMatch(
      lectura.meaning,
      /\bcasa \d+/i,
      "sin hora exacta no hay casa que nombrar: nombrar una sería inventarla"
    );
    assert.match(
      lectura.meaning,
      /hora exacta/i,
      "y se dice POR QUÉ no hay casa, en vez de dejar el hueco sin explicación"
    );
  }
  // La acción general cambia con la fase: sin casa igual hay algo para hacer.
  const generales = new Set(
    FASES.map((fase) => moonMeaning({ sign: "Escorpio", phaseKey: fase, natalHouse: null }).action)
  );
  assert.equal(generales.size, 8);
});

test("la guía del día tiene tres pasos para las doce casas y las ocho fases", () => {
  const priorizados = new Set<string>();
  const probados = new Set<string>();
  for (const casa of CASAS) {
    for (const fase of FASES) {
      const guia = moonGuide({ sign: "Cáncer", phaseKey: fase, natalHouse: casa });
      assertTextoPublicable(guia.prioriza, `guía casa ${casa} · fase ${fase} · priorizá`);
      assertTextoPublicable(guia.proba, `guía casa ${casa} · fase ${fase} · probá`);
      assertTextoPublicable(guia.observa, `guía casa ${casa} · fase ${fase} · observá`);
      // El ÁREA se dice una sola vez, en el paso que la usa. Ni la acción ni la
      // observación la repiten: ése era el defecto —la casa y su tema, tres
      // veces seguidas y con las mismas palabras—.
      const area = houseTheme(casa) ?? "";
      assert.ok(guia.prioriza.includes(area), `la casa ${casa} tiene que decir su área al priorizar`);
      assert.ok(!guia.proba.includes(area), "la acción no repite el área");
      assert.ok(!guia.observa.includes(area), "la observación tampoco");
      assert.match(guia.prioriza, new RegExp(`casa ${casa}\\b`));
      assert.doesNotMatch(guia.proba, /\bcasa \d+/i, "el número de la casa vive entre los datos");
      assert.doesNotMatch(guia.observa, /\bcasa \d+/i);

      // La observación son DOS frases: qué se nota del área y, aparte, el
      // momento del ciclo. Pegadas con una "Y" —«Suele notarse… Y aparece…»—
      // eran un solo renglón cosido, y leído en voz alta se notaba.
      assert.doesNotMatch(
        guia.observa,
        /[.!?…]\s+Y\s/,
        `guía casa ${casa} · fase ${fase}: la observación no puede coser las dos frases con una «Y»`
      );
      const frases = guia.observa.split(/(?<=[.!?…])\s+/).filter((frase) => frase.trim().length > 0);
      assert.ok(
        frases.length >= 2,
        `guía casa ${casa} · fase ${fase}: la observación tiene que ser dos frases («${guia.observa}»)`
      );
      for (const frase of frases) {
        assert.ok(frase.trim().length >= 20, `guía casa ${casa} · fase ${fase}: «${frase}» no es una frase`);
      }
    }
    priorizados.add(moonGuide({ sign: "Cáncer", phaseKey: "full", natalHouse: casa }).prioriza);
    probados.add(moonGuide({ sign: "Cáncer", phaseKey: "full", natalHouse: casa }).proba);
  }
  assert.equal(priorizados.size, 12, "cada casa prioriza lo suyo");
  assert.equal(probados.size, 12, "y tiene su propia microacción");

  // La observación cambia con la fase: es lo que aporta el ciclo del día.
  const observados = new Set(
    FASES.map((fase) => moonGuide({ sign: "Cáncer", phaseKey: fase, natalHouse: 7 }).observa)
  );
  assert.equal(observados.size, 8);

  // Los rótulos de los tres pasos son los que la pantalla imprime.
  assert.deepEqual(GUIDE_STEP_LABEL, { prioriza: "PRIORIZÁ", proba: "PROBÁ", observa: "OBSERVÁ" });
  assert.equal(GUIDE_HEADING, "TU GUÍA PARA HOY");
});

test("sin casa la guía no inventa ninguna y dice por qué falta", () => {
  for (const fase of FASES) {
    const guia = moonGuide({ sign: "Escorpio", phaseKey: fase, natalHouse: null });
    assertTextoPublicable(guia.prioriza, `guía sin casa · fase ${fase} · priorizá`);
    assertTextoPublicable(guia.proba, `guía sin casa · fase ${fase} · probá`);
    assertTextoPublicable(guia.observa, `guía sin casa · fase ${fase} · observá`);
    assert.match(guia.prioriza, /Escorpio/, "el signo sí se puede afirmar sin hora");
    assert.match(guia.prioriza, /hora exacta/i, "y se dice POR QUÉ no hay área");
    for (const paso of [guia.prioriza, guia.proba, guia.observa]) {
      assert.doesNotMatch(paso, /\bcasa \d+/i, "sin hora exacta no hay casa que nombrar");
    }
  }
  // Una casa fuera de rango es exactamente lo mismo que no tener casa.
  for (const casa of [0, 13, -1, 1.5, Number.NaN]) {
    const guia = moonGuide({ sign: "Aries", phaseKey: "new", natalHouse: casa });
    assert.doesNotMatch(guia.prioriza, /\bcasa \d+/i);
  }
});

test("por qué se muestra la Luna: el criterio, no el método, y sin casa inventada", () => {
  const conCasa = moonWhy(7);
  const sinCasa = moonWhy(null);
  assertTextoPublicable(conCasa, "por qué se muestra · con casa");
  assertTextoPublicable(sinCasa, "por qué se muestra · sin casa");
  assert.notEqual(conCasa, sinCasa, "sin casa hay algo más que explicar");
  assert.match(sinCasa, /hora exacta/i);
  for (const texto of [conCasa, sinCasa]) {
    assert.doesNotMatch(texto, /\bcasa \d+/i, "el criterio no nombra ninguna casa concreta");
    // Es el criterio de por qué aparece, no la ficha del método: eso vive en la
    // trazabilidad, y repetirlo acá sería decirlo dos veces.
    assert.doesNotMatch(texto, /ORB-|efeméride|versión/i);
  }
  assert.equal(WHY_HEADING, "POR QUÉ SE MUESTRA");
  assert.equal(METHOD_HEADING, "MÉTODO");
});

test("una casa fuera de rango se trata como si no hubiera casa", () => {
  for (const casa of [0, 13, -1, 1.5, Number.NaN]) {
    const lectura = moonMeaning({ sign: "Aries", phaseKey: "new", natalHouse: casa });
    assertSignificado(lectura, `Luna casa inválida ${casa}`);
    assert.doesNotMatch(lectura.meaning, /\bcasa \d+/i);
  }
});

// ---------------------------------------------------------------------------
// Tránsitos: planeta × punto natal × aspecto × etapa × casa
// ---------------------------------------------------------------------------

test("el significado de un tránsito cubre los cinco aspectos, las tres etapas y los puntos admitidos", () => {
  for (const planeta of PLANETAS_EN_TRANSITO) {
    for (const punto of PUNTOS_NATALES) {
      for (const aspecto of ASPECTOS) {
        for (const etapa of ETAPAS) {
          const lectura = transitMeaning({
            transitPlanet: planeta,
            natalPoint: punto,
            aspect: aspecto,
            state: etapa,
            natalHouse: null
          });
          assertSignificado(lectura, `${planeta} ${aspecto} ${punto} (${etapa})`);
          assert.ok(lectura.meaning.includes(planeta), "el planeta se nombra con el nombre del sobre");
          assert.ok(lectura.meaning.includes(punto), "y el punto natal también");
          assert.doesNotMatch(
            lectura.meaning,
            /\bcasa \d+/i,
            "sin casa publicada el tránsito no puede nombrar una"
          );
        }
      }
    }
  }
});

test("cada aspecto y cada etapa aportan una frase propia, no una plantilla repetida", () => {
  const porAspecto = new Set(
    ASPECTOS.map(
      (aspecto) =>
        transitMeaning({
          transitPlanet: "Saturno",
          natalPoint: "Sol",
          aspect: aspecto,
          state: "exact",
          natalHouse: null
        }).meaning
    )
  );
  assert.equal(porAspecto.size, 5, "los cinco aspectos se leen distinto");

  const porEtapa = new Set(
    ETAPAS.map(
      (etapa) =>
        transitMeaning({
          transitPlanet: "Saturno",
          natalPoint: "Sol",
          aspect: "square",
          state: etapa,
          natalHouse: null
        }).action
    )
  );
  assert.equal(porEtapa.size, 3, "la acción dice cuándo tiene sentido hacerla, y eso depende de la etapa");
});

test("con casa activada el tránsito la nombra una sola vez, con su área", () => {
  for (const casa of CASAS) {
    const lectura = transitMeaning({
      transitPlanet: "Marte",
      natalPoint: "Ascendente",
      aspect: "conjunction",
      state: "approaching",
      natalHouse: casa
    });
    assertSignificado(lectura, `tránsito en casa ${casa}`);
    assert.equal(
      (lectura.meaning.match(new RegExp(`casa ${casa}\\b`, "g")) ?? []).length,
      1,
      "la casa se dice una vez"
    );
    assert.ok(lectura.meaning.includes(houseTheme(casa) ?? ""), "y con el área que le corresponde");
  }
});

test("un punto o un planeta que la tabla no conoce no rompe el texto ni lo inventa", () => {
  const lectura = transitMeaning({
    transitPlanet: "Quirón",
    natalPoint: "Parte de Fortuna",
    aspect: "trine",
    state: "integrating",
    natalHouse: null
  });
  assertSignificado(lectura, "tránsito con nombres fuera de tabla");
  assert.ok(lectura.meaning.includes("Quirón"));
  assert.ok(lectura.meaning.includes("Parte de Fortuna"));
});

// ---------------------------------------------------------------------------
// Estación vital: las ocho fases traducidas a un verbo
// ---------------------------------------------------------------------------

test("la estación vital traduce las ocho fases a un tema y a los ocho verbos del ciclo", () => {
  const verbos = FASES.map((fase) => seasonMeaning(fase).verb);
  assert.deepEqual(verbos, [
    "iniciar",
    "sostener",
    "decidir",
    "ajustar",
    "mostrar",
    "compartir",
    "reordenar",
    "cerrar"
  ]);
  for (const fase of FASES) {
    const lectura = seasonMeaning(fase);
    assertSignificado(lectura, `estación vital ${fase}`);
    assert.ok(lectura.theme.trim().length > 0, `la fase ${fase} necesita un tema legible`);
    assert.doesNotMatch(lectura.theme, /^[A-Z_]+$/, "el tema es lenguaje, no una clave interna");
  }
  // Y la acción es prudente: escala de mes, no una orden para hoy.
  assert.equal(new Set(FASES.map((fase) => seasonMeaning(fase).action)).size, 8);
});

// ---------------------------------------------------------------------------
// Tema del año: las doce casas como área cotidiana
// ---------------------------------------------------------------------------

test("el tema del año traduce las doce casas a un área cotidiana con su acción", () => {
  const areas = new Set<string>();
  const acciones = new Set<string>();
  for (const casa of CASAS) {
    const lectura = yearMeaning(casa);
    assert.ok(lectura, `la casa ${casa} tiene que tener lectura anual`);
    assertSignificado(lectura, `tema del año casa ${casa}`);
    assert.ok(lectura.area.trim().length > 0);
    // El área NO repite la etiqueta de la carta: el título de la pantalla ya
    // escribe `Casa 7 · pareja, sociedades y acuerdos`, así que esto tiene que
    // decir otra cosa y no la misma frase dos veces.
    assert.notEqual(lectura.area, houseTheme(casa));
    areas.add(lectura.area);
    acciones.add(lectura.action);
  }
  assert.equal(areas.size, 12);
  assert.equal(acciones.size, 12);
  for (const casa of [0, 13, 7.5, Number.NaN]) {
    assert.equal(yearMeaning(casa), null, `la casa ${casa} no existe en el método`);
  }
});

// ---------------------------------------------------------------------------
// Cumpleluna: cuatro momentos según el avance
// ---------------------------------------------------------------------------

test("el ciclo personal se lee en cuatro tramos, con fronteras en 0/25/50/75/100", () => {
  // Las fronteras se declaran una sola vez, en porcentaje, y son las que la
  // pantalla imprime al lado del rótulo (`50–75 % DEL CICLO`).
  assert.deepEqual([...CUMPLELUNA_BOUNDARIES_PERCENT], [0, 25, 50, 75, 100]);
  assert.deepEqual([...CUMPLELUNA_MOMENTS], [...MOMENTOS]);

  assert.equal(cumplelunaMoment(0), "inicio");
  assert.equal(cumplelunaMoment(0.24), "inicio");
  assert.equal(cumplelunaMoment(0.25), "desarrollo");
  assert.equal(cumplelunaMoment(0.49), "desarrollo");
  assert.equal(cumplelunaMoment(0.5), "revision");
  assert.equal(cumplelunaMoment(0.74), "revision");
  assert.equal(cumplelunaMoment(0.75), "cierre");
  assert.equal(cumplelunaMoment(1), "cierre");
  // Fuera de rango y sin dato: se acota, no se rompe.
  assert.equal(cumplelunaMoment(-3), "inicio");
  assert.equal(cumplelunaMoment(4), "cierre");
  assert.equal(cumplelunaMoment(Number.NaN), "inicio");

  // Cada frontera declarada es EXACTAMENTE el borde de dos tramos consecutivos:
  // el de abajo termina un pelo antes y el de arriba empieza ahí. Sin esto, las
  // fronteras del módulo y las comparaciones del código podrían separarse.
  for (let i = 1; i < CUMPLELUNA_BOUNDARIES_PERCENT.length - 1; i += 1) {
    const frontera = CUMPLELUNA_BOUNDARIES_PERCENT[i] / 100;
    assert.equal(cumplelunaMoment(frontera), MOMENTOS[i], `la frontera ${i} abre su tramo`);
    assert.equal(cumplelunaMoment(frontera - 0.001), MOMENTOS[i - 1], `y cierra el anterior`);
  }

  const vistos = new Set<string>();
  const preguntas = new Set<string>();
  for (const avance of [0, 0.3, 0.6, 0.9]) {
    const tramo = cumplelunaStage(avance);
    assertTextoPublicable(tramo.focus, `cumpleluna avance ${avance} · foco`);
    assertTextoPublicable(tramo.action, `cumpleluna avance ${avance} · acción`);
    assertTextoPublicable(tramo.question, `cumpleluna avance ${avance} · pregunta`);
    assert.notEqual(tramo.focus, tramo.action, "el foco y la acción no pueden ser el mismo texto");
    assert.match(tramo.question, /\?$/, "la pregunta se hace, no se afirma");
    assert.ok(MOMENTOS.includes(tramo.moment));
    assert.match(tramo.label, /^[A-ZÁÉÍÓÚÑ ]+$/, "el rótulo del tramo va en versalita, como el resto");
    // El rango del tramo son dos fronteras consecutivas de la tabla.
    const indice = MOMENTOS.indexOf(tramo.moment);
    assert.equal(tramo.range.fromPercent, CUMPLELUNA_BOUNDARIES_PERCENT[indice]);
    assert.equal(tramo.range.toPercent, CUMPLELUNA_BOUNDARIES_PERCENT[indice + 1]);
    vistos.add(tramo.moment);
    preguntas.add(tramo.question);
    // Una sola acción por tramo: el ciclo dura ~29 días y una lista no se
    // sostiene tanto tiempo.
    assert.equal(tramo.action.split(/(?<=[.!?])\s+/).filter(Boolean).length <= 2, true);
  }
  assert.equal(vistos.size, 4);
  assert.equal(preguntas.size, 4, "cada tramo pregunta lo suyo, no una pregunta genérica repetida");
});

test("la transición al tramo siguiente sale de las dos raíces, y el cierre no la afirma", () => {
  const inicio = Date.UTC(2026, 7, 1);
  const fin = Date.UTC(2026, 7, 30);
  const largo = fin - inicio;

  // La cadena de tramos es la del recorrido, y termina.
  assert.equal(nextCumplelunaMoment("inicio"), "desarrollo");
  assert.equal(nextCumplelunaMoment("desarrollo"), "revision");
  assert.equal(nextCumplelunaMoment("revision"), "cierre");
  assert.equal(nextCumplelunaMoment("cierre"), null);

  for (const [avance, siguiente, frontera] of [
    [0.1, "desarrollo", 0.25],
    [0.3, "revision", 0.5],
    [0.6, "cierre", 0.75]
  ] as const) {
    const transicion = cumplelunaTransition({
      progress: avance,
      previousExactAt: inicio,
      nextExactAt: fin
    });
    assert.ok(transicion, `avance ${avance}: falta la transición`);
    assert.equal(transicion.next, siguiente);
    assert.equal(transicion.atMs, inicio + largo * frontera);
    // Y la fecha derivada cae, efectivamente, dentro del tramo que anuncia.
    assert.equal(cumplelunaMoment((transicion.atMs - inicio) / largo), siguiente);
  }

  // En el cierre no hay otro tramo: lo que viene es el próximo cumpleluna, que
  // la pantalla ya fecha como tal. Repetirlo sería contarlo dos veces.
  assert.equal(
    cumplelunaTransition({ progress: 0.9, previousExactAt: inicio, nextExactAt: fin }),
    null
  );

  // Raíces incoherentes o sin número: no se deriva ninguna frontera.
  for (const raices of [
    { previousExactAt: fin, nextExactAt: inicio },
    { previousExactAt: inicio, nextExactAt: inicio },
    { previousExactAt: Number.NaN, nextExactAt: fin },
    { previousExactAt: inicio, nextExactAt: Number.POSITIVE_INFINITY }
  ]) {
    assert.equal(cumplelunaTransition({ progress: 0.1, ...raices }), null);
  }
});

// ---------------------------------------------------------------------------
// Determinismo y pureza
// ---------------------------------------------------------------------------

test("la capa es determinística y no tiene reloj, azar ni backend adentro", () => {
  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    assert.equal(
      moonMeaning({ sign: "Libra", phaseKey: "gibbous", natalHouse: 7 }).meaning,
      moonMeaning({ sign: "Libra", phaseKey: "gibbous", natalHouse: 7 }).meaning
    );
    assert.equal(
      transitMeaning({
        transitPlanet: "Venus",
        natalPoint: "Luna",
        aspect: "opposition",
        state: "exact",
        natalHouse: 4
      }).action,
      transitMeaning({
        transitPlanet: "Venus",
        natalPoint: "Luna",
        aspect: "opposition",
        state: "exact",
        natalHouse: 4
      }).action
    );
    assert.equal(seasonMeaning("full").meaning, seasonMeaning("full").meaning);
    assert.equal(cumplelunaStage(0.42).action, cumplelunaStage(0.42).action);
    assert.equal(cumplelunaStage(0.42).question, cumplelunaStage(0.42).question);
    assert.equal(
      moonGuide({ sign: "Libra", phaseKey: "gibbous", natalHouse: 7 }).prioriza,
      moonGuide({ sign: "Libra", phaseKey: "gibbous", natalHouse: 7 }).prioriza
    );
    assert.equal(moonWhy(7), moonWhy(7));
    assert.equal(
      cumplelunaTransition({ progress: 0.1, previousExactAt: 1, nextExactAt: 100 })?.atMs,
      cumplelunaTransition({ progress: 0.1, previousExactAt: 1, nextExactAt: 100 })?.atMs
    );
  }

  const fuente = sinComentarios(leer("src/domain/layerMeaning.ts"));
  for (const prohibido of [
    /Date\.now\(/,
    /new Date\(/,
    /Math\.random\(/,
    /fetch\(/,
    /useQuery|useMutation|convex/i,
    /openai|anthropic|llm|prompt/i
  ]) {
    assert.doesNotMatch(fuente, prohibido, "la capa editorial es pura: tablas fijas y composición");
  }
  // Y no importa nada más que el dominio y los tipos del contrato.
  const imports = fuente.match(/from "([^"]+)"/g) ?? [];
  assert.deepEqual(imports, ['from "@/domain/layers"', 'from "@/services/layersApi"']);
});

// ---------------------------------------------------------------------------
// Regresiones de pantalla
// ---------------------------------------------------------------------------

test("el detalle de la Luna es una columna abierta con la lectura del día y el área una sola vez", () => {
  // La guía de tres pasos (`moonGuide`, arriba) sigue siendo la forma corta de
  // la Luna y se prueba entera como dominio. Lo que esta pantalla monta desde
  // QA22-026 es la forma LARGA —`moonReading`—, con la misma jerarquía que los
  // otros tres detalles de `Tu momento`.
  const pantalla = sinComentarios(leer("src/screens/v492/LunaDetailScreen.tsx"));

  // La repetición que se cierra: el resumen del cálculo, las filas CASA/TEMA y
  // la línea "Activa tu casa N, asociada a…" decían lo mismo, seguido.
  assert.doesNotMatch(pantalla, /houseLine/, "la línea «Activa tu casa N» ya no se dibuja acá");
  assert.doesNotMatch(pantalla, /data\.summary/, "el resumen del cálculo repetía casa y área: lo dice la lectura");
  assert.doesNotMatch(pantalla, /houseTheme|data\.houseTheme/, "el área viaja dentro de la lectura, no en una fila propia");

  // Columna abierta: sin tarjetas dentro de una pantalla que ya es una columna.
  assert.doesNotMatch(pantalla, /<Card>|\bCard\b/, "el detalle de la Luna no usa tarjetas");

  // La lectura sale del MISMO dato que los números de abajo: signo, fase y —sólo
  // si el cálculo la publicó— la casa. Ni un cuarto campo ni un texto propio.
  assert.match(pantalla, /moonReading\(\{\s*sign: data\.sign,\s*phaseKey: data\.phaseKey,\s*natalHouse: data\.natalHouse\s*\}\)/);
  // Desde el cuerpo del componente: en la línea del import los rótulos aparecen
  // en orden alfabético y eso no dice nada del orden en pantalla.
  const cuerpo = pantalla.slice(pantalla.indexOf("export function LunaDetailScreen"));
  const ahora = cuerpo.indexOf("READING_NOW_HEADING");
  const tema = cuerpo.indexOf("READING_THEME_HEADING");
  const tension = cuerpo.indexOf("MOON_TENSION_HEADING");
  const uso = cuerpo.indexOf("READING_USE_HEADING");
  const pregunta = cuerpo.indexOf("READING_QUESTION_HEADING");
  const limite = cuerpo.indexOf("lectura.caveat");
  const datos = cuerpo.indexOf("LOS DATOS EXACTOS");
  const porQue = cuerpo.indexOf("WHY_HEADING");
  const metodo = cuerpo.indexOf("METHOD_HEADING");
  const traza = cuerpo.indexOf("<TraceAccordion");
  assert.ok(ahora > 0, "la pantalla abre con qué marca ahora");
  assert.ok(tema > ahora, "y sigue con qué pone al frente");
  assert.ok(tension > tema, "la posibilidad y la tensión, después del tema");
  assert.ok(uso > tension && pregunta > uso, "cómo usarlo y la pregunta cierran la lectura");
  assert.ok(limite > pregunta, "el límite del dato se dice al pie de la lectura, no antes");
  assert.ok(datos > limite, "los datos exactos van después de la lectura");
  assert.ok(porQue > datos, "y por qué se muestra, después del dato");
  assert.ok(metodo > porQue && traza > metodo, "el método cierra la pantalla");

  // El número de la casa se IMPRIME una sola vez, entre los datos exactos. El
  // campo se lee cuatro veces —la lectura, la condición de la fila, la fila y el
  // criterio— pero sólo una de ellas escribe `Casa N` en pantalla.
  assert.equal((cuerpo.match(/`Casa \$\{data\.natalHouse\}`/g) ?? []).length, 1);
  assert.equal((cuerpo.match(/data\.natalHouse/g) ?? []).length, 4);
});

test("el detalle del tránsito explica antes de fechar y no repite la línea en una tabla", () => {
  const pantalla = sinComentarios(leer("src/screens/v492/ArcoDetailScreen.tsx"));
  const cuerpo = pantalla.slice(pantalla.indexOf("function ArcoContent"));

  const significado = cuerpo.indexOf("TRANSIT_MEANING_HEADING");
  const accion = cuerpo.indexOf("ACTION_HEADING");
  const duracion = cuerpo.indexOf("TRANSIT_TIMING_HEADING");
  const linea = cuerpo.indexOf("<ArcTimeline");
  assert.ok(significado > 0, "el detalle tiene que decir qué significa el contacto");
  assert.ok(accion > significado, "y después qué hacer con él");
  assert.ok(duracion > accion, "las dos cosas van ANTES de la duración y sus momentos");
  assert.ok(linea > duracion, "y la línea de tiempo, dentro de ese bloque");

  // El resumen técnico es UN bloque: `QUÉ ESTÁ PASANDO` decía en prosa el mismo
  // contacto que el titular ya dice en notación.
  assert.doesNotMatch(cuerpo, /QUÉ ESTÁ PASANDO/);
  assert.doesNotMatch(cuerpo, /LA VENTANA DE HOY/);
  // El resumen del arco se dibuja UNA vez. Desde QA22-009 pasa por
  // `summaryWithCanonicalState`, que sólo pone al día su frase de etapa: sigue
  // siendo el texto del sobre y sigue apareciendo una sola vez.
  assert.equal((cuerpo.match(/summaryWithCanonicalState\(arco\.summary/g) ?? []).length, 1);
  assert.equal((cuerpo.match(/\{resumen\}/g) ?? []).length, 1);

  // Y no vuelve la tabla de tres celdas: repetía, en mono, las mismas fechas que
  // la línea de tiempo ya rotula debajo de cada marca.
  assert.ok(!/<Celda\b/.test(cuerpo), "la tabla INICIO/PICO/CIERRE no vuelve");
  assert.ok(
    !/label="INICIO"|label="PICO"|label="CIERRE"/.test(cuerpo),
    "ni sus rótulos sueltos por otro camino"
  );

  assert.equal(TRANSIT_TIMING_HEADING, "DURACIÓN Y MOMENTOS CLAVE");
  assert.equal(TRANSIT_DETAIL_EYEBROW, "DETALLE DEL TRÁNSITO");
  assert.equal(TRANSIT_MEANING_HEADING, "QUÉ SIGNIFICA PARA VOS");
  assert.equal(MEANING_HEADING, "QUÉ SIGNIFICA HOY");
  assert.equal(ACTION_HEADING, "PARA BAJARLO A TIERRA");
});

test("el mandala deja exactamente una línea por ritmo y no repite `detail` cuando hay cálculo", () => {
  const pantalla = sinComentarios(leer("src/screens/v492/TransitosLayersScreen.tsx"));
  const mandala = pantalla.slice(pantalla.indexOf("function Mandala("), pantalla.indexOf("const styles ="));

  // Una línea por anillo del contrato: rótulo y estado, nada más. El contrato
  // publica CUATRO ritmos —estación vital, año personal, ritmo lunar y tránsito
  // activo—, así que un renglón por anillo son exactamente cuatro renglones.
  assert.match(mandala, /data\.rings\.map\(\(ring\)\s*=>/);
  assert.equal((mandala.match(/style=\{styles\.ring\}/g) ?? []).length, 1, "un solo renglón por ritmo");
  assert.doesNotMatch(mandala, /mandalaPie/, "el pie explicativo no vuelve debajo de la leyenda");
  assert.doesNotMatch(mandala, /ring\.cadence/, "la cadencia ya se dice en el encabezado del bloque");
  assert.equal((mandala.match(/ring\.state/g) ?? []).length, 2, "el estado se dibuja y se anuncia, y no más");

  // `detail` sólo en la rama SIN cálculo, y una sola vez por anillo.
  assert.equal((mandala.match(/ring\.detail/g) ?? []).length, 2, "una vez en el texto y una en la voz");
  const conCalculo = mandala.slice(mandala.indexOf("ring.available ? ("), mandala.indexOf(") : ("));
  assert.doesNotMatch(conCalculo, /ring\.detail/, "un ritmo disponible no imprime el resumen entero del análisis");
  assert.doesNotMatch(mandala, /ringProgressMode|progressRange|formatPercent/, "el avance lo dibuja el anillo");

  // Dibujo y leyenda no anuncian lo mismo: la imagen ya no enumera los ritmos.
  const dials = sinComentarios(leer("src/components/v492/Dials.tsx"));
  const etiqueta = dials.slice(dials.indexOf("function mandalaLabel"));
  assert.doesNotMatch(etiqueta, /De afuera hacia adentro: \$\{detalle\}/);
  assert.match(etiqueta, /se lee en las líneas que siguen/);
  assert.match(mandala, /accessibilityLabel=\{`\$\{ring\.label\}: /, "cada línea se anuncia sola, con su estado");
});

test("Tu momento pone significado y acción antes de las fechas, y el método al final", () => {
  const pantalla = sinComentarios(leer("src/screens/v492/TransitosLayersScreen.tsx"));

  const estacion = pantalla.slice(pantalla.indexOf("function EstacionVital"), pantalla.indexOf("function anoDeFase"));
  assert.match(estacion, /seasonMeaning\(data\.phaseKey\)/);
  // El verbo y el tema se LEEN: traducen el nombre de la fase en un renglón.
  assert.match(estacion, /Etapa de \$\{lectura\.verb\}: \$\{lectura\.theme\}/);
  assert.ok(
    estacion.indexOf("lectura.meaning") < estacion.indexOf("<MeterBar"),
    "el significado va antes de la barra de avance"
  );
  assert.ok(estacion.indexOf("lectura.action") < estacion.indexOf("styles.fechas"), "y la acción, antes de las fechas");
  assert.doesNotMatch(estacion, /data\.summary/, "el resumen del cálculo repetía el nombre de la fase y el método");

  const ano = pantalla.slice(pantalla.indexOf("function TemaDelAno"), pantalla.indexOf("function Mandala("));
  assert.match(ano, /yearMeaning\(data\.house\)/);
  assert.ok(ano.indexOf("lectura.meaning") < ano.indexOf("<MeterBar"), "el año también explica antes de medir");

  // El método sigue estando, entero, pero DESPUÉS del dato: el bloque `Metodo`
  // se monta entre la capa y su acordeón, nunca antes de la visual. Son DOS: la
  // estación vital y la profección. El mandala no lo lleva (ver abajo).
  const momento = pantalla.slice(pantalla.indexOf("function MomentoView"), pantalla.indexOf("function Metodo("));
  assert.equal((momento.match(/<Metodo nombre=/g) ?? []).length, 2, "las dos capas con datos nombran su método");
  for (const capa of ["progressedLunation", "annualProfection"]) {
    const bloque = momento.slice(momento.indexOf(`${capa}.data ?`));
    assert.ok(
      bloque.indexOf("<Metodo") < bloque.indexOf("<TraceAccordion"),
      `${capa}: el método va entre el dato y la trazabilidad`
    );
  }

  // El mandala es la excepción y la razón es de lectura, no de estilo: debajo
  // del dibujo van sus CUATRO líneas —una por ritmo— y enseguida el acordeón.
  // Un párrafo de método en el medio era la tercera vez que la pantalla
  // explicaba el mismo dibujo, y lo que separa las líneas de la trazabilidad
  // tiene que ser nada: ni `Metodo`, ni una nota, ni un pie.
  const bloque03 = momento.slice(momento.indexOf('index="03"'));
  const traza = bloque03.indexOf("<TraceAccordion");
  assert.ok(traza > 0, "el mandala conserva su trazabilidad propia");
  const cierre = bloque03.lastIndexOf(")}", traza);
  assert.ok(cierre > 0, "el mandala se monta detrás de su condicional de dato");
  assert.equal(
    // Se descartan los espacios y las llaves que deja el comentario JSX ya
    // borrado: lo que quede es texto o markup, y ahí no puede quedar ninguno.
    bloque03.slice(cierre + 2, traza).replace(/[\s{}]/g, ""),
    "",
    "entre las cuatro líneas del mandala y su acordeón no va nada visible"
  );
});

test("el cumpleluna dice en qué tramo estás, con foco, acción y pregunta", () => {
  const pantalla = sinComentarios(leer("src/screens/v492/CumplelunaDetailScreen.tsx"));
  // El tramo se sigue eligiendo acá —`cumplelunaStage`, con sus fronteras—, pero
  // desde QA22-025 lo que la pantalla dibuja es la LECTURA del ciclo: el foco, el
  // gesto y la pregunta del tramo entran ya compuestos por `cumplelunaReading`,
  // con la misma jerarquía que los otros tres detalles de `Tu momento`.
  assert.match(pantalla, /cumplelunaStage\(/);
  assert.match(pantalla, /cumplelunaReading\(\{/);
  assert.match(pantalla, /tramo\.label/);
  // Las fronteras se imprimen al lado del rótulo: son lo que convierte
  // «REVISIÓN» en un dato y no en una palabra elegida por alguien.
  assert.match(pantalla, /tramo\.range\.fromPercent/);
  assert.match(pantalla, /tramo\.range\.toPercent/);
  // Y los tres textos del tramo no se dibujan ADEMÁS sueltos: `lectura.theme` ya
  // lleva el foco adentro, y `use` y `question` SON los del tramo. Imprimirlos
  // por su cuenta sería la misma frase dos veces.
  for (const suelto of [/tramo\.focus/, /tramo\.action/, /tramo\.question/]) {
    assert.doesNotMatch(pantalla, suelto, "los textos del tramo viajan dentro de la lectura");
  }
  // El tramo se elige con el avance del sobre, y con la franja se usa su centro
  // SIN afirmarlo como número: es una etiqueta cualitativa.
  assert.match(pantalla, /franja \? \(franja\.from \+ franja\.to\) \/ 2 : data\.progress/);

  // La jerarquía nueva, entera y en orden, dentro del bloque que la dibuja: cada
  // rótulo con su texto debajo —qué marca ahora → qué pone al frente → cómo
  // usarlo → para observar— y el límite del dato al pie.
  const inicio = pantalla.indexOf("function Lectura(");
  assert.ok(inicio > 0, "los textos del ciclo viven en el componente `Lectura`");
  const bloque = pantalla.slice(inicio);
  let anterior = -1;
  for (const [rotulo, campo] of [
    ["READING_NOW_HEADING", "lectura.now"],
    ["READING_THEME_HEADING", "lectura.theme"],
    ["READING_USE_HEADING", "lectura.use"],
    ["READING_QUESTION_HEADING", "lectura.question"]
  ] as const) {
    const posRotulo = bloque.indexOf(rotulo);
    const posCampo = bloque.indexOf(campo);
    assert.ok(posRotulo > anterior, `${rotulo}: falta o quedó fuera de orden`);
    assert.ok(posCampo > posRotulo, `${campo}: el texto va debajo de su rótulo`);
    anterior = posCampo;
  }
  const limite = bloque.indexOf("lectura.caveat");
  assert.ok(limite > anterior, "el límite del dato se dice al pie de la lectura, no antes");

  // Y el bloque entero se monta antes que la tabla de números.
  const montaLectura = pantalla.indexOf("<Lectura");
  const tablaDeNumeros = pantalla.indexOf("LOS NÚMEROS DEL CICLO");
  assert.ok(montaLectura > 0, "la pantalla monta la lectura del ciclo");
  assert.ok(montaLectura < tablaDeNumeros, "la lectura del tramo va antes de la tabla de números");
});

test("la transición de tramo del cumpleluna sólo se afirma con raíz exacta", () => {
  const pantalla = sinComentarios(leer("src/screens/v492/CumplelunaDetailScreen.tsx"));
  const inicio = pantalla.indexOf("const transicion =");
  assert.ok(inicio > 0, "la pantalla resuelve la transición en una sola expresión");
  const llamada = pantalla.slice(inicio, inicio + 400);

  // La condición es la precisión del sobre, y las dos raíces salen del dato.
  assert.match(llamada, /exacto && data/, "sin raíz exacta no se calcula ninguna frontera");
  assert.match(llamada, /cumplelunaTransition\(\{/);
  assert.match(llamada, /previousExactAt: data\.previousExactAt/);
  assert.match(llamada, /nextExactAt: data\.nextExactAt/);
  // Y el único lugar donde se dibuja es detrás de ese valor: sin transición no
  // hay fecha de cambio de tramo en pantalla.
  assert.equal((pantalla.match(/transicion \?/g) ?? []).length, 1);
  assert.equal((pantalla.match(/transicion\.atMs/g) ?? []).length, 1);
});

test("el cumpleluna abre con la etapa del ciclo y el número va debajo de su lectura", () => {
  // Dos defectos en el mismo lugar. El primero: arriba de todo, antes del
  // estado y antes del significado, había un párrafo que explicaba QUÉ es el
  // ángulo Sol-Luna. El segundo: la pantalla abría con el anillo y con
  // `data.summary` —que es el resumen del CÁLCULO— o sea dos formas del mismo
  // número, "día 12 de 29,5", antes de decir qué significa estar en ese punto.
  // Las dos cosas son metodología y las dos viven en `TraceAccordion`, al pie.
  const pantalla = sinComentarios(leer("src/screens/v492/CumplelunaDetailScreen.tsx"));
  const cuerpo = pantalla.slice(pantalla.indexOf("<Title>"));

  const antesDeLaTraza = cuerpo.slice(0, cuerpo.indexOf("<TraceAccordion"));
  assert.doesNotMatch(
    antesDeLaTraza,
    /ángulo entre el Sol y la Luna/i,
    "qué es el ángulo Sol-Luna lo explica el acordeón técnico, no la apertura"
  );
  assert.doesNotMatch(
    pantalla,
    /data\.summary/,
    "el resumen del cálculo explica cómo se llegó al número: eso es MÉTODO, no apertura"
  );
  assert.doesNotMatch(pantalla, /<Card>|\bCard\b/, "el ciclo lunar tampoco usa tarjetas");

  // El orden aprobado, leído sobre el render y no sobre el comentario que lo
  // describe: la lectura de la etapa —qué marca ahora, qué pone al frente, cómo
  // usarlo y la pregunta— → día y avance del ciclo, con el próximo → los números
  // → el método.
  const lectura = cuerpo.indexOf("<Lectura");
  const anillo = cuerpo.indexOf("<CycleRing");
  const numeros = cuerpo.indexOf("LOS NÚMEROS DEL CICLO");
  const traza = cuerpo.indexOf("<TraceAccordion");
  assert.ok(lectura > 0, "la pantalla conserva la lectura del tramo del ciclo");
  assert.ok(lectura < anillo, "la etapa se lee ANTES que el número que la produjo");
  assert.ok(anillo < numeros, "y el día del ciclo, antes de la tabla de números");
  assert.ok(numeros < traza, "y la trazabilidad al final de todo");

  // Entre el título y la lectura no puede aparecer prosa de ningún tipo: sólo el
  // estado del sobre, que es una línea y no un párrafo.
  const antesDeLaLectura = cuerpo.slice(0, lectura);
  for (const prosa of [/<Body/, /<Note/, /<Subtitle/]) {
    assert.doesNotMatch(antesDeLaLectura, prosa, "arriba de la etapa no va un párrafo");
  }
  assert.match(antesDeLaLectura, /<StatusLine/, "el estado del sobre sí abre, en una línea");

  // Lo que la reordenación NO puede haberse llevado puesto: los rangos del
  // camino sin raíz exacta y la fecha de la transición al tramo siguiente.
  assert.match(pantalla, /progressBand/, "la franja del avance acotado sigue saliendo del sobre");
  assert.match(
    pantalla,
    /franja \? \(franja\.from \+ franja\.to\) \/ 2 : data\.progress/,
    "y sigue siendo la que elige el tramo cuando el avance sólo se puede acotar"
  );
  assert.match(cuerpo, /hoy tu avance sólo se puede acotar/, "el anillo sigue diciendo que dibuja una referencia");
  assert.match(cuerpo, /PRÓXIMO, EN RANGO/, "el próximo cumpleluna sigue diciendo su rango");
  assert.match(cuerpo, /SIN_RAIZ_EXACTA/, "y la tabla sigue explicando por qué son intervalos");
});
