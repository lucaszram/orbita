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
import type * as http from "../http.js";
import type * as journal from "../journal.js";
import type * as lib_aiGateway from "../lib/aiGateway.js";
import type * as lib_astrologyApi from "../lib/astrologyApi.js";
import type * as lib_backoffice from "../lib/backoffice.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_orbita from "../lib/orbita.js";
import type * as lib_users from "../lib/users.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as payments_revenuecat from "../payments/revenuecat.js";
import type * as payments_stripeActions from "../payments/stripeActions.js";
import type * as payments_stripeHttp from "../payments/stripeHttp.js";
import type * as payments_stripeInternal from "../payments/stripeInternal.js";
import type * as places from "../places.js";
import type * as publicLab from "../publicLab.js";
import type * as readings from "../readings.js";
import type * as relationships from "../relationships.js";
import type * as studio from "../studio.js";
import type * as subscriptions from "../subscriptions.js";
import type * as transits from "../transits.js";
import type * as users from "../users.js";
import type * as webB0Seed from "../webB0Seed.js";

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
  http: typeof http;
  journal: typeof journal;
  "lib/aiGateway": typeof lib_aiGateway;
  "lib/astrologyApi": typeof lib_astrologyApi;
  "lib/backoffice": typeof lib_backoffice;
  "lib/entitlements": typeof lib_entitlements;
  "lib/orbita": typeof lib_orbita;
  "lib/users": typeof lib_users;
  migrations: typeof migrations;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  "payments/revenuecat": typeof payments_revenuecat;
  "payments/stripeActions": typeof payments_stripeActions;
  "payments/stripeHttp": typeof payments_stripeHttp;
  "payments/stripeInternal": typeof payments_stripeInternal;
  places: typeof places;
  publicLab: typeof publicLab;
  readings: typeof readings;
  relationships: typeof relationships;
  studio: typeof studio;
  subscriptions: typeof subscriptions;
  transits: typeof transits;
  users: typeof users;
  webB0Seed: typeof webB0Seed;
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
