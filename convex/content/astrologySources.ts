/**
 * Editorial traceability registry for the V4.9.2 astrology layers.
 *
 * This file intentionally contains bibliographic metadata and verified locators
 * only. The source PDFs, local paths, hashes, and source text are not shipped.
 */

export const ANALYSIS_IDS = [
  "ORB-LUN-001",
  "ORB-NAT-001",
  "ORB-CYC-002",
  "ORB-CYC-001",
  "ORB-CYC-007",
  "ORB-TRN-002",
  "ORB-TRN-001",
  "ORB-LUN-003",
  "ORB-LUN-002",
  "ORB-REL-001",
  "ORB-REL-002",
  "ORB-REL-003",
] as const;

export type AnalysisId = (typeof ANALYSIS_IDS)[number];
export type Elaboration = "direct" | "orbita_synthesis" | "experimental";
export type SourceRelation =
  | "direct"
  | "synthesis"
  | "contextual"
  | "doctrinal_disagreement";

export type PageRange = {
  from: number;
  to: number;
};

export type SourceRef = {
  sourceId: string;
  title: string;
  author: string;
  edition: string;
  chapter: string;
  section: string | null;
  pdfPages: PageRange;
  printedPages: PageRange | null;
  relation: SourceRelation;
  locatorNote: string;
};

type SourceRecord = Omit<
  SourceRef,
  "chapter" | "section" | "pdfPages" | "printedPages" | "relation"
>;

type SourceLocator = Pick<
  SourceRef,
  "chapter" | "section" | "pdfPages" | "printedPages" | "relation"
> & {
  sourceId: keyof typeof SOURCES;
};

const UNKNOWN_LOCAL_EDITION =
  "Edición digital local; la edición bibliográfica no está declarada en el archivo";

export const SOURCES = {
  "DG-AAS": {
    sourceId: "DG-AAS",
    title: "Astrology and the Authentic Self",
    author: "Demetra George",
    edition: UNKNOWN_LOCAL_EDITION,
    locatorNote:
      "La conversión Calibre es refluida. Se cita capítulo/sección y página física del PDF; no se infiere un folio impreso.",
  },
  "DR-AOP": {
    sourceId: "DR-AOP",
    title: "The Astrology of Personality",
    author: "Dane Rudhyar",
    edition: UNKNOWN_LOCAL_EDITION,
    locatorNote:
      "Se cita capítulo/sección y página física del PDF; el archivo no conserva un folio impreso confiable.",
  },
  "SA-APE": {
    sourceId: "SA-APE",
    title: "Astrology, Psychology, and the Four Elements",
    author: "Stephen Arroyo",
    edition: UNKNOWN_LOCAL_EDITION,
    locatorNote:
      "Escaneo a doble página. Se conservan la página física del PDF y los folios impresos visibles.",
  },
  "RH-HS": {
    sourceId: "RH-HS",
    title: "Horoscope Symbols",
    author: "Robert Hand",
    edition: UNKNOWN_LOCAL_EDITION,
    locatorNote:
      "Desde la página PDF 16, el folio impreso equivale a página PDF menos 15.",
  },
  "ST-LAA": {
    sourceId: "ST-LAA",
    title: "Los aspectos en astrología",
    author: "Sue Tompkins",
    edition: UNKNOWN_LOCAL_EDITION,
    locatorNote:
      "Escaneo verificado. Se conservan la página física del PDF y los folios impresos visibles.",
  },
  "SF-IS": {
    sourceId: "SF-IS",
    title: "The Inner Sky",
    author: "Steven Forrest",
    edition: UNKNOWN_LOCAL_EDITION,
    locatorNote:
      "Se cita capítulo/sección y página física del PDF; el archivo no conserva un folio impreso confiable.",
  },
  "DR-LC": {
    sourceId: "DR-LC",
    title: "The Lunation Cycle",
    author: "Dane Rudhyar",
    edition: UNKNOWN_LOCAL_EDITION,
    locatorNote:
      "Se conservan la página física del PDF y los folios impresos cuando son visibles.",
  },
  "HS-TH": {
    sourceId: "HS-TH",
    title: "The Twelve Houses",
    author: "Howard Sasportas",
    edition: UNKNOWN_LOCAL_EDITION,
    locatorNote:
      "Escaneo a doble página. Se conservan la página física del PDF y los folios impresos visibles.",
  },
} satisfies Record<string, SourceRecord>;

function pages(from: number, to = from): PageRange {
  return { from, to };
}

