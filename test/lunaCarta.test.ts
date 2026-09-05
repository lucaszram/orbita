/**
 * La precisión de `home.getLunaSobreLaCarta` llevada a pantalla (CORE-191).
 *
 * Estas son las afirmaciones que la sección Hoy NO puede romper: sin casa natal
 * no se muestra una casa, un valor que se mueve dentro del día se dice como tal,
 * y el Cumpleluna nunca aparece como un instante —ni con hora, ni con una fecha
 * suelta— porque el contrato jamás lo publica como exacto.
 *
 * Todo puro: se ejecuta de verdad, con instantes reales y una zona sin horario
 * de verano (Buenos Aires, UTC−3) para que las fechas civiles sean estables.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cumplelunaHoy,
  cumplelunaIntroDeHoy,
  cumplelunaVista,
  fechaCivilEnZona,
  fechaCivilLarga,
  formatDecimal,
  formatDiaMes,
  formatPorcentaje,
  formatVentanaDiaMes,
  lineasDeFalta,
  lunaVista,
  partesDeFechaCivil,
  type CumplelunaHoy,
  type CumplelunaVista
} from "../src/domain/lunaCarta";
import type { CumplelunaData, LunaSobreLaCartaPayload, MoonOnChartData } from "../src/services/appRefs";

const BA = "America/Argentina/Buenos_Aires";

/** Mediodía local en Buenos Aires (UTC−3): el instante canónico del sobre. */
const mediodia = (anio: number, mes: number, dia: number) => Date.UTC(anio, mes - 1, dia, 15, 0, 0);
/** Una hora local cualquiera en Buenos Aires. */
const hora = (anio: number, mes: number, dia: number, h: number) => Date.UTC(anio, mes - 1, dia, h + 3, 0, 0);

function luna(partial: Partial<MoonOnChartData> = {}): MoonOnChartData {
  return {
    kind: "moon_on_chart",
    observedAt: mediodia(2026, 9, 12),
    longitudeDegrees: 12.5,
    speedDegreesPerDay: 13.1,
    signKey: "aries",
    sign: "Aries",
    degreeInSign: 12.5,
    phaseKey: "first_quarter",
    phaseName: "Cuarto creciente",
    illumination: 0.6234,
    elongationDegrees: 92.4,
    natalHouse: 7,
    houseTheme: "pareja, sociedades y acuerdos",
    housesToday: [7],
    signsToday: ["Aries"],
    phasesToday: ["first_quarter"],
    precision: "exact",
    summary: "Hoy la Luna pasa por tu casa 7: pareja, sociedades y acuerdos.",
    ...partial
  };
}

function cumple(partial: Partial<CumplelunaData> = {}): CumplelunaData {
  return {
    kind: "cumpleluna",
    observedAt: mediodia(2026, 9, 12),
    natalElongationDegrees: 108,
    natalElongationToleranceDegrees: 0,
    currentElongationDegrees: 92.4,
    elongationRateDegreesPerDay: 12.19,
    cycleDegrees: 360,
    cycleFraction: 0.6234,
    cycleDay: 18.4,
    cycleDayWindowDays: { from: 17.93, to: 19.12 },
    cycleLengthDays: 29.53,
    daysRemaining: 28.75,
    daysRemainingWindowDays: { from: 27.42, to: 30.08 },
    previousExactAt: mediodia(2026, 8, 14),
    previousExactAtWindow: { earliest: hora(2026, 8, 13, 20), latest: hora(2026, 8, 15, 4) },
    nextExactAt: mediodia(2026, 10, 12),
    nextExactAtWindow: { earliest: mediodia(2026, 10, 11), latest: mediodia(2026, 10, 13) },
    precision: "estimated",
    summary: "La distancia entre el Sol y la Luna que había cuando naciste vuelve a repetirse en unos 29 días.",
    ...partial
  };
}

