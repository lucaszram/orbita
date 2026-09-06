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
import type * as content_tarotEditorial from "../content/tarotEditorial.js";
import type * as contentModules from "../contentModules.js";
import type * as crons from "../crons.js";
import type * as daily from "../daily.js";
import type * as devices from "../devices.js";
import type * as home from "../home.js";
import type * as http from "../http.js";
import type * as journal from "../journal.js";
import type * as lib_accountDeletion from "../lib/accountDeletion.js";
import type * as lib_aiGateway from "../lib/aiGateway.js";
import type * as lib_astrologyApi from "../lib/astrologyApi.js";
import type * as lib_backoffice from "../lib/backoffice.js";
import type * as lib_birthDataConsistency from "../lib/birthDataConsistency.js";
import type * as lib_civilTime from "../lib/civilTime.js";
import type * as lib_commerce from "../lib/commerce.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_environment from "../lib/environment.js";
import type * as lib_estacionVital from "../lib/estacionVital.js";
import type * as lib_layersMath from "../lib/layersMath.js";
import type * as lib_onboardingBirthData from "../lib/onboardingBirthData.js";
import type * as lib_onboardingCompletion from "../lib/onboardingCompletion.js";
import type * as lib_onboardingTimezone from "../lib/onboardingTimezone.js";
import type * as lib_onboardingTriad from "../lib/onboardingTriad.js";
import type * as lib_orbita from "../lib/orbita.js";
import type * as lib_placeTimezone from "../lib/placeTimezone.js";
import type * as lib_productAnalytics from "../lib/productAnalytics.js";
import type * as lib_publicNatalChart from "../lib/publicNatalChart.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_stripeApi from "../lib/stripeApi.js";
import type * as lib_stripeSubscription from "../lib/stripeSubscription.js";
import type * as lib_subscriptionAccess from "../lib/subscriptionAccess.js";
import type * as lib_synastry from "../lib/synastry.js";
import type * as lib_tarot from "../lib/tarot.js";
import type * as lib_tarotAccess from "../lib/tarotAccess.js";
import type * as lib_transitPanorama from "../lib/transitPanorama.js";
import type * as lib_tropicalEphemeris from "../lib/tropicalEphemeris.js";
import type * as lib_userProfile from "../lib/userProfile.js";
import type * as lib_users from "../lib/users.js";
import type * as migrations from "../migrations.js";
import type * as momento from "../momento.js";
import type * as notifications from "../notifications.js";
import type * as notify from "../notify.js";
import type * as onboarding from "../onboarding.js";
import type * as payments_revenuecat from "../payments/revenuecat.js";
import type * as payments_stripeActions from "../payments/stripeActions.js";
import type * as payments_stripeHttp from "../payments/stripeHttp.js";
import type * as payments_stripeInternal from "../payments/stripeInternal.js";
import type * as placeTimezone from "../placeTimezone.js";
import type * as places from "../places.js";
import type * as publicLab from "../publicLab.js";
import type * as publicOnboarding from "../publicOnboarding.js";
import type * as publicRateLimits from "../publicRateLimits.js";
import type * as readings from "../readings.js";
import type * as relationships from "../relationships.js";
import type * as sky from "../sky.js";
import type * as studio from "../studio.js";
import type * as subscriptions from "../subscriptions.js";
import type * as telemetry from "../telemetry.js";
import type * as transits from "../transits.js";
import type * as users from "../users.js";
import type * as void_ from "../void.js";
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
  "content/tarotEditorial": typeof content_tarotEditorial;
  contentModules: typeof contentModules;
  crons: typeof crons;
  daily: typeof daily;
  devices: typeof devices;
  home: typeof home;
  http: typeof http;
  journal: typeof journal;
  "lib/accountDeletion": typeof lib_accountDeletion;
  "lib/aiGateway": typeof lib_aiGateway;
  "lib/astrologyApi": typeof lib_astrologyApi;
  "lib/backoffice": typeof lib_backoffice;
  "lib/birthDataConsistency": typeof lib_birthDataConsistency;
  "lib/civilTime": typeof lib_civilTime;
  "lib/commerce": typeof lib_commerce;
  "lib/entitlements": typeof lib_entitlements;
  "lib/environment": typeof lib_environment;
  "lib/estacionVital": typeof lib_estacionVital;
  "lib/layersMath": typeof lib_layersMath;
  "lib/onboardingBirthData": typeof lib_onboardingBirthData;
  "lib/onboardingCompletion": typeof lib_onboardingCompletion;
  "lib/onboardingTimezone": typeof lib_onboardingTimezone;
  "lib/onboardingTriad": typeof lib_onboardingTriad;
  "lib/orbita": typeof lib_orbita;
  "lib/placeTimezone": typeof lib_placeTimezone;
  "lib/productAnalytics": typeof lib_productAnalytics;
  "lib/publicNatalChart": typeof lib_publicNatalChart;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/stripeApi": typeof lib_stripeApi;
  "lib/stripeSubscription": typeof lib_stripeSubscription;
  "lib/subscriptionAccess": typeof lib_subscriptionAccess;
  "lib/synastry": typeof lib_synastry;
  "lib/tarot": typeof lib_tarot;
  "lib/tarotAccess": typeof lib_tarotAccess;
  "lib/transitPanorama": typeof lib_transitPanorama;
  "lib/tropicalEphemeris": typeof lib_tropicalEphemeris;
  "lib/userProfile": typeof lib_userProfile;
  "lib/users": typeof lib_users;
  migrations: typeof migrations;
  momento: typeof momento;
  notifications: typeof notifications;
  notify: typeof notify;
  onboarding: typeof onboarding;
  "payments/revenuecat": typeof payments_revenuecat;
  "payments/stripeActions": typeof payments_stripeActions;
  "payments/stripeHttp": typeof payments_stripeHttp;
  "payments/stripeInternal": typeof payments_stripeInternal;
  placeTimezone: typeof placeTimezone;
  places: typeof places;
  publicLab: typeof publicLab;
  publicOnboarding: typeof publicOnboarding;
  publicRateLimits: typeof publicRateLimits;
  readings: typeof readings;
  relationships: typeof relationships;
  sky: typeof sky;
  studio: typeof studio;
  subscriptions: typeof subscriptions;
  telemetry: typeof telemetry;
  transits: typeof transits;
  users: typeof users;
  void: typeof void_;
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
