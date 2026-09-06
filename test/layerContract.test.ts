import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { USER_SCOPED_DELETION_STEPS } from "../convex/lib/accountDeletion";
import {
  analysisIdValidator,
  analysisResultValidator,
  transitArcDataValidator,
  transitRankingItemValidator,
} from "../convex/lib/layerContract";
import { stableInputHash } from "../convex/lib/stableHash";

type RuntimeValidator = {
  fields?: Record<string, RuntimeValidator>;
  isOptional?: "required" | "optional";
  kind?: string;
  members?: RuntimeValidator[];
  value?: unknown;
};

const CONTRACT_FIELDS = [
  "analysisId",
  "methodVersion",
  "providerVersion",
  "inputHash",
  "status",
  "precision",
  "observedAt",
  "validUntil",
  "data",
  "missingInputs",
  "limitations",
  "elaboration",
  "sourceRefs",
].sort();

function schemaTableDefinition(schema: string, table: string): string {
  const marker = `  ${table}: defineTable(`;
  const start = schema.indexOf(marker);
  assert.notEqual(start, -1, `${table} is missing from convex/schema.ts`);

  const remainder = schema.slice(start + marker.length);
  const nextTable = /\n  [A-Za-z][A-Za-z0-9]*: defineTable\(/.exec(remainder);
  const end = nextTable === null ? schema.length : start + marker.length + nextTable.index;
  return schema.slice(start, end);
}

describe("V4.9.2 analysis contract", () => {
  it("keeps the public AnalysisResult envelope explicit and free of source_claim_id", () => {
    const result = analysisResultValidator as unknown as RuntimeValidator;
    const fields = result.fields ?? {};
    assert.deepEqual(Object.keys(fields).sort(), CONTRACT_FIELDS);
    assert.equal(fields.providerVersion?.isOptional, "optional");
    for (const field of CONTRACT_FIELDS.filter((name) => name !== "providerVersion")) {
      assert.equal(fields[field]?.isOptional, "required", `${field} must be required`);
    }
    assert.equal(Object.hasOwn(fields, "source_claim_id"), false);
    assert.equal(Object.hasOwn(fields, "sourceClaimId"), false);

    const contractSource = readFileSync(
      `${process.cwd()}/convex/lib/layerContract.ts`,
      "utf8",
    );
    assert.doesNotMatch(contractSource, /source_claim_id/i);
  });

  it("keeps all twelve registry IDs in the runtime validator", () => {
    const validator = analysisIdValidator as unknown as RuntimeValidator;
    const ids = (validator.members ?? []).map((member) => member.value);
    assert.equal(ids.length, 12);
    assert.equal(new Set(ids).size, 12);
    assert.deepEqual(ids, [
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
    ]);
  });

  it("versiona el ranking y mantiene legibles los sobres persistidos anteriores", () => {
    const ranking = transitRankingItemValidator as unknown as RuntimeValidator;
    const arc = transitArcDataValidator as unknown as RuntimeValidator;
    for (const field of ["previousExactAt", "nextExactAt", "rankingWindow", "rankingReason"]) {
      assert.equal(ranking.fields?.[field]?.isOptional, "optional", `el ranking legado debe tolerar ${field} ausente`);
      assert.equal(arc.fields?.[field]?.isOptional, "optional", `el arco legado debe tolerar ${field} ausente`);
    }
    assert.equal(ranking.fields?.natalHouse?.isOptional, "required");
    assert.equal(arc.fields?.natalHouse?.isOptional, "optional");
  });

  it("hashes normalized inputs deterministically without exposing natal data", () => {
    const natalInput = {
      timezone: "America/Argentina/Buenos_Aires",
      birthPlaceLabel: "SECRET_BIRTH_PLACE_CABALLITO_74291",
      birthTime: "04:37",
      birthDate: "1988-10-23",
      nested: {
        longitude: -58.3816,
        latitude: -34.6037,
      },
      ignoredUndefined: undefined,
    };
    const sameInputDifferentKeyOrder = {
      birthDate: "1988-10-23",
      ignoredUndefined: undefined,
      nested: {
        latitude: -34.6037,
        longitude: -58.3816,
      },
      birthTime: "04:37",
      birthPlaceLabel: "SECRET_BIRTH_PLACE_CABALLITO_74291",
      timezone: "America/Argentina/Buenos_Aires",
    };

    const hash = stableInputHash(natalInput);
    assert.equal(hash, stableInputHash(natalInput));
    assert.equal(hash, stableInputHash(sameInputDifferentKeyOrder));
    assert.match(hash, /^[0-9a-z]{14}$/);
    assert.notEqual(hash, stableInputHash({ ...natalInput, birthTime: "04:38" }));
    assert.doesNotMatch(hash, /SECRET_BIRTH_PLACE_CABALLITO_74291/i);
    assert.doesNotMatch(hash, /1988-10-23/);
    assert.doesNotMatch(hash, /04:37/);
    assert.doesNotMatch(hash, /Buenos_Aires/i);
  });
});

describe("V4.9.2 schema isolation and deletion", () => {
  const schema = readFileSync(`${process.cwd()}/convex/schema.ts`, "utf8");

  it("uses closed validators rather than v.any in every new cache", () => {
    for (const table of [
      "analysisSnapshotsV492",
      "globalSkySnapshotsV492",
      "relationshipComparisonCachesV492",
    ]) {
      const definition = schemaTableDefinition(schema, table);
      assert.doesNotMatch(definition, /\bv\.any\s*\(/, `${table} must stay fully typed`);
    }
  });

  it("deletes both new personal caches but never the shared sky snapshot", () => {
    const tables = USER_SCOPED_DELETION_STEPS.map((step) => step.table);
    assert.equal(tables.filter((table) => table === "analysisSnapshotsV492").length, 1);
    assert.equal(
      tables.filter((table) => table === "relationshipComparisonCachesV492").length,
      1,
    );
    assert.equal(tables.includes("globalSkySnapshotsV492"), false);
  });

  it("preserves the legacy cache and relationship schema consumed by installed clients", () => {
    const legacyExpectations: Array<{
      table: string;
      patterns: RegExp[];
    }> = [
      {
        table: "natalCharts",
        patterns: [
          /payload:\s*v\.any\(\)/,
          /\.index\("by_user", \["userId"\]\)/,
          /\.index\("by_cacheKey", \["cacheKey"\]\)/,
        ],
      },
      {
        table: "profileAstrologyCaches",
        patterns: [
          /payload:\s*v\.any\(\)/,
          /\.index\("by_user", \["userId"\]\)/,
          /\.index\("by_cacheKey", \["cacheKey"\]\)/,
        ],
      },
      {
        table: "transitReadings",
        patterns: [
          /payload:\s*v\.any\(\)/,
          /\.index\("by_user_date", \["userId", "localDate"\]\)/,
        ],
      },
      {
        table: "transitTimelineCaches",
        patterns: [
          /payload:\s*v\.any\(\)/,
          /\.index\("by_user_period", \["userId", "periodType", "periodStart"\]\)/,
        ],
      },
      {
        table: "globalSkyCaches",
        patterns: [
          /payload:\s*v\.any\(\)/,
          /\.index\("by_date_timezone_version", \["localDate", "timezone", "providerVersion"\]\)/,
        ],
      },
      {
        table: "relationshipProfiles",
        patterns: [
          /name:\s*v\.string\(\)/,
          /birthDate:\s*v\.optional\(v\.string\(\)\)/,
          /isActive:\s*v\.boolean\(\)/,
          /\.index\("by_user", \["userId"\]\)/,
          /\.index\("by_user_active", \["userId", "isActive"\]\)/,
        ],
      },
    ];

    for (const { table, patterns } of legacyExpectations) {
      const definition = schemaTableDefinition(schema, table);
      for (const pattern of patterns) {
        assert.match(definition, pattern, `${table} changed a legacy contract: ${pattern}`);
      }
    }
  });
});