function sobre(partial: Partial<LunaSobreLaCartaPayload> = {}): LunaSobreLaCartaPayload {
  return {
    methodVersion: "luna-1",
    providerVersion: "prov-1",
    status: "ready",
    precision: "exact",
    localDate: "2026-09-12",
    timezone: BA,
    observedAt: mediodia(2026, 9, 12),
    moonOnChart: luna(),
    cumpleluna: cumple(),
    missingInputs: [],
    limitations: [],
    ...partial
  };
}

// --- Vocabulario de fechas y números ---------------------------------------

describe("fechas civiles: una fecha de calendario no es un instante", () => {
  it("lee los tres números y rechaza lo que no es una fecha", () => {
    assert.deepEqual(partesDeFechaCivil("2026-09-12"), { anio: 2026, mes: 9, dia: 12 });
    assert.equal(partesDeFechaCivil("2026-13-01"), null);
    assert.equal(partesDeFechaCivil("2026-09-32"), null);
    assert.equal(partesDeFechaCivil("2026-9-1"), null);
    assert.equal(partesDeFechaCivil(""), null);
    assert.equal(partesDeFechaCivil(undefined as unknown as string), null);
  });

  it("el encabezado dice el día canónico sin pasarlo por ninguna zona", () => {
    assert.equal(fechaCivilLarga("2026-09-04"), "viernes 4 de septiembre");
    assert.equal(fechaCivilLarga("2027-03-01"), "lunes 1 de marzo");
    assert.equal(fechaCivilLarga("2026-01-31"), "sábado 31 de enero");
    assert.equal(fechaCivilLarga("no es una fecha"), null);
  });

  it("el día civil de un instante sale de la ZONA del sobre, no del proceso", () => {
    // 22:00 en Buenos Aires del 12 es el 13 en UTC: el día tiene que ser el local.
    assert.equal(fechaCivilEnZona(hora(2026, 9, 12, 22), BA), "2026-09-12");
    assert.equal(fechaCivilEnZona(hora(2026, 9, 12, 22), "UTC"), "2026-09-13");
    assert.equal(fechaCivilEnZona(mediodia(2026, 9, 12), "Zona/Inventada"), null);
    assert.equal(fechaCivilEnZona(Number.NaN, BA), null);
    assert.equal(fechaCivilEnZona(mediodia(2026, 9, 12), ""), null);
  });

  it("la ventana se dice entera, y se acorta cuando comparte mes o día", () => {
    assert.equal(
      formatVentanaDiaMes({ earliest: mediodia(2026, 10, 11), latest: mediodia(2026, 10, 13) }, BA),
      "entre el 11 y el 13 de octubre"
    );
    assert.equal(
      formatVentanaDiaMes({ earliest: hora(2026, 9, 12, 1), latest: hora(2026, 9, 12, 23) }, BA),
      "dentro del 12 de septiembre"
    );
    assert.equal(
      formatVentanaDiaMes({ earliest: mediodia(2026, 9, 30), latest: mediodia(2026, 10, 2) }, BA),
      "entre el 30 de septiembre y el 2 de octubre"
    );
    assert.equal(formatVentanaDiaMes({ earliest: mediodia(2026, 10, 11), latest: mediodia(2026, 10, 13) }, "Zona/Mala"), null);
  });

  it("porcentajes y decimales se escriben como en español, y fallan a `null`", () => {
    assert.equal(formatDiaMes(mediodia(2026, 9, 12), BA), "12 de septiembre");
    assert.equal(formatPorcentaje(0.6234), "62%");
    assert.equal(formatPorcentaje(1.4), "100%");
    assert.equal(formatPorcentaje(-2), "0%");
    assert.equal(formatPorcentaje(Number.NaN), null);
    assert.equal(formatDecimal(18.47), "18,5");
    assert.equal(formatDecimal(29.53), "29,5");
    assert.equal(formatDecimal(Number.POSITIVE_INFINITY), null);
  });
});

// --- LA LUNA EN TU CARTA ---------------------------------------------------

