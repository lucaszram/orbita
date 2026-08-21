/**
 * QA22-024, QA22-025 y QA22-026 — los cuatro ritmos de `Tu momento` se pueden
 * leer y se pueden abrir.
 *
 * Lo que se prueba acá no es la redacción —eso cambia— sino las garantías que
 * hacen publicable la capa nueva (`src/domain/layerReading.ts`) y la navegación
 * que la vuelve alcanzable:
 *
 * 1. **Cobertura completa.** Las ocho fases, las doce casas, los doce signos,
 *    los cuatro tramos del ciclo personal y los diez regentes tienen texto.
 *    Ninguna combinación deja un bloque vacío ni cae en `undefined`.
 * 2. **Honestidad del dato.** Sin casa no se nombra ninguna; sin raíz exacta no
 *    se afirma un día del ciclo; sin hora, el año no inventa una casa.
 * 3. **Guardrails.** Ni destino, ni diagnóstico, ni consejo profesional.
 * 4. **Determinismo y pureza.** Sin reloj, sin azar, sin red y sin LLM.
 * 5. **La jerarquía es la misma en los cuatro detalles**, y en ese orden: qué
 *    marca ahora → qué pone al frente → cómo usarlo → para observar → los datos
 *    → método y trazabilidad.
 * 6. **Los cuatro ritmos ofrecen acceso** con el rótulo exacto, una sola vez, y
 *    sólo cuando ese ritmo se puede calcular.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { SECTION_LAYER_DETAILS, layerDetailHref } from "../src/domain/detailOrigin";
import { houseTheme } from "../src/domain/layers";
import {
  METHOD_HEADING,
  WHY_HEADING,
  cumplelunaStage,
  moonHouseNotice,
  moonPhaseAction,
  moonPhaseClimate
} from "../src/domain/layerMeaning";
import {
  MOON_TENSION_HEADING,
  READING_NOW_HEADING,
  READING_QUESTION_HEADING,
  READING_THEME_HEADING,
  READING_USE_HEADING,
  SEASON_CYCLE_HEADING,
  SEASON_DATA_HEADING,
  SEASON_DETAIL_EYEBROW,
  SEASON_TRACE,
  YEAR_DATA_HEADING,
  YEAR_DETAIL_EYEBROW,
  YEAR_RULER_HEADING,
  YEAR_TRACE,
  cumplelunaReading,
  moonReading,
  seasonReading,
  yearReading,
  type LayerReading
} from "../src/domain/layerReading";
import type { LunarPhaseKey } from "../src/services/layersApi";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const MOMENTO = "src/screens/v492/TransitosLayersScreen.tsx";
const ESTACION = "src/screens/v492/EstacionDetailScreen.tsx";
const ANO = "src/screens/v492/AnoDetailScreen.tsx";
const CUMPLELUNA = "src/screens/v492/CumplelunaDetailScreen.tsx";
const LUNA = "src/screens/v492/LunaDetailScreen.tsx";
const RUTA_CAPA = "src/routes/v492/transitos-capa.tsx";

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

/** Los nombres que el ensamblador publica para cada fase (`data.name`). */
const NOMBRE_DE_FASE: Record<LunarPhaseKey, string> = {
  new: "Nueva",
  crescent: "Creciente",
  first_quarter: "Cuarto creciente",
  gibbous: "Gibosa",
  full: "Llena",
  disseminating: "Diseminante",
  last_quarter: "Cuarto menguante",
  balsamic: "Balsámica"
};

/** Los doce signos, con el nombre EXACTO con el que el contrato los publica. */
const SIGNOS = [
  "Aries",
  "Tauro",
  "Géminis",
  "Cáncer",
  "Leo",
  "Virgo",
  "Libra",
  "Escorpio",
  "Sagitario",
  "Capricornio",
  "Acuario",
  "Piscis"
] as const;

