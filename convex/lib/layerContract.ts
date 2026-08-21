import { v, type Infer } from "convex/values";

export const analysisIdValidator = v.union(
  v.literal("ORB-LUN-001"),
  v.literal("ORB-NAT-001"),
  v.literal("ORB-CYC-002"),
  v.literal("ORB-CYC-001"),
  v.literal("ORB-CYC-007"),
  v.literal("ORB-TRN-002"),
  v.literal("ORB-TRN-001"),
  v.literal("ORB-LUN-003"),
  v.literal("ORB-LUN-002"),
  v.literal("ORB-REL-001"),
  v.literal("ORB-REL-002"),
  v.literal("ORB-REL-003"),
);

export const analysisStatusValidator = v.union(
  v.literal("ready"),
  v.literal("partial"),
  v.literal("needs_birth_time"),
  v.literal("unavailable"),
  v.literal("stale"),
  v.literal("error"),
);

export const precisionValidator = v.union(
  v.literal("exact"),
  v.literal("estimated"),
  v.literal("range"),
  v.literal("not_applicable"),
);

export const elaborationValidator = v.union(
  v.literal("direct"),
  v.literal("orbita_synthesis"),
  v.literal("experimental"),
);

export const pageRangeValidator = v.object({
  from: v.number(),
  to: v.number(),
});

export const sourceRefValidator = v.object({
  sourceId: v.string(),
  title: v.string(),
  author: v.string(),
  edition: v.string(),
  chapter: v.string(),
  section: v.union(v.string(), v.null()),
  pdfPages: pageRangeValidator,
  printedPages: v.union(pageRangeValidator, v.null()),
  relation: v.union(
    v.literal("direct"),
    v.literal("synthesis"),
    v.literal("contextual"),
    v.literal("doctrinal_disagreement"),
  ),
  locatorNote: v.string(),
});

export const elementValidator = v.union(
  v.literal("fire"),
  v.literal("earth"),
  v.literal("air"),
  v.literal("water"),
);

export const lunarPhaseKeyValidator = v.union(
  v.literal("new"),
  v.literal("crescent"),
  v.literal("first_quarter"),
  v.literal("gibbous"),
  v.literal("full"),
  v.literal("disseminating"),
  v.literal("last_quarter"),
  v.literal("balsamic"),
);

export const transitStateValidator = v.union(
  v.literal("approaching"),
  v.literal("exact"),
  v.literal("integrating"),
);

export const transitAspectValidator = v.union(
  v.literal("conjunction"),
  v.literal("sextile"),
  v.literal("square"),
  v.literal("trine"),
  v.literal("opposition"),
);

export const lunarTypeDataValidator = v.object({
  kind: v.literal("lunar_type"),
  phaseIndex: v.number(),
  phaseKey: lunarPhaseKeyValidator,
  name: v.string(),
  elongationDegrees: v.number(),
  illumination: v.number(),
  cyclePosition: v.number(),
  summary: v.string(),
  traits: v.array(
    v.object({
      key: v.string(),
      label: v.string(),
      body: v.string(),
    }),
  ),
});

export const elementMapDataValidator = v.object({
  kind: v.literal("element_map"),
  counts: v.object({
    fire: v.number(),
    earth: v.number(),
    air: v.number(),
    water: v.number(),
  }),
  total: v.number(),
  dominant: v.array(elementValidator),
  leastRepresented: v.array(elementValidator),
  placements: v.array(
    v.object({
      body: v.string(),
      sign: v.string(),
      element: elementValidator,
    }),
  ),
  resource: v.string(),
  overuse: v.string(),
  cultivate: v.string(),
});

