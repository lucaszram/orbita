/**
 * CORE-431 — alcance de lectura de `analysisSnapshotsV492`.
 *
 * El defecto que cierra esta prueba: `layers.getForDate`, `layers.getNatalBase`
 * y `layers.getRefreshState` materializaban TODOS los análisis de la persona
 * (`by_user` + `collect`) y recién después elegían los pocos que la pantalla
 * usa. El costo de abrir Hoy crecía entonces con cada día que la cuenta hubiera
 * guardado alguna vez, aunque la respuesta fuera siempre del mismo tamaño.
 *
 * Qué se mide y qué NO
 * --------------------
 * Se mide, sobre los handlers REALES, con una base instrumentada:
 *
 * · `documentos`: las filas que el rango de índice MATERIALIZA, contadas antes
 *   de cualquier filtro de aplicación. Ése es el punto: un `collect` amplio
 *   seguido de un `.filter()` paga todas las filas, así que esta prueba no lo
 *   aprueba aunque la respuesta final sea idéntica.
 * · `bytes`: el tamaño serializado (`JSON.stringify`) de esas mismas filas.
 *
 * NO es la métrica que Convex factura. Es una medición SINTÉTICA y LOCAL sobre
 * fixtures: no incluye la representación interna de Convex, ni los índices, ni
 * el overhead del transporte, ni la frecuencia real de ejecución en DEV. Sirve
 * para comparar ANTES contra DESPUÉS sobre el MISMO escenario, no para afirmar
 * un ahorro en dólares ni un tamaño de factura. La medición real en DEV exige
 * un deploy aparte y queda fuera de esta entrega.
 *
 * Cómo se reproduce el ANTES
 * --------------------------
 * `adaptadorDeLecturaAmplia` envuelve la misma base y contesta cualquier rango
 * de `analysisSnapshotsV492` con UNA materialización amplia por invocación
 * —exactamente lo que hacía el código anterior: `by_user` + `collect`—, y
 * aplica la selección que aplicaba el código anterior y ninguna otra. Los
 * handlers son los de producción en los dos lados.
 *
 * La paridad de respuestas entre los dos lados es, para el alcance diario,
 * estructural: las tres franjas son una partición del filtro anterior, así que
 * las dos ramas terminan entregándole al handler el mismo conjunto de filas. La
 * comprobación FALSIFICABLE de que no se perdió ninguna fila es «el alcance
 * nuevo trae exactamente lo que traía el filtro anterior», que compara los
 * rangos de índice reales contra `lecturaAmplia` sobre un corpus adversario. Si
 * faltara uno de los tres rangos, esa prueba falla; la paridad de respuestas,
 * no.
 *
 * Para `getNatalBase` la paridad sí es falsificable por sí sola, y por eso el
 * adaptador ignora ahí la igualdad de `analysisId`: el ANTES le entrega al
 * handler TODAS las filas de la persona —lo que hacía el código anterior—, y el
 * camino nuevo sólo tres familias. Si esas tres familias fueran las
 * equivocadas, o faltara una, las respuestas diferirían.
 *
 * Qué NO demuestra la lista de filas materializadas
 * -------------------------------------------------
 * Esa lista es un CONJUNTO —qué se leyó, qué no y cuánto costó—, no el orden en
 * el que producción elige entre candidatas: las filas salen en el orden en el
 * que los rangos las leyeron. La selección se observa donde producción la
 * publica: en la lista ordenada que devuelve `getRefreshState` y en el dato que
 * `getForDate` termina sirviendo. Ahí apuntan las pruebas de orden.
 */
import assert from "node:assert/strict";
import test from "node:test";

import schema from "../convex/schema";
import { getForDate, getNatalBase, getRefreshState } from "../convex/layers";
import { buildBirthDataHash, buildNatalChartCacheKey } from "../convex/lib/birthDataConsistency";
import { getAnalysisDefinition, getSourceRefs, type AnalysisId } from "../convex/content/astrologySources";
import type { AnalysisResult, BirthDataSnapshot, EphemerisPosition, NormalizedChartSnapshot } from "../convex/lib/layerContract";
import { stableInputHash } from "../convex/lib/stableHash";
import { resolveZonedCivilTime } from "../convex/lib/civilTime";

const HOUR_MS = 60 * 60 * 1000;
const NATAL_EPHEMERIS_METHOD_VERSION = "natal-ephemeris-planets-tropical-cache-v1";
const NATAL_EPHEMERIS_PROVIDER_VERSION = "astrologyapi-planets-tropical-v1";

// ---------------------------------------------------------------------------
// Base instrumentada
// ---------------------------------------------------------------------------

type Fila = Record<string, any> & { _id: string; _creationTime: number };

/** Lo que costó una lectura: filas materializadas por el índice y su tamaño. */
type Costo = { documentos: number; bytes: number };

type Lectura = Costo & { tabla: string; indice: string; filas: readonly string[] };

const vacio = (): Costo => ({ documentos: 0, bytes: 0 });

const sumar = (lecturas: readonly Lectura[], tabla?: string): Costo =>
  lecturas
    .filter((lectura) => tabla === undefined || lectura.tabla === tabla)
    .reduce(
      (total, lectura) => ({
        documentos: total.documentos + lectura.documentos,
        bytes: total.bytes + lectura.bytes,
      }),
      vacio(),
    );

/**
 * Los índices REALES, leídos de `convex/schema.ts`.
 *
 * No se copian a mano a propósito: si una consulta nombrara un índice que el
 * schema no define —o usara sus campos fuera de orden, que es lo que Convex
 * rechaza— esta base falla igual que el servidor, en vez de contestar como si
 * el índice existiera y dar una medición que no significa nada.
 */
function indicesDelSchema(tabla: string): Map<string, string[]> {
  const definicion = (schema as any).tables[tabla];
  assert.ok(definicion, `el schema no define la tabla ${tabla}`);
  const indices: Array<{ indexDescriptor: string; fields: string[] }> = definicion[" indexes"]();
  const mapa = new Map<string, string[]>(
    indices.map((indice) => [indice.indexDescriptor, indice.fields]),
  );
  // Convex ofrece siempre el índice implícito de creación.
  mapa.set("by_creation_time", []);
  return mapa;
}

function bytesDe(filas: readonly Fila[]) {
  return filas.reduce((total, fila) => total + Buffer.byteLength(JSON.stringify(fila), "utf8"), 0);
}

type BaseInstrumentada = ReturnType<typeof baseInstrumentada>;

