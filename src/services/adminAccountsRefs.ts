/**
 * Referencias tipadas a `convex/adminAccounts.*`.
 *
 * El frontend NO importa `convex/_generated` (ver `WORKFLOW.md` §3-4): apunta al
 * backend por `anyApi` y le pone tipos a mano con la forma del contrato. Las
 * formas viven en `src/domain/adminAccounts.ts`, así que el mismo tipo que usa
 * la UI es el que se afirma acá.
 *
 * Las dos queries paginadas declaran `paginationOpts` + `PaginationResult` para
 * poder pasarlas a `usePaginatedQuery` sin castear en el punto de uso.
 */
import { anyApi } from "convex/server";
import type { FunctionReference, PaginationOptions, PaginationResult } from "convex/server";

import type {
  AdminAccount,
  AdminAccountDetail,
  AdminActivityEvent,
  AdminDashboard,
  AdminGrantResult,
  AdminRange,
  AdminRevokeResult,
  AdminSegment,
  AdminSort
} from "@/domain/adminAccounts";

export const adminAccountsApi = {
  getDashboard: anyApi.adminAccounts.getDashboard as FunctionReference<
    "query",
    "public",
    { range: AdminRange },
    AdminDashboard
  >,
  listAccounts: anyApi.adminAccounts.listAccounts as FunctionReference<
    "query",
    "public",
    { paginationOpts: PaginationOptions; segment: AdminSegment; sort: AdminSort },
    PaginationResult<AdminAccount>
  >,
  searchAccounts: anyApi.adminAccounts.searchAccounts as FunctionReference<
    "query",
    "public",
    { query: string; segment: AdminSegment; limit: number },
    AdminAccount[]
  >,
  getAccount: anyApi.adminAccounts.getAccount as FunctionReference<
    "query",
    "public",
    { userId: string },
    AdminAccountDetail | null
  >,
  listActivity: anyApi.adminAccounts.listActivity as FunctionReference<
    "query",
    "public",
    { userId: string; paginationOpts: PaginationOptions },
    PaginationResult<AdminActivityEvent>
  >,
  grantPro: anyApi.adminAccounts.grantPro as FunctionReference<
    "mutation",
    "public",
    { userId: string; mode: "permanent" | "until"; expiresAt?: number; reason: string },
    AdminGrantResult
  >,
  revokePro: anyApi.adminAccounts.revokePro as FunctionReference<
    "mutation",
    "public",
    { userId: string; reason: string },
    AdminRevokeResult
  >
};
