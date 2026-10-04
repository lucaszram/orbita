import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

/**
 * Capa de datos del front para las capas de tiempo V4.9.2.
 *
 * A diferencia de `appRefs.ts` —que enlaza por `anyApi` y declara las firmas a
 * mano— acá el contrato ES el generado: `convex/_generated/api` ya conoce estas
 * funciones, así que los tipos de argumentos y de sobre salen del backend y no
 * de una copia paralela que se puede desincronizar. Si Codex cambia el
 * contrato, esto deja de compilar: es exactamente lo que queremos.
 *
 * ## Sólo `…WithAccess` (CORE-1043)
 *
 * Las cuatro funciones del día y del arco son las que aplican la regla Free/Plus
 * EN EL SERVIDOR: Plus recibe el payload de siempre; Free recibe Hoy abierto
 * —la Luna, el cumpleluna y los tres primeros contactos del ranking— y los
 * sobres de Tránsitos y de Tu momento cerrados, sin el dato. Las versiones sin
 * sufijo siguen publicadas para el build ya instalado, pero este bundle NO las
 * enlaza: si una pantalla pudiera elegir el endpoint sin corte, la regla
 * volvería a depender de qué componente pregunta. Las claves espejan el nombre
 * REAL de cada función —sufijo incluido— para que leer un `useQuery` alcance
 * para saber qué endpoint se pide.
 *
 * Las dos funciones natales (`getNatalBase`, `getNatalChartBase`) no cambian:
 * el recorte de la carta —casas, aspectos, capítulos— ya lo aplica su propio
 * read-model.
 *
 * Regla de la tanda: cero mocks. Ninguna pantalla de capas puede rellenar con
 * datos de maqueta; si el sobre no trae `data`, la UI explica la limitación.
 */
export const layersApi = {
  /** Capas natales (no dependen del día): tipo lunar, mapa elemental, patrón relacional. */
  getNatalBase: api.layers.getNatalBase,
  /**
   * Carta natal canónica: Sol–Plutón desde el cache `planets/tropical`, ángulos
   * y casas sólo con hora conocida, aspectos mayores y el acceso de la cuenta.
   * Es el ÚNICO origen de posiciones, grados, precisión y acceso de Carta.
   */
  getNatalChartBase: api.layers.getNatalChartBase,
  /**
   * `{ access, bundle }` del día civil pedido: el sobre completo (natal + hoy +
   * tu momento) ya cortado según el plan, y el acceso que lo explica. Reactiva.
   */
  getForDateWithAccess: api.layers.getForDateWithAccess,
  /**
   * Recalcula el día: pega al proveedor, persiste y devuelve `{ access, bundle }`
   * con el mismo corte. Lo persistido es el cálculo completo para cualquier plan.
   */
  refreshForDateWithAccess: api.layers.refreshForDateWithAccess,
  /**
   * `ORB-TRN-001` de UN arco concreto del día, tal como quedó calculado.
   * Reactiva y pura. El sobre del bundle sólo trae el arco PRINCIPAL; cualquier
   * otro tránsito de la lista se pide por acá con su `arcId`. Free recibe
   * `{ status: "locked" }` antes de que se lea ningún cálculo.
   */
  getTransitArcWithAccess: api.layers.getTransitArcWithAccess,
  /**
   * Calcula el `ORB-TRN-001` del `arcId` pedido: verifica las pasadas de ESE
   * contacto y persiste el sobre en su propio alcance. Free sale `locked` sin
   * pedir el cielo.
   */
  refreshTransitArcWithAccess: api.layers.refreshTransitArcWithAccess
} as const;

// ---------------------------------------------------------------------------
// Tipos derivados del contrato generado (no se declaran a mano)
// ---------------------------------------------------------------------------

/** Lo que publica `getForDateWithAccess`: el acceso de la cuenta y su sobre. */
export type LayerBundleWithAccess = NonNullable<
  FunctionReturnType<typeof api.layers.getForDateWithAccess>
>;
/**
 * Qué secciones abre el plan, dicho por el servidor: `hoy` siempre `open`;
 * `transitos` y `momento`, `open` o `locked`. Es lo ÚNICO que decide un muro:
 * un sobre cerrado llega con `data: null`, igual que uno al que le falta un dato
 * de nacimiento, y leer el plan de ahí pintaría un límite de plan como un error.
 */
export type LayerAccess = LayerBundleWithAccess["access"];
export type LayerBundle = LayerBundleWithAccess["bundle"];
export type NatalBaseBundle = NonNullable<FunctionReturnType<typeof api.layers.getNatalBase>>;

/**
 * Carta natal canónica. `null` mientras el snapshot todavía no está publicado:
 * la pantalla lo dice y reintenta, nunca cae a la carta legada.
 */
export type NatalChartBase = NonNullable<FunctionReturnType<typeof api.layers.getNatalChartBase>>;
/** Qué partes de la carta puede ver esta cuenta (Plus cierra casas y aspectos). */
export type NatalChartAccess = NatalChartBase["access"];
/** `ready` · `partial` · `unavailable`, declarado por el propio read-model. */
export type NatalChartStatus = NatalChartBase["status"];
/** Con qué hora se calculó: el instante exacto o el día civil completo. */
export type NatalCalculationTimeSource = NatalChartBase["calculationTimeSource"];
/** `known` · `approximate` · `unknown` — sólo `known` habilita ángulos y casas. */
export type NatalBirthTimePrecision = NatalChartBase["birthTimePrecision"];