export const progressedLunationDataValidator = v.object({
  kind: v.literal("progressed_lunation"),
  phaseIndex: v.number(),
  phaseKey: lunarPhaseKeyValidator,
  name: v.string(),
  progressedElongationDegrees: v.number(),
  progressedElongationRangeDegrees: v.optional(
    v.object({
      from: v.number(),
      to: v.number(),
    }),
  ),
  ageYears: v.number(),
  phaseStartedAt: v.number(),
  nextPhaseAt: v.number(),
  phaseStartedAtRange: v.optional(
    v.object({
      earliest: v.number(),
      latest: v.number(),
    }),
  ),
  nextPhaseAtRange: v.optional(
    v.object({
      earliest: v.number(),
      latest: v.number(),
    }),
  ),
  // `cyclePosition` remains optional so snapshots written before the range
  // contract stay readable. New estimated results do not publish a midpoint
  // as if it were an exact percentage; they publish `cyclePositionRange`.
  cyclePosition: v.optional(v.number()),
  cyclePositionRange: v.optional(
    v.object({
      from: v.number(),
      to: v.number(),
    }),
  ),
  // Progress through the current 45-degree phase. Exact results publish the
  // point; inexact results publish only the complete possible interval.
  progress: v.optional(v.number()),
  progressRange: v.optional(
    v.object({
      from: v.number(),
      to: v.number(),
    }),
  ),
  summary: v.string(),
});

export const annualProfectionDataValidator = v.object({
  kind: v.literal("annual_profection"),
  age: v.number(),
  house: v.number(),
  sign: v.string(),
  ruler: v.string(),
  periodStart: v.number(),
  periodEnd: v.number(),
  monthIndex: v.number(),
  summary: v.string(),
});

export const temporalMandalaDataValidator = v.object({
  kind: v.literal("temporal_mandala"),
  rings: v.array(
    v.object({
      key: v.union(
        v.literal("progressed_lunation"),
        v.literal("annual_profection"),
        v.literal("cumpleluna"),
        // Compatibilidad de lectura para snapshots v1 ya persistidos. El
        // ensamblador v2 no vuelve a emitir este anillo colectivo.
        v.literal("current_lunation"),
        v.literal("transit_arc"),
      ),
      label: v.string(),
      cadence: v.string(),
      state: v.string(),
      // Optional only so already-persisted V4.9.2 mandalas remain readable.
      // Every newly assembled ring publishes all three quality fields.
      status: v.optional(analysisStatusValidator),
      precision: v.optional(precisionValidator),
      progressMode: v.optional(
        v.union(
          v.literal("point"),
          v.literal("range"),
          v.literal("unavailable"),
        ),
      ),
      // Kept required for snapshots/clients from the first V4.9.2 contract.
      // It is consumable only when `progressMode === "point"`; otherwise the
      // assembler writes -1 and the range (when known) lives in progressRange.
      progress: v.number(),
      progressRange: v.optional(
        v.object({
          from: v.number(),
          to: v.number(),
        }),
      ),
      detail: v.string(),
      available: v.boolean(),
      cycleDay: v.optional(v.number()),
      cycleDayRange: v.optional(
        v.object({
          from: v.number(),
          to: v.number(),
        }),
      ),
      cycleLengthDays: v.optional(v.number()),
      cycleLengthDaysRange: v.optional(
        v.object({
          from: v.number(),
          to: v.number(),
        }),
      ),
      daysRemaining: v.optional(v.number()),
      daysRemainingRange: v.optional(
        v.object({
          from: v.number(),
          to: v.number(),
        }),
      ),
      previousExactAt: v.optional(v.number()),
      previousExactAtRange: v.optional(
        v.object({
          earliest: v.number(),
          latest: v.number(),
        }),
      ),
      nextExactAt: v.optional(v.number()),
      nextExactAtRange: v.optional(
        v.object({
          earliest: v.number(),
          latest: v.number(),
        }),
      ),
    }),
  ),
  summary: v.string(),
});

export const transitReasonValidator = v.object({
  key: v.union(
    v.literal("exactness"),
    v.literal("natal_point"),
    v.literal("speed"),
    v.literal("angular_house"),
    v.literal("rulership"),
    v.literal("repeated_signature"),
  ),
  label: v.string(),
  explanation: v.string(),
});

