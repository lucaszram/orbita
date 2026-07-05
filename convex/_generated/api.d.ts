/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as backoffice from "../backoffice.js";
import type * as birthData from "../birthData.js";
import type * as charts from "../charts.js";
import type * as contentModules from "../contentModules.js";
import type * as devices from "../devices.js";
import type * as home from "../home.js";
import type * as journal from "../journal.js";
import type * as lib_astrologyApi from "../lib/astrologyApi.js";
import type * as lib_backoffice from "../lib/backoffice.js";
import type * as lib_orbita from "../lib/orbita.js";
import type * as lib_users from "../lib/users.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as readings from "../readings.js";
import type * as relationships from "../relationships.js";
import type * as studio from "../studio.js";
import type * as subscriptions from "../subscriptions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  backoffice: typeof backoffice;
  birthData: typeof birthData;
  charts: typeof charts;
  contentModules: typeof contentModules;
  devices: typeof devices;
  home: typeof home;
  journal: typeof journal;
  "lib/astrologyApi": typeof lib_astrologyApi;
  "lib/backoffice": typeof lib_backoffice;
  "lib/orbita": typeof lib_orbita;
  "lib/users": typeof lib_users;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  readings: typeof readings;
  relationships: typeof relationships;
  studio: typeof studio;
  subscriptions: typeof subscriptions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
