import { anyApi } from "convex/server";
import type { FunctionReference } from "convex/server";

export type StudioAccess = {
  allowed: true;
  email?: string;
  name?: string;
};

export const studioApi = {
  checkAccess: anyApi.studio.checkAccess as FunctionReference<"query", "public", {}, StudioAccess>
};
