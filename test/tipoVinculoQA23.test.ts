import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import type { Id } from "../convex/_generated/dataModel";
import {
  buildRelationshipComparisonInputHash,
  buildRelationshipComparisonResult,
  normalizeRelationshipPersonInput,
} from "../convex/relationships";
import type { RelationshipType } from "../convex/lib/relationshipLayers";
import { relationshipReading } from "../src/domain/relationshipReading";
import {
  emptyRelationshipDraft,
  relationshipSaveArgs,
  relationshipSaveSignature,
} from "../src/domain/relationships";
import {
  readRelationshipType,
  RELATIONSHIP_TYPE_DEFINE_CTA,
  RELATIONSHIP_TYPE_LABEL,
  RELATIONSHIP_TYPES,
  relationshipTypeAllowsDesire,
  relationshipTypeNeedsDefinition,
  relationshipTypeRejectedByBackend,
} from "../src/domain/relationshipType";

const ROOT = join(import.meta.dirname, "..");
const profileId = "relationship-profile-qa23" as Id<"relationshipProfiles">;

const point = (key: string, longitude: number) => ({
  key,
  label: key[0]!.toUpperCase() + key.slice(1),
  sign: null,
  longitude,
  longitudeSamples: [],
  timeStable: true,
  house: null,
});

const placementsA = [
  point("sun", 0),
  point("moon", 10),
  point("mercury", 20),
  point("venus", 30),
  point("mars", 40),
  point("jupiter", 50),
  point("saturn", 60),
];
const placementsB = [
  point("sun", 120),
  point("moon", 190),
  point("mercury", 140),
  point("venus", 30),
  point("mars", 40),
  point("jupiter", 170),
  point("saturn", 300),
];

function chart(name: string, placements: typeof placementsA) {
  return {
    name,
    zodiacSign: null,
    birthTimePrecision: "known" as const,
    placements,
    houses: [],
  };
}

function comparison(relationshipType?: RelationshipType | null) {
  return buildRelationshipComparisonResult({
    inputHash: "qa23-relationship-type",
    requestedLevel: "date_to_date",
    personA: chart("Vos", placementsA),
    personB: chart("Alex", placementsB),
    relationshipType,
    observedAt: 1_700_000_000_000,
  });
}

function profile(relationshipType?: RelationshipType | null) {
  return {
    profileId,
    name: "Alex",
    relationshipType,
    birthDate: "1995-04-21",
    birthTime: null,
    birthTimePrecision: "unknown" as const,
    birthPlaceLabel: null,
    latitude: null,
    longitude: null,
    timezone: null,
    zodiacSign: "taurus",
    availableLevel: "date_to_date" as const,
    createdAt: 100,
    updatedAt: 200,
  };
}