export const transitRankingItemValidator = v.object({
  arcId: v.string(),
  transitPlanet: v.string(),
  natalPoint: v.string(),
  aspect: transitAspectValidator,
  aspectDegrees: v.number(),
  orbDegrees: v.number(),
  state: transitStateValidator,
  exactAt: v.union(v.number(), v.null()),
  // Optional only at the storage boundary: Convex validates every persisted
  // snapshot when a schema is pushed, including ranking-v1 rows that predate
  // these fields. The v2 builder always emits all four values, while readers
  // keep their defensive fallback until old snapshots expire naturally.
  previousExactAt: v.optional(v.union(v.number(), v.null())),
  nextExactAt: v.optional(v.union(v.number(), v.null())),
  rankingWindow: v.optional(v.object({
    startsAt: v.number(),
    endsAt: v.number(),
  })),
  rankingReason: v.optional(v.string()),
  startsAt: v.union(v.number(), v.null()),
  endsAt: v.union(v.number(), v.null()),
  natalHouse: v.union(v.number(), v.null()),
  reasons: v.array(transitReasonValidator),
  summary: v.string(),
});

export const transitRankingDataValidator = v.object({
  kind: v.literal("transit_ranking"),
  items: v.array(transitRankingItemValidator),
  activeCount: v.number(),
  calculatedAt: v.number(),
  summary: v.string(),
});

export const transitPassValidator = v.object({
  exactAt: v.number(),
  direction: v.union(v.literal("direct"), v.literal("retrograde")),
  label: v.string(),
});

export const transitArcDataValidator = v.object({
  kind: v.literal("transit_arc"),
  arcId: v.string(),
  transitPlanet: v.string(),
  natalPoint: v.string(),
  // Optional only so persisted ORB-TRN-001 envelopes from before 2026-08-20
  // remain readable. New builds always publish every optional field below.
  natalHouse: v.optional(v.union(v.number(), v.null())),
  aspect: transitAspectValidator,
  state: transitStateValidator,
  startsAt: v.number(),
  peakAt: v.number(),
  endsAt: v.number(),
  previousExactAt: v.optional(v.union(v.number(), v.null())),
  nextExactAt: v.optional(v.union(v.number(), v.null())),
  rankingWindow: v.optional(v.object({
    startsAt: v.number(),
    endsAt: v.number(),
  })),
  rankingReason: v.optional(v.string()),
  progress: v.number(),
  passes: v.array(transitPassValidator),
  summary: v.string(),
});

export const moonOnChartDataValidator = v.object({
  kind: v.literal("moon_on_chart"),
  sign: v.string(),
  longitudeDegrees: v.number(),
  phaseKey: lunarPhaseKeyValidator,
  phaseName: v.string(),
  illumination: v.number(),
  natalHouse: v.union(v.number(), v.null()),
  houseTheme: v.union(v.string(), v.null()),
  summary: v.string(),
});

export const cumplelunaDataValidator = v.object({
  kind: v.literal("cumpleluna"),
  natalElongationDegrees: v.number(),
  natalElongationRangeDegrees: v.optional(
    v.object({
      from: v.number(),
      to: v.number(),
    }),
  ),
  currentElongationDegrees: v.number(),
  previousExactAt: v.number(),
  nextExactAt: v.number(),
  previousExactAtRange: v.optional(
    v.object({
      earliest: v.number(),
      latest: v.number(),
    }),
  ),
  nextExactAtRange: v.optional(
    v.object({
      earliest: v.number(),
      latest: v.number(),
    }),
  ),
  daysRemaining: v.number(),
  daysRemainingRange: v.optional(
    v.object({
      from: v.number(),
      to: v.number(),
    }),
  ),
  cycleDay: v.number(),
  cycleDayRange: v.optional(
    v.object({
      from: v.number(),
      to: v.number(),
    }),
  ),
  cycleLengthDays: v.number(),
  cycleLengthDaysRange: v.optional(
    v.object({
      from: v.number(),
      to: v.number(),
    }),
  ),
  progress: v.number(),
  progressRange: v.optional(
    v.object({
      from: v.number(),
      to: v.number(),
    }),
  ),
  summary: v.string(),
});