describe("lunaVista — la Luna sobre la carta", () => {
  it("con casa: titular, iluminación y casa, sin repetir el tema que ya dice el resumen", () => {
    const vista = lunaVista(luna(), sobre());
    assert.equal(vista.titular, "Cuarto creciente en Aries");
    assert.deepEqual(vista.meta, ["62% ILUMINADA", "TU CASA 7"]);
    assert.deepEqual(vista.casa, { numero: 7, tema: "pareja, sociedades y acuerdos" });
    assert.equal(vista.tema, null, "el resumen ya nombra el tema de la casa");
    assert.equal(vista.iluminacion, 0.6234);
    assert.equal(vista.phaseKey, "first_quarter");
    assert.deepEqual(vista.limitaciones, []);
  });

  it("sin resumen del backend, el tema de la casa se dice acá (y sólo entonces)", () => {
    const vista = lunaVista(luna({ summary: "" }), sobre());
    assert.equal(vista.resumen, null);
    assert.equal(vista.tema, "Tu casa 7 habla de pareja, sociedades y acuerdos.");
  });

  it("sin casa natal no se muestra casa: se explica la limitación", () => {
    const vista = lunaVista(
      luna({ natalHouse: null, houseTheme: null, housesToday: [] }),
      sobre({ missingInputs: ["exact_birth_time"], status: "partial" })
    );
    assert.equal(vista.casa, null);
    assert.ok(!vista.meta.some((item) => item.includes("CASA")), "no puede quedar una casa en la fila mono");
    assert.deepEqual(vista.limitaciones, [
      "Sin hora exacta de nacimiento no ubicamos la Luna en una casa de tu carta."
    ]);
    assert.ok(!vista.voz.includes("Casa"), "la voz tampoco puede nombrar una casa que no hay");
  });

  it("sin carta natal la limitación lo dice con todas las letras", () => {
    const vista = lunaVista(
      luna({ natalHouse: null, houseTheme: null, housesToday: [] }),
      sobre({ missingInputs: ["natal_chart"], status: "needs_natal_chart" })
    );
    assert.match(vista.limitaciones[0], /Todavía no tenemos tu carta natal/);
  });

  it("sin ningún insumo reconocible igual se explica por qué falta la casa", () => {
    const vista = lunaVista(luna({ natalHouse: null, houseTheme: null }), sobre({ missingInputs: [] }));
    assert.equal(vista.limitaciones[0], "No pudimos ubicar la Luna de hoy en una casa de tu carta.");
  });

  it("`range`: el recorrido del día se dice en la fila mono y se declara la limitación", () => {
    const vista = lunaVista(
      luna({
        precision: "range",
        housesToday: [6, 7],
        signsToday: ["Piscis", "Aries"],
        summary: "Hoy la Luna cambia de casa: pasa por la 6 y la 7."
      }),
      sobre({ precision: "range" })
    );
    assert.deepEqual(vista.meta, ["62% ILUMINADA", "TU CASA 7", "HOY CASAS 6 Y 7", "HOY EN PISCIS Y ARIES"]);
    assert.deepEqual(vista.limitaciones, [
      "Las posiciones son del mediodía local: dentro del día la Luna cruza más de una casa o de un signo."
    ]);
  });

  it("una iluminación inutilizable no dibuja un disco ni escribe un porcentaje", () => {
    const vista = lunaVista(luna({ illumination: Number.NaN }), sobre());
    assert.equal(vista.iluminacion, null);
    assert.deepEqual(vista.meta, ["TU CASA 7"]);
    assert.ok(!vista.voz.includes("%"));
  });

  it("una fase desconocida no se dibuja, pero el bloque sigue de pie", () => {
    const vista = lunaVista(luna({ phaseKey: "media_luna" as never, phaseName: "" }), sobre());
    assert.equal(vista.phaseKey, null);
    assert.equal(vista.titular, "Luna en Aries");
  });

  it("un snapshot de otro día se declara: sus números no son los de hoy", () => {
    const vista = lunaVista(luna({ observedAt: mediodia(2026, 9, 11) }), sobre());
    assert.ok(
      vista.limitaciones.includes("Estos números son del cálculo del 11 de septiembre, no del día de hoy."),
      `limitaciones inesperadas: ${JSON.stringify(vista.limitaciones)}`
    );
  });

  it("la voz del disco dice lo que el disco dibuja, no el resumen", () => {
    const vista = lunaVista(luna(), sobre());
    assert.equal(vista.voz, "Luna en Aries. Cuarto creciente, 62% iluminada. Casa 7 de tu carta.");
    assert.ok(!vista.voz.includes(luna().summary));
  });
});

