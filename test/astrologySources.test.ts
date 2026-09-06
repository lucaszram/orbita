import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYSIS_IDS,
  ANALYSIS_REGISTRY,
  getAnalysisDefinition,
  getSourceRefs,
  type AnalysisId,
  type SourceRef,
} from "../convex/content/astrologySources";

const MAIN_ANALYSIS_IDS: readonly AnalysisId[] = [
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
];

const RELATIONSHIP_COMPARISON_IDS: readonly AnalysisId[] = [
  "ORB-REL-002",
  "ORB-REL-003",
];

const SOURCE_REF_KEYS = [
  "author",
  "chapter",
  "edition",
  "locatorNote",
  "pdfPages",
  "printedPages",
  "relation",
  "section",
  "sourceId",
  "title",
];

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string") {
    assert.fail(`${label} must be a string`);
  }
  assert.ok(value.trim().length > 0, `${label} must not be empty`);
}

function assertValidPageRange(
  range: SourceRef["pdfPages"] | SourceRef["printedPages"],
  label: string,
) {
  assert.notEqual(range, null, `${label} must be present`);
  if (range === null) return;
  assert.ok(Number.isInteger(range.from), `${label}.from must be an integer`);
  assert.ok(Number.isInteger(range.to), `${label}.to must be an integer`);
  assert.ok(range.from > 0, `${label}.from must be positive`);
  assert.ok(range.to >= range.from, `${label}.to must not precede from`);
}

describe("V4.9.2 astrology source registry", () => {
  it("registers the ten product analyses plus the two relationship comparison methods exactly once", () => {
    assert.equal(ANALYSIS_IDS.length, 12);
    assert.equal(new Set(ANALYSIS_IDS).size, 12, "analysis IDs must be unique");
    assert.deepEqual(ANALYSIS_IDS.slice(0, 10), MAIN_ANALYSIS_IDS);
    assert.deepEqual(ANALYSIS_IDS.slice(10), RELATIONSHIP_COMPARISON_IDS);
    assert.deepEqual(
      Object.keys(ANALYSIS_REGISTRY).sort(),
      [...ANALYSIS_IDS].sort(),
      "every declared ID must have one registry entry and no undeclared entry",
    );
  });

  it("keeps every method versioned and resolves complete, verifiable source references", () => {
    for (const analysisId of ANALYSIS_IDS) {
      const definition = getAnalysisDefinition(analysisId);
      assertNonEmptyString(definition.title, `${analysisId}.title`);
      assertNonEmptyString(definition.methodVersion, `${analysisId}.methodVersion`);
      assert.match(
        definition.methodVersion,
        /-v\d+$/,
        `${analysisId}.methodVersion must end in an explicit version`,
      );
      assert.ok(
        ["direct", "orbita_synthesis", "experimental"].includes(
          definition.elaboration,
        ),
        `${analysisId}.elaboration is outside the public contract`,
      );

      const sourceRefs = getSourceRefs(analysisId);
      assert.ok(sourceRefs.length > 0, `${analysisId} must cite at least one source`);

      for (const [index, sourceRef] of sourceRefs.entries()) {
        const label = `${analysisId}.sourceRefs[${index}]`;
        assert.deepEqual(
          Object.keys(sourceRef).sort(),
          SOURCE_REF_KEYS,
          `${label} must expose bibliographic metadata only`,
        );
        assertNonEmptyString(sourceRef.sourceId, `${label}.sourceId`);
        assertNonEmptyString(sourceRef.title, `${label}.title`);
        assertNonEmptyString(sourceRef.author, `${label}.author`);
        assertNonEmptyString(sourceRef.edition, `${label}.edition`);
        assertNonEmptyString(sourceRef.chapter, `${label}.chapter`);
        assertNonEmptyString(sourceRef.locatorNote, `${label}.locatorNote`);
        assertValidPageRange(sourceRef.pdfPages, `${label}.pdfPages`);
        if (sourceRef.printedPages !== null) {
          assertValidPageRange(sourceRef.printedPages, `${label}.printedPages`);
        }
        assert.ok(
          ["direct", "synthesis", "contextual", "doctrinal_disagreement"].includes(
            sourceRef.relation,
          ),
          `${label}.relation is outside the public contract`,
        );

        const serialized = JSON.stringify(sourceRef);
        assert.doesNotMatch(serialized, /\/Users\//i, `${label} leaked a local path`);
        assert.doesNotMatch(serialized, /file:\/\//i, `${label} leaked a file URI`);
        assert.doesNotMatch(serialized, /pdfcoffee/i, `${label} leaked an acquisition source`);
        assert.doesNotMatch(serialized, /\.pdf(?:["?#]|\b)/i, `${label} leaked a PDF filename`);
        assert.doesNotMatch(
          serialized,
          /"(?:hash|sha1|sha256|sourceText|rawText|excerpt|quote)"/i,
          `${label} leaked a hash or source text`,
        );
      }
    }
  });

  it("preserves Robert Hand's verified PDF-to-printed-page offset", () => {
    const handRefs = ANALYSIS_IDS.flatMap((analysisId) => getSourceRefs(analysisId)).filter(
      (sourceRef) => sourceRef.sourceId === "RH-HS",
    );

    assert.ok(handRefs.length > 0, "the Robert Hand locator must remain represented");
    for (const sourceRef of handRefs) {
      assert.notEqual(sourceRef.printedPages, null);
      assert.equal(sourceRef.printedPages?.from, sourceRef.pdfPages.from - 15);
      assert.equal(sourceRef.printedPages?.to, sourceRef.pdfPages.to - 15);
    }
  });

  it("versiona el Mandala personal y cita el ritmo de Cumpleluna", () => {
    const definition = getAnalysisDefinition("ORB-CYC-007");
    assert.equal(
      definition.methodVersion,
      "temporal-mandala-four-personal-rhythms-v2",
    );
    assert.ok(
      getSourceRefs("ORB-CYC-007").some(
        (sourceRef) =>
          sourceRef.sourceId === "DR-LC" &&
          sourceRef.chapter === "Capítulo III" &&
          sourceRef.pdfPages.from === 61,
      ),
      "el Mandala debe trazar el anillo de Cumpleluna al capítulo que fundamenta el ciclo personal",
    );
  });
});