export const relationshipDimensionKeyValidator = v.union(
  v.literal("communication"),
  v.literal("care"),
  v.literal("desire"),
  v.literal("friction"),
  v.literal("shared_project"),
);

/**
 * De qué clase es un contacto. Es el vocabulario CANÓNICO del motor
 * (`RelationshipDriverQuality` en `convex/lib/relationshipLayers.ts`), publicado
 * tal cual: `support` no es "bueno" ni `tension` "malo", son la familia del
 * aspecto —trígono y sextil de un lado, cuadratura y oposición del otro— y la
 * conjunción, que sola no inclina nada.
 */
export const relationshipDriverQualityValidator = v.union(
  v.literal("support"),
  v.literal("tension"),
  v.literal("neutral"),
);

/**
 * Un contacto de una dimensión, con la evidencia que lo sostiene.
 *
 * Es la forma ESTRUCTURADA de lo que `drivers: string[]` ya publicaba como
 * prosa. Se agrega —no reemplaza— para que un cliente pueda explicar por qué
 * una dimensión dice lo que dice sin volver a parsear la oración.
 *
 * - `id`: la identidad real del contacto (`aspect:a:venus:b:sun:trine`,
 *   `house:b:sun:a:7`). Sale de QUÉ toca a QUÉ, nunca del índice del arreglo ni
 *   del texto. El MISMO contacto conserva el MISMO id cuando alimenta más de una
 *   dimensión: eso es lo que permite explicar la reutilización en vez de
 *   presentarla como dos contactos distintos.
 * - `weight`: cuánto pesa ese contacto DENTRO de esa dimensión. Se suma con los
 *   demás de la misma dimensión; **no es un porcentaje** y no está normalizado a
 *   1: el mismo contacto puede pesar distinto en dos dimensiones porque el par
 *   de puntos importa distinto en cada una.
 * - `precision`: la misma escala que el resto del contrato (`precisionValidator`).
 */
export const relationshipDriverDetailValidator = v.object({
  id: v.string(),
  text: v.string(),
  quality: relationshipDriverQualityValidator,
  weight: v.number(),
  precision: precisionValidator,
});

export const relationshipDimensionValidator = v.object({
  key: relationshipDimensionKeyValidator,
  label: v.string(),
  value: v.number(),
  summary: v.string(),
  drivers: v.array(v.string()),
  /**
   * Aditivo y opcional. Los cachés escritos antes de esta versión —y los
   * clientes del build 22, que no lo leen— siguen siendo válidos: `drivers`
   * conserva exactamente su semántica y su orden. Cuando está, trae UNA entrada
   * por contacto único de esa dimensión.
   */
  driverDetails: v.optional(v.array(relationshipDriverDetailValidator)),
  precision: precisionValidator,
});

export const relationshipPatternDataValidator = v.object({
  kind: v.literal("relationship_pattern"),
  facets: v.array(
    v.object({
      key: v.union(
        v.literal("emotional_need"),
        v.literal("affection_style"),
        v.literal("desire_style"),
      ),
      label: v.string(),
      title: v.string(),
      signs: v.array(v.string()),
      precision: precisionValidator,
      summary: v.string(),
    }),
  ),
  relationshipAxis: v.union(
    v.object({
      descendantSign: v.string(),
      house7Planets: v.array(v.string()),
      summary: v.string(),
    }),
    v.null(),
  ),
  includedPoints: v.array(v.string()),
  excludedPoints: v.array(v.string()),
  summary: v.string(),
});

export const comparisonLevelValidator = v.union(
  v.literal("sign_to_sign"),
  v.literal("date_to_date"),
  v.literal("chart_to_chart"),
);

