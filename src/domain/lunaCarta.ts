import { observedDateInTimezone } from "@/domain/dailyContext";
import type {
  CumplelunaData,
  LunaSobreLaCartaPayload,
  LunarPhaseKey,
  MoonOnChartData
} from "@/services/appRefs";

/**
 * La precisión de `home.getLunaSobreLaCarta` llevada a pantalla, **fail-closed**.
 *
 * El sobre de CORE-192 publica cada número con la forma que el cálculo sostiene:
 * la casa natal puede no existir, el recorrido del día puede cruzar más de una
 * casa o de un signo, y el Cumpleluna **nunca** es un instante —su `precision`
 * es `estimated` o `range`, jamás `exact`—, así que viaja siempre con su
 * ventana. Acá se traduce todo eso a texto sin agregar una sola certeza que el
 * sobre no traiga:
 *
 * - sin `natalHouse` no se muestra casa y se explica por qué;
 * - con `range` se dice que el valor se mueve dentro del día;
 * - `nextExactAt` / `previousExactAt` **no se imprimen nunca** como fecha ni
 *   como hora: lo que se imprime es `nextExactAtWindow`, que es lo que el método
 *   afirma. El instante existe para que el backend siga operando, no para
 *   agendarlo.
 *
 * Un solo reloj: todos los números de un bloque salen del MISMO sobre
 * (`observedAt`, escalares del snapshot) y el día de hoy es el `localDate`
 * canónico del propio sobre. `Date.now()` no participa — si participara, la
 * barra del ciclo y su titular podrían contar dos días distintos.
 *
 * Módulo puro (sin React, sin red, sin reloj del dispositivo): ver
 * `test/lunaCarta.test.ts`.
 */

// ---------------------------------------------------------------------------
// Vocabulario de fechas y números
// ---------------------------------------------------------------------------

const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
] as const;

const DIAS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

/** Una ventana de instantes publicada por el contrato. */
export type VentanaInstantes = { earliest: number; latest: number };

function texto(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const limpio = value.trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * Los tres números de una fecha civil `YYYY-MM-DD`.
 *
 * Una fecha civil NO es un instante: pasarla por una zona horaria la puede
 * correr un día entero. Acá se leen los tres números y se usan tal cual.
 */
export function partesDeFechaCivil(iso: string): { anio: number; mes: number; dia: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof iso === "string" ? iso : "");
  if (!match) return null;
  const anio = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return { anio, mes, dia };
}

/** `"2026-09-04"` → `"viernes 4 de septiembre"`. `null` si no es una fecha civil. */
export function fechaCivilLarga(iso: string): string | null {
  const partes = partesDeFechaCivil(iso);
  if (!partes) return null;
  const diaSemana = DIAS_ES[new Date(Date.UTC(partes.anio, partes.mes - 1, partes.dia)).getUTCDay()];
  return `${diaSemana} ${partes.dia} de ${MESES_ES[partes.mes - 1]}`;
}

/**
 * Día civil (`YYYY-MM-DD`) que le corresponde a un instante en una zona.
 *
 * Reusa el mismo lector que el proveedor de la fecha canónica; una zona
 * inválida devuelve `null` y quien llama deja de imprimir la fecha en vez de
 * mostrar la del dispositivo.
 */
export function fechaCivilEnZona(ms: number, timezone: string): string | null {
  if (!Number.isFinite(ms) || !texto(timezone)) return null;
  const iso = observedDateInTimezone(ms, timezone);
  return partesDeFechaCivil(iso) ? iso : null;
}

/** `"4 de septiembre"` en la zona pedida. */
export function formatDiaMes(ms: number, timezone: string): string | null {
  const iso = fechaCivilEnZona(ms, timezone);
  const partes = iso ? partesDeFechaCivil(iso) : null;
  return partes ? `${partes.dia} de ${MESES_ES[partes.mes - 1]}` : null;
}

/**
 * La ventana entera, corta: `"entre el 12 y el 14 de septiembre"`.
 *
 * Es la única forma en que se dice una fecha que el cálculo no puede fijar. El
 * punto medio existe y es tentador de imprimir, pero es un día que el método
 * nunca afirmó: escribirlo solo lo vuelve agendable. Una ventana que cabe en un
 * solo día civil sigue siendo una ventana —`"dentro del 12 de septiembre"`— y
 * no una fecha suelta: el día se afirma, la hora no.
 */