// --- CUMPLELUNA: el evento de hoy ------------------------------------------

describe("cumplelunaHoy — ventana contenida vs. ventana que sólo cruza", () => {
  it("la ventana entera dentro del día canónico ocurre HOY", () => {
    const data = cumple({
      previousExactAtWindow: { earliest: hora(2026, 9, 12, 1), latest: hora(2026, 9, 12, 23) }
    });
    assert.deepEqual(cumplelunaHoy(data, "2026-09-12", BA), {
      certeza: "hoy",
      ventana: data.previousExactAtWindow
    });
  });

  it("la ventana que sólo cruza el día PUEDE caer hoy: no se afirma más", () => {
    const data = cumple({
      previousExactAtWindow: { earliest: hora(2026, 9, 11, 17), latest: hora(2026, 9, 12, 7) }
    });
    const evento = cumplelunaHoy(data, "2026-09-12", BA);
    assert.equal(evento?.certeza, "posible");
  });

  it("la ventana contenida gana sobre la que sólo cruza", () => {
    const data = cumple({
      // La anterior sólo cruza el día; la próxima entra entera.
      previousExactAtWindow: { earliest: hora(2026, 9, 11, 17), latest: hora(2026, 9, 12, 7) },
      nextExactAtWindow: { earliest: hora(2026, 9, 12, 2), latest: hora(2026, 9, 12, 20) }
    });
    const evento = cumplelunaHoy(data, "2026-09-12", BA);
    assert.equal(evento?.certeza, "hoy");
    assert.deepEqual(evento?.ventana, data.nextExactAtWindow);
  });

  it("también mira la repetición ANTERIOR: el día que importa no puede desaparecer", () => {
    // `nextExactAtWindow` ya apunta al mes que viene y sin embargo hoy es el día.
    const data = cumple({
      previousExactAtWindow: { earliest: hora(2026, 9, 12, 4), latest: hora(2026, 9, 12, 18) }
    });
    assert.equal(cumplelunaHoy(data, "2026-09-12", BA)?.certeza, "hoy");
  });

  it("una ventana lejana no es un evento de hoy", () => {
    assert.equal(cumplelunaHoy(cumple(), "2026-09-12", BA), null);
  });

  it("el día se decide en la ZONA del sobre, no en UTC", () => {
    // 21:00–23:00 local del 12 = 00:00–02:00 UTC del 13.
    const data = cumple({
      previousExactAtWindow: { earliest: hora(2026, 9, 12, 21), latest: hora(2026, 9, 12, 23) }
    });
    assert.equal(cumplelunaHoy(data, "2026-09-12", BA)?.certeza, "hoy");
    assert.equal(cumplelunaHoy(data, "2026-09-12", "UTC"), null);
  });

  it("sin día canónico o sin zona utilizable no se afirma nada", () => {
    const data = cumple({
      previousExactAtWindow: { earliest: hora(2026, 9, 12, 1), latest: hora(2026, 9, 12, 23) }
    });
    assert.equal(cumplelunaHoy(data, "", BA), null);
    assert.equal(cumplelunaHoy(data, "hoy", BA), null);
    assert.equal(cumplelunaHoy(data, "2026-09-12", "Zona/Mala"), null);
  });
});

// --- CUMPLELUNA: la vista --------------------------------------------------

/** La vista, afirmando que existe: estos casos siempre traen ventana. */
function conVista(data: CumplelunaData, s: LunaSobreLaCartaPayload, hoy: CumplelunaHoy | null): CumplelunaVista {
  const vista = cumplelunaVista(data, s, hoy);
  assert.ok(vista, "la vista tiene que existir en este caso");
  return vista;
}