export const relationshipComparisonDataValidator = v.object({
  kind: v.literal("relationship_comparison"),
  requestedLevel: comparisonLevelValidator,
  resolvedLevel: comparisonLevelValidator,
  dimensions: v.array(relationshipDimensionValidator),
  includedTechniques: v.array(v.string()),
  omittedTechniques: v.array(v.string()),
  summary: v.string(),
  // Optional only for backwards compatibility with caches written before
  // V4.9.2 exposed the engine's own disclaimer. Every newly built comparison
  // includes it; old cache rows remain readable until their normal
  // input/method invalidation replaces them.
  disclaimer: v.optional(v.string()),
  generalOnly: v.boolean(),
});

export const analysisDataValidator = v.union(
  lunarTypeDataValidator,
  elementMapDataValidator,
  progressedLunationDataValidator,
  annualProfectionDataValidator,
  temporalMandalaDataValidator,
  transitRankingDataValidator,
  transitArcDataValidator,
  moonOnChartDataValidator,
  cumplelunaDataValidator,
  relationshipPatternDataValidator,
  relationshipComparisonDataValidator,
);

export const analysisResultFields = {
  analysisId: analysisIdValidator,
  methodVersion: v.string(),
  providerVersion: v.optional(v.string()),
  inputHash: v.string(),
  status: analysisStatusValidator,
  precision: precisionValidator,
  observedAt: v.number(),
  validUntil: v.union(v.number(), v.null()),
  missingInputs: v.array(v.string()),
  limitations: v.array(v.string()),
  elaboration: elaborationValidator,
  sourceRefs: v.array(sourceRefValidator),
};

export const analysisResultValidator = v.object({
  ...analysisResultFields,
  data: v.union(analysisDataValidator, v.null()),
});

export const lunarTypeResultValidator = v.object({
  ...analysisResultFields,
  data: v.union(lunarTypeDataValidator, v.null()),
});
export const elementMapResultValidator = v.object({
  ...analysisResultFields,
  data: v.union(elementMapDataValidator, v.null()),
});
export const progressedLunationResultValidator = v.object({
  ...analysisResultFields,
  data: v.union(progressedLunationDataValidator, v.null()),
});
export const annualProfectionResultValidator = v.object({
  ...analysisResultFields,
  data: v.union(annualProfectionDataValidator, v.null()),
});
export const temporalMandalaResultValidator = v.object({
  ...analysisResultFields,
  data: v.union(temporalMandalaDataValidator, v.null()),
});
export const transitRankingResultValidator = v.object({
  ...analysisResultFields,
  data: v.union(transitRankingDataValidator, v.null()),
});
export const transitArcResultValidator = v.object({
  ...analysisResultFields,
  data: v.union(transitArcDataValidator, v.null()),
});
export const moonOnChartResultValidator = v.object({
  ...analysisResultFields,
  data: v.union(moonOnChartDataValidator, v.null()),
});
export const cumplelunaResultValidator = v.object({
  ...analysisResultFields,
  data: v.union(cumplelunaDataValidator, v.null()),
});
export const relationshipPatternResultValidator = v.object({
  ...analysisResultFields,
  data: v.union(relationshipPatternDataValidator, v.null()),
});
export const relationshipComparisonResultValidator = v.object({
  ...analysisResultFields,
  data: v.union(relationshipComparisonDataValidator, v.null()),
});

export const natalBaseBundleValidator = v.object({
  lunarType: lunarTypeResultValidator,
  elementMap: elementMapResultValidator,
  relationshipPattern: relationshipPatternResultValidator,
});

export const todayLayersValidator = v.object({
  transitRanking: transitRankingResultValidator,
  transitArc: transitArcResultValidator,
  moonOnChart: moonOnChartResultValidator,
  cumpleluna: cumplelunaResultValidator,
});

export const momentLayersValidator = v.object({
  progressedLunation: progressedLunationResultValidator,
  annualProfection: annualProfectionResultValidator,
  temporalMandala: temporalMandalaResultValidator,
});

export const layerBundleValidator = v.object({
  natal: natalBaseBundleValidator,
  today: todayLayersValidator,
  moment: momentLayersValidator,
});