function locator(
  sourceId: keyof typeof SOURCES,
  chapter: string,
  pdfPages: PageRange,
  printedPages: PageRange | null,
  relation: SourceRelation,
  section: string | null = null,
): SourceLocator {
  return {
    sourceId,
    chapter,
    section,
    pdfPages,
    printedPages,
    relation,
  };
}

export const ANALYSIS_REGISTRY: Record<
  AnalysisId,
  {
    title: string;
    methodVersion: string;
    elaboration: Elaboration;
    sourceLocators: readonly SourceLocator[];
    limitations: readonly string[];
  }
> = {
  "ORB-LUN-001": {
    title: "Tipo lunar natal",
    methodVersion: "natal-lunation-8-phases-v1",
    elaboration: "direct",
    sourceLocators: [
      locator("DG-AAS", "Capítulo 7", pages(115, 125), null, "direct"),
      locator("DR-LC", "Capítulo III", pages(61, 68), pages(49, 56), "direct"),
    ],
    limitations: [
      "La fase describe un patrón de proceso; no resume la personalidad completa.",
    ],
  },
  "ORB-NAT-001": {
    title: "Mapa elemental",
    methodVersion: "element-map-ten-planets-equal-v1",
    elaboration: "orbita_synthesis",
    sourceLocators: [
      locator("SA-APE", "Capítulo 12", pages(61, 69), pages(111, 127), "direct"),
      locator("SA-APE", "Capítulo 11", pages(57, 58), pages(102, 105), "direct"),
    ],
    limitations: [
      "El conteo equivalente de Sol a Plutón es una convención versionada de Órbita; la fuente no fija una fórmula numérica cerrada.",
    ],
  },
  "ORB-CYC-002": {
    title: "Estación vital",
    methodVersion: "secondary-progressed-lunation-full-civil-day-v2",
    elaboration: "direct",
    sourceLocators: [
      locator("DG-AAS", "Capítulo 7", pages(126, 130), null, "direct"),
      locator("DG-AAS", "Capítulo 6", pages(96, 97), null, "direct"),
      locator("DR-LC", "Capítulo VII", pages(114, 123), pages(102, 111), "direct"),
      locator(
        "DR-LC",
        "The Lunation Process in Astrological Guidance",
        pages(158, 164),
        pages(145, 151),
        "direct",
      ),
    ],
    limitations: [
      "Es un período de desarrollo de varios años, no una predicción de acontecimientos.",
    ],
  },
  "ORB-CYC-001": {
    title: "Tema del año",
    methodVersion: "whole-sign-profection-traditional-rulers-v1",
    elaboration: "direct",
    sourceLocators: [
      locator("DG-AAS", "Capítulo 12", pages(186, 193), null, "direct"),
      locator("DR-AOP", "Capítulo 13", pages(395, 396), null, "direct"),
    ],
    limitations: [
      "Requiere hora natal exacta para conocer el Ascendente y las casas.",
      "En años no bisiestos, un cumpleaños del 29 de febrero se ajusta al 28 de febrero.",
    ],
  },
  "ORB-CYC-007": {
    title: "Mandala temporal",
    methodVersion: "temporal-mandala-four-personal-rhythms-v2",
    elaboration: "orbita_synthesis",
    sourceLocators: [
      locator("DR-LC", "The Phase Mandala", pages(181, 182), pages(169, 170), "direct"),
      locator("DR-LC", "The Repetitive Rhythm", pages(183, 188), pages(171, 176), "direct"),
      locator("DR-LC", "Capítulo III", pages(61), pages(49), "synthesis"),
    ],
    limitations: [
      "Las funciones de fase pueden repetirse; los hechos concretos no tienen por qué repetirse.",
      "La composición de cuatro relojes es una síntesis de producto de Órbita.",
    ],
  },
  "ORB-TRN-002": {
    title: "Ranking de tránsitos",
    methodVersion: "transit-ranking-v2",
    elaboration: "orbita_synthesis",
    sourceLocators: [
      locator("ST-LAA", "Interpretación práctica", pages(105, 110), pages(111, 116), "direct"),
      locator("DG-AAS", "Capítulo 6", pages(104, 113), null, "direct"),
      locator("SF-IS", "Capítulo 10", pages(126, 133), null, "direct"),
      locator("RH-HS", "Capítulo 7", pages(153, 167), pages(138, 152), "direct"),
    ],
    limitations: [
      "El orden prioriza contactos exactos hoy, próximos o recientes dentro de 72 horas; después combina orbe y relevancia natal. El puntaje interno no se presenta como una medida objetiva.",
    ],
  },
  "ORB-TRN-001": {
    title: "Arco del tránsito",
    methodVersion: "transit-arc-planets-tropical-roots-v2",
    elaboration: "orbita_synthesis",
    sourceLocators: [
      locator(
        "ST-LAA",
        "Aspectos por aplicación y por separación",
        pages(111, 112),
        pages(117, 118),
        "direct",
      ),
      locator("DG-AAS", "Capítulo 6", pages(100, 103), null, "direct"),
    ],
    limitations: [
      "La exactitud geométrica no garantiza el momento de mayor intensidad subjetiva.",
      "Cuando un planeta parece avanzar o retroceder y toca varias veces el mismo punto, Órbita reúne esos contactos en un solo tránsito.",
    ],
  },
  "ORB-LUN-003": {
    title: "Luna en tu carta",
    methodVersion: "current-lunation-natal-chart-v1",
    elaboration: "orbita_synthesis",
    sourceLocators: [
      locator(
        "DR-LC",
        "The Lunation Process in Astrological Guidance",
        pages(158, 164),
        pages(145, 151),
        "direct",
      ),
      locator("HS-TH", "Capítulos 3–14", pages(15, 50), pages(37, 107), "synthesis"),
      locator("DR-AOP", "Capítulo 13", pages(395), null, "direct"),
    ],
    limitations: [
      "La casa natal requiere hora exacta; sin ella se conservan fase y signo, pero no se inventa una casa.",
    ],
  },
  "ORB-LUN-002": {
    title: "Cumpleluna",
    methodVersion: "natal-elongation-return-full-day-range-v2",
    elaboration: "orbita_synthesis",
    sourceLocators: [
      locator("DR-LC", "Capítulo III", pages(61), pages(49), "direct"),
    ],
    limitations: [
      "La repetición angular exacta de la elongación natal es una precisión de producto.",
      "No es un retorno lunar: no busca que la Luna vuelva a su longitud natal.",
      "Sin hora exacta se evalúa el día civil completo: se publica una ventana o se retira la fecha si el ciclo no puede certificarse.",
    ],
  },
  "ORB-REL-001": {
    title: "Patrón relacional",
    methodVersion: "relationship-pattern-moon-venus-mars-v1",
    elaboration: "orbita_synthesis",
    sourceLocators: [
      locator("DG-AAS", "Capítulo 11", pages(173, 179), null, "direct"),
      locator(
        "ST-LAA",
        "El Eje Ascendente-Descendente",
        pages(385, 392),
        pages(399, 406),
        "direct",
      ),
      locator("SA-APE", "Capítulo 14", pages(73, 76), pages(134, 140), "direct"),
    ],
    limitations: [
      "Descendente y casa 7 solo se incluyen con hora natal exacta.",
      "No emite veredictos sobre matrimonio, separación o destino.",
    ],
  },
  "ORB-REL-002": {
    title: "Intercambio elemental",
    methodVersion: "relationship-element-exchange-v1",
    elaboration: "direct",
    sourceLocators: [
      locator("SA-APE", "Capítulo 15", pages(78, 83), pages(145, 155), "direct"),
    ],
    limitations: [
      "Un factor aislado no determina compatibilidad y no se calcula un puntaje global.",
    ],
  },
  "ORB-REL-003": {
    title: "Diálogos entre dos cartas",
    methodVersion: "relationship-five-dimensions-v1",
    elaboration: "orbita_synthesis",
    sourceLocators: [
      locator("ST-LAA", "Interpretación práctica", pages(101, 112), pages(107, 118), "direct"),
      locator("ST-LAA", "Capítulos VI–XIII", pages(140, 383), pages(147, 397), "direct"),
      locator("SA-APE", "Capítulo 15", pages(78, 83), pages(145, 155), "direct"),
    ],
    limitations: [
      "Las cinco dimensiones son módulos editoriales de Órbita; no producen un puntaje global.",
      "Una comparación por signo es general y no se presenta como una lectura personalizada.",
    ],
  },
};

export function getAnalysisDefinition(analysisId: AnalysisId) {
  return ANALYSIS_REGISTRY[analysisId];
}

export function getSourceRefs(analysisId: AnalysisId): SourceRef[] {
  return ANALYSIS_REGISTRY[analysisId].sourceLocators.map((entry) => ({
    ...SOURCES[entry.sourceId],
    chapter: entry.chapter,
    section: entry.section,
    pdfPages: entry.pdfPages,
    printedPages: entry.printedPages,
    relation: entry.relation,
  }));
}