describe("cumplelunaVista — la ventana, nunca el instante", () => {
  it("sin evento hoy el titular ES la ventana, y el instante del medio no se imprime", () => {
    const data = cumple();
    const vista = conVista(data, sobre(), null);
    assert.equal(vista.cuando, "entre el 11 y el 13 de octubre");
    assert.equal(vista.titular, "Entre el 11 y el 13 de octubre");
    // `nextExactAt` cae el 12 de octubre: ese día no puede aparecer solo.
    assert.ok(!vista.titular.includes("12 de octubre"));
    assert.ok(!(vista.cuando ?? "").includes("12 de octubre"));
  });

  it("nunca escribe una hora: este cálculo no publica un instante exacto", () => {
    const vista = conVista(cumple(), sobre(), null);
    const todo = [vista.titular, vista.cuando, vista.faltan, vista.relojDelCiclo, ...vista.meta, vista.voz]
      .filter((x): x is string => typeof x === "string")
      .join(" | ");
    assert.doesNotMatch(todo, /\d{1,2}:\d{2}/, `apareció una hora: ${todo}`);
  });

  it("con el evento contenido dice que ocurre hoy; con el que cruza, que puede caer hoy", () => {
    const ventana = { earliest: hora(2026, 9, 12, 1), latest: hora(2026, 9, 12, 23) };
    assert.equal(conVista(cumple(), sobre(), { certeza: "hoy", ventana }).titular, "Ocurre hoy");
    assert.equal(conVista(cumple(), sobre(), { certeza: "posible", ventana }).titular, "Puede caer hoy");
    assert.equal(
      conVista(cumple(), sobre(), { certeza: "hoy", ventana }).voz,
      "Tu cumpleluna ocurre hoy. Ventana dentro del 12 de septiembre."
    );
    assert.equal(
      conVista(cumple(), sobre(), { certeza: "posible", ventana }).voz,
      "Tu cumpleluna puede caer hoy. Ventana dentro del 12 de septiembre."
    );
  });

  it("si una ventana anterior todavía toca hoy, no mezcla el evento con el próximo ciclo", () => {
    const anterior = { earliest: hora(2026, 9, 11, 20), latest: hora(2026, 9, 12, 4) };
    const data = cumple({
      previousExactAtWindow: anterior,
      summary: "La próxima repetición llega en unos 29 días."
    });
    const vista = conVista(data, sobre(), { certeza: "posible", ventana: anterior });

    assert.equal(vista.titular, "Puede caer hoy");
    assert.equal(vista.cuando, "entre el 11 y el 12 de septiembre");
    assert.equal(vista.faltan, null, "la cuenta hacia el próximo ciclo no acompaña al evento de hoy");
    assert.equal(vista.resumen, null, "el resumen del próximo ciclo no contradice el titular de hoy");
    assert.deepEqual(vista.meta, ["VENTANA ENTRE EL 11 Y EL 12 DE SEPTIEMBRE", "CICLO 29,5 DÍAS"]);
  });

  it("los días que faltan y el reloj del ciclo salen de sus ventanas, no de sus centros", () => {
    const vista = conVista(cumple(), sobre(), null);
    assert.equal(vista.faltan, "entre 27,4 y 30,1 días");
    assert.equal(vista.relojDelCiclo, "DÍA ENTRE 17,9 Y 19,1 DE 29,5");
    assert.deepEqual(vista.meta, ["FALTAN ENTRE 27,4 Y 30,1 DÍAS", "CICLO 29,5 DÍAS"]);
    // 28,75 es el centro que el backend usa para seguir operando: no se imprime.
    assert.ok(!(vista.faltan ?? "").includes("28,8"));
  });

  it("una ventana de menos de un día se dice como tal", () => {
    const vista = conVista(cumple({ daysRemainingWindowDays: { from: 0, to: 0.6 } }), sobre(), null);
    assert.equal(vista.faltan, "menos de un día");
  });

  it("el avance y su franja salen del MISMO snapshot", () => {
    const vista = conVista(cumple(), sobre(), null);
    assert.equal(vista.avance, 0.6234);
    assert.ok(vista.banda !== null);
    assert.ok(Math.abs((vista.banda?.desde ?? 0) - 17.93 / 29.53) < 1e-9);
    assert.ok(Math.abs((vista.banda?.hasta ?? 0) - 19.12 / 29.53) < 1e-9);
  });

  it("con el día del ciclo fijado no hay franja: la barra dibuja un punto", () => {
    const vista = conVista(cumple({ cycleDayWindowDays: { from: 18.4, to: 18.4 } }), sobre(), null);
    assert.equal(vista.banda, null);
    assert.equal(vista.relojDelCiclo, "DÍA 18,4 DE 29,5");
  });

  it("siempre declara que es una estimación con ventana", () => {
    const vista = conVista(cumple(), sobre(), null);
    assert.equal(
      vista.limitaciones[0],
      "El Cumpleluna se estima propagando la distancia entre el Sol y la Luna: publicamos la ventana, no un instante exacto."
    );
  });

  it("`range` (sin hora exacta de nacimiento) suma su propia limitación", () => {
    const vista = conVista(
      cumple({ precision: "range", natalElongationToleranceDegrees: 6.5 }),
      sobre({ precision: "range" }),
      null
    );
    assert.equal(vista.limitaciones.length, 2);
    assert.match(vista.limitaciones[1], /Sin hora exacta de nacimiento/);
  });

  it("un snapshot de otro día se declara también acá", () => {
    const vista = conVista(cumple({ observedAt: mediodia(2026, 9, 11) }), sobre(), null);
    assert.ok(vista.limitaciones.some((linea) => linea.includes("11 de septiembre")));
  });

  it("sin ventana formateable no hay bloque: nunca un titular genérico sin fecha", () => {
    // La zona no resuelve: el módulo se retira y explica por qué falta, en vez
    // de afirmar «Próximo cumpleluna estimado» sin ventana.
    assert.equal(cumplelunaVista(cumple(), sobre({ timezone: "Zona/Mala" }), null), null);
    // Sin ventana próxima ni evento de hoy tampoco hay vista.
    assert.equal(cumplelunaVista(cumple({ nextExactAtWindow: null as never }), sobre(), null), null);
  });

  it("un ciclo que el sobre no trajo (rellenado con 0) no se publica como dato", () => {
    // El lector del sobre rellena con 0 los escalares ausentes. Un ciclo de
    // 0 días no existe: sin largo no hay reloj, avance, franja ni «CICLO».
    const vista = conVista(cumple({ cycleLengthDays: 0, cycleFraction: 0, cycleDay: 0 }), sobre(), null);
    assert.equal(vista.relojDelCiclo, null);
    assert.equal(vista.avance, null);
    assert.equal(vista.banda, null);
    assert.ok(!vista.meta.some((item) => item.startsWith("CICLO")));
    assert.ok(!vista.meta.some((item) => item.includes("0,0")));
    assert.ok(vista.limitaciones.some((linea) => linea.includes("largo de tu ciclo")));
  });

  it("un avance que no cuadra con el día del ciclo publicado no se dibuja; la franja sí", () => {
    // `cycleFraction: 0` con la ventana en el día 18–19 es un hueco rellenado,
    // no un ciclo recién empezado: el punto no se afirma y queda la franja.
    const vista = conVista(cumple({ cycleFraction: 0, cycleDay: 0 }), sobre(), null);
    assert.equal(vista.avance, null);
    assert.ok(vista.banda !== null);
    assert.equal(vista.relojDelCiclo, "DÍA ENTRE 17,9 Y 19,1 DE 29,5");
    // Y un avance coherente con su ventana sí se conserva.
    assert.equal(conVista(cumple(), sobre(), null).avance, 0.6234);
  });

  it("una ventana contenida en un solo día sigue diciéndose como ventana", () => {
    const ventana = { earliest: hora(2026, 10, 12, 1), latest: hora(2026, 10, 12, 23) };
    const vista = conVista(cumple({ nextExactAtWindow: ventana }), sobre(), null);
    assert.equal(vista.cuando, "dentro del 12 de octubre");
    assert.equal(vista.titular, "Dentro del 12 de octubre");
  });
});