export function formatVentanaDiaMes(ventana: VentanaInstantes, timezone: string): string | null {
  const desdeIso = fechaCivilEnZona(ventana?.earliest, timezone);
  const hastaIso = fechaCivilEnZona(ventana?.latest, timezone);
  const desde = desdeIso ? partesDeFechaCivil(desdeIso) : null;
  const hasta = hastaIso ? partesDeFechaCivil(hastaIso) : null;
  if (!desde || !hasta) return null;
  if (desdeIso === hastaIso) return `dentro del ${desde.dia} de ${MESES_ES[desde.mes - 1]}`;
  if (desde.anio === hasta.anio && desde.mes === hasta.mes) {
    return `entre el ${desde.dia} y el ${hasta.dia} de ${MESES_ES[hasta.mes - 1]}`;
  }
  return `entre el ${desde.dia} de ${MESES_ES[desde.mes - 1]} y el ${hasta.dia} de ${MESES_ES[hasta.mes - 1]}`;
}

/** Fracción 0–1 a porcentaje entero. `null` si el número no es utilizable. */
export function formatPorcentaje(valor: number): string | null {
  if (!Number.isFinite(valor)) return null;
  return `${Math.round(Math.max(0, Math.min(1, valor)) * 100)}%`;
}

/** Decimal con coma, como se escribe en español. */
export function formatDecimal(valor: number, digitos = 1): string | null {
  if (!Number.isFinite(valor)) return null;
  return valor.toFixed(digitos).replace(".", ",");
}

/** Proporción utilizable para dibujar, o `null` si el número no sirve. */
function fraccion(valor: number): number | null {
  if (!Number.isFinite(valor)) return null;
  return Math.max(0, Math.min(1, valor));
}

function capitalizar(value: string): string {
  return value.charAt(0).toLocaleUpperCase("es") + value.slice(1);
}

// ---------------------------------------------------------------------------
// Por qué falta un bloque
// ---------------------------------------------------------------------------

/**
 * Qué significa cada insumo faltante del sobre, en palabras nuestras.
 *
 * El backend ya manda `limitations` redactadas, pero mezcla las de los dos
 * bloques en una sola lista: usarlas tal cual pondría la limitación de la Luna
 * debajo del Cumpleluna. Estos códigos son el contrato (`missingInputs`) y no
 * cambian con la redacción, así que la razón que se muestra es siempre la del
 * bloque que falta.
 */
const MOTIVO_POR_INSUMO: Record<string, string> = {
  authenticated_session: "Este módulo mide tu carta natal: necesita una sesión iniciada.",
  authenticated_user: "Tu sesión todavía no tiene una cuenta creada en Órbita.",
  canonical_local_date_mismatch: "El día pedido no coincide con el día canónico del servidor.",
  canonical_timezone_mismatch: "La zona horaria pedida no coincide con la canónica del servidor.",
  valid_local_date_and_timezone: "No pudimos resolver la fecha local y su zona para medir el cielo de hoy.",
  astrologyapi_credentials_not_configured:
    "El proveedor astrológico no está configurado: no inventamos las posiciones del día.",
  current_sun_and_moon: "El proveedor no devolvió posiciones verificables del Sol y la Luna de hoy.",
  natal_chart: "Todavía no tenemos tu carta natal calculada.",
  natal_sun_and_moon: "Falta el Sol o la Luna natal en tu carta guardada: sin eso no hay ciclo personal.",
  exact_birth_time: "Sin hora exacta de nacimiento no ubicamos la Luna en una casa de tu carta.",
  complete_natal_houses: "Faltan las doce cúspides completas de tu carta para ubicar la Luna."
};

/** Insumos que dejan a CADA bloque sin dato (no los que sólo bajan su precisión). */
const INSUMOS_DEL_SOBRE: readonly string[] = [
  "authenticated_session",
  "authenticated_user",
  "canonical_local_date_mismatch",
  "canonical_timezone_mismatch",
  "valid_local_date_and_timezone",
  "astrologyapi_credentials_not_configured",
  "current_sun_and_moon"
];

