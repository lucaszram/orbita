import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildBirthDataHash, buildNatalChartCacheKey } from "../convex/lib/birthDataConsistency";
import {
  chartMatchesCompletionBirthData,
  deriveOnboardingCompletion,
  hasCompletionUser,
  hasValidCompletionBirthData,
  hasValidCompletionBirthInput
} from "../convex/lib/onboardingCompletion";
import { ASTROLOGY_API_CHART_CALCULATION_VERSION } from "../convex/lib/orbita";

const USER = { _id: "user_1", firstName: "Lucía", lastName: "Pérez" };
const BIRTH = {
  _id: "birth_1",
  birthDate: "1990-06-15",
  birthTime: "09:30",
  birthTimePrecision: "known",
  birthPlaceLabel: "Rosario, Argentina",
  latitude: -32.9468,
  longitude: -60.6393,
  timezone: "America/Argentina/Buenos_Aires"
};
const HASH = buildBirthDataHash(BIRTH);
const CHART = {
  userId: USER._id,
  birthDataId: BIRTH._id,
  birthDataHash: HASH,
  cacheKey: buildNatalChartCacheKey(USER._id, HASH),
  calculationVersion: ASTROLOGY_API_CHART_CALCULATION_VERSION,
  payload: { placements: [{ key: "sun" }] }
};