describe("cumplelunaIntroDeHoy — por qué subió al primer lugar", () => {
  it("la ventana contenida se cuenta como un evento del día, sin hora", () => {
    const texto = cumplelunaIntroDeHoy(
      { certeza: "hoy", ventana: { earliest: hora(2026, 9, 12, 1), latest: hora(2026, 9, 12, 23) } },
      BA
    );
    assert.match(texto, /ocurre hoy, por eso aparece primero/);
    assert.match(texto, /no puede fijar la hora/);
    assert.doesNotMatch(texto, /\d{1,2}:\d{2}/);
  });

  it("la ventana que cruza dice su rango entero", () => {
    const texto = cumplelunaIntroDeHoy(
      { certeza: "posible", ventana: { earliest: hora(2026, 9, 11, 17), latest: hora(2026, 9, 12, 7) } },
      BA
    );
    assert.match(texto, /puede caer hoy/);
    assert.match(texto, /entre el 11 y el 12 de septiembre/);
  });

  it("sin zona utilizable sigue explicando, pero no inventa el rango", () => {
    const texto = cumplelunaIntroDeHoy(
      { certeza: "posible", ventana: { earliest: hora(2026, 9, 11, 17), latest: hora(2026, 9, 12, 7) } },
      "Zona/Mala"
    );
    assert.match(texto, /puede caer hoy/);
    assert.doesNotMatch(texto, /entre el/);
  });
});