const INSUMOS_POR_BLOQUE: Record<"luna" | "cumpleluna", readonly string[]> = {
  // La hora de nacimiento y las cúspides NO dejan sin Luna: sólo sacan la casa.
  luna: INSUMOS_DEL_SOBRE,
  cumpleluna: [...INSUMOS_DEL_SOBRE, "natal_chart", "natal_sun_and_moon"]
};

/**
 * La línea gris de un bloque sin dato.
 *
 * Se prefieren los códigos del propio bloque; si el sobre no trae ninguno
 * reconocible se muestran sus `limitations` tal como las escribió el backend, y
 * recién si tampoco hay, una línea honesta y genérica. Nunca queda vacío: un
 * bloque mudo se lee como un error de la app, no como un dato que falta.
 */
export function lineasDeFalta(
  sobre: LunaSobreLaCartaPayload | null | undefined,
  bloque: "luna" | "cumpleluna"
): string[] {
  const codigos = sobre && Array.isArray(sobre.missingInputs) ? sobre.missingInputs : [];
  const delBloque = codigos.filter((codigo) => INSUMOS_POR_BLOQUE[bloque].includes(codigo));
  const elegidos = (delBloque.length > 0 ? delBloque : codigos)
    .map((codigo) => MOTIVO_POR_INSUMO[codigo])
    .filter((linea): linea is string => Boolean(linea));
  if (elegidos.length > 0) return unicas(elegidos);

  const limitaciones = (sobre && Array.isArray(sobre.limitations) ? sobre.limitations : [])
    .map(texto)
    .filter((linea): linea is string => linea !== null);
  if (limitaciones.length > 0) return unicas(limitaciones);

  return ["Todavía no podemos calcular este módulo."];
}

function unicas(valores: readonly string[]): string[] {
  return [...new Set(valores)];
}

/** ¿El snapshot es del día canónico del sobre? Si no, sus números son de otro día. */
function lineaDeOtroDia(observedAt: number, sobre: LunaSobreLaCartaPayload): string | null {
  const dia = fechaCivilEnZona(observedAt, sobre.timezone);
  const canonico = partesDeFechaCivil(sobre.localDate) ? sobre.localDate : null;
  if (!dia || !canonico || dia === canonico) return null;
  const fecha = formatDiaMes(observedAt, sobre.timezone);
  return fecha
    ? `Estos números son del cálculo del ${fecha}, no del día de hoy.`
    : "Estos números son de un cálculo de otro día.";
}

// ---------------------------------------------------------------------------
// LA LUNA EN TU CARTA
// ---------------------------------------------------------------------------

export type LunaVista = {
  /** `"Cuarto creciente en Aries"`. */
  titular: string;
  /** Fila mono: iluminación, casa y el recorrido del día cuando hay más de uno. */
  meta: string[];
  /** El resumen que escribió el backend. `null` si no vino. */
  resumen: string | null;
  /** Casa natal por la que pasa al mediodía local, con su tema. `null` sin casa. */
  casa: { numero: number; tema: string | null } | null;
  /**
   * El tema de la casa como frase, SÓLO cuando el resumen del backend no vino.
   * Cuando viene, ya lo dice él: escribirlo otra vez sería el mismo dato dos
   * veces con distintas palabras.
   */
  tema: string | null;
  /** Fase para dibujar el terminador del disco. `null` si no es una fase válida. */
  phaseKey: LunarPhaseKey | null;
  /** Fracción iluminada 0–1 para el disco. `null` si el número no es utilizable. */
  iluminacion: number | null;
  /** Qué NO afirma este bloque. Siempre explica la casa ausente. */
  limitaciones: string[];
  /** Etiqueta accesible del disco: dice lo que el disco DIBUJA, no el resumen. */
  voz: string;
};

/**
 * La Luna de hoy sobre la carta, ya en palabras.
 *
 * El disco dibuja la iluminación medida en `observedAt` (el mediodía local del
 * día canónico). La casa se muestra sólo si el sobre la trae; cuando no, la
 * limitación dice exactamente qué faltó y el bloque sigue mostrando signo y fase,
 * que sí son datos del día.
 */
