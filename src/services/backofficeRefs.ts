import { anyApi } from "convex/server";
import type { FunctionReference } from "convex/server";

export type BirthTimePrecision = "known" | "approximate" | "unknown";
export type LabReviewStatus = "needs_review" | "approved" | "rejected";

export type LabSubjectInput = {
  subjectId?: string;
  displayName: string;
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: BirthTimePrecision;
  birthPlaceLabel: string;
  placeId?: string;
  placeProvider?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  notes?: string;
};

export type LabSubject = Omit<LabSubjectInput, "subjectId"> & {
  _id: string;
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
};

export type LabRun = {
  _id: string;
  createdByUserId: string;
  subjectId: string;
  localDate: string;
  timezone: string;
  normalizedInput: Record<string, unknown>;
  chartPayload: Record<string, unknown>;
  dailyReadingPayload: Record<string, unknown>;
  editorialPayload?: Record<string, unknown>;
  futureSelfNote?: string;
  editorialUpdatedAt?: number;
  modelVersions: {
    chart: string;
    dailyReading: string;
  };
  modelGaps: string[];
  reviewStatus?: LabReviewStatus;
  reviewNote?: string;
  reviewedAt?: number;
  createdAt: number;
};

export type LabRunDetail = {
  run: LabRun;
  subject: LabSubject | null;
};

export type LabRunPayload = {
  normalizedInput: Record<string, unknown>;
  chart: Record<string, unknown>;
  dailyReading: Record<string, unknown>;
  modelVersions: {
    chart: string;
    dailyReading: string;
  };
  modelGaps: string[];
};

export const backofficeApi = {
  listSubjects: anyApi.backoffice.listSubjects as FunctionReference<"query", "public", {}, LabSubject[]>,
  seedSubjects: anyApi.backoffice.seedSubjects as FunctionReference<
    "mutation",
    "public",
    {},
    { created: number; total: number }
  >,
  upsertSubject: anyApi.backoffice.upsertSubject as FunctionReference<"mutation", "public", LabSubjectInput, string>,
  runModel: anyApi.backoffice.runModel as FunctionReference<
    "mutation",
    "public",
    { subjectId: string; localDate: string; timezone?: string },
    LabRun
  >,
  previewAstrologyRun: anyApi.backoffice.previewAstrologyRun as FunctionReference<
    "action",
    "public",
    LabSubjectInput & { localDate: string; runTimezone?: string },
    LabRunPayload
  >,
  saveLabRun: anyApi.backoffice.saveLabRun as FunctionReference<
    "mutation",
    "public",
    {
      subjectId: string;
      localDate: string;
      timezone: string;
      normalizedInput: Record<string, unknown>;
      chartPayload: Record<string, unknown>;
      dailyReadingPayload: Record<string, unknown>;
      modelVersions: {
        chart: string;
        dailyReading: string;
      };
      modelGaps: string[];
    },
    LabRun
  >,
  reviewRun: anyApi.backoffice.reviewRun as FunctionReference<
    "mutation",
    "public",
    { runId: string; reviewStatus: LabReviewStatus; reviewNote?: string },
    LabRun
  >,
  updateRunEditorialPayload: anyApi.backoffice.updateRunEditorialPayload as FunctionReference<
    "mutation",
    "public",
    { runId: string; editorialPayload: Record<string, unknown> },
    LabRun
  >,
  saveFutureSelfNote: anyApi.backoffice.saveFutureSelfNote as FunctionReference<
    "mutation",
    "public",
    { runId: string; futureSelfNote?: string },
    LabRun
  >,
  resolvePlace: anyApi.backoffice.resolvePlace as FunctionReference<
    "action",
    "public",
    { query: string },
    Record<string, unknown>
  >,
  listRuns: anyApi.backoffice.listRuns as FunctionReference<
    "query",
    "public",
    { subjectId?: string },
    LabRun[]
  >,
  getRun: anyApi.backoffice.getRun as FunctionReference<"query", "public", { runId: string }, LabRunDetail>
};
