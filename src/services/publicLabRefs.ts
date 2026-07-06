import { anyApi } from "convex/server";
import type { FunctionReference } from "convex/server";

export type PublicLabBirthTimePrecision = "known" | "approximate" | "unknown";

export type PublicLabInput = {
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: PublicLabBirthTimePrecision;
  birthPlaceLabel: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  localDate: string;
  runTimezone?: string;
  displayName?: string;
  accessKey?: string;
};

export type PublicLabPlaceLookup = {
  status: "success" | "not_configured" | "error";
  provider?: string;
  query?: string;
  endpoint?: string;
  places: Array<{
    label?: string;
    placeId?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    utcOffset?: number;
  }>;
  error?: string;
};

export type PublicDailyHome = {
  displayName?: string;
  localDate: string;
  timezone: string;
  header: {
    localDate: string;
    timezone: string;
    greeting: string;
    headline: string;
    subheadline: string;
  };
  natalBase: {
    sun: unknown;
    moon: unknown;
    ascendant: unknown;
    accuracy: string;
    limitations: unknown[];
  };
  highlightedTransit: unknown;
  modules: {
    do: string[];
    avoid: string[];
    energy: string;
    action: string;
    question: string;
  };
  topics: unknown[];
  longRead: unknown;
  void: unknown;
  futureSelf: unknown;
  personalization: Record<string, unknown>;
  chartProfile: Record<string, unknown> | null;
  transits: {
    highlighted: unknown;
    secondary: unknown[];
    explanation: string;
  };
  provider: {
    status: string;
    providerVersion?: string;
    houseSystem?: string;
    warnings: string[];
    error?: string | null;
  };
  modelGaps: string[];
  modelVersions: Record<string, unknown>;
  reviewStatus: string;
  contentVersion: string;
  calculationVersion: string;
  mode: string;
  source: string;
};

export type CompleteHoroscopeFeature = {
  id: string;
  title: string;
  source: Array<"A" | "B" | "C" | "dataset">;
  status: "ready" | "stub" | "needs_provider" | "needs_llm" | "needs_input" | "planned";
  entitlement: "free" | "freemium" | "premium";
  data?: unknown;
  summary?: string;
  missing?: string[];
};

export type CompleteHoroscopeProfile = {
  version: string;
  generatedAt: number;
  input: Record<string, unknown>;
  sourceModel: Record<"A" | "B" | "C", string>;
  provider: PublicDailyHome["provider"];
  cachePlan: Record<string, string>;
  blocks: {
    identity: CompleteHoroscopeFeature[];
    natalChart: CompleteHoroscopeFeature[];
    daily: CompleteHoroscopeFeature[];
    currentSky: CompleteHoroscopeFeature[];
    future: CompleteHoroscopeFeature[];
    extras: CompleteHoroscopeFeature[];
  };
  dailyHome: PublicDailyHome;
  modelGaps: string[];
  nextBackendNeeds: string[];
  rawPolicy: {
    returnsProviderRaw: boolean;
    reason: string;
  };
  chartPayloadSummary: Record<string, unknown>;
};

export const publicLabApi = {
  previewDailyHome: anyApi.publicLab.previewDailyHome as FunctionReference<
    "action",
    "public",
    PublicLabInput,
    PublicDailyHome
  >,
  previewCompleteHoroscope: anyApi.publicLab.previewCompleteHoroscope as FunctionReference<
    "action",
    "public",
    PublicLabInput,
    CompleteHoroscopeProfile
  >,
  resolvePlace: anyApi.publicLab.resolvePlace as FunctionReference<
    "action",
    "public",
    { query: string; accessKey?: string },
    PublicLabPlaceLookup
  >
};