describe("authoritative onboarding completion", () => {
  it("does not require a name when Clerk did not provide one", () => {
    assert.equal(hasCompletionUser(USER), true);
    assert.equal(hasCompletionUser({ _id: USER._id }), true);
    assert.equal(hasCompletionUser(null), false);
    assert.equal(
      deriveOnboardingCompletion({
        authenticated: true,
        user: { _id: USER._id },
        signupInProgress: true,
        birthData: BIRTH,
        chart: CHART
      }).status,
      "chart_ready"
    );
  });

  it("keeps a missing internal user in recovery without inventing a name step", () => {
    assert.deepEqual(
      deriveOnboardingCompletion({
        authenticated: true,
        user: null,
        signupInProgress: true,
        birthData: null,
        chart: null
      }),
      {
        status: "onboarding_incomplete",
        recovery: "onboarding",
        profileReady: false,
        birthDataReady: false,
        chartReady: false
      }
    );
  });

  it("separates a new signup recovery from an existing incomplete account", () => {
    const signup = deriveOnboardingCompletion({
      authenticated: true,
      user: USER,
      signupInProgress: true,
      birthData: null,
      chart: null
    });
    const existing = deriveOnboardingCompletion({
      authenticated: true,
      user: USER,
      signupInProgress: false,
      birthData: null,
      chart: null
    });

    assert.deepEqual(signup, {
      status: "onboarding_incomplete",
      recovery: "onboarding",
      profileReady: true,
      birthDataReady: false,
      chartReady: false
    });
    assert.deepEqual(existing, {
      status: "profile_incomplete",
      recovery: "edit_birth_data",
      profileReady: true,
      birthDataReady: false,
      chartReady: false
    });
  });

  it("rejects incomplete or placeholder natal data before consulting a chart", () => {
    assert.equal(hasValidCompletionBirthData(BIRTH), true);
    const { _id: _birthId, ...birthInput } = BIRTH;
    assert.equal(hasValidCompletionBirthInput(birthInput), true);
    for (const invalid of [
      { ...BIRTH, birthDate: "1990-02-31" },
      { ...BIRTH, birthTime: undefined },
      { ...BIRTH, birthPlaceLabel: "Sin especificar" },
      { ...BIRTH, latitude: 91 },
      { ...BIRTH, longitude: -181 },
      { ...BIRTH, timezone: "" }
    ]) {
      assert.equal(hasValidCompletionBirthData(invalid), false);
    }
    assert.equal(
      hasValidCompletionBirthData({
        ...BIRTH,
        birthTime: undefined,
        birthTimePrecision: "unknown"
      }),
      true
    );
  });

  it("requires the exact current birth id, hash, cache key and calculation version", () => {
    assert.equal(chartMatchesCompletionBirthData({ userId: USER._id, birthData: BIRTH, chart: CHART }), true);
    for (const chart of [
      { ...CHART, userId: "user_2" },
      { ...CHART, birthDataId: "birth_old" },
      { ...CHART, birthDataHash: "old" },
      { ...CHART, cacheKey: "old" },
      { ...CHART, calculationVersion: "old" },
      { ...CHART, payload: null }
    ]) {
      assert.equal(chartMatchesCompletionBirthData({ userId: USER._id, birthData: BIRTH, chart }), false);
    }
  });

  it("only returns chart_ready after every persisted invariant is true", () => {
    assert.deepEqual(
      deriveOnboardingCompletion({
        authenticated: true,
        user: USER,
        signupInProgress: true,
        birthData: BIRTH,
        chart: CHART
      }),
      {
        status: "chart_ready",
        recovery: null,
        profileReady: true,
        birthDataReady: true,
        chartReady: true
      }
    );

    assert.deepEqual(
      deriveOnboardingCompletion({
        authenticated: true,
        user: USER,
        signupInProgress: true,
        birthData: BIRTH,
        chart: null
      }),
      {
        status: "chart_pending",
        recovery: null,
        profileReady: true,
        birthDataReady: true,
        chartReady: false
      }
    );
  });

  it("keeps readiness read-only and provider-free", () => {
    const source = readFileSync(join(import.meta.dirname, "../convex/onboarding.ts"), "utf8");
    const start = source.indexOf("export const getCompletionStatus");
    const end = source.indexOf("export const saveDraft", start);
    const query = source.slice(start, end);
    assert.ok(start >= 0 && end > start);
    assert.doesNotMatch(query, /runAction|runMutation|scheduler|AstrologyAPI|resolvePlace/);
    assert.match(query, /flowOrigin === "anonymous_signup"/);
    assert.doesNotMatch(query, /!draft\.flowOrigin/);

    const confirmStart = source.indexOf("export const confirmSignupDraft");
    const confirmEnd = source.indexOf("export const saveDraft", confirmStart);
    const confirmation = source.slice(confirmStart, confirmEnd);
    assert.ok(confirmStart >= 0 && confirmEnd > confirmStart);
    assert.match(confirmation, /draft\.flowOrigin !== "anonymous_signup"/);
    assert.match(confirmation, /draft\.userId/);
    assert.match(confirmation, /ONBOARDING_SIGNUP_DRAFT_INCOMPLETE/);
    assert.doesNotMatch(confirmation, /scheduler|runAction|AstrologyAPI/);
  });

  it("records completion with persisted birth data and keeps chart cache reuse", () => {
    const onboarding = readFileSync(join(import.meta.dirname, "../convex/onboarding.ts"), "utf8");
    const charts = readFileSync(join(import.meta.dirname, "../convex/charts.ts"), "utf8");
    const completeBirthStart = onboarding.indexOf("export const completeSignupFromDraft");
    const completeBirthEnd = onboarding.indexOf("export const markAccountCreated", completeBirthStart);
    const completionWrite = onboarding.slice(completeBirthStart, completeBirthEnd);
    assert.match(completionWrite, /eventName: "onboarding_completed"/);
    assert.match(completionWrite, /dedupeKey: String\(birthDataId\)/);

    const persistStart = charts.indexOf("export const persistCalculatedNatalChart");
    const runnerStart = charts.indexOf("export async function runNatalChartCalculation");
    const persist = charts.slice(persistStart, runnerStart);
    assert.doesNotMatch(persist, /onboarding_completed/);

    // El camino de reutilización sigue siendo el mismo trabajo canónico —la
    // mutación que reafirma identidad y registra el completion— y la suficiencia
    // del cache se sigue midiendo ANTES de tocar al proveedor: sin eso, una
    // carta sana volvería a pegarle al proveedor en cada alta.
    const runner = charts.slice(runnerStart, charts.indexOf("export const calculateOrCreateNatalChart"));
    const persistHelper = runner.indexOf("const persist = async (");
    const cacheHit = runner.indexOf("if (!(hasExistingChart && existingIsSufficient))");
    const provider = runner.indexOf("await provider(");
    assert.ok(persistHelper >= 0 && cacheHit > persistHelper && provider > cacheHit);
    assert.match(runner.slice(persistHelper, cacheHit), /persistCalculatedNatalChart/);
    assert.match(runner.slice(persistHelper, cacheHit), /generatePersonalityReadingForChart/);
    assert.match(runner.slice(0, cacheHit), /storedNatalChartIsSufficient/);
    // El camino de reutilización propone la fila que ya estaba, con su payload
    // intacto; la mutación es la que decide si de verdad queda.
    assert.match(runner.slice(provider), /payload: state\.existingChart\.payload/);
    // Y al volver de la mutación se vuelve a medir la carta FINAL: una corrida
    // atrasada no puede reportar un fallo sobre una carta que ya está completa.
    const persistCall = runner.indexOf("await persist(candidato.payload");
    assert.ok(persistCall > provider, "primero se persiste");
    assert.match(runner.slice(persistCall), /resolveFinalNatalOutcome/, "y después se mide lo que quedó");

    // Y el alta sigue recibiendo una carta —o un rechazo—, no un desenlace: su
    // action es la de siempre y su contrato no cambió.
    const antigua = charts.slice(
      charts.indexOf("export const calculateOrCreateNatalChart"),
      charts.indexOf("export const recoverNatalChart"),
    );
    assert.match(antigua, /return result\.chart/);
    assert.match(antigua, /throw new Error\(`Natal chart provider failed/);
  });
});