function baseInstrumentada() {
  const tablas = new Map<string, Fila[]>();
  const lecturas: Lectura[] = [];
  let secuencia = 0;

  const tabla = (nombre: string) => {
    const actual = tablas.get(nombre);
    if (actual) return actual;
    const nueva: Fila[] = [];
    tablas.set(nombre, nueva);
    return nueva;
  };

  /**
   * Siembra una fila.
   *
   * Por defecto `_id` y `_creationTime` salen de una secuencia creciente, así
   * que el orden de siembra es el orden del índice. `forzar` existe para el
   * único caso que esa secuencia no sabe construir: dos filas creadas en el
   * MISMO instante, donde el orden del índice ya no lo decide la creación sino
   * el `_id` del documento.
   */
  const seed = (
    nombre: string,
    campos: Record<string, unknown>,
    forzar?: { _id?: string; _creationTime?: number },
  ) => {
    secuencia += 1;
    const fila = {
      ...structuredClone(campos),
      _id: forzar?._id ?? `${nombre}:${String(secuencia).padStart(8, "0")}`,
      _creationTime: forzar?._creationTime ?? secuencia,
    } as Fila;
    assert.equal(
      tabla(nombre).some((otra) => otra._id === fila._id),
      false,
      `_id repetido en ${nombre}: ${fila._id}`,
    );
    tabla(nombre).push(fila);
    return fila._id;
  };

  /** El rango de índice: igualdades en orden, y el orden del índice para salir. */
  const rango = (nombreTabla: string, indice: string, igualdades: Array<[string, unknown]>) => {
    const campos = indicesDelSchema(nombreTabla).get(indice);
    assert.ok(campos, `${nombreTabla} no define el índice ${indice}`);
    igualdades.forEach(([campo], posicion) => {
      assert.equal(
        campo,
        campos[posicion],
        `${nombreTabla}.${indice}: las igualdades tienen que seguir el orden del índice`,
      );
    });
    const filas = tabla(nombreTabla).filter((fila) =>
      igualdades.every(([campo, valor]) => fila[campo] === valor),
    );
    // Orden del índice: los campos declarados, después la creación y —cuando
    // también empata— el `_id` del documento. Ese último tramo no es un
    // detalle del doble: es lo que hace TOTAL al orden de un índice de Convex,
    // y por lo tanto lo que la selección de las lecturas tiene que reproducir.
    return [...filas].sort((izquierda, derecha) => {
      for (const campo of campos) {
        const a = izquierda[campo];
        const b = derecha[campo];
        if (a === b) continue;
        if (a === undefined) return -1;
        if (b === undefined) return 1;
        return a < b ? -1 : 1;
      }
      if (izquierda._creationTime !== derecha._creationTime) {
        return izquierda._creationTime - derecha._creationTime;
      }
      return izquierda._id < derecha._id ? -1 : izquierda._id > derecha._id ? 1 : 0;
    });
  };

  const db = {
    async get(id: string) {
      for (const filas of tablas.values()) {
        const encontrada = filas.find((fila) => fila._id === id);
        if (encontrada) return structuredClone(encontrada);
      }
      return null;
    },
    query(nombreTabla: string) {
      let indice = "by_creation_time";
      let igualdades: Array<[string, unknown]> = [];
      let descendente = false;
      let predicado: ((fila: Fila) => boolean) | null = null;

      const constructor = {
        eq(campo: string, valor: unknown) {
          igualdades.push([campo, valor]);
          return constructor;
        },
      };

      /**
       * Recorre el rango cobrando CADA fila que materializa, y recién después
       * aplica el filtro de aplicación. Con límite (`first`, `take`) se corta
       * al alcanzarlo, que es lo que también hace el motor real.
       */
      const recorrer = (limite: number | null) => {
        const enRango = rango(nombreTabla, indice, igualdades);
        const ordenadas = descendente ? [...enRango].reverse() : enRango;
        const materializadas: Fila[] = [];
        const elegidas: Fila[] = [];
        for (const fila of ordenadas) {
          materializadas.push(fila);
          if (!predicado || predicado(fila)) elegidas.push(fila);
          if (limite !== null && elegidas.length >= limite) break;
        }
        lecturas.push({
          tabla: nombreTabla,
          indice,
          documentos: materializadas.length,
          bytes: bytesDe(materializadas),
          filas: materializadas.map((fila) => fila._id),
        });
        return elegidas.map((fila) => structuredClone(fila));
      };

      const cursor: any = {
        withIndex(nombre: string, construir?: (constructor: unknown) => unknown) {
          indice = nombre;
          igualdades = [];
          construir?.(constructor);
          return cursor;
        },
        filter(construir: (filtro: any) => (fila: Fila) => boolean) {
          const filtro = {
            field: (campo: string) => ({ campo }),
            eq: (izquierda: any, derecha: unknown) => (fila: Fila) => fila[izquierda.campo] === derecha,
            neq: (izquierda: any, derecha: unknown) => (fila: Fila) => fila[izquierda.campo] !== derecha,
          };
          predicado = construir(filtro) as unknown as (fila: Fila) => boolean;
          return cursor;
        },
        order(direccion: "asc" | "desc") {
          descendente = direccion === "desc";
          return cursor;
        },
        async collect() {
          return recorrer(null);
        },
        async first() {
          return recorrer(1)[0] ?? null;
        },
        async take(cantidad: number) {
          return recorrer(cantidad);
        },
      };
      return cursor;
    },
  };

  return {
    db,
    seed,
    filas: (nombre: string) => tabla(nombre).map((fila) => structuredClone(fila)),
    lecturas: () => [...lecturas],
    reiniciarLecturas: () => {
      lecturas.length = 0;
    },
  };
}

/**
 * La lectura ANTERIOR a CORE-431, copiada tal cual estaba en `convex/layers.ts`.
 *
 * Vive acá y no en producción porque es la referencia contra la que se compara:
 * una franja de índice nueva sólo vale si selecciona EXACTAMENTE esto.
 */
async function lecturaAmplia(
  db: any,
  userId: string,
  alcance: { localDate: string; timezone: string },
): Promise<Fila[]> {
  const filas: Fila[] = await db
    .query("analysisSnapshotsV492")
    .withIndex("by_user", (constructor: any) => constructor.eq("userId", userId))
    .collect();
  return filas
    .filter(
      (fila) =>
        fila.localDate === undefined ||
        (fila.localDate === alcance.localDate &&
          (fila.timezone === undefined || fila.timezone === alcance.timezone)),
    )
    .sort((izquierda, derecha) => derecha.updatedAt - izquierda.updatedAt);
}

/**
 * La base de ANTES: una sola materialización amplia por invocación del handler,
 * y la SELECCIÓN ANTERIOR en memoria. Cualquier rango de
 * `analysisSnapshotsV492` que el handler pida se contesta desde esa lectura,
 * sin volver a cobrarla — que es justo lo que hacía el código anterior con su
 * único `collect`.
 *
 * Lo delicado es QUÉ puede filtrar este adaptador. Si filtrara por las
 * igualdades que pide el camino nuevo, el ANTES aplicaría la misma restricción
 * que la prueba tiene que poner a prueba y la paridad saldría cierta por
 * construcción. Así que filtra lo que filtraba el código anterior, y nada más:
 *
 * · alcance diario (`by_user_local_date_timezone`): el filtro anterior dejaba
 *   pasar `sin fecha ∪ (fecha pedida ∧ sin zona) ∪ (fecha pedida ∧ zona
 *   pedida)`, que es exactamente la partición que piden las tres franjas; por
 *   eso acá se contestan con sus igualdades. La paridad de respuestas es, para
 *   este camino, ESTRUCTURAL —las dos ramas le entregan al handler el mismo
 *   conjunto de filas—, y quien la vuelve falsificable es la comparación fila
 *   por fila contra `lecturaAmplia` sobre el corpus adversario;
 * · natal (`by_user_analysis`): el código anterior NO filtraba por análisis.
 *   `getNatalBase` le pasaba a `natalResults` todas las filas de la persona y
 *   dejaba que `latestMatching` eligiera. Por eso acá se IGNORA la igualdad de
 *   `analysisId` —que es justo la restricción nueva que hay que poner a
 *   prueba— y el handler recibe la tabla entera de la persona. Si
 *   `NATAL_BUNDLE_ANALYSIS_IDS` nombrara una familia equivocada o le faltara
 *   una, el ANTES seguiría publicando ese dato guardado y el DESPUÉS no: las
 *   respuestas diferirían.
 *
 * El natal pide tres rangos, así que recibe tres veces la misma lista. No
 * cambia lo que el handler elige —`latestMatching` se queda con la primera
 * coincidencia, y las tres copias son la misma fila— ni lo que se cobra: la
 * lectura amplia se materializa UNA sola vez por invocación, como antes.
 */