describe("QA23 · tipo de vínculo declarado", () => {
  it("distingue legacy null de prefer_not_to_say explícito", () => {
    const legacy = normalizeRelationshipPersonInput({
      name: "Alex",
      birthTimePrecision: "unknown",
      zodiacSign: "tauro",
    });
    const explicit = normalizeRelationshipPersonInput({
      name: "Alex",
      relationshipType: "prefer_not_to_say",
      birthTimePrecision: "unknown",
      zodiacSign: "tauro",
    });
    assert.equal(legacy.relationshipType, null);
    assert.equal(explicit.relationshipType, "prefer_not_to_say");
  });

  it("sólo romantic publica Deseo o lenguaje de atracción", () => {
    const romantic = comparison("romantic");
    assert.equal(romantic.data?.relationshipType, "romantic");
    assert.match(JSON.stringify(romantic.data), /Deseo|deseo|atracción/i);

    const neutralTypes: Array<RelationshipType | null | undefined> = [
      "parent_or_caregiver",
      "child",
      "sibling",
      "friendship",
      "work_or_project",
      "other",
      "prefer_not_to_say",
      null,
      undefined,
    ];
    for (const relationshipType of neutralTypes) {
      const result = comparison(relationshipType);
      const published = JSON.stringify(result);
      assert.doesNotMatch(
        published,
        /deseo|sexual|erótic|atracción|intimidad|romántic/i,
        `el tipo ${String(relationshipType)} debe conservar una lectura neutral`,
      );
      assert.equal(
        result.data?.dimensions.find((dimension) => dimension.key === "desire")?.label,
        "Energía compartida",
      );
      assert.equal(result.data?.relationshipType, relationshipType ?? null);
    }
  });

  it("incluye el tipo en la identidad de hash y no lo deriva de la carta", () => {
    const hash = (relationshipType?: RelationshipType | null) =>
      buildRelationshipComparisonInputHash({
        userId: "user-qa23",
        profile: profile(relationshipType),
        natalChartId: "chart-qa23",
        natalChartUpdatedAt: 300,
      });
    assert.notEqual(hash("romantic"), hash("friendship"));
    assert.notEqual(hash(null), hash("prefer_not_to_say"));
    assert.equal(hash(), hash(null));
  });

  it("mantiene schema, save y perfiles aditivos para builds 22/23", () => {
    const contract = readFileSync(join(ROOT, "convex/lib/layerContract.ts"), "utf8");
    const schema = readFileSync(join(ROOT, "convex/schema.ts"), "utf8");
    const api = readFileSync(join(ROOT, "convex/relationships.ts"), "utf8");
    assert.match(schema, /relationshipType: v\.optional\(relationshipTypeValidator\)/);
    assert.match(api, /relationshipType: v\.optional\(relationshipTypeValidator\)/);
    assert.match(
      contract,
      /relationshipType: v\.optional\(v\.union\(relationshipTypeValidator, v\.null\(\)\)\)/,
    );
    assert.match(api, /args\.relationshipType !== undefined/);
    assert.match(api, /relationshipType: args\.profile\.relationshipType \?\? null/);
  });

  it("mantiene los ocho labels exactos y la diferencia entre legacy y elección explícita", () => {
    assert.deepEqual(RELATIONSHIP_TYPES, [
      "romantic",
      "parent_or_caregiver",
      "child",
      "sibling",
      "friendship",
      "work_or_project",
      "other",
      "prefer_not_to_say",
    ]);
    assert.deepEqual(RELATIONSHIP_TYPE_LABEL, {
      romantic: "Vínculo romántico",
      parent_or_caregiver: "Madre, padre o cuidador/a",
      child: "Hijo/a",
      sibling: "Hermano/a",
      friendship: "Amistad",
      work_or_project: "Trabajo o proyecto",
      other: "Otro vínculo",
      prefer_not_to_say: "Prefiero no decirlo",
    });
    assert.equal(readRelationshipType({}), null);
    assert.equal(readRelationshipType({ relationshipType: null }), null);
    assert.equal(readRelationshipType({ relationshipType: "prefer_not_to_say" }), "prefer_not_to_say");
    assert.equal(relationshipTypeNeedsDefinition(null), true);
    assert.equal(relationshipTypeNeedsDefinition("prefer_not_to_say"), false);
    assert.equal(relationshipTypeAllowsDesire("romantic"), true);
    assert.equal(relationshipTypeAllowsDesire("friendship"), false);
  });

  it("el borrador guarda el tipo como dato separado y lo incluye en firma/idempotencia", () => {
    const base = {
      ...emptyRelationshipDraft(),
      name: "Alex",
      zodiacSign: "taurus" as const,
    };
    const legacy = relationshipSaveArgs(base, null, null, "ios.create:qa23-legacy");
    const friendship = relationshipSaveArgs(
      { ...base, relationshipType: "friendship" },
      null,
      null,
      "ios.create:qa23-friendship",
    );
    assert.ok(legacy);
    assert.ok(friendship);
    assert.equal("relationshipType" in legacy, false);
    assert.equal(friendship.relationshipType, "friendship");
    assert.notEqual(
      relationshipSaveSignature(base, null, null),
      relationshipSaveSignature({ ...base, relationshipType: "friendship" }, null, null),
    );
  });

  it("la lectura cliente también falla cerrado a neutral para legacy y no-romantic", () => {
    const romanticData = comparison("romantic").data;
    const neutralData = comparison("friendship").data;
    assert.ok(romanticData && neutralData);
    assert.match(JSON.stringify(relationshipReading(romanticData, "romantic")), /Deseo|deseo|atracción/i);

    for (const type of [null, "friendship", "work_or_project", "prefer_not_to_say"] as const) {
      const reading = relationshipReading(neutralData, type);
      assert.ok(reading);
      assert.doesNotMatch(
        JSON.stringify(reading),
        /deseo|sexual|erótic|atracción|intimidad|romántic/i,
      );
      assert.equal(reading.dimensions.find((dimension) => dimension.key === "desire")?.label, "Energía compartida");
    }
  });

  it("la UI pregunta junto al nombre, es accesible y legacy no bloquea la comparación", () => {
    const form = readFileSync(join(ROOT, "src/screens/v492/VinculosConnectScreen.tsx"), "utf8");
    const hub = readFileSync(join(ROOT, "src/screens/v492/VinculosHubScreen.tsx"), "utf8");
    const result = readFileSync(join(ROOT, "src/screens/v492/VinculosResultScreen.tsx"), "utf8");

    const nameAt = form.indexOf("<Label>NOMBRE</Label>");
    const typeAt = form.indexOf("<TipoDeVinculo");
    const continueAt = form.indexOf('label="CONTINUAR"', typeAt);
    assert.ok(nameAt >= 0 && typeAt > nameAt && continueAt > typeAt);
    assert.match(form, /accessibilityRole="radiogroup"/);
    assert.match(form, /accessibilityRole="radio"/);
    assert.match(form, /accessibilityState=\{\{ checked: selected \}\}/);
    assert.match(form, /relationshipTypeRejectedByBackend/);
    assert.match(form, /relationshipSaveArgsWithoutType/);
    assert.match(form, /tipoSinGuardar\s*\?\s*"IR AL PERFIL"/s);
    assert.equal(RELATIONSHIP_TYPE_DEFINE_CTA, "DEFINIR TIPO DE VÍNCULO");
    assert.match(hub, /\{RELATIONSHIP_TYPE_DEFINE_CTA\}/);
    assert.match(result, /\{RELATIONSHIP_TYPE_DEFINE_CTA\}/);
    assert.match(hub, /<CardButton[\s\S]*?router\.push\(relationshipProfileHref\(persona\.profileId\)/s);
  });

  it("sólo degrada ante rechazo del campo nuevo, no ante red o permisos", () => {
    assert.equal(
      relationshipTypeRejectedByBackend(
        new Error("ArgumentValidationError: Object contains extra field relationshipType"),
      ),
      true,
    );
    assert.equal(relationshipTypeRejectedByBackend(new Error("Network request failed")), false);
    assert.equal(relationshipTypeRejectedByBackend(new Error("RELATIONSHIP_PROFILE_NOT_FOUND")), false);
  });
});