/** Los regentes que el método publica, más los tres modernos por las dudas. */
const REGENTES = [
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

// ---------------------------------------------------------------------------
// Guardrails: lo mismo que exige `layerMeaning`, aplicado a la capa nueva
// ---------------------------------------------------------------------------

const PROHIBIDO: readonly { patron: RegExp; familia: string }[] = [
  { patron: /\bdestino\b|\bestá escrito\b|\bpredice\b|\bpredicción\b/i, familia: "destino" },
  { patron: /\bva a (?:pasar|ocurrir|suceder|llegar|conocer)\b|\bte espera\b/i, familia: "hecho futuro" },
  { patron: /\bgarantiz|\bseguro que\b|\bsin duda vas\b|\binevitable\b/i, familia: "promesa" },
  { patron: /\bsuerte\b|\bafortunad|\bmala racha\b|\bkarma\b/i, familia: "fortuna" },
  {
    patron: /\bmédic|\bdiagnóst|\bsíntoma|\benfermedad|\btratamiento\b|\bterapia\b|\bterapeut|\bmedicaci|\bremedio\b|\bcurar\b|\bansiedad\b|\bdepresi/i,
    familia: "salud"
  },
  { patron: /\bdiagnostic|\btrastorno\b|\bpatolog|\btu psiquis\b|\btraumas?\b/i, familia: "diagnóstico" },
  {
    patron: /\binvertí\b|\binvertir\b|\binversión\b|\bacciones\b|\bcriptomoned|\bpréstamo\b|\bdeuda\b|\bcomprá\b|\bvendé\b|\bahorrá\b/i,
    familia: "dinero"
  },
  {
    patron: /\babogad|\bjuicio\b|\bdemand|\bdenunci|\bcontrato legal\b|\bherencia\b|\bdivorci/i,
    familia: "legal"
  }
];

function assertTextoPublicable(texto: string, contexto: string) {
  assert.equal(typeof texto, "string", `${contexto}: no devolvió texto`);
  assert.ok(texto.trim().length >= 20, `${contexto}: texto demasiado corto («${texto}»)`);
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

/**
 * La jerarquía completa de una lectura.
 *
 * Los cuatro pasos traen texto publicable, ninguno repite a otro —si dos
 * bloques dicen lo mismo, la pantalla ocupa el doble para decir la mitad— y la
 * pregunta es una pregunta de verdad.
 */
function assertLectura(lectura: LayerReading, contexto: string) {
  assertTextoPublicable(lectura.now, `${contexto} · qué marca ahora`);
  assertTextoPublicable(lectura.theme, `${contexto} · qué pone al frente`);
  assertTextoPublicable(lectura.use, `${contexto} · cómo usarlo`);
  assertTextoPublicable(lectura.question, `${contexto} · para observar`);
  assert.match(lectura.question.trim(), /^¿.*\?$/, `${contexto}: la pregunta no está bien formada`);
  const piezas = [lectura.now, lectura.theme, lectura.use, lectura.question];
  assert.equal(new Set(piezas).size, piezas.length, `${contexto}: dos bloques dicen lo mismo`);
  if (lectura.caveat !== null) assertTextoPublicable(lectura.caveat, `${contexto} · límite`);
}

// ---------------------------------------------------------------------------
// Estación vital: las ocho fases
// ---------------------------------------------------------------------------

test("la estación vital desarrolla las ocho fases con lo que se abre, lo que se cierra y un gesto prudente", () => {
  const aperturas = new Set<string>();
  const cierres = new Set<string>();
  const preguntas = new Set<string>();

  for (const fase of FASES) {
    for (const exact of [true, false]) {
      const lectura = seasonReading({
        phaseKey: fase,
        phaseName: NOMBRE_DE_FASE[fase],
        exact
      });
      assertLectura(lectura, `estación ${fase} (${exact ? "exacta" : "estimada"})`);
      assertTextoPublicable(lectura.opens, `estación ${fase} · se abre`);
      assertTextoPublicable(lectura.closes, `estación ${fase} · se cierra`);
      assert.notEqual(lectura.opens, lectura.closes, `estación ${fase}: abrir y cerrar no son lo mismo`);

      // La apertura nombra la fase con el nombre que trae el cálculo, no con uno
      // propio: el título de la pantalla y este párrafo tienen que decir lo mismo.
      assert.ok(
        lectura.now.includes(NOMBRE_DE_FASE[fase].toLocaleLowerCase("es")),
        `estación ${fase}: la apertura no nombra la fase del sobre`
      );
      // Y la acción es de escala mensual: una fase dura años y un gesto que
      // prometa resolverla hoy mentiría sobre el propio método.
      assert.match(lectura.use, /escala mensual/, `estación ${fase}: la acción no declara su escala`);
      assert.doesNotMatch(lectura.use, /\bhoy\b/, `estación ${fase}: un ciclo de años no se resuelve hoy`);
    }
    aperturas.add(seasonReading({ phaseKey: fase, phaseName: "x", exact: true }).opens);
    cierres.add(seasonReading({ phaseKey: fase, phaseName: "x", exact: true }).closes);
    preguntas.add(seasonReading({ phaseKey: fase, phaseName: "x", exact: true }).question);
  }

  // Ocho fases, ocho lecturas distintas: una plantilla repetida no es cobertura.
  assert.equal(aperturas.size, 8, "cada fase abre algo propio");
  assert.equal(cierres.size, 8, "cada fase cierra algo propio");
  assert.equal(preguntas.size, 8, "cada fase tiene su pregunta");
});

test("sin hora exacta la estación afirma la etapa y no el día en que empezó", () => {
  const exacta = seasonReading({ phaseKey: "gibbous", phaseName: "Gibosa", exact: true });
  const estimada = seasonReading({ phaseKey: "gibbous", phaseName: "Gibosa", exact: false });

  assert.equal(exacta.caveat, null, "con raíz exacta no hay límite que declarar");
  assert.ok(estimada.caveat, "sin hora exacta el borde de la fase tiene margen y se dice");
  assert.match(estimada.caveat ?? "", /hora exacta/i);
  assert.match(estimada.caveat ?? "", /etapa/i);

  // Y lo único que cambia es el límite: la lectura de la fase es la misma, porque
  // la fase se sostiene igual. Si cambiara, la falta de hora estaría cambiando la
  // interpretación en vez de su margen.
  assert.equal(exacta.now, estimada.now);
  assert.equal(exacta.theme, estimada.theme);
  assert.equal(exacta.opens, estimada.opens);
  assert.equal(exacta.use, estimada.use);
  assert.equal(exacta.question, estimada.question);
});

// ---------------------------------------------------------------------------
// Tema del año: las doce casas, los regentes y el mes dentro del año
// ---------------------------------------------------------------------------

test("el año desarrolla las doce casas con regente, mes del año y cómo vivir el foco", () => {
  const temas = new Set<string>();
  const preguntas = new Set<string>();

  for (const casa of CASAS) {
    for (let mes = 1; mes <= 12; mes += 1) {
      const lectura = yearReading({ house: casa, ruler: "Saturno", monthIndex: mes, exact: true });
      assert.ok(lectura, `casa ${casa}: el método editorial tiene que tenerla`);
      assertLectura(lectura, `año casa ${casa} mes ${mes}`);
      assertTextoPublicable(lectura.ruler, `año casa ${casa} · regente`);
      assertTextoPublicable(lectura.month, `año casa ${casa} mes ${mes} · tramo`);

      // La casa se NOMBRA en la apertura y el mes también: son los dos datos que
      // ubican a la persona dentro del recorrido.
      assert.match(lectura.now, new RegExp(`casa ${casa}\\b`), `casa ${casa}: la apertura no la nombra`);
      assert.ok(lectura.now.includes(`mes ${mes} de 12`), `casa ${casa}: falta el mes dentro del año`);
      // Y NO repite la etiqueta del área: eso ya está en el título y en la tabla
      // de datos. Lo que interpreta el área es `theme` (QA22-024).
      const area = houseTheme(casa);
      assert.ok(area, `casa ${casa}: el producto tiene un área para ella`);
      assert.ok(
        !lectura.now.includes(area ?? ""),
        `casa ${casa}: la apertura repite la etiqueta del área en vez de leerla`
      );
    }
    temas.add(yearReading({ house: casa, ruler: "Venus", monthIndex: 1, exact: true })!.theme);
    preguntas.add(yearReading({ house: casa, ruler: "Venus", monthIndex: 1, exact: true })!.question);
  }

  assert.equal(temas.size, 12, "cada casa pone al frente algo propio");
  assert.equal(preguntas.size, 12, "cada casa tiene su pregunta");
});

test("el mes del año cae en uno de cuatro tramos, y un mes imposible no inventa ninguno", () => {
  const tramos = new Map<string, number[]>();
  for (let mes = 1; mes <= 12; mes += 1) {
    const texto = yearReading({ house: 7, ruler: "Venus", monthIndex: mes, exact: true })!.month;
    tramos.set(texto, [...(tramos.get(texto) ?? []), mes]);
  }
  assert.equal(tramos.size, 4, "el año personal se lee en cuatro tramos de tres meses");
  for (const meses of tramos.values()) assert.equal(meses.length, 3);

  // Un mes fuera de 1–12 —un sobre viejo, un cálculo raro— no se ubica en un
  // tramo inventado ni se escribe en la apertura.
  for (const mes of [0, 13, -1, 1.5, Number.NaN]) {
    const lectura = yearReading({ house: 7, ruler: "Venus", monthIndex: mes, exact: true });
    assert.ok(lectura, `mes ${mes}: la casa sigue teniendo lectura`);
    assertLectura(lectura, `año con mes ${mes}`);
    assert.doesNotMatch(lectura.now, /mes \d/, `mes ${mes}: la apertura escribió un mes que no existe`);
    assert.match(lectura.month, /no publicó/i, `mes ${mes}: el tramo tiene que decir que falta`);
  }
});

test("cada regente aporta su propia línea, y uno fuera de tabla se nombra sin inventarle sentido", () => {
  const lineas = new Set<string>();
  for (const regente of REGENTES) {
    const lectura = yearReading({ house: 10, ruler: regente, monthIndex: 5, exact: true });
    assert.ok(lectura);
    assertTextoPublicable(lectura.ruler, `regente ${regente}`);
    assert.ok(lectura.ruler.includes(regente), `regente ${regente}: se lo nombra con el nombre del sobre`);
    lineas.add(lectura.ruler);
  }
  assert.equal(lineas.size, REGENTES.length, "los regentes no comparten una plantilla");

  const raro = yearReading({ house: 10, ruler: "Quirón", monthIndex: 5, exact: true });
  assert.ok(raro);
  assertTextoPublicable(raro.ruler, "regente fuera de tabla");
  assert.ok(raro.ruler.includes("Quirón"), "un regente desconocido se nombra igual");
});

test("una casa que el método no tiene no recibe lectura inventada", () => {
  for (const casa of [0, 13, -1, 7.5, Number.NaN]) {
    assert.equal(
      yearReading({ house: casa, ruler: "Venus", monthIndex: 3, exact: true }),
      null,
      `la casa ${casa} no existe en el método`
    );
  }
});

test("sin raíz exacta el año declara que sus bordes tienen margen", () => {
  const exacta = yearReading({ house: 4, ruler: "Luna", monthIndex: 8, exact: true })!;
  const estimada = yearReading({ house: 4, ruler: "Luna", monthIndex: 8, exact: false })!;
  assert.equal(exacta.caveat, null);
  assert.ok(estimada.caveat);
  assert.match(estimada.caveat ?? "", /margen/i);
  assert.equal(exacta.now, estimada.now, "el margen no cambia qué casa te toca");
});

// ---------------------------------------------------------------------------
// Cumpleluna: la apertura con los dos números, cuando son seguros
// ---------------------------------------------------------------------------

/** Un avance por tramo, para recorrer los cuatro con una sola tabla. */
const AVANCES = [0.05, 0.3, 0.6, 0.9] as const;

test("el cumpleluna abre con «Estás en {etapa}, día X de Y» cuando esos números son seguros", () => {
  for (const avance of AVANCES) {
    const tramo = cumplelunaStage(avance);
    const lectura = cumplelunaReading({
      progress: avance,
      cycleDay: 12.4,
      cycleLength: 29.5,
      exact: true,
      lunarType: "Luna gibosa creciente"
    });
    assertLectura(lectura, `cumpleluna ${tramo.moment}`);
    assert.equal(
      lectura.now,
      `Estás en ${tramo.label.toLocaleLowerCase("es")}, día 12,4 de 29,5.`,
      `${tramo.moment}: la apertura no dice la etapa y los dos números`
    );
    assert.equal(lectura.caveat, null, "con raíz exacta no hay límite que declarar");
    // La síntesis conecta el tramo con el dato lunar de nacimiento, que es de
    // donde se cuenta el ciclo: sin eso, los números quedan sueltos.
    assert.ok(lectura.theme.includes(tramo.focus), `${tramo.moment}: falta el foco del tramo`);
    assert.match(lectura.theme, /luna gibosa creciente/i, "el tipo lunar entra en la síntesis");
    assert.equal(lectura.use, tramo.action);
    assert.equal(lectura.question, tramo.question);
  }

  // Los cuatro tramos se leen distinto.
  const aperturas = new Set(
    AVANCES.map(
      (avance) =>
        cumplelunaReading({
          progress: avance,
          cycleDay: 12.4,
          cycleLength: 29.5,
          exact: true,
          lunarType: null
        }).now
    )
  );
  assert.equal(aperturas.size, 4);
});

test("con precisión en rango la apertura nombra el tramo y NO inventa un día singular", () => {
  const enRango = cumplelunaReading({
    progress: 0.42,
    cycleDay: 12.4,
    cycleLength: 29.5,
    exact: false,
    lunarType: null
  });
  assertLectura(enRango, "cumpleluna sin raíz exacta");
  assert.equal(enRango.now, "Estás en desarrollo de tu ciclo lunar personal.");
  assert.doesNotMatch(enRango.now, /\bdía\b/, "sin raíz exacta no hay un día del ciclo que afirmar");
  assert.doesNotMatch(enRango.now, /\d/, "ni ningún número que se lea como uno solo");
  assert.ok(enRango.caveat, "y el límite se declara");
  assert.match(enRango.caveat ?? "", /hora exacta/i);
  assert.match(enRango.caveat ?? "", /intervalos/i);

  // Un número que no se puede usar tampoco se escribe, aunque la raíz sea exacta:
  // un ciclo de largo cero o un día no finito no completan la frase.
  for (const roto of [
    { cycleDay: Number.NaN, cycleLength: 29.5 },
    { cycleDay: 12.4, cycleLength: 0 },
    { cycleDay: 12.4, cycleLength: Number.POSITIVE_INFINITY }
  ]) {
    const lectura = cumplelunaReading({ progress: 0.42, ...roto, exact: true, lunarType: null });
    assertLectura(lectura, `cumpleluna con números rotos ${JSON.stringify(roto)}`);
    assert.doesNotMatch(lectura.now, /\d/, "un número que no se sostiene no se escribe");
    assert.ok(lectura.caveat, "y se dice por qué");
  }
});

test("sin tipo lunar la síntesis del ciclo se sostiene igual y no lo inventa", () => {
  const sinTipo = cumplelunaReading({
    progress: 0.6,
    cycleDay: 18.5,
    cycleLength: 29.5,
    exact: true,
    lunarType: null
  });
  const vacio = cumplelunaReading({
    progress: 0.6,
    cycleDay: 18.5,
    cycleLength: 29.5,
    exact: true,
    lunarType: "   "
  });
  assertLectura(sinTipo, "cumpleluna sin tipo lunar");
  assert.equal(sinTipo.theme, vacio.theme, "un tipo lunar en blanco es lo mismo que no tenerlo");
  assert.match(sinTipo.theme, /ángulo Sol–Luna/, "el ciclo sigue diciendo de dónde se cuenta");
});

// ---------------------------------------------------------------------------
// La Luna: signo × fase × casa
// ---------------------------------------------------------------------------

test("la Luna combina signo, fase y casa: clima, dónde notarlo, tensión, gesto y pregunta", () => {
  for (const signo of SIGNOS) {
    for (const fase of FASES) {
      for (const casa of [null, ...CASAS]) {
        const lectura = moonReading({ sign: signo, phaseKey: fase, natalHouse: casa });
        const contexto = `Luna ${signo} · ${fase} · casa ${casa ?? "sin casa"}`;
        assertLectura(lectura, contexto);
        assertTextoPublicable(lectura.tension, `${contexto} · tensión`);

        // El signo se nombra con el nombre del sobre y la fase aporta su clima:
        // el clima de hoy es la combinación, no una de las dos.
        assert.ok(lectura.now.includes(signo), `${contexto}: el clima no nombra el signo`);
        assert.ok(
          lectura.now.toLocaleLowerCase("es").includes(moonPhaseClimate(fase).toLocaleLowerCase("es")),
          `${contexto}: el clima no incorpora la fase`
        );

        if (casa === null) {
          // Sin casa no se nombra ninguna, en ninguno de los cinco bloques.
          for (const [nombre, texto] of Object.entries({
            now: lectura.now,
            theme: lectura.theme,
            tension: lectura.tension,
            use: lectura.use,
            question: lectura.question
          })) {
            assert.doesNotMatch(texto, /\bcasa \d+/i, `${contexto}: ${nombre} inventó una casa`);
          }
          assert.equal(lectura.use, moonPhaseAction(fase), `${contexto}: sin casa el gesto es el de la fase`);
          assert.ok(lectura.caveat, `${contexto}: falta declarar por qué no hay área`);
          assert.match(lectura.caveat ?? "", /hora exacta/i);
        } else {
          // Con casa: se nombra UNA vez, en el bloque que dice dónde notarla, y
          // el gesto es el de esa casa.
          assert.equal(lectura.caveat, null, `${contexto}: con casa no hay límite que declarar`);
          assert.match(lectura.theme, new RegExp(`casa ${casa}\\b`), `${contexto}: falta la casa`);
          assert.ok(
            lectura.theme.includes(moonHouseNotice(casa) ?? ""),
            `${contexto}: la casa se etiqueta en vez de interpretarse`
          );
          const escrituras = [lectura.now, lectura.theme, lectura.tension, lectura.use, lectura.question]
            .join(" ")
            .match(new RegExp(`casa ${casa}\\b`, "g"));
          assert.equal(escrituras?.length, 1, `${contexto}: la casa se dice más de una vez`);
        }
      }
    }
  }
});

test("la Luna no usa la etiqueta del área como interpretación (QA22-026)", () => {
  for (const casa of CASAS) {
    const area = houseTheme(casa) ?? "";
    const lectura = moonReading({ sign: "Sagitario", phaseKey: "full", natalHouse: casa });
    for (const [nombre, texto] of Object.entries({
      now: lectura.now,
      theme: lectura.theme,
      tension: lectura.tension,
      use: lectura.use,
      question: lectura.question
    })) {
      assert.ok(
        !texto.includes(area),
        `casa ${casa}: ${nombre} repite «${area}», que es la etiqueta y no la lectura`
      );
    }
  }
});

test("cada signo y cada fase aportan una línea propia, y un signo fuera de tabla no rompe nada", () => {
  const climas = new Set(SIGNOS.map((signo) => moonReading({ sign: signo, phaseKey: "new", natalHouse: null }).now));
  assert.equal(climas.size, 12, "los doce signos colorean el día distinto");

  const dondes = new Set(
    SIGNOS.map((signo) => moonReading({ sign: signo, phaseKey: "new", natalHouse: null }).theme)
  );
  assert.equal(dondes.size, 12, "y cada uno se nota en otro lado");

  const tensiones = new Set(
    FASES.map((fase) => moonReading({ sign: "Libra", phaseKey: fase, natalHouse: 3 }).tension)
  );
  assert.equal(tensiones.size, 8, "la tensión cambia con la fase");

  const preguntas = new Set(
    FASES.map((fase) => moonReading({ sign: "Libra", phaseKey: fase, natalHouse: 3 }).question)
  );
  assert.equal(preguntas.size, 8, "y la pregunta también");

  // Un signo que la tabla no conozca —un nombre nuevo del contrato— se nombra y
  // la lectura se apoya en la fase, que sí está.
  const raro = moonReading({ sign: "Ofiuco", phaseKey: "gibbous", natalHouse: null });
  assertLectura(raro, "Luna en un signo fuera de tabla");
  assert.ok(raro.now.includes("Ofiuco"), "un signo desconocido se nombra igual");
  assert.ok(
    raro.now.toLocaleLowerCase("es").includes(moonPhaseClimate("gibbous").toLocaleLowerCase("es")),
    "y el clima se apoya en la fase, que sí está"
  );
});

test("una casa fuera de rango se trata como si no hubiera casa", () => {
  for (const casa of [0, 13, -1, 1.5, Number.NaN]) {
    const lectura = moonReading({ sign: "Tauro", phaseKey: "full", natalHouse: casa });
    assertLectura(lectura, `Luna con casa inválida ${casa}`);
    assert.doesNotMatch(lectura.theme, /\bcasa \d+/i);
    assert.ok(lectura.caveat, "y se dice que no hay área que ubicar");
  }
});

// ---------------------------------------------------------------------------
// Determinismo y pureza
// ---------------------------------------------------------------------------

test("la misma entrada devuelve exactamente el mismo texto", () => {
  const dos = <T>(fn: () => T) => [fn(), fn()] as const;

  const [estacionA, estacionB] = dos(() =>
    seasonReading({ phaseKey: "full", phaseName: "Llena", exact: false })
  );
  assert.deepEqual(estacionA, estacionB);

  const [anoA, anoB] = dos(() => yearReading({ house: 9, ruler: "Júpiter", monthIndex: 7, exact: true }));
  assert.deepEqual(anoA, anoB);

  const [cicloA, cicloB] = dos(() =>
    cumplelunaReading({ progress: 0.42, cycleDay: 12.4, cycleLength: 29.5, exact: true, lunarType: null })
  );
  assert.deepEqual(cicloA, cicloB);

  const [lunaA, lunaB] = dos(() => moonReading({ sign: "Cáncer", phaseKey: "balsamic", natalHouse: 4 }));
  assert.deepEqual(lunaA, lunaB);
});

test("la capa de lectura es pura: tablas fijas, composición y nada más", () => {
  // El control es sobre el CÓDIGO, así que se lee sin comentarios: la
  // documentación del módulo declara justamente esta garantía —«sin LLM, sin
  // azar, sin reloj, sin red»— y buscar los patrones sobre la prosa haría que
  // escribir la promesa contara como romperla. Los patrones y el control de
  // imports son los mismos.
  const fuente = sinComentarios(leer("src/domain/layerReading.ts"));
  for (const prohibido of [
    /Date\.now\(/,
    /new Date\(/,
    /Math\.random\(/,
    /fetch\(/,
    /useQuery|useMutation|convex/i,
    /openai|anthropic|llm|prompt/i
  ]) {
    assert.doesNotMatch(fuente, prohibido, "la capa de lectura no puede depender de nada externo");
  }
  // Y no importa nada más que el dominio editorial y los tipos del contrato: una
  // pantalla, un hook o un cliente acá haría que el texto dependiera del render.
  const imports = fuente.match(/from "([^"]+)"/g) ?? [];
  assert.deepEqual(imports, [
    'from "@/domain/layers"',
    'from "@/domain/layerMeaning"',
    'from "@/services/layersApi"'
  ]);
});

// ---------------------------------------------------------------------------
// Los cuatro accesos: rótulo exacto, una vez, y sólo con cálculo
// ---------------------------------------------------------------------------

test("los cuatro ritmos del mandala ofrecen acceso con el copy exacto del registro", () => {
  const momento = sinComentarios(leer(MOMENTO));

  // Los cuatro rótulos, con el texto EXACTO que pide QA22-024, y cada uno una
  // sola vez: dos entradas al mismo destino en la misma pantalla es la
  // duplicación que el registro marca.
  const ROTULOS = ["VER TU ESTACIÓN", "VER TU AÑO", "VER CICLO LUNAR", "VER TRÁNSITO"] as const;
  for (const rotulo of ROTULOS) {
    const veces = momento.match(new RegExp(`label: "${rotulo}"`, "g"))?.length ?? 0;
    assert.equal(veces, 1, `«${rotulo}» tiene que aparecer una sola vez y aparece ${veces}`);
  }

  // Y cada ritmo del contrato tiene su clave en la tabla de destinos: si el
  // mandala publica un anillo sin destino, ese ritmo no tiene a dónde ir.
  for (const clave of ["progressed_lunation", "annual_profection", "cumpleluna", "transit_arc"]) {
    assert.match(momento, new RegExp(`${clave}: \\{`), `el ritmo ${clave} no tiene destino`);
  }

  // Los destinos de las dos capas nuevas salen del helper de rutas, no de un
  // literal escrito a mano en la pantalla.
  assert.match(momento, /href: layerDetailHref\("estacion"\)/);
  assert.match(momento, /href: layerDetailHref\("ano"\)/);
  assert.match(momento, /href: layerDetailHref\("cumpleluna"\)/);
  assert.match(
    momento,
    /href: withDetailOrigin\(`\/transitos\/arco\/\$\{encodeURIComponent\(arcId\)\}`, "momento"\)/
  );

  // El enlace aparece sólo cuando ese ritmo se puede calcular hoy.
  assert.match(momento, /const destino = ring\.available \? destinos\[ring\.key\] : undefined;/);
  // Y el tránsito, además, sólo cuando hay un arco que abrir.
  assert.match(momento, /const arcId = bundle\.today\.transitArc\.data\?\.arcId \?\? null;/);
  assert.match(momento, /\.\.\.\(arcId\s*\?/);

  // Cada acceso se anuncia con su propia etiqueta accesible: `VER TU AÑO` en
  // mayúsculas no le dice a VoiceOver a dónde va.
  const accesibles = momento.match(/accessibilityLabel: "[^"]+"/g) ?? [];
  assert.equal(accesibles.length, 4, "los cuatro accesos declaran su etiqueta accesible");
  assert.equal(new Set(accesibles).size, 4, "y ninguna se repite");
});

test("las cuatro capas de la sección tienen ruta propia y pantalla propia", () => {
  assert.deepEqual([...SECTION_LAYER_DETAILS], ["estacion", "ano", "cumpleluna", "luna"]);
  assert.equal(layerDetailHref("estacion"), "/transitos/capa/estacion");
  assert.equal(layerDetailHref("ano"), "/transitos/capa/ano");

  const capa = sinComentarios(leer(RUTA_CAPA));
  assert.match(capa, /estacion: EstacionDetailScreen/);
  assert.match(capa, /ano: AnoDetailScreen/);
  assert.match(capa, /Record<SectionLayerDetail,/, "la tabla es exhaustiva por tipo");

  for (const rel of [ESTACION, ANO]) {
    assert.ok(existsSync(join(ROOT, rel)), `${rel} no existe`);
    const source = sinComentarios(leer(rel));
    // Un detalle que nace en esta sección vuelve a `Tu momento` incluso sin
    // historial: no hay ninguna otra raíz de la que pueda colgar.
    assert.match(source, /fallbackHref = "\/transitos\/momento"/, `${rel}: el respaldo no es Tu momento`);
    assert.ok(!/["'`]\/hoy\b/.test(source), `${rel}: no puede caer en el stack de Hoy`);

    // Las cinco superficies del detalle —carga, error, invitado, vacío y la
    // lectura— tienen que volver al mismo lado.
    const shells = source.match(/<DetailLayerScreen eyebrow=/g)?.length ?? 0;
    const conVuelta = source.match(/<DetailLayerScreen eyebrow=\{[A-Z_]+\} fallbackHref=\{fallbackHref\}>/g)
      ?.length ?? 0;
    assert.ok(shells >= 5, `${rel}: se esperaban las cinco superficies del detalle`);
    assert.equal(conVuelta, shells, `${rel}: hay superficies sin destino de vuelta`);
  }
});

// ---------------------------------------------------------------------------
// El orden editorial: la misma jerarquía en los cuatro detalles
// ---------------------------------------------------------------------------

/** Las posiciones de una secuencia de anclas, exigiendo que estén y en orden. */
function assertOrden(source: string, anclas: readonly string[], contexto: string) {
  let anterior = -1;
  for (const ancla of anclas) {
    const posicion = source.indexOf(ancla);
    assert.ok(posicion > 0, `${contexto}: falta «${ancla}»`);
    assert.ok(posicion > anterior, `${contexto}: «${ancla}» quedó fuera de orden`);
    anterior = posicion;
  }
}

test("los cuatro detalles se leen en el mismo orden: lectura, datos y recién después el método", () => {
  const estacion = sinComentarios(leer(ESTACION));
  assertOrden(
    estacion.slice(estacion.indexOf("export function EstacionDetailScreen")),
    [
      "READING_NOW_HEADING",
      "READING_THEME_HEADING",
      "SEASON_CYCLE_HEADING",
      "READING_USE_HEADING",
      "READING_QUESTION_HEADING",
      "lectura.caveat",
      "<Datos",
      "METHOD_HEADING",
      "<TraceAccordion"
    ],
    "estación vital"
  );

  const ano = sinComentarios(leer(ANO));
  assertOrden(
    ano.slice(ano.indexOf("export function AnoDetailScreen")),
    [
      "READING_NOW_HEADING",
      "READING_THEME_HEADING",
      "YEAR_RULER_HEADING",
      "READING_USE_HEADING",
      "READING_QUESTION_HEADING",
      "lectura.caveat",
      "<Datos",
      "METHOD_HEADING",
      "<TraceAccordion"
    ],
    "tema del año"
  );

  const cumpleluna = sinComentarios(leer(CUMPLELUNA));
  assertOrden(
    cumpleluna.slice(cumpleluna.indexOf("function Lectura(")),
    [
      "READING_NOW_HEADING",
      "READING_THEME_HEADING",
      "READING_USE_HEADING",
      "READING_QUESTION_HEADING",
      "lectura.caveat"
    ],
    "cumpleluna · bloque de lectura"
  );
  assertOrden(
    cumpleluna.slice(cumpleluna.indexOf("<Title>")),
    ["<Lectura", "<CycleRing", "LOS NÚMEROS DEL CICLO", "METHOD_HEADING", "<TraceAccordion"],
    "cumpleluna · pantalla"
  );

  const luna = sinComentarios(leer(LUNA));
  assertOrden(
    luna.slice(luna.indexOf("export function LunaDetailScreen")),
    [
      "READING_NOW_HEADING",
      "READING_THEME_HEADING",
      "MOON_TENSION_HEADING",
      "READING_USE_HEADING",
      "READING_QUESTION_HEADING",
      "lectura.caveat",
      "LOS DATOS EXACTOS",
      "WHY_HEADING",
      "METHOD_HEADING",
      "<TraceAccordion"
    ],
    "la Luna en tu carta"
  );
});

test("los rótulos de la jerarquía son los mismos para todos y se escriben una sola vez", () => {
  assert.equal(READING_NOW_HEADING, "QUÉ MARCA AHORA");
  assert.equal(READING_THEME_HEADING, "QUÉ PONE AL FRENTE");
  assert.equal(READING_USE_HEADING, "CÓMO USARLO");
  assert.equal(READING_QUESTION_HEADING, "PARA OBSERVAR");
  assert.equal(SEASON_CYCLE_HEADING, "QUÉ SE ABRE Y QUÉ SE CIERRA");
  assert.equal(YEAR_RULER_HEADING, "QUIÉN RIGE ESTE AÑO");
  assert.equal(MOON_TENSION_HEADING, "POSIBILIDAD Y TENSIÓN");
  assert.equal(SEASON_DETAIL_EYEBROW, "TU ESTACIÓN VITAL");
  assert.equal(YEAR_DETAIL_EYEBROW, "TEMA DE TU AÑO");
  assert.equal(SEASON_DATA_HEADING, "LOS DATOS DE LA FASE");
  assert.equal(YEAR_DATA_HEADING, "LOS DATOS DEL AÑO");
  assert.equal(METHOD_HEADING, "MÉTODO");
  assert.equal(WHY_HEADING, "POR QUÉ SE MUESTRA");

  // Ninguna pantalla escribe el rótulo a mano: si lo hiciera, cambiar el
  // vocabulario dejaría un detalle diciendo otra cosa que los otros tres.
  for (const rel of [ESTACION, ANO, CUMPLELUNA, LUNA]) {
    const source = sinComentarios(leer(rel));
    for (const rotulo of [
      READING_NOW_HEADING,
      READING_THEME_HEADING,
      READING_USE_HEADING,
      READING_QUESTION_HEADING
    ]) {
      assert.ok(!source.includes(`"${rotulo}"`), `${rel}: «${rotulo}» está escrito a mano`);
    }
  }
});

test("la trazabilidad de cada análisis se escribe una vez y la comparten portada y detalle", () => {
  const momento = sinComentarios(leer(MOMENTO));
  const estacion = sinComentarios(leer(ESTACION));
  const ano = sinComentarios(leer(ANO));

  // El texto vive en el dominio, junto al análisis que describe.
  assert.match(SEASON_TRACE.calculatedDatum, /ángulo entre el Sol y la Luna progresados/);
  assert.match(YEAR_TRACE.calculatedDatum, /Qué casa de tu carta le toca a tu edad actual/);

  for (const [rel, source] of [
    [MOMENTO, momento],
    [ESTACION, estacion]
  ] as const) {
    assert.match(source, /calculatedDatum=\{SEASON_TRACE\.calculatedDatum\}/, rel);
    assert.match(source, /interpretiveRule=\{SEASON_TRACE\.interpretiveRule\}/, rel);
  }
  for (const [rel, source] of [
    [MOMENTO, momento],
    [ANO, ano]
  ] as const) {
    assert.match(source, /calculatedDatum=\{YEAR_TRACE\.calculatedDatum\}/, rel);
    assert.match(source, /interpretiveRule=\{YEAR_TRACE\.interpretiveRule\}/, rel);
  }

  // Y ninguna pantalla vuelve a escribirlo como literal.
  for (const source of [momento, estacion, ano]) {
    assert.ok(!source.includes(SEASON_TRACE.calculatedDatum));
    assert.ok(!source.includes(YEAR_TRACE.calculatedDatum));
  }
});

// ---------------------------------------------------------------------------
// Accesibilidad y honestidad de las dos pantallas nuevas
// ---------------------------------------------------------------------------

test("los dos detalles nuevos no dibujan una lectura cuando el cálculo no está", () => {
  const estacion = sinComentarios(leer(ESTACION));
  const ano = sinComentarios(leer(ANO));

  // La lectura cuelga del dato del sobre: sin `data` no hay texto que afirmar.
  assert.match(estacion, /const lectura = data \? seasonReading\(/);
  assert.match(estacion, /\{data && lectura \?/);
  assert.match(estacion, /<MissingBlock envelope=\{envelope\}/);

  assert.match(ano, /const lectura = data\s*\?\s*yearReading\(/);
  assert.match(ano, /<MissingBlock envelope=\{envelope\}/);
  // Sin hora de nacimiento no se propone una casa probable: se dice el motivo y
  // se ofrece la única salida real, que es cargar la hora.
  assert.match(ano, /const sinHora = envelope\.status === "needs_birth_time";/);
  assert.match(ano, /label="AGREGAR O CORREGIR HORA"/);
  assert.match(ano, /router\.push\("\/editar-datos" as never\)/);

  // Ni una ni otra pantalla llama a un modelo, tira un dado o pide datos nuevos.
  for (const source of [estacion, ano]) {
    assert.doesNotMatch(source, /Math\.random|openai|anthropic|prompt/i);
    assert.doesNotMatch(source, /useQuery|useMutation/, "las dos leen el bundle que ya trae `useLayers`");
  }
});

test("el disco de la estación se anuncia una sola vez y la barra dice su avance en palabras", () => {
  const estacion = sinComentarios(leer(ESTACION));

  // El `MoonDial` ya es accesible por dentro, así que el envoltorio que le pone
  // la etiqueta del disco esconde sus descendientes: sin eso VoiceOver lee dos
  // veces la misma imagen.
  assert.match(estacion, /accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/);
  assert.match(estacion, /accessibilityRole="image"/);

  // Con avance puntual la barra es un `progressbar` con su valor; con avance
  // acotado no se afirma un punto: se dibuja apagada y la franja se dice al lado.
  assert.match(estacion, /valueText=\{`\$\{formatPercent\(avance\)\} de esta fase`\}/);
  assert.match(estacion, /tone="soft"/);
  assert.match(estacion, /SIN HORA NO HAY UN PUNTO/);
});