function adaptadorDeLecturaAmplia(base: BaseInstrumentada) {
  // Se memoriza la PROMESA y no el resultado: los rangos del alcance salen en
  // un `Promise.all`, así que memorizar el resultado dejaría que los tres
  // arrancaran su propia lectura amplia antes de que ninguna terminara y el
  // ANTES saldría cobrado tres veces. El código anterior leía UNA vez.
  const amplias = new Map<string, Promise<Fila[]>>();
  return {
    ...base.db,
    query(nombreTabla: string) {
      if (nombreTabla !== "analysisSnapshotsV492") return base.db.query(nombreTabla);
      let indice = "by_creation_time";
      let igualdades: Array<[string, unknown]> = [];
      const constructor = {
        eq(campo: string, valor: unknown) {
          igualdades.push([campo, valor]);
          return constructor;
        },
      };
      const resolver = async () => {
        const userId = String(igualdades.find(([campo]) => campo === "userId")?.[1] ?? "");
        // Las únicas restricciones que el código anterior aplicaba. Por análisis
        // no filtraba nada: el natal recibía la tabla entera de la persona.
        const propias =
          indice === "by_user_analysis"
            ? igualdades.filter(([campo]) => campo === "userId")
            : igualdades.slice();
        let amplia = amplias.get(userId);
        if (!amplia) {
          amplia = base.db
            .query("analysisSnapshotsV492")
            .withIndex("by_user", (q: any) => q.eq("userId", userId))
            .collect() as Promise<Fila[]>;
          amplias.set(userId, amplia);
        }
        return (await amplia).filter((fila) =>
          propias.every(([campo, valor]) => fila[campo] === valor),
        );
      };
      const cursor: any = {
        withIndex(nombre: string, construir?: (constructor: unknown) => unknown) {
          indice = nombre;
          igualdades = [];
          construir?.(constructor);
          return cursor;
        },
        filter() {
          return cursor;
        },
        order() {
          return cursor;
        },
        async collect() {
          return await resolver();
        },
        async first() {
          return (await resolver())[0] ?? null;
        },
      };
      return cursor;
    },
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLANETAS = [
  ["sun", "Sol"],
  ["moon", "Luna"],
  ["mercury", "Mercurio"],
  ["venus", "Venus"],
  ["mars", "Marte"],
  ["jupiter", "Júpiter"],
  ["saturn", "Saturno"],
  ["uranus", "Urano"],
  ["neptune", "Neptuno"],
  ["pluto", "Plutón"],
] as const;

const TOKEN = "https://clerk.test|core-431";
const HOY = "2026-09-18";
const AYER = "2026-09-17";
const ZONA = "America/Lima";
const ZONA_AJENA = "Europe/Madrid";

const DATOS_NATALES: BirthDataSnapshot = {
  birthDate: "1994-05-04",
  birthTime: "12:00",
  birthTimePrecision: "known",
  birthPlaceLabel: "Buenos Aires",
  latitude: -34.6037,
  longitude: -58.3816,
  timezone: "America/Argentina/Buenos_Aires",
  updatedAt: 1,
};

function carta(): NormalizedChartSnapshot {
  return {
    placements: [
      ...PLANETAS.map(([key, label], indice) => ({
        key,
        label,
        sign: indice === 0 ? "Aries" : "Taurus",
        signEs: indice === 0 ? "Aries" : "Tauro",
        degree: indice === 0 ? 0 : 5,
        fullDegree: indice === 0 ? 0 : 35 + indice * 17,
        house: (indice % 12) + 1,
        isRetrograde: false,
      })),
      {
        key: "ascendant",
        label: "Ascendente",
        sign: "Aquarius",
        signEs: "Acuario",
        degree: 5,
        fullDegree: 305,
        house: 1,
        isRetrograde: false,
      },
    ],
    houses: [],
  };
}

function posiciones(): EphemerisPosition[] {
  return PLANETAS.map(([key, label], indice) => ({
    key,
    label,
    sign: indice === 0 ? "Aries" : "Gemini",
    signEs: indice === 0 ? "Aries" : "Géminis",
    degree: indice === 0 ? 0 : 5,
    fullDegree: indice === 0 ? 0 : 65 + indice * 19,
    speed: indice === 0 ? 1 : Math.max(0.01, 13 - indice),
    isRetrograde: false,
  }));
}

function hashEfemerideNatal(datos: BirthDataSnapshot) {
  return stableInputHash({
    methodVersion: NATAL_EPHEMERIS_METHOD_VERSION,
    providerVersion: NATAL_EPHEMERIS_PROVIDER_VERSION,
    birth: {
      birthDate: datos.birthDate,
      birthTime: datos.birthTime,
      birthTimePrecision: datos.birthTimePrecision,
      latitude: datos.latitude,
      longitude: datos.longitude,
      timezone: datos.timezone,
      updatedAt: datos.updatedAt,
    },
  });
}

function efemerideNatal(datos: BirthDataSnapshot) {
  const resuelto = resolveZonedCivilTime({
    localDate: datos.birthDate,
    localTime: datos.birthTime!,
    timezone: datos.timezone,
  });
  assert.equal(resuelto.status, "exact");
  return {
    inputHash: hashEfemerideNatal(datos),
    methodVersion: NATAL_EPHEMERIS_METHOD_VERSION,
    providerVersion: NATAL_EPHEMERIS_PROVIDER_VERSION,
    birthTimePrecision: datos.birthTimePrecision,
    samples: [{ instantMs: resuelto.instantMs, positions: posiciones() }],
    calculatedAt: 1_700_000_000_000,
  };
}

/** El sobre tal como lo publica una capa: sólo cambia lo que la prueba necesita. */
function sobre(args: {
  analysisId: AnalysisId;
  inputHash: string;
  status?: AnalysisResult["status"];
  precision?: AnalysisResult["precision"];
  observedAt: number;
  validUntil?: number | null;
  data?: AnalysisResult["data"];
}): AnalysisResult {
  const definicion = getAnalysisDefinition(args.analysisId);
  return {
    analysisId: args.analysisId,
    methodVersion: definicion.methodVersion,
    inputHash: args.inputHash,
    status: args.status ?? "ready",
    precision: args.precision ?? "exact",
    observedAt: args.observedAt,
    validUntil: args.validUntil ?? null,
    data: args.data ?? null,
    missingInputs: [],
    limitations: [...definicion.limitations],
    elaboration: definicion.elaboration,
    sourceRefs: getSourceRefs(args.analysisId),
  };
}

/** El arco ya estrechado: `data` es una unión cerrada por `kind`. */
function arcoPublicado(envoltura: AnalysisResult) {
  return envoltura.data?.kind === "transit_arc" ? envoltura.data : null;
}

/** Ídem para el ranking, que es el sobre donde se mira qué candidata ganó. */
function rankingPublicado(envoltura: AnalysisResult) {
  return envoltura.data?.kind === "transit_ranking" ? envoltura.data : null;
}

const DIARIOS: readonly AnalysisId[] = ["ORB-TRN-002", "ORB-TRN-001", "ORB-LUN-002", "ORB-LUN-003", "ORB-CYC-007"];

/** La fila tal como la escribe `persistRefresh`, con su `cacheKey` real. */
function filaDeSnapshot(args: {
  userId: string;
  result: AnalysisResult;
  localDate: string;
  timezone: string;
  updatedAt: number;
  /** Fuerza el modo legacy: la fila diaria que nunca declaró fecha o zona. */
  legacy?: "sin_fecha_ni_zona" | "sin_zona";
}) {
  const diaria = DIARIOS.includes(args.result.analysisId);
  const sinFecha = args.legacy === "sin_fecha_ni_zona" || !diaria;
  return {
    userId: args.userId,
    analysisId: args.result.analysisId,
    cacheKey: [
      "v492",
      args.userId,
      args.result.analysisId,
      args.result.methodVersion,
      args.result.inputHash,
      diaria ? args.localDate : "base",
      diaria ? args.timezone : "natal",
    ].join(":"),
    ...(sinFecha ? {} : { localDate: args.localDate }),
    ...(sinFecha || args.legacy === "sin_zona" ? {} : { timezone: args.timezone }),
    methodVersion: args.result.methodVersion,
    providerVersion: args.result.providerVersion,
    inputHash: args.result.inputHash,
    status: args.result.status,
    precision: args.result.precision,
    observedAt: args.result.observedAt,
    validUntil: args.result.validUntil,
    data: args.result.data,
    missingInputs: args.result.missingInputs,
    limitations: args.result.limitations,
    elaboration: args.result.elaboration,
    sourceRefs: args.result.sourceRefs,
    createdAt: args.updatedAt,
    updatedAt: args.updatedAt,
  };
}

const RANKING_TOP = {
  arcId: "moon-trine-mars",
  transitPlanet: "moon",
  natalPoint: "mars",
  aspect: "trine" as const,
};

function datosDeRanking(observedAt: number) {
  return {
    kind: "transit_ranking" as const,
    items: [
      {
        ...RANKING_TOP,
        aspectDegrees: 120,
        orbDegrees: 0.8,
        state: "approaching" as const,
        exactAt: observedAt + 3 * HOUR_MS,
        startsAt: observedAt - 6 * HOUR_MS,
        endsAt: observedAt + 9 * HOUR_MS,
        natalHouse: 6,
        reasons: [
          { key: "exactness" as const, label: "Cercanía", explanation: "El contacto está dentro de orbe." },
        ],
        summary: "La Luna forma un trígono con tu Marte.",
      },
    ],
    activeCount: 1,
    calculatedAt: observedAt,
    summary: "Un contacto activo hoy.",
  };
}

function datosDeArco(observedAt: number) {
  return {
    kind: "transit_arc" as const,
    ...RANKING_TOP,
    natalHouse: 6,
    state: "approaching" as const,
    startsAt: observedAt - 6 * HOUR_MS,
    peakAt: observedAt + 3 * HOUR_MS,
    endsAt: observedAt + 9 * HOUR_MS,
    progress: 0.4,
    passes: [
      { exactAt: observedAt + 3 * HOUR_MS, direction: "direct" as const, label: "Contacto exacto" },
    ],
    summary: "El contacto se acerca a su punto más preciso.",
  };
}

type Escenario = {
  base: BaseInstrumentada;
  userId: string;
  ctx: (db?: any) => any;
};

/**
 * La cuenta del escenario: persona, datos natales, carta, efeméride canónica.
 * Los snapshots los agrega cada prueba, porque su hash lo decide el propio
 * backend (ver `sembrarCacheRealista`).
 */
function cuenta(): Escenario {
  const base = baseInstrumentada();
  const userId = base.seed("users", { tokenIdentifier: TOKEN, name: "Persona de prueba" });
  base.seed("birthData", { userId, ...DATOS_NATALES, updatedAt: DATOS_NATALES.updatedAt });
  base.seed("natalCharts", {
    userId,
    cacheKey: buildNatalChartCacheKey(userId, buildBirthDataHash(DATOS_NATALES as never)),
    payload: { normalized: { ...carta(), summary: {} } },
  });
  const efemeride = efemerideNatal(DATOS_NATALES);
  base.seed("natalEphemerisCachesV492", {
    userId,
    cacheKey: ["v492", "natal-ephemeris", userId, NATAL_EPHEMERIS_METHOD_VERSION, efemeride.inputHash].join(":"),
    ...efemeride,
    updatedAt: 1,
    createdAt: 1,
  });
  base.seed("globalSkySnapshotsV492", {
    cacheKey: `v492:sky:${NATAL_EPHEMERIS_PROVIDER_VERSION}:${HOY}:${ZONA}`,
    localDate: HOY,
    timezone: ZONA,
    providerVersion: NATAL_EPHEMERIS_PROVIDER_VERSION,
    observedAt: 1_700_000_000_000,
    validUntil: null,
    positions: posiciones(),
    createdAt: 1,
    updatedAt: 1,
  });
  return {
    base,
    userId,
    ctx: (db?: any) => ({
      auth: { getUserIdentity: async () => ({ tokenIdentifier: TOKEN }) },
      db: db ?? base.db,
    }),
  };
}

/**
 * Los handlers se invocan por `_handler`, que no está tipado: la forma del
 * sobre se declara acá, con lo que estas pruebas realmente leen de él.
 */
type SobreDelDia = {
  natal: Record<string, AnalysisResult>;
  today: Record<string, AnalysisResult>;
  moment: Record<string, AnalysisResult>;
};

const leerDia = (
  escenario: Escenario,
  localDate: string,
  timezone: string,
  db?: any,
): Promise<SobreDelDia> =>
  (getForDate as any)._handler(escenario.ctx(db), { localDate, timezone });

const leerNatal = (escenario: Escenario, db?: any): Promise<Record<string, AnalysisResult>> =>
  (getNatalBase as any)._handler(escenario.ctx(db), {});

const leerRefresco = (
  escenario: Escenario,
  localDate: string,
  timezone: string,
  db?: any,
): Promise<{ snapshots: AnalysisResult[] }> =>
  (getRefreshState as any)._handler(escenario.ctx(db), {
    tokenIdentifier: TOKEN,
    localDate,
    timezone,
  });

/**
 * Siembra un caché que el backend reconoce COMO PROPIO.
 *
 * Los `inputHash` no se recalculan acá: se le preguntan al propio handler, que
 * los publica en cada sobre incluso cuando no hay dato. Así la prueba no
 * duplica la identidad de caché —que es justo lo que no hay que copiar— y sigue
 * siendo válida el día que esa identidad cambie. El mandala va en una segunda
 * pasada porque su hash depende de los sobres que las otras capas publiquen.
 */
async function sembrarCacheRealista(escenario: Escenario, localDate: string, timezone: string) {
  const observedAt = 1_700_000_000_000;
  const primero = await leerDia(escenario, localDate, timezone);
  const conDato: Partial<Record<AnalysisId, AnalysisResult["data"]>> = {
    "ORB-TRN-002": datosDeRanking(observedAt),
    "ORB-TRN-001": datosDeArco(observedAt),
  };
  const sobresBase: Array<{ analysisId: AnalysisId; inputHash: string }> = [
    { analysisId: "ORB-LUN-001", inputHash: primero.natal.lunarType.inputHash },
    { analysisId: "ORB-NAT-001", inputHash: primero.natal.elementMap.inputHash },
    { analysisId: "ORB-REL-001", inputHash: primero.natal.relationshipPattern.inputHash },
    { analysisId: "ORB-CYC-002", inputHash: primero.moment.progressedLunation.inputHash },
    { analysisId: "ORB-TRN-002", inputHash: primero.today.transitRanking.inputHash },
    { analysisId: "ORB-TRN-001", inputHash: primero.today.transitArc.inputHash },
    { analysisId: "ORB-LUN-003", inputHash: primero.today.moonOnChart.inputHash },
    { analysisId: "ORB-LUN-002", inputHash: primero.today.cumpleluna.inputHash },
  ];
  for (const { analysisId, inputHash } of sobresBase) {
    escenario.base.seed(
      "analysisSnapshotsV492",
      filaDeSnapshot({
        userId: escenario.userId,
        result: sobre({
          analysisId,
          inputHash,
          observedAt,
          data: conDato[analysisId] ?? null,
          status: conDato[analysisId] ? "ready" : "unavailable",
          precision: conDato[analysisId] ? "exact" : "not_applicable",
        }),
        localDate,
        timezone,
        updatedAt: observedAt,
      }),
    );
  }
  const segundo = await leerDia(escenario, localDate, timezone);
  escenario.base.seed(
    "analysisSnapshotsV492",
    filaDeSnapshot({
      userId: escenario.userId,
      result: sobre({
        analysisId: "ORB-CYC-007",
        inputHash: segundo.moment.temporalMandala.inputHash,
        observedAt,
        status: "unavailable",
        precision: "not_applicable",
      }),
      localDate,
      timezone,
      updatedAt: observedAt,
    }),
  );
  escenario.base.reiniciarLecturas();
}

/** Días y zonas que NO son los que la pantalla pide: el ruido que hoy se paga. */
function sembrarRuido(escenario: Escenario, args: { dias: number; zonas: readonly string[] }) {
  const observedAt = 1_600_000_000_000;
  let sembradas = 0;
  for (let dia = 0; dia < args.dias; dia += 1) {
    const fecha = `2026-0${1 + (dia % 3)}-${String(1 + (dia % 28)).padStart(2, "0")}`;
    if (fecha === HOY || fecha === AYER) continue;
    for (const zona of args.zonas) {
      for (const analysisId of DIARIOS) {
        escenario.base.seed(
          "analysisSnapshotsV492",
          filaDeSnapshot({
            userId: escenario.userId,
            result: sobre({
              analysisId,
              inputHash: `ruido-${dia}-${zona}-${analysisId}`,
              observedAt,
              data: analysisId === "ORB-TRN-002" ? datosDeRanking(observedAt) : null,
              status: analysisId === "ORB-TRN-002" ? "ready" : "unavailable",
            }),
            localDate: fecha,
            timezone: zona,
            updatedAt: observedAt,
          }),
        );
        sembradas += 1;
      }
    }
  }
  escenario.base.reiniciarLecturas();
  return sembradas;
}

/**
 * El instante en el que corren las comparaciones.
 *
 * Los sobres llevan `observedAt: Date.now()`, así que dos corridas separadas
 * por un milisegundo no son comparables aunque lean exactamente lo mismo. El
 * reloj no es parte del alcance de lectura: se fija para que la única
 * diferencia posible entre ANTES y DESPUÉS sean las filas leídas.
 */
const INSTANTE = Date.parse("2026-09-18T15:00:00.000Z");

async function enElInstante<T>(instante: number, correr: () => Promise<T>): Promise<T> {
  const reloj = Date.now;
  Date.now = () => instante;
  try {
    return await correr();
  } finally {
    Date.now = reloj;
  }
}

/** Corre un handler dos veces: con la lectura amplia de antes y con la de ahora. */
async function medir<T>(escenario: Escenario, correr: (db?: any) => Promise<T>) {
  escenario.base.reiniciarLecturas();
  const respuestaAntes = await enElInstante(INSTANTE, () =>
    correr(adaptadorDeLecturaAmplia(escenario.base)),
  );
  const antes = sumar(escenario.base.lecturas(), "analysisSnapshotsV492");
  escenario.base.reiniciarLecturas();
  const respuestaDespues = await enElInstante(INSTANTE, () => correr());
  const despues = sumar(escenario.base.lecturas(), "analysisSnapshotsV492");
  escenario.base.reiniciarLecturas();
  return { antes, despues, respuestaAntes, respuestaDespues };
}

const reporte: string[] = [];

function anotar(titulo: string, medicion: { antes: Costo; despues: Costo }) {
  const ahorro = (valor: number, referencia: number) =>
    referencia === 0 ? "—" : `-${(100 * (1 - valor / referencia)).toFixed(1)}%`;
  reporte.push(
    [
      titulo.padEnd(46),
      `docs ${String(medicion.antes.documentos).padStart(5)} → ${String(medicion.despues.documentos).padStart(4)}`,
      `(${ahorro(medicion.despues.documentos, medicion.antes.documentos).padStart(7)})`,
      `bytes ${String(medicion.antes.bytes).padStart(7)} → ${String(medicion.despues.bytes).padStart(6)}`,
      `(${ahorro(medicion.despues.bytes, medicion.antes.bytes).padStart(7)})`,
    ].join("  "),
  );
}

test.after(() => {
  if (reporte.length === 0) return;
  console.log(
    [
      "",
      "─".repeat(110),
      "CORE-431 — alcance de lectura de analysisSnapshotsV492 (medición LOCAL y sintética,",
      "no son los bytes que factura Convex). Se cuentan los documentos que el rango de índice",
      "materializa ANTES de cualquier filtro de aplicación, y su tamaño serializado.",
      "─".repeat(110),
      ...reporte,
      "─".repeat(110),
      "",
    ].join("\n"),
  );
});

// ---------------------------------------------------------------------------
// 1. Semántica: el alcance nuevo trae exactamente lo que traía el filtro viejo
// ---------------------------------------------------------------------------

/**
 * El corpus adversario.
 *
 * Cada fila está para romper una simplificación distinta: la fila legacy sin
 * fecha ni zona, la fila del día sin zona, el viaje (mismo día, otra zona), la
 * fecha ajena, la fila de OTRA persona con la misma fecha y zona, el empate de
 * `updatedAt`, el empate TOTAL de tiempos y la fila sin fecha pero CON zona
 * ajena, que el filtro anterior aceptaba igual.
 *
 * Cada fila lleva su propio `inputHash`: es lo que la distingue en el sobre
 * publicado, que no expone `_id` ni `etiqueta`. Sin eso no se podría mirar el
 * ORDEN que produce el handler.
 */
function corpusAdversario(base: BaseInstrumentada, userId: string, otroUserId: string) {
  const fila = (
    campos: Record<string, unknown>,
    forzar?: { _id?: string; _creationTime?: number },
  ) =>
    base.seed("analysisSnapshotsV492", {
      userId,
      analysisId: "ORB-TRN-002",
      cacheKey: `k-${String(campos.etiqueta)}`,
      methodVersion: "m",
      inputHash: `h-${String(campos.etiqueta)}`,
      status: "ready",
      precision: "exact",
      observedAt: 1,
      validUntil: null,
      data: null,
      missingInputs: [],
      limitations: [],
      elaboration: "direct",
      sourceRefs: [],
      createdAt: 1,
      updatedAt: 1,
      ...campos,
    }, forzar);
  return {
    legacySinFechaNiZona: fila({ etiqueta: "legacy", updatedAt: 10 }),
    sinFechaConZonaAjena: fila({ etiqueta: "sin-fecha-zona-ajena", timezone: ZONA_AJENA, updatedAt: 40 }),
    natal: fila({ etiqueta: "natal", analysisId: "ORB-LUN-001", updatedAt: 30 }),
    diaSinZona: fila({ etiqueta: "dia-sin-zona", localDate: HOY, updatedAt: 20 }),
    diaEnZona: fila({ etiqueta: "dia-en-zona", localDate: HOY, timezone: ZONA, updatedAt: 50 }),
    diaEnZonaAjena: fila({ etiqueta: "viaje", localDate: HOY, timezone: ZONA_AJENA, updatedAt: 60 }),
    fechaAjena: fila({ etiqueta: "ayer", localDate: AYER, timezone: ZONA, updatedAt: 70 }),
    empateA: fila({ etiqueta: "empate-a", localDate: HOY, timezone: ZONA, updatedAt: 50 }),
    empateB: fila({ etiqueta: "empate-b", updatedAt: 50 }),
    // El empate TOTAL: dos filas del mismo análisis, en franjas distintas,
    // creadas en el mismo instante y escritas en el mismo instante. Lo único
    // que las ordena es el `_id`, que es como termina el orden de un índice de
    // Convex. La del `_id` menor se siembra SEGUNDA y cae en la ÚLTIMA franja
    // que concatena el alcance: si la selección se resolviera por el orden de
    // siembra o por el de concatenación, ganaría la otra.
    empateTotalPierde: fila(
      { etiqueta: "empate-total-pierde", updatedAt: 80 },
      { _id: "analysisSnapshotsV492:empate-total-b", _creationTime: 800 },
    ),
    empateTotalGana: fila(
      { etiqueta: "empate-total-gana", localDate: HOY, timezone: ZONA, updatedAt: 80 },
      { _id: "analysisSnapshotsV492:empate-total-a", _creationTime: 800 },
    ),
    ajena: base.seed("analysisSnapshotsV492", {
      userId: otroUserId,
      analysisId: "ORB-TRN-002",
      cacheKey: "k-ajena",
      localDate: HOY,
      timezone: ZONA,
      methodVersion: "m",
      inputHash: "h-de-otra-persona",
      status: "ready",
      precision: "exact",
      observedAt: 1,
      validUntil: null,
      data: null,
      missingInputs: [],
      limitations: [],
      elaboration: "direct",
      sourceRefs: [],
      createdAt: 1,
      updatedAt: 999,
      etiqueta: "de-otra-persona",
    }),
  };
}

/**
 * Lo que un handler MATERIALIZÓ de `analysisSnapshotsV492`, en el orden en el
 * que los rangos lo fueron leyendo. Sale del registro de la base instrumentada,
 * así que describe el camino real y no una reconstrucción.
 *
 * Sirve para lo que es un CONJUNTO: qué filas entraron en la lectura, cuáles no
 * y cuánto costaron. NO sirve para afirmar qué candidata elige producción —el
 * orden de acá es el de las franjas concatenadas, no el de selección—, y por
 * eso esta función ya no reordena con el comparador esperado: hacerlo tapaba el
 * orden productivo con el de la prueba. El orden que publica producción se mira
 * donde producción lo publica.
 */
function materializadas(escenario: Escenario) {
  const porId = new Map(
    escenario.base.filas("analysisSnapshotsV492").map((fila) => [fila._id, fila]),
  );
  const ids = new Set(
    escenario.base
      .lecturas()
      .filter((lectura) => lectura.tabla === "analysisSnapshotsV492")
      .flatMap((lectura) => lectura.filas),
  );
  return [...ids].map((id) => porId.get(id)!);
}

test("getForDate materializa exactamente lo que seleccionaba la lectura amplia", async () => {
  const escenario = cuenta();
  const otroUserId = escenario.base.seed("users", { tokenIdentifier: "otra-persona" });
  corpusAdversario(escenario.base, escenario.userId, otroUserId);

  escenario.base.reiniciarLecturas();
  await leerDia(escenario, HOY, ZONA);
  const leido = materializadas(escenario);

  escenario.base.reiniciarLecturas();
  const esperado = await lecturaAmplia(escenario.base.db, escenario.userId, {
    localDate: HOY,
    timezone: ZONA,
  });

  // Conjunto, no orden: lo que se compara acá es QUÉ filas entraron en la
  // lectura. El orden de selección lo miran las pruebas de la sección 1.b,
  // sobre lo que producción publica.
  assert.deepEqual(
    new Set(leido.map((fila) => fila._id)),
    new Set(esperado.map((fila) => fila._id)),
    "el handler tiene que materializar exactamente las filas que dejaba pasar el filtro anterior",
  );
  assert.deepEqual(
    new Set(leido.map((fila) => fila.etiqueta)),
    new Set([
      "legacy",
      "sin-fecha-zona-ajena",
      "natal",
      "dia-sin-zona",
      "dia-en-zona",
      "empate-a",
      "empate-b",
      "empate-total-gana",
      "empate-total-pierde",
    ]),
  );
  assert.equal(leido.some((fila) => fila.etiqueta === "viaje"), false, "otra zona del mismo día no entra");
  assert.equal(leido.some((fila) => fila.etiqueta === "ayer"), false, "otra fecha no entra");
  assert.equal(
    leido.some((fila) => fila.etiqueta === "de-otra-persona"),
    false,
    "una fila de otra persona no entra por ningún rango",
  );
});

test("getRefreshState materializa exactamente el mismo alcance que getForDate", async () => {
  const escenario = cuenta();
  const otroUserId = escenario.base.seed("users", { tokenIdentifier: "otra-persona" });
  corpusAdversario(escenario.base, escenario.userId, otroUserId);

  escenario.base.reiniciarLecturas();
  await leerRefresco(escenario, HOY, ZONA);
  const leido = materializadas(escenario);

  escenario.base.reiniciarLecturas();
  const esperado = await lecturaAmplia(escenario.base.db, escenario.userId, {
    localDate: HOY,
    timezone: ZONA,
  });
  assert.deepEqual(
    new Set(leido.map((fila) => fila._id)),
    new Set(esperado.map((fila) => fila._id)),
  );
});

test("getNatalBase materializa toda fila que la lectura amplia podía elegir para el natal", async () => {
  const escenario = cuenta();
  const otroUserId = escenario.base.seed("users", { tokenIdentifier: "otra-persona" });
  corpusAdversario(escenario.base, escenario.userId, otroUserId);
  // Una fila natal CON fecha: la escribe `persistRefresh` sin fecha, pero una
  // fila legacy podría tenerla y la lectura anterior —que no filtraba nada—
  // la veía. El alcance nuevo por análisis también.
  escenario.base.seed("analysisSnapshotsV492", {
    userId: escenario.userId,
    analysisId: "ORB-REL-001",
    cacheKey: "natal-legacy-con-fecha",
    localDate: "2024-01-01",
    timezone: ZONA_AJENA,
    methodVersion: "m",
    inputHash: "h",
    status: "ready",
    precision: "exact",
    observedAt: 1,
    validUntil: null,
    data: null,
    missingInputs: [],
    limitations: [],
    elaboration: "direct",
    sourceRefs: [],
    createdAt: 1,
    updatedAt: 1,
    etiqueta: "natal-legacy-con-fecha",
  });

  escenario.base.reiniciarLecturas();
  await leerNatal(escenario);
  const leido = materializadas(escenario);

  escenario.base.reiniciarLecturas();
  const candidatasDeAntes = (
    await escenario.base.db
      .query("analysisSnapshotsV492")
      .withIndex("by_user", (q: any) => q.eq("userId", escenario.userId))
      .collect()
  ).filter((fila: Fila) => ["ORB-LUN-001", "ORB-NAT-001", "ORB-REL-001"].includes(fila.analysisId));

  assert.deepEqual(
    new Set(leido.map((fila) => fila._id)),
    new Set(candidatasDeAntes.map((fila: Fila) => fila._id)),
    "ninguna fila que el natal podía elegir se quedó afuera, y ninguna ajena entró",
  );
  assert.ok(
    leido.some((fila) => fila.etiqueta === "natal-legacy-con-fecha"),
    "una fila natal legacy con fecha sigue siendo candidata",
  );
});

test("las tres franjas del alcance son disjuntas: ninguna fila se lee dos veces", async () => {
  const base = baseInstrumentada();
  const userId = base.seed("users", { tokenIdentifier: TOKEN });
  const otroUserId = base.seed("users", { tokenIdentifier: "otro" });
  corpusAdversario(base, userId, otroUserId);
  const franja = (igualdades: (q: any) => any) =>
    base.db
      .query("analysisSnapshotsV492")
      .withIndex("by_user_local_date_timezone", igualdades)
      .collect() as Promise<Fila[]>;
  const ids = [
    ...(await franja((q: any) => q.eq("userId", userId).eq("localDate", undefined))),
    ...(await franja((q: any) => q.eq("userId", userId).eq("localDate", HOY).eq("timezone", undefined))),
    ...(await franja((q: any) => q.eq("userId", userId).eq("localDate", HOY).eq("timezone", ZONA))),
  ].map((fila) => fila._id);
  assert.equal(new Set(ids).size, ids.length);
});

// ---------------------------------------------------------------------------
// 1.b El ORDEN de selección, mirado donde producción lo publica
// ---------------------------------------------------------------------------

/**
 * `getRefreshState` devuelve la lista de sobres YA ordenada por el comparador
 * de producción: es la única salida pública donde ese orden se puede observar
 * sin reconstruirlo. El oráculo es `lecturaAmplia`, la copia literal del código
 * anterior, que ordena con un `sort` estable sobre el orden del índice `by_user`
 * —creación y, si empata, `_id`—. Si se quitara el `sort` de
 * `scopedAnalysisSnapshots`, o cualquiera de sus dos desempates, esta prueba
 * falla.
 */
test("getRefreshState publica las filas en el orden de selección de la lectura anterior", async () => {
  const escenario = cuenta();
  const otroUserId = escenario.base.seed("users", { tokenIdentifier: "otra-persona" });
  corpusAdversario(escenario.base, escenario.userId, otroUserId);

  escenario.base.reiniciarLecturas();
  const publicadas = (await leerRefresco(escenario, HOY, ZONA)).snapshots;
  const enOrdenDeLectura = materializadas(escenario);

  escenario.base.reiniciarLecturas();
  const esperado = await lecturaAmplia(escenario.base.db, escenario.userId, {
    localDate: HOY,
    timezone: ZONA,
  });

  assert.deepEqual(
    publicadas.map((sobre) => sobre.inputHash),
    esperado.map((fila) => fila.inputHash),
    "el orden que publica producción tiene que ser el que elegía la lectura anterior",
  );
  // Y no es el orden en el que las franjas las trajeron: si lo fuera, la
  // comparación de arriba no distinguiría entre ordenar y no ordenar.
  assert.notDeepEqual(
    publicadas.map((sobre) => sobre.inputHash),
    enOrdenDeLectura.map((fila) => fila.inputHash),
    "el orden de lectura y el de selección tienen que ser distintos en este corpus",
  );
  const posicion = (inputHash: string) =>
    publicadas.findIndex((sobre) => sobre.inputHash === inputHash);
  assert.ok(posicion("h-empate-total-gana") >= 0 && posicion("h-empate-total-pierde") >= 0);
  assert.ok(
    posicion("h-empate-total-gana") < posicion("h-empate-total-pierde"),
    "con `updatedAt` y `_creationTime` empatados manda el `_id`, como en el índice",
  );
});

/**
 * El empate total, mirado en el DATO que sirve `getForDate`.
 *
 * Dos filas del mismo análisis y el mismo hash —una sin fecha, la otra del día
 * en zona— escritas en el mismo instante y creadas en el mismo instante. Sólo
 * una de las dos se publica, y cuál es no puede depender de en qué orden
 * `scopedAnalysisSnapshots` concatenó las franjas. El oráculo se calcula con
 * `lecturaAmplia` y no se escribe a mano: lo que se afirma es que producción
 * sirve el MISMO candidato que servía el código anterior.
 */
test("ante un empate total de tiempos, getForDate sirve el mismo candidato que la lectura anterior", async () => {
  const escenario = cuenta();
  const observedAt = 1_700_000_000_000;
  const primero = await leerDia(escenario, HOY, ZONA);
  const inputHash = primero.today.transitRanking.inputHash;
  const candidata = (
    resumen: string,
    legacy: "sin_fecha_ni_zona" | undefined,
    forzar: { _id: string; _creationTime: number },
  ) =>
    escenario.base.seed(
      "analysisSnapshotsV492",
      filaDeSnapshot({
        userId: escenario.userId,
        result: sobre({
          analysisId: "ORB-TRN-002",
          inputHash,
          observedAt,
          data: { ...datosDeRanking(observedAt), summary: resumen },
        }),
        localDate: HOY,
        timezone: ZONA,
        updatedAt: observedAt,
        legacy,
      }),
      forzar,
    );
  // La del `_id` MENOR se siembra segunda y cae en la última franja del
  // alcance: ni el orden de siembra ni el de concatenación la eligen.
  candidata("gana la fila sin fecha", "sin_fecha_ni_zona", {
    _id: "analysisSnapshotsV492:empate-del-dato-b",
    _creationTime: 900,
  });
  candidata("gana la fila del día", undefined, {
    _id: "analysisSnapshotsV492:empate-del-dato-a",
    _creationTime: 900,
  });

  const deAntes = (
    await lecturaAmplia(escenario.base.db, escenario.userId, { localDate: HOY, timezone: ZONA })
  ).find((fila) => fila.analysisId === "ORB-TRN-002" && fila.inputHash === inputHash);
  assert.ok(deAntes, "la lectura anterior elegía una de las dos");
  assert.equal(
    deAntes.data.summary,
    "gana la fila del día",
    "el orden del índice termina en el `_id`: la candidata del `_id` menor es la que elegía el código anterior",
  );

  const leido = await leerDia(escenario, HOY, ZONA);
  assert.equal(
    rankingPublicado(leido.today.transitRanking)?.summary,
    deAntes.data.summary,
    "producción tiene que servir el mismo candidato que servía la lectura anterior",
  );
});

// ---------------------------------------------------------------------------
// 2. Medición ANTES/DESPUÉS sobre los handlers reales
// ---------------------------------------------------------------------------

test("getForDate conserva el sobre y deja de leer los análisis de otras fechas", async () => {
  const escenario = cuenta();
  await sembrarCacheRealista(escenario, HOY, ZONA);
  const ruido = sembrarRuido(escenario, { dias: 40, zonas: [ZONA, ZONA_AJENA] });
  assert.ok(ruido >= 300, "el escenario tiene que tener ruido de verdad");

  const medicion = await medir(escenario, (db) => leerDia(escenario, HOY, ZONA, db));
  anotar("getForDate · cuenta con muchas fechas ajenas", medicion);

  assert.deepEqual(medicion.respuestaDespues, medicion.respuestaAntes);
  assert.equal(medicion.respuestaDespues.today.transitRanking.status, "ready");
  assert.equal(arcoPublicado(medicion.respuestaDespues.today.transitArc)?.arcId, RANKING_TOP.arcId);
  assert.ok(
    medicion.despues.documentos < medicion.antes.documentos / 10,
    `la lectura tenía que bajar mucho: ${medicion.antes.documentos} → ${medicion.despues.documentos}`,
  );
  assert.ok(medicion.despues.bytes < medicion.antes.bytes / 10);
});

test("getNatalBase conserva el paquete natal leyendo sólo sus tres análisis", async () => {
  const escenario = cuenta();
  await sembrarCacheRealista(escenario, HOY, ZONA);
  sembrarRuido(escenario, { dias: 40, zonas: [ZONA, ZONA_AJENA] });

  const medicion = await medir(escenario, (db) => leerNatal(escenario, db));
  anotar("getNatalBase · cuenta con muchas fechas ajenas", medicion);

  // Acá la paridad NO es estructural: el adaptador le pasa al handler TODAS las
  // filas de la persona y el camino nuevo sólo tres familias de análisis.
  assert.deepEqual(medicion.respuestaDespues, medicion.respuestaAntes);
  assert.equal(medicion.despues.documentos, 3, "tres filas natales, una por análisis");
  assert.ok(medicion.antes.documentos > 200);
});

test("getRefreshState conserva el estado del refresco con el alcance acotado", async () => {
  const escenario = cuenta();
  await sembrarCacheRealista(escenario, HOY, ZONA);
  sembrarRuido(escenario, { dias: 40, zonas: [ZONA, ZONA_AJENA] });

  const medicion = await medir(escenario, (db) => leerRefresco(escenario, HOY, ZONA, db));
  anotar("getRefreshState · cuenta con muchas fechas ajenas", medicion);

  assert.deepEqual(medicion.respuestaDespues, medicion.respuestaAntes);
  assert.equal(medicion.respuestaDespues.snapshots.length, 9);
  assert.ok(medicion.despues.documentos < medicion.antes.documentos / 10);
});

// ---------------------------------------------------------------------------
// 3. Crecimiento: agregar fechas y zonas ajenas no mueve la lectura
// ---------------------------------------------------------------------------

test("agregar fechas y zonas ajenas no cambia una sola lectura del alcance", async () => {
  const construir = async (ruido: { dias: number; zonas: readonly string[] }) => {
    const escenario = cuenta();
    await sembrarCacheRealista(escenario, HOY, ZONA);
    const sembradas = ruido.dias > 0 ? sembrarRuido(escenario, ruido) : 0;
    return { escenario, sembradas };
  };

  const chico = await construir({ dias: 0, zonas: [] });
  const grande = await construir({ dias: 120, zonas: [ZONA, ZONA_AJENA, "Asia/Tokyo"] });
  assert.ok(grande.sembradas > 1_000, `el escenario grande tiene ${grande.sembradas} filas ajenas`);

  const handlers: Array<[string, (escenario: Escenario, db?: any) => Promise<unknown>]> = [
    ["getForDate", (escenario, db) => leerDia(escenario, HOY, ZONA, db)],
    ["getNatalBase", (escenario, db) => leerNatal(escenario, db)],
    ["getRefreshState", (escenario, db) => leerRefresco(escenario, HOY, ZONA, db)],
  ];
  for (const [titulo, correr] of handlers) {
    const medicionChica = await medir(chico.escenario, (db) => correr(chico.escenario, db));
    const medicionGrande = await medir(grande.escenario, (db) => correr(grande.escenario, db));
    anotar(`${titulo} · sin ruido`, medicionChica);
    anotar(`${titulo} · +${grande.sembradas} filas ajenas`, medicionGrande);

    assert.deepEqual(
      medicionGrande.despues,
      medicionChica.despues,
      `${titulo}: el alcance nuevo tiene que ser constante frente a fechas y zonas ajenas`,
    );
    assert.ok(
      medicionGrande.antes.documentos > medicionChica.antes.documentos + 1_000,
      `${titulo}: la lectura anterior sí crecía con el ruido`,
    );
    assert.deepEqual(
      medicionGrande.respuestaDespues,
      medicionGrande.respuestaAntes,
      `${titulo}: la respuesta no puede cambiar`,
    );
  }
});

// ---------------------------------------------------------------------------
// 4. Semántica preservada, caso por caso
// ---------------------------------------------------------------------------

test("una fila legacy sin fecha ni zona sigue sirviendo de dato guardado", async () => {
  const escenario = cuenta();
  const observedAt = 1_700_000_000_000;
  const primero = await leerDia(escenario, HOY, ZONA);
  escenario.base.seed(
    "analysisSnapshotsV492",
    filaDeSnapshot({
      userId: escenario.userId,
      result: sobre({
        analysisId: "ORB-TRN-002",
        inputHash: primero.today.transitRanking.inputHash,
        observedAt,
        data: datosDeRanking(observedAt),
      }),
      localDate: HOY,
      timezone: ZONA,
      updatedAt: observedAt,
      legacy: "sin_fecha_ni_zona",
    }),
  );
  const conLegacy = await leerDia(escenario, HOY, ZONA);
  assert.equal(conLegacy.today.transitRanking.status, "ready");
  assert.equal(conLegacy.today.transitRanking.data?.kind, "transit_ranking");
});

test("una fila del día que nunca declaró zona sigue entrando en el alcance", async () => {
  const escenario = cuenta();
  const observedAt = 1_700_000_000_000;
  const primero = await leerDia(escenario, HOY, ZONA);
  escenario.base.seed(
    "analysisSnapshotsV492",
    filaDeSnapshot({
      userId: escenario.userId,
      result: sobre({
        analysisId: "ORB-TRN-002",
        inputHash: primero.today.transitRanking.inputHash,
        observedAt,
        data: datosDeRanking(observedAt),
      }),
      localDate: HOY,
      timezone: ZONA,
      updatedAt: observedAt,
      legacy: "sin_zona",
    }),
  );
  const leido = await leerDia(escenario, HOY, ZONA);
  assert.equal(leido.today.transitRanking.status, "ready");
  // Y la misma fila NO aparece cuando se pide otro día.
  const otroDia = await leerDia(escenario, AYER, ZONA);
  assert.equal(otroDia.today.transitRanking.status, "unavailable");
});

test("el dato de otra zona del mismo día no se sirve como si fuera el de acá", async () => {
  const escenario = cuenta();
  const observedAt = 1_700_000_000_000;
  const primero = await leerDia(escenario, HOY, ZONA);
  escenario.base.seed(
    "analysisSnapshotsV492",
    filaDeSnapshot({
      userId: escenario.userId,
      result: sobre({
        analysisId: "ORB-TRN-002",
        inputHash: primero.today.transitRanking.inputHash,
        observedAt,
        data: datosDeRanking(observedAt),
      }),
      localDate: HOY,
      timezone: ZONA_AJENA,
      updatedAt: observedAt,
    }),
  );
  const leido = await leerDia(escenario, HOY, ZONA);
  assert.equal(leido.today.transitRanking.status, "unavailable");
  assert.equal(leido.today.transitRanking.data, null);
});

test("un caché negativo vencido no se reutiliza, y uno vigente sí", async () => {
  const escenario = cuenta();
  const ahora = Date.now();
  const primero = await leerDia(escenario, HOY, ZONA);
  const sembrarError = (validUntil: number) =>
    escenario.base.seed(
      "analysisSnapshotsV492",
      filaDeSnapshot({
        userId: escenario.userId,
        result: sobre({
          analysisId: "ORB-CYC-002",
          inputHash: primero.moment.progressedLunation.inputHash,
          status: "error",
          precision: "not_applicable",
          observedAt: ahora - 2 * HOUR_MS,
          validUntil,
        }),
        localDate: HOY,
        timezone: ZONA,
        updatedAt: ahora - 2 * HOUR_MS,
      }),
    );

  sembrarError(ahora - HOUR_MS);
  const vencido = await leerDia(escenario, HOY, ZONA);
  assert.notEqual(vencido.moment.progressedLunation.status, "error");

  const escenarioVigente = cuenta();
  const base = await leerDia(escenarioVigente, HOY, ZONA);
  escenarioVigente.base.seed(
    "analysisSnapshotsV492",
    filaDeSnapshot({
      userId: escenarioVigente.userId,
      result: sobre({
        analysisId: "ORB-CYC-002",
        inputHash: base.moment.progressedLunation.inputHash,
        status: "error",
        precision: "not_applicable",
        observedAt: ahora,
        validUntil: ahora + HOUR_MS,
      }),
      localDate: HOY,
      timezone: ZONA,
      updatedAt: ahora,
    }),
  );
  const vigente = await leerDia(escenarioVigente, HOY, ZONA);
  assert.equal(vigente.moment.progressedLunation.status, "error");
});

test("dos arcos del mismo día siguen siendo dos filas, y sólo el principal se publica", async () => {
  const escenario = cuenta();
  await sembrarCacheRealista(escenario, HOY, ZONA);
  const observedAt = 1_700_000_000_000;
  // Un arco secundario del mismo día: otro `arcId`, otro hash, la misma fecha.
  escenario.base.seed(
    "analysisSnapshotsV492",
    filaDeSnapshot({
      userId: escenario.userId,
      result: sobre({
        analysisId: "ORB-TRN-001",
        inputHash: "arco-secundario-del-mismo-dia",
        observedAt: observedAt + HOUR_MS,
        data: { ...datosDeArco(observedAt), arcId: "sun-square-venus", transitPlanet: "sun", natalPoint: "venus", aspect: "square" },
      }),
      localDate: HOY,
      timezone: ZONA,
      updatedAt: observedAt + HOUR_MS,
    }),
  );
  const leido = await leerDia(escenario, HOY, ZONA);
  assert.equal(
    arcoPublicado(leido.today.transitArc)?.arcId,
    RANKING_TOP.arcId,
    "el arco publicado sigue siendo el del contacto que encabeza el ranking",
  );
  const filas = escenario.base
    .filas("analysisSnapshotsV492")
    .filter((fila) => fila.analysisId === "ORB-TRN-001" && fila.localDate === HOY);
  assert.equal(filas.length, 2, "los dos arcos conviven como dos filas distintas");
});

test("el natal se invalida al cambiar los datos de nacimiento, no al acumular días", async () => {
  const escenario = cuenta();
  await sembrarCacheRealista(escenario, HOY, ZONA);
  const conCache = await leerNatal(escenario);
  assert.ok(conCache, "hay paquete natal");

  // Otra fila natal, con el hash de una carta anterior: no puede ganar.
  escenario.base.seed(
    "analysisSnapshotsV492",
    filaDeSnapshot({
      userId: escenario.userId,
      result: sobre({
        analysisId: "ORB-LUN-001",
        inputHash: "hash-de-otra-carta",
        observedAt: 2_000_000_000_000,
      }),
      localDate: HOY,
      timezone: ZONA,
      updatedAt: 2_000_000_000_000,
    }),
  );
  const despues = await leerNatal(escenario);
  assert.deepEqual(despues, conCache, "una fila con otro hash natal no cambia el paquete");
});

test("el paquete natal no publica ningún análisis fuera de los tres que se leen", async () => {
  const escenario = cuenta();
  await sembrarCacheRealista(escenario, HOY, ZONA);
  const natal = await leerNatal(escenario);
  assert.deepEqual(
    Object.values(natal as Record<string, AnalysisResult>)
      .map((sobre) => sobre.analysisId)
      .sort(),
    ["ORB-LUN-001", "ORB-NAT-001", "ORB-REL-001"],
    "si el paquete natal suma un análisis, `NATAL_BUNDLE_ANALYSIS_IDS` tiene que sumarlo también",
  );
});

test("las filas de otra persona nunca se materializan", async () => {
  const escenario = cuenta();
  await sembrarCacheRealista(escenario, HOY, ZONA);
  const otroUserId = escenario.base.seed("users", { tokenIdentifier: "otra-persona" });
  for (let indice = 0; indice < 200; indice += 1) {
    escenario.base.seed("analysisSnapshotsV492", {
      userId: otroUserId,
      analysisId: "ORB-TRN-002",
      cacheKey: `ajena-${indice}`,
      localDate: HOY,
      timezone: ZONA,
      methodVersion: "m",
      inputHash: "h",
      status: "ready",
      precision: "exact",
      observedAt: 1,
      validUntil: null,
      data: null,
      missingInputs: [],
      limitations: [],
      elaboration: "direct",
      sourceRefs: [],
      createdAt: 1,
      updatedAt: 1,
    });
  }
  escenario.base.reiniciarLecturas();
  await leerDia(escenario, HOY, ZONA);
  await leerNatal(escenario);
  await leerRefresco(escenario, HOY, ZONA);
  const leidas = escenario.base.lecturas();
  assert.ok(leidas.length > 0);
  assert.equal(
    sumar(leidas, "analysisSnapshotsV492").documentos,
    // Sólo las filas propias del alcance, ninguna de las 200 ajenas.
    9 + 3 + 9,
  );
});

// ---------------------------------------------------------------------------
// 5. Suscripciones: hoy y ayer, que es lo que monta `LayersProvider`
// ---------------------------------------------------------------------------

test("las dos suscripciones del proveedor leen su propio alcance y nada más", async () => {
  const escenario = cuenta();
  await sembrarCacheRealista(escenario, HOY, ZONA);
  await sembrarCacheRealista(escenario, AYER, ZONA);
  sembrarRuido(escenario, { dias: 60, zonas: [ZONA, ZONA_AJENA] });

  const hoy = await medir(escenario, (db) => leerDia(escenario, HOY, ZONA, db));
  const ayer = await medir(escenario, (db) => leerDia(escenario, AYER, ZONA, db));
  anotar("suscripción hoy (LayersProvider)", hoy);
  anotar("suscripción ayer (LayersProvider)", ayer);
  anotar("las dos juntas", {
    antes: {
      documentos: hoy.antes.documentos + ayer.antes.documentos,
      bytes: hoy.antes.bytes + ayer.antes.bytes,
    },
    despues: {
      documentos: hoy.despues.documentos + ayer.despues.documentos,
      bytes: hoy.despues.bytes + ayer.despues.bytes,
    },
  });

  assert.deepEqual(hoy.respuestaDespues, hoy.respuestaAntes);
  assert.deepEqual(ayer.respuestaDespues, ayer.respuestaAntes);
  assert.notDeepEqual(
    hoy.respuestaDespues.today.transitRanking.inputHash,
    ayer.respuestaDespues.today.transitRanking.inputHash,
    "hoy y ayer siguen siendo dos alcances distintos",
  );
  // El alcance de un día incluye las filas sin fecha, que son las mismas para
  // los dos: por eso la suma no es el doble de una, pero tampoco la tabla.
  assert.ok(hoy.despues.documentos + ayer.despues.documentos < hoy.antes.documentos / 5);
});

/**
 * Qué se puede AFIRMAR sobre invalidaciones, y qué no.
 *
 * Convex vuelve a correr una query cuando cambia algún documento de su conjunto
 * leído. Esta prueba no afirma nada sobre ese motor —un doble en memoria no
 * puede demostrarlo—: afirma el hecho comprobable del que ese comportamiento
 * depende, que es QUÉ filas entran en el conjunto leído. Antes entraba toda la
 * tabla de la persona, así que escribir el refresco de ayer tocaba el conjunto
 * leído de hoy. Ahora no entra ninguna fila de otra fecha.
 *
 * El acoplamiento que QUEDA, y que esta prueba deja escrito: las filas sin
 * fecha —el natal y `ORB-CYC-002`— las comparten todos los días, así que
 * reescribirlas sí sigue tocando el conjunto leído de los dos. Reducirlo más
 * sería cambiar qué persiste `persistRefresh`, que es otra tarjeta.
 */
test("el conjunto leído de hoy no contiene ninguna fila de otra fecha", async () => {
  const escenario = cuenta();
  await sembrarCacheRealista(escenario, HOY, ZONA);
  await sembrarCacheRealista(escenario, AYER, ZONA);

  escenario.base.reiniciarLecturas();
  await leerDia(escenario, HOY, ZONA);
  const deHoy = materializadas(escenario);

  escenario.base.reiniciarLecturas();
  await leerDia(escenario, AYER, ZONA);
  const deAyer = materializadas(escenario);

  assert.equal(
    deHoy.some((fila) => fila.localDate === AYER),
    false,
    "una fila de ayer no puede estar en el conjunto leído de hoy",
  );
  assert.equal(
    deAyer.some((fila) => fila.localDate === HOY),
    false,
    "una fila de hoy no puede estar en el conjunto leído de ayer",
  );

  // Lo que sí comparten: las filas sin fecha. El acoplamiento que queda.
  const compartidas = deHoy.filter((fila) =>
    deAyer.some((otra) => otra._id === fila._id),
  );
  assert.ok(compartidas.length > 0);
  assert.deepEqual(
    new Set(compartidas.map((fila) => fila.localDate)),
    new Set([undefined]),
    "lo único compartido entre dos días son las filas sin fecha",
  );
  assert.deepEqual(
    new Set(compartidas.map((fila) => fila.analysisId)).size,
    4,
    "el natal (tres análisis) y ORB-CYC-002",
  );
});

// ---------------------------------------------------------------------------
// 6. Guardas: que nadie vuelva a leer la tabla entera desde una pantalla
// ---------------------------------------------------------------------------

test("ninguna lectura de capas vuelve a `by_user` sobre analysisSnapshotsV492", async () => {
  const { readFileSync } = await import("node:fs");
  const fuente = readFileSync(`${process.cwd()}/convex/layers.ts`, "utf8");
  const bloques = fuente.split('.query("analysisSnapshotsV492")').slice(1);
  assert.ok(bloques.length >= 3, "el módulo sigue consultando la tabla");
  for (const bloque of bloques) {
    const indice = bloque.match(/withIndex\(\s*"([a-z_]+)"/)?.[1];
    assert.ok(indice, "cada consulta declara su índice");
    assert.notEqual(
      indice,
      "by_user",
      "`by_user` materializa todos los análisis de la persona: es la lectura amplia de CORE-431",
    );
  }
});

test("el schema declara el índice de alcance con sus tres campos en orden", () => {
  const indices = indicesDelSchema("analysisSnapshotsV492");
  assert.deepEqual(indices.get("by_user_local_date_timezone"), ["userId", "localDate", "timezone"]);
  assert.deepEqual(indices.get("by_user_analysis"), ["userId", "analysisId"]);
  // `by_user` sigue existiendo: el borrado de cuenta tiene que barrer TODO.
  assert.deepEqual(indices.get("by_user"), ["userId"]);
});