// --- Por qué falta un bloque ------------------------------------------------

describe("lineasDeFalta — la línea gris de un bloque sin dato", () => {
  it("elige el insumo que corresponde AL BLOQUE, no el primero de la lista", () => {
    const envelope = sobre({
      cumpleluna: null,
      missingInputs: ["exact_birth_time", "natal_sun_and_moon"],
      status: "partial"
    });
    assert.deepEqual(lineasDeFalta(envelope, "cumpleluna"), [
      "Falta el Sol o la Luna natal en tu carta guardada: sin eso no hay ciclo personal."
    ]);
  });

  it("cuando el sobre entero se cayó, los dos bloques dicen el mismo motivo", () => {
    const envelope = sobre({
      moonOnChart: null,
      cumpleluna: null,
      status: "provider_error",
      missingInputs: ["current_sun_and_moon"]
    });
    const motivo = ["El proveedor no devolvió posiciones verificables del Sol y la Luna de hoy."];
    assert.deepEqual(lineasDeFalta(envelope, "luna"), motivo);
    assert.deepEqual(lineasDeFalta(envelope, "cumpleluna"), motivo);
  });

  it("sin insumos reconocibles muestra las limitaciones que escribió el backend", () => {
    const envelope = sobre({
      cumpleluna: null,
      missingInputs: ["algo_que_no_conocemos"],
      limitations: ["No pudimos calcular tu ciclo personal."]
    });
    assert.deepEqual(lineasDeFalta(envelope, "cumpleluna"), ["No pudimos calcular tu ciclo personal."]);
  });

  it("nunca queda mudo: un bloque sin explicación se lee como un error de la app", () => {
    assert.deepEqual(lineasDeFalta(sobre({ missingInputs: [], limitations: [] }), "luna"), [
      "Todavía no podemos calcular este módulo."
    ]);
    assert.deepEqual(lineasDeFalta(null, "cumpleluna"), ["Todavía no podemos calcular este módulo."]);
    assert.deepEqual(lineasDeFalta(undefined, "luna"), ["Todavía no podemos calcular este módulo."]);
  });

  it("no repite la misma razón dos veces", () => {
    const envelope = sobre({
      cumpleluna: null,
      missingInputs: ["natal_chart", "natal_chart", "natal_sun_and_moon"]
    });
    assert.deepEqual(lineasDeFalta(envelope, "cumpleluna"), [
      "Todavía no tenemos tu carta natal calculada.",
      "Falta el Sol o la Luna natal en tu carta guardada: sin eso no hay ciclo personal."
    ]);
  });
});