export function lunaVista(data: MoonOnChartData, sobre: LunaSobreLaCartaPayload): LunaVista {
  const fase = texto(data.phaseName);
  const signo = texto(data.sign);
  const titular = fase && signo ? `${capitalizar(fase)} en ${signo}` : signo ? `Luna en ${signo}` : capitalizar(fase ?? "Luna de hoy");

  const casa =
    data.natalHouse !== null && Number.isInteger(data.natalHouse)
      ? { numero: data.natalHouse, tema: texto(data.houseTheme) }
      : null;

  const iluminacion = fraccion(data.illumination);
  const porcentaje = iluminacion === null ? null : formatPorcentaje(iluminacion);

  // El recorrido del día se dice en la fila mono, no en otra frase: el resumen
  // del backend ya cuenta el cambio de casa en prosa y repetirlo abajo haría que
  // el bloque diga dos veces lo mismo con distintas palabras.
  const casasDelDia = Array.isArray(data.housesToday) ? data.housesToday.filter(Number.isInteger) : [];
  const signosDelDia = Array.isArray(data.signsToday) ? data.signsToday.map(texto).filter((s): s is string => s !== null) : [];

  const meta = [
    porcentaje ? `${porcentaje} ILUMINADA` : null,
    casa ? `TU CASA ${casa.numero}` : null,
    casasDelDia.length > 1 ? `HOY CASAS ${casasDelDia.join(" Y ")}` : null,
    signosDelDia.length > 1 ? `HOY EN ${signosDelDia.join(" Y ").toLocaleUpperCase("es")}` : null
  ].filter((item): item is string => item !== null);

  const limitaciones: string[] = [];
  if (!casa) limitaciones.push(motivoSinCasa(sobre));
  if (data.precision === "range") {
    limitaciones.push(
      "Las posiciones son del mediodía local: dentro del día la Luna cruza más de una casa o de un signo."
    );
  }
  const otroDia = lineaDeOtroDia(data.observedAt, sobre);
  if (otroDia) limitaciones.push(otroDia);

  const voz = [
    signo ? `Luna en ${signo}.` : null,
    fase && porcentaje ? `${fase}, ${porcentaje} iluminada.` : fase ? `${fase}.` : porcentaje ? `${porcentaje} iluminada.` : null,
    casa ? `Casa ${casa.numero} de tu carta.` : null
  ]
    .filter((linea): linea is string => linea !== null)
    .join(" ");

  const resumen = texto(data.summary);
  return {
    titular,
    meta,
    resumen,
    casa,
    tema: !resumen && casa?.tema ? `Tu casa ${casa.numero} habla de ${casa.tema}.` : null,
    phaseKey: FASES_LUNARES.includes(data.phaseKey) ? data.phaseKey : null,
    iluminacion,
    limitaciones: unicas(limitaciones),
    voz: voz.length > 0 ? voz : titular
  };
}

/** Las ocho fases del contrato. Una clave desconocida no dibuja terminador. */
const FASES_LUNARES: readonly LunarPhaseKey[] = [
  "new",
  "waxing_crescent",
  "first_quarter",
  "waxing_gibbous",
  "full",
  "waning_gibbous",
  "last_quarter",
  "waning_crescent"
];

/** Por qué este sobre no pudo ubicar la Luna en una casa tuya. */
function motivoSinCasa(sobre: LunaSobreLaCartaPayload): string {
  const codigos = Array.isArray(sobre.missingInputs) ? sobre.missingInputs : [];
  for (const codigo of ["natal_chart", "exact_birth_time", "complete_natal_houses"]) {
    if (codigos.includes(codigo)) {
      return codigo === "natal_chart"
        ? "Todavía no tenemos tu carta natal: mostramos el signo y la fase de hoy, pero no una casa tuya."
        : MOTIVO_POR_INSUMO[codigo];
    }
  }
  return "No pudimos ubicar la Luna de hoy en una casa de tu carta.";
}

// ---------------------------------------------------------------------------
// CUMPLELUNA
// ---------------------------------------------------------------------------