/** Una de las diez posiciones canónicas, del Sol a Plutón. */
export type NatalPosition = NatalChartBase["positions"][number];
export type NatalPlanetKey = NatalPosition["key"];
/** `exact` · `estimated` · `range` · `omitted`: cuánto se puede afirmar del punto. */
export type NatalPositionPrecision = NatalPosition["precision"];
/** Ascendente y Medio Cielo: ejes, no planetas. Sólo con hora conocida. */
export type NatalAngle = NatalChartBase["angles"][number];
/** Una de las doce casas verificadas (o ninguna). */
export type NatalHouse = NatalChartBase["houses"][number];
/** Aspecto mayor entre dos posiciones canónicas. */
export type NatalAspect = NatalChartBase["aspects"][number];

export type TodayLayers = LayerBundle["today"];
export type MomentLayers = LayerBundle["moment"];

export type TransitRankingResult = TodayLayers["transitRanking"];
export type TransitRankingData = NonNullable<TransitRankingResult["data"]>;
export type TransitRankingItem = TransitRankingData["items"][number];
export type TransitReason = TransitRankingItem["reasons"][number];

export type TransitArcResult = TodayLayers["transitArc"];
export type TransitArcData = NonNullable<TransitArcResult["data"]>;
export type TransitPass = TransitArcData["passes"][number];

/**
 * Sobre `ORB-TRN-001` de un arco pedido por `arcId`. Es el MISMO contrato que el
 * arco principal del bundle: la única diferencia es el alcance con el que se
 * calculó y se guardó. Viaja adentro de `{ status: "ready", arc }`; Free recibe
 * `{ status: "locked" }` y `null` significa que no hay cuenta con datos, igual
 * que en `getForDateWithAccess`.
 */
export type TransitArcWithAccess = NonNullable<
  FunctionReturnType<typeof api.layers.getTransitArcWithAccess>
>;
export type TransitArcEnvelope = Extract<TransitArcWithAccess, { status: "ready" }>["arc"];

export type MoonOnChartResult = TodayLayers["moonOnChart"];
export type MoonOnChartData = NonNullable<MoonOnChartResult["data"]>;

export type CumplelunaResult = TodayLayers["cumpleluna"];
export type CumplelunaData = NonNullable<CumplelunaResult["data"]>;

export type ProgressedLunationResult = MomentLayers["progressedLunation"];
export type ProgressedLunationData = NonNullable<ProgressedLunationResult["data"]>;

export type AnnualProfectionResult = MomentLayers["annualProfection"];
export type AnnualProfectionData = NonNullable<AnnualProfectionResult["data"]>;

export type TemporalMandalaResult = MomentLayers["temporalMandala"];
export type TemporalMandalaData = NonNullable<TemporalMandalaResult["data"]>;
export type TemporalMandalaRing = TemporalMandalaData["rings"][number];

export type LunarTypeResult = NatalBaseBundle["lunarType"];
export type LunarTypeData = NonNullable<LunarTypeResult["data"]>;
/** Las ocho fases del ciclo Sol–Luna, con el nombre que usa el contrato. */
export type LunarPhaseKey = LunarTypeData["phaseKey"];
/** Rasgo de la fase natal: rótulo y párrafo, tal como los publica el backend. */
export type LunarTypeTrait = LunarTypeData["traits"][number];

export type ElementMapResult = NatalBaseBundle["elementMap"];
export type ElementMapData = NonNullable<ElementMapResult["data"]>;
/** `fire` · `earth` · `air` · `water`, tal como los nombra el contrato. */
export type ElementKey = ElementMapData["dominant"][number];
/** Un punto contado en el mapa: cuerpo, signo y elemento, ya resueltos. */
export type ElementMapPlacement = ElementMapData["placements"][number];

export type RelationshipPatternResult = NatalBaseBundle["relationshipPattern"];
export type RelationshipPatternData = NonNullable<RelationshipPatternResult["data"]>;
/** Luna, Venus o Marte: el punto, su signo (o sus dos posibles) y qué describe. */
export type RelationshipPatternFacet = RelationshipPatternData["facets"][number];
/** Descendente y casa 7: sólo existe con hora de nacimiento exacta. */
export type RelationshipAxis = NonNullable<RelationshipPatternData["relationshipAxis"]>;

export type AnalysisStatus = TransitRankingResult["status"];
export type AnalysisPrecision = TransitRankingResult["precision"];
export type AnalysisId = TransitRankingResult["analysisId"];
export type SourceRef = TransitRankingResult["sourceRefs"][number];
export type TransitAspect = TransitRankingItem["aspect"];
export type TransitState = TransitRankingItem["state"];

/**
 * Sobre genérico: todos los resultados comparten los mismos metadatos y sólo
 * cambia `data`. Los componentes de estado/trazabilidad reciben esto y no
 * necesitan saber de qué capa vienen.
 */
export type AnalysisEnvelope = Omit<TransitRankingResult, "data"> & { data: unknown };
