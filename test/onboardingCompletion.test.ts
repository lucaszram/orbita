import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildBirthDataHash, buildNatalChartCacheKey } from "../convex/lib/birthDataConsistency";
import {
  chartMatchesCompletionBirthData,
  deriveOnboardingCompletion,
  hasValidCompletionBirthData,
  hasValidCompletionBirthInput,
  hasValidCompletionProfile
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
  it("requires explicit persisted first and last name", () => {
    assert.equal(hasValidCompletionProfile(USER), true);
    assert.equal(hasValidCompletionProfile({ ...USER, firstName: "  " }), false);
    assert.equal(hasValidCompletionProfile({ ...USER, lastName: undefined }), false);
    assert.equal(
      deriveOnboardingCompletion({
        authenticated: true,
        user: { _id: USER._id },
        signupInProgress: true,
        birthData: BIRTH,
        chart: CHART
      }).status,
      "needs_name"
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

    assert.equal(
      deriveOnboardingCompletion({
        authenticated: true,
        user: USER,
        signupInProgress: true,
        birthData: BIRTH,
        chart: null
      }).status,
      "chart_pending"
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

  it("records completion only with the persisted chart and reuses an existing provider result", () => {
    const onboarding = readFileSync(join(import.meta.dirname, "../convex/onboarding.ts"), "utf8");
    const charts = readFileSync(join(import.meta.dirname, "../convex/charts.ts"), "utf8");
    const completeBirthStart = onboarding.indexOf("export const completeBirthData");
    const completeBirthEnd = onboarding.indexOf("export const markAccountCreated", completeBirthStart);
    assert.doesNotMatch(onboarding.slice(completeBirthStart, completeBirthEnd), /onboarding_completed/);

    const persistStart = charts.indexOf("export const persistCalculatedNatalChart");
    const actionStart = charts.indexOf("export const calculateOrCreateNatalChart");
    const persist = charts.slice(persistStart, actionStart);
    assert.match(persist, /eventName: "onboarding_completed"/);
    assert.match(persist, /dedupeKey: String\(birthData\._id\)/);

    const action = charts.slice(actionStart);
    const cacheHit = action.indexOf("if (state.existingChart)");
    const provider = action.indexOf("runAstrologyApiNatalChart");
    assert.ok(cacheHit >= 0 && provider > cacheHit);
    assert.match(action.slice(cacheHit, provider), /persistCalculatedNatalChart/);
    assert.match(action.slice(cacheHit, provider), /return chart/);
  });
});