/**
 * El Cumpleluna del día, con la certeza que la ventana sostiene.
 *
 * - `hoy`: la ventana publicada entra ENTERA en el día canónico. El evento
 *   ocurre hoy aunque nadie pueda decir a qué hora.
 * - `posible`: la ventana sólo CRUZA el día. Puede caer hoy y puede caer otro
 *   día; decir «es hoy» sería inventar el borde que el cálculo no tiene.
 *
 * Nunca hay una tercera certeza: este contrato no publica `exact`, así que no
 * existe un instante que permita decir «fue» o «será» ni imprimir una hora.
 */
export type CumplelunaHoy =
  | { certeza: "hoy"; ventana: VentanaInstantes }
  | { certeza: "posible"; ventana: VentanaInstantes };

/**
 * ¿La repetición del ángulo natal cae en el día canónico?
 *
 * Se miran las DOS ventanas del sobre: la anterior y la próxima. Mirando sólo la
 * próxima, un Cumpleluna cuya ventana empezó ayer y termina hoy desaparecería
 * justo el día que importa, porque `nextExactAtWindow` ya apunta al mes que
 * viene. La ventana contenida gana sobre la que sólo cruza.
 *
 * El día NO sale del reloj: es el `localDate` canónico, comparado con el día
 * civil de cada borde en la zona del sobre.
 */
export function cumplelunaHoy(
  data: CumplelunaData,
  localDate: string,
  timezone: string
): CumplelunaHoy | null {
  const dia = partesDeFechaCivil(localDate) ? localDate : null;
  if (!dia) return null;

  const ventanas: Array<VentanaInstantes | null | undefined> = [
    data?.previousExactAtWindow,
    data?.nextExactAtWindow
  ];
  let posible: CumplelunaHoy | null = null;
  for (const ventana of ventanas) {
    if (!ventana) continue;
    const desde = fechaCivilEnZona(ventana.earliest, timezone);
    const hasta = fechaCivilEnZona(ventana.latest, timezone);
    if (!desde || !hasta) continue;
    // Las fechas civiles `YYYY-MM-DD` se comparan como texto: el orden
    // lexicográfico es el cronológico.
    if (desde === dia && hasta === dia) return { certeza: "hoy", ventana };
    if (desde <= dia && dia <= hasta && !posible) posible = { certeza: "posible", ventana };
  }
  return posible;
}

export type CumplelunaVista = {
  /** `"Ocurre hoy"` · `"Puede caer hoy"` · `"Entre el 12 y el 14 de septiembre"`. */
  titular: string;
  /** La ventana que sostiene el titular. Sin ventana no hay vista. */
  cuando: string;
  /** `"entre 27,4 y 30,1 días"` · `"menos de un día"`; se omite si el evento ya es hoy. */
  faltan: string | null;
  /** `"DÍA ENTRE 17,9 Y 19,1 DE 29,5"`: el reloj personal del snapshot. */
  relojDelCiclo: string | null;
  /** Avance 0–1 del ciclo, tal como lo fijó el backend en `observedAt`. */
  avance: number | null;
  /** La franja posible del avance cuando el día del ciclo tiene ventana. */
  banda: { desde: number; hasta: number } | null;
  resumen: string | null;
  meta: string[];
  limitaciones: string[];
  /** Etiqueta accesible del titular. La barra anuncia el reloj por su cuenta. */
  voz: string;
};

/**
 * El Cumpleluna en palabras.
 *
 * Todos los números salen del MISMO sobre y del mismo `observedAt`: el día del
 * ciclo, lo que falta y el avance son escalares que el backend fijó en ese
 * instante, y la ventana es la que publicó. Nada se recalcula contra el reloj
 * del dispositivo, así que la barra y el titular no pueden contradecirse.
 */