export const relationshipProfileValidator = v.object({
  profileId: v.id("relationshipProfiles"),
  name: v.string(),
  birthDate: v.union(v.string(), v.null()),
  birthTime: v.union(v.string(), v.null()),
  birthTimePrecision: v.union(
    v.literal("known"),
    v.literal("approximate"),
    v.literal("unknown"),
  ),
  birthPlaceLabel: v.union(v.string(), v.null()),
  latitude: v.union(v.number(), v.null()),
  longitude: v.union(v.number(), v.null()),
  timezone: v.union(v.string(), v.null()),
  zodiacSign: v.union(v.string(), v.null()),
  availableLevel: comparisonLevelValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const ephemerisPositionValidator = v.object({
  key: v.string(),
  label: v.string(),
  sign: v.string(),
  signEs: v.string(),
  degree: v.number(),
  fullDegree: v.number(),
  speed: v.number(),
  isRetrograde: v.boolean(),
});

export const normalizedPlacementSnapshotValidator = v.object({
  key: v.string(),
  label: v.string(),
  sign: v.string(),
  signEs: v.string(),
  degree: v.union(v.number(), v.null()),
  fullDegree: v.union(v.number(), v.null()),
  house: v.union(v.number(), v.null()),
  isRetrograde: v.union(v.boolean(), v.null()),
});

export const normalizedHouseSnapshotValidator = v.object({
  house: v.number(),
  sign: v.string(),
  signEs: v.string(),
  degree: v.union(v.number(), v.null()),
  theme: v.string(),
});

export const normalizedChartSnapshotValidator = v.object({
  placements: v.array(normalizedPlacementSnapshotValidator),
  houses: v.array(normalizedHouseSnapshotValidator),
});

export const birthDataSnapshotValidator = v.object({
  birthDate: v.string(),
  birthTime: v.union(v.string(), v.null()),
  birthTimePrecision: v.union(
    v.literal("known"),
    v.literal("approximate"),
    v.literal("unknown"),
  ),
  birthPlaceLabel: v.string(),
  latitude: v.union(v.number(), v.null()),
  longitude: v.union(v.number(), v.null()),
  timezone: v.string(),
  updatedAt: v.number(),
});

export type AnalysisId = Infer<typeof analysisIdValidator>;
export type AnalysisStatus = Infer<typeof analysisStatusValidator>;
export type AnalysisPrecision = Infer<typeof precisionValidator>;
export type AnalysisData = Infer<typeof analysisDataValidator>;
export type AnalysisResult = Infer<typeof analysisResultValidator>;
export type LunarTypeResult = Infer<typeof lunarTypeResultValidator>;
export type ElementMapResult = Infer<typeof elementMapResultValidator>;
export type ProgressedLunationResult = Infer<typeof progressedLunationResultValidator>;
export type AnnualProfectionResult = Infer<typeof annualProfectionResultValidator>;
export type TemporalMandalaResult = Infer<typeof temporalMandalaResultValidator>;
export type TransitRankingResult = Infer<typeof transitRankingResultValidator>;
export type TransitArcResult = Infer<typeof transitArcResultValidator>;
export type MoonOnChartResult = Infer<typeof moonOnChartResultValidator>;
export type CumplelunaResult = Infer<typeof cumplelunaResultValidator>;
export type RelationshipPatternResult = Infer<typeof relationshipPatternResultValidator>;
export type RelationshipComparisonResult = Infer<typeof relationshipComparisonResultValidator>;
export type RelationshipDriverQuality = Infer<typeof relationshipDriverQualityValidator>;
export type RelationshipDriverDetail = Infer<typeof relationshipDriverDetailValidator>;
export type LayerBundle = Infer<typeof layerBundleValidator>;
export type NatalBaseBundle = Infer<typeof natalBaseBundleValidator>;
export type RelationshipProfile = Infer<typeof relationshipProfileValidator>;
export type EphemerisPosition = Infer<typeof ephemerisPositionValidator>;
export type NormalizedChartSnapshot = Infer<typeof normalizedChartSnapshotValidator>;
export type BirthDataSnapshot = Infer<typeof birthDataSnapshotValidator>;