export function cumplelunaVista(
  data: CumplelunaData,
  sobre: LunaSobreLaCartaPayload,
  hoy: CumplelunaHoy | null
): CumplelunaVista | null {
  const zona = sobre.timezone;
  // Si una ventana anterior todavía cruza el día canónico, ésa es la que
  // sostiene «Ocurre hoy» / «Puede caer hoy». Mostrar a su lado la PRÓXIMA
  // ventana mezclaría dos ciclos distintos en un mismo titular.
  const ventanaVisible = hoy?.ventana ?? data.nextExactAtWindow;
  const cuando = ventanaVisible ? formatVentanaDiaMes(ventanaVisible, zona) : null;
  // Fail-closed: el Cumpleluna se muestra SIEMPRE con su ventana. Si el sobre
  // no trae una o la zona no la resuelve, no hay bloque —el módulo explica por
  // qué falta— en vez de un titular genérico que afirme un evento sin fecha.
  if (!cuando) return null;

  const titular =
    hoy?.certeza === "hoy" ? "Ocurre hoy" : hoy?.certeza === "posible" ? "Puede caer hoy" : capitalizar(cuando);

  // `daysRemainingWindowDays` siempre apunta a la próxima repetición. Cuando
  // el módulo ya está contando un evento de hoy —incluida una ventana anterior
  // que termina hoy— esa cuenta no acompaña al titular y se omite.
  const faltan = hoy ? null : ventanaDeDias(data.daysRemainingWindowDays);

  // El ciclo, fail-closed. El lector del sobre rellena con 0 los escalares
  // que no vinieron (`cycleLengthDays`, `cycleFraction`, `cycleDay`), y un
  // ciclo de 0 días o un avance que no cae dentro del día del ciclo que el
  // propio sobre publica no son datos: son huecos. Sin largo no hay reloj, ni
  // avance, ni franja, ni «CICLO»; con largo, el avance sólo se dibuja si es
  // coherente con `cycleDayWindowDays`, que sí viene validado.
  const largoDias = Number.isFinite(data.cycleLengthDays) && data.cycleLengthDays > 0 ? data.cycleLengthDays : null;
  const largo = largoDias === null ? null : formatDecimal(largoDias);
  const diaDelCiclo = largoDias === null ? null : ventanaDeNumeros(data.cycleDayWindowDays);
  const relojDelCiclo =
    diaDelCiclo && largo ? `DÍA ${diaDelCiclo.toLocaleUpperCase("es")} DE ${largo.toLocaleUpperCase("es")}` : null;

  const avance = largoDias === null ? null : avanceCoherente(data, largoDias);
  const banda = bandaDelCiclo(data);

  const meta = [
    hoy && cuando ? `VENTANA ${cuando.toLocaleUpperCase("es")}` : null,
    !hoy && faltan ? `FALTAN ${faltan.toLocaleUpperCase("es")}` : null,
    largo ? `CICLO ${largo} DÍAS` : null
  ].filter((item): item is string => item !== null);

  const limitaciones = [
    "El Cumpleluna se estima propagando la distancia entre el Sol y la Luna: publicamos la ventana, no un instante exacto.",
    data.precision === "range"
      ? "Sin hora exacta de nacimiento el ángulo de tu nacimiento tiene tolerancia, así que la ventana se abre todavía más."
      : null,
    largoDias === null ? "El sobre no trajo el largo de tu ciclo personal: no mostramos el reloj ni el avance." : null,
    lineaDeOtroDia(data.observedAt, sobre)
  ].filter((linea): linea is string => linea !== null);

  const vozBase =
    hoy?.certeza === "hoy"
      ? "Tu cumpleluna ocurre hoy."
      : hoy?.certeza === "posible"
        ? "Tu cumpleluna puede caer hoy."
        : `Próximo cumpleluna ${cuando}.`;

  // El resumen del backend describe la PRÓXIMA repetición. Si la ventana que
  // todavía toca hoy es la anterior, mostrarlo debajo de «Ocurre hoy» produce
  // una contradicción del tipo «hoy / en 29 días». En ese único caso se omite;
  // el dato de hoy sigue completo en titular, ventana y reloj del ciclo.
  const eventoEsVentanaAnterior = Boolean(
    hoy &&
      mismaVentana(hoy.ventana, data.previousExactAtWindow) &&
      !mismaVentana(hoy.ventana, data.nextExactAtWindow)
  );
  const voz = hoy && cuando ? `${vozBase} Ventana ${cuando}.` : vozBase;

  return {
    titular,
    cuando,
    faltan,
    relojDelCiclo,
    avance,
    banda,
    resumen: eventoEsVentanaAnterior ? null : texto(data.summary),
    meta,
    limitaciones: unicas(limitaciones),
    voz
  };
}

/**
 * El avance del ciclo, sólo si cuadra con el día del ciclo que el sobre publica.
 *
 * `cycleFraction` es un escalar que el lector rellena con 0 cuando falta;
 * `cycleDayWindowDays` viene validado y es la misma magnitud en días. Si el
 * avance cae fuera de esa ventana —con medio día de tolerancia por redondeo—
 * no es el avance de este snapshot y no se dibuja: queda la franja, que sí es
 * un dato del sobre.
 */
function avanceCoherente(data: CumplelunaData, largoDias: number): number | null {
  const avance = fraccion(data.cycleFraction);
  const rango = data.cycleDayWindowDays;
  if (avance === null || !rango || !Number.isFinite(rango.from) || !Number.isFinite(rango.to)) return null;
  const dia = avance * largoDias;
  const tolerancia = 0.5;
  return dia >= rango.from - tolerancia && dia <= rango.to + tolerancia ? avance : null;
}

function mismaVentana(a: VentanaInstantes | null | undefined, b: VentanaInstantes | null | undefined): boolean {
  return Boolean(a && b && a.earliest === b.earliest && a.latest === b.latest);
}

/** `{ from: 27.4, to: 30.1 }` → `"entre 27,4 y 30,1 días"`. */
function ventanaDeDias(rango: { from: number; to: number } | null | undefined): string | null {
  if (!rango || !Number.isFinite(rango.from) || !Number.isFinite(rango.to)) return null;
  const desde = Math.max(0, rango.from);
  const hasta = Math.max(0, rango.to);
  if (hasta < 1) return "menos de un día";
  const a = formatDecimal(desde);
  const b = formatDecimal(hasta);
  if (!a || !b) return null;
  return a === b ? `${a} días` : `entre ${a} y ${b} días`;
}

/** `{ from: 17.9, to: 19.1 }` → `"entre 17,9 y 19,1"` (o el número solo). */
function ventanaDeNumeros(rango: { from: number; to: number } | null | undefined): string | null {
  if (!rango || !Number.isFinite(rango.from) || !Number.isFinite(rango.to)) return null;
  const a = formatDecimal(Math.max(0, rango.from));
  const b = formatDecimal(Math.max(0, rango.to));
  if (!a || !b) return null;
  return a === b ? a : `entre ${a} y ${b}`;
}

/**
 * La franja del avance, cuando el día del ciclo viene con ventana.
 *
 * Sin hora exacta de nacimiento el avance no es un punto: dibujarlo como uno
 * afirmaría que sabemos en qué día del ciclo estás. Con la franja, la barra
 * muestra la zona posible y nada más.
 */
function bandaDelCiclo(data: CumplelunaData): { desde: number; hasta: number } | null {
  const rango = data.cycleDayWindowDays;
  const largo = data.cycleLengthDays;
  if (!rango || !Number.isFinite(largo) || largo <= 0) return null;
  const desde = fraccion(rango.from / largo);
  const hasta = fraccion(rango.to / largo);
  if (desde === null || hasta === null || hasta <= desde) return null;
  return { desde, hasta };
}

/**
 * Por qué el Cumpleluna subió al primer lugar, dicho con su certeza.
 *
 * Sin instante no hay tiempo verbal que sostener: una ventana no «fue» ni
 * «será», cae —entera o parcialmente— en el día, y eso es todo lo que se puede
 * decir sin fingir una precisión que no existe.
 */
export function cumplelunaIntroDeHoy(hoy: CumplelunaHoy, timezone: string): string {
  const cierre = "Debajo están los otros movimientos del día.";
  if (hoy.certeza === "hoy") {
    return `Tu cumpleluna ocurre hoy, por eso aparece primero. El cálculo no puede fijar la hora, pero la ventana estimada entra entera en el día de hoy. ${cierre}`;
  }
  const ventana = formatVentanaDiaMes(hoy.ventana, timezone);
  return ventana
    ? `Tu cumpleluna puede caer hoy, por eso aparece primero: el cálculo lo acota a una ventana —${ventana}— que incluye el día de hoy. ${cierre}`
    : `Tu cumpleluna puede caer hoy, por eso aparece primero: la ventana estimada incluye el día de hoy. ${cierre}`;
}
